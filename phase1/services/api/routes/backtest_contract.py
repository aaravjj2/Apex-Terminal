"""W97 — Backtesting Correctness Contract routes."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "backend"))

from core.backtest_v3 import (
    GOLDEN_RUNS,
    execute_golden_run,
    list_golden_run_defs,
    list_backtest_runs,
    clear_backtest_runs,
    validate_run_data,
    get_invariant_definitions,
)

router = APIRouter()


# ─── Models ───────────────────────────────────────────────────────────────────

class ValidateBody(BaseModel):
    strategy_type: str = ""
    symbol: str = ""
    start_date: str = ""
    end_date: str = ""
    initial_capital: Any = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/golden-runs")
async def get_golden_runs() -> dict:
    """List all 3 frozen golden run definitions."""
    runs = await list_golden_run_defs()
    return {"golden_runs": runs, "count": len(runs)}


@router.get("/golden-runs/{golden_id}")
async def get_golden_run(golden_id: str) -> dict:
    """Get a specific golden run definition."""
    g = GOLDEN_RUNS.get(golden_id)
    if not g:
        raise HTTPException(status_code=404, detail=f"Golden run not found: {golden_id}")
    return {
        "id": g.id,
        "name": g.name,
        "strategy_type": g.strategy_type,
        "description": g.description,
        "expected_total_return": g.expected_total_return,
        "expected_trade_count": g.expected_trade_count,
        "expected_final_equity": g.expected_final_equity,
    }


@router.post("/golden-runs/{golden_id}/execute", status_code=201)
async def run_golden(golden_id: str) -> dict:
    """Execute a golden run and compare actual vs frozen expected."""
    if golden_id not in GOLDEN_RUNS:
        raise HTTPException(status_code=404, detail=f"Golden run not found: {golden_id}")
    try:
        result = await execute_golden_run(golden_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.post("/validate")
async def validate_run(body: ValidateBody) -> dict:
    """Validate a run spec — refuse if fields missing/invalid."""
    data = body.model_dump()
    errors = validate_run_data(data)
    if errors:
        return {
            "valid": False,
            "errors": errors,
        }
    return {"valid": True, "errors": []}


@router.get("/invariants")
async def get_invariants() -> dict:
    """Return invariant definitions enforced on every run."""
    defs = get_invariant_definitions()
    return {"invariants": defs, "count": len(defs)}


@router.get("/runs")
async def get_runs(limit: int = 50) -> dict:
    """List executed backtest runs."""
    runs = await list_backtest_runs(limit=limit)
    return {"runs": runs, "count": len(runs)}


@router.delete("/runs")
async def delete_runs() -> dict:
    """Clear all executed backtest run records."""
    result = await clear_backtest_runs()
    return result
