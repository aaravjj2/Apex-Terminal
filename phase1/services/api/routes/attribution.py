"""
v1.46 — Performance Attribution (DEMO-first)
P&L breakdown by strategy, sector, and time bucket.
"""
import hashlib
import json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/attribution", tags=["attribution"])

DEMO_ATTRIBUTION: dict = {
    "total_pnl": 12450.75,
    "period": "2025-01-01/2025-01-15",
    "by_strategy": [
        {"strategy": "Iron Condor", "pnl": 4200.00, "trades": 8, "win_rate": 0.75},
        {"strategy": "SMA Crossover", "pnl": 3100.50, "trades": 12, "win_rate": 0.67},
        {"strategy": "Momentum Scanner", "pnl": 2800.25, "trades": 6, "win_rate": 0.83},
        {"strategy": "Covered Call", "pnl": 2350.00, "trades": 4, "win_rate": 1.00},
    ],
    "by_sector": [
        {"sector": "Technology", "pnl": 6800.00, "weight": 0.42},
        {"sector": "ETFs", "pnl": 3200.50, "weight": 0.28},
        {"sector": "Consumer", "pnl": 1450.25, "weight": 0.18},
        {"sector": "Energy", "pnl": 1000.00, "weight": 0.12},
    ],
    "by_bucket": [
        {"bucket": "Week 1", "pnl": 5600.00},
        {"bucket": "Week 2", "pnl": 6850.75},
    ],
}


@router.get("")
async def get_attribution():
    """Full attribution breakdown."""
    return DEMO_ATTRIBUTION


@router.get("/hash")
async def attribution_hash():
    """Determinism hash."""
    canonical = json.dumps(DEMO_ATTRIBUTION, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/by-strategy")
async def by_strategy():
    """P&L by strategy."""
    return DEMO_ATTRIBUTION["by_strategy"]


@router.get("/by-sector")
async def by_sector():
    """P&L by sector."""
    return DEMO_ATTRIBUTION["by_sector"]


@router.get("/by-bucket")
async def by_bucket():
    """P&L by time bucket."""
    return DEMO_ATTRIBUTION["by_bucket"]
