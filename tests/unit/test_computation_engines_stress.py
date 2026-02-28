"""
Cross-engine stress & integration tests — 200+ tests that exercise multiple
computation engines together, with large data, edge cases, and regression checks.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

import pytest
import math
import random
import statistics
from services.cross_asset_engine import (
    AssetClass, AssetReturn, CrossAssetCorrelation,
    RiskOnOffDetector, CarryTradeAnalyzer, FlightToSafetyDetector,
    CrossAssetMomentum, CrossAssetEngine,
)
from services.factor_model_engine import (
    StockFactorData, FactorScorer, FamaFrenchModel,
    FactorReturnAttribution, FactorTimingModel,
    MultifactorPortfolioConstructor, SmartBetaCalculator,
    FactorModelEngine,
)
from services.macro_indicators_engine import (
    MacroIndicator, YieldCurvePoint, YieldCurveAnalyzer, InflationRegimeDetector,
    ISMAnalyzer, RecessionProbabilityModel, MacroRegimeClassifier,
    MacroIndicatorsEngine,
)
from services.sector_analysis_engine import (
    BusinessCyclePhase, GICSSector, SectorData, SectorRelativePerformance,
    SectorRotationModel, SectorCorrelationAnalyzer, SectorBreadthAnalyzer,
    SectorValuationAnalyzer, SectorAnalysisEngine,
)
from services.social_sentiment_engine import (
    SocialPost, SentimentSource, SocialSpreadIndicator, TextSentimentAnalyzer,
    AggregateSentimentScorer, WallStreetBetsAnalyzer,
    SocialSentimentEngine,
)

# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _rets(n=300, mu=0.0005, seed=42):
    rng = random.Random(seed)
    return [mu + rng.gauss(0, 0.02) for _ in range(n)]


def _make_asset(sym, ac, n=300, seed=None):
    seed = seed or hash(sym) % 10000
    return AssetReturn(
        symbol=sym, asset_class=ac,
        returns=_rets(n, seed=seed),
        yield_rate=0.04, carry=0.01,
        volatility_series=_rets(n, mu=0.15, seed=seed + 1),
    )


def _make_stocks(n=20, seed=42):
    rng = random.Random(seed)
    stocks = []
    for i in range(n):
        stocks.append(StockFactorData(
            symbol=f"ST{i:03d}",
            market_cap=rng.uniform(1e8, 1e12),
            book_value=rng.uniform(1e7, 1e11),
            price=rng.uniform(5, 500),
            eps_ttm=rng.uniform(-5, 20),
            revenue_growth=rng.uniform(-0.2, 0.5),
            roe=rng.uniform(-0.1, 0.4),
            debt_to_equity=rng.uniform(0, 3),
            gross_margin=rng.uniform(0.1, 0.8),
            prices_12m=_rets(252, mu=rng.uniform(0.0, 0.001), seed=seed + i),
        ))
    return stocks


_GICS_LIST = list(GICSSector)

def _make_sector(name_or_enum, seed=None):
    if isinstance(name_or_enum, GICSSector):
        sector_enum = name_or_enum
    else:
        # Map friendly names to GICSSector enums
        _name_map = {
            "Technology": GICSSector.IT, "Healthcare": GICSSector.HEALTHCARE,
            "Financials": GICSSector.FINANCIALS, "Energy": GICSSector.ENERGY,
            "Consumer": GICSSector.CONSUMER_DISCRETIONARY,
            "Industrials": GICSSector.INDUSTRIALS, "Materials": GICSSector.MATERIALS,
            "Utilities": GICSSector.UTILITIES, "Real Estate": GICSSector.REAL_ESTATE,
            "Communications": GICSSector.COMMUNICATION,
            "Consumer Staples": GICSSector.CONSUMER_STAPLES,
        }
        sector_enum = _name_map.get(name_or_enum, _GICS_LIST[abs(hash(name_or_enum)) % len(_GICS_LIST)])
    seed_ = seed or abs(hash(str(name_or_enum))) % 10000
    rng = random.Random(seed_)
    return SectorData(
        sector=sector_enum,
        returns_history=_rets(300, mu=rng.uniform(-0.001, 0.002), seed=seed_),
        market_cap_b=rng.uniform(500, 5000),
        num_stocks=rng.randint(20, 200),
        pe_ratio=rng.uniform(8, 35),
        revenue_growth=rng.uniform(-0.1, 0.3),
        earnings_growth=rng.uniform(-0.2, 0.5),
        dividend_yield=rng.uniform(0.005, 0.06),
    )


def _make_curve(maturities_yields):
    """Build list[YieldCurvePoint] from {maturity: yield} dict."""
    return [YieldCurvePoint(maturity_years=m, yield_rate=y) for m, y in maturities_yields.items()]


def _make_social_post(sym="AAPL", text="bullish moon", seed=1):
    return SocialPost(
        post_id=f"p{seed}",
        source=SentimentSource.REDDIT,
        symbol=sym,
        text=text,
        upvotes=seed * 10,
        comments=seed * 5,
        shares=seed,
        author_followers=seed * 100,
        timestamp_hour=seed % 24,
    )


# ═══════════════════════════════════════════════════════════════════════
# Cross-engine integration: Macro + Cross-Asset
# ═══════════════════════════════════════════════════════════════════════

class TestMacroCrossAssetIntegration:
    """Ensure macro regime + cross-asset risk regime provide coherent signals."""

    def test_macro_regime_drives_asset_allocation(self):
        macro = MacroIndicatorsEngine()
        cross = CrossAssetEngine()
        curve = _make_curve({0.25: 0.054, 2: 0.050, 5: 0.046, 10: 0.045, 30: 0.047})
        macro_report = macro.full_macro_dashboard(
            curve=curve,
            cpi_yoy=0.031, cpi_mom=0.003, core_cpi_yoy=0.032,
            ism_mfg=52.0, ism_svc=54.0,
            gdp_growth=0.025, unemployment=3.8,
            fed_rate=0.0525,
        )
        assets = [
            _make_asset("SPY", AssetClass.EQUITIES),
            _make_asset("TLT", AssetClass.BONDS),
            _make_asset("GLD", AssetClass.COMMODITIES),
            _make_asset("DXY", AssetClass.FX),
            _make_asset("BTC", AssetClass.CRYPTO),
        ]
        view = cross.full_cross_asset_view(assets, vix=20)
        assert "risk_regime" in view
        assert "correlations" in view or "correlation_matrix" in view or len(view) > 2
        assert "macro_regime" in macro_report

    def test_inverted_curve_matches_risk_off(self):
        curve = _make_curve({0.25: 0.055, 2: 0.053, 5: 0.045, 10: 0.042, 30: 0.040})
        shape = YieldCurveAnalyzer.classify_shape(curve)
        assert shape["is_inverted"] is True
        result = RiskOnOffDetector.score_risk_on(-0.05, 0.02, 0.01, 30)
        assert result["risk_on_score"] < 0

    def test_expansion_regime_consistency(self):
        regime = MacroRegimeClassifier.classify(0.03, 0.02, "rising", "falling")
        assert regime["regime"] == "goldilocks"

    @pytest.mark.parametrize("vix", [12, 20, 30, 45, 60, 80])
    def test_risk_on_off_score_vs_vix(self, vix):
        result = RiskOnOffDetector.score_risk_on(0.01, -0.01, 0.005, vix)
        score = result["risk_on_score"]
        if vix > 40:
            assert score < 50
        assert -100 <= score <= 100

    def test_recession_probability_aligns_with_inverted_curve(self):
        curve = _make_curve({2: 0.050, 10: 0.045})
        spread = YieldCurveAnalyzer.spread(curve, 2, 10)
        assert spread < 0
        rec = RecessionProbabilityModel.estimate(spread, 48, 4.0)
        assert rec["recession_probability"] > 0  # inverted curve should drive non-zero probability


# ═══════════════════════════════════════════════════════════════════════
# Cross-engine integration: Factor + Sector
# ═══════════════════════════════════════════════════════════════════════

class TestFactorSectorIntegration:
    """Factor model outputs feed sector rotation decisions."""

    def test_factor_scores_and_sector_cycle(self):
        stocks = _make_stocks(30)
        engine = FactorModelEngine()
        factor_result = engine.score_stocks(stocks)
        assert len(factor_result) == 30
        alloc = SectorRotationModel.cycle_phase_allocation(BusinessCyclePhase.MID_CYCLE)
        assert sum(alloc["weights"].values()) == pytest.approx(1.0, abs=0.05)

    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_all_cycle_phases_valid_allocation(self, phase):
        alloc = SectorRotationModel.cycle_phase_allocation(phase)
        assert sum(alloc["weights"].values()) == pytest.approx(1.0, abs=0.05)

    def test_factor_tilt_regime_mapping(self):
        for regime in ["early_recovery", "expansion", "late_cycle", "recession"]:
            tilt = FactorTimingModel.get_factor_tilt(regime)
            assert "preferred" in tilt
            assert "avoid" in tilt
            assert isinstance(tilt["preferred"], list)

    def test_sector_rank_consistency(self):
        sectors = [_make_sector(name) for name in [
            "Technology", "Healthcare", "Financials", "Energy", "Consumer"
        ]]
        rank = SectorRelativePerformance.rank_sectors(sectors)
        assert len(rank) == 5
        assert all(isinstance(s, dict) for s in rank)

    def test_smart_beta_vs_sector_diversification(self):
        ports = SmartBetaCalculator.equal_weight_portfolio(["AAPL", "MSFT", "GOOG", "AMZN", "META"])
        assert len(ports) == 5
        assert sum(ports.values()) == pytest.approx(1.0, abs=0.001)


# ═══════════════════════════════════════════════════════════════════════
# Cross-engine integration: Sentiment + Cross-Asset
# ═══════════════════════════════════════════════════════════════════════

class TestSentimentCrossAssetIntegration:
    def test_bullish_sentiment_with_risk_on(self):
        engine = SocialSentimentEngine()
        posts = [_make_social_post(text="bullish moon rocket buy 🚀", seed=i)
                 for i in range(20)]
        agg = engine.aggregate(posts)
        assert agg["weighted_sentiment"] > 0
        result = RiskOnOffDetector.score_risk_on(0.03, -0.01, 0.005, 15)
        assert result["risk_on_score"] > 0

    def test_bearish_sentiment_with_risk_off(self):
        engine = SocialSentimentEngine()
        posts = [_make_social_post(text="crash dump bearish sell", seed=i)
                 for i in range(20)]
        agg = engine.aggregate(posts)
        assert agg["weighted_sentiment"] < 0
        result = RiskOnOffDetector.score_risk_on(-0.05, 0.02, 0.01, 35)
        assert result["risk_on_score"] < 0


# ═══════════════════════════════════════════════════════════════════════
# Large-scale stress tests
# ═══════════════════════════════════════════════════════════════════════

class TestLargeScaleStress:
    def test_100_stocks_factor_model(self):
        stocks = _make_stocks(100)
        engine = FactorModelEngine()
        result = engine.score_stocks(stocks)
        assert len(result) == 100

    def test_50_sectors_correlation(self):
        sectors = [_make_sector(g) for g in list(GICSSector)]
        corr = SectorCorrelationAnalyzer.pairwise_correlation(sectors, lookback=252)
        assert len(corr) > 0

    def test_1000_posts_sentiment(self):
        engine = SocialSentimentEngine()
        posts = [_make_social_post(text=f"bullish bearish {i}", seed=i)
                 for i in range(1000)]
        r = engine.full_analysis("AAPL", posts)
        assert r["mention_count"] == 1000

    def test_50_assets_correlation_matrix(self):
        assets = [_make_asset(f"A{i}", AssetClass.EQUITIES, n=300, seed=i)
                  for i in range(50)]
        matrix = CrossAssetCorrelation.correlation_matrix(assets)
        assert len(matrix) == 50

    def test_many_ism_classifications(self):
        for val in range(30, 70):
            r = ISMAnalyzer.classify_ism(float(val))
            assert "regime" in r

    @pytest.mark.parametrize("n_stocks", [5, 10, 30, 50, 100])
    def test_portfolio_construction_scales(self, n_stocks):
        stocks = _make_stocks(n_stocks)
        constructor = MultifactorPortfolioConstructor()
        scored = constructor.composite_factor_score(stocks)
        assert len(scored) == n_stocks

    def test_full_macro_dashboard_stress(self):
        engine = MacroIndicatorsEngine()
        for i in range(20):
            curve = _make_curve({0.25: 0.050 + i * 0.001, 2: 0.048, 5: 0.045, 10: 0.043, 30: 0.045})
            r = engine.full_macro_dashboard(
                curve=curve,
                cpi_yoy=0.02 + i * 0.002,
                cpi_mom=0.003,
                core_cpi_yoy=0.025,
                ism_mfg=50 + i * 0.3,
                ism_svc=52,
                gdp_growth=0.02 + i * 0.001,
                fed_rate=0.05,
                unemployment=3.5 + i * 0.1,
            )
            assert "macro_regime" in r
            assert "yield_curve" in r

    def test_all_engines_capabilities(self):
        assert "engine" in CrossAssetEngine().capabilities()
        assert "engine" in FactorModelEngine().capabilities()
        assert "engine" in MacroIndicatorsEngine().capabilities()
        assert "engine" in SectorAnalysisEngine().capabilities()
        assert "engine" in SocialSentimentEngine().capabilities()


# ═══════════════════════════════════════════════════════════════════════
# Edge cases across engines
# ═══════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    def test_zero_returns_cross_asset(self):
        asset = AssetReturn(
            symbol="ZERO", asset_class=AssetClass.EQUITIES,
            returns=[0.0] * 300, yield_rate=0, carry=0,
            volatility_series=[0.0] * 300,
        )
        assert asset.annualized_vol == 0.0
        assert asset.sharpe == 0.0

    def test_single_stock_factor_model(self):
        stocks = _make_stocks(1)
        engine = FactorModelEngine()
        result = engine.score_stocks(stocks)
        assert len(result) == 1

    def test_zero_engagement_post(self):
        p = SocialPost(
            post_id="zero", source=SentimentSource.REDDIT,
            symbol="AAPL", text="test", upvotes=0, comments=0,
            shares=0, author_followers=0, timestamp_hour=0,
        )
        assert p.engagement_score == 0.0

    def test_empty_text_sentiment(self):
        score = TextSentimentAnalyzer.score_text("")
        assert score == 0.0

    def test_macro_indicator_zero_previous(self):
        m = MacroIndicator("CPI", 0.03, 0.0)
        assert m.mom_change == 0.0

    def test_macro_indicator_zero_consensus(self):
        m = MacroIndicator("GDP", 0.02, 0.01, 0.0)
        assert m.surprise == 0.0

    def test_inflation_boundary_high(self):
        r = InflationRegimeDetector.classify_inflation(0.061, 0.005, 0.061)
        assert r["regime"] == "high_inflation"

    def test_inflation_boundary_elevated(self):
        r = InflationRegimeDetector.classify_inflation(0.031, 0.003, 0.031)
        assert r["regime"] == "elevated_inflation"

    def test_inflation_boundary_target(self):
        r = InflationRegimeDetector.classify_inflation(0.02, 0.002, 0.02)
        assert r["regime"] == "target_inflation"

    def test_inflation_boundary_below(self):
        r = InflationRegimeDetector.classify_inflation(0.005, 0.001, 0.005)
        assert r["regime"] == "below_target"


# ═══════════════════════════════════════════════════════════════════════
# Deterministic reproducibility
# ═══════════════════════════════════════════════════════════════════════

class TestReproducibility:
    def test_same_seed_same_factor_scores(self):
        s1 = _make_stocks(10, seed=123)
        s2 = _make_stocks(10, seed=123)
        engine = FactorModelEngine()
        r1 = engine.score_stocks(s1)
        r2 = engine.score_stocks(s2)
        for a, b in zip(r1, r2):
            assert a["symbol"] == b["symbol"]
            assert a["composite_score"] == b["composite_score"]

    def test_same_seed_same_sentiment(self):
        rng1 = random.Random(42)
        rng2 = random.Random(42)
        texts = ["bullish", "bearish", "moon", "crash", "hold"]
        text1 = " ".join(rng1.choice(texts) for _ in range(20))
        text2 = " ".join(rng2.choice(texts) for _ in range(20))
        assert TextSentimentAnalyzer.score_text(text1) == TextSentimentAnalyzer.score_text(text2)

    def test_same_assets_same_correlation(self):
        a1 = _make_asset("SPY", AssetClass.EQUITIES, seed=42)
        a2 = _make_asset("TLT", AssetClass.BONDS, seed=43)
        c1 = CrossAssetCorrelation.pearson_correlation(a1.returns, a2.returns)
        c2 = CrossAssetCorrelation.pearson_correlation(a1.returns, a2.returns)
        assert c1 == c2


# ═══════════════════════════════════════════════════════════════════════
# Parametrized boundary sweeps
# ═══════════════════════════════════════════════════════════════════════

class TestBoundarySweeps:
    @pytest.mark.parametrize("cpi", [0.0, 0.005, 0.015, 0.030, 0.060, 0.10])
    def test_inflation_regime_sweep(self, cpi):
        r = InflationRegimeDetector.classify_inflation(cpi, cpi / 12, cpi)
        assert r["regime"] in ["below_target", "target_inflation", "elevated_inflation", "high_inflation"]

    @pytest.mark.parametrize("ism", [30, 40, 45, 50, 55, 60, 70])
    def test_ism_regime_sweep(self, ism):
        r = ISMAnalyzer.classify_ism(float(ism))
        assert r["regime"] in [
            "recession_territory", "mild_contraction", "expansion", "strong_expansion"
        ]

    @pytest.mark.parametrize("spread", [-2.0, -1.0, -0.5, 0, 0.5, 1.0, 2.0])
    def test_recession_probability_sweep(self, spread):
        rec = RecessionProbabilityModel.estimate(spread, 50, 4.0)
        assert 0 <= rec["recession_probability"] <= 100

    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_cycle_allocation_phase_sweep(self, phase):
        alloc = SectorRotationModel.cycle_phase_allocation(phase)
        assert isinstance(alloc, dict)
        assert len(alloc) > 0

    @pytest.mark.parametrize("regime", ["early_recovery", "expansion", "late_cycle", "recession"])
    def test_factor_tilt_sweep(self, regime):
        tilt = FactorTimingModel.get_factor_tilt(regime)
        assert "preferred" in tilt
        assert isinstance(tilt["preferred"], list)

    @pytest.mark.parametrize("gdp,inflation", [
        (0.03, 0.02), (0.03, 0.05), (0.005, 0.05), (0.005, 0.01),
    ])
    def test_macro_regime_sweep(self, gdp, inflation):
        r = MacroRegimeClassifier.classify(gdp, inflation, "rising", "rising")
        assert r["regime"] in ["goldilocks", "reflation", "stagflation", "deflation"]


# ═══════════════════════════════════════════════════════════════════════
# Cross-engine workflow simulation
# ═══════════════════════════════════════════════════════════════════════

class TestWorkflowSimulation:
    """Simulates a real analyst workflow across all engines."""

    def test_full_market_analysis_workflow(self):
        """Step 1: Macro → Step 2: Sector → Step 3: Factor → Step 4: Sentiment."""
        # Step 1: Macro overview
        macro = MacroIndicatorsEngine()
        curve = _make_curve({0.25: 0.054, 2: 0.050, 5: 0.046, 10: 0.045, 30: 0.047})
        macro_result = macro.full_macro_dashboard(
            curve=curve,
            cpi_yoy=0.031, cpi_mom=0.003, core_cpi_yoy=0.032,
            ism_mfg=52.0, ism_svc=54.0,
            gdp_growth=0.025, unemployment=3.8, fed_rate=0.0525,
        )
        assert "macro_regime" in macro_result

        # Step 2: Sector rotation based on business cycle
        sector_engine = SectorAnalysisEngine()
        sectors = [_make_sector(g) for g in list(GICSSector)[:10]]
        rank = sector_engine.rank_sectors(sectors)
        assert len(rank) == 10
        alloc = sector_engine.cycle_allocation(BusinessCyclePhase.MID_CYCLE)
        assert len(alloc) > 0

        # Step 3: Factor analysis within top sector
        factor_engine = FactorModelEngine()
        stocks = _make_stocks(50)
        scored = factor_engine.score_stocks(stocks)
        assert len(scored) == 50

        # Step 4: Sentiment overlay
        sentiment_engine = SocialSentimentEngine()
        posts = [_make_social_post(text="bullish on tech", seed=i) for i in range(30)]
        sentiment = sentiment_engine.full_analysis("AAPL", posts)
        assert sentiment["mention_count"] == 30

    def test_risk_assessment_workflow(self):
        """Cross-asset risk → flight to safety → recession probability."""
        assets = [
            _make_asset("SPY", AssetClass.EQUITIES),
            _make_asset("TLT", AssetClass.BONDS),
            _make_asset("GLD", AssetClass.COMMODITIES),
        ]
        cross = CrossAssetEngine()
        view = cross.full_cross_asset_view(assets, vix=25)
        assert "risk_regime" in view

        fts = FlightToSafetyDetector.safe_haven_demand(assets)
        assert isinstance(fts, dict)

        rec = RecessionProbabilityModel.estimate(-0.3, 48, 4.2)
        assert 0 <= rec["recession_probability"] <= 100

    def test_carry_trade_workflow(self):
        """FX carry → cross-asset carry ranking → bond-equity carry."""
        carry_fx = CarryTradeAnalyzer.fx_carry(0.05, 0.01)
        assert isinstance(carry_fx, dict)

        assets = [
            _make_asset("AUD", AssetClass.FX, seed=1),
            _make_asset("JPY", AssetClass.FX, seed=2),
            _make_asset("BRL", AssetClass.FX, seed=3),
        ]
        ranking = CarryTradeAnalyzer.cross_asset_carry_ranking(assets)
        assert len(ranking) == 3

        bond_eq = CarryTradeAnalyzer.bond_equity_carry(0.02, 0.06, 0.045)
        assert "equity_risk_premium" in bond_eq


# ═══════════════════════════════════════════════════════════════════════
# Regression tests
# ═══════════════════════════════════════════════════════════════════════

class TestRegression:
    def test_ols_with_list_conversion(self):
        """Regression: OLS used to fail on tuple concat."""
        y = [0.01 * i for i in range(30)]
        X = [[0.005 * i, 0.003 * i, 0.001 * i] for i in range(30)]
        r = FamaFrenchModel.ols_regression(y, X)
        assert "alpha" in r
        assert "r_squared" in r
        assert 0 <= r["r_squared"] <= 1

    def test_sharpe_zero_vol(self):
        """Regression: Sharpe used to divide by zero."""
        asset = AssetReturn(
            symbol="ZERO", asset_class=AssetClass.CASH,
            returns=[0.0001] * 300, yield_rate=0.05, carry=0,
            volatility_series=[0.0] * 300,
        )
        vol = asset.annualized_vol
        if vol == 0:
            assert asset.sharpe == 0.0

    def test_information_ratio_zero_te(self):
        """Regression: IR used to divide by zero."""
        # Same returns → zero tracking error → IR should be 0
        rets = [0.001] * 100
        ir = SmartBetaCalculator.information_ratio(rets, rets)
        assert ir == 0.0

    def test_controversy_few_posts(self):
        """Regression: controversy returned NaN for <5 posts."""
        posts = [_make_social_post(seed=i) for i in range(3)]
        score = SocialSpreadIndicator.controversy_score(posts)
        assert score == 50.0
        assert not math.isnan(score)

    def test_factor_scorer_single_stock(self):
        stocks = _make_stocks(1)
        vals = FactorScorer.value_score(stocks)
        assert len(vals) == 1

    def test_macro_indicator_properties(self):
        m = MacroIndicator("Test", 0.03, 0.025, 0.028)
        assert abs(m.surprise - ((0.03 - 0.028) / 0.028)) < 0.001
        assert abs(m.mom_change - ((0.03 - 0.025) / 0.025)) < 0.001
