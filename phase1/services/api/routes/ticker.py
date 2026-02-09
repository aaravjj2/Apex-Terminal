"""
Ticker resolution API routes.

Provides endpoints for disambiguating ticker symbols from raw user input.
Handles English word collisions (A, I, ON, IT, ARE) and separator normalization (BRK-B → BRK.B).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import structlog

from ..ticker_resolver import resolve_ticker, resolve_ticker_batch, get_normalized_form, classify_token, classify_tokens_batch

logger = structlog.get_logger(__name__)

router = APIRouter()


# Request/Response Models
class TickerResolveRequest(BaseModel):
    """Request model for single ticker resolution."""
    symbol: str = Field(..., description="Raw ticker symbol input from user")


class TickerResolveBatchRequest(BaseModel):
    """Request model for batch ticker resolution."""
    symbols: List[str] = Field(..., description="List of raw ticker symbols")


class TickerResolveResponse(BaseModel):
    """Response model for ticker resolution."""
    ticker: str = Field(..., description="Canonical ticker symbol")
    normalized: str = Field(..., description="Normalized form used for lookup")
    confidence: str = Field(..., description="Confidence level: high or low")
    reason: str = Field(..., description="Explanation of resolution result")
    collision: bool = Field(..., description="True if ticker is an English word collision")
    company: Optional[str] = Field(None, description="Company name if known")


class TickerResolveNormalizeRequest(BaseModel):
    """Request model for quick normalization."""
    symbol: str = Field(..., description="Raw ticker symbol input")


class TickerResolveNormalizeResponse(BaseModel):
    """Response model for quick normalization."""
    normalized: str = Field(..., description="Normalized ticker form")


# Objective H: Finance Lexicon Disambiguation (v1.12)
class TokenClassifyRequest(BaseModel):
    """Request model for token classification."""
    token: str = Field(..., description="Raw token input from user")


class TokenClassifyBatchRequest(BaseModel):
    """Request model for batch token classification."""
    tokens: List[str] = Field(..., description="List of raw token inputs")


class TokenClassifyResponse(BaseModel):
    """Response model for token classification."""
    classification: str = Field(..., description="Classification: TICKER | WORD | AMBIGUOUS | INVALID")
    ticker: Optional[str] = Field(None, description="Canonical ticker if applicable")
    confidence: str = Field(..., description="Confidence level: high | low | none")
    reason: str = Field(..., description="Human-readable explanation")
    company: Optional[str] = Field(None, description="Company name if known")
    disambiguation_needed: bool = Field(..., description="True if user needs to disambiguate")


# Endpoints
@router.post("/resolve", response_model=TickerResolveResponse)
async def resolve_ticker_endpoint(req: TickerResolveRequest) -> TickerResolveResponse:
    """
    Resolve a single ticker symbol.
    
    Handles:
    - Separator normalization (BRK-B, BRK/B → BRK.B)
    - Case normalization (aapl → AAPL)
    - Whitespace trimming
    - English word collision detection (A, I, ON, IT, ARE)
    - Unknown ticker handling
    
    Returns low confidence for collision tickers and unknown tickers,
    requiring user confirmation in UX.
    """
    try:
        result = resolve_ticker(req.symbol)
        logger.info(
            "ticker_resolved",
            input=req.symbol,
            ticker=result["ticker"],
            confidence=result["confidence"],
            collision=result["collision"]
        )
        return TickerResolveResponse(**result)
    except Exception as e:
        logger.error("ticker_resolution_failed", input=req.symbol, error=str(e))
        raise HTTPException(status_code=500, detail=f"Ticker resolution failed: {str(e)}")


@router.post("/resolve/batch", response_model=List[TickerResolveResponse])
async def resolve_ticker_batch_endpoint(req: TickerResolveBatchRequest) -> List[TickerResolveResponse]:
    """
    Resolve multiple ticker symbols in batch.
    
    Same resolution rules as single endpoint, applied to each symbol.
    """
    try:
        results = resolve_ticker_batch(req.symbols)
        logger.info(
            "ticker_batch_resolved",
            count=len(req.symbols),
            low_confidence_count=sum(1 for r in results if r["confidence"] == "low")
        )
        return [TickerResolveResponse(**r) for r in results]
    except Exception as e:
        logger.error("ticker_batch_resolution_failed", count=len(req.symbols), error=str(e))
        raise HTTPException(status_code=500, detail=f"Batch ticker resolution failed: {str(e)}")


@router.post("/normalize", response_model=TickerResolveNormalizeResponse)
async def normalize_ticker_endpoint(req: TickerResolveNormalizeRequest) -> TickerResolveNormalizeResponse:
    """
    Quick normalization endpoint for display purposes.
    
    Returns normalized form without full resolution logic.
    Useful for frontend display before user confirmation.
    """
    try:
        normalized = get_normalized_form(req.symbol)
        return TickerResolveNormalizeResponse(normalized=normalized)
    except Exception as e:
        logger.error("ticker_normalization_failed", input=req.symbol, error=str(e))
        raise HTTPException(status_code=500, detail=f"Ticker normalization failed: {str(e)}")


# Objective H: Finance Lexicon Disambiguation Endpoints (v1.12)
@router.post("/classify", response_model=TokenClassifyResponse)
async def classify_token_endpoint(req: TokenClassifyRequest) -> TokenClassifyResponse:
    """
    Classify a token as TICKER, WORD, AMBIGUOUS, or INVALID.
    
    Deterministic classification rules:
    - INVALID: Empty or contains only whitespace/special chars
    - TICKER: Known ticker in lexicon, not a collision word (high confidence)
    - AMBIGUOUS: Known ticker in lexicon AND marked as collision (e.g., A, I, ON, IT, ARE)
    - WORD: Not in lexicon, assumed to be English word or invalid ticker
    
    AMBIGUOUS classification requires user disambiguation via modal/panel.
    """
    try:
        result = classify_token(req.token)
        logger.info(
            "token_classified",
            input=req.token,
            classification=result["classification"],
            disambiguation_needed=result["disambiguation_needed"]
        )
        return TokenClassifyResponse(**result)
    except Exception as e:
        logger.error("token_classification_failed", input=req.token, error=str(e))
        raise HTTPException(status_code=500, detail=f"Token classification failed: {str(e)}")


@router.post("/classify/batch", response_model=List[TokenClassifyResponse])
async def classify_tokens_batch_endpoint(req: TokenClassifyBatchRequest) -> List[TokenClassifyResponse]:
    """
    Classify multiple tokens in batch.
    
    Same classification rules as single endpoint, applied to each token.
    """
    try:
        results = classify_tokens_batch(req.tokens)
        logger.info(
            "tokens_batch_classified",
            count=len(req.tokens),
            ambiguous_count=sum(1 for r in results if r["disambiguation_needed"])
        )
        return [TokenClassifyResponse(**r) for r in results]
    except Exception as e:
        logger.error("tokens_batch_classification_failed", count=len(req.tokens), error=str(e))
        raise HTTPException(status_code=500, detail=f"Batch token classification failed: {str(e)}")
