"""
Wave 106 — Controls domain REST routes.
Prefix: /api/v3/controls
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.core.controls_domain import (
    CONTROLS_DOMAIN_VERSION,
    DOC_TYPES,
    clear_domain_data,
    create_edge,
    get_control,
    index_control,
    list_edges,
    search_controls,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Version / meta
# ---------------------------------------------------------------------------

@router.get("/version")
async def get_version():
    return {
        "version": CONTROLS_DOMAIN_VERSION,
        "doc_types": DOC_TYPES,
        "description": "Accounting/controls domain aligned with ES + evidence graph",
    }


# ---------------------------------------------------------------------------
# Control documents
# ---------------------------------------------------------------------------

class ControlIn(BaseModel):
    doc_type: str
    doc_id: Optional[str] = None
    data: dict[str, Any] = {}


@router.post("/controls", status_code=201)
async def post_control(body: ControlIn):
    result = await index_control(
        doc_type=body.doc_type,
        doc_id=body.doc_id,
        data=body.data,
    )
    return result


@router.get("/controls/search")
async def search_controls_endpoint(
    q: str = Query(default=""),
    doc_type: Optional[str] = Query(default=None),
    size: int = Query(default=20),
):
    hits = await search_controls(query=q, doc_type=doc_type, size=size)
    return {"hits": hits, "total": len(hits)}


@router.get("/controls/{doc_id}")
async def get_control_endpoint(doc_id: str):
    doc = await get_control(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Control {doc_id!r} not found")
    return doc


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------

class EdgeIn(BaseModel):
    from_id: str
    to_id: str
    edge_type: str
    metadata: dict[str, Any] = {}


@router.post("/edges", status_code=201)
async def post_edge(body: EdgeIn):
    edge = await create_edge(
        from_id=body.from_id,
        to_id=body.to_id,
        edge_type=body.edge_type,
        metadata=body.metadata,
    )
    return edge


@router.get("/edges")
async def get_edges(
    from_id: Optional[str] = Query(default=None),
    to_id: Optional[str] = Query(default=None),
):
    edges = await list_edges(from_id=from_id, to_id=to_id)
    return {"edges": edges, "total": len(edges)}


# ---------------------------------------------------------------------------
# Delete (test clean-up)
# ---------------------------------------------------------------------------

@router.delete("/data", status_code=200)
async def delete_domain_data():
    result = await clear_domain_data()
    return result
