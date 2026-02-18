"""
Candidate Generation Module
Generates deterministic trade candidates based on market conditions and strategy templates.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, date
from enum import Enum
import logging

from .config import AutopilotConfig, StrategyTemplate
from .universe import UniverseManager, UniverseSymbol
from .features import FeatureEngine, SymbolFeatures, TrendDirection, VolatilityRegime

logger = logging.getLogger(__name__)


class CandidateStatus(Enum):
    """Status of a trade candidate"""
    PENDING = "pending"
    SELECTED = "selected"
    REJECTED = "rejected"
    EXECUTED = "executed"


@dataclass
class OptionLeg:
    """Single option leg in a strategy"""
    option_type: str  # "call" or "put"
    strike: float
    expiry: date
    side: str  # "buy" or "sell"
    quantity: int = 1
    premium: float = 0.0
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "option_type": self.option_type,
            "strike": self.strike,
            "expiry": self.expiry.isoformat() if self.expiry else None,
            "side": self.side,
            "quantity": self.quantity,
            "premium": self.premium,
            "delta": self.delta,
            "gamma": self.gamma,
            "theta": self.theta,
            "vega": self.vega,
        }


@dataclass
class TradeCandidate:
    """A potential trade candidate"""
    id: str
    symbol: str
    template: StrategyTemplate
    legs: List[OptionLeg]
    underlying_price: float
    max_profit: float
    max_loss: float
    pop: float
    dte: int
    iv_rank: float
    liquidity_score: float
    spread_percent: float
    regime: str
    trend: str
    score: float = 0.0
    adjusted_score: float = 0.0
    rejection_reasons: List[str] = field(default_factory=list)
    client_order_id: Optional[str] = None
    
    # Scoring
    base_score: float = 0.0
    adjusted_score: float = 0.0
    
    # Selection metadata
    status: CandidateStatus = CandidateStatus.PENDING
    selection_reason: str = ""
    rejection_reasons: List[str] = field(default_factory=list)
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def net_premium(self) -> float:
        """Calculate net premium (positive = credit, negative = debit)"""
        return sum(
            leg.premium * leg.quantity * (1 if leg.side == "sell" else -1)
            for leg in self.legs
        )
    
    def net_delta(self) -> float:
        """Calculate net delta exposure"""
        return sum(
            leg.delta * leg.quantity * (1 if leg.side == "buy" else -1)
            for leg in self.legs
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "template": self.template.value,
            "legs": [leg.to_dict() for leg in self.legs],
            "underlying_price": self.underlying_price,
            "max_loss": self.max_loss,
            "max_profit": self.max_profit,
            "pop": self.pop,
            "dte": self.dte,
            "iv_rank": self.iv_rank,
            "liquidity_score": self.liquidity_score,
            "spread_percent": self.spread_percent,
            "regime": self.regime,
            "trend": self.trend,
            "base_score": self.base_score,
            "adjusted_score": self.adjusted_score,
            "status": self.status.value,
            "selection_reason": self.selection_reason,
            "rejection_reasons": self.rejection_reasons,
            "net_premium": self.net_premium(),
            "net_delta": self.net_delta(),
            "created_at": self.created_at.isoformat(),
        }


class CandidateGenerator:
    """
    Generates trade candidates based on market conditions.
    Purely deterministic - no randomness or external LLM calls.
    """
    
    # DTE constraints per template (relaxed to allow 1+ days)
    DTE_CONSTRAINTS = {
        # V1 Single-leg
        StrategyTemplate.LONG_CALL: (0, 7),
        StrategyTemplate.LONG_PUT: (0, 7),
        # V2+ Spreads
        StrategyTemplate.PUT_CREDIT_SPREAD: (1, 60),
        StrategyTemplate.CALL_CREDIT_SPREAD: (1, 60),
        StrategyTemplate.IRON_CONDOR: (7, 60),
        StrategyTemplate.CALL_DEBIT_SPREAD: (1, 60),
        StrategyTemplate.PUT_DEBIT_SPREAD: (1, 60),
    }
    
    # Delta targets for short legs (credit spreads)
    CREDIT_DELTA_RANGE = (0.15, 0.35)
    
    # Delta targets for single-leg (v1) - ATM-ish
    SINGLE_LEG_DELTA_RANGE = (0.35, 0.65)
    
    # Spread width constraints (in dollars)
    SPREAD_WIDTH_RANGE = (1, 10)
    
    def __init__(
        self,
        config: AutopilotConfig,
        universe_manager: UniverseManager,
        feature_engine: FeatureEngine,
    ):
        self.config = config
        self.universe = universe_manager
        self.features = feature_engine
        self._candidate_counter = 0

    async def generate(
        self,
        symbol: str,
        features: SymbolFeatures,
        weekly_only: bool = True,
    ) -> List[TradeCandidate]:
        """Generate candidates for a single symbol with weekly expiry focus."""
        from .data_fetcher import get_data_provider

        provider = get_data_provider()
        expiry = provider.get_next_weekly_expiry() if weekly_only else provider.get_next_monthly_expiry()
        chain = provider.get_options_chain(symbol, expiry=expiry, weekly_only=weekly_only)
        if not chain:
            return []

        price = features.last_price
        trend = features.trend

        if trend == TrendDirection.BULLISH:
            # V1 compliance: use LONG_CALL for bullish (long premium only)
            template = StrategyTemplate.LONG_CALL
            option_type = "call"
            direction = 1
        elif trend == TrendDirection.BEARISH:
            # V1 compliance: use LONG_PUT for bearish (long premium only)
            template = StrategyTemplate.LONG_PUT
            option_type = "put"
            direction = -1
        else:
            # Neutral: no strong directional bias, skip for V1
            # (V1 requires directional conviction for long premium)
            return []

        # Find short leg near target delta
        target_delta = 0.30
        candidates = [
            o for o in chain
            if o.option_type == option_type
            and o.delta != 0
        ]
        if option_type == "put":
            candidates = [o for o in candidates if o.strike < price]
        else:
            candidates = [o for o in candidates if o.strike > price]

        if not candidates:
            return []

        short_leg = min(candidates, key=lambda o: abs(abs(o.delta) - target_delta))

        # Pick long leg 5 strikes away (or nearest)
        width = max(1.0, self.config.strategy_constraints.min_spread_width)
        long_strike = short_leg.strike + (direction * width)
        long_leg_candidates = [o for o in candidates if o.expiry == short_leg.expiry]
        if option_type == "put":
            long_leg_candidates = [o for o in long_leg_candidates if o.strike < short_leg.strike]
        else:
            long_leg_candidates = [o for o in long_leg_candidates if o.strike > short_leg.strike]

        if not long_leg_candidates:
            return []

        long_leg = min(long_leg_candidates, key=lambda o: abs(o.strike - long_strike))

        credit = max(short_leg.bid - long_leg.ask, 0)
        max_loss = max(abs(short_leg.strike - long_leg.strike) - credit, 0)

        self._candidate_counter += 1
        candidate = TradeCandidate(
            id=f"cand-{symbol}-{self._candidate_counter}",
            symbol=symbol,
            template=template,
            legs=[
                OptionLeg(option_type=option_type, strike=short_leg.strike, expiry=short_leg.expiry, side="sell", quantity=1, premium=short_leg.bid, delta=short_leg.delta),
                OptionLeg(option_type=option_type, strike=long_leg.strike, expiry=long_leg.expiry, side="buy", quantity=1, premium=long_leg.ask, delta=long_leg.delta),
            ],
            underlying_price=price,
            max_loss=max_loss,
            max_profit=credit,
            pop=0.55,
            dte=max((short_leg.expiry - date.today()).days, 1),
            iv_rank=features.iv_rank,
            liquidity_score=features.liquidity_score,
            spread_percent=features.avg_spread_pct,
            regime=features.vol_regime.value,
            trend=features.trend.value,
            base_score=features.liquidity_score + features.trend_strength,
            adjusted_score=features.liquidity_score + features.trend_strength,
        )

        return [candidate]
    
    def generate_candidates(
        self,
        option_chains: Dict[str, Any],
        current_prices: Dict[str, float],
    ) -> List[TradeCandidate]:
        """
        Generate all valid trade candidates for the current market state.
        
        Args:
            option_chains: Options chain data keyed by symbol
            current_prices: Current underlying prices keyed by symbol
            
        Returns:
            List of TradeCandidate objects
        """
        candidates = []
        
        # Get tradeable symbols
        tradeable = self.universe.get_tradeable_symbols()
        
        for symbol_info in tradeable:
            symbol = symbol_info.symbol
            
            if symbol not in option_chains or symbol not in current_prices:
                logger.debug(f"Skipping {symbol}: missing data")
                continue
            
            # Compute features for this symbol
            # For mock data, create simplified features
            price = current_prices.get(symbol, 100.0)
            chain = option_chains.get(symbol, {})
            
            # Extract IV from chain if available
            avg_iv = 0.30  # Default IV
            if "chains" in chain:
                ivs = []
                for exp_data in chain["chains"].values():
                    for opt in exp_data.get("puts", []) + exp_data.get("calls", []):
                        if "iv" in opt and opt["iv"]:
                            ivs.append(opt["iv"])
                if ivs:
                    avg_iv = sum(ivs) / len(ivs)
            
            # Create simplified features
            features = SymbolFeatures(
                symbol=symbol,
                last_price=price,
                trend=TrendDirection.NEUTRAL,
                trend_strength=0.5,
                realized_vol_20d=avg_iv,
                iv_rank=50.0,  # Assume middle of range
                iv_percentile=50.0,
                vol_regime=VolatilityRegime.NORMAL,
                liquidity_score=0.8,
                avg_spread_pct=0.02,
            )
            
            if not features:
                logger.debug(f"Skipping {symbol}: could not compute features")
                continue
            
            # Generate candidates for each allowed template
            for template in self.config.allowed_strategies:
                if self._is_template_eligible(template, features):
                    template_candidates = self._generate_for_template(
                        symbol=symbol,
                        template=template,
                        features=features,
                        chain=option_chains[symbol],
                        price=current_prices[symbol],
                    )
                    candidates.extend(template_candidates)
        
        # Score all candidates
        self._score_candidates(candidates)
        
        logger.info(f"Generated {len(candidates)} total candidates")
        return candidates
    
    def _is_template_eligible(
        self,
        template: StrategyTemplate,
        features: SymbolFeatures,
    ) -> bool:
        """Check if a template is eligible given current market features."""
        from .config import V1_TEMPLATES
        
        # V1 HARD GATE: Only V1 templates allowed
        if template not in V1_TEMPLATES:
            logger.debug(f"Template {template.value} rejected: not in V1_TEMPLATES")
            return False
        
        # V1 single-leg templates: require directional alignment
        if template == StrategyTemplate.LONG_CALL:
            # Long call requires bullish or neutral trend
            if features.trend == TrendDirection.BEARISH:
                return False
        elif template == StrategyTemplate.LONG_PUT:
            # Long put requires bearish or neutral trend
            if features.trend == TrendDirection.BULLISH:
                return False
        
        return True
    
    # LEGACY V2+ method - disabled in V1
    def _is_template_eligible_v2(
        self,
        template: StrategyTemplate,
        features: SymbolFeatures,
    ) -> bool:
        """V2+ eligibility check for spread templates. NOT USED IN V1."""
        # Relax constraints for now to allow candidate generation
        # TODO: Re-enable after initial testing
        
        # Credit strategies prefer elevated IV
        if template in [StrategyTemplate.PUT_CREDIT_SPREAD, 
                        StrategyTemplate.CALL_CREDIT_SPREAD,
                        StrategyTemplate.IRON_CONDOR]:
            # Relaxed: accept any IV above 20
            if features.iv_rank < 20:
                return False
        
        elif template in [StrategyTemplate.CALL_DEBIT_SPREAD,
                          StrategyTemplate.PUT_DEBIT_SPREAD]:
            # For debit spreads, check directional alignment
            if template == StrategyTemplate.CALL_DEBIT_SPREAD:
                if features.trend == TrendDirection.BEARISH:
                    return False
            elif template == StrategyTemplate.PUT_DEBIT_SPREAD:
                if features.trend == TrendDirection.BULLISH:
                    return False
        
        return True
    
    def _generate_for_template(
        self,
        symbol: str,
        template: StrategyTemplate,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
    ) -> List[TradeCandidate]:
        """Generate candidates for a specific symbol and template."""
        from .config import V1_TEMPLATES
        
        # V1 HARD GATE: reject non-V1 templates at generation
        if template not in V1_TEMPLATES:
            logger.debug(f"V1 gate: rejecting {template.value} for {symbol}")
            return []
        
        candidates = []
        
        dte_min, dte_max = self.DTE_CONSTRAINTS.get(template, (14, 45))
        
        # Get available expiries in range
        expiries = self._get_expiries_in_range(chain, dte_min, dte_max)
        
        for expiry, dte in expiries[:3]:  # Limit to 3 expiries per template
            # V1 Single-leg templates (ONLY THESE ARE ALLOWED)
            if template == StrategyTemplate.LONG_CALL:
                candidates.extend(
                    self._gen_long_call(symbol, features, chain, price, expiry, dte)
                )
            elif template == StrategyTemplate.LONG_PUT:
                candidates.extend(
                    self._gen_long_put(symbol, features, chain, price, expiry, dte)
                )
            # V2+ Spread templates
            elif template == StrategyTemplate.PUT_CREDIT_SPREAD:
                candidates.extend(
                    self._gen_put_credit_spread(symbol, features, chain, price, expiry, dte)
                )
            elif template == StrategyTemplate.CALL_CREDIT_SPREAD:
                candidates.extend(
                    self._gen_call_credit_spread(symbol, features, chain, price, expiry, dte)
                )
            elif template == StrategyTemplate.IRON_CONDOR:
                candidates.extend(
                    self._gen_iron_condor(symbol, features, chain, price, expiry, dte)
                )
            elif template == StrategyTemplate.CALL_DEBIT_SPREAD:
                candidates.extend(
                    self._gen_call_debit_spread(symbol, features, chain, price, expiry, dte)
                )
            elif template == StrategyTemplate.PUT_DEBIT_SPREAD:
                candidates.extend(
                    self._gen_put_debit_spread(symbol, features, chain, price, expiry, dte)
                )
        
        return candidates
    
    def _get_expiries_in_range(
        self,
        chain: Dict[str, Any],
        dte_min: int,
        dte_max: int,
    ) -> List[tuple]:
        """Get expiries within DTE range, returns list of (expiry_date, dte)."""
        expiries = []
        today = date.today()
        
        # Handle different chain formats
        if "expirations" in chain:
            for exp_str in chain["expirations"]:
                try:
                    exp_date = date.fromisoformat(exp_str)
                    dte = (exp_date - today).days
                    if dte_min <= dte <= dte_max:
                        expiries.append((exp_date, dte))
                except (ValueError, TypeError):
                    continue
        
        expiries.sort(key=lambda x: x[1])  # Sort by DTE
        return expiries
    
    def _gen_put_credit_spread(
        self,
        symbol: str,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
        expiry: date,
        dte: int,
    ) -> List[TradeCandidate]:
        """Generate put credit spread candidates (bullish/neutral)."""
        candidates = []
        
        # Find strikes for short and long puts
        # Short put: target delta 0.15-0.35 OTM
        # Long put: 1-5 strikes below short
        
        puts = self._get_options_for_expiry(chain, expiry, "put")
        if len(puts) < 2:
            return candidates
        
        # Find short put strikes (OTM, below current price)
        otm_puts = [p for p in puts if p["strike"] < price]
        if len(otm_puts) < 2:
            return candidates
        
        # Select short leg based on delta target
        for short_put in otm_puts:
            delta = abs(short_put.get("delta", 0.20))
            if not (self.CREDIT_DELTA_RANGE[0] <= delta <= self.CREDIT_DELTA_RANGE[1]):
                continue
            
            short_strike = short_put["strike"]
            
            # Find long put strikes
            for width in [1, 2, 5]:
                long_strike = short_strike - width
                long_put = self._find_strike(puts, long_strike)
                
                if not long_put:
                    continue
                
                # Calculate P&L
                credit = short_put.get("bid", 0) - long_put.get("ask", 0)
                if credit <= 0:
                    continue
                
                max_loss = width - credit
                if max_loss <= 0:
                    continue
                
                max_profit = credit * 100  # Per contract
                max_loss_dollars = max_loss * 100
                
                # Check risk constraints
                if max_loss_dollars > self.config.risk_limits.max_risk_per_trade:
                    continue
                
                # Calculate POP (simplified: prob of staying above short strike)
                pop = 1 - delta  # Rough approximation
                
                candidate = self._create_candidate(
                    symbol=symbol,
                    template=StrategyTemplate.PUT_CREDIT_SPREAD,
                    features=features,
                    legs=[
                        OptionLeg(
                            option_type="put",
                            strike=short_strike,
                            expiry=expiry,
                            side="sell",
                            premium=short_put.get("bid", 0),
                            delta=-delta,
                        ),
                        OptionLeg(
                            option_type="put",
                            strike=long_strike,
                            expiry=expiry,
                            side="buy",
                            premium=long_put.get("ask", 0),
                            delta=-abs(long_put.get("delta", 0.10)),
                        ),
                    ],
                    underlying_price=price,
                    max_loss=max_loss_dollars,
                    max_profit=max_profit,
                    pop=pop,
                    dte=dte,
                )
                candidates.append(candidate)
                break  # One per short strike
        
        return candidates[:3]  # Limit per expiry
    
    def _gen_call_credit_spread(
        self,
        symbol: str,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
        expiry: date,
        dte: int,
    ) -> List[TradeCandidate]:
        """Generate call credit spread candidates (bearish/neutral)."""
        candidates = []
        
        calls = self._get_options_for_expiry(chain, expiry, "call")
        if len(calls) < 2:
            return candidates
        
        # Find OTM calls (above current price)
        otm_calls = [c for c in calls if c["strike"] > price]
        if len(otm_calls) < 2:
            return candidates
        
        for short_call in otm_calls:
            delta = abs(short_call.get("delta", 0.20))
            if not (self.CREDIT_DELTA_RANGE[0] <= delta <= self.CREDIT_DELTA_RANGE[1]):
                continue
            
            short_strike = short_call["strike"]
            
            for width in [1, 2, 5]:
                long_strike = short_strike + width
                long_call = self._find_strike(calls, long_strike)
                
                if not long_call:
                    continue
                
                credit = short_call.get("bid", 0) - long_call.get("ask", 0)
                if credit <= 0:
                    continue
                
                max_loss = width - credit
                if max_loss <= 0:
                    continue
                
                max_profit = credit * 100
                max_loss_dollars = max_loss * 100
                
                if max_loss_dollars > self.config.risk_limits.max_risk_per_trade:
                    continue
                
                pop = 1 - delta
                
                candidate = self._create_candidate(
                    symbol=symbol,
                    template=StrategyTemplate.CALL_CREDIT_SPREAD,
                    features=features,
                    legs=[
                        OptionLeg(
                            option_type="call",
                            strike=short_strike,
                            expiry=expiry,
                            side="sell",
                            premium=short_call.get("bid", 0),
                            delta=delta,
                        ),
                        OptionLeg(
                            option_type="call",
                            strike=long_strike,
                            expiry=expiry,
                            side="buy",
                            premium=long_call.get("ask", 0),
                            delta=abs(long_call.get("delta", 0.10)),
                        ),
                    ],
                    underlying_price=price,
                    max_loss=max_loss_dollars,
                    max_profit=max_profit,
                    pop=pop,
                    dte=dte,
                )
                candidates.append(candidate)
                break
        
        return candidates[:3]
    
    def _gen_iron_condor(
        self,
        symbol: str,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
        expiry: date,
        dte: int,
    ) -> List[TradeCandidate]:
        """Generate iron condor candidates (neutral/range-bound)."""
        candidates = []
        
        puts = self._get_options_for_expiry(chain, expiry, "put")
        calls = self._get_options_for_expiry(chain, expiry, "call")
        
        if len(puts) < 2 or len(calls) < 2:
            return candidates
        
        # Find OTM options
        otm_puts = [p for p in puts if p["strike"] < price]
        otm_calls = [c for c in calls if c["strike"] > price]
        
        if len(otm_puts) < 2 or len(otm_calls) < 2:
            return candidates
        
        # Find short put (15-25 delta)
        for short_put in otm_puts:
            put_delta = abs(short_put.get("delta", 0.20))
            if not (0.15 <= put_delta <= 0.25):
                continue
            
            # Find short call with similar delta
            for short_call in otm_calls:
                call_delta = abs(short_call.get("delta", 0.20))
                if not (0.15 <= call_delta <= 0.25):
                    continue
                
                short_put_strike = short_put["strike"]
                short_call_strike = short_call["strike"]
                
                # Use same width on both sides
                for width in [2, 5]:
                    long_put_strike = short_put_strike - width
                    long_call_strike = short_call_strike + width
                    
                    long_put = self._find_strike(puts, long_put_strike)
                    long_call = self._find_strike(calls, long_call_strike)
                    
                    if not long_put or not long_call:
                        continue
                    
                    # Calculate total credit
                    put_credit = short_put.get("bid", 0) - long_put.get("ask", 0)
                    call_credit = short_call.get("bid", 0) - long_call.get("ask", 0)
                    total_credit = put_credit + call_credit
                    
                    if total_credit <= 0:
                        continue
                    
                    max_loss = width - total_credit
                    if max_loss <= 0:
                        continue
                    
                    max_profit = total_credit * 100
                    max_loss_dollars = max_loss * 100
                    
                    if max_loss_dollars > self.config.risk_limits.max_risk_per_trade:
                        continue
                    
                    # POP for IC: prob of staying between short strikes
                    pop = (1 - put_delta) * (1 - call_delta)
                    
                    candidate = self._create_candidate(
                        symbol=symbol,
                        template=StrategyTemplate.IRON_CONDOR,
                        features=features,
                        legs=[
                            OptionLeg("put", short_put_strike, expiry, "sell", 
                                      premium=short_put.get("bid", 0), delta=-put_delta),
                            OptionLeg("put", long_put_strike, expiry, "buy",
                                      premium=long_put.get("ask", 0)),
                            OptionLeg("call", short_call_strike, expiry, "sell",
                                      premium=short_call.get("bid", 0), delta=call_delta),
                            OptionLeg("call", long_call_strike, expiry, "buy",
                                      premium=long_call.get("ask", 0)),
                        ],
                        underlying_price=price,
                        max_loss=max_loss_dollars,
                        max_profit=max_profit,
                        pop=pop,
                        dte=dte,
                    )
                    candidates.append(candidate)
                    break
                break
        
        return candidates[:2]
    
    def _gen_call_debit_spread(
        self,
        symbol: str,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
        expiry: date,
        dte: int,
    ) -> List[TradeCandidate]:
        """Generate call debit spread candidates (bullish directional)."""
        candidates = []
        
        calls = self._get_options_for_expiry(chain, expiry, "call")
        if len(calls) < 2:
            return candidates
        
        # Buy ATM/slightly OTM, sell further OTM
        for long_call in calls:
            long_strike = long_call["strike"]
            # Target slightly OTM (within 3% of price)
            if not (price * 0.97 <= long_strike <= price * 1.03):
                continue
            
            long_delta = abs(long_call.get("delta", 0.50))
            if long_delta < 0.40:  # Need reasonable delta
                continue
            
            for width in [2, 5, 10]:
                short_strike = long_strike + width
                short_call = self._find_strike(calls, short_strike)
                
                if not short_call:
                    continue
                
                debit = long_call.get("ask", 0) - short_call.get("bid", 0)
                if debit <= 0:
                    continue
                
                max_profit = (width - debit) * 100
                max_loss_dollars = debit * 100
                
                if max_loss_dollars > self.config.risk_limits.max_risk_per_trade:
                    continue
                
                if max_profit <= 0:
                    continue
                
                # POP for debit spread (rough: based on long delta)
                pop = long_delta * 0.6  # Discounted
                
                candidate = self._create_candidate(
                    symbol=symbol,
                    template=StrategyTemplate.CALL_DEBIT_SPREAD,
                    features=features,
                    legs=[
                        OptionLeg("call", long_strike, expiry, "buy",
                                  premium=long_call.get("ask", 0), delta=long_delta),
                        OptionLeg("call", short_strike, expiry, "sell",
                                  premium=short_call.get("bid", 0)),
                    ],
                    underlying_price=price,
                    max_loss=max_loss_dollars,
                    max_profit=max_profit,
                    pop=pop,
                    dte=dte,
                )
                candidates.append(candidate)
                break
        
        return candidates[:3]
    
    def _gen_put_debit_spread(
        self,
        symbol: str,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
        expiry: date,
        dte: int,
    ) -> List[TradeCandidate]:
        """Generate put debit spread candidates (bearish directional)."""
        candidates = []
        
        puts = self._get_options_for_expiry(chain, expiry, "put")
        if len(puts) < 2:
            return candidates
        
        # Buy ATM/slightly OTM put, sell further OTM
        for long_put in puts:
            long_strike = long_put["strike"]
            # Target slightly OTM (within 3% of price)
            if not (price * 0.97 <= long_strike <= price * 1.03):
                continue
            
            long_delta = abs(long_put.get("delta", 0.50))
            if long_delta < 0.40:
                continue
            
            for width in [2, 5, 10]:
                short_strike = long_strike - width
                short_put = self._find_strike(puts, short_strike)
                
                if not short_put:
                    continue
                
                debit = long_put.get("ask", 0) - short_put.get("bid", 0)
                if debit <= 0:
                    continue
                
                max_profit = (width - debit) * 100
                max_loss_dollars = debit * 100
                
                if max_loss_dollars > self.config.risk_limits.max_risk_per_trade:
                    continue
                
                if max_profit <= 0:
                    continue
                
                pop = long_delta * 0.6
                
                candidate = self._create_candidate(
                    symbol=symbol,
                    template=StrategyTemplate.PUT_DEBIT_SPREAD,
                    features=features,
                    legs=[
                        OptionLeg("put", long_strike, expiry, "buy",
                                  premium=long_put.get("ask", 0), delta=-long_delta),
                        OptionLeg("put", short_strike, expiry, "sell",
                                  premium=short_put.get("bid", 0)),
                    ],
                    underlying_price=price,
                    max_loss=max_loss_dollars,
                    max_profit=max_profit,
                    pop=pop,
                    dte=dte,
                )
                candidates.append(candidate)
                break
        
        return candidates[:3]
    
    def _gen_long_call(
        self,
        symbol: str,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
        expiry: date,
        dte: int,
    ) -> List[TradeCandidate]:
        """Generate long call candidates (bullish, v1 single-leg).
        
        Selection criteria:
        - Delta between target range (0.35-0.65)
        - Bid > minimum (liquidity check)
        - Spread % below threshold
        """
        calls = self._get_options_for_expiry(chain, expiry, "call")
        if not calls:
            return []
        
        candidates = []
        delta_min, delta_max = self.SINGLE_LEG_DELTA_RANGE
        
        for call in calls:
            delta = abs(call.get("delta", 0))
            bid = call.get("bid", 0)
            ask = call.get("ask", 0)
            strike = call.get("strike", 0)
            
            # Delta filter
            if not (delta_min <= delta <= delta_max):
                continue
            
            # Liquidity filter
            if bid < 0.05:  # Minimum bid
                continue
            
            mid = (bid + ask) / 2 if ask > 0 else bid
            if mid > 0:
                spread_pct = (ask - bid) / mid
                if spread_pct > 0.20:  # Max 20% spread
                    continue
            
            # Premium = cost to enter (max loss for long option)
            premium = ask
            max_loss = premium * 100  # Per contract
            max_profit = float('inf')  # Uncapped for long call
            pop = 0.40  # Approximate for ATM-ish (conservative)
            
            candidate = self._create_candidate(
                symbol=symbol,
                template=StrategyTemplate.LONG_CALL,
                features=features,
                legs=[
                    OptionLeg("call", strike, expiry, "buy",
                              quantity=1, premium=ask, delta=delta)
                ],
                underlying_price=price,
                max_loss=max_loss,
                max_profit=max_profit,
                pop=pop,
                dte=dte,
            )
            candidates.append(candidate)
        
        # Return top candidates by delta (closer to 0.50 = better)
        candidates.sort(key=lambda c: abs(c.legs[0].delta - 0.50))
        return candidates[:3]
    
    def _gen_long_put(
        self,
        symbol: str,
        features: SymbolFeatures,
        chain: Dict[str, Any],
        price: float,
        expiry: date,
        dte: int,
    ) -> List[TradeCandidate]:
        """Generate long put candidates (bearish, v1 single-leg).
        
        Selection criteria:
        - Delta between target range (-0.65 to -0.35, abs 0.35-0.65)
        - Bid > minimum (liquidity check)
        - Spread % below threshold
        """
        puts = self._get_options_for_expiry(chain, expiry, "put")
        if not puts:
            return []
        
        candidates = []
        delta_min, delta_max = self.SINGLE_LEG_DELTA_RANGE
        
        for put in puts:
            delta = abs(put.get("delta", 0))  # Put delta is negative, use abs
            bid = put.get("bid", 0)
            ask = put.get("ask", 0)
            strike = put.get("strike", 0)
            
            # Delta filter
            if not (delta_min <= delta <= delta_max):
                continue
            
            # Liquidity filter
            if bid < 0.05:
                continue
            
            mid = (bid + ask) / 2 if ask > 0 else bid
            if mid > 0:
                spread_pct = (ask - bid) / mid
                if spread_pct > 0.20:
                    continue
            
            premium = ask
            max_loss = premium * 100  # Per contract
            max_profit = (strike - premium) * 100  # Max if stock goes to 0
            pop = 0.40  # Conservative
            
            candidate = self._create_candidate(
                symbol=symbol,
                template=StrategyTemplate.LONG_PUT,
                features=features,
                legs=[
                    OptionLeg("put", strike, expiry, "buy",
                              quantity=1, premium=ask, delta=-delta)
                ],
                underlying_price=price,
                max_loss=max_loss,
                max_profit=max_profit,
                pop=pop,
                dte=dte,
            )
            candidates.append(candidate)
        
        # Return top candidates by delta (closer to 0.50 = better)
        candidates.sort(key=lambda c: abs(abs(c.legs[0].delta) - 0.50))
        return candidates[:3]
    
    def _get_options_for_expiry(
        self,
        chain: Dict[str, Any],
        expiry: date,
        option_type: str,
    ) -> List[Dict[str, Any]]:
        """Get options for a specific expiry and type."""
        options = []
        expiry_str = expiry.isoformat()
        
        # Handle different chain formats
        if "chains" in chain:
            expiry_chain = chain["chains"].get(expiry_str, {})
            options = expiry_chain.get(f"{option_type}s", [])
        elif "options" in chain:
            for opt in chain["options"]:
                if (opt.get("expiry") == expiry_str and 
                    opt.get("type") == option_type):
                    options.append(opt)
        
        return sorted(options, key=lambda x: x.get("strike", 0))
    
    def _find_strike(
        self,
        options: List[Dict[str, Any]],
        target_strike: float,
    ) -> Optional[Dict[str, Any]]:
        """Find option with exact strike."""
        for opt in options:
            if abs(opt.get("strike", 0) - target_strike) < 0.01:
                return opt
        return None
    
    def _create_candidate(
        self,
        symbol: str,
        template: StrategyTemplate,
        features: SymbolFeatures,
        legs: List[OptionLeg],
        underlying_price: float,
        max_loss: float,
        max_profit: float,
        pop: float,
        dte: int,
    ) -> TradeCandidate:
        """Create a candidate with all metadata."""
        self._candidate_counter += 1
        
        return TradeCandidate(
            id=f"C{self._candidate_counter:06d}",
            symbol=symbol,
            template=template,
            legs=legs,
            underlying_price=underlying_price,
            max_loss=max_loss,
            max_profit=max_profit,
            pop=pop,
            dte=dte,
            iv_rank=features.iv_rank,
            liquidity_score=features.liquidity_score,
            spread_percent=features.avg_spread_pct,
            regime=features.vol_regime.value,
            trend=features.trend.value,
        )
    
    def _score_candidates(self, candidates: List[TradeCandidate]) -> None:
        """Score all candidates for ranking."""
        for candidate in candidates:
            # Base score components
            risk_reward = candidate.max_profit / max(candidate.max_loss, 1)
            pop_score = candidate.pop * 100
            iv_score = candidate.iv_rank if candidate.template in [
                StrategyTemplate.PUT_CREDIT_SPREAD,
                StrategyTemplate.CALL_CREDIT_SPREAD,
                StrategyTemplate.IRON_CONDOR,
            ] else 100 - candidate.iv_rank
            liquidity_score = candidate.liquidity_score
            
            # Weighted base score
            candidate.base_score = (
                risk_reward * 20 +
                pop_score * 0.3 +
                iv_score * 0.2 +
                liquidity_score * 0.3
            )
            
            # Adjusted score starts as base score
            candidate.adjusted_score = candidate.base_score
