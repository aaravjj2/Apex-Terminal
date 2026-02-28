"""
backend/core/es_templates.py — W91

Deterministic ES index templates + alias enforcement.
Entity types: events, strategies, backtests, workflows, jobs, tickets, edges.

Alias convention:
  apex-{type}-write  → current write index (is_write_index: true)
  apex-{type}-read   → all matching indices (for queries)
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx

# ── Constants ──────────────────────────────────────────────────────────────────

ENTITY_TYPES: List[str] = [
    "events", "strategies", "backtests", "workflows", "jobs", "tickets", "edges"
]

ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")

# Current index suffix (YYYY.MM) for write indices
_INDEX_SUFFIX = datetime.utcnow().strftime("%Y.%m")


def index_name(entity: str, suffix: str = _INDEX_SUFFIX) -> str:
    return f"apex-{entity}-{suffix}"


def write_alias(entity: str) -> str:
    return f"apex-{entity}-write"


def read_alias(entity: str) -> str:
    return f"apex-{entity}-read"


# ── Template bodies ────────────────────────────────────────────────────────────

_COMMON_SETTINGS = {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "refresh_interval": "5s",
}

_COMMON_META = {
    "version": "4",
    "managed_by": "apex-terminal-w91",
}


def _get_template_body(entity: str) -> Dict[str, Any]:
    """Return PUT /_index_template body for the given entity type."""
    base_mappings: Dict[str, Any] = {
        "dynamic": "strict",
        "properties": {
            "id":          {"type": "keyword"},
            "created_at":  {"type": "date"},
            "updated_at":  {"type": "date"},
            "entity_type": {"type": "keyword"},
            "version":     {"type": "integer"},
        },
    }

    # Entity-specific field additions
    extra: Dict[str, Any] = {}
    if entity == "events":
        extra = {
            "event_type":   {"type": "keyword"},
            "correlation_id": {"type": "keyword"},
            "payload":      {"type": "object", "dynamic": True},
            "severity":     {"type": "keyword"},
            "source":       {"type": "keyword"},
        }
    elif entity == "strategies":
        extra = {
            "name":         {"type": "keyword"},
            "description":  {"type": "text"},
            "status":       {"type": "keyword"},
            "params":       {"type": "object", "dynamic": True},
        }
    elif entity == "backtests":
        extra = {
            "strategy_id":  {"type": "keyword"},
            "symbol":       {"type": "keyword"},
            "status":       {"type": "keyword"},
            "pnl":          {"type": "double"},
            "sharpe":       {"type": "double"},
            "start_date":   {"type": "date"},
            "end_date":     {"type": "date"},
        }
    elif entity == "workflows":
        extra = {
            "name":         {"type": "keyword"},
            "trigger_type": {"type": "keyword"},
            "enabled":      {"type": "boolean"},
            "action_count": {"type": "integer"},
        }
    elif entity == "jobs":
        extra = {
            "job_type":     {"type": "keyword"},
            "status":       {"type": "keyword"},
            "worker_id":    {"type": "keyword"},
            "started_at":   {"type": "date"},
            "finished_at":  {"type": "date"},
            "error":        {"type": "text"},
        }
    elif entity == "tickets":
        extra = {
            "ticket_type":  {"type": "keyword"},
            "status":       {"type": "keyword"},
            "priority":     {"type": "keyword"},
            "assignee":     {"type": "keyword"},
            "title":        {"type": "text"},
            "description":  {"type": "text"},
        }
    elif entity == "edges":
        extra = {
            "from_type":    {"type": "keyword"},
            "from_id":      {"type": "keyword"},
            "to_type":      {"type": "keyword"},
            "to_id":        {"type": "keyword"},
            "edge_type":    {"type": "keyword"},
            "weight":       {"type": "double"},
        }

    base_mappings["properties"].update(extra)

    return {
        "index_patterns": [f"apex-{entity}-*"],
        "_meta":          _COMMON_META,
        "template": {
            "settings": _COMMON_SETTINGS,
            "mappings": base_mappings,
            "aliases": {
                read_alias(entity): {},
            },
        },
        "priority": 200,
    }


# ── ES Client helpers ──────────────────────────────────────────────────────────

async def _es_request(
    method: str,
    path: str,
    body: Optional[Dict] = None,
    timeout: float = 30.0,
) -> Tuple[int, Dict]:
    """Make an async HTTP request to ES, return (status_code, json_body)."""
    url = ES_URL + path
    async with httpx.AsyncClient(timeout=timeout) as client:
        kwargs: Dict[str, Any] = {}
        if body is not None:
            kwargs["json"] = body
        resp = await getattr(client, method.lower())(url, **kwargs)
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, {"text": resp.text}


# ── Template management ────────────────────────────────────────────────────────

async def install_template(entity: str) -> Dict[str, Any]:
    """Install (or update) the index template for `entity`. Returns result."""
    template_name = f"apex-{entity}-template"
    body = _get_template_body(entity)
    status, resp = await _es_request("PUT", f"/_index_template/{template_name}", body)
    return {
        "entity": entity,
        "template_name": template_name,
        "status": status,
        "ok": status in (200, 201),
        "response": resp,
    }


async def get_template_status(entity: str) -> Dict[str, Any]:
    """Check if template exists and return its metadata."""
    template_name = f"apex-{entity}-template"
    try:
        status, resp = await _es_request("GET", f"/_index_template/{template_name}")
        exists = status == 200
        version = None
        if exists:
            templates = resp.get("index_templates", [])
            if templates:
                version = templates[0].get("index_template", {}).get("_meta", {}).get("version")
        return {
            "entity": entity,
            "template_name": template_name,
            "exists": exists,
            "version": version,
        }
    except Exception as exc:
        return {
            "entity": entity,
            "template_name": template_name,
            "exists": False,
            "version": None,
            "error": str(exc)[:120],
        }


async def ensure_all_templates() -> List[Dict[str, Any]]:
    """Install all entity templates (idempotent). Returns list of results."""
    tasks = [install_template(entity) for entity in ENTITY_TYPES]
    return list(await asyncio.gather(*tasks))


# ── Alias management ───────────────────────────────────────────────────────────

async def ensure_write_index(entity: str) -> Dict[str, Any]:
    """Create the current write index if it doesn't exist, with write alias.
    If index already exists but is missing aliases, add them."""
    idx = index_name(entity)
    walias = write_alias(entity)

    # Check if index exists
    status, _ = await _es_request("HEAD", f"/{idx}")
    if status == 200:
        # Index exists — ensure BOTH aliases are set (idempotent)
        alias_body = {
            "actions": [
                {"add": {"index": idx, "alias": walias, "is_write_index": True}},
                {"add": {"index": idx, "alias": read_alias(entity)}},
            ]
        }
        await _es_request("POST", "/_aliases", alias_body)
        return {"entity": entity, "index": idx, "created": False, "ok": True, "aliases_ensured": True}

    # Create index with write alias
    create_body = {
        "aliases": {
            walias: {"is_write_index": True},
        }
    }
    create_status, resp = await _es_request("PUT", f"/{idx}", create_body)
    return {
        "entity": entity,
        "index": idx,
        "write_alias": walias,
        "created": create_status in (200, 201),
        "ok": create_status in (200, 201),
        "response": resp,
    }


async def ensure_all_aliases() -> List[Dict[str, Any]]:
    """Ensure write indices + aliases exist for all entity types."""
    tasks = [ensure_write_index(entity) for entity in ENTITY_TYPES]
    return list(await asyncio.gather(*tasks))


async def _get_entity_alias_health(entity: str) -> Dict[str, Any]:
    """Check write + read alias for a single entity (parallel inner calls)."""
    walias = write_alias(entity)
    ralias = read_alias(entity)
    try:
        (w_status, w_resp), (r_status, r_resp) = await asyncio.gather(
            _es_request("GET", f"/_alias/{walias}"),
            _es_request("GET", f"/_alias/{ralias}"),
        )
        return {
            "entity": entity,
            "write_alias": walias,
            "read_alias": ralias,
            "write_alias_exists": w_status == 200,
            "read_alias_exists": r_status == 200,
            "write_index_count": len(w_resp) if w_status == 200 else 0,
            "read_index_count": len(r_resp) if r_status == 200 else 0,
        }
    except Exception as exc:
        return {
            "entity": entity,
            "write_alias": walias,
            "read_alias": ralias,
            "write_alias_exists": False,
            "read_alias_exists": False,
            "write_index_count": 0,
            "read_index_count": 0,
            "error": str(exc)[:120],
        }


async def get_alias_health() -> List[Dict[str, Any]]:
    """Return alias health for all entity types (all parallel)."""
    results = await asyncio.gather(*[_get_entity_alias_health(e) for e in ENTITY_TYPES])
    return list(results)


# ── Reindex pipeline ───────────────────────────────────────────────────────────

async def reindex_entity(
    entity: str,
    dry_run: bool = True,
    suffix_new: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Reindex an entity from its current write index to a new index.
    Steps: plan → (if not dry_run) execute → verify → alias swap.

    Returns a detailed reindex plan/result with audit event data.
    """
    current_idx = index_name(entity)
    new_suffix = suffix_new or datetime.utcnow().strftime("%Y.%m.reindex")
    new_idx = index_name(entity, new_suffix)
    walias = write_alias(entity)
    cid = str(uuid.uuid4())[:8]

    # Step 1: Plan
    plan = {
        "correlation_id": cid,
        "entity": entity,
        "source_index": current_idx,
        "dest_index": new_idx,
        "write_alias": walias,
        "dry_run": dry_run,
        "steps": ["plan", "execute", "verify", "alias_swap"] if not dry_run else ["plan"],
        "status": "planned",
        "audit_events": [
            {"step": "plan", "ts": _ts(), "msg": f"Reindex {current_idx} → {new_idx}"}
        ],
    }

    if dry_run:
        return plan

    # Step 2: Execute reindex
    reindex_body = {
        "source": {"index": current_idx},
        "dest":   {"index": new_idx, "op_type": "index"},
    }
    exec_status, exec_resp = await _es_request("POST", "/_reindex?wait_for_completion=true", reindex_body)
    plan["audit_events"].append({
        "step": "execute",
        "ts": _ts(),
        "ok": exec_status in (200, 201),
        "docs_reindexed": exec_resp.get("total", 0),
    })

    if exec_status not in (200, 201):
        plan["status"] = "failed"
        plan["error"] = exec_resp
        return plan

    # Step 3: Verify
    v_status, v_resp = await _es_request("GET", f"/{new_idx}/_count")
    new_count = v_resp.get("count", 0)
    s_status, s_resp = await _es_request("GET", f"/{current_idx}/_count")
    src_count = s_resp.get("count", 0)
    plan["audit_events"].append({
        "step": "verify",
        "ts": _ts(),
        "source_count": src_count,
        "dest_count": new_count,
        "match": new_count == src_count,
    })

    if new_count != src_count:
        plan["status"] = "failed_verification"
        return plan

    # Step 4: Alias swap
    swap_body = {
        "actions": [
            {"remove": {"index": current_idx, "alias": walias}},
            {"add":    {"index": new_idx, "alias": walias, "is_write_index": True}},
        ]
    }
    swap_status, swap_resp = await _es_request("POST", "/_aliases", swap_body)
    plan["audit_events"].append({
        "step": "alias_swap",
        "ts": _ts(),
        "ok": swap_status == 200,
    })

    plan["status"] = "completed" if swap_status == 200 else "swap_failed"
    return plan


def _ts() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ── Aggregated health ─────────────────────────────────────────────────────────

async def get_template_health() -> Dict[str, Any]:
    """
    Return combined template + alias health for all entity types.
    Used by /api/v3/ops/es/templates endpoint.
    """
    template_statuses, alias_statuses = await asyncio.gather(
        asyncio.gather(*[get_template_status(e) for e in ENTITY_TYPES]),
        get_alias_health(),
    )

    templates_healthy = all(t["exists"] for t in template_statuses)
    aliases_healthy = all(
        a["write_alias_exists"] and a["read_alias_exists"]
        for a in alias_statuses
    )

    return {
        "templates": list(template_statuses),
        "aliases": alias_statuses,
        "templates_healthy": templates_healthy,
        "aliases_healthy": aliases_healthy,
        "entity_types": ENTITY_TYPES,
        "timestamp": _ts(),
    }
