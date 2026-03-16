"""
Apex Agents Orchestrator
========================
Runs as a long-lived daemon, polling the unified_engine on each interval.
Designed to be started by systemd (Linux) or launchd (macOS).

Quick start:
    python orchestrator.py                     # default 60s interval
    APEX_POLL_INTERVAL=30 python orchestrator.py

The orchestrator:
  1. Calls unified_engine.run_cycle() on every tick.
  2. Emits heartbeat logs so systemd watchdog / monitoring can track liveness.
  3. Handles SIGTERM gracefully (finishing the current cycle before exit).
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Allow `python orchestrator.py` from this directory without installing the package
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("apex.orchestrator")


# ── Config ────────────────────────────────────────────────────────────────────
POLL_INTERVAL: int = int(os.environ.get("APEX_POLL_INTERVAL", "60"))
DRY_RUN:       bool = os.environ.get("APEX_DRY_RUN", "0") == "1"

# ── Shutdown flag ─────────────────────────────────────────────────────────────
_STOP = asyncio.Event()


def _handle_signal(sig: int, _frame: object) -> None:
    name = signal.Signals(sig).name
    logger.info("Received signal %s — draining current cycle then stopping", name)
    _STOP.set()


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT,  _handle_signal)


# ── Agent health summaries ─────────────────────────────────────────────────────
def _agent_health_check() -> dict:
    """Quick import-check of all agents; returns {"ok": bool, "agents": [...]}."""
    agents = []
    ok     = True
    for name, mod in [
        ("pre_trade_validator", "apex_agents.agents.pre_trade_validator"),
        ("strategy_arbiter",    "apex_agents.agents.strategy_arbiter"),
        ("bar_guard",           "apex_agents.agents.bar_guard"),
    ]:
        try:
            __import__(mod)
            agents.append({"name": name, "status": "ok"})
        except Exception as exc:
            agents.append({"name": name, "status": f"error: {exc}"})
            ok = False
    return {"ok": ok, "agents": agents}


# ── Main loop ─────────────────────────────────────────────────────────────────
async def run_forever() -> None:
    logger.info(
        "Apex Agents Orchestrator starting  interval=%ds  dry_run=%s",
        POLL_INTERVAL, DRY_RUN,
    )

    # Verify agent health before entering loop
    health = _agent_health_check()
    if not health["ok"]:
        logger.warning("One or more agents failed health check: %s", health["agents"])
    else:
        logger.info("Agent health OK: %s", [a["name"] for a in health["agents"]])

    # Lazy-import engine to avoid heavy startup cost during import
    try:
        from phase1.services.autopilot.unified_engine import get_unified_engine
        engine = get_unified_engine()
        logger.info("UnifiedAutopilotEngine loaded")
    except Exception as exc:
        logger.error("Could not load UnifiedAutopilotEngine: %s — exiting", exc)
        return

    cycle_count = 0

    while not _STOP.is_set():
        cycle_start = time.monotonic()
        cycle_count += 1
        ts = datetime.now(timezone.utc).isoformat(timespec="seconds")

        logger.info("── cycle #%d  %s ──────────────────────", cycle_count, ts)
        try:
            result = engine.run_cycle(dry_run=DRY_RUN)
            status = getattr(result, "status", "unknown") if result else "no_result"
            logger.info("cycle #%d complete  status=%s  elapsed=%.1fs",
                        cycle_count, status, time.monotonic() - cycle_start)
        except Exception as exc:
            logger.exception("cycle #%d raised an exception: %s", cycle_count, exc)

        # Wait for next tick (or early exit on SIGTERM)
        try:
            await asyncio.wait_for(_STOP.wait(), timeout=POLL_INTERVAL)
        except asyncio.TimeoutError:
            pass   # normal path: timeout fires → next cycle

    logger.info("Orchestrator stopped after %d cycles", cycle_count)


if __name__ == "__main__":
    asyncio.run(run_forever())
