"""
Market Calendar Service

Provides accurate NYSE market hours without external dependencies.
Handles:
- Regular hours (9:30 AM - 4:00 PM ET)
- Weekends
- Known NYSE holidays (2024-2026)
- Early close days (1:00 PM ET)
"""

from datetime import datetime, date, time, timedelta
from typing import Optional, Tuple
from zoneinfo import ZoneInfo
import logging

logger = logging.getLogger(__name__)

# Eastern timezone
ET = ZoneInfo("America/New_York")

# NYSE regular hours
MARKET_OPEN = time(9, 30)
MARKET_CLOSE = time(16, 0)
EARLY_CLOSE = time(13, 0)

# NYSE holidays (closed days) - 2024-2026
# Note: Add more years as needed
NYSE_HOLIDAYS = {
    # 2024
    date(2024, 1, 1),   # New Year's Day
    date(2024, 1, 15),  # MLK Day
    date(2024, 2, 19),  # Presidents Day
    date(2024, 3, 29),  # Good Friday
    date(2024, 5, 27),  # Memorial Day
    date(2024, 6, 19),  # Juneteenth
    date(2024, 7, 4),   # Independence Day
    date(2024, 9, 2),   # Labor Day
    date(2024, 11, 28), # Thanksgiving
    date(2024, 12, 25), # Christmas
    
    # 2025
    date(2025, 1, 1),   # New Year's Day
    date(2025, 1, 20),  # MLK Day
    date(2025, 2, 17),  # Presidents Day
    date(2025, 4, 18),  # Good Friday
    date(2025, 5, 26),  # Memorial Day
    date(2025, 6, 19),  # Juneteenth
    date(2025, 7, 4),   # Independence Day
    date(2025, 9, 1),   # Labor Day
    date(2025, 11, 27), # Thanksgiving
    date(2025, 12, 25), # Christmas
    
    # 2026
    date(2026, 1, 1),   # New Year's Day
    date(2026, 1, 19),  # MLK Day
    date(2026, 2, 16),  # Presidents Day
    date(2026, 4, 3),   # Good Friday
    date(2026, 5, 25),  # Memorial Day
    date(2026, 6, 19),  # Juneteenth
    date(2026, 7, 3),   # Independence Day (observed)
    date(2026, 9, 7),   # Labor Day
    date(2026, 11, 26), # Thanksgiving
    date(2026, 12, 25), # Christmas
}

# Early close days (1:00 PM ET)
NYSE_EARLY_CLOSE = {
    # Day before Independence Day (if weekday)
    date(2024, 7, 3),
    date(2025, 7, 3),
    date(2026, 7, 2),
    # Day after Thanksgiving
    date(2024, 11, 29),
    date(2025, 11, 28),
    date(2026, 11, 27),
    # Christmas Eve (if weekday)
    date(2024, 12, 24),
    date(2025, 12, 24),
    date(2026, 12, 24),
}


class MarketCalendarService:
    """Service for market hours and trading day checks."""
    
    def __init__(self):
        self._tz = ET
    
    def now_et(self) -> datetime:
        """Get current time in Eastern timezone."""
        return datetime.now(self._tz)
    
    def today_et(self) -> date:
        """Get today's date in Eastern timezone."""
        return self.now_et().date()
    
    def is_trading_day(self, d: Optional[date] = None) -> bool:
        """Check if a date is a trading day (not weekend, not holiday)."""
        d = d or self.today_et()
        
        # Weekend check
        if d.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return False
        
        # Holiday check
        if d in NYSE_HOLIDAYS:
            return False
        
        return True
    
    def get_close_time(self, d: Optional[date] = None) -> time:
        """Get market close time (may be early close)."""
        d = d or self.today_et()
        if d in NYSE_EARLY_CLOSE:
            return EARLY_CLOSE
        return MARKET_CLOSE
    
    def is_market_open(self, dt: Optional[datetime] = None) -> bool:
        """Check if market is currently open."""
        dt = dt or self.now_et()
        
        # Ensure timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=self._tz)
        else:
            dt = dt.astimezone(self._tz)
        
        d = dt.date()
        t = dt.time()
        
        # Not a trading day
        if not self.is_trading_day(d):
            return False
        
        # Check time bounds
        close_time = self.get_close_time(d)
        return MARKET_OPEN <= t < close_time
    
    def time_to_open(self) -> Optional[timedelta]:
        """Get time until market opens, or None if already open."""
        now = self.now_et()
        
        if self.is_market_open(now):
            return None
        
        # Find next trading day
        d = now.date()
        t = now.time()
        
        # If today is a trading day and before open
        if self.is_trading_day(d) and t < MARKET_OPEN:
            next_open = datetime.combine(d, MARKET_OPEN, tzinfo=self._tz)
            return next_open - now
        
        # Find next trading day
        d = d + timedelta(days=1)
        while not self.is_trading_day(d):
            d = d + timedelta(days=1)
            if d > now.date() + timedelta(days=10):
                # Safety limit
                return None
        
        next_open = datetime.combine(d, MARKET_OPEN, tzinfo=self._tz)
        return next_open - now
    
    def time_to_close(self) -> Optional[timedelta]:
        """Get time until market closes, or None if closed."""
        now = self.now_et()
        
        if not self.is_market_open(now):
            return None
        
        close_time = self.get_close_time(now.date())
        close_dt = datetime.combine(now.date(), close_time, tzinfo=self._tz)
        return close_dt - now
    
    def get_market_status(self) -> dict:
        """Get comprehensive market status."""
        now = self.now_et()
        is_open = self.is_market_open(now)
        
        return {
            "is_open": is_open,
            "current_time_et": now.isoformat(),
            "today_is_trading_day": self.is_trading_day(),
            "close_time": self.get_close_time().isoformat() if self.is_trading_day() else None,
            "time_to_open_seconds": self.time_to_open().total_seconds() if self.time_to_open() else None,
            "time_to_close_seconds": self.time_to_close().total_seconds() if self.time_to_close() else None,
        }


# Singleton instance
_calendar: Optional[MarketCalendarService] = None


def get_market_calendar() -> MarketCalendarService:
    """Get singleton calendar instance."""
    global _calendar
    if _calendar is None:
        _calendar = MarketCalendarService()
    return _calendar
