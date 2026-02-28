"""
correlation_analysis_routes.py — Correlation Analysis REST API
================================================================
Pearson/Spearman/Kendall correlation, rolling correlation, PCA,
beta, dispersion, lead-lag, regime detection, portfolio optimization.

Endpoints:
    POST /api/v2/correlation/matrix          → Correlation matrix
    POST /api/v2/correlation/rolling         → Rolling correlation
    POST /api/v2/correlation/pca             → PCA analysis
    POST /api/v2/correlation/beta            → Beta calculation
    POST /api/v2/correlation/dispersion      → Dispersion index
    POST /api/v2/correlation/lead-lag        → Lead-lag detection
    POST /api/v2/correlation/regime          → Regime detection
    POST /api/v2/correlation/optimize        → Portfolio optimization
    POST /api/v2/correlation/stability       → Stability analysis
    GET  /api/v2/correlation/capabilities    → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from phase1.services.correlation_analysis_engine import CorrelationAnalysisEngine

router = APIRouter(prefix="/api/v2/correlation", tags=["Correlation Analysis"])

_engine = CorrelationAnalysisEngine()


class MatrixRequest(BaseModel):
    returns: Dict[str, List[float]]
    method: str = "pearson"

class RollingRequest(BaseModel):
    series_a: List[float]
    series_b: List[float]
    window: int = 60

class PCARequest(BaseModel):
    returns: Dict[str, List[float]]
    n_components: int = 3

class BetaRequest(BaseModel):
    asset_returns: List[float]
    market_returns: List[float]
    window: int = 0

class DispersionRequest(BaseModel):
    returns: Dict[str, List[float]]
    window: int = 20

class LeadLagRequest(BaseModel):
    series_a: List[float]
    series_b: List[float]
    max_lag: int = 10

class RegimeRequest(BaseModel):
    returns: Dict[str, List[float]]
    window: int = 60

class OptimizeRequest(BaseModel):
    returns: Dict[str, List[float]]
    method: str = "min_variance"
    target_return: float = 0.0

class StabilityRequest(BaseModel):
    returns: Dict[str, List[float]]
    window: int = 60
    step: int = 20


@router.post("/matrix")
def correlation_matrix(req: MatrixRequest):
    result = _engine.correlation_matrix(req.returns, req.method)
    return {"ok": True, "matrix": result}


@router.post("/rolling")
def rolling_correlation(req: RollingRequest):
    result = _engine.rolling_correlation(req.series_a, req.series_b, req.window)
    return {"ok": True, "rolling": result}


@router.post("/pca")
def pca_analysis(req: PCARequest):
    result = _engine.pca(req.returns, req.n_components)
    return {"ok": True, "pca": result}


@router.post("/beta")
def beta(req: BetaRequest):
    result = _engine.beta(req.asset_returns, req.market_returns, req.window)
    return {"ok": True, "beta": result}


@router.post("/dispersion")
def dispersion(req: DispersionRequest):
    result = _engine.dispersion(req.returns, req.window)
    return {"ok": True, "dispersion": result}


@router.post("/lead-lag")
def lead_lag(req: LeadLagRequest):
    result = _engine.lead_lag(req.series_a, req.series_b, req.max_lag)
    return {"ok": True, "lead_lag": result}


@router.post("/regime")
def regime(req: RegimeRequest):
    result = _engine.regime(req.returns, req.window)
    return {"ok": True, "regime": result}


@router.post("/optimize")
def optimize(req: OptimizeRequest):
    result = _engine.optimize(req.returns, req.method, req.target_return)
    return {"ok": True, "optimization": result}


@router.post("/stability")
def stability(req: StabilityRequest):
    result = _engine.stability(req.returns, req.window, req.step)
    return {"ok": True, "stability": result}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
