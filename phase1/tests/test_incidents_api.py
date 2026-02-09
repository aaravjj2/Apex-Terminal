"""
Tests for Incidents API routes - specifically the operational alerts endpoints.

NOTE: The incidents router's /alerts routes are shadowed by the alerts router
which is mounted at /api/v1/alerts. The incidents /alerts routes are actually 
at /api/v1/alerts (from incidents router), but get shadowed.

Since the resolve endpoint uses a path parameter, it doesn't conflict.
This test validates the incidents API functionality that IS accessible.
"""
import pytest
from datetime import datetime
from unittest.mock import MagicMock


@pytest.fixture
def mock_repo(mocker):
    """Create and patch the autopilot repository mock."""
    mock = MagicMock()
    mocker.patch(
        'services.api.routes.incidents.get_autopilot_repository', 
        return_value=mock
    )
    return mock


@pytest.fixture
def client():
    """Create a test client."""
    from fastapi.testclient import TestClient
    from services.api.main import app
    return TestClient(app)


class MockIncident:
    """Mock incident for testing."""
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", "inc_1")
        self.severity = kwargs.get("severity", "warning")
        self.category = kwargs.get("category", "system")
        self.title = kwargs.get("title", "Test Incident")
        self.description = kwargs.get("description", "Something happened")
        self.run_id = kwargs.get("run_id", "run_1")
        self.created_at = kwargs.get("created_at", datetime.now())
        self.resolved = kwargs.get("resolved", False)
        self.resolved_at = kwargs.get("resolved_at", None)
        self.resolution_note = kwargs.get("resolution_note", None)


def test_list_incidents_empty(mock_repo, client):
    """Test listing incidents when there are none."""
    mock_repo.list_incidents.return_value = []
    # Use /incidents endpoint not /alerts (which is shadowed)
    response = client.get("/api/v1/incidents")
    assert response.status_code == 200
    # incidents endpoint returns a different format
    assert isinstance(response.json(), list)


def test_resolve_alert(mock_repo, client):
    """Test resolving an operational alert/incident.
    
    The resolve endpoint uses a path parameter so it doesn't
    conflict with the alerts router.
    """
    mock_repo.resolve_incident.return_value = MockIncident(
        resolved_at=datetime.now()
    )
    
    response = client.post("/api/v1/alerts/inc_1/resolve?note=Fixed")
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"
    mock_repo.resolve_incident.assert_called_with("inc_1", note="Fixed")


def test_resolve_alert_not_found(mock_repo, client):
    """Test resolving a non-existent incident."""
    mock_repo.resolve_incident.return_value = None
    
    response = client.post("/api/v1/alerts/non_existent/resolve?note=Fixed")
    assert response.status_code == 404
