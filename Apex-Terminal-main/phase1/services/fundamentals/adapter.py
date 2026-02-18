"""
Fundamentals Data Adapter
Fetches fundamental metrics from allowed sources (yfinance)
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class FundamentalsData:
    """Fundamental metrics for a symbol"""
    symbol: str
    timestamp: datetime
    provider: str
    
    # Profitability
    roic: Optional[float] = None  # Return on Invested Capital
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    
    # Cash Flow
    fcf: Optional[float] = None  # Free Cash Flow
    fcf_yield: Optional[float] = None
    shareholder_yield: Optional[float] = None
    
    # Leverage
    debt_to_equity: Optional[float] = None
    
    # Quality
    margin_stability: Optional[str] = None  # "improving", "stable", "declining"
    earnings_quality: Optional[str] = None  # Accruals vs cash
    
    # Valuation
    ev_to_fcf: Optional[float] = None
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    
    # Growth
    revenue_growth: Optional[float] = None
    earnings_growth: Optional[float] = None
    
    # Additional
    market_cap: Optional[float] = None
    enterprise_value: Optional[float] = None


class FundamentalsAdapter:
    """
    Adapter for fetching fundamentals from yfinance
    
    Falls back gracefully with "Data unavailable" if metrics missing
    """
    
    def __init__(self):
        self._yf = None
    
    def _get_yfinance(self):
        """Lazy load yfinance"""
        if self._yf is None:
            try:
                import yfinance as yf
                self._yf = yf
            except ImportError:
                logger.error("yfinance not installed")
                raise ImportError("yfinance required: pip install yfinance")
        return self._yf
    
    def get_fundamentals(self, symbol: str) -> Optional[FundamentalsData]:
        """
        Fetch fundamental metrics for symbol
        
        Args:
            symbol: Ticker symbol (e.g., "AAPL")
        
        Returns:
            FundamentalsData or None if fetch fails
        """
        try:
            yf = self._get_yfinance()
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            if not info:
                logger.warning(f"No info data for {symbol}")
                return None
            
            # Extract metrics (with fallbacks for missing data)
            fundamentals = FundamentalsData(
                symbol=symbol.upper(),
                timestamp=datetime.now(),
                provider="yfinance",
            )
            
            # Profitability
            fundamentals.roic = self._safe_get(info, "returnOnEquity")  # Proxy for ROIC
            fundamentals.gross_margin = self._safe_get(info, "grossMargins")
            fundamentals.operating_margin = self._safe_get(info, "operatingMargins")
            
            # Cash Flow
            fundamentals.fcf = self._safe_get(info, "freeCashflow")
            market_cap = self._safe_get(info, "marketCap")
            if fundamentals.fcf and market_cap and market_cap > 0:
                fundamentals.fcf_yield = (fundamentals.fcf / market_cap) * 100
            
            # Leverage
            fundamentals.debt_to_equity = self._safe_get(info, "debtToEquity")
            
            # Valuation
            fundamentals.ev_to_fcf = None  # Would need EV and FCF calculation
            fundamentals.pe_ratio = self._safe_get(info, "trailingPE")
            fundamentals.pb_ratio = self._safe_get(info, "priceToBook")
            
            # Growth
            fundamentals.revenue_growth = self._safe_get(info, "revenueGrowth")
            fundamentals.earnings_growth = self._safe_get(info, "earningsGrowth")
            
            # Additional
            fundamentals.market_cap = market_cap
            fundamentals.enterprise_value = self._safe_get(info, "enterpriseValue")
            
            # Quality metrics (simplified - would need historical data for trends)
            fundamentals.margin_stability = "stable"  # Placeholder
            fundamentals.earnings_quality = "unknown"  # Would need detailed analysis
            
            return fundamentals
        
        except Exception as e:
            logger.error(f"Failed to fetch fundamentals for {symbol}: {e}")
            return None
    
    def _safe_get(self, data: Dict[str, Any], key: str) -> Optional[float]:
        """Safely get numeric value from dict"""
        value = data.get(key)
        if value is None:
            return None
        
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
