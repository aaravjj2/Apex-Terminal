"""
Canonical bar exporter for parity verification.
"""

import csv
import hashlib
import json
from pathlib import Path
from typing import List, Optional, TextIO
import structlog

from ..models import Bar


logger = structlog.get_logger()


class CanonicalExporter:
    """
    Exports bars in canonical format for deterministic comparison.
    
    Ensures consistent formatting for:
    - Prices (8 decimal places)
    - Volumes (2 decimal places)
    - Timestamps (integer milliseconds)
    - Field ordering (alphabetical)
    """
    
    def __init__(self):
        self.logger = logger.bind(component="exporter")
    
    def export_csv(
        self,
        bars: List[Bar],
        path: Optional[Path] = None,
        file: Optional[TextIO] = None,
    ) -> str:
        """
        Export bars to canonical CSV format.
        
        Args:
            bars: List of bars to export
            path: Output file path (optional)
            file: File-like object to write to (optional)
            
        Returns:
            CSV content as string
        """
        import io
        
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        
        # Header
        writer.writerow([
            "bar_index",
            "ts_start_ms",
            "ts_end_ms",
            "open",
            "high",
            "low",
            "close",
            "volume",
        ])
        
        # Sort by timestamp
        sorted_bars = sorted(bars, key=lambda b: b.ts_start_ms)
        
        # Data rows
        for bar in sorted_bars:
            writer.writerow([
                bar.bar_index,
                bar.ts_start_ms,
                bar.ts_end_ms,
                self._format_price(bar.open),
                self._format_price(bar.high),
                self._format_price(bar.low),
                self._format_price(bar.close),
                self._format_volume(bar.volume),
            ])
        
        content = output.getvalue()
        
        # Write to file if path provided
        if path:
            with open(path, "w", newline="") as f:
                f.write(content)
            self.logger.info("csv_exported", path=str(path), count=len(bars))
        
        if file:
            file.write(content)
        
        return content
    
    def export_json(
        self,
        bars: List[Bar],
        path: Optional[Path] = None,
    ) -> str:
        """
        Export bars to canonical JSON format.
        
        Args:
            bars: List of bars to export
            path: Output file path (optional)
            
        Returns:
            JSON content as string
        """
        # Build canonical representation
        data = []
        for bar in sorted(bars, key=lambda b: b.ts_start_ms):
            data.append({
                "bar_index": bar.bar_index,
                "close": bar.close,
                "high": bar.high,
                "low": bar.low,
                "open": bar.open,
                "ts_end_ms": bar.ts_end_ms,
                "ts_start_ms": bar.ts_start_ms,
                "volume": bar.volume,
            })
        
        content = json.dumps(data, sort_keys=True, indent=2)
        
        if path:
            with open(path, "w") as f:
                f.write(content)
            self.logger.info("json_exported", path=str(path), count=len(bars))
        
        return content
    
    def compute_hash(self, bars: List[Bar]) -> str:
        """
        Compute deterministic SHA256 hash of bars.
        
        Uses canonical JSON serialization for consistency.
        """
        # Build canonical data
        data = []
        for bar in sorted(bars, key=lambda b: b.ts_start_ms):
            data.append({
                "bar_index": bar.bar_index,
                "close": bar.close,
                "high": bar.high,
                "low": bar.low,
                "open": bar.open,
                "ts_end_ms": bar.ts_end_ms,
                "ts_start_ms": bar.ts_start_ms,
                "volume": bar.volume,
            })
        
        # Serialize with deterministic ordering
        json_str = json.dumps(data, sort_keys=True, separators=(",", ":"))
        
        return f"sha256:{hashlib.sha256(json_str.encode()).hexdigest()}"
    
    def _format_price(self, value: Optional[float]) -> str:
        """Format price for canonical output."""
        if value is None:
            return ""
        return f"{value:.8f}"
    
    def _format_volume(self, value: float) -> str:
        """Format volume for canonical output."""
        return f"{value:.2f}"
