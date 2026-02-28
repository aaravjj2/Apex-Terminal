"""
W99 — Strategy Studio v3

StrategySpec schema + lint rules + template gallery + version history.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass, field, asdict
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

VALID_STRATEGY_TYPES = {"ma_cross", "mean_reversion", "buy_and_hold", "rsi", "breakout", "momentum"}


# ─── Template gallery ─────────────────────────────────────────────────────────

TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "tpl-sma-cross",
        "name": "SMA Crossover",
        "strategy_type": "ma_cross",
        "description": "Classic 5/20 SMA crossover with daily rebalancing",
        "params": {"fast_period": 5, "slow_period": 20, "commission_bps": 10},
        "symbols": ["AAPL"],
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
    },
    {
        "id": "tpl-rsi-revert",
        "name": "RSI Mean Reversion",
        "strategy_type": "rsi",
        "description": "RSI(14) overbought/oversold entries with 2% stop-loss",
        "params": {"rsi_period": 14, "overbought": 70, "oversold": 30, "stop_loss_pct": 0.02},
        "symbols": ["TSLA", "NVDA"],
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
    },
    {
        "id": "tpl-breakout",
        "name": "Donchian Breakout",
        "strategy_type": "breakout",
        "description": "20-bar Donchian channel breakout with ATR position sizing",
        "params": {"channel_period": 20, "atr_period": 14, "risk_pct": 0.01},
        "symbols": ["SPY"],
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
    },
]


# ─── Lint rules ───────────────────────────────────────────────────────────────

def lint_strategy(spec: dict[str, Any]) -> list[dict[str, str]]:
    """Run lint rules on a strategy spec. Return list of {field, rule, message}."""
    errors = []

    # Required fields
    for f in ("name", "strategy_type", "symbols", "start_date", "end_date"):
        if not spec.get(f):
            errors.append({"field": f, "rule": "required", "message": f"`{f}` is required"})

    # Name length
    name = spec.get("name", "")
    if name and len(name) < 3:
        errors.append({"field": "name", "rule": "min_length", "message": "Strategy name must be >= 3 characters"})
    if name and len(name) > 100:
        errors.append({"field": "name", "rule": "max_length", "message": "Strategy name must be <= 100 characters"})

    # Valid strategy type
    st = spec.get("strategy_type", "")
    if st and st not in VALID_STRATEGY_TYPES:
        errors.append({
            "field": "strategy_type",
            "rule": "invalid_value",
            "message": f"Unknown strategy_type `{st}`. Valid: {sorted(VALID_STRATEGY_TYPES)}",
        })

    # Symbols must be a list
    symbols = spec.get("symbols", [])
    if symbols is not None and not isinstance(symbols, list):
        errors.append({"field": "symbols", "rule": "type", "message": "`symbols` must be a list"})
    elif isinstance(symbols, list) and not symbols:
        errors.append({"field": "symbols", "rule": "empty", "message": "At least one symbol is required"})

    # Date format
    date_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    for date_field in ("start_date", "end_date"):
        val = spec.get(date_field, "")
        if val and not date_re.match(val):
            errors.append({"field": date_field, "rule": "format", "message": f"`{date_field}` must be YYYY-MM-DD"})

    # start_date < end_date
    sd = spec.get("start_date", "")
    ed = spec.get("end_date", "")
    if sd and ed and date_re.match(sd) and date_re.match(ed) and sd >= ed:
        errors.append({"field": "end_date", "rule": "date_order", "message": "`end_date` must be after `start_date`"})

    # params must be dict if provided
    params = spec.get("params")
    if params is not None and not isinstance(params, dict):
        errors.append({"field": "params", "rule": "type", "message": "`params` must be a dict"})

    return errors


# ─── SQLite tables ────────────────────────────────────────────────────────────

async def ensure_strategy_tables() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS strategies (
                id              TEXT PRIMARY KEY,
                name            TEXT,
                strategy_type   TEXT,
                symbols         TEXT,
                start_date      TEXT,
                end_date        TEXT,
                params          TEXT DEFAULT '{}',
                version         INTEGER DEFAULT 1,
                archived        INTEGER DEFAULT 0,
                created_at      TEXT,
                updated_at      TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS strategy_history (
                id              TEXT PRIMARY KEY,
                strategy_id     TEXT,
                version         INTEGER,
                name            TEXT,
                strategy_type   TEXT,
                params          TEXT,
                changed_at      TEXT
            )
        """)
        await db.commit()


# ─── CRUD ─────────────────────────────────────────────────────────────────────

async def create_strategy(spec: dict[str, Any]) -> dict[str, Any]:
    await ensure_strategy_tables()
    errors = lint_strategy(spec)
    if errors:
        raise ValueError(json.dumps(errors))

    sid = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc).isoformat()
    symbols_json = json.dumps(spec.get("symbols", []))
    params_json = json.dumps(spec.get("params") or {})

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO strategies
               (id, name, strategy_type, symbols, start_date, end_date, params, version, archived, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,1,0,?,?)""",
            (sid, spec["name"], spec["strategy_type"], symbols_json,
             spec.get("start_date", ""), spec.get("end_date", ""),
             params_json, now, now),
        )
        await db.execute(
            "INSERT INTO strategy_history (id, strategy_id, version, name, strategy_type, params, changed_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), sid, 1, spec["name"], spec["strategy_type"], params_json, now),
        )
        await db.commit()

    # Index to ES
    if AsyncElasticsearch is not None:
        es = None
        try:
            es = AsyncElasticsearch(ES_HOST)
            await es.index(
                index="apex-strategies-write",
                id=sid,
                body={
                    "id": sid, "name": spec["name"], "strategy_type": spec["strategy_type"],
                    "symbols": spec.get("symbols", []), "created_at": now,
                },
            )
        except Exception:
            pass
        finally:
            if es:
                try:
                    await es.close()
                except Exception:
                    pass

    return await get_strategy(sid)


async def get_strategy(sid: str) -> dict[str, Any] | None:
    await ensure_strategy_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM strategies WHERE id=?", (sid,))
        row = await cur.fetchone()
    if row is None:
        return None
    return _strategy_row(row)


def _strategy_row(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "strategy_type": row["strategy_type"],
        "symbols": json.loads(row["symbols"] or "[]"),
        "start_date": row["start_date"],
        "end_date": row["end_date"],
        "params": json.loads(row["params"] or "{}"),
        "version": row["version"],
        "archived": bool(row["archived"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def list_strategies(query: str = "", archived: bool = False) -> list[dict[str, Any]]:
    await ensure_strategy_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        arch_val = 1 if archived else 0
        if query:
            cur = await db.execute(
                "SELECT * FROM strategies WHERE archived=? AND (name LIKE ? OR strategy_type LIKE ?) ORDER BY created_at DESC",
                (arch_val, f"%{query}%", f"%{query}%"),
            )
        else:
            cur = await db.execute("SELECT * FROM strategies WHERE archived=? ORDER BY created_at DESC", (arch_val,))
        rows = await cur.fetchall()
    return [_strategy_row(r) for r in rows]


async def update_strategy(sid: str, updates: dict[str, Any]) -> dict[str, Any]:
    await ensure_strategy_tables()
    existing = await get_strategy(sid)
    if existing is None:
        raise ValueError(f"Strategy not found: {sid}")

    merged = {**existing, **updates}
    errors = lint_strategy(merged)
    if errors:
        raise ValueError(json.dumps(errors))

    now = datetime.now(tz=timezone.utc).isoformat()
    new_version = existing["version"] + 1
    params_json = json.dumps(merged.get("params") or {})
    symbols_json = json.dumps(merged.get("symbols", []))

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """UPDATE strategies SET name=?, strategy_type=?, symbols=?, start_date=?, end_date=?,
               params=?, version=?, updated_at=? WHERE id=?""",
            (merged["name"], merged["strategy_type"], symbols_json,
             merged.get("start_date", ""), merged.get("end_date", ""),
             params_json, new_version, now, sid),
        )
        await db.execute(
            "INSERT INTO strategy_history (id, strategy_id, version, name, strategy_type, params, changed_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), sid, new_version, merged["name"], merged["strategy_type"], params_json, now),
        )
        await db.commit()

    return await get_strategy(sid)


async def archive_strategy(sid: str) -> dict[str, Any]:
    await ensure_strategy_tables()
    now = datetime.now(tz=timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE strategies SET archived=1, updated_at=? WHERE id=?", (now, sid))
        await db.commit()
    return {"ok": True, "id": sid, "archived": True}


async def delete_strategy(sid: str) -> dict[str, Any]:
    await ensure_strategy_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM strategy_history WHERE strategy_id=?", (sid,))
        cur = await db.execute("DELETE FROM strategies WHERE id=?", (sid,))
        await db.commit()
    return {"ok": True, "deleted": cur.rowcount}


async def get_strategy_history(sid: str) -> list[dict[str, Any]]:
    await ensure_strategy_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM strategy_history WHERE strategy_id=? ORDER BY version",
            (sid,),
        )
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def clear_strategies() -> dict[str, Any]:
    await ensure_strategy_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM strategy_history")
        cur = await db.execute("DELETE FROM strategies")
        await db.commit()
    return {"ok": True, "deleted": cur.rowcount}
