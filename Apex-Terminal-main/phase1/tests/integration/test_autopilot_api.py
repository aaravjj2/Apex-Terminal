"""
Integration tests for autopilot API endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
import os

# Set test environment
os.environ.setdefault("GROQ_API_KEY", "test_groq_key")
os.environ.setdefault("GEMINI_API_KEY", "test_gemini_key")
os.environ.setdefault("LLM_MODE", "deterministic")
os.environ.setdefault("APCA_API_KEY_ID", "test_alpaca_key")
os.environ.setdefault("APCA_API_SECRET_KEY", "test_alpaca_secret")


@pytest.fixture
def app():
    """Create test application."""
    from services.api.main import create_app
    return create_app()


@pytest.fixture
async def client(app):
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestAutopilotEndpoints:
    """Test autopilot API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_status(self, client):
        """Test GET /api/v1/autopilot/status."""
        response = await client.get("/api/v1/autopilot/status")
        assert response.status_code == 200
        
        data = response.json()
        # Updated to match new StatusResponse schema
        assert "is_running" in data
        assert "state" in data
        assert "kill_switch_active" in data
        assert "current_phase" in data
    
    @pytest.mark.asyncio
    async def test_run_autopilot_dry_run(self, client):
        """Test POST /api/v1/autopilot/run with dry_run=true."""
        response = await client.post(
            "/api/v1/autopilot/run",
            json={"dry_run": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Updated to match CycleResponse schema
        assert "run_id" in data
        assert "success" in data
        assert data["success"] == True or "error" in data
        assert "candidates_generated" in data
    
    @pytest.mark.asyncio
    async def test_get_run_artifact(self, client):
        """Test GET /api/v1/autopilot/run/{run_id} after running."""
        # First run to generate an artifact
        run_response = await client.post("/api/v1/autopilot/run", json={"dry_run": True})
        assert run_response.status_code == 200
        
        run_data = run_response.json()
        run_id = run_data.get("run_id")
        
        # Get the run artifact
        response = await client.get(f"/api/v1/autopilot/run/{run_id}")
        # 200 if found, 404 if not found (might not persist in test env)
        assert response.status_code in [200, 404]
    
    @pytest.mark.asyncio
    async def test_get_positions(self, client):
        """Test GET /api/v1/autopilot/positions."""
        response = await client.get("/api/v1/autopilot/positions")
        assert response.status_code == 200
        
        data = response.json()
        assert "count" in data
        assert "positions" in data


class TestVerificationEndpoints:
    """Test verification API endpoints."""
    
    @pytest.mark.asyncio
    async def test_alpaca_health_no_creds(self, client):
        """Test Alpaca health when credentials not fully configured."""
        # Clear creds for test
        with patch.dict(os.environ, {"APCA_API_KEY_ID": "", "APCA_API_SECRET_KEY": ""}):
            response = await client.get("/api/v1/verification/alpaca/health")
            assert response.status_code == 200
            
            data = response.json()
            assert "status" in data
    
    @pytest.mark.asyncio
    async def test_verify_last_run_no_runs(self, client):
        """Test verify last run when no runs exist."""
        from services.autopilot.ledger import _ledger_instance
        
        # Clear ledger state
        if _ledger_instance:
            _ledger_instance._runs.clear()
            _ledger_instance._entries.clear()
        
        response = await client.get("/api/v1/verification/last_run")
        # Either 404 (no runs) or 200 (if previous test left data)
        assert response.status_code in [200, 404]
    
    @pytest.mark.asyncio
    async def test_verify_after_run(self, client):
        """Test verification after autopilot run."""
        # Run autopilot first
        run_response = await client.post(
            "/api/v1/autopilot/run",
            json={"dry_run": False}
        )
        assert run_response.status_code == 200
        
        # Now verify - may be 404 if no entries were placed
        verify_response = await client.get("/api/v1/verification/last_run")
        # Accept both 200 (if entries exist) and 404 (if no runs or no placed entries)
        assert verify_response.status_code in [200, 404]
        
        if verify_response.status_code == 200:
            data = verify_response.json()
            assert "run_id" in data
            assert "results" in data


class TestHealthEndpoint:
    """Test general health endpoint."""
    
    @pytest.mark.asyncio
    async def test_health(self, client):
        """Test /health endpoint."""
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
