"""
Cache API Endpoints (v1.16)

Provides cache inspection and manifest export for LOCAL mode.
DEMO mode returns empty lists (no vendor data exposure).
"""

import os
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])


class CacheEntry(BaseModel):
    """Cache entry metadata."""
    cache_key: str
    request_type: str
    params: Dict[str, Any]
    checksum: str
    captured_at: str


class CacheListResponse(BaseModel):
    """Response for cache list endpoint."""
    mode: str  # DEMO or LOCAL
    entries: List[CacheEntry]
    total: int


@router.get("/entries", response_model=CacheListResponse)
async def list_cache_entries():
    """
    List all cache entries.
    
    - LOCAL mode: Returns actual cache manifest entries
    - DEMO mode: Returns empty list (no vendor data exposure)
    """
    demo_mode = os.getenv("DEMO_MODE", "0") == "1"
    
    if demo_mode:
        # DEMO mode: no cache exposure
        return CacheListResponse(
            mode="DEMO",
            entries=[],
            total=0
        )
    
    # LOCAL mode: return actual entries
    try:
        from phase1.services.market_data.cache_manifest import list_cache_entries
        
        entries = list_cache_entries()
        cache_entries = [
            CacheEntry(
                cache_key=e.get("cache_key", ""),
                request_type=e.get("request_type", ""),
                params=e.get("params", {}),
                checksum=e.get("checksum", ""),
                captured_at=e.get("captured_at", "")
            )
            for e in entries
        ]
        
        return CacheListResponse(
            mode="LOCAL",
            entries=cache_entries,
            total=len(cache_entries)
        )
    except Exception as e:
        logger.error(f"Failed to list cache entries: {e}")
        raise HTTPException(status_code=500, detail="Failed to list cache entries")


@router.get("/manifest/checksum")
async def get_manifest_checksum():
    """
    Get deterministic checksum of cache manifest.
    
    Returns empty checksum in DEMO mode.
    """
    demo_mode = os.getenv("DEMO_MODE", "0") == "1"
    
    if demo_mode:
        return {"mode": "DEMO", "checksum": ""}
    
    try:
        from phase1.services.market_data.cache_manifest import get_manifest_checksum
        
        checksum = get_manifest_checksum()
        return {"mode": "LOCAL", "checksum": checksum}
    except Exception as e:
        logger.error(f"Failed to get manifest checksum: {e}")
        raise HTTPException(status_code=500, detail="Failed to get manifest checksum")
