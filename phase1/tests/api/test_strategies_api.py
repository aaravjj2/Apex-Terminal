import math
import json
from fastapi.testclient import TestClient
from services.api.main import create_app
from services.config import Settings


def make_client(monkeypatch):
    # Force mock ingestion mode for tests so background services don't hit live providers
    def fake_get_settings():
        s = Settings()
        s.apca_api_key_id = None
        s.finnhub_api_key = None
        s.ingestion_mode = "mock"
        s.ingestion_symbols = "AAPL,TSLA"
        return s

    monkeypatch.setattr("services.config.get_settings", fake_get_settings)
    app = create_app()
    client = TestClient(app)
    return client


def assert_finite_numbers(obj):
    """Recursively assert that all numeric values are finite (no NaN/Inf)."""
    if isinstance(obj, dict):
        for v in obj.values():
            assert_finite_numbers(v)
    elif isinstance(obj, list):
        for v in obj:
            assert_finite_numbers(v)
    elif isinstance(obj, (int, float)):
        assert math.isfinite(obj), f"Non-finite number: {obj}"


def test_get_strategy_templates(monkeypatch):
    client = make_client(monkeypatch)
    res = client.get("/api/v1/options/strategies/templates")
    assert res.status_code == 200
    payload = res.json()
    assert isinstance(payload, list)
    assert len(payload) > 0
    # Check presence of expected keys
    assert "name" in payload[0]


def test_analyze_strategy_basic(monkeypatch):
    client = make_client(monkeypatch)

    body = {
        "legs": [
            {
                "option_type": "call",
                "position": "long",
                "strike": 100.0,
                "premium": 2.0,
                "quantity": 1,
                "expiration_days": 30,
                "iv": 0.30,
            }
        ],
        "underlying_price": 100.0,
        "strategy_name": "TestLongCall",
    }

    res = client.post("/api/v1/options/strategies/analyze", json=body)
    assert res.status_code == 200, res.text
    payload = res.json()

    # Basic shape assertions
    assert payload["name"] == "TestLongCall"
    assert isinstance(payload["legs"], list)
    assert payload["legs"][0]["option_type"] == "call"

    # Numeric sanity checks
    assert_finite_numbers(payload)


def test_prebuilt_strategies_endpoints(monkeypatch):
    client = make_client(monkeypatch)

    # Covered call
    cc_body = {
        "underlying_price": 100.0,
        "call_strike": 105.0,
        "call_premium": 3.0,
        "expiration_days": 30,
        "iv": 0.30,
    }

    res = client.post("/api/v1/options/strategies/covered-call", json=cc_body)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert_finite_numbers(payload)

    # Straddle
    s_body = {"underlying_price": 100.0, "strike": 100.0, "call_premium": 3.0, "put_premium": 3.0, "expiration_days": 30, "iv": 0.30, "is_long": True}
    res = client.post("/api/v1/options/strategies/straddle", json=s_body)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert_finite_numbers(payload)

    # Vertical Spread
    vs_body = {"underlying_price": 100.0, "long_strike": 95.0, "long_premium": 2.0, "short_strike": 100.0, "short_premium": 1.0, "option_type": "call", "expiration_days": 30, "iv": 0.30}
    res = client.post("/api/v1/options/strategies/vertical-spread", json=vs_body)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert_finite_numbers(payload)

    # Iron Condor (basic smoke)
    ic_body = {
        "underlying_price": 100.0,
        "put_long_strike": 90.0,
        "put_long_premium": 1.0,
        "put_short_strike": 95.0,
        "put_short_premium": 1.5,
        "call_short_strike": 105.0,
        "call_short_premium": 1.5,
        "call_long_strike": 110.0,
        "call_long_premium": 1.0,
        "expiration_days": 30,
        "iv": 0.30,
    }
    res = client.post("/api/v1/options/strategies/iron-condor", json=ic_body)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert_finite_numbers(payload)
