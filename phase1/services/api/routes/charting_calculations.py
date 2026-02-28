"""
charting_calculations_routes.py — Charting Calculations REST API
================================================================
Heikin Ashi, Renko, Kagi, P&F, Line Break, Range Bars, VWAP,
Pivot Points, Ichimoku, Supertrend, Market Profile, Volume Profile.

Endpoints:
    POST /api/v2/charting/heikin-ashi       → Heikin Ashi transformation
    POST /api/v2/charting/renko             → Renko bricks
    POST /api/v2/charting/kagi              → Kagi chart
    POST /api/v2/charting/point-and-figure  → P&F chart
    POST /api/v2/charting/line-break        → Line break chart
    POST /api/v2/charting/range-bars        → Range bar aggregation
    POST /api/v2/charting/vwap              → VWAP with bands
    POST /api/v2/charting/pivots            → Pivot points (5 types)
    POST /api/v2/charting/ichimoku          → Ichimoku cloud
    POST /api/v2/charting/supertrend        → Supertrend indicator
    POST /api/v2/charting/market-profile    → Market/TPO profile
    POST /api/v2/charting/volume-profile    → Volume profile
    GET  /api/v2/charting/capabilities      → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from phase1.services.charting_calculations_engine import ChartingCalculationsEngine

router = APIRouter(prefix="/api/v2/charting", tags=["Charting Calculations"])

_engine = ChartingCalculationsEngine()


class BarInput(BaseModel):
    open: float
    high: float
    low: float
    close: float
    volume: float = 0

class VWAPInput(BaseModel):
    highs: List[float]
    lows: List[float]
    closes: List[float]
    volumes: List[float]
    num_bands: int = 2

class PivotInput(BaseModel):
    high: float
    low: float
    close: float
    method: str = "standard"

class IchimokuInput(BaseModel):
    highs: List[float]
    lows: List[float]
    closes: List[float]
    tenkan: int = 9
    kijun: int = 26
    senkou_b: int = 52

class SupertrendInput(BaseModel):
    highs: List[float]
    lows: List[float]
    closes: List[float]
    period: int = 10
    multiplier: float = 3.0

class MarketProfileInput(BaseModel):
    bars: List[BarInput]
    tick_size: float = 0.25
    value_area_pct: float = 0.70


@router.post("/heikin-ashi")
def heikin_ashi(bars: List[BarInput]):
    data = [(b.open, b.high, b.low, b.close) for b in bars]
    result = _engine.heikin_ashi(data)
    return {"ok": True, "bars": result}


@router.post("/renko")
def renko(bars: List[BarInput], brick_size: float = 1.0):
    closes = [b.close for b in bars]
    result = _engine.renko(closes, brick_size)
    return {"ok": True, "bricks": result}


@router.post("/kagi")
def kagi(bars: List[BarInput], reversal_pct: float = 0.04):
    closes = [b.close for b in bars]
    result = _engine.kagi(closes, reversal_pct)
    return {"ok": True, "lines": result}


@router.post("/point-and-figure")
def point_and_figure(bars: List[BarInput], box_size: float = 1.0, reversal: int = 3):
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    result = _engine.point_and_figure(highs, lows, box_size, reversal)
    return {"ok": True, "columns": result}


@router.post("/line-break")
def line_break(bars: List[BarInput], line_count: int = 3):
    closes = [b.close for b in bars]
    result = _engine.line_break(closes, line_count)
    return {"ok": True, "lines": result}


@router.post("/range-bars")
def range_bars(bars: List[BarInput], range_size: float = 1.0):
    data = [(b.open, b.high, b.low, b.close, b.volume) for b in bars]
    result = _engine.range_bars(data, range_size)
    return {"ok": True, "bars": result}


@router.post("/vwap")
def vwap(req: VWAPInput):
    result = _engine.vwap(req.highs, req.lows, req.closes, req.volumes, req.num_bands)
    return {"ok": True, "vwap": result}


@router.post("/pivots")
def pivot_points(req: PivotInput):
    result = _engine.pivot_points(req.high, req.low, req.close, req.method)
    return {"ok": True, "pivots": result}


@router.post("/ichimoku")
def ichimoku(req: IchimokuInput):
    result = _engine.ichimoku(req.highs, req.lows, req.closes, req.tenkan, req.kijun, req.senkou_b)
    return {"ok": True, "ichimoku": result}


@router.post("/supertrend")
def supertrend(req: SupertrendInput):
    result = _engine.supertrend(req.highs, req.lows, req.closes, req.period, req.multiplier)
    return {"ok": True, "supertrend": result}


@router.post("/market-profile")
def market_profile(req: MarketProfileInput):
    bars = [(b.open, b.high, b.low, b.close, b.volume) for b in req.bars]
    result = _engine.market_profile(bars, req.tick_size, req.value_area_pct)
    return {"ok": True, "profile": result}


@router.post("/volume-profile")
def volume_profile(bars: List[BarInput], num_bins: int = 24):
    data = [(b.open, b.high, b.low, b.close, b.volume) for b in bars]
    result = _engine.volume_profile(data, num_bins)
    return {"ok": True, "profile": result}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
