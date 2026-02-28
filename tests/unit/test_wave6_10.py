"""
Wave 6-10 endpoint tests — comprehensive coverage for all new API routes.
Uses FastAPI TestClient (no live backend needed).
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client(test_client):
    """Re-use session-scoped test_client to avoid async teardown errors."""
    return test_client


# ═══════════════════════════════════════════════════════════════════
# Wave 6 — Monte Carlo
# ═══════════════════════════════════════════════════════════════════
class TestMonteCarlo:
    def test_run_simulation(self, client):
        r = client.post("/api/v1/monte-carlo/run", json={
            "symbol": "SPY", "initial_price": 450, "days": 30, "num_paths": 10, "seed": 42
        })
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "SPY"
        assert "percentile_5" in d
        assert "percentile_95" in d
        assert "var_95" in d
        assert len(d["paths"]) == 10

    def test_run_summary(self, client):
        r = client.post("/api/v1/monte-carlo/run/summary", json={
            "symbol": "AAPL", "initial_price": 200, "days": 20, "num_paths": 5, "seed": 1
        })
        assert r.status_code == 200
        d = r.json()
        assert "paths" not in d  # summary = no paths

    def test_deterministic_hash(self, client):
        r = client.get("/api/v1/monte-carlo/hash")
        assert r.status_code == 200
        h1 = r.json()["hash"]
        r2 = client.get("/api/v1/monte-carlo/hash")
        assert r2.json()["hash"] == h1  # deterministic


# ═══════════════════════════════════════════════════════════════════
# Wave 6 — Walk-Forward
# ═══════════════════════════════════════════════════════════════════
class TestWalkForward:
    def test_run(self, client):
        r = client.post("/api/v1/walk-forward/run", json={
            "strategy_id": "momentum_v1", "symbol": "SPY", "folds": 5
        })
        assert r.status_code == 200
        d = r.json()
        assert "folds" in d
        assert "degradation_ratio" in d
        assert "robust" in d

    def test_folds_list(self, client):
        r = client.get("/api/v1/walk-forward/folds")
        assert r.status_code == 200
        folds = r.json()  # returns a list directly
        assert isinstance(folds, list)
        assert len(folds) >= 1

    def test_hash(self, client):
        r = client.get("/api/v1/walk-forward/hash")
        assert r.status_code == 200
        assert "hash" in r.json()


# ═══════════════════════════════════════════════════════════════════
# Wave 6 — Scoring
# ═══════════════════════════════════════════════════════════════════
class TestScoring:
    def test_score_single(self, client):
        r = client.post("/api/v1/scoring/score", json={
            "symbol": "TSLA", "strategy": "breakout", "price": 250,
            "volume": 1e6, "rsi": 55, "macd_signal": 0.5, "atr": 3.0
        })
        assert r.status_code == 200
        d = r.json()
        assert 0 <= d["total_score"] <= 100
        assert d["grade"] in ("A", "B", "C", "D", "F")

    def test_score_batch(self, client):
        entries = [
            {"symbol": "AAPL", "strategy": "mean_revert", "price": 190, "volume": 500000, "rsi": 30, "macd_signal": -0.2, "atr": 2.0},
            {"symbol": "MSFT", "strategy": "trend_follow", "price": 420, "volume": 800000, "rsi": 65, "macd_signal": 1.0, "atr": 4.0},
        ]
        r = client.post("/api/v1/scoring/score/batch", json=entries)
        assert r.status_code == 200
        assert len(r.json()["scores"]) == 2

    def test_demo(self, client):
        r = client.get("/api/v1/scoring/demo")
        assert r.status_code == 200
        assert len(r.json()["scores"]) >= 1

    def test_hash(self, client):
        r = client.get("/api/v1/scoring/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 6 — Sentiment
# ═══════════════════════════════════════════════════════════════════
class TestSentiment:
    def test_articles(self, client):
        r = client.get("/api/v1/sentiment/articles")
        assert r.status_code == 200
        assert len(r.json()["articles"]) >= 1

    def test_symbols(self, client):
        r = client.get("/api/v1/sentiment/symbols")
        assert r.status_code == 200
        sents = r.json()["sentiments"]
        assert len(sents) >= 1
        assert "symbol" in sents[0]

    def test_single_symbol(self, client):
        r = client.get("/api/v1/sentiment/symbols/AAPL")
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "AAPL"

    def test_market_mood(self, client):
        r = client.get("/api/v1/sentiment/market-mood")
        assert r.status_code == 200
        assert "mood" in r.json()

    def test_hash(self, client):
        r = client.get("/api/v1/sentiment/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 6 — Regime
# ═══════════════════════════════════════════════════════════════════
class TestRegime:
    def test_list_all(self, client):
        r = client.get("/api/v1/regime")
        assert r.status_code == 200
        assert len(r.json()["regimes"]) >= 1

    def test_single_symbol(self, client):
        r = client.get("/api/v1/regime/SPY")
        assert r.status_code == 200
        assert r.json()["symbol"] == "SPY"

    def test_summary(self, client):
        r = client.get("/api/v1/regime/summary")
        assert r.status_code == 200
        d = r.json()
        assert "dominant_regime" in d or "counts" in d

    def test_hash(self, client):
        r = client.get("/api/v1/regime/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 7 — Elasticsearch Gateway
# ═══════════════════════════════════════════════════════════════════
class TestElasticsearch:
    def test_search_demo_mode(self, client):
        r = client.post("/api/v1/elasticsearch/search", json={"query": "AAPL", "index": "trades"})
        assert r.status_code == 200
        d = r.json()
        assert "hits" in d
        assert "total" in d

    def test_status(self, client):
        r = client.get("/api/v1/elasticsearch/status")
        assert r.status_code == 200
        d = r.json()
        assert "enabled" in d
        assert "cluster_name" in d

    def test_hash(self, client):
        r = client.get("/api/v1/elasticsearch/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 8 — Nova LLM
# ═══════════════════════════════════════════════════════════════════
class TestNova:
    def test_generate_demo(self, client):
        r = client.post("/api/v1/nova/generate", json={"prompt": "Analyze AAPL"})
        assert r.status_code == 200
        d = r.json()
        assert "text" in d
        assert len(d["text"]) > 0

    def test_validate(self, client):
        r = client.post("/api/v1/nova/validate", json={
            "candidate": {"action": "buy", "symbol": "AAPL"},
            "context": {"portfolio_value": 100000}
        })
        assert r.status_code == 200
        d = r.json()
        assert "approved" in d or "valid" in d or "confidence" in d

    def test_hallucination_check(self, client):
        r = client.post("/api/v1/nova/hallucination-check", json={
            "claim": "test claim", "evidence": "test evidence"
        })
        assert r.status_code == 200
        d = r.json()
        assert "is_hallucination" in d

    def test_status(self, client):
        r = client.get("/api/v1/nova/status")
        assert r.status_code == 200
        d = r.json()
        assert "enabled" in d or "mode" in d

    def test_hash(self, client):
        r = client.get("/api/v1/nova/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 9 — Market Hours
# ═══════════════════════════════════════════════════════════════════
class TestMarketHours:
    def test_status(self, client):
        r = client.get("/api/v1/market-hours/status")
        assert r.status_code == 200
        d = r.json()
        assert "market" in d or "session" in d
        assert "status" in d or "timezone" in d

    def test_holidays(self, client):
        r = client.get("/api/v1/market-hours/holidays")
        assert r.status_code == 200
        assert len(r.json()["holidays"]) >= 1

    def test_next_holiday(self, client):
        r = client.get("/api/v1/market-hours/holidays/next")
        assert r.status_code == 200
        assert "name" in r.json()

    def test_can_trade(self, client):
        r = client.get("/api/v1/market-hours/can-trade")
        assert r.status_code == 200
        assert "can_trade" in r.json()

    def test_hash(self, client):
        r = client.get("/api/v1/market-hours/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 9 — Kill Switch Recovery
# ═══════════════════════════════════════════════════════════════════
class TestKillSwitchRecovery:
    def test_status(self, client):
        r = client.get("/api/v1/kill-switch-recovery/status")
        assert r.status_code == 200
        d = r.json()
        assert "kill_switch_active" in d or "active" in d
        assert "auto_recover_enabled" in d or "auto_recovery_enabled" in d

    def test_config(self, client):
        r = client.get("/api/v1/kill-switch-recovery/config")
        assert r.status_code == 200
        assert "cooldown_minutes" in r.json()

    def test_events(self, client):
        r = client.get("/api/v1/kill-switch-recovery/events")
        assert r.status_code == 200
        assert "events" in r.json()

    def test_manual_override(self, client):
        r = client.post("/api/v1/kill-switch-recovery/manual-override")
        assert r.status_code == 200
        assert "status" in r.json()

    def test_hash(self, client):
        r = client.get("/api/v1/kill-switch-recovery/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 9 — System Health
# ═══════════════════════════════════════════════════════════════════
class TestSystemHealth:
    def test_full_report(self, client):
        r = client.get("/api/v1/system-health")
        assert r.status_code == 200
        d = r.json()
        assert "overall" in d or "overall_status" in d
        assert "components" in d
        assert len(d["components"]) >= 1

    def test_components_list(self, client):
        r = client.get("/api/v1/system-health/components")
        assert r.status_code == 200
        assert len(r.json()["components"]) >= 1

    def test_single_component(self, client):
        r = client.get("/api/v1/system-health/components/database")
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "database"
        assert "status" in d

    def test_hash(self, client):
        r = client.get("/api/v1/system-health/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 10 — Observability
# ═══════════════════════════════════════════════════════════════════
class TestObservability:
    def test_metrics(self, client):
        r = client.get("/api/v1/observability/metrics")
        assert r.status_code == 200
        assert len(r.json()["metrics"]) >= 1

    def test_prometheus(self, client):
        r = client.get("/api/v1/observability/metrics/prometheus")
        assert r.status_code == 200
        assert "# HELP" in r.text or "api_requests_total" in r.text

    def test_performance(self, client):
        r = client.get("/api/v1/observability/performance")
        assert r.status_code == 200
        d = r.json()
        assert "api_latency_p50_ms" in d or "p50_ms" in d
        assert "requests_total" in d or "requests_per_second" in d

    def test_diagnostics(self, client):
        r = client.get("/api/v1/observability/diagnostics")
        assert r.status_code == 200

    def test_hash(self, client):
        r = client.get("/api/v1/observability/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 10 — Compliance
# ═══════════════════════════════════════════════════════════════════
class TestCompliance:
    def test_report(self, client):
        r = client.get("/api/v1/compliance/report")
        assert r.status_code == 200
        d = r.json()
        assert "overall_status" in d or "overall_compliant" in d
        assert "checks" in d

    def test_checks_list(self, client):
        r = client.get("/api/v1/compliance/checks")
        assert r.status_code == 200
        assert len(r.json()["checks"]) >= 1

    def test_single_check(self, client):
        # first fetch the list to get a real check_id
        checks = client.get("/api/v1/compliance/checks").json()["checks"]
        cid = checks[0]["check_id"]
        r = client.get(f"/api/v1/compliance/checks/{cid}")
        assert r.status_code == 200
        assert r.json()["check_id"] == cid

    def test_categories(self, client):
        r = client.get("/api/v1/compliance/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert len(cats) >= 1

    def test_hash(self, client):
        r = client.get("/api/v1/compliance/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Wave 10 — Performance Analytics
# ═══════════════════════════════════════════════════════════════════
class TestPerformanceAnalytics:
    def test_dashboard(self, client):
        r = client.get("/api/v1/performance")
        assert r.status_code == 200
        d = r.json()
        assert "total_pnl" in d
        assert "periods" in d
        assert "strategies" in d

    def test_periods(self, client):
        r = client.get("/api/v1/performance/periods")
        assert r.status_code == 200
        assert len(r.json()["periods"]) >= 1

    def test_single_period(self, client):
        r = client.get("/api/v1/performance/periods/1D")
        assert r.status_code == 200
        assert r.json()["period"] == "1D"

    def test_strategies(self, client):
        r = client.get("/api/v1/performance/strategies")
        assert r.status_code == 200
        assert len(r.json()["strategies"]) >= 1

    def test_single_strategy(self, client):
        strats = client.get("/api/v1/performance/strategies").json()["strategies"]
        sid = strats[0]["strategy_id"]
        r = client.get(f"/api/v1/performance/strategies/{sid}")
        assert r.status_code == 200
        assert r.json()["strategy_id"] == sid

    def test_hash(self, client):
        r = client.get("/api/v1/performance/hash")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Cross-Wave — Determinism Verification
# ═══════════════════════════════════════════════════════════════════
class TestDeterminismAllWaves:
    """Ensure every wave endpoint has a stable /hash."""
    HASH_ENDPOINTS = [
        "/api/v1/monte-carlo/hash",
        "/api/v1/walk-forward/hash",
        "/api/v1/scoring/hash",
        "/api/v1/sentiment/hash",
        "/api/v1/regime/hash",
        "/api/v1/elasticsearch/hash",
        "/api/v1/nova/hash",
        "/api/v1/market-hours/hash",
        "/api/v1/kill-switch-recovery/hash",
        "/api/v1/system-health/hash",
        "/api/v1/observability/hash",
        "/api/v1/compliance/hash",
        "/api/v1/performance/hash",
    ]

    @pytest.mark.parametrize("endpoint", HASH_ENDPOINTS)
    def test_hash_stable(self, client, endpoint):
        r1 = client.get(endpoint)
        assert r1.status_code == 200
        h1 = r1.json()["hash"]
        r2 = client.get(endpoint)
        assert r2.json()["hash"] == h1, f"Non-deterministic hash at {endpoint}"
