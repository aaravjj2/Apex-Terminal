"""
v1.45 — System Audit Log
Structured trail of all platform actions for compliance.

STATUS: NOT IMPLEMENTED — requires real event logging infrastructure (Phase 6/ES).
Returns empty results until wired to Elasticsearch audit index.
"""
import logging
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])
logger = logging.getLogger(__name__)

_NOT_IMPL = "Audit log requires real event logging infrastructure (Phase 6). No fabricated data."


@router.get("")
async def list_audit():
    """Return audit log — empty until ES audit index is wired."""
    return []


@router.get("/hash")
async def audit_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/by-action/{action}")
async def by_action(action: str):
    return []


@router.get("/by-actor/{actor}")
async def by_actor(actor: str):
    return []


@router.get("/count")
async def audit_count():
    return {"count": 0, "status": "not_implemented"}
