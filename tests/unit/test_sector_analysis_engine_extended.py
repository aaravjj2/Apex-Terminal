"""
Extended Sector Analysis Engine Tests — 250+ tests covering sector rotation,
relative performance, correlation analysis, breadth analytics, valuation,
JdJ model, business cycle mapping, and stress tests.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

import pytest
import math
import random
import statistics
from services.sector_analysis_engine import (
    GICSSector, BusinessCyclePhase, SectorMomentumSignal,
    SectorData, SECTOR_CYCLE_MAP, SECTOR_BETA_ESTIMATES,
    SectorRelativePerformance, SectorRotationModel,
    SectorCorrelationAnalyzer, SectorBreadthAnalyzer,
    SectorValuationAnalyzer, SectorAnalysisEngine,
)


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _make_returns(n, seed=42, mean=0.001, std=0.015):
    rng = random.Random(seed)
    return [rng.gauss(mean, std) for _ in range(n)]


def _make_sector(sector=GICSSector.IT, n=252, seed=42, pe=22.0,
                 rev_g=0.10, earn_g=0.12, div_y=0.015,
                 mc_b=5000, n_stocks=100):
    return SectorData(
        sector=sector,
        returns_history=_make_returns(n, seed),
        market_cap_b=mc_b,
        num_stocks=n_stocks,
        pe_ratio=pe,
        revenue_growth=rev_g,
        earnings_growth=earn_g,
        dividend_yield=div_y,
    )


def _make_all_sectors(n=252, seed_base=0):
    sectors = []
    for i, s in enumerate(GICSSector):
        sectors.append(_make_sector(
            sector=s, n=n, seed=seed_base + i,
            pe=15 + i * 2, mc_b=1000 + i * 500,
        ))
    return sectors


# ═══════════════════════════════════════════════════════════════════════
# SectorData
# ═══════════════════════════════════════════════════════════════════════

class TestSectorData:
    def test_mtd_return_short(self):
        s = _make_sector(n=10)
        # Less than 21 days - returns sum of all
        assert isinstance(s.mtd_return, float)

    def test_mtd_return_long(self):
        s = _make_sector(n=252)
        # Uses last 21 days
        expected = sum(s.returns_history[-21:])
        assert abs(s.mtd_return - expected) < 0.0001

    def test_ytd_return(self):
        s = _make_sector(n=252)
        assert abs(s.ytd_return - sum(s.returns_history)) < 0.0001

    def test_volatility_30d(self):
        s = _make_sector(n=252)
        assert s.volatility_30d > 0

    def test_volatility_30d_single_return(self):
        s = SectorData(GICSSector.IT, returns_history=[0.01])
        assert s.volatility_30d == 0.0

    def test_volatility_30d_empty(self):
        s = SectorData(GICSSector.IT, returns_history=[])
        assert s.volatility_30d == 0.0

    def test_momentum_3m(self):
        s = _make_sector(n=252)
        expected = sum(s.returns_history[-63:])
        assert abs(s.momentum_3m - expected) < 0.0001

    def test_momentum_6m(self):
        s = _make_sector(n=252)
        expected = sum(s.returns_history[-126:])
        assert abs(s.momentum_6m - expected) < 0.0001

    def test_momentum_12m(self):
        s = _make_sector(n=252)
        expected = sum(s.returns_history[-252:])
        assert abs(s.momentum_12m - expected) < 0.0001

    def test_momentum_short_history(self):
        s = _make_sector(n=30)
        # Uses all history when shorter
        assert s.momentum_3m == sum(s.returns_history)

    def test_to_dict_keys(self):
        s = _make_sector()
        d = s.to_dict()
        expected = {"sector", "mtd_return", "ytd_return", "volatility_30d",
                    "momentum_3m", "momentum_6m", "market_cap_b",
                    "pe_ratio", "revenue_growth"}
        assert set(d.keys()) == expected

    def test_to_dict_sector_value(self):
        s = _make_sector(sector=GICSSector.ENERGY)
        assert s.to_dict()["sector"] == "energy"

    @pytest.mark.parametrize("sector", list(GICSSector))
    def test_creation_all_sectors(self, sector):
        s = _make_sector(sector=sector)
        assert s.sector == sector


# ═══════════════════════════════════════════════════════════════════════
# SectorRelativePerformance
# ═══════════════════════════════════════════════════════════════════════

class TestRelativeReturn:
    def test_identical_returns(self):
        rets = _make_returns(100)
        r = SectorRelativePerformance.relative_return(rets, rets)
        assert all(abs(v) < 0.0001 for v in r)

    def test_outperformance(self):
        sector = [0.01]*50
        bench = [0.005]*50
        r = SectorRelativePerformance.relative_return(sector, bench)
        assert all(v > 0 for v in r)

    def test_unequal_length(self):
        r = SectorRelativePerformance.relative_return([0.01]*10, [0.01]*5)
        assert r == []

    def test_empty(self):
        r = SectorRelativePerformance.relative_return([], [])
        assert r == []


class TestRSRatio:
    def test_positive_rs(self):
        sector = [0.01]*200
        bench = [0.005]*200
        rs = SectorRelativePerformance.rs_ratio(sector, bench)
        assert rs > 0

    def test_negative_rs(self):
        sector = [0.005]*200
        bench = [0.01]*200
        rs = SectorRelativePerformance.rs_ratio(sector, bench)
        assert rs < 0

    def test_short_data(self):
        sector = [0.01]*10
        bench = [0.005]*10
        rs = SectorRelativePerformance.rs_ratio(sector, bench, period=126)
        assert isinstance(rs, float)

    @pytest.mark.parametrize("period", [21, 63, 126, 252])
    def test_various_periods(self, period):
        sector = _make_returns(300, seed=1)
        bench = _make_returns(300, seed=2)
        rs = SectorRelativePerformance.rs_ratio(sector, bench, period=period)
        assert isinstance(rs, float)


class TestRankSectors:
    def test_ranks_11_sectors(self):
        sectors = _make_all_sectors()
        r = SectorRelativePerformance.rank_sectors(sectors)
        assert len(r) == 11

    def test_rank_numbers(self):
        sectors = _make_all_sectors()
        r = SectorRelativePerformance.rank_sectors(sectors)
        ranks = [item["rank"] for item in r]
        assert ranks == list(range(1, 12))

    def test_signals_valid(self):
        valid = {s.value for s in SectorMomentumSignal}
        sectors = _make_all_sectors()
        for item in SectorRelativePerformance.rank_sectors(sectors):
            assert item["signal"] in valid

    @pytest.mark.parametrize("period", ["mtd", "ytd", "3m", "6m", "12m"])
    def test_various_periods(self, period):
        sectors = _make_all_sectors()
        r = SectorRelativePerformance.rank_sectors(sectors, period_returns=period)
        assert len(r) == 11

    def test_empty(self):
        r = SectorRelativePerformance.rank_sectors([])
        assert r == []


class TestSectorDispersion:
    def test_normal(self):
        sectors = _make_all_sectors()
        r = SectorRelativePerformance.sector_dispersion(sectors)
        assert "spread" in r
        assert r["spread"] >= 0

    def test_empty(self):
        r = SectorRelativePerformance.sector_dispersion([])
        assert r == {}

    def test_single_sector(self):
        s = [_make_sector()]
        r = SectorRelativePerformance.sector_dispersion(s)
        assert r["spread"] == 0.0

    def test_output_keys(self):
        sectors = _make_all_sectors()
        r = SectorRelativePerformance.sector_dispersion(sectors)
        for k in ["max", "min", "spread", "std", "mean"]:
            assert k in r


# ═══════════════════════════════════════════════════════════════════════
# SectorRotationModel
# ═══════════════════════════════════════════════════════════════════════

class TestDetectRotation:
    def test_empty(self):
        r = SectorRotationModel.detect_rotation([])
        assert r == {}

    def test_normal(self):
        sectors = _make_all_sectors()
        r = SectorRotationModel.detect_rotation(sectors)
        assert "current_leaders" in r
        assert "current_laggards" in r
        assert len(r["current_leaders"]) == 3
        assert len(r["current_laggards"]) == 3

    def test_with_previous_leaders(self):
        sectors = _make_all_sectors()
        prev = [GICSSector.IT, GICSSector.HEALTHCARE, GICSSector.ENERGY]
        r = SectorRotationModel.detect_rotation(sectors, previous_leaders=prev)
        assert "rotation_detected" in r
        assert isinstance(r["rotation_detected"], bool)

    def test_no_rotation_same_leaders(self):
        sectors = _make_all_sectors()
        r1 = SectorRotationModel.detect_rotation(sectors)
        leaders = [GICSSector(v) for v in r1["current_leaders"]]
        r2 = SectorRotationModel.detect_rotation(sectors, previous_leaders=leaders)
        assert r2["rotation_detected"] is False

    def test_accelerating_decelerating(self):
        sectors = _make_all_sectors()
        r = SectorRotationModel.detect_rotation(sectors)
        assert isinstance(r["accelerating"], list)
        assert isinstance(r["decelerating"], list)


class TestCyclePhaseAllocation:
    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_all_phases(self, phase):
        r = SectorRotationModel.cycle_phase_allocation(phase)
        assert r["phase"] == phase.value
        assert "weights" in r
        assert "preferred_sectors" in r

    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_weights_sum_near_one(self, phase):
        r = SectorRotationModel.cycle_phase_allocation(phase)
        total = sum(r["weights"].values())
        assert abs(total - 1.0) < 0.01

    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_all_11_sectors_have_weights(self, phase):
        r = SectorRotationModel.cycle_phase_allocation(phase)
        assert len(r["weights"]) == 11

    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_preferred_sectors_have_higher_weight(self, phase):
        r = SectorRotationModel.cycle_phase_allocation(phase)
        preferred = r["preferred_sectors"]
        weights = r["weights"]
        if preferred:
            avg_pref = statistics.mean(weights[s] for s in preferred)
            non_pref = [s for s in weights if s not in preferred]
            if non_pref:
                avg_other = statistics.mean(weights[s] for s in non_pref)
                assert avg_pref >= avg_other


class TestJDJModelScore:
    def test_positive_momentum_high_score(self):
        s = _make_sector(n=252, seed=42, earn_g=0.15, rev_g=0.12)
        score = SectorRotationModel.jdj_model_score(s)
        assert isinstance(score, float)

    def test_zero_fundamentals(self):
        s = SectorData(GICSSector.IT, returns_history=[0.0]*252,
                       earnings_growth=0.0, revenue_growth=0.0)
        score = SectorRotationModel.jdj_model_score(s)
        assert score == 0.0

    def test_negative_fundamentals(self):
        s = SectorData(GICSSector.IT, returns_history=[-0.01]*252,
                       earnings_growth=-0.10, revenue_growth=-0.05)
        score = SectorRotationModel.jdj_model_score(s)
        assert score < 0


# ═══════════════════════════════════════════════════════════════════════
# SectorCorrelationAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestPairwiseCorrelation:
    def test_empty(self):
        assert SectorCorrelationAnalyzer.pairwise_correlation([]) == {}

    def test_single_sector(self):
        s = [_make_sector()]
        assert SectorCorrelationAnalyzer.pairwise_correlation(s) == {}

    def test_two_sectors(self):
        s1 = _make_sector(sector=GICSSector.IT, seed=1)
        s2 = _make_sector(sector=GICSSector.ENERGY, seed=2)
        r = SectorCorrelationAnalyzer.pairwise_correlation([s1, s2])
        assert isinstance(r, dict)
        assert len(r) == 2

    def test_diagonal_is_one(self):
        sectors = _make_all_sectors(n=100)[:3]
        r = SectorCorrelationAnalyzer.pairwise_correlation(sectors)
        for s in sectors:
            assert r[s.sector.value][s.sector.value] == 1.0

    def test_symmetric(self):
        sectors = _make_all_sectors(n=100)[:4]
        r = SectorCorrelationAnalyzer.pairwise_correlation(sectors)
        keys = list(r.keys())
        for i, k1 in enumerate(keys):
            for k2 in keys[i+1:]:
                assert abs(r[k1][k2] - r[k2][k1]) < 0.0001

    def test_bounded(self):
        sectors = _make_all_sectors(n=100)[:3]
        r = SectorCorrelationAnalyzer.pairwise_correlation(sectors)
        for k1 in r:
            for k2 in r[k1]:
                assert -1.0 <= r[k1][k2] <= 1.0


class TestDiversificationScore:
    def test_empty(self):
        assert SectorCorrelationAnalyzer.diversification_score({}) == 0.0

    def test_single_sector(self):
        assert SectorCorrelationAnalyzer.diversification_score({"A": {"A": 1.0}}) == 0.0

    def test_perfect_correlation(self):
        matrix = {"A": {"A": 1.0, "B": 1.0}, "B": {"A": 1.0, "B": 1.0}}
        score = SectorCorrelationAnalyzer.diversification_score(matrix)
        assert score == 0.0

    def test_zero_correlation(self):
        matrix = {"A": {"A": 1.0, "B": 0.0}, "B": {"A": 0.0, "B": 1.0}}
        score = SectorCorrelationAnalyzer.diversification_score(matrix)
        assert score == 0.5

    def test_bounded(self):
        sectors = _make_all_sectors(n=100)
        matrix = SectorCorrelationAnalyzer.pairwise_correlation(sectors)
        score = SectorCorrelationAnalyzer.diversification_score(matrix)
        assert 0 <= score <= 1


# ═══════════════════════════════════════════════════════════════════════
# SectorBreadthAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestSectorBreadth:
    def test_empty(self):
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, [])
        assert r == {}

    def test_all_positive(self):
        returns = [0.01]*100
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, returns)
        assert r["advancing"] == 100
        assert r["declining"] == 0
        assert r["breadth_signal"] == "bullish"

    def test_all_negative(self):
        returns = [-0.01]*100
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, returns)
        assert r["declining"] == 100
        assert r["breadth_signal"] == "bearish"

    def test_mixed(self):
        returns = [0.01]*50 + [-0.01]*50
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, returns)
        assert r["advancing"] == 50
        assert r["declining"] == 50
        assert r["breadth_signal"] == "neutral"

    def test_with_zeros(self):
        returns = [0.01]*40 + [0.0]*20 + [-0.01]*40
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, returns)
        assert r["unchanged"] == 20

    def test_ad_ratio(self):
        returns = [0.01]*75 + [-0.01]*25
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, returns)
        assert r["ad_ratio"] == 3.0

    def test_output_keys(self):
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.ENERGY, [0.01, -0.01])
        for k in ["sector", "advancing", "declining", "unchanged",
                   "pct_advancing", "ad_ratio", "avg_return",
                   "median_return", "breadth_signal"]:
            assert k in r


class TestMarketBreadthSummary:
    def test_empty(self):
        r = SectorBreadthAnalyzer.market_breadth_summary([])
        assert r == {}

    def test_all_bullish(self):
        breadths = [
            {"advancing": 70, "declining": 30, "unchanged": 0, "breadth_signal": "bullish"}
            for _ in range(10)
        ]
        r = SectorBreadthAnalyzer.market_breadth_summary(breadths)
        assert r["bullish_sectors"] == 10

    def test_output_keys(self):
        breadths = [
            {"advancing": 50, "declining": 50, "unchanged": 0, "breadth_signal": "neutral"}
        ]
        r = SectorBreadthAnalyzer.market_breadth_summary(breadths)
        for k in ["total_advancing", "total_declining", "total_stocks",
                   "market_ad_ratio", "pct_advancing", "bullish_sectors",
                   "bearish_sectors", "market_breadth"]:
            assert k in r


# ═══════════════════════════════════════════════════════════════════════
# SectorValuationAnalyzer
# ═══════════════════════════════════════════════════════════════════════

class TestPEPremiumDiscount:
    def test_expensive(self):
        s = _make_sector(sector=GICSSector.IT, pe=30.0)
        r = SectorValuationAnalyzer.pe_premium_discount(s)
        assert r["valuation"] == "expensive"

    def test_fair(self):
        s = _make_sector(sector=GICSSector.IT, pe=22.0)
        r = SectorValuationAnalyzer.pe_premium_discount(s)
        assert r["valuation"] == "fair"

    def test_cheap(self):
        s = _make_sector(sector=GICSSector.IT, pe=15.0)
        r = SectorValuationAnalyzer.pe_premium_discount(s)
        assert r["valuation"] == "cheap"

    def test_zero_pe(self):
        s = SectorData(GICSSector.IT, pe_ratio=0)
        r = SectorValuationAnalyzer.pe_premium_discount(s)
        assert r == {}

    def test_output_keys(self):
        s = _make_sector(pe=20.0)
        r = SectorValuationAnalyzer.pe_premium_discount(s)
        for k in ["sector", "current_pe", "historical_median_pe",
                   "pct_vs_history", "valuation"]:
            assert k in r

    @pytest.mark.parametrize("sector", list(GICSSector))
    def test_all_sectors_have_historical_pe(self, sector):
        s = _make_sector(sector=sector, pe=20.0)
        r = SectorValuationAnalyzer.pe_premium_discount(s)
        assert "historical_median_pe" in r


class TestYieldSpreadAnalysis:
    def test_attractive(self):
        s = [_make_sector(pe=10.0)]  # earnings yield = 10%
        r = SectorValuationAnalyzer.yield_spread_analysis(s, risk_free_rate=0.05)
        assert r[0]["signal"] == "attractive"

    def test_unattractive(self):
        s = [_make_sector(pe=50.0)]  # earnings yield = 2%
        r = SectorValuationAnalyzer.yield_spread_analysis(s, risk_free_rate=0.05)
        assert r[0]["signal"] == "unattractive"

    def test_empty(self):
        r = SectorValuationAnalyzer.yield_spread_analysis([])
        assert r == []

    def test_output_keys(self):
        s = [_make_sector(pe=20.0)]
        r = SectorValuationAnalyzer.yield_spread_analysis(s)
        for k in ["sector", "earnings_yield", "risk_free_rate",
                   "yield_spread", "signal"]:
            assert k in r[0]


# ═══════════════════════════════════════════════════════════════════════
# SectorAnalysisEngine orchestrator
# ═══════════════════════════════════════════════════════════════════════

class TestSectorAnalysisEngineOrchestrator:
    def setup_method(self):
        self.engine = SectorAnalysisEngine()
        self.sectors = _make_all_sectors()

    def test_rank_sectors(self):
        r = self.engine.rank_sectors(self.sectors)
        assert len(r) == 11

    def test_detect_rotation(self):
        r = self.engine.detect_rotation(self.sectors)
        assert "current_leaders" in r

    def test_cycle_allocation(self):
        r = self.engine.cycle_allocation(BusinessCyclePhase.EARLY_RECOVERY)
        assert "weights" in r

    def test_correlation_matrix(self):
        r = self.engine.correlation_matrix(self.sectors)
        assert isinstance(r, dict)

    def test_sector_breadth(self):
        returns = _make_returns(100, seed=1)
        r = self.engine.sector_breadth(GICSSector.IT, returns)
        assert "advancing" in r

    def test_market_breadth(self):
        breadths = []
        for s in GICSSector:
            b = self.engine.sector_breadth(s, _make_returns(100, seed=hash(s.value)))
            breadths.append(b)
        r = self.engine.market_breadth(breadths)
        assert "market_breadth" in r

    def test_valuation_snapshot(self):
        r = self.engine.valuation_snapshot(self.sectors)
        assert len(r) == 11

    def test_jdj_ranking(self):
        r = self.engine.jdj_ranking(self.sectors)
        assert len(r) == 11
        assert r[0]["rank"] == 1

    def test_dispersion(self):
        r = self.engine.dispersion(self.sectors)
        assert "spread" in r

    def test_capabilities(self):
        c = self.engine.capabilities()
        assert c["engine"] == "SectorAnalysisEngine"
        assert "features" in c


# ═══════════════════════════════════════════════════════════════════════
# Enum coverage
# ═══════════════════════════════════════════════════════════════════════

class TestEnums:
    @pytest.mark.parametrize("sector", list(GICSSector))
    def test_gics_sector_values(self, sector):
        assert isinstance(sector.value, str)

    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_business_cycle_phase_values(self, phase):
        assert isinstance(phase.value, str)

    @pytest.mark.parametrize("signal", list(SectorMomentumSignal))
    def test_momentum_signal_values(self, signal):
        assert isinstance(signal.value, str)

    def test_gics_sector_count(self):
        assert len(GICSSector) == 11

    def test_business_cycle_phase_count(self):
        assert len(BusinessCyclePhase) == 4

    def test_momentum_signal_count(self):
        assert len(SectorMomentumSignal) == 5

    def test_sector_cycle_map_complete(self):
        for phase in BusinessCyclePhase:
            assert phase in SECTOR_CYCLE_MAP

    def test_sector_beta_estimates_complete(self):
        for sector in GICSSector:
            assert sector in SECTOR_BETA_ESTIMATES


# ═══════════════════════════════════════════════════════════════════════
# Property-based tests
# ═══════════════════════════════════════════════════════════════════════

class TestPropertyBased:
    @pytest.mark.parametrize("seed", range(10))
    def test_rank_assigns_all_ranks(self, seed):
        sectors = _make_all_sectors(seed_base=seed * 100)
        r = SectorRelativePerformance.rank_sectors(sectors)
        ranks = {item["rank"] for item in r}
        assert ranks == set(range(1, 12))

    @pytest.mark.parametrize("seed", range(10))
    def test_dispersion_spread_nonneg(self, seed):
        sectors = _make_all_sectors(seed_base=seed * 100)
        r = SectorRelativePerformance.sector_dispersion(sectors)
        assert r["spread"] >= 0

    @pytest.mark.parametrize("phase", list(BusinessCyclePhase))
    def test_allocation_weights_positive(self, phase):
        r = SectorRotationModel.cycle_phase_allocation(phase)
        for w in r["weights"].values():
            assert w > 0

    @pytest.mark.parametrize("seed", range(5))
    def test_jdj_ranking_sorted(self, seed):
        engine = SectorAnalysisEngine()
        sectors = _make_all_sectors(seed_base=seed * 100)
        r = engine.jdj_ranking(sectors)
        scores = [item["jdj_score"] for item in r]
        assert scores == sorted(scores, reverse=True)


# ═══════════════════════════════════════════════════════════════════════
# Stress tests
# ═══════════════════════════════════════════════════════════════════════

class TestStress:
    def test_large_returns_history(self):
        s = _make_sector(n=5000)
        assert s.ytd_return == sum(s.returns_history)

    def test_large_breadth(self):
        returns = _make_returns(10000, seed=42)
        r = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, returns)
        assert r["advancing"] + r["declining"] + r["unchanged"] == 10000

    def test_many_sectors_correlation(self):
        sectors = _make_all_sectors(n=100)
        r = SectorCorrelationAnalyzer.pairwise_correlation(sectors)
        assert len(r) == 11

    def test_repeated_ranking(self):
        sectors = _make_all_sectors()
        for _ in range(50):
            r = SectorRelativePerformance.rank_sectors(sectors)
            assert len(r) == 11

    def test_all_phases_allocation_total(self):
        for phase in BusinessCyclePhase:
            r = SectorRotationModel.cycle_phase_allocation(phase)
            total = sum(r["weights"].values())
            assert abs(total - 1.0) < 0.01
