"""
Stress Testing Engine — VaR, CVaR, Expected Shortfall, Monte Carlo simulation,
historical scenario analysis, factor stress scenarios, tail risk decomposition,
drawdown analytics, correlation breakdown in crisis, and portfolio loss distribution.
Pure computation — no FastAPI dependencies.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import random


class VaRMethod(str, Enum):
    HISTORICAL = "historical"
    PARAMETRIC = "parametric"
    MONTE_CARLO = "monte_carlo"
    CORNISH_FISHER = "cornish_fisher"


class ScenarioType(str, Enum):
    HISTORICAL_CRISIS = "historical_crisis"
    FACTOR_SHOCK = "factor_shock"
    MACRO_SCENARIO = "macro_scenario"
    CUSTOM = "custom"


@dataclass
class HistoricalScenario:
    name: str
    scenario_type: ScenarioType
    equity_shock: float    # e.g., -0.30 for -30%
    bond_shock: float
    credit_shock: float
    fx_shock: float
    commodity_shock: float
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.scenario_type.value,
            "equity_shock": self.equity_shock,
            "bond_shock": self.bond_shock,
            "credit_shock": self.credit_shock,
            "fx_shock": self.fx_shock,
            "commodity_shock": self.commodity_shock,
            "description": self.description,
        }


HISTORICAL_SCENARIOS: list[HistoricalScenario] = [
    HistoricalScenario(
        "GFC_2008_09", ScenarioType.HISTORICAL_CRISIS,
        equity_shock=-0.55, bond_shock=0.08, credit_shock=-0.40,
        fx_shock=-0.15, commodity_shock=-0.60,
        description="Global Financial Crisis peak-to-trough"
    ),
    HistoricalScenario(
        "COVID_2020_Q1", ScenarioType.HISTORICAL_CRISIS,
        equity_shock=-0.34, bond_shock=0.06, credit_shock=-0.25,
        fx_shock=0.05, commodity_shock=-0.45,
        description="COVID-19 market crash Q1 2020"
    ),
    HistoricalScenario(
        "DOTCOM_2000_02", ScenarioType.HISTORICAL_CRISIS,
        equity_shock=-0.50, bond_shock=0.12, credit_shock=-0.15,
        fx_shock=-0.10, commodity_shock=0.05,
        description="Dot-com bubble burst"
    ),
    HistoricalScenario(
        "RUSSIA_1998", ScenarioType.HISTORICAL_CRISIS,
        equity_shock=-0.20, bond_shock=-0.15, credit_shock=-0.35,
        fx_shock=-0.25, commodity_shock=-0.20,
        description="Russian debt default/LTCM"
    ),
    HistoricalScenario(
        "FLASH_CRASH_2010", ScenarioType.HISTORICAL_CRISIS,
        equity_shock=-0.10, bond_shock=0.02, credit_shock=-0.05,
        fx_shock=0.02, commodity_shock=-0.08,
        description="Flash Crash May 6, 2010"
    ),
    HistoricalScenario(
        "EURO_CRISIS_2011", ScenarioType.HISTORICAL_CRISIS,
        equity_shock=-0.22, bond_shock=0.05, credit_shock=-0.18,
        fx_shock=-0.12, commodity_shock=-0.15,
        description="European sovereign debt crisis"
    ),
    HistoricalScenario(
        "RATE_SHOCK_2022", ScenarioType.MACRO_SCENARIO,
        equity_shock=-0.25, bond_shock=-0.18, credit_shock=-0.12,
        fx_shock=0.10, commodity_shock=0.30,
        description="Aggressive Fed rate hike cycle 2022"
    ),
    HistoricalScenario(
        "INFLATION_SHOCK", ScenarioType.MACRO_SCENARIO,
        equity_shock=-0.15, bond_shock=-0.25, credit_shock=-0.08,
        fx_shock=0.05, commodity_shock=0.40,
        description="Stagflation scenario"
    ),
]


# ── Value at Risk ─────────────────────────────────────────────────────

class VaRCalculator:
    """Multiple VaR methodologies with confidence levels."""

    @staticmethod
    def historical_var(returns: list[float], confidence: float = 0.95) -> float:
        """Historical simulation VaR: sort & take percentile."""
        if not returns:
            return 0.0
        sorted_rets = sorted(returns)
        idx = int((1 - confidence) * len(sorted_rets))
        return -sorted_rets[max(idx, 0)]

    @staticmethod
    def parametric_var(
        mean_return: float,
        volatility: float,
        confidence: float = 0.95,
        horizon: int = 1,
    ) -> float:
        """
        Parametric VaR under normality assumption.
        VaR = -(μ*T - z*σ*sqrt(T))
        """
        z_map = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326, 0.999: 3.090}
        z = z_map.get(confidence, 1.645)
        var = -(mean_return * horizon - z * volatility * math.sqrt(horizon))
        return max(var, 0.0)

    @staticmethod
    def cornish_fisher_var(
        returns: list[float],
        confidence: float = 0.95,
    ) -> float:
        """
        Cornish-Fisher expansion adjusts z-score for skewness/kurtosis.
        """
        if len(returns) < 4:
            return VaRCalculator.parametric_var(statistics.mean(returns), statistics.stdev(returns), confidence)

        mean_r = statistics.mean(returns)
        std_r = statistics.stdev(returns)
        if std_r == 0:
            return 0.0

        zscores = [(r - mean_r) / std_r for r in returns]
        skew = sum(z ** 3 for z in zscores) / len(zscores)
        excess_kurt = sum(z ** 4 for z in zscores) / len(zscores) - 3

        z_map = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326}
        z = z_map.get(confidence, 1.645)

        # Cornish-Fisher adjusted z
        z_cf = (z + (z ** 2 - 1) * skew / 6 +
                (z ** 3 - 3 * z) * excess_kurt / 24 -
                (2 * z ** 3 - 5 * z) * skew ** 2 / 36)

        var = -(mean_r - z_cf * std_r)
        return max(var, 0.0)

    @staticmethod
    def monte_carlo_var(
        mean_return: float,
        volatility: float,
        confidence: float = 0.95,
        n_simulations: int = 10000,
        seed: int = 42,
    ) -> float:
        """Monte Carlo VaR via random return simulation."""
        rng = random.Random(seed)
        simulated = []

        for _ in range(n_simulations):
            # Box-Muller transform
            u1 = max(rng.random(), 1e-10)
            u2 = rng.random()
            z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
            r = mean_return + volatility * z
            simulated.append(r)

        return VaRCalculator.historical_var(simulated, confidence)

    @staticmethod
    def rolling_var(
        returns: list[float],
        window: int = 252,
        confidence: float = 0.95,
    ) -> list[float]:
        """Rolling window VaR series."""
        result = []
        for i in range(len(returns)):
            start = max(0, i - window + 1)
            window_ret = returns[start: i + 1]
            if len(window_ret) < 5:
                result.append(0.0)
            else:
                result.append(VaRCalculator.historical_var(window_ret, confidence))
        return [round(v, 6) for v in result]


# ── Conditional VaR (Expected Shortfall) ─────────────────────────────

class CVaRCalculator:
    """Expected Shortfall (CVaR) — tail-risk beyond VaR."""

    @staticmethod
    def historical_cvar(returns: list[float], confidence: float = 0.95) -> float:
        """Average of losses in the tail beyond VaR."""
        if not returns:
            return 0.0
        sorted_rets = sorted(returns)
        idx = int((1 - confidence) * len(sorted_rets))
        tail = sorted_rets[: max(idx, 1)]
        if not tail:
            return 0.0
        return -statistics.mean(tail)

    @staticmethod
    def parametric_cvar(
        mean_return: float,
        volatility: float,
        confidence: float = 0.95,
    ) -> float:
        """Parametric CVaR under normality."""
        z_map = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326}
        z = z_map.get(confidence, 1.645)
        # ES = μ - σ * φ(z) / (1-α)
        phi_z = math.exp(-0.5 * z ** 2) / math.sqrt(2 * math.pi)
        es = -(mean_return - volatility * phi_z / (1 - confidence))
        return max(es, 0.0)

    @staticmethod
    def component_cvar(
        weights: list[float],
        returns_matrix: list[list[float]],
        confidence: float = 0.95,
    ) -> list[float]:
        """Component CVaR: each asset's marginal contribution to tail loss."""
        if not weights or not returns_matrix:
            return []

        n_obs = min(len(r) for r in returns_matrix)
        if n_obs == 0:
            return [0.0] * len(weights)

        # Portfolio returns
        port_rets = [
            sum(weights[i] * returns_matrix[i][t] for i in range(len(weights)))
            for t in range(n_obs)
        ]

        # Identify tail observations
        var_threshold = -VaRCalculator.historical_var(port_rets, confidence)
        tail_obs = [t for t, r in enumerate(port_rets) if r <= var_threshold]

        if not tail_obs:
            return [0.0] * len(weights)

        comp_cvar = []
        for i in range(len(weights)):
            asset_tail_avg = statistics.mean(returns_matrix[i][t] for t in tail_obs)
            comp_cvar.append(round(-weights[i] * asset_tail_avg, 6))

        return comp_cvar


# ── Drawdown Analytics ────────────────────────────────────────────────

class DrawdownAnalyzer:
    """Maximum drawdown, drawdown duration, recovery analysis."""

    @staticmethod
    def drawdown_series(returns: list[float]) -> list[float]:
        """Compute drawdown at each time step (0 to -max)."""
        if not returns:
            return []
        equity = [1.0]
        for r in returns:
            equity.append(equity[-1] * (1 + r))

        peak = equity[0]
        drawdowns = []
        for e in equity[1:]:
            if e >= peak:
                peak = e
                drawdowns.append(0.0)
            else:
                drawdowns.append((e - peak) / peak)

        return [round(d, 6) for d in drawdowns]

    @staticmethod
    def max_drawdown(returns: list[float]) -> dict:
        """Maximum drawdown with start/end index."""
        dd = DrawdownAnalyzer.drawdown_series(returns)
        if not dd:
            return {"max_drawdown": 0, "duration": 0}

        max_dd = min(dd)
        max_dd_idx = dd.index(max_dd)

        # Find start of drawdown
        peak_idx = 0
        running_max = 0
        for i, r in enumerate(returns[:max_dd_idx]):
            running_val = sum(returns[:i + 1])
            if running_val >= running_max:
                running_max = running_val
                peak_idx = i

        # Find recovery
        recovery_idx = None
        for i in range(max_dd_idx, len(dd)):
            if dd[i] >= 0:
                recovery_idx = i
                break

        duration = max_dd_idx - peak_idx
        recovery_days = (recovery_idx - max_dd_idx) if recovery_idx else None

        return {
            "max_drawdown": round(max_dd, 4),
            "peak_index": peak_idx,
            "trough_index": max_dd_idx,
            "recovery_index": recovery_idx,
            "drawdown_duration": duration,
            "recovery_duration": recovery_days,
            "still_in_drawdown": recovery_idx is None,
        }

    @staticmethod
    def calmar_ratio(returns: list[float], annualization: int = 252) -> float:
        """Annual return / max drawdown."""
        if not returns:
            return 0.0
        mean_daily = statistics.mean(returns)
        annual_ret = (1 + mean_daily) ** annualization - 1
        mdd_info = DrawdownAnalyzer.max_drawdown(returns)
        mdd = abs(mdd_info.get("max_drawdown", 0))
        if mdd == 0:
            return 0.0
        return round(annual_ret / mdd, 4)

    @staticmethod
    def underwater_curve(returns: list[float]) -> dict:
        """Time spent below previous peaks."""
        dd = DrawdownAnalyzer.drawdown_series(returns)
        if not dd:
            return {}
        days_underwater = sum(1 for d in dd if d < 0)
        pct_time_underwater = days_underwater / len(dd) if dd else 0
        avg_drawdown = statistics.mean(d for d in dd if d < 0) if any(d < 0 for d in dd) else 0

        return {
            "days_underwater": days_underwater,
            "pct_time_underwater": round(pct_time_underwater, 4),
            "avg_drawdown_when_negative": round(avg_drawdown, 4),
            "max_drawdown": round(min(dd), 4) if dd else 0,
        }


# ── Scenario Analysis ─────────────────────────────────────────────────

class ScenarioAnalyzer:
    """Apply historical and custom scenarios to portfolio."""

    @staticmethod
    def apply_scenario(
        portfolio_weights: dict[str, float],   # {"equities": 0.6, "bonds": 0.3, ...}
        scenario: HistoricalScenario,
    ) -> dict:
        """Apply scenario shocks to portfolio and estimate P&L."""
        asset_class_shocks = {
            "equities": scenario.equity_shock,
            "bonds": scenario.bond_shock,
            "credit": scenario.credit_shock,
            "fx": scenario.fx_shock,
            "commodities": scenario.commodity_shock,
        }

        total_pnl = 0.0
        contribution = {}
        for asset_class, weight in portfolio_weights.items():
            shock = asset_class_shocks.get(asset_class, 0)
            pnl = weight * shock
            contribution[asset_class] = round(pnl, 6)
            total_pnl += pnl

        return {
            "scenario": scenario.name,
            "total_pnl": round(total_pnl, 4),
            "pct_loss": round(total_pnl * 100, 2),
            "contributions": contribution,
            "description": scenario.description,
        }

    @staticmethod
    def batch_scenarios(
        portfolio_weights: dict[str, float],
        scenarios: list[HistoricalScenario] = None,
    ) -> list[dict]:
        """Run all historical scenarios."""
        scenarios = scenarios or HISTORICAL_SCENARIOS
        results = []
        for s in scenarios:
            res = ScenarioAnalyzer.apply_scenario(portfolio_weights, s)
            results.append(res)
        return sorted(results, key=lambda x: x["total_pnl"])

    @staticmethod
    def worst_case_scenario(
        portfolio_weights: dict[str, float],
        scenarios: list[HistoricalScenario] = None,
    ) -> dict:
        """Find the scenario that hurts the portfolio most."""
        results = ScenarioAnalyzer.batch_scenarios(portfolio_weights, scenarios)
        return results[0] if results else {}


# ── Loss Distribution ─────────────────────────────────────────────────

class LossDistributionAnalyzer:
    """Full loss distribution from Monte Carlo or historical simulation."""

    @staticmethod
    def simulate_portfolio_losses(
        weights: list[float],
        means: list[float],
        vols: list[float],
        correlations: list[list[float]],
        n_sims: int = 10000,
        seed: int = 42,
    ) -> list[float]:
        """Simulate correlated portfolio returns using Cholesky decomposition."""
        n = len(weights)
        if n == 0:
            return []

        # Simple correlation-based simulation (approximate Cholesky for small n)
        rng = random.Random(seed)
        losses = []

        for _ in range(n_sims):
            # Generate n correlated normals via factor approach
            common_factor = math.sqrt(-2 * math.log(max(rng.random(), 1e-10))) * math.cos(2 * math.pi * rng.random())
            idio_factors = [
                math.sqrt(-2 * math.log(max(rng.random(), 1e-10))) * math.cos(2 * math.pi * rng.random())
                for _ in range(n)
            ]

            port_return = 0.0
            for i in range(n):
                avg_corr = sum(correlations[i][j] for j in range(n)) / n if n > 0 else 0
                ri = avg_corr * common_factor + math.sqrt(max(1 - avg_corr ** 2, 0)) * idio_factors[i]
                asset_return = means[i] + vols[i] * ri
                port_return += weights[i] * asset_return

            losses.append(-port_return)  # Loss = negative return

        return sorted(losses)

    @staticmethod
    def loss_distribution_summary(losses: list[float]) -> dict:
        """Summary statistics of loss distribution."""
        if not losses:
            return {}
        n = len(losses)
        return {
            "mean_loss": round(statistics.mean(losses), 6),
            "std_loss": round(statistics.stdev(losses), 6) if n > 1 else 0,
            "var_95": round(losses[int(0.95 * n)], 6),
            "var_99": round(losses[int(0.99 * n)], 6),
            "cvar_95": round(statistics.mean(losses[int(0.95 * n):]), 6),
            "cvar_99": round(statistics.mean(losses[int(0.99 * n):]), 6),
            "max_loss": round(max(losses), 6),
            "skewness": _skewness(losses),
            "kurtosis": _excess_kurtosis(losses),
        }


def _skewness(x: list[float]) -> float:
    if len(x) < 3:
        return 0.0
    mean = statistics.mean(x)
    std = statistics.stdev(x)
    if std == 0:
        return 0.0
    return round(sum((v - mean) ** 3 for v in x) / (len(x) * std ** 3), 4)


def _excess_kurtosis(x: list[float]) -> float:
    if len(x) < 4:
        return 0.0
    mean = statistics.mean(x)
    std = statistics.stdev(x)
    if std == 0:
        return 0.0
    return round(sum((v - mean) ** 4 for v in x) / (len(x) * std ** 4) - 3, 4)


# ── Orchestrator ──────────────────────────────────────────────────────

class StressTestingEngine:
    """Top-level orchestrator for all stress testing operations."""

    def __init__(self):
        self.var_calc = VaRCalculator()
        self.cvar_calc = CVaRCalculator()
        self.drawdown = DrawdownAnalyzer()
        self.scenarios = ScenarioAnalyzer()
        self.loss_dist = LossDistributionAnalyzer()

    def var(
        self,
        returns: list[float],
        confidence: float = 0.95,
        method: VaRMethod = VaRMethod.HISTORICAL,
    ) -> float:
        if method == VaRMethod.HISTORICAL:
            return self.var_calc.historical_var(returns, confidence)
        elif method == VaRMethod.PARAMETRIC:
            mean, vol = statistics.mean(returns), statistics.stdev(returns)
            return self.var_calc.parametric_var(mean, vol, confidence)
        elif method == VaRMethod.CORNISH_FISHER:
            return self.var_calc.cornish_fisher_var(returns, confidence)
        elif method == VaRMethod.MONTE_CARLO:
            mean, vol = statistics.mean(returns), statistics.stdev(returns)
            return self.var_calc.monte_carlo_var(mean, vol, confidence)
        return 0.0

    def cvar(self, returns: list[float], confidence: float = 0.95) -> float:
        return self.cvar_calc.historical_cvar(returns, confidence)

    def full_var_suite(self, returns: list[float]) -> dict:
        if len(returns) < 5:
            return {}
        mean, vol = statistics.mean(returns), statistics.stdev(returns)
        return {
            "historical_var_95": round(self.var_calc.historical_var(returns, 0.95), 6),
            "historical_var_99": round(self.var_calc.historical_var(returns, 0.99), 6),
            "parametric_var_95": round(self.var_calc.parametric_var(mean, vol, 0.95), 6),
            "parametric_var_99": round(self.var_calc.parametric_var(mean, vol, 0.99), 6),
            "cvar_95": round(self.cvar_calc.historical_cvar(returns, 0.95), 6),
            "cvar_99": round(self.cvar_calc.historical_cvar(returns, 0.99), 6),
            "cornish_fisher_var_95": round(self.var_calc.cornish_fisher_var(returns, 0.95), 6),
        }

    def max_drawdown(self, returns: list[float]) -> dict:
        return self.drawdown.max_drawdown(returns)

    def calmar(self, returns: list[float]) -> float:
        return self.drawdown.calmar_ratio(returns)

    def scenario_analysis(
        self,
        portfolio_weights: dict[str, float],
        scenarios: list[HistoricalScenario] = None,
    ) -> list[dict]:
        return self.scenarios.batch_scenarios(portfolio_weights, scenarios)

    def worst_scenario(self, portfolio_weights: dict[str, float]) -> dict:
        return self.scenarios.worst_case_scenario(portfolio_weights)

    def monte_carlo_loss_dist(
        self,
        weights: list[float],
        means: list[float],
        vols: list[float],
        correlations: list[list[float]],
        n_sims: int = 100000,
    ) -> dict:
        losses = self.loss_dist.simulate_portfolio_losses(weights, means, vols, correlations, n_sims)
        return self.loss_dist.loss_distribution_summary(losses)

    def full_risk_report(self, returns: list[float], portfolio_weights: dict = None) -> dict:
        """Comprehensive risk report."""
        report = {}
        if returns:
            report["var_suite"] = self.full_var_suite(returns)
            report["drawdown"] = self.drawdown.max_drawdown(returns)
            report["underwater"] = self.drawdown.underwater_curve(returns)
            report["calmar_ratio"] = self.drawdown.calmar_ratio(returns)
        if portfolio_weights:
            report["scenario_analysis"] = self.scenarios.batch_scenarios(portfolio_weights)
        return report

    def capabilities(self) -> dict:
        return {
            "engine": "StressTestingEngine",
            "version": "1.0.0",
            "features": [
                "historical_var_95_99",
                "parametric_var_normality",
                "monte_carlo_var_simulation",
                "cornish_fisher_var_skew_kurt_adjusted",
                "historical_cvar_expected_shortfall",
                "parametric_cvar",
                "component_cvar_decomposition",
                "rolling_var_series",
                "maximum_drawdown_analysis",
                "drawdown_duration_recovery",
                "underwater_curve",
                "calmar_ratio",
                "historical_scenario_gfc_covid_dotcom",
                "custom_scenario_application",
                "batch_scenario_worst_case",
                "monte_carlo_loss_distribution",
                "skewness_kurtosis_tail_risk",
                "loss_distribution_statistics",
            ],
        }
