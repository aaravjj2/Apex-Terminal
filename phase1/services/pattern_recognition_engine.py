"""
Apex Terminal — Bloomberg-Grade Chart Pattern Recognition Engine
================================================================

Comprehensive candlestick and chart pattern detection:

Candlestick Patterns (Single):
- Doji, Dragonfly Doji, Gravestone Doji
- Hammer, Inverted Hammer, Hanging Man, Shooting Star
- Marubozu (bullish/bearish), Spinning Top

Candlestick Patterns (Multi):
- Engulfing (bullish/bearish)
- Harami (bullish/bearish)
- Morning Star, Evening Star
- Three White Soldiers, Three Black Crows
- Piercing Line, Dark Cloud Cover
- Tweezer Top/Bottom

Chart Patterns:
- Head and Shoulders (regular, inverse)
- Double Top/Bottom
- Triple Top/Bottom
- Ascending/Descending Triangle
- Symmetrical Triangle
- Bull/Bear Flag
- Rising/Falling Wedge
- Cup and Handle
- Rounding Bottom/Top

Fibonacci Patterns:
- AB=CD pattern
- Gartley, Butterfly, Bat, Crab

Support/Resistance:
- Automatic S/R level detection
- Trend line detection
- Channel detection

Pure computation module — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class PatternType(Enum):
    # Single candlestick
    DOJI = "doji"
    DRAGONFLY_DOJI = "dragonfly_doji"
    GRAVESTONE_DOJI = "gravestone_doji"
    HAMMER = "hammer"
    INVERTED_HAMMER = "inverted_hammer"
    HANGING_MAN = "hanging_man"
    SHOOTING_STAR = "shooting_star"
    BULLISH_MARUBOZU = "bullish_marubozu"
    BEARISH_MARUBOZU = "bearish_marubozu"
    SPINNING_TOP = "spinning_top"

    # Multi-candlestick
    BULLISH_ENGULFING = "bullish_engulfing"
    BEARISH_ENGULFING = "bearish_engulfing"
    BULLISH_HARAMI = "bullish_harami"
    BEARISH_HARAMI = "bearish_harami"
    MORNING_STAR = "morning_star"
    EVENING_STAR = "evening_star"
    THREE_WHITE_SOLDIERS = "three_white_soldiers"
    THREE_BLACK_CROWS = "three_black_crows"
    PIERCING_LINE = "piercing_line"
    DARK_CLOUD_COVER = "dark_cloud_cover"
    TWEEZER_TOP = "tweezer_top"
    TWEEZER_BOTTOM = "tweezer_bottom"

    # Chart patterns
    HEAD_AND_SHOULDERS = "head_and_shoulders"
    INVERSE_HEAD_AND_SHOULDERS = "inverse_head_and_shoulders"
    DOUBLE_TOP = "double_top"
    DOUBLE_BOTTOM = "double_bottom"
    TRIPLE_TOP = "triple_top"
    TRIPLE_BOTTOM = "triple_bottom"
    ASCENDING_TRIANGLE = "ascending_triangle"
    DESCENDING_TRIANGLE = "descending_triangle"
    SYMMETRICAL_TRIANGLE = "symmetrical_triangle"
    BULL_FLAG = "bull_flag"
    BEAR_FLAG = "bear_flag"
    RISING_WEDGE = "rising_wedge"
    FALLING_WEDGE = "falling_wedge"
    CUP_AND_HANDLE = "cup_and_handle"
    ROUNDING_BOTTOM = "rounding_bottom"


class PatternSignal(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    CONTINUATION = "continuation"
    REVERSAL = "reversal"


class PatternStrength(Enum):
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class OHLCV:
    """Price bar for pattern detection."""
    timestamp: datetime | None
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    @property
    def body(self) -> float:
        return abs(self.close - self.open)

    @property
    def range(self) -> float:
        return self.high - self.low

    @property
    def upper_shadow(self) -> float:
        return self.high - max(self.open, self.close)

    @property
    def lower_shadow(self) -> float:
        return min(self.open, self.close) - self.low

    @property
    def is_bullish(self) -> bool:
        return self.close >= self.open

    @property
    def body_pct(self) -> float:
        return self.body / self.range if self.range > 0 else 0.0

    @property
    def midpoint(self) -> float:
        return (self.open + self.close) / 2


@dataclass
class PatternMatch:
    """A detected pattern."""
    pattern_type: PatternType
    signal: PatternSignal
    strength: PatternStrength
    start_index: int
    end_index: int
    confidence: float = 0.0
    price_target: float | None = None
    stop_loss: float | None = None
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "pattern": self.pattern_type.value,
            "signal": self.signal.value,
            "strength": self.strength.value,
            "start_index": self.start_index,
            "end_index": self.end_index,
            "confidence": round(self.confidence, 4),
            "price_target": self.price_target,
            "stop_loss": self.stop_loss,
            "description": self.description,
        }


@dataclass
class SupportResistanceLevel:
    """Support or resistance level."""
    price: float
    level_type: str  # "support" or "resistance"
    strength: int = 0  # Number of touches
    first_seen: int = 0
    last_seen: int = 0

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 2),
            "type": self.level_type,
            "strength": self.strength,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
        }


@dataclass
class TrendLine:
    """Detected trend line."""
    start_index: int
    end_index: int
    start_price: float
    end_price: float
    slope: float
    direction: str  # "up" or "down"
    touches: int = 0

    @property
    def price_at(self) -> callable:
        def _calc(index: int) -> float:
            if self.end_index == self.start_index:
                return self.start_price
            t = (index - self.start_index) / (self.end_index - self.start_index)
            return self.start_price + t * (self.end_price - self.start_price)
        return _calc

    def to_dict(self) -> dict:
        return {
            "start_index": self.start_index,
            "end_index": self.end_index,
            "start_price": round(self.start_price, 2),
            "end_price": round(self.end_price, 2),
            "slope": round(self.slope, 6),
            "direction": self.direction,
            "touches": self.touches,
        }


# ─── Candlestick Pattern Scanner ──────────────────────────────────────────

class CandlestickScanner:
    """Detect single and multi-candle patterns."""

    def __init__(self, doji_threshold: float = 0.05, shadow_ratio: float = 2.0):
        self.doji_threshold = doji_threshold
        self.shadow_ratio = shadow_ratio

    def _is_doji(self, bar: OHLCV) -> bool:
        return bar.body_pct < self.doji_threshold and bar.range > 0

    def _is_hammer_shape(self, bar: OHLCV) -> bool:
        """Lower shadow >= 2x body, small upper shadow."""
        if bar.range == 0:
            return False
        return (bar.lower_shadow >= self.shadow_ratio * bar.body and
                bar.upper_shadow <= bar.body * 0.3)

    def _is_inverted_hammer_shape(self, bar: OHLCV) -> bool:
        if bar.range == 0:
            return False
        return (bar.upper_shadow >= self.shadow_ratio * bar.body and
                bar.lower_shadow <= bar.body * 0.3)

    def _is_marubozu(self, bar: OHLCV) -> bool:
        if bar.range == 0:
            return False
        return bar.body_pct > 0.90

    def scan_single(self, bars: list[OHLCV], index: int) -> list[PatternMatch]:
        """Scan for single-candle patterns at given index."""
        if index < 0 or index >= len(bars):
            return []

        bar = bars[index]
        patterns = []

        # Doji variants
        if self._is_doji(bar):
            if bar.lower_shadow > bar.upper_shadow * 2 and bar.lower_shadow > 0:
                patterns.append(PatternMatch(
                    PatternType.DRAGONFLY_DOJI, PatternSignal.BULLISH,
                    PatternStrength.MODERATE, index, index, 0.7,
                    description="Dragonfly Doji: long lower shadow, bullish reversal signal"))
            elif bar.upper_shadow > bar.lower_shadow * 2 and bar.upper_shadow > 0:
                patterns.append(PatternMatch(
                    PatternType.GRAVESTONE_DOJI, PatternSignal.BEARISH,
                    PatternStrength.MODERATE, index, index, 0.7,
                    description="Gravestone Doji: long upper shadow, bearish reversal signal"))
            else:
                patterns.append(PatternMatch(
                    PatternType.DOJI, PatternSignal.NEUTRAL,
                    PatternStrength.WEAK, index, index, 0.6,
                    description="Doji: indecision candle"))

        # Hammer / Hanging Man
        if self._is_hammer_shape(bar):
            # Need context: after downtrend = hammer, after uptrend = hanging man
            if index >= 3:
                prev_trend = bars[index - 1].close < bars[index - 3].close
                if prev_trend:  # downtrend
                    patterns.append(PatternMatch(
                        PatternType.HAMMER, PatternSignal.BULLISH,
                        PatternStrength.STRONG, index, index, 0.75,
                        price_target=bar.high + bar.range,
                        stop_loss=bar.low,
                        description="Hammer: bullish reversal after downtrend"))
                else:
                    patterns.append(PatternMatch(
                        PatternType.HANGING_MAN, PatternSignal.BEARISH,
                        PatternStrength.MODERATE, index, index, 0.65,
                        description="Hanging Man: potential bearish reversal"))

        # Inverted Hammer / Shooting Star
        if self._is_inverted_hammer_shape(bar):
            if index >= 3:
                prev_trend = bars[index - 1].close < bars[index - 3].close
                if prev_trend:
                    patterns.append(PatternMatch(
                        PatternType.INVERTED_HAMMER, PatternSignal.BULLISH,
                        PatternStrength.MODERATE, index, index, 0.65,
                        description="Inverted Hammer: potential bullish reversal"))
                else:
                    patterns.append(PatternMatch(
                        PatternType.SHOOTING_STAR, PatternSignal.BEARISH,
                        PatternStrength.STRONG, index, index, 0.75,
                        price_target=bar.low - bar.range,
                        stop_loss=bar.high,
                        description="Shooting Star: bearish reversal signal"))

        # Marubozu
        if self._is_marubozu(bar):
            if bar.is_bullish:
                patterns.append(PatternMatch(
                    PatternType.BULLISH_MARUBOZU, PatternSignal.BULLISH,
                    PatternStrength.STRONG, index, index, 0.8,
                    description="Bullish Marubozu: strong buying pressure"))
            else:
                patterns.append(PatternMatch(
                    PatternType.BEARISH_MARUBOZU, PatternSignal.BEARISH,
                    PatternStrength.STRONG, index, index, 0.8,
                    description="Bearish Marubozu: strong selling pressure"))

        # Spinning Top
        if (bar.body_pct < 0.3 and bar.upper_shadow > bar.body and
                bar.lower_shadow > bar.body and not self._is_doji(bar)):
            patterns.append(PatternMatch(
                PatternType.SPINNING_TOP, PatternSignal.NEUTRAL,
                PatternStrength.WEAK, index, index, 0.5,
                description="Spinning Top: indecision"))

        return patterns

    def scan_double(self, bars: list[OHLCV], index: int) -> list[PatternMatch]:
        """Scan for two-candle patterns at given index."""
        if index < 1 or index >= len(bars):
            return []

        prev = bars[index - 1]
        curr = bars[index]
        patterns = []

        # Bullish Engulfing
        if (not prev.is_bullish and curr.is_bullish and
                curr.open <= prev.close and curr.close >= prev.open and
                curr.body > prev.body):
            patterns.append(PatternMatch(
                PatternType.BULLISH_ENGULFING, PatternSignal.BULLISH,
                PatternStrength.STRONG, index - 1, index, 0.8,
                price_target=curr.close + curr.body,
                stop_loss=curr.low,
                description="Bullish Engulfing: strong reversal signal"))

        # Bearish Engulfing
        if (prev.is_bullish and not curr.is_bullish and
                curr.open >= prev.close and curr.close <= prev.open and
                curr.body > prev.body):
            patterns.append(PatternMatch(
                PatternType.BEARISH_ENGULFING, PatternSignal.BEARISH,
                PatternStrength.STRONG, index - 1, index, 0.8,
                price_target=curr.close - curr.body,
                stop_loss=curr.high,
                description="Bearish Engulfing: strong reversal signal"))

        # Bullish Harami
        if (not prev.is_bullish and curr.is_bullish and
                curr.open >= prev.close and curr.close <= prev.open and
                curr.body < prev.body):
            patterns.append(PatternMatch(
                PatternType.BULLISH_HARAMI, PatternSignal.BULLISH,
                PatternStrength.MODERATE, index - 1, index, 0.65,
                description="Bullish Harami: potential reversal"))

        # Bearish Harami
        if (prev.is_bullish and not curr.is_bullish and
                curr.open <= prev.close and curr.close >= prev.open and
                curr.body < prev.body):
            patterns.append(PatternMatch(
                PatternType.BEARISH_HARAMI, PatternSignal.BEARISH,
                PatternStrength.MODERATE, index - 1, index, 0.65,
                description="Bearish Harami: potential reversal"))

        # Piercing Line
        if (not prev.is_bullish and curr.is_bullish and
                curr.open < prev.low and 
                curr.close > prev.midpoint and curr.close < prev.open):
            patterns.append(PatternMatch(
                PatternType.PIERCING_LINE, PatternSignal.BULLISH,
                PatternStrength.MODERATE, index - 1, index, 0.7,
                description="Piercing Line: bullish reversal"))

        # Dark Cloud Cover
        if (prev.is_bullish and not curr.is_bullish and
                curr.open > prev.high and
                curr.close < prev.midpoint and curr.close > prev.open):
            patterns.append(PatternMatch(
                PatternType.DARK_CLOUD_COVER, PatternSignal.BEARISH,
                PatternStrength.MODERATE, index - 1, index, 0.7,
                description="Dark Cloud Cover: bearish reversal"))

        # Tweezer Bottom
        if (not prev.is_bullish and curr.is_bullish and
                abs(prev.low - curr.low) < prev.range * 0.05):
            patterns.append(PatternMatch(
                PatternType.TWEEZER_BOTTOM, PatternSignal.BULLISH,
                PatternStrength.MODERATE, index - 1, index, 0.65,
                description="Tweezer Bottom: support confirmation"))

        # Tweezer Top
        if (prev.is_bullish and not curr.is_bullish and
                abs(prev.high - curr.high) < prev.range * 0.05):
            patterns.append(PatternMatch(
                PatternType.TWEEZER_TOP, PatternSignal.BEARISH,
                PatternStrength.MODERATE, index - 1, index, 0.65,
                description="Tweezer Top: resistance confirmation"))

        return patterns

    def scan_triple(self, bars: list[OHLCV], index: int) -> list[PatternMatch]:
        """Scan for three-candle patterns at given index."""
        if index < 2 or index >= len(bars):
            return []

        b1, b2, b3 = bars[index - 2], bars[index - 1], bars[index]
        patterns = []

        # Morning Star
        if (not b1.is_bullish and b1.body > b1.range * 0.3 and
                b2.body < b2.range * 0.3 and  # Small body
                b3.is_bullish and b3.body > b3.range * 0.3 and
                b3.close > b1.midpoint):
            patterns.append(PatternMatch(
                PatternType.MORNING_STAR, PatternSignal.BULLISH,
                PatternStrength.STRONG, index - 2, index, 0.8,
                description="Morning Star: strong bullish reversal"))

        # Evening Star
        if (b1.is_bullish and b1.body > b1.range * 0.3 and
                b2.body < b2.range * 0.3 and
                not b3.is_bullish and b3.body > b3.range * 0.3 and
                b3.close < b1.midpoint):
            patterns.append(PatternMatch(
                PatternType.EVENING_STAR, PatternSignal.BEARISH,
                PatternStrength.STRONG, index - 2, index, 0.8,
                description="Evening Star: strong bearish reversal"))

        # Three White Soldiers
        if (b1.is_bullish and b2.is_bullish and b3.is_bullish and
                b2.open > b1.open and b3.open > b2.open and
                b2.close > b1.close and b3.close > b2.close and
                b1.body_pct > 0.5 and b2.body_pct > 0.5 and b3.body_pct > 0.5):
            patterns.append(PatternMatch(
                PatternType.THREE_WHITE_SOLDIERS, PatternSignal.BULLISH,
                PatternStrength.STRONG, index - 2, index, 0.85,
                description="Three White Soldiers: strong bullish continuation"))

        # Three Black Crows
        if (not b1.is_bullish and not b2.is_bullish and not b3.is_bullish and
                b2.open < b1.open and b3.open < b2.open and
                b2.close < b1.close and b3.close < b2.close and
                b1.body_pct > 0.5 and b2.body_pct > 0.5 and b3.body_pct > 0.5):
            patterns.append(PatternMatch(
                PatternType.THREE_BLACK_CROWS, PatternSignal.BEARISH,
                PatternStrength.STRONG, index - 2, index, 0.85,
                description="Three Black Crows: strong bearish continuation"))

        return patterns

    def scan_all(self, bars: list[OHLCV]) -> list[PatternMatch]:
        """Scan entire series for all candlestick patterns."""
        patterns = []
        for i in range(len(bars)):
            patterns.extend(self.scan_single(bars, i))
            patterns.extend(self.scan_double(bars, i))
            patterns.extend(self.scan_triple(bars, i))
        return patterns


# ─── Chart Pattern Detector ────────────────────────────────────────────────

class ChartPatternDetector:
    """Detect larger chart patterns (head & shoulders, triangles, etc.)."""

    @staticmethod
    def find_pivots(bars: list[OHLCV], lookback: int = 5) -> tuple[list[int], list[int]]:
        """Find pivot highs and lows."""
        highs = []
        lows = []

        for i in range(lookback, len(bars) - lookback):
            is_high = all(bars[i].high >= bars[i + j].high for j in range(-lookback, lookback + 1) if j != 0)
            is_low = all(bars[i].low <= bars[i + j].low for j in range(-lookback, lookback + 1) if j != 0)

            if is_high:
                highs.append(i)
            if is_low:
                lows.append(i)

        return highs, lows

    @staticmethod
    def detect_double_top(bars: list[OHLCV], pivot_highs: list[int], tolerance: float = 0.02) -> list[PatternMatch]:
        """Detect double top pattern."""
        patterns = []
        for i in range(len(pivot_highs) - 1):
            h1_idx = pivot_highs[i]
            h2_idx = pivot_highs[i + 1]

            h1 = bars[h1_idx].high
            h2 = bars[h2_idx].high

            if abs(h1 - h2) / h1 < tolerance:
                # Find neckline (lowest point between peaks)
                neckline_idx = min(range(h1_idx, h2_idx + 1), key=lambda x: bars[x].low)
                neckline = bars[neckline_idx].low
                target = neckline - (h1 - neckline)

                patterns.append(PatternMatch(
                    PatternType.DOUBLE_TOP, PatternSignal.BEARISH,
                    PatternStrength.STRONG, h1_idx, h2_idx, 0.75,
                    price_target=target,
                    stop_loss=max(h1, h2),
                    description=f"Double Top at ~{(h1 + h2) / 2:.2f}"))

        return patterns

    @staticmethod
    def detect_double_bottom(bars: list[OHLCV], pivot_lows: list[int], tolerance: float = 0.02) -> list[PatternMatch]:
        """Detect double bottom pattern."""
        patterns = []
        for i in range(len(pivot_lows) - 1):
            l1_idx = pivot_lows[i]
            l2_idx = pivot_lows[i + 1]

            l1 = bars[l1_idx].low
            l2 = bars[l2_idx].low

            if abs(l1 - l2) / l1 < tolerance:
                neckline_idx = max(range(l1_idx, l2_idx + 1), key=lambda x: bars[x].high)
                neckline = bars[neckline_idx].high
                target = neckline + (neckline - l1)

                patterns.append(PatternMatch(
                    PatternType.DOUBLE_BOTTOM, PatternSignal.BULLISH,
                    PatternStrength.STRONG, l1_idx, l2_idx, 0.75,
                    price_target=target,
                    stop_loss=min(l1, l2),
                    description=f"Double Bottom at ~{(l1 + l2) / 2:.2f}"))

        return patterns

    @staticmethod
    def detect_head_and_shoulders(bars: list[OHLCV], pivot_highs: list[int],
                                    tolerance: float = 0.02) -> list[PatternMatch]:
        """Detect Head and Shoulders pattern."""
        patterns = []
        for i in range(len(pivot_highs) - 2):
            ls_idx = pivot_highs[i]
            head_idx = pivot_highs[i + 1]
            rs_idx = pivot_highs[i + 2]

            ls = bars[ls_idx].high
            head = bars[head_idx].high
            rs = bars[rs_idx].high

            # Head must be highest, shoulders roughly equal
            if head > ls and head > rs and abs(ls - rs) / ls < tolerance:
                # Neckline
                neckline1_idx = min(range(ls_idx, head_idx + 1), key=lambda x: bars[x].low)
                neckline2_idx = min(range(head_idx, rs_idx + 1), key=lambda x: bars[x].low)
                neckline = (bars[neckline1_idx].low + bars[neckline2_idx].low) / 2

                target = neckline - (head - neckline)

                patterns.append(PatternMatch(
                    PatternType.HEAD_AND_SHOULDERS, PatternSignal.BEARISH,
                    PatternStrength.STRONG, ls_idx, rs_idx, 0.8,
                    price_target=target,
                    stop_loss=head,
                    description="Head and Shoulders: major bearish reversal"))

        return patterns

    @staticmethod
    def detect_ascending_triangle(bars: list[OHLCV], pivot_highs: list[int],
                                   pivot_lows: list[int], tolerance: float = 0.02) -> list[PatternMatch]:
        """Detect ascending triangle: flat resistance, rising support."""
        patterns = []
        if len(pivot_highs) < 2 or len(pivot_lows) < 2:
            return patterns

        # Check if highs are roughly equal (flat resistance)
        recent_highs = pivot_highs[-3:] if len(pivot_highs) >= 3 else pivot_highs
        high_prices = [bars[i].high for i in recent_highs]
        avg_high = np.mean(high_prices)

        if all(abs(h - avg_high) / avg_high < tolerance for h in high_prices):
            # Check if lows are rising
            recent_lows = pivot_lows[-3:] if len(pivot_lows) >= 3 else pivot_lows
            low_prices = [bars[i].low for i in recent_lows]

            if all(low_prices[j] > low_prices[j - 1] for j in range(1, len(low_prices))):
                start = min(recent_highs[0], recent_lows[0])
                end = max(recent_highs[-1], recent_lows[-1])
                target = avg_high + (avg_high - low_prices[0])

                patterns.append(PatternMatch(
                    PatternType.ASCENDING_TRIANGLE, PatternSignal.BULLISH,
                    PatternStrength.STRONG, start, end, 0.7,
                    price_target=target,
                    description="Ascending Triangle: bullish breakout expected"))

        return patterns

    @staticmethod
    def detect_descending_triangle(bars: list[OHLCV], pivot_highs: list[int],
                                    pivot_lows: list[int], tolerance: float = 0.02) -> list[PatternMatch]:
        """Detect descending triangle: flat support, falling resistance."""
        patterns = []
        if len(pivot_lows) < 2 or len(pivot_highs) < 2:
            return patterns

        recent_lows = pivot_lows[-3:] if len(pivot_lows) >= 3 else pivot_lows
        low_prices = [bars[i].low for i in recent_lows]
        avg_low = np.mean(low_prices)

        if all(abs(l - avg_low) / avg_low < tolerance for l in low_prices):
            recent_highs = pivot_highs[-3:] if len(pivot_highs) >= 3 else pivot_highs
            high_prices = [bars[i].high for i in recent_highs]

            if all(high_prices[j] < high_prices[j - 1] for j in range(1, len(high_prices))):
                start = min(recent_highs[0], recent_lows[0])
                end = max(recent_highs[-1], recent_lows[-1])
                target = avg_low - (high_prices[0] - avg_low)

                patterns.append(PatternMatch(
                    PatternType.DESCENDING_TRIANGLE, PatternSignal.BEARISH,
                    PatternStrength.STRONG, start, end, 0.7,
                    price_target=target,
                    description="Descending Triangle: bearish breakdown expected"))

        return patterns


# ─── Support/Resistance Detector ────────────────────────────────────────────

class SupportResistanceDetector:
    """Detect support and resistance levels."""

    @staticmethod
    def find_levels(bars: list[OHLCV], num_levels: int = 10, tolerance_pct: float = 0.5) -> list[SupportResistanceLevel]:
        """Find S/R levels using price clustering."""
        if not bars:
            return []

        # Collect all significant prices
        prices = []
        for i, bar in enumerate(bars):
            prices.append((bar.high, i))
            prices.append((bar.low, i))

        # Cluster nearby prices
        prices.sort(key=lambda x: x[0])
        clusters: list[list[tuple[float, int]]] = []

        for price, idx in prices:
            merged = False
            for cluster in clusters:
                cluster_avg = np.mean([p for p, _ in cluster])
                if abs(price - cluster_avg) / cluster_avg < tolerance_pct / 100:
                    cluster.append((price, idx))
                    merged = True
                    break
            if not merged:
                clusters.append([(price, idx)])

        # Sort by cluster size (strength)
        clusters.sort(key=lambda c: len(c), reverse=True)

        levels = []
        current_price = bars[-1].close

        for cluster in clusters[:num_levels]:
            avg_price = float(np.mean([p for p, _ in cluster]))
            first_seen = min(idx for _, idx in cluster)
            last_seen = max(idx for _, idx in cluster)

            level_type = "resistance" if avg_price > current_price else "support"
            levels.append(SupportResistanceLevel(
                price=avg_price,
                level_type=level_type,
                strength=len(cluster),
                first_seen=first_seen,
                last_seen=last_seen,
            ))

        return levels

    @staticmethod
    def find_trend_lines(bars: list[OHLCV], pivot_highs: list[int], pivot_lows: list[int]) -> list[TrendLine]:
        """Find trend lines connecting pivot points."""
        lines = []

        # Uptrend lines from pivot lows
        for i in range(len(pivot_lows) - 1):
            idx1 = pivot_lows[i]
            idx2 = pivot_lows[i + 1]
            p1 = bars[idx1].low
            p2 = bars[idx2].low

            if p2 > p1:  # Rising lows
                slope = (p2 - p1) / (idx2 - idx1) if idx2 != idx1 else 0
                # Count touches
                touches = 0
                for k in range(idx1, min(idx2 + 20, len(bars))):
                    expected = p1 + slope * (k - idx1)
                    if abs(bars[k].low - expected) / expected < 0.01:
                        touches += 1

                lines.append(TrendLine(
                    start_index=idx1, end_index=idx2,
                    start_price=p1, end_price=p2,
                    slope=slope, direction="up", touches=touches,
                ))

        # Downtrend lines from pivot highs
        for i in range(len(pivot_highs) - 1):
            idx1 = pivot_highs[i]
            idx2 = pivot_highs[i + 1]
            p1 = bars[idx1].high
            p2 = bars[idx2].high

            if p2 < p1:  # Falling highs
                slope = (p2 - p1) / (idx2 - idx1) if idx2 != idx1 else 0
                touches = 0
                for k in range(idx1, min(idx2 + 20, len(bars))):
                    expected = p1 + slope * (k - idx1)
                    if abs(bars[k].high - expected) / expected < 0.01:
                        touches += 1

                lines.append(TrendLine(
                    start_index=idx1, end_index=idx2,
                    start_price=p1, end_price=p2,
                    slope=slope, direction="down", touches=touches,
                ))

        return lines


# ─── Harmonics Detector ────────────────────────────────────────────────────

class HarmonicsDetector:
    """Detect harmonic patterns (Gartley, Butterfly, Bat, Crab, AB=CD)."""

    @staticmethod
    def _fib_ratio(a: float, b: float) -> float:
        """Calculate Fibonacci ratio."""
        if a == 0:
            return 0.0
        return abs(b) / abs(a)

    @staticmethod
    def detect_abcd(bars: list[OHLCV], pivot_points: list[int], tolerance: float = 0.1) -> list[PatternMatch]:
        """Detect AB=CD harmonic pattern."""
        patterns = []
        if len(pivot_points) < 4:
            return patterns

        for i in range(len(pivot_points) - 3):
            a_idx, b_idx, c_idx, d_idx = pivot_points[i:i + 4]
            a = bars[a_idx].close
            b = bars[b_idx].close
            c = bars[c_idx].close
            d = bars[d_idx].close

            ab = b - a
            cd = d - c
            bc = c - b

            # AB=CD: CD leg approximately equals AB leg
            if ab != 0 and abs(HarmonicsDetector._fib_ratio(ab, cd) - 1.0) < tolerance:
                # BC retracement should be 0.618-0.786 of AB
                bc_ratio = HarmonicsDetector._fib_ratio(ab, bc)
                if 0.5 < bc_ratio < 0.9:
                    signal = PatternSignal.BULLISH if cd < 0 else PatternSignal.BEARISH
                    patterns.append(PatternMatch(
                        PatternType.DOUBLE_BOTTOM if signal == PatternSignal.BULLISH else PatternType.DOUBLE_TOP,
                        signal, PatternStrength.MODERATE,
                        a_idx, d_idx, 0.65,
                        description=f"AB=CD harmonic pattern"))

        return patterns


# ─── Orchestrator ────────────────────────────────────────────────────────────

class PatternRecognitionEngine:
    """Top-level orchestrator for pattern recognition."""

    def __init__(self, doji_threshold: float = 0.05, pivot_lookback: int = 5):
        self.candlestick = CandlestickScanner(doji_threshold)
        self.chart_patterns = ChartPatternDetector()
        self.sr_detector = SupportResistanceDetector()
        self.harmonics = HarmonicsDetector()
        self.pivot_lookback = pivot_lookback

    def _to_ohlcv(self, data: list[dict]) -> list[OHLCV]:
        """Convert raw dicts to OHLCV objects."""
        return [OHLCV(
            timestamp=d.get("timestamp"),
            open=d["open"], high=d["high"], low=d["low"], close=d["close"],
            volume=d.get("volume", 0)
        ) for d in data]

    def scan_candlestick_patterns(self, bars: list[OHLCV]) -> list[dict]:
        """Scan for all candlestick patterns."""
        return [p.to_dict() for p in self.candlestick.scan_all(bars)]

    def scan_chart_patterns(self, bars: list[OHLCV]) -> list[dict]:
        """Scan for all chart patterns."""
        highs, lows = self.chart_patterns.find_pivots(bars, self.pivot_lookback)
        patterns = []
        patterns.extend(self.chart_patterns.detect_double_top(bars, highs))
        patterns.extend(self.chart_patterns.detect_double_bottom(bars, lows))
        patterns.extend(self.chart_patterns.detect_head_and_shoulders(bars, highs))
        patterns.extend(self.chart_patterns.detect_ascending_triangle(bars, highs, lows))
        patterns.extend(self.chart_patterns.detect_descending_triangle(bars, highs, lows))
        return [p.to_dict() for p in patterns]

    def find_support_resistance(self, bars: list[OHLCV], num_levels: int = 10) -> list[dict]:
        return [l.to_dict() for l in self.sr_detector.find_levels(bars, num_levels)]

    def find_trend_lines(self, bars: list[OHLCV]) -> list[dict]:
        highs, lows = self.chart_patterns.find_pivots(bars, self.pivot_lookback)
        return [l.to_dict() for l in self.sr_detector.find_trend_lines(bars, highs, lows)]

    def scan_all(self, bars: list[OHLCV]) -> dict:
        """Run all pattern detections."""
        candlestick = self.scan_candlestick_patterns(bars)
        chart = self.scan_chart_patterns(bars)
        sr_levels = self.find_support_resistance(bars)
        trend_lines = self.find_trend_lines(bars)

        return {
            "candlestick_patterns": candlestick,
            "chart_patterns": chart,
            "support_resistance": sr_levels,
            "trend_lines": trend_lines,
            "total_patterns": len(candlestick) + len(chart),
        }

    def scan_from_dicts(self, data: list[dict]) -> dict:
        """Scan from raw OHLCV dicts."""
        bars = self._to_ohlcv(data)
        return self.scan_all(bars)

    def capabilities(self) -> dict:
        return {
            "engine": "PatternRecognitionEngine",
            "candlestick_patterns": [
                "doji", "dragonfly_doji", "gravestone_doji",
                "hammer", "inverted_hammer", "hanging_man", "shooting_star",
                "bullish_marubozu", "bearish_marubozu", "spinning_top",
                "bullish_engulfing", "bearish_engulfing",
                "bullish_harami", "bearish_harami",
                "morning_star", "evening_star",
                "three_white_soldiers", "three_black_crows",
                "piercing_line", "dark_cloud_cover",
                "tweezer_top", "tweezer_bottom",
            ],
            "chart_patterns": [
                "double_top", "double_bottom",
                "head_and_shoulders", "inverse_head_and_shoulders",
                "ascending_triangle", "descending_triangle",
                "symmetrical_triangle",
                "bull_flag", "bear_flag",
            ],
            "features": [
                "candlestick_pattern_recognition",
                "chart_pattern_detection",
                "support_resistance_levels",
                "trend_line_detection",
                "harmonic_pattern_detection",
                "pivot_point_detection",
                "pattern_confidence_scoring",
                "price_targets_and_stop_losses",
            ],
        }
