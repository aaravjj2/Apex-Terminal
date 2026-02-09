"""
Trading Window Gate - Enforces trading hours and flatten behavior.

CRITICAL SAFETY MODULE:
- Trading window: 9:30am ET to 2:15pm ET
- At/after 2:15pm ET (or early close buffer):
  - Cancel all open orders
  - Close all positions (flatten)
  - Lock out further trading until next day
- Restart-safe: If dyno restarts at 2:40pm, immediately flatten and stay locked

This module uses Alpaca's clock as the primary time source for accuracy,
with system clock as fallback.
"""

import logging
from datetime import datetime, time, timedelta
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

# Eastern timezone for NYSE
ET = ZoneInfo("America/New_York")

# Trading window bounds
MARKET_OPEN = time(9, 30)
TRADING_CUTOFF = time(14, 15)  # 2:15pm ET - stop trading, start flatten
MARKET_CLOSE = time(16, 0)     # 4:00pm ET - regular close
EARLY_CLOSE = time(13, 0)      # 1:00pm ET - early close days

# Buffer before close for early close days (flatten 15 min before)
EARLY_CLOSE_BUFFER_MINUTES = 15


class TradingGateState(Enum):
    """State of the trading gate."""
    PRE_MARKET = "pre_market"          # Before 9:30am ET
    TRADING_ALLOWED = "trading_allowed" # 9:30am - 2:15pm ET
    FLATTEN_REQUIRED = "flatten_required"  # 2:15pm+ or restart after cutoff
    CLOSED = "closed"                  # Weekend/holiday


@dataclass
class TradingWindowStatus:
    """Result of checking trading window."""
    state: TradingGateState
    allow_trading: bool
    trigger_flatten: bool
    reason: str
    next_window_open: Optional[datetime] = None  # When trading resumes
    current_time_et: Optional[datetime] = None


class TradingWindowGate:
    """
    Enforces trading window restrictions.
    
    Usage:
        gate = TradingWindowGate()
        
        # In cycle loop:
        status = gate.check(alpaca_clock)  # Use Alpaca clock for accuracy
        if not status.allow_trading:
            if status.trigger_flatten:
                await flatten_all()
            return  # Skip cycle
    """
    
    def __init__(self):
        self._flatten_triggered_today: Optional[datetime] = None
        self._logger = logging.getLogger(f"{__name__}.TradingWindowGate")
    
    def check(
        self,
        alpaca_clock: Optional[object] = None,
        now_override: Optional[datetime] = None
    ) -> TradingWindowStatus:
        """
        Check current trading window status.
        
        Args:
            alpaca_clock: Optional Alpaca MarketClock object (preferred for accuracy)
            now_override: Override current time (for testing)
        
        Returns:
            TradingWindowStatus with state, allow_trading, trigger_flatten, reason
        """
        # Get current time in ET
        now_et = self._get_current_time_et(alpaca_clock, now_override)
        today = now_et.date()
        
        # Check if market is closed (weekend/holiday)
        if not self._is_trading_day(today, alpaca_clock):
            return TradingWindowStatus(
                state=TradingGateState.CLOSED,
                allow_trading=False,
                trigger_flatten=False,
                reason="Market closed (weekend/holiday)",
                current_time_et=now_et
            )
        
        # Get effective cutoff time (handles early close days)
        cutoff_time = self._get_cutoff_time(today, alpaca_clock)
        current_time = now_et.time()
        
        # Before market open
        if current_time < MARKET_OPEN:
            return TradingWindowStatus(
                state=TradingGateState.PRE_MARKET,
                allow_trading=False,
                trigger_flatten=False,
                reason=f"Pre-market (opens at {MARKET_OPEN})",
                current_time_et=now_et
            )
        
        # Trading window: 9:30am to cutoff
        if MARKET_OPEN <= current_time < cutoff_time:
            # Reset flatten flag if we're in a new trading day
            if self._flatten_triggered_today != today:
                self._flatten_triggered_today = None
            
            return TradingWindowStatus(
                state=TradingGateState.TRADING_ALLOWED,
                allow_trading=True,
                trigger_flatten=False,
                reason=f"Trading window open (until {cutoff_time})",
                current_time_et=now_et
            )
        
        # At or after cutoff - FLATTEN REQUIRED
        # Only trigger flatten once per day
        already_flattened = self._flatten_triggered_today == today
        trigger_flatten = not already_flattened
        
        if trigger_flatten:
            self._flatten_triggered_today = today
            self._logger.warning(
                f"FLATTEN TRIGGERED: Current time {current_time} >= cutoff {cutoff_time}"
            )
        
        return TradingWindowStatus(
            state=TradingGateState.FLATTEN_REQUIRED,
            allow_trading=False,
            trigger_flatten=trigger_flatten,
            reason=f"After trading cutoff ({cutoff_time}). {'Flatten triggered.' if trigger_flatten else 'Already flattened today.'}",
            current_time_et=now_et
        )
    
    def check_restart_safety(
        self,
        alpaca_clock: Optional[object] = None
    ) -> Tuple[bool, str]:
        """
        Check if we need to flatten immediately on startup/restart.
        
        This handles the case where dyno restarts at 2:40pm - must flatten immediately.
        
        Returns:
            (should_flatten: bool, reason: str)
        """
        status = self.check(alpaca_clock)
        
        if status.state == TradingGateState.FLATTEN_REQUIRED and status.trigger_flatten:
            return True, f"Restart after cutoff: {status.reason}"
        
        return False, "No immediate flatten needed"
    
    def _get_current_time_et(
        self,
        alpaca_clock: Optional[object],
        now_override: Optional[datetime]
    ) -> datetime:
        """Get current time in Eastern timezone."""
        if now_override:
            if now_override.tzinfo is None:
                return now_override.replace(tzinfo=ET)
            return now_override.astimezone(ET)
        
        # Use Alpaca clock's timestamp if available (most accurate for market hours)
        if alpaca_clock:
            try:
                # Alpaca MarketClock has timestamp attribute
                if hasattr(alpaca_clock, 'timestamp') and alpaca_clock.timestamp:
                    return alpaca_clock.timestamp.astimezone(ET)
            except Exception as e:
                self._logger.warning(f"Error reading Alpaca clock timestamp: {e}")
        
        # Fallback to system time
        return datetime.now(ET)
    
    def _is_trading_day(
        self,
        date: datetime,
        alpaca_clock: Optional[object]
    ) -> bool:
        """Check if the given date is a trading day."""
        # Use Alpaca clock's is_open if available
        if alpaca_clock and hasattr(alpaca_clock, 'is_open'):
            # If market is open, it's definitely a trading day
            if alpaca_clock.is_open:
                return True
        
        # Check day of week (0=Monday, 5=Saturday, 6=Sunday)
        if date.weekday() >= 5:
            return False
        
        # Use market calendar for holidays
        from services.market_calendar import MarketCalendarService
        cal = MarketCalendarService()
        
        # Check if it's a holiday
        if not cal.is_trading_day(date):
            return False
        
        return True
    
    def _get_cutoff_time(
        self,
        date: datetime,
        alpaca_clock: Optional[object]
    ) -> time:
        """
        Get trading cutoff time for the given date.
        
        Returns min(2:15pm, next_close - buffer) for early close days.
        """
        from services.market_calendar import MarketCalendarService
        cal = MarketCalendarService()
        
        # Get the close time for this day
        close_time = cal.get_close_time(date)
        
        # If it's an early close day (1:00pm close)
        if close_time == EARLY_CLOSE:
            # Flatten 15 minutes before early close
            early_cutoff = datetime.combine(date, close_time) - timedelta(minutes=EARLY_CLOSE_BUFFER_MINUTES)
            early_cutoff_time = early_cutoff.time()
            
            # Use the earlier of 2:15pm or early_close - buffer
            if early_cutoff_time < TRADING_CUTOFF:
                self._logger.info(
                    f"Early close day: cutoff at {early_cutoff_time} instead of {TRADING_CUTOFF}"
                )
                return early_cutoff_time
        
        # Also check Alpaca clock for next_close if available
        if alpaca_clock and hasattr(alpaca_clock, 'next_close') and alpaca_clock.next_close:
            try:
                next_close_et = alpaca_clock.next_close.astimezone(ET)
                # If next_close is today, use it with buffer
                if next_close_et.date() == date:
                    buffered = next_close_et - timedelta(minutes=EARLY_CLOSE_BUFFER_MINUTES)
                    buffered_time = buffered.time()
                    if buffered_time < TRADING_CUTOFF:
                        return buffered_time
            except Exception as e:
                self._logger.warning(f"Error processing Alpaca next_close: {e}")
        
        return TRADING_CUTOFF


# Module-level singleton for easy access
_gate: Optional[TradingWindowGate] = None


def get_trading_gate() -> TradingWindowGate:
    """Get singleton TradingWindowGate instance."""
    global _gate
    if _gate is None:
        _gate = TradingWindowGate()
    return _gate


def check_trading_window(
    alpaca_clock: Optional[object] = None,
    now_override: Optional[datetime] = None
) -> TradingWindowStatus:
    """
    Convenience function to check trading window status.
    
    Usage:
        status = check_trading_window()
        if not status.allow_trading:
            if status.trigger_flatten:
                await flatten_all()
            return
    """
    return get_trading_gate().check(alpaca_clock, now_override)
