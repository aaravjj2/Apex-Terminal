#!/usr/bin/env python3
"""
Generate deterministic test fixtures.

Usage:
    python scripts/generate_fixtures.py --symbol AAPL --start 2024-01-01 --days 1
"""

import argparse
import csv
import hashlib
import json
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def generate_deterministic_ticks(
    symbol: str,
    start_date: str,
    days: int = 1,
    seed: int = 42,
    ticks_per_minute: int = 5,
) -> list[dict]:
    """
    Generate deterministic tick data for testing.
    
    Uses a seeded random generator for reproducibility.
    """
    random.seed(seed)
    
    # Parse start date
    start = datetime.strptime(start_date, "%Y-%m-%d")
    
    # Initialize price based on symbol hash for consistency
    symbol_hash = int(hashlib.md5(symbol.encode()).hexdigest()[:8], 16)
    base_price = 100.0 + (symbol_hash % 200)  # Price between 100-300
    
    ticks = []
    current_price = base_price
    
    for day in range(days):
        current_date = start + timedelta(days=day)
        
        # Skip weekends
        if current_date.weekday() >= 5:
            continue
        
        # Market hours: 9:30 AM - 4:00 PM ET (simplified to UTC)
        market_open = current_date.replace(hour=14, minute=30, second=0, microsecond=0)  # 9:30 ET = 14:30 UTC
        market_close = current_date.replace(hour=21, minute=0, second=0, microsecond=0)  # 4:00 ET = 21:00 UTC
        
        current_time = market_open
        
        while current_time < market_close:
            # Generate ticks for this minute
            for _ in range(ticks_per_minute):
                # Random price movement
                change = random.gauss(0, 0.02) * current_price * 0.001
                current_price = max(1.0, current_price + change)
                
                # Random size
                size = random.randint(50, 500)
                
                # Random millisecond within the second
                ms_offset = random.randint(0, 59999)
                
                ts_ms = int(current_time.timestamp() * 1000) + ms_offset
                
                ticks.append({
                    "source": "mock",
                    "symbol": symbol,
                    "ts_ms": ts_ms,
                    "price": round(current_price, 4),
                    "size": size,
                })
            
            current_time += timedelta(minutes=1)
    
    # Sort by timestamp
    ticks.sort(key=lambda x: x["ts_ms"])
    
    return ticks


def write_ticks_csv(ticks: list[dict], output_path: str):
    """Write ticks to CSV file."""
    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["source", "symbol", "ts_ms", "price", "size"])
        writer.writeheader()
        writer.writerows(ticks)


def compute_fixture_hash(ticks: list[dict]) -> str:
    """Compute hash of fixture data."""
    canonical = json.dumps(ticks, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Generate test fixtures")
    parser.add_argument("--symbol", default="AAPL", help="Symbol to generate")
    parser.add_argument("--start", default="2024-01-02", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, default=1, help="Number of days")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--ticks-per-minute", type=int, default=5, help="Ticks per minute")
    parser.add_argument("--output", default="fixtures", help="Output directory")
    
    args = parser.parse_args()
    
    print(f"🎲 Generating fixtures for {args.symbol}")
    print(f"   Start: {args.start}")
    print(f"   Days: {args.days}")
    print(f"   Seed: {args.seed}")
    
    # Generate ticks
    ticks = generate_deterministic_ticks(
        symbol=args.symbol,
        start_date=args.start,
        days=args.days,
        seed=args.seed,
        ticks_per_minute=args.ticks_per_minute,
    )
    
    print(f"   Generated {len(ticks)} ticks")
    
    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    
    # Write CSV
    filename = f"{args.symbol.lower()}_{args.start}_ticks.csv"
    csv_path = output_dir / filename
    write_ticks_csv(ticks, str(csv_path))
    print(f"   Written to {csv_path}")
    
    # Compute and save hash
    tick_hash = compute_fixture_hash(ticks)
    hash_path = output_dir / f"{args.symbol.lower()}_{args.start}_ticks.sha256"
    with open(hash_path, 'w') as f:
        f.write(tick_hash)
    print(f"   Hash: {tick_hash[:32]}...")
    print(f"   Hash saved to {hash_path}")


if __name__ == "__main__":
    main()
