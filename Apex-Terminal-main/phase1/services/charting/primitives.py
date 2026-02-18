"""
Primitive types for charting.

Provides deterministic geometric and style primitives.
"""

from dataclasses import dataclass, field
from typing import Tuple, Optional, List
from enum import Enum
import struct
import hashlib


@dataclass(frozen=True)
class Point:
    """Immutable 2D point with subpixel precision."""
    
    x: float
    y: float
    
    def __add__(self, other: "Point") -> "Point":
        return Point(self.x + other.x, self.y + other.y)
    
    def __sub__(self, other: "Point") -> "Point":
        return Point(self.x - other.x, self.y - other.y)
    
    def scale(self, factor: float) -> "Point":
        return Point(self.x * factor, self.y * factor)
    
    def to_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)
    
    def to_int_tuple(self) -> Tuple[int, int]:
        """Round to integer pixels."""
        return (round(self.x), round(self.y))
    
    def distance_to(self, other: "Point") -> float:
        """Euclidean distance."""
        dx = self.x - other.x
        dy = self.y - other.y
        return (dx * dx + dy * dy) ** 0.5


@dataclass(frozen=True)
class Rect:
    """Immutable rectangle."""
    
    x: float
    y: float
    width: float
    height: float
    
    @property
    def left(self) -> float:
        return self.x
    
    @property
    def top(self) -> float:
        return self.y
    
    @property
    def right(self) -> float:
        return self.x + self.width
    
    @property
    def bottom(self) -> float:
        return self.y + self.height
    
    @property
    def center(self) -> Point:
        return Point(self.x + self.width / 2, self.y + self.height / 2)
    
    def contains(self, point: Point) -> bool:
        return (self.left <= point.x <= self.right and
                self.top <= point.y <= self.bottom)
    
    def intersects(self, other: "Rect") -> bool:
        return not (self.right < other.left or
                    self.left > other.right or
                    self.bottom < other.top or
                    self.top > other.bottom)
    
    def to_int_tuple(self) -> Tuple[int, int, int, int]:
        """Round to integer pixels."""
        return (round(self.x), round(self.y), round(self.width), round(self.height))


@dataclass(frozen=True)
class Color:
    """RGBA color with 8-bit components."""
    
    r: int
    g: int
    b: int
    a: int = 255
    
    def __post_init__(self):
        # Clamp values
        object.__setattr__(self, 'r', max(0, min(255, self.r)))
        object.__setattr__(self, 'g', max(0, min(255, self.g)))
        object.__setattr__(self, 'b', max(0, min(255, self.b)))
        object.__setattr__(self, 'a', max(0, min(255, self.a)))
    
    def to_rgba_string(self) -> str:
        return f"rgba({self.r},{self.g},{self.b},{self.a/255:.3f})"
    
    def to_hex(self) -> str:
        if self.a == 255:
            return f"#{self.r:02x}{self.g:02x}{self.b:02x}"
        return f"#{self.r:02x}{self.g:02x}{self.b:02x}{self.a:02x}"
    
    def to_tuple(self) -> Tuple[int, int, int, int]:
        return (self.r, self.g, self.b, self.a)
    
    def with_alpha(self, alpha: int) -> "Color":
        return Color(self.r, self.g, self.b, alpha)
    
    @classmethod
    def from_hex(cls, hex_str: str) -> "Color":
        """Parse hex color string."""
        hex_str = hex_str.lstrip('#')
        if len(hex_str) == 6:
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
            return cls(r, g, b)
        elif len(hex_str) == 8:
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
            a = int(hex_str[6:8], 16)
            return cls(r, g, b, a)
        raise ValueError(f"Invalid hex color: {hex_str}")


# Predefined colors
class Colors:
    """Predefined color constants."""
    
    BLACK = Color(0, 0, 0)
    WHITE = Color(255, 255, 255)
    RED = Color(255, 0, 0)
    GREEN = Color(0, 255, 0)
    BLUE = Color(0, 0, 255)
    TRANSPARENT = Color(0, 0, 0, 0)
    
    # Chart-specific
    BULL_GREEN = Color(38, 166, 154)
    BEAR_RED = Color(239, 83, 80)
    GRID_GRAY = Color(42, 46, 57)
    
    # Crosshair & tooltip colors
    CROSSHAIR_GRAY = Color(120, 123, 134)
    TEXT_WHITE = Color(216, 216, 216)
    LABEL_GRAY = Color(150, 150, 150)
    BACKGROUND = Color(19, 23, 34)
    TEXT = Color(209, 212, 220)
    CROSSHAIR = Color(150, 150, 150, 180)


class LineCapStyle(Enum):
    """Line cap styles."""
    BUTT = "butt"
    ROUND = "round"
    SQUARE = "square"


class LineJoinStyle(Enum):
    """Line join styles."""
    MITER = "miter"
    ROUND = "round"
    BEVEL = "bevel"


@dataclass(frozen=True)
class LineStyle:
    """Line rendering style."""
    
    color: Color
    width: float = 1.0
    dash_pattern: Optional[Tuple[float, ...]] = None
    cap: LineCapStyle = LineCapStyle.BUTT
    join: LineJoinStyle = LineJoinStyle.MITER
    
    def to_dict(self) -> dict:
        return {
            "color": self.color.to_hex(),
            "width": self.width,
            "dash": list(self.dash_pattern) if self.dash_pattern else None,
            "cap": self.cap.value,
            "join": self.join.value,
        }


@dataclass(frozen=True)
class FillStyle:
    """Fill rendering style."""
    
    color: Color
    
    def to_dict(self) -> dict:
        return {"color": self.color.to_hex()}


class GradientType(Enum):
    """Gradient types."""
    LINEAR = "linear"
    RADIAL = "radial"


@dataclass
class GradientStop:
    """Color stop for gradients."""
    
    offset: float  # 0.0 to 1.0
    color: Color


@dataclass
class Gradient:
    """Gradient fill."""
    
    type: GradientType
    stops: List[GradientStop]
    start: Point
    end: Point  # For linear; end point. For radial; center of outer circle.
    
    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "stops": [{"offset": s.offset, "color": s.color.to_hex()} for s in self.stops],
            "start": self.start.to_tuple(),
            "end": self.end.to_tuple(),
        }


@dataclass(frozen=True)
class TextStyle:
    """Text rendering style."""
    
    font_family: str = "Inter"
    font_size: float = 12.0
    font_weight: int = 400
    color: Color = field(default_factory=lambda: Colors.TEXT)
    align: str = "left"  # left, center, right
    baseline: str = "alphabetic"  # top, middle, bottom, alphabetic
    
    def to_css_font(self) -> str:
        weight = self.font_weight
        size = self.font_size
        family = self.font_family
        return f"{weight} {size}px {family}"


@dataclass
class RenderCommand:
    """Base render command for deterministic replay."""
    
    pass


@dataclass
class DrawLineCommand(RenderCommand):
    """Draw line command."""
    
    start: Point
    end: Point
    style: LineStyle


@dataclass
class DrawRectCommand(RenderCommand):
    """Draw rectangle command."""
    
    rect: Rect
    fill: Optional[FillStyle] = None
    stroke: Optional[LineStyle] = None


@dataclass
class DrawTextCommand(RenderCommand):
    """Draw text command."""
    
    text: str
    position: Point
    style: TextStyle


@dataclass
class DrawPathCommand(RenderCommand):
    """Draw path command."""
    
    points: List[Point]
    closed: bool = False
    fill: Optional[FillStyle] = None
    stroke: Optional[LineStyle] = None


@dataclass
class DrawCandleCommand(RenderCommand):
    """Draw candlestick command."""
    
    x: float
    open_y: float
    high_y: float
    low_y: float
    close_y: float
    width: float
    is_bullish: bool


class CommandBuffer:
    """Buffer for render commands with deterministic ordering."""
    
    def __init__(self):
        self._commands: List[RenderCommand] = []
        self._dict_commands: List[dict] = []  # For raw dict commands
    
    def add(self, cmd: RenderCommand) -> None:
        self._commands.append(cmd)
    
    def add_command(self, cmd: dict) -> None:
        """Add a raw dictionary command."""
        self._dict_commands.append(cmd)
    
    def clear(self) -> None:
        self._commands = []
        self._dict_commands = []
    
    @property
    def commands(self) -> List[RenderCommand]:
        return self._commands.copy()
    
    def __len__(self) -> int:
        return len(self._commands) + len(self._dict_commands)
    
    def compute_hash(self) -> str:
        """Compute deterministic hash of all commands."""
        hasher = hashlib.sha256()
        
        for cmd in self._commands:
            # Serialize command deterministically
            cmd_bytes = self._serialize_command(cmd)
            hasher.update(cmd_bytes)
        
        return hasher.hexdigest()
    
    def _serialize_command(self, cmd: RenderCommand) -> bytes:
        """Serialize command to bytes."""
        if isinstance(cmd, DrawLineCommand):
            return struct.pack(
                '>cddddIBd',
                b'L',
                cmd.start.x, cmd.start.y,
                cmd.end.x, cmd.end.y,
                cmd.style.color.r << 24 | cmd.style.color.g << 16 | cmd.style.color.b << 8 | cmd.style.color.a,
                0,  # reserved
                cmd.style.width,
            )
        elif isinstance(cmd, DrawRectCommand):
            fill_color = cmd.fill.color if cmd.fill else Colors.TRANSPARENT
            return struct.pack(
                '>cddddI',
                b'R',
                cmd.rect.x, cmd.rect.y,
                cmd.rect.width, cmd.rect.height,
                fill_color.r << 24 | fill_color.g << 16 | fill_color.b << 8 | fill_color.a,
            )
        elif isinstance(cmd, DrawCandleCommand):
            return struct.pack(
                '>cdddddd?',
                b'C',
                cmd.x, cmd.open_y, cmd.high_y, cmd.low_y, cmd.close_y,
                cmd.width,
                cmd.is_bullish,
            )
        else:
            # Generic fallback
            return str(cmd).encode()
