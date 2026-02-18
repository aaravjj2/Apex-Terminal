"""
Milestone 3 Integration Test

Tests all Milestone 3 components:
1. Slippage Model
2. Backtest Engine
3. Walk-Forward Analysis
4. Stress Testing
"""

import sys
import os
import logging
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from services.autopilot.backtest_engine import (
    SlippageModel, SlippageConfig, BacktestEngine, BacktestBar
)
from services.autopilot.walk_forward import (
    WalkForwardAnalyzer, MetricsCalculator, StressTester,
    PerformanceMetrics, STRESS_SCENARIOS
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("M3Test")

def test_slippage_model():
    logger.info("--- Testing Slippage Model ---")
    
    model = SlippageModel(seed=42)
    
    # Test at market open (higher slippage)
    open_time = datetime(2026, 1, 21, 9, 35, tzinfo=timezone.utc)
    result = model.calculate_fill(
        order_side="buy",
        limit_price=2.10,
        bid=2.00,
        ask=2.20,
        timestamp=open_time,
    )
    
    assert result.slippage_bps > 0
    logger.info(f"✅ Open slippage: {result.slippage_bps:.1f} bps, filled={result.filled}")
    
    # Test at midday (lower slippage)
    mid_time = datetime(2026, 1, 21, 12, 0, tzinfo=timezone.utc)
    result2 = model.calculate_fill(
        order_side="buy",
        limit_price=2.10,
        bid=2.00,
        ask=2.20,
        timestamp=mid_time,
    )
    
    logger.info(f"✅ Midday slippage: {result2.slippage_bps:.1f} bps, filled={result2.filled}")
    
    # Test wide spread penalty
    wide_result = model.calculate_fill(
        order_side="buy",
        limit_price=2.20,
        bid=1.80,
        ask=2.20,  # 20% spread!
        timestamp=mid_time,
    )
    logger.info(f"✅ Wide spread slippage: {wide_result.slippage_bps:.1f} bps")

def test_metrics_calculator():
    logger.info("--- Testing Metrics Calculator ---")
    
    # Mock trades
    trades = [
        {"pnl": 50, "holding_minutes": 30},
        {"pnl": -25, "holding_minutes": 15},
        {"pnl": 75, "holding_minutes": 45},
        {"pnl": -40, "holding_minutes": 20},
        {"pnl": 100, "holding_minutes": 60},
    ]
    
    equity_curve = [
        {"equity": 10000},
        {"equity": 10050},
        {"equity": 10025},
        {"equity": 10100},
        {"equity": 10060},
        {"equity": 10160},
    ]
    
    metrics = MetricsCalculator.calculate(
        trades=trades,
        equity_curve=equity_curve,
        start_equity=10000,
        end_equity=10160,
    )
    
    assert metrics.total_trades == 5
    assert metrics.win_rate == 0.6  # 3/5
    assert metrics.total_return > 0
    logger.info(f"✅ Total trades: {metrics.total_trades}")
    logger.info(f"✅ Win rate: {metrics.win_rate:.1%}")
    logger.info(f"✅ Total return: {metrics.total_return:.2%}")
    logger.info(f"✅ Profit factor: {metrics.profit_factor:.2f}")

def test_walk_forward():
    logger.info("--- Testing Walk-Forward Analysis ---")
    
    analyzer = WalkForwardAnalyzer(
        train_window_days=30,
        test_window_days=10,
        step_days=10,
    )
    
    start = datetime(2025, 1, 1)
    end = datetime(2025, 6, 1)
    
    windows = analyzer.create_windows(start, end)
    
    assert len(windows) > 0
    logger.info(f"✅ Created {len(windows)} walk-forward windows")
    
    # Test window structure
    first = windows[0]
    assert first.train_end == first.test_start
    logger.info(f"✅ First window: train {first.train_start.date()} to {first.train_end.date()}")
    logger.info(f"   test {first.test_start.date()} to {first.test_end.date()}")

def test_stress_testing():
    logger.info("--- Testing Stress Scenarios ---")
    
    tester = StressTester()
    
    # Mock trades
    trades = [
        {"pnl": 50},
        {"pnl": -25},
        {"pnl": 30},
        {"pnl": -15},
        {"pnl": 40},
    ]
    
    results = tester.run_all(trades, start_equity=1000)
    
    assert "flash_crash" in results
    assert "liquidity_crisis" in results
    
    for name, result in results.items():
        logger.info(f"✅ {name}:")
        logger.info(f"   Return: {result['total_return']:.2%}")
        logger.info(f"   Max DD: {result['max_drawdown_stressed']:.2%}")
        logger.info(f"   Survived: {result['survived']}")

def test_backtest_engine():
    logger.info("--- Testing Backtest Engine ---")
    
    engine = BacktestEngine()
    
    # Create mock bars
    bars = []
    base_time = datetime(2026, 1, 21, 9, 30, tzinfo=timezone.utc)
    
    for i in range(100):
        bar = BacktestBar(
            timestamp=base_time + timedelta(minutes=i * 5),
            symbol="SPY",
            open=450 + i * 0.1,
            high=450 + i * 0.1 + 0.5,
            low=450 + i * 0.1 - 0.3,
            close=450 + i * 0.1 + 0.2,
            volume=1000000,
            bid=1.00,
            ask=1.05,
        )
        bars.append(bar)
    
    logger.info(f"✅ Created {len(bars)} test bars")
    logger.info(f"   Time range: {bars[0].timestamp} to {bars[-1].timestamp}")
    
    # Note: Full backtest run requires async decision function
    # For now, verify engine initialization
    assert engine.bar_interval == 5
    logger.info("✅ Backtest engine initialized")

if __name__ == "__main__":
    test_slippage_model()
    test_metrics_calculator()
    test_walk_forward()
    test_stress_testing()
    test_backtest_engine()
    
    logger.info("\n🎉 All Milestone 3 tests passed!")
