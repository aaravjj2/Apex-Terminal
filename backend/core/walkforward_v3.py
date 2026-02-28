"""
W98 — Walk-Forward + Robustness v3

Anti-overfit evaluation by default:
  - Walk-forward folds with purged gaps (gap = excluded bars between train and test)
  - Robustness matrix: slippage multipliers, spread widening, execution delay, liquidity caps
  - Sensitivity heatmaps (slippage x spread)
  - Index fold artifacts + robustness deltas into ES
"""
from __future__ import annotations

import json
import math
import os
import uuid
from dataclasses import dataclass, field
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

# ─── SQLite tables ────────────────────────────────────────────────────────────

async def ensure_walkforward_tables() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS walk_configs (
                id          TEXT PRIMARY KEY,
                strategy    TEXT,
                n_folds     INTEGER,
                purge_bars  INTEGER,
                n_bars      INTEGER,
                created_at  TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS walk_folds (
                id           TEXT PRIMARY KEY,
                config_id    TEXT,
                fold_idx     INTEGER,
                train_start  INTEGER,
                train_end    INTEGER,
                test_start   INTEGER,
                test_end     INTEGER,
                train_return REAL,
                test_return  REAL,
                created_at   TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS robustness_runs (
                id            TEXT PRIMARY KEY,
                config_id     TEXT,
                slippage      REAL,
                spread        REAL,
                delay_bars    INTEGER,
                liquidity_cap REAL,
                base_return   REAL,
                adj_return    REAL,
                delta         REAL,
                created_at    TEXT
            )
        """)
        await db.commit()


# ─── Core simulation (reuses synthetic price logic) ──────────────────────────

def _synthetic_prices(n: int, seed: float = 100.0, amplitude: float = 5.0) -> list[float]:
    return [seed + amplitude * math.sin(2 * math.pi * i / n) for i in range(n)]


def _run_ma_cross_simple(
    prices: list[float],
    capital: float,
    fast: int = 3,
    slow: int = 6,
    slippage: float = 0.0,
    spread: float = 0.0,
    delay_bars: int = 0,
    liquidity_cap: float = 1.0,
) -> float:
    """Return total_return as a float. Applies cost model."""
    cash = capital
    position = 0.0

    def ma(n: int, i: int) -> float | None:
        if i < n - 1:
            return None
        return sum(prices[i - n + 1:i + 1]) / n

    in_position = False

    for i in range(len(prices)):
        # Apply execution delay
        exec_idx = min(i + delay_bars, len(prices) - 1)
        exec_price = prices[exec_idx]
        fast_ma = ma(fast, i)
        slow_ma = ma(slow, i)

        if fast_ma is not None and slow_ma is not None:
            if not in_position and fast_ma > slow_ma:
                # Buy with slippage + spread
                fill_price = exec_price * (1 + slippage) + spread / 2
                shares = (cash * liquidity_cap) / fill_price
                cash -= shares * fill_price
                position += shares
                in_position = True
            elif in_position and fast_ma < slow_ma:
                fill_price = exec_price * (1 - slippage) - spread / 2
                if fill_price > 0:
                    cash += position * fill_price
                else:
                    cash += position * exec_price
                position = 0.0
                in_position = False

    final_equity = cash + position * prices[-1]
    return (final_equity - capital) / capital


# ─── Walk-forward logic ───────────────────────────────────────────────────────

@dataclass
class WalkConfig:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    strategy: str = "ma_cross"
    n_folds: int = 4
    purge_bars: int = 2
    n_bars: int = 40
    initial_capital: float = 10_000.0


def compute_fold_ranges(n_bars: int, n_folds: int, purge_bars: int) -> list[dict[str, int]]:
    """Split bar range into n_folds each with train, purge gap, and test sections."""
    fold_size = n_bars // n_folds
    train_size = int(fold_size * 0.6)
    test_size = fold_size - train_size - purge_bars
    if test_size <= 0:
        test_size = 1

    folds = []
    for i in range(n_folds):
        base = i * fold_size
        train_start = base
        train_end = base + train_size
        test_start = train_end + purge_bars  # purge gap
        test_end = min(test_start + test_size, n_bars)
        folds.append({
            "fold_idx": i,
            "train_start": train_start,
            "train_end": train_end,
            "test_start": test_start,
            "test_end": test_end,
        })
    return folds


async def run_walk_forward(config: WalkConfig) -> dict[str, Any]:
    """Run walk-forward analysis, store folds, return results."""
    await ensure_walkforward_tables()

    prices = _synthetic_prices(config.n_bars)
    folds = compute_fold_ranges(config.n_bars, config.n_folds, config.purge_bars)
    now = datetime.now(tz=timezone.utc).isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO walk_configs (id, strategy, n_folds, purge_bars, n_bars, created_at) VALUES (?,?,?,?,?,?)",
            (config.id, config.strategy, config.n_folds, config.purge_bars, config.n_bars, now),
        )

        fold_results = []
        for f in folds:
            train_prices = prices[f["train_start"]:f["train_end"]]
            test_prices = prices[f["test_start"]:f["test_end"]]

            train_ret = _run_ma_cross_simple(train_prices, config.initial_capital) if len(train_prices) >= 8 else 0.0
            test_ret = _run_ma_cross_simple(test_prices, config.initial_capital) if len(test_prices) >= 8 else 0.0

            fold_id = str(uuid.uuid4())
            await db.execute(
                """INSERT INTO walk_folds
                   (id, config_id, fold_idx, train_start, train_end, test_start, test_end, train_return, test_return, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (fold_id, config.id, f["fold_idx"], f["train_start"], f["train_end"],
                 f["test_start"], f["test_end"], round(train_ret, 6), round(test_ret, 6), now),
            )
            fold_results.append({
                "fold_idx": f["fold_idx"],
                "train_start": f["train_start"],
                "train_end": f["train_end"],
                "test_start": f["test_start"],
                "test_end": f["test_end"],
                "train_return": round(train_ret, 6),
                "test_return": round(test_ret, 6),
                "purge_bars": config.purge_bars,
            })
        await db.commit()

    # Index to ES
    if AsyncElasticsearch is not None:
        es = None
        try:
            es = AsyncElasticsearch(ES_HOST)
            await es.index(
                index="apex-backtests-write",
                id=config.id,
                body={
                    "walk_config_id": config.id,
                    "strategy": config.strategy,
                    "n_folds": config.n_folds,
                    "fold_results": fold_results,
                    "created_at": now,
                    "type": "walk_forward",
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

    avg_train = sum(f["train_return"] for f in fold_results) / len(fold_results) if fold_results else 0.0
    avg_test = sum(f["test_return"] for f in fold_results) / len(fold_results) if fold_results else 0.0

    return {
        "config_id": config.id,
        "strategy": config.strategy,
        "n_folds": config.n_folds,
        "purge_bars": config.purge_bars,
        "folds": fold_results,
        "avg_train_return": round(avg_train, 6),
        "avg_test_return": round(avg_test, 6),
    }


# ─── Robustness matrix ────────────────────────────────────────────────────────

SLIPPAGE_LEVELS = [0.0, 0.001, 0.003]
SPREAD_LEVELS = [0.0, 0.5, 1.0]
DELAY_LEVELS = [0, 1]
LIQUIDITY_LEVELS = [1.0, 0.5]


async def run_robustness(config_id: str, n_bars: int = 40, initial_capital: float = 10_000.0) -> dict[str, Any]:
    """Run robustness matrix (slippage x spread x delay x liquidity)."""
    await ensure_walkforward_tables()

    prices = _synthetic_prices(n_bars)
    base_return = _run_ma_cross_simple(prices, initial_capital)
    now = datetime.now(tz=timezone.utc).isoformat()

    rows = []
    async with aiosqlite.connect(DB_PATH) as db:
        for slip in SLIPPAGE_LEVELS:
            for spread in SPREAD_LEVELS:
                for delay in DELAY_LEVELS:
                    for liq in LIQUIDITY_LEVELS:
                        adj = _run_ma_cross_simple(
                            prices, initial_capital,
                            slippage=slip, spread=spread,
                            delay_bars=delay, liquidity_cap=liq,
                        )
                        delta = adj - base_return
                        row_id = str(uuid.uuid4())
                        await db.execute(
                            """INSERT INTO robustness_runs
                               (id, config_id, slippage, spread, delay_bars, liquidity_cap, base_return, adj_return, delta, created_at)
                               VALUES (?,?,?,?,?,?,?,?,?,?)""",
                            (row_id, config_id, slip, spread, delay, liq,
                             round(base_return, 6), round(adj, 6), round(delta, 6), now),
                        )
                        rows.append({
                            "slippage": slip,
                            "spread": spread,
                            "delay_bars": delay,
                            "liquidity_cap": liq,
                            "base_return": round(base_return, 6),
                            "adj_return": round(adj, 6),
                            "delta": round(delta, 6),
                        })
        await db.commit()

    return {
        "config_id": config_id,
        "base_return": round(base_return, 6),
        "matrix": rows,
        "count": len(rows),
    }


# ─── Sensitivity heatmap ──────────────────────────────────────────────────────

def compute_sensitivity_heatmap(n_bars: int = 40, initial_capital: float = 10_000.0) -> dict[str, Any]:
    """Return slippage × spread return matrix for heatmap rendering."""
    prices = _synthetic_prices(n_bars)
    heatmap = []
    for slip in SLIPPAGE_LEVELS:
        row = []
        for spread in SPREAD_LEVELS:
            ret = _run_ma_cross_simple(prices, initial_capital, slippage=slip, spread=spread)
            row.append(round(ret, 6))
        heatmap.append({
            "slippage": slip,
            "returns_by_spread": {str(s): r for s, r in zip(SPREAD_LEVELS, row)},
        })
    return {
        "slippage_levels": SLIPPAGE_LEVELS,
        "spread_levels": SPREAD_LEVELS,
        "heatmap": heatmap,
    }


# ─── DB queries ──────────────────────────────────────────────────────────────

async def list_configs(limit: int = 20) -> list[dict[str, Any]]:
    await ensure_walkforward_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM walk_configs ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def list_folds(config_id: str) -> list[dict[str, Any]]:
    await ensure_walkforward_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM walk_folds WHERE config_id=? ORDER BY fold_idx", (config_id,))
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def list_robustness_runs(config_id: str) -> list[dict[str, Any]]:
    await ensure_walkforward_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM robustness_runs WHERE config_id=?", (config_id,))
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def clear_walkforward_data() -> dict[str, Any]:
    await ensure_walkforward_tables()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM walk_folds")
        await db.execute("DELETE FROM robustness_runs")
        cur = await db.execute("DELETE FROM walk_configs")
        await db.commit()
    return {"ok": True, "deleted": cur.rowcount}
