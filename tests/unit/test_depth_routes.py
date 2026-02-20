"""
Core Depth Upgrade — Backend Route Tests
Tests all 4 depth route modules for correctness, determinism, and HTTP contract.
"""
import pytest


class TestAutopilotDepthRoutes:
    """Tests for /api/ui2/autopilot-depth endpoints."""

    def test_get_risk_controls(self, test_client):
        r = test_client.get("/api/ui2/autopilot-depth/risk-controls")
        assert r.status_code == 200
        data = r.json()
        assert data["max_position_notional"] == 50000
        assert data["max_gross_exposure"] == 200000
        assert data["max_daily_loss"] == 5000
        assert data["max_trades_per_run"] == 20

    def test_put_risk_controls(self, test_client):
        payload = {
            "max_position_notional": 75000,
            "max_gross_exposure": 300000,
            "max_daily_loss": 10000,
            "max_trades_per_run": 30,
        }
        r = test_client.put("/api/ui2/autopilot-depth/risk-controls", json=payload)
        assert r.status_code == 200
        assert r.json()["max_daily_loss"] == 10000

    def test_get_execution_params(self, test_client):
        r = test_client.get("/api/ui2/autopilot-depth/execution-params")
        assert r.status_code == 200
        data = r.json()
        assert "fee_per_order" in data
        assert "bps_fee" in data

    def test_put_execution_params(self, test_client):
        payload = {
            "fee_per_order": 2.5,
            "bps_fee": 5.0,
            "slippage_base_bps": 2.0,
            "slippage_vol_multiplier": 1.0,
        }
        r = test_client.put("/api/ui2/autopilot-depth/execution-params", json=payload)
        assert r.status_code == 200
        assert r.json()["fee_per_order"] == 2.5

    def test_evaluation_deterministic(self, test_client):
        r1 = test_client.get("/api/ui2/autopilot-depth/runs/run-det-test/evaluation")
        r2 = test_client.get("/api/ui2/autopilot-depth/runs/run-det-test/evaluation")
        assert r1.status_code == 200
        assert r1.json()["hash"] == r2.json()["hash"]

    def test_evaluation_structure(self, test_client):
        r = test_client.get("/api/ui2/autopilot-depth/runs/run-abc/evaluation")
        assert r.status_code == 200
        data = r.json()
        assert data["run_id"] == "run-abc"
        assert len(data["attribution"]) > 0
        assert len(data["fills"]) > 0
        assert len(data["risk_budget_remaining"]) == 4
        assert "hash" in data

    def test_hash_endpoint(self, test_client):
        r = test_client.get("/api/ui2/autopilot-depth/hash")
        assert r.status_code == 200
        assert "hash" in r.json()


class TestBacktestDepthRoutes:
    """Tests for /api/ui2/backtest-depth endpoints."""

    def test_run_sweep(self, test_client):
        config = {
            "symbol": "AAPL",
            "strategy_id": "strat-1",
            "params": [
                {"name": "sma_fast", "min": 5, "max": 25, "step": 5},
                {"name": "sma_slow", "min": 20, "max": 60, "step": 10},
            ],
            "metric": "sharpe",
        }
        r = test_client.post("/api/ui2/backtest-depth/sweeps", json=config)
        assert r.status_code == 200
        data = r.json()
        assert len(data["cells"]) == 25  # 5 × 5
        assert data["best_cell_id"]
        assert data["hash"]

    def test_sweep_deterministic(self, test_client):
        config = {
            "symbol": "SPY",
            "strategy_id": "strat-2",
            "params": [
                {"name": "sma_fast", "min": 5, "max": 15, "step": 5},
                {"name": "sma_slow", "min": 20, "max": 40, "step": 10},
            ],
            "metric": "sharpe",
        }
        r1 = test_client.post("/api/ui2/backtest-depth/sweeps", json=config)
        r2 = test_client.post("/api/ui2/backtest-depth/sweeps", json=config)
        assert r1.json()["hash"] == r2.json()["hash"]

    def test_walk_forward(self, test_client):
        r = test_client.post("/api/ui2/backtest-depth/walkforward?symbol=AAPL&strategy_id=strat-1")
        assert r.status_code == 200
        data = r.json()
        assert len(data["windows"]) == 6
        assert data["aggregate_sharpe"] > 0
        assert "oos_degradation" in data

    def test_walk_forward_deterministic(self, test_client):
        r1 = test_client.post("/api/ui2/backtest-depth/walkforward?symbol=NVDA&strategy_id=strat-3")
        r2 = test_client.post("/api/ui2/backtest-depth/walkforward?symbol=NVDA&strategy_id=strat-3")
        assert r1.json()["hash"] == r2.json()["hash"]

    def test_robustness(self, test_client):
        r = test_client.post("/api/ui2/backtest-depth/robustness?symbol=AAPL&strategy_id=strat-1")
        assert r.status_code == 200
        data = r.json()
        assert len(data["scenarios"]) == 8
        assert data["scenarios"][0]["label"] == "Base Case"
        assert 0 <= data["robustness_score"] <= 100

    def test_robustness_deterministic(self, test_client):
        r1 = test_client.post("/api/ui2/backtest-depth/robustness?symbol=TSLA&strategy_id=strat-4")
        r2 = test_client.post("/api/ui2/backtest-depth/robustness?symbol=TSLA&strategy_id=strat-4")
        assert r1.json()["hash"] == r2.json()["hash"]

    def test_hash_endpoint(self, test_client):
        r = test_client.get("/api/ui2/backtest-depth/hash")
        assert r.status_code == 200
        assert "hash" in r.json()


class TestWorkflowDepthRoutes:
    """Tests for /api/ui2/workflow-depth endpoints."""

    def test_list_templates(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/templates")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 4

    def test_search_templates(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/templates?q=export")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_get_template(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/templates/tmpl-001")
        assert r.status_code == 200
        assert r.json()["name"] == "Daily Portfolio Export"

    def test_get_template_404(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/templates/tmpl-nonexistent")
        assert r.status_code == 404

    def test_create_template(self, test_client):
        payload = {
            "name": "Test Template",
            "description": "A test",
            "tags": ["test"],
            "trigger_type": "schedule",
            "actions": ["notify"],
        }
        r = test_client.post("/api/ui2/workflow-depth/templates", json=payload)
        assert r.status_code == 200
        assert r.json()["name"] == "Test Template"

    def test_clone_template(self, test_client):
        r = test_client.post("/api/ui2/workflow-depth/templates/tmpl-002/clone")
        assert r.status_code == 200
        assert "Copy" in r.json()["name"]

    def test_list_schedules(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/schedules")
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_create_schedule(self, test_client):
        payload = {
            "workflow_id": "wf-test",
            "workflow_name": "Test",
            "cron": "0 12 * * *",
        }
        r = test_client.post("/api/ui2/workflow-depth/schedules", json=payload)
        assert r.status_code == 200
        assert r.json()["status"] == "active"

    def test_toggle_schedule(self, test_client):
        r = test_client.post("/api/ui2/workflow-depth/schedules/job-001/toggle")
        assert r.status_code == 200

    def test_list_runs(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/runs")
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_trigger_run(self, test_client):
        r = test_client.post("/api/ui2/workflow-depth/runs/wf-daily-export/trigger")
        assert r.status_code == 200
        assert r.json()["status"] == "success"

    def test_export_audit(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/audit/wf-daily-export")
        assert r.status_code == 200
        data = r.json()
        assert "hash" in data
        assert len(data["run_records"]) >= 1

    def test_hash_endpoint(self, test_client):
        r = test_client.get("/api/ui2/workflow-depth/hash")
        assert r.status_code == 200


class TestSearchDepthRoutes:
    """Tests for /api/ui2/search-depth endpoints."""

    def test_provider_status(self, test_client):
        r = test_client.get("/api/ui2/search-depth/provider-status")
        assert r.status_code == 200
        data = r.json()
        assert data["active_backend"] == "local"
        assert data["health"] == "green"
        assert data["is_reachable"] is True
        assert data["doc_count"] == 226  # 156 + 42 + 28

    def test_mappings(self, test_client):
        r = test_client.get("/api/ui2/search-depth/mappings")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3
        names = [m["index_name"] for m in data]
        assert "apex-orders" in names

    def test_explain(self, test_client):
        r = test_client.get("/api/ui2/search-depth/explain?doc_id=doc-001&query=AAPL")
        assert r.status_code == 200
        data = r.json()
        assert len(data["factors"]) == 4
        assert data["total_score"] > 0
        assert data["backend"] == "local"

    def test_explain_deterministic(self, test_client):
        params = "?doc_id=doc-xyz&query=momentum"
        r1 = test_client.get(f"/api/ui2/search-depth/explain{params}")
        r2 = test_client.get(f"/api/ui2/search-depth/explain{params}")
        assert r1.json()["explain_hash"] == r2.json()["explain_hash"]

    def test_config(self, test_client):
        r = test_client.get("/api/ui2/search-depth/config")
        assert r.status_code == 200
        data = r.json()
        assert data["provider"] == "local"
        assert data["elastic_configured"] is False

    def test_hash_endpoint(self, test_client):
        r = test_client.get("/api/ui2/search-depth/hash")
        assert r.status_code == 200
        assert "hash" in r.json()
