"""Helpers for JSON-safe API payloads (NaN/Inf → None)."""

from __future__ import annotations

import math
from typing import Any


def json_safe(value: Any) -> Any:
    """Recursively replace non-finite floats so stdlib json / FastAPI can serialize."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    return value
