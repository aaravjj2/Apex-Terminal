"""
W91 — Elasticsearch templates + aliases v4.
Tests that templates are installed, aliases exist, and reindex pipeline works.
"""
import pytest
import httpx

BASE = "http://localhost:8090"
API = f"{BASE}/api/v3/ops/es/templates"
INSTALL_URL = f"{BASE}/api/v3/ops/es/templates/install"
REINDEX_URL = f"{BASE}/api/v3/ops/es/reindex"

ENTITY_TYPES = ["events", "strategies", "backtests", "workflows", "jobs", "tickets", "edges"]


@pytest.fixture(scope="module", autouse=True)
def ensure_templates_installed():
    """Install templates once before all W91 tests (sync httpx)."""
    r = httpx.post(INSTALL_URL, timeout=30)
    assert r.status_code == 200, f"Install failed: {r.text}"
    data = r.json()
    assert data["ok"] is True


class TestTemplateHealth:
    def test_health_endpoint_returns_200(self):
        """GET /api/v3/ops/es/templates returns 200."""
        r = httpx.get(API, timeout=15)
        assert r.status_code == 200

    def test_health_has_templates_array(self):
        """Response has 'templates' list with 7 entries."""
        data = httpx.get(API, timeout=15).json()
        assert "templates" in data
        assert len(data["templates"]) == 7

    def test_health_has_aliases_array(self):
        """Response has 'aliases' list with 7 entries."""
        data = httpx.get(API, timeout=15).json()
        assert "aliases" in data
        assert len(data["aliases"]) == 7

    def test_health_has_entity_types_list(self):
        """Response has entity_types = all 7 expected types."""
        data = httpx.get(API, timeout=15).json()
        assert set(data["entity_types"]) == set(ENTITY_TYPES)

    def test_templates_healthy_true(self):
        """After install, templates_healthy must be True."""
        data = httpx.get(API, timeout=15).json()
        assert data["templates_healthy"] is True, f"templates_healthy=False: {data['templates']}"

    def test_aliases_healthy_true(self):
        """After install, aliases_healthy must be True."""
        data = httpx.get(API, timeout=15).json()
        assert data["aliases_healthy"] is True, f"aliases_healthy=False: {data['aliases']}"

    def test_timestamp_present(self):
        """Response has ISO timestamp."""
        data = httpx.get(API, timeout=15).json()
        assert "timestamp" in data
        assert "T" in data["timestamp"]


class TestTemplateSchema:
    def test_each_template_has_entity_field(self):
        """Each template object has entity, template_name, exists, version."""
        data = httpx.get(API, timeout=15).json()
        for t in data["templates"]:
            assert "entity" in t
            assert "template_name" in t
            assert "exists" in t
            assert "version" in t

    def test_each_template_name_convention(self):
        """Template names follow apex-{entity}-template pattern."""
        data = httpx.get(API, timeout=15).json()
        for t in data["templates"]:
            assert t["template_name"] == f"apex-{t['entity']}-template"

    def test_each_template_exists_after_install(self):
        """All 7 templates must exist=True after install."""
        data = httpx.get(API, timeout=15).json()
        for t in data["templates"]:
            assert t["exists"] is True, f"Template {t['template_name']} not installed"

    def test_template_version_is_4(self):
        """Installed templates must report version='4'."""
        data = httpx.get(API, timeout=15).json()
        for t in data["templates"]:
            if t["exists"]:
                assert t["version"] == "4", f"{t['template_name']} version={t['version']}"


class TestAliasSchema:
    def test_each_alias_has_required_fields(self):
        """Each alias object has entity, write_alias, read_alias, exists flags."""
        data = httpx.get(API, timeout=15).json()
        for a in data["aliases"]:
            assert "entity" in a
            assert "write_alias" in a
            assert "read_alias" in a
            assert "write_alias_exists" in a
            assert "read_alias_exists" in a

    def test_write_alias_naming_convention(self):
        """Write aliases follow apex-{entity}-write pattern."""
        data = httpx.get(API, timeout=15).json()
        for a in data["aliases"]:
            assert a["write_alias"] == f"apex-{a['entity']}-write"

    def test_read_alias_naming_convention(self):
        """Read aliases follow apex-{entity}-read pattern."""
        data = httpx.get(API, timeout=15).json()
        for a in data["aliases"]:
            assert a["read_alias"] == f"apex-{a['entity']}-read"

    def test_write_aliases_exist_after_install(self):
        """All 7 write aliases must exist after install."""
        data = httpx.get(API, timeout=15).json()
        for a in data["aliases"]:
            assert a["write_alias_exists"] is True, f"Write alias missing for {a['entity']}"

    def test_read_aliases_exist_after_install(self):
        """All 7 read aliases must exist after install."""
        data = httpx.get(API, timeout=15).json()
        for a in data["aliases"]:
            assert a["read_alias_exists"] is True, f"Read alias missing for {a['entity']}"


class TestInstallEndpoint:
    def test_install_is_idempotent(self):
        """POST /install can be called twice without error."""
        r1 = httpx.post(INSTALL_URL, timeout=30)
        r2 = httpx.post(INSTALL_URL, timeout=30)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["ok"] is True
        assert r2.json()["ok"] is True

    def test_install_returns_7_templates(self):
        """Install response includes 7 template results."""
        data = httpx.post(INSTALL_URL, timeout=30).json()
        assert len(data["templates_installed"]) == 7

    def test_install_returns_7_aliases(self):
        """Install response includes 7 alias results."""
        data = httpx.post(INSTALL_URL, timeout=30).json()
        assert len(data["aliases_ensured"]) == 7


class TestReindexPipeline:
    def test_reindex_dry_run_returns_plan(self):
        """POST /reindex/events?dry_run=true returns a plan."""
        r = httpx.post(f"{REINDEX_URL}/events?dry_run=true", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["entity"] == "events"
        assert data["dry_run"] is True
        assert data["status"] == "planned"

    def test_reindex_plan_has_correlation_id(self):
        """Reindex plan includes correlation_id for tracing."""
        data = httpx.post(f"{REINDEX_URL}/backtests?dry_run=true", timeout=30).json()
        assert "correlation_id" in data
        assert len(data["correlation_id"]) > 0

    def test_reindex_plan_has_source_dest(self):
        """Reindex plan specifies source and destination index."""
        data = httpx.post(f"{REINDEX_URL}/strategies?dry_run=true", timeout=30).json()
        assert "source_index" in data
        assert "dest_index" in data
        assert data["source_index"].startswith("apex-strategies-")

    def test_reindex_plan_has_audit_events(self):
        """Reindex plan includes audit_events array."""
        data = httpx.post(f"{REINDEX_URL}/jobs?dry_run=true", timeout=30).json()
        assert "audit_events" in data
        assert len(data["audit_events"]) >= 1
        assert data["audit_events"][0]["step"] == "plan"

    def test_reindex_invalid_entity(self):
        """POST /reindex/unknown returns error about entity."""
        r = httpx.post(f"{REINDEX_URL}/unknown_entity?dry_run=true", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "error" in data
        assert "unknown_entity" in data["error"]
