"""
Deterministic pricing fixtures for portfolio valuation (v1.21).

Provides stable, fixture-based pricing for DEMO mode valuation.
Uses last close prices from bar fixtures.
"""

import csv
import hashlib
from pathlib import Path
from datetime import datetime
from decimal import Decimal
from typing import Dict, Tuple

# Path to fixtures
FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"

def _compute_fixture_checksum(filepath: Path) -> str:
    """Compute SHA256 checksum of a fixture file"""
    with open(filepath, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()

def load_demo_prices() -> Tuple[Dict[str, Decimal], datetime, str]:
    """
    Load deterministic prices from DEMO bar fixtures.
    
    Returns:
        Tuple of (prices_dict, as_of_timestamp, source_checksum)
        - prices_dict: {symbol: last_close_price}
        - as_of_timestamp: timestamp of last bar (deterministic)
        - source_checksum: SHA256 of fixture file
    """
    prices = {}
    as_of = None
    
    # Load AAPL bars
    aapl_file = FIXTURES_DIR / "aapl_test_bars.csv"
    if aapl_file.exists():
        with open(aapl_file, 'r') as f:
            reader = csv.DictReader(f)
            last_row = None
            for row in reader:
                last_row = row
            if last_row:
                prices['AAPL'] = Decimal(last_row['close'])
                # Use end timestamp of last bar
                as_of = datetime.fromtimestamp(int(last_row['ts_end_ms']) / 1000)
    
    # Add other symbols with deterministic fixedprices (for demo portfolios)
    # These align with the fixtures in phase1/services/portfolio/fixtures.py
    prices['MSFT'] = Decimal("350.00")  # Matches DEMO-PORT-001
    prices['GOOGL'] = Decimal("140.00")  # Matches DEMO-PORT-001
    prices['JNJ'] = Decimal("165.00")  # Matches DEMO-PORT-002
    prices['KO'] = Decimal("60.00")  # Matches DEMO-PORT-002
    
    # Default as_of if not loaded from bars
    if as_of is None:
        # Use fixed timestamp from fixtures (2024-01-15 16:00:00 UTC)
        as_of = datetime(2024, 1, 15, 16, 0, 0)
    
    # Compute combined checksum (use AAPL bars + fixed prices hash)
    checksum_data = f"aapl_bars:{_compute_fixture_checksum(aapl_file)}"
    checksum_data += f"|fixed:MSFT=350.00,GOOGL=140.00,JNJ=165.00,KO=60.00"
    source_checksum = hashlib.sha256(checksum_data.encode()).hexdigest()
    
    return prices, as_of, source_checksum

def get_pricing_source_label() -> str:
    """Get human-readable pricing source label"""
    return "demo-bars:last-close"
