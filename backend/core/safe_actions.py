"""
Wave 107 — Safe actions (tickets).
Ticket schema, RBAC gate, audit events for creation/updates,
ES indexing of tickets with edges to audit events.
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

SAFE_ACTIONS_VERSION = "w107-v1.0"

ES_HOST = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

INDEX_TICKETS    = "apex-tickets"
INDEX_AUDIT      = "apex-audit-events"
INDEX_EDGES      = "apex-ticket-edges"

# RBAC: roles allowed to create/update tickets
ALLOWED_ROLES = {"admin", "agent", "auditor"}

# ---------------------------------------------------------------------------
# DB helpers
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
        CREATE TABLE IF NOT EXISTS tickets (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            description  TEXT NOT NULL DEFAULT '',
            status       TEXT NOT NULL DEFAULT 'open',
            priority     TEXT NOT NULL DEFAULT 'medium',
            created_by   TEXT NOT NULL,
            role         TEXT NOT NULL,
            created_at   REAL NOT NULL,
            updated_at   REAL NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}'
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ticket_audit_events (
            id           TEXT PRIMARY KEY,
            ticket_id    TEXT NOT NULL,
            event_type   TEXT NOT NULL,
            actor        TEXT NOT NULL,
            role         TEXT NOT NULL,
            payload_json TEXT NOT NULL DEFAULT '{}',
            created_at   REAL NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ticket_edges (
            id           TEXT PRIMARY KEY,
            from_id      TEXT NOT NULL,
            to_id        TEXT NOT NULL,
            edge_type    TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at   REAL NOT NULL
        )
    """)
    conn.commit()


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

def check_rbac(role: str) -> bool:
    """Return True if the role is permitted to create/update tickets."""
    return role in ALLOWED_ROLES


# ---------------------------------------------------------------------------
# ES helpers
# ---------------------------------------------------------------------------

async def _es() -> Optional[Any]:
    if AsyncElasticsearch is None:
        return None
    client = AsyncElasticsearch(ES_HOST)
    try:
        await client.info()
        return client
    except Exception:
        await client.close()
        return None


async def _ensure_es_indices(client: Any) -> None:
    for index in [INDEX_TICKETS, INDEX_AUDIT, INDEX_EDGES]:
        exists = await client.indices.exists(index=index)
        if not exists:
            await client.indices.create(index=index, body={
                "settings": {"number_of_shards": 1, "number_of_replicas": 0}
            })


async def _index_ticket(client: Any, ticket: dict) -> None:
    await client.index(
        index=INDEX_TICKETS,
        id=ticket["id"],
        document=ticket,
        refresh=True,
    )


async def _index_audit_event(client: Any, event: dict) -> None:
    await client.index(
        index=INDEX_AUDIT,
        id=event["id"],
        document=event,
        refresh=True,
    )


async def _index_edge(client: Any, edge: dict) -> None:
    await client.index(
        index=INDEX_EDGES,
        id=edge["id"],
        document=edge,
        refresh=True,
    )


# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------

async def create_ticket(
    title: str,
    description: str,
    priority: str,
    created_by: str,
    role: str,
    metadata: Optional[dict] = None,
    ticket_id: Optional[str] = None,
) -> dict:
    """
    Create a ticket with RBAC gate. Produce an audit event. Index into ES.
    Raises ValueError if role is not allowed.
    Idempotent if ticket_id is supplied (returns existing if already present).
    """
    if not check_rbac(role):
        raise ValueError(f"Role '{role}' is not permitted to create tickets")

    conn = _get_conn()
    _ensure_tables(conn)

    # Idempotency: return existing ticket if already present
    if ticket_id:
        existing = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if existing:
            conn.close()
            row = dict(existing)
            row["metadata"] = json.loads(row.pop("metadata_json", "{}"))
            return row

    tid = ticket_id or str(uuid.uuid4())
    now = time.time()
    meta = metadata or {}

    conn.execute("""
        INSERT INTO tickets (id, title, description, status, priority, created_by, role, created_at, updated_at, metadata_json)
        VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    """, (tid, title, description, priority, created_by, role, now, now, json.dumps(meta)))

    # Audit event: created
    audit_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO ticket_audit_events (id, ticket_id, event_type, actor, role, payload_json, created_at)
        VALUES (?, ?, 'created', ?, ?, ?, ?)
    """, (audit_id, tid, created_by, role, json.dumps({"title": title, "priority": priority}), now))
    conn.commit()
    conn.close()

    ticket = {
        "id": tid,
        "title": title,
        "description": description,
        "status": "open",
        "priority": priority,
        "created_by": created_by,
        "role": role,
        "created_at": now,
        "updated_at": now,
        "metadata": meta,
    }
    audit_event = {
        "id": audit_id,
        "ticket_id": tid,
        "event_type": "created",
        "actor": created_by,
        "role": role,
        "payload": {"title": title, "priority": priority},
        "created_at": now,
    }

    # ES indexing + edge
    client = await _es()
    if client:
        try:
            await _ensure_es_indices(client)
            await _index_ticket(client, {**ticket, "metadata": json.dumps(meta)})
            await _index_audit_event(client, {**audit_event, "payload": json.dumps(audit_event["payload"])})
            # Edge: ticket -> audit_event
            edge = {
                "id": str(uuid.uuid4()),
                "from_id": tid,
                "to_id": audit_id,
                "edge_type": "created_event",
                "metadata": "{}",
                "created_at": now,
            }
            await _index_edge(client, edge)
        finally:
            await client.close()

    return ticket


async def update_ticket(
    ticket_id: str,
    updated_by: str,
    role: str,
    updates: dict,
) -> dict:
    """
    Update ticket fields. RBAC-gated. Produces an audit event. Re-indexes in ES.
    Raises ValueError if role is not allowed or ticket not found.
    """
    if not check_rbac(role):
        raise ValueError(f"Role '{role}' is not permitted to update tickets")

    conn = _get_conn()
    _ensure_tables(conn)

    existing = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    if not existing:
        conn.close()
        raise ValueError(f"Ticket '{ticket_id}' not found")

    now = time.time()
    allowed_fields = {"title", "description", "status", "priority"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}

    if safe_updates:
        set_clause = ", ".join(f"{k} = ?" for k in safe_updates)
        vals = list(safe_updates.values()) + [now, ticket_id]
        conn.execute(f"UPDATE tickets SET {set_clause}, updated_at = ? WHERE id = ?", vals)

    audit_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO ticket_audit_events (id, ticket_id, event_type, actor, role, payload_json, created_at)
        VALUES (?, ?, 'updated', ?, ?, ?, ?)
    """, (audit_id, ticket_id, updated_by, role, json.dumps(safe_updates), now))
    conn.commit()

    updated = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    conn.close()

    row = dict(updated)
    row["metadata"] = json.loads(row.pop("metadata_json", "{}"))

    audit_event = {
        "id": audit_id,
        "ticket_id": ticket_id,
        "event_type": "updated",
        "actor": updated_by,
        "role": role,
        "payload": safe_updates,
        "created_at": now,
    }

    client = await _es()
    if client:
        try:
            await _ensure_es_indices(client)
            await _index_ticket(client, {**row, "metadata": json.dumps(row["metadata"])})
            await _index_audit_event(client, {**audit_event, "payload": json.dumps(audit_event["payload"])})
            edge = {
                "id": str(uuid.uuid4()),
                "from_id": ticket_id,
                "to_id": audit_id,
                "edge_type": "updated_event",
                "metadata": "{}",
                "created_at": now,
            }
            await _index_edge(client, edge)
        finally:
            await client.close()

    return row


async def search_tickets(query: str = "") -> dict:
    """ES-first search; falls back to SQLite LIKE if ES unavailable."""
    client = await _es()
    if client:
        try:
            await _ensure_es_indices(client)
            if query.strip():
                body = {
                    "query": {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "description", "created_by", "status"],
                            "fuzziness": "AUTO",
                        }
                    }
                }
            else:
                body = {"query": {"match_all": {}}, "size": 50, "sort": [{"created_at": {"order": "desc"}}]}
            res = await client.search(index=INDEX_TICKETS, body=body)
            hits = [h["_source"] for h in res["hits"]["hits"]]
            return {"hits": hits, "total": len(hits), "source": "es"}
        except Exception:
            pass
        finally:
            await client.close()

    # SQLite fallback
    conn = _get_conn()
    _ensure_tables(conn)
    if query.strip():
        rows = conn.execute(
            "SELECT * FROM tickets WHERE title LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT 50",
            (f"%{query}%", f"%{query}%"),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 50").fetchall()
    conn.close()
    hits = []
    for r in rows:
        row = dict(r)
        row["metadata"] = json.loads(row.pop("metadata_json", "{}"))
        hits.append(row)
    return {"hits": hits, "total": len(hits), "source": "sqlite"}


async def get_ticket(ticket_id: str) -> Optional[dict]:
    conn = _get_conn()
    _ensure_tables(conn)
    row = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    conn.close()
    if not row:
        return None
    result = dict(row)
    result["metadata"] = json.loads(result.pop("metadata_json", "{}"))
    return result


async def get_audit_trail(ticket_id: str) -> list:
    """Return audit events for a ticket, ordered by time."""
    conn = _get_conn()
    _ensure_tables(conn)
    rows = conn.execute(
        "SELECT * FROM ticket_audit_events WHERE ticket_id = ? ORDER BY created_at ASC",
        (ticket_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        row = dict(r)
        row["payload"] = json.loads(row.pop("payload_json", "{}"))
        result.append(row)
    return result


async def get_edges(ticket_id: str) -> list:
    conn = _get_conn()
    _ensure_tables(conn)
    rows = conn.execute(
        "SELECT * FROM ticket_edges WHERE from_id = ? ORDER BY created_at ASC",
        (ticket_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        row = dict(r)
        row["metadata"] = json.loads(row.pop("metadata_json", "{}"))
        result.append(row)
    return result


async def clear_all_data() -> None:
    """Delete all tickets, audit events, and edges from SQLite + ES."""
    conn = _get_conn()
    _ensure_tables(conn)
    conn.execute("DELETE FROM tickets")
    conn.execute("DELETE FROM ticket_audit_events")
    conn.execute("DELETE FROM ticket_edges")
    conn.commit()
    conn.close()

    client = await _es()
    if client:
        try:
            for index in [INDEX_TICKETS, INDEX_AUDIT, INDEX_EDGES]:
                exists = await client.indices.exists(index=index)
                if exists:
                    await client.delete_by_query(
                        index=index,
                        body={"query": {"match_all": {}}},
                        refresh=True,
                    )
        except Exception:
            pass
        finally:
            await client.close()
