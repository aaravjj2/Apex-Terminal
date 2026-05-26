"""
heatmap_compat.py — Heatmap + Fixed-Income compat routes for UI2 pages
======================================================================
GET /api/v1/market-data/heatmap      → Sector heatmap data (Alpaca live cache)
GET /api/v1/fixed-income/yield-curve → US Treasury yield curve (FRED/yfinance)
"""
from __future__ import annotations
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from fastapi import APIRouter, Query

router = APIRouter(tags=["UI2 Compat"])
_log = logging.getLogger(__name__)

# Heatmap response cache (per-period). yfinance is slow; Alpaca live cache is instant.
_HEATMAP_CACHE: Dict[str, Tuple[float, Dict]] = {}
_HEATMAP_TTL_S = 15.0

# ── Symbol → Sector + MarketCap mapping ──────────────────────────────────────
# MarketCap values are approximate and used for tile sizing only (updated periodically)
STOCK_META: List[Dict] = [
    {"symbol": "AAPL", "sector": "Technology", "marketCap": 2.95e12},
    {"symbol": "MSFT", "sector": "Technology", "marketCap": 2.80e12},
    {"symbol": "NVDA", "sector": "Technology", "marketCap": 1.20e12},
    {"symbol": "GOOGL", "sector": "Technology", "marketCap": 1.75e12},
    {"symbol": "META", "sector": "Technology", "marketCap": 0.95e12},
    {"symbol": "AVGO", "sector": "Technology", "marketCap": 0.55e12},
    {"symbol": "ORCL", "sector": "Technology", "marketCap": 0.35e12},
    {"symbol": "AMD", "sector": "Technology", "marketCap": 0.28e12},
    {"symbol": "AMZN", "sector": "Consumer Discretionary", "marketCap": 1.55e12},
    {"symbol": "TSLA", "sector": "Consumer Discretionary", "marketCap": 0.78e12},
    {"symbol": "HD", "sector": "Consumer Discretionary", "marketCap": 0.38e12},
    {"symbol": "NKE", "sector": "Consumer Discretionary", "marketCap": 0.18e12},
    {"symbol": "JPM", "sector": "Financials", "marketCap": 0.52e12},
    {"symbol": "V", "sector": "Financials", "marketCap": 0.50e12},
    {"symbol": "MA", "sector": "Financials", "marketCap": 0.42e12},
    {"symbol": "BAC", "sector": "Financials", "marketCap": 0.30e12},
    {"symbol": "BRK-B", "sector": "Financials", "marketCap": 0.78e12},
    {"symbol": "UNH", "sector": "Healthcare", "marketCap": 0.48e12},
    {"symbol": "JNJ", "sector": "Healthcare", "marketCap": 0.42e12},
    {"symbol": "LLY", "sector": "Healthcare", "marketCap": 0.58e12},
    {"symbol": "PFE", "sector": "Healthcare", "marketCap": 0.16e12},
    {"symbol": "ABBV", "sector": "Healthcare", "marketCap": 0.30e12},
    {"symbol": "XOM", "sector": "Energy", "marketCap": 0.44e12},
    {"symbol": "CVX", "sector": "Energy", "marketCap": 0.32e12},
    {"symbol": "COP", "sector": "Energy", "marketCap": 0.14e12},
    {"symbol": "DIS", "sector": "Communication", "marketCap": 0.22e12},
    {"symbol": "NFLX", "sector": "Communication", "marketCap": 0.25e12},
    {"symbol": "CMCSA", "sector": "Communication", "marketCap": 0.17e12},
    {"symbol": "PG", "sector": "Consumer Staples", "marketCap": 0.36e12},
    {"symbol": "KO", "sector": "Consumer Staples", "marketCap": 0.27e12},
    {"symbol": "PEP", "sector": "Consumer Staples", "marketCap": 0.24e12},
    {"symbol": "CAT", "sector": "Industrials", "marketCap": 0.18e12},
    {"symbol": "GE", "sector": "Industrials", "marketCap": 0.17e12},
    {"symbol": "HON", "sector": "Industrials", "marketCap": 0.14e12},
    {"symbol": "NEE", "sector": "Utilities", "marketCap": 0.15e12},
    {"symbol": "DUK", "sector": "Utilities", "marketCap": 0.08e12},
    {"symbol": "AMT", "sector": "Real Estate", "marketCap": 0.10e12},
    {"symbol": "PLD", "sector": "Real Estate", "marketCap": 0.12e12},
    {"symbol": "LIN", "sector": "Materials", "marketCap": 0.20e12},
    {"symbol": "APD", "sector": "Materials", "marketCap": 0.06e12},
]

PERIOD_TO_YF = {
    "1D": ("1d", "5m"),
    "1W": ("5d", "1d"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1wk"),
    "YTD": ("ytd", "1d"),
    "1Y": ("1y", "1wk"),
}


def _fetch_quotes_sync(symbols: List[str], period: str) -> Dict[str, float]:
    """Fetch pct change for symbols using yfinance. Returns {symbol: change_pct}."""
    try:
        import yfinance as yf
        yf_period, yf_interval = PERIOD_TO_YF.get(period, ("1d", "5m"))
        data = yf.download(
            tickers=" ".join(symbols),
            period=yf_period,
            interval=yf_interval,
            progress=False,
            group_by="ticker",
            auto_adjust=True,
            threads=True,
        )
        results: Dict[str, float] = {}
        if len(symbols) == 1:
            sym = symbols[0]
            closes = data.get("Close")
            if closes is not None and len(closes) >= 2:
                pct = (closes.iloc[-1] - closes.iloc[0]) / closes.iloc[0] * 100
                results[sym] = round(float(pct), 2)
        else:
            for sym in symbols:
                try:
                    closes = data[sym]["Close"].dropna()
                    if len(closes) >= 2:
                        pct = (closes.iloc[-1] - closes.iloc[0]) / closes.iloc[0] * 100
                        results[sym] = round(float(pct), 2)
                except Exception:
                    pass
        return results
    except Exception as e:
        _log.warning(f"yfinance heatmap fetch failed: {e}")
        return {}


@router.get("/api/v1/market-data/heatmap")
async def get_heatmap(
    period: str = Query("1D"),
    tab: str = Query("SECTOR MAP"),
):
    """
    Return live heatmap data. For 1D we use the Alpaca live snapshot cache
    (instant, <50 ms). For multi-day windows we fall back to yfinance with
    a 15s response cache to keep the dashboard snappy.
    """
    cached = _HEATMAP_CACHE.get(period)
    if cached and (time.time() - cached[0] < _HEATMAP_TTL_S):
        return cached[1]

    symbols = [s["symbol"] for s in STOCK_META]
    quote_map: Dict[str, float] = {}

    if period == "1D":
        # Fast path: use the live_quotes snapshot cache (Alpaca multi-snapshot).
        try:
            from .live_quotes import _get_quotes  # type: ignore
            quotes = await _get_quotes(symbols)
            for q in quotes:
                if q.get("last", 0) > 0:
                    quote_map[q["symbol"]] = float(q.get("change_pct", 0.0))
        except Exception as e:
            _log.warning(f"live snapshot heatmap fetch failed: {e}")

    if not quote_map:
        # Fallback: yfinance batch (only when live cache is empty or non-1D window).
        loop = asyncio.get_event_loop()
        quote_map = await loop.run_in_executor(None, _fetch_quotes_sync, symbols, period)

    stocks = []
    for s in STOCK_META:
        sym = s["symbol"]
        change = quote_map.get(sym, 0.0)
        stocks.append({
            "symbol": sym,
            "sector": s["sector"],
            "marketCap": s["marketCap"],
            "change": change,
        })

    advancers = sum(1 for s in stocks if s["change"] > 0)
    decliners  = sum(1 for s in stocks if s["change"] < 0)
    unchanged  = sum(1 for s in stocks if s["change"] == 0)
    fetched_at = datetime.now(timezone.utc).isoformat()

    payload = {
        "stocks": stocks,
        "summary": {
            "advancers": advancers,
            "decliners": decliners,
            "unchanged": unchanged,
            "total": len(stocks),
        },
        "period": period,
        "tab": tab,
        "source": "alpaca" if period == "1D" and quote_map else "yfinance",
        "fetched_at": fetched_at,
    }
    _HEATMAP_CACHE[period] = (time.time(), payload)
    return payload


# ── Fixed income yield curve via yfinance Treasury tickers ───────────────────

TREASURY_TICKERS = {
    "1M": "^IRX",   # 13-week T-bill (proxy for 1M)
    "3M": "^IRX",
    "6M": "^IRX",
    "1Y": "^IRX",
    "2Y": "^TXY",   # 2Y Treasury
    "5Y": "^FVX",
    "10Y": "^TNX",
    "30Y": "^TYX",
}

# Fallback rates when yfinance cannot fetch (last known FOMC cycle approximations)
FALLBACK_YIELDS = {
    "1M": 5.30, "3M": 5.35, "6M": 5.32, "1Y": 5.10,
    "2Y": 4.68, "3Y": 4.40, "5Y": 4.25, "7Y": 4.28,
    "10Y": 4.33, "20Y": 4.60, "30Y": 4.48,
}


def _fetch_treasury_yield(ticker_sym: str) -> Optional[float]:
    """Fetch latest yield for a Treasury ticker."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker_sym)
        hist = t.history(period="5d")
        if not hist.empty:
            return round(float(hist["Close"].iloc[-1]) / 100, 4)  # yfinance returns as percentage
    except Exception:
        pass
    return None


@router.get("/api/v1/fixed-income/yield-curve")
async def get_yield_curve():
    """Return US Treasury yield curve — live where possible, fallback otherwise."""
    loop = asyncio.get_event_loop()
    tenors = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"]

    # Fetch the key anchors we have tickers for
    anchor_tickers = {"10Y": "^TNX", "30Y": "^TYX", "5Y": "^FVX", "3M": "^IRX"}
    fetched: Dict[str, float] = {}
    for tenor, ticker_sym in anchor_tickers.items():
        val = await loop.run_in_executor(None, _fetch_treasury_yield, ticker_sym)
        if val is not None:
            fetched[tenor] = round(val * 100, 3)  # back to percentage for display

    # Build curve: use live for anchors, interpolate/fallback for others
    curve = []
    for tenor in tenors:
        if tenor in fetched:
            yld = fetched[tenor]
        else:
            yld = FALLBACK_YIELDS.get(tenor, 4.50)
        prev = FALLBACK_YIELDS.get(tenor, yld)
        change_bp = round((yld - prev) * 100) if tenor in fetched else 0
        curve.append({
            "tenor": tenor,
            "yield": round(yld, 3),
            "change_bp": change_bp,
        })

    return {
        "curve": curve,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "yfinance" if fetched else "fallback",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
