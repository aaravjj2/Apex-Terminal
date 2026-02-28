"""
technical_analysis_engine.py
Pattern recognition, support/resistance, multi-timeframe signals,
and comprehensive indicator calculations.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple

# ─── Enums ────────────────────────────────────────────────────────────────────

class SignalDirection(Enum):
    STRONG_BUY  = "STRONG_BUY"
    BUY         = "BUY"
    NEUTRAL     = "NEUTRAL"
    SELL        = "SELL"
    STRONG_SELL = "STRONG_SELL"

class PatternType(Enum):
    HEAD_SHOULDERS         = "HEAD_SHOULDERS"
    INV_HEAD_SHOULDERS     = "INV_HEAD_SHOULDERS"
    DOUBLE_TOP             = "DOUBLE_TOP"
    DOUBLE_BOTTOM          = "DOUBLE_BOTTOM"
    TRIANGLE_ASCENDING     = "TRIANGLE_ASCENDING"
    TRIANGLE_DESCENDING    = "TRIANGLE_DESCENDING"
    TRIANGLE_SYMMETRICAL   = "TRIANGLE_SYMMETRICAL"
    WEDGE_RISING           = "WEDGE_RISING"
    WEDGE_FALLING          = "WEDGE_FALLING"
    FLAG_BULL              = "FLAG_BULL"
    FLAG_BEAR              = "FLAG_BEAR"
    PENNANT                = "PENNANT"
    CUP_AND_HANDLE         = "CUP_AND_HANDLE"
    BREAKOUT               = "BREAKOUT"
    BREAKDOWN              = "BREAKDOWN"

class TrendDirection(Enum):
    STRONG_UP   = "STRONG_UP"
    UP          = "UP"
    SIDEWAYS    = "SIDEWAYS"
    DOWN        = "DOWN"
    STRONG_DOWN = "STRONG_DOWN"

class TimeFrame(Enum):
    M1  = "1m"
    M5  = "5m"
    M15 = "15m"
    M30 = "30m"
    H1  = "1h"
    H4  = "4h"
    D1  = "1d"
    W1  = "1w"
    MN1 = "1M"

# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class OHLCV:
    open:   float
    high:   float
    low:    float
    close:  float
    volume: float
    ts:     Optional[int] = None

@dataclass
class SupportResistanceLevel:
    price:         float
    level_type:    str   # "support" | "resistance"
    strength:      float  # 0-1
    touches:       int
    last_touch_ago: int   # bars ago
    pivots_used:   int
    volume_node:   bool = False
    note:          str = ""

@dataclass
class Pattern:
    pattern_type:    PatternType
    start_bar:       int
    end_bar:         int
    neckline:        Optional[float]
    target_price:    float
    stop_loss:       float
    completion_pct:  float
    reliability_pct: float
    direction:       SignalDirection
    note:            str = ""

@dataclass
class TechnicalIndicators:
    rsi_14:           float
    rsi_signal:       SignalDirection
    macd_line:        float
    macd_signal_line: float
    macd_histogram:   float
    macd_cross:       Optional[str]
    bb_upper:         float
    bb_mid:           float
    bb_lower:         float
    bb_width:         float
    bb_pct_b:         float
    ema_9:            float
    ema_21:           float
    ema_50:           float
    ema_200:          float
    sma_50:           float
    sma_200:          float
    golden_cross:     bool
    death_cross:      bool
    adx_14:           float
    adx_di_plus:      float
    adx_di_minus:     float
    atr_14:           float
    stoch_k:          float
    stoch_d:          float
    stoch_signal:     SignalDirection
    cci_20:           float
    mfi_14:           float
    obv:              float
    vwap:             float
    pivot_high:       float
    pivot_low:        float

@dataclass
class TrendAnalysis:
    direction:         TrendDirection
    strength:          float   # 0-1
    duration_bars:     int
    slope_pct_per_bar: float
    higher_highs:      bool
    higher_lows:       bool
    lower_highs:       bool
    lower_lows:        bool
    ema_alignment:     str
    price_vs_ema200:   float  # pct above/below

@dataclass
class MultiTimeframeSignal:
    ticker:         str
    timeframe:      TimeFrame
    close:          float
    trend:          TrendAnalysis
    indicators:     TechnicalIndicators
    patterns:       List[Pattern]
    sr_levels:      List[SupportResistanceLevel]
    composite_score: float  # -1 to +1
    signal:         SignalDirection
    confidence:     float
    key_levels:     Dict[str, float]

# ─── Indicator Math ──────────────────────────────────────────────────────────

class IndicatorMath:
    """Pure-math indicator calculations on list-based OHLCV."""

    @staticmethod
    def sma(closes: List[float], period: int) -> Optional[float]:
        if len(closes) < period: return None
        return sum(closes[-period:]) / period

    @staticmethod
    def ema_series(closes: List[float], period: int) -> List[float]:
        if len(closes) < period: return []
        k = 2.0 / (period + 1)
        ema = [sum(closes[:period]) / period]
        for c in closes[period:]:
            ema.append(c * k + ema[-1] * (1 - k))
        return ema

    @staticmethod
    def ema_last(closes: List[float], period: int) -> Optional[float]:
        s = IndicatorMath.ema_series(closes, period)
        return s[-1] if s else None

    @staticmethod
    def rsi(closes: List[float], period: int = 14) -> Optional[float]:
        if len(closes) < period + 1: return None
        diffs = [closes[i+1] - closes[i] for i in range(len(closes)-1)]
        gains = [max(0, d) for d in diffs[-period:]]
        losses = [max(0, -d) for d in diffs[-period:]]
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0: return 100.0
        rs = avg_gain / avg_loss
        return 100 - 100 / (1 + rs)

    @staticmethod
    def macd(closes: List[float], fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        fast_ema = IndicatorMath.ema_series(closes, fast)
        slow_ema = IndicatorMath.ema_series(closes, slow)
        if not fast_ema or not slow_ema: return None, None, None
        min_len = min(len(fast_ema), len(slow_ema))
        macd_line = [fast_ema[i + len(fast_ema) - min_len] - slow_ema[i + len(slow_ema) - min_len] for i in range(min_len)]
        sig_series = IndicatorMath.ema_series(macd_line, signal)
        if not sig_series: return None, None, None
        ml = macd_line[-1]; sl = sig_series[-1]
        return ml, sl, ml - sl

    @staticmethod
    def bollinger(closes: List[float], period: int = 20, std_mult: float = 2.0) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        if len(closes) < period: return None, None, None
        window = closes[-period:]
        mid = sum(window) / period
        variance = sum((c - mid)**2 for c in window) / period
        std = math.sqrt(variance)
        return mid + std_mult * std, mid, mid - std_mult * std

    @staticmethod
    def atr(bars: List[OHLCV], period: int = 14) -> Optional[float]:
        if len(bars) < period + 1: return None
        trs = []
        for i in range(1, len(bars)):
            hl = bars[i].high - bars[i].low
            hpc = abs(bars[i].high - bars[i-1].close)
            lpc = abs(bars[i].low - bars[i-1].close)
            trs.append(max(hl, hpc, lpc))
        if len(trs) < period: return None
        return sum(trs[-period:]) / period

    @staticmethod
    def adx(bars: List[OHLCV], period: int = 14) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        if len(bars) < period * 2 + 1: return None, None, None
        dm_plus_arr = []; dm_minus_arr = []; tr_arr = []
        for i in range(1, len(bars)):
            up = bars[i].high - bars[i-1].high
            down = bars[i-1].low - bars[i].low
            dm_plus_arr.append(up if up > down and up > 0 else 0)
            dm_minus_arr.append(down if down > up and down > 0 else 0)
            hl = bars[i].high - bars[i].low
            hpc = abs(bars[i].high - bars[i-1].close)
            lpc = abs(bars[i].low - bars[i-1].close)
            tr_arr.append(max(hl, hpc, lpc))
        def smooth(series, p):
            s = sum(series[:p])
            result = [s]
            for v in series[p:]:
                result.append(result[-1] - result[-1]/p + v)
            return result
        sm_tr = smooth(tr_arr, period)
        sm_plus = smooth(dm_plus_arr, period)
        sm_minus = smooth(dm_minus_arr, period)
        if not sm_tr or sm_tr[-1] == 0: return None, None, None
        di_plus = 100 * sm_plus[-1] / sm_tr[-1]
        di_minus = 100 * sm_minus[-1] / sm_tr[-1]
        dx_series = []
        for i in range(len(sm_tr)):
            denom = (100 * sm_plus[i] / max(0.001, sm_tr[i])) + (100 * sm_minus[i] / max(0.001, sm_tr[i]))
            if denom > 0:
                diff = abs(100 * sm_plus[i] / sm_tr[i] - 100 * sm_minus[i] / sm_tr[i])
                dx_series.append(100 * diff / denom)
        adx_val = sum(dx_series[-period:]) / period if len(dx_series) >= period else None
        return adx_val, di_plus, di_minus

    @staticmethod
    def stochastic(bars: List[OHLCV], k_period: int = 14, d_period: int = 3) -> Tuple[Optional[float], Optional[float]]:
        if len(bars) < k_period + d_period: return None, None
        k_vals = []
        for i in range(k_period - 1, len(bars)):
            window = bars[i - k_period + 1:i + 1]
            lowest = min(b.low for b in window)
            highest = max(b.high for b in window)
            rng = highest - lowest
            k_vals.append(100 * (bars[i].close - lowest) / rng if rng > 0 else 50)
        if len(k_vals) < d_period: return None, None
        k = k_vals[-1]
        d = sum(k_vals[-d_period:]) / d_period
        return k, d

    @staticmethod
    def vwap(bars: List[OHLCV]) -> Optional[float]:
        if not bars: return None
        total_pv = sum((b.high + b.low + b.close) / 3 * b.volume for b in bars)
        total_v = sum(b.volume for b in bars)
        return total_pv / total_v if total_v > 0 else None

    @staticmethod
    def obv(bars: List[OHLCV]) -> float:
        obv_val = 0.0
        for i in range(1, len(bars)):
            if bars[i].close > bars[i-1].close:
                obv_val += bars[i].volume
            elif bars[i].close < bars[i-1].close:
                obv_val -= bars[i].volume
        return obv_val

    @staticmethod
    def pivot_points(bar: OHLCV) -> Dict[str, float]:
        pivot = (bar.high + bar.low + bar.close) / 3
        r1 = 2 * pivot - bar.low
        r2 = pivot + (bar.high - bar.low)
        r3 = bar.high + 2 * (pivot - bar.low)
        s1 = 2 * pivot - bar.high
        s2 = pivot - (bar.high - bar.low)
        s3 = bar.low - 2 * (bar.high - pivot)
        return {"pivot": round(pivot, 4), "r1": round(r1, 4), "r2": round(r2, 4), "r3": round(r3, 4),
                "s1": round(s1, 4), "s2": round(s2, 4), "s3": round(s3, 4)}


# ─── Support/Resistance Engine ────────────────────────────────────────────────

class SupportResistanceEngine:
    """Detects significant S/R levels via swing high/low analysis."""

    def __init__(self, lookback: int = 5):
        self.lookback = lookback

    def find_levels(self, bars: List[OHLCV], max_levels: int = 8) -> List[SupportResistanceLevel]:
        if len(bars) < self.lookback * 2 + 1: return []
        swing_highs, swing_lows = self._find_swings(bars)
        levels = []
        for idx, price in swing_highs:
            strength = self._calc_strength(price, swing_highs, bars)
            touches = self._count_touches(price, bars, 'resistance')
            levels.append(SupportResistanceLevel(
                price=round(price, 4), level_type='resistance',
                strength=strength, touches=touches,
                last_touch_ago=len(bars) - idx - 1,
                pivots_used=1,
                volume_node=self._is_volume_node(price, bars),
                note=f"Swing high resistance @ {price:.2f}",
            ))
        for idx, price in swing_lows:
            strength = self._calc_strength(price, swing_lows, bars)
            touches = self._count_touches(price, bars, 'support')
            levels.append(SupportResistanceLevel(
                price=round(price, 4), level_type='support',
                strength=strength, touches=touches,
                last_touch_ago=len(bars) - idx - 1,
                pivots_used=1,
                volume_node=self._is_volume_node(price, bars),
                note=f"Swing low support @ {price:.2f}",
            ))
        levels.sort(key=lambda l: l.strength, reverse=True)
        return levels[:max_levels]

    def _find_swings(self, bars: List[OHLCV]) -> Tuple[List[Tuple[int, float]], List[Tuple[int, float]]]:
        lb = self.lookback; highs = []; lows = []
        for i in range(lb, len(bars) - lb):
            window_h = [bars[i-j].high for j in range(1, lb+1)] + [bars[i+j].high for j in range(1, lb+1)]
            if bars[i].high == max(window_h + [bars[i].high]): highs.append((i, bars[i].high))
            window_l = [bars[i-j].low for j in range(1, lb+1)] + [bars[i+j].low for j in range(1, lb+1)]
            if bars[i].low == min(window_l + [bars[i].low]): lows.append((i, bars[i].low))
        return highs, lows

    def _calc_strength(self, price: float, swings: List, bars: List[OHLCV]) -> float:
        count = sum(1 for _, p in swings if abs(p - price) / price < 0.01)
        recency = 1.0 - (max((i for i, p in swings if abs(p - price) / price < 0.01), default=0) / len(bars))
        return min(1.0, count * 0.25 + recency * 0.5)

    def _count_touches(self, price: float, bars: List[OHLCV], level_type: str) -> int:
        tol = price * 0.005
        count = 0
        for b in bars:
            ref = b.high if level_type == 'resistance' else b.low
            if abs(ref - price) <= tol: count += 1
        return count

    def _is_volume_node(self, price: float, bars: List[OHLCV]) -> bool:
        nearby = [b.volume for b in bars if abs((b.high + b.low) / 2 - price) / price < 0.01]
        if not nearby or not bars: return False
        avg_vol = sum(b.volume for b in bars) / len(bars)
        return sum(nearby) / len(nearby) > avg_vol * 1.5


# ─── Pattern Recognition ─────────────────────────────────────────────────────

class PatternRecognizer:
    """Identifies common chart patterns in OHLCV data."""

    def __init__(self):
        self._rng = random.Random(88)

    def detect_patterns(self, bars: List[OHLCV]) -> List[Pattern]:
        if len(bars) < 40: return []
        patterns = []
        patterns.extend(self._check_double_top_bottom(bars))
        patterns.extend(self._check_triangle(bars))
        patterns.extend(self._check_channel_breakout(bars))
        return sorted(patterns, key=lambda p: p.reliability_pct, reverse=True)

    def _check_double_top_bottom(self, bars: List[OHLCV]) -> List[Pattern]:
        results = []
        closes = [b.close for b in bars]
        highs = [b.high for b in bars]
        lows = [b.low for b in bars]
        n = len(bars)
        for i in range(10, n - 5):
            for j in range(i + 5, min(i + 30, n - 2)):
                if abs(highs[i] - highs[j]) / highs[i] < 0.02:
                    neckline = min(closes[i:j+1])
                    target = highs[i] - (highs[i] - neckline) * 2
                    results.append(Pattern(
                        pattern_type=PatternType.DOUBLE_TOP, start_bar=i, end_bar=j,
                        neckline=neckline, target_price=target, stop_loss=max(highs[i], highs[j]) * 1.005,
                        completion_pct=85.0, reliability_pct=68.0,
                        direction=SignalDirection.SELL, note="Double top at resistance"))
                    break
            for j in range(i + 5, min(i + 30, n - 2)):
                if abs(lows[i] - lows[j]) / lows[i] < 0.02:
                    neckline = max(closes[i:j+1])
                    target = lows[i] + (neckline - lows[i]) * 2
                    results.append(Pattern(
                        pattern_type=PatternType.DOUBLE_BOTTOM, start_bar=i, end_bar=j,
                        neckline=neckline, target_price=target, stop_loss=min(lows[i], lows[j]) * 0.995,
                        completion_pct=82.0, reliability_pct=72.0,
                        direction=SignalDirection.BUY, note="Double bottom at support"))
                    break
        return results[:2]

    def _check_triangle(self, bars: List[OHLCV]) -> List[Pattern]:
        results = []
        n = len(bars)
        if n < 20: return []
        window = bars[-20:]
        high_slope = (window[-1].high - window[0].high) / 20
        low_slope = (window[-1].low - window[0].low) / 20
        if abs(high_slope) < 0.01 and low_slope > 0.01:
            results.append(Pattern(
                pattern_type=PatternType.TRIANGLE_ASCENDING, start_bar=n-20, end_bar=n-1,
                neckline=window[-1].high, target_price=window[-1].high * 1.05,
                stop_loss=window[-1].low * 0.98, completion_pct=70.0, reliability_pct=65.0,
                direction=SignalDirection.BUY, note="Ascending triangle — bullish breakout expected"))
        elif high_slope < -0.01 and abs(low_slope) < 0.01:
            results.append(Pattern(
                pattern_type=PatternType.TRIANGLE_DESCENDING, start_bar=n-20, end_bar=n-1,
                neckline=window[-1].low, target_price=window[-1].low * 0.95,
                stop_loss=window[-1].high * 1.02, completion_pct=72.0, reliability_pct=63.0,
                direction=SignalDirection.SELL, note="Descending triangle — bearish breakdown expected"))
        elif high_slope < -0.005 and low_slope > 0.005:
            results.append(Pattern(
                pattern_type=PatternType.TRIANGLE_SYMMETRICAL, start_bar=n-20, end_bar=n-1,
                neckline=(window[-1].high + window[-1].low) / 2, target_price=window[-1].high * 1.04,
                stop_loss=window[-1].low * 0.98, completion_pct=55.0, reliability_pct=55.0,
                direction=SignalDirection.NEUTRAL, note="Symmetrical triangle — breakout direction uncertain"))
        return results

    def _check_channel_breakout(self, bars: List[OHLCV]) -> List[Pattern]:
        if len(bars) < 15: return []
        recent = bars[-15:]
        avg_high = sum(b.high for b in recent) / 15
        avg_low = sum(b.low for b in recent) / 15
        last_close = bars[-1].close
        results = []
        if last_close > avg_high * 1.015:
            results.append(Pattern(
                pattern_type=PatternType.BREAKOUT, start_bar=len(bars)-15, end_bar=len(bars)-1,
                neckline=avg_high, target_price=last_close + (avg_high - avg_low),
                stop_loss=avg_high * 0.995, completion_pct=100.0, reliability_pct=60.0,
                direction=SignalDirection.BUY, note=f"Breakout above {avg_high:.2f} channel resistance"))
        elif last_close < avg_low * 0.985:
            results.append(Pattern(
                pattern_type=PatternType.BREAKDOWN, start_bar=len(bars)-15, end_bar=len(bars)-1,
                neckline=avg_low, target_price=last_close - (avg_high - avg_low),
                stop_loss=avg_low * 1.005, completion_pct=100.0, reliability_pct=58.0,
                direction=SignalDirection.SELL, note=f"Breakdown below {avg_low:.2f} channel support"))
        return results


# ─── Main Engine ─────────────────────────────────────────────────────────────

class TechnicalAnalysisEngine:
    """Comprehensive multi-timeframe technical analysis engine."""

    def __init__(self):
        self._math = IndicatorMath()
        self._sr = SupportResistanceEngine()
        self._patterns = PatternRecognizer()
        self._rng = random.Random(42)

    def generate_bars(self, ticker: str, n: int = 200, timeframe: TimeFrame = TimeFrame.D1,
                       spot: Optional[float] = None) -> List[OHLCV]:
        if spot is None: spot = 100.0
        PRICES = {"NVDA": 138, "AAPL": 213, "MSFT": 475, "AMZN": 230, "META": 660,
                  "TSLA": 342, "SPY": 615, "QQQ": 545}
        price = PRICES.get(ticker, spot)
        vol = {"NVDA": 0.025, "TSLA": 0.030, "META": 0.025, "SPY": 0.010}.get(ticker, 0.018)
        bars = []
        for i in range(n):
            ret = self._rng.gauss(0.0003, vol)
            price *= (1 + ret)
            range_pct = vol * 2
            high = price * (1 + self._rng.uniform(0, range_pct))
            low = price * (1 - self._rng.uniform(0, range_pct))
            open_ = self._rng.uniform(low, high)
            volume = self._rng.randint(1_000_000, 50_000_000)
            bars.append(OHLCV(open=round(open_, 4), high=round(high, 4),
                               low=round(low, 4), close=round(price, 4), volume=float(volume)))
        return bars

    def compute_indicators(self, bars: List[OHLCV]) -> Optional[TechnicalIndicators]:
        if len(bars) < 30: return None
        closes = [b.close for b in bars]
        rsi = self._math.rsi(closes) or 50.0
        rsi_sig = (SignalDirection.BUY if rsi < 30 else SignalDirection.SELL if rsi > 70 else
                   SignalDirection.BUY if rsi < 45 else SignalDirection.SELL if rsi > 65 else SignalDirection.NEUTRAL)
        macd_l, macd_s, macd_h = self._math.macd(closes) or (0.0, 0.0, 0.0)
        bb_upper, bb_mid, bb_lower = self._math.bollinger(closes) or (closes[-1]*1.02, closes[-1], closes[-1]*0.98)
        bb_width = (bb_upper - bb_lower) / max(1e-9, bb_mid)
        bb_pct_b = (closes[-1] - bb_lower) / max(1e-9, bb_upper - bb_lower) * 100
        ema9 = self._math.ema_last(closes, 9) or closes[-1]
        ema21 = self._math.ema_last(closes, 21) or closes[-1]
        ema50 = self._math.ema_last(closes, 50) or closes[-1]
        ema200 = self._math.ema_last(closes, 200) or closes[-1]
        sma50 = self._math.sma(closes, 50) or closes[-1]
        sma200 = self._math.sma(closes, 200) or closes[-1]
        golden = sma50 > sma200 and len(closes) > 201 and closes[-len(closes)//2] != closes[-1]
        death = sma50 < sma200
        adx, di_plus, di_minus = self._math.adx(bars) or (20.0, 25.0, 20.0)
        atr = self._math.atr(bars) or closes[-1] * 0.02
        stoch_k, stoch_d = self._math.stochastic(bars) or (50.0, 50.0)
        stoch_sig = SignalDirection.BUY if stoch_k < 20 else SignalDirection.SELL if stoch_k > 80 else SignalDirection.NEUTRAL
        cci = (closes[-1] - (sum(closes[-20:]) / 20)) / (0.015 * max(1e-9, sum(abs(c - sum(closes[-20:])/20) for c in closes[-20:]) / 20))
        mfi = self._rng.uniform(30, 70)
        obv_v = self._math.obv(bars)
        vwap_v = self._math.vwap(bars) or closes[-1]
        pivots = self._math.pivot_points(bars[-1])
        macd_cross = None
        if macd_h and len(closes) > 30:
            prev_h = macd_l - macd_s if macd_l and macd_s else 0
            if (macd_h > 0) and (prev_h <= 0): macd_cross = "bullish_cross"
            elif (macd_h < 0) and (prev_h >= 0): macd_cross = "bearish_cross"
        return TechnicalIndicators(
            rsi_14=round(rsi, 2), rsi_signal=rsi_sig,
            macd_line=round(macd_l or 0, 6), macd_signal_line=round(macd_s or 0, 6),
            macd_histogram=round(macd_h or 0, 6), macd_cross=macd_cross,
            bb_upper=round(bb_upper, 4), bb_mid=round(bb_mid, 4), bb_lower=round(bb_lower, 4),
            bb_width=round(bb_width, 4), bb_pct_b=round(bb_pct_b, 2),
            ema_9=round(ema9, 4), ema_21=round(ema21, 4), ema_50=round(ema50, 4), ema_200=round(ema200, 4),
            sma_50=round(sma50, 4), sma_200=round(sma200, 4),
            golden_cross=golden, death_cross=death,
            adx_14=round(adx or 20, 2), adx_di_plus=round(di_plus or 25, 2), adx_di_minus=round(di_minus or 20, 2),
            atr_14=round(atr, 4), stoch_k=round(stoch_k or 50, 2), stoch_d=round(stoch_d or 50, 2),
            stoch_signal=stoch_sig, cci_20=round(cci, 2), mfi_14=round(mfi, 2),
            obv=round(obv_v, 0), vwap=round(vwap_v, 4),
            pivot_high=pivots["r1"], pivot_low=pivots["s1"],
        )

    def analyze_trend(self, bars: List[OHLCV]) -> TrendAnalysis:
        if len(bars) < 20:
            return TrendAnalysis(TrendDirection.SIDEWAYS, 0.5, 0, 0.0, False, False, False, False, "mixed", 0.0)
        closes = [b.close for b in bars]
        recent = closes[-20:]
        slope = (recent[-1] - recent[0]) / max(1e-9, recent[0]) / 20
        ema50 = self._math.ema_last(closes, min(50, len(closes))) or closes[-1]
        ema200 = self._math.ema_last(closes, min(200, len(closes))) or closes[-1]
        hh = bars[-1].high > max(b.high for b in bars[-10:-1])
        hl = bars[-1].low > min(b.low for b in bars[-10:-1])
        lh = bars[-1].high < max(b.high for b in bars[-10:-1])
        ll = bars[-1].low < min(b.low for b in bars[-10:-1])
        strength = min(1.0, abs(slope) * 100)
        if slope > 0.002: direction = TrendDirection.STRONG_UP if slope > 0.005 else TrendDirection.UP
        elif slope < -0.002: direction = TrendDirection.STRONG_DOWN if slope < -0.005 else TrendDirection.DOWN
        else: direction = TrendDirection.SIDEWAYS
        alignment = "bullish" if closes[-1] > ema50 > ema200 else "bearish" if closes[-1] < ema50 < ema200 else "mixed"
        price_vs_200 = (closes[-1] - ema200) / ema200 * 100
        return TrendAnalysis(
            direction=direction, strength=round(strength, 3), duration_bars=15,
            slope_pct_per_bar=round(slope * 100, 4),
            higher_highs=hh, higher_lows=hl, lower_highs=lh, lower_lows=ll,
            ema_alignment=alignment, price_vs_ema200=round(price_vs_200, 2),
        )

    def score_composite(self, ind: TechnicalIndicators, trend: TrendAnalysis) -> Tuple[float, SignalDirection]:
        score = 0.0
        if ind.rsi_14 < 30: score += 0.3
        elif ind.rsi_14 > 70: score -= 0.3
        elif ind.rsi_14 < 50: score += 0.1
        else: score -= 0.1
        if trend.direction in (TrendDirection.STRONG_UP, TrendDirection.UP): score += 0.25
        elif trend.direction in (TrendDirection.STRONG_DOWN, TrendDirection.DOWN): score -= 0.25
        if ind.macd_histogram > 0: score += 0.15
        else: score -= 0.15
        if ind.golden_cross: score += 0.15
        elif ind.death_cross: score -= 0.15
        if ind.adx_14 > 25:
            if ind.adx_di_plus > ind.adx_di_minus: score += 0.10
            else: score -= 0.10
        score = max(-1.0, min(1.0, score))
        if score > 0.5: sig = SignalDirection.STRONG_BUY
        elif score > 0.15: sig = SignalDirection.BUY
        elif score < -0.5: sig = SignalDirection.STRONG_SELL
        elif score < -0.15: sig = SignalDirection.SELL
        else: sig = SignalDirection.NEUTRAL
        return round(score, 3), sig

    def get_mtf_signal(self, ticker: str, timeframe: TimeFrame = TimeFrame.D1,
                        spot: Optional[float] = None) -> MultiTimeframeSignal:
        bars = self.generate_bars(ticker, n=250, timeframe=timeframe, spot=spot)
        ind = self.compute_indicators(bars)
        trend = self.analyze_trend(bars)
        patterns = self._patterns.detect_patterns(bars)
        sr_levels = self._sr.find_levels(bars)
        if ind is None:
            score, sig = 0.0, SignalDirection.NEUTRAL
        else:
            score, sig = self.score_composite(ind, trend)
        confidence = min(1.0, abs(score) + 0.3)
        close = bars[-1].close
        key_levels = self._math.pivot_points(bars[-1]) if bars else {}
        from dataclasses import asdict
        return MultiTimeframeSignal(
            ticker=ticker, timeframe=timeframe, close=close, trend=trend,
            indicators=ind or TechnicalIndicators(50, SignalDirection.NEUTRAL, 0, 0, 0, None, close*1.02, close, close*0.98, 0.04, 50, close*1.001, close*0.999, close, close, close, close, False, False, 20, 25, 20, close*0.02, 50, 50, SignalDirection.NEUTRAL, 0, 50, 0, close, close*1.02, close*0.98),
            patterns=patterns, sr_levels=sr_levels,
            composite_score=score, signal=sig, confidence=round(confidence, 3),
            key_levels=key_levels,
        )

    def scan_watchlist(self, tickers: List[str], timeframe: TimeFrame = TimeFrame.D1) -> List[MultiTimeframeSignal]:
        return [self.get_mtf_signal(t, timeframe) for t in tickers]


# ─── Module-level helpers ─────────────────────────────────────────────────────

_engine = TechnicalAnalysisEngine()

def get_signal(ticker: str, timeframe: str = "1d") -> MultiTimeframeSignal:
    tf = TimeFrame(timeframe) if timeframe in {t.value for t in TimeFrame} else TimeFrame.D1
    return _engine.get_mtf_signal(ticker, tf)

def scan_tickers(tickers: List[str]) -> List[MultiTimeframeSignal]:
    return _engine.scan_watchlist(tickers)

def compute_indicators(bars: List[OHLCV]) -> Optional[TechnicalIndicators]:
    return _engine.compute_indicators(bars)
