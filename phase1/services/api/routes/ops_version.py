"""
Phase A — Version Fingerprint Endpoint
GET /api/ops/version  → git_sha, build_time, api_version, active_port
"""
from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/api/ops", tags=["ops-version"])


def _git_sha() -> str:
    """Return short git SHA. Falls back to env or 'unknown'."""
    sha = os.environ.get("GIT_SHA")
    if sha:
        return sha[:12]
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short=12", "HEAD"],
            capture_output=True, text=True, timeout=5,
            cwd=os.path.dirname(os.path.abspath(__file__)),
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return "unknown"


_BUILD_TIME = os.environ.get("BUILD_TIME", datetime.now(timezone.utc).isoformat())
_CACHED_SHA: str | None = None


@router.get("/version")
async def ops_version():
    """Return build fingerprint for frontend/backend match verification."""
    global _CACHED_SHA
    if _CACHED_SHA is None:
        _CACHED_SHA = _git_sha()
    from ...config import get_settings
    settings = get_settings()
    return {
        "git_sha": _CACHED_SHA,
        "build_time": _BUILD_TIME,
        "api_version": "2.0.0",
        "active_port": settings.api_port,
    }
