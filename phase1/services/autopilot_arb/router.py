"""Vendor autopilot pipeline routes — arb, intelligence, audit, agents, L0–L4 status."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, HTTPException, WebSocket, WebSocketDisconnect

from . import runtime

logger = logging.getLogger(__name__)

router = APIRouter(tags=["autopilot-pipeline"])

_INTEL_REPORT_DIR = Path("data/intelligence_reports").resolve()
_INTEL_REPORT_DIR.mkdir(parents=True, exist_ok=True)
_INTEL_TICKER_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def _require_runtime() -> None:
    if not runtime.init_runtime():
        raise HTTPException(status_code=503, detail="Vendor autopilot runtime unavailable")


@router.get("/api/autopilot/pipeline/status")
def pipeline_status() -> dict[str, Any]:
    """Unified L0–L4 pipeline health for the Apex UI."""
    _require_runtime()
    store = runtime.store
    settings = runtime.settings

    arbs = store.list_arb_opportunities(limit=200)
    events = store.list_audit_events(limit=20)
    loops = {
        "arb_scan_loop": os.getenv("APEX_ARB_SCAN_LOOP", "true").lower() in ("1", "true", "yes"),
        "arb_scan_seq": runtime.arb_scan_seq,
    }

    layers = {
        "L0_ingestion": {
            "status": "ok",
            "detail": "Kalshi/Polymarket scan + market data ingestion",
        },
        "L1_brain": {
            "status": "ok" if settings.demo_mode or arbs else "idle",
            "detail": f"{len(arbs)} scored opportunities",
        },
        "L2_agents": {
            "status": "ok",
            "detail": "Arb analyst panel + agent missions available",
        },
        "L3_execution": {
            "status": "ok" if settings.alpaca_paper_trade else "warn",
            "detail": "Paper-only execution + 14-check risk gates",
        },
        "L4_observability": {
            "status": "ok",
            "detail": f"{len(events)} recent audit events",
        },
    }

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "demo_mode": settings.demo_mode,
        "paper_only": bool(settings.alpaca_paper_trade),
        "sqlite_path": str(settings.sqlite_path),
        "active_arbs": len(arbs),
        "max_net_edge": max((float(o.get("net_edge") or 0) for o in arbs), default=0),
        "loops": loops,
        "layers": layers,
        "tcc": {
            "pipeline": "/api/v1/pipeline",
            "orchestration": "/api/v1/orchestration",
            "handshake": "/api/v1/handshake/autopilot",
        },
        "phase1_autopilot": "/api/v1/autopilot",
    }


@router.get("/api/demo/status")
def demo_status() -> dict[str, Any]:
    _require_runtime()
    return {
        "demo_mode": runtime.settings.demo_mode,
        "paper_only": bool(runtime.settings.alpaca_paper_trade),
        "arb_opportunities": len(runtime.store.list_arb_opportunities(limit=50)),
    }


@router.get("/api/arb/opportunities")
def list_arb_opportunities(limit: int = 200) -> list[dict]:
    _require_runtime()
    from apex.ml.arb_edge_model import apply_model_scores

    rows = runtime.store.list_arb_opportunities(limit=limit)
    return apply_model_scores(rows)


@router.get("/api/arb/summary")
def arb_summary() -> dict[str, Any]:
    _require_runtime()
    store = runtime.store
    active = store.list_arb_opportunities(limit=1000)
    resolved = store.get_resolved_arb_opportunities(limit=1000)
    wins = len([o for o in resolved if (o.get("pnl") or 0) > 0])
    total = len(resolved)
    return {
        "active_opportunities": len(active),
        "resolved_opportunities": total,
        "win_rate": (wins / total) if total > 0 else 0.0,
    }


@router.post("/api/arb/scan")
async def trigger_arb_scan() -> dict[str, Any]:
    _require_runtime()
    from apex.services.arb_scan import scan_and_persist

    scan_timeout = float(os.getenv("ARB_SCAN_TIMEOUT_SEC", "90"))
    try:
        opps = await asyncio.wait_for(
            asyncio.to_thread(scan_and_persist, runtime.store, limit=50, ingest_l2=True),
            timeout=scan_timeout,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Arb scan timed out") from None
    runtime.arb_scan_seq += 1
    return {"status": "ok", "count": len(opps), "seq": runtime.arb_scan_seq}


@router.get("/api/arb/backtest")
def arb_backtest(lookback_days: int = 90) -> dict[str, Any]:
    _require_runtime()
    from dataclasses import asdict

    from apex.services.backtest_engine import BacktestEngine

    engine = BacktestEngine(settings=runtime.settings, store=runtime.store)
    return asdict(engine.run(lookback_days=lookback_days))


@router.get("/api/arb/metrics")
def arb_scan_metrics() -> dict[str, Any]:
    _require_runtime()
    from apex.observability import scan_metrics

    return scan_metrics.snapshot()


@router.get("/events")
@router.get("/api/events")
def list_events(limit: int = 100) -> list[dict]:
    _require_runtime()
    return runtime.store.list_audit_events(limit=limit)


@router.get("/api/intelligence/report/{ticker}")
def intelligence_report(ticker: str) -> dict[str, Any]:
    _require_runtime()
    if not _INTEL_TICKER_RE.match(ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker format")
    matches = sorted(_INTEL_REPORT_DIR.glob(f"{ticker}_*.json"), reverse=True)
    if not matches:
        raise HTTPException(status_code=404, detail="No report found for ticker")
    return json.loads(matches[0].read_text(encoding="utf-8"))


@router.get("/api/risk/metrics")
def risk_metrics() -> dict[str, Any]:
    _require_runtime()
    from apex.risk.metrics_service import build_risk_metrics

    arbs = runtime.store.list_arb_opportunities(limit=100)
    return build_risk_metrics(
        account_equity=100_000.0,
        positions=[],
        arb_opportunities=arbs,
        kelly_alpha=float(getattr(runtime.settings, "kelly_alpha", 0.25)),
        kelly_lambda=float(getattr(runtime.settings, "kelly_lambda", 0.02)),
    )


@router.get("/api/pm/agents/status")
def pm_agents_status() -> dict[str, Any]:
    _require_runtime()
    from apex.services.pm_trading import pm_agents_status as _status

    return _status(runtime.store)


@router.post("/api/pm/agents/run")
async def run_pm_agents() -> dict[str, Any]:
    _require_runtime()
    from apex.main import build_engine
    from apex.services.pm_trading import run_prediction_markets_agent_cycle

    timeout = float(os.getenv("PM_AGENT_CYCLE_TIMEOUT_SEC", "120"))
    engine = await asyncio.to_thread(build_engine)
    try:
        return await asyncio.wait_for(
            run_prediction_markets_agent_cycle(engine, fast_scan=True),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="PM agent cycle timed out") from None


@router.get("/api/brain/status")
def brain_status(probe: bool = False) -> dict[str, Any]:
    _require_runtime()
    from apex.brain import get_brain

    return get_brain(runtime.settings, refresh=True).status(probe=probe)


@router.websocket("/api/arb/stream")
async def stream_arb_updates(websocket: WebSocket) -> None:
    _require_runtime()
    await websocket.accept()
    settings = runtime.settings
    store = runtime.store
    poll_sec = float(os.getenv("ARB_STREAM_POLL_SEC", "2"))
    use_patches = os.getenv("ARB_STREAM_USE_PATCHES", "true").lower() in ("1", "true", "yes")

    from apex.services.arb_row_utils import normalize_arb_row, normalize_arb_rows
    from apex.streaming.arb_patch_stream import ArbPatchStream

    def fetch_rows() -> list[dict]:
        from dataclasses import asdict

        rows = normalize_arb_rows(store.read_table("arb_opportunities", limit=200))
        if settings.demo_mode:
            try:
                from apex.services.arb_engine import ArbEngine

                engine = ArbEngine(settings=settings, store=store)
                live = [normalize_arb_row(asdict(o)) for o in engine.scan()]
                if live:
                    return sorted(live, key=lambda r: -(r.get("net_edge") or 0))
            except Exception as exc:
                logger.debug("demo arb scan fallback: %s", exc)
        from apex.ml.arb_edge_model import apply_model_scores

        return apply_model_scores(rows)

    def status_payload(rows: list[dict]) -> dict:
        edges = [float(o.get("net_edge") or 0) for o in rows]
        return {
            "type": "status",
            "polling_rate_sec": poll_sec,
            "max_edge": max(edges) if edges else 0,
            "count": len(rows),
            "patch_mode": use_patches,
            "demo_mode": settings.demo_mode,
        }

    patch_stream = ArbPatchStream()
    last_max_edge = -1.0
    tick = 0
    try:
        while True:
            opportunities = await asyncio.to_thread(fetch_rows)
            force_full = tick == 0
            if use_patches:
                msg = patch_stream.build_message(opportunities, force_full=force_full)
                if msg.get("type") != "heartbeat":
                    await websocket.send_json(msg)
            else:
                await websocket.send_json({"type": "sync", "opportunities": opportunities})
            edges = [float(o.get("net_edge") or 0) for o in opportunities]
            max_edge = max(edges) if edges else 0
            tick += 1
            if tick == 1 or max_edge != last_max_edge or tick % 5 == 0:
                await websocket.send_json(status_payload(opportunities))
                last_max_edge = max_edge
            await asyncio.sleep(poll_sec)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        logger.error("arb stream error: %s", exc)
        await websocket.close()


@router.post("/api/arb/{arb_id}/paper-trade")
async def paper_trade_arb(arb_id: str) -> dict[str, Any]:
    _require_runtime()
    from apex.domain.enums import EventType
    from apex.domain.models import ArbOpportunity, AuditEvent

    store = runtime.store
    settings = runtime.settings
    opp_dict = store.get_arb_opportunity(arb_id)
    if not opp_dict:
        raise HTTPException(status_code=404, detail="Arb opportunity not found")

    opp = ArbOpportunity(**{k: v for k, v in opp_dict.items() if k != "settlement_flags"})
    opp.settlement_flags = json.loads(opp_dict.get("settlement_flags", "[]"))

    if settings.demo_mode or arb_id == "demo-reject-demo":
        if arb_id == "demo-reject-demo" or (opp.net_edge or 0) < 0.01:
            raise HTTPException(status_code=400, detail="Risk failed: M07 (demo)")
        kid = f"demo-kalshi-{arb_id[:8]}"
        pid = f"demo-poly-{arb_id[:8]}"
        store.append_event(
            AuditEvent(
                event_type=EventType.ARB_PAPER_SUBMITTED,
                symbol=opp.kalshi_ticker,
                order_id=kid,
                raw_payload={"kalshi_order_id": kid, "poly_order_id": pid, "demo_mode": True},
            )
        )
        return {"status": "ok", "kalshi_order_id": kid, "poly_order_id": pid, "demo_mode": True}

    from apex.main import build_engine

    engine = build_engine()
    kalshi_id, poly_id = await engine.execution.submit_arb_paper_orders(opp, stake_usd=50.0)
    if not kalshi_id:
        raise HTTPException(status_code=400, detail="Paper trade rejected by risk checks")
    return {"status": "ok", "kalshi_order_id": kalshi_id, "poly_order_id": poly_id}
