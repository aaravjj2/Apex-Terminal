"""Wave 9 — Liquidity Heatmap: symbol × time bucket grid."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/liquidity", tags=["liquidity"])

SYMBOLS = ["AAPL", "MSFT", "TSLA", "NVDA", "GOOGL", "AMZN"]
TIME_BUCKETS = ["09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
                "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"]

# Deterministic liquidity scores (0-100) seeded statically
_SEEDS = [
    [91,87,79,72,68,61,58,62,65,70,75,82,88],
    [88,83,75,69,65,58,55,59,62,67,72,79,84],
    [74,69,61,55,48,41,39,43,47,52,58,65,71],
    [89,84,77,70,66,59,56,60,63,68,74,81,87],
    [82,77,70,63,59,52,49,53,57,62,68,75,80],
    [85,80,73,66,62,55,52,56,59,65,71,78,83],
]

DEMO_HEATMAP: dict = {
    "symbols": SYMBOLS,
    "time_buckets": TIME_BUCKETS,
    "grid": {SYMBOLS[i]: {TIME_BUCKETS[j]: _SEEDS[i][j] for j in range(len(TIME_BUCKETS))} for i in range(len(SYMBOLS))},
}

def _hash():
    return hashlib.sha256(json.dumps(DEMO_HEATMAP, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/heatmap")
async def get_heatmap():
    return {**DEMO_HEATMAP, "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/heatmap/{symbol}")
async def get_symbol_row(symbol: str):
    sym = symbol.upper()
    if sym not in DEMO_HEATMAP["grid"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Symbol not found")
    return {"symbol": sym, "time_buckets": TIME_BUCKETS, "scores": DEMO_HEATMAP["grid"][sym], "hash": DEMO_HASH}
