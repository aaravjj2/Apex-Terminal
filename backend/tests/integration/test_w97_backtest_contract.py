"""
W97 — Backtesting Correctness Contract: integration tests
  30 tests via HTTP-only (httpx)
"""
import pytest
import httpx

BASE = "http://localhost:8090/api/v3/backtest-contract"
GOLDEN_IDS = ["GOLDEN_MA_CROSS_001", "GOLDEN_MR_001", "GOLDEN_HOLD_001"]


@pytest.fixture(scope="module", autouse=True)
def reset_data():
    """Clear backtest runs before tests."""
    with httpx.Client(timeout=20) as client:
        client.delete(f"{BASE}/runs")
    yield
    with httpx.Client(timeout=20) as client:
        client.delete(f"{BASE}/runs")


# ─── Basic connectivity ───────────────────────────────────────────────────────

class TestGoldenRunsEndpoint:
    def test_golden_runs_returns_200(self):
        r = httpx.get(f"{BASE}/golden-runs")
        assert r.status_code == 200

    def test_golden_runs_count_is_three(self):
        r = httpx.get(f"{BASE}/golden-runs")
        data = r.json()
        assert data["count"] == 3
        assert len(data["golden_runs"]) == 3

    def test_golden_runs_have_required_fields(self):
        r = httpx.get(f"{BASE}/golden-runs")
        for g in r.json()["golden_runs"]:
            for field in ("id", "name", "strategy_type", "description",
                          "expected_total_return", "expected_trade_count",
                          "expected_final_equity"):
                assert field in g, f"missing {field}"

    def test_golden_run_ids_match_expected(self):
        r = httpx.get(f"{BASE}/golden-runs")
        ids = {g["id"] for g in r.json()["golden_runs"]}
        assert ids == set(GOLDEN_IDS)

    def test_get_single_golden_run_ma_cross(self):
        r = httpx.get(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "GOLDEN_MA_CROSS_001"
        assert data["strategy_type"] == "ma_cross"

    def test_get_single_golden_run_mr(self):
        r = httpx.get(f"{BASE}/golden-runs/GOLDEN_MR_001")
        assert r.status_code == 200
        assert r.json()["strategy_type"] == "mean_reversion"

    def test_get_single_golden_run_hold(self):
        r = httpx.get(f"{BASE}/golden-runs/GOLDEN_HOLD_001")
        assert r.status_code == 200
        assert r.json()["strategy_type"] == "buy_and_hold"

    def test_get_unknown_golden_run_returns_404(self):
        r = httpx.get(f"{BASE}/golden-runs/DOES_NOT_EXIST")
        assert r.status_code == 404


# ─── Execute golden runs ──────────────────────────────────────────────────────

class TestGoldenRunExecution:
    def test_execute_ma_cross_returns_201(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute")
        assert r.status_code == 201

    def test_execute_ma_cross_passes(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute")
        data = r.json()
        assert data["all_pass"] is True
        assert data["status"] == "passed"

    def test_execute_ma_cross_trade_count(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute")
        assert r.json()["metrics"]["trade_count"] == 2

    def test_execute_ma_cross_invariants_ok(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute")
        data = r.json()
        assert data["invariant_ok"] is True
        assert data["invariant_errors"] == []

    def test_execute_mr_passes(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MR_001/execute")
        data = r.json()
        assert data["all_pass"] is True
        assert data["status"] == "passed"

    def test_execute_mr_trade_count(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MR_001/execute")
        assert r.json()["metrics"]["trade_count"] == 2

    def test_execute_hold_passes(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_HOLD_001/execute")
        data = r.json()
        assert data["all_pass"] is True
        assert data["status"] == "passed"

    def test_execute_hold_trade_count_is_one(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_HOLD_001/execute")
        assert r.json()["metrics"]["trade_count"] == 1

    def test_execute_returns_run_id(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute")
        assert "run_id" in r.json()

    def test_execute_returns_comparison_block(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute")
        comp = r.json()["comparison"]
        assert "total_return" in comp
        assert "trade_count" in comp
        assert "final_equity" in comp

    def test_execute_comparison_within_tolerance_true(self):
        r = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute")
        comp = r.json()["comparison"]
        for key, v in comp.items():
            assert v["within_tolerance"] is True, f"{key} not within tolerance"

    def test_execute_unknown_golden_run_404(self):
        r = httpx.post(f"{BASE}/golden-runs/BAD_ID/execute")
        assert r.status_code == 404

    def test_determinism_same_metrics_on_rerun(self):
        r1 = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute").json()
        r2 = httpx.post(f"{BASE}/golden-runs/GOLDEN_MA_CROSS_001/execute").json()
        assert r1["metrics"]["total_return"] == r2["metrics"]["total_return"]
        assert r1["metrics"]["trade_count"] == r2["metrics"]["trade_count"]


# ─── Validate endpoint ────────────────────────────────────────────────────────

class TestValidateEndpoint:
    def test_validate_valid_spec(self):
        r = httpx.post(f"{BASE}/validate", json={
            "strategy_type": "ma_cross",
            "symbol": "AAPL",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "initial_capital": 10000,
        })
        assert r.status_code == 200
        assert r.json()["valid"] is True
        assert r.json()["errors"] == []

    def test_validate_missing_strategy_type(self):
        r = httpx.post(f"{BASE}/validate", json={
            "symbol": "AAPL",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "initial_capital": 10000,
        })
        data = r.json()
        assert data["valid"] is False
        assert any("strategy_type" in e for e in data["errors"])

    def test_validate_missing_symbol(self):
        r = httpx.post(f"{BASE}/validate", json={
            "strategy_type": "ma_cross",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "initial_capital": 10000,
        })
        assert r.json()["valid"] is False

    def test_validate_missing_start_date(self):
        r = httpx.post(f"{BASE}/validate", json={
            "strategy_type": "ma_cross",
            "symbol": "AAPL",
            "end_date": "2024-12-31",
            "initial_capital": 10000,
        })
        assert r.json()["valid"] is False

    def test_validate_negative_capital(self):
        r = httpx.post(f"{BASE}/validate", json={
            "strategy_type": "ma_cross",
            "symbol": "AAPL",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "initial_capital": -1000,
        })
        data = r.json()
        assert data["valid"] is False
        assert any("capital" in e for e in data["errors"])

    def test_validate_unknown_strategy_type(self):
        r = httpx.post(f"{BASE}/validate", json={
            "strategy_type": "alien_strategy",
            "symbol": "AAPL",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "initial_capital": 10000,
        })
        data = r.json()
        assert data["valid"] is False
        assert any("strategy_type" in e for e in data["errors"])


# ─── Invariants endpoint ──────────────────────────────────────────────────────

class TestInvariantsEndpoint:
    def test_invariants_returns_200(self):
        r = httpx.get(f"{BASE}/invariants")
        assert r.status_code == 200

    def test_invariants_count_is_three(self):
        r = httpx.get(f"{BASE}/invariants")
        data = r.json()
        assert data["count"] == 3

    def test_invariants_have_required_fields(self):
        r = httpx.get(f"{BASE}/invariants")
        for inv in r.json()["invariants"]:
            assert "id" in inv
            assert "name" in inv
            assert "enforced" in inv

    def test_no_lookahead_invariant_enforced(self):
        r = httpx.get(f"{BASE}/invariants")
        ids = {i["id"] for i in r.json()["invariants"]}
        assert "no_lookahead" in ids

    def test_equity_balance_invariant_enforced(self):
        r = httpx.get(f"{BASE}/invariants")
        ids = {i["id"] for i in r.json()["invariants"]}
        assert "equity_balance" in ids

    def test_fill_rules_invariant_enforced(self):
        r = httpx.get(f"{BASE}/invariants")
        ids = {i["id"] for i in r.json()["invariants"]}
        assert "fill_rules" in ids


# ─── Runs history endpoint ────────────────────────────────────────────────────

class TestRunsEndpoint:
    def test_runs_returns_200(self):
        r = httpx.get(f"{BASE}/runs")
        assert r.status_code == 200

    def test_runs_accumulate_after_executions(self):
        """golden runs were executed during the test class above → should see records"""
        r = httpx.get(f"{BASE}/runs")
        data = r.json()
        assert data["count"] >= 1

    def test_delete_runs(self):
        r = httpx.delete(f"{BASE}/runs")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_delete_runs_clears_history(self):
        httpx.delete(f"{BASE}/runs")
        r = httpx.get(f"{BASE}/runs")
        assert r.json()["count"] == 0
