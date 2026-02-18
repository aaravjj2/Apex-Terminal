"""
Session calendar for exchange trading hours.
Handles timezone conversions and session boundaries.
"""

from abc import ABC, abstractmethod
from datetime import datetime, time, date, timedelta
from typing import Optional, Tuple
from zoneinfo import ZoneInfo
import structlog


logger = structlog.get_logger()


class SessionCalendar(ABC):
    """
    Abstract base class for exchange session calendars.
    Defines trading hours and session boundaries.
    """
    
    @abstractmethod
    def is_market_open(self, ts_ms: int) -> bool:
        """Check if market is open at given timestamp."""
        pass
    
    @abstractmethod
    def get_session_bounds(self, ts_ms: int) -> Tuple[int, int]:
        """
        Get session start and end times for the session containing ts_ms.
        
        Returns:
            Tuple of (session_start_ms, session_end_ms)
        """
        pass
    
    @abstractmethod
    def get_next_session_start(self, ts_ms: int) -> int:
        """Get start time of next trading session."""
        pass
    
    @abstractmethod
    def get_bar_interval_bounds(
        self,
        ts_ms: int,
        timeframe_ms: int,
    ) -> Tuple[int, int]:
        """
        Get the bar interval boundaries for a given timestamp and timeframe.
        
        Returns:
            Tuple of (interval_start_ms, interval_end_ms)
        """
        pass


class NYSESessionCalendar(SessionCalendar):
    """
    NYSE trading session calendar.
    
    Regular hours: 9:30 AM - 4:00 PM ET
    Extended hours (optional):
      - Pre-market: 4:00 AM - 9:30 AM ET
      - After-hours: 4:00 PM - 8:00 PM ET
    """
    
    TIMEZONE = ZoneInfo("America/New_York")
    
    # Regular session times
    REGULAR_OPEN = time(9, 30)
    REGULAR_CLOSE = time(16, 0)
    
    # Extended session times
    PREMARKET_OPEN = time(4, 0)
    AFTERHOURS_CLOSE = time(20, 0)
    
    def __init__(self, include_extended_hours: bool = False):
        """
        Initialize NYSE calendar.
        
        Args:
            include_extended_hours: Include pre-market and after-hours
        """
        self.include_extended_hours = include_extended_hours
        self.logger = logger.bind(component="session_calendar")
    
    def _ms_to_et(self, ts_ms: int) -> datetime:
        """Convert UTC milliseconds to Eastern Time datetime."""
        dt_utc = datetime.utcfromtimestamp(ts_ms / 1000).replace(tzinfo=ZoneInfo("UTC"))
        return dt_utc.astimezone(self.TIMEZONE)
    
    def _et_to_ms(self, dt: datetime) -> int:
        """Convert Eastern Time datetime to UTC milliseconds."""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=self.TIMEZONE)
        dt_utc = dt.astimezone(ZoneInfo("UTC"))
        return int(dt_utc.timestamp() * 1000)
    
    def is_market_open(self, ts_ms: int) -> bool:
        """Check if market is open at given timestamp."""
        dt = self._ms_to_et(ts_ms)
        
        # Check if weekday (Mon=0, Sun=6)
        if dt.weekday() >= 5:
            return False
        
        # Get time of day
        t = dt.time()
        
        if self.include_extended_hours:
            return self.PREMARKET_OPEN <= t < self.AFTERHOURS_CLOSE
        else:
            return self.REGULAR_OPEN <= t < self.REGULAR_CLOSE
    
    def get_session_bounds(self, ts_ms: int) -> Tuple[int, int]:
        """Get session start and end times for the day."""
        dt = self._ms_to_et(ts_ms)
        day = dt.date()
        
        if self.include_extended_hours:
            session_open = self.PREMARKET_OPEN
            session_close = self.AFTERHOURS_CLOSE
        else:
            session_open = self.REGULAR_OPEN
            session_close = self.REGULAR_CLOSE
        
        start_dt = datetime.combine(day, session_open, tzinfo=self.TIMEZONE)
        end_dt = datetime.combine(day, session_close, tzinfo=self.TIMEZONE)
        
        return self._et_to_ms(start_dt), self._et_to_ms(end_dt)
    
    def get_next_session_start(self, ts_ms: int) -> int:
        """Get start time of next trading session."""
        dt = self._ms_to_et(ts_ms)
        
        if self.include_extended_hours:
            session_open = self.PREMARKET_OPEN
        else:
            session_open = self.REGULAR_OPEN
        
        # Check if we're before today's session
        today_open = datetime.combine(dt.date(), session_open, tzinfo=self.TIMEZONE)
        if dt < today_open and dt.weekday() < 5:
            return self._et_to_ms(today_open)
        
        # Move to next day
        next_day = dt.date() + timedelta(days=1)
        
        # Skip weekends
        while next_day.weekday() >= 5:
            next_day += timedelta(days=1)
        
        next_open = datetime.combine(next_day, session_open, tzinfo=self.TIMEZONE)
        return self._et_to_ms(next_open)
    
    def get_bar_interval_bounds(
        self,
        ts_ms: int,
        timeframe_ms: int,
    ) -> Tuple[int, int]:
        """
        Calculate bar interval boundaries aligned to timeframe.
        
        For intraday timeframes, bars are aligned to session start.
        For daily timeframes, bars are aligned to calendar days.
        """
        dt = self._ms_to_et(ts_ms)
        
        # Daily timeframe - align to calendar day
        if timeframe_ms >= 24 * 60 * 60 * 1000:
            day_start = datetime.combine(
                dt.date(),
                time(0, 0),
                tzinfo=self.TIMEZONE
            )
            day_end = day_start + timedelta(days=1)
            return self._et_to_ms(day_start), self._et_to_ms(day_end)
        
        # Intraday - align to session boundaries
        session_start_ms, session_end_ms = self.get_session_bounds(ts_ms)
        
        # Calculate offset from session start
        offset_ms = ts_ms - session_start_ms
        
        # Calculate interval index
        interval_idx = offset_ms // timeframe_ms
        
        # Calculate interval bounds
        interval_start = session_start_ms + (interval_idx * timeframe_ms)
        interval_end = interval_start + timeframe_ms
        
        # Clamp to session end
        interval_end = min(interval_end, session_end_ms)
        
        return interval_start, interval_end
    
    def get_trading_days(
        self,
        start_date: date,
        end_date: date,
    ) -> list[date]:
        """Get list of trading days in date range."""
        trading_days = []
        current = start_date
        
        while current <= end_date:
            # Skip weekends
            if current.weekday() < 5:
                trading_days.append(current)
            current += timedelta(days=1)
        
        # Note: Does not account for market holidays
        # Could be extended with holiday calendar
        return trading_days
    
    def bars_in_session(self, timeframe_ms: int) -> int:
        """Calculate number of bars in a regular session."""
        if self.include_extended_hours:
            session_duration_ms = 16 * 60 * 60 * 1000  # 16 hours
        else:
            session_duration_ms = 6.5 * 60 * 60 * 1000  # 6.5 hours
        
        return int(session_duration_ms // timeframe_ms)


class AlwaysOpenCalendar(SessionCalendar):
    """
    24/7 calendar for testing or crypto markets.
    """
    
    def is_market_open(self, ts_ms: int) -> bool:
        return True
    
    def get_session_bounds(self, ts_ms: int) -> Tuple[int, int]:
        # Return day boundaries in UTC
        dt = datetime.utcfromtimestamp(ts_ms / 1000)
        day_start = datetime.combine(dt.date(), time(0, 0))
        day_end = day_start + timedelta(days=1)
        return (
            int(day_start.timestamp() * 1000),
            int(day_end.timestamp() * 1000),
        )
    
    def get_next_session_start(self, ts_ms: int) -> int:
        # Next session is tomorrow at midnight UTC
        dt = datetime.utcfromtimestamp(ts_ms / 1000)
        next_day = dt.date() + timedelta(days=1)
        return int(datetime.combine(next_day, time(0, 0)).timestamp() * 1000)
    
    def get_bar_interval_bounds(
        self,
        ts_ms: int,
        timeframe_ms: int,
    ) -> Tuple[int, int]:
        # Simple floor alignment to epoch
        interval_start = (ts_ms // timeframe_ms) * timeframe_ms
        interval_end = interval_start + timeframe_ms
        return interval_start, interval_end
