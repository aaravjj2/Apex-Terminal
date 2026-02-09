"""
Parity comparator for verifying bar outputs against reference data.
"""

import csv
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Optional, Any
import structlog

from ..models import Bar


logger = structlog.get_logger()


@dataclass
class BarDiff:
    """Single bar difference."""
    ts_start_ms: int
    diff_type: str  # "missing_local", "missing_reference", "value_mismatch"
    field: Optional[str] = None
    local_value: Optional[Any] = None
    reference_value: Optional[Any] = None


@dataclass
class ParityReport:
    """Result of parity comparison."""
    match: bool
    local_count: int
    reference_count: int
    local_hash: str
    reference_hash: str
    diff_count: int
    diffs: List[BarDiff] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "match": self.match,
            "local_count": self.local_count,
            "reference_count": self.reference_count,
            "local_hash": self.local_hash,
            "reference_hash": self.reference_hash,
            "diff_count": self.diff_count,
            "diffs": [
                {
                    "ts_start_ms": d.ts_start_ms,
                    "type": d.diff_type,
                    "field": d.field,
                    "local": d.local_value,
                    "reference": d.reference_value,
                }
                for d in self.diffs
            ],
        }
    
    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


class BarComparator:
    """
    Compares local bars against reference data for parity verification.
    
    Features:
    - Deterministic hashing
    - Field-by-field comparison
    - Tolerance for floating point
    - Multiple CSV format support
    """
    
    def __init__(
        self,
        price_tolerance: float = 0.0001,
        volume_tolerance: float = 0.01,
    ):
        """
        Initialize comparator.
        
        Args:
            price_tolerance: Tolerance for price comparisons
            volume_tolerance: Tolerance for volume comparisons
        """
        self.price_tolerance = price_tolerance
        self.volume_tolerance = volume_tolerance
        self.logger = logger.bind(component="comparator")
    
    def compare(
        self,
        local_bars: List[Bar],
        reference_bars: List[dict],
    ) -> ParityReport:
        """
        Compare local bars against reference bars.
        
        Args:
            local_bars: Bars from local database
            reference_bars: Bars parsed from reference CSV
            
        Returns:
            ParityReport with comparison results
        """
        # Compute hashes
        local_hash = self._compute_hash(
            [self._bar_to_canonical(b) for b in local_bars]
        )
        reference_hash = self._compute_hash(reference_bars)
        
        # Build lookup maps
        local_by_ts = {bar.ts_start_ms: bar for bar in local_bars}
        ref_by_ts = {bar["ts_start_ms"]: bar for bar in reference_bars}
        
        # Find differences
        diffs = []
        all_timestamps = set(local_by_ts.keys()) | set(ref_by_ts.keys())
        
        for ts in sorted(all_timestamps):
            local = local_by_ts.get(ts)
            ref = ref_by_ts.get(ts)
            
            if local is None:
                diffs.append(BarDiff(
                    ts_start_ms=ts,
                    diff_type="missing_local",
                    reference_value=ref,
                ))
            elif ref is None:
                diffs.append(BarDiff(
                    ts_start_ms=ts,
                    diff_type="missing_reference",
                    local_value=self._bar_to_canonical(local),
                ))
            else:
                # Compare fields
                field_diffs = self._compare_bar_fields(local, ref)
                diffs.extend(field_diffs)
        
        return ParityReport(
            match=len(diffs) == 0,
            local_count=len(local_bars),
            reference_count=len(reference_bars),
            local_hash=local_hash,
            reference_hash=reference_hash,
            diff_count=len(diffs),
            diffs=diffs,
        )

    def compare_with_reference(
        self,
        local_bars: List[Bar],
        reference_path: Path,
    ) -> ParityReport:
        """
        Compare local bars against a reference CSV file.
        
        Args:
            local_bars: List of generated bars
            reference_path: Path to reference CSV file
            
        Returns:
            ParityReport with comparison results
        """
        reference_bars = self.load_reference_csv(reference_path)
        return self.compare(local_bars, reference_bars)
    
    def _compare_bar_fields(
        self,
        local: Bar,
        ref: dict,
    ) -> List[BarDiff]:
        """Compare individual fields of a bar."""
        diffs = []
        
        # Price fields
        for field in ["open", "high", "low", "close"]:
            local_val = getattr(local, field)
            ref_val = ref.get(field)
            
            if not self._values_equal(local_val, ref_val, self.price_tolerance):
                diffs.append(BarDiff(
                    ts_start_ms=local.ts_start_ms,
                    diff_type="value_mismatch",
                    field=field,
                    local_value=local_val,
                    reference_value=ref_val,
                ))
        
        # Volume
        local_vol = local.volume
        ref_vol = ref.get("volume", 0)
        if not self._values_equal(local_vol, ref_vol, self.volume_tolerance):
            diffs.append(BarDiff(
                ts_start_ms=local.ts_start_ms,
                diff_type="value_mismatch",
                field="volume",
                local_value=local_vol,
                reference_value=ref_vol,
            ))
        
        return diffs
    
    def _values_equal(
        self,
        val1: Optional[float],
        val2: Optional[float],
        tolerance: float,
    ) -> bool:
        """Compare two values with tolerance."""
        if val1 is None and val2 is None:
            return True
        if val1 is None or val2 is None:
            return False
        return abs(val1 - val2) <= tolerance
    
    def _bar_to_canonical(self, bar: Bar) -> dict:
        """Convert Bar to canonical dict."""
        return {
            "ts_start_ms": bar.ts_start_ms,
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume,
        }
    
    def _compute_hash(self, bars: List[dict]) -> str:
        """Compute deterministic hash of bars."""
        # Sort by timestamp
        sorted_bars = sorted(bars, key=lambda b: b.get("ts_start_ms", 0))
        
        # Normalize for hashing
        normalized = []
        for bar in sorted_bars:
            normalized.append({
                "close": bar.get("close"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "open": bar.get("open"),
                "ts_start_ms": bar.get("ts_start_ms"),
                "volume": bar.get("volume"),
            })
        
        json_str = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
        return f"sha256:{hashlib.sha256(json_str.encode()).hexdigest()}"
    
    def load_reference_csv(self, path: Path) -> List[dict]:
        """
        Load reference bars from CSV file.
        
        Supports multiple formats:
        - Canonical: bar_index, ts_start_ms, ts_end_ms, open, high, low, close, volume
        - TradingView: time, open, high, low, close, Volume
        """
        bars = []
        
        with open(path, "r", newline="") as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                bar = self._parse_csv_row(row)
                if bar:
                    bars.append(bar)
        
        self.logger.info("loaded_reference", path=str(path), count=len(bars))
        return bars
    
    def _parse_csv_row(self, row: dict) -> Optional[dict]:
        """Parse a CSV row into canonical format."""
        try:
            # Detect format
            if "ts_start_ms" in row:
                # Canonical format
                return {
                    "ts_start_ms": int(row["ts_start_ms"]),
                    "open": float(row["open"]) if row.get("open") else None,
                    "high": float(row["high"]) if row.get("high") else None,
                    "low": float(row["low"]) if row.get("low") else None,
                    "close": float(row["close"]) if row.get("close") else None,
                    "volume": float(row.get("volume", 0)),
                }
            elif "time" in row:
                # TradingView format
                ts = self._parse_timestamp(row["time"])
                return {
                    "ts_start_ms": ts,
                    "open": float(row["open"]) if row.get("open") else None,
                    "high": float(row["high"]) if row.get("high") else None,
                    "low": float(row["low"]) if row.get("low") else None,
                    "close": float(row["close"]) if row.get("close") else None,
                    "volume": float(row.get("Volume", row.get("volume", 0))),
                }
        except (ValueError, KeyError) as e:
            self.logger.warning("csv_parse_error", error=str(e), row=row)
        
        return None
    
    def _parse_timestamp(self, ts_str: str) -> int:
        """Parse various timestamp formats to milliseconds."""
        from datetime import datetime
        
        # Try ISO format
        for fmt in ["%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
            try:
                dt = datetime.strptime(ts_str, fmt)
                return int(dt.timestamp() * 1000)
            except ValueError:
                continue
        
        # Try numeric
        try:
            ts = float(ts_str)
            return int(ts * 1000) if ts < 10000000000 else int(ts)
        except ValueError:
            pass
        
        return 0
