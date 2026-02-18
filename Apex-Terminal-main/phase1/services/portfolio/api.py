"""
Portfolio CRUD API Endpoints (v1.20)
RESTful endpoints for portfolio management in DEMO mode.
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
from pydantic import BaseModel
import json

from .schemas import (
    Portfolio,
    PortfolioCreateRequest,
    PortfolioUpdateRequest,
    PositionCreateRequest,
    PortfolioListResponse,
    PortfolioExport,
    PortfolioImportRequest,
    ValuationSnapshot
)
from .store import get_demo_store
from .fixtures import create_demo_fixtures
from .valuation import compute_portfolio_valuation


router = APIRouter(prefix="/api/v1/portfolios", tags=["portfolios"])


# Initialize store with fixtures on module load
_store = get_demo_store()
_store.seed_fixtures(create_demo_fixtures())


@router.get("", response_model=PortfolioListResponse)
async def list_portfolios(sort_by: str = "portfolio_id"):
    """
    List all portfolios with stable ordering.
    
    Query Parameters:
        sort_by: Sort field (portfolio_id, name, created_at)
    
    Returns:
        PortfolioListResponse with sorted portfolio list
    """
    portfolios = _store.list_portfolios(sort_by=sort_by)
    return PortfolioListResponse(
        portfolios=portfolios,
        total_count=len(portfolios)
    )


@router.get("/{portfolio_id}", response_model=Portfolio)
async def get_portfolio(portfolio_id: str):
    """
    Get a specific portfolio by ID.
    
    Path Parameters:
        portfolio_id: Portfolio identifier
    
    Returns:
        Portfolio object
    
    Raises:
        404: Portfolio not found
    """
    portfolio = _store.get_portfolio(portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    return portfolio


@router.post("", response_model=Portfolio, status_code=status.HTTP_201_CREATED)
async def create_portfolio(request: PortfolioCreateRequest):
    """
    Create a new portfolio.
    
    Request Body:
        PortfolioCreateRequest with name, currency, initial_cash
    
    Returns:
        Created Portfolio object
    """
    portfolio = _store.create_portfolio(request)
    return portfolio


@router.put("/{portfolio_id}", response_model=Portfolio)
async def update_portfolio(portfolio_id: str, request: PortfolioUpdateRequest):
    """
    Update portfolio metadata.
    
    Path Parameters:
        portfolio_id: Portfolio identifier
    
    Request Body:
        PortfolioUpdateRequest with optional name, currency
    
    Returns:
        Updated Portfolio object
    
    Raises:
        404: Portfolio not found
    """
    portfolio = _store.update_portfolio(portfolio_id, request)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    return portfolio


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(portfolio_id: str):
    """
    Delete a portfolio.
    
    Path Parameters:
        portfolio_id: Portfolio identifier
    
    Raises:
        404: Portfolio not found
    """
    success = _store.delete_portfolio(portfolio_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )


@router.post("/{portfolio_id}/positions", response_model=Portfolio)
async def add_position(portfolio_id: str, request: PositionCreateRequest):
    """
    Add or update a position in a portfolio.
    
    Path Parameters:
        portfolio_id: Portfolio identifier
    
    Request Body:
        PositionCreateRequest with symbol, quantity, cost_basis
    
    Returns:
        Updated Portfolio object
    
    Raises:
        404: Portfolio not found
    """
    portfolio = _store.add_position(portfolio_id, request)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    return portfolio


@router.get("/{portfolio_id}/export", response_model=PortfolioExport)
async def export_portfolio(portfolio_id: str):
    """
    Export portfolio in canonical format for determinism verification.
    
    Path Parameters:
        portfolio_id: Portfolio identifier
    
    Returns:
        PortfolioExport with canonical format and export_hash
    
    Raises:
        404: Portfolio not found
    """
    portfolio = _store.get_portfolio(portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    
    export = PortfolioExport(portfolio=portfolio)
    export.export_hash = export.compute_export_hash()
    
    return export


@router.post("/import", response_model=Portfolio, status_code=status.HTTP_201_CREATED)
async def import_portfolio(request: PortfolioImportRequest):
    """
    v1.23: Import a portfolio from canonical export format.
    
    Validates schema version compatibility and optionally verifies export hash.
    The imported portfolio gets a new ID if one with the same ID already exists.
    
    Request Body:
        PortfolioImportRequest with portfolio data and optional export_hash
    
    Returns:
        Imported Portfolio object
    
    Raises:
        400: Invalid schema version or hash mismatch
    """
    portfolio = request.portfolio
    
    # Verify export hash if provided
    if request.export_hash:
        export_for_verify = PortfolioExport(portfolio=portfolio)
        computed = export_for_verify.compute_export_hash()
        if computed != request.export_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Export hash mismatch: expected {request.export_hash}, got {computed}"
            )
    
    # Check if portfolio_id already exists; if so, create new ID
    existing = _store.get_portfolio(portfolio.portfolio_id)
    if existing:
        # Create with a new ID but preserve all other data
        create_req = PortfolioCreateRequest(
            name=f"{portfolio.name} (imported)",
            currency=portfolio.currency,
            initial_cash=portfolio.cash_balance
        )
        new_portfolio = _store.create_portfolio(create_req)
        
        # Copy positions
        from .schemas import PositionCreateRequest as PosReq
        for pos in portfolio.positions:
            pos_req = PosReq(
                symbol=pos.symbol,
                quantity=pos.quantity,
                cost_basis_per_unit=pos.average_cost_basis,
                acquisition_date=pos.lots[0].acquisition_date if pos.lots else None
            )
            _store.add_position(new_portfolio.portfolio_id, pos_req)
        
        # Refresh to get updated state
        new_portfolio = _store.get_portfolio(new_portfolio.portfolio_id)
        return new_portfolio
    else:
        # Import with the same ID
        portfolio.content_hash = portfolio.compute_hash()
        _store._portfolios[portfolio.portfolio_id] = portfolio
        return portfolio


@router.get("/{portfolio_id}/valuation", response_model=ValuationSnapshot)
async def get_portfolio_valuation(portfolio_id: str):
    """
    Get deterministic valuation for a portfolio (v1.21).
    
    Uses fixture-based pricing (DEMO mode) for stable, reproducible valuations.
    
    Path Parameters:
        portfolio_id: Portfolio identifier
    
    Returns:
        ValuationSnapshot with net value, PnL, per-position details, and valuation inputs
    
    Raises:
        404: Portfolio not found
    """
    portfolio = _store.get_portfolio(portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    
    # Compute valuation using deterministic pricing
    valuation = compute_portfolio_valuation(portfolio)
    
    return valuation


@router.post("/reset", status_code=status.HTTP_200_OK)
async def reset_portfolios():
    """
    Reset portfolios to fixture state (DEMO mode only).
    Useful for testing and resetting to known state.
    
    Returns:
        Success message
    """
    _store.clear()
    _store.seed_fixtures(create_demo_fixtures())
    return {"message": "Portfolios reset to fixture state", "count": len(_store.list_portfolios())}


class MultiValuationRequest(BaseModel):
    portfolio_ids: List[str]


@router.post("/multi-valuation")
async def multi_portfolio_valuation(req: MultiValuationRequest):
    """
    v1.25: Get valuations for multiple portfolios at once.
    Returns deterministic, combined summary and per-portfolio details.
    """
    results = []
    for pid in sorted(req.portfolio_ids):  # Deterministic ordering
        portfolio = _store.get_portfolio(pid)
        if portfolio:
            valuation = compute_portfolio_valuation(portfolio)
            results.append({
                "portfolio_id": valuation.portfolio_id,
                "net_value": float(valuation.net_value),
                "unrealised_pnl": float(valuation.pnl_total),
                "positions": len(valuation.per_position),
            })

    total_net = sum(v["net_value"] for v in results)
    total_pnl = sum(v["unrealised_pnl"] for v in results)

    return {
        "portfolio_count": len(results),
        "total_net_value": round(total_net, 2),
        "total_pnl": round(total_pnl, 2),
        "valuations": results,
    }
