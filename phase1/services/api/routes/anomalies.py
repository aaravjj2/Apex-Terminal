"""
Wave 7 — Anomaly Detection: statistical anomalies in market/portfolio data.

STATUS: NOT IMPLEMENTED — requires real market data pipeline (Phase 3).
Returns empty results until anomaly detection engine is wired.
"""
import logging
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/anomalies", tags=["anomalies"])
logger = logging.getLogger(__name__)

_NOT_IMPL = "Anomaly detection requires real market data pipeline (Phase 3). No fabricated data."


@router.get("")
async def list_anomalies(severity: str = None):
    return {"anomalies": [], "count": 0, "status": "not_implemented"}


@router.get("/hash")
async def get_hash():
    raise HTTPException(status_code=501, detail=_NOT_IMPL)


@router.get("/summary")
async def get_summary():
    return {"total": 0, "by_severity": {"high": 0, "medium": 0, "low": 0}, "unresolved": 0, "status": "not_implemented"}


@router.get("/{anomaly_id}")
async def get_anomaly(anomaly_id: str):
    raise HTTPException(status_code=404, detail=f"Anomaly {anomaly_id} not found")
