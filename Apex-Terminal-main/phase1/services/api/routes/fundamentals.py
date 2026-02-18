"""
API Routes for Fundamentals Data
"""

from fastapi import APIRouter, HTTPException

from ...fundamentals import FundamentalsAdapter


router = APIRouter(tags=["Fundamentals"])


@router.get("/{symbol}")
async def get_fundamentals(symbol: str):
    """
    Get fundamental metrics for symbol
    
    Args:
        symbol: Ticker symbol (e.g., "AAPL")
    
    Returns:
        Fundamental metrics with "unavailable" for missing fields
    """
    try:
        adapter = FundamentalsAdapter()
        fundamentals = adapter.get_fundamentals(symbol.upper())
        
        if not fundamentals:
            raise HTTPException(404, f"Fundamentals not available for {symbol}")
        
        return {
            "symbol": fundamentals.symbol,
            "timestamp": int(fundamentals.timestamp.timestamp()),
            "provider": fundamentals.provider,
            "profitability": {
                "roic": fundamentals.roic if fundamentals.roic is not None else "unavailable",
                "gross_margin": fundamentals.gross_margin if fundamentals.gross_margin is not None else "unavailable",
                "operating_margin": fundamentals.operating_margin if fundamentals.operating_margin is not None else "unavailable",
            },
            "cash_flow": {
                "fcf": fundamentals.fcf if fundamentals.fcf is not None else "unavailable",
                "fcf_yield": fundamentals.fcf_yield if fundamentals.fcf_yield is not None else "unavailable",
                "shareholder_yield": fundamentals.shareholder_yield if fundamentals.shareholder_yield is not None else "unavailable",
            },
            "leverage": {
                "debt_to_equity": fundamentals.debt_to_equity if fundamentals.debt_to_equity is not None else "unavailable",
            },
            "quality": {
                "margin_stability": fundamentals.margin_stability or "unavailable",
                "earnings_quality": fundamentals.earnings_quality or "unavailable",
            },
            "valuation": {
                "ev_to_fcf": fundamentals.ev_to_fcf if fundamentals.ev_to_fcf is not None else "unavailable",
                "pe_ratio": fundamentals.pe_ratio if fundamentals.pe_ratio is not None else "unavailable",
                "pb_ratio": fundamentals.pb_ratio if fundamentals.pb_ratio is not None else "unavailable",
            },
            "growth": {
                "revenue_growth": fundamentals.revenue_growth if fundamentals.revenue_growth is not None else "unavailable",
                "earnings_growth": fundamentals.earnings_growth if fundamentals.earnings_growth is not None else "unavailable",
            },
            "additional": {
                "market_cap": fundamentals.market_cap if fundamentals.market_cap is not None else "unavailable",
                "enterprise_value": fundamentals.enterprise_value if fundamentals.enterprise_value is not None else "unavailable",
            },
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Fundamentals fetch failed: {str(e)}")
