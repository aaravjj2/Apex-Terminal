"""W103 — UI Page Registry backend.
Tracks registered UI2 core pages, their routes, and PageShell status.
Provides an API surface for pytest integration tests.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

import aiosqlite
from elasticsearch import AsyncElasticsearch

DB_PATH = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db").replace(
    "sqlite+aiosqlite:///", ""
)

# ─── Registry definition (frozen) ────────────────────────────────────────────

PAGE_REGISTRY_VERSION = "w103-v1.0"

REGISTERED_PAGES: list[dict[str, Any]] = [
    {"id": "search",            "path": "/ui2/search",             "title": "Search",            "group": "core", "status": "ready", "shell_version": "w103"},
    {"id": "backtest",          "path": "/ui2/backtest",           "title": "Backtest",          "group": "core", "status": "ready", "shell_version": "w103"},
    {"id": "strategy-optimizer","path": "/ui2/strategy-optimizer", "title": "Strategy Optimizer","group": "core", "status": "ready", "shell_version": "w103"},
    {"id": "job-queue",         "path": "/ui2/job-queue",          "title": "Job Queue v2",      "group": "core", "status": "ready", "shell_version": "w103"},
    {"id": "agent",             "path": "/ui2/agent",              "title": "AI Agent",          "group": "core", "status": "ready", "shell_version": "w103"},
    {"id": "ops",               "path": "/ui2/ops",                "title": "Ops",               "group": "core", "status": "ready", "shell_version": "w103"},
    {"id": "auditor",           "path": "/ui2/auditor",            "title": "Auditor",           "group": "core", "status": "ready", "shell_version": "w103"},
]

SHELL_STATES = ["loading", "ready", "empty", "error"]

COMPONENTS = [
    {"id": "PageShellUI2", "type": "wrapper", "states": SHELL_STATES, "version": "w103"},
    {"id": "DataTableUI2", "type": "data-table", "features": ["toolbar", "search", "export", "virtualization", "sort", "column-filter"], "version": "w103"},
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _determinism_hash() -> str:
    """Deterministic snapshot hash of the page registry."""
    payload = json.dumps(REGISTERED_PAGES, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

# ─── DB setup ────────────────────────────────────────────────────────────────

async def _ensure_tables(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS page_registry_snapshots (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            version     TEXT NOT NULL,
            page_count  INTEGER NOT NULL,
            hash        TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at  TEXT NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS page_heartbeats (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            page_id     TEXT NOT NULL,
            status      TEXT NOT NULL,
            session_id  TEXT,
            recorded_at TEXT NOT NULL
        )
    """)
    await db.commit()

# ─── Public API ───────────────────────────────────────────────────────────────

def get_registry() -> dict[str, Any]:
    """Return the full page registry (deterministic)."""
    return {
        "version": PAGE_REGISTRY_VERSION,
        "hash": _determinism_hash(),
        "page_count": len(REGISTERED_PAGES),
        "pages": REGISTERED_PAGES,
        "components": COMPONENTS,
    }


def get_page(page_id: str) -> dict[str, Any] | None:
    """Return a single page by id."""
    for p in REGISTERED_PAGES:
        if p["id"] == page_id:
            return p
    return None


def get_pages_by_group(group: str) -> list[dict[str, Any]]:
    return [p for p in REGISTERED_PAGES if p["group"] == group]


def get_component(component_id: str) -> dict[str, Any] | None:
    for c in COMPONENTS:
        if c["id"] == component_id:
            return c
    return None


async def save_snapshot() -> dict[str, Any]:
    """Persist the current registry snapshot to DB + ES."""
    registry = get_registry()
    async with aiosqlite.connect(DB_PATH) as db:
        await _ensure_tables(db)
        cursor = await db.execute(
            "INSERT INTO page_registry_snapshots (version, page_count, hash, snapshot_json, created_at) VALUES (?,?,?,?,?)",
            (registry["version"], registry["page_count"], registry["hash"], json.dumps(registry), _now()),
        )
        await db.commit()
        snapshot_id = cursor.lastrowid

    # ES indexing (non-fatal)
    try:
        es = AsyncElasticsearch("http://localhost:9200")
        await es.index(
            index="apex-events-write",
            body={"type": "page_registry_snapshot", "snapshot_id": snapshot_id, **registry, "created_at": _now()},
        )
        await es.close()
    except Exception:
        pass

    return {"snapshot_id": snapshot_id, **registry}


async def record_heartbeat(page_id: str, status: str, session_id: str | None = None) -> dict[str, Any]:
    """Record a page heartbeat."""
    async with aiosqlite.connect(DB_PATH) as db:
        await _ensure_tables(db)
        cursor = await db.execute(
            "INSERT INTO page_heartbeats (page_id, status, session_id, recorded_at) VALUES (?,?,?,?)",
            (page_id, status, session_id, _now()),
        )
        await db.commit()
        hb_id = cursor.lastrowid
    return {"heartbeat_id": hb_id, "page_id": page_id, "status": status, "recorded_at": _now()}


async def list_heartbeats(page_id: str | None = None) -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        await _ensure_tables(db)
        if page_id:
            async with db.execute("SELECT * FROM page_heartbeats WHERE page_id=? ORDER BY id DESC LIMIT 50", (page_id,)) as c:
                rows = await c.fetchall()
                desc = [d[0] for d in c.description]
        else:
            async with db.execute("SELECT * FROM page_heartbeats ORDER BY id DESC LIMIT 200") as c:
                rows = await c.fetchall()
                desc = [d[0] for d in c.description]
    return [dict(zip(desc, row)) for row in rows]


async def clear_heartbeats() -> dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        await _ensure_tables(db)
        await db.execute("DELETE FROM page_heartbeats")
        await db.execute("DELETE FROM page_registry_snapshots")
        await db.commit()
    return {"cleared": True}
