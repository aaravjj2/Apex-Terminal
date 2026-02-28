"""
Tests for SectorAnalysisEngine — Sector rotation, breadth, correlation, valuation.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../phase1'))

from services.sector_analysis_engine import (
    SectorData,
    SectorRelativePerformance,
    SectorRotationModel,
    SectorCorrelationAnalyzer,
    SectorBreadthAnalyzer,
    SectorValuationAnalyzer,
    SectorAnalysisEngine,
    GICSSector,
    BusinessCyclePhase,
    SectorMomentumSignal,
)
import random


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def sample_sectors():
    rng = random.Random(42)
    sectors = []
    for s in GICSSector:
        returns = [rng.gauss(0.0002, 0.01) for _ in range(252)]
        sectors.append(SectorData(
            sector=s,
            returns_history=returns,
            market_cap_b=rng.uniform(500, 10000),
            num_stocks=rng.randint(20, 100),
            pe_ratio=rng.uniform(12, 35),
            revenue_growth=rng.uniform(-0.05, 0.20),
            earnings_growth=rng.uniform(-0.10, 0.25),
            dividend_yield=rng.uniform(0.01, 0.05),
        ))
    return sectors


@pytest.fixture
def engine():
    return SectorAnalysisEngine()


# ── SectorData Properties ─────────────────────────────────────────────

class TestSectorData:
    def test_mtd_return(self):
        s = SectorData(GICSSector.IT, returns_history=[0.001] * 21)
        assert abs(s.mtd_return - 0.021) < 1e-9

    def test_ytd_return(self):
        s = SectorData(GICSSector.ENERGY, returns_history=[0.002] * 252)
        assert abs(s.ytd_return - 0.504) < 1e-6

    def test_volatility_30d(self):
        returns = [0.01, -0.01] * 30
        s = SectorData(GICSSector.FINANCIALS, returns_history=returns)
        assert s.volatility_30d > 0

    def test_volatility_insufficient(self):
        s = SectorData(GICSSector.IT, returns_history=[0.001])
        assert s.volatility_30d == 0.0

    def test_momentum_attrs(self):
        returns = [0.001] * 252
        s = SectorData(GICSSector.HEALTHCARE, returns_history=returns)
        assert s.momentum_3m > 0
        assert s.momentum_6m > 0
        assert s.momentum_12m > 0

    def test_to_dict(self, sample_sectors):
        d = sample_sectors[0].to_dict()
        assert "sector" in d
        assert "mtd_return" in d
        assert "volatility_30d" in d


# ── SectorRelativePerformance ─────────────────────────────────────────

class TestSectorRelativePerformance:
    def test_relative_return_equal_length(self):
        sector = [0.01, -0.02, 0.005]
        bench = [0.005, -0.01, 0.002]
        rel = SectorRelativePerformance.relative_return(sector, bench)
        assert len(rel) == 3
        assert rel[0] == pytest.approx(0.005, abs=1e-9)

    def test_relative_return_unequal_length(self):
        rel = SectorRelativePerformance.relative_return([0.01], [0.01, 0.02])
        assert rel == []

    def test_rs_ratio(self):
        sector = [0.002] * 126
        bench = [0.001] * 126
        rs = SectorRelativePerformance.rs_ratio(sector, bench, 126)
        assert rs > 0  # sector outperforming

    def test_rank_sectors_mtd(self, sample_sectors):
        ranked = SectorRelativePerformance.rank_sectors(sample_sectors, "mtd")
        assert len(ranked) == len(GICSSector)
        assert ranked[0]["rank"] == 1
        # Check sorted descending
        for i in range(len(ranked) - 1):
            assert ranked[i]["return"] >= ranked[i + 1]["return"]

    def test_rank_signals(self, sample_sectors):
        ranked = SectorRelativePerformance.rank_sectors(sample_sectors, "mtd")
        valid_signals = {s.value for s in SectorMomentumSignal}
        for r in ranked:
            assert r["signal"] in valid_signals

    def test_dispersion(self, sample_sectors):
        d = SectorRelativePerformance.sector_dispersion(sample_sectors, "mtd")
        assert "spread" in d
        assert "std" in d
        assert d["spread"] >= 0


# ── SectorRotationModel ───────────────────────────────────────────────

class TestSectorRotationModel:
    def test_detect_rotation(self, sample_sectors):
        result = SectorRotationModel.detect_rotation(sample_sectors)
        assert "current_leaders" in result
        assert "current_laggards" in result
        assert len(result["current_leaders"]) == 3
        assert len(result["current_laggards"]) == 3

    def test_detect_rotation_empty(self):
        result = SectorRotationModel.detect_rotation([])
        assert result == {}

    def test_cycle_allocation_all_phases(self):
        for phase in BusinessCyclePhase:
            result = SectorRotationModel.cycle_phase_allocation(phase)
            assert "preferred_sectors" in result
            assert "weights" in result
            weights = result["weights"]
            assert abs(sum(weights.values()) - 1.0) < 0.01

    def test_preferred_sectors_have_higher_weight(self):
        result = SectorRotationModel.cycle_phase_allocation(BusinessCyclePhase.RECESSION)
        preferred = result["preferred_sectors"]
        weights = result["weights"]
        non_preferred_avg = sum(w for s, w in weights.items() if s not in preferred) / max(
            len([s for s in weights if s not in preferred]), 1
        )
        preferred_avg = sum(weights[s] for s in preferred if s in weights) / max(len(preferred), 1)
        assert preferred_avg >= non_preferred_avg

    def test_jdj_model_score(self):
        s2 = SectorData(GICSSector.IT)
        s2.returns_history = [0.003] * 126  # good momentum
        s2.earnings_growth = 0.30
        s2.revenue_growth = 0.20
        score = SectorRotationModel.jdj_model_score(s2)
        assert isinstance(score, float)


# ── SectorCorrelationAnalyzer ─────────────────────────────────────────

class TestSectorCorrelationAnalyzer:
    def test_pairwise_correlation_shape(self, sample_sectors):
        corr = SectorCorrelationAnalyzer.pairwise_correlation(sample_sectors[:4])
        assert len(corr) == 4
        for k, row in corr.items():
            assert corr[k][k] == 1.0
            for v in row.values():
                assert -1 <= v <= 1

    def test_correlation_symmetric(self, sample_sectors):
        corr = SectorCorrelationAnalyzer.pairwise_correlation(sample_sectors[:4])
        keys = list(corr.keys())
        for i in range(len(keys)):
            for j in range(len(keys)):
                assert abs(corr[keys[i]][keys[j]] - corr[keys[j]][keys[i]]) < 1e-6

    def test_single_sector(self, sample_sectors):
        result = SectorCorrelationAnalyzer.pairwise_correlation(sample_sectors[:1])
        assert result == {}

    def test_diversification_score(self, sample_sectors):
        corr = SectorCorrelationAnalyzer.pairwise_correlation(sample_sectors)
        score = SectorCorrelationAnalyzer.diversification_score(corr)
        assert 0 <= score <= 1


# ── SectorBreadthAnalyzer ─────────────────────────────────────────────

class TestSectorBreadthAnalyzer:
    def test_sector_breadth_basic(self):
        returns = [0.01, 0.02, -0.01, -0.005, 0.015, -0.02]
        result = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, returns)
        assert result["advancing"] == 3
        assert result["declining"] == 3
        assert "pct_advancing" in result
        assert "breadth_signal" in result

    def test_breadth_signal_bullish(self):
        returns = [0.01] * 70 + [-0.01] * 30
        result = SectorBreadthAnalyzer.sector_breadth(GICSSector.HEALTHCARE, returns)
        assert result["breadth_signal"] == "bullish"

    def test_breadth_signal_bearish(self):
        returns = [0.01] * 30 + [-0.01] * 70
        result = SectorBreadthAnalyzer.sector_breadth(GICSSector.ENERGY, returns)
        assert result["breadth_signal"] == "bearish"

    def test_market_breadth_summary(self):
        breadths = [
            {"advancing": 60, "declining": 40, "unchanged": 0, "breadth_signal": "bullish"},
            {"advancing": 30, "declining": 70, "unchanged": 0, "breadth_signal": "bearish"},
            {"advancing": 50, "declining": 50, "unchanged": 0, "breadth_signal": "neutral"},
        ]
        result = SectorBreadthAnalyzer.market_breadth_summary(breadths)
        assert "total_advancing" in result
        assert "market_breadth" in result
        assert result["total_advancing"] == 140

    def test_empty_returns(self):
        result = SectorBreadthAnalyzer.sector_breadth(GICSSector.IT, [])
        assert result == {}


# ── SectorValuationAnalyzer ───────────────────────────────────────────

class TestSectorValuationAnalyzer:
    def test_pe_premium_discount_expensive(self):
        s = SectorData(GICSSector.IT)
        s.pe_ratio = 40.0  # well above historical median of 22
        result = SectorValuationAnalyzer.pe_premium_discount(s)
        assert result["valuation"] == "expensive"

    def test_pe_premium_discount_cheap(self):
        s = SectorData(GICSSector.FINANCIALS)
        s.pe_ratio = 8.0  # well below historical median of 12
        result = SectorValuationAnalyzer.pe_premium_discount(s)
        assert result["valuation"] == "cheap"

    def test_pe_premium_discount_zero_pe(self):
        s = SectorData(GICSSector.IT)
        s.pe_ratio = 0
        result = SectorValuationAnalyzer.pe_premium_discount(s)
        assert result == {}

    def test_yield_spread_analysis(self, sample_sectors):
        results = SectorValuationAnalyzer.yield_spread_analysis(sample_sectors, 0.05)
        assert len(results) > 0
        for r in results:
            assert "earnings_yield" in r
            assert "signal" in r


# ── SectorAnalysisEngine Orchestrator ─────────────────────────────────

class TestSectorAnalysisEngine:
    def test_rank_sectors(self, engine, sample_sectors):
        result = engine.rank_sectors(sample_sectors, "mtd")
        assert len(result) == len(GICSSector)

    def test_detect_rotation(self, engine, sample_sectors):
        result = engine.detect_rotation(sample_sectors)
        assert "current_leaders" in result

    def test_cycle_allocation(self, engine):
        result = engine.cycle_allocation(BusinessCyclePhase.EARLY_RECOVERY)
        assert "weights" in result

    def test_correlation_matrix(self, engine, sample_sectors):
        result = engine.correlation_matrix(sample_sectors[:5])
        assert len(result) == 5

    def test_sector_breadth(self, engine):
        returns = [0.01, 0.02, -0.005, 0.015, -0.01]
        result = engine.sector_breadth(GICSSector.IT, returns)
        assert "advancing" in result

    def test_market_breadth(self, engine):
        sector_breadths = [
            {"advancing": 60, "declining": 40, "unchanged": 0, "breadth_signal": "bullish"},
        ]
        result = engine.market_breadth(sector_breadths)
        assert "market_breadth" in result

    def test_valuation_snapshot(self, engine, sample_sectors):
        results = engine.valuation_snapshot(sample_sectors)
        assert len(results) > 0

    def test_jdj_ranking(self, engine, sample_sectors):
        results = engine.jdj_ranking(sample_sectors)
        assert len(results) == len(GICSSector)
        assert results[0]["rank"] == 1

    def test_dispersion(self, engine, sample_sectors):
        result = engine.dispersion(sample_sectors)
        assert "spread" in result

    def test_capabilities(self, engine):
        caps = engine.capabilities()
        assert caps["engine"] == "SectorAnalysisEngine"
        assert len(caps["features"]) >= 15
        assert len(caps["sectors"]) == 11
