"""conftest.py for backend tests — adds repo root to sys.path."""
import sys
import os

# Set DATABASE_URL before any service imports
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_backend.db")

# Add repo root so phase1.* imports work
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PHASE1_DIR = os.path.join(REPO_ROOT, "phase1")

for p in [PHASE1_DIR, REPO_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Expose repo root for tests
os.environ.setdefault("REPO_ROOT", REPO_ROOT)
