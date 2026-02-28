"""
Tests for CrossAssetEngine — correlations, risk regimes, carry, momentum.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

from services.cross_asset_engine import (
    AssetReturn,
    CrossAssetCorrelation,
    RiskOnOffDetector,
    CarryTradeAnalyzer,
    FlightToSafetyDetector,
    CrossAssetMomentum,
    CrossAssetEngine,
    AssetClass,
    RiskRegime,
    CarrySignal,
)
import random
import math


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def sample_assets():
    rng = random.Random(1)
    assets = []
    asset_defs = [
        ("SPY", AssetClass.EQUITIES, 0.05, 0.10, 0.02),
        ("TLT", AssetClass.BONDS, 0.03, 0.05, 0.04),
        ("GLD", AssetClass.COMMODITIES, 0.02, 0.06, 0.00),
        ("UUP", AssetClass.FX, 0.01, 0.04, 0.02),
        ("BTC", AssetClass.CRYPTO, 0.15, 0.50, 0.00),
        ("VNQ", AssetClass.REAL_ESTATE, 0.04, 0.12, 0.03),
        ("USO", AssetClass.COMMODITIES, -0.01, 0.20, 0.00),
    ]
    for sym, ac, mean, std, yld in asset_defs:
        rets = [rng.gauss(mean / 252, std / math.sqrt(252)) for _ in range(252)]
        vols = [abs(rng.gauss(std / math.sqrt(252), 0.001)) for _ in range(252)]
        assets.append(AssetReturn(
            symbol=sym,
            asset_class=ac,
            returns=rets,
            yield_rate=yld,
            carry=yld * 0.9,
            volatility_series=vols,
        ))
    return assets


@pytest.fixture
def engine():
    return CrossAssetEngine()


# ── AssetReturn Properties ────────────────────────────────────────────

class TestAssetReturn:
    def test_annualized_return_positive(self):
        rets = [0.001] * 252
        a = AssetReturn("X", AssetClass.EQUITIES, rets)
        assert a.annualized_return > 0

    def test_annualized_return_zero(self):
        a = AssetReturn("Y", AssetClass.BONDS, [])
        assert a.annualized_return == 0.0

    def test_annualized_vol(self):
        rets = [0.01, -0.01] * 126
        a = AssetReturn("Z", AssetClass.EQUITIES, rets)
        assert a.annualized_vol > 0

    def test_sharpe_positive(self):
        import random
        rng = random.Random(77)
        rets = [0.005 + rng.gauss(0, 0.001) for _ in range(252)]
        a = AssetReturn("A", AssetClass.EQUITIES, rets, yield_rate=0.0)
        assert a.sharpe > 0

    def test_sharpe_negative(self):
        import random
        rng = random.Random(77)
        rets = [-0.002 + rng.gauss(0, 0.001) for _ in range(252)]
        a = AssetReturn("B", AssetClass.EQUITIES, rets)
        assert a.sharpe < 0

    def test_recent_return(self):
        rets = [0.001] * 252
        a = AssetReturn("C", AssetClass.EQUITIES, rets)
        assert abs(a.recent_return - 0.021) < 1e-6

    def test_insufficient_returns_vol(self):
        a = AssetReturn("D", AssetClass.EQUITIES, [0.01])
        assert a.annualized_vol == 0.0

    def test_to_dict(self, sample_assets):
        d = sample_assets[0].to_dict()
        assert "symbol" in d
        assert "asset_class" in d
        assert "annualized_return" in d


# ── CrossAssetCorrelation ─────────────────────────────────────────────

class TestCrossAssetCorrelation:
    def test_pearson_correlation_same(self):
        series = [0.01, -0.01, 0.02, 0.005, -0.005]
        corr = CrossAssetCorrelation.pearson_correlation(series, series)
        assert abs(corr - 1.0) < 1e-6

    def test_pearson_correlation_opposite(self):
        series = [0.01, -0.01, 0.02, 0.005, -0.005]
        opposite = [-x for x in series]
        corr = CrossAssetCorrelation.pearson_correlation(series, opposite)
        assert abs(corr + 1.0) < 1e-6

    def test_pearson_correlation_range(self):
        rng = random.Random(5)
        a = [rng.gauss(0, 0.01) for _ in range(50)]
        b = [rng.gauss(0, 0.01) for _ in range(50)]
        corr = CrossAssetCorrelation.pearson_correlation(a, b)
        assert -1 <= corr <= 1

    def test_pearson_correlation_mismatched(self):
        corr = CrossAssetCorrelation.pearson_correlation([0.01, 0.02], [0.01])
        assert corr == 0.0

    def test_correlation_matrix_shape(self, sample_assets):
        corr = CrossAssetCorrelation.correlation_matrix(sample_assets[:4])
        assert len(corr) == 4
        for sym, row in corr.items():
            assert corr[sym][sym] == 1.0

    def test_rolling_correlation_length(self, sample_assets):
        rolling = CrossAssetCorrelation.rolling_correlation(
            sample_assets[0].returns, sample_assets[1].returns, window=30
        )
        assert len(rolling) > 0
        for v in rolling:
            assert -1.01 <= v <= 1.01

    def test_correlation_breakdown(self, sample_assets):
        result = CrossAssetCorrelation.correlation_breakdown(
            sample_assets[0].returns, sample_assets[1].returns
        )
        if result:
            assert "normal_period_correlation" in result
            assert "crisis_period_correlation" in result


# ── RiskOnOffDetector ─────────────────────────────────────────────────

class TestRiskOnOffDetector:
    def test_score_range(self):
        result = RiskOnOffDetector.score_risk_on(
            equity_return_5d=0.02,
            bond_return_5d=-0.005,
            usd_return_5d=-0.001,
            vix_level=18.0,
            gold_return_5d=0.001,
        )
        assert -100 <= result["risk_on_score"] <= 100

    def test_risk_on_positive_score(self):
        result = RiskOnOffDetector.score_risk_on(
            equity_return_5d=0.03,
            bond_return_5d=-0.01,
            usd_return_5d=-0.005,
            vix_level=12.0,
            gold_return_5d=-0.005,
        )
        assert result["risk_on_score"] > 0

    def test_risk_off_negative_score(self):
        result = RiskOnOffDetector.score_risk_on(
            equity_return_5d=-0.04,
            bond_return_5d=0.02,
            usd_return_5d=0.01,
            vix_level=35.0,
            gold_return_5d=0.02,
        )
        assert result["risk_on_score"] < 0

    def test_regime_series_length(self, sample_assets):
        idx_equity = next(i for i, a in enumerate(sample_assets) if a.asset_class == AssetClass.EQUITIES)
        idx_bond = next(i for i, a in enumerate(sample_assets) if a.asset_class == AssetClass.BONDS)
        vix_levels = [20.0] * len(sample_assets[idx_equity].returns)
        result = RiskOnOffDetector.regime_series(
            sample_assets[idx_equity].returns,
            sample_assets[idx_bond].returns,
            vix_levels,
            window=21,
        )
        assert len(result) > 0


# ── CarryTradeAnalyzer ────────────────────────────────────────────────

class TestCarryTradeAnalyzer:
    def test_fx_carry_positive(self):
        result = CarryTradeAnalyzer.fx_carry(
            high_yield_currency_rate=0.05,
            low_yield_currency_rate=0.01,
            spot_return_annualized=0.001,
        )
        assert "rate_differential" in result
        assert result["rate_differential"] == pytest.approx(0.04, abs=1e-8)

    def test_fx_carry_signal(self):
        result_pos = CarryTradeAnalyzer.fx_carry(0.05, 0.01, 0.001)
        result_neg = CarryTradeAnalyzer.fx_carry(0.01, 0.05, -0.001)
        pos_val = {s.value for s in CarrySignal}
        assert result_pos.get("signal") in pos_val
        assert result_neg.get("signal") in pos_val

    def test_cross_asset_carry_ranking(self, sample_assets):
        ranked = CarryTradeAnalyzer.cross_asset_carry_ranking(sample_assets)
        assert len(ranked) == len(sample_assets)
        for i in range(len(ranked) - 1):
            assert ranked[i]["carry"] >= ranked[i + 1]["carry"]

    def test_bond_equity_carry(self):
        result = CarryTradeAnalyzer.bond_equity_carry(
            dividend_yield=0.02, earnings_yield=0.05, bond_yield_10y=0.045
        )
        assert "earnings_yield" in result
        assert "signal" in result


# ── FlightToSafetyDetector ────────────────────────────────────────────

class TestFlightToSafetyDetector:
    def test_safe_haven_demand_high(self, sample_assets):
        # Make bonds spike and equities crash
        for a in sample_assets:
            if a.asset_class == AssetClass.BONDS:
                a.returns[-21:] = [0.01] * 21
            elif a.asset_class == AssetClass.EQUITIES:
                a.returns[-21:] = [-0.02] * 21
        result = FlightToSafetyDetector.safe_haven_demand(sample_assets)
        assert "demand_level" in result
        assert "safe_haven_avg_return" in result

    def test_flight_to_safety_empty(self):
        result = FlightToSafetyDetector.safe_haven_demand([])
        assert result == {} or "safe_haven_demand" in result


# ── CrossAssetMomentum ────────────────────────────────────────────────

class TestCrossAssetMomentum:
    def test_ts_momentum_positive(self):
        rets = [0.001] * 300
        a = AssetReturn("M", AssetClass.EQUITIES, rets)
        result = CrossAssetMomentum.time_series_momentum(a)
        assert result["trend_return"] > 0

    def test_ts_momentum_negative(self):
        rets = [-0.001] * 300
        a = AssetReturn("N", AssetClass.EQUITIES, rets)
        result = CrossAssetMomentum.time_series_momentum(a)
        assert result["trend_return"] < 0

    def test_ts_momentum_insufficient(self):
        a = AssetReturn("O", AssetClass.EQUITIES, [0.01] * 10)
        result = CrossAssetMomentum.time_series_momentum(a)
        assert result["momentum"] == 0

    def test_rank_momentum(self, sample_assets):
        ranked = CrossAssetMomentum.rank_cross_asset_momentum(sample_assets)
        assert len(ranked) == len(sample_assets)


# ── CrossAssetEngine Orchestrator ─────────────────────────────────────

class TestCrossAssetEngine:
    def test_correlation_matrix(self, engine, sample_assets):
        result = engine.correlation_matrix(sample_assets[:4])
        assert len(result) == 4

    def test_risk_regime_score(self, engine):
        result = engine.risk_regime(0.02, -0.005, -0.001, 18.0)
        assert "risk_on_score" in result

    def test_carry_ranking(self, engine, sample_assets):
        result = engine.carry_ranking(sample_assets)
        assert len(result) == len(sample_assets)

    def test_fed_model(self, engine):
        result = engine.fed_model(0.02, 0.05, 0.045)
        assert "signal" in result

    def test_flight_to_safety(self, engine, sample_assets):
        result = engine.flight_to_safety(sample_assets)
        assert "demand_level" in result or "safe_haven_demand" in result

    def test_momentum_ranking(self, engine, sample_assets):
        result = engine.momentum_ranking(sample_assets)
        assert len(result) == len(sample_assets)

    def test_full_cross_asset_view(self, engine, sample_assets):
        result = engine.full_cross_asset_view(sample_assets, 20.0)
        assert "risk_regime" in result
        assert "momentum_leaders" in result

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "CrossAssetEngine"
        assert len(caps["features"]) >= 12
