"""Wave 8 — Signal Marketplace: publish, search and subscribe to alpha signals."""
import hashlib, json
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v1/signal-market", tags=["signal-market"])

DEMO_SIGNALS: list = [
    {"id": "sig-001", "name": "Momentum Cross",       "author": "quant_labs",   "type": "momentum",  "asset_class": "equity", "sharpe_3y": 1.42, "win_rate": 0.58, "subscribers": 342, "price_usd": 0,    "tags": ["free", "trend"]},
    {"id": "sig-002", "name": "Earnings Drift Alpha", "author": "alpha_forge",  "type": "event",     "asset_class": "equity", "sharpe_3y": 1.89, "win_rate": 0.63, "subscribers": 218, "price_usd": 49,   "tags": ["earnings", "premium"]},
    {"id": "sig-003", "name": "Vol Term Structure",   "author": "optionsmind",  "type": "volatility","asset_class": "options","sharpe_3y": 1.21, "win_rate": 0.54, "subscribers": 189, "price_usd": 99,   "tags": ["vol", "premium"]},
    {"id": "sig-004", "name": "Macro Regime Filter",  "author": "macro_global", "type": "regime",    "asset_class": "multi",  "sharpe_3y": 0.98, "win_rate": 0.61, "subscribers": 512, "price_usd": 0,    "tags": ["free", "macro"]},
    {"id": "sig-005", "name": "Short Interest Spike", "author": "flow_hunter",  "type": "flow",      "asset_class": "equity", "sharpe_3y": 1.67, "win_rate": 0.55, "subscribers": 97,  "price_usd": 29,   "tags": ["short", "flow"]},
    {"id": "sig-006", "name": "Crypto Correlation",   "author": "cryptonix",    "type": "correlation","asset_class": "crypto", "sharpe_3y": 0.74, "win_rate": 0.49, "subscribers": 67,  "price_usd": 0,    "tags": ["free", "crypto"]},
]

def _hash():
    return hashlib.sha256(json.dumps(DEMO_SIGNALS, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/listings")
async def list_signals(signal_type: str | None = Query(None)):
    items = DEMO_SIGNALS
    if signal_type:
        items = [s for s in items if s["type"] == signal_type]
    return {"signals": items, "count": len(items), "hash": DEMO_HASH}

@router.post("/publish")
async def publish_signal(body: dict = {}):
    new_id = f"sig-{100 + len(DEMO_SIGNALS):03d}"
    return {"id": new_id, "status": "published", "hash": DEMO_HASH}

@router.post("/subscribe/{signal_id}")
async def subscribe(signal_id: str):
    sig = next((s for s in DEMO_SIGNALS if s["id"] == signal_id), None)
    if sig is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"signal_id": signal_id, "subscribed": True, "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}
