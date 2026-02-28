"""
watchlists.py — REST API routes for WatchlistEngine
=====================================================
30+ endpoints for watchlist CRUD, quotes, sorting, filtering,
analytics, heatmaps, and import/export.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.watchlist_engine import (
    WatchlistEngine, WatchlistType, SortDirection,
    ColumnEngine, WatchlistAnalytics, HeatmapEngine,
)

router = APIRouter(prefix="/api/v1/watchlists")

# ── Shared Engine ──
_engine = WatchlistEngine()


# ── Pydantic Models ──

class CreateWLRequest(BaseModel):
    name: str
    watchlist_type: str = "personal"
    description: str = ""


class RenameWLRequest(BaseModel):
    name: str


class AddSymbolRequest(BaseModel):
    symbol: str
    sector: str = ""
    industry: str = ""
    notes: str = ""
    cost_basis: float = 0.0
    shares: float = 0.0
    tags: List[str] = []


class MoveSymbolRequest(BaseModel):
    symbol: str
    new_index: int


class ReorderRequest(BaseModel):
    order: List[str]


class QuoteUpdateRequest(BaseModel):
    symbol: str
    data: Dict[str, Any]


class BulkQuoteUpdateRequest(BaseModel):
    quotes: Dict[str, Dict[str, Any]]


class SortRequest(BaseModel):
    sort_by: List[List[str]]  # [[field, "asc"|"desc"], ...]


class FilterRequest(BaseModel):
    filters: List[Dict[str, Any]]


class SearchRequest(BaseModel):
    query: str


class ImportRequest(BaseModel):
    symbols: List[str]


class GroupRequest(BaseModel):
    name: str


class AddToGroupRequest(BaseModel):
    group_name: str
    watchlist_id: str


class PriceHistoryRequest(BaseModel):
    price_history: Dict[str, List[float]]
    periods: Optional[List[int]] = None


def _wl_type(s: str) -> WatchlistType:
    return {
        "personal": WatchlistType.PERSONAL, "portfolio": WatchlistType.PORTFOLIO,
        "sector": WatchlistType.SECTOR, "index": WatchlistType.INDEX,
        "screener": WatchlistType.SCREENER, "shared": WatchlistType.SHARED,
    }.get(s.lower(), WatchlistType.PERSONAL)


def _sort_dir(s: str) -> SortDirection:
    return SortDirection.DESC if s.lower() == "desc" else SortDirection.ASC


# ── Watchlist CRUD ──

@router.post("/create")
async def create_watchlist(req: CreateWLRequest):
    wl_id = _engine.create_watchlist(req.name, _wl_type(req.watchlist_type),
                                      req.description)
    return {"id": wl_id, "name": req.name}


@router.get("/list")
async def list_watchlists():
    return {"watchlists": _engine.list_watchlists()}


@router.get("/{wl_id}")
async def get_watchlist(wl_id: str):
    wl = _engine.get_watchlist(wl_id)
    if not wl:
        raise HTTPException(404, f"Watchlist {wl_id} not found")
    return wl.to_dict()


@router.delete("/{wl_id}")
async def delete_watchlist(wl_id: str):
    if not _engine.delete_watchlist(wl_id):
        raise HTTPException(404, f"Watchlist {wl_id} not found")
    return {"deleted": wl_id}


@router.put("/{wl_id}/rename")
async def rename_watchlist(wl_id: str, req: RenameWLRequest):
    if not _engine.rename_watchlist(wl_id, req.name):
        raise HTTPException(404, f"Watchlist {wl_id} not found")
    return {"renamed": wl_id, "name": req.name}


# ── Symbol Management ──

@router.post("/{wl_id}/symbols")
async def add_symbol(wl_id: str, req: AddSymbolRequest):
    kwargs = {}
    if req.sector:
        kwargs["sector"] = req.sector
    if req.industry:
        kwargs["industry"] = req.industry
    if req.notes:
        kwargs["notes"] = req.notes
    if req.cost_basis:
        kwargs["cost_basis"] = req.cost_basis
    if req.shares:
        kwargs["shares"] = req.shares
    if req.tags:
        kwargs["tags"] = req.tags
    if not _engine.add_symbol(wl_id, req.symbol, **kwargs):
        raise HTTPException(400, f"Could not add {req.symbol}")
    return {"added": req.symbol}


@router.delete("/{wl_id}/symbols/{symbol}")
async def remove_symbol(wl_id: str, symbol: str):
    if not _engine.remove_symbol(wl_id, symbol):
        raise HTTPException(404, f"Symbol {symbol} not found")
    return {"removed": symbol}


@router.post("/{wl_id}/symbols/move")
async def move_symbol(wl_id: str, req: MoveSymbolRequest):
    if not _engine.move_symbol(wl_id, req.symbol, req.new_index):
        raise HTTPException(400, "Could not move symbol")
    return {"moved": req.symbol, "to": req.new_index}


@router.post("/{wl_id}/symbols/reorder")
async def reorder_symbols(wl_id: str, req: ReorderRequest):
    wl = _engine.get_watchlist(wl_id)
    if not wl:
        raise HTTPException(404, f"Watchlist {wl_id} not found")
    if not wl.reorder(req.order):
        raise HTTPException(400, "Invalid order — must contain all symbols")
    return {"reordered": True}


@router.get("/{wl_id}/symbols")
async def list_symbols(wl_id: str):
    wl = _engine.get_watchlist(wl_id)
    if not wl:
        raise HTTPException(404, f"Watchlist {wl_id} not found")
    items = wl.get_ordered_items()
    return {"symbols": [{"symbol": i.symbol, "sector": i.sector,
                          "notes": i.notes} for i in items]}


# ── Quotes ──

@router.post("/quotes/update")
async def update_quote(req: QuoteUpdateRequest):
    quote = _engine.update_quote(req.symbol, req.data)
    return {"updated": req.symbol, "last": quote.last}


@router.post("/quotes/bulk-update")
async def bulk_update_quotes(req: BulkQuoteUpdateRequest):
    updated = _engine.bulk_update_quotes(req.quotes)
    return {"updated": updated}


# ── Sorting ──

@router.post("/{wl_id}/sort")
async def sort_watchlist(wl_id: str, req: SortRequest):
    sort_by = [(s[0], _sort_dir(s[1] if len(s) > 1 else "asc"))
               for s in req.sort_by]
    items = _engine.sort_watchlist(wl_id, sort_by)
    return {"sorted": [i.symbol for i in items], "count": len(items)}


# ── Filtering ──

@router.post("/{wl_id}/filter")
async def filter_watchlist(wl_id: str, req: FilterRequest):
    items = _engine.filter_watchlist(wl_id, req.filters)
    return {"filtered": [i.symbol for i in items], "count": len(items)}


@router.post("/{wl_id}/search")
async def search_watchlist(wl_id: str, req: SearchRequest):
    items = _engine.search_watchlist(wl_id, req.query)
    return {"results": [i.symbol for i in items], "count": len(items)}


# ── Analytics ──

@router.get("/{wl_id}/analytics/sector-breakdown")
async def sector_breakdown(wl_id: str):
    return _engine.sector_breakdown(wl_id)


@router.get("/{wl_id}/analytics/gainers-losers")
async def gainers_losers(wl_id: str, top_n: int = 5):
    return _engine.gainers_losers(wl_id, top_n)


@router.get("/{wl_id}/analytics/market-breadth")
async def market_breadth(wl_id: str):
    return _engine.market_breadth(wl_id)


@router.get("/{wl_id}/analytics/summary")
async def summary_stats(wl_id: str):
    return _engine.summary_stats(wl_id)


@router.get("/{wl_id}/analytics/heatmap")
async def sector_heatmap(wl_id: str):
    return _engine.sector_heatmap(wl_id)


# ── Import / Export ──

@router.get("/{wl_id}/export")
async def export_symbols(wl_id: str):
    symbols = _engine.export_symbols(wl_id)
    if not symbols and not _engine.get_watchlist(wl_id):
        raise HTTPException(404, f"Watchlist {wl_id} not found")
    return {"symbols": symbols, "count": len(symbols)}


@router.post("/{wl_id}/import")
async def import_symbols(wl_id: str, req: ImportRequest):
    added = _engine.import_symbols(wl_id, req.symbols)
    return {"imported": added}


# ── Groups ──

@router.post("/groups/create")
async def create_group(req: GroupRequest):
    if not _engine.create_group(req.name):
        raise HTTPException(400, f"Group {req.name} already exists")
    return {"created": req.name}


@router.post("/groups/add")
async def add_to_group(req: AddToGroupRequest):
    if not _engine.add_to_group(req.group_name, req.watchlist_id):
        raise HTTPException(400, "Could not add to group")
    return {"added": req.watchlist_id, "group": req.group_name}


@router.get("/groups/list")
async def list_groups():
    return _engine.list_groups()


# ── Columns ──

@router.get("/columns/available")
async def available_columns():
    return {"columns": ColumnEngine.list_columns(),
            "count": len(ColumnEngine.COLUMNS)}


@router.get("/columns/default")
async def default_columns():
    cols = ColumnEngine.default_columns()
    return {"columns": [{"field": c.field, "label": c.label,
                          "format": c.format.value} for c in cols]}


@router.get("/columns/portfolio")
async def portfolio_columns():
    cols = ColumnEngine.portfolio_columns()
    return {"columns": [{"field": c.field, "label": c.label,
                          "format": c.format.value} for c in cols]}


# ── Capabilities ──

@router.get("/capabilities")
async def capabilities():
    return _engine.capabilities()
