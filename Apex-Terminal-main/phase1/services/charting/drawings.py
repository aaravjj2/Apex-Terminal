"""
Drawing Tools Module.

Implements deterministic drawing tools for chart annotation:
- Trend lines
- Horizontal/Vertical lines
- Fibonacci retracements
- Rectangles/Ellipses
- Text annotations
"""

from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Dict, Callable
from enum import Enum, auto
from uuid import uuid4
import math

from .primitives import Point, Rect, Color, Colors, LineStyle, FillStyle, CommandBuffer
from .chart_wrapper import ChartWrapper
from .scale_engine import ScaleEngine


class DrawingType(Enum):
    """Types of drawing tools."""
    
    TREND_LINE = auto()
    HORIZONTAL_LINE = auto()
    VERTICAL_LINE = auto()
    RAY = auto()
    EXTENDED_LINE = auto()
    FIBONACCI_RETRACEMENT = auto()
    FIBONACCI_EXTENSION = auto()
    RECTANGLE = auto()
    ELLIPSE = auto()
    TRIANGLE = auto()
    ARROW = auto()
    TEXT = auto()
    PRICE_LABEL = auto()
    PITCHFORK = auto()
    CHANNEL = auto()


class DrawingAnchor(Enum):
    """Anchor point types for drawings."""
    
    START = auto()
    END = auto()
    MIDDLE = auto()
    TOP_LEFT = auto()
    TOP_RIGHT = auto()
    BOTTOM_LEFT = auto()
    BOTTOM_RIGHT = auto()


@dataclass
class DrawingPoint:
    """
    Point anchored to chart coordinates.
    
    Uses bar_index and price for scale-independent positioning.
    """
    
    bar_index: float
    price: float
    
    def to_screen(self, scale: ScaleEngine, chart_area: Rect) -> Point:
        """Convert to screen coordinates."""
        x = scale.bar_index_to_x(self.bar_index) + chart_area.x
        y = scale.price_to_y(self.price) + chart_area.y
        return Point(x, y)
    
    @classmethod
    def from_screen(cls, point: Point, scale: ScaleEngine, chart_area: Rect) -> "DrawingPoint":
        """Create from screen coordinates."""
        bar_index = scale.x_to_bar_index(point.x - chart_area.x)
        price = scale.y_to_price(point.y - chart_area.y)
        return cls(bar_index, price)


@dataclass
class DrawingStyle:
    """Visual style for drawings."""
    
    line_color: Color = field(default_factory=lambda: Color(33, 150, 243))  # Blue
    line_width: float = 1.5
    line_dash: Optional[Tuple[float, float]] = None
    
    fill_color: Optional[Color] = None
    fill_opacity: float = 0.2
    
    text_color: Color = field(default_factory=lambda: Colors.TEXT_WHITE)
    font_size: int = 12
    
    show_labels: bool = True
    show_price_labels: bool = True
    extend_left: bool = False
    extend_right: bool = False


@dataclass
class Drawing:
    """
    Base class for all drawing objects.
    
    All drawings are anchored to chart coordinates (bar_index, price)
    and rendered to screen coordinates via the scale engine.
    """
    
    id: str
    drawing_type: DrawingType
    points: List[DrawingPoint]
    style: DrawingStyle
    visible: bool = True
    locked: bool = False
    
    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())
    
    def get_bounds(self) -> Tuple[float, float, float, float]:
        """Get bounding box in chart coordinates."""
        if not self.points:
            return (0, 0, 0, 0)
        
        min_bar = min(p.bar_index for p in self.points)
        max_bar = max(p.bar_index for p in self.points)
        min_price = min(p.price for p in self.points)
        max_price = max(p.price for p in self.points)
        
        return (min_bar, min_price, max_bar, max_price)
    
    def hit_test(self, point: DrawingPoint, tolerance: float = 0.5) -> Optional[DrawingAnchor]:
        """
        Test if a point hits this drawing.
        
        Returns the anchor point if hit, None otherwise.
        """
        # Check anchor points
        for i, p in enumerate(self.points):
            dist = math.sqrt((p.bar_index - point.bar_index) ** 2 + 
                           (p.price - point.price) ** 2)
            if dist < tolerance:
                if i == 0:
                    return DrawingAnchor.START
                elif i == len(self.points) - 1:
                    return DrawingAnchor.END
                else:
                    return DrawingAnchor.MIDDLE
        return None
    
    def move(self, delta_bar: float, delta_price: float) -> None:
        """Move all points by delta."""
        if self.locked:
            return
        for p in self.points:
            p.bar_index += delta_bar
            p.price += delta_price
    
    def move_anchor(self, anchor: DrawingAnchor, new_point: DrawingPoint) -> None:
        """Move specific anchor point."""
        if self.locked:
            return
        if anchor == DrawingAnchor.START and len(self.points) > 0:
            self.points[0] = new_point
        elif anchor == DrawingAnchor.END and len(self.points) > 1:
            self.points[-1] = new_point


class TrendLine(Drawing):
    """Trend line drawing."""
    
    def __init__(
        self,
        start: DrawingPoint,
        end: DrawingPoint,
        style: Optional[DrawingStyle] = None,
        drawing_id: Optional[str] = None,
    ):
        super().__init__(
            id=drawing_id or str(uuid4()),
            drawing_type=DrawingType.TREND_LINE,
            points=[start, end],
            style=style or DrawingStyle(),
        )
    
    @property
    def start(self) -> DrawingPoint:
        return self.points[0]
    
    @property
    def end(self) -> DrawingPoint:
        return self.points[1]
    
    def get_angle(self) -> float:
        """Get angle in degrees."""
        dx = self.end.bar_index - self.start.bar_index
        dy = self.end.price - self.start.price
        return math.degrees(math.atan2(dy, dx))
    
    def get_length(self) -> float:
        """Get length in chart coordinates."""
        dx = self.end.bar_index - self.start.bar_index
        dy = self.end.price - self.start.price
        return math.sqrt(dx * dx + dy * dy)


class HorizontalLine(Drawing):
    """Horizontal price line."""
    
    def __init__(
        self,
        price: float,
        style: Optional[DrawingStyle] = None,
        drawing_id: Optional[str] = None,
    ):
        # Use a single point with price
        super().__init__(
            id=drawing_id or str(uuid4()),
            drawing_type=DrawingType.HORIZONTAL_LINE,
            points=[DrawingPoint(0, price)],
            style=style or DrawingStyle(),
        )
    
    @property
    def price(self) -> float:
        return self.points[0].price
    
    @price.setter
    def price(self, value: float) -> None:
        self.points[0].price = value


class VerticalLine(Drawing):
    """Vertical bar index line."""
    
    def __init__(
        self,
        bar_index: float,
        style: Optional[DrawingStyle] = None,
        drawing_id: Optional[str] = None,
    ):
        super().__init__(
            id=drawing_id or str(uuid4()),
            drawing_type=DrawingType.VERTICAL_LINE,
            points=[DrawingPoint(bar_index, 0)],
            style=style or DrawingStyle(),
        )
    
    @property
    def bar_index(self) -> float:
        return self.points[0].bar_index
    
    @bar_index.setter
    def bar_index(self, value: float) -> None:
        self.points[0].bar_index = value


class FibonacciRetracement(Drawing):
    """Fibonacci retracement levels."""
    
    LEVELS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
    EXTENDED_LEVELS = [1.272, 1.414, 1.618, 2.0, 2.618]
    
    def __init__(
        self,
        start: DrawingPoint,
        end: DrawingPoint,
        levels: Optional[List[float]] = None,
        style: Optional[DrawingStyle] = None,
        drawing_id: Optional[str] = None,
    ):
        super().__init__(
            id=drawing_id or str(uuid4()),
            drawing_type=DrawingType.FIBONACCI_RETRACEMENT,
            points=[start, end],
            style=style or DrawingStyle(),
        )
        self.levels = levels or self.LEVELS
    
    @property
    def start(self) -> DrawingPoint:
        return self.points[0]
    
    @property
    def end(self) -> DrawingPoint:
        return self.points[1]
    
    def get_level_price(self, level: float) -> float:
        """Get price at a Fibonacci level."""
        price_range = self.end.price - self.start.price
        return self.start.price + price_range * level


class RectangleDrawing(Drawing):
    """Rectangle annotation."""
    
    def __init__(
        self,
        top_left: DrawingPoint,
        bottom_right: DrawingPoint,
        style: Optional[DrawingStyle] = None,
        drawing_id: Optional[str] = None,
    ):
        super().__init__(
            id=drawing_id or str(uuid4()),
            drawing_type=DrawingType.RECTANGLE,
            points=[top_left, bottom_right],
            style=style or DrawingStyle(
                fill_color=Color(33, 150, 243, 50),
            ),
        )
    
    @property
    def top_left(self) -> DrawingPoint:
        return self.points[0]
    
    @property
    def bottom_right(self) -> DrawingPoint:
        return self.points[1]


class TextAnnotation(Drawing):
    """Text annotation at a specific point."""
    
    def __init__(
        self,
        position: DrawingPoint,
        text: str,
        style: Optional[DrawingStyle] = None,
        drawing_id: Optional[str] = None,
    ):
        super().__init__(
            id=drawing_id or str(uuid4()),
            drawing_type=DrawingType.TEXT,
            points=[position],
            style=style or DrawingStyle(),
        )
        self.text = text
    
    @property
    def position(self) -> DrawingPoint:
        return self.points[0]


class DrawingRenderer:
    """
    Renders drawings to command buffer.
    
    Deterministic rendering of all drawing types
    with scale-aware coordinate transformation.
    """
    
    def __init__(self, chart: ChartWrapper):
        self.chart = chart
    
    def render(self, drawing: Drawing, command_buffer: CommandBuffer) -> None:
        """Render a drawing to the command buffer."""
        if not drawing.visible:
            return
        
        if not self.chart._scale_engine:
            return
        
        chart_area = self.chart.layout.chart_area
        scale = self.chart._scale_engine
        
        if drawing.drawing_type == DrawingType.TREND_LINE:
            self._render_trend_line(drawing, scale, chart_area, command_buffer)
        elif drawing.drawing_type == DrawingType.HORIZONTAL_LINE:
            self._render_horizontal_line(drawing, scale, chart_area, command_buffer)
        elif drawing.drawing_type == DrawingType.VERTICAL_LINE:
            self._render_vertical_line(drawing, scale, chart_area, command_buffer)
        elif drawing.drawing_type == DrawingType.FIBONACCI_RETRACEMENT:
            self._render_fibonacci(drawing, scale, chart_area, command_buffer)
        elif drawing.drawing_type == DrawingType.RECTANGLE:
            self._render_rectangle(drawing, scale, chart_area, command_buffer)
        elif drawing.drawing_type == DrawingType.TEXT:
            self._render_text(drawing, scale, chart_area, command_buffer)
    
    def _render_trend_line(
        self,
        drawing: Drawing,
        scale: ScaleEngine,
        chart_area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render trend line."""
        start = drawing.points[0].to_screen(scale, chart_area)
        end = drawing.points[1].to_screen(scale, chart_area)
        style = drawing.style
        
        # Extend line if configured
        if style.extend_left or style.extend_right:
            start, end = self._extend_line(start, end, chart_area, style)
        
        buf.add_command({
            "type": "line",
            "x1": start.x,
            "y1": start.y,
            "x2": end.x,
            "y2": end.y,
            "color": style.line_color.to_tuple(),
            "width": style.line_width,
            "dash": style.line_dash,
        })
        
        # Render anchor points
        self._render_anchors(drawing, scale, chart_area, buf)
    
    def _render_horizontal_line(
        self,
        drawing: Drawing,
        scale: ScaleEngine,
        chart_area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render horizontal line."""
        price = drawing.points[0].price
        y = scale.price_to_y(price) + chart_area.y
        style = drawing.style
        
        buf.add_command({
            "type": "line",
            "x1": chart_area.x,
            "y1": y,
            "x2": chart_area.x + chart_area.width,
            "y2": y,
            "color": style.line_color.to_tuple(),
            "width": style.line_width,
            "dash": style.line_dash,
        })
        
        # Price label
        if style.show_price_labels:
            self._render_price_label(price, y, chart_area, style, buf)
    
    def _render_vertical_line(
        self,
        drawing: Drawing,
        scale: ScaleEngine,
        chart_area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render vertical line."""
        bar_index = drawing.points[0].bar_index
        x = scale.bar_index_to_x(bar_index) + chart_area.x
        style = drawing.style
        
        buf.add_command({
            "type": "line",
            "x1": x,
            "y1": chart_area.y,
            "x2": x,
            "y2": chart_area.y + chart_area.height,
            "color": style.line_color.to_tuple(),
            "width": style.line_width,
            "dash": style.line_dash,
        })
    
    def _render_fibonacci(
        self,
        drawing: FibonacciRetracement,
        scale: ScaleEngine,
        chart_area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render Fibonacci retracement."""
        style = drawing.style
        
        for level in drawing.levels:
            price = drawing.get_level_price(level)
            y = scale.price_to_y(price) + chart_area.y
            
            # Level line
            buf.add_command({
                "type": "line",
                "x1": chart_area.x,
                "y1": y,
                "x2": chart_area.x + chart_area.width,
                "y2": y,
                "color": style.line_color.to_tuple(),
                "width": style.line_width,
                "dash": (2, 2),
            })
            
            # Level label
            if style.show_labels:
                label = f"{level * 100:.1f}%"
                buf.add_command({
                    "type": "text",
                    "x": chart_area.x + 5,
                    "y": y - 3,
                    "text": label,
                    "color": style.text_color.to_tuple(),
                    "font_size": style.font_size - 2,
                })
            
            # Price label
            if style.show_price_labels:
                self._render_price_label(price, y, chart_area, style, buf)
    
    def _render_rectangle(
        self,
        drawing: Drawing,
        scale: ScaleEngine,
        chart_area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render rectangle."""
        p1 = drawing.points[0].to_screen(scale, chart_area)
        p2 = drawing.points[1].to_screen(scale, chart_area)
        style = drawing.style
        
        x = min(p1.x, p2.x)
        y = min(p1.y, p2.y)
        width = abs(p2.x - p1.x)
        height = abs(p2.y - p1.y)
        
        # Fill
        if style.fill_color:
            fill_color = style.fill_color.with_alpha(int(255 * style.fill_opacity))
            buf.add_command({
                "type": "rect",
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "color": fill_color.to_tuple(),
                "filled": True,
            })
        
        # Border
        buf.add_command({
            "type": "rect",
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "color": style.line_color.to_tuple(),
            "filled": False,
            "line_width": style.line_width,
        })
        
        # Anchors
        self._render_anchors(drawing, scale, chart_area, buf)
    
    def _render_text(
        self,
        drawing: TextAnnotation,
        scale: ScaleEngine,
        chart_area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render text annotation."""
        pos = drawing.position.to_screen(scale, chart_area)
        style = drawing.style
        
        buf.add_command({
            "type": "text",
            "x": pos.x,
            "y": pos.y,
            "text": drawing.text,
            "color": style.text_color.to_tuple(),
            "font_size": style.font_size,
        })
    
    def _render_anchors(
        self,
        drawing: Drawing,
        scale: ScaleEngine,
        chart_area: Rect,
        buf: CommandBuffer,
    ) -> None:
        """Render anchor points for selection."""
        if drawing.locked:
            return
        
        for point in drawing.points:
            screen_point = point.to_screen(scale, chart_area)
            
            buf.add_command({
                "type": "circle",
                "x": screen_point.x,
                "y": screen_point.y,
                "radius": 4,
                "color": Colors.WHITE.to_tuple(),
                "filled": True,
            })
            buf.add_command({
                "type": "circle",
                "x": screen_point.x,
                "y": screen_point.y,
                "radius": 4,
                "color": drawing.style.line_color.to_tuple(),
                "filled": False,
                "width": 1.5,
            })
    
    def _render_price_label(
        self,
        price: float,
        y: float,
        chart_area: Rect,
        style: DrawingStyle,
        buf: CommandBuffer,
    ) -> None:
        """Render price label on the right side."""
        label = f"{price:.2f}"
        label_width = len(label) * 7 + 8
        label_height = style.font_size + 4
        
        x = chart_area.x + chart_area.width + 2
        label_y = y - label_height / 2
        
        # Background
        buf.add_command({
            "type": "rect",
            "x": x,
            "y": label_y,
            "width": label_width,
            "height": label_height,
            "color": style.line_color.to_tuple(),
            "filled": True,
        })
        
        # Text
        buf.add_command({
            "type": "text",
            "x": x + 4,
            "y": label_y + style.font_size,
            "text": label,
            "color": Colors.WHITE.to_tuple(),
            "font_size": style.font_size,
        })
    
    def _extend_line(
        self,
        start: Point,
        end: Point,
        chart_area: Rect,
        style: DrawingStyle,
    ) -> Tuple[Point, Point]:
        """Extend line to chart boundaries."""
        dx = end.x - start.x
        dy = end.y - start.y
        
        if dx == 0:
            # Vertical line
            new_start = Point(start.x, chart_area.y) if style.extend_left else start
            new_end = Point(end.x, chart_area.y + chart_area.height) if style.extend_right else end
            return new_start, new_end
        
        slope = dy / dx
        
        new_start = start
        new_end = end
        
        if style.extend_left:
            # Extend to left boundary
            left_y = start.y + slope * (chart_area.x - start.x)
            new_start = Point(chart_area.x, left_y)
        
        if style.extend_right:
            # Extend to right boundary
            right_x = chart_area.x + chart_area.width
            right_y = start.y + slope * (right_x - start.x)
            new_end = Point(right_x, right_y)
        
        return new_start, new_end


class DrawingManager:
    """
    Manages all drawings on a chart.
    
    Provides CRUD operations and event handling
    for drawing tools.
    """
    
    def __init__(self, chart: ChartWrapper):
        self.chart = chart
        self._drawings: Dict[str, Drawing] = {}
        self._renderer = DrawingRenderer(chart)
        self._selected: Optional[str] = None
        self._listeners: List[Callable[[str, Drawing], None]] = []
    
    def add(self, drawing: Drawing) -> str:
        """Add a drawing and return its ID."""
        self._drawings[drawing.id] = drawing
        self._notify("add", drawing)
        return drawing.id
    
    def remove(self, drawing_id: str) -> bool:
        """Remove a drawing by ID."""
        if drawing_id in self._drawings:
            drawing = self._drawings.pop(drawing_id)
            if self._selected == drawing_id:
                self._selected = None
            self._notify("remove", drawing)
            return True
        return False
    
    def get(self, drawing_id: str) -> Optional[Drawing]:
        """Get a drawing by ID."""
        return self._drawings.get(drawing_id)
    
    def get_all(self) -> List[Drawing]:
        """Get all drawings."""
        return list(self._drawings.values())
    
    def clear(self) -> None:
        """Remove all drawings."""
        self._drawings.clear()
        self._selected = None
    
    def select(self, drawing_id: str) -> bool:
        """Select a drawing."""
        if drawing_id in self._drawings:
            self._selected = drawing_id
            return True
        return False
    
    def deselect(self) -> None:
        """Deselect current drawing."""
        self._selected = None
    
    def get_selected(self) -> Optional[Drawing]:
        """Get selected drawing."""
        if self._selected:
            return self._drawings.get(self._selected)
        return None
    
    def hit_test(self, point: DrawingPoint) -> Optional[Tuple[str, DrawingAnchor]]:
        """
        Test if a point hits any drawing.
        
        Returns (drawing_id, anchor) if hit, None otherwise.
        """
        for drawing_id, drawing in self._drawings.items():
            anchor = drawing.hit_test(point)
            if anchor:
                return (drawing_id, anchor)
        return None
    
    def move_selected(self, delta_bar: float, delta_price: float) -> None:
        """Move selected drawing."""
        drawing = self.get_selected()
        if drawing:
            drawing.move(delta_bar, delta_price)
            self._notify("modify", drawing)
    
    def on_change(self, callback: Callable[[str, Drawing], None]) -> None:
        """Register change listener."""
        self._listeners.append(callback)
    
    def _notify(self, event: str, drawing: Drawing) -> None:
        """Notify listeners of change."""
        for listener in self._listeners:
            listener(event, drawing)
    
    def render(self, command_buffer: CommandBuffer) -> None:
        """Render all drawings."""
        for drawing in self._drawings.values():
            self._renderer.render(drawing, command_buffer)
    
    def to_dict(self) -> List[dict]:
        """Serialize all drawings."""
        result = []
        for drawing in self._drawings.values():
            result.append({
                "id": drawing.id,
                "type": drawing.drawing_type.name,
                "points": [
                    {"bar_index": p.bar_index, "price": p.price}
                    for p in drawing.points
                ],
                "style": {
                    "line_color": drawing.style.line_color.to_hex(),
                    "line_width": drawing.style.line_width,
                },
                "visible": drawing.visible,
                "locked": drawing.locked,
            })
        return result
    
    def from_dict(self, data: List[dict]) -> None:
        """Load drawings from serialized data."""
        self.clear()
        
        for item in data:
            drawing_type = DrawingType[item["type"]]
            points = [
                DrawingPoint(p["bar_index"], p["price"])
                for p in item["points"]
            ]
            style = DrawingStyle(
                line_color=Color.from_hex(item["style"]["line_color"]),
                line_width=item["style"]["line_width"],
            )
            
            if drawing_type == DrawingType.TREND_LINE and len(points) >= 2:
                drawing = TrendLine(points[0], points[1], style, item["id"])
            elif drawing_type == DrawingType.HORIZONTAL_LINE and len(points) >= 1:
                drawing = HorizontalLine(points[0].price, style, item["id"])
            elif drawing_type == DrawingType.VERTICAL_LINE and len(points) >= 1:
                drawing = VerticalLine(points[0].bar_index, style, item["id"])
            else:
                drawing = Drawing(
                    id=item["id"],
                    drawing_type=drawing_type,
                    points=points,
                    style=style,
                )
            
            drawing.visible = item.get("visible", True)
            drawing.locked = item.get("locked", False)
            self._drawings[drawing.id] = drawing


# Helper functions

def create_trend_line(
    start_bar: float,
    start_price: float,
    end_bar: float,
    end_price: float,
    color: Optional[Color] = None,
) -> TrendLine:
    """Create a trend line drawing."""
    style = DrawingStyle()
    if color:
        style.line_color = color
    
    return TrendLine(
        DrawingPoint(start_bar, start_price),
        DrawingPoint(end_bar, end_price),
        style,
    )


def create_horizontal_line(
    price: float,
    color: Optional[Color] = None,
) -> HorizontalLine:
    """Create a horizontal line drawing."""
    style = DrawingStyle()
    if color:
        style.line_color = color
    
    return HorizontalLine(price, style)


def create_fibonacci(
    start_bar: float,
    start_price: float,
    end_bar: float,
    end_price: float,
    levels: Optional[List[float]] = None,
) -> FibonacciRetracement:
    """Create Fibonacci retracement drawing."""
    return FibonacciRetracement(
        DrawingPoint(start_bar, start_price),
        DrawingPoint(end_bar, end_price),
        levels,
    )
