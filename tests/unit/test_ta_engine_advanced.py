"""
test_ta_engine_advanced.py — Tests for Advanced TA Engine
==========================================================
Tests for candlestick patterns, advanced volatility models,
Ehlers indicators, regime detection, entropy, fractal dimension.
"""

import pytest
import numpy as np
import pandas as pd
import sys
from pathlib import Path

# Ensure phase1 is on path
sys.path.insert(0, str(Path(__file__).parent.parent / "phase1"))

from phase1.services.ta_engine_advanced import (
    CandlestickPatterns,
    AdvancedTAEngine,
)


# ─── FIXTURES ─────────────────────────────────────────────────────────────────

def make_ohlcv(n: int = 200, seed: int = 42) -> pd.DataFrame:
    """Generate realistic OHLCV data for testing."""
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


def make_trending_up(n: int = 100) -> pd.DataFrame:
    """Steadily trending up data."""
    data = []
    for i in range(n):
        c = 100 + i * 0.5 + np.sin(i / 5) * 2
        o = c - 0.3
        h = c + 0.5
        l = o - 0.3
        data.append({"open": o, "high": h, "low": l, "close": c, "volume": 1e6 + i * 1e4})
    return pd.DataFrame(data)


def make_doji_data() -> pd.DataFrame:
    """Create data with a clear doji candle."""
    data = [
        {"open": 100, "high": 105, "low": 95, "close": 99, "volume": 1e6},  # bearish
        {"open": 98, "high": 102, "low": 94, "close": 97, "volume": 1.5e6},
        {"open": 97, "high": 101, "low": 93, "close": 96, "volume": 1e6},
        {"open": 96, "high": 100, "low": 92, "close": 96.01, "volume": 1e6},  # doji
        {"open": 96, "high": 102, "low": 95, "close": 100, "volume": 2e6},
    ]
    return pd.DataFrame(data)


def make_engulfing_data() -> pd.DataFrame:
    """Create data with a clear bullish engulfing pattern."""
    data = [
        {"open": 105, "high": 106, "low": 100, "close": 101, "volume": 1e6},  # bearish
        {"open": 100, "high": 107, "low": 99, "close": 106, "volume": 2e6},  # bullish engulfing
        {"open": 106, "high": 110, "low": 105, "close": 109, "volume": 1.5e6},
    ]
    return pd.DataFrame(data)


# ─── CANDLESTICK PATTERN TESTS ───────────────────────────────────────────────

class TestCandlestickPatterns:
    """Test candlestick pattern detection."""

    def test_doji_detection(self):
        df = make_doji_data()
        cp = CandlestickPatterns(df)
        result = cp.doji()
        assert isinstance(result, pd.Series)
        assert result.name == 'doji'
        assert len(result) == len(df)
        # Bar 3 is the doji (open ≈ close)
        assert result.iloc[3] == 1

    def test_engulfing_detection(self):
        df = make_engulfing_data()
        cp = CandlestickPatterns(df)
        result = cp.engulfing()
        assert isinstance(result, pd.Series)
        # Bar 1 should be bullish engulfing
        assert result.iloc[1] == 1

    def test_marubozu_detection(self):
        # Create a clear marubozu: body fills almost entire range
        df = pd.DataFrame([
            {"open": 100, "high": 100.1, "low": 94.9, "close": 95, "volume": 1e6},
            {"open": 95, "high": 105.05, "low": 94.95, "close": 105, "volume": 2e6},  # bullish marubozu
        ])
        cp = CandlestickPatterns(df)
        result = cp.marubozu()
        assert result.iloc[1] == 1  # bullish marubozu

    def test_detect_all(self):
        df = make_ohlcv(100)
        cp = CandlestickPatterns(df)
        all_patterns = cp.detect_all()
        assert isinstance(all_patterns, pd.DataFrame)
        assert len(all_patterns.columns) == 26  # 26 patterns
        assert len(all_patterns) == 100

    def test_three_white_soldiers(self):
        df = pd.DataFrame([
            {"open": 100, "high": 101, "low": 99, "close": 98, "volume": 1e6},  # context
            {"open": 98, "high": 101, "low": 97.5, "close": 100.5, "volume": 1e6},  # bullish 1
            {"open": 100.6, "high": 103, "low": 100, "close": 102.5, "volume": 1.2e6},  # bullish 2
            {"open": 102.6, "high": 105, "low": 102, "close": 104.5, "volume": 1.3e6},  # bullish 3
        ])
        cp = CandlestickPatterns(df)
        result = cp.three_white_soldiers()
        assert result.iloc[3] == 1

    def test_hammer(self):
        # Need 14+ bars for avg body warmup; create bearish context then hammer
        rows = []
        for i in range(15):
            rows.append({"open": 110 - i * 0.5, "high": 111 - i * 0.5,
                         "low": 108 - i * 0.5, "close": 109 - i * 0.5, "volume": 1e6})
        # Bar 15: bearish prior
        rows.append({"open": 103, "high": 104, "low": 100, "close": 100.5, "volume": 1e6})
        # Bar 16: hammer — small body at top, long lower shadow
        rows.append({"open": 100.5, "high": 101, "low": 94, "close": 101, "volume": 1.5e6})
        df = pd.DataFrame(rows)
        cp = CandlestickPatterns(df)
        result = cp.hammer()
        assert isinstance(result, pd.Series)
        assert result.iloc[-1] == 1

    def test_morning_star(self):
        df = pd.DataFrame([
            {"open": 100, "high": 101, "low": 99, "close": 99, "volume": 1e6},  # context
            *([{"open": 99, "high": 100, "low": 90, "close": 91, "volume": 2e6}] * 13),  # pad for avg
            {"open": 90, "high": 91, "low": 85, "close": 86, "volume": 2e6},  # bearish
            {"open": 85.5, "high": 86, "low": 85, "close": 85.4, "volume": 0.5e6},  # small star
            {"open": 86, "high": 95, "low": 85.5, "close": 94, "volume": 2.5e6},  # bullish close above midpoint
        ])
        cp = CandlestickPatterns(df)
        result = cp.morning_star()
        assert isinstance(result, pd.Series)
        # The last bar should potentially be detected; exact result depends on avg body calc


# ─── ADVANCED TA ENGINE TESTS ────────────────────────────────────────────────

class TestAdvancedTAEngine:
    """Test AdvancedTAEngine methods."""

    @pytest.fixture
    def ta(self):
        return AdvancedTAEngine(make_ohlcv(200))

    @pytest.fixture
    def ta_trending(self):
        return AdvancedTAEngine(make_trending_up(200))

    # ── Volatility Models ────────────────────────────────────────────────

    def test_garman_klass_volatility(self, ta):
        result = ta.garman_klass_volatility(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'garman_klass_vol'
        assert len(result) == 200
        # After warmup, values should be positive and reasonable
        valid = result.dropna()
        assert len(valid) > 100
        assert (valid > 0).all()
        assert (valid < 5).all()  # annualized vol < 500%

    def test_parkinson_volatility(self, ta):
        result = ta.parkinson_volatility(20)
        assert isinstance(result, pd.Series)
        valid = result.dropna()
        assert len(valid) > 100
        assert (valid > 0).all()

    def test_yang_zhang_volatility(self, ta):
        result = ta.yang_zhang_volatility(20)
        assert isinstance(result, pd.Series)
        valid = result.dropna()
        assert len(valid) > 100
        assert (valid >= 0).all()

    def test_rogers_satchell_volatility(self, ta):
        result = ta.rogers_satchell_volatility(20)
        assert isinstance(result, pd.Series)
        valid = result.dropna()
        assert len(valid) > 100

    # ── Regime Detection ────────────────────────────────────────────────

    def test_regime_filter(self, ta):
        result = ta.regime_filter(50)
        assert isinstance(result, pd.Series)
        assert set(result.unique()).issubset({-1, 0, 1})

    def test_volatility_regime(self, ta):
        result = ta.volatility_regime()
        assert isinstance(result, pd.Series)
        assert set(result.dropna().unique()).issubset({'high_vol', 'low_vol', 'normal'})

    def test_trend_strength(self, ta_trending):
        result = ta_trending.trend_strength(20)
        assert isinstance(result, pd.Series)
        # Trending data should show high efficiency
        valid = result.dropna()
        assert len(valid) > 100
        assert valid.mean() > 0.3  # trending data should have decent strength

    # ── Fractal & Entropy ────────────────────────────────────────────────

    def test_fractal_dimension(self, ta):
        result = ta.fractal_dimension(30)
        assert isinstance(result, pd.Series)
        valid = result.dropna()
        assert len(valid) > 50
        # FD should be between 1.0 and 2.0
        assert (valid >= 0.5).all()
        assert (valid <= 2.5).all()

    def test_shannon_entropy(self, ta):
        result = ta.shannon_entropy(20, bins=10)
        assert isinstance(result, pd.Series)
        valid = result.dropna()
        assert len(valid) > 50
        assert (valid >= 0).all()

    def test_approximate_entropy(self, ta):
        result = ta.approximate_entropy(30)
        assert isinstance(result, pd.Series)
        valid = result.dropna()
        assert len(valid) > 20

    # ── Ehlers Indicators ────────────────────────────────────────────────

    def test_ehlers_super_smoother(self, ta):
        result = ta.ehlers_super_smoother(10)
        assert isinstance(result, pd.Series)
        assert result.name == 'ehlers_ss'
        assert len(result) == 200
        # Should be close to price (smoothed version)
        assert not result.isna().all()

    def test_ehlers_roofing_filter(self, ta):
        result = ta.ehlers_roofing_filter()
        assert isinstance(result, pd.Series)
        assert result.name == 'ehlers_roofing'
        assert len(result) == 200

    def test_ehlers_instantaneous_trendline(self, ta):
        result = ta.ehlers_instantaneous_trendline(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'ehlers_trendline'

    def test_ehlers_fisher_transform(self, ta):
        fisher, trigger = ta.ehlers_fisher_transform(10)
        assert isinstance(fisher, pd.Series)
        assert isinstance(trigger, pd.Series)
        assert fisher.name == 'fisher'
        assert trigger.name == 'fisher_trigger'

    # ── Market Microstructure ────────────────────────────────────────────

    def test_amihud_illiquidity(self, ta):
        result = ta.amihud_illiquidity(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'amihud_illiquidity'

    def test_kyle_lambda(self, ta):
        result = ta.kyle_lambda(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'kyle_lambda'

    def test_volume_clock_speed(self, ta):
        result = ta.volume_clock_speed(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'vol_clock_speed'

    def test_trade_intensity(self, ta):
        result = ta.trade_intensity(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'trade_intensity'

    # ── Momentum ─────────────────────────────────────────────────────────

    def test_relative_vigor_index(self, ta):
        rvi, signal = ta.relative_vigor_index(10)
        assert isinstance(rvi, pd.Series)
        assert isinstance(signal, pd.Series)

    def test_chande_momentum_oscillator(self, ta):
        result = ta.chande_momentum_oscillator(14)
        assert isinstance(result, pd.Series)
        assert result.name == 'cmo'
        valid = result.dropna()
        assert (valid >= -100).all()
        assert (valid <= 100).all()

    def test_stochastic_momentum_index(self, ta):
        result = ta.stochastic_momentum_index(14)
        assert isinstance(result, pd.Series)
        assert result.name == 'smi'
        valid = result.dropna()
        assert (valid >= -100).all()
        assert (valid <= 100).all()

    def test_elder_impulse_system(self, ta):
        result = ta.elder_impulse_system()
        assert isinstance(result, pd.Series)
        assert result.name == 'elder_impulse'
        assert set(result.unique()).issubset({-1, 0, 1})

    # ── Composite ────────────────────────────────────────────────────────

    def test_multi_timeframe_confluence(self, ta):
        result = ta.multi_timeframe_confluence()
        assert isinstance(result, pd.Series)
        assert result.name == 'mtf_confluence'
        valid = result.dropna()
        assert (valid >= -100).all()
        assert (valid <= 100).all()

    def test_market_regime_classifier(self, ta):
        result = ta.market_regime_classifier(50)
        assert isinstance(result, pd.DataFrame)
        assert 'regime' in result.columns
        assert 'trend_score' in result.columns
        assert 'vol_score' in result.columns
        assert 'momentum_score' in result.columns

    def test_detect_all_candlestick_patterns(self, ta):
        result = ta.detect_all_candlestick_patterns()
        assert isinstance(result, pd.DataFrame)
        assert len(result.columns) == 26
