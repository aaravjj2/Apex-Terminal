"""
Mount complete autopilot-public pipeline into the unified Apex API.

Covers L0–L4: ingestion/scan, brain scoring, agent panel, execution gates, audit.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI

from .router import router

logger = logging.getLogger(__name__)


def mount_autopilot_arb_routes(app: FastAPI) -> bool:
    """Register vendor autopilot pipeline routes + agent gateway."""
    from . import runtime

    if not runtime.init_runtime():
        return False

    app.include_router(router)

    try:
        runtime.ensure_vendor_paths()
        from agent.gateway import router as agent_router

        app.include_router(agent_router)
        logger.info("Agent gateway mounted at /api/agent")
    except ImportError as exc:
        logger.warning("Agent gateway not mounted: %s", exc)

    logger.info("Autopilot pipeline routes mounted (sqlite=%s)", runtime.settings.sqlite_path)
    return True
