"""
Authentic data mode configuration for the backend API.

Environment variables:
    DATA_MODE       : 'recorded' | 'live'  (default: 'recorded')
    BROKER_MODE     : 'paper'    | 'live'  (default: 'paper')
    RECORDING_SET   : str                  (default: 'core-default')

Legacy env vars:
    E2E_MODE        : if set, treated as DATA_MODE=recorded (backward compat)
"""
import json
import os
from pathlib import Path

# ── Runtime mode ──────────────────────────────────────────────────────────────
_raw_data_mode = os.environ.get("DATA_MODE", "")
if not _raw_data_mode and os.environ.get("E2E_MODE"):
    _raw_data_mode = "recorded"   # backward-compat shim

DATA_MODE: str  = _raw_data_mode if _raw_data_mode in ("recorded", "live") else "recorded"
BROKER_MODE: str = os.environ.get("BROKER_MODE", "paper")
RECORDING_SET: str = os.environ.get("RECORDING_SET", "core-default")

# ── Recording anchor timestamp ─────────────────────────────────────────────────
# Matches data/recordings/core-default/manifest.json → date_range.start
RECORDING_TS = "2024-01-02T09:30:00Z"

# ── Recording directory ────────────────────────────────────────────────────────
_HERE = Path(__file__).resolve()
# Walk up to workspace root (containing data/recordings/)
_WORKSPACE_ROOT = _HERE
for _ in range(8):
    if (_WORKSPACE_ROOT / "data" / "recordings").exists():
        break
    _WORKSPACE_ROOT = _WORKSPACE_ROOT.parent

RECORDINGS_ROOT = _WORKSPACE_ROOT / "data" / "recordings"
RECORDING_DIR   = RECORDINGS_ROOT / RECORDING_SET


def load_manifest() -> dict:
    """Load and return the recording set manifest.json."""
    path = RECORDING_DIR / "manifest.json"
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def is_recorded_mode() -> bool:
    return DATA_MODE == "recorded"


def is_live_mode() -> bool:
    return DATA_MODE == "live"


def is_paper_broker() -> bool:
    return BROKER_MODE == "paper"


__all__ = [
    "DATA_MODE",
    "BROKER_MODE",
    "RECORDING_SET",
    "RECORDING_TS",
    "RECORDINGS_ROOT",
    "RECORDING_DIR",
    "load_manifest",
    "is_recorded_mode",
    "is_live_mode",
    "is_paper_broker",
]
