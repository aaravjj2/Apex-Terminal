"""
Risk Factor Engine — Fama-French factor models, CAPM extensions, factor analysis,
principal component analysis, Barra-style risk models, stress testing,
factor attribution, risk budgeting.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class FactorModelType(str, Enum):
    CAPM = "capm"
    FAMA_FRENCH_3 = "fama_french_3"
    FAMA_FRENCH_5 = "fama_french_5"
    CARHART_4 = "carhart_4"
    CUSTOM = "custom"
    PCA = "pca"


class StressScenario(str, Enum):
    MARKET_CRASH_2008 = "market_crash_2008"
    DOT_COM_BUST = "dot_com_bust"
    COVID_2020 = "covid_2020"
    RATE_HIKE = "rate_hike"
    INFLATION_SHOCK = "inflation_shock"
    CURRENCY_CRISIS = "currency_crisis"
    CREDIT_CRISIS = "credit_crisis"
    CUSTOM = "custom"


@dataclass
class FactorExposure:
    factor_name: str
    beta: float
    t_statistic: float = 0.0
    p_value: float = 0.0
    confidence_interval: Tuple[float, float] = (0.0, 0.0)

    def to_dict(self) -> dict:
        return {
            "factor": self.factor_name,
            "beta": round(self.beta, 6),
            "t_statistic": round(self.t_statistic, 4),
            "p_value": round(self.p_value, 4),
            "ci_lower": round(self.confidence_interval[0], 6),
            "ci_upper": round(self.confidence_interval[1], 6),
        }


@dataclass
class FactorModelResult:
    model_type: str
    alpha: float
    r_squared: float
    adj_r_squared: float
    factor_exposures: list[FactorExposure]
    residual_volatility: float = 0.0
    systematic_risk_pct: float = 0.0

    def to_dict(self) -> dict:
        return {
            "model_type": self.model_type,
            "alpha": round(self.alpha, 6),
            "r_squared": round(self.r_squared, 4),
            "adj_r_squared": round(self.adj_r_squared, 4),
            "factor_exposures": [f.to_dict() for f in self.factor_exposures],
            "residual_volatility": round(self.residual_volatility, 6),
            "systematic_risk_pct": round(self.systematic_risk_pct, 4),
        }


@dataclass
class StressTestResult:
    scenario: str
    portfolio_impact: float
    factor_contributions: Dict[str, float]
    worst_case: float
    recovery_estimate_days: int = 0

    def to_dict(self) -> dict:
        return {
            "scenario": self.scenario,
            "portfolio_impact": round(self.portfolio_impact, 4),
            "factor_contributions": {k: round(v, 4) for k, v in self.factor_contributions.items()},
            "worst_case": round(self.worst_case, 4),
            "recovery_estimate_days": self.recovery_estimate_days,
        }


@dataclass
class PCAResult:
    explained_variance: list[float]
    explained_variance_ratio: list[float]
    cumulative_variance_ratio: list[float]
    components: list[list[float]]
    n_components: int = 0

    def to_dict(self) -> dict:
        return {
            "explained_variance": [round(v, 6) for v in self.explained_variance],
            "explained_variance_ratio": [round(v, 4) for v in self.explained_variance_ratio],
            "cumulative_variance_ratio": [round(v, 4) for v in self.cumulative_variance_ratio],
            "n_components": self.n_components,
        }


# ── Regression Utilities ──────────────────────────────────────────────

class RegressionUtils:
    @staticmethod
    def simple_regression(y: list[float], x: list[float]) -> dict:
        n = min(len(y), len(x))
        if n < 3:
            return {"alpha": 0, "beta": 0, "r_squared": 0, "std_error": 0, "t_stat": 0}

        x_mean = statistics.mean(x[:n])
        y_mean = statistics.mean(y[:n])

        ss_xy = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        ss_xx = sum((x[i] - x_mean) ** 2 for i in range(n))
        ss_yy = sum((y[i] - y_mean) ** 2 for i in range(n))

        beta = ss_xy / ss_xx if ss_xx > 0 else 0
        alpha = y_mean - beta * x_mean

        predicted = [alpha + beta * x[i] for i in range(n)]
        ss_res = sum((y[i] - predicted[i]) ** 2 for i in range(n))

        r_squared = 1 - ss_res / ss_yy if ss_yy > 0 else 0
        std_error = math.sqrt(ss_res / (n - 2)) if n > 2 else 0
        se_beta = std_error / math.sqrt(ss_xx) if ss_xx > 0 else 0
        t_stat = beta / se_beta if se_beta > 0 else 0

        return {
            "alpha": alpha, "beta": beta, "r_squared": r_squared,
            "std_error": std_error, "t_stat": t_stat, "se_beta": se_beta,
            "residuals": [y[i] - predicted[i] for i in range(n)],
        }

    @staticmethod
    def multiple_regression(
        y: list[float],
        X: Dict[str, list[float]],
    ) -> dict:
        """Simplified multiple regression using iterative approach."""
        factors = sorted(X.keys())
        n = min(len(y), *(len(X[f]) for f in factors))
        k = len(factors)

        if n < k + 2:
            return {"alpha": 0, "betas": {f: 0 for f in factors}, "r_squared": 0}

        # Initialize with simple regressions
        betas = {}
        for f in factors:
            reg = RegressionUtils.simple_regression(y[:n], X[f][:n])
            betas[f] = reg["beta"] / k

        y_mean = statistics.mean(y[:n])
        alpha = y_mean

        # Iterative refinement (simplified gradient descent)
        learning_rate = 0.0001
        for _ in range(500):
            predictions = []
            for i in range(n):
                pred = alpha + sum(betas[f] * X[f][i] for f in factors)
                predictions.append(pred)

            # Update
            for f in factors:
                grad = -2 / n * sum(
                    (y[i] - predictions[i]) * X[f][i] for i in range(n)
                )
                betas[f] -= learning_rate * grad

            grad_alpha = -2 / n * sum(y[i] - predictions[i] for i in range(n))
            alpha -= learning_rate * grad_alpha

        # Final metrics
        predictions = [alpha + sum(betas[f] * X[f][i] for f in factors) for i in range(n)]
        ss_res = sum((y[i] - predictions[i]) ** 2 for i in range(n))
        ss_tot = sum((y[i] - y_mean) ** 2 for i in range(n))
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0
        adj_r_sq = 1 - (1 - r_squared) * (n - 1) / (n - k - 1) if n > k + 1 else r_squared
        residual_std = math.sqrt(ss_res / (n - k - 1)) if n > k + 1 else 0

        # T-statistics
        exposures = []
        for f in factors:
            x_vals = X[f][:n]
            ss_x = sum((x - statistics.mean(x_vals)) ** 2 for x in x_vals)
            se = residual_std / math.sqrt(ss_x) if ss_x > 0 else 0
            t = betas[f] / se if se > 0 else 0
            exposures.append(FactorExposure(
                factor_name=f, beta=betas[f], t_statistic=t,
                confidence_interval=(betas[f] - 1.96 * se, betas[f] + 1.96 * se),
            ))

        return {
            "alpha": alpha, "betas": betas, "r_squared": r_squared,
            "adj_r_squared": adj_r_sq, "residual_std": residual_std,
            "exposures": exposures,
            "residuals": [y[i] - predictions[i] for i in range(n)],
        }


# ── CAPM Model ────────────────────────────────────────────────────────

class CAPMModel:
    @staticmethod
    def fit(
        asset_returns: list[float],
        market_returns: list[float],
        risk_free_rate: float = 0.0,
    ) -> FactorModelResult:
        n = min(len(asset_returns), len(market_returns))
        excess_asset = [asset_returns[i] - risk_free_rate / 252 for i in range(n)]
        excess_market = [market_returns[i] - risk_free_rate / 252 for i in range(n)]

        reg = RegressionUtils.simple_regression(excess_asset, excess_market)

        exposure = FactorExposure(
            factor_name="market",
            beta=reg["beta"],
            t_statistic=reg["t_stat"],
            confidence_interval=(reg["beta"] - 1.96 * reg.get("se_beta", 0),
                                 reg["beta"] + 1.96 * reg.get("se_beta", 0)),
        )

        residuals = reg.get("residuals", [])
        residual_vol = statistics.stdev(residuals) * math.sqrt(252) if len(residuals) > 1 else 0
        total_vol = statistics.stdev(excess_asset) * math.sqrt(252) if len(excess_asset) > 1 else 0
        systematic = 1 - (residual_vol / total_vol) ** 2 if total_vol > 0 else 0

        return FactorModelResult(
            model_type="capm",
            alpha=reg["alpha"] * 252,
            r_squared=reg["r_squared"],
            adj_r_squared=reg["r_squared"],
            factor_exposures=[exposure],
            residual_volatility=residual_vol,
            systematic_risk_pct=max(0, systematic),
        )

    @staticmethod
    def expected_return(
        beta: float,
        risk_free_rate: float,
        market_premium: float,
    ) -> float:
        return risk_free_rate + beta * market_premium

    @staticmethod
    def security_market_line(
        betas: list[float],
        risk_free_rate: float,
        market_premium: float,
    ) -> list[dict]:
        return [
            {"beta": round(b, 4), "expected_return": round(risk_free_rate + b * market_premium, 6)}
            for b in betas
        ]


# ── Fama-French Models ────────────────────────────────────────────────

class FamaFrenchModel:
    @staticmethod
    def fit_3_factor(
        asset_returns: list[float],
        market_returns: list[float],
        smb_returns: list[float],
        hml_returns: list[float],
        risk_free_rate: float = 0.0,
    ) -> FactorModelResult:
        n = min(len(asset_returns), len(market_returns), len(smb_returns), len(hml_returns))
        excess = [asset_returns[i] - risk_free_rate / 252 for i in range(n)]

        factors = {
            "market": [market_returns[i] - risk_free_rate / 252 for i in range(n)],
            "smb": smb_returns[:n],
            "hml": hml_returns[:n],
        }

        result = RegressionUtils.multiple_regression(excess, factors)

        return FactorModelResult(
            model_type="fama_french_3",
            alpha=result["alpha"] * 252,
            r_squared=result["r_squared"],
            adj_r_squared=result.get("adj_r_squared", result["r_squared"]),
            factor_exposures=result.get("exposures", []),
            residual_volatility=result.get("residual_std", 0) * math.sqrt(252),
        )

    @staticmethod
    def fit_5_factor(
        asset_returns: list[float],
        market_returns: list[float],
        smb_returns: list[float],
        hml_returns: list[float],
        rmw_returns: list[float],
        cma_returns: list[float],
        risk_free_rate: float = 0.0,
    ) -> FactorModelResult:
        n = min(len(asset_returns), len(market_returns), len(smb_returns),
                len(hml_returns), len(rmw_returns), len(cma_returns))
        excess = [asset_returns[i] - risk_free_rate / 252 for i in range(n)]

        factors = {
            "market": [market_returns[i] - risk_free_rate / 252 for i in range(n)],
            "smb": smb_returns[:n],
            "hml": hml_returns[:n],
            "rmw": rmw_returns[:n],
            "cma": cma_returns[:n],
        }

        result = RegressionUtils.multiple_regression(excess, factors)

        return FactorModelResult(
            model_type="fama_french_5",
            alpha=result["alpha"] * 252,
            r_squared=result["r_squared"],
            adj_r_squared=result.get("adj_r_squared", result["r_squared"]),
            factor_exposures=result.get("exposures", []),
            residual_volatility=result.get("residual_std", 0) * math.sqrt(252),
        )


class CarhartModel:
    @staticmethod
    def fit(
        asset_returns: list[float],
        market_returns: list[float],
        smb_returns: list[float],
        hml_returns: list[float],
        mom_returns: list[float],
        risk_free_rate: float = 0.0,
    ) -> FactorModelResult:
        n = min(len(asset_returns), len(market_returns), len(smb_returns),
                len(hml_returns), len(mom_returns))
        excess = [asset_returns[i] - risk_free_rate / 252 for i in range(n)]

        factors = {
            "market": [market_returns[i] - risk_free_rate / 252 for i in range(n)],
            "smb": smb_returns[:n],
            "hml": hml_returns[:n],
            "momentum": mom_returns[:n],
        }

        result = RegressionUtils.multiple_regression(excess, factors)

        return FactorModelResult(
            model_type="carhart_4",
            alpha=result["alpha"] * 252,
            r_squared=result["r_squared"],
            adj_r_squared=result.get("adj_r_squared", result["r_squared"]),
            factor_exposures=result.get("exposures", []),
            residual_volatility=result.get("residual_std", 0) * math.sqrt(252),
        )


# ── Principal Component Analysis ──────────────────────────────────────

class PCAEngine:
    """Simplified PCA via power iteration."""

    @staticmethod
    def fit(
        returns_dict: Dict[str, list[float]],
        n_components: int = 3,
    ) -> PCAResult:
        symbols = sorted(returns_dict.keys())
        n_assets = len(symbols)
        min_len = min(len(returns_dict[s]) for s in symbols)

        # Standardize
        data = []
        for s in symbols:
            r = returns_dict[s][:min_len]
            m = statistics.mean(r)
            std = statistics.stdev(r) if len(r) > 1 else 1.0
            data.append([(v - m) / std if std > 0 else 0 for v in r])

        # Covariance matrix
        cov = [[0.0] * n_assets for _ in range(n_assets)]
        for i in range(n_assets):
            for j in range(i, n_assets):
                c = sum(data[i][k] * data[j][k] for k in range(min_len)) / (min_len - 1)
                cov[i][j] = c
                cov[j][i] = c

        total_var = sum(cov[i][i] for i in range(n_assets))

        # Power iteration for eigenvalues
        explained_variance = []
        components = []
        remaining_cov = [row[:] for row in cov]

        for _ in range(min(n_components, n_assets)):
            # Random initial vector
            random.seed(42 + len(components))
            v = [random.gauss(0, 1) for _ in range(n_assets)]
            norm = math.sqrt(sum(x ** 2 for x in v))
            v = [x / norm for x in v]

            # Power iteration
            for _ in range(100):
                # Matrix-vector product
                new_v = [0.0] * n_assets
                for i in range(n_assets):
                    for j in range(n_assets):
                        new_v[i] += remaining_cov[i][j] * v[j]

                # Eigenvalue estimate
                eigenvalue = sum(new_v[i] * v[i] for i in range(n_assets))

                # Normalize
                norm = math.sqrt(sum(x ** 2 for x in new_v))
                if norm > 0:
                    v = [x / norm for x in new_v]

            eigenvalue = max(eigenvalue, 0)
            explained_variance.append(eigenvalue)
            components.append(v[:])

            # Deflate
            for i in range(n_assets):
                for j in range(n_assets):
                    remaining_cov[i][j] -= eigenvalue * v[i] * v[j]

        ratio = [ev / total_var for ev in explained_variance] if total_var > 0 else [0] * len(explained_variance)
        cumulative = []
        cum = 0
        for r in ratio:
            cum += r
            cumulative.append(cum)

        return PCAResult(
            explained_variance=explained_variance,
            explained_variance_ratio=ratio,
            cumulative_variance_ratio=cumulative,
            components=components,
            n_components=len(components),
        )


# ── Stress Testing ───────────────────────────────────────────────────

class StressTestingEngine:
    """Portfolio stress testing under various scenarios."""

    SCENARIO_SHOCKS = {
        StressScenario.MARKET_CRASH_2008: {
            "market": -0.40, "smb": -0.15, "hml": 0.05,
            "credit": -0.30, "volatility": 0.80,
        },
        StressScenario.DOT_COM_BUST: {
            "market": -0.35, "smb": 0.10, "hml": 0.25,
            "credit": -0.10, "volatility": 0.50,
        },
        StressScenario.COVID_2020: {
            "market": -0.34, "smb": -0.20, "hml": -0.15,
            "credit": -0.25, "volatility": 0.60,
        },
        StressScenario.RATE_HIKE: {
            "market": -0.10, "smb": 0.02, "hml": 0.08,
            "duration": -0.20, "credit": -0.05,
        },
        StressScenario.INFLATION_SHOCK: {
            "market": -0.15, "smb": -0.05, "hml": 0.10,
            "real_assets": 0.15, "bonds": -0.20,
        },
        StressScenario.CURRENCY_CRISIS: {
            "market": -0.20, "smb": -0.10, "hml": 0.00,
            "fx": -0.30, "emerging": -0.35,
        },
        StressScenario.CREDIT_CRISIS: {
            "market": -0.25, "smb": -0.20, "hml": -0.10,
            "credit": -0.40, "liquidity": -0.50,
        },
    }

    @staticmethod
    def run_scenario(
        portfolio_betas: Dict[str, float],
        scenario: str,
        custom_shocks: Dict[str, float] = None,
    ) -> StressTestResult:
        if scenario == "custom" and custom_shocks:
            shocks = custom_shocks
        else:
            try:
                shocks = StressTestingEngine.SCENARIO_SHOCKS.get(
                    StressScenario(scenario),
                    {"market": -0.20}
                )
            except ValueError:
                shocks = {"market": -0.20}

        impact = 0.0
        contributions = {}
        for factor, beta in portfolio_betas.items():
            shock = shocks.get(factor, 0.0)
            contrib = beta * shock
            contributions[factor] = contrib
            impact += contrib

        # Worst case with volatility amplification
        vol_shock = shocks.get("volatility", 0.3)
        worst_case = impact * (1 + vol_shock)

        # Rough recovery estimate
        recovery = int(abs(impact) * 500) if impact < -0.05 else 0

        return StressTestResult(
            scenario=scenario,
            portfolio_impact=impact,
            factor_contributions=contributions,
            worst_case=worst_case,
            recovery_estimate_days=recovery,
        )

    @staticmethod
    def run_all_scenarios(
        portfolio_betas: Dict[str, float],
    ) -> list[StressTestResult]:
        results = []
        for scenario in StressScenario:
            if scenario == StressScenario.CUSTOM:
                continue
            result = StressTestingEngine.run_scenario(portfolio_betas, scenario.value)
            results.append(result)
        return results

    @staticmethod
    def monte_carlo_stress(
        portfolio_betas: Dict[str, float],
        factor_volatilities: Dict[str, float],
        n_scenarios: int = 10000,
        horizon_days: int = 21,
        seed: int = 42,
    ) -> dict:
        random.seed(seed)
        pnl_distribution = []

        for _ in range(n_scenarios):
            total_pnl = 0.0
            for factor, beta in portfolio_betas.items():
                vol = factor_volatilities.get(factor, 0.01)
                shock = random.gauss(0, vol * math.sqrt(horizon_days / 252))
                total_pnl += beta * shock
            pnl_distribution.append(total_pnl)

        pnl_distribution.sort()
        n = len(pnl_distribution)

        return {
            "mean": round(statistics.mean(pnl_distribution), 6),
            "std": round(statistics.stdev(pnl_distribution), 6),
            "var_95": round(pnl_distribution[int(0.05 * n)], 6),
            "var_99": round(pnl_distribution[int(0.01 * n)], 6),
            "cvar_95": round(statistics.mean(pnl_distribution[:int(0.05 * n)]), 6),
            "cvar_99": round(statistics.mean(pnl_distribution[:int(0.01 * n)]), 6),
            "best_case": round(pnl_distribution[-1], 6),
            "worst_case": round(pnl_distribution[0], 6),
            "percentile_1": round(pnl_distribution[int(0.01 * n)], 6),
            "percentile_5": round(pnl_distribution[int(0.05 * n)], 6),
            "percentile_25": round(pnl_distribution[int(0.25 * n)], 6),
            "percentile_75": round(pnl_distribution[int(0.75 * n)], 6),
            "percentile_95": round(pnl_distribution[int(0.95 * n)], 6),
            "percentile_99": round(pnl_distribution[int(0.99 * n)], 6),
        }


# ── Risk Budgeting ───────────────────────────────────────────────────

class RiskBudgeting:
    @staticmethod
    def factor_risk_budget(
        weights: Dict[str, float],
        factor_betas: Dict[str, Dict[str, float]],
        factor_volatilities: Dict[str, float],
    ) -> dict:
        factors = set()
        for betas in factor_betas.values():
            factors.update(betas.keys())

        factor_contributions = {}
        total_risk = 0.0

        for factor in factors:
            port_exposure = sum(
                weights.get(asset, 0) * factor_betas.get(asset, {}).get(factor, 0)
                for asset in weights
            )
            factor_vol = factor_volatilities.get(factor, 0.01)
            risk_contrib = abs(port_exposure) * factor_vol
            factor_contributions[factor] = risk_contrib
            total_risk += risk_contrib

        risk_budget = {
            f: round(c / total_risk, 4) if total_risk > 0 else 0
            for f, c in factor_contributions.items()
        }

        return {
            "factor_contributions": {f: round(c, 6) for f, c in factor_contributions.items()},
            "risk_budget": risk_budget,
            "total_factor_risk": round(total_risk, 6),
        }

    @staticmethod
    def marginal_risk_contribution(
        weights: Dict[str, float],
        covariance: Dict[str, Dict[str, float]],
    ) -> dict:
        symbols = sorted(weights.keys())
        n = len(symbols)
        w = [weights[s] for s in symbols]

        port_var = 0.0
        for i in range(n):
            for j in range(n):
                cov_ij = covariance.get(symbols[i], {}).get(symbols[j], 0)
                port_var += w[i] * w[j] * cov_ij

        port_vol = math.sqrt(port_var) if port_var > 0 else 0.001

        mrc = {}
        rc = {}
        for i in range(n):
            marginal = sum(w[j] * covariance.get(symbols[i], {}).get(symbols[j], 0) for j in range(n))
            mrc[symbols[i]] = marginal / port_vol
            rc[symbols[i]] = w[i] * marginal / port_vol

        return {
            "marginal_risk": {k: round(v, 6) for k, v in mrc.items()},
            "risk_contribution": {k: round(v, 6) for k, v in rc.items()},
            "portfolio_volatility": round(port_vol, 6),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class RiskFactorEngine:
    def __init__(self) -> None:
        self.capm = CAPMModel()
        self.ff = FamaFrenchModel()
        self.carhart = CarhartModel()
        self.pca = PCAEngine()
        self.stress = StressTestingEngine()
        self.budget = RiskBudgeting()

    def fit_capm(self, asset_returns, market_returns, rf=0.0) -> dict:
        return self.capm.fit(asset_returns, market_returns, rf).to_dict()

    def fit_fama_french_3(self, asset_returns, market, smb, hml, rf=0.0) -> dict:
        return self.ff.fit_3_factor(asset_returns, market, smb, hml, rf).to_dict()

    def fit_fama_french_5(self, asset_returns, market, smb, hml, rmw, cma, rf=0.0) -> dict:
        return self.ff.fit_5_factor(asset_returns, market, smb, hml, rmw, cma, rf).to_dict()

    def fit_carhart(self, asset_returns, market, smb, hml, mom, rf=0.0) -> dict:
        return self.carhart.fit(asset_returns, market, smb, hml, mom, rf).to_dict()

    def pca_analysis(self, returns_dict, n_components=3) -> dict:
        return self.pca.fit(returns_dict, n_components).to_dict()

    def stress_test(self, betas, scenario="market_crash_2008", custom_shocks=None) -> dict:
        return self.stress.run_scenario(betas, scenario, custom_shocks).to_dict()

    def all_stress_tests(self, betas) -> list[dict]:
        return [r.to_dict() for r in self.stress.run_all_scenarios(betas)]

    def monte_carlo_risk(self, betas, factor_vols, n_scenarios=10000) -> dict:
        return self.stress.monte_carlo_stress(betas, factor_vols, n_scenarios)

    def risk_budget(self, weights, factor_betas, factor_vols) -> dict:
        return self.budget.factor_risk_budget(weights, factor_betas, factor_vols)

    def capabilities(self) -> dict:
        return {
            "engine": "RiskFactorEngine",
            "version": "1.0.0",
            "features": [
                "CAPM (single factor, SML)",
                "Fama-French 3-factor (market, SMB, HML)",
                "Fama-French 5-factor (+ RMW, CMA)",
                "Carhart 4-factor (+ momentum)",
                "PCA (principal component analysis)",
                "stress_testing (7 predefined + custom scenarios)",
                "monte_carlo_risk_simulation",
                "risk_budgeting (factor-based)",
                "marginal_risk_contribution",
                "factor_exposure_analysis",
            ],
        }
