"""
v1.46 — Performance Attribution
P&L breakdown by strategy, sector, and time bucket.

STATUS: NOT IMPLEMENTED — requires real trade history + strategy engine (Phase 4).
Returns empty results until wired to actual trade/P&L data.
"""
import logging
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/attribution", tags=["attribution"])
logger = logging.getLogger(__name__)

_NOT_IMPL = "Performance attribution requires real trade history (Phase 4). No fabricated data."

_EMPTY = {
    "total_pnl": 0.0,
    "period": None,
    "by_strategy": [],
    "by_sector": [],
    "by_bucket": [],
    "status": "not_implemented",
}


@router.get("")
async def get_attribution():
    """Full attribution breakdown — empty until real trade data exists."""
    return _EMPTY


@router.get("/hash")
async def attribution_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/by-strategy")
async def by_strategy():
    return []


@router.get("/by-sector")
async def by_sector():
    return []


@router.get("/by-bucket")
async def by_bucket():
    return []
