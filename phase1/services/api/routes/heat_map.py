"""
heat_map_routes.py — Heat Map REST API
========================================
Sector treemaps, correlation heatmaps, performance grids,
volume heatmaps, market breadth, calendar heatmaps.

Endpoints:
    POST /api/v2/heatmap/sector           → Sector treemap
    POST /api/v2/heatmap/correlation      → Correlation heatmap
    POST /api/v2/heatmap/monthly-returns  → Monthly returns calendar
    POST /api/v2/heatmap/performance      → Performance grid
    POST /api/v2/heatmap/volume           → Volume heatmap
    POST /api/v2/heatmap/breadth          → Market breadth
    POST /api/v2/heatmap/calendar         → Calendar heatmap
    POST /api/v2/heatmap/color            → Color mapping
    GET  /api/v2/heatmap/capabilities     → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from phase1.services.heat_map_engine import HeatMapEngine

router = APIRouter(prefix="/api/v2/heatmap", tags=["Heat Map"])

_engine = HeatMapEngine()


class StockData(BaseModel):
    symbol: str
    sector: str
    market_cap: float
    change_pct: float
    volume: float = 0

class SectorRequest(BaseModel):
    stocks: List[StockData]
    width: float = 1000
    height: float = 600
    color_scheme: str = "bloomberg"

class CorrelationHeatmapRequest(BaseModel):
    symbols: List[str]
    matrix: List[List[float]]
    color_scheme: str = "cool_warm"

class MonthlyReturnsRequest(BaseModel):
    dates: List[str]
    returns: List[float]

class PerformanceGridRequest(BaseModel):
    symbols: List[str]
    period_returns: Dict[str, List[float]]
    periods: List[str]

class VolumeRequest(BaseModel):
    hours: List[int]
    day_of_weeks: List[int]
    volumes: List[float]

class BreadthRequest(BaseModel):
    sectors: List[str]
    advancing: List[int]
    declining: List[int]
    new_highs: List[int] = Field(default_factory=list)
    new_lows: List[int] = Field(default_factory=list)

class CalendarRequest(BaseModel):
    dates: List[str]
    values: List[float]

class ColorRequest(BaseModel):
    value: float
    min_val: float = -1.0
    max_val: float = 1.0
    scheme: str = "red_green"


@router.post("/sector")
def sector(req: SectorRequest):
    stocks = [s.model_dump() for s in req.stocks]
    result = _engine.sector_treemap(stocks, req.width, req.height, req.color_scheme)
    return {"ok": True, "treemap": result}


@router.post("/correlation")
def correlation(req: CorrelationHeatmapRequest):
    result = _engine.correlation_heatmap(req.symbols, req.matrix, req.color_scheme)
    return {"ok": True, "heatmap": result}


@router.post("/monthly-returns")
def monthly_returns(req: MonthlyReturnsRequest):
    result = _engine.monthly_returns_heatmap(req.dates, req.returns)
    return {"ok": True, "heatmap": result}


@router.post("/performance")
def performance(req: PerformanceGridRequest):
    result = _engine.performance_grid(req.symbols, req.period_returns, req.periods)
    return {"ok": True, "grid": result}


@router.post("/volume")
def volume(req: VolumeRequest):
    result = _engine.volume_heatmap(req.hours, req.day_of_weeks, req.volumes)
    return {"ok": True, "heatmap": result}


@router.post("/breadth")
def breadth(req: BreadthRequest):
    data = {
        "sectors": req.sectors,
        "advancing": req.advancing,
        "declining": req.declining,
        "new_highs": req.new_highs,
        "new_lows": req.new_lows,
    }
    result = _engine.market_breadth(data)
    return {"ok": True, "breadth": result}


@router.post("/calendar")
def calendar(req: CalendarRequest):
    result = _engine.calendar_heatmap(req.dates, req.values)
    return {"ok": True, "calendar": result}


@router.post("/color")
def color(req: ColorRequest):
    result = _engine.value_to_color(req.value, req.min_val, req.max_val, req.scheme)
    return {"ok": True, "color": result}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
