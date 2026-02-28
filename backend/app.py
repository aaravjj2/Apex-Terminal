"""
backend/__init__.py
Compatibility shim: exposes the phase1 FastAPI app under the canonical backend/ path.
Wave 82 monorepo layout. Permanent home will be backend/main.py (Wave 85+).
"""
# This shim allows: python -m uvicorn backend.app:app
# The canonical implementation lives in phase1/services/api/main.py until
# the W85 domain migration is complete.
from phase1.services.api.main import create_app  # noqa: F401

app = create_app()

__all__ = ["app"]
