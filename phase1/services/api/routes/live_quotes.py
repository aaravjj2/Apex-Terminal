"""
Industrial-scale live quote streaming.

- GET /api/v1/live/quotes?symbols=AAPL,MSFT   — fast batch REST (cached 1s)
- WS  /ws/quotes?symbols=AAPL,MSFT            — push every ~1s with delta-only updates

Quotes come from Alpaca snapshot (single REST call returns latest trade, quote, daily
bar and prev close in one shot — no yfinance history fetches, no per-symbol fanout).
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional

import httpx
import structlog
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["live-quotes"])

# In-memory snapshot cache shared by REST + WS — keyed by symbol
# Stale-while-revalidate:
#   - Fresh (<= FRESH_S): serve immediately
#   - Stale (<= STALE_S): serve stale + kick off background refresh
#   - Expired (> STALE_S): synchronously refresh
_SNAPSHOT_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_FRESH_S = 2.0
_CACHE_STALE_S = 30.0
_CACHE_LOCK = asyncio.Lock()
_BG_TASK: Optional[asyncio.Task] = None
_BG_SYMBOLS: set[str] = set()
_BG_INTERVAL_S = 1.0
_INFLIGHT: Dict[str, asyncio.Task] = {}


def _alpaca_headers() -> Optional[Dict[str, str]]:
    k = os.environ.get("APCA_API_KEY_ID")
    s = os.environ.get("APCA_API_SECRET_KEY")
    if not k or not s:
        return None
    return {"APCA-API-KEY-ID": k, "APCA-API-SECRET-KEY": s}


def _alpaca_data_url() -> str:
    return os.environ.get("APCA_DATA_URL", "https://data.alpaca.markets").rstrip("/")


def _parse_snapshot(symbol: str, snap: Dict[str, Any]) -> Dict[str, Any]:
    quote = snap.get("latestQuote") or {}
    trade = snap.get("latestTrade") or {}
    daily = snap.get("dailyBar") or {}
    prev = snap.get("prevDailyBar") or {}
    bid = float(quote.get("bp") or 0)
    ask = float(quote.get("ap") or 0)
    last = float(
        trade.get("p")
        or daily.get("c")
        or ((bid + ask) / 2 if bid and ask else 0)
    )
    prev_close = float(prev.get("c") or 0)
    change = round(last - prev_close, 4) if prev_close else 0.0
    change_pct = round((change / prev_close) * 100, 4) if prev_close else 0.0
    return {
        "symbol": symbol,
        "last": last,
        "price": last,
        "bid": bid or last,
        "ask": ask or last,
        "change": change,
        "change_pct": change_pct,
        "open": float(daily.get("o") or 0),
        "high": float(daily.get("h") or 0),
        "low": float(daily.get("l") or 0),
        "close": float(daily.get("c") or last),
        "volume": float(daily.get("v") or 0),
        "prev_close": prev_close,
        "trade_ts": trade.get("t"),
        "source": "alpaca",
        "_fetched_at": time.time(),
    }


async def _fetch_alpaca_snapshots(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
    """One Alpaca multi-snapshot call → many symbols. Falls back to per-symbol."""
    headers = _alpaca_headers()
    if not headers or not symbols:
        return {}
    base = _alpaca_data_url()
    out: Dict[str, Dict[str, Any]] = {}
    syms = ",".join(s.upper().strip() for s in symbols if s.strip())[:1000]
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(
                f"{base}/v2/stocks/snapshots",
                params={"symbols": syms},
                headers=headers,
            )
    except Exception as e:
        logger.warning(
            "alpaca_snapshots_request_failed",
            error=f"{type(e).__name__}: {e}",
            symbols=syms[:120],
        )
        return await _fetch_alpaca_snapshots_fallback(symbols)
    if r.status_code != 200:
        try:
            body = r.text[:200]
        except Exception:
            body = ""
        logger.warning(
            "alpaca_snapshots_bad_status",
            status=r.status_code,
            body=body,
            symbols=syms[:120],
        )
        return await _fetch_alpaca_snapshots_fallback(symbols)
    try:
        data = r.json() or {}
        for sym, snap in data.items():
            if not isinstance(snap, dict):
                continue
            parsed = _parse_snapshot(sym, snap)
            if parsed["last"] > 0:
                out[sym] = parsed
    except Exception as e:
        logger.warning("alpaca_snapshots_parse_failed", error=f"{type(e).__name__}: {e}")
    return out


async def _fetch_alpaca_snapshots_fallback(symbols: List[str]) -> Dict[str, Dict[str, Any]]:
    """When the multi-snapshot endpoint fails, hit Finnhub for last/prev close."""
    out: Dict[str, Dict[str, Any]] = {}
    fk = os.environ.get("FINNHUB_API_KEY")
    if not fk:
        return out
    async with httpx.AsyncClient(timeout=4.0) as client:
        for sym in symbols:
            s = sym.upper().strip()
            if not s:
                continue
            try:
                r = await client.get(
                    f"https://finnhub.io/api/v1/quote",
                    params={"symbol": s, "token": fk},
                )
                if r.status_code != 200:
                    continue
                d = r.json() or {}
                last = float(d.get("c") or 0)
                if last <= 0:
                    continue
                prev = float(d.get("pc") or 0)
                change = round(last - prev, 4) if prev else 0.0
                change_pct = round(change / prev * 100, 4) if prev else 0.0
                out[s] = {
                    "symbol": s, "last": last, "price": last,
                    "bid": last, "ask": last,
                    "change": change, "change_pct": change_pct,
                    "open": float(d.get("o") or last),
                    "high": float(d.get("h") or last),
                    "low": float(d.get("l") or last),
                    "close": last,
                    "volume": 0.0,
                    "prev_close": prev,
                    "trade_ts": None,
                    "source": "finnhub",
                    "_fetched_at": time.time(),
                }
            except Exception:
                continue
    return out


async def _refresh_symbols(symbols: List[str]) -> None:
    if not symbols:
        return
    fresh = await _fetch_alpaca_snapshots(symbols)
    if not fresh:
        return
    async with _CACHE_LOCK:
        _SNAPSHOT_CACHE.update(fresh)


async def _background_refresher() -> None:
    """Continuously refresh the active universe (every ~1s)."""
    while True:
        try:
            syms = sorted(_BG_SYMBOLS)
            if syms:
                await _refresh_symbols(syms[:50])
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug("bg_refresh_error", error=str(e))
        await asyncio.sleep(_BG_INTERVAL_S)


DEFAULT_UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "SPY", "QQQ", "TSLA", "META", "AMZN", "GOOGL",
    "AMD", "NFLX", "JPM", "V", "MA", "AVGO", "LLY", "UNH", "IWM", "DIA",
]


def _ensure_background() -> None:
    global _BG_TASK
    if _BG_TASK is None or _BG_TASK.done():
        loop = asyncio.get_event_loop()
        _BG_TASK = loop.create_task(_background_refresher())


async def prewarm_live_quotes(symbols: Optional[List[str]] = None) -> None:
    """Call once at startup to populate the cache + start the background refresher."""
    syms = symbols or DEFAULT_UNIVERSE
    for s in syms:
        _BG_SYMBOLS.add(s.upper())
    _ensure_background()
    await _refresh_symbols(syms)


def _track(symbols: List[str]) -> None:
    for s in symbols:
        _BG_SYMBOLS.add(s.upper().strip())


def _kick_background_refresh(symbols: List[str]) -> None:
    """Schedule a non-blocking refresh, deduped per symbol-set."""
    key = ",".join(sorted(symbols))
    task = _INFLIGHT.get(key)
    if task and not task.done():
        return
    async def _run():
        try:
            await _refresh_symbols(symbols)
        finally:
            _INFLIGHT.pop(key, None)
    try:
        loop = asyncio.get_event_loop()
        _INFLIGHT[key] = loop.create_task(_run())
    except RuntimeError:
        pass


async def _get_quotes(symbols: List[str]) -> List[Dict[str, Any]]:
    """Fast read with stale-while-revalidate semantics."""
    now = time.time()
    syms = [s.upper().strip() for s in symbols if s.strip()]
    _track(syms)
    _ensure_background()

    async with _CACHE_LOCK:
        cache_copy = dict(_SNAPSHOT_CACHE)

    expired: List[str] = []   # > STALE_S — must fetch synchronously
    stale: List[str] = []     # > FRESH_S — serve stale + background refresh
    for s in syms:
        entry = cache_copy.get(s)
        age = now - entry.get("_fetched_at", 0) if entry else 1e9
        if not entry or age > _CACHE_STALE_S:
            expired.append(s)
        elif age > _CACHE_FRESH_S:
            stale.append(s)

    if expired:
        await _refresh_symbols(expired)
        async with _CACHE_LOCK:
            cache_copy = dict(_SNAPSHOT_CACHE)

    if stale:
        _kick_background_refresh(stale)

    out: List[Dict[str, Any]] = []
    for s in syms:
        e = cache_copy.get(s)
        if e and e.get("last", 0) > 0:
            out.append({k: v for k, v in e.items() if not k.startswith("_")})
        else:
            out.append({"symbol": s, "ok": False, "error": "unavailable", "last": 0, "price": 0})
    return out


@router.get("/api/v1/live/quotes")
async def live_quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    """Fast cached batch quote. <50ms p99 when warm, ~250ms cold."""
    t0 = time.time()
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:50]
    quotes = await _get_quotes(syms)
    return {
        "ok": True,
        "quotes": quotes,
        "count": len(quotes),
        "latency_ms": round((time.time() - t0) * 1000, 2),
    }


@router.websocket("/ws/quotes")
async def ws_quotes(ws: WebSocket, symbols: str = Query("AAPL,MSFT,NVDA,SPY,QQQ,TSLA")):
    """Push live quotes every ~1s. Client may send {action:'subscribe',symbols:[...]} or 'unsubscribe'."""
    await ws.accept()
    syms = {s.strip().upper() for s in symbols.split(",") if s.strip()}
    _track(list(syms))
    _ensure_background()

    last_sent: Dict[str, float] = {}

    async def push_loop():
        while True:
            try:
                async with _CACHE_LOCK:
                    snap = {s: dict(_SNAPSHOT_CACHE.get(s, {})) for s in syms}
                payload = []
                for s in sorted(syms):
                    q = snap.get(s)
                    if not q or q.get("last", 0) <= 0:
                        continue
                    if last_sent.get(s) == q["last"]:
                        continue
                    last_sent[s] = q["last"]
                    payload.append({k: v for k, v in q.items() if not k.startswith("_")})
                if payload:
                    await ws.send_text(json.dumps({"type": "quotes", "data": payload}))
            except Exception:
                break
            await asyncio.sleep(_BG_INTERVAL_S)

    pusher = asyncio.create_task(push_loop())
    try:
        while True:
            msg = await ws.receive_text()
            try:
                obj = json.loads(msg)
            except Exception:
                continue
            action = obj.get("action")
            sub = obj.get("symbols") or []
            if action == "subscribe":
                for s in sub:
                    syms.add(str(s).upper().strip())
                _track(list(syms))
                last_sent.clear()
            elif action == "unsubscribe":
                for s in sub:
                    syms.discard(str(s).upper().strip())
            elif action == "ping":
                await ws.send_text(json.dumps({"type": "pong", "ts": time.time()}))
    except WebSocketDisconnect:
        pass
    finally:
        pusher.cancel()
