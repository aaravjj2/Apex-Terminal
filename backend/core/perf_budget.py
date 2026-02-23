"""
Wave 105 — Performance budget core.
Stores Playwright-collected page load metrics in SQLite and exposes budget thresholds.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Optional

PERF_BUDGET_VERSION = "w105-v1.0"

# Budget thresholds (ms) — generous for dev/CI environments
BUDGETS: dict[str, int] = {
    "lcp_ms": 10000,
    "fcp_ms": 8000,
    "dom_content_loaded_ms": 8000,
    "load_time_ms": 10000,
}

# Bundle size budgets (bytes)
BUNDLE_BUDGETS: dict[str, int] = {
    "total_js_bytes": 3_000_000,   # 3 MB
    "total_css_bytes": 500_000,    # 500 KB
}

# Pages sampled by the Playwright spec (matches W104)
PAGES_UNDER_TEST: list[dict] = [
    {"id": "search",             "path": "/ui2/search"},
    {"id": "backtest",           "path": "/ui2/backtest"},
    {"id": "strategy-optimizer","path": "/ui2/strategy-optimizer"},
    {"id": "job-queue",          "path": "/ui2/job-queue"},
    {"id": "agent",              "path": "/ui2/agent"},
    {"id": "ops",                "path": "/ui2/ops"},
    {"id": "auditor",            "path": "/ui2/auditor"},
]

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


def _ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS perf_budget_samples (
            id               TEXT PRIMARY KEY,
            page_id          TEXT NOT NULL,
            page_url         TEXT NOT NULL,
            sampled_at       REAL NOT NULL,
            fcp_ms           REAL,
            lcp_ms           REAL,
            dom_content_loaded_ms REAL,
            load_time_ms     REAL,
            budget_passed    INTEGER NOT NULL DEFAULT 1,
            violations_json  TEXT NOT NULL DEFAULT '[]',
            user_agent       TEXT
        )
    """)
    conn.commit()


# ---------------------------------------------------------------------------
# Public CRUD
# ---------------------------------------------------------------------------

@dataclass
class PerfSample:
    id: str
    page_id: str
    page_url: str
    sampled_at: float
    fcp_ms: Optional[float]
    lcp_ms: Optional[float]
    dom_content_loaded_ms: Optional[float]
    load_time_ms: Optional[float]
    budget_passed: bool
    violations: list[dict]
    user_agent: Optional[str] = None


def _check_budget(metrics: dict) -> tuple[bool, list[dict]]:
    """Return (passed, violations) against BUDGETS."""
    violations = []
    for key, limit in BUDGETS.items():
        val = metrics.get(key)
        if val is not None and val > limit:
            violations.append({"metric": key, "value": val, "budget": limit})
    return len(violations) == 0, violations


def save_perf_sample(
    page_id: str,
    page_url: str,
    fcp_ms: Optional[float] = None,
    lcp_ms: Optional[float] = None,
    dom_content_loaded_ms: Optional[float] = None,
    load_time_ms: Optional[float] = None,
    user_agent: Optional[str] = None,
) -> PerfSample:
    metrics = {
        "fcp_ms": fcp_ms,
        "lcp_ms": lcp_ms,
        "dom_content_loaded_ms": dom_content_loaded_ms,
        "load_time_ms": load_time_ms,
    }
    passed, violations = _check_budget(metrics)
    sample = PerfSample(
        id=str(uuid.uuid4()),
        page_id=page_id,
        page_url=page_url,
        sampled_at=time.time(),
        fcp_ms=fcp_ms,
        lcp_ms=lcp_ms,
        dom_content_loaded_ms=dom_content_loaded_ms,
        load_time_ms=load_time_ms,
        budget_passed=passed,
        violations=violations,
        user_agent=user_agent,
    )
    with _get_conn() as conn:
        _ensure_table(conn)
        conn.execute(
            """
            INSERT INTO perf_budget_samples
              (id, page_id, page_url, sampled_at, fcp_ms, lcp_ms,
               dom_content_loaded_ms, load_time_ms, budget_passed,
               violations_json, user_agent)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                sample.id, sample.page_id, sample.page_url, sample.sampled_at,
                sample.fcp_ms, sample.lcp_ms, sample.dom_content_loaded_ms,
                sample.load_time_ms, int(sample.budget_passed),
                json.dumps(sample.violations), sample.user_agent,
            ),
        )
    return sample


def list_perf_samples(page_id: Optional[str] = None) -> list[dict]:
    with _get_conn() as conn:
        _ensure_table(conn)
        if page_id:
            rows = conn.execute(
                "SELECT * FROM perf_budget_samples WHERE page_id=? ORDER BY sampled_at DESC",
                (page_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM perf_budget_samples ORDER BY sampled_at DESC"
            ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["violations"] = json.loads(d.pop("violations_json", "[]"))
        d["budget_passed"] = bool(d["budget_passed"])
        result.append(d)
    return result


def get_perf_summary() -> dict:
    with _get_conn() as conn:
        _ensure_table(conn)
        rows = conn.execute(
            "SELECT page_id, fcp_ms, lcp_ms, dom_content_loaded_ms, load_time_ms, budget_passed FROM perf_budget_samples"
        ).fetchall()

    if not rows:
        return {
            "total_samples": 0,
            "pages_sampled": 0,
            "pages_passing": 0,
            "avg_lcp_ms": None,
            "avg_fcp_ms": None,
            "avg_dom_content_loaded_ms": None,
            "avg_load_time_ms": None,
            "budgets": BUDGETS,
        }

    def _avg(vals):
        clean = [v for v in vals if v is not None]
        return round(sum(clean) / len(clean), 2) if clean else None

    page_ids = list({r["page_id"] for r in rows})
    # A page «passes» if its latest sample passed
    passing = set()
    latest: dict[str, sqlite3.Row] = {}
    for r in rows:
        pid = r["page_id"]
        if pid not in latest:
            latest[pid] = r
    for pid, r in latest.items():
        if r["budget_passed"]:
            passing.add(pid)

    return {
        "total_samples": len(rows),
        "pages_sampled": len(page_ids),
        "pages_passing": len(passing),
        "avg_lcp_ms": _avg([r["lcp_ms"] for r in rows]),
        "avg_fcp_ms": _avg([r["fcp_ms"] for r in rows]),
        "avg_dom_content_loaded_ms": _avg([r["dom_content_loaded_ms"] for r in rows]),
        "avg_load_time_ms": _avg([r["load_time_ms"] for r in rows]),
        "budgets": BUDGETS,
    }


def clear_perf_data() -> int:
    with _get_conn() as conn:
        _ensure_table(conn)
        cur = conn.execute("DELETE FROM perf_budget_samples")
        deleted = cur.rowcount
    return deleted
