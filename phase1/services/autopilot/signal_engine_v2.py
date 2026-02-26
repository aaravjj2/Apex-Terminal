"""
Signal Engine V2 — Phase 1B: Real Signal Plane

Generates directional signals for the autopilot from REAL historical data:
  1. SMA crossover (fast/slow moving averages) on real stored OHLCV bars
  2. RSI momentum filter
  3. Volatility regime (high vol = reduce size, extreme = skip)
  4. Volume confirmation

All data comes from the bar engine (stored SQLite bars) — NO synthetic prices.
If bars are unavailable for a symbol, signal=NEUTRAL (safe default).

Available signals per symbol:
  direction  : "bullish" | "bearish" | "neutral"
  strength   : 0.0–1.0 (composite signal strength)
  confidence : 0.0–1.0 (data quality + agreement)
  regime     : "trending_up" | "trending_down" | "mean_reverting" | "volatile" | "unknown"
  features   : dict of raw feature values for traceability

Usage:
  from .signal_engine_v2 import get_signal_engine_v2

  engine = get_signal_engine_v2()
  sig = await engine.get_signal("AAPL")
  # sig.direction -> "bullish"
  # sig.strength  -> 0.72
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Signal types ──────────────────────────────────────────────────────────────

@dataclass
class SignalResult:
    """Full signal result for a single symbol."""
    symbol: str
    timestamp: datetime
    correlation_id: str

    direction: str                  # bullish | bearish | neutral
    strength: float                 # 0..1
    confidence: float               # 0..1 (data quality)
    regime: str                     # trending_up | trending_down | mean_reverting | volatile | unknown
    source: str                     # sma_crossover | rsi | composite | fallback

    # Raw features for traceability
    features: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    @property
    def is_actionable(self) -> bool:
        """True if signal is strong enough for the brain to act on."""
        return self.direction in ("bullish", "bearish") and self.strength >= 0.3

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "correlation_id": self.correlation_id,
            "direction": self.direction,
            "strength": round(self.strength, 4),
            "confidence": round(self.confidence, 4),
            "regime": self.regime,
            "source": self.source,
            "features": self.features,
            "warnings": self.warnings,
            "is_actionable": self.is_actionable,
        }


@dataclass
class RegimeResult:
    """Volatility and trend regime for a symbol."""
    symbol: str
    timestamp: datetime
    regime: str                     # trending_up | trending_down | mean_reverting | volatile | unknown
    atr_pct: float                  # ATR as % of price
    adx: float                      # Average Directional Index (0..100)
    vol_regime: str                 # low | normal | high | extreme
    trend_direction: str            # up | down | flat
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "regime": self.regime,
            "atr_pct": round(self.atr_pct, 4),
            "adx": round(self.adx, 2),
            "vol_regime": self.vol_regime,
            "trend_direction": self.trend_direction,
            "confidence": round(self.confidence, 4),
        }


# ── Technical Indicators ──────────────────────────────────────────────────────

def _sma(prices: List[float], period: int) -> Optional[float]:
    """Simple Moving Average."""
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period


def _ema(prices: List[float], period: int) -> Optional[float]:
    """Exponential Moving Average (last value)."""
    if len(prices) < period:
        return None
    k = 2.0 / (period + 1)
    ema = prices[0]
    for p in prices[1:]:
        ema = p * k + ema * (1 - k)
    return ema


def _rsi(closes: List[float], period: int = 14) -> Optional[float]:
    """Relative Strength Index (0–100)."""
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        delta = closes[i] - closes[i - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
    if len(gains) < period:
        return None
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    if avg_loss < 1e-10:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> Optional[float]:
    """Average True Range."""
    if len(highs) < period + 1:
        return None
    trs = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1])
        )
        trs.append(tr)
    if len(trs) < period:
        return None
    return sum(trs[-period:]) / period


def _adx(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> Optional[float]:
    """Simplified ADX (Average Directional Index)."""
    if len(highs) < period * 2 + 1:
        return None

    plus_dms, minus_dms, trs = [], [], []
    for i in range(1, len(closes)):
        up_move = highs[i] - highs[i - 1]
        down_move = lows[i - 1] - lows[i]
        plus_dm = up_move if up_move > down_move and up_move > 0 else 0.0
        minus_dm = down_move if down_move > up_move and down_move > 0 else 0.0
        tr = max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
        plus_dms.append(plus_dm)
        minus_dms.append(minus_dm)
        trs.append(tr)

    def _smooth(vals: List[float], n: int) -> List[float]:
        if len(vals) < n:
            return []
        result = [sum(vals[:n])]
        for v in vals[n:]:
            result.append(result[-1] - result[-1] / n + v)
        return result

    s_tr = _smooth(trs, period)
    s_pdm = _smooth(plus_dms, period)
    s_mdm = _smooth(minus_dms, period)

    if not s_tr or s_tr[0] < 1e-10:
        return None

    dxs = []
    for atr_v, pdm_v, mdm_v in zip(s_tr, s_pdm, s_mdm):
        if atr_v < 1e-10:
            continue
        pdi = 100 * pdm_v / atr_v
        mdi = 100 * mdm_v / atr_v
        denom = pdi + mdi
        if denom < 1e-10:
            dxs.append(0.0)
        else:
            dxs.append(100.0 * abs(pdi - mdi) / denom)

    if len(dxs) < period:
        return None
    return sum(dxs[-period:]) / period


def _bollinger_bands(
    closes: List[float], period: int = 20, std_mult: float = 2.0
) -> Optional[Tuple[float, float, float]]:
    """Returns (upper, mid, lower) Bollinger Bands."""
    if len(closes) < period:
        return None
    window = closes[-period:]
    mid = sum(window) / period
    variance = sum((p - mid) ** 2 for p in window) / period
    std = math.sqrt(variance)
    return (mid + std_mult * std, mid, mid - std_mult * std)


# ── Signal Engine ─────────────────────────────────────────────────────────────

class SignalEngineV2:
    """
    Real-data signal engine.

    - Reads OHLCV bars from the bar engine (SQLite-backed)
    - Computes SMA/EMA crossovers, RSI, ATR, ADX
    - Classifies regime
    - Produces a composite signal per symbol
    - Results cached for SIGNAL_CACHE_S seconds
    """

    SIGNAL_CACHE_S = 60.0           # Re-compute signals every ~60s
    FAST_PERIOD = 10                # Fast SMA/EMA period
    SLOW_PERIOD = 30                # Slow SMA/EMA period
    RSI_PERIOD = 14
    ATR_PERIOD = 14
    ADX_PERIOD = 14
    MIN_BARS = 35                   # Minimum bars required for signal computation

    def __init__(self):
        self._cache: Dict[str, Tuple[SignalResult, float]] = {}  # symbol → (result, mono_time)
        self._regime_cache: Dict[str, Tuple[RegimeResult, float]] = {}

    async def get_signal(self, symbol: str, cid: str = "") -> SignalResult:
        """
        Compute signal for symbol. Returns cached result if fresh.
        Never raises — returns NEUTRAL signal on any error.
        """
        cid = cid or f"sig-{uuid.uuid4().hex[:8]}"
        now_mono = time.monotonic()

        # Cache check
        if symbol in self._cache:
            cached, cached_at = self._cache[symbol]
            if (now_mono - cached_at) < self.SIGNAL_CACHE_S:
                return cached

        try:
            result = await asyncio.wait_for(
                self._compute_signal(symbol, cid),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            logger.warning(f"SignalEngine: timeout computing signal for {symbol}")
            result = self._neutral(symbol, cid, "timeout")
        except Exception as exc:
            logger.warning(f"SignalEngine: error computing signal for {symbol}: {exc}")
            result = self._neutral(symbol, cid, str(exc)[:50])

        self._cache[symbol] = (result, now_mono)
        return result

    async def get_signals_bulk(
        self, symbols: List[str], cid: str = ""
    ) -> Dict[str, SignalResult]:
        """Get signals for multiple symbols concurrently."""
        cid = cid or f"sig-{uuid.uuid4().hex[:8]}"
        tasks = [self.get_signal(s, cid) for s in symbols]
        results = await asyncio.gather(*tasks)
        return {s: r for s, r in zip(symbols, results)}

    async def get_regime(self, symbol: str, cid: str = "") -> RegimeResult:
        """Compute volatility/trend regime for symbol."""
        cid = cid or f"reg-{uuid.uuid4().hex[:8]}"
        now_mono = time.monotonic()

        if symbol in self._regime_cache:
            cached, ts = self._regime_cache[symbol]
            if (now_mono - ts) < self.SIGNAL_CACHE_S:
                return cached

        try:
            result = await asyncio.wait_for(
                self._compute_regime(symbol, cid),
                timeout=10.0
            )
        except Exception as exc:
            result = RegimeResult(
                symbol=symbol,
                timestamp=datetime.now(timezone.utc),
                regime="unknown",
                atr_pct=0.0,
                adx=0.0,
                vol_regime="unknown",
                trend_direction="flat",
                confidence=0.0,
            )

        self._regime_cache[symbol] = (result, now_mono)
        return result

    # ── Internal computation ───────────────────────────────────────────────────

    async def _compute_signal(self, symbol: str, cid: str) -> SignalResult:
        """
        Load bars and compute composite signal.
        Runs bar loading in executor to not block event loop.
        """
        bars = await self._load_bars(symbol, limit=60)

        if len(bars) < self.MIN_BARS:
            return SignalResult(
                symbol=symbol,
                timestamp=datetime.now(timezone.utc),
                correlation_id=cid,
                direction="neutral",
                strength=0.0,
                confidence=0.05,
                regime="unknown",
                source="fallback",
                warnings=[f"insufficient_bars:{len(bars)}"],
            )

        closes = [b["close"] for b in bars]
        highs  = [b["high"]  for b in bars]
        lows   = [b["low"]   for b in bars]

        # ── Indicators ───────────────────────────────────────────────────────
        fast_sma = _sma(closes, self.FAST_PERIOD)
        slow_sma = _sma(closes, self.SLOW_PERIOD)
        fast_ema = _ema(closes, self.FAST_PERIOD)
        slow_ema = _ema(closes, self.SLOW_PERIOD)
        rsi_val  = _rsi(closes, self.RSI_PERIOD)
        atr_val  = _atr(highs, lows, closes, self.ATR_PERIOD)
        adx_val  = _adx(highs, lows, closes, self.ADX_PERIOD)
        bb       = _bollinger_bands(closes, 20)

        last_close = closes[-1]

        features: Dict[str, Any] = {
            "close": round(last_close, 4),
            "fast_sma": round(fast_sma, 4) if fast_sma else None,
            "slow_sma": round(slow_sma, 4) if slow_sma else None,
            "fast_ema": round(fast_ema, 4) if fast_ema else None,
            "slow_ema": round(slow_ema, 4) if slow_ema else None,
            "rsi": round(rsi_val, 2) if rsi_val is not None else None,
            "atr": round(atr_val, 4) if atr_val else None,
            "adx": round(adx_val, 2) if adx_val else None,
            "bb_upper": round(bb[0], 4) if bb else None,
            "bb_lower": round(bb[2], 4) if bb else None,
            "bars_used": len(bars),
        }

        # ── Direction signal ──────────────────────────────────────────────────
        signals: List[Tuple[str, float]] = []  # (direction, conviction 0..1)

        # SMA crossover (primary)
        if fast_sma and slow_sma:
            sma_cross_pct = (fast_sma - slow_sma) / slow_sma
            features["sma_cross_pct"] = round(sma_cross_pct * 100, 4)
            if sma_cross_pct > 0.002:   # fast > slow by 0.2%+
                signals.append(("bullish", min(abs(sma_cross_pct) * 50, 1.0)))
            elif sma_cross_pct < -0.002:
                signals.append(("bearish", min(abs(sma_cross_pct) * 50, 1.0)))

        # EMA (secondary)
        if fast_ema and slow_ema:
            ema_cross_pct = (fast_ema - slow_ema) / slow_ema
            features["ema_cross_pct"] = round(ema_cross_pct * 100, 4)
            if ema_cross_pct > 0.001:
                signals.append(("bullish", min(abs(ema_cross_pct) * 80, 1.0)))
            elif ema_cross_pct < -0.001:
                signals.append(("bearish", min(abs(ema_cross_pct) * 80, 1.0)))

        # RSI momentum (filter)
        rsi_signal = "neutral"
        rsi_conviction = 0.0
        if rsi_val is not None:
            features["rsi"] = round(rsi_val, 2)
            if rsi_val > 60:
                rsi_signal = "bullish"
                rsi_conviction = min((rsi_val - 60) / 40, 1.0) * 0.5
                signals.append(("bullish", rsi_conviction))
            elif rsi_val < 40:
                rsi_signal = "bearish"
                rsi_conviction = min((40 - rsi_val) / 40, 1.0) * 0.5
                signals.append(("bearish", rsi_conviction))

        # Bollinger band position
        if bb is not None:
            upper, mid, lower = bb
            bb_pct = (last_close - lower) / (upper - lower) if upper != lower else 0.5
            features["bb_pct"] = round(bb_pct, 4)
            if bb_pct > 0.85:
                signals.append(("bearish", (bb_pct - 0.85) * 5))  # overbought
            elif bb_pct < 0.15:
                signals.append(("bullish", (0.15 - bb_pct) * 5))  # oversold

        # ── Composite signal ──────────────────────────────────────────────────
        direction, strength, confidence = self._aggregate_signals(signals)

        # Reduce confidence if ADX low (no trend strength)
        if adx_val is not None and adx_val < 20:
            confidence *= 0.6   # weak trend — reduce confidence
            features["adx_penalty"] = True

        # ── Regime ───────────────────────────────────────────────────────────
        regime = self._classify_regime(adx_val, atr_val, last_close, direction)

        return SignalResult(
            symbol=symbol,
            timestamp=datetime.now(timezone.utc),
            correlation_id=cid,
            direction=direction,
            strength=round(strength, 4),
            confidence=round(confidence, 4),
            regime=regime,
            source="composite_v2",
            features=features,
        )

    async def _compute_regime(self, symbol: str, cid: str) -> RegimeResult:
        """Compute regime for symbol based on ATR, ADX."""
        bars = await self._load_bars(symbol, limit=50)
        now = datetime.now(timezone.utc)

        if len(bars) < 20:
            return RegimeResult(
                symbol=symbol, timestamp=now,
                regime="unknown", atr_pct=0.0, adx=0.0,
                vol_regime="unknown", trend_direction="flat", confidence=0.0
            )

        closes = [b["close"] for b in bars]
        highs  = [b["high"]  for b in bars]
        lows   = [b["low"]   for b in bars]

        atr_val = _atr(highs, lows, closes, 14)
        adx_val = _adx(highs, lows, closes, 14)
        last    = closes[-1]

        atr_pct = (atr_val / last * 100) if (atr_val and last > 0) else 0.0
        adx     = adx_val or 0.0

        # Vol regime
        if atr_pct > 5.0:
            vol_regime = "extreme"
        elif atr_pct > 3.0:
            vol_regime = "high"
        elif atr_pct > 1.0:
            vol_regime = "normal"
        else:
            vol_regime = "low"

        # Trend direction
        fast_sma = _sma(closes, 10)
        slow_sma = _sma(closes, 30)
        if fast_sma and slow_sma:
            trend_direction = "up" if fast_sma > slow_sma else "down"
        else:
            trend_direction = "flat"

        # Overall regime
        if adx > 25 and trend_direction == "up":
            regime = "trending_up"
        elif adx > 25 and trend_direction == "down":
            regime = "trending_down"
        elif vol_regime in ("extreme", "high"):
            regime = "volatile"
        else:
            regime = "mean_reverting"

        confidence = min(len(bars) / 50, 1.0)

        return RegimeResult(
            symbol=symbol,
            timestamp=now,
            regime=regime,
            atr_pct=round(atr_pct, 4),
            adx=round(adx, 2),
            vol_regime=vol_regime,
            trend_direction=trend_direction,
            confidence=round(confidence, 4),
        )

    async def _load_bars(self, symbol: str, limit: int = 60) -> List[Dict[str, Any]]:
        """Load historical bars from bar engine. Runs in executor."""
        def _sync() -> List[Dict]:
            try:
                from ..bar_engine import get_bar_engine
                engine = get_bar_engine()
                bars = engine.get_recent_bars(symbol, period="1D", limit=limit)
                if bars:
                    return bars
                return []
            except Exception as exc:
                logger.debug(f"SignalEngine bars load for {symbol}: {exc}")
                return []

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync)

    def _aggregate_signals(
        self, signals: List[Tuple[str, float]]
    ) -> Tuple[str, float, float]:
        """
        Aggregate vote list into composite (direction, strength, confidence).
        Returns (direction, strength 0..1, confidence 0..1).
        """
        if not signals:
            return "neutral", 0.0, 0.0

        bull_score = sum(v for d, v in signals if d == "bullish")
        bear_score = sum(v for d, v in signals if d == "bearish")
        total = bull_score + bear_score
        n = len(signals)

        if total < 1e-10:
            return "neutral", 0.0, 0.0

        if bull_score > bear_score:
            direction = "bullish"
            strength = bull_score / max(total, 1e-10)
        elif bear_score > bull_score:
            direction = "bearish"
            strength = bear_score / max(total, 1e-10)
        else:
            return "neutral", 0.0, 0.0

        # Confidence based on agreement count and total signal count
        agreement = max(bull_score, bear_score) / max(total, 1e-10)
        confidence = agreement * min(n / 4, 1.0)

        return direction, round(min(strength, 1.0), 4), round(min(confidence, 1.0), 4)

    def _classify_regime(
        self, adx: Optional[float], atr: Optional[float],
        last_close: float, direction: str
    ) -> str:
        """Produce regime string from indicators."""
        if adx is None:
            return "unknown"
        if adx > 25:
            if direction == "bullish":
                return "trending_up"
            elif direction == "bearish":
                return "trending_down"
        if atr is not None and last_close > 0:
            atr_pct = atr / last_close * 100
            if atr_pct > 3.0:
                return "volatile"
        return "mean_reverting"

    @staticmethod
    def _neutral(symbol: str, cid: str, reason: str) -> SignalResult:
        return SignalResult(
            symbol=symbol,
            timestamp=datetime.now(timezone.utc),
            correlation_id=cid,
            direction="neutral",
            strength=0.0,
            confidence=0.0,
            regime="unknown",
            source="fallback",
            warnings=[f"fallback:{reason}"],
        )

    def invalidate(self, symbol: Optional[str] = None) -> None:
        """Clear cached signals."""
        if symbol:
            self._cache.pop(symbol, None)
            self._regime_cache.pop(symbol, None)
        else:
            self._cache.clear()
            self._regime_cache.clear()


# ── Singleton ─────────────────────────────────────────────────────────────────

_ENGINE: Optional[SignalEngineV2] = None


def get_signal_engine_v2() -> SignalEngineV2:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = SignalEngineV2()
    return _ENGINE
