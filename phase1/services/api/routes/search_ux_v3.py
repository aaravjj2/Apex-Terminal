"""
W96 — Search UX v3 API Routes
POST /search         — faceted search
GET  /facets         — facet options
POST /explain        — explain drawer (no secrets)
POST /saved          — save a search
GET  /saved          — list saved searches
GET  /saved/{id}     — get specific saved search
PATCH /saved/{id}/pin — toggle pin
DELETE /saved/{id}   — delete one
DELETE /saved        — clear all
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

try:
    from backend.core import search_ux_v3 as sux
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend"))
    from core import search_ux_v3 as sux

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = ""
    filters: dict | None = None
    sort_field: str = "_score"
    sort_dir: str = "desc"
    size: int = 20
    entity_type: str | None = None


class ExplainRequest(BaseModel):
    query: str = ""
    filters: dict | None = None
    sort_field: str = "_score"
    sort_dir: str = "desc"


class SaveSearchRequest(BaseModel):
    name: str
    query: str = ""
    filters: dict | None = None
    sort_field: str = "_score"
    sort_dir: str = "desc"
    pinned: bool = False


class PinRequest(BaseModel):
    pinned: bool


# ─── Search ──────────────────────────────────────────────────────────────────

@router.post("/search")
async def search(req: SearchRequest):
    result = await sux.search_with_facets(
        query=req.query,
        filters=req.filters,
        sort_field=req.sort_field,
        sort_dir=req.sort_dir,
        size=req.size,
        entity_type=req.entity_type,
    )
    return result


@router.get("/facets")
async def get_facets():
    return await sux.get_facet_options()


@router.post("/explain")
async def explain(req: ExplainRequest):
    return await sux.explain_search(
        query=req.query,
        filters=req.filters,
        sort_field=req.sort_field,
        sort_dir=req.sort_dir,
    )


# ─── Saved searches ───────────────────────────────────────────────────────────

@router.post("/saved", status_code=201)
async def create_saved_search(req: SaveSearchRequest):
    return await sux.save_search(
        name=req.name,
        query=req.query,
        filters=req.filters,
        sort_field=req.sort_field,
        sort_dir=req.sort_dir,
        pinned=req.pinned,
    )


@router.get("/saved")
async def list_saved():
    searches = await sux.list_saved_searches()
    return {"searches": searches, "count": len(searches)}


@router.get("/saved/{search_id}")
async def get_saved(search_id: str):
    s = await sux.get_saved_search(search_id)
    if not s:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return s


@router.patch("/saved/{search_id}/pin")
async def pin_search(search_id: str, req: PinRequest):
    ok = await sux.pin_search(search_id, req.pinned)
    if not ok:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return {"ok": True, "pinned": req.pinned}


@router.delete("/saved/{search_id}")
async def delete_saved(search_id: str):
    ok = await sux.delete_saved_search(search_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return {"ok": True}


@router.delete("/saved")
async def clear_saved():
    return await sux.clear_saved_searches()
