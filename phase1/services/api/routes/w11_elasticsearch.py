"""
Waves 11-20 — Elasticsearch Gateway v2
Mandatory ES operations: indices, search, bulk, ILM.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Any
import logging

from ...waves11_20.elastic import get_elasticsearch_service, IndexName

router = APIRouter(prefix="/api/v2/elasticsearch", tags=["elasticsearch-v2"])
logger = logging.getLogger(__name__)


class IndexDocRequest(BaseModel):
    index: str
    document: dict
    doc_id: Optional[str] = None


class BulkIndexRequest(BaseModel):
    index: str
    documents: list[dict]


class SearchRequest(BaseModel):
    index: str
    query: dict
    size: int = 20
    cursor: Optional[str] = None


@router.get("/health")
async def es_health():
    """Check Elasticsearch connectivity and cluster health."""
    es = get_elasticsearch_service()
    connected = await es.ping()
    if not connected:
        raise HTTPException(status_code=503, detail="Elasticsearch unavailable — mandatory service")
    return {"status": "connected", "url": es._url}


@router.get("/indices")
async def list_indices():
    """List all managed index names."""
    return {"indices": [idx.value for idx in IndexName]}


@router.post("/index")
async def index_document(req: IndexDocRequest):
    """Index a single document."""
    import hashlib, json
    from ...waves11_20.elastic import ESDocument
    es = get_elasticsearch_service()
    doc_id = req.doc_id or hashlib.md5(json.dumps(req.document, sort_keys=True).encode()).hexdigest()
    doc = ESDocument(index=req.index, doc_id=doc_id, body=req.document)
    result = await es.index_document(doc)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to index document")
    return {"ok": True, "index": req.index, "doc_id": doc_id}


@router.post("/bulk")
async def bulk_index(req: BulkIndexRequest):
    """Bulk index documents."""
    import hashlib, json
    from ...waves11_20.elastic import ESDocument
    es = get_elasticsearch_service()
    docs = [
        ESDocument(
            index=req.index,
            doc_id=hashlib.md5(json.dumps(d, sort_keys=True).encode()).hexdigest(),
            body=d,
        )
        for d in req.documents
    ]
    result = await es.bulk_index(docs)
    return {"ok": True, "indexed": result.get("indexed", 0), "errors": result.get("errors", 0), "index": req.index}


@router.post("/search")
async def search(req: SearchRequest):
    """Search an index with cursor pagination."""
    import json as _json
    es = get_elasticsearch_service()
    search_after: Optional[list] = None
    if req.cursor:
        try:
            search_after = _json.loads(req.cursor)
        except Exception:
            search_after = None
    results = await es.search(req.index, req.query, size=req.size, search_after=search_after)
    return results


@router.get("/stats/{index}")
async def index_stats(index: str):
    """Get stats for an index."""
    es = get_elasticsearch_service()
    stats = await es.get_index_stats()
    return stats.get(index, {"docs_count": 0, "size_bytes": 0})


@router.post("/init")
async def init_indices():
    """Initialize all managed indices with templates."""
    es = get_elasticsearch_service()
    results = {}
    for idx in IndexName:
        ok = await es.create_index_if_not_exists(idx.value)
        results[idx.value] = "created" if ok else "exists_or_error"
    return {"initialized": results}
