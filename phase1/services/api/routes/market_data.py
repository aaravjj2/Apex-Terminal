"""
Market data API routes.

Provides endpoints for fetching bars and quotes from various providers.
"""

from fastapi import APIRouter, HTTPException
from typing import List
import structlog

from ...market_data import (
    get_market_data,
    list_providers,
    ProviderName,
    BarsRequest,
    BarsResponse,
    QuoteRequest,
    QuoteResponse,
    ProviderInfo
)

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/providers", response_model=List[ProviderInfo])
async def get_providers():
    """
    List all available market data providers.
    
    Returns list of providers with metadata (enabled, description, etc.)
    """
    try:
        providers = list_providers()
        return providers
    except Exception as e:
        logger.error(f"Error listing providers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bars", response_model=BarsResponse)
async def get_bars(
    request: BarsRequest,
    provider: ProviderName = ProviderName.DEMO
):
    """
    Get historical OHLCV bars for a symbol.
    
    Args:
        request: BarsRequest with symbol, start, end, interval
        provider: Provider to use (default: demo)
        
    Returns:
        BarsResponse with list of bars
    """
    try:
        logger.info(f"Fetching bars for {request.symbol} via {provider}")
        response = await get_market_data(provider, request)
        return response
    except ValueError as e:
        logger.warning(f"Invalid request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Provider error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quote", response_model=QuoteResponse)
async def get_quote(
    request: QuoteRequest,
    provider: ProviderName = ProviderName.DEMO
):
    """
    Get real-time quote for a symbol.
    
    Args:
        request: QuoteRequest with symbol
        provider: Provider to use (default: demo)
        
    Returns:
        QuoteResponse with quote data
    """
    try:
        logger.info(f"Fetching quote for {request.symbol} via {provider}")
        response = await get_market_data(provider, request)
        return response
    except ValueError as e:
        logger.warning(f"Invalid request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Provider error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
