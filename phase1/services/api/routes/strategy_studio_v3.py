"""W99 — Strategy Studio v3 routes."""
from __future__ import annotations

import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "backend"))

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any

from core.strategy_studio_v3 import (
    TEMPLATES,
    lint_strategy,
    create_strategy,
    get_strategy,
    list_strategies,
    update_strategy,
    archive_strategy,
    delete_strategy,
    get_strategy_history,
    clear_strategies,
)

router = APIRouter()


class StrategyBody(BaseModel):
    name: str = ""
    strategy_type: str = ""
    symbols: list[str] = []
    start_date: str = ""
    end_date: str = ""
    params: dict[str, Any] = {}


class UpdateBody(BaseModel):
    name: str | None = None
    strategy_type: str | None = None
    symbols: list[str] | None = None
    start_date: str | None = None
    end_date: str | None = None
    params: dict[str, Any] | None = None


class LintBody(BaseModel):
    name: str = ""
    strategy_type: str = ""
    symbols: list[str] = []
    start_date: str = ""
    end_date: str = ""
    params: dict[str, Any] = {}


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/templates")
async def get_templates() -> dict:
    """List strategy template gallery."""
    return {"templates": TEMPLATES, "count": len(TEMPLATES)}


@router.post("/lint")
async def run_lint(body: LintBody) -> dict:
    """Lint a strategy spec without persisting it."""
    errors = lint_strategy(body.model_dump())
    return {"valid": len(errors) == 0, "errors": errors, "error_count": len(errors)}


@router.post("/strategies", status_code=201)
async def create_new_strategy(body: StrategyBody) -> dict:
    """Create a strategy (lint first; reject if invalid)."""
    try:
        result = await create_strategy(body.model_dump())
    except ValueError as exc:
        try:
            errors = json.loads(str(exc))
        except Exception:
            errors = [{"field": "general", "rule": "error", "message": str(exc)}]
        raise HTTPException(status_code=422, detail=errors)
    return result


@router.get("/strategies")
async def search_strategies(q: str = Query(""), archived: bool = False) -> dict:
    """List or search strategies."""
    strategies = await list_strategies(query=q, archived=archived)
    return {"strategies": strategies, "count": len(strategies)}


@router.get("/strategies/{sid}")
async def get_one_strategy(sid: str) -> dict:
    """Get a single strategy by id."""
    s = await get_strategy(sid)
    if s is None:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {sid}")
    return s


@router.patch("/strategies/{sid}")
async def update_one_strategy(sid: str, body: UpdateBody) -> dict:
    """Partial update of a strategy (re-lints after merge)."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        return await update_strategy(sid, updates)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/strategies/{sid}/archive")
async def archive_one_strategy(sid: str) -> dict:
    """Archive a strategy."""
    return await archive_strategy(sid)


@router.get("/strategies/{sid}/history")
async def get_history(sid: str) -> dict:
    """Get version history for a strategy."""
    history = await get_strategy_history(sid)
    return {"history": history, "count": len(history)}


@router.delete("/strategies/{sid}")
async def delete_one_strategy(sid: str) -> dict:
    """Delete a strategy and its history."""
    return await delete_strategy(sid)


@router.delete("/strategies")
async def delete_all_strategies() -> dict:
    """Clear all strategies."""
    return await clear_strategies()
