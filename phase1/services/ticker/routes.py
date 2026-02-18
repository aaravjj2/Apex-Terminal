"""
Ticker API routes.
"""
from fastapi import APIRouter
from .models import (
    TickerResolveRequest,
    TickerResolveResponse,
    TickerBatchRequest,
    TickerBatchResponse,
    TickerNormalizeRequest,
    TickerNormalizeResponse,
)
from .service import normalize_ticker, resolve_ticker

router = APIRouter(prefix="/api/v1/ticker", tags=["ticker"])


@router.post("/resolve", response_model=TickerResolveResponse)
async def resolve_single_ticker(request: TickerResolveRequest) -> TickerResolveResponse:
    """
    Resolve a single ticker with normalization and collision detection.
    """
    return resolve_ticker(request.ticker)


@router.post("/resolve/batch", response_model=TickerBatchResponse)
async def resolve_batch_tickers(request: TickerBatchRequest) -> TickerBatchResponse:
    """
    Resolve multiple tickers in one request.
    """
    results = [resolve_ticker(ticker) for ticker in request.tickers]
    return TickerBatchResponse(results=results)


@router.post("/normalize", response_model=TickerNormalizeResponse)
async def normalize_ticker_endpoint(request: TickerNormalizeRequest) -> TickerNormalizeResponse:
    """
    Quick normalization without full resolution logic.
    """
    normalized = normalize_ticker(request.ticker)
    return TickerNormalizeResponse(normalized=normalized)
