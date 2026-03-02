"""
heatmap_compat.py — Heatmap + Fixed-Income compat routes for UI2 pages
======================================================================
GET /api/v1/market-data/heatmap      → Sector heatmap data (stocks + changes)
GET /api/v1/fixed-income/yield-curve → US Treasury yield curve
"""
from __future__ import annotations
import random
from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(tags=["UI2 Compat"])

# ── Heatmap mock data ─────────────────────────────────────────────────────

SECTORS = [
    "Technology", "Healthcare", "Financials", "Consumer Discretionary",
    "Communication", "Industrials", "Consumer Staples", "Energy",
    "Utilities", "Real Estate", "Materials",
]

MOCK_STOCKS = [
    {"symbol": "AAPL", "sector": "Technology", "marketCap": 2.95e12, "change": 1.39},
    {"symbol": "MSFT", "sector": "Technology", "marketCap": 2.80e12, "change": 1.08},
    {"symbol": "NVDA", "sector": "Technology", "marketCap": 1.20e12, "change": 3.17},
    {"symbol": "GOOGL", "sector": "Technology", "marketCap": 1.75e12, "change": -0.36},
    {"symbol": "META", "sector": "Technology", "marketCap": 0.95e12, "change": 1.63},
    {"symbol": "AVGO", "sector": "Technology", "marketCap": 0.55e12, "change": 0.87},
    {"symbol": "ORCL", "sector": "Technology", "marketCap": 0.35e12, "change": -0.22},
    {"symbol": "AMD", "sector": "Technology", "marketCap": 0.28e12, "change": 2.41},
    {"symbol": "AMZN", "sector": "Consumer Discretionary", "marketCap": 1.55e12, "change": 0.99},
    {"symbol": "TSLA", "sector": "Consumer Discretionary", "marketCap": 0.78e12, "change": -1.24},
    {"symbol": "HD", "sector": "Consumer Discretionary", "marketCap": 0.38e12, "change": 0.45},
    {"symbol": "NKE", "sector": "Consumer Discretionary", "marketCap": 0.18e12, "change": -0.67},
    {"symbol": "JPM", "sector": "Financials", "marketCap": 0.52e12, "change": 0.73},
    {"symbol": "V", "sector": "Financials", "marketCap": 0.50e12, "change": 0.35},
    {"symbol": "MA", "sector": "Financials", "marketCap": 0.42e12, "change": 0.52},
    {"symbol": "BAC", "sector": "Financials", "marketCap": 0.30e12, "change": 1.01},
    {"symbol": "BRK.B", "sector": "Financials", "marketCap": 0.78e12, "change": 0.37},
    {"symbol": "UNH", "sector": "Healthcare", "marketCap": 0.48e12, "change": -0.55},
    {"symbol": "JNJ", "sector": "Healthcare", "marketCap": 0.42e12, "change": 0.28},
    {"symbol": "LLY", "sector": "Healthcare", "marketCap": 0.58e12, "change": 1.89},
    {"symbol": "PFE", "sector": "Healthcare", "marketCap": 0.16e12, "change": -0.91},
    {"symbol": "ABBV", "sector": "Healthcare", "marketCap": 0.30e12, "change": 0.44},
    {"symbol": "XOM", "sector": "Energy", "marketCap": 0.44e12, "change": -0.62},
    {"symbol": "CVX", "sector": "Energy", "marketCap": 0.32e12, "change": -0.38},
    {"symbol": "COP", "sector": "Energy", "marketCap": 0.14e12, "change": -0.85},
    {"symbol": "DIS", "sector": "Communication", "marketCap": 0.22e12, "change": 0.33},
    {"symbol": "NFLX", "sector": "Communication", "marketCap": 0.25e12, "change": 1.15},
    {"symbol": "CMCSA", "sector": "Communication", "marketCap": 0.17e12, "change": 0.19},
    {"symbol": "PG", "sector": "Consumer Staples", "marketCap": 0.36e12, "change": 0.21},
    {"symbol": "KO", "sector": "Consumer Staples", "marketCap": 0.27e12, "change": 0.15},
    {"symbol": "PEP", "sector": "Consumer Staples", "marketCap": 0.24e12, "change": -0.11},
    {"symbol": "CAT", "sector": "Industrials", "marketCap": 0.18e12, "change": 0.83},
    {"symbol": "GE", "sector": "Industrials", "marketCap": 0.17e12, "change": 0.64},
    {"symbol": "HON", "sector": "Industrials", "marketCap": 0.14e12, "change": 0.27},
    {"symbol": "NEE", "sector": "Utilities", "marketCap": 0.15e12, "change": 0.02},
    {"symbol": "DUK", "sector": "Utilities", "marketCap": 0.08e12, "change": -0.14},
    {"symbol": "AMT", "sector": "Real Estate", "marketCap": 0.10e12, "change": 0.19},
    {"symbol": "PLD", "sector": "Real Estate", "marketCap": 0.12e12, "change": 0.29},
    {"symbol": "LIN", "sector": "Materials", "marketCap": 0.20e12, "change": 0.49},
    {"symbol": "APD", "sector": "Materials", "marketCap": 0.06e12, "change": 0.29},
]

PERIOD_MULT = {"1D": 1, "1W": 1.5, "1M": 2, "3M": 3, "6M": 4, "YTD": 3.5, "1Y": 5}


@router.get("/api/v1/market-data/heatmap")
async def get_heatmap(
    period: str = Query("1D"),
    tab: str = Query("SECTOR MAP"),
):
    """Return jittered heatmap stock data."""
    mult = PERIOD_MULT.get(period, 1)
    stocks = []
    for s in MOCK_STOCKS:
        jitter = (random.random() - 0.5) * 0.6 * mult
        stocks.append({
            **s,
            "change": round(s["change"] * mult + jitter, 2),
        })

    advancers = sum(1 for s in stocks if s["change"] > 0)
    decliners = sum(1 for s in stocks if s["change"] < 0)
    unchanged = sum(1 for s in stocks if s["change"] == 0)

    return {
        "stocks": stocks,
        "summary": {
            "advancers": advancers,
            "decliners": decliners,
            "unchanged": unchanged,
            "total": len(stocks),
        },
        "period": period,
        "tab": tab,
    }


# ── Fixed income yield curve ──────────────────────────────────────────────

YIELD_CURVE = [
    {"tenor": "1M",  "yield_pct": 5.33, "change_bp": -1},
    {"tenor": "3M",  "yield_pct": 5.37, "change_bp": 0},
    {"tenor": "6M",  "yield_pct": 5.36, "change_bp": -2},
    {"tenor": "1Y",  "yield_pct": 5.12, "change_bp": -3},
    {"tenor": "2Y",  "yield_pct": 4.71, "change_bp": -5},
    {"tenor": "3Y",  "yield_pct": 4.42, "change_bp": -4},
    {"tenor": "5Y",  "yield_pct": 4.27, "change_bp": -3},
    {"tenor": "7Y",  "yield_pct": 4.30, "change_bp": -2},
    {"tenor": "10Y", "yield_pct": 4.35, "change_bp": -1},
    {"tenor": "20Y", "yield_pct": 4.62, "change_bp": 0},
    {"tenor": "30Y", "yield_pct": 4.51, "change_bp": 1},
]


@router.get("/api/v1/fixed-income/yield-curve")
async def get_yield_curve():
    """Return US Treasury yield curve data with slight jitter."""
    curve = []
    for pt in YIELD_CURVE:
        jitter = (random.random() - 0.5) * 0.04
        curve.append({
            "tenor": pt["tenor"],
            "yield": round(pt["yield_pct"] + jitter, 3),
            "change_bp": pt["change_bp"] + random.randint(-1, 1),
        })
    return {"curve": curve, "date": "2024-01-15", "source": "mock"}
