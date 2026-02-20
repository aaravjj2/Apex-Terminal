"""Wave 10 — Policy Signal Generator: macro policy events mapped to trading signals."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/policy-signal", tags=["policy-signal"])

DEMO_EVENTS: list = [
    {"id": "ps-001", "date": "2026-01-15", "source": "FOMC",         "event": "Rate hold at 4.50%",            "signal": "neutral",  "asset_class": "equities", "strength": 0.35, "confidence": 0.82},
    {"id": "ps-002", "date": "2026-01-14", "source": "ECB",          "event": "Rate cut 25bps to 2.75%",       "signal": "bullish",  "asset_class": "EU equities","strength": 0.71, "confidence": 0.89},
    {"id": "ps-003", "date": "2026-01-12", "source": "US Treasury",  "event": "10Y auction weak demand",       "signal": "bearish",  "asset_class": "bonds",    "strength": 0.58, "confidence": 0.74},
    {"id": "ps-004", "date": "2026-01-10", "source": "BOJ",          "event": "Rate hike 10bps to 0.35%",      "signal": "bearish",  "asset_class": "JPY equities","strength": 0.63,"confidence": 0.77},
    {"id": "ps-005", "date": "2026-01-08", "source": "SEC",          "event": "Crypto ETF approval expanded",  "signal": "bullish",  "asset_class": "crypto",   "strength": 0.88, "confidence": 0.91},
    {"id": "ps-006", "date": "2026-01-06", "source": "White House",  "event": "Tariff expansion announced",    "signal": "bearish",  "asset_class": "industrials","strength": 0.74,"confidence": 0.86},
    {"id": "ps-007", "date": "2026-01-05", "source": "CFTC",         "event": "Position limit rule change",    "signal": "neutral",  "asset_class": "commodities","strength": 0.21,"confidence": 0.68},
]

def _hash():
    return hashlib.sha256(json.dumps(DEMO_EVENTS, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/events")
async def list_events():
    return {"events": DEMO_EVENTS, "count": len(DEMO_EVENTS), "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/events/{event_id}")
async def get_event(event_id: str):
    ev = next((e for e in DEMO_EVENTS if e["id"] == event_id), None)
    if ev is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
    return ev
