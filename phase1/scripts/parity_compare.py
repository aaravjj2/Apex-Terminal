#!/usr/bin/env python3
"""
Parity comparison script - compare generated bars with reference CSV.

Usage:
    python scripts/parity_compare.py --reference fixtures/reference_bars.csv --csv output_bars.csv
    python scripts/parity_compare.py --reference ref.csv --csv generated.csv --tolerance 1e-6
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from services.verifier.comparator import BarComparator
from services.verifier.exporter import CanonicalExporter


def load_bars_from_csv(csv_path: str) -> list:
    """Load bars from a CSV file."""
    import csv
    from services.models import Bar, BarState
    
    bars = []
    
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            bar = Bar(
                symbol=row.get('symbol', 'UNKNOWN'),
                timeframe=row.get('timeframe', 'UNKNOWN'),
                bar_index=int(row['bar_index']),
                ts_start_ms=int(row['ts_start_ms']),
                ts_end_ms=int(row['ts_end_ms']),
                open=float(row['open']) if row.get('open') else None,
                high=float(row['high']) if row.get('high') else None,
                low=float(row['low']) if row.get('low') else None,
                close=float(row['close']) if row.get('close') else None,
                volume=float(row['volume']) if row.get('volume') else 0.0,
                state=BarState.CONFIRMED,
                tick_count=int(row.get('tick_count', 0)),
            )
            bars.append(bar)
    
    return bars


def main():
    parser = argparse.ArgumentParser(description="Compare generated bars with reference")
    parser.add_argument("--reference", required=True, help="Path to reference CSV file")
    parser.add_argument("--csv", required=True, help="Path to generated CSV file to compare")
    parser.add_argument("--tolerance", type=float, default=0.0, help="Numeric tolerance for comparison")
    parser.add_argument("--verbose", action="store_true", help="Show detailed mismatches")
    
    args = parser.parse_args()
    
    print("🔍 Parity Comparison Tool")
    print(f"   Reference: {args.reference}")
    print(f"   Generated: {args.csv}")
    print(f"   Tolerance: {args.tolerance}")
    print()
    
    # Check files exist
    if not Path(args.reference).exists():
        print(f"❌ Reference file not found: {args.reference}")
        sys.exit(1)
    
    if not Path(args.csv).exists():
        print(f"❌ Generated file not found: {args.csv}")
        sys.exit(1)
    
    # Load generated bars
    try:
        generated_bars = load_bars_from_csv(args.csv)
        print(f"   Loaded {len(generated_bars)} generated bars")
    except Exception as e:
        print(f"❌ Error loading generated CSV: {e}")
        sys.exit(1)
    
    # Compare with reference
    comparator = BarComparator(
        price_tolerance=args.tolerance, 
        volume_tolerance=args.tolerance
    )
    report = comparator.compare_with_reference(generated_bars, args.reference)
    
    # Compute hashes
    exporter = CanonicalExporter()
    generated_hash = exporter.compute_hash(generated_bars)
    
    # Load reference bars for hash
    try:
        reference_bars = load_bars_from_csv(args.reference)
        reference_hash = exporter.compute_hash(reference_bars)
    except Exception:
        reference_hash = "N/A"
    
    print("\n" + "=" * 60)
    print("📊 PARITY REPORT")
    print("=" * 60)
    
    if report.is_identical:
        print("✅ PARITY CHECK PASSED")
        print()
        print(f"   Total bars compared: {report.bars_compared}")
        print(f"   Generated hash: {generated_hash[:32]}...")
        print(f"   Reference hash: {reference_hash[:32] if reference_hash != 'N/A' else 'N/A'}...")
        
        if generated_hash == reference_hash:
            print()
            print("   🔐 Hash match: VERIFIED")
    else:
        print("❌ PARITY CHECK FAILED")
        print()
        print(f"   Bars compared: {report.bars_compared}")
        print(f"   Mismatches: {len(report.mismatches)}")
        print(f"   Bars only in generated: {report.bars_only_in_computed}")
        print(f"   Bars only in reference: {report.bars_only_in_reference}")
        
        if args.verbose and report.mismatches:
            print()
            print("   Mismatch details:")
            for i, mismatch in enumerate(report.mismatches[:10]):  # First 10
                print(f"   [{i+1}] {mismatch}")
            
            if len(report.mismatches) > 10:
                print(f"   ... and {len(report.mismatches) - 10} more")
    
    print()
    print("=" * 60)
    
    # Exit with appropriate code
    sys.exit(0 if report.is_identical else 1)


if __name__ == "__main__":
    main()
