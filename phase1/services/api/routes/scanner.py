"""
scanner.py — REST API routes for ScannerEngine
=================================================
25+ endpoints for predefined scans, composite scans, custom filters,
and scanner management.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.scanner_engine import ScannerEngine, ScanFilter, FilterOperator

router = APIRouter(prefix="/api/v1/scanner")

# ── Shared Engine ──
_engine = ScannerEngine()


# ── Pydantic Models ──

class AddSymbolRequest(BaseModel):
    symbol: str
    close: List[float]
    high: Optional[List[float]] = None
    low: Optional[List[float]] = None
    open: Optional[List[float]] = None
    volume: Optional[List[float]] = None
    fundamentals: Optional[Dict[str, float]] = None


class BulkAddRequest(BaseModel):
    symbols: List[AddSymbolRequest]


class PredefinedScanRequest(BaseModel):
    scan_name: str
    top_n: int = 20


class FilterInput(BaseModel):
    field: str
    operator: str  # gt, gte, lt, lte, eq, neq, between
    value: float = 0.0
    value2: Optional[float] = None  # for BETWEEN


class CompositeRequest(BaseModel):
    scan_names: List[str]
    mode: str = "and"  # and | or
    top_n: int = 20


class CustomScanRequest(BaseModel):
    filters: List[FilterInput]
    sort_by: str = "score"
    ascending: bool = False
    top_n: int = 20


class RankRequest(BaseModel):
    symbols: List[str]
    field: str
    ascending: bool = True
    top_n: int = 20


# ── Helpers ──

def _op_from_str(op: str) -> FilterOperator:
    mapping = {
        "gt": FilterOperator.GT, "gte": FilterOperator.GTE,
        "lt": FilterOperator.LT, "lte": FilterOperator.LTE,
        "eq": FilterOperator.EQ, "neq": FilterOperator.NEQ,
        "between": FilterOperator.BETWEEN,
        "crosses_above": FilterOperator.CROSSES_ABOVE,
        "crosses_below": FilterOperator.CROSSES_BELOW,
    }
    return mapping.get(op.lower(), FilterOperator.GT)


def _result_to_dict(results):
    """Convert ScanResult list to serializable dicts."""
    return [{"symbol": r.symbol, "score": r.score, "values": r.values,
             "reason": r.reason} for r in results]


# ── Symbol Management ──

@router.post("/symbols/add")
async def add_symbol(req: AddSymbolRequest):
    import numpy as np
    from services.scanner_engine import SymbolData
    sd = SymbolData(
        symbol=req.symbol,
        close=np.array(req.close),
        high=np.array(req.high) if req.high else np.array(req.close),
        low=np.array(req.low) if req.low else np.array(req.close),
        open=np.array(req.open) if req.open else np.array(req.close),
        volume=np.array(req.volume) if req.volume else np.zeros(len(req.close)),
        fundamentals=req.fundamentals or {},
    )
    _engine.add_symbol(sd)
    return {"status": "ok", "symbol": req.symbol}


@router.post("/symbols/bulk-add")
async def bulk_add_symbols(req: BulkAddRequest):
    import numpy as np
    from services.scanner_engine import SymbolData
    added = 0
    for s in req.symbols:
        sd = SymbolData(
            symbol=s.symbol,
            close=np.array(s.close),
            high=np.array(s.high) if s.high else np.array(s.close),
            low=np.array(s.low) if s.low else np.array(s.close),
            open=np.array(s.open) if s.open else np.array(s.close),
            volume=np.array(s.volume) if s.volume else np.zeros(len(s.close)),
            fundamentals=s.fundamentals or {},
        )
        _engine.add_symbol(sd)
        added += 1
    return {"added": added}


@router.delete("/symbols/{symbol}")
async def remove_symbol(symbol: str):
    removed = _engine.remove_symbol(symbol)
    if not removed:
        raise HTTPException(404, f"Symbol {symbol} not found")
    return {"removed": symbol}


@router.get("/symbols")
async def list_symbols():
    return {"symbols": list(_engine._symbols.keys()),
            "count": len(_engine._symbols)}


# ── Predefined Scans ──

@router.get("/predefined/list")
async def list_predefined():
    from services.scanner_engine import PredefinedScans
    return {"scans": PredefinedScans.list_scans()}


@router.post("/predefined/run")
async def run_predefined(req: PredefinedScanRequest):
    results = _engine.run_predefined(req.scan_name, req.top_n)
    return {"scan": req.scan_name, "count": len(results),
            "results": _result_to_dict(results)}


# ── Composite Scans ──

@router.post("/composite/run")
async def run_composite(req: CompositeRequest):
    results = _engine.run_composite(req.scan_names, req.mode, req.top_n)
    return {"mode": req.mode, "scans": req.scan_names,
            "count": len(results), "results": _result_to_dict(results)}


# ── Custom Scans ──

@router.post("/custom/run")
async def run_custom(req: CustomScanRequest):
    filters = [ScanFilter(f.field, _op_from_str(f.operator),
                           f.value if f.value2 is None else (f.value, f.value2))
               for f in req.filters]
    results = _engine.run_custom(filters, req.sort_by, req.ascending, req.top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


# ── Individual Scan Methods ──

@router.get("/scan/golden-cross")
async def scan_golden_cross(top_n: int = 20):
    results = _engine.run_predefined("golden_cross", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/death-cross")
async def scan_death_cross(top_n: int = 20):
    results = _engine.run_predefined("death_cross", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/rsi-oversold")
async def scan_rsi_oversold(top_n: int = 20):
    results = _engine.run_predefined("rsi_oversold", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/rsi-overbought")
async def scan_rsi_overbought(top_n: int = 20):
    results = _engine.run_predefined("rsi_overbought", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/volume-spike")
async def scan_volume_spike(top_n: int = 20):
    results = _engine.run_predefined("volume_spike", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/bollinger-squeeze")
async def scan_bollinger_squeeze(top_n: int = 20):
    results = _engine.run_predefined("bollinger_squeeze", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/new-highs")
async def scan_new_highs(top_n: int = 20):
    results = _engine.run_predefined("new_high", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/new-lows")
async def scan_new_lows(top_n: int = 20):
    results = _engine.run_predefined("new_low", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/gap-up")
async def scan_gap_up(top_n: int = 20):
    results = _engine.run_predefined("gap_up", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


@router.get("/scan/gap-down")
async def scan_gap_down(top_n: int = 20):
    results = _engine.run_predefined("gap_down", top_n)
    return {"count": len(results), "results": _result_to_dict(results)}


# ── History ──

@router.get("/history")
async def scan_history(limit: int = 50):
    return {"history": _engine.get_history(limit)}


# ── Capabilities ──

@router.get("/capabilities")
async def scanner_capabilities():
    return _engine.capabilities()
