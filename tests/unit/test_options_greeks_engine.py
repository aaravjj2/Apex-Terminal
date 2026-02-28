"""
test_options_greeks_engine.py
Comprehensive unit tests for the Black-Scholes options pricing engine,
IV solver, volatility surface, option chains, and spread pricing.
"""

import pytest
import math
from typing import Dict, List


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def bs_engine():
    try:
        from phase1.services.options_greeks_engine import BlackScholesEngine
        return BlackScholesEngine()
    except ImportError:
        from services.options_greeks_engine import BlackScholesEngine
        return BlackScholesEngine()


@pytest.fixture
def iv_solver():
    try:
        from phase1.services.options_greeks_engine import IVSolver
        return IVSolver()
    except ImportError:
        from services.options_greeks_engine import IVSolver
        return IVSolver()


@pytest.fixture
def vol_surface_engine():
    try:
        from phase1.services.options_greeks_engine import VolatilitySurfaceEngine
        return VolatilitySurfaceEngine()
    except ImportError:
        from services.options_greeks_engine import VolatilitySurfaceEngine
        return VolatilitySurfaceEngine()


@pytest.fixture
def chain_builder():
    try:
        from phase1.services.options_greeks_engine import OptionChainBuilder
        return OptionChainBuilder()
    except ImportError:
        from services.options_greeks_engine import OptionChainBuilder
        return OptionChainBuilder()


@pytest.fixture
def spread_engine():
    try:
        from phase1.services.options_greeks_engine import SpreadEngine
        return SpreadEngine()
    except ImportError:
        from services.options_greeks_engine import SpreadEngine
        return SpreadEngine()


@pytest.fixture
def option_params():
    try:
        from phase1.services.options_greeks_engine import OptionParams
        return OptionParams
    except ImportError:
        from services.options_greeks_engine import OptionParams
        return OptionParams


@pytest.fixture
def atm_call(option_params):
    """ATM Call: S=100, K=100, T=1yr, r=5%, sigma=20%."""
    return option_params(S=100, K=100, T=1.0, r=0.05, sigma=0.20, q=0.0, option_type='call')


@pytest.fixture
def atm_put(option_params):
    """ATM Put: same as atm_call but put."""
    return option_params(S=100, K=100, T=1.0, r=0.05, sigma=0.20, q=0.0, option_type='put')


@pytest.fixture
def itm_call(option_params):
    """ITM Call: S=110, K=100."""
    return option_params(S=110, K=100, T=0.5, r=0.05, sigma=0.25, q=0.0, option_type='call')


@pytest.fixture
def otm_put(option_params):
    """OTM Put: S=100, K=90."""
    return option_params(S=100, K=90, T=0.25, r=0.05, sigma=0.30, q=0.0, option_type='put')


# ─── Black-Scholes Pricing ───────────────────────────────────────────────────

class TestBlackScholesPrice:

    def test_atm_call_reasonable_price(self, bs_engine, atm_call):
        price = bs_engine.price(atm_call)
        # ATM call with 20% vol and 1yr should be around 7-11
        assert 6.0 <= price <= 12.0, f"ATM call price {price} out of reasonable range"

    def test_atm_put_reasonable_price(self, bs_engine, atm_put):
        price = bs_engine.price(atm_put)
        assert 2.0 <= price <= 8.0

    def test_put_call_parity(self, bs_engine, option_params):
        """C - P = S*e^(-qT) - K*e^(-rT)"""
        params = dict(S=100, K=100, T=1.0, r=0.05, sigma=0.20, q=0.02)
        call = bs_engine.price(option_params(**params, option_type='call'))
        put = bs_engine.price(option_params(**params, option_type='put'))
        S, K, T, r, q = params['S'], params['K'], params['T'], params['r'], params['q']
        parity = S * math.exp(-q * T) - K * math.exp(-r * T)
        assert abs((call - put) - parity) < 1e-7, f"Put-call parity violated: {call-put} != {parity}"

    def test_price_monotone_in_spot_call(self, bs_engine, option_params):
        """Call price increases as spot increases."""
        prices = [bs_engine.price(option_params(S=s, K=100, T=1.0, r=0.05, sigma=0.2, q=0.0, option_type='call')) for s in [80, 90, 100, 110, 120]]
        assert all(prices[i] < prices[i+1] for i in range(len(prices)-1))

    def test_price_monotone_in_spot_put(self, bs_engine, option_params):
        """Put price decreases as spot increases."""
        prices = [bs_engine.price(option_params(S=s, K=100, T=1.0, r=0.05, sigma=0.2, q=0.0, option_type='put')) for s in [80, 90, 100, 110, 120]]
        assert all(prices[i] > prices[i+1] for i in range(len(prices)-1))

    def test_price_increases_with_vol(self, bs_engine, option_params):
        """Option price increases with volatility (vega positive)."""
        prices = [bs_engine.price(option_params(S=100, K=100, T=1.0, r=0.05, sigma=v, q=0.0, option_type='call')) for v in [0.10, 0.20, 0.30, 0.40]]
        assert all(prices[i] < prices[i+1] for i in range(len(prices)-1))

    def test_price_increases_with_time(self, bs_engine, option_params):
        """Option price increases with time to expiry."""
        prices = [bs_engine.price(option_params(S=100, K=100, T=t, r=0.05, sigma=0.2, q=0.0, option_type='call')) for t in [0.1, 0.25, 0.5, 1.0, 2.0]]
        assert all(prices[i] < prices[i+1] for i in range(len(prices)-1))

    def test_deep_itm_converges_intrinsic(self, bs_engine, option_params):
        """Very deep ITM call ~= S - K (intrinsic)."""
        price = bs_engine.price(option_params(S=200, K=100, T=0.01, r=0.05, sigma=0.2, q=0.0, option_type='call'))
        assert abs(price - 100) < 5.0

    def test_deep_otm_near_zero(self, bs_engine, option_params):
        """Very deep OTM call approaches zero."""
        price = bs_engine.price(option_params(S=50, K=200, T=0.1, r=0.05, sigma=0.2, q=0.0, option_type='call'))
        assert price < 0.01

    def test_expired_option_intrinsic_only(self, bs_engine, option_params):
        """Expired options have only intrinsic value."""
        call = bs_engine.price(option_params(S=110, K=100, T=0, r=0.05, sigma=0.2, q=0.0, option_type='call'))
        assert abs(call - 10.0) < 0.01
        put_otm = bs_engine.price(option_params(S=110, K=100, T=0, r=0.05, sigma=0.2, q=0.0, option_type='put'))
        assert abs(put_otm) < 0.01


# ─── Greeks ───────────────────────────────────────────────────────────────────

class TestGreeks:

    def test_call_delta_range(self, bs_engine, atm_call):
        g = bs_engine.greeks(atm_call)
        assert 0.0 < g.delta < 1.0, "Call delta must be between 0 and 1"

    def test_put_delta_range(self, bs_engine, atm_put):
        g = bs_engine.greeks(atm_put)
        assert -1.0 < g.delta < 0.0, "Put delta must be between -1 and 0"

    def test_atm_call_delta_near_half(self, bs_engine, option_params):
        """ATM call delta approximately 0.5."""
        g = bs_engine.greeks(option_params(S=100, K=100, T=1.0, r=0.0, sigma=0.20, q=0.0, option_type='call'))
        assert 0.45 <= g.delta <= 0.60

    def test_gamma_positive(self, bs_engine, atm_call, atm_put):
        """Gamma is always positive for long options."""
        assert bs_engine.greeks(atm_call).gamma > 0
        assert bs_engine.greeks(atm_put).gamma > 0

    def test_call_put_same_gamma(self, bs_engine, atm_call, atm_put):
        """Call and put with same params have identical gamma."""
        cg = bs_engine.greeks(atm_call)
        pg = bs_engine.greeks(atm_put)
        assert abs(cg.gamma - pg.gamma) < 1e-10

    def test_theta_negative_long_call(self, bs_engine, atm_call):
        """Theta is negative for long options (time decay)."""
        g = bs_engine.greeks(atm_call)
        assert g.theta < 0, "Long call theta must be negative"

    def test_vega_positive(self, bs_engine, atm_call, atm_put):
        """Vega is positive for long options."""
        assert bs_engine.greeks(atm_call).vega > 0
        assert bs_engine.greeks(atm_put).vega > 0

    def test_call_rho_positive(self, bs_engine, atm_call):
        """Call rho: higher rates -> higher call value."""
        assert bs_engine.greeks(atm_call).rho > 0

    def test_put_rho_negative(self, bs_engine, atm_put):
        """Put rho: higher rates -> lower put value."""
        assert bs_engine.greeks(atm_put).rho < 0

    def test_delta_put_call_relationship(self, bs_engine, option_params):
        """Call delta - Put delta = e^(-qT) ≈ 1 for q=0."""
        p_base = dict(S=100, K=100, T=0.5, r=0.05, sigma=0.25, q=0.0)
        call_d = bs_engine.greeks(option_params(**p_base, option_type='call')).delta
        put_d = bs_engine.greeks(option_params(**p_base, option_type='put')).delta
        assert abs(call_d + abs(put_d) - 1.0) < 0.05

    def test_moneyness_classification(self, bs_engine, option_params):
        itm = bs_engine.greeks(option_params(S=115, K=100, T=1.0, r=0.05, sigma=0.2, q=0.0, option_type='call'))
        atm_g = bs_engine.greeks(option_params(S=100, K=100, T=1.0, r=0.05, sigma=0.2, q=0.0, option_type='call'))
        otm = bs_engine.greeks(option_params(S=85, K=100, T=1.0, r=0.05, sigma=0.2, q=0.0, option_type='call'))
        assert itm.moneyness == 'ITM'
        assert atm_g.moneyness == 'ATM'
        assert otm.moneyness == 'OTM'

    def test_time_value_nonnegative(self, bs_engine, atm_call):
        g = bs_engine.greeks(atm_call)
        assert g.time_value >= 0

    def test_intrinsic_nonnegative(self, bs_engine, atm_call):
        g = bs_engine.greeks(atm_call)
        assert g.intrinsic >= 0


# ─── Implied Volatility ───────────────────────────────────────────────────────

class TestImpliedVol:

    def test_iv_round_trip(self, bs_engine, iv_solver, option_params):
        """Price a call, then recover the IV from that price."""
        true_sigma = 0.25
        params = option_params(S=100, K=100, T=1.0, r=0.05, sigma=true_sigma, q=0.0, option_type='call')
        price = bs_engine.price(params)
        iv_result = iv_solver.solve_nr(price, S=100, K=100, T=1.0, r=0.05)
        assert abs(iv_result.iv - true_sigma) < 1e-4, f"IV {iv_result.iv} != true sigma {true_sigma}"

    def test_iv_converges(self, iv_solver):
        """IV solver should converge for reasonable inputs."""
        result = iv_solver.solve_nr(5.0, S=100, K=100, T=0.5, r=0.05)
        assert result.converged
        assert 0.01 <= result.iv <= 2.0

    def test_iv_multiple_sigmas(self, bs_engine, iv_solver, option_params):
        """Test IV recovery across range of volatilities."""
        for sigma in [0.10, 0.20, 0.30, 0.50, 0.80]:
            params = option_params(S=100, K=100, T=1.0, r=0.05, sigma=sigma, q=0.0, option_type='call')
            price = bs_engine.price(params)
            iv_result = iv_solver.solve_nr(price, S=100, K=100, T=1.0, r=0.05)
            assert abs(iv_result.iv - sigma) < 0.001, f"At sigma={sigma}: recovered {iv_result.iv}"

    def test_iv_put(self, bs_engine, iv_solver, option_params):
        """IV solver works for put options."""
        true_sigma = 0.30
        params = option_params(S=100, K=105, T=0.25, r=0.05, sigma=true_sigma, q=0.0, option_type='put')
        price = bs_engine.price(params)
        iv_result = iv_solver.solve_nr(price, S=100, K=105, T=0.25, r=0.05, option_type='put')
        assert abs(iv_result.iv - true_sigma) < 1e-3

    def test_iv_bisection_fallback(self, iv_solver):
        """Bisection method should work as fallback."""
        result = iv_solver.solve_bisection(3.0, S=100, K=100, T=0.5, r=0.05)
        assert result.iv > 0
        assert result.method == 'Bisection'


# ─── Volatility Surface ───────────────────────────────────────────────────────

class TestVolSurface:

    def test_surface_dimensions(self, vol_surface_engine):
        surf = vol_surface_engine.build_surface(spot=100.0)
        assert len(surf.strikes) > 0
        assert len(surf.expiries) > 0
        assert len(surf.vols) == len(surf.expiries)
        assert all(len(row) == len(surf.strikes) for row in surf.vols)

    def test_surface_vols_positive(self, vol_surface_engine):
        surf = vol_surface_engine.build_surface(spot=100.0)
        for row in surf.vols:
            for v in row:
                assert v > 0, f"Negative vol found: {v}"

    def test_surface_skew_pattern(self, vol_surface_engine):
        """Low moneyness (OTM puts) should have higher IV than ATM."""
        surf = vol_surface_engine.build_surface(spot=100.0)
        # Find ATM and OTM put strikes
        atm_idx = min(range(len(surf.strikes)), key=lambda i: abs(surf.strikes[i] - 100))
        otm_idx = 0  # lowest strike = deepest OTM put
        if atm_idx > 0 and len(surf.vols) > 0:
            atm_vol = surf.vols[4][atm_idx]   # 3-month expiry
            otm_vol = surf.vols[4][otm_idx]
            assert otm_vol >= atm_vol, "OTM puts should have higher vol (negative skew)"

    def test_surface_interpolation(self, vol_surface_engine):
        surf = vol_surface_engine.build_surface(spot=100.0)
        # Interpolate at midpoints
        K_mid = (surf.strikes[2] + surf.strikes[3]) / 2
        T_mid = (surf.expiries[2] + surf.expiries[3]) / 2
        iv = vol_surface_engine.get_iv_at(surf, K_mid, T_mid)
        assert 0.05 <= iv <= 2.0

    def test_surface_custom_strikes(self, vol_surface_engine):
        moneyness = [0.85, 0.90, 0.95, 1.0, 1.05, 1.10]
        surf = vol_surface_engine.build_surface(spot=100.0, moneyness_levels=moneyness)
        assert len(surf.strikes) == len(moneyness)


# ─── Option Chain ─────────────────────────────────────────────────────────────

class TestOptionChain:

    def test_chain_length(self, chain_builder):
        chain = chain_builder.build_chain(spot=500.0, expiry_days=30, num_strikes=15)
        assert len(chain) == 15

    def test_chain_put_call_parity_approx(self, chain_builder):
        """Chain rows should approximately satisfy put-call parity."""
        chain = chain_builder.build_chain(spot=100.0, expiry_days=30)
        S, r, T = 100.0, 0.053, 30/365.0
        for row in chain:
            parity_lhs = row.call_price - row.put_price
            parity_rhs = S - row.strike * math.exp(-r * T)
            assert abs(parity_lhs - parity_rhs) < 3.0  # loose tolerance for mock IVs

    def test_call_delta_decreasing_in_strike(self, chain_builder):
        chain = chain_builder.build_chain(spot=100.0, expiry_days=60)
        sorted_chain = sorted(chain, key=lambda r: r.strike)
        deltas = [r.call_delta for r in sorted_chain]
        assert all(deltas[i] >= deltas[i+1] - 0.05 for i in range(len(deltas)-1))

    def test_chain_positive_prices(self, chain_builder):
        chain = chain_builder.build_chain(spot=200.0, expiry_days=90)
        for row in chain:
            assert row.call_price >= 0
            assert row.put_price >= 0

    def test_chain_ivs_positive(self, chain_builder):
        chain = chain_builder.build_chain(spot=100.0, expiry_days=45)
        for row in chain:
            assert row.call_iv > 0, f"Negative call IV at strike {row.strike}"
            assert row.put_iv > 0


# ─── Spread Pricing ───────────────────────────────────────────────────────────

class TestSpreads:

    def test_bull_call_spread_net_debit(self, spread_engine):
        """Bull call spread is bought for a debit."""
        result = spread_engine.vertical_spread(S=100, K_long=95, K_short=105, T=0.5, r=0.05, sigma=0.25)
        assert result.net_price > 0, "Bull call spread should be a debit"

    def test_spread_max_profit_loss(self, spread_engine):
        result = spread_engine.vertical_spread(S=100, K_long=95, K_short=105, T=0.5, r=0.05, sigma=0.25)
        assert result.max_profit > 0
        assert result.max_loss > 0
        assert result.max_profit < 10.0  # can't exceed strike width

    def test_iron_condor_credit(self, spread_engine):
        """Iron condor should generate a net credit."""
        result = spread_engine.iron_condor(S=100, K_put_long=85, K_put_short=90,
                                            K_call_short=110, K_call_long=115, T=0.25, r=0.05,
                                            sigma_put=0.28, sigma_call=0.22)
        assert result.net_price > 0, "Iron condor should be a net credit"
        assert result.max_loss > 0
        assert result.breakeven_lower is not None
        assert result.breakeven_upper is not None

    def test_bear_put_spread(self, spread_engine):
        """Bear put spread: long higher strike put, short lower strike put."""
        result = spread_engine.vertical_spread(S=100, K_long=105, K_short=95, T=0.25, r=0.05, sigma=0.25, option_type='put')
        assert result.net_price > 0

    def test_spread_breakevens_logical(self, spread_engine):
        result = spread_engine.vertical_spread(S=100, K_long=95, K_short=105, T=0.5, r=0.05, sigma=0.25)
        if result.breakeven_lower:
            assert 95 < result.breakeven_lower < 105
