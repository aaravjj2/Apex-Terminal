"""
BarIndex calculator for deterministic bar sequencing.
"""

from datetime import datetime, date, timedelta
from typing import Optional, Tuple, Dict
from zoneinfo import ZoneInfo
import structlog

from .session import SessionCalendar, NYSESessionCalendar
from ..config import timeframe_to_ms


logger = structlog.get_logger()


class BarIndexCalculator:
    """
    Calculates deterministic bar indices for a symbol/timeframe combination.
    
    BarIndex is an integer sequence starting at 0 for the earliest bar
    in the dataset. It provides a stable reference across restarts
    and ensures deterministic bar identification.
    
    Key properties:
    - Same timestamp + timeframe = same bar_index
    - bar_index increases monotonically with time
    - Can be reconstructed from earliest persisted timestamp
    """
    
    def __init__(
        self,
        symbol: str,
        timeframe: str,
        calendar: Optional[SessionCalendar] = None,
        epoch_ms: Optional[int] = None,
    ):
        """
        Initialize BarIndex calculator.
        
        Args:
            symbol: Stock symbol
            timeframe: Timeframe string ('1m', '5m', etc.)
            calendar: Session calendar for trading hours
            epoch_ms: Reference epoch for bar_index 0 (default: session-based)
        """
        self.symbol = symbol
        self.timeframe = timeframe
        self.timeframe_ms = timeframe_to_ms(timeframe)
        self.calendar = calendar or NYSESessionCalendar()
        
        # Epoch is the reference point for bar_index = 0
        # If not provided, use a sensible default
        self._epoch_ms = epoch_ms
        
        self.logger = logger.bind(
            component="bar_index",
            symbol=symbol,
            timeframe=timeframe,
        )
    
    @property
    def epoch_ms(self) -> int:
        """Get or compute the epoch timestamp for bar_index 0."""
        if self._epoch_ms is not None:
            return self._epoch_ms
        
        # Default epoch: start of 2020 in market timezone
        # This gives us a stable reference point
        default_epoch = datetime(2020, 1, 1, 0, 0, 0, tzinfo=ZoneInfo("UTC"))
        return int(default_epoch.timestamp() * 1000)
    
    def set_epoch(self, epoch_ms: int) -> None:
        """
        Set the epoch for bar_index calculations.
        Should be called once based on earliest persisted data.
        """
        self._epoch_ms = epoch_ms
        self.logger.info("epoch_set", epoch_ms=epoch_ms)
    
    def calculate_bar_index(self, ts_ms: int) -> int:
        """
        Calculate the bar_index for a given timestamp.
        
        The bar_index is deterministic and represents which bar
        the timestamp falls into relative to the epoch.
        """
        if ts_ms < self.epoch_ms:
            raise ValueError(f"Timestamp {ts_ms} is before epoch {self.epoch_ms}")
        
        # For daily timeframe, count calendar days
        if self.timeframe == "1d":
            return self._calculate_daily_index(ts_ms)
        
        # For intraday, calculate based on session structure
        return self._calculate_intraday_index(ts_ms)
    
    def _calculate_daily_index(self, ts_ms: int) -> int:
        """Calculate bar index for daily timeframe."""
        epoch_date = datetime.utcfromtimestamp(self.epoch_ms / 1000).date()
        ts_date = datetime.utcfromtimestamp(ts_ms / 1000).date()
        
        # Count trading days between epoch and timestamp
        # Simplified: count all days (not accounting for holidays)
        delta = (ts_date - epoch_date).days
        return max(0, delta)
    
    def _calculate_intraday_index(self, ts_ms: int) -> int:
        """Calculate bar index for intraday timeframes."""
        # Get interval bounds for this timestamp
        interval_start, _ = self.calendar.get_bar_interval_bounds(
            ts_ms, self.timeframe_ms
        )
        
        # Calculate number of intervals since epoch
        # This is a simplified calculation - a more accurate one would
        # account for non-trading hours
        elapsed_ms = interval_start - self.epoch_ms
        
        # For more accurate intraday indexing, we'd count only trading intervals
        # For now, use continuous indexing (simpler, still deterministic)
        return max(0, elapsed_ms // self.timeframe_ms)
    
    def get_interval_bounds(self, ts_ms: int) -> Tuple[int, int]:
        """
        Get the bar interval boundaries for a timestamp.
        
        Returns:
            Tuple of (interval_start_ms, interval_end_ms)
        """
        return self.calendar.get_bar_interval_bounds(ts_ms, self.timeframe_ms)
    
    def get_interval_for_index(self, bar_index: int) -> Tuple[int, int]:
        """
        Calculate interval bounds for a given bar_index.
        Inverse of calculate_bar_index.
        """
        interval_start = self.epoch_ms + (bar_index * self.timeframe_ms)
        interval_end = interval_start + self.timeframe_ms
        return interval_start, interval_end
    
    def is_boundary(self, ts_ms: int) -> bool:
        """Check if timestamp is exactly on an interval boundary."""
        interval_start, _ = self.get_interval_bounds(ts_ms)
        return ts_ms == interval_start
    
    def next_boundary(self, ts_ms: int) -> int:
        """Get timestamp of next interval boundary."""
        _, interval_end = self.get_interval_bounds(ts_ms)
        return interval_end


class MultiTimeframeIndexer:
    """
    Manages bar indices across multiple timeframes for a symbol.
    Ensures consistent indexing when aggregating from lower to higher timeframes.
    """
    
    def __init__(
        self,
        symbol: str,
        timeframes: list[str],
        calendar: Optional[SessionCalendar] = None,
    ):
        """
        Initialize multi-timeframe indexer.
        
        Args:
            symbol: Stock symbol
            timeframes: List of timeframe strings
            calendar: Shared session calendar
        """
        self.symbol = symbol
        self.timeframes = timeframes
        self.calendar = calendar or NYSESessionCalendar()
        
        # Create calculators for each timeframe
        self._calculators: Dict[str, BarIndexCalculator] = {}
        for tf in timeframes:
            self._calculators[tf] = BarIndexCalculator(
                symbol=symbol,
                timeframe=tf,
                calendar=self.calendar,
            )
        
        self.logger = logger.bind(component="mtf_indexer", symbol=symbol)
    
    def set_epoch(self, epoch_ms: int) -> None:
        """Set epoch for all timeframe calculators."""
        for calc in self._calculators.values():
            calc.set_epoch(epoch_ms)
    
    def get_calculator(self, timeframe: str) -> BarIndexCalculator:
        """Get calculator for a specific timeframe."""
        if timeframe not in self._calculators:
            raise ValueError(f"Timeframe {timeframe} not configured")
        return self._calculators[timeframe]
    
    def calculate_indices(self, ts_ms: int) -> Dict[str, int]:
        """Calculate bar indices for all timeframes at a given timestamp."""
        return {
            tf: calc.calculate_bar_index(ts_ms)
            for tf, calc in self._calculators.items()
        }
    
    def get_affected_timeframes(self, ts_ms: int) -> list[str]:
        """
        Determine which timeframes have a boundary at or before this timestamp.
        Useful for knowing which bars to update/confirm.
        """
        affected = []
        for tf, calc in self._calculators.items():
            _, interval_end = calc.get_interval_bounds(ts_ms)
            # If we're past the boundary, this timeframe is affected
            if ts_ms >= interval_end:
                affected.append(tf)
        return affected
