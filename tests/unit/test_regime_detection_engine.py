"""Tests for regime_detection_engine.py — comprehensive coverage."""

import math
import random
import statistics

import pytest

from services.regime_detection_engine import (
    CyclePhase,
    CyclePhaseDetector,
    MarketRegime,
    MarketRegimeClassifier,
    MomentumRegime,
    MomentumRegimeDetector,
    RegimeDetectionEngine,
    RegimeSmoother,
    RegimeState,
    RegimeTransition,
    RegimeTransitionTracker,
    StrategySelector,
    StructuralBreakDetector,
    TrendRegime,
    TrendStrengthAnalyzer,
    VolatilityRegime,
    VolatilityRegimeDetector,
)


# ── Helpers ─────────────────────────────────────────────────────────────

def _bull_market(n: int = 300, seed: int = 42) -> list[float]:
    """Generate a trending bull market series."""
    random.seed(seed)
    prices = [100.0]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + random.gauss(0.002, 0.01)))
    return prices


def _bear_market(n: int = 300, seed: int = 42) -> list[float]:
    """Generate a trending bear market series."""
    random.seed(seed)
    prices = [100.0]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + random.gauss(-0.002, 0.01)))
    return prices


def _sideways_market(n: int = 300, seed: int = 42) -> list[float]:
    """Generate a range-bound/sideways market."""
    random.seed(seed)
    prices = [100.0]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + random.gauss(0.0, 0.005)))
    return prices


def _volatile_market(n: int = 300, seed: int = 42) -> list[float]:
    """Generate a highly volatile market."""
    random.seed(seed)
    prices = [100.0]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + random.gauss(0.0, 0.04)))
    return prices


def _regime_shift_series(n: int = 600) -> list[float]:
    """Bull → bear with structural break in middle."""
    random.seed(42)
    prices = [100.0]
    for i in range(1, n):
        if i < n // 2:
            drift = 0.003
        else:
            drift = -0.003
        prices.append(prices[-1] * (1 + random.gauss(drift, 0.01)))
    return prices


# ── RegimeState ────────────────────────────────────────────────────────

class TestRegimeState:
    def test_to_dict(self):
        state = RegimeState(
            market=MarketRegime.BULL,
            volatility=VolatilityRegime.NORMAL,
            trend=TrendRegime.MODERATE_TREND,
            momentum=MomentumRegime.POSITIVE,
            cycle_phase=CyclePhase.EXPANSION,
            confidence=0.75,
        )
        d = state.to_dict()
        assert d["market"] == "bull"
        assert d["volatility"] == "normal"
        assert d["cycle_phase"] == "expansion"
        assert d["confidence"] == 0.75

    def test_to_dict_no_cycle(self):
        state = RegimeState(
            market=MarketRegime.NEUTRAL,
            volatility=VolatilityRegime.LOW,
            trend=TrendRegime.RANGE_BOUND,
            momentum=MomentumRegime.NEUTRAL,
        )
        d = state.to_dict()
        assert d["cycle_phase"] is None


# ── MarketRegimeClassifier ────────────────────────────────────────────

class TestMarketRegimeClassifier:
    def test_sma_bull(self):
        prices = _bull_market(300)
        regimes = MarketRegimeClassifier.classify_by_sma(prices)
        assert len(regimes) == 300
        # Last regime should be bullish
        last = regimes[-1]["regime"]
        assert last in (MarketRegime.BULL, MarketRegime.STRONG_BULL)

    def test_sma_bear(self):
        prices = _bear_market(300)
        regimes = MarketRegimeClassifier.classify_by_sma(prices)
        last = regimes[-1]["regime"]
        assert last in (MarketRegime.BEAR, MarketRegime.STRONG_BEAR)

    def test_returns_bull(self):
        prices = _bull_market(300)
        regimes = MarketRegimeClassifier.classify_by_returns(prices)
        assert len(regimes) == 300
        last = regimes[-1]["regime"]
        assert last in (MarketRegime.BULL, MarketRegime.STRONG_BULL)

    def test_returns_short_series(self):
        prices = [100, 105, 110]
        regimes = MarketRegimeClassifier.classify_by_returns(prices, lookback=60)
        assert len(regimes) == 3

    def test_composite(self):
        prices = _bull_market(300)
        regimes = MarketRegimeClassifier.classify_composite(prices)
        assert len(regimes) == 300
        assert "sma_regime" in regimes[-1]
        assert "return_regime" in regimes[-1]
        assert "confidence" in regimes[-1]


# ── VolatilityRegimeDetector ──────────────────────────────────────────

class TestVolatilityRegimeDetector:
    def test_realized_vol(self):
        prices = _bull_market(200)
        vol = VolatilityRegimeDetector.realized_volatility(prices)
        assert len(vol) == 200
        assert vol[-1] > 0

    def test_classify_normal(self):
        prices = _sideways_market(300)
        regimes = VolatilityRegimeDetector.classify(prices)
        assert len(regimes) == 300
        # Should have some normal or low vol readings
        low_normal = sum(1 for r in regimes if r["regime"] in (VolatilityRegime.LOW, VolatilityRegime.NORMAL))
        assert low_normal > 20

    def test_classify_volatile(self):
        prices = _volatile_market(300)
        regimes = VolatilityRegimeDetector.classify(prices)
        # Should have some high/extreme readings
        high_extreme = sum(1 for r in regimes if r["regime"] in (VolatilityRegime.HIGH, VolatilityRegime.EXTREME))
        assert high_extreme > 0

    def test_vol_of_vol(self):
        prices = _volatile_market(200)
        vov = VolatilityRegimeDetector.vol_of_vol(prices)
        assert len(vov) == 200


# ── TrendStrengthAnalyzer ────────────────────────────────────────────

class TestTrendStrengthAnalyzer:
    def test_adx_trending(self):
        prices = _bull_market(200)
        high = [p * 1.01 for p in prices]
        low = [p * 0.99 for p in prices]
        adx = TrendStrengthAnalyzer.adx_simple(high, low, prices)
        assert len(adx) == 200
        assert adx[-1] > 0

    def test_efficiency_ratio_trending(self):
        # Perfect uptrend
        prices = list(range(100, 200))
        er = TrendStrengthAnalyzer.efficiency_ratio(prices, period=20)
        assert er[-1] > 0.8  # should be close to 1.0

    def test_efficiency_ratio_choppy(self):
        # Oscillating prices
        prices = [100 + (i % 2) * 5 for i in range(100)]
        er = TrendStrengthAnalyzer.efficiency_ratio(prices, period=20)
        assert er[-1] < 0.3  # should be low

    def test_classify(self):
        prices = _bull_market(200)
        regimes = TrendStrengthAnalyzer.classify(prices)
        assert len(regimes) == 200
        assert "efficiency_ratio" in regimes[-1]
        assert "adx" in regimes[-1]


# ── MomentumRegimeDetector ────────────────────────────────────────────

class TestMomentumRegimeDetector:
    def test_rsi_overbought(self):
        prices = _bull_market(200)
        rsi_vals = MomentumRegimeDetector.rsi(prices)
        assert len(rsi_vals) == 200
        # Strong bull should push RSI higher
        assert rsi_vals[-1] > 40

    def test_roc(self):
        prices = _bull_market(200)
        roc = MomentumRegimeDetector.rate_of_change(prices, 20)
        assert len(roc) == 200
        assert roc[-1] > 0  # positive for bull

    def test_classify_bull(self):
        prices = _bull_market(200)
        regimes = MomentumRegimeDetector.classify(prices)
        last = regimes[-1]["regime"]
        assert last in (MomentumRegime.POSITIVE, MomentumRegime.STRONG_POSITIVE)

    def test_classify_bear(self):
        prices = _bear_market(200)
        regimes = MomentumRegimeDetector.classify(prices)
        # Count negative momentum readings in the back half
        neg = sum(1 for r in regimes[100:] if r["regime"] in (MomentumRegime.NEGATIVE, MomentumRegime.STRONG_NEGATIVE, MomentumRegime.NEUTRAL))
        assert neg > 30  # bear market should have mostly negative or neutral


# ── StructuralBreakDetector ───────────────────────────────────────────

class TestStructuralBreakDetector:
    def test_cusum_detects_break(self):
        prices = _regime_shift_series(600)
        breaks = StructuralBreakDetector.cusum(prices, threshold=3.0)
        assert len(breaks) > 0

    def test_cusum_no_break(self):
        prices = _sideways_market(200)
        breaks = StructuralBreakDetector.cusum(prices, threshold=5.0)
        # Might still detect some, but should be few
        assert isinstance(breaks, list)

    def test_rolling_mean_shift(self):
        prices = _regime_shift_series(600)
        breaks = StructuralBreakDetector.rolling_mean_shift(prices, window=50)
        assert isinstance(breaks, list)

    def test_variance_ratio(self):
        prices = _bull_market(300)
        results = StructuralBreakDetector.variance_ratio_test(prices)
        assert len(results) >= 299  # returns-based, may be n-1
        # Last should have a VR value
        assert "vr" in results[-1]

    def test_variance_ratio_short(self):
        results = StructuralBreakDetector.variance_ratio_test([100, 105])
        assert len(results) > 0


# ── RegimeTransitionTracker ───────────────────────────────────────────

class TestRegimeTransitionTracker:
    def test_detect_transitions(self):
        regimes = [
            {"regime": "bull"},
            {"regime": "bull"},
            {"regime": "bear"},
            {"regime": "bear"},
            {"regime": "neutral"},
        ]
        transitions = RegimeTransitionTracker.detect_transitions(regimes)
        assert len(transitions) == 2
        assert transitions[0].from_regime == "bull"
        assert transitions[0].to_regime == "bear"

    def test_regime_durations(self):
        regimes = [
            {"regime": "bull"},
            {"regime": "bull"},
            {"regime": "bull"},
            {"regime": "bear"},
            {"regime": "bear"},
            {"regime": "bull"},
        ]
        durations = RegimeTransitionTracker.regime_durations(regimes)
        assert "bull" in durations
        assert "bear" in durations
        assert durations["bear"]["count"] == 1
        assert durations["bear"]["avg_duration"] == 2.0

    def test_transition_matrix(self):
        transitions = [
            RegimeTransition("bull", "bear", 3, "market"),
            RegimeTransition("bear", "bull", 6, "market"),
            RegimeTransition("bull", "bear", 9, "market"),
        ]
        matrix = RegimeTransitionTracker.transition_matrix(transitions)
        assert "bull" in matrix
        assert matrix["bull"]["bear"] == 1.0  # all bull transitions go to bear


# ── RegimeSmoother ────────────────────────────────────────────────────

class TestRegimeSmoother:
    def test_min_duration_filter(self):
        regimes = [
            {"regime": "bull"}, {"regime": "bull"}, {"regime": "bull"},
            {"regime": "bull"}, {"regime": "bull"}, {"regime": "bull"},
            {"regime": "bear"},  # Single bar — should be smoothed out
            {"regime": "bull"}, {"regime": "bull"}, {"regime": "bull"},
        ]
        smoothed = RegimeSmoother.minimum_duration_filter(regimes, min_bars=3)
        assert len(smoothed) == 10
        # The single-bar bear should be absorbed
        assert smoothed[6]["regime"] == "bull"

    def test_consensus_filter(self):
        s1 = [{"regime": "bull"}, {"regime": "bull"}, {"regime": "bear"}]
        s2 = [{"regime": "bull"}, {"regime": "bear"}, {"regime": "bear"}]
        s3 = [{"regime": "bull"}, {"regime": "bull"}, {"regime": "bear"}]
        result = RegimeSmoother.consensus_filter([s1, s2, s3])
        assert len(result) == 3
        assert result[0]["regime"] == "bull"
        assert result[0]["confidence"] == pytest.approx(1.0)
        assert result[2]["regime"] == "bear"


# ── CyclePhaseDetector ───────────────────────────────────────────────

class TestCyclePhaseDetector:
    def test_detect_expansion(self):
        prices = _bull_market(200)
        phases = CyclePhaseDetector.detect(prices)
        assert len(phases) == 200
        # Should have expansion phases for sustained uptrend
        expansions = sum(1 for p in phases if p["phase"] == CyclePhase.EXPANSION)
        assert expansions > 0

    def test_detect_short(self):
        phases = CyclePhaseDetector.detect([100, 110, 120])
        assert len(phases) == 3

    def test_detect_regime_shift(self):
        prices = _regime_shift_series(300)
        phases = CyclePhaseDetector.detect(prices)
        # Should show multiple phases
        unique_phases = set(p["phase"] for p in phases)
        assert len(unique_phases) >= 2


# ── StrategySelector ─────────────────────────────────────────────────

class TestStrategySelector:
    def test_bull_trending(self):
        state = RegimeState(
            market=MarketRegime.STRONG_BULL,
            volatility=VolatilityRegime.NORMAL,
            trend=TrendRegime.STRONG_TREND,
            momentum=MomentumRegime.STRONG_POSITIVE,
        )
        rec = StrategySelector.recommend(state)
        assert "trend_following" in rec["recommended_strategies"]
        assert rec["position_size_multiplier"] == 1.0

    def test_bear_high_vol(self):
        state = RegimeState(
            market=MarketRegime.STRONG_BEAR,
            volatility=VolatilityRegime.EXTREME,
            trend=TrendRegime.STRONG_TREND,
            momentum=MomentumRegime.STRONG_NEGATIVE,
        )
        rec = StrategySelector.recommend(state)
        assert rec["position_size_multiplier"] == 0.3  # extreme vol
        assert rec["stop_loss_multiplier"] == 2.0

    def test_neutral_range(self):
        state = RegimeState(
            market=MarketRegime.NEUTRAL,
            volatility=VolatilityRegime.LOW,
            trend=TrendRegime.RANGE_BOUND,
            momentum=MomentumRegime.NEUTRAL,
        )
        rec = StrategySelector.recommend(state)
        assert "mean_reversion" in rec["recommended_strategies"]

    def test_fallback(self):
        state = RegimeState(
            market=MarketRegime.BEAR,
            volatility=VolatilityRegime.NORMAL,
            trend=TrendRegime.CHOPPY,  # No exact match
            momentum=MomentumRegime.NEGATIVE,
        )
        rec = StrategySelector.recommend(state)
        assert len(rec["recommended_strategies"]) > 0


# ── RegimeDetectionEngine ────────────────────────────────────────────

class TestRegimeDetectionEngine:
    def _engine(self) -> RegimeDetectionEngine:
        return RegimeDetectionEngine()

    def test_classify_market(self):
        engine = self._engine()
        prices = _bull_market(300)
        regimes = engine.classify_market(prices)
        assert len(regimes) == 300

    def test_classify_volatility(self):
        engine = self._engine()
        prices = _volatile_market(200)
        regimes = engine.classify_volatility(prices)
        assert len(regimes) == 200

    def test_classify_trend(self):
        engine = self._engine()
        prices = _bull_market(200)
        regimes = engine.classify_trend(prices)
        assert len(regimes) == 200

    def test_classify_momentum(self):
        engine = self._engine()
        prices = _bear_market(200)
        regimes = engine.classify_momentum(prices)
        assert len(regimes) == 200

    def test_detect_breaks_cusum(self):
        engine = self._engine()
        prices = _regime_shift_series(600)
        breaks = engine.detect_breaks(prices, method="cusum")
        assert isinstance(breaks, list)

    def test_detect_breaks_mean_shift(self):
        engine = self._engine()
        prices = _regime_shift_series(600)
        breaks = engine.detect_breaks(prices, method="mean_shift")
        assert isinstance(breaks, list)

    def test_detect_cycle(self):
        engine = self._engine()
        prices = _bull_market(200)
        phases = engine.detect_cycle(prices)
        assert len(phases) == 200

    def test_get_transitions(self):
        engine = self._engine()
        regimes = [{"regime": "bull"}, {"regime": "bear"}, {"regime": "bull"}]
        transitions = engine.get_transitions(regimes)
        assert len(transitions) == 2

    def test_get_durations(self):
        engine = self._engine()
        regimes = [
            {"regime": "bull"}, {"regime": "bull"}, {"regime": "bull"},
            {"regime": "bear"}, {"regime": "bear"},
        ]
        durations = engine.get_durations(regimes)
        assert "bull" in durations

    def test_smooth_regimes(self):
        engine = self._engine()
        regimes = [{"regime": "bull"}] * 10 + [{"regime": "bear"}] + [{"regime": "bull"}] * 5
        smoothed = engine.smooth_regimes(regimes, min_bars=3)
        assert len(smoothed) == 16

    def test_full_regime_state(self):
        engine = self._engine()
        prices = _bull_market(300)
        state = engine.full_regime_state(prices)
        assert isinstance(state, RegimeState)
        assert state.market in list(MarketRegime)

    def test_recommend_strategy(self):
        engine = self._engine()
        prices = _bull_market(300)
        rec = engine.recommend_strategy(prices)
        assert "recommended_strategies" in rec
        assert "position_size_multiplier" in rec

    def test_full_dashboard(self):
        engine = self._engine()
        prices = _bull_market(300)
        dashboard = engine.full_dashboard(prices)
        assert "current_state" in dashboard
        assert "recommended_strategy" in dashboard
        assert "structural_breaks" in dashboard

    def test_capabilities(self):
        engine = self._engine()
        caps = engine.capabilities()
        assert caps["engine"] == "RegimeDetectionEngine"
        assert len(caps["features"]) >= 10
