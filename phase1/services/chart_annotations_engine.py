"""
chart_annotations_engine.py — Server-Side Chart Drawing & Annotation Engine
=============================================================================
Handles persistence, validation, analytics, and transformation of all chart
drawings and annotations (trend lines, Fibonacci tools, shapes, text, etc.).

Features:
 • Full CRUD for chart annotations with undo/redo support
 • Geometric calculations (intersections, projections, snapping)
 • Fibonacci level auto-calculation
 • Support/resistance line detection from drawings
 • Time-series annotation alignment (snap to bars)
 • Multi-chart annotation synchronization
 • Export/import (JSON, Pine Script format)
 • Drawing analytics (most-drawn levels, cluster detection)

Pure computation — no Flask/FastAPI imports.
"""

from __future__ import annotations

import math
import json
import hashlib
import uuid
from copy import deepcopy
from dataclasses import dataclass, field
from enum import Enum
from typing import (
    Any, Callable, Dict, FrozenSet, List, Literal, Optional,
    Sequence, Set, Tuple, Union,
)

import numpy as np
import pandas as pd
from datetime import datetime, timezone


# ═══════════════════════════════════════════════════════════════════════════════
#  Enums
# ═══════════════════════════════════════════════════════════════════════════════

class DrawingType(str, Enum):
    """All supported drawing tool types."""
    # Lines
    TREND_LINE      = "trend_line"
    RAY             = "ray"
    EXTENDED_LINE   = "extended_line"
    ARROW           = "arrow"
    HORIZONTAL_LINE = "horizontal_line"
    VERTICAL_LINE   = "vertical_line"
    # Channels
    PARALLEL_CHANNEL = "parallel_channel"
    REGRESSION_CHANNEL = "regression_channel"
    DISJOINT_CHANNEL = "disjoint_channel"
    # Fibonacci
    FIB_RETRACEMENT  = "fib_retracement"
    FIB_EXTENSION    = "fib_extension"
    FIB_CHANNEL      = "fib_channel"
    FIB_TIME_ZONES   = "fib_time_zones"
    FIB_ARCS         = "fib_arcs"
    FIB_FAN          = "fib_fan"
    FIB_WEDGE        = "fib_wedge"
    FIB_CIRCLES      = "fib_circles"
    # Gann
    GANN_FAN         = "gann_fan"
    GANN_SQUARE      = "gann_square"
    GANN_BOX         = "gann_box"
    # Elliott
    ELLIOTT_IMPULSE  = "elliott_impulse"
    ELLIOTT_CORRECTION = "elliott_correction"
    ELLIOTT_COMBO    = "elliott_combo"
    # Pitchfork
    ANDREWS_PITCHFORK = "andrews_pitchfork"
    SCHIFF_PITCHFORK  = "schiff_pitchfork"
    MOD_SCHIFF_PITCHFORK = "mod_schiff_pitchfork"
    INSIDE_PITCHFORK  = "inside_pitchfork"
    # Shapes
    RECTANGLE       = "rectangle"
    ROTATED_RECTANGLE = "rotated_rectangle"
    ELLIPSE         = "ellipse"
    TRIANGLE        = "triangle"
    ARC             = "arc"
    POLYLINE        = "polyline"
    POLYGON         = "polygon"
    # Text / Labels
    TEXT            = "text"
    CALLOUT         = "callout"
    NOTE            = "note"
    PRICE_LABEL     = "price_label"
    ANCHORED_NOTE   = "anchored_note"
    # Measure
    PRICE_RANGE     = "price_range"
    DATE_RANGE      = "date_range"
    DATE_PRICE_RANGE = "date_price_range"
    RISK_REWARD     = "risk_reward"
    LONG_POSITION   = "long_position"
    SHORT_POSITION  = "short_position"
    # Patterns
    XABCD_PATTERN   = "xabcd_pattern"
    ABCD_PATTERN    = "abcd_pattern"
    THREE_DRIVES    = "three_drives"
    HEAD_SHOULDERS  = "head_shoulders"
    CYPHER_PATTERN  = "cypher_pattern"
    # Technical
    ANCHORED_VWAP   = "anchored_vwap"
    VOLUME_PROFILE_FR = "volume_profile_fixed_range"
    # Paint
    BRUSH           = "brush"
    HIGHLIGHTER     = "highlighter"
    # Icons
    ICON_FLAG       = "icon_flag"
    ICON_ARROW_UP   = "icon_arrow_up"
    ICON_ARROW_DOWN = "icon_arrow_down"
    ICON_CROSS      = "icon_cross"
    ICON_CHECK      = "icon_check"
    ICON_STAR       = "icon_star"


class LineStyle(str, Enum):
    SOLID   = "solid"
    DASHED  = "dashed"
    DOTTED  = "dotted"
    DASHDOT = "dashdot"


class AnchorType(str, Enum):
    """How annotation coordinates are anchored."""
    TIME_PRICE  = "time_price"      # (timestamp, price)
    BAR_INDEX   = "bar_index"       # (bar_index, price)
    PERCENTAGE  = "percentage"      # (pct_x, pct_y) relative to visible range
    PIXEL       = "pixel"           # absolute pixel coords (for overlays)


class SnapMode(str, Enum):
    NONE    = "none"
    BAR     = "bar"                 # snap to nearest bar open time
    OHLC    = "ohlc"               # snap to nearest OHLC value
    ROUND   = "round"              # snap to nearest round number


# ═══════════════════════════════════════════════════════════════════════════════
#  Data Classes
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Point:
    """A single point on the chart (time or index + price)."""
    time: Optional[float] = None       # unix timestamp seconds
    bar_index: Optional[int] = None    # alternative: bar index
    price: float = 0.0
    # For pixel-based drawings (brush, highlighter)
    x: Optional[float] = None
    y: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {}
        if self.time is not None:
            d['time'] = self.time
        if self.bar_index is not None:
            d['bar_index'] = self.bar_index
        d['price'] = self.price
        if self.x is not None:
            d['x'] = self.x
        if self.y is not None:
            d['y'] = self.y
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Point':
        return cls(
            time=d.get('time'),
            bar_index=d.get('bar_index'),
            price=d.get('price', 0.0),
            x=d.get('x'),
            y=d.get('y'),
        )


@dataclass
class DrawingStyle:
    """Visual style for a drawing."""
    color: str = '#f5a623'             # hex color
    line_width: float = 1.0
    line_style: LineStyle = LineStyle.SOLID
    fill_color: Optional[str] = None   # for shapes/channels
    fill_opacity: float = 0.15
    font_size: float = 12.0
    font_family: str = 'Roboto Mono'
    font_weight: str = 'normal'
    text_color: Optional[str] = None
    show_labels: bool = True
    show_price: bool = True
    show_percentage: bool = True
    show_bars_count: bool = False
    extend_left: bool = False
    extend_right: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            'color': self.color,
            'line_width': self.line_width,
            'line_style': self.line_style.value,
            'fill_color': self.fill_color,
            'fill_opacity': self.fill_opacity,
            'font_size': self.font_size,
            'font_family': self.font_family,
            'font_weight': self.font_weight,
            'text_color': self.text_color,
            'show_labels': self.show_labels,
            'show_price': self.show_price,
            'show_percentage': self.show_percentage,
            'show_bars_count': self.show_bars_count,
            'extend_left': self.extend_left,
            'extend_right': self.extend_right,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'DrawingStyle':
        return cls(
            color=d.get('color', '#f5a623'),
            line_width=d.get('line_width', 1.0),
            line_style=LineStyle(d.get('line_style', 'solid')),
            fill_color=d.get('fill_color'),
            fill_opacity=d.get('fill_opacity', 0.15),
            font_size=d.get('font_size', 12.0),
            font_family=d.get('font_family', 'Roboto Mono'),
            font_weight=d.get('font_weight', 'normal'),
            text_color=d.get('text_color'),
            show_labels=d.get('show_labels', True),
            show_price=d.get('show_price', True),
            show_percentage=d.get('show_percentage', True),
            show_bars_count=d.get('show_bars_count', False),
            extend_left=d.get('extend_left', False),
            extend_right=d.get('extend_right', False),
        )


@dataclass
class FibonacciConfig:
    """Configuration for Fibonacci drawings."""
    levels: List[float] = field(default_factory=lambda: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0])
    extension_levels: List[float] = field(default_factory=lambda: [1.0, 1.272, 1.414, 1.618, 2.0, 2.618, 3.618, 4.236])
    colors: Dict[float, str] = field(default_factory=dict)
    show_prices: bool = True
    show_percentages: bool = True
    reverse: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            'levels': self.levels,
            'extension_levels': self.extension_levels,
            'colors': self.colors,
            'show_prices': self.show_prices,
            'show_percentages': self.show_percentages,
            'reverse': self.reverse,
        }


@dataclass
class RiskRewardConfig:
    """Configuration for risk/reward drawings."""
    entry_price: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    quantity: float = 1.0
    account_size: float = 100000.0
    risk_percent: float = 1.0
    commission_per_share: float = 0.0
    show_pnl: bool = True
    show_ratio: bool = True

    @property
    def risk_amount(self) -> float:
        if self.entry_price == 0:
            return 0
        return abs(self.entry_price - self.stop_loss) * self.quantity

    @property
    def reward_amount(self) -> float:
        if self.entry_price == 0:
            return 0
        return abs(self.take_profit - self.entry_price) * self.quantity

    @property
    def risk_reward_ratio(self) -> float:
        r = self.risk_amount
        if r == 0:
            return 0
        return self.reward_amount / r

    @property
    def position_size_by_risk(self) -> float:
        """Max shares based on account_size and risk_percent."""
        max_risk = self.account_size * (self.risk_percent / 100)
        per_share_risk = abs(self.entry_price - self.stop_loss)
        if per_share_risk == 0:
            return 0
        return math.floor(max_risk / per_share_risk)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'entry_price': self.entry_price,
            'stop_loss': self.stop_loss,
            'take_profit': self.take_profit,
            'quantity': self.quantity,
            'account_size': self.account_size,
            'risk_percent': self.risk_percent,
            'commission_per_share': self.commission_per_share,
            'risk_amount': self.risk_amount,
            'reward_amount': self.reward_amount,
            'risk_reward_ratio': self.risk_reward_ratio,
            'position_size_by_risk': self.position_size_by_risk,
        }


@dataclass
class Annotation:
    """A single chart drawing/annotation."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    drawing_type: DrawingType = DrawingType.TREND_LINE
    symbol: str = ''
    timeframe: str = '1D'
    points: List[Point] = field(default_factory=list)
    style: DrawingStyle = field(default_factory=DrawingStyle)
    anchor: AnchorType = AnchorType.TIME_PRICE
    text: str = ''
    # Special configs
    fib_config: Optional[FibonacciConfig] = None
    risk_reward: Optional[RiskRewardConfig] = None
    # Metadata
    visible: bool = True
    locked: bool = False
    layer: int = 0            # z-order
    group_id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    modified_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # Calculated fields (populated by engine)
    computed: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            'id': self.id,
            'drawing_type': self.drawing_type.value,
            'symbol': self.symbol,
            'timeframe': self.timeframe,
            'points': [p.to_dict() for p in self.points],
            'style': self.style.to_dict(),
            'anchor': self.anchor.value,
            'text': self.text,
            'visible': self.visible,
            'locked': self.locked,
            'layer': self.layer,
            'group_id': self.group_id,
            'tags': self.tags,
            'created_at': self.created_at,
            'modified_at': self.modified_at,
            'computed': self.computed,
        }
        if self.fib_config:
            d['fib_config'] = self.fib_config.to_dict()
        if self.risk_reward:
            d['risk_reward'] = self.risk_reward.to_dict()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Annotation':
        fib = FibonacciConfig(**d['fib_config']) if d.get('fib_config') else None
        rr = None
        if d.get('risk_reward'):
            rr_d = {k: v for k, v in d['risk_reward'].items()
                    if k not in ('risk_amount', 'reward_amount', 'risk_reward_ratio', 'position_size_by_risk')}
            rr = RiskRewardConfig(**rr_d)
        return cls(
            id=d.get('id', str(uuid.uuid4())),
            drawing_type=DrawingType(d.get('drawing_type', 'trend_line')),
            symbol=d.get('symbol', ''),
            timeframe=d.get('timeframe', '1D'),
            points=[Point.from_dict(p) for p in d.get('points', [])],
            style=DrawingStyle.from_dict(d.get('style', {})),
            anchor=AnchorType(d.get('anchor', 'time_price')),
            text=d.get('text', ''),
            fib_config=fib,
            risk_reward=rr,
            visible=d.get('visible', True),
            locked=d.get('locked', False),
            layer=d.get('layer', 0),
            group_id=d.get('group_id'),
            tags=d.get('tags', []),
            created_at=d.get('created_at', datetime.now(timezone.utc).isoformat()),
            modified_at=d.get('modified_at', datetime.now(timezone.utc).isoformat()),
        )


@dataclass
class AnnotationGroup:
    """A named group of annotations."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = 'Untitled'
    annotations: List[str] = field(default_factory=list)  # annotation IDs
    visible: bool = True
    locked: bool = False
    color: str = '#f5a623'


# ═══════════════════════════════════════════════════════════════════════════════
#  Geometry Utilities
# ═══════════════════════════════════════════════════════════════════════════════

class GeometryUtils:
    """Static geometry helpers for drawing tools."""

    @staticmethod
    def line_equation(p1: Tuple[float, float], p2: Tuple[float, float]) -> Tuple[float, float, float]:
        """Returns (a, b, c) for ax + by + c = 0."""
        x1, y1 = p1
        x2, y2 = p2
        a = y2 - y1
        b = x1 - x2
        c = x2 * y1 - x1 * y2
        return (a, b, c)

    @staticmethod
    def line_intersection(
        p1: Tuple[float, float], p2: Tuple[float, float],
        p3: Tuple[float, float], p4: Tuple[float, float],
    ) -> Optional[Tuple[float, float]]:
        """Find intersection of two line segments. Returns None if parallel."""
        a1, b1, c1 = GeometryUtils.line_equation(p1, p2)
        a2, b2, c2 = GeometryUtils.line_equation(p3, p4)
        det = a1 * b2 - a2 * b1
        if abs(det) < 1e-12:
            return None
        x = (b1 * c2 - b2 * c1) / det
        y = (a2 * c1 - a1 * c2) / det
        return (x, y)

    @staticmethod
    def point_to_line_distance(
        point: Tuple[float, float],
        line_p1: Tuple[float, float],
        line_p2: Tuple[float, float],
    ) -> float:
        """Perpendicular distance from point to line defined by two points."""
        a, b, c = GeometryUtils.line_equation(line_p1, line_p2)
        denom = math.sqrt(a * a + b * b)
        if denom == 0:
            return 0
        return abs(a * point[0] + b * point[1] + c) / denom

    @staticmethod
    def project_point_onto_line(
        point: Tuple[float, float],
        line_p1: Tuple[float, float],
        line_p2: Tuple[float, float],
    ) -> Tuple[float, float]:
        """Project point onto line, return closest point on line."""
        x0, y0 = point
        x1, y1 = line_p1
        x2, y2 = line_p2
        dx = x2 - x1
        dy = y2 - y1
        d2 = dx * dx + dy * dy
        if d2 == 0:
            return line_p1
        t = ((x0 - x1) * dx + (y0 - y1) * dy) / d2
        return (x1 + t * dx, y1 + t * dy)

    @staticmethod
    def midpoint(p1: Tuple[float, float], p2: Tuple[float, float]) -> Tuple[float, float]:
        return ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)

    @staticmethod
    def distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        return math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)

    @staticmethod
    def angle_degrees(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        """Angle of line from p1 to p2 in degrees."""
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        return math.degrees(math.atan2(dy, dx))

    @staticmethod
    def slope(p1: Tuple[float, float], p2: Tuple[float, float]) -> Optional[float]:
        """Slope of line. Returns None for vertical."""
        dx = p2[0] - p1[0]
        if abs(dx) < 1e-12:
            return None
        return (p2[1] - p1[1]) / dx

    @staticmethod
    def line_at_x(p1: Tuple[float, float], p2: Tuple[float, float], x: float) -> float:
        """Price (y) at given x on the line through p1 and p2."""
        s = GeometryUtils.slope(p1, p2)
        if s is None:
            return p1[1]
        return p1[1] + s * (x - p1[0])

    @staticmethod
    def parallel_line(
        p1: Tuple[float, float], p2: Tuple[float, float], offset: float,
    ) -> Tuple[Tuple[float, float], Tuple[float, float]]:
        """Generate parallel line offset by `offset` units."""
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.sqrt(dx * dx + dy * dy)
        if length == 0:
            return (p1, p2)
        nx = -dy / length * offset
        ny = dx / length * offset
        return ((p1[0] + nx, p1[1] + ny), (p2[0] + nx, p2[1] + ny))

    @staticmethod
    def point_in_rectangle(
        point: Tuple[float, float],
        rect_min: Tuple[float, float],
        rect_max: Tuple[float, float],
    ) -> bool:
        return (rect_min[0] <= point[0] <= rect_max[0] and
                rect_min[1] <= point[1] <= rect_max[1])

    @staticmethod
    def point_in_ellipse(
        point: Tuple[float, float],
        center: Tuple[float, float],
        rx: float, ry: float,
    ) -> bool:
        if rx == 0 or ry == 0:
            return False
        dx = point[0] - center[0]
        dy = point[1] - center[1]
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0

    @staticmethod
    def points_to_polygon_area(points: List[Tuple[float, float]]) -> float:
        """Shoelace formula for polygon area."""
        n = len(points)
        if n < 3:
            return 0
        area = 0.0
        for i in range(n):
            j = (i + 1) % n
            area += points[i][0] * points[j][1]
            area -= points[j][0] * points[i][1]
        return abs(area) / 2.0

    @staticmethod
    def bounding_box(
        points: List[Tuple[float, float]],
    ) -> Tuple[Tuple[float, float], Tuple[float, float]]:
        """(min_x, min_y), (max_x, max_y)."""
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        return ((min(xs), min(ys)), (max(xs), max(ys)))

    @staticmethod
    def circle_points(
        center: Tuple[float, float], radius: float, n_points: int = 64,
    ) -> List[Tuple[float, float]]:
        """Generate points on a circle."""
        pts = []
        for i in range(n_points):
            angle = 2 * math.pi * i / n_points
            pts.append((center[0] + radius * math.cos(angle), center[1] + radius * math.sin(angle)))
        return pts

    @staticmethod
    def arc_points(
        center: Tuple[float, float], radius: float,
        start_angle: float, end_angle: float, n_points: int = 64,
    ) -> List[Tuple[float, float]]:
        """Generate points on an arc (angles in degrees)."""
        pts = []
        sa = math.radians(start_angle)
        ea = math.radians(end_angle)
        for i in range(n_points + 1):
            a = sa + (ea - sa) * i / n_points
            pts.append((center[0] + radius * math.cos(a), center[1] + radius * math.sin(a)))
        return pts


# ═══════════════════════════════════════════════════════════════════════════════
#  Fibonacci Calculator
# ═══════════════════════════════════════════════════════════════════════════════

class FibonacciCalculator:
    """Compute Fibonacci levels, extensions, arcs, fans, time zones, and circles."""

    @staticmethod
    def retracement_levels(
        high: float, low: float, direction: str = 'down',
        levels: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        """Calculate Fib retracement levels between two prices."""
        if levels is None:
            levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
        diff = high - low
        result = []
        for lvl in levels:
            if direction == 'down':
                price = high - diff * lvl
            else:
                price = low + diff * lvl
            result.append({
                'level': lvl,
                'price': round(price, 6),
                'label': f'{lvl * 100:.1f}%',
            })
        return result

    @staticmethod
    def extension_levels(
        point_a: float, point_b: float, point_c: float,
        levels: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        """Calculate Fib extension levels from a 3-point pattern (A-B-C)."""
        if levels is None:
            levels = [0.618, 1.0, 1.272, 1.414, 1.618, 2.0, 2.618, 3.618, 4.236]
        diff = abs(point_a - point_b)
        result = []
        direction = 1 if point_c > point_a else -1
        for lvl in levels:
            price = point_c + direction * diff * lvl
            result.append({
                'level': lvl,
                'price': round(price, 6),
                'label': f'{lvl * 100:.1f}%',
            })
        return result

    @staticmethod
    def fan_lines(
        start_time: float, start_price: float,
        end_time: float, end_price: float,
        levels: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        """Calculate Fibonacci fan lines from two anchor points."""
        if levels is None:
            levels = [0.236, 0.382, 0.5, 0.618, 0.786]
        diff_price = end_price - start_price
        diff_time = end_time - start_time
        result = []
        for lvl in levels:
            fan_end_price = start_price + diff_price * lvl
            result.append({
                'level': lvl,
                'start': {'time': start_time, 'price': start_price},
                'end': {'time': end_time, 'price': fan_end_price},
                'label': f'{lvl * 100:.1f}%',
            })
        return result

    @staticmethod
    def arcs(
        center_time: float, center_price: float,
        end_time: float, end_price: float,
        levels: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        """Calculate Fibonacci arc radii from center to end point."""
        if levels is None:
            levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
        full_radius = math.sqrt(
            (end_time - center_time) ** 2 + (end_price - center_price) ** 2
        )
        result = []
        for lvl in levels:
            result.append({
                'level': lvl,
                'radius': full_radius * lvl,
                'center': {'time': center_time, 'price': center_price},
                'label': f'{lvl * 100:.1f}%',
            })
        return result

    @staticmethod
    def time_zones(
        anchor_time: float, bar_interval_seconds: float = 86400,
        count: int = 20,
    ) -> List[Dict[str, Any]]:
        """Fibonacci time zones from anchor point."""
        fib = [1, 1]
        for _ in range(count - 2):
            fib.append(fib[-1] + fib[-2])
        result = []
        for i, f in enumerate(fib[:count]):
            result.append({
                'index': i,
                'fib_number': f,
                'time': anchor_time + f * bar_interval_seconds,
                'label': f'F{f}',
            })
        return result

    @staticmethod
    def channel_levels(
        p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float],
        levels: Optional[List[float]] = None,
    ) -> Dict[str, Any]:
        """Fib channel: base line (p1-p2), third point (p3) defines width."""
        if levels is None:
            levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
        # p3 is offset from the base line
        dist = GeometryUtils.point_to_line_distance(p3, p1, p2)
        proj = GeometryUtils.project_point_onto_line(p3, p1, p2)
        # Determine which side p3 is on
        cross = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0])
        sign = 1 if cross >= 0 else -1

        lines = []
        for lvl in levels:
            offset = dist * lvl * sign
            lp1, lp2 = GeometryUtils.parallel_line(p1, p2, offset)
            lines.append({
                'level': lvl,
                'p1': {'x': lp1[0], 'y': lp1[1]},
                'p2': {'x': lp2[0], 'y': lp2[1]},
                'label': f'{lvl * 100:.1f}%',
            })
        return {
            'base_line': {'p1': {'x': p1[0], 'y': p1[1]}, 'p2': {'x': p2[0], 'y': p2[1]}},
            'channel_width': dist,
            'lines': lines,
        }

    @staticmethod
    def circles(
        center_time: float, center_price: float,
        end_time: float, end_price: float,
        levels: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        """Fib circles — concentric circles at fib ratios of the base radius."""
        if levels is None:
            levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618]
        base_radius = math.sqrt(
            (end_time - center_time) ** 2 + (end_price - center_price) ** 2
        )
        result = []
        for lvl in levels:
            result.append({
                'level': lvl,
                'radius': base_radius * lvl,
                'center': {'time': center_time, 'price': center_price},
            })
        return result


# ═══════════════════════════════════════════════════════════════════════════════
#  Pitchfork Calculator
# ═══════════════════════════════════════════════════════════════════════════════

class PitchforkCalculator:
    """Andrews' Pitchfork and variants."""

    @staticmethod
    def andrews(
        p0: Tuple[float, float],  # handle
        p1: Tuple[float, float],  # left prong
        p2: Tuple[float, float],  # right prong
    ) -> Dict[str, Any]:
        """Standard Andrews' Pitchfork."""
        mid = GeometryUtils.midpoint(p1, p2)
        median_slope = GeometryUtils.slope(p0, mid)

        return {
            'type': 'andrews',
            'handle': {'x': p0[0], 'y': p0[1]},
            'left_prong': {'x': p1[0], 'y': p1[1]},
            'right_prong': {'x': p2[0], 'y': p2[1]},
            'median': {'start': {'x': p0[0], 'y': p0[1]}, 'end': {'x': mid[0], 'y': mid[1]}},
            'median_slope': median_slope,
            'upper_line': PitchforkCalculator._parallel_from_point(p0, mid, p2),
            'lower_line': PitchforkCalculator._parallel_from_point(p0, mid, p1),
        }

    @staticmethod
    def schiff(
        p0: Tuple[float, float], p1: Tuple[float, float], p2: Tuple[float, float],
    ) -> Dict[str, Any]:
        """Schiff Pitchfork — handle shifted to midpoint of p0-p1."""
        shifted_handle = GeometryUtils.midpoint(p0, p1)
        mid = GeometryUtils.midpoint(p1, p2)
        return {
            'type': 'schiff',
            'handle': {'x': shifted_handle[0], 'y': shifted_handle[1]},
            'left_prong': {'x': p1[0], 'y': p1[1]},
            'right_prong': {'x': p2[0], 'y': p2[1]},
            'median': {'start': {'x': shifted_handle[0], 'y': shifted_handle[1]}, 'end': {'x': mid[0], 'y': mid[1]}},
            'upper_line': PitchforkCalculator._parallel_from_point(shifted_handle, mid, p2),
            'lower_line': PitchforkCalculator._parallel_from_point(shifted_handle, mid, p1),
        }

    @staticmethod
    def modified_schiff(
        p0: Tuple[float, float], p1: Tuple[float, float], p2: Tuple[float, float],
    ) -> Dict[str, Any]:
        """Modified Schiff — handle shifted to midpoint of p0-p2 vertical."""
        shifted_handle = (p0[0], (p0[1] + p1[1]) / 2)
        mid = GeometryUtils.midpoint(p1, p2)
        return {
            'type': 'modified_schiff',
            'handle': {'x': shifted_handle[0], 'y': shifted_handle[1]},
            'left_prong': {'x': p1[0], 'y': p1[1]},
            'right_prong': {'x': p2[0], 'y': p2[1]},
            'median': {'start': {'x': shifted_handle[0], 'y': shifted_handle[1]}, 'end': {'x': mid[0], 'y': mid[1]}},
            'upper_line': PitchforkCalculator._parallel_from_point(shifted_handle, mid, p2),
            'lower_line': PitchforkCalculator._parallel_from_point(shifted_handle, mid, p1),
        }

    @staticmethod
    def inside(
        p0: Tuple[float, float], p1: Tuple[float, float], p2: Tuple[float, float],
    ) -> Dict[str, Any]:
        """Inside Pitchfork — handle shifted to midpoint of p1-p2."""
        mid = GeometryUtils.midpoint(p1, p2)
        shifted_handle = GeometryUtils.midpoint(p0, mid)
        return {
            'type': 'inside',
            'handle': {'x': shifted_handle[0], 'y': shifted_handle[1]},
            'left_prong': {'x': p1[0], 'y': p1[1]},
            'right_prong': {'x': p2[0], 'y': p2[1]},
            'median': {'start': {'x': shifted_handle[0], 'y': shifted_handle[1]}, 'end': {'x': mid[0], 'y': mid[1]}},
            'upper_line': PitchforkCalculator._parallel_from_point(shifted_handle, mid, p2),
            'lower_line': PitchforkCalculator._parallel_from_point(shifted_handle, mid, p1),
        }

    @staticmethod
    def _parallel_from_point(
        median_start: Tuple[float, float], median_end: Tuple[float, float],
        through_point: Tuple[float, float],
    ) -> Dict[str, Any]:
        """Create line through through_point parallel to median."""
        dx = median_end[0] - median_start[0]
        dy = median_end[1] - median_start[1]
        return {
            'start': {'x': through_point[0], 'y': through_point[1]},
            'end': {'x': through_point[0] + dx, 'y': through_point[1] + dy},
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  Gann Calculator
# ═══════════════════════════════════════════════════════════════════════════════

class GannCalculator:
    """Gann Fan, Box, and Square calculations."""

    GANN_ANGLES = {
        '1x8': 1/8, '1x4': 1/4, '1x3': 1/3, '1x2': 1/2,
        '1x1': 1,
        '2x1': 2, '3x1': 3, '4x1': 4, '8x1': 8,
    }

    @staticmethod
    def fan(
        anchor_time: float, anchor_price: float,
        end_time: float, end_price: float,
        price_per_unit: float = 1.0,
    ) -> Dict[str, Any]:
        """Gann Fan lines from anchor point."""
        dt = end_time - anchor_time
        dp = end_price - anchor_price
        direction = 1 if dp >= 0 else -1

        lines = {}
        for name, ratio in GannCalculator.GANN_ANGLES.items():
            fan_price = anchor_price + direction * abs(dt * price_per_unit * ratio)
            lines[name] = {
                'start': {'time': anchor_time, 'price': anchor_price},
                'end': {'time': end_time, 'price': fan_price},
                'ratio': ratio,
            }
        return {
            'anchor': {'time': anchor_time, 'price': anchor_price},
            'lines': lines,
            'direction': 'up' if direction > 0 else 'down',
        }

    @staticmethod
    def box(
        time_start: float, price_start: float,
        time_end: float, price_end: float,
        subdivisions: int = 4,
    ) -> Dict[str, Any]:
        """Gann Box with price and time subdivisions."""
        dt = time_end - time_start
        dp = price_end - price_start
        h_lines = []
        v_lines = []
        for i in range(subdivisions + 1):
            frac = i / subdivisions
            h_lines.append({
                'price': price_start + dp * frac,
                'fraction': frac,
            })
            v_lines.append({
                'time': time_start + dt * frac,
                'fraction': frac,
            })
        diagonals = [
            {'start': {'time': time_start, 'price': price_start}, 'end': {'time': time_end, 'price': price_end}},
            {'start': {'time': time_start, 'price': price_end}, 'end': {'time': time_end, 'price': price_start}},
        ]
        return {
            'bounds': {
                'time_start': time_start, 'time_end': time_end,
                'price_start': price_start, 'price_end': price_end,
            },
            'h_lines': h_lines,
            'v_lines': v_lines,
            'diagonals': diagonals,
        }

    @staticmethod
    def square_of_nine(price: float, levels: int = 5) -> List[Dict[str, float]]:
        """Gann Square of Nine price levels."""
        sqrt_price = math.sqrt(price)
        result = []
        for i in range(-levels, levels + 1):
            level_sqrt = sqrt_price + i * 0.25
            level_price = level_sqrt ** 2
            degrees = (i * 0.25 / sqrt_price) * 360
            result.append({
                'level': i,
                'price': round(level_price, 4),
                'degrees': round(degrees % 360, 2),
            })
        return result


# ═══════════════════════════════════════════════════════════════════════════════
#  Snap Engine
# ═══════════════════════════════════════════════════════════════════════════════

class SnapEngine:
    """Snap drawing points to chart data."""

    @staticmethod
    def snap_to_bar(
        time: float, bars: pd.DataFrame, tolerance_seconds: float = 0,
    ) -> Optional[float]:
        """Find the closest bar time to the given timestamp."""
        if bars.empty or 'time' not in bars.columns:
            return None
        times = bars['time'].values
        idx = np.searchsorted(times, time)
        candidates = []
        if idx > 0:
            candidates.append(times[idx - 1])
        if idx < len(times):
            candidates.append(times[idx])
        if not candidates:
            return None
        closest = min(candidates, key=lambda t: abs(t - time))
        if tolerance_seconds > 0 and abs(closest - time) > tolerance_seconds:
            return None
        return float(closest)

    @staticmethod
    def snap_to_ohlc(
        time: float, price: float, bars: pd.DataFrame,
    ) -> Tuple[float, float]:
        """Snap to nearest OHLC value at the given bar."""
        if bars.empty:
            return (time, price)
        # Find bar at this time
        idx = bars.index[bars['time'] == time]
        if len(idx) == 0:
            snapped_time = SnapEngine.snap_to_bar(time, bars)
            if snapped_time is None:
                return (time, price)
            idx = bars.index[bars['time'] == snapped_time]
            if len(idx) == 0:
                return (time, price)
            time = snapped_time
        row = bars.loc[idx[0]]
        ohlc = [row.get('open', price), row.get('high', price), row.get('low', price), row.get('close', price)]
        closest_price = min(ohlc, key=lambda p: abs(p - price))
        return (time, closest_price)

    @staticmethod
    def snap_to_round(price: float, step: float = 1.0) -> float:
        """Snap price to nearest round number."""
        return round(price / step) * step

    @staticmethod
    def magnetic_snap(
        time: float, price: float,
        bars: pd.DataFrame,
        existing_annotations: List[Annotation],
        snap_distance_price: float = 0.5,
        snap_distance_time: float = 3600,
    ) -> Tuple[float, float]:
        """
        Magnetic snap: try snapping to existing drawing anchor points first,
        then OHLC, then round numbers.
        """
        # 1. Check nearby annotation points
        for ann in existing_annotations:
            for pt in ann.points:
                if pt.time is not None and pt.price:
                    if abs(pt.time - time) < snap_distance_time and abs(pt.price - price) < snap_distance_price:
                        return (pt.time, pt.price)

        # 2. Snap to OHLC
        snapped = SnapEngine.snap_to_ohlc(time, price, bars)
        if abs(snapped[1] - price) < snap_distance_price:
            return snapped

        # 3. Round number snap
        return (time, price)


# ═══════════════════════════════════════════════════════════════════════════════
#  Drawing Analytics
# ═══════════════════════════════════════════════════════════════════════════════

class DrawingAnalytics:
    """Analyze drawing patterns and extract insights."""

    @staticmethod
    def find_price_clusters(
        annotations: List[Annotation], tolerance: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """Find price levels where multiple drawings converge."""
        prices: List[float] = []
        for ann in annotations:
            if ann.drawing_type == DrawingType.HORIZONTAL_LINE:
                if ann.points:
                    prices.append(ann.points[0].price)
            elif ann.drawing_type in (DrawingType.TREND_LINE, DrawingType.RAY, DrawingType.EXTENDED_LINE):
                for pt in ann.points:
                    prices.append(pt.price)
            # Add Fib levels from computed data
            if ann.computed and 'levels' in ann.computed:
                for lvl in ann.computed['levels']:
                    if isinstance(lvl, dict) and 'price' in lvl:
                        prices.append(lvl['price'])

        if not prices:
            return []

        prices.sort()
        clusters: List[Dict[str, Any]] = []
        current_cluster: List[float] = [prices[0]]

        for i in range(1, len(prices)):
            if prices[i] - prices[i - 1] <= tolerance:
                current_cluster.append(prices[i])
            else:
                if len(current_cluster) >= 2:
                    clusters.append({
                        'price': round(np.mean(current_cluster), 4),
                        'count': len(current_cluster),
                        'min': min(current_cluster),
                        'max': max(current_cluster),
                        'strength': len(current_cluster),
                    })
                current_cluster = [prices[i]]
        if len(current_cluster) >= 2:
            clusters.append({
                'price': round(np.mean(current_cluster), 4),
                'count': len(current_cluster),
                'min': min(current_cluster),
                'max': max(current_cluster),
                'strength': len(current_cluster),
            })

        return sorted(clusters, key=lambda c: c['count'], reverse=True)

    @staticmethod
    def trend_line_summary(annotations: List[Annotation]) -> Dict[str, Any]:
        """Summarize trend lines: count bullish / bearish / horizontal."""
        bullish = 0
        bearish = 0
        horizontal = 0
        for ann in annotations:
            if ann.drawing_type not in (DrawingType.TREND_LINE, DrawingType.RAY, DrawingType.EXTENDED_LINE):
                continue
            if len(ann.points) < 2:
                continue
            p1 = ann.points[0]
            p2 = ann.points[1]
            diff = p2.price - p1.price
            if abs(diff) < 0.01:
                horizontal += 1
            elif diff > 0:
                bullish += 1
            else:
                bearish += 1
        total = bullish + bearish + horizontal
        return {
            'total': total,
            'bullish': bullish,
            'bearish': bearish,
            'horizontal': horizontal,
            'bias': 'bullish' if bullish > bearish else 'bearish' if bearish > bullish else 'neutral',
        }

    @staticmethod
    def most_used_drawing_types(annotations: List[Annotation]) -> List[Dict[str, Any]]:
        """Frequency of each drawing type."""
        counts: Dict[str, int] = {}
        for ann in annotations:
            key = ann.drawing_type.value
            counts[key] = counts.get(key, 0) + 1
        return sorted(
            [{'type': k, 'count': v} for k, v in counts.items()],
            key=lambda x: x['count'], reverse=True,
        )

    @staticmethod
    def support_resistance_from_drawings(
        annotations: List[Annotation], current_price: float,
    ) -> Dict[str, List[float]]:
        """Extract support and resistance levels from horizontal lines and fibs."""
        levels: List[float] = []
        for ann in annotations:
            if ann.drawing_type == DrawingType.HORIZONTAL_LINE and ann.points:
                levels.append(ann.points[0].price)
            if ann.computed and 'levels' in ann.computed:
                for lvl in ann.computed['levels']:
                    if isinstance(lvl, dict) and 'price' in lvl:
                        levels.append(lvl['price'])

        support = sorted([p for p in levels if p < current_price], reverse=True)
        resistance = sorted([p for p in levels if p > current_price])
        return {
            'support': support[:10],
            'resistance': resistance[:10],
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  Chart Annotations Engine (main)
# ═══════════════════════════════════════════════════════════════════════════════

class ChartAnnotationsEngine:
    """
    Main engine for managing chart annotations/drawings.

    Features:
     • CRUD operations with in-memory storage
     • Undo/redo stack
     • Computed property enrichment for Fib, Pitchfork, Gann drawings
     • Export/import
     • Analytics
    """

    def __init__(self) -> None:
        self._annotations: Dict[str, Annotation] = {}
        self._groups: Dict[str, AnnotationGroup] = {}
        self._undo_stack: List[Dict[str, Any]] = []
        self._redo_stack: List[Dict[str, Any]] = []
        self._max_undo = 100
        self._fib = FibonacciCalculator()
        self._pitchfork = PitchforkCalculator()
        self._gann = GannCalculator()

    # ── CRUD ────────────────────────────────────────────────────────

    def create(self, annotation: Annotation) -> Annotation:
        """Create a new annotation, compute derived properties, store it."""
        annotation.modified_at = datetime.now(timezone.utc).isoformat()
        self._enrich(annotation)
        self._push_undo('create', annotation.id, None)
        self._annotations[annotation.id] = annotation
        return annotation

    def create_from_dict(self, data: Dict[str, Any]) -> Annotation:
        """Create annotation from raw dict (e.g., API request)."""
        ann = Annotation.from_dict(data)
        return self.create(ann)

    def get(self, annotation_id: str) -> Optional[Annotation]:
        return self._annotations.get(annotation_id)

    def get_all(
        self, symbol: Optional[str] = None, timeframe: Optional[str] = None,
        drawing_type: Optional[DrawingType] = None,
        tags: Optional[List[str]] = None,
        visible_only: bool = False,
    ) -> List[Annotation]:
        """List annotations with optional filters."""
        result = list(self._annotations.values())
        if symbol:
            result = [a for a in result if a.symbol == symbol]
        if timeframe:
            result = [a for a in result if a.timeframe == timeframe]
        if drawing_type:
            result = [a for a in result if a.drawing_type == drawing_type]
        if tags:
            tag_set = set(tags)
            result = [a for a in result if tag_set.issubset(set(a.tags))]
        if visible_only:
            result = [a for a in result if a.visible]
        return sorted(result, key=lambda a: a.layer)

    def update(self, annotation_id: str, updates: Dict[str, Any]) -> Optional[Annotation]:
        """Partially update an annotation."""
        ann = self._annotations.get(annotation_id)
        if not ann:
            return None
        self._push_undo('update', annotation_id, ann.to_dict())
        for key, val in updates.items():
            if key == 'points':
                ann.points = [Point.from_dict(p) if isinstance(p, dict) else p for p in val]
            elif key == 'style':
                ann.style = DrawingStyle.from_dict(val) if isinstance(val, dict) else val
            elif key == 'fib_config':
                ann.fib_config = FibonacciConfig(**val) if isinstance(val, dict) else val
            elif key == 'risk_reward':
                ann.risk_reward = RiskRewardConfig(**val) if isinstance(val, dict) else val
            elif hasattr(ann, key):
                setattr(ann, key, val)
        ann.modified_at = datetime.now(timezone.utc).isoformat()
        self._enrich(ann)
        return ann

    def delete(self, annotation_id: str) -> bool:
        """Delete annotation. Returns True if found and deleted."""
        ann = self._annotations.pop(annotation_id, None)
        if ann:
            self._push_undo('delete', annotation_id, ann.to_dict())
            return True
        return False

    def delete_all(self, symbol: Optional[str] = None) -> int:
        """Clear all annotations, optionally for a specific symbol."""
        if symbol:
            to_del = [aid for aid, a in self._annotations.items() if a.symbol == symbol]
        else:
            to_del = list(self._annotations.keys())
        for aid in to_del:
            ann = self._annotations.pop(aid)
            self._push_undo('delete', aid, ann.to_dict())
        return len(to_del)

    def duplicate(self, annotation_id: str) -> Optional[Annotation]:
        """Duplicate an annotation with a new ID."""
        ann = self._annotations.get(annotation_id)
        if not ann:
            return None
        dup = deepcopy(ann)
        dup.id = str(uuid.uuid4())
        dup.created_at = datetime.now(timezone.utc).isoformat()
        dup.modified_at = dup.created_at
        dup.layer = ann.layer + 1
        return self.create(dup)

    # ── Undo / Redo ─────────────────────────────────────────────────

    def undo(self) -> Optional[Dict[str, Any]]:
        if not self._undo_stack:
            return None
        action = self._undo_stack.pop()
        # Capture current state before reversing so redo can replay forward
        aid = action['id']
        current = self._annotations.get(aid)
        redo_action = {
            'op': action['op'],
            'id': aid,
            'prev_state': current.to_dict() if current else action.get('prev_state'),
        }
        self._redo_stack.append(redo_action)
        self._apply_action(action, reverse=True)
        return action

    def redo(self) -> Optional[Dict[str, Any]]:
        if not self._redo_stack:
            return None
        action = self._redo_stack.pop()
        # Capture current state before applying so undo can reverse
        aid = action['id']
        current = self._annotations.get(aid)
        undo_action = {
            'op': action['op'],
            'id': aid,
            'prev_state': current.to_dict() if current else action.get('prev_state'),
        }
        self._undo_stack.append(undo_action)
        self._apply_action(action, reverse=False)
        return action

    def _push_undo(self, op: str, annotation_id: str, prev_state: Optional[Dict]) -> None:
        self._undo_stack.append({
            'op': op,
            'id': annotation_id,
            'prev_state': prev_state,
        })
        if len(self._undo_stack) > self._max_undo:
            self._undo_stack.pop(0)
        self._redo_stack.clear()

    def _apply_action(self, action: Dict[str, Any], reverse: bool) -> None:
        op = action['op']
        aid = action['id']
        prev = action.get('prev_state')
        if reverse:
            if op == 'create':
                self._annotations.pop(aid, None)
            elif op == 'delete' and prev:
                self._annotations[aid] = Annotation.from_dict(prev)
            elif op == 'update' and prev:
                self._annotations[aid] = Annotation.from_dict(prev)
        else:
            if op == 'delete':
                self._annotations.pop(aid, None)
            elif op == 'create' and prev:
                self._annotations[aid] = Annotation.from_dict(prev)
            elif op == 'update' and prev:
                self._annotations[aid] = Annotation.from_dict(prev)

    def _inverse_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Create the inverse action for redo."""
        op = action['op']
        aid = action['id']
        current = self._annotations.get(aid)
        return {
            'op': 'delete' if op == 'create' else 'create' if op == 'delete' else 'update',
            'id': aid,
            'prev_state': current.to_dict() if current else action.get('prev_state'),
        }

    # ── Groups ──────────────────────────────────────────────────────

    def create_group(self, name: str, annotation_ids: Optional[List[str]] = None) -> AnnotationGroup:
        grp = AnnotationGroup(name=name, annotations=annotation_ids or [])
        self._groups[grp.id] = grp
        for aid in grp.annotations:
            ann = self._annotations.get(aid)
            if ann:
                ann.group_id = grp.id
        return grp

    def get_group(self, group_id: str) -> Optional[AnnotationGroup]:
        return self._groups.get(group_id)

    def add_to_group(self, group_id: str, annotation_id: str) -> bool:
        grp = self._groups.get(group_id)
        ann = self._annotations.get(annotation_id)
        if not grp or not ann:
            return False
        if annotation_id not in grp.annotations:
            grp.annotations.append(annotation_id)
        ann.group_id = group_id
        return True

    def remove_from_group(self, group_id: str, annotation_id: str) -> bool:
        grp = self._groups.get(group_id)
        ann = self._annotations.get(annotation_id)
        if not grp:
            return False
        if annotation_id in grp.annotations:
            grp.annotations.remove(annotation_id)
        if ann and ann.group_id == group_id:
            ann.group_id = None
        return True

    def toggle_group_visibility(self, group_id: str) -> bool:
        grp = self._groups.get(group_id)
        if not grp:
            return False
        grp.visible = not grp.visible
        for aid in grp.annotations:
            ann = self._annotations.get(aid)
            if ann:
                ann.visible = grp.visible
        return True

    # ── Enrichment (computed properties) ────────────────────────────

    def _enrich(self, ann: Annotation) -> None:
        """Compute derived properties based on drawing type."""
        dt = ann.drawing_type
        pts = ann.points

        if dt == DrawingType.TREND_LINE and len(pts) >= 2:
            ann.computed = self._compute_trend_line(pts)
        elif dt in (DrawingType.RAY, DrawingType.EXTENDED_LINE) and len(pts) >= 2:
            ann.computed = self._compute_ray(pts, extended=(dt == DrawingType.EXTENDED_LINE))
        elif dt == DrawingType.HORIZONTAL_LINE and len(pts) >= 1:
            ann.computed = {'price': pts[0].price}
        elif dt == DrawingType.VERTICAL_LINE and len(pts) >= 1:
            ann.computed = {'time': pts[0].time}
        elif dt == DrawingType.FIB_RETRACEMENT and len(pts) >= 2:
            cfg = ann.fib_config or FibonacciConfig()
            ann.computed = {
                'levels': self._fib.retracement_levels(
                    max(pts[0].price, pts[1].price),
                    min(pts[0].price, pts[1].price),
                    direction='down' if pts[0].price > pts[1].price else 'up',
                    levels=cfg.levels,
                ),
            }
        elif dt == DrawingType.FIB_EXTENSION and len(pts) >= 3:
            cfg = ann.fib_config or FibonacciConfig()
            ann.computed = {
                'levels': self._fib.extension_levels(
                    pts[0].price, pts[1].price, pts[2].price,
                    levels=cfg.extension_levels,
                ),
            }
        elif dt == DrawingType.FIB_FAN and len(pts) >= 2:
            ann.computed = {
                'lines': self._fib.fan_lines(
                    pts[0].time or 0, pts[0].price, pts[1].time or 0, pts[1].price,
                ),
            }
        elif dt == DrawingType.FIB_ARCS and len(pts) >= 2:
            cfg = ann.fib_config or FibonacciConfig()
            ann.computed = {
                'arcs': self._fib.arcs(
                    pts[0].time or 0, pts[0].price,
                    pts[1].time or 0, pts[1].price,
                    levels=cfg.levels,
                ),
            }
        elif dt == DrawingType.FIB_CHANNEL and len(pts) >= 3:
            ann.computed = self._fib.channel_levels(
                (pts[0].time or 0, pts[0].price),
                (pts[1].time or 0, pts[1].price),
                (pts[2].time or 0, pts[2].price),
            )
        elif dt == DrawingType.FIB_TIME_ZONES and len(pts) >= 1:
            ann.computed = {
                'zones': self._fib.time_zones(pts[0].time or 0),
            }
        elif dt == DrawingType.ANDREWS_PITCHFORK and len(pts) >= 3:
            ann.computed = self._pitchfork.andrews(
                (pts[0].time or 0, pts[0].price),
                (pts[1].time or 0, pts[1].price),
                (pts[2].time or 0, pts[2].price),
            )
        elif dt == DrawingType.SCHIFF_PITCHFORK and len(pts) >= 3:
            ann.computed = self._pitchfork.schiff(
                (pts[0].time or 0, pts[0].price),
                (pts[1].time or 0, pts[1].price),
                (pts[2].time or 0, pts[2].price),
            )
        elif dt == DrawingType.MOD_SCHIFF_PITCHFORK and len(pts) >= 3:
            ann.computed = self._pitchfork.modified_schiff(
                (pts[0].time or 0, pts[0].price),
                (pts[1].time or 0, pts[1].price),
                (pts[2].time or 0, pts[2].price),
            )
        elif dt == DrawingType.INSIDE_PITCHFORK and len(pts) >= 3:
            ann.computed = self._pitchfork.inside(
                (pts[0].time or 0, pts[0].price),
                (pts[1].time or 0, pts[1].price),
                (pts[2].time or 0, pts[2].price),
            )
        elif dt == DrawingType.GANN_FAN and len(pts) >= 2:
            ann.computed = self._gann.fan(
                pts[0].time or 0, pts[0].price,
                pts[1].time or 0, pts[1].price,
            )
        elif dt == DrawingType.GANN_BOX and len(pts) >= 2:
            ann.computed = self._gann.box(
                pts[0].time or 0, pts[0].price,
                pts[1].time or 0, pts[1].price,
            )
        elif dt == DrawingType.PARALLEL_CHANNEL and len(pts) >= 3:
            ann.computed = self._compute_parallel_channel(pts)
        elif dt == DrawingType.RISK_REWARD and ann.risk_reward:
            ann.computed = ann.risk_reward.to_dict()
        elif dt == DrawingType.LONG_POSITION and ann.risk_reward:
            ann.computed = ann.risk_reward.to_dict()
        elif dt == DrawingType.SHORT_POSITION and ann.risk_reward:
            ann.computed = ann.risk_reward.to_dict()
        elif dt == DrawingType.RECTANGLE and len(pts) >= 2:
            ann.computed = self._compute_rectangle(pts)
        elif dt == DrawingType.ELLIPSE and len(pts) >= 2:
            ann.computed = self._compute_ellipse(pts)
        elif dt in (DrawingType.PRICE_RANGE, DrawingType.DATE_PRICE_RANGE) and len(pts) >= 2:
            ann.computed = self._compute_price_range(pts)

    def _compute_trend_line(self, pts: List[Point]) -> Dict[str, Any]:
        """Compute trend line metrics."""
        p1, p2 = pts[0], pts[1]
        t1 = p1.time or p1.bar_index or 0
        t2 = p2.time or p2.bar_index or 0
        dp = p2.price - p1.price
        dt = t2 - t1 if t2 != t1 else 1
        return {
            'slope': dp / dt,
            'angle': math.degrees(math.atan2(dp, dt)),
            'length_price': abs(dp),
            'length_time': abs(dt),
            'direction': 'up' if dp > 0 else 'down' if dp < 0 else 'horizontal',
            'midpoint': {'time': (t1 + t2) / 2, 'price': (p1.price + p2.price) / 2},
        }

    def _compute_ray(self, pts: List[Point], extended: bool = False) -> Dict[str, Any]:
        """Compute ray or extended line properties."""
        base = self._compute_trend_line(pts)
        base['ray'] = True
        base['extended_both'] = extended
        return base

    def _compute_parallel_channel(self, pts: List[Point]) -> Dict[str, Any]:
        """Compute parallel channel from 3 points."""
        p1 = (pts[0].time or 0, pts[0].price)
        p2 = (pts[1].time or 0, pts[1].price)
        p3 = (pts[2].time or 0, pts[2].price)
        width = GeometryUtils.point_to_line_distance(p3, p1, p2)
        slope = GeometryUtils.slope(p1, p2)
        return {
            'width': width,
            'slope': slope,
            'base_line': {'p1': {'time': p1[0], 'price': p1[1]}, 'p2': {'time': p2[0], 'price': p2[1]}},
            'parallel_line': GeometryUtils.parallel_line(p1, p2, width),
        }

    def _compute_rectangle(self, pts: List[Point]) -> Dict[str, Any]:
        p1, p2 = pts[0], pts[1]
        t1 = p1.time or p1.bar_index or 0
        t2 = p2.time or p2.bar_index or 0
        return {
            'min_time': min(t1, t2),
            'max_time': max(t1, t2),
            'min_price': min(p1.price, p2.price),
            'max_price': max(p1.price, p2.price),
            'width': abs(t2 - t1),
            'height': abs(p2.price - p1.price),
        }

    def _compute_ellipse(self, pts: List[Point]) -> Dict[str, Any]:
        p1, p2 = pts[0], pts[1]
        t1 = p1.time or 0
        t2 = p2.time or 0
        return {
            'center_time': (t1 + t2) / 2,
            'center_price': (p1.price + p2.price) / 2,
            'radius_time': abs(t2 - t1) / 2,
            'radius_price': abs(p2.price - p1.price) / 2,
        }

    def _compute_price_range(self, pts: List[Point]) -> Dict[str, Any]:
        p1, p2 = pts[0], pts[1]
        diff = p2.price - p1.price
        pct = (diff / p1.price * 100) if p1.price != 0 else 0
        bars_count = 0
        if p1.bar_index is not None and p2.bar_index is not None:
            bars_count = abs(p2.bar_index - p1.bar_index)
        return {
            'price_diff': round(diff, 6),
            'percent_change': round(pct, 4),
            'bars_count': bars_count,
            'start_price': p1.price,
            'end_price': p2.price,
        }

    # ── Export / Import ─────────────────────────────────────────────

    def export_json(self, symbol: Optional[str] = None) -> str:
        """Export all annotations as JSON."""
        anns = self.get_all(symbol=symbol)
        return json.dumps([a.to_dict() for a in anns], indent=2)

    def import_json(self, json_str: str) -> int:
        """Import annotations from JSON. Returns count imported."""
        data = json.loads(json_str)
        count = 0
        for item in data:
            self.create_from_dict(item)
            count += 1
        return count

    def export_pine_script(self, symbol: Optional[str] = None) -> str:
        """Export horizontal lines and trend lines as Pine Script v5."""
        anns = self.get_all(symbol=symbol)
        lines: List[str] = [
            '//@version=5',
            'indicator("Imported Drawings", overlay=true)',
            '',
        ]
        for ann in anns:
            if ann.drawing_type == DrawingType.HORIZONTAL_LINE and ann.points:
                p = ann.points[0].price
                color = ann.style.color
                lines.append(f'hline({p}, title="{ann.text or "H-Line"}", color=color.new(color.{_pine_color(color)}, 0), linestyle=hline.style_solid)')
            elif ann.drawing_type == DrawingType.TREND_LINE and len(ann.points) >= 2:
                p1, p2 = ann.points[0], ann.points[1]
                bar1 = p1.bar_index or 0
                bar2 = p2.bar_index or 0
                color = ann.style.color
                lines.append(
                    f'line.new(bar_index[{bar1}], {p1.price}, bar_index[{bar2}], {p2.price}, '
                    f'color=color.{_pine_color(color)}, width={int(ann.style.line_width)})'
                )
        return '\n'.join(lines)

    # ── Analytics ───────────────────────────────────────────────────

    def price_clusters(self, tolerance: float = 0.5) -> List[Dict[str, Any]]:
        return DrawingAnalytics.find_price_clusters(list(self._annotations.values()), tolerance)

    def trend_summary(self) -> Dict[str, Any]:
        return DrawingAnalytics.trend_line_summary(list(self._annotations.values()))

    def drawing_type_stats(self) -> List[Dict[str, Any]]:
        return DrawingAnalytics.most_used_drawing_types(list(self._annotations.values()))

    def support_resistance(self, current_price: float) -> Dict[str, List[float]]:
        return DrawingAnalytics.support_resistance_from_drawings(
            list(self._annotations.values()), current_price,
        )

    # ── Stats ───────────────────────────────────────────────────────

    @property
    def count(self) -> int:
        return len(self._annotations)

    @property
    def undo_count(self) -> int:
        return len(self._undo_stack)

    @property
    def redo_count(self) -> int:
        return len(self._redo_stack)


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _pine_color(hex_color: str) -> str:
    """Map hex color to Pine Script color name (best effort)."""
    c = hex_color.lower().lstrip('#')
    color_map = {
        'f5a623': 'orange', 'ff7043': 'orange',
        'ef5350': 'red', 'e53935': 'red',
        '26a69a': 'teal', '4caf50': 'green', '66bb6a': 'green',
        '42a5f5': 'blue', '2962ff': 'blue', '29b6f6': 'aqua',
        '7e57c2': 'purple', 'ab47bc': 'purple',
        'ec407a': 'fuchsia',
        'f9a825': 'yellow',
        'ffffff': 'white', '888888': 'gray', '000000': 'black',
    }
    return color_map.get(c, 'white')
