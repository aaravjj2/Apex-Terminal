"""
Wave 7 — Sandbox Runner: deterministic agent simulation producing events.

STATUS: NOT IMPLEMENTED — requires real strategy engine (Phase 4).
All endpoints return 501 until the sandbox execution engine is wired.
"""
import logging
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/sandbox-runner", tags=["sandbox-runner"])
logger = logging.getLogger(__name__)

_NOT_IMPL = "Sandbox runner requires a real strategy engine (Phase 4). No fabricated data."


@router.get("/events")
async def list_events():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.post("/run")
async def run_agent(body: dict = {}):
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/hash")
async def get_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/status")
async def get_status():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)
