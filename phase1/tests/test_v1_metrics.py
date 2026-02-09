"""
Tests for V1 Evaluation Metrics
===============================
Phase 6: Metrics calculation and evaluation tests.
"""

import pytest
from datetime import datetime, timedelta
from services.autopilot.v1_metrics import (
    ExitReason, TradeRecord, SessionMetrics, MetricsTracker,
    BacktestEvaluator, calculate_kelly_fraction, calculate_var,
)


# =============================================================================
# TRADE RECORD TESTS
# =============================================================================

class TestTradeRecord:
    """Tests for TradeRecord data model."""
    
    def test_trade_record_creation(self):
        """Can create trade record."""
        trade = TradeRecord(
            trade_id="TEST-001",
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            template="long_call",
            entry_time=datetime(2025, 1, 10, 9, 30, 0),
            exit_time=datetime(2025, 1, 10, 10, 15, 0),
            entry_price=5.00,
            exit_price=5.50,
            qty=1,
            exit_reason=ExitReason.TAKE_PROFIT,
            pnl=50.0,
            pnl_pct=0.10,
            hold_time_minutes=45.0,
        )
        assert trade.trade_id == "TEST-001"
        assert trade.pnl == 50.0
    
    def test_trade_record_to_dict(self):
        """Trade record serializes to dict."""
        trade = TradeRecord(
            trade_id="TEST-001",
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            template="long_call",
            entry_time=datetime(2025, 1, 10, 9, 30, 0),
            exit_time=datetime(2025, 1, 10, 10, 15, 0),
            entry_price=5.00,
            exit_price=5.50,
            qty=1,
            exit_reason=ExitReason.TAKE_PROFIT,
            pnl=50.0,
            pnl_pct=0.10,
            hold_time_minutes=45.0,
        )
        d = trade.to_dict()
        assert d["trade_id"] == "TEST-001"
        assert d["exit_reason"] == "take_profit"
        assert d["pnl"] == 50.0


# =============================================================================
# SESSION METRICS TESTS
# =============================================================================

class TestSessionMetrics:
    """Tests for SessionMetrics."""
    
    @pytest.fixture
    def basic_metrics(self):
        """Create basic metrics for testing."""
        return SessionMetrics(
            session_id="TEST-SESSION",
            start_time=datetime.utcnow(),
            starting_equity=10000.0,
            ending_equity=10500.0,
            realized_pnl=500.0,
            total_trades=10,
            winning_trades=6,
            losing_trades=3,
            scratch_trades=1,
            total_gross_profit=800.0,
            total_gross_loss=-300.0,
            largest_win=200.0,
            largest_loss=-100.0,
        )
    
    def test_win_rate(self, basic_metrics):
        """Win rate calculated correctly."""
        assert basic_metrics.win_rate == 0.6
    
    def test_loss_rate(self, basic_metrics):
        """Loss rate calculated correctly."""
        assert basic_metrics.loss_rate == 0.3
    
    def test_avg_win(self, basic_metrics):
        """Average win calculated correctly."""
        assert pytest.approx(basic_metrics.avg_win, rel=1e-3) == 133.33
    
    def test_avg_loss(self, basic_metrics):
        """Average loss calculated correctly."""
        assert basic_metrics.avg_loss == -100.0
    
    def test_profit_factor(self, basic_metrics):
        """Profit factor calculated correctly."""
        # 800 / 300 = 2.666...
        assert pytest.approx(basic_metrics.profit_factor, rel=1e-2) == 2.666
    
    def test_expectancy(self, basic_metrics):
        """Expectancy calculated correctly."""
        assert basic_metrics.expectancy == 50.0
    
    def test_net_return_pct(self, basic_metrics):
        """Net return percent calculated correctly."""
        assert basic_metrics.net_return_pct == 0.05
    
    def test_risk_reward_ratio(self, basic_metrics):
        """Risk/reward ratio calculated correctly."""
        # avg_win (133.33) / |avg_loss| (100) = 1.333...
        assert pytest.approx(basic_metrics.risk_reward_ratio, rel=1e-2) == 1.333
    
    def test_win_rate_zero_trades(self):
        """Win rate is 0 when no trades."""
        metrics = SessionMetrics(
            session_id="TEST",
            start_time=datetime.utcnow(),
            total_trades=0,
        )
        assert metrics.win_rate == 0.0
    
    def test_profit_factor_zero_loss(self):
        """Profit factor is inf when no losses."""
        metrics = SessionMetrics(
            session_id="TEST",
            start_time=datetime.utcnow(),
            total_trades=5,
            winning_trades=5,
            total_gross_profit=500.0,
            total_gross_loss=0.0,
        )
        assert metrics.profit_factor == float('inf')
    
    def test_to_dict(self, basic_metrics):
        """Metrics serialize to dict correctly."""
        d = basic_metrics.to_dict()
        assert d["session_id"] == "TEST-SESSION"
        assert d["win_rate"] == 0.6
        assert d["profit_factor"] == pytest.approx(2.67, rel=1e-2)


# =============================================================================
# METRICS TRACKER TESTS
# =============================================================================

class TestMetricsTracker:
    """Tests for MetricsTracker."""
    
    @pytest.fixture
    def tracker(self):
        return MetricsTracker("TEST-SESSION", starting_equity=10000.0)
    
    def test_initial_state(self, tracker):
        """Tracker starts with correct state."""
        assert tracker.metrics.starting_equity == 10000.0
        assert tracker.metrics.ending_equity == 10000.0
        assert tracker.metrics.total_trades == 0
    
    def test_record_winning_trade(self, tracker):
        """Records winning trade correctly."""
        trade = TradeRecord(
            trade_id="T-001",
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            template="long_call",
            entry_time=datetime.utcnow(),
            exit_time=datetime.utcnow(),
            entry_price=5.00,
            exit_price=5.50,
            qty=1,
            exit_reason=ExitReason.TAKE_PROFIT,
            pnl=50.0,
            pnl_pct=0.10,
            hold_time_minutes=45.0,
        )
        tracker.record_trade(trade)
        
        assert tracker.metrics.total_trades == 1
        assert tracker.metrics.winning_trades == 1
        assert tracker.metrics.losing_trades == 0
        assert tracker.metrics.realized_pnl == 50.0
        assert tracker.metrics.total_gross_profit == 50.0
    
    def test_record_losing_trade(self, tracker):
        """Records losing trade correctly."""
        trade = TradeRecord(
            trade_id="T-001",
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            template="long_call",
            entry_time=datetime.utcnow(),
            exit_time=datetime.utcnow(),
            entry_price=5.00,
            exit_price=4.50,
            qty=1,
            exit_reason=ExitReason.STOP_LOSS,
            pnl=-50.0,
            pnl_pct=-0.10,
            hold_time_minutes=15.0,
        )
        tracker.record_trade(trade)
        
        assert tracker.metrics.total_trades == 1
        assert tracker.metrics.winning_trades == 0
        assert tracker.metrics.losing_trades == 1
        assert tracker.metrics.stopouts == 1
        assert tracker.metrics.realized_pnl == -50.0
        assert tracker.metrics.total_gross_loss == -50.0
    
    def test_record_scratch_trade(self, tracker):
        """Records scratch trade correctly."""
        trade = TradeRecord(
            trade_id="T-001",
            symbol="AAPL250117C00200000",
            underlying="AAPL",
            template="long_call",
            entry_time=datetime.utcnow(),
            exit_time=datetime.utcnow(),
            entry_price=5.00,
            exit_price=5.00,
            qty=1,
            exit_reason=ExitReason.MANUAL,
            pnl=0.0,
            pnl_pct=0.0,
            hold_time_minutes=30.0,
        )
        tracker.record_trade(trade)
        
        assert tracker.metrics.scratch_trades == 1
    
    def test_drawdown_tracking(self, tracker):
        """Tracks drawdown correctly."""
        # Win first
        win = TradeRecord(
            trade_id="T-001",
            symbol="A",
            underlying="A",
            template="long_call",
            entry_time=datetime.utcnow(),
            exit_time=datetime.utcnow(),
            entry_price=5.00,
            exit_price=6.00,
            qty=1,
            exit_reason=ExitReason.TAKE_PROFIT,
            pnl=100.0,
            pnl_pct=0.20,
            hold_time_minutes=30.0,
        )
        tracker.record_trade(win)
        
        # Then lose
        loss = TradeRecord(
            trade_id="T-002",
            symbol="B",
            underlying="B",
            template="long_call",
            entry_time=datetime.utcnow(),
            exit_time=datetime.utcnow(),
            entry_price=5.00,
            exit_price=4.00,
            qty=1,
            exit_reason=ExitReason.STOP_LOSS,
            pnl=-100.0,
            pnl_pct=-0.20,
            hold_time_minutes=15.0,
        )
        tracker.record_trade(loss)
        
        # Max equity was 10100, current is 10000
        # Drawdown = (10100 - 10000) / 10100 ≈ 0.99%
        assert tracker.metrics.max_equity == 10100.0
        assert pytest.approx(tracker.metrics.max_drawdown_pct, rel=1e-2) == 0.0099
    
    def test_circuit_breaker_recording(self, tracker):
        """Records circuit breaker triggers."""
        tracker.record_circuit_breaker()
        tracker.record_circuit_breaker()
        assert tracker.metrics.circuit_breaker_triggers == 2
    
    def test_anti_thrash_rejection_recording(self, tracker):
        """Records anti-thrash rejections."""
        tracker.record_anti_thrash_rejection()
        assert tracker.metrics.anti_thrash_rejections == 1
    
    def test_position_count_tracking(self, tracker):
        """Tracks max concurrent positions."""
        tracker.update_position_count(3)
        tracker.update_position_count(5)
        tracker.update_position_count(2)
        assert tracker.metrics.max_concurrent_positions == 5
    
    def test_exposure_tracking(self, tracker):
        """Tracks max exposure."""
        tracker.update_exposure(500.0)
        tracker.update_exposure(800.0)
        tracker.update_exposure(600.0)
        assert tracker.metrics.max_exposure_used == 800.0
    
    def test_finalize(self, tracker):
        """Finalizes metrics correctly."""
        trade = TradeRecord(
            trade_id="T-001",
            symbol="A",
            underlying="A",
            template="long_call",
            entry_time=datetime.utcnow(),
            exit_time=datetime.utcnow(),
            entry_price=5.00,
            exit_price=5.50,
            qty=1,
            exit_reason=ExitReason.TAKE_PROFIT,
            pnl=50.0,
            pnl_pct=0.10,
            hold_time_minutes=30.0,
            execution_slippage_pct=0.005,
        )
        tracker.record_trade(trade)
        
        metrics = tracker.finalize()
        assert metrics.end_time is not None
        assert metrics.duration_minutes >= 0
        assert metrics.avg_slippage_pct == 0.005
    
    def test_generate_trade_id(self, tracker):
        """Generates unique trade IDs."""
        id1 = tracker.generate_trade_id()
        id2 = tracker.generate_trade_id()
        assert id1 != id2
        assert "TEST-SESSION" in id1
    
    def test_equity_curve(self, tracker):
        """Maintains equity curve."""
        win = TradeRecord(
            trade_id="T-001",
            symbol="A",
            underlying="A",
            template="long_call",
            entry_time=datetime.utcnow(),
            exit_time=datetime.utcnow(),
            entry_price=5.00,
            exit_price=5.50,
            qty=1,
            exit_reason=ExitReason.TAKE_PROFIT,
            pnl=50.0,
            pnl_pct=0.10,
            hold_time_minutes=30.0,
        )
        tracker.record_trade(win)
        
        curve = tracker.equity_curve
        assert len(curve) >= 2  # Initial + after trade
        assert curve[-1][1] == 10050.0  # Latest equity


# =============================================================================
# BACKTEST EVALUATOR TESTS
# =============================================================================

class TestBacktestEvaluator:
    """Tests for BacktestEvaluator."""
    
    @pytest.fixture
    def sample_metrics(self):
        """Create sample metrics with trades."""
        metrics = SessionMetrics(
            session_id="TEST",
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow(),
            starting_equity=10000.0,
            ending_equity=10500.0,
            realized_pnl=500.0,
            total_trades=3,
            winning_trades=2,
            losing_trades=1,
            total_gross_profit=600.0,
            total_gross_loss=-100.0,
        )
        metrics.trades = [
            TradeRecord(
                trade_id="T-001",
                symbol="AAPL",
                underlying="AAPL",
                template="long_call",
                entry_time=datetime.utcnow(),
                exit_time=datetime.utcnow(),
                entry_price=5.0,
                exit_price=5.5,
                qty=1,
                exit_reason=ExitReason.TAKE_PROFIT,
                pnl=50.0,
                pnl_pct=0.10,
                hold_time_minutes=30.0,
            ),
            TradeRecord(
                trade_id="T-002",
                symbol="MSFT",
                underlying="MSFT",
                template="long_put",
                entry_time=datetime.utcnow(),
                exit_time=datetime.utcnow(),
                entry_price=3.0,
                exit_price=2.5,
                qty=1,
                exit_reason=ExitReason.STOP_LOSS,
                pnl=-50.0,
                pnl_pct=-0.167,
                hold_time_minutes=15.0,
            ),
        ]
        return metrics
    
    def test_create_result_hash(self, sample_metrics):
        """Creates deterministic hash."""
        hash1 = BacktestEvaluator.create_result_hash(sample_metrics)
        hash2 = BacktestEvaluator.create_result_hash(sample_metrics)
        assert hash1 == hash2
        assert len(hash1) == 16
    
    def test_hash_changes_with_data(self, sample_metrics):
        """Hash changes when data changes."""
        hash1 = BacktestEvaluator.create_result_hash(sample_metrics)
        
        sample_metrics.realized_pnl = 501.0  # Change P&L
        hash2 = BacktestEvaluator.create_result_hash(sample_metrics)
        
        assert hash1 != hash2
    
    def test_compare_identical_results(self, sample_metrics):
        """Compare returns identical for same metrics."""
        comparison = BacktestEvaluator.compare_results(sample_metrics, sample_metrics)
        assert comparison["identical"] is True
        assert comparison["pnl_difference"] == 0
    
    def test_compare_different_results(self, sample_metrics):
        """Compare detects differences."""
        import copy
        variant = copy.deepcopy(sample_metrics)
        variant.realized_pnl = 600.0
        variant.ending_equity = 10600.0
        
        comparison = BacktestEvaluator.compare_results(sample_metrics, variant)
        assert comparison["identical"] is False
        assert comparison["pnl_difference"] == 100.0
    
    def test_generate_report(self, sample_metrics):
        """Generates readable report."""
        sample_metrics.duration_minutes = 120.0
        report = BacktestEvaluator.generate_report(sample_metrics)
        
        assert "V1 TRADING SESSION REPORT" in report
        assert "TEST" in report
        assert "500" in report  # P&L
        assert "PERFORMANCE SUMMARY" in report
        assert "TRADE STATISTICS" in report
        assert "V1 COMPLIANCE" in report


# =============================================================================
# UTILITY FUNCTION TESTS
# =============================================================================

class TestUtilityFunctions:
    """Tests for utility functions."""
    
    def test_kelly_fraction_basic(self):
        """Kelly fraction calculates correctly."""
        # 60% win rate, 2:1 R:R
        kelly = calculate_kelly_fraction(
            win_rate=0.6,
            avg_win=100.0,
            avg_loss=-50.0,
        )
        # Kelly = 0.6 - (0.4 / 2) = 0.4, half-Kelly = 0.2
        assert pytest.approx(kelly, rel=1e-2) == 0.2
    
    def test_kelly_fraction_zero_loss(self):
        """Kelly returns 0 when no avg loss."""
        kelly = calculate_kelly_fraction(
            win_rate=0.6,
            avg_win=100.0,
            avg_loss=0.0,
        )
        assert kelly == 0.0
    
    def test_kelly_fraction_negative_returns_zero(self):
        """Negative Kelly returns 0."""
        # Low win rate, poor R:R
        kelly = calculate_kelly_fraction(
            win_rate=0.3,
            avg_win=50.0,
            avg_loss=-100.0,
        )
        assert kelly == 0.0
    
    def test_calculate_var(self):
        """VaR calculates correctly."""
        returns = [-0.10, -0.05, -0.02, 0.01, 0.03, 0.05, 0.08, 0.10, 0.12, 0.15]
        var_95 = calculate_var(returns, confidence=0.95)
        # 5th percentile of 10 values = index 0
        assert var_95 == -0.10
    
    def test_calculate_var_empty(self):
        """VaR returns 0 for empty list."""
        var = calculate_var([])
        assert var == 0.0


# =============================================================================
# SHARPE RATIO TESTS
# =============================================================================

class TestSharpeRatio:
    """Tests for Sharpe ratio calculation."""
    
    def test_sharpe_ratio_calculation(self):
        """Sharpe ratio calculates correctly."""
        metrics = SessionMetrics(
            session_id="TEST",
            start_time=datetime.utcnow(),
        )
        # Add trades with varying returns
        metrics.trades = [
            TradeRecord(
                trade_id=f"T-{i}",
                symbol="A",
                underlying="A",
                template="long_call",
                entry_time=datetime.utcnow(),
                exit_time=datetime.utcnow(),
                entry_price=5.0,
                exit_price=5.0 * (1 + pnl_pct),
                qty=1,
                exit_reason=ExitReason.TAKE_PROFIT,
                pnl=100 * pnl_pct,
                pnl_pct=pnl_pct,
                hold_time_minutes=30.0,
            )
            for i, pnl_pct in enumerate([0.05, 0.03, -0.02, 0.04, 0.02])
        ]
        
        sharpe = metrics.sharpe_ratio
        assert sharpe > 0  # Positive overall returns
    
    def test_sharpe_ratio_single_trade(self):
        """Sharpe is 0 with single trade."""
        metrics = SessionMetrics(
            session_id="TEST",
            start_time=datetime.utcnow(),
        )
        metrics.trades = [
            TradeRecord(
                trade_id="T-1",
                symbol="A",
                underlying="A",
                template="long_call",
                entry_time=datetime.utcnow(),
                exit_time=datetime.utcnow(),
                entry_price=5.0,
                exit_price=5.5,
                qty=1,
                exit_reason=ExitReason.TAKE_PROFIT,
                pnl=50.0,
                pnl_pct=0.10,
                hold_time_minutes=30.0,
            )
        ]
        
        assert metrics.sharpe_ratio == 0.0  # Can't calculate std with 1 value
    
    def test_sharpe_ratio_no_trades(self):
        """Sharpe is 0 with no trades."""
        metrics = SessionMetrics(
            session_id="TEST",
            start_time=datetime.utcnow(),
        )
        assert metrics.sharpe_ratio == 0.0
