"""
Live Market Quote endpoint — GET /api/v1/market/quote?symbol=AAPL

Returns real-time price data from available providers:
1. Alpaca market data (if APCA keys configured)
2. Finnhub (if FINNHUB_API_KEY configured)
3. yfinance fallback (always available)

Cache: 2-second TTL to reduce cost and stabilize latency.
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/v1/market", tags=["market-quote"])

# ── In-memory cache (2s TTL) ─────────────────────────────────────────────────
_cache: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL = 2.0  # seconds


def _cached(symbol: str) -> Optional[Dict[str, Any]]:
    entry = _cache.get(symbol)
    if entry and (time.time() - entry["_ts"]) < _CACHE_TTL:
        return entry
    return None


def _store(symbol: str, data: Dict[str, Any]) -> Dict[str, Any]:
    data["_ts"] = time.time()
    _cache[symbol] = data
    return data


# ── Provider implementations ─────────────────────────────────────────────────

def _quote_alpaca(symbol: str) -> Optional[Dict[str, Any]]:
    """Fetch latest quote + daily change via Alpaca market data snapshot."""
    key_id = os.environ.get("APCA_API_KEY_ID")
    secret = os.environ.get("APCA_API_SECRET_KEY")
    if not key_id or not secret:
        return None
    try:
        import httpx
        endpoint = os.environ.get("APCA_DATA_URL", "https://data.alpaca.markets")
        headers = {"APCA-API-KEY-ID": key_id, "APCA-API-SECRET-KEY": secret}
        r = httpx.get(
            f"{endpoint}/v2/stocks/{symbol}/snapshot",
            headers=headers,
            timeout=4.0,
        )
        if r.status_code == 200:
            snap = r.json()
            quote = snap.get("latestQuote") or snap.get("quote") or {}
            trade = snap.get("latestTrade") or snap.get("trade") or {}
            daily = snap.get("dailyBar") or snap.get("minuteBar") or {}
            prev = snap.get("prevDailyBar") or {}
            bid = float(quote.get("bp") or quote.get("bid_price") or 0)
            ask = float(quote.get("ap") or quote.get("ask_price") or 0)
            last = float(
                trade.get("p")
                or trade.get("price")
                or daily.get("c")
                or daily.get("close")
                or ((bid + ask) / 2 if bid and ask else 0)
            )
            if last <= 0:
                return None
            prev_close = float(prev.get("c") or prev.get("close") or 0)
            change = round(last - prev_close, 4) if prev_close else 0.0
            change_pct = round((change / prev_close) * 100, 4) if prev_close else 0.0
            return {
                "bid": bid or last,
                "ask": ask or last,
                "last": round(last, 4),
                "change": change,
                "change_pct": change_pct,
                "source": "alpaca",
            }
    except Exception:
        pass
    return None


def _quote_finnhub(symbol: str) -> Optional[Dict[str, Any]]:
    """Fetch latest quote via Finnhub."""
    key = os.environ.get("FINNHUB_API_KEY")
    if not key:
        return None
    try:
        import httpx
        r = httpx.get(f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={key}",
                      timeout=4.0)
        if r.status_code == 200:
            d = r.json()
            if d.get("c", 0) > 0:
                last = float(d["c"])
                change = float(d.get("d") or 0)
                change_pct = float(d.get("dp") or 0)
                return {
                    "bid": last,
                    "ask": last,
                    "last": last,
                    "change": change,
                    "change_pct": change_pct,
                    "source": "finnhub",
                }
    except Exception:
        pass
    return None


def _quote_yfinance(symbol: str) -> Optional[Dict[str, Any]]:
    """Fetch latest quote via yfinance (always available)."""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = getattr(info, "last_price", None) or getattr(info, "previous_close", None)
        if price and price > 0:
            prev = float(getattr(info, "previous_close", None) or price)
            last = round(float(price), 4)
            change = round(last - prev, 4) if prev else 0.0
            change_pct = round((change / prev) * 100, 4) if prev else 0.0
            return {
                "bid": round(last * 0.999, 4),
                "ask": round(last * 1.001, 4),
                "last": last,
                "change": change,
                "change_pct": change_pct,
                "source": "yfinance",
            }
    except Exception:
        pass
    # Final fallback: try download
    try:
        import yfinance as yf
        hist = yf.download(symbol, period="1d", progress=False)
        if len(hist) > 0:
            close = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else close
            change = round(close - prev, 4)
            change_pct = round((change / prev) * 100, 4) if prev else 0.0
            return {
                "bid": round(close * 0.999, 4),
                "ask": round(close * 1.001, 4),
                "last": round(close, 4),
                "change": change,
                "change_pct": change_pct,
                "source": "yfinance",
            }
    except Exception:
        pass
    return None


def _format_quote_response(
    symbol: str,
    result: Dict[str, Any],
    correlation_id: str,
    latency_ms: float,
    cached_suffix: str = "",
) -> Dict[str, Any]:
    last = float(result.get("last", 0))
    change = float(result.get("change", 0))
    change_pct = float(result.get("change_pct", 0))
    src = str(result.get("source", "unknown")) + cached_suffix
    return {
        "ok": True,
        "symbol": symbol,
        "ts": datetime.now(tz=timezone.utc).isoformat(),
        "bid": result.get("bid", last),
        "ask": result.get("ask", last),
        "last": last,
        "price": last,
        "c": last,
        "close": last,
        "change": change,
        "change_pct": change_pct,
        "source": src,
        "latency_ms": latency_ms,
        "correlation_id": correlation_id,
    }


def _batch_row(sym: str, result: Dict[str, Any]) -> Dict[str, Any]:
    last = float(result.get("last", 0))
    return {
        "symbol": sym,
        "last": last,
        "price": last,
        "bid": result.get("bid", last),
        "ask": result.get("ask", last),
        "change": float(result.get("change", 0)),
        "change_pct": float(result.get("change_pct", 0)),
        "source": result.get("source", "unknown"),
        "ok": True,
    }


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/quote")
async def get_live_quote(symbol: str = Query(..., min_length=1, max_length=10)):
    """
    Get real-time quote for a symbol.

    Provider routing:
    1. Alpaca market data (if configured)
    2. Finnhub (if configured)
    3. yfinance fallback

    Returns: { ok, symbol, ts, bid, ask, last, price, source, latency_ms, correlation_id }
    """
    t0 = time.time()
    correlation_id = f"quote-{uuid.uuid4().hex[:8]}"
    symbol = symbol.upper().strip()

    # Check cache
    cached = _cached(symbol)
    if cached:
        latency_ms = round((time.time() - t0) * 1000, 2)
        return _format_quote_response(
            symbol, cached, correlation_id, latency_ms, cached_suffix=" (cached)"
        )

    # Try providers in priority order
    providers = [
        ("alpaca", _quote_alpaca),
        ("finnhub", _quote_finnhub),
        ("yfinance", _quote_yfinance),
    ]

    for name, fn in providers:
        result = fn(symbol)
        if result and result.get("last", 0) > 0:
            _store(symbol, result)
            latency_ms = round((time.time() - t0) * 1000, 2)
            return _format_quote_response(symbol, result, correlation_id, latency_ms)

    latency_ms = round((time.time() - t0) * 1000, 2)
    raise HTTPException(status_code=503, detail={
        "ok": False,
        "symbol": symbol,
        "error": "No provider returned a valid quote",
        "latency_ms": latency_ms,
        "correlation_id": correlation_id,
    })


@router.get("/quotes/batch")
async def get_batch_quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    """Batch quote endpoint for the Live Prices panel."""
    t0 = time.time()
    correlation_id = f"batch-{uuid.uuid4().hex[:8]}"
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:20]
    results = []
    for sym in syms:
        cached = _cached(sym)
        if cached:
            results.append(_batch_row(sym, cached))
            continue
        for _, fn in [("alpaca", _quote_alpaca), ("finnhub", _quote_finnhub), ("yfinance", _quote_yfinance)]:
            r = fn(sym)
            if r and r.get("last", 0) > 0:
                _store(sym, r)
                results.append(_batch_row(sym, r))
                break
        else:
            results.append({"symbol": sym, "last": None, "price": None, "ok": False, "error": "unavailable"})
    latency_ms = round((time.time() - t0) * 1000, 2)
    return {
        "ok": True,
        "quotes": results,
        "count": len(results),
        "latency_ms": latency_ms,
        "correlation_id": correlation_id,
    }


@router.get("/quotes")
async def get_quotes_shorthand(symbols: str = Query(..., description="Comma-separated symbols")):
    """Alias for /quotes/batch — used by dashboard live-prices panels."""
    return await get_batch_quotes(symbols=symbols)
