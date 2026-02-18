"""
v1.43 — Trade Journal (DEMO-first)
Journal entries tied to trades with notes/tags.
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/journal", tags=["journal"])

DEMO_ENTRIES: List[dict] = [
    {
        "id": "j-001",
        "trade_id": "trade-demo-001",
        "symbol": "AAPL",
        "direction": "long",
        "entry_price": 172.50,
        "exit_price": 178.20,
        "pnl": 5.70,
        "tags": ["earnings", "momentum"],
        "notes": "Entered pre-earnings on strong momentum. Exited after gap-up.",
        "emotion": "confident",
        "created_at": "2025-01-15T00:00:00Z",
    },
    {
        "id": "j-002",
        "trade_id": "trade-demo-002",
        "symbol": "SPY",
        "direction": "short",
        "entry_price": 480.00,
        "exit_price": 475.50,
        "pnl": 4.50,
        "tags": ["hedge", "macro"],
        "notes": "Hedged portfolio with SPY puts ahead of FOMC.",
        "emotion": "cautious",
        "created_at": "2025-01-16T00:00:00Z",
    },
    {
        "id": "j-003",
        "trade_id": "trade-demo-003",
        "symbol": "TSLA",
        "direction": "long",
        "entry_price": 248.00,
        "exit_price": 243.50,
        "pnl": -4.50,
        "tags": ["volatility", "earnings"],
        "notes": "Earnings play didn't work out. Stopped out per plan.",
        "emotion": "disciplined",
        "created_at": "2025-01-17T00:00:00Z",
    },
    {
        "id": "j-004",
        "trade_id": "trade-demo-004",
        "symbol": "NVDA",
        "direction": "long",
        "entry_price": 875.00,
        "exit_price": 912.30,
        "pnl": 37.30,
        "tags": ["AI", "breakout"],
        "notes": "AI sector breakout. Scaled in on volume confirmation.",
        "emotion": "confident",
        "created_at": "2025-01-18T00:00:00Z",
    },
]


@router.get("")
async def list_journal_entries():
    """Return all demo journal entries."""
    return DEMO_ENTRIES


@router.get("/hash")
async def journal_hash():
    """Determinism hash of journal entries."""
    canonical = json.dumps(DEMO_ENTRIES, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/tags")
async def list_tags():
    """Return all unique tags across journal entries."""
    tags = set()
    for entry in DEMO_ENTRIES:
        tags.update(entry["tags"])
    return sorted(tags)


@router.get("/by-tag/{tag}")
async def get_entries_by_tag(tag: str):
    """Return journal entries filtered by tag."""
    return [e for e in DEMO_ENTRIES if tag in e["tags"]]


@router.get("/stats")
async def journal_stats():
    """Return aggregate journal statistics."""
    total = len(DEMO_ENTRIES)
    wins = sum(1 for e in DEMO_ENTRIES if e["pnl"] > 0)
    losses = sum(1 for e in DEMO_ENTRIES if e["pnl"] < 0)
    total_pnl = sum(e["pnl"] for e in DEMO_ENTRIES)
    return {
        "total_entries": total,
        "wins": wins,
        "losses": losses,
        "win_rate": round(wins / total, 3) if total > 0 else 0,
        "total_pnl": round(total_pnl, 2),
    }


@router.get("/{entry_id}")
async def get_journal_entry(entry_id: str):
    """Return a specific journal entry."""
    for entry in DEMO_ENTRIES:
        if entry["id"] == entry_id:
            return entry
    return {"error": "Journal entry not found"}
