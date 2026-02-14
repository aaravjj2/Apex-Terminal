"""
v1.38 — Citations & Evidence Format
Standardized citation/evidence objects used across risk runs, backtests,
strategy artifacts, validations, exports, and provenance.
"""
import hashlib
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/citations", tags=["citations"])


class Citation(BaseModel):
    id: str
    source_type: str  # "risk_run" | "backtest" | "validation" | "strategy" | "export" | "provenance"
    source_id: str
    title: str
    detail: str
    timestamp: str
    confidence: Optional[float] = None
    url: Optional[str] = None
    metadata: dict = {}


DEMO_CITATIONS: List[dict] = [
    {
        "id": "cit-001",
        "source_type": "risk_run",
        "source_id": "RR-20250115-001",
        "title": "Greeks Calculation — AAPL 170C",
        "detail": "Delta=0.65, Gamma=0.04, Vega=0.28, Theta=-0.05. Computed via Black-Scholes with IV=32.5%.",
        "timestamp": "2025-01-15T12:00:00Z",
        "confidence": 0.95,
        "url": None,
        "metadata": {"model": "black-scholes", "underlying": "AAPL", "strike": 170},
    },
    {
        "id": "cit-002",
        "source_type": "backtest",
        "source_id": "BT-20250115-001",
        "title": "SMA Crossover Backtest Result",
        "detail": "Win rate 62.3%, Sharpe 1.45, Max drawdown -8.2%. Tested over 252 trading days.",
        "timestamp": "2025-01-15T12:01:00Z",
        "confidence": 0.88,
        "url": None,
        "metadata": {"strategy": "sma-crossover-20-50", "period": "1Y", "trades": 47},
    },
    {
        "id": "cit-003",
        "source_type": "validation",
        "source_id": "VAL-20250115-001",
        "title": "Strategy Schema Validation Pass",
        "detail": "Schema v2 validation passed. All required fields present. 2 optional fields missing (acceptable).",
        "timestamp": "2025-01-15T12:02:00Z",
        "confidence": 1.0,
        "url": None,
        "metadata": {"schema_version": "v2", "warnings": 0, "errors": 0},
    },
    {
        "id": "cit-004",
        "source_type": "strategy",
        "source_id": "STR-demo-sma",
        "title": "Strategy Artifact — SMA Crossover",
        "detail": "Crossover strategy using SMA(20) and SMA(50). Tagged: trend, moving-average.",
        "timestamp": "2025-01-15T12:03:00Z",
        "confidence": None,
        "url": None,
        "metadata": {"type": "crossover", "indicators": ["SMA-20", "SMA-50"]},
    },
    {
        "id": "cit-005",
        "source_type": "export",
        "source_id": "EXP-20250115-001",
        "title": "Export Bundle Manifest",
        "detail": "Bundle contains spec.json, validation.json, manifest.json, ledger.json. SHA256 verified.",
        "timestamp": "2025-01-15T12:04:00Z",
        "confidence": 1.0,
        "url": None,
        "metadata": {"files": 4, "format": "zip", "size_bytes": 8192},
    },
    {
        "id": "cit-006",
        "source_type": "provenance",
        "source_id": "PROV-20250115-001",
        "title": "Provenance Chain — 3 entries",
        "detail": "Created → Validated → Exported. Full hash chain intact. Checksum: a1b2c3.",
        "timestamp": "2025-01-15T12:05:00Z",
        "confidence": 1.0,
        "url": None,
        "metadata": {"chain_length": 3, "checksum": "a1b2c3d4e5f6"},
    },
]


def _canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


@router.get("/")
async def list_citations():
    """Return all demo citations in stable order."""
    return DEMO_CITATIONS


@router.get("/hash")
async def citations_hash():
    """Return SHA-256 hash of canonical citations for determinism proof."""
    canonical = _canonical_json(DEMO_CITATIONS)
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h, "count": len(DEMO_CITATIONS)}


@router.get("/by-source/{source_type}")
async def citations_by_source(source_type: str):
    """Return citations filtered by source type."""
    return [c for c in DEMO_CITATIONS if c["source_type"] == source_type]


@router.get("/{citation_id}")
async def get_citation(citation_id: str):
    """Return a single citation by ID."""
    for c in DEMO_CITATIONS:
        if c["id"] == citation_id:
            return c
    return {"error": "Citation not found"}
