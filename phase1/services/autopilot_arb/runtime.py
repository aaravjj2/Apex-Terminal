"""Shared vendor autopilot runtime state for phase1 mount."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_VENDOR_ROOT = Path(__file__).resolve().parents[3] / "vendor" / "autopilot-public"
_VENDOR_SRC = _VENDOR_ROOT / "src"
_VENDOR_AGENT = _VENDOR_ROOT / "agent"

_initialized = False
settings: Any = None
store: Any = None
arb_scan_seq = 0
background_tasks: list[Any] = []


def ensure_vendor_paths() -> bool:
    if not _VENDOR_SRC.is_dir():
        logger.warning("autopilot-public vendor src not found at %s", _VENDOR_SRC)
        return False
    for path in (str(_VENDOR_SRC), str(_VENDOR_AGENT), str(_VENDOR_ROOT)):
        if path not in sys.path:
            sys.path.insert(0, path)
    return True


def init_runtime() -> bool:
    global _initialized, settings, store
    if _initialized:
        return True
    if not ensure_vendor_paths():
        return False
    try:
        from apex.core.config import get_settings
        from apex.repositories.sqlite_store import SQLiteStore

        settings = get_settings()
        store = SQLiteStore(settings.sqlite_path)
        _initialized = True
        logger.info("vendor autopilot runtime ready (sqlite=%s)", settings.sqlite_path)
        return True
    except ImportError as exc:
        logger.warning("vendor autopilot runtime import failed: %s", exc)
        return False
