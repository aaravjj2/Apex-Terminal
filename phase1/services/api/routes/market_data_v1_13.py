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
            enabled_local=bool(os.getenv("ALPACA_API_KEY")),
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
        """Mock fetch function - in reality would call yfinance."""
        # For testing: return deterministic mock data
        return {
            "bars": [
                {"time": f"{req.start_date}T09:30:00Z", "close": 150.0},
                {"time": f"{req.end_date}T09:30:00Z", "close": 155.0}
            ]
        }
    
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
    Get real-time quote with provenance.
    Fetches latest close from Yahoo Finance via yfinance.
    Falls back to last-known Alpaca bar if yfinance is unavailable.
    Returns full quote data: bid, ask, last, change, OHLCV, vwap.
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

    yf_symbol = req.symbol
    # For common indices, prefix with ^
    if req.symbol.upper() in ("VIX", "GSPC", "DJI", "IXIC", "RUT", "TNX", "TYX", "IRX"):
        yf_symbol = f"^{req.symbol}"

    # --- Try yfinance (delayed quotes, free tier) ---
    try:
        import yfinance as yf  # type: ignore
        ticker = yf.Ticker(yf_symbol)
        hist = ticker.history(period="5d")
        if not hist.empty:
            last_row = hist.iloc[-1]
            price = float(last_row["Close"])
            open_price = float(last_row["Open"])
            high_price = float(last_row["High"])
            low_price = float(last_row["Low"])
            close_price = float(last_row["Close"])
            volume = float(last_row["Volume"])
            if len(hist) >= 2:
                prev_close = float(hist["Close"].iloc[-2])
            else:
                prev_close = open_price
            provider_name = "yahoo"
    except Exception as e:
        _log.warning(f"yfinance quote failed for {yf_symbol}: {e}")

    # --- Fall back to Alpaca latest bar if yfinance returned nothing ---
    if price == 0.0:
        try:
            from ...market_data.providers import get_provider
            provider = get_provider("alpaca")
            from ...market_data.providers.types import QuoteRequest as ProviderQuoteRequest
            resp = await provider.get_quote(ProviderQuoteRequest(symbol=req.symbol))
            price = float(resp.quote.price)
            provider_name = "alpaca"
        except Exception as e2:
            _log.warning(f"Alpaca quote fallback failed for {req.symbol}: {e2}")

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
    spread = price * 0.0002  # simulate ~2bp spread
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
