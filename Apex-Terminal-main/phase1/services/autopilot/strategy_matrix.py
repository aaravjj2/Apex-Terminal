"""
Strategy Selection Matrix

Maps market conditions to optimal options strategies using a sophisticated
decision matrix based on:
1. Volatility regime (IV rank, VRP)
2. Trend direction & strength
3. Mean reversion signals
4. Market phase
5. Risk parameters

This module implements institutional-grade strategy selection logic.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from enum import Enum
import logging

from .trading_intelligence import (
    TradingIntelligenceEngine,
    TradeScore,
    TradingSignal,
    VolatilityState,
    MomentumState,
    ReversalSignal,
    MarketPhase,
)

logger = logging.getLogger(__name__)


# =============================================================================
# STRATEGY DEFINITIONS
# =============================================================================

class StrategyType(str, Enum):
    """Available options strategies."""
    # Bullish Premium Collection
    PUT_CREDIT_SPREAD = "put_credit_spread"
    CASH_SECURED_PUT = "cash_secured_put"
    SHORT_PUT = "short_put"
    
    # Bearish Premium Collection
    CALL_CREDIT_SPREAD = "call_credit_spread"
    COVERED_CALL = "covered_call"
    SHORT_CALL = "short_call"
    
    # Neutral Premium Collection
    IRON_CONDOR = "iron_condor"
    IRON_BUTTERFLY = "iron_butterfly"
    STRANGLE = "short_strangle"
    STRADDLE_SHORT = "short_straddle"
    
    # Bullish Directional
    LONG_CALL = "long_call"
    CALL_DEBIT_SPREAD = "call_debit_spread"
    BULL_PUT_SPREAD = "bull_put_spread"
    CALL_RATIO_SPREAD = "call_ratio_spread"
    
    # Bearish Directional
    LONG_PUT = "long_put"
    PUT_DEBIT_SPREAD = "put_debit_spread"
    BEAR_CALL_SPREAD = "bear_call_spread"
    PUT_RATIO_SPREAD = "put_ratio_spread"
    
    # Volatility Plays
    LONG_STRADDLE = "long_straddle"
    LONG_STRANGLE = "long_strangle"
    CALENDAR_SPREAD = "calendar_spread"
    DIAGONAL_SPREAD = "diagonal_spread"
    
    # No Trade
    NO_TRADE = "no_trade"


@dataclass
class StrategyProfile:
    """Profile defining a strategy's characteristics."""
    strategy: StrategyType
    display_name: str
    
    # Greeks Exposure
    delta_bias: str  # "bullish", "bearish", "neutral"
    theta_positive: bool  # True = benefits from time decay
    vega_positive: bool   # True = benefits from IV increase
    gamma_exposure: str   # "low", "medium", "high"
    
    # Risk Profile
    max_loss_defined: bool
    max_profit_defined: bool
    typical_risk_reward: float  # Typical R:R ratio
    
    # Optimal Conditions
    best_iv_rank: Tuple[float, float]  # (min, max) IV rank
    best_dte_range: Tuple[int, int]    # (min, max) DTE
    best_momentum: List[MomentumState]
    best_market_phase: List[MarketPhase]
    
    # Delta Targets
    typical_delta_range: Tuple[float, float]
    
    # Capital Requirements
    capital_intensity: str  # "low", "medium", "high"
    margin_efficient: bool
    
    # Scoring Parameters
    base_priority: int = 50  # Base strategy priority (0-100)


# =============================================================================
# STRATEGY PROFILES DATABASE
# =============================================================================

STRATEGY_PROFILES: Dict[StrategyType, StrategyProfile] = {
    # =========================================================================
    # BULLISH PREMIUM COLLECTION
    # =========================================================================
    StrategyType.PUT_CREDIT_SPREAD: StrategyProfile(
        strategy=StrategyType.PUT_CREDIT_SPREAD,
        display_name="Put Credit Spread",
        delta_bias="bullish",
        theta_positive=True,
        vega_positive=False,
        gamma_exposure="low",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=0.5,  # Risking 2 to make 1
        best_iv_rank=(40, 100),
        best_dte_range=(21, 45),
        best_momentum=[MomentumState.STRONG_BULLISH, MomentumState.WEAK_BULLISH, MomentumState.NEUTRAL],
        best_market_phase=[MarketPhase.MARKUP, MarketPhase.ACCUMULATION],
        typical_delta_range=(0.15, 0.35),
        capital_intensity="medium",
        margin_efficient=True,
        base_priority=75,
    ),
    
    StrategyType.CASH_SECURED_PUT: StrategyProfile(
        strategy=StrategyType.CASH_SECURED_PUT,
        display_name="Cash Secured Put",
        delta_bias="bullish",
        theta_positive=True,
        vega_positive=False,
        gamma_exposure="medium",
        max_loss_defined=True,  # Loss is strike - premium
        max_profit_defined=True,
        typical_risk_reward=0.1,  # High risk but want to own
        best_iv_rank=(50, 100),
        best_dte_range=(30, 60),
        best_momentum=[MomentumState.STRONG_BULLISH, MomentumState.WEAK_BULLISH],
        best_market_phase=[MarketPhase.MARKUP, MarketPhase.ACCUMULATION],
        typical_delta_range=(0.20, 0.40),
        capital_intensity="high",
        margin_efficient=False,
        base_priority=60,
    ),
    
    # =========================================================================
    # BEARISH PREMIUM COLLECTION
    # =========================================================================
    StrategyType.CALL_CREDIT_SPREAD: StrategyProfile(
        strategy=StrategyType.CALL_CREDIT_SPREAD,
        display_name="Call Credit Spread",
        delta_bias="bearish",
        theta_positive=True,
        vega_positive=False,
        gamma_exposure="low",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=0.5,
        best_iv_rank=(40, 100),
        best_dte_range=(21, 45),
        best_momentum=[MomentumState.STRONG_BEARISH, MomentumState.WEAK_BEARISH, MomentumState.NEUTRAL],
        best_market_phase=[MarketPhase.MARKDOWN, MarketPhase.DISTRIBUTION],
        typical_delta_range=(0.15, 0.35),
        capital_intensity="medium",
        margin_efficient=True,
        base_priority=75,
    ),
    
    # =========================================================================
    # NEUTRAL PREMIUM COLLECTION
    # =========================================================================
    StrategyType.IRON_CONDOR: StrategyProfile(
        strategy=StrategyType.IRON_CONDOR,
        display_name="Iron Condor",
        delta_bias="neutral",
        theta_positive=True,
        vega_positive=False,
        gamma_exposure="low",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=0.33,  # Risk 3 to make 1
        best_iv_rank=(50, 100),
        best_dte_range=(30, 60),
        best_momentum=[MomentumState.NEUTRAL, MomentumState.WEAK_BULLISH, MomentumState.WEAK_BEARISH],
        best_market_phase=[MarketPhase.ACCUMULATION, MarketPhase.DISTRIBUTION],
        typical_delta_range=(0.10, 0.25),
        capital_intensity="medium",
        margin_efficient=True,
        base_priority=70,
    ),
    
    StrategyType.IRON_BUTTERFLY: StrategyProfile(
        strategy=StrategyType.IRON_BUTTERFLY,
        display_name="Iron Butterfly",
        delta_bias="neutral",
        theta_positive=True,
        vega_positive=False,
        gamma_exposure="medium",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=0.5,
        best_iv_rank=(60, 100),
        best_dte_range=(21, 45),
        best_momentum=[MomentumState.NEUTRAL],
        best_market_phase=[MarketPhase.ACCUMULATION],
        typical_delta_range=(0.45, 0.55),  # ATM
        capital_intensity="medium",
        margin_efficient=True,
        base_priority=60,
    ),
    
    # =========================================================================
    # BULLISH DIRECTIONAL
    # =========================================================================
    StrategyType.LONG_CALL: StrategyProfile(
        strategy=StrategyType.LONG_CALL,
        display_name="Long Call",
        delta_bias="bullish",
        theta_positive=False,
        vega_positive=True,
        gamma_exposure="high",
        max_loss_defined=True,
        max_profit_defined=False,
        typical_risk_reward=3.0,  # Aim for 3:1
        best_iv_rank=(0, 40),
        best_dte_range=(14, 30),
        best_momentum=[MomentumState.STRONG_BULLISH],
        best_market_phase=[MarketPhase.MARKUP],
        typical_delta_range=(0.40, 0.70),
        capital_intensity="low",
        margin_efficient=True,
        base_priority=50,
    ),
    
    StrategyType.CALL_DEBIT_SPREAD: StrategyProfile(
        strategy=StrategyType.CALL_DEBIT_SPREAD,
        display_name="Call Debit Spread",
        delta_bias="bullish",
        theta_positive=False,
        vega_positive=False,  # Reduced vega vs long call
        gamma_exposure="medium",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=1.5,
        best_iv_rank=(0, 60),
        best_dte_range=(14, 45),
        best_momentum=[MomentumState.STRONG_BULLISH, MomentumState.WEAK_BULLISH],
        best_market_phase=[MarketPhase.MARKUP, MarketPhase.ACCUMULATION],
        typical_delta_range=(0.40, 0.60),
        capital_intensity="low",
        margin_efficient=True,
        base_priority=65,
    ),
    
    # =========================================================================
    # BEARISH DIRECTIONAL
    # =========================================================================
    StrategyType.LONG_PUT: StrategyProfile(
        strategy=StrategyType.LONG_PUT,
        display_name="Long Put",
        delta_bias="bearish",
        theta_positive=False,
        vega_positive=True,
        gamma_exposure="high",
        max_loss_defined=True,
        max_profit_defined=False,
        typical_risk_reward=3.0,
        best_iv_rank=(0, 40),
        best_dte_range=(14, 30),
        best_momentum=[MomentumState.STRONG_BEARISH],
        best_market_phase=[MarketPhase.MARKDOWN],
        typical_delta_range=(0.40, 0.70),
        capital_intensity="low",
        margin_efficient=True,
        base_priority=50,
    ),
    
    StrategyType.PUT_DEBIT_SPREAD: StrategyProfile(
        strategy=StrategyType.PUT_DEBIT_SPREAD,
        display_name="Put Debit Spread",
        delta_bias="bearish",
        theta_positive=False,
        vega_positive=False,
        gamma_exposure="medium",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=1.5,
        best_iv_rank=(0, 60),
        best_dte_range=(14, 45),
        best_momentum=[MomentumState.STRONG_BEARISH, MomentumState.WEAK_BEARISH],
        best_market_phase=[MarketPhase.MARKDOWN, MarketPhase.DISTRIBUTION],
        typical_delta_range=(0.40, 0.60),
        capital_intensity="low",
        margin_efficient=True,
        base_priority=65,
    ),
    
    # =========================================================================
    # VOLATILITY PLAYS
    # =========================================================================
    StrategyType.LONG_STRADDLE: StrategyProfile(
        strategy=StrategyType.LONG_STRADDLE,
        display_name="Long Straddle",
        delta_bias="neutral",
        theta_positive=False,
        vega_positive=True,
        gamma_exposure="high",
        max_loss_defined=True,
        max_profit_defined=False,
        typical_risk_reward=2.0,
        best_iv_rank=(0, 30),
        best_dte_range=(21, 45),
        best_momentum=[MomentumState.NEUTRAL],
        best_market_phase=[MarketPhase.ACCUMULATION],  # Before breakout
        typical_delta_range=(0.45, 0.55),
        capital_intensity="medium",
        margin_efficient=True,
        base_priority=40,
    ),
    
    StrategyType.CALENDAR_SPREAD: StrategyProfile(
        strategy=StrategyType.CALENDAR_SPREAD,
        display_name="Calendar Spread",
        delta_bias="neutral",
        theta_positive=True,  # Complex - benefits from front decay
        vega_positive=True,
        gamma_exposure="low",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=1.0,
        best_iv_rank=(20, 60),
        best_dte_range=(30, 60),  # Back month
        best_momentum=[MomentumState.NEUTRAL],
        best_market_phase=[MarketPhase.ACCUMULATION],
        typical_delta_range=(0.45, 0.55),
        capital_intensity="low",
        margin_efficient=True,
        base_priority=45,
    ),
    
    # =========================================================================
    # NO TRADE
    # =========================================================================
    StrategyType.NO_TRADE: StrategyProfile(
        strategy=StrategyType.NO_TRADE,
        display_name="No Trade",
        delta_bias="neutral",
        theta_positive=False,
        vega_positive=False,
        gamma_exposure="low",
        max_loss_defined=True,
        max_profit_defined=True,
        typical_risk_reward=0.0,
        best_iv_rank=(0, 100),
        best_dte_range=(0, 365),
        best_momentum=list(MomentumState),
        best_market_phase=list(MarketPhase),
        typical_delta_range=(0, 0),
        capital_intensity="low",
        margin_efficient=True,
        base_priority=0,
    ),
}


# =============================================================================
# STRATEGY SELECTION ENGINE
# =============================================================================

@dataclass
class StrategyRecommendation:
    """Strategy recommendation with scoring."""
    strategy: StrategyType
    profile: StrategyProfile
    score: float  # 0-100
    confidence: float  # 0-1
    reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # Parameters
    optimal_dte: int = 30
    target_delta: float = 0.25
    spread_width: Optional[int] = None  # For spreads, in dollars
    position_size_multiplier: float = 1.0


class StrategySelectionEngine:
    """
    Intelligent strategy selection based on market conditions.
    
    Uses a scoring model that evaluates each strategy against:
    1. Current IV environment
    2. Trend/momentum state
    3. Market phase
    4. Risk parameters
    5. Account constraints
    """
    
    # Minimum scores for trading
    MIN_STRATEGY_SCORE = 50
    MIN_CONFIDENCE = 0.40
    
    def __init__(self):
        self.profiles = STRATEGY_PROFILES
        self._cache: Dict[str, Any] = {}
    
    def select_strategies(
        self,
        trade_score: TradeScore,
        iv_rank: float,
        momentum: MomentumState,
        market_phase: MarketPhase,
        vol_state: VolatilityState,
        reversal: ReversalSignal,
        max_risk_per_trade: float = 500,
        prefer_defined_risk: bool = True,
        exclude_strategies: Optional[List[StrategyType]] = None,
    ) -> List[StrategyRecommendation]:
        """
        Select and rank optimal strategies for current conditions.
        
        Args:
            trade_score: Comprehensive trade score from intelligence engine
            iv_rank: Current IV rank (0-100)
            momentum: Current momentum state
            market_phase: Detected market phase
            vol_state: IV vs RV relationship
            reversal: Mean reversion signal
            max_risk_per_trade: Maximum risk per trade in dollars
            prefer_defined_risk: Whether to prefer strategies with defined risk
            exclude_strategies: Strategies to exclude
            
        Returns:
            List of strategy recommendations sorted by score
        """
        exclude = exclude_strategies or []
        recommendations: List[StrategyRecommendation] = []
        
        for strategy_type, profile in self.profiles.items():
            if strategy_type in exclude:
                continue
            
            if strategy_type == StrategyType.NO_TRADE:
                continue
            
            rec = self._score_strategy(
                strategy_type=strategy_type,
                profile=profile,
                trade_score=trade_score,
                iv_rank=iv_rank,
                momentum=momentum,
                market_phase=market_phase,
                vol_state=vol_state,
                reversal=reversal,
                max_risk_per_trade=max_risk_per_trade,
                prefer_defined_risk=prefer_defined_risk,
            )
            
            if rec.score >= self.MIN_STRATEGY_SCORE:
                recommendations.append(rec)
        
        # Sort by score descending
        recommendations.sort(key=lambda r: r.score, reverse=True)
        
        # If no good strategies, recommend NO_TRADE
        if not recommendations:
            no_trade = StrategyRecommendation(
                strategy=StrategyType.NO_TRADE,
                profile=self.profiles[StrategyType.NO_TRADE],
                score=0,
                confidence=1.0,
                reasons=["No suitable strategy for current conditions"],
                warnings=["Consider waiting for better setup"],
            )
            recommendations.append(no_trade)
        
        return recommendations
    
    def _score_strategy(
        self,
        strategy_type: StrategyType,
        profile: StrategyProfile,
        trade_score: TradeScore,
        iv_rank: float,
        momentum: MomentumState,
        market_phase: MarketPhase,
        vol_state: VolatilityState,
        reversal: ReversalSignal,
        max_risk_per_trade: float,
        prefer_defined_risk: bool,
    ) -> StrategyRecommendation:
        """Score a single strategy against current conditions."""
        
        rec = StrategyRecommendation(
            strategy=strategy_type,
            profile=profile,
            score=profile.base_priority,
            confidence=0.5,
        )
        
        score_adjustments = []
        
        # =====================================================================
        # 1. IV RANK ALIGNMENT
        # =====================================================================
        iv_min, iv_max = profile.best_iv_rank
        if iv_min <= iv_rank <= iv_max:
            adjustment = 15
            rec.reasons.append(f"IV rank ({iv_rank:.0f}%) in optimal range ({iv_min:.0f}-{iv_max:.0f}%)")
        elif iv_rank < iv_min:
            # IV too low for this strategy
            distance = iv_min - iv_rank
            adjustment = -distance * 0.5
            rec.warnings.append(f"IV rank ({iv_rank:.0f}%) below optimal ({iv_min:.0f}%)")
        else:
            # IV too high for this strategy
            distance = iv_rank - iv_max
            adjustment = -distance * 0.3
            rec.warnings.append(f"IV rank ({iv_rank:.0f}%) above optimal ({iv_max:.0f}%)")
        score_adjustments.append(adjustment)
        
        # =====================================================================
        # 2. VOLATILITY STATE ALIGNMENT
        # =====================================================================
        if vol_state == VolatilityState.IV_RICH:
            if profile.theta_positive and not profile.vega_positive:
                adjustment = 20
                rec.reasons.append("IV rich - premium selling favored")
            elif profile.vega_positive:
                adjustment = -15
                rec.warnings.append("IV rich - long vega strategies unfavorable")
            else:
                adjustment = 0
        elif vol_state == VolatilityState.IV_CHEAP:
            if profile.vega_positive:
                adjustment = 15
                rec.reasons.append("IV cheap - long vega strategies favored")
            elif profile.theta_positive:
                adjustment = -10
                rec.warnings.append("IV cheap - premium selling less attractive")
            else:
                adjustment = 0
        else:
            adjustment = 0
        score_adjustments.append(adjustment)
        
        # =====================================================================
        # 3. MOMENTUM ALIGNMENT
        # =====================================================================
        if momentum in profile.best_momentum:
            adjustment = 15
            rec.reasons.append(f"Momentum ({momentum.value}) aligns with strategy")
        else:
            # Check directional mismatch
            if profile.delta_bias == "bullish" and momentum in [MomentumState.STRONG_BEARISH, MomentumState.WEAK_BEARISH]:
                adjustment = -25
                rec.warnings.append(f"Bearish momentum conflicts with bullish strategy")
            elif profile.delta_bias == "bearish" and momentum in [MomentumState.STRONG_BULLISH, MomentumState.WEAK_BULLISH]:
                adjustment = -25
                rec.warnings.append(f"Bullish momentum conflicts with bearish strategy")
            else:
                adjustment = -5
        score_adjustments.append(adjustment)
        
        # =====================================================================
        # 4. MARKET PHASE ALIGNMENT
        # =====================================================================
        if market_phase in profile.best_market_phase:
            adjustment = 10
            rec.reasons.append(f"Market phase ({market_phase.value}) supports strategy")
        else:
            adjustment = -5
        score_adjustments.append(adjustment)
        
        # =====================================================================
        # 5. MEAN REVERSION SIGNAL
        # =====================================================================
        if reversal == ReversalSignal.OVERSOLD:
            if profile.delta_bias == "bullish":
                adjustment = 10
                rec.reasons.append("Oversold conditions favor bullish entry")
            elif profile.delta_bias == "bearish":
                adjustment = -10
                rec.warnings.append("Oversold conditions - risky for bearish")
            else:
                adjustment = 0
        elif reversal == ReversalSignal.OVERBOUGHT:
            if profile.delta_bias == "bearish":
                adjustment = 10
                rec.reasons.append("Overbought conditions favor bearish entry")
            elif profile.delta_bias == "bullish":
                adjustment = -10
                rec.warnings.append("Overbought conditions - risky for bullish")
            else:
                adjustment = 0
        else:
            adjustment = 0
        score_adjustments.append(adjustment)
        
        # =====================================================================
        # 6. TRADE SCORE ALIGNMENT
        # =====================================================================
        if trade_score.direction in [TradingSignal.STRONG_BUY, TradingSignal.BUY]:
            if profile.delta_bias == "bullish":
                adjustment = 15
                rec.reasons.append("Trade score confirms bullish bias")
            elif profile.delta_bias == "bearish":
                adjustment = -15
            else:
                adjustment = 5
        elif trade_score.direction in [TradingSignal.STRONG_SELL, TradingSignal.SELL]:
            if profile.delta_bias == "bearish":
                adjustment = 15
                rec.reasons.append("Trade score confirms bearish bias")
            elif profile.delta_bias == "bullish":
                adjustment = -15
            else:
                adjustment = 5
        else:
            # Neutral signal
            if profile.delta_bias == "neutral":
                adjustment = 10
                rec.reasons.append("Neutral trade score favors neutral strategies")
            else:
                adjustment = -5
        score_adjustments.append(adjustment)
        
        # =====================================================================
        # 7. RISK PREFERENCE
        # =====================================================================
        if prefer_defined_risk:
            if profile.max_loss_defined and profile.max_profit_defined:
                adjustment = 10
                rec.reasons.append("Defined risk/reward preferred")
            elif not profile.max_loss_defined:
                adjustment = -20
                rec.warnings.append("Undefined risk - not preferred")
            else:
                adjustment = 0
        score_adjustments.append(adjustment)
        
        # =====================================================================
        # CALCULATE FINAL SCORE
        # =====================================================================
        total_adjustment = sum(score_adjustments)
        rec.score = max(0, min(100, rec.score + total_adjustment))
        
        # Calculate confidence based on alignment factors
        positive_factors = sum(1 for a in score_adjustments if a > 0)
        negative_factors = sum(1 for a in score_adjustments if a < 0)
        total_factors = len(score_adjustments)
        
        rec.confidence = 0.3 + (positive_factors / total_factors) * 0.7
        rec.confidence = min(0.95, max(0.2, rec.confidence))
        
        # =====================================================================
        # SET OPTIMAL PARAMETERS
        # =====================================================================
        rec.optimal_dte = self._calculate_optimal_dte(profile, iv_rank, momentum)
        rec.target_delta = self._calculate_optimal_delta(profile, trade_score, momentum)
        rec.spread_width = self._calculate_spread_width(profile, max_risk_per_trade)
        rec.position_size_multiplier = trade_score.confidence * (rec.score / 100)
        
        return rec
    
    def _calculate_optimal_dte(
        self,
        profile: StrategyProfile,
        iv_rank: float,
        momentum: MomentumState,
    ) -> int:
        """Calculate optimal DTE for the strategy."""
        min_dte, max_dte = profile.best_dte_range
        
        # Higher IV = shorter DTE (capture faster decay)
        iv_factor = 1 - (iv_rank / 100) * 0.3
        
        # Strong momentum = shorter DTE
        momentum_factor = {
            MomentumState.STRONG_BULLISH: 0.8,
            MomentumState.STRONG_BEARISH: 0.8,
            MomentumState.WEAK_BULLISH: 0.9,
            MomentumState.WEAK_BEARISH: 0.9,
            MomentumState.NEUTRAL: 1.0,
        }.get(momentum, 1.0)
        
        base_dte = (min_dte + max_dte) / 2
        optimal = int(base_dte * iv_factor * momentum_factor)
        
        return max(min_dte, min(max_dte, optimal))
    
    def _calculate_optimal_delta(
        self,
        profile: StrategyProfile,
        trade_score: TradeScore,
        momentum: MomentumState,
    ) -> float:
        """Calculate optimal delta for the strategy."""
        min_delta, max_delta = profile.typical_delta_range
        
        # Higher confidence = more aggressive delta
        confidence_factor = trade_score.confidence
        
        # Base delta in the middle of range
        base_delta = (min_delta + max_delta) / 2
        
        # Adjust based on confidence
        if confidence_factor > 0.7:
            # More aggressive - closer to ATM
            optimal = base_delta + (max_delta - base_delta) * 0.3
        elif confidence_factor < 0.4:
            # More conservative - further OTM
            optimal = min_delta + (base_delta - min_delta) * 0.3
        else:
            optimal = base_delta
        
        return round(max(min_delta, min(max_delta, optimal)), 2)
    
    def _calculate_spread_width(
        self,
        profile: StrategyProfile,
        max_risk: float,
    ) -> Optional[int]:
        """Calculate optimal spread width based on risk."""
        if "spread" not in profile.strategy.value and "condor" not in profile.strategy.value:
            return None
        
        # Standard widths: $2.5, $5, $10, $15, $20
        standard_widths = [2.5, 5, 10, 15, 20]
        
        # For credit spreads, max risk ≈ width - credit
        # Assume we collect ~30% of width as credit
        for width in standard_widths:
            estimated_risk = width * 0.70 * 100  # Per contract
            if estimated_risk <= max_risk:
                best_width = width
            else:
                break
        
        return int(best_width) if 'best_width' in locals() else 5
    
    def get_strategy_for_direction(
        self,
        direction: TradingSignal,
        vol_state: VolatilityState,
        iv_rank: float,
    ) -> StrategyType:
        """
        Quick strategy lookup based on direction and volatility.
        Used for simple strategy selection without full scoring.
        """
        if direction in [TradingSignal.STRONG_BUY, TradingSignal.BUY]:
            if vol_state == VolatilityState.IV_RICH or iv_rank > 50:
                return StrategyType.PUT_CREDIT_SPREAD
            else:
                return StrategyType.CALL_DEBIT_SPREAD
        
        elif direction in [TradingSignal.STRONG_SELL, TradingSignal.SELL]:
            if vol_state == VolatilityState.IV_RICH or iv_rank > 50:
                return StrategyType.CALL_CREDIT_SPREAD
            else:
                return StrategyType.PUT_DEBIT_SPREAD
        
        else:  # NEUTRAL
            if vol_state == VolatilityState.IV_RICH or iv_rank > 60:
                return StrategyType.IRON_CONDOR
            elif vol_state == VolatilityState.IV_CHEAP or iv_rank < 30:
                return StrategyType.LONG_STRADDLE
            else:
                return StrategyType.IRON_CONDOR


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_strategy_engine: Optional[StrategySelectionEngine] = None


def get_strategy_engine() -> StrategySelectionEngine:
    """Get singleton strategy selection engine."""
    global _strategy_engine
    if _strategy_engine is None:
        _strategy_engine = StrategySelectionEngine()
    return _strategy_engine
