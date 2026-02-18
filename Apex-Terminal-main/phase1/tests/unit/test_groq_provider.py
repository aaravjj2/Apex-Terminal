import os
import sys
import json
import pathlib
import pytest

# Ensure repo root is on sys.path when running this test in isolation
ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from phase1.services.llm.providers.groq_provider import GroqProvider


class DummyResp:
    def __init__(self, status=200, text=None, json_data=None):
        self.status_code = status
        self.text = text or ""
        self._json = json_data

    def json(self):
        if self._json is not None:
            return self._json
        return json.loads(self.text)


def test_health_check_with_mock(monkeypatch):
    # Mock requests.get to simulate reachable /models endpoint
    class DummyGet:
        def __call__(self, *args, **kwargs):
            return DummyResp(status=200, json_data={})

    monkeypatch.setattr("phase1.services.llm.providers.groq_provider.requests.get", DummyGet())

    p = GroqProvider(api_key="fake-key")
    h = p.health_check()
    assert h["available"] is True
    assert h["api_key_set"] is True
    assert h["api_reachable"] is True


def test_rank_candidates_parsing_fallback(monkeypatch):
    # Simulate Groq returning assistant content with extra text around JSON
    content = (
        "Here is the result.\n\nExplanation: X\n\n"
        "```json\n{"
        '\"selected_ids\": [\"c1\"], \"explanation\": \"ok\", \"confidence\": 0.9}\n```'
    )

    body = {
        "choices": [
            {"message": {"content": content}}
        ]
    }

    def dummy_post(*args, **kwargs):
        return DummyResp(status=200, json_data=body)

    monkeypatch.setattr("phase1.services.llm.providers.groq_provider.requests.post", dummy_post)

    p = GroqProvider(api_key="fake-key")
    context = {
        "candidates": [{"id": "c1"}, {"id": "c2"}],
    }

    resp = p.rank_candidates(context)

    # Fallback should extract the JSON and return selected id
    assert resp.selected_ids == ["c1"]
    assert "ok" in resp.explanation
    assert resp.error is None


@pytest.mark.skipif(not os.environ.get("GROQ_API_KEY"), reason="Requires GROQ_API_KEY env var")
def test_rank_candidates_integration():
    # This integration test will actually call Groq if key is present.
    p = GroqProvider()
    assert p.is_available

    context = {
        "market_regime": "bull",
        "vix_level": 12.3,
        "portfolio": {"equity": 100000, "total_risk": 2500, "position_count": 2, "daily_pnl": 120.5},
        "candidates": [
            {"id": "c1", "symbol": "AAPL", "max_loss": 100, "liquidity_score": 9.5},
            {"id": "c2", "symbol": "TSLA", "max_loss": 200, "liquidity_score": 7.0},
        ],
        "instructions": "Select the single best candidate, prioritize low max loss and liquidity."
    }

    resp = p.rank_candidates(context)
    # Should not raise and should return a healthily formed response (may be empty if model refuses)
    assert hasattr(resp, "selected_ids")
    assert isinstance(resp.selected_ids, list)
