"""
test_portfolio_analytics_engine.py — Tests for Portfolio Analytics Engine
=========================================================================
Tests: Position, Portfolio, PerformanceEngine, DrawdownAnalyzer,
       FactorModel, PortfolioOptimizer, AttributionEngine, RiskBudgeting.
"""

import pytest
import numpy as np
import pandas as pd

from phase1.services.portfolio_analytics_engine import (
    Position, TradeRecord, Portfolio,
    PerformanceEngine, DrawdownAnalyzer, FactorModel,
    PortfolioOptimizer, AttributionEngine, RiskBudgeting,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def sample_returns():
    rng = np.random.RandomState(42)
    return pd.Series(rng.randn(500) * 0.01)


@pytest.fixture
def sample_trades():
    return [
        TradeRecord(symbol="AAPL", side="long", quantity=100, entry_price=150,
                    exit_price=160, entry_time="2024-01-01", exit_time="2024-01-15"),
        TradeRecord(symbol="GOOG", side="long", quantity=50, entry_price=100,
                    exit_price=95, entry_time="2024-01-02", exit_time="2024-01-10"),
        TradeRecord(symbol="MSFT", side="long", quantity=200, entry_price=300,
                    exit_price=320, entry_time="2024-01-03", exit_time="2024-01-20"),
        TradeRecord(symbol="TSLA", side="short", quantity=30, entry_price=200,
                    exit_price=180, entry_time="2024-01-04", exit_time="2024-01-12"),
        TradeRecord(symbol="META", side="long", quantity=80, entry_price=250,
                    exit_price=240, entry_time="2024-01-05", exit_time="2024-01-18"),
    ]


@pytest.fixture
def multi_asset_returns():
    rng = np.random.RandomState(42)
    return pd.DataFrame({
        'AAPL': rng.randn(300) * 0.015,
        'GOOG': rng.randn(300) * 0.012,
        'MSFT': rng.randn(300) * 0.013,
        'AMZN': rng.randn(300) * 0.018,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Position
# ═══════════════════════════════════════════════════════════════════════════════

class TestPosition:
    def test_long_profitable(self):
        pos = Position(symbol="AAPL", quantity=100, avg_cost=150, current_price=160)
        assert pos.market_value == 16000
        assert pos.cost_basis == 15000
        assert pos.unrealized_pnl == 1000
        assert pos.is_profitable

    def test_long_losing(self):
        pos = Position(symbol="AAPL", quantity=100, avg_cost=150, current_price=140)
        assert pos.unrealized_pnl == -1000
        assert not pos.is_profitable

    def test_short_profitable(self):
        pos = Position(symbol="TSLA", quantity=50, avg_cost=200, current_price=180, side="short")
        assert pos.market_value == -9000
        assert pos.unrealized_pnl == 1000

    def test_short_losing(self):
        pos = Position(symbol="TSLA", quantity=50, avg_cost=200, current_price=220, side="short")
        assert pos.unrealized_pnl == -1000

    def test_add_quantity(self):
        pos = Position(symbol="AAPL", quantity=100, avg_cost=150, current_price=160)
        pos.add_quantity(100, 170)
        assert pos.quantity == 200
        assert pos.avg_cost == 160

    def test_to_dict(self):
        pos = Position(symbol="AAPL", quantity=100, avg_cost=150, current_price=160)
        d = pos.to_dict()
        assert d["symbol"] == "AAPL"
        assert d["unrealized_pnl"] == 1000


# ═══════════════════════════════════════════════════════════════════════════════
#  Test TradeRecord
# ═══════════════════════════════════════════════════════════════════════════════

class TestTradeRecord:
    def test_long_pnl(self):
        trade = TradeRecord(symbol="AAPL", side="long", quantity=100,
                            entry_price=150, exit_price=160,
                            entry_time="t0", exit_time="t1")
        assert trade.pnl == 1000
        assert trade.pnl_pct > 0

    def test_short_pnl(self):
        trade = TradeRecord(symbol="TSLA", side="short", quantity=50,
                            entry_price=200, exit_price=180,
                            entry_time="t0", exit_time="t1")
        assert trade.pnl == 1000

    def test_commission(self):
        trade = TradeRecord(symbol="AAPL", side="long", quantity=100,
                            entry_price=150, exit_price=160,
                            entry_time="t0", exit_time="t1", commission=10)
        assert trade.pnl == 990


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Portfolio
# ═══════════════════════════════════════════════════════════════════════════════

class TestPortfolio:
    def test_initial_state(self):
        p = Portfolio(initial_capital=100000)
        assert p.total_equity == 100000
        assert p.position_count == 0
        assert p.cash == 100000

    def test_open_position(self):
        p = Portfolio(initial_capital=100000)
        pos = p.open_position("AAPL", quantity=100, price=150)
        assert p.position_count == 1
        assert p.cash == 85000

    def test_close_position(self):
        p = Portfolio(initial_capital=100000)
        pos = p.open_position("AAPL", quantity=100, price=150)
        trade = p.close_position(pos.id, price=160)
        assert trade is not None
        assert trade.pnl == 1000
        assert p.position_count == 0
        assert p.cash == 101000  # 85000 + 16000 = 101000

    def test_exposure(self):
        p = Portfolio(initial_capital=200000)
        p.open_position("AAPL", 100, 150, side="long")
        p.open_position("TSLA", 50, 200, side="short")
        assert p.long_exposure == 15000
        assert p.short_exposure == 10000
        assert p.gross_exposure == 25000
        assert p.net_exposure == 5000

    def test_sector_exposure(self):
        p = Portfolio(initial_capital=100000)
        p.open_position("AAPL", 100, 150, sector="Tech")
        p.open_position("JPM", 50, 100, sector="Finance")
        sectors = p.sector_exposure()
        assert "Tech" in sectors
        assert "Finance" in sectors

    def test_concentration(self):
        p = Portfolio(initial_capital=100000)
        p.open_position("AAPL", 100, 150)
        p.open_position("GOOG", 50, 100)
        conc = p.concentration()
        assert conc["hhi"] > 0
        assert len(conc["top_positions"]) == 2

    def test_summary(self):
        p = Portfolio(initial_capital=100000)
        p.open_position("AAPL", 100, 150)
        s = p.summary()
        assert s["position_count"] == 1
        assert s["initial_capital"] == 100000

    def test_update_prices(self):
        p = Portfolio(initial_capital=100000)
        pos = p.open_position("AAPL", 100, 150)
        p.update_prices({"AAPL": 160})
        assert p.total_unrealized_pnl == 1000

    def test_leverage(self):
        p = Portfolio(initial_capital=50000)
        p.open_position("AAPL", 100, 150)
        p.open_position("GOOG", 50, 200)
        assert p.leverage > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test PerformanceEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestPerformanceEngine:
    def test_returns(self):
        prices = pd.Series([100, 102, 101, 105])
        ret = PerformanceEngine.returns(prices)
        assert len(ret) == 3
        assert ret.iloc[0] == pytest.approx(0.02)

    def test_log_returns(self):
        prices = pd.Series([100, 102, 101, 105])
        ret = PerformanceEngine.log_returns(prices)
        assert len(ret) == 3

    def test_cumulative_returns(self):
        ret = pd.Series([0.01, 0.02, -0.01, 0.03])
        cum = PerformanceEngine.cumulative_returns(ret)
        assert len(cum) == 4
        assert cum.iloc[-1] > 0

    def test_annualized_return(self, sample_returns):
        ann = PerformanceEngine.annualized_return(sample_returns)
        assert isinstance(ann, float)

    def test_annualized_volatility(self, sample_returns):
        vol = PerformanceEngine.annualized_volatility(sample_returns)
        assert vol > 0

    def test_sharpe_ratio(self, sample_returns):
        sharpe = PerformanceEngine.sharpe_ratio(sample_returns)
        assert isinstance(sharpe, float)

    def test_sortino_ratio(self, sample_returns):
        sortino = PerformanceEngine.sortino_ratio(sample_returns)
        assert isinstance(sortino, float)

    def test_calmar_ratio(self, sample_returns):
        calmar = PerformanceEngine.calmar_ratio(sample_returns)
        assert isinstance(calmar, float)

    def test_omega_ratio(self, sample_returns):
        omega = PerformanceEngine.omega_ratio(sample_returns)
        assert omega >= 0

    def test_information_ratio(self, sample_returns):
        bench = pd.Series(np.random.RandomState(99).randn(500) * 0.01)
        ir = PerformanceEngine.information_ratio(sample_returns, bench)
        assert isinstance(ir, float)

    def test_var_historical(self, sample_returns):
        var = PerformanceEngine.var_historical(sample_returns, 0.95)
        assert var < 0

    def test_var_parametric(self, sample_returns):
        var = PerformanceEngine.var_parametric(sample_returns, 0.95)
        assert var < 0

    def test_cvar(self, sample_returns):
        cvar = PerformanceEngine.cvar(sample_returns, 0.95)
        assert cvar < 0

    def test_win_rate(self, sample_trades):
        wr = PerformanceEngine.win_rate(sample_trades)
        assert 0 <= wr <= 100

    def test_profit_factor(self, sample_trades):
        pf = PerformanceEngine.profit_factor(sample_trades)
        assert pf > 0

    def test_avg_win_loss_ratio(self, sample_trades):
        ratio = PerformanceEngine.avg_win_loss_ratio(sample_trades)
        assert ratio > 0

    def test_expectancy(self, sample_trades):
        exp = PerformanceEngine.expectancy(sample_trades)
        assert isinstance(exp, float)

    def test_kelly_criterion(self, sample_trades):
        kelly = PerformanceEngine.kelly_criterion(sample_trades)
        assert isinstance(kelly, float)

    def test_rolling_sharpe(self, sample_returns):
        rs = PerformanceEngine.rolling_sharpe(sample_returns, window=60)
        assert len(rs) == 500
        valid = rs.dropna()
        assert len(valid) > 0

    def test_full_report(self, sample_returns, sample_trades):
        report = PerformanceEngine.full_report(sample_returns, trades=sample_trades)
        assert "annualized_return" in report
        assert "sharpe_ratio" in report
        assert "win_rate" in report
        assert "max_drawdown" in report

    def test_full_report_with_benchmark(self, sample_returns):
        bench = pd.Series(np.random.RandomState(99).randn(500) * 0.01)
        report = PerformanceEngine.full_report(sample_returns, benchmark=bench)
        assert "information_ratio" in report
        assert "beta" in report
        assert "alpha" in report


# ═══════════════════════════════════════════════════════════════════════════════
#  Test DrawdownAnalyzer
# ═══════════════════════════════════════════════════════════════════════════════

class TestDrawdownAnalyzer:
    def test_max_drawdown(self, sample_returns):
        dd = DrawdownAnalyzer.max_drawdown(sample_returns)
        assert dd < 0

    def test_drawdown_series(self, sample_returns):
        dd = DrawdownAnalyzer.drawdown_series(sample_returns)
        assert (dd <= 0).all()

    def test_drawdown_periods(self, sample_returns):
        periods = DrawdownAnalyzer.drawdown_periods(sample_returns, top_n=3)
        assert len(periods) <= 3
        for p in periods:
            assert p["depth"] < 0

    def test_time_to_recovery(self, sample_returns):
        ttr = DrawdownAnalyzer.time_to_recovery(sample_returns)
        assert ttr is None or ttr >= 0

    def test_pain_index(self, sample_returns):
        pi = DrawdownAnalyzer.pain_index(sample_returns)
        assert pi >= 0

    def test_ulcer_index(self, sample_returns):
        ui = DrawdownAnalyzer.ulcer_index(sample_returns)
        assert ui >= 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test FactorModel
# ═══════════════════════════════════════════════════════════════════════════════

class TestFactorModel:
    def test_single_factor(self, sample_returns):
        factor = pd.Series(np.random.RandomState(99).randn(500) * 0.01)
        result = FactorModel.single_factor(sample_returns, factor)
        assert "alpha" in result
        assert "beta" in result
        assert "r_squared" in result
        assert 0 <= result["r_squared"] <= 1

    def test_multi_factor(self, sample_returns):
        rng = np.random.RandomState(99)
        factors = pd.DataFrame({
            'market': rng.randn(500) * 0.01,
            'size': rng.randn(500) * 0.005,
            'value': rng.randn(500) * 0.005,
        })
        result = FactorModel.multi_factor(sample_returns, factors)
        assert "alpha" in result
        assert "betas" in result
        assert "r_squared" in result

    def test_rolling_beta(self, sample_returns):
        bench = pd.Series(np.random.RandomState(99).randn(500) * 0.01)
        rb = FactorModel.rolling_beta(sample_returns, bench, window=60)
        assert len(rb) == 500

    def test_style_analysis(self, sample_returns):
        rng = np.random.RandomState(99)
        styles = pd.DataFrame({
            'growth': rng.randn(500) * 0.01,
            'value': rng.randn(500) * 0.01,
            'momentum': rng.randn(500) * 0.01,
        })
        result = FactorModel.style_analysis(sample_returns, styles)
        # Weights should sum to ~1
        assert abs(sum(result.values()) - 1.0) < 0.05


# ═══════════════════════════════════════════════════════════════════════════════
#  Test PortfolioOptimizer
# ═══════════════════════════════════════════════════════════════════════════════

class TestPortfolioOptimizer:
    def test_mean_variance(self, multi_asset_returns):
        result = PortfolioOptimizer.mean_variance(multi_asset_returns)
        assert "weights" in result
        assert abs(sum(result["weights"].values()) - 1.0) < 0.01
        assert all(w >= -0.01 for w in result["weights"].values())

    def test_min_variance(self, multi_asset_returns):
        result = PortfolioOptimizer.min_variance(multi_asset_returns)
        assert abs(sum(result["weights"].values()) - 1.0) < 0.01

    def test_risk_parity(self, multi_asset_returns):
        result = PortfolioOptimizer.risk_parity(multi_asset_returns)
        assert "weights" in result
        assert "risk_contributions" in result
        assert abs(sum(result["weights"].values()) - 1.0) < 0.01

    def test_efficient_frontier(self, multi_asset_returns):
        frontier = PortfolioOptimizer.efficient_frontier(multi_asset_returns, n_points=10)
        assert len(frontier) >= 5


# ═══════════════════════════════════════════════════════════════════════════════
#  Test AttributionEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestAttributionEngine:
    def test_brinson_attribution(self):
        pw = pd.Series({"Tech": 0.40, "Finance": 0.30, "Energy": 0.30})
        bw = pd.Series({"Tech": 0.35, "Finance": 0.35, "Energy": 0.30})
        pr = pd.Series({"Tech": 0.10, "Finance": 0.05, "Energy": -0.02})
        br = pd.Series({"Tech": 0.08, "Finance": 0.06, "Energy": 0.01})
        result = AttributionEngine.brinson_attribution(pw, bw, pr, br)
        assert "total_allocation" in result
        assert "total_selection" in result
        assert "detail" in result

    def test_security_contribution(self):
        weights = pd.Series({"AAPL": 0.3, "GOOG": 0.4, "MSFT": 0.3})
        returns = pd.Series({"AAPL": 0.05, "GOOG": -0.02, "MSFT": 0.08})
        result = AttributionEngine.security_contribution(weights, returns)
        assert "contribution" in result.columns
        assert len(result) == 3


# ═══════════════════════════════════════════════════════════════════════════════
#  Test RiskBudgeting
# ═══════════════════════════════════════════════════════════════════════════════

class TestRiskBudgeting:
    def test_risk_contributions(self):
        w = np.array([0.4, 0.3, 0.3])
        cov = np.array([[0.04, 0.01, 0.005],
                         [0.01, 0.03, 0.008],
                         [0.005, 0.008, 0.02]])
        result = RiskBudgeting.risk_contributions(w, cov)
        assert result["total_risk"] > 0
        assert len(result["contributions"]) == 3

    def test_component_var(self):
        w = np.array([0.5, 0.3, 0.2])
        cov = np.array([[0.04, 0.01, 0.005],
                         [0.01, 0.03, 0.008],
                         [0.005, 0.008, 0.02]])
        result = RiskBudgeting.component_var(w, cov, portfolio_value=1000000)
        assert result["total_var"] > 0

    def test_monte_carlo_var(self, multi_asset_returns):
        w = np.array([0.25, 0.25, 0.25, 0.25])
        result = RiskBudgeting.monte_carlo_var(multi_asset_returns, w, n_simulations=1000)
        assert result["var"] < 0
        assert result["cvar"] <= result["var"]

    def test_stress_test(self, multi_asset_returns):
        w = np.array([0.25, 0.25, 0.25, 0.25])
        scenarios = {
            "crash": {"AAPL": -0.20, "GOOG": -0.25, "MSFT": -0.15, "AMZN": -0.30},
            "rally": {"AAPL": 0.10, "GOOG": 0.15, "MSFT": 0.12, "AMZN": 0.20},
        }
        result = RiskBudgeting.stress_test(multi_asset_returns, scenarios, w)
        assert result["crash"] < 0
        assert result["rally"] > 0
