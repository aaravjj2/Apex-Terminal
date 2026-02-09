"""
Deterministic Tick Replayer - Replay tick data deterministically.

Provides:
- Deterministic tick replay from files
- Time-scaled playback
- Tick injection for testing
- Reproducible market simulation
"""

import asyncio
import csv
from pathlib import Path
from typing import Optional, List, Dict, Callable, Awaitable, Iterator, AsyncIterator
from dataclasses import dataclass, field
import structlog

from ..clock.market_clock import MarketClock, ClockMode
from ..models import CanonicalTick, TickSource


logger = structlog.get_logger()


@dataclass
class TickReplayConfig:
    """Configuration for tick replay."""
    speed_multiplier: float = 1.0
    loop: bool = False             # Loop back to start when done
    skip_gaps: bool = True         # Skip large time gaps
    max_gap_ms: int = 60000        # Maximum gap before skipping (1 min)
    batch_size: int = 100          # Ticks per batch for callback


class TickSource:
    """
    Base class for tick data sources.
    Provides an iterator over ticks.
    """
    
    async def __aiter__(self) -> AsyncIterator[CanonicalTick]:
        raise NotImplementedError
    
    @property
    def tick_count(self) -> int:
        raise NotImplementedError


class CSVTickSource(TickSource):
    """
    Loads ticks from CSV file.
    
    Expected CSV format:
    source,symbol,ts_ms,price,size
    """
    
    def __init__(self, file_path: Path):
        """
        Initialize CSV tick source.
        
        Args:
            file_path: Path to CSV file
        """
        self._file_path = file_path
        self._ticks: List[CanonicalTick] = []
        self._loaded = False
        
        self.logger = logger.bind(component="csv_tick_source", file=str(file_path))
    
    def load(self) -> None:
        """Load ticks from file."""
        self._ticks = []
        
        with open(self._file_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    tick = CanonicalTick(
                        source=row.get('source', 'mock'),
                        symbol=row['symbol'],
                        ts_ms=int(row['ts_ms']),
                        price=float(row['price']),
                        size=float(row.get('size', 0)),
                    )
                    self._ticks.append(tick)
                except (KeyError, ValueError) as e:
                    self.logger.warning("parse_error", error=str(e), row=row)
        
        # Sort by timestamp
        self._ticks.sort(key=lambda t: t.ts_ms)
        self._loaded = True
        
        self.logger.info("ticks_loaded", count=len(self._ticks))
    
    async def __aiter__(self) -> AsyncIterator[CanonicalTick]:
        if not self._loaded:
            self.load()
        
        for tick in self._ticks:
            yield tick
    
    @property
    def tick_count(self) -> int:
        return len(self._ticks)


class MemoryTickSource(TickSource):
    """Tick source from in-memory list."""
    
    def __init__(self, ticks: List[CanonicalTick]):
        """
        Initialize memory tick source.
        
        Args:
            ticks: List of ticks
        """
        self._ticks = sorted(ticks, key=lambda t: t.ts_ms)
    
    async def __aiter__(self) -> AsyncIterator[CanonicalTick]:
        for tick in self._ticks:
            yield tick
    
    @property
    def tick_count(self) -> int:
        return len(self._ticks)


class DeterministicTickReplayer:
    """
    Replays ticks deterministically with clock synchronization.
    
    Key features:
    - Deterministic: Same input always produces same output
    - Clock-synchronized playback
    - Speed control
    - Gap handling
    """
    
    def __init__(
        self,
        clock: MarketClock,
        config: Optional[TickReplayConfig] = None,
    ):
        """
        Initialize tick replayer.
        
        Args:
            clock: MarketClock (must be VIRTUAL mode)
            config: Replay configuration
        """
        if clock.mode != ClockMode.VIRTUAL:
            raise ValueError("DeterministicTickReplayer requires VIRTUAL mode clock")
        
        self._clock = clock
        self._config = config or TickReplayConfig()
        
        # Tick source
        self._source: Optional[TickSource] = None
        
        # Callbacks
        self._tick_callbacks: List[Callable[[CanonicalTick], Awaitable[None]]] = []
        self._batch_callbacks: List[Callable[[List[CanonicalTick]], Awaitable[None]]] = []
        
        # State
        self._running = False
        self._paused = False
        self._ticks_emitted = 0
        
        # Replay task
        self._replay_task: Optional[asyncio.Task] = None
        
        self.logger = logger.bind(component="tick_replayer")
    
    @property
    def clock(self) -> MarketClock:
        return self._clock
    
    @property
    def is_running(self) -> bool:
        return self._running
    
    def set_source(self, source: TickSource) -> None:
        """Set tick data source."""
        self._source = source
    
    def register_tick_callback(
        self,
        callback: Callable[[CanonicalTick], Awaitable[None]]
    ) -> None:
        """Register callback for individual ticks."""
        self._tick_callbacks.append(callback)
    
    def register_batch_callback(
        self,
        callback: Callable[[List[CanonicalTick]], Awaitable[None]]
    ) -> None:
        """Register callback for tick batches."""
        self._batch_callbacks.append(callback)
    
    async def start(self) -> None:
        """Start replay."""
        if self._running or not self._source:
            return
        
        self._running = True
        self._paused = False
        self._ticks_emitted = 0
        
        self._replay_task = asyncio.create_task(self._replay_loop())
        self.logger.info("replay_started")
    
    async def stop(self) -> None:
        """Stop replay."""
        self._running = False
        
        if self._replay_task:
            self._replay_task.cancel()
            try:
                await self._replay_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("replay_stopped", ticks_emitted=self._ticks_emitted)
    
    async def pause(self) -> None:
        """Pause replay."""
        self._paused = True
        self._clock.freeze()
        self.logger.info("replay_paused")
    
    async def resume(self) -> None:
        """Resume replay."""
        self._paused = False
        self._clock.resume()
        self.logger.info("replay_resumed")
    
    async def set_speed(self, multiplier: float) -> None:
        """Set replay speed."""
        self._config.speed_multiplier = multiplier
        self._clock.set_speed(multiplier)
    
    async def _replay_loop(self) -> None:
        """Main replay loop."""
        try:
            batch: List[CanonicalTick] = []
            prev_ts: Optional[int] = None
            
            async for tick in self._source:
                if not self._running:
                    break
                
                # Wait while paused
                while self._paused:
                    await asyncio.sleep(0.01)
                    if not self._running:
                        break
                
                # Handle timing
                if prev_ts is not None:
                    gap_ms = tick.ts_ms - prev_ts
                    
                    # Skip large gaps if configured
                    if self._config.skip_gaps and gap_ms > self._config.max_gap_ms:
                        self._clock.seek(tick.ts_ms)
                    else:
                        # Wait for appropriate time
                        wait_ms = gap_ms / self._config.speed_multiplier
                        if wait_ms > 0:
                            await asyncio.sleep(wait_ms / 1000)
                        self._clock.advance(gap_ms)
                else:
                    # First tick - set clock
                    self._clock.seek(tick.ts_ms)
                
                prev_ts = tick.ts_ms
                
                # Emit tick
                await self._emit_tick(tick)
                
                # Batch handling
                batch.append(tick)
                if len(batch) >= self._config.batch_size:
                    await self._emit_batch(batch)
                    batch = []
            
            # Emit remaining batch
            if batch:
                await self._emit_batch(batch)
            
            # Handle loop
            if self._config.loop and self._running:
                await self._replay_loop()
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.logger.error("replay_error", error=str(e))
    
    async def _emit_tick(self, tick: CanonicalTick) -> None:
        """Emit a single tick."""
        self._ticks_emitted += 1
        
        for callback in self._tick_callbacks:
            try:
                await callback(tick)
            except Exception as e:
                self.logger.error("tick_callback_error", error=str(e))
    
    async def _emit_batch(self, batch: List[CanonicalTick]) -> None:
        """Emit a batch of ticks."""
        for callback in self._batch_callbacks:
            try:
                await callback(batch)
            except Exception as e:
                self.logger.error("batch_callback_error", error=str(e))
    
    def get_stats(self) -> dict:
        """Get replayer statistics."""
        return {
            "running": self._running,
            "paused": self._paused,
            "ticks_emitted": self._ticks_emitted,
            "speed": self._config.speed_multiplier,
            "source_ticks": self._source.tick_count if self._source else 0,
        }


class TickGenerator:
    """
    Generates synthetic ticks for testing.
    
    Creates realistic-looking tick data based on parameters.
    """
    
    def __init__(
        self,
        symbol: str,
        base_price: float = 100.0,
        volatility: float = 0.001,
        seed: Optional[int] = None,
    ):
        """
        Initialize tick generator.
        
        Args:
            symbol: Symbol for generated ticks
            base_price: Starting price
            volatility: Price volatility (per tick)
            seed: Random seed for reproducibility
        """
        self._symbol = symbol
        self._base_price = base_price
        self._volatility = volatility
        
        import random
        self._random = random.Random(seed)
        
        self._current_price = base_price
        
        self.logger = logger.bind(component="tick_generator", symbol=symbol)
    
    def generate(
        self,
        count: int,
        start_ms: int,
        interval_ms: int = 100,
    ) -> List[CanonicalTick]:
        """
        Generate ticks.
        
        Args:
            count: Number of ticks to generate
            start_ms: Starting timestamp
            interval_ms: Time between ticks
            
        Returns:
            List of generated ticks
        """
        from services.models import TickSource as TickSourceEnum
        
        ticks = []
        
        for i in range(count):
            # Random walk price
            change = self._random.gauss(0, self._volatility * self._current_price)
            self._current_price = max(0.01, self._current_price + change)
            
            tick = CanonicalTick(
                source=TickSourceEnum.MOCK,
                symbol=self._symbol,
                ts_ms=start_ms + i * interval_ms,
                price=round(self._current_price, 2),
                size=round(self._random.uniform(1, 100), 2),
            )
            ticks.append(tick)
        
        self.logger.info("ticks_generated", count=count)
        return ticks
    
    def reset(self) -> None:
        """Reset generator state."""
        self._current_price = self._base_price


def create_test_ticks(
    symbol: str = "AAPL",
    count: int = 100,
    start_ms: int = 1704067200000,
    interval_ms: int = 100,
    seed: int = 42,
) -> List[CanonicalTick]:
    """
    Create test ticks for unit testing.
    
    Args:
        symbol: Symbol
        count: Number of ticks
        start_ms: Start time
        interval_ms: Interval between ticks
        seed: Random seed for reproducibility
        
    Returns:
        List of ticks
    """
    generator = TickGenerator(symbol=symbol, base_price=100.0, seed=seed)
    return generator.generate(count, start_ms, interval_ms)
