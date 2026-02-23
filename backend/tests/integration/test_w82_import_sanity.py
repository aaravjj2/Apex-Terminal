"""
W82 Import Sanity Tests
Validates that routers import cleanly from their registered paths.
"""
import importlib
import os
import pytest

# Repo root is injected by backend/tests/conftest.py
REPO_ROOT = os.environ.get("REPO_ROOT", os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
))))



# Backend route modules that must import without error
# Using services.* since phase1/ is in sys.path (see conftest.py)
ROUTE_MODULES = [
    "services.api.routes.bars",
    "services.api.routes.backtest",
    "services.api.routes.strategies",
    "services.api.routes.search",
    "services.api.routes.agents",
    "services.api.routes.platform_health",
    "services.api.routes.ops_health",
    "services.api.routes.w21_backtest_v4",
    "services.api.routes.w46_elasticsearch_v3",
]


@pytest.mark.parametrize("module_path", ROUTE_MODULES)
def test_route_module_imports_cleanly(module_path):
    """Each route module must importable without errors."""
    mod = importlib.import_module(module_path)
    assert mod is not None, f"Failed to import {module_path}"
    assert hasattr(mod, "router"), f"{module_path} must have a 'router' attribute"


def test_backend_app_shim_importable():
    """backend/app.py shim must import cleanly — create_app must be accessible."""
    # Import from services.api.main (phase1/ is in sys.path via conftest)
    from services.api.main import create_app  # noqa: F401
    app = create_app()
    assert app is not None
    # Check at least one route is registered
    routes = [r.path for r in app.routes if hasattr(r, 'path')]
    assert len(routes) > 0, "App must have at least one route"


def test_infrastructure_compose_exists():
    """infrastructure/docker-compose.yml must exist (Wave 82 deliverable)."""
    compose = os.path.join(REPO_ROOT, "infrastructure", "docker-compose.yml")
    assert os.path.exists(compose), f"Missing: {compose}"


def test_scripts_dev_ps1_exists():
    """scripts/dev.ps1 must exist (Wave 82 deliverable)."""
    script = os.path.join(REPO_ROOT, "scripts", "dev.ps1")
    assert os.path.exists(script), f"Missing: {script}"


def test_makefile_has_new_targets():
    """Makefile must contain Wave 82 make targets."""
    makefile = os.path.join(REPO_ROOT, "Makefile")
    content = open(makefile, encoding='utf-8', errors='replace').read()
    for target in ['up:', 'down:', 'api:', 'web:', 'e2e:', 'hardening:', 'proof:']:
        assert target in content, f"Makefile missing target: {target}"
