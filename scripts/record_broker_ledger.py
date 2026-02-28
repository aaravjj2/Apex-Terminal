#!/usr/bin/env python3
"""
Record paper broker ledger derived from authentic recorded market data.

Applies a simple momentum strategy to the recorded bar data, producing
fills + positions that are fully deterministic and traceable to the recording.

Usage:
    python scripts/record_broker_ledger.py [--set core-default]

Outputs:
    data/recordings/<set>/broker_ledger/fills.jsonl
    data/recordings/<set>/broker_ledger/positions.jsonl
    (manifest.json updated with ledger section)
"""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone

import pandas as pd

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def load_bars(recording_set: str, symbol: str, tf: str = "1d") -> pd.DataFrame:
    path = os.path.join(
        WORKSPACE_ROOT, "data", "recordings", recording_set,
        "market_data", f"{symbol}_{tf}.parquet"
    )
    if not os.path.exists(path):
        raise FileNotFoundError(f"No recording at {path}")
    return pd.read_parquet(path, engine="pyarrow")


def momentum_signal(df: pd.DataFrame, fast: int = 5, slow: int = 20) -> pd.Series:
    """Simple dual-MA crossing signal: +1 long, -1 short, 0 flat."""
    ma_fast = df["close"].rolling(fast).mean()
    ma_slow = df["close"].rolling(slow).mean()
    signal = pd.Series(0, index=df.index)
    signal[ma_fast > ma_slow] = 1
    signal[ma_fast < ma_slow] = -1
    return signal


def derive_paper_trades(
    recording_set: str,
    symbols: list[str],
    initial_capital: float = 100_000.0,
    position_size_pct: float = 0.20,  # 20% per position
) -> tuple[list[dict], list[dict], dict]:
    """Derive paper fills from recorded bars using momentum strategy."""
    all_fills = []
    final_positions = []
    summary: dict = {}

    for symbol in symbols:
        df = load_bars(recording_set, symbol)
        sig = momentum_signal(df)

        current_pos = 0  # current shares held (+ long, - short, 0 flat)
        current_side: str | None = None
        total_pnl = 0.0
        num_fills = 0

        for i in range(1, len(df)):
            row = df.iloc[i]
            prev_sig = int(sig.iloc[i - 1])
            curr_sig = int(sig.iloc[i])

            if curr_sig == prev_sig or curr_sig == 0:
                continue

            price = float(row["close"])
            ts = row.name.isoformat() if hasattr(row.name, "isoformat") else str(row.name)

            # Close previous position
            if current_pos != 0 and curr_sig != (1 if current_pos > 0 else -1):
                close_side = "sell" if current_pos > 0 else "buy"
                pnl = current_pos * (price - entry_price)  # noqa: F821
                fill_id = f"fill-{symbol}-{num_fills:04d}"
                all_fills.append({
                    "fill_id": fill_id,
                    "symbol": symbol,
                    "side": close_side,
                    "quantity": abs(current_pos),
                    "price": round(price, 4),
                    "fee": round(abs(current_pos) * 0.005, 4),  # $0.005/share
                    "slippage_bps": 1.0,
                    "pnl": round(pnl, 4),
                    "ts": ts,
                    "recording_set": recording_set,
                    "strategy": "momentum_5_20",
                })
                total_pnl += pnl
                num_fills += 1
                current_pos = 0
                current_side = None

            # Open new position
            if curr_sig != 0:
                notional = initial_capital * position_size_pct
                shares = int(notional / price)
                if shares < 1:
                    continue
                open_side = "buy" if curr_sig > 0 else "sell"
                entry_price = price  # noqa: F841
                current_pos = shares if curr_sig > 0 else -shares
                current_side = open_side  # noqa: F841
                fill_id = f"fill-{symbol}-{num_fills:04d}"
                all_fills.append({
                    "fill_id": fill_id,
                    "symbol": symbol,
                    "side": open_side,
                    "quantity": shares,
                    "price": round(price, 4),
                    "fee": round(shares * 0.005, 4),
                    "slippage_bps": 1.0,
                    "pnl": 0.0,  # unrealized at open
                    "ts": ts,
                    "recording_set": recording_set,
                    "strategy": "momentum_5_20",
                })
                num_fills += 1

        # Final mark
        if current_pos != 0:
            last_price = float(df["close"].iloc[-1])
            last_ts = df.index[-1].isoformat() if hasattr(df.index[-1], "isoformat") else str(df.index[-1])
            unrealized = current_pos * (last_price - entry_price)  # noqa: F821
            final_positions.append({
                "symbol": symbol,
                "side": "long" if current_pos > 0 else "short",
                "quantity": abs(current_pos),
                "avg_price": round(entry_price, 4),  # noqa: F821
                "market_price": round(last_price, 4),
                "unrealized_pnl": round(unrealized, 4),
                "as_of": last_ts,
                "recording_set": recording_set,
                "strategy": "momentum_5_20",
            })

        summary[symbol] = {
            "num_fills": num_fills,
            "total_realized_pnl": round(total_pnl, 4),
            "final_position": (
                {
                    "qty": abs(current_pos),
                    "side": "long" if current_pos > 0 else "short",
                    "unrealized_pnl": round(
                        current_pos * (float(df["close"].iloc[-1]) - entry_price), 4  # noqa: F821
                    ) if current_pos != 0 else 0.0,
                }
                if current_pos != 0 else None
            ),
        }

    return all_fills, final_positions, summary


def write_ledger(
    recording_set: str,
    fills: list[dict],
    positions: list[dict],
    summary: dict,
) -> dict:
    ledger_dir = os.path.join(
        WORKSPACE_ROOT, "data", "recordings", recording_set, "broker_ledger"
    )
    os.makedirs(ledger_dir, exist_ok=True)

    fills_path = os.path.join(ledger_dir, "fills.jsonl")
    positions_path = os.path.join(ledger_dir, "positions.jsonl")

    with open(fills_path, "w") as f:
        for fill in fills:
            f.write(json.dumps(fill) + "\n")

    with open(positions_path, "w") as f:
        for pos in positions:
            f.write(json.dumps(pos) + "\n")

    fills_hash = sha256_file(fills_path)
    positions_hash = sha256_file(positions_path)

    total_pnl = sum(v.get("total_realized_pnl", 0) for v in summary.values())
    total_fills = sum(v.get("num_fills", 0) for v in summary.values())

    files_meta = {
        "broker_ledger/fills.jsonl": {
            "size_bytes": os.path.getsize(fills_path),
            "sha256": fills_hash,
            "num_records": len(fills),
        },
        "broker_ledger/positions.jsonl": {
            "size_bytes": os.path.getsize(positions_path),
            "sha256": positions_hash,
            "num_records": len(positions),
        },
    }

    ledger_summary = {
        "strategy": "momentum_5_20",
        "initial_capital": 100_000.0,
        "total_realized_pnl": round(total_pnl, 4),
        "total_num_fills": total_fills,
        "per_symbol": summary,
    }

    print(f"✓ Fills: {len(fills)} records → {fills_path}")
    print(f"  Total realized PnL: ${total_pnl:,.2f}")
    print(f"  Positions: {len(positions)} open")

    return {"files": files_meta, "ledger_summary": ledger_summary}


def main():
    parser = argparse.ArgumentParser(description="Record paper broker ledger from authentic data")
    parser.add_argument("--set", default="core-default")
    parser.add_argument("--symbols", nargs="+", default=["AAPL", "MSFT", "SPY", "TSLA"])
    parser.add_argument("--capital", type=float, default=100_000.0)
    args = parser.parse_args()

    print(f"Deriving paper trades from {args.set} recording…")
    fills, positions, summary = derive_paper_trades(args.set, args.symbols, args.capital)
    result = write_ledger(args.set, fills, positions, summary)

    # Update manifest
    manifest_path = os.path.join(
        WORKSPACE_ROOT, "data", "recordings", args.set, "manifest.json"
    )
    with open(manifest_path) as f:
        manifest = json.load(f)

    manifest["files"] = {**manifest.get("files", {}), **result["files"]}
    manifest["broker_ledger_summary"] = result["ledger_summary"]
    manifest["broker_ledger_recorded_at"] = datetime.now(timezone.utc).isoformat()

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)

    print(f"✓ Manifest updated: {manifest_path}")


if __name__ == "__main__":
    main()
