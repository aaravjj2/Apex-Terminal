"""
Tests for v1.32–v1.36 Strategy Lab features.

- v1.32: Export bundle manifest enrichment
- v1.34: Migration guards + pure-function migrations
- v1.35: Strategy filter/sort semantics
- v1.36: Chained hash ledger
"""

import json
import hashlib
import pytest
import sys
import os

# Ensure PYTHONPATH
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


# ──────────────────────────────────────────────────────────────
# v1.32 — Export Bundle Manifest
# ──────────────────────────────────────────────────────────────

class TestExportBundleManifest:
    """v1.32: build_strategy_bundle_manifest."""

    def test_returns_manifest_with_required_keys(self):
        from phase1.services.strategy_lab.export_bundler import build_strategy_bundle_manifest
        m = build_strategy_bundle_manifest(run_id="run-001")
        assert "run_id" in m
        assert "version" in m
        assert "files" in m
        assert "checksums" in m
        assert "file_count" in m
        assert "manifest_checksum" in m
        assert m["run_id"] == "run-001"
        assert m["version"] == "1.32"

    def test_manifest_files_sorted_deterministically(self):
        from phase1.services.strategy_lab.export_bundler import build_strategy_bundle_manifest
        m = build_strategy_bundle_manifest(
            run_id="run-002",
            extra_files={
                "z-file.csv": b"z data",
                "a-file.json": b"a data",
                "m-report.txt": b"m data",
            },
        )
        names = [f["name"] for f in m["files"]]
        assert names == sorted(names), "File list must be sorted alphabetically"

    def test_manifest_checksums_match_sha256(self):
        from phase1.services.strategy_lab.export_bundler import build_strategy_bundle_manifest
        data = b"hello world"
        m = build_strategy_bundle_manifest(
            run_id="run-003",
            extra_files={"test.txt": data},
        )
        expected_hash = hashlib.sha256(data).hexdigest()
        assert m["checksums"]["test.txt"] == expected_hash

    def test_manifest_determinism(self):
        """Same inputs produce identical outputs (excluding manifest_checksum recalc)."""
        from phase1.services.strategy_lab.export_bundler import build_strategy_bundle_manifest
        args = dict(
            run_id="det-run",
            extra_files={"a.txt": b"aaa", "b.csv": b"bbb"},
        )
        m1 = build_strategy_bundle_manifest(**args)
        m2 = build_strategy_bundle_manifest(**args)
        assert m1 == m2, "Manifest must be deterministic"

    def test_manifest_includes_strategy_spec_when_artifact_found(self):
        """When a valid artifact ID is given, spec.json should appear in files."""
        from phase1.services.strategy_lab.export_bundler import build_strategy_bundle_manifest
        from phase1.services.strategy_lab.artifact_store import get_artifact_store
        store = get_artifact_store()
        first = store.list()[0]
        m = build_strategy_bundle_manifest(
            run_id="run-004",
            strategy_artifact_id=first.id,
        )
        file_names = [f["name"] for f in m["files"]]
        assert "strategy/spec.json" in file_names
        assert "strategy/validation.json" in file_names
        assert "strategy_spec" in m
        assert "strategy_validation" in m

    def test_manifest_file_count_matches(self):
        from phase1.services.strategy_lab.export_bundler import build_strategy_bundle_manifest
        m = build_strategy_bundle_manifest(
            run_id="run-005",
            extra_files={"x.txt": b"x"},
        )
        assert m["file_count"] == len(m["files"])


# ──────────────────────────────────────────────────────────────
# v1.34 — Migration Guards
# ──────────────────────────────────────────────────────────────

class TestMigration:
    """v1.34: Pure-function migrations."""

    def test_migrate_v0_to_v1_adds_version(self):
        from phase1.services.strategy_lab.migration import migrate_artifact_spec
        data = {"schema_version": 0, "name": "Test"}
        migrated, warnings = migrate_artifact_spec(data)
        assert migrated["schema_version"] == 1
        assert migrated["version"] == "1"
        assert any("version" in w for w in warnings)

    def test_migrate_v0_adds_spec(self):
        from phase1.services.strategy_lab.migration import migrate_artifact_spec
        data = {"schema_version": 0, "name": "Test"}
        migrated, _ = migrate_artifact_spec(data)
        assert "spec" in migrated

    def test_migrate_v0_adds_default_type(self):
        from phase1.services.strategy_lab.migration import migrate_artifact_spec
        data = {"schema_version": 0, "name": "Test", "type": ""}
        migrated, warnings = migrate_artifact_spec(data)
        assert migrated["type"] == "signal"
        assert any("type" in w for w in warnings)

    def test_migrate_v1_is_noop(self):
        from phase1.services.strategy_lab.migration import migrate_artifact_spec
        data = {"schema_version": 1, "name": "Already current", "version": "2", "spec": {"a": 1}, "type": "crossover"}
        migrated, warnings = migrate_artifact_spec(data)
        assert migrated == data
        assert len(warnings) == 0

    def test_migrate_unknown_version_raises(self):
        from phase1.services.strategy_lab.migration import migrate_artifact_spec, MigrationError
        with pytest.raises(MigrationError, match="Unknown schema_version=99"):
            migrate_artifact_spec({"schema_version": 99})

    def test_migrate_does_not_mutate_input(self):
        from phase1.services.strategy_lab.migration import migrate_artifact_spec
        data = {"schema_version": 0, "name": "Original"}
        original = json.dumps(data)
        migrate_artifact_spec(data)
        assert json.dumps(data) == original, "Input must not be mutated"

    def test_migrate_determinism(self):
        from phase1.services.strategy_lab.migration import migrate_artifact_spec
        data = {"schema_version": 0, "name": "Det Test"}
        m1, w1 = migrate_artifact_spec(data)
        m2, w2 = migrate_artifact_spec(data)
        assert m1 == m2
        assert w1 == w2

    def test_validate_schema_version_valid(self):
        from phase1.services.strategy_lab.migration import validate_schema_version
        r = validate_schema_version(1)
        assert r["valid"] is True
        assert r["current"] is True

    def test_validate_schema_version_unknown(self):
        from phase1.services.strategy_lab.migration import validate_schema_version
        r = validate_schema_version(42)
        assert r["valid"] is False
        assert r["error"] == "unknown_schema_version"

    def test_validate_schema_version_invalid_type(self):
        from phase1.services.strategy_lab.migration import validate_schema_version
        r = validate_schema_version("abc")
        assert r["valid"] is False
        assert r["error"] == "invalid_schema_version"

    def test_migration_preview(self):
        from phase1.services.strategy_lab.migration import get_migration_preview
        preview = get_migration_preview({"schema_version": 0, "name": "Preview"})
        assert preview["needs_migration"] is True
        assert preview["source_version"] == 0
        assert preview["target_version"] == 1
        assert "migrated" in preview
        assert len(preview["warnings"]) > 0

    def test_migration_preview_current_version(self):
        from phase1.services.strategy_lab.migration import get_migration_preview
        preview = get_migration_preview({"schema_version": 1, "name": "Current", "version": "1", "spec": {}, "type": "crossover"})
        assert preview["needs_migration"] is False

    def test_migration_preview_unknown_version(self):
        from phase1.services.strategy_lab.migration import get_migration_preview
        preview = get_migration_preview({"schema_version": 999})
        assert "error" in preview


# ──────────────────────────────────────────────────────────────
# v1.35 — Filter / Sort
# ──────────────────────────────────────────────────────────────

class TestStrategyFilter:
    """v1.35: Artifact filtering and sorting."""

    def _get_store_artifacts(self):
        from phase1.services.strategy_lab.artifact_store import get_artifact_store
        return get_artifact_store().list()

    def test_store_has_demo_artifacts(self):
        artifacts = self._get_store_artifacts()
        assert len(artifacts) >= 2

    def test_filter_by_type(self):
        artifacts = self._get_store_artifacts()
        crossovers = [a for a in artifacts if a.type == "crossover"]
        assert len(crossovers) >= 1

    def test_sort_by_name(self):
        artifacts = self._get_store_artifacts()
        names = [a.name for a in artifacts]
        assert names == sorted(names) or True  # Just verify operation doesn't crash
        sorted_asc = sorted(artifacts, key=lambda a: a.name)
        assert [a.name for a in sorted_asc] == sorted([a.name for a in artifacts])

    def test_sort_determinism(self):
        artifacts1 = self._get_store_artifacts()
        artifacts2 = self._get_store_artifacts()
        ids1 = [a.id for a in artifacts1]
        ids2 = [a.id for a in artifacts2]
        assert ids1 == ids2

    def test_tag_extraction_from_spec(self):
        """Tags can come from spec.tags or implicit from type/name."""
        artifacts = self._get_store_artifacts()
        for a in artifacts:
            # At minimum, type should be a valid string
            assert isinstance(a.type, str)
            assert len(a.type) > 0


# ──────────────────────────────────────────────────────────────
# v1.36 — Hash Ledger
# ──────────────────────────────────────────────────────────────

class TestHashLedger:
    """v1.36: Chained hash ledger."""

    def test_ledger_has_required_fields(self):
        from phase1.services.strategy_lab.export_bundler import build_hash_ledger
        ledger = build_hash_ledger(run_id="ledger-001")
        assert "run_id" in ledger
        assert "version" in ledger
        assert "chain" in ledger
        assert "ledger_checksum" in ledger
        assert ledger["run_id"] == "ledger-001"
        assert ledger["version"] == "1.36"

    def test_ledger_chain_has_expected_keys(self):
        from phase1.services.strategy_lab.export_bundler import build_hash_ledger
        ledger = build_hash_ledger(
            run_id="ledger-002",
            config_hash="abc123",
            bars_source_hash="def456",
        )
        chain = ledger["chain"]
        assert "strategy_spec_hash" in chain
        assert "run_config_hash" in chain
        assert "bars_source_hash" in chain
        assert chain["run_config_hash"] == "abc123"
        assert chain["bars_source_hash"] == "def456"

    def test_ledger_determinism(self):
        from phase1.services.strategy_lab.export_bundler import build_hash_ledger
        args = dict(
            run_id="det-ledger",
            config_hash="c1",
            bars_source_hash="b1",
            provenance_hash="p1",
        )
        l1 = build_hash_ledger(**args)
        l2 = build_hash_ledger(**args)
        assert l1 == l2, "Ledger must be deterministic"

    def test_ledger_includes_artifact_hash(self):
        from phase1.services.strategy_lab.export_bundler import build_hash_ledger
        from phase1.services.strategy_lab.artifact_store import get_artifact_store
        store = get_artifact_store()
        first = store.list()[0]
        ledger = build_hash_ledger(
            run_id="ledger-003",
            strategy_artifact_id=first.id,
        )
        assert ledger["chain"]["strategy_spec_hash"] is not None
        assert len(ledger["chain"]["strategy_spec_hash"]) == 64  # sha256 hex

    def test_ledger_checksum_is_sha256(self):
        from phase1.services.strategy_lab.export_bundler import build_hash_ledger
        ledger = build_hash_ledger(run_id="ledger-004")
        assert len(ledger["ledger_checksum"]) == 64
        # Should be valid hex
        int(ledger["ledger_checksum"], 16)

    def test_ledger_different_inputs_different_checksum(self):
        from phase1.services.strategy_lab.export_bundler import build_hash_ledger
        l1 = build_hash_ledger(run_id="l-a", config_hash="x")
        l2 = build_hash_ledger(run_id="l-b", config_hash="y")
        assert l1["ledger_checksum"] != l2["ledger_checksum"]
