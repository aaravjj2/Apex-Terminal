"""
Wave 84+87: /api/v3/ops/* — Stable ops health endpoints with correlation_id.
"""
from __future__ import annotations

import asyncio
import sys
import time
import os
from pathlib import Path
from typing import Any, Dict, Optional

# Add backend/ to sys.path so we can import backend.core
_REPO_ROOT = Path(__file__).parent.parent.parent.parent.parent  # phase1/services/api/routes/ → 4 levels up
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from fastapi import APIRouter

router = APIRouter(prefix="/api/v3/ops", tags=["ops-v3"])


@router.get("/health")
async def ops_health_v3():
    """
    W84: Combined ops health with correlation_id.
    Returns real dependency statuses — no fake values.
    """
    from backend.core.startup_checks import run_all_checks  # type: ignore
    result = await run_all_checks(timeout=5.0)
    return result


@router.get("/elasticsearch")
async def ops_elasticsearch_v3():
    """W84: Elasticsearch-specific health probe."""
    from backend.core.startup_checks import check_elasticsearch  # type: ignore
    return await check_elasticsearch()


@router.get("/broker")
async def ops_broker_v3():
    """W84: Broker-specific health probe (redacted account fields)."""
    from backend.core.startup_checks import check_broker  # type: ignore
    result = await check_broker()
    # Redact any sensitive fields before returning
    acct = result.get("account_number") or ""
    if acct:
        result = dict(result)
        result["account_number"] = "***" + acct[-4:] if len(acct) > 4 else "***"
    return result


@router.get("/ws/health")
async def ops_ws_health_v3():
    """
    W87: WebSocket health probe.
    Returns: active_clients, last_heartbeat_age_s, disconnect_count, running.
    """
    from ..websocket import get_manager
    mgr = get_manager()
    return {
        "running": mgr._running,
        "active_clients": mgr.connection_count,
        "subscriptions": mgr.subscription_count,
        "disconnect_count": mgr.disconnect_count,
        "last_heartbeat_age_s": mgr.last_heartbeat_age_s,
        "heartbeat_interval_s": mgr._heartbeat_interval,
        "heartbeat_task_alive": (
            mgr._heartbeat_task is not None and not mgr._heartbeat_task.done()
        ),
    }


@router.get("/es/templates")
async def ops_es_templates():
    """
    W91: ES index template + alias health for all entity types.
    Returns templates[], aliases[], templates_healthy, aliases_healthy.
    """
    from backend.core.es_templates import get_template_health  # type: ignore
    return await get_template_health()


@router.post("/es/templates/install")
async def ops_es_templates_install():
    """
    W91: Install (or reapply) all ES index templates + create write indices.
    Idempotent — safe to call multiple times.
    """
    from backend.core.es_templates import ensure_all_templates, ensure_all_aliases  # type: ignore
    template_results, alias_results = await __import__("asyncio").gather(
        ensure_all_templates(),
        ensure_all_aliases(),
    )
    return {
        "templates_installed": template_results,
        "aliases_ensured": alias_results,
        "ok": all(r.get("ok") for r in template_results),
    }


@router.post("/es/reindex/{entity}")
async def ops_es_reindex(entity: str, dry_run: bool = True):
    """
    W91: Reindex a single entity type (dry_run=true by default).
    Steps: plan → execute → verify → alias swap.
    """
    from backend.core.es_templates import ENTITY_TYPES, reindex_entity  # type: ignore
    if entity not in ENTITY_TYPES:
        return {"error": f"Unknown entity '{entity}'. Valid: {ENTITY_TYPES}"}
    return await reindex_entity(entity, dry_run=dry_run)


# ── W92: Bulk ingest + DLQ + lag metrics ──────────────────────────────────────

@router.get("/ingest/lag")
async def ops_ingest_lag():
    """
    W92: Lag metrics per entity type.
    Returns dlq_pending, es_count, lag per entity.
    """
    from backend.core.bulk_ingest import get_lag_metrics  # type: ignore
    return {"metrics": await get_lag_metrics(), "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z"}


@router.get("/ingest/dlq")
async def ops_ingest_dlq():
    """
    W92: DLQ stats (pending, total, drained) per entity.
    """
    from backend.core.bulk_ingest import get_dlq_stats  # type: ignore
    stats = await get_dlq_stats()
    total_pending = sum(s["pending"] for s in stats)
    return {
        "stats": stats,
        "total_pending": total_pending,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }


@router.post("/ingest/dlq/drain")
async def ops_ingest_dlq_drain():
    """
    W92: Drain all pending DLQ entries (re-attempt to ES).
    """
    from backend.core.bulk_ingest import drain_dlq  # type: ignore
    result = await drain_dlq()
    return {"ok": result["failed"] == 0, **result}


@router.post("/ingest/dlq/drain/{entity}")
async def ops_ingest_dlq_drain_entity(entity: str):
    """
    W92: Drain pending DLQ entries for a specific entity type.
    """
    from backend.core.bulk_ingest import drain_dlq  # type: ignore
    from backend.core.es_templates import ENTITY_TYPES  # type: ignore
    if entity not in ENTITY_TYPES:
        return {"error": f"Unknown entity '{entity}'. Valid: {list(ENTITY_TYPES)}"}
    result = await drain_dlq(entity=entity)
    return {"ok": result["failed"] == 0, **result}


@router.post("/ingest/test")
async def ops_ingest_test(entity: str = "events", count: int = 1, fail: bool = False):
    """
    W92: Test endpoint — ingest synthetic records. Use fail=true to force DLQ.
    """
    import os
    from backend.core.bulk_ingest import bulk_ingest  # type: ignore

    records = [
        {"id": f"test-{__import__('uuid').uuid4()}", "entity_type": entity,
         "message": f"test record {i}", "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
         "version": 1}
        for i in range(count)
    ]

    if fail:
        # Temporarily point ES to a bad URL so ingest fails → goes to DLQ
        original = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9999"
        try:
            result = await bulk_ingest(entity, records, max_retries=1, backoff_base=0.0)
        finally:
            os.environ["ELASTICSEARCH_URL"] = original
    else:
        result = await bulk_ingest(entity, records)

    return result
