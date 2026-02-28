"""
backend/core/evidence_graph.py — W93

Evidence-graph traceability layer.
Persist nodes + edges in SQLite, index edge documents into ES (apex-edges-write),
and serve BFS traversals via get_graph().
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import aiosqlite
import httpx

from .es_templates import write_alias

# ── Config ────────────────────────────────────────────────────────────────────

def _es_url() -> str:
    return os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")


def _db_path() -> str:
    url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
    if "sqlite" in url.lower():
        return url.split("///")[-1]
    return "./test_phase1.db"


# ── Schema ────────────────────────────────────────────────────────────────────

_CREATE_NODES = """
CREATE TABLE IF NOT EXISTS graph_nodes (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    label       TEXT,
    metadata    TEXT DEFAULT '{}',
    created_at  TEXT NOT NULL,
    UNIQUE(entity_type, entity_id)
);
"""

_CREATE_EDGES = """
CREATE TABLE IF NOT EXISTS graph_edges (
    id           TEXT PRIMARY KEY,
    from_node_id TEXT NOT NULL,
    to_node_id   TEXT NOT NULL,
    from_type    TEXT NOT NULL,
    from_id      TEXT NOT NULL,
    to_type      TEXT NOT NULL,
    to_id        TEXT NOT NULL,
    edge_type    TEXT NOT NULL,
    metadata     TEXT DEFAULT '{}',
    created_at   TEXT NOT NULL
);
"""

_IDX_FROM = "CREATE INDEX IF NOT EXISTS idx_ge_from ON graph_edges(from_type, from_id);"
_IDX_TO   = "CREATE INDEX IF NOT EXISTS idx_ge_to   ON graph_edges(to_type,   to_id);"


async def ensure_graph_tables() -> None:
    """Create graph_nodes + graph_edges tables if they don't exist."""
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute(_CREATE_NODES)
        await db.execute(_CREATE_EDGES)
        await db.execute(_IDX_FROM)
        await db.execute(_IDX_TO)
        await db.commit()


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _upsert_node(
    db: aiosqlite.Connection,
    entity_type: str,
    entity_id: str,
    label: str = "",
    metadata: Optional[Dict] = None,
) -> str:
    """Upsert a node and return its canonical id (entity_type:entity_id)."""
    node_id = f"{entity_type}:{entity_id}"
    await db.execute(
        """
        INSERT OR IGNORE INTO graph_nodes(id, entity_type, entity_id, label, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            node_id,
            entity_type,
            entity_id,
            label or f"{entity_type}/{entity_id}",
            json.dumps(metadata or {}),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    return node_id


async def _index_to_es(edge_doc: Dict) -> None:
    """Fire-and-forget: index one edge document to the ES edges write alias."""
    alias = write_alias("edges")
    url = f"{_es_url()}/{alias}/_doc/{edge_doc['id']}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.put(url, json=edge_doc)
    except Exception:
        pass  # Non-critical; ES indexing best-effort


# ── Public API ────────────────────────────────────────────────────────────────

async def create_edge(
    from_type: str,
    from_id: str,
    to_type: str,
    to_id: str,
    edge_type: str,
    metadata: Optional[Dict] = None,
    from_label: str = "",
    to_label: str = "",
) -> Dict:
    """
    Persist an edge between two entities:
      1. Upsert both nodes in SQLite graph_nodes.
      2. Insert edge in graph_edges.
      3. Index edge document to ES (best-effort background task).
    Returns the edge document dict.
    """
    await ensure_graph_tables()
    edge_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(_db_path()) as db:
        from_node_id = await _upsert_node(db, from_type, from_id, from_label)
        to_node_id = await _upsert_node(db, to_type, to_id, to_label)
        await db.execute(
            """
            INSERT OR IGNORE INTO graph_edges
              (id, from_node_id, to_node_id, from_type, from_id, to_type, to_id,
               edge_type, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                edge_id,
                from_node_id,
                to_node_id,
                from_type,
                from_id,
                to_type,
                to_id,
                edge_type,
                json.dumps(metadata or {}),
                now,
            ),
        )
        await db.commit()

    edge_doc = {
        "id": edge_id,
        "from_type": from_type,
        "from_id": from_id,
        "from_label": from_label or f"{from_type}/{from_id}",
        "to_type": to_type,
        "to_id": to_id,
        "to_label": to_label or f"{to_type}/{to_id}",
        "edge_type": edge_type,
        "metadata": metadata or {},
        "created_at": now,
    }

    # Index to ES in background (non-blocking)
    try:
        asyncio.get_event_loop().create_task(_index_to_es(edge_doc))
    except RuntimeError:
        pass  # No running event loop (sync context / tests)

    return edge_doc


async def get_graph(
    root_type: str,
    root_id: str,
    max_depth: int = 3,
) -> Dict:
    """
    BFS from (root_type, root_id) up to max_depth hops.
    Returns {root_type, root_id, nodes, edges, node_count, edge_count}.
    """
    await ensure_graph_tables()

    visited_nodes: Dict[str, Dict] = {}
    visited_edge_ids: set = set()
    edges_out: List[Dict] = []
    queue: List[tuple] = [(root_type, root_id, 0)]
    seen: set = set()

    root_repr = f"{root_type}:{root_id}"
    seen.add(root_repr)

    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row

        # Load root node (or synthesise one)
        async with db.execute(
            "SELECT * FROM graph_nodes WHERE entity_type=? AND entity_id=?",
            (root_type, root_id),
        ) as cur:
            row = await cur.fetchone()

        if row:
            visited_nodes[root_repr] = {
                "id": row["id"],
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "label": row["label"],
            }
        else:
            visited_nodes[root_repr] = {
                "id": root_repr,
                "entity_type": root_type,
                "entity_id": root_id,
                "label": f"{root_type}/{root_id}",
            }

        while queue:
            curr_type, curr_id, depth = queue.pop(0)
            if depth >= max_depth:
                continue

            # Outgoing edges
            async with db.execute(
                """
                SELECT e.*,
                       n2.label AS to_label
                  FROM graph_edges e
                  LEFT JOIN graph_nodes n2 ON e.to_node_id = n2.id
                 WHERE e.from_type = ? AND e.from_id = ?
                """,
                (curr_type, curr_id),
            ) as cur:
                rows = await cur.fetchall()

            for r in rows:
                if r["id"] not in visited_edge_ids:
                    visited_edge_ids.add(r["id"])
                    edges_out.append(
                        {
                            "id": r["id"],
                            "from_type": r["from_type"],
                            "from_id": r["from_id"],
                            "to_type": r["to_type"],
                            "to_id": r["to_id"],
                            "edge_type": r["edge_type"],
                            "metadata": json.loads(r["metadata"] or "{}"),
                        }
                    )

                to_repr = f"{r['to_type']}:{r['to_id']}"
                if to_repr not in seen:
                    seen.add(to_repr)
                    visited_nodes[to_repr] = {
                        "id": to_repr,
                        "entity_type": r["to_type"],
                        "entity_id": r["to_id"],
                        "label": r["to_label"] or f"{r['to_type']}/{r['to_id']}",
                    }
                    queue.append((r["to_type"], r["to_id"], depth + 1))

    return {
        "root_type": root_type,
        "root_id": root_id,
        "nodes": list(visited_nodes.values()),
        "edges": edges_out,
        "node_count": len(visited_nodes),
        "edge_count": len(edges_out),
    }


async def ensure_backtest_edges(
    run_id: str,
    strategy_id: str,
    metadata: Optional[Dict] = None,
) -> List[Dict]:
    """
    Create standard provenance edges for a backtest run:
      strategy → backtest  (ran_backtest)
      backtest → event     (produced_result)
    Returns list of created edge dicts.
    """
    meta = metadata or {}
    edges = []

    e1 = await create_edge(
        "strategies", strategy_id,
        "backtests", run_id,
        "ran_backtest",
        meta,
        from_label=f"strategy/{strategy_id}",
        to_label=f"backtest/{run_id}",
    )
    edges.append(e1)

    result_id = f"result_{run_id[:12]}"
    e2 = await create_edge(
        "backtests", run_id,
        "events", result_id,
        "produced_result",
        {"result_type": "backtest_result"},
        from_label=f"backtest/{run_id}",
        to_label=f"result/{result_id}",
    )
    edges.append(e2)

    return edges


async def get_all_edges() -> List[Dict]:
    """Return all edges (used in tests / audit)."""
    await ensure_graph_tables()
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM graph_edges ORDER BY created_at"
        ) as cur:
            rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "from_type": r["from_type"],
            "from_id": r["from_id"],
            "to_type": r["to_type"],
            "to_id": r["to_id"],
            "edge_type": r["edge_type"],
            "metadata": json.loads(r["metadata"] or "{}"),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def clear_graph() -> None:
    """Delete all graph data (for test isolation)."""
    await ensure_graph_tables()
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute("DELETE FROM graph_edges")
        await db.execute("DELETE FROM graph_nodes")
        await db.commit()
