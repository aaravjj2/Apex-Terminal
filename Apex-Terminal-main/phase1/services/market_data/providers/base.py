"""
Base provider interface for market data.

All providers must implement this interface to be compatible with the system.
"""

from abc import ABC, abstractmethod
from typing import List
from .types import BarsRequest, BarsResponse, QuoteRequest, QuoteResponse, ProviderName


class MarketDataProvider(ABC):
    """Abstract base class for market data providers."""
    
    def __init__(self, provider_name: ProviderName):
        self.provider_name = provider_name
    
    @abstractmethod
    async def get_bars(self, request: BarsRequest) -> BarsResponse:
        """
        Fetch historical OHLCV bars for a symbol.
        
        Args:
            request: BarsRequest with symbol, start, end, interval
            
        Returns:
            BarsResponse with list of BarData
            
        Raises:
            ValueError: If symbol invalid or date range invalid
            RuntimeError: If provider unavailable
        """
        pass
    
    @abstractmethod
    async def get_quote(self, request: QuoteRequest) -> QuoteResponse:
        """
        Fetch real-time quote for a symbol.
        
        Args:
            request: QuoteRequest with symbol
            
        Returns:
            QuoteResponse with QuoteData
            
        Raises:
            ValueError: If symbol invalid
            RuntimeError: If provider unavailable
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if provider is available.
        
        Returns:
            True if provider is operational, False otherwise
        """
        pass
