"""
Incident Replay - Replays captured incidents deterministically.
"""
import hashlib
import json
from typing import Optional, Callable, List
from datetime import datetime


class ReplayRunner:
    """
    Replays an incident bundle to reproduce exact behavior.
    Used for debugging strategy issues.
    """
    
    def __init__(self):
        self._replay_handlers: dict = {}
    
    def register_handler(self, event_type: str, handler: Callable):
        """Register a handler for an event type during replay."""
        self._replay_handlers[event_type] = handler
    
    def replay(self, bundle: dict, speed: float = 1.0) -> dict:
        """
        Replay an incident bundle.
        Returns replay results including output hash for comparison.
        """
        events = bundle.get("events", [])
        outputs = []
        errors = []
        
        for event in events:
            event_type = event.get("type")
            event_data = event.get("data", {})
            
            handler = self._replay_handlers.get(event_type)
            if handler:
                try:
                    result = handler(event_data)
                    outputs.append({
                        "timestamp": event.get("timestamp"),
                        "type": event_type,
                        "result": result
                    })
                except Exception as e:
                    errors.append({
                        "timestamp": event.get("timestamp"),
                        "type": event_type,
                        "error": str(e)
                    })
            else:
                # No handler, just record the event
                outputs.append({
                    "timestamp": event.get("timestamp"),
                    "type": event_type,
                    "result": "passthrough"
                })
        
        # Compute output hash
        output_str = json.dumps(outputs, sort_keys=True, default=str)
        output_hash = hashlib.sha256(output_str.encode()).hexdigest()
        
        return {
            "incident_id": bundle.get("incident_id"),
            "replayed_at": datetime.utcnow().isoformat(),
            "events_replayed": len(events),
            "outputs": outputs,
            "errors": errors,
            "output_hash": output_hash,
            "input_hash": bundle.get("content_hash"),
            "hashes_match": output_hash == bundle.get("content_hash")  # For determinism check
        }
    
    def compare_replays(self, replay1: dict, replay2: dict) -> dict:
        """Compare two replay results for determinism."""
        return {
            "replay1_hash": replay1.get("output_hash"),
            "replay2_hash": replay2.get("output_hash"),
            "deterministic": replay1.get("output_hash") == replay2.get("output_hash"),
            "events_diff": abs(len(replay1.get("outputs", [])) - len(replay2.get("outputs", [])))
        }


# Singleton
_replay_runner: Optional[ReplayRunner] = None

def get_replay_runner() -> ReplayRunner:
    global _replay_runner
    if _replay_runner is None:
        _replay_runner = ReplayRunner()
    return _replay_runner
