"""
Market data ES indexer — indexes batch metadata and symbol health into Elasticsearch.

Index: apex-market-batches
Index: apex-market-health

Uses httpx to directly hit ES REST API (same pattern as bulk_ingest.py).
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, List, Optional

import httpx
import structlog

logger = structlog.get_logger(__name__)

ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
BATCH_INDEX = "apex-market-batches"
HEALTH_INDEX = "apex-market-health"

# ── Index mappings ───────────────────────────────────────────────────

BATCH_MAPPING = {
    "mappings": {
        "properties": {
            "batch_id": {"type": "keyword"},
            "provider": {"type": "keyword"},
            "symbol": {"type": "keyword"},
            "timeframe": {"type": "keyword"},
            "start_date": {"type": "date"},
            "end_date": {"type": "date"},
            "row_count": {"type": "integer"},
            "sha256": {"type": "keyword"},
            "status": {"type": "keyword"},
            "fetched_at": {"type": "date"},
        }
    }
}

HEALTH_MAPPING = {
    "mappings": {
        "properties": {
            "symbol": {"type": "keyword"},
            "status": {"type": "keyword"},
            "bar_count": {"type": "integer"},
            "integrity_score": {"type": "float"},
            "provider": {"type": "keyword"},
            "last_update": {"type": "date"},
            "sha256": {"type": "keyword"},
            "checked_at": {"type": "date"},
        }
    }
}


async def ensure_indices() -> Dict[str, bool]:
    """Create ES indices if they don't exist. Returns {index: created}."""
    results = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        for idx, mapping in [(BATCH_INDEX, BATCH_MAPPING), (HEALTH_INDEX, HEALTH_MAPPING)]:
            try:
                r = await client.head(f"{ES_URL}/{idx}")
                if r.status_code == 200:
                    results[idx] = False  # already exists
                else:
                    cr = await client.put(f"{ES_URL}/{idx}", json=mapping)
                    results[idx] = cr.status_code in (200, 201)
                    logger.info("es_index_created", index=idx)
            except Exception as e:
                logger.warning("es_ensure_fail", index=idx, error=str(e))
                results[idx] = False
    return results


async def index_batch(batch: dict) -> bool:
    """Index a single batch provenance record into ES."""
    doc_id = batch.get("batch_id", "")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f"{ES_URL}/{BATCH_INDEX}/_doc/{doc_id}",
                json=batch,
                headers={"Content-Type": "application/json"},
            )
            ok = r.status_code in (200, 201)
            if ok:
                logger.info("es_batch_indexed", batch_id=doc_id)
            return ok
    except Exception as e:
        logger.warning("es_batch_index_fail", batch_id=doc_id, error=str(e))
        return False


async def index_health(report: dict) -> bool:
    """Index a symbol health report into ES."""
    doc_id = report.get("id", report.get("symbol", "unknown"))
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.put(
                f"{ES_URL}/{HEALTH_INDEX}/_doc/{doc_id}",
                json={**report, "checked_at": datetime.utcnow().isoformat()},
                headers={"Content-Type": "application/json"},
            )
            ok = r.status_code in (200, 201)
            if ok:
                logger.info("es_health_indexed", symbol=doc_id)
            return ok
    except Exception as e:
        logger.warning("es_health_index_fail", symbol=doc_id, error=str(e))
        return False


async def bulk_index_health(reports: List[dict]) -> int:
    """Bulk-index multiple health reports. Returns count indexed."""
    await ensure_indices()
    count = 0
    for r in reports:
        if await index_health(r):
            count += 1
    return count


async def search_batches(symbol: Optional[str] = None, limit: int = 50) -> List[dict]:
    """Search batch metadata from ES."""
    query: dict = {"size": limit, "sort": [{"fetched_at": {"order": "desc"}}]}
    if symbol:
        query["query"] = {"term": {"symbol": symbol.upper()}}
    else:
        query["query"] = {"match_all": {}}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{ES_URL}/{BATCH_INDEX}/_search",
                json=query,
                headers={"Content-Type": "application/json"},
            )
            if r.status_code != 200:
                return []
            data = r.json()
            return [hit["_source"] for hit in data.get("hits", {}).get("hits", [])]
    except Exception as e:
        logger.warning("es_search_fail", error=str(e))
        return []
