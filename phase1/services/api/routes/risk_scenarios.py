"""
v1.47 — Risk Scenarios (DEMO-first)
Custom stress-test / what-if scenario configs and results.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/risk-scenarios", tags=["risk-scenarios"])

DEMO_SCENARIOS: List[dict] = [
    {
        "id": "scen-001",
        "name": "Black Monday Replay",
        "description": "Simulate a -22% single-day market crash",
        "shock": {"SPY": -0.22, "QQQ": -0.25, "VIX": 2.50},
        "portfolio_impact": -34500.00,
        "max_drawdown": 0.28,
        "recovery_days": 45,
        "status": "completed",
    },
    {
        "id": "scen-002",
        "name": "Rate Hike +100bp",
        "description": "Fed emergency rate hike of 100 basis points",
        "shock": {"SPY": -0.08, "TLT": -0.12, "QQQ": -0.10},
        "portfolio_impact": -12800.00,
        "max_drawdown": 0.14,
        "recovery_days": 18,
        "status": "completed",
    },
    {
        "id": "scen-003",
        "name": "Tech Rotation",
        "description": "10% tech sell-off with rotation into value",
        "shock": {"QQQ": -0.10, "AAPL": -0.12, "NVDA": -0.15, "XLV": 0.05},
        "portfolio_impact": -8200.00,
        "max_drawdown": 0.09,
        "recovery_days": 12,
        "status": "completed",
    },
    {
        "id": "scen-004",
        "name": "Vol Spike",
        "description": "VIX doubles from current level",
        "shock": {"VIX": 1.00, "SPY": -0.05},
        "portfolio_impact": -6100.00,
        "max_drawdown": 0.07,
        "recovery_days": 8,
        "status": "completed",
    },
]


@router.get("")
async def list_scenarios():
    """Return all demo scenarios."""
    return DEMO_SCENARIOS


@router.get("/hash")
async def scenarios_hash():
    """Determinism hash."""
    canonical = json.dumps(DEMO_SCENARIOS, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/{scenario_id}")
async def get_scenario(scenario_id: str):
    """Get single scenario by id."""
    for s in DEMO_SCENARIOS:
        if s["id"] == scenario_id:
            return s
    return {"error": "not found"}


@router.get("/worst-case/summary")
async def worst_case():
    """Return the worst-case scenario impact."""
    worst = min(DEMO_SCENARIOS, key=lambda s: s["portfolio_impact"])
    return {
        "scenario": worst["name"],
        "impact": worst["portfolio_impact"],
        "max_drawdown": worst["max_drawdown"],
    }
