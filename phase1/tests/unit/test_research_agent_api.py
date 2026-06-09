"""API integration tests for Research Agent routes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from services.api.main import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_research_status(client: TestClient):
    res = client.get("/api/v1/research/status")
    assert res.status_code == 200
    body = res.json()
    assert body["agent"] == "research_4_node_state_machine"
    assert body["version"] == "1.2.0"
    assert len(body["nodes"]) == 4
    assert "mcp_sse_mounted" in body
    assert "finbert_available" in body
    assert "news_sources" in body


def test_research_news_endpoint(client: TestClient):
    res = client.get("/api/v1/research/news/SPY?limit=3")
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "SPY"
    assert "articles" in body


def test_research_demo_blueprint(client: TestClient):
    res = client.get("/api/v1/research/demo")
    assert res.status_code == 200
    plan = res.json()
    assert plan["trade_plan_id"] == "REQ-7738-ALPHA"
    assert plan["orchestrator_node"]["parsed_components"]["underlying"] == "SPY"
    assert plan["pipeline_nodes"]["node_1_orchestrator"] == "COMPLETE"
    assert plan["synthesis_and_risk"]["recommended_strategy"] == "Bear Put Spread"
    assert "research_quality" in plan
    assert plan["research_quality"]["score"] >= 65


def test_research_run_post(client: TestClient):
    res = client.post(
        "/api/v1/research/run",
        json={
            "osi_symbol": "SPY   251219C00600000",
            "news_text": "SPY beats earnings",
            "market_mid": 12.6,
        },
    )
    assert res.status_code == 200
    plan = res.json()
    assert "quantitative_engine" in plan
    assert "sentiment_quantization" in plan


def test_research_handshake_dry_run(client: TestClient):
    res = client.post(
        "/api/v1/research/handshake",
        json={
            "osi_symbol": "SPY   251219C00600000",
            "news_text": "SPY beats earnings estimates; guidance raised",
            "event_type": "EARNINGS_BEAT",
            "market_mid": 12.6,
            "dry_run": True,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert "trade_plan" in body
    assert body["ticker"] == "SPY"
    # APPROVED or blocked depending on synthesis — handshake always returns structured response
    assert "accepted" in body
    assert "handshake_mode" in body


def test_research_run_rejects_missing_symbol(client: TestClient):
    res = client.post("/api/v1/research/run", json={"news_text": "test"})
    assert res.status_code == 400
