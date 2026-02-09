"""
Demo market data provider.

Uses fixture files from phase1/data/equity/*.csv for deterministic, network-free operation.
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

logger = structlog.get_logger(__name__)


class DemoProvider(MarketDataProvider):
    """Demo provider using CSV fixtures."""
    
    def __init__(self, data_dir: str = "phase1/data/equity"):
        super().__init__(ProviderName.DEMO)
        self.data_dir = Path(data_dir)
        logger.info(f"DemoProvider initialized with data_dir={self.data_dir.absolute()}")
    
    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """
        Load bars from CSV fixture.
        
        Expected CSV format: timestamp,open,high,low,close,volume
        """
        # Map symbol to fixture file
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
        # Get bars for last 7 days
        from datetime import timedelta
        end = datetime.utcnow()
        start = end - timedelta(days=7)
        
        bars_req = BarsRequest(
            symbol=request.symbol,
            start=start,
            end=end,
            interval="1d"
        )
        bars_resp = await self.get_bars(bars_req)
        
        if not bars_resp.bars:
            # Return dummy quote
            quote = QuoteData(
                symbol=request.symbol,
                timestamp=datetime.utcnow(),
                price=100.0,
                bid=99.95,
                ask=100.05,
                volume=1000000
            )
        else:
            # Use last bar's close as current price
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
        """Demo provider is always available."""
        return True
