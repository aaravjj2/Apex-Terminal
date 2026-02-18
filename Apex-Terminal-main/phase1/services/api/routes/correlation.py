"""
v1.42 — Correlation Matrix (DEMO-first)
Cross-asset correlation data for portfolio analysis.
"""
import hashlib
import json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/correlation", tags=["correlation"])

# Deterministic demo correlation matrix for core symbols
DEMO_SYMBOLS = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA"]

# Pre-computed demo correlations (symmetric)
DEMO_MATRIX: dict = {
    "symbols": DEMO_SYMBOLS,
    "period": "1Y",
    "data": [
        [1.000, 0.952, 0.874, 0.891, 0.782, 0.654],
        [0.952, 1.000, 0.912, 0.923, 0.845, 0.701],
        [0.874, 0.912, 1.000, 0.856, 0.803, 0.612],
        [0.891, 0.923, 0.856, 1.000, 0.778, 0.589],
        [0.782, 0.845, 0.803, 0.778, 1.000, 0.723],
        [0.654, 0.701, 0.612, 0.589, 0.723, 1.000],
    ],
    "computed_at": "2025-01-15T00:00:00Z",
}


@router.get("/matrix")
async def get_correlation_matrix():
    """Return demo correlation matrix."""
    return DEMO_MATRIX


@router.get("/hash")
async def correlation_hash():
    """Determinism hash of the correlation matrix."""
    canonical = json.dumps(DEMO_MATRIX, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha256(canonical.encode()).hexdigest()
    return {"hash": h}


@router.get("/pair/{symbol_a}/{symbol_b}")
async def get_pair_correlation(symbol_a: str, symbol_b: str):
    """Return correlation between two specific symbols."""
    syms = DEMO_MATRIX["symbols"]
    if symbol_a in syms and symbol_b in syms:
        i = syms.index(symbol_a)
        j = syms.index(symbol_b)
        return {
            "symbol_a": symbol_a,
            "symbol_b": symbol_b,
            "correlation": DEMO_MATRIX["data"][i][j],
            "period": DEMO_MATRIX["period"],
        }
    return {"error": "Symbol not found in matrix"}
