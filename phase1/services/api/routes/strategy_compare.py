"""
v1.49 — Strategy Comparison Matrix (DEMO-first)
Side-by-side multi-strategy performance metrics.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/strategy-compare", tags=["strategy-compare"])

DEMO_STRATEGIES: List[dict] = [
    {
        "id": "strat-001",
        "name": "Iron Condor",
        "sharpe": 1.45,
        "sortino": 1.82,
        "max_drawdown": 0.08,
        "win_rate": 0.75,
        "avg_return": 0.024,
        "total_trades": 48,
        "profit_factor": 2.10,
        "calmar": 3.00,
    },
    {
        "id": "strat-002",
        "name": "SMA Crossover",
        "sharpe": 1.12,
        "sortino": 1.35,
        "max_drawdown": 0.14,
        "win_rate": 0.67,
        "avg_return": 0.018,
        "total_trades": 96,
        "profit_factor": 1.75,
        "calmar": 1.29,
    },
    {
        "id": "strat-003",
        "name": "Momentum Scanner",
        "sharpe": 1.68,
        "sortino": 2.10,
        "max_drawdown": 0.11,
        "win_rate": 0.83,
        "avg_return": 0.032,
        "total_trades": 24,
        "profit_factor": 2.85,
        "calmar": 2.91,
    },
    {
        "id": "strat-004",
        "name": "Covered Call",
        "sharpe": 0.95,
        "sortino": 1.10,
        "max_drawdown": 0.06,
        "win_rate": 0.90,
        "avg_return": 0.012,
        "total_trades": 36,
        "profit_factor": 3.20,
        "calmar": 2.00,
    },
    {
        "id": "strat-005",
        "name": "Mean Reversion",
        "sharpe": 1.30,
        "sortino": 1.55,
        "max_drawdown": 0.10,
        "win_rate": 0.72,
        "avg_return": 0.021,
        "total_trades": 60,
        "profit_factor": 2.00,
        "calmar": 2.10,
    },
]


@router.get("")
async def list_strategies():
    """Return all strategy comparison entries."""
    return DEMO_STRATEGIES


@router.get("/hash")
async def compare_hash():
    """Determinism hash."""
    canonical = json.dumps(DEMO_STRATEGIES, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/rank/{metric}")
async def rank_by_metric(metric: str):
    """Rank strategies by a given metric (desc)."""
    valid = ["sharpe", "sortino", "win_rate", "profit_factor", "calmar", "avg_return"]
    if metric not in valid:
        return {"error": f"Invalid metric. Choose from: {valid}"}
    ranked = sorted(DEMO_STRATEGIES, key=lambda s: s.get(metric, 0), reverse=True)
    return [{"rank": i + 1, "name": s["name"], metric: s[metric]} for i, s in enumerate(ranked)]


@router.get("/{strategy_id}")
async def get_strategy(strategy_id: str):
    """Get single strategy metrics."""
    for s in DEMO_STRATEGIES:
        if s["id"] == strategy_id:
            return s
    return {"error": "not found"}
