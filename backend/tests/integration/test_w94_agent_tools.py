"""
W94 Agent Tools v1 — Integration Tests
HTTP-only via httpx against localhost:8090
~24 tests
"""
import pytest
import httpx
import time

BASE = "http://localhost:8090"
AGENT_BASE = f"{BASE}/api/v3/agent"
TIMEOUT = 30


@pytest.fixture(scope="module", autouse=True)
def reset_runs():
    """Clear all agent runs before test suite."""
    r = httpx.delete(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
    assert r.status_code == 200
    yield
    # cleanup after
    httpx.delete(f"{AGENT_BASE}/runs", timeout=TIMEOUT)


# ─────────────────────────────────────────────
# 1. GET /tools
# ─────────────────────────────────────────────
class TestToolsList:
    def test_tools_endpoint_200(self):
        r = httpx.get(f"{AGENT_BASE}/tools", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_tools_returns_5(self):
        r = httpx.get(f"{AGENT_BASE}/tools", timeout=TIMEOUT)
        data = r.json()
        assert data["count"] == 5
        assert len(data["tools"]) == 5

    def test_tools_have_required_names(self):
        r = httpx.get(f"{AGENT_BASE}/tools", timeout=TIMEOUT)
        names = {t["name"] for t in r.json()["tools"]}
        for expected in ("search", "fetch_entity", "fetch_graph", "summarize", "create_ticket"):
            assert expected in names

    def test_tools_have_description(self):
        r = httpx.get(f"{AGENT_BASE}/tools", timeout=TIMEOUT)
        for tool in r.json()["tools"]:
            assert "description" in tool
            assert len(tool["description"]) > 5


# ─────────────────────────────────────────────
# 2. POST /run
# ─────────────────────────────────────────────
class TestRunAgent:
    @pytest.fixture(scope="class")
    def run_result(self):
        r = httpx.post(
            f"{AGENT_BASE}/run",
            json={"query": "find strategies with high sharpe ratio"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        return r.json()

    def test_run_returns_200(self, run_result):
        assert run_result is not None

    def test_run_has_run_id(self, run_result):
        assert "run_id" in run_result
        assert len(run_result["run_id"]) > 5

    def test_run_status_completed(self, run_result):
        assert run_result["status"] == "completed"

    def test_run_has_tool_calls(self, run_result):
        assert "tool_calls" in run_result
        assert isinstance(run_result["tool_calls"], list)
        assert len(run_result["tool_calls"]) >= 1

    def test_run_has_citations(self, run_result):
        assert "citations" in run_result
        assert isinstance(run_result["citations"], list)

    def test_run_has_summary(self, run_result):
        assert "summary" in run_result
        assert isinstance(run_result["summary"], str)
        assert len(run_result["summary"]) > 0

    def test_run_tool_calls_have_required_fields(self, run_result):
        for tc in run_result["tool_calls"]:
            assert "tool" in tc
            assert "trace_id" in tc
            assert "ms" in tc
            assert isinstance(tc["ms"], (int, float))


# ─────────────────────────────────────────────
# 3. GET /runs
# ─────────────────────────────────────────────
class TestGetRuns:
    @pytest.fixture(scope="class", autouse=True)
    def ensure_run(self):
        """Ensure at least one run exists."""
        httpx.post(
            f"{AGENT_BASE}/run",
            json={"query": "w94 test run for listing"},
            timeout=TIMEOUT,
        )

    def test_runs_endpoint_200(self):
        r = httpx.get(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_runs_returns_list(self):
        r = httpx.get(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        data = r.json()
        assert "runs" in data
        assert isinstance(data["runs"], list)

    def test_runs_count_positive(self):
        r = httpx.get(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        data = r.json()
        assert data["count"] > 0

    def test_run_items_have_required_fields(self):
        r = httpx.get(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        runs = r.json()["runs"]
        assert len(runs) > 0
        run = runs[0]
        for field in ("id", "query", "status", "created_at"):
            assert field in run, f"Missing field: {field}"


# ─────────────────────────────────────────────
# 4. GET /runs/{run_id}
# ─────────────────────────────────────────────
class TestGetRunById:
    @pytest.fixture(scope="class")
    def run_id(self):
        r = httpx.post(
            f"{AGENT_BASE}/run",
            json={"query": "w94 test run by id", "correlation_id": "test-corr-001"},
            timeout=TIMEOUT,
        )
        return r.json()["run_id"]

    def test_get_run_200(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_get_run_has_run_id(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}", timeout=TIMEOUT)
        data = r.json()
        # detail endpoint returns "id" field (SQLite row id)
        assert data.get("id") == run_id or data.get("run_id") == run_id

    def test_get_run_has_traces(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}", timeout=TIMEOUT)
        data = r.json()
        assert "traces" in data
        assert isinstance(data["traces"], list)

    def test_get_run_traces_not_empty(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}", timeout=TIMEOUT)
        data = r.json()
        assert len(data["traces"]) >= 1

    def test_get_run_404_on_missing(self):
        r = httpx.get(f"{AGENT_BASE}/runs/nonexistent-run-id-xyz", timeout=TIMEOUT)
        assert r.status_code == 404


# ─────────────────────────────────────────────
# 5. GET /runs/{run_id}/traces
# ─────────────────────────────────────────────
class TestGetTraces:
    @pytest.fixture(scope="class")
    def run_id(self):
        r = httpx.post(
            f"{AGENT_BASE}/run",
            json={"query": "w94 traces test backtest performance"},
            timeout=TIMEOUT,
        )
        return r.json()["run_id"]

    def test_traces_endpoint_200(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}/traces", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_traces_returns_list(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}/traces", timeout=TIMEOUT)
        data = r.json()
        assert "traces" in data
        assert isinstance(data["traces"], list)

    def test_traces_at_least_one(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}/traces", timeout=TIMEOUT)
        data = r.json()
        assert len(data["traces"]) >= 1

    def test_trace_has_tool_name(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}/traces", timeout=TIMEOUT)
        traces = r.json()["traces"]
        for t in traces:
            assert "tool_name" in t
            assert t["tool_name"] in ("search", "fetch_entity", "fetch_graph", "summarize", "create_ticket")

    def test_trace_has_duration_ms(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}/traces", timeout=TIMEOUT)
        for t in r.json()["traces"]:
            assert "duration_ms" in t
            assert isinstance(t["duration_ms"], (int, float))
            assert t["duration_ms"] >= 0

    def test_trace_has_args_and_result(self, run_id):
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}/traces", timeout=TIMEOUT)
        for t in r.json()["traces"]:
            assert "args" in t
            assert "result" in t

    def test_search_trace_exists(self, run_id):
        """run_agent always calls search first."""
        r = httpx.get(f"{AGENT_BASE}/runs/{run_id}/traces", timeout=TIMEOUT)
        names = [t["tool_name"] for t in r.json()["traces"]]
        assert "search" in names


# ─────────────────────────────────────────────
# 6. DELETE /runs
# ─────────────────────────────────────────────
class TestClearRuns:
    def test_delete_runs_200(self):
        # Create a run first
        httpx.post(f"{AGENT_BASE}/run", json={"query": "to be deleted"}, timeout=TIMEOUT)
        r = httpx.delete(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_delete_runs_ok_true(self):
        r = httpx.delete(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        data = r.json()
        assert data.get("ok") is True

    def test_runs_empty_after_delete(self):
        httpx.delete(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        r = httpx.get(f"{AGENT_BASE}/runs", timeout=TIMEOUT)
        data = r.json()
        assert data["count"] == 0
