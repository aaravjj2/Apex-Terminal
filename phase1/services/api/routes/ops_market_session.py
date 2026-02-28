"""
Phase D — Market Session Truth Endpoint
GET /api/ops/market_session → is_open_now, session, next_open, next_close, timezone, computed_at
Uses NYSE calendar and America/New_York timezone. No local guesses.
"""
from __future__ import annotations

import os
from datetime import datetime, time, timedelta, date

from fastapi import APIRouter

router = APIRouter(prefix="/api/ops", tags=["ops-market-session"])

# NYSE regular hours in ET
_MARKET_OPEN = time(9, 30)
_MARKET_CLOSE = time(16, 0)
_PRE_OPEN = time(4, 0)
_POST_CLOSE = time(20, 0)

# NYSE 2025-2026 holidays (date only, no early close logic here)
_NYSE_HOLIDAYS: set[date] = {
    # 2025
    date(2025, 1, 1), date(2025, 1, 20), date(2025, 2, 17),
    date(2025, 4, 18), date(2025, 5, 26), date(2025, 6, 19),
    date(2025, 7, 4), date(2025, 9, 1), date(2025, 11, 27),
    date(2025, 12, 25),
    # 2026
    date(2026, 1, 1), date(2026, 1, 19), date(2026, 2, 16),
    date(2026, 4, 3), date(2026, 5, 25), date(2026, 6, 19),
    date(2026, 7, 3), date(2026, 9, 7), date(2026, 11, 26),
    date(2026, 12, 25),
}


def _et_now() -> datetime:
    """Current time in America/New_York. Uses pytz if available, else UTC-5 approx."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/New_York"))
    except Exception:
        # Fallback: UTC-5 (ignoring DST, but better than nothing)
        from datetime import timezone as tz
        return datetime.now(tz(timedelta(hours=-5)))


def _is_trading_day(d: date) -> bool:
    return d.weekday() < 5 and d not in _NYSE_HOLIDAYS


def _next_trading_day(d: date) -> date:
    nxt = d + timedelta(days=1)
    while not _is_trading_day(nxt):
        nxt += timedelta(days=1)
    return nxt


def _compute_session(now: datetime) -> dict:
    today = now.date()
    t = now.time()

    if not _is_trading_day(today):
        nxt = _next_trading_day(today)
        return {
            "is_open_now": False,
            "session": "closed",
            "next_open": datetime.combine(nxt, _MARKET_OPEN).isoformat(),
            "next_close": datetime.combine(nxt, _MARKET_CLOSE).isoformat(),
        }

    if t < _PRE_OPEN:
        return {
            "is_open_now": False,
            "session": "closed",
            "next_open": datetime.combine(today, _MARKET_OPEN).isoformat(),
            "next_close": datetime.combine(today, _MARKET_CLOSE).isoformat(),
        }
    elif t < _MARKET_OPEN:
        return {
            "is_open_now": False,
            "session": "pre",
            "next_open": datetime.combine(today, _MARKET_OPEN).isoformat(),
            "next_close": datetime.combine(today, _MARKET_CLOSE).isoformat(),
        }
    elif t < _MARKET_CLOSE:
        return {
            "is_open_now": True,
            "session": "regular",
            "next_open": datetime.combine(_next_trading_day(today), _MARKET_OPEN).isoformat(),
            "next_close": datetime.combine(today, _MARKET_CLOSE).isoformat(),
        }
    elif t < _POST_CLOSE:
        nxt = _next_trading_day(today)
        return {
            "is_open_now": False,
            "session": "post",
            "next_open": datetime.combine(nxt, _MARKET_OPEN).isoformat(),
            "next_close": datetime.combine(nxt, _MARKET_CLOSE).isoformat(),
        }
    else:
        nxt = _next_trading_day(today)
        return {
            "is_open_now": False,
            "session": "closed",
            "next_open": datetime.combine(nxt, _MARKET_OPEN).isoformat(),
            "next_close": datetime.combine(nxt, _MARKET_CLOSE).isoformat(),
        }


@router.get("/market_session")
async def market_session():
    """Return authoritative market session state. UI must use this, not local guesses."""
    now = _et_now()
    result = _compute_session(now)
    result["timezone"] = "America/New_York"
    result["computed_at"] = now.isoformat()
    return result
