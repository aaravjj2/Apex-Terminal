"""
Tests for Backtest Export and Reporting functionality
"""

import pytest
import json
import zipfile
import io
from datetime import datetime
from fastapi.testclient import TestClient


def test_backtest_artifacts_export_structure(test_client):
    """
    Test that backtest export produces a valid ZIP with all required files:
    - run.json
    - metrics.json
    - equity_curve.csv
    - trades.csv
    - report.html
    - README.txt
    """
    # First, run a backtest
    config = {
        "strategy_id": "demo-rsi-mean-reversion",
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-03-31",
        "initial_capital": 100000,
        "slippage_bps": 5,
        "fee_per_trade": 1,
        "seed": 42
    }
    
    response = test_client.post("/api/backtest/run", json=config)
    assert response.status_code == 200
    run = response.json()
    run_id = run["run_id"]
    
    # Download artifacts
    response = test_client.get(f"/api/backtest/run/{run_id}/artifacts")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    
    # Verify ZIP structure
    zip_data = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_data, 'r') as zf:
        namelist = zf.namelist()
        
        # Check required files (trades.csv is optional if no trades were made)
        assert f"{run_id}/run.json" in namelist
        assert f"{run_id}/equity_curve.csv" in namelist
        assert f"{run_id}/metrics.json" in namelist
        assert f"{run_id}/report.html" in namelist
        assert f"{run_id}/README.txt" in namelist
        # trades.csv may or may not be present depending on whether trades were executed
        
        # Verify run.json is valid and non-empty
        run_json = zf.read(f"{run_id}/run.json").decode('utf-8')
        run_data = json.loads(run_json)
        assert run_data["run_id"] == run_id
        assert "config" in run_data
        assert "metrics" in run_data
        
        # Verify metrics.json is valid
        metrics_json = zf.read(f"{run_id}/metrics.json").decode('utf-8')
        metrics = json.loads(metrics_json)
        assert "total_return_pct" in metrics
        assert "sharpe_ratio" in metrics
        
        # Verify CSV files have headers
        equity_csv = zf.read(f"{run_id}/equity_curve.csv").decode('utf-8')
        assert "timestamp,equity" in equity_csv
        
        # trades.csv is optional (only present if trades were made)
        if f"{run_id}/trades.csv" in namelist:
            trades_csv = zf.read(f"{run_id}/trades.csv").decode('utf-8')
            assert "trade_id,timestamp,symbol,side,quantity,price,fees,pnl" in trades_csv


def test_report_html_contains_determinism_data(test_client):
    """
    Test that report.html contains config hash, seed, and is self-contained
    """
    config = {
        "strategy_id": "demo-rsi-mean-reversion",
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-02-28",
        "initial_capital": 100000,
        "seed": 42
    }
    
    response = test_client.post("/api/backtest/run", json=config)
    run = response.json()
    run_id = run["run_id"]
    config_hash = run.get("config_hash")
    
    # Download artifacts
    response = test_client.get(f"/api/backtest/run/{run_id}/artifacts")
    zip_data = io.BytesIO(response.content)
    
    with zipfile.ZipFile(zip_data, 'r') as zf:
        report_html = zf.read(f"{run_id}/report.html").decode('utf-8')
        
        # Check for determinism markers
        assert "Config Hash" in report_html or "config hash" in report_html.lower()
        if config_hash:
            assert config_hash in report_html
        
        # Check for seed
        assert "seed" in report_html.lower() or "42" in report_html
        
        # Check for self-contained (no CDN links)
        assert "cdn.jsdelivr" not in report_html.lower()
        assert "unpkg.com" not in report_html.lower()
        
        # Check for key sections
        assert "Equity Curve" in report_html or "equity" in report_html.lower()
        assert "Drawdown" in report_html or "drawdown" in report_html.lower()
        assert "Performance Metrics" in report_html or "metrics" in report_html.lower()


def test_backtest_determinism(test_client):
    """
    Test that running the same config twice produces the same config_hash
    """
    config = {
        "strategy_id": "demo-rsi-mean-reversion",
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-02-28",
        "initial_capital": 100000,
        "seed": 42
    }
    
    # Run 1
    response1 = test_client.post("/api/backtest/run", json=config)
    run1 = response1.json()
    
    # Run 2
    response2 = test_client.post("/api/backtest/run", json=config)
    run2 = response2.json()
    
    # Verify determinism
    assert run1.get("config_hash") == run2.get("config_hash")
    assert run1["metrics"]["total_return_pct"] == run2["metrics"]["total_return_pct"]


def test_export_nonexistent_run_returns_404(test_client):
    """
    Test that exporting a non-existent run returns 404
    """
    response = test_client.get("/api/backtest/run/nonexistent-run-id/artifacts")
    assert response.status_code == 404


def test_readme_contains_reproduction_instructions(test_client):
    """
    Test that README.txt contains clear reproduction instructions
    """
    config = {
        "strategy_id": "demo-rsi-mean-reversion",
        "symbol": "SPY",
        "start_date": "2023-01-01",
        "end_date": "2023-02-28",
        "initial_capital": 100000,
        "seed": 42
    }
    
    response = test_client.post("/api/backtest/run", json=config)
    run = response.json()
    run_id = run["run_id"]
    
    # Download artifacts
    response = test_client.get(f"/api/backtest/run/{run_id}/artifacts")
    zip_data = io.BytesIO(response.content)
    
    with zipfile.ZipFile(zip_data, 'r') as zf:
        readme = zf.read(f"{run_id}/README.txt").decode('utf-8')
        
        # Check for key sections
        assert "HOW TO REPRODUCE" in readme or "reproduce" in readme.lower()
        assert "DETERMINISM" in readme or "determinism" in readme.lower()
        assert config["strategy_id"] in readme
        assert config["symbol"] in readme
        assert str(config["seed"]) in readme
        assert "FILES IN THIS BUNDLE" in readme


# Fixture for test client
@pytest.fixture
def test_client():
    """Create a test client for the FastAPI app."""
    from services.api.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)
