"""
Unit tests for Chart Wrapper.

Tests cover:
- Chart creation
- Bar management
- Scale synchronization
- Rendering determinism
"""

import pytest

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.charting.chart_wrapper import (
    ChartWrapper,
    ChartLayout,
    ChartStyle,
    ChartType,
    Bar,
    Series,
    create_chart,
)
from services.charting.scale_engine import ScaleState
from services.charting.primitives import Color


class TestBar:
    """Tests for Bar dataclass."""
    
    def test_creation(self):
        """Should create bar."""
        bar = Bar(
            bar_index=0,
            timestamp_ms=1000,
            open=100,
            high=105,
            low=98,
            close=103,
            volume=1000,
        )
        
        assert bar.bar_index == 0
        assert bar.close == 103
    
    def test_is_bullish(self):
        """Should detect bullish bar."""
        bull = Bar(0, 0, 100, 105, 98, 103)
        bear = Bar(1, 0, 100, 105, 98, 97)
        
        assert bull.is_bullish is True
        assert bear.is_bullish is False
    
    def test_to_dict(self):
        """Should convert to dict."""
        bar = Bar(0, 1000, 100, 105, 98, 103, 500)
        d = bar.to_dict()
        
        assert d["bar_index"] == 0
        assert d["volume"] == 500
    
    def test_from_dict(self):
        """Should create from dict."""
        d = {
            "bar_index": 5,
            "timestamp_ms": 2000,
            "open": 110,
            "high": 115,
            "low": 108,
            "close": 112,
            "volume": 750,
        }
        
        bar = Bar.from_dict(d)
        
        assert bar.bar_index == 5
        assert bar.close == 112


class TestSeries:
    """Tests for Series."""
    
    def test_creation(self):
        """Should create series."""
        series = Series(
            name="SMA20",
            values=[(0, 100), (1, 101), (2, 102)],
        )
        
        assert series.name == "SMA20"
        assert len(series.values) == 3
    
    def test_get_value_at(self):
        """Should get value at index."""
        series = Series(
            name="test",
            values=[(0, 100), (5, 150), (10, 200)],
        )
        
        assert series.get_value_at(5) == 150
        assert series.get_value_at(3) is None


class TestChartLayout:
    """Tests for ChartLayout."""
    
    def test_defaults(self):
        """Should have sensible defaults."""
        layout = ChartLayout()
        
        assert layout.width == 1280
        assert layout.height == 800
    
    def test_chart_area(self):
        """Should calculate chart area."""
        layout = ChartLayout(
            width=1000,
            height=600,
            margin_left=50,
            margin_right=50,
            margin_top=20,
            margin_bottom=30,
        )
        
        area = layout.chart_area
        
        assert area.x == 50
        assert area.y == 20
        assert area.width == 900
        assert area.height == 550


class TestChartWrapper:
    """Tests for ChartWrapper."""
    
    @pytest.fixture
    def chart(self):
        """Create chart."""
        return ChartWrapper(chart_id="test-chart")
    
    @pytest.fixture
    def sample_bars(self):
        """Create sample bars."""
        return [
            Bar(i, i * 60000, 100 + i, 105 + i, 98 + i, 102 + i, 1000)
            for i in range(10)
        ]
    
    def test_creation(self, chart):
        """Should create chart."""
        assert chart.chart_id == "test-chart"
        assert chart.chart_type == ChartType.CANDLESTICK
    
    def test_set_bars(self, chart, sample_bars):
        """Should set bars."""
        chart.set_bars(sample_bars)
        
        assert len(chart._bars) == 10
    
    def test_add_bar(self, chart, sample_bars):
        """Should add bar."""
        chart.set_bars(sample_bars[:5])
        chart.add_bar(sample_bars[5])
        
        assert len(chart._bars) == 6
    
    def test_add_bar_updates_existing(self, chart, sample_bars):
        """Should update existing bar."""
        chart.set_bars(sample_bars[:5])
        
        updated = Bar(2, 120000, 150, 155, 148, 152, 2000)
        chart.add_bar(updated)
        
        assert len(chart._bars) == 5
        assert chart._bars[2].close == 152
    
    def test_add_series(self, chart):
        """Should add series."""
        series = Series("SMA", [(0, 100), (1, 101)])
        chart.add_series(series)
        
        assert "SMA" in chart._series
    
    def test_remove_series(self, chart):
        """Should remove series."""
        series = Series("SMA", [(0, 100)])
        chart.add_series(series)
        chart.remove_series("SMA")
        
        assert "SMA" not in chart._series
    
    def test_render_empty(self, chart):
        """Should render empty chart."""
        png, hash_val = chart.render()
        
        assert isinstance(png, bytes)
        assert png[:8] == b'\x89PNG\r\n\x1a\n'
    
    def test_render_with_bars(self, chart, sample_bars):
        """Should render with bars."""
        chart.set_bars(sample_bars)
        png, hash_val = chart.render()
        
        assert len(png) > 0
        assert len(hash_val) == 64
    
    def test_render_deterministic(self, sample_bars):
        """Same bars should produce same hash."""
        chart1 = ChartWrapper()
        chart1.set_bars(sample_bars)
        _, hash1 = chart1.render()
        
        chart2 = ChartWrapper()
        chart2.set_bars(sample_bars)
        _, hash2 = chart2.render()
        
        assert hash1 == hash2
    
    def test_scale_state(self, chart, sample_bars):
        """Should get scale state."""
        chart.set_bars(sample_bars)
        
        state = chart.get_scale_state()
        
        assert state is not None
        assert state.start_bar_index == 0
        assert state.end_bar_index == 9
    
    def test_set_scale_state(self, chart, sample_bars):
        """Should set scale state."""
        chart.set_bars(sample_bars)
        
        state = ScaleState(
            start_bar_index=2,
            end_bar_index=7,
            min_price=90,
            max_price=120,
            viewport_width=1000,
            viewport_height=500,
        )
        
        chart.set_scale_state(state)
        
        new_state = chart.get_scale_state()
        assert new_state.start_bar_index == 2
    
    def test_pan(self, chart, sample_bars):
        """Should pan chart."""
        chart.set_bars(sample_bars)
        original_start = chart.get_scale_state().start_bar_index
        
        chart.pan(5)
        
        new_start = chart.get_scale_state().start_bar_index
        assert new_start == original_start + 5
    
    def test_zoom(self, chart, sample_bars):
        """Should zoom chart."""
        chart.set_bars(sample_bars)
        original_bars = chart.get_scale_state().end_bar_index - chart.get_scale_state().start_bar_index
        
        chart.zoom(2.0)  # Zoom in
        
        new_bars = chart.get_scale_state().end_bar_index - chart.get_scale_state().start_bar_index
        assert new_bars < original_bars
    
    def test_scale_change_callback(self, chart, sample_bars):
        """Should notify on scale change."""
        chart.set_bars(sample_bars)
        
        callback_called = []
        
        def on_change(state):
            callback_called.append(state)
        
        chart.on_scale_change(on_change)
        chart.pan(3)
        
        assert len(callback_called) == 1
    
    def test_get_bar_at_x(self, chart, sample_bars):
        """Should get bar at X coordinate."""
        chart.set_bars(sample_bars)
        
        # Get bar near center
        chart_area = chart.layout.chart_area
        center_x = chart_area.x + chart_area.width / 2
        
        bar = chart.get_bar_at_x(center_x)
        
        assert bar is not None
    
    def test_get_price_at_y(self, chart, sample_bars):
        """Should get price at Y coordinate."""
        chart.set_bars(sample_bars)
        
        chart_area = chart.layout.chart_area
        center_y = chart_area.y + chart_area.height / 2
        
        price = chart.get_price_at_y(center_y)
        
        assert price is not None
    
    def test_frame_hash(self, chart, sample_bars):
        """Should compute frame hash."""
        chart.set_bars(sample_bars)
        
        hash1 = chart.compute_frame_hash()
        hash2 = chart.compute_frame_hash()
        
        assert hash1 == hash2
        assert len(hash1) == 64


class TestCreateChart:
    """Tests for create_chart helper."""
    
    def test_simple(self):
        """Should create chart from dict bars."""
        bars = [
            {"open": 100, "high": 105, "low": 98, "close": 103},
            {"open": 103, "high": 108, "low": 101, "close": 106},
        ]
        
        png, hash_val = create_chart(bars)
        
        assert isinstance(png, bytes)
        assert len(hash_val) == 64
    
    def test_deterministic(self):
        """Same bars should produce same output."""
        bars = [
            {"open": 100, "high": 105, "low": 98, "close": 103},
            {"open": 103, "high": 108, "low": 101, "close": 106},
        ]
        
        _, hash1 = create_chart(bars)
        _, hash2 = create_chart(bars)
        
        assert hash1 == hash2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
