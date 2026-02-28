"""
Backtest Data Pipeline — yfinance 7-year daily history with provenance + checksums.

Fetches, normalises, persists and validates daily OHLCV bars for backtesting.
All data is stored as canonical BarDaily records with SHA-256 checksums.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import structlog

from ..market_data.models import BarDaily, compute_bars_sha256, SymbolHealth, BatchRecord

logger = structlog.get_logger(__name__)

# Default universe of symbols
DEFAULT_UNIVERSE = ["SPY", "AAPL", "MSFT", "TSLA", "NVDA", "GOOGL", "AMZN", "META", "QQQ", "AMD"]

# Canonical data directory
_DATA_DIR = Path(os.environ.get(
    "BACKTEST_DATA_DIR",
    str(Path(__file__).resolve().parents[3] / ".cache" / "backtest_data"),
))


def _ensure_dir() -> Path:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    return _DATA_DIR


def _symbol_path(symbol: str) -> Path:
    return _ensure_dir() / f"{symbol.upper()}.json"


def _manifest_path() -> Path:
    return _ensure_dir() / "manifest.json"


# ── Fetching ─────────────────────────────────────────────────────────────────

def fetch_daily(
    symbol: str,
    start: dt.date,
    end: dt.date,
    *,
    provider: str = "yfinance",
) -> List[BarDaily]:
    """
    Download daily OHLCV bars from Yahoo Finance for *symbol* between *start*
    and *end* (inclusive).  Returns canonical BarDaily list sorted by date.

    Raises RuntimeError on failure (network, bad symbol, etc.).
    """
    import yfinance as yf

    sym = symbol.upper().strip()
    if not sym or not sym.isalpha():
        raise ValueError(f"Invalid symbol: {symbol!r}")

    logger.info("fetch_daily", symbol=sym, start=str(start), end=str(end))
    t0 = time.monotonic()

    try:
        ticker = yf.Ticker(sym)
        # end is exclusive in yfinance, so +1 day
        end_exclusive = end + dt.timedelta(days=1)
        hist = ticker.history(
            start=start.isoformat(),
            end=end_exclusive.isoformat(),
            interval="1d",
            auto_adjust=False,   # we want raw close + adj close
        )
    except Exception as exc:
        raise RuntimeError(f"yfinance fetch failed for {sym}: {exc}") from exc

    if hist.empty:
        raise RuntimeError(f"No data returned by yfinance for {sym} ({start} – {end})")

    now = dt.datetime.utcnow()
    bars: List[BarDaily] = []
    for idx, row in hist.iterrows():
        trading_date = idx.date() if hasattr(idx, "date") else idx
        # yfinance may return Adj Close or Close depending on auto_adjust
        adj_close = float(row.get("Adj Close", row["Close"]))
        bars.append(BarDaily(
            symbol=sym,
            date=trading_date,
            open=round(float(row["Open"]), 4),
            high=round(float(row["High"]), 4),
            low=round(float(row["Low"]), 4),
            close=round(float(row["Close"]), 4),
            adj_close=round(adj_close, 4),
            volume=int(row["Volume"]),
            source=provider,
            fetched_at=now,
        ))

    bars.sort(key=lambda b: b.date)
    elapsed = round((time.monotonic() - t0) * 1000, 1)
    logger.info("fetch_daily_ok", symbol=sym, rows=len(bars), ms=elapsed)
    return bars


# ── Persistence ──────────────────────────────────────────────────────────────

def store_bars(bars: List[BarDaily]) -> BatchRecord:
    """
    Persist a list of BarDaily to disk with provenance metadata.
    Returns a BatchRecord with checksum.
    """
    if not bars:
        raise ValueError("Cannot store empty bars list")

    symbol = bars[0].symbol
    bars_sorted = sorted(bars, key=lambda b: b.date)
    checksum = compute_bars_sha256(bars_sorted)

    batch = BatchRecord(
        batch_id=f"batch-{uuid.uuid4().hex[:12]}",
        provider=bars_sorted[0].source,
        symbol=symbol,
        timeframe="1d",
        start_date=bars_sorted[0].date,
        end_date=bars_sorted[-1].date,
        fetched_at=bars_sorted[0].fetched_at,
        sha256=checksum,
        row_count=len(bars_sorted),
    )

    payload = {
        "batch": batch.model_dump(mode="json"),
        "bars": [b.model_dump(mode="json") for b in bars_sorted],
    }

    path = _symbol_path(symbol)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    logger.info("store_bars", symbol=symbol, rows=len(bars_sorted), path=str(path))
    return batch


def load_bars(
    symbol: str,
    start: Optional[dt.date] = None,
    end: Optional[dt.date] = None,
) -> Tuple[List[BarDaily], Optional[BatchRecord]]:
    """
    Load persisted bars for *symbol*.  If *start*/*end* are given, filter to
    that range.  Returns (bars, batch_record).  If no data on disk, returns
    ([], None).
    """
    path = _symbol_path(symbol.upper())
    if not path.exists():
        return [], None

    raw = json.loads(path.read_text(encoding="utf-8"))
    batch = BatchRecord(**raw["batch"])
    bars = [BarDaily(**b) for b in raw["bars"]]

    if start:
        bars = [b for b in bars if b.date >= start]
    if end:
        bars = [b for b in bars if b.date <= end]

    bars.sort(key=lambda b: b.date)
    return bars, batch


def verify_checksum(symbol: str) -> bool:
    """Re-compute SHA-256 for stored bars and compare with stored checksum."""
    bars, batch = load_bars(symbol)
    if not bars or not batch:
        return False
    recomputed = compute_bars_sha256(bars)
    return recomputed == batch.sha256


# ── Health ───────────────────────────────────────────────────────────────────

def _expected_trading_days(start: dt.date, end: dt.date) -> int:
    """Rough count of expected NYSE trading days between start and end."""
    count = 0
    d = start
    while d <= end:
        if d.weekday() < 5:   # Mon-Fri
            count += 1
        d += dt.timedelta(days=1)
    # Subtract ~10 holidays/year
    years = max((end - start).days / 365.25, 0)
    return max(count - int(years * 10), 0)


def get_symbol_health(symbol: str) -> SymbolHealth:
    """Return coverage health for a single symbol."""
    bars, batch = load_bars(symbol.upper())
    if not bars:
        return SymbolHealth(symbol=symbol.upper(), status="error")

    earliest = bars[0].date
    latest = bars[-1].date
    expected = _expected_trading_days(earliest, latest)
    actual = len(bars)
    missing_pct = round(max(0, (expected - actual) / expected * 100) if expected else 0, 2)

    status = "ok" if missing_pct < 3 else ("warning" if missing_pct < 10 else "error")

    return SymbolHealth(
        symbol=symbol.upper(),
        total_rows=actual,
        earliest_date=earliest,
        latest_date=latest,
        missing_pct=missing_pct,
        expected_trading_days=expected,
        actual_trading_days=actual,
        last_fetch=batch.fetched_at if batch else None,
        provider=batch.provider if batch else "",
        status=status,
    )


# ── Manifest ─────────────────────────────────────────────────────────────────

def write_manifest(symbols: List[str]) -> Dict:
    """Write a manifest with checksums for all stored symbols."""
    manifest: Dict = {
        "generated_at": dt.datetime.utcnow().isoformat(),
        "symbols": {},
    }
    for sym in symbols:
        bars, batch = load_bars(sym)
        if batch:
            manifest["symbols"][sym] = {
                "rows": batch.row_count,
                "start": str(batch.start_date),
                "end": str(batch.end_date),
                "sha256": batch.sha256,
                "provider": batch.provider,
            }
    _manifest_path().write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


# ── Prime helper ─────────────────────────────────────────────────────────────

def prime_symbol(symbol: str, years: int = 7) -> BatchRecord:
    """
    Download + persist *years* of daily history for *symbol*.
    Returns BatchRecord.
    """
    end = dt.date.today()
    start = end - dt.timedelta(days=int(years * 365.25))
    bars = fetch_daily(symbol, start, end)
    return store_bars(bars)


def prime_universe(symbols: Optional[List[str]] = None, years: int = 7) -> Dict:
    """Prime the full universe and write manifest."""
    syms = symbols or DEFAULT_UNIVERSE
    results: Dict = {}
    for sym in syms:
        try:
            batch = prime_symbol(sym, years)
            results[sym] = {"status": "ok", "rows": batch.row_count, "sha256": batch.sha256}
        except Exception as e:
            results[sym] = {"status": "error", "error": str(e)}
            logger.error("prime_failed", symbol=sym, error=str(e))
    write_manifest(syms)
    return results
