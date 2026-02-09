"""
Bar Lifecycle Manager - Coordinates bar state transitions with MarketClock.

Integrates the BarEngine with MarketClock for deterministic bar lifecycle:
- Scheduled bar confirmations at timeframe boundaries
- Clock-aware forming bar management
- Support for both live and replay modes
"""

import asyncio
from typing import Optional, Dict, List, Callable, Awaitable, Set
from dataclasses import dataclass, field
import structlog

from ..clock.market_clock import MarketClock, ClockMode, get_clock
from ..models import Bar, BarState, CanonicalTick
from ..config import get_settings, timeframe_to_ms


logger = structlog.get_logger()


@dataclass
class BarLifecycleConfig:
    """Configuration for bar lifecycle management."""
    confirmation_delay_ms: int = 0  # Delay after boundary before confirming
    emit_empty_bars: bool = False   # Whether to emit bars with no ticks
    auto_confirm_on_new_bar: bool = True  # Confirm old bar when new tick arrives
    boundary_check_interval_ms: int = 100  # How often to check boundaries


class BarLifecycleManager:
    """
    Manages bar lifecycle transitions coordinated with MarketClock.
    
    Key responsibilities:
    - Track forming bars for all symbol/timeframe combinations
    - Schedule bar confirmations at timeframe boundaries
    - Emit bar updates and confirmations via callbacks
    - Support deterministic replay via clock synchronization
    
    Thread-safe for concurrent tick processing.
    """
    
    def __init__(
        self,
        clock: Optional[MarketClock] = None,
        config: Optional[BarLifecycleConfig] = None,
        timeframes: Optional[List[str]] = None,
    ):
        """
        Initialize Bar Lifecycle Manager.
        
        Args:
            clock: MarketClock instance (uses global clock if not provided)
            config: Lifecycle configuration
            timeframes: List of timeframes to manage
        """
        self._clock = clock or get_clock()
        self._config = config or BarLifecycleConfig()
        
        settings = get_settings()
        self._timeframes = timeframes or settings.timeframes_list
        self._timeframe_ms = {tf: timeframe_to_ms(tf) for tf in self._timeframes}
        
        # Forming bars: {(symbol, timeframe): Bar}
        self._forming_bars: Dict[tuple, Bar] = {}
        
        # Pending confirmations: {(symbol, timeframe): scheduled_time_ms}
        self._pending_confirmations: Dict[tuple, int] = {}
        
        # Callbacks
        self._update_callbacks: List[Callable[[Bar], Awaitable[None]]] = []
        self._confirmed_callbacks: List[Callable[[Bar], Awaitable[None]]] = []
        self._persist_callback: Optional[Callable[[Bar], Awaitable[None]]] = None
        
        # Tracking
        self._confirmed_bar_count = 0
        self._update_count = 0
        
        # Async coordination
        self._lock = asyncio.Lock()
        self._boundary_check_task: Optional[asyncio.Task] = None
        self._running = False
        
        self.logger = logger.bind(
            component="bar_lifecycle_manager",
            clock_mode=self._clock.mode.value,
        )
    
    @property
    def clock(self) -> MarketClock:
        """Get the clock instance."""
        return self._clock
    
    @property
    def timeframes(self) -> List[str]:
        """Get managed timeframes."""
        return list(self._timeframes)
    
    def register_update_callback(
        self, 
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar updates (forming state changes)."""
        self._update_callbacks.append(callback)
    
    def register_confirmed_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar confirmations."""
        self._confirmed_callbacks.append(callback)
    
    def set_persist_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Set callback for persisting confirmed bars."""
        self._persist_callback = callback
    
    async def start(self) -> None:
        """Start the lifecycle manager (begins boundary checking)."""
        if self._running:
            return
        
        self._running = True
        self._boundary_check_task = asyncio.create_task(
            self._boundary_check_loop()
        )
        self.logger.info("lifecycle_manager_started")
    
    async def stop(self) -> None:
        """Stop the lifecycle manager."""
        self._running = False
        
        if self._boundary_check_task:
            self._boundary_check_task.cancel()
            try:
                await self._boundary_check_task
            except asyncio.CancelledError:
                pass
        
        # Confirm any remaining forming bars
        await self.force_confirm_all()
        
        self.logger.info(
            "lifecycle_manager_stopped",
            confirmed_bars=self._confirmed_bar_count,
        )
    
    async def process_tick(self, tick: CanonicalTick) -> List[Bar]:
        """
        Process a tick, updating forming bars.
        
        Args:
            tick: Canonical tick to process
            
        Returns:
            List of bars that were updated
        """
        async with self._lock:
            updated_bars = []
            symbol = tick.symbol
            ts_ms = tick.ts_ms
            
            for timeframe in self._timeframes:
                key = (symbol, timeframe)
                tf_ms = self._timeframe_ms[timeframe]
                
                # Calculate bar boundaries
                bar_index = ts_ms // tf_ms
                bar_start = bar_index * tf_ms
                bar_end = bar_start + tf_ms
                
                # Get or create bar
                bar = self._forming_bars.get(key)
                
                if bar is None:
                    # Create new bar
                    bar = self._create_bar(
                        symbol=symbol,
                        timeframe=timeframe,
                        bar_index=bar_index,
                        ts_start=bar_start,
                        ts_end=bar_end,
                    )
                    self._forming_bars[key] = bar
                
                elif bar.bar_index != bar_index:
                    # Tick belongs to new bar - confirm old one first
                    if self._config.auto_confirm_on_new_bar:
                        await self._confirm_bar(key, bar)
                    
                    # Create new bar
                    bar = self._create_bar(
                        symbol=symbol,
                        timeframe=timeframe,
                        bar_index=bar_index,
                        ts_start=bar_start,
                        ts_end=bar_end,
                    )
                    self._forming_bars[key] = bar
                
                # Update bar with tick
                bar.update_with_tick(tick)
                updated_bars.append(bar)
                
                # Schedule confirmation at boundary
                self._schedule_confirmation(key, bar_end)
                
                # Emit update
                await self._emit_update(bar)
            
            self._update_count += len(updated_bars)
            return updated_bars
    
    def _create_bar(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
        ts_start: int,
        ts_end: int,
    ) -> Bar:
        """Create a new forming bar."""
        bar = Bar(
            symbol=symbol,
            timeframe=timeframe,
            bar_index=bar_index,
            ts_start_ms=ts_start,
            ts_end_ms=ts_end,
            state=BarState.FORMING,
        )
        
        self.logger.debug(
            "bar_created",
            symbol=symbol,
            timeframe=timeframe,
            bar_index=bar_index,
        )
        
        return bar
    
    def _schedule_confirmation(self, key: tuple, confirm_at_ms: int) -> None:
        """Schedule a bar for confirmation at the given time."""
        confirm_time = confirm_at_ms + self._config.confirmation_delay_ms
        self._pending_confirmations[key] = confirm_time
    
    async def _confirm_bar(self, key: tuple, bar: Bar) -> None:
        """Confirm a bar and emit callbacks."""
        if bar.state != BarState.FORMING:
            return
        
        # Skip empty bars unless configured otherwise
        if bar.is_empty() and not self._config.emit_empty_bars:
            self.logger.debug(
                "empty_bar_skipped",
                symbol=bar.symbol,
                timeframe=bar.timeframe,
                bar_index=bar.bar_index,
            )
            # Remove from forming bars
            self._forming_bars.pop(key, None)
            self._pending_confirmations.pop(key, None)
            return
        
        bar.confirm()
        self._confirmed_bar_count += 1
        
        self.logger.info(
            "bar_confirmed",
            symbol=bar.symbol,
            timeframe=bar.timeframe,
            bar_index=bar.bar_index,
            tick_count=bar.tick_count,
            hash=bar.bar_hash,
        )
        
        # Persist
        if self._persist_callback:
            try:
                await self._persist_callback(bar)
            except Exception as e:
                self.logger.error("persist_error", error=str(e))
        
        # Emit confirmation
        await self._emit_confirmed(bar)
        
        # Remove from forming bars and pending confirmations
        self._forming_bars.pop(key, None)
        self._pending_confirmations.pop(key, None)
    
    async def _emit_update(self, bar: Bar) -> None:
        """Emit bar update to callbacks."""
        for callback in self._update_callbacks:
            try:
                await callback(bar)
            except Exception as e:
                self.logger.error("update_callback_error", error=str(e))
    
    async def _emit_confirmed(self, bar: Bar) -> None:
        """Emit bar confirmation to callbacks."""
        for callback in self._confirmed_callbacks:
            try:
                await callback(bar)
            except Exception as e:
                self.logger.error("confirmed_callback_error", error=str(e))
    
    async def _boundary_check_loop(self) -> None:
        """Periodically check for bars that need confirmation."""
        while self._running:
            try:
                await asyncio.sleep(
                    self._config.boundary_check_interval_ms / 1000
                )
                await self.check_boundaries()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("boundary_check_error", error=str(e))
    
    async def check_boundaries(self) -> List[Bar]:
        """
        Check for bars that should be confirmed based on current clock time.
        
        Returns:
            List of bars that were confirmed
        """
        async with self._lock:
            current_time = self._clock.now()
            confirmed_bars = []
            
            # Find bars past their confirmation time
            keys_to_confirm = [
                key for key, confirm_time in self._pending_confirmations.items()
                if current_time >= confirm_time
            ]
            
            for key in keys_to_confirm:
                bar = self._forming_bars.get(key)
                if bar:
                    await self._confirm_bar(key, bar)
                    confirmed_bars.append(bar)
            
            return confirmed_bars
    
    async def force_confirm_all(self) -> List[Bar]:
        """
        Force confirm all forming bars.
        Used at end of session or data ingestion.
        
        Returns:
            List of bars that were confirmed
        """
        async with self._lock:
            confirmed_bars = []
            
            for key, bar in list(self._forming_bars.items()):
                if bar.state == BarState.FORMING:
                    await self._confirm_bar(key, bar)
                    confirmed_bars.append(bar)
            
            return confirmed_bars
    
    def get_forming_bar(
        self,
        symbol: str,
        timeframe: str,
    ) -> Optional[Bar]:
        """Get the current forming bar for a symbol/timeframe."""
        return self._forming_bars.get((symbol, timeframe))
    
    def get_all_forming_bars(self) -> Dict[tuple, Bar]:
        """Get all forming bars."""
        return dict(self._forming_bars)
    
    def get_stats(self) -> dict:
        """Get manager statistics."""
        return {
            "forming_bars": len(self._forming_bars),
            "pending_confirmations": len(self._pending_confirmations),
            "confirmed_bar_count": self._confirmed_bar_count,
            "update_count": self._update_count,
            "running": self._running,
            "clock_mode": self._clock.mode.value,
            "current_time": self._clock.now(),
        }
    
    async def sync_to_time(self, target_ms: int) -> List[Bar]:
        """
        Advance clock to target time and confirm due bars.
        Only valid in VIRTUAL clock mode.
        
        Args:
            target_ms: Target time to sync to
            
        Returns:
            List of bars confirmed during sync
        """
        if self._clock.mode != ClockMode.VIRTUAL:
            raise RuntimeError("sync_to_time only valid in VIRTUAL clock mode")
        
        self._clock.seek(target_ms)
        return await self.check_boundaries()
