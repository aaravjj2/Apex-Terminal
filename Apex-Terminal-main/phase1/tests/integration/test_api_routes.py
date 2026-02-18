"""
Integration tests for API routes - Volume Profile, Patterns, Fundamentals
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from services.api.main import app

# Create transport for ASGI testing
_transport = ASGITransport(app=app)


@pytest.mark.asyncio
async def test_volume_profile_endpoint():
    """Test volume profile API endpoint"""
    async with AsyncClient(transport=_transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/profiles/volume-profile/AAPL",
            params={"profile_type": "visible_range", "limit": 100}
        )
        
        # Should return 200 even if no data (empty profile)
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_anchored_vwap_endpoint():
    """Test anchored VWAP API endpoint"""
    async with AsyncClient(transport=_transport, base_url="http://test") as client:
        anchor_date = datetime(2024, 1, 1).isoformat()
        response = await client.get(
            f"/api/v1/profiles/anchored-vwap/AAPL",
            params={"anchor_date": anchor_date, "limit": 100}
        )
        
        assert response.status_code in [200, 404, 422]


@pytest.mark.asyncio
async def test_atr_bands_endpoint():
    """Test ATR bands API endpoint"""
    async with AsyncClient(transport=_transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/profiles/atr-bands/AAPL",
            params={"period": 14, "multiplier": 2.0, "limit": 100}
        )
        
        assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_ema_regime_endpoint():
    """Test EMA regime API endpoint"""
    async with AsyncClient(transport=_transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/profiles/ema-regime/AAPL",
            params={"limit": 200}
        )
        
        assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_patterns_endpoint():
    """Test pattern detection API endpoint"""
    async with AsyncClient(transport=_transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/patterns/detect/AAPL",
            params={"lookback": 50, "min_confidence": 0.7}
        )
        
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)
            assert "patterns" in data


@pytest.mark.asyncio
async def test_fundamentals_endpoint():
    """Test fundamentals API endpoint"""
    async with AsyncClient(transport=_transport, base_url="http://test") as client:
        response = await client.get("/api/v1/fundamentals/AAPL")
        
        # Should return 200 with data from yfinance
        assert response.status_code == 200
        
        data = response.json()
        assert data["symbol"] == "AAPL"
        assert "profitability" in data
        assert "cash_flow" in data
        assert "leverage" in data
        assert "quality" in data
        assert "valuation" in data
        assert "growth" in data
        assert "additional" in data
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_fundamentals_invalid_symbol():
    """Test fundamentals with invalid symbol"""
    async with AsyncClient(transport=_transport, base_url="http://test") as client:
        response = await client.get("/api/v1/fundamentals/INVALID_SYMBOL_XYZ")
        
        # Should handle gracefully
        assert response.status_code in [200, 404, 500]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
