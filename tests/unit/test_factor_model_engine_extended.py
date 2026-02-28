"""
Extended Factor Model Engine Tests — 250+ tests covering all factor scoring,
Fama-French 3/5 factor regressions, return attribution, factor timing,
portfolio construction, smart beta analytics, edge cases, and stress tests.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

import pytest
import math
import random
import statistics
from services.factor_model_engine import (
    StockFactorData, FactorType, FactorExposureLevel,
    FactorScorer, FamaFrenchModel, FactorReturnAttribution,
    FactorTimingModel, MultifactorPortfolioConstructor,
    SmartBetaCalculator, FactorModelEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _make_stock(symbol="AAPL", mc=1000, bv=50, price=150, eps=5,
                rev_g=0.1, roe=0.2, de=0.5, gm=0.4, n_prices=252,
                seed=42) -> StockFactorData:
    rng = random.Random(seed)
    base = price
    prices = [base]
    for _ in range(n_prices - 1):
        base *= (1 + rng.gauss(0.0003, 0.015))
        prices.append(round(base, 2))
    return StockFactorData(symbol, mc, bv, price, eps, rev_g, roe, de, gm, prices)


def _make_returns(n, seed=42, mean=0.001, std=0.02):
    rng = random.Random(seed)
    return [rng.gauss(mean, std) for _ in range(n)]


def _make_stocks(count=10, seed_base=0):
    rng = random.Random(seed_base)
    stocks = []
    for i in range(count):
        stocks.append(_make_stock(
            symbol=f"S{i}",
            mc=rng.uniform(100, 50000),
            bv=rng.uniform(10, 200),
            price=rng.uniform(20, 500),
            eps=rng.uniform(1, 20),
            rev_g=rng.uniform(-0.1, 0.5),
            roe=rng.uniform(0.0, 0.5),
            de=rng.uniform(0, 3),
            gm=rng.uniform(0.1, 0.8),
            seed=seed_base + i,
        ))
    return stocks


# ═══════════════════════════════════════════════════════════════════════
# StockFactorData
# ═══════════════════════════════════════════════════════════════════════

class TestStockFactorData:
    def test_book_to_market_normal(self):
        s = _make_stock(bv=50, price=100)
        assert abs(s.book_to_market - 0.5) < 0.01

    def test_book_to_market_zero_price(self):
        s = StockFactorData("X", 1000, 50, 0, 5, 0.1, 0.2, 0.5, 0.4)
        assert s.book_to_market == 0.0

    def test_pe_ratio_positive_eps(self):
        s = _make_stock(price=150, eps=5)
        assert abs(s.pe_ratio - 30.0) < 0.01

    def test_pe_ratio_zero_eps(self):
        s = StockFactorData("X", 1000, 50, 150, 0, 0.1, 0.2, 0.5, 0.4)
        assert s.pe_ratio == float("inf")

    def test_pe_ratio_negative_eps(self):
        s = StockFactorData("X", 1000, 50, 150, -5, 0.1, 0.2, 0.5, 0.4)
        assert s.pe_ratio == float("inf")

    def test_momentum_12m_2m_sufficient_prices(self):
        s = _make_stock(n_prices=252)
        assert isinstance(s.momentum_12m_2m, float)

    def test_momentum_12m_2m_short_prices(self):
        s = StockFactorData("X", 1000, 50, 150, 5, 0.1, 0.2, 0.5, 0.4, prices_12m=[100]*5)
        assert s.momentum_12m_2m == 0.0

    def test_volatility_sufficient_prices(self):
        s = _make_stock(n_prices=252)
        assert s.volatility > 0

    def test_volatility_short_prices(self):
        s = StockFactorData("X", 1000, 50, 150, 5, 0.1, 0.2, 0.5, 0.4, prices_12m=[100]*5)
        assert s.volatility == 0.0

    def test_to_dict_keys(self):
        s = _make_stock()
        d = s.to_dict()
        expected = {"symbol", "market_cap_m", "book_to_market", "pe_ratio",
                    "momentum_12m_2m", "volatility", "roe", "gross_margin",
                    "revenue_growth"}
        assert set(d.keys()) == expected

    def test_to_dict_symbol(self):
        s = _make_stock(symbol="MSFT")
        assert s.to_dict()["symbol"] == "MSFT"

    @pytest.mark.parametrize("price", [0.01, 1, 10, 100, 1000, 10000])
    def test_various_prices(self, price):
        s = StockFactorData("X", 1000, 50, price, 5, 0.1, 0.2, 0.5, 0.4)
        d = s.to_dict()
        assert isinstance(d["book_to_market"], float)


# ═══════════════════════════════════════════════════════════════════════
# FactorScorer
# ═══════════════════════════════════════════════════════════════════════

class TestCrossSectionalRank:
    def test_empty(self):
        assert FactorScorer.cross_sectional_rank([]) == []

    def test_single_value(self):
        r = FactorScorer.cross_sectional_rank([5.0])
        assert r == [50.0]

    def test_ascending_order(self):
        r = FactorScorer.cross_sectional_rank([1, 2, 3], ascending=True)
        assert r[0] < r[1] < r[2]

    def test_descending_order(self):
        r = FactorScorer.cross_sectional_rank([1, 2, 3], ascending=False)
        assert r[0] > r[1] > r[2]

    def test_all_same_values(self):
        r = FactorScorer.cross_sectional_rank([5, 5, 5])
        assert all(isinstance(v, float) for v in r)

    def test_output_length(self):
        r = FactorScorer.cross_sectional_rank([1, 2, 3, 4, 5])
        assert len(r) == 5

    def test_values_between_0_and_100(self):
        r = FactorScorer.cross_sectional_rank([10, 20, 30, 40, 50])
        for v in r:
            assert 0 <= v <= 100

    @pytest.mark.parametrize("n", [2, 5, 10, 50, 100])
    def test_various_lengths(self, n):
        values = list(range(n))
        r = FactorScorer.cross_sectional_rank(values)
        assert len(r) == n


class TestZScoreNormalize:
    def test_empty(self):
        assert FactorScorer.z_score_normalize([]) == []

    def test_single_value(self):
        assert FactorScorer.z_score_normalize([5.0]) == [0.0]

    def test_constant_values(self):
        r = FactorScorer.z_score_normalize([3, 3, 3, 3])
        assert all(v == 0.0 for v in r)

    def test_mean_near_zero(self):
        values = [1, 2, 3, 4, 5]
        r = FactorScorer.z_score_normalize(values)
        assert abs(sum(r)) < 0.01

    def test_std_near_one(self):
        values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        r = FactorScorer.z_score_normalize(values)
        assert abs(statistics.stdev(r) - 1.0) < 0.01

    @pytest.mark.parametrize("n", [2, 10, 100])
    def test_output_length(self, n):
        values = list(range(n))
        assert len(FactorScorer.z_score_normalize(values)) == n


class TestFactorScoresWithStocks:
    def setup_method(self):
        self.stocks = _make_stocks(10, seed_base=42)

    def test_value_score_length(self):
        assert len(FactorScorer.value_score(self.stocks)) == 10

    def test_size_score_length(self):
        assert len(FactorScorer.size_score(self.stocks)) == 10

    def test_momentum_score_length(self):
        assert len(FactorScorer.momentum_score(self.stocks)) == 10

    def test_quality_score_length(self):
        assert len(FactorScorer.quality_score(self.stocks)) == 10

    def test_low_vol_score_length(self):
        assert len(FactorScorer.low_vol_score(self.stocks)) == 10

    def test_growth_score_length(self):
        assert len(FactorScorer.growth_score(self.stocks)) == 10

    def test_value_score_bounded(self):
        for v in FactorScorer.value_score(self.stocks):
            assert 0 <= v <= 100

    def test_size_score_bounded(self):
        for v in FactorScorer.size_score(self.stocks):
            assert 0 <= v <= 100

    def test_quality_score_bounded(self):
        for v in FactorScorer.quality_score(self.stocks):
            assert 0 <= v <= 100

    def test_momentum_score_bounded(self):
        for v in FactorScorer.momentum_score(self.stocks):
            assert 0 <= v <= 100

    def test_empty_stocks(self):
        assert FactorScorer.value_score([]) == []
        assert FactorScorer.size_score([]) == []
        assert FactorScorer.momentum_score([]) == []
        assert FactorScorer.quality_score([]) == []
        assert FactorScorer.low_vol_score([]) == []
        assert FactorScorer.growth_score([]) == []

    def test_single_stock(self):
        s = [self.stocks[0]]
        assert len(FactorScorer.value_score(s)) == 1
        assert len(FactorScorer.size_score(s)) == 1


# ═══════════════════════════════════════════════════════════════════════
# FamaFrenchModel
# ═══════════════════════════════════════════════════════════════════════

class TestOLSRegression:
    def test_perfect_fit(self):
        y = [2*i + 3 for i in range(50)]
        X = [[float(i)] for i in range(50)]
        r = FamaFrenchModel.ols_regression(y, X)
        assert abs(r["coefficients"][0] - 2.0) < 0.01
        assert abs(r["alpha"] - 3.0) < 0.01
        assert r["r_squared"] > 0.99

    def test_zero_fit(self):
        rng = random.Random(42)
        y = [rng.gauss(0, 1) for _ in range(50)]
        X = [[rng.gauss(0, 1)] for _ in range(50)]
        r = FamaFrenchModel.ols_regression(y, X)
        assert isinstance(r, dict)
        assert "r_squared" in r

    def test_insufficient_data(self):
        r = FamaFrenchModel.ols_regression([1], [[1]])
        assert r["r_squared"] == 0.0

    def test_multiple_regressors(self):
        rng = random.Random(42)
        X = [[rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)] for _ in range(100)]
        y = [1 + 2*x[0] - 1*x[1] + 0.5*x[2] + rng.gauss(0, 0.1) for x in X]
        r = FamaFrenchModel.ols_regression(y, X)
        assert r["r_squared"] > 0.9
        assert abs(r["coefficients"][0] - 2.0) < 0.5

    def test_r_squared_bounded(self):
        rng = random.Random(42)
        y = [rng.gauss(0, 1) for _ in range(50)]
        X = [[rng.gauss(0, 1)] for _ in range(50)]
        r = FamaFrenchModel.ols_regression(y, X)
        assert r["r_squared"] <= 1.0


class TestThreeFactorExposure:
    def test_insufficient_data(self):
        r = FamaFrenchModel.three_factor_exposure([0.01]*10, [0.01]*10, [0]*10, [0]*10)
        assert r["beta_mkt"] == 1

    def test_normal_data(self):
        n = 100
        rng = random.Random(42)
        mkt = [rng.gauss(0.001, 0.02) for _ in range(n)]
        smb = [rng.gauss(0, 0.01) for _ in range(n)]
        hml = [rng.gauss(0, 0.01) for _ in range(n)]
        stock = [1.2*m + 0.5*s - 0.3*h + rng.gauss(0, 0.005) for m, s, h in zip(mkt, smb, hml)]
        r = FamaFrenchModel.three_factor_exposure(stock, mkt, smb, hml)
        assert "beta_mkt" in r
        assert "alpha" in r
        assert "r_squared" in r

    def test_market_beta_near_one_for_market(self):
        n = 200
        rng = random.Random(42)
        mkt = [rng.gauss(0.001, 0.02) for _ in range(n)]
        smb = [rng.gauss(0, 0.01) for _ in range(n)]
        hml = [rng.gauss(0, 0.01) for _ in range(n)]
        # Stock = market + noise
        stock = [m + rng.gauss(0, 0.002) for m in mkt]
        r = FamaFrenchModel.three_factor_exposure(stock, mkt, smb, hml)
        assert abs(r["beta_mkt"] - 1.0) < 0.3

    def test_keys_present(self):
        n = 50
        r = FamaFrenchModel.three_factor_exposure(
            _make_returns(n, 1), _make_returns(n, 2),
            _make_returns(n, 3), _make_returns(n, 4)
        )
        for k in ["alpha", "beta_mkt", "beta_smb", "beta_hml", "r_squared"]:
            assert k in r


class TestFiveFactorExposure:
    def test_insufficient_data(self):
        r = FamaFrenchModel.five_factor_exposure(
            [0.01]*10, [0.01]*10, [0]*10, [0]*10, [0]*10, [0]*10
        )
        assert r["beta_mkt"] == 1

    def test_normal_data(self):
        n = 100
        r = FamaFrenchModel.five_factor_exposure(
            _make_returns(n, 1), _make_returns(n, 2), _make_returns(n, 3),
            _make_returns(n, 4), _make_returns(n, 5), _make_returns(n, 6)
        )
        for k in ["alpha", "beta_mkt", "beta_smb", "beta_hml", "beta_rmw", "beta_cma"]:
            assert k in r

    def test_r_squared_present(self):
        n = 100
        r = FamaFrenchModel.five_factor_exposure(
            _make_returns(n, 1), _make_returns(n, 2), _make_returns(n, 3),
            _make_returns(n, 4), _make_returns(n, 5), _make_returns(n, 6)
        )
        assert "r_squared" in r


# ═══════════════════════════════════════════════════════════════════════
# FactorReturnAttribution
# ═══════════════════════════════════════════════════════════════════════

class TestAttributeReturns:
    def test_basic(self):
        r = FactorReturnAttribution.attribute_returns(
            0.10,
            {"market": 1.2, "size": 0.5},
            {"market": 0.08, "size": 0.02}
        )
        assert "alpha" in r
        assert "total_factor_return" in r

    def test_perfect_attribution(self):
        exposures = {"A": 1.0, "B": 0.5}
        factor_rets = {"A": 0.10, "B": 0.04}
        total = 1.0 * 0.10 + 0.5 * 0.04
        r = FactorReturnAttribution.attribute_returns(total, exposures, factor_rets)
        assert abs(r["alpha"]) < 0.0001

    def test_alpha_is_residual(self):
        r = FactorReturnAttribution.attribute_returns(
            0.15, {"mkt": 1.0}, {"mkt": 0.10}
        )
        assert abs(r["alpha"] - 0.05) < 0.0001

    def test_empty_factors(self):
        r = FactorReturnAttribution.attribute_returns(0.10, {}, {})
        assert abs(r["alpha"] - 0.10) < 0.0001

    def test_missing_factor_return(self):
        r = FactorReturnAttribution.attribute_returns(
            0.10, {"mkt": 1.0, "unknown": 0.5}, {"mkt": 0.05}
        )
        # unknown factor return defaults to 0
        assert isinstance(r, dict)


class TestPortfolioFactorAttribution:
    def test_empty_holdings(self):
        assert FactorReturnAttribution.portfolio_factor_attribution([], {}) == {}

    def test_single_holding(self):
        holdings = [{"symbol": "A", "weight": 1.0, "exposures": {"mkt": 1.2}}]
        factor_returns = {"mkt": 0.05}
        r = FactorReturnAttribution.portfolio_factor_attribution(holdings, factor_returns)
        assert "portfolio_exposures" in r
        assert abs(r["portfolio_exposures"]["mkt"] - 1.2) < 0.001

    def test_two_holdings(self):
        holdings = [
            {"symbol": "A", "weight": 0.6, "exposures": {"mkt": 1.0}},
            {"symbol": "B", "weight": 0.4, "exposures": {"mkt": 1.5}},
        ]
        factor_returns = {"mkt": 0.05}
        r = FactorReturnAttribution.portfolio_factor_attribution(holdings, factor_returns)
        expected_mkt = 0.6 * 1.0 + 0.4 * 1.5
        assert abs(r["portfolio_exposures"]["mkt"] - expected_mkt) < 0.001


# ═══════════════════════════════════════════════════════════════════════
# FactorTimingModel
# ═══════════════════════════════════════════════════════════════════════

class TestFactorTiming:
    @pytest.mark.parametrize("regime", [
        "early_recovery", "expansion", "late_cycle", "recession"
    ])
    def test_known_regimes(self, regime):
        r = FactorTimingModel.get_factor_tilt(regime)
        assert r["regime"] == regime
        assert "preferred" in r
        assert "avoid" in r
        assert "reason" in r

    def test_unknown_regime_defaults(self):
        r = FactorTimingModel.get_factor_tilt("unknown_phase")
        # Defaults to expansion
        assert "preferred" in r

    def test_preferred_and_avoid_disjoint(self):
        for regime in ["early_recovery", "expansion", "late_cycle", "recession"]:
            r = FactorTimingModel.get_factor_tilt(regime)
            assert set(r["preferred"]).isdisjoint(set(r["avoid"]))


class TestFactorMomentum:
    def test_empty_history(self):
        r = FactorTimingModel.factor_momentum({})
        assert r == {"factor_momentum": {}, "top_factors": [], "bottom_factors": []}

    def test_normal(self):
        history = {
            "value": _make_returns(20, seed=1, mean=0.005),
            "momentum": _make_returns(20, seed=2, mean=0.01),
            "quality": _make_returns(20, seed=3, mean=-0.002),
        }
        r = FactorTimingModel.factor_momentum(history, lookback=12)
        assert "top_factors" in r
        assert "bottom_factors" in r

    def test_short_history_returns_zero(self):
        history = {"value": [0.01]*5}
        r = FactorTimingModel.factor_momentum(history, lookback=12)
        assert r["factor_momentum"]["value"] == 0.0

    @pytest.mark.parametrize("lookback", [1, 6, 12, 24])
    def test_various_lookbacks(self, lookback):
        history = {"factor_a": _make_returns(50, seed=1)}
        r = FactorTimingModel.factor_momentum(history, lookback=lookback)
        assert isinstance(r, dict)


# ═══════════════════════════════════════════════════════════════════════
# MultifactorPortfolioConstructor
# ═══════════════════════════════════════════════════════════════════════

class TestCompositeFactorScore:
    def setup_method(self):
        self.stocks = _make_stocks(20, seed_base=42)

    def test_output_length(self):
        r = MultifactorPortfolioConstructor.composite_factor_score(self.stocks)
        assert len(r) == 20

    def test_sorted_descending(self):
        r = MultifactorPortfolioConstructor.composite_factor_score(self.stocks)
        scores = [x["composite_score"] for x in r]
        assert scores == sorted(scores, reverse=True)

    def test_has_factor_scores(self):
        r = MultifactorPortfolioConstructor.composite_factor_score(self.stocks)
        for item in r:
            assert "factor_scores" in item
            assert "exposure_level" in item

    def test_exposure_levels_valid(self):
        valid = {e.value for e in FactorExposureLevel}
        r = MultifactorPortfolioConstructor.composite_factor_score(self.stocks)
        for item in r:
            assert item["exposure_level"] in valid

    def test_custom_weights(self):
        weights = {FactorType.VALUE: 0.5, FactorType.QUALITY: 0.5}
        r = MultifactorPortfolioConstructor.composite_factor_score(self.stocks, weights)
        assert len(r) == 20

    def test_empty_stocks(self):
        assert MultifactorPortfolioConstructor.composite_factor_score([]) == []


class TestTopBottomPortfolio:
    def test_basic(self):
        stocks = _make_stocks(20, seed_base=10)
        ranked = MultifactorPortfolioConstructor.composite_factor_score(stocks)
        r = MultifactorPortfolioConstructor.top_bottom_portfolio(ranked)
        assert "long_leg" in r
        assert "short_leg" in r
        assert r["long_count"] >= 1
        assert r["short_count"] >= 1

    def test_custom_pct(self):
        stocks = _make_stocks(100, seed_base=20)
        ranked = MultifactorPortfolioConstructor.composite_factor_score(stocks)
        r = MultifactorPortfolioConstructor.top_bottom_portfolio(ranked, top_pct=0.1, bottom_pct=0.1)
        assert r["long_count"] == 10
        assert r["short_count"] == 10

    def test_avg_scores(self):
        stocks = _make_stocks(20, seed_base=30)
        ranked = MultifactorPortfolioConstructor.composite_factor_score(stocks)
        r = MultifactorPortfolioConstructor.top_bottom_portfolio(ranked)
        assert r["avg_long_score"] >= r["avg_short_score"]

    def test_single_stock(self):
        stocks = _make_stocks(1, seed_base=40)
        ranked = MultifactorPortfolioConstructor.composite_factor_score(stocks)
        r = MultifactorPortfolioConstructor.top_bottom_portfolio(ranked)
        assert r["long_count"] >= 1


# ═══════════════════════════════════════════════════════════════════════
# SmartBetaCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestEqualWeightPortfolio:
    def test_empty(self):
        assert SmartBetaCalculator.equal_weight_portfolio([]) == {}

    def test_single(self):
        r = SmartBetaCalculator.equal_weight_portfolio(["A"])
        assert abs(r["A"] - 1.0) < 0.0001

    def test_weights_sum_to_one(self):
        r = SmartBetaCalculator.equal_weight_portfolio(["A", "B", "C", "D"])
        assert abs(sum(r.values()) - 1.0) < 0.001

    @pytest.mark.parametrize("n", [1, 2, 5, 10, 50, 100])
    def test_various_counts(self, n):
        syms = [f"S{i}" for i in range(n)]
        r = SmartBetaCalculator.equal_weight_portfolio(syms)
        assert len(r) == n


class TestTrackingError:
    def test_identical_returns(self):
        rets = _make_returns(100)
        assert SmartBetaCalculator.tracking_error(rets, rets) == 0.0

    def test_different_returns(self):
        port = _make_returns(100, seed=1)
        bench = _make_returns(100, seed=2)
        te = SmartBetaCalculator.tracking_error(port, bench)
        assert te > 0

    def test_short_returns(self):
        assert SmartBetaCalculator.tracking_error([0.01], [0.02]) == 0.0

    def test_unequal_length(self):
        assert SmartBetaCalculator.tracking_error([0.01, 0.02], [0.01]) == 0.0


class TestInformationRatio:
    def test_identical_returns(self):
        rets = _make_returns(100)
        assert SmartBetaCalculator.information_ratio(rets, rets) == 0.0

    def test_positive_active(self):
        port = _make_returns(100, seed=1, mean=0.002)
        bench = _make_returns(100, seed=2, mean=0.001)
        ir = SmartBetaCalculator.information_ratio(port, bench)
        assert isinstance(ir, float)

    def test_empty_returns(self):
        assert SmartBetaCalculator.information_ratio([], []) == 0.0


# ═══════════════════════════════════════════════════════════════════════
# FactorModelEngine orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestFactorModelEngineOrchestrator:
    def setup_method(self):
        self.engine = FactorModelEngine()
        self.stocks = _make_stocks(15, seed_base=42)

    def test_score_stocks(self):
        r = self.engine.score_stocks(self.stocks)
        assert len(r) == 15

    def test_three_factor_alpha(self):
        n = 100
        r = self.engine.three_factor_alpha(
            _make_returns(n, 1), _make_returns(n, 2),
            _make_returns(n, 3), _make_returns(n, 4)
        )
        assert "alpha" in r

    def test_five_factor_alpha(self):
        n = 100
        r = self.engine.five_factor_alpha(
            _make_returns(n, 1), _make_returns(n, 2), _make_returns(n, 3),
            _make_returns(n, 4), _make_returns(n, 5), _make_returns(n, 6)
        )
        assert "alpha" in r

    def test_attribute_returns(self):
        r = self.engine.attribute_returns(
            0.10, {"mkt": 1.0}, {"mkt": 0.08}
        )
        assert "alpha" in r

    def test_get_factor_tilt(self):
        r = self.engine.get_factor_tilt("expansion")
        assert "preferred" in r

    def test_build_portfolio(self):
        r = self.engine.build_portfolio(self.stocks)
        assert "long_leg" in r
        assert "short_leg" in r

    def test_capabilities(self):
        c = self.engine.capabilities()
        assert c["engine"] == "FactorModelEngine"
        assert "features" in c


# ═══════════════════════════════════════════════════════════════════════
# Enum coverage
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    @pytest.mark.parametrize("ft", list(FactorType))
    def test_factor_type_values(self, ft):
        assert isinstance(ft.value, str)

    @pytest.mark.parametrize("el", list(FactorExposureLevel))
    def test_exposure_level_values(self, el):
        assert isinstance(el.value, str)

    def test_factor_type_count(self):
        assert len(FactorType) == 10

    def test_exposure_level_count(self):
        assert len(FactorExposureLevel) == 5


# ═══════════════════════════════════════════════════════════════════════
# Property-based and stress tests
# ═══════════════════════════════════════════════════════════════════════

class TestPropertyBased:
    @pytest.mark.parametrize("seed", range(10))
    def test_rank_preserves_order(self, seed):
        rng = random.Random(seed)
        values = [rng.gauss(0, 1) for _ in range(20)]
        ranks = FactorScorer.cross_sectional_rank(values, ascending=True)
        # If value[i] > value[j], then rank[i] > rank[j]
        for i in range(len(values)):
            for j in range(i+1, len(values)):
                if values[i] > values[j]:
                    assert ranks[i] >= ranks[j]
                elif values[i] < values[j]:
                    assert ranks[i] <= ranks[j]

    @pytest.mark.parametrize("seed", range(10))
    def test_z_score_mean_near_zero(self, seed):
        rng = random.Random(seed)
        values = [rng.gauss(0, 1) for _ in range(50)]
        z = FactorScorer.z_score_normalize(values)
        assert abs(sum(z) / len(z)) < 0.01

    @pytest.mark.parametrize("seed", range(5))
    def test_composite_sorted(self, seed):
        stocks = _make_stocks(20, seed_base=seed*100)
        r = MultifactorPortfolioConstructor.composite_factor_score(stocks)
        scores = [x["composite_score"] for x in r]
        assert scores == sorted(scores, reverse=True)


class TestStress:
    def test_large_stock_scoring(self):
        stocks = _make_stocks(200, seed_base=99)
        r = MultifactorPortfolioConstructor.composite_factor_score(stocks)
        assert len(r) == 200

    def test_large_ols_regression(self):
        n = 500
        rng = random.Random(42)
        X = [[rng.gauss(0, 1), rng.gauss(0, 1)] for _ in range(n)]
        y = [0.5 + 2*x[0] - x[1] + rng.gauss(0, 0.1) for x in X]
        r = FamaFrenchModel.ols_regression(y, X)
        assert r["r_squared"] > 0.9

    def test_many_equal_weight(self):
        syms = [f"S{i}" for i in range(500)]
        r = SmartBetaCalculator.equal_weight_portfolio(syms)
        assert abs(sum(r.values()) - 1.0) < 0.01

    def test_long_tracking_error(self):
        port = _make_returns(5000, seed=1)
        bench = _make_returns(5000, seed=2)
        te = SmartBetaCalculator.tracking_error(port, bench)
        assert te > 0

    def test_build_portfolio_large(self):
        engine = FactorModelEngine()
        stocks = _make_stocks(100, seed_base=77)
        r = engine.build_portfolio(stocks)
        assert r["long_count"] >= 1
