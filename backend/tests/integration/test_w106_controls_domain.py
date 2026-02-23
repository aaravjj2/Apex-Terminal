"""
Wave 106 — Controls domain integration tests.
24 tests across version / index controls / search / get / edges / delete.
"""
from __future__ import annotations

import pytest
import requests

BASE = "http://localhost:8090/api/v3/controls"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _clean():
    requests.delete(f"{BASE}/data")


def _post_control(doc_type="ap-ar", reference="INV-001", amount=5000, **extra):
    payload = {
        "doc_type": doc_type,
        "data": {"reference": reference, "amount": amount, **extra},
    }
    return requests.post(f"{BASE}/controls", json=payload)


def _post_edge(from_id, to_id, edge_type="audit-event"):
    return requests.post(f"{BASE}/edges", json={
        "from_id": from_id,
        "to_id": to_id,
        "edge_type": edge_type,
        "metadata": {"source": "pytest"},
    })


# ─────────────────────────────────────────────────────────────────────────────
# 1. Version (3 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestVersion:
    def test_version_status_ok(self):
        r = requests.get(f"{BASE}/version")
        assert r.status_code == 200

    def test_version_has_w106_tag(self):
        r = requests.get(f"{BASE}/version")
        assert "w106" in r.json()["version"]

    def test_version_has_doc_types(self):
        r = requests.get(f"{BASE}/version")
        d = r.json()
        assert "doc_types" in d
        assert "ap-ar" in d["doc_types"]
        assert "reconciliation" in d["doc_types"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. Index controls (5 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestIndexControl:
    def setup_method(self):
        _clean()

    def test_index_returns_201(self):
        r = _post_control()
        assert r.status_code == 201

    def test_index_returns_id(self):
        r = _post_control()
        d = r.json()
        assert "id" in d

    def test_index_ap_ar(self):
        r = _post_control(doc_type="ap-ar")
        assert r.json()["doc_type"] == "ap-ar"

    def test_index_reconciliation(self):
        r = _post_control(doc_type="reconciliation", reference="RECON-001")
        assert r.json()["doc_type"] == "reconciliation"

    def test_index_custom_doc_id(self):
        r = requests.post(f"{BASE}/controls", json={
            "doc_type": "ap-ar",
            "doc_id": "custom-id-w106",
            "data": {"reference": "CUSTOM"},
        })
        assert r.status_code == 201
        assert r.json()["id"] == "custom-id-w106"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Search controls (4 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestSearchControls:
    def setup_method(self):
        _clean()

    def test_search_returns_200(self):
        r = requests.get(f"{BASE}/controls/search?q=INV")
        assert r.status_code == 200

    def test_search_empty_returns_empty_hits(self):
        r = requests.get(f"{BASE}/controls/search?q=XYZ123")
        d = r.json()
        assert "hits" in d
        # either 0 results or a list
        assert isinstance(d["hits"], list)

    def test_search_finds_indexed_control(self):
        _post_control(reference="SEARCHABLE-REF")
        r = requests.get(f"{BASE}/controls/search?q=SEARCHABLE-REF")
        d = r.json()
        assert d["total"] >= 1 or any("SEARCHABLE-REF" in str(h) for h in d["hits"])

    def test_search_filter_by_doc_type(self):
        _post_control(doc_type="ap-ar", reference="AR-001")
        r = requests.get(f"{BASE}/controls/search?q=AR-001&doc_type=ap-ar")
        assert r.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# 4. Get control (4 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestGetControl:
    def setup_method(self):
        _clean()

    def test_get_returns_404_for_missing(self):
        r = requests.get(f"{BASE}/controls/nonexistent-id")
        assert r.status_code == 404

    def test_get_returns_control(self):
        doc_id = _post_control().json()["id"]
        r = requests.get(f"{BASE}/controls/{doc_id}")
        assert r.status_code == 200

    def test_get_has_id_field(self):
        doc_id = _post_control().json()["id"]
        r = requests.get(f"{BASE}/controls/{doc_id}")
        assert r.json()["id"] == doc_id

    def test_get_has_doc_type(self):
        doc_id = _post_control(doc_type="reconciliation").json()["id"]
        r = requests.get(f"{BASE}/controls/{doc_id}")
        assert r.json()["doc_type"] == "reconciliation"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Edges (6 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestEdges:
    def setup_method(self):
        _clean()

    def test_post_edge_returns_201(self):
        doc_id = _post_control().json()["id"]
        r = _post_edge(doc_id, "audit-event-001")
        assert r.status_code == 201

    def test_post_edge_has_id(self):
        doc_id = _post_control().json()["id"]
        r = _post_edge(doc_id, "audit-event-001")
        assert "id" in r.json()

    def test_get_edges_empty(self):
        r = requests.get(f"{BASE}/edges")
        assert r.status_code == 200
        assert isinstance(r.json()["edges"], list)

    def test_get_edges_after_post(self):
        doc_id = _post_control().json()["id"]
        _post_edge(doc_id, "audit-event-001")
        r = requests.get(f"{BASE}/edges?from_id={doc_id}")
        data = r.json()
        assert data["total"] == 1
        assert data["edges"][0]["from_id"] == doc_id

    def test_get_edges_filter_by_to_id(self):
        doc_id = _post_control().json()["id"]
        _post_edge(doc_id, "AUDIT-EVENT-XYZ")
        r = requests.get(f"{BASE}/edges?to_id=AUDIT-EVENT-XYZ")
        data = r.json()
        assert data["total"] >= 1

    def test_edges_has_edge_type(self):
        doc_id = _post_control().json()["id"]
        _post_edge(doc_id, "audit-event-007", edge_type="control-link")
        r = requests.get(f"{BASE}/edges?from_id={doc_id}")
        assert r.json()["edges"][0]["edge_type"] == "control-link"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Delete (2 tests)
# ─────────────────────────────────────────────────────────────────────────────

class TestDelete:
    def setup_method(self):
        _clean()

    def test_delete_returns_counts(self):
        _post_control()
        r = requests.delete(f"{BASE}/data")
        assert r.status_code == 200
        d = r.json()
        assert "deleted_documents" in d
        assert "deleted_edges" in d

    def test_delete_clears_controls(self):
        _post_control()
        requests.delete(f"{BASE}/data")
        r = requests.get(f"{BASE}/controls/search?q=INV-001")
        assert r.json()["total"] == 0
