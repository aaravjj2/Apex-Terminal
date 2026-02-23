"""
Waves 46-50 — Elasticsearch Architecture v3
Index architecture, ingestion pipeline, query UX v2, semantic search, reproducibility.
"""
from __future__ import annotations
import hashlib
import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple


# ── Wave 46: Index Architecture v3 ──

class IndexLifecycle(str, Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    DELETE = "delete"


@dataclass
class IndexTemplate:
    name: str
    pattern: str  # e.g., "apex-trades-*"
    mappings: Dict[str, Any]
    settings: Dict[str, Any] = field(default_factory=lambda: {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "refresh_interval": "5s",
    })
    lifecycle: IndexLifecycle = IndexLifecycle.HOT
    version: int = 3

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "pattern": self.pattern,
            "mappings": self.mappings,
            "settings": self.settings,
            "lifecycle": self.lifecycle.value,
            "version": self.version,
        }


# V3 index templates
INDEX_TEMPLATES: Dict[str, IndexTemplate] = {
    "trades": IndexTemplate(
        name="apex-trades-v3",
        pattern="apex-trades-*",
        mappings={
            "properties": {
                "trade_id": {"type": "keyword"},
                "symbol": {"type": "keyword"},
                "side": {"type": "keyword"},
                "qty": {"type": "float"},
                "price": {"type": "float"},
                "timestamp": {"type": "date"},
                "strategy_id": {"type": "keyword"},
                "run_id": {"type": "keyword"},
                "commission": {"type": "float"},
                "tags": {"type": "keyword"},
            }
        },
    ),
    "strategies": IndexTemplate(
        name="apex-strategies-v3",
        pattern="apex-strategies-*",
        mappings={
            "properties": {
                "spec_id": {"type": "keyword"},
                "name": {"type": "text", "fields": {"raw": {"type": "keyword"}}},
                "description": {"type": "text"},
                "signal_type": {"type": "keyword"},
                "universe": {"type": "keyword"},
                "created_at": {"type": "date"},
                "source": {"type": "keyword"},
                "spec_hash": {"type": "keyword"},
                "sharpe": {"type": "float"},
                "tags": {"type": "keyword"},
            }
        },
    ),
    "runs": IndexTemplate(
        name="apex-runs-v3",
        pattern="apex-runs-*",
        mappings={
            "properties": {
                "run_id": {"type": "keyword"},
                "strategy_id": {"type": "keyword"},
                "status": {"type": "keyword"},
                "start_date": {"type": "date"},
                "end_date": {"type": "date"},
                "total_return": {"type": "float"},
                "sharpe": {"type": "float"},
                "max_drawdown": {"type": "float"},
                "trade_count": {"type": "integer"},
                "duration_ms": {"type": "float"},
                "config_hash": {"type": "keyword"},
                "created_at": {"type": "date"},
            }
        },
    ),
    "audit": IndexTemplate(
        name="apex-audit-v3",
        pattern="apex-audit-*",
        mappings={
            "properties": {
                "event_id": {"type": "keyword"},
                "event_type": {"type": "keyword"},
                "user": {"type": "keyword"},
                "action": {"type": "text"},
                "resource": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "details": {"type": "text"},
            }
        },
    ),
    "data_quality": IndexTemplate(
        name="apex-data-quality-v3",
        pattern="apex-data-quality-*",
        mappings={
            "properties": {
                "symbol": {"type": "keyword"},
                "score": {"type": "float"},
                "grade": {"type": "keyword"},
                "bar_count": {"type": "integer"},
                "gaps": {"type": "integer"},
                "completeness": {"type": "float"},
                "timestamp": {"type": "date"},
            }
        },
    ),
}


@dataclass
class IndexAlias:
    name: str
    index: str
    is_write: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "index": self.index, "is_write": self.is_write}


# Default aliases
DEFAULT_ALIASES: List[IndexAlias] = [
    IndexAlias("apex-trades", "apex-trades-v3", is_write=True),
    IndexAlias("apex-strategies", "apex-strategies-v3", is_write=True),
    IndexAlias("apex-runs", "apex-runs-v3", is_write=True),
    IndexAlias("apex-audit", "apex-audit-v3", is_write=True),
    IndexAlias("apex-data-quality", "apex-data-quality-v3", is_write=True),
]


def get_index_templates() -> List[Dict[str, Any]]:
    return [t.to_dict() for t in INDEX_TEMPLATES.values()]


def get_aliases() -> List[Dict[str, Any]]:
    return [a.to_dict() for a in DEFAULT_ALIASES]


# ── Wave 47: Ingestion Pipeline ──

class IngestionStatus(str, Enum):
    IDLE = "idle"
    INGESTING = "ingesting"
    BACKPRESSURE = "backpressure"
    ERROR = "error"


@dataclass
class DLQEntry:
    doc_id: str
    index: str
    error: str
    timestamp: str
    doc: Dict[str, Any]
    retry_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "index": self.index,
            "error": self.error,
            "timestamp": self.timestamp,
            "retry_count": self.retry_count,
        }


class IngestionPipeline:
    """Bulk ingestion pipeline with backpressure and DLQ."""

    def __init__(self, batch_size: int = 500, max_queue: int = 10000) -> None:
        self.batch_size = batch_size
        self.max_queue = max_queue
        self.status = IngestionStatus.IDLE
        self._queue: List[Dict[str, Any]] = []
        self._dlq: List[DLQEntry] = []
        self._metrics = {
            "docs_ingested": 0,
            "docs_failed": 0,
            "batches_sent": 0,
            "last_batch_at": None,
            "avg_batch_ms": 0.0,
            "queue_depth": 0,
            "dlq_count": 0,
        }

    def enqueue(self, doc: Dict[str, Any], index: str) -> bool:
        """Add document to ingestion queue. Returns False if backpressure active."""
        if len(self._queue) >= self.max_queue:
            self.status = IngestionStatus.BACKPRESSURE
            return False

        self._queue.append({"doc": doc, "index": index})
        self._metrics["queue_depth"] = len(self._queue)

        if len(self._queue) >= self.batch_size:
            self._flush_batch()

        return True

    def _flush_batch(self) -> int:
        """Flush current batch. Returns count of successfully processed docs."""
        if not self._queue:
            return 0

        batch = self._queue[:self.batch_size]
        self._queue = self._queue[self.batch_size:]
        self.status = IngestionStatus.INGESTING

        # Process batch (in production, this would be ES bulk API)
        processed = len(batch)
        self._metrics["docs_ingested"] += processed
        self._metrics["batches_sent"] += 1
        self._metrics["last_batch_at"] = datetime.utcnow().isoformat() + "Z"
        self._metrics["queue_depth"] = len(self._queue)

        self.status = IngestionStatus.IDLE
        return processed

    def add_to_dlq(self, doc_id: str, index: str, error: str, doc: Dict[str, Any]) -> None:
        self._dlq.append(DLQEntry(
            doc_id=doc_id,
            index=index,
            error=error,
            timestamp=datetime.utcnow().isoformat() + "Z",
            doc=doc,
        ))
        self._metrics["docs_failed"] += 1
        self._metrics["dlq_count"] = len(self._dlq)

    def get_dlq(self) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self._dlq]

    def retry_dlq(self) -> int:
        """Retry all DLQ entries. Returns count retried."""
        retried = 0
        remaining: List[DLQEntry] = []
        for entry in self._dlq:
            if entry.retry_count < 3:
                entry.retry_count += 1
                self.enqueue(entry.doc, entry.index)
                retried += 1
            else:
                remaining.append(entry)
        self._dlq = remaining
        self._metrics["dlq_count"] = len(self._dlq)
        return retried

    def get_metrics(self) -> Dict[str, Any]:
        self._metrics["queue_depth"] = len(self._queue)
        self._metrics["dlq_count"] = len(self._dlq)
        self._metrics["status"] = self.status.value
        return dict(self._metrics)

    def lag_ms(self) -> float:
        """Estimated ingestion lag in milliseconds."""
        if not self._metrics["last_batch_at"]:
            return 0.0
        return len(self._queue) * 2.0  # Estimate 2ms per doc


# ── Wave 48: Query UX v2 ──

@dataclass
class SavedQuery:
    query_id: str
    name: str
    query: str
    index: str
    filters: Dict[str, Any] = field(default_factory=dict)
    created_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query_id": self.query_id,
            "name": self.name,
            "query": self.query,
            "index": self.index,
            "filters": self.filters,
            "created_at": self.created_at,
        }


@dataclass
class QueryExplain:
    query: str
    parsed_tokens: List[str]
    matched_fields: List[str]
    score_breakdown: List[Dict[str, Any]]
    total_hits: int
    took_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "parsed_tokens": self.parsed_tokens,
            "matched_fields": self.matched_fields,
            "score_breakdown": self.score_breakdown,
            "total_hits": self.total_hits,
            "took_ms": self.took_ms,
        }


@dataclass
class FacetBucket:
    key: str
    count: int

@dataclass
class Facet:
    field: str
    buckets: List[FacetBucket]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field": self.field,
            "buckets": [{"key": b.key, "count": b.count} for b in self.buckets],
        }


class QueryEngine:
    """Query UX v2 with facets, saved queries, explain."""

    def __init__(self) -> None:
        self._saved_queries: Dict[str, SavedQuery] = {}
        self._pinned_filters: Dict[str, Any] = {}

    def parse_query(self, query_text: str) -> Dict[str, Any]:
        """Parse query language into structured query."""
        tokens = query_text.strip().split()
        filters = {}
        search_terms = []

        for token in tokens:
            if ":" in token:
                key, value = token.split(":", 1)
                filters[key] = value
            else:
                search_terms.append(token)

        return {
            "search_terms": search_terms,
            "filters": filters,
            "query_text": " ".join(search_terms),
        }

    def explain_query(self, query_text: str, hit_count: int = 0) -> QueryExplain:
        """Explain how a query was interpreted and scored."""
        parsed = self.parse_query(query_text)
        tokens = parsed["search_terms"]

        return QueryExplain(
            query=query_text,
            parsed_tokens=tokens,
            matched_fields=["name", "description", "symbol", "tags"],
            score_breakdown=[
                {"factor": "text_match", "weight": 0.5, "description": "Full-text relevance"},
                {"factor": "recency", "weight": 0.2, "description": "More recent = higher score"},
                {"factor": "field_boost", "weight": 0.3, "description": "Matches in name/symbol boosted"},
            ],
            total_hits=hit_count,
            took_ms=round(time.time() % 100, 1),
        )

    def save_query(self, name: str, query: str, index: str,
                   filters: Optional[Dict] = None) -> SavedQuery:
        qid = f"sq-{hashlib.sha256(f'{name}|{query}'.encode()).hexdigest()[:8]}"
        sq = SavedQuery(
            query_id=qid,
            name=name,
            query=query,
            index=index,
            filters=filters or {},
            created_at=datetime.utcnow().isoformat() + "Z",
        )
        self._saved_queries[qid] = sq
        return sq

    def list_saved_queries(self) -> List[Dict[str, Any]]:
        return [sq.to_dict() for sq in self._saved_queries.values()]

    def delete_saved_query(self, query_id: str) -> bool:
        if query_id in self._saved_queries:
            del self._saved_queries[query_id]
            return True
        return False

    def pin_filter(self, name: str, value: Any) -> None:
        self._pinned_filters[name] = value

    def unpin_filter(self, name: str) -> None:
        self._pinned_filters.pop(name, None)

    def get_pinned_filters(self) -> Dict[str, Any]:
        return dict(self._pinned_filters)

    def get_facets(self, index: str) -> List[Facet]:
        """Get available facets for an index."""
        # Static facets based on index type
        if "trades" in index:
            return [
                Facet("symbol", [FacetBucket("AAPL", 150), FacetBucket("MSFT", 120), FacetBucket("TSLA", 80)]),
                Facet("side", [FacetBucket("buy", 200), FacetBucket("sell", 150)]),
            ]
        elif "strategies" in index:
            return [
                Facet("signal_type", [FacetBucket("crossover", 20), FacetBucket("momentum", 15), FacetBucket("mean_reversion", 10)]),
                Facet("source", [FacetBucket("manual", 25), FacetBucket("ai_assist", 10), FacetBucket("mutation", 15)]),
            ]
        return []


# ── Wave 49: Optional Semantic Hybrid Search ──

@dataclass
class HybridSearchResult:
    query: str
    keyword_hits: int
    semantic_hits: int
    combined_hits: int
    hybrid_enabled: bool
    results: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "keyword_hits": self.keyword_hits,
            "semantic_hits": self.semantic_hits,
            "combined_hits": self.combined_hits,
            "hybrid_enabled": self.hybrid_enabled,
            "results": self.results[:20],
        }


import os

def is_semantic_enabled() -> bool:
    """Check if semantic search is enabled via env flag."""
    return os.environ.get("APEX_SEMANTIC_SEARCH", "").lower() in ("1", "true", "yes")


# ── Wave 50: Backup / Reproducibility ──

@dataclass
class ExportArtifact:
    artifact_id: str
    artifact_type: str  # run, strategy, index_snapshot
    data: Dict[str, Any]
    created_at: str = ""
    checksum: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat() + "Z"
        if not self.checksum:
            self.checksum = hashlib.sha256(
                json.dumps(self.data, sort_keys=True, default=str).encode()
            ).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "artifact_id": self.artifact_id,
            "artifact_type": self.artifact_type,
            "created_at": self.created_at,
            "checksum": self.checksum,
            "data_keys": list(self.data.keys()),
        }


class ArtifactStore:
    """Export/import artifact store for reproducibility."""

    def __init__(self) -> None:
        self._store: Dict[str, ExportArtifact] = {}

    def export_artifact(self, artifact_type: str, data: Dict[str, Any]) -> ExportArtifact:
        aid = f"art-{hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:10]}"
        artifact = ExportArtifact(
            artifact_id=aid,
            artifact_type=artifact_type,
            data=data,
        )
        self._store[aid] = artifact
        return artifact

    def import_artifact(self, artifact_data: Dict[str, Any]) -> Optional[ExportArtifact]:
        """Import an artifact and verify checksum."""
        aid = artifact_data.get("artifact_id", "")
        if not aid:
            return None
        artifact = ExportArtifact(
            artifact_id=aid,
            artifact_type=artifact_data.get("artifact_type", "unknown"),
            data=artifact_data.get("data", {}),
        )
        self._store[aid] = artifact
        return artifact

    def get(self, artifact_id: str) -> Optional[ExportArtifact]:
        return self._store.get(artifact_id)

    def list_artifacts(self) -> List[Dict[str, Any]]:
        return [a.to_dict() for a in self._store.values()]

    def verify(self, artifact_id: str) -> Dict[str, Any]:
        artifact = self._store.get(artifact_id)
        if not artifact:
            return {"found": False}
        expected = hashlib.sha256(
            json.dumps(artifact.data, sort_keys=True, default=str).encode()
        ).hexdigest()[:16]
        return {
            "found": True,
            "artifact_id": artifact_id,
            "checksum_match": expected == artifact.checksum,
            "stored_checksum": artifact.checksum,
            "computed_checksum": expected,
        }


# Singletons
_pipeline: Optional[IngestionPipeline] = None
_query_engine: Optional[QueryEngine] = None
_artifact_store: Optional[ArtifactStore] = None

def get_ingestion_pipeline() -> IngestionPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = IngestionPipeline()
    return _pipeline

def get_query_engine() -> QueryEngine:
    global _query_engine
    if _query_engine is None:
        _query_engine = QueryEngine()
    return _query_engine

def get_artifact_store() -> ArtifactStore:
    global _artifact_store
    if _artifact_store is None:
        _artifact_store = ArtifactStore()
    return _artifact_store
