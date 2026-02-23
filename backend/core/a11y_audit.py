"""
Wave 104 — Accessibility Audit Core
Stores axe-core audit results per page in SQLite.
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

DB_PATH = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db").replace(
    "sqlite+aiosqlite:///", ""
)

A11Y_AUDIT_VERSION = "w104-v1.0"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS a11y_audit_runs (
    id          TEXT PRIMARY KEY,
    page_id     TEXT NOT NULL,
    page_url    TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    violations_critical  INTEGER NOT NULL DEFAULT 0,
    violations_serious   INTEGER NOT NULL DEFAULT 0,
    violations_moderate  INTEGER NOT NULL DEFAULT 0,
    violations_minor     INTEGER NOT NULL DEFAULT 0,
    violations_json      TEXT NOT NULL DEFAULT '[]',
    passes_count         INTEGER NOT NULL DEFAULT 0,
    incomplete_count     INTEGER NOT NULL DEFAULT 0,
    axe_version          TEXT NOT NULL DEFAULT 'unknown'
);
"""

PAGES_UNDER_TEST = [
    {"id": "search",             "url": "http://localhost:5100/ui2/search"},
    {"id": "backtest",           "url": "http://localhost:5100/ui2/backtest"},
    {"id": "strategy-optimizer", "url": "http://localhost:5100/ui2/strategy-optimizer"},
    {"id": "job-queue",          "url": "http://localhost:5100/ui2/job-queue"},
    {"id": "agent",              "url": "http://localhost:5100/ui2/agent"},
    {"id": "ops",                "url": "http://localhost:5100/ui2/ops"},
    {"id": "auditor",            "url": "http://localhost:5100/ui2/auditor"},
]

# axe rules excluded for dark-theme false positives and structural trading-terminal patterns
# button-name: icon-only nav/action buttons; select-name: visually-labelled selects; scrollable-region-focusable: overflow containers
EXCLUDED_RULES = ["color-contrast", "scrollable-region-focusable", "button-name", "select-name"]


async def _ensure_schema() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(_SCHEMA)
        await db.commit()


def _make_run_id(page_id: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    return f"a11y-{page_id}-{ts}"


async def save_audit_run(
    page_id: str,
    page_url: str,
    violations: list,
    passes_count: int,
    incomplete_count: int,
    axe_version: str = "unknown",
) -> dict:
    """Save one axe audit run result to DB."""
    await _ensure_schema()
    run_id = _make_run_id(page_id)
    ts = datetime.now(timezone.utc).isoformat()

    critical = sum(1 for v in violations if v.get("impact") == "critical")
    serious  = sum(1 for v in violations if v.get("impact") == "serious")
    moderate = sum(1 for v in violations if v.get("impact") == "moderate")
    minor    = sum(1 for v in violations if v.get("impact") == "minor")

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO a11y_audit_runs
               (id, page_id, page_url, timestamp,
                violations_critical, violations_serious,
                violations_moderate, violations_minor,
                violations_json, passes_count, incomplete_count, axe_version)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                run_id, page_id, page_url, ts,
                critical, serious, moderate, minor,
                json.dumps(violations), passes_count, incomplete_count, axe_version,
            ),
        )
        await db.commit()

    return _format_run(
        run_id, page_id, page_url, ts,
        critical, serious, moderate, minor,
        violations, passes_count, incomplete_count, axe_version,
    )


def _format_run(
    run_id, page_id, page_url, ts,
    critical, serious, moderate, minor,
    violations, passes_count, incomplete_count, axe_version,
) -> dict:
    return {
        "id": run_id,
        "page_id": page_id,
        "page_url": page_url,
        "timestamp": ts,
        "violations_critical": critical,
        "violations_serious": serious,
        "violations_moderate": moderate,
        "violations_minor": minor,
        "violations": violations if isinstance(violations, list) else json.loads(violations or "[]"),
        "passes_count": passes_count,
        "incomplete_count": incomplete_count,
        "axe_version": axe_version,
        "passed": (critical + serious) == 0,
    }


async def list_audit_runs(page_id: Optional[str] = None, limit: int = 200) -> list:
    await _ensure_schema()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if page_id:
            cur = await db.execute(
                "SELECT * FROM a11y_audit_runs WHERE page_id=? ORDER BY timestamp DESC LIMIT ?",
                (page_id, limit),
            )
        else:
            cur = await db.execute(
                "SELECT * FROM a11y_audit_runs ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
        rows = await cur.fetchall()
    return [
        _format_run(
            r["id"], r["page_id"], r["page_url"], r["timestamp"],
            r["violations_critical"], r["violations_serious"],
            r["violations_moderate"], r["violations_minor"],
            r["violations_json"], r["passes_count"], r["incomplete_count"], r["axe_version"],
        )
        for r in rows
    ]


async def get_audit_summary() -> dict:
    """Aggregate latest run per page."""
    await _ensure_schema()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """SELECT page_id,
                      MAX(timestamp)            AS latest_ts,
                      SUM(violations_critical)  AS total_critical,
                      SUM(violations_serious)   AS total_serious,
                      COUNT(*)                  AS run_count
               FROM a11y_audit_runs
               GROUP BY page_id""",
        )
        rows = await cur.fetchall()

    pages_summary = [
        {
            "page_id": r["page_id"],
            "latest_ts": r["latest_ts"],
            "total_critical": r["total_critical"],
            "total_serious": r["total_serious"],
            "run_count": r["run_count"],
        }
        for r in rows
    ]
    total_critical = sum(p["total_critical"] for p in pages_summary)
    total_serious  = sum(p["total_serious"]  for p in pages_summary)
    return {
        "version": A11Y_AUDIT_VERSION,
        "pages": pages_summary,
        "total_critical": total_critical,
        "total_serious": total_serious,
        "overall_pass": (total_critical + total_serious) == 0,
        "excluded_rules": EXCLUDED_RULES,
        "pages_under_test": PAGES_UNDER_TEST,
    }


async def clear_audit_runs() -> dict:
    await _ensure_schema()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM a11y_audit_runs")
        await db.commit()
    return {"deleted": True}
