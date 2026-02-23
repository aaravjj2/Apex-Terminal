"""W103 — UI Page Registry API routes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.ui_page_registry import (
    get_registry,
    get_page,
    get_pages_by_group,
    get_component,
    save_snapshot,
    record_heartbeat,
    list_heartbeats,
    clear_heartbeats,
    REGISTERED_PAGES,
    COMPONENTS,
    SHELL_STATES,
)

router = APIRouter()


# ─── GET /registry ─────────────────────────────────────────────────────────

@router.get("/registry")
async def get_page_registry():
    """Return the full page registry."""
    return get_registry()


# ─── GET /pages ──────────────────────────────────────────────────────────────

@router.get("/pages")
async def list_pages(group: str | None = None):
    """List all registered UI2 pages, optionally filtered by group."""
    if group:
        pages = get_pages_by_group(group)
    else:
        pages = REGISTERED_PAGES
    return {"pages": pages, "count": len(pages)}


# ─── GET /pages/{page_id} ────────────────────────────────────────────────────

@router.get("/pages/{page_id}")
async def get_page_by_id(page_id: str):
    """Get a single page definition by id."""
    page = get_page(page_id)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page '{page_id}' not found")
    return page


# ─── GET /components ─────────────────────────────────────────────────────────

@router.get("/components")
async def list_components():
    """List all W103 standardization components."""
    return {"components": COMPONENTS, "count": len(COMPONENTS)}


# ─── GET /components/{component_id} ──────────────────────────────────────────

@router.get("/components/{component_id}")
async def get_component_by_id(component_id: str):
    """Get a single component definition by id."""
    comp = get_component(component_id)
    if not comp:
        raise HTTPException(status_code=404, detail=f"Component '{component_id}' not found")
    return comp


# ─── GET /shell-states ──────────────────────────────────────────────────────

@router.get("/shell-states")
async def get_shell_states():
    """Return all valid PageShellUI2 states."""
    return {"states": SHELL_STATES, "count": len(SHELL_STATES)}


# ─── POST /snapshots ─────────────────────────────────────────────────────────

@router.post("/snapshots", status_code=201)
async def create_snapshot():
    """Persist a snapshot of the current registry to DB + ES."""
    result = await save_snapshot()
    return result


# ─── POST /heartbeat ────────────────────────────────────────────────────────

class HeartbeatRequest(BaseModel):
    page_id: str
    status: str
    session_id: str | None = None


@router.post("/heartbeat", status_code=201)
async def post_heartbeat(req: HeartbeatRequest):
    """Record a page heartbeat (page_id + status)."""
    if req.status not in SHELL_STATES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{req.status}'. Must be one of {SHELL_STATES}")
    page = get_page(req.page_id)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page '{req.page_id}' not found")
    result = await record_heartbeat(req.page_id, req.status, req.session_id)
    return result


# ─── GET /heartbeats ────────────────────────────────────────────────────────

@router.get("/heartbeats")
async def get_heartbeats(page_id: str | None = None):
    """List page heartbeats, optionally filtered by page_id."""
    beats = await list_heartbeats(page_id)
    return {"heartbeats": beats, "count": len(beats)}


# ─── DELETE /data ────────────────────────────────────────────────────────────

@router.delete("/data")
async def delete_data():
    """Clear all heartbeats and snapshots."""
    result = await clear_heartbeats()
    return result
