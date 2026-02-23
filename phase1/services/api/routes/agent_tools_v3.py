"""
phase1/services/api/routes/agent_tools_v3.py — W94

Agent tools API with full audit trail:
  POST /api/v3/agent/run                  — Run agent with query
  GET  /api/v3/agent/runs                 — List recent agent runs
  GET  /api/v3/agent/runs/{run_id}        — Get run + traces
  GET  /api/v3/agent/runs/{run_id}/traces — Get tool traces for run
  GET  /api/v3/agent/tools                — List available tools
  DELETE /api/v3/agent/runs               — Clear all runs (test-only)
"""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "backend"))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from core.agent_tools import (
    run_agent,
    get_agent_run,
    list_agent_runs,
    get_tool_traces,
    clear_agent_data,
)

router = APIRouter()

AVAILABLE_TOOLS = [
    {"name": "search", "description": "Full-text search across ES entity indices"},
    {"name": "fetch_entity", "description": "Fetch a single entity document from ES"},
    {"name": "fetch_graph", "description": "Retrieve evidence graph subgraph from SQLite"},
    {"name": "summarize", "description": "Summarize text content with secrets redaction"},
    {"name": "create_ticket", "description": "Create a ticket entity (safe write action)"},
]


class RunAgentRequest(BaseModel):
    query: str
    correlation_id: Optional[str] = None
    tools: Optional[List[str]] = None


@router.post("/run")
async def post_run_agent(body: RunAgentRequest):
    """Execute an agent run with the provided query."""
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")
    result = await run_agent(
        query=body.query,
        correlation_id=body.correlation_id,
        tools=body.tools,
    )
    return result


@router.get("/runs")
async def get_runs(limit: int = 50):
    """List recent agent runs."""
    runs = await list_agent_runs(limit=limit)
    return {"runs": runs, "count": len(runs)}


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get a specific agent run with its tool traces."""
    run = await get_agent_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")
    return run


@router.get("/runs/{run_id}/traces")
async def get_traces(run_id: str):
    """Get tool traces for a specific agent run."""
    traces = await get_tool_traces(run_id)
    return {"run_id": run_id, "traces": traces, "count": len(traces)}


@router.get("/tools")
async def get_available_tools():
    """Return list of available agent tools."""
    return {"tools": AVAILABLE_TOOLS, "count": len(AVAILABLE_TOOLS)}


@router.delete("/runs")
async def reset_agent_data():
    """Clear all agent runs and traces (test-only utility)."""
    await clear_agent_data()
    return {"ok": True, "cleared": True}
