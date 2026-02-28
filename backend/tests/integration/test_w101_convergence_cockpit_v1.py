"""
W101 — Convergence Cockpit v1 pytest tests (≥24 cases)
"""
from __future__ import annotations

import httpx
import pytest

BASE = "http://localhost:8090/api/v3/cockpit"
TIMEOUT = 30.0


def client() -> httpx.Client:
    return httpx.Client(base_url=BASE, timeout=TIMEOUT)


@pytest.fixture(autouse=True)
def clear():
    with client() as c:
        c.delete("/data")
    yield
    with client() as c:
        c.delete("/data")


# ─── Scenarios ────────────────────────────────────────────────────────────────

def test_list_scenarios_returns_4():
    with client() as c:
        r = c.get("/scenarios")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 4


def test_scenarios_have_required_fields():
    with client() as c:
        scenarios = c.get("/scenarios").json()["scenarios"]
    for s in scenarios:
        assert "id" in s
        assert "name" in s
        assert "query" in s


def test_volatility_scenario_exists():
    with client() as c:
        scenarios = c.get("/scenarios").json()["scenarios"]
    ids = [s["id"] for s in scenarios]
    assert "scen-volatility" in ids


def test_convergence_scenario_exists():
    with client() as c:
        scenarios = c.get("/scenarios").json()["scenarios"]
    ids = [s["id"] for s in scenarios]
    assert "scen-convergence" in ids


# ─── Run scenario ─────────────────────────────────────────────────────────────

def test_run_scenario_returns_201():
    with client() as c:
        r = c.post("/scenarios/scen-volatility/run")
    assert r.status_code == 201


def test_run_scenario_has_session_id():
    with client() as c:
        result = c.post("/scenarios/scen-volatility/run").json()
    assert "session_id" in result
    assert len(result["session_id"]) == 36


def test_run_scenario_left_pane_has_results():
    with client() as c:
        result = c.post("/scenarios/scen-volatility/run").json()
    assert result["left_pane"]["total"] >= 1
    assert len(result["left_pane"]["results"]) >= 1


def test_run_scenario_center_pane_has_nodes():
    with client() as c:
        result = c.post("/scenarios/scen-convergence/run").json()
    assert result["center_pane"]["node_count"] >= 1
    assert len(result["center_pane"]["nodes"]) >= 1


def test_run_scenario_right_pane_has_citations():
    with client() as c:
        result = c.post("/scenarios/scen-agent-health/run").json()
    assert len(result["right_pane"]["citations"]) >= 1


def test_run_scenario_right_pane_has_agent_trace():
    with client() as c:
        result = c.post("/scenarios/scen-risk/run").json()
    trace = result["right_pane"]["agent_trace"]
    assert "task" in trace
    assert len(trace["steps"]) >= 1


def test_run_invalid_scenario_returns_404():
    with client() as c:
        r = c.post("/scenarios/nonexistent/run")
    assert r.status_code == 404


def test_all_four_scenarios_runnable():
    with client() as c:
        for sid in ["scen-volatility", "scen-convergence", "scen-agent-health", "scen-risk"]:
            r = c.post(f"/scenarios/{sid}/run")
            assert r.status_code == 201, f"Failed for scenario: {sid}"


def test_sessions_accumulate_after_runs():
    with client() as c:
        c.post("/scenarios/scen-volatility/run")
        c.post("/scenarios/scen-convergence/run")
        r = c.get("/sessions")
    assert r.json()["total"] == 2


def test_evidence_nodes_have_relevance():
    with client() as c:
        result = c.post("/scenarios/scen-volatility/run").json()
    for node in result["center_pane"]["nodes"]:
        assert "relevance" in node
        assert 0.0 <= node["relevance"] <= 1.0


def test_search_results_have_score():
    with client() as c:
        result = c.post("/scenarios/scen-volatility/run").json()
    for sr in result["left_pane"]["results"]:
        assert "score" in sr
        assert sr["score"] >= 0.0


# ─── Tickets ─────────────────────────────────────────────────────────────────

def test_create_ticket_returns_201():
    with client() as c:
        r = c.post("/tickets", json={"title": "My Ticket", "scenario_id": "scen-volatility"})
    assert r.status_code == 201


def test_create_ticket_has_id():
    with client() as c:
        t = c.post("/tickets", json={"title": "IDCheck", "scenario_id": "scen-risk"}).json()
    assert "id" in t
    assert len(t["id"]) == 36


def test_create_ticket_default_status_open():
    with client() as c:
        t = c.post("/tickets", json={"title": "Status Test", "scenario_id": "scen-convergence"}).json()
    assert t["status"] == "open"


def test_create_ticket_empty_title_rejected():
    with client() as c:
        r = c.post("/tickets", json={"title": "", "scenario_id": "scen-volatility"})
    assert r.status_code == 422


def test_get_ticket_by_id():
    with client() as c:
        t = c.post("/tickets", json={"title": "Fetchable", "scenario_id": "scen-risk"}).json()
        r = c.get(f"/tickets/{t['id']}")
    assert r.status_code == 200
    assert r.json()["title"] == "Fetchable"


def test_get_nonexistent_ticket_404():
    with client() as c:
        r = c.get("/tickets/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_list_tickets_returns_all():
    with client() as c:
        c.post("/tickets", json={"title": "T1", "scenario_id": "scen-volatility"})
        c.post("/tickets", json={"title": "T2", "scenario_id": "scen-risk"})
        r = c.get("/tickets")
    assert r.json()["total"] == 2


def test_list_tickets_q_filter():
    with client() as c:
        c.post("/tickets", json={"title": "Alpha Signal Review", "scenario_id": "scen-volatility"})
        c.post("/tickets", json={"title": "Beta Convergence", "scenario_id": "scen-convergence"})
        r = c.get("/tickets?q=Alpha")
    assert r.json()["total"] == 1
    assert r.json()["tickets"][0]["title"] == "Alpha Signal Review"


def test_ticket_scenario_run_then_create():
    """Full flow: run scenario → create ticket from session."""
    with client() as c:
        result = c.post("/scenarios/scen-agent-health/run").json()
        ticket = c.post("/tickets", json={
            "title": "Health Audit Ticket",
            "scenario_id": result["scenario_id"],
            "session_id": result["session_id"],
            "evidence_ids": [n["id"] for n in result["center_pane"]["nodes"]],
            "actions": result["right_pane"]["suggested_actions"],
        }).json()
    assert ticket["scenario_id"] == result["scenario_id"]
    assert ticket["session_id"] == result["session_id"]


def test_clear_data_removes_sessions_and_tickets():
    with client() as c:
        c.post("/scenarios/scen-risk/run")
        c.post("/tickets", json={"title": "ClearTest", "scenario_id": "scen-risk"})
        c.delete("/data")
        sess = c.get("/sessions")
        tickets = c.get("/tickets")
    assert sess.json()["total"] == 0
    assert tickets.json()["total"] == 0
