"""
Wave 108 — Export bundles integration tests.
Tests: version, bundle creation, manifest determinism, download.
"""
from __future__ import annotations

import json
import pytest
import requests

BASE = "http://localhost:8090/api/v3/export"


# ---------------------------------------------------------------------------
# 1. Version (3 tests)
# ---------------------------------------------------------------------------

class TestVersion:
    def test_version_status_ok(self):
        r = requests.get(f"{BASE}/version")
        assert r.status_code == 200

    def test_version_has_w108_tag(self):
        r = requests.get(f"{BASE}/version")
        assert "w108" in r.json()["version"]

    def test_version_status_field(self):
        r = requests.get(f"{BASE}/version")
        assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# 2. Bundle creation (6 tests)
# ---------------------------------------------------------------------------

class TestBundleCreate:
    def test_create_bundle_returns_201(self):
        r = requests.post(f"{BASE}/bundle")
        assert r.status_code == 201

    def test_create_bundle_has_filename(self):
        r = requests.post(f"{BASE}/bundle")
        assert "filename" in r.json()
        assert r.json()["filename"].startswith("apex-export-")

    def test_create_bundle_has_manifest(self):
        r = requests.post(f"{BASE}/bundle")
        body = r.json()
        assert "manifest" in body
        assert "files" in body["manifest"]
        assert "bundle_hash" in body["manifest"]

    def test_create_bundle_manifest_has_readme(self):
        r = requests.post(f"{BASE}/bundle")
        files = r.json()["manifest"]["files"]
        assert "README.md" in files

    def test_create_bundle_manifest_has_db_tables(self):
        r = requests.post(f"{BASE}/bundle")
        files = r.json()["manifest"]["files"]
        assert "db_tables.json" in files

    def test_create_bundle_manifest_has_es_templates(self):
        r = requests.post(f"{BASE}/bundle")
        files = r.json()["manifest"]["files"]
        assert "es_templates.json" in files


# ---------------------------------------------------------------------------
# 3. Manifest structure (5 tests)
# ---------------------------------------------------------------------------

class TestManifest:
    def test_manifest_endpoint_ok(self):
        r = requests.get(f"{BASE}/manifest")
        assert r.status_code == 200

    def test_manifest_has_version(self):
        r = requests.get(f"{BASE}/manifest")
        body = r.json()
        assert "version" in body
        assert "w108" in body["version"]

    def test_manifest_has_bundle_hash(self):
        r = requests.get(f"{BASE}/manifest")
        body = r.json()
        assert "bundle_hash" in body
        assert len(body["bundle_hash"]) == 64  # SHA256 hex length

    def test_manifest_file_hashes_are_sha256(self):
        r = requests.get(f"{BASE}/manifest")
        files = r.json()["files"]
        for name, info in files.items():
            assert "sha256" in info
            assert len(info["sha256"]) == 64

    def test_manifest_file_sizes_positive(self):
        r = requests.get(f"{BASE}/manifest")
        files = r.json()["files"]
        for name, info in files.items():
            assert info["size_bytes"] > 0


# ---------------------------------------------------------------------------
# 4. Determinism (5 tests)
# ---------------------------------------------------------------------------

class TestDeterminism:
    def test_readme_hash_stable(self):
        """Same README → same hash on two requests."""
        r1 = requests.get(f"{BASE}/manifest")
        r2 = requests.get(f"{BASE}/manifest")
        h1 = r1.json()["files"]["README.md"]["sha256"]
        h2 = r2.json()["files"]["README.md"]["sha256"]
        assert h1 == h2

    def test_bundle_hash_same_state(self):
        """With the same DB state, bundle hash is reproducible."""
        r1 = requests.get(f"{BASE}/manifest")
        r2 = requests.get(f"{BASE}/manifest")
        assert r1.json()["bundle_hash"] == r2.json()["bundle_hash"]

    def test_db_tables_hash_stable_without_changes(self):
        """If DB doesn't change, db_tables.json hash is the same."""
        r1 = requests.get(f"{BASE}/manifest")
        r2 = requests.get(f"{BASE}/manifest")
        h1 = r1.json()["files"]["db_tables.json"]["sha256"]
        h2 = r2.json()["files"]["db_tables.json"]["sha256"]
        assert h1 == h2

    def test_bundle_hash_changes_after_data_change(self):
        """After adding a ticket, the db_tables.json hash changes."""
        # Get hash before
        r_before = requests.get(f"{BASE}/manifest")
        h_before = r_before.json()["files"]["db_tables.json"]["sha256"]

        # Add a ticket
        requests.post("http://localhost:8090/api/v3/tickets/tickets", json={
            "title": f"determinism_test",
            "description": "",
            "priority": "low",
            "created_by": "det_agent",
            "role": "agent",
        })

        # Get hash after
        r_after = requests.get(f"{BASE}/manifest")
        h_after = r_after.json()["files"]["db_tables.json"]["sha256"]

        # Hashes should differ (new ticket changes the DB snapshot)
        assert h_before != h_after

        # Clean up
        requests.delete("http://localhost:8090/api/v3/tickets/data")

    def test_manifest_is_json(self):
        """Manifest can be parsed as JSON."""
        r = requests.get(f"{BASE}/manifest")
        body = r.json()  # No exception means it's valid JSON
        assert isinstance(body, dict)


# ---------------------------------------------------------------------------
# 5. Download (3 tests)
# ---------------------------------------------------------------------------

class TestDownload:
    def test_download_returns_zip_content_type(self):
        r = requests.get(f"{BASE}/bundle/download")
        assert r.status_code == 200
        assert "zip" in r.headers.get("content-type", "").lower()

    def test_download_has_bundle_hash_header(self):
        r = requests.get(f"{BASE}/bundle/download")
        assert "X-Bundle-Hash" in r.headers
        assert len(r.headers["X-Bundle-Hash"]) == 64

    def test_download_zip_is_valid(self):
        """Downloaded ZIP should be openable with Python's zipfile."""
        import zipfile
        import io
        r = requests.get(f"{BASE}/bundle/download")
        buf = io.BytesIO(r.content)
        with zipfile.ZipFile(buf) as zf:
            names = zf.namelist()
        assert "manifest.json" in names
        assert "README.md" in names
        assert "db_tables.json" in names


# ---------------------------------------------------------------------------
# 6. File content (2 tests)
# ---------------------------------------------------------------------------

class TestFileContent:
    def test_readme_exists_in_zip(self):
        import zipfile, io
        r = requests.get(f"{BASE}/bundle/download")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            readme = zf.read("README.md").decode("utf-8")
        assert "Apex Terminal" in readme
        assert "reproduce" in readme.lower()

    def test_manifest_in_zip_is_valid_json(self):
        import zipfile, io
        r = requests.get(f"{BASE}/bundle/download")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            manifest_raw = zf.read("manifest.json")
        manifest = json.loads(manifest_raw)
        assert "bundle_hash" in manifest
        assert "files" in manifest
