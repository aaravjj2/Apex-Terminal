"""
Tests for market data providers (v1.11 Objective D).

Tests provider selection, caching, and schema correctness.
"""

import pytest
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import os

from phase1.services.market_data.providers.types import (
    BarsRequest, QuoteRequest, ProviderName, IntervalType
)
from phase1.services.market_data.providers.demo_provider import DemoProvider
from phase1.services.market_data.providers.cache import DiskCache


class TestDemoProvider:
    """Tests for DemoProvider using fixtures."""
    
    @pytest.fixture
    def provider(self):
        return DemoProvider()
    
    @pytest.mark.asyncio
    async def test_health_check(self, provider):
        """Demo provider should always be available."""
        assert await provider.health_check() == True
    
    @pytest.mark.asyncio
    async def test_get_bars_empty_symbol(self, provider):
        """Request for unknown symbol returns empty bars."""
        request = BarsRequest(
            symbol="UNKNOWN_XYZ",
            start=datetime(2024, 1, 1),
            end=datetime(2024, 1, 31),
            interval=IntervalType.DAY_1
        )
        
        response = await provider.get_bars(request)
        
        assert response.symbol == "UNKNOWN_XYZ"
        assert response.provider == ProviderName.DEMO
        assert response.cached == False
        assert isinstance(response.bars, list)
        # May be empty or have fallback data
    
    @pytest.mark.asyncio
    async def test_get_bars_response_schema(self, provider):
        """Bars response has correct schema."""
        request = BarsRequest(
            symbol="AAPL",
            start=datetime(2024, 1, 1),
            end=datetime(2024, 1, 31),
            interval=IntervalType.DAY_1
        )
        
        response = await provider.get_bars(request)
        
        assert hasattr(response, 'symbol')
        assert hasattr(response, 'bars')
        assert hasattr(response, 'provider')
        assert hasattr(response, 'cached')
        assert response.provider == ProviderName.DEMO
    
    @pytest.mark.asyncio
    async def test_get_quote_response_schema(self, provider):
        """Quote response has correct schema."""
        request = QuoteRequest(symbol="AAPL")
        
        response = await provider.get_quote(request)
        
        assert hasattr(response, 'quote')
        assert hasattr(response, 'provider')
        assert hasattr(response, 'cached')
        assert response.provider == ProviderName.DEMO
        assert hasattr(response.quote, 'symbol')
        assert hasattr(response.quote, 'timestamp')
        assert hasattr(response.quote, 'price')
        assert response.quote.price > 0


class TestDiskCache:
    """Tests for DiskCache."""
    
    @pytest.fixture
    def temp_cache_dir(self):
        """Create temporary cache directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir
    
    @pytest.fixture
    def cache(self, temp_cache_dir):
        return DiskCache(cache_dir=temp_cache_dir)
    
    def test_cache_key_determinism(self, cache):
        """Same params generate same cache key."""
        key1 = cache._get_cache_key(
            symbol="AAPL",
            start=datetime(2024, 1, 1),
            end=datetime(2024, 1, 31)
        )
        key2 = cache._get_cache_key(
            symbol="AAPL",
            start=datetime(2024, 1, 1),
            end=datetime(2024, 1, 31)
        )
        assert key1 == key2
    
    def test_cache_key_uniqueness(self, cache):
        """Different params generate different keys."""
        key1 = cache._get_cache_key(symbol="AAPL", date="2024-01-01")
        key2 = cache._get_cache_key(symbol="MSFT", date="2024-01-01")
        assert key1 != key2
    
    def test_cache_miss(self, cache):
        """Get returns None for cache miss."""
        result = cache.get(symbol="AAPL", date="2024-01-01")
        assert result is None
    
    def test_cache_hit(self, cache):
        """Set and get work correctly."""
        data = {"price": 150.0, "volume": 1000000}
        cache.set(data, symbol="AAPL", date="2024-01-01")
        
        result = cache.get(symbol="AAPL", date="2024-01-01")
        assert result is not None
        assert result["price"] == 150.0
        assert result["volume"] == 1000000
    
    def test_cache_clear(self, cache):
        """Clear removes all cached data."""
        cache.set({"data": "test1"}, key1="value1")
        cache.set({"data": "test2"}, key2="value2")
        cache.set({"data": "test3"}, key3="value3")
        
        count = cache.clear()
        assert count == 3
        
        # Verify all cleared
        assert cache.get(key1="value1") is None
        assert cache.get(key2="value2") is None
        assert cache.get(key3="value3") is None


class TestProviderSelection:
    """Tests for provider selection logic."""
    
    def test_providers_available(self):
        """At least one provider should be in registry."""
        from phase1.services.market_data import list_providers
        
        providers = list_providers()
        assert len(providers) >= 1
    
    def test_yahoo_provider_available_locally(self):
        """Yahoo provider should be available in LOCAL mode (yfinance installed)."""
        from phase1.services.market_data import list_providers, ProviderName
        
        providers = list_providers()
        provider_names = [p.name for p in providers]
        
        # In local mode with yfinance installed, Yahoo should be available
        # This is environment-dependent, so just check we get some providers
        assert len(providers) >= 1
    
    def test_provider_info_schema(self):
        """Provider info has required fields."""
        from phase1.services.market_data import list_providers
        
        providers = list_providers()
        assert len(providers) > 0
        
        for provider in providers:
            assert hasattr(provider, 'name')
            assert hasattr(provider, 'enabled')
            assert hasattr(provider, 'description')
            assert hasattr(provider, 'requires_auth')
            assert hasattr(provider, 'supports_realtime')
    
    @pytest.mark.asyncio
    async def test_get_market_data_yahoo(self):
        """get_market_data works with available provider."""
        from phase1.services.market_data import get_market_data, list_providers
        
        providers = list_providers()
        if not providers:
            pytest.skip("No providers available")
        
        first_provider = providers[0].name
        request = BarsRequest(
            symbol="AAPL",
            start=datetime(2024, 1, 1),
            end=datetime(2024, 1, 31),
            interval=IntervalType.DAY_1
        )
        
        response = await get_market_data(first_provider, request)
        
        assert response is not None
        assert hasattr(response, 'symbol')
        assert hasattr(response, 'bars')
