"""
phase1/services/api/routes/evidence.py — W93

Evidence-graph API:
  GET  /api/v3/evidence/graph?root_type=&root_id=   — BFS traversal from root node
  POST /api/v3/evidence/graph/edge                  — Create a single edge
  POST /api/v3/evidence/graph/backtest              — Create standard backtest edges
  GET  /api/v3/evidence/graph/edges                 — List all edges (admin/audit)
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "backend"))

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from core.evidence_graph import (
    create_edge,
    get_graph,
    ensure_backtest_edges,
    get_all_edges,
    clear_graph,
)

router = APIRouter()


# ── Request / Response models ─────────────────────────────────────────────────

class CreateEdgeRequest(BaseModel):
    from_type: str
    from_id: str
    to_type: str
    to_id: str
    edge_type: str
    metadata: Optional[Dict[str, Any]] = None
    from_label: str = ""
    to_label: str = ""


class BacktestEdgeRequest(BaseModel):
    run_id: str
    strategy_id: str
    metadata: Optional[Dict[str, Any]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/graph")
async def get_evidence_graph(
    root_type: str = Query(..., description="Entity type of graph root"),
    root_id: str = Query(..., description="Entity ID of graph root"),
    max_depth: int = Query(3, ge=1, le=6, description="BFS depth limit"),
):
    """Return subgraph reachable from root_type / root_id within max_depth hops."""
    if not root_type or not root_id:
        raise HTTPException(status_code=400, detail="root_type and root_id are required")
    result = await get_graph(root_type=root_type, root_id=root_id, max_depth=max_depth)
    return result


@router.post("/graph/edge")
async def add_edge(body: CreateEdgeRequest):
    """Create a single evidence edge."""
    edge = await create_edge(
        from_type=body.from_type,
        from_id=body.from_id,
        to_type=body.to_type,
        to_id=body.to_id,
        edge_type=body.edge_type,
        metadata=body.metadata,
        from_label=body.from_label,
        to_label=body.to_label,
    )
    return {"ok": True, "edge": edge}


@router.post("/graph/backtest")
async def add_backtest_edges(body: BacktestEdgeRequest):
    """Create standard provenance edges for a backtest run."""
    edges = await ensure_backtest_edges(
        run_id=body.run_id,
        strategy_id=body.strategy_id,
        metadata=body.metadata,
    )
    return {"ok": True, "edges": edges, "count": len(edges)}


@router.get("/graph/edges")
async def list_all_edges():
    """List all recorded evidence edges (admin / audit)."""
    edges = await get_all_edges()
    return {"edges": edges, "count": len(edges)}


@router.delete("/graph")
async def reset_graph():
    """Clear all graph data (test-only utility)."""
    await clear_graph()
    return {"ok": True, "cleared": True}
