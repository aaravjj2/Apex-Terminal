"""
Tests for v1.37–v1.40: Provider Registry, Citations, Search Index, Agent Runner.
All deterministic, demo-mode, no external dependencies.
Uses FastAPI TestClient.
"""
import hashlib
import json
import pytest


@pytest.fixture(scope="module")
def client(test_client):
    """Re-use session-scoped test_client to avoid async teardown errors."""
    return test_client


# ──── v1.37 Provider Registry ────

class TestProviderRegistry:
    """v1.37: Provider Registry deterministic output."""

    def test_providers_list(self, client):
        r = client.get("/api/v1/provider-registry/providers")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 7  # market data + platform subsystems
        names = [p["name"] for p in data]
        assert "search-index" in names
        assert "agent-runner" in names
        assert "ta-engine" in names

    def test_providers_hash_deterministic(self, client):
        """Hash must be identical across 3 calls — determinism proof."""
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/provider-registry/providers/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2], f"Non-deterministic: {hashes}"

    def test_providers_by_subsystem(self, client):
        r = client.get("/api/v1/provider-registry/providers/market_data")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(p["subsystem"] == "market_data" for p in data)

    def test_provider_fields(self, client):
        r = client.get("/api/v1/provider-registry/providers")
        p = r.json()[0]
        for field in ["name", "mode", "enabled", "subsystem", "metadata"]:
            assert field in p, f"Missing field: {field}"


# ──── v1.38 Citations ────

class TestCitations:
    """v1.38: Citations & Evidence Format."""

    def test_citations_list(self, client):
        r = client.get("/api/v1/citations/")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6

    def test_citations_hash_deterministic(self, client):
        """Hash must be identical across 3 calls."""
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/citations/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_citations_by_source(self, client):
        r = client.get("/api/v1/citations/by-source/risk_run")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(c["source_type"] == "risk_run" for c in data)

    def test_citation_by_id(self, client):
        r = client.get("/api/v1/citations/cit-001")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "cit-001"
        assert data["source_type"] == "risk_run"

    def test_citation_fields(self, client):
        r = client.get("/api/v1/citations/")
        c = r.json()[0]
        for field in ["id", "source_type", "source_id", "title", "detail", "timestamp"]:
            assert field in c, f"Missing field: {field}"

    def test_citations_stable_ordering(self, client):
        """Same order every time."""
        r1 = client.get("/api/v1/citations/").json()
        r2 = client.get("/api/v1/citations/").json()
        assert [c["id"] for c in r1] == [c["id"] for c in r2]


# ──── v1.39 Search Index ────

class TestSearchIndex:
    """v1.39: Internal Search Index."""

    def test_search_query_sma(self, client):
        r = client.get("/api/v1/search/query?q=SMA+crossover")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "SMA" in data[0]["title"]

    def test_search_query_risk(self, client):
        r = client.get("/api/v1/search/query?q=risk+AAPL")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_search_query_backtest(self, client):
        r = client.get("/api/v1/search/query?q=backtest")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_search_stable_ordering(self, client):
        """Deterministic: same results for same query."""
        r1 = client.get("/api/v1/search/query?q=SMA+crossover").json()
        r2 = client.get("/api/v1/search/query?q=SMA+crossover").json()
        assert [x["id"] for x in r1] == [x["id"] for x in r2]

    def test_search_type_filter(self, client):
        r = client.get("/api/v1/search/query?q=SMA&type=strategy")
        assert r.status_code == 200
        data = r.json()
        assert all(x["type"] == "strategy" for x in data)

    def test_index_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/search/index/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]


# ──── v1.40 Agent Runner ────

class TestAgentRunner:
    """v1.40: Agent Runner DEMO multi-step."""

    def test_agent_run(self, client):
        r = client.post("/api/v1/agents/run")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"
        assert len(data["steps"]) == 5
        assert "agent-run-demo" in data["run_id"]

    def test_agent_steps_structure(self, client):
        r = client.post("/api/v1/agents/run")
        data = r.json()
        for step in data["steps"]:
            assert "step_id" in step
            assert "tool" in step
            assert "inputs" in step
            assert "outputs" in step
            assert "citations" in step

    def test_agent_final_output(self, client):
        r = client.post("/api/v1/agents/run")
        data = r.json()
        assert "MODERATE BUY" in data["final_output"]
        assert data["total_duration_ms"] > 0

    def test_agent_run_hash_deterministic(self, client):
        """Hash identical across 3 runs."""
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/agents/runs/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_agent_tools(self, client):
        r = client.get("/api/v1/agents/tools")
        assert r.status_code == 200
        tools = r.json()
        assert len(tools) == 5
        tool_names = [t["name"] for t in tools]
        assert "search" in tool_names
        assert "synthesize" in tool_names

    def test_agent_runs_list(self, client):
        r = client.get("/api/v1/agents/runs")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
