"""
v1.48 — Data Quality Monitor (DEMO-first)
Track data freshness, gaps, and integrity across feeds.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/data-quality", tags=["data-quality"])

DEMO_FEEDS: List[dict] = [
    {
        "id": "feed-001",
        "name": "Alpaca Market Data",
        "type": "equity_tick",
        "status": "healthy",
        "latency_ms": 45,
        "last_update": "2025-01-15T15:59:58Z",
        "gaps_24h": 0,
        "integrity_score": 0.998,
    },
    {
        "id": "feed-002",
        "name": "Options Chain Feed",
        "type": "options",
        "status": "healthy",
        "latency_ms": 120,
        "last_update": "2025-01-15T15:59:55Z",
        "gaps_24h": 1,
        "integrity_score": 0.995,
    },
    {
        "id": "feed-003",
        "name": "News Sentiment",
        "type": "nlp",
        "status": "degraded",
        "latency_ms": 2500,
        "last_update": "2025-01-15T15:45:00Z",
        "gaps_24h": 3,
        "integrity_score": 0.970,
    },
    {
        "id": "feed-004",
        "name": "Historical OHLCV",
        "type": "ohlcv",
        "status": "healthy",
        "latency_ms": 80,
        "last_update": "2025-01-15T15:59:50Z",
        "gaps_24h": 0,
        "integrity_score": 0.999,
    },
    {
        "id": "feed-005",
        "name": "Crypto WebSocket",
        "type": "crypto",
        "status": "stale",
        "latency_ms": 9999,
        "last_update": "2025-01-15T12:00:00Z",
        "gaps_24h": 15,
        "integrity_score": 0.850,
    },
]


@router.get("")
async def list_feeds():
    """Return all data feed quality reports."""
    return DEMO_FEEDS


@router.get("/hash")
async def data_quality_hash():
    """Determinism hash."""
    canonical = json.dumps(DEMO_FEEDS, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/summary")
async def quality_summary():
    """Aggregate quality summary."""
    healthy = sum(1 for f in DEMO_FEEDS if f["status"] == "healthy")
    degraded = sum(1 for f in DEMO_FEEDS if f["status"] == "degraded")
    stale = sum(1 for f in DEMO_FEEDS if f["status"] == "stale")
    avg_integrity = sum(f["integrity_score"] for f in DEMO_FEEDS) / len(DEMO_FEEDS)
    return {
        "total_feeds": len(DEMO_FEEDS),
        "healthy": healthy,
        "degraded": degraded,
        "stale": stale,
        "avg_integrity": round(avg_integrity, 4),
    }


@router.get("/{feed_id}")
async def get_feed(feed_id: str):
    """Get single feed status."""
    for f in DEMO_FEEDS:
        if f["id"] == feed_id:
            return f
    return {"error": "not found"}
