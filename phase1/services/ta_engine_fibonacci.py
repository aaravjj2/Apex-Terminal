"""
ta_engine_fibonacci.py — Fibonacci, Gann & Harmonic Pattern Analysis
=====================================================================
Bloomberg/TradingView-grade Fibonacci and geometric analysis tools:
- Fibonacci Retracement (auto-detected & manual)
- Fibonacci Extensions
- Fibonacci Fans
- Fibonacci Time Zones
- Fibonacci Arcs
- Fibonacci Channel
- Gann Fan / Gann Square
- Harmonic Pattern Detection (XABCD)
- Regression Channels (linear, quadratic, logarithmic)
- Andrew's Pitchfork
- Elliott Wave helpers

Usage:
    from phase1.services.ta_engine_fibonacci import FibonacciEngine
    fib = FibonacciEngine(df)
    levels = fib.auto_fibonacci_retracement()
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional, Tuple, List, Dict, NamedTuple
from dataclasses import dataclass, field
import math


# ─── DATA STRUCTURES ─────────────────────────────────────────────────────────

@dataclass
class FibLevel:
    """Single Fibonacci level."""
    ratio: float
    price: float
    label: str


@dataclass
class FibRetracementResult:
    """Fibonacci retracement result."""
    swing_high: float
    swing_low: float
    swing_high_idx: int
    swing_low_idx: int
    direction: str  # 'up' or 'down'
    levels: List[FibLevel]


@dataclass
class FibExtensionResult:
    """Fibonacci extension result."""
    point_a: float
    point_b: float
    point_c: float
    levels: List[FibLevel]


@dataclass
class HarmonicPattern:
    """Detected harmonic pattern (XABCD)."""
    pattern_type: str  # 'gartley', 'butterfly', 'bat', 'crab', 'shark', 'cypher'
    direction: str  # 'bullish' or 'bearish'
    confidence: float  # 0-1
    x: Tuple[int, float]  # (index, price)
    a: Tuple[int, float]
    b: Tuple[int, float]
    c: Tuple[int, float]
    d: Tuple[int, float]
    completion_zone: Tuple[float, float]  # (low, high) of potential reversal zone


@dataclass
class ElliottWave:
    """Elliott Wave structure."""
    wave_type: str  # 'impulse' or 'corrective'
    waves: List[Tuple[int, float]]  # [(index, price), ...]
    degree: str  # 'primary', 'intermediate', 'minor'
    confidence: float


@dataclass
class RegressionChannel:
    """Regression channel result."""
    slope: float
    intercept: float
    r_squared: float
    upper_line: pd.Series
    center_line: pd.Series
    lower_line: pd.Series
    std_dev: float


# ─── FIBONACCI RATIOS ────────────────────────────────────────────────────────

FIB_RETRACEMENT_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
FIB_EXTENSION_RATIOS = [0.0, 0.382, 0.618, 1.0, 1.272, 1.618, 2.0, 2.618, 3.618, 4.236]

FIB_LABELS = {
    0.0: "0%",
    0.236: "23.6%",
    0.382: "38.2%",
    0.5: "50%",
    0.618: "61.8%",
    0.786: "78.6%",
    1.0: "100%",
    1.272: "127.2%",
    1.618: "161.8%",
    2.0: "200%",
    2.618: "261.8%",
    3.618: "361.8%",
    4.236: "423.6%",
}

# ─── HARMONIC PATTERN RATIOS ─────────────────────────────────────────────────

HARMONIC_PATTERNS = {
    'gartley': {
        'xab': (0.618, 0.618),  # (min, max) for AB/XA
        'abc': (0.382, 0.886),
        'bcd': (1.272, 1.618),
        'xad': (0.786, 0.786),
    },
    'butterfly': {
        'xab': (0.786, 0.786),
        'abc': (0.382, 0.886),
        'bcd': (1.618, 2.618),
        'xad': (1.272, 1.618),
    },
    'bat': {
        'xab': (0.382, 0.5),
        'abc': (0.382, 0.886),
        'bcd': (1.618, 2.618),
        'xad': (0.886, 0.886),
    },
    'crab': {
        'xab': (0.382, 0.618),
        'abc': (0.382, 0.886),
        'bcd': (2.24, 3.618),
        'xad': (1.618, 1.618),
    },
    'shark': {
        'xab': (0.382, 0.618),
        'abc': (1.13, 1.618),
        'bcd': (1.618, 2.24),
        'xad': (0.886, 1.13),
    },
    'cypher': {
        'xab': (0.382, 0.618),
        'abc': (1.13, 1.414),
        'bcd': (1.272, 2.0),
        'xad': (0.786, 0.786),
    },
}


class FibonacciEngine:
    """Bloomberg/TradingView-grade Fibonacci & geometric analysis."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.o = df['open'].values.astype(float)
        self.h = df['high'].values.astype(float)
        self.l = df['low'].values.astype(float)
        self.c = df['close'].values.astype(float)
        self.v = df['volume'].values.astype(float) if 'volume' in df.columns else np.ones(len(df))
        self.n = len(df)
        self.index = df.index

    # ──── Swing Detection ────────────────────────────────────────────────

    def _find_swing_highs(self, lookback: int = 10) -> List[Tuple[int, float]]:
        """Find all swing high points."""
        swings = []
        for i in range(lookback, self.n - lookback):
            if self.h[i] == np.max(self.h[i - lookback:i + lookback + 1]):
                swings.append((i, float(self.h[i])))
        return swings

    def _find_swing_lows(self, lookback: int = 10) -> List[Tuple[int, float]]:
        """Find all swing low points."""
        swings = []
        for i in range(lookback, self.n - lookback):
            if self.l[i] == np.min(self.l[i - lookback:i + lookback + 1]):
                swings.append((i, float(self.l[i])))
        return swings

    def _find_zigzag_points(self, threshold: float = 0.05) -> List[Tuple[int, float, str]]:
        """
        Find ZigZag pivot points for pattern detection.
        Returns list of (index, price, 'high'/'low').
        """
        if self.n < 3:
            return []

        pivots = []
        last_type = None
        last_idx = 0
        last_price = self.c[0]

        for i in range(1, self.n):
            # Check for swing reversal of at least threshold %
            pct_change = (self.h[i] - last_price) / abs(last_price) if last_price != 0 else 0
            pct_change_low = (last_price - self.l[i]) / abs(last_price) if last_price != 0 else 0

            if last_type != 'high' and pct_change >= threshold:
                pivots.append((i, float(self.h[i]), 'high'))
                last_type = 'high'
                last_idx = i
                last_price = self.h[i]
            elif last_type != 'low' and pct_change_low >= threshold:
                pivots.append((i, float(self.l[i]), 'low'))
                last_type = 'low'
                last_idx = i
                last_price = self.l[i]
            elif last_type == 'high' and self.h[i] > last_price:
                # Update last high
                pivots[-1] = (i, float(self.h[i]), 'high')
                last_idx = i
                last_price = self.h[i]
            elif last_type == 'low' and self.l[i] < last_price:
                # Update last low
                pivots[-1] = (i, float(self.l[i]), 'low')
                last_idx = i
                last_price = self.l[i]

        return pivots

    # ──── Fibonacci Retracement ──────────────────────────────────────────

    def fibonacci_retracement(self, high_price: float, low_price: float,
                               direction: str = 'down',
                               ratios: Optional[List[float]] = None) -> List[FibLevel]:
        """
        Calculate Fibonacci retracement levels between two points.

        Args:
            high_price: Swing high price
            low_price: Swing low price
            direction: 'up' (retrace from low) or 'down' (retrace from high)
            ratios: Custom ratios (default: standard fib ratios)
        """
        if ratios is None:
            ratios = FIB_RETRACEMENT_RATIOS

        diff = high_price - low_price
        levels = []

        for r in ratios:
            if direction == 'down':
                price = high_price - diff * r
            else:
                price = low_price + diff * r

            levels.append(FibLevel(
                ratio=r,
                price=float(price),
                label=FIB_LABELS.get(r, f"{r * 100:.1f}%"),
            ))

        return levels

    def auto_fibonacci_retracement(self, lookback: int = 50,
                                    ratios: Optional[List[float]] = None) -> FibRetracementResult:
        """
        Auto-detect the most significant swing high/low and compute retracement.
        """
        if self.n < lookback:
            lookback = max(self.n // 2, 3)

        # Use recent data
        window = slice(max(0, self.n - lookback), self.n)
        h = self.h[window]
        l = self.l[window]
        offset = max(0, self.n - lookback)

        high_idx = np.argmax(h)
        low_idx = np.argmin(l)

        swing_high = float(h[high_idx])
        swing_low = float(l[low_idx])

        # Determine direction: if high came after low, trend is up (retrace down)
        if high_idx > low_idx:
            direction = 'up'
        else:
            direction = 'down'

        levels = self.fibonacci_retracement(swing_high, swing_low, direction, ratios)

        return FibRetracementResult(
            swing_high=swing_high,
            swing_low=swing_low,
            swing_high_idx=int(high_idx + offset),
            swing_low_idx=int(low_idx + offset),
            direction=direction,
            levels=levels,
        )

    # ──── Fibonacci Extensions ───────────────────────────────────────────

    def fibonacci_extension(self, point_a: float, point_b: float, point_c: float,
                             ratios: Optional[List[float]] = None) -> FibExtensionResult:
        """
        Fibonacci extension from 3 points (A-B move, C retracement).
        Extension projected from C.

        Args:
            point_a: Start of trend
            point_b: End of trend
            point_c: Retracement point
            ratios: Extension ratios
        """
        if ratios is None:
            ratios = FIB_EXTENSION_RATIOS

        ab_move = point_b - point_a
        levels = []

        for r in ratios:
            price = point_c + ab_move * r
            levels.append(FibLevel(
                ratio=r,
                price=float(price),
                label=FIB_LABELS.get(r, f"{r * 100:.1f}%"),
            ))

        return FibExtensionResult(
            point_a=point_a,
            point_b=point_b,
            point_c=point_c,
            levels=levels,
        )

    def auto_fibonacci_extension(self, lookback: int = 100) -> Optional[FibExtensionResult]:
        """
        Auto-detect ABC pattern and compute extension.
        """
        pivots = self._find_zigzag_points(threshold=0.03)
        if len(pivots) < 3:
            return None

        # Use last 3 pivots
        p1, p2, p3 = pivots[-3], pivots[-2], pivots[-1]
        return self.fibonacci_extension(p1[1], p2[1], p3[1])

    # ──── Fibonacci Fan ──────────────────────────────────────────────────

    def fibonacci_fan(self, start_idx: int, end_idx: int,
                       ratios: Optional[List[float]] = None) -> Dict[str, pd.Series]:
        """
        Fibonacci Fan — trend lines from start through Fibonacci levels.

        Returns dict of ratio -> pd.Series (price level per bar).
        """
        if ratios is None:
            ratios = [0.382, 0.5, 0.618]

        start_price = float(self.c[start_idx])
        end_price = float(self.c[end_idx])
        diff = end_price - start_price
        bars = end_idx - start_idx

        result = {}
        for r in ratios:
            fib_price = start_price + diff * r
            slope = (fib_price - start_price) / max(bars, 1)

            fan_line = np.full(self.n, np.nan)
            for i in range(start_idx, self.n):
                fan_line[i] = start_price + slope * (i - start_idx)

            result[f'fan_{r}'] = pd.Series(fan_line, index=self.index,
                                            name=f'fib_fan_{r}')

        return result

    # ──── Fibonacci Time Zones ───────────────────────────────────────────

    def fibonacci_time_zones(self, start_idx: int) -> List[int]:
        """
        Fibonacci Time Zones — vertical lines at Fibonacci intervals.
        Returns list of bar indices where time zones fall.
        """
        fib_sequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]
        zones = []
        for f in fib_sequence:
            idx = start_idx + f
            if idx < self.n:
                zones.append(idx)
            else:
                break
        return zones

    # ──── Fibonacci Arcs ─────────────────────────────────────────────────

    def fibonacci_arcs(self, start_idx: int, end_idx: int,
                        ratios: Optional[List[float]] = None) -> Dict[str, Dict]:
        """
        Fibonacci Arcs — semicircles at Fibonacci distances.
        Returns center, radius for each arc.
        """
        if ratios is None:
            ratios = [0.382, 0.5, 0.618]

        start_price = float(self.c[start_idx])
        end_price = float(self.c[end_idx])
        dx = end_idx - start_idx
        dy = end_price - start_price
        distance = math.sqrt(dx ** 2 + dy ** 2)

        result = {}
        for r in ratios:
            arc_radius = distance * r
            result[f'arc_{r}'] = {
                'center_idx': start_idx,
                'center_price': start_price,
                'radius': float(arc_radius),
                'ratio': r,
            }
        return result

    # ──── Fibonacci Channel ──────────────────────────────────────────────

    def fibonacci_channel(self, start_idx: int, end_idx: int, end2_idx: int,
                           ratios: Optional[List[float]] = None) -> Dict[str, pd.Series]:
        """
        Fibonacci Channel — parallel lines at Fibonacci distances from trend.

        Args:
            start_idx: Start of trend line
            end_idx: End of trend line
            end2_idx: Point defining channel width (opposite side)
        """
        if ratios is None:
            ratios = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]

        # Trend line
        p1 = float(self.c[start_idx])
        p2 = float(self.c[end_idx])
        p3 = float(self.c[end2_idx])
        bars = end_idx - start_idx
        if bars == 0:
            return {}

        slope = (p2 - p1) / bars
        # Channel width
        baseline = p1 + slope * (end2_idx - start_idx)
        width = p3 - baseline

        result = {}
        for r in ratios:
            line = np.full(self.n, np.nan)
            for i in range(start_idx, self.n):
                line[i] = p1 + slope * (i - start_idx) + width * r
            result[f'channel_{r}'] = pd.Series(line, index=self.index,
                                                name=f'fib_channel_{r}')
        return result

    # ──── Regression Channels ────────────────────────────────────────────

    def linear_regression_channel(self, period: int = 100,
                                   deviations: float = 2.0) -> RegressionChannel:
        """
        Linear regression channel with standard deviation bands.
        """
        if period > self.n:
            period = self.n

        start = self.n - period
        y = self.c[start:]
        x = np.arange(period)

        # Linear regression
        slope = (np.sum(x * y) - np.sum(x) * np.sum(y) / period) / \
                (np.sum(x ** 2) - (np.sum(x)) ** 2 / period)
        intercept = np.mean(y) - slope * np.mean(x)

        # Fitted values
        fitted = slope * x + intercept
        residuals = y - fitted
        std_dev = np.std(residuals)
        r_squared = 1 - np.sum(residuals ** 2) / np.sum((y - np.mean(y)) ** 2)

        # Extend to full length
        center = np.full(self.n, np.nan)
        upper = np.full(self.n, np.nan)
        lower = np.full(self.n, np.nan)

        for i in range(period):
            idx = start + i
            center[idx] = fitted[i]
            upper[idx] = fitted[i] + deviations * std_dev
            lower[idx] = fitted[i] - deviations * std_dev

        return RegressionChannel(
            slope=float(slope),
            intercept=float(intercept),
            r_squared=float(r_squared),
            upper_line=pd.Series(upper, index=self.index, name='reg_upper'),
            center_line=pd.Series(center, index=self.index, name='reg_center'),
            lower_line=pd.Series(lower, index=self.index, name='reg_lower'),
            std_dev=float(std_dev),
        )

    def quadratic_regression_channel(self, period: int = 100,
                                      deviations: float = 2.0) -> Dict[str, pd.Series]:
        """
        Quadratic (polynomial degree 2) regression channel.
        Better for curved trends.
        """
        if period > self.n:
            period = self.n

        start = self.n - period
        y = self.c[start:]
        x = np.arange(period)

        # Quadratic fit
        coeffs = np.polyfit(x, y, 2)
        fitted = np.polyval(coeffs, x)
        residuals = y - fitted
        std_dev = np.std(residuals)

        center = np.full(self.n, np.nan)
        upper = np.full(self.n, np.nan)
        lower = np.full(self.n, np.nan)

        for i in range(period):
            idx = start + i
            center[idx] = fitted[i]
            upper[idx] = fitted[i] + deviations * std_dev
            lower[idx] = fitted[i] - deviations * std_dev

        return {
            'center': pd.Series(center, index=self.index, name='quad_reg_center'),
            'upper': pd.Series(upper, index=self.index, name='quad_reg_upper'),
            'lower': pd.Series(lower, index=self.index, name='quad_reg_lower'),
        }

    def logarithmic_regression_channel(self, period: int = 100,
                                        deviations: float = 2.0) -> Dict[str, pd.Series]:
        """
        Logarithmic regression channel — good for long-term price trends.
        Uses log(price) for regression.
        """
        if period > self.n:
            period = self.n

        start = self.n - period
        y = np.log(np.maximum(self.c[start:], 1e-10))
        x = np.arange(1, period + 1)
        log_x = np.log(x)

        # Linear regression on log-log
        slope = (np.sum(log_x * y) - np.sum(log_x) * np.sum(y) / period) / \
                (np.sum(log_x ** 2) - (np.sum(log_x)) ** 2 / period)
        intercept = np.mean(y) - slope * np.mean(log_x)

        fitted_log = slope * log_x + intercept
        fitted = np.exp(fitted_log)
        residuals = self.c[start:] - fitted
        std_dev = np.std(residuals)

        center = np.full(self.n, np.nan)
        upper = np.full(self.n, np.nan)
        lower = np.full(self.n, np.nan)

        for i in range(period):
            idx = start + i
            center[idx] = fitted[i]
            upper[idx] = fitted[i] + deviations * std_dev
            lower[idx] = fitted[i] - deviations * std_dev

        return {
            'center': pd.Series(center, index=self.index, name='log_reg_center'),
            'upper': pd.Series(upper, index=self.index, name='log_reg_upper'),
            'lower': pd.Series(lower, index=self.index, name='log_reg_lower'),
        }

    # ──── Andrew's Pitchfork ─────────────────────────────────────────────

    def andrews_pitchfork(self, p1_idx: int, p2_idx: int, p3_idx: int) -> Dict[str, pd.Series]:
        """
        Andrew's Pitchfork — median line study.
        Three anchors define a parallel channel system.

        Args:
            p1_idx: First pivot (start of handle)
            p2_idx: Second pivot (swing point)
            p3_idx: Third pivot (opposite swing)
        """
        p1 = float(self.c[p1_idx])
        p2 = float(self.c[p2_idx])
        p3 = float(self.c[p3_idx])

        # Midpoint of P2-P3
        mid_price = (p2 + p3) / 2
        mid_idx = (p2_idx + p3_idx) / 2

        # Median line slope
        bars = mid_idx - p1_idx
        if bars == 0:
            return {}
        slope = (mid_price - p1) / bars

        # Upper prong (through P2)
        offset_upper = p2 - (p1 + slope * (p2_idx - p1_idx))
        # Lower prong (through P3)
        offset_lower = p3 - (p1 + slope * (p3_idx - p1_idx))

        median = np.full(self.n, np.nan)
        upper = np.full(self.n, np.nan)
        lower = np.full(self.n, np.nan)

        for i in range(p1_idx, self.n):
            bars_from_start = i - p1_idx
            median[i] = p1 + slope * bars_from_start
            upper[i] = median[i] + offset_upper
            lower[i] = median[i] + offset_lower

        return {
            'median': pd.Series(median, index=self.index, name='pitchfork_median'),
            'upper': pd.Series(upper, index=self.index, name='pitchfork_upper'),
            'lower': pd.Series(lower, index=self.index, name='pitchfork_lower'),
        }

    def auto_andrews_pitchfork(self, lookback: int = 100) -> Optional[Dict[str, pd.Series]]:
        """Auto-detect 3 pivots and draw pitchfork."""
        pivots = self._find_zigzag_points(threshold=0.03)
        if len(pivots) < 3:
            return None
        p1, p2, p3 = pivots[-3], pivots[-2], pivots[-1]
        return self.andrews_pitchfork(p1[0], p2[0], p3[0])

    # ──── Gann Analysis ──────────────────────────────────────────────────

    def gann_fan(self, anchor_idx: int, anchor_price: Optional[float] = None) -> Dict[str, pd.Series]:
        """
        Gann Fan — lines at specific angles from a point.
        Angles: 1x1 (45°), 1x2, 2x1, 1x3, 3x1, 1x4, 4x1, 1x8, 8x1
        """
        if anchor_price is None:
            anchor_price = float(self.c[anchor_idx])

        # Price per bar ratio (normalize)
        price_range = np.max(self.h) - np.min(self.l)
        time_range = self.n
        scale = price_range / max(time_range, 1)

        # Gann angles as (time multiplier, price multiplier)
        angles = {
            '8x1': (8, 1),
            '4x1': (4, 1),
            '3x1': (3, 1),
            '2x1': (2, 1),
            '1x1': (1, 1),  # 45 degrees
            '1x2': (1, 2),
            '1x3': (1, 3),
            '1x4': (1, 4),
            '1x8': (1, 8),
        }

        result = {}
        for name, (t_mult, p_mult) in angles.items():
            slope = scale * p_mult / max(t_mult, 1)
            line = np.full(self.n, np.nan)
            for i in range(anchor_idx, self.n):
                bars = i - anchor_idx
                line[i] = anchor_price + slope * bars
            result[f'gann_{name}_up'] = pd.Series(line, index=self.index,
                                                    name=f'gann_{name}_up')
            # Also compute downward lines
            line_down = np.full(self.n, np.nan)
            for i in range(anchor_idx, self.n):
                bars = i - anchor_idx
                line_down[i] = anchor_price - slope * bars
            result[f'gann_{name}_down'] = pd.Series(line_down, index=self.index,
                                                      name=f'gann_{name}_down')

        return result

    def gann_square_of_nine(self, price: float, num_levels: int = 8) -> Dict[str, List[float]]:
        """
        Gann Square of Nine — support/resistance levels from a price.
        Rotates the square root of price by 45°, 90°, 180°, 360° increments.
        """
        root = math.sqrt(price)
        levels = {'support': [], 'resistance': []}

        for i in range(1, num_levels + 1):
            # 360° rotations
            res = (root + i * 0.25) ** 2
            sup = (root - i * 0.25) ** 2
            levels['resistance'].append(round(res, 4))
            if sup > 0:
                levels['support'].append(round(sup, 4))

        return levels

    # ──── Harmonic Pattern Detection ─────────────────────────────────────

    def detect_harmonic_patterns(self, threshold: float = 0.03,
                                  tolerance: float = 0.05) -> List[HarmonicPattern]:
        """
        Detect XABCD harmonic patterns in price data.

        Args:
            threshold: ZigZag threshold for pivot detection
            tolerance: Ratio tolerance (e.g., 0.05 = 5% deviation allowed)

        Returns:
            List of detected HarmonicPattern objects
        """
        pivots = self._find_zigzag_points(threshold)
        if len(pivots) < 5:
            return []

        patterns = []

        # Scan all possible 5-point combinations
        for i in range(len(pivots) - 4):
            x_idx, x_price, _ = pivots[i]
            a_idx, a_price, _ = pivots[i + 1]
            b_idx, b_price, _ = pivots[i + 2]
            c_idx, c_price, _ = pivots[i + 3]
            d_idx, d_price, _ = pivots[i + 4]

            # Calculate ratios
            xa = abs(a_price - x_price)
            ab = abs(b_price - a_price)
            bc = abs(c_price - b_price)
            cd = abs(d_price - c_price)

            if xa == 0 or ab == 0 or bc == 0:
                continue

            xab_ratio = ab / xa
            abc_ratio = bc / ab
            bcd_ratio = cd / bc
            xad_ratio = abs(d_price - x_price) / xa

            # Check against each pattern type
            for pattern_name, ratios in HARMONIC_PATTERNS.items():
                xab_ok = self._ratio_in_range(xab_ratio, ratios['xab'], tolerance)
                abc_ok = self._ratio_in_range(abc_ratio, ratios['abc'], tolerance)
                bcd_ok = self._ratio_in_range(bcd_ratio, ratios['bcd'], tolerance)
                xad_ok = self._ratio_in_range(xad_ratio, ratios['xad'], tolerance)

                if xab_ok and abc_ok and bcd_ok and xad_ok:
                    # Determine direction
                    if d_price < x_price and a_price > x_price:
                        direction = 'bullish'
                    elif d_price > x_price and a_price < x_price:
                        direction = 'bearish'
                    else:
                        direction = 'bullish' if d_price < c_price else 'bearish'

                    # Confidence based on how close ratios are to ideal
                    confidence = self._harmonic_confidence(
                        xab_ratio, abc_ratio, bcd_ratio, xad_ratio, ratios, tolerance
                    )

                    # Potential Reversal Zone
                    prz_range = abs(d_price) * 0.02
                    patterns.append(HarmonicPattern(
                        pattern_type=pattern_name,
                        direction=direction,
                        confidence=confidence,
                        x=(x_idx, float(x_price)),
                        a=(a_idx, float(a_price)),
                        b=(b_idx, float(b_price)),
                        c=(c_idx, float(c_price)),
                        d=(d_idx, float(d_price)),
                        completion_zone=(float(d_price - prz_range), float(d_price + prz_range)),
                    ))

        return patterns

    def _ratio_in_range(self, actual: float, expected: Tuple[float, float],
                        tolerance: float) -> bool:
        """Check if a ratio falls within the expected range +/- tolerance."""
        low = expected[0] * (1 - tolerance)
        high = expected[1] * (1 + tolerance)
        return low <= actual <= high

    def _harmonic_confidence(self, xab: float, abc: float, bcd: float, xad: float,
                              pattern: Dict, tolerance: float) -> float:
        """Calculate confidence score based on ratio accuracy."""
        scores = []

        for actual, (lo, hi) in [(xab, pattern['xab']),
                                   (abc, pattern['abc']),
                                   (bcd, pattern['bcd']),
                                   (xad, pattern['xad'])]:
            ideal = (lo + hi) / 2
            deviation = abs(actual - ideal) / max(ideal, 0.001)
            score = max(0, 1 - deviation / tolerance)
            scores.append(score)

        return float(np.mean(scores))

    # ──── Elliott Wave Helpers ───────────────────────────────────────────

    def detect_impulse_waves(self, threshold: float = 0.03) -> List[ElliottWave]:
        """
        Detect potential Elliott Wave impulse patterns (5-wave structure).
        Rules checked:
        1. Wave 2 cannot retrace more than 100% of Wave 1
        2. Wave 3 cannot be the shortest impulse wave
        3. Wave 4 cannot overlap Wave 1 territory
        """
        pivots = self._find_zigzag_points(threshold)
        if len(pivots) < 6:
            return []

        waves = []
        for i in range(len(pivots) - 5):
            pts = pivots[i:i + 6]
            # Extract prices
            p0 = pts[0][1]  # Wave start
            p1 = pts[1][1]  # End of Wave 1
            p2 = pts[2][1]  # End of Wave 2
            p3 = pts[3][1]  # End of Wave 3
            p4 = pts[4][1]  # End of Wave 4
            p5 = pts[5][1]  # End of Wave 5

            # Determine if bullish or bearish impulse
            if p1 > p0:
                # Bullish impulse
                w1 = p1 - p0
                w2 = p1 - p2  # retracement
                w3 = p3 - p2
                w4 = p3 - p4  # retracement
                w5 = p5 - p4

                # Rule 1: Wave 2 < 100% of Wave 1
                if w2 >= w1:
                    continue
                # Rule 2: Wave 3 not shortest
                if w3 < w1 and w3 < w5:
                    continue
                # Rule 3: Wave 4 doesn't overlap Wave 1
                if p4 <= p1:
                    continue
                # All waves should be positive (trending direction)
                if w1 <= 0 or w3 <= 0 or w5 <= 0:
                    continue

                confidence = min(1.0, (w3 / max(w1, 0.001) +
                                       (1 - w2 / max(w1, 0.001)) +
                                       (1 - w4 / max(w3, 0.001))) / 3)

                waves.append(ElliottWave(
                    wave_type='impulse',
                    waves=[(p[0], p[1]) for p in pts],
                    degree='intermediate',
                    confidence=float(max(0, confidence)),
                ))

            elif p1 < p0:
                # Bearish impulse
                w1 = p0 - p1
                w2 = p2 - p1
                w3 = p2 - p3
                w4 = p4 - p3
                w5 = p4 - p5

                if w2 >= w1:
                    continue
                if w3 < w1 and w3 < w5:
                    continue
                if p4 >= p1:
                    continue
                if w1 <= 0 or w3 <= 0 or w5 <= 0:
                    continue

                confidence = min(1.0, (w3 / max(w1, 0.001) +
                                       (1 - w2 / max(w1, 0.001)) +
                                       (1 - w4 / max(w3, 0.001))) / 3)

                waves.append(ElliottWave(
                    wave_type='impulse',
                    waves=[(p[0], p[1]) for p in pts],
                    degree='intermediate',
                    confidence=float(max(0, confidence)),
                ))

        return waves

    def wave_count_labels(self, threshold: float = 0.03) -> pd.DataFrame:
        """
        Generate wave labels for chart overlay.
        Returns DataFrame with columns: bar_index, price, label
        """
        waves = self.detect_impulse_waves(threshold)
        labels = []

        for wave in waves:
            wave_labels = ['0', '1', '2', '3', '4', '5']
            for j, (idx, price) in enumerate(wave.waves):
                labels.append({
                    'bar_index': idx,
                    'price': price,
                    'label': wave_labels[j],
                    'confidence': wave.confidence,
                })

        return pd.DataFrame(labels) if labels else pd.DataFrame(
            columns=['bar_index', 'price', 'label', 'confidence']
        )

    # ──── Support / Resistance Detection ─────────────────────────────────

    def auto_support_resistance(self, method: str = 'cluster',
                                 sensitivity: int = 20,
                                 max_levels: int = 10) -> Dict[str, List[float]]:
        """
        Automatically detect support and resistance levels.

        Methods:
            'cluster': Cluster-based grouping of swing points
            'volume': Volume-at-price based
            'fractal': Fractal highs/lows

        Returns dict with 'support' and 'resistance' lists.
        """
        if method == 'cluster':
            return self._sr_cluster(sensitivity, max_levels)
        elif method == 'volume':
            return self._sr_volume(sensitivity, max_levels)
        else:
            return self._sr_fractal(sensitivity, max_levels)

    def _sr_cluster(self, sensitivity: int, max_levels: int) -> Dict[str, List[float]]:
        """Support/Resistance via price clustering."""
        swing_highs = self._find_swing_highs(sensitivity)
        swing_lows = self._find_swing_lows(sensitivity)

        all_pivots = [(p, 'high') for _, p in swing_highs] + [(p, 'low') for _, p in swing_lows]
        if not all_pivots:
            return {'support': [], 'resistance': []}

        # Cluster nearby price levels
        prices = sorted([p for p, _ in all_pivots])
        clusters = []
        current_cluster = [prices[0]]

        threshold = (max(prices) - min(prices)) * 0.01 if len(prices) > 1 else 1.0

        for i in range(1, len(prices)):
            if prices[i] - prices[i - 1] <= threshold:
                current_cluster.append(prices[i])
            else:
                clusters.append(np.mean(current_cluster))
                current_cluster = [prices[i]]
        clusters.append(np.mean(current_cluster))

        current_price = float(self.c[-1])
        support = sorted([c for c in clusters if c < current_price], reverse=True)[:max_levels]
        resistance = sorted([c for c in clusters if c >= current_price])[:max_levels]

        return {'support': [float(s) for s in support],
                'resistance': [float(r) for r in resistance]}

    def _sr_volume(self, sensitivity: int, max_levels: int) -> Dict[str, List[float]]:
        """Support/Resistance via volume clustering (high volume nodes)."""
        from .ta_engine_volume_profile import VolumeProfileEngine
        vp = VolumeProfileEngine(self.df)
        profile = vp.volume_profile(bins=100)

        current_price = float(self.c[-1])
        support = sorted([l.price for l in profile.levels
                          if l.price < current_price and l.pct_of_total > 1.5],
                         reverse=True)[:max_levels]
        resistance = sorted([l.price for l in profile.levels
                             if l.price >= current_price and l.pct_of_total > 1.5])[:max_levels]

        return {'support': support, 'resistance': resistance}

    def _sr_fractal(self, sensitivity: int, max_levels: int) -> Dict[str, List[float]]:
        """Support/Resistance via Williams Fractals."""
        n = sensitivity // 2
        support = []
        resistance = []

        for i in range(n, self.n - n):
            if self.h[i] == np.max(self.h[i - n:i + n + 1]):
                resistance.append(float(self.h[i]))
            if self.l[i] == np.min(self.l[i - n:i + n + 1]):
                support.append(float(self.l[i]))

        current_price = float(self.c[-1])
        support = sorted([s for s in set(support) if s < current_price], reverse=True)[:max_levels]
        resistance = sorted([r for r in set(resistance) if r >= current_price])[:max_levels]

        return {'support': support, 'resistance': resistance}

    # ──── Pivot Points (Extended) ────────────────────────────────────────

    def camarilla_pivot_points(self) -> Dict[str, float]:
        """
        Camarilla Pivot Points — 8 levels based on yesterday's OHLC.
        S1-S4, R1-R4.
        """
        h = float(self.h[-1])
        l = float(self.l[-1])
        c = float(self.c[-1])
        hl = h - l

        return {
            'R4': c + hl * 1.1 / 2,
            'R3': c + hl * 1.1 / 4,
            'R2': c + hl * 1.1 / 6,
            'R1': c + hl * 1.1 / 12,
            'PP': (h + l + c) / 3,
            'S1': c - hl * 1.1 / 12,
            'S2': c - hl * 1.1 / 6,
            'S3': c - hl * 1.1 / 4,
            'S4': c - hl * 1.1 / 2,
        }

    def woodies_pivot_points(self) -> Dict[str, float]:
        """Woodies Pivot Points — gives more weight to close."""
        h = float(self.h[-1])
        l = float(self.l[-1])
        c = float(self.c[-1])

        pp = (h + l + 2 * c) / 4
        return {
            'R2': pp + (h - l),
            'R1': 2 * pp - l,
            'PP': pp,
            'S1': 2 * pp - h,
            'S2': pp - (h - l),
        }

    def demark_pivot_points(self) -> Dict[str, float]:
        """DeMark Pivot Points — conditional on open vs close."""
        h = float(self.h[-1])
        l = float(self.l[-1])
        c = float(self.c[-1])
        o = float(self.o[-1])

        if c < o:
            x = h + 2 * l + c
        elif c > o:
            x = 2 * h + l + c
        else:
            x = h + l + 2 * c

        return {
            'R1': x / 2 - l,
            'PP': x / 4,
            'S1': x / 2 - h,
        }
