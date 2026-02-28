"""
W98 — Walk-Forward + Robustness v3: integration tests
  ~30 HTTP-only tests via httpx
"""
import pytest
import httpx

BASE = "http://localhost:8090/api/v3/walkforward"


@pytest.fixture(scope="module", autouse=True)
def reset_data():
    """Clear walkforward data before and after tests."""
    with httpx.Client(timeout=20) as client:
        client.delete(f"{BASE}/data")
    yield
    with httpx.Client(timeout=20) as client:
        client.delete(f"{BASE}/data")


# ─── Heatmap endpoint (no side effects) ──────────────────────────────────────

class TestHeatmap:
    def test_heatmap_returns_200(self):
        r = httpx.get(f"{BASE}/heatmap")
        assert r.status_code == 200

    def test_heatmap_has_correct_slippage_levels(self):
        r = httpx.get(f"{BASE}/heatmap")
        data = r.json()
        assert len(data["slippage_levels"]) == 3
        assert 0.0 in data["slippage_levels"]

    def test_heatmap_has_correct_spread_levels(self):
        r = httpx.get(f"{BASE}/heatmap")
        data = r.json()
        assert len(data["spread_levels"]) == 3
        assert 0.0 in data["spread_levels"]

    def test_heatmap_returns_matrix(self):
        r = httpx.get(f"{BASE}/heatmap")
        data = r.json()
        assert len(data["heatmap"]) == 3

    def test_heatmap_rows_have_returns(self):
        r = httpx.get(f"{BASE}/heatmap")
        for row in r.json()["heatmap"]:
            assert "slippage" in row
            assert "returns_by_spread" in row
            assert len(row["returns_by_spread"]) == 3

    def test_heatmap_slippage_degrades_return(self):
        """Higher slippage → lower return (for same spread=0)."""
        r = httpx.get(f"{BASE}/heatmap")
        rows = r.json()["heatmap"]
        r0 = rows[0]["returns_by_spread"]["0.0"]
        r1 = rows[1]["returns_by_spread"]["0.0"]
        r2 = rows[2]["returns_by_spread"]["0.0"]
        assert r0 >= r1 >= r2


# ─── Walk-forward run ─────────────────────────────────────────────────────────

class TestWalkForwardRun:
    def test_run_returns_201(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4, "purge_bars": 2}, timeout=20)
        assert r.status_code == 201

    def test_run_returns_config_id(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4}, timeout=20)
        assert "config_id" in r.json()

    def test_run_returns_n_folds(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4}, timeout=20)
        data = r.json()
        assert data["n_folds"] == 4

    def test_run_returns_correct_fold_count(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4}, timeout=20)
        data = r.json()
        assert len(data["folds"]) == 4

    def test_run_folds_have_purge_gaps(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4, "purge_bars": 3}, timeout=20)
        for fold in r.json()["folds"]:
            gap = fold["test_start"] - fold["train_end"]
            assert gap >= 3, f"purge gap missing in fold {fold['fold_idx']}"

    def test_run_returns_avg_returns(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4}, timeout=20)
        data = r.json()
        assert "avg_train_return" in data
        assert "avg_test_return" in data

    def test_run_deterministic(self):
        """Same config → same fold returns."""
        r1 = httpx.post(f"{BASE}/run", json={"n_folds": 4, "purge_bars": 2}, timeout=20).json()
        r2 = httpx.post(f"{BASE}/run", json={"n_folds": 4, "purge_bars": 2}, timeout=20).json()
        for f1, f2 in zip(r1["folds"], r2["folds"]):
            assert f1["train_return"] == f2["train_return"]
            assert f1["test_return"] == f2["test_return"]

    def test_run_invalid_n_folds_returns_400(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 1}, timeout=20)
        assert r.status_code == 400

    def test_run_six_folds(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 6}, timeout=20)
        assert r.status_code == 201
        assert len(r.json()["folds"]) == 6


# ─── Robustness ───────────────────────────────────────────────────────────────

class TestRobustness:
    def test_robustness_returns_201(self):
        r = httpx.post(f"{BASE}/robustness", json={}, timeout=30)
        assert r.status_code == 201

    def test_robustness_returns_base_return(self):
        r = httpx.post(f"{BASE}/robustness", json={}, timeout=30)
        assert "base_return" in r.json()

    def test_robustness_matrix_not_empty(self):
        r = httpx.post(f"{BASE}/robustness", json={}, timeout=30)
        data = r.json()
        assert data["count"] > 0
        assert len(data["matrix"]) > 0

    def test_robustness_rows_have_required_fields(self):
        r = httpx.post(f"{BASE}/robustness", json={}, timeout=30)
        for row in r.json()["matrix"]:
            for field in ("slippage", "spread", "delay_bars", "liquidity_cap", "adj_return", "delta"):
                assert field in row

    def test_robustness_zero_cost_matches_base(self):
        r = httpx.post(f"{BASE}/robustness", json={}, timeout=30)
        data = r.json()
        base = data["base_return"]
        # Row with 0 slippage, 0 spread, 0 delay, 1.0 liquidity should match base
        baseline_row = next(
            (row for row in data["matrix"]
             if row["slippage"] == 0.0 and row["spread"] == 0.0
             and row["delay_bars"] == 0 and row["liquidity_cap"] == 1.0),
            None,
        )
        assert baseline_row is not None
        assert abs(baseline_row["adj_return"] - base) < 1e-5


# ─── Configs + Folds listing ──────────────────────────────────────────────────

class TestConfigsAndFolds:
    def test_configs_returns_200(self):
        r = httpx.get(f"{BASE}/configs")
        assert r.status_code == 200

    def test_configs_count_grows_after_run(self):
        initial = httpx.get(f"{BASE}/configs").json()["count"]
        httpx.post(f"{BASE}/run", json={"n_folds": 4}, timeout=20)
        new_count = httpx.get(f"{BASE}/configs").json()["count"]
        assert new_count > initial

    def test_folds_for_config_id(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4}, timeout=20)
        config_id = r.json()["config_id"]
        rf = httpx.get(f"{BASE}/folds/{config_id}")
        assert rf.status_code == 200
        assert rf.json()["count"] == 4

    def test_folds_are_ordered_by_fold_idx(self):
        r = httpx.post(f"{BASE}/run", json={"n_folds": 4}, timeout=20)
        config_id = r.json()["config_id"]
        folds = httpx.get(f"{BASE}/folds/{config_id}").json()["folds"]
        indices = [f["fold_idx"] for f in folds]
        assert indices == sorted(indices)

    def test_robustness_for_config_id(self):
        cid = "test-config"
        httpx.post(f"{BASE}/robustness", json={"config_id": cid}, timeout=30)
        r = httpx.get(f"{BASE}/robustness/{cid}")
        assert r.status_code == 200
        assert r.json()["count"] > 0


# ─── Data cleanup ─────────────────────────────────────────────────────────────

class TestDataCleanup:
    def test_delete_data_returns_200(self):
        r = httpx.delete(f"{BASE}/data")
        assert r.status_code == 200

    def test_delete_data_returns_ok(self):
        r = httpx.delete(f"{BASE}/data")
        assert r.json()["ok"] is True

    def test_configs_empty_after_delete(self):
        httpx.delete(f"{BASE}/data")
        r = httpx.get(f"{BASE}/configs")
        assert r.json()["count"] == 0
