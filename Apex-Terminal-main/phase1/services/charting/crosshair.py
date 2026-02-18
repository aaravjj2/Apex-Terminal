"""
Crosshair & Tooltip Module.

Implements deterministic crosshair rendering and tooltips
for chart interaction with pixel-accurate positioning.
"""

from dataclasses import dataclass, field
from typing import Optional, Callable, List, Tuple
from enum import Enum, auto

from .primitives import Point, Rect, Color, Colors, LineStyle, CommandBuffer
from .chart_wrapper import ChartWrapper, Bar, Series


class CrosshairMode(Enum):
    """Crosshair display mode."""
    
    DISABLED = auto()
    NORMAL = auto()      # Full crosshair
    MAGNET = auto()      # Snaps to OHLC values
    HORIZONTAL = auto()  # Only horizontal line
    VERTICAL = auto()    # Only vertical line


class TooltipPosition(Enum):
    """Tooltip positioning mode."""
    
    FOLLOW_CURSOR = auto()  # Follows mouse
    TOP_LEFT = auto()       # Fixed top-left corner
    TOP_RIGHT = auto()      # Fixed top-right corner
    LEGEND = auto()         # In legend area


@dataclass
class CrosshairStyle:
    """Crosshair visual style."""
    
    # Line colors
    horizontal_color: Color = field(default_factory=lambda: Colors.CROSSHAIR_GRAY)
    vertical_color: Color = field(default_factory=lambda: Colors.CROSSHAIR_GRAY)
    
    # Line properties
    line_width: float = 1.0
    dash_pattern: Optional[Tuple[float, float]] = (4.0, 4.0)  # dash, gap
    
    # Label styling
    label_background: Color = field(default_factory=lambda: Color(42, 46, 57, 255))
    label_text: Color = field(default_factory=lambda: Colors.TEXT_WHITE)
    label_font_size: int = 11
    label_padding: int = 4
    
    # Snap circle (for MAGNET mode)
    snap_radius: float = 4.0
    snap_color: Color = field(default_factory=lambda: Colors.WHITE)


@dataclass
class TooltipStyle:
    """Tooltip visual style."""
    
    background: Color = field(default_factory=lambda: Color(30, 34, 45, 230))
    border_color: Color = field(default_factory=lambda: Color(60, 64, 75, 255))
    border_width: float = 1.0
    border_radius: float = 4.0
    
    text_color: Color = field(default_factory=lambda: Colors.TEXT_WHITE)
    label_color: Color = field(default_factory=lambda: Color(150, 150, 150, 255))
    font_size: int = 12
    line_height: int = 18
    
    padding: int = 8
    max_width: int = 250
    
    # Value colors
    bullish_color: Color = field(default_factory=lambda: Colors.BULL_GREEN)
    bearish_color: Color = field(default_factory=lambda: Colors.BEAR_RED)


@dataclass
class TooltipItem:
    """Single item in tooltip."""
    
    label: str
    value: str
    color: Optional[Color] = None


@dataclass
class TooltipData:
    """Complete tooltip data."""
    
    title: str
    items: List[TooltipItem] = field(default_factory=list)
    position: Point = field(default_factory=lambda: Point(0, 0))
    visible: bool = True


@dataclass
class CrosshairState:
    """Crosshair state for rendering."""
    
    # Position
    x: float = 0.0
    y: float = 0.0
    
    # Mode
    mode: CrosshairMode = CrosshairMode.NORMAL
    
    # Visibility
    visible: bool = False
    show_labels: bool = True
    
    # Snapped values (for MAGNET mode)
    snapped_price: Optional[float] = None
    snapped_bar_index: Optional[int] = None
    
    # Label values (formatted strings)
    price_label: str = ""
    time_label: str = ""


class Crosshair:
    """
    Deterministic crosshair rendering.
    
    Renders crosshair lines and labels with pixel-accurate
    positioning. Supports magnet mode for snapping to OHLC values.
    """
    
    def __init__(
        self,
        chart: ChartWrapper,
        style: Optional[CrosshairStyle] = None,
    ):
        self.chart = chart
        self.style = style or CrosshairStyle()
        self.state = CrosshairState()
        self._listeners: List[Callable[[CrosshairState], None]] = []
    
    def set_position(self, x: float, y: float) -> None:
        """
        Set crosshair position.
        
        Args:
            x: Screen X coordinate
            y: Screen Y coordinate
        """
        self.state.x = x
        self.state.y = y
        self.state.visible = True
        
        # Update labels
        self._update_labels()
        
        # Notify listeners
        for listener in self._listeners:
            listener(self.state)
    
    def hide(self) -> None:
        """Hide crosshair."""
        self.state.visible = False
        
        for listener in self._listeners:
            listener(self.state)
    
    def set_mode(self, mode: CrosshairMode) -> None:
        """Set crosshair mode."""
        self.state.mode = mode
    
    def on_change(self, callback: Callable[[CrosshairState], None]) -> None:
        """Register state change callback."""
        self._listeners.append(callback)
    
    def _update_labels(self) -> None:
        """Update price and time labels based on position."""
        chart_area = self.chart.layout.chart_area
        
        # Get price at Y
        if chart_area.contains(Point(self.state.x, self.state.y)):
            price = self.chart.get_price_at_y(self.state.y)
            if price is not None:
                self.state.price_label = self._format_price(price)
                self.state.snapped_price = price
        
        # Get bar at X
        bar = self.chart.get_bar_at_x(self.state.x)
        if bar is not None:
            self.state.time_label = self._format_time(bar.timestamp_ms)
            self.state.snapped_bar_index = bar.bar_index
            
            # Magnet mode: snap to OHLC
            if self.state.mode == CrosshairMode.MAGNET:
                self._snap_to_bar(bar)
    
    def _snap_to_bar(self, bar: Bar) -> None:
        """Snap to nearest OHLC value."""
        chart_area = self.chart.layout.chart_area
        y = self.state.y
        
        # Get screen Y for each OHLC value
        ohlc = [bar.open, bar.high, bar.low, bar.close]
        best_price = bar.close
        best_dist = float('inf')
        
        for price in ohlc:
            price_y = self.chart._scale_engine.price_to_y(price)
            screen_y = chart_area.y + price_y
            dist = abs(screen_y - y)
            
            if dist < best_dist:
                best_dist = dist
                best_price = price
        
        self.state.snapped_price = best_price
        # Update Y to snapped position
        snapped_y = self.chart._scale_engine.price_to_y(best_price)
        self.state.y = chart_area.y + snapped_y
        self.state.price_label = self._format_price(best_price)
    
    def _format_price(self, price: float) -> str:
        """Format price for label."""
        if price >= 1000:
            return f"{price:,.2f}"
        elif price >= 1:
            return f"{price:.2f}"
        else:
            return f"{price:.6f}"
    
    def _format_time(self, timestamp_ms: int) -> str:
        """Format timestamp for label."""
        from datetime import datetime
        dt = datetime.utcfromtimestamp(timestamp_ms / 1000)
        return dt.strftime("%Y-%m-%d %H:%M")
    
    def render(self, command_buffer: CommandBuffer) -> None:
        """
        Render crosshair to command buffer.
        
        Args:
            command_buffer: Target command buffer
        """
        if not self.state.visible or self.state.mode == CrosshairMode.DISABLED:
            return
        
        chart_area = self.chart.layout.chart_area
        style = self.style
        
        # Render vertical line
        if self.state.mode in (CrosshairMode.NORMAL, CrosshairMode.VERTICAL, CrosshairMode.MAGNET):
            self._render_vertical_line(command_buffer, chart_area, style)
        
        # Render horizontal line
        if self.state.mode in (CrosshairMode.NORMAL, CrosshairMode.HORIZONTAL, CrosshairMode.MAGNET):
            self._render_horizontal_line(command_buffer, chart_area, style)
        
        # Render labels
        if self.state.show_labels:
            self._render_labels(command_buffer, chart_area, style)
        
        # Render snap circle in magnet mode
        if self.state.mode == CrosshairMode.MAGNET:
            self._render_snap_circle(command_buffer, style)
    
    def _render_vertical_line(
        self,
        buf: CommandBuffer,
        area: Rect,
        style: CrosshairStyle,
    ) -> None:
        """Render vertical crosshair line."""
        x = self.state.x
        
        if area.x <= x <= area.x + area.width:
            buf.add_command({
                "type": "line",
                "x1": x,
                "y1": area.y,
                "x2": x,
                "y2": area.y + area.height,
                "color": style.vertical_color.to_tuple(),
                "width": style.line_width,
                "dash": style.dash_pattern,
            })
    
    def _render_horizontal_line(
        self,
        buf: CommandBuffer,
        area: Rect,
        style: CrosshairStyle,
    ) -> None:
        """Render horizontal crosshair line."""
        y = self.state.y
        
        if area.y <= y <= area.y + area.height:
            buf.add_command({
                "type": "line",
                "x1": area.x,
                "y1": y,
                "x2": area.x + area.width,
                "y2": y,
                "color": style.horizontal_color.to_tuple(),
                "width": style.line_width,
                "dash": style.dash_pattern,
            })
    
    def _render_labels(
        self,
        buf: CommandBuffer,
        area: Rect,
        style: CrosshairStyle,
    ) -> None:
        """Render price and time labels."""
        # Price label (right side)
        if self.state.price_label:
            price_label_width = len(self.state.price_label) * 7 + style.label_padding * 2
            price_label_height = style.label_font_size + style.label_padding * 2
            
            label_x = area.x + area.width + 2
            label_y = self.state.y - price_label_height / 2
            
            # Background
            buf.add_command({
                "type": "rect",
                "x": label_x,
                "y": label_y,
                "width": price_label_width,
                "height": price_label_height,
                "color": style.label_background.to_tuple(),
                "filled": True,
            })
            
            # Text
            buf.add_command({
                "type": "text",
                "x": label_x + style.label_padding,
                "y": label_y + style.label_padding + style.label_font_size,
                "text": self.state.price_label,
                "color": style.label_text.to_tuple(),
                "font_size": style.label_font_size,
            })
        
        # Time label (bottom)
        if self.state.time_label:
            time_label_width = len(self.state.time_label) * 7 + style.label_padding * 2
            time_label_height = style.label_font_size + style.label_padding * 2
            
            label_x = self.state.x - time_label_width / 2
            label_y = area.y + area.height + 2
            
            # Background
            buf.add_command({
                "type": "rect",
                "x": label_x,
                "y": label_y,
                "width": time_label_width,
                "height": time_label_height,
                "color": style.label_background.to_tuple(),
                "filled": True,
            })
            
            # Text
            buf.add_command({
                "type": "text",
                "x": label_x + style.label_padding,
                "y": label_y + style.label_padding + style.label_font_size,
                "text": self.state.time_label,
                "color": style.label_text.to_tuple(),
                "font_size": style.label_font_size,
            })
    
    def _render_snap_circle(
        self,
        buf: CommandBuffer,
        style: CrosshairStyle,
    ) -> None:
        """Render snap indicator circle."""
        buf.add_command({
            "type": "circle",
            "x": self.state.x,
            "y": self.state.y,
            "radius": style.snap_radius,
            "color": style.snap_color.to_tuple(),
            "filled": False,
            "width": 1.5,
        })


class Tooltip:
    """
    Deterministic tooltip rendering.
    
    Displays bar information and indicator values
    at cursor position or fixed location.
    """
    
    def __init__(
        self,
        chart: ChartWrapper,
        style: Optional[TooltipStyle] = None,
        position_mode: TooltipPosition = TooltipPosition.FOLLOW_CURSOR,
    ):
        self.chart = chart
        self.style = style or TooltipStyle()
        self.position_mode = position_mode
        self.data = TooltipData(title="")
        self._visible = False
    
    def show(self, x: float, y: float) -> None:
        """
        Show tooltip at position.
        
        Args:
            x: Screen X coordinate
            y: Screen Y coordinate
        """
        self._visible = True
        
        # Get bar at position
        bar = self.chart.get_bar_at_x(x)
        if bar is None:
            self.data = TooltipData(title="", visible=False)
            return
        
        # Build tooltip data
        self._build_tooltip_data(bar, x, y)
    
    def hide(self) -> None:
        """Hide tooltip."""
        self._visible = False
        self.data.visible = False
    
    def _build_tooltip_data(self, bar: Bar, x: float, y: float) -> None:
        """Build tooltip data from bar."""
        from datetime import datetime
        
        dt = datetime.utcfromtimestamp(bar.timestamp_ms / 1000)
        title = dt.strftime("%Y-%m-%d %H:%M")
        
        items = [
            TooltipItem("O", self._format_price(bar.open)),
            TooltipItem("H", self._format_price(bar.high)),
            TooltipItem("L", self._format_price(bar.low)),
            TooltipItem(
                "C",
                self._format_price(bar.close),
                self.style.bullish_color if bar.is_bullish else self.style.bearish_color,
            ),
        ]
        
        if bar.volume > 0:
            items.append(TooltipItem("Vol", self._format_volume(bar.volume)))
        
        # Add series values
        for name, series in self.chart._series.items():
            value = series.get_value_at(bar.bar_index)
            if value is not None:
                items.append(TooltipItem(name, self._format_price(value), series.color))
        
        # Calculate position
        position = self._calculate_position(x, y)
        
        self.data = TooltipData(
            title=title,
            items=items,
            position=position,
            visible=True,
        )
    
    def _calculate_position(self, x: float, y: float) -> Point:
        """Calculate tooltip position based on mode."""
        layout = self.chart.layout
        style = self.style
        
        if self.position_mode == TooltipPosition.TOP_LEFT:
            return Point(layout.margin_left + 10, layout.margin_top + 10)
        
        elif self.position_mode == TooltipPosition.TOP_RIGHT:
            return Point(
                layout.width - layout.margin_right - style.max_width - 10,
                layout.margin_top + 10,
            )
        
        elif self.position_mode == TooltipPosition.LEGEND:
            return Point(layout.margin_left + 10, layout.margin_top + 10)
        
        else:  # FOLLOW_CURSOR
            # Offset from cursor
            offset_x = 15
            offset_y = 15
            
            pos_x = x + offset_x
            pos_y = y + offset_y
            
            # Keep on screen
            tooltip_height = self._estimate_height()
            tooltip_width = style.max_width
            
            if pos_x + tooltip_width > layout.width - layout.margin_right:
                pos_x = x - tooltip_width - offset_x
            
            if pos_y + tooltip_height > layout.height - layout.margin_bottom:
                pos_y = y - tooltip_height - offset_y
            
            return Point(pos_x, pos_y)
    
    def _estimate_height(self) -> float:
        """Estimate tooltip height."""
        style = self.style
        num_items = len(self.data.items) + 1  # +1 for title
        return num_items * style.line_height + style.padding * 2
    
    def _format_price(self, price: float) -> str:
        """Format price value."""
        if price >= 1000:
            return f"{price:,.2f}"
        elif price >= 1:
            return f"{price:.2f}"
        else:
            return f"{price:.6f}"
    
    def _format_volume(self, volume: float) -> str:
        """Format volume value."""
        if volume >= 1_000_000_000:
            return f"{volume / 1_000_000_000:.2f}B"
        elif volume >= 1_000_000:
            return f"{volume / 1_000_000:.2f}M"
        elif volume >= 1_000:
            return f"{volume / 1_000:.2f}K"
        else:
            return f"{volume:.0f}"
    
    def render(self, command_buffer: CommandBuffer) -> None:
        """
        Render tooltip to command buffer.
        
        Args:
            command_buffer: Target command buffer
        """
        if not self._visible or not self.data.visible:
            return
        
        style = self.style
        data = self.data
        
        # Calculate dimensions
        width = style.max_width
        height = self._estimate_height()
        x = data.position.x
        y = data.position.y
        
        # Background with border
        command_buffer.add_command({
            "type": "rounded_rect",
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "radius": style.border_radius,
            "fill_color": style.background.to_tuple(),
            "border_color": style.border_color.to_tuple(),
            "border_width": style.border_width,
        })
        
        # Title
        text_y = y + style.padding + style.font_size
        command_buffer.add_command({
            "type": "text",
            "x": x + style.padding,
            "y": text_y,
            "text": data.title,
            "color": style.text_color.to_tuple(),
            "font_size": style.font_size,
            "font_weight": "bold",
        })
        
        # Items
        for item in data.items:
            text_y += style.line_height
            
            # Label
            command_buffer.add_command({
                "type": "text",
                "x": x + style.padding,
                "y": text_y,
                "text": f"{item.label}:",
                "color": style.label_color.to_tuple(),
                "font_size": style.font_size,
            })
            
            # Value
            value_color = item.color or style.text_color
            command_buffer.add_command({
                "type": "text",
                "x": x + style.padding + 50,
                "y": text_y,
                "text": item.value,
                "color": value_color.to_tuple(),
                "font_size": style.font_size,
            })


class CrosshairManager:
    """
    Manages crosshair and tooltip together.
    
    Coordinates crosshair and tooltip updates for
    synchronized display.
    """
    
    def __init__(
        self,
        chart: ChartWrapper,
        crosshair_style: Optional[CrosshairStyle] = None,
        tooltip_style: Optional[TooltipStyle] = None,
        tooltip_position: TooltipPosition = TooltipPosition.FOLLOW_CURSOR,
    ):
        self.chart = chart
        self.crosshair = Crosshair(chart, crosshair_style)
        self.tooltip = Tooltip(chart, tooltip_style, tooltip_position)
        
        self._enabled = True
    
    def enable(self) -> None:
        """Enable crosshair and tooltip."""
        self._enabled = True
    
    def disable(self) -> None:
        """Disable crosshair and tooltip."""
        self._enabled = False
        self.crosshair.hide()
        self.tooltip.hide()
    
    def update(self, x: float, y: float) -> None:
        """
        Update crosshair and tooltip position.
        
        Args:
            x: Screen X coordinate
            y: Screen Y coordinate
        """
        if not self._enabled:
            return
        
        self.crosshair.set_position(x, y)
        self.tooltip.show(x, y)
    
    def hide(self) -> None:
        """Hide both crosshair and tooltip."""
        self.crosshair.hide()
        self.tooltip.hide()
    
    def set_crosshair_mode(self, mode: CrosshairMode) -> None:
        """Set crosshair mode."""
        self.crosshair.set_mode(mode)
    
    def set_tooltip_position(self, position: TooltipPosition) -> None:
        """Set tooltip position mode."""
        self.tooltip.position_mode = position
    
    def render(self, command_buffer: CommandBuffer) -> None:
        """
        Render crosshair and tooltip.
        
        Args:
            command_buffer: Target command buffer
        """
        if not self._enabled:
            return
        
        self.crosshair.render(command_buffer)
        self.tooltip.render(command_buffer)
    
    def get_state(self) -> CrosshairState:
        """Get crosshair state."""
        return self.crosshair.state
    
    def get_tooltip_data(self) -> TooltipData:
        """Get tooltip data."""
        return self.tooltip.data
