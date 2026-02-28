"""
Wave 112 — Ops reset route for persistent window E2E harness.
Provides a single endpoint to reset all W104-W108 test data between tests.
"""
from __future__ import annotations

import os
import sqlite3
from typing import Any

from fastapi import APIRouter

try:
    from elasticsearch import AsyncElasticsearch  # type: ignore
except ImportError:
    AsyncElasticsearch = None  # type: ignore

router = APIRouter(prefix="/api/v3/ops", tags=["ops-reset"])

RESET_VERSION = "w112-v1.0"
ES_HOST = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

# Tables to clear on reset
RESET_TABLES = [
    "tickets", "ticket_audit_events", "ticket_edges",
    "controls_documents", "controls_edges",
    "perf_budget_samples",
    "a11y_audit_runs",
]

# ES indices to clear on reset
RESET_INDICES = [
    "apex-tickets",
    "apex-controls-ap-ar",
    "apex-controls-reconciliation",
    "apex-perf-budget",
]


def _db_path() -> str:
    raw = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
    return raw.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")


async def _reset_es() -> dict[str, Any]:
    """Delete all documents from Apex ES indices."""
    if AsyncElasticsearch is None:
        return {"es": "not available"}

    results: dict[str, Any] = {}
    try:
        client = AsyncElasticsearch(ES_HOST)
        for index in RESET_INDICES:
            try:
                exists = await client.indices.exists(index=index)
                if exists:
                    r = await client.delete_by_query(
                        index=index,
                        body={"query": {"match_all": {}}},
                        refresh=True,
                    )
                    results[index] = r.get("deleted", 0)
                else:
                    results[index] = "skipped (no index)"
            except Exception as e:
                results[index] = f"error: {e}"
        await client.close()
    except Exception as e:
        results["es_error"] = str(e)
    return results


def _reset_sqlite() -> dict[str, Any]:
    """Delete all rows from test tables."""
    db_path = os.path.abspath(_db_path())
    if not os.path.exists(db_path):
        return {"sqlite": "db not found"}

    results: dict[str, Any] = {}
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        existing = {
            row[0] for row in
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        for table in RESET_TABLES:
            if table in existing:
                cursor.execute(f"DELETE FROM {table}")
                results[table] = cursor.rowcount
            else:
                results[table] = "table not found"
        conn.commit()
        conn.close()
    except Exception as e:
        results["sqlite_error"] = str(e)
    return results


@router.get("/reset/version")
async def reset_version():
    return {"version": RESET_VERSION, "status": "ok"}


@router.post("/reset-all", status_code=200)
async def reset_all():
    """
    Reset all W104-W108 data for persistent window E2E harness.
    Clears: tickets, controls, perf samples, a11y runs from SQLite + ES.
    """
    sqlite_results = _reset_sqlite()
    es_results = await _reset_es()
    return {
        "status": "ok",
        "sqlite": sqlite_results,
        "es": es_results,
        "version": RESET_VERSION,
    }
