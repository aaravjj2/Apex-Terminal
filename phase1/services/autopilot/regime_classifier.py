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


# ─────────────────────────────────────────────────────────────────────────────
# MARKET REGIME CLASSIFIER  (Phase 1B: live VIX + SPY)
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
import time

# VIX thresholds
_VIX_CALM = 15.0
_VIX_NORMAL = 20.0
_VIX_ELEVATED = 25.0
_VIX_STRESSED = 35.0
_VIX_CRISIS = 40.0

# SMA thresholds
_BULL_SMA_MARGIN = 0.02
_BEAR_SMA_MARGIN = -0.03

# Cache TTL
_MARKET_REGIME_TTL = 300  # 5 minutes


class LiveMarketRegime:
    """
    Represents the current live market-wide regime.

    This is derived from VIX (fear gauge) + SPY (trend proxy).
    Used by the unified engine instead of the hardcoded "neutral".
    """

    BULL = "bull"
    BEAR = "bear"
    NEUTRAL = "neutral"
    VOLATILE = "volatile"
    CHAOS = "chaos"
    UNKNOWN = "unknown"

    # Which regimes allow new entries
    ENTRY_ALLOWED = {BULL, BEAR, NEUTRAL}

    def __init__(
        self,
        label: str,
        confidence: float,
        vix_level: Optional[float],
        spy_price: Optional[float],
        spy_vs_sma200: Optional[float],
        spy_return_21d: Optional[float],
        realized_vol: Optional[float],
        reasons: List[str],
        from_cache: bool = False,
    ):
        self.label = label
        self.confidence = confidence
        self.vix_level = vix_level
        self.spy_price = spy_price
        self.spy_vs_sma200 = spy_vs_sma200
        self.spy_return_21d = spy_return_21d
        self.realized_vol = realized_vol
        self.reasons = reasons
        self.from_cache = from_cache
        self.timestamp = datetime.utcnow()

    @property
    def allows_entries(self) -> bool:
        return self.label in self.ENTRY_ALLOWED

    @property
    def sizing_multiplier(self) -> float:
        return {
            self.BULL: 1.0,
            self.NEUTRAL: 0.8,
            self.BEAR: 0.6,
            self.VOLATILE: 0.4,
            self.CHAOS: 0.0,
            self.UNKNOWN: 0.5,
        }.get(self.label, 0.5)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "regime": self.label,
            "confidence": round(self.confidence, 3),
            "allows_entries": self.allows_entries,
            "sizing_multiplier": self.sizing_multiplier,
            "vix_level": round(self.vix_level, 2) if self.vix_level else None,
            "spy_price": round(self.spy_price, 2) if self.spy_price else None,
            "spy_vs_sma200_pct": round(self.spy_vs_sma200 * 100, 2) if self.spy_vs_sma200 else None,
            "spy_return_21d_pct": round(self.spy_return_21d * 100, 2) if self.spy_return_21d else None,
            "realized_vol_pct": round(self.realized_vol * 100, 2) if self.realized_vol else None,
            "reasons": self.reasons,
            "from_cache": self.from_cache,
            "timestamp": self.timestamp.isoformat(),
        }


class LiveMarketRegimeClassifier:
    """
    Classifies market-wide regime from live VIX + SPY data.

    Replaces the `regime: "neutral"  # TODO` in unified_engine._refresh_market_data().
    """

    def __init__(self):
        self._cache: Optional[tuple] = None  # (monotonic_ts, LiveMarketRegime)

    def _is_cache_valid(self) -> bool:
        if not self._cache:
            return False
        ts, _ = self._cache
        return (time.monotonic() - ts) < _MARKET_REGIME_TTL

    def _sma(self, prices: List[float], n: int) -> Optional[float]:
        if len(prices) < n:
            return None
        return sum(prices[-n:]) / n

    def _rvol(self, prices: List[float], n: int = 20) -> Optional[float]:
        if len(prices) < n + 1:
            return None
        import math
        rets = []
        for i in range(-n, 0):
            p, c = prices[i - 1], prices[i]
            if p > 0:
                rets.append(math.log(c / p))
        if not rets:
            return None
        mean = sum(rets) / len(rets)
        var = sum((r - mean) ** 2 for r in rets) / len(rets)
        return math.sqrt(var) * math.sqrt(252)

    def classify_sync(self) -> LiveMarketRegime:
        """Synchronous classification. Blocks on yFinance calls."""
        if self._is_cache_valid():
            _, cached = self._cache
            cached.from_cache = True
            return cached

        try:
            import yfinance as yf

            # Fetch SPY 1-year + VIX current
            spy_t = yf.Ticker("SPY")
            vix_t = yf.Ticker("^VIX")

            spy_hist = spy_t.history(period="1y")
            vix_info = vix_t.fast_info
            vix_hist = vix_t.history(period="2mo")

            if spy_hist.empty or len(spy_hist) < 21:
                raise ValueError("Insufficient SPY history")

            closes = spy_hist["Close"].tolist()
            spy_price = closes[-1]

            # VIX
            vix_level = None
            try:
                vix_level = float(
                    getattr(vix_info, "last_price", None) or
                    getattr(vix_info, "regularMarketPrice", None) or
                    (vix_hist["Close"].iloc[-1] if not vix_hist.empty else 20.0)
                )
            except Exception:
                vix_level = 20.0

            # Signals
            sma200 = self._sma(closes, 200)
            rvol = self._rvol(closes, 20)

            spy_vs_sma = ((spy_price - sma200) / sma200) if sma200 else 0.0
            ret_1d = ((closes[-1] - closes[-2]) / closes[-2]) if len(closes) >= 2 else 0.0
            ret_21d = ((closes[-1] - closes[-22]) / closes[-22]) if len(closes) >= 22 else 0.0

            # Classification
            reasons: List[str] = []
            regime = LiveMarketRegime.NEUTRAL
            confidence = 0.5

            # CHAOS
            if (vix_level and vix_level > _VIX_CRISIS) or ret_1d < -0.08:
                reasons.append(
                    f"VIX={vix_level:.1f} CRISIS" if vix_level and vix_level > _VIX_CRISIS
                    else f"SPY crashed {ret_1d*100:.1f}%"
                )
                regime = LiveMarketRegime.CHAOS
                confidence = 0.9
            # VOLATILE
            elif (vix_level and vix_level > _VIX_STRESSED) or (rvol and rvol > 0.28):
                reasons.append(f"VIX={vix_level:.1f} stressed" if vix_level else f"RVol={rvol*100:.0f}%")
                regime = LiveMarketRegime.VOLATILE
                confidence = 0.75
            # BULL
            elif spy_vs_sma > _BULL_SMA_MARGIN and (not vix_level or vix_level < _VIX_NORMAL) and ret_21d > 0.03:
                reasons.append(f"SPY {spy_vs_sma*100:.1f}% above SMA200, VIX={vix_level:.1f}, +{ret_21d*100:.1f}% 21d")
                regime = LiveMarketRegime.BULL
                confidence = 0.75
            # BEAR
            elif spy_vs_sma < _BEAR_SMA_MARGIN and ret_21d < -0.03:
                reasons.append(f"SPY {spy_vs_sma*100:.1f}% below SMA200, {ret_21d*100:.1f}% 21d")
                regime = LiveMarketRegime.BEAR
                confidence = 0.70
            # NEUTRAL
            else:
                reasons.append(
                    f"SPY {spy_vs_sma*100:.1f}% vs SMA200, VIX={vix_level:.1f}, 21d={ret_21d*100:.1f}%"
                )
                regime = LiveMarketRegime.NEUTRAL
                confidence = 0.60

            result = LiveMarketRegime(
                label=regime,
                confidence=confidence,
                vix_level=vix_level,
                spy_price=spy_price,
                spy_vs_sma200=spy_vs_sma,
                spy_return_21d=ret_21d,
                realized_vol=rvol,
                reasons=reasons,
            )
            self._cache = (time.monotonic(), result)
            logger.info(
                f"LiveMarketRegimeClassifier: regime={regime} "
                f"confidence={confidence:.2f} VIX={vix_level} SPY={spy_price:.2f} "
                f"vs_sma200={spy_vs_sma*100:.1f}%"
            )
            return result

        except Exception as exc:
            logger.error(f"LiveMarketRegimeClassifier failed: {exc}")
            fallback = LiveMarketRegime(
                label=LiveMarketRegime.NEUTRAL,
                confidence=0.2,
                vix_level=None,
                spy_price=None,
                spy_vs_sma200=None,
                spy_return_21d=None,
                realized_vol=None,
                reasons=[f"Data error: {exc}"],
            )
            return fallback

    async def classify_async(self) -> LiveMarketRegime:
        """Async wrapper — runs in thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.classify_sync)

    def get_cached(self) -> Optional[LiveMarketRegime]:
        if self._is_cache_valid():
            _, r = self._cache
            return r
        return None

    def invalidate(self) -> None:
        self._cache = None


# Singleton
_live_market_classifier: Optional[LiveMarketRegimeClassifier] = None


def get_live_regime_classifier() -> LiveMarketRegimeClassifier:
    global _live_market_classifier
    if _live_market_classifier is None:
        _live_market_classifier = LiveMarketRegimeClassifier()
    return _live_market_classifier


async def classify_live_market() -> LiveMarketRegime:
    """Convenience shortcut — get the current live market regime."""
    clf = get_live_regime_classifier()
    return await clf.classify_async()
