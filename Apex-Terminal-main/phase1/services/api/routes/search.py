"""
v1.39 — Internal Search Index (DEMO-first)
In-memory search index for strategies, backtests, risk runs, validations, exports.
No external Elastic dependency — deterministic fixture-driven results.
"""
import hashlib
import json
import re
from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/search", tags=["search"])


class SearchResult(BaseModel):
    id: str
    type: str  # "strategy" | "backtest" | "risk_run" | "validation" | "export"
    title: str
    summary: str
    score: float
    timestamp: str
    metadata: dict = {}


# Deterministic demo index
DEMO_INDEX: List[dict] = [
    {
        "id": "idx-001",
        "type": "strategy",
        "title": "SMA Crossover 20/50",
        "summary": "Simple moving average crossover strategy using SMA(20) and SMA(50). Tags: trend, moving-average.",
        "score": 1.0,
        "timestamp": "2025-01-15T10:00:00Z",
        "metadata": {"strategy_type": "crossover", "tags": ["trend", "moving-average"]},
    },
    {
        "id": "idx-002",
        "type": "strategy",
        "title": "RSI Mean Reversion",
        "summary": "RSI-based mean reversion strategy using RSI(14). Tags: oscillator, mean-reversion.",
        "score": 1.0,
        "timestamp": "2025-01-15T10:01:00Z",
        "metadata": {"strategy_type": "mean_reversion", "tags": ["oscillator", "mean-reversion"]},
    },
    {
        "id": "idx-003",
        "type": "backtest",
        "title": "Backtest: SMA Crossover 1Y",
        "summary": "Backtest run over 252 days. Win rate 62.3%, Sharpe 1.45, max drawdown -8.2%.",
        "score": 0.95,
        "timestamp": "2025-01-15T11:00:00Z",
        "metadata": {"strategy_id": "demo-sma", "period": "1Y", "trades": 47},
    },
    {
        "id": "idx-004",
        "type": "risk_run",
        "title": "Risk Run: AAPL Options Portfolio",
        "summary": "Greeks analysis for AAPL 170C. Delta=0.65, Gamma=0.04, Vega=0.28, Theta=-0.05.",
        "score": 0.92,
        "timestamp": "2025-01-15T12:00:00Z",
        "metadata": {"underlying": "AAPL", "strike": 170, "model": "black-scholes"},
    },
    {
        "id": "idx-005",
        "type": "validation",
        "title": "Validation: SMA Crossover Schema",
        "summary": "Schema v2 validation passed. All required fields present.",
        "score": 0.88,
        "timestamp": "2025-01-15T12:02:00Z",
        "metadata": {"schema_version": "v2", "result": "pass"},
    },
    {
        "id": "idx-006",
        "type": "export",
        "title": "Export: Strategy Bundle",
        "summary": "Bundle contains spec.json, validation.json, manifest.json, ledger.json. 4 files, 8KB.",
        "score": 0.85,
        "timestamp": "2025-01-15T12:04:00Z",
        "metadata": {"files": 4, "format": "zip"},
    },
    {
        "id": "idx-007",
        "type": "risk_run",
        "title": "Risk Run: Multi-leg Spread",
        "summary": "Bull call spread analysis. Net delta=0.35, risk/reward=1:2.5.",
        "score": 0.90,
        "timestamp": "2025-01-15T13:00:00Z",
        "metadata": {"strategy": "bull-call-spread", "legs": 2},
    },
    {
        "id": "idx-008",
        "type": "backtest",
        "title": "Backtest: RSI Mean Reversion 6M",
        "summary": "Backtest run over 126 days. Win rate 58.1%, Sharpe 1.12, max drawdown -12.1%.",
        "score": 0.87,
        "timestamp": "2025-01-15T14:00:00Z",
        "metadata": {"strategy_id": "demo-rsi", "period": "6M", "trades": 31},
    },
]


def _search_score(item: dict, query: str) -> float:
    """Score an item against query terms."""
    q = query.lower()
    text = f"{item['title']} {item['summary']} {item['type']}".lower()
    terms = q.split()
    matches = sum(1 for t in terms if t in text)
    if not terms:
        return item["score"]
    return (matches / len(terms)) * item["score"]


@router.get("/query")
async def search_query(
    q: str = Query(..., description="Search query string"),
    type: Optional[str] = Query(None, description="Filter by type"),
    limit: int = Query(10, description="Max results"),
):
    """Search the demo index with deterministic stable ordering."""
    results = []
    for item in DEMO_INDEX:
        if type and item["type"] != type:
            continue
        score = _search_score(item, q)
        if score > 0:
            results.append({**item, "score": round(score, 4)})
    # Stable sort: score desc, then id asc
    results.sort(key=lambda x: (-x["score"], x["id"]))
    return results[:limit]


@router.get("/index")
async def get_index():
    """Return the full demo index."""
    return DEMO_INDEX


@router.get("/index/hash")
async def index_hash():
    """Determinism hash of the full index."""
    canonical = json.dumps(DEMO_INDEX, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h, "count": len(DEMO_INDEX)}
