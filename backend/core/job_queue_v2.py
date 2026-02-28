"""
W100 — Job Queue v2 + WebSocket Progress

Job state machine:
  queued -> running -> succeeded | failed
  queued | running -> canceled (idempotent)

WS channel: /api/v3/jobs/ws/{job_id} streams progress updates.
"""
from __future__ import annotations

import asyncio
import json
import os
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

VALID_STATUSES = {"queued", "running", "succeeded", "failed", "canceled"}
JOB_TYPES = {"backtest", "search_index", "data_export", "report_gen", "model_train"}


# ─── SQLite ─────────────────────────────────────────────────────────────────

async def ensure_job_tables() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id           TEXT PRIMARY KEY,
                name         TEXT,
                job_type     TEXT,
                status       TEXT DEFAULT 'queued',
                progress     REAL DEFAULT 0.0,
                params       TEXT DEFAULT '{}',
                result       TEXT,
                error_msg    TEXT,
                created_at   TEXT,
                started_at   TEXT,
                completed_at TEXT,
                canceled_at  TEXT
            )
        """)
        await db.commit()


# ─── State machine transitions ────────────────────────────────────────────────

ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "queued":    ["running", "canceled"],
    "running":   ["succeeded", "failed", "canceled"],
    "succeeded": [],
    "failed":    [],
    "canceled":  [],
}


async def _update_status(job_id: str, new_status: str, **kwargs: Any) -> dict[str, Any]:
    """Apply a state transition. Raises ValueError if invalid."""
    await ensure_job_tables()
    job = await get_job(job_id)
    if job is None:
        raise ValueError(f"Job not found: {job_id}")

    current = job["status"]
    if new_status not in ALLOWED_TRANSITIONS.get(current, []):
        raise ValueError(f"Invalid transition: {current} -> {new_status}")

    now = datetime.now(tz=timezone.utc).isoformat()
    updates: dict[str, Any] = {"status": new_status}
    if new_status == "running":
        updates["started_at"] = now
    elif new_status in ("succeeded", "failed"):
        updates["completed_at"] = now
    elif new_status == "canceled":
        updates["canceled_at"] = now

    updates.update(kwargs)
    cols = ", ".join(f"{k}=?" for k in updates)
    vals = list(updates.values()) + [job_id]

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE jobs SET {cols} WHERE id=?", vals)
        await db.commit()

    return await get_job(job_id)


async def create_job(name: str, job_type: str, params: dict | None = None) -> dict[str, Any]:
    await ensure_job_tables()
    if not name:
        raise ValueError("name is required")
    if job_type not in JOB_TYPES:
        raise ValueError(f"Unknown job_type: {job_type}. Valid: {sorted(JOB_TYPES)}")

    jid = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc).isoformat()
    params_json = json.dumps(params or {})

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO jobs (id, name, job_type, status, progress, params, created_at) VALUES (?,?,?,?,?,?,?)",
            (jid, name, job_type, "queued", 0.0, params_json, now),
        )
        await db.commit()

    # Index to ES
    if AsyncElasticsearch is not None:
        es = None
        try:
            es = AsyncElasticsearch(ES_HOST)
            await es.index(
                index="apex-jobs-write",
                id=jid,
                body={"id": jid, "name": name, "job_type": job_type, "status": "queued", "created_at": now},
            )
        except Exception:
            pass
        finally:
            if es:
                try:
                    await es.close()
                except Exception:
                    pass

    return await get_job(jid)


async def get_job(job_id: str) -> dict[str, Any] | None:
    await ensure_job_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM jobs WHERE id=?", (job_id,))
        row = await cur.fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "job_type": row["job_type"],
        "status": row["status"],
        "progress": row["progress"],
        "params": json.loads(row["params"] or "{}"),
        "result": row["result"],
        "error_msg": row["error_msg"],
        "created_at": row["created_at"],
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
        "canceled_at": row["canceled_at"],
    }


async def list_jobs(status_filter: str | None = None) -> list[dict[str, Any]]:
    await ensure_job_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if status_filter:
            cur = await db.execute("SELECT * FROM jobs WHERE status=? ORDER BY created_at DESC", (status_filter,))
        else:
            cur = await db.execute("SELECT * FROM jobs ORDER BY created_at DESC")
        rows = await cur.fetchall()

    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "name": row["name"],
            "job_type": row["job_type"],
            "status": row["status"],
            "progress": row["progress"],
            "created_at": row["created_at"],
            "started_at": row["started_at"],
            "completed_at": row["completed_at"],
            "canceled_at": row["canceled_at"],
        })
    return results


async def start_job(job_id: str) -> dict[str, Any]:
    """queued → running"""
    return await _update_status(job_id, "running")


async def complete_job(job_id: str, result: str = "ok") -> dict[str, Any]:
    """running → succeeded"""
    return await _update_status(job_id, "succeeded", progress=100.0, result=result)


async def fail_job(job_id: str, error: str = "error") -> dict[str, Any]:
    """running → failed"""
    return await _update_status(job_id, "failed", error_msg=error)


async def cancel_job(job_id: str) -> dict[str, Any]:
    """Idempotent cancel: queued/running → canceled. Already canceled/succeeded/failed → no-op."""
    job = await get_job(job_id)
    if job is None:
        raise ValueError(f"Job not found: {job_id}")
    if job["status"] in ("canceled", "succeeded", "failed"):
        return job  # idempotent
    return await _update_status(job_id, "canceled")


async def update_progress(job_id: str, progress: float) -> dict[str, Any]:
    """Update progress (0–100) for a running job."""
    await ensure_job_tables()
    progress = max(0.0, min(100.0, progress))
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE jobs SET progress=? WHERE id=?", (progress, job_id))
        await db.commit()
    return await get_job(job_id)


async def clear_jobs() -> dict[str, Any]:
    await ensure_job_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM jobs")
        await db.commit()
    return {"ok": True, "deleted": cur.rowcount}


async def simulate_job_run(job_id: str, steps: int = 5) -> None:
    """Background coroutine: start → update progress → complete."""
    try:
        await start_job(job_id)
        for i in range(1, steps + 1):
            await asyncio.sleep(0.1)
            job = await get_job(job_id)
            if job is None or job["status"] == "canceled":
                return
            await update_progress(job_id, i * 100 / steps)
        job = await get_job(job_id)
        if job and job["status"] == "running":
            await complete_job(job_id, result="simulation_complete")
    except Exception as exc:
        try:
            await fail_job(job_id, str(exc))
        except Exception:
            pass


def get_job_type_list() -> list[str]:
    return sorted(JOB_TYPES)
