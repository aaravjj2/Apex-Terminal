"""
Market Session Engine — Wave 11 Foundation
NYSE market session classification: pre-market, market, after-hours, closed, weekend, holiday.
Enforces no-trade during closed sessions, triggers research pipeline on weekends.
"""

from datetime import datetime, date, time, timedelta
from enum import Enum
from typing import Optional
from zoneinfo import ZoneInfo
from dataclasses import dataclass

ET = ZoneInfo("America/New_York")

class SessionType(str, Enum):
    PRE_MARKET = "pre_market"
    MARKET_OPEN = "market_open"
    AFTER_HOURS = "after_hours"
    CLOSED = "closed"
    WEEKEND = "weekend"
    HOLIDAY = "holiday"

@dataclass
class SessionState:
    session: SessionType
    is_trading_allowed: bool
    is_research_window: bool
    next_open: Optional[datetime]
    next_close: Optional[datetime]
    description: str
    timestamp: datetime

    def to_dict(self) -> dict:
        return {
            "session": self.session.value,
            "is_trading_allowed": self.is_trading_allowed,
            "is_research_window": self.is_research_window,
            "next_open": self.next_open.isoformat() if self.next_open else None,
            "next_close": self.next_close.isoformat() if self.next_close else None,
            "description": self.description,
            "timestamp": self.timestamp.isoformat(),
        }

# NYSE market times
MARKET_OPEN_TIME = time(9, 30)
MARKET_CLOSE_TIME = time(16, 0)
PRE_MARKET_START = time(4, 0)
AFTER_HOURS_END = time(20, 0)
EARLY_CLOSE_TIME = time(13, 0)

# NYSE holidays 2019-2027 for 7-year backtesting support
NYSE_HOLIDAYS: set[date] = set()
_HOLIDAY_DATES = [
    # 2019
    (2019,1,1),(2019,1,21),(2019,2,18),(2019,4,19),(2019,5,27),(2019,7,4),(2019,9,2),(2019,11,28),(2019,12,25),
    # 2020
    (2020,1,1),(2020,1,20),(2020,2,17),(2020,4,10),(2020,5,25),(2020,7,3),(2020,9,7),(2020,11,26),(2020,12,25),
    # 2021
    (2021,1,1),(2021,1,18),(2021,2,15),(2021,4,2),(2021,5,31),(2021,6,18),(2021,7,5),(2021,9,6),(2021,11,25),(2021,12,24),
    # 2022
    (2022,1,17),(2022,2,21),(2022,4,15),(2022,5,30),(2022,6,20),(2022,7,4),(2022,9,5),(2022,11,24),(2022,12,26),
    # 2023
    (2023,1,2),(2023,1,16),(2023,2,20),(2023,4,7),(2023,5,29),(2023,6,19),(2023,7,4),(2023,9,4),(2023,11,23),(2023,12,25),
    # 2024
    (2024,1,1),(2024,1,15),(2024,2,19),(2024,3,29),(2024,5,27),(2024,6,19),(2024,7,4),(2024,9,2),(2024,11,28),(2024,12,25),
    # 2025
    (2025,1,1),(2025,1,20),(2025,2,17),(2025,4,18),(2025,5,26),(2025,6,19),(2025,7,4),(2025,9,1),(2025,11,27),(2025,12,25),
    # 2026
    (2026,1,1),(2026,1,19),(2026,2,16),(2026,4,3),(2026,5,25),(2026,6,19),(2026,7,3),(2026,9,7),(2026,11,26),(2026,12,25),
    # 2027
    (2027,1,1),(2027,1,18),(2027,2,15),(2027,3,26),(2027,5,31),(2027,6,18),(2027,7,5),(2027,9,6),(2027,11,25),(2027,12,24),
]
for y, m, d in _HOLIDAY_DATES:
    NYSE_HOLIDAYS.add(date(y, m, d))

NYSE_EARLY_CLOSE: set[date] = set()
_EARLY_CLOSE_DATES = [
    (2024,7,3),(2024,11,29),(2024,12,24),
    (2025,7,3),(2025,11,28),(2025,12,24),
    (2026,7,2),(2026,11,27),(2026,12,24),
]
for y, m, d in _EARLY_CLOSE_DATES:
    NYSE_EARLY_CLOSE.add(date(y, m, d))


class MarketSessionEngine:
    """Full market session classifier with trading/research rules."""

    def __init__(self):
        self._tz = ET

    def now_et(self) -> datetime:
        return datetime.now(self._tz)

    def is_holiday(self, d: Optional[date] = None) -> bool:
        d = d or self.now_et().date()
        return d in NYSE_HOLIDAYS

    def is_weekend(self, d: Optional[date] = None) -> bool:
        d = d or self.now_et().date()
        return d.weekday() >= 5

    def is_trading_day(self, d: Optional[date] = None) -> bool:
        d = d or self.now_et().date()
        return not self.is_weekend(d) and not self.is_holiday(d)

    def get_close_time(self, d: Optional[date] = None) -> time:
        d = d or self.now_et().date()
        return EARLY_CLOSE_TIME if d in NYSE_EARLY_CLOSE else MARKET_CLOSE_TIME

    def classify_session(self, dt: Optional[datetime] = None) -> SessionType:
        """Classify the current market session."""
        dt = dt or self.now_et()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=self._tz)
        else:
            dt = dt.astimezone(self._tz)

        d = dt.date()
        t = dt.time()

        if self.is_weekend(d):
            return SessionType.WEEKEND
        if self.is_holiday(d):
            return SessionType.HOLIDAY
        if t < PRE_MARKET_START:
            return SessionType.CLOSED
        if t < MARKET_OPEN_TIME:
            return SessionType.PRE_MARKET
        close = self.get_close_time(d)
        if t < close:
            return SessionType.MARKET_OPEN
        if t < AFTER_HOURS_END:
            return SessionType.AFTER_HOURS
        return SessionType.CLOSED

    def get_next_open(self, dt: Optional[datetime] = None) -> datetime:
        """Get next market open datetime."""
        dt = dt or self.now_et()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=self._tz)

        d = dt.date()
        # If before today's open and today is a trading day
        if self.is_trading_day(d) and dt.time() < MARKET_OPEN_TIME:
            return datetime.combine(d, MARKET_OPEN_TIME, tzinfo=self._tz)

        # Find next trading day
        check = d + timedelta(days=1)
        for _ in range(10):
            if self.is_trading_day(check):
                return datetime.combine(check, MARKET_OPEN_TIME, tzinfo=self._tz)
            check += timedelta(days=1)
        return datetime.combine(check, MARKET_OPEN_TIME, tzinfo=self._tz)

    def get_next_close(self, dt: Optional[datetime] = None) -> Optional[datetime]:
        """Get next market close datetime."""
        dt = dt or self.now_et()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=self._tz)

        d = dt.date()
        if self.is_trading_day(d):
            close = self.get_close_time(d)
            if dt.time() < close:
                return datetime.combine(d, close, tzinfo=self._tz)

        # Next trading day's close
        next_open = self.get_next_open(dt)
        nd = next_open.date()
        return datetime.combine(nd, self.get_close_time(nd), tzinfo=self._tz)

    def get_state(self, dt: Optional[datetime] = None) -> SessionState:
        """Get full session state."""
        dt = dt or self.now_et()
        session = self.classify_session(dt)

        is_trading = session == SessionType.MARKET_OPEN
        is_research = session in (SessionType.WEEKEND, SessionType.HOLIDAY, SessionType.CLOSED, SessionType.AFTER_HOURS)

        descriptions = {
            SessionType.PRE_MARKET: "Pre-market session (4:00-9:30 ET). Research and preparation.",
            SessionType.MARKET_OPEN: "Market is OPEN. Trading allowed.",
            SessionType.AFTER_HOURS: "After-hours session (16:00-20:00 ET). Research only.",
            SessionType.CLOSED: "Market is CLOSED.",
            SessionType.WEEKEND: "Weekend. Research and strategy discovery pipeline active.",
            SessionType.HOLIDAY: "NYSE Holiday. Market closed.",
        }

        return SessionState(
            session=session,
            is_trading_allowed=is_trading,
            is_research_window=is_research,
            next_open=self.get_next_open(dt),
            next_close=self.get_next_close(dt) if is_trading else None,
            description=descriptions.get(session, "Unknown session"),
            timestamp=dt,
        )

    def trading_days_between(self, start: date, end: date) -> list[date]:
        """Get all trading days between two dates."""
        days = []
        d = start
        while d <= end:
            if self.is_trading_day(d):
                days.append(d)
            d += timedelta(days=1)
        return days


_engine: Optional[MarketSessionEngine] = None

def get_market_session_engine() -> MarketSessionEngine:
    global _engine
    if _engine is None:
        _engine = MarketSessionEngine()
    return _engine
