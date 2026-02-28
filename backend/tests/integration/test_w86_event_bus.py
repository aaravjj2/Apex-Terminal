"""
Wave 86 – Event Bus + Audit Events indexed in ES
--------------------------------------------------
Gates:
  • event_bus.publish() stores events in memory
  • correlation_id propagates correctly
  • /api/v3/events/emit creates and stores an event
  • /api/v3/events lists events
  • /api/v3/events/search filters by correlation_id, category, entity_type
  • Events are indexed in ES apex-events-* (monthly rollover)
  • make_event() factory populates fields from context
Hard constraints: real server :8090, real ES :9200, no mocks
"""
from __future__ import annotations

import time
import uuid
import sys
from pathlib import Path

import httpx
import pytest

# Ensure backend is importable
REPO_ROOT = Path(__file__).parent.parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

BASE_URL = "http://127.0.0.1:8090"
ES_URL   = "http://localhost:9200"
TIMEOUT  = 15.0


def post(path: str, body: dict) -> httpx.Response:
    return httpx.post(f"{BASE_URL}{path}", json=body, timeout=TIMEOUT)


def get(path: str) -> httpx.Response:
    return httpx.get(f"{BASE_URL}{path}", timeout=TIMEOUT)


# ---------------------------------------------------------------------------
# Unit tests — event_bus module (no server needed)
# ---------------------------------------------------------------------------


class TestEventBusModule:
    def test_event_bus_importable(self):
        from backend.core.event_bus import publish, get_memory_events, make_event  # noqa: F401
        assert publish is not None

    def test_correlation_id_context(self):
        from backend.core.event_bus import set_correlation_id, get_correlation_id
        token = set_correlation_id("test-cid-12345")
        assert get_correlation_id() == "test-cid-12345"

    def test_make_event_factory(self):
        from backend.core.event_bus import make_event, set_correlation_id
        from backend.core.contracts.events import EventCategory
        set_correlation_id("factory-cid")
        event = make_event(
            category=EventCategory.BACKTEST,
            action="test_run",
            entity_type="backtest",
            entity_id="bt-001",
        )
        assert event.category == EventCategory.BACKTEST
        assert event.action == "test_run"
        assert event.entity_id == "bt-001"
        assert event.correlation_id == "factory-cid"

    def test_publish_adds_to_memory_store(self):
        import asyncio
        from backend.core.event_bus import publish, get_memory_events, make_event
        from backend.core.contracts.events import EventCategory

        initial_count = len(get_memory_events())
        event = make_event(
            category=EventCategory.SYSTEM,
            action="unit_test_event",
            entity_id="test-unit",
        )
        asyncio.run(publish(event))
        assert len(get_memory_events()) == initial_count + 1

    def test_get_memory_events_returns_newest_first(self):
        import asyncio
        from backend.core.event_bus import publish, get_memory_events, make_event
        from backend.core.contracts.events import EventCategory

        e1 = make_event(category=EventCategory.SYSTEM, action="event_first", entity_id="order-1")
        e2 = make_event(category=EventCategory.SYSTEM, action="event_second", entity_id="order-2")
        asyncio.run(publish(e1))
        asyncio.run(publish(e2))

        events = get_memory_events()
        # Newest first - e2 should come before e1
        ids = [e.event_id for e in events]
        assert ids.index(e2.event_id) < ids.index(e1.event_id)


# ---------------------------------------------------------------------------
# Live server tests
# ---------------------------------------------------------------------------


class TestEventBusLive:
    def test_emit_endpoint_returns_201(self):
        r = post("/api/v3/events/emit", {
            "category": "system",
            "action": "test_emit",
            "entity_type": "test",
            "entity_id": "live-test-001",
        })
        assert r.status_code == 201

    def test_emit_returns_event_id_and_correlation_id(self):
        r = post("/api/v3/events/emit", {
            "category": "system",
            "action": "test_emit_schema",
        })
        body = r.json()
        assert "event_id" in body
        assert "correlation_id" in body
        uuid.UUID(body["event_id"])
        uuid.UUID(body["correlation_id"])

    def test_emit_custom_correlation_id(self):
        custom_cid = str(uuid.uuid4())
        r = post("/api/v3/events/emit", {
            "category": "backtest",
            "action": "run_completed",
            "correlation_id": custom_cid,
            "entity_type": "backtest",
            "entity_id": "bt-w86-test",
        })
        assert r.status_code == 201
        body = r.json()
        assert body["correlation_id"] == custom_cid

    def test_list_events_returns_emitted_event(self):
        # Emit a fresh event with unique entity_id
        unique_id = f"w86-list-{uuid.uuid4().hex[:8]}"
        post("/api/v3/events/emit", {
            "category": "strategy",
            "action": "created",
            "entity_type": "strategy",
            "entity_id": unique_id,
        })
        # Retrieve and find it
        r = get("/api/v3/events")
        body = r.json()
        entity_ids = [item["entity_id"] for item in body["items"]]
        assert unique_id in entity_ids

    def test_events_list_is_newest_first(self):
        # Emit two events in order
        cid = str(uuid.uuid4())
        post("/api/v3/events/emit", {"category": "system", "action": "first",  "correlation_id": cid, "entity_id": "order-a"})
        post("/api/v3/events/emit", {"category": "system", "action": "second", "correlation_id": cid, "entity_id": "order-b"})

        r = post("/api/v3/events/search", {"correlation_id": cid})
        items = r.json()["events"]
        actions = [e["action"] for e in items]
        # second should come before first (newest first)
        assert actions.index("second") < actions.index("first")

    def test_search_by_correlation_id(self):
        cid = str(uuid.uuid4())
        post("/api/v3/events/emit", {
            "category": "workflow",
            "action": "run_started",
            "correlation_id": cid,
            "entity_type": "workflow",
            "entity_id": "wf-001",
        })
        r = post("/api/v3/events/search", {"correlation_id": cid})
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        for event in body["events"]:
            assert event["correlation_id"] == cid

    def test_search_by_category(self):
        post("/api/v3/events/emit", {
            "category": "agent",
            "action": "run_started",
            "entity_id": "agent-search-test",
        })
        r = post("/api/v3/events/search", {"category": "agent"})
        assert r.status_code == 200
        body = r.json()
        for event in body["events"]:
            assert event["category"] == "agent"

    def test_search_by_entity_type(self):
        post("/api/v3/events/emit", {
            "category": "backtest",
            "action": "run_end",
            "entity_type": "backtest_run",
            "entity_id": "bt-entity-test",
        })
        r = post("/api/v3/events/search", {"entity_type": "backtest_run"})
        assert r.status_code == 200
        body = r.json()
        for event in body["events"]:
            assert event["entity_type"] == "backtest_run"

    def test_get_single_event_by_id(self):
        r = post("/api/v3/events/emit", {
            "category": "audit",
            "action": "access_log",
        })
        event_id = r.json()["event_id"]

        r2 = get(f"/api/v3/events/{event_id}")
        assert r2.status_code == 200
        assert r2.json()["event_id"] == event_id

    def test_get_nonexistent_event_returns_404(self):
        r = get("/api/v3/events/nonexistent-event-id-xyz")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# ES indexing tests (real ES)
# ---------------------------------------------------------------------------


class TestEventESIndexing:
    def test_emitted_event_indexed_in_es(self):
        from datetime import datetime
        # Emit a unique event
        unique_entity = f"es-index-test-{uuid.uuid4().hex[:8]}"
        r = post("/api/v3/events/emit", {
            "category": "backtest",
            "action": "es_index_test",
            "entity_id": unique_entity,
        })
        assert r.status_code == 201
        event_id = r.json()["event_id"]

        # Wait up to 5s for ES to index
        month = datetime.utcnow().strftime("%Y.%m")
        index_name = f"apex-events-{month}"
        found = False
        for _ in range(10):
            time.sleep(0.5)
            es_r = httpx.get(
                f"{ES_URL}/{index_name}/_search",
                params={"q": f"event_id:{event_id}"},
                timeout=5.0,
            )
            if es_r.status_code == 200:
                hits = es_r.json().get("hits", {}).get("hits", [])
                if any(h["_source"]["event_id"] == event_id for h in hits):
                    found = True
                    break
        assert found, f"Event {event_id} not found in ES {index_name} after 5s"

    def test_es_index_pattern_is_monthly(self):
        from datetime import datetime
        month = datetime.utcnow().strftime("%Y.%m")
        expected_index = f"apex-events-{month}"
        r = httpx.get(f"{ES_URL}/{expected_index}", timeout=5.0)
        # Index must exist (created when we emitted the event above)
        assert r.status_code in (200,), f"Expected ES index {expected_index} to exist"

    def test_es_indexed_event_has_timestamp(self):
        from datetime import datetime
        month = datetime.utcnow().strftime("%Y.%m")
        index_name = f"apex-events-{month}"
        r = httpx.get(f"{ES_URL}/{index_name}/_search", timeout=5.0)
        assert r.status_code == 200
        hits = r.json().get("hits", {}).get("hits", [])
        assert len(hits) > 0
        for hit in hits:
            src = hit["_source"]
            assert "@timestamp" in src or "timestamp" in src
