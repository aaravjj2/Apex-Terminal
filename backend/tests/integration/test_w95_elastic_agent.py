"""
W95 Elastic Agent Builder — Integration Tests
HTTP-only via httpx against localhost:8090
~26 tests
"""
import pytest
import httpx

BASE = "http://localhost:8090"
ELASTIC_BASE = f"{BASE}/api/v3/elastic-agent"
TIMEOUT = 30


@pytest.fixture(scope="module", autouse=True)
def reset_builder():
    """Clear all builder data before test suite."""
    r = httpx.delete(f"{ELASTIC_BASE}/data", timeout=TIMEOUT)
    assert r.status_code == 200
    yield
    httpx.delete(f"{ELASTIC_BASE}/data", timeout=TIMEOUT)


# ─────────────────────────────────────────────
# 1. GET /status
# ─────────────────────────────────────────────
class TestBuilderStatus:
    def test_status_200(self):
        r = httpx.get(f"{ELASTIC_BASE}/status", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_status_has_remote_enabled(self):
        r = httpx.get(f"{ELASTIC_BASE}/status", timeout=TIMEOUT)
        data = r.json()
        assert "remote_enabled" in data
        assert isinstance(data["remote_enabled"], bool)

    def test_status_has_mode(self):
        r = httpx.get(f"{ELASTIC_BASE}/status", timeout=TIMEOUT)
        data = r.json()
        assert "mode" in data
        assert data["mode"] in ("local", "remote")

    def test_status_has_reason(self):
        r = httpx.get(f"{ELASTIC_BASE}/status", timeout=TIMEOUT)
        data = r.json()
        assert "reason" in data

    def test_status_disabled_without_keys(self):
        """Without ELASTIC_AGENT_URL, remote_enabled must be False."""
        r = httpx.get(f"{ELASTIC_BASE}/status", timeout=TIMEOUT)
        data = r.json()
        # In test env no keys are configured → must be local mode
        assert data["remote_enabled"] is False
        assert data["mode"] == "local"


# ─────────────────────────────────────────────
# 2. POST /connect-test — refuses without keys
# ─────────────────────────────────────────────
class TestConnectTest:
    def test_connect_test_503_without_keys(self):
        """The connect-test endpoint must refuse (503) when keys are not set."""
        r = httpx.post(f"{ELASTIC_BASE}/connect-test", timeout=TIMEOUT)
        assert r.status_code == 503

    def test_connect_test_503_has_detail(self):
        r = httpx.post(f"{ELASTIC_BASE}/connect-test", timeout=TIMEOUT)
        assert r.status_code == 503
        data = r.json()
        assert "detail" in data

    def test_connect_test_503_detail_has_required_env(self):
        r = httpx.post(f"{ELASTIC_BASE}/connect-test", timeout=TIMEOUT)
        detail = r.json()["detail"]
        assert "required_env" in detail
        assert "ELASTIC_AGENT_URL" in detail["required_env"]
        assert "ELASTIC_AGENT_API_KEY" in detail["required_env"]


# ─────────────────────────────────────────────
# 3. POST /agents — create agent
# ─────────────────────────────────────────────
class TestCreateAgent:
    @pytest.fixture(scope="class")
    def created_agent(self):
        r = httpx.post(
            f"{ELASTIC_BASE}/agents",
            json={"name": "W95 Test Agent", "description": "Integration test agent"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        return r.json()

    def test_create_returns_201(self):
        r = httpx.post(
            f"{ELASTIC_BASE}/agents",
            json={"name": "W95 Create Test", "description": "test"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 201

    def test_create_has_agent_id(self, created_agent):
        assert "agent_id" in created_agent
        assert len(created_agent["agent_id"]) > 5

    def test_create_has_name(self, created_agent):
        assert created_agent["name"] == "W95 Test Agent"

    def test_create_has_tools(self, created_agent):
        assert "tools" in created_agent
        assert isinstance(created_agent["tools"], list)
        assert len(created_agent["tools"]) >= 1

    def test_create_schema_valid(self, created_agent):
        for field in ("agent_id", "name", "description", "tools", "created_at"):
            assert field in created_agent


# ─────────────────────────────────────────────
# 4. GET /agents
# ─────────────────────────────────────────────
class TestListAgents:
    @pytest.fixture(scope="class", autouse=True)
    def ensure_agent(self):
        httpx.post(
            f"{ELASTIC_BASE}/agents",
            json={"name": "W95 List Test Agent"},
            timeout=TIMEOUT,
        )

    def test_list_agents_200(self):
        r = httpx.get(f"{ELASTIC_BASE}/agents", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_list_agents_returns_list(self):
        r = httpx.get(f"{ELASTIC_BASE}/agents", timeout=TIMEOUT)
        data = r.json()
        assert "agents" in data
        assert isinstance(data["agents"], list)

    def test_list_agents_count_positive(self):
        r = httpx.get(f"{ELASTIC_BASE}/agents", timeout=TIMEOUT)
        data = r.json()
        assert data["count"] > 0

    def test_list_agents_have_required_fields(self):
        r = httpx.get(f"{ELASTIC_BASE}/agents", timeout=TIMEOUT)
        agents = r.json()["agents"]
        assert len(agents) > 0
        for field in ("id", "name", "tools", "created_at"):
            assert field in agents[0]


# ─────────────────────────────────────────────
# 5. POST /agents/{id}/run
# ─────────────────────────────────────────────
class TestRunAgentBuilder:
    @pytest.fixture(scope="class")
    def agent_id(self):
        r = httpx.post(
            f"{ELASTIC_BASE}/agents",
            json={"name": "W95 Run Agent"},
            timeout=TIMEOUT,
        )
        return r.json()["agent_id"]

    @pytest.fixture(scope="class")
    def run_result(self, agent_id):
        r = httpx.post(
            f"{ELASTIC_BASE}/agents/{agent_id}/run",
            json={"query": "w95 test find strategies"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        return r.json()

    def test_run_returns_200(self, agent_id):
        r = httpx.post(
            f"{ELASTIC_BASE}/agents/{agent_id}/run",
            json={"query": "w95 run test"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200

    def test_run_has_run_id(self, run_result):
        assert "run_id" in run_result
        assert len(run_result["run_id"]) > 5

    def test_run_has_agent_id(self, run_result, agent_id):
        assert run_result["agent_id"] == agent_id

    def test_run_status_completed(self, run_result):
        assert run_result["status"] == "completed"

    def test_run_has_tool_calls(self, run_result):
        assert "tool_calls" in run_result
        assert isinstance(run_result["tool_calls"], list)

    def test_run_has_citations(self, run_result):
        assert "citations" in run_result
        assert isinstance(run_result["citations"], list)

    def test_run_has_summary(self, run_result):
        assert "summary" in run_result
        assert len(run_result["summary"]) > 0

    def test_run_remote_used_false_without_keys(self, run_result):
        """Without Elastic Agent keys, remote_used must be False."""
        assert run_result["remote_used"] is False

    def test_run_404_on_missing_agent(self):
        r = httpx.post(
            f"{ELASTIC_BASE}/agents/nonexistent-id-xyz/run",
            json={"query": "test"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 404


# ─────────────────────────────────────────────
# 6. GET /runs
# ─────────────────────────────────────────────
class TestListRuns:
    def test_runs_200(self):
        r = httpx.get(f"{ELASTIC_BASE}/runs", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_runs_returns_list(self):
        r = httpx.get(f"{ELASTIC_BASE}/runs", timeout=TIMEOUT)
        data = r.json()
        assert "runs" in data
        assert isinstance(data["runs"], list)


# ─────────────────────────────────────────────
# 7. DELETE /data
# ─────────────────────────────────────────────
class TestClearData:
    def test_delete_data_200(self):
        r = httpx.delete(f"{ELASTIC_BASE}/data", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_delete_data_ok_true(self):
        r = httpx.delete(f"{ELASTIC_BASE}/data", timeout=TIMEOUT)
        data = r.json()
        assert data.get("ok") is True

    def test_agents_empty_after_delete(self):
        httpx.delete(f"{ELASTIC_BASE}/data", timeout=TIMEOUT)
        r = httpx.get(f"{ELASTIC_BASE}/agents", timeout=TIMEOUT)
        data = r.json()
        assert data["count"] == 0
