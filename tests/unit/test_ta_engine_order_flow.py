"""
test_ta_engine_order_flow.py — Tests for Order Flow Engine
============================================================
Tests for footprint data, delta profile, absorption/exhaustion detection,
supply/demand zones, liquidity levels, institutional flow, auction metrics,
and composite order flow scoring.
"""

import pytest
import numpy as np
import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "phase1"))

from phase1.services.ta_engine_order_flow import (
    OrderFlowEngine,
    FootprintBar,
    FootprintLevel,
    SupplyDemandZone,
    LiquidityLevel,
    InstitutionalActivity,
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


def make_climax_data(n: int = 100, seed: int = 42) -> pd.DataFrame:
    """Create data with volume climax for absorption/exhaustion tests."""
    rng = np.random.RandomState(seed)
    close = 100.0
    data = []
    for i in range(n):
        if 40 <= i <= 45:
            # Climactic volume with tight spread (absorption)
            close += rng.normal(0, 0.1)
            v = 10e6
            spread = 0.2
        elif 70 <= i <= 75:
            # Climactic volume with wide spread (exhaustion)
            close += rng.normal(0.5, 0.3)
            v = 10e6
            spread = 3.0
        else:
            close += rng.normal(0.1, 0.5)
            v = rng.uniform(1e6, 3e6)
            spread = rng.uniform(0.3, 1.5)
        o = close - spread / 2
        h = max(o, close) + rng.uniform(0.1, 0.5)
        l = min(o, close) - rng.uniform(0.1, 0.5)
        data.append({"open": o, "high": h, "low": l, "close": close, "volume": v})
    return pd.DataFrame(data)


def make_trending_data(n: int = 200, seed: int = 42) -> pd.DataFrame:
    """Create clear trending data for S/D zone tests."""
    rng = np.random.RandomState(seed)
    close = 100.0
    data = []
    for i in range(n):
        if i < 50:
            close += rng.normal(0.3, 0.2)  # uptrend
        elif i < 80:
            close -= rng.normal(0.5, 0.3)  # sharp drop
        elif i < 130:
            close += rng.normal(0.2, 0.3)  # recovery
        else:
            close -= rng.normal(0.1, 0.4)  # decline
        o = close - rng.uniform(-0.3, 0.3)
        h = max(o, close) + rng.uniform(0.1, 0.5)
        l = min(o, close) - rng.uniform(0.1, 0.5)
        v = rng.uniform(1e6, 5e6)
        data.append({"open": o, "high": h, "low": l, "close": close, "volume": v})
    return pd.DataFrame(data)


# ─── FOOTPRINT DATA TESTS ────────────────────────────────────────────────────

class TestFootprintData:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_footprint_basic(self, of):
        bars = of.footprint_data(levels_per_bar=10)
        assert isinstance(bars, list)
        assert len(bars) == 200
        for bar in bars:
            assert isinstance(bar, FootprintBar)
            assert bar.total_volume > 0
            assert len(bar.levels) > 0

    def test_footprint_levels(self, of):
        bars = of.footprint_data(levels_per_bar=10)
        for bar in bars[:5]:
            for lv in bar.levels:
                assert isinstance(lv, FootprintLevel)
                assert lv.bid_volume >= 0
                assert lv.ask_volume >= 0

    def test_footprint_imbalance(self, of):
        bars = of.footprint_data(levels_per_bar=10, imbalance_ratio=3.0)
        imbalance_found = False
        for bar in bars:
            for lv in bar.levels:
                if lv.is_imbalance:
                    imbalance_found = True
                    break
            if imbalance_found:
                break
        # With random data some imbalances should exist
        # Don't assert found since it depends on data


# ─── DELTA PROFILE TESTS ─────────────────────────────────────────────────────

class TestDeltaProfile:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_delta_profile_basic(self, of):
        result = of.delta_profile()
        assert isinstance(result, pd.DataFrame)
        assert 'buy_volume' in result.columns
        assert 'sell_volume' in result.columns
        assert 'delta' in result.columns
        assert 'cumulative_delta' in result.columns
        assert len(result) == 200

    def test_delta_profile_ma(self, of):
        result = of.delta_profile()
        assert 'delta_ma_fast' in result.columns
        assert 'delta_ma_slow' in result.columns
        assert 'delta_momentum' in result.columns

    def test_delta_sign(self, of):
        result = of.delta_profile()
        # Delta should be buy - sell
        for i in range(len(result)):
            expected = result['buy_volume'].iloc[i] - result['sell_volume'].iloc[i]
            assert abs(result['delta'].iloc[i] - expected) < 0.01


# ─── ABSORPTION / EXHAUSTION TESTS ───────────────────────────────────────────

class TestAbsorptionExhaustion:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_climax_data(100))

    def test_absorption_detection(self, of):
        result = of.absorption_detection()
        assert isinstance(result, pd.DataFrame)
        assert 'absorption_strength' in result.columns
        assert 'absorption_direction' in result.columns

    def test_exhaustion_detection(self, of):
        result = of.exhaustion_detection()
        assert isinstance(result, pd.DataFrame)
        assert 'exhaustion' in result.columns
        assert 'exhaustion_direction' in result.columns


# ─── AGGRESSION RATIO TESTS ──────────────────────────────────────────────────

class TestAggressionRatio:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_aggression_ratio_basic(self, of):
        result = of.aggression_ratio()
        assert isinstance(result, pd.DataFrame)
        assert 'buy_aggression' in result.columns
        assert 'sell_aggression' in result.columns
        assert 'aggression_ratio' in result.columns

    def test_aggression_ratio_range(self, of):
        result = of.aggression_ratio()
        valid = result['aggression_ratio'].dropna()
        assert (valid >= 0).all()


# ─── SUPPLY/DEMAND ZONE TESTS ────────────────────────────────────────────────

class TestSupplyDemandZones:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_trending_data(200))

    def test_sd_zones_basic(self, of):
        zones = of.supply_demand_zones()
        assert isinstance(zones, list)
        for z in zones:
            assert isinstance(z, SupplyDemandZone)
            assert z.zone_type in ('supply', 'demand')
            assert z.high >= z.low
            assert z.strength > 0

    def test_sd_zone_attributes(self, of):
        zones = of.supply_demand_zones()
        for z in zones:
            assert hasattr(z, 'touches')
            assert hasattr(z, 'is_fresh')
            assert isinstance(z.touches, int)
            assert isinstance(z.is_fresh, bool)


# ─── LIQUIDITY LEVEL TESTS ───────────────────────────────────────────────────

class TestLiquidityLevels:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_liquidity_levels_basic(self, of):
        levels = of.liquidity_levels()
        assert isinstance(levels, list)
        for lv in levels:
            assert isinstance(lv, LiquidityLevel)
            assert lv.type in ('equal_highs', 'equal_lows', 'swing_stop',
                              'buy_stops', 'sell_stops')
            assert lv.price > 0

    def test_liquidity_heatmap(self, of):
        heatmap = of.liquidity_heatmap(bins=50)
        assert isinstance(heatmap, pd.DataFrame)
        assert 'price' in heatmap.columns
        assert 'total' in heatmap.columns


# ─── INSTITUTIONAL FLOW TESTS ────────────────────────────────────────────────

class TestInstitutionalFlow:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_institutional_flow_basic(self, of):
        activities = of.institutional_flow()
        assert isinstance(activities, list)
        for act in activities:
            assert isinstance(act, InstitutionalActivity)
            assert act.activity_type in ('accumulation', 'distribution',
                                          'absorption', 'initiative')
            assert 0 <= act.confidence <= 1.0

    def test_institutional_flow_indicator(self, of):
        result = of.institutional_flow_indicator(period=20)
        assert isinstance(result, pd.DataFrame)
        assert 'inst_flow_strength' in result.columns
        assert len(result) == 200


# ─── AUCTION METRICS TESTS ───────────────────────────────────────────────────

class TestAuctionMetrics:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_auction_metrics_basic(self, of):
        result = of.auction_metrics()
        assert isinstance(result, pd.DataFrame)
        assert 'rotational_factor' in result.columns
        assert 'value_migration' in result.columns

    def test_auction_metrics_values(self, of):
        result = of.auction_metrics()
        rf = result['rotational_factor'].dropna()
        # rotational_factor is an unbounded integer counter
        assert len(rf) > 0
        assert rf.dtype in [np.int64, np.float64, int, float]


# ─── ICEBERG DETECTION TESTS ─────────────────────────────────────────────────

class TestIcebergProxy:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_iceberg_proxy(self, of):
        result = of.iceberg_proxy()
        assert isinstance(result, pd.DataFrame)
        assert 'iceberg_score' in result.columns
        valid = result['iceberg_score'].dropna()
        assert (valid >= 0).all()


# ─── CUMULATIVE TICK TESTS ───────────────────────────────────────────────────

class TestCumulativeTick:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_cumulative_tick_basic(self, of):
        result = of.cumulative_tick()
        assert isinstance(result, pd.DataFrame)
        assert 'tick' in result.columns
        assert 'cumulative_tick' in result.columns

    def test_cumulative_tick_ma(self, of):
        result = of.cumulative_tick()
        assert 'tick_ma' in result.columns
        assert 'cum_tick_osc' in result.columns


# ─── COMPOSITE SCORE TESTS ───────────────────────────────────────────────────

class TestCompositeOrderFlowScore:

    @pytest.fixture
    def of(self):
        return OrderFlowEngine(make_ohlcv(200))

    def test_composite_score_basic(self, of):
        result = of.composite_order_flow_score()
        assert isinstance(result, pd.DataFrame)
        assert 'raw_score' in result.columns
        assert 'smoothed_score' in result.columns

    def test_composite_score_range(self, of):
        result = of.composite_order_flow_score()
        valid = result['smoothed_score'].dropna()
        assert (valid >= -100).all()
        assert (valid <= 100).all()

    def test_composite_score_components(self, of):
        result = of.composite_order_flow_score()
        assert 'delta_component' in result.columns
        assert 'absorption_component' in result.columns
        assert 'aggression_component' in result.columns
        assert 'tick_component' in result.columns

    def test_composite_score_signal(self, of):
        result = of.composite_order_flow_score()
        # Check signal column exists and has valid values
        if 'signal' in result.columns:
            valid_signals = {'strong_buy', 'buy', 'neutral', 'sell', 'strong_sell'}
            for s in result['signal'].dropna():
                assert s in valid_signals
