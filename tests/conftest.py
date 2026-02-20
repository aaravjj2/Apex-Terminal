"""
Pytest configuration for root-level tests
"""
import os
import sys
from pathlib import Path
import pytest

# Add phase1 directory to Python path so that imports like
# "from services.api.main import app" work correctly
# conftest.py is in tests/, so we need to go up one level to repo root
repo_root = Path(__file__).parent.parent
phase1_dir = repo_root / "phase1"

if str(phase1_dir) not in sys.path:
    sys.path.insert(0, str(phase1_dir))

# Ensure E2E_MODE is set so backend uses mock data (no real broker calls)
os.environ.setdefault("E2E_MODE", "1")

# Debug: print to verify path is correct
print(f"[conftest.py] Added to sys.path: {phase1_dir}")


@pytest.fixture(scope="session")
def test_client():
    """Shared FastAPI TestClient for all tests that need HTTP access."""
    from fastapi.testclient import TestClient
    from services.api.main import app
    with TestClient(app) as client:
        yield client
