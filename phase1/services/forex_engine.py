"""
Forex Engine — Currency pair analysis, carry trade optimization, purchasing power
parity, interest rate parity, technical cross-currency analysis, FX risk management,
correlation matrix, volatility smile, FX options, forward curve, swap points.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class CurrencyPairType(str, Enum):
    MAJOR = "major"
    MINOR = "minor"
    EXOTIC = "exotic"
    CROSS = "cross"


class QuoteConvention(str, Enum):
    DIRECT = "direct"
    INDIRECT = "indirect"
    EUROPEAN = "european"
    AMERICAN = "american"


MAJOR_PAIRS = [
    "EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
]

G10_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD", "SEK", "NOK"]


@dataclass
class CurrencyPair:
    base: str
    quote: str
    rate: float
    bid: float = 0.0
    ask: float = 0.0

    @property
    def symbol(self) -> str:
        return f"{self.base}{self.quote}"

    @property
    def spread(self) -> float:
        return self.ask - self.bid

    @property
    def spread_pips(self) -> float:
        pip_size = 0.01 if "JPY" in self.symbol else 0.0001
        return self.spread / pip_size

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "base": self.base,
            "quote": self.quote,
            "rate": round(self.rate, 6),
            "bid": round(self.bid, 6),
            "ask": round(self.ask, 6),
            "spread_pips": round(self.spread_pips, 1),
        }


@dataclass
class CarryTradeResult:
    pair: str
    carry_return: float
    spot_return: float
    total_return: float
    annualized_carry: float
    sharpe_ratio: float

    def to_dict(self) -> dict:
        return {
            "pair": self.pair,
            "carry_return": round(self.carry_return, 6),
            "spot_return": round(self.spot_return, 6),
            "total_return": round(self.total_return, 6),
            "annualized_carry": round(self.annualized_carry, 4),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
        }


# ── Interest Rate Parity ─────────────────────────────────────────────

class InterestRateParity:
    @staticmethod
    def covered_irp(
        spot_rate: float,
        domestic_rate: float,
        foreign_rate: float,
        days: int = 360,
    ) -> dict:
        """
        Covered Interest Rate Parity.
        Forward = Spot × ((1 + r_d × T) / (1 + r_f × T))
        """
        T = days / 360
        forward = spot_rate * ((1 + domestic_rate * T) / (1 + foreign_rate * T))
        forward_premium = (forward - spot_rate) / spot_rate
        swap_points = (forward - spot_rate) * 10000

        return {
            "spot_rate": round(spot_rate, 6),
            "forward_rate": round(forward, 6),
            "forward_premium_pct": round(forward_premium * 100, 4),
            "swap_points": round(swap_points, 2),
            "domestic_rate": round(domestic_rate, 4),
            "foreign_rate": round(foreign_rate, 4),
            "days": days,
        }

    @staticmethod
    def uncovered_irp(
        spot_rate: float,
        domestic_rate: float,
        foreign_rate: float,
    ) -> dict:
        """
        Uncovered Interest Rate Parity.
        E(S_future) = S × (1 + r_d) / (1 + r_f)
        """
        expected_future = spot_rate * (1 + domestic_rate) / (1 + foreign_rate)
        expected_depreciation = (expected_future - spot_rate) / spot_rate

        return {
            "spot_rate": round(spot_rate, 6),
            "expected_future_spot": round(expected_future, 6),
            "expected_depreciation_pct": round(expected_depreciation * 100, 4),
            "carry_advantage": round((foreign_rate - domestic_rate) * 100, 4),
        }

    @staticmethod
    def forward_curve(
        spot_rate: float,
        domestic_rates: list[float],
        foreign_rates: list[float],
        tenors_days: list[int],
    ) -> list[dict]:
        """Build forward rate curve."""
        curve = []
        for i in range(min(len(domestic_rates), len(foreign_rates), len(tenors_days))):
            T = tenors_days[i] / 360
            fwd = spot_rate * ((1 + domestic_rates[i] * T) / (1 + foreign_rates[i] * T))
            points = (fwd - spot_rate) * 10000
            curve.append({
                "tenor_days": tenors_days[i],
                "forward_rate": round(fwd, 6),
                "swap_points": round(points, 2),
                "premium_pct": round((fwd - spot_rate) / spot_rate * 100, 4),
            })
        return curve


# ── Purchasing Power Parity ───────────────────────────────────────────

class PurchasingPowerParity:
    @staticmethod
    def absolute_ppp(
        domestic_price_level: float,
        foreign_price_level: float,
    ) -> dict:
        """Absolute PPP: S = P_d / P_f."""
        ppp_rate = domestic_price_level / foreign_price_level if foreign_price_level > 0 else 0
        return {
            "ppp_rate": round(ppp_rate, 6),
            "domestic_price_level": round(domestic_price_level, 2),
            "foreign_price_level": round(foreign_price_level, 2),
        }

    @staticmethod
    def relative_ppp(
        spot_rate: float,
        domestic_inflation: float,
        foreign_inflation: float,
        years: float = 1.0,
    ) -> dict:
        """
        Relative PPP: S_future = S × ((1 + π_d) / (1 + π_f))^T
        """
        expected = spot_rate * ((1 + domestic_inflation) / (1 + foreign_inflation)) ** years
        expected_change = (expected - spot_rate) / spot_rate

        return {
            "current_spot": round(spot_rate, 6),
            "expected_spot": round(expected, 6),
            "expected_change_pct": round(expected_change * 100, 4),
            "inflation_differential": round((domestic_inflation - foreign_inflation) * 100, 4),
        }

    @staticmethod
    def big_mac_index(
        big_mac_domestic: float,
        big_mac_foreign: float,
        actual_rate: float,
    ) -> dict:
        """Big Mac Index — simplified PPP gauge."""
        implied_rate = big_mac_domestic / big_mac_foreign if big_mac_foreign > 0 else 0
        over_under_valuation = (actual_rate - implied_rate) / implied_rate if implied_rate > 0 else 0

        return {
            "implied_ppp_rate": round(implied_rate, 4),
            "actual_rate": round(actual_rate, 4),
            "valuation_pct": round(over_under_valuation * 100, 2),
            "signal": "overvalued" if over_under_valuation > 0.1 else "undervalued" if over_under_valuation < -0.1 else "fair",
        }


# ── Carry Trade ───────────────────────────────────────────────────────

class CarryTradeAnalysis:
    @staticmethod
    def carry_returns(
        pairs: list[str],
        spot_returns: list[list[float]],  # daily returns
        interest_diffs: list[float],  # annualized carry
    ) -> list[CarryTradeResult]:
        """Calculate carry trade returns for multiple pairs."""
        results = []
        for i, pair in enumerate(pairs):
            if i >= len(spot_returns) or i >= len(interest_diffs):
                continue

            daily_carry = interest_diffs[i] / 252
            daily_spots = spot_returns[i]
            n = len(daily_spots)

            if n == 0:
                continue

            total_carry = daily_carry * n
            total_spot = sum(daily_spots)
            total_return = total_carry + total_spot

            # Sharpe
            daily_total = [daily_carry + daily_spots[j] for j in range(n)]
            avg_ret = statistics.mean(daily_total)
            std_ret = statistics.stdev(daily_total) if len(daily_total) > 1 else 1
            sharpe = avg_ret / std_ret * math.sqrt(252) if std_ret > 0 else 0

            results.append(CarryTradeResult(
                pair=pair,
                carry_return=total_carry,
                spot_return=total_spot,
                total_return=total_return,
                annualized_carry=interest_diffs[i],
                sharpe_ratio=sharpe,
            ))

        results.sort(key=lambda x: x.sharpe_ratio, reverse=True)
        return results

    @staticmethod
    def optimal_carry_portfolio(
        pairs: list[str],
        carry_rates: list[float],
        volatilities: list[float],
        correlations: list[list[float]],
        max_leverage: float = 5.0,
    ) -> dict:
        """Build an optimal carry portfolio."""
        n = len(pairs)
        if n == 0:
            return {}

        # Calculate Sharpe-like scores
        scores = [carry_rates[i] / volatilities[i] if volatilities[i] > 0 else 0 for i in range(n)]

        # Simple inverse-vol weighting with score filter
        total_inv_vol = sum(1 / volatilities[i] if volatilities[i] > 0 else 0 for i in range(n) if scores[i] > 0)

        weights = []
        for i in range(n):
            if scores[i] > 0 and volatilities[i] > 0:
                w = (1 / volatilities[i]) / total_inv_vol if total_inv_vol > 0 else 0
            else:
                w = 0
            weights.append(w)

        # Scale to leverage
        leverage = min(max_leverage, sum(abs(w) for w in weights))
        if leverage > 0:
            scale = max_leverage / leverage
            weights = [w * scale for w in weights]

        # Portfolio metrics
        port_carry = sum(weights[i] * carry_rates[i] for i in range(n))
        port_var = sum(
            weights[i] * weights[j] * volatilities[i] * volatilities[j] *
            (correlations[i][j] if i < len(correlations) and j < len(correlations[i]) else (1 if i == j else 0))
            for i in range(n)
            for j in range(n)
        )
        port_vol = math.sqrt(max(port_var, 0))

        return {
            "weights": {pairs[i]: round(weights[i], 4) for i in range(n)},
            "portfolio_carry": round(port_carry, 4),
            "portfolio_volatility": round(port_vol, 4),
            "portfolio_sharpe": round(port_carry / port_vol if port_vol > 0 else 0, 4),
            "effective_leverage": round(sum(abs(w) for w in weights), 2),
        }


# ── FX Options ────────────────────────────────────────────────────────

class FXOptions:
    @staticmethod
    def garman_kohlhagen(
        spot: float,
        strike: float,
        vol: float,
        r_domestic: float,
        r_foreign: float,
        T: float,
        is_call: bool = True,
    ) -> dict:
        """
        Garman-Kohlhagen model for FX options.
        Adjustment of Black-Scholes for foreign interest rate.
        """
        if T <= 0 or vol <= 0:
            intrinsic = max(spot - strike, 0) if is_call else max(strike - spot, 0)
            return {"price": round(intrinsic, 6), "delta": 0, "gamma": 0, "vega": 0, "theta": 0}

        sqrt_T = math.sqrt(T)
        d1 = (math.log(spot / strike) + (r_domestic - r_foreign + 0.5 * vol ** 2) * T) / (vol * sqrt_T)
        d2 = d1 - vol * sqrt_T

        # N(x) approximation
        def N(x: float) -> float:
            return 0.5 * (1 + math.erf(x / math.sqrt(2)))

        def n(x: float) -> float:
            return math.exp(-0.5 * x ** 2) / math.sqrt(2 * math.pi)

        if is_call:
            price = spot * math.exp(-r_foreign * T) * N(d1) - strike * math.exp(-r_domestic * T) * N(d2)
            delta = math.exp(-r_foreign * T) * N(d1)
        else:
            price = strike * math.exp(-r_domestic * T) * N(-d2) - spot * math.exp(-r_foreign * T) * N(-d1)
            delta = -math.exp(-r_foreign * T) * N(-d1)

        gamma = math.exp(-r_foreign * T) * n(d1) / (spot * vol * sqrt_T)
        vega = spot * math.exp(-r_foreign * T) * n(d1) * sqrt_T / 100
        theta = (
            -spot * math.exp(-r_foreign * T) * n(d1) * vol / (2 * sqrt_T)
            + (r_foreign * spot * math.exp(-r_foreign * T) * N(d1 if is_call else -d1))
            - (r_domestic * strike * math.exp(-r_domestic * T) * N(d2 if is_call else -d2))
        ) / 365

        return {
            "price": round(price, 6),
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "vega": round(vega, 6),
            "theta": round(theta, 6),
            "d1": round(d1, 4),
            "d2": round(d2, 4),
        }

    @staticmethod
    def risk_reversal(
        spot: float,
        vol_25d_call: float,
        vol_25d_put: float,
        vol_atm: float,
    ) -> dict:
        """Risk reversal and butterfly from FX vol quotes."""
        risk_reversal = vol_25d_call - vol_25d_put
        butterfly = (vol_25d_call + vol_25d_put) / 2 - vol_atm
        skew = risk_reversal / vol_atm if vol_atm > 0 else 0

        return {
            "risk_reversal": round(risk_reversal, 4),
            "butterfly": round(butterfly, 4),
            "skew_normalized": round(skew, 4),
            "sentiment": "call_demand" if risk_reversal > 0.005 else "put_demand" if risk_reversal < -0.005 else "balanced",
            "vol_atm": round(vol_atm, 4),
            "vol_25d_call": round(vol_25d_call, 4),
            "vol_25d_put": round(vol_25d_put, 4),
        }


# ── FX Risk Management ───────────────────────────────────────────────

class FXRiskManagement:
    @staticmethod
    def hedge_ratio(
        exposure: float,
        spot_rate: float,
        hedge_pct: float = 1.0,
    ) -> dict:
        """Calculate hedge notional and cost estimate."""
        notional = exposure * hedge_pct
        forward_amount = notional / spot_rate if spot_rate > 0 else 0

        return {
            "exposure": round(exposure, 2),
            "hedge_percentage": round(hedge_pct * 100, 2),
            "notional_to_hedge": round(notional, 2),
            "forward_notional": round(forward_amount, 2),
        }

    @staticmethod
    def hedge_effectiveness(
        unhedged_returns: list[float],
        hedged_returns: list[float],
    ) -> dict:
        """Measure hedge effectiveness."""
        if len(unhedged_returns) < 2 or len(hedged_returns) < 2:
            return {}

        n = min(len(unhedged_returns), len(hedged_returns))
        unhedged_vol = statistics.stdev(unhedged_returns[:n])
        hedged_vol = statistics.stdev(hedged_returns[:n])

        var_reduction = 1 - (hedged_vol / unhedged_vol) ** 2 if unhedged_vol > 0 else 0

        return {
            "unhedged_volatility": round(unhedged_vol * math.sqrt(252), 4),
            "hedged_volatility": round(hedged_vol * math.sqrt(252), 4),
            "variance_reduction_pct": round(var_reduction * 100, 2),
            "effectiveness": "excellent" if var_reduction > 0.9 else "good" if var_reduction > 0.7 else "moderate" if var_reduction > 0.5 else "poor",
        }

    @staticmethod
    def cross_currency_exposure(
        positions: dict[str, float],  # currency -> net position
        rates_to_base: dict[str, float],  # currency -> rate to base
        base_currency: str = "USD",
    ) -> dict:
        """Calculate total FX exposure."""
        exposures = {}
        total_exposure = 0.0

        for ccy, position in positions.items():
            if ccy == base_currency:
                exposures[ccy] = {"position": round(position, 2), "base_equivalent": round(position, 2)}
            else:
                rate = rates_to_base.get(ccy, 1.0)
                base_equiv = position / rate if rate > 0 else 0
                exposures[ccy] = {
                    "position": round(position, 2),
                    "rate": round(rate, 6),
                    "base_equivalent": round(base_equiv, 2),
                }
                total_exposure += abs(base_equiv)

        # Concentration
        if total_exposure > 0:
            for ccy, exp in exposures.items():
                exp["pct_of_total"] = round(abs(exp.get("base_equivalent", 0)) / total_exposure * 100, 2)

        return {
            "base_currency": base_currency,
            "total_gross_exposure": round(total_exposure, 2),
            "net_exposure": round(sum(e.get("base_equivalent", 0) for e in exposures.values()), 2),
            "exposures": exposures,
        }


# ── Cross Rates ───────────────────────────────────────────────────────

class CrossRateCalculator:
    @staticmethod
    def calculate_cross(
        base_usd_rate: float,
        quote_usd_rate: float,
    ) -> float:
        """Calculate cross rate from USD rates."""
        return base_usd_rate / quote_usd_rate if quote_usd_rate > 0 else 0

    @staticmethod
    def cross_rate_matrix(
        currencies: list[str],
        usd_rates: dict[str, float],
    ) -> dict:
        """Build a full cross-rate matrix."""
        matrix = {}
        for base in currencies:
            matrix[base] = {}
            for quote in currencies:
                if base == quote:
                    matrix[base][quote] = 1.0
                else:
                    base_rate = usd_rates.get(base, 1.0)
                    quote_rate = usd_rates.get(quote, 1.0)
                    matrix[base][quote] = round(base_rate / quote_rate if quote_rate > 0 else 0, 6)
        return matrix

    @staticmethod
    def triangular_arbitrage(
        rate_AB: float,
        rate_BC: float,
        rate_AC: float,
    ) -> dict:
        """Check for triangular arbitrage opportunity."""
        # A -> B -> C -> A
        implied_AC = rate_AB * rate_BC
        arb_profit = implied_AC / rate_AC - 1 if rate_AC > 0 else 0

        return {
            "direct_rate_AC": round(rate_AC, 6),
            "implied_rate_AC": round(implied_AC, 6),
            "arbitrage_profit_pct": round(arb_profit * 100, 4),
            "opportunity": arb_profit > 0.0005,
            "direction": "buy_implied" if arb_profit > 0 else "sell_implied",
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class ForexEngine:
    def __init__(self) -> None:
        self.irp = InterestRateParity()
        self.ppp = PurchasingPowerParity()
        self.carry = CarryTradeAnalysis()
        self.options = FXOptions()
        self.risk = FXRiskManagement()
        self.cross = CrossRateCalculator()

    def covered_interest_parity(self, **kwargs) -> dict:
        return self.irp.covered_irp(**kwargs)

    def uncovered_interest_parity(self, **kwargs) -> dict:
        return self.irp.uncovered_irp(**kwargs)

    def forward_curve(self, **kwargs) -> list[dict]:
        return self.irp.forward_curve(**kwargs)

    def relative_ppp(self, **kwargs) -> dict:
        return self.ppp.relative_ppp(**kwargs)

    def big_mac_ppp(self, **kwargs) -> dict:
        return self.ppp.big_mac_index(**kwargs)

    def carry_trade_analysis(self, **kwargs) -> list[dict]:
        results = self.carry.carry_returns(**kwargs)
        return [r.to_dict() for r in results]

    def optimal_carry_portfolio(self, **kwargs) -> dict:
        return self.carry.optimal_carry_portfolio(**kwargs)

    def fx_option_price(self, **kwargs) -> dict:
        return self.options.garman_kohlhagen(**kwargs)

    def risk_reversal(self, **kwargs) -> dict:
        return self.options.risk_reversal(**kwargs)

    def hedge_effectiveness(self, **kwargs) -> dict:
        return self.risk.hedge_effectiveness(**kwargs)

    def cross_rate_matrix(self, **kwargs) -> dict:
        return self.cross.cross_rate_matrix(**kwargs)

    def triangular_arbitrage(self, **kwargs) -> dict:
        return self.cross.triangular_arbitrage(**kwargs)

    def capabilities(self) -> dict:
        return {
            "engine": "ForexEngine",
            "version": "1.0.0",
            "features": [
                "covered_interest_rate_parity",
                "uncovered_interest_rate_parity",
                "forward_rate_curve",
                "purchasing_power_parity (absolute, relative, Big Mac)",
                "carry_trade_analysis",
                "optimal_carry_portfolio",
                "FX_options (Garman-Kohlhagen)",
                "risk_reversal_and_butterfly",
                "hedge_ratio_calculation",
                "hedge_effectiveness_measurement",
                "cross_currency_exposure",
                "cross_rate_matrix",
                "triangular_arbitrage_detection",
            ],
        }
