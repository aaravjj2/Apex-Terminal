"""
Tests for Risk Desk Export functionality
"""

import pytest
import json
import zipfile
import io
from fastapi.testclient import TestClient


def test_risk_desk_export_structure(test_client):
    """
    Test that Risk Desk export produces a valid ZIP with required files:
    - risk_run.json
    - tool_trace.json
    - compliance.json
    - README.txt
    """
    # First, run a risk desk analysis
    demo_csv = """symbol,expiration,strike,type,position,mark_price
SPY,2024-01-19,450,CALL,10,5.50
SPY,2024-01-19,440,PUT,-5,4.20"""
    
    payload = {
        "csv_text": demo_csv,
        "scenario_id": "MARKET_CRASH"
    }
    
    # Run risk desk analysis
    response = test_client.post("/api/risk-desk/run", json=payload)
    assert response.status_code == 200, f"Risk desk run failed with status {response.status_code}"
    
    run = response.json()
    run_id = run.get("run_id")
    
    # Download export
    response = test_client.get(f"/api/risk-desk/export/{run_id}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    
    # Verify ZIP structure
    zip_data = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_data, 'r') as zf:
        namelist = zf.namelist()
        
        # Check required files
        assert f"{run_id}/risk_run.json" in namelist
        assert f"{run_id}/tool_trace.json" in namelist
        assert f"{run_id}/compliance.json" in namelist
        assert f"{run_id}/README.txt" in namelist
        
        # Verify risk_run.json
        risk_run_json = zf.read(f"{run_id}/risk_run.json").decode('utf-8')
        risk_data = json.loads(risk_run_json)
        assert risk_data["run_id"] == run_id
        
        # Verify compliance.json
        compliance_json = zf.read(f"{run_id}/compliance.json").decode('utf-8')
        compliance = json.loads(compliance_json)
        assert "run_id" in compliance
        assert "compliance_state" in compliance


def test_risk_desk_export_nonexistent_run_returns_404(test_client):
    """
    Test that exporting a non-existent risk run returns 404
    """
    response = test_client.get("/api/risk-desk/export/nonexistent-run-id")
    assert response.status_code == 404


@pytest.fixture
def test_client():
    """Create a test client for the FastAPI app."""
    from services.api.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)
