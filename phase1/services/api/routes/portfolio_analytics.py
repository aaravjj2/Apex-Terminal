"""
portfolio_analytics.py — Portfolio Analytics REST API
=====================================================
Endpoints for portfolio management, performance metrics, drawdown analysis,
factor analysis, optimization, attribution, and risk budgeting.

Endpoints:
    POST /api/v1/portfolio/create                → Create portfolio
    GET  /api/v1/portfolio/{name}/summary        → Portfolio summary
    POST /api/v1/portfolio/{name}/position/open   → Open position
    POST /api/v1/portfolio/{name}/position/close  → Close position
    POST /api/v1/portfolio/{name}/update-prices   → Update all prices
    GET  /api/v1/portfolio/{name}/positions       → List positions
    GET  /api/v1/portfolio/{name}/sector-exposure → Sector breakdown
    GET  /api/v1/portfolio/{name}/concentration   → Concentration analysis
    GET  /api/v1/portfolio/{name}/trades          → Closed trade history
    POST /api/v1/portfolio/performance/returns     → Compute returns
    POST /api/v1/portfolio/performance/report     → Full performance report
    POST /api/v1/portfolio/performance/sharpe     → Sharpe ratio
    POST /api/v1/portfolio/performance/sortino    → Sortino ratio
    POST /api/v1/portfolio/performance/var        → VaR/CVaR
    POST /api/v1/portfolio/performance/drawdown   → Drawdown analysis
    POST /api/v1/portfolio/performance/rolling-sharpe → Rolling Sharpe
    POST /api/v1/portfolio/performance/trade-stats → Trade statistics
    POST /api/v1/portfolio/factor/single          → Single-factor regression
    POST /api/v1/portfolio/factor/multi           → Multi-factor regression
    POST /api/v1/portfolio/factor/style           → Sharpe style analysis
    POST /api/v1/portfolio/optimize/mean-variance → Max Sharpe optimization
    POST /api/v1/portfolio/optimize/min-variance  → Min variance
    POST /api/v1/portfolio/optimize/risk-parity   → Risk parity
    POST /api/v1/portfolio/optimize/frontier      → Efficient frontier
    POST /api/v1/portfolio/attribution/brinson    → Brinson attribution
    POST /api/v1/portfolio/attribution/contribution → Security contribution
    POST /api/v1/portfolio/risk-budget/contributions → Risk contributions
    POST /api/v1/portfolio/risk-budget/component-var → Component VaR
    POST /api/v1/portfolio/risk-budget/stress-test → Stress test
    POST /api/v1/portfolio/risk-budget/monte-carlo → Monte Carlo VaR
    GET  /api/v1/portfolio/capabilities           → List capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

from phase1.services.portfolio_analytics_engine import (
    Portfolio, Position, TradeRecord,
    PerformanceEngine, DrawdownAnalyzer, FactorModel,
    PortfolioOptimizer, AttributionEngine, RiskBudgeting,
)

router = APIRouter(prefix="/api/v1/portfolio", tags=["Portfolio Analytics"])


# ─── Portfolio Store ─────────────────────────────────────────────────────────
_portfolios: Dict[str, Portfolio] = {}


def _get_portfolio(name: str) -> Portfolio:
    if name not in _portfolios:
        raise HTTPException(404, f"Portfolio '{name}' not found")
    return _portfolios[name]


# ─── Pydantic Models ────────────────────────────────────────────────────────

class CreatePortfolioRequest(BaseModel):
    name: str
    initial_capital: float = 100000.0


class OpenPositionRequest(BaseModel):
    symbol: str
    quantity: float
    price: float
    side: str = "long"
    asset_class: str = "equity"
    sector: str = ""
    commission: float = 0.0


class ClosePositionRequest(BaseModel):
    position_id: str
    price: float
    commission: float = 0.0


class UpdatePricesRequest(BaseModel):
    prices: Dict[str, float]


class ReturnSeriesRequest(BaseModel):
    prices: List[float]


class FullReportRequest(BaseModel):
    returns: List[float]
    benchmark: Optional[List[float]] = None
    risk_free_rate: float = 0.0


class VarRequest(BaseModel):
    returns: List[float]
    confidence: float = 0.95
    method: str = "historical"


class DrawdownRequest(BaseModel):
    returns: List[float]
    top_n: int = 5


class RollingSharpeRequest(BaseModel):
    returns: List[float]
    window: int = 60


class SingleFactorRequest(BaseModel):
    returns: List[float]
    factor: List[float]


class MultiFactorRequest(BaseModel):
    returns: List[float]
    factors: Dict[str, List[float]]


class StyleAnalysisRequest(BaseModel):
    returns: List[float]
    style_indices: Dict[str, List[float]]


class OptimizeRequest(BaseModel):
    returns: Dict[str, List[float]]
    target_return: Optional[float] = None
    risk_free_rate: float = 0.0


class FrontierRequest(BaseModel):
    returns: Dict[str, List[float]]
    n_points: int = 30


class BrinsonRequest(BaseModel):
    portfolio_weights: Dict[str, float]
    benchmark_weights: Dict[str, float]
    portfolio_returns: Dict[str, float]
    benchmark_returns: Dict[str, float]


class ContributionRequest(BaseModel):
    weights: Dict[str, float]
    returns: Dict[str, float]


class RiskContribRequest(BaseModel):
    weights: List[float]
    cov_matrix: List[List[float]]


class ComponentVarRequest(BaseModel):
    weights: List[float]
    cov_matrix: List[List[float]]
    confidence: float = 0.95
    portfolio_value: float = 1000000.0


class StressTestRequest(BaseModel):
    returns: Dict[str, List[float]]
    weights: List[float]
    scenarios: Dict[str, Dict[str, float]]


class MonteCarloRequest(BaseModel):
    returns: Dict[str, List[float]]
    weights: List[float]
    n_simulations: int = 10000
    confidence: float = 0.95


class TradeStatsRequest(BaseModel):
    trades: List[Dict[str, Any]]


# ═══════════════════════════════════════════════════════════════════════════════
#  Portfolio CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/create")
def create_portfolio(req: CreatePortfolioRequest) -> Dict[str, Any]:
    if req.name in _portfolios:
        raise HTTPException(409, f"Portfolio '{req.name}' already exists")
    _portfolios[req.name] = Portfolio(name=req.name, initial_capital=req.initial_capital)
    return {"status": "ok", "name": req.name}


@router.get("/{name}/summary")
def portfolio_summary(name: str) -> Dict[str, Any]:
    return _get_portfolio(name).summary()


@router.post("/{name}/position/open")
def open_position(name: str, req: OpenPositionRequest) -> Dict[str, Any]:
    p = _get_portfolio(name)
    pos = p.open_position(
        req.symbol, req.quantity, req.price,
        side=req.side, asset_class=req.asset_class,
        sector=req.sector, commission=req.commission,
    )
    return {"status": "ok", "position": pos.to_dict()}


@router.post("/{name}/position/close")
def close_position(name: str, req: ClosePositionRequest) -> Dict[str, Any]:
    p = _get_portfolio(name)
    trade = p.close_position(req.position_id, req.price, req.commission)
    if not trade:
        raise HTTPException(404, "Position not found")
    return {"status": "ok", "pnl": trade.pnl}


@router.post("/{name}/update-prices")
def update_prices(name: str, req: UpdatePricesRequest) -> Dict[str, Any]:
    p = _get_portfolio(name)
    p.update_prices(req.prices)
    return {"status": "ok", "equity": round(p.total_equity, 2)}


@router.get("/{name}/positions")
def list_positions(name: str) -> Dict[str, Any]:
    p = _get_portfolio(name)
    return {"positions": [pos.to_dict() for pos in p.positions]}


@router.get("/{name}/sector-exposure")
def sector_exposure(name: str) -> Dict[str, Any]:
    return {"sectors": _get_portfolio(name).sector_exposure()}


@router.get("/{name}/concentration")
def concentration(name: str, top_n: int = Query(5)) -> Dict[str, Any]:
    return _get_portfolio(name).concentration(top_n)


@router.get("/{name}/trades")
def trade_history(name: str) -> Dict[str, Any]:
    p = _get_portfolio(name)
    return {"trades": [
        {"id": t.id, "symbol": t.symbol, "side": t.side, "pnl": t.pnl, "pnl_pct": t.pnl_pct}
        for t in p._closed_trades
    ]}


# ═══════════════════════════════════════════════════════════════════════════════
#  Performance Metrics
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/performance/returns")
def compute_returns(req: ReturnSeriesRequest) -> Dict[str, Any]:
    prices = pd.Series(req.prices)
    rets = PerformanceEngine.returns(prices)
    cum = PerformanceEngine.cumulative_returns(rets)
    return {"returns": rets.tolist(), "cumulative": cum.tolist()}


@router.post("/performance/report")
def full_report(req: FullReportRequest) -> Dict[str, Any]:
    returns = pd.Series(req.returns)
    benchmark = pd.Series(req.benchmark) if req.benchmark else None
    return PerformanceEngine.full_report(returns, benchmark=benchmark,
                                         risk_free_rate=req.risk_free_rate)


@router.post("/performance/sharpe")
def sharpe_ratio(req: ReturnSeriesRequest) -> Dict[str, float]:
    returns = pd.Series(req.prices)  # actually returns
    return {
        "sharpe": PerformanceEngine.sharpe_ratio(returns),
        "sortino": PerformanceEngine.sortino_ratio(returns),
        "calmar": PerformanceEngine.calmar_ratio(returns),
        "omega": PerformanceEngine.omega_ratio(returns),
    }


@router.post("/performance/var")
def value_at_risk(req: VarRequest) -> Dict[str, Any]:
    returns = pd.Series(req.returns)
    if req.method == "parametric":
        var = PerformanceEngine.var_parametric(returns, req.confidence)
    else:
        var = PerformanceEngine.var_historical(returns, req.confidence)
    cvar = PerformanceEngine.cvar(returns, req.confidence)
    return {"var": var, "cvar": cvar, "confidence": req.confidence, "method": req.method}


@router.post("/performance/drawdown")
def drawdown_analysis(req: DrawdownRequest) -> Dict[str, Any]:
    returns = pd.Series(req.returns)
    return {
        "max_drawdown": DrawdownAnalyzer.max_drawdown(returns),
        "periods": DrawdownAnalyzer.drawdown_periods(returns, req.top_n),
        "pain_index": DrawdownAnalyzer.pain_index(returns),
        "ulcer_index": DrawdownAnalyzer.ulcer_index(returns),
    }


@router.post("/performance/rolling-sharpe")
def rolling_sharpe(req: RollingSharpeRequest) -> Dict[str, Any]:
    returns = pd.Series(req.returns)
    rs = PerformanceEngine.rolling_sharpe(returns, window=req.window)
    return {"rolling_sharpe": rs.tolist()}


@router.post("/performance/trade-stats")
def trade_stats(req: TradeStatsRequest) -> Dict[str, Any]:
    trades = [
        TradeRecord(
            symbol=t.get("symbol", ""), side=t.get("side", "long"),
            quantity=t.get("quantity", 0), entry_price=t.get("entry_price", 0),
            exit_price=t.get("exit_price", 0), entry_time=t.get("entry_time", ""),
            exit_time=t.get("exit_time", ""), commission=t.get("commission", 0),
        ) for t in req.trades
    ]
    return {
        "win_rate": PerformanceEngine.win_rate(trades),
        "profit_factor": PerformanceEngine.profit_factor(trades),
        "avg_win_loss_ratio": PerformanceEngine.avg_win_loss_ratio(trades),
        "expectancy": PerformanceEngine.expectancy(trades),
        "kelly_criterion": PerformanceEngine.kelly_criterion(trades),
        "total_trades": len(trades),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Factor Analysis
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/factor/single")
def single_factor(req: SingleFactorRequest) -> Dict[str, Any]:
    return FactorModel.single_factor(pd.Series(req.returns), pd.Series(req.factor))


@router.post("/factor/multi")
def multi_factor(req: MultiFactorRequest) -> Dict[str, Any]:
    factors = pd.DataFrame(req.factors)
    return FactorModel.multi_factor(pd.Series(req.returns), factors)


@router.post("/factor/style")
def style_analysis(req: StyleAnalysisRequest) -> Dict[str, Any]:
    styles = pd.DataFrame(req.style_indices)
    result = FactorModel.style_analysis(pd.Series(req.returns), styles)
    return {"style_weights": result}


# ═══════════════════════════════════════════════════════════════════════════════
#  Portfolio Optimization
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/optimize/mean-variance")
def optimize_mean_variance(req: OptimizeRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return PortfolioOptimizer.mean_variance(returns, target_return=req.target_return,
                                             risk_free_rate=req.risk_free_rate)


@router.post("/optimize/min-variance")
def optimize_min_variance(req: OptimizeRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return PortfolioOptimizer.min_variance(returns)


@router.post("/optimize/risk-parity")
def optimize_risk_parity(req: OptimizeRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return PortfolioOptimizer.risk_parity(returns)


@router.post("/optimize/frontier")
def efficient_frontier(req: FrontierRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return {"frontier": PortfolioOptimizer.efficient_frontier(returns, n_points=req.n_points)}


# ═══════════════════════════════════════════════════════════════════════════════
#  Attribution
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/attribution/brinson")
def brinson_attribution(req: BrinsonRequest) -> Dict[str, Any]:
    pw = pd.Series(req.portfolio_weights)
    bw = pd.Series(req.benchmark_weights)
    pr = pd.Series(req.portfolio_returns)
    br = pd.Series(req.benchmark_returns)
    return AttributionEngine.brinson_attribution(pw, bw, pr, br)


@router.post("/attribution/contribution")
def security_contribution(req: ContributionRequest) -> Dict[str, Any]:
    weights = pd.Series(req.weights)
    returns = pd.Series(req.returns)
    df = AttributionEngine.security_contribution(weights, returns)
    return {"contributions": df.to_dict(orient="index")}


# ═══════════════════════════════════════════════════════════════════════════════
#  Risk Budgeting
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/risk-budget/contributions")
def risk_contributions(req: RiskContribRequest) -> Dict[str, Any]:
    return RiskBudgeting.risk_contributions(np.array(req.weights), np.array(req.cov_matrix))


@router.post("/risk-budget/component-var")
def component_var(req: ComponentVarRequest) -> Dict[str, Any]:
    return RiskBudgeting.component_var(
        np.array(req.weights), np.array(req.cov_matrix),
        confidence=req.confidence, portfolio_value=req.portfolio_value,
    )


@router.post("/risk-budget/stress-test")
def stress_test(req: StressTestRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return {"results": RiskBudgeting.stress_test(returns, req.scenarios, np.array(req.weights))}


@router.post("/risk-budget/monte-carlo")
def monte_carlo_var(req: MonteCarloRequest) -> Dict[str, Any]:
    returns = pd.DataFrame(req.returns)
    return RiskBudgeting.monte_carlo_var(
        returns, np.array(req.weights),
        n_simulations=req.n_simulations, confidence=req.confidence,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Capabilities
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/capabilities")
def capabilities() -> Dict[str, Any]:
    return {
        "features": [
            "Portfolio CRUD with position tracking",
            "P&L tracking (unrealized, realized, total)",
            "Sector & asset class exposure breakdown",
            "Concentration (HHI) analysis",
            "Annualized return, volatility, Sharpe, Sortino, Calmar, Omega ratios",
            "VaR (historical, parametric), CVaR",
            "Maximum drawdown & drawdown periods",
            "Rolling Sharpe ratio",
            "Trade statistics (win rate, profit factor, expectancy, Kelly)",
            "Single & multi-factor regression",
            "Sharpe style analysis",
            "Mean-variance, min-variance, risk-parity optimization",
            "Efficient frontier generation",
            "Brinson attribution (allocation, selection, interaction)",
            "Security contribution analysis",
            "Risk contributions & component VaR",
            "Monte Carlo VaR simulation",
            "Stress testing with custom scenarios",
        ],
        "endpoint_count": 31,
    }
