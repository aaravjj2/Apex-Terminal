"""
Quantitative Risk Engine — Pure-Python portfolio risk analytics.
Historical VaR, parametric VaR, Monte Carlo VaR, CVaR, drawdown metrics,
Sharpe/Sortino/Calmar ratios, tail risk, correlation analysis, and scenario testing.
No numpy/scipy dependency — all native math.
"""
from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Tuple


# ═══════════════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════════════

class RiskLevel(str, Enum):
    MINIMAL = "minimal"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    EXTREME = "extreme"


class DrawdownPhase(str, Enum):
    PEAK = "peak"
    DRAWDOWN = "drawdown"
    RECOVERY = "recovery"


class TailRiskCategory(str, Enum):
    THIN_TAILED = "thin_tailed"
    NORMAL = "normal"
    FAT_TAILED = "fat_tailed"
    VERY_FAT_TAILED = "very_fat_tailed"


# ═══════════════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class PortfolioPosition:
    symbol: str
    weight: float       # decimal
    returns: list[float] = field(default_factory=list)
    sector: str = ""
    asset_class: str = "equity"

    @property
    def mean_return(self) -> float:
        return statistics.mean(self.returns) if self.returns else 0.0

    @property
    def volatility(self) -> float:
        if len(self.returns) < 2:
            return 0.0
        return statistics.stdev(self.returns)

    @property
    def annualized_return(self) -> float:
        return self.mean_return * 252

    @property
    def annualized_vol(self) -> float:
        return self.volatility * math.sqrt(252)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "weight": round(self.weight, 4),
            "mean_return": round(self.mean_return, 6),
            "volatility": round(self.volatility, 6),
            "ann_return": round(self.annualized_return, 4),
            "ann_vol": round(self.annualized_vol, 4),
        }


@dataclass
class DrawdownResult:
    max_drawdown: float
    max_drawdown_duration: int      # trading days
    current_drawdown: float
    peak_date_index: int
    trough_date_index: int
    recovery_date_index: int        # -1 if not recovered
    drawdown_series: list[float] = field(default_factory=list)


@dataclass
class VaRResult:
    var_95: float
    var_99: float
    cvar_95: float
    cvar_99: float
    method: str = "historical"

    def to_dict(self) -> dict:
        return {
            "var_95": round(self.var_95, 6),
            "var_99": round(self.var_99, 6),
            "cvar_95": round(self.cvar_95, 6),
            "cvar_99": round(self.cvar_99, 6),
            "method": self.method,
        }


# ═══════════════════════════════════════════════════════════════════════
# Historical VaR Calculator
# ═══════════════════════════════════════════════════════════════════════

class HistoricalVaR:
    """Value at Risk using historical simulation."""

    @staticmethod
    def calculate(returns: list[float], confidence: float = 0.95) -> float:
        """VaR at given confidence level. Returns positive number = loss."""
        if not returns:
            return 0.0
        sorted_rets = sorted(returns)
        index = int((1 - confidence) * len(sorted_rets))
        index = max(0, min(index, len(sorted_rets) - 1))
        return round(-sorted_rets[index], 6)

    @staticmethod
    def cvar(returns: list[float], confidence: float = 0.95) -> float:
        """Conditional VaR (Expected Shortfall)."""
        if not returns:
            return 0.0
        sorted_rets = sorted(returns)
        cutoff = int((1 - confidence) * len(sorted_rets))
        cutoff = max(1, cutoff)
        tail = sorted_rets[:cutoff]
        return round(-statistics.mean(tail), 6)

    @staticmethod
    def full_var(returns: list[float]) -> VaRResult:
        """Calculate VaR and CVaR at 95% and 99%."""
        return VaRResult(
            var_95=HistoricalVaR.calculate(returns, 0.95),
            var_99=HistoricalVaR.calculate(returns, 0.99),
            cvar_95=HistoricalVaR.cvar(returns, 0.95),
            cvar_99=HistoricalVaR.cvar(returns, 0.99),
            method="historical",
        )


# ═══════════════════════════════════════════════════════════════════════
# Parametric VaR Calculator
# ═══════════════════════════════════════════════════════════════════════

class ParametricVaR:
    """Gaussian VaR using mean and standard deviation."""

    Z_95 = 1.6449
    Z_99 = 2.3263

    @staticmethod
    def calculate(mean: float, std: float, confidence: float = 0.95) -> float:
        if std <= 0:
            return 0.0
        z = ParametricVaR.Z_99 if confidence >= 0.99 else ParametricVaR.Z_95
        return round(-(mean - z * std), 6)

    @staticmethod
    def portfolio_var(
        weights: list[float],
        means: list[float],
        stds: list[float],
        correlations: list[list[float]],
        confidence: float = 0.95,
    ) -> float:
        """Portfolio VaR from weights, means, stds, correlation matrix."""
        n = len(weights)
        if n == 0:
            return 0.0
        port_mean = sum(w * m for w, m in zip(weights, means))
        # Portfolio variance = w' * Sigma * w  where Sigma_ij = std_i * std_j * corr_ij
        port_var = 0.0
        for i in range(n):
            for j in range(n):
                port_var += weights[i] * weights[j] * stds[i] * stds[j] * correlations[i][j]
        port_std = math.sqrt(max(port_var, 0))
        return ParametricVaR.calculate(port_mean, port_std, confidence)


# ═══════════════════════════════════════════════════════════════════════
# Monte Carlo VaR
# ═══════════════════════════════════════════════════════════════════════

class MonteCarloVaR:
    """Monte Carlo simulation for VaR."""

    @staticmethod
    def simulate(
        mean: float,
        std: float,
        n_simulations: int = 10000,
        n_days: int = 1,
        seed: int = 42,
    ) -> list[float]:
        """Generate simulated returns."""
        rng = random.Random(seed)
        results = []
        for _ in range(n_simulations):
            total = 0.0
            for _ in range(n_days):
                total += mean + std * rng.gauss(0, 1)
            results.append(total)
        return results

    @staticmethod
    def var_from_simulations(simulations: list[float], confidence: float = 0.95) -> float:
        return HistoricalVaR.calculate(simulations, confidence)

    @staticmethod
    def full_mc_var(
        mean: float,
        std: float,
        n_simulations: int = 10000,
        seed: int = 42,
    ) -> VaRResult:
        sims = MonteCarloVaR.simulate(mean, std, n_simulations, seed=seed)
        return VaRResult(
            var_95=HistoricalVaR.calculate(sims, 0.95),
            var_99=HistoricalVaR.calculate(sims, 0.99),
            cvar_95=HistoricalVaR.cvar(sims, 0.95),
            cvar_99=HistoricalVaR.cvar(sims, 0.99),
            method="monte_carlo",
        )


# ═══════════════════════════════════════════════════════════════════════
# Drawdown Calculator
# ═══════════════════════════════════════════════════════════════════════

class DrawdownCalculator:
    """Maximum drawdown and underwater equity analysis."""

    @staticmethod
    def calculate(returns: list[float]) -> DrawdownResult:
        if not returns:
            return DrawdownResult(0.0, 0, 0.0, 0, 0, 0)

        # Cumulative wealth
        wealth = [1.0]
        for r in returns:
            wealth.append(wealth[-1] * (1 + r))

        peak = wealth[0]
        peak_idx = 0
        max_dd = 0.0
        max_dd_peak = 0
        max_dd_trough = 0
        current_dd = 0.0

        dd_series = []

        for i in range(len(wealth)):
            if wealth[i] > peak:
                peak = wealth[i]
                peak_idx = i
            dd = (peak - wealth[i]) / peak if peak > 0 else 0.0
            dd_series.append(round(dd, 6))
            if dd > max_dd:
                max_dd = dd
                max_dd_peak = peak_idx
                max_dd_trough = i
            current_dd = dd

        # Recovery
        recovery_idx = -1
        if max_dd_trough < len(wealth) - 1:
            trough_peak = wealth[max_dd_peak]
            for i in range(max_dd_trough, len(wealth)):
                if wealth[i] >= trough_peak:
                    recovery_idx = i
                    break

        duration = max_dd_trough - max_dd_peak

        return DrawdownResult(
            max_drawdown=round(max_dd, 6),
            max_drawdown_duration=duration,
            current_drawdown=round(current_dd, 6),
            peak_date_index=max_dd_peak,
            trough_date_index=max_dd_trough,
            recovery_date_index=recovery_idx,
            drawdown_series=dd_series,
        )

    @staticmethod
    def underwater_periods(returns: list[float], threshold: float = 0.05) -> list[dict]:
        """Find all drawdown periods exceeding threshold."""
        result = DrawdownCalculator.calculate(returns)
        periods = []
        in_dd = False
        start = 0

        for i, dd in enumerate(result.drawdown_series):
            if dd > threshold and not in_dd:
                in_dd = True
                start = i
            elif dd <= threshold and in_dd:
                in_dd = False
                periods.append({
                    "start": start,
                    "end": i,
                    "duration": i - start,
                    "max_depth": round(max(result.drawdown_series[start:i]), 6),
                })
        if in_dd:
            periods.append({
                "start": start,
                "end": len(result.drawdown_series) - 1,
                "duration": len(result.drawdown_series) - 1 - start,
                "max_depth": round(max(result.drawdown_series[start:]), 6),
            })
        return periods


# ═══════════════════════════════════════════════════════════════════════
# Performance Ratios
# ═══════════════════════════════════════════════════════════════════════

class PerformanceRatios:
    """Risk-adjusted performance metrics."""

    @staticmethod
    def sharpe_ratio(returns: list[float], risk_free_annual: float = 0.05) -> float:
        if len(returns) < 2:
            return 0.0
        mean_r = statistics.mean(returns)
        std_r = statistics.stdev(returns)
        if std_r == 0:
            return 0.0
        excess = mean_r - risk_free_annual / 252
        return round((excess * 252) / (std_r * math.sqrt(252)), 4)

    @staticmethod
    def sortino_ratio(returns: list[float], risk_free_annual: float = 0.05, mar: float = 0.0) -> float:
        if len(returns) < 2:
            return 0.0
        mean_r = statistics.mean(returns)
        downside = [r for r in returns if r < mar]
        if not downside:
            return 0.0
        downside_dev = math.sqrt(sum(r**2 for r in downside) / len(downside))
        if downside_dev == 0:
            return 0.0
        excess = mean_r - risk_free_annual / 252
        return round((excess * 252) / (downside_dev * math.sqrt(252)), 4)

    @staticmethod
    def calmar_ratio(returns: list[float], risk_free_annual: float = 0.05) -> float:
        if len(returns) < 2:
            return 0.0
        ann_return = statistics.mean(returns) * 252
        dd = DrawdownCalculator.calculate(returns)
        if dd.max_drawdown == 0:
            return 0.0
        return round((ann_return - risk_free_annual) / dd.max_drawdown, 4)

    @staticmethod
    def omega_ratio(returns: list[float], threshold: float = 0.0) -> float:
        gains = sum(r - threshold for r in returns if r > threshold)
        losses = sum(threshold - r for r in returns if r <= threshold)
        if losses == 0:
            return 0.0 if gains == 0 else float('inf')
        return round(gains / losses, 4)

    @staticmethod
    def information_ratio(
        portfolio_returns: list[float],
        benchmark_returns: list[float],
    ) -> float:
        if len(portfolio_returns) != len(benchmark_returns) or len(portfolio_returns) < 2:
            return 0.0
        active = [p - b for p, b in zip(portfolio_returns, benchmark_returns)]
        mean_active = statistics.mean(active)
        te = statistics.stdev(active)
        if te == 0:
            return 0.0
        return round(mean_active * 252 / (te * math.sqrt(252)), 4)

    @staticmethod
    def beta(portfolio_returns: list[float], benchmark_returns: list[float]) -> float:
        if len(portfolio_returns) != len(benchmark_returns) or len(portfolio_returns) < 2:
            return 0.0
        mean_p = statistics.mean(portfolio_returns)
        mean_b = statistics.mean(benchmark_returns)
        cov = sum((p - mean_p) * (b - mean_b) for p, b in zip(portfolio_returns, benchmark_returns))
        var_b = sum((b - mean_b)**2 for b in benchmark_returns)
        if var_b == 0:
            return 0.0
        return round(cov / var_b, 4)

    @staticmethod
    def alpha(portfolio_returns: list[float], benchmark_returns: list[float],
              risk_free_annual: float = 0.05) -> float:
        if len(portfolio_returns) < 2:
            return 0.0
        b = PerformanceRatios.beta(portfolio_returns, benchmark_returns)
        ann_p = statistics.mean(portfolio_returns) * 252
        ann_b = statistics.mean(benchmark_returns) * 252
        return round(ann_p - (risk_free_annual + b * (ann_b - risk_free_annual)), 4)

    @staticmethod
    def treynor_ratio(portfolio_returns: list[float], benchmark_returns: list[float],
                      risk_free_annual: float = 0.05) -> float:
        b = PerformanceRatios.beta(portfolio_returns, benchmark_returns)
        if b == 0:
            return 0.0
        ann_p = statistics.mean(portfolio_returns) * 252
        return round((ann_p - risk_free_annual) / b, 4)


# ═══════════════════════════════════════════════════════════════════════
# Tail Risk Analyzer
# ═══════════════════════════════════════════════════════════════════════

class TailRiskAnalyzer:
    """Analyze tail risk: skewness, kurtosis, tail ratio."""

    @staticmethod
    def skewness(returns: list[float]) -> float:
        n = len(returns)
        if n < 3:
            return 0.0
        mean = statistics.mean(returns)
        std = statistics.stdev(returns)
        if std == 0:
            return 0.0
        return round(sum(((r - mean) / std)**3 for r in returns) * n / ((n - 1) * (n - 2)), 4)

    @staticmethod
    def kurtosis(returns: list[float]) -> float:
        """Excess kurtosis (normal distribution = 0)."""
        n = len(returns)
        if n < 4:
            return 0.0
        mean = statistics.mean(returns)
        std = statistics.stdev(returns)
        if std == 0:
            return 0.0
        raw_kurt = sum(((r - mean) / std)**4 for r in returns) / n
        return round(raw_kurt - 3.0, 4)

    @staticmethod
    def tail_ratio(returns: list[float], percentile: float = 0.95) -> float:
        """Right tail / left tail ratio."""
        if not returns:
            return 1.0
        sorted_r = sorted(returns)
        n = len(sorted_r)
        high_idx = int(percentile * n)
        low_idx = int((1 - percentile) * n)
        right_tail = abs(sorted_r[min(high_idx, n - 1)])
        left_tail = abs(sorted_r[max(low_idx, 0)])
        if left_tail == 0:
            return 0.0
        return round(right_tail / left_tail, 4)

    @staticmethod
    def classify_tail_risk(returns: list[float]) -> dict:
        kurt = TailRiskAnalyzer.kurtosis(returns)
        skew = TailRiskAnalyzer.skewness(returns)

        if kurt > 3:
            category = TailRiskCategory.VERY_FAT_TAILED
        elif kurt > 1:
            category = TailRiskCategory.FAT_TAILED
        elif kurt > -0.5:
            category = TailRiskCategory.NORMAL
        else:
            category = TailRiskCategory.THIN_TAILED

        return {
            "kurtosis": kurt,
            "skewness": skew,
            "category": category.value,
            "left_tail_risk": skew < -0.5,
            "right_tail_risk": skew > 0.5,
        }


# ═══════════════════════════════════════════════════════════════════════
# Correlation Analysis (pure Python)
# ═══════════════════════════════════════════════════════════════════════

class CorrelationAnalysis:
    """Pairwise correlation, rolling correlation, diversification metrics."""

    @staticmethod
    def pearson(x: list[float], y: list[float]) -> float:
        n = min(len(x), len(y))
        if n < 2:
            return 0.0
        mx = statistics.mean(x[:n])
        my = statistics.mean(y[:n])
        cov = sum((x[i] - mx) * (y[i] - my) for i in range(n)) / (n - 1)
        sx = statistics.stdev(x[:n])
        sy = statistics.stdev(y[:n])
        if sx == 0 or sy == 0:
            return 0.0
        return round(cov / (sx * sy), 4)

    @staticmethod
    def correlation_matrix(assets: dict[str, list[float]]) -> dict[str, dict[str, float]]:
        """Full pairwise correlation matrix."""
        names = list(assets.keys())
        matrix = {}
        for i, name_i in enumerate(names):
            matrix[name_i] = {}
            for j, name_j in enumerate(names):
                if i == j:
                    matrix[name_i][name_j] = 1.0
                elif j < i:
                    matrix[name_i][name_j] = matrix[name_j][name_i]
                else:
                    matrix[name_i][name_j] = CorrelationAnalysis.pearson(
                        assets[name_i], assets[name_j]
                    )
        return matrix

    @staticmethod
    def rolling_correlation(
        x: list[float],
        y: list[float],
        window: int = 60,
    ) -> list[float]:
        n = min(len(x), len(y))
        if n < window:
            return []
        result = []
        for i in range(window, n + 1):
            r = CorrelationAnalysis.pearson(x[i - window:i], y[i - window:i])
            result.append(r)
        return result

    @staticmethod
    def diversification_ratio(weights: list[float], stds: list[float],
                              corr_matrix: list[list[float]]) -> float:
        """Diversification ratio = weighted avg vol / portfolio vol."""
        n = len(weights)
        if n == 0:
            return 0.0
        weighted_vol = sum(w * s for w, s in zip(weights, stds))
        port_var = 0.0
        for i in range(n):
            for j in range(n):
                port_var += weights[i] * weights[j] * stds[i] * stds[j] * corr_matrix[i][j]
        port_vol = math.sqrt(max(port_var, 0))
        if port_vol == 0:
            return 0.0
        return round(weighted_vol / port_vol, 4)


# ═══════════════════════════════════════════════════════════════════════
# Scenario Testing
# ═══════════════════════════════════════════════════════════════════════

class ScenarioTester:
    """Apply stress scenarios to portfolios."""

    HISTORICAL_SCENARIOS = {
        "gfc_2008": {"equities": -0.38, "bonds": 0.05, "commodities": -0.35, "fx": -0.10},
        "covid_2020": {"equities": -0.34, "bonds": 0.08, "commodities": -0.30, "fx": 0.05},
        "rate_shock_2022": {"equities": -0.20, "bonds": -0.15, "commodities": 0.10, "fx": 0.12},
        "taper_tantrum_2013": {"equities": -0.06, "bonds": -0.05, "commodities": -0.08, "fx": 0.03},
        "flash_crash_2010": {"equities": -0.10, "bonds": 0.02, "commodities": -0.05, "fx": 0.01},
        "dot_com_burst": {"equities": -0.45, "bonds": 0.10, "commodities": -0.10, "fx": -0.05},
    }

    @staticmethod
    def apply_scenario(
        positions: list[PortfolioPosition],
        scenario: dict[str, float],
    ) -> dict:
        """Apply scenario shocks to positions."""
        total_pnl = 0.0
        position_pnls = []
        for pos in positions:
            shock = scenario.get(pos.asset_class, 0.0)
            pnl = pos.weight * shock
            total_pnl += pnl
            position_pnls.append({
                "symbol": pos.symbol,
                "weight": pos.weight,
                "shock": shock,
                "pnl": round(pnl, 6),
            })

        return {
            "total_pnl": round(total_pnl, 6),
            "positions": position_pnls,
            "worst_hit": min(position_pnls, key=lambda p: p["pnl"])["symbol"] if position_pnls else "",
        }

    @staticmethod
    def all_historical_scenarios(positions: list[PortfolioPosition]) -> dict:
        results = {}
        for name, scenario in ScenarioTester.HISTORICAL_SCENARIOS.items():
            results[name] = ScenarioTester.apply_scenario(positions, scenario)
        return results

    @staticmethod
    def custom_scenario(
        positions: list[PortfolioPosition],
        shocks: dict[str, float],
    ) -> dict:
        return ScenarioTester.apply_scenario(positions, shocks)


# ═══════════════════════════════════════════════════════════════════════
# Risk Level Classifier
# ═══════════════════════════════════════════════════════════════════════

class RiskClassifier:
    """Classify portfolio risk level."""

    @staticmethod
    def classify(var_95: float, max_drawdown: float, volatility: float) -> dict:
        score = 0.0
        # VaR contribution
        if var_95 > 0.05:
            score += 40
        elif var_95 > 0.03:
            score += 25
        elif var_95 > 0.01:
            score += 10

        # Drawdown contribution
        if max_drawdown > 0.30:
            score += 35
        elif max_drawdown > 0.15:
            score += 20
        elif max_drawdown > 0.05:
            score += 10

        # Volatility contribution
        if volatility > 0.30:
            score += 25
        elif volatility > 0.15:
            score += 15
        elif volatility > 0.08:
            score += 5

        if score >= 70:
            level = RiskLevel.EXTREME
        elif score >= 50:
            level = RiskLevel.HIGH
        elif score >= 30:
            level = RiskLevel.MODERATE
        elif score >= 15:
            level = RiskLevel.LOW
        else:
            level = RiskLevel.MINIMAL

        return {
            "level": level.value,
            "score": round(score, 1),
            "var_contribution": round(var_95, 4),
            "drawdown_contribution": round(max_drawdown, 4),
            "volatility_contribution": round(volatility, 4),
        }


# ═══════════════════════════════════════════════════════════════════════
# Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class QuantitativeRiskEngine:
    """Top-level orchestrator for quantitative risk analytics."""

    def __init__(self):
        self.hist_var = HistoricalVaR()
        self.param_var = ParametricVaR()
        self.mc_var = MonteCarloVaR()
        self.drawdown = DrawdownCalculator()
        self.perf = PerformanceRatios()
        self.tail = TailRiskAnalyzer()
        self.corr = CorrelationAnalysis()
        self.scenario = ScenarioTester()
        self.classifier = RiskClassifier()

    def historical_var(self, returns: list[float]) -> dict:
        result = self.hist_var.full_var(returns)
        return result.to_dict()

    def parametric_var(self, mean: float, std: float) -> dict:
        return {
            "var_95": ParametricVaR.calculate(mean, std, 0.95),
            "var_99": ParametricVaR.calculate(mean, std, 0.99),
            "method": "parametric",
        }

    def monte_carlo_var(self, mean: float, std: float, n_sims: int = 10000) -> dict:
        result = self.mc_var.full_mc_var(mean, std, n_sims)
        return result.to_dict()

    def drawdown_analysis(self, returns: list[float]) -> dict:
        dd = self.drawdown.calculate(returns)
        return {
            "max_drawdown": dd.max_drawdown,
            "max_dd_duration": dd.max_drawdown_duration,
            "current_drawdown": dd.current_drawdown,
            "recovered": dd.recovery_date_index >= 0,
        }

    def performance_summary(self, returns: list[float], benchmark: list[float] = None) -> dict:
        result = {
            "sharpe": self.perf.sharpe_ratio(returns),
            "sortino": self.perf.sortino_ratio(returns),
            "calmar": self.perf.calmar_ratio(returns),
            "omega": self.perf.omega_ratio(returns),
        }
        if benchmark:
            result["information_ratio"] = self.perf.information_ratio(returns, benchmark)
            result["beta"] = self.perf.beta(returns, benchmark)
            result["alpha"] = self.perf.alpha(returns, benchmark)
            result["treynor"] = self.perf.treynor_ratio(returns, benchmark)
        return result

    def tail_risk(self, returns: list[float]) -> dict:
        return self.tail.classify_tail_risk(returns)

    def stress_test(self, positions: list[PortfolioPosition]) -> dict:
        return self.scenario.all_historical_scenarios(positions)

    def risk_classification(self, returns: list[float]) -> dict:
        var_result = self.hist_var.full_var(returns)
        dd = self.drawdown.calculate(returns)
        vol = statistics.stdev(returns) * math.sqrt(252) if len(returns) > 1 else 0.0
        return self.classifier.classify(var_result.var_95, dd.max_drawdown, vol)

    def full_risk_report(self, returns: list[float], benchmark: list[float] = None) -> dict:
        var_h = self.hist_var.full_var(returns)
        dd = self.drawdown.calculate(returns)
        vol = statistics.stdev(returns) * math.sqrt(252) if len(returns) > 1 else 0.0

        report = {
            "historical_var": var_h.to_dict(),
            "drawdown": {
                "max_drawdown": dd.max_drawdown,
                "duration": dd.max_drawdown_duration,
                "current": dd.current_drawdown,
            },
            "performance": self.performance_summary(returns, benchmark),
            "tail_risk": self.tail.classify_tail_risk(returns),
            "risk_level": self.classifier.classify(var_h.var_95, dd.max_drawdown, vol),
            "annualized_vol": round(vol, 4),
        }
        return report

    def capabilities(self) -> dict:
        return {
            "engine": "QuantitativeRiskEngine",
            "version": "1.0.0",
            "features": [
                "historical_var_95_99",
                "conditional_var_expected_shortfall",
                "parametric_gaussian_var",
                "portfolio_var_correlation_matrix",
                "monte_carlo_var_simulation",
                "maximum_drawdown_analysis",
                "underwater_period_detection",
                "sharpe_sortino_calmar_omega_ratios",
                "information_ratio_tracking_error",
                "beta_alpha_treynor",
                "tail_risk_skewness_kurtosis",
                "tail_ratio_classification",
                "pearson_correlation",
                "rolling_correlation",
                "correlation_matrix",
                "diversification_ratio",
                "historical_stress_scenarios",
                "custom_stress_scenarios",
                "risk_level_classification",
                "full_risk_report",
            ],
        }
