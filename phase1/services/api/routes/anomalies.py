"""Wave 7 — Anomaly Detection: statistical anomalies in market/portfolio data."""
import hashlib, json
from typing import List
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/anomalies", tags=["anomalies"])

DEMO_ANOMALIES: List[dict] = [
    {"id": "anom-001", "symbol": "TSLA", "type": "price_spike",    "severity": "high",   "z_score": 4.21, "detected_at": "2026-01-16T14:32:00Z", "description": "Price moved 4.2σ in a single bar", "resolved": False},
    {"id": "anom-002", "symbol": "SPY",  "type": "volume_surge",   "severity": "medium", "z_score": 3.10, "detected_at": "2026-01-16T13:15:00Z", "description": "Volume 3.1× daily average in 30min window", "resolved": False},
    {"id": "anom-003", "symbol": "AAPL", "type": "iv_crush",       "severity": "low",    "z_score": 2.45, "detected_at": "2026-01-16T09:45:00Z", "description": "Implied volatility dropped 40% post-earnings", "resolved": True},
    {"id": "anom-004", "symbol": "QQQ",  "type": "correlation_break","severity": "high", "z_score": 3.88, "detected_at": "2026-01-16T10:00:00Z", "description": "QQQ/SPY correlation dropped below 0.80", "resolved": False},
    {"id": "anom-005", "symbol": "MSFT", "type": "gap_open",        "severity": "medium","z_score": 2.90, "detected_at": "2026-01-16T09:30:00Z", "description": "Open price gapped 2.3% from prior close", "resolved": True},
    {"id": "anom-006", "symbol": "NVDA", "type": "liquidity_drop",  "severity": "high",  "z_score": 4.05, "detected_at": "2026-01-16T11:20:00Z", "description": "Bid-ask spread widened to 5× normal", "resolved": False},
    {"id": "anom-007", "symbol": "IWM",  "type": "regime_shift",    "severity": "medium","z_score": 3.22, "detected_at": "2026-01-16T15:00:00Z", "description": "Small-cap regime transitioned bear→neutral", "resolved": True},
    {"id": "anom-008", "symbol": "AMZN", "type": "order_imbalance", "severity": "low",   "z_score": 2.11, "detected_at": "2026-01-16T12:45:00Z", "description": "90% order flow was buy-side for 15min", "resolved": True},
]

def _hash():
    return hashlib.sha256(json.dumps(DEMO_ANOMALIES, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("")
async def list_anomalies(severity: str = None):
    items = DEMO_ANOMALIES if not severity else [a for a in DEMO_ANOMALIES if a["severity"] == severity]
    return {"anomalies": items, "count": len(items), "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/{anomaly_id}")
async def get_anomaly(anomaly_id: str):
    for a in DEMO_ANOMALIES:
        if a["id"] == anomaly_id:
            return a
    return {"error": "not_found", "id": anomaly_id}

@router.get("/summary")
async def get_summary():
    counts = {"high": 0, "medium": 0, "low": 0}
    for a in DEMO_ANOMALIES:
        counts[a["severity"]] = counts.get(a["severity"], 0) + 1
    return {"total": len(DEMO_ANOMALIES), "by_severity": counts, "unresolved": sum(1 for a in DEMO_ANOMALIES if not a["resolved"]), "hash": DEMO_HASH}
