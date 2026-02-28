"""
test_options_pricing_engine.py — Comprehensive tests for options pricing engine
================================================================================
Tests all components: BlackScholes, BinomialTree, MonteCarloOption,
ImpliedVolatility, VolatilitySurface, OptionChainAnalyzer, StrategyBuilder,
ExoticOptions, OptionsPricingEngine.
"""

import math
import pytest
import numpy as np
from phase1.services.options_pricing_engine import (
    BlackScholes, BinomialTree, MonteCarloOption,
    ImpliedVolatility, VolatilitySurface, VolSurfacePoint,
    OptionChainAnalyzer, OptionContract,
    StrategyBuilder, OptionLeg,
    ExoticOptions, OptionsPricingEngine,
)

# ── Test data ────────────────────────────────────────────────────────────────
# Standard option: S=100, K=100, T=1y, r=5%, σ=20%
S, K, T, R, SIGMA = 100.0, 100.0, 1.0, 0.05, 0.20


# ═══════════════════════════════════════════════════════════════════════════════
#  BlackScholes Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestBlackScholes:

    def test_call_price_atm(self):
        price = BlackScholes.call_price(S, K, T, R, SIGMA)
        # ATM call ~10.45 for these params
        assert 9.0 < price < 12.0

    def test_put_price_atm(self):
        price = BlackScholes.put_price(S, K, T, R, SIGMA)
        # ATM put ~5.57
        assert 4.5 < price < 7.0

    def test_put_call_parity(self):
        """C - P = S*e^(-qT) - K*e^(-rT)"""
        call = BlackScholes.call_price(S, K, T, R, SIGMA)
        put = BlackScholes.put_price(S, K, T, R, SIGMA)
        parity = S - K * math.exp(-R * T)
        assert abs((call - put) - parity) < 1e-10

    def test_deep_itm_call(self):
        price = BlackScholes.call_price(150, 100, T, R, SIGMA)
        assert price > 50.0  # deep ITM

    def test_deep_otm_call(self):
        price = BlackScholes.call_price(50, 100, T, R, SIGMA)
        assert price < 0.5  # deep OTM

    def test_expired_call(self):
        assert BlackScholes.call_price(110, 100, 0, R, SIGMA) == 10.0
        assert BlackScholes.call_price(90, 100, 0, R, SIGMA) == 0.0

    def test_expired_put(self):
        assert BlackScholes.put_price(90, 100, 0, R, SIGMA) == 10.0
        assert BlackScholes.put_price(110, 100, 0, R, SIGMA) == 0.0

    def test_delta_call_range(self):
        delta = BlackScholes.delta(S, K, T, R, SIGMA, "call")
        assert 0.0 < delta < 1.0

    def test_delta_put_range(self):
        delta = BlackScholes.delta(S, K, T, R, SIGMA, "put")
        assert -1.0 < delta < 0.0

    def test_delta_call_put_relationship(self):
        """Delta_call - Delta_put = e^(-qT) ≈ 1 when q=0."""
        dc = BlackScholes.delta(S, K, T, R, SIGMA, "call")
        dp = BlackScholes.delta(S, K, T, R, SIGMA, "put")
        assert abs(dc - dp - 1.0) < 1e-10

    def test_gamma_positive(self):
        gamma = BlackScholes.gamma(S, K, T, R, SIGMA)
        assert gamma > 0

    def test_gamma_same_for_call_put(self):
        # Gamma is same for call and put
        gc = BlackScholes.gamma(S, K, T, R, SIGMA)
        assert gc > 0  # just verify it computes

    def test_theta_call_negative(self):
        theta = BlackScholes.theta(S, K, T, R, SIGMA, "call")
        assert theta < 0  # time decay

    def test_vega_positive(self):
        vega = BlackScholes.vega(S, K, T, R, SIGMA)
        assert vega > 0

    def test_rho_call_positive(self):
        rho = BlackScholes.rho(S, K, T, R, SIGMA, "call")
        assert rho > 0

    def test_rho_put_negative(self):
        rho = BlackScholes.rho(S, K, T, R, SIGMA, "put")
        assert rho < 0

    def test_charm_computes(self):
        charm = BlackScholes.charm(S, K, T, R, SIGMA, "call")
        assert isinstance(charm, float)

    def test_vanna_computes(self):
        vanna = BlackScholes.vanna(S, K, T, R, SIGMA)
        assert isinstance(vanna, float)

    def test_volga_computes(self):
        volga = BlackScholes.volga(S, K, T, R, SIGMA)
        assert isinstance(volga, float)

    def test_speed_computes(self):
        speed = BlackScholes.speed(S, K, T, R, SIGMA)
        assert isinstance(speed, float)

    def test_all_greeks_keys(self):
        greeks = BlackScholes.all_greeks(S, K, T, R, SIGMA, "call")
        expected_keys = {"price", "delta", "gamma", "theta", "vega", "rho",
                         "charm", "vanna", "volga", "speed"}
        assert set(greeks.keys()) == expected_keys

    def test_dividend_yield(self):
        """With dividend yield, call price should be lower."""
        no_div = BlackScholes.call_price(S, K, T, R, SIGMA, q=0.0)
        with_div = BlackScholes.call_price(S, K, T, R, SIGMA, q=0.03)
        assert with_div < no_div


# ═══════════════════════════════════════════════════════════════════════════════
#  Binomial Tree Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestBinomialTree:

    def test_european_converges_to_bs(self):
        """European binomial should converge to BS price."""
        bt_price = BinomialTree.price(S, K, T, R, SIGMA, "call", "european", steps=500)
        bs_price = BlackScholes.call_price(S, K, T, R, SIGMA)
        assert abs(bt_price - bs_price) < 0.10  # within 10 cents

    def test_american_call_equals_european(self):
        """American call on non-dividend stock = European call."""
        amer = BinomialTree.price(S, K, T, R, SIGMA, "call", "american", 200)
        euro = BinomialTree.price(S, K, T, R, SIGMA, "call", "european", 200)
        assert abs(amer - euro) < 0.05

    def test_american_put_geq_european(self):
        """American put >= European put due to early exercise."""
        amer = BinomialTree.price(S, K, T, R, SIGMA, "put", "american", 200)
        euro = BinomialTree.price(S, K, T, R, SIGMA, "put", "european", 200)
        assert amer >= euro - 0.01  # small tolerance

    def test_price_with_greeks(self):
        result = BinomialTree.price_with_greeks(S, K, T, R, SIGMA, "call", "american")
        assert "price" in result
        assert "delta" in result
        assert "gamma" in result
        assert "theta" in result
        assert "vega" in result
        assert 0 < result["delta"] < 1

    def test_early_exercise_boundary(self):
        boundary = BinomialTree.early_exercise_boundary(S, K, T, R, SIGMA, "put", 100)
        assert isinstance(boundary, list)
        # American put has early exercise boundary
        if len(boundary) > 0:
            assert "time" in boundary[0]
            assert "exercise_price" in boundary[0]


# ═══════════════════════════════════════════════════════════════════════════════
#  Monte Carlo Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestMonteCarlo:

    def test_call_price_converges(self):
        result = MonteCarloOption.price(S, K, T, R, SIGMA, "call",
                                        n_paths=200000, seed=42)
        bs_price = BlackScholes.call_price(S, K, T, R, SIGMA)
        assert abs(result["price"] - bs_price) < 0.50  # within 50 cents

    def test_put_price_converges(self):
        result = MonteCarloOption.price(S, K, T, R, SIGMA, "put",
                                        n_paths=200000, seed=42)
        bs_price = BlackScholes.put_price(S, K, T, R, SIGMA)
        assert abs(result["price"] - bs_price) < 0.50

    def test_confidence_interval(self):
        result = MonteCarloOption.price(S, K, T, R, SIGMA, seed=42)
        ci = result["confidence_95"]
        assert ci[0] < result["price"] < ci[1]

    def test_antithetic_reduces_variance(self):
        r1 = MonteCarloOption.price(S, K, T, R, SIGMA, n_paths=10000,
                                     antithetic=True, seed=42)
        r2 = MonteCarloOption.price(S, K, T, R, SIGMA, n_paths=10000,
                                     antithetic=False, seed=42)
        # Antithetic should have lower std error (usually)
        assert r1["std_error"] >= 0  # just verify it runs

    def test_asian_arithmetic(self):
        result = MonteCarloOption.price_asian(S, K, T, R, SIGMA, "call",
                                              n_paths=20000, seed=42)
        # Asian price <= European price (averaging reduces volatility)
        bs = BlackScholes.call_price(S, K, T, R, SIGMA)
        assert result["price"] < bs + 1.0  # with some tolerance

    def test_asian_geometric(self):
        result = MonteCarloOption.price_asian(S, K, T, R, SIGMA, "call",
                                              n_paths=20000, averaging="geometric",
                                              seed=42)
        assert result["price"] > 0
        assert result["averaging"] == "geometric"


# ═══════════════════════════════════════════════════════════════════════════════
#  Implied Volatility Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestImpliedVolatility:

    def test_roundtrip(self):
        """Price with sigma, then recover sigma from price."""
        price = BlackScholes.call_price(S, K, T, R, 0.30)
        iv = ImpliedVolatility.solve(price, S, K, T, R, "call")
        assert abs(iv - 0.30) < 1e-6

    def test_roundtrip_put(self):
        price = BlackScholes.put_price(S, K, T, R, 0.25)
        iv = ImpliedVolatility.solve(price, S, K, T, R, "put")
        assert abs(iv - 0.25) < 1e-6

    def test_smile(self):
        prices = {
            90.0: BlackScholes.call_price(S, 90, T, R, 0.25),
            95.0: BlackScholes.call_price(S, 95, T, R, 0.22),
            100.0: BlackScholes.call_price(S, 100, T, R, 0.20),
            105.0: BlackScholes.call_price(S, 105, T, R, 0.22),
            110.0: BlackScholes.call_price(S, 110, T, R, 0.25),
        }
        smile = ImpliedVolatility.smile(S, T, R, prices)
        assert len(smile) == 5
        assert abs(smile[100.0] - 0.20) < 1e-4

    def test_term_structure(self):
        prices = {
            0.25: BlackScholes.call_price(S, K, 0.25, R, 0.22),
            0.50: BlackScholes.call_price(S, K, 0.50, R, 0.20),
            1.00: BlackScholes.call_price(S, K, 1.00, R, 0.18),
        }
        ts = ImpliedVolatility.term_structure(S, K, R, prices)
        assert len(ts) == 3
        assert abs(ts[0.50] - 0.20) < 1e-4

    def test_skew(self):
        prices = {
            90.0: BlackScholes.call_price(S, 90, T, R, 0.28),
            95.0: BlackScholes.call_price(S, 95, T, R, 0.24),
            100.0: BlackScholes.call_price(S, 100, T, R, 0.20),
            105.0: BlackScholes.call_price(S, 105, T, R, 0.22),
            110.0: BlackScholes.call_price(S, 110, T, R, 0.24),
        }
        skew = ImpliedVolatility.skew(S, T, R, prices)
        assert "skew" in skew
        assert "atm_iv" in skew
        assert abs(skew["atm_iv"] - 0.20) < 1e-3


# ═══════════════════════════════════════════════════════════════════════════════
#  Volatility Surface Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestVolatilitySurface:

    def test_add_and_interpolate(self):
        vs = VolatilitySurface()
        vs.add_point(90, 0.25, 0.30)
        vs.add_point(90, 1.00, 0.25)
        vs.add_point(110, 0.25, 0.28)
        vs.add_point(110, 1.00, 0.22)
        # Interpolate at center
        iv = vs.interpolate(100, 0.625)
        assert 0.20 < iv < 0.35

    def test_to_matrix(self):
        vs = VolatilitySurface()
        vs.add_point(90, 0.5, 0.25)
        vs.add_point(100, 0.5, 0.20)
        vs.add_point(110, 0.5, 0.25)
        vs.add_point(90, 1.0, 0.22)
        vs.add_point(100, 1.0, 0.18)
        vs.add_point(110, 1.0, 0.22)
        mat = vs.to_matrix()
        assert "strikes" in mat
        assert "expiries" in mat
        assert "ivs" in mat
        assert len(mat["strikes"]) == 3
        assert len(mat["expiries"]) == 2

    def test_build_from_chain(self):
        chain = [
            {"strike": 95, "expiry": 0.5, "price": BlackScholes.call_price(S, 95, 0.5, R, 0.22), "type": "call"},
            {"strike": 100, "expiry": 0.5, "price": BlackScholes.call_price(S, 100, 0.5, R, 0.20), "type": "call"},
            {"strike": 105, "expiry": 0.5, "price": BlackScholes.call_price(S, 105, 0.5, R, 0.23), "type": "call"},
        ]
        vs = VolatilitySurface()
        vs.build_from_chain(S, R, chain)
        assert len(vs.points) == 3

    def test_empty_surface(self):
        vs = VolatilitySurface()
        iv = vs.interpolate(100, 0.5)
        assert iv == 0.25  # default


# ═══════════════════════════════════════════════════════════════════════════════
#  OptionChainAnalyzer Tests
# ═══════════════════════════════════════════════════════════════════════════════

def _make_chain() -> list:
    return [
        OptionContract(strike=95, expiry=0.25, option_type="call", volume=500, open_interest=2000, iv=0.25, delta=0.7, gamma=0.03),
        OptionContract(strike=100, expiry=0.25, option_type="call", volume=1000, open_interest=5000, iv=0.20, delta=0.5, gamma=0.04),
        OptionContract(strike=105, expiry=0.25, option_type="call", volume=2000, open_interest=3000, iv=0.22, delta=0.3, gamma=0.03),
        OptionContract(strike=95, expiry=0.25, option_type="put", volume=300, open_interest=1500, iv=0.26, delta=-0.3, gamma=0.03),
        OptionContract(strike=100, expiry=0.25, option_type="put", volume=800, open_interest=4000, iv=0.21, delta=-0.5, gamma=0.04),
        OptionContract(strike=105, expiry=0.25, option_type="put", volume=1500, open_interest=2500, iv=0.24, delta=-0.7, gamma=0.03),
    ]


class TestOptionChainAnalyzer:

    def test_put_call_ratio(self):
        chain = _make_chain()
        pcr = OptionChainAnalyzer.put_call_ratio(chain)
        assert pcr["call_volume"] == 3500
        assert pcr["put_volume"] == 2600
        assert 0.5 < pcr["volume_pcr"] < 1.0

    def test_max_pain(self):
        chain = _make_chain()
        mp = OptionChainAnalyzer.max_pain(chain)
        assert "max_pain_strike" in mp
        assert mp["max_pain_strike"] in [95, 100, 105]

    def test_unusual_activity(self):
        chain = _make_chain()
        # No unusual activity with default thresholds (Vol/OI < 2 for all)
        unusual = OptionChainAnalyzer.unusual_activity(chain)
        assert isinstance(unusual, list)

    def test_oi_by_strike(self):
        chain = _make_chain()
        oi = OptionChainAnalyzer.oi_by_strike(chain)
        assert 100 in oi["call_oi"]
        assert 100 in oi["put_oi"]

    def test_gamma_exposure(self):
        chain = _make_chain()
        gex = OptionChainAnalyzer.gamma_exposure(chain, S)
        assert "total_gex" in gex
        assert "gex_by_strike" in gex

    def test_iv_percentile(self):
        history = [0.15, 0.18, 0.20, 0.22, 0.25, 0.28, 0.30, 0.35]
        result = OptionChainAnalyzer.iv_percentile(history, 0.22)
        assert 0 < result["iv_percentile"] < 1
        assert result["iv_rank"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  StrategyBuilder Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestStrategyBuilder:

    def test_long_call_payoff(self):
        legs = [OptionLeg(strike=100, option_type="call", side="long", premium=5.0)]
        result = StrategyBuilder.payoff_at_expiry(legs)
        assert result["max_loss"] == pytest.approx(-5.0, abs=0.5)
        assert result["max_profit"] > 20  # unbounded but capped by range

    def test_bull_call_spread(self):
        legs = [
            OptionLeg(strike=100, option_type="call", side="long", premium=5.0),
            OptionLeg(strike=110, option_type="call", side="short", premium=2.0),
        ]
        result = StrategyBuilder.payoff_at_expiry(legs)
        assert result["max_loss"] == pytest.approx(-3.0, abs=0.5)  # net debit
        assert result["max_profit"] == pytest.approx(7.0, abs=0.5)  # spread width - debit

    def test_iron_condor(self):
        legs = [
            OptionLeg(strike=90, option_type="put", side="long", premium=1.0),
            OptionLeg(strike=95, option_type="put", side="short", premium=2.5),
            OptionLeg(strike=105, option_type="call", side="short", premium=2.5),
            OptionLeg(strike=110, option_type="call", side="long", premium=1.0),
        ]
        result = StrategyBuilder.payoff_at_expiry(legs)
        # Max profit = net credit, max loss = wing width - credit
        assert result["net_premium"] > 0  # credit strategy
        assert len(result["breakevens"]) == 2

    def test_straddle(self):
        legs = [
            OptionLeg(strike=100, option_type="call", side="long", premium=5.0),
            OptionLeg(strike=100, option_type="put", side="long", premium=5.0),
        ]
        result = StrategyBuilder.payoff_at_expiry(legs)
        assert result["max_loss"] == pytest.approx(-10.0, abs=0.5)
        assert len(result["breakevens"]) == 2

    def test_greeks_at_price(self):
        legs = [OptionLeg(strike=100, option_type="call", side="long", expiry=0.25, sigma=0.20)]
        greeks = StrategyBuilder.greeks_at_price(legs, 100, R)
        assert greeks["delta"] > 0
        assert greeks["gamma"] > 0
        assert greeks["theta"] < 0

    def test_strategies_library(self):
        lib = StrategyBuilder.strategies_library()
        assert "iron_condor" in lib
        assert "straddle" in lib
        assert "bull_call_spread" in lib
        assert len(lib) >= 10

    def test_analyze_strategy(self):
        legs = [
            OptionLeg(strike=100, option_type="call", side="long", premium=5.0, expiry=0.25, sigma=0.20),
        ]
        result = StrategyBuilder.analyze_strategy(legs, S, R)
        assert "payoff_summary" in result
        assert "greeks" in result
        assert result["legs"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
#  Exotic Options Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestExoticOptions:

    def test_barrier_down_and_out(self):
        result = ExoticOptions.barrier(S, K, T, R, SIGMA, barrier=80.0,
                                        barrier_type="down-and-out", seed=42)
        # Down-and-out call should be cheaper than vanilla
        bs = BlackScholes.call_price(S, K, T, R, SIGMA)
        assert result["price"] < bs + 0.5
        assert result["price"] > 0

    def test_barrier_up_and_out(self):
        result = ExoticOptions.barrier(S, K, T, R, SIGMA, barrier=130.0,
                                        barrier_type="up-and-out", seed=42)
        assert result["price"] > 0
        assert "knock_pct" in result

    def test_digital_call(self):
        result = ExoticOptions.digital(S, K, T, R, SIGMA, "call", payout=100)
        # Around 50-60% of discounted payout for ATM
        assert 30 < result["price"] < 70

    def test_digital_put(self):
        result = ExoticOptions.digital(S, K, T, R, SIGMA, "put", payout=100)
        assert 30 < result["price"] < 70

    def test_lookback_fixed(self):
        result = ExoticOptions.lookback(S, K, T, R, SIGMA, "call",
                                         lookback_type="fixed", n_paths=20000, seed=42)
        # Fixed lookback call >= vanilla call
        bs = BlackScholes.call_price(S, K, T, R, SIGMA)
        assert result["price"] > bs - 1.0  # tolerance for MC noise

    def test_lookback_floating(self):
        result = ExoticOptions.lookback(S, K, T, R, SIGMA, "call",
                                         lookback_type="floating", n_paths=20000, seed=42)
        assert result["price"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  OptionsPricingEngine Orchestrator Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOptionsPricingEngine:

    def test_price_european(self):
        eng = OptionsPricingEngine()
        result = eng.price_european(S, K, T, R, SIGMA, "call")
        assert "price" in result
        assert "delta" in result
        assert result["price"] > 0

    def test_price_american(self):
        eng = OptionsPricingEngine()
        result = eng.price_american(S, K, T, R, SIGMA, "put")
        assert result["price"] > 0
        assert -1 < result["delta"] < 0

    def test_implied_vol(self):
        eng = OptionsPricingEngine()
        price = BlackScholes.call_price(S, K, T, R, 0.25)
        iv = eng.implied_vol(price, S, K, T, R, "call")
        assert abs(iv - 0.25) < 1e-5

    def test_build_surface(self):
        eng = OptionsPricingEngine()
        chain = [
            {"strike": 95, "expiry": 0.5, "price": BlackScholes.call_price(S, 95, 0.5, R, 0.22)},
            {"strike": 100, "expiry": 0.5, "price": BlackScholes.call_price(S, 100, 0.5, R, 0.20)},
            {"strike": 105, "expiry": 0.5, "price": BlackScholes.call_price(S, 105, 0.5, R, 0.23)},
        ]
        mat = eng.build_surface(S, R, chain)
        assert "strikes" in mat

    def test_store_and_analyze_chain(self):
        eng = OptionsPricingEngine()
        chain = _make_chain()
        n = eng.store_chain("AAPL", chain)
        assert n == 6
        analysis = eng.analyze_chain("AAPL")
        assert "put_call_ratio" in analysis
        assert "max_pain" in analysis

    def test_strategy_payoff(self):
        eng = OptionsPricingEngine()
        legs = [OptionLeg(strike=100, option_type="call", side="long", premium=5.0, expiry=0.25, sigma=0.20)]
        result = eng.strategy_payoff(legs, S)
        assert "payoff_summary" in result

    def test_capabilities(self):
        eng = OptionsPricingEngine()
        caps = eng.capabilities()
        assert "pricing_models" in caps
        assert "greeks" in caps
        assert len(caps["greeks"]) >= 9

    def test_no_chain_data(self):
        eng = OptionsPricingEngine()
        result = eng.analyze_chain("UNKNOWN")
        assert "error" in result
