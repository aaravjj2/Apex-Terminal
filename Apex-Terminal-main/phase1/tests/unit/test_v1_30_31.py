"""
Unit tests for v1.30 (Strategy Diff + Lineage) and v1.31 (Backtest Artifact Binding).
"""

import hashlib
import json
import pytest
from datetime import date

# v1.30 imports
from services.strategy_lab.artifact_models import (
    StrategyArtifact, build_artifact, canonical_json, compute_content_hash,
    DEMO_TIMESTAMP,
)
from services.strategy_lab.artifact_store import ArtifactStore
from services.strategy_lab.artifact_diff import (
    compute_diff, compute_diff_hash, get_lineage_chain,
    _json_pointer_paths, _value_hash,
)

# v1.31 imports
from services.backtest_engine.models import BacktestConfig


# ──────────────────────────────────────────────
# v1.30: Lineage Tests
# ──────────────────────────────────────────────

class TestLineageMetadata:
    """Tests for v1.30 lineage fields on StrategyArtifact."""

    def test_artifact_default_lineage_is_none(self):
        a = build_artifact(name="Test", type_="crossover", spec={})
        assert a.parent_id is None
        assert a.derived_from is None

    def test_artifact_with_parent_id(self):
        parent = build_artifact(name="Parent", type_="crossover", spec={"a": 1})
        child = build_artifact(
            name="Child", type_="crossover", spec={"a": 2},
            parent_id=parent.id,
        )
        assert child.parent_id == parent.id
        assert child.derived_from is None

    def test_artifact_with_derived_from(self):
        root = build_artifact(name="Root", type_="crossover", spec={"x": 1})
        derived = build_artifact(
            name="Derived", type_="crossover", spec={"x": 2},
            parent_id=root.id,
            derived_from=root.id,
        )
        assert derived.parent_id == root.id
        assert derived.derived_from == root.id

    def test_lineage_immutable_across_rebuilds(self):
        parent_id = "abc123"
        a1 = build_artifact(name="A", type_="crossover", spec={}, parent_id=parent_id)
        a2 = build_artifact(name="A", type_="crossover", spec={}, parent_id=parent_id)
        assert a1.parent_id == a2.parent_id == parent_id

    def test_lineage_does_not_affect_content_hash(self):
        """parent_id and derived_from are metadata, not content — hash should be same."""
        a1 = build_artifact(name="Same", type_="crossover", spec={"v": 1})
        a2 = build_artifact(name="Same", type_="crossover", spec={"v": 1}, parent_id="xyz")
        assert a1.id == a2.id  # content hash ignores lineage

    def test_store_create_with_lineage(self):
        store = ArtifactStore()
        store.reset_demo()
        parent = store.create(name="P", type_="crossover", spec={"p": 1})
        child = store.create(
            name="C", type_="crossover", spec={"p": 2},
            parent_id=parent.id,
        )
        assert child.parent_id == parent.id


class TestDemoTimestamps:
    """Tests for v1.30 deterministic timestamps in DEMO mode."""

    def test_demo_timestamp_is_constant(self):
        a = build_artifact(name="T", type_="crossover", spec={})
        assert a.created_at == DEMO_TIMESTAMP

    def test_demo_timestamp_identical_across_builds(self):
        a1 = build_artifact(name="T", type_="crossover", spec={})
        a2 = build_artifact(name="T", type_="crossover", spec={})
        assert a1.created_at == a2.created_at == DEMO_TIMESTAMP

    def test_demo_seeds_have_deterministic_timestamps(self):
        store = ArtifactStore()
        for a in store.list():
            assert a.created_at == DEMO_TIMESTAMP


# ──────────────────────────────────────────────
# v1.30: Diff Engine Tests
# ──────────────────────────────────────────────

class TestDiffEngine:
    """Tests for v1.30 deterministic diff output."""

    def _make_pair(self):
        left = build_artifact(
            name="SMA Crossover", type_="crossover",
            spec={"indicators": [{"type": "SMA", "period": 20}], "stop_loss": 2},
        )
        right = build_artifact(
            name="SMA Crossover v2", type_="crossover",
            spec={"indicators": [{"type": "SMA", "period": 50}], "stop_loss": 3},
        )
        return left, right

    def test_diff_identical_artifacts_no_changes(self):
        a = build_artifact(name="Same", type_="crossover", spec={"x": 1})
        diff = compute_diff(a, a)
        assert diff["left_id"] == diff["right_id"]
        assert len(diff["changes"]) == 0

    def test_diff_different_artifacts_has_changes(self):
        left, right = self._make_pair()
        diff = compute_diff(left, right)
        assert len(diff["changes"]) > 0

    def test_diff_changes_sorted_by_path(self):
        left, right = self._make_pair()
        diff = compute_diff(left, right)
        paths = [c["path"] for c in diff["changes"]]
        assert paths == sorted(paths)

    def test_diff_output_deterministic_across_calls(self):
        left, right = self._make_pair()
        d1 = compute_diff(left, right)
        d2 = compute_diff(left, right)
        assert canonical_json(d1) == canonical_json(d2)

    def test_diff_hash_deterministic(self):
        left, right = self._make_pair()
        d1 = compute_diff(left, right)
        d2 = compute_diff(left, right)
        assert compute_diff_hash(d1) == compute_diff_hash(d2)

    def test_diff_includes_canonical_representations(self):
        left, right = self._make_pair()
        diff = compute_diff(left, right)
        assert "left_canonical" in diff
        assert "right_canonical" in diff
        assert diff["left_canonical"]["name"] == "SMA Crossover"
        assert diff["right_canonical"]["name"] == "SMA Crossover v2"

    def test_diff_change_ops(self):
        left = build_artifact(name="A", type_="crossover", spec={"x": 1, "y": 2})
        right = build_artifact(name="A", type_="crossover", spec={"x": 1, "z": 3})
        diff = compute_diff(left, right)
        ops = {c["op"] for c in diff["changes"]}
        # y removed, z added
        assert "removed" in ops or "added" in ops

    def test_diff_change_entry_has_required_fields(self):
        left, right = self._make_pair()
        diff = compute_diff(left, right)
        for change in diff["changes"]:
            assert "path" in change
            assert "op" in change
            assert "left_value" in change
            assert "right_value" in change
            assert change["op"] in ("added", "removed", "changed")


class TestDiffDeterminism:
    """Focused determinism tests for diff output stability."""

    def test_diff_output_sha256_stable_10_runs(self):
        left = build_artifact(name="L", type_="crossover", spec={"a": 1, "b": [1, 2]})
        right = build_artifact(name="R", type_="crossover", spec={"a": 2, "c": [3, 4]})
        hashes = set()
        for _ in range(10):
            d = compute_diff(left, right)
            hashes.add(compute_diff_hash(d))
        assert len(hashes) == 1, f"Non-deterministic: got {len(hashes)} distinct hashes"


# ──────────────────────────────────────────────
# v1.30: Lineage Chain Tests
# ──────────────────────────────────────────────

class TestLineageChain:
    """Tests for v1.30 lineage chain traversal."""

    def test_lineage_single_artifact_returns_self(self):
        store = ArtifactStore()
        store.reset_demo()
        artifacts = store.list()
        chain = get_lineage_chain(artifacts[0].id, store.get)
        assert len(chain) == 1
        assert chain[0]["id"] == artifacts[0].id

    def test_lineage_parent_child_ordering(self):
        store = ArtifactStore()
        store.reset_demo()
        parent = store.create(name="P", type_="crossover", spec={"p": 1})
        child = store.create(name="C", type_="crossover", spec={"c": 1}, parent_id=parent.id)
        chain = get_lineage_chain(child.id, store.get)
        assert len(chain) == 2
        assert chain[0]["id"] == parent.id  # root first
        assert chain[1]["id"] == child.id

    def test_lineage_depth_values(self):
        store = ArtifactStore()
        store.reset_demo()
        a = store.create(name="A", type_="crossover", spec={"n": 1})
        b = store.create(name="B", type_="crossover", spec={"n": 2}, parent_id=a.id)
        c = store.create(name="C", type_="crossover", spec={"n": 3}, parent_id=b.id)
        chain = get_lineage_chain(c.id, store.get)
        assert len(chain) == 3
        assert [e["depth"] for e in chain] == [0, 1, 2]

    def test_lineage_deterministic_ordering(self):
        store = ArtifactStore()
        store.reset_demo()
        a = store.create(name="Root", type_="crossover", spec={"r": 0})
        b = store.create(name="Mid", type_="crossover", spec={"r": 1}, parent_id=a.id)
        c = store.create(name="Leaf", type_="crossover", spec={"r": 2}, parent_id=b.id)
        c1 = get_lineage_chain(c.id, store.get)
        c2 = get_lineage_chain(c.id, store.get)
        assert c1 == c2  # identical ordering

    def test_lineage_missing_parent_stops_gracefully(self):
        store = ArtifactStore()
        store.reset_demo()
        child = store.create(name="Orphan", type_="crossover", spec={"o": 1}, parent_id="nonexistent")
        chain = get_lineage_chain(child.id, store.get)
        assert len(chain) == 1  # only self, parent not found


# ──────────────────────────────────────────────
# v1.30: JSON Pointer Paths Tests
# ──────────────────────────────────────────────

class TestJsonPointerPaths:
    """Tests for internal path flattening utility."""

    def test_flat_dict(self):
        paths = _json_pointer_paths({"a": 1, "b": 2})
        assert ("/a", 1) in paths
        assert ("/b", 2) in paths

    def test_nested_dict(self):
        paths = _json_pointer_paths({"a": {"b": 1}})
        assert ("/a/b", 1) in paths

    def test_list(self):
        paths = _json_pointer_paths({"a": [10, 20]})
        assert ("/a/0", 10) in paths
        assert ("/a/1", 20) in paths

    def test_paths_sorted(self):
        paths = _json_pointer_paths({"z": 1, "a": 2, "m": {"x": 3}})
        keys = [p[0] for p in paths]
        assert keys == sorted(keys)


# ──────────────────────────────────────────────
# v1.31: BacktestConfig with strategy_artifact_id
# ──────────────────────────────────────────────

class TestBacktestArtifactBinding:
    """Tests for v1.31 strategy_artifact_id in BacktestConfig."""

    def _make_config(self, artifact_id=None):
        return BacktestConfig(
            strategy_id="demo-sma",
            symbol="SPY",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            initial_capital=100000.0,
            slippage_bps=5.0,
            fee_per_trade=1.0,
            seed=42,
            strategy_artifact_id=artifact_id,
        )

    def _calc_hash(self, config: BacktestConfig) -> str:
        config_dict = config.model_dump(mode='json')
        config_str = json.dumps(config_dict, sort_keys=True)
        return hashlib.sha256(config_str.encode()).hexdigest()

    def test_config_with_artifact_id(self):
        cfg = self._make_config(artifact_id="abc123")
        assert cfg.strategy_artifact_id == "abc123"

    def test_config_without_artifact_id(self):
        cfg = self._make_config()
        assert cfg.strategy_artifact_id is None

    def test_same_artifact_id_same_hash(self):
        h1 = self._calc_hash(self._make_config(artifact_id="xyz"))
        h2 = self._calc_hash(self._make_config(artifact_id="xyz"))
        assert h1 == h2

    def test_different_artifact_id_different_hash(self):
        h1 = self._calc_hash(self._make_config(artifact_id="abc"))
        h2 = self._calc_hash(self._make_config(artifact_id="def"))
        assert h1 != h2

    def test_none_vs_set_artifact_id_different_hash(self):
        h1 = self._calc_hash(self._make_config(artifact_id=None))
        h2 = self._calc_hash(self._make_config(artifact_id="abc"))
        assert h1 != h2

    def test_artifact_id_in_model_dump(self):
        cfg = self._make_config(artifact_id="test123")
        dumped = cfg.model_dump(mode='json')
        assert dumped["strategy_artifact_id"] == "test123"

    def test_artifact_id_in_json_serialization(self):
        cfg = self._make_config(artifact_id="test456")
        json_str = cfg.model_dump_json()
        data = json.loads(json_str)
        assert data["strategy_artifact_id"] == "test456"

    def test_config_hash_deterministic_10_runs(self):
        hashes = set()
        for _ in range(10):
            h = self._calc_hash(self._make_config(artifact_id="stable"))
            hashes.add(h)
        assert len(hashes) == 1

    def test_backward_compatibility_no_artifact_id(self):
        """Config without strategy_artifact_id should still work."""
        cfg = BacktestConfig(
            strategy_id="demo",
            symbol="AAPL",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 6, 30),
        )
        assert cfg.strategy_artifact_id is None
        dumped = cfg.model_dump(mode='json')
        assert "strategy_artifact_id" in dumped
