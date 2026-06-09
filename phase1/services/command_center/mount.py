"""
Mount TCC (Trading Command Center) FastAPI routers into the unified Apex API.

FinceptTerminal/backend remains the source of truth for pipeline/orchestration code;
phase1 adds sys.path and includes routers without merging codebases.

Import isolation: TCC uses top-level packages (`services`, `audit`, `routers`, …)
that collide with phase1's `services` package. We temporarily shadow those names
while loading TCC routers, then restore phase1 modules so both stacks coexist.
"""

from __future__ import annotations

import logging
import sys
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType
from typing import Iterator

from fastapi import FastAPI

logger = logging.getLogger(__name__)

_TCC_BACKEND = Path(__file__).resolve().parents[3] / "FinceptTerminal" / "backend"

# Top-level TCC modules that may collide with phase1 or Python stdlib shadows.
_TCC_TOP_LEVEL = frozenset(
    {
        "services",
        "routers",
        "audit",
        "schemas",
        "risk_gates",
        "brokers",
        "mcp_client",
        "timeout",
    }
)


@contextmanager
def _tcc_import_context() -> Iterator[None]:
    """Make FinceptTerminal/backend win for TCC package names during router import."""
    backend_path = str(_TCC_BACKEND)
    if backend_path in sys.path:
        sys.path.remove(backend_path)
    sys.path.insert(0, backend_path)

    saved: dict[str, ModuleType] = {}
    for name in list(sys.modules):
        if name in _TCC_TOP_LEVEL or any(
            name.startswith(f"{prefix}.") for prefix in _TCC_TOP_LEVEL
        ):
            saved[name] = sys.modules.pop(name)

    try:
        yield
    finally:
        # Drop TCC copies of shadowed names, restore phase1 modules.
        for name in list(sys.modules):
            if name in _TCC_TOP_LEVEL or any(
                name.startswith(f"{prefix}.") for prefix in _TCC_TOP_LEVEL
            ):
                if name not in saved:
                    sys.modules.pop(name, None)
        sys.modules.update(saved)
        if backend_path in sys.path:
            sys.path.remove(backend_path)


def mount_command_center_routers(app: FastAPI) -> bool:
    """
    Include TCC routers: /api/v1/pipeline, /api/v1/orchestration, /api/v1/audit.

    Returns True if mounted, False if FinceptTerminal backend is unavailable.
    """
    if not _TCC_BACKEND.is_dir():
        logger.warning("TCC backend not found at %s — skipping command center mount", _TCC_BACKEND)
        return False

    try:
        with _tcc_import_context():
            from routers.audit import router as audit_router
            from routers.orchestration import router as orchestration_router
            from routers.pipeline import router as pipeline_router
            from services.autopilot_handshake import router as handshake_router
    except ImportError as exc:
        logger.warning("TCC router import failed: %s", exc)
        return False

    app.include_router(pipeline_router)
    app.include_router(orchestration_router)
    app.include_router(audit_router)
    app.include_router(handshake_router)
    logger.info("Trading Command Center routers mounted from %s", _TCC_BACKEND)
    return True
