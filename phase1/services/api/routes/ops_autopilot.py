"""
Ops Autopilot Routes — Phase 0: Reality Audit Health Endpoints

GET /api/ops/autopilot/version   — engine version, git sha, schema version, feature flags
GET /api/ops/autopilot/health    — full dependency health tree
GET /api/ops/autopilot/cycle     — last completed cycle artifact (summary)
GET /api/ops/autopilot/disarm    — force-disable automation_enabled (safety)
POST /api/ops/autopilot/arm      — enable continuous automation
POST /api/ops/autopilot/run-now  — trigger an immediate sync cycle (force=True)

These endpoints are always reachable even when the market is closed.
correlation_id is echoed on every response for audit trail.
"""

import os
import uuid
import time
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ops/autopilot", tags=["ops-autopilot"])

# ── Versioning ────────────────────────────────────────────────────────────────

# Bump this when schema changes are made to run artifacts or engine interface
SCHEMA_VERSION = "2025.1.0"

# Feature flags (populated from env / feature registry)
FEATURE_FLAGS = {
    "quote_gateway_ws":     os.environ.get("FF_QUOTE_GATEWAY_WS", "0") == "1",
    "options_chain_live":   os.environ.get("FF_OPTIONS_CHAIN_LIVE", "0") == "1",
    "regime_classifier_v2": os.environ.get("FF_REGIME_CLASSIFIER_V2", "1") == "1",
    "es_cycle_indexing":    os.environ.get("FF_ES_CYCLE_INDEXING", "1") == "1",
    "position_agents":      os.environ.get("FF_POSITION_AGENTS", "1") == "1",
    "llm_tiebreak":         os.environ.get("FF_LLM_TIEBREAK", "0") == "1",
}


# ── Pydantic models ───────────────────────────────────────────────────────────

class VersionResponse(BaseModel):
    ok: bool
    correlation_id: str
    app_version: str
    schema_version: str
    git_sha: str
    python_version: str
    feature_flags: Dict[str, bool]
    timestamp: str
    autopilot_build: str


class HealthCheck(BaseModel):
    name: str
    status: str          # "ok" | "degraded" | "down" | "unknown"
    latency_ms: Optional[float] = None
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    ok: bool
    correlation_id: str
    timestamp: str
    overall_status: str  # "ok" | "degraded" | "critical"
    checks: List[HealthCheck]
    autopilot_state: Dict[str, Any]
    market_session: Dict[str, Any]


class CycleResponse(BaseModel):
    ok: bool
    correlation_id: str
    has_cycle: bool
    cycle: Optional[Dict[str, Any]] = None


class ArmResponse(BaseModel):
    ok: bool
    correlation_id: str
    automation_enabled: bool
    message: str


class RunNowResponse(BaseModel):
    ok: bool
    correlation_id: str
    run_id: Optional[str] = None
    message: str
    already_running: bool = False


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_cid(req_cid: Optional[str] = None) -> str:
    return req_cid or f"cid-{uuid.uuid4().hex[:12]}"


def _git_sha() -> str:
    """Attempt to read git SHA from .git/HEAD."""
    try:
        from pathlib import Path
        git_head = Path(__file__).parent.parent.parent.parent.parent / ".git" / "HEAD"
        if git_head.exists():
            ref = git_head.read_text().strip()
            if ref.startswith("ref:"):
                ref_path = Path(__file__).parent.parent.parent.parent.parent / ".git" / ref.split(" ", 1)[1].strip()
                if ref_path.exists():
                    return ref_path.read_text().strip()[:12]
            return ref[:12]
    except Exception:
        pass
    return "unknown"


async def _check_alpaca() -> HealthCheck:
    """Ping Alpaca trading API."""
    start = time.monotonic()
    try:
        from ...autopilot.alpaca_client import get_alpaca_client
        client = get_alpaca_client()
        if not client.is_configured:
            return HealthCheck(name="alpaca", status="down", detail="credentials_not_configured")
        ok, latency = await client.health_check()
        ms = (time.monotonic() - start) * 1000
        if ok:
            return HealthCheck(name="alpaca", status="ok", latency_ms=round(latency, 2), detail="paper_mode")
        return HealthCheck(name="alpaca", status="degraded", latency_ms=round(ms, 2), detail="ping_failed")
    except Exception as exc:
        ms = (time.monotonic() - start) * 1000
        return HealthCheck(name="alpaca", status="down", latency_ms=round(ms, 2), detail=str(exc)[:120])


async def _check_elasticsearch_impl() -> HealthCheck:
    """Inner ES check — called with asyncio.wait_for cap."""
    start = time.monotonic()
    try:
        import aiohttp
        es_url = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
        async with aiohttp.ClientSession() as sess:
            async with sess.get(f"{es_url}/_cluster/health",
                                timeout=aiohttp.ClientTimeout(total=2)) as resp:
                ms = (time.monotonic() - start) * 1000
                if resp.status == 200:
                    data = await resp.json()
                    return HealthCheck(name="elasticsearch", status="ok", latency_ms=round(ms, 2),
                                       detail=f"cluster={data.get('status','unknown')}")
                return HealthCheck(name="elasticsearch", status="degraded", latency_ms=round(ms, 2),
                                   detail=f"http_{resp.status}")
    except Exception as exc:
        ms = (time.monotonic() - start) * 1000
        return HealthCheck(name="elasticsearch", status="degraded", latency_ms=round(ms, 2), detail=str(exc)[:80])


async def _check_elasticsearch() -> HealthCheck:
    """Ping Elasticsearch — hard-capped at 2.5 s via asyncio.wait_for."""
    start = time.monotonic()
    try:
        return await asyncio.wait_for(_check_elasticsearch_impl(), timeout=2.5)
    except asyncio.TimeoutError:
        ms = (time.monotonic() - start) * 1000
        return HealthCheck(name="elasticsearch", status="degraded",
                           latency_ms=round(ms, 2), detail="timeout_2500ms")


async def _check_yfinance() -> HealthCheck:
    """Quick yfinance sanity check — runs in executor to avoid blocking event loop."""
    start = time.monotonic()
    try:
        import asyncio
        import yfinance as yf

        def _sync_check() -> float | None:
            t = yf.Ticker("SPY")
            info = t.fast_info
            return getattr(info, "last_price", None) or getattr(info, "regularMarketPrice", None)

        loop = asyncio.get_event_loop()
        price = await asyncio.wait_for(
            loop.run_in_executor(None, _sync_check),
            timeout=5.0,
        )
        ms = (time.monotonic() - start) * 1000
        if price:
            return HealthCheck(name="yfinance", status="ok", latency_ms=round(ms, 2),
                               detail=f"SPY={price:.2f}")
        return HealthCheck(name="yfinance", status="degraded", latency_ms=round(ms, 2), detail="no_price")
    except asyncio.TimeoutError:
        ms = (time.monotonic() - start) * 1000
        return HealthCheck(name="yfinance", status="degraded", latency_ms=round(ms, 2), detail="timeout_5s")
    except Exception as exc:
        ms = (time.monotonic() - start) * 1000
        return HealthCheck(name="yfinance", status="down", latency_ms=round(ms, 2), detail=str(exc)[:80])


async def _check_tradier() -> HealthCheck:
    """Check Tradier API key is configured."""
    start = time.monotonic()
    try:
        key = os.environ.get("TRADIER_BROKERAGE_KEY", "")
        if not key:
            return HealthCheck(name="tradier", status="degraded", detail="no_api_key_options_chain_unavailable")
        # Just validate the key is set, don't hit the API every health check
        return HealthCheck(name="tradier", status="ok",
                           latency_ms=round((time.monotonic() - start) * 1000, 2),
                           detail=f"key_configured key=****{key[-4:]}")
    except Exception as exc:
        return HealthCheck(name="tradier", status="down", detail=str(exc)[:80])


async def _check_news_provider() -> HealthCheck:
    """Check news/sentiment provider."""
    start = time.monotonic()
    try:
        from ...autopilot.news_provider import get_news_provider
        provider = get_news_provider()
        name = type(provider).__name__
        ms = (time.monotonic() - start) * 1000
        return HealthCheck(name="news_provider", status="ok", latency_ms=round(ms, 2), detail=f"provider={name}")
    except Exception as exc:
        ms = (time.monotonic() - start) * 1000
        return HealthCheck(name="news_provider", status="degraded", latency_ms=round(ms, 2), detail=str(exc)[:80])


def _get_autopilot_state() -> Dict[str, Any]:
    """Snapshot of the autopilot engine state."""
    try:
        from ...autopilot.unified_engine import get_unified_engine
        engine = get_unified_engine()
        last = engine._last_run

        return {
            "is_running": engine.is_running,
            "kill_switch": engine.kill_switch_active,
            "paper_verified": engine._paper_verified,
            "cycle_count": engine._cycle_counter,
            "current_phase": engine._current_phase.value,
            "last_run_id": last.run_id if last else None,
            "last_run_at": last.timestamp.isoformat() if last else None,
            "last_run_success": last.success if last else None,
            "last_run_duration_ms": last.duration_ms if last else None,
            "last_exits_triggered": last.exits_triggered if last else 0,
            "last_candidates_generated": last.candidates_generated if last else 0,
            "last_candidates_selected": last.candidates_selected if last else 0,
            "last_orders_filled": last.orders_filled if last else 0,
            "circuit_breaker_active": (
                engine._circuit_breaker_until is not None
                and engine._circuit_breaker_until > datetime.now()
            ),
            "consecutive_stopouts": engine._consecutive_stopouts,
        }
    except Exception as exc:
        return {"error": str(exc), "available": False}


def _get_market_session() -> Dict[str, Any]:
    """Current market session info."""
    try:
        from ...autopilot.trading_window import check_trading_window, get_trading_gate
        gate = get_trading_gate()
        status = check_trading_window(None)
        return {
            "state": status.state.value,
            "allow_trading": status.allow_trading,
            "reason": status.reason,
            "trigger_flatten": status.trigger_flatten,
        }
    except Exception as exc:
        return {"error": str(exc), "available": False}


def _get_python_version() -> str:
    import sys
    v = sys.version_info
    return f"{v.major}.{v.minor}.{v.micro}"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/version", response_model=VersionResponse)
async def get_version(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> VersionResponse:
    """
    Return the engine version manifest.

    Always 200. Includes:
    - app_version  : human-readable build label
    - schema_version : run artifact schema version
    - git_sha      : short commit hash (12 chars) or "unknown"
    - feature_flags: which optional features are enabled
    - correlation_id: echo of request header (or generated)
    """
    cid = _make_cid(x_correlation_id)
    return VersionResponse(
        ok=True,
        correlation_id=cid,
        app_version="apex-terminal-v2.0.0",
        schema_version=SCHEMA_VERSION,
        git_sha=_git_sha(),
        python_version=_get_python_version(),
        feature_flags=FEATURE_FLAGS,
        timestamp=datetime.now(timezone.utc).isoformat(),
        autopilot_build="unified-engine-v2",
    )


@router.get("/health", response_model=HealthResponse)
async def get_health(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> HealthResponse:
    """
    Full dependency health tree.

    Runs all checks concurrently and returns the full status of:
    - alpaca (paper trading API)
    - elasticsearch
    - yfinance (market data fallback)
    - tradier (options chain)
    - news_provider

    overall_status = "ok" iff all critical checks pass.
    Critical checks: alpaca. Degraded-allowed: es, tradier, news.
    """
    cid = _make_cid(x_correlation_id)
    ts = datetime.now(timezone.utc).isoformat()

    # Run all checks concurrently
    alpaca_check, es_check, yfinance_check, tradier_check, news_check = await asyncio.gather(
        _check_alpaca(),
        _check_elasticsearch(),
        _check_yfinance(),
        _check_tradier(),
        _check_news_provider(),
        return_exceptions=False,
    )

    checks = [alpaca_check, es_check, yfinance_check, tradier_check, news_check]

    # Overall status: critical only if alpaca is down or finance feed is down
    critical_down = alpaca_check.status == "down" or yfinance_check.status == "down"
    any_degraded = any(c.status == "degraded" for c in checks)

    if critical_down:
        overall = "critical"
    elif any_degraded:
        overall = "degraded"
    else:
        overall = "ok"

    return HealthResponse(
        ok=(overall != "critical"),
        correlation_id=cid,
        timestamp=ts,
        overall_status=overall,
        checks=[c for c in checks],
        autopilot_state=_get_autopilot_state(),
        market_session=_get_market_session(),
    )


@router.get("/cycle", response_model=CycleResponse)
async def get_last_cycle(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> CycleResponse:
    """
    Return the most recently completed cycle artifact as a summary dict.

    Returns {has_cycle: false} if no cycle has run yet (e.g. market closed).
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.unified_engine import get_unified_engine
        engine = get_unified_engine()
        last = engine._last_run
        if last is None:
            return CycleResponse(ok=True, correlation_id=cid, has_cycle=False)

        # Build compact summary
        summary: Dict[str, Any] = {
            "run_id": last.run_id,
            "timestamp": last.timestamp.isoformat(),
            "success": last.success,
            "duration_ms": last.duration_ms,
            "error_phase": last.error_phase.value if last.error_phase else None,
            "candidates_generated": last.candidates_generated,
            "candidates_selected": last.candidates_selected,
            "exits_triggered": last.exits_triggered,
            "exits_executed": last.exits_executed,
            "orders_placed": len(last.orders_placed),
            "orders_filled": last.orders_filled,
            "no_action_reasons": last.no_action_reasons,
            "gates_triggered": [g.value for g in last.gates_triggered],
            "health": last.health.to_dict() if last.health else None,
            "market": last.market_context.to_dict() if last.market_context else None,
            "sentiment": last.sentiment.to_dict() if last.sentiment else None,
            "live_quotes": getattr(last, "live_quotes", {}),
            "error": last.error,
        }
        return CycleResponse(ok=True, correlation_id=cid, has_cycle=True, cycle=summary)
    except Exception as exc:
        logger.error(f"ops/autopilot/cycle error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/arm", response_model=ArmResponse)
async def arm_autopilot(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> ArmResponse:
    """
    Enable continuous automation (arm the autopilot).

    Sets config.continuous_run = True so the background loop executes cycles.
    Refuses to arm if paper_verified is False.
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.unified_engine import get_unified_engine
        from ...autopilot.config import get_autopilot_config

        engine = get_unified_engine()
        if not engine._paper_verified:
            raise HTTPException(
                status_code=403,
                detail="Cannot arm: paper endpoint verification failed. Check APCA_ENDPOINT."
            )

        config = get_autopilot_config()
        config.continuous_run = True

        logger.info(f"[{cid}] Autopilot ARMED — continuous_run=True")
        return ArmResponse(
            ok=True, correlation_id=cid, automation_enabled=True,
            message="Autopilot armed. Cycles will run on next trading window.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"arm error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/disarm", response_model=ArmResponse)
async def disarm_autopilot(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> ArmResponse:
    """
    Disable continuous automation (disarm the autopilot, non-destructive).

    Sets config.continuous_run = False. Does NOT close open positions.
    To close positions, use the kill-switch endpoint.
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.config import get_autopilot_config
        config = get_autopilot_config()
        config.continuous_run = False
        logger.info(f"[{cid}] Autopilot DISARMED — continuous_run=False")
        return ArmResponse(
            ok=True, correlation_id=cid, automation_enabled=False,
            message="Autopilot disarmed. No new cycles will run.",
        )
    except Exception as exc:
        logger.error(f"disarm error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/run-now", response_model=RunNowResponse)
async def run_now(
    background_tasks: BackgroundTasks,
    dry_run: bool = Query(False, description="Dry-run — skip execution phase"),
    force: bool = Query(False, description="Force cycle even outside trading window"),
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> RunNowResponse:
    """
    Trigger an immediate sync cycle.

    Runs the cycle synchronously in the background and returns immediately with the run_id.
    Useful for manual triggers, testing, and operator monitoring.

    force=true bypasses trading window and kill-switch (for authorized operators).
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.unified_engine import get_unified_engine

        engine = get_unified_engine()
        if engine._is_running:
            logger.warning(f"[{cid}] run-now requested but cycle already running")
            return RunNowResponse(
                ok=False, correlation_id=cid,
                message="A cycle is already running. Try again shortly.",
                already_running=True,
            )

        # Run cycle in background task so we return immediately
        async def _do_cycle():
            try:
                artifact = await engine.run_cycle(dry_run=dry_run, force=force)
                logger.info(f"[{cid}] run-now completed: run_id={artifact.run_id} success={artifact.success}")
            except Exception as e:
                logger.error(f"[{cid}] run-now cycle error: {e}", exc_info=True)

        background_tasks.add_task(_do_cycle)

        # Generate expected run_id (engine generates it inside, so we can't know it yet)
        # But we can return a correlation handle
        return RunNowResponse(
            ok=True, correlation_id=cid,
            message=f"Cycle started{'(dry_run)' if dry_run else ''}. Poll /cycle for results.",
            run_id=None,
        )
    except Exception as exc:
        logger.error(f"run-now error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/positions")
async def get_live_positions(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> Dict[str, Any]:
    """
    Return current Alpaca paper positions with enriched metadata.

    Live: calls Alpaca REST API to return real-time position data.
    Includes: unrealized PnL, entry vs current price, managed/unmanaged flag.
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.alpaca_client import get_alpaca_client
        from ...autopilot.broker_position_manager import get_broker_position_manager

        client = get_alpaca_client()
        manager = get_broker_position_manager()

        if not client.is_configured:
            return {"ok": False, "correlation_id": cid, "error": "alpaca_not_configured", "positions": []}

        positions = await client.list_positions()
        account = await client.get_account()

        enriched = []
        for pos in positions:
            meta = manager._store.get(pos.symbol)
            enriched.append({
                **pos.to_dict(),
                "managed": meta.managed if meta else False,
                "strategy_id": meta.strategy_id if meta else None,
                "strategy_template": meta.strategy_template if meta else None,
                "run_id": meta.run_id if meta else None,
                "opened_at": meta.opened_at.isoformat() if meta and meta.opened_at else None,
            })

        return {
            "ok": True,
            "correlation_id": cid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "count": len(enriched),
            "positions": enriched,
            "account": account.to_dict() if account else None,
        }
    except Exception as exc:
        logger.error(f"positions error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/account")
async def get_account(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> Dict[str, Any]:
    """
    Return Alpaca paper account details: buying power, equity, PnL, etc.
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.alpaca_client import get_alpaca_client
        client = get_alpaca_client()

        if not client.is_configured:
            return {"ok": False, "correlation_id": cid, "error": "alpaca_not_configured"}

        account = await client.get_account()
        clock = await client.get_clock()

        return {
            "ok": True,
            "correlation_id": cid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "account": account.to_dict() if account else None,
            "market_clock": clock.to_dict() if clock else None,
        }
    except Exception as exc:
        logger.error(f"account error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/orders")
async def get_orders(
    status: str = Query("all", description="all | open | filled | canceled"),
    limit: int = Query(50, ge=1, le=500),
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> Dict[str, Any]:
    """
    Return recent Alpaca paper orders.
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.alpaca_client import get_alpaca_client
        client = get_alpaca_client()

        if not client.is_configured:
            return {"ok": False, "correlation_id": cid, "error": "alpaca_not_configured", "orders": []}

        order_status = None if status == "all" else status
        orders = await client.list_orders(status=order_status, limit=limit)

        return {
            "ok": True,
            "correlation_id": cid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "count": len(orders),
            "orders": [o.to_dict() for o in orders],
        }
    except Exception as exc:
        logger.error(f"orders error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/universe")
async def get_universe(
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> Dict[str, Any]:
    """
    Return the current autopilot trading universe (allowed symbols + config).
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.config import get_autopilot_config
        config = get_autopilot_config()

        # Build symbol list from config universe (list of strings or objects)
        raw_universe = getattr(config, "universe", []) or []
        symbols_out = []
        for entry in raw_universe:
            if isinstance(entry, str):
                symbols_out.append({"symbol": entry, "sector": "unknown", "liquidity_tier": "standard"})
            else:
                symbols_out.append({
                    "symbol": getattr(entry, "symbol", str(entry)),
                    "sector": getattr(entry, "sector", "unknown"),
                    "liquidity_tier": getattr(entry, "liquidity_tier", "standard"),
                })

        return {
            "ok": True,
            "correlation_id": cid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "count": len(symbols_out),
            "symbols": symbols_out,
            "config": {
                "max_positions": getattr(config, "max_positions", None) or getattr(getattr(config, "risk_limits", None), "max_open_positions", None),
                "max_risk_per_trade": getattr(config, "max_risk_per_trade", None) or getattr(getattr(config, "risk_limits", None), "max_risk_per_trade", None),
                "contracts_per_trade": getattr(config, "contracts_per_trade", None),
                "weekly_expiry_only": getattr(config, "weekly_expiry_only", False),
                "continuous_run": getattr(config, "continuous_run", True),
                "paper_equity": getattr(config, "paper_equity", None),
                "mode": getattr(config, "mode", "unknown"),
            },
        }
    except Exception as exc:
        logger.error(f"universe error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/runs")
async def list_runs(
    limit: int = Query(20, ge=1, le=100),
    x_correlation_id: Optional[str] = Header(None, alias="x-correlation-id"),
) -> Dict[str, Any]:
    """
    Return the last N completed cycle run summaries from the in-memory history.
    """
    cid = _make_cid(x_correlation_id)
    try:
        from ...autopilot.unified_engine import get_unified_engine
        engine = get_unified_engine()
        history = engine._run_history[-limit:] if engine._run_history else []

        runs_out = []
        for r in reversed(history):
            runs_out.append({
                "run_id": r.run_id,
                "timestamp": r.timestamp.isoformat(),
                "success": r.success,
                "duration_ms": r.duration_ms,
                "candidates_generated": r.candidates_generated,
                "candidates_selected": r.candidates_selected,
                "exits_triggered": r.exits_triggered,
                "orders_filled": r.orders_filled,
                "no_action_reasons": r.no_action_reasons,
                "error": r.error,
            })

        return {
            "ok": True,
            "correlation_id": cid,
            "total_in_memory": len(engine._run_history),
            "returned": len(runs_out),
            "runs": runs_out,
        }
    except Exception as exc:
        logger.error(f"runs error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
