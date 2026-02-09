"""
Indicator Panels Module.

Implements deterministic indicator rendering in separate panels
below the main price chart (e.g., RSI, MACD, Volume).
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Callable, Tuple
from enum import Enum, auto
from uuid import uuid4

from .primitives import Point, Rect, Color, Colors, CommandBuffer
from .scale_engine import PriceScale, Viewport, ScaleEngine


class PanelType(Enum):
    """Types of indicator panels."""
    
    OVERLAY = auto()     # Overlay on main chart
    SEPARATE = auto()    # Separate panel below
    VOLUME = auto()      # Volume histogram


class IndicatorType(Enum):
    """Built-in indicator types."""
    
    SMA = auto()         # Simple Moving Average
    EMA = auto()         # Exponential Moving Average
    RSI = auto()         # Relative Strength Index
    MACD = auto()        # MACD
    BOLLINGER = auto()   # Bollinger Bands
    VOLUME = auto()      # Volume
    ATR = auto()         # Average True Range
    STOCHASTIC = auto()  # Stochastic
    CUSTOM = auto()      # Custom indicator


@dataclass
class IndicatorStyle:
    """Visual style for indicators."""
    
    line_color: Color = field(default_factory=lambda: Color(33, 150, 243))
    line_width: float = 1.5
    fill_color: Optional[Color] = None
    fill_opacity: float = 0.2
    
    # For multi-line indicators
    colors: List[Color] = field(default_factory=list)
    
    # Histogram style
    positive_color: Color = field(default_factory=lambda: Colors.BULL_GREEN)
    negative_color: Color = field(default_factory=lambda: Colors.BEAR_RED)
    
    # Reference lines
    show_zero_line: bool = False
    zero_line_color: Color = field(default_factory=lambda: Color(100, 100, 100))


@dataclass
class IndicatorValue:
    """Single indicator value at a bar."""
    
    bar_index: int
    values: Dict[str, float]  # name -> value mapping


@dataclass
class IndicatorData:
    """
    Complete indicator data series.
    
    Supports multiple output lines (e.g., MACD has signal, histogram).
    """
    
    indicator_id: str
    indicator_type: IndicatorType
    name: str
    output_names: List[str]  # e.g., ["main", "signal", "histogram"]
    values: List[IndicatorValue]
    min_value: float = 0.0
    max_value: float = 100.0
    
    def get_value(self, bar_index: int, output: str = "main") -> Optional[float]:
        """Get value at bar index for specific output."""
        for v in self.values:
            if v.bar_index == bar_index and output in v.values:
                return v.values[output]
        return None
    
    def get_range(self) -> Tuple[float, float]:
        """Get min/max values across all outputs."""
        if not self.values:
            return (self.min_value, self.max_value)
        
        all_values = []
        for v in self.values:
            all_values.extend(v.values.values())
        
        if not all_values:
            return (self.min_value, self.max_value)
        
        return (min(all_values), max(all_values))


@dataclass
class Panel:
    """
    Indicator panel configuration.
    
    Defines the layout and indicators for a panel.
    """
    
    panel_id: str
    panel_type: PanelType
    height: int = 150
    height_ratio: float = 0.0  # 0.0 = fixed height, >0 = ratio of available space
    
    indicators: List[IndicatorData] = field(default_factory=list)
    
    # Scale configuration
    auto_scale: bool = True
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    
    # Visual
    background_color: Color = field(default_factory=lambda: Color(22, 26, 37))
    border_color: Color = field(default_factory=lambda: Color(42, 46, 57))
    show_grid: bool = True
    grid_color: Color = field(default_factory=lambda: Color(42, 46, 57))
    
    def __post_init__(self):
        if not self.panel_id:
            self.panel_id = str(uuid4())
    
    def add_indicator(self, indicator: IndicatorData) -> None:
        """Add indicator to panel."""
        self.indicators.append(indicator)
    
    def remove_indicator(self, indicator_id: str) -> None:
        """Remove indicator by ID."""
        self.indicators = [i for i in self.indicators if i.indicator_id != indicator_id]
    
    def get_scale_range(self) -> Tuple[float, float]:
        """Get combined scale range for all indicators."""
        if not self.auto_scale:
            return (self.min_value or 0, self.max_value or 100)
        
        if not self.indicators:
            return (0, 100)
        
        all_min = float('inf')
        all_max = float('-inf')
        
        for ind in self.indicators:
            min_v, max_v = ind.get_range()
            all_min = min(all_min, min_v)
            all_max = max(all_max, max_v)
        
        # Add margin
        margin = (all_max - all_min) * 0.1
        return (all_min - margin, all_max + margin)


class PanelRenderer:
    """
    Renders indicator panels.
    
    Deterministic rendering with scale-aware positioning.
    """
    
    def __init__(self):
        pass
    
    def render(
        self,
        panel: Panel,
        area: Rect,
        time_scale: "TimeScale",
        command_buffer: CommandBuffer,
    ) -> None:
        """
        Render panel to command buffer.
        
        Args:
            panel: Panel configuration
            area: Panel area in screen coordinates
            time_scale: Time scale for X coordinate mapping
            command_buffer: Target command buffer
        """
        from .scale_engine import TimeScale
        
        # Background
        self._render_background(panel, area, command_buffer)
        
        # Grid
        if panel.show_grid:
            self._render_grid(panel, area, command_buffer)
        
        # Create panel scale
        min_v, max_v = panel.get_scale_range()
        price_scale = PriceScale(min_v, max_v, margin_top=0.05, margin_bottom=0.05)
        
        viewport = Viewport(
            x=area.x,
            y=area.y,
            width=area.width,
            height=area.height,
        )
        
        scale = ScaleEngine(viewport, price_scale, time_scale)
        
        # Render indicators
        for indicator in panel.indicators:
            self._render_indicator(indicator, area, scale, command_buffer)
    
    def _render_background(
        self,
        panel: Panel,
        area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render panel background."""
        buf.add_command({
            "type": "rect",
            "x": area.x,
            "y": area.y,
            "width": area.width,
            "height": area.height,
            "color": panel.background_color.to_tuple(),
            "filled": True,
        })
        
        # Top border
        buf.add_command({
            "type": "line",
            "x1": area.x,
            "y1": area.y,
            "x2": area.x + area.width,
            "y2": area.y,
            "color": panel.border_color.to_tuple(),
            "width": 1,
        })
    
    def _render_grid(
        self,
        panel: Panel,
        area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render horizontal grid lines."""
        num_lines = 4
        step = area.height / (num_lines + 1)
        
        for i in range(1, num_lines + 1):
            y = area.y + i * step
            buf.add_command({
                "type": "line",
                "x1": area.x,
                "y1": y,
                "x2": area.x + area.width,
                "y2": y,
                "color": panel.grid_color.to_tuple(),
                "width": 1,
                "dash": (2, 4),
            })
    
    def _render_indicator(
        self,
        indicator: IndicatorData,
        area: Rect,
        scale: ScaleEngine,
        buf: CommandBuffer,
    ) -> None:
        """Render single indicator."""
        if indicator.indicator_type == IndicatorType.VOLUME:
            self._render_volume(indicator, area, scale, buf)
        elif indicator.indicator_type == IndicatorType.MACD:
            self._render_macd(indicator, area, scale, buf)
        else:
            self._render_line(indicator, area, scale, buf)
    
    def _render_line(
        self,
        indicator: IndicatorData,
        area: Rect,
        scale: ScaleEngine,
        buf: CommandBuffer,
    ) -> None:
        """Render line-style indicator."""
        # Sort values by bar_index
        sorted_values = sorted(indicator.values, key=lambda v: v.bar_index)
        
        for output_idx, output_name in enumerate(indicator.output_names):
            # Collect points
            points = []
            for v in sorted_values:
                if output_name in v.values:
                    x = scale.bar_index_to_x(v.bar_index) + area.x
                    y = scale.price_to_y(v.values[output_name]) + area.y
                    points.append((x, y))
            
            if len(points) < 2:
                continue
            
            # Render line segments
            color = Colors.BULL_GREEN if output_idx == 0 else Colors.BEAR_RED
            for i in range(len(points) - 1):
                buf.add_command({
                    "type": "line",
                    "x1": points[i][0],
                    "y1": points[i][1],
                    "x2": points[i + 1][0],
                    "y2": points[i + 1][1],
                    "color": color.to_tuple(),
                    "width": 1.5,
                })
    
    def _render_volume(
        self,
        indicator: IndicatorData,
        area: Rect,
        scale: ScaleEngine,
        buf: CommandBuffer,
    ) -> None:
        """Render volume histogram."""
        bar_width = scale.get_bar_width() * 0.8
        
        for v in indicator.values:
            volume = v.values.get("main", 0)
            is_bullish = v.values.get("bullish", True)
            
            x = scale.bar_index_to_x(v.bar_index) + area.x - bar_width / 2
            bar_height = scale.price_to_y(0) - scale.price_to_y(volume)
            y = area.y + area.height - bar_height
            
            color = Colors.BULL_GREEN if is_bullish else Colors.BEAR_RED
            
            buf.add_command({
                "type": "rect",
                "x": x,
                "y": y,
                "width": bar_width,
                "height": bar_height,
                "color": color.to_tuple(),
                "filled": True,
            })
    
    def _render_macd(
        self,
        indicator: IndicatorData,
        area: Rect,
        scale: ScaleEngine,
        buf: CommandBuffer,
    ) -> None:
        """Render MACD with histogram."""
        # Histogram (bars)
        bar_width = scale.get_bar_width() * 0.6
        
        for v in indicator.values:
            histogram = v.values.get("histogram", 0)
            
            x = scale.bar_index_to_x(v.bar_index) + area.x - bar_width / 2
            zero_y = scale.price_to_y(0) + area.y
            value_y = scale.price_to_y(histogram) + area.y
            
            color = Colors.BULL_GREEN if histogram >= 0 else Colors.BEAR_RED
            height = abs(value_y - zero_y)
            y = min(zero_y, value_y)
            
            buf.add_command({
                "type": "rect",
                "x": x,
                "y": y,
                "width": bar_width,
                "height": height,
                "color": color.with_alpha(180).to_tuple(),
                "filled": True,
            })
        
        # MACD line
        self._render_single_line(
            indicator, "main", area, scale, buf,
            Color(33, 150, 243),  # Blue
        )
        
        # Signal line
        self._render_single_line(
            indicator, "signal", area, scale, buf,
            Color(255, 152, 0),  # Orange
        )
    
    def _render_single_line(
        self,
        indicator: IndicatorData,
        output_name: str,
        area: Rect,
        scale: ScaleEngine,
        buf: CommandBuffer,
        color: Color,
    ) -> None:
        """Render single line for an indicator output."""
        sorted_values = sorted(indicator.values, key=lambda v: v.bar_index)
        
        points = []
        for v in sorted_values:
            if output_name in v.values:
                x = scale.bar_index_to_x(v.bar_index) + area.x
                y = scale.price_to_y(v.values[output_name]) + area.y
                points.append((x, y))
        
        if len(points) < 2:
            return
        
        for i in range(len(points) - 1):
            buf.add_command({
                "type": "line",
                "x1": points[i][0],
                "y1": points[i][1],
                "x2": points[i + 1][0],
                "y2": points[i + 1][1],
                "color": color.to_tuple(),
                "width": 1.5,
            })


class PanelLayout:
    """
    Manages layout of multiple panels.
    
    Calculates panel positions and sizes.
    """
    
    def __init__(
        self,
        total_width: int,
        total_height: int,
        main_chart_ratio: float = 0.7,
    ):
        self.total_width = total_width
        self.total_height = total_height
        self.main_chart_ratio = main_chart_ratio
        self._panels: List[Panel] = []
    
    def add_panel(self, panel: Panel) -> None:
        """Add panel to layout."""
        self._panels.append(panel)
    
    def remove_panel(self, panel_id: str) -> None:
        """Remove panel by ID."""
        self._panels = [p for p in self._panels if p.panel_id != panel_id]
    
    def get_panels(self) -> List[Panel]:
        """Get all panels."""
        return self._panels.copy()
    
    def calculate_layout(self) -> Dict[str, Rect]:
        """
        Calculate panel areas.
        
        Returns mapping of panel_id to Rect.
        """
        result = {}
        
        # Calculate main chart height
        main_height = int(self.total_height * self.main_chart_ratio)
        
        # Calculate panel heights
        remaining_height = self.total_height - main_height
        fixed_height = sum(p.height for p in self._panels if p.height_ratio == 0)
        ratio_height = remaining_height - fixed_height
        ratio_total = sum(p.height_ratio for p in self._panels if p.height_ratio > 0)
        
        # Position panels
        y = main_height
        for panel in self._panels:
            if panel.height_ratio > 0 and ratio_total > 0:
                height = int(ratio_height * panel.height_ratio / ratio_total)
            else:
                height = panel.height
            
            result[panel.panel_id] = Rect(0, y, self.total_width, height)
            y += height
        
        return result
    
    def get_main_chart_area(self) -> Rect:
        """Get main chart area."""
        main_height = int(self.total_height * self.main_chart_ratio)
        return Rect(0, 0, self.total_width, main_height)


class PanelManager:
    """
    Manages indicator panels for a chart.
    
    Coordinates panel creation, layout, and rendering.
    """
    
    def __init__(self, width: int, height: int):
        self._layout = PanelLayout(width, height)
        self._renderer = PanelRenderer()
        self._listeners: List[Callable[[str, Panel], None]] = []
    
    def add_panel(
        self,
        panel_type: PanelType = PanelType.SEPARATE,
        height: int = 150,
    ) -> str:
        """Create and add a new panel."""
        panel = Panel(
            panel_id=str(uuid4()),
            panel_type=panel_type,
            height=height,
        )
        self._layout.add_panel(panel)
        self._notify("add", panel)
        return panel.panel_id
    
    def remove_panel(self, panel_id: str) -> None:
        """Remove a panel."""
        panels = [p for p in self._layout.get_panels() if p.panel_id == panel_id]
        if panels:
            self._layout.remove_panel(panel_id)
            self._notify("remove", panels[0])
    
    def get_panel(self, panel_id: str) -> Optional[Panel]:
        """Get panel by ID."""
        for panel in self._layout.get_panels():
            if panel.panel_id == panel_id:
                return panel
        return None
    
    def add_indicator(
        self,
        panel_id: str,
        indicator: IndicatorData,
    ) -> bool:
        """Add indicator to a panel."""
        panel = self.get_panel(panel_id)
        if panel:
            panel.add_indicator(indicator)
            self._notify("indicator_add", panel)
            return True
        return False
    
    def remove_indicator(
        self,
        panel_id: str,
        indicator_id: str,
    ) -> bool:
        """Remove indicator from a panel."""
        panel = self.get_panel(panel_id)
        if panel:
            panel.remove_indicator(indicator_id)
            self._notify("indicator_remove", panel)
            return True
        return False
    
    def get_layout(self) -> Dict[str, Rect]:
        """Get current panel layout."""
        return self._layout.calculate_layout()
    
    def get_main_chart_area(self) -> Rect:
        """Get main chart area."""
        return self._layout.get_main_chart_area()
    
    def resize(self, width: int, height: int) -> None:
        """Resize panel layout."""
        self._layout.total_width = width
        self._layout.total_height = height
    
    def on_change(self, callback: Callable[[str, Panel], None]) -> None:
        """Register change listener."""
        self._listeners.append(callback)
    
    def _notify(self, event: str, panel: Panel) -> None:
        """Notify listeners."""
        for listener in self._listeners:
            listener(event, panel)
    
    def render(
        self,
        time_scale: "TimeScale",
        command_buffer: CommandBuffer,
    ) -> None:
        """Render all panels."""
        layout = self.get_layout()
        
        for panel in self._layout.get_panels():
            if panel.panel_id in layout:
                self._renderer.render(
                    panel,
                    layout[panel.panel_id],
                    time_scale,
                    command_buffer,
                )


# Helper functions

def create_rsi_indicator(
    values: List[Tuple[int, float]],
    period: int = 14,
) -> IndicatorData:
    """Create RSI indicator data."""
    indicator_values = [
        IndicatorValue(bar_index=v[0], values={"main": v[1]})
        for v in values
    ]
    
    return IndicatorData(
        indicator_id=str(uuid4()),
        indicator_type=IndicatorType.RSI,
        name=f"RSI({period})",
        output_names=["main"],
        values=indicator_values,
        min_value=0,
        max_value=100,
    )


def create_macd_indicator(
    values: List[Tuple[int, float, float, float]],  # bar, macd, signal, histogram
) -> IndicatorData:
    """Create MACD indicator data."""
    indicator_values = [
        IndicatorValue(
            bar_index=v[0],
            values={"main": v[1], "signal": v[2], "histogram": v[3]},
        )
        for v in values
    ]
    
    return IndicatorData(
        indicator_id=str(uuid4()),
        indicator_type=IndicatorType.MACD,
        name="MACD(12,26,9)",
        output_names=["main", "signal", "histogram"],
        values=indicator_values,
    )


def create_volume_indicator(
    values: List[Tuple[int, float, bool]],  # bar, volume, is_bullish
) -> IndicatorData:
    """Create volume indicator data."""
    indicator_values = [
        IndicatorValue(
            bar_index=v[0],
            values={"main": v[1], "bullish": 1.0 if v[2] else 0.0},
        )
        for v in values
    ]
    
    return IndicatorData(
        indicator_id=str(uuid4()),
        indicator_type=IndicatorType.VOLUME,
        name="Volume",
        output_names=["main"],
        values=indicator_values,
        min_value=0,
    )
