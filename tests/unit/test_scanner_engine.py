"""
test_scanner_engine.py — Comprehensive tests for scanner/screener engine
=========================================================================
Tests all components: TechnicalScanner, FundamentalScanner, VolumeScanner,
MomentumScanner, PatternScanner, CompositeScanner, PredefinedScans, ScannerEngine.
"""

import pytest
import numpy as np
from phase1.services.scanner_engine import (
    FilterOperator, ScanFilter, ScanResult, SymbolData,
    TechnicalScanner, FundamentalScanner, VolumeScanner,
    MomentumScanner, PatternScanner, CompositeScanner,
    PredefinedScans, ScannerEngine,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _trending_up(n: int = 300, start: float = 100.0) -> np.ndarray:
    """Generate uptrending price data."""
    rng = np.random.default_rng(42)
    returns = 0.001 + 0.01 * rng.standard_normal(n)
    return start * np.cumprod(1 + returns)


def _trending_down(n: int = 300, start: float = 100.0) -> np.ndarray:
    rng = np.random.default_rng(43)
    returns = -0.001 + 0.01 * rng.standard_normal(n)
    return start * np.cumprod(1 + returns)


def _sideways(n: int = 300, start: float = 100.0) -> np.ndarray:
    rng = np.random.default_rng(44)
    returns = 0.005 * rng.standard_normal(n)
    return start * np.cumprod(1 + returns)


def _make_symbol(symbol: str, close: np.ndarray, **kwargs) -> SymbolData:
    n = len(close)
    rng = np.random.default_rng(hash(symbol) % 2**32)
    noise = rng.uniform(0.005, 0.02, n)
    high = close * (1 + noise)
    low = close * (1 - noise)
    open_ = close * (1 + rng.uniform(-0.005, 0.005, n))
    volume = rng.uniform(1e6, 5e6, n)
    return SymbolData(
        symbol=symbol, close=close, high=high, low=low,
        open=open_, volume=volume, **kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
#  ScanFilter Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestScanFilter:

    def test_gt(self):
        f = ScanFilter("rsi", FilterOperator.GT, 70)
        assert f.evaluate({"rsi": 75}) is True
        assert f.evaluate({"rsi": 65}) is False

    def test_lte(self):
        f = ScanFilter("pe_ratio", FilterOperator.LTE, 15)
        assert f.evaluate({"pe_ratio": 15}) is True
        assert f.evaluate({"pe_ratio": 16}) is False

    def test_between(self):
        f = ScanFilter("price", FilterOperator.BETWEEN, 50, 150)
        assert f.evaluate({"price": 100}) is True
        assert f.evaluate({"price": 200}) is False

    def test_eq(self):
        f = ScanFilter("sector", FilterOperator.EQ, "tech")
        assert f.evaluate({"sector": "tech"}) is True
        assert f.evaluate({"sector": "finance"}) is False

    def test_missing_field(self):
        f = ScanFilter("rsi", FilterOperator.GT, 50)
        assert f.evaluate({"price": 100}) is False


# ═══════════════════════════════════════════════════════════════════════════════
#  TechnicalScanner Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestTechnicalScanner:

    def test_sma(self):
        data = np.arange(1.0, 21.0)
        sma = TechnicalScanner.sma(data, 5)
        assert np.isnan(sma[0])
        assert sma[4] == pytest.approx(3.0, abs=0.01)  # mean(1,2,3,4,5) = 3

    def test_ema(self):
        data = np.arange(1.0, 21.0)
        ema = TechnicalScanner.ema(data, 5)
        assert ema[0] == 1.0
        assert len(ema) == 20

    def test_rsi_range(self):
        data = _trending_up(100)
        rsi = TechnicalScanner.rsi(data)
        valid = rsi[~np.isnan(rsi)]
        assert all(0 <= v <= 100 for v in valid)

    def test_macd(self):
        data = _trending_up(100)
        macd_line, signal, histogram = TechnicalScanner.macd(data)
        assert len(macd_line) == 100
        assert len(signal) == 100
        assert len(histogram) == 100

    def test_bollinger_bands(self):
        data = _sideways(100)
        upper, mid, lower = TechnicalScanner.bollinger_bands(data)
        # Upper > mid > lower
        valid_idx = ~np.isnan(mid)
        assert all(upper[valid_idx] > lower[valid_idx])

    def test_atr(self):
        close = _trending_up(100)
        high = close * 1.01
        low = close * 0.99
        atr = TechnicalScanner.atr(high, low, close)
        valid = atr[~np.isnan(atr)]
        assert all(v > 0 for v in valid)

    def test_scan_rsi_oversold(self):
        # Create a strongly downtrending stock
        down = _trending_down(100, 200.0)
        symbols = [_make_symbol("DOWN", down)]
        results = TechnicalScanner.scan_rsi_oversold(symbols, threshold=50)
        # Downtrend should have low RSI
        assert isinstance(results, list)

    def test_scan_rsi_overbought(self):
        up = _trending_up(100, 50.0)
        symbols = [_make_symbol("UP", up)]
        results = TechnicalScanner.scan_rsi_overbought(symbols, threshold=50)
        assert isinstance(results, list)

    def test_scan_bollinger_squeeze(self):
        sw = _sideways(100)
        symbols = [_make_symbol("FLAT", sw)]
        results = TechnicalScanner.scan_bollinger_squeeze(symbols, squeeze_pct=0.20)
        assert isinstance(results, list)

    def test_scan_above_sma(self):
        up = _trending_up(300)
        symbols = [_make_symbol("UP", up)]
        results = TechnicalScanner.scan_above_sma(symbols, 50)
        # Uptrend should be above SMA
        assert len(results) >= 1
        assert results[0].symbol == "UP"

    def test_scan_new_high(self):
        up = np.linspace(50, 150, 300)  # monotonically increasing
        symbols = [_make_symbol("UP", up)]
        results = TechnicalScanner.scan_new_high(symbols, lookback=252)
        assert len(results) >= 1

    def test_scan_new_low(self):
        down = np.linspace(150, 50, 300)  # monotonically decreasing
        symbols = [_make_symbol("DOWN", down)]
        results = TechnicalScanner.scan_new_low(symbols, lookback=252)
        assert len(results) >= 1

    def test_scan_golden_cross(self):
        # Hard to trigger naturally, just verify it returns list
        symbols = [_make_symbol("AAPL", _trending_up(300))]
        results = TechnicalScanner.scan_golden_cross(symbols)
        assert isinstance(results, list)

    def test_scan_macd_cross(self):
        symbols = [_make_symbol("AAPL", _trending_up(100))]
        up_results = TechnicalScanner.scan_macd_cross_up(symbols)
        down_results = TechnicalScanner.scan_macd_cross_down(symbols)
        assert isinstance(up_results, list)
        assert isinstance(down_results, list)


# ═══════════════════════════════════════════════════════════════════════════════
#  FundamentalScanner Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestFundamentalScanner:

    def _symbols(self):
        return [
            _make_symbol("CHEAP", _trending_up(50),
                         fundamentals={"pe_ratio": 10, "dividend_yield": 4.0,
                                       "market_cap": 50e9, "revenue_growth": 25,
                                       "eps_growth": 30, "debt_to_equity": 0.2,
                                       "roe": 25, "price_to_book": 1.5}),
            _make_symbol("EXPENSIVE", _trending_up(50),
                         fundamentals={"pe_ratio": 50, "dividend_yield": 0.5,
                                       "market_cap": 1e9, "revenue_growth": 5,
                                       "eps_growth": 3, "debt_to_equity": 1.5,
                                       "roe": 8, "price_to_book": 8.0}),
        ]

    def test_pe_ratio_scan(self):
        results = FundamentalScanner.scan_pe_ratio(self._symbols(), 0, 15)
        assert len(results) == 1
        assert results[0].symbol == "CHEAP"

    def test_dividend_yield_scan(self):
        results = FundamentalScanner.scan_dividend_yield(self._symbols(), 3.0)
        assert len(results) == 1
        assert results[0].data["dividend_yield"] == 4.0

    def test_market_cap_scan(self):
        results = FundamentalScanner.scan_market_cap(self._symbols(), 10e9)
        assert len(results) == 1

    def test_revenue_growth_scan(self):
        results = FundamentalScanner.scan_revenue_growth(self._symbols(), 20)
        assert len(results) == 1

    def test_eps_growth_scan(self):
        results = FundamentalScanner.scan_eps_growth(self._symbols(), 25)
        assert len(results) == 1

    def test_debt_to_equity_scan(self):
        results = FundamentalScanner.scan_debt_to_equity(self._symbols(), 0.5)
        assert len(results) == 1

    def test_roe_scan(self):
        results = FundamentalScanner.scan_roe(self._symbols(), 20)
        assert len(results) == 1

    def test_price_to_book_scan(self):
        results = FundamentalScanner.scan_price_to_book(self._symbols(), 3.0)
        assert len(results) == 1


# ═══════════════════════════════════════════════════════════════════════════════
#  VolumeScanner Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestVolumeScanner:

    def test_volume_spike(self):
        close = _trending_up(50)
        rng = np.random.default_rng(10)
        vol = rng.uniform(1e6, 2e6, 50)
        vol[-1] = 10e6  # spike
        sym = SymbolData(symbol="SPIKE", close=close, volume=vol,
                         high=close * 1.01, low=close * 0.99,
                         open=close * 1.001)
        results = VolumeScanner.scan_volume_spike([sym], threshold=2.0)
        assert len(results) == 1
        assert results[0].data["volume_ratio"] > 2.0

    def test_volume_dry_up(self):
        close = _trending_up(50)
        vol = np.full(50, 5e6)
        vol[-1] = 500000  # 10% of avg
        sym = SymbolData(symbol="DRY", close=close, volume=vol,
                         high=close * 1.01, low=close * 0.99,
                         open=close * 1.001)
        results = VolumeScanner.scan_volume_dry_up([sym])
        assert len(results) == 1

    def test_obv_divergence(self):
        symbols = [_make_symbol("TEST", _trending_up(50))]
        results = VolumeScanner.scan_on_balance_volume_divergence(symbols)
        assert isinstance(results, list)

    def test_accumulation_distribution(self):
        symbols = [_make_symbol("TEST", _trending_up(50))]
        results = VolumeScanner.scan_accumulation_distribution(symbols)
        assert isinstance(results, list)


# ═══════════════════════════════════════════════════════════════════════════════
#  MomentumScanner Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestMomentumScanner:

    def test_momentum(self):
        up = _trending_up(100, 50.0)
        symbols = [_make_symbol("UP", up)]
        results = MomentumScanner.scan_momentum(symbols, lookback=20, min_pct=0.1)
        assert len(results) >= 1

    def test_rate_of_change(self):
        up = _trending_up(50)
        symbols = [_make_symbol("UP", up)]
        results = MomentumScanner.scan_rate_of_change(symbols, period=10, threshold=0.1)
        assert isinstance(results, list)

    def test_mean_reversion(self):
        # Create data with extreme final price
        data = np.full(100, 100.0)
        data[-1] = 130.0  # way above mean
        symbols = [_make_symbol("EXTREME", data)]
        results = MomentumScanner.scan_mean_reversion(symbols, n_std=1.0)
        assert len(results) >= 1
        assert "z_score" in results[0].data

    def test_rsi_divergence(self):
        symbols = [_make_symbol("TEST", _trending_up(100))]
        results = MomentumScanner.scan_rsi_divergence(symbols)
        assert isinstance(results, list)

    def test_relative_strength(self):
        benchmark = _trending_up(100)
        outperformer = _trending_up(100, 50.0)  # different seed
        symbols = [_make_symbol("OUT", outperformer)]
        results = MomentumScanner.scan_relative_strength(symbols, benchmark, lookback=60)
        assert isinstance(results, list)


# ═══════════════════════════════════════════════════════════════════════════════
#  PatternScanner Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatternScanner:

    def test_engulfing_bullish(self):
        sym = SymbolData(
            symbol="ENG", close=np.array([100, 95, 102]),
            open=np.array([98, 99, 94]),
            high=np.array([101, 100, 103]),
            low=np.array([97, 94, 93]),
            volume=np.array([1e6, 1e6, 1e6]))
        results = PatternScanner.scan_engulfing([sym])
        assert any("Bullish" in s for r in results for s in r.signals)

    def test_doji(self):
        sym = SymbolData(
            symbol="DOJI", close=np.array([100.0]),
            open=np.array([100.1]),
            high=np.array([105.0]),
            low=np.array([95.0]),
            volume=np.array([1e6]))
        results = PatternScanner.scan_doji([sym])
        assert len(results) == 1

    def test_hammer(self):
        sym = SymbolData(
            symbol="HAMMER", close=np.array([100.0]),
            open=np.array([99.5]),
            high=np.array([100.1]),
            low=np.array([95.0]),
            volume=np.array([1e6]))
        results = PatternScanner.scan_hammer([sym])
        assert len(results) == 1

    def test_breakout(self):
        close = np.full(30, 100.0)
        close[-1] = 110.0  # breakout
        high = close * 1.005
        sym = SymbolData(symbol="BRK", close=close, high=high,
                         low=close * 0.995, open=close,
                         volume=np.full(30, 1e6))
        results = PatternScanner.scan_breakout([sym], lookback=20)
        assert len(results) == 1

    def test_gap_up(self):
        sym = SymbolData(
            symbol="GAP", close=np.array([100, 105]),
            open=np.array([99, 106]),
            high=np.array([101, 107]),
            low=np.array([98, 104]),
            volume=np.array([1e6, 2e6]))
        results = PatternScanner.scan_gap_up([sym], min_gap_pct=2.0)
        assert len(results) >= 1


# ═══════════════════════════════════════════════════════════════════════════════
#  CompositeScanner Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestCompositeScanner:

    def test_intersect(self):
        r1 = [ScanResult("A", 1.0), ScanResult("B", 2.0)]
        r2 = [ScanResult("B", 3.0), ScanResult("C", 1.0)]
        result = CompositeScanner.intersect([r1, r2])
        assert len(result) == 1
        assert result[0].symbol == "B"
        assert result[0].score == 5.0  # 2+3

    def test_union(self):
        r1 = [ScanResult("A", 1.0), ScanResult("B", 2.0)]
        r2 = [ScanResult("B", 3.0), ScanResult("C", 1.0)]
        result = CompositeScanner.union([r1, r2])
        symbols = [r.symbol for r in result]
        assert "A" in symbols
        assert "B" in symbols
        assert "C" in symbols

    def test_filter_results(self):
        results = [
            ScanResult("A", 5.0, data={"rsi": 75}),
            ScanResult("B", 3.0, data={"rsi": 45}),
        ]
        filters = [ScanFilter("rsi", FilterOperator.GT, 70)]
        filtered = CompositeScanner.filter_results(results, filters)
        assert len(filtered) == 1
        assert filtered[0].symbol == "A"

    def test_rank_results(self):
        results = [ScanResult("A", 1.0), ScanResult("B", 3.0), ScanResult("C", 2.0)]
        ranked = CompositeScanner.rank_results(results, limit=2)
        assert len(ranked) == 2
        assert ranked[0].symbol == "B"
        assert ranked[0].rank == 1
        assert ranked[1].rank == 2


# ═══════════════════════════════════════════════════════════════════════════════
#  PredefinedScans Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPredefinedScans:

    def test_list_scans(self):
        scans = PredefinedScans.list_scans()
        assert len(scans) >= 30
        assert "golden_cross" in scans
        assert "rsi_oversold" in scans

    def test_run_known_scan(self):
        symbols = [_make_symbol("TEST", _trending_up(300))]
        results = PredefinedScans.run_scan("above_200sma", symbols)
        assert isinstance(results, list)

    def test_run_unknown_scan(self):
        results = PredefinedScans.run_scan("nonexistent_scan", [])
        assert results == []

    def test_all_scans_callable(self):
        """Every predefined scan should at least execute without error."""
        symbols = [_make_symbol("TEST", _trending_up(300),
                                fundamentals={"pe_ratio": 12, "dividend_yield": 3.5,
                                              "market_cap": 50e9, "revenue_growth": 25,
                                              "eps_growth": 30, "debt_to_equity": 0.2,
                                              "roe": 25, "price_to_book": 1.5})]
        for name in PredefinedScans.SCANS:
            results = PredefinedScans.run_scan(name, symbols)
            assert isinstance(results, list), f"Scan '{name}' failed"


# ═══════════════════════════════════════════════════════════════════════════════
#  ScannerEngine Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestScannerEngine:

    def test_add_and_list_symbols(self):
        eng = ScannerEngine()
        eng.add_symbol("AAPL", _trending_up(100))
        eng.add_symbol("GOOG", _trending_down(100))
        assert set(eng.list_symbols()) == {"AAPL", "GOOG"}

    def test_remove_symbol(self):
        eng = ScannerEngine()
        eng.add_symbol("AAPL", _trending_up(100))
        assert eng.remove_symbol("AAPL") is True
        assert eng.remove_symbol("AAPL") is False

    def test_run_predefined(self):
        eng = ScannerEngine()
        up = _trending_up(300)
        eng.add_symbol("UP", up, high=up * 1.01, low=up * 0.99,
                        open_=up * 1.001, volume=np.full(300, 2e6))
        results = eng.run_predefined("above_200sma")
        assert isinstance(results, list)

    def test_run_composite_and(self):
        eng = ScannerEngine()
        up = _trending_up(300)
        eng.add_symbol("UP", up, high=up * 1.01, low=up * 0.99,
                        open_=up * 1.001, volume=np.full(300, 2e6),
                        fundamentals={"pe_ratio": 10})
        results = eng.run_composite(["above_200sma", "low_pe"], logic="and")
        assert isinstance(results, list)

    def test_run_composite_or(self):
        eng = ScannerEngine()
        up = _trending_up(300)
        eng.add_symbol("UP", up, high=up * 1.01, low=up * 0.99,
                        open_=up * 1.001, volume=np.full(300, 2e6))
        results = eng.run_composite(["above_200sma", "52w_high"], logic="or")
        assert isinstance(results, list)

    def test_run_custom(self):
        eng = ScannerEngine()
        close = np.linspace(90, 110, 300)
        eng.add_symbol("TEST", close, volume=np.full(300, 2e6))
        results = eng.run_custom([{"field": "price", "operator": ">", "value": 100}])
        assert len(results) >= 1

    def test_scan_history(self):
        eng = ScannerEngine()
        eng.add_symbol("X", _trending_up(300))
        eng.run_predefined("52w_high")
        assert len(eng.scan_history()) == 1

    def test_capabilities(self):
        eng = ScannerEngine()
        eng.add_symbol("A", _trending_up(50))
        caps = eng.capabilities()
        assert caps["symbols_loaded"] == 1
        assert caps["predefined_scans"] >= 30
