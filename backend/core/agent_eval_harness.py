"""
W102 — Agent Eval Harness

Repeatable scoring of agent output and citation correctness.

Dataset: curated eval cases with prompt + expected evidence IDs
Eval runner: produces scores, stores results, indexes to ES
Fully deterministic — same dataset always yields same scores.
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

# ─── Curated eval dataset (frozen in repo) ───────────────────────────────────

EVAL_DATASET: list[dict[str, Any]] = [
    {
        "id": "eval-001",
        "prompt": "What is the current volatility trend for SPY?",
        "expected_evidence_ids": ["ev-vol-001", "ev-vol-002"],
        "expected_keywords": ["volatility", "trend", "spy"],
        "category": "market_analysis",
    },
    {
        "id": "eval-002",
        "prompt": "Explain the mean-reversion signal for AAPL",
        "expected_evidence_ids": ["ev-mr-001", "ev-mr-002", "ev-mr-003"],
        "expected_keywords": ["mean-reversion", "signal", "aapl"],
        "category": "strategy",
    },
    {
        "id": "eval-003",
        "prompt": "What are the risk factors for the current portfolio?",
        "expected_evidence_ids": ["ev-risk-001", "ev-risk-002"],
        "expected_keywords": ["risk", "portfolio", "factor"],
        "category": "risk",
    },
    {
        "id": "eval-004",
        "prompt": "Summarize the backtest results for the momentum strategy",
        "expected_evidence_ids": ["ev-bt-001"],
        "expected_keywords": ["backtest", "momentum", "results"],
        "category": "backtest",
    },
    {
        "id": "eval-005",
        "prompt": "Are there any anomalies in the agent citation coverage?",
        "expected_evidence_ids": ["ev-cite-001", "ev-cite-002"],
        "expected_keywords": ["anomaly", "citation", "coverage"],
        "category": "audit",
    },
    {
        "id": "eval-006",
        "prompt": "What does the convergence cockpit show for risk signals?",
        "expected_evidence_ids": ["ev-risk-001", "ev-vol-001"],
        "expected_keywords": ["convergence", "risk", "signal"],
        "category": "cockpit",
    },
]

DATASET_VERSION = "v1.0"


# ─── Mock deterministic agent ─────────────────────────────────────────────────

def _mock_agent_response(prompt: str) -> dict[str, Any]:
    """
    Deterministic mock agent.
    Returns answer based on prompt keywords and a predictable evidence set.
    """
    prompt_lower = prompt.lower()
    keywords_found: list[str] = []
    for kw in ["volatility", "trend", "mean-reversion", "signal", "risk", "backtest",
               "momentum", "anomaly", "citation", "convergence", "portfolio", "factor",
               "coverage", "summary", "aapl", "spy"]:
        if kw in prompt_lower:
            keywords_found.append(kw)

    # Deterministic evidence selection based on first word of prompt
    first_word = prompt_lower.split()[0][:3]
    evidence_ids = [
        f"ev-{first_word}-001",
        f"ev-{first_word}-002",
    ]
    answer = (
        f"Agent analysis for query: '{prompt[:60]}'. "
        f"Key topics: {', '.join(keywords_found) if keywords_found else 'general'}. "
        "Analysis complete with high confidence."
    )
    return {
        "answer": answer,
        "evidence_ids": evidence_ids,
        "keywords_found": keywords_found,
    }


# ─── Scoring ──────────────────────────────────────────────────────────────────

def _score_case(case: dict[str, Any], response: dict[str, Any]) -> dict[str, Any]:
    """Compute citation recall + keyword score for one eval case. Deterministic."""
    expected_evs = set(case["expected_evidence_ids"])
    returned_evs = set(response["evidence_ids"])

    # Citation recall: fraction of expected IDs found
    recall = (
        len(expected_evs & returned_evs) / len(expected_evs)
        if expected_evs else 1.0
    )

    # Keyword score: fraction of expected keywords found in answer
    answer_lower = response["answer"].lower()
    kwds = [kw.lower() for kw in case["expected_keywords"]]
    kw_hit = sum(1 for kw in kwds if kw in answer_lower)
    keyword_score = kw_hit / max(len(kwds), 1)

    total = round((recall + keyword_score) / 2, 4)
    return {
        "case_id": case["id"],
        "category": case["category"],
        "citation_recall": round(recall, 4),
        "keyword_score": round(keyword_score, 4),
        "total_score": total,
        "evidence_returned": list(returned_evs),
        "evidence_expected": list(expected_evs),
    }


# ─── Tables ───────────────────────────────────────────────────────────────────

async def ensure_eval_tables() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS eval_runs (
                id               TEXT PRIMARY KEY,
                dataset_version  TEXT,
                case_count       INTEGER,
                avg_recall       REAL,
                avg_keyword      REAL,
                avg_total        REAL,
                scores_json      TEXT,
                created_at       TEXT
            )
        """)
        await db.commit()


# ─── Public API ───────────────────────────────────────────────────────────────

def get_eval_dataset() -> dict[str, Any]:
    return {
        "version": DATASET_VERSION,
        "cases": EVAL_DATASET,
        "total": len(EVAL_DATASET),
    }


async def run_eval(dataset_version: str = DATASET_VERSION) -> dict[str, Any]:
    await ensure_eval_tables()

    run_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc).isoformat()

    scores: list[dict[str, Any]] = []
    for case in EVAL_DATASET:
        response = _mock_agent_response(case["prompt"])
        score = _score_case(case, response)
        score["response_answer"] = response["answer"]
        scores.append(score)

    avg_recall = round(sum(s["citation_recall"] for s in scores) / len(scores), 4)
    avg_keyword = round(sum(s["keyword_score"] for s in scores) / len(scores), 4)
    avg_total = round(sum(s["total_score"] for s in scores) / len(scores), 4)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO eval_runs (id, dataset_version, case_count, avg_recall, avg_keyword, avg_total, scores_json, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (run_id, dataset_version, len(EVAL_DATASET), avg_recall, avg_keyword, avg_total, json.dumps(scores), now),
        )
        await db.commit()

    # Index to ES
    if AsyncElasticsearch is not None:
        es = None
        try:
            es = AsyncElasticsearch(ES_HOST)
            await es.index(
                index="apex-events-write",
                id=run_id,
                body={"id": run_id, "dataset_version": dataset_version, "avg_total": avg_total, "type": "eval_run", "created_at": now},
            )
        except Exception:
            pass
        finally:
            if es:
                try:
                    await es.close()
                except Exception:
                    pass

    return {
        "run_id": run_id,
        "dataset_version": dataset_version,
        "case_count": len(EVAL_DATASET),
        "avg_recall": avg_recall,
        "avg_keyword": avg_keyword,
        "avg_total": avg_total,
        "scores": scores,
        "created_at": now,
    }


async def get_eval_run(run_id: str) -> dict[str, Any] | None:
    await ensure_eval_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM eval_runs WHERE id=?", (run_id,))
        row = await cur.fetchone()
    if row is None:
        return None
    return {
        "run_id": row["id"],
        "dataset_version": row["dataset_version"],
        "case_count": row["case_count"],
        "avg_recall": row["avg_recall"],
        "avg_keyword": row["avg_keyword"],
        "avg_total": row["avg_total"],
        "scores": json.loads(row["scores_json"] or "[]"),
        "created_at": row["created_at"],
    }


async def list_eval_runs() -> list[dict[str, Any]]:
    await ensure_eval_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT id, dataset_version, case_count, avg_recall, avg_keyword, avg_total, created_at FROM eval_runs ORDER BY created_at DESC")
        rows = await cur.fetchall()
    return [
        {
            "run_id": r["id"],
            "dataset_version": r["dataset_version"],
            "case_count": r["case_count"],
            "avg_recall": r["avg_recall"],
            "avg_keyword": r["avg_keyword"],
            "avg_total": r["avg_total"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def clear_eval_runs() -> dict[str, Any]:
    await ensure_eval_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM eval_runs")
        await db.commit()
    return {"ok": True, "deleted": cur.rowcount}
