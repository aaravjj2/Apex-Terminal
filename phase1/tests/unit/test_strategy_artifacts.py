"""
Tests for Strategy Artifact models, store, and validation (v1.28 + v1.29)
Covers:
- Canonicalization stability
- Content-hash stability  
- Store behavior (idempotency, listing order)
- Validation engine ordering and edge cases (10+ tests)
"""

import hashlib
import json
import pytest

from phase1.services.strategy_lab.artifact_models import (
    StrategyArtifact,
    canonical_json,
    compute_content_hash,
    build_artifact,
    _canonicalize,
)
from phase1.services.strategy_lab.artifact_store import ArtifactStore
from phase1.services.strategy_lab.artifact_validator import validate_artifact_spec


# ============================================================
# Canonicalization tests
# ============================================================

class TestCanonicalization:
    """Tests for canonical JSON production."""

    def test_same_input_same_bytes(self):
        """Same input => same canonical JSON bytes."""
        obj = {"b": 2, "a": 1, "c": [3, 2, 1]}
        assert canonical_json(obj) == canonical_json(obj)

    def test_key_order_stable(self):
        """Keys are sorted regardless of insertion order."""
        obj1 = {"z": 1, "a": 2, "m": 3}
        obj2 = {"a": 2, "m": 3, "z": 1}
        assert canonical_json(obj1) == canonical_json(obj2)

    def test_nested_key_order_stable(self):
        """Nested dict keys are also sorted."""
        obj1 = {"outer": {"z": 1, "a": 2}}
        obj2 = {"outer": {"a": 2, "z": 1}}
        assert canonical_json(obj1) == canonical_json(obj2)

    def test_float_formatting_stable(self):
        """Floats that are whole numbers become ints in canonical form."""
        obj = {"val": 2.0}
        result = json.loads(canonical_json(obj))
        assert result["val"] == 2
        assert isinstance(result["val"], int)

    def test_float_decimal_preserved(self):
        """Non-integer floats are preserved."""
        obj = {"val": 2.5}
        result = json.loads(canonical_json(obj))
        assert result["val"] == 2.5

    def test_canonical_no_whitespace(self):
        """Canonical JSON has no extra whitespace."""
        obj = {"a": 1}
        raw = canonical_json(obj).decode('utf-8')
        assert ' ' not in raw
        assert '\n' not in raw

    def test_canonical_deterministic_sha256(self):
        """Same object => same sha256 across calls."""
        obj = {"name": "test", "spec": {"indicators": [{"type": "SMA"}]}}
        h1 = hashlib.sha256(canonical_json(obj)).hexdigest()
        h2 = hashlib.sha256(canonical_json(obj)).hexdigest()
        assert h1 == h2


# ============================================================
# Content-hash stability tests
# ============================================================

class TestContentHash:
    """Tests for content-hash computation."""

    def test_same_spec_same_id(self):
        """Same strategy spec => same id."""
        h1 = compute_content_hash(1, "TestStrat", "crossover", "1", {"a": 1})
        h2 = compute_content_hash(1, "TestStrat", "crossover", "1", {"a": 1})
        assert h1 == h2

    def test_spec_change_different_id(self):
        """Different spec => different id."""
        h1 = compute_content_hash(1, "TestStrat", "crossover", "1", {"a": 1})
        h2 = compute_content_hash(1, "TestStrat", "crossover", "1", {"a": 2})
        assert h1 != h2

    def test_name_change_different_id(self):
        """Different name => different id."""
        h1 = compute_content_hash(1, "StratA", "crossover", "1", {"a": 1})
        h2 = compute_content_hash(1, "StratB", "crossover", "1", {"a": 1})
        assert h1 != h2

    def test_type_change_different_id(self):
        """Different type => different id."""
        h1 = compute_content_hash(1, "Test", "crossover", "1", {"a": 1})
        h2 = compute_content_hash(1, "Test", "signal", "1", {"a": 1})
        assert h1 != h2

    def test_version_change_different_id(self):
        """Different version => different id."""
        h1 = compute_content_hash(1, "Test", "crossover", "1", {"a": 1})
        h2 = compute_content_hash(1, "Test", "crossover", "2", {"a": 1})
        assert h1 != h2

    def test_build_artifact_id_equals_checksum(self):
        """build_artifact produces id == checksum."""
        a = build_artifact("Test", "crossover", {"a": 1})
        assert a.id == a.checksum
        assert len(a.id) == 64  # sha256 hex

    def test_build_artifact_content_hash_deterministic(self):
        """Two builds with same input => same artifact."""
        a1 = build_artifact("Test", "crossover", {"indicators": [{"type": "SMA"}]})
        a2 = build_artifact("Test", "crossover", {"indicators": [{"type": "SMA"}]})
        assert a1.id == a2.id
        assert a1.checksum == a2.checksum


# ============================================================
# Store behavior tests
# ============================================================

class TestArtifactStore:
    """Tests for artifact store behavior."""

    def test_post_same_spec_twice_returns_same_id(self):
        """POST same spec twice => returns identical id."""
        store = ArtifactStore()
        a1 = store.create("Test", "crossover", {"a": 1})
        a2 = store.create("Test", "crossover", {"a": 1})
        assert a1.id == a2.id

    def test_post_same_spec_deterministic_response(self):
        """POST same spec twice => deterministic full response."""
        store = ArtifactStore()
        a1 = store.create("Test", "crossover", {"a": 1})
        a2 = store.create("Test", "crossover", {"a": 1})
        assert a1.model_dump() == a2.model_dump()

    def test_list_ordering_stable(self):
        """List returns artifacts sorted by id."""
        store = ArtifactStore()
        store.create("Beta", "signal", {"x": 1})
        store.create("Alpha", "crossover", {"y": 2})
        store.create("Gamma", "breakout", {"z": 3})
        artifacts = store.list()
        ids = [a.id for a in artifacts]
        assert ids == sorted(ids)

    def test_reset_demo_restores_seed(self):
        """reset_demo restores to seed state."""
        store = ArtifactStore()
        initial_count = store.count()
        store.create("Extra", "signal", {"x": 1})
        assert store.count() == initial_count + 1
        store.reset_demo()
        assert store.count() == initial_count

    def test_get_existing_artifact(self):
        """Get an existing artifact by ID."""
        store = ArtifactStore()
        a = store.create("Test", "crossover", {"a": 1})
        retrieved = store.get(a.id)
        assert retrieved is not None
        assert retrieved.id == a.id

    def test_get_nonexistent_returns_none(self):
        """Get non-existent returns None."""
        store = ArtifactStore()
        assert store.get("nonexistent-id") is None

    def test_demo_seed_has_artifacts(self):
        """Demo seed creates initial artifacts."""
        store = ArtifactStore()
        assert store.count() >= 2

    def test_demo_seed_deterministic(self):
        """Two fresh stores have identical seed artifacts."""
        store1 = ArtifactStore()
        store2 = ArtifactStore()
        list1 = [a.model_dump() for a in store1.list()]
        list2 = [a.model_dump() for a in store2.list()]
        assert list1 == list2


# ============================================================
# Validation engine tests (10+)
# ============================================================

class TestValidation:
    """Tests for artifact validation engine."""

    def test_valid_spec_passes(self):
        """A valid spec passes validation."""
        result = validate_artifact_spec({
            "name": "SMA Cross",
            "type": "crossover",
            "spec": {
                "indicators": [
                    {"type": "SMA", "params": {"period": 20}},
                    {"type": "SMA", "params": {"period": 50}},
                ],
                "entry": {"condition": "cross_above"},
                "exit": {"condition": "cross_below"},
            },
        })
        assert result["valid"] is True
        assert len(result["errors"]) == 0

    def test_missing_name_error(self):
        """Missing name triggers STRAT_001."""
        result = validate_artifact_spec({
            "name": "",
            "type": "crossover",
            "spec": {"indicators": [{"type": "SMA"}]},
        })
        assert result["valid"] is False
        rule_ids = [e["rule_id"] for e in result["errors"]]
        assert "STRAT_001" in rule_ids

    def test_missing_type_error(self):
        """Missing type triggers STRAT_002."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "",
            "spec": {"indicators": [{"type": "SMA"}]},
        })
        assert result["valid"] is False
        rule_ids = [e["rule_id"] for e in result["errors"]]
        assert "STRAT_002" in rule_ids

    def test_unsupported_type_error(self):
        """Unsupported type triggers STRAT_002."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "unknown_type",
            "spec": {"indicators": [{"type": "SMA"}]},
        })
        assert result["valid"] is False
        errors = [e for e in result["errors"] if e["rule_id"] == "STRAT_002"]
        assert len(errors) == 1
        assert "unknown_type" in errors[0]["message"]

    def test_missing_spec_error(self):
        """Missing spec triggers STRAT_003."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "crossover",
        })
        assert result["valid"] is False
        rule_ids = [e["rule_id"] for e in result["errors"]]
        assert "STRAT_003" in rule_ids

    def test_empty_indicators_error(self):
        """Empty indicators triggers STRAT_003."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "crossover",
            "spec": {"indicators": []},
        })
        assert result["valid"] is False
        rule_ids = [e["rule_id"] for e in result["errors"]]
        assert "STRAT_003" in rule_ids

    def test_crossover_needs_two_indicators(self):
        """Crossover with < 2 indicators triggers STRAT_005."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "crossover",
            "spec": {"indicators": [{"type": "SMA"}]},
        })
        assert result["valid"] is False
        rule_ids = [e["rule_id"] for e in result["errors"]]
        assert "STRAT_005" in rule_ids

    def test_large_stop_loss_warning(self):
        """Stop loss > 50% triggers STRAT_004 warning."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "signal",
            "spec": {
                "indicators": [{"type": "RSI"}],
                "stop_loss_pct": 60,
            },
        })
        warning_ids = [w["rule_id"] for w in result["warnings"]]
        assert "STRAT_004" in warning_ids

    def test_small_take_profit_warning(self):
        """Take profit < 1% triggers STRAT_004 warning."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "signal",
            "spec": {
                "indicators": [{"type": "RSI"}],
                "take_profit_pct": 0.5,
            },
        })
        warning_ids = [w["rule_id"] for w in result["warnings"]]
        assert "STRAT_004" in warning_ids

    def test_no_entry_warning(self):
        """Missing entry condition triggers STRAT_006 warning."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "signal",
            "spec": {"indicators": [{"type": "RSI"}]},
        })
        warning_ids = [w["rule_id"] for w in result["warnings"]]
        assert "STRAT_006" in warning_ids

    def test_no_exit_warning(self):
        """Missing exit condition triggers STRAT_007 warning."""
        result = validate_artifact_spec({
            "name": "Test",
            "type": "signal",
            "spec": {"indicators": [{"type": "RSI"}]},
        })
        warning_ids = [w["rule_id"] for w in result["warnings"]]
        assert "STRAT_007" in warning_ids

    def test_rule_ordering_stable(self):
        """Errors and warnings are sorted by rule_id, path, message."""
        result = validate_artifact_spec({
            "name": "",
            "type": "unknown_type",
            "spec": None,
        })
        error_ids = [e["rule_id"] for e in result["errors"]]
        assert error_ids == sorted(error_ids)

    def test_multiple_issues_sorted(self):
        """Multiple issues from different rules are sorted properly."""
        result = validate_artifact_spec({
            "name": "",
            "type": "",
        })
        error_ids = [e["rule_id"] for e in result["errors"]]
        assert error_ids == sorted(error_ids)
        # Should have at least STRAT_001, STRAT_002, STRAT_003
        assert "STRAT_001" in error_ids
        assert "STRAT_002" in error_ids
        assert "STRAT_003" in error_ids

    def test_input_checksum_stable(self):
        """Input checksum is stable for same input."""
        spec_input = {"name": "Test", "type": "crossover", "spec": {"indicators": [{"type": "SMA"}]}}
        r1 = validate_artifact_spec(spec_input)
        r2 = validate_artifact_spec(spec_input)
        assert r1["input_checksum"] == r2["input_checksum"]

    def test_input_checksum_changes_with_input(self):
        """Input checksum changes when input changes."""
        r1 = validate_artifact_spec({"name": "A", "type": "crossover", "spec": {"indicators": [{"type": "SMA"}]}})
        r2 = validate_artifact_spec({"name": "B", "type": "crossover", "spec": {"indicators": [{"type": "SMA"}]}})
        assert r1["input_checksum"] != r2["input_checksum"]

    def test_long_name_warning(self):
        """Name > 100 chars triggers STRAT_010 warning."""
        result = validate_artifact_spec({
            "name": "A" * 101,
            "type": "signal",
            "spec": {"indicators": [{"type": "RSI"}]},
        })
        warning_ids = [w["rule_id"] for w in result["warnings"]]
        assert "STRAT_010" in warning_ids

    def test_validation_report_deterministic(self):
        """Same invalid input produces identical validation reports."""
        spec_input = {
            "name": "",
            "type": "unknown",
            "spec": {"indicators": [], "stop_loss_pct": 60},
        }
        r1 = validate_artifact_spec(spec_input)
        r2 = validate_artifact_spec(spec_input)
        assert r1 == r2
