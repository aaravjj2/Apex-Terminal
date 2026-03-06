"""
compat_shim.py — Compatibility shim router.

Adds the API endpoints that the frontend calls but the backend doesn't yet have:
  - GET /api/ops/version
  - GET /api/ops/market_session
  - GET /api/market-quote          (GET with ?symbol=)
  - GET /api/market-quote/quote    (GET with ?symbol=)
  - GET /api/v3/ops/health
  - GET /api/v3/ops/ws/health
  - GET /api/v3/ops/es/templates
  - POST /api/v3/ops/es/templates/install
  - GET /api/v3/ops/ingest/dlq
  - POST /api/v3/ops/ingest/dlq/drain
  - GET /api/v3/ops/ingest/lag
  - GET /api/v3/research/strategies
  - GET /api/v3/research/artifacts
  - GET /api/v3/research/validation
  - GET /api/v3/research/diff
  - GET /api/v3/research/audit
  - POST /api/v3/research/backtest
  - GET /api/backtest/strategies
  - GET /api/backtest/data/health
"""

import os
import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
import structlog

try:
    from ..config import get_settings
except Exception:
    get_settings = None

logger = structlog.get_logger()
router = APIRouter(tags=["compat-shim"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _is_market_open() -> tuple[bool, str]:
    """Return (is_open, session_name) based on ET time."""
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo("America/New_York")
    except Exception:
        import pytz
        tz = pytz.timezone("America/New_York")  # type: ignore

    now = datetime.datetime.now(tz)
    weekday = now.weekday()  # 0=Mon … 6=Sun

    if weekday >= 5:
        return False, "closed"

    hour = now.hour
    minute = now.minute
    t = hour * 60 + minute

    # Pre-market: 04:00–09:30
    if 4 * 60 <= t < 9 * 60 + 30:
        return False, "pre_market"
    # Regular: 09:30–16:00
    if 9 * 60 + 30 <= t < 16 * 60:
        return True, "regular"
    # After-hours: 16:00–20:00
    if 16 * 60 <= t < 20 * 60:
        return False, "after_hours"
    return False, "closed"


async def _fetch_quote_alpaca(symbol: str) -> Optional[float]:
    """Try to get a real-time quote from Alpaca paper API."""
    try:
        settings = get_settings() if get_settings else None
        key = (settings.apca_api_key_id if settings else None) or os.getenv("APCA_API_KEY_ID", "")
        secret = (settings.apca_api_secret_key if settings else None) or os.getenv("APCA_API_SECRET_KEY", "")
        endpoint = os.getenv("APCA_ENDPOINT", "https://paper-api.alpaca.markets")

        if not key or not secret:
            return None

        import httpx
        # Use live data endpoint (quotes)
        data_url = "https://data.alpaca.markets/v2/stocks/{sym}/trades/latest".format(sym=symbol)
        headers = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(data_url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                price = data.get("trade", {}).get("p")
                if price:
                    return float(price)
    except Exception as e:
        logger.warning("alpaca_quote_failed", symbol=symbol, error=str(e))
    return None


async def _fetch_quote_yfinance(symbol: str) -> Optional[float]:
    """Fallback: get quote via yfinance."""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = getattr(info, "last_price", None) or getattr(info, "regularMarketPrice", None)
        if price:
            return float(price)
    except Exception as e:
        logger.warning("yfinance_quote_failed", symbol=symbol, error=str(e))
    return None


async def _get_quote(symbol: str) -> dict:
    """Get best-available real quote; no synthetic fallback."""
    symbol = symbol.upper().strip()
    price = await _fetch_quote_alpaca(symbol)
    source = "alpaca"
    if price is None:
        price = await _fetch_quote_yfinance(symbol)
        source = "yfinance"
    if price is None:
        return {"symbol": symbol, "price": None, "error": "Quote unavailable — no data provider connected", "source": "none"}
    return {"symbol": symbol, "price": price, "source": source}


# ─────────────────────────────────────────────────────────────────────────────
# /api/ops/*
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/ops/version")
async def ops_version():
    """Return backend version / git SHA."""
    import subprocess
    sha = "unknown"
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "--short=12", "HEAD"],
            stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        pass
    return {
        "git_sha": sha,
        "version": "1.0.0",
        "build_time": datetime.datetime.utcnow().isoformat() + "Z",
    }


@router.get("/api/ops/market_session")
async def ops_market_session():
    """Return current market session status."""
    is_open, session = _is_market_open()
    return {
        "is_open_now": is_open,
        "session": session,
        "as_of_utc": datetime.datetime.utcnow().isoformat() + "Z",
    }


# ─────────────────────────────────────────────────────────────────────────────
# /api/market-quote (real data, no synthetic)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/market-quote")
async def market_quote_root(symbol: str = Query(..., description="Ticker symbol")):
    """Real-time quote for a single symbol."""
    return await _get_quote(symbol)


@router.get("/api/market-quote/quote")
async def market_quote_quote(symbol: str = Query(..., description="Ticker symbol")):
    """Real-time quote (alternate path used by useMarketData hook)."""
    return await _get_quote(symbol)


@router.get("/api/market-quote/quotes/batch")
async def market_quote_batch(symbols: str = Query(..., description="Comma-separated symbols")):
    """Batch real-time quotes."""
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    import asyncio
    results = await asyncio.gather(*[_get_quote(s) for s in sym_list])
    return {"quotes": list(results)}


# ─────────────────────────────────────────────────────────────────────────────
# /api/v3/ops/*  (wraps existing health endpoints)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/v3/ops/health")
async def v3_ops_health(request: Request):
    """Wrap /api/v1/health for OpsUI2 component."""
    try:
        from ..monitoring.health import get_health_monitor
        monitor = get_health_monitor()
        summary = await monitor.get_summary()
        alpaca_ok = summary.get("broker", {}).get("status") == "ACTIVE"
        es_ok = summary.get("elasticsearch", {}).get("connected", False)
        return {
            "status": "healthy" if alpaca_ok and es_ok else "degraded",
            "correlation_id": summary.get("correlation_id", ""),
            "dependencies": {
                "elasticsearch": {
                    "connected": es_ok,
                    "cluster_name": summary.get("elasticsearch", {}).get("cluster_name", "apex-local"),
                },
                "broker": {
                    "status": "ACTIVE" if alpaca_ok else "DISCONNECTED",
                    "account_id": summary.get("broker", {}).get("account_id", "alpaca"),
                },
            },
        }
    except Exception:
        # Fallback to /health
        return {
            "status": "degraded",
            "correlation_id": "",
            "dependencies": {
                "elasticsearch": {"connected": False, "cluster_name": "apex-local"},
                "broker": {"status": "DISCONNECTED", "account_id": "alpaca"},
            },
        }


@router.get("/api/v3/ops/ws/health")
async def v3_ops_ws_health(request: Request):
    """WebSocket health for OpsUI2."""
    try:
        ws_mgr = getattr(request.app.state, "ws_manager", None)
        connected = 0
        if ws_mgr:
            connected = len(getattr(ws_mgr, "_connections", {}))
        return {"connected": True, "active_connections": connected}
    except Exception:
        return {"connected": False, "active_connections": 0}


@router.get("/api/v3/ops/es/templates")
async def v3_ops_es_templates():
    """Elasticsearch template status (stub when ES not configured)."""
    return {
        "templates_healthy": False,
        "aliases_healthy": False,
        "templates": [],
        "aliases": [],
    }


@router.post("/api/v3/ops/es/templates/install")
async def v3_ops_es_templates_install():
    return {"ok": True, "message": "ES templates not configured in this deployment"}


@router.get("/api/v3/ops/ingest/dlq")
async def v3_ops_ingest_dlq():
    return {"total_pending": 0, "stats": []}


@router.post("/api/v3/ops/ingest/dlq/drain")
async def v3_ops_ingest_dlq_drain():
    return {"ok": True, "drained": 0}


@router.get("/api/v3/ops/ingest/lag")
async def v3_ops_ingest_lag():
    return {"metrics": []}


# ─────────────────────────────────────────────────────────────────────────────
# /api/v3/research/*  (strategy research / artifacts)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/v3/research/strategies")
async def v3_research_strategies():
    """Return live strategies in ResearchUI2 format."""
    try:
        from ..persistence import get_database
        db = get_database()
        rows = await db.fetch_all("SELECT id, name, strategy_type FROM strategies LIMIT 100")
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "strategy_type": r["strategy_type"],
                "status": "active",
                "tags": [],
                "created_at": None,
                "sharpe": None,
                "win_rate": None,
                "cagr": None,
                "max_dd": None,
                "last_run": None,
                "runs": 0,
            }
            for r in rows
        ]
    except Exception:
        return []


@router.get("/api/v3/research/artifacts")
async def v3_research_artifacts():
    return []


@router.get("/api/v3/research/validation")
async def v3_research_validation():
    return []


@router.get("/api/v3/research/diff")
async def v3_research_diff():
    return []


@router.get("/api/v3/research/audit")
async def v3_research_audit():
    return []


@router.post("/api/v3/research/backtest")
async def v3_research_backtest(request: Request):
    """Forward to the backtest run endpoint."""
    body = await request.json()
    from .backtest import run_backtest, BacktestRequest
    req = BacktestRequest(**body)
    return await run_backtest(req)


# ─────────────────────────────────────────────────────────────────────────────
# /api/backtest/strategies + /api/backtest/data/health
# ─────────────────────────────────────────────────────────────────────────────

_BUILTIN_STRATEGIES = [
    {
        "id": "sma_crossover",
        "name": "SMA Crossover (50/200)",
        "description": "Golden cross / death cross using 50-day and 200-day SMA.",
        "strategy_type": "trend_following",
        "tags": ["sma", "trend", "long_only"],
    },
    {
        "id": "rsi_mean_reversion",
        "name": "RSI Mean Reversion",
        "description": "Buy oversold (RSI<30), sell overbought (RSI>70).",
        "strategy_type": "mean_reversion",
        "tags": ["rsi", "oscillator", "mean_reversion"],
    },
    {
        "id": "macd_trend",
        "name": "MACD Trend",
        "description": "Enter on MACD signal crossover, exit on cross-back.",
        "strategy_type": "trend_following",
        "tags": ["macd", "trend"],
    },
    {
        "id": "bband_reversion",
        "name": "Bollinger Band Reversion",
        "description": "Buy lower band touch, sell upper band touch.",
        "strategy_type": "mean_reversion",
        "tags": ["bollinger", "mean_reversion"],
    },
    {
        "id": "vwap_breakout",
        "name": "VWAP Breakout",
        "description": "Enter long on price crossing above VWAP with volume confirmation.",
        "strategy_type": "breakout",
        "tags": ["vwap", "breakout", "intraday"],
    },
    {
        "id": "momentum_12_1",
        "name": "12-Month Momentum (skip 1)",
        "description": "Long top-decile 12-month momentum, skip most-recent month.",
        "strategy_type": "momentum",
        "tags": ["momentum", "factor"],
    },
    {
        "id": "pairs_spread",
        "name": "Pairs Spread (SPY/QQQ)",
        "description": "Cointegrated pairs trade between SPY and QQQ.",
        "strategy_type": "stat_arb",
        "tags": ["pairs", "stat_arb", "market_neutral"],
    },
]


@router.get("/api/backtest/strategies")
async def backtest_strategies():
    """Return available backtest strategies in StrategyInfo format."""
    return _BUILTIN_STRATEGIES


@router.get("/api/backtest/data/health")
async def backtest_data_health(symbol: Optional[str] = Query(None)):
    """Return data health for backtest symbols."""
    symbols = [symbol.upper()] if symbol else ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "SPY", "QQQ"]
    results = []
    for sym in symbols:
        results.append({
            "symbol": sym,
            "total_rows": 0,
            "earliest_date": None,
            "latest_date": None,
            "missing_pct": 0.0,
            "expected_trading_days": 0,
            "actual_trading_days": 0,
            "last_fetch": None,
            "provider": "yfinance",
            "status": "not_primed",
        })
    return results
