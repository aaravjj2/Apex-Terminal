"""
economic_calendar_routes.py — Economic Calendar REST API
=========================================================
Surprise analysis, event impact, earnings, seasonal patterns,
event management, volatility forecasting.

Endpoints:
    POST /api/v2/economic-calendar/surprise     → Surprise index
    POST /api/v2/economic-calendar/impact        → Event impact analysis
    POST /api/v2/economic-calendar/earnings       → Earnings analysis
    POST /api/v2/economic-calendar/seasonal       → Seasonal patterns
    POST /api/v2/economic-calendar/events         → Manage events
    POST /api/v2/economic-calendar/vol-forecast   → Volatility forecast
    GET  /api/v2/economic-calendar/capabilities   → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from phase1.services.economic_calendar_engine import EconomicCalendarEngine

router = APIRouter(prefix="/api/v2/economic-calendar", tags=["Economic Calendar"])

_engine = EconomicCalendarEngine()


class SurpriseEvent(BaseModel):
    date: str
    actual: float
    forecast: float
    previous: float
    importance: str = "high"

class SurpriseRequest(BaseModel):
    events: List[SurpriseEvent]

class ImpactRequest(BaseModel):
    event_dates: List[str]
    prices: List[float]
    price_dates: List[str]
    window: int = 5

class EarningsData(BaseModel):
    symbol: str
    date: str
    actual_eps: float
    estimate_eps: float
    revenue_actual: float = 0
    revenue_estimate: float = 0

class EarningsRequest(BaseModel):
    earnings: List[EarningsData]

class SeasonalRequest(BaseModel):
    values: List[float]
    dates: List[str]
    period: str = "monthly"

class EventEntry(BaseModel):
    name: str
    date: str
    country: str = "US"
    importance: str = "high"
    category: str = "economic"

class EventsRequest(BaseModel):
    events: List[EventEntry]
    filter_country: str = ""
    filter_importance: str = ""

class VolForecastRequest(BaseModel):
    event_importances: List[str]
    historical_vol: float
    lookback: int = 20


@router.post("/surprise")
def surprise(req: SurpriseRequest):
    events = [e.model_dump() for e in req.events]
    result = _engine.surprise_index(events)
    return {"ok": True, "surprise": result}


@router.post("/impact")
def impact(req: ImpactRequest):
    result = _engine.event_impact(req.event_dates, req.prices, req.price_dates, req.window)
    return {"ok": True, "impact": result}


@router.post("/earnings")
def earnings(req: EarningsRequest):
    data = [e.model_dump() for e in req.earnings]
    result = _engine.earnings_analysis(data)
    return {"ok": True, "earnings": result}


@router.post("/seasonal")
def seasonal(req: SeasonalRequest):
    result = _engine.seasonal_patterns(req.values, req.dates, req.period)
    return {"ok": True, "seasonal": result}


@router.post("/events")
def events(req: EventsRequest):
    data = [e.model_dump() for e in req.events]
    result = _engine.manage_events(data, req.filter_country, req.filter_importance)
    return {"ok": True, "events": result}


@router.post("/vol-forecast")
def vol_forecast(req: VolForecastRequest):
    result = _engine.vol_forecast(req.event_importances, req.historical_vol, req.lookback)
    return {"ok": True, "forecast": result}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
