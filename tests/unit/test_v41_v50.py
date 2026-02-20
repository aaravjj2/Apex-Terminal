"""
Tests for v1.41–v1.50: Watchlist, Correlation, Journal, Notifications,
Audit Log, Attribution, Risk Scenarios, Data Quality, Strategy Compare,
Platform Health.
All deterministic, demo-mode, no external dependencies.
Uses FastAPI TestClient.
"""
import hashlib
import json
import pytest


@pytest.fixture(scope="module")
def client():
    """Create TestClient for these tests."""
    from fastapi.testclient import TestClient
    import os
    os.environ.setdefault("E2E_MODE", "1")
    from services.api.main import app
    with TestClient(app) as c:
        yield c


# ──── v1.41 Watchlist Manager ────

class TestWatchlist:
    """v1.41: Watchlist Manager deterministic output."""

    def test_watchlists_list(self, client):
        r = client.get("/api/v1/watchlists")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 3
        names = [w["name"] for w in data]
        assert "Mega-Cap Tech" in names

    def test_watchlists_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/watchlists/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_watchlist_by_id(self, client):
        r = client.get("/api/v1/watchlists/wl-001")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Mega-Cap Tech"

    def test_watchlist_symbols(self, client):
        r = client.get("/api/v1/watchlists/wl-001/symbols")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4
        assert "AAPL" in data

    def test_watchlist_fields(self, client):
        r = client.get("/api/v1/watchlists")
        w = r.json()[0]
        for field in ["id", "name", "items"]:
            assert field in w


# ──── v1.42 Correlation Matrix ────

class TestCorrelation:
    """v1.42: Correlation Matrix deterministic output."""

    def test_correlation_matrix(self, client):
        r = client.get("/api/v1/correlation/matrix")
        assert r.status_code == 200
        data = r.json()
        assert "symbols" in data
        assert "data" in data
        assert len(data["symbols"]) == 6
        assert len(data["data"]) == 6

    def test_correlation_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/correlation/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_correlation_pair(self, client):
        r = client.get("/api/v1/correlation/pair/SPY/QQQ")
        assert r.status_code == 200
        data = r.json()
        assert "correlation" in data
        assert -1.0 <= data["correlation"] <= 1.0

    def test_correlation_diagonal_is_one(self, client):
        r = client.get("/api/v1/correlation/matrix")
        matrix = r.json()["data"]
        for i in range(len(matrix)):
            assert matrix[i][i] == 1.0

    def test_correlation_fields(self, client):
        r = client.get("/api/v1/correlation/matrix")
        data = r.json()
        for field in ["symbols", "data", "period", "computed_at"]:
            assert field in data


# ──── v1.43 Trade Journal ────

class TestJournal:
    """v1.43: Trade Journal deterministic output."""

    def test_journal_list(self, client):
        r = client.get("/api/v1/journal")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4

    def test_journal_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/journal/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_journal_stats(self, client):
        r = client.get("/api/v1/journal/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total_entries" in data
        assert data["total_entries"] == 4

    def test_journal_tags(self, client):
        r = client.get("/api/v1/journal/tags")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert "earnings" in data

    def test_journal_fields(self, client):
        r = client.get("/api/v1/journal")
        e = r.json()[0]
        for field in ["id", "created_at", "symbol", "pnl", "tags", "emotion"]:
            assert field in e


# ──── v1.44 Notifications Center ────

class TestNotifications:
    """v1.44: Notifications Center deterministic output."""

    def test_notifications_list(self, client):
        r = client.get("/api/v1/notifications")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5

    def test_notifications_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/notifications/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_notifications_unread(self, client):
        r = client.get("/api/v1/notifications/unread")
        assert r.status_code == 200
        data = r.json()
        assert "unread" in data
        assert data["unread"] == 3

    def test_notifications_by_type(self, client):
        r = client.get("/api/v1/notifications/by-type/trade")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(n["type"] == "trade" for n in data)

    def test_notifications_fields(self, client):
        r = client.get("/api/v1/notifications")
        n = r.json()[0]
        for field in ["id", "type", "severity", "title", "message", "read"]:
            assert field in n


# ──── v1.45 System Audit Log ────

class TestAuditLog:
    """v1.45: System Audit Log deterministic output."""

    def test_audit_list(self, client):
        r = client.get("/api/v1/audit")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6

    def test_audit_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/audit/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_audit_by_action(self, client):
        r = client.get("/api/v1/audit/by-action/trade.execute")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_audit_count(self, client):
        r = client.get("/api/v1/audit/count")
        assert r.status_code == 200
        assert r.json()["count"] == 6

    def test_audit_fields(self, client):
        r = client.get("/api/v1/audit")
        e = r.json()[0]
        for field in ["id", "action", "actor", "target", "detail", "timestamp"]:
            assert field in e


# ──── v1.46 Performance Attribution ────

class TestAttribution:
    """v1.46: Performance Attribution deterministic output."""

    def test_attribution_full(self, client):
        r = client.get("/api/v1/attribution")
        assert r.status_code == 200
        data = r.json()
        assert "total_pnl" in data
        assert data["total_pnl"] == 12450.75

    def test_attribution_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/attribution/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_attribution_by_strategy(self, client):
        r = client.get("/api/v1/attribution/by-strategy")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4
        names = [s["strategy"] for s in data]
        assert "Iron Condor" in names

    def test_attribution_by_sector(self, client):
        r = client.get("/api/v1/attribution/by-sector")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4

    def test_attribution_fields(self, client):
        r = client.get("/api/v1/attribution")
        data = r.json()
        for field in ["total_pnl", "period", "by_strategy", "by_sector", "by_bucket"]:
            assert field in data


# ──── v1.47 Risk Scenarios ────

class TestRiskScenarios:
    """v1.47: Risk Scenarios deterministic output."""

    def test_scenarios_list(self, client):
        r = client.get("/api/v1/risk-scenarios")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4

    def test_scenarios_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/risk-scenarios/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_scenario_by_id(self, client):
        r = client.get("/api/v1/risk-scenarios/scen-001")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Black Monday Replay"

    def test_scenario_worst_case(self, client):
        r = client.get("/api/v1/risk-scenarios/worst-case/summary")
        assert r.status_code == 200
        data = r.json()
        assert "impact" in data
        assert data["impact"] < 0

    def test_scenario_fields(self, client):
        r = client.get("/api/v1/risk-scenarios")
        s = r.json()[0]
        for field in ["id", "name", "shock", "portfolio_impact", "max_drawdown", "recovery_days"]:
            assert field in s


# ──── v1.48 Data Quality Monitor ────

class TestDataQuality:
    """v1.48: Data Quality Monitor deterministic output."""

    def test_feeds_list(self, client):
        r = client.get("/api/v1/data-quality")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5

    def test_data_quality_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/data-quality/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_data_quality_summary(self, client):
        r = client.get("/api/v1/data-quality/summary")
        assert r.status_code == 200
        data = r.json()
        assert data["total_feeds"] == 5
        assert data["healthy"] == 3

    def test_feed_by_id(self, client):
        r = client.get("/api/v1/data-quality/feed-001")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Alpaca Market Data"

    def test_feed_fields(self, client):
        r = client.get("/api/v1/data-quality")
        f = r.json()[0]
        for field in ["id", "name", "status", "latency_ms", "integrity_score"]:
            assert field in f


# ──── v1.49 Strategy Comparison Matrix ────

class TestStrategyCompare:
    """v1.49: Strategy Comparison Matrix deterministic output."""

    def test_strategies_list(self, client):
        r = client.get("/api/v1/strategy-compare")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5

    def test_strategy_compare_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/strategy-compare/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_strategy_rank(self, client):
        r = client.get("/api/v1/strategy-compare/rank/sharpe")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5
        assert data[0]["rank"] == 1
        # Momentum Scanner has highest sharpe (1.68)
        assert data[0]["name"] == "Momentum Scanner"

    def test_strategy_by_id(self, client):
        r = client.get("/api/v1/strategy-compare/strat-001")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Iron Condor"

    def test_strategy_fields(self, client):
        r = client.get("/api/v1/strategy-compare")
        s = r.json()[0]
        for field in ["id", "name", "sharpe", "sortino", "win_rate", "profit_factor"]:
            assert field in s


# ──── v1.50 Platform Health Dashboard ────

class TestPlatformHealth:
    """v1.50: Platform Health Dashboard deterministic output."""

    def test_components_list(self, client):
        r = client.get("/api/v1/platform-health")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6

    def test_platform_health_hash_deterministic(self, client):
        hashes = []
        for _ in range(3):
            r = client.get("/api/v1/platform-health/hash")
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_platform_summary(self, client):
        r = client.get("/api/v1/platform-health/summary")
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "1.50.0"
        assert data["total_components"] == 6
        assert data["operational"] == 5

    def test_component_by_id(self, client):
        r = client.get("/api/v1/platform-health/comp-001")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "FastAPI Backend"

    def test_component_fields(self, client):
        r = client.get("/api/v1/platform-health")
        c = r.json()[0]
        for field in ["id", "name", "status", "uptime_pct", "latency_p50_ms", "latency_p99_ms"]:
            assert field in c
