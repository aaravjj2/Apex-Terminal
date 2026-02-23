"""
Waves 11-20 — Portfolio Construction API Routes
Allocation, exposure monitoring, sector diversification.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

from ...waves11_20.portfolio import get_portfolio_allocator

router = APIRouter(prefix="/api/v2/portfolio", tags=["portfolio-v2"])
logger = logging.getLogger(__name__)


class AllocateRequest(BaseModel):
    symbols: list[str]
    total_capital: float
    method: str = "equal_weight"  # "equal_weight" or "inverse_vol"
    max_position_pct: float = 10.0


class ExposureCheckRequest(BaseModel):
    symbol: str
    proposed_pct: float


@router.post("/allocate")
async def allocate(req: AllocateRequest):
    """Compute portfolio allocation."""
    allocator = get_portfolio_allocator()
    if req.method == "inverse_vol":
        result = allocator.inverse_vol_allocation(
            symbols=req.symbols,
            total_capital=req.total_capital,
            max_position_pct=req.max_position_pct,
        )
    else:
        result = allocator.equal_weight_allocation(
            symbols=req.symbols,
            total_capital=req.total_capital,
            max_position_pct=req.max_position_pct,
        )
    return result.to_dict()


@router.post("/exposure/check")
async def check_exposure(req: ExposureCheckRequest):
    """Check if a proposed position breaches exposure limits."""
    allocator = get_portfolio_allocator()
    limit = allocator.check_exposure(req.symbol, req.proposed_pct)
    return limit.to_dict()


@router.get("/exposure/dashboard")
async def exposure_dashboard():
    """Get exposure dashboard with sector breakdown."""
    allocator = get_portfolio_allocator()
    dashboard = allocator.get_exposure_dashboard()
    return dashboard.to_dict()


@router.get("/correlation")
async def correlation_matrix(
    symbols: str = Query(..., description="Comma-separated symbols"),
):
    """Compute correlation matrix for symbols."""
    allocator = get_portfolio_allocator()
    sym_list = [s.strip() for s in symbols.split(",")]
    matrix = allocator.compute_correlation(sym_list)
    return {"symbols": sym_list, "correlation_matrix": matrix}
