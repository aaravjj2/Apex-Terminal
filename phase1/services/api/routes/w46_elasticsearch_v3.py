"""
Waves 46-50 — Elasticsearch Architecture v3 API Routes
Index management, ingestion pipeline, query UX, semantic search, reproducibility.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3/elasticsearch", tags=["elasticsearch-v3"])


# ── Request Models ──

class IngestDocRequest(BaseModel):
    index: str = "apex-trades"
    doc: Dict[str, Any] = Field(default_factory=dict)

class SaveQueryRequest(BaseModel):
    name: str
    query: str
    index: str = "apex-strategies"
    filters: Dict[str, Any] = Field(default_factory=dict)

class SearchRequest(BaseModel):
    query: str
    index: str = "apex-strategies"
    size: int = 20
    explain: bool = False

class PinFilterRequest(BaseModel):
    name: str
    value: str

class ExportArtifactRequest(BaseModel):
    artifact_type: str = "run"
    data: Dict[str, Any] = Field(default_factory=dict)


# ═══════════════════════════════════════════════════
# Wave 46: Index Architecture v3
# ═══════════════════════════════════════════════════

@router.get("/index-templates")
async def get_index_templates():
    """Get all v3 index templates."""
    from ...waves21_50.elastic.architecture import get_index_templates
    return {"templates": get_index_templates()}


@router.get("/aliases")
async def get_aliases():
    """Get all v3 alias mappings."""
    from ...waves21_50.elastic.architecture import get_aliases
    return {"aliases": get_aliases()}


# ═══════════════════════════════════════════════════
# Wave 47: Ingestion Pipeline
# ═══════════════════════════════════════════════════

@router.post("/ingest")
async def ingest_document(req: IngestDocRequest):
    """Ingest a document into the pipeline."""
    from ...waves21_50.elastic.architecture import get_ingestion_pipeline
    pipeline = get_ingestion_pipeline()
    ok = pipeline.enqueue(req.doc, req.index)
    if not ok:
        raise HTTPException(status_code=429, detail="Backpressure active, queue full")
    return {"status": "queued", "queue_depth": pipeline.get_metrics()["queue_depth"]}


@router.get("/pipeline/metrics")
async def pipeline_metrics():
    """Get ingestion pipeline metrics."""
    from ...waves21_50.elastic.architecture import get_ingestion_pipeline
    pipeline = get_ingestion_pipeline()
    return pipeline.get_metrics()


@router.get("/pipeline/dlq")
async def get_dlq():
    """Get dead-letter queue entries."""
    from ...waves21_50.elastic.architecture import get_ingestion_pipeline
    pipeline = get_ingestion_pipeline()
    return {"dlq": pipeline.get_dlq()}


@router.post("/pipeline/dlq/retry")
async def retry_dlq():
    """Retry all failed documents in the DLQ."""
    from ...waves21_50.elastic.architecture import get_ingestion_pipeline
    pipeline = get_ingestion_pipeline()
    retried = pipeline.retry_dlq()
    return {"retried": retried}


@router.get("/pipeline/lag")
async def pipeline_lag():
    """Get estimated ingestion lag."""
    from ...waves21_50.elastic.architecture import get_ingestion_pipeline
    pipeline = get_ingestion_pipeline()
    return {"lag_ms": pipeline.lag_ms(), "status": pipeline.status.value}


# ═══════════════════════════════════════════════════
# Wave 48: Query UX v2
# ═══════════════════════════════════════════════════

@router.post("/search")
async def search(req: SearchRequest):
    """Search with query language, facets, and optional explain."""
    from ...waves21_50.elastic.architecture import get_query_engine
    qe = get_query_engine()
    parsed = qe.parse_query(req.query)
    facets = qe.get_facets(req.index)
    pinned = qe.get_pinned_filters()

    result: Dict[str, Any] = {
        "query": req.query,
        "parsed": parsed,
        "facets": [f.to_dict() for f in facets],
        "pinned_filters": pinned,
        "hits": [],
        "total": 0,
    }

    if req.explain:
        result["explain"] = qe.explain_query(req.query, hit_count=0).to_dict()

    return result


@router.post("/saved-queries")
async def save_query(req: SaveQueryRequest):
    """Save a query for reuse."""
    from ...waves21_50.elastic.architecture import get_query_engine
    qe = get_query_engine()
    sq = qe.save_query(req.name, req.query, req.index, req.filters)
    return sq.to_dict()


@router.get("/saved-queries")
async def list_saved_queries():
    """List all saved queries."""
    from ...waves21_50.elastic.architecture import get_query_engine
    qe = get_query_engine()
    return {"queries": qe.list_saved_queries()}


@router.delete("/saved-queries/{query_id}")
async def delete_saved_query(query_id: str):
    """Delete a saved query."""
    from ...waves21_50.elastic.architecture import get_query_engine
    qe = get_query_engine()
    ok = qe.delete_saved_query(query_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Query not found")
    return {"status": "deleted"}


@router.post("/pin-filter")
async def pin_filter(req: PinFilterRequest):
    """Pin a filter to all queries."""
    from ...waves21_50.elastic.architecture import get_query_engine
    qe = get_query_engine()
    qe.pin_filter(req.name, req.value)
    return {"status": "pinned", "filter": req.name}


@router.delete("/pin-filter/{name}")
async def unpin_filter(name: str):
    """Unpin a filter."""
    from ...waves21_50.elastic.architecture import get_query_engine
    qe = get_query_engine()
    qe.unpin_filter(name)
    return {"status": "unpinned", "filter": name}


# ═══════════════════════════════════════════════════
# Wave 49: Semantic Hybrid Search
# ═══════════════════════════════════════════════════

@router.get("/semantic/status")
async def semantic_status():
    """Check if semantic search is enabled."""
    from ...waves21_50.elastic.architecture import is_semantic_enabled
    return {"enabled": is_semantic_enabled(), "env_flag": "APEX_SEMANTIC_SEARCH"}


# ═══════════════════════════════════════════════════
# Wave 50: Backup / Reproducibility
# ═══════════════════════════════════════════════════

@router.post("/artifacts/export")
async def export_artifact(req: ExportArtifactRequest):
    """Export an artifact for reproducibility."""
    from ...waves21_50.elastic.architecture import get_artifact_store
    store = get_artifact_store()
    artifact = store.export_artifact(req.artifact_type, req.data)
    return artifact.to_dict()


@router.get("/artifacts")
async def list_artifacts():
    """List all exported artifacts."""
    from ...waves21_50.elastic.architecture import get_artifact_store
    store = get_artifact_store()
    return {"artifacts": store.list_artifacts()}


@router.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: str):
    """Get a specific artifact."""
    from ...waves21_50.elastic.architecture import get_artifact_store
    store = get_artifact_store()
    artifact = store.get(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact.to_dict()


@router.get("/artifacts/{artifact_id}/verify")
async def verify_artifact(artifact_id: str):
    """Verify artifact integrity via checksum."""
    from ...waves21_50.elastic.architecture import get_artifact_store
    store = get_artifact_store()
    return store.verify(artifact_id)
