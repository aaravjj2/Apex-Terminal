"""
L2 Visualization Helpers — Heatmap data generation, trade reconstruction,
volume profile visualization, and chart-ready L2 analytics.

Prepares Level 2 and Time & Sales data for frontend charts (heatmaps, volume profiles,
order book depth charts, trade reconstruction timelines).
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .level2_processor import (
    L2Snapshot,
    L2Level,
    TimeAndSalesTick,
    VolumeAtPrice,
    resample_ticks_to_bars,
)


# ─── Heatmap Data ──────────────────────────────────────────────────────────────


@dataclass
class HeatmapCell:
    """Single cell for heatmap visualization."""

    x: float
    y: float
    value: float
    label: str = ""

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "value": self.value, "label": self.label}


@dataclass
class HeatmapData:
    """Full heatmap dataset for rendering."""

    cells: List[HeatmapCell]
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    value_min: float
    value_max: float

    def to_dict(self) -> dict:
        return {
            "cells": [c.to_dict() for c in self.cells],
            "x_min": self.x_min,
            "x_max": self.x_max,
            "y_min": self.y_min,
            "y_max": self.y_max,
            "value_min": self.value_min,
            "value_max": self.value_max,
        }


def order_book_heatmap(
    snapshot: L2Snapshot,
    bid_levels: int = 20,
    ask_levels: int = 20,
) -> HeatmapData:
    """
    Generate heatmap data for order book depth.
    x = price level index, y = depth level, value = volume.
    """
    cells: List[HeatmapCell] = []
    prices: List[float] = []
    values: List[float] = []

    for i, level in enumerate(snapshot.bids[:bid_levels]):
        cells.append(HeatmapCell(x=level.price, y=-i - 1, value=level.size, label=f"B{level.price}"))
        prices.append(level.price)
        values.append(level.size)

    for i, level in enumerate(snapshot.asks[:ask_levels]):
        cells.append(HeatmapCell(x=level.price, y=i + 1, value=level.size, label=f"A{level.price}"))
        prices.append(level.price)
        values.append(level.size)

    x_min = min(prices) if prices else 0
    x_max = max(prices) if prices else 0
    y_min = -bid_levels
    y_max = ask_levels
    v_min = min(values) if values else 0
    v_max = max(values) if values else 1

    return HeatmapData(
        cells=cells,
        x_min=x_min,
        x_max=x_max,
        y_min=y_min,
        y_max=y_max,
        value_min=v_min,
        value_max=v_max,
    )


def volume_profile_heatmap(
    vap_list: List[VolumeAtPrice],
    price_step: float = 0.01,
) -> HeatmapData:
    """
    Heatmap for volume-at-price (horizontal volume profile).
    x = price, y = 0 (or time bucket), value = volume.
    """
    cells: List[HeatmapCell] = []
    prices: List[float] = []
    volumes: List[float] = []

    for vap in vap_list:
        if vap.volume <= 0:
            continue
        cells.append(HeatmapCell(x=vap.price, y=0, value=vap.volume, label=f"{vap.price}"))
        prices.append(vap.price)
        volumes.append(vap.volume)

    x_min = min(prices) if prices else 0
    x_max = max(prices) if prices else 0
    v_min = min(volumes) if volumes else 0
    v_max = max(volumes) if volumes else 1

    return HeatmapData(
        cells=cells,
        x_min=x_min,
        x_max=x_max,
        y_min=0,
        y_max=1,
        value_min=v_min,
        value_max=v_max,
    )


def time_volume_heatmap(
    ticks: List[TimeAndSalesTick],
    n_time_buckets: int = 78,
    n_price_buckets: int = 50,
) -> HeatmapData:
    """
    2D heatmap: time (x) vs price (y), value = volume.
    Typical use: intraday volume distribution.
    """
    if not ticks:
        return HeatmapData(cells=[], x_min=0, x_max=0, y_min=0, y_max=0, value_min=0, value_max=0)

    min_ts = min(t.timestamp_ns for t in ticks)
    max_ts = max(t.timestamp_ns for t in ticks)
    min_price = min(t.price for t in ticks)
    max_price = max(t.price for t in ticks)

    ts_range = max(max_ts - min_ts, 1)
    price_range = max(max_price - min_price, 0.001)

    buckets: Dict[Tuple[int, int], float] = defaultdict(float)
    for t in ticks:
        tb = int((t.timestamp_ns - min_ts) / ts_range * (n_time_buckets - 1))
        pb = int((t.price - min_price) / price_range * (n_price_buckets - 1))
        tb = max(0, min(tb, n_time_buckets - 1))
        pb = max(0, min(pb, n_price_buckets - 1))
        buckets[(tb, pb)] += t.size

    cells = []
    for (tb, pb), vol in buckets.items():
        x = min_ts + (tb / n_time_buckets) * ts_range
        y = min_price + (pb / n_price_buckets) * price_range
        cells.append(HeatmapCell(x=x, y=y, value=vol))

    vols = [c.value for c in cells]
    return HeatmapData(
        cells=cells,
        x_min=min_ts,
        x_max=max_ts,
        y_min=min_price,
        y_max=max_price,
        value_min=min(vols) if vols else 0,
        value_max=max(vols) if vols else 1,
    )


# ─── Trade Reconstruction ────────────────────────────────────────────────────


@dataclass
class ReconstructedTrade:
    """Reconstructed trade with inferred aggressor side."""

    price: float
    size: float
    timestamp_ns: int
    inferred_side: str
    mid_at_trade: float
    effective_spread: float

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "size": round(self.size, 4),
            "timestamp_ns": self.timestamp_ns,
            "inferred_side": self.inferred_side,
            "mid_at_trade": round(self.mid_at_trade, 6),
            "effective_spread": round(self.effective_spread, 6),
        }


def reconstruct_trades_with_mid(
    ticks: List[TimeAndSalesTick],
    mid_series: List[Tuple[int, float]],
) -> List[ReconstructedTrade]:
    """
    Reconstruct trades with inferred side using mid-price.
    mid_series: [(timestamp_ns, mid_price), ...]
    """
    if not mid_series:
        return []
    mid_series = sorted(mid_series, key=lambda x: x[0])

    def mid_at(ts: int) -> float:
        for i, (t, m) in enumerate(mid_series):
            if t >= ts:
                return mid_series[i - 1][1] if i > 0 else m
        return mid_series[-1][1]

    result = []
    for t in ticks:
        mid = mid_at(t.timestamp_ns)
        if t.price >= mid:
            side = "buy"
            eff_spread = 2 * (t.price - mid)
        else:
            side = "sell"
            eff_spread = 2 * (mid - t.price)
        result.append(
            ReconstructedTrade(
                price=t.price,
                size=t.size,
                timestamp_ns=t.timestamp_ns,
                inferred_side=side,
                mid_at_trade=mid,
                effective_spread=eff_spread,
            )
        )
    return result


def reconstruct_trades_tape_compare(
    ticks: List[TimeAndSalesTick],
    prev_tick: Optional[TimeAndSalesTick],
) -> str:
    """
    Infer trade side using tick rule: compare to previous tick.
    """
    if not prev_tick:
        return "unknown"
    if ticks[0].price > prev_tick.price:
        return "buy"
    if ticks[0].price < prev_tick.price:
        return "sell"
    return "unknown"


# ─── Volume Profile Chart Data ───────────────────────────────────────────────


@dataclass
class VolumeProfileBar:
    """Single bar for volume profile chart."""

    price: float
    volume: float
    buy_volume: float
    sell_volume: float
    pct_of_total: float

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "volume": round(self.volume, 4),
            "buy_volume": round(self.buy_volume, 4),
            "sell_volume": round(self.sell_volume, 4),
            "pct_of_total": round(self.pct_of_total, 4),
        }


def volume_profile_chart_data(
    vap_list: List[VolumeAtPrice],
    total_volume: Optional[float] = None,
) -> List[VolumeProfileBar]:
    """Prepare VAP for horizontal bar chart."""
    total = total_volume or sum(v.volume for v in vap_list)
    if total <= 0:
        return []

    bars = []
    for v in sorted(vap_list, key=lambda x: x.price):
        bars.append(
            VolumeProfileBar(
                price=v.price,
                volume=v.volume,
                buy_volume=v.buy_volume,
                sell_volume=v.sell_volume,
                pct_of_total=(v.volume / total) * 100,
            )
        )
    return bars


def cumulative_volume_profile(
    vap_list: List[VolumeAtPrice],
    price_asc: bool = True,
) -> List[Dict[str, float]]:
    """Cumulative volume from one end of price range."""
    sorted_vap = sorted(vap_list, key=lambda x: x.price, reverse=not price_asc)
    cum = 0.0
    result = []
    for v in sorted_vap:
        cum += v.volume
        result.append({"price": v.price, "cumulative_volume": cum})
    return result


# ─── Order Book Depth Chart Data ──────────────────────────────────────────────


@dataclass
class DepthChartPoint:
    """Single point for depth chart (categorical or continuous)."""

    price: float
    bid_depth: float
    ask_depth: float
    net_depth: float

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "bid_depth": round(self.bid_depth, 4),
            "ask_depth": round(self.ask_depth, 4),
            "net_depth": round(self.net_depth, 4),
        }


def order_book_depth_chart(
    snapshot: L2Snapshot,
    levels: int = 20,
) -> List[DepthChartPoint]:
    """Prepare order book for depth chart (bid/ask as bars from mid)."""
    bid_cum = 0.0
    ask_cum = 0.0
    points = []

    for i in range(min(levels, len(snapshot.bids))):
        level = snapshot.bids[i]
        bid_cum += level.size
        points.append(
            DepthChartPoint(
                price=level.price,
                bid_depth=bid_cum,
                ask_depth=0,
                net_depth=bid_cum,
            )
        )

    for i in range(min(levels, len(snapshot.asks))):
        level = snapshot.asks[i]
        ask_cum += level.size
        points.append(
            DepthChartPoint(
                price=level.price,
                bid_depth=0,
                ask_depth=ask_cum,
                net_depth=-ask_cum,
            )
        )

    return sorted(points, key=lambda x: x.price)


# ─── Point of Control (POC) & Value Area ──────────────────────────────────────


def point_of_control(vap_list: List[VolumeAtPrice]) -> Optional[float]:
    """Price level with highest volume."""
    if not vap_list:
        return None
    return max(vap_list, key=lambda x: x.volume).price


def value_area(
    vap_list: List[VolumeAtPrice],
    pct: float = 0.68,
) -> Optional[Tuple[float, float]]:
    """
    Value area: price range containing pct of volume, centered on POC.
    Returns (low, high) or None.
    """
    if not vap_list or pct <= 0:
        return None
    total = sum(v.volume for v in vap_list)
    if total <= 0:
        return None
    target = total * pct
    poc = point_of_control(vap_list)
    if poc is None:
        return None

    sorted_by_price = sorted(vap_list, key=lambda x: x.price)
    poc_idx = next((i for i, v in enumerate(sorted_by_price) if v.price == poc), 0)

    cum = sorted_by_price[poc_idx].volume
    lo = poc_idx
    hi = poc_idx
    while cum < target and (lo > 0 or hi < len(sorted_by_price) - 1):
        add_lo = sorted_by_price[lo - 1].volume if lo > 0 else 0
        add_hi = sorted_by_price[hi + 1].volume if hi < len(sorted_by_price) - 1 else 0
        if add_lo >= add_hi and lo > 0:
            lo -= 1
            cum += add_lo
        elif hi < len(sorted_by_price) - 1:
            hi += 1
            cum += add_hi
        elif lo > 0:
            lo -= 1
            cum += add_lo
        else:
            break

    return (sorted_by_price[lo].price, sorted_by_price[hi].price)


# ─── Imbalance Time Series ───────────────────────────────────────────────────


def imbalance_time_series(
    snapshots: List[Tuple[int, L2Snapshot]],
    levels: int = 5,
) -> List[Dict[str, float]]:
    """Compute order book imbalance over time for chart."""
    result = []
    for ts, snap in snapshots:
        bid_vol = snap.bid_volume(levels)
        ask_vol = snap.ask_volume(levels)
        total = bid_vol + ask_vol
        imb = (bid_vol - ask_vol) / total if total > 0 else 0.0
        result.append({"timestamp_ns": ts, "imbalance": imb})
    return result


# ─── Export Helpers ───────────────────────────────────────────────────────────


def export_for_chart(
    data: Any,
    format: str = "json",
) -> Dict[str, Any]:
    """Export data structure for common chart libraries."""
    if hasattr(data, "to_dict"):
        return data.to_dict()
    if isinstance(data, list) and data and hasattr(data[0], "to_dict"):
        return {"items": [x.to_dict() for x in data]}
    return {"data": data}
