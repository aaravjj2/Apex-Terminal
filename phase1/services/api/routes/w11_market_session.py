"""
Waves 11-20 — Market Session API Routes
Market session engine, session status, holidays, trading calendar.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
import logging

from ...waves11_20.market_session import get_market_session_engine, SessionType

router = APIRouter(prefix="/api/v2/market-session", tags=["market-session-v2"])
logger = logging.getLogger(__name__)


class SessionResponse(BaseModel):
    session_type: str
    is_trading: bool
    market_open: str
    market_close: str
    pre_market_open: str
    after_hours_close: str
    next_open: Optional[str] = None
    next_close: Optional[str] = None
    timezone: str = "America/New_York"


class HolidayResponse(BaseModel):
    date: str
    name: str
    early_close: bool


class CalendarDayResponse(BaseModel):
    date: str
    is_trading_day: bool
    session_type: str
    early_close: bool


@router.get("/status", response_model=SessionResponse)
async def get_session_status():
    """Get current market session status."""
    engine = get_market_session_engine()
    state = engine.get_current_session()
    return SessionResponse(
        session_type=state.session_type.value,
        is_trading=state.is_trading,
        market_open=state.market_open.isoformat() if state.market_open else "",
        market_close=state.market_close.isoformat() if state.market_close else "",
        pre_market_open=state.pre_market_open.isoformat() if state.pre_market_open else "",
        after_hours_close=state.after_hours_close.isoformat() if state.after_hours_close else "",
        next_open=state.next_open.isoformat() if state.next_open else None,
        next_close=state.next_close.isoformat() if state.next_close else None,
    )


@router.get("/holidays")
async def get_holidays(year: int = Query(default=2025)):
    """Get NYSE holidays for a given year."""
    engine = get_market_session_engine()
    holidays = engine.get_holidays(year)
    return {"year": year, "holidays": [h.to_dict() for h in holidays]}


@router.get("/is-open")
async def is_market_open():
    """Quick check if market is currently open."""
    engine = get_market_session_engine()
    state = engine.get_current_session()
    return {
        "is_open": state.session_type == SessionType.MARKET_OPEN,
        "session_type": state.session_type.value,
        "is_trading": state.is_trading,
    }


@router.get("/trading-days")
async def get_trading_days(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Count trading days between two dates."""
    engine = get_market_session_engine()
    start_dt = date.fromisoformat(start)
    end_dt = date.fromisoformat(end)
    count = engine.trading_days_between(start_dt, end_dt)
    return {"start": start, "end": end, "trading_days": count}


@router.get("/next-open")
async def get_next_open():
    """Get the next market open time."""
    engine = get_market_session_engine()
    state = engine.get_current_session()
    return {
        "next_open": state.next_open.isoformat() if state.next_open else None,
        "current_session": state.session_type.value,
    }
