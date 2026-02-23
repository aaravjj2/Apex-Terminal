"""W98 — Walk-Forward + Robustness v3 routes."""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "backend"))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.walkforward_v3 import (
    WalkConfig,
    run_walk_forward,
    run_robustness,
    compute_sensitivity_heatmap,
    list_configs,
    list_folds,
    list_robustness_runs,
    clear_walkforward_data,
)

router = APIRouter()


class RunWalkForwardBody(BaseModel):
    strategy: str = "ma_cross"
    n_folds: int = 4
    purge_bars: int = 2
    n_bars: int = 40
    initial_capital: float = 10_000.0


class RunRobustnessBody(BaseModel):
    config_id: str = ""
    n_bars: int = 40
    initial_capital: float = 10_000.0


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/run", status_code=201)
async def start_walk_forward(body: RunWalkForwardBody) -> dict:
    """Run walk-forward analysis and return fold results."""
    if body.n_folds < 2:
        raise HTTPException(status_code=400, detail="n_folds must be >= 2")
    if body.purge_bars < 0:
        raise HTTPException(status_code=400, detail="purge_bars must be >= 0")
    config = WalkConfig(
        strategy=body.strategy,
        n_folds=body.n_folds,
        purge_bars=body.purge_bars,
        n_bars=body.n_bars,
        initial_capital=body.initial_capital,
    )
    result = await run_walk_forward(config)
    return result


@router.post("/robustness", status_code=201)
async def start_robustness(body: RunRobustnessBody) -> dict:
    """Run robustness matrix analysis."""
    config_id = body.config_id or "standalone"
    result = await run_robustness(config_id, n_bars=body.n_bars, initial_capital=body.initial_capital)
    return result


@router.get("/heatmap")
async def get_heatmap(n_bars: int = 40) -> dict:
    """Return slippage × spread sensitivity heatmap."""
    return compute_sensitivity_heatmap(n_bars=n_bars)


@router.get("/configs")
async def get_configs(limit: int = 20) -> dict:
    """List walk-forward configurations."""
    configs = await list_configs(limit=limit)
    return {"configs": configs, "count": len(configs)}


@router.get("/folds/{config_id}")
async def get_folds(config_id: str) -> dict:
    """Get fold results for a config."""
    folds = await list_folds(config_id)
    return {"folds": folds, "count": len(folds), "config_id": config_id}


@router.get("/robustness/{config_id}")
async def get_robustness_runs(config_id: str) -> dict:
    """Get robustness matrix results for a config."""
    rows = await list_robustness_runs(config_id)
    return {"rows": rows, "count": len(rows), "config_id": config_id}


@router.delete("/data")
async def delete_data() -> dict:
    """Clear all walk-forward data."""
    return await clear_walkforward_data()
