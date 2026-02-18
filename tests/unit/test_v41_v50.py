"""
Tests for v1.41–v1.50: Watchlist, Correlation, Journal, Notifications,
Audit Log, Attribution, Risk Scenarios, Data Quality, Strategy Compare,
Platform Health.
All deterministic, demo-mode, no external dependencies.
"""
import hashlib
import json
import pytest
import httpx

BASE = "http://127.0.0.1:8000"


# ──── v1.41 Watchlist Manager ────

class TestWatchlist:
    """v1.41: Watchlist Manager deterministic output."""

    def test_watchlists_list(self):
        r = httpx.get(f"{BASE}/api/v1/watchlists", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 3
        names = [w["name"] for w in data]
        assert "Mega-Cap Tech" in names

    def test_watchlists_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/watchlists/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_watchlist_by_id(self):
        r = httpx.get(f"{BASE}/api/v1/watchlists/wl-001", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Mega-Cap Tech"

    def test_watchlist_symbols(self):
        r = httpx.get(f"{BASE}/api/v1/watchlists/wl-001/symbols", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4
        assert "AAPL" in data

    def test_watchlist_fields(self):
        r = httpx.get(f"{BASE}/api/v1/watchlists", timeout=10)
        w = r.json()[0]
        for field in ["id", "name", "items"]:
            assert field in w


# ──── v1.42 Correlation Matrix ────

class TestCorrelation:
    """v1.42: Correlation Matrix deterministic output."""

    def test_correlation_matrix(self):
        r = httpx.get(f"{BASE}/api/v1/correlation/matrix", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "symbols" in data
        assert "data" in data
        assert len(data["symbols"]) == 6
        assert len(data["data"]) == 6

    def test_correlation_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/correlation/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_correlation_pair(self):
        r = httpx.get(f"{BASE}/api/v1/correlation/pair/SPY/QQQ", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "correlation" in data
        assert -1.0 <= data["correlation"] <= 1.0

    def test_correlation_diagonal_is_one(self):
        r = httpx.get(f"{BASE}/api/v1/correlation/matrix", timeout=10)
        matrix = r.json()["data"]
        for i in range(len(matrix)):
            assert matrix[i][i] == 1.0

    def test_correlation_fields(self):
        r = httpx.get(f"{BASE}/api/v1/correlation/matrix", timeout=10)
        data = r.json()
        for field in ["symbols", "data", "period", "computed_at"]:
            assert field in data


# ──── v1.43 Trade Journal ────

class TestJournal:
    """v1.43: Trade Journal deterministic output."""

    def test_journal_list(self):
        r = httpx.get(f"{BASE}/api/v1/journal", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4

    def test_journal_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/journal/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_journal_stats(self):
        r = httpx.get(f"{BASE}/api/v1/journal/stats", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "total_entries" in data
        assert data["total_entries"] == 4

    def test_journal_tags(self):
        r = httpx.get(f"{BASE}/api/v1/journal/tags", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert "earnings" in data

    def test_journal_fields(self):
        r = httpx.get(f"{BASE}/api/v1/journal", timeout=10)
        e = r.json()[0]
        for field in ["id", "created_at", "symbol", "pnl", "tags", "emotion"]:
            assert field in e


# ──── v1.44 Notifications Center ────

class TestNotifications:
    """v1.44: Notifications Center deterministic output."""

    def test_notifications_list(self):
        r = httpx.get(f"{BASE}/api/v1/notifications", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5

    def test_notifications_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/notifications/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_notifications_unread(self):
        r = httpx.get(f"{BASE}/api/v1/notifications/unread", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "unread" in data
        assert data["unread"] == 3

    def test_notifications_by_type(self):
        r = httpx.get(f"{BASE}/api/v1/notifications/by-type/trade", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(n["type"] == "trade" for n in data)

    def test_notifications_fields(self):
        r = httpx.get(f"{BASE}/api/v1/notifications", timeout=10)
        n = r.json()[0]
        for field in ["id", "type", "severity", "title", "message", "read"]:
            assert field in n


# ──── v1.45 System Audit Log ────

class TestAuditLog:
    """v1.45: System Audit Log deterministic output."""

    def test_audit_list(self):
        r = httpx.get(f"{BASE}/api/v1/audit", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6

    def test_audit_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/audit/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_audit_by_action(self):
        r = httpx.get(f"{BASE}/api/v1/audit/by-action/trade.execute", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_audit_count(self):
        r = httpx.get(f"{BASE}/api/v1/audit/count", timeout=10)
        assert r.status_code == 200
        assert r.json()["count"] == 6

    def test_audit_fields(self):
        r = httpx.get(f"{BASE}/api/v1/audit", timeout=10)
        e = r.json()[0]
        for field in ["id", "action", "actor", "target", "detail", "timestamp"]:
            assert field in e


# ──── v1.46 Performance Attribution ────

class TestAttribution:
    """v1.46: Performance Attribution deterministic output."""

    def test_attribution_full(self):
        r = httpx.get(f"{BASE}/api/v1/attribution", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "total_pnl" in data
        assert data["total_pnl"] == 12450.75

    def test_attribution_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/attribution/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_attribution_by_strategy(self):
        r = httpx.get(f"{BASE}/api/v1/attribution/by-strategy", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4
        names = [s["strategy"] for s in data]
        assert "Iron Condor" in names

    def test_attribution_by_sector(self):
        r = httpx.get(f"{BASE}/api/v1/attribution/by-sector", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4

    def test_attribution_fields(self):
        r = httpx.get(f"{BASE}/api/v1/attribution", timeout=10)
        data = r.json()
        for field in ["total_pnl", "period", "by_strategy", "by_sector", "by_bucket"]:
            assert field in data


# ──── v1.47 Risk Scenarios ────

class TestRiskScenarios:
    """v1.47: Risk Scenarios deterministic output."""

    def test_scenarios_list(self):
        r = httpx.get(f"{BASE}/api/v1/risk-scenarios", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4

    def test_scenarios_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/risk-scenarios/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_scenario_by_id(self):
        r = httpx.get(f"{BASE}/api/v1/risk-scenarios/scen-001", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Black Monday Replay"

    def test_scenario_worst_case(self):
        r = httpx.get(f"{BASE}/api/v1/risk-scenarios/worst-case/summary", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "impact" in data
        assert data["impact"] < 0

    def test_scenario_fields(self):
        r = httpx.get(f"{BASE}/api/v1/risk-scenarios", timeout=10)
        s = r.json()[0]
        for field in ["id", "name", "shock", "portfolio_impact", "max_drawdown", "recovery_days"]:
            assert field in s


# ──── v1.48 Data Quality Monitor ────

class TestDataQuality:
    """v1.48: Data Quality Monitor deterministic output."""

    def test_feeds_list(self):
        r = httpx.get(f"{BASE}/api/v1/data-quality", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5

    def test_data_quality_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/data-quality/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_data_quality_summary(self):
        r = httpx.get(f"{BASE}/api/v1/data-quality/summary", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["total_feeds"] == 5
        assert data["healthy"] == 3

    def test_feed_by_id(self):
        r = httpx.get(f"{BASE}/api/v1/data-quality/feed-001", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Alpaca Market Data"

    def test_feed_fields(self):
        r = httpx.get(f"{BASE}/api/v1/data-quality", timeout=10)
        f = r.json()[0]
        for field in ["id", "name", "status", "latency_ms", "integrity_score"]:
            assert field in f


# ──── v1.49 Strategy Comparison Matrix ────

class TestStrategyCompare:
    """v1.49: Strategy Comparison Matrix deterministic output."""

    def test_strategies_list(self):
        r = httpx.get(f"{BASE}/api/v1/strategy-compare", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5

    def test_strategy_compare_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/strategy-compare/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_strategy_rank(self):
        r = httpx.get(f"{BASE}/api/v1/strategy-compare/rank/sharpe", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5
        assert data[0]["rank"] == 1
        # Momentum Scanner has highest sharpe (1.68)
        assert data[0]["name"] == "Momentum Scanner"

    def test_strategy_by_id(self):
        r = httpx.get(f"{BASE}/api/v1/strategy-compare/strat-001", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Iron Condor"

    def test_strategy_fields(self):
        r = httpx.get(f"{BASE}/api/v1/strategy-compare", timeout=10)
        s = r.json()[0]
        for field in ["id", "name", "sharpe", "sortino", "win_rate", "profit_factor"]:
            assert field in s


# ──── v1.50 Platform Health Dashboard ────

class TestPlatformHealth:
    """v1.50: Platform Health Dashboard deterministic output."""

    def test_components_list(self):
        r = httpx.get(f"{BASE}/api/v1/platform-health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6

    def test_platform_health_hash_deterministic(self):
        hashes = []
        for _ in range(3):
            r = httpx.get(f"{BASE}/api/v1/platform-health/hash", timeout=10)
            assert r.status_code == 200
            hashes.append(r.json()["hash"])
        assert hashes[0] == hashes[1] == hashes[2]

    def test_platform_summary(self):
        r = httpx.get(f"{BASE}/api/v1/platform-health/summary", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "1.50.0"
        assert data["total_components"] == 6
        assert data["operational"] == 5

    def test_component_by_id(self):
        r = httpx.get(f"{BASE}/api/v1/platform-health/comp-001", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "FastAPI Backend"

    def test_component_fields(self):
        r = httpx.get(f"{BASE}/api/v1/platform-health", timeout=10)
        c = r.json()[0]
        for field in ["id", "name", "status", "uptime_pct", "latency_p50_ms", "latency_p99_ms"]:
            assert field in c
