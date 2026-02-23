"""
backend/core/bulk_ingest.py — W92

Bulk ingest pipeline with DLQ persistence and lag metrics.
- BulkIngester: batches records and sends to ES via _bulk API with retry/backoff
- DLQ: failed records persisted to SQLite dlq_entries table
- Lag metrics: DLQ count + ES count per entity type
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite
import httpx

from .es_templates import ENTITY_TYPES, write_alias

# ── Config ────────────────────────────────────────────────────────────────────

def _es_url() -> str:
    return os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")


def _db_path() -> str:
    url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
    if "sqlite" in url.lower():
        # sqlite+aiosqlite:///./path → ./path
        return url.split("///")[-1]
    return "./test_phase1.db"


_CREATE_DLQ = """
CREATE TABLE IF NOT EXISTS dlq_entries (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL,
    last_attempt_at TEXT,
    retry_count INTEGER DEFAULT 0,
    drained_at TEXT
)
"""

_CREATE_INGEST_LOG = """
CREATE TABLE IF NOT EXISTS ingest_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    record_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
)
"""


def _ts() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _get_conn() -> aiosqlite.Connection:
    """
    Return an open aiosqlite connection to the app database.
    Caller is responsible for closing.
    """
    db_path = _db_path()
    conn = await aiosqlite.connect(db_path)
    conn.row_factory = aiosqlite.Row
    return conn


async def ensure_dlq_tables() -> None:
    """Create DLQ and ingest_log tables if they don't exist."""
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute(_CREATE_DLQ)
        await db.execute(_CREATE_INGEST_LOG)
        await db.commit()


# ── ES bulk helpers ────────────────────────────────────────────────────────────

def _build_bulk_body(entity: str, records: List[Dict]) -> str:
    """Build the NDJSON body for ES _bulk index request."""
    alias = write_alias(entity)
    lines = []
    for rec in records:
        doc_id = rec.get("id") or str(uuid.uuid4())
        lines.append(json.dumps({"index": {"_index": alias, "_id": doc_id}}))
        lines.append(json.dumps(rec))
    return "\n".join(lines) + "\n"


async def _es_bulk(entity: str, records: List[Dict], timeout: float = 30.0) -> Dict:
    """
    Send records to ES via _bulk API.
    Returns {"ok": bool, "took": int, "errors": bool, "items_count": int, "error": Optional[str]}
    """
    body = _build_bulk_body(entity, records)
    url = f"{_es_url()}/_bulk"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                url,
                content=body,
                headers={"Content-Type": "application/x-ndjson"},
            )
        if resp.status_code in (200, 201):
            data = resp.json()
            has_errors = data.get("errors", False)
            return {
                "ok": not has_errors,
                "took": data.get("took", 0),
                "errors": has_errors,
                "items_count": len(data.get("items", [])),
                "error": None,
            }
        return {
            "ok": False,
            "took": 0,
            "errors": True,
            "items_count": 0,
            "error": f"ES returned {resp.status_code}: {resp.text[:200]}",
        }
    except Exception as exc:
        return {
            "ok": False,
            "took": 0,
            "errors": True,
            "items_count": 0,
            "error": str(exc)[:200],
        }


# ── Bulk ingest with retry + DLQ ──────────────────────────────────────────────

async def bulk_ingest(
    entity: str,
    records: List[Dict],
    max_retries: int = 3,
    backoff_base: float = 0.5,
) -> Dict:
    """
    Ingest records for entity into ES with retry/backoff.
    On persistent failure: save batch to DLQ.

    Returns:
        {
            "entity": str,
            "records_attempted": int,
            "ok": bool,
            "dlq_added": int,
            "retries": int,
            "error": Optional[str],
        }
    """
    if not records:
        return {"entity": entity, "records_attempted": 0, "ok": True, "dlq_added": 0, "retries": 0, "error": None}

    await ensure_dlq_tables()

    last_error: Optional[str] = None
    for attempt in range(max_retries):
        result = await _es_bulk(entity, records)
        if result["ok"]:
            # Log success
            async with aiosqlite.connect(_db_path()) as db:
                await db.execute(
                    "INSERT INTO ingest_log (id, entity_type, record_count, status, created_at) VALUES (?,?,?,?,?)",
                    (str(uuid.uuid4()), entity, len(records), "ok", _ts()),
                )
                await db.commit()
            return {
                "entity": entity,
                "records_attempted": len(records),
                "ok": True,
                "dlq_added": 0,
                "retries": attempt,
                "error": None,
            }
        last_error = result["error"]
        if attempt < max_retries - 1:
            await asyncio.sleep(backoff_base * (2 ** attempt))

    # All retries exhausted → save to DLQ
    dlq_id = str(uuid.uuid4())
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute(
            """INSERT INTO dlq_entries (id, entity_type, payload, error, created_at, retry_count)
               VALUES (?,?,?,?,?,?)""",
            (dlq_id, entity, json.dumps(records), last_error, _ts(), max_retries),
        )
        await db.execute(
            "INSERT INTO ingest_log (id, entity_type, record_count, status, error, created_at) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), entity, len(records), "failed", last_error, _ts()),
        )
        await db.commit()

    return {
        "entity": entity,
        "records_attempted": len(records),
        "ok": False,
        "dlq_added": 1,
        "retries": max_retries,
        "error": last_error,
    }


# ── DLQ drain ─────────────────────────────────────────────────────────────────

async def drain_dlq(entity: Optional[str] = None) -> Dict:
    """
    Re-attempt all undrained DLQ entries (optionally filtered by entity).

    Returns:
        {
            "drained": int,
            "failed": int,
            "total": int,
            "entity": Optional[str],
        }
    """
    await ensure_dlq_tables()

    query = "SELECT * FROM dlq_entries WHERE drained_at IS NULL"
    params: tuple = ()
    if entity:
        query += " AND entity_type = ?"
        params = (entity,)

    drained = 0
    failed = 0
    total = 0

    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

        total = len(rows)
        for row in rows:
            records = json.loads(row["payload"])
            ent = row["entity_type"]
            result = await _es_bulk(ent, records, timeout=30.0)
            if result["ok"]:
                await db.execute(
                    "UPDATE dlq_entries SET drained_at = ?, last_attempt_at = ? WHERE id = ?",
                    (_ts(), _ts(), row["id"]),
                )
                drained += 1
            else:
                await db.execute(
                    "UPDATE dlq_entries SET retry_count = retry_count + 1, last_attempt_at = ? WHERE id = ?",
                    (_ts(), row["id"]),
                )
                failed += 1

        await db.commit()

    return {
        "drained": drained,
        "failed": failed,
        "total": total,
        "entity": entity,
    }


# ── DLQ stats ─────────────────────────────────────────────────────────────────

async def get_dlq_stats() -> List[Dict]:
    """Return DLQ statistics per entity type."""
    await ensure_dlq_tables()

    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        results = []
        for ent in ENTITY_TYPES:
            async with db.execute(
                "SELECT COUNT(*) as pending FROM dlq_entries WHERE entity_type = ? AND drained_at IS NULL",
                (ent,),
            ) as cur:
                row = await cur.fetchone()
                pending = row["pending"] if row else 0

            async with db.execute(
                "SELECT COUNT(*) as total FROM dlq_entries WHERE entity_type = ?",
                (ent,),
            ) as cur:
                row = await cur.fetchone()
                total = row["total"] if row else 0

            results.append({
                "entity": ent,
                "pending": pending,
                "total": total,
                "drained": total - pending,
            })
    return results


# ── Lag metrics ────────────────────────────────────────────────────────────────

async def _es_count(entity: str) -> int:
    """Get ES document count for entity via read alias."""
    alias = write_alias(entity).replace("-write", "-read")
    url = f"{_es_url()}/{alias}/_count"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            return resp.json().get("count", 0)
        return 0
    except Exception:
        return 0


async def get_lag_metrics() -> List[Dict]:
    """
    Return lag metrics per entity type.
    Lag = pending DLQ count (items not yet successfully indexed in ES).
    Also includes ES document count for comparison.
    """
    await ensure_dlq_tables()

    # Parallel: fetch DLQ stats + ES counts
    dlq_stats, *es_counts = await asyncio.gather(
        get_dlq_stats(),
        *[_es_count(e) for e in ENTITY_TYPES],
    )

    dlq_map = {s["entity"]: s for s in dlq_stats}

    metrics = []
    for i, entity in enumerate(ENTITY_TYPES):
        dlq = dlq_map.get(entity, {"pending": 0, "total": 0, "drained": 0})
        es_count = es_counts[i]
        metrics.append({
            "entity": entity,
            "dlq_pending": dlq["pending"],
            "dlq_total": dlq["total"],
            "dlq_drained": dlq["drained"],
            "es_count": es_count,
            "lag": dlq["pending"],  # lag = undrained DLQ items
        })

    return metrics
