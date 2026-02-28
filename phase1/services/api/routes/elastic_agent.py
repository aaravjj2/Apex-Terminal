"""
W95 — Elastic Agent Builder API Routes
GET  /status               — env gate status
POST /connect-test         — 503 if keys not set, 200 with info if set
POST /agents               — create agent config
GET  /agents               — list all agents
GET  /agents/{agent_id}    — get specific agent
POST /agents/{agent_id}/run — run agent with query
GET  /runs                 — all builder runs  
DELETE /data               — clear all builder data
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

try:
    from backend.core import elastic_agent_builder as eab
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend"))
    from core import elastic_agent_builder as eab

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────────────

class CreateAgentRequest(BaseModel):
    name: str
    description: str = ""
    tools: list[str] | None = None


class RunAgentRequest(BaseModel):
    query: str
    correlation_id: str | None = None


# ─── Status / connect-test ────────────────────────────────────────────────────

@router.get("/status")
async def get_status():
    """Return env gate status. Always 200."""
    return await eab.get_builder_status()


@router.post("/connect-test")
async def connect_test():
    """
    503 if ELASTIC_AGENT_URL / ELASTIC_AGENT_API_KEY not configured.
    200 with connection info if configured.
    This endpoint explicitly validates remote credentials are present.
    """
    status = await eab.get_builder_status()
    if not status["remote_enabled"]:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Elastic Agent Builder remote connection not configured",
                "reason": status["reason"],
                "required_env": ["ELASTIC_AGENT_URL", "ELASTIC_AGENT_API_KEY"],
            },
        )
    return {"ok": True, "mode": "remote", "url": eab.get_elastic_agent_url()}


# ─── Agent CRUD ───────────────────────────────────────────────────────────────

@router.post("/agents", status_code=201)
async def create_agent(req: CreateAgentRequest):
    result = await eab.create_agent(
        name=req.name,
        description=req.description,
        tools=req.tools,
    )
    return result


@router.get("/agents")
async def list_agents():
    agents = await eab.list_agents()
    return {"agents": agents, "count": len(agents)}


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = await eab.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# ─── Run ─────────────────────────────────────────────────────────────────────

@router.post("/agents/{agent_id}/run")
async def run_agent(agent_id: str, req: RunAgentRequest):
    agent = await eab.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    result = await eab.run_agent_with_builder(
        agent_id=agent_id,
        query=req.query,
        correlation_id=req.correlation_id,
    )
    return result


@router.get("/runs")
async def list_runs(agent_id: str | None = None, limit: int = 50):
    runs = await eab.list_agent_builder_runs(agent_id=agent_id, limit=limit)
    return {"runs": runs, "count": len(runs)}


# ─── Cleanup ─────────────────────────────────────────────────────────────────

@router.delete("/data")
async def clear_data():
    result = await eab.delete_agents()
    return result
