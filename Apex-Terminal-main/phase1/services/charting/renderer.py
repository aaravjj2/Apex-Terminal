"""
Deterministic Canvas Renderer.

Provides pixel-exact rendering with:
- Fixed DPR handling
- Deterministic font rendering
- Command buffer for replay
- PNG export
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from io import BytesIO
import hashlib

from services.charting.primitives import (
    Point, Rect, Color, Colors,
    LineStyle, FillStyle, TextStyle, Gradient,
    RenderCommand, CommandBuffer,
    DrawLineCommand, DrawRectCommand, DrawTextCommand,
    DrawPathCommand, DrawCandleCommand,
)

# Optional PIL import for PNG export
try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


@dataclass
class RendererConfig:
    """Configuration for deterministic rendering."""
    
    width: int = 1280
    height: int = 800
    device_pixel_ratio: float = 2.0
    background_color: Color = field(default_factory=lambda: Colors.BACKGROUND)
    font_path: Optional[str] = None  # Path to bundled font
    antialias: bool = True
    
    @property
    def physical_width(self) -> int:
        return int(self.width * self.device_pixel_ratio)
    
    @property
    def physical_height(self) -> int:
        return int(self.height * self.device_pixel_ratio)


@dataclass
class RenderContext:
    """Context for a render frame."""
    
    config: RendererConfig
    timestamp_ms: int = 0
    frame_number: int = 0
    viewport: Optional[Rect] = None
    
    def __post_init__(self):
        if self.viewport is None:
            self.viewport = Rect(0, 0, self.config.width, self.config.height)


class DeterministicRenderer:
    """
    Deterministic renderer that produces identical output for identical input.
    
    Uses a command buffer pattern for reproducibility.
    """
    
    def __init__(self, config: Optional[RendererConfig] = None):
        self.config = config or RendererConfig()
        self._command_buffer = CommandBuffer()
        self._context: Optional[RenderContext] = None
        
        # Font cache
        self._fonts: Dict[str, Any] = {}
        self._load_fonts()
    
    def _load_fonts(self) -> None:
        """Load bundled fonts for deterministic text rendering."""
        if not HAS_PIL:
            return
        
        if self.config.font_path:
            try:
                # Load custom font at various sizes
                for size in [10, 11, 12, 13, 14, 16, 18, 20, 24]:
                    key = f"custom_{size}"
                    self._fonts[key] = ImageFont.truetype(
                        self.config.font_path,
                        int(size * self.config.device_pixel_ratio),
                    )
            except Exception:
                pass
        
        # Fallback to default
        if not self._fonts:
            for size in [10, 11, 12, 13, 14, 16, 18, 20, 24]:
                key = f"default_{size}"
                try:
                    self._fonts[key] = ImageFont.load_default()
                except Exception:
                    pass
    
    def begin_frame(self, context: RenderContext) -> None:
        """Begin a new render frame."""
        self._context = context
        self._command_buffer.clear()
    
    def end_frame(self) -> str:
        """End frame and return command hash."""
        return self._command_buffer.compute_hash()
    
    def draw_line(
        self,
        start: Point,
        end: Point,
        style: LineStyle,
    ) -> None:
        """Draw a line."""
        cmd = DrawLineCommand(start=start, end=end, style=style)
        self._command_buffer.add(cmd)
    
    def draw_rect(
        self,
        rect: Rect,
        fill: Optional[FillStyle] = None,
        stroke: Optional[LineStyle] = None,
    ) -> None:
        """Draw a rectangle."""
        cmd = DrawRectCommand(rect=rect, fill=fill, stroke=stroke)
        self._command_buffer.add(cmd)
    
    def draw_text(
        self,
        text: str,
        position: Point,
        style: Optional[TextStyle] = None,
    ) -> None:
        """Draw text."""
        style = style or TextStyle()
        cmd = DrawTextCommand(text=text, position=position, style=style)
        self._command_buffer.add(cmd)
    
    def draw_path(
        self,
        points: List[Point],
        closed: bool = False,
        fill: Optional[FillStyle] = None,
        stroke: Optional[LineStyle] = None,
    ) -> None:
        """Draw a path."""
        cmd = DrawPathCommand(points=points, closed=closed, fill=fill, stroke=stroke)
        self._command_buffer.add(cmd)
    
    def draw_candle(
        self,
        x: float,
        open_price: float,
        high_price: float,
        low_price: float,
        close_price: float,
        width: float,
        is_bullish: bool,
    ) -> None:
        """Draw a candlestick."""
        cmd = DrawCandleCommand(
            x=x,
            open_y=open_price,
            high_y=high_price,
            low_y=low_price,
            close_y=close_price,
            width=width,
            is_bullish=is_bullish,
        )
        self._command_buffer.add(cmd)
    
    def get_commands(self) -> List[RenderCommand]:
        """Get all render commands."""
        return self._command_buffer.commands
    
    @property
    def command_count(self) -> int:
        """Get number of commands."""
        return len(self._command_buffer)


class CanvasRenderer(DeterministicRenderer):
    """
    PIL-based canvas renderer for server-side PNG generation.
    
    Produces deterministic pixel output.
    """
    
    def __init__(self, config: Optional[RendererConfig] = None):
        super().__init__(config)
        self._image: Optional[Image.Image] = None
        self._draw: Optional[ImageDraw.ImageDraw] = None
    
    def begin_frame(self, context: RenderContext) -> None:
        """Begin frame with fresh canvas."""
        super().begin_frame(context)
        
        if not HAS_PIL:
            raise RuntimeError("PIL not available for canvas rendering")
        
        # Create image at physical resolution
        self._image = Image.new(
            'RGBA',
            (self.config.physical_width, self.config.physical_height),
            self.config.background_color.to_tuple(),
        )
        self._draw = ImageDraw.Draw(self._image)
    
    def end_frame(self) -> str:
        """End frame, render commands, return hash."""
        # Execute all commands
        self._execute_commands()
        
        # Compute hash from command buffer
        return super().end_frame()
    
    def _execute_commands(self) -> None:
        """Execute buffered commands on canvas."""
        if not self._draw:
            return
        
        dpr = self.config.device_pixel_ratio
        
        for cmd in self._command_buffer.commands:
            if isinstance(cmd, DrawLineCommand):
                self._draw_line_impl(cmd, dpr)
            elif isinstance(cmd, DrawRectCommand):
                self._draw_rect_impl(cmd, dpr)
            elif isinstance(cmd, DrawTextCommand):
                self._draw_text_impl(cmd, dpr)
            elif isinstance(cmd, DrawPathCommand):
                self._draw_path_impl(cmd, dpr)
            elif isinstance(cmd, DrawCandleCommand):
                self._draw_candle_impl(cmd, dpr)
    
    def _draw_line_impl(self, cmd: DrawLineCommand, dpr: float) -> None:
        """Draw line implementation."""
        x1 = int(cmd.start.x * dpr)
        y1 = int(cmd.start.y * dpr)
        x2 = int(cmd.end.x * dpr)
        y2 = int(cmd.end.y * dpr)
        
        width = int(cmd.style.width * dpr)
        color = cmd.style.color.to_tuple()
        
        self._draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    
    def _draw_rect_impl(self, cmd: DrawRectCommand, dpr: float) -> None:
        """Draw rectangle implementation."""
        x = int(cmd.rect.x * dpr)
        y = int(cmd.rect.y * dpr)
        x2 = int((cmd.rect.x + cmd.rect.width) * dpr)
        y2 = int((cmd.rect.y + cmd.rect.height) * dpr)
        
        if cmd.fill:
            self._draw.rectangle([(x, y), (x2, y2)], fill=cmd.fill.color.to_tuple())
        
        if cmd.stroke:
            width = int(cmd.stroke.width * dpr)
            self._draw.rectangle(
                [(x, y), (x2, y2)],
                outline=cmd.stroke.color.to_tuple(),
                width=width,
            )
    
    def _draw_text_impl(self, cmd: DrawTextCommand, dpr: float) -> None:
        """Draw text implementation."""
        x = int(cmd.position.x * dpr)
        y = int(cmd.position.y * dpr)
        
        font_size = int(cmd.style.font_size)
        font_key = f"custom_{font_size}" if f"custom_{font_size}" in self._fonts else f"default_{font_size}"
        font = self._fonts.get(font_key)
        
        self._draw.text(
            (x, y),
            cmd.text,
            fill=cmd.style.color.to_tuple(),
            font=font,
        )
    
    def _draw_path_impl(self, cmd: DrawPathCommand, dpr: float) -> None:
        """Draw path implementation."""
        if len(cmd.points) < 2:
            return
        
        points = [(int(p.x * dpr), int(p.y * dpr)) for p in cmd.points]
        
        if cmd.fill and cmd.closed:
            self._draw.polygon(points, fill=cmd.fill.color.to_tuple())
        
        if cmd.stroke:
            width = int(cmd.stroke.width * dpr)
            self._draw.line(points, fill=cmd.stroke.color.to_tuple(), width=width)
    
    def _draw_candle_impl(self, cmd: DrawCandleCommand, dpr: float) -> None:
        """Draw candlestick implementation."""
        x = int(cmd.x * dpr)
        width = int(cmd.width * dpr)
        half_width = width // 2
        
        # Scale Y coordinates
        open_y = int(cmd.open_y * dpr)
        high_y = int(cmd.high_y * dpr)
        low_y = int(cmd.low_y * dpr)
        close_y = int(cmd.close_y * dpr)
        
        color = Colors.BULL_GREEN if cmd.is_bullish else Colors.BEAR_RED
        fill_color = color.to_tuple()
        
        # Draw wick (high-low line)
        wick_x = x + half_width
        self._draw.line(
            [(wick_x, high_y), (wick_x, low_y)],
            fill=fill_color,
            width=max(1, int(dpr)),
        )
        
        # Draw body
        body_top = min(open_y, close_y)
        body_bottom = max(open_y, close_y)
        
        # Ensure minimum body height
        if body_bottom - body_top < 1:
            body_bottom = body_top + 1
        
        self._draw.rectangle(
            [(x, body_top), (x + width, body_bottom)],
            fill=fill_color,
        )
    
    def export_png(self) -> bytes:
        """Export current canvas as PNG bytes."""
        if not self._image:
            raise RuntimeError("No image to export")
        
        buffer = BytesIO()
        self._image.save(buffer, format='PNG', compress_level=9)
        return buffer.getvalue()
    
    def export_png_to_file(self, path: str) -> None:
        """Export current canvas to PNG file."""
        if not self._image:
            raise RuntimeError("No image to export")
        
        self._image.save(path, format='PNG', compress_level=9)
    
    def compute_pixel_hash(self) -> str:
        """Compute SHA256 hash of pixel data."""
        if not self._image:
            raise RuntimeError("No image")
        
        # Get raw pixel data
        pixels = self._image.tobytes()
        return hashlib.sha256(pixels).hexdigest()


def render_frame(
    bars: List[Dict],
    config: Optional[RendererConfig] = None,
    viewport: Optional[Rect] = None,
) -> Tuple[bytes, str]:
    """
    Render bars to PNG buffer.
    
    Returns:
        Tuple of (png_bytes, pixel_hash)
    """
    config = config or RendererConfig()
    renderer = CanvasRenderer(config)
    
    context = RenderContext(config=config, viewport=viewport)
    renderer.begin_frame(context)
    
    if not bars:
        renderer.end_frame()
        return renderer.export_png(), renderer.compute_pixel_hash()
    
    # Calculate scale
    width = config.width
    height = config.height
    
    # Reserve space for scales
    chart_left = 60
    chart_right = width - 80
    chart_top = 20
    chart_bottom = height - 40
    chart_width = chart_right - chart_left
    chart_height = chart_bottom - chart_top
    
    # Find price range
    prices = []
    for bar in bars:
        prices.extend([bar.get('high', 0), bar.get('low', 0)])
    
    if not prices:
        renderer.end_frame()
        return renderer.export_png(), renderer.compute_pixel_hash()
    
    min_price = min(prices)
    max_price = max(prices)
    price_range = max_price - min_price or 1.0
    
    # Add padding
    padding = price_range * 0.05
    min_price -= padding
    max_price += padding
    price_range = max_price - min_price
    
    # Draw chart background
    renderer.draw_rect(
        Rect(chart_left, chart_top, chart_width, chart_height),
        fill=FillStyle(Colors.BACKGROUND),
    )
    
    # Calculate candle dimensions
    num_bars = len(bars)
    candle_spacing = chart_width / num_bars
    candle_width = max(1, candle_spacing * 0.8)
    
    # Draw candles
    for i, bar in enumerate(bars):
        x = chart_left + i * candle_spacing + (candle_spacing - candle_width) / 2
        
        open_price = bar.get('open', 0)
        high_price = bar.get('high', 0)
        low_price = bar.get('low', 0)
        close_price = bar.get('close', 0)
        
        # Convert prices to Y coordinates (inverted)
        def price_to_y(price: float) -> float:
            return chart_top + (1 - (price - min_price) / price_range) * chart_height
        
        is_bullish = close_price >= open_price
        
        renderer.draw_candle(
            x=x,
            open_price=price_to_y(open_price),
            high_price=price_to_y(high_price),
            low_price=price_to_y(low_price),
            close_price=price_to_y(close_price),
            width=candle_width,
            is_bullish=is_bullish,
        )
    
    renderer.end_frame()
    return renderer.export_png(), renderer.compute_pixel_hash()
