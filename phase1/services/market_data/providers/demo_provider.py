"""
Demo market data provider.

Uses fixture files from phase1/data/equity/*.csv for deterministic, network-free operation.
Replay-first policy: checks replay cache before loading fixtures.
"""

import csv
from pathlib import Path
from datetime import datetime
from typing import List
import structlog

from .base import MarketDataProvider
from .types import (
    BarsRequest, BarsResponse, QuoteRequest, QuoteResponse,
    BarData, QuoteData, ProviderName
)
from ..replay import has_replay, get_replay, save_replay

logger = structlog.get_logger(__name__)


class DemoProvider(MarketDataProvider):
    """Demo provider using CSV fixtures with replay-first policy."""
    
    def __init__(self, data_dir: str = "phase1/data/equity", enable_replay_save: bool = False):
        super().__init__(ProviderName.DEMO)
        self.data_dir = Path(data_dir)
        self.enable_replay_save = enable_replay_save  # LOCAL mode flag
        logger.info(
            f"DemoProvider initialized",
            data_dir=str(self.data_dir.absolute()),
            enable_replay_save=enable_replay_save
        )
    
    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """
        Load bars from replay cache (if exists) or CSV fixture.
        
        REPLAY-FIRST POLICY: If replay exists, use it exclusively (no fixture fallback).
        Expected CSV format: timestamp,open,high,low,close,volume
        """
        # Check replay cache first
        replay_params = {
            "symbol": request.symbol,
            "start": request.start.isoformat(),
            "end": request.end.isoformat(),
            "interval": str(request.interval.value) if hasattr(request.interval, 'value') else str(request.interval),
        }
        
        replay_data = get_replay("bars", replay_params)
        if replay_data:
            # Replay HIT — deserialize and return
            bars = [
                BarData(
                    timestamp=datetime.fromisoformat(b["timestamp"]),
                    open=b["open"],
                    high=b["high"],
                    low=b["low"],
                    close=b["close"],
                    volume=b["volume"],
                )
                for b in replay_data.get("data", {}).get("bars", [])
            ]
            return BarsResponse(
                symbol=request.symbol,
                bars=bars,
                provider=self.provider_name,
                cached=True,  # Replay artifacts are cached
            )
        
        # No replay — load from fixture
        fixture_file = self.data_dir / f"{request.symbol.lower()}_1d.csv"
        
        if not fixture_file.exists():
            # Fallback: try sample_ticks.csv for generic data
            fixture_file = Path("data/sample_ticks.csv")
            if not fixture_file.exists():
                logger.warning(f"No fixture found for {request.symbol}")
                return BarsResponse(
                    symbol=request.symbol,
                    bars=[],
                    provider=self.provider_name,
                    cached=False
                )
        
        bars = []
        try:
            with open(fixture_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Parse timestamp
                    try:
                        timestamp = datetime.fromisoformat(row['timestamp'])
                    except (KeyError, ValueError):
                        # Try alternative timestamp formats
                        try:
                            timestamp = datetime.strptime(row.get('date', row.get('time', '')), '%Y-%m-%d')
                        except:
                            continue
                    
                    # Filter by date range
                    if timestamp < request.start or timestamp > request.end:
                        continue
                    
                    bar = BarData(
                        timestamp=timestamp,
                        open=float(row.get('open', row.get('Open', 0))),
                        high=float(row.get('high', row.get('High', 0))),
                        low=float(row.get('low', row.get('Low', 0))),
                        close=float(row.get('close', row.get('Close', 0))),
                        volume=int(float(row.get('volume', row.get('Volume', 0))))
                    )
                    bars.append(bar)
            
            logger.debug(f"Loaded {len(bars)} bars for {request.symbol} from {fixture_file.name}")
        except Exception as e:
            logger.error(f"Error loading fixture {fixture_file}: {e}")
        
        # Save replay artifact if enabled (LOCAL mode only)
        if self.enable_replay_save and bars:
            replay_data = {
                "bars": [
                    {
                        "timestamp": b.timestamp.isoformat(),
                        "open": b.open,
                        "high": b.high,
                        "low": b.low,
                        "close": b.close,
                        "volume": b.volume,
                    }
                    for b in bars
                ]
            }
            save_replay("bars", replay_params, replay_data)
        
        return BarsResponse(
            symbol=request.symbol,
            bars=bars,
            provider=self.provider_name,
            cached=False  # Fixtures are always "fresh"
        )
    
    async def get_quote(self, request: QuoteRequest) -> QuoteResponse:
        """
        Get quote from most recent bar.
        
        For demo mode, we derive the quote from the last available bar.
        """
        # Get bars for a wide date range (fixture data can be from any period)
        from datetime import timedelta
        end = datetime(2099, 12, 31)
        start = datetime(2000, 1, 1)
        
        bars_req = BarsRequest(
            symbol=request.symbol,
            start=start,
            end=end,
            interval="1d"
        )
        bars_resp = await self.get_bars(bars_req)
        
        if not bars_resp.bars:
            # NO FABRICATED PRICES — fail fast with error
            raise ValueError(
                f"No bars available for {request.symbol}. "
                f"DemoProvider has no fixture data for this symbol. "
                f"Checked: {self.data_dir / f'{request.symbol.lower()}_1d.csv'}"
            )
        
        # Use last bar's close as current price (real fixture data)
        last_bar = bars_resp.bars[-1]
        quote = QuoteData(
            symbol=request.symbol,
            timestamp=last_bar.timestamp,
            price=last_bar.close,
            bid=last_bar.close * 0.9995,  # Approximate bid
            ask=last_bar.close * 1.0005,  # Approximate ask
            volume=last_bar.volume
        )
        
        return QuoteResponse(
            quote=quote,
            provider=self.provider_name,
            cached=False
        )
    
    async def health_check(self) -> bool:
        """Demo provider is available if fixture directory exists."""
        return self.data_dir.exists()
