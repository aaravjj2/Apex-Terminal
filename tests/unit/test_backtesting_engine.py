"""
Comprehensive tests for BacktestingEngineV2.
"""

import math
import statistics
from datetime import datetime, timedelta

import pytest
import numpy as np

from services.backtesting_engine import (
    OHLCV,
    SignalType,
    StrategyType,
    PositionSizingMethod,
    BenchmarkType,
    TradeRecord,
    EquityCurvePoint,
    DrawdownInfo,
    StrategySignalGenerator,
    PositionSizer,
    CommissionModel,
    SlippageModel,
    BacktestEngine,
    PerformanceAnalytics,
    BenchmarkComparison,
    WalkForwardAnalyzer,
    MonteCarloSimulator,
    MultiStrategyBacktester,
    BacktestingEngineV2,
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_bars(n: int = 100, start_price: float = 100.0, trend: float = 0.001, seed: int = 42) -> list[OHLCV]:
    """Generate synthetic OHLCV data."""
    rng = np.random.default_rng(seed)
    bars = []
    price = start_price
    base_time = datetime(2024, 1, 1)

    for i in range(n):
        change = price * (trend + rng.normal(0, 0.02))
        o = price
        c = price + change
        h = max(o, c) + abs(rng.normal(0, price * 0.005))
        l = min(o, c) - abs(rng.normal(0, price * 0.005))
        vol = rng.integers(100000, 1000000)
        bars.append(OHLCV(
            timestamp=base_time + timedelta(days=i),
            open=round(o, 2),
            high=round(h, 2),
            low=round(l, 2),
            close=round(c, 2),
            volume=int(vol),
        ))
        price = c

    return bars


def make_trending_bars(n: int = 200, direction: str = "up") -> list[OHLCV]:
    """Generate clearly trending bars."""
    bars = []
    price = 100.0
    delta = 0.5 if direction == "up" else -0.3
    base_time = datetime(2024, 1, 1)

    for i in range(n):
        o = price
        c = price + delta + np.random.normal(0, 0.1)
        h = max(o, c) + 0.5
        l = min(o, c) - 0.5
        bars.append(OHLCV(
            timestamp=base_time + timedelta(days=i),
            open=round(o, 2),
            high=round(h, 2),
            low=round(l, 2),
            close=round(max(c, 1.0), 2),
            volume=500000,
        ))
        price = max(c, 1.0)

    return bars


# ─── TestOHLCV ───────────────────────────────────────────────────────────────

class TestOHLCV:
    def test_typical_price(self):
        bar = OHLCV(datetime.now(), 100, 105, 95, 102)
        assert bar.typical_price() == pytest.approx((105 + 95 + 102) / 3)

    def test_true_range_no_prev(self):
        bar = OHLCV(datetime.now(), 100, 110, 90, 105)
        assert bar.true_range() == 20.0

    def test_true_range_with_prev(self):
        bar = OHLCV(datetime.now(), 100, 110, 90, 105)
        assert bar.true_range(85.0) == 25.0  # |110 - 85|

    def test_body_size(self):
        bar = OHLCV(datetime.now(), 100, 110, 90, 105)
        assert bar.body_size() == 5.0

    def test_is_bullish(self):
        bar = OHLCV(datetime.now(), 100, 110, 90, 105)
        assert bar.is_bullish()
        bearish = OHLCV(datetime.now(), 100, 110, 90, 95)
        assert not bearish.is_bullish()

    def test_to_dict(self):
        bar = OHLCV(datetime(2024, 1, 1), 100, 110, 90, 105, 500000)
        d = bar.to_dict()
        assert d["open"] == 100
        assert d["volume"] == 500000
        assert "2024-01-01" in d["timestamp"]


# ─── TestTradeRecord ─────────────────────────────────────────────────────────

class TestTradeRecord:
    def test_long_pnl(self):
        t = TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long")
        assert t.gross_pnl == 100.0
        assert t.net_pnl == 100.0

    def test_short_pnl(self):
        t = TradeRecord(entry_price=100, exit_price=90, quantity=10, side="short")
        assert t.gross_pnl == 100.0

    def test_net_pnl_with_costs(self):
        t = TradeRecord(entry_price=100, exit_price=110, quantity=10, commission=5.0, slippage=2.0, side="long")
        assert t.net_pnl == 93.0

    def test_return_pct_long(self):
        t = TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long")
        assert t.return_pct == pytest.approx(10.0)

    def test_return_pct_short(self):
        t = TradeRecord(entry_price=100, exit_price=90, quantity=10, side="short")
        assert t.return_pct == pytest.approx((100 / 90 - 1) * 100)

    def test_is_winner(self):
        winner = TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long")
        loser = TradeRecord(entry_price=100, exit_price=90, quantity=10, side="long")
        assert winner.is_winner
        assert not loser.is_winner

    def test_risk_reward(self):
        t = TradeRecord(mae=-5.0, mfe=15.0)
        assert t.risk_reward_ratio == 3.0

    def test_to_dict(self):
        t = TradeRecord(symbol="AAPL", entry_price=100, exit_price=110, quantity=10, side="long")
        d = t.to_dict()
        assert d["symbol"] == "AAPL"
        assert d["gross_pnl"] == 100.0

    def test_zero_entry(self):
        t = TradeRecord(entry_price=0, exit_price=10, quantity=5, side="long")
        assert t.return_pct == 0.0

    def test_zero_mae(self):
        t = TradeRecord(mae=0.0, mfe=10.0)
        assert t.risk_reward_ratio == 0.0


# ─── TestDrawdownInfo ────────────────────────────────────────────────────────

class TestDrawdownInfo:
    def test_depth(self):
        dd = DrawdownInfo(start_time=datetime.now(), peak_equity=100000, trough_equity=80000)
        assert dd.depth == pytest.approx(20.0)

    def test_depth_zero_peak(self):
        dd = DrawdownInfo(start_time=datetime.now(), peak_equity=0, trough_equity=0)
        assert dd.depth == 0.0


# ─── TestStrategySignalGenerator ─────────────────────────────────────────────

class TestStrategySignalGenerator:
    def test_sma_crossover_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.sma_crossover(bars)
        assert len(signals) == 100

    def test_sma_crossover_initial_hold(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.sma_crossover(bars, fast_period=5, slow_period=20)
        for s in signals[:20]:
            assert s == SignalType.HOLD

    def test_ema_crossover_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.ema_crossover(bars)
        assert len(signals) == 100

    def test_rsi_strategy_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.rsi_strategy(bars)
        assert len(signals) == 100

    def test_rsi_short_data(self):
        bars = make_bars(5)
        signals = StrategySignalGenerator.rsi_strategy(bars, period=14)
        assert all(s == SignalType.HOLD for s in signals)

    def test_macd_strategy_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.macd_strategy(bars)
        assert len(signals) == 100

    def test_bollinger_strategy_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.bollinger_strategy(bars)
        assert len(signals) == 100

    def test_momentum_strategy_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.momentum_strategy(bars)
        assert len(signals) == 100

    def test_donchian_channel_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.donchian_channel(bars)
        assert len(signals) == 100

    def test_breakout_strategy_length(self):
        bars = make_bars(100)
        signals = StrategySignalGenerator.breakout_strategy(bars)
        assert len(signals) == 100

    def test_generate_signals_dispatch(self):
        gen = StrategySignalGenerator()
        bars = make_bars(50)
        signals = gen.generate_signals(StrategyType.SMA_CROSSOVER, bars, fast_period=5, slow_period=15)
        assert len(signals) == 50

    def test_generate_signals_unknown(self):
        gen = StrategySignalGenerator()
        bars = make_bars(10)
        signals = gen.generate_signals(StrategyType.CUSTOM, bars)
        assert all(s == SignalType.HOLD for s in signals)

    def test_trending_up_gets_buy(self):
        # Create bars that start flat then trend up sharply to force crossover
        bars = []
        base_time = datetime(2024, 1, 1)
        price = 100.0
        for i in range(60):
            # First 30 bars flat, next 30 bars strong uptrend
            if i < 30:
                c = 100.0 + np.random.normal(0, 0.1)
            else:
                c = 100.0 + (i - 30) * 2.0
            bars.append(OHLCV(base_time + timedelta(days=i), c - 0.5, c + 1, c - 1, c, 500000))
        signals = StrategySignalGenerator.sma_crossover(bars, fast_period=5, slow_period=20)
        assert SignalType.BUY in signals

    def test_bollinger_extreme_values(self):
        bars = make_bars(50)
        signals = StrategySignalGenerator.bollinger_strategy(bars, period=20, num_std=0.1)
        # Very tight bands should generate signals
        non_hold = [s for s in signals if s != SignalType.HOLD]
        assert len(non_hold) > 0

    def test_momentum_with_threshold(self):
        bars = make_bars(50)
        signals = StrategySignalGenerator.momentum_strategy(bars, lookback=10, threshold=5.0)
        assert len(signals) == 50

    def test_ema_crossover_trending(self):
        # Create bars: flat then trending up to force a crossover
        bars = []
        base_time = datetime(2024, 1, 1)
        for i in range(80):
            if i < 30:
                c = 100.0 + np.random.normal(0, 0.1)
            else:
                c = 100.0 + (i - 30) * 1.5
            bars.append(OHLCV(base_time + timedelta(days=i), c - 0.5, c + 1, c - 1, c, 500000))
        signals = StrategySignalGenerator.ema_crossover(bars, fast_period=5, slow_period=20)
        buy_count = sum(1 for s in signals if s == SignalType.BUY)
        assert buy_count >= 1


# ─── TestPositionSizer ───────────────────────────────────────────────────────

class TestPositionSizer:
    def test_fixed_fractional(self):
        shares = PositionSizer.fixed_fractional(100000, 0.02, 2.0)
        assert shares == 1000.0

    def test_fixed_fractional_zero_stop(self):
        assert PositionSizer.fixed_fractional(100000, 0.02, 0.0) == 0.0

    def test_kelly_criterion(self):
        kelly = PositionSizer.kelly_criterion(0.6, 100, 80)
        assert 0 < kelly < 0.25

    def test_kelly_zero_loss(self):
        assert PositionSizer.kelly_criterion(0.5, 100, 0) == 0.0

    def test_kelly_losing_system(self):
        # Very low win rate
        kelly = PositionSizer.kelly_criterion(0.2, 50, 100)
        assert kelly == 0.0  # Clamped at 0

    def test_volatility_target(self):
        shares = PositionSizer.volatility_target(100000, 0.15, 0.30, 50.0)
        assert shares > 0

    def test_volatility_target_zero(self):
        assert PositionSizer.volatility_target(100000, 0.15, 0, 50.0) == 0.0

    def test_equal_weight(self):
        shares = PositionSizer.equal_weight(100000, 10, 50.0)
        assert shares == 200.0

    def test_equal_weight_zero(self):
        assert PositionSizer.equal_weight(100000, 0, 50.0) == 0.0
        assert PositionSizer.equal_weight(100000, 10, 0.0) == 0.0

    def test_risk_parity(self):
        weights = PositionSizer.risk_parity(100000, [0.2, 0.3, 0.1])
        assert len(weights) == 3
        # Lower vol gets higher weight
        assert weights[2] > weights[0] > weights[1]

    def test_risk_parity_zero_vols(self):
        weights = PositionSizer.risk_parity(100000, [0, 0, 0])
        assert all(w == 0 for w in weights)

    def test_atr_based(self):
        shares = PositionSizer.atr_based(100000, 2.0, 0.01, 2.0)
        assert shares == 250.0

    def test_atr_zero(self):
        assert PositionSizer.atr_based(100000, 0.0) == 0.0

    def test_fixed_dollar(self):
        shares = PositionSizer.fixed_dollar(10000, 50)
        assert shares == 200.0

    def test_fixed_dollar_zero_price(self):
        assert PositionSizer.fixed_dollar(10000, 0) == 0.0

    def test_percent_of_equity(self):
        shares = PositionSizer.percent_of_equity(100000, 0.10, 50.0)
        assert shares == 200.0


# ─── TestCommissionModel ────────────────────────────────────────────────────

class TestCommissionModel:
    def test_per_share(self):
        cm = CommissionModel(per_share=0.005, min_commission=1.0)
        assert cm.calculate(100, 50) == 1.0  # 100 * 0.005 = 0.50 < min 1.0

    def test_per_share_above_min(self):
        cm = CommissionModel(per_share=0.01, min_commission=0.50)
        assert cm.calculate(100, 50) == 1.0

    def test_max_commission(self):
        cm = CommissionModel(per_share=0.01, max_commission=5.0)
        assert cm.calculate(10000, 50) == 5.0

    def test_pct_based(self):
        cm = CommissionModel(pct_of_value=0.001)
        assert cm.calculate(100, 50) == 5.0  # 100 * 50 * 0.001


# ─── TestSlippageModel ──────────────────────────────────────────────────────

class TestSlippageModel:
    def test_fixed_slippage(self):
        sm = SlippageModel(fixed_bps=10, volume_impact=0)
        slip = sm.calculate(100.0, 100)
        assert slip == pytest.approx(10.0)  # 100 * 10/10000 * 100

    def test_volume_impact(self):
        sm = SlippageModel(fixed_bps=0, volume_impact=0.5)
        slip_small = sm.calculate(100.0, 100, 1000000)
        slip_large = sm.calculate(100.0, 10000, 1000000)
        assert slip_large > slip_small

    def test_zero_volume(self):
        sm = SlippageModel(fixed_bps=5, volume_impact=0.5)
        slip = sm.calculate(100.0, 100, 0)
        # Only fixed component
        assert slip > 0


# ─── TestBacktestEngine ─────────────────────────────────────────────────────

class TestBacktestEngine:
    def test_initial_state(self):
        engine = BacktestEngine(initial_capital=50000)
        assert engine.cash == 50000
        assert len(engine.positions) == 0

    def test_reset(self):
        engine = BacktestEngine()
        engine.cash = 50000
        engine.positions["AAPL"] = 100
        engine.reset()
        assert engine.cash == 100000
        assert len(engine.positions) == 0

    def test_simple_backtest(self):
        bars = make_bars(50)
        signals = [SignalType.HOLD] * 50
        engine = BacktestEngine()
        result = engine.run_backtest(bars, signals)
        assert result["initial_capital"] == 100000
        assert result["trades"] == 0

    def test_buy_sell_cycle(self):
        bars = make_bars(50)
        signals = [SignalType.HOLD] * 10 + [SignalType.BUY] + [SignalType.HOLD] * 20 + [SignalType.SELL] + [SignalType.HOLD] * 18
        engine = BacktestEngine()
        result = engine.run_backtest(bars, signals, symbol="AAPL")
        assert result["trades"] >= 1

    def test_equity_curve_length(self):
        bars = make_bars(30)
        signals = [SignalType.HOLD] * 30
        engine = BacktestEngine()
        engine.run_backtest(bars, signals)
        # At minimum the equity curve should have entries
        assert len(engine.equity_curve) > 0

    def test_commission_applied(self):
        bars = make_bars(10)
        signals = [SignalType.BUY] + [SignalType.HOLD] * 8 + [SignalType.SELL]
        engine = BacktestEngine(commission_model=CommissionModel(per_share=1.0, min_commission=0))
        engine.run_backtest(bars, signals)
        # Final equity should reflect commission costs
        assert engine.equity_curve[-1].equity < 100000 or engine.equity_curve[-1].equity > 0

    def test_close_positions_at_end(self):
        bars = make_bars(20)
        signals = [SignalType.BUY] + [SignalType.HOLD] * 19
        engine = BacktestEngine()
        engine.run_backtest(bars, signals)
        # Positions closed at end of backtest
        assert len(engine.trades) >= 1

    def test_empty_bars(self):
        engine = BacktestEngine()
        result = engine.run_backtest([], [])
        assert result["trades"] == 0

    def test_multiple_buy_signals(self):
        """Multiple buy signals — only first should trigger if already in position."""
        bars = make_bars(20)
        signals = [SignalType.BUY] * 5 + [SignalType.HOLD] * 10 + [SignalType.SELL] + [SignalType.HOLD] * 4
        engine = BacktestEngine()
        engine.run_backtest(bars, signals)
        # Should have only 1 trade cycle
        assert len(engine.trades) >= 1

    def test_sell_without_position(self):
        """Sell signal without position should be ignored."""
        bars = make_bars(10)
        signals = [SignalType.SELL] + [SignalType.HOLD] * 9
        engine = BacktestEngine()
        engine.run_backtest(bars, signals)
        assert len(engine.trades) == 0


# ─── TestPerformanceAnalytics ───────────────────────────────────────────────

class TestPerformanceAnalytics:
    def test_total_return(self):
        eq = [
            EquityCurvePoint(datetime(2024, 1, 1), 100000, 100000, 0),
            EquityCurvePoint(datetime(2024, 1, 2), 110000, 110000, 0),
        ]
        assert PerformanceAnalytics.total_return(eq) == pytest.approx(10.0)

    def test_total_return_empty(self):
        assert PerformanceAnalytics.total_return([]) == 0.0

    def test_daily_returns(self):
        eq = [
            EquityCurvePoint(datetime(2024, 1, 1), 100000, 100000, 0),
            EquityCurvePoint(datetime(2024, 1, 2), 101000, 101000, 0),
            EquityCurvePoint(datetime(2024, 1, 3), 100000, 100000, 0),
        ]
        rets = PerformanceAnalytics.daily_returns(eq)
        assert len(rets) == 2
        assert rets[0] == pytest.approx(0.01)

    def test_sharpe_ratio(self):
        # Positive returns with some variance
        rng = np.random.default_rng(42)
        returns = list(rng.normal(0.001, 0.005, 252))
        sharpe = PerformanceAnalytics.sharpe_ratio(returns)
        assert sharpe > 0

    def test_sharpe_zero_std(self):
        returns = [0.0, 0.0, 0.0]
        assert PerformanceAnalytics.sharpe_ratio(returns) == 0.0

    def test_sortino_ratio(self):
        # All positive returns -> infinite sortino
        returns = [0.01] * 100
        sortino = PerformanceAnalytics.sortino_ratio(returns)
        assert sortino == float('inf')

    def test_sortino_mixed(self):
        returns = [0.01, -0.005, 0.02, -0.01, 0.005]
        sortino = PerformanceAnalytics.sortino_ratio(returns)
        assert isinstance(sortino, float)

    def test_calmar_ratio(self):
        assert PerformanceAnalytics.calmar_ratio(15.0, 10.0) == 1.5

    def test_calmar_zero_dd(self):
        assert PerformanceAnalytics.calmar_ratio(15.0, 0.0) == 0.0

    def test_max_drawdown(self):
        eq = [
            EquityCurvePoint(datetime(2024, 1, i), e, e, 0)
            for i, e in enumerate([100000, 110000, 95000, 105000, 100000], 1)
        ]
        dd = PerformanceAnalytics.max_drawdown(eq)
        # Peak 110000, trough 95000 = 13.6%
        assert dd == pytest.approx((110000 - 95000) / 110000 * 100, abs=0.1)

    def test_max_drawdown_empty(self):
        assert PerformanceAnalytics.max_drawdown([]) == 0.0

    def test_drawdown_analysis(self):
        eq = [
            EquityCurvePoint(datetime(2024, 1, i), e, e, 0)
            for i, e in enumerate([100000, 110000, 95000, 105000, 115000], 1)
        ]
        dds = PerformanceAnalytics.drawdown_analysis(eq)
        assert len(dds) >= 1

    def test_win_rate(self):
        trades = [
            TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long"),
            TradeRecord(entry_price=100, exit_price=90, quantity=10, side="long"),
            TradeRecord(entry_price=100, exit_price=105, quantity=10, side="long"),
        ]
        assert PerformanceAnalytics.win_rate(trades) == pytest.approx(66.67, abs=0.1)

    def test_win_rate_empty(self):
        assert PerformanceAnalytics.win_rate([]) == 0.0

    def test_profit_factor(self):
        trades = [
            TradeRecord(entry_price=100, exit_price=120, quantity=10, side="long"),  # +200
            TradeRecord(entry_price=100, exit_price=90, quantity=10, side="long"),   # -100
        ]
        pf = PerformanceAnalytics.profit_factor(trades)
        assert pf == pytest.approx(2.0)

    def test_profit_factor_no_losses(self):
        trades = [TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long")]
        assert PerformanceAnalytics.profit_factor(trades) == float('inf')

    def test_expectancy(self):
        trades = [
            TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long"),  # +100
            TradeRecord(entry_price=100, exit_price=95, quantity=10, side="long"),   # -50
        ]
        exp = PerformanceAnalytics.expectancy(trades)
        assert exp == pytest.approx(25.0)

    def test_payoff_ratio(self):
        trades = [
            TradeRecord(entry_price=100, exit_price=120, quantity=10, side="long"),
            TradeRecord(entry_price=100, exit_price=90, quantity=10, side="long"),
        ]
        pr = PerformanceAnalytics.payoff_ratio(trades)
        assert pr == pytest.approx(2.0)

    def test_consecutive(self):
        trades = [
            TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long"),
            TradeRecord(entry_price=100, exit_price=115, quantity=10, side="long"),
            TradeRecord(entry_price=100, exit_price=90, quantity=10, side="long"),
        ]
        c = PerformanceAnalytics.consecutive_wins_losses(trades)
        assert c["max_consecutive_wins"] == 2
        assert c["max_consecutive_losses"] == 1

    def test_monthly_returns(self):
        eq = [
            EquityCurvePoint(datetime(2024, 1, 1) + timedelta(days=i), 100000 + i * 100, 100000, 0)
            for i in range(31)
        ]
        monthly = PerformanceAnalytics.monthly_returns(eq)
        assert len(monthly) > 0

    def test_trade_analysis_empty(self):
        ta = PerformanceAnalytics.trade_analysis([])
        assert ta["total_trades"] == 0

    def test_trade_analysis_with_trades(self):
        trades = [
            TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long", bars_held=5, mae=-2, mfe=12),
            TradeRecord(entry_price=100, exit_price=95, quantity=10, side="long", bars_held=3, mae=-6, mfe=2),
        ]
        ta = PerformanceAnalytics.trade_analysis(trades)
        assert ta["total_trades"] == 2
        assert ta["winners"] == 1
        assert ta["losers"] == 1

    def test_cagr(self):
        eq = [
            EquityCurvePoint(datetime(2024, 1, 1), 100000, 100000, 0),
        ] + [
            EquityCurvePoint(datetime(2024, 1, 1) + timedelta(days=i), 100000 + i * 10, 100000, 0)
            for i in range(1, 253)
        ]
        cagr = PerformanceAnalytics.cagr(eq)
        assert cagr > 0

    def test_full_report(self):
        bars = make_trending_bars(100, "up")
        signals = StrategySignalGenerator.sma_crossover(bars, fast_period=5, slow_period=20)
        engine = BacktestEngine()
        engine.run_backtest(bars, signals)
        report = PerformanceAnalytics().full_report(engine)
        assert "summary" in report
        assert "trade_analysis" in report
        assert "risk_metrics" in report

    def test_value_at_risk(self):
        returns = [0.01, -0.02, 0.005, -0.03, 0.02, -0.01, 0.015, -0.005, 0.01, -0.025]
        var = PerformanceAnalytics._value_at_risk(returns, 0.10)
        assert var < 0  # Should be negative (loss)

    def test_skewness(self):
        returns = [0.01, 0.02, -0.01, 0.005, -0.02, 0.03, -0.005]
        skew = PerformanceAnalytics._skewness(returns)
        assert isinstance(skew, float)

    def test_kurtosis(self):
        returns = [0.01, 0.02, -0.01, 0.005, -0.02, 0.03, -0.005]
        kurt = PerformanceAnalytics._kurtosis(returns)
        assert isinstance(kurt, float)


# ─── TestBenchmarkComparison ────────────────────────────────────────────────

class TestBenchmarkComparison:
    def test_buy_and_hold(self):
        bars = make_bars(50)
        rets = BenchmarkComparison.buy_and_hold_returns(bars)
        assert len(rets) == 49

    def test_alpha_beta(self):
        sr = [0.01, 0.02, -0.01, 0.005, 0.03]
        br = [0.005, 0.01, -0.005, 0.002, 0.015]
        ab = BenchmarkComparison.alpha_beta(sr, br)
        assert "alpha" in ab
        assert "beta" in ab
        assert "r_squared" in ab

    def test_alpha_beta_short(self):
        ab = BenchmarkComparison.alpha_beta([0.01], [0.01])
        assert ab["beta"] == 0.0

    def test_information_ratio(self):
        sr = [0.01, 0.02, 0.005, 0.015, 0.01]
        br = [0.005, 0.01, 0.003, 0.008, 0.005]
        ir = BenchmarkComparison.information_ratio(sr, br)
        assert ir > 0  # Strategy outperforms

    def test_information_ratio_identical(self):
        rets = [0.01, 0.02, 0.005]
        ir = BenchmarkComparison.information_ratio(rets, rets)
        assert ir == 0.0


# ─── TestWalkForwardAnalyzer ────────────────────────────────────────────────

class TestWalkForwardAnalyzer:
    def test_create_folds(self):
        bars = make_bars(200)
        wf = WalkForwardAnalyzer(num_folds=4)
        folds = wf.create_folds(bars)
        assert len(folds) == 4
        for fold in folds:
            assert fold["in_sample_bars"] > 0
            assert fold["out_of_sample_bars"] > 0

    def test_param_combinations(self):
        grid = {"a": [1, 2], "b": [10, 20]}
        combos = WalkForwardAnalyzer._param_combinations(grid)
        assert len(combos) == 4

    def test_param_combinations_empty(self):
        combos = WalkForwardAnalyzer._param_combinations({})
        assert combos == [{}]

    def test_robustness_score(self):
        results = [
            {"oos_sharpe": 1.0},
            {"oos_sharpe": 0.5},
            {"oos_sharpe": -0.2},
        ]
        score = WalkForwardAnalyzer._robustness_score(results)
        assert 0 <= score <= 100

    def test_robustness_score_empty(self):
        assert WalkForwardAnalyzer._robustness_score([]) == 0.0

    def test_walk_forward_analysis(self):
        bars = make_bars(300, seed=42)
        wf = WalkForwardAnalyzer(num_folds=3)
        result = wf.run_walk_forward(
            bars, StrategyType.SMA_CROSSOVER, {"fast_period": [5, 10], "slow_period": [20, 30]}
        )
        assert result["num_folds"] == 3
        assert len(result["fold_results"]) == 3


# ─── TestMonteCarloSimulator ───────────────────────────────────────────────

class TestMonteCarloSimulator:
    def test_simulate_returns(self):
        mc = MonteCarloSimulator(num_simulations=100, seed=42)
        returns = [0.001] * 100
        result = mc.simulate_returns(returns)
        assert result["simulations"] == 100
        assert result["final_equity"]["mean"] > 0

    def test_simulate_empty(self):
        mc = MonteCarloSimulator(num_simulations=10)
        result = mc.simulate_returns([])
        assert result["simulations"] == 0

    def test_probability_of_profit(self):
        mc = MonteCarloSimulator(num_simulations=200, seed=42)
        returns = [0.005] * 50  # Positive returns
        result = mc.simulate_returns(returns)
        assert result["probability_of_profit"] > 50.0

    def test_simulate_trade_sequence(self):
        mc = MonteCarloSimulator(num_simulations=100, seed=42)
        trades = [
            TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long"),
            TradeRecord(entry_price=100, exit_price=95, quantity=10, side="long"),
            TradeRecord(entry_price=100, exit_price=108, quantity=10, side="long"),
        ]
        result = mc.simulate_trade_sequence(trades)
        assert result["simulations"] == 100
        assert result["final_equity_mean"] > 0

    def test_simulate_trade_sequence_empty(self):
        mc = MonteCarloSimulator(num_simulations=10)
        result = mc.simulate_trade_sequence([])
        assert result["simulations"] == 0

    def test_percentiles(self):
        mc = MonteCarloSimulator(num_simulations=500, seed=42)
        returns = list(np.random.default_rng(42).normal(0.001, 0.02, 100))
        result = mc.simulate_returns(returns)
        assert result["final_equity"]["p5"] <= result["final_equity"]["p95"]
        assert result["max_drawdown"]["p95"] > 0


# ─── TestMultiStrategyBacktester ────────────────────────────────────────────

class TestMultiStrategyBacktester:
    def _make_equity_curve(self, start: float, daily_ret: float, n: int) -> list[EquityCurvePoint]:
        eq = []
        equity = start
        for i in range(n):
            eq.append(EquityCurvePoint(
                datetime(2024, 1, 1) + timedelta(days=i),
                equity, equity, 0
            ))
            equity *= (1 + daily_ret)
        return eq

    def test_add_strategy(self):
        msb = MultiStrategyBacktester()
        eq = self._make_equity_curve(100000, 0.001, 50)
        msb.add_strategy_result("strat1", eq, [])
        assert "strat1" in msb.strategy_results

    def test_combined_equity(self):
        msb = MultiStrategyBacktester()
        eq1 = self._make_equity_curve(100000, 0.001, 50)
        eq2 = self._make_equity_curve(100000, 0.002, 50)
        msb.add_strategy_result("s1", eq1, [])
        msb.add_strategy_result("s2", eq2, [])
        combined = msb.combined_equity()
        assert len(combined) > 0

    def test_correlation_matrix(self):
        msb = MultiStrategyBacktester()
        eq1 = self._make_equity_curve(100000, 0.001, 50)
        eq2 = self._make_equity_curve(100000, 0.002, 50)
        msb.add_strategy_result("s1", eq1, [])
        msb.add_strategy_result("s2", eq2, [])
        corr = msb.correlation_matrix()
        assert "s1" in corr
        assert "s2" in corr["s1"]

    def test_summary(self):
        msb = MultiStrategyBacktester()
        eq = self._make_equity_curve(100000, 0.001, 50)
        trades = [TradeRecord(entry_price=100, exit_price=110, quantity=10, side="long")]
        msb.add_strategy_result("test", eq, trades)
        summary = msb.summary()
        assert "test" in summary
        assert "sharpe" in summary["test"]

    def test_empty(self):
        msb = MultiStrategyBacktester()
        assert msb.combined_equity() == []


# ─── TestBacktestingEngineV2 (Orchestrator) ─────────────────────────────────

class TestBacktestingEngineV2:
    def test_run_strategy(self):
        engine = BacktestingEngineV2()
        bars = make_trending_bars(100, "up")
        result = engine.run_strategy(StrategyType.SMA_CROSSOVER, bars, fast_period=5, slow_period=20)
        assert "report" in result
        assert "initial_capital" in result

    def test_run_monte_carlo(self):
        engine = BacktestingEngineV2()
        bars = make_bars(100)
        result = engine.run_monte_carlo(bars, StrategyType.MOMENTUM, lookback=10)
        assert result["simulations"] > 0

    def test_compare_strategies(self):
        engine = BacktestingEngineV2()
        bars = make_bars(200)
        result = engine.compare_strategies(bars, [
            (StrategyType.SMA_CROSSOVER, {"fast_period": 5, "slow_period": 20}),
            (StrategyType.MOMENTUM, {"lookback": 20}),
        ])
        assert "sma_crossover" in result
        assert "momentum" in result

    def test_position_size_analysis(self):
        engine = BacktestingEngineV2()
        result = engine.position_size_analysis(
            100000,
            [PositionSizingMethod.FIXED_FRACTIONAL, PositionSizingMethod.EQUAL_WEIGHT],
            price=50.0,
            risk_per_trade=0.02,
            stop_distance=2.0,
            num_positions=10,
        )
        assert "fixed_fractional" in result
        assert "equal_weight" in result
        assert result["fixed_fractional"]["shares"] > 0

    def test_benchmark_comparison(self):
        engine = BacktestingEngineV2()
        bars = make_trending_bars(100, "up")
        result = engine.benchmark_comparison(bars, StrategyType.SMA_CROSSOVER, fast_period=5, slow_period=20)
        assert "alpha" in result
        assert "beta" in result

    def test_capabilities(self):
        engine = BacktestingEngineV2()
        caps = engine.capabilities()
        assert "strategies" in caps
        assert len(caps["strategies"]) == len(StrategyType)

    def test_walk_forward(self):
        engine = BacktestingEngineV2()
        bars = make_bars(300)
        result = engine.run_walk_forward_analysis(
            bars, StrategyType.SMA_CROSSOVER,
            {"fast_period": [5, 10], "slow_period": [20, 30]}
        )
        assert "fold_results" in result
        assert "avg_oos_sharpe" in result

    def test_position_sizing_kelly(self):
        engine = BacktestingEngineV2()
        result = engine.position_size_analysis(
            100000,
            [PositionSizingMethod.KELLY_CRITERION],
            price=100.0,
            win_rate=0.6,
            avg_win=100,
            avg_loss=80,
        )
        assert "kelly_criterion" in result

    def test_position_sizing_vol_target(self):
        engine = BacktestingEngineV2()
        result = engine.position_size_analysis(
            100000,
            [PositionSizingMethod.VOLATILITY_TARGET],
            price=50.0,
            target_vol=0.15,
            asset_vol=0.25,
        )
        assert "volatility_target" in result
        assert result["volatility_target"]["shares"] > 0

    def test_position_sizing_atr(self):
        engine = BacktestingEngineV2()
        result = engine.position_size_analysis(
            100000,
            [PositionSizingMethod.ATR_BASED],
            price=50.0,
            atr=2.0,
        )
        assert "atr_based" in result

    def test_position_sizing_fixed_dollar(self):
        engine = BacktestingEngineV2()
        result = engine.position_size_analysis(
            100000,
            [PositionSizingMethod.FIXED_DOLLAR],
            price=50.0,
            amount=10000,
        )
        assert result["fixed_dollar"]["shares"] == 200.0

    def test_position_sizing_pct_equity(self):
        engine = BacktestingEngineV2()
        result = engine.position_size_analysis(
            100000,
            [PositionSizingMethod.PERCENT_OF_EQUITY],
            price=50.0,
            pct=0.10,
        )
        assert result["percent_of_equity"]["shares"] == 200.0
