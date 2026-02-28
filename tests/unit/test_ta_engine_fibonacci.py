"""
test_ta_engine_fibonacci.py — Tests for Fibonacci Engine
=========================================================
Tests for Fibonacci retracement/extension, harmonic patterns, Elliott waves,
Gann analysis, regression channels, support/resistance, and pivot points.
"""

import pytest
import numpy as np
import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "phase1"))

from phase1.services.ta_engine_fibonacci import (
    FibonacciEngine,
    FibLevel,
    FibRetracementResult,
    FibExtensionResult,
    HarmonicPattern,
    ElliottWave,
    RegressionChannel,
    FIB_RETRACEMENT_RATIOS,
    FIB_EXTENSION_RATIOS,
    HARMONIC_PATTERNS,
)


# ─── FIXTURES ─────────────────────────────────────────────────────────────────

def make_ohlcv(n: int = 200, seed: int = 42) -> pd.DataFrame:
    rng = np.random.RandomState(seed)
    close = 100.0
    data = []
    for i in range(n):
        ret = rng.normal(0.0005, 0.015)
        close *= (1 + ret)
        o = close * (1 + rng.normal(0, 0.003))
        h = max(o, close) * (1 + abs(rng.normal(0, 0.005)))
        l = min(o, close) * (1 - abs(rng.normal(0, 0.005)))
        v = rng.uniform(1e6, 5e6)
        data.append({"open": o, "high": h, "low": l, "close": close, "volume": v})
    return pd.DataFrame(data)


def make_trending_up(n: int = 100, seed: int = 42) -> pd.DataFrame:
    rng = np.random.RandomState(seed)
    close = 100.0
    data = []
    for i in range(n):
        close += rng.normal(0.5, 0.3)
        o = close - rng.uniform(0.1, 0.5)
        h = close + rng.uniform(0.2, 0.8)
        l = o - rng.uniform(0.1, 0.4)
        v = rng.uniform(1e6, 5e6)
        data.append({"open": o, "high": h, "low": l, "close": close, "volume": v})
    return pd.DataFrame(data)


def make_zigzag(n: int = 200, amp: float = 5.0, period: int = 20, seed: int = 42) -> pd.DataFrame:
    rng = np.random.RandomState(seed)
    data = []
    for i in range(n):
        base = 100 + amp * np.sin(2 * np.pi * i / period)
        noise = rng.normal(0, 0.3)
        c = base + noise
        o = c - rng.uniform(-0.3, 0.3)
        h = max(o, c) + rng.uniform(0.1, 0.5)
        l = min(o, c) - rng.uniform(0.1, 0.5)
        v = rng.uniform(1e6, 5e6)
        data.append({"open": o, "high": h, "low": l, "close": c, "volume": v})
    return pd.DataFrame(data)


# ─── FIBONACCI RETRACEMENT TESTS ─────────────────────────────────────────────

class TestFibonacciRetracement:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_manual_retracement(self, fib):
        result = fib.fibonacci_retracement(high_price=150.0, low_price=100.0)
        assert isinstance(result, list)
        assert len(result) > 0
        for lv in result:
            assert isinstance(lv, FibLevel)
        # Check 50% level
        half = [lv for lv in result if abs(lv.ratio - 0.5) < 0.01]
        assert len(half) == 1
        assert abs(half[0].price - 125.0) < 0.01

    def test_auto_retracement(self, fib):
        result = fib.auto_fibonacci_retracement()
        assert isinstance(result, FibRetracementResult)
        assert result.swing_high > result.swing_low
        assert len(result.levels) >= 5

    def test_retracement_level_order(self, fib):
        result = fib.fibonacci_retracement(high_price=200.0, low_price=100.0)
        prices = [lv.price for lv in result]
        # Levels should be within the swing range area
        for p in prices:
            assert 50.0 <= p <= 250.0  # Allow for extension beyond range

    def test_retracement_ratios(self):
        """Verify standard Fibonacci ratios are present."""
        assert 0.236 in FIB_RETRACEMENT_RATIOS
        assert 0.382 in FIB_RETRACEMENT_RATIOS
        assert 0.5 in FIB_RETRACEMENT_RATIOS
        assert 0.618 in FIB_RETRACEMENT_RATIOS
        assert 0.786 in FIB_RETRACEMENT_RATIOS


# ─── FIBONACCI EXTENSION TESTS ───────────────────────────────────────────────

class TestFibonacciExtension:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_manual_extension(self, fib):
        result = fib.fibonacci_extension(
            point_a=100.0, point_b=150.0, point_c=120.0
        )
        assert isinstance(result, FibExtensionResult)
        assert len(result.levels) > 0

    def test_auto_extension(self, fib):
        result = fib.auto_fibonacci_extension()
        assert isinstance(result, FibExtensionResult)
        assert len(result.levels) >= 3

    def test_extension_ratios(self):
        assert 1.618 in FIB_EXTENSION_RATIOS
        assert 2.618 in FIB_EXTENSION_RATIOS


# ─── FIBONACCI FAN TESTS ─────────────────────────────────────────────────────

class TestFibonacciFan:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_fib_fan(self, fib):
        result = fib.fibonacci_fan(start_idx=10, end_idx=50)
        assert isinstance(result, dict)
        assert len(result) > 0
        for key, series in result.items():
            assert isinstance(series, pd.Series)
            assert len(series) == 200


# ─── FIBONACCI TIME ZONES ────────────────────────────────────────────────────

class TestFibonacciTimeZones:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_time_zones(self, fib):
        zones = fib.fibonacci_time_zones(start_idx=0)
        assert isinstance(zones, list)
        assert len(zones) > 0
        for z in zones:
            assert isinstance(z, int)
            assert z >= 0


# ─── FIBONACCI ARCS ──────────────────────────────────────────────────────────

class TestFibonacciArcs:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_arcs(self, fib):
        result = fib.fibonacci_arcs(start_idx=10, end_idx=50)
        assert isinstance(result, dict)
        assert len(result) > 0


# ─── FIBONACCI CHANNEL ───────────────────────────────────────────────────────

class TestFibonacciChannel:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_channel(self, fib):
        result = fib.fibonacci_channel(start_idx=10, end_idx=50, end2_idx=100)
        assert isinstance(result, dict)
        assert len(result) > 0


# ─── REGRESSION CHANNEL TESTS ────────────────────────────────────────────────

class TestRegressionChannel:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_trending_up(100))

    def test_linear_regression_channel(self, fib):
        result = fib.linear_regression_channel(period=50)
        assert isinstance(result, RegressionChannel)
        assert hasattr(result, 'center_line')
        assert hasattr(result, 'upper_line')
        assert hasattr(result, 'lower_line')
        assert hasattr(result, 'r_squared')

    def test_quadratic_regression_channel(self, fib):
        result = fib.quadratic_regression_channel(period=50)
        assert isinstance(result, dict)
        assert 'center' in result

    def test_logarithmic_regression_channel(self, fib):
        result = fib.logarithmic_regression_channel(period=50)
        assert isinstance(result, dict)
        assert 'center' in result


# ─── ANDREWS PITCHFORK TESTS ─────────────────────────────────────────────────

class TestAndrewsPitchfork:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_zigzag(200))

    def test_manual_pitchfork(self, fib):
        result = fib.andrews_pitchfork(p1_idx=0, p2_idx=10, p3_idx=20)
        assert isinstance(result, dict)
        assert 'median' in result
        assert 'upper' in result
        assert 'lower' in result

    def test_auto_pitchfork(self, fib):
        result = fib.auto_andrews_pitchfork()
        assert isinstance(result, dict)
        assert 'median' in result


# ─── GANN TESTS ──────────────────────────────────────────────────────────────

class TestGann:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_gann_fan(self, fib):
        result = fib.gann_fan(anchor_idx=50, anchor_price=100.0)
        assert isinstance(result, dict)
        assert len(result) > 0
        # Should have multiple angle lines
        for key, series in result.items():
            assert isinstance(series, pd.Series)

    def test_gann_square_of_nine(self, fib):
        result = fib.gann_square_of_nine(price=100.0)
        assert isinstance(result, dict)
        assert 'support' in result
        assert 'resistance' in result
        assert len(result['support']) > 0
        assert len(result['resistance']) > 0


# ─── HARMONIC PATTERN TESTS ──────────────────────────────────────────────────

class TestHarmonicPatterns:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_zigzag(300, amp=8.0, period=30))

    def test_detect_harmonic_patterns(self, fib):
        patterns = fib.detect_harmonic_patterns()
        assert isinstance(patterns, list)
        for p in patterns:
            assert isinstance(p, HarmonicPattern)
            assert p.pattern_type in HARMONIC_PATTERNS
            assert 0 <= p.confidence <= 1.0
            assert hasattr(p, 'x')
            assert hasattr(p, 'a')
            assert hasattr(p, 'b')
            assert hasattr(p, 'c')
            assert hasattr(p, 'd')

    def test_harmonic_pattern_data(self):
        """Verify harmonic pattern ratio definitions."""
        assert 'gartley' in HARMONIC_PATTERNS
        assert 'butterfly' in HARMONIC_PATTERNS
        assert 'bat' in HARMONIC_PATTERNS
        assert 'crab' in HARMONIC_PATTERNS
        assert 'shark' in HARMONIC_PATTERNS
        assert 'cypher' in HARMONIC_PATTERNS

    def test_harmonic_ratios_structure(self):
        for name, ratios in HARMONIC_PATTERNS.items():
            assert 'xab' in ratios
            assert 'abc' in ratios
            assert 'bcd' in ratios
            assert 'xad' in ratios
            for key, (lo, hi) in ratios.items():
                assert lo <= hi, f"{name}.{key}: lo={lo} > hi={hi}"


# ─── ELLIOTT WAVE TESTS ──────────────────────────────────────────────────────

class TestElliottWaves:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_zigzag(300, amp=10.0, period=40))

    def test_detect_impulse_waves(self, fib):
        waves = fib.detect_impulse_waves()
        assert isinstance(waves, list)
        for w in waves:
            assert isinstance(w, ElliottWave)
            assert w.wave_type in ('impulse', 'corrective')
            assert hasattr(w, 'waves')
            assert hasattr(w, 'degree')
            assert hasattr(w, 'confidence')

    def test_wave_count_labels(self, fib):
        labels = fib.wave_count_labels()
        assert isinstance(labels, pd.DataFrame)
        assert 'label' in labels.columns


# ─── SUPPORT / RESISTANCE TESTS ──────────────────────────────────────────────

class TestSupportResistance:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_auto_sr_cluster(self, fib):
        result = fib.auto_support_resistance(method='cluster', max_levels=10)
        assert isinstance(result, dict)
        assert 'support' in result
        assert 'resistance' in result
        assert len(result['support']) + len(result['resistance']) > 0

    def test_auto_sr_volume(self, fib):
        result = fib.auto_support_resistance(method='volume', max_levels=8)
        assert isinstance(result, dict)
        assert 'support' in result
        assert 'resistance' in result

    def test_auto_sr_fractal(self, fib):
        result = fib.auto_support_resistance(method='fractal', max_levels=10)
        assert isinstance(result, dict)
        assert 'support' in result
        assert 'resistance' in result


# ─── PIVOT POINT TESTS ───────────────────────────────────────────────────────

class TestPivotPoints:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_ohlcv(200))

    def test_camarilla_pivots(self, fib):
        result = fib.camarilla_pivot_points()
        assert isinstance(result, dict)
        assert 'PP' in result
        assert 'R1' in result
        assert 'S1' in result

    def test_woodies_pivots(self, fib):
        result = fib.woodies_pivot_points()
        assert isinstance(result, dict)
        assert 'PP' in result

    def test_demark_pivots(self, fib):
        result = fib.demark_pivot_points()
        assert isinstance(result, dict)
        assert 'PP' in result


# ─── SWING DETECTION TESTS ───────────────────────────────────────────────────

class TestSwingDetection:

    @pytest.fixture
    def fib(self):
        return FibonacciEngine(make_zigzag(200, amp=5.0, period=20))

    def test_find_swing_highs(self, fib):
        highs = fib._find_swing_highs(lookback=5)
        assert isinstance(highs, list)
        assert len(highs) > 0
        for h in highs:
            assert isinstance(h, tuple)
            assert len(h) == 2  # (idx, price)

    def test_find_swing_lows(self, fib):
        lows = fib._find_swing_lows(lookback=5)
        assert isinstance(lows, list)
        assert len(lows) > 0
        for l in lows:
            assert isinstance(l, tuple)
            assert len(l) == 2  # (idx, price)

    def test_zigzag_points(self, fib):
        points = fib._find_zigzag_points(threshold=0.02)
        assert isinstance(points, list)
        assert len(points) > 0

    def test_swings_alternate(self, fib):
        """Swing highs and lows should alternate in zigzag."""
        points = fib._find_zigzag_points(threshold=0.02)
        if len(points) >= 3:
            # Types should alternate high/low (type is element [2])
            for i in range(len(points) - 2):
                assert points[i][2] != points[i + 1][2], "Consecutive same-type swing points"
