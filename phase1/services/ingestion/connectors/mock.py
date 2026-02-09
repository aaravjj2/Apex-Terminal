"""
Mock connector for reproducible testing.
Consumes tick data from CSV files.
"""

import asyncio
import csv
from pathlib import Path
from typing import AsyncIterator, Optional, Union
import structlog

from .base import BaseConnector
from ...models import RawTick


logger = structlog.get_logger()


class MockConnector(BaseConnector):
    """
    Mock data connector that reads ticks from CSV files.
    Used for deterministic testing and replay.
    """
    
    def __init__(
        self,
        csv_path: Optional[Union[str, Path]] = None,
        tick_delay_ms: int = 0,
    ):
        """
        Initialize mock connector.
        
        Args:
            csv_path: Path to CSV file with tick data
            tick_delay_ms: Artificial delay between ticks (for streaming simulation)
        """
        super().__init__(name="mock")
        self.csv_path = Path(csv_path) if csv_path else None
        self.tick_delay_ms = tick_delay_ms
        self._subscribed_symbols: set[str] = set()
        self._tick_buffer: list[RawTick] = []
    
    async def connect(self) -> None:
        """Mock connection - just mark as running."""
        self._running = True
        self.logger.info("mock_connector_connected")
    
    async def disconnect(self) -> None:
        """Mock disconnection."""
        self._running = False
        self._subscribed_symbols.clear()
        self.logger.info("mock_connector_disconnected")
    
    async def subscribe(self, symbols: list[str]) -> None:
        """Subscribe to symbols (mock - just track them)."""
        self._subscribed_symbols.update(symbols)
        self.logger.info("mock_subscribed", symbols=symbols)
    
    async def unsubscribe(self, symbols: list[str]) -> None:
        """Unsubscribe from symbols."""
        self._subscribed_symbols.difference_update(symbols)
        self.logger.info("mock_unsubscribed", symbols=symbols)
    
    async def get_historical_ticks(
        self,
        symbol: str,
        start_ms: int,
        end_ms: int,
    ) -> AsyncIterator[RawTick]:
        """
        Yield historical ticks from CSV file.
        Filters by symbol and time range.
        """
        if not self.csv_path or not self.csv_path.exists():
            self.logger.warning("no_csv_file", path=str(self.csv_path))
            return
        
        async for tick in self._read_csv():
            if tick.symbol != symbol:
                continue
            if tick.ts_ms < start_ms or tick.ts_ms >= end_ms:
                continue
            yield tick
    
    async def _read_csv(self) -> AsyncIterator[RawTick]:
        """Read ticks from CSV file."""
        if not self.csv_path or not self.csv_path.exists():
            return
        
        with open(self.csv_path, "r", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tick = self._parse_row(row)
                if tick:
                    yield tick
    
    def _parse_row(self, row: dict) -> Optional[RawTick]:
        """
        Parse CSV row into RawTick.
        
        Expected columns: symbol, ts_ms, price, size (optional), side (optional)
        """
        try:
            return RawTick(
                source="mock",
                symbol=row.get("symbol", "UNKNOWN"),
                ts_ms=int(row["ts_ms"]),
                price=float(row["price"]),
                size=float(row.get("size", 0)) if row.get("size") else None,
                side=row.get("side"),
                raw_data=row,
            )
        except (KeyError, ValueError) as e:
            self.logger.warning("csv_parse_error", error=str(e), row=row)
            return None
    
    async def load_from_csv(self, csv_path: Union[str, Path]) -> int:
        """
        Load ticks from CSV into memory buffer.
        
        Returns:
            Number of ticks loaded
        """
        self.csv_path = Path(csv_path)
        self._tick_buffer.clear()
        
        count = 0
        async for tick in self._read_csv():
            self._tick_buffer.append(tick)
            count += 1
        
        # Sort by timestamp for deterministic ordering
        self._tick_buffer.sort(key=lambda t: t.ts_ms)
        
        self.logger.info("csv_loaded", path=str(csv_path), tick_count=count)
        return count
    
    async def replay_ticks(self, realtime: bool = False) -> None:
        """
        Replay buffered ticks through callbacks.
        
        Args:
            realtime: If True, simulate real-time delays between ticks
        """
        if not self._tick_buffer:
            self.logger.warning("no_ticks_to_replay")
            return
        
        self.logger.info("replay_started", tick_count=len(self._tick_buffer))
        
        last_ts = None
        for tick in self._tick_buffer:
            # Filter by subscribed symbols
            if self._subscribed_symbols and tick.symbol not in self._subscribed_symbols:
                continue
            
            # Simulate real-time delays
            if realtime and last_ts is not None:
                delay_ms = tick.ts_ms - last_ts
                if delay_ms > 0:
                    await asyncio.sleep(delay_ms / 1000.0)
            elif self.tick_delay_ms > 0:
                await asyncio.sleep(self.tick_delay_ms / 1000.0)
            
            last_ts = tick.ts_ms
            await self._emit_tick(tick)
        
        self.logger.info("replay_completed")
    
    async def inject_tick(self, tick: RawTick) -> None:
        """Manually inject a tick (for testing)."""
        await self._emit_tick(tick)
    
    async def inject_ticks(self, ticks: list[RawTick]) -> None:
        """Inject multiple ticks in order."""
        for tick in sorted(ticks, key=lambda t: t.ts_ms):
            await self._emit_tick(tick)
    
    def add_tick_to_buffer(self, tick: RawTick) -> None:
        """Add tick to internal buffer for later replay."""
        self._tick_buffer.append(tick)
    
    def clear_buffer(self) -> None:
        """Clear the tick buffer."""
        self._tick_buffer.clear()
    
    @property
    def buffer_size(self) -> int:
        """Get number of ticks in buffer."""
        return len(self._tick_buffer)
