"""
pattern_recognition_routes.py — Pattern Recognition REST API
==============================================================
Candlestick patterns, chart patterns, support/resistance,
trend lines, harmonics detection.

Endpoints:
    POST /api/v2/patterns/candlestick       → Scan candlestick patterns
    POST /api/v2/patterns/chart              → Detect chart patterns
    POST /api/v2/patterns/support-resistance → Find S/R levels
    POST /api/v2/patterns/trend-lines        → Detect trend lines
    POST /api/v2/patterns/scan-all           → Full pattern scan
    GET  /api/v2/patterns/capabilities       → Engine capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from phase1.services.pattern_recognition_engine import PatternRecognitionEngine

router = APIRouter(prefix="/api/v2/patterns", tags=["Pattern Recognition"])

_engine = PatternRecognitionEngine()


class BarInput(BaseModel):
    open: float
    high: float
    low: float
    close: float
    volume: float = 0

class PatternScanRequest(BaseModel):
    bars: List[BarInput]

class SRRequest(BaseModel):
    bars: List[BarInput]
    num_levels: int = 5
    lookback: int = 20

class TrendLineRequest(BaseModel):
    bars: List[BarInput]
    lookback: int = 20


@router.post("/candlestick")
def candlestick(req: PatternScanRequest):
    data = [{"open": b.open, "high": b.high, "low": b.low,
             "close": b.close, "volume": b.volume} for b in req.bars]
    result = _engine.scan_from_dicts(data)
    candlestick_patterns = [p.to_dict() for p in result if p.pattern_type.value.startswith("CANDLESTICK")]
    return {"ok": True, "patterns": [p.to_dict() for p in _engine.scan_candlestick_patterns(
        _engine._to_ohlcv(data))]}


@router.post("/chart")
def chart_patterns(req: PatternScanRequest):
    data = [{"open": b.open, "high": b.high, "low": b.low,
             "close": b.close, "volume": b.volume} for b in req.bars]
    bars = _engine._to_ohlcv(data)
    result = _engine.scan_chart_patterns(bars)
    return {"ok": True, "patterns": [p.to_dict() for p in result]}


@router.post("/support-resistance")
def support_resistance(req: SRRequest):
    data = [{"open": b.open, "high": b.high, "low": b.low,
             "close": b.close, "volume": b.volume} for b in req.bars]
    bars = _engine._to_ohlcv(data)
    result = _engine.find_support_resistance(bars, req.num_levels, req.lookback)
    return {"ok": True, "levels": [l.to_dict() for l in result]}


@router.post("/trend-lines")
def trend_lines(req: TrendLineRequest):
    data = [{"open": b.open, "high": b.high, "low": b.low,
             "close": b.close, "volume": b.volume} for b in req.bars]
    bars = _engine._to_ohlcv(data)
    result = _engine.find_trend_lines(bars, req.lookback)
    return {"ok": True, "trend_lines": [t.to_dict() for t in result]}


@router.post("/scan-all")
def scan_all(req: PatternScanRequest):
    data = [{"open": b.open, "high": b.high, "low": b.low,
             "close": b.close, "volume": b.volume} for b in req.bars]
    result = _engine.scan_from_dicts(data)
    return {"ok": True, "patterns": [p.to_dict() for p in result]}


@router.get("/capabilities")
def capabilities():
    return {"ok": True, **_engine.capabilities()}
