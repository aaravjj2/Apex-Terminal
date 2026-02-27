"""
risk_v4.py — Risk Analytics API Routes (v4)
============================================
REST API powered by risk_engine.py

Endpoints:
    POST /api/v4/risk/var           → Compute VaR (historical, parametric, MC)
    POST /api/v4/risk/var_suite     → All 3 VaR methods simultaneously
    POST /api/v4/risk/cvar          → Expected Shortfall / CVaR
    POST /api/v4/risk/component_var → Component, Marginal, Incremental VaR
    POST /api/v4/risk/stress        → Run stress test (one scenario)
    POST /api/v4/risk/stress_all    → Run all 10 stress scenarios
    POST /api/v4/risk/reverse_stress → Find scenario closest to target loss
    POST /api/v4/risk/drawdown      → Drawdown analysis
    POST /api/v4/risk/performance   → Full performance metrics tearsheet
    POST /api/v4/risk/attribution   → Brinson-Hood-Beebower attribution
    POST /api/v4/risk/factor        → Fama-French factor decomposition
    POST /api/v4/risk/correlation   → Rolling correlation analysis
    GET  /api/v4/risk/stress_scenarios → List all available stress scenarios
"""

from __future__ import annotations
import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd

try:
    from ...risk_engine import (
        HistoricalVaR,
        ParametricVaR,
        MonteCarloVaR,
        ComponentVaR,
        compute_drawdowns,
        performance_metrics,
        STRESS_SCENARIOS,
        run_stress_test,
        run_all_stress_tests,
        reverse_stress_test,
        fama_french_decomposition,
        brinson_attribution,
        rolling_correlation_matrix,
        RiskEngine,
    )
    _RISK_AVAILABLE = True
except ImportError:
    _RISK_AVAILABLE = False
    STRESS_SCENARIOS = {}


router = APIRouter(prefix="/api/v4/risk", tags=["Risk Analytics v4"])


# ─── PYDANTIC MODELS ──────────────────────────────────────────────────────────

class ReturnSeriesRequest(BaseModel):
    returns: List[float] = Field(..., min_items=5, description="Daily return series (decimal, not %).")
    portfolio_value: float = Field(1_000_000.0, gt=0)
    confidence_levels: List[float] = Field(default=[0.95, 0.99, 0.999])
    holding_period: int = Field(1, ge=1, le=252)


class ComponentVarRequest(BaseModel):
    weights: List[float]
    covariance_matrix: List[List[float]]
    portfolio_value: float = 1_000_000.0
    confidence_level: float = 0.95
    holding_period: int = 1


class StressTestRequest(BaseModel):
    positions: List[Dict[str, Any]]
    scenario: Optional[str] = None   # If None, runs all


class DrawdownRequest(BaseModel):
    portfolio_values: List[float] = Field(..., min_items=2)


class PerformanceRequest(BaseModel):
    returns: List[float] = Field(..., min_items=10)
    benchmark: Optional[List[float]] = None
    risk_free_rate: float = 0.04


class AttributionRequest(BaseModel):
    portfolio_weights: List[List[float]]   # T x N
    benchmark_weights: List[List[float]]   # T x N
    asset_returns: List[List[float]]       # T x N
    benchmark_returns: List[List[float]]   # T x N
    symbols: Optional[List[str]] = None


class FactorRequest(BaseModel):
    portfolio_returns: List[float]
    mkt_returns: List[float]
    smb_returns: List[float]
    hml_returns: List[float]
    momentum_returns: Optional[List[float]] = None


class CorrelationRequest(BaseModel):
    returns_matrix: Dict[str, List[float]]   # {symbol: [returns...]}
    window: int = 63


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def safe(v) -> Optional[float]:
    if v is None:
        return None
    f = float(v)
    return None if (math.isnan(f) or math.isinf(f)) else round(f, 6)


def var_result_to_dict(result) -> Dict:
    import dataclasses
    if dataclasses.is_dataclass(result):
        d = dataclasses.asdict(result)
    elif hasattr(result, "__dict__"):
        d = vars(result)
    else:
        d = dict(result)
    return {k: safe(v) if isinstance(v, (int, float)) else v for k, v in d.items()}


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@router.post("/var")
async def compute_var(req: ReturnSeriesRequest, method: str = "historical"):
    """
    Compute Value-at-Risk using specified method.
    
    Methods:
    - historical: Historical simulation VaR
    - parametric: Variance-covariance (normal/Cornish-Fisher)
    - montecarlo: Monte Carlo simulation (50k paths)
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    returns = pd.Series(req.returns)

    try:
        if method == "historical":
            engine = HistoricalVaR()
        elif method == "parametric":
            engine = ParametricVaR()
        elif method in ("montecarlo", "monte_carlo", "mc"):
            engine = MonteCarloVaR()
        else:
            raise HTTPException(400, f"Unknown method: {method}. Use historical|parametric|montecarlo")

        result = engine.compute(
            returns           = returns,
            portfolio_value   = req.portfolio_value,
            confidence_levels = req.confidence_levels,
            holding_period    = req.holding_period,
        )
        return {"method": method, "result": var_result_to_dict(result)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/var_suite")
async def var_suite(req: ReturnSeriesRequest):
    """
    Compute all 3 VaR methods simultaneously for comparison.
    Returns side-by-side results from Historical, Parametric, and Monte Carlo.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    returns = pd.Series(req.returns)
    results = {}

    for method, cls in [("historical", HistoricalVaR), ("parametric", ParametricVaR),
                         ("montecarlo", MonteCarloVaR)]:
        try:
            r = cls().compute(
                returns           = returns,
                portfolio_value   = req.portfolio_value,
                confidence_levels = req.confidence_levels,
                holding_period    = req.holding_period,
            )
            results[method] = var_result_to_dict(r)
        except Exception as e:
            results[method] = {"error": str(e)}

    return {"results": results}


@router.post("/component_var")
async def component_var(req: ComponentVarRequest):
    """
    Compute Component, Marginal, and Incremental VaR.
    Shows how much each position contributes to portfolio risk.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        weights    = np.array(req.weights)
        cov_matrix = np.array(req.covariance_matrix)

        result = ComponentVaR.compute(
            weights           = weights,
            cov_matrix        = cov_matrix,
            portfolio_value   = req.portfolio_value,
            confidence_level  = req.confidence_level,
            holding_period    = req.holding_period,
        )
        return {k: v if isinstance(v, list) else safe(v) for k, v in result.items()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/stress")
async def stress_test(req: StressTestRequest):
    """
    Run a stress scenario against a portfolio.
    
    If scenario is None, runs all 10 scenarios.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        if req.scenario:
            result = run_stress_test(req.positions, req.scenario)
            import dataclasses
            if dataclasses.is_dataclass(result):
                return dataclasses.asdict(result)
            return vars(result)
        else:
            results = run_all_stress_tests(req.positions)
            return [dataclasses.asdict(r) if hasattr(r, "__dataclass_fields__") else vars(r)
                    for r in results]
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/reverse_stress")
async def reverse_stress(req: StressTestRequest, target_loss_pct: float = 20.0):
    """
    Identify which historical scenario gets closest to a target portfolio loss.
    Useful for finding the 'critical scenario' for a given exposure.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        result = reverse_stress_test(req.positions, target_loss_pct)
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/drawdown")
async def drawdown_analysis(req: DrawdownRequest):
    """
    Full drawdown analysis from a portfolio value series.
    Returns: max DD, duration, Calmar, Ulcer Index, all drawdown periods.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        values = pd.Series(req.portfolio_values)
        result = compute_drawdowns(values)

        import dataclasses
        if dataclasses.is_dataclass(result):
            d = dataclasses.asdict(result)
        else:
            d = vars(result)

        return {k: safe(v) if isinstance(v, (int, float)) else v for k, v in d.items()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/performance")
async def performance_tearsheet(req: PerformanceRequest):
    """
    Full performance metrics tearsheet.
    
    Returns: Sharpe, Sortino, Calmar, Omega, Information Ratio,
    Tracking Error, Beta, Alpha, Win Rate, Profit Factor, and more.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        returns   = pd.Series(req.returns)
        benchmark = pd.Series(req.benchmark) if req.benchmark else None
        metrics   = performance_metrics(returns, benchmark, req.risk_free_rate)
        return {k: safe(v) if isinstance(v, (int, float)) else v for k, v in metrics.items()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/attribution")
async def return_attribution(req: AttributionRequest):
    """
    Brinson-Hood-Beebower performance attribution.
    Decomposes active return into: Allocation + Selection + Interaction effects.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        pw = pd.DataFrame(req.portfolio_weights)
        bw = pd.DataFrame(req.benchmark_weights)
        pr = pd.DataFrame(req.asset_returns)
        br = pd.DataFrame(req.benchmark_returns)

        if req.symbols:
            pw.columns = req.symbols
            bw.columns = req.symbols
            pr.columns = req.symbols
            br.columns = req.symbols

        result = brinson_attribution(pw, bw, pr, br)

        import dataclasses
        if dataclasses.is_dataclass(result):
            base = dataclasses.asdict(result)
        else:
            base = vars(result)

        # by_sector is a DataFrame
        sector_data = None
        if result.by_sector is not None:
            sector_data = result.by_sector.to_dict(orient="index")

        return {
            "allocation_effect":   safe(result.allocation_effect),
            "selection_effect":    safe(result.selection_effect),
            "interaction_effect":  safe(result.interaction_effect),
            "total_active_return": safe(result.total_active_return),
            "by_sector":           sector_data,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/factor")
async def factor_decomposition(req: FactorRequest):
    """
    Fama-French 3- or 4-factor model decomposition.
    
    Decomposes portfolio returns into: Market (beta), Size (SMB), Value (HML), momentum.
    Returns factor loadings, R², alpha, and residual return.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        port_r = pd.Series(req.portfolio_returns)
        factors = pd.DataFrame({
            "mkt": req.mkt_returns,
            "smb": req.smb_returns,
            "hml": req.hml_returns,
        })
        if req.momentum_returns:
            factors["momentum"] = req.momentum_returns

        result = fama_french_decomposition(port_r, factors)

        import dataclasses
        if dataclasses.is_dataclass(result):
            d = dataclasses.asdict(result)
        else:
            d = vars(result)
        return {k: safe(v) if isinstance(v, (int, float)) else v for k, v in d.items()}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/correlation")
async def rolling_correlation(req: CorrelationRequest):
    """
    Compute rolling correlation matrix for a set of return series.
    Returns time series of correlations.
    """
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    try:
        df = pd.DataFrame(req.returns_matrix)
        corr_series = rolling_correlation_matrix(df, req.window)

        # Convert to JSON serialisable format
        result = {}
        for col in corr_series.columns:
            result[str(col)] = [safe(v) for v in corr_series[col].values]

        return {"window": req.window, "symbols": list(req.returns_matrix.keys()),
                "correlations": result, "periods": len(corr_series)}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/stress_scenarios")
async def list_stress_scenarios():
    """List all available stress scenarios with descriptions."""
    if not _RISK_AVAILABLE:
        raise HTTPException(503, "Risk engine unavailable")

    scenarios = []
    for name, cfg in STRESS_SCENARIOS.items():
        scenarios.append({
            "name":        name,
            "description": cfg.get("description", name),
            "equity_shock":    cfg.get("equity_shock", 0),
            "credit_shock":    cfg.get("credit_shock", 0),
            "rate_shock":      cfg.get("rate_shock", 0),
            "vol_shock":       cfg.get("vol_shock", 0),
        })

    return {"scenarios": scenarios, "count": len(scenarios)}
