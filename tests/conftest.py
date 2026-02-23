"""
Pytest configuration for root-level tests
"""
import asyncio
import os
import sys
import warnings
from pathlib import Path
import pytest

# ── Gate Repair Wave 20.1 ─────────────────────────────────────────────────────
# Set DATABASE_URL to SQLite BEFORE any other imports so that pydantic-settings
# and the dotenv load in main.py never see the Postgres default.
# The persistence layer already has a SQLite code path (aiosqlite).
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_phase1.db"
# ─────────────────────────────────────────────────────────────────────────────

# Add phase1 directory to Python path so that imports like
# "from services.api.main import app" work correctly
# conftest.py is in tests/, so we need to go up one level to repo root
repo_root = Path(__file__).parent.parent
phase1_dir = repo_root / "phase1"

if str(phase1_dir) not in sys.path:
    sys.path.insert(0, str(phase1_dir))

# Debug: print to verify path is correct
print(f"[conftest.py] Added to sys.path: {phase1_dir}")

# Suppress known aiosqlite CancelledError during async teardown.
# This is a test-infrastructure issue, not a real failure.
warnings.filterwarnings("ignore", message=".*CancelledError.*", category=Warning)


@pytest.fixture(scope="session")
def test_client():
    """Shared FastAPI TestClient for all tests that need HTTP access."""
    from fastapi.testclient import TestClient
    from services.api.main import app
    with TestClient(app) as client:
        yield client
