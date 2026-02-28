"""
W101 — Convergence Cockpit v1 Route

Prefix: /api/v3/cockpit
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.core.convergence_cockpit_v1 import (
    clear_cockpit_data,
    create_ticket,
    get_ticket,
    list_scenarios,
    list_sessions,
    list_tickets,
    run_scenario,
)

router = APIRouter()


# ─── Pydantic models ──────────────────────────────────────────────────────────

class CreateTicketRequest(BaseModel):
    title: str = Field(..., min_length=1)
    scenario_id: str = Field(...)
    session_id: str = Field(default="")
    evidence_ids: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)


# ─── Scenarios ────────────────────────────────────────────────────────────────

@router.get("/scenarios")
async def get_scenarios():
    return {"scenarios": list_scenarios(), "total": len(list_scenarios())}


@router.post("/scenarios/{scenario_id}/run", status_code=201)
async def run_scenario_endpoint(scenario_id: str):
    try:
        result = await run_scenario(scenario_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result


@router.get("/sessions")
async def get_sessions():
    sessions = await list_sessions()
    return {"sessions": sessions, "total": len(sessions)}


# ─── Tickets ─────────────────────────────────────────────────────────────────

@router.post("/tickets", status_code=201)
async def create_ticket_endpoint(req: CreateTicketRequest):
    try:
        ticket = await create_ticket(
            req.title,
            req.scenario_id,
            req.session_id,
            req.evidence_ids,
            req.actions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return ticket


@router.get("/tickets")
async def get_tickets(q: Optional[str] = None):
    tickets = await list_tickets(q=q)
    return {"tickets": tickets, "total": len(tickets)}


@router.get("/tickets/{ticket_id}")
async def get_ticket_endpoint(ticket_id: str):
    ticket = await get_ticket(ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.delete("/data")
async def clear_data():
    return await clear_cockpit_data()
