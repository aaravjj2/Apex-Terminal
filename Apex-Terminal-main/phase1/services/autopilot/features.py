"""
Feature Engine

Computes market features used for strategy selection:
- Trend detection (bullish/bearish/neutral)
- Volatility regime (high/low/normal)
- IV rank and percentile
- Liquidity scoring
- Forecast outputs (P10/P50/P90 bands)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import math
import logging

logger = logging.getLogger(__name__)


class TrendDirection(str, Enum):
    """Market trend direction."""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class VolatilityRegime(str, Enum):
    """Volatility regime classification."""
    LOW = "low"       # Below 20th percentile
    NORMAL = "normal" # 20th-80th percentile
    HIGH = "high"     # Above 80th percentile


@dataclass
class PriceForecast:
    """Price forecast with confidence bands."""
    horizon_days: int
    p10_return: float  # 10th percentile return
    p50_return: float  # Median return
    p90_return: float  # 90th percentile return
    volatility_forecast: float
    confidence: float  # 0-1 confidence score
    
    def to_dict(self) -> Dict:
        return {
            "horizon_days": self.horizon_days,
            "p10_return": self.p10_return,
            "p50_return": self.p50_return,
            "p90_return": self.p90_return,
            "volatility_forecast": self.volatility_forecast,
            "confidence": self.confidence,
        }


@dataclass
class SymbolFeatures:
    """Computed features for a symbol."""
    symbol: str
    last_price: float
    
    # Trend
    trend: TrendDirection
    trend_strength: float  # 0-1
    
    # Volatility
    realized_vol_20d: float
    iv_rank: float  # 0-100
    iv_percentile: float  # 0-100
    vol_regime: VolatilityRegime
    
    # Liquidity
    liquidity_score: float  # 0-1
    avg_spread_pct: float
    
    # Forecasts
    forecast_5d: Optional[PriceForecast] = None
    forecast_20d: Optional[PriceForecast] = None
    
    # Metadata
    computed_at: datetime = field(default_factory=datetime.utcnow)
    data_quality: float = 1.0  # 0-1, quality of input data
    
    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "last_price": self.last_price,
            "trend": self.trend.value,
            "trend_strength": self.trend_strength,
            "realized_vol_20d": self.realized_vol_20d,
            "iv_rank": self.iv_rank,
            "iv_percentile": self.iv_percentile,
            "vol_regime": self.vol_regime.value,
            "liquidity_score": self.liquidity_score,
            "avg_spread_pct": self.avg_spread_pct,
            "forecast_5d": self.forecast_5d.to_dict() if self.forecast_5d else None,
            "forecast_20d": self.forecast_20d.to_dict() if self.forecast_20d else None,
            "computed_at": self.computed_at.isoformat(),
            "data_quality": self.data_quality,
        }


@dataclass
class MarketRegime:
    """Overall market regime assessment."""
    spy_trend: TrendDirection
    vix_level: float
    vol_regime: VolatilityRegime
    risk_on: bool  # True if risk-on environment
    
    def to_dict(self) -> Dict:
        return {
            "spy_trend": self.spy_trend.value,
            "vix_level": self.vix_level,
            "vol_regime": self.vol_regime.value,
            "risk_on": self.risk_on,
        }


class FeatureEngine:
    """
    Computes trading features for autopilot decision making.
    """
    
    def __init__(self):
        self.iv_history: Dict[str, List[float]] = {}  # 52-week IV history per symbol
        self.calibration_stats: Dict[str, Dict] = {}  # Forecast calibration tracking
        self._market_regime: Optional[MarketRegime] = None
    
    def compute_features(
        self,
        symbol: str,
        prices: List[float],
        current_iv: float,
        iv_history_52w: Optional[List[float]] = None,
        avg_spread_pct: float = 0.05,
        volume: float = 1_000_000,
    ) -> SymbolFeatures:
        """
        Compute all features for a symbol.
        
        Args:
            symbol: Ticker symbol
            prices: Recent price history (most recent last)
            current_iv: Current implied volatility
            iv_history_52w: 52-week IV history
            avg_spread_pct: Average option bid-ask spread
            volume: Average daily volume
        
        Returns:
            SymbolFeatures with all computed features
        """
        if len(prices) < 2:
            raise ValueError("Need at least 2 prices for feature computation")
        
        last_price = prices[-1]
        
        # Compute trend
        trend, trend_strength = self._compute_trend(prices)
        
        # Compute realized volatility
        realized_vol = self._compute_realized_vol(prices)
        
        # Compute IV rank/percentile
        iv_rank, iv_percentile = self._compute_iv_metrics(
            current_iv, iv_history_52w or []
        )
        
        # Classify volatility regime
        vol_regime = self._classify_vol_regime(iv_rank)
        
        # Compute liquidity score
        liquidity_score = self._compute_liquidity_score(avg_spread_pct, volume)
        
        # Compute forecasts
        forecast_5d = self._compute_forecast(prices, realized_vol, 5)
        forecast_20d = self._compute_forecast(prices, realized_vol, 20)
        
        # Data quality assessment
        data_quality = self._assess_data_quality(
            len(prices), iv_history_52w, volume
        )
        
        return SymbolFeatures(
            symbol=symbol,
            last_price=last_price,
            trend=trend,
            trend_strength=trend_strength,
            realized_vol_20d=realized_vol,
            iv_rank=iv_rank,
            iv_percentile=iv_percentile,
            vol_regime=vol_regime,
            liquidity_score=liquidity_score,
            avg_spread_pct=avg_spread_pct,
            forecast_5d=forecast_5d,
            forecast_20d=forecast_20d,
            data_quality=data_quality,
        )

    async def get_features(self, symbol: str) -> Optional[SymbolFeatures]:
        """Fetch market data and compute features for a symbol."""
        try:
            from .data_fetcher import get_data_provider

            provider = get_data_provider()
            prices = provider.get_historical_prices(symbol, period="1mo")
            if not prices or len(prices) < 2:
                return None

            last_price = prices[-1]
            # Approx current IV from options chain (weekly preferred)
            chain = provider.get_options_chain(symbol, weekly_only=True)
            current_iv = 0.30
            if chain:
                ivs = [o.implied_vol for o in chain if o.implied_vol]
                if ivs:
                    current_iv = sum(ivs) / len(ivs)

            return self.compute_features(
                symbol=symbol,
                prices=prices,
                current_iv=current_iv,
                avg_spread_pct=0.05,
                volume=1_000_000,
            )
        except Exception as e:
            logger.warning(f"Feature compute failed for {symbol}: {e}")
            return None
    
    def _compute_trend(
        self,
        prices: List[float],
    ) -> Tuple[TrendDirection, float]:
        """Compute trend direction and strength."""
        if len(prices) < 20:
            # Use shorter period if not enough data
            lookback = len(prices)
        else:
            lookback = 20
        
        recent_prices = prices[-lookback:]
        
        # Simple linear regression slope
        n = len(recent_prices)
        x_mean = (n - 1) / 2
        y_mean = sum(recent_prices) / n
        
        numerator = sum((i - x_mean) * (p - y_mean) for i, p in enumerate(recent_prices))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            slope = 0
        else:
            slope = numerator / denominator
        
        # Normalize slope by price level
        normalized_slope = slope / y_mean if y_mean > 0 else 0
        
        # Trend strength (0-1) based on R²
        if denominator > 0:
            predicted = [y_mean + slope * (i - x_mean) for i in range(n)]
            ss_res = sum((p - pred) ** 2 for p, pred in zip(recent_prices, predicted))
            ss_tot = sum((p - y_mean) ** 2 for p in recent_prices)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
            trend_strength = max(0, min(1, r_squared))
        else:
            trend_strength = 0
        
        # Classify trend
        threshold = 0.001  # 0.1% daily slope threshold
        if normalized_slope > threshold:
            trend = TrendDirection.BULLISH
        elif normalized_slope < -threshold:
            trend = TrendDirection.BEARISH
        else:
            trend = TrendDirection.NEUTRAL
        
        return trend, trend_strength
    
    def _compute_realized_vol(self, prices: List[float]) -> float:
        """Compute 20-day realized volatility (annualized)."""
        if len(prices) < 2:
            return 0.20  # Default 20%
        
        # Use up to 21 prices for 20 returns
        lookback = min(len(prices), 21)
        recent = prices[-lookback:]
        
        # Compute log returns
        returns = []
        for i in range(1, len(recent)):
            if recent[i-1] > 0 and recent[i] > 0:
                returns.append(math.log(recent[i] / recent[i-1]))
        
        if len(returns) < 2:
            return 0.20
        
        # Standard deviation of returns
        mean_ret = sum(returns) / len(returns)
        variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
        daily_vol = math.sqrt(variance)
        
        # Annualize (252 trading days)
        annual_vol = daily_vol * math.sqrt(252)
        
        return annual_vol
    
    def _compute_iv_metrics(
        self,
        current_iv: float,
        iv_history: List[float]
    ) -> Tuple[float, float]:
        """Compute IV rank and percentile."""
        if not iv_history:
            # No history - assume middle of range
            return 50.0, 50.0
        
        min_iv = min(iv_history)
        max_iv = max(iv_history)
        
        # IV Rank: Where is current IV in the 52-week range?
        if max_iv > min_iv:
            iv_rank = ((current_iv - min_iv) / (max_iv - min_iv)) * 100
        else:
            iv_rank = 50.0
        
        # IV Percentile: What % of days had lower IV?
        lower_count = sum(1 for iv in iv_history if iv < current_iv)
        iv_percentile = (lower_count / len(iv_history)) * 100
        
        return max(0, min(100, iv_rank)), max(0, min(100, iv_percentile))
    
    def _classify_vol_regime(self, iv_rank: float) -> VolatilityRegime:
        """Classify volatility regime based on IV rank."""
        if iv_rank < 20:
            return VolatilityRegime.LOW
        elif iv_rank > 80:
            return VolatilityRegime.HIGH
        else:
            return VolatilityRegime.NORMAL
    
    def _compute_liquidity_score(
        self,
        avg_spread_pct: float,
        volume: float
    ) -> float:
        """Compute liquidity score (0-1)."""
        # Spread component (0-0.5)
        # Perfect: < 1%, Poor: > 10%
        spread_score = max(0, min(0.5, 0.5 * (1 - avg_spread_pct / 0.10)))
        
        # Volume component (0-0.5)
        # Perfect: > 10M, Poor: < 100K
        if volume > 0:
            volume_ratio = min(1.0, math.log10(volume) / 7)  # log10(10M) = 7
            volume_score = volume_ratio * 0.5
        else:
            volume_score = 0
        
        return spread_score + volume_score
    
    def _compute_forecast(
        self,
        prices: List[float],
        realized_vol: float,
        horizon_days: int
    ) -> PriceForecast:
        """
        Compute a simple price forecast using random walk assumption.
        
        This is a simplified forecast - in production would use
        more sophisticated models.
        """
        last_price = prices[-1]
        
        # Adjust volatility for horizon
        horizon_vol = realized_vol * math.sqrt(horizon_days / 252)
        
        # Drift (use recent trend as weak prior)
        if len(prices) >= 20:
            recent_return = (prices[-1] / prices[-20]) - 1
            daily_drift = recent_return / 20
        else:
            daily_drift = 0
        
        expected_return = daily_drift * horizon_days
        
        # Compute percentile returns assuming normal distribution
        p10_return = expected_return - 1.28 * horizon_vol
        p50_return = expected_return
        p90_return = expected_return + 1.28 * horizon_vol
        
        # Confidence based on data quality and regime stability
        confidence = min(0.8, 0.5 + (len(prices) / 200))
        
        return PriceForecast(
            horizon_days=horizon_days,
            p10_return=p10_return,
            p50_return=p50_return,
            p90_return=p90_return,
            volatility_forecast=realized_vol,
            confidence=confidence,
        )
    
    def _assess_data_quality(
        self,
        price_count: int,
        iv_history: Optional[List[float]],
        volume: float
    ) -> float:
        """Assess quality of input data (0-1)."""
        quality = 0.0
        
        # Price history depth
        if price_count >= 60:
            quality += 0.4
        elif price_count >= 20:
            quality += 0.3
        elif price_count >= 5:
            quality += 0.2
        
        # IV history availability
        if iv_history and len(iv_history) >= 252:
            quality += 0.3
        elif iv_history and len(iv_history) >= 60:
            quality += 0.2
        
        # Volume (liquidity proxy)
        if volume > 1_000_000:
            quality += 0.3
        elif volume > 100_000:
            quality += 0.2
        
        return min(1.0, quality)
    
    def compute_market_regime(
        self,
        spy_prices: List[float],
        vix_level: float
    ) -> MarketRegime:
        """Compute overall market regime."""
        spy_trend, _ = self._compute_trend(spy_prices)
        
        # VIX regime classification
        if vix_level < 15:
            vol_regime = VolatilityRegime.LOW
        elif vix_level > 25:
            vol_regime = VolatilityRegime.HIGH
        else:
            vol_regime = VolatilityRegime.NORMAL
        
        # Risk-on: bullish trend + normal/low vol
        risk_on = (
            spy_trend == TrendDirection.BULLISH and
            vol_regime != VolatilityRegime.HIGH
        )
        
        self._market_regime = MarketRegime(
            spy_trend=spy_trend,
            vix_level=vix_level,
            vol_regime=vol_regime,
            risk_on=risk_on,
        )
        
        return self._market_regime
    
    def get_market_regime(self) -> Optional[MarketRegime]:
        """Get the current market regime assessment."""
        return self._market_regime
    
    def update_calibration(
        self,
        symbol: str,
        forecast: PriceForecast,
        actual_return: float
    ) -> None:
        """Update forecast calibration statistics."""
        if symbol not in self.calibration_stats:
            self.calibration_stats[symbol] = {
                "total": 0,
                "in_band": 0,
                "coverage": 1.0,
            }
        
        stats = self.calibration_stats[symbol]
        stats["total"] += 1
        
        # Check if actual return was within P10-P90 band
        if forecast.p10_return <= actual_return <= forecast.p90_return:
            stats["in_band"] += 1
        
        # Update rolling coverage
        stats["coverage"] = stats["in_band"] / stats["total"]
    
    def get_calibration_adjustment(self, symbol: str) -> float:
        """
        Get calibration adjustment factor for a symbol.
        
        Returns:
            Multiplier (0-1) to apply to forecast influence.
            1.0 = well calibrated, <0.5 = poorly calibrated
        """
        if symbol not in self.calibration_stats:
            return 1.0
        
        coverage = self.calibration_stats[symbol]["coverage"]
        
        # Target 80% coverage for P10-P90 band
        # Downweight if coverage is too low (<60%) or too high (>95%)
        if coverage < 0.60:
            return coverage / 0.80  # Linear penalty
        elif coverage > 0.95:
            return 0.95  # Bands too wide
        else:
            return 1.0
