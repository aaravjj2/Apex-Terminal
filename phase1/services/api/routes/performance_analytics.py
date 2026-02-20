"""
Wave 10 — Performance Analytics
Portfolio and strategy performance analysis.
"""
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/performance", tags=["performance"])


class PerformancePeriod(BaseModel):
    period: str
    return_pct: float
    sharpe: float
    sortino: float
    max_drawdown_pct: float
    win_rate_pct: float
    profit_factor: float
    total_trades: int
    avg_trade_pnl: float


class StrategyPerformance(BaseModel):
    strategy_id: str
    strategy_name: str
    total_return_pct: float
    sharpe_ratio: float
    total_trades: int
    win_rate_pct: float
    avg_hold_days: float
    best_trade_pnl: float
    worst_trade_pnl: float


class PerformanceDashboard(BaseModel):
    account_value: float
    total_return_pct: float
    total_pnl: float
    periods: List[PerformancePeriod]
    strategies: List[StrategyPerformance]
    dashboard_hash: str


DEMO_PERIODS: List[dict] = [
    {"period": "1D", "return_pct": 0.45, "sharpe": 2.1, "sortino": 2.8, "max_drawdown_pct": -0.3, "win_rate_pct": 66.7, "profit_factor": 1.8, "total_trades": 3, "avg_trade_pnl": 45.0},
    {"period": "1W", "return_pct": 1.82, "sharpe": 1.9, "sortino": 2.5, "max_drawdown_pct": -0.8, "win_rate_pct": 62.5, "profit_factor": 1.6, "total_trades": 8, "avg_trade_pnl": 38.0},
    {"period": "1M", "return_pct": 5.34, "sharpe": 1.7, "sortino": 2.2, "max_drawdown_pct": -2.1, "win_rate_pct": 60.0, "profit_factor": 1.5, "total_trades": 25, "avg_trade_pnl": 35.0},
    {"period": "3M", "return_pct": 12.8, "sharpe": 1.5, "sortino": 2.0, "max_drawdown_pct": -4.5, "win_rate_pct": 58.3, "profit_factor": 1.4, "total_trades": 72, "avg_trade_pnl": 30.0},
    {"period": "YTD", "return_pct": 18.2, "sharpe": 1.4, "sortino": 1.8, "max_drawdown_pct": -6.2, "win_rate_pct": 57.0, "profit_factor": 1.35, "total_trades": 156, "avg_trade_pnl": 28.0},
]

DEMO_STRATEGIES: List[dict] = [
    {"strategy_id": "strat-pcs", "strategy_name": "Put Credit Spread", "total_return_pct": 8.5, "sharpe_ratio": 1.8, "total_trades": 42, "win_rate_pct": 71.4, "avg_hold_days": 12.5, "best_trade_pnl": 180.0, "worst_trade_pnl": -350.0},
    {"strategy_id": "strat-ic", "strategy_name": "Iron Condor", "total_return_pct": 5.2, "sharpe_ratio": 1.5, "total_trades": 28, "win_rate_pct": 67.9, "avg_hold_days": 18.0, "best_trade_pnl": 200.0, "worst_trade_pnl": -450.0},
    {"strategy_id": "strat-cds", "strategy_name": "Call Debit Spread", "total_return_pct": 3.8, "sharpe_ratio": 1.2, "total_trades": 35, "win_rate_pct": 51.4, "avg_hold_days": 8.0, "best_trade_pnl": 420.0, "worst_trade_pnl": -200.0},
    {"strategy_id": "strat-lc", "strategy_name": "Long Call", "total_return_pct": 1.5, "sharpe_ratio": 0.9, "total_trades": 22, "win_rate_pct": 45.5, "avg_hold_days": 5.0, "best_trade_pnl": 650.0, "worst_trade_pnl": -300.0},
    {"strategy_id": "strat-sp", "strategy_name": "Short Put", "total_return_pct": 4.1, "sharpe_ratio": 1.6, "total_trades": 29, "win_rate_pct": 69.0, "avg_hold_days": 15.0, "best_trade_pnl": 150.0, "worst_trade_pnl": -280.0},
]


def _build_dashboard() -> PerformanceDashboard:
    canonical = json.dumps({"periods": DEMO_PERIODS, "strategies": DEMO_STRATEGIES}, sort_keys=True, separators=(",", ":"))
    return PerformanceDashboard(
        account_value=10450.0,
        total_return_pct=18.2,
        total_pnl=1620.0,
        periods=[PerformancePeriod(**p) for p in DEMO_PERIODS],
        strategies=[StrategyPerformance(**s) for s in DEMO_STRATEGIES],
        dashboard_hash=hashlib.sha256(canonical.encode()).hexdigest(),
    )


@router.get("")
async def performance_dashboard():
    return _build_dashboard().model_dump()


@router.get("/periods")
async def list_periods():
    return {"periods": DEMO_PERIODS}


@router.get("/periods/{period}")
async def get_period(period: str):
    for p in DEMO_PERIODS:
        if p["period"] == period.upper():
            return p
    return {"period": period, "return_pct": 0, "sharpe": 0}


@router.get("/strategies")
async def list_strategy_perf():
    return {"strategies": DEMO_STRATEGIES}


@router.get("/strategies/{strategy_id}")
async def get_strategy_perf(strategy_id: str):
    for s in DEMO_STRATEGIES:
        if s["strategy_id"] == strategy_id:
            return s
    return {"strategy_id": strategy_id, "strategy_name": "Unknown"}


@router.get("/hash")
async def performance_hash():
    dashboard = _build_dashboard()
    return {"hash": dashboard.dashboard_hash}
