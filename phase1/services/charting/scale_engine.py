"""
Scale Engine for Charting.

Provides deterministic coordinate transformations between:
- Data space (bar_index, price)
- Screen space (pixels)
- Viewport space (visible region)

Supports multiple timeframes and device pixel ratios.
"""

from dataclasses import dataclass, field
from typing import Optional, Tuple, List
from enum import Enum
import math

from services.charting.primitives import Point, Rect


class TimeframeUnit(Enum):
    """Timeframe units."""
    SECOND = "s"
    MINUTE = "m"
    HOUR = "h"
    DAY = "D"
    WEEK = "W"
    MONTH = "M"


@dataclass
class Timeframe:
    """Timeframe specification."""
    
    multiplier: int
    unit: TimeframeUnit
    
    @property
    def duration_ms(self) -> int:
        """Get duration in milliseconds."""
        base_ms = {
            TimeframeUnit.SECOND: 1000,
            TimeframeUnit.MINUTE: 60 * 1000,
            TimeframeUnit.HOUR: 60 * 60 * 1000,
            TimeframeUnit.DAY: 24 * 60 * 60 * 1000,
            TimeframeUnit.WEEK: 7 * 24 * 60 * 60 * 1000,
            TimeframeUnit.MONTH: 30 * 24 * 60 * 60 * 1000,  # Approximate
        }
        return self.multiplier * base_ms[self.unit]
    
    def __str__(self) -> str:
        return f"{self.multiplier}{self.unit.value}"
    
    @classmethod
    def from_string(cls, s: str) -> "Timeframe":
        """Parse timeframe string like '1m', '5m', '1h'."""
        import re
        match = re.match(r'^(\d+)([smhDWM])$', s)
        if not match:
            raise ValueError(f"Invalid timeframe: {s}")
        
        multiplier = int(match.group(1))
        unit_char = match.group(2)
        
        unit_map = {
            's': TimeframeUnit.SECOND,
            'm': TimeframeUnit.MINUTE,
            'h': TimeframeUnit.HOUR,
            'D': TimeframeUnit.DAY,
            'W': TimeframeUnit.WEEK,
            'M': TimeframeUnit.MONTH,
        }
        
        return cls(multiplier, unit_map[unit_char])


@dataclass
class PriceScale:
    """Price (Y-axis) scale configuration."""
    
    min_price: float
    max_price: float
    log_scale: bool = False
    auto_scale: bool = True
    margin_top: float = 0.1  # 10% margin
    margin_bottom: float = 0.1
    
    @property
    def range(self) -> float:
        """Get price range."""
        return self.max_price - self.min_price
    
    def with_margins(self) -> "PriceScale":
        """Return scale with margins applied."""
        margin_amount = self.range * (self.margin_top + self.margin_bottom) / 2
        return PriceScale(
            min_price=self.min_price - margin_amount,
            max_price=self.max_price + margin_amount,
            log_scale=self.log_scale,
            auto_scale=self.auto_scale,
            margin_top=0,
            margin_bottom=0,
        )
    
    def price_to_normalized(self, price: float) -> float:
        """Convert price to 0-1 range (0=bottom, 1=top)."""
        if self.range == 0:
            return 0.5
        
        if self.log_scale and self.min_price > 0:
            log_min = math.log10(self.min_price)
            log_max = math.log10(self.max_price)
            log_price = math.log10(max(price, 1e-10))
            return (log_price - log_min) / (log_max - log_min)
        
        return (price - self.min_price) / self.range
    
    def normalized_to_price(self, normalized: float) -> float:
        """Convert 0-1 range to price."""
        if self.log_scale and self.min_price > 0:
            log_min = math.log10(self.min_price)
            log_max = math.log10(self.max_price)
            log_price = log_min + normalized * (log_max - log_min)
            return math.pow(10, log_price)
        
        return self.min_price + normalized * self.range


@dataclass
class TimeScale:
    """Time (X-axis) scale configuration."""
    
    start_bar_index: int
    end_bar_index: int
    bar_spacing: float = 6.0  # Pixels per bar
    
    @property
    def visible_bars(self) -> int:
        """Get number of visible bars."""
        return self.end_bar_index - self.start_bar_index
    
    def bar_index_to_normalized(self, bar_index: int) -> float:
        """Convert bar index to 0-1 range."""
        if self.visible_bars == 0:
            return 0.5
        return (bar_index - self.start_bar_index) / self.visible_bars
    
    def normalized_to_bar_index(self, normalized: float) -> float:
        """Convert 0-1 range to bar index."""
        return self.start_bar_index + normalized * self.visible_bars


@dataclass
class Viewport:
    """Viewport definition for chart area."""
    
    x: float
    y: float
    width: float
    height: float
    device_pixel_ratio: float = 1.0
    
    @property
    def rect(self) -> Rect:
        """Get viewport as Rect."""
        return Rect(self.x, self.y, self.width, self.height)
    
    @property
    def physical_width(self) -> float:
        """Get width in physical pixels."""
        return self.width * self.device_pixel_ratio
    
    @property
    def physical_height(self) -> float:
        """Get height in physical pixels."""
        return self.height * self.device_pixel_ratio


@dataclass
class ScaleEngine:
    """
    Coordinate transformation engine.
    
    Converts between data coordinates (bar_index, price) and
    screen coordinates (x, y pixels).
    """
    
    viewport: Viewport
    price_scale: PriceScale
    time_scale: TimeScale
    
    def data_to_screen(self, bar_index: float, price: float) -> Point:
        """Convert data coordinates to screen coordinates."""
        # Normalize
        x_norm = self.time_scale.bar_index_to_normalized(bar_index)
        y_norm = self.price_scale.price_to_normalized(price)
        
        # Convert to screen (Y is inverted)
        x = self.viewport.x + x_norm * self.viewport.width
        y = self.viewport.y + (1 - y_norm) * self.viewport.height
        
        return Point(x, y)
    
    def screen_to_data(self, x: float, y: float) -> Tuple[float, float]:
        """Convert screen coordinates to data coordinates."""
        # Normalize
        x_norm = (x - self.viewport.x) / self.viewport.width
        y_norm = 1 - (y - self.viewport.y) / self.viewport.height
        
        # Convert to data
        bar_index = self.time_scale.normalized_to_bar_index(x_norm)
        price = self.price_scale.normalized_to_price(y_norm)
        
        return (bar_index, price)
    
    def bar_index_to_x(self, bar_index: float) -> float:
        """Convert bar index to X coordinate."""
        x_norm = self.time_scale.bar_index_to_normalized(bar_index)
        return self.viewport.x + x_norm * self.viewport.width
    
    def x_to_bar_index(self, x: float) -> float:
        """Convert X coordinate to bar index."""
        x_norm = (x - self.viewport.x) / self.viewport.width
        return self.time_scale.normalized_to_bar_index(x_norm)
    
    def price_to_y(self, price: float) -> float:
        """Convert price to Y coordinate."""
        y_norm = self.price_scale.price_to_normalized(price)
        return self.viewport.y + (1 - y_norm) * self.viewport.height
    
    def y_to_price(self, y: float) -> float:
        """Convert Y coordinate to price."""
        y_norm = 1 - (y - self.viewport.y) / self.viewport.height
        return self.price_scale.normalized_to_price(y_norm)
    
    def get_bar_width(self) -> float:
        """Get width of a single bar in pixels."""
        if self.time_scale.visible_bars == 0:
            return 0
        return self.viewport.width / self.time_scale.visible_bars
    
    def get_candle_width(self, spacing_ratio: float = 0.8) -> float:
        """Get candle body width (with spacing)."""
        return self.get_bar_width() * spacing_ratio
    
    def pan(self, delta_bars: int) -> "ScaleEngine":
        """Create new scale engine panned by delta_bars."""
        new_time_scale = TimeScale(
            start_bar_index=self.time_scale.start_bar_index + delta_bars,
            end_bar_index=self.time_scale.end_bar_index + delta_bars,
            bar_spacing=self.time_scale.bar_spacing,
        )
        return ScaleEngine(
            viewport=self.viewport,
            price_scale=self.price_scale,
            time_scale=new_time_scale,
        )
    
    def zoom(self, factor: float, anchor_bar: Optional[float] = None) -> "ScaleEngine":
        """Create new scale engine zoomed by factor around anchor."""
        if anchor_bar is None:
            anchor_bar = (self.time_scale.start_bar_index + self.time_scale.end_bar_index) / 2
        
        current_range = self.time_scale.visible_bars
        new_range = max(1, int(current_range / factor))
        
        # Calculate new bounds maintaining anchor position
        anchor_ratio = (anchor_bar - self.time_scale.start_bar_index) / current_range if current_range > 0 else 0.5
        
        new_start = int(anchor_bar - anchor_ratio * new_range)
        new_end = new_start + new_range
        
        new_time_scale = TimeScale(
            start_bar_index=new_start,
            end_bar_index=new_end,
            bar_spacing=self.time_scale.bar_spacing,
        )
        
        return ScaleEngine(
            viewport=self.viewport,
            price_scale=self.price_scale,
            time_scale=new_time_scale,
        )


def compute_nice_ticks(min_val: float, max_val: float, target_count: int = 5) -> List[float]:
    """
    Compute nice tick values for axis labels.
    
    Uses the "nice numbers" algorithm for human-readable intervals.
    """
    if min_val >= max_val:
        return [min_val]
    
    range_val = max_val - min_val
    rough_step = range_val / target_count
    
    # Find magnitude
    magnitude = math.pow(10, math.floor(math.log10(rough_step)))
    
    # Normalize step to 1-10 range
    normalized = rough_step / magnitude
    
    # Pick nice step
    if normalized < 1.5:
        nice_step = 1
    elif normalized < 3:
        nice_step = 2
    elif normalized < 7:
        nice_step = 5
    else:
        nice_step = 10
    
    step = nice_step * magnitude
    
    # Generate ticks
    start = math.ceil(min_val / step) * step
    ticks = []
    
    tick = start
    while tick <= max_val + step * 0.01:  # Small tolerance
        ticks.append(round(tick, 10))  # Avoid floating point errors
        tick += step
    
    return ticks


def compute_time_ticks(
    start_index: int,
    end_index: int,
    timeframe: Timeframe,
    target_count: int = 8,
) -> List[Tuple[int, str]]:
    """
    Compute time axis tick positions and labels.
    
    Returns list of (bar_index, label_string) tuples.
    """
    visible_bars = end_index - start_index
    if visible_bars <= 0:
        return []
    
    # Determine appropriate interval
    step = max(1, visible_bars // target_count)
    
    ticks = []
    for i in range(start_index, end_index + 1, step):
        # For now, just use bar index as label
        # In real implementation, would convert to timestamp
        label = str(i)
        ticks.append((i, label))
    
    return ticks


@dataclass
class ScaleState:
    """Serializable scale state for sync."""
    
    start_bar_index: int
    end_bar_index: int
    min_price: float
    max_price: float
    viewport_width: float
    viewport_height: float
    device_pixel_ratio: float = 2.0
    
    def to_dict(self) -> dict:
        return {
            "start_bar_index": self.start_bar_index,
            "end_bar_index": self.end_bar_index,
            "min_price": self.min_price,
            "max_price": self.max_price,
            "viewport_width": self.viewport_width,
            "viewport_height": self.viewport_height,
            "device_pixel_ratio": self.device_pixel_ratio,
        }
    
    @classmethod
    def from_dict(cls, d: dict) -> "ScaleState":
        return cls(**d)
    
    def to_scale_engine(self, viewport_x: float = 0, viewport_y: float = 0) -> ScaleEngine:
        """Convert to ScaleEngine."""
        return ScaleEngine(
            viewport=Viewport(
                x=viewport_x,
                y=viewport_y,
                width=self.viewport_width,
                height=self.viewport_height,
                device_pixel_ratio=self.device_pixel_ratio,
            ),
            price_scale=PriceScale(
                min_price=self.min_price,
                max_price=self.max_price,
            ),
            time_scale=TimeScale(
                start_bar_index=self.start_bar_index,
                end_bar_index=self.end_bar_index,
            ),
        )


def auto_scale_price(bars: List[dict], margin: float = 0.1) -> PriceScale:
    """
    Auto-compute price scale from bars.
    
    Args:
        bars: List of bar dicts with 'high' and 'low' keys
        margin: Margin ratio (0.1 = 10% padding)
    
    Returns:
        PriceScale with auto-computed bounds
    """
    if not bars:
        return PriceScale(min_price=0, max_price=100)
    
    highs = [b.get('high', 0) for b in bars]
    lows = [b.get('low', 0) for b in bars]
    
    max_price = max(highs)
    min_price = min(lows)
    
    range_val = max_price - min_price
    if range_val == 0:
        range_val = max_price * 0.1 or 1.0
    
    padding = range_val * margin
    
    return PriceScale(
        min_price=min_price - padding,
        max_price=max_price + padding,
        auto_scale=True,
        margin_top=0,
        margin_bottom=0,
    )
