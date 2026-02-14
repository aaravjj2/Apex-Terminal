"""
Tests for v1.37–v1.40: Provider Registry, Citations, Search Index, Agent Runner.
All deterministic, demo-mode, no external dependencies.
"""
import hashlib
import json
import pytest
import httpx

BASE = "http://127.0.0.1:8000"


# ──── v1.37 Provider Registry ────

class TestProviderRegistry:
    """v1.37: Provider Registry deterministic output."""

    def test_providers_list(self):
        r = httpx.get(f"{BASE}/api/v1/provider-registry/providers", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 7
        names = [p["name"] for p in data]
        assert "market-data-demo" in names
        assert "search-index" in names
        assert "agent-runner" in names

    def test_providers_hash_deterministic(self):
        """Hash must be identical across 3 calls — determinism proof."""
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/provider-registry/providers/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2], f"Non-deterministic: {hashes}"

    def test_providers_by_subsystem(self):
        r = httpx.get(f"{BASE}/api/v1/provider-registry/providers/market_data", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(p["subsystem"] == "market_data" for p in data)

    def test_provider_fields(self):
        r = httpx.get(f"{BASE}/api/v1/provider-registry/providers", timeout=10)
        p = r.json()[0]
        for field in ["name", "mode", "enabled", "subsystem", "metadata"]:
            assert field in p, f"Missing field: {field}"


# ──── v1.38 Citations ────

class TestCitations:
    """v1.38: Citations & Evidence Format."""

    def test_citations_list(self):
        r = httpx.get(f"{BASE}/api/v1/citations/", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6

    def test_citations_hash_deterministic(self):
        """Hash must be identical across 3 calls."""
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/citations/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_citations_by_source(self):
        r = httpx.get(f"{BASE}/api/v1/citations/by-source/risk_run", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(c["source_type"] == "risk_run" for c in data)

    def test_citation_by_id(self):
        r = httpx.get(f"{BASE}/api/v1/citations/cit-001", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "cit-001"
        assert data["source_type"] == "risk_run"

    def test_citation_fields(self):
        r = httpx.get(f"{BASE}/api/v1/citations/", timeout=10)
        c = r.json()[0]
        for field in ["id", "source_type", "source_id", "title", "detail", "timestamp"]:
            assert field in c, f"Missing field: {field}"

    def test_citations_stable_ordering(self):
        """Same order every time."""
        r1 = httpx.get(f"{BASE}/api/v1/citations/", timeout=10).json()
        r2 = httpx.get(f"{BASE}/api/v1/citations/", timeout=10).json()
        assert [c["id"] for c in r1] == [c["id"] for c in r2]


# ──── v1.39 Search Index ────

class TestSearchIndex:
    """v1.39: Internal Search Index."""

    def test_search_query_sma(self):
        r = httpx.get(f"{BASE}/api/v1/search/query?q=SMA+crossover", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "SMA" in data[0]["title"]

    def test_search_query_risk(self):
        r = httpx.get(f"{BASE}/api/v1/search/query?q=risk+AAPL", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_search_query_backtest(self):
        r = httpx.get(f"{BASE}/api/v1/search/query?q=backtest", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_search_stable_ordering(self):
        """Deterministic: same results for same query."""
        q = "SMA+crossover"
        r1 = httpx.get(f"{BASE}/api/v1/search/query?q={q}", timeout=10).json()
        r2 = httpx.get(f"{BASE}/api/v1/search/query?q={q}", timeout=10).json()
        assert [x["id"] for x in r1] == [x["id"] for x in r2]

    def test_search_type_filter(self):
        r = httpx.get(f"{BASE}/api/v1/search/query?q=SMA&type=strategy", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert all(x["type"] == "strategy" for x in data)

    def test_index_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/search/index/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]


# ──── v1.40 Agent Runner ────

class TestAgentRunner:
    """v1.40: Agent Runner DEMO multi-step."""

    def test_agent_run(self):
        r = httpx.post(f"{BASE}/api/v1/agents/run", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"
        assert len(data["steps"]) == 5
        assert data["run_id"] == "agent-run-demo-001"

    def test_agent_steps_structure(self):
        r = httpx.post(f"{BASE}/api/v1/agents/run", timeout=10)
        data = r.json()
        for step in data["steps"]:
            assert "step_id" in step
            assert "tool" in step
            assert "inputs" in step
            assert "outputs" in step
            assert "citations" in step

    def test_agent_final_output(self):
        r = httpx.post(f"{BASE}/api/v1/agents/run", timeout=10)
        data = r.json()
        assert "MODERATE BUY" in data["final_output"]
        assert data["total_duration_ms"] == 630

    def test_agent_run_hash_deterministic(self):
        """Hash identical across 3 runs."""
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/agents/runs/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_agent_tools(self):
        r = httpx.get(f"{BASE}/api/v1/agents/tools", timeout=10)
        assert r.status_code == 200
        tools = r.json()
        assert len(tools) == 5
        tool_names = [t["name"] for t in tools]
        assert "search" in tool_names
        assert "synthesize" in tool_names

    def test_agent_runs_list(self):
        r = httpx.get(f"{BASE}/api/v1/agents/runs", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
