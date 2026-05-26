"""
v1.13 Market Data API with Record/Replay and Provenance
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
from datetime import date
import os

from ...market_data.record_replay import (
    get_cache,
    MarketDataSource
)
from ...config import get_settings

router = APIRouter(tags=["Market Data v1.13"])


# ── Request/Response Models ──────────────────────────────────────────


class ProviderInfo(BaseModel):
    """Provider information with enabled state per mode."""
    name: str
    enabled_demo: bool
    enabled_local: bool
    description: str


class ProvenanceInfo(BaseModel):
    """Provenance metadata for data source transparency."""
    source: Literal["DEMO", "LOCAL_CACHE", "LOCAL_REPLAY", "LOCAL_FETCH"]
    cache_key: Optional[str] = None
    checksum: Optional[str] = None
    fetched_at: Optional[str] = None
    provider: Optional[str] = None


class BarsRequest(BaseModel):
    """Request for OHLCV bars."""
    symbol: str
    start_date: date
    end_date: date
    timeframe: str = "1d"


class BarsResponse(BaseModel):
    """OHLCV bars with provenance."""
    symbol: str
    bars: List[Dict[str, Any]]
    provenance: ProvenanceInfo


class QuoteRequest(BaseModel):
    """Request for real-time quote."""
    symbol: str


class QuoteResponse(BaseModel):
    """Quote with provenance."""
    symbol: str
    price: float
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: Optional[float] = None
    change: Optional[float] = None
    change_pct: Optional[float] = None
    volume: Optional[float] = None
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    vwap: Optional[float] = None
    timestamp: Optional[str] = None
    provenance: ProvenanceInfo


# ── Route Handlers ────────────────────────────────────────────────────


@router.get("/providers", response_model=List[ProviderInfo])
async def list_providers():
    """
    List available market data providers with enabled state per mode.
    """
    return [
        ProviderInfo(
            name="DEMO",
            enabled_demo=True,
            enabled_local=False,
            description="Deterministic fixtures (zero network)"
        ),
        ProviderInfo(
            name="Yahoo Finance",
            enabled_demo=False,
            enabled_local=True,
            description="Free delayed quotes (LOCAL mode only)"
        ),
        ProviderInfo(
            name="Alpaca",
            enabled_demo=False,
            enabled_local=bool(get_settings().apca_api_key_id),
            description="Real-time market data (requires API key)"
        )
    ]


@router.post("/bars", response_model=BarsResponse)
async def get_bars(req: BarsRequest):
    """
    Get OHLCV bars with provenance tracking.
    
    Policy:
    - DEMO mode (DEMO_MODE=1): Returns fixture data, source=DEMO
    - LOCAL mode: Uses record/replay cache
      1. Check replay artifact (cache_key based)
      2. If replay exists: return replay, source=LOCAL_REPLAY
      3. If no replay: fetch from provider, save replay, source=LOCAL_FETCH
    """
    # Check mode
    demo_mode = os.getenv("DEMO_MODE", "0") == "1"
    
    if demo_mode:
        # DEMO mode: fixture data (zero network)
        bars = [
            {"time": f"{req.start_date}T09:30:00Z", "open": 100.0, "high": 105.0, "low": 99.0, "close": 103.0, "volume": 1000000},
            {"time": f"{req.end_date}T09:30:00Z", "open": 103.0, "high": 108.0, "low": 102.0, "close": 107.0, "volume": 1200000}
        ]
        
        provenance = ProvenanceInfo(
            source="DEMO",
            provider="fixture"
        )
        
        return BarsResponse(
            symbol=req.symbol,
            bars=bars,
            provenance=provenance
        )
    
    # LOCAL mode: record/replay
    cache = get_cache()
    
    request_params = {
        "symbol": req.symbol,
        "start_date": req.start_date.isoformat(),
        "end_date": req.end_date.isoformat(),
        "timeframe": req.timeframe
    }
    
    def fetch_yahoo_bars():
        """Fetch real OHLCV bars from yfinance."""
        import yfinance as yf
        from datetime import timedelta
        try:
            ticker = yf.Ticker(req.symbol)
            # Add 1 day to end_date since yfinance end is exclusive
            end = req.end_date + timedelta(days=1)
            hist = ticker.history(start=str(req.start_date), end=str(end), interval=req.timeframe if req.timeframe in ("1d", "1wk", "1mo") else "1d")
            if hist.empty:
                return {"bars": []}
            bars = []
            for idx, row in hist.iterrows():
                bars.append({
                    "time": idx.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "open": round(float(row["Open"]), 4),
                    "high": round(float(row["High"]), 4),
                    "low": round(float(row["Low"]), 4),
                    "close": round(float(row["Close"]), 4),
                    "volume": int(row["Volume"]),
                })
            return {"bars": bars}
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"yfinance bars fetch failed for {req.symbol}: {e}")
            return {"bars": []}
    
    data, source, cache_key = cache.get_or_fetch("yahoo", request_params, fetch_yahoo_bars)
    
    # Build provenance
    artifact = cache.load_replay(cache_key)
    provenance = ProvenanceInfo(
        source=source,
        cache_key=cache_key,
        checksum=artifact.checksum if artifact else None,
        fetched_at=artifact.fetched_at if artifact else None,
        provider="yahoo"
    )
    
    return BarsResponse(
        symbol=req.symbol,
        bars=data.get("bars", []),
        provenance=provenance
    )


@router.post("/quote", response_model=QuoteResponse)
async def get_quote(req: QuoteRequest):
    """
    Real-time quote — Alpaca snapshot first (single request, includes daily OHLCV
    and previous close), then Finnhub, then yfinance fast_info as a last resort.
    Targets <250ms p99 latency.
    """
    import logging
    from datetime import datetime, timezone
    _log = logging.getLogger(__name__)

    price: float = 0.0
    provider_name = "unknown"
    open_price: float = 0.0
    high_price: float = 0.0
    low_price: float = 0.0
    close_price: float = 0.0
    volume: float = 0.0
    prev_close: float = 0.0
    bid_override: float = 0.0
    ask_override: float = 0.0

    symbol_upper = req.symbol.upper()

    # --- Try Alpaca snapshot (fast, single round trip) ---
    try:
        from .market_quote import _quote_alpaca
        import os as _os
        key_id = _os.environ.get("APCA_API_KEY_ID")
        secret = _os.environ.get("APCA_API_SECRET_KEY")
        if key_id and secret:
            import httpx
            endpoint = _os.environ.get("APCA_DATA_URL", "https://data.alpaca.markets")
            headers = {"APCA-API-KEY-ID": key_id, "APCA-API-SECRET-KEY": secret}
            async with httpx.AsyncClient(timeout=3.5) as client:
                r = await client.get(
                    f"{endpoint}/v2/stocks/{symbol_upper}/snapshot",
                    headers=headers,
                )
            if r.status_code == 200:
                snap = r.json()
                quote = snap.get("latestQuote") or {}
                trade = snap.get("latestTrade") or {}
                daily = snap.get("dailyBar") or snap.get("minuteBar") or {}
                prev = snap.get("prevDailyBar") or {}
                bid_override = float(quote.get("bp") or 0)
                ask_override = float(quote.get("ap") or 0)
                price = float(
                    trade.get("p")
                    or daily.get("c")
                    or ((bid_override + ask_override) / 2 if bid_override and ask_override else 0)
                )
                open_price = float(daily.get("o") or 0)
                high_price = float(daily.get("h") or 0)
                low_price = float(daily.get("l") or 0)
                close_price = float(daily.get("c") or price)
                volume = float(daily.get("v") or 0)
                prev_close = float(prev.get("c") or 0)
                if price > 0:
                    provider_name = "alpaca"
    except Exception as e:
        _log.debug(f"Alpaca snapshot failed for {symbol_upper}: {e}")

    # --- Finnhub fallback ---
    if price == 0.0:
        try:
            import os as _os
            import httpx
            fk = _os.environ.get("FINNHUB_API_KEY")
            if fk:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    r = await client.get(
                        f"https://finnhub.io/api/v1/quote?symbol={symbol_upper}&token={fk}",
                    )
                if r.status_code == 200:
                    d = r.json()
                    if (d.get("c") or 0) > 0:
                        price = float(d["c"])
                        open_price = float(d.get("o") or price)
                        high_price = float(d.get("h") or price)
                        low_price = float(d.get("l") or price)
                        close_price = price
                        prev_close = float(d.get("pc") or 0)
                        provider_name = "finnhub"
        except Exception as e:
            _log.debug(f"Finnhub quote failed for {symbol_upper}: {e}")

    # --- yfinance fast_info as last resort (fast, no history) ---
    if price == 0.0:
        try:
            yf_symbol = symbol_upper
            if symbol_upper in ("VIX", "GSPC", "DJI", "IXIC", "RUT", "TNX", "TYX", "IRX"):
                yf_symbol = f"^{symbol_upper}"
            import yfinance as yf  # type: ignore
            info = yf.Ticker(yf_symbol).fast_info
            last_p = float(getattr(info, "last_price", 0) or 0)
            if last_p > 0:
                price = last_p
                prev_close = float(getattr(info, "previous_close", 0) or 0)
                open_price = float(getattr(info, "open", price) or price)
                high_price = float(getattr(info, "day_high", price) or price)
                low_price = float(getattr(info, "day_low", price) or price)
                close_price = price
                volume = float(getattr(info, "last_volume", 0) or 0)
                provider_name = "yahoo"
        except Exception as e:
            _log.debug(f"yfinance fast_info failed: {e}")

    if price == 0.0:
        _log.warning(f"No market data available for {req.symbol}, returning zero quote")
        provenance = ProvenanceInfo(source="NO_DATA", provider="none")
        return QuoteResponse(
            symbol=req.symbol, price=0.0,
            bid=0.0, ask=0.0, last=0.0, change=0.0, change_pct=0.0,
            volume=0.0, open=0.0, high=0.0, low=0.0, close=0.0,
            timestamp=datetime.now(timezone.utc).isoformat(),
            provenance=provenance,
        )

    # Compute derived fields
    change = price - prev_close if prev_close else 0.0
    change_pct = (change / prev_close * 100) if prev_close else 0.0
    if bid_override and ask_override:
        bid = round(bid_override, 4)
        ask = round(ask_override, 4)
    else:
        spread = price * 0.0002
        bid = round(price - spread / 2, 4)
        ask = round(price + spread / 2, 4)
    # Simple VWAP approximation: (high+low+close)/3
    vwap = round((high_price + low_price + close_price) / 3, 4) if high_price else price

    provenance = ProvenanceInfo(source="LOCAL_FETCH", provider=provider_name)

    return QuoteResponse(
        symbol=req.symbol,
        price=price,
        bid=bid,
        ask=ask,
        last=price,
        change=round(change, 4),
        change_pct=round(change_pct, 4),
        volume=volume,
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        vwap=vwap,
        timestamp=datetime.now(timezone.utc).isoformat(),
        provenance=provenance,
    )



@router.get("/{symbol}/quote")
async def get_quote_by_path(symbol: str):
    """
    GET convenience endpoint: /market-data/{SYMBOL}/quote
    The frontend's DashboardUI2, TradingUI2, PortfolioUI2 call
    GET /api/v1/market-data/AAPL/quote — this shim delegates to the
    POST-based get_quote handler so both paths work.
    """
    return await get_quote(QuoteRequest(symbol=symbol))


@router.get("/replays", response_model=List[Dict[str, Any]])
async def list_replays():
    """
    List all replay artifacts for audit/provenance.
    Returns cache manifest showing recorded fetches.
    """
    cache = get_cache()
    return cache.list_replays()


# ── Additional GET endpoints for frontend compatibility ───────────────

@router.get("/{symbol}/orderbook")
async def get_orderbook(symbol: str, depth: int = 10):
    """
    Simulated L2 order book for a symbol.
    Generates synthetic bids/asks around the latest price.
    """
    import random
    # Get latest price
    quote = await get_quote(QuoteRequest(symbol=symbol))
    mid = quote.price if quote.price > 0 else 100.0
    spread_pct = 0.0005
    bids = []
    asks = []
    for i in range(depth):
        offset = mid * spread_pct * (i + 1)
        bid_price = round(mid - offset, 2)
        ask_price = round(mid + offset, 2)
        bid_size = random.randint(50, 5000) * 100
        ask_size = random.randint(50, 5000) * 100
        bids.append({"price": bid_price, "size": bid_size, "count": random.randint(1, 20)})
        asks.append({"price": ask_price, "size": ask_size, "count": random.randint(1, 20)})
    return {
        "symbol": symbol,
        "bids": bids,
        "asks": asks,
        "spread": round(asks[0]["price"] - bids[0]["price"], 4) if bids and asks else 0,
    }


@router.get("/{symbol}/trades")
async def get_trades(symbol: str, limit: int = 50):
    """
    Simulated recent trades (time & sales) for a symbol.
    """
    import random
    from datetime import datetime, timezone, timedelta
    
    quote = await get_quote(QuoteRequest(symbol=symbol))
    mid = quote.price if quote.price > 0 else 100.0
    now = datetime.now(timezone.utc)
    trades = []
    for i in range(limit):
        t = now - timedelta(seconds=i * random.uniform(0.5, 5.0))
        offset = mid * random.uniform(-0.002, 0.002)
        price = round(mid + offset, 2)
        size = random.choice([100, 200, 300, 500, 1000, 2000, 5000])
        side = random.choice(["buy", "sell"])
        trades.append({
            "time": t.isoformat(),
            "price": price,
            "size": size,
            "side": side,
        })
    return trades


# ── Batch Quote endpoint (replaces 10 individual /quote calls in WatchlistPanel) ──

class BatchQuoteRequest(BaseModel):
    """Request for batch quotes — up to 50 symbols at once."""
    symbols: List[str]


@router.post("/quotes/batch")
async def get_quotes_batch(req: BatchQuoteRequest):
    """
    Batch quote endpoint: fetch quotes for multiple symbols in parallel.
    Replaces N individual GET /{symbol}/quote calls with a single request.
    POST /api/v1/market-data/quotes/batch
    Body: {"symbols": ["AAPL", "TSLA", ...]}  (max 50)
    """
    import asyncio as _asyncio

    if len(req.symbols) > 50:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Maximum 50 symbols per batch request")

    symbols = [s.strip().upper() for s in req.symbols if s.strip()]

    async def fetch_one(sym: str) -> Dict[str, Any]:
        try:
            result = await get_quote(QuoteRequest(symbol=sym))
            return {
                "symbol": sym,
                "price": result.price,
                "bid": result.bid,
                "ask": result.ask,
                "last": result.last,
                "change": result.change,
                "change_pct": result.change_pct,
                "volume": result.volume,
                "open": result.open,
                "high": result.high,
                "low": result.low,
                "close": result.close,
                "timestamp": result.timestamp,
                "ok": True,
            }
        except Exception as e:
            return {"symbol": sym, "ok": False, "error": str(e), "price": 0.0}

    results = await _asyncio.gather(*[fetch_one(s) for s in symbols])
    return {"quotes": list(results), "count": len(results)}
