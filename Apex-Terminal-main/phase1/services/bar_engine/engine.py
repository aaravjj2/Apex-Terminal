"""
Core Bar Engine for tick aggregation and bar lifecycle management.
"""

import asyncio
from collections import defaultdict
from typing import Callable, Awaitable, Optional, Dict, List, Tuple
import structlog

from .session import SessionCalendar, NYSESessionCalendar
from .bar_index import BarIndexCalculator, MultiTimeframeIndexer
from ..models import CanonicalTick, Bar, BarState, BarMessage
from ..config import get_settings, TIMEFRAME_HIERARCHY, timeframe_to_ms


logger = structlog.get_logger()


class BarEngine:
    """
    Core bar aggregation engine.
    
    Responsibilities:
    - Receive normalized ticks
    - Update forming bars for all configured timeframes
    - Transition bars through lifecycle states
    - Emit bar updates via callbacks
    - Persist confirmed bars
    
    Key invariants:
    - Deterministic: same input → same output
    - No fabrication: missing ticks = missing bars
    - Lifecycle states: FORMING → CONFIRMED → HISTORICAL
    """
    
    def __init__(
        self,
        timeframes: Optional[List[str]] = None,
        calendar: Optional[SessionCalendar] = None,
        persist_callback: Optional[Callable[[Bar], Awaitable[None]]] = None,
    ):
        """
        Initialize Bar Engine.
        
        Args:
            timeframes: List of timeframes to aggregate
            calendar: Session calendar for trading hours
            persist_callback: Async callback to persist confirmed bars
        """
        settings = get_settings()
        self.timeframes = timeframes or settings.timeframes_list
        self.calendar = calendar or NYSESessionCalendar(
            include_extended_hours=settings.enable_extended_hours
        )
        self._persist_callback = persist_callback
        
        # Forming bars: {symbol: {timeframe: Bar}}
        self._forming_bars: Dict[str, Dict[str, Bar]] = defaultdict(dict)
        
        # Bar index calculators per symbol
        self._indexers: Dict[str, MultiTimeframeIndexer] = {}
        
        # Update callbacks
        self._bar_update_callbacks: List[Callable[[Bar], Awaitable[None]]] = []
        self._bar_confirmed_callbacks: List[Callable[[Bar], Awaitable[None]]] = []
        
        # Lock for thread-safe updates
        self._lock = asyncio.Lock()
        
        # Stats
        self._stats = {
            "ticks_processed": 0,
            "bars_formed": 0,
            "bars_confirmed": 0,
        }
        
        self.logger = logger.bind(component="bar_engine")
    
    def register_update_callback(
        self, 
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar updates (forming state)."""
        self._bar_update_callbacks.append(callback)
    
    def register_confirmed_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar confirmations."""
        self._bar_confirmed_callbacks.append(callback)
    
    def set_persist_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Set callback for persisting confirmed bars."""
        self._persist_callback = callback
    
    def _get_indexer(self, symbol: str) -> MultiTimeframeIndexer:
        """Get or create indexer for a symbol."""
        if symbol not in self._indexers:
            self._indexers[symbol] = MultiTimeframeIndexer(
                symbol=symbol,
                timeframes=self.timeframes,
                calendar=self.calendar,
            )
        return self._indexers[symbol]
    
    async def process_tick(self, tick: CanonicalTick) -> List[Bar]:
        """
        Process a tick through the bar engine.
        
        Returns:
            List of bars that were updated
        """
        async with self._lock:
            self._stats["ticks_processed"] += 1
            
            symbol = tick.symbol
            ts_ms = tick.ts_ms
            
            updated_bars = []
            indexer = self._get_indexer(symbol)
            
            for timeframe in self.timeframes:
                # Get calculator for this timeframe
                calc = indexer.get_calculator(timeframe)
                
                try:
                    # Calculate bar index and interval
                    bar_index = calc.calculate_bar_index(ts_ms)
                    interval_start, interval_end = calc.get_interval_bounds(ts_ms)
                    
                    # Get or create forming bar
                    bar = await self._get_or_create_bar(
                        symbol=symbol,
                        timeframe=timeframe,
                        bar_index=bar_index,
                        interval_start=interval_start,
                        interval_end=interval_end,
                    )
                    
                    # Check if tick belongs to current bar
                    if bar.bar_index == bar_index:
                        # Update bar with tick
                        bar.update_with_tick(tick)
                        updated_bars.append(bar)
                        
                        # Emit update
                        await self._emit_update(bar)
                    else:
                        # Tick belongs to a new bar - confirm old and create new
                        await self._confirm_bar(symbol, timeframe, bar)
                        
                        # Create new bar
                        new_bar = await self._create_bar(
                            symbol=symbol,
                            timeframe=timeframe,
                            bar_index=bar_index,
                            interval_start=interval_start,
                            interval_end=interval_end,
                        )
                        new_bar.update_with_tick(tick)
                        self._forming_bars[symbol][timeframe] = new_bar
                        updated_bars.append(new_bar)
                        
                        await self._emit_update(new_bar)
                        
                except Exception as e:
                    self.logger.error(
                        "tick_processing_error",
                        symbol=symbol,
                        timeframe=timeframe,
                        error=str(e),
                    )
            
            return updated_bars
    
    async def _get_or_create_bar(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
        interval_start: int,
        interval_end: int,
    ) -> Bar:
        """Get existing forming bar or create new one."""
        if timeframe in self._forming_bars[symbol]:
            bar = self._forming_bars[symbol][timeframe]
            
            # Check if it's the same bar
            if bar.bar_index == bar_index:
                return bar
            
            # Different bar - need to confirm old one first
            await self._confirm_bar(symbol, timeframe, bar)
        
        # Create new bar
        return await self._create_bar(
            symbol, timeframe, bar_index, interval_start, interval_end
        )
    
    async def _create_bar(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
        interval_start: int,
        interval_end: int,
    ) -> Bar:
        """Create a new forming bar."""
        bar = Bar(
            symbol=symbol,
            timeframe=timeframe,
            bar_index=bar_index,
            ts_start_ms=interval_start,
            ts_end_ms=interval_end,
            state=BarState.FORMING,
        )
        
        self._forming_bars[symbol][timeframe] = bar
        self._stats["bars_formed"] += 1
        
        self.logger.debug(
            "bar_created",
            symbol=symbol,
            timeframe=timeframe,
            bar_index=bar_index,
        )
        
        return bar
    
    async def _confirm_bar(self, symbol: str, timeframe: str, bar: Bar) -> None:
        """Confirm a bar, transitioning it to CONFIRMED state."""
        if bar.state != BarState.FORMING:
            return
        
        # Skip empty bars (no ticks received)
        if bar.is_empty():
            self.logger.debug(
                "empty_bar_skipped",
                symbol=symbol,
                timeframe=timeframe,
                bar_index=bar.bar_index,
            )
            return
        
        bar.confirm()
        self._stats["bars_confirmed"] += 1
        
        self.logger.info(
            "bar_confirmed",
            symbol=symbol,
            timeframe=timeframe,
            bar_index=bar.bar_index,
            hash=bar.bar_hash,
        )
        
        # Persist
        if self._persist_callback:
            try:
                await self._persist_callback(bar)
            except Exception as e:
                self.logger.error("persist_error", error=str(e), bar_index=bar.bar_index)
        
        # Emit confirmation
        await self._emit_confirmed(bar)
    
    async def _emit_update(self, bar: Bar) -> None:
        """Emit bar update to callbacks."""
        for callback in self._bar_update_callbacks:
            try:
                await callback(bar)
            except Exception as e:
                self.logger.error("update_callback_error", error=str(e))
    
    async def _emit_confirmed(self, bar: Bar) -> None:
        """Emit bar confirmation to callbacks."""
        for callback in self._bar_confirmed_callbacks:
            try:
                await callback(bar)
            except Exception as e:
                self.logger.error("confirmed_callback_error", error=str(e))
    
    async def force_confirm_all(self) -> List[Bar]:
        """
        Force confirm all forming bars.
        Used at end of session or data ingestion.
        """
        confirmed = []
        
        async with self._lock:
            for symbol, timeframe_bars in list(self._forming_bars.items()):
                for timeframe, bar in list(timeframe_bars.items()):
                    if bar.state == BarState.FORMING and not bar.is_empty():
                        await self._confirm_bar(symbol, timeframe, bar)
                        confirmed.append(bar)
        
        return confirmed
    
    def get_forming_bar(
        self,
        symbol: str,
        timeframe: str,
    ) -> Optional[Bar]:
        """Get the current forming bar for a symbol/timeframe."""
        return self._forming_bars.get(symbol, {}).get(timeframe)
    
    def get_all_forming_bars(self) -> Dict[str, Dict[str, Bar]]:
        """Get all forming bars."""
        return dict(self._forming_bars)
    
    def get_stats(self) -> dict:
        """Get engine statistics."""
        return self._stats.copy()
    
    async def check_timeframe_boundaries(self, current_ts_ms: int) -> List[Bar]:
        """
        Check for bars that should be confirmed based on current time.
        Called periodically to ensure bars are confirmed even without new ticks.
        """
        confirmed = []
        
        async with self._lock:
            for symbol, timeframe_bars in list(self._forming_bars.items()):
                for timeframe, bar in list(timeframe_bars.items()):
                    if bar.state != BarState.FORMING:
                        continue
                    
                    # Check if current time is past bar end
                    if current_ts_ms >= bar.ts_end_ms and not bar.is_empty():
                        await self._confirm_bar(symbol, timeframe, bar)
                        confirmed.append(bar)
        
        return confirmed


class MultiSymbolBarEngine:
    """
    Manages bar engines for multiple symbols.
    Provides a unified interface for multi-symbol operations.
    """
    
    def __init__(
        self,
        symbols: List[str],
        timeframes: Optional[List[str]] = None,
        calendar: Optional[SessionCalendar] = None,
    ):
        """
        Initialize multi-symbol engine.
        
        Args:
            symbols: List of symbols to track
            timeframes: List of timeframes
            calendar: Shared session calendar
        """
        self.symbols = symbols
        self.timeframes = timeframes or get_settings().timeframes_list
        self.calendar = calendar or NYSESessionCalendar()
        
        # Single engine handles all symbols
        self._engine = BarEngine(
            timeframes=self.timeframes,
            calendar=self.calendar,
        )
        
        self.logger = logger.bind(component="multi_symbol_engine")
    
    async def process_tick(self, tick: CanonicalTick) -> List[Bar]:
        """Process tick through the appropriate engine."""
        return await self._engine.process_tick(tick)
    
    def register_update_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar updates."""
        self._engine.register_update_callback(callback)
    
    def register_confirmed_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Register callback for bar confirmations."""
        self._engine.register_confirmed_callback(callback)
    
    def set_persist_callback(
        self,
        callback: Callable[[Bar], Awaitable[None]]
    ) -> None:
        """Set persist callback."""
        self._engine.set_persist_callback(callback)
    
    async def force_confirm_all(self) -> List[Bar]:
        """Force confirm all forming bars."""
        return await self._engine.force_confirm_all()
    
    def get_forming_bar(self, symbol: str, timeframe: str) -> Optional[Bar]:
        """Get forming bar for symbol/timeframe."""
        return self._engine.get_forming_bar(symbol, timeframe)
    
    def get_stats(self) -> dict:
        """Get combined statistics."""
        return self._engine.get_stats()
