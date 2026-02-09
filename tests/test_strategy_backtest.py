"""
Backend unit tests for Strategy Lab + Backtest Engine
Tests validator, engine determinism, and metrics calculation
"""

import pytest
from datetime import datetime, timedelta, date
from phase1.services.strategy_lab.models import StrategyDefinition, IndicatorConfig, SignalCondition
from phase1.services.strategy_lab.validator import validate_strategy
from phase1.services.backtest_engine.models import BacktestConfig
from phase1.services.backtest_engine.engine import BacktestEngine
from phase1.services.backtest_engine.fixtures import generate_demo_bars
import numpy as np


class TestStrategyValidator:
    """Test Strategy Lab validation logic"""

    def test_valid_crossover_strategy(self):
        """Test valid crossover strategy passes validation"""
        strategy = StrategyDefinition(
            id="test-1",
            name="SMA Crossover",
            strategy_type="crossover",
            description="Test strategy",
            indicators=[
                IndicatorConfig(type="sma", params={"period": 20}),
                IndicatorConfig(type="sma", params={"period": 50})
            ],
            stop_loss_pct=2.0,
            take_profit_pct=5.0
        )
        result = validate_strategy(strategy)
        assert result.valid
        assert len(result.errors) == 0

    def test_crossover_needs_two_indicators(self):
        """Crossover strategy must have exactly 2 indicators"""
        strategy = StrategyDefinition(
            id="test-2",
            name="Bad Crossover",
            strategy_type="crossover",
            description="Test strategy",
            indicators=[
                IndicatorConfig(type="sma", params={"period": 20}),
            ]
        )
        result = validate_strategy(strategy)
        assert not result.valid
        assert any("crossover" in err.message.lower() for err in result.errors)

    def test_signal_needs_conditions(self):
        """Signal strategy should have entry conditions - warning not error"""
        strategy = StrategyDefinition(
            id="test-3",
            name="Signal Strategy",
            strategy_type="signal",
            description="Test strategy",
            indicators=[IndicatorConfig(type="rsi", params={"period": 14})],
            entry_condition=None
        )
        result = validate_strategy(strategy)
        # Should be valid but with warnings
        assert result.valid
        assert len(result.warnings) > 0
        assert any("entry" in str(w.message).lower() for w in result.warnings)

    def test_large_stop_loss_warning(self):
        """Large stop loss should generate warning"""
        strategy = StrategyDefinition(
            id="test-4",
            name="Risky Strategy",
            strategy_type="crossover",
            description="Test strategy",
            indicators=[
                IndicatorConfig(type="sma", params={"period": 20}),
                IndicatorConfig(type="sma", params={"period": 50})
            ],
            stop_loss_pct=55.0  # Very large stop loss (>50)
        )
        result = validate_strategy(strategy)
        assert len(result.warnings) > 0
        assert any("stop_loss" in str(w.field) for w in result.warnings)

    def test_empty_name_invalid(self):
        """Strategy with empty name is invalid (caught by Pydantic)"""
        with pytest.raises(Exception):  # Pydantic validation error
            StrategyDefinition(
                id="test-5",
                name="",  # Empty name
                strategy_type="crossover",
                description="Test strategy",
                indicators=[
                    IndicatorConfig(type="sma", params={"period": 20}),
                    IndicatorConfig(type="sma", params={"period": 50})
                ]
            )


class TestBacktestEngine:
    """Test Backtest Engine determinism and calculations"""

    def test_demo_bars_deterministic(self):
        """Demo bars should be identical with same seed"""
        start_dt = datetime(2023, 1, 1)
        end_dt = datetime(2023, 3, 31)
        bars1 = generate_demo_bars("SPY", start_dt, end_dt, seed=42)
        bars2 = generate_demo_bars("SPY", start_dt, end_dt, seed=42)

        assert len(bars1) == len(bars2)
        for b1, b2 in zip(bars1, bars2):
            assert b1["timestamp"] == b2["timestamp"]
            assert abs(b1["close"] - b2["close"]) < 1e-6
            assert abs(b1["volume"] - b2["volume"]) < 1e-6

    def test_config_hash_determinism(self):
        """Same config should produce identical hash"""
        config1 = BacktestConfig(
            strategy_id="test-strat",
            symbol="SPY",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            initial_capital=100000,
            slippage_bps=5,
            fee_per_trade=1,
            seed=42
        )
        config2 = BacktestConfig(
            strategy_id="test-strat",
            symbol="SPY",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            initial_capital=100000,
            slippage_bps=5,
            fee_per_trade=1,
            seed=42
        )

        engine = BacktestEngine()
        hash1 = engine._calc_config_hash(config1)
        hash2 = engine._calc_config_hash(config2)

        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex digest length

    def test_sma_calculation(self):
        """Test SMA calculation correctness"""
        engine = BacktestEngine()
        prices = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        sma = engine._calc_sma(prices, 3)

        # First 2 values should be NaN, then [2.0, 3.0, 4.0]
        assert np.isnan(sma[0])
        assert np.isnan(sma[1])
        assert abs(sma[2] - 2.0) < 1e-6
        assert abs(sma[3] - 3.0) < 1e-6
        assert abs(sma[4] - 4.0) < 1e-6

    def test_rsi_calculation(self):
        """Test RSI calculation produces values in [0, 100]"""
        engine = BacktestEngine()
        # Create price series with upward trend
        prices = np.array([100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0,
                           108.0, 109.0, 110.0, 111.0, 112.0, 113.0, 114.0])
        rsi = engine._calc_rsi(prices, 14)

        # RSI should be > 50 for uptrend, < 100
        valid_rsi = rsi[~np.isnan(rsi)]
        assert len(valid_rsi) > 0
        assert all(0 <= v <= 100 for v in valid_rsi)
        # For strong uptrend, RSI should be high
        assert valid_rsi[-1] > 50

    def test_backtest_run_completeness(self):
        """Test backtest run generates all required outputs"""
        from phase1.services.strategy_lab.storage import _storage

        # Create test strategy
        strategy = StrategyDefinition(
            id="test-backtest-strat",
            name="Test SMA Crossover",
            strategy_type="crossover",
            description="Test strategy for backtesting",
            indicators=[
                IndicatorConfig(type="SMA", params={"period": 5}),
                IndicatorConfig(type="SMA", params={"period": 10})
            ],
            stop_loss_pct=2.0,
            take_profit_pct=5.0
        )
        _storage.save(strategy)

        # Run backtest
        config = BacktestConfig(
            strategy_id=strategy.id,
            symbol="SPY",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 3, 31),
            initial_capital=100000,
            slippage_bps=5,
            fee_per_trade=1,
            seed=42
        )

        engine = BacktestEngine()
        run = engine.run_backtest(config)

        # Validate completeness
        assert run.run_id is not None
        assert run.status == "completed"
        assert run.config_hash is not None
        assert len(run.config_hash) == 64
        assert run.started_at is not None
        assert run.completed_at is not None
        assert run.metrics is not None
        assert len(run.equity_curve) > 0
        assert run.trades is not None  # May be empty if no trades

    def test_backtest_results_determinism(self):
        """Critical: Same config should produce identical results"""
        from phase1.services.strategy_lab.storage import _storage

        # Create test strategy
        strategy = StrategyDefinition(
            id="determinism-test-strat",
            name="Determinism Test",
            strategy_type="crossover",
            description="Strategy for determinism verification",
            indicators=[
                IndicatorConfig(type="SMA", params={"period": 5}),
                IndicatorConfig(type="SMA", params={"period": 20})
            ],
            stop_loss_pct=3.0
        )
        _storage.save(strategy)

        config = BacktestConfig(
            strategy_id=strategy.id,
            symbol="SPY",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 6, 30),
            initial_capital=100000,
            slippage_bps=5,
            fee_per_trade=1,
            seed=42
        )

        engine = BacktestEngine()
        run1 = engine.run_backtest(config)
        run2 = engine.run_backtest(config)

        # Hashes must match
        assert run1.config_hash == run2.config_hash

        # Metrics must match
        assert run1.metrics.total_return_pct == run2.metrics.total_return_pct
        assert run1.metrics.max_drawdown_pct == run2.metrics.max_drawdown_pct
        assert run1.metrics.sharpe_ratio == run2.metrics.sharpe_ratio
        assert run1.metrics.total_trades == run2.metrics.total_trades

        # Trade count must match
        assert len(run1.trades) == len(run2.trades)

        # Equity curve length must match
        assert len(run1.equity_curve) == len(run2.equity_curve)

    def test_metrics_calculation_sanity(self):
        """Test metrics are calculated and within reasonable ranges"""
        from phase1.services.strategy_lab.storage import _storage

        strategy = StrategyDefinition(
            id="metrics-test-strat",
            name="Metrics Test",
            strategy_type="crossover",
            description="Strategy for metrics testing",
            indicators=[
                IndicatorConfig(type="SMA", params={"period": 10}),
                IndicatorConfig(type="SMA", params={"period": 30})
            ]
        )
        _storage.save(strategy)

        config = BacktestConfig(
            strategy_id=strategy.id,
            symbol="SPY",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            initial_capital=100000,
            slippage_bps=5,
            fee_per_trade=1,
            seed=42
        )

        engine = BacktestEngine()
        run = engine.run_backtest(config)

        metrics = run.metrics

        # Sanity checks
        assert metrics.total_trades >= 0
        assert metrics.final_equity > 0
        assert -100 <= metrics.total_return_pct <= 1000  # Reasonable range
        assert -100 <= metrics.max_drawdown_pct <= 0  # Drawdown is negative
        assert 0 <= metrics.win_rate_pct <= 100
        # Sharpe can be negative but shouldn't be extreme
        assert -10 <= metrics.sharpe_ratio <= 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
