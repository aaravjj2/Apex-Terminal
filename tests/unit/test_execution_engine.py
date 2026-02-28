"""
Tests for execution_engine.py
==============================
Covers: SlippageModel, TransactionCostModel, ExecutionAlgo, ExecutionSlice,
        AlgoExecution, ExecutionSimulator, ExecutionAnalyzer, ExecutionEngine.
"""

import time
import pytest
import numpy as np
from phase1.services.execution_engine import (
    AlgoType, ExecutionStatus, CostComponent,
    ExecutionSlice, AlgoExecution,
    SlippageModel, TransactionCostModel,
    ExecutionAlgo, ExecutionSimulator, ExecutionAnalyzer,
    ExecutionEngine,
)


# ═══════════════════════════════════════════════════════════════════════════════
# ExecutionSlice
# ═══════════════════════════════════════════════════════════════════════════════

class TestExecutionSlice:
    def test_notional(self):
        s = ExecutionSlice(quantity=100, price=50.0)
        assert s.notional == 5000.0

    def test_to_dict(self):
        s = ExecutionSlice(quantity=50, price=100.0, slippage_bps=2.5)
        d = s.to_dict()
        assert d["quantity"] == 50
        assert d["slippage_bps"] == 2.5


# ═══════════════════════════════════════════════════════════════════════════════
# AlgoExecution
# ═══════════════════════════════════════════════════════════════════════════════

class TestAlgoExecution:
    def test_creation(self):
        e = AlgoExecution(symbol="AAPL", side="buy", total_quantity=1000)
        assert e.remaining_quantity == 1000
        assert e.fill_ratio == 0

    def test_add_slice(self):
        e = AlgoExecution(symbol="AAPL", total_quantity=100,
                          status=ExecutionStatus.RUNNING)
        e.add_slice(ExecutionSlice(quantity=50, price=150.0))
        assert e.filled_quantity == 50
        assert e.remaining_quantity == 50

    def test_completes_on_full_fill(self):
        e = AlgoExecution(symbol="AAPL", total_quantity=100,
                          status=ExecutionStatus.RUNNING)
        e.add_slice(ExecutionSlice(quantity=100, price=150.0))
        assert e.status == ExecutionStatus.COMPLETED

    def test_implementation_shortfall_buy(self):
        e = AlgoExecution(symbol="AAPL", side="buy", total_quantity=100,
                          arrival_price=150.0, avg_price=151.5)
        e.filled_quantity = 100
        assert e.implementation_shortfall_bps > 0

    def test_implementation_shortfall_sell(self):
        e = AlgoExecution(symbol="AAPL", side="sell", total_quantity=100,
                          arrival_price=150.0, avg_price=148.5)
        e.filled_quantity = 100
        assert e.implementation_shortfall_bps > 0

    def test_to_dict(self):
        e = AlgoExecution(symbol="MSFT", algo_type=AlgoType.VWAP,
                          total_quantity=500)
        d = e.to_dict()
        assert d["algo_type"] == "vwap"
        assert d["symbol"] == "MSFT"

    def test_is_active(self):
        e = AlgoExecution(status=ExecutionStatus.RUNNING)
        assert e.is_active is True
        e.status = ExecutionStatus.COMPLETED
        assert e.is_active is False


# ═══════════════════════════════════════════════════════════════════════════════
# SlippageModel
# ═══════════════════════════════════════════════════════════════════════════════

class TestSlippageModel:
    def test_linear_impact(self):
        impact = SlippageModel.linear_impact(10000, 1_000_000)
        assert impact > 0
        assert impact < 1.0

    def test_linear_impact_zero_adv(self):
        assert SlippageModel.linear_impact(100, 0) == 0.0

    def test_square_root_impact(self):
        impact = SlippageModel.square_root_impact(10000, 1_000_000, 0.02)
        assert impact > 0

    def test_almgren_chriss(self):
        result = SlippageModel.almgren_chriss(10000, 1_000_000, 0.02)
        assert "schedule" in result
        assert len(result["schedule"]) == 10
        assert result["expected_cost_bps"] > 0

    def test_almgren_chriss_zero_adv(self):
        result = SlippageModel.almgren_chriss(100, 0)
        assert result["expected_cost"] == 0

    def test_estimate_slippage(self):
        result = SlippageModel.estimate_slippage(
            price=150.0, quantity=10000, adv=1_000_000)
        assert result["total_slippage_bps"] > 0
        assert result["total_cost_dollars"] > 0

    def test_larger_order_more_impact(self):
        small = SlippageModel.linear_impact(100, 1_000_000)
        large = SlippageModel.linear_impact(100000, 1_000_000)
        assert large > small


# ═══════════════════════════════════════════════════════════════════════════════
# TransactionCostModel
# ═══════════════════════════════════════════════════════════════════════════════

class TestTransactionCostModel:
    def setup_method(self):
        self.cost = TransactionCostModel()

    def test_commission(self):
        c = self.cost.commission(100)
        assert c >= self.cost.min_commission

    def test_min_commission(self):
        c = self.cost.commission(1)
        assert c == self.cost.min_commission

    def test_regulatory_fees_sell(self):
        fees = self.cost.regulatory_fees(1000, 150.0, "sell")
        assert fees > 0

    def test_regulatory_fees_buy(self):
        fees = self.cost.regulatory_fees(1000, 150.0, "buy")
        assert fees == 0.0

    def test_spread_cost(self):
        cost = self.cost.spread_cost(100, 149.90, 150.10)
        assert abs(cost - 100 * 0.10) < 0.01

    def test_total_cost(self):
        result = self.cost.total_cost(100, 150.0, "buy", 149.95, 150.05)
        assert result["total"] > 0
        assert result["per_share"] > 0
        assert result["bps"] > 0

    def test_total_cost_sell(self):
        result = self.cost.total_cost(100, 150.0, "sell")
        assert result["regulatory_fees"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
# ExecutionAlgo
# ═══════════════════════════════════════════════════════════════════════════════

class TestExecutionAlgo:
    def test_twap_schedule(self):
        schedule = ExecutionAlgo.twap_schedule(1000, 10, 3600)
        assert len(schedule) == 10
        total_qty = sum(s["quantity"] for s in schedule)
        assert total_qty == 1000

    def test_twap_zero_slices(self):
        assert ExecutionAlgo.twap_schedule(1000, 0, 3600) == []

    def test_vwap_schedule(self):
        schedule = ExecutionAlgo.vwap_schedule(1000, 10)
        assert len(schedule) == 10
        total_qty = sum(s["quantity"] for s in schedule)
        assert total_qty == 1000

    def test_vwap_custom_profile(self):
        profile = [1, 2, 3, 4, 5, 4, 3, 2, 1, 2]
        schedule = ExecutionAlgo.vwap_schedule(1000, 10, profile)
        assert len(schedule) == 10

    def test_iceberg_schedule(self):
        schedule = ExecutionAlgo.iceberg_schedule(1000, 100)
        assert len(schedule) == 10
        total_qty = sum(s["quantity"] for s in schedule)
        assert total_qty == 1000

    def test_iceberg_zero_display(self):
        assert ExecutionAlgo.iceberg_schedule(1000, 0) == []

    def test_pov_schedule(self):
        volumes = [100000, 150000, 120000, 200000]
        schedule = ExecutionAlgo.pov_schedule(5000, volumes, 0.10)
        assert len(schedule) > 0
        for s in schedule:
            assert s["participation_rate"] <= 0.10 + 0.001

    def test_adaptive_urgent(self):
        schedule = ExecutionAlgo.adaptive_schedule(1000, 10, urgency=0.9)
        assert len(schedule) == 10
        # Front-loaded: first slice should be larger
        assert schedule[0]["quantity"] >= schedule[-1]["quantity"]

    def test_adaptive_patient(self):
        schedule = ExecutionAlgo.adaptive_schedule(1000, 10, urgency=0.1)
        assert len(schedule) == 10
        # Back-loaded: last slice should be larger
        assert schedule[-1]["quantity"] >= schedule[0]["quantity"]

    def test_adaptive_zero_slices(self):
        assert ExecutionAlgo.adaptive_schedule(1000, 0) == []


# ═══════════════════════════════════════════════════════════════════════════════
# ExecutionSimulator
# ═══════════════════════════════════════════════════════════════════════════════

class TestExecutionSimulator:
    def setup_method(self):
        self.sim = ExecutionSimulator()
        np.random.seed(42)

    def test_simulate_twap(self):
        exec_ = self.sim.simulate_twap("AAPL", "buy", 1000, 150.0,
                                        num_slices=5)
        assert exec_.status == ExecutionStatus.COMPLETED
        assert exec_.filled_quantity == 1000
        assert len(exec_.slices) == 5

    def test_simulate_vwap(self):
        exec_ = self.sim.simulate_vwap("AAPL", "buy", 1000, 150.0,
                                        num_slices=5)
        assert exec_.status == ExecutionStatus.COMPLETED
        assert exec_.filled_quantity == 1000

    def test_simulate_iceberg(self):
        exec_ = self.sim.simulate_iceberg("AAPL", "buy", 500, 150.0,
                                           display_size=100)
        assert exec_.status == ExecutionStatus.COMPLETED
        assert exec_.filled_quantity == 500

    def test_twap_sell(self):
        exec_ = self.sim.simulate_twap("AAPL", "sell", 500, 150.0,
                                        num_slices=5)
        assert exec_.filled_quantity == 500
        assert exec_.side == "sell"


# ═══════════════════════════════════════════════════════════════════════════════
# ExecutionAnalyzer
# ═══════════════════════════════════════════════════════════════════════════════

class TestExecutionAnalyzer:
    def _make_execution(self):
        e = AlgoExecution(symbol="AAPL", side="buy", total_quantity=100,
                          arrival_price=150.0, status=ExecutionStatus.RUNNING)
        e.add_slice(ExecutionSlice(quantity=50, price=150.5, commission=1.0))
        e.add_slice(ExecutionSlice(quantity=50, price=151.0, commission=1.0))
        return e

    def test_implementation_shortfall(self):
        e = self._make_execution()
        result = ExecutionAnalyzer.implementation_shortfall(e)
        assert result["total_bps"] > 0  # bought above arrival

    def test_shortfall_zero_prices(self):
        e = AlgoExecution(arrival_price=0, avg_price=0)
        result = ExecutionAnalyzer.implementation_shortfall(e)
        assert result["total_bps"] == 0

    def test_vwap_comparison(self):
        e = self._make_execution()
        result = ExecutionAnalyzer.vwap_comparison(e, 150.0)
        assert "vs_vwap_bps" in result

    def test_vwap_comparison_zero(self):
        e = self._make_execution()
        result = ExecutionAnalyzer.vwap_comparison(e, 0)
        assert result["vs_vwap_bps"] == 0

    def test_participation(self):
        e = self._make_execution()
        result = ExecutionAnalyzer.participation_analysis(e, 10000)
        assert result["participation_rate"] == 100 / 10000

    def test_execution_profile(self):
        e = self._make_execution()
        result = ExecutionAnalyzer.execution_profile(e)
        assert result["num_slices"] == 2
        assert result["avg_slippage_bps"] >= 0

    def test_profile_no_slices(self):
        e = AlgoExecution()
        result = ExecutionAnalyzer.execution_profile(e)
        assert result["num_slices"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# ExecutionEngine (orchestrator)
# ═══════════════════════════════════════════════════════════════════════════════

class TestExecutionEngine:
    def setup_method(self):
        self.engine = ExecutionEngine()
        np.random.seed(42)

    def test_generate_twap(self):
        sched = self.engine.generate_twap(1000, 10, 3600)
        assert len(sched) == 10

    def test_generate_vwap(self):
        sched = self.engine.generate_vwap(1000, 8)
        assert len(sched) == 8

    def test_generate_iceberg(self):
        sched = self.engine.generate_iceberg(500, 50)
        assert len(sched) == 10

    def test_generate_pov(self):
        sched = self.engine.generate_pov(5000, [100000, 200000, 150000])
        assert len(sched) > 0

    def test_generate_adaptive(self):
        sched = self.engine.generate_adaptive(1000, 10, 0.7)
        assert len(sched) == 10

    def test_simulate_twap(self):
        e = self.engine.simulate_twap("AAPL", "buy", 500, 150.0, num_slices=5)
        assert e.filled_quantity == 500
        assert e.execution_id in [ex.execution_id for ex in
                                    self.engine.get_all_executions()]

    def test_simulate_vwap(self):
        e = self.engine.simulate_vwap("AAPL", "buy", 500, 150.0, num_slices=5)
        assert e.filled_quantity == 500

    def test_simulate_iceberg(self):
        e = self.engine.simulate_iceberg("AAPL", "buy", 300, 150.0,
                                          display_size=100)
        assert e.filled_quantity == 300

    def test_analyze_execution(self):
        e = self.engine.simulate_twap("AAPL", "buy", 500, 150.0, num_slices=5)
        result = self.engine.analyze_execution(e.execution_id)
        assert "shortfall" in result
        assert "profile" in result

    def test_analyze_nonexistent(self):
        result = self.engine.analyze_execution("fake")
        assert "error" in result

    def test_compare_vwap(self):
        e = self.engine.simulate_vwap("AAPL", "buy", 500, 150.0)
        result = self.engine.compare_vwap(e.execution_id, 150.0)
        assert "vs_vwap_bps" in result

    def test_estimate_slippage(self):
        result = self.engine.estimate_slippage(150.0, 10000, 1_000_000)
        assert result["total_slippage_bps"] > 0

    def test_estimate_cost(self):
        result = self.engine.estimate_cost(100, 150.0, "buy", 149.95, 150.05)
        assert result["total"] > 0

    def test_get_active_executions(self):
        e = self.engine.simulate_twap("AAPL", "buy", 500, 150.0)
        # All simulated executions should be completed
        assert len(self.engine.get_active_executions()) == 0

    def test_capabilities(self):
        caps = self.engine.capabilities()
        assert "twap" in caps["algos"]
        assert "slippage_modeling" in caps["features"]
