"""
Replay Controller - Manages historical data replay sessions.

Provides:
- Replay session management
- Speed control (1x, 2x, 5x, etc.)
- Play/pause/seek controls
- Clock synchronization for deterministic replay
"""

import asyncio
from typing import Optional, List, Callable, Awaitable, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import structlog

from ..clock.market_clock import MarketClock, ClockMode
from ..models import Bar, CanonicalTick, BarState
from ..bar_engine.lifecycle_manager import BarLifecycleManager


logger = structlog.get_logger()


class ReplayState(str, Enum):
    """Replay session states."""
    IDLE = "idle"
    PLAYING = "playing"
    PAUSED = "paused"
    SEEKING = "seeking"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class ReplayConfig:
    """Configuration for replay sessions."""
    speed_multiplier: float = 1.0
    emit_forming_bars: bool = True
    emit_confirmed_bars: bool = True
    auto_advance: bool = True  # Auto-advance after each bar
    step_size_ms: int = 100    # Time step for playback loop


@dataclass
class ReplayProgress:
    """Progress tracking for replay sessions."""
    current_time_ms: int = 0
    start_time_ms: int = 0
    end_time_ms: int = 0
    ticks_processed: int = 0
    bars_emitted: int = 0
    elapsed_real_ms: int = 0
    
    @property
    def progress_pct(self) -> float:
        """Calculate progress percentage."""
        if self.end_time_ms <= self.start_time_ms:
            return 0.0
        total = self.end_time_ms - self.start_time_ms
        current = self.current_time_ms - self.start_time_ms
        return min(100.0, max(0.0, (current / total) * 100))


class ReplayController:
    """
    Controls replay of historical data through the bar engine.
    
    Key features:
    - Clock-synchronized playback
    - Speed control
    - Play/pause/seek
    - Progress tracking
    - Callback notifications
    """
    
    def __init__(
        self,
        clock: MarketClock,
        lifecycle_manager: Optional[BarLifecycleManager] = None,
        config: Optional[ReplayConfig] = None,
    ):
        """
        Initialize Replay Controller.
        
        Args:
            clock: MarketClock in VIRTUAL mode
            lifecycle_manager: Optional lifecycle manager (creates one if not provided)
            config: Replay configuration
        """
        if clock.mode != ClockMode.VIRTUAL:
            raise ValueError("ReplayController requires a VIRTUAL mode clock")
        
        self._clock = clock
        self._config = config or ReplayConfig()
        
        # Create or use lifecycle manager
        if lifecycle_manager:
            self._lifecycle_manager = lifecycle_manager
        else:
            self._lifecycle_manager = BarLifecycleManager(clock=clock)
        
        # Replay state
        self._state = ReplayState.IDLE
        self._progress = ReplayProgress()
        
        # Tick data
        self._ticks: List[CanonicalTick] = []
        self._tick_index = 0
        
        # Playback task
        self._playback_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        
        # Callbacks
        self._state_callbacks: List[Callable[[ReplayState], Awaitable[None]]] = []
        self._progress_callbacks: List[Callable[[ReplayProgress], Awaitable[None]]] = []
        
        self.logger = logger.bind(component="replay_controller")
    
    @property
    def state(self) -> ReplayState:
        """Get current replay state."""
        return self._state
    
    @property
    def progress(self) -> ReplayProgress:
        """Get current progress."""
        return self._progress
    
    @property
    def clock(self) -> MarketClock:
        """Get the clock."""
        return self._clock
    
    @property
    def config(self) -> ReplayConfig:
        """Get configuration."""
        return self._config
    
    def register_state_callback(
        self,
        callback: Callable[[ReplayState], Awaitable[None]]
    ) -> None:
        """Register callback for state changes."""
        self._state_callbacks.append(callback)
    
    def register_progress_callback(
        self,
        callback: Callable[[ReplayProgress], Awaitable[None]]
    ) -> None:
        """Register callback for progress updates."""
        self._progress_callbacks.append(callback)
    
    def register_bar_update_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar updates."""
        self._lifecycle_manager.register_update_callback(callback)
    
    def register_bar_confirmed_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar confirmations."""
        self._lifecycle_manager.register_confirmed_callback(callback)
    
    async def load_ticks(
        self,
        ticks: List[CanonicalTick],
        start_time_ms: Optional[int] = None,
        end_time_ms: Optional[int] = None,
    ) -> None:
        """
        Load tick data for replay.
        
        Args:
            ticks: List of ticks (must be sorted by timestamp)
            start_time_ms: Override start time
            end_time_ms: Override end time
        """
        async with self._lock:
            if self._state == ReplayState.PLAYING:
                raise RuntimeError("Cannot load ticks while playing")
            
            # Sort ticks by timestamp
            self._ticks = sorted(ticks, key=lambda t: t.ts_ms)
            self._tick_index = 0
            
            if not self._ticks:
                self.logger.warning("no_ticks_loaded")
                return
            
            # Set time range
            self._progress.start_time_ms = start_time_ms or self._ticks[0].ts_ms
            self._progress.end_time_ms = end_time_ms or self._ticks[-1].ts_ms
            self._progress.current_time_ms = self._progress.start_time_ms
            self._progress.ticks_processed = 0
            self._progress.bars_emitted = 0
            
            # Reset clock to start time
            self._clock.seek(self._progress.start_time_ms)
            
            self.logger.info(
                "ticks_loaded",
                count=len(self._ticks),
                start=self._progress.start_time_ms,
                end=self._progress.end_time_ms,
            )
            
            await self._set_state(ReplayState.IDLE)
    
    async def play(self) -> None:
        """Start or resume playback."""
        async with self._lock:
            if self._state == ReplayState.PLAYING:
                return
            
            if self._state == ReplayState.COMPLETED:
                # Reset to beginning
                await self._reset()
            
            self._clock.set_speed(self._config.speed_multiplier)
            await self._set_state(ReplayState.PLAYING)
            
            # Start playback task
            self._playback_task = asyncio.create_task(self._playback_loop())
            
            self.logger.info("playback_started", speed=self._config.speed_multiplier)
    
    async def pause(self) -> None:
        """Pause playback."""
        async with self._lock:
            if self._state != ReplayState.PLAYING:
                return
            
            await self._set_state(ReplayState.PAUSED)
            
            if self._playback_task:
                self._playback_task.cancel()
                try:
                    await self._playback_task
                except asyncio.CancelledError:
                    pass
            
            self.logger.info("playback_paused")
    
    async def stop(self) -> None:
        """Stop playback and reset."""
        async with self._lock:
            if self._playback_task:
                self._playback_task.cancel()
                try:
                    await self._playback_task
                except asyncio.CancelledError:
                    pass
            
            await self._reset()
            await self._set_state(ReplayState.IDLE)
            
            self.logger.info("playback_stopped")
    
    async def seek(self, target_time_ms: int) -> None:
        """
        Seek to a specific timestamp.
        
        Args:
            target_time_ms: Target time to seek to
        """
        was_playing = self._state == ReplayState.PLAYING
        
        async with self._lock:
            # Pause if playing
            if was_playing:
                await self._set_state(ReplayState.SEEKING)
                if self._playback_task:
                    self._playback_task.cancel()
                    try:
                        await self._playback_task
                    except asyncio.CancelledError:
                        pass
            
            # Find tick index at target time
            self._tick_index = self._find_tick_index(target_time_ms)
            
            # Update clock and progress
            self._clock.seek(target_time_ms)
            self._progress.current_time_ms = target_time_ms
            
            # Process ticks up to this point for bar state
            await self._process_ticks_to_time(target_time_ms)
            
            self.logger.info("seeked", target=target_time_ms, tick_index=self._tick_index)
        
        # Resume if was playing
        if was_playing:
            await self.play()
        else:
            await self._set_state(ReplayState.PAUSED)
    
    async def step_forward(self, ticks: int = 1) -> None:
        """
        Step forward by N ticks.
        
        Args:
            ticks: Number of ticks to advance
        """
        async with self._lock:
            for _ in range(ticks):
                if self._tick_index >= len(self._ticks):
                    break
                
                tick = self._ticks[self._tick_index]
                self._clock.seek(tick.ts_ms)
                await self._lifecycle_manager.process_tick(tick)
                
                self._tick_index += 1
                self._progress.ticks_processed += 1
                self._progress.current_time_ms = tick.ts_ms
            
            await self._emit_progress()
    
    async def set_speed(self, multiplier: float) -> None:
        """Set playback speed."""
        self._config.speed_multiplier = multiplier
        self._clock.set_speed(multiplier)
        self.logger.info("speed_changed", speed=multiplier)
    
    async def _playback_loop(self) -> None:
        """Main playback loop."""
        import time
        
        last_real_time = time.time()
        
        try:
            while self._state == ReplayState.PLAYING:
                if self._tick_index >= len(self._ticks):
                    # Reached end
                    await self._set_state(ReplayState.COMPLETED)
                    self.logger.info("playback_completed")
                    break
                
                tick = self._ticks[self._tick_index]
                current_clock = self._clock.now()
                
                # Wait until clock reaches tick time
                if tick.ts_ms > current_clock:
                    # Calculate wait time based on speed
                    wait_ms = (tick.ts_ms - current_clock) / self._config.speed_multiplier
                    await asyncio.sleep(wait_ms / 1000)
                
                # Advance clock and process tick
                self._clock.seek(tick.ts_ms)
                await self._lifecycle_manager.process_tick(tick)
                
                # Update progress
                self._tick_index += 1
                self._progress.ticks_processed += 1
                self._progress.current_time_ms = tick.ts_ms
                
                # Track real elapsed time
                now = time.time()
                self._progress.elapsed_real_ms = int((now - last_real_time) * 1000)
                
                await self._emit_progress()
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.logger.error("playback_error", error=str(e))
            await self._set_state(ReplayState.ERROR)
    
    async def _process_ticks_to_time(self, target_time_ms: int) -> None:
        """Process all ticks up to target time for bar state."""
        # This is used for seek to reconstruct bar state
        # In a real implementation, we might load bars from storage instead
        pass
    
    def _find_tick_index(self, target_time_ms: int) -> int:
        """Binary search for tick index at target time."""
        if not self._ticks:
            return 0
        
        left, right = 0, len(self._ticks) - 1
        
        while left < right:
            mid = (left + right) // 2
            if self._ticks[mid].ts_ms < target_time_ms:
                left = mid + 1
            else:
                right = mid
        
        return left
    
    async def _reset(self) -> None:
        """Reset replay state."""
        self._tick_index = 0
        self._progress.current_time_ms = self._progress.start_time_ms
        self._progress.ticks_processed = 0
        self._progress.bars_emitted = 0
        self._progress.elapsed_real_ms = 0
        
        if self._progress.start_time_ms > 0:
            self._clock.seek(self._progress.start_time_ms)
    
    async def _set_state(self, new_state: ReplayState) -> None:
        """Update state and notify callbacks."""
        if self._state == new_state:
            return
        
        old_state = self._state
        self._state = new_state
        
        self.logger.debug("state_changed", old=old_state.value, new=new_state.value)
        
        for callback in self._state_callbacks:
            try:
                await callback(new_state)
            except Exception as e:
                self.logger.error("state_callback_error", error=str(e))
    
    async def _emit_progress(self) -> None:
        """Emit progress to callbacks."""
        for callback in self._progress_callbacks:
            try:
                await callback(self._progress)
            except Exception as e:
                self.logger.error("progress_callback_error", error=str(e))
    
    def get_status(self) -> dict:
        """Get current replay status."""
        return {
            "state": self._state.value,
            "progress": {
                "current_time_ms": self._progress.current_time_ms,
                "start_time_ms": self._progress.start_time_ms,
                "end_time_ms": self._progress.end_time_ms,
                "progress_pct": self._progress.progress_pct,
                "ticks_processed": self._progress.ticks_processed,
                "bars_emitted": self._progress.bars_emitted,
            },
            "config": {
                "speed_multiplier": self._config.speed_multiplier,
                "emit_forming_bars": self._config.emit_forming_bars,
                "emit_confirmed_bars": self._config.emit_confirmed_bars,
            },
            "ticks_loaded": len(self._ticks),
            "tick_index": self._tick_index,
        }


class ReplaySession:
    """
    A complete replay session with all components.
    
    Bundles:
    - Clock
    - Lifecycle Manager
    - Replay Controller
    """
    
    def __init__(
        self,
        start_time_ms: int,
        timeframes: Optional[List[str]] = None,
        speed_multiplier: float = 1.0,
    ):
        """
        Create a new replay session.
        
        Args:
            start_time_ms: Starting timestamp
            timeframes: Timeframes to track
            speed_multiplier: Initial playback speed
        """
        self._clock = MarketClock(
            mode=ClockMode.VIRTUAL,
            start_time_ms=start_time_ms,
        )
        
        self._lifecycle_manager = BarLifecycleManager(
            clock=self._clock,
            timeframes=timeframes,
        )
        
        config = ReplayConfig(speed_multiplier=speed_multiplier)
        
        self._controller = ReplayController(
            clock=self._clock,
            lifecycle_manager=self._lifecycle_manager,
            config=config,
        )
        
        self.logger = logger.bind(component="replay_session")
    
    @property
    def clock(self) -> MarketClock:
        """Get session clock."""
        return self._clock
    
    @property
    def controller(self) -> ReplayController:
        """Get replay controller."""
        return self._controller
    
    @property
    def lifecycle_manager(self) -> BarLifecycleManager:
        """Get lifecycle manager."""
        return self._lifecycle_manager
    
    async def load_and_play(
        self,
        ticks: List[CanonicalTick],
    ) -> None:
        """Load ticks and start playback."""
        await self._controller.load_ticks(ticks)
        await self._controller.play()
    
    async def stop(self) -> None:
        """Stop the session."""
        await self._controller.stop()
        await self._lifecycle_manager.stop()
