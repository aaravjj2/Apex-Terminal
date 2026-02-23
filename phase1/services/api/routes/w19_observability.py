"""
Waves 11-20 — Observability API Routes
System health, metrics, alerts, query performance, ILM.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.observability import (
    get_observability_service, AlertSeverity, ILMPolicy,
)

router = APIRouter(prefix="/api/v2/observability", tags=["observability-v2"])
logger = logging.getLogger(__name__)


class TrackQueryRequest(BaseModel):
    index_or_table: str
    operation: str
    duration_ms: float
    doc_count: int = 0
    success: bool = True
    error: Optional[str] = None


class RaiseAlertRequest(BaseModel):
    severity: str
    title: str
    message: str
    source: str


class RegisterILMRequest(BaseModel):
    policy_name: str
    hot_max_age: str = "7d"
    hot_max_size: str = "5gb"
    warm_min_age: str = "30d"
    delete_min_age: str = "90d"


@router.get("/health")
async def system_health(
    es_connected: bool = Query(default=False),
    broker_connected: bool = Query(default=False),
):
    """Get system-wide health status."""
    obs = get_observability_service()
    health = obs.get_health(
        es_connected=es_connected,
        broker_connected=broker_connected,
    )
    return health.to_dict()


@router.get("/metrics")
async def get_metrics(
    name: Optional[str] = Query(default=None),
    limit: int = Query(default=100),
):
    """Get recorded metrics."""
    obs = get_observability_service()
    metrics = obs.get_metrics(name=name, limit=limit)
    return {"metrics": [m.to_dict() for m in metrics]}


@router.post("/metrics/counter")
async def increment_counter(name: str, value: float = 1.0):
    """Increment a counter metric."""
    obs = get_observability_service()
    obs.inc_counter(name, value)
    return {"ok": True, "name": name, "value": obs.get_counter(name)}


@router.post("/metrics/gauge")
async def set_gauge(name: str, value: float):
    """Set a gauge metric."""
    obs = get_observability_service()
    obs.set_gauge(name, value)
    return {"ok": True, "name": name, "value": value}


@router.post("/queries/track")
async def track_query(req: TrackQueryRequest):
    """Track a query performance record."""
    obs = get_observability_service()
    qp = obs.track_query(
        req.index_or_table, req.operation, req.duration_ms,
        req.doc_count, req.success, req.error,
    )
    return qp.to_dict()


@router.get("/queries/stats")
async def query_stats(lookback_minutes: int = Query(default=60)):
    """Get query performance statistics."""
    obs = get_observability_service()
    stats = obs.get_query_stats(lookback_minutes)
    return stats


@router.post("/alerts")
async def raise_alert(req: RaiseAlertRequest):
    """Raise an alert."""
    obs = get_observability_service()
    try:
        severity = AlertSeverity(req.severity)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid severity: {req.severity}")

    alert = obs.raise_alert(severity, req.title, req.message, req.source)
    return alert.to_dict()


@router.get("/alerts")
async def list_alerts(
    acknowledged: Optional[bool] = Query(default=None),
    limit: int = Query(default=50),
):
    """List alerts."""
    obs = get_observability_service()
    alerts = obs.get_alerts(acknowledged=acknowledged, limit=limit)
    return {"alerts": [a.to_dict() for a in alerts]}


@router.post("/alerts/{alert_id}/ack")
async def ack_alert(alert_id: str):
    """Acknowledge an alert."""
    obs = get_observability_service()
    ok = obs.ack_alert(alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return {"ok": True, "alert_id": alert_id}


@router.post("/ilm/register")
async def register_ilm(req: RegisterILMRequest):
    """Register an ILM policy."""
    obs = get_observability_service()
    policy = ILMPolicy(
        policy_name=req.policy_name,
        hot_max_age=req.hot_max_age,
        hot_max_size=req.hot_max_size,
        warm_min_age=req.warm_min_age,
        delete_min_age=req.delete_min_age,
    )
    obs.register_ilm_policy(policy)
    return policy.to_dict()


@router.get("/ilm")
async def get_ilm_status():
    """Get ILM policy status."""
    obs = get_observability_service()
    return obs.get_ilm_status()
