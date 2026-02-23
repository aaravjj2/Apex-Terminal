"""
v1.38 — Citations & Evidence Format
Standardized citation/evidence objects used across risk runs, backtests,
strategy artifacts, validations, exports, and provenance.

STATUS: NOT IMPLEMENTED — requires real engine artifacts (Phase 4+).
Returns empty results until evidence pipeline is wired.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/citations", tags=["citations"])
logger = logging.getLogger(__name__)

_NOT_IMPL = "Citations require real engine artifacts (Phase 4). No fabricated data."


class Citation(BaseModel):
    id: str
    source_type: str
    source_id: str
    title: str
    detail: str
    timestamp: str
    confidence: Optional[float] = None
    url: Optional[str] = None
    metadata: dict = {}


@router.get("/")
async def list_citations():
    """Return all citations — empty until real evidence pipeline exists."""
    return []


@router.get("/hash")
async def citations_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/by-source/{source_type}")
async def citations_by_source(source_type: str):
    return []


@router.get("/{citation_id}")
async def get_citation(citation_id: str):
    raise HTTPException(status_code=404, detail=f"Citation {citation_id} not found")
