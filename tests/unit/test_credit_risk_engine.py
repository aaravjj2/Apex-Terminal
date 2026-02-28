"""
Comprehensive tests for CreditRiskEngine.
Tests: AltmanZScore, DefaultProbabilityModel, LGDEstimator, ExpectedLossCalculator,
CreditSpreadAnalyzer, RatingTransitionMatrix, CreditScoreModel, BondValuation,
PortfolioCreditRisk, and the orchestrator.
"""
import math
import random
import pytest

from phase1.services.credit_risk_engine import (
    CreditRating, CreditOutlook, IndustryRisk,
    CompanyFinancials, BondInfo, CreditExposure,
    AltmanZScore, DefaultProbabilityModel, LGDEstimator,
    ExpectedLossCalculator, CreditSpreadAnalyzer,
    RatingTransitionMatrix, CreditScoreModel, BondValuation,
    PortfolioCreditRisk, CreditRiskEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _healthy_company():
    return CompanyFinancials(
        total_assets=2_000_000,
        total_liabilities=1_000_000,
        current_assets=900_000,
        current_liabilities=400_000,
        ebit=300_000,
        revenue=4_000_000,
        retained_earnings=800_000,
        market_cap=5_000_000,
        working_capital=500_000,
        interest_expense=50_000,
        net_income=250_000,
        total_debt=600_000,
    )


def _distressed_company():
    return CompanyFinancials(
        total_assets=500_000,
        total_liabilities=800_000,
        current_assets=200_000,
        current_liabilities=300_000,
        ebit=10_000,
        revenue=300_000,
        retained_earnings=-200_000,
        market_cap=100_000,
        working_capital=-100_000,
        interest_expense=80_000,
        net_income=-50_000,
        total_debt=500_000,
    )


def _sample_bond():
    return BondInfo(
        face_value=1000,
        coupon_rate=0.05,
        maturity_years=10,
        yield_to_maturity=0.04,
        rating=CreditRating.A,
        recovery_rate=0.45,
    )


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    def test_credit_ratings(self):
        assert CreditRating.AAA.value == "AAA"
        assert CreditRating.D.value == "D"
        assert len(CreditRating) == 10

    def test_outlook(self):
        assert CreditOutlook.POSITIVE.value == "positive"
        assert CreditOutlook.STABLE.value == "stable"
        assert CreditOutlook.NEGATIVE.value == "negative"
        assert CreditOutlook.WATCH_POSITIVE.value == "watch_positive"
        assert CreditOutlook.WATCH_NEGATIVE.value == "watch_negative"
        assert len(CreditOutlook) == 5

    def test_industry_risk(self):
        assert len(IndustryRisk) == 5
        assert IndustryRisk.LOW.value == "low"
        assert IndustryRisk.HIGH.value == "high"


# ═══════════════════════════════════════════════════════════════════════
# CompanyFinancials
# ═══════════════════════════════════════════════════════════════════════

class TestCompanyFinancials:
    def test_healthy_properties(self):
        fin = _healthy_company()
        assert fin.total_assets > 0
        assert fin.working_capital > 0

    def test_leverage_ratio(self):
        fin = _healthy_company()
        assert 0 < fin.leverage < 1

    def test_distressed_properties(self):
        fin = _distressed_company()
        assert fin.working_capital < 0
        assert fin.net_income < 0

    def test_equity(self):
        fin = _healthy_company()
        assert fin.equity == fin.total_assets - fin.total_liabilities

    def test_debt_to_equity(self):
        fin = _healthy_company()
        assert fin.debt_to_equity > 0

    def test_current_ratio(self):
        fin = _healthy_company()
        assert fin.current_ratio > 1.0

    def test_interest_coverage(self):
        fin = _healthy_company()
        assert fin.interest_coverage > 0

    def test_roa(self):
        fin = _healthy_company()
        assert fin.roa > 0

    def test_profit_margin(self):
        fin = _healthy_company()
        assert fin.profit_margin > 0

    def test_auto_working_capital(self):
        fin = CompanyFinancials(
            total_assets=1_000_000,
            total_liabilities=500_000,
            current_assets=300_000,
            current_liabilities=200_000,
            ebit=100_000,
            revenue=500_000,
            retained_earnings=200_000,
            market_cap=800_000,
        )
        assert fin.working_capital == 100_000  # auto-computed from current_assets - current_liabilities


# ═══════════════════════════════════════════════════════════════════════
# AltmanZScore
# ═══════════════════════════════════════════════════════════════════════

class TestAltmanZScore:
    def test_healthy_zscore(self):
        result = AltmanZScore.calculate(_healthy_company())
        assert result["z_score"] > 3.0
        assert result["zone"] == "safe"

    def test_distressed_zscore(self):
        result = AltmanZScore.calculate(_distressed_company())
        assert result["z_score"] < 1.81
        assert result["zone"] == "distress"

    def test_grey_zone(self):
        fin = CompanyFinancials(
            total_assets=1_000_000,
            total_liabilities=600_000,
            current_assets=400_000,
            current_liabilities=300_000,
            ebit=100_000,
            revenue=1_500_000,
            retained_earnings=200_000,
            market_cap=800_000,
            working_capital=100_000,
            interest_expense=40_000,
            net_income=60_000,
            total_debt=400_000,
        )
        result = AltmanZScore.calculate(fin)
        assert "z_score" in result

    def test_components(self):
        result = AltmanZScore.calculate(_healthy_company())
        assert "components" in result
        assert len(result["components"]) == 5

    def test_zero_assets(self):
        fin = CompanyFinancials(
            total_assets=0, total_liabilities=0,
            current_assets=0, current_liabilities=0,
            ebit=0, revenue=0, retained_earnings=0, market_cap=0,
        )
        result = AltmanZScore.calculate(fin)
        assert "z_score" in result

    def test_classify_rating_safe(self):
        rating = AltmanZScore.classify_rating(4.0)
        assert rating == CreditRating.AA

    def test_classify_rating_distress(self):
        rating = AltmanZScore.classify_rating(0.5)
        assert rating == CreditRating.CC


# ═══════════════════════════════════════════════════════════════════════
# DefaultProbabilityModel
# ═══════════════════════════════════════════════════════════════════════

class TestDefaultProbabilityModel:
    @pytest.mark.parametrize("rating", list(CreditRating))
    def test_from_rating(self, rating):
        pd = DefaultProbabilityModel.from_rating(rating)
        assert 0 <= pd <= 1.0

    def test_aaa_vs_ccc(self):
        pd_aaa = DefaultProbabilityModel.from_rating(CreditRating.AAA)
        pd_ccc = DefaultProbabilityModel.from_rating(CreditRating.CCC)
        assert pd_aaa < pd_ccc

    def test_from_spread(self):
        pd = DefaultProbabilityModel.from_spread(0.02, lgd=0.40)
        assert 0 < pd < 1.0

    def test_from_spread_zero(self):
        pd = DefaultProbabilityModel.from_spread(0.0, lgd=0.40)
        assert pd == 0.0

    def test_merton_model(self):
        result = DefaultProbabilityModel.merton_model(
            asset_value=10_000_000,
            debt_face=5_000_000,
            asset_vol=0.30,
            risk_free=0.05,
            maturity=1.0,
        )
        assert "pd" in result
        assert "distance_to_default" in result
        assert result["pd"] < 0.5

    def test_merton_deeply_distressed(self):
        result = DefaultProbabilityModel.merton_model(
            asset_value=4_000_000,
            debt_face=5_000_000,
            asset_vol=0.50,
            risk_free=0.02,
            maturity=1.0,
        )
        assert result["pd"] > 0.3

    @pytest.mark.parametrize("horizon", [1, 2, 3, 5, 10])
    def test_multiyear_pd(self, horizon):
        pd = DefaultProbabilityModel.from_rating(CreditRating.BBB, horizon_years=horizon)
        assert 0 <= pd <= 1.0

    def test_merton_invalid(self):
        result = DefaultProbabilityModel.merton_model(0, 0, 0)
        assert result["pd"] == 1.0


# ═══════════════════════════════════════════════════════════════════════
# LGDEstimator
# ═══════════════════════════════════════════════════════════════════════

class TestLGDEstimator:
    def test_senior_secured(self):
        lgd = LGDEstimator.from_seniority("senior_secured")
        assert 0.20 <= lgd <= 0.50

    def test_subordinated(self):
        lgd = LGDEstimator.from_seniority("subordinated")
        assert lgd > 0.50

    def test_unknown_seniority(self):
        lgd = LGDEstimator.from_seniority("unknown")
        assert 0 < lgd < 1.0

    def test_from_collateral(self):
        lgd = LGDEstimator.from_collateral(
            exposure=1_000_000, collateral_value=800_000, haircut=0.10
        )
        assert lgd < 0.50

    def test_no_collateral(self):
        lgd = LGDEstimator.from_collateral(
            exposure=1_000_000, collateral_value=0, haircut=0.0
        )
        assert lgd == 1.0

    def test_over_collateralized(self):
        lgd = LGDEstimator.from_collateral(
            exposure=500_000, collateral_value=1_000_000, haircut=0.0
        )
        assert lgd == 0.0

    def test_economic_cycle_adjustment(self):
        base = 0.40
        downturn = LGDEstimator.economic_cycle_adjustment(base, in_recession=True)
        normal = LGDEstimator.economic_cycle_adjustment(base, in_recession=False)
        assert downturn > normal

    @pytest.mark.parametrize("seniority", [
        "senior_secured", "senior_unsecured", "subordinated", "junior_subordinated", "equity"
    ])
    def test_seniority_ordering(self, seniority):
        lgd = LGDEstimator.from_seniority(seniority)
        assert 0 <= lgd <= 1.0


# ═══════════════════════════════════════════════════════════════════════
# ExpectedLossCalculator
# ═══════════════════════════════════════════════════════════════════════

class TestExpectedLossCalculator:
    def test_basic_el(self):
        result = ExpectedLossCalculator.calculate(
            ead=1_000_000, pd=0.02, lgd=0.45
        )
        assert result["expected_loss"] == 9000.0
        assert result["ead"] == 1_000_000

    def test_zero_pd(self):
        result = ExpectedLossCalculator.calculate(100_000, 0.0, 0.45)
        assert result["expected_loss"] == 0.0

    def test_portfolio_expected_loss(self):
        exposures = [
            CreditExposure("A", 1_000_000, 0.01, 0.40),
            CreditExposure("B", 2_000_000, 0.03, 0.50),
            CreditExposure("C", 500_000, 0.05, 0.60),
        ]
        result = ExpectedLossCalculator.portfolio_expected_loss(exposures)
        assert result["total_expected_loss"] > 0
        assert result["total_ead"] == 3_500_000

    def test_empty_portfolio(self):
        result = ExpectedLossCalculator.portfolio_expected_loss([])
        assert result.get("total_expected_loss", 0) == 0 or result.get("n_exposures", 0) == 0

    def test_el_bounded(self):
        result = ExpectedLossCalculator.calculate(1_000_000, 1.0, 1.0)
        assert result["expected_loss"] == 1_000_000

    def test_expected_loss_pct(self):
        result = ExpectedLossCalculator.calculate(1_000_000, 0.02, 0.45)
        assert "expected_loss_pct" in result


# ═══════════════════════════════════════════════════════════════════════
# CreditSpreadAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestCreditSpreadAnalyzer:
    def test_z_spread(self):
        spread = CreditSpreadAnalyzer.z_spread(
            bond_price=950,
            face_value=1000,
            coupon_rate=0.05,
            maturity_years=5,
            risk_free_curve=[0.03, 0.032, 0.035, 0.037, 0.04],
        )
        assert spread > 0

    def test_z_spread_at_par(self):
        spread = CreditSpreadAnalyzer.z_spread(
            bond_price=1000,
            face_value=1000,
            coupon_rate=0.05,
            maturity_years=5,
            risk_free_curve=[0.05] * 5,
        )
        assert abs(spread) < 0.01

    def test_relative_value(self):
        result = CreditSpreadAnalyzer.spread_relative_value(
            actual_spread_bps=150,
            rating=CreditRating.BBB,
        )
        assert "relative_value" in result
        assert "typical_spread_bps" in result
        assert "assessment" in result

    @pytest.mark.parametrize("rating", [CreditRating.AAA, CreditRating.A, CreditRating.BBB, CreditRating.BB])
    def test_relative_value_ratings(self, rating):
        result = CreditSpreadAnalyzer.spread_relative_value(100, rating)
        assert isinstance(result, dict)

    def test_relative_value_cheap(self):
        result = CreditSpreadAnalyzer.spread_relative_value(300, CreditRating.BBB)
        assert result["assessment"] in ("cheap", "very_cheap")


# ═══════════════════════════════════════════════════════════════════════
# RatingTransitionMatrix
# ═══════════════════════════════════════════════════════════════════════

class TestRatingTransitionMatrix:
    def test_get_transition(self):
        trans = RatingTransitionMatrix.get_transition(CreditRating.BBB)
        assert isinstance(trans, dict)
        total = sum(trans.values())
        assert abs(total - 1.0) < 0.05

    def test_downgrade_probability(self):
        dp = RatingTransitionMatrix.downgrade_probability(CreditRating.BBB)
        assert 0 < dp < 1.0

    def test_upgrade_probability(self):
        up = RatingTransitionMatrix.upgrade_probability(CreditRating.BBB)
        assert 0 < up < 1.0

    def test_aaa_no_upgrade(self):
        up = RatingTransitionMatrix.upgrade_probability(CreditRating.AAA)
        assert up == 0.0

    def test_d_no_downgrade(self):
        dp = RatingTransitionMatrix.downgrade_probability(CreditRating.D)
        assert dp == 0.0

    def test_simulate_path(self):
        path = RatingTransitionMatrix.simulate_path(CreditRating.BBB, 10, seed=42)
        assert len(path) == 11  # start + 10 years
        assert path[0] == "BBB"

    @pytest.mark.parametrize("start", [CreditRating.AAA, CreditRating.A, CreditRating.BB, CreditRating.CCC])
    def test_simulate_various_starts(self, start):
        path = RatingTransitionMatrix.simulate_path(start, 5, seed=42)
        assert len(path) == 6

    def test_deterministic_path(self):
        p1 = RatingTransitionMatrix.simulate_path(CreditRating.A, 20, seed=123)
        p2 = RatingTransitionMatrix.simulate_path(CreditRating.A, 20, seed=123)
        assert p1 == p2


# ═══════════════════════════════════════════════════════════════════════
# CreditScoreModel
# ═══════════════════════════════════════════════════════════════════════

class TestCreditScoreModel:
    def test_healthy_score(self):
        result = CreditScoreModel.calculate(_healthy_company())
        assert result["score"] > 60
        assert result["rating"] in [r.value for r in CreditRating]

    def test_distressed_score(self):
        result = CreditScoreModel.calculate(_distressed_company())
        assert result["score"] < 40

    def test_factors(self):
        result = CreditScoreModel.calculate(_healthy_company())
        assert "factors" in result
        assert len(result["factors"]) > 0

    def test_score_bounded(self):
        result = CreditScoreModel.calculate(_healthy_company())
        assert 0 <= result["score"] <= 100

    def test_with_industry_risk(self):
        result = CreditScoreModel.calculate(_healthy_company(), IndustryRisk.HIGH)
        assert isinstance(result["score"], (int, float))


# ═══════════════════════════════════════════════════════════════════════
# BondValuation
# ═══════════════════════════════════════════════════════════════════════

class TestBondValuation:
    def test_par_bond(self):
        price = BondValuation.price(1000, 0.05, 0.05, 10)
        assert abs(price - 1000) < 1.0

    def test_discount_bond(self):
        price = BondValuation.price(1000, 0.03, 0.05, 10)
        assert price < 1000

    def test_premium_bond(self):
        price = BondValuation.price(1000, 0.07, 0.05, 10)
        assert price > 1000

    def test_zero_coupon(self):
        price = BondValuation.price(1000, 0.0, 0.05, 10)
        assert price < 700

    def test_maturity_effect(self):
        p1 = BondValuation.price(1000, 0.03, 0.05, 5)
        p2 = BondValuation.price(1000, 0.03, 0.05, 30)
        assert p2 < p1

    def test_duration(self):
        result = BondValuation.duration(1000, 0.05, 0.05, 10)
        assert "macaulay_duration" in result
        assert "modified_duration" in result
        assert result["macaulay_duration"] > 0
        assert result["modified_duration"] > 0
        assert result["modified_duration"] <= result["macaulay_duration"]

    def test_convexity(self):
        conv = BondValuation.convexity(1000, 0.05, 0.05, 10)
        assert conv > 0

    def test_convexity_vs_duration(self):
        dur = BondValuation.duration(1000, 0.05, 0.05, 30)
        conv = BondValuation.convexity(1000, 0.05, 0.05, 30)
        assert conv > dur["macaulay_duration"]

    @pytest.mark.parametrize("ytm", [0.01, 0.03, 0.05, 0.07, 0.10, 0.15])
    def test_price_monotonic_yield(self, ytm):
        price = BondValuation.price(1000, 0.05, ytm, 10)
        assert price > 0

    def test_price_yield_inverse(self):
        prices = [BondValuation.price(1000, 0.05, ytm/100, 10) for ytm in range(1, 15)]
        for i in range(len(prices)-1):
            assert prices[i] > prices[i+1]


# ═══════════════════════════════════════════════════════════════════════
# PortfolioCreditRisk
# ═══════════════════════════════════════════════════════════════════════

class TestPortfolioCreditRisk:
    def test_credit_var(self):
        exposures = [
            CreditExposure("A", 1_000_000, 0.01, 0.40),
            CreditExposure("B", 2_000_000, 0.03, 0.50),
            CreditExposure("C", 500_000, 0.05, 0.60),
        ]
        result = PortfolioCreditRisk.credit_var(exposures, 0.99, 5000, seed=42)
        assert result["credit_var"] > 0
        assert result["expected_loss"] > 0

    def test_credit_var_deterministic(self):
        exposures = [CreditExposure("X", 1_000_000, 0.02, 0.45)]
        r1 = PortfolioCreditRisk.credit_var(exposures, 0.95, 10000, seed=42)
        r2 = PortfolioCreditRisk.credit_var(exposures, 0.95, 10000, seed=42)
        assert r1["credit_var"] == r2["credit_var"]

    def test_empty_portfolio(self):
        result = PortfolioCreditRisk.credit_var([], 0.99, 1000, seed=42)
        assert result["expected_loss"] == 0.0

    def test_large_portfolio(self):
        exposures = [
            CreditExposure(f"E{i}", 100_000, 0.01 + i*0.002, 0.40)
            for i in range(50)
        ]
        result = PortfolioCreditRisk.credit_var(exposures, 0.99, 2000, seed=42)
        assert result["credit_var"] > 0

    def test_concentration_by_rating(self):
        exposures = [
            CreditExposure("A", 1_000_000, 0.01, 0.40, rating=CreditRating.A),
            CreditExposure("B", 2_000_000, 0.03, 0.50, rating=CreditRating.BBB),
        ]
        result = PortfolioCreditRisk.concentration_by_rating(exposures)
        assert isinstance(result, dict)

    def test_largest_exposures(self):
        exposures = [
            CreditExposure(f"E{i}", 100_000 * (i + 1), 0.01, 0.40)
            for i in range(10)
        ]
        result = PortfolioCreditRisk.largest_exposures(exposures, top_n=3)
        assert len(result) == 3


# ═══════════════════════════════════════════════════════════════════════
# CreditRiskEngine Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestCreditRiskEngine:
    @pytest.fixture
    def engine(self):
        return CreditRiskEngine()

    def test_company_credit_analysis(self, engine):
        result = engine.company_credit_analysis(_healthy_company())
        assert "altman_z" in result
        assert "credit_score" in result
        assert "implied_pd" in result

    def test_company_distressed(self, engine):
        result = engine.company_credit_analysis(_distressed_company())
        assert result["altman_z"]["zone"] == "distress"

    def test_bond_analysis(self, engine):
        bond = _sample_bond()
        result = engine.bond_analysis(bond)
        assert "price" in result
        assert "duration" in result
        assert "convexity" in result

    def test_portfolio_analysis(self, engine):
        exposures = [
            CreditExposure("A", 1_000_000, 0.01, 0.40),
            CreditExposure("B", 500_000, 0.03, 0.50),
        ]
        result = engine.portfolio_analysis(exposures)
        assert "expected_loss" in result
        assert "credit_var" in result

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "CreditRiskEngine"
        assert len(caps["features"]) > 5


# ═══════════════════════════════════════════════════════════════════════
# Integration Tests
# ═══════════════════════════════════════════════════════════════════════

class TestIntegration:
    def test_full_analysis_pipeline(self):
        engine = CreditRiskEngine()
        fin = _healthy_company()
        score_result = engine.company_credit_analysis(fin)
        assert score_result["credit_score"]["score"] > 50

        bond = _sample_bond()
        bond_result = engine.bond_analysis(bond)
        assert bond_result["price"] > 0

    def test_stress_many_companies(self):
        rng = random.Random(42)
        engine = CreditRiskEngine()
        for _ in range(50):
            fin = CompanyFinancials(
                total_assets=rng.randint(500_000, 10_000_000),
                total_liabilities=rng.randint(100_000, 5_000_000),
                current_assets=rng.randint(100_000, 2_000_000),
                current_liabilities=rng.randint(50_000, 2_000_000),
                ebit=rng.randint(-100_000, 1_000_000),
                revenue=rng.randint(500_000, 10_000_000),
                retained_earnings=rng.randint(-500_000, 2_000_000),
                market_cap=rng.randint(100_000, 20_000_000),
                working_capital=rng.randint(-500_000, 1_000_000),
                interest_expense=rng.randint(0, 200_000),
                net_income=rng.randint(-500_000, 1_000_000),
                total_debt=rng.randint(50_000, 3_000_000),
            )
            result = engine.company_credit_analysis(fin)
            assert "credit_score" in result

    def test_rating_downgrade_probability_monotonic(self):
        ratings = [CreditRating.AAA, CreditRating.AA, CreditRating.A,
                   CreditRating.BBB, CreditRating.BB, CreditRating.B, CreditRating.CCC]
        probs = [DefaultProbabilityModel.from_rating(r) for r in ratings]
        for i in range(len(probs) - 1):
            assert probs[i] <= probs[i + 1]
