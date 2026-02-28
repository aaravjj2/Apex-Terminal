"""
backend/core/agent_tools.py — W94

Strict agent tool framework with full audit trail.
Every tool call is logged to SQLite; secrets are redacted before persistence.

Tools available:
  - search(query, entity_type=None, size=10)
  - fetch_entity(entity_type, entity_id)
  - fetch_graph(root_type, root_id)
  - summarize(text, max_len=500)
  - create_ticket(title, description, entity_type=None, entity_id=None)

Agent orchestration:
  - run_agent(query) → creates an agent run, calls tools, persists traces
"""
from __future__ import annotations

import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import aiosqlite
import httpx

from .evidence_graph import get_graph

# ── Config ────────────────────────────────────────────────────────────────────

def _es_url() -> str:
    return os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")


def _db_path() -> str:
    url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
    if "sqlite" in url.lower():
        return url.split("///")[-1]
    return "./test_phase1.db"


ENTITY_TYPES = ["events", "strategies", "backtests", "workflows", "jobs", "tickets", "edges"]

# Fields whose VALUES must be redacted (secrets)
_SECRET_KEYS = re.compile(
    r"(api[_-]?key|password|secret|token|auth|credential|private[_-]?key)",
    re.IGNORECASE,
)


# ── Schema ────────────────────────────────────────────────────────────────────

_CREATE_RUNS = """
CREATE TABLE IF NOT EXISTS agent_runs (
    id              TEXT PRIMARY KEY,
    correlation_id  TEXT,
    query           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    result_summary  TEXT,
    citations       TEXT DEFAULT '[]',
    created_at      TEXT NOT NULL,
    completed_at    TEXT
);
"""

_CREATE_TRACES = """
CREATE TABLE IF NOT EXISTS tool_traces (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL,
    tool_name   TEXT NOT NULL,
    args        TEXT DEFAULT '{}',
    result      TEXT DEFAULT '{}',
    error       TEXT,
    duration_ms INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL
);
"""

_IDX_TRACES = "CREATE INDEX IF NOT EXISTS idx_tt_run ON tool_traces(run_id);"


async def ensure_agent_tables() -> None:
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute(_CREATE_RUNS)
        await db.execute(_CREATE_TRACES)
        await db.execute(_IDX_TRACES)
        await db.commit()


# ── Secrets redaction ─────────────────────────────────────────────────────────

def _redact(obj: Any) -> Any:
    """Recursively redact secret-looking values in dicts / lists."""
    if isinstance(obj, dict):
        return {
            k: "[REDACTED]" if _SECRET_KEYS.search(str(k)) else _redact(v)
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_redact(item) for item in obj]
    return obj


# ── Tool implementations ──────────────────────────────────────────────────────

async def _tool_search(
    query: str,
    entity_type: Optional[str] = None,
    size: int = 10,
) -> Dict:
    """
    Search the ES multi-index.
    Returns {hits: [...], total, entity_type or 'all'}.
    """
    if entity_type and entity_type in ENTITY_TYPES:
        index = f"apex-{entity_type}-read"
    else:
        index = ",".join(f"apex-{e}-read" for e in ENTITY_TYPES)

    payload = {
        "query": {
            "multi_match": {
                "query": query,
                "fields": ["*"],
                "type": "best_fields",
                "fuzziness": "AUTO",
            }
        },
        "size": size,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(f"{_es_url()}/{index}/_search", json=payload)
            if r.status_code == 200:
                data = r.json()
                hits = data.get("hits", {}).get("hits", [])
                total = data.get("hits", {}).get("total", {}).get("value", 0)
                return {
                    "hits": [
                        {
                            "_index": h.get("_index"),
                            "_id": h.get("_id"),
                            "_score": h.get("_score"),
                            "_source": h.get("_source", {}),
                        }
                        for h in hits
                    ],
                    "total": total,
                    "searched_index": index,
                }
            return {"hits": [], "total": 0, "error": f"HTTP {r.status_code}"}
    except Exception as exc:
        return {"hits": [], "total": 0, "error": str(exc)}


async def _tool_fetch_entity(entity_type: str, entity_id: str) -> Dict:
    """Fetch a single entity document from ES."""
    index = f"apex-{entity_type}-read"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{_es_url()}/{index}/_doc/{entity_id}")
            if r.status_code == 200:
                doc = r.json()
                return {"found": True, "entity_type": entity_type, "entity_id": entity_id, "source": doc.get("_source", {})}
            return {"found": False, "entity_type": entity_type, "entity_id": entity_id, "status": r.status_code}
    except Exception as exc:
        return {"found": False, "error": str(exc)}


async def _tool_fetch_graph(root_type: str, root_id: str) -> Dict:
    """Fetch subgraph from evidence graph layer."""
    try:
        return await get_graph(root_type=root_type, root_id=root_id, max_depth=3)
    except Exception as exc:
        return {"error": str(exc), "nodes": [], "edges": [], "node_count": 0, "edge_count": 0}


def _tool_summarize(text: str, max_len: int = 500) -> Dict:
    """Simple text summarize: truncate + strip secrets."""
    cleaned = str(text)[:max_len * 2]
    # Strip any secret-like patterns from inline text
    cleaned = re.sub(r'(?i)(api[_-]?key|password|secret|token)["\s:=]+\S+', r'\1=[REDACTED]', cleaned)
    truncated = cleaned[:max_len]
    return {"summary": truncated, "original_length": len(str(text)), "truncated": len(str(text)) > max_len}


async def _tool_create_ticket(
    title: str,
    description: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Dict:
    """
    Create a simple ticket record.
    Indexes to ES (apex-tickets-write) for a real side-effect.
    Returns {ok, ticket_id, title}.
    """
    ticket_id = f"ticket-{uuid.uuid4().hex[:12]}"
    doc = {
        "id": ticket_id,
        "title": title,
        "description": description,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{_es_url()}/apex-tickets-write/_doc/{ticket_id}",
                json=doc,
            )
            ok = r.status_code in (200, 201)
    except Exception:
        ok = False
    return {"ok": ok, "ticket_id": ticket_id, "title": title}


# ── Trace persistence ─────────────────────────────────────────────────────────

async def _log_trace(
    db: aiosqlite.Connection,
    run_id: str,
    tool_name: str,
    args: Dict,
    result: Any,
    error: Optional[str],
    duration_ms: int,
) -> str:
    trace_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    safe_args = _redact(args)
    safe_result = _redact(result) if isinstance(result, (dict, list)) else result
    await db.execute(
        """
        INSERT INTO tool_traces(id, run_id, tool_name, args, result, error, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            trace_id,
            run_id,
            tool_name,
            json.dumps(safe_args),
            json.dumps(safe_result) if isinstance(safe_result, (dict, list)) else str(safe_result),
            error,
            duration_ms,
            now,
        ),
    )
    return trace_id


# ── Agent orchestration ───────────────────────────────────────────────────────

async def run_agent(
    query: str,
    correlation_id: Optional[str] = None,
    tools: Optional[List[str]] = None,
) -> Dict:
    """
    Execute an agent run with the given query.
    Runs tools in order: search → fetch_graph (top hit) → summarize.
    All tool calls are logged to SQLite as tool_traces.
    Returns {run_id, status, tool_calls, citations, summary}.
    """
    await ensure_agent_tables()

    run_id = str(uuid.uuid4())
    corr_id = correlation_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    available_tools = tools or ["search", "fetch_graph", "summarize"]
    citations: List[Dict] = []
    summary = ""

    async with aiosqlite.connect(_db_path()) as db:
        # Create run record
        await db.execute(
            """
            INSERT INTO agent_runs(id, correlation_id, query, status, created_at)
            VALUES (?, ?, ?, 'running', ?)
            """,
            (run_id, corr_id, query, now),
        )
        await db.commit()

        tool_calls: List[Dict] = []

        # Tool 1: search
        if "search" in available_tools:
            t0 = time.monotonic()
            search_result = await _tool_search(query)
            ms = int((time.monotonic() - t0) * 1000)
            trace_id = await _log_trace(db, run_id, "search", {"query": query}, search_result, None, ms)
            tool_calls.append({"tool": "search", "trace_id": trace_id, "ms": ms})

            # Extract citations from search hits
            for hit in search_result.get("hits", [])[:3]:
                src = hit.get("_source", {})
                entity_ref: Dict[str, Any] = {
                    "index": hit.get("_index", ""),
                    "id": hit.get("_id", ""),
                    "score": hit.get("_score", 0),
                }
                if "id" in src:
                    entity_ref["entity_id"] = src["id"]
                citations.append(entity_ref)

        # Tool 2: fetch_graph (on first citation if any)
        if "fetch_graph" in available_tools and citations:
            first = citations[0]
            idx = first.get("index", "")
            root_type = idx.replace("apex-", "").replace("-read", "").replace("-write", "") if idx else "strategies"
            root_id = first.get("entity_id") or first.get("id", "unknown")
            t0 = time.monotonic()
            graph_result = await _tool_fetch_graph(root_type, root_id)
            ms = int((time.monotonic() - t0) * 1000)
            trace_id = await _log_trace(db, run_id, "fetch_graph", {"root_type": root_type, "root_id": root_id}, graph_result, None, ms)
            tool_calls.append({"tool": "fetch_graph", "trace_id": trace_id, "ms": ms})

        # Tool 3: summarize
        if "summarize" in available_tools:
            text = json.dumps({"query": query, "citations": len(citations), "tool_calls": len(tool_calls)})
            t0 = time.monotonic()
            sum_result = _tool_summarize(text)
            ms = int((time.monotonic() - t0) * 1000)
            trace_id = await _log_trace(db, run_id, "summarize", {"text_length": len(text)}, sum_result, None, ms)
            tool_calls.append({"tool": "summarize", "trace_id": trace_id, "ms": ms})
            summary = sum_result.get("summary", "")

        await db.commit()

        # Finalize run
        completed_at = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """
            UPDATE agent_runs SET status='completed', result_summary=?, citations=?, completed_at=?
            WHERE id=?
            """,
            (summary, json.dumps(citations), completed_at, run_id),
        )
        await db.commit()

    return {
        "run_id": run_id,
        "correlation_id": corr_id,
        "status": "completed",
        "query": query,
        "tool_calls": tool_calls,
        "citations": citations,
        "summary": summary,
    }


async def get_agent_run(run_id: str) -> Optional[Dict]:
    """Return an agent run with its tool traces."""
    await ensure_agent_tables()
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM agent_runs WHERE id=?", (run_id,)) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        async with db.execute(
            "SELECT * FROM tool_traces WHERE run_id=? ORDER BY created_at",
            (run_id,),
        ) as cur:
            trace_rows = await cur.fetchall()

    traces = [
        {
            "id": r["id"],
            "tool_name": r["tool_name"],
            "args": json.loads(r["args"] or "{}"),
            "result": json.loads(r["result"] or "{}"),
            "error": r["error"],
            "duration_ms": r["duration_ms"],
            "created_at": r["created_at"],
        }
        for r in trace_rows
    ]

    return {
        "id": row["id"],
        "correlation_id": row["correlation_id"],
        "query": row["query"],
        "status": row["status"],
        "result_summary": row["result_summary"],
        "citations": json.loads(row["citations"] or "[]"),
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
        "traces": traces,
    }


async def list_agent_runs(limit: int = 50) -> List[Dict]:
    """Return recent agent runs (no traces)."""
    await ensure_agent_tables()
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, correlation_id, query, status, created_at, completed_at FROM agent_runs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "correlation_id": r["correlation_id"],
            "query": r["query"],
            "status": r["status"],
            "created_at": r["created_at"],
            "completed_at": r["completed_at"],
        }
        for r in rows
    ]


async def get_tool_traces(run_id: str) -> List[Dict]:
    """Return all tool traces for a given run."""
    await ensure_agent_tables()
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM tool_traces WHERE run_id=? ORDER BY created_at",
            (run_id,),
        ) as cur:
            rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "run_id": r["run_id"],
            "tool_name": r["tool_name"],
            "args": json.loads(r["args"] or "{}"),
            "result": json.loads(r["result"] or "{}"),
            "error": r["error"],
            "duration_ms": r["duration_ms"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def clear_agent_data() -> None:
    """Delete all agent runs + traces (for tests)."""
    await ensure_agent_tables()
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute("DELETE FROM tool_traces")
        await db.execute("DELETE FROM agent_runs")
        await db.commit()
