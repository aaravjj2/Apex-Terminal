"""
multi_asset_analysis_routes.py — Multi-Asset Analysis REST API
================================================================
Cross-asset correlation, relative value, carry trade, yield curve,
macro factors, allocation, currency hedging, flight-to-quality.

Endpoints:
    POST /api/v2/multi-asset/correlation       → Cross-asset correlation
    POST /api/v2/multi-asset/relative-value    → Relative value z-scores
    POST /api/v2/multi-asset/carry             → Carry trade analysis
    POST /api/v2/multi-asset/yield-curve       → Yield curve analysis
    POST /api/v2/multi-asset/macro-regime      → Macro regime detection
    POST /api/v2/multi-asset/allocate          → Multi-asset allocation
    POST /api/v2/multi-asset/hedge             → Currency hedging
    POST /api/v2/multi-asset/flight-to-quality → FTQ detection
    GET  /api/v2/multi-asset/capabilities      → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from phase1.services.multi_asset_analysis_engine import MultiAssetAnalysisEngine

router = APIRouter(prefix="/api/v2/multi-asset", tags=["Multi-Asset Analysis"])

_engine = MultiAssetAnalysisEngine()


class CorrelationRequest(BaseModel):
    returns: Dict[str, List[float]]
    window: int = 60

class RelativeValueRequest(BaseModel):
    series_a: List[float]
    series_b: List[float]
    window: int = 60

class CarryRequest(BaseModel):
    yield_asset: float
    yield_funding: float
    fx_return: float = 0.0
    holding_period: float = 1.0

class YieldCurveRequest(BaseModel):
    tenors: List[float]
    yields_: List[float] = Field(alias="yields")
    model_config = {"populate_by_name": True}

class MacroRegimeRequest(BaseModel):
    returns: Dict[str, List[float]]
    factor_returns: Dict[str, List[float]]

class AllocateRequest(BaseModel):
    returns: Dict[str, List[float]]
    method: str = "equal_weight"

class HedgeRequest(BaseModel):
    asset_returns: List[float]
    fx_returns: List[float]
    hedge_ratio: float = 1.0

class FTQRequest(BaseModel):
    equity_returns: List[float]
    bond_returns: List[float]
    vix_levels: List[float]
    gold_returns: List[float]


@router.post("/correlation")
def correlation(req: CorrelationRequest):
    result = _engine.cross_asset_correlation(req.returns, req.window)
    return {"ok": True, "correlation": result}


@router.post("/relative-value")
def relative_value(req: RelativeValueRequest):
    result = _engine.relative_value(req.series_a, req.series_b, req.window)
    return {"ok": True, "relative_value": result}


@router.post("/carry")
def carry(req: CarryRequest):
    result = _engine.carry_trade(req.yield_asset, req.yield_funding,
                                 req.fx_return, req.holding_period)
    return {"ok": True, "carry": result}


@router.post("/yield-curve")
def yield_curve(req: YieldCurveRequest):
    result = _engine.yield_curve(req.tenors, req.yields_)
    return {"ok": True, "yield_curve": result}


@router.post("/macro-regime")
def macro_regime(req: MacroRegimeRequest):
    result = _engine.macro_regime(req.returns, req.factor_returns)
    return {"ok": True, "regime": result}


@router.post("/allocate")
def allocate(req: AllocateRequest):
    result = _engine.allocate(req.returns, req.method)
    return {"ok": True, "allocation": result}


@router.post("/hedge")
def hedge(req: HedgeRequest):
    result = _engine.hedge(req.asset_returns, req.fx_returns, req.hedge_ratio)
    return {"ok": True, "hedge": result}


@router.post("/flight-to-quality")
def flight_to_quality(req: FTQRequest):
    result = _engine.flight_to_quality(req.equity_returns, req.bond_returns,
                                        req.vix_levels, req.gold_returns)
    return {"ok": True, "ftq": result}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
