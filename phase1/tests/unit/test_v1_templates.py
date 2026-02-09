"""
Tests for V1 Strategy Templates and Execution Simulator

Tests determinism, parameter validation, and execution simulation.
"""

import pytest
from datetime import datetime

from services.autopilot.v1_templates import (
    Regime, IVLevel,
    PUT_CREDIT_SPREAD_V1, CALL_CREDIT_SPREAD_V1, IRON_CONDOR_V1,
    CALL_DEBIT_SPREAD_V1, PUT_DEBIT_SPREAD_V1,
    get_template_bounds, get_width_bounds, validate_candidate_against_template,
    check_liquidity_gate, LiquidityGates, ETF_SYMBOLS,
)
from services.autopilot.execution_simulator import (
    DeterministicExecutionSimulator, ComboOrder, LegQuote,
    FillStatus, TimeBucket,
)
from services.autopilot.research_reports import (
    TradeRecord, ResearchReportGenerator, PortfolioMetrics,
)


class TestV1Templates:
    """Tests for V1 strategy template definitions."""
    
    def test_all_templates_defined(self):
        """Verify all 5 templates are defined."""
        assert get_template_bounds("put_credit_spread") is not None
        assert get_template_bounds("call_credit_spread") is not None
        assert get_template_bounds("iron_condor") is not None
        assert get_template_bounds("call_debit_spread") is not None
        assert get_template_bounds("put_debit_spread") is not None
    
    def test_pcs_bounds(self):
        """Test Put Credit Spread parameter bounds."""
        pcs = PUT_CREDIT_SPREAD_V1
        
        assert pcs.min_dte == 21
        assert pcs.max_dte == 45
        assert pcs.min_short_delta == 0.15
        assert pcs.max_short_delta == 0.30
        assert pcs.min_credit_ratio == 0.20
        assert Regime.TREND_UP in pcs.suitable_regimes
        assert Regime.RANGE in pcs.suitable_regimes
    
    def test_iron_condor_bounds(self):
        """Test Iron Condor has stricter constraints."""
        ic = IRON_CONDOR_V1
        
        assert ic.min_dte == 30  # Longer than spreads
        assert ic.max_dte == 60
        assert ic.min_short_delta == 0.10  # Wider deltas
        assert ic.exit_rules.time_stop_dte == 14  # Longer time stop
        assert Regime.CHAOS not in ic.suitable_regimes
    
    def test_debit_spread_bounds(self):
        """Test debit spreads have max_debit_ratio instead of min_credit."""
        cds = CALL_DEBIT_SPREAD_V1
        
        assert cds.max_debit_ratio == 0.65
        assert cds.min_credit_ratio is None
        assert Regime.TREND_UP in cds.suitable_regimes
    
    def test_width_by_price(self):
        """Test width bounds by underlying price."""
        pcs = PUT_CREDIT_SPREAD_V1
        
        # Under $50
        min_w, max_w = get_width_bounds(pcs, 45.0)
        assert min_w == 1.0
        assert max_w == 2.0
        
        # $50-$200
        min_w, max_w = get_width_bounds(pcs, 150.0)
        assert min_w == 2.0
        assert max_w == 5.0
        
        # Over $200
        min_w, max_w = get_width_bounds(pcs, 450.0)
        assert min_w == 5.0
        assert max_w == 10.0


class TestCandidateValidation:
    """Tests for candidate validation against templates."""
    
    def test_valid_pcs_candidate(self):
        """Valid PCS candidate passes validation."""
        is_valid, reasons = validate_candidate_against_template(
            template_name="put_credit_spread",
            dte=30,
            short_delta=0.22,
            width=3.0,
            credit_or_debit=0.75,  # 0.25 × 3.0 = 0.75 > min
            underlying_price=150.0,
        )
        
        assert is_valid
        assert len(reasons) == 0
    
    def test_reject_low_dte(self):
        """Reject candidate with DTE below minimum."""
        is_valid, reasons = validate_candidate_against_template(
            template_name="put_credit_spread",
            dte=15,  # Below 21
            short_delta=0.22,
            width=3.0,
            credit_or_debit=0.75,
            underlying_price=150.0,
        )
        
        assert not is_valid
        assert any("DTE" in r for r in reasons)
    
    def test_reject_high_delta(self):
        """Reject candidate with delta above maximum."""
        is_valid, reasons = validate_candidate_against_template(
            template_name="put_credit_spread",
            dte=30,
            short_delta=0.40,  # Above 0.30
            width=3.0,
            credit_or_debit=0.75,
            underlying_price=150.0,
        )
        
        assert not is_valid
        assert any("Delta" in r for r in reasons)
    
    def test_reject_low_credit(self):
        """Reject candidate with credit below minimum ratio."""
        is_valid, reasons = validate_candidate_against_template(
            template_name="put_credit_spread",
            dte=30,
            short_delta=0.22,
            width=5.0,
            credit_or_debit=0.50,  # 0.10 × 5.0 < 0.20 × 5.0
            underlying_price=150.0,
        )
        
        assert not is_valid
        assert any("Credit" in r for r in reasons)


class TestLiquidityGates:
    """Tests for liquidity gate checks."""
    
    def test_etf_passes_with_wide_spread(self):
        """ETFs have looser spread requirements."""
        passes, reason = check_liquidity_gate(
            symbol="SPY",
            bid=5.00,
            ask=5.10,  # 2% spread
            open_interest=500,
        )
        
        assert passes
        assert reason is None
    
    def test_stock_fails_with_wide_spread(self):
        """Stocks have stricter spread requirements."""
        passes, reason = check_liquidity_gate(
            symbol="AAPL",
            bid=5.00,
            ask=5.20,  # 4% spread
            open_interest=500,
        )
        
        assert not passes
        assert "Spread" in reason
    
    def test_low_oi_fails(self):
        """Low open interest is rejected."""
        passes, reason = check_liquidity_gate(
            symbol="AAPL",
            bid=5.00,
            ask=5.05,
            open_interest=50,  # Below 200
        )
        
        assert not passes
        assert "OI" in reason
    
    def test_etf_lower_oi_allowed(self):
        """ETFs allow lower OI."""
        passes, reason = check_liquidity_gate(
            symbol="QQQ",
            bid=5.00,
            ask=5.05,
            open_interest=120,  # Above 100 for ETFs
        )
        
        assert passes


class TestExecutionSimulator:
    """Tests for deterministic execution simulator."""
    
    def test_deterministic_fill(self):
        """Same order ID produces same result."""
        sim = DeterministicExecutionSimulator(seed_base="test")
        
        combo = ComboOrder(
            order_id="order-123",
            legs=[
                LegQuote(symbol="AAPL", bid=5.00, ask=5.10, open_interest=500),
                LegQuote(symbol="AAPL", bid=2.00, ask=2.05, open_interest=500),
            ],
            is_credit=True,
            limit_price=3.05,
        )
        
        result1 = sim.simulate_fill(combo)
        
        # Reset and try again
        sim2 = DeterministicExecutionSimulator(seed_base="test")
        combo2 = ComboOrder(
            order_id="order-123",
            legs=[
                LegQuote(symbol="AAPL", bid=5.00, ask=5.10, open_interest=500),
                LegQuote(symbol="AAPL", bid=2.00, ask=2.05, open_interest=500),
            ],
            is_credit=True,
            limit_price=3.05,
        )
        
        result2 = sim2.simulate_fill(combo2)
        
        assert result1.status == result2.status
        assert result1.fill_price == result2.fill_price
    
    def test_fill_probability_tight_spread(self):
        """Tight spreads have high fill probability."""
        sim = DeterministicExecutionSimulator()
        
        combo = ComboOrder(
            order_id="tight-spread",
            legs=[
                LegQuote(symbol="SPY", bid=5.00, ask=5.02, is_etf=True),  # 0.4%
            ],
            is_credit=True,
            limit_price=5.01,
        )
        
        prob = sim.calculate_fill_probability(combo)
        assert prob >= 0.75  # High probability
    
    def test_fill_probability_wide_spread(self):
        """Wide spreads have low fill probability."""
        sim = DeterministicExecutionSimulator()
        
        combo = ComboOrder(
            order_id="wide-spread",
            legs=[
                LegQuote(symbol="TSLA", bid=5.00, ask=5.50),  # 10%
            ],
            is_credit=True,
            limit_price=5.25,
        )
        
        prob = sim.calculate_fill_probability(combo)
        assert prob <= 0.30  # Low probability
    
    def test_slippage_increases_with_attempts(self):
        """Later attempts have more slippage."""
        sim = DeterministicExecutionSimulator()
        
        slip1 = sim.calculate_slippage_fraction(attempt=1, is_etf=False)
        slip2 = sim.calculate_slippage_fraction(attempt=2, is_etf=False)
        slip3 = sim.calculate_slippage_fraction(attempt=3, is_etf=False)
        
        assert slip1 < slip2 < slip3
    
    def test_etf_better_slippage(self):
        """ETFs get better slippage."""
        sim = DeterministicExecutionSimulator()
        
        slip_stock = sim.calculate_slippage_fraction(attempt=2, is_etf=False)
        slip_etf = sim.calculate_slippage_fraction(attempt=2, is_etf=True)
        
        assert slip_etf < slip_stock


class TestResearchReports:
    """Tests for research report generation."""
    
    def test_portfolio_metrics_empty(self):
        """Empty trades produce zero metrics."""
        report = ResearchReportGenerator(trades=[])
        metrics = report.generate_portfolio_report()
        
        assert metrics.total_trades == 0
        assert metrics.win_rate == 0
    
    def test_portfolio_metrics_winners(self):
        """All winners produce 100% win rate."""
        trades = [
            TradeRecord(
                trade_id="1", template="pcs", symbol="AAPL", regime="range",
                entry_time=datetime(2024, 1, 1),
                exit_time=datetime(2024, 1, 10),
                entry_price=1.00, exit_price=0.50, pnl=50.0,
                max_profit=100.0, max_loss=-100.0,
            ),
            TradeRecord(
                trade_id="2", template="pcs", symbol="MSFT", regime="range",
                entry_time=datetime(2024, 1, 5),
                exit_time=datetime(2024, 1, 15),
                entry_price=1.50, exit_price=0.75, pnl=75.0,
                max_profit=150.0, max_loss=-150.0,
            ),
        ]
        
        report = ResearchReportGenerator(trades=trades)
        metrics = report.generate_portfolio_report()
        
        assert metrics.total_trades == 2
        assert metrics.win_rate == 1.0
        assert metrics.total_return == 125.0
    
    def test_template_attribution(self):
        """Template attribution groups by template."""
        trades = [
            TradeRecord(
                trade_id="1", template="put_credit_spread", symbol="AAPL", 
                regime="range", entry_time=datetime(2024, 1, 1),
                exit_time=datetime(2024, 1, 10),
                entry_price=1.00, exit_price=0.50, pnl=50.0,
            ),
            TradeRecord(
                trade_id="2", template="iron_condor", symbol="SPY", 
                regime="range", entry_time=datetime(2024, 1, 5),
                exit_time=datetime(2024, 1, 15),
                entry_price=2.00, exit_price=0.80, pnl=120.0,
            ),
        ]
        
        report = ResearchReportGenerator(trades=trades)
        attribution = report.generate_template_attribution()
        
        assert "put_credit_spread" in attribution
        assert "iron_condor" in attribution
        assert attribution["put_credit_spread"].trade_count == 1
        assert attribution["iron_condor"].trade_count == 1
    
    def test_report_json_export(self):
        """Report exports to JSON format."""
        trades = [
            TradeRecord(
                trade_id="1", template="pcs", symbol="AAPL", regime="range",
                entry_time=datetime(2024, 1, 1),
                exit_time=datetime(2024, 1, 10),
                entry_price=1.00, exit_price=0.50, pnl=50.0,
            ),
        ]
        
        report = ResearchReportGenerator(trades=trades)
        json_data = report.to_json()
        
        assert "portfolio" in json_data
        assert "template_attribution" in json_data
        assert "regime_attribution" in json_data
        assert "parameter_sweep" in json_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
