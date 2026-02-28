"""
FastAPI routes for SeasonalityEngine — calendar effects, day-of-week, month seasonality.
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.seasonality_engine import (
    SeasonalityEngine,
    DailyBar,
    CalendarEffect,
)

router = APIRouter(prefix="/api/seasonality", tags=["Seasonality"])
_engine = SeasonalityEngine()


# ─── Request / Response Models ────────────────────────────────────────────────

class DailyBarInput(BaseModel):
    date_str: str = Field(..., description="Date string YYYY-MM-DD")
    open: float = Field(..., description="Open price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    close: float = Field(..., description="Close price")
    volume: float = Field(0.0, description="Trading volume")


class BarsRequest(BaseModel):
    bars: List[DailyBarInput] = Field(..., min_items=10, description="OHLCV daily bars")
    symbol: Optional[str] = Field(None, description="Instrument symbol for labeling")


class CalendarAnalysisRequest(BaseModel):
    bars: List[DailyBarInput] = Field(..., min_items=50, description="Daily bars (1+ year preferred)")
    symbol: Optional[str] = Field(None)
    effects: Optional[List[str]] = Field(
        None,
        description="Calendar effects to analyze. Null = all. Options: "
                    "day_of_week|month_of_year|turn_of_month|santa_claus|triple_witching|holiday_effect"
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_bars(bars: List[DailyBarInput]) -> List[DailyBar]:
    result = []
    for b in bars:
        result.append(DailyBar(
            date_str=b.date_str,
            open=b.open,
            high=b.high,
            low=b.low,
            close=b.close,
            volume=b.volume,
        ))
    return result


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/capabilities")
def get_capabilities():
    """Return engine capabilities and supported calendar effects."""
    return _engine.capabilities()


@router.post("/day-of-week")
def day_of_week_effect(body: BarsRequest):
    """Analyze statistical day-of-week return patterns."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.day_of_week(bars)
        if not result:
            raise HTTPException(status_code=422, detail="Insufficient data for day-of-week analysis")
        return {"symbol": body.symbol, "effect": CalendarEffect.DAY_OF_WEEK.value, "analysis": result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/month-of-year")
def month_of_year_effect(body: BarsRequest):
    """Analyze statistical month-of-year return seasonality."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.month_of_year(bars)
        return {"symbol": body.symbol, "effect": CalendarEffect.MONTH_OF_YEAR.value, "analysis": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/january-effect")
def january_effect(body: BarsRequest):
    """Test for the January Effect (January premium over other months)."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.january_effect(bars)
        return {"symbol": body.symbol, "effect": CalendarEffect.JANUARY_EFFECT.value, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sell-in-may")
def sell_in_may(body: BarsRequest):
    """Test the 'Sell in May and Go Away' seasonal strategy."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.sell_in_may(bars)
        return {"symbol": body.symbol, "strategy": "sell_in_may", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/turn-of-month")
def turn_of_month_effect(body: BarsRequest):
    """Analyze the turn-of-month seasonal pattern (first/last 3 trading days)."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.turn_of_month(bars)
        return {"symbol": body.symbol, "effect": CalendarEffect.TURN_OF_MONTH.value, "analysis": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/santa-claus-rally")
def santa_claus_rally(body: BarsRequest):
    """Analyze the Santa Claus Rally period (Dec 26 – Jan 5)."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.santa_claus(bars)
        return {"symbol": body.symbol, "effect": CalendarEffect.SANTA_CLAUS.value, "analysis": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/triple-witching")
def triple_witching(body: BarsRequest):
    """Analyze return patterns around quarterly triple-witching expiration days."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.triple_witching(bars)
        return {"symbol": body.symbol, "effect": CalendarEffect.TRIPLE_WITCHING.value, "analysis": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/heatmap")
def seasonality_heatmap(body: BarsRequest):
    """Build a Year × Month return heatmap for the instrument."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.heatmap(bars)
        return {"symbol": body.symbol, "heatmap": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/full-analysis")
def full_calendar_analysis(body: CalendarAnalysisRequest):
    """Run a comprehensive calendar effects analysis across all supported effects."""
    try:
        bars = _parse_bars(body.bars)
        result = _engine.full_calendar_analysis(bars)
        if body.effects:
            filtered = {k: v for k, v in result.items() if k in body.effects or k == "metadata"}
            return {"symbol": body.symbol, "effects_requested": body.effects, **filtered}
        return {"symbol": body.symbol, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
