"""
Integration tests for Forecast API routes.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from services.api.main import app


@pytest.fixture
async def client():
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_forecast_default(client):
    """Test GET /api/v1/forecast/{symbol} with default parameters."""
    response = await client.get("/api/v1/forecast/AAPL")
    assert response.status_code == 200
    
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "current_price" in data
    assert "forecast_days" in data
    assert "historical_volatility" in data
    assert "cones" in data
    assert "generated_at" in data


@pytest.mark.asyncio
async def test_get_forecast_custom_days(client):
    """Test GET /api/v1/forecast/{symbol} with custom days."""
    response = await client.get("/api/v1/forecast/TSLA?days=60")
    assert response.status_code == 200
    
    data = response.json()
    assert data["symbol"] == "TSLA"
    assert data["forecast_days"] == 60


@pytest.mark.asyncio
async def test_get_forecast_custom_confidence(client):
    """Test GET /api/v1/forecast/{symbol} with custom confidence levels."""
    response = await client.get("/api/v1/forecast/SPY?confidence=0.5,0.9")
    assert response.status_code == 200
    
    data = response.json()
    assert "50%" in data["cones"] or "90%" in data["cones"]


@pytest.mark.asyncio
async def test_get_forecast_invalid_confidence(client):
    """Test GET /api/v1/forecast/{symbol} with invalid confidence."""
    response = await client.get("/api/v1/forecast/AAPL?confidence=1.5")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_forecast_cone_structure(client):
    """Test that forecast cones have correct structure."""
    response = await client.get("/api/v1/forecast/MSFT?days=10&confidence=0.68")
    assert response.status_code == 200
    
    data = response.json()
    if "68%" in data["cones"]:
        cone = data["cones"]["68%"]
        assert "upper" in cone
        assert "lower" in cone
        assert "median" in cone
        assert len(cone["upper"]) == 10
        assert len(cone["lower"]) == 10


@pytest.mark.asyncio
async def test_get_volatility(client):
    """Test GET /api/v1/forecast/{symbol}/volatility."""
    response = await client.get("/api/v1/forecast/AAPL/volatility")
    assert response.status_code == 200
    
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "annualized_volatility" in data
    assert "daily_volatility" in data
    assert 0 <= data["annualized_volatility"] <= 2  # Reasonable range


@pytest.mark.asyncio
async def test_get_volatility_custom_period(client):
    """Test GET /api/v1/forecast/{symbol}/volatility with custom period."""
    response = await client.get("/api/v1/forecast/AAPL/volatility?period=50")
    assert response.status_code == 200
    
    data = response.json()
    assert data["period"] == 50
