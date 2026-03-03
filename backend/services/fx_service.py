"""
FX Service — §8.1–§8.2
=======================
Foreign exchange analytics, pair pricing, cross rates, forward curves,
carry trade analysis, real-time FX risk management.

Uses Polygon/TwelveData for live FX data with yfinance as fallback.
"""

import os
import math
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

import httpx

logger = logging.getLogger("fx_service")

POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
TWELVE_KEY = os.getenv("TWELVEDATA_API_KEY", "")
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
FRED_KEY = os.getenv("FRED_API_KEY", "")


# ═══════════════════════════════════════════════════════════════════════════════
# FX PAIR DATA
# ═══════════════════════════════════════════════════════════════════════════════

MAJOR_PAIRS = [
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
    "AUD/USD", "USD/CAD", "NZD/USD",
]

CROSS_PAIRS = [
    "EUR/GBP", "EUR/JPY", "GBP/JPY", "EUR/CHF",
    "AUD/JPY", "CHF/JPY", "EUR/AUD", "GBP/AUD",
    "EUR/CAD", "GBP/CAD", "EUR/NZD", "AUD/NZD",
    "CAD/JPY", "NZD/JPY", "GBP/CHF", "AUD/CHF",
]

EMERGING_PAIRS = [
    "USD/MXN", "USD/BRL", "USD/ZAR", "USD/TRY",
    "USD/INR", "USD/CNY", "USD/KRW", "USD/SGD",
    "USD/HKD", "USD/THB", "USD/PLN", "USD/CZK",
]

ALL_PAIRS = MAJOR_PAIRS + CROSS_PAIRS + EMERGING_PAIRS

# Central bank interest rates (approximate current)
INTEREST_RATES = {
    "USD": 0.0525, "EUR": 0.0450, "GBP": 0.0525, "JPY": 0.001,
    "CHF": 0.0175, "AUD": 0.0435, "CAD": 0.0500, "NZD": 0.0550,
    "MXN": 0.1100, "BRL": 0.1175, "ZAR": 0.0825, "TRY": 0.5000,
    "INR": 0.0650, "CNY": 0.0345, "KRW": 0.0350, "SGD": 0.0365,
    "HKD": 0.0575, "THB": 0.0250, "PLN": 0.0575, "CZK": 0.0700,
    "SEK": 0.0400, "NOK": 0.0450, "DKK": 0.0365,
}


@dataclass
class FXQuote:
    pair: str
    base: str
    quote: str
    bid: float = 0.0
    ask: float = 0.0
    mid: float = 0.0
    spread: float = 0.0
    spread_pips: float = 0.0
    change: float = 0.0
    change_pct: float = 0.0
    high_24h: float = 0.0
    low_24h: float = 0.0
    volume: float = 0.0
    timestamp: str = ""
    source: str = ""


@dataclass
class FXForward:
    pair: str
    spot: float
    tenor: str
    forward_rate: float
    forward_points: float
    annualized_basis: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# §8.1 — FX DATA FETCHER
# ═══════════════════════════════════════════════════════════════════════════════

class FXDataFetcher:
    """Fetch real-time and historical FX data."""

    def __init__(self):
        self._http: Optional[httpx.AsyncClient] = None
        self._quote_cache: dict[str, FXQuote] = {}
        self._cache_time: Optional[datetime] = None
        self._cache_ttl = 30  # seconds

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=15.0)
        return self._http

    def _normalize_pair(self, pair: str) -> tuple[str, str, str]:
        """Normalize pair format — returns (forex_pair, base, quote)."""
        pair = pair.upper().replace("-", "/").replace("_", "/")
        if "/" in pair:
            base, quote = pair.split("/")
        elif len(pair) == 6:
            base, quote = pair[:3], pair[3:]
        else:
            return pair, pair[:3], pair[3:] if len(pair) >= 6 else ""
        return f"{base}/{quote}", base, quote

    async def get_quote(self, pair: str) -> FXQuote:
        """Get real-time FX quote."""
        pair, base, quote_ccy = self._normalize_pair(pair)

        # Check cache
        if pair in self._quote_cache and self._cache_time:
            if (datetime.now(timezone.utc) - self._cache_time).seconds < self._cache_ttl:
                return self._quote_cache[pair]

        # Try Polygon
        if POLYGON_KEY:
            try:
                q = await self._fetch_polygon_quote(pair, base, quote_ccy)
                if q.mid > 0:
                    self._quote_cache[pair] = q
                    self._cache_time = datetime.now(timezone.utc)
                    return q
            except Exception as e:
                logger.warning(f"Polygon FX quote failed: {e}")

        # Try TwelveData
        if TWELVE_KEY:
            try:
                q = await self._fetch_twelvedata_quote(pair, base, quote_ccy)
                if q.mid > 0:
                    self._quote_cache[pair] = q
                    self._cache_time = datetime.now(timezone.utc)
                    return q
            except Exception as e:
                logger.warning(f"TwelveData FX quote failed: {e}")

        # Try Finnhub
        if FINNHUB_KEY:
            try:
                q = await self._fetch_finnhub_quote(pair, base, quote_ccy)
                if q.mid > 0:
                    self._quote_cache[pair] = q
                    self._cache_time = datetime.now(timezone.utc)
                    return q
            except Exception as e:
                logger.warning(f"Finnhub FX quote failed: {e}")

        # yfinance fallback
        return await self._fetch_yfinance_quote(pair, base, quote_ccy)

    async def _fetch_polygon_quote(self, pair: str, base: str, quote_ccy: str) -> FXQuote:
        http = await self._get_http()
        ticker = f"C:{base}{quote_ccy}"
        url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev?apiKey={POLYGON_KEY}"
        resp = await http.get(url)
        data = resp.json()
        result = data.get("results", [{}])[0]

        close = float(result.get("c", 0))
        open_price = float(result.get("o", close))
        change = close - open_price

        # Get real-time quote
        rt_url = f"https://api.polygon.io/v1/last_quote/currencies/{base}/{quote_ccy}?apiKey={POLYGON_KEY}"
        try:
            rt_resp = await http.get(rt_url)
            rt_data = rt_resp.json()
            bid = float(rt_data.get("last", {}).get("bid", close))
            ask = float(rt_data.get("last", {}).get("ask", close))
        except Exception:
            bid = close * 0.9999
            ask = close * 1.0001

        pip_size = 0.0001 if quote_ccy != "JPY" else 0.01

        return FXQuote(
            pair=pair, base=base, quote=quote_ccy,
            bid=bid, ask=ask, mid=(bid + ask) / 2,
            spread=ask - bid,
            spread_pips=round((ask - bid) / pip_size, 1),
            change=round(change, 5),
            change_pct=round(change / open_price * 100, 3) if open_price > 0 else 0,
            high_24h=float(result.get("h", close)),
            low_24h=float(result.get("l", close)),
            volume=float(result.get("v", 0)),
            timestamp=datetime.now(timezone.utc).isoformat(),
            source="polygon",
        )

    async def _fetch_twelvedata_quote(self, pair: str, base: str, quote_ccy: str) -> FXQuote:
        http = await self._get_http()
        symbol = f"{base}/{quote_ccy}"
        url = f"https://api.twelvedata.com/quote?symbol={symbol}&apikey={TWELVE_KEY}"
        resp = await http.get(url)
        data = resp.json()

        close = float(data.get("close", 0))
        open_price = float(data.get("open", close))
        change = float(data.get("change", 0))

        pip_size = 0.0001 if quote_ccy != "JPY" else 0.01

        return FXQuote(
            pair=pair, base=base, quote=quote_ccy,
            bid=close * 0.9999, ask=close * 1.0001, mid=close,
            spread=close * 0.0002,
            spread_pips=round(close * 0.0002 / pip_size, 1),
            change=change,
            change_pct=float(data.get("percent_change", 0)),
            high_24h=float(data.get("high", close)),
            low_24h=float(data.get("low", close)),
            timestamp=datetime.now(timezone.utc).isoformat(),
            source="twelvedata",
        )

    async def _fetch_finnhub_quote(self, pair: str, base: str, quote_ccy: str) -> FXQuote:
        http = await self._get_http()
        symbol = f"OANDA:{base}_{quote_ccy}"
        url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_KEY}"
        resp = await http.get(url)
        data = resp.json()

        close = float(data.get("c", 0))
        prev_close = float(data.get("pc", close))
        change = close - prev_close
        pip_size = 0.0001 if quote_ccy != "JPY" else 0.01

        return FXQuote(
            pair=pair, base=base, quote=quote_ccy,
            bid=close * 0.9999, ask=close * 1.0001, mid=close,
            spread=close * 0.0002,
            spread_pips=round(close * 0.0002 / pip_size, 1),
            change=round(change, 5),
            change_pct=round(change / prev_close * 100, 3) if prev_close > 0 else 0,
            high_24h=float(data.get("h", close)),
            low_24h=float(data.get("l", close)),
            timestamp=datetime.now(timezone.utc).isoformat(),
            source="finnhub",
        )

    async def _fetch_yfinance_quote(self, pair: str, base: str, quote_ccy: str) -> FXQuote:
        import concurrent.futures

        def _fetch():
            try:
                import yfinance as yf
                ticker = yf.Ticker(f"{base}{quote_ccy}=X")
                info = ticker.info
                close = info.get("regularMarketPrice", info.get("previousClose", 0))
                prev = info.get("previousClose", close)
                change = close - prev if close and prev else 0
                pip_size = 0.0001 if quote_ccy != "JPY" else 0.01

                return FXQuote(
                    pair=pair, base=base, quote=quote_ccy,
                    bid=close * 0.9999, ask=close * 1.0001, mid=close,
                    spread=close * 0.0002,
                    spread_pips=round(close * 0.0002 / pip_size, 1),
                    change=round(change, 5),
                    change_pct=round(change / prev * 100, 3) if prev > 0 else 0,
                    high_24h=info.get("dayHigh", close),
                    low_24h=info.get("dayLow", close),
                    volume=info.get("volume", 0) or 0,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    source="yfinance",
                )
            except Exception as e:
                logger.warning(f"yfinance FX failed: {e}")
                return FXQuote(pair=pair, base=base, quote=quote_ccy, source="error")

        loop = asyncio.get_event_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return await loop.run_in_executor(pool, _fetch)

    async def get_historical(self, pair: str, period: str = "1y",
                              interval: str = "1d") -> list[dict]:
        """Get historical FX data."""
        _, base, quote_ccy = self._normalize_pair(pair)

        # Try Polygon
        if POLYGON_KEY:
            try:
                return await self._polygon_historical(base, quote_ccy, period, interval)
            except Exception as e:
                logger.warning(f"Polygon FX historical failed: {e}")

        # yfinance fallback
        return await self._yfinance_historical(base, quote_ccy, period, interval)

    async def _polygon_historical(self, base: str, quote: str,
                                    period: str, interval: str) -> list[dict]:
        http = await self._get_http()
        ticker = f"C:{base}{quote}"

        period_map = {"1w": 7, "1M": 30, "3M": 90, "6M": 180, "1y": 365, "2y": 730, "5y": 1825}
        days = period_map.get(period, 365)

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        timespan = "day" if interval == "1d" else "hour" if interval == "1h" else "minute"
        mult = "1" if interval in ("1d", "1h") else interval.replace("m", "")

        url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/{mult}/{timespan}/{start}/{end}?adjusted=true&sort=asc&limit=50000&apiKey={POLYGON_KEY}"
        resp = await http.get(url)
        data = resp.json()

        return [
            {
                "timestamp": datetime.fromtimestamp(r["t"] / 1000, tz=timezone.utc).isoformat(),
                "open": r["o"], "high": r["h"], "low": r["l"],
                "close": r["c"], "volume": r.get("v", 0),
            }
            for r in data.get("results", [])
        ]

    async def _yfinance_historical(self, base: str, quote: str,
                                     period: str, interval: str) -> list[dict]:
        import concurrent.futures

        def _fetch():
            try:
                import yfinance as yf
                ticker = yf.Ticker(f"{base}{quote}=X")
                hist = ticker.history(period=period, interval=interval)
                return [
                    {
                        "timestamp": str(idx),
                        "open": float(row["Open"]),
                        "high": float(row["High"]),
                        "low": float(row["Low"]),
                        "close": float(row["Close"]),
                        "volume": int(row.get("Volume", 0)),
                    }
                    for idx, row in hist.iterrows()
                ]
            except Exception:
                return []

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return await loop.run_in_executor(pool, _fetch)


# ═══════════════════════════════════════════════════════════════════════════════
# §8.2 — FX ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

class FXAnalytics:
    """FX-specific analytics: cross rates, forwards, carry, correlation."""

    def __init__(self, fetcher: FXDataFetcher):
        self.fetcher = fetcher

    async def get_all_quotes(self, pairs: Optional[list[str]] = None) -> list[dict]:
        """Get quotes for all major pairs."""
        target_pairs = pairs or MAJOR_PAIRS
        quotes = []
        for pair in target_pairs:
            try:
                q = await self.fetcher.get_quote(pair)
                quotes.append(asdict(q))
            except Exception as e:
                logger.warning(f"Failed to get quote for {pair}: {e}")
        return quotes

    async def cross_rate(self, base: str, quote: str) -> dict:
        """Calculate cross rate via USD."""
        base = base.upper()
        quote = quote.upper()

        if base == "USD":
            q = await self.fetcher.get_quote(f"USD/{quote}")
            return {"pair": f"{base}/{quote}", "rate": q.mid, "method": "direct"}

        if quote == "USD":
            q = await self.fetcher.get_quote(f"{base}/USD")
            return {"pair": f"{base}/{quote}", "rate": q.mid, "method": "direct"}

        # Cross via USD
        base_usd = await self.fetcher.get_quote(f"{base}/USD")
        usd_quote = await self.fetcher.get_quote(f"USD/{quote}")

        if base_usd.mid > 0 and usd_quote.mid > 0:
            cross = base_usd.mid * usd_quote.mid
        else:
            # Try direct
            direct = await self.fetcher.get_quote(f"{base}/{quote}")
            cross = direct.mid

        return {
            "pair": f"{base}/{quote}",
            "rate": round(cross, 6),
            "base_usd": round(base_usd.mid, 6),
            "usd_quote": round(usd_quote.mid, 6),
            "method": "cross_via_usd",
        }

    async def cross_rate_matrix(self, currencies: Optional[list[str]] = None) -> dict:
        """Build N×N cross rate matrix."""
        if currencies is None:
            currencies = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"]

        n = len(currencies)
        matrix = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 1.0
                else:
                    try:
                        result = await self.cross_rate(currencies[i], currencies[j])
                        matrix[i][j] = result["rate"]
                    except Exception:
                        matrix[i][j] = 0

        return {
            "currencies": currencies,
            "matrix": matrix,
        }

    def calculate_forward(self, spot: float, base_rate: float, quote_rate: float,
                           tenor_days: int) -> FXForward:
        """Calculate FX forward rate using interest rate parity."""
        T = tenor_days / 365.0
        forward = spot * ((1 + quote_rate * T) / (1 + base_rate * T))
        forward_points = (forward - spot) * 10000  # In pips

        # Annualized forward basis
        if spot > 0 and T > 0:
            annualized_basis = ((forward / spot) ** (1 / T) - 1) * 100
        else:
            annualized_basis = 0

        tenor_map = {
            1: "O/N", 7: "1W", 14: "2W", 30: "1M", 60: "2M",
            90: "3M", 180: "6M", 270: "9M", 365: "1Y",
        }
        tenor = tenor_map.get(tenor_days, f"{tenor_days}D")

        return FXForward(
            pair="",
            spot=spot,
            tenor=tenor,
            forward_rate=round(forward, 6),
            forward_points=round(forward_points, 2),
            annualized_basis=round(annualized_basis, 3),
        )

    async def forward_curve(self, pair: str) -> list[dict]:
        """Generate forward curve for a pair."""
        _, base, quote_ccy = self.fetcher._normalize_pair(pair)
        q = await self.fetcher.get_quote(pair)

        base_rate = INTEREST_RATES.get(base, 0.03)
        quote_rate = INTEREST_RATES.get(quote_ccy, 0.03)

        tenors = [1, 7, 14, 30, 60, 90, 180, 270, 365, 547, 730]
        curve = []

        for days in tenors:
            fwd = self.calculate_forward(q.mid, base_rate, quote_rate, days)
            fwd.pair = pair
            curve.append(asdict(fwd))

        return curve

    async def carry_trade_analysis(self, pairs: Optional[list[str]] = None) -> list[dict]:
        """Analyze carry trade opportunities."""
        target_pairs = pairs or MAJOR_PAIRS + ["USD/MXN", "USD/TRY", "USD/BRL", "USD/ZAR"]
        analysis = []

        for pair in target_pairs:
            _, base, quote_ccy = self.fetcher._normalize_pair(pair)
            base_rate = INTEREST_RATES.get(base, 0)
            quote_rate = INTEREST_RATES.get(quote_ccy, 0)

            carry = base_rate - quote_rate  # Positive = earn carry going long base
            carry_monthly = carry / 12

            try:
                q = await self.fetcher.get_quote(pair)
                spot = q.mid
            except Exception:
                spot = 0

            # Forward premium/discount
            fwd_1y = self.calculate_forward(spot, base_rate, quote_rate, 365)

            # Simple annualized carry in pips
            pip_size = 0.0001 if quote_ccy != "JPY" else 0.01
            carry_pips = carry * spot / pip_size

            analysis.append({
                "pair": pair,
                "base_rate": round(base_rate * 100, 2),
                "quote_rate": round(quote_rate * 100, 2),
                "carry_annual_pct": round(carry * 100, 2),
                "carry_monthly_pct": round(carry_monthly * 100, 3),
                "carry_pips_annual": round(carry_pips, 1),
                "carry_direction": "long" if carry > 0 else "short",
                "spot": round(spot, 6),
                "forward_1y": round(fwd_1y.forward_rate, 6),
                "forward_points": fwd_1y.forward_points,
            })

        # Sort by absolute carry
        analysis.sort(key=lambda x: abs(x["carry_annual_pct"]), reverse=True)
        return analysis

    async def correlation_matrix(self, pairs: Optional[list[str]] = None,
                                   period: str = "3M") -> dict:
        """Calculate FX pair correlation matrix."""
        target_pairs = pairs or MAJOR_PAIRS
        all_data = {}

        for pair in target_pairs:
            hist = await self.fetcher.get_historical(pair, period)
            if hist:
                closes = [h["close"] for h in hist]
                returns = [(closes[i] / closes[i-1] - 1) for i in range(1, len(closes))]
                all_data[pair] = returns

        n = len(target_pairs)
        matrix = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 1.0
                elif target_pairs[i] in all_data and target_pairs[j] in all_data:
                    a = all_data[target_pairs[i]]
                    b = all_data[target_pairs[j]]
                    min_len = min(len(a), len(b))
                    if min_len > 10:
                        mean_a = sum(a[:min_len]) / min_len
                        mean_b = sum(b[:min_len]) / min_len
                        cov = sum((a[k] - mean_a) * (b[k] - mean_b) for k in range(min_len)) / (min_len - 1)
                        std_a = math.sqrt(sum((x - mean_a) ** 2 for x in a[:min_len]) / (min_len - 1))
                        std_b = math.sqrt(sum((x - mean_b) ** 2 for x in b[:min_len]) / (min_len - 1))
                        corr = cov / (std_a * std_b) if std_a > 0 and std_b > 0 else 0
                        matrix[i][j] = round(corr, 4)

        return {
            "pairs": target_pairs,
            "matrix": matrix,
            "period": period,
        }

    async def volatility_analysis(self, pair: str, periods: list[str] = None) -> dict:
        """Calculate historical and implied volatility for FX pair."""
        if periods is None:
            periods = ["1w", "1M", "3M", "6M", "1y"]

        period_results = []
        for period in periods:
            hist = await self.fetcher.get_historical(pair, period)
            if not hist:
                continue

            closes = [h["close"] for h in hist]
            returns = [(closes[i] / closes[i-1] - 1) for i in range(1, len(closes))]

            if not returns:
                continue

            daily_vol = math.sqrt(sum((r - sum(returns)/len(returns)) ** 2 for r in returns) / (len(returns) - 1))
            ann_vol = daily_vol * math.sqrt(252)

            # High-low range-based vol (Parkinson)
            highs = [h["high"] for h in hist]
            lows = [h["low"] for h in hist]
            parkinson_vol = 0
            if len(highs) > 1:
                hl_sq = [math.log(h / l) ** 2 for h, l in zip(highs, lows) if l > 0 and h > 0]
                if hl_sq:
                    parkinson_vol = math.sqrt(sum(hl_sq) / (4 * math.log(2) * len(hl_sq))) * math.sqrt(252)

            period_results.append({
                "period": period,
                "close_to_close_vol": round(ann_vol * 100, 2),
                "parkinson_vol": round(parkinson_vol * 100, 2),
                "daily_vol": round(daily_vol * 100, 4),
                "num_observations": len(returns),
            })

        return {
            "pair": pair,
            "volatility": period_results,
        }

    async def fx_heatmap(self) -> dict:
        """Generate FX performance heatmap (daily changes)."""
        currencies = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"]
        heatmap = {}

        for base in currencies:
            heatmap[base] = {}
            for quote in currencies:
                if base == quote:
                    heatmap[base][quote] = 0
                else:
                    try:
                        q = await self.fetcher.get_quote(f"{base}/{quote}")
                        heatmap[base][quote] = round(q.change_pct, 3)
                    except Exception:
                        heatmap[base][quote] = 0

        # Calculate currency strength
        strength = {}
        for ccy in currencies:
            changes = []
            for other in currencies:
                if ccy != other:
                    if ccy in heatmap and other in heatmap[ccy]:
                        changes.append(heatmap[ccy][other])
            strength[ccy] = round(sum(changes) / len(changes), 3) if changes else 0

        return {
            "heatmap": heatmap,
            "strength": dict(sorted(strength.items(), key=lambda x: -x[1])),
            "currencies": currencies,
            "strongest": max(strength, key=strength.get) if strength else "",
            "weakest": min(strength, key=strength.get) if strength else "",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# FX RISK MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class FXRiskManager:
    """FX exposure and hedging analysis."""

    def __init__(self, fetcher: FXDataFetcher):
        self.fetcher = fetcher

    def calculate_position_risk(self, pair: str, position_size: float,
                                 entry_price: float, current_price: float,
                                 leverage: float = 1.0) -> dict:
        """Calculate risk metrics for an FX position."""
        _, base, quote = self.fetcher._normalize_pair(pair)
        pip_size = 0.0001 if quote != "JPY" else 0.01

        # P&L
        pips_change = (current_price - entry_price) / pip_size
        pnl = (current_price - entry_price) * position_size
        pnl_pct = (current_price / entry_price - 1) * 100

        # Pip value
        pip_value = pip_size * position_size

        # Margin requirement
        margin_required = position_size * current_price / leverage

        # Risk-reward scenarios
        scenarios = []
        for move_pips in [-100, -50, -25, -10, 0, 10, 25, 50, 100]:
            scenario_price = current_price + move_pips * pip_size
            scenario_pnl = (scenario_price - entry_price) * position_size
            scenarios.append({
                "pips_move": move_pips,
                "price": round(scenario_price, 6),
                "pnl": round(scenario_pnl, 2),
            })

        return {
            "pair": pair,
            "position_size": position_size,
            "entry_price": entry_price,
            "current_price": current_price,
            "pips_change": round(pips_change, 1),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 3),
            "pip_value": round(pip_value, 4),
            "margin_required": round(margin_required, 2),
            "leverage": leverage,
            "scenarios": scenarios,
        }

    async def hedge_recommendation(self, exposures: list[dict]) -> dict:
        """Generate hedging recommendations for FX exposures."""
        recommendations = []
        total_exposure = 0
        total_hedged = 0

        for exp in exposures:
            currency = exp.get("currency", "EUR")
            amount = exp.get("amount", 0)
            direction = exp.get("direction", "long")  # long = need to sell, short = need to buy

            # Get forward curves
            pair = f"{currency}/USD" if currency != "USD" else "EUR/USD"
            _, base, quote = self.fetcher._normalize_pair(pair)

            try:
                q = await self.fetcher.get_quote(pair)
                spot = q.mid
            except Exception:
                spot = 1.0

            base_rate = INTEREST_RATES.get(base, 0.03)
            quote_rate = INTEREST_RATES.get(quote, 0.03)

            # Recommend hedge tenors
            hedge_options = []
            for tenor_days in [30, 90, 180, 365]:
                fwd = FXAnalytics(self.fetcher).calculate_forward(spot, base_rate, quote_rate, tenor_days)
                cost_pct = abs(fwd.forward_rate - spot) / spot * 100

                hedge_options.append({
                    "tenor": fwd.tenor,
                    "forward_rate": fwd.forward_rate,
                    "forward_points": fwd.forward_points,
                    "hedge_cost_pct": round(cost_pct, 3),
                    "hedged_amount": round(amount * fwd.forward_rate, 2),
                })

            recommendations.append({
                "currency": currency,
                "exposure": amount,
                "direction": direction,
                "spot_rate": round(spot, 6),
                "action": "sell_forward" if direction == "long" else "buy_forward",
                "hedge_options": hedge_options,
            })

            total_exposure += abs(amount)

        return {
            "total_exposure": round(total_exposure, 2),
            "recommendations": recommendations,
        }

    async def currency_converter(self, amount: float, from_ccy: str, to_ccy: str) -> dict:
        """Convert between currencies at live rates."""
        from_ccy = from_ccy.upper()
        to_ccy = to_ccy.upper()

        if from_ccy == to_ccy:
            return {"amount": amount, "from": from_ccy, "to": to_ccy, "converted": amount, "rate": 1.0}

        result = await FXAnalytics(self.fetcher).cross_rate(from_ccy, to_ccy)
        rate = result.get("rate", 1.0)
        converted = amount * rate

        return {
            "amount": amount,
            "from": from_ccy,
            "to": to_ccy,
            "converted": round(converted, 2),
            "rate": rate,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED FX SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class FXService:
    """Unified FX service entry point."""

    def __init__(self):
        self.fetcher = FXDataFetcher()
        self.analytics = FXAnalytics(self.fetcher)
        self.risk = FXRiskManager(self.fetcher)

    async def get_quote(self, pair: str) -> dict:
        q = await self.fetcher.get_quote(pair)
        return asdict(q)

    async def get_all_quotes(self, pairs: Optional[list[str]] = None) -> list[dict]:
        return await self.analytics.get_all_quotes(pairs)

    async def get_historical(self, pair: str, period: str = "1y") -> list[dict]:
        return await self.fetcher.get_historical(pair, period)

    async def get_cross_rates(self) -> dict:
        return await self.analytics.cross_rate_matrix()

    async def get_forward_curve(self, pair: str) -> list[dict]:
        return await self.analytics.forward_curve(pair)

    async def get_carry_trades(self) -> list[dict]:
        return await self.analytics.carry_trade_analysis()

    async def get_correlation(self, pairs: Optional[list[str]] = None) -> dict:
        return await self.analytics.correlation_matrix(pairs)

    async def get_volatility(self, pair: str) -> dict:
        return await self.analytics.volatility_analysis(pair)

    async def get_heatmap(self) -> dict:
        return await self.analytics.fx_heatmap()

    async def convert(self, amount: float, from_ccy: str, to_ccy: str) -> dict:
        return await self.risk.currency_converter(amount, from_ccy, to_ccy)


# ── Singleton ──
_fx_service: Optional[FXService] = None

def get_fx_service() -> FXService:
    global _fx_service
    if _fx_service is None:
        _fx_service = FXService()
    return _fx_service
