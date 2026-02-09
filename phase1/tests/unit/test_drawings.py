"""
Unit tests for Drawing Tools.

Tests cover:
- Drawing creation
- Hit testing
- Rendering
- Serialization
"""

import pytest
import math

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.charting.drawings import (
    DrawingType,
    DrawingAnchor,
    DrawingPoint,
    DrawingStyle,
    Drawing,
    TrendLine,
    HorizontalLine,
    VerticalLine,
    FibonacciRetracement,
    RectangleDrawing,
    TextAnnotation,
    DrawingRenderer,
    DrawingManager,
    create_trend_line,
    create_horizontal_line,
    create_fibonacci,
)
from services.charting.chart_wrapper import ChartWrapper, Bar
from services.charting.primitives import Color, Colors, CommandBuffer, Rect


@pytest.fixture
def sample_bars():
    """Create sample bars."""
    return [
        Bar(i, i * 60000, 100 + i, 105 + i, 98 + i, 102 + i, 1000)
        for i in range(20)
    ]


@pytest.fixture
def chart_with_bars(sample_bars):
    """Create chart with bars."""
    chart = ChartWrapper(chart_id="test-chart")
    chart.set_bars(sample_bars)
    return chart


class TestDrawingPoint:
    """Tests for DrawingPoint."""
    
    def test_creation(self):
        """Should create drawing point."""
        point = DrawingPoint(10, 100.0)
        
        assert point.bar_index == 10
        assert point.price == 100.0
    
    def test_to_screen(self, chart_with_bars):
        """Should convert to screen coordinates."""
        point = DrawingPoint(5, 105.0)
        
        scale = chart_with_bars._scale_engine
        chart_area = chart_with_bars.layout.chart_area
        
        screen = point.to_screen(scale, chart_area)
        
        assert screen.x >= chart_area.x
        assert screen.y >= chart_area.y
    
    def test_from_screen(self, chart_with_bars):
        """Should create from screen coordinates."""
        scale = chart_with_bars._scale_engine
        chart_area = chart_with_bars.layout.chart_area
        
        from services.charting.primitives import Point
        screen_point = Point(chart_area.x + 100, chart_area.y + 200)
        
        drawing_point = DrawingPoint.from_screen(screen_point, scale, chart_area)
        
        assert drawing_point.bar_index >= 0
        assert drawing_point.price > 0


class TestDrawingStyle:
    """Tests for DrawingStyle."""
    
    def test_defaults(self):
        """Should have sensible defaults."""
        style = DrawingStyle()
        
        assert style.line_width == 1.5
        assert style.show_labels is True
    
    def test_custom_color(self):
        """Should accept custom color."""
        style = DrawingStyle(line_color=Colors.BULL_GREEN)
        
        assert style.line_color == Colors.BULL_GREEN


class TestDrawing:
    """Tests for Drawing base class."""
    
    def test_get_bounds(self):
        """Should calculate bounding box."""
        points = [
            DrawingPoint(5, 100),
            DrawingPoint(15, 150),
        ]
        
        drawing = Drawing(
            id="test",
            drawing_type=DrawingType.TREND_LINE,
            points=points,
            style=DrawingStyle(),
        )
        
        bounds = drawing.get_bounds()
        
        assert bounds == (5, 100, 15, 150)
    
    def test_hit_test_anchor(self):
        """Should hit test anchor points."""
        points = [
            DrawingPoint(5, 100),
            DrawingPoint(15, 150),
        ]
        
        drawing = Drawing(
            id="test",
            drawing_type=DrawingType.TREND_LINE,
            points=points,
            style=DrawingStyle(),
        )
        
        # Test start anchor
        result = drawing.hit_test(DrawingPoint(5.1, 100.1))
        assert result == DrawingAnchor.START
        
        # Test end anchor
        result = drawing.hit_test(DrawingPoint(15, 150))
        assert result == DrawingAnchor.END
        
        # Test miss
        result = drawing.hit_test(DrawingPoint(0, 0))
        assert result is None
    
    def test_move(self):
        """Should move all points."""
        points = [
            DrawingPoint(5, 100),
            DrawingPoint(15, 150),
        ]
        
        drawing = Drawing(
            id="test",
            drawing_type=DrawingType.TREND_LINE,
            points=points,
            style=DrawingStyle(),
        )
        
        drawing.move(5, 10)
        
        assert drawing.points[0].bar_index == 10
        assert drawing.points[0].price == 110
    
    def test_move_locked(self):
        """Should not move when locked."""
        points = [
            DrawingPoint(5, 100),
        ]
        
        drawing = Drawing(
            id="test",
            drawing_type=DrawingType.TREND_LINE,
            points=points,
            style=DrawingStyle(),
            locked=True,
        )
        
        drawing.move(5, 10)
        
        assert drawing.points[0].bar_index == 5  # Unchanged


class TestTrendLine:
    """Tests for TrendLine."""
    
    def test_creation(self):
        """Should create trend line."""
        line = TrendLine(
            DrawingPoint(5, 100),
            DrawingPoint(15, 150),
        )
        
        assert line.drawing_type == DrawingType.TREND_LINE
        assert line.start.bar_index == 5
        assert line.end.bar_index == 15
    
    def test_get_angle(self):
        """Should calculate angle."""
        line = TrendLine(
            DrawingPoint(0, 0),
            DrawingPoint(10, 10),
        )
        
        angle = line.get_angle()
        
        assert abs(angle - 45) < 0.1
    
    def test_get_length(self):
        """Should calculate length."""
        line = TrendLine(
            DrawingPoint(0, 0),
            DrawingPoint(3, 4),
        )
        
        length = line.get_length()
        
        assert abs(length - 5) < 0.01


class TestHorizontalLine:
    """Tests for HorizontalLine."""
    
    def test_creation(self):
        """Should create horizontal line."""
        line = HorizontalLine(100.0)
        
        assert line.drawing_type == DrawingType.HORIZONTAL_LINE
        assert line.price == 100.0
    
    def test_set_price(self):
        """Should update price."""
        line = HorizontalLine(100.0)
        
        line.price = 150.0
        
        assert line.price == 150.0


class TestVerticalLine:
    """Tests for VerticalLine."""
    
    def test_creation(self):
        """Should create vertical line."""
        line = VerticalLine(10)
        
        assert line.drawing_type == DrawingType.VERTICAL_LINE
        assert line.bar_index == 10
    
    def test_set_bar_index(self):
        """Should update bar index."""
        line = VerticalLine(10)
        
        line.bar_index = 15
        
        assert line.bar_index == 15


class TestFibonacciRetracement:
    """Tests for FibonacciRetracement."""
    
    def test_creation(self):
        """Should create Fibonacci."""
        fib = FibonacciRetracement(
            DrawingPoint(0, 100),
            DrawingPoint(10, 200),
        )
        
        assert fib.drawing_type == DrawingType.FIBONACCI_RETRACEMENT
        assert len(fib.levels) == 7
    
    def test_get_level_price(self):
        """Should calculate level prices."""
        fib = FibonacciRetracement(
            DrawingPoint(0, 100),
            DrawingPoint(10, 200),
        )
        
        assert fib.get_level_price(0.0) == 100
        assert fib.get_level_price(0.5) == 150
        assert fib.get_level_price(1.0) == 200
    
    def test_custom_levels(self):
        """Should accept custom levels."""
        fib = FibonacciRetracement(
            DrawingPoint(0, 100),
            DrawingPoint(10, 200),
            levels=[0.0, 0.382, 0.618, 1.0],
        )
        
        assert len(fib.levels) == 4


class TestRectangleDrawing:
    """Tests for RectangleDrawing."""
    
    def test_creation(self):
        """Should create rectangle."""
        rect = RectangleDrawing(
            DrawingPoint(5, 150),
            DrawingPoint(15, 100),
        )
        
        assert rect.drawing_type == DrawingType.RECTANGLE
        assert rect.top_left.bar_index == 5
        assert rect.bottom_right.bar_index == 15


class TestTextAnnotation:
    """Tests for TextAnnotation."""
    
    def test_creation(self):
        """Should create text annotation."""
        text = TextAnnotation(
            DrawingPoint(10, 120),
            "Support Line",
        )
        
        assert text.drawing_type == DrawingType.TEXT
        assert text.text == "Support Line"


class TestDrawingRenderer:
    """Tests for DrawingRenderer."""
    
    def test_render_trend_line(self, chart_with_bars):
        """Should render trend line."""
        renderer = DrawingRenderer(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        
        buf = CommandBuffer()
        renderer.render(line, buf)
        
        assert len(buf) > 0
    
    def test_render_horizontal_line(self, chart_with_bars):
        """Should render horizontal line."""
        renderer = DrawingRenderer(chart_with_bars)
        line = HorizontalLine(110.0)
        
        buf = CommandBuffer()
        renderer.render(line, buf)
        
        assert len(buf) > 0
    
    def test_render_fibonacci(self, chart_with_bars):
        """Should render Fibonacci."""
        renderer = DrawingRenderer(chart_with_bars)
        fib = FibonacciRetracement(
            DrawingPoint(2, 102),
            DrawingPoint(10, 112),
        )
        
        buf = CommandBuffer()
        renderer.render(fib, buf)
        
        # Should have multiple lines for levels
        assert len(buf) > 7
    
    def test_render_not_visible(self, chart_with_bars):
        """Should not render invisible drawing."""
        renderer = DrawingRenderer(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        line.visible = False
        
        buf = CommandBuffer()
        renderer.render(line, buf)
        
        assert len(buf) == 0


class TestDrawingManager:
    """Tests for DrawingManager."""
    
    def test_add(self, chart_with_bars):
        """Should add drawing."""
        manager = DrawingManager(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        
        drawing_id = manager.add(line)
        
        assert drawing_id is not None
        assert len(manager.get_all()) == 1
    
    def test_remove(self, chart_with_bars):
        """Should remove drawing."""
        manager = DrawingManager(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        drawing_id = manager.add(line)
        
        result = manager.remove(drawing_id)
        
        assert result is True
        assert len(manager.get_all()) == 0
    
    def test_get(self, chart_with_bars):
        """Should get drawing by ID."""
        manager = DrawingManager(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        drawing_id = manager.add(line)
        
        retrieved = manager.get(drawing_id)
        
        assert retrieved == line
    
    def test_clear(self, chart_with_bars):
        """Should clear all drawings."""
        manager = DrawingManager(chart_with_bars)
        manager.add(TrendLine(DrawingPoint(5, 105), DrawingPoint(15, 115)))
        manager.add(HorizontalLine(110))
        
        manager.clear()
        
        assert len(manager.get_all()) == 0
    
    def test_select(self, chart_with_bars):
        """Should select drawing."""
        manager = DrawingManager(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        drawing_id = manager.add(line)
        
        result = manager.select(drawing_id)
        
        assert result is True
        assert manager.get_selected() == line
    
    def test_deselect(self, chart_with_bars):
        """Should deselect."""
        manager = DrawingManager(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        drawing_id = manager.add(line)
        manager.select(drawing_id)
        
        manager.deselect()
        
        assert manager.get_selected() is None
    
    def test_hit_test(self, chart_with_bars):
        """Should hit test drawings."""
        manager = DrawingManager(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        drawing_id = manager.add(line)
        
        result = manager.hit_test(DrawingPoint(5, 105))
        
        assert result is not None
        assert result[0] == drawing_id
    
    def test_move_selected(self, chart_with_bars):
        """Should move selected drawing."""
        manager = DrawingManager(chart_with_bars)
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        drawing_id = manager.add(line)
        manager.select(drawing_id)
        
        manager.move_selected(2, 5)
        
        assert line.points[0].bar_index == 7
        assert line.points[0].price == 110
    
    def test_change_listener(self, chart_with_bars):
        """Should notify change listeners."""
        manager = DrawingManager(chart_with_bars)
        
        events = []
        manager.on_change(lambda e, d: events.append((e, d)))
        
        line = TrendLine(
            DrawingPoint(5, 105),
            DrawingPoint(15, 115),
        )
        manager.add(line)
        
        assert len(events) == 1
        assert events[0][0] == "add"
    
    def test_render(self, chart_with_bars):
        """Should render all drawings."""
        manager = DrawingManager(chart_with_bars)
        manager.add(TrendLine(DrawingPoint(5, 105), DrawingPoint(15, 115)))
        manager.add(HorizontalLine(110))
        
        buf = CommandBuffer()
        manager.render(buf)
        
        assert len(buf) > 0
    
    def test_to_dict(self, chart_with_bars):
        """Should serialize drawings."""
        manager = DrawingManager(chart_with_bars)
        manager.add(TrendLine(DrawingPoint(5, 105), DrawingPoint(15, 115)))
        
        data = manager.to_dict()
        
        assert len(data) == 1
        assert data[0]["type"] == "TREND_LINE"
    
    def test_from_dict(self, chart_with_bars):
        """Should deserialize drawings."""
        manager = DrawingManager(chart_with_bars)
        
        data = [{
            "id": "test-line",
            "type": "TREND_LINE",
            "points": [
                {"bar_index": 5, "price": 105},
                {"bar_index": 15, "price": 115},
            ],
            "style": {
                "line_color": "#2196f3",
                "line_width": 1.5,
            },
            "visible": True,
            "locked": False,
        }]
        
        manager.from_dict(data)
        
        assert len(manager.get_all()) == 1
        assert manager.get("test-line") is not None


class TestHelperFunctions:
    """Tests for helper functions."""
    
    def test_create_trend_line(self):
        """Should create trend line."""
        line = create_trend_line(5, 100, 15, 150)
        
        assert line.start.bar_index == 5
        assert line.end.bar_index == 15
    
    def test_create_horizontal_line(self):
        """Should create horizontal line."""
        line = create_horizontal_line(100)
        
        assert line.price == 100
    
    def test_create_fibonacci(self):
        """Should create Fibonacci."""
        fib = create_fibonacci(0, 100, 10, 200)
        
        assert fib.start.bar_index == 0
        assert fib.end.bar_index == 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
