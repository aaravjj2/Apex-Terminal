"""
v1.41 — Watchlist Manager (DEMO-first)
CRUD watchlists with deterministic demo data.
"""
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/watchlists", tags=["watchlists"])


class WatchlistItem(BaseModel):
    symbol: str
    added_at: str
    notes: str = ""


class Watchlist(BaseModel):
    id: str
    name: str
    items: List[WatchlistItem]
    created_at: str


DEMO_WATCHLISTS: List[dict] = [
    {
        "id": "wl-001",
        "name": "Mega-Cap Tech",
        "items": [
            {"symbol": "AAPL", "added_at": "2025-01-15T00:00:00Z", "notes": "Core holding"},
            {"symbol": "MSFT", "added_at": "2025-01-15T00:00:00Z", "notes": "Cloud growth"},
            {"symbol": "NVDA", "added_at": "2025-01-15T00:00:00Z", "notes": "AI leader"},
            {"symbol": "GOOGL", "added_at": "2025-01-15T00:00:00Z", "notes": "Search + AI"},
        ],
        "created_at": "2025-01-15T00:00:00Z",
    },
    {
        "id": "wl-002",
        "name": "ETF Core",
        "items": [
            {"symbol": "SPY", "added_at": "2025-01-15T00:00:00Z", "notes": "S&P 500"},
            {"symbol": "QQQ", "added_at": "2025-01-15T00:00:00Z", "notes": "Nasdaq 100"},
            {"symbol": "IWM", "added_at": "2025-01-15T00:00:00Z", "notes": "Russell 2000"},
        ],
        "created_at": "2025-01-15T00:00:00Z",
    },
    {
        "id": "wl-003",
        "name": "High IV Targets",
        "items": [
            {"symbol": "TSLA", "added_at": "2025-01-15T00:00:00Z", "notes": "Volatility play"},
            {"symbol": "AMD", "added_at": "2025-01-15T00:00:00Z", "notes": "Semiconductor IV"},
            {"symbol": "META", "added_at": "2025-01-15T00:00:00Z", "notes": "Earnings premium"},
        ],
        "created_at": "2025-01-15T00:00:00Z",
    },
]


@router.get("")
async def list_watchlists():
    """Return all demo watchlists."""
    return DEMO_WATCHLISTS


@router.get("/hash")
async def watchlists_hash():
    """Determinism hash of demo watchlists."""
    canonical = json.dumps(DEMO_WATCHLISTS, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/{watchlist_id}")
async def get_watchlist(watchlist_id: str):
    """Return a specific watchlist."""
    for wl in DEMO_WATCHLISTS:
        if wl["id"] == watchlist_id:
            return wl
    return {"error": "Watchlist not found"}


@router.get("/{watchlist_id}/symbols")
async def get_watchlist_symbols(watchlist_id: str):
    """Return just the symbols in a watchlist."""
    for wl in DEMO_WATCHLISTS:
        if wl["id"] == watchlist_id:
            return [item["symbol"] for item in wl["items"]]
    return []
