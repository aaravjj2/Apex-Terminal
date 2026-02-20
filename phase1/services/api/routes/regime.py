"""
Wave 6 — Regime Detection
Market regime classification (bull/bear/neutral/volatile).
"""
import hashlib
import json
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/regime", tags=["regime"])


class RegimeSnapshot(BaseModel):
    symbol: str
    regime: str  # bullish / bearish / neutral / volatile
    confidence: float
    vix_level: float
    trend_20d: float
    trend_50d: float
    iv_rank: float
    breadth_score: float
    updated_at: str


DEMO_REGIMES: List[dict] = [
    {"symbol": "SPY", "regime": "neutral", "confidence": 0.78, "vix_level": 18.5, "trend_20d": 0.12, "trend_50d": 0.08, "iv_rank": 42.0, "breadth_score": 0.55, "updated_at": "2026-01-16T16:00:00Z"},
    {"symbol": "QQQ", "regime": "bullish", "confidence": 0.82, "vix_level": 20.1, "trend_20d": 0.25, "trend_50d": 0.18, "iv_rank": 48.0, "breadth_score": 0.65, "updated_at": "2026-01-16T16:00:00Z"},
    {"symbol": "IWM", "regime": "bearish", "confidence": 0.71, "vix_level": 22.3, "trend_20d": -0.15, "trend_50d": -0.08, "iv_rank": 58.0, "breadth_score": 0.38, "updated_at": "2026-01-16T16:00:00Z"},
    {"symbol": "DIA", "regime": "neutral", "confidence": 0.75, "vix_level": 17.8, "trend_20d": 0.05, "trend_50d": 0.03, "iv_rank": 38.0, "breadth_score": 0.52, "updated_at": "2026-01-16T16:00:00Z"},
    {"symbol": "XLK", "regime": "bullish", "confidence": 0.85, "vix_level": 19.2, "trend_20d": 0.30, "trend_50d": 0.22, "iv_rank": 45.0, "breadth_score": 0.70, "updated_at": "2026-01-16T16:00:00Z"},
    {"symbol": "SMH", "regime": "volatile", "confidence": 0.68, "vix_level": 28.5, "trend_20d": 0.08, "trend_50d": -0.02, "iv_rank": 72.0, "breadth_score": 0.45, "updated_at": "2026-01-16T16:00:00Z"},
]


@router.get("")
async def list_regimes():
    return {"regimes": DEMO_REGIMES}


@router.get("/hash")
async def regime_hash():
    canonical = json.dumps(DEMO_REGIMES, sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest()}


@router.get("/summary")
async def regime_summary():
    counts = {"bullish": 0, "bearish": 0, "neutral": 0, "volatile": 0}
    for r in DEMO_REGIMES:
        counts[r["regime"]] = counts.get(r["regime"], 0) + 1
    dominant = max(counts, key=counts.get)
    avg_vix = sum(r["vix_level"] for r in DEMO_REGIMES) / len(DEMO_REGIMES)
    return {
        "dominant_regime": dominant,
        "counts": counts,
        "avg_vix": round(avg_vix, 2),
        "symbol_count": len(DEMO_REGIMES),
    }


@router.get("/{symbol}")
async def get_regime(symbol: str):
    for r in DEMO_REGIMES:
        if r["symbol"] == symbol.upper():
            return r
    return {"symbol": symbol.upper(), "regime": "unknown", "confidence": 0.0, "vix_level": 0.0,
            "trend_20d": 0.0, "trend_50d": 0.0, "iv_rank": 0.0, "breadth_score": 0.0, "updated_at": ""}
