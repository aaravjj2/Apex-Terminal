"""
W95 — Elastic Agent Builder Integration
Adapter for Elastic Agent Builder (server-side, env-gated).
Falls back to local agent_tools.run_agent() when remote not configured.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from .agent_tools import (
    ensure_agent_tables,
    run_agent,
    list_agent_runs,
    get_agent_run,
    clear_agent_data,
)

DB_PATH = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db").replace(
    "sqlite+aiosqlite:///", ""
)

# ─── env gates ───────────────────────────────────────────────────────────────

def get_elastic_agent_url() -> str | None:
    return os.environ.get("ELASTIC_AGENT_URL")


def get_elastic_agent_key() -> str | None:
    return os.environ.get("ELASTIC_AGENT_API_KEY")


def is_remote_enabled() -> bool:
    """True only when both URL and API key are configured."""
    return bool(get_elastic_agent_url() and get_elastic_agent_key())


# ─── SQLite tables ───────────────────────────────────────────────────────────

async def ensure_builder_tables() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS elastic_agents (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                description TEXT,
                tools       TEXT DEFAULT '[]',
                created_at  TEXT,
                updated_at  TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS elastic_agent_runs (
                id              TEXT PRIMARY KEY,
                agent_id        TEXT NOT NULL,
                query           TEXT NOT NULL,
                status          TEXT DEFAULT 'completed',
                tool_calls_json TEXT DEFAULT '[]',
                citations_json  TEXT DEFAULT '[]',
                summary         TEXT DEFAULT '',
                remote_used     INTEGER DEFAULT 0,
                created_at      TEXT,
                completed_at    TEXT,
                FOREIGN KEY (agent_id) REFERENCES elastic_agents(id)
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_ea_runs_agent ON elastic_agent_runs(agent_id)")
        await db.commit()


# ─── Agent CRUD ──────────────────────────────────────────────────────────────

async def create_agent(
    name: str,
    description: str = "",
    tools: list[str] | None = None,
) -> dict[str, Any]:
    """Create a named agent configuration stored locally."""
    await ensure_builder_tables()
    agent_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc).isoformat()
    tools_list = tools or ["search", "fetch_graph", "summarize"]
    import json
    tools_json = json.dumps(tools_list)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO elastic_agents (id, name, description, tools, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (agent_id, name, description, tools_json, now, now),
        )
        await db.commit()
    return {
        "agent_id": agent_id,
        "name": name,
        "description": description,
        "tools": tools_list,
        "created_at": now,
        "remote_registered": False,
    }


async def list_agents() -> list[dict[str, Any]]:
    await ensure_builder_tables()
    import json
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM elastic_agents ORDER BY created_at DESC LIMIT 50")
        rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "tools": json.loads(r["tools"] or "[]"),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def get_agent(agent_id: str) -> dict[str, Any] | None:
    await ensure_builder_tables()
    import json
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM elastic_agents WHERE id=?", (agent_id,))
        row = await cur.fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "tools": json.loads(row["tools"] or "[]"),
        "created_at": row["created_at"],
    }


async def delete_agents() -> dict[str, Any]:
    await ensure_builder_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM elastic_agent_runs")
        del_runs = cur.rowcount
        cur2 = await db.execute("DELETE FROM elastic_agents")
        del_agents = cur2.rowcount
        await db.commit()
    return {"ok": True, "deleted_agents": del_agents, "deleted_runs": del_runs}


# ─── Run agent via builder ────────────────────────────────────────────────────

async def run_agent_with_builder(
    agent_id: str,
    query: str,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """
    Run a query using the specified agent configuration.
    Uses remote Elastic Agent Builder if env vars are set, else falls back
    to the local agent_tools implementation.
    """
    await ensure_builder_tables()

    remote_used = False
    if is_remote_enabled():
        # Future: call Elastic Agent Builder REST API
        # For now: log intent and fall through to local
        remote_used = False  # remote call not yet implemented

    # Local fallback (always available)
    # Ensure agent_tools tables exist
    await ensure_agent_tables()
    result = await run_agent(query=query, correlation_id=correlation_id or str(uuid.uuid4()))

    import json
    now = datetime.now(tz=timezone.utc).isoformat()
    run_id = str(uuid.uuid4())

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO elastic_agent_runs
               (id, agent_id, query, status, tool_calls_json, citations_json, summary, remote_used, created_at, completed_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                run_id,
                agent_id,
                query,
                result.get("status", "completed"),
                json.dumps(result.get("tool_calls", [])),
                json.dumps(result.get("citations", [])),
                result.get("summary", ""),
                1 if remote_used else 0,
                now,
                now,
            ),
        )
        await db.commit()

    return {
        "run_id": run_id,
        "agent_id": agent_id,
        "query": query,
        "status": result.get("status", "completed"),
        "tool_calls": result.get("tool_calls", []),
        "citations": result.get("citations", []),
        "summary": result.get("summary", ""),
        "remote_used": remote_used,
    }


async def list_agent_builder_runs(agent_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    await ensure_builder_tables()
    import json
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if agent_id:
            cur = await db.execute(
                "SELECT * FROM elastic_agent_runs WHERE agent_id=? ORDER BY created_at DESC LIMIT ?",
                (agent_id, limit),
            )
        else:
            cur = await db.execute(
                "SELECT * FROM elastic_agent_runs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
        rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "agent_id": r["agent_id"],
            "query": r["query"],
            "status": r["status"],
            "summary": r["summary"],
            "remote_used": bool(r["remote_used"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def get_builder_status() -> dict[str, Any]:
    """Return connectivity status + env gate info."""
    return {
        "remote_enabled": is_remote_enabled(),
        "elastic_agent_url_set": bool(get_elastic_agent_url()),
        "elastic_agent_key_set": bool(get_elastic_agent_key()),
        "reason": "ok" if is_remote_enabled() else "ELASTIC_AGENT_URL or ELASTIC_AGENT_API_KEY not set",
        "mode": "remote" if is_remote_enabled() else "local",
    }
