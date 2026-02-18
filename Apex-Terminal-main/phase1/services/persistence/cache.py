"""
In-memory LRU cache for recent bars.
Thread-safe with async support.
"""

import asyncio
from collections import OrderedDict
from typing import Optional, List, Dict, Tuple
import structlog

from ..models import Bar
from ..config import get_settings


logger = structlog.get_logger()


class BarCache:
    """
    Thread-safe LRU cache for recent bars.
    
    Provides fast access to forming and recently confirmed bars
    without hitting the database.
    
    Cache key: (symbol, timeframe, bar_index)
    """
    
    def __init__(self, max_size: Optional[int] = None):
        """
        Initialize bar cache.
        
        Args:
            max_size: Maximum number of bars to cache
        """
        settings = get_settings()
        self.max_size = max_size or settings.bar_cache_size
        
        # Main cache: {(symbol, tf, bar_index): Bar}
        self._cache: OrderedDict[Tuple[str, str, int], Bar] = OrderedDict()
        
        # Latest bar per symbol/timeframe for fast access
        self._latest: Dict[Tuple[str, str], int] = {}
        
        # Lock for thread-safe access
        self._lock = asyncio.Lock()
        
        # Stats
        self._hits = 0
        self._misses = 0
        
        self.logger = logger.bind(component="bar_cache")
    
    async def get(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
    ) -> Optional[Bar]:
        """Get a bar from cache."""
        async with self._lock:
            key = (symbol, timeframe, bar_index)
            
            if key in self._cache:
                self._hits += 1
                # Move to end (LRU)
                self._cache.move_to_end(key)
                return self._cache[key]
            
            self._misses += 1
            return None
    
    async def put(self, bar: Bar) -> None:
        """Add or update a bar in cache."""
        async with self._lock:
            key = (bar.symbol, bar.timeframe, bar.bar_index)
            
            # Update or add
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = bar
            
            # Update latest tracker
            latest_key = (bar.symbol, bar.timeframe)
            current_latest = self._latest.get(latest_key, -1)
            if bar.bar_index > current_latest:
                self._latest[latest_key] = bar.bar_index
            
            # Evict if over capacity
            while len(self._cache) > self.max_size:
                evicted_key, _ = self._cache.popitem(last=False)
                self.logger.debug("cache_eviction", key=evicted_key)
    
    async def put_many(self, bars: List[Bar]) -> None:
        """Add multiple bars to cache."""
        async with self._lock:
            for bar in bars:
                key = (bar.symbol, bar.timeframe, bar.bar_index)
                
                if key in self._cache:
                    self._cache.move_to_end(key)
                self._cache[key] = bar
                
                # Update latest tracker
                latest_key = (bar.symbol, bar.timeframe)
                current_latest = self._latest.get(latest_key, -1)
                if bar.bar_index > current_latest:
                    self._latest[latest_key] = bar.bar_index
            
            # Evict if over capacity
            while len(self._cache) > self.max_size:
                self._cache.popitem(last=False)
    
    async def get_range(
        self,
        symbol: str,
        timeframe: str,
        start_index: int,
        end_index: int,
    ) -> List[Bar]:
        """
        Get bars in an index range from cache.
        Returns only bars that are in cache (may be incomplete).
        """
        async with self._lock:
            result = []
            for idx in range(start_index, end_index + 1):
                key = (symbol, timeframe, idx)
                if key in self._cache:
                    result.append(self._cache[key])
            return result
    
    async def get_latest(
        self,
        symbol: str,
        timeframe: str,
    ) -> Optional[Bar]:
        """Get the latest bar for a symbol/timeframe from cache."""
        async with self._lock:
            latest_key = (symbol, timeframe)
            latest_index = self._latest.get(latest_key)
            
            if latest_index is None:
                return None
            
            key = (symbol, timeframe, latest_index)
            return self._cache.get(key)
    
    async def get_recent(
        self,
        symbol: str,
        timeframe: str,
        count: int = 10,
    ) -> List[Bar]:
        """Get most recent N bars for a symbol/timeframe."""
        async with self._lock:
            latest_key = (symbol, timeframe)
            latest_index = self._latest.get(latest_key)
            
            if latest_index is None:
                return []
            
            result = []
            for idx in range(latest_index, latest_index - count, -1):
                if idx < 0:
                    break
                key = (symbol, timeframe, idx)
                if key in self._cache:
                    result.append(self._cache[key])
            
            return list(reversed(result))
    
    async def invalidate(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
    ) -> bool:
        """Remove a specific bar from cache."""
        async with self._lock:
            key = (symbol, timeframe, bar_index)
            
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    async def invalidate_symbol(self, symbol: str) -> int:
        """Remove all bars for a symbol from cache."""
        async with self._lock:
            to_remove = [k for k in self._cache.keys() if k[0] == symbol]
            for key in to_remove:
                del self._cache[key]
            
            # Update latest tracker
            self._latest = {
                k: v for k, v in self._latest.items() if k[0] != symbol
            }
            
            return len(to_remove)
    
    async def clear(self) -> None:
        """Clear the entire cache."""
        async with self._lock:
            self._cache.clear()
            self._latest.clear()
            self._hits = 0
            self._misses = 0
    
    async def get_stats(self) -> dict:
        """Get cache statistics."""
        async with self._lock:
            total = self._hits + self._misses
            hit_rate = self._hits / total if total > 0 else 0.0
            
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": hit_rate,
                "symbols_tracked": len(set(k[0] for k in self._cache.keys())),
            }
    
    @property
    def size(self) -> int:
        """Current cache size."""
        return len(self._cache)


class TieredBarStore:
    """
    Tiered storage combining cache and database.
    
    Read path: Cache → Database → None
    Write path: Cache + Database
    """
    
    def __init__(
        self,
        cache: Optional[BarCache] = None,
        repository=None,  # BarRepository
    ):
        """
        Initialize tiered store.
        
        Args:
            cache: Bar cache instance
            repository: Bar repository instance
        """
        self.cache = cache or BarCache()
        self._repository = repository
        self.logger = logger.bind(component="tiered_store")
    
    @property
    def repository(self):
        """Lazy-load repository to avoid circular imports."""
        if self._repository is None:
            from .repository import BarRepository
            self._repository = BarRepository()
        return self._repository
    
    async def get_bar(
        self,
        symbol: str,
        timeframe: str,
        bar_index: int,
    ) -> Optional[Bar]:
        """Get bar from cache or database."""
        # Try cache first
        bar = await self.cache.get(symbol, timeframe, bar_index)
        if bar:
            return bar
        
        # Fall back to database
        bar = await self.repository.get_bar(symbol, timeframe, bar_index)
        if bar:
            # Populate cache
            await self.cache.put(bar)
        
        return bar
    
    async def get_bars(
        self,
        symbol: str,
        timeframe: str,
        start_ms: Optional[int] = None,
        end_ms: Optional[int] = None,
        limit: int = 1000,
    ) -> List[Bar]:
        """Get bars from database (cache not efficient for ranges)."""
        bars = await self.repository.get_bars(
            symbol, timeframe, start_ms, end_ms, limit
        )
        
        # Populate cache with results
        await self.cache.put_many(bars)
        
        return bars
    
    async def save_bar(self, bar: Bar) -> None:
        """Save bar to both cache and database."""
        # Update cache
        await self.cache.put(bar)
        
        # Persist to database
        await self.repository.save_bar(bar)
    
    async def save_bars(self, bars: List[Bar]) -> int:
        """Save multiple bars to both cache and database."""
        # Update cache
        await self.cache.put_many(bars)
        
        # Persist to database
        return await self.repository.save_bars(bars)
    
    async def get_latest_bar(
        self,
        symbol: str,
        timeframe: str,
    ) -> Optional[Bar]:
        """Get latest bar, preferring cache."""
        # Try cache
        bar = await self.cache.get_latest(symbol, timeframe)
        if bar:
            return bar
        
        # Fall back to database
        bar = await self.repository.get_latest_bar(symbol, timeframe)
        if bar:
            await self.cache.put(bar)
        
        return bar
    
    async def get_recent_bars(
        self,
        symbol: str,
        timeframe: str,
        count: int = 10,
    ) -> List[Bar]:
        """Get recent bars, using cache when possible."""
        # Try cache first
        cached = await self.cache.get_recent(symbol, timeframe, count)
        if len(cached) >= count:
            return cached[:count]
        
        # Fall back to database - request the most recent bars
        bars = await self.repository.get_recent_bars(symbol, timeframe, limit=count)

        # Update cache
        await self.cache.put_many(bars)

        return bars
