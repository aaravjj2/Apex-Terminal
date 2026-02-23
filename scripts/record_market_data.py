#!/usr/bin/env python3
"""
Record authentic market data from Yahoo Finance.

Usage:
    python scripts/record_market_data.py [--set core-default] [--start 2024-01-02] [--end 2024-03-28]

Outputs:
    data/recordings/<set>/market_data/<SYMBOL>_<TF>.parquet
    data/recordings/<set>/manifest.json (updated with hashes)

NO synthetic data — all data sourced from Yahoo Finance historical feed.
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

import pandas as pd

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def record_market_data(
    recording_set: str = "core-default",
    symbols: list[str] | None = None,
    start: str = "2024-01-02",
    end: str = "2024-03-28",
    timeframes: list[str] | None = None,
) -> dict:
    try:
        import yfinance as yf
        yf_version = yf.__version__
    except ImportError:
        print("ERROR: yfinance not installed. Run: pip install yfinance")
        sys.exit(1)

    symbols = symbols or ["AAPL", "MSFT", "SPY", "TSLA"]
    timeframes = timeframes or ["1d"]

    tf_map = {
        "1d": "1d",
        "1h": "1h",
        "5m": "5m",
    }

    out_dir = os.path.join(WORKSPACE_ROOT, "data", "recordings", recording_set, "market_data")
    os.makedirs(out_dir, exist_ok=True)

    files_meta: dict[str, dict] = {}
    performance_summary: dict[str, dict] = {}

    print(f"Recording {len(symbols)} symbols × {len(timeframes)} timeframes → {out_dir}")

    for symbol in symbols:
        ticker = yf.Ticker(symbol)
        sym_perf: dict[str, float] = {}

        for tf in timeframes:
            yfk = tf_map.get(tf, tf)
            print(f"  {symbol}/{tf} ... ", end="", flush=True)
            df = ticker.history(start=start, end=end, interval=yfk, auto_adjust=True)
            if df.empty:
                print("EMPTY — skip")
                continue

            # Normalize column names to lowercase
            df.columns = [c.lower().replace(" ", "_") for c in df.columns]
            df.index.name = "timestamp"

            filename = f"{symbol}_{tf}.parquet"
            filepath = os.path.join(out_dir, filename)
            df.to_parquet(filepath, engine="pyarrow", compression="snappy")

            h = sha256_file(filepath)
            size = os.path.getsize(filepath)
            files_meta[f"market_data/{filename}"] = {"size_bytes": size, "sha256": h}
            print(f"OK ({len(df)} bars, {size:,} bytes, {h[:22]}…)")

            # Compute performance summary for daily bars
            if tf == "1d" and "close" in df.columns and len(df) > 1:
                closes = df["close"]
                daily_ret = closes.pct_change().dropna()
                total_ret = (closes.iloc[-1] / closes.iloc[0] - 1) * 100
                sharpe = (daily_ret.mean() / daily_ret.std() * (252 ** 0.5)) if daily_ret.std() > 0 else 0.0
                drawdown = ((closes - closes.cummax()) / closes.cummax()).min() * 100
                sym_perf[tf] = {
                    "bars": len(df),
                    "first_date": str(df.index[0].date()),
                    "last_date": str(df.index[-1].date()),
                    "first_close": round(float(closes.iloc[0]), 4),
                    "last_close": round(float(closes.iloc[-1]), 4),
                    "total_return_pct": round(float(total_ret), 4),
                    "annualized_sharpe": round(float(sharpe), 4),
                    "max_drawdown_pct": round(float(drawdown), 4),
                }

        if sym_perf:
            performance_summary[symbol] = sym_perf

    return {
        "files": files_meta,
        "performance_summary": performance_summary,
        "yf_version": yf_version,
        "symbols": symbols,
        "timeframes": timeframes,
        "date_range": {"start": start, "end": end},
    }


def write_manifest(
    recording_set: str,
    recording_result: dict,
) -> str:
    base_dir = os.path.join(WORKSPACE_ROOT, "data", "recordings", recording_set)
    manifest_path = os.path.join(base_dir, "manifest.json")

    # Load existing manifest if present
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest = json.load(f)
    else:
        manifest = {}

    manifest.update({
        "set_name": recording_set,
        "version": "1.0.0",
        "description": "Authentic recorded market data for core algorithm testing",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "captured_by": "scripts/record_market_data.py v1.0.0",
        "provider": {
            "name": "Yahoo Finance",
            "library": "yfinance",
            "version": recording_result.get("yf_version", "unknown"),
            "url": "https://finance.yahoo.com",
        },
        "symbols": recording_result["symbols"],
        "timeframes": recording_result["timeframes"],
        "date_range": recording_result["date_range"],
        "performance_summary": recording_result["performance_summary"],
        "files": {
            **manifest.get("files", {}),
            **recording_result["files"],
        },
    })

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)

    print(f"\n✓ Manifest written to {manifest_path}")
    return manifest_path


def main():
    parser = argparse.ArgumentParser(description="Record authentic market data")
    parser.add_argument("--set", default="core-default", help="Recording set name")
    parser.add_argument("--symbols", nargs="+", default=["AAPL", "MSFT", "SPY", "TSLA"])
    parser.add_argument("--start", default="2024-01-02")
    parser.add_argument("--end", default="2024-03-28")
    parser.add_argument("--timeframes", nargs="+", default=["1d"])
    args = parser.parse_args()

    result = record_market_data(
        recording_set=args.set,
        symbols=args.symbols,
        start=args.start,
        end=args.end,
        timeframes=args.timeframes,
    )
    write_manifest(args.set, result)


if __name__ == "__main__":
    main()
