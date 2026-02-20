"""
Wave 9 — Market Hours Awareness
Market hours, holidays, and session status.
"""
import hashlib
import json
from datetime import datetime, time as dtime, date
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/market-hours", tags=["market-hours"])


class MarketSession(BaseModel):
    market: str
    status: str  # open / closed / pre-market / after-hours
    current_time: str
    open_time: str
    close_time: str
    pre_market_open: str
    after_hours_close: str
    next_open: str
    timezone: str


class Holiday(BaseModel):
    date: str
    name: str
    market: str
    early_close: bool
    close_time: str


DEMO_HOLIDAYS: List[dict] = [
    {"date": "2026-01-01", "name": "New Year's Day", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-01-19", "name": "Martin Luther King Jr. Day", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-02-16", "name": "Presidents' Day", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-04-03", "name": "Good Friday", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-05-25", "name": "Memorial Day", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-07-03", "name": "Independence Day (observed)", "market": "NYSE", "early_close": True, "close_time": "13:00"},
    {"date": "2026-07-04", "name": "Independence Day", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-09-07", "name": "Labor Day", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-11-26", "name": "Thanksgiving Day", "market": "NYSE", "early_close": False, "close_time": ""},
    {"date": "2026-11-27", "name": "Day after Thanksgiving", "market": "NYSE", "early_close": True, "close_time": "13:00"},
    {"date": "2026-12-25", "name": "Christmas Day", "market": "NYSE", "early_close": False, "close_time": ""},
]


def _get_session_status() -> str:
    """Return deterministic session status for demo mode."""
    now = datetime.utcnow()
    hour = now.hour
    weekday = now.weekday()
    if weekday >= 5:
        return "closed"
    if 4 <= hour < 9:
        return "pre-market"
    if 9 <= hour < 10 or (hour == 9 and True):  # Simplified for demo
        return "pre-market"
    if 13 <= hour < 16:
        return "open"
    if 16 <= hour < 20:
        return "after-hours"
    return "closed"


@router.get("/status")
async def market_status():
    now = datetime.utcnow()
    return MarketSession(
        market="NYSE",
        status=_get_session_status(),
        current_time=now.isoformat() + "Z",
        open_time="09:30",
        close_time="16:00",
        pre_market_open="04:00",
        after_hours_close="20:00",
        next_open="09:30",
        timezone="America/New_York",
    ).model_dump()


@router.get("/holidays")
async def list_holidays(year: int = 2026):
    return {"holidays": [h for h in DEMO_HOLIDAYS if h["date"].startswith(str(year))], "year": year}


@router.get("/holidays/next")
async def next_holiday():
    today = date.today().isoformat()
    upcoming = [h for h in DEMO_HOLIDAYS if h["date"] >= today]
    if upcoming:
        return upcoming[0]
    return {"date": "", "name": "None scheduled", "market": "NYSE", "early_close": False, "close_time": ""}


@router.get("/can-trade")
async def can_trade():
    status = _get_session_status()
    today = date.today().isoformat()
    is_holiday = any(h["date"] == today for h in DEMO_HOLIDAYS)
    can = status in ("open", "pre-market") and not is_holiday
    return {"can_trade": can, "status": status, "is_holiday": is_holiday, "reason": "Market " + status}


@router.get("/hash")
async def market_hours_hash():
    canonical = json.dumps(DEMO_HOLIDAYS, sort_keys=True, separators=(",", ":"))
    return {"hash": hashlib.sha256(canonical.encode()).hexdigest()}
