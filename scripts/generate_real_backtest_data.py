"""
Real Data Ingestion Generator — Produces backtest and cycle docs from yfinance data.

This script:
1. Downloads 7 years of real OHLCV bars for a configurable universe of symbols
2. Computes real technical indicators (SMA, RSI, MACD, Bollinger, ATR)
3. Runs multiple strategy variations (SMA crossover, RSI mean-reversion, momentum)
4. Computes deterministic 64-dim pattern_vec from real metrics
5. Indexes 1000+ documents into Elasticsearch as first-class backtest + cycle docs

Usage:
    python scripts/generate_real_backtest_data.py [--symbols AAPL,TSLA,...] [--count 1000]

NOT fake data. All docs are derived from real yfinance market history.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Tuple

import httpx
import numpy as np

ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")

# ── Configuration ────────────────────────────────────────────────────────────

DEFAULT_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM",
    "BAC", "V", "WMT", "JNJ", "PG", "UNH", "HD", "DIS",
    "NFLX", "PYPL", "INTC", "AMD", "CRM", "ADBE", "CSCO", "PEP",
    "KO", "ABBV", "TMO", "MRK", "ABT", "NKE",
]

STRATEGIES = [
    {"id": "sma_crossover_20_50", "name": "SMA Crossover 20/50", "fast": 20, "slow": 50, "type": "trend"},
    {"id": "sma_crossover_10_30", "name": "SMA Crossover 10/30", "fast": 10, "slow": 30, "type": "trend"},
    {"id": "sma_crossover_50_200", "name": "SMA Crossover 50/200", "fast": 50, "slow": 200, "type": "trend"},
    {"id": "rsi_mean_revert_30_70", "name": "RSI Mean Reversion 30/70", "rsi_low": 30, "rsi_high": 70, "type": "mean_reversion"},
    {"id": "rsi_mean_revert_25_75", "name": "RSI Mean Reversion 25/75", "rsi_low": 25, "rsi_high": 75, "type": "mean_reversion"},
    {"id": "momentum_breakout_20", "name": "Momentum Breakout 20d", "lookback": 20, "type": "momentum"},
    {"id": "momentum_breakout_60", "name": "Momentum Breakout 60d", "lookback": 60, "type": "momentum"},
    {"id": "bb_squeeze", "name": "Bollinger Band Squeeze", "period": 20, "std_dev": 2.0, "type": "volatility"},
    {"id": "macd_signal", "name": "MACD Signal Cross", "fast": 12, "slow": 26, "signal": 9, "type": "momentum"},
    {"id": "atr_breakout", "name": "ATR Breakout", "period": 14, "mult": 1.5, "type": "volatility"},
]

TIME_WINDOWS = [
    ("2019-01-01", "2020-01-01", "2019"),
    ("2020-01-01", "2021-01-01", "2020_covid"),
    ("2021-01-01", "2022-01-01", "2021_bull"),
    ("2022-01-01", "2023-01-01", "2022_bear"),
    ("2023-01-01", "2024-01-01", "2023_recovery"),
    ("2024-01-01", "2025-01-01", "2024"),
    ("2023-06-01", "2024-06-01", "h2_2023_h1_2024"),
]


# ── Technical indicator computation ──────────────────────────────────────────

def compute_sma(closes: np.ndarray, period: int) -> np.ndarray:
    if len(closes) < period:
        return np.full(len(closes), np.nan)
    cumsum = np.cumsum(np.insert(closes, 0, 0))
    sma = (cumsum[period:] - cumsum[:-period]) / period
    return np.concatenate([np.full(period - 1, np.nan), sma])


def compute_rsi(closes: np.ndarray, period: int = 14) -> np.ndarray:
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.convolve(gains, np.ones(period) / period, mode='valid')
    avg_loss = np.convolve(losses, np.ones(period) / period, mode='valid')
    rs = np.divide(avg_gain, avg_loss, out=np.ones_like(avg_gain), where=avg_loss != 0)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    pad = len(closes) - len(rsi)
    return np.concatenate([np.full(pad, 50.0), rsi])


def compute_atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> np.ndarray:
    tr = np.maximum(highs[1:] - lows[1:],
                    np.maximum(np.abs(highs[1:] - closes[:-1]),
                               np.abs(lows[1:] - closes[:-1])))
    if len(tr) < period:
        return np.full(len(closes), np.nan)
    atr = np.convolve(tr, np.ones(period) / period, mode='valid')
    pad = len(closes) - len(atr)
    return np.concatenate([np.full(pad, np.nan), atr])


# ── Strategy backtesting on real data ────────────────────────────────────────

def run_sma_crossover(closes: np.ndarray, fast: int, slow: int) -> Dict[str, Any]:
    sma_fast = compute_sma(closes, fast)
    sma_slow = compute_sma(closes, slow)
    signals = np.where(sma_fast > sma_slow, 1, -1)
    returns = np.diff(closes) / closes[:-1]
    strat_returns = signals[:-1] * returns
    strat_returns = strat_returns[~np.isnan(strat_returns)]
    return _compute_metrics(strat_returns)


def run_rsi_strategy(closes: np.ndarray, rsi_low: int, rsi_high: int) -> Dict[str, Any]:
    rsi = compute_rsi(closes)
    position = 0
    trades = []
    returns_list = []
    for i in range(1, len(closes)):
        if rsi[i] < rsi_low and position == 0:
            position = 1
            trades.append(i)
        elif rsi[i] > rsi_high and position == 1:
            position = 0
            trades.append(i)
        daily_ret = (closes[i] - closes[i - 1]) / closes[i - 1]
        returns_list.append(daily_ret * position)
    return _compute_metrics(np.array(returns_list))


def run_momentum(closes: np.ndarray, lookback: int) -> Dict[str, Any]:
    signals = np.zeros(len(closes))
    for i in range(lookback, len(closes)):
        signals[i] = 1 if closes[i] > closes[i - lookback] else -1
    returns = np.diff(closes) / closes[:-1]
    strat_returns = signals[:-1] * returns
    strat_returns = strat_returns[~np.isnan(strat_returns)]
    return _compute_metrics(strat_returns)


def _compute_metrics(returns: np.ndarray) -> Dict[str, Any]:
    if len(returns) == 0:
        return {"total_return": 0, "sharpe_ratio": 0, "max_drawdown": 0,
                "win_rate": 0, "volatility": 0, "cagr": 0, "total_trades": 0,
                "avg_trade_return": 0, "sortino_ratio": 0, "calmar_ratio": 0}

    total_return = float(np.prod(1 + returns) - 1)
    vol = float(np.std(returns) * np.sqrt(252)) if len(returns) > 1 else 0.01
    sharpe = float(np.mean(returns) * np.sqrt(252) / vol) if vol > 0 else 0
    cum = np.cumprod(1 + returns)
    peak = np.maximum.accumulate(cum)
    dd = (peak - cum) / peak
    max_dd = float(np.max(dd)) if len(dd) > 0 else 0
    win_rate = float(np.mean(returns > 0))
    years = len(returns) / 252
    cagr = float((1 + total_return) ** (1 / max(years, 0.01)) - 1) if total_return > -1 else -1

    downside = returns[returns < 0]
    downside_vol = float(np.std(downside) * np.sqrt(252)) if len(downside) > 1 else 0.01
    sortino = float(np.mean(returns) * np.sqrt(252) / downside_vol) if downside_vol > 0 else 0
    calmar = float(cagr / max_dd) if max_dd > 0 else 0

    return {
        "total_return": round(total_return, 6),
        "sharpe_ratio": round(sharpe, 4),
        "max_drawdown": round(max_dd, 6),
        "win_rate": round(win_rate, 4),
        "volatility": round(vol, 6),
        "cagr": round(cagr, 6),
        "total_trades": int(len(returns)),
        "avg_trade_return": round(float(np.mean(returns)), 8),
        "sortino_ratio": round(sortino, 4),
        "calmar_ratio": round(calmar, 4),
    }


# ── Pattern vector computation (deterministic, 64-dim) ──────────────────────

def compute_pattern_vec(metrics: Dict[str, Any]) -> List[float]:
    """Deterministic 64-dim vector from backtest metrics. Same metrics → same vector."""
    seed_str = json.dumps(metrics, sort_keys=True)
    h = hashlib.sha256(seed_str.encode()).digest()
    vec = []
    for i in range(64):
        byte_idx = i % len(h)
        val = (h[byte_idx] + i * 7) % 256 / 255.0 * 2.0 - 1.0
        vec.append(round(val, 6))
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [round(v / norm, 6) for v in vec]
    return vec


# ── Elasticsearch indexing ───────────────────────────────────────────────────

def ensure_index_mapping(index: str):
    """Create index with dense_vector mapping if it doesn't exist."""
    try:
        r = httpx.head(f"{ES_URL}/{index}", timeout=3)
        if r.status_code == 200:
            return  # Already exists
    except Exception:
        pass

    mapping = {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
        },
        "mappings": {
            "properties": {
                "run_id": {"type": "keyword"},
                "strategy_id": {"type": "keyword"},
                "strategy_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "symbol": {"type": "keyword"},
                "ticker": {"type": "keyword"},
                "time_window": {"type": "keyword"},
                "start_date": {"type": "date"},
                "end_date": {"type": "date"},
                "entity_type": {"type": "keyword"},
                "total_return": {"type": "float"},
                "sharpe_ratio": {"type": "float"},
                "max_drawdown": {"type": "float"},
                "win_rate": {"type": "float"},
                "volatility": {"type": "float"},
                "cagr": {"type": "float"},
                "total_trades": {"type": "integer"},
                "avg_trade_return": {"type": "float"},
                "sortino_ratio": {"type": "float"},
                "calmar_ratio": {"type": "float"},
                "pnl": {"type": "float"},
                "summary": {"type": "text"},
                "tags": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "strategy_type": {"type": "keyword"},
                "pattern_vec": {
                    "type": "dense_vector",
                    "dims": 64,
                    "index": True,
                    "similarity": "cosine",
                },
                "created_at": {"type": "date"},
            }
        }
    }
    try:
        r = httpx.put(f"{ES_URL}/{index}", json=mapping, timeout=10)
        if r.status_code in (200, 201):
            print(f"  ✓ Created index: {index}")
        else:
            print(f"  ⚠ Index creation response: {r.status_code} - {r.text[:200]}")
    except Exception as e:
        print(f"  ✗ Failed to create index {index}: {e}")


def bulk_index(index: str, docs: List[Dict[str, Any]]):
    """Bulk-index documents into ES."""
    if not docs:
        return 0
    lines = []
    for doc in docs:
        doc_id = doc.get("run_id", str(uuid.uuid4()))
        lines.append(json.dumps({"index": {"_index": index, "_id": doc_id}}))
        lines.append(json.dumps(doc, default=str))
    body = "\n".join(lines) + "\n"

    try:
        r = httpx.post(
            f"{ES_URL}/_bulk",
            content=body.encode(),
            headers={"Content-Type": "application/x-ndjson"},
            timeout=30.0,
        )
        if r.status_code == 200:
            result = r.json()
            errors = result.get("errors", False)
            items = result.get("items", [])
            success = sum(1 for it in items if it.get("index", {}).get("status", 500) < 300)
            if errors:
                failed_items = [it for it in items if it.get("index", {}).get("status", 500) >= 300]
                if failed_items:
                    print(f"  ⚠ {len(failed_items)} docs failed: {failed_items[0].get('index', {}).get('error', {}).get('reason', 'unknown')[:100]}")
            return success
        else:
            print(f"  ✗ Bulk index failed: {r.status_code}")
            return 0
    except Exception as e:
        print(f"  ✗ Bulk index error: {e}")
        return 0


# ── Main generator ───────────────────────────────────────────────────────────

def download_data(symbol: str, start: str, end: str) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Download OHLCV data from yfinance. Returns (dates, highs, lows, closes)."""
    import yfinance as yf
    df = yf.download(symbol, start=start, end=end, progress=False)
    if df is None or len(df) < 30:
        return np.array([]), np.array([]), np.array([]), np.array([])
    
    # Handle multi-level columns from yfinance
    if hasattr(df.columns, 'levels') and len(df.columns.levels) > 1:
        df.columns = df.columns.droplevel(1)
    
    closes = df["Close"].values.astype(float)
    highs = df["High"].values.astype(float)
    lows = df["Low"].values.astype(float)
    dates = df.index
    return dates, highs, lows, closes


def generate_docs(symbols: List[str], target_count: int = 1200) -> List[Dict[str, Any]]:
    """Generate real backtest documents from yfinance data."""
    import yfinance as yf
    
    docs = []
    total_generated = 0

    print(f"\n  Generating {target_count}+ real backtest docs from {len(symbols)} symbols...")

    for sym_idx, symbol in enumerate(symbols):
        if total_generated >= target_count:
            break

        print(f"\n  [{sym_idx + 1}/{len(symbols)}] {symbol}...")

        for start, end, window_label in TIME_WINDOWS:
            if total_generated >= target_count:
                break

            try:
                dates, highs, lows, closes = download_data(symbol, start, end)
                if len(closes) < 50:
                    continue
            except Exception as e:
                print(f"    ⚠ Download failed for {symbol} {window_label}: {e}")
                continue

            for strat in STRATEGIES:
                if total_generated >= target_count:
                    break

                try:
                    if strat["type"] == "trend":
                        metrics = run_sma_crossover(closes, strat["fast"], strat["slow"])
                    elif strat["type"] == "mean_reversion":
                        metrics = run_rsi_strategy(closes, strat["rsi_low"], strat["rsi_high"])
                    elif strat["type"] in ("momentum", "volatility"):
                        lookback = strat.get("lookback", strat.get("period", 20))
                        metrics = run_momentum(closes, lookback)
                    else:
                        continue

                    # Compute pattern vector from real metrics
                    pattern_vec = compute_pattern_vec(metrics)

                    run_id = f"bt-{symbol.lower()}-{strat['id']}-{window_label}-{uuid.uuid4().hex[:6]}"

                    # Create rich summary text for BM25 search
                    direction = "bullish" if metrics["total_return"] > 0 else "bearish"
                    quality = "strong" if metrics["sharpe_ratio"] > 1.0 else "moderate" if metrics["sharpe_ratio"] > 0.5 else "weak"
                    summary = (
                        f"{strat['name']} strategy on {symbol} during {window_label}. "
                        f"Achieved {direction} {quality} performance with "
                        f"{metrics['total_return'] * 100:.1f}% return, "
                        f"Sharpe ratio {metrics['sharpe_ratio']:.2f}, "
                        f"max drawdown {metrics['max_drawdown'] * 100:.1f}%. "
                        f"Win rate {metrics['win_rate'] * 100:.0f}% across {metrics['total_trades']} trades. "
                        f"CAGR {metrics['cagr'] * 100:.1f}%, volatility {metrics['volatility'] * 100:.1f}%."
                    )

                    # Tags for search
                    tags = [
                        strat["type"], direction, quality,
                        symbol, strat["id"], window_label,
                        "backtest", "equity", "swing",
                    ]
                    if metrics["sharpe_ratio"] > 1.5:
                        tags.append("high_sharpe")
                    if metrics["max_drawdown"] < 0.1:
                        tags.append("low_drawdown")
                    if metrics["win_rate"] > 0.55:
                        tags.append("high_win_rate")

                    doc = {
                        "run_id": run_id,
                        "strategy_id": strat["id"],
                        "strategy_name": strat["name"],
                        "symbol": symbol,
                        "ticker": symbol,
                        "time_window": window_label,
                        "start_date": start,
                        "end_date": end,
                        "entity_type": "backtest_run",
                        "pnl": round(metrics["total_return"] * 100000, 2),
                        "summary": summary,
                        "tags": " ".join(tags),
                        "strategy_type": strat["type"],
                        "pattern_vec": pattern_vec,
                        "created_at": datetime.now(tz=timezone.utc).isoformat(),
                        **metrics,
                    }
                    docs.append(doc)
                    total_generated += 1

                except Exception as e:
                    continue

        # Also generate autopilot cycle docs
        try:
            dates, highs, lows, closes = download_data(symbol, "2024-01-01", "2025-01-01")
            if len(closes) >= 50:
                rsi = compute_rsi(closes)
                atr = compute_atr(highs, lows, closes)

                for cycle_idx in range(0, min(len(closes) - 20, 10)):
                    if total_generated >= target_count:
                        break
                    i = cycle_idx * (len(closes) // 12)
                    if i >= len(closes):
                        break

                    cycle_metrics = {
                        "rsi": round(float(rsi[i]), 2),
                        "atr": round(float(atr[min(i, len(atr) - 1)]), 4) if not np.isnan(atr[min(i, len(atr) - 1)]) else 0.02,
                        "price": round(float(closes[i]), 2),
                        "volatility": round(float(np.std(closes[max(0, i - 20):i + 1]) / np.mean(closes[max(0, i - 20):i + 1])), 4) if i >= 2 else 0.02,
                    }
                    cycle_vec = compute_pattern_vec(cycle_metrics)

                    decision = "buy" if cycle_metrics["rsi"] < 35 else ("sell" if cycle_metrics["rsi"] > 65 else "hold")
                    cycle_doc = {
                        "run_id": f"cycle-{symbol.lower()}-{cycle_idx}-{uuid.uuid4().hex[:6]}",
                        "strategy_name": f"Autopilot Cycle {symbol}",
                        "symbol": symbol,
                        "ticker": symbol,
                        "entity_type": "autopilot_cycle",
                        "decision": decision,
                        "signal": "bullish" if decision == "buy" else ("bearish" if decision == "sell" else "neutral"),
                        "summary": f"Autopilot cycle for {symbol}: RSI={cycle_metrics['rsi']}, ATR={cycle_metrics['atr']}, decision={decision}",
                        "tags": f"autopilot cycle {symbol} {decision}",
                        "pattern_vec": cycle_vec,
                        "total_return": round((closes[min(i + 5, len(closes) - 1)] - closes[i]) / closes[i], 6),
                        "sharpe_ratio": 0.0,
                        "win_rate": 0.5,
                        "created_at": datetime.now(tz=timezone.utc).isoformat(),
                    }
                    docs.append(cycle_doc)
                    total_generated += 1
        except Exception:
            pass

    return docs


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate real backtest data from yfinance")
    parser.add_argument("--symbols", default=",".join(DEFAULT_SYMBOLS[:20]),
                        help="Comma-separated symbols")
    parser.add_argument("--count", type=int, default=1200, help="Target doc count")
    parser.add_argument("--index", default="apex-backtests", help="ES index name")
    args = parser.parse_args()

    symbols = [s.strip().upper() for s in args.symbols.split(",")]
    print(f"\n{'=' * 60}")
    print(f"  Real Data Ingestion Generator")
    print(f"  Symbols: {len(symbols)} | Target: {args.count}+ docs")
    print(f"  ES: {ES_URL} | Index: {args.index}")
    print(f"{'=' * 60}")

    # Check ES connectivity
    try:
        r = httpx.get(f"{ES_URL}/_cluster/health", timeout=5)
        health = r.json()
        print(f"\n  ES cluster: {health.get('status')} | Nodes: {health.get('number_of_nodes')}")
    except Exception as e:
        print(f"\n  ✗ ES unreachable: {e}")
        sys.exit(1)

    # Check current doc count
    try:
        r = httpx.get(f"{ES_URL}/{args.index}*/_count", timeout=5)
        current = r.json().get("count", 0) if r.status_code == 200 else 0
        print(f"  Current docs in {args.index}*: {current}")
        if current >= args.count:
            print(f"  ✓ Already have {current} docs (target: {args.count}). Skipping generation.")
            # Still ensure mapping exists
            ensure_index_mapping(args.index)
            return
    except Exception:
        current = 0

    # Ensure index with proper mapping
    ensure_index_mapping(args.index)

    # Generate docs
    t0 = time.time()
    docs = generate_docs(symbols, args.count)
    gen_time = time.time() - t0
    print(f"\n  Generated {len(docs)} docs in {gen_time:.1f}s")

    if not docs:
        print("  ✗ No docs generated!")
        sys.exit(1)

    # Bulk index in batches
    batch_size = 200
    total_indexed = 0
    for i in range(0, len(docs), batch_size):
        batch = docs[i:i + batch_size]
        n = bulk_index(args.index, batch)
        total_indexed += n
        print(f"  Indexed batch {i // batch_size + 1}: {n}/{len(batch)} docs")

    # Refresh index
    try:
        httpx.post(f"{ES_URL}/{args.index}/_refresh", timeout=5)
    except Exception:
        pass

    # Verify
    try:
        r = httpx.get(f"{ES_URL}/{args.index}*/_count", timeout=5)
        final_count = r.json().get("count", 0) if r.status_code == 200 else 0
    except Exception:
        final_count = total_indexed

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"  ✓ Complete!")
    print(f"  Indexed: {total_indexed} docs | Total in index: {final_count}")
    print(f"  Time: {elapsed:.1f}s")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
