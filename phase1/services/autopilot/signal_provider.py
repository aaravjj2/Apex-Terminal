"""
Autopilot V3 Signal Provider — Directional signals from internal indicators.

Implements:
  1. SMA(20)/SMA(50) cross + RSI(14) filter on daily bars
  2. Optional integration with strategy/backtest endpoints (read-only)
  3. Regime detection: trending vs mean-reverting, vol regime

Signal output:
  - direction: 'bullish' | 'bearish' | 'neutral'
  - strength: 0.0 – 1.0
  - regime: 'trending_up' | 'trending_down' | 'ranging' | 'high_vol' | 'unknown'
  - source: 'internal_sma_rsi' | 'strategy_endpoint'
  - confidence_boost: float (added to decision confidence if aligned)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Signal Dataclass ──────────────────────────────────────────────────────────

@dataclass
class DirectionalSignal:
    symbol: str
    direction: str           # bullish | bearish | neutral
    strength: float          # 0.0 – 1.0
    regime: str              # trending_up | trending_down | ranging | high_vol | unknown
    source: str              # internal_sma_rsi | strategy_endpoint | fallback
    sma20: Optional[float] = None
    sma50: Optional[float] = None
    rsi14: Optional[float] = None
    atr_pct: Optional[float] = None     # avg true range as % of price (vol proxy)
    detail: str = ""
    timestamp: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "direction": self.direction,
            "strength": round(self.strength, 3),
            "regime": self.regime,
            "source": self.source,
            "sma20": round(self.sma20, 4) if self.sma20 else None,
            "sma50": round(self.sma50, 4) if self.sma50 else None,
            "rsi14": round(self.rsi14, 2) if self.rsi14 else None,
            "atr_pct": round(self.atr_pct, 3) if self.atr_pct else None,
            "detail": self.detail,
            "timestamp": self.timestamp,
        }

    @property
    def bias_for_options(self) -> str:
        """Return 'CALL', 'PUT', or 'NEUTRAL' for option direction selection."""
        if self.direction == "bullish":
            return "CALL"
        elif self.direction == "bearish":
            return "PUT"
        return "NEUTRAL"

    @property
    def confidence_boost(self) -> float:
        """Confidence modifier based on signal strength and direction clarity."""
        if self.direction == "neutral":
            return -0.05   # Slight penalty for neutral
        return self.strength * 0.15   # Up to +15% confidnece when strong


# ── Cache ─────────────────────────────────────────────────────────────────────

_signal_cache: Dict[str, tuple] = {}   # symbol -> (signal, ts)
_CACHE_TTL = 300  # 5 minutes


# ── Internal SMA + RSI Signal ─────────────────────────────────────────────────

async def _compute_internal_signal(symbol: str) -> DirectionalSignal:
    """
    Compute SMA20/SMA50 cross + RSI14 signal from Alpaca daily bars.
    Falls back to neutral if data unavailable.
    """
    from datetime import datetime, timedelta
    now_ts = datetime.utcnow().isoformat() + "Z"

    try:
        closes = await _fetch_daily_closes(symbol, n=60)
        if not closes or len(closes) < 50:
            return DirectionalSignal(symbol=symbol, direction="neutral", strength=0.0,
                                     regime="unknown", source="internal_fallback_no_data",
                                     detail=f"Only {len(closes) if closes else 0} daily bars available",
                                     timestamp=now_ts)

        sma20 = sum(closes[-20:]) / 20
        sma50 = sum(closes[-50:]) / 50
        rsi14 = _rsi(closes, 14)

        # ATR for vol regime
        atr_pct = None
        try:
            atr_val = _atr(closes, 14)
            atr_pct = atr_val / closes[-1] if closes[-1] > 0 else None
        except Exception:
            pass

        # Direction: SMA cross
        cross_signal = "neutral"
        cross_strength = 0.0
        if sma20 > sma50:
            cross_signal = "bullish"
            pct_diff = (sma20 - sma50) / sma50
            cross_strength = min(1.0, pct_diff * 50)   # 2% diff → 100% strength
        elif sma20 < sma50:
            cross_signal = "bearish"
            pct_diff = (sma50 - sma20) / sma50
            cross_strength = min(1.0, pct_diff * 50)

        # RSI filter: extreme readings override cross
        rsi_modifier = 0.0
        final_direction = cross_signal
        if rsi14 is not None:
            if rsi14 > 70 and cross_signal == "bullish":
                # Overbought — reduce strength
                rsi_modifier = -0.2
            elif rsi14 < 30 and cross_signal == "bearish":
                # Oversold — reduce strength
                rsi_modifier = -0.2
            elif rsi14 > 60 and cross_signal == "bullish":
                rsi_modifier = +0.1
            elif rsi14 < 40 and cross_signal == "bearish":
                rsi_modifier = +0.1

        final_strength = max(0.0, min(1.0, cross_strength + rsi_modifier))

        # Regime
        regime = "unknown"
        if atr_pct is not None:
            if atr_pct > 0.025:    # >2.5% daily range = high vol
                regime = "high_vol"
            elif final_direction == "bullish" and final_strength > 0.5:
                regime = "trending_up"
            elif final_direction == "bearish" and final_strength > 0.5:
                regime = "trending_down"
            else:
                regime = "ranging"

        _sma20_str = f"{sma20:.2f}" if sma20 is not None else "N/A"
        _sma50_str = f"{sma50:.2f}" if sma50 is not None else "N/A"
        _sma_cmp = ">" if (sma20 and sma50 and sma20 > sma50) else "<"
        _rsi_str = f"{rsi14:.1f}" if rsi14 is not None else "N/A"
        _atr_str = f"{atr_pct*100:.1f}" if atr_pct is not None else "N/A"
        detail = (
            f"SMA20={_sma20_str} {_sma_cmp} SMA50={_sma50_str}; "
            f"RSI14={_rsi_str}; "
            f"ATR%={_atr_str}%"
        )

        return DirectionalSignal(
            symbol=symbol,
            direction=final_direction,
            strength=round(final_strength, 3),
            regime=regime,
            source="internal_sma_rsi",
            sma20=sma20,
            sma50=sma50,
            rsi14=rsi14,
            atr_pct=atr_pct,
            detail=detail,
            timestamp=now_ts,
        )

    except Exception as e:
        logger.warning(f"Signal compute failed for {symbol}: {e}")
        return DirectionalSignal(
            symbol=symbol, direction="neutral", strength=0.0,
            regime="unknown", source="internal_fallback_error",
            detail=str(e)[:200], timestamp=now_ts,
        )


async def _fetch_daily_closes(symbol: str, n: int = 60) -> List[float]:
    """
    Fetch n daily closing prices for symbol via Alpaca data API.
    Returns list of closes, newest last.
    """
    import os
    import urllib.request
    from datetime import datetime, timedelta

    api_key = os.environ.get("APCA_API_KEY_ID", "")
    api_secret = os.environ.get("APCA_API_SECRET_KEY", "")
    if not api_key:
        return []

    end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=int(n * 1.5))   # extra buffer for weekends
    url = (
        f"https://data.alpaca.markets/v2/stocks/{symbol}/bars"
        f"?timeframe=1Day&start={start_dt.strftime('%Y-%m-%d')}&end={end_dt.strftime('%Y-%m-%d')}"
        f"&limit={n}&adjustment=raw&feed=iex"
    )

    req = urllib.request.Request(url, headers={
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": api_secret,
    })
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            import json
            data = json.loads(resp.read())
            bars = data.get("bars", [])
            return [float(b["c"]) for b in bars if "c" in b]
    except Exception as e:
        logger.debug(f"Daily bar fetch failed for {symbol}: {e}")
        return []


def _rsi(closes: List[float], period: int = 14) -> Optional[float]:
    """Compute RSI using Wilder's smoothing."""
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0) for d in deltas]
    losses = [abs(min(d, 0)) for d in deltas]

    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1 + rs))


def _atr(closes: List[float], period: int = 14) -> float:
    """Simple ATR approximation using close-to-close range."""
    if len(closes) < period + 1:
        return 0.0
    ranges = [abs(closes[i] - closes[i - 1]) for i in range(1, len(closes))]
    return sum(ranges[-period:]) / period


# ── Strategy Endpoint Integration ─────────────────────────────────────────────

async def _fetch_strategy_signal(symbol: str) -> Optional[DirectionalSignal]:
    """
    Attempt to fetch directional signal from the strategy/backtest endpoint.
    Returns None if endpoint unavailable or signal not found.
    """
    import urllib.request
    import json
    from datetime import datetime

    try:
        url = f"http://localhost:8000/api/strategy/signal/{symbol}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            direction = data.get("direction", "neutral")
            strength = float(data.get("strength", 0.5))
            regime = data.get("regime", "unknown")
            return DirectionalSignal(
                symbol=symbol,
                direction=direction,
                strength=strength,
                regime=regime,
                source="strategy_endpoint",
                detail=data.get("detail", ""),
                timestamp=datetime.utcnow().isoformat() + "Z",
            )
    except Exception:
        return None


# ── Public API ────────────────────────────────────────────────────────────────

async def get_signal(symbol: str, force_refresh: bool = False) -> DirectionalSignal:
    """
    Get directional signal for a symbol.
    Tries strategy endpoint first, falls back to internal SMA/RSI.
    Results cached for _CACHE_TTL seconds.
    """
    now = time.monotonic()
    if not force_refresh and symbol in _signal_cache:
        sig, ts = _signal_cache[symbol]
        if now - ts < _CACHE_TTL:
            return sig

    # Try strategy endpoint (non-blocking, 3s timeout)
    sig = await _fetch_strategy_signal(symbol)
    if sig is None:
        sig = await _compute_internal_signal(symbol)

    _signal_cache[symbol] = (sig, now)
    return sig


async def get_signals_batch(symbols: List[str]) -> Dict[str, DirectionalSignal]:
    """Get signals for multiple symbols, returning dict keyed by symbol."""
    import asyncio
    results = await asyncio.gather(*[get_signal(s) for s in symbols], return_exceptions=True)
    out = {}
    for sym, res in zip(symbols, results):
        if isinstance(res, DirectionalSignal):
            out[sym] = res
        else:
            from datetime import datetime
            out[sym] = DirectionalSignal(
                symbol=sym, direction="neutral", strength=0.0,
                regime="unknown", source="error",
                detail=str(res)[:200] if res else "unknown error",
                timestamp=datetime.utcnow().isoformat() + "Z",
            )
    return out
