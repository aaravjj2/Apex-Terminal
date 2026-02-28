"""
Tests — Heat Map Engine
========================
Sector treemaps, correlation heatmaps, performance grids, volume heatmaps,
market breadth, calendar heatmaps, color generation.
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from phase1.services.heat_map_engine import (
    ColorScheme, HeatMapType, LayoutType, TimeGranularity,
    HeatMapCell, TreeMapNode, HeatMapConfig,
    ColorGenerator, SectorHeatMapBuilder, CorrelationHeatMapBuilder,
    PerformanceHeatMapBuilder, VolumeHeatMapBuilder,
    MarketBreadthHeatMapBuilder, CalendarHeatMapBuilder,
    HeatMapEngine,
)


# ─── HeatMapCell Tests ──────────────────────────────────────────────────────

class TestHeatMapCell:
    def test_to_dict(self):
        c = HeatMapCell("AAPL", 2.5, "#26a69a", 100.0, 0, 0, "Apple +2.5%")
        d = c.to_dict()
        assert d["label"] == "AAPL"
        assert d["value"] == 2.5
        assert d["color"] == "#26a69a"

    def test_defaults(self):
        c = HeatMapCell("X", 0.0)
        assert c.color == ""
        assert c.size == 1.0
        assert c.metadata == {}


# ─── TreeMapNode Tests ───────────────────────────────────────────────────────

class TestTreeMapNode:
    def test_to_dict(self):
        child = TreeMapNode("AAPL", 2.5, 3000.0)
        parent = TreeMapNode("Tech", 1.8, 10000.0, children=[child])
        d = parent.to_dict()
        assert d["label"] == "Tech"
        assert len(d["children"]) == 1

    def test_position_fields(self):
        n = TreeMapNode("X", 1.0, 100.0, x=10, y=20, width=50, height=30)
        d = n.to_dict()
        assert d["x"] == 10
        assert d["width"] == 50


# ─── HeatMapConfig Tests ────────────────────────────────────────────────────

class TestHeatMapConfig:
    def test_defaults(self):
        c = HeatMapConfig()
        assert c.color_scheme == ColorScheme.RED_GREEN
        assert c.layout == LayoutType.GRID

    def test_to_dict(self):
        c = HeatMapConfig(ColorScheme.BLOOMBERG, LayoutType.TREEMAP, 1000, 800)
        d = c.to_dict()
        assert d["color_scheme"] == "bloomberg"
        assert d["layout"] == "treemap"


# ─── ColorGenerator Tests ───────────────────────────────────────────────────

class TestColorGenerator:
    def test_hex_to_rgb(self):
        assert ColorGenerator.hex_to_rgb("#ff0000") == (255, 0, 0)
        assert ColorGenerator.hex_to_rgb("#00ff00") == (0, 255, 0)

    def test_rgb_to_hex(self):
        assert ColorGenerator.rgb_to_hex(255, 0, 0) == "#ff0000"
        assert ColorGenerator.rgb_to_hex(0, 128, 255) == "#0080ff"

    def test_interpolate_color(self):
        # Midpoint between black and white
        mid = ColorGenerator.interpolate_color("#000000", "#ffffff", 0.5)
        r, g, b = ColorGenerator.hex_to_rgb(mid)
        assert r == g == b == 127

    def test_interpolate_edge_cases(self):
        assert ColorGenerator.interpolate_color("#ff0000", "#0000ff", 0.0) == "#ff0000"
        assert ColorGenerator.interpolate_color("#ff0000", "#0000ff", 1.0) == "#0000ff"

    def test_value_to_color_red_green(self):
        positive = ColorGenerator.value_to_color(3.0, ColorScheme.RED_GREEN)
        negative = ColorGenerator.value_to_color(-3.0, ColorScheme.RED_GREEN)
        zero = ColorGenerator.value_to_color(0.0, ColorScheme.RED_GREEN)
        # All should be valid hex colors
        assert positive.startswith("#")
        assert negative.startswith("#")
        assert zero.startswith("#")

    def test_value_to_color_bloomberg(self):
        color = ColorGenerator.value_to_color(2.0, ColorScheme.BLOOMBERG)
        assert color.startswith("#")

    def test_value_to_color_cool_warm(self):
        color = ColorGenerator.value_to_color(-2.0, ColorScheme.COOL_WARM)
        assert color.startswith("#")

    def test_value_to_color_blue_red(self):
        color = ColorGenerator.value_to_color(1.5, ColorScheme.DIVERGING_BLUE_RED)
        assert color.startswith("#")

    def test_value_to_color_sequential(self):
        for scheme in [ColorScheme.SEQUENTIAL_GREEN, ColorScheme.SEQUENTIAL_RED, ColorScheme.SEQUENTIAL_BLUE]:
            color = ColorGenerator.value_to_color(3.0, scheme, 0, 5)
            assert color.startswith("#")


# ─── SectorHeatMapBuilder Tests ─────────────────────────────────────────────

class TestSectorHeatMapBuilder:
    def test_build_sector_map(self):
        stocks = [
            {"symbol": "AAPL", "sector": "Tech", "market_cap": 3000, "change_pct": 2.5},
            {"symbol": "MSFT", "sector": "Tech", "market_cap": 2800, "change_pct": 1.2},
            {"symbol": "JPM", "sector": "Finance", "market_cap": 500, "change_pct": -0.8},
        ]
        nodes = SectorHeatMapBuilder.build_sector_map(stocks)
        assert len(nodes) == 2  # Tech and Finance
        tech = [n for n in nodes if n.label == "Tech"][0]
        assert len(tech.children) == 2

    def test_empty_stocks(self):
        nodes = SectorHeatMapBuilder.build_sector_map([])
        assert nodes == []

    def test_squarify(self):
        nodes = [
            TreeMapNode("A", 1.0, 60),
            TreeMapNode("B", 0.5, 30),
            TreeMapNode("C", -0.5, 10),
        ]
        result = SectorHeatMapBuilder.squarify(nodes, 0, 0, 800, 600)
        assert len(result) == 3
        # All should have positions
        for n in result:
            assert n.width >= 0
            assert n.height >= 0

    def test_squarify_empty(self):
        assert SectorHeatMapBuilder.squarify([], 0, 0, 100, 100) == []

    def test_squarify_zero_weight(self):
        nodes = [TreeMapNode("A", 1.0, 0), TreeMapNode("B", 2.0, 0)]
        result = SectorHeatMapBuilder.squarify(nodes, 0, 0, 100, 100)
        assert len(result) == 2


# ─── CorrelationHeatMapBuilder Tests ─────────────────────────────────────────

class TestCorrelationHeatMapBuilder:
    def test_build(self):
        symbols = ["SPY", "TLT", "GLD"]
        matrix = [[1.0, -0.3, 0.1], [-0.3, 1.0, 0.4], [0.1, 0.4, 1.0]]
        cells = CorrelationHeatMapBuilder.build(symbols, matrix)
        assert len(cells) == 9
        # Diagonal should be 1.0
        diag = [c for c in cells if c.row == c.col]
        assert all(c.value == 1.0 for c in diag)

    def test_empty(self):
        cells = CorrelationHeatMapBuilder.build([], [])
        assert cells == []


# ─── PerformanceHeatMapBuilder Tests ─────────────────────────────────────────

class TestPerformanceHeatMapBuilder:
    def test_monthly_returns(self):
        dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(90)]
        returns = [0.001 * ((-1) ** i) for i in range(90)]
        cells = PerformanceHeatMapBuilder.monthly_returns("SPY", dates, returns)
        assert len(cells) > 0
        # Should have Jan, Feb, Mar months
        months = set(c.metadata.get("month") for c in cells)
        assert 1 in months or 2 in months

    def test_monthly_mismatched_lengths(self):
        cells = PerformanceHeatMapBuilder.monthly_returns("X", [datetime.now()], [0.01, 0.02])
        assert cells == []

    def test_period_returns(self):
        symbols = ["SPY", "TLT"]
        returns = {
            "SPY": {"1D": 0.5, "1W": 1.2, "1M": 3.5},
            "TLT": {"1D": -0.2, "1W": 0.8, "1M": -1.0},
        }
        cells = PerformanceHeatMapBuilder.period_returns(symbols, returns)
        assert len(cells) == 6  # 2 symbols × 3 periods


# ─── VolumeHeatMapBuilder Tests ──────────────────────────────────────────────

class TestVolumeHeatMapBuilder:
    def test_hourly_volume(self):
        base = datetime(2024, 1, 1, 9, 30)
        timestamps = [base + timedelta(hours=i) for i in range(100)]
        volumes = [1000 + i * 10 for i in range(100)]
        cells = VolumeHeatMapBuilder.hourly_volume(timestamps, volumes)
        assert len(cells) > 0
        for c in cells:
            assert c.value > 0

    def test_mismatched(self):
        cells = VolumeHeatMapBuilder.hourly_volume([datetime.now()], [100, 200])
        assert cells == []


# ─── MarketBreadthHeatMapBuilder Tests ───────────────────────────────────────

class TestMarketBreadthHeatMapBuilder:
    def test_build(self):
        data = {
            "Technology": {"advancing": 40, "declining": 10, "new_highs": 5, "new_lows": 1},
            "Healthcare": {"advancing": 20, "declining": 25, "new_highs": 2, "new_lows": 3},
            "Energy": {"advancing": 15, "declining": 15, "new_highs": 0, "new_lows": 0},
        }
        cells = MarketBreadthHeatMapBuilder.build(data)
        assert len(cells) == 3
        tech = cells[0]  # Tech is first
        assert tech.value > 0  # More advancing than declining

    def test_empty_sector(self):
        data = {"Empty": {"advancing": 0, "declining": 0}}
        cells = MarketBreadthHeatMapBuilder.build(data)
        assert cells[0].value == 0.0


# ─── CalendarHeatMapBuilder Tests ────────────────────────────────────────────

class TestCalendarHeatMapBuilder:
    def test_build(self):
        dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(30)]
        values = [0.5 * ((-1) ** i) for i in range(30)]
        cells = CalendarHeatMapBuilder.build(dates, values)
        assert len(cells) == 30

    def test_mismatched(self):
        cells = CalendarHeatMapBuilder.build([datetime.now()], [1.0, 2.0])
        assert cells == []

    def test_color_assignment(self):
        dates = [datetime(2024, 3, 1), datetime(2024, 3, 2)]
        values = [2.0, -3.0]
        cells = CalendarHeatMapBuilder.build(dates, values, ColorScheme.RED_GREEN)
        assert all(c.color.startswith("#") for c in cells)


# ─── HeatMapEngine Tests ────────────────────────────────────────────────────

class TestHeatMapEngine:
    def setup_method(self):
        self.engine = HeatMapEngine()

    def test_sector_treemap(self):
        stocks = [
            {"symbol": "AAPL", "sector": "Tech", "market_cap": 3000, "change_pct": 2.5},
            {"symbol": "MSFT", "sector": "Tech", "market_cap": 2800, "change_pct": 1.2},
            {"symbol": "JPM", "sector": "Finance", "market_cap": 500, "change_pct": -0.8},
        ]
        result = self.engine.sector_treemap(stocks)
        assert result["type"] == "sector_treemap"
        assert len(result["nodes"]) > 0

    def test_correlation_heatmap(self):
        symbols = ["A", "B"]
        matrix = [[1.0, 0.5], [0.5, 1.0]]
        result = self.engine.correlation_heatmap(symbols, matrix)
        assert result["type"] == "correlation"
        assert result["rows"] == 2

    def test_monthly_returns(self):
        dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(60)]
        returns = [0.001] * 60
        result = self.engine.monthly_returns_heatmap("SPY", dates, returns)
        assert result["type"] == "monthly_returns"

    def test_performance_grid(self):
        result = self.engine.performance_grid(
            ["SPY", "TLT"],
            {"SPY": {"1D": 0.5, "1W": 1.2}, "TLT": {"1D": -0.2, "1W": 0.8}})
        assert result["type"] == "performance_grid"

    def test_volume_heatmap(self):
        ts = [datetime(2024, 1, 1, 10) + timedelta(hours=i) for i in range(50)]
        vols = [1000 + i * 100 for i in range(50)]
        result = self.engine.volume_heatmap(ts, vols)
        assert result["type"] == "volume"

    def test_market_breadth(self):
        data = {"Tech": {"advancing": 30, "declining": 10}}
        result = self.engine.market_breadth(data)
        assert result["type"] == "market_breadth"

    def test_calendar_heatmap(self):
        dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(20)]
        vals = [i * 0.1 - 1 for i in range(20)]
        result = self.engine.calendar_heatmap(dates, vals)
        assert result["type"] == "calendar"

    def test_value_to_color(self):
        c = self.engine.value_to_color(3.0)
        assert c.startswith("#")

    def test_capabilities(self):
        caps = self.engine.capabilities()
        assert caps["engine"] == "HeatMapEngine"
        assert len(caps["heat_map_types"]) >= 5
        assert len(caps["color_schemes"]) >= 5
        assert len(caps["features"]) >= 8

    def test_custom_scheme(self):
        result = self.engine.correlation_heatmap(
            ["A", "B"], [[1.0, 0.5], [0.5, 1.0]], ColorScheme.COOL_WARM)
        assert len(result["cells"]) == 4

    def test_empty_sector_treemap(self):
        result = self.engine.sector_treemap([])
        assert result["nodes"] == []
