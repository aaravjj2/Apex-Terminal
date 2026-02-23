"""
Wave 8 — Alternative Data Catalog: datasets, ingestion status, search.

STATUS: NOT IMPLEMENTED — requires real data vendor integrations.
Returns empty catalog until real alt-data sources are connected.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/v1/alt-data", tags=["alt-data"])
logger = logging.getLogger(__name__)

_NOT_IMPL = "Alt-data catalog requires real vendor integrations. No fabricated data."


@router.get("/catalog")
async def list_catalog(category: Optional[str] = Query(None), active_only: bool = False):
    return {"datasets": [], "count": 0, "status": "not_implemented"}


@router.get("/hash")
async def get_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/catalog/{dataset_id}")
async def get_dataset(dataset_id: str):
    raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
