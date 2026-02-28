"""
W92 — Bulk ingest + DLQ + lag metrics.
Tests: ingest→DLQ on failure, drain, lag drops, API contracts.
"""
import pytest
import httpx

BASE = "http://localhost:8090"
LAG_URL = f"{BASE}/api/v3/ops/ingest/lag"
DLQ_URL = f"{BASE}/api/v3/ops/ingest/dlq"
DRAIN_URL = f"{BASE}/api/v3/ops/ingest/dlq/drain"
DRAIN_ENTITY_URL = f"{BASE}/api/v3/ops/ingest/dlq/drain/events"
TEST_URL = f"{BASE}/api/v3/ops/ingest/test"

ENTITY_TYPES = ["events", "strategies", "backtests", "workflows", "jobs", "tickets", "edges"]


@pytest.fixture(scope="module", autouse=True)
def ensure_clean_dlq():
    """Drain any leftover DLQ items before tests start."""
    r = httpx.post(DRAIN_URL, timeout=30)
    assert r.status_code == 200


class TestLagEndpoint:
    def test_lag_returns_200(self):
        """GET /api/v3/ops/ingest/lag returns 200."""
        r = httpx.get(LAG_URL, timeout=30)
        assert r.status_code == 200

    def test_lag_has_metrics_array(self):
        """Response includes 'metrics' list."""
        data = httpx.get(LAG_URL, timeout=30).json()
        assert "metrics" in data
        assert isinstance(data["metrics"], list)

    def test_lag_metrics_has_7_entities(self):
        """Lag metrics has an entry for each of the 7 entity types."""
        data = httpx.get(LAG_URL, timeout=30).json()
        entities = {m["entity"] for m in data["metrics"]}
        assert entities == set(ENTITY_TYPES)

    def test_lag_metric_schema(self):
        """Each lag metric has required fields."""
        data = httpx.get(LAG_URL, timeout=30).json()
        for m in data["metrics"]:
            assert "entity" in m
            assert "dlq_pending" in m
            assert "es_count" in m
            assert "lag" in m

    def test_lag_starts_at_zero(self):
        """After drain, all lag values should be 0."""
        data = httpx.get(LAG_URL, timeout=30).json()
        for m in data["metrics"]:
            assert m["lag"] == 0, f"Entity {m['entity']} has non-zero lag: {m['lag']}"

    def test_lag_has_timestamp(self):
        """Response includes timestamp."""
        data = httpx.get(LAG_URL, timeout=30).json()
        assert "timestamp" in data


class TestDlqEndpoint:
    def test_dlq_returns_200(self):
        """GET /api/v3/ops/ingest/dlq returns 200."""
        r = httpx.get(DLQ_URL, timeout=30)
        assert r.status_code == 200

    def test_dlq_has_stats_array(self):
        """Response includes 'stats' list."""
        data = httpx.get(DLQ_URL, timeout=30).json()
        assert "stats" in data
        assert isinstance(data["stats"], list)

    def test_dlq_has_total_pending(self):
        """Response includes 'total_pending' integer."""
        data = httpx.get(DLQ_URL, timeout=30).json()
        assert "total_pending" in data
        assert isinstance(data["total_pending"], int)

    def test_dlq_starts_clean(self):
        """After drain fixture, total_pending = 0."""
        data = httpx.get(DLQ_URL, timeout=30).json()
        assert data["total_pending"] == 0

    def test_dlq_stat_schema(self):
        """Each DLQ stat has entity, pending, drained, total."""
        data = httpx.get(DLQ_URL, timeout=30).json()
        for s in data["stats"]:
            assert "entity" in s
            assert "pending" in s
            assert "drained" in s
            assert "total" in s


class TestIngestFailureToDlq:
    def test_forced_failure_increases_dlq(self):
        """POST /ingest/test?fail=true increases DLQ pending count."""
        before = httpx.get(DLQ_URL, timeout=30).json()["total_pending"]
        r = httpx.post(f"{TEST_URL}?entity=events&count=1&fail=true", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["dlq_added"] >= 1
        after = httpx.get(DLQ_URL, timeout=30).json()["total_pending"]
        assert after > before

    def test_lag_grows_after_failure(self):
        """Lag for events grows after a failed ingest."""
        # Force another DLQ item
        httpx.post(f"{TEST_URL}?entity=events&count=1&fail=true", timeout=30)
        data = httpx.get(LAG_URL, timeout=30).json()
        events_lag = next(m["lag"] for m in data["metrics"] if m["entity"] == "events")
        assert events_lag > 0

    def test_failed_ingest_returns_ok_false(self):
        """A forced-fail ingest returns ok=false."""
        r = httpx.post(f"{TEST_URL}?entity=events&count=1&fail=true", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is False

    def test_failed_ingest_has_error(self):
        """A forced-fail ingest response includes 'error' field."""
        r = httpx.post(f"{TEST_URL}?entity=events&count=1&fail=true", timeout=30)
        data = r.json()
        assert data.get("error") is not None


class TestDrainDlq:
    def test_drain_all_returns_200(self):
        """POST /api/v3/ops/ingest/dlq/drain returns 200."""
        # Add some DLQ items
        httpx.post(f"{TEST_URL}?entity=events&count=2&fail=true", timeout=30)
        r = httpx.post(DRAIN_URL, timeout=60)
        assert r.status_code == 200

    def test_drain_reports_drained_count(self):
        """Drain response has 'drained' field >= 0."""
        r = httpx.post(DRAIN_URL, timeout=60)
        data = r.json()
        assert "drained" in data
        assert isinstance(data["drained"], int)
        assert data["drained"] >= 0

    def test_drain_reduces_dlq_to_zero(self):
        """After drain, total_pending = 0."""
        # Ensure there are items to drain
        httpx.post(f"{TEST_URL}?entity=events&count=1&fail=true", timeout=30)
        # Drain
        httpx.post(DRAIN_URL, timeout=60)
        data = httpx.get(DLQ_URL, timeout=30).json()
        assert data["total_pending"] == 0

    def test_drain_reduces_lag_to_zero(self):
        """After drain, lag for events = 0."""
        httpx.post(DRAIN_URL, timeout=60)
        data = httpx.get(LAG_URL, timeout=30).json()
        events_lag = next(m["lag"] for m in data["metrics"] if m["entity"] == "events")
        assert events_lag == 0

    def test_drain_entity_endpoint_works(self):
        """POST /dlq/drain/events returns 200 with entity=events."""
        r = httpx.post(DRAIN_ENTITY_URL, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data.get("entity") == "events"

    def test_drain_idempotent_when_empty(self):
        """Draining an empty DLQ returns ok=true and drained=0."""
        # First ensure empty
        httpx.post(DRAIN_URL, timeout=60)
        # Drain again
        r = httpx.post(DRAIN_URL, timeout=60)
        data = r.json()
        assert data["drained"] == 0

    def test_drain_unknown_entity_returns_error(self):
        """POST /dlq/drain/unknown_entity returns error."""
        r = httpx.post(f"{BASE}/api/v3/ops/ingest/dlq/drain/unknown_entity", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "error" in data


class TestIngestTestEndpoint:
    def test_successful_ingest_ok_true(self):
        """POST /ingest/test without fail=true returns ok=true."""
        r = httpx.post(f"{TEST_URL}?entity=events&count=1", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["dlq_added"] == 0

    def test_ingest_records_attempted(self):
        """Ingest test returns records_attempted=count."""
        count = 3
        r = httpx.post(f"{TEST_URL}?entity=events&count={count}", timeout=30)
        data = r.json()
        assert data["records_attempted"] == count
