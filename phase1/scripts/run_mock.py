#!/usr/bin/env python3
"""
Run mock data ingestion from CSV file.

Usage:
    python scripts/run_mock.py --csv fixtures/aapl_test_ticks.csv --symbols AAPL
    python scripts/run_mock.py --csv data/ticks.csv --symbols AAPL,GOOGL --timeframes 1m,5m,15m
"""

import asyncio
import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from services.models import Bar, BarState
from services.ingestion.normalizer import TickNormalizer
from services.ingestion.connectors.mock import MockConnector
from services.bar_engine import BarEngine
from services.persistence import Database
from services.persistence.repository import BarRepository
from services.persistence.cache import BarCache, TieredBarStore
from services.verifier.exporter import CanonicalExporter
from services.config import get_settings


async def run_mock_ingestion(
    csv_path: str,
    symbols: list[str],
    timeframes: list[str],
    output_csv: str | None = None,
    use_db: bool = False,
    db_url: str | None = None,
) -> dict:
    """
    Run mock ingestion from CSV file.
    
    Args:
        csv_path: Path to CSV file with tick data
        symbols: List of symbols to process
        timeframes: List of timeframes to generate
        output_csv: Optional path to export bars CSV
        use_db: Whether to persist to database
        db_url: Database URL (uses settings default if not provided)
    
    Returns:
        dict with statistics and results
    """
    settings = get_settings()
    
    print(f"📊 Starting mock ingestion from {csv_path}")
    print(f"   Symbols: {symbols}")
    print(f"   Timeframes: {timeframes}")
    
    # Initialize components
    connector = MockConnector()
    await connector.subscribe(symbols)
    normalizer = TickNormalizer()
    engine = BarEngine(timeframes=timeframes)
    
    confirmed_bars: list[Bar] = []
    
    # Optional persistence
    store = None
    db = None
    
    if use_db:
        db_url = db_url or settings.database_url
        db = Database(database_url=db_url)
        await db.init_db()
        repo = BarRepository(database=db)
        cache = BarCache(max_size=10000)
        store = TieredBarStore(cache=cache, repository=repo)
        print(f"   Database: {db_url}")
    
    # Set up callbacks
    async def on_bar_confirmed(bar: Bar):
        confirmed_bars.append(bar)
        if store:
            await store.save_bar(bar)
        print(f"   ✅ Bar confirmed: {bar.symbol} {bar.timeframe} #{bar.bar_index} "
              f"O={bar.open:.2f} H={bar.high:.2f} L={bar.low:.2f} C={bar.close:.2f} V={bar.volume:.0f}")
    
    engine.register_confirmed_callback(on_bar_confirmed)
    
    async def on_tick_normalized(tick):
        await engine.process_tick(tick)
    
    normalizer.register_callback(on_tick_normalized)
    
    # Load and process CSV
    await connector.load_from_csv(csv_path)
    
    tick_count = 0
    # Iterate manual buffer since stream() is not available
    for raw_tick in connector._tick_buffer:
        await normalizer.process_tick(raw_tick)
        tick_count += 1
        
        if tick_count % 100 == 0:
            print(f"   Processed {tick_count} ticks...")
    
    # Force confirm remaining bars
    print("   Confirming remaining bars...")
    remaining = await engine.force_confirm_all()
    for bar in remaining:
        confirmed_bars.append(bar)
        if store:
            await store.save_bar(bar)
    
    # Export if requested
    if output_csv:
        exporter = CanonicalExporter()
        exporter.export_csv(confirmed_bars, output_csv)
        bars_hash = exporter.compute_hash(confirmed_bars)
        print(f"\n📁 Exported to {output_csv}")
        print(f"   Hash: {bars_hash[:16]}...")
    
    # Cleanup
    if db:
        await db.close()
    
    # Statistics
    stats = normalizer.get_stats()
    result = {
        "ticks_processed": tick_count,
        "ticks_normalized": stats["total_normalized"],
        "duplicates_dropped": stats["duplicates_dropped"],
        "bars_confirmed": len(confirmed_bars),
        "bars_by_timeframe": {},
    }
    
    for tf in timeframes:
        result["bars_by_timeframe"][tf] = len([b for b in confirmed_bars if b.timeframe == tf])
    
    print(f"\n📈 Ingestion complete!")
    print(f"   Ticks processed: {result['ticks_processed']}")
    print(f"   Ticks normalized: {result['ticks_normalized']}")
    print(f"   Duplicates dropped: {result['duplicates_dropped']}")
    print(f"   Bars confirmed: {result['bars_confirmed']}")
    
    for tf, count in result["bars_by_timeframe"].items():
        print(f"   - {tf}: {count} bars")
    
    return result


def main():
    parser = argparse.ArgumentParser(description="Run mock data ingestion")
    parser.add_argument("--csv", required=True, help="Path to CSV file with tick data")
    parser.add_argument("--symbols", default="AAPL", help="Comma-separated list of symbols")
    parser.add_argument("--timeframes", default="1m,5m", help="Comma-separated list of timeframes")
    parser.add_argument("--output", help="Path to export bars CSV")
    parser.add_argument("--db", action="store_true", help="Persist to database")
    parser.add_argument("--db-url", help="Database URL")
    
    args = parser.parse_args()
    
    symbols = [s.strip().upper() for s in args.symbols.split(",")]
    timeframes = [tf.strip() for tf in args.timeframes.split(",")]
    
    asyncio.run(run_mock_ingestion(
        csv_path=args.csv,
        symbols=symbols,
        timeframes=timeframes,
        output_csv=args.output,
        use_db=args.db,
        db_url=args.db_url,
    ))


if __name__ == "__main__":
    main()
