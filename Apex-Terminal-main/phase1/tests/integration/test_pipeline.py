"""
Integration tests for the complete ingestion pipeline.
"""

import pytest
import pytest_asyncio
from pathlib import Path
from typing import List

from services.models import CanonicalTick, Bar, BarState, TickSource
from services.ingestion.normalizer import TickNormalizer
from services.ingestion.connectors.mock import MockConnector
from services.bar_engine import BarEngine, MultiSymbolBarEngine
from services.persistence import Database
from services.persistence.repository import BarRepository
from services.persistence.cache import BarCache, TieredBarStore


class TestEndToEndPipeline:
    """End-to-end tests for the ingestion pipeline."""
    
    @pytest.mark.asyncio
    async def test_mock_csv_to_bars(self, fixtures_dir: Path):
        """Test complete pipeline from mock CSV to bars."""
        csv_path = fixtures_dir / "aapl_test_ticks.csv"
        
        # Generate fixture if missing (self-contained test)
        if not csv_path.exists():
            csv_path.parent.mkdir(parents=True, exist_ok=True)
            with open(csv_path, 'w') as f:
                f.write("source,symbol,ts_ms,price,size\n")
                base_ts = 1704067200000
                for i in range(60):
                    f.write(f"mock,AAPL,{base_ts + i * 1000},{185.50 + i * 0.01},{100 + (i % 5) * 50}\n")
        
        connector = MockConnector()
        normalizer = TickNormalizer()
        engine = BarEngine(timeframes=["1m", "5m"])
        
        confirmed_bars: List[Bar] = []
        
        async def on_bar_confirmed(bar: Bar):
            confirmed_bars.append(bar)
        
        engine.register_confirmed_callback(on_bar_confirmed)
        
        async def on_tick_normalized(tick: CanonicalTick):
            await engine.process_tick(tick)
        
        normalizer.register_callback(on_tick_normalized)
        
        # Process CSV file
        await connector.load_from_csv(str(csv_path))
        
        # Iterate over loaded ticks manually since stream() is not available on MockConnector
        for raw_tick in connector._tick_buffer:
            await normalizer.process_tick(raw_tick)
        
        # Force confirm remaining bars
        final_bars = await engine.force_confirm_all()
        confirmed_bars.extend(final_bars)
        
        # Verify we got bars
        assert len(confirmed_bars) > 0
        
        # All bars should be confirmed
        for bar in confirmed_bars:
            assert bar.state == BarState.CONFIRMED
    
    @pytest.mark.asyncio
    async def test_pipeline_with_persistence(self):
        """Test pipeline with database persistence."""
        # In-memory database
        db = Database(database_url="sqlite+aiosqlite:///:memory:")
        await db.init_db()
        
        repo = BarRepository(database=db)
        cache = BarCache(max_size=1000)
        store = TieredBarStore(cache=cache, repository=repo)
        
        normalizer = TickNormalizer()
        engine = BarEngine(timeframes=["1m"])
        
        async def on_bar_confirmed(bar: Bar):
            await store.save_bar(bar)
        
        engine.register_confirmed_callback(on_bar_confirmed)
        
        async def on_tick(tick: CanonicalTick):
            await engine.process_tick(tick)
        
        normalizer.register_callback(on_tick)
        
        # Generate test ticks
        base_ts = 1704067200000
        for i in range(120):  # 2 minutes of ticks
            from services.models import RawTick
            raw = RawTick(
                source="mock",
                symbol="AAPL",
                ts_ms=base_ts + i * 1000,
                price=185.50 + (i % 10) * 0.01,
                size=100,
            )
            await normalizer.process_tick(raw)
        
        # Force confirm remaining
        remaining = await engine.force_confirm_all()
        for bar in remaining:
            await store.save_bar(bar)
        
        # Verify bars in database
        bars = await repo.get_bars(
            symbol="AAPL",
            timeframe="1m",
            start_ms=base_ts,
            end_ms=base_ts + 180000,
        )
        
        assert len(bars) == 2
        
        # Cleanup
        await db.drop_db()
        await db.close()
    
    @pytest.mark.asyncio
    async def test_multi_symbol_pipeline(self):
        """Test pipeline with multiple symbols."""
        engine = MultiSymbolBarEngine(symbols=["AAPL", "GOOGL", "MSFT"], timeframes=["1m"])
        normalizer = TickNormalizer()
        
        confirmed: List[Bar] = []
        
        async def on_confirm(bar: Bar):
            confirmed.append(bar)
        
        engine.register_confirmed_callback(on_confirm)
        
        async def on_tick(tick: CanonicalTick):
            await engine.process_tick(tick)
        
        normalizer.register_callback(on_tick)
        
        # Generate ticks for multiple symbols
        base_ts = 1704067200000
        symbols = ["AAPL", "GOOGL", "MSFT"]
        
        for i in range(65):  # Just over 1 minute
            for symbol in symbols:
                from services.models import RawTick
                raw = RawTick(
                    source="mock",
                    symbol=symbol,
                    ts_ms=base_ts + i * 1000,
                    price=185.50 + i * 0.01,
                    size=100,
                )
                await normalizer.process_tick(raw)
        
        # Force confirm remaining
        remaining = await engine.force_confirm_all()
        confirmed.extend(remaining)
        
        # Should have bars for all 3 symbols
        symbols_in_bars = {bar.symbol for bar in confirmed}
        assert symbols_in_bars == {"AAPL", "GOOGL", "MSFT"}


class TestDeterminism:
    """Tests for deterministic behavior."""
    
    @pytest.mark.asyncio
    async def test_same_input_same_output(self):
        """Test that same input produces same output."""
        from services.models import RawTick
        
        def create_ticks():
            base_ts = 1704067200000
            return [
                RawTick(source="mock", symbol="AAPL", ts_ms=base_ts, price=185.50, size=100),
                RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 10000, price=185.75, size=150),
                RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 20000, price=185.30, size=200),
                RawTick(source="mock", symbol="AAPL", ts_ms=base_ts + 30000, price=185.60, size=100),
            ]
        
        # Run 1
        normalizer1 = TickNormalizer()
        engine1 = BarEngine(timeframes=["1m"])
        
        async def on_tick1(tick):
            await engine1.process_tick(tick)
        
        normalizer1.register_callback(on_tick1)
        
        for raw in create_ticks():
            await normalizer1.process_tick(raw)
        
        bars1 = await engine1.force_confirm_all()
        
        # Run 2
        normalizer2 = TickNormalizer()
        engine2 = BarEngine(timeframes=["1m"])
        
        async def on_tick2(tick):
            await engine2.process_tick(tick)
        
        normalizer2.register_callback(on_tick2)
        
        for raw in create_ticks():
            await normalizer2.process_tick(raw)
        
        bars2 = await engine2.force_confirm_all()
        
        # Compare outputs
        assert len(bars1) == len(bars2)
        
        for b1, b2 in zip(bars1, bars2):
            assert b1.bar_hash == b2.bar_hash
            assert b1.open == b2.open
            assert b1.high == b2.high
            assert b1.low == b2.low
            assert b1.close == b2.close
            assert b1.volume == b2.volume
    
    @pytest.mark.asyncio
    async def test_canonical_hash_consistency(self):
        """Test that canonical hash is consistent across runs."""
        from services.verifier.exporter import CanonicalExporter
        
        bars = [
            Bar(
                symbol="AAPL",
                timeframe="1m",
                bar_index=0,
                ts_start_ms=1704067200000,
                ts_end_ms=1704067260000,
                open=185.50,
                high=185.75,
                low=185.30,
                close=185.60,
                volume=550,
                state=BarState.CONFIRMED,
            ),
            Bar(
                symbol="AAPL",
                timeframe="1m",
                bar_index=1,
                ts_start_ms=1704067260000,
                ts_end_ms=1704067320000,
                open=185.60,
                high=185.80,
                low=185.50,
                close=185.70,
                volume=400,
                state=BarState.CONFIRMED,
            ),
        ]
        
        exporter = CanonicalExporter()
        
        hash1 = exporter.compute_hash(bars)
        hash2 = exporter.compute_hash(bars)
        
        assert hash1 == hash2


class TestCacheConsistency:
    """Tests for cache and persistence consistency."""
    
    @pytest.mark.asyncio
    async def test_cache_and_db_consistency(self):
        """Test that cache and DB return same results."""
        db = Database(database_url="sqlite+aiosqlite:///:memory:")
        await db.init_db()
        
        repo = BarRepository(database=db)
        cache = BarCache(max_size=100)
        store = TieredBarStore(cache=cache, repository=repo)
        
        # Create and store a bar
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.50,
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550,
            state=BarState.CONFIRMED,
        )
        
        await store.save_bar(bar)
        
        # Get from cache
        from_cache = await cache.get("AAPL", "1m", 0)
        assert from_cache is not None
        assert from_cache.bar_hash == bar.bar_hash
        
        # Clear cache and get from DB via store
        await cache.clear()
        from_store = await store.get_bar("AAPL", "1m", 0)
        
        assert from_store is not None
        assert from_store.bar_hash == bar.bar_hash
        
        await db.drop_db()
        await db.close()
