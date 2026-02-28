"""Tests for market_breadth_engine.py — comprehensive coverage."""

import statistics
from datetime import datetime

import pytest

from services.market_breadth_engine import (
    AdvanceDeclineCalculator,
    ArmsIndexCalculator,
    BreadthDivergenceDetector,
    BreadthRegimeClassifier,
    BreadthSignal,
    BreadthThrustCalculator,
    DailyBreadthData,
    HindenburgOmenDetector,
    MarketBreadthEngine,
    MarketRegime,
    McCllellanCalculator,
    NewHighLowCalculator,
    PercentAboveMACalculator,
    SectorRotationAnalyzer,
    StockAboveMASummary,
    VolumeBreadthCalculator,
)


# ── Helpers ─────────────────────────────────────────────────────────────

def _make_breadth_data(n: int = 30, bullish: bool = True) -> list[DailyBreadthData]:
    """Generate n days of breadth data."""
    data = []
    for i in range(n):
        if bullish:
            adv = 2000 + (i * 10)
            dec = 1500 - (i * 5)
        else:
            adv = 1500 - (i * 5)
            dec = 2000 + (i * 10)
        dec = max(dec, 100)
        adv = max(adv, 100)
        data.append(DailyBreadthData(
            date=f"2024-06-{i + 1:02d}",
            advances=adv,
            declines=dec,
            unchanged=200,
            new_highs=50 + (i if bullish else -i),
            new_lows=20 + (-i if bullish else i),
            up_volume=5e9 + (i * 1e8 if bullish else -i * 1e8),
            down_volume=3e9 - (i * 5e7 if bullish else -i * 5e7),
            total_issues=adv + dec + 200,
        ))
    return data


def _make_stock_prices(n_stocks: int = 20, n_days: int = 250) -> dict[str, list[float]]:
    """Generate synthetic stock price series."""
    import random
    random.seed(42)
    prices = {}
    for i in range(n_stocks):
        symbol = f"SYM{i:03d}"
        p = 100.0
        series = []
        for _ in range(n_days):
            p *= 1 + random.gauss(0.0005, 0.02)
            series.append(round(p, 2))
        prices[symbol] = series
    return prices


# ── DailyBreadthData ───────────────────────────────────────────────────

class TestDailyBreadthData:
    def test_ad_difference(self):
        d = DailyBreadthData(date="2024-01-01", advances=2500, declines=1500)
        assert d.ad_difference == 1000

    def test_ad_ratio(self):
        d = DailyBreadthData(date="2024-01-01", advances=2000, declines=1000)
        assert d.ad_ratio == 2.0

    def test_ad_ratio_zero_declines(self):
        d = DailyBreadthData(date="2024-01-01", advances=2000, declines=0)
        assert d.ad_ratio == float("inf")

    def test_nh_nl_difference(self):
        d = DailyBreadthData(date="2024-01-01", advances=100, declines=100, new_highs=80, new_lows=20)
        assert d.nh_nl_difference == 60

    def test_volume_ratio(self):
        d = DailyBreadthData(date="2024-01-01", advances=100, declines=100, up_volume=5e9, down_volume=2.5e9)
        assert d.volume_ratio == pytest.approx(2.0)

    def test_to_dict(self):
        d = DailyBreadthData(date="2024-01-01", advances=2000, declines=1500, new_highs=50, new_lows=20)
        result = d.to_dict()
        assert result["date"] == "2024-01-01"
        assert result["ad_difference"] == 500
        assert result["nh_nl_difference"] == 30


# ── StockAboveMASummary ────────────────────────────────────────────────

class TestStockAboveMASummary:
    def test_percentages(self):
        s = StockAboveMASummary(total_stocks=100, above_20sma=80, above_50sma=60, above_100sma=40, above_200sma=30)
        assert s.pct_above_20sma == 80.0
        assert s.pct_above_50sma == 60.0
        assert s.pct_above_100sma == 40.0
        assert s.pct_above_200sma == 30.0

    def test_zero_stocks(self):
        s = StockAboveMASummary(total_stocks=0)
        assert s.pct_above_200sma == 0.0

    def test_to_dict(self):
        s = StockAboveMASummary(total_stocks=500, above_50sma=300)
        d = s.to_dict()
        assert d["pct_above_50sma"] == 60.0


# ── AdvanceDeclineCalculator ───────────────────────────────────────────

class TestAdvanceDeclineCalculator:
    def test_ad_line_bullish(self):
        data = _make_breadth_data(10, bullish=True)
        result = AdvanceDeclineCalculator.ad_line(data)
        assert len(result) == 10
        # Bullish data should have cumulative going up
        assert result[-1]["ad_line"] > 0

    def test_ad_line_bearish(self):
        data = _make_breadth_data(10, bullish=False)
        result = AdvanceDeclineCalculator.ad_line(data)
        assert result[-1]["ad_line"] < 0

    def test_ad_ratio_series(self):
        data = _make_breadth_data(5)
        result = AdvanceDeclineCalculator.ad_ratio_series(data)
        assert len(result) == 5
        assert all("ad_ratio" in r for r in result)

    def test_ad_breadth_pct(self):
        data = _make_breadth_data(5)
        result = AdvanceDeclineCalculator.ad_breadth_pct(data)
        assert len(result) == 5
        assert all(0 <= r["advance_pct"] <= 100 for r in result)

    def test_cumulative_ad_volume(self):
        data = _make_breadth_data(5, bullish=True)
        result = AdvanceDeclineCalculator.cumulative_ad_volume(data)
        assert len(result) == 5
        # Bullish: up_volume > down_volume
        assert result[-1]["cumulative_vol_diff"] > 0


# ── McClellan ──────────────────────────────────────────────────────────

class TestMcClellanCalculator:
    def test_oscillator(self):
        data = _make_breadth_data(40)
        calc = McCllellanCalculator()
        result = calc.oscillator(data)
        assert len(result) == 40
        assert all("oscillator" in r for r in result)
        assert all("ema19" in r for r in result)
        assert all("ema39" in r for r in result)

    def test_summation_index(self):
        data = _make_breadth_data(40)
        calc = McCllellanCalculator()
        result = calc.summation_index(data)
        assert len(result) == 40
        assert all("summation_index" in r for r in result)

    def test_empty(self):
        calc = McCllellanCalculator()
        assert calc.oscillator([]) == []
        assert calc.summation_index([]) == []

    def test_single_day(self):
        data = _make_breadth_data(1)
        calc = McCllellanCalculator()
        assert calc.oscillator(data) == []  # needs >= 2


# ── ArmsIndex (TRIN) ──────────────────────────────────────────────────

class TestArmsIndexCalculator:
    def test_trin_bullish(self):
        d = DailyBreadthData(date="2024-01-01", advances=2500, declines=1500, up_volume=6e9, down_volume=2e9)
        result = ArmsIndexCalculator.trin([d])
        assert result[0]["trin"] is not None
        assert result[0]["trin"] < 1.0  # bullish

    def test_trin_bearish(self):
        d = DailyBreadthData(date="2024-01-01", advances=1000, declines=2500, up_volume=2e9, down_volume=6e9)
        result = ArmsIndexCalculator.trin([d])
        assert result[0]["trin"] is not None
        assert result[0]["trin"] > 1.0  # bearish

    def test_trin_moving_avg(self):
        data = _make_breadth_data(20)
        result = ArmsIndexCalculator.moving_average_trin(data, period=5)
        assert len(result) == 20
        assert result[4]["trin_ma"] is not None  # enough data for 5-period MA


# ── NewHighLow ─────────────────────────────────────────────────────────

class TestNewHighLowCalculator:
    def test_nh_nl_line(self):
        data = _make_breadth_data(10, bullish=True)
        result = NewHighLowCalculator.nh_nl_line(data)
        assert len(result) == 10
        assert result[-1]["nh_nl_line"] > 0  # bullish

    def test_nh_nl_ratio(self):
        data = _make_breadth_data(10)
        result = NewHighLowCalculator.nh_nl_ratio(data)
        assert all(0 <= r["nh_pct"] <= 100 for r in result)

    def test_nh_nl_moving_avg(self):
        data = _make_breadth_data(10)
        result = NewHighLowCalculator.nh_nl_moving_avg(data, period=5)
        assert len(result) == 10
        assert all("nh_nl_ma" in r for r in result)


# ── BreadthThrust ──────────────────────────────────────────────────────

class TestBreadthThrustCalculator:
    def test_breadth_thrust(self):
        data = _make_breadth_data(30)
        result = BreadthThrustCalculator.breadth_thrust(data, period=10)
        assert len(result) == 30
        assert all("breadth_ratio" in r for r in result)
        assert all("ema" in r for r in result)

    def test_zweig_insufficient_data(self):
        data = _make_breadth_data(5)
        result = BreadthThrustCalculator.zweig_breadth_thrust(data)
        assert result["signal"] is False
        assert "insufficient_data" in result

    def test_zweig_no_signal(self):
        data = _make_breadth_data(30, bullish=True)
        result = BreadthThrustCalculator.zweig_breadth_thrust(data)
        assert "signal" in result


# ── HindenburgOmen ─────────────────────────────────────────────────────

class TestHindenburgOmenDetector:
    def test_detect_no_omen(self):
        data = _make_breadth_data(20)
        result = HindenburgOmenDetector.detect(data)
        assert len(result) == 20
        assert all("hindenburg_omen" in r for r in result)

    def test_detect_with_high_nh_nl(self):
        # Craft data where both NH% and NL% > 2.8%
        data = []
        for i in range(20):
            total = 3000
            data.append(DailyBreadthData(
                date=f"2024-06-{i + 1:02d}",
                advances=1400 - i * 20,
                declines=1400 + i * 20,
                unchanged=200,
                new_highs=int(total * 0.04),  # 4%
                new_lows=int(total * 0.04),  # 4%
                up_volume=3e9,
                down_volume=4e9,
                total_issues=total,
            ))
        result = HindenburgOmenDetector.detect(data)
        # At least some should have criteria_1_met
        crit1_met = [r for r in result if r["criteria_1_met"]]
        assert len(crit1_met) > 0


# ── PercentAboveMA ─────────────────────────────────────────────────────

class TestPercentAboveMACalculator:
    def test_calculate(self):
        prices = _make_stock_prices(10, 60)
        result = PercentAboveMACalculator.calculate(prices, ma_period=50)
        assert result["total_stocks"] == 10
        assert 0 <= result["pct_above"] <= 100

    def test_insufficient_data(self):
        prices = {"SYM": [100.0] * 10}
        result = PercentAboveMACalculator.calculate(prices, ma_period=50)
        assert result["total_stocks"] == 0

    def test_multi_ma_summary(self):
        prices = _make_stock_prices(20, 250)
        summary = PercentAboveMACalculator.multi_ma_summary(prices)
        assert summary.total_stocks == 20
        d = summary.to_dict()
        assert 0 <= d["pct_above_200sma"] <= 100


# ── VolumeBreadth ──────────────────────────────────────────────────────

class TestVolumeBreadthCalculator:
    def test_up_down_ratio(self):
        data = _make_breadth_data(10)
        result = VolumeBreadthCalculator.up_down_volume_ratio(data)
        assert len(result) == 10

    def test_cumulative_volume(self):
        data = _make_breadth_data(10, bullish=True)
        result = VolumeBreadthCalculator.cumulative_volume_line(data)
        assert result[-1]["cumulative_net_vol"] > 0

    def test_volume_thrust(self):
        data = [DailyBreadthData(
            date="2024-01-01", advances=2500, declines=500,
            up_volume=10e9, down_volume=1e9,
        )]
        result = VolumeBreadthCalculator.volume_thrust(data, threshold=9.0)
        assert result[0]["volume_thrust"] is True

    def test_volume_no_thrust(self):
        data = [DailyBreadthData(
            date="2024-01-01", advances=1500, declines=1500,
            up_volume=3e9, down_volume=3e9,
        )]
        result = VolumeBreadthCalculator.volume_thrust(data, threshold=9.0)
        assert result[0]["volume_thrust"] is False


# ── SectorRotation ─────────────────────────────────────────────────────

class TestSectorRotationAnalyzer:
    def test_risk_on(self):
        returns = {
            "technology": 2.5,
            "consumer_discretionary": 1.8,
            "industrials": 1.5,
            "utilities": 0.2,
            "consumer_staples": 0.3,
            "healthcare": 0.4,
        }
        result = SectorRotationAnalyzer.rotation_score(returns)
        assert result["regime"] == "risk_on"
        assert result["rotation_score"] > 0

    def test_risk_off(self):
        returns = {
            "technology": -1.5,
            "consumer_discretionary": -1.0,
            "utilities": 2.0,
            "consumer_staples": 1.5,
            "healthcare": 1.8,
        }
        result = SectorRotationAnalyzer.rotation_score(returns)
        assert result["regime"] == "risk_off"

    def test_relative_strength(self):
        returns = {"tech": 3.0, "energy": 1.0, "utilities": -0.5}
        result = SectorRotationAnalyzer.relative_strength(returns)
        assert len(result) == 3
        assert result[0]["rank"] == 1
        assert result[0]["sector"] == "tech"


# ── BreadthRegimeClassifier ───────────────────────────────────────────

class TestBreadthRegimeClassifier:
    def test_bullish_regime(self):
        data = _make_breadth_data(30, bullish=True)
        result = BreadthRegimeClassifier.classify(data)
        assert result["regime"] in ("strong_bull", "bull")

    def test_bearish_regime(self):
        data = _make_breadth_data(30, bullish=False)
        result = BreadthRegimeClassifier.classify(data)
        assert result["regime"] in ("strong_bear", "bear")

    def test_insufficient_data(self):
        data = _make_breadth_data(5)
        result = BreadthRegimeClassifier.classify(data, lookback=20)
        assert result["insufficient_data"] is True


# ── BreadthDivergenceDetector ──────────────────────────────────────────

class TestBreadthDivergenceDetector:
    def test_bearish_divergence(self):
        # Price going up, AD going down
        prices = list(range(100, 140)) + list(range(140, 180))  # 40+40 = 80
        ad = list(range(100, 140)) + list(range(130, 90, -1))  # 40 + 40 = 80, ad flat then down
        result = BreadthDivergenceDetector.detect_divergence(prices, ad, lookback=20)
        assert result["signal"] == BreadthSignal.DIVERGENCE_BEARISH.value

    def test_no_divergence(self):
        prices = list(range(100, 140))
        ad = list(range(100, 140))
        result = BreadthDivergenceDetector.detect_divergence(prices, ad, lookback=20)
        assert result["signal"] == BreadthSignal.NEUTRAL.value

    def test_insufficient_data(self):
        result = BreadthDivergenceDetector.detect_divergence([1, 2], [1, 2], lookback=20)
        assert "insufficient_data" in result


# ── MarketBreadthEngine (Orchestrator) ─────────────────────────────────

class TestMarketBreadthEngine:
    def _engine(self) -> MarketBreadthEngine:
        return MarketBreadthEngine()

    def test_ad_line(self):
        engine = self._engine()
        data = _make_breadth_data(20)
        result = engine.ad_line(data)
        assert len(result) == 20

    def test_mcclellan_oscillator(self):
        engine = self._engine()
        data = _make_breadth_data(40)
        result = engine.mcclellan_oscillator(data)
        assert len(result) == 40

    def test_mcclellan_summation(self):
        engine = self._engine()
        data = _make_breadth_data(40)
        result = engine.mcclellan_summation(data)
        assert len(result) == 40

    def test_trin(self):
        engine = self._engine()
        data = _make_breadth_data(10)
        result = engine.trin(data)
        assert len(result) == 10

    def test_nh_nl_line(self):
        engine = self._engine()
        data = _make_breadth_data(10)
        result = engine.nh_nl_line(data)
        assert len(result) == 10

    def test_breadth_thrust(self):
        engine = self._engine()
        data = _make_breadth_data(30)
        result = engine.breadth_thrust(data)
        assert len(result) == 30

    def test_volume_ratio(self):
        engine = self._engine()
        data = _make_breadth_data(10)
        result = engine.volume_ratio(data)
        assert len(result) == 10

    def test_sector_rotation(self):
        engine = self._engine()
        returns = {"technology": 2.0, "utilities": 0.5}
        result = engine.sector_rotation(returns)
        assert "rotation_score" in result

    def test_market_regime(self):
        engine = self._engine()
        data = _make_breadth_data(30)
        result = engine.market_regime(data)
        assert "regime" in result

    def test_pct_above_ma(self):
        engine = self._engine()
        prices = _make_stock_prices(10, 60)
        result = engine.pct_above_ma(prices, period=50)
        assert "pct_above" in result

    def test_full_dashboard(self):
        engine = self._engine()
        data = _make_breadth_data(40)
        result = engine.full_dashboard(data)
        assert "ad_line" in result
        assert "mcclellan" in result
        assert "trin" in result
        assert "regime" in result

    def test_capabilities(self):
        engine = self._engine()
        caps = engine.capabilities()
        assert caps["engine"] == "MarketBreadthEngine"
        assert len(caps["indicators"]) >= 15
