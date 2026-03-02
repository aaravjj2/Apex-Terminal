"""
Autopilot V3 State Store — SQLite-backed persistent truth for all autopilot state.

Tables:
  - autopilot_cycles       : one record per decision cycle
  - autopilot_decisions    : one record per symbol decision within a cycle
  - autopilot_orders       : one record per order submitted (intent + broker mapping)
  - autopilot_positions_v3 : open/closed position lifecycle records
  - autopilot_exits        : one record per position exit event
  - autopilot_evaluations  : post-trade outcome metrics
  - autopilot_threshold_history : deterministic threshold change log

Design principles:
  - JSON columns for nested structures (score_breakdown, risk_checks, etc.)
  - All timestamps in ISO-8601 UTC strings for simplicity
  - Thread-safe via connection-per-operation pattern
  - DB file: phase1/autopilot_v3.db (beside apex.db)
  - No ORM — raw sqlite3 for zero-dependency reliability
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── DB path ───────────────────────────────────────────────────────────────────

_DB_PATH: Optional[Path] = None
_LOCK = threading.Lock()


def _get_db_path() -> Path:
    global _DB_PATH
    if _DB_PATH is None:
        here = Path(__file__).parent.parent.parent  # phase1/
        _DB_PATH = here / "autopilot_v3.db"
    return _DB_PATH


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_get_db_path()), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── Schema ────────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS autopilot_cycles (
    cycle_id        TEXT PRIMARY KEY,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    universe        TEXT,           -- JSON list of symbols
    market_session  TEXT,           -- 'open' | 'closed' | 'unknown'
    market_open     INTEGER DEFAULT 0,
    armed           INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'running',  -- running | completed | failed
    correlation_id  TEXT,
    symbols_count   INTEGER DEFAULT 0,
    decisions_count INTEGER DEFAULT 0,
    rejections_count INTEGER DEFAULT 0,
    orders_count    INTEGER DEFAULT 0,
    duration_ms     REAL DEFAULT 0,
    audit_log       TEXT            -- Phase 5a: JSON structured audit (phase_timings, candidates_rejected, etc.)
);

CREATE TABLE IF NOT EXISTS autopilot_decisions (
    decision_id             TEXT PRIMARY KEY,
    cycle_id                TEXT REFERENCES autopilot_cycles(cycle_id),
    symbol                  TEXT NOT NULL,
    decision_type           TEXT NOT NULL,  -- BUY_CALL | BUY_PUT | EXIT | HOLD | REJECT
    contract_symbol         TEXT,
    option_type             TEXT,
    strike                  REAL,
    expiry                  TEXT,
    dte                     INTEGER,
    bid                     REAL,
    ask                     REAL,
    mid                     REAL,
    spread_pct              REAL,
    delta                   REAL,
    iv                      REAL,
    score                   REAL,
    confidence              REAL,
    limit_price             REAL,
    qty                     INTEGER DEFAULT 1,
    premium_cost_usd        REAL DEFAULT 0,
    candidates_count        INTEGER DEFAULT 0,
    candidates_accepted     INTEGER DEFAULT 0,
    score_breakdown         TEXT,    -- JSON
    risk_checks             TEXT,    -- JSON
    feature_contributions   TEXT,    -- JSON
    explanation             TEXT,
    will_submit             INTEGER DEFAULT 0,
    rejection_reason        TEXT,
    rejection_detail        TEXT,
    signal_direction        TEXT,    -- bullish | bearish | neutral
    signal_strength         REAL,
    created_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS autopilot_orders (
    order_id            TEXT PRIMARY KEY,   -- our client_order_id
    cycle_id            TEXT REFERENCES autopilot_cycles(cycle_id),
    decision_id         TEXT REFERENCES autopilot_decisions(decision_id),
    symbol              TEXT NOT NULL,
    contract_symbol     TEXT,
    intent              TEXT NOT NULL,   -- BTO | STC
    side                TEXT NOT NULL,   -- buy | sell
    qty                 INTEGER NOT NULL,
    order_type          TEXT DEFAULT 'limit',
    limit_price         REAL,
    limit_price_rule    TEXT,
    broker_order_id     TEXT,            -- Alpaca order id after submission
    status              TEXT DEFAULT 'pending',  -- pending|submitted|accepted|filled|cancelled|rejected
    filled_qty          INTEGER DEFAULT 0,
    filled_avg_price    REAL,
    error_message       TEXT,
    submitted_at        TEXT,
    filled_at           TEXT,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS autopilot_positions_v3 (
    position_id         TEXT PRIMARY KEY,
    symbol              TEXT NOT NULL,
    contract_symbol     TEXT NOT NULL,
    decision_id         TEXT REFERENCES autopilot_decisions(decision_id),
    open_order_id       TEXT REFERENCES autopilot_orders(order_id),
    qty                 INTEGER NOT NULL DEFAULT 1,
    avg_entry           REAL,
    current_price       REAL,
    unrealized_pnl      REAL DEFAULT 0,
    unrealized_pnl_pct  REAL DEFAULT 0,
    status              TEXT DEFAULT 'open',  -- open | closing | closed
    open_time           TEXT NOT NULL,
    last_seen           TEXT,
    closed_at           TEXT,
    delta_at_open       REAL,
    dte_at_open         INTEGER,
    score_at_open       REAL,
    spread_pct_at_open  REAL,
    exit_trigger        TEXT,    -- tp | sl | time_stop | liquidity | manual | killswitch
    close_order_id      TEXT REFERENCES autopilot_orders(order_id)
);

CREATE TABLE IF NOT EXISTS autopilot_exits (
    exit_id             TEXT PRIMARY KEY,
    position_id         TEXT REFERENCES autopilot_positions_v3(position_id),
    decision_id         TEXT,
    symbol              TEXT NOT NULL,
    contract_symbol     TEXT,
    exit_reason         TEXT NOT NULL,  -- take_profit | stop_loss | time_stop | liquidity | manual | killswitch
    entry_price         REAL,
    exit_price          REAL,
    qty                 INTEGER DEFAULT 1,
    realized_pnl        REAL DEFAULT 0,
    realized_pnl_pct    REAL DEFAULT 0,
    held_days           REAL DEFAULT 0,
    exit_order_id       TEXT,
    spread_pct_at_exit  REAL,
    dte_at_exit         INTEGER,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS autopilot_evaluations (
    eval_id             TEXT PRIMARY KEY,
    cycle_id            TEXT REFERENCES autopilot_cycles(cycle_id),
    decision_id         TEXT REFERENCES autopilot_decisions(decision_id),
    position_id         TEXT REFERENCES autopilot_positions_v3(position_id),
    exit_id             TEXT REFERENCES autopilot_exits(exit_id),
    symbol              TEXT NOT NULL,
    -- Entry quality metrics
    entry_spread_pct    REAL,
    entry_dte           INTEGER,
    entry_delta         REAL,
    entry_iv            REAL,
    entry_liquidity_score REAL,     -- 0-100 from scorer
    entry_signal_direction TEXT,
    entry_signal_strength  REAL,
    -- Outcome metrics (filled after close)
    realized_pnl_pct    REAL,
    mae_pct             REAL,   -- max adverse excursion %
    mfe_pct             REAL,   -- max favorable excursion %
    direction_correct   INTEGER,  -- 1 if underlying moved as predicted
    exit_reason         TEXT,
    held_days           REAL,
    -- Thresholds that were active at decision time (snapshot for audit)
    thresholds_snapshot TEXT,   -- JSON
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS autopilot_incidents_v3 (
    incident_id         TEXT PRIMARY KEY,
    cycle_id            TEXT,
    symbol              TEXT,
    severity            TEXT DEFAULT 'warning',  -- info | warning | error | critical
    category            TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    resolved            INTEGER DEFAULT 0,
    resolved_at         TEXT,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS autopilot_threshold_history (
    id                  TEXT PRIMARY KEY,
    created_at          TEXT NOT NULL,
    trigger_reason      TEXT NOT NULL,   -- win_rate_low | loss_rate_high | spread_too_wide | theta_decay
    old_values          TEXT NOT NULL,   -- JSON snapshot of old thresholds
    new_values          TEXT NOT NULL,   -- JSON snapshot of new thresholds
    trade_sample_n      INTEGER DEFAULT 0,
    win_rate_at_change  REAL,
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS ix_decisions_cycle ON autopilot_decisions(cycle_id);
CREATE INDEX IF NOT EXISTS ix_decisions_symbol ON autopilot_decisions(symbol);
CREATE INDEX IF NOT EXISTS ix_orders_cycle ON autopilot_orders(cycle_id);
CREATE INDEX IF NOT EXISTS ix_orders_decision ON autopilot_orders(decision_id);
CREATE INDEX IF NOT EXISTS ix_positions_symbol ON autopilot_positions_v3(symbol);
CREATE INDEX IF NOT EXISTS ix_positions_status ON autopilot_positions_v3(status);
CREATE INDEX IF NOT EXISTS ix_exits_position ON autopilot_exits(position_id);
CREATE INDEX IF NOT EXISTS ix_evals_decision ON autopilot_evaluations(decision_id);
"""


def init_db() -> None:
    """Create all tables if they don't exist."""
    with _LOCK:
        conn = _connect()
        try:
            conn.executescript(SCHEMA)
            # Phase 5a: Add audit_log column if missing (migration)
            try:
                conn.execute("ALTER TABLE autopilot_cycles ADD COLUMN audit_log TEXT")
            except Exception:
                pass  # Column already exists
            conn.commit()
            logger.info(f"autopilot_v3 DB initialized at {_get_db_path()}")
        finally:
            conn.close()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _jdump(v: Any) -> str:
    return json.dumps(v, default=str)


def _jload(v: Optional[str]) -> Any:
    if v is None:
        return None
    try:
        return json.loads(v)
    except Exception:
        return v


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    # Deserialize JSON fields
    for k in ("universe", "score_breakdown", "risk_checks", "feature_contributions",
              "old_values", "new_values", "thresholds_snapshot", "audit_log"):
        if k in d and isinstance(d[k], str):
            d[k] = _jload(d[k])
    return d


def _new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


# ── Cycle CRUD ────────────────────────────────────────────────────────────────

def cycle_create(
    universe: List[str],
    armed: bool,
    correlation_id: str,
    market_open: bool = False,
    cycle_id: Optional[str] = None,
) -> str:
    """Insert a new cycle row and return cycle_id."""
    cid = cycle_id or _new_id("cyc-")
    now = _now()
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT INTO autopilot_cycles
                   (cycle_id, started_at, universe, armed, market_open, status, correlation_id, symbols_count)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (cid, now, _jdump(universe), int(armed), int(market_open), "running", correlation_id, len(universe))
            )
            conn.commit()
        finally:
            conn.close()
    return cid


def cycle_complete(
    cycle_id: str,
    decisions_count: int,
    rejections_count: int,
    orders_count: int,
    duration_ms: float,
    status: str = "completed",
    market_session: str = "unknown",
    audit_log: Optional[Dict[str, Any]] = None,
) -> None:
    """Mark cycle as completed. Phase 5a: Optional structured audit log."""
    audit_json = _jdump(audit_log) if audit_log else None
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """UPDATE autopilot_cycles
                   SET ended_at=?, status=?, market_session=?,
                       decisions_count=?, rejections_count=?, orders_count=?, duration_ms=?,
                       audit_log=?
                   WHERE cycle_id=?""",
                (_now(), status, market_session, decisions_count, rejections_count, orders_count, duration_ms, audit_json, cycle_id)
            )
            conn.commit()
        finally:
            conn.close()


def cycle_get_latest(n: int = 1) -> List[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT * FROM autopilot_cycles ORDER BY started_at DESC LIMIT ?", (n,)
            ).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


def cycle_get(cycle_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT * FROM autopilot_cycles WHERE cycle_id=?", (cycle_id,)
            ).fetchone()
            return _row_to_dict(row) if row else None
        finally:
            conn.close()


# ── Decision CRUD ─────────────────────────────────────────────────────────────

def decision_upsert(d: Dict[str, Any]) -> None:
    """Insert or replace a decision record."""
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO autopilot_decisions
                   (decision_id, cycle_id, symbol, decision_type, contract_symbol,
                    option_type, strike, expiry, dte, bid, ask, mid, spread_pct, delta, iv,
                    score, confidence, limit_price, qty, premium_cost_usd,
                    candidates_count, candidates_accepted,
                    score_breakdown, risk_checks, feature_contributions,
                    explanation, will_submit, rejection_reason, rejection_detail,
                    signal_direction, signal_strength, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    d.get("decision_id", _new_id("dec-")),
                    d.get("cycle_id"),
                    d.get("symbol", ""),
                    d.get("decision_type", "REJECT"),
                    d.get("contract_symbol"),
                    d.get("option_type"),
                    d.get("strike"),
                    d.get("expiry"),
                    d.get("dte"),
                    d.get("bid"),
                    d.get("ask"),
                    d.get("mid"),
                    d.get("spread_pct"),
                    d.get("delta"),
                    d.get("iv"),
                    d.get("score"),
                    d.get("confidence"),
                    d.get("limit_price"),
                    d.get("qty", 1),
                    d.get("premium_cost_usd", 0.0),
                    d.get("candidates_count", 0),
                    d.get("candidates_accepted", 0),
                    _jdump(d.get("score_breakdown")),
                    _jdump(d.get("risk_checks")),
                    _jdump(d.get("feature_contributions")),
                    d.get("explanation", ""),
                    int(d.get("will_submit", False)),
                    d.get("rejection_reason"),
                    d.get("rejection_detail"),
                    d.get("signal_direction"),
                    d.get("signal_strength"),
                    d.get("created_at", _now()),
                )
            )
            conn.commit()
        finally:
            conn.close()


def decisions_list(
    cycle_id: Optional[str] = None,
    symbol: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    clauses, params = ["1=1"], []
    if cycle_id:
        clauses.append("cycle_id=?")
        params.append(cycle_id)
    if symbol:
        clauses.append("symbol=?")
        params.append(symbol)
    params.append(limit)
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                f"SELECT * FROM autopilot_decisions WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ?",
                params
            ).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


# ── Order CRUD ────────────────────────────────────────────────────────────────

def order_create(d: Dict[str, Any]) -> str:
    oid = d.get("order_id") or _new_id("ord-")
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO autopilot_orders
                   (order_id, cycle_id, decision_id, symbol, contract_symbol,
                    intent, side, qty, order_type, limit_price, limit_price_rule,
                    broker_order_id, status, submitted_at, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    oid,
                    d.get("cycle_id"),
                    d.get("decision_id"),
                    d.get("symbol", ""),
                    d.get("contract_symbol"),
                    d.get("intent", "BTO"),
                    d.get("side", "buy"),
                    d.get("qty", 1),
                    d.get("order_type", "limit"),
                    d.get("limit_price"),
                    d.get("limit_price_rule", "mid"),
                    d.get("broker_order_id"),
                    d.get("status", "submitted"),
                    d.get("submitted_at", _now()),
                    _now(),
                )
            )
            conn.commit()
        finally:
            conn.close()
    return oid


def order_update_fill(order_id: str, broker_order_id: str, status: str,
                       filled_qty: int, filled_avg_price: Optional[float],
                       filled_at: Optional[str] = None) -> None:
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """UPDATE autopilot_orders
                   SET broker_order_id=?, status=?, filled_qty=?,
                       filled_avg_price=?, filled_at=?
                   WHERE order_id=?""",
                (broker_order_id, status, filled_qty, filled_avg_price,
                 filled_at or _now(), order_id)
            )
            conn.commit()
        finally:
            conn.close()


def orders_list(cycle_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    clauses, params = ["1=1"], []
    if cycle_id:
        clauses.append("cycle_id=?")
        params.append(cycle_id)
    params.append(limit)
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                f"SELECT * FROM autopilot_orders WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ?",
                params
            ).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


# ── Position CRUD ─────────────────────────────────────────────────────────────

def position_open(d: Dict[str, Any]) -> str:
    pid = d.get("position_id") or _new_id("pos-")
    now = _now()
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO autopilot_positions_v3
                   (position_id, symbol, contract_symbol, decision_id, open_order_id,
                    qty, avg_entry, current_price, unrealized_pnl, unrealized_pnl_pct,
                    status, open_time, last_seen,
                    delta_at_open, dte_at_open, score_at_open, spread_pct_at_open)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    pid,
                    d.get("symbol", ""),
                    d.get("contract_symbol", ""),
                    d.get("decision_id"),
                    d.get("open_order_id"),
                    d.get("qty", 1),
                    d.get("avg_entry"),
                    d.get("current_price"),
                    d.get("unrealized_pnl", 0.0),
                    d.get("unrealized_pnl_pct", 0.0),
                    "open",
                    d.get("open_time", now),
                    now,
                    d.get("delta_at_open"),
                    d.get("dte_at_open"),
                    d.get("score_at_open"),
                    d.get("spread_pct_at_open"),
                )
            )
            conn.commit()
        finally:
            conn.close()
    return pid


def position_update(position_id: str, updates: Dict[str, Any]) -> None:
    allowed = {
        "current_price", "unrealized_pnl", "unrealized_pnl_pct",
        "status", "last_seen", "closed_at", "exit_trigger", "close_order_id",
    }
    sets = {k: v for k, v in updates.items() if k in allowed}
    if not sets:
        return
    sets["last_seen"] = _now()
    cols = ", ".join(f"{k}=?" for k in sets)
    vals = list(sets.values()) + [position_id]
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(f"UPDATE autopilot_positions_v3 SET {cols} WHERE position_id=?", vals)
            conn.commit()
        finally:
            conn.close()


def positions_list(status: Optional[str] = "open", limit: int = 100) -> List[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            if status:
                rows = conn.execute(
                    "SELECT * FROM autopilot_positions_v3 WHERE status=? ORDER BY open_time DESC LIMIT ?",
                    (status, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM autopilot_positions_v3 ORDER BY open_time DESC LIMIT ?",
                    (limit,)
                ).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


def position_find_by_contract(contract_symbol: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT * FROM autopilot_positions_v3 WHERE contract_symbol=? AND status='open' LIMIT 1",
                (contract_symbol,)
            ).fetchone()
            return _row_to_dict(row) if row else None
        finally:
            conn.close()


# ── Exit CRUD ─────────────────────────────────────────────────────────────────

def exit_record(d: Dict[str, Any]) -> str:
    eid = _new_id("exit-")
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT INTO autopilot_exits
                   (exit_id, position_id, decision_id, symbol, contract_symbol,
                    exit_reason, entry_price, exit_price, qty,
                    realized_pnl, realized_pnl_pct, held_days, exit_order_id,
                    spread_pct_at_exit, dte_at_exit, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    eid,
                    d.get("position_id"),
                    d.get("decision_id"),
                    d.get("symbol", ""),
                    d.get("contract_symbol"),
                    d.get("exit_reason", "unknown"),
                    d.get("entry_price"),
                    d.get("exit_price"),
                    d.get("qty", 1),
                    d.get("realized_pnl", 0.0),
                    d.get("realized_pnl_pct", 0.0),
                    d.get("held_days", 0.0),
                    d.get("exit_order_id"),
                    d.get("spread_pct_at_exit"),
                    d.get("dte_at_exit"),
                    _now(),
                )
            )
            conn.commit()
        finally:
            conn.close()
    return eid


def exits_list(limit: int = 50) -> List[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT * FROM autopilot_exits ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


def trades_for_kelly(limit: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch recent closed trades for Kelly criterion position sizing.
    Returns list with realized_pnl, realized_pnl_pct, symbol per exit.
    """
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                """SELECT symbol, realized_pnl, realized_pnl_pct, entry_price, exit_price, qty
                   FROM autopilot_exits ORDER BY created_at DESC LIMIT ?""",
                (limit,),
            ).fetchall()
            return [
                {
                    "symbol": r["symbol"],
                    "realized_pnl": float(r["realized_pnl"] or 0),
                    "realized_pnl_pct": float(r["realized_pnl_pct"] or 0) / 100.0 if r["realized_pnl_pct"] else 0,
                    "entry_price": float(r["entry_price"] or 0),
                    "exit_price": float(r["exit_price"] or 0),
                    "qty": int(r["qty"] or 1),
                }
                for r in rows
            ]
        finally:
            conn.close()


# ── Evaluation CRUD ───────────────────────────────────────────────────────────

def evaluation_create(d: Dict[str, Any]) -> str:
    eid = _new_id("eval-")
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT INTO autopilot_evaluations
                   (eval_id, cycle_id, decision_id, position_id, exit_id, symbol,
                    entry_spread_pct, entry_dte, entry_delta, entry_iv,
                    entry_liquidity_score, entry_signal_direction, entry_signal_strength,
                    realized_pnl_pct, mae_pct, mfe_pct, direction_correct,
                    exit_reason, held_days, thresholds_snapshot, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    eid,
                    d.get("cycle_id"),
                    d.get("decision_id"),
                    d.get("position_id"),
                    d.get("exit_id"),
                    d.get("symbol", ""),
                    d.get("entry_spread_pct"),
                    d.get("entry_dte"),
                    d.get("entry_delta"),
                    d.get("entry_iv"),
                    d.get("entry_liquidity_score"),
                    d.get("entry_signal_direction"),
                    d.get("entry_signal_strength"),
                    d.get("realized_pnl_pct"),
                    d.get("mae_pct"),
                    d.get("mfe_pct"),
                    int(d.get("direction_correct", False)),
                    d.get("exit_reason"),
                    d.get("held_days"),
                    _jdump(d.get("thresholds_snapshot")),
                    _now(),
                )
            )
            conn.commit()
        finally:
            conn.close()
    return eid


def evaluations_list(since: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            if since:
                rows = conn.execute(
                    "SELECT * FROM autopilot_evaluations WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?",
                    (since, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM autopilot_evaluations ORDER BY created_at DESC LIMIT ?",
                    (limit,)
                ).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


# ── Threshold History CRUD ────────────────────────────────────────────────────

def threshold_change_record(
    trigger_reason: str,
    old_values: Dict[str, Any],
    new_values: Dict[str, Any],
    trade_sample_n: int = 0,
    win_rate: Optional[float] = None,
    notes: str = "",
) -> str:
    rid = _new_id("thr-")
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT INTO autopilot_threshold_history
                   (id, created_at, trigger_reason, old_values, new_values,
                    trade_sample_n, win_rate_at_change, notes)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (rid, _now(), trigger_reason, _jdump(old_values), _jdump(new_values),
                 trade_sample_n, win_rate, notes)
            )
            conn.commit()
        finally:
            conn.close()
    return rid


def threshold_history_list(limit: int = 50) -> List[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT * FROM autopilot_threshold_history ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


# ── Incident CRUD ─────────────────────────────────────────────────────────────

def incident_create(
    category: str,
    title: str,
    severity: str = "warning",
    description: str = "",
    cycle_id: Optional[str] = None,
    symbol: Optional[str] = None,
) -> str:
    iid = _new_id("inc-")
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """INSERT INTO autopilot_incidents_v3
                   (incident_id, cycle_id, symbol, severity, category, title, description, created_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (iid, cycle_id, symbol, severity, category, title, description, _now())
            )
            conn.commit()
        finally:
            conn.close()
    return iid


def incidents_list(limit: int = 50, unresolved_only: bool = False) -> List[Dict[str, Any]]:
    with _LOCK:
        conn = _connect()
        try:
            q = "SELECT * FROM autopilot_incidents_v3"
            if unresolved_only:
                q += " WHERE resolved=0"
            q += " ORDER BY created_at DESC LIMIT ?"
            rows = conn.execute(q, (limit,)).fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            conn.close()


def invariant_check() -> Dict[str, Any]:
    """
    Server-side invariant checker.
    Returns OK or lists violations found.
    """
    violations = []
    with _LOCK:
        conn = _connect()
        try:
            # 1. Filled BTO orders with no matching open position
            rows = conn.execute(
                """SELECT o.order_id, o.contract_symbol, o.filled_at
                   FROM autopilot_orders o
                   LEFT JOIN autopilot_positions_v3 p ON p.open_order_id = o.order_id
                   WHERE o.intent='BTO' AND o.status='filled' AND p.position_id IS NULL"""
            ).fetchall()
            for row in rows:
                violations.append({
                    "type": "filled_bto_no_position",
                    "order_id": row["order_id"],
                    "contract_symbol": row["contract_symbol"],
                    "filled_at": row["filled_at"],
                })

            # 2. Positions that have been closed but still show 'open' after 2h
            rows2 = conn.execute(
                """SELECT position_id, contract_symbol, last_seen
                   FROM autopilot_positions_v3
                   WHERE status='open' AND last_seen < datetime('now', '-2 hours')"""
            ).fetchall()
            for row in rows2:
                violations.append({
                    "type": "stale_position",
                    "position_id": row["position_id"],
                    "contract_symbol": row["contract_symbol"],
                    "last_seen": row["last_seen"],
                })
        finally:
            conn.close()

    return {
        "ok": len(violations) == 0,
        "violations": violations,
        "checked_at": _now(),
    }


# ── Stats helpers ─────────────────────────────────────────────────────────────

def get_summary_stats() -> Dict[str, Any]:
    """Return aggregate stats for the ops health panel."""
    with _LOCK:
        conn = _connect()
        try:
            total_cycles = conn.execute("SELECT COUNT(*) FROM autopilot_cycles").fetchone()[0]
            total_decisions = conn.execute(
                "SELECT COUNT(*) FROM autopilot_decisions WHERE decision_type NOT LIKE '%REJECT%'"
            ).fetchone()[0]
            open_positions = conn.execute(
                "SELECT COUNT(*) FROM autopilot_positions_v3 WHERE status='open'"
            ).fetchone()[0]
            total_exits = conn.execute("SELECT COUNT(*) FROM autopilot_exits").fetchone()[0]
            win_count = conn.execute(
                "SELECT COUNT(*) FROM autopilot_exits WHERE realized_pnl_pct > 0"
            ).fetchone()[0]
            loss_count = conn.execute(
                "SELECT COUNT(*) FROM autopilot_exits WHERE realized_pnl_pct < 0"
            ).fetchone()[0]
            win_rate = win_count / total_exits if total_exits > 0 else None
            total_pnl = conn.execute(
                "SELECT SUM(realized_pnl) FROM autopilot_exits"
            ).fetchone()[0] or 0.0
            unresolved_incidents = conn.execute(
                "SELECT COUNT(*) FROM autopilot_incidents_v3 WHERE resolved=0"
            ).fetchone()[0]
        finally:
            conn.close()

    return {
        "total_cycles": total_cycles,
        "total_decisions": total_decisions,
        "open_positions": open_positions,
        "total_exits": total_exits,
        "win_count": win_count,
        "loss_count": loss_count,
        "win_rate": round(win_rate, 3) if win_rate is not None else None,
        "total_realized_pnl": round(total_pnl, 2),
        "unresolved_incidents": unresolved_incidents,
    }


def strategy_performance_summary(window: int = 20) -> Dict[str, Any]:
    """
    Phase 5b: Per-symbol performance over rolling window.
    Returns win_rate, avg_return_pct, and suggest_reduce_weight (True if Sharpe proxy < 0).
    """
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                """SELECT symbol, realized_pnl_pct FROM autopilot_exits
                   ORDER BY created_at DESC LIMIT ?""",
                (window * 5,),  # Get more to allow per-symbol filter
            ).fetchall()
            by_sym: Dict[str, List[float]] = {}
            for r in rows:
                sym = r["symbol"]
                pct = float(r["realized_pnl_pct"] or 0)
                if sym not in by_sym:
                    by_sym[sym] = []
                if len(by_sym[sym]) < window:
                    by_sym[sym].append(pct)
            result = {}
            for sym, rets in by_sym.items():
                if len(rets) < 5:
                    continue
                wins = sum(1 for r in rets if r > 0)
                win_rate = wins / len(rets)
                avg_ret = sum(rets) / len(rets)
                vol = (sum((r - avg_ret) ** 2 for r in rets) / len(rets)) ** 0.5 if len(rets) > 1 else 0.01
                sharpe_proxy = avg_ret / vol if vol > 0 else 0
                result[sym] = {
                    "win_rate": round(win_rate, 3),
                    "avg_return_pct": round(avg_ret, 3),
                    "n_trades": len(rets),
                    "suggest_reduce_weight": sharpe_proxy < 0,
                }
            return result
        finally:
            conn.close()


# ── Initialize on import ──────────────────────────────────────────────────────

try:
    init_db()
except Exception as _e:
    logger.warning(f"v3_store init failed (will retry on first use): {_e}")
