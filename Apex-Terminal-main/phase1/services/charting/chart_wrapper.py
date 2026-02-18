"""
Chart Wrapper - High-level chart component.

Binds together:
- Renderer
- Scale engine
- Bar data
- Drawing tools
- Indicators
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple
from enum import Enum
import hashlib
import json

from services.charting.primitives import (
    Point, Rect, Color, Colors,
    LineStyle, FillStyle, TextStyle,
)
from services.charting.renderer import (
    RendererConfig, RenderContext, CanvasRenderer,
)
from services.charting.scale_engine import (
    ScaleEngine, PriceScale, TimeScale, Viewport, ScaleState,
    auto_scale_price, compute_nice_ticks,
)


class ChartType(Enum):
    """Chart rendering type."""
    CANDLESTICK = "candlestick"
    LINE = "line"
    AREA = "area"
    BAR = "bar"


@dataclass
class ChartStyle:
    """Chart visual style configuration."""
    
    background_color: Color = field(default_factory=lambda: Colors.BACKGROUND)
    grid_color: Color = field(default_factory=lambda: Colors.GRID_GRAY)
    text_color: Color = field(default_factory=lambda: Colors.TEXT)
    bull_color: Color = field(default_factory=lambda: Colors.BULL_GREEN)
    bear_color: Color = field(default_factory=lambda: Colors.BEAR_RED)
    line_color: Color = field(default_factory=lambda: Color(33, 150, 243))
    crosshair_color: Color = field(default_factory=lambda: Colors.CROSSHAIR)
    
    show_grid: bool = True
    show_volume: bool = True
    show_legend: bool = True
    
    candle_wick_width: float = 1.0
    candle_body_width_ratio: float = 0.8


@dataclass
class ChartLayout:
    """Chart layout configuration."""
    
    width: int = 1280
    height: int = 800
    
    # Margins
    margin_left: int = 60
    margin_right: int = 80
    margin_top: int = 20
    margin_bottom: int = 40
    
    # Scale panel widths
    price_scale_width: int = 70
    time_scale_height: int = 30
    
    # Volume panel
    volume_height_ratio: float = 0.2
    
    @property
    def chart_area(self) -> Rect:
        """Get main chart area rectangle."""
        return Rect(
            x=self.margin_left,
            y=self.margin_top,
            width=self.width - self.margin_left - self.margin_right,
            height=self.height - self.margin_top - self.margin_bottom,
        )
    
    @property
    def price_scale_area(self) -> Rect:
        """Get price scale area."""
        chart = self.chart_area
        return Rect(
            x=chart.right,
            y=chart.y,
            width=self.price_scale_width,
            height=chart.height,
        )
    
    @property
    def time_scale_area(self) -> Rect:
        """Get time scale area."""
        chart = self.chart_area
        return Rect(
            x=chart.x,
            y=chart.bottom,
            width=chart.width,
            height=self.time_scale_height,
        )


@dataclass
class Bar:
    """OHLCV bar data."""
    
    bar_index: int
    timestamp_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    
    @property
    def is_bullish(self) -> bool:
        return self.close >= self.open
    
    def to_dict(self) -> dict:
        return {
            "bar_index": self.bar_index,
            "timestamp_ms": self.timestamp_ms,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
        }
    
    @classmethod
    def from_dict(cls, d: dict) -> "Bar":
        return cls(**d)


@dataclass
class Series:
    """Data series for indicators."""
    
    name: str
    values: List[Tuple[int, float]]  # (bar_index, value)
    color: Color = field(default_factory=lambda: Colors.BLUE)
    line_width: float = 1.0
    visible: bool = True
    
    def get_value_at(self, bar_index: int) -> Optional[float]:
        """Get value at bar index."""
        for idx, val in self.values:
            if idx == bar_index:
                return val
        return None


class ChartWrapper:
    """
    High-level chart component.
    
    Manages bars, rendering, scale synchronization.
    """
    
    def __init__(
        self,
        chart_id: str = "chart-1",
        layout: Optional[ChartLayout] = None,
        style: Optional[ChartStyle] = None,
        chart_type: ChartType = ChartType.CANDLESTICK,
        device_pixel_ratio: float = 2.0,
    ):
        self.chart_id = chart_id
        self.layout = layout or ChartLayout()
        self.style = style or ChartStyle()
        self.chart_type = chart_type
        self.device_pixel_ratio = device_pixel_ratio
        
        # Data
        self._bars: List[Bar] = []
        self._series: Dict[str, Series] = {}
        
        # Scale state
        self._scale_engine: Optional[ScaleEngine] = None
        self._auto_scale = True
        
        # Event callbacks
        self._on_scale_change: List[Callable[[ScaleState], None]] = []
        
        # Renderer
        self._renderer = CanvasRenderer(RendererConfig(
            width=self.layout.width,
            height=self.layout.height,
            device_pixel_ratio=self.device_pixel_ratio,
            background_color=self.style.background_color,
        ))
    
    def set_bars(self, bars: List[Bar]) -> None:
        """Set bar data."""
        self._bars = sorted(bars, key=lambda b: b.bar_index)
        
        if self._auto_scale:
            self._update_scale()
    
    def add_bar(self, bar: Bar) -> None:
        """Add or update a bar."""
        # Find existing bar
        for i, existing in enumerate(self._bars):
            if existing.bar_index == bar.bar_index:
                self._bars[i] = bar
                return
        
        # Insert in sorted order
        self._bars.append(bar)
        self._bars.sort(key=lambda b: b.bar_index)
        
        if self._auto_scale:
            self._update_scale()
    
    def add_series(self, series: Series) -> None:
        """Add indicator series."""
        self._series[series.name] = series
    
    def remove_series(self, name: str) -> None:
        """Remove indicator series."""
        self._series.pop(name, None)
    
    def _update_scale(self) -> None:
        """Update scale from bars."""
        if not self._bars:
            return
        
        # Convert bars to dict for auto_scale
        bar_dicts = [b.to_dict() for b in self._bars]
        price_scale = auto_scale_price(bar_dicts)
        
        # Time scale
        start_idx = self._bars[0].bar_index
        end_idx = self._bars[-1].bar_index
        
        time_scale = TimeScale(
            start_bar_index=start_idx,
            end_bar_index=end_idx,
        )
        
        # Viewport
        chart_area = self.layout.chart_area
        viewport = Viewport(
            x=chart_area.x,
            y=chart_area.y,
            width=chart_area.width,
            height=chart_area.height,
            device_pixel_ratio=self.device_pixel_ratio,
        )
        
        self._scale_engine = ScaleEngine(
            viewport=viewport,
            price_scale=price_scale,
            time_scale=time_scale,
        )
    
    def set_scale_state(self, state: ScaleState) -> None:
        """Set scale from state (for sync)."""
        chart_area = self.layout.chart_area
        self._scale_engine = state.to_scale_engine(
            viewport_x=chart_area.x,
            viewport_y=chart_area.y,
        )
        self._auto_scale = False
    
    def get_scale_state(self) -> Optional[ScaleState]:
        """Get current scale state."""
        if not self._scale_engine:
            return None
        
        return ScaleState(
            start_bar_index=self._scale_engine.time_scale.start_bar_index,
            end_bar_index=self._scale_engine.time_scale.end_bar_index,
            min_price=self._scale_engine.price_scale.min_price,
            max_price=self._scale_engine.price_scale.max_price,
            viewport_width=self._scale_engine.viewport.width,
            viewport_height=self._scale_engine.viewport.height,
            device_pixel_ratio=self.device_pixel_ratio,
        )
    
    def on_scale_change(self, callback: Callable[[ScaleState], None]) -> None:
        """Register scale change callback."""
        self._on_scale_change.append(callback)
    
    def pan(self, delta_bars: int) -> None:
        """Pan chart by bars."""
        if self._scale_engine:
            self._scale_engine = self._scale_engine.pan(delta_bars)
            self._auto_scale = False
            self._notify_scale_change()
    
    def zoom(self, factor: float, anchor_x: Optional[float] = None) -> None:
        """Zoom chart."""
        if self._scale_engine:
            anchor_bar = None
            if anchor_x is not None:
                anchor_bar = self._scale_engine.x_to_bar_index(anchor_x)
            
            self._scale_engine = self._scale_engine.zoom(factor, anchor_bar)
            self._auto_scale = False
            self._notify_scale_change()
    
    def _notify_scale_change(self) -> None:
        """Notify listeners of scale change."""
        state = self.get_scale_state()
        if state:
            for callback in self._on_scale_change:
                callback(state)
    
    def render(self) -> Tuple[bytes, str]:
        """
        Render chart to PNG.
        
        Returns:
            Tuple of (png_bytes, frame_hash)
        """
        context = RenderContext(config=self._renderer.config)
        self._renderer.begin_frame(context)
        
        # Draw background
        self._draw_background()
        
        # Draw grid
        if self.style.show_grid:
            self._draw_grid()
        
        # Draw bars
        if self._bars and self._scale_engine:
            self._draw_bars()
        
        # Draw series
        for series in self._series.values():
            if series.visible:
                self._draw_series(series)
        
        # Draw scales
        self._draw_price_scale()
        self._draw_time_scale()
        
        frame_hash = self._renderer.end_frame()
        png_bytes = self._renderer.export_png()
        
        return png_bytes, frame_hash
    
    def _draw_background(self) -> None:
        """Draw chart background."""
        self._renderer.draw_rect(
            Rect(0, 0, self.layout.width, self.layout.height),
            fill=FillStyle(self.style.background_color),
        )
    
    def _draw_grid(self) -> None:
        """Draw grid lines."""
        if not self._scale_engine:
            return
        
        chart_area = self.layout.chart_area
        
        # Horizontal grid lines (price)
        price_ticks = compute_nice_ticks(
            self._scale_engine.price_scale.min_price,
            self._scale_engine.price_scale.max_price,
            5,
        )
        
        for price in price_ticks:
            y = self._scale_engine.price_to_y(price)
            if chart_area.top <= y <= chart_area.bottom:
                self._renderer.draw_line(
                    Point(chart_area.left, y),
                    Point(chart_area.right, y),
                    LineStyle(self.style.grid_color, 1.0),
                )
    
    def _draw_bars(self) -> None:
        """Draw OHLC bars."""
        if not self._scale_engine:
            return
        
        candle_width = self._scale_engine.get_candle_width(
            self.style.candle_body_width_ratio
        )
        
        for bar in self._bars:
            if not self._is_bar_visible(bar.bar_index):
                continue
            
            x = self._scale_engine.bar_index_to_x(bar.bar_index)
            
            self._renderer.draw_candle(
                x=x - candle_width / 2,
                open_price=self._scale_engine.price_to_y(bar.open),
                high_price=self._scale_engine.price_to_y(bar.high),
                low_price=self._scale_engine.price_to_y(bar.low),
                close_price=self._scale_engine.price_to_y(bar.close),
                width=candle_width,
                is_bullish=bar.is_bullish,
            )
    
    def _draw_series(self, series: Series) -> None:
        """Draw indicator series."""
        if not self._scale_engine or not series.values:
            return
        
        points = []
        for bar_idx, value in series.values:
            if self._is_bar_visible(bar_idx):
                x = self._scale_engine.bar_index_to_x(bar_idx)
                y = self._scale_engine.price_to_y(value)
                points.append(Point(x, y))
        
        if len(points) >= 2:
            self._renderer.draw_path(
                points,
                stroke=LineStyle(series.color, series.line_width),
            )
    
    def _draw_price_scale(self) -> None:
        """Draw price scale axis."""
        if not self._scale_engine:
            return
        
        area = self.layout.price_scale_area
        
        # Background
        self._renderer.draw_rect(
            area,
            fill=FillStyle(self.style.background_color),
        )
        
        # Ticks
        price_ticks = compute_nice_ticks(
            self._scale_engine.price_scale.min_price,
            self._scale_engine.price_scale.max_price,
            5,
        )
        
        for price in price_ticks:
            y = self._scale_engine.price_to_y(price)
            
            # Format price
            if price >= 1000:
                label = f"{price:.0f}"
            elif price >= 1:
                label = f"{price:.2f}"
            else:
                label = f"{price:.4f}"
            
            self._renderer.draw_text(
                label,
                Point(area.x + 5, y - 6),
                TextStyle(color=self.style.text_color, font_size=11),
            )
    
    def _draw_time_scale(self) -> None:
        """Draw time scale axis."""
        if not self._scale_engine:
            return
        
        area = self.layout.time_scale_area
        
        # Background
        self._renderer.draw_rect(
            area,
            fill=FillStyle(self.style.background_color),
        )
    
    def _is_bar_visible(self, bar_index: int) -> bool:
        """Check if bar is in visible range."""
        if not self._scale_engine:
            return False
        
        ts = self._scale_engine.time_scale
        return ts.start_bar_index <= bar_index <= ts.end_bar_index
    
    def get_bar_at_x(self, x: float) -> Optional[Bar]:
        """Get bar at screen X coordinate."""
        if not self._scale_engine:
            return None
        
        bar_index = round(self._scale_engine.x_to_bar_index(x))
        
        for bar in self._bars:
            if bar.bar_index == bar_index:
                return bar
        
        return None
    
    def get_price_at_y(self, y: float) -> Optional[float]:
        """Get price at screen Y coordinate."""
        if not self._scale_engine:
            return None
        
        return self._scale_engine.y_to_price(y)
    
    def compute_frame_hash(self) -> str:
        """Compute deterministic hash of current state."""
        state = {
            "chart_id": self.chart_id,
            "bars": [b.to_dict() for b in self._bars],
            "scale": self.get_scale_state().to_dict() if self.get_scale_state() else None,
            "chart_type": self.chart_type.value,
        }
        
        return hashlib.sha256(
            json.dumps(state, sort_keys=True).encode()
        ).hexdigest()


def create_chart(
    bars: List[Dict],
    width: int = 1280,
    height: int = 800,
    device_pixel_ratio: float = 2.0,
) -> Tuple[bytes, str]:
    """
    Convenience function to render bars to PNG.
    
    Args:
        bars: List of bar dicts
        width: Chart width
        height: Chart height
        device_pixel_ratio: DPR for HiDPI
    
    Returns:
        Tuple of (png_bytes, frame_hash)
    """
    layout = ChartLayout(width=width, height=height)
    chart = ChartWrapper(layout=layout, device_pixel_ratio=device_pixel_ratio)
    
    bar_objects = [
        Bar(
            bar_index=i,
            timestamp_ms=b.get("timestamp_ms", 0),
            open=b.get("open", 0),
            high=b.get("high", 0),
            low=b.get("low", 0),
            close=b.get("close", 0),
            volume=b.get("volume", 0),
        )
        for i, b in enumerate(bars)
    ]
    
    chart.set_bars(bar_objects)
    return chart.render()
