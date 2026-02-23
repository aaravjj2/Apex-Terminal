"""
Ops Health Endpoints — Real Connectivity Probes
/api/ops/elastic/health   — Elasticsearch live ping + cluster stats
/api/ops/broker/health    — Alpaca paper connectivity + account
/api/ops/ws/health        — WebSocket manager stats
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Dict

import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api/ops", tags=["ops-health"])


# ── Elasticsearch ──────────────────────────────────────────────────────────────

async def _probe_elasticsearch(timeout: float = 5.0) -> Dict[str, Any]:
    """Ping ES and return cluster health. Never raises — returns error dict."""
    es_url = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
    es_user = os.environ.get("ELASTICSEARCH_USER", "")
    es_pass = os.environ.get("ELASTICSEARCH_PASSWORD", "")
    auth = (es_user, es_pass) if es_user else None

    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            health_resp = await client.get(f"{es_url}/_cluster/health", auth=auth)
            latency_ms = round((time.monotonic() - t0) * 1000, 1)

        if health_resp.status_code != 200:
            return {
                "connected": False,
                "latency_ms": latency_ms,
                "error": f"HTTP {health_resp.status_code}",
            }

        data = health_resp.json()
        cluster_status = data.get("status", "unknown")

        # Also fetch doc counts for apex-* indices
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                stats_resp = await client.get(f"{es_url}/apex-*/_stats/docs", auth=auth)
            stats = {}
            if stats_resp.status_code == 200:
                raw = stats_resp.json().get("indices", {})
                for idx, v in raw.items():
                    stats[idx] = v.get("primaries", {}).get("docs", {}).get("count", 0)
        except Exception:
            stats = {}

        return {
            "connected": True,
            "cluster_status": cluster_status,
            "cluster_name": data.get("cluster_name"),
            "node_count": data.get("number_of_nodes", 0),
            "shards_active": data.get("active_shards", 0),
            "latency_ms": latency_ms,
            "index_docs": stats,
            "url": es_url,
        }
    except Exception as exc:
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        return {
            "connected": False,
            "latency_ms": latency_ms,
            "error": str(exc),
            "url": es_url,
        }


@router.get("/elastic/health")
async def elastic_health():
    """Elasticsearch real connectivity probe. Returns 503 if ES is down."""
    result = await _probe_elasticsearch()
    if not result["connected"]:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=result)
    return result


# ── Alpaca Broker ──────────────────────────────────────────────────────────────

async def _probe_broker(timeout: float = 10.0) -> Dict[str, Any]:
    """Probe Alpaca paper trading API. Never raises."""
    t0 = time.monotonic()
    try:
        api_key = os.environ.get("APCA_API_KEY_ID", "")
        api_secret = os.environ.get("APCA_API_SECRET_KEY", "")
        base_url = os.environ.get(
            "ALPACA3_ENDPOINT", "https://paper-api.alpaca.markets"
        ).rstrip("/")

        if not api_key or not api_secret:
            return {
                "connected": False,
                "error": "APCA_API_KEY_ID or APCA_API_SECRET_KEY not set",
                "latency_ms": 0,
            }

        headers = {
            "APCA-API-KEY-ID": api_key,
            "APCA-API-SECRET-KEY": api_secret,
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base_url}/v2/account", headers=headers)

        latency_ms = round((time.monotonic() - t0) * 1000, 1)

        if resp.status_code != 200:
            return {
                "connected": False,
                "latency_ms": latency_ms,
                "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
            }

        acct = resp.json()
        return {
            "connected": True,
            "account_number": acct.get("account_number"),
            "status": acct.get("status"),
            "cash": acct.get("cash"),
            "portfolio_value": acct.get("portfolio_value"),
            "pattern_day_trader": acct.get("pattern_day_trader"),
            "trading_blocked": acct.get("trading_blocked"),
            "latency_ms": latency_ms,
            "endpoint": base_url,
        }
    except Exception as exc:
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        return {
            "connected": False,
            "latency_ms": latency_ms,
            "error": str(exc),
        }


@router.get("/broker/health")
async def broker_health():
    """Alpaca paper broker real connectivity probe. Returns 503 if broker is down."""
    result = await _probe_broker()
    if not result["connected"]:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=result)
    return result


# ── WebSocket Manager ─────────────────────────────────────────────────────────

@router.get("/ws/health")
async def ws_health():
    """WebSocket manager stats — connections, subscriptions, heartbeat state."""
    from ..websocket import get_manager
    mgr = get_manager()
    return {
        "running": mgr._running,
        "connections": mgr.connection_count,
        "subscriptions": mgr.subscription_count,
        "heartbeat_interval_s": mgr._heartbeat_interval,
        "heartbeat_task_alive": (
            mgr._heartbeat_task is not None and not mgr._heartbeat_task.done()
        ),
    }


# ── Combined readiness ────────────────────────────────────────────────────────

@router.get("/readiness")
async def system_readiness():
    """Parallel probe of all critical services. Use for startup checks."""
    es_task = asyncio.create_task(_probe_elasticsearch())
    broker_task = asyncio.create_task(_probe_broker())

    es_result, broker_result = await asyncio.gather(es_task, broker_task)

    from ..websocket import get_manager
    mgr = get_manager()
    ws_result = {
        "running": mgr._running,
        "connections": mgr.connection_count,
        "heartbeat_task_alive": (
            mgr._heartbeat_task is not None and not mgr._heartbeat_task.done()
        ),
    }

    all_ok = es_result.get("connected") and broker_result.get("connected") and ws_result.get("running")

    return {
        "ready": bool(all_ok),
        "elasticsearch": es_result,
        "broker": broker_result,
        "websocket": ws_result,
    }
