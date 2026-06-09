"""Live market data for Research Agent Node 2 — spot, chain, realized vol, rates."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

logger = logging.getLogger(__name__)

OptionRight = Literal["Call", "Put"]


@dataclass
class OptionQuote:
    bid: float | None
    ask: float | None
    mid: float
    last: float | None
    volume: int | None
    open_interest: int | None
    implied_volatility: float | None
    strike: float
    expiration: date
    source: str


@dataclass
class MarketContext:
    spot: float
    spot_source: str
    risk_free_rate: float
    rate_source: str
    realized_vol_history: list[float]
    vol_source: str


def _yf_ticker(symbol: str):
    import yfinance as yf

    return yf.Ticker(symbol.upper())


def fetch_spot_price(underlying: str) -> tuple[float, str]:
    try:
        info = _yf_ticker(underlying).fast_info
        for attr in ("last_price", "regular_market_price", "previous_close"):
            val = getattr(info, attr, None)
            if val and float(val) > 0:
                return round(float(val), 4), f"yfinance:{attr}"
    except Exception as exc:
        logger.debug("spot fetch failed for %s: %s", underlying, exc)
    return 100.0, "fallback_default"


def fetch_risk_free_rate() -> tuple[float, str]:
    try:
        info = _yf_ticker("^TNX").fast_info
        yield_pct = getattr(info, "last_price", None) or getattr(info, "previous_close", None)
        if yield_pct and float(yield_pct) > 0:
            return round(float(yield_pct) / 100.0, 6), "yfinance:^TNX"
    except Exception as exc:
        logger.debug("rate fetch failed: %s", exc)
    return 0.045, "fallback_constant"


def _parse_chain_date(raw: str) -> date:
    return datetime.strptime(raw, "%Y-%m-%d").date()


def _nearest_expiry(available: tuple[str, ...], target: date) -> str | None:
    if not available:
        return None
    parsed = [(e, _parse_chain_date(e)) for e in available]
    future = [(e, d) for e, d in parsed if d >= target]
    pool = future if future else parsed
    return min(pool, key=lambda x: abs((x[1] - target).days))[0]


def fetch_option_quote(
    underlying: str,
    expiration: date,
    strike: float,
    option_type: OptionRight,
) -> OptionQuote | None:
    """Resolve bid/ask/mid from yfinance option chain (nearest expiry + strike)."""
    try:
        ticker = _yf_ticker(underlying)
        expirations = getattr(ticker, "options", None) or ()
        exp_str = _nearest_expiry(expirations, expiration)
        if not exp_str:
            return None

        chain = ticker.option_chain(exp_str)
        frame = chain.calls if option_type == "Call" else chain.puts
        if frame is None or frame.empty:
            return None

        frame = frame.copy()
        frame["strike_dist"] = (frame["strike"] - strike).abs()
        row = frame.sort_values("strike_dist").iloc[0]

        bid = float(row["bid"]) if row.get("bid", 0) and row["bid"] > 0 else None
        ask = float(row["ask"]) if row.get("ask", 0) and row["ask"] > 0 else None
        last = float(row["lastPrice"]) if row.get("lastPrice", 0) and row["lastPrice"] > 0 else None

        if bid is not None and ask is not None:
            mid = (bid + ask) / 2.0
        elif last is not None:
            mid = last
        else:
            return None

        iv_col = row.get("impliedVolatility")
        chain_iv = float(iv_col) if iv_col and float(iv_col) > 0 else None

        return OptionQuote(
            bid=bid,
            ask=ask,
            mid=round(mid, 4),
            last=last,
            volume=int(row["volume"]) if row.get("volume") and not math.isnan(row["volume"]) else None,
            open_interest=int(row["openInterest"]) if row.get("openInterest") and not math.isnan(row["openInterest"]) else None,
            implied_volatility=chain_iv,
            strike=float(row["strike"]),
            expiration=_parse_chain_date(exp_str),
            source=f"yfinance:chain:{exp_str}",
        )
    except Exception as exc:
        logger.debug("option quote failed for %s: %s", underlying, exc)
        return None


def fetch_realized_vol_history(underlying: str, *, window: int = 21, lookback_days: int = 252) -> tuple[list[float], str]:
    """Rolling realized vol series (annualized) for IV percentile baseline."""
    try:
        import pandas as pd

        hist = _yf_ticker(underlying).history(period="2y", interval="1d")
        if hist is None or hist.empty or "Close" not in hist.columns:
            return [], "unavailable"

        closes = hist["Close"].dropna()
        if len(closes) < window + 5:
            return [], "insufficient_bars"

        returns = closes.pct_change().dropna()
        rolling = returns.rolling(window).std() * math.sqrt(252)
        series = rolling.dropna().tail(lookback_days).tolist()
        vals = [round(float(v), 6) for v in series if v and not math.isnan(v) and v > 0]
        return vals, f"yfinance:realized_{window}d"
    except Exception as exc:
        logger.debug("realized vol failed for %s: %s", underlying, exc)
        return [], "unavailable"


def build_market_context(underlying: str) -> MarketContext:
    spot, spot_src = fetch_spot_price(underlying)
    rate, rate_src = fetch_risk_free_rate()
    vols, vol_src = fetch_realized_vol_history(underlying)
    return MarketContext(
        spot=spot,
        spot_source=spot_src,
        risk_free_rate=rate,
        rate_source=rate_src,
        realized_vol_history=vols,
        vol_source=vol_src,
    )
