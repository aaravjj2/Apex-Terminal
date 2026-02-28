import json
from autopilot_brain.brain_types import BrainState, Explain, PositionMeta
import pickle # Removed usage
from datetime import datetime
from dataclasses import asdict

class StateStore:
    def __init__(self, object_store):
        self.store = object_store
        self.key = "brain_state_v1.json" # JSON extension
        self.project_id = "p1" 
        
    def save(self, state: BrainState):
        try:
            # PHASE 1: JSON Persistence
            # dataclasses.asdict handles most nested types, 
            # but we need to ensure custom types are serializable if any.
            # BrainState is pure dataclass/primitives.
            data_dict = asdict(state)
            json_str = json.dumps(data_dict)
            self.store.SaveString(self.key, json_str)
        except Exception as e:
            # Log failure in real engine?
            pass

    def load(self):
        if self.store.ContainsKey(self.key):
            try:
                # QC ObjectStore ReadBytes -> decode -> json load
                data_bytes = self.store.ReadBytes(self.key)
                # In QC, ReadBytes returns C# byte[], pythonnet handles... 
                # simulation returns bytes.
                # If SaveString used, ReadBytes should work if bytes. 
                # Or use ReadString if exists (mock has it? no, mock has ReadBytes/SaveString parity issue to fix).
                # Safe path: bytes.
                if isinstance(data_bytes, str):
                    # Local mock parity
                    json_str = data_bytes
                else:
                    json_str = bytes(data_bytes).decode('utf-8')
                    
                data = json.loads(json_str)
                
                # Reconstruct dataclass
                # Handle nested dicts/types if necessary
                # position_meta is Dict[str, PositionMeta]
                pm_raw = data.get("position_meta", {})
                pm_typed = {}
                for k, v in pm_raw.items():
                    pm_typed[k] = PositionMeta(**v)
                
                return BrainState(
                    daily_trade_counter=data.get("daily_trade_counter", 0),
                    daily_scan_index=data.get("daily_scan_index", 0),
                    last_reset_date=data.get("last_reset_date", ""),
                    position_meta=pm_typed,
                    global_cooldown_until=data.get("global_cooldown_until")
                )
            except Exception as e:
                return None
        return None
        
    def write_tape_record(self, cycle_time: datetime, actions: list, explain: Explain, scan_index: int):
        """Append decision record to daily tape chunk."""
        date_str = cycle_time.strftime("%Y-%m-%d")
        # Collision-free key: scan-0001.json
        
        file_name = f"scan-{scan_index:04d}.json"
        key = f"tape/{date_str}/{file_name}"
        
        # Extended Schema
        record = {
            "run_id": self.project_id, # Const for now
            "scan_index": scan_index,
            "timestamp": cycle_time.isoformat(),
            "snapshot_ready": True, # Implicit if we reached here
            "candidate_count": explain.candidates_count,
            "actions": [a.__dict__ for a in actions],
            "rejections": explain.skip_reasons,
            "explain_details": explain.top_candidate_details
        }
        
        try:
            self.store.SaveString(key, json.dumps(record))
        except Exception:
            pass
        return key
