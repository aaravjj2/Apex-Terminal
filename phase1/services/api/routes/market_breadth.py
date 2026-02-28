"""
market_breadth_routes.py — Market Breadth Engine REST API
===========================================================
Advance/decline, McClellan oscillator/summation, TRIN, new highs/lows,
breadth thrust, Zweig, Hindenburg Omen, percent above MA, volume breadth,
sector rotation, regime classification, divergence detection.

Endpoints:
    POST /api/v2/breadth/ad-line            → Advance/decline line
    POST /api/v2/breadth/mcclellan          → McClellan oscillator & summation
    POST /api/v2/breadth/trin               → Arms Index (TRIN)
    POST /api/v2/breadth/new-high-low       → New highs/lows
    POST /api/v2/breadth/thrust             → Breadth thrust & Zweig
    POST /api/v2/breadth/hindenburg         → Hindenburg Omen
    POST /api/v2/breadth/above-ma           → Percent above MA
    POST /api/v2/breadth/volume             → Volume breadth
    POST /api/v2/breadth/rotation           → Sector rotation
    POST /api/v2/breadth/regime             → Regime classification
    POST /api/v2/breadth/divergence         → Divergence detection
    POST /api/v2/breadth/dashboard          → Full dashboard
    GET  /api/v2/breadth/capabilities       → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from phase1.services.market_breadth_engine import (
    MarketBreadthEngine, DailyBreadthData,
)

router = APIRouter(prefix="/api/v2/breadth", tags=["Market Breadth"])

_engine = MarketBreadthEngine()


# ── Pydantic Models ─────────────────────────────────────────────────────

class BreadthDataPoint(BaseModel):
    date: str = ""
    advances: int
    declines: int
    unchanged: int = 0
    new_highs: int = 0
    new_lows: int = 0
    up_volume: float = 0.0
    down_volume: float = 0.0
    total_issues: int = 0


class BreadthDataRequest(BaseModel):
    data: List[BreadthDataPoint]


class PercentAboveMARequest(BaseModel):
    all_prices: Dict[str, List[float]]
    period: int = 50


class SectorRotationRequest(BaseModel):
    sector_returns: Dict[str, float]


class DivergenceRequest(BaseModel):
    prices: List[float]
    data: List[BreadthDataPoint]


# ── Helpers ─────────────────────────────────────────────────────────────

def _to_breadth(data: List[BreadthDataPoint]) -> List[DailyBreadthData]:
    return [
        DailyBreadthData(
            date=d.date, advances=d.advances, declines=d.declines,
            unchanged=d.unchanged, new_highs=d.new_highs, new_lows=d.new_lows,
            up_volume=d.up_volume, down_volume=d.down_volume, total_issues=d.total_issues,
        )
        for d in data
    ]


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/ad-line")
async def ad_line(req: BreadthDataRequest) -> Dict[str, Any]:
    """Calculate advance/decline line."""
    data = _to_breadth(req.data)
    return {
        "ad_line": _engine.ad_line(data),
        "ad_ratio": _engine.ad_ratio(data),
        "breadth_pct": _engine.breadth_pct(data),
    }


@router.post("/mcclellan")
async def mcclellan(req: BreadthDataRequest) -> Dict[str, Any]:
    """Calculate McClellan oscillator and summation index."""
    data = _to_breadth(req.data)
    return {
        "oscillator": _engine.mcclellan_oscillator(data),
        "summation_index": _engine.mcclellan_summation(data),
    }


@router.post("/trin")
async def trin(req: BreadthDataRequest) -> Dict[str, Any]:
    """Calculate Arms Index (TRIN)."""
    data = _to_breadth(req.data)
    return {"trin": _engine.trin(data)}


@router.post("/new-high-low")
async def new_high_low(req: BreadthDataRequest) -> Dict[str, Any]:
    """Calculate new highs/lows analysis."""
    data = _to_breadth(req.data)
    return {"nh_nl_line": _engine.nh_nl_line(data)}


@router.post("/thrust")
async def breadth_thrust(req: BreadthDataRequest) -> Dict[str, Any]:
    """Calculate breadth thrust and Zweig indicators."""
    data = _to_breadth(req.data)
    return {
        "breadth_thrust": _engine.breadth_thrust(data),
        "zweig": _engine.zweig_breadth_thrust(data),
    }


@router.post("/hindenburg")
async def hindenburg(req: BreadthDataRequest) -> Dict[str, Any]:
    """Detect Hindenburg Omen signals."""
    data = _to_breadth(req.data)
    return {"hindenburg_omen": _engine.hindenburg_omen(data)}


@router.post("/above-ma")
async def above_ma(req: PercentAboveMARequest) -> Dict[str, Any]:
    """Calculate percent of stocks above MA."""
    return {"summary": _engine.percent_above_ma(req.all_prices, req.period)}


@router.post("/volume")
async def volume_breadth(req: BreadthDataRequest) -> Dict[str, Any]:
    """Calculate volume breadth indicators."""
    data = _to_breadth(req.data)
    return {
        "volume_ratio": _engine.volume_ratio(data),
        "volume_thrust": _engine.volume_thrust(data),
    }


@router.post("/rotation")
async def sector_rotation(req: SectorRotationRequest) -> Dict[str, Any]:
    """Analyze sector rotation."""
    return {"rotation": _engine.sector_rotation(req.sector_returns)}


@router.post("/regime")
async def regime(req: BreadthDataRequest) -> Dict[str, Any]:
    """Classify market breadth regime."""
    data = _to_breadth(req.data)
    return {"regime": _engine.classify_regime(data)}


@router.post("/divergence")
async def divergence(req: DivergenceRequest) -> Dict[str, Any]:
    """Detect breadth divergences."""
    data = _to_breadth(req.data)
    return {"divergence": _engine.detect_divergence(req.prices, data)}


@router.post("/dashboard")
async def dashboard(req: BreadthDataRequest) -> Dict[str, Any]:
    """Get full breadth dashboard."""
    data = _to_breadth(req.data)
    return _engine.full_dashboard(data)


@router.get("/capabilities")
async def capabilities() -> Dict[str, Any]:
    """Get engine capabilities."""
    return _engine.capabilities()
