"""
prime_market_cache.py — 7-year daily bar hydration for the market universe.

Downloads daily OHLCV for each symbol in settings.market_universe using the
ProviderRouter (yfinance primary, Tiingo/Polygon fallback), stores them via
the canonical storage layer, and writes a local_cache manifest.

Usage:
    python -m scripts.prime_market_cache            # full universe, 7y
    python -m scripts.prime_market_cache --symbols AAPL MSFT --years 1

NON-NEGOTIABLE: all data is real. No demo/mock/fake prices.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

# Ensure the workspace root is on PYTHONPATH
_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))
sys.path.insert(0, str(_root / "phase1"))

import structlog

logger = structlog.get_logger("prime_market_cache")


async def prime(symbols: list[str], years: int, cache_dir: Path) -> dict:
    """
    Download daily bars for *symbols* over *years* and persist to DB + local cache.
    Returns summary dict.
    """
    from phase1.services.config import get_settings
    from phase1.services.market_data.provider_router import get_router
    from phase1.services.market_data.providers.types import BarsRequest, IntervalType
    from phase1.services.market_data.models import compute_bars_sha256, BarDaily

    settings = get_settings()
    router = get_router()

    end = datetime.utcnow()
    start = end - timedelta(days=365 * years + 30)  # extra buffer

    cache_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict = {
        "generated_at": datetime.utcnow().isoformat(),
        "years": years,
        "symbols": {},
    }
    summary = {"ok": [], "fail": [], "total_bars": 0}

    for sym in symbols:
        logger.info("prime_start", symbol=sym, years=years)
        t0 = time.monotonic()
        try:
            req = BarsRequest(symbol=sym, start=start, end=end, interval=IntervalType.DAY_1)
            resp = await router.get_bars(req)
            bars = resp.bars
            elapsed = time.monotonic() - t0

            # Write bars to local cache as JSON lines
            sym_file = cache_dir / f"{sym.upper()}_daily.jsonl"
            with open(sym_file, "w") as f:
                for b in bars:
                    f.write(json.dumps({
                        "timestamp": b.timestamp.isoformat(),
                        "open": b.open, "high": b.high,
                        "low": b.low, "close": b.close,
                        "volume": int(b.volume),
                    }) + "\n")

            # Compute checksum
            canonicals = [
                BarDaily(
                    symbol=sym.upper(), date=b.timestamp,
                    open=b.open, high=b.high, low=b.low, close=b.close,
                    volume=int(b.volume), adj_close=b.close,
                    source=resp.provider.value if hasattr(resp.provider, 'value') else str(resp.provider),
                    fetched_at=datetime.utcnow(),
                )
                for b in bars
            ]
            sha = compute_bars_sha256(canonicals)

            manifest["symbols"][sym.upper()] = {
                "file": str(sym_file.name),
                "bar_count": len(bars),
                "first": bars[0].timestamp.isoformat() if bars else None,
                "last": bars[-1].timestamp.isoformat() if bars else None,
                "sha256": sha,
                "provider": resp.provider.value if hasattr(resp.provider, 'value') else str(resp.provider),
                "elapsed_s": round(elapsed, 2),
            }
            summary["ok"].append(sym)
            summary["total_bars"] += len(bars)
            logger.info("prime_ok", symbol=sym, bars=len(bars), sha=sha[:16], elapsed_s=round(elapsed, 2))

        except Exception as e:
            summary["fail"].append({"symbol": sym, "error": str(e)})
            logger.error("prime_fail", symbol=sym, error=str(e))

    # Write manifest
    manifest_path = cache_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    logger.info("manifest_written", path=str(manifest_path))

    return summary


def main():
    parser = argparse.ArgumentParser(description="Prime market data cache")
    parser.add_argument("--symbols", nargs="+", default=None, help="Symbols to prime (default: market_universe)")
    parser.add_argument("--years", type=int, default=None, help="Years of history (default: settings.market_history_years)")
    parser.add_argument("--cache-dir", type=str, default=None, help="Local cache directory")
    args = parser.parse_args()

    # Load settings
    from phase1.services.config import get_settings
    settings = get_settings()

    symbols = args.symbols or settings.universe_list
    years = args.years or settings.market_history_years
    cache_dir = Path(args.cache_dir) if args.cache_dir else (_root / "local_cache" / "market")

    print(f"Priming {len(symbols)} symbols × {years}y → {cache_dir}")
    result = asyncio.run(prime(symbols, years, cache_dir))
    print(f"\n✓ OK: {len(result['ok'])}  ✗ FAIL: {len(result['fail'])}  Total bars: {result['total_bars']}")
    if result["fail"]:
        for f in result["fail"]:
            print(f"  FAIL {f['symbol']}: {f['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
