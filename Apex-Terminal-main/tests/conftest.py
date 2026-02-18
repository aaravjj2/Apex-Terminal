"""
Pytest configuration for root-level tests
"""
import sys
from pathlib import Path

# Add phase1 directory to Python path so that imports like
# "from services.api.main import app" work correctly
# conftest.py is in tests/, so we need to go up one level to repo root
repo_root = Path(__file__).parent.parent
phase1_dir = repo_root / "phase1"

if str(phase1_dir) not in sys.path:
    sys.path.insert(0, str(phase1_dir))
    
# Debug: print to verify path is correct
print(f"[conftest.py] Added to sys.path: {phase1_dir}")
