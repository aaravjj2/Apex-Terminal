"""
v1.40 — Agent Runner
Multi-step agent that uses internal search + citations.

STATUS: NOT IMPLEMENTED — requires real strategy engine (Phase 4).
Endpoints return 501 until real agent execution is wired.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])
logger = logging.getLogger(__name__)

_NOT_IMPL = "Agent runner requires a real strategy engine (Phase 4). No fabricated data."


class AgentStep(BaseModel):
    step_id: str
    tool: str
    inputs: dict
    outputs: dict
    citations: List[str] = []
    duration_ms: int = 0


class AgentRun(BaseModel):
    run_id: str
    status: str  # "completed" | "running" | "failed"
    query: str
    steps: List[dict]
    final_output: str
    total_duration_ms: int


@router.post("/run")
async def run_agent(query: Optional[str] = None):
    """Execute an agent run. Requires Phase 4 strategy engine."""
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/runs")
async def list_runs():
    """Return list of completed agent runs."""
    return []


@router.get("/runs/hash")
async def runs_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Return a specific agent run."""
    raise HTTPException(status_code=404, detail=f"Run {run_id} not found")



@router.get("/tools")
async def list_tools():
    """Return available agent tools."""
    return [
        {"name": "search", "description": "Search internal index for strategies, backtests, etc."},
        {"name": "backtest", "description": "Run backtest on a strategy"},
        {"name": "risk_analysis", "description": "Compute Greeks and risk metrics"},
        {"name": "citations", "description": "Fetch citations/evidence for findings"},
        {"name": "synthesize", "description": "Synthesize findings into recommendation"},
    ]
