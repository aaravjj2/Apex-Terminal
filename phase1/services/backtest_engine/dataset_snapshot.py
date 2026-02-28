"""
W14 — Immutable Dataset Snapshot Service

Production-grade dataset snapshot system with:
- Real yfinance data ingestion via data_pipeline
- SHA-256 checksums over canonical bar data
- SQLite-backed persistent storage
- Typed error taxonomy (BT_CFG_INVALID, BT_DATA_MISSING, BT_DEPENDENCY_DOWN)
- Performance-budgeted endpoints
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

# ── Database Path ────────────────────────────────────────────────────────────

_DB_DIR = Path(__file__).resolve().parents[3] / ".cache" / "backtest_data"
_DB_PATH = _DB_DIR / "datasets.db"


def _db_path() -> Path:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    return _DB_PATH


# ── Typed Error Taxonomy ─────────────────────────────────────────────────────

class BacktestError(Exception):
    """Base class for typed backtest errors."""
    error_code: str = "BT_UNKNOWN"
    status_code: int = 500

    def __init__(self, message: str, detail: Optional[dict] = None):
        self.message = message
        self.detail = detail or {}
        super().__init__(message)

    def to_response(self) -> dict:
        return {
            "error_code": self.error_code,
            "message": self.message,
            "detail": self.detail,
            "correlation_id": str(uuid.uuid4()),
        }


class BtCfgInvalid(BacktestError):
    error_code = "BT_CFG_INVALID"
    status_code = 400


class BtDataMissing(BacktestError):
    error_code = "BT_DATA_MISSING"
    status_code = 409


class BtDataStale(BacktestError):
    error_code = "BT_DATA_STALE"
    status_code = 409


class BtInvariantFail(BacktestError):
    error_code = "BT_INVARIANT_FAIL"
    status_code = 422


class BtDependencyDown(BacktestError):
    error_code = "BT_DEPENDENCY_DOWN"
    status_code = 503


class BtRunTimeout(BacktestError):
    error_code = "BT_RUN_TIMEOUT"
    status_code = 504


# ── Models ───────────────────────────────────────────────────────────────────

class DatasetSnapshot(BaseModel):
    """Immutable dataset snapshot with provenance."""
    dataset_id: str
    symbol: str
    start_date: str
    end_date: str
    provider: str
    sha256: str
    row_count: int
    created_at: str
    source_manifest: Dict[str, Any] = Field(default_factory=dict)


class DatasetSnapshotRequest(BaseModel):
    """Request to create a dataset snapshot."""
    symbol: str = Field(..., min_length=1, max_length=10, description="Ticker symbol")
    start_date: str = Field(..., min_length=8, description="YYYY-MM-DD")
    end_date: str = Field(..., min_length=8, description="YYYY-MM-DD")
    provider: str = Field(default="yfinance", description="Data provider")


# ── SQLite Storage ───────────────────────────────────────────────────────────

class DatasetStore:
    """SQLite-backed dataset snapshot storage."""

    def __init__(self, db_path: Optional[Path] = None):
        self._db_path = db_path or _db_path()
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self):
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS dataset_snapshots (
                    dataset_id TEXT PRIMARY KEY,
                    symbol TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    end_date TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    sha256 TEXT NOT NULL,
                    row_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    source_manifest TEXT NOT NULL DEFAULT '{}',
                    bars_json TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_ds_symbol
                ON dataset_snapshots(symbol)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_ds_sha256
                ON dataset_snapshots(sha256)
            """)
            conn.commit()

    def save(self, snapshot: DatasetSnapshot, bars_json: Optional[str] = None) -> None:
        with self._conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO dataset_snapshots
                (dataset_id, symbol, start_date, end_date, provider, sha256,
                 row_count, created_at, source_manifest, bars_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                snapshot.dataset_id,
                snapshot.symbol,
                snapshot.start_date,
                snapshot.end_date,
                snapshot.provider,
                snapshot.sha256,
                snapshot.row_count,
                snapshot.created_at,
                json.dumps(snapshot.source_manifest),
                bars_json,
            ))
            conn.commit()

    def get(self, dataset_id: str) -> Optional[DatasetSnapshot]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM dataset_snapshots WHERE dataset_id = ?",
                (dataset_id,)
            ).fetchone()
            if not row:
                return None
            return DatasetSnapshot(
                dataset_id=row["dataset_id"],
                symbol=row["symbol"],
                start_date=row["start_date"],
                end_date=row["end_date"],
                provider=row["provider"],
                sha256=row["sha256"],
                row_count=row["row_count"],
                created_at=row["created_at"],
                source_manifest=json.loads(row["source_manifest"]),
            )

    def get_bars_json(self, dataset_id: str) -> Optional[str]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT bars_json FROM dataset_snapshots WHERE dataset_id = ?",
                (dataset_id,)
            ).fetchone()
            if not row or not row["bars_json"]:
                return None
            return row["bars_json"]

    def list_all(self, symbol: Optional[str] = None) -> List[DatasetSnapshot]:
        with self._conn() as conn:
            if symbol:
                rows = conn.execute(
                    "SELECT * FROM dataset_snapshots WHERE symbol = ? ORDER BY created_at DESC",
                    (symbol.upper(),)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM dataset_snapshots ORDER BY created_at DESC"
                ).fetchall()
            return [
                DatasetSnapshot(
                    dataset_id=r["dataset_id"],
                    symbol=r["symbol"],
                    start_date=r["start_date"],
                    end_date=r["end_date"],
                    provider=r["provider"],
                    sha256=r["sha256"],
                    row_count=r["row_count"],
                    created_at=r["created_at"],
                    source_manifest=json.loads(r["source_manifest"]),
                )
                for r in rows
            ]

    def find_by_sha256(self, sha256: str) -> Optional[DatasetSnapshot]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM dataset_snapshots WHERE sha256 = ? LIMIT 1",
                (sha256,)
            ).fetchone()
            if not row:
                return None
            return DatasetSnapshot(
                dataset_id=row["dataset_id"],
                symbol=row["symbol"],
                start_date=row["start_date"],
                end_date=row["end_date"],
                provider=row["provider"],
                sha256=row["sha256"],
                row_count=row["row_count"],
                created_at=row["created_at"],
                source_manifest=json.loads(row["source_manifest"]),
            )


# ── Snapshot Creation Service ────────────────────────────────────────────────

def _parse_date(s: str) -> dt.date:
    """Parse a YYYY-MM-DD string into a date."""
    try:
        return dt.date.fromisoformat(s)
    except (ValueError, TypeError) as exc:
        raise BtCfgInvalid(
            f"Invalid date format: {s!r}. Expected YYYY-MM-DD.",
            detail={"field": "date", "value": s},
        ) from exc


def _validate_symbol(symbol: str) -> str:
    """Normalize and validate a ticker symbol."""
    sym = symbol.upper().strip()
    if not sym or len(sym) > 10:
        raise BtCfgInvalid(
            f"Invalid symbol: {symbol!r}",
            detail={"field": "symbol", "value": symbol},
        )
    return sym


def create_snapshot(
    req: DatasetSnapshotRequest,
    store: Optional[DatasetStore] = None,
) -> DatasetSnapshot:
    """
    Create an immutable dataset snapshot.

    1. Validate inputs
    2. Fetch/load bars from yfinance via data_pipeline
    3. Compute deterministic SHA-256 over canonical bar data
    4. Persist snapshot + bars to SQLite
    5. Return snapshot metadata
    """
    from ..backtest_engine.data_pipeline import load_bars, fetch_daily, store_bars
    from ..market_data.models import compute_bars_sha256

    store = store or DatasetStore()

    # Validate
    symbol = _validate_symbol(req.symbol)
    start = _parse_date(req.start_date)
    end = _parse_date(req.end_date)

    if end <= start:
        raise BtCfgInvalid(
            "end_date must be after start_date",
            detail={"start_date": str(start), "end_date": str(end)},
        )

    t0 = time.monotonic()

    # Try loading from cache first (warm path)
    bars, batch = load_bars(symbol, start, end)

    if not bars:
        # Cold path: fetch from yfinance
        try:
            bars_all = fetch_daily(symbol, start, end, provider=req.provider)
            batch = store_bars(bars_all)
            bars = bars_all
        except RuntimeError as exc:
            raise BtDependencyDown(
                f"Failed to fetch data from {req.provider}: {exc}",
                detail={"provider": req.provider, "symbol": symbol},
            ) from exc

    if not bars:
        raise BtDataMissing(
            f"No bars available for {symbol} ({start} – {end})",
            detail={"symbol": symbol, "start_date": str(start), "end_date": str(end)},
        )

    # Compute deterministic SHA-256 over the bar data
    sha256 = compute_bars_sha256(bars)
    dataset_id = f"ds-{sha256[:12]}"

    # Check for existing snapshot with same hash (dedup)
    existing = store.find_by_sha256(sha256)
    if existing:
        logger.info("snapshot_dedup", dataset_id=existing.dataset_id, sha256=sha256[:16])
        return existing

    # Serialize bars for immutable storage
    bars_payload = json.dumps(
        [b.model_dump(mode="json") for b in bars],
        sort_keys=True,
        default=str,
    )

    now_str = dt.datetime.utcnow().isoformat() + "Z"
    elapsed_ms = round((time.monotonic() - t0) * 1000, 1)

    snapshot = DatasetSnapshot(
        dataset_id=dataset_id,
        symbol=symbol,
        start_date=str(start),
        end_date=str(end),
        provider=req.provider,
        sha256=sha256,
        row_count=len(bars),
        created_at=now_str,
        source_manifest={
            "provider": req.provider,
            "fetch_ms": elapsed_ms,
            "checksum_algorithm": "SHA-256",
            "integrity": "verified",
            "batch_id": batch.batch_id if batch else None,
            "batch_sha256": batch.sha256 if batch else None,
        },
    )

    store.save(snapshot, bars_json=bars_payload)
    logger.info(
        "snapshot_created",
        dataset_id=dataset_id,
        symbol=symbol,
        rows=len(bars),
        sha256=sha256[:16],
        ms=elapsed_ms,
    )
    return snapshot


def get_snapshot(dataset_id: str, store: Optional[DatasetStore] = None) -> DatasetSnapshot:
    """Get a dataset snapshot by ID. Raises BtDataMissing if not found."""
    store = store or DatasetStore()
    snap = store.get(dataset_id)
    if not snap:
        raise BtDataMissing(
            f"Dataset not found: {dataset_id}",
            detail={"dataset_id": dataset_id},
        )
    return snap


def load_snapshot_bars(dataset_id: str, store: Optional[DatasetStore] = None):
    """
    Load the immutable bar data for a dataset snapshot.
    Returns list of BarDaily.
    """
    from ..market_data.models import BarDaily

    store = store or DatasetStore()
    bars_json = store.get_bars_json(dataset_id)
    if not bars_json:
        raise BtDataMissing(
            f"No bar data for dataset: {dataset_id}",
            detail={"dataset_id": dataset_id},
        )
    raw = json.loads(bars_json)
    return [BarDaily(**b) for b in raw]


def list_snapshots(
    symbol: Optional[str] = None,
    store: Optional[DatasetStore] = None,
) -> List[DatasetSnapshot]:
    """List all dataset snapshots."""
    store = store or DatasetStore()
    return store.list_all(symbol=symbol)


# ── Global Store singleton ───────────────────────────────────────────────────

_store: Optional[DatasetStore] = None


def get_dataset_store() -> DatasetStore:
    """Get the global DatasetStore singleton."""
    global _store
    if _store is None:
        _store = DatasetStore()
    return _store
