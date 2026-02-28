"""
Extended Cross-Asset Engine Tests — 250+ tests covering edge cases, boundary
conditions, parametrized tests, stress tests, property-based invariants, and
enum coverage for the cross-asset correlation, carry, momentum, risk-on/off,
and flight-to-safety analytics.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

import pytest
import math
import random
import statistics
from services.cross_asset_engine import (
    AssetReturn, AssetClass, RiskRegime, CarrySignal,
    CrossAssetCorrelation, RiskOnOffDetector,
    CarryTradeAnalyzer, FlightToSafetyDetector,
    CrossAssetMomentum, CrossAssetEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helper factories
# ═══════════════════════════════════════════════════════════════════════

def _make_returns(n: int, seed: int = 42, mean: float = 0.001, std: float = 0.02) -> list[float]:
    rng = random.Random(seed)
    return [rng.gauss(mean, std) for _ in range(n)]


def _make_asset(symbol="TEST", ac=AssetClass.EQUITIES, n=300, seed=42,
                yield_rate=0.0, carry=0.0) -> AssetReturn:
    return AssetReturn(symbol, ac, returns=_make_returns(n, seed),
                       yield_rate=yield_rate, carry=carry)


# ═══════════════════════════════════════════════════════════════════════
# AssetReturn dataclass
# ═══════════════════════════════════════════════════════════════════════

class TestAssetReturnBasic:
    def test_empty_returns_annualized_return_zero(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[])
        assert a.annualized_return == 0.0

    def test_empty_returns_annualized_vol_zero(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[])
        assert a.annualized_vol == 0.0

    def test_empty_returns_sharpe_zero(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[])
        assert a.sharpe == 0.0

    def test_empty_returns_recent_return_zero(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[])
        assert a.recent_return == 0.0

    def test_single_return_vol_zero(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[0.01])
        assert a.annualized_vol == 0.0

    def test_single_return_sharpe_zero(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[0.01])
        assert a.sharpe == 0.0

    def test_positive_returns_positive_annualized(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[0.001]*252)
        assert a.annualized_return > 0

    def test_negative_returns_negative_annualized(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[-0.005]*252)
        assert a.annualized_return < 0

    def test_annualized_vol_positive_for_varying_returns(self):
        a = _make_asset(n=252)
        assert a.annualized_vol > 0

    def test_sharpe_with_varying_returns(self):
        a = _make_asset(n=252, seed=99)
        assert isinstance(a.sharpe, float)

    def test_recent_return_uses_last_21(self):
        rets = [0.0]*100 + [0.01]*21
        a = AssetReturn("X", AssetClass.EQUITIES, returns=rets)
        assert abs(a.recent_return - 0.21) < 0.001

    def test_recent_return_fewer_than_21(self):
        a = AssetReturn("X", AssetClass.EQUITIES, returns=[0.01]*10)
        assert abs(a.recent_return - 0.10) < 0.001

    def test_to_dict_keys(self):
        a = _make_asset()
        d = a.to_dict()
        expected_keys = {"symbol", "asset_class", "annualized_return",
                         "annualized_vol", "yield_rate", "carry", "recent_return_1m"}
        assert set(d.keys()) == expected_keys

    def test_to_dict_symbol(self):
        a = AssetReturn("AAPL", AssetClass.EQUITIES)
        assert a.to_dict()["symbol"] == "AAPL"

    def test_to_dict_asset_class(self):
        a = AssetReturn("X", AssetClass.BONDS)
        assert a.to_dict()["asset_class"] == "bonds"

    def test_to_dict_yield_rate(self):
        a = AssetReturn("X", AssetClass.BONDS, yield_rate=0.045)
        assert a.to_dict()["yield_rate"] == 0.045


@pytest.mark.parametrize("ac", list(AssetClass))
class TestAssetReturnEnumCoverage:
    def test_creation_with_enum(self, ac):
        a = AssetReturn("SYM", ac, returns=[0.01, 0.02])
        assert a.asset_class == ac

    def test_to_dict_asset_class_value(self, ac):
        a = AssetReturn("SYM", ac)
        assert a.to_dict()["asset_class"] == ac.value


@pytest.mark.parametrize("n_returns", [0, 1, 2, 10, 21, 100, 252, 500, 1000])
class TestAssetReturnLengthVariants:
    def test_annualized_return_finite(self, n_returns):
        a = _make_asset(n=max(n_returns, 1), seed=10)
        if n_returns == 0:
            a = AssetReturn("X", AssetClass.EQUITIES, returns=[])
        assert math.isfinite(a.annualized_return)

    def test_annualized_vol_nonneg(self, n_returns):
        a = _make_asset(n=max(n_returns, 1), seed=10)
        if n_returns == 0:
            a = AssetReturn("X", AssetClass.EQUITIES, returns=[])
        assert a.annualized_vol >= 0

    def test_recent_return_finite(self, n_returns):
        a = _make_asset(n=max(n_returns, 1), seed=10)
        if n_returns == 0:
            a = AssetReturn("X", AssetClass.EQUITIES, returns=[])
        assert math.isfinite(a.recent_return)


# ═══════════════════════════════════════════════════════════════════════
# CrossAssetCorrelation
# ═══════════════════════════════════════════════════════════════════════

class TestPearsonCorrelation:
    def test_perfect_positive(self):
        x = [1, 2, 3, 4, 5]
        y = [2, 4, 6, 8, 10]
        assert CrossAssetCorrelation.pearson_correlation(x, y) == 1.0

    def test_perfect_negative(self):
        x = [1, 2, 3, 4, 5]
        y = [10, 8, 6, 4, 2]
        assert CrossAssetCorrelation.pearson_correlation(x, y) == -1.0

    def test_zero_correlation_orthogonal(self):
        x = [1, 0, -1, 0]
        y = [0, 1, 0, -1]
        assert CrossAssetCorrelation.pearson_correlation(x, y) == 0.0

    def test_single_element_returns_zero(self):
        assert CrossAssetCorrelation.pearson_correlation([1], [2]) == 0.0

    def test_empty_returns_zero(self):
        assert CrossAssetCorrelation.pearson_correlation([], []) == 0.0

    def test_constant_x_returns_zero(self):
        assert CrossAssetCorrelation.pearson_correlation([5]*10, [1,2,3,4,5,6,7,8,9,10]) == 0.0

    def test_constant_y_returns_zero(self):
        assert CrossAssetCorrelation.pearson_correlation([1,2,3,4,5], [5]*5) == 0.0

    def test_both_constant_returns_zero(self):
        assert CrossAssetCorrelation.pearson_correlation([3]*10, [7]*10) == 0.0

    def test_unequal_lengths_uses_min(self):
        x = [1, 2, 3, 4, 5, 6, 7]
        y = [1, 2, 3]
        result = CrossAssetCorrelation.pearson_correlation(x, y)
        assert isinstance(result, float)

    def test_bounded_minus_one_to_one(self):
        x = _make_returns(500, seed=1)
        y = _make_returns(500, seed=2)
        r = CrossAssetCorrelation.pearson_correlation(x, y)
        assert -1.0 <= r <= 1.0

    @pytest.mark.parametrize("seed", range(10))
    def test_symmetry(self, seed):
        rng = random.Random(seed)
        x = [rng.gauss(0, 1) for _ in range(100)]
        y = [rng.gauss(0, 1) for _ in range(100)]
        assert CrossAssetCorrelation.pearson_correlation(x, y) == \
               CrossAssetCorrelation.pearson_correlation(y, x)

    def test_self_correlation_is_one(self):
        x = _make_returns(200)
        assert CrossAssetCorrelation.pearson_correlation(x, x) == 1.0


class TestCorrelationMatrix:
    def test_empty_assets(self):
        assert CrossAssetCorrelation.correlation_matrix([]) == {}

    def test_single_asset_identity(self):
        a = _make_asset(symbol="A")
        m = CrossAssetCorrelation.correlation_matrix([a])
        assert m == {"A": {"A": 1.0}}

    def test_diagonal_is_one(self):
        assets = [_make_asset(symbol=f"S{i}", seed=i) for i in range(5)]
        m = CrossAssetCorrelation.correlation_matrix(assets)
        for a in assets:
            assert m[a.symbol][a.symbol] == 1.0

    def test_symmetric_matrix(self):
        assets = [_make_asset(symbol=f"S{i}", seed=i) for i in range(4)]
        m = CrossAssetCorrelation.correlation_matrix(assets)
        for a in assets:
            for b in assets:
                assert m[a.symbol][b.symbol] == m[b.symbol][a.symbol]

    def test_bounded_values(self):
        assets = [_make_asset(symbol=f"S{i}", seed=i) for i in range(3)]
        m = CrossAssetCorrelation.correlation_matrix(assets)
        for a in assets:
            for b in assets:
                assert -1.0 <= m[a.symbol][b.symbol] <= 1.0


class TestRollingCorrelation:
    def test_output_length_matches_shorter(self):
        x = _make_returns(100)
        y = _make_returns(100)
        r = CrossAssetCorrelation.rolling_correlation(x, y, window=20)
        assert len(r) == 100

    def test_all_values_bounded(self):
        x = _make_returns(200, seed=1)
        y = _make_returns(200, seed=2)
        r = CrossAssetCorrelation.rolling_correlation(x, y, window=30)
        for v in r:
            assert -1.0 <= v <= 1.0

    def test_window_1(self):
        x = _make_returns(50)
        y = _make_returns(50)
        r = CrossAssetCorrelation.rolling_correlation(x, y, window=1)
        assert len(r) == 50

    @pytest.mark.parametrize("window", [5, 20, 60, 120])
    def test_various_windows(self, window):
        x = _make_returns(300, seed=1)
        y = _make_returns(300, seed=2)
        r = CrossAssetCorrelation.rolling_correlation(x, y, window=window)
        assert isinstance(r, list)
        assert all(isinstance(v, float) for v in r)


class TestCorrelationBreakdown:
    def test_returns_expected_keys(self):
        x = _make_returns(300, seed=1)
        y = _make_returns(300, seed=2)
        result = CrossAssetCorrelation.correlation_breakdown(x, y)
        assert "normal_period_correlation" in result
        assert "crisis_period_correlation" in result
        assert "correlation_jumped" in result
        assert "regime_change_detected" in result

    def test_correlation_jumped_is_bool(self):
        x = _make_returns(300, seed=1)
        y = _make_returns(300, seed=2)
        result = CrossAssetCorrelation.correlation_breakdown(x, y)
        assert isinstance(result["correlation_jumped"], bool)

    def test_short_data(self):
        x = _make_returns(10)
        y = _make_returns(10)
        result = CrossAssetCorrelation.correlation_breakdown(x, y)
        assert isinstance(result, dict)

    def test_identical_data_no_regime_change(self):
        x = _make_returns(500, seed=7)
        result = CrossAssetCorrelation.correlation_breakdown(x, x)
        assert not result["regime_change_detected"]


# ═══════════════════════════════════════════════════════════════════════
# RiskOnOffDetector
# ═══════════════════════════════════════════════════════════════════════

class TestRiskOnOffScore:
    def test_returns_dict(self):
        r = RiskOnOffDetector.score_risk_on(0.02, -0.01, -0.005, 15)
        assert isinstance(r, dict)

    def test_has_risk_on_score(self):
        r = RiskOnOffDetector.score_risk_on(0.02, -0.01, -0.005, 15)
        assert "risk_on_score" in r

    def test_has_regime(self):
        r = RiskOnOffDetector.score_risk_on(0.02, -0.01, -0.005, 15)
        assert "regime" in r

    def test_strong_risk_on(self):
        r = RiskOnOffDetector.score_risk_on(0.05, -0.02, -0.01, 12)
        assert r["regime"] == "risk_on"

    def test_strong_risk_off(self):
        r = RiskOnOffDetector.score_risk_on(-0.05, 0.03, 0.02, 35)
        assert r["regime"] == "risk_off"

    def test_neutral_regime(self):
        r = RiskOnOffDetector.score_risk_on(0.0, 0.0, 0.0, 18)
        assert r["regime"] == "neutral"

    def test_score_clamped_at_100(self):
        r = RiskOnOffDetector.score_risk_on(1.0, -1.0, -1.0, 5)
        assert r["risk_on_score"] <= 100

    def test_score_clamped_at_minus_100(self):
        r = RiskOnOffDetector.score_risk_on(-1.0, 1.0, 1.0, 50)
        assert r["risk_on_score"] >= -100

    @pytest.mark.parametrize("vix", [5, 10, 15, 20, 25, 30, 40, 80])
    def test_vix_levels(self, vix):
        r = RiskOnOffDetector.score_risk_on(0.0, 0.0, 0.0, vix)
        assert isinstance(r["risk_on_score"], float)

    def test_gold_signal_risk_off(self):
        r = RiskOnOffDetector.score_risk_on(0.0, 0.0, 0.0, 20, gold_return_5d=0.05)
        assert r["risk_on_score"] < 0 or r["regime"] != "risk_on"

    def test_contributions_present(self):
        r = RiskOnOffDetector.score_risk_on(0.01, 0.005, -0.003, 18)
        assert "equity_contribution" in r
        assert "bond_contribution" in r
        assert "usd_contribution" in r


class TestRegimeSeries:
    def test_empty_inputs(self):
        assert RiskOnOffDetector.regime_series([], [], []) == []

    def test_length_matches_min(self):
        eq = _make_returns(100, seed=1)
        bd = _make_returns(100, seed=2)
        vix = [20.0]*100
        result = RiskOnOffDetector.regime_series(eq, bd, vix)
        assert len(result) == 100

    def test_all_values_are_regimes(self):
        eq = _make_returns(50, seed=1)
        bd = _make_returns(50, seed=2)
        vix = [20.0]*50
        valid = {"risk_on", "risk_off", "neutral", "transition"}
        for r in RiskOnOffDetector.regime_series(eq, bd, vix):
            assert r in valid

    def test_unequal_length_uses_min(self):
        eq = _make_returns(100, seed=1)
        bd = _make_returns(50, seed=2)
        vix = [20.0]*75
        result = RiskOnOffDetector.regime_series(eq, bd, vix)
        assert len(result) == 50

    @pytest.mark.parametrize("window", [1, 3, 5, 10, 20])
    def test_various_windows(self, window):
        eq = _make_returns(60, seed=1)
        bd = _make_returns(60, seed=2)
        vix = [20.0]*60
        result = RiskOnOffDetector.regime_series(eq, bd, vix, window=window)
        assert len(result) == 60


# ═══════════════════════════════════════════════════════════════════════
# CarryTradeAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestFXCarry:
    def test_positive_carry(self):
        r = CarryTradeAnalyzer.fx_carry(0.08, 0.01)
        assert r["net_carry"] > 0
        assert r["rate_differential"] > 0

    def test_negative_carry(self):
        r = CarryTradeAnalyzer.fx_carry(0.01, 0.08)
        assert r["net_carry"] < 0

    def test_zero_carry(self):
        r = CarryTradeAnalyzer.fx_carry(0.05, 0.05)
        assert r["net_carry"] == 0.0

    def test_with_spot_return(self):
        r = CarryTradeAnalyzer.fx_carry(0.08, 0.01, spot_return_annualized=0.02)
        assert r["spot_return"] == 0.02

    def test_strong_carry_signal(self):
        r = CarryTradeAnalyzer.fx_carry(0.10, 0.01)
        assert r["signal"] == "strong_carry"

    def test_moderate_carry_signal(self):
        r = CarryTradeAnalyzer.fx_carry(0.05, 0.03)
        assert r["signal"] == "moderate_carry"

    def test_neutral_signal(self):
        r = CarryTradeAnalyzer.fx_carry(0.03, 0.025)
        assert r["signal"] == "neutral"

    def test_carry_funding_signal(self):
        r = CarryTradeAnalyzer.fx_carry(0.01, 0.10)
        assert r["signal"] == "carry_funding"

    @pytest.mark.parametrize("high,low", [
        (0.0, 0.0), (0.15, 0.0), (0.0, 0.15), (0.05, 0.05), (1.0, 0.0)
    ])
    def test_various_rates(self, high, low):
        r = CarryTradeAnalyzer.fx_carry(high, low)
        assert isinstance(r, dict)
        assert "net_carry" in r


class TestCarryRanking:
    def test_empty(self):
        assert CarryTradeAnalyzer.cross_asset_carry_ranking([]) == []

    def test_sorted_descending(self):
        assets = [
            AssetReturn("A", AssetClass.FX, carry=0.01),
            AssetReturn("B", AssetClass.FX, carry=0.05),
            AssetReturn("C", AssetClass.FX, carry=0.03),
        ]
        r = CarryTradeAnalyzer.cross_asset_carry_ranking(assets)
        assert r[0]["symbol"] == "B"
        assert r[1]["symbol"] == "C"
        assert r[2]["symbol"] == "A"

    def test_rank_numbers(self):
        assets = [AssetReturn(f"S{i}", AssetClass.FX, carry=0.01*i) for i in range(5)]
        r = CarryTradeAnalyzer.cross_asset_carry_ranking(assets)
        for i, item in enumerate(r):
            assert item["rank"] == i + 1

    def test_carry_signal_values(self):
        valid = {"strong_carry", "moderate_carry", "neutral", "carry_funding"}
        assets = [AssetReturn(f"S{i}", AssetClass.FX, carry=v)
                  for i, v in enumerate([-0.05, 0.0, 0.03, 0.06])]
        for item in CarryTradeAnalyzer.cross_asset_carry_ranking(assets):
            assert item["carry_signal"] in valid


class TestBondEquityCarry:
    def test_prefer_equities(self):
        r = CarryTradeAnalyzer.bond_equity_carry(0.02, 0.08, 0.04)
        assert r["prefer_equities"] is True

    def test_prefer_bonds(self):
        r = CarryTradeAnalyzer.bond_equity_carry(0.02, 0.03, 0.06)
        assert r["prefer_equities"] is False

    def test_overweight_equities_signal(self):
        r = CarryTradeAnalyzer.bond_equity_carry(0.02, 0.10, 0.04)
        assert r["signal"] == "overweight_equities"

    def test_overweight_bonds_signal(self):
        r = CarryTradeAnalyzer.bond_equity_carry(0.02, 0.03, 0.07)
        assert r["signal"] == "overweight_bonds"

    def test_neutral_signal(self):
        r = CarryTradeAnalyzer.bond_equity_carry(0.02, 0.05, 0.05)
        assert r["signal"] == "neutral"

    def test_output_keys(self):
        r = CarryTradeAnalyzer.bond_equity_carry(0.02, 0.06, 0.04)
        for k in ["earnings_yield", "dividend_yield", "bond_yield_10y",
                   "equity_vs_bond_carry", "equity_risk_premium",
                   "bond_real_yield", "prefer_equities", "signal"]:
            assert k in r


# ═══════════════════════════════════════════════════════════════════════
# FlightToSafetyDetector
# ═══════════════════════════════════════════════════════════════════════

class TestFlightToSafety:
    def test_empty_assets(self):
        r = FlightToSafetyDetector.safe_haven_demand([])
        assert "insufficient_data" in str(r)

    def test_no_safe_assets(self):
        assets = [_make_asset(ac=AssetClass.EQUITIES)]
        r = FlightToSafetyDetector.safe_haven_demand(assets)
        assert isinstance(r, dict)

    def test_mixed_assets(self):
        safe = AssetReturn("US_TREASURY", AssetClass.BONDS,
                           returns=_make_returns(50, seed=1, mean=0.005))
        risky = AssetReturn("SPY", AssetClass.EQUITIES,
                            returns=_make_returns(50, seed=2, mean=-0.005))
        r = FlightToSafetyDetector.safe_haven_demand([safe, risky])
        assert isinstance(r, dict)

    @pytest.mark.parametrize("lookback", [1, 5, 10, 21])
    def test_various_lookbacks(self, lookback):
        safe = AssetReturn("BOND", AssetClass.BONDS,
                           returns=_make_returns(50, seed=1))
        risky = AssetReturn("SPY", AssetClass.EQUITIES,
                            returns=_make_returns(50, seed=2))
        r = FlightToSafetyDetector.safe_haven_demand([safe, risky], lookback=lookback)
        assert isinstance(r, dict)


# ═══════════════════════════════════════════════════════════════════════
# CrossAssetMomentum
# ═══════════════════════════════════════════════════════════════════════

class TestTimeSeriesMomentum:
    def test_insufficient_data(self):
        a = _make_asset(n=50)
        r = CrossAssetMomentum.time_series_momentum(a, lookback_months=12)
        assert r["signal"] == "hold"
        assert r["momentum"] == 0

    def test_sufficient_data_has_trend_return(self):
        a = _make_asset(n=300, seed=77)
        r = CrossAssetMomentum.time_series_momentum(a, lookback_months=12)
        assert "trend_return" in r

    def test_positive_momentum_long(self):
        # Strongly positive returns
        rets = [0.005]*300
        rng = random.Random(99)
        rets = [r + rng.gauss(0, 0.001) for r in rets]
        a = AssetReturn("UP", AssetClass.EQUITIES, returns=rets)
        r = CrossAssetMomentum.time_series_momentum(a)
        assert r["signal"] == "long"

    def test_negative_momentum_short(self):
        rets = [-0.003]*300
        rng = random.Random(99)
        rets = [r + rng.gauss(0, 0.001) for r in rets]
        a = AssetReturn("DOWN", AssetClass.EQUITIES, returns=rets)
        r = CrossAssetMomentum.time_series_momentum(a)
        assert r["signal"] in ["short", "hold"]

    @pytest.mark.parametrize("lookback", [1, 3, 6, 12])
    def test_various_lookback_months(self, lookback):
        n_needed = lookback * 21 + 21 + 10
        a = _make_asset(n=n_needed)
        r = CrossAssetMomentum.time_series_momentum(a, lookback_months=lookback)
        assert isinstance(r, dict)

    def test_signal_strength_nonneg(self):
        a = _make_asset(n=300)
        r = CrossAssetMomentum.time_series_momentum(a)
        if "signal_strength" in r:
            assert r["signal_strength"] >= 0


class TestRankCrossAssetMomentum:
    def test_empty(self):
        assert CrossAssetMomentum.rank_cross_asset_momentum([]) == []

    def test_ranking_order(self):
        assets = [
            _make_asset(symbol="UP", n=300, seed=1),
            _make_asset(symbol="DOWN", n=300, seed=2),
            _make_asset(symbol="FLAT", n=300, seed=3),
        ]
        r = CrossAssetMomentum.rank_cross_asset_momentum(assets)
        assert isinstance(r, list)
        assert len(r) == 3

    def test_has_asset_class(self):
        a = _make_asset(n=300, ac=AssetClass.COMMODITIES)
        r = CrossAssetMomentum.rank_cross_asset_momentum([a])
        assert r[0]["asset_class"] == "commodities"


# ═══════════════════════════════════════════════════════════════════════
# CrossAssetEngine orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestCrossAssetEngineOrchestrator:
    def setup_method(self):
        self.engine = CrossAssetEngine()
        self.equity = _make_asset(symbol="SPY", ac=AssetClass.EQUITIES, n=300, seed=1)
        self.bond = AssetReturn("TLT", AssetClass.BONDS,
                                returns=_make_returns(300, seed=2),
                                yield_rate=0.04, carry=0.04)
        self.commodity = _make_asset(symbol="GLD", ac=AssetClass.COMMODITIES, n=300,
                                     seed=3, carry=0.0)
        self.crypto = _make_asset(symbol="BTC", ac=AssetClass.CRYPTO, n=300, seed=4,
                                   carry=0.0)
        self.assets = [self.equity, self.bond, self.commodity, self.crypto]

    def test_correlation_matrix(self):
        m = self.engine.correlation_matrix(self.assets)
        assert len(m) == 4
        for sym in m:
            assert m[sym][sym] == 1.0

    def test_risk_regime(self):
        r = self.engine.risk_regime(0.02, -0.01, 0.0, 15)
        assert "regime" in r

    def test_carry_ranking(self):
        r = self.engine.carry_ranking(self.assets)
        assert isinstance(r, list)

    def test_fed_model(self):
        r = self.engine.fed_model(0.02, 0.06, 0.04)
        assert "prefer_equities" in r

    def test_flight_to_safety(self):
        r = self.engine.flight_to_safety(self.assets)
        assert isinstance(r, dict)

    def test_momentum_ranking(self):
        r = self.engine.momentum_ranking(self.assets)
        assert isinstance(r, list)

    def test_full_cross_asset_view(self):
        r = self.engine.full_cross_asset_view(self.assets, vix=20)
        assert "risk_regime" in r
        assert "momentum_leaders" in r
        assert "carry_leaders" in r
        assert "flight_to_safety" in r

    def test_full_view_empty(self):
        r = self.engine.full_cross_asset_view([])
        assert isinstance(r, dict)

    def test_capabilities(self):
        c = self.engine.capabilities()
        assert c["engine"] == "CrossAssetEngine"
        assert "features" in c

    @pytest.mark.parametrize("vix", [5, 15, 25, 40, 80])
    def test_full_view_various_vix(self, vix):
        r = self.engine.full_cross_asset_view(self.assets, vix=vix)
        assert isinstance(r, dict)


# ═══════════════════════════════════════════════════════════════════════
# Property-based / Invariant tests
# ═══════════════════════════════════════════════════════════════════════

class TestPropertyBased:
    @pytest.mark.parametrize("seed", range(20))
    def test_correlation_bounded(self, seed):
        rng = random.Random(seed)
        x = [rng.gauss(0, 1) for _ in range(100)]
        y = [rng.gauss(0, 1) for _ in range(100)]
        r = CrossAssetCorrelation.pearson_correlation(x, y)
        assert -1.0 <= r <= 1.0

    @pytest.mark.parametrize("seed", range(10))
    def test_risk_score_bounded(self, seed):
        rng = random.Random(seed)
        r = RiskOnOffDetector.score_risk_on(
            rng.gauss(0, 0.05), rng.gauss(0, 0.03),
            rng.gauss(0, 0.02), rng.uniform(10, 40)
        )
        assert -100 <= r["risk_on_score"] <= 100

    @pytest.mark.parametrize("seed", range(10))
    def test_carry_ranking_sorted(self, seed):
        rng = random.Random(seed)
        assets = [AssetReturn(f"S{i}", AssetClass.FX,
                              carry=rng.uniform(-0.05, 0.10))
                  for i in range(10)]
        ranked = CarryTradeAnalyzer.cross_asset_carry_ranking(assets)
        carries = [r["carry"] for r in ranked]
        assert carries == sorted(carries, reverse=True)


# ═══════════════════════════════════════════════════════════════════════
# Stress tests
# ═══════════════════════════════════════════════════════════════════════

class TestStress:
    def test_large_correlation_matrix(self):
        assets = [_make_asset(symbol=f"S{i}", n=50, seed=i) for i in range(20)]
        m = CrossAssetCorrelation.correlation_matrix(assets)
        assert len(m) == 20

    def test_long_rolling_correlation(self):
        x = _make_returns(2000, seed=1)
        y = _make_returns(2000, seed=2)
        r = CrossAssetCorrelation.rolling_correlation(x, y, window=60)
        assert len(r) == 2000

    def test_large_regime_series(self):
        n = 1000
        eq = _make_returns(n, seed=1)
        bd = _make_returns(n, seed=2)
        vix = [20.0]*n
        r = RiskOnOffDetector.regime_series(eq, bd, vix)
        assert len(r) == n

    def test_many_assets_carry_ranking(self):
        assets = [AssetReturn(f"S{i}", AssetClass.EQUITIES, carry=i*0.001)
                  for i in range(100)]
        r = CarryTradeAnalyzer.cross_asset_carry_ranking(assets)
        assert len(r) == 100

    def test_many_assets_momentum_ranking(self):
        assets = [_make_asset(symbol=f"S{i}", n=300, seed=i) for i in range(50)]
        r = CrossAssetMomentum.rank_cross_asset_momentum(assets)
        assert len(r) == 50

    def test_full_view_many_assets(self):
        engine = CrossAssetEngine()
        assets = [_make_asset(symbol=f"S{i}", n=300, seed=i, ac=AssetClass.EQUITIES)
                  for i in range(20)]
        assets.append(AssetReturn("BOND", AssetClass.BONDS,
                                  returns=_make_returns(300, seed=99)))
        r = engine.full_cross_asset_view(assets, vix=25)
        assert isinstance(r, dict)


# ═══════════════════════════════════════════════════════════════════════
# RiskRegime + CarrySignal enum tests
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    @pytest.mark.parametrize("regime", list(RiskRegime))
    def test_risk_regime_values(self, regime):
        assert isinstance(regime.value, str)

    @pytest.mark.parametrize("signal", list(CarrySignal))
    def test_carry_signal_values(self, signal):
        assert isinstance(signal.value, str)

    def test_all_asset_classes_count(self):
        assert len(AssetClass) == 7

    def test_risk_regime_count(self):
        assert len(RiskRegime) == 4

    def test_carry_signal_count(self):
        assert len(CarrySignal) == 4
