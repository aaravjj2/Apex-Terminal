"""
API Routes for Pattern Detection
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

from ...charting.patterns import PatternDetector, Pattern, PatternType
from ...persistence.repository import BarRepository


router = APIRouter(tags=["Patterns"])


@router.get("/detect/{symbol}")
async def detect_patterns(
    symbol: str,
    timeframe: str = "1D",
    limit: int = Query(200, ge=50, le=1000),
    confidence_threshold: float = Query(0.5, ge=0.0, le=1.0),
):
    """
    Detect chart patterns for symbol
    
    Args:
        symbol: Ticker symbol
        timeframe: Bar timeframe
        limit: Number of bars to analyze
        confidence_threshold: Minimum confidence for patterns (0.0-1.0)
    """
    try:
        repo = BarRepository()
        bars = await repo.get_bars(
            symbol=symbol.upper(),
            timeframe=timeframe,
            limit=limit,
        )
        
        if not bars:
            raise HTTPException(404, f"No bars found for {symbol}/{timeframe}")
        
        # Detect patterns
        patterns = PatternDetector.detect_patterns(
            bars=bars,
            atr_values=None,  # TODO: Calculate ATR if needed
            vwap=None,  # TODO: Calculate VWAP if needed
            poc=None,  # TODO: Fetch POC if available
        )
        
        # Filter by confidence threshold
        filtered_patterns = [p for p in patterns if p.confidence >= confidence_threshold]
        
        # Sort by end time (most recent first)
        filtered_patterns.sort(key=lambda p: p.end_time, reverse=True)
        
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "patterns_found": len(filtered_patterns),
            "confidence_threshold": confidence_threshold,
            "patterns": [
                {
                    "pattern_type": p.pattern_type.value,
                    "start_time": int(p.start_time.timestamp()),
                    "end_time": int(p.end_time.timestamp()),
                    "start_index": p.start_index,
                    "end_index": p.end_index,
                    "confidence": round(p.confidence, 2),
                    "context": p.context,
                    "key_levels": p.key_levels,
                    "direction": p.direction,
                }
                for p in filtered_patterns
            ],
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Pattern detection failed: {str(e)}")
