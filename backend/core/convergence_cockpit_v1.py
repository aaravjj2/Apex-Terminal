"""
W101 — Convergence Cockpit v1 (TerraCode wow screen)

Single cockpit: search + evidence graph + agent trace + safe action.

3-pane data model:
  Left pane  — search results (keyword search across evidence)
  Center pane — evidence graph nodes (with edges)
  Right pane  — agent trace + citations + "create ticket"

Scenario presets run all three panes in one shot.
"""
from __future__ import annotations

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

# ─── Preset scenarios ─────────────────────────────────────────────────────────

SCENARIOS: list[dict[str, Any]] = [
    {
        "id": "scen-volatility",
        "name": "Market Volatility Scan",
        "description": "Scan for high-volatility signals across evidence and active strategies",
        "query": "volatility",
        "agent_task": "identify_volatility_clusters",
        "expected_actions": ["create_ticket", "flag_evidence"],
    },
    {
        "id": "scen-convergence",
        "name": "Strategy Convergence Check",
        "description": "Validate that active strategies converge on consistent signals",
        "query": "convergence",
        "agent_task": "check_strategy_alignment",
        "expected_actions": ["create_ticket", "run_backtest"],
    },
    {
        "id": "scen-agent-health",
        "name": "Agent Health Audit",
        "description": "Audit agent trace quality and citation coverage",
        "query": "agent",
        "agent_task": "audit_agent_citations",
        "expected_actions": ["create_ticket", "escalate"],
    },
    {
        "id": "scen-risk",
        "name": "Risk Convergence",
        "description": "Correlate risk signals across portfolio and market data",
        "query": "risk",
        "agent_task": "correlate_risk_signals",
        "expected_actions": ["create_ticket", "hedge"],
    },
]

SCENARIO_MAP = {s["id"]: s for s in SCENARIOS}


def _make_evidence_nodes(query: str, count: int = 4) -> list[dict[str, Any]]:
    """Synthetic evidence nodes for the center pane."""
    keywords = ["backtest", "signal", "risk", "alpha", "momentum", "mean-reversion"]
    nodes = []
    for i in range(count):
        nid = f"ev-{query[:4]}-{i+1:03d}"
        nodes.append({
            "id": nid,
            "label": f"{keywords[i % len(keywords)].title()} Evidence #{i+1}",
            "type": "evidence",
            "relevance": round(0.95 - i * 0.08, 2),
            "tags": [query, keywords[i % len(keywords)]],
        })
    # simple chain edges
    edges = []
    for i in range(len(nodes) - 1):
        edges.append({"from": nodes[i]["id"], "to": nodes[i + 1]["id"], "weight": 0.5})
    return nodes, edges  # type: ignore


def _make_agent_trace(task: str) -> dict[str, Any]:
    """Synthetic agent trace for the right pane."""
    steps = [
        {"step": 1, "action": "query_evidence_store", "duration_ms": 42},
        {"step": 2, "action": "rank_by_relevance", "duration_ms": 17},
        {"step": 3, "action": "extract_citations", "duration_ms": 31},
        {"step": 4, "action": task, "duration_ms": 88},
    ]
    citations = [
        {"id": f"cit-{task[:3]}-001", "source": "evidence_graph", "relevance": 0.91},
        {"id": f"cit-{task[:3]}-002", "source": "strategy_store", "relevance": 0.76},
        {"id": f"cit-{task[:3]}-003", "source": "backtest_runs", "relevance": 0.65},
    ]
    return {
        "task": task,
        "steps": steps,
        "citations": citations,
        "total_duration_ms": sum(s["duration_ms"] for s in steps),
        "confidence": 0.82,
    }


def _make_search_results(query: str, count: int = 5) -> list[dict[str, Any]]:
    """Synthetic search results for the left pane."""
    types = ["strategy", "evidence", "backtest", "signal", "alert"]
    return [
        {
            "id": f"sr-{query[:4]}-{i+1:03d}",
            "title": f"{query.title()} Result #{i+1}",
            "type": types[i % len(types)],
            "score": round(1.0 - i * 0.12, 2),
            "snippet": f"Found {query} in context #{i+1}",
        }
        for i in range(count)
    ]


# ─── Tables ───────────────────────────────────────────────────────────────────

async def ensure_cockpit_tables() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cockpit_sessions (
                id           TEXT PRIMARY KEY,
                scenario_id  TEXT,
                query        TEXT,
                search_json  TEXT,
                evidence_json TEXT,
                trace_json   TEXT,
                created_at   TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cockpit_tickets (
                id           TEXT PRIMARY KEY,
                title        TEXT,
                scenario_id  TEXT,
                session_id   TEXT,
                evidence_ids TEXT DEFAULT '[]',
                actions      TEXT DEFAULT '[]',
                status       TEXT DEFAULT 'open',
                created_at   TEXT
            )
        """)
        await db.commit()


# ─── Scenarios ────────────────────────────────────────────────────────────────

def list_scenarios() -> list[dict[str, Any]]:
    return SCENARIOS


def get_scenario(scenario_id: str) -> dict[str, Any] | None:
    return SCENARIO_MAP.get(scenario_id)


async def run_scenario(scenario_id: str) -> dict[str, Any]:
    scenario = get_scenario(scenario_id)
    if scenario is None:
        raise ValueError(f"Scenario not found: {scenario_id}")

    await ensure_cockpit_tables()
    session_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc).isoformat()

    query = scenario["query"]
    nodes, edges = _make_evidence_nodes(query)
    trace = _make_agent_trace(scenario["agent_task"])
    search_results = _make_search_results(query)

    result = {
        "session_id": session_id,
        "scenario_id": scenario_id,
        "scenario_name": scenario["name"],
        "left_pane": {"query": query, "results": search_results, "total": len(search_results)},
        "center_pane": {"nodes": nodes, "edges": edges, "node_count": len(nodes)},
        "right_pane": {
            "agent_trace": trace,
            "citations": trace["citations"],
            "suggested_actions": scenario["expected_actions"],
        },
        "created_at": now,
    }

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO cockpit_sessions (id, scenario_id, query, search_json, evidence_json, trace_json, created_at) VALUES (?,?,?,?,?,?,?)",
            (session_id, scenario_id, query, json.dumps(search_results), json.dumps({"nodes": nodes, "edges": edges}), json.dumps(trace), now),
        )
        await db.commit()

    # Index session to ES
    if AsyncElasticsearch is not None:
        es = None
        try:
            es = AsyncElasticsearch(ES_HOST)
            await es.index(
                index="apex-events-write",
                id=session_id,
                body={"id": session_id, "scenario_id": scenario_id, "query": query, "type": "cockpit_session", "created_at": now},
            )
        except Exception:
            pass
        finally:
            if es:
                try:
                    await es.close()
                except Exception:
                    pass

    return result


# ─── Tickets ─────────────────────────────────────────────────────────────────

async def create_ticket(
    title: str,
    scenario_id: str,
    session_id: str = "",
    evidence_ids: list[str] | None = None,
    actions: list[str] | None = None,
) -> dict[str, Any]:
    await ensure_cockpit_tables()

    if not title:
        raise ValueError("title is required")

    tid = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc).isoformat()
    ev_json = json.dumps(evidence_ids or [])
    act_json = json.dumps(actions or [])

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO cockpit_tickets (id, title, scenario_id, session_id, evidence_ids, actions, created_at) VALUES (?,?,?,?,?,?,?)",
            (tid, title, scenario_id, session_id, ev_json, act_json, now),
        )
        await db.commit()

    # Index ticket to ES so it's "searchable"
    if AsyncElasticsearch is not None:
        es = None
        try:
            es = AsyncElasticsearch(ES_HOST)
            await es.index(
                index="apex-tickets-write",
                id=tid,
                body={"id": tid, "title": title, "scenario_id": scenario_id, "status": "open", "type": "cockpit_ticket", "created_at": now},
            )
        except Exception:
            pass
        finally:
            if es:
                try:
                    await es.close()
                except Exception:
                    pass

    return await get_ticket(tid)


async def get_ticket(ticket_id: str) -> dict[str, Any] | None:
    await ensure_cockpit_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM cockpit_tickets WHERE id=?", (ticket_id,))
        row = await cur.fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "scenario_id": row["scenario_id"],
        "session_id": row["session_id"],
        "evidence_ids": json.loads(row["evidence_ids"] or "[]"),
        "actions": json.loads(row["actions"] or "[]"),
        "status": row["status"],
        "created_at": row["created_at"],
    }


async def list_tickets(q: str | None = None) -> list[dict[str, Any]]:
    await ensure_cockpit_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if q:
            cur = await db.execute(
                "SELECT * FROM cockpit_tickets WHERE title LIKE ? ORDER BY created_at DESC",
                (f"%{q}%",),
            )
        else:
            cur = await db.execute("SELECT * FROM cockpit_tickets ORDER BY created_at DESC")
        rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "scenario_id": r["scenario_id"],
            "status": r["status"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def list_sessions() -> list[dict[str, Any]]:
    await ensure_cockpit_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT id, scenario_id, query, created_at FROM cockpit_sessions ORDER BY created_at DESC")
        rows = await cur.fetchall()
    return [{"id": r["id"], "scenario_id": r["scenario_id"], "query": r["query"], "created_at": r["created_at"]} for r in rows]


async def clear_cockpit_data() -> dict[str, Any]:
    await ensure_cockpit_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM cockpit_sessions")
        await db.execute("DELETE FROM cockpit_tickets")
        await db.commit()
    return {"ok": True}
