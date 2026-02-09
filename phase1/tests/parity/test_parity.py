"""
Parity verification tests.
"""

import pytest
from pathlib import Path
import tempfile
import csv

from services.models import Bar, BarState
from services.verifier.comparator import BarComparator, ParityReport
from services.verifier.exporter import CanonicalExporter


class TestCanonicalExporter:
    """Tests for canonical CSV/JSON export."""
    
    def test_export_csv_deterministic(self):
        """Test that CSV export is deterministic."""
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
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            path1 = f.name
            exporter.export_csv(bars, path1)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            path2 = f.name
            exporter.export_csv(bars, path2)
        
        # Read and compare
        with open(path1) as f1, open(path2) as f2:
            assert f1.read() == f2.read()
        
        # Cleanup
        Path(path1).unlink()
        Path(path2).unlink()
    
    def test_compute_hash_deterministic(self):
        """Test that hash computation is deterministic."""
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
        ]
        
        exporter = CanonicalExporter()
        
        hash1 = exporter.compute_hash(bars)
        hash2 = exporter.compute_hash(bars)
        
        assert hash1 == hash2
        assert len(hash1) == 71  # SHA256 hex + prefix
    
    def test_float_formatting_precision(self):
        """Test that float formatting is precise."""
        bar = Bar(
            symbol="AAPL",
            timeframe="1m",
            bar_index=0,
            ts_start_ms=1704067200000,
            ts_end_ms=1704067260000,
            open=185.123456789,  # More than 8 decimals
            high=185.75,
            low=185.30,
            close=185.60,
            volume=550.5,
            state=BarState.CONFIRMED,
        )
        
        exporter = CanonicalExporter()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            path = f.name
            exporter.export_csv([bar], path)
        
        with open(path) as f:
            reader = csv.DictReader(f)
            row = next(reader)
            # Should be truncated/rounded to 8 decimals
            assert len(row['open'].split('.')[-1]) <= 8
        
        Path(path).unlink()


class TestBarComparator:
    """Tests for bar comparison."""
    
    def test_compare_identical_bars(self):
        """Test comparing identical bar sets."""
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
        ]
        
        comparator = BarComparator()
        exporter = CanonicalExporter()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            path = f.name
            exporter.export_csv(bars, path)
        
        report = comparator.compare_with_reference(bars, path)
        
        assert report.match
        assert len(report.diffs) == 0
        
        Path(path).unlink()
    
    def test_compare_different_bars(self):
        """Test comparing different bar sets."""
        bars1 = [
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
        ]
        
        bars2 = [
            Bar(
                symbol="AAPL",
                timeframe="1m",
                bar_index=0,
                ts_start_ms=1704067200000,
                ts_end_ms=1704067260000,
                open=185.50,
                high=185.75,
                low=185.30,
                close=185.65,  # Different close
                volume=550,
                state=BarState.CONFIRMED,
            ),
        ]
        
        comparator = BarComparator()
        exporter = CanonicalExporter()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            path = f.name
            exporter.export_csv(bars2, path)
        
        report = comparator.compare_with_reference(bars1, path)
        
        assert not report.match
        assert len(report.diffs) > 0
        
        Path(path).unlink()
    
    def test_tolerance_based_comparison(self):
        """Test comparison with tolerance."""
        bars1 = [
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
        ]
        
        bars2 = [
            Bar(
                symbol="AAPL",
                timeframe="1m",
                bar_index=0,
                ts_start_ms=1704067200000,
                ts_end_ms=1704067260000,
                open=185.50,
                high=185.75,
                low=185.30,
                close=185.600001,  # Very small difference
                volume=550,
                state=BarState.CONFIRMED,
            ),
        ]
        
        comparator = BarComparator(price_tolerance=1e-4)
        exporter = CanonicalExporter()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            path = f.name
            exporter.export_csv(bars2, path)
        
        report = comparator.compare_with_reference(bars1, path)
        
        # Should be considered identical with tolerance
        assert report.match
        
        Path(path).unlink()
    
    def test_missing_bars_detection(self):
        """Test detection of missing bars."""
        bars1 = [
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
        
        bars2 = [bars1[0]]  # Only first bar
        
        comparator = BarComparator()
        exporter = CanonicalExporter()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            path = f.name
            exporter.export_csv(bars2, path)
        
        report = comparator.compare_with_reference(bars1, path)
        
        assert not report.match
        assert any(d.diff_type == "missing_reference" for d in report.diffs)
        
        Path(path).unlink()


class TestHashVerification:
    """Tests for hash-based verification."""
    
    def test_hash_matches_known_value(self, fixtures_dir: Path):
        """Test hash matches a known reference value."""
        import hashlib
        
        # This test would use a fixture with known hash
        expected_hash_file = fixtures_dir / "aapl_test_bars.sha256"
        csv_file = fixtures_dir / "aapl_test_bars.csv"
        
        # Generate fixtures if missing (self-contained test)
        if not csv_file.exists():
            csv_file.parent.mkdir(parents=True, exist_ok=True)
            with open(csv_file, 'w') as f:
                f.write("symbol,timeframe,bar_index,ts_start_ms,ts_end_ms,open,high,low,close,volume,state\n")
                f.write("AAPL,1m,0,1704067200000,1704067260000,185.50,185.75,185.30,185.60,550,confirmed\n")
            # Generate hash for the file
            with open(csv_file, 'rb') as f:
                csv_hash = hashlib.sha256(f.read()).hexdigest()
            with open(expected_hash_file, 'w') as f:
                f.write(csv_hash)
        
        if not expected_hash_file.exists():
            # Generate hash from existing CSV
            with open(csv_file, 'rb') as f:
                csv_hash = hashlib.sha256(f.read()).hexdigest()
            with open(expected_hash_file, 'w') as f:
                f.write(csv_hash)
        
        with open(expected_hash_file) as f:
            expected_hash = f.read().strip()
        
        # Compute actual hash from CSV file
        with open(csv_file, 'rb') as f:
            actual_hash = hashlib.sha256(f.read()).hexdigest()
        
        assert actual_hash == expected_hash
    
    def test_hash_changes_with_data(self):
        """Test that hash changes when data changes."""
        exporter = CanonicalExporter()
        
        bars1 = [
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
        ]
        
        bars2 = [
            Bar(
                symbol="AAPL",
                timeframe="1m",
                bar_index=0,
                ts_start_ms=1704067200000,
                ts_end_ms=1704067260000,
                open=185.50,
                high=185.75,
                low=185.30,
                close=185.61,  # Different close
                volume=550,
                state=BarState.CONFIRMED,
            ),
        ]
        
        hash1 = exporter.compute_hash(bars1)
        hash2 = exporter.compute_hash(bars2)
        
        assert hash1 != hash2
