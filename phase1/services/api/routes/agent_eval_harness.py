"""
W102 — Agent Eval Harness Route

Prefix: /api/v3/eval
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.core.agent_eval_harness import (
    clear_eval_runs,
    get_eval_dataset,
    get_eval_run,
    list_eval_runs,
    run_eval,
    DATASET_VERSION,
)

router = APIRouter()


@router.get("/dataset")
async def get_dataset():
    return get_eval_dataset()


@router.post("/run", status_code=201)
async def run_eval_endpoint(version: str = DATASET_VERSION):
    result = await run_eval(dataset_version=version)
    return result


@router.get("/runs")
async def get_runs():
    runs = await list_eval_runs()
    return {"runs": runs, "total": len(runs)}


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    run = await get_eval_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Eval run not found")
    return run


@router.delete("/runs")
async def clear_runs():
    return await clear_eval_runs()
