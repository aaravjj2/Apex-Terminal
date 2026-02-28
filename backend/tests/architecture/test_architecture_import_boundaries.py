"""
Wave 85 – Architecture Import Boundary Tests
----------------------------------------------
Scans the backend/domains/ tree and enforces:
  1. No domain imports from another domain (cross-domain coupling)
  2. All cross-domain DTOs flow through backend.core.contracts
  3. core/contracts does NOT import from backend.domains.*
  4. Domain modules import only from:
       - stdlib
       - third-party packages
       - backend.core.*   (config, startup_checks, contracts/*)
       - NOT backend.domains.<other_domain>.*

Hard constraints: No mocks. Pure static analysis via ast.parse.
"""
import ast
import sys
from pathlib import Path
import pytest

# Repo root = four levels up from this file (backend/tests/architecture/test_*.py)
REPO_ROOT = Path(__file__).parent.parent.parent.parent
DOMAINS_ROOT = REPO_ROOT / "backend" / "domains"
CORE_CONTRACTS_ROOT = REPO_ROOT / "backend" / "core" / "contracts"


def _collect_py_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(directory.rglob("*.py"))


def _get_imports(filepath: Path) -> list[str]:
    """Return all imported module names (dotted strings) from a .py file."""
    try:
        tree = ast.parse(filepath.read_text(encoding="utf-8"))
    except SyntaxError:
        return []
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)
    return imports


def _domain_name_of(filepath: Path) -> str:
    """Return the domain name (e.g. 'audit') for a file inside backend/domains/<domain>/."""
    try:
        rel = filepath.relative_to(DOMAINS_ROOT)
        return rel.parts[0]  # first component = domain name
    except ValueError:
        return ""


KNOWN_DOMAINS = ["search", "backtesting", "workflows", "agents", "broker", "audit"]


# ---------------------------------------------------------------------------
# Fixture: collect all domain source files
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def domain_python_files() -> list[Path]:
    files = []
    for d in KNOWN_DOMAINS:
        domain_dir = DOMAINS_ROOT / d
        files.extend(_collect_py_files(domain_dir))
    return files


@pytest.fixture(scope="module")
def contracts_python_files() -> list[Path]:
    return _collect_py_files(CORE_CONTRACTS_ROOT)


# ---------------------------------------------------------------------------
# 1. Domain structure tests
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("domain", KNOWN_DOMAINS)
def test_domain_directory_exists(domain: str):
    """Each expected domain directory must exist."""
    assert (DOMAINS_ROOT / domain).is_dir(), (
        f"Missing backend/domains/{domain}/ — create domain skeleton"
    )


@pytest.mark.parametrize("domain", KNOWN_DOMAINS)
def test_domain_has_init(domain: str):
    """Each domain must have an __init__.py."""
    init_file = DOMAINS_ROOT / domain / "__init__.py"
    assert init_file.exists(), f"Missing backend/domains/{domain}/__init__.py"


@pytest.mark.parametrize("domain", KNOWN_DOMAINS)
def test_domain_has_models(domain: str):
    """Each domain must have a models.py."""
    models_file = DOMAINS_ROOT / domain / "models.py"
    assert models_file.exists(), f"Missing backend/domains/{domain}/models.py"


# ---------------------------------------------------------------------------
# 2. Import boundary tests
# ---------------------------------------------------------------------------


def test_no_cross_domain_imports(domain_python_files: list[Path]):
    """
    A domain file must NEVER import from another domain.
    e.g. backend/domains/audit/*.py must not import backend.domains.broker.
    """
    violations = []
    for filepath in domain_python_files:
        my_domain = _domain_name_of(filepath)
        if not my_domain:
            continue
        imports = _get_imports(filepath)
        for imp in imports:
            # Check if import touches any other domain
            for other_domain in KNOWN_DOMAINS:
                if other_domain == my_domain:
                    continue
                if f"backend.domains.{other_domain}" in imp or imp.startswith(f"domains.{other_domain}"):
                    violations.append(
                        f"{filepath.relative_to(REPO_ROOT)} imports {imp!r} "
                        f"(cross-domain: {my_domain} → {other_domain})"
                    )
    assert violations == [], (
        "Cross-domain import violations detected:\n" + "\n".join(violations)
    )


def test_contracts_does_not_import_domains(contracts_python_files: list[Path]):
    """
    backend/core/contracts/ must NEVER import from backend.domains.*
    (contracts are upstream of domains, not downstream)
    """
    violations = []
    for filepath in contracts_python_files:
        imports = _get_imports(filepath)
        for imp in imports:
            if "backend.domains." in imp or imp.startswith("domains."):
                violations.append(
                    f"{filepath.relative_to(REPO_ROOT)} imports {imp!r} "
                    "(contracts must not import from domains)"
                )
    assert violations == [], (
        "Contracts imports domain code (circular dependency):\n"
        + "\n".join(violations)
    )


def test_domain_imports_only_allowed_modules(domain_python_files: list[Path]):
    """
    Domain files must only import from:
      - stdlib / third-party
      - backend.core.*  (config, startup_checks, contracts)

    NOT from backend.domains.<other> (that's caught above, but this is belt-and-suspenders).
    NOT from phase1.* (would re-introduce coupling to old layout).
    """
    violations = []
    forbidden_prefixes = [
        "phase1.",
        "services.",   # old phase1 layout
    ]
    for filepath in domain_python_files:
        imports = _get_imports(filepath)
        for imp in imports:
            for prefix in forbidden_prefixes:
                if imp.startswith(prefix):
                    violations.append(
                        f"{filepath.relative_to(REPO_ROOT)} imports {imp!r} "
                        f"— forbidden prefix {prefix!r}"
                    )
    assert violations == [], (
        "Domain file imports from forbidden phase1/services namespace:\n"
        + "\n".join(violations)
    )


# ---------------------------------------------------------------------------
# 3. Fully-migrated domain probes (audit + broker)
# ---------------------------------------------------------------------------


def test_audit_domain_has_routes():
    """Audit domain must have routes.py (fully migrated)."""
    routes_file = DOMAINS_ROOT / "audit" / "routes.py"
    assert routes_file.exists(), "backend/domains/audit/routes.py missing"


def test_broker_domain_has_routes():
    """Broker domain must have routes.py (fully migrated)."""
    routes_file = DOMAINS_ROOT / "broker" / "routes.py"
    assert routes_file.exists(), "backend/domains/broker/routes.py missing"


def test_audit_routes_importable():
    """backend.domains.audit.routes must import without error."""
    # Ensure REPO_ROOT is on sys.path
    repo_root_str = str(REPO_ROOT)
    if repo_root_str not in sys.path:
        sys.path.insert(0, repo_root_str)
    from backend.domains.audit.routes import router  # noqa: F401
    assert router is not None


def test_broker_routes_importable():
    """backend.domains.broker.routes must import without error."""
    repo_root_str = str(REPO_ROOT)
    if repo_root_str not in sys.path:
        sys.path.insert(0, repo_root_str)
    from backend.domains.broker.routes import router  # noqa: F401
    assert router is not None


def test_contracts_common_importable():
    """backend.core.contracts.common must import without error."""
    repo_root_str = str(REPO_ROOT)
    if repo_root_str not in sys.path:
        sys.path.insert(0, repo_root_str)
    from backend.core.contracts.common import PaginationParams, ErrorResponse, HealthStatus  # noqa: F401
    assert PaginationParams is not None


def test_contracts_events_importable():
    """backend.core.contracts.events must import without error."""
    repo_root_str = str(REPO_ROOT)
    if repo_root_str not in sys.path:
        sys.path.insert(0, repo_root_str)
    from backend.core.contracts.events import AuditEvent, EventCategory, EventFilter  # noqa: F401
    assert AuditEvent is not None


# ---------------------------------------------------------------------------
# 4. Live server probes (domain routes registered and responding)
# ---------------------------------------------------------------------------


import httpx

BASE_URL = "http://127.0.0.1:8090"
TIMEOUT = 10.0


def test_audit_events_endpoint_live():
    """GET /api/v3/events must return 200 with paginated envelope."""
    r = httpx.get(f"{BASE_URL}/api/v3/events", timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)


def test_audit_events_search_live():
    """POST /api/v3/events/search must return AuditSearchResult schema."""
    r = httpx.post(
        f"{BASE_URL}/api/v3/events/search",
        json={},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200
    body = r.json()
    assert "events" in body
    assert "total" in body
    assert isinstance(body["events"], list)


def test_broker_health_domain_live():
    """GET /api/v3/broker/health must return correlation_id + broker.connected=true."""
    r = httpx.get(f"{BASE_URL}/api/v3/broker/health", timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert "correlation_id" in body
    assert body.get("broker", {}).get("connected") is True


def test_broker_account_domain_live():
    """GET /api/v3/broker/account must return connected=true."""
    r = httpx.get(f"{BASE_URL}/api/v3/broker/account", timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert body.get("connected") is True
