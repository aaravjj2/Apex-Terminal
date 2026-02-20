"""
Integration test for v1.12 Objective J - Determinism Proof
Tests that identical BacktestConfig produces identical canonical outputs.
Uses FastAPI TestClient.
"""

import pytest
import json
import hashlib
from datetime import date
from pathlib import Path


def canonicalize_backtest_run(run_data: dict) -> dict:
    canonical = {}
    excluded_fields = {'run_id', 'started_at', 'completed_at'}
    for key, value in sorted(run_data.items()):
        if key in excluded_fields:
            continue
        if isinstance(value, dict):
            canonical[key] = canonicalize_backtest_run(value)
        elif isinstance(value, list):
            if key in ('equity_curve', 'trades'):
                canonical[key] = [canonicalize_backtest_run(item) if isinstance(item, dict) else item for item in value]
            else:
                if value and isinstance(value[0], dict):
                    canonical[key] = sorted([canonicalize_backtest_run(item) for item in value],
                                           key=lambda x: json.dumps(x, sort_keys=True))
                else:
                    canonical[key] = value
        elif isinstance(value, float):
            canonical[key] = round(value, 8)
        else:
            canonical[key] = value
    return canonical


def compute_hash(data: dict) -> str:
    canonical_json = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    import os
    os.environ.setdefault("E2E_MODE", "1")
    from services.api.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def test_config():
    return {
        "strategy_id": "demo-sma-crossover",
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-01-31",
        "initial_capital": 100000.0,
        "slippage_bps": 5.0,
        "fee_per_trade": 1.0,
        "seed": 42
    }


def test_backtest_endpoint_responds(client, test_config):
    response = client.post("/api/backtest/run", json=test_config)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "run_id" in data
    assert "status" in data
    assert data["status"] == "completed"
    assert "config_hash" in data


def test_config_hash_stable(client, test_config):
    r1 = client.post("/api/backtest/run", json=test_config)
    assert r1.status_code == 200
    r2 = client.post("/api/backtest/run", json=test_config)
    assert r2.status_code == 200
    assert r1.json()["config_hash"] == r2.json()["config_hash"]


def test_determinism_proof_integration(client, test_config):
    r1 = client.post("/api/backtest/run", json=test_config)
    assert r1.status_code == 200
    run1 = r1.json()
    assert run1["status"] == "completed"

    r2 = client.post("/api/backtest/run", json=test_config)
    assert r2.status_code == 200
    run2 = r2.json()
    assert run2["status"] == "completed"

    c1 = canonicalize_backtest_run(run1)
    c2 = canonicalize_backtest_run(run2)
    h1 = compute_hash(c1)
    h2 = compute_hash(c2)
    assert h1 == h2, f"Determinism failed: {h1} != {h2}"


def test_determinism_metrics_stable(client, test_config):
    r1 = client.post("/api/backtest/run", json=test_config)
    assert r1.status_code == 200
    d1 = r1.json()
    r2 = client.post("/api/backtest/run", json=test_config)
    assert r2.status_code == 200
    d2 = r2.json()
    if d1.get("metrics") and d2.get("metrics"):
        m1, m2 = d1["metrics"], d2["metrics"]
        assert m1["total_return_pct"] == m2["total_return_pct"]
        assert m1["total_trades"] == m2["total_trades"]
        assert m1["final_equity"] == m2["final_equity"]
        assert m1["win_rate_pct"] == m2["win_rate_pct"]


def test_determinism_trades_stable(client, test_config):
    r1 = client.post("/api/backtest/run", json=test_config)
    assert r1.status_code == 200
    d1 = r1.json()
    r2 = client.post("/api/backtest/run", json=test_config)
    assert r2.status_code == 200
    d2 = r2.json()
    assert len(d1.get("trades", [])) == len(d2.get("trades", []))
    if d1.get("trades") and d2.get("trades"):
        t1, t2 = d1["trades"][0], d2["trades"][0]
        assert t1["symbol"] == t2["symbol"]
        assert t1["side"] == t2["side"]
        assert t1["quantity"] == t2["quantity"]
        assert t1["price"] == t2["price"]
