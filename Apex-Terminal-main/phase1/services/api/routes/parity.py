"""
REST endpoints for parity verification.
"""

import csv
import hashlib
import io
import json
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import structlog

from ...persistence.repository import BarRepository
from ...models import Bar


logger = structlog.get_logger()
router = APIRouter()


class BarExportRow(BaseModel):
    """Canonical bar export format."""
    bar_index: int
    ts_start_ms: int
    ts_end_ms: int
    open: Optional[float]
    high: Optional[float]
    low: Optional[float]
    close: Optional[float]
    volume: float


class ParityResult(BaseModel):
    """Result of parity comparison."""
    match: bool
    local_hash: str
    reference_hash: Optional[str] = None
    local_count: int
    reference_count: int
    diffs: List[dict] = []
    message: str = ""


@router.get("/export/{symbol}/{timeframe}")
async def export_bars_csv(
    symbol: str,
    timeframe: str,
    from_ts: Optional[int] = Query(None, alias="from"),
    to_ts: Optional[int] = Query(None, alias="to"),
):
    """
    Export bars as canonical CSV for parity verification.
    
    Returns CSV with deterministic formatting for SHA256 comparison.
    """
    repository = BarRepository()
    symbol = symbol.upper()
    
    try:
        bars = await repository.get_bars(
            symbol=symbol,
            timeframe=timeframe,
            start_ms=from_ts,
            end_ms=to_ts,
            limit=100000,  # Large limit for exports
        )
        
        if not bars:
            raise HTTPException(status_code=404, detail="No bars found")
        
        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        
        # Header
        writer.writerow([
            "bar_index", "ts_start_ms", "ts_end_ms",
            "open", "high", "low", "close", "volume"
        ])
        
        # Data rows with canonical formatting
        for bar in bars:
            writer.writerow([
                bar.bar_index,
                bar.ts_start_ms,
                bar.ts_end_ms,
                _format_price(bar.open),
                _format_price(bar.high),
                _format_price(bar.low),
                _format_price(bar.close),
                _format_volume(bar.volume),
            ])
        
        # Return as streaming response
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={symbol}_{timeframe}_bars.csv"
            },
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("export_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hash/{symbol}/{timeframe}")
async def get_bars_hash(
    symbol: str,
    timeframe: str,
    from_ts: Optional[int] = Query(None, alias="from"),
    to_ts: Optional[int] = Query(None, alias="to"),
):
    """
    Get deterministic SHA256 hash of bars for parity verification.
    
    Hash is computed over canonical JSON representation of bars.
    """
    repository = BarRepository()
    symbol = symbol.upper()
    
    try:
        bars = await repository.get_bars(
            symbol=symbol,
            timeframe=timeframe,
            start_ms=from_ts,
            end_ms=to_ts,
            limit=100000,
        )
        
        if not bars:
            raise HTTPException(status_code=404, detail="No bars found")
        
        # Compute hash
        hash_value = _compute_bars_hash(bars)
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "count": len(bars),
            "hash": hash_value,
            "from_ms": bars[0].ts_start_ms if bars else None,
            "to_ms": bars[-1].ts_end_ms if bars else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("hash_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare/{symbol}/{timeframe}", response_model=ParityResult)
async def compare_with_reference(
    symbol: str,
    timeframe: str,
    file: UploadFile = File(..., description="Reference CSV file"),
    from_ts: Optional[int] = Query(None, alias="from"),
    to_ts: Optional[int] = Query(None, alias="to"),
):
    """
    Compare local bars with a reference CSV file.
    
    Returns detailed diff report.
    
    Expected CSV format:
    - TradingView export: time, open, high, low, close, Volume
    - Canonical format: bar_index, ts_start_ms, ts_end_ms, open, high, low, close, volume
    """
    repository = BarRepository()
    symbol = symbol.upper()
    
    try:
        # Load local bars
        local_bars = await repository.get_bars(
            symbol=symbol,
            timeframe=timeframe,
            start_ms=from_ts,
            end_ms=to_ts,
            limit=100000,
        )
        
        # Parse reference CSV
        content = await file.read()
        text = content.decode("utf-8")
        reference_bars = _parse_reference_csv(text)
        
        # Compute hashes
        local_hash = _compute_bars_hash(local_bars) if local_bars else ""
        reference_hash = _compute_reference_hash(reference_bars) if reference_bars else ""
        
        # Compare bars
        diffs = _compare_bars(local_bars, reference_bars)
        
        match = len(diffs) == 0 and len(local_bars) == len(reference_bars)
        
        return ParityResult(
            match=match,
            local_hash=local_hash,
            reference_hash=reference_hash,
            local_count=len(local_bars),
            reference_count=len(reference_bars),
            diffs=diffs[:100],  # Limit diffs in response
            message="Parity check passed" if match else f"Found {len(diffs)} differences",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("compare_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


def _format_price(value: Optional[float]) -> str:
    """Format price for canonical representation."""
    if value is None:
        return ""
    return f"{value:.8f}"


def _format_volume(value: float) -> str:
    """Format volume for canonical representation."""
    return f"{value:.2f}"


def _compute_bars_hash(bars: List[Bar]) -> str:
    """Compute deterministic hash of bars."""
    # Build canonical representation
    data = []
    for bar in bars:
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


def _compute_reference_hash(bars: List[dict]) -> str:
    """Compute hash for reference bars."""
    json_str = json.dumps(bars, sort_keys=True, separators=(",", ":"))
    return f"sha256:{hashlib.sha256(json_str.encode()).hexdigest()}"


def _parse_reference_csv(text: str) -> List[dict]:
    """
    Parse reference CSV with flexible column mapping.
    
    Supports:
    - TradingView format: time, open, high, low, close, Volume
    - Canonical format: bar_index, ts_start_ms, ts_end_ms, open, high, low, close, volume
    """
    reader = csv.DictReader(io.StringIO(text))
    bars = []
    
    for i, row in enumerate(reader):
        # Detect format by columns
        if "bar_index" in row:
            # Canonical format
            bars.append({
                "index": i,
                "ts_start_ms": int(row["ts_start_ms"]),
                "open": float(row["open"]) if row["open"] else None,
                "high": float(row["high"]) if row["high"] else None,
                "low": float(row["low"]) if row["low"] else None,
                "close": float(row["close"]) if row["close"] else None,
                "volume": float(row["volume"]) if row["volume"] else 0,
            })
        elif "time" in row:
            # TradingView format
            ts = _parse_tradingview_time(row["time"])
            bars.append({
                "index": i,
                "ts_start_ms": ts,
                "open": float(row["open"]) if row.get("open") else None,
                "high": float(row["high"]) if row.get("high") else None,
                "low": float(row["low"]) if row.get("low") else None,
                "close": float(row["close"]) if row.get("close") else None,
                "volume": float(row.get("Volume", row.get("volume", 0))),
            })
    
    return bars


def _parse_tradingview_time(time_str: str) -> int:
    """Parse TradingView timestamp format."""
    from datetime import datetime
    
    # Try various formats
    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(time_str, fmt)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    
    # Try as Unix timestamp
    try:
        ts = float(time_str)
        if ts > 10000000000:  # Already ms
            return int(ts)
        return int(ts * 1000)
    except ValueError:
        pass
    
    return 0


def _compare_bars(local_bars: List[Bar], reference_bars: List[dict]) -> List[dict]:
    """Compare local bars with reference bars."""
    diffs = []
    
    # Build lookup by timestamp
    local_by_ts = {bar.ts_start_ms: bar for bar in local_bars}
    ref_by_ts = {bar["ts_start_ms"]: bar for bar in reference_bars}
    
    # Find all timestamps
    all_ts = set(local_by_ts.keys()) | set(ref_by_ts.keys())
    
    for ts in sorted(all_ts):
        local = local_by_ts.get(ts)
        ref = ref_by_ts.get(ts)
        
        if local is None and ref is not None:
            diffs.append({
                "ts_start_ms": ts,
                "type": "missing_local",
                "reference": ref,
            })
        elif local is not None and ref is None:
            diffs.append({
                "ts_start_ms": ts,
                "type": "missing_reference",
                "local": {
                    "open": local.open,
                    "high": local.high,
                    "low": local.low,
                    "close": local.close,
                    "volume": local.volume,
                },
            })
        elif local is not None and ref is not None:
            # Compare values with tolerance
            price_diff = _compare_values(local, ref)
            if price_diff:
                diffs.append({
                    "ts_start_ms": ts,
                    "type": "value_mismatch",
                    "local": {
                        "open": local.open,
                        "high": local.high,
                        "low": local.low,
                        "close": local.close,
                        "volume": local.volume,
                    },
                    "reference": ref,
                    "differences": price_diff,
                })
    
    return diffs


def _compare_values(local: Bar, ref: dict, tolerance: float = 0.0001) -> List[str]:
    """Compare bar values with tolerance."""
    diffs = []
    
    fields = ["open", "high", "low", "close", "volume"]
    for field in fields:
        local_val = getattr(local, field)
        ref_val = ref.get(field)
        
        if local_val is None and ref_val is None:
            continue
        if local_val is None or ref_val is None:
            diffs.append(f"{field}: local={local_val}, ref={ref_val}")
            continue
        
        if abs(local_val - ref_val) > tolerance:
            diffs.append(f"{field}: local={local_val}, ref={ref_val}")
    
    return diffs
