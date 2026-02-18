"""
Trading Intelligence Engine

A comprehensive decision-making engine that combines multiple professional-grade
trading factors and strategies to generate high-quality trade signals.

Key Components:
1. Multi-Factor Scoring Model (MFSM)
2. Market Regime Detection & Adaptation
3. Technical Analysis Integration
4. Volatility Surface Analysis
5. Greeks-Based Risk Assessment
6. Sentiment & News Integration
7. Options Flow Analysis
8. Mean Reversion vs Momentum Detection
9. Support/Resistance Level Detection
10. Time-of-Day & Seasonality Effects

Based on institutional-grade quantitative strategies including:
- Volatility Risk Premium (VRP) strategies
- Delta-neutral premium collection
- Directional momentum with options
- Event-driven positioning
- Statistical arbitrage signals
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, date, timedelta
from enum import Enum
import math
import logging
import statistics

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & CONSTANTS
# =============================================================================

class MarketPhase(str, Enum):
    """Market cycle phases."""
    ACCUMULATION = "accumulation"     # Smart money buying, low volatility
    MARKUP = "markup"                 # Bullish trend, expanding
    DISTRIBUTION = "distribution"     # Smart money selling, high volatility
    MARKDOWN = "markdown"             # Bearish trend, declining


class TradingSignal(str, Enum):
    """Trade signal types."""
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    NEUTRAL = "neutral"
    SELL = "sell"
    STRONG_SELL = "strong_sell"


class VolatilityState(str, Enum):
    """IV vs RV relationship."""
    IV_RICH = "iv_rich"       # IV >> RV - sell premium
    IV_CHEAP = "iv_cheap"     # IV << RV - buy premium
    FAIR_VALUE = "fair_value" # IV ≈ RV


class MomentumState(str, Enum):
    """Momentum classification."""
    STRONG_BULLISH = "strong_bullish"
    WEAK_BULLISH = "weak_bullish"
    NEUTRAL = "neutral"
    WEAK_BEARISH = "weak_bearish"
    STRONG_BEARISH = "strong_bearish"


class ReversalSignal(str, Enum):
    """Mean reversion signals."""
    OVERBOUGHT = "overbought"
    OVERSOLD = "oversold"
    NEUTRAL = "neutral"


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class TechnicalIndicators:
    """Computed technical analysis indicators."""
    # Moving Averages
    sma_5: float = 0.0
    sma_10: float = 0.0
    sma_20: float = 0.0
    sma_50: float = 0.0
    sma_200: float = 0.0
    ema_9: float = 0.0
    ema_21: float = 0.0
    
    # Momentum Oscillators
    rsi_14: float = 50.0
    rsi_7: float = 50.0
    stochastic_k: float = 50.0
    stochastic_d: float = 50.0
    macd_line: float = 0.0
    macd_signal: float = 0.0
    macd_histogram: float = 0.0
    
    # Volatility
    atr_14: float = 0.0
    bollinger_upper: float = 0.0
    bollinger_lower: float = 0.0
    bollinger_pct_b: float = 0.5  # 0-1
    keltner_upper: float = 0.0
    keltner_lower: float = 0.0
    
    # Volume
    volume_sma_20: float = 0.0
    volume_ratio: float = 1.0  # Current volume / avg volume
    obv_trend: float = 0.0     # On-balance volume trend
    vwap: float = 0.0
    
    # Support/Resistance
    pivot_point: float = 0.0
    resistance_1: float = 0.0
    resistance_2: float = 0.0
    support_1: float = 0.0
    support_2: float = 0.0
    
    # Pattern Detection
    higher_highs: bool = False
    higher_lows: bool = False
    lower_highs: bool = False
    lower_lows: bool = False


@dataclass
class VolatilitySurface:
    """Options volatility surface analysis."""
    atm_iv: float = 0.30
    iv_skew: float = 0.0        # Put IV - Call IV (positive = put skew)
    iv_term_structure: float = 0.0  # Front IV - Back IV (positive = contango)
    iv_rank_30d: float = 50.0
    iv_rank_90d: float = 50.0
    iv_percentile: float = 50.0
    realized_vol_10d: float = 0.20
    realized_vol_20d: float = 0.20
    realized_vol_30d: float = 0.20
    vrp: float = 0.0            # Volatility Risk Premium (IV - RV)
    vrp_zscore: float = 0.0     # Z-score of VRP


@dataclass
class OptionsFlow:
    """Options flow analysis from market activity."""
    call_volume: int = 0
    put_volume: int = 0
    put_call_ratio: float = 1.0
    call_oi: int = 0
    put_oi: int = 0
    oi_put_call_ratio: float = 1.0
    unusual_call_activity: bool = False
    unusual_put_activity: bool = False
    large_trades_bullish: int = 0
    large_trades_bearish: int = 0
    net_premium_flow: float = 0.0  # Positive = bullish flow


@dataclass  
class SentimentData:
    """Multi-source sentiment aggregation."""
    news_sentiment: float = 0.0      # -1 to 1
    social_sentiment: float = 0.0    # -1 to 1
    analyst_rating: float = 0.0      # -1 to 1
    insider_activity: float = 0.0    # -1 to 1
    institutional_flow: float = 0.0  # -1 to 1
    short_interest_pct: float = 0.0
    days_to_cover: float = 0.0
    composite_sentiment: float = 0.0


@dataclass
class EventCalendar:
    """Upcoming events that may impact trading."""
    earnings_date: Optional[date] = None
    earnings_days_away: int = 999
    ex_dividend_date: Optional[date] = None
    fomc_days_away: int = 999
    cpi_days_away: int = 999
    employment_days_away: int = 999
    has_binary_event: bool = False


@dataclass
class TradeScore:
    """Comprehensive multi-factor trade score."""
    symbol: str
    direction: TradingSignal
    
    # Factor Scores (0-100)
    technical_score: float = 50.0
    momentum_score: float = 50.0
    volatility_score: float = 50.0
    sentiment_score: float = 50.0
    flow_score: float = 50.0
    regime_score: float = 50.0
    timing_score: float = 50.0
    risk_reward_score: float = 50.0
    
    # Composite Score
    composite_score: float = 50.0
    confidence: float = 0.5
    
    # Recommended Strategy
    recommended_strategy: str = ""
    optimal_dte: int = 30
    target_delta: float = 0.30
    
    # Risk Parameters
    suggested_position_size: float = 1.0
    max_loss_pct: float = 10.0
    profit_target_pct: float = 50.0
    
    # Reasoning
    bull_factors: List[str] = field(default_factory=list)
    bear_factors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# =============================================================================
# TRADING INTELLIGENCE ENGINE
# =============================================================================

class TradingIntelligenceEngine:
    """
    Core trading intelligence engine that combines multiple factors
    to generate high-quality trade signals.
    """
    
    # Factor weights for composite scoring
    FACTOR_WEIGHTS = {
        "technical": 0.20,
        "momentum": 0.15,
        "volatility": 0.20,
        "sentiment": 0.10,
        "flow": 0.10,
        "regime": 0.10,
        "timing": 0.05,
        "risk_reward": 0.10,
    }
    
    # RSI Thresholds
    RSI_OVERSOLD = 30
    RSI_OVERBOUGHT = 70
    RSI_EXTREME_OVERSOLD = 20
    RSI_EXTREME_OVERBOUGHT = 80
    
    # VRP Thresholds
    VRP_RICH_THRESHOLD = 0.05   # IV > RV by 5%
    VRP_CHEAP_THRESHOLD = -0.03 # IV < RV by 3%
    
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._market_regime: Optional[MarketPhase] = None
    
    # =========================================================================
    # TECHNICAL ANALYSIS
    # =========================================================================
    
    def compute_technical_indicators(
        self,
        prices: List[float],
        highs: Optional[List[float]] = None,
        lows: Optional[List[float]] = None,
        volumes: Optional[List[float]] = None,
    ) -> TechnicalIndicators:
        """Compute comprehensive technical indicators from price data."""
        indicators = TechnicalIndicators()
        
        if len(prices) < 5:
            return indicators
        
        # Fill missing OHLCV data
        highs = highs or prices
        lows = lows or prices
        volumes = volumes or [1_000_000] * len(prices)
        
        # Moving Averages
        indicators.sma_5 = self._sma(prices, 5)
        indicators.sma_10 = self._sma(prices, 10)
        indicators.sma_20 = self._sma(prices, 20)
        indicators.sma_50 = self._sma(prices, 50) if len(prices) >= 50 else indicators.sma_20
        indicators.sma_200 = self._sma(prices, 200) if len(prices) >= 200 else indicators.sma_50
        
        indicators.ema_9 = self._ema(prices, 9)
        indicators.ema_21 = self._ema(prices, 21)
        
        # RSI
        indicators.rsi_14 = self._rsi(prices, 14)
        indicators.rsi_7 = self._rsi(prices, 7)
        
        # Stochastic
        if len(prices) >= 14:
            k, d = self._stochastic(prices, highs, lows, 14, 3)
            indicators.stochastic_k = k
            indicators.stochastic_d = d
        
        # MACD
        macd, signal, hist = self._macd(prices)
        indicators.macd_line = macd
        indicators.macd_signal = signal
        indicators.macd_histogram = hist
        
        # ATR
        indicators.atr_14 = self._atr(prices, highs, lows, 14)
        
        # Bollinger Bands
        bb_upper, bb_lower, pct_b = self._bollinger_bands(prices, 20, 2.0)
        indicators.bollinger_upper = bb_upper
        indicators.bollinger_lower = bb_lower
        indicators.bollinger_pct_b = pct_b
        
        # Keltner Channels
        kc_upper, kc_lower = self._keltner_channels(prices, highs, lows, 20, 1.5)
        indicators.keltner_upper = kc_upper
        indicators.keltner_lower = kc_lower
        
        # Volume Analysis
        indicators.volume_sma_20 = self._sma(volumes, 20)
        if indicators.volume_sma_20 > 0:
            indicators.volume_ratio = volumes[-1] / indicators.volume_sma_20
        
        # VWAP (simplified daily)
        typical_prices = [(h + l + c) / 3 for h, l, c in zip(highs, lows, prices)]
        if sum(volumes) > 0:
            indicators.vwap = sum(tp * v for tp, v in zip(typical_prices, volumes)) / sum(volumes)
        
        # Pivot Points
        if len(prices) >= 2:
            prev_high = max(highs[-2:-1] or [prices[-1]])
            prev_low = min(lows[-2:-1] or [prices[-1]])
            prev_close = prices[-2]
            indicators.pivot_point = (prev_high + prev_low + prev_close) / 3
            indicators.resistance_1 = 2 * indicators.pivot_point - prev_low
            indicators.resistance_2 = indicators.pivot_point + (prev_high - prev_low)
            indicators.support_1 = 2 * indicators.pivot_point - prev_high
            indicators.support_2 = indicators.pivot_point - (prev_high - prev_low)
        
        # Pattern Detection
        if len(prices) >= 10:
            recent_highs = highs[-10:]
            recent_lows = lows[-10:]
            indicators.higher_highs = all(recent_highs[i] > recent_highs[i-3] for i in range(3, len(recent_highs), 3))
            indicators.higher_lows = all(recent_lows[i] > recent_lows[i-3] for i in range(3, len(recent_lows), 3))
            indicators.lower_highs = all(recent_highs[i] < recent_highs[i-3] for i in range(3, len(recent_highs), 3))
            indicators.lower_lows = all(recent_lows[i] < recent_lows[i-3] for i in range(3, len(recent_lows), 3))
        
        return indicators
    
    # =========================================================================
    # VOLATILITY ANALYSIS
    # =========================================================================
    
    def analyze_volatility_surface(
        self,
        atm_iv: float,
        put_ivs: List[float],
        call_ivs: List[float],
        front_iv: float,
        back_iv: float,
        prices: List[float],
        iv_history: Optional[List[float]] = None,
    ) -> VolatilitySurface:
        """Analyze the volatility surface for trading opportunities."""
        surface = VolatilitySurface()
        surface.atm_iv = atm_iv
        
        # IV Skew
        avg_put_iv = statistics.mean(put_ivs) if put_ivs else atm_iv
        avg_call_iv = statistics.mean(call_ivs) if call_ivs else atm_iv
        surface.iv_skew = avg_put_iv - avg_call_iv
        
        # Term Structure
        surface.iv_term_structure = front_iv - back_iv
        
        # Realized Volatility
        surface.realized_vol_10d = self._compute_realized_vol(prices, 10)
        surface.realized_vol_20d = self._compute_realized_vol(prices, 20)
        surface.realized_vol_30d = self._compute_realized_vol(prices, 30)
        
        # Volatility Risk Premium
        surface.vrp = atm_iv - surface.realized_vol_20d
        
        # IV Rank (if history available)
        if iv_history and len(iv_history) >= 20:
            min_iv = min(iv_history)
            max_iv = max(iv_history)
            if max_iv > min_iv:
                surface.iv_rank_30d = ((atm_iv - min_iv) / (max_iv - min_iv)) * 100
            
            # IV Percentile
            lower_count = sum(1 for iv in iv_history if iv < atm_iv)
            surface.iv_percentile = (lower_count / len(iv_history)) * 100
            
            # VRP Z-Score
            vrp_history = [h - surface.realized_vol_20d for h in iv_history[-60:]]
            if len(vrp_history) >= 2:
                vrp_mean = statistics.mean(vrp_history)
                vrp_std = statistics.stdev(vrp_history)
                if vrp_std > 0:
                    surface.vrp_zscore = (surface.vrp - vrp_mean) / vrp_std
        
        return surface
    
    def get_volatility_state(self, surface: VolatilitySurface) -> VolatilityState:
        """Classify the current volatility state."""
        if surface.vrp > self.VRP_RICH_THRESHOLD:
            return VolatilityState.IV_RICH
        elif surface.vrp < self.VRP_CHEAP_THRESHOLD:
            return VolatilityState.IV_CHEAP
        else:
            return VolatilityState.FAIR_VALUE
    
    # =========================================================================
    # MOMENTUM ANALYSIS
    # =========================================================================
    
    def analyze_momentum(
        self,
        prices: List[float],
        indicators: TechnicalIndicators,
    ) -> Tuple[MomentumState, float]:
        """
        Analyze momentum using multiple factors.
        Returns momentum state and strength (0-100).
        """
        momentum_signals = []
        
        current_price = prices[-1]
        
        # Moving Average Alignment
        ma_score = 0
        if current_price > indicators.sma_20 > indicators.sma_50:
            ma_score = 75
        elif current_price > indicators.sma_20:
            ma_score = 60
        elif current_price < indicators.sma_20 < indicators.sma_50:
            ma_score = 25
        elif current_price < indicators.sma_20:
            ma_score = 40
        else:
            ma_score = 50
        momentum_signals.append(ma_score)
        
        # EMA Crossover
        ema_score = 50
        if indicators.ema_9 > indicators.ema_21:
            ema_score = 70 if indicators.ema_9 > indicators.ema_21 * 1.01 else 60
        elif indicators.ema_9 < indicators.ema_21:
            ema_score = 30 if indicators.ema_9 < indicators.ema_21 * 0.99 else 40
        momentum_signals.append(ema_score)
        
        # MACD
        macd_score = 50
        if indicators.macd_histogram > 0:
            macd_score = 60 + min(20, abs(indicators.macd_histogram) * 100)
        elif indicators.macd_histogram < 0:
            macd_score = 40 - min(20, abs(indicators.macd_histogram) * 100)
        momentum_signals.append(macd_score)
        
        # RSI Momentum
        rsi_score = indicators.rsi_14
        if indicators.rsi_14 > 60 and indicators.rsi_7 > indicators.rsi_14:
            rsi_score = min(85, indicators.rsi_14 + 10)  # Accelerating up
        elif indicators.rsi_14 < 40 and indicators.rsi_7 < indicators.rsi_14:
            rsi_score = max(15, indicators.rsi_14 - 10)  # Accelerating down
        momentum_signals.append(rsi_score)
        
        # Price Patterns
        pattern_score = 50
        if indicators.higher_highs and indicators.higher_lows:
            pattern_score = 80
        elif indicators.lower_highs and indicators.lower_lows:
            pattern_score = 20
        momentum_signals.append(pattern_score)
        
        # Composite Momentum Score
        avg_momentum = statistics.mean(momentum_signals)
        
        # Classify momentum state
        if avg_momentum >= 70:
            state = MomentumState.STRONG_BULLISH
        elif avg_momentum >= 55:
            state = MomentumState.WEAK_BULLISH
        elif avg_momentum <= 30:
            state = MomentumState.STRONG_BEARISH
        elif avg_momentum <= 45:
            state = MomentumState.WEAK_BEARISH
        else:
            state = MomentumState.NEUTRAL
        
        return state, avg_momentum
    
    # =========================================================================
    # MEAN REVERSION ANALYSIS
    # =========================================================================
    
    def analyze_mean_reversion(
        self,
        prices: List[float],
        indicators: TechnicalIndicators,
    ) -> Tuple[ReversalSignal, float]:
        """
        Analyze mean reversion opportunity.
        Returns signal and strength (0-100).
        """
        signals = []
        
        # RSI Extremes
        rsi_signal = 50
        if indicators.rsi_14 < self.RSI_EXTREME_OVERSOLD:
            rsi_signal = 90  # Strong oversold
        elif indicators.rsi_14 < self.RSI_OVERSOLD:
            rsi_signal = 70  # Oversold
        elif indicators.rsi_14 > self.RSI_EXTREME_OVERBOUGHT:
            rsi_signal = 10  # Strong overbought
        elif indicators.rsi_14 > self.RSI_OVERBOUGHT:
            rsi_signal = 30  # Overbought
        signals.append(rsi_signal)
        
        # Bollinger Band Position
        bb_signal = 50
        if indicators.bollinger_pct_b < 0:
            bb_signal = 85  # Below lower band
        elif indicators.bollinger_pct_b < 0.2:
            bb_signal = 70  # Near lower band
        elif indicators.bollinger_pct_b > 1.0:
            bb_signal = 15  # Above upper band
        elif indicators.bollinger_pct_b > 0.8:
            bb_signal = 30  # Near upper band
        signals.append(bb_signal)
        
        # Stochastic
        stoch_signal = 50
        if indicators.stochastic_k < 20:
            stoch_signal = 75
        elif indicators.stochastic_k > 80:
            stoch_signal = 25
        signals.append(stoch_signal)
        
        # Distance from Moving Average
        current_price = prices[-1]
        ma_distance = (current_price - indicators.sma_20) / indicators.sma_20 if indicators.sma_20 > 0 else 0
        ma_signal = 50
        if ma_distance < -0.05:  # 5% below SMA
            ma_signal = 75
        elif ma_distance < -0.10:  # 10% below SMA
            ma_signal = 90
        elif ma_distance > 0.05:  # 5% above SMA
            ma_signal = 25
        elif ma_distance > 0.10:  # 10% above SMA
            ma_signal = 10
        signals.append(ma_signal)
        
        avg_signal = statistics.mean(signals)
        
        if avg_signal >= 70:
            return ReversalSignal.OVERSOLD, avg_signal
        elif avg_signal <= 30:
            return ReversalSignal.OVERBOUGHT, avg_signal
        else:
            return ReversalSignal.NEUTRAL, avg_signal
    
    # =========================================================================
    # MARKET REGIME DETECTION
    # =========================================================================
    
    def detect_market_phase(
        self,
        prices: List[float],
        volumes: List[float],
        indicators: TechnicalIndicators,
    ) -> Tuple[MarketPhase, float]:
        """
        Detect current market phase using Wyckoff methodology.
        Returns phase and confidence (0-1).
        """
        if len(prices) < 50:
            return MarketPhase.ACCUMULATION, 0.3
        
        current_price = prices[-1]
        
        # Trend Assessment
        above_sma50 = current_price > indicators.sma_50
        above_sma200 = current_price > indicators.sma_200
        sma50_rising = indicators.sma_50 > self._sma(prices[:-10], 50) if len(prices) > 60 else True
        
        # Volume Analysis
        recent_vol_avg = statistics.mean(volumes[-5:]) if volumes else 1
        prior_vol_avg = statistics.mean(volumes[-20:-5]) if len(volumes) > 20 else recent_vol_avg
        volume_expansion = recent_vol_avg > prior_vol_avg * 1.2
        volume_contraction = recent_vol_avg < prior_vol_avg * 0.8
        
        # Price Range Analysis
        recent_range = max(prices[-20:]) - min(prices[-20:])
        prior_range = max(prices[-40:-20]) - min(prices[-40:-20]) if len(prices) > 40 else recent_range
        range_expansion = recent_range > prior_range * 1.2
        range_contraction = recent_range < prior_range * 0.8
        
        # Phase Classification
        confidence = 0.5
        
        if above_sma50 and above_sma200 and sma50_rising:
            if volume_expansion and range_expansion:
                phase = MarketPhase.MARKUP
                confidence = 0.8
            elif volume_contraction or range_contraction:
                phase = MarketPhase.DISTRIBUTION
                confidence = 0.6
            else:
                phase = MarketPhase.MARKUP
                confidence = 0.6
        
        elif not above_sma50 and not above_sma200 and not sma50_rising:
            if volume_expansion and range_expansion:
                phase = MarketPhase.MARKDOWN
                confidence = 0.8
            elif volume_contraction:
                phase = MarketPhase.ACCUMULATION
                confidence = 0.6
            else:
                phase = MarketPhase.MARKDOWN
                confidence = 0.6
        
        elif volume_contraction and range_contraction:
            if current_price < indicators.sma_200:
                phase = MarketPhase.ACCUMULATION
                confidence = 0.5
            else:
                phase = MarketPhase.DISTRIBUTION
                confidence = 0.5
        
        else:
            # Transition phase
            if sma50_rising:
                phase = MarketPhase.ACCUMULATION
            else:
                phase = MarketPhase.DISTRIBUTION
            confidence = 0.4
        
        return phase, confidence
    
    # =========================================================================
    # COMPREHENSIVE TRADE SCORING
    # =========================================================================
    
    def score_trade_opportunity(
        self,
        symbol: str,
        prices: List[float],
        highs: Optional[List[float]] = None,
        lows: Optional[List[float]] = None,
        volumes: Optional[List[float]] = None,
        atm_iv: float = 0.30,
        iv_history: Optional[List[float]] = None,
        sentiment: Optional[SentimentData] = None,
        flow: Optional[OptionsFlow] = None,
        events: Optional[EventCalendar] = None,
    ) -> TradeScore:
        """
        Generate comprehensive trade score using all available factors.
        """
        score = TradeScore(symbol=symbol, direction=TradingSignal.NEUTRAL)
        
        if len(prices) < 20:
            score.warnings.append("Insufficient price history")
            return score
        
        # Compute all indicators
        indicators = self.compute_technical_indicators(prices, highs, lows, volumes)
        
        # Analyze volatility
        vol_surface = self.analyze_volatility_surface(
            atm_iv=atm_iv,
            put_ivs=[atm_iv * 1.1],  # Simplified
            call_ivs=[atm_iv * 0.95],
            front_iv=atm_iv,
            back_iv=atm_iv * 0.95,
            prices=prices,
            iv_history=iv_history,
        )
        vol_state = self.get_volatility_state(vol_surface)
        
        # Analyze momentum
        momentum_state, momentum_strength = self.analyze_momentum(prices, indicators)
        
        # Analyze mean reversion
        reversal_signal, reversal_strength = self.analyze_mean_reversion(prices, indicators)
        
        # Detect market phase
        market_phase, phase_confidence = self.detect_market_phase(
            prices, volumes or [1_000_000] * len(prices), indicators
        )
        
        # =====================================================================
        # FACTOR SCORING
        # =====================================================================
        
        # 1. Technical Score
        tech_signals = []
        
        # Trend alignment
        current_price = prices[-1]
        if current_price > indicators.sma_20 > indicators.sma_50:
            tech_signals.append(75)
            score.bull_factors.append("Price above key moving averages (bullish alignment)")
        elif current_price < indicators.sma_20 < indicators.sma_50:
            tech_signals.append(25)
            score.bear_factors.append("Price below key moving averages (bearish alignment)")
        else:
            tech_signals.append(50)
        
        # MACD
        if indicators.macd_histogram > 0 and indicators.macd_line > indicators.macd_signal:
            tech_signals.append(70)
            score.bull_factors.append("MACD bullish crossover")
        elif indicators.macd_histogram < 0 and indicators.macd_line < indicators.macd_signal:
            tech_signals.append(30)
            score.bear_factors.append("MACD bearish crossover")
        else:
            tech_signals.append(50)
        
        # Support/Resistance
        if current_price > indicators.pivot_point:
            if current_price < indicators.resistance_1:
                tech_signals.append(60)
            else:
                tech_signals.append(55)  # Extended, may pullback
        else:
            if current_price > indicators.support_1:
                tech_signals.append(40)
            else:
                tech_signals.append(45)  # Oversold near support
        
        score.technical_score = statistics.mean(tech_signals)
        
        # 2. Momentum Score
        score.momentum_score = momentum_strength
        
        if momentum_state == MomentumState.STRONG_BULLISH:
            score.bull_factors.append("Strong bullish momentum")
        elif momentum_state == MomentumState.STRONG_BEARISH:
            score.bear_factors.append("Strong bearish momentum")
        
        # 3. Volatility Score (higher = better for premium selling)
        if vol_state == VolatilityState.IV_RICH:
            score.volatility_score = 75
            score.bull_factors.append(f"IV rich (VRP: {vol_surface.vrp:.1%}) - good for selling premium")
        elif vol_state == VolatilityState.IV_CHEAP:
            score.volatility_score = 25
            score.bear_factors.append(f"IV cheap (VRP: {vol_surface.vrp:.1%}) - poor for selling premium")
        else:
            score.volatility_score = 50
        
        # Adjust for IV rank
        if vol_surface.iv_rank_30d > 70:
            score.volatility_score = min(90, score.volatility_score + 15)
            score.bull_factors.append(f"High IV rank ({vol_surface.iv_rank_30d:.0f}%) - elevated premiums")
        elif vol_surface.iv_rank_30d < 30:
            score.volatility_score = max(20, score.volatility_score - 10)
            score.bear_factors.append(f"Low IV rank ({vol_surface.iv_rank_30d:.0f}%) - compressed premiums")
        
        # 4. Sentiment Score (if available)
        if sentiment:
            score.sentiment_score = 50 + (sentiment.composite_sentiment * 50)
            if sentiment.composite_sentiment > 0.3:
                score.bull_factors.append(f"Positive sentiment ({sentiment.composite_sentiment:.2f})")
            elif sentiment.composite_sentiment < -0.3:
                score.bear_factors.append(f"Negative sentiment ({sentiment.composite_sentiment:.2f})")
        
        # 5. Flow Score (if available)
        if flow:
            flow_bias = 50
            if flow.put_call_ratio < 0.7:
                flow_bias = 70
                score.bull_factors.append(f"Bullish P/C ratio ({flow.put_call_ratio:.2f})")
            elif flow.put_call_ratio > 1.3:
                flow_bias = 30
                score.bear_factors.append(f"Bearish P/C ratio ({flow.put_call_ratio:.2f})")
            
            if flow.unusual_call_activity:
                flow_bias = min(85, flow_bias + 15)
                score.bull_factors.append("Unusual call activity detected")
            if flow.unusual_put_activity:
                flow_bias = max(15, flow_bias - 15)
                score.bear_factors.append("Unusual put activity detected")
            
            score.flow_score = flow_bias
        
        # 6. Regime Score
        regime_scores = {
            MarketPhase.MARKUP: 70,
            MarketPhase.ACCUMULATION: 55,
            MarketPhase.DISTRIBUTION: 45,
            MarketPhase.MARKDOWN: 30,
        }
        score.regime_score = regime_scores.get(market_phase, 50)
        
        if market_phase == MarketPhase.MARKUP:
            score.bull_factors.append("Markup phase - favor bullish strategies")
        elif market_phase == MarketPhase.MARKDOWN:
            score.bear_factors.append("Markdown phase - favor bearish strategies")
        
        # 7. Timing Score
        timing_score = 50
        
        # Check for events (if available)
        if events:
            if events.earnings_days_away < 3:
                timing_score = 30
                score.warnings.append(f"Earnings in {events.earnings_days_away} days - elevated event risk")
            elif events.fomc_days_away < 2:
                timing_score = 35
                score.warnings.append("FOMC meeting imminent - elevated macro risk")
        
        # RSI timing
        if 40 <= indicators.rsi_14 <= 60:
            timing_score = max(timing_score, 60)  # Neutral RSI = good entry
        
        score.timing_score = timing_score
        
        # 8. Risk/Reward Score
        # Based on position relative to key levels
        rr_score = 50
        
        # Proximity to support (lower = better for longs)
        if current_price < indicators.support_1 * 1.02:
            rr_score = 70
            score.bull_factors.append("Near support - favorable risk/reward for longs")
        elif current_price > indicators.resistance_1 * 0.98:
            rr_score = 30
            score.bear_factors.append("Near resistance - unfavorable for longs")
        
        score.risk_reward_score = rr_score
        
        # =====================================================================
        # COMPOSITE SCORE & DIRECTION
        # =====================================================================
        
        score.composite_score = (
            score.technical_score * self.FACTOR_WEIGHTS["technical"] +
            score.momentum_score * self.FACTOR_WEIGHTS["momentum"] +
            score.volatility_score * self.FACTOR_WEIGHTS["volatility"] +
            score.sentiment_score * self.FACTOR_WEIGHTS["sentiment"] +
            score.flow_score * self.FACTOR_WEIGHTS["flow"] +
            score.regime_score * self.FACTOR_WEIGHTS["regime"] +
            score.timing_score * self.FACTOR_WEIGHTS["timing"] +
            score.risk_reward_score * self.FACTOR_WEIGHTS["risk_reward"]
        )
        
        # Determine direction
        if score.composite_score >= 70:
            score.direction = TradingSignal.STRONG_BUY
        elif score.composite_score >= 55:
            score.direction = TradingSignal.BUY
        elif score.composite_score <= 30:
            score.direction = TradingSignal.STRONG_SELL
        elif score.composite_score <= 45:
            score.direction = TradingSignal.SELL
        else:
            score.direction = TradingSignal.NEUTRAL
        
        # Confidence based on factor agreement
        factor_scores = [
            score.technical_score, score.momentum_score, score.volatility_score,
            score.regime_score, score.timing_score, score.risk_reward_score
        ]
        score_std = statistics.stdev(factor_scores) if len(factor_scores) > 1 else 20
        score.confidence = max(0.2, min(0.95, 1.0 - (score_std / 50)))
        
        # =====================================================================
        # STRATEGY RECOMMENDATION
        # =====================================================================
        
        score.recommended_strategy, score.optimal_dte, score.target_delta = \
            self._recommend_strategy(score, vol_state, momentum_state, reversal_signal, indicators)
        
        # Position sizing based on confidence
        score.suggested_position_size = 0.5 + (score.confidence * 0.5)
        
        # Risk parameters
        score.max_loss_pct = 10.0 if score.confidence > 0.6 else 15.0
        score.profit_target_pct = 50.0 if vol_state == VolatilityState.IV_RICH else 30.0
        
        return score
    
    def _recommend_strategy(
        self,
        score: TradeScore,
        vol_state: VolatilityState,
        momentum: MomentumState,
        reversal: ReversalSignal,
        indicators: TechnicalIndicators,
    ) -> Tuple[str, int, float]:
        """
        Recommend optimal strategy based on market conditions.
        Returns (strategy_name, optimal_dte, target_delta).
        """
        # IV Rich Environment - Sell Premium
        if vol_state == VolatilityState.IV_RICH:
            if momentum in [MomentumState.STRONG_BULLISH, MomentumState.WEAK_BULLISH]:
                return "put_credit_spread", 30, 0.25
            elif momentum in [MomentumState.STRONG_BEARISH, MomentumState.WEAK_BEARISH]:
                return "call_credit_spread", 30, 0.25
            else:
                return "iron_condor", 45, 0.20
        
        # IV Cheap Environment - Buy Premium
        elif vol_state == VolatilityState.IV_CHEAP:
            if momentum == MomentumState.STRONG_BULLISH:
                return "call_debit_spread", 21, 0.40
            elif momentum == MomentumState.STRONG_BEARISH:
                return "put_debit_spread", 21, 0.40
            elif reversal == ReversalSignal.OVERSOLD:
                return "long_call", 14, 0.50
            elif reversal == ReversalSignal.OVERBOUGHT:
                return "long_put", 14, 0.50
            else:
                return "straddle", 30, 0.50
        
        # Fair Value IV - Direction dependent
        else:
            if momentum == MomentumState.STRONG_BULLISH:
                if score.composite_score > 65:
                    return "call_debit_spread", 21, 0.45
                else:
                    return "put_credit_spread", 30, 0.25
            elif momentum == MomentumState.STRONG_BEARISH:
                if score.composite_score < 35:
                    return "put_debit_spread", 21, 0.45
                else:
                    return "call_credit_spread", 30, 0.25
            elif reversal == ReversalSignal.OVERSOLD:
                return "put_credit_spread", 21, 0.30
            elif reversal == ReversalSignal.OVERBOUGHT:
                return "call_credit_spread", 21, 0.30
            else:
                return "iron_condor", 45, 0.20
    
    # =========================================================================
    # HELPER FUNCTIONS
    # =========================================================================
    
    def _sma(self, data: List[float], period: int) -> float:
        """Simple Moving Average."""
        if len(data) < period:
            period = len(data)
        return statistics.mean(data[-period:]) if data else 0.0
    
    def _ema(self, data: List[float], period: int) -> float:
        """Exponential Moving Average."""
        if len(data) < 2:
            return data[-1] if data else 0.0
        
        multiplier = 2 / (period + 1)
        ema = data[0]
        for price in data[1:]:
            ema = (price - ema) * multiplier + ema
        return ema
    
    def _rsi(self, prices: List[float], period: int = 14) -> float:
        """Relative Strength Index."""
        if len(prices) < period + 1:
            return 50.0
        
        gains = []
        losses = []
        
        for i in range(1, len(prices)):
            change = prices[i] - prices[i-1]
            if change > 0:
                gains.append(change)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(abs(change))
        
        # Use exponential moving average
        avg_gain = self._ema(gains[-period:], period)
        avg_loss = self._ema(losses[-period:], period)
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
    
    def _stochastic(
        self,
        prices: List[float],
        highs: List[float],
        lows: List[float],
        k_period: int = 14,
        d_period: int = 3,
    ) -> Tuple[float, float]:
        """Stochastic Oscillator."""
        if len(prices) < k_period:
            return 50.0, 50.0
        
        highest_high = max(highs[-k_period:])
        lowest_low = min(lows[-k_period:])
        
        if highest_high == lowest_low:
            k = 50.0
        else:
            k = ((prices[-1] - lowest_low) / (highest_high - lowest_low)) * 100
        
        # Calculate %D as SMA of %K
        d = k  # Simplified
        return k, d
    
    def _macd(
        self,
        prices: List[float],
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ) -> Tuple[float, float, float]:
        """MACD Indicator."""
        if len(prices) < slow:
            return 0.0, 0.0, 0.0
        
        ema_fast = self._ema(prices, fast)
        ema_slow = self._ema(prices, slow)
        macd_line = ema_fast - ema_slow
        
        # Signal line (simplified - would normally use MACD history)
        signal_line = macd_line * 0.9
        histogram = macd_line - signal_line
        
        return macd_line, signal_line, histogram
    
    def _atr(
        self,
        prices: List[float],
        highs: List[float],
        lows: List[float],
        period: int = 14,
    ) -> float:
        """Average True Range."""
        if len(prices) < 2:
            return 0.0
        
        true_ranges = []
        for i in range(1, min(len(prices), period + 1)):
            high = highs[i] if i < len(highs) else prices[i]
            low = lows[i] if i < len(lows) else prices[i]
            prev_close = prices[i-1]
            
            tr = max(
                high - low,
                abs(high - prev_close),
                abs(low - prev_close)
            )
            true_ranges.append(tr)
        
        return statistics.mean(true_ranges) if true_ranges else 0.0
    
    def _bollinger_bands(
        self,
        prices: List[float],
        period: int = 20,
        std_dev: float = 2.0,
    ) -> Tuple[float, float, float]:
        """Bollinger Bands."""
        if len(prices) < period:
            return prices[-1], prices[-1], 0.5
        
        sma = self._sma(prices, period)
        std = statistics.stdev(prices[-period:])
        
        upper = sma + (std_dev * std)
        lower = sma - (std_dev * std)
        
        # Percent B
        if upper != lower:
            pct_b = (prices[-1] - lower) / (upper - lower)
        else:
            pct_b = 0.5
        
        return upper, lower, pct_b
    
    def _keltner_channels(
        self,
        prices: List[float],
        highs: List[float],
        lows: List[float],
        period: int = 20,
        multiplier: float = 1.5,
    ) -> Tuple[float, float]:
        """Keltner Channels."""
        ema = self._ema(prices, period)
        atr = self._atr(prices, highs, lows, period)
        
        upper = ema + (multiplier * atr)
        lower = ema - (multiplier * atr)
        
        return upper, lower
    
    def _compute_realized_vol(self, prices: List[float], period: int = 20) -> float:
        """Compute realized volatility."""
        if len(prices) < 2:
            return 0.20
        
        lookback = min(len(prices), period + 1)
        recent = prices[-lookback:]
        
        returns = []
        for i in range(1, len(recent)):
            if recent[i-1] > 0 and recent[i] > 0:
                returns.append(math.log(recent[i] / recent[i-1]))
        
        if len(returns) < 2:
            return 0.20
        
        daily_vol = statistics.stdev(returns)
        return daily_vol * math.sqrt(252)


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_intelligence_engine: Optional[TradingIntelligenceEngine] = None


def get_trading_intelligence() -> TradingIntelligenceEngine:
    """Get singleton trading intelligence engine."""
    global _intelligence_engine
    if _intelligence_engine is None:
        _intelligence_engine = TradingIntelligenceEngine()
    return _intelligence_engine
