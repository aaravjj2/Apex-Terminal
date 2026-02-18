"""
v1.13 Integration Tests - Market Data API with Record/Replay
All tests run in DEMO mode or with mocked cache (no network).
"""

import pytest
import os
from fastapi.testclient import TestClient
from phase1.services.api.main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    # Force DEMO_MODE for tests
    os.environ["DEMO_MODE"] = "1"
    return TestClient(app)


def test_providers_endpoint(client):
    """Should list providers."""
    response = client.get("/api/v2/market-data/providers")
    
    assert response.status_code == 200
    providers = response.json()
    
    assert len(providers) >= 1
    assert any(p["name"] == "DEMO" for p in providers)


def test_bars_endpoint_demo_mode(client):
    """Should return fixture bars in DEMO mode."""
    request = {
        "symbol": "AAPL",
        "start_date": "2023-01-01",
        "end_date": "2023-01-31",
        "timeframe": "1d"
    }
    
    response = client.post("/api/v2/market-data/bars", json=request)
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["symbol"] == "AAPL"
    assert "bars" in data
    assert len(data["bars"]) >= 1
    
    # Check provenance
    assert "provenance" in data
    prov = data["provenance"]
    assert prov["source"] == "DEMO"
    assert prov["provider"] == "fixture"


def test_quote_endpoint_demo_mode(client):
    """Should return fixture quote in DEMO mode."""
    request = {"symbol": "TSLA"}
    
    response = client.post("/api/v2/market-data/quote", json=request)
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["symbol"] == "TSLA"
    assert "price" in data
    assert data["price"] > 0
    
    # Check provenance
    assert "provenance" in data
    prov = data["provenance"]
    assert prov["source"] == "DEMO"


def test_replays_endpoint(client):
    """Should list replays (empty in DEMO mode)."""
    response = client.get("/api/v2/market-data/replays")
    
    assert response.status_code == 200
    replays = response.json()
    
    # In DEMO mode, replays list should be empty (no fetches)
    assert isinstance(replays, list)


def test_determinism_bars_same_request_twice(client):
    """Same request twice should produce identical bars in DEMO mode."""
    request = {
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-01-07",
        "timeframe": "1d"
    }
    
    response1 = client.post("/api/v2/market-data/bars", json=request)
    response2 = client.post("/api/v2/market-data/bars", json=request)
    
    data1 = response1.json()
    data2 = response2.json()
    
    # Bars should be identical
    assert data1["bars"] == data2["bars"]


def test_backward_compatibility_v1_v2_identical(client):
    """Both /api/v1/market-data and /api/v2/market-data should return identical responses."""
    request = {
        "symbol": "AAPL",
        "start_date": "2023-01-01",
        "end_date": "2023-01-31",
        "timeframe": "1d"
    }
    
    # Test bars endpoint
    response_v1 = client.post("/api/v1/market-data/bars", json=request)
    response_v2 = client.post("/api/v2/market-data/bars", json=request)
    
    assert response_v1.status_code == 200
    assert response_v2.status_code == 200
    
    data_v1 = response_v1.json()
    data_v2 = response_v2.json()
    
    # Responses should be identical
    assert data_v1 == data_v2
    
    # Test providers endpoint
    providers_v1 = client.get("/api/v1/market-data/providers")
    providers_v2 = client.get("/api/v2/market-data/providers")
    
    assert providers_v1.status_code == 200
    assert providers_v2.status_code == 200
    
    assert providers_v1.json() == providers_v2.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
