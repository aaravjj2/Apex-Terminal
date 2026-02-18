"""
Incidents API Routes - Capture and replay endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.incidents import get_incident_capture, get_replay_runner

router = APIRouter(tags=["Incidents"])


class IncidentSummary(BaseModel):
    incident_id: str
    run_id: str
    strategy_id: str
    captured_at: str
    duration_seconds: float
    event_count: int
    content_hash: str


class CaptureStart(BaseModel):
    run_id: str
    strategy_id: str


@router.get("/incidents", response_model=List[IncidentSummary])
async def list_incidents():
    """List all captured incidents."""
    capture = get_incident_capture()
    return capture.list_incidents()


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Get full incident bundle."""
    capture = get_incident_capture()
    bundle = capture.export_bundle(incident_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Incident not found")
    return bundle


@router.post("/incidents/start")
async def start_capture(data: CaptureStart):
    """Start capturing events for a run."""
    capture = get_incident_capture()
    capture_id = capture.start_capture(data.run_id, data.strategy_id)
    return {"capture_id": capture_id, "message": "Capture started"}


@router.post("/incidents/{run_id}/stop")
async def stop_capture(run_id: str):
    """Stop capturing and create incident bundle."""
    capture = get_incident_capture()
    incident_id = capture.stop_capture(run_id)
    if not incident_id:
        raise HTTPException(status_code=404, detail="No active capture for this run")
    return {"incident_id": incident_id, "message": "Capture stopped, incident created"}


@router.post("/incidents/{incident_id}/replay")
async def replay_incident(incident_id: str):
    """Replay an incident bundle."""
    capture = get_incident_capture()
    bundle = capture.export_bundle(incident_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    runner = get_replay_runner()
    result = runner.replay(bundle)
    return result


@router.get("/incidents/{incident_id}/export")
async def export_incident(incident_id: str):
    """Export incident bundle as downloadable JSON."""
    capture = get_incident_capture()
    bundle = capture.export_bundle(incident_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Incident not found")
    return bundle


# ============================================================================
# OPERATIONAL INCIDENTS (System Alerts)
# ============================================================================

from ...autopilot.repository import get_autopilot_repository

@router.get("/alerts")
async def list_alerts(unresolved_only: bool = False, limit: int = 100):
    """List system/operational incidents (alerts)."""
    repo = get_autopilot_repository()
    incidents = repo.list_incidents(unresolved_only=unresolved_only, limit=limit)
    return [
        {
            "id": i.id,
            "severity": i.severity,
            "category": i.category,
            "title": i.title,
            "description": i.description,
            "run_id": i.run_id,
            "created_at": i.created_at.isoformat(),
            "resolved": i.resolved,
            "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
            "resolution_note": i.resolution_note
        }
        for i in incidents
    ]

@router.post("/alerts/{incident_id}/resolve")
async def resolve_alert(incident_id: str, note: Optional[str] = None):
    """Resolve a system incident."""
    repo = get_autopilot_repository()
    incident = repo.resolve_incident(incident_id, note=note)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"status": "resolved", "resolved_at": incident.resolved_at.isoformat()}
