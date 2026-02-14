"""
v1.37 — Provider Registry
Standardized provider abstraction returning deterministic status in DEMO mode.
"""
import hashlib
import json
import os
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/provider-registry", tags=["provider-registry"])


class ProviderCapability(BaseModel):
    name: str
    mode: str  # "demo" | "live" | "mock"
    enabled: bool
    subsystem: str  # "market_data" | "replay" | "exports" | "strategy" | "agents" | "search" | "llm"
    replay_status: Optional[str] = None
    metadata: dict = {}


DEMO_PROVIDERS: List[dict] = [
    {
        "name": "market-data-demo",
        "mode": "demo",
        "enabled": True,
        "subsystem": "market_data",
        "replay_status": "available",
        "metadata": {"source": "sample_ticks.csv", "symbols": ["AAPL", "TSLA", "MSFT"]},
    },
    {
        "name": "replay-engine",
        "mode": "demo",
        "enabled": True,
        "subsystem": "replay",
        "replay_status": "ready",
        "metadata": {"max_bars": 1000, "supports_speed": True},
    },
    {
        "name": "export-service",
        "mode": "demo",
        "enabled": True,
        "subsystem": "exports",
        "replay_status": None,
        "metadata": {"formats": ["json", "csv", "zip"], "bundle_manifest": True},
    },
    {
        "name": "strategy-artifacts",
        "mode": "demo",
        "enabled": True,
        "subsystem": "strategy",
        "replay_status": None,
        "metadata": {"validation": True, "diff": True, "hash_ledger": True},
    },
    {
        "name": "search-index",
        "mode": "demo",
        "enabled": True,
        "subsystem": "search",
        "replay_status": None,
        "metadata": {"backend": "in-memory", "indexed_types": ["strategies", "backtests", "risk_runs", "validations", "exports"]},
    },
    {
        "name": "agent-runner",
        "mode": "demo",
        "enabled": True,
        "subsystem": "agents",
        "replay_status": None,
        "metadata": {"tools": ["search", "backtest", "risk_analysis", "citations"], "max_steps": 10},
    },
    {
        "name": "llm-stub",
        "mode": "demo",
        "enabled": False,
        "subsystem": "llm",
        "replay_status": None,
        "metadata": {"provider": "mock", "model": "none", "reason": "No API key configured"},
    },
]


def _canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


@router.get("/providers")
async def list_providers():
    """Return deterministic list of all registered providers."""
    return DEMO_PROVIDERS


@router.get("/providers/hash")
async def providers_hash():
    """Return SHA-256 hash of the canonical provider list for determinism proof."""
    canonical = _canonical_json(DEMO_PROVIDERS)
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h, "count": len(DEMO_PROVIDERS), "canonical_bytes": len(canonical)}


@router.get("/providers/{subsystem}")
async def providers_by_subsystem(subsystem: str):
    """Return providers filtered by subsystem."""
    return [p for p in DEMO_PROVIDERS if p["subsystem"] == subsystem]
