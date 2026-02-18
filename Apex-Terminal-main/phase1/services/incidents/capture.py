"""
Incident Capture - Captures input streams for replay and debugging.
"""
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import deque
import uuid


@dataclass
class IncidentBundle:
    """A captured incident with all input data for replay."""
    incident_id: str
    run_id: str
    strategy_id: str
    captured_at: str
    duration_seconds: float
    events: List[dict]  # Bars, ticks, signals
    metadata: dict
    content_hash: str
    

class IncidentCapture:
    """
    Captures input streams during strategy execution for later replay.
    Used for debugging and incident investigation.
    """
    
    def __init__(self, max_events: int = 10000):
        self.max_events = max_events
        self._active_captures: Dict[str, dict] = {}
        self._stored_incidents: Dict[str, IncidentBundle] = {}
    
    def start_capture(self, run_id: str, strategy_id: str) -> str:
        """Start capturing events for a run."""
        capture_id = str(uuid.uuid4())[:8]
        
        self._active_captures[run_id] = {
            "capture_id": capture_id,
            "strategy_id": strategy_id,
            "started_at": datetime.utcnow(),
            "events": deque(maxlen=self.max_events),
            "metadata": {}
        }
        
        return capture_id
    
    def record_event(self, run_id: str, event_type: str, data: dict):
        """Record an event during capture."""
        if run_id not in self._active_captures:
            return
        
        capture = self._active_captures[run_id]
        capture["events"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "type": event_type,
            "data": data
        })
    
    def record_bar(self, run_id: str, bar: dict):
        """Record a bar event."""
        self.record_event(run_id, "bar", bar)
    
    def record_signal(self, run_id: str, signal: dict):
        """Record a strategy signal."""
        self.record_event(run_id, "signal", signal)
    
    def record_order(self, run_id: str, order: dict):
        """Record an order event."""
        self.record_event(run_id, "order", order)
    
    def record_error(self, run_id: str, error: str, context: dict = None):
        """Record an error event."""
        self.record_event(run_id, "error", {"error": error, "context": context or {}})
    
    def stop_capture(self, run_id: str) -> Optional[str]:
        """
        Stop capturing and create an incident bundle.
        Returns the incident_id.
        """
        if run_id not in self._active_captures:
            return None
        
        capture = self._active_captures.pop(run_id)
        
        events = list(capture["events"])
        started_at = capture["started_at"]
        duration = (datetime.utcnow() - started_at).total_seconds()
        
        # Compute content hash for integrity
        content_str = json.dumps(events, sort_keys=True, default=str)
        content_hash = hashlib.sha256(content_str.encode()).hexdigest()
        
        incident_id = capture["capture_id"]
        
        bundle = IncidentBundle(
            incident_id=incident_id,
            run_id=run_id,
            strategy_id=capture["strategy_id"],
            captured_at=started_at.isoformat(),
            duration_seconds=duration,
            events=events,
            metadata=capture["metadata"],
            content_hash=content_hash
        )
        
        self._stored_incidents[incident_id] = bundle
        return incident_id
    
    def get_incident(self, incident_id: str) -> Optional[IncidentBundle]:
        """Get a stored incident bundle."""
        return self._stored_incidents.get(incident_id)
    
    def list_incidents(self) -> List[dict]:
        """List all stored incidents (summary only)."""
        return [
            {
                "incident_id": inc.incident_id,
                "run_id": inc.run_id,
                "strategy_id": inc.strategy_id,
                "captured_at": inc.captured_at,
                "duration_seconds": inc.duration_seconds,
                "event_count": len(inc.events),
                "content_hash": inc.content_hash
            }
            for inc in self._stored_incidents.values()
        ]
    
    def export_bundle(self, incident_id: str) -> Optional[dict]:
        """Export an incident bundle as JSON-serializable dict."""
        incident = self._stored_incidents.get(incident_id)
        if not incident:
            return None
        
        return {
            "incident_id": incident.incident_id,
            "run_id": incident.run_id,
            "strategy_id": incident.strategy_id,
            "captured_at": incident.captured_at,
            "duration_seconds": incident.duration_seconds,
            "events": incident.events,
            "metadata": incident.metadata,
            "content_hash": incident.content_hash
        }


# Singleton
_capture: Optional[IncidentCapture] = None

def get_incident_capture() -> IncidentCapture:
    global _capture
    if _capture is None:
        _capture = IncidentCapture()
    return _capture
