"""
Unit tests for Charting Renderer Core.

Tests cover:
- Primitives (Point, Rect, Color)
- Command buffer
- Deterministic rendering
- PNG export
"""

import pytest
from io import BytesIO

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.charting.primitives import (
    Point, Rect, Color, Colors,
    LineStyle, FillStyle, TextStyle,
    CommandBuffer, DrawLineCommand, DrawRectCommand, DrawCandleCommand,
)
from services.charting.renderer import (
    RendererConfig,
    RenderContext,
    DeterministicRenderer,
    CanvasRenderer,
    render_frame,
)


class TestPoint:
    """Tests for Point primitive."""
    
    def test_creation(self):
        """Should create point with x, y."""
        p = Point(10.5, 20.5)
        assert p.x == 10.5
        assert p.y == 20.5
    
    def test_addition(self):
        """Should add points."""
        p1 = Point(10, 20)
        p2 = Point(5, 15)
        result = p1 + p2
        assert result.x == 15
        assert result.y == 35
    
    def test_subtraction(self):
        """Should subtract points."""
        p1 = Point(10, 20)
        p2 = Point(5, 15)
        result = p1 - p2
        assert result.x == 5
        assert result.y == 5
    
    def test_scale(self):
        """Should scale point."""
        p = Point(10, 20)
        result = p.scale(2.0)
        assert result.x == 20
        assert result.y == 40
    
    def test_to_tuple(self):
        """Should convert to tuple."""
        p = Point(10.5, 20.5)
        assert p.to_tuple() == (10.5, 20.5)
    
    def test_to_int_tuple(self):
        """Should round to int tuple."""
        p = Point(10.4, 20.6)
        assert p.to_int_tuple() == (10, 21)
    
    def test_distance(self):
        """Should calculate distance."""
        p1 = Point(0, 0)
        p2 = Point(3, 4)
        assert p1.distance_to(p2) == 5.0
    
    def test_immutable(self):
        """Point should be immutable."""
        p = Point(10, 20)
        with pytest.raises(AttributeError):
            p.x = 30


class TestRect:
    """Tests for Rect primitive."""
    
    def test_creation(self):
        """Should create rect."""
        r = Rect(10, 20, 100, 50)
        assert r.x == 10
        assert r.y == 20
        assert r.width == 100
        assert r.height == 50
    
    def test_properties(self):
        """Should have correct edge properties."""
        r = Rect(10, 20, 100, 50)
        assert r.left == 10
        assert r.top == 20
        assert r.right == 110
        assert r.bottom == 70
    
    def test_center(self):
        """Should calculate center."""
        r = Rect(0, 0, 100, 50)
        center = r.center
        assert center.x == 50
        assert center.y == 25
    
    def test_contains_point(self):
        """Should check point containment."""
        r = Rect(0, 0, 100, 50)
        assert r.contains(Point(50, 25))
        assert not r.contains(Point(150, 25))
    
    def test_intersects(self):
        """Should check intersection."""
        r1 = Rect(0, 0, 100, 50)
        r2 = Rect(50, 25, 100, 50)
        r3 = Rect(200, 200, 50, 50)
        
        assert r1.intersects(r2)
        assert not r1.intersects(r3)


class TestColor:
    """Tests for Color primitive."""
    
    def test_creation(self):
        """Should create color."""
        c = Color(255, 128, 64, 200)
        assert c.r == 255
        assert c.g == 128
        assert c.b == 64
        assert c.a == 200
    
    def test_default_alpha(self):
        """Should default alpha to 255."""
        c = Color(255, 128, 64)
        assert c.a == 255
    
    def test_clamping(self):
        """Should clamp values to 0-255."""
        c = Color(300, -50, 128)
        assert c.r == 255
        assert c.g == 0
    
    def test_to_rgba_string(self):
        """Should convert to rgba string."""
        c = Color(255, 128, 64, 128)
        s = c.to_rgba_string()
        assert s == "rgba(255,128,64,0.502)"
    
    def test_to_hex(self):
        """Should convert to hex."""
        c = Color(255, 128, 64)
        assert c.to_hex() == "#ff8040"
        
        c2 = Color(255, 128, 64, 128)
        assert c2.to_hex() == "#ff804080"
    
    def test_from_hex(self):
        """Should parse hex string."""
        c = Color.from_hex("#ff8040")
        assert c.r == 255
        assert c.g == 128
        assert c.b == 64
        
        c2 = Color.from_hex("#ff804080")
        assert c2.a == 128
    
    def test_with_alpha(self):
        """Should create color with new alpha."""
        c = Color(255, 128, 64)
        c2 = c.with_alpha(100)
        assert c2.a == 100
        assert c2.r == 255


class TestColors:
    """Tests for predefined colors."""
    
    def test_black(self):
        """Should have black."""
        assert Colors.BLACK.r == 0
        assert Colors.BLACK.g == 0
        assert Colors.BLACK.b == 0
    
    def test_white(self):
        """Should have white."""
        assert Colors.WHITE.r == 255
    
    def test_chart_colors(self):
        """Should have chart colors."""
        assert Colors.BULL_GREEN.g > Colors.BULL_GREEN.r
        assert Colors.BEAR_RED.r > Colors.BEAR_RED.g


class TestLineStyle:
    """Tests for LineStyle."""
    
    def test_creation(self):
        """Should create line style."""
        style = LineStyle(color=Colors.RED, width=2.0)
        assert style.color == Colors.RED
        assert style.width == 2.0
    
    def test_to_dict(self):
        """Should convert to dict."""
        style = LineStyle(color=Colors.RED, width=2.0)
        d = style.to_dict()
        assert d["width"] == 2.0


class TestCommandBuffer:
    """Tests for CommandBuffer."""
    
    def test_add_command(self):
        """Should add commands."""
        buf = CommandBuffer()
        cmd = DrawLineCommand(
            start=Point(0, 0),
            end=Point(100, 100),
            style=LineStyle(Colors.RED),
        )
        buf.add(cmd)
        assert len(buf) == 1
    
    def test_clear(self):
        """Should clear commands."""
        buf = CommandBuffer()
        buf.add(DrawLineCommand(Point(0, 0), Point(10, 10), LineStyle(Colors.RED)))
        buf.clear()
        assert len(buf) == 0
    
    def test_deterministic_hash(self):
        """Same commands should produce same hash."""
        buf1 = CommandBuffer()
        buf2 = CommandBuffer()
        
        for buf in [buf1, buf2]:
            buf.add(DrawLineCommand(Point(0, 0), Point(100, 100), LineStyle(Colors.RED)))
            buf.add(DrawRectCommand(Rect(10, 10, 50, 50), FillStyle(Colors.BLUE)))
        
        assert buf1.compute_hash() == buf2.compute_hash()
    
    def test_different_commands_different_hash(self):
        """Different commands should produce different hash."""
        buf1 = CommandBuffer()
        buf2 = CommandBuffer()
        
        buf1.add(DrawLineCommand(Point(0, 0), Point(100, 100), LineStyle(Colors.RED)))
        buf2.add(DrawLineCommand(Point(0, 0), Point(100, 101), LineStyle(Colors.RED)))
        
        assert buf1.compute_hash() != buf2.compute_hash()


class TestRendererConfig:
    """Tests for RendererConfig."""
    
    def test_defaults(self):
        """Should have sensible defaults."""
        config = RendererConfig()
        assert config.width == 1280
        assert config.height == 800
        assert config.device_pixel_ratio == 2.0
    
    def test_physical_dimensions(self):
        """Should calculate physical dimensions."""
        config = RendererConfig(width=640, height=480, device_pixel_ratio=2.0)
        assert config.physical_width == 1280
        assert config.physical_height == 960


class TestDeterministicRenderer:
    """Tests for DeterministicRenderer."""
    
    def test_begin_end_frame(self):
        """Should begin and end frame."""
        renderer = DeterministicRenderer()
        context = RenderContext(config=RendererConfig())
        
        renderer.begin_frame(context)
        hash_value = renderer.end_frame()
        
        assert isinstance(hash_value, str)
        assert len(hash_value) == 64  # SHA256
    
    def test_draw_commands_recorded(self):
        """Should record draw commands."""
        renderer = DeterministicRenderer()
        context = RenderContext(config=RendererConfig())
        
        renderer.begin_frame(context)
        renderer.draw_line(Point(0, 0), Point(100, 100), LineStyle(Colors.RED))
        renderer.draw_rect(Rect(10, 10, 50, 50), fill=FillStyle(Colors.BLUE))
        
        assert renderer.command_count == 2
    
    def test_deterministic_output(self):
        """Same operations should produce same hash."""
        def render_sequence(renderer):
            context = RenderContext(config=RendererConfig())
            renderer.begin_frame(context)
            renderer.draw_line(Point(0, 0), Point(100, 100), LineStyle(Colors.RED))
            renderer.draw_candle(50, 100, 110, 90, 105, 10, True)
            return renderer.end_frame()
        
        hash1 = render_sequence(DeterministicRenderer())
        hash2 = render_sequence(DeterministicRenderer())
        
        assert hash1 == hash2


class TestCanvasRenderer:
    """Tests for CanvasRenderer."""
    
    @pytest.fixture
    def renderer(self):
        """Create renderer."""
        return CanvasRenderer(RendererConfig(width=200, height=100))
    
    def test_begin_creates_image(self, renderer):
        """Should create image on begin."""
        context = RenderContext(config=renderer.config)
        renderer.begin_frame(context)
        
        assert renderer._image is not None
    
    def test_export_png(self, renderer):
        """Should export PNG bytes."""
        context = RenderContext(config=renderer.config)
        renderer.begin_frame(context)
        renderer.draw_rect(Rect(10, 10, 50, 50), fill=FillStyle(Colors.RED))
        renderer.end_frame()
        
        png_bytes = renderer.export_png()
        
        assert isinstance(png_bytes, bytes)
        assert len(png_bytes) > 0
        # Check PNG magic bytes
        assert png_bytes[:8] == b'\x89PNG\r\n\x1a\n'
    
    def test_pixel_hash_deterministic(self, renderer):
        """Same rendering should produce same pixel hash."""
        def render_and_hash():
            r = CanvasRenderer(RendererConfig(width=100, height=100))
            context = RenderContext(config=r.config)
            r.begin_frame(context)
            r.draw_rect(Rect(10, 10, 50, 50), fill=FillStyle(Colors.RED))
            r.end_frame()
            return r.compute_pixel_hash()
        
        hash1 = render_and_hash()
        hash2 = render_and_hash()
        
        assert hash1 == hash2
    
    def test_draw_candle(self, renderer):
        """Should draw candlestick."""
        context = RenderContext(config=renderer.config)
        renderer.begin_frame(context)
        
        renderer.draw_candle(
            x=50,
            open_price=30,
            high_price=20,
            low_price=60,
            close_price=40,
            width=10,
            is_bullish=True,
        )
        
        renderer.end_frame()
        
        png_bytes = renderer.export_png()
        assert len(png_bytes) > 0


class TestRenderFrame:
    """Tests for render_frame helper."""
    
    def test_empty_bars(self):
        """Should handle empty bars."""
        png_bytes, pixel_hash = render_frame([])
        
        assert isinstance(png_bytes, bytes)
        assert len(pixel_hash) == 64
    
    def test_with_bars(self):
        """Should render bars."""
        bars = [
            {"open": 100, "high": 105, "low": 98, "close": 103},
            {"open": 103, "high": 107, "low": 101, "close": 102},
            {"open": 102, "high": 104, "low": 99, "close": 100},
        ]
        
        png_bytes, pixel_hash = render_frame(bars)
        
        assert isinstance(png_bytes, bytes)
        assert png_bytes[:8] == b'\x89PNG\r\n\x1a\n'
    
    def test_deterministic_render(self):
        """Same bars should produce same hash."""
        bars = [
            {"open": 100, "high": 105, "low": 98, "close": 103},
            {"open": 103, "high": 107, "low": 101, "close": 102},
        ]
        
        _, hash1 = render_frame(bars)
        _, hash2 = render_frame(bars)
        
        assert hash1 == hash2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
