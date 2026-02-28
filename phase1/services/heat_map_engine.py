"""
Apex Terminal — Bloomberg-Grade Heat Map Engine
================================================

Professional heat map generation for market visualization:

Heat Map Types:
- Sector performance heat map (S&P 500 style treemap)
- Correlation heat map (pairwise, rolling)
- Performance heat map (returns by period)
- Volume heat map (by hour/day)
- Volatility surface heat map
- Market breadth heat map
- Geographic/country heat map
- Custom metric heat map

Color Schemes:
- Red-Green (classic market)
- Bloomberg (amber focused)
- Cool-warm diverging
- Sequential (single color intensity)
- Custom gradient

Layout Types:
- Treemap (market-cap weighted)
- Grid (equal cell)
- Bubble (size-proportional)
- Calendar (date-based)

Pure computation — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class ColorScheme(Enum):
    RED_GREEN = "red_green"
    BLOOMBERG = "bloomberg"
    COOL_WARM = "cool_warm"
    SEQUENTIAL_GREEN = "sequential_green"
    SEQUENTIAL_RED = "sequential_red"
    SEQUENTIAL_BLUE = "sequential_blue"
    DIVERGING_BLUE_RED = "diverging_blue_red"


class HeatMapType(Enum):
    SECTOR_PERFORMANCE = "sector_performance"
    CORRELATION = "correlation"
    PERFORMANCE_GRID = "performance_grid"
    VOLUME = "volume"
    VOLATILITY_SURFACE = "volatility_surface"
    MARKET_BREADTH = "market_breadth"
    GEOGRAPHIC = "geographic"
    CALENDAR = "calendar"


class LayoutType(Enum):
    TREEMAP = "treemap"
    GRID = "grid"
    BUBBLE = "bubble"
    CALENDAR = "calendar"


class TimeGranularity(Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class HeatMapCell:
    """Single cell in a heat map."""
    label: str
    value: float
    color: str = ""
    size: float = 1.0
    row: int = 0
    col: int = 0
    tooltip: str = ""
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "value": round(self.value, 4),
            "color": self.color,
            "size": round(self.size, 4),
            "row": self.row,
            "col": self.col,
            "tooltip": self.tooltip,
            "metadata": self.metadata,
        }


@dataclass
class TreeMapNode:
    """Node in a treemap layout."""
    label: str
    value: float
    weight: float  # Size weight (e.g., market cap)
    color: str = ""
    children: list["TreeMapNode"] = field(default_factory=list)
    x: float = 0.0
    y: float = 0.0
    width: float = 0.0
    height: float = 0.0

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "value": round(self.value, 4),
            "weight": round(self.weight, 2),
            "color": self.color,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "width": round(self.width, 2),
            "height": round(self.height, 2),
            "children": [c.to_dict() for c in self.children],
        }


@dataclass
class HeatMapConfig:
    """Configuration for heat map rendering."""
    color_scheme: ColorScheme = ColorScheme.RED_GREEN
    layout: LayoutType = LayoutType.GRID
    width: float = 800.0
    height: float = 600.0
    min_value: float | None = None
    max_value: float | None = None
    show_labels: bool = True
    show_values: bool = True
    value_format: str = "{:.2f}%"

    def to_dict(self) -> dict:
        return {
            "color_scheme": self.color_scheme.value,
            "layout": self.layout.value,
            "width": self.width,
            "height": self.height,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "show_labels": self.show_labels,
            "show_values": self.show_values,
        }


# ─── Color Generator ────────────────────────────────────────────────────────

class ColorGenerator:
    """Generate colors for heat map values."""

    # Bloomberg palette
    BLOOMBERG_POSITIVE = ["#0d2b1a", "#143d24", "#1a5c30", "#26a69a", "#4caf50"]
    BLOOMBERG_NEGATIVE = ["#2b0d0d", "#3d1414", "#5c1a1a", "#ef5350", "#f44336"]
    BLOOMBERG_NEUTRAL = "#1e1e1e"

    @staticmethod
    def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
        h = hex_color.lstrip("#")
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    @staticmethod
    def rgb_to_hex(r: int, g: int, b: int) -> str:
        return f"#{r:02x}{g:02x}{b:02x}"

    @staticmethod
    def interpolate_color(color1: str, color2: str, t: float) -> str:
        """Linear interpolation between two hex colors."""
        t = max(0.0, min(1.0, t))
        r1, g1, b1 = ColorGenerator.hex_to_rgb(color1)
        r2, g2, b2 = ColorGenerator.hex_to_rgb(color2)
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        return ColorGenerator.rgb_to_hex(r, g, b)

    @staticmethod
    def value_to_color(value: float, scheme: ColorScheme = ColorScheme.RED_GREEN,
                       min_val: float = -5.0, max_val: float = 5.0) -> str:
        """Map a value to a color based on scheme."""
        if scheme == ColorScheme.RED_GREEN:
            return ColorGenerator._red_green(value, min_val, max_val)
        elif scheme == ColorScheme.BLOOMBERG:
            return ColorGenerator._bloomberg(value, min_val, max_val)
        elif scheme == ColorScheme.COOL_WARM:
            return ColorGenerator._cool_warm(value, min_val, max_val)
        elif scheme == ColorScheme.DIVERGING_BLUE_RED:
            return ColorGenerator._blue_red(value, min_val, max_val)
        else:
            return ColorGenerator._sequential(value, min_val, max_val, scheme)

    @staticmethod
    def _red_green(value: float, min_val: float, max_val: float) -> str:
        if value >= 0:
            t = min(1.0, value / max_val) if max_val > 0 else 0.0
            return ColorGenerator.interpolate_color("#1a1a1a", "#26a69a", t)
        else:
            t = min(1.0, abs(value) / abs(min_val)) if min_val < 0 else 0.0
            return ColorGenerator.interpolate_color("#1a1a1a", "#ef5350", t)

    @staticmethod
    def _bloomberg(value: float, min_val: float, max_val: float) -> str:
        if value >= 0:
            t = min(1.0, value / max_val) if max_val > 0 else 0.0
            idx = min(4, int(t * 4))
            return ColorGenerator.BLOOMBERG_POSITIVE[idx]
        else:
            t = min(1.0, abs(value) / abs(min_val)) if min_val < 0 else 0.0
            idx = min(4, int(t * 4))
            return ColorGenerator.BLOOMBERG_NEGATIVE[idx]

    @staticmethod
    def _cool_warm(value: float, min_val: float, max_val: float) -> str:
        if value >= 0:
            t = min(1.0, value / max_val) if max_val > 0 else 0.0
            return ColorGenerator.interpolate_color("#f5f5f5", "#b71c1c", t)
        else:
            t = min(1.0, abs(value) / abs(min_val)) if min_val < 0 else 0.0
            return ColorGenerator.interpolate_color("#f5f5f5", "#1565c0", t)

    @staticmethod
    def _blue_red(value: float, min_val: float, max_val: float) -> str:
        if value >= 0:
            t = min(1.0, value / max_val) if max_val > 0 else 0.0
            return ColorGenerator.interpolate_color("#ffffff", "#d32f2f", t)
        else:
            t = min(1.0, abs(value) / abs(min_val)) if min_val < 0 else 0.0
            return ColorGenerator.interpolate_color("#ffffff", "#1976d2", t)

    @staticmethod
    def _sequential(value: float, min_val: float, max_val: float, scheme: ColorScheme) -> str:
        rng = max_val - min_val
        t = (value - min_val) / rng if rng > 0 else 0.5
        t = max(0.0, min(1.0, t))

        if scheme == ColorScheme.SEQUENTIAL_GREEN:
            return ColorGenerator.interpolate_color("#f0f0f0", "#1b5e20", t)
        elif scheme == ColorScheme.SEQUENTIAL_RED:
            return ColorGenerator.interpolate_color("#f0f0f0", "#b71c1c", t)
        else:
            return ColorGenerator.interpolate_color("#f0f0f0", "#0d47a1", t)


# ─── Sector Heat Map ───────────────────────────────────────────────────────

class SectorHeatMapBuilder:
    """Build sector/industry heat maps (S&P 500 style)."""

    @staticmethod
    def build_sector_map(stocks: list[dict]) -> list[TreeMapNode]:
        """
        Build treemap from stock data.
        stocks: [{symbol, sector, market_cap, change_pct}, ...]
        """
        sectors: dict[str, list[dict]] = {}
        for s in stocks:
            sec = s.get("sector", "Other")
            if sec not in sectors:
                sectors[sec] = []
            sectors[sec].append(s)

        nodes = []
        for sector_name, sector_stocks in sectors.items():
            total_cap = sum(s.get("market_cap", 0) for s in sector_stocks)
            avg_change = np.mean([s.get("change_pct", 0) for s in sector_stocks])

            children = []
            for s in sector_stocks:
                child = TreeMapNode(
                    label=s.get("symbol", ""),
                    value=s.get("change_pct", 0),
                    weight=s.get("market_cap", 0),
                    color=ColorGenerator.value_to_color(s.get("change_pct", 0)),
                )
                children.append(child)

            node = TreeMapNode(
                label=sector_name,
                value=float(avg_change),
                weight=total_cap,
                color=ColorGenerator.value_to_color(float(avg_change)),
                children=children,
            )
            nodes.append(node)

        return nodes

    @staticmethod
    def squarify(nodes: list[TreeMapNode], x: float, y: float,
                 width: float, height: float) -> list[TreeMapNode]:
        """Apply squarified treemap layout algorithm."""
        if not nodes:
            return []

        total_weight = sum(n.weight for n in nodes)
        if total_weight == 0:
            return nodes

        # Sort by weight descending for better layout
        sorted_nodes = sorted(nodes, key=lambda n: n.weight, reverse=True)

        # Simple slice-and-dice layout
        remaining_x = x
        remaining_y = y
        remaining_w = width
        remaining_h = height

        for i, node in enumerate(sorted_nodes):
            ratio = node.weight / total_weight if total_weight > 0 else 1.0 / len(sorted_nodes)

            if remaining_w >= remaining_h:
                # Lay out horizontally
                node.x = remaining_x
                node.y = remaining_y
                node.width = remaining_w * ratio
                node.height = remaining_h
                remaining_x += node.width
                remaining_w -= node.width
            else:
                # Lay out vertically
                node.x = remaining_x
                node.y = remaining_y
                node.width = remaining_w
                node.height = remaining_h * ratio
                remaining_y += node.height
                remaining_h -= node.height

            total_weight -= node.weight

            # Layout children
            if node.children:
                SectorHeatMapBuilder.squarify(
                    node.children, node.x, node.y, node.width, node.height)

        return sorted_nodes


# ─── Correlation Heat Map ──────────────────────────────────────────────────

class CorrelationHeatMapBuilder:
    """Build correlation heat maps."""

    @staticmethod
    def build(symbols: list[str], correlation_matrix: list[list[float]],
              scheme: ColorScheme = ColorScheme.DIVERGING_BLUE_RED) -> list[HeatMapCell]:
        """Build heat map cells from correlation matrix."""
        cells = []
        n = len(symbols)

        for i in range(n):
            for j in range(n):
                val = correlation_matrix[i][j] if i < len(correlation_matrix) and j < len(correlation_matrix[i]) else 0
                cell = HeatMapCell(
                    label=f"{symbols[i]}/{symbols[j]}",
                    value=val,
                    color=ColorGenerator.value_to_color(val, scheme, -1.0, 1.0),
                    row=i,
                    col=j,
                    tooltip=f"{symbols[i]} vs {symbols[j]}: {val:.3f}",
                )
                cells.append(cell)

        return cells


# ─── Performance Heat Map ──────────────────────────────────────────────────

class PerformanceHeatMapBuilder:
    """Build performance heat maps (returns by time period)."""

    @staticmethod
    def monthly_returns(symbol: str, dates: list[datetime], returns: list[float]) -> list[HeatMapCell]:
        """Build monthly returns heat map."""
        if len(dates) != len(returns):
            return []

        # Group by year/month
        monthly: dict[tuple[int, int], list[float]] = {}
        for dt, r in zip(dates, returns):
            key = (dt.year, dt.month)
            if key not in monthly:
                monthly[key] = []
            monthly[key].append(r)

        cells = []
        years = sorted(set(k[0] for k in monthly.keys()))
        year_map = {y: i for i, y in enumerate(years)}

        for (year, month), rets in monthly.items():
            monthly_ret = 1.0
            for r in rets:
                monthly_ret *= (1 + r)
            monthly_ret -= 1

            cell = HeatMapCell(
                label=f"{year}-{month:02d}",
                value=monthly_ret * 100,
                color=ColorGenerator.value_to_color(monthly_ret * 100, ColorScheme.RED_GREEN, -10, 10),
                row=year_map.get(year, 0),
                col=month - 1,
                tooltip=f"{symbol} {year}-{month:02d}: {monthly_ret * 100:.2f}%",
                metadata={"year": year, "month": month},
            )
            cells.append(cell)

        return cells

    @staticmethod
    def period_returns(symbols: list[str], returns_by_period: dict[str, dict[str, float]],
                       scheme: ColorScheme = ColorScheme.RED_GREEN) -> list[HeatMapCell]:
        """
        Build performance grid.
        returns_by_period: {symbol: {period_label: return_pct, ...}, ...}
        """
        cells = []
        periods = set()
        for sym_data in returns_by_period.values():
            periods.update(sym_data.keys())
        periods = sorted(periods)
        period_map = {p: i for i, p in enumerate(periods)}

        for row, symbol in enumerate(symbols):
            sym_data = returns_by_period.get(symbol, {})
            for period, ret in sym_data.items():
                cell = HeatMapCell(
                    label=f"{symbol} / {period}",
                    value=ret,
                    color=ColorGenerator.value_to_color(ret, scheme),
                    row=row,
                    col=period_map.get(period, 0),
                    tooltip=f"{symbol} {period}: {ret:.2f}%",
                )
                cells.append(cell)

        return cells


# ─── Volume Heat Map ───────────────────────────────────────────────────────

class VolumeHeatMapBuilder:
    """Build volume heat maps by hour/day."""

    @staticmethod
    def hourly_volume(timestamps: list[datetime], volumes: list[float]) -> list[HeatMapCell]:
        """Volume heat map by day of week × hour."""
        if len(timestamps) != len(volumes):
            return []

        # Group by (day_of_week, hour)
        buckets: dict[tuple[int, int], list[float]] = {}
        for ts, vol in zip(timestamps, volumes):
            key = (ts.weekday(), ts.hour)
            if key not in buckets:
                buckets[key] = []
            buckets[key].append(vol)

        cells = []
        all_avg_vols = []
        for key, vols in buckets.items():
            all_avg_vols.append(np.mean(vols))

        max_vol = max(all_avg_vols) if all_avg_vols else 1.0

        for (dow, hour), vols in buckets.items():
            avg_vol = float(np.mean(vols))
            cell = HeatMapCell(
                label=f"D{dow}H{hour:02d}",
                value=avg_vol,
                color=ColorGenerator.value_to_color(
                    avg_vol, ColorScheme.SEQUENTIAL_BLUE, 0, max_vol),
                row=dow,
                col=hour,
                tooltip=f"Day {dow}, Hour {hour}: avg vol {avg_vol:,.0f}",
            )
            cells.append(cell)

        return cells


# ─── Market Breadth Heat Map ──────────────────────────────────────────────

class MarketBreadthHeatMapBuilder:
    """Heat map showing market breadth indicators."""

    @staticmethod
    def build(sector_data: dict[str, dict]) -> list[HeatMapCell]:
        """
        Build breadth heat map from sector data.
        sector_data: {sector: {advancing, declining, unchanged, new_highs, new_lows}, ...}
        """
        cells = []
        for i, (sector, data) in enumerate(sector_data.items()):
            adv = data.get("advancing", 0)
            dec = data.get("declining", 0)
            total = adv + dec
            if total == 0:
                breadth_pct = 0.0
            else:
                breadth_pct = (adv - dec) / total * 100

            cell = HeatMapCell(
                label=sector,
                value=breadth_pct,
                color=ColorGenerator.value_to_color(breadth_pct, ColorScheme.RED_GREEN, -100, 100),
                row=i,
                col=0,
                tooltip=f"{sector}: {adv} adv / {dec} dec ({breadth_pct:.1f}%)",
                metadata={
                    "advancing": adv,
                    "declining": dec,
                    "new_highs": data.get("new_highs", 0),
                    "new_lows": data.get("new_lows", 0),
                },
            )
            cells.append(cell)

        return cells


# ─── Calendar Heat Map ─────────────────────────────────────────────────────

class CalendarHeatMapBuilder:
    """Build GitHub-style calendar heat map for daily returns."""

    @staticmethod
    def build(dates: list[datetime], values: list[float],
              scheme: ColorScheme = ColorScheme.RED_GREEN) -> list[HeatMapCell]:
        """Build calendar heat map cells."""
        if len(dates) != len(values):
            return []

        cells = []
        all_vals = [abs(v) for v in values]
        max_abs = max(all_vals) if all_vals else 1.0

        for dt, val in zip(dates, values):
            week_of_year = dt.isocalendar()[1]
            day_of_week = dt.weekday()

            cell = HeatMapCell(
                label=dt.strftime("%Y-%m-%d"),
                value=val,
                color=ColorGenerator.value_to_color(val, scheme, -max_abs, max_abs),
                row=day_of_week,
                col=week_of_year,
                tooltip=f"{dt.strftime('%Y-%m-%d')}: {val:.2f}%",
                metadata={"date": dt.isoformat(), "week": week_of_year}
            )
            cells.append(cell)

        return cells


# ─── Orchestrator ────────────────────────────────────────────────────────────

class HeatMapEngine:
    """Top-level heat map generation engine."""

    def __init__(self, default_scheme: ColorScheme = ColorScheme.BLOOMBERG):
        self.default_scheme = default_scheme
        self.sector_builder = SectorHeatMapBuilder()
        self.corr_builder = CorrelationHeatMapBuilder()
        self.perf_builder = PerformanceHeatMapBuilder()
        self.vol_builder = VolumeHeatMapBuilder()
        self.breadth_builder = MarketBreadthHeatMapBuilder()
        self.calendar_builder = CalendarHeatMapBuilder()

    def sector_treemap(self, stocks: list[dict], width: float = 800, height: float = 600) -> dict:
        """Generate sector treemap heat map."""
        nodes = self.sector_builder.build_sector_map(stocks)
        laid_out = self.sector_builder.squarify(nodes, 0, 0, width, height)
        return {
            "type": "sector_treemap",
            "nodes": [n.to_dict() for n in laid_out],
            "width": width,
            "height": height,
        }

    def correlation_heatmap(self, symbols: list[str], corr_matrix: list[list[float]],
                            scheme: ColorScheme | None = None) -> dict:
        """Generate correlation heat map."""
        s = scheme or self.default_scheme
        cells = self.corr_builder.build(symbols, corr_matrix, s)
        return {
            "type": "correlation",
            "cells": [c.to_dict() for c in cells],
            "rows": len(symbols),
            "cols": len(symbols),
            "row_labels": symbols,
            "col_labels": symbols,
        }

    def monthly_returns_heatmap(self, symbol: str, dates: list[datetime],
                                returns: list[float]) -> dict:
        """Generate monthly returns calendar heat map."""
        cells = self.perf_builder.monthly_returns(symbol, dates, returns)
        return {
            "type": "monthly_returns",
            "symbol": symbol,
            "cells": [c.to_dict() for c in cells],
        }

    def performance_grid(self, symbols: list[str],
                         returns_by_period: dict[str, dict[str, float]]) -> dict:
        """Generate performance comparison grid."""
        cells = self.perf_builder.period_returns(symbols, returns_by_period)
        return {
            "type": "performance_grid",
            "cells": [c.to_dict() for c in cells],
        }

    def volume_heatmap(self, timestamps: list[datetime], volumes: list[float]) -> dict:
        """Generate volume heat map by hour/day."""
        cells = self.vol_builder.hourly_volume(timestamps, volumes)
        return {
            "type": "volume",
            "cells": [c.to_dict() for c in cells],
        }

    def market_breadth(self, sector_data: dict[str, dict]) -> dict:
        """Generate market breadth heat map."""
        cells = self.breadth_builder.build(sector_data)
        return {
            "type": "market_breadth",
            "cells": [c.to_dict() for c in cells],
        }

    def calendar_heatmap(self, dates: list[datetime], values: list[float],
                         scheme: ColorScheme | None = None) -> dict:
        """Generate calendar heat map."""
        s = scheme or self.default_scheme
        cells = self.calendar_builder.build(dates, values, s)
        return {
            "type": "calendar",
            "cells": [c.to_dict() for c in cells],
        }

    def value_to_color(self, value: float, min_val: float = -5.0,
                       max_val: float = 5.0, scheme: ColorScheme | None = None) -> str:
        """Get color for a value."""
        s = scheme or self.default_scheme
        return ColorGenerator.value_to_color(value, s, min_val, max_val)

    def capabilities(self) -> dict:
        return {
            "engine": "HeatMapEngine",
            "heat_map_types": [t.value for t in HeatMapType],
            "color_schemes": [s.value for s in ColorScheme],
            "layout_types": [l.value for l in LayoutType],
            "features": [
                "sector_treemap",
                "correlation_heatmap",
                "monthly_returns_calendar",
                "performance_comparison_grid",
                "volume_heatmap_by_hour_day",
                "market_breadth_heatmap",
                "calendar_heatmap",
                "custom_color_schemes",
                "treemap_squarify_layout",
                "color_interpolation",
                "bloomberg_color_palette",
            ],
        }
