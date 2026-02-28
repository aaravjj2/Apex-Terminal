"""
portfolio_v4.py — Portfolio Construction & Analytics API Routes (v4)
======================================================================
REST API powered by portfolio_engine.py

Endpoints:
    POST /api/v4/portfolio/optimize         → Run a specific optimization method
    POST /api/v4/portfolio/compare          → Compare all optimization methods
    POST /api/v4/portfolio/frontier         → Compute efficient frontier (200 points)
    POST /api/v4/portfolio/rebalance        → Compute rebalancing trades
    POST /api/v4/portfolio/analytics        → Full analytics for a weight vector
    POST /api/v4/portfolio/performance      → Portfolio performance from returns
    POST /api/v4/portfolio/attribution      → Brinson attribution by sector
    POST /api/v4/portfolio/rolling          → Rolling performance metrics
    POST /api/v4/portfolio/black_litterman  → Black-Litterman model
    POST /api/v4/portfolio/holdings         → Convert weights to share quantities
    GET  /api/v4/portfolio/methods          → List optimization methods
"""

from __future__ import annotations
import math
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd

try:
    from ...portfolio_engine import (
        PortfolioOptimizer,
        compute_rebalancing_trades,
        portfolio_performance,
        brinson_attribution,
        rolling_portfolio_analytics,
        black_litterman,
        weights_to_holdings,
        risk_contributions,
        pct_risk_contributions,
        concentration_score,
        diversification_ratio,
        effective_n,
        ledoit_wolf_shrinkage,
        sample_covariance,
        marginal_risk_contributions,
    )
    _PORTFOLIO_AVAILABLE = True
except ImportError:
    _PORTFOLIO_AVAILABLE = False


router = APIRouter(prefix="/api/v4/portfolio", tags=["Portfolio v4"])


# ─── PYDANTIC MODELS ──────────────────────────────────────────────────────────

class ReturnsRequest(BaseModel):
    """Asset returns matrix: {symbol: [daily_returns...]} """
    returns: Dict[str, List[float]]
    risk_free_rate: float = 0.04
    cov_method: Literal["sample", "ledoit_wolf", "ewma"] = "ledoit_wolf"
    return_method: Literal["historical", "capm", "ewma"] = "historical"
    max_weight: float = Field(0.30, ge=0.0, le=1.0)
    min_weight: float = Field(0.00, ge=0.0, le=1.0)
    ewma_halflife: int = Field(60, ge=10, le=252)


class OptimizeRequest(ReturnsRequest):
    method: Literal[
        "minimum_variance", "maximum_sharpe", "risk_parity",
        "hrp", "equal_weight", "maximum_diversification"
    ] = "maximum_sharpe"


class BLRequest(BaseModel):
    market_weights: List[float]
    returns: Dict[str, List[float]]
    views: List[Dict[str, Any]]  # Each: {symbol, expected_return, confidence}
    tau: float = 0.05
    risk_aversion: float = 3.0
    risk_free_rate: float = 0.04


class RebalanceRequest(BaseModel):
    current_weights: Dict[str, float]
    target_weights:  Dict[str, float]
    portfolio_value: float = Field(1_000_000.0, gt=0)
    drift_threshold: float = Field(0.02, ge=0.0, le=0.5)
    min_trade_value: float = Field(100.0, ge=0)
    commission_per_trade: float = 1.0


class PerformanceRequest(BaseModel):
    weights:        List[float]
    returns:        Dict[str, List[float]]
    risk_free_rate: float = 0.04


class AttributionRequest(BaseModel):
    portfolio_weights: List[List[float]]   # T x N
    benchmark_weights: List[List[float]]
    asset_returns:     List[List[float]]
    benchmark_returns: List[List[float]]
    symbols:           Optional[List[str]] = None
    sectors:           Optional[Dict[str, str]] = None   # symbol → sector


class RollingRequest(ReturnsRequest):
    weights: List[float]
    window:  int = Field(63, ge=10, le=252)
    benchmark: Optional[List[float]] = None


class HoldingsRequest(BaseModel):
    weights:         Dict[str, float]
    portfolio_value: float
    prices:          Dict[str, float]
    lot_size:        int = 1


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def safe(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 6)
    except Exception:
        return None


def make_returns_df(returns_dict: Dict[str, List[float]]) -> pd.DataFrame:
    # Align lengths
    min_len = min(len(v) for v in returns_dict.values()) if returns_dict else 0
    return pd.DataFrame({k: v[:min_len] for k, v in returns_dict.items()})


def opt_result_to_dict(res) -> Dict:
    import dataclasses
    if dataclasses.is_dataclass(res):
        d = dataclasses.asdict(res)
        # Remove heavy frontier_df from default response
        d.pop("frontier_df", None)
        return d
    return vars(res) if hasattr(res, "__dict__") else {}


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@router.post("/optimize")
async def optimize_portfolio(req: OptimizeRequest):
    """
    Run portfolio optimization using a specified method.
    
    Methods: minimum_variance | maximum_sharpe | risk_parity | hrp | equal_weight | 
             maximum_diversification
    
    Returns optimal weights and expected return/volatility/Sharpe.
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    if not req.returns:
        raise HTTPException(400, "Returns data required")

    df = make_returns_df(req.returns)
    if len(df) < 30:
        raise HTTPException(400, "Minimum 30 return observations required")

    try:
        optimizer = PortfolioOptimizer(
            returns       = df,
            risk_free_rate= req.risk_free_rate,
            cov_method    = req.cov_method,
            return_method = req.return_method,
            max_weight    = req.max_weight,
            min_weight    = req.min_weight,
            ewma_halflife = req.ewma_halflife,
        )

        method_map = {
            "minimum_variance":       optimizer.minimum_variance,
            "maximum_sharpe":         optimizer.maximum_sharpe,
            "risk_parity":            optimizer.risk_parity,
            "hrp":                    optimizer.hrp,
            "equal_weight":           optimizer.equal_weight,
            "maximum_diversification": optimizer.maximum_diversification,
        }

        fn = method_map.get(req.method)
        if not fn:
            raise HTTPException(400, f"Unknown method: {req.method}")

        result = fn()

        # Add analytics
        w      = np.array(list(result.weights.values()))
        conc   = concentration_score(w)
        prc    = pct_risk_contributions(w, optimizer.cov_matrix)
        div_r  = diversification_ratio(w, optimizer.cov_matrix)

        return {
            "method":             req.method,
            "weights":            result.weights,
            "expected_return":    safe(result.expected_return),
            "expected_vol":       safe(result.expected_vol),
            "sharpe_ratio":       safe(result.sharpe_ratio),
            "concentration":      conc,
            "diversification_ratio": safe(div_r),
            "risk_contributions": {sym: safe(float(r)*100) for sym, r in
                                   zip(list(req.returns.keys()), prc)},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/compare")
async def compare_methods(req: ReturnsRequest):
    """
    Compare all 6 optimization methods side-by-side.
    Returns a table with return, vol, Sharpe, max weight, effective N for each method.
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    df = make_returns_df(req.returns)
    if len(df) < 30:
        raise HTTPException(400, "Minimum 30 return observations required")

    try:
        optimizer = PortfolioOptimizer(
            df,
            risk_free_rate=req.risk_free_rate,
            cov_method=req.cov_method,
            return_method=req.return_method,
            max_weight=req.max_weight,
            min_weight=req.min_weight,
        )
        comparison_df = optimizer.compare_methods()
        records = comparison_df.reset_index().to_dict(orient="records")
        safe_records = []
        for r in records:
            safe_records.append({k: safe(v) if isinstance(v, float) else v for k, v in r.items()})

        return {"comparison": safe_records, "symbols": list(req.returns.keys())}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/frontier")
async def efficient_frontier(req: ReturnsRequest, n_portfolios: int = 200):
    """
    Compute the efficient frontier (return vs volatility trade-off).
    Returns n_portfolios points along the frontier with weights.
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    df = make_returns_df(req.returns)
    if len(df) < 30:
        raise HTTPException(400, "Minimum 30 return observations required")

    try:
        optimizer = PortfolioOptimizer(
            df,
            risk_free_rate=req.risk_free_rate,
            cov_method=req.cov_method,
            return_method=req.return_method,
            max_weight=req.max_weight,
        )
        frontier_df = optimizer.efficient_frontier(n_portfolios=n_portfolios)

        records = []
        for _, row in frontier_df.iterrows():
            records.append({k: safe(v) if isinstance(v, float) else v for k, v in row.items()})

        return {
            "frontier": records,
            "points":   len(records),
            "symbols":  list(req.returns.keys()),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/rebalance")
async def rebalance(req: RebalanceRequest):
    """
    Compute rebalancing trades to move from current to target allocation.
    Respects drift_threshold — only trades with significant drift are included.
    Returns ordered list of buy/sell trades sorted by drift magnitude.
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    try:
        trades = compute_rebalancing_trades(
            current_weights      = req.current_weights,
            target_weights       = req.target_weights,
            portfolio_value      = req.portfolio_value,
            min_trade_value      = req.min_trade_value,
            commission_per_trade = req.commission_per_trade,
            drift_threshold      = req.drift_threshold,
        )

        import dataclasses
        return {
            "trades": [
                {k: safe(v) if isinstance(v, float) else v
                 for k, v in dataclasses.asdict(t).items()}
                for t in trades
            ],
            "total_trades":     len(trades),
            "total_buys":       sum(1 for t in trades if t.action == "buy"),
            "total_sells":      sum(1 for t in trades if t.action == "sell"),
            "total_turnover":   safe(sum(t.trade_value for t in trades)),
            "estimated_cost":   safe(sum(t.estimated_cost for t in trades)),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/analytics")
async def portfolio_analytics(req: PerformanceRequest):
    """
    Full analytics for given weight vector and returns.
    Returns: performance metrics, concentration, risk contributions, diversification.
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    df = make_returns_df(req.returns)
    w  = np.array(req.weights)

    if len(w) != len(df.columns):
        raise HTTPException(400, f"Weights length ({len(w)}) must match symbols ({len(df.columns)})")

    w = w / w.sum() if w.sum() > 0 else np.full(len(w), 1/len(w))

    try:
        # Build cov matrix
        cov = ledoit_wolf_shrinkage(df)
        perf = portfolio_performance(w, df, req.risk_free_rate)
        conc = concentration_score(w)
        prc  = pct_risk_contributions(w, cov)
        div  = diversification_ratio(w, cov)

        return {
            "performance":           {k: safe(v) for k, v in perf.items()},
            "concentration":         conc,
            "diversification_ratio": safe(div),
            "risk_contributions": {
                sym: {"pct_risk": safe(float(r)*100), "weight": safe(float(ww)*100)}
                for sym, r, ww in zip(df.columns, prc, w)
            },
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/black_litterman")
async def black_litterman_optimize(req: BLRequest):
    """
    Black-Litterman model portfolio optimization.
    
    Blends CAPM equilibrium returns with investor views.
    Views format: [{symbol: str, expected_return: float, confidence: float}]
    
    Confidence ∈ (0, 1): higher = more weight to your view vs equilibrium.
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    df = make_returns_df(req.returns)
    symbols = list(req.returns.keys())
    N = len(symbols)

    try:
        cov = ledoit_wolf_shrinkage(df)
        market_w = np.array(req.market_weights)
        if len(market_w) != N:
            raise HTTPException(400, f"market_weights length ({len(market_w)}) must match symbols ({N})")

        market_w = market_w / market_w.sum()

        # Build views matrices
        k = len(req.views)
        if k == 0:
            raise HTTPException(400, "At least one view is required")

        P = np.zeros((k, N))
        Q = np.zeros(k)
        Omega_diag = np.zeros(k)

        for i, view in enumerate(req.views):
            sym  = view.get("symbol")
            ret  = view.get("expected_return", 0)
            conf = view.get("confidence", 0.5)

            if sym in symbols:
                j = symbols.index(sym)
                P[i, j] = 1.0
            Q[i] = ret
            Omega_diag[i] = (1 - conf) / (conf + 1e-8) * req.tau * float(cov[i, i] if i < N else 0.01)

        Omega = np.diag(Omega_diag)

        posterior_ret, posterior_cov = black_litterman(
            market_w, cov, P, Q, Omega, req.tau, req.risk_free_rate, req.risk_aversion
        )

        # Optimize using posterior returns
        from ...portfolio_engine import maximum_sharpe_portfolio
        w_bl = maximum_sharpe_portfolio(posterior_ret, posterior_cov, req.risk_free_rate)

        return {
            "weights":           {sym: safe(float(w)) for sym, w in zip(symbols, w_bl)},
            "posterior_returns": {sym: safe(float(r)) for sym, r in zip(symbols, posterior_ret)},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/holdings")
async def convert_to_holdings(req: HoldingsRequest):
    """
    Convert target weights to share quantities given current prices.
    Rounds to nearest lot size (default: 1 share).
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    try:
        holdings = weights_to_holdings(
            req.weights, req.portfolio_value, req.prices, req.lot_size
        )
        total_invested = sum(h["actual_value"] for h in holdings.values())
        cash_remaining = req.portfolio_value - total_invested

        return {
            "holdings":         holdings,
            "total_invested":   safe(total_invested),
            "cash_remaining":   safe(cash_remaining),
            "portfolio_value":  safe(req.portfolio_value),
            "invested_pct":     safe(total_invested / req.portfolio_value * 100),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/rolling")
async def rolling_analytics(req: RollingRequest):
    """
    Compute rolling performance metrics for a fixed-weight portfolio.
    Returns time series of rolling Sharpe, Vol, Return, Beta.
    """
    if not _PORTFOLIO_AVAILABLE:
        raise HTTPException(503, "Portfolio engine unavailable")

    df = make_returns_df(req.returns)
    w  = np.array(req.weights)
    if len(w) != len(df.columns):
        raise HTTPException(400, "Weights/symbols length mismatch")
    w = w / w.sum() if w.sum() > 0 else np.full(len(w), 1/len(w))

    try:
        bench = pd.Series(req.benchmark) if req.benchmark else None
        rolling = rolling_portfolio_analytics(w, df, req.window, req.risk_free_rate, bench)
        if rolling.empty:
            return {"series": [], "window": req.window}
        records = [{k: safe(v) if isinstance(v, float) else str(k_) for k, v in row.items()}
                   for k_, row in rolling.iterrows()]
        return {"series": records, "window": req.window}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/methods")
async def list_methods():
    """List all available portfolio optimization methods."""
    return {
        "methods": [
            {
                "name": "minimum_variance",
                "description": "Lowest portfolio volatility (conservative, often concentrated)",
                "pros": "Lowest risk, well-known formula",
                "cons": "May ignore returns, can be concentrated in low-vol assets",
            },
            {
                "name": "maximum_sharpe",
                "description": "Highest risk-adjusted return (tangency portfolio)",
                "pros": "Maximizes return per unit of risk",
                "cons": "Sensitive to return estimates, can be highly concentrated",
            },
            {
                "name": "risk_parity",
                "description": "Equal risk contribution from each asset",
                "pros": "Robust diversification, less sensitive to return estimates",
                "cons": "Typically underweights equities vs bonds",
            },
            {
                "name": "hrp",
                "description": "Hierarchical Risk Parity (Lopez de Prado method)",
                "pros": "Handles poorly conditioned covariance matrices, more robust than MVO",
                "cons": "More complex, less intuitive",
            },
            {
                "name": "equal_weight",
                "description": "1/N equal allocation to all assets",
                "pros": "Simple, robust, hard to beat in practice",
                "cons": "Ignores risk and return information",
            },
            {
                "name": "maximum_diversification",
                "description": "Maximizes the diversification ratio",
                "pros": "Maximizes benefit from diversification",
                "cons": "Based on correlation assumptions which can change",
            },
        ]
    }
