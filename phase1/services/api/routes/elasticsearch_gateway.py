"""
Wave 7 — Elasticsearch Integration (GATED — OFF by default)
Full-text search gateway. Enable with ELASTICSEARCH_ENABLED=1.
Falls back to in-memory demo search when disabled.
"""
import hashlib
import json
import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/elasticsearch", tags=["elasticsearch"])

# ── Gating ─────────────────────────────────────────────────────────
ES_ENABLED = os.environ.get("ELASTICSEARCH_ENABLED", "0") == "1"
ES_HOST = os.environ.get("ELASTICSEARCH_HOST", "https://localhost:9200")
ES_API_KEY = os.environ.get("ELASTICSEARCH_API_KEY", "")
ES_INDEX_PREFIX = os.environ.get("ELASTICSEARCH_INDEX_PREFIX", "apex")

# Lazy ES client (only imported/created when enabled)
_es_client = None


def _get_es_client():
    global _es_client
    if _es_client is None and ES_ENABLED:
        try:
            from elasticsearch import Elasticsearch
            _es_client = Elasticsearch(
                ES_HOST,
                api_key=ES_API_KEY,
                verify_certs=False,
                request_timeout=10,
            )
        except ImportError:
            raise HTTPException(503, "elasticsearch-py not installed")
    return _es_client


# ── Models ─────────────────────────────────────────────────────────
class ESSearchRequest(BaseModel):
    query: str
    index: str = "trades"
    size: int = 20
    from_: int = 0


class ESDocument(BaseModel):
    id: str
    index: str
    score: float
    source: dict


class ESSearchResponse(BaseModel):
    hits: List[ESDocument]
    total: int
    took_ms: int
    query_hash: str


class ESIndexRequest(BaseModel):
    index: str
    doc_id: Optional[str] = None
    body: dict


class ESStatusResponse(BaseModel):
    enabled: bool
    connected: bool
    cluster_name: str
    indices: List[str]
    doc_count: int


# ── Demo Data ──────────────────────────────────────────────────────
DEMO_DOCS = [
    {"id": "doc-001", "index": "trades", "score": 9.5, "source": {"symbol": "AAPL", "strategy": "long_call", "pnl": 245.50, "date": "2026-01-10", "status": "closed"}},
    {"id": "doc-002", "index": "trades", "score": 8.2, "source": {"symbol": "MSFT", "strategy": "iron_condor", "pnl": -120.00, "date": "2026-01-11", "status": "closed"}},
    {"id": "doc-003", "index": "trades", "score": 7.8, "source": {"symbol": "TSLA", "strategy": "put_credit_spread", "pnl": 180.25, "date": "2026-01-12", "status": "closed"}},
    {"id": "doc-004", "index": "trades", "score": 7.5, "source": {"symbol": "SPY", "strategy": "call_debit_spread", "pnl": 95.00, "date": "2026-01-13", "status": "closed"}},
    {"id": "doc-005", "index": "trades", "score": 6.9, "source": {"symbol": "NVDA", "strategy": "long_call", "pnl": 310.00, "date": "2026-01-14", "status": "open"}},
    {"id": "doc-006", "index": "trades", "score": 6.5, "source": {"symbol": "AMD", "strategy": "short_put", "pnl": 75.50, "date": "2026-01-15", "status": "closed"}},
    {"id": "doc-007", "index": "alerts", "score": 8.0, "source": {"symbol": "AAPL", "type": "price_alert", "threshold": 195.0, "triggered": True, "date": "2026-01-16"}},
    {"id": "doc-008", "index": "alerts", "score": 7.2, "source": {"symbol": "SPY", "type": "volume_alert", "threshold": 50000000, "triggered": False, "date": "2026-01-16"}},
    {"id": "doc-009", "index": "logs", "score": 5.5, "source": {"level": "INFO", "message": "Autopilot cycle completed", "timestamp": "2026-01-16T09:31:00Z"}},
    {"id": "doc-010", "index": "logs", "score": 4.8, "source": {"level": "WARN", "message": "Kill switch activated", "timestamp": "2026-01-16T10:15:00Z"}},
]


def _demo_search(query: str, index: str, size: int, from_: int) -> ESSearchResponse:
    q_lower = query.lower()
    matched = []
    for doc in DEMO_DOCS:
        if index != "" and doc["index"] != index:
            continue
        source_str = json.dumps(doc["source"]).lower()
        if q_lower in source_str or q_lower in doc["index"]:
            matched.append(doc)
    matched.sort(key=lambda d: d["score"], reverse=True)
    hits = matched[from_:from_ + size]
    query_hash = hashlib.sha256(f"{query}:{index}:{size}:{from_}".encode()).hexdigest()
    return ESSearchResponse(
        hits=[ESDocument(**h) for h in hits],
        total=len(matched),
        took_ms=2,
        query_hash=query_hash,
    )


@router.post("/search")
async def es_search(req: ESSearchRequest):
    if ES_ENABLED:
        client = _get_es_client()
        if client is None:
            raise HTTPException(503, "Elasticsearch unavailable")
        try:
            result = client.search(
                index=f"{ES_INDEX_PREFIX}-{req.index}",
                body={"query": {"multi_match": {"query": req.query, "fields": ["*"]}}, "size": req.size, "from": req.from_},
            )
            hits = []
            for hit in result["hits"]["hits"]:
                hits.append(ESDocument(id=hit["_id"], index=hit["_index"], score=hit["_score"], source=hit["_source"]))
            query_hash = hashlib.sha256(f"{req.query}:{req.index}".encode()).hexdigest()
            return ESSearchResponse(hits=hits, total=result["hits"]["total"]["value"], took_ms=result["took"], query_hash=query_hash)
        except Exception as e:
            raise HTTPException(502, f"Elasticsearch error: {str(e)}")
    return _demo_search(req.query, req.index, req.size, req.from_)


@router.post("/index")
async def es_index_doc(req: ESIndexRequest):
    if ES_ENABLED:
        client = _get_es_client()
        if client is None:
            raise HTTPException(503, "Elasticsearch unavailable")
        try:
            result = client.index(index=f"{ES_INDEX_PREFIX}-{req.index}", id=req.doc_id, body=req.body)
            return {"result": result["result"], "id": result["_id"], "index": result["_index"]}
        except Exception as e:
            raise HTTPException(502, f"Elasticsearch error: {str(e)}")
    # Demo mode: accept but don't persist
    doc_id = req.doc_id or f"demo-{hashlib.sha256(json.dumps(req.body, sort_keys=True).encode()).hexdigest()[:8]}"
    return {"result": "created", "id": doc_id, "index": f"{ES_INDEX_PREFIX}-{req.index}", "demo": True}


@router.get("/status")
async def es_status():
    if ES_ENABLED:
        client = _get_es_client()
        if client is None:
            return ESStatusResponse(enabled=True, connected=False, cluster_name="", indices=[], doc_count=0)
        try:
            info = client.info()
            indices = list(client.indices.get_alias(index=f"{ES_INDEX_PREFIX}-*").keys())
            total_docs = sum(client.count(index=idx)["count"] for idx in indices) if indices else 0
            return ESStatusResponse(
                enabled=True, connected=True,
                cluster_name=info["cluster_name"],
                indices=indices,
                doc_count=total_docs,
            )
        except Exception:
            return ESStatusResponse(enabled=True, connected=False, cluster_name="error", indices=[], doc_count=0)
    unique_indices = sorted(set(d["index"] for d in DEMO_DOCS))
    return ESStatusResponse(
        enabled=False, connected=False,
        cluster_name="demo-cluster",
        indices=unique_indices,
        doc_count=len(DEMO_DOCS),
    )


@router.get("/hash")
async def es_hash():
    canonical = json.dumps(DEMO_DOCS, sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest(), "enabled": ES_ENABLED}
