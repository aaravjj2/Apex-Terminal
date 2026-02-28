"""
Tests for FactorModelEngine — Fama-French, multi-factor scoring, attribution, timing.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

from services.factor_model_engine import (
    StockFactorData,
    FactorScorer,
    FamaFrenchModel,
    FactorReturnAttribution,
    FactorTimingModel,
    MultifactorPortfolioConstructor,
    SmartBetaCalculator,
    FactorModelEngine,
    FactorType,
    FactorExposureLevel,
)


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def sample_stocks():
    stocks = []
    prices_up = [100 * (1.001 ** i) for i in range(252)]
    prices_down = [100 * (0.999 ** i) for i in range(252)]
    prices_flat = [100.0] * 252

    stocks.append(StockFactorData(
        symbol="AAPL", market_cap=3000000, book_value=4.0, price=180.0,
        eps_ttm=6.5, revenue_growth=0.12, roe=0.45, debt_to_equity=0.3,
        gross_margin=0.43, prices_12m=prices_up,
    ))
    stocks.append(StockFactorData(
        symbol="VALUE_CO", market_cap=5000, book_value=50.0, price=45.0,
        eps_ttm=5.0, revenue_growth=0.02, roe=0.08, debt_to_equity=0.8,
        gross_margin=0.15, prices_12m=prices_flat,
    ))
    stocks.append(StockFactorData(
        symbol="SMALL_CO", market_cap=200, book_value=10.0, price=12.0,
        eps_ttm=0.5, revenue_growth=0.25, roe=0.12, debt_to_equity=0.5,
        gross_margin=0.30, prices_12m=prices_up,
    ))
    stocks.append(StockFactorData(
        symbol="BANKRUPT_CO", market_cap=100, book_value=2.0, price=3.0,
        eps_ttm=-1.0, revenue_growth=-0.15, roe=-0.20, debt_to_equity=3.0,
        gross_margin=0.05, prices_12m=prices_down,
    ))
    return stocks


@pytest.fixture
def engine():
    return FactorModelEngine()


@pytest.fixture
def factor_returns():
    return {
        FactorType.MARKET: 0.08,
        FactorType.SIZE: 0.02,
        FactorType.VALUE: -0.01,
        FactorType.MOMENTUM: 0.05,
        FactorType.QUALITY: 0.03,
    }


# ── StockFactorData Properties ────────────────────────────────────────

class TestStockFactorData:
    def test_book_to_market(self):
        s = StockFactorData("TEST", 1000, 20.0, 100.0, 5.0, 0.1, 0.15, 0.5, 0.3)
        assert s.book_to_market == pytest.approx(0.2, abs=1e-6)

    def test_book_to_market_zero_price(self):
        s = StockFactorData("TEST", 1000, 20.0, 0.0, 5.0, 0.1, 0.15, 0.5, 0.3)
        assert s.book_to_market == 0.0

    def test_pe_ratio_positive(self):
        s = StockFactorData("TEST", 1000, 20.0, 100.0, 5.0, 0.1, 0.15, 0.5, 0.3)
        assert s.pe_ratio == pytest.approx(20.0, abs=1e-6)

    def test_pe_ratio_negative_eps(self):
        s = StockFactorData("TEST", 1000, 20.0, 100.0, -5.0, 0.1, 0.15, 0.5, 0.3)
        assert s.pe_ratio == float("inf")

    def test_volatility_sufficient_history(self):
        prices = [100.0 * (1 + i * 0.001) for i in range(252)]
        s = StockFactorData("TEST", 1000, 20.0, 100.0, 5.0, 0.1, 0.15, 0.5, 0.3, prices_12m=prices)
        assert s.volatility > 0

    def test_volatility_insufficient_history(self):
        s = StockFactorData("TEST", 1000, 20.0, 100.0, 5.0, 0.1, 0.15, 0.5, 0.3)
        assert s.volatility == 0.0

    def test_momentum_12m_2m(self):
        prices = [100.0 * (1.001 ** i) for i in range(252)]
        s = StockFactorData("TEST", 1000, 20.0, 100.0, 5.0, 0.1, 0.15, 0.5, 0.3, prices_12m=prices)
        assert s.momentum_12m_2m > 0

    def test_to_dict(self, sample_stocks):
        d = sample_stocks[0].to_dict()
        assert "symbol" in d
        assert "book_to_market" in d
        assert "volatility" in d


# ── FactorScorer ──────────────────────────────────────────────────────

class TestFactorScorer:
    def test_cross_sectional_rank_ascending(self):
        values = [10.0, 20.0, 30.0]
        ranks = FactorScorer.cross_sectional_rank(values, ascending=True)
        assert ranks[0] < ranks[1] < ranks[2]

    def test_cross_sectional_rank_descending(self):
        values = [10.0, 20.0, 30.0]
        ranks = FactorScorer.cross_sectional_rank(values, ascending=False)
        assert ranks[0] > ranks[1] > ranks[2]

    def test_cross_sectional_rank_range(self):
        values = [5.0, 15.0, 25.0, 35.0]
        ranks = FactorScorer.cross_sectional_rank(values)
        assert min(ranks) == 0.0
        assert max(ranks) == 100.0

    def test_cross_sectional_rank_single(self):
        ranks = FactorScorer.cross_sectional_rank([42.0])
        assert ranks == [50.0]

    def test_z_score_normalize(self):
        values = [1.0, 2.0, 3.0, 4.0, 5.0]
        z = FactorScorer.z_score_normalize(values)
        assert abs(sum(z)) < 1e-9
        import statistics as s
        assert abs(s.stdev(z) - 1.0) < 1e-4

    def test_value_score(self, sample_stocks):
        scores = FactorScorer.value_score(sample_stocks)
        assert len(scores) == len(sample_stocks)
        assert all(0 <= s <= 100 for s in scores)

    def test_size_score(self, sample_stocks):
        scores = FactorScorer.size_score(sample_stocks)
        # Small cap should score higher (ascending=False on market_cap)
        small_idx = next(i for i, s in enumerate(sample_stocks) if s.symbol == "SMALL_CO")
        large_idx = next(i for i, s in enumerate(sample_stocks) if s.symbol == "AAPL")
        assert scores[small_idx] >= scores[large_idx]

    def test_momentum_score(self, sample_stocks):
        scores = FactorScorer.momentum_score(sample_stocks)
        assert len(scores) == len(sample_stocks)

    def test_quality_score(self, sample_stocks):
        scores = FactorScorer.quality_score(sample_stocks)
        # High ROE + low D/E → high quality score
        aapl_idx = next(i for i, s in enumerate(sample_stocks) if s.symbol == "AAPL")
        bad_idx = next(i for i, s in enumerate(sample_stocks) if s.symbol == "BANKRUPT_CO")
        assert scores[aapl_idx] > scores[bad_idx]

    def test_low_vol_score(self, sample_stocks):
        scores = FactorScorer.low_vol_score(sample_stocks)
        assert len(scores) == len(sample_stocks)
        assert all(0 <= s <= 100 for s in scores)


# ── FamaFrenchModel ───────────────────────────────────────────────────

class TestFamaFrenchModel:
    def test_ols_regression_basic(self):
        y = [2 * x + 1 for x in range(20)]
        X = [[x] for x in range(20)]
        result = FamaFrenchModel.ols_regression(y, X)
        assert result["r_squared"] > 0.99
        assert abs(result["coefficients"][0] - 2.0) < 0.01
        assert abs(result["alpha"] - 1.0) < 0.01

    def test_ols_regression_insufficient_data(self):
        result = FamaFrenchModel.ols_regression([1.0], [[1.0]])
        assert result["r_squared"] == 0.0

    def test_three_factor_exposure(self):
        import random
        rng = random.Random(42)
        n = 60
        mkt = [rng.gauss(0.0005, 0.01) for _ in range(n)]
        smb = [rng.gauss(0.0002, 0.005) for _ in range(n)]
        hml = [rng.gauss(0.0001, 0.005) for _ in range(n)]
        stock = [1.2 * m + 0.3 * s + 0.1 * h + rng.gauss(0, 0.002) for m, s, h in zip(mkt, smb, hml)]

        result = FamaFrenchModel.three_factor_exposure(stock, mkt, smb, hml)
        assert "beta_mkt" in result
        assert result["r_squared"] > 0

    def test_five_factor_exposure(self):
        import random
        rng = random.Random(42)
        n = 60
        factors = [[rng.gauss(0, 0.01) for _ in range(n)] for _ in range(5)]
        stock = [sum(f[i] * c for f, c in zip(factors, [1.1, 0.3, 0.2, 0.1, 0.05])) for i in range(n)]

        result = FamaFrenchModel.five_factor_exposure(stock, *factors)
        assert "beta_mkt" in result
        assert "beta_rmw" in result

    def test_insufficient_data_three_factor(self):
        result = FamaFrenchModel.three_factor_exposure([1.0], [1.0], [1.0], [1.0])
        assert result["beta_mkt"] == 1


# ── FactorReturnAttribution ────────────────────────────────────────────

class TestFactorReturnAttribution:
    def test_attribute_returns_basic(self):
        result = FactorReturnAttribution.attribute_returns(
            total_return=0.15,
            factor_exposures={"mkt": 1.2, "smb": 0.3},
            factor_returns={"mkt": 0.10, "smb": 0.02},
        )
        assert "alpha" in result
        assert "factor_contributions" in result
        expected_factor = 1.2 * 0.10 + 0.3 * 0.02
        assert abs(result["total_factor_return"] - expected_factor) < 1e-6

    def test_alpha_calculation(self):
        result = FactorReturnAttribution.attribute_returns(
            total_return=0.20,
            factor_exposures={"mkt": 1.0},
            factor_returns={"mkt": 0.10},
        )
        assert abs(result["alpha"] - 0.10) < 1e-6

    def test_portfolio_attribution(self):
        holdings = [
            {"symbol": "AAPL", "weight": 0.6, "exposures": {"mkt": 1.2, "smb": -0.2}},
            {"symbol": "BOND", "weight": 0.4, "exposures": {"mkt": 0.1, "smb": 0.0}},
        ]
        result = FactorReturnAttribution.portfolio_factor_attribution(
            holdings, {"mkt": 0.08, "smb": 0.02}
        )
        assert "portfolio_exposures" in result
        assert "factor_contributions" in result

    def test_empty_holdings(self):
        result = FactorReturnAttribution.portfolio_factor_attribution([], {})
        assert result == {}


# ── FactorTimingModel ─────────────────────────────────────────────────

class TestFactorTimingModel:
    def test_get_factor_tilt_known_regimes(self):
        for regime in ["early_recovery", "expansion", "late_cycle", "recession"]:
            result = FactorTimingModel.get_factor_tilt(regime)
            assert "preferred" in result
            assert "avoid" in result

    def test_get_factor_tilt_unknown_regime(self):
        result = FactorTimingModel.get_factor_tilt("unknown_regime")
        assert "preferred" in result  # defaults to expansion

    def test_factor_momentum(self):
        history = {
            "value": [0.01] * 15,
            "momentum": [0.02] * 15,
            "quality": [-0.01] * 15,
        }
        result = FactorTimingModel.factor_momentum(history)
        assert "top_factors" in result
        assert "bottom_factors" in result
        assert result["top_factors"][0] == "momentum"

    def test_factor_momentum_insufficient_history(self):
        history = {"value": [0.01]}
        result = FactorTimingModel.factor_momentum(history)
        assert "factor_momentum" in result


# ── MultifactorPortfolioConstructor ───────────────────────────────────

class TestMultifactorPortfolioConstructor:
    def test_composite_factor_score(self, sample_stocks):
        results = MultifactorPortfolioConstructor.composite_factor_score(sample_stocks)
        assert len(results) == len(sample_stocks)
        assert all("composite_score" in r for r in results)
        assert all("factor_scores" in r for r in results)
        # Sorted descending
        scores = [r["composite_score"] for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_composite_score_custom_weights(self, sample_stocks):
        weights = {FactorType.QUALITY: 1.0}
        results = MultifactorPortfolioConstructor.composite_factor_score(sample_stocks, weights)
        assert len(results) == len(sample_stocks)

    def test_top_bottom_portfolio(self, sample_stocks):
        ranked = MultifactorPortfolioConstructor.composite_factor_score(sample_stocks)
        portfolio = MultifactorPortfolioConstructor.top_bottom_portfolio(ranked, 0.5, 0.5)
        assert "long_leg" in portfolio
        assert "short_leg" in portfolio
        assert len(portfolio["long_leg"]) > 0
        assert len(portfolio["short_leg"]) > 0

    def test_exposure_level_labels(self, sample_stocks):
        results = MultifactorPortfolioConstructor.composite_factor_score(sample_stocks)
        valid_levels = {level.value for level in FactorExposureLevel}
        for r in results:
            assert r["exposure_level"] in valid_levels


# ── SmartBetaCalculator ───────────────────────────────────────────────

class TestSmartBetaCalculator:
    def test_equal_weight(self):
        symbols = ["A", "B", "C", "D"]
        weights = SmartBetaCalculator.equal_weight_portfolio(symbols)
        assert len(weights) == 4
        assert abs(sum(weights.values()) - 1.0) < 1e-6
        assert all(abs(w - 0.25) < 1e-6 for w in weights.values())

    def test_equal_weight_empty(self):
        assert SmartBetaCalculator.equal_weight_portfolio([]) == {}

    def test_tracking_error(self):
        port = [0.01, -0.005, 0.015, -0.01]
        bench = [0.008, -0.003, 0.012, -0.008]
        te = SmartBetaCalculator.tracking_error(port, bench)
        assert te >= 0

    def test_information_ratio(self):
        port = [0.01, 0.012, 0.008, 0.011]
        bench = [0.005, 0.006, 0.004, 0.005]
        ir = SmartBetaCalculator.information_ratio(port, bench)
        assert ir > 0

    def test_information_ratio_insufficient(self):
        ir = SmartBetaCalculator.information_ratio([], [])
        assert ir == 0.0

    def test_information_ratio_zero_te(self):
        same = [0.01, 0.01, 0.01]
        ir = SmartBetaCalculator.information_ratio(same, same)
        assert ir == 0.0


# ── FactorModelEngine Orchestrator ────────────────────────────────────

class TestFactorModelEngine:
    def test_score_stocks(self, engine, sample_stocks):
        results = engine.score_stocks(sample_stocks)
        assert len(results) == len(sample_stocks)

    def test_three_factor_alpha(self, engine):
        import random
        rng = random.Random(99)
        n = 50
        mkt = [rng.gauss(0.001, 0.01) for _ in range(n)]
        smb = [rng.gauss(0, 0.005) for _ in range(n)]
        hml = [rng.gauss(0, 0.005) for _ in range(n)]
        stock = [1.1 * m + rng.gauss(0, 0.003) for m in mkt]
        result = engine.three_factor_alpha(stock, mkt, smb, hml)
        assert "beta_mkt" in result

    def test_attribute_returns(self, engine, factor_returns):
        exposures = {k.value if hasattr(k, "value") else k: 1.0 for k in factor_returns}
        factor_rets = {k.value if hasattr(k, "value") else k: v for k, v in factor_returns.items()}
        result = engine.attribute_returns(0.20, exposures, factor_rets)
        assert "alpha" in result

    def test_get_factor_tilt(self, engine):
        result = engine.get_factor_tilt("recession")
        assert "preferred" in result

    def test_build_portfolio(self, engine, sample_stocks):
        portfolio = engine.build_portfolio(sample_stocks)
        assert "long_leg" in portfolio

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "FactorModelEngine"
        assert len(caps["features"]) >= 15
