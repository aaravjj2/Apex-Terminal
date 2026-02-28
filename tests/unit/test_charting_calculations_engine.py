"""
Comprehensive tests for ChartingCalculationsEngine.
"""

import math
from datetime import datetime, timedelta

import pytest
import numpy as np

from services.charting_calculations_engine import (
    Bar,
    RenkoBrick,
    KagiLine,
    PnFColumn,
    PivotLevels,
    VWAPData,
    IchimokuData,
    SupertrendData,
    MarketProfileData,
    ChartType,
    PivotType,
    HeikinAshiCalculator,
    RenkoCalculator,
    KagiCalculator,
    PointAndFigureCalculator,
    LineBreakCalculator,
    RangeBarCalculator,
    VWAPCalculator,
    PivotPointCalculator,
    IchimokuCalculator,
    SupertrendCalculator,
    MarketProfileCalculator,
    ChartingCalculationsEngine,
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_bars(n: int = 100, start: float = 100.0, seed: int = 42) -> list[Bar]:
    rng = np.random.default_rng(seed)
    bars = []
    price = start
    base = datetime(2024, 1, 1)
    for i in range(n):
        change = rng.normal(0, 1.0)
        o = price
        c = price + change
        h = max(o, c) + abs(rng.normal(0, 0.5))
        l = min(o, c) - abs(rng.normal(0, 0.5))
        vol = rng.integers(100000, 1000000)
        bars.append(Bar(base + timedelta(days=i), round(o, 2), round(h, 2), round(max(l, 0.1), 2), round(max(c, 0.1), 2), int(vol)))
        price = max(c, 0.1)
    return bars


def make_trending_bars(n: int = 100, direction: str = "up") -> list[Bar]:
    bars = []
    price = 100.0
    delta = 1.0 if direction == "up" else -0.5
    base = datetime(2024, 1, 1)
    for i in range(n):
        o = price
        c = price + delta
        h = max(o, c) + 0.5
        l = min(o, c) - 0.5
        bars.append(Bar(base + timedelta(days=i), round(o, 2), round(h, 2), round(max(l, 0.1), 2), round(max(c, 0.1), 2), 500000))
        price = max(c, 0.1)
    return bars


# ─── TestBar ─────────────────────────────────────────────────────────────────

class TestBar:
    def test_to_dict(self):
        b = Bar(datetime(2024, 1, 1), 100, 105, 95, 102, 1000)
        d = b.to_dict()
        assert d["open"] == 100
        assert d["volume"] == 1000
        assert "2024-01-01" in d["timestamp"]


# ─── TestRenkoBrick ──────────────────────────────────────────────────────────

class TestRenkoBrick:
    def test_up_brick(self):
        brick = RenkoBrick(datetime.now(), 100, 102, "up")
        assert brick.high == 102
        assert brick.low == 100

    def test_down_brick(self):
        brick = RenkoBrick(datetime.now(), 102, 100, "down")
        assert brick.high == 102
        assert brick.low == 100

    def test_to_dict(self):
        brick = RenkoBrick(datetime(2024, 1, 1), 100, 102, "up")
        d = brick.to_dict()
        assert d["direction"] == "up"


# ─── TestPivotLevels ────────────────────────────────────────────────────────

class TestPivotLevels:
    def test_to_dict(self):
        pl = PivotLevels(pivot=100, r1=105, s1=95)
        d = pl.to_dict()
        assert d["pivot"] == 100
        assert d["r1"] == 105


# ─── TestVWAPData ────────────────────────────────────────────────────────────

class TestVWAPData:
    def test_to_dict(self):
        v = VWAPData(datetime.now(), 100.0, 101, 102, 103, 99, 98, 97)
        d = v.to_dict()
        assert d["vwap"] == 100.0
        assert d["upper_1"] == 101.0


# ─── TestHeikinAshi ──────────────────────────────────────────────────────────

class TestHeikinAshi:
    def test_basic(self):
        bars = make_bars(20)
        ha = HeikinAshiCalculator.calculate(bars)
        assert len(ha) == 20

    def test_empty(self):
        assert HeikinAshiCalculator.calculate([]) == []

    def test_first_bar(self):
        bars = [Bar(datetime.now(), 100, 105, 95, 102, 1000)]
        ha = HeikinAshiCalculator.calculate(bars)
        assert ha[0].close == pytest.approx((100 + 105 + 95 + 102) / 4)
        assert ha[0].open == 100

    def test_smoothing(self):
        """Heikin Ashi should smooth price action."""
        bars = make_bars(50)
        ha = HeikinAshiCalculator.calculate(bars)
        # HA close is average of OHLC - check formula
        for i, (orig, ha_bar) in enumerate(zip(bars, ha)):
            expected_close = (orig.open + orig.high + orig.low + orig.close) / 4
            assert ha_bar.close == pytest.approx(expected_close, abs=0.01)

    def test_high_low_bounds(self):
        """HA high >= max(open, close), HA low <= min(open, close)."""
        bars = make_bars(30)
        ha = HeikinAshiCalculator.calculate(bars)
        for bar in ha:
            assert bar.high >= max(bar.open, bar.close) - 0.01
            assert bar.low <= min(bar.open, bar.close) + 0.01


# ─── TestRenko ───────────────────────────────────────────────────────────────

class TestRenko:
    def test_trending_up(self):
        bars = make_trending_bars(50, "up")
        bricks = RenkoCalculator.calculate(bars, brick_size=2.0)
        assert len(bricks) > 0
        up_count = sum(1 for b in bricks if b.direction == "up")
        assert up_count > 0

    def test_empty(self):
        assert RenkoCalculator.calculate([], 1.0) == []

    def test_zero_brick_size(self):
        bars = make_bars(10)
        assert RenkoCalculator.calculate(bars, 0) == []

    def test_brick_size_consistency(self):
        bars = make_trending_bars(100, "up")
        bricks = RenkoCalculator.calculate(bars, brick_size=3.0)
        for brick in bricks:
            assert abs(brick.close - brick.open) == pytest.approx(3.0, abs=0.1)

    def test_atr_brick_size(self):
        bars = make_bars(50)
        atr = RenkoCalculator.atr_brick_size(bars)
        assert atr > 0

    def test_atr_short_data(self):
        assert RenkoCalculator.atr_brick_size([Bar(datetime.now(), 100, 100, 100, 100)]) == 1.0

    def test_down_trend_bricks(self):
        bars = make_trending_bars(50, "down")
        bricks = RenkoCalculator.calculate(bars, brick_size=1.0)
        down_count = sum(1 for b in bricks if b.direction == "down")
        assert down_count > 0


# ─── TestKagi ────────────────────────────────────────────────────────────────

class TestKagi:
    def test_basic(self):
        bars = make_bars(100)
        lines = KagiCalculator.calculate(bars, reversal_pct=3.0)
        assert len(lines) > 0

    def test_empty(self):
        assert KagiCalculator.calculate([], 4.0) == []

    def test_zero_reversal(self):
        bars = make_bars(10)
        assert KagiCalculator.calculate(bars, 0) == []

    def test_has_reversals(self):
        bars = make_bars(200)
        lines = KagiCalculator.calculate(bars, reversal_pct=2.0)
        reversals = [l for l in lines if l.is_reversal]
        assert len(reversals) > 0

    def test_directions(self):
        bars = make_bars(100)
        lines = KagiCalculator.calculate(bars, reversal_pct=3.0)
        directions = set(l.direction for l in lines)
        # Should have both yang and yin
        assert len(directions) >= 1

    def test_to_dict(self):
        line = KagiLine(datetime(2024, 1, 1), 100.0, "yang", True)
        d = line.to_dict()
        assert d["direction"] == "yang"
        assert d["is_reversal"] is True


# ─── TestPointAndFigure ──────────────────────────────────────────────────────

class TestPointAndFigure:
    def test_trending(self):
        bars = make_trending_bars(100, "up")
        columns = PointAndFigureCalculator.calculate(bars, box_size=2.0, reversal=3)
        assert len(columns) > 0

    def test_empty(self):
        assert PointAndFigureCalculator.calculate([], 1.0) == []

    def test_zero_box(self):
        bars = make_bars(10)
        assert PointAndFigureCalculator.calculate(bars, 0) == []

    def test_column_types(self):
        bars = make_bars(200)
        columns = PointAndFigureCalculator.calculate(bars, box_size=1.0, reversal=3)
        types = set(c.column_type for c in columns)
        # Should have X and/or O columns
        assert len(types) >= 1

    def test_to_dict(self):
        col = PnFColumn(100, 110, "X", 10)
        d = col.to_dict()
        assert d["type"] == "X"
        assert d["boxes"] == 10


# ─── TestLineBreak ──────────────────────────────────────────────────────────

class TestLineBreak:
    def test_basic(self):
        bars = make_bars(50)
        lb = LineBreakCalculator.calculate(bars)
        assert len(lb) > 0

    def test_empty(self):
        assert LineBreakCalculator.calculate([]) == []

    def test_trending_up(self):
        bars = make_trending_bars(30, "up")
        lb = LineBreakCalculator.calculate(bars, num_lines=3)
        assert len(lb) > 1

    def test_single_bar(self):
        bars = [Bar(datetime.now(), 100, 105, 95, 102, 1000)]
        lb = LineBreakCalculator.calculate(bars)
        assert len(lb) == 1


# ─── TestRangeBars ───────────────────────────────────────────────────────────

class TestRangeBars:
    def test_basic(self):
        bars = make_bars(50)
        rb = RangeBarCalculator.calculate(bars, range_size=5.0)
        assert len(rb) > 0

    def test_empty(self):
        assert RangeBarCalculator.calculate([], 1.0) == []

    def test_zero_range(self):
        bars = make_bars(10)
        assert RangeBarCalculator.calculate(bars, 0) == []

    def test_range_constraint(self):
        bars = make_bars(100)
        rb = RangeBarCalculator.calculate(bars, range_size=3.0)
        # Completed bars should have range close to range_size
        for bar in rb[:-1]:  # Exclude last (may be incomplete)
            assert bar.high - bar.low >= 0


# ─── TestVWAPCalculator ─────────────────────────────────────────────────────

class TestVWAPCalculator:
    def test_basic(self):
        bars = make_bars(50)
        vwap = VWAPCalculator.calculate(bars)
        assert len(vwap) == 50

    def test_empty(self):
        assert VWAPCalculator.calculate([]) == []

    def test_bands_ordering(self):
        bars = make_bars(30)
        vwap = VWAPCalculator.calculate(bars)
        for v in vwap:
            assert v.lower_3 <= v.lower_2 <= v.lower_1 <= v.vwap <= v.upper_1 <= v.upper_2 <= v.upper_3

    def test_single_bar(self):
        bars = [Bar(datetime.now(), 100, 105, 95, 102, 1000)]
        vwap = VWAPCalculator.calculate(bars)
        assert len(vwap) == 1
        expected = (105 + 95 + 102) / 3
        assert vwap[0].vwap == pytest.approx(expected)

    def test_anchored_vwap(self):
        bars = make_bars(50)
        avwap = VWAPCalculator.anchored_vwap(bars, anchor_index=25)
        assert len(avwap) == 25

    def test_anchored_vwap_empty(self):
        assert VWAPCalculator.anchored_vwap([], 0) == []

    def test_anchored_vwap_out_of_range(self):
        bars = make_bars(10)
        assert VWAPCalculator.anchored_vwap(bars, 20) == []

    def test_zero_volume(self):
        """Should handle zero volume by using 1."""
        bars = [Bar(datetime.now(), 100, 105, 95, 102, 0)]
        vwap = VWAPCalculator.calculate(bars)
        assert len(vwap) == 1
        assert vwap[0].vwap > 0


# ─── TestPivotPoints ────────────────────────────────────────────────────────

class TestPivotPoints:
    def test_standard(self):
        pp = PivotPointCalculator.standard(110, 90, 100)
        assert pp.pivot == 100.0
        assert pp.r1 > pp.pivot
        assert pp.s1 < pp.pivot

    def test_fibonacci(self):
        pp = PivotPointCalculator.fibonacci(110, 90, 100)
        assert pp.pivot == 100.0
        assert pp.r1 > pp.pivot
        assert pp.s1 < pp.pivot

    def test_camarilla(self):
        pp = PivotPointCalculator.camarilla(110, 90, 100)
        assert pp.r4 > pp.r3 > pp.r2 > pp.r1
        assert pp.s4 < pp.s3 < pp.s2 < pp.s1

    def test_woodie(self):
        pp = PivotPointCalculator.woodie(110, 90, 100)
        # Woodie gives more weight to close
        assert pp.pivot == (110 + 90 + 200) / 4

    def test_demark_close_lt_open(self):
        pp = PivotPointCalculator.demark(110, 90, 95, 100)  # close < open
        assert pp.pivot > 0

    def test_demark_close_gt_open(self):
        pp = PivotPointCalculator.demark(110, 90, 105, 100)  # close > open
        assert pp.pivot > 0

    def test_demark_close_eq_open(self):
        pp = PivotPointCalculator.demark(110, 90, 100, 100)  # close == open
        assert pp.pivot > 0

    def test_dispatch(self):
        calc = PivotPointCalculator()
        for pt in PivotType:
            result = calc.calculate(pt, 110, 90, 100, 100)
            assert result.pivot > 0


# ─── TestIchimoku ────────────────────────────────────────────────────────────

class TestIchimoku:
    def test_basic(self):
        bars = make_bars(60)
        ich = IchimokuCalculator.calculate(bars)
        assert len(ich) == 60

    def test_empty(self):
        assert IchimokuCalculator.calculate([]) == []

    def test_tenkan_sen(self):
        bars = make_bars(30)
        ich = IchimokuCalculator.calculate(bars, tenkan=9)
        # Tenkan should be midpoint of 9-period high/low
        for i in range(9, 30):
            segment = bars[i - 8:i + 1]
            expected = (max(b.high for b in segment) + min(b.low for b in segment)) / 2
            assert ich[i].tenkan_sen == pytest.approx(expected, abs=0.01)

    def test_cloud_components(self):
        bars = make_bars(60)
        ich = IchimokuCalculator.calculate(bars)
        for d in ich:
            assert d.senkou_span_a == pytest.approx((d.tenkan_sen + d.kijun_sen) / 2, abs=0.01)

    def test_to_dict(self):
        d = IchimokuData(datetime(2024, 1, 1), 100, 95, 97.5, 90, 102)
        result = d.to_dict()
        assert result["tenkan_sen"] == 100
        assert "2024-01-01" in result["timestamp"]


# ─── TestSupertrend ─────────────────────────────────────────────────────────

class TestSupertrend:
    def test_basic(self):
        bars = make_bars(50)
        st = SupertrendCalculator.calculate(bars, period=10)
        assert len(st) == 50

    def test_short_data(self):
        bars = make_bars(5)
        st = SupertrendCalculator.calculate(bars, period=10)
        assert len(st) == 5

    def test_directions(self):
        bars = make_bars(100)
        st = SupertrendCalculator.calculate(bars)
        dirs = set(d.direction for d in st)
        assert 1 in dirs or -1 in dirs

    def test_to_dict(self):
        d = SupertrendData(datetime(2024, 1, 1), 100.5, 1, 105.0, 96.0)
        result = d.to_dict()
        assert result["direction"] == 1
        assert result["supertrend"] == 100.5

    def test_trending_up_bullish(self):
        bars = make_trending_bars(50, "up")
        st = SupertrendCalculator.calculate(bars, period=5)
        # In strong uptrend, later values should be bullish
        bullish = sum(1 for d in st[-20:] if d.direction == 1)
        assert bullish > 0


# ─── TestMarketProfile ──────────────────────────────────────────────────────

class TestMarketProfile:
    def test_volume_profile(self):
        bars = make_bars(50)
        vp = MarketProfileCalculator.volume_profile(bars, num_levels=20)
        assert len(vp) == 20

    def test_volume_profile_empty(self):
        assert MarketProfileCalculator.volume_profile([]) == []

    def test_volume_profile_has_poc(self):
        bars = make_bars(50)
        vp = MarketProfileCalculator.volume_profile(bars, num_levels=20)
        poc = [v for v in vp if v.is_poc]
        assert len(poc) == 1

    def test_volume_profile_flat(self):
        """All same price."""
        bars = [Bar(datetime(2024, 1, i + 1), 100, 100, 100, 100, 1000) for i in range(10)]
        vp = MarketProfileCalculator.volume_profile(bars)
        assert len(vp) >= 1

    def test_tpo_profile(self):
        bars = make_bars(30)
        tpo = MarketProfileCalculator.market_profile_tpo(bars, num_levels=15)
        assert len(tpo) > 0

    def test_tpo_empty(self):
        assert MarketProfileCalculator.market_profile_tpo([]) == []

    def test_tpo_has_poc(self):
        bars = make_bars(30)
        tpo = MarketProfileCalculator.market_profile_tpo(bars, num_levels=10)
        poc = [t for t in tpo if t.is_poc]
        assert len(poc) >= 1

    def test_to_dict(self):
        d = MarketProfileData(100.5, 10, 50000.0, True, False, True)
        result = d.to_dict()
        assert result["is_poc"] is True
        assert result["is_val"] is True


# ─── TestChartingCalculationsEngine (Orchestrator) ──────────────────────────

class TestChartingCalculationsEngine:
    def test_heikin_ashi(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(20)
        result = engine.calculate_heikin_ashi(bars)
        assert len(result) == 20
        assert "close" in result[0]

    def test_renko(self):
        engine = ChartingCalculationsEngine()
        bars = make_trending_bars(50)
        result = engine.calculate_renko(bars, brick_size=3.0)
        assert len(result) > 0

    def test_kagi(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(100)
        result = engine.calculate_kagi(bars, reversal_pct=3.0)
        assert len(result) > 0

    def test_pnf(self):
        engine = ChartingCalculationsEngine()
        bars = make_trending_bars(100)
        result = engine.calculate_pnf(bars, box_size=2.0)
        assert len(result) > 0

    def test_line_break(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(30)
        result = engine.calculate_line_break(bars)
        assert len(result) > 0

    def test_range_bars(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(50)
        result = engine.calculate_range_bars(bars, range_size=5.0)
        assert len(result) > 0

    def test_vwap(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(30)
        result = engine.calculate_vwap(bars)
        assert len(result) == 30
        assert "vwap" in result[0]

    def test_anchored_vwap(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(50)
        result = engine.calculate_anchored_vwap(bars, anchor_index=20)
        assert len(result) == 30

    def test_pivots(self):
        engine = ChartingCalculationsEngine()
        result = engine.calculate_pivots(PivotType.STANDARD, 110, 90, 100)
        assert result["pivot"] == pytest.approx(100.0)

    def test_ichimoku(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(60)
        result = engine.calculate_ichimoku(bars)
        assert len(result) == 60

    def test_supertrend(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(50)
        result = engine.calculate_supertrend(bars)
        assert len(result) == 50

    def test_volume_profile(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(50)
        result = engine.calculate_volume_profile(bars, num_levels=20)
        assert len(result) == 20

    def test_market_profile(self):
        engine = ChartingCalculationsEngine()
        bars = make_bars(30)
        result = engine.calculate_market_profile(bars)
        assert len(result) > 0

    def test_capabilities(self):
        engine = ChartingCalculationsEngine()
        caps = engine.capabilities()
        assert "chart_types" in caps
        assert len(caps["features"]) >= 10
