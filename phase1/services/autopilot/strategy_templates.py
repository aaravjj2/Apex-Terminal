"""
Strategy Templates (Milestone 2)

Defines the 3 bounded strategy templates:
- Template A: Debit Spread (Directional) - for trend days
- Template B: Credit Spread (Premium Capture) - for range days
- Template C: Token Trade (Fallback) - for chaos/must-trade

Each template defines:
- Entry conditions
- Strike selection rules
- Exit rules (stop, profit, time)
"""

import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta

from .regime_classifier import MarketRegime

logger = logging.getLogger(__name__)

class TemplateType(str, Enum):
    """Strategy template types."""
    DEBIT_SPREAD = "debit_spread"    # Template A
    CREDIT_SPREAD = "credit_spread"  # Template B
    TOKEN_TRADE = "token_trade"      # Template C

@dataclass
class TemplateConfig:
    """Configuration for a strategy template."""
    template_type: TemplateType
    
    # Entry criteria
    allowed_regimes: List[MarketRegime]
    min_liquidity_score: float = 0.5
    max_spread_pct: float = 0.10  # Max bid-ask spread as % of mid
    require_no_shock: bool = True
    
    # Strike selection
    long_delta_target: float = 0.40  # For debit
    short_delta_target: float = 0.20  # For credit
    min_width: float = 1.0  # Min spread width in dollars
    max_width: float = 5.0  # Max spread width
    
    # Risk/sizing
    max_loss_dollars: float = 50.0
    position_size: int = 1  # Number of contracts
    
    # Exit rules
    soft_stop_pct: float = 0.20
    hard_stop_pct: float = 0.40
    profit_target_pct: float = 0.30
    time_stop_minutes: float = 45.0
    eod_exit_minutes: float = 10.0  # Exit N min before close
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "template_type": self.template_type.value,
            "allowed_regimes": [r.value for r in self.allowed_regimes],
            "max_loss_dollars": self.max_loss_dollars,
            "soft_stop_pct": self.soft_stop_pct,
            "profit_target_pct": self.profit_target_pct,
        }

# Pre-defined template configurations
TEMPLATE_A_DEBIT = TemplateConfig(
    template_type=TemplateType.DEBIT_SPREAD,
    allowed_regimes=[MarketRegime.TREND_UP, MarketRegime.TREND_DOWN],
    min_liquidity_score=0.6,
    max_spread_pct=0.08,
    long_delta_target=0.45,
    short_delta_target=0.25,
    max_loss_dollars=50.0,
    soft_stop_pct=0.20,
    hard_stop_pct=0.40,
    profit_target_pct=0.35,
    time_stop_minutes=45.0,
)

TEMPLATE_B_CREDIT = TemplateConfig(
    template_type=TemplateType.CREDIT_SPREAD,
    allowed_regimes=[MarketRegime.RANGE],
    min_liquidity_score=0.7,
    max_spread_pct=0.06,
    short_delta_target=0.15,
    max_loss_dollars=75.0,
    soft_stop_pct=0.60,  # % of max loss
    hard_stop_pct=0.70,
    profit_target_pct=0.40,  # % of credit
    time_stop_minutes=30.0,
    eod_exit_minutes=30.0,
)

TEMPLATE_C_TOKEN = TemplateConfig(
    template_type=TemplateType.TOKEN_TRADE,
    allowed_regimes=[MarketRegime.CHAOS, MarketRegime.RANGE, MarketRegime.TREND_UP, 
                     MarketRegime.TREND_DOWN, MarketRegime.UNKNOWN],
    min_liquidity_score=0.3,
    max_spread_pct=0.15,
    max_loss_dollars=10.0,
    position_size=1,
    soft_stop_pct=0.15,
    hard_stop_pct=0.25,
    profit_target_pct=0.20,
    time_stop_minutes=20.0,
)

@dataclass
class CandidateSpec:
    """Specification for a trade candidate."""
    symbol: str
    template: TemplateType
    direction: str  # "bullish" or "bearish"
    
    # Legs
    long_strike: float
    short_strike: float
    expiry: str  # YYYY-MM-DD
    option_type: str  # "call" or "put"
    
    # Pricing
    estimated_cost: float  # Debit paid or credit received
    max_loss: float
    max_profit: float
    
    # Greeks
    net_delta: float = 0.0
    
    # Scoring
    liquidity_score: float = 0.0
    regime_fit_score: float = 0.0
    volatility_score: float = 0.0
    total_score: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "template": self.template.value,
            "direction": self.direction,
            "long_strike": self.long_strike,
            "short_strike": self.short_strike,
            "expiry": self.expiry,
            "option_type": self.option_type,
            "estimated_cost": self.estimated_cost,
            "max_loss": self.max_loss,
            "max_profit": self.max_profit,
            "net_delta": self.net_delta,
            "total_score": self.total_score,
        }

class TemplateSelector:
    """
    Selects and configures the appropriate template based on regime.
    """
    
    def __init__(self):
        self.templates = {
            TemplateType.DEBIT_SPREAD: TEMPLATE_A_DEBIT,
            TemplateType.CREDIT_SPREAD: TEMPLATE_B_CREDIT,
            TemplateType.TOKEN_TRADE: TEMPLATE_C_TOKEN,
        }
    
    def select_template(
        self,
        regime: MarketRegime,
        shock_flag: bool = False,
        force_token: bool = False,
    ) -> TemplateConfig:
        """
        Select appropriate template for current conditions.
        
        Args:
            regime: Current market regime
            shock_flag: Whether news shock is active
            force_token: Force token trade (gates failed, etc.)
            
        Returns:
            Selected TemplateConfig
        """
        # Force token if required
        if force_token:
            logger.info("Forcing token trade due to gate failure")
            return self.templates[TemplateType.TOKEN_TRADE]
        
        # Chaos = token only
        if regime == MarketRegime.CHAOS:
            logger.info("Chaos regime: using token trade")
            return self.templates[TemplateType.TOKEN_TRADE]
        
        # Shock = no credit spreads
        if shock_flag:
            if regime in [MarketRegime.TREND_UP, MarketRegime.TREND_DOWN]:
                logger.info("Shock + trend: using debit spread")
                return self.templates[TemplateType.DEBIT_SPREAD]
            else:
                logger.info("Shock + non-trend: using token trade")
                return self.templates[TemplateType.TOKEN_TRADE]
        
        # Normal selection
        if regime in [MarketRegime.TREND_UP, MarketRegime.TREND_DOWN]:
            return self.templates[TemplateType.DEBIT_SPREAD]
        elif regime == MarketRegime.RANGE:
            return self.templates[TemplateType.CREDIT_SPREAD]
        else:
            return self.templates[TemplateType.TOKEN_TRADE]
    
    def get_template(self, template_type: TemplateType) -> TemplateConfig:
        """Get specific template config."""
        return self.templates.get(template_type, self.templates[TemplateType.TOKEN_TRADE])

class CandidateGenerator:
    """
    Generates trade candidates for a given symbol and template.
    """
    
    def __init__(self, template_selector: TemplateSelector):
        self.selector = template_selector
    
    def generate(
        self,
        symbol: str,
        template: TemplateConfig,
        current_price: float,
        expiry: str,
        regime: MarketRegime,
        chain_data: Optional[Dict[str, Any]] = None,
    ) -> List[CandidateSpec]:
        """
        Generate candidates for a symbol.
        
        In production, this would query the options chain.
        For now, generates synthetic candidates based on template rules.
        """
        candidates = []
        
        # Determine direction from regime
        if regime == MarketRegime.TREND_UP:
            direction = "bullish"
            option_type = "call" if template.template_type == TemplateType.DEBIT_SPREAD else "put"
        elif regime == MarketRegime.TREND_DOWN:
            direction = "bearish"
            option_type = "put" if template.template_type == TemplateType.DEBIT_SPREAD else "call"
        else:
            # Range/chaos - prefer neutral or bullish bias
            direction = "bullish"
            option_type = "put"  # Credit put spread (bullish)
        
        # Generate strike combinations
        # Simple heuristic: use ATM +/- width
        width = 2.0  # $2 wide spread
        
        if template.template_type == TemplateType.DEBIT_SPREAD:
            # Long closer to ATM, short further OTM
            if direction == "bullish":
                long_strike = round(current_price, 0)
                short_strike = long_strike + width
            else:
                long_strike = round(current_price, 0)
                short_strike = long_strike - width
            
            estimated_cost = width * 0.40  # Assume 40% of width
            max_loss = estimated_cost * 100  # Per contract
            max_profit = (width - estimated_cost) * 100
            
        else:  # Credit spread or token
            if direction == "bullish":
                short_strike = round(current_price - 3, 0)  # OTM put
                long_strike = short_strike - width
            else:
                short_strike = round(current_price + 3, 0)  # OTM call
                long_strike = short_strike + width
            
            estimated_cost = -width * 0.25  # Receive credit
            max_profit = abs(estimated_cost) * 100
            max_loss = (width - abs(estimated_cost)) * 100
        
        # Score the candidate
        regime_fit = 1.0 if regime in template.allowed_regimes else 0.3
        liquidity_score = 0.7  # Would come from chain data
        volatility_score = 0.6  # Based on IV rank
        
        total_score = (regime_fit * 0.4 + liquidity_score * 0.35 + volatility_score * 0.25) * 100
        
        candidate = CandidateSpec(
            symbol=symbol,
            template=template.template_type,
            direction=direction,
            long_strike=long_strike,
            short_strike=short_strike,
            expiry=expiry,
            option_type=option_type,
            estimated_cost=estimated_cost,
            max_loss=max_loss,
            max_profit=max_profit,
            net_delta=0.15 if direction == "bullish" else -0.15,
            liquidity_score=liquidity_score,
            regime_fit_score=regime_fit,
            volatility_score=volatility_score,
            total_score=total_score,
        )
        
        candidates.append(candidate)
        
        return candidates
