"""
Performance Attribution Engine — Brinson attribution, factor-based attribution,
risk attribution, sector/region/style attribution, fixed income attribution,
currency attribution, transaction cost analysis.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class AttributionMethod(str, Enum):
    BRINSON_FACHLER = "brinson_fachler"
    BRINSON_HOOD_BEEBOWER = "brinson_hood_beebower"
    FACTOR_BASED = "factor_based"
    RISK_BASED = "risk_based"
    TRANSACTION_COST = "transaction_cost"
    CURRENCY = "currency"
    FIXED_INCOME = "fixed_income"
    MULTI_PERIOD = "multi_period"


class AttributionLevel(str, Enum):
    SECTOR = "sector"
    INDUSTRY = "industry"
    COUNTRY = "country"
    REGION = "region"
    STYLE = "style"
    MARKET_CAP = "market_cap"


@dataclass
class HoldingWeight:
    name: str
    portfolio_weight: float
    benchmark_weight: float
    portfolio_return: float
    benchmark_return: float


@dataclass
class AttributionResult:
    allocation_effect: float
    selection_effect: float
    interaction_effect: float
    total_active_return: float
    details: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "allocation_effect": round(self.allocation_effect, 6),
            "selection_effect": round(self.selection_effect, 6),
            "interaction_effect": round(self.interaction_effect, 6),
            "total_active_return": round(self.total_active_return, 6),
            "details": self.details,
        }


@dataclass
class FactorAttributionResult:
    factor_returns: dict[str, float]
    factor_contributions: dict[str, float]
    specific_return: float
    r_squared: float
    tracking_error: float

    def to_dict(self) -> dict:
        return {
            "factor_returns": {k: round(v, 6) for k, v in self.factor_returns.items()},
            "factor_contributions": {k: round(v, 6) for k, v in self.factor_contributions.items()},
            "specific_return": round(self.specific_return, 6),
            "r_squared": round(self.r_squared, 4),
            "tracking_error": round(self.tracking_error, 6),
        }


# ── Brinson Attribution ──────────────────────────────────────────────

class BrinsonAttribution:
    """Brinson-Fachler and Brinson-Hood-Beebower attribution models."""

    @staticmethod
    def brinson_fachler(holdings: list[HoldingWeight]) -> AttributionResult:
        """
        Brinson-Fachler attribution.
        Allocation = (wp - wb) * (Rb - R_B)
        Selection = wb * (Rp - Rb)
        Interaction = (wp - wb) * (Rp - Rb)
        """
        total_benchmark_return = sum(h.benchmark_weight * h.benchmark_return for h in holdings)
        total_portfolio_return = sum(h.portfolio_weight * h.portfolio_return for h in holdings)

        details = []
        total_alloc = 0.0
        total_select = 0.0
        total_interact = 0.0

        for h in holdings:
            alloc = (h.portfolio_weight - h.benchmark_weight) * (h.benchmark_return - total_benchmark_return)
            select = h.benchmark_weight * (h.portfolio_return - h.benchmark_return)
            interact = (h.portfolio_weight - h.benchmark_weight) * (h.portfolio_return - h.benchmark_return)

            total_alloc += alloc
            total_select += select
            total_interact += interact

            details.append({
                "name": h.name,
                "portfolio_weight": round(h.portfolio_weight, 4),
                "benchmark_weight": round(h.benchmark_weight, 4),
                "portfolio_return": round(h.portfolio_return, 6),
                "benchmark_return": round(h.benchmark_return, 6),
                "allocation": round(alloc, 6),
                "selection": round(select, 6),
                "interaction": round(interact, 6),
                "total_contribution": round(alloc + select + interact, 6),
            })

        return AttributionResult(
            allocation_effect=total_alloc,
            selection_effect=total_select,
            interaction_effect=total_interact,
            total_active_return=total_portfolio_return - total_benchmark_return,
            details=details,
        )

    @staticmethod
    def brinson_hood_beebower(holdings: list[HoldingWeight]) -> AttributionResult:
        """
        BHB attribution.
        Allocation = (wp - wb) * Rb
        Selection = wb * (Rp - Rb)
        Interaction = (wp - wb) * (Rp - Rb)
        """
        total_benchmark_return = sum(h.benchmark_weight * h.benchmark_return for h in holdings)
        total_portfolio_return = sum(h.portfolio_weight * h.portfolio_return for h in holdings)

        details = []
        total_alloc = 0.0
        total_select = 0.0
        total_interact = 0.0

        for h in holdings:
            alloc = (h.portfolio_weight - h.benchmark_weight) * h.benchmark_return
            select = h.benchmark_weight * (h.portfolio_return - h.benchmark_return)
            interact = (h.portfolio_weight - h.benchmark_weight) * (h.portfolio_return - h.benchmark_return)

            total_alloc += alloc
            total_select += select
            total_interact += interact

            details.append({
                "name": h.name,
                "allocation": round(alloc, 6),
                "selection": round(select, 6),
                "interaction": round(interact, 6),
            })

        return AttributionResult(
            allocation_effect=total_alloc,
            selection_effect=total_select,
            interaction_effect=total_interact,
            total_active_return=total_portfolio_return - total_benchmark_return,
            details=details,
        )


# ── Multi-Period Attribution ──────────────────────────────────────────

class MultiPeriodAttribution:
    @staticmethod
    def carino_linking(
        period_portfolio_returns: list[float],
        period_benchmark_returns: list[float],
        period_allocations: list[float],
        period_selections: list[float],
        period_interactions: list[float],
    ) -> dict:
        """
        Carino (1999) logarithmic linking for multi-period attribution.
        """
        n = len(period_portfolio_returns)
        cum_port = 1.0
        cum_bench = 1.0
        for i in range(n):
            cum_port *= (1 + period_portfolio_returns[i])
            cum_bench *= (1 + period_benchmark_returns[i])

        total_port = cum_port - 1
        total_bench = cum_bench - 1

        log_total_port = math.log(1 + total_port) if total_port > -1 else 0
        total_active = total_port - total_bench

        linked_alloc = 0.0
        linked_select = 0.0
        linked_interact = 0.0

        for i in range(n):
            rp = period_portfolio_returns[i]
            rb = period_benchmark_returns[i]
            log_rp = math.log(1 + rp) if rp > -1 else 0
            log_rb = math.log(1 + rb) if rb > -1 else 0
            kt = (log_rp - log_rb) / (rp - rb) if abs(rp - rb) > 1e-10 else 1 / (1 + rp) if rp > -1 else 1
            k_total = log_total_port / total_active if abs(total_active) > 1e-10 else 1

            link_factor = kt / k_total if abs(k_total) > 1e-10 else 1

            linked_alloc += period_allocations[i] * link_factor
            linked_select += period_selections[i] * link_factor
            linked_interact += period_interactions[i] * link_factor

        return {
            "linked_allocation": round(linked_alloc, 6),
            "linked_selection": round(linked_select, 6),
            "linked_interaction": round(linked_interact, 6),
            "total_active_return": round(total_active, 6),
            "cumulative_portfolio_return": round(total_port, 6),
            "cumulative_benchmark_return": round(total_bench, 6),
        }

    @staticmethod
    def menchero_linking(
        period_portfolio_returns: list[float],
        period_benchmark_returns: list[float],
        period_allocations: list[float],
        period_selections: list[float],
    ) -> dict:
        """Menchero (2000) smoothing approach for multi-period linking."""
        n = len(period_portfolio_returns)
        cum_port = 1.0
        cum_bench = 1.0
        for i in range(n):
            cum_port *= (1 + period_portfolio_returns[i])
            cum_bench *= (1 + period_benchmark_returns[i])

        total_port = cum_port - 1
        total_bench = cum_bench - 1
        total_active = total_port - total_bench

        # Compounding factors
        cum_port_before = [1.0]
        cum_bench_before = [1.0]
        for i in range(n):
            cum_port_before.append(cum_port_before[-1] * (1 + period_portfolio_returns[i]))
            cum_bench_before.append(cum_bench_before[-1] * (1 + period_benchmark_returns[i]))

        linked_alloc = 0.0
        linked_select = 0.0

        for i in range(n):
            # Geometric compounding factor
            factor = cum_port_before[i] * (cum_port / cum_port_before[i + 1]) if cum_port_before[i + 1] != 0 else 1
            linked_alloc += period_allocations[i] * factor
            linked_select += period_selections[i] * factor

        residual = total_active - (linked_alloc + linked_select)

        return {
            "linked_allocation": round(linked_alloc, 6),
            "linked_selection": round(linked_select, 6),
            "residual": round(residual, 6),
            "total_active_return": round(total_active, 6),
        }


# ── Factor-Based Attribution ─────────────────────────────────────────

class FactorAttribution:
    @staticmethod
    def factor_decomposition(
        portfolio_returns: list[float],
        factor_returns: dict[str, list[float]],
    ) -> FactorAttributionResult:
        """Multi-factor return decomposition via OLS."""
        n = len(portfolio_returns)
        factor_names = list(factor_returns.keys())
        k = len(factor_names)

        if n < k + 2:
            return FactorAttributionResult(
                factor_returns={},
                factor_contributions={},
                specific_return=0.0,
                r_squared=0.0,
                tracking_error=0.0,
            )

        # Build X matrix (n x k)
        X = [[factor_returns[f][i] for f in factor_names] for i in range(n)]
        y = portfolio_returns[:n]

        # OLS: beta = (X'X)^-1 X'y
        # For simplicity, use gradient descent
        betas = [0.0] * k
        alpha = 0.0
        lr = 0.01

        for _ in range(2000):
            for i in range(n):
                pred = alpha + sum(betas[j] * X[i][j] for j in range(k))
                error = y[i] - pred
                alpha += lr * error / n
                for j in range(k):
                    betas[j] += lr * error * X[i][j] / n

        # Calculate R-squared
        y_mean = statistics.mean(y)
        ss_tot = sum((y[i] - y_mean) ** 2 for i in range(n))
        residuals = [y[i] - (alpha + sum(betas[j] * X[i][j] for j in range(k))) for i in range(n)]
        ss_res = sum(r ** 2 for r in residuals)
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0

        # Factor contributions
        factor_means = {f: statistics.mean(factor_returns[f][:n]) for f in factor_names}
        contributions = {f: betas[j] * factor_means[f] for j, f in enumerate(factor_names)}

        # Tracking error from residuals
        te = statistics.stdev(residuals) * math.sqrt(252) if len(residuals) > 1 else 0

        return FactorAttributionResult(
            factor_returns={f: betas[j] for j, f in enumerate(factor_names)},
            factor_contributions=contributions,
            specific_return=alpha,
            r_squared=r_squared,
            tracking_error=te,
        )


# ── Risk Attribution ──────────────────────────────────────────────────

class RiskAttribution:
    @staticmethod
    def marginal_contribution_to_risk(
        weights: list[float],
        covariance_matrix: list[list[float]],
    ) -> dict:
        n = len(weights)
        # Portfolio variance: w' * Cov * w
        cov_w = [sum(covariance_matrix[i][j] * weights[j] for j in range(n)) for i in range(n)]
        port_var = sum(weights[i] * cov_w[i] for i in range(n))
        port_vol = math.sqrt(port_var) if port_var > 0 else 0

        # Marginal risk: (Cov * w) / sigma_p
        marginal = [cov_w[i] / port_vol if port_vol > 0 else 0 for i in range(n)]

        # Component risk: w_i * marginal_i
        component = [weights[i] * marginal[i] for i in range(n)]

        # Percentage contribution
        total_component = sum(component)
        pct_contribution = [c / total_component if total_component > 0 else 0 for c in component]

        return {
            "portfolio_volatility": round(port_vol, 6),
            "marginal_risk": [round(m, 6) for m in marginal],
            "component_risk": [round(c, 6) for c in component],
            "pct_contribution": [round(p, 4) for p in pct_contribution],
        }

    @staticmethod
    def tracking_error_decomposition(
        active_weights: list[float],
        covariance_matrix: list[list[float]],
        factor_exposures: list[list[float]] | None = None,
    ) -> dict:
        n = len(active_weights)
        cov_w = [sum(covariance_matrix[i][j] * active_weights[j] for j in range(n)) for i in range(n)]
        te_squared = sum(active_weights[i] * cov_w[i] for i in range(n))
        te = math.sqrt(te_squared) if te_squared > 0 else 0

        # Component TE
        component_te = [active_weights[i] * cov_w[i] / te if te > 0 else 0 for i in range(n)]

        return {
            "tracking_error": round(te * math.sqrt(252), 6),
            "tracking_error_squared": round(te_squared, 8),
            "component_tracking_error": [round(c, 6) for c in component_te],
        }


# ── Currency Attribution ──────────────────────────────────────────────

class CurrencyAttribution:
    @staticmethod
    def karnosky_singer(
        local_weights: list[float],
        benchmark_weights: list[float],
        local_returns: list[float],
        benchmark_returns: list[float],
        currency_returns: list[float],
        forward_premiums: list[float],
    ) -> dict:
        """
        Karnosky-Singer currency attribution.
        Decomposes active return into local, currency allocation, and forward premium components.
        """
        n = len(local_weights)

        # Portfolio and benchmark total local returns
        port_local = sum(local_weights[i] * local_returns[i] for i in range(n))
        bench_local = sum(benchmark_weights[i] * benchmark_returns[i] for i in range(n))

        # Currency return contribution
        port_currency = sum(local_weights[i] * currency_returns[i] for i in range(n))
        bench_currency = sum(benchmark_weights[i] * currency_returns[i] for i in range(n))

        # Forward premium contribution
        port_forward = sum(local_weights[i] * forward_premiums[i] for i in range(n))
        bench_forward = sum(benchmark_weights[i] * forward_premiums[i] for i in range(n))

        local_active = port_local - bench_local
        currency_active = port_currency - bench_currency
        forward_active = port_forward - bench_forward

        details = []
        for i in range(n):
            details.append({
                "local_allocation": round((local_weights[i] - benchmark_weights[i]) * benchmark_returns[i], 6),
                "local_selection": round(benchmark_weights[i] * (local_returns[i] - benchmark_returns[i]), 6),
                "currency_effect": round((local_weights[i] - benchmark_weights[i]) * currency_returns[i], 6),
            })

        return {
            "local_active_return": round(local_active, 6),
            "currency_active_return": round(currency_active, 6),
            "forward_premium_active": round(forward_active, 6),
            "total_active_return": round(local_active + currency_active, 6),
            "details": details,
        }


# ── Fixed Income Attribution ─────────────────────────────────────────

class FixedIncomeAttribution:
    @staticmethod
    def campisi_attribution(
        portfolio_yield: float,
        benchmark_yield: float,
        portfolio_duration: float,
        benchmark_duration: float,
        yield_curve_shift: float,
        spread_change: float,
        coupon_return_port: float,
        coupon_return_bench: float,
    ) -> dict:
        """
        Campisi fixed income attribution model.
        Decomposes into income, Treasury, and spread components.
        """
        income_effect = coupon_return_port - coupon_return_bench

        # Treasury effect: -duration * yield_curve_shift
        port_treasury = -portfolio_duration * yield_curve_shift
        bench_treasury = -benchmark_duration * yield_curve_shift
        treasury_effect = port_treasury - bench_treasury

        # Spread effect: -duration * spread_change
        port_spread = -portfolio_duration * spread_change
        bench_spread = -benchmark_duration * spread_change
        spread_effect = port_spread - bench_spread

        # Duration effect (from duration mismatch)
        duration_effect = -(portfolio_duration - benchmark_duration) * yield_curve_shift

        return {
            "income_effect": round(income_effect, 6),
            "treasury_effect": round(treasury_effect, 6),
            "spread_effect": round(spread_effect, 6),
            "duration_effect": round(duration_effect, 6),
            "total_active": round(income_effect + treasury_effect + spread_effect, 6),
            "portfolio_treasury_return": round(port_treasury, 6),
            "benchmark_treasury_return": round(bench_treasury, 6),
        }

    @staticmethod
    def yield_curve_attribution(
        key_rate_durations_port: list[float],
        key_rate_durations_bench: list[float],
        key_rate_changes: list[float],
        tenors: list[float],
    ) -> dict:
        """Key rate duration-based attribution."""
        n = min(len(key_rate_durations_port), len(key_rate_durations_bench), len(key_rate_changes))

        details = []
        total_port_return = 0.0
        total_bench_return = 0.0

        for i in range(n):
            port_ret = -key_rate_durations_port[i] * key_rate_changes[i]
            bench_ret = -key_rate_durations_bench[i] * key_rate_changes[i]
            active = port_ret - bench_ret

            total_port_return += port_ret
            total_bench_return += bench_ret

            details.append({
                "tenor": tenors[i] if i < len(tenors) else i,
                "portfolio_krd": round(key_rate_durations_port[i], 4),
                "benchmark_krd": round(key_rate_durations_bench[i], 4),
                "rate_change": round(key_rate_changes[i], 4),
                "portfolio_return": round(port_ret, 6),
                "benchmark_return": round(bench_ret, 6),
                "active_return": round(active, 6),
            })

        return {
            "total_portfolio_curve_return": round(total_port_return, 6),
            "total_benchmark_curve_return": round(total_bench_return, 6),
            "total_active_curve_return": round(total_port_return - total_bench_return, 6),
            "key_rate_details": details,
        }


# ── Transaction Cost Analysis ─────────────────────────────────────────

class TransactionCostAnalysis:
    @staticmethod
    def implementation_shortfall(
        decision_price: float,
        execution_price: float,
        benchmark_close: float,
        shares_ordered: float,
        shares_executed: float,
        commission_per_share: float = 0.0,
    ) -> dict:
        """
        Implementation shortfall (Perold, 1988).
        Paper return vs actual portfolio return.
        """
        # Explicit costs
        explicit_cost = shares_executed * commission_per_share

        # Delay cost
        delay_cost = shares_ordered * (execution_price - decision_price) - explicit_cost

        # Market impact
        market_impact = shares_executed * (execution_price - decision_price)

        # Opportunity cost (unexecuted portion)
        unexecuted = shares_ordered - shares_executed
        opportunity_cost = unexecuted * (benchmark_close - decision_price) if unexecuted > 0 else 0

        # Total IS
        total_is = explicit_cost + delay_cost + market_impact + opportunity_cost
        is_bps = (total_is / (shares_ordered * decision_price)) * 10000 if shares_ordered * decision_price > 0 else 0

        return {
            "explicit_cost": round(explicit_cost, 2),
            "delay_cost": round(delay_cost, 2),
            "market_impact": round(market_impact, 2),
            "opportunity_cost": round(opportunity_cost, 2),
            "total_implementation_shortfall": round(total_is, 2),
            "implementation_shortfall_bps": round(is_bps, 2),
            "execution_rate": round(shares_executed / shares_ordered if shares_ordered > 0 else 0, 4),
        }

    @staticmethod
    def vwap_benchmark(
        execution_prices: list[float],
        execution_quantities: list[float],
        market_vwap: float,
    ) -> dict:
        total_qty = sum(execution_quantities)
        if total_qty <= 0:
            return {"execution_vwap": 0, "market_vwap": market_vwap, "slippage": 0}

        exec_vwap = sum(p * q for p, q in zip(execution_prices, execution_quantities)) / total_qty
        slippage = exec_vwap - market_vwap
        slippage_bps = (slippage / market_vwap) * 10000 if market_vwap > 0 else 0

        return {
            "execution_vwap": round(exec_vwap, 6),
            "market_vwap": round(market_vwap, 6),
            "slippage": round(slippage, 6),
            "slippage_bps": round(slippage_bps, 2),
            "total_quantity": round(total_qty, 4),
            "num_fills": len(execution_prices),
        }

    @staticmethod
    def cost_breakdown(
        trades: list[dict],
    ) -> dict:
        """
        Analyze trading costs across multiple trades.
        Each trade: {price, quantity, commission, market_price, side}
        """
        total_explicit = 0.0
        total_implicit = 0.0
        total_notional = 0.0

        for t in trades:
            price = t.get("price", 0)
            qty = t.get("quantity", 0)
            commission = t.get("commission", 0)
            market_price = t.get("market_price", price)
            side = t.get("side", "buy")

            notional = price * qty
            total_notional += notional
            total_explicit += commission

            if side == "buy":
                total_implicit += (price - market_price) * qty
            else:
                total_implicit += (market_price - price) * qty

        total_cost = total_explicit + total_implicit

        return {
            "total_explicit_costs": round(total_explicit, 2),
            "total_implicit_costs": round(total_implicit, 2),
            "total_costs": round(total_cost, 2),
            "total_notional": round(total_notional, 2),
            "cost_bps": round(total_cost / total_notional * 10000 if total_notional > 0 else 0, 2),
            "explicit_bps": round(total_explicit / total_notional * 10000 if total_notional > 0 else 0, 2),
            "implicit_bps": round(total_implicit / total_notional * 10000 if total_notional > 0 else 0, 2),
            "num_trades": len(trades),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class PerformanceAttributionEngine:
    def __init__(self) -> None:
        self.brinson = BrinsonAttribution()
        self.multi_period = MultiPeriodAttribution()
        self.factor = FactorAttribution()
        self.risk = RiskAttribution()
        self.currency = CurrencyAttribution()
        self.fixed_income = FixedIncomeAttribution()
        self.tca = TransactionCostAnalysis()

    def brinson_attribution(
        self,
        holdings: list[HoldingWeight],
        method: str = "brinson_fachler",
    ) -> dict:
        if method == "brinson_hood_beebower":
            result = self.brinson.brinson_hood_beebower(holdings)
        else:
            result = self.brinson.brinson_fachler(holdings)
        return result.to_dict()

    def factor_attribution(
        self,
        portfolio_returns: list[float],
        factor_returns: dict[str, list[float]],
    ) -> dict:
        result = self.factor.factor_decomposition(portfolio_returns, factor_returns)
        return result.to_dict()

    def risk_attribution(
        self,
        weights: list[float],
        covariance_matrix: list[list[float]],
    ) -> dict:
        return self.risk.marginal_contribution_to_risk(weights, covariance_matrix)

    def currency_attribution(self, **kwargs) -> dict:
        return self.currency.karnosky_singer(**kwargs)

    def fi_attribution(self, **kwargs) -> dict:
        return self.fixed_income.campisi_attribution(**kwargs)

    def implementation_shortfall(self, **kwargs) -> dict:
        return self.tca.implementation_shortfall(**kwargs)

    def vwap_analysis(self, **kwargs) -> dict:
        return self.tca.vwap_benchmark(**kwargs)

    def capabilities(self) -> dict:
        return {
            "engine": "PerformanceAttributionEngine",
            "version": "1.0.0",
            "features": [
                "brinson_fachler_attribution",
                "brinson_hood_beebower_attribution",
                "multi_period_carino_linking",
                "multi_period_menchero_linking",
                "factor_based_attribution",
                "risk_attribution (marginal/component)",
                "tracking_error_decomposition",
                "currency_attribution (Karnosky-Singer)",
                "fixed_income_attribution (Campisi)",
                "yield_curve_key_rate_attribution",
                "transaction_cost_analysis",
                "implementation_shortfall",
                "VWAP_benchmark_analysis",
            ],
        }
