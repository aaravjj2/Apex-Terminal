"""Background loops for vendor autopilot pipeline (arb scan, demo seed)."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

from . import runtime

logger = logging.getLogger(__name__)


async def _arb_scan_loop() -> None:
    from apex.services.arb_scan import scan_and_persist

    os.environ.setdefault("ARB_SCAN_INGEST_L2", "1")
    interval = float(os.getenv("ARB_SCAN_INTERVAL_SEC", str(runtime.settings.arb_scan_interval_sec)))
    scan_timeout = float(os.getenv("ARB_SCAN_TIMEOUT_SEC", "90"))
    while True:
        try:
            await asyncio.wait_for(
                asyncio.to_thread(scan_and_persist, runtime.store, limit=50, ingest_l2=True),
                timeout=scan_timeout,
            )
            runtime.arb_scan_seq += 1
            logger.debug("arb_scan_complete seq=%s", runtime.arb_scan_seq)
        except asyncio.TimeoutError:
            logger.warning("arb_scan_loop timed out")
        except Exception as exc:
            logger.warning("arb_scan_loop error: %s", exc)
        await asyncio.sleep(interval)


async def start_vendor_autopilot() -> None:
    """Seed demo data and start optional background loops."""
    if not runtime.init_runtime():
        return

    if runtime.settings.demo_mode:
        try:
            from apex.demo.seed_data import seed_demo_database

            await asyncio.to_thread(seed_demo_database, runtime.store)
            logger.info("DEMO_MODE: vendor sqlite seeded")
        except Exception as exc:
            logger.warning("demo seed skipped: %s", exc)

    if os.getenv("APEX_ARB_SCAN_LOOP", "true").lower() in ("1", "true", "yes"):
        task = asyncio.create_task(_arb_scan_loop())
        runtime.background_tasks.append(task)
        logger.info("arb_scan_loop started")


async def stop_vendor_autopilot() -> None:
    for task in runtime.background_tasks:
        task.cancel()
    runtime.background_tasks.clear()
