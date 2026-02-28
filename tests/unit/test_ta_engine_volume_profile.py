"""
test_ta_engine_volume_profile.py — Tests for Volume Profile Engine
====================================================================
Tests for volume profile, market profile, anchored VWAP, volume delta,
VSA, smart money flow, and volume-based indicators.
"""

import pytest
import numpy as np
import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "phase1"))

from phase1.services.ta_engine_volume_profile import (
    VolumeProfileEngine,
    VolumeProfileResult,
    VolumeProfileLevel,
    TPOProfile,
    VSASignal,
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


def make_high_volume_at_price(n: int = 100) -> pd.DataFrame:
    """Create data with a clear high volume node at price 100."""
    data = []
    for i in range(n):
        if i < 30:
            # Trade around 100 with high volume
            c = 100 + np.sin(i) * 0.5
            v = 5e6
        elif i < 60:
            # Move up with lower volume
            c = 100 + (i - 30) * 0.3
            v = 1e6
        else:
            # Return near 100
            c = 100 + (n - i) * 0.1
            v = 2e6
        o = c - 0.2
        h = c + 0.5
        l = c - 0.5
        data.append({"open": o, "high": h, "low": l, "close": c, "volume": v})
    return pd.DataFrame(data)


# ─── VOLUME PROFILE TESTS ────────────────────────────────────────────────────

class TestVolumeProfile:

    @pytest.fixture
    def vp(self):
        return VolumeProfileEngine(make_ohlcv(200))

    def test_basic_volume_profile(self, vp):
        result = vp.volume_profile(bins=50)
        assert isinstance(result, VolumeProfileResult)
        assert result.poc > 0
        assert result.vah >= result.val
        assert result.total_volume > 0
        assert len(result.levels) > 0

    def test_volume_profile_levels_sum(self, vp):
        result = vp.volume_profile(bins=50)
        total_from_levels = sum(lv.volume for lv in result.levels)
        # Should approximately equal total volume
        assert abs(total_from_levels - result.total_volume) / result.total_volume < 0.05

    def test_volume_profile_poc_in_range(self, vp):
        result = vp.volume_profile()
        prices = [lv.price for lv in result.levels]
        assert result.poc >= min(prices)
        assert result.poc <= max(prices)

    def test_volume_profile_value_area(self, vp):
        result = vp.volume_profile(value_area_pct=0.70)
        assert result.vah >= result.poc >= result.val or result.vah >= result.val
        assert result.value_area_volume >= result.total_volume * 0.60  # allow some tolerance

    def test_visible_range_profile(self, vp):
        result = vp.visible_range_volume_profile(bins=30)
        assert isinstance(result, VolumeProfileResult)
        assert result.poc > 0

    def test_session_volume_profiles(self, vp):
        profiles = vp.session_volume_profile(session_length=50, bins=20)
        assert len(profiles) >= 3  # 200 bars / 50 = 4 sessions
        for p in profiles:
            assert p.poc > 0

    def test_volume_delta_levels(self, vp):
        result = vp.volume_profile()
        for lv in result.levels:
            assert isinstance(lv, VolumeProfileLevel)
            assert lv.buy_volume >= 0
            assert lv.sell_volume >= 0
            assert abs(lv.delta - (lv.buy_volume - lv.sell_volume)) < 0.01

    def test_high_volume_node_detection(self):
        df = make_high_volume_at_price()
        vp = VolumeProfileEngine(df)
        result = vp.volume_profile(bins=50)
        # POC should be near 100 where we concentrated volume
        assert abs(result.poc - 100) < 5


# ─── MARKET PROFILE (TPO) TESTS ──────────────────────────────────────────────

class TestMarketProfile:

    @pytest.fixture
    def vp(self):
        return VolumeProfileEngine(make_ohlcv(200))

    def test_tpo_profile_basic(self, vp):
        result = vp.tpo_profile()
        assert isinstance(result, TPOProfile)
        assert result.poc > 0
        assert result.vah >= result.val
        assert len(result.price_levels) > 0

    def test_tpo_profile_type(self, vp):
        result = vp.tpo_profile()
        assert result.profile_type in ['normal', 'b-shape', 'P-shape', 'elongated']

    def test_tpo_initial_balance(self, vp):
        result = vp.tpo_profile(ib_periods=5)
        assert result.initial_balance_high >= result.initial_balance_low

    def test_tpo_single_prints(self, vp):
        result = vp.tpo_profile()
        assert isinstance(result.single_prints, list)


# ─── ANCHORED VWAP TESTS ─────────────────────────────────────────────────────

class TestAnchoredVWAP:

    @pytest.fixture
    def vp(self):
        return VolumeProfileEngine(make_ohlcv(200))

    def test_anchored_vwap_basic(self, vp):
        result = vp.anchored_vwap(anchor_idx=50)
        assert 'vwap' in result
        assert 'upper_1' in result
        assert 'lower_1' in result
        assert 'upper_2' in result
        assert 'lower_2' in result

    def test_anchored_vwap_nan_before_anchor(self, vp):
        result = vp.anchored_vwap(anchor_idx=50)
        vwap = result['vwap']
        # First 50 should be NaN
        assert vwap.iloc[:50].isna().all()
        # After anchor should have values
        assert not vwap.iloc[50:].isna().all()

    def test_rolling_vwap(self, vp):
        result = vp.rolling_vwap(period=20)
        assert isinstance(result, dict)
        assert 'vwap' in result
        assert len(result['vwap']) == 200


# ─── VOLUME DELTA TESTS ──────────────────────────────────────────────────────

class TestVolumeDelta:

    @pytest.fixture
    def vp(self):
        return VolumeProfileEngine(make_ohlcv(200))

    def test_volume_delta_basic(self, vp):
        result = vp.volume_delta()
        assert isinstance(result, pd.DataFrame)
        assert 'buy_volume' in result.columns
        assert 'sell_volume' in result.columns
        assert 'delta' in result.columns
        assert 'cumulative_delta' in result.columns
        assert len(result) == 200

    def test_volume_delta_sum(self, vp):
        result = vp.volume_delta()
        # buy + sell should approximately equal total volume
        total = result['buy_volume'] + result['sell_volume']
        volumes = pd.Series(vp.v, index=vp.index)
        ratio = total / volumes
        assert (ratio > 0.95).all()
        assert (ratio < 1.05).all()

    def test_cumulative_volume_delta(self, vp):
        result = vp.cumulative_volume_delta(20)
        assert 'divergence' in result.columns
        assert 'cvd_ma' in result.columns


# ─── VSA TESTS ────────────────────────────────────────────────────────────────

class TestVSA:

    @pytest.fixture
    def vp(self):
        return VolumeProfileEngine(make_ohlcv(200))

    def test_vsa_analysis(self, vp):
        signals = vp.vsa_analysis(20)
        assert isinstance(signals, list)
        for s in signals:
            assert isinstance(s, VSASignal)
            assert s.signal_type in ('buying_climax', 'selling_climax', 'no_demand',
                                      'no_supply', 'stopping_volume', 'upthrust',
                                      'test', 'shakeout')
            assert s.direction in (-1, 1)
            assert 0 <= s.strength <= 1.0

    def test_vsa_signals_series(self, vp):
        result = vp.vsa_signals_series(20)
        assert isinstance(result, pd.DataFrame)
        assert 'vsa_type' in result.columns
        assert 'vsa_direction' in result.columns
        assert 'vsa_strength' in result.columns


# ─── VOLUME-WEIGHTED INDICATORS ──────────────────────────────────────────────

class TestVolumeWeightedIndicators:

    @pytest.fixture
    def vp(self):
        return VolumeProfileEngine(make_ohlcv(200))

    def test_volume_weighted_rsi(self, vp):
        result = vp.volume_weighted_rsi(14)
        assert isinstance(result, pd.Series)
        assert result.name == 'vw_rsi'
        valid = result.dropna()
        assert (valid >= 0).all()
        assert (valid <= 100).all()

    def test_volume_weighted_macd(self, vp):
        result = vp.volume_weighted_macd()
        assert 'macd' in result
        assert 'signal' in result
        assert 'histogram' in result

    def test_volume_profile_indicator(self, vp):
        result = vp.volume_profile_indicator(period=50, bins=20)
        assert isinstance(result, pd.DataFrame)
        assert 'vp_poc' in result.columns
        assert 'vp_vah' in result.columns
        assert 'vp_val' in result.columns

    def test_smart_money_flow(self, vp):
        result = vp.smart_money_flow(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'smart_money_flow'

    def test_obv_oscillator(self, vp):
        result = vp.on_balance_volume_oscillator()
        assert isinstance(result, pd.Series)
        assert result.name == 'obv_osc'

    def test_klinger_volume_oscillator(self, vp):
        result = vp.klinger_volume_oscillator()
        assert 'kvo' in result
        assert 'signal' in result
        assert 'histogram' in result

    def test_williams_accumulation_distribution(self, vp):
        result = vp.williams_accumulation_distribution()
        assert isinstance(result, pd.Series)
        assert result.name == 'williams_ad'

    def test_chaikin_oscillator(self, vp):
        result = vp.chaikin_oscillator()
        assert isinstance(result, pd.Series)
        assert result.name == 'chaikin_osc'

    def test_volume_zone_oscillator(self, vp):
        result = vp.volume_zone_oscillator(14)
        assert isinstance(result, pd.Series)
        assert result.name == 'vzo'

    def test_volume_weighted_momentum(self, vp):
        result = vp.volume_weighted_momentum(14)
        assert isinstance(result, pd.Series)
        assert result.name == 'vw_momentum'

    def test_ease_of_movement_histogram(self, vp):
        result = vp.ease_of_movement_histogram(14)
        assert isinstance(result, pd.Series)
        assert result.name == 'eom_hist'

    def test_put_call_volume_proxy(self, vp):
        result = vp.put_call_volume_proxy(20)
        assert isinstance(result, pd.Series)
        assert result.name == 'pc_volume_proxy'
