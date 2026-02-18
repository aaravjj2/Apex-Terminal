"""
Base connector interface for all data sources.
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional, Callable, Awaitable
import structlog

from ...models import RawTick


logger = structlog.get_logger()


class BaseConnector(ABC):
    """
    Abstract base class for data connectors.
    All connectors must implement this interface.
    """
    
    def __init__(self, name: str):
        self.name = name
        self._running = False
        self._callbacks: list[Callable[[RawTick], Awaitable[None]]] = []
        self.logger = logger.bind(connector=name)
    
    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to data source."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection to data source."""
        pass
    
    @abstractmethod
    async def subscribe(self, symbols: list[str]) -> None:
        """Subscribe to tick updates for given symbols."""
        pass
    
    @abstractmethod
    async def unsubscribe(self, symbols: list[str]) -> None:
        """Unsubscribe from tick updates for given symbols."""
        pass
    
    @abstractmethod
    async def get_historical_ticks(
        self,
        symbol: str,
        start_ms: int,
        end_ms: int,
    ) -> AsyncIterator[RawTick]:
        """
        Fetch historical tick data for a symbol.
        
        Args:
            symbol: Stock symbol
            start_ms: Start timestamp in UTC milliseconds
            end_ms: End timestamp in UTC milliseconds
            
        Yields:
            RawTick objects in chronological order
        """
        pass
    
    def register_callback(self, callback: Callable[[RawTick], Awaitable[None]]) -> None:
        """Register callback for incoming ticks."""
        self._callbacks.append(callback)
    
    def unregister_callback(self, callback: Callable[[RawTick], Awaitable[None]]) -> None:
        """Unregister a callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    async def _emit_tick(self, tick: RawTick) -> None:
        """Emit tick to all registered callbacks."""
        for callback in self._callbacks:
            try:
                await callback(tick)
            except Exception as e:
                self.logger.error("callback_error", error=str(e), tick=tick.model_dump())
    
    @property
    def is_running(self) -> bool:
        """Check if connector is actively streaming."""
        return self._running
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()
