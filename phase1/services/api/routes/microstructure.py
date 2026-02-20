"""Wave 9 — Microstructure Metrics: spread, imbalance, VWAP deviation."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/microstructure", tags=["microstructure"])

DEMO_METRICS: list = [
    {"symbol": "AAPL",  "bid": 189.82, "ask": 189.84, "spread_bps": 1.1,  "order_imbalance": 0.12,  "vwap": 189.91, "vwap_dev_bps": -4.7, "trades_per_min": 1580, "avg_trade_size": 102},
    {"symbol": "MSFT",  "bid": 420.50, "ask": 420.54, "spread_bps": 0.95, "order_imbalance": 0.07,  "vwap": 420.77, "vwap_dev_bps": -5.5, "trades_per_min": 1220, "avg_trade_size": 85},
    {"symbol": "TSLA",  "bid": 178.33, "ask": 178.42, "spread_bps": 5.05, "order_imbalance": -0.18, "vwap": 178.21, "vwap_dev_bps": 6.7,  "trades_per_min": 2810, "avg_trade_size": 67},
    {"symbol": "NVDA",  "bid": 694.10, "ask": 694.20, "spread_bps": 1.44, "order_imbalance": 0.31,  "vwap": 694.85, "vwap_dev_bps": -10.8,"trades_per_min": 1940, "avg_trade_size": 44},
    {"symbol": "GOOGL", "bid": 178.05, "ask": 178.08, "spread_bps": 1.68, "order_imbalance": -0.04, "vwap": 178.12, "vwap_dev_bps": -3.9, "trades_per_min": 890,  "avg_trade_size": 112},
    {"symbol": "AMZN",  "bid": 202.44, "ask": 202.47, "spread_bps": 1.48, "order_imbalance": 0.09,  "vwap": 202.55, "vwap_dev_bps": -5.4, "trades_per_min": 1105, "avg_trade_size": 98},
]

def _hash():
    return hashlib.sha256(json.dumps(DEMO_METRICS, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/metrics")
async def list_metrics():
    return {"metrics": DEMO_METRICS, "count": len(DEMO_METRICS), "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/metrics/{symbol}")
async def get_symbol_metrics(symbol: str):
    m = next((m for m in DEMO_METRICS if m["symbol"].upper() == symbol.upper()), None)
    if m is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Symbol not found")
    return m
