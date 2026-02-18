"""
Tick normalizer with deduplication.
Converts raw ticks from various sources to canonical format.
"""

import asyncio
from collections import OrderedDict
from typing import Callable, Awaitable, Optional
import structlog

from ..models import RawTick, CanonicalTick, TickSource


logger = structlog.get_logger()


class TickNormalizer:
    """
    Normalizes raw ticks to canonical format with deduplication.
    
    Features:
    - Converts source-specific tick formats to canonical schema
    - Deduplicates ticks by hash (source + ts + price + size)
    - Ensures monotonic ordering per source
    - Emits normalized ticks to registered callbacks
    """
    
    def __init__(
        self,
        dedup_window_size: int = 100000,
        enforce_monotonic: bool = True,
    ):
        """
        Initialize normalizer.
        
        Args:
            dedup_window_size: Number of tick hashes to remember for dedup
            enforce_monotonic: Reject out-of-order ticks per source
        """
        self.dedup_window_size = dedup_window_size
        self.enforce_monotonic = enforce_monotonic
        
        # Deduplication cache (LRU)
        self._seen_hashes: OrderedDict[str, bool] = OrderedDict()
        
        # Last timestamp per source for monotonic check
        self._last_ts_per_source: dict[str, int] = {}
        
        # Callbacks for normalized ticks
        self._callbacks: list[Callable[[CanonicalTick], Awaitable[None]]] = []
        
        # Stats
        self._stats = {
            "total_received": 0,
            "total_normalized": 0,
            "duplicates_dropped": 0,
            "out_of_order_dropped": 0,
        }
        
        self.logger = logger.bind(component="normalizer")
    
    def register_callback(self, callback: Callable[[CanonicalTick], Awaitable[None]]) -> None:
        """Register callback for normalized ticks."""
        self._callbacks.append(callback)
    
    def unregister_callback(self, callback: Callable[[CanonicalTick], Awaitable[None]]) -> None:
        """Unregister a callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    async def process_tick(self, raw_tick: RawTick) -> Optional[CanonicalTick]:
        """
        Process a raw tick through normalization pipeline.
        
        Returns:
            CanonicalTick if valid and unique, None if dropped
        """
        self._stats["total_received"] += 1
        
        # Normalize to canonical format
        try:
            canonical = self._normalize(raw_tick)
        except Exception as e:
            self.logger.warning("normalization_error", error=str(e), tick=raw_tick.model_dump())
            return None
        
        # Check for duplicates
        if self._is_duplicate(canonical):
            self._stats["duplicates_dropped"] += 1
            return None
        
        # Check monotonic ordering
        if self.enforce_monotonic and not self._is_monotonic(canonical):
            self._stats["out_of_order_dropped"] += 1
            self.logger.debug("out_of_order_tick", 
                            tick_ts=canonical.ts_ms,
                            source=canonical.source.value)
            return None
        
        # Update tracking
        self._record_tick(canonical)
        self._stats["total_normalized"] += 1
        
        # Emit to callbacks
        await self._emit_tick(canonical)
        
        return canonical
    
    def _normalize(self, raw: RawTick) -> CanonicalTick:
        """Convert raw tick to canonical format."""
        # Normalize source string and map to enum
        src = (raw.source or "").lower()

        if "alpaca" in src:
            source = TickSource.ALPACA
        else:
            source_map = {
                "mock": TickSource.MOCK,
                "finnhub": TickSource.FINNHUB,
                "alpaca": TickSource.ALPACA,
                "yfinance": TickSource.YFINANCE,
            }
            source = source_map.get(src, TickSource.MOCK)

        # Validate timestamp
        if not isinstance(raw.ts_ms, int) or raw.ts_ms <= 0:
            raise ValueError("invalid timestamp: ts_ms must be a positive integer")

        return CanonicalTick(
            source=source,
            symbol=(raw.symbol or "").upper(),  # Normalize to uppercase
            ts_ms=raw.ts_ms,
            price=raw.price,
            size=raw.size or 0.0,
        )
    
    def _is_duplicate(self, tick: CanonicalTick) -> bool:
        """Check if tick is a duplicate."""
        tick_hash = tick.tick_hash
        
        if tick_hash in self._seen_hashes:
            return True
        
        return False
    
    def _is_monotonic(self, tick: CanonicalTick) -> bool:
        """Check if tick maintains monotonic ordering for its source."""
        source_key = f"{tick.source.value}:{tick.symbol}"
        last_ts = self._last_ts_per_source.get(source_key, 0)
        
        return tick.ts_ms >= last_ts
    
    def _record_tick(self, tick: CanonicalTick) -> None:
        """Record tick for dedup and monotonic tracking."""
        tick_hash = tick.tick_hash
        
        # Add to dedup cache
        self._seen_hashes[tick_hash] = True
        
        # Trim cache if needed (LRU eviction)
        while len(self._seen_hashes) > self.dedup_window_size:
            self._seen_hashes.popitem(last=False)
        
        # Update last timestamp
        source_key = f"{tick.source.value}:{tick.symbol}"
        self._last_ts_per_source[source_key] = tick.ts_ms
    
    async def _emit_tick(self, tick: CanonicalTick) -> None:
        """Emit tick to all registered callbacks."""
        for callback in self._callbacks:
            try:
                await callback(tick)
            except Exception as e:
                self.logger.error("callback_error", error=str(e))
    
    def get_stats(self) -> dict:
        """Get normalization statistics."""
        return self._stats.copy()
    
    def reset_stats(self) -> None:
        """Reset statistics counters."""
        self._stats = {
            "total_received": 0,
            "total_normalized": 0,
            "duplicates_dropped": 0,
            "out_of_order_dropped": 0,
        }
    
    def clear_cache(self) -> None:
        """Clear deduplication cache and state."""
        self._seen_hashes.clear()
        self._last_ts_per_source.clear()


class TickBuffer:
    """
    Buffers ticks for batch processing.
    Useful for high-throughput scenarios.
    """
    
    def __init__(
        self,
        max_size: int = 1000,
        flush_interval_ms: int = 100,
    ):
        """
        Initialize tick buffer.
        
        Args:
            max_size: Maximum ticks before auto-flush
            flush_interval_ms: Time-based flush interval
        """
        self.max_size = max_size
        self.flush_interval_ms = flush_interval_ms
        
        self._buffer: list[CanonicalTick] = []
        self._lock = asyncio.Lock()
        self._flush_callback: Optional[Callable[[list[CanonicalTick]], Awaitable[None]]] = None
        self._flush_task: Optional[asyncio.Task] = None
    
    def set_flush_callback(
        self, 
        callback: Callable[[list[CanonicalTick]], Awaitable[None]]
    ) -> None:
        """Set callback for flush events."""
        self._flush_callback = callback
    
    async def add(self, tick: CanonicalTick) -> None:
        """Add tick to buffer, potentially triggering flush."""
        async with self._lock:
            self._buffer.append(tick)
            
            if len(self._buffer) >= self.max_size:
                await self._flush_unlocked()
    
    async def flush(self) -> list[CanonicalTick]:
        """Manually flush buffer."""
        async with self._lock:
            return await self._flush_unlocked()
    
    async def _flush_unlocked(self) -> list[CanonicalTick]:
        """Flush buffer (must hold lock)."""
        if not self._buffer:
            return []
        
        ticks = self._buffer
        self._buffer = []
        
        if self._flush_callback:
            try:
                await self._flush_callback(ticks)
            except Exception as e:
                logger.error("buffer_flush_error", error=str(e))
        
        return ticks
    
    async def start_periodic_flush(self) -> None:
        """Start periodic flush task."""
        if self._flush_task:
            return
        
        self._flush_task = asyncio.create_task(self._periodic_flush())
    
    async def stop_periodic_flush(self) -> None:
        """Stop periodic flush task."""
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
            self._flush_task = None
    
    async def _periodic_flush(self) -> None:
        """Periodic flush loop."""
        try:
            while True:
                await asyncio.sleep(self.flush_interval_ms / 1000)
                await self.flush()
        except asyncio.CancelledError:
            await self.flush()  # Final flush
    
    @property
    def size(self) -> int:
        """Current buffer size."""
        return len(self._buffer)
