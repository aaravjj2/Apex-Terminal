"""
Tests — Volatility Surface Engine
===================================
Black-Scholes, IV solver, historical vol, surface construction,
Greeks surface, vol regime analysis.
"""

import pytest
import math
import numpy as np
from phase1.services.volatility_surface_engine import (
    OptionType, VolModel, HistVolMethod,
    VolSurfacePoint, VolSmile, GreeksSurface,
    BlackScholesCore, IVSolver, HistoricalVolatility,
    VolSurfaceBuilder, GreeksSurfaceBuilder, VolRegimeAnalyzer,
    VolatilitySurfaceEngine,
)


# ─── VolSurfacePoint Tests ──────────────────────────────────────────────────

class TestVolSurfacePoint:
    def test_to_dict(self):
        p = VolSurfacePoint(100.0, 0.25, 0.20, OptionType.CALL, 1.0, 0.5)
        d = p.to_dict()
        assert d["strike"] == 100.0
        assert d["implied_vol"] == 0.2
        assert d["option_type"] == "call"

    def test_defaults(self):
        p = VolSurfacePoint(105.0, 0.5, 0.25)
        assert p.option_type == OptionType.CALL
        assert p.moneyness == 0.0


# ─── VolSmile Tests ──────────────────────────────────────────────────────────

class TestVolSmile:
    def test_to_dict(self):
        s = VolSmile(0.25, [90, 100, 110], [0.22, 0.20, 0.21], 0.20, 0.02, 0.005)
        d = s.to_dict()
        assert d["expiry_years"] == 0.25
        assert len(d["strikes"]) == 3
        assert d["atm_vol"] == 0.2

    def test_empty(self):
        s = VolSmile(0.5, [], [])
        d = s.to_dict()
        assert d["strikes"] == []


# ─── BlackScholesCore Tests ─────────────────────────────────────────────────

class TestBlackScholesCore:
    def test_call_price(self):
        # S=100, K=100, r=5%, T=1yr, sigma=20%
        price = BlackScholesCore.price(100, 100, 0.05, 1.0, 0.20, OptionType.CALL)
        assert 8 < price < 12  # Known approximate range

    def test_put_price(self):
        price = BlackScholesCore.price(100, 100, 0.05, 1.0, 0.20, OptionType.PUT)
        assert 4 < price < 8

    def test_put_call_parity(self):
        S, K, r, T, sigma = 100, 100, 0.05, 1.0, 0.20
        call = BlackScholesCore.price(S, K, r, T, sigma, OptionType.CALL)
        put = BlackScholesCore.price(S, K, r, T, sigma, OptionType.PUT)
        # parity: C - P = S - K*exp(-rT)
        lhs = call - put
        rhs = S - K * math.exp(-r * T)
        assert abs(lhs - rhs) < 0.01

    def test_deep_itm_call(self):
        price = BlackScholesCore.price(200, 100, 0.05, 1.0, 0.20, OptionType.CALL)
        assert price > 95  # At least intrinsic value

    def test_deep_otm_call(self):
        price = BlackScholesCore.price(50, 100, 0.05, 1.0, 0.20, OptionType.CALL)
        assert price < 1

    def test_expired_option(self):
        call = BlackScholesCore.price(105, 100, 0.05, 0, 0.20, OptionType.CALL)
        assert call == 5  # Intrinsic

    def test_delta_call(self):
        delta = BlackScholesCore.delta(100, 100, 0.05, 1.0, 0.20, OptionType.CALL)
        assert 0.5 < delta < 0.7  # ATM call delta ~0.55

    def test_delta_put(self):
        delta = BlackScholesCore.delta(100, 100, 0.05, 1.0, 0.20, OptionType.PUT)
        assert -0.2 > delta > -0.8  # ATM put delta

    def test_gamma(self):
        gamma = BlackScholesCore.gamma(100, 100, 0.05, 1.0, 0.20)
        assert gamma > 0

    def test_vega(self):
        vega = BlackScholesCore.vega(100, 100, 0.05, 1.0, 0.20)
        assert vega > 0

    def test_theta_call(self):
        theta = BlackScholesCore.theta(100, 100, 0.05, 1.0, 0.20, OptionType.CALL)
        assert theta < 0  # Time decay is negative

    def test_d1_edge_cases(self):
        assert BlackScholesCore.d1(100, 100, 0.05, 0, 0.20) == 0.0
        assert BlackScholesCore.d1(100, 100, 0.05, 1.0, 0) == 0.0


# ─── IVSolver Tests ─────────────────────────────────────────────────────────

class TestIVSolver:
    def test_newton_raphson(self):
        # Price a known option, then recover IV
        true_vol = 0.25
        price = BlackScholesCore.price(100, 100, 0.05, 1.0, true_vol)
        iv = IVSolver.newton_raphson(price, 100, 100, 0.05, 1.0)
        assert abs(iv - true_vol) < 0.01

    def test_bisection(self):
        true_vol = 0.30
        price = BlackScholesCore.price(100, 100, 0.05, 0.5, true_vol)
        iv = IVSolver.bisection(price, 100, 100, 0.05, 0.5)
        assert abs(iv - true_vol) < 0.01

    def test_solve_with_fallback(self):
        true_vol = 0.20
        price = BlackScholesCore.price(100, 100, 0.05, 1.0, true_vol, OptionType.PUT)
        iv = IVSolver.solve(price, 100, 100, 0.05, 1.0, OptionType.PUT)
        assert abs(iv - true_vol) < 0.05

    def test_zero_price(self):
        assert IVSolver.newton_raphson(0, 100, 100, 0.05, 1.0) == 0.0
        assert IVSolver.bisection(0, 100, 100, 0.05, 1.0) == 0.0

    def test_itm_option(self):
        price = BlackScholesCore.price(110, 100, 0.05, 0.5, 0.25, OptionType.CALL)
        iv = IVSolver.solve(price, 110, 100, 0.05, 0.5, OptionType.CALL)
        assert abs(iv - 0.25) < 0.05

    def test_otm_put(self):
        price = BlackScholesCore.price(100, 90, 0.05, 0.25, 0.30, OptionType.PUT)
        iv = IVSolver.solve(price, 100, 90, 0.05, 0.25, OptionType.PUT)
        assert abs(iv - 0.30) < 0.05


# ─── HistoricalVolatility Tests ──────────────────────────────────────────────

class TestHistoricalVolatility:
    def setup_method(self):
        np.random.seed(42)
        self.prices = [100.0]
        for _ in range(99):
            self.prices.append(self.prices[-1] * (1 + np.random.normal(0, 0.01)))
        self.highs = [p * 1.01 for p in self.prices]
        self.lows = [p * 0.99 for p in self.prices]
        self.opens = [p * (1 + np.random.normal(0, 0.002)) for p in self.prices]

    def test_close_to_close(self):
        result = HistoricalVolatility.close_to_close(self.prices, 20)
        assert len(result) > 0
        assert all(v >= 0 for v in result)

    def test_parkinson(self):
        result = HistoricalVolatility.parkinson(self.highs, self.lows, 20)
        assert len(result) > 0
        assert all(v >= 0 for v in result)

    def test_garman_klass(self):
        result = HistoricalVolatility.garman_klass(
            self.opens, self.highs, self.lows, self.prices, 20)
        assert len(result) > 0

    def test_yang_zhang(self):
        result = HistoricalVolatility.yang_zhang(
            self.opens, self.highs, self.lows, self.prices, 20)
        assert len(result) > 0

    def test_short_series(self):
        assert HistoricalVolatility.close_to_close([100, 101], 20) == []
        assert HistoricalVolatility.parkinson([101, 102], [99, 100], 20) == []

    def test_vol_magnitude(self):
        # With 1% daily moves, annualized should be ~16%
        result = HistoricalVolatility.close_to_close(self.prices, 20)
        assert 0.05 < result[-1] < 0.50


# ─── VolSurfaceBuilder Tests ────────────────────────────────────────────────

class TestVolSurfaceBuilder:
    def test_build_surface(self):
        options = [
            {"strike": 95, "expiry_years": 0.25, "market_price": 7.0, "option_type": "call"},
            {"strike": 100, "expiry_years": 0.25, "market_price": 4.0, "option_type": "call"},
            {"strike": 105, "expiry_years": 0.25, "market_price": 2.0, "option_type": "call"},
        ]
        points = VolSurfaceBuilder.build_surface(100, options, 0.05)
        assert len(points) == 3
        assert all(p.implied_vol > 0 for p in points)

    def test_extract_smile(self):
        points = [
            VolSurfacePoint(90, 0.25, 0.22, moneyness=0.9),
            VolSurfacePoint(100, 0.25, 0.20, moneyness=1.0),
            VolSurfacePoint(110, 0.25, 0.21, moneyness=1.1),
        ]
        smile = VolSurfaceBuilder.extract_smile(points, 0.25)
        assert len(smile.strikes) == 3
        assert smile.atm_vol == 0.20

    def test_extract_smile_empty(self):
        smile = VolSurfaceBuilder.extract_smile([], 0.25)
        assert smile.strikes == []

    def test_atm_term_structure(self):
        points = [
            VolSurfacePoint(100, 0.25, 0.22, moneyness=1.0),
            VolSurfacePoint(100, 0.50, 0.20, moneyness=1.0),
            VolSurfacePoint(100, 1.00, 0.18, moneyness=1.0),
        ]
        ts = VolSurfaceBuilder.atm_term_structure(points)
        assert len(ts) == 3
        assert ts[0][0] == 0.25

    def test_interpolate(self):
        points = [
            VolSurfacePoint(90, 0.25, 0.25),
            VolSurfacePoint(110, 0.25, 0.20),
            VolSurfacePoint(90, 0.50, 0.23),
            VolSurfacePoint(110, 0.50, 0.18),
        ]
        vol = VolSurfaceBuilder.interpolate(points, 100, 0.375)
        assert 0.15 < vol < 0.30

    def test_interpolate_empty(self):
        assert VolSurfaceBuilder.interpolate([], 100, 0.25) == 0.0


# ─── VolRegimeAnalyzer Tests ────────────────────────────────────────────────

class TestVolRegimeAnalyzer:
    def test_vol_of_vol(self):
        np.random.seed(42)
        vol_series = np.random.uniform(0.15, 0.25, 50).tolist()
        result = VolRegimeAnalyzer.vol_of_vol(vol_series, 20)
        assert len(result) == 31

    def test_vol_regime_high(self):
        series = list(np.linspace(0.1, 0.5, 252))
        assert VolRegimeAnalyzer.vol_regime(series) == "high_vol"

    def test_vol_regime_low(self):
        series = list(np.linspace(0.5, 0.1, 252))
        assert VolRegimeAnalyzer.vol_regime(series) == "low_vol"

    def test_vol_regime_insufficient(self):
        assert VolRegimeAnalyzer.vol_regime([0.2] * 10) == "insufficient_data"

    def test_realized_vs_implied(self):
        rv = [0.15, 0.16, 0.14, 0.17]
        iv = [0.20, 0.22, 0.19, 0.21]
        result = VolRegimeAnalyzer.realized_vs_implied(rv, iv)
        assert result["avg_spread"] > 0
        assert result["pct_iv_above_rv"] == 100.0

    def test_rv_iv_empty(self):
        result = VolRegimeAnalyzer.realized_vs_implied([], [])
        assert result["avg_spread"] == 0.0


# ─── VolatilitySurfaceEngine Tests ───────────────────────────────────────────

class TestVolatilitySurfaceEngine:
    def setup_method(self):
        self.engine = VolatilitySurfaceEngine()

    def test_bs_price(self):
        price = self.engine.bs_price(100, 100, 0.05, 1.0, 0.20)
        assert price > 0

    def test_bs_greeks(self):
        greeks = self.engine.bs_greeks(100, 100, 0.05, 1.0, 0.20)
        assert "delta" in greeks
        assert "gamma" in greeks
        assert "vega" in greeks
        assert "theta" in greeks
        assert 0 < greeks["delta"] < 1

    def test_solve_iv(self):
        price = BlackScholesCore.price(100, 100, 0.05, 1.0, 0.25)
        iv = self.engine.solve_iv(price, 100, 100, 0.05, 1.0)
        assert abs(iv - 0.25) < 0.05

    def test_build_surface(self):
        options = [
            {"strike": 95, "expiry_years": 0.25, "market_price": 7.0, "option_type": "call"},
            {"strike": 100, "expiry_years": 0.25, "market_price": 4.0, "option_type": "call"},
        ]
        result = self.engine.build_surface(100, options)
        assert len(result) == 2

    def test_historical_vol(self):
        np.random.seed(42)
        prices = [100.0]
        for _ in range(49):
            prices.append(prices[-1] * (1 + np.random.normal(0, 0.01)))
        result = self.engine.historical_vol(prices, "close_to_close", 20)
        assert len(result) > 0

    def test_historical_vol_ohlc(self):
        np.random.seed(42)
        n = 50
        closes = [100.0]
        for _ in range(n - 1):
            closes.append(closes[-1] * (1 + np.random.normal(0, 0.01)))
        opens = [c * (1 + np.random.normal(0, 0.002)) for c in closes]
        highs = [max(o, c) * 1.005 for o, c in zip(opens, closes)]
        lows = [min(o, c) * 0.995 for o, c in zip(opens, closes)]

        for method in ["parkinson", "garman_klass", "yang_zhang"]:
            result = self.engine.historical_vol_ohlc(opens, highs, lows, closes, method, 20)
            assert len(result) > 0, f"Failed for {method}"

    def test_vol_of_vol(self):
        vol_series = [0.2 + 0.01 * i for i in range(30)]
        result = self.engine.vol_of_vol(vol_series, 10)
        assert len(result) > 0

    def test_vol_regime(self):
        series = list(np.linspace(0.1, 0.5, 252))
        assert self.engine.vol_regime(series) in ["high_vol", "low_vol", "above_average", "below_average"]

    def test_realized_vs_implied(self):
        result = self.engine.realized_vs_implied([0.15, 0.16], [0.20, 0.22])
        assert result["avg_spread"] > 0

    def test_capabilities(self):
        caps = self.engine.capabilities()
        assert caps["engine"] == "VolatilitySurfaceEngine"
        assert len(caps["features"]) >= 10

    def test_put_call_greeks(self):
        call_greeks = self.engine.bs_greeks(100, 100, 0.05, 1.0, 0.20, "call")
        put_greeks = self.engine.bs_greeks(100, 100, 0.05, 1.0, 0.20, "put")
        assert call_greeks["delta"] > 0
        assert put_greeks["delta"] < 0
        # Gamma/vega same for call/put
        assert abs(call_greeks["gamma"] - put_greeks["gamma"]) < 0.001
        assert abs(call_greeks["vega"] - put_greeks["vega"]) < 0.001
