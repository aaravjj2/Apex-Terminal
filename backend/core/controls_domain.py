"""
Wave 106 — Accounting/controls domain aligned with ES + evidence graph.
AP/AR, reconciliation, and controls are indexed in ES.
Edges between controls and audit events are stored in SQLite (durable) and ES.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from typing import Any, Optional

try:
    from elasticsearch import AsyncElasticsearch  # type: ignore
except ImportError:
    AsyncElasticsearch = None  # type: ignore

CONTROLS_DOMAIN_VERSION = "w106-v1.0"

ES_HOST = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

# ES index names
INDEX_AP_AR          = "apex-controls-ap-ar"
INDEX_RECONCILIATION = "apex-controls-reconciliation"
INDEX_EDGES          = "apex-controls-edges"

DOC_TYPES = ["ap-ar", "reconciliation"]

# ---------------------------------------------------------------------------
# DB helpers (edges + fallback)
# ---------------------------------------------------------------------------

def _db_path() -> str:
    raw = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
    return raw.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_tables(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS controls_edges (
            id          TEXT PRIMARY KEY,
            from_id     TEXT NOT NULL,
            to_id       TEXT NOT NULL,
            edge_type   TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at  REAL NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS controls_documents (
            id          TEXT PRIMARY KEY,
            doc_type    TEXT NOT NULL,
            data_json   TEXT NOT NULL,
            created_at  REAL NOT NULL
        )
    """)
    conn.commit()


# ---------------------------------------------------------------------------
# ES helpers
# ---------------------------------------------------------------------------

def _get_es():
    if AsyncElasticsearch is None:
        return None
    return AsyncElasticsearch(ES_HOST)


def _index_name(doc_type: str) -> str:
    return INDEX_AP_AR if doc_type == "ap-ar" else INDEX_RECONCILIATION


async def ensure_indices() -> None:
    es = _get_es()
    if es is None:
        return
    try:
        for idx in [INDEX_AP_AR, INDEX_RECONCILIATION, INDEX_EDGES]:
            if not await es.indices.exists(index=idx):
                await es.indices.create(index=idx, body={
                    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
                    "mappings": {
                        "properties": {
                            "doc_type":    {"type": "keyword"},
                            "doc_id":      {"type": "keyword"},
                            "created_at":  {"type": "date", "format": "epoch_second"},
                            "from_id":     {"type": "keyword"},
                            "to_id":       {"type": "keyword"},
                            "edge_type":   {"type": "keyword"},
                        }
                    }
                })
    finally:
        await es.close()


# ---------------------------------------------------------------------------
# Control documents
# ---------------------------------------------------------------------------

async def index_control(
    doc_type: str,
    doc_id: Optional[str],
    data: dict,
) -> dict:
    """Index a control document in ES and SQLite."""
    if doc_type not in DOC_TYPES:
        raise ValueError(f"Unknown doc_type {doc_type!r}. Must be one of {DOC_TYPES}")
    doc_id = doc_id or str(uuid.uuid4())
    record = {
        "doc_type":   doc_type,
        "doc_id":     doc_id,
        "created_at": time.time(),
        **data,
    }

    # SQLite
    with _get_conn() as conn:
        _ensure_tables(conn)
        conn.execute(
            "INSERT OR REPLACE INTO controls_documents (id, doc_type, data_json, created_at) VALUES (?,?,?,?)",
            (doc_id, doc_type, json.dumps(data), record["created_at"]),
        )

    # ES (best-effort)
    es = _get_es()
    if es is not None:
        try:
            idx = _index_name(doc_type)
            await es.index(index=idx, id=doc_id, document=record, refresh="wait_for")
        finally:
            await es.close()

    return {"id": doc_id, "doc_type": doc_type, "indexed": True}


async def search_controls(
    query: str,
    doc_type: Optional[str] = None,
    size: int = 20,
) -> list[dict]:
    """ES-first search; falls back to SQLite LIKE query."""
    # Try ES first
    es = _get_es()
    if es is not None:
        try:
            indices = _index_name(doc_type) if doc_type else f"{INDEX_AP_AR},{INDEX_RECONCILIATION}"
            body: dict[str, Any] = {
                "query": {
                    "multi_match": {
                        "query": query or "*",
                        "fields": ["*"],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                } if query.strip() else {"match_all": {}},
                "size": size,
            }
            resp = await es.search(index=indices, body=body)
            hits = resp["hits"]["hits"]
            return [{"id": h["_id"], **h["_source"]} for h in hits]
        except Exception:
            pass
        finally:
            await es.close()

    # SQLite fallback
    with _get_conn() as conn:
        _ensure_tables(conn)
        if doc_type:
            rows = conn.execute(
                "SELECT id, doc_type, data_json FROM controls_documents WHERE doc_type=? AND data_json LIKE ? LIMIT ?",
                (doc_type, f"%{query}%", size),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, doc_type, data_json FROM controls_documents WHERE data_json LIKE ? LIMIT ?",
                (f"%{query}%", size),
            ).fetchall()
    return [{"id": r["id"], "doc_type": r["doc_type"], **json.loads(r["data_json"])} for r in rows]


async def get_control(doc_id: str) -> Optional[dict]:
    """Get a single control by ID (SQLite)."""
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute(
            "SELECT id, doc_type, data_json FROM controls_documents WHERE id=?",
            (doc_id,),
        ).fetchone()
    if row is None:
        return None
    return {"id": row["id"], "doc_type": row["doc_type"], **json.loads(row["data_json"])}


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------

async def create_edge(
    from_id: str,
    to_id: str,
    edge_type: str,
    metadata: Optional[dict] = None,
) -> dict:
    edge_id = str(uuid.uuid4())
    metadata = metadata or {}
    now = time.time()

    with _get_conn() as conn:
        _ensure_tables(conn)
        conn.execute(
            "INSERT INTO controls_edges (id, from_id, to_id, edge_type, metadata_json, created_at) VALUES (?,?,?,?,?,?)",
            (edge_id, from_id, to_id, edge_type, json.dumps(metadata), now),
        )

    # ES (best-effort)
    es = _get_es()
    if es is not None:
        try:
            await es.index(
                index=INDEX_EDGES,
                id=edge_id,
                document={
                    "from_id": from_id, "to_id": to_id, "edge_type": edge_type,
                    "metadata": metadata, "created_at": now,
                },
                refresh="wait_for",
            )
        finally:
            await es.close()

    return {"id": edge_id, "from_id": from_id, "to_id": to_id, "edge_type": edge_type}


async def list_edges(
    from_id: Optional[str] = None,
    to_id: Optional[str] = None,
) -> list[dict]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        if from_id and to_id:
            rows = conn.execute(
                "SELECT * FROM controls_edges WHERE from_id=? AND to_id=?", (from_id, to_id)
            ).fetchall()
        elif from_id:
            rows = conn.execute(
                "SELECT * FROM controls_edges WHERE from_id=?", (from_id,)
            ).fetchall()
        elif to_id:
            rows = conn.execute(
                "SELECT * FROM controls_edges WHERE to_id=?", (to_id,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM controls_edges").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["metadata"] = json.loads(d.pop("metadata_json", "{}"))
        result.append(d)
    return result


# ---------------------------------------------------------------------------
# Clear (test clean-up)
# ---------------------------------------------------------------------------

async def clear_domain_data() -> dict[str, int]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        docs = conn.execute("DELETE FROM controls_documents").rowcount
        edges = conn.execute("DELETE FROM controls_edges").rowcount

    # Clear ES indices (best-effort)
    es = _get_es()
    if es is not None:
        try:
            for idx in [INDEX_AP_AR, INDEX_RECONCILIATION, INDEX_EDGES]:
                exists = await es.indices.exists(index=idx)
                if exists:
                    await es.delete_by_query(
                        index=idx,
                        body={"query": {"match_all": {}}},
                        refresh=True,
                    )
        except Exception:
            pass
        finally:
            await es.close()

    return {"deleted_documents": docs, "deleted_edges": edges}
