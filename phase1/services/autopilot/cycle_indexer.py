"""
Autopilot Cycle Indexer — Phase 4
Indexes every cycle run artifact into Elasticsearch index `apex-autopilot-cycles`.
Zero blocking: uses fire-and-forget asyncio task so the cycle never waits on ES.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
_INDEX = "apex-autopilot-cycles"

_INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "run_id": {"type": "keyword"},
            "timestamp": {"type": "date"},
            "success": {"type": "boolean"},
            "duration_ms": {"type": "float"},
            "candidates_generated": {"type": "integer"},
            "candidates_selected": {"type": "integer"},
            "exits_triggered": {"type": "integer"},
            "exits_executed": {"type": "integer"},
            "orders_filled": {"type": "integer"},
            "orders_placed": {"type": "integer"},
            "gates_triggered": {"type": "keyword"},
            "no_action_reasons": {"type": "keyword"},
            "error": {"type": "text"},
            "error_phase": {"type": "keyword"},
            # market context
            "market_open": {"type": "boolean"},
            "regime": {"type": "keyword"},
            "vix_level": {"type": "float"},
            "spy_change_pct": {"type": "float"},
            # sentiment
            "sentiment_provider": {"type": "keyword"},
            "market_sentiment_score": {"type": "float"},
            # health
            "alpaca_connected": {"type": "boolean"},
            "alpaca_latency_ms": {"type": "float"},
            # live quotes enrichment
            "live_quotes": {"type": "object", "enabled": False},
            # full artifact JSON (for drilldown)
            "artifact_json": {"type": "object", "enabled": False},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}

_index_ensured = False


async def _ensure_index() -> None:
    """Create the index if it doesn't exist (idempotent)."""
    global _index_ensured
    if _index_ensured:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.head(f"{_ES_URL}/{_INDEX}")
            if r.status_code == 200:
                _index_ensured = True
                return
            r2 = await client.put(f"{_ES_URL}/{_INDEX}", json=_INDEX_MAPPING)
            if r2.status_code in (200, 201):
                logger.info(f"cycle_indexer: created index {_INDEX}")
                _index_ensured = True
            else:
                logger.warning(f"cycle_indexer: failed to create index: {r2.status_code} {r2.text[:200]}")
    except Exception as exc:
        logger.warning(f"cycle_indexer: _ensure_index error: {exc}")


def _flatten_artifact(artifact) -> Dict[str, Any]:
    """Flatten RunArtifact into an ES-friendly document."""
    a = artifact
    mc = a.market_context
    sent = a.sentiment
    health = a.health

    doc: Dict[str, Any] = {
        "@timestamp": (a.timestamp.replace(tzinfo=timezone.utc) if a.timestamp.tzinfo is None
                       else a.timestamp).isoformat(),
        "run_id": a.run_id,
        "timestamp": (a.timestamp.replace(tzinfo=timezone.utc) if a.timestamp.tzinfo is None
                      else a.timestamp).isoformat(),
        "success": a.success,
        "duration_ms": round(a.duration_ms, 3),
        "candidates_generated": a.candidates_generated,
        "candidates_selected": a.candidates_selected,
        "exits_triggered": a.exits_triggered,
        "exits_executed": a.exits_executed,
        "orders_filled": a.orders_filled,
        "orders_placed": len(a.orders_placed),
        "gates_triggered": [g.value if hasattr(g, "value") else str(g) for g in a.gates_triggered],
        "no_action_reasons": a.no_action_reasons,
        "error": a.error,
        "error_phase": a.error_phase.value if a.error_phase and hasattr(a.error_phase, "value") else None,
    }

    if mc:
        doc["market_open"] = mc.market_open
        doc["regime"] = mc.regime
        doc["vix_level"] = mc.vix_level
        doc["spy_change_pct"] = mc.spy_change_pct

    if sent:
        doc["sentiment_provider"] = sent.provider
        doc["market_sentiment_score"] = sent.sentiment_scores.get("MARKET")

    if health:
        doc["alpaca_connected"] = health.alpaca_connected
        doc["alpaca_latency_ms"] = health.alpaca_latency_ms

    # live quotes snapshot if present (set by _enrich_with_live_quotes)
    if hasattr(a, "live_quotes") and a.live_quotes:
        doc["live_quotes"] = a.live_quotes

    # Store compact artifact for drilldown
    try:
        import json
        flat = a.to_dict()
        # Truncate think_log to keep doc size reasonable
        flat["think_log"] = flat.get("think_log", [])[:20]
        doc["artifact_json"] = flat
    except Exception:
        pass

    return doc


async def index_cycle_run(artifact) -> bool:
    """
    Index a cycle RunArtifact to ES.
    Called at the end of each cycle — non-blocking (fire-and-forget).
    Returns True if indexed successfully.
    """
    try:
        await _ensure_index()
        doc = _flatten_artifact(artifact)

        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.put(
                f"{_ES_URL}/{_INDEX}/_doc/{artifact.run_id}",
                json=doc,
            )
            if r.status_code in (200, 201):
                logger.info(f"cycle_indexer: indexed {artifact.run_id} -> ES ({r.status_code})")
                return True
            logger.warning(f"cycle_indexer: index failed {r.status_code}: {r.text[:200]}")
            return False
    except Exception as exc:
        logger.warning(f"cycle_indexer: index_cycle_run error: {exc}")
        return False


def fire_and_forget_index(artifact) -> None:
    """
    Schedule ES indexing as a non-blocking asyncio task.
    Safe to call from any async context, ignores errors.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_index_with_semaphore(artifact))
    except RuntimeError:
        pass  # No running loop — skip silently


_sem: Optional[asyncio.Semaphore] = None


async def _index_with_semaphore(artifact) -> None:
    """Semaphore-guarded index call (max 3 concurrent ES writes)."""
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(3)
    async with _sem:
        await index_cycle_run(artifact)
