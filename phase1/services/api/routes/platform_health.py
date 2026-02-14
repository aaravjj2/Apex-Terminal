"""
v1.50 — Platform Health Dashboard (DEMO-first)
Real-time component health, uptime, and metrics.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/platform-health", tags=["platform-health"])

DEMO_COMPONENTS: List[dict] = [
    {
        "id": "comp-001",
        "name": "FastAPI Backend",
        "status": "operational",
        "uptime_pct": 99.98,
        "latency_p50_ms": 12,
        "latency_p99_ms": 85,
        "last_incident": None,
    },
    {
        "id": "comp-002",
        "name": "WebSocket Gateway",
        "status": "operational",
        "uptime_pct": 99.95,
        "latency_p50_ms": 5,
        "latency_p99_ms": 22,
        "last_incident": "2025-01-10T03:00:00Z",
    },
    {
        "id": "comp-003",
        "name": "Market Data Pipeline",
        "status": "operational",
        "uptime_pct": 99.90,
        "latency_p50_ms": 45,
        "latency_p99_ms": 200,
        "last_incident": "2025-01-12T08:30:00Z",
    },
    {
        "id": "comp-004",
        "name": "Strategy Engine",
        "status": "degraded",
        "uptime_pct": 99.50,
        "latency_p50_ms": 150,
        "latency_p99_ms": 800,
        "last_incident": "2025-01-15T14:00:00Z",
    },
    {
        "id": "comp-005",
        "name": "Backtest Worker",
        "status": "operational",
        "uptime_pct": 99.80,
        "latency_p50_ms": 2000,
        "latency_p99_ms": 5000,
        "last_incident": None,
    },
    {
        "id": "comp-006",
        "name": "n8n Automation",
        "status": "operational",
        "uptime_pct": 99.70,
        "latency_p50_ms": 100,
        "latency_p99_ms": 450,
        "last_incident": "2025-01-08T22:00:00Z",
    },
]

DEMO_PLATFORM_SUMMARY: dict = {
    "overall_status": "degraded",
    "total_components": len(DEMO_COMPONENTS),
    "operational": sum(1 for c in DEMO_COMPONENTS if c["status"] == "operational"),
    "degraded": sum(1 for c in DEMO_COMPONENTS if c["status"] == "degraded"),
    "down": sum(1 for c in DEMO_COMPONENTS if c["status"] == "down"),
    "avg_uptime_pct": round(
        sum(c["uptime_pct"] for c in DEMO_COMPONENTS) / len(DEMO_COMPONENTS), 2
    ),
    "version": "1.50.0",
    "environment": "demo",
}


@router.get("")
async def list_components():
    """Return all component statuses."""
    return DEMO_COMPONENTS


@router.get("/hash")
async def health_hash():
    """Determinism hash over components."""
    canonical = json.dumps(DEMO_COMPONENTS, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/summary")
async def platform_summary():
    """Overall platform health summary."""
    return DEMO_PLATFORM_SUMMARY


@router.get("/{component_id}")
async def get_component(component_id: str):
    """Get single component health."""
    for c in DEMO_COMPONENTS:
        if c["id"] == component_id:
            return c
    return {"error": "not found"}


@router.get("/status/{status}")
async def by_status(status: str):
    """Filter components by status."""
    return [c for c in DEMO_COMPONENTS if c["status"] == status]
