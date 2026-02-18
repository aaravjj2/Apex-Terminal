"""
Regime Classifier (Milestone 2)

Computes market regime from OHLCV data:
- TREND_UP: Strong upward momentum
- TREND_DOWN: Strong downward momentum  
- RANGE: Sideways, low directional bias
- CHAOS: High volatility, unpredictable

Features used:
1. MA Slope (20/50 period)
2. ADX-like directional strength
3. Realized volatility (intraday range)
4. Trend consistency score
"""

import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
import math

logger = logging.getLogger(__name__)

class MarketRegime(str, Enum):
    """Market regime classifications."""
    TREND_UP = "trend_up"
    TREND_DOWN = "trend_down"
    RANGE = "range"
    CHAOS = "chaos"
    UNKNOWN = "unknown"

@dataclass
class RegimeFeatures:
    """Features computed for regime classification."""
    symbol: str
    timestamp: datetime
    
    # Trend features
    ma_20: float = 0.0
    ma_50: float = 0.0
    ma_slope_20: float = 0.0  # Slope of MA20 over last N bars
    ma_slope_50: float = 0.0
    trend_strength: float = 0.0  # 0-1, higher = stronger trend
    
    # Volatility features
    realized_vol: float = 0.0  # Annualized realized volatility
    atr_pct: float = 0.0  # ATR as % of price
    range_expansion: float = 0.0  # Current range vs average
    
    # Directional features
    adx_proxy: float = 0.0  # 0-100, directional strength
    price_vs_ma20: float = 0.0  # % above/below MA20
    
    # Consistency
    up_bars_pct: float = 0.0  # % of bars that were up
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "ma_20": self.ma_20,
            "ma_50": self.ma_50,
            "ma_slope_20": self.ma_slope_20,
            "trend_strength": self.trend_strength,
            "realized_vol": self.realized_vol,
            "atr_pct": self.atr_pct,
            "adx_proxy": self.adx_proxy,
            "price_vs_ma20": self.price_vs_ma20,
        }

@dataclass
class RegimeResult:
    """Result of regime classification."""
    symbol: str
    regime: MarketRegime
    confidence: float  # 0-1
    features: RegimeFeatures
    timestamp: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "regime": self.regime.value,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat(),
            "features": self.features.to_dict(),
        }

from .ml_regime_adapter import MLRegimeAdapter

class RegimeClassifier:
    """
    Deterministic regime classifier.
    
    All logic is reproducible from inputs - no randomness.
    """
    
    # Thresholds (tunable)
    TREND_ADX_THRESHOLD = 25.0  # ADX > 25 = trending
    RANGE_ADX_THRESHOLD = 20.0  # ADX < 20 = ranging
    CHAOS_VOL_THRESHOLD = 0.40  # Annualized vol > 40% = chaos
    MA_SLOPE_THRESHOLD = 0.001  # Minimum slope for trend
    
    def __init__(self, lookback_bars: int = 20):
        self.lookback = lookback_bars
        self._cache: Dict[str, RegimeResult] = {}
        # Hybrid ML Adapter
        self.ml_adapter = MLRegimeAdapter()
    
    def classify(
        self,
        symbol: str,
        bars: List[Dict[str, Any]],  # List of OHLCV dicts
        timestamp: Optional[datetime] = None,
    ) -> RegimeResult:
        """
        Classify regime from bar data.
        
        Args:
            symbol: Ticker symbol
            bars: List of OHLCV bars (oldest first)
            timestamp: Classification timestamp
            
        Returns:
            RegimeResult with classification and features
        """
        if len(bars) < self.lookback:
            return RegimeResult(
                symbol=symbol,
                regime=MarketRegime.UNKNOWN,
                confidence=0.0,
                features=RegimeFeatures(symbol=symbol, timestamp=timestamp or datetime.utcnow()),
                timestamp=timestamp or datetime.utcnow(),
            )
        
        # Extract price series
        closes = [b.get("close", b.get("c", 0)) for b in bars]
        highs = [b.get("high", b.get("h", 0)) for b in bars]
        lows = [b.get("low", b.get("l", 0)) for b in bars]
        
        # Compute features
        features = self._compute_features(symbol, closes, highs, lows, timestamp)
        
        # Classify based on features
        regime, confidence = self._classify_from_features(features)

        # -----------------------------------------------------
        # Hybrid Logic: Apply ML 4D Lattice Overrides
        # -----------------------------------------------------
        if hasattr(self, 'ml_adapter'):
            lattice = self.ml_adapter.predict_lattice_state(bars)
            
            # Risk Off Override: If ML says Risk Off (Vol=1), cap confidence or force Chaos
            if lattice.vol_regime == 1:
                if regime in [MarketRegime.TREND_UP, MarketRegime.TREND_DOWN]:
                    # Downgrade Trend to Range or Chaos based on severity
                    regime = MarketRegime.CHAOS
                    confidence = 0.6  # High confidence in chaos
            
            # Trend Quality Boost: If ML says Robust Trend (Quality=1), boost confidence
            if lattice.trend_quality == 1 and regime in [MarketRegime.TREND_UP, MarketRegime.TREND_DOWN]:
                confidence = min(1.0, confidence + 0.2)
                
            # Liquidity Stress: If Stressed, force lower confidence
            if lattice.liquidity_stress == 1:
                confidence *= 0.8
                
            # Info State: If Drifting (Momentum without conviction), slight penalty
            if lattice.info_state == 1:
                confidence *= 0.9
        
        result = RegimeResult(
            symbol=symbol,
            regime=regime,
            confidence=confidence,
            features=features,
            timestamp=timestamp or datetime.utcnow(),
        )
        
        self._cache[symbol] = result
        return result
    
    def _compute_features(
        self,
        symbol: str,
        closes: List[float],
        highs: List[float],
        lows: List[float],
        timestamp: Optional[datetime],
    ) -> RegimeFeatures:
        """Compute all features from price data."""
        n = len(closes)
        
        # Moving averages
        ma_20 = sum(closes[-20:]) / min(20, n) if n >= 1 else 0
        ma_50 = sum(closes[-50:]) / min(50, n) if n >= 1 else 0
        
        # MA slopes (linear regression slope)
        ma_slope_20 = self._compute_slope(closes[-20:]) if n >= 20 else 0
        ma_slope_50 = self._compute_slope(closes[-50:]) if n >= 50 else 0
        
        # Current price vs MA20
        current_price = closes[-1] if closes else 0
        price_vs_ma20 = (current_price - ma_20) / ma_20 * 100 if ma_20 > 0 else 0
        
        # ATR and volatility
        atr = self._compute_atr(highs, lows, closes)
        atr_pct = atr / current_price * 100 if current_price > 0 else 0
        
        # Realized volatility (annualized)
        returns = [(closes[i] - closes[i-1]) / closes[i-1] 
                   for i in range(1, len(closes)) if closes[i-1] > 0]
        if returns:
            std_daily = (sum(r**2 for r in returns) / len(returns)) ** 0.5
            realized_vol = std_daily * (252 ** 0.5)  # Annualize
        else:
            realized_vol = 0
        
        # ADX proxy (simplified directional strength)
        adx_proxy = self._compute_adx_proxy(highs, lows, closes)
        
        # Trend strength (combination of slope and consistency)
        up_bars = sum(1 for i in range(1, len(closes)) if closes[i] > closes[i-1])
        up_bars_pct = up_bars / (len(closes) - 1) if len(closes) > 1 else 0.5
        
        # Trend strength: slope magnitude * directional consistency
        slope_magnitude = abs(ma_slope_20) / (current_price * 0.01) if current_price > 0 else 0
        consistency = abs(up_bars_pct - 0.5) * 2  # 0 = random, 1 = all same direction
        trend_strength = min(1.0, slope_magnitude * (1 + consistency))
        
        # Range Expansion: Current True Range / ATR
        # Identifies volatility breakouts
        range_expansion = 0.0
        if atr > 0 and len(closes) >= 2:
            current_tr = max(
                highs[-1] - lows[-1],
                abs(highs[-1] - closes[-2]),
                abs(lows[-1] - closes[-2])
            )
            range_expansion = current_tr / atr
        elif atr > 0:
             range_expansion = (highs[-1] - lows[-1]) / atr
        
        
        return RegimeFeatures(
            symbol=symbol,
            timestamp=timestamp or datetime.utcnow(),
            ma_20=ma_20,
            ma_50=ma_50,
            ma_slope_20=ma_slope_20,
            ma_slope_50=ma_slope_50,
            trend_strength=trend_strength,
            realized_vol=realized_vol,
            atr_pct=atr_pct,
            range_expansion=range_expansion,
            adx_proxy=adx_proxy,
            price_vs_ma20=price_vs_ma20,
            up_bars_pct=up_bars_pct,
        )

    def _classify_from_features(self, f: RegimeFeatures) -> tuple:
        """Classify regime from computed features."""
        
        # Check for CHAOS first (high vol overrides everything)
        if f.realized_vol > self.CHAOS_VOL_THRESHOLD:
            return MarketRegime.CHAOS, 0.8
        
        # Check for extreme expansion (Breakout/Chaos pre-cursor)
        if f.range_expansion > 3.0:
            # Huge expansion often means chaos or climactic top/bottom
            # But if ADX is high, it supports trend.
            # For now, treat extreme expansion as lower confidence regime
            pass

        # Check ADX for trend vs range
        if f.adx_proxy > self.TREND_ADX_THRESHOLD:
            # Trending - determine direction
            if f.ma_slope_20 > self.MA_SLOPE_THRESHOLD and f.price_vs_ma20 > 0:
                confidence = min(1.0, f.adx_proxy / 50)
                return MarketRegime.TREND_UP, confidence
            elif f.ma_slope_20 < -self.MA_SLOPE_THRESHOLD and f.price_vs_ma20 < 0:
                confidence = min(1.0, f.adx_proxy / 50)
                return MarketRegime.TREND_DOWN, confidence
        
        if f.adx_proxy < self.RANGE_ADX_THRESHOLD:
            # Ranging
            confidence = 1.0 - (f.adx_proxy / self.RANGE_ADX_THRESHOLD)
            return MarketRegime.RANGE, confidence
        
        # Weak trend or transition - classify by direction but lower confidence
        if f.ma_slope_20 > 0:
            return MarketRegime.TREND_UP, 0.5
        elif f.ma_slope_20 < 0:
            return MarketRegime.TREND_DOWN, 0.5
        # Neutral (slope == 0) - treat as range
        return MarketRegime.RANGE, 0.3
    
    def _compute_slope(self, prices: List[float]) -> float:
        """Compute linear regression slope."""
        if len(prices) < 2:
            return 0.0
        
        n = len(prices)
        x_mean = (n - 1) / 2
        y_mean = sum(prices) / n
        
        numerator = sum((i - x_mean) * (prices[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        
        return numerator / denominator if denominator != 0 else 0
    
    def _compute_atr(
        self,
        highs: List[float],
        lows: List[float],
        closes: List[float],
        period: int = 14,
    ) -> float:
        """Compute Average True Range."""
        if len(closes) < 2:
            return 0.0
        
        true_ranges = []
        for i in range(1, len(closes)):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i-1]),
                abs(lows[i] - closes[i-1])
            )
            true_ranges.append(tr)
        
        if not true_ranges:
            return 0.0
        
        # Simple average of last N true ranges
        recent = true_ranges[-period:]
        return sum(recent) / len(recent)
    
    def _compute_adx_proxy(
        self,
        highs: List[float],
        lows: List[float],
        closes: List[float],
        period: int = 14,
    ) -> float:
        """
        Compute simplified ADX proxy.
        
        This is a simplified version that captures directional strength
        without full Wilder smoothing.
        """
        if len(closes) < period + 1:
            return 25.0  # Default neutral
        
        # Compute +DM and -DM
        plus_dm = []
        minus_dm = []
        
        for i in range(1, len(highs)):
            up_move = highs[i] - highs[i-1]
            down_move = lows[i-1] - lows[i]
            
            if up_move > down_move and up_move > 0:
                plus_dm.append(up_move)
            else:
                plus_dm.append(0)
            
            if down_move > up_move and down_move > 0:
                minus_dm.append(down_move)
            else:
                minus_dm.append(0)
        
        if not plus_dm:
            return 25.0
        
        # Average directional movement
        avg_plus = sum(plus_dm[-period:]) / period
        avg_minus = sum(minus_dm[-period:]) / period
        
        # DX = |+DI - -DI| / |+DI + -DI| * 100
        di_sum = avg_plus + avg_minus
        if di_sum == 0:
            return 25.0
        
        dx = abs(avg_plus - avg_minus) / di_sum * 100
        
        return dx
    
    def get_cached(self, symbol: str) -> Optional[RegimeResult]:
        """Get cached regime for symbol if available."""
        return self._cache.get(symbol)
    
    def clear_cache(self):
        """Clear regime cache."""
        self._cache.clear()
