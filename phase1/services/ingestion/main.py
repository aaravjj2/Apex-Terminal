"""
Main ingestion service entry point.
"""

import asyncio
import signal
import sys
import os
from typing import Optional, List
import structlog

from .connectors.mock import MockConnector
from .connectors.finnhub_connector import FinnhubConnector
from .connectors.alpaca_connector import AlpacaConnector
from .connectors.yfinance_connector import YFinanceConnector
from .normalizer import TickNormalizer
from ..bar_engine import BarEngine
from ..persistence import init_database
from ..persistence.repository import BarRepository
from ..persistence.cache import TieredBarStore, BarCache
from ..api.websocket import on_bar_update, on_bar_confirmed
from ..config import get_settings
from ..models import Bar, CanonicalTick


logger = structlog.get_logger()


class IngestionService:
    """
    Main ingestion service orchestrator.
    
    Coordinates:
    - Data connectors (mock/live)
    - Tick normalization
    - Bar aggregation
    - Persistence
    - WebSocket broadcasting
    """
    
    def __init__(
        self,
        mode: str = "live",
        symbols: Optional[List[str]] = None,
        provider: Optional[str] = None,
    ):
        """
        Initialize ingestion service.
        
        Args:
            mode: "mock" or "live"
            symbols: List of symbols to ingest
            provider: Optional provider override (e.g. 'alpaca', 'finnhub')
        """
        settings = get_settings()

        # If Alpaca credentials are present, prefer live mode even if mock was requested
        if mode == "mock" and (settings.apca_api_key_id or settings.apca_api_secret_key or os.environ.get('APCA_API_KEY_ID') or os.environ.get('ALPACA3_KEY')):
            logger.info("auto_switching_to_live_in_init", reason="Alpaca keys detected, overriding mock mode")
            mode = "live"

        self.mode = mode
        self.symbols = symbols or settings.symbols_list
        self.provider = provider
        
        # Components
        self.normalizer = TickNormalizer()
        self.bar_engine: Optional[BarEngine] = None
        self.store: Optional[TieredBarStore] = None
        self.connector = None
        
        self._running = False
        self.logger = logger.bind(component="ingestion_service", mode=mode, provider=provider)
    
    async def start(self) -> None:
        """Start the ingestion service."""
        self.logger.info("starting_ingestion_service", symbols=self.symbols)
        
        # Initialize database
        await init_database()
        
        # Initialize store
        repository = BarRepository()
        cache = BarCache()
        self.store = TieredBarStore(cache=cache, repository=repository)
        
        # Initialize bar engine
        self.bar_engine = BarEngine()
        
        # Set up persistence callback
        async def persist_bar(bar: Bar):
            await self.store.save_bar(bar)
            # Also broadcast to WebSocket
            await on_bar_confirmed(bar)
        
        self.bar_engine.set_persist_callback(persist_bar)
        
        # Set up update callback for forming bars
        self.bar_engine.register_update_callback(on_bar_update)
        
        # Connect normalizer to bar engine
        async def process_tick(tick: CanonicalTick):
            await self.bar_engine.process_tick(tick)
        
        self.normalizer.register_callback(process_tick)
        
        # Initialize connector based on mode and provider preference
        if self.mode == "mock":
            self.connector = MockConnector()

        elif self.mode == "live":
            settings = get_settings()

            # Provider override takes precedence
            if self.provider == "alpaca" or (self.provider is None and settings.apca_api_key_id):
                try:
                    from .connectors.alpaca_ws_connector import AlpacaWSConnector
                    self.connector = AlpacaWSConnector()
                    self.logger.info("using_alpaca_ws_connector")
                except Exception as e:
                    self.logger.error("alpaca_ws_init_failed", error=str(e))
                    # Fallback to Finnhub
                    self.connector = FinnhubConnector()
                    self.logger.info("using_finnhub_fallback")

            elif self.provider == "finnhub" or (self.provider is None and settings.finnhub_api_key):
                self.connector = FinnhubConnector()
                self.logger.info("using_finnhub_connector")

            else:
                # No live provider configured, fallback to mock
                self.logger.warning("no_live_provider_configured", msg="Falling back to mock connector")
                self.connector = MockConnector()
        else:
            raise ValueError(f"Unknown mode: {self.mode}")
        
        # Connect and subscribe
        await self.connector.connect()
        await self.connector.subscribe(self.symbols)
        
        # Register connector callback
        async def on_raw_tick(tick):
            await self.normalizer.process_tick(tick)
        
        self.connector.register_callback(on_raw_tick)

        # Backfill history if live mode (using YFinance)
        if self.mode == "live":
            asyncio.create_task(self.backfill_history())
        
        self._running = True
        self.logger.info("ingestion_service_started")

    async def backfill_history(self, days: int = 1) -> None:
        """Backfill historical bars from YFinance."""
        try:
            self.logger.info("starting_history_backfill", days=days)
            from .connectors.yfinance_connector import YFinanceConnector
            from datetime import datetime, timedelta, timezone
            
            yf = YFinanceConnector()
            await yf.connect()
            
            end = datetime.now(timezone.utc)
            start = end - timedelta(days=days)
            start_ms = int(start.timestamp() * 1000)
            end_ms = int(end.timestamp() * 1000)
            
            count = 0
            # Import BarState
            from ..models import BarState
            
            for symbol in self.symbols:
                async for bar_data in yf.get_historical_bars(symbol, "1m", start_ms, end_ms):
                    start_time = bar_data["ts_start_ms"]
                    duration = 60000 # 1 minute
                    
                    # Create Bar object
                    bar = Bar(
                        symbol=bar_data["symbol"],
                        timeframe=bar_data["timeframe"],
                        bar_index=start_time // duration, # Deterministic sequence
                        ts_start_ms=start_time,
                        ts_end_ms=start_time + duration,
                        open=bar_data["open"],
                        high=bar_data["high"],
                        low=bar_data["low"],
                        close=bar_data["close"],
                        volume=bar_data["volume"],
                        state=BarState.HISTORICAL
                    )
                    # Persist
                    await self.store.save_bar(bar)
                    count += 1
            
            self.logger.info("backfill_completed", bars_inserted=count)
            await yf.disconnect()
            
        except Exception as e:
            self.logger.error("backfill_failed", error=str(e))
    
    async def stop(self) -> None:
        """Stop the ingestion service."""
        self.logger.info("stopping_ingestion_service")
        self._running = False
        
        # Confirm remaining bars
        if self.bar_engine:
            await self.bar_engine.force_confirm_all()
        
        # Disconnect connector
        if self.connector:
            await self.connector.disconnect()
        
        self.logger.info("ingestion_service_stopped")
    
    async def run_mock_replay(self, csv_path: str) -> dict:
        """
        Run mock data replay from CSV file.
        
        Returns:
            Statistics from the replay
        """
        if not isinstance(self.connector, MockConnector):
            raise RuntimeError("Mock replay only available in mock mode")
        
        self.logger.info("starting_mock_replay", csv_path=csv_path)
        
        # Load CSV
        await self.connector.load_from_csv(csv_path)
        
        # Replay
        await self.connector.replay_ticks(realtime=False)
        
        # Confirm all bars
        await self.bar_engine.force_confirm_all()
        
        stats = {
            "normalizer": self.normalizer.get_stats(),
            "bar_engine": self.bar_engine.get_stats(),
        }
        
        self.logger.info("mock_replay_completed", stats=stats)
        return stats


async def main():
    """Main entry point for ingestion service."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Data Ingestion Service")
    parser.add_argument(
        "--mode",
        choices=["mock", "live"],
        default="live",
        help="Ingestion mode",
    )
    parser.add_argument(
        "--symbols",
        type=str,
        default="AAPL,MSFT",
        help="Comma-separated list of symbols",
    )
    parser.add_argument(
        "--csv",
        type=str,
        help="CSV file for mock replay",
    )
    
    args = parser.parse_args()

    # Auto-switch to live mode if Alpaca keys are present even when 'mock' was requested
    settings = get_settings()
    if args.mode == "mock" and (settings.apca_api_key_id or settings.apca_api_secret_key or os.environ.get('APCA_API_KEY_ID') or os.environ.get('ALPACA3_KEY')):
        logger.info("auto_switching_to_live", reason="Alpaca keys detected, overriding mock mode")
        args.mode = "live"

    symbols = [s.strip() for s in args.symbols.split(",")]
    
    # Configure logging
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )
    
    service = IngestionService(mode=args.mode, symbols=symbols)
    
    # Handle signals
    loop = asyncio.get_event_loop()
    
    def handle_shutdown(sig):
        logger.info("received_signal", signal=sig)
        asyncio.create_task(service.stop())
    
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_shutdown(s))
    
    try:
        await service.start()
        
        if args.csv:
            # Run mock replay and exit
            await service.run_mock_replay(args.csv)
            await service.stop()
        else:
            # Keep running
            while service._running:
                await asyncio.sleep(1)
    except Exception as e:
        logger.error("service_error", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
