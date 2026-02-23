"""
Wave 107  Safe actions (tickets) integration tests.
24 tests: version / RBAC / create / idempotency / get / update / audit / search / delete.
Uses live backend at localhost:8090.
"""
from __future__ import annotations

import uuid
import pytest
import requests

BASE = "http://localhost:8090/api/v3/tickets"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean():
    requests.delete(f"{BASE}/data")


def _post_ticket(title="Test ticket", description="", priority="medium",
                  created_by="agent1", role="agent", ticket_id=None):
    payload = {
        "title": title,
        "description": description,
        "priority": priority,
        "created_by": created_by,
        "role": role,
    }
    if ticket_id:
        payload["ticket_id"] = ticket_id
    return requests.post(f"{BASE}/tickets", json=payload)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_between():
    _clean()
    yield
    _clean()


# ---------------------------------------------------------------------------
# 1. Version (3 tests)
# ---------------------------------------------------------------------------

class TestVersion:
    def test_version_status_ok(self):
        r = requests.get(f"{BASE}/version")
        assert r.status_code == 200

    def test_version_has_w107_tag(self):
        r = requests.get(f"{BASE}/version")
        assert "w107" in r.json()["version"]

    def test_version_status_field(self):
        r = requests.get(f"{BASE}/version")
        assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# 2. RBAC (4 tests)
# ---------------------------------------------------------------------------

class TestRBAC:
    def test_rbac_admin_allowed(self):
        r = requests.get(f"{BASE}/rbac/check?role=admin")
        assert r.status_code == 200
        assert r.json()["allowed"] is True

    def test_rbac_agent_allowed(self):
        r = requests.get(f"{BASE}/rbac/check?role=agent")
        assert r.json()["allowed"] is True

    def test_rbac_auditor_allowed(self):
        r = requests.get(f"{BASE}/rbac/check?role=auditor")
        assert r.json()["allowed"] is True

    def test_rbac_viewer_denied(self):
        r = requests.get(f"{BASE}/rbac/check?role=viewer")
        assert r.json()["allowed"] is False


# ---------------------------------------------------------------------------
# 3. Create ticket (5 tests)
# ---------------------------------------------------------------------------

class TestCreate:
    def test_create_returns_201(self):
        r = _post_ticket()
        assert r.status_code == 201

    def test_create_returns_id(self):
        r = _post_ticket("Has ID")
        body = r.json()
        assert "id" in body
        assert len(body["id"]) > 0

    def test_create_default_status_open(self):
        r = _post_ticket()
        assert r.json()["status"] == "open"

    def test_create_viewer_role_blocked(self):
        r = _post_ticket(role="viewer")
        assert r.status_code == 403

    def test_create_priority_stored(self):
        r = _post_ticket(priority="high")
        assert r.json()["priority"] == "high"


# ---------------------------------------------------------------------------
# 4. Idempotency (3 tests)
# ---------------------------------------------------------------------------

class TestIdempotency:
    def test_same_ticket_id_returns_same_object(self):
        tid = str(uuid.uuid4())
        r1 = _post_ticket("Original", ticket_id=tid)
        r2 = _post_ticket("Different", ticket_id=tid)
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["id"] == r2.json()["id"]

    def test_idempotent_preserves_original_title(self):
        tid = str(uuid.uuid4())
        _post_ticket("First", ticket_id=tid)
        r2 = _post_ticket("Second", ticket_id=tid)
        assert r2.json()["title"] == "First"

    def test_idempotent_no_duplicate_audit_events(self):
        tid = str(uuid.uuid4())
        _post_ticket("Idem", ticket_id=tid)
        _post_ticket("Idem", ticket_id=tid)
        r = requests.get(f"{BASE}/tickets/{tid}/audit")
        assert len(r.json()["events"]) == 1


# ---------------------------------------------------------------------------
# 5. Get ticket (2 tests)
# ---------------------------------------------------------------------------

class TestGet:
    def test_get_existing_ticket(self):
        tid = _post_ticket("Get me").json()["id"]
        r = requests.get(f"{BASE}/tickets/{tid}")
        assert r.status_code == 200
        assert r.json()["id"] == tid

    def test_get_missing_returns_404(self):
        r = requests.get(f"{BASE}/tickets/does-not-exist")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# 6. Update (3 tests)
# ---------------------------------------------------------------------------

class TestUpdate:
    def test_update_status(self):
        tid = _post_ticket().json()["id"]
        r = requests.patch(f"{BASE}/tickets/{tid}", json={
            "updated_by": "admin1", "role": "admin", "updates": {"status": "closed"},
        })
        assert r.status_code == 200
        assert r.json()["status"] == "closed"

    def test_update_rbac_denied(self):
        tid = _post_ticket().json()["id"]
        r = requests.patch(f"{BASE}/tickets/{tid}", json={
            "updated_by": "v1", "role": "viewer", "updates": {"status": "closed"},
        })
        assert r.status_code == 403

    def test_update_missing_ticket_404(self):
        r = requests.patch(f"{BASE}/tickets/nonexistent", json={
            "updated_by": "a", "role": "admin", "updates": {"status": "closed"},
        })
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# 7. Audit trail (3 tests)
# ---------------------------------------------------------------------------

class TestAuditTrail:
    def test_audit_has_created_event(self):
        tid = _post_ticket("Audit").json()["id"]
        r = requests.get(f"{BASE}/tickets/{tid}/audit")
        assert r.status_code == 200
        events = r.json()["events"]
        assert len(events) >= 1
        assert events[0]["event_type"] == "created"

    def test_audit_actor_recorded(self):
        tid = _post_ticket(created_by="my_agent").json()["id"]
        events = requests.get(f"{BASE}/tickets/{tid}/audit").json()["events"]
        assert events[0]["actor"] == "my_agent"

    def test_audit_update_event_appended(self):
        tid = _post_ticket().json()["id"]
        requests.patch(f"{BASE}/tickets/{tid}", json={
            "updated_by": "admin2", "role": "admin", "updates": {"priority": "critical"},
        })
        events = requests.get(f"{BASE}/tickets/{tid}/audit").json()["events"]
        types = [e["event_type"] for e in events]
        assert "updated" in types


# ---------------------------------------------------------------------------
# 8. Search (2 tests)
# ---------------------------------------------------------------------------

class TestSearch:
    def test_search_returns_hits_structure(self):
        r = requests.get(f"{BASE}/tickets/search")
        assert r.status_code == 200
        body = r.json()
        assert "hits" in body
        assert isinstance(body["hits"], list)
        assert "total" in body

    def test_search_finds_created_ticket(self):
        import time
        unique = f"uniquetoken-{uuid.uuid4().hex[:8]}"
        _post_ticket(title=f"ticket-{unique}")
        time.sleep(0.5)
        r = requests.get(f"{BASE}/tickets/search?q={unique}")
        body = r.json()
        assert body["total"] >= 1 or any(unique in str(h) for h in body["hits"])


# ---------------------------------------------------------------------------
# 9. Delete (1 test)
# ---------------------------------------------------------------------------

class TestDelete:
    def test_delete_clears_tickets(self):
        _post_ticket("Del1")
        _post_ticket("Del2")
        requests.delete(f"{BASE}/data")
        r = requests.get(f"{BASE}/tickets/search")
        assert r.json()["total"] == 0
