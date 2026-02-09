"""
Tests for Indicator Panels Module.

Tests panel layout, indicator rendering, and panel management.
"""

import pytest
from uuid import uuid4

from services.charting.indicators import (
    PanelType,
    IndicatorType,
    IndicatorStyle,
    IndicatorValue,
    IndicatorData,
    Panel,
    PanelRenderer,
    PanelLayout,
    PanelManager,
    create_rsi_indicator,
    create_macd_indicator,
    create_volume_indicator,
)
from services.charting.primitives import Color, Colors, Rect, CommandBuffer
from services.charting.scale_engine import TimeScale


# ============================================================================
# IndicatorStyle Tests
# ============================================================================

class TestIndicatorStyle:
    """Tests for IndicatorStyle class."""
    
    def test_default_style(self):
        """Test default style values."""
        style = IndicatorStyle()
        
        assert style.line_color == Color(33, 150, 243)
        assert style.line_width == 1.5
        assert style.fill_color is None
        assert style.fill_opacity == 0.2
    
    def test_custom_style(self):
        """Test custom style values."""
        style = IndicatorStyle(
            line_color=Color(255, 0, 0),
            line_width=2.0,
            fill_color=Color(255, 0, 0),
            fill_opacity=0.5,
        )
        
        assert style.line_color == Color(255, 0, 0)
        assert style.line_width == 2.0
        assert style.fill_color == Color(255, 0, 0)
        assert style.fill_opacity == 0.5
    
    def test_histogram_colors(self):
        """Test histogram color defaults."""
        style = IndicatorStyle()
        
        assert style.positive_color == Colors.BULL_GREEN
        assert style.negative_color == Colors.BEAR_RED
    
    def test_zero_line_config(self):
        """Test zero line configuration."""
        style = IndicatorStyle(show_zero_line=True)
        
        assert style.show_zero_line is True
        assert style.zero_line_color == Color(100, 100, 100)


# ============================================================================
# IndicatorValue Tests
# ============================================================================

class TestIndicatorValue:
    """Tests for IndicatorValue class."""
    
    def test_single_value(self):
        """Test single value indicator."""
        value = IndicatorValue(bar_index=10, values={"main": 50.0})
        
        assert value.bar_index == 10
        assert value.values["main"] == 50.0
    
    def test_multiple_values(self):
        """Test multi-output indicator value."""
        value = IndicatorValue(
            bar_index=10,
            values={"main": 0.5, "signal": 0.3, "histogram": 0.2},
        )
        
        assert value.values["main"] == 0.5
        assert value.values["signal"] == 0.3
        assert value.values["histogram"] == 0.2


# ============================================================================
# IndicatorData Tests
# ============================================================================

class TestIndicatorData:
    """Tests for IndicatorData class."""
    
    def test_create_indicator(self):
        """Test creating indicator data."""
        data = IndicatorData(
            indicator_id="test-1",
            indicator_type=IndicatorType.RSI,
            name="RSI(14)",
            output_names=["main"],
            values=[],
            min_value=0,
            max_value=100,
        )
        
        assert data.indicator_id == "test-1"
        assert data.indicator_type == IndicatorType.RSI
        assert data.name == "RSI(14)"
        assert data.min_value == 0
        assert data.max_value == 100
    
    def test_get_value(self):
        """Test getting value at bar index."""
        values = [
            IndicatorValue(bar_index=0, values={"main": 30}),
            IndicatorValue(bar_index=1, values={"main": 50}),
            IndicatorValue(bar_index=2, values={"main": 70}),
        ]
        
        data = IndicatorData(
            indicator_id="test",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=values,
        )
        
        assert data.get_value(0) == 30
        assert data.get_value(1) == 50
        assert data.get_value(2) == 70
        assert data.get_value(99) is None
    
    def test_get_value_specific_output(self):
        """Test getting value for specific output."""
        values = [
            IndicatorValue(
                bar_index=0,
                values={"main": 10, "signal": 5, "histogram": 5},
            ),
        ]
        
        data = IndicatorData(
            indicator_id="test",
            indicator_type=IndicatorType.MACD,
            name="MACD",
            output_names=["main", "signal", "histogram"],
            values=values,
        )
        
        assert data.get_value(0, "main") == 10
        assert data.get_value(0, "signal") == 5
        assert data.get_value(0, "histogram") == 5
    
    def test_get_range(self):
        """Test computing value range."""
        values = [
            IndicatorValue(bar_index=0, values={"main": 30}),
            IndicatorValue(bar_index=1, values={"main": 50}),
            IndicatorValue(bar_index=2, values={"main": 70}),
        ]
        
        data = IndicatorData(
            indicator_id="test",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=values,
        )
        
        min_v, max_v = data.get_range()
        assert min_v == 30
        assert max_v == 70
    
    def test_get_range_empty(self):
        """Test range with empty values."""
        data = IndicatorData(
            indicator_id="test",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=[],
            min_value=0,
            max_value=100,
        )
        
        min_v, max_v = data.get_range()
        assert min_v == 0
        assert max_v == 100


# ============================================================================
# Panel Tests
# ============================================================================

class TestPanel:
    """Tests for Panel class."""
    
    def test_create_panel(self):
        """Test creating panel."""
        panel = Panel(
            panel_id="panel-1",
            panel_type=PanelType.SEPARATE,
            height=150,
        )
        
        assert panel.panel_id == "panel-1"
        assert panel.panel_type == PanelType.SEPARATE
        assert panel.height == 150
        assert panel.auto_scale is True
    
    def test_auto_generate_id(self):
        """Test auto-generating panel ID."""
        panel = Panel(
            panel_id="",
            panel_type=PanelType.SEPARATE,
        )
        
        assert panel.panel_id != ""
    
    def test_add_indicator(self):
        """Test adding indicator to panel."""
        panel = Panel(panel_id="p1", panel_type=PanelType.SEPARATE)
        indicator = IndicatorData(
            indicator_id="i1",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=[],
        )
        
        panel.add_indicator(indicator)
        
        assert len(panel.indicators) == 1
        assert panel.indicators[0].indicator_id == "i1"
    
    def test_remove_indicator(self):
        """Test removing indicator from panel."""
        panel = Panel(panel_id="p1", panel_type=PanelType.SEPARATE)
        indicator = IndicatorData(
            indicator_id="i1",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=[],
        )
        
        panel.add_indicator(indicator)
        panel.remove_indicator("i1")
        
        assert len(panel.indicators) == 0
    
    def test_get_scale_range_auto(self):
        """Test auto scale range calculation."""
        panel = Panel(panel_id="p1", panel_type=PanelType.SEPARATE)
        
        values = [
            IndicatorValue(bar_index=0, values={"main": 30}),
            IndicatorValue(bar_index=1, values={"main": 70}),
        ]
        indicator = IndicatorData(
            indicator_id="i1",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=values,
        )
        
        panel.add_indicator(indicator)
        min_v, max_v = panel.get_scale_range()
        
        # Should have margin
        assert min_v < 30
        assert max_v > 70
    
    def test_get_scale_range_manual(self):
        """Test manual scale range."""
        panel = Panel(
            panel_id="p1",
            panel_type=PanelType.SEPARATE,
            auto_scale=False,
            min_value=0,
            max_value=100,
        )
        
        min_v, max_v = panel.get_scale_range()
        assert min_v == 0
        assert max_v == 100


# ============================================================================
# PanelLayout Tests
# ============================================================================

class TestPanelLayout:
    """Tests for PanelLayout class."""
    
    def test_create_layout(self):
        """Test creating layout."""
        layout = PanelLayout(1280, 800)
        
        assert layout.total_width == 1280
        assert layout.total_height == 800
        assert layout.main_chart_ratio == 0.7
    
    def test_main_chart_area(self):
        """Test main chart area calculation."""
        layout = PanelLayout(1280, 800, main_chart_ratio=0.7)
        
        area = layout.get_main_chart_area()
        
        assert area.x == 0
        assert area.y == 0
        assert area.width == 1280
        assert area.height == 560  # 800 * 0.7
    
    def test_single_panel_layout(self):
        """Test layout with single panel."""
        layout = PanelLayout(1280, 800, main_chart_ratio=0.7)
        panel = Panel(panel_id="p1", panel_type=PanelType.SEPARATE, height=150)
        
        layout.add_panel(panel)
        areas = layout.calculate_layout()
        
        assert "p1" in areas
        assert areas["p1"].y == 560  # After main chart
        assert areas["p1"].height == 150
    
    def test_multiple_panels_layout(self):
        """Test layout with multiple panels."""
        layout = PanelLayout(1280, 800, main_chart_ratio=0.7)
        
        panel1 = Panel(panel_id="p1", panel_type=PanelType.SEPARATE, height=100)
        panel2 = Panel(panel_id="p2", panel_type=PanelType.SEPARATE, height=100)
        
        layout.add_panel(panel1)
        layout.add_panel(panel2)
        
        areas = layout.calculate_layout()
        
        assert areas["p1"].y == 560
        assert areas["p2"].y == 660
    
    def test_remove_panel(self):
        """Test removing panel from layout."""
        layout = PanelLayout(1280, 800)
        panel = Panel(panel_id="p1", panel_type=PanelType.SEPARATE)
        
        layout.add_panel(panel)
        layout.remove_panel("p1")
        
        areas = layout.calculate_layout()
        assert "p1" not in areas
    
    def test_ratio_height_panels(self):
        """Test panels with height ratios."""
        layout = PanelLayout(1280, 800, main_chart_ratio=0.5)
        
        # Main chart takes 400px, leaving 400px for panels
        panel1 = Panel(
            panel_id="p1",
            panel_type=PanelType.SEPARATE,
            height_ratio=0.5,
        )
        panel2 = Panel(
            panel_id="p2",
            panel_type=PanelType.SEPARATE,
            height_ratio=0.5,
        )
        
        layout.add_panel(panel1)
        layout.add_panel(panel2)
        
        areas = layout.calculate_layout()
        
        # Should split remaining space
        assert areas["p1"].height == areas["p2"].height


# ============================================================================
# PanelRenderer Tests
# ============================================================================

class TestPanelRenderer:
    """Tests for PanelRenderer class."""
    
    def test_create_renderer(self):
        """Test creating renderer."""
        renderer = PanelRenderer()
        assert renderer is not None
    
    def test_render_empty_panel(self):
        """Test rendering empty panel."""
        renderer = PanelRenderer()
        panel = Panel(panel_id="p1", panel_type=PanelType.SEPARATE)
        area = Rect(0, 500, 1280, 150)
        time_scale = TimeScale(0, 100)
        buf = CommandBuffer()
        
        renderer.render(panel, area, time_scale, buf)
        
        # Should have background and border
        assert len(buf) >= 2
    
    def test_render_panel_with_indicator(self):
        """Test rendering panel with indicator."""
        renderer = PanelRenderer()
        panel = Panel(panel_id="p1", panel_type=PanelType.SEPARATE)
        
        values = [
            IndicatorValue(bar_index=i, values={"main": 50 + i})
            for i in range(10)
        ]
        indicator = IndicatorData(
            indicator_id="i1",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=values,
        )
        panel.add_indicator(indicator)
        
        area = Rect(0, 500, 1280, 150)
        time_scale = TimeScale(0, 100)
        buf = CommandBuffer()
        
        renderer.render(panel, area, time_scale, buf)
        
        # Should have background, grid, and line segments
        assert len(buf) > 5


# ============================================================================
# PanelManager Tests
# ============================================================================

class TestPanelManager:
    """Tests for PanelManager class."""
    
    def test_create_manager(self):
        """Test creating manager."""
        manager = PanelManager(1280, 800)
        assert manager is not None
    
    def test_add_panel(self):
        """Test adding panel."""
        manager = PanelManager(1280, 800)
        panel_id = manager.add_panel(PanelType.SEPARATE, height=150)
        
        assert panel_id is not None
        panel = manager.get_panel(panel_id)
        assert panel is not None
        assert panel.height == 150
    
    def test_remove_panel(self):
        """Test removing panel."""
        manager = PanelManager(1280, 800)
        panel_id = manager.add_panel()
        
        manager.remove_panel(panel_id)
        
        assert manager.get_panel(panel_id) is None
    
    def test_add_indicator_to_panel(self):
        """Test adding indicator to panel."""
        manager = PanelManager(1280, 800)
        panel_id = manager.add_panel()
        
        indicator = IndicatorData(
            indicator_id="i1",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=[],
        )
        
        result = manager.add_indicator(panel_id, indicator)
        
        assert result is True
        panel = manager.get_panel(panel_id)
        assert len(panel.indicators) == 1
    
    def test_remove_indicator_from_panel(self):
        """Test removing indicator from panel."""
        manager = PanelManager(1280, 800)
        panel_id = manager.add_panel()
        
        indicator = IndicatorData(
            indicator_id="i1",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=[],
        )
        
        manager.add_indicator(panel_id, indicator)
        result = manager.remove_indicator(panel_id, "i1")
        
        assert result is True
        panel = manager.get_panel(panel_id)
        assert len(panel.indicators) == 0
    
    def test_get_layout(self):
        """Test getting panel layout."""
        manager = PanelManager(1280, 800)
        panel_id = manager.add_panel()
        
        layout = manager.get_layout()
        
        assert panel_id in layout
    
    def test_get_main_chart_area(self):
        """Test getting main chart area."""
        manager = PanelManager(1280, 800)
        
        area = manager.get_main_chart_area()
        
        assert area.width == 1280
        assert area.height == 560  # 70%
    
    def test_resize(self):
        """Test resizing manager."""
        manager = PanelManager(1280, 800)
        manager.resize(1920, 1080)
        
        area = manager.get_main_chart_area()
        
        assert area.width == 1920
    
    def test_change_listener(self):
        """Test change listener."""
        manager = PanelManager(1280, 800)
        
        events = []
        manager.on_change(lambda e, p: events.append((e, p.panel_id)))
        
        panel_id = manager.add_panel()
        
        assert len(events) == 1
        assert events[0][0] == "add"
    
    def test_render_all_panels(self):
        """Test rendering all panels."""
        manager = PanelManager(1280, 800)
        panel_id = manager.add_panel()
        
        indicator = IndicatorData(
            indicator_id="i1",
            indicator_type=IndicatorType.RSI,
            name="RSI",
            output_names=["main"],
            values=[
                IndicatorValue(bar_index=i, values={"main": 50})
                for i in range(10)
            ],
        )
        manager.add_indicator(panel_id, indicator)
        
        time_scale = TimeScale(0, 100)
        buf = CommandBuffer()
        
        manager.render(time_scale, buf)
        
        assert len(buf) > 0


# ============================================================================
# Helper Function Tests
# ============================================================================

class TestHelperFunctions:
    """Tests for helper functions."""
    
    def test_create_rsi_indicator(self):
        """Test creating RSI indicator."""
        values = [(i, 50 + i) for i in range(10)]
        indicator = create_rsi_indicator(values, period=14)
        
        assert indicator.indicator_type == IndicatorType.RSI
        assert indicator.name == "RSI(14)"
        assert indicator.min_value == 0
        assert indicator.max_value == 100
        assert len(indicator.values) == 10
    
    def test_create_macd_indicator(self):
        """Test creating MACD indicator."""
        # bar, macd, signal, histogram
        values = [(i, 0.5, 0.3, 0.2) for i in range(10)]
        indicator = create_macd_indicator(values)
        
        assert indicator.indicator_type == IndicatorType.MACD
        assert indicator.name == "MACD(12,26,9)"
        assert "main" in indicator.output_names
        assert "signal" in indicator.output_names
        assert "histogram" in indicator.output_names
    
    def test_create_volume_indicator(self):
        """Test creating volume indicator."""
        # bar, volume, is_bullish
        values = [(i, 1000 + i * 100, i % 2 == 0) for i in range(10)]
        indicator = create_volume_indicator(values)
        
        assert indicator.indicator_type == IndicatorType.VOLUME
        assert indicator.name == "Volume"
        assert indicator.min_value == 0


# ============================================================================
# IndicatorType Tests
# ============================================================================

class TestIndicatorType:
    """Tests for IndicatorType enum."""
    
    def test_all_types_exist(self):
        """Test all indicator types exist."""
        assert IndicatorType.SMA is not None
        assert IndicatorType.EMA is not None
        assert IndicatorType.RSI is not None
        assert IndicatorType.MACD is not None
        assert IndicatorType.BOLLINGER is not None
        assert IndicatorType.VOLUME is not None
        assert IndicatorType.ATR is not None
        assert IndicatorType.STOCHASTIC is not None
        assert IndicatorType.CUSTOM is not None


# ============================================================================
# PanelType Tests
# ============================================================================

class TestPanelType:
    """Tests for PanelType enum."""
    
    def test_all_types_exist(self):
        """Test all panel types exist."""
        assert PanelType.OVERLAY is not None
        assert PanelType.SEPARATE is not None
        assert PanelType.VOLUME is not None
