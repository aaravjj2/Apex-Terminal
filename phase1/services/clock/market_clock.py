"""
MarketClock - Unified time source for live and replay modes.

Provides:
- Live mode: Real wall-clock time
- Virtual mode: Controllable simulated time for deterministic replay
- Thread-safe operations
- Freeze/resume for debugging
"""

import asyncio
import time
import threading
from enum import Enum
from typing import Optional, Callable, List, Awaitable
from dataclasses import dataclass, field
import structlog


logger = structlog.get_logger()


class ClockMode(str, Enum):
    """Clock operating mode."""
    LIVE = "live"
    VIRTUAL = "virtual"


@dataclass
class ClockState:
    """Internal clock state."""
    mode: ClockMode = ClockMode.LIVE
    virtual_time_ms: int = 0
    frozen: bool = False
    freeze_time_ms: Optional[int] = None
    speed_multiplier: float = 1.0


class MarketClock:
    """
    Unified clock for market time management.
    
    In LIVE mode: Returns real wall-clock time (UTC milliseconds).
    In VIRTUAL mode: Returns controllable simulated time for deterministic replay.
    
    Thread-safe and supports async operations.
    
    Usage:
        clock = MarketClock(mode=ClockMode.LIVE)
        current_time = clock.now()
        
        # For replay
        clock = MarketClock(mode=ClockMode.VIRTUAL, start_time_ms=1704067200000)
        clock.advance(1000)  # Advance 1 second
        clock.seek(1704067260000)  # Jump to specific time
    """
    
    def __init__(
        self,
        mode: ClockMode = ClockMode.LIVE,
        start_time_ms: Optional[int] = None,
        speed_multiplier: float = 1.0,
    ):
        """
        Initialize MarketClock.
        
        Args:
            mode: LIVE for real time, VIRTUAL for simulated time
            start_time_ms: Starting time for VIRTUAL mode (ignored in LIVE)
            speed_multiplier: Speed factor for virtual time advancement (1.0 = real-time)
        """
        self._state = ClockState(
            mode=mode,
            virtual_time_ms=start_time_ms or 0,
            speed_multiplier=speed_multiplier,
        )
        self._lock = threading.RLock()
        self._async_lock = asyncio.Lock()
        
        # Callbacks for time change notifications
        self._time_callbacks: List[Callable[[int], Awaitable[None]]] = []
        
        # Reference point for virtual time advancement in "running" mode
        self._virtual_start_wall_ms: Optional[int] = None
        self._virtual_start_sim_ms: Optional[int] = None
        
        self.logger = logger.bind(component="market_clock", mode=mode.value)
        self.logger.info("clock_initialized", start_time_ms=start_time_ms)
    
    @property
    def mode(self) -> ClockMode:
        """Get current clock mode."""
        with self._lock:
            return self._state.mode
    
    @property
    def is_frozen(self) -> bool:
        """Check if clock is frozen."""
        with self._lock:
            return self._state.frozen
    
    @property
    def speed_multiplier(self) -> float:
        """Get current speed multiplier."""
        with self._lock:
            return self._state.speed_multiplier
    
    def now(self) -> int:
        """
        Get current time in UTC milliseconds.
        
        In LIVE mode: Returns real wall-clock time.
        In VIRTUAL mode: Returns simulated time.
        
        Returns:
            Current time as Unix timestamp in milliseconds
        """
        with self._lock:
            if self._state.frozen and self._state.freeze_time_ms is not None:
                return self._state.freeze_time_ms
            
            if self._state.mode == ClockMode.LIVE:
                return int(time.time() * 1000)
            else:
                # Virtual mode
                if self._virtual_start_wall_ms is not None:
                    # Running virtual clock - advance based on wall time
                    wall_elapsed = int(time.time() * 1000) - self._virtual_start_wall_ms
                    scaled_elapsed = int(wall_elapsed * self._state.speed_multiplier)
                    return self._virtual_start_sim_ms + scaled_elapsed
                else:
                    return self._state.virtual_time_ms
    
    def advance(self, delta_ms: int) -> int:
        """
        Advance virtual time by delta milliseconds.
        
        Only valid in VIRTUAL mode.
        
        Args:
            delta_ms: Milliseconds to advance (can be negative)
            
        Returns:
            New current time
            
        Raises:
            RuntimeError: If called in LIVE mode
        """
        with self._lock:
            if self._state.mode == ClockMode.LIVE:
                raise RuntimeError("Cannot advance time in LIVE mode")
            
            if self._state.frozen:
                raise RuntimeError("Cannot advance frozen clock")
            
            self._state.virtual_time_ms += delta_ms
            new_time = self._state.virtual_time_ms
            
            self.logger.debug("clock_advanced", delta_ms=delta_ms, new_time=new_time)
            return new_time
    
    def seek(self, target_ms: int) -> int:
        """
        Seek to a specific timestamp.
        
        Only valid in VIRTUAL mode.
        
        Args:
            target_ms: Target timestamp in milliseconds
            
        Returns:
            New current time
            
        Raises:
            RuntimeError: If called in LIVE mode
        """
        with self._lock:
            if self._state.mode == ClockMode.LIVE:
                raise RuntimeError("Cannot seek time in LIVE mode")
            
            if self._state.frozen:
                raise RuntimeError("Cannot seek frozen clock")
            
            old_time = self._state.virtual_time_ms
            self._state.virtual_time_ms = target_ms
            
            # Reset running state if any
            self._virtual_start_wall_ms = None
            self._virtual_start_sim_ms = None
            
            self.logger.debug("clock_seeked", old_time=old_time, new_time=target_ms)
            return target_ms
    
    def freeze(self) -> int:
        """
        Freeze the clock at current time.
        
        Returns:
            The frozen timestamp
        """
        with self._lock:
            current = self.now()
            self._state.frozen = True
            self._state.freeze_time_ms = current
            
            self.logger.info("clock_frozen", frozen_at=current)
            return current
    
    def resume(self) -> int:
        """
        Resume a frozen clock.
        
        Returns:
            The time when resumed
        """
        with self._lock:
            if not self._state.frozen:
                return self.now()
            
            frozen_time = self._state.freeze_time_ms
            self._state.frozen = False
            self._state.freeze_time_ms = None
            
            # In virtual mode, set the virtual time to where we were frozen
            if self._state.mode == ClockMode.VIRTUAL:
                self._state.virtual_time_ms = frozen_time
            
            self.logger.info("clock_resumed", resumed_at=frozen_time)
            return frozen_time
    
    def set_speed(self, multiplier: float) -> None:
        """
        Set speed multiplier for virtual time.
        
        Args:
            multiplier: Speed factor (1.0 = real-time, 2.0 = 2x speed, etc.)
        """
        with self._lock:
            if self._state.mode == ClockMode.LIVE:
                self.logger.warning("speed_ignored_in_live_mode")
                return
            
            # If running, capture current position before changing speed
            if self._virtual_start_wall_ms is not None:
                current = self.now()
                self._virtual_start_sim_ms = current
                self._virtual_start_wall_ms = int(time.time() * 1000)
            
            self._state.speed_multiplier = multiplier
            self.logger.info("clock_speed_set", multiplier=multiplier)
    
    def start_running(self) -> None:
        """
        Start the virtual clock running (advancing with wall time).
        
        Only affects VIRTUAL mode.
        """
        with self._lock:
            if self._state.mode == ClockMode.LIVE:
                return
            
            if self._state.frozen:
                raise RuntimeError("Cannot start running a frozen clock")
            
            self._virtual_start_wall_ms = int(time.time() * 1000)
            self._virtual_start_sim_ms = self._state.virtual_time_ms
            
            self.logger.info("clock_started_running", from_time=self._virtual_start_sim_ms)
    
    def stop_running(self) -> int:
        """
        Stop the virtual clock from running with wall time.
        
        Returns:
            Current time when stopped
        """
        with self._lock:
            if self._state.mode == ClockMode.LIVE:
                return self.now()
            
            # Capture current position
            current = self.now()
            self._state.virtual_time_ms = current
            self._virtual_start_wall_ms = None
            self._virtual_start_sim_ms = None
            
            self.logger.info("clock_stopped_running", at_time=current)
            return current
    
    def set_mode(self, mode: ClockMode, start_time_ms: Optional[int] = None) -> None:
        """
        Switch clock mode.
        
        Args:
            mode: New clock mode
            start_time_ms: Starting time for VIRTUAL mode
        """
        with self._lock:
            old_mode = self._state.mode
            self._state.mode = mode
            
            if mode == ClockMode.VIRTUAL and start_time_ms is not None:
                self._state.virtual_time_ms = start_time_ms
            
            # Reset running state
            self._virtual_start_wall_ms = None
            self._virtual_start_sim_ms = None
            
            self.logger.info("clock_mode_changed", old_mode=old_mode.value, new_mode=mode.value)
    
    def register_callback(self, callback: Callable[[int], Awaitable[None]]) -> None:
        """Register a callback for time change notifications."""
        with self._lock:
            self._time_callbacks.append(callback)
    
    def unregister_callback(self, callback: Callable[[int], Awaitable[None]]) -> None:
        """Unregister a time change callback."""
        with self._lock:
            if callback in self._time_callbacks:
                self._time_callbacks.remove(callback)
    
    async def notify_time_change(self, new_time: int) -> None:
        """Notify all registered callbacks of time change."""
        async with self._async_lock:
            callbacks = list(self._time_callbacks)
        
        for callback in callbacks:
            try:
                await callback(new_time)
            except Exception as e:
                self.logger.error("callback_error", error=str(e))
    
    def get_state(self) -> dict:
        """Get current clock state as dictionary."""
        with self._lock:
            return {
                "mode": self._state.mode.value,
                "current_time_ms": self.now(),
                "frozen": self._state.frozen,
                "speed_multiplier": self._state.speed_multiplier,
                "running": self._virtual_start_wall_ms is not None,
            }
    
    def __repr__(self) -> str:
        return f"MarketClock(mode={self.mode.value}, now={self.now()}, frozen={self.is_frozen})"


# Global clock instance (can be replaced for testing)
_global_clock: Optional[MarketClock] = None


def get_clock() -> MarketClock:
    """Get the global MarketClock instance."""
    global _global_clock
    if _global_clock is None:
        _global_clock = MarketClock(mode=ClockMode.LIVE)
    return _global_clock


def set_clock(clock: MarketClock) -> None:
    """Set the global MarketClock instance (for testing)."""
    global _global_clock
    _global_clock = clock


def reset_clock() -> None:
    """Reset the global clock to default."""
    global _global_clock
    _global_clock = None
