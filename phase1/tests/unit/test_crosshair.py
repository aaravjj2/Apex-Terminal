"""
Unit tests for Crosshair & Tooltip.

Tests cover:
- Crosshair modes and positioning
- Tooltip data generation
- Magnet mode snapping
- Rendering determinism
"""

import pytest

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.charting.crosshair import (
    Crosshair,
    CrosshairMode,
    CrosshairState,
    CrosshairStyle,
    CrosshairManager,
    Tooltip,
    TooltipPosition,
    TooltipStyle,
    TooltipItem,
    TooltipData,
)
from services.charting.chart_wrapper import ChartWrapper, Bar, Series
from services.charting.primitives import Color, Colors, CommandBuffer


@pytest.fixture
def chart_with_bars():
    """Create chart with sample bars."""
    chart = ChartWrapper(chart_id="test-chart")
    bars = [
        Bar(i, i * 60000, 100 + i, 105 + i, 98 + i, 102 + i, 1000)
        for i in range(20)
    ]
    chart.set_bars(bars)
    return chart


class TestCrosshairStyle:
    """Tests for CrosshairStyle."""
    
    def test_defaults(self):
        """Should have sensible defaults."""
        style = CrosshairStyle()
        
        assert style.line_width == 1.0
        assert style.dash_pattern == (4.0, 4.0)
        assert style.label_font_size == 11
    
    def test_custom_colors(self):
        """Should accept custom colors."""
        style = CrosshairStyle(
            horizontal_color=Colors.WHITE,
            vertical_color=Colors.WHITE,
        )
        
        assert style.horizontal_color == Colors.WHITE


class TestCrosshairState:
    """Tests for CrosshairState."""
    
    def test_defaults(self):
        """Should have sensible defaults."""
        state = CrosshairState()
        
        assert state.mode == CrosshairMode.NORMAL
        assert state.visible is False
        assert state.show_labels is True


class TestCrosshair:
    """Tests for Crosshair."""
    
    def test_creation(self, chart_with_bars):
        """Should create crosshair."""
        crosshair = Crosshair(chart_with_bars)
        
        assert crosshair.chart == chart_with_bars
        assert crosshair.state.visible is False
    
    def test_set_position(self, chart_with_bars):
        """Should set position."""
        crosshair = Crosshair(chart_with_bars)
        
        crosshair.set_position(500, 300)
        
        assert crosshair.state.x == 500
        assert crosshair.state.y == 300
        assert crosshair.state.visible is True
    
    def test_hide(self, chart_with_bars):
        """Should hide crosshair."""
        crosshair = Crosshair(chart_with_bars)
        crosshair.set_position(500, 300)
        
        crosshair.hide()
        
        assert crosshair.state.visible is False
    
    def test_set_mode(self, chart_with_bars):
        """Should set mode."""
        crosshair = Crosshair(chart_with_bars)
        
        crosshair.set_mode(CrosshairMode.MAGNET)
        
        assert crosshair.state.mode == CrosshairMode.MAGNET
    
    def test_on_change_callback(self, chart_with_bars):
        """Should notify on state change."""
        crosshair = Crosshair(chart_with_bars)
        
        called = []
        crosshair.on_change(lambda s: called.append(s))
        
        crosshair.set_position(500, 300)
        
        assert len(called) == 1
        assert called[0].x == 500
    
    def test_updates_price_label(self, chart_with_bars):
        """Should update price label."""
        crosshair = Crosshair(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        # Position in chart area
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        crosshair.set_position(x, y)
        
        assert crosshair.state.price_label != ""
    
    def test_updates_time_label(self, chart_with_bars):
        """Should update time label."""
        crosshair = Crosshair(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        crosshair.set_position(x, y)
        
        assert crosshair.state.time_label != ""
    
    def test_render_disabled(self, chart_with_bars):
        """Should not render when disabled."""
        crosshair = Crosshair(chart_with_bars)
        crosshair.set_mode(CrosshairMode.DISABLED)
        crosshair.set_position(500, 300)
        
        buf = CommandBuffer()
        crosshair.render(buf)
        
        assert len(buf._commands) == 0
    
    def test_render_not_visible(self, chart_with_bars):
        """Should not render when not visible."""
        crosshair = Crosshair(chart_with_bars)
        
        buf = CommandBuffer()
        crosshair.render(buf)
        
        assert len(buf._commands) == 0
    
    def test_render_normal_mode(self, chart_with_bars):
        """Should render in normal mode."""
        crosshair = Crosshair(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        crosshair.set_position(x, y)
        
        buf = CommandBuffer()
        crosshair.render(buf)
        
        # Should have line commands
        assert len(buf) > 0
    
    def test_render_horizontal_only(self, chart_with_bars):
        """Should render only horizontal line."""
        crosshair = Crosshair(chart_with_bars)
        crosshair.set_mode(CrosshairMode.HORIZONTAL)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        crosshair.set_position(x, y)
        
        buf = CommandBuffer()
        crosshair.render(buf)
        
        line_commands = [c for c in buf._dict_commands if c.get("type") == "line"]
        # Should have horizontal line only (no vertical)
        assert len(line_commands) == 1
    
    def test_render_vertical_only(self, chart_with_bars):
        """Should render only vertical line."""
        crosshair = Crosshair(chart_with_bars)
        crosshair.set_mode(CrosshairMode.VERTICAL)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        crosshair.set_position(x, y)
        crosshair.state.show_labels = False  # Disable labels for simpler test
        
        buf = CommandBuffer()
        crosshair.render(buf)
        
        line_commands = [c for c in buf._dict_commands if c.get("type") == "line"]
        assert len(line_commands) == 1


class TestMagnetMode:
    """Tests for MAGNET crosshair mode."""
    
    def test_snaps_to_ohlc(self, chart_with_bars):
        """Should snap to nearest OHLC value."""
        crosshair = Crosshair(chart_with_bars)
        crosshair.set_mode(CrosshairMode.MAGNET)
        
        chart_area = chart_with_bars.layout.chart_area
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        crosshair.set_position(x, y)
        
        # Should have snapped price
        assert crosshair.state.snapped_price is not None
    
    def test_renders_snap_circle(self, chart_with_bars):
        """Should render snap circle."""
        crosshair = Crosshair(chart_with_bars)
        crosshair.set_mode(CrosshairMode.MAGNET)
        
        chart_area = chart_with_bars.layout.chart_area
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        crosshair.set_position(x, y)
        
        buf = CommandBuffer()
        crosshair.render(buf)
        
        circle_commands = [c for c in buf._dict_commands if c.get("type") == "circle"]
        assert len(circle_commands) == 1


class TestTooltipStyle:
    """Tests for TooltipStyle."""
    
    def test_defaults(self):
        """Should have sensible defaults."""
        style = TooltipStyle()
        
        assert style.padding == 8
        assert style.max_width == 250


class TestTooltipItem:
    """Tests for TooltipItem."""
    
    def test_creation(self):
        """Should create item."""
        item = TooltipItem("Open", "100.00")
        
        assert item.label == "Open"
        assert item.value == "100.00"
        assert item.color is None
    
    def test_with_color(self):
        """Should accept color."""
        item = TooltipItem("Close", "105.00", Colors.BULL_GREEN)
        
        assert item.color == Colors.BULL_GREEN


class TestTooltip:
    """Tests for Tooltip."""
    
    def test_creation(self, chart_with_bars):
        """Should create tooltip."""
        tooltip = Tooltip(chart_with_bars)
        
        assert tooltip.chart == chart_with_bars
        assert tooltip.position_mode == TooltipPosition.FOLLOW_CURSOR
    
    def test_show_builds_data(self, chart_with_bars):
        """Should build data on show."""
        tooltip = Tooltip(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        tooltip.show(x, y)
        
        assert tooltip.data.visible is True
        assert tooltip.data.title != ""
        assert len(tooltip.data.items) >= 4  # OHLC items
    
    def test_show_includes_ohlc(self, chart_with_bars):
        """Should include OHLC values."""
        tooltip = Tooltip(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        tooltip.show(x, y)
        
        labels = [item.label for item in tooltip.data.items]
        assert "O" in labels
        assert "H" in labels
        assert "L" in labels
        assert "C" in labels
    
    def test_show_includes_volume(self, chart_with_bars):
        """Should include volume when available."""
        tooltip = Tooltip(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        tooltip.show(x, y)
        
        labels = [item.label for item in tooltip.data.items]
        assert "Vol" in labels
    
    def test_show_includes_series(self, chart_with_bars):
        """Should include series values."""
        series = Series(
            name="SMA",
            values=[(i, 100 + i) for i in range(20)],
            color=Colors.BULL_GREEN,
        )
        chart_with_bars.add_series(series)
        
        tooltip = Tooltip(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        tooltip.show(x, y)
        
        labels = [item.label for item in tooltip.data.items]
        assert "SMA" in labels
    
    def test_hide(self, chart_with_bars):
        """Should hide tooltip."""
        tooltip = Tooltip(chart_with_bars)
        tooltip.show(500, 300)
        
        tooltip.hide()
        
        assert tooltip.data.visible is False
    
    def test_position_follow_cursor(self, chart_with_bars):
        """Should follow cursor."""
        tooltip = Tooltip(chart_with_bars, position_mode=TooltipPosition.FOLLOW_CURSOR)
        
        tooltip.show(500, 300)
        
        # Position should be near cursor
        assert tooltip.data.position.x > 500 - 20
        assert tooltip.data.position.x < 500 + 300
    
    def test_position_top_left(self, chart_with_bars):
        """Should position top-left."""
        tooltip = Tooltip(chart_with_bars, position_mode=TooltipPosition.TOP_LEFT)
        
        tooltip.show(500, 300)
        
        # Position should be near top-left
        layout = chart_with_bars.layout
        assert tooltip.data.position.x < layout.width / 2
        assert tooltip.data.position.y < layout.height / 2
    
    def test_position_top_right(self, chart_with_bars):
        """Should position top-right."""
        tooltip = Tooltip(chart_with_bars, position_mode=TooltipPosition.TOP_RIGHT)
        
        tooltip.show(500, 300)
        
        # Position should be near top-right
        layout = chart_with_bars.layout
        assert tooltip.data.position.x > layout.width / 2
        assert tooltip.data.position.y < layout.height / 2
    
    def test_render_not_visible(self, chart_with_bars):
        """Should not render when not visible."""
        tooltip = Tooltip(chart_with_bars)
        
        buf = CommandBuffer()
        tooltip.render(buf)
        
        assert len(buf._commands) == 0
    
    def test_render_visible(self, chart_with_bars):
        """Should render when visible."""
        tooltip = Tooltip(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        tooltip.show(x, y)
        
        buf = CommandBuffer()
        tooltip.render(buf)
        
        # Should have background and text commands
        assert len(buf) > 0


class TestCrosshairManager:
    """Tests for CrosshairManager."""
    
    def test_creation(self, chart_with_bars):
        """Should create manager."""
        manager = CrosshairManager(chart_with_bars)
        
        assert manager.crosshair is not None
        assert manager.tooltip is not None
    
    def test_update_both(self, chart_with_bars):
        """Should update both crosshair and tooltip."""
        manager = CrosshairManager(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        
        manager.update(x, y)
        
        assert manager.crosshair.state.visible is True
        assert manager.tooltip.data.visible is True
    
    def test_hide_both(self, chart_with_bars):
        """Should hide both."""
        manager = CrosshairManager(chart_with_bars)
        manager.update(500, 300)
        
        manager.hide()
        
        assert manager.crosshair.state.visible is False
        assert manager.tooltip.data.visible is False
    
    def test_disable(self, chart_with_bars):
        """Should disable both."""
        manager = CrosshairManager(chart_with_bars)
        
        manager.disable()
        manager.update(500, 300)
        
        assert manager.crosshair.state.visible is False
    
    def test_enable(self, chart_with_bars):
        """Should enable after disable."""
        manager = CrosshairManager(chart_with_bars)
        manager.disable()
        
        manager.enable()
        manager.update(500, 300)
        
        assert manager.crosshair.state.visible is True
    
    def test_set_crosshair_mode(self, chart_with_bars):
        """Should set crosshair mode."""
        manager = CrosshairManager(chart_with_bars)
        
        manager.set_crosshair_mode(CrosshairMode.MAGNET)
        
        assert manager.crosshair.state.mode == CrosshairMode.MAGNET
    
    def test_set_tooltip_position(self, chart_with_bars):
        """Should set tooltip position."""
        manager = CrosshairManager(chart_with_bars)
        
        manager.set_tooltip_position(TooltipPosition.TOP_LEFT)
        
        assert manager.tooltip.position_mode == TooltipPosition.TOP_LEFT
    
    def test_render(self, chart_with_bars):
        """Should render both."""
        manager = CrosshairManager(chart_with_bars)
        chart_area = chart_with_bars.layout.chart_area
        
        x = chart_area.x + chart_area.width / 2
        y = chart_area.y + chart_area.height / 2
        manager.update(x, y)
        
        buf = CommandBuffer()
        manager.render(buf)
        
        assert len(buf) > 0
    
    def test_get_state(self, chart_with_bars):
        """Should get crosshair state."""
        manager = CrosshairManager(chart_with_bars)
        
        state = manager.get_state()
        
        assert isinstance(state, CrosshairState)
    
    def test_get_tooltip_data(self, chart_with_bars):
        """Should get tooltip data."""
        manager = CrosshairManager(chart_with_bars)
        
        data = manager.get_tooltip_data()
        
        assert isinstance(data, TooltipData)


class TestFormatting:
    """Tests for value formatting."""
    
    def test_format_price_large(self, chart_with_bars):
        """Should format large prices with commas."""
        crosshair = Crosshair(chart_with_bars)
        
        result = crosshair._format_price(12345.67)
        
        assert result == "12,345.67"
    
    def test_format_price_small(self, chart_with_bars):
        """Should format small prices with decimals."""
        crosshair = Crosshair(chart_with_bars)
        
        result = crosshair._format_price(0.000123)
        
        assert result == "0.000123"
    
    def test_format_volume_millions(self, chart_with_bars):
        """Should format millions volume."""
        tooltip = Tooltip(chart_with_bars)
        
        result = tooltip._format_volume(1_500_000)
        
        assert "M" in result
    
    def test_format_volume_billions(self, chart_with_bars):
        """Should format billions volume."""
        tooltip = Tooltip(chart_with_bars)
        
        result = tooltip._format_volume(2_500_000_000)
        
        assert "B" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
