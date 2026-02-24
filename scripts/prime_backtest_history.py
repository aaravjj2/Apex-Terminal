#!/usr/bin/env python3
"""
Prime Backtest History — download 7 years of daily bars for configured universe.

Usage:
    python scripts/prime_backtest_history.py                # all default symbols
    python scripts/prime_backtest_history.py AAPL MSFT      # specific symbols
    python scripts/prime_backtest_history.py --years 5      # custom lookback
"""

import argparse
import json
import sys
import os

# Ensure project root is on path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "phase1"))

from phase1.services.backtest_engine.data_pipeline import (
    prime_universe,
    prime_symbol,
    write_manifest,
    DEFAULT_UNIVERSE,
)


def main():
    parser = argparse.ArgumentParser(description="Prime backtest history cache")
    parser.add_argument("symbols", nargs="*", help="Symbols to prime (default: full universe)")
    parser.add_argument("--years", type=int, default=7, help="Years of history (default: 7)")
    args = parser.parse_args()

    symbols = [s.upper() for s in args.symbols] if args.symbols else DEFAULT_UNIVERSE

    print(f"Priming {len(symbols)} symbols with {args.years}y history...")
    print(f"Symbols: {', '.join(symbols)}\n")

    results = prime_universe(symbols, years=args.years)

    print("\n" + "=" * 60)
    print("PRIME RESULTS")
    print("=" * 60)
    ok = 0
    for sym, info in results.items():
        status = info["status"]
        if status == "ok":
            print(f"  ✓ {sym:6s}  {info['rows']:>5d} rows  sha256={info['sha256'][:16]}…")
            ok += 1
        else:
            print(f"  ✗ {sym:6s}  ERROR: {info['error']}")
    print(f"\n{ok}/{len(symbols)} symbols primed successfully.")

    if ok < len(symbols):
        sys.exit(1)


if __name__ == "__main__":
    main()
