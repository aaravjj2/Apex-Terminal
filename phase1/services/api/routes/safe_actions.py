"""
Wave 107 — Safe actions (tickets) API routes.
Prefix: /api/v3/tickets
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from backend.core.safe_actions import (
    SAFE_ACTIONS_VERSION,
    create_ticket,
    update_ticket,
    search_tickets,
    get_ticket,
    get_audit_trail,
    get_edges,
    clear_all_data,
    check_rbac,
)

router = APIRouter()


class CreateTicketRequest(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    created_by: str
    role: str
    metadata: Optional[dict] = None
    ticket_id: Optional[str] = None  # for idempotency


class UpdateTicketRequest(BaseModel):
    updated_by: str
    role: str
    updates: dict


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/version")
async def version():
    return {"version": SAFE_ACTIONS_VERSION, "status": "ok"}


@router.post("/tickets", status_code=201)
async def create(req: CreateTicketRequest):
    try:
        ticket = await create_ticket(
            title=req.title,
            description=req.description,
            priority=req.priority,
            created_by=req.created_by,
            role=req.role,
            metadata=req.metadata,
            ticket_id=req.ticket_id,
        )
        return ticket
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.patch("/tickets/{ticket_id}")
async def update(ticket_id: str, req: UpdateTicketRequest):
    try:
        ticket = await update_ticket(
            ticket_id=ticket_id,
            updated_by=req.updated_by,
            role=req.role,
            updates=req.updates,
        )
        return ticket
    except ValueError as e:
        code = 404 if "not found" in str(e).lower() else 403
        raise HTTPException(status_code=code, detail=str(e))


@router.get("/tickets/search")
async def search(q: str = ""):
    return await search_tickets(query=q)


@router.get("/tickets/{ticket_id}")
async def get(ticket_id: str):
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.get("/tickets/{ticket_id}/audit")
async def audit_trail(ticket_id: str):
    events = await get_audit_trail(ticket_id)
    return {"ticket_id": ticket_id, "events": events, "count": len(events)}


@router.get("/tickets/{ticket_id}/edges")
async def edges(ticket_id: str):
    edgelist = await get_edges(ticket_id)
    return {"ticket_id": ticket_id, "edges": edgelist}


@router.get("/rbac/check")
async def rbac_check(role: str):
    return {"role": role, "allowed": check_rbac(role)}


@router.delete("/data", status_code=200)
async def delete_data():
    await clear_all_data()
    return {"deleted": True}
