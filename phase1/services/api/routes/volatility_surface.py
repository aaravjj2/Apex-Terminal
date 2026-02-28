"""
volatility_surface_routes.py — Volatility Surface REST API
=============================================================
Black-Scholes pricing, IV solving, historical volatility,
vol surface construction, Greeks surface, vol regime analysis.

Endpoints:
    POST /api/v2/vol-surface/price          → BS option price
    POST /api/v2/vol-surface/greeks         → Option Greeks
    POST /api/v2/vol-surface/iv             → Solve implied vol
    POST /api/v2/vol-surface/build          → Build vol surface
    POST /api/v2/vol-surface/historical     → Historical volatility
    POST /api/v2/vol-surface/historical-ohlc→ Hist vol (OHLC methods)
    POST /api/v2/vol-surface/regime         → Vol regime analysis
    POST /api/v2/vol-surface/rv-iv          → Realized vs implied
    GET  /api/v2/vol-surface/capabilities   → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from phase1.services.volatility_surface_engine import VolatilitySurfaceEngine

router = APIRouter(prefix="/api/v2/vol-surface", tags=["Volatility Surface"])

_engine = VolatilitySurfaceEngine()


class PriceRequest(BaseModel):
    spot: float
    strike: float
    rate: float = 0.05
    time: float = 1.0
    vol: float = 0.20
    option_type: str = "call"

class GreeksRequest(BaseModel):
    spot: float
    strike: float
    rate: float = 0.05
    time: float = 1.0
    vol: float = 0.20
    option_type: str = "call"

class IVRequest(BaseModel):
    market_price: float
    spot: float
    strike: float
    rate: float = 0.05
    time: float = 1.0
    option_type: str = "call"

class OptionChainEntry(BaseModel):
    strike: float
    expiry_years: float
    market_price: float
    option_type: str = "call"

class BuildSurfaceRequest(BaseModel):
    spot: float
    options: List[OptionChainEntry]
    rate: float = 0.05

class HistVolRequest(BaseModel):
    prices: List[float]
    method: str = "close_to_close"
    window: int = 20

class HistVolOHLCRequest(BaseModel):
    opens: List[float]
    highs: List[float]
    lows: List[float]
    closes: List[float]
    method: str = "parkinson"
    window: int = 20

class VolRegimeRequest(BaseModel):
    vol_series: List[float]

class RVIVRequest(BaseModel):
    realized: List[float]
    implied: List[float]


@router.post("/price")
def price(req: PriceRequest):
    result = _engine.bs_price(req.spot, req.strike, req.rate, req.time,
                               req.vol, req.option_type)
    return {"ok": True, "price": round(result, 6)}


@router.post("/greeks")
def greeks(req: GreeksRequest):
    result = _engine.bs_greeks(req.spot, req.strike, req.rate, req.time,
                                req.vol, req.option_type)
    return {"ok": True, "greeks": result}


@router.post("/iv")
def implied_vol(req: IVRequest):
    result = _engine.solve_iv(req.market_price, req.spot, req.strike,
                               req.rate, req.time, req.option_type)
    return {"ok": True, "implied_vol": round(result, 6)}


@router.post("/build")
def build_surface(req: BuildSurfaceRequest):
    options = [o.model_dump() for o in req.options]
    result = _engine.build_surface(req.spot, options, req.rate)
    return {"ok": True, "surface": [p.to_dict() for p in result]}


@router.post("/historical")
def historical_vol(req: HistVolRequest):
    result = _engine.historical_vol(req.prices, req.method, req.window)
    return {"ok": True, "volatility": result}


@router.post("/historical-ohlc")
def historical_vol_ohlc(req: HistVolOHLCRequest):
    result = _engine.historical_vol_ohlc(req.opens, req.highs, req.lows,
                                          req.closes, req.method, req.window)
    return {"ok": True, "volatility": result}


@router.post("/regime")
def vol_regime(req: VolRegimeRequest):
    regime = _engine.vol_regime(req.vol_series)
    return {"ok": True, "regime": regime}


@router.post("/rv-iv")
def rv_iv(req: RVIVRequest):
    result = _engine.realized_vs_implied(req.realized, req.implied)
    return {"ok": True, "analysis": result}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
