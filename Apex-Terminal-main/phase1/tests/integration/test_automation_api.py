"""
Integration tests for Automation (Autopilot) API routes.
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
async def test_get_automation_status(client):
    """Test GET /api/v1/automation/status returns current status."""
    response = await client.get("/api/v1/automation/status")
    assert response.status_code == 200
    
    data = response.json()
    assert "armed" in data
    assert "mode" in data
    assert "budget" in data
    assert data["armed"] is False  # Default state


@pytest.mark.asyncio
async def test_arm_paper_trading(client):
    """Test POST /api/v1/automation/arm for paper mode."""
    response = await client.post(
        "/api/v1/automation/arm",
        json={"mode": "paper"}
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["armed"] is True
    assert data["mode"] == "paper"


@pytest.mark.asyncio
async def test_arm_live_requires_confirmation(client):
    """Test POST /api/v1/automation/arm for live mode requires confirm_live."""
    # First, ensure disarmed
    await client.post("/api/v1/automation/disarm")
    
    # Try to arm live without confirmation
    response = await client.post(
        "/api/v1/automation/arm",
        json={"mode": "live", "confirm_live": False}
    )
    assert response.status_code == 400
    assert "confirm_live" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_arm_live_with_confirmation(client):
    """Test POST /api/v1/automation/arm for live mode with confirmation."""
    # First, reset kill switch if previously triggered
    await client.post("/api/v1/automation/reset")
    
    response = await client.post(
        "/api/v1/automation/arm",
        json={"mode": "live", "confirm_live": True}
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["armed"] is True
    assert data["mode"] == "live"


@pytest.mark.asyncio
async def test_disarm_automation(client):
    """Test POST /api/v1/automation/disarm stops automation."""
    # First arm
    await client.post("/api/v1/automation/arm", json={"mode": "paper"})
    
    # Then disarm
    response = await client.post("/api/v1/automation/disarm")
    assert response.status_code == 200
    
    data = response.json()
    assert data["armed"] is False


@pytest.mark.asyncio
async def test_kill_switch(client):
    """Test POST /api/v1/automation/kill triggers kill switch."""
    # First arm
    await client.post("/api/v1/automation/arm", json={"mode": "paper"})
    
    # Trigger kill switch
    response = await client.post("/api/v1/automation/kill")
    assert response.status_code == 200
    
    data = response.json()
    assert data["armed"] is False
    assert data["kill_switch_triggered"] is True


@pytest.mark.asyncio
async def test_cannot_arm_after_kill_switch(client):
    """Test that arming fails after kill switch unless reset."""
    # Ensure kill switch is triggered
    await client.post("/api/v1/automation/arm", json={"mode": "paper"})
    await client.post("/api/v1/automation/kill")
    
    # Try to arm again
    response = await client.post(
        "/api/v1/automation/arm",
        json={"mode": "paper"}
    )
    assert response.status_code == 400
    assert "kill switch" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reset_after_kill_switch(client):
    """Test POST /api/v1/automation/reset clears kill switch."""
    # Trigger kill switch first
    await client.post("/api/v1/automation/arm", json={"mode": "paper"})
    await client.post("/api/v1/automation/kill")
    
    # Reset
    response = await client.post("/api/v1/automation/reset")
    assert response.status_code == 200
    
    data = response.json()
    assert data["kill_switch_triggered"] is False
    
    # Now arming should work
    response = await client.post(
        "/api/v1/automation/arm",
        json={"mode": "paper"}
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_jobs_empty(client):
    """Test GET /api/v1/automation/jobs returns empty list initially."""
    response = await client.get("/api/v1/automation/jobs")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_submit_job(client):
    """Test POST /api/v1/automation/jobs submits a job."""
    response = await client.post(
        "/api/v1/automation/jobs",
        json={
            "name": "Test Job",
            "job_type": "local",
            "entrypoint": "test_script.py",
            "parameters": {"param1": "value1"},
        }
    )
    assert response.status_code == 200
    
    data = response.json()
    assert "job_id" in data
    assert data["job_id"].startswith("job_")


@pytest.mark.asyncio
async def test_get_strategy_readiness(client):
    """Test GET /api/v1/automation/readiness/{strategy_id} returns score."""
    response = await client.get("/api/v1/automation/readiness/test_strategy_1")
    assert response.status_code == 200
    
    data = response.json()
    assert "strategy_id" in data
    assert "readiness_score" in data
    assert 0 <= data["readiness_score"] <= 1
