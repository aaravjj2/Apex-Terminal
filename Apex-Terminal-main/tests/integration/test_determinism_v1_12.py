"""
Integration test for v1.12 Objective J - Determinism Proof
Tests that identical BacktestConfig produces identical canonical outputs.
"""

import pytest
import json
import hashlib
from datetime import date
import requests
from pathlib import Path


def canonicalize_backtest_run(run_data: dict) -> dict:
    """
    Canonicalize backtest run output for deterministic comparison.
    See scripts/determinism_proof_v1_12.py for full documentation.
    """
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
    """Compute SHA256 hash of canonical JSON representation."""
    canonical_json = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()


@pytest.fixture
def backend_url():
    """Backend URL for testing."""
    return "http://localhost:8000"


@pytest.fixture
def test_config():
    """Standard test configuration for determinism tests."""
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


def test_backtest_endpoint_responds(backend_url, test_config):
    """Test that backtest endpoint responds successfully."""
    response = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    data = response.json()
    assert "run_id" in data
    assert "status" in data
    assert data["status"] == "completed"
    assert "config_hash" in data


def test_config_hash_stable(backend_url, test_config):
    """Test that config_hash is stable across runs."""
    response1 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    response1.raise_for_status()
    data1 = response1.json()
    
    response2 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    response2.raise_for_status()
    data2 = response2.json()
    
    # Config hash should be identical
    assert data1["config_hash"] == data2["config_hash"], \
        "Config hash should be stable for identical configs"


def test_determinism_proof_integration(backend_url, test_config):
    """
    Integration test for Objective J: Determinism Proof.
    
    Proves that identical BacktestConfig produces identical canonical outputs:
    1. Run backtest twice with identical config
    2. Canonicalize outputs (remove run_id, timestamps)
    3. Compute SHA256 hashes
    4. Assert hashes match
    
    This is the LIVE determinism proof (no stubs, no 422 errors).
    """
    # Run 1
    response1 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    assert response1.status_code == 200, \
        f"Run 1 failed: {response1.status_code} - {response1.text}"
    
    run1_data = response1.json()
    assert run1_data["status"] == "completed", "Run 1 should complete successfully"
    
    # Run 2
    response2 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    assert response2.status_code == 200, \
        f"Run 2 failed: {response2.status_code} - {response2.text}"
    
    run2_data = response2.json()
    assert run2_data["status"] == "completed", "Run 2 should complete successfully"
    
    # Canonicalize
    canonical1 = canonicalize_backtest_run(run1_data)
    canonical2 = canonicalize_backtest_run(run2_data)
    
    # Compute hashes
    hash1 = compute_hash(canonical1)
    hash2 = compute_hash(canonical2)
    
    # Assert determinism
    assert hash1 == hash2, \
        f"Determinism proof failed: hashes do not match\n" \
        f"Hash Run 1: {hash1}\n" \
        f"Hash Run 2: {hash2}\n" \
        f"Identical configs must produce identical canonical outputs."


def test_determinism_metrics_stable(backend_url, test_config):
    """Test that specific metrics are stable across runs."""
    response1 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        timeout=30
    )
    response1.raise_for_status()
    data1 = response1.json()
    
    response2 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        timeout=30
    )
    response2.raise_for_status()
    data2 = response2.json()
    
    # Metrics should be identical
    if data1.get("metrics") and data2.get("metrics"):
        m1 = data1["metrics"]
        m2 = data2["metrics"]
        
        # Check key metrics
        assert m1["total_return_pct"] == m2["total_return_pct"]
        assert m1["total_trades"] == m2["total_trades"]
        assert m1["final_equity"] == m2["final_equity"]
        assert m1["win_rate_pct"] == m2["win_rate_pct"]


def test_determinism_trades_stable(backend_url, test_config):
    """Test that trade log is stable across runs."""
    response1 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        timeout=30
    )
    response1.raise_for_status()
    data1 = response1.json()
    
    response2 = requests.post(
        f"{backend_url}/api/backtest/run",
        json=test_config,
        timeout=30
    )
    response2.raise_for_status()
    data2 = response2.json()
    
    # Trade count should be identical
    assert len(data1.get("trades", [])) == len(data2.get("trades", [])), \
        "Trade count should be identical for deterministic backtests"
    
    # If trades exist, check first trade matches
    if data1.get("trades") and data2.get("trades"):
        t1 = data1["trades"][0]
        t2 = data2["trades"][0]
        
        # Compare trade fields (excluding timestamp which might vary in format)
        assert t1["symbol"] == t2["symbol"]
        assert t1["side"] == t2["side"]
        assert t1["quantity"] == t2["quantity"]
        assert t1["price"] == t2["price"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
