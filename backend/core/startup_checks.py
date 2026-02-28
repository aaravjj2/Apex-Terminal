"""
backend/core/startup_checks.py
Wave 84: Real startup probes for all required dependencies.
No demo fallbacks. Fail-fast if deps are missing in prod.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from typing import Any, Dict

import httpx


async def check_elasticsearch(
    url: str | None = None,
    timeout: float = 5.0,
) -> Dict[str, Any]:
    """
    Probe Elasticsearch cluster health.
    Returns a dict with: connected, latency_ms, cluster_status, error (if any).
    Never raises.
    """
    es_url = (url or os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")).rstrip("/")
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(f"{es_url}/_cluster/health")
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        if r.status_code != 200:
            return {
                "connected": False,
                "latency_ms": latency_ms,
                "error": f"HTTP {r.status_code}",
            }
        data = r.json()
        return {
            "connected": True,
            "cluster_status": data.get("status"),
            "cluster_name": data.get("cluster_name"),
            "node_count": data.get("number_of_nodes", 0),
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        return {
            "connected": False,
            "latency_ms": round((time.monotonic() - t0) * 1000, 1),
            "error": str(exc),
        }


async def check_broker(
    api_key: str | None = None,
    api_secret: str | None = None,
    endpoint: str | None = None,
    timeout: float = 10.0,
) -> Dict[str, Any]:
    """
    Probe Alpaca paper trading API.
    Returns a dict with: connected, account_status, latency_ms, error (if any).
    Never raises.
    """
    key = api_key or os.environ.get("APCA_API_KEY_ID", "")
    secret = api_secret or os.environ.get("APCA_API_SECRET_KEY", "")
    base_url = (endpoint or os.environ.get(
        "APCA_ENDPOINT", "https://paper-api.alpaca.markets"
    )).rstrip("/")

    if not key or not secret:
        return {
            "connected": False,
            "error": "APCA_API_KEY_ID or APCA_API_SECRET_KEY not configured",
            "latency_ms": 0,
        }

    t0 = time.monotonic()
    try:
        headers = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(f"{base_url}/v2/account", headers=headers)
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        if r.status_code != 200:
            return {
                "connected": False,
                "latency_ms": latency_ms,
                "error": f"HTTP {r.status_code}",
            }
        acct = r.json()
        return {
            "connected": True,
            "account_status": acct.get("status"),
            "account_number": acct.get("account_number"),
            "trading_blocked": acct.get("trading_blocked"),
            "cash": float(acct.get("cash", 0)),
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        return {
            "connected": False,
            "latency_ms": round((time.monotonic() - t0) * 1000, 1),
            "error": str(exc),
        }


async def run_all_checks(timeout: float = 5.0) -> Dict[str, Any]:
    """
    Run all startup checks in parallel.
    Returns a combined health dict with correlation_id + last_check_at.
    """
    correlation_id = str(uuid.uuid4())
    started_at = time.time()

    es_task = asyncio.create_task(check_elasticsearch(timeout=timeout))
    broker_task = asyncio.create_task(check_broker(timeout=timeout))

    es_result, broker_result = await asyncio.gather(es_task, broker_task)

    all_ok = (
        es_result.get("connected", False)
        and broker_result.get("connected", False)
    )

    return {
        "correlation_id": correlation_id,
        "ready": all_ok,
        "checked_at": started_at,
        "dependencies": {
            "elasticsearch": es_result,
            "broker": broker_result,
        },
    }


def fail_fast_if_not_ready(checks: Dict[str, Any], profile: str = "dev") -> None:
    """
    In prod profile, raises RuntimeError if any required dep is not connected.
    In dev profile, logs warnings but does not raise.
    """
    if profile != "prod":
        return  # dev mode: continue even if deps missing

    deps = checks.get("dependencies", {})
    failures = []
    for name, result in deps.items():
        if not result.get("connected", False):
            failures.append(f"{name}: {result.get('error', 'not connected')}")

    if failures:
        raise RuntimeError(
            "PROFILE=prod startup checks failed:\n"
            + "\n".join(f"  - {f}" for f in failures)
        )
