"""
Unit tests for Scale Engine.

Tests cover:
- Coordinate transforms
- Price scale calculations
- Time scale calculations
- Pan/zoom operations
- Nice tick generation
"""

import pytest
import math

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.charting.scale_engine import (
    Timeframe,
    TimeframeUnit,
    PriceScale,
    TimeScale,
    Viewport,
    ScaleEngine,
    ScaleState,
    compute_nice_ticks,
    compute_time_ticks,
    auto_scale_price,
)
from services.charting.primitives import Point


class TestTimeframe:
    """Tests for Timeframe."""
    
    def test_duration_minute(self):
        """Should calculate minute duration."""
        tf = Timeframe(1, TimeframeUnit.MINUTE)
        assert tf.duration_ms == 60 * 1000
    
    def test_duration_5min(self):
        """Should calculate 5-minute duration."""
        tf = Timeframe(5, TimeframeUnit.MINUTE)
        assert tf.duration_ms == 5 * 60 * 1000
    
    def test_duration_hour(self):
        """Should calculate hour duration."""
        tf = Timeframe(1, TimeframeUnit.HOUR)
        assert tf.duration_ms == 60 * 60 * 1000
    
    def test_str(self):
        """Should convert to string."""
        tf = Timeframe(5, TimeframeUnit.MINUTE)
        assert str(tf) == "5m"
    
    def test_from_string(self):
        """Should parse string."""
        tf = Timeframe.from_string("15m")
        assert tf.multiplier == 15
        assert tf.unit == TimeframeUnit.MINUTE
    
    def test_from_string_hour(self):
        """Should parse hour string."""
        tf = Timeframe.from_string("4h")
        assert tf.multiplier == 4
        assert tf.unit == TimeframeUnit.HOUR


class TestPriceScale:
    """Tests for PriceScale."""
    
    def test_range(self):
        """Should calculate range."""
        scale = PriceScale(min_price=100, max_price=200)
        assert scale.range == 100
    
    def test_price_to_normalized(self):
        """Should normalize price."""
        scale = PriceScale(min_price=100, max_price=200)
        
        assert scale.price_to_normalized(100) == 0.0
        assert scale.price_to_normalized(150) == 0.5
        assert scale.price_to_normalized(200) == 1.0
    
    def test_normalized_to_price(self):
        """Should denormalize price."""
        scale = PriceScale(min_price=100, max_price=200)
        
        assert scale.normalized_to_price(0.0) == 100
        assert scale.normalized_to_price(0.5) == 150
        assert scale.normalized_to_price(1.0) == 200
    
    def test_with_margins(self):
        """Should apply margins."""
        scale = PriceScale(min_price=100, max_price=200, margin_top=0.1, margin_bottom=0.1)
        with_margins = scale.with_margins()
        
        assert with_margins.min_price < 100
        assert with_margins.max_price > 200
    
    def test_log_scale(self):
        """Should handle log scale."""
        scale = PriceScale(min_price=10, max_price=1000, log_scale=True)
        
        # Mid-point in log scale
        mid = scale.normalized_to_price(0.5)
        assert mid == pytest.approx(100, rel=0.01)


class TestTimeScale:
    """Tests for TimeScale."""
    
    def test_visible_bars(self):
        """Should calculate visible bars."""
        scale = TimeScale(start_bar_index=0, end_bar_index=100)
        assert scale.visible_bars == 100
    
    def test_bar_index_to_normalized(self):
        """Should normalize bar index."""
        scale = TimeScale(start_bar_index=0, end_bar_index=100)
        
        assert scale.bar_index_to_normalized(0) == 0.0
        assert scale.bar_index_to_normalized(50) == 0.5
        assert scale.bar_index_to_normalized(100) == 1.0
    
    def test_normalized_to_bar_index(self):
        """Should denormalize bar index."""
        scale = TimeScale(start_bar_index=100, end_bar_index=200)
        
        assert scale.normalized_to_bar_index(0.0) == 100
        assert scale.normalized_to_bar_index(0.5) == 150
        assert scale.normalized_to_bar_index(1.0) == 200


class TestViewport:
    """Tests for Viewport."""
    
    def test_rect(self):
        """Should convert to rect."""
        vp = Viewport(x=10, y=20, width=100, height=50)
        rect = vp.rect
        
        assert rect.x == 10
        assert rect.width == 100
    
    def test_physical_dimensions(self):
        """Should calculate physical dimensions."""
        vp = Viewport(x=0, y=0, width=640, height=480, device_pixel_ratio=2.0)
        
        assert vp.physical_width == 1280
        assert vp.physical_height == 960


class TestScaleEngine:
    """Tests for ScaleEngine."""
    
    @pytest.fixture
    def engine(self):
        """Create scale engine."""
        return ScaleEngine(
            viewport=Viewport(x=0, y=0, width=1000, height=500),
            price_scale=PriceScale(min_price=100, max_price=200),
            time_scale=TimeScale(start_bar_index=0, end_bar_index=100),
        )
    
    def test_data_to_screen_origin(self, engine):
        """Should convert origin."""
        # Bar 0 at min price should be bottom-left
        point = engine.data_to_screen(0, 100)
        assert point.x == pytest.approx(0)
        assert point.y == pytest.approx(500)  # Bottom
    
    def test_data_to_screen_max(self, engine):
        """Should convert max point."""
        # Last bar at max price should be top-right
        point = engine.data_to_screen(100, 200)
        assert point.x == pytest.approx(1000)
        assert point.y == pytest.approx(0)  # Top
    
    def test_data_to_screen_center(self, engine):
        """Should convert center."""
        point = engine.data_to_screen(50, 150)
        assert point.x == pytest.approx(500)
        assert point.y == pytest.approx(250)
    
    def test_screen_to_data(self, engine):
        """Should convert screen to data."""
        bar_index, price = engine.screen_to_data(500, 250)
        assert bar_index == pytest.approx(50)
        assert price == pytest.approx(150)
    
    def test_roundtrip(self, engine):
        """Data->screen->data should roundtrip."""
        original_bar = 37
        original_price = 142.5
        
        point = engine.data_to_screen(original_bar, original_price)
        bar, price = engine.screen_to_data(point.x, point.y)
        
        assert bar == pytest.approx(original_bar)
        assert price == pytest.approx(original_price)
    
    def test_bar_index_to_x(self, engine):
        """Should convert bar index to X."""
        assert engine.bar_index_to_x(0) == pytest.approx(0)
        assert engine.bar_index_to_x(50) == pytest.approx(500)
        assert engine.bar_index_to_x(100) == pytest.approx(1000)
    
    def test_x_to_bar_index(self, engine):
        """Should convert X to bar index."""
        assert engine.x_to_bar_index(0) == pytest.approx(0)
        assert engine.x_to_bar_index(500) == pytest.approx(50)
    
    def test_price_to_y(self, engine):
        """Should convert price to Y."""
        assert engine.price_to_y(100) == pytest.approx(500)  # Bottom
        assert engine.price_to_y(200) == pytest.approx(0)  # Top
    
    def test_y_to_price(self, engine):
        """Should convert Y to price."""
        assert engine.y_to_price(500) == pytest.approx(100)
        assert engine.y_to_price(0) == pytest.approx(200)
    
    def test_bar_width(self, engine):
        """Should calculate bar width."""
        width = engine.get_bar_width()
        assert width == pytest.approx(10)  # 1000 / 100
    
    def test_candle_width(self, engine):
        """Should calculate candle width."""
        width = engine.get_candle_width(0.8)
        assert width == pytest.approx(8)  # 10 * 0.8
    
    def test_pan(self, engine):
        """Should pan viewport."""
        panned = engine.pan(10)
        
        assert panned.time_scale.start_bar_index == 10
        assert panned.time_scale.end_bar_index == 110
    
    def test_zoom_in(self, engine):
        """Should zoom in (show fewer bars)."""
        zoomed = engine.zoom(2.0)  # 2x zoom
        
        assert zoomed.time_scale.visible_bars == 50
    
    def test_zoom_out(self, engine):
        """Should zoom out (show more bars)."""
        zoomed = engine.zoom(0.5)  # 0.5x zoom
        
        assert zoomed.time_scale.visible_bars == 200


class TestNiceTicks:
    """Tests for compute_nice_ticks."""
    
    def test_simple_range(self):
        """Should compute nice ticks."""
        ticks = compute_nice_ticks(0, 100, 5)
        
        assert len(ticks) >= 3
        assert all(t >= 0 for t in ticks)
        assert all(t <= 100 for t in ticks)
    
    def test_decimal_range(self):
        """Should handle decimal range."""
        ticks = compute_nice_ticks(0.5, 1.5, 5)
        
        assert len(ticks) >= 3
    
    def test_large_range(self):
        """Should handle large range."""
        ticks = compute_nice_ticks(0, 10000, 5)
        
        assert len(ticks) >= 3
        # Should have nice intervals like 2000
        steps = [ticks[i+1] - ticks[i] for i in range(len(ticks)-1)]
        assert all(s > 0 for s in steps)


class TestTimeTicks:
    """Tests for compute_time_ticks."""
    
    def test_simple(self):
        """Should compute time ticks."""
        tf = Timeframe(1, TimeframeUnit.MINUTE)
        ticks = compute_time_ticks(0, 100, tf, 8)
        
        assert len(ticks) >= 3
        assert all(isinstance(t, tuple) for t in ticks)


class TestScaleState:
    """Tests for ScaleState."""
    
    def test_to_dict(self):
        """Should convert to dict."""
        state = ScaleState(
            start_bar_index=0,
            end_bar_index=100,
            min_price=100,
            max_price=200,
            viewport_width=1000,
            viewport_height=500,
        )
        
        d = state.to_dict()
        
        assert d["start_bar_index"] == 0
        assert d["viewport_width"] == 1000
    
    def test_from_dict(self):
        """Should create from dict."""
        d = {
            "start_bar_index": 0,
            "end_bar_index": 100,
            "min_price": 100,
            "max_price": 200,
            "viewport_width": 1000,
            "viewport_height": 500,
            "device_pixel_ratio": 2.0,
        }
        
        state = ScaleState.from_dict(d)
        
        assert state.start_bar_index == 0
        assert state.device_pixel_ratio == 2.0
    
    def test_to_scale_engine(self):
        """Should convert to ScaleEngine."""
        state = ScaleState(
            start_bar_index=0,
            end_bar_index=100,
            min_price=100,
            max_price=200,
            viewport_width=1000,
            viewport_height=500,
        )
        
        engine = state.to_scale_engine()
        
        assert engine.time_scale.visible_bars == 100
        assert engine.viewport.width == 1000


class TestAutoScalePrice:
    """Tests for auto_scale_price."""
    
    def test_with_bars(self):
        """Should compute scale from bars."""
        bars = [
            {"high": 110, "low": 100},
            {"high": 120, "low": 105},
            {"high": 115, "low": 108},
        ]
        
        scale = auto_scale_price(bars)
        
        assert scale.min_price < 100
        assert scale.max_price > 120
    
    def test_empty_bars(self):
        """Should handle empty bars."""
        scale = auto_scale_price([])
        
        assert scale.min_price == 0
        assert scale.max_price == 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
