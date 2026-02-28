"""
Wave 108 — Export bundles (reproducible).
One-click judge bundle with manifest+hashes, ES templates, DB tables, README.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import sqlite3
import time
import zipfile
from typing import Any, Optional

try:
    from elasticsearch import AsyncElasticsearch  # type: ignore
except ImportError:
    AsyncElasticsearch = None  # type: ignore

EXPORT_BUNDLE_VERSION = "w108-v1.0"

ES_HOST = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

# Tables to include in the export bundle
EXPORT_TABLES = [
    "tickets",
    "ticket_audit_events",
    "controls_documents",
    "controls_edges",
    "perf_budget_samples",
    "a11y_audit_runs",
]

# ES indices to snapshot
EXPORT_INDICES = [
    "apex-tickets",
    "apex-controls-ap-ar",
    "apex-controls-reconciliation",
    "apex-perf-budget",
]


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _db_path() -> str:
    raw = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
    return raw.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_str(s: str) -> str:
    return _sha256(s.encode("utf-8"))


# ---------------------------------------------------------------------------
# Bundle content builders
# ---------------------------------------------------------------------------

def _build_readme() -> bytes:
    content = """# Apex Terminal — Export Bundle

## How to Reproduce

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Start services:
   ```
   docker compose -f docker-compose.local.yml up -d
   ```

3. Set environment variables (copy keys.env.example → keys.env and fill in):
   ```
   cp keys.env.example keys.env
   ```

4. Start the backend:
   ```
   cd phase1 && uvicorn services.api.main:app --host 0.0.0.0 --port 8090
   ```

5. Start the frontend:
   ```
   cd frontend && npm run dev
   ```

6. Open http://localhost:5100 in your browser.

## Stack
- Backend: FastAPI + Python 3.14
- Frontend: React + TypeScript + Vite
- Storage: SQLite + Elasticsearch 8
- AI: Elastic Agent Builder + ES vector search

## Bundle Contents
- manifest.json: file hashes for integrity verification
- es_templates.json: Elasticsearch index templates
- db_tables.json: selected database table snapshots
- README.md: this file
"""
    return content.encode("utf-8")


def _build_db_snapshot() -> bytes:
    """Export selected SQLite tables as sorted, deterministic JSON."""
    db_path = os.path.abspath(_db_path())
    snapshot: dict[str, list] = {}

    if not os.path.exists(db_path):
        return json.dumps({"tables": {}, "note": "DB not found"}, sort_keys=True).encode("utf-8")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Get tables that actually exist
        exists = {
            row[0]
            for row in cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        for table in sorted(EXPORT_TABLES):
            if table in exists:
                try:
                    rows = cursor.execute(f"SELECT * FROM {table} ORDER BY rowid").fetchall()
                    col_names = [desc[0] for desc in cursor.description]
                    snapshot[table] = [dict(zip(col_names, row)) for row in rows]
                except Exception:
                    snapshot[table] = []
            else:
                snapshot[table] = []
        conn.close()
    except Exception as e:
        snapshot = {"error": str(e)}

    return json.dumps({"tables": snapshot}, sort_keys=True, default=str).encode("utf-8")


async def _build_es_templates() -> bytes:
    """Fetch ES index templates/settings for the export indices."""
    templates: dict[str, Any] = {}

    if AsyncElasticsearch is None:
        return json.dumps({"indices": {}, "note": "ES not available"}, sort_keys=True).encode("utf-8")

    try:
        client = AsyncElasticsearch(ES_HOST)
        await client.info()
        for index in sorted(EXPORT_INDICES):
            try:
                exists = await client.indices.exists(index=index)
                if exists:
                    mapping = await client.indices.get_mapping(index=index)
                    settings = await client.indices.get_settings(index=index)
                    templates[index] = {
                        "mapping": mapping.get(index, {}),
                        "settings": settings.get(index, {}),
                    }
                else:
                    templates[index] = {"note": "index does not exist"}
            except Exception as e:
                templates[index] = {"error": str(e)}
        await client.close()
    except Exception as e:
        templates = {"error": str(e)}

    return json.dumps({"indices": templates}, sort_keys=True, default=str).encode("utf-8")


def _build_manifest(file_contents: dict[str, bytes]) -> bytes:
    """Build a deterministic manifest with SHA256 hashes of all files."""
    files = {}
    for name, content in sorted(file_contents.items()):
        files[name] = {
            "sha256": _sha256(content),
            "size_bytes": len(content),
        }

    # Bundle-level hash: hash of sorted file hashes
    bundle_source = "|".join(f"{k}:{v['sha256']}" for k, v in sorted(files.items()))
    bundle_hash = _sha256_str(bundle_source)

    manifest = {
        "version": EXPORT_BUNDLE_VERSION,
        "files": files,
        "bundle_hash": bundle_hash,
    }
    return json.dumps(manifest, sort_keys=True, indent=2).encode("utf-8")


# ---------------------------------------------------------------------------
# Main export function
# ---------------------------------------------------------------------------

async def create_export_bundle() -> dict:
    """
    Create an in-memory export ZIP bundle.
    Returns dict with: zip_bytes (bytes), manifest (dict), filename (str).
    """
    ts = int(time.time())
    filename = f"apex-export-{ts}.zip"

    # Build content
    readme_bytes = _build_readme()
    db_bytes = _build_db_snapshot()
    es_bytes = await _build_es_templates()

    file_contents = {
        "README.md": readme_bytes,
        "db_tables.json": db_bytes,
        "es_templates.json": es_bytes,
    }

    # Manifest depends on content only (not timestamp), so it's reproducible
    manifest_bytes = _build_manifest(file_contents)
    file_contents["manifest.json"] = manifest_bytes

    # Build ZIP in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, content in sorted(file_contents.items()):
            zf.writestr(name, content)
    buf.seek(0)
    zip_bytes = buf.read()

    manifest_data = json.loads(manifest_bytes.decode("utf-8"))

    return {
        "filename": filename,
        "zip_bytes": zip_bytes,
        "manifest": manifest_data,
        "file_sizes": {k: len(v) for k, v in file_contents.items()},
        "created_at": ts,
    }


async def get_manifest_only() -> dict:
    """Return just the manifest (without ZIP creation overhead for determinism tests)."""
    readme_bytes = _build_readme()
    db_bytes = _build_db_snapshot()
    es_bytes = await _build_es_templates()

    file_contents = {
        "README.md": readme_bytes,
        "db_tables.json": db_bytes,
        "es_templates.json": es_bytes,
    }
    manifest_bytes = _build_manifest(file_contents)
    return json.loads(manifest_bytes.decode("utf-8"))
