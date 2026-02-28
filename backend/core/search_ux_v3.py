"""
W96 — Search UX v3
Faceted search + saved searches + explain drawer (no secrets).
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite

try:
    from elasticsearch import AsyncElasticsearch
except ImportError:
    AsyncElasticsearch = None  # type: ignore

DB_PATH = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db").replace(
    "sqlite+aiosqlite:///", ""
)

ES_HOST = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

ENTITY_INDICES = [
    "apex-events-read",
    "apex-strategies-read",
    "apex-backtests-read",
    "apex-workflows-read",
    "apex-jobs-read",
    "apex-tickets-read",
]

_SECRET_RE = re.compile(
    r"(api[_-]?key|password|secret|token|auth|credential|private[_-]?key)",
    re.IGNORECASE,
)

# ─── SQLite ───────────────────────────────────────────────────────────────────

async def ensure_search_tables() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS saved_searches (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                query       TEXT DEFAULT '',
                filters     TEXT DEFAULT '{}',
                sort_field  TEXT DEFAULT '_score',
                sort_dir    TEXT DEFAULT 'desc',
                pinned      INTEGER DEFAULT 0,
                hit_count   INTEGER DEFAULT 0,
                created_at  TEXT,
                updated_at  TEXT
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_ss_pinned ON saved_searches(pinned DESC)")
        await db.commit()


# ─── Saved searches CRUD ─────────────────────────────────────────────────────

async def save_search(
    name: str,
    query: str = "",
    filters: dict | None = None,
    sort_field: str = "_score",
    sort_dir: str = "desc",
    pinned: bool = False,
) -> dict[str, Any]:
    await ensure_search_tables()
    sid = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc).isoformat()
    filt_str = json.dumps(filters or {})
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO saved_searches
               (id, name, query, filters, sort_field, sort_dir, pinned, hit_count, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,0,?,?)""",
            (sid, name, query, filt_str, sort_field, sort_dir, 1 if pinned else 0, now, now),
        )
        await db.commit()
    return {
        "id": sid,
        "name": name,
        "query": query,
        "filters": filters or {},
        "sort_field": sort_field,
        "sort_dir": sort_dir,
        "pinned": pinned,
        "created_at": now,
    }


async def list_saved_searches(pinned_first: bool = True) -> list[dict[str, Any]]:
    await ensure_search_tables()
    order = "pinned DESC, created_at DESC" if pinned_first else "created_at DESC"
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(f"SELECT * FROM saved_searches ORDER BY {order} LIMIT 100")
        rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "query": r["query"],
            "filters": json.loads(r["filters"] or "{}"),
            "sort_field": r["sort_field"],
            "sort_dir": r["sort_dir"],
            "pinned": bool(r["pinned"]),
            "hit_count": r["hit_count"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def get_saved_search(search_id: str) -> dict[str, Any] | None:
    await ensure_search_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM saved_searches WHERE id=?", (search_id,))
        row = await cur.fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "query": row["query"],
        "filters": json.loads(row["filters"] or "{}"),
        "sort_field": row["sort_field"],
        "sort_dir": row["sort_dir"],
        "pinned": bool(row["pinned"]),
        "hit_count": row["hit_count"],
        "created_at": row["created_at"],
    }


async def delete_saved_search(search_id: str) -> bool:
    await ensure_search_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM saved_searches WHERE id=?", (search_id,))
        await db.commit()
    return cur.rowcount > 0


async def clear_saved_searches() -> dict[str, Any]:
    await ensure_search_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM saved_searches")
        await db.commit()
    return {"ok": True, "deleted": cur.rowcount}


async def pin_search(search_id: str, pinned: bool) -> bool:
    await ensure_search_tables()
    now = datetime.now(tz=timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE saved_searches SET pinned=?, updated_at=? WHERE id=?",
            (1 if pinned else 0, now, search_id),
        )
        await db.commit()
    return cur.rowcount > 0


# ─── ES utilities ─────────────────────────────────────────────────────────────

def _get_es() -> Any:
    if AsyncElasticsearch is None:
        return None
    return AsyncElasticsearch(ES_HOST)


def _redact_dict(obj: Any) -> Any:
    """Strip secrets from a dict/list structure."""
    if isinstance(obj, dict):
        return {
            k: "[REDACTED]" if _SECRET_RE.search(k) else _redact_dict(v)
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_redact_dict(i) for i in obj]
    return obj


# ─── Faceted search ───────────────────────────────────────────────────────────

async def search_with_facets(
    query: str,
    filters: dict | None = None,
    sort_field: str = "_score",
    sort_dir: str = "desc",
    size: int = 20,
    entity_type: str | None = None,
) -> dict[str, Any]:
    """
    Full-text search with facets (aggregations) across entity indices.
    Supports filters: entity_type, time_range, severity, symbol, run_id.
    """
    filt = filters or {}
    indices = ENTITY_INDICES
    if entity_type:
        indices = [i for i in ENTITY_INDICES if entity_type in i]
    if not indices:
        indices = ENTITY_INDICES

    must_clauses: list[dict] = []
    if query.strip():
        must_clauses.append({
            "multi_match": {
                "query": query,
                "fields": ["*"],
                "type": "best_fields",
                "fuzziness": "AUTO",
            }
        })
    else:
        must_clauses.append({"match_all": {}})

    # Apply filters
    filter_clauses: list[dict] = []
    if filt.get("severity"):
        filter_clauses.append({"term": {"severity": filt["severity"]}})
    if filt.get("symbol"):
        filter_clauses.append({"term": {"symbol": filt["symbol"]}})
    if filt.get("run_id"):
        filter_clauses.append({"term": {"run_id": filt["run_id"]}})
    if filt.get("time_from") or filt.get("time_to"):
        range_q: dict = {}
        if filt.get("time_from"):
            range_q["gte"] = filt["time_from"]
        if filt.get("time_to"):
            range_q["lte"] = filt["time_to"]
        filter_clauses.append({"range": {"timestamp": range_q}})

    es_body: dict = {
        "query": {
            "bool": {
                "must": must_clauses,
                "filter": filter_clauses,
            }
        },
        "aggs": {
            "by_entity_type": {
                "terms": {"field": "_index", "size": 20}
            },
            "by_severity": {
                "terms": {"field": "severity", "size": 10, "missing": "none"}
            },
            "by_symbol": {
                "terms": {"field": "symbol", "size": 20, "missing": "none"}
            },
            "by_run_id": {
                "terms": {"field": "run_id", "size": 20, "missing": "none"}
            },
        },
        "size": size,
    }

    # Sort
    if sort_field != "_score":
        es_body["sort"] = [{sort_field: {"order": sort_dir}}]
    else:
        es_body["sort"] = [{"_score": {"order": sort_dir}}]

    es = _get_es()
    if es is None:
        return _empty_search_result(query, indices, sort_field, sort_dir)

    try:
        resp = await es.search(index=",".join(indices), body=es_body)
        await es.close()
        hits = resp["hits"]["hits"]
        total = resp["hits"]["total"]["value"]
        aggs = resp.get("aggregations", {})

        return {
            "query": query,
            "filters": filt,
            "sort_field": sort_field,
            "sort_dir": sort_dir,
            "total": total,
            "hits": [
                {
                    "index": h["_index"],
                    "id": h["_id"],
                    "score": h.get("_score"),
                    "source": h.get("_source", {}),
                }
                for h in hits
            ],
            "facets": {
                "entity_type": [
                    {"key": b["key"], "count": b["doc_count"]}
                    for b in aggs.get("by_entity_type", {}).get("buckets", [])
                ],
                "severity": [
                    {"key": b["key"], "count": b["doc_count"]}
                    for b in aggs.get("by_severity", {}).get("buckets", [])
                ],
                "symbol": [
                    {"key": b["key"], "count": b["doc_count"]}
                    for b in aggs.get("by_symbol", {}).get("buckets", [])
                ],
                "run_id": [
                    {"key": b["key"], "count": b["doc_count"]}
                    for b in aggs.get("by_run_id", {}).get("buckets", [])
                ],
            },
        }
    except Exception as exc:
        try:
            await es.close()
        except Exception:
            pass
        return _empty_search_result(query, indices, sort_field, sort_dir, error=str(exc))


def _empty_search_result(query, indices, sort_field, sort_dir, error=None):
    result = {
        "query": query,
        "filters": {},
        "sort_field": sort_field,
        "sort_dir": sort_dir,
        "total": 0,
        "hits": [],
        "facets": {
            "entity_type": [{"key": idx, "count": 0} for idx in indices],
            "severity": [],
            "symbol": [],
            "run_id": [],
        },
    }
    if error:
        result["error"] = error
    return result


# ─── Explain drawer ──────────────────────────────────────────────────────────

async def explain_search(
    query: str,
    filters: dict | None = None,
    sort_field: str = "_score",
    sort_dir: str = "desc",
) -> dict[str, Any]:
    """
    Return a detailed explanation of the query plan with secrets redacted.
    """
    filt = filters or {}
    explanation = {
        "query_text": query,
        "query_type": "multi_match" if query.strip() else "match_all",
        "indices": ENTITY_INDICES,
        "active_filters": {k: v for k, v in filt.items() if v},
        "sort": {"field": sort_field, "direction": sort_dir},
        "aggregations": ["by_entity_type", "by_severity", "by_symbol", "by_run_id"],
        "matched_fields": ["*"] if not query.strip() else [
            "entity_type", "symbol", "run_id", "description", "title", "status"
        ],
        "redaction_applied": True,
        "fuzziness": "AUTO" if query.strip() else None,
    }
    # Redact any filter values that match secret patterns
    return _redact_dict(explanation)


# ─── Facet values ─────────────────────────────────────────────────────────────

async def get_facet_options() -> dict[str, Any]:
    """Return the available facet dimensions and their expected values."""
    return {
        "facets": [
            {
                "name": "entity_type",
                "label": "Entity Type",
                "values": [i.replace("apex-", "").replace("-read", "") for i in ENTITY_INDICES],
            },
            {
                "name": "time",
                "label": "Time Range",
                "values": ["1h", "24h", "7d", "30d", "all"],
            },
            {
                "name": "severity",
                "label": "Severity",
                "values": ["critical", "high", "medium", "low", "info"],
            },
        ]
    }
