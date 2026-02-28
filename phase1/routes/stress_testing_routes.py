"""
FastAPI routes for StressTestingEngine — VaR, CVaR, scenarios, drawdown analysis.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.stress_testing_engine import (
    StressTestingEngine,
    VaRMethod,
    HistoricalScenario,
    ScenarioAnalyzer,
)

router = APIRouter(prefix="/api/stress-testing", tags=["Stress Testing"])
_engine = StressTestingEngine()


# ─── Request / Response Models ────────────────────────────────────────────────

class VaRRequest(BaseModel):
    returns: List[float] = Field(..., description="Historical return series")
    confidence: float = Field(0.95, ge=0.80, le=0.9999, description="VaR confidence level")
    holding_period: int = Field(1, ge=1, le=252, description="Holding period in days")
    method: str = Field("historical", description="VaR method: historical|parametric|cornish_fisher|monte_carlo")

    class Config:
        schema_extra = {
            "example": {
                "returns": [-0.023, 0.012, -0.034, 0.005, 0.018],
                "confidence": 0.95,
                "holding_period": 1,
                "method": "historical"
            }
        }


class CVaRRequest(BaseModel):
    returns: List[float] = Field(..., description="Historical return series")
    confidence: float = Field(0.95, ge=0.80, le=0.9999, description="CVaR confidence level")
    method: str = Field("historical", description="CVaR method: historical|parametric")


class ComponentCVaRRequest(BaseModel):
    portfolio_returns: List[float] = Field(..., description="Portfolio return series")
    asset_returns: Dict[str, List[float]] = Field(..., description="Individual asset return series")
    weights: Dict[str, float] = Field(..., description="Portfolio weights (must sum to 1)")
    confidence: float = Field(0.95, ge=0.80, le=0.9999)


class DrawdownRequest(BaseModel):
    price_series: List[float] = Field(..., description="Price or NAV series")


class ScenarioRequest(BaseModel):
    portfolio_weights: Dict[str, float] = Field(..., description="Asset weights (must sum to 1)")
    scenario_name: Optional[str] = Field(None, description="Specific scenario name, or null for all scenarios")


class LossDistributionRequest(BaseModel):
    weights: List[float] = Field(..., description="Portfolio weights (must sum to 1)")
    mean_returns: List[float] = Field(..., description="Expected daily returns per asset")
    volatilities: List[float] = Field(..., description="Daily volatilities per asset")
    correlations: Optional[List[List[float]]] = Field(None, description="Correlation matrix (n×n)")
    n_simulations: int = Field(10000, ge=1000, le=100000, description="Number of Monte Carlo simulations")
    horizon: int = Field(1, ge=1, le=252, description="Holding period in days")


class FullRiskReportRequest(BaseModel):
    returns: List[float] = Field(..., description="Portfolio return series")
    price_series: Optional[List[float]] = Field(None, description="Price/NAV series for drawdown")
    portfolio_weights: Optional[Dict[str, float]] = Field(None, description="Asset weights for scenario analysis")
    confidence: float = Field(0.95, ge=0.80, le=0.9999)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def get_capabilities():
    """Return engine capabilities and supported methods."""
    return _engine.capabilities()


@router.get("/scenarios/list")
def list_scenarios():
    """List all available historical stress test scenarios."""
    scenarios = HistoricalScenario.all_scenarios()
    return {
        "count": len(scenarios),
        "scenarios": [
            {
                "name": s.name,
                "description": s.description,
                "start_date": s.start_date,
                "end_date": s.end_date,
                "asset_class_shocks": s.asset_class_shocks,
            }
            for s in scenarios
        ]
    }


@router.post("/var")
def calculate_var(body: VaRRequest):
    """Calculate Value at Risk using the specified method."""
    try:
        method_map = {m.value: m for m in VaRMethod}
        method = method_map.get(body.method)
        if method is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown method '{body.method}'. Valid: {list(method_map.keys())}"
            )
        result = _engine.var(body.returns, body.confidence, body.holding_period, method)
        if result is None:
            raise HTTPException(status_code=422, detail="Insufficient data for VaR calculation")
        return {"method": body.method, "confidence": body.confidence, **result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/var/full-suite")
def full_var_suite(body: VaRRequest):
    """Calculate VaR using all available methods and compare results."""
    try:
        results = _engine.full_var_suite(body.returns, body.confidence, body.holding_period)
        return {
            "confidence": body.confidence,
            "holding_period": body.holding_period,
            "methods": results,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/cvar")
def calculate_cvar(body: CVaRRequest):
    """Calculate Conditional VaR (Expected Shortfall)."""
    try:
        result = _engine.cvar(body.returns, body.confidence, body.method)
        return {"method": body.method, "confidence": body.confidence, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/cvar/component")
def component_cvar(body: ComponentCVaRRequest):
    """Compute each asset's contribution to portfolio CVaR."""
    try:
        result = _engine.component_cvar(
            body.portfolio_returns, body.asset_returns, body.weights, body.confidence
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/drawdown")
def max_drawdown(body: DrawdownRequest):
    """Compute maximum drawdown and related statistics."""
    try:
        result = _engine.max_drawdown(body.price_series)
        if not result:
            raise HTTPException(status_code=422, detail="Insufficient data or flat price series")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/drawdown/calmar")
def calmar_ratio(body: DrawdownRequest):
    """Compute Calmar ratio (annualized return / max drawdown)."""
    try:
        result = _engine.calmar(body.price_series)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/scenarios/run")
def run_scenarios(body: ScenarioRequest):
    """Run historical stress scenarios against portfolio weights."""
    try:
        results = _engine.scenario_analysis(body.portfolio_weights, body.scenario_name)
        return {
            "portfolio_weights": body.portfolio_weights,
            "scenario_count": len(results),
            "results": results,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/scenarios/worst-case")
def worst_case_scenario(body: ScenarioRequest):
    """Identify the worst-case scenario for the given portfolio."""
    try:
        result = _engine.worst_scenario(body.portfolio_weights)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/monte-carlo")
def monte_carlo_loss(body: LossDistributionRequest):
    """Simulate portfolio loss distribution using Monte Carlo."""
    try:
        result = _engine.monte_carlo_loss_dist(
            body.weights,
            body.mean_returns,
            body.volatilities,
            body.correlations,
            body.n_simulations,
            body.horizon,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/full-risk-report")
def full_risk_report(body: FullRiskReportRequest):
    """Generate a comprehensive risk report combining VaR, CVaR, drawdown, and scenarios."""
    try:
        result = _engine.full_risk_report(
            body.returns,
            body.price_series,
            body.portfolio_weights,
            body.confidence,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
