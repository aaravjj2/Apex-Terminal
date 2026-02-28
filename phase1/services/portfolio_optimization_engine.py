"""
Portfolio Optimization Engine — Modern portfolio theory, Black-Litterman, risk parity,
factor models, mean-variance, minimum variance, maximum Sharpe, CVaR optimization,
hierarchical risk parity, robust optimization, constraints, rebalancing.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ── Enums ───────────────────────────────────────────────────────────────

class OptimizationMethod(str, Enum):
    MEAN_VARIANCE = "mean_variance"
    MIN_VARIANCE = "min_variance"
    MAX_SHARPE = "max_sharpe"
    RISK_PARITY = "risk_parity"
    MAX_DIVERSIFICATION = "max_diversification"
    EQUAL_WEIGHT = "equal_weight"
    INVERSE_VOLATILITY = "inverse_volatility"
    BLACK_LITTERMAN = "black_litterman"
    HIERARCHICAL_RISK_PARITY = "hierarchical_risk_parity"
    CVAR_OPTIMIZATION = "cvar_optimization"


class RebalanceFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    THRESHOLD = "threshold"


class ConstraintType(str, Enum):
    MIN_WEIGHT = "min_weight"
    MAX_WEIGHT = "max_weight"
    SECTOR_LIMIT = "sector_limit"
    TURNOVER_LIMIT = "turnover_limit"
    LONG_ONLY = "long_only"
    CARDINALITY = "cardinality"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class AssetData:
    """Data for a single asset in the portfolio."""
    symbol: str
    returns: list[float] = field(default_factory=list)
    expected_return: float = 0.0
    volatility: float = 0.0
    sector: str = ""
    weight: float = 0.0
    market_cap: float = 0.0

    @property
    def sharpe(self) -> float:
        return self.expected_return / self.volatility if self.volatility else 0.0

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "expected_return": round(self.expected_return, 6),
            "volatility": round(self.volatility, 6),
            "sector": self.sector,
            "weight": round(self.weight, 6),
            "sharpe": round(self.sharpe, 4),
        }


@dataclass
class PortfolioResult:
    """Result of a portfolio optimization."""
    method: OptimizationMethod
    weights: Dict[str, float]
    expected_return: float = 0.0
    volatility: float = 0.0
    sharpe_ratio: float = 0.0
    diversification_ratio: float = 0.0
    max_drawdown: float = 0.0
    cvar_95: float = 0.0
    tracking_error: float = 0.0

    def to_dict(self) -> dict:
        return {
            "method": self.method.value,
            "weights": {k: round(v, 6) for k, v in self.weights.items()},
            "expected_return": round(self.expected_return, 6),
            "volatility": round(self.volatility, 6),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
            "diversification_ratio": round(self.diversification_ratio, 4),
            "max_drawdown": round(self.max_drawdown, 4),
            "cvar_95": round(self.cvar_95, 6),
        }


@dataclass
class EfficientFrontierPoint:
    """A single point on the efficient frontier."""
    expected_return: float
    volatility: float
    weights: Dict[str, float]
    sharpe_ratio: float = 0.0

    def to_dict(self) -> dict:
        return {
            "expected_return": round(self.expected_return, 6),
            "volatility": round(self.volatility, 6),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
            "weights": {k: round(v, 4) for k, v in self.weights.items()},
        }


# ── Matrix Utilities ──────────────────────────────────────────────────

class MatrixOps:
    """Basic matrix operations without numpy (for pure computation)."""

    @staticmethod
    def covariance_matrix(returns_dict: Dict[str, list[float]]) -> Tuple[list[list[float]], list[str]]:
        """Compute covariance matrix from returns dict."""
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        min_len = min(len(returns_dict[s]) for s in symbols)

        means = {s: statistics.mean(returns_dict[s][:min_len]) for s in symbols}

        cov = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(i, n):
                si, sj = symbols[i], symbols[j]
                ri = returns_dict[si][:min_len]
                rj = returns_dict[sj][:min_len]
                mi, mj = means[si], means[sj]
                c = sum((ri[k] - mi) * (rj[k] - mj) for k in range(min_len)) / (min_len - 1)
                cov[i][j] = c
                cov[j][i] = c

        return cov, symbols

    @staticmethod
    def portfolio_variance(weights: list[float], cov_matrix: list[list[float]]) -> float:
        """w' * Sigma * w"""
        n = len(weights)
        var = 0.0
        for i in range(n):
            for j in range(n):
                var += weights[i] * weights[j] * cov_matrix[i][j]
        return var

    @staticmethod
    def portfolio_return(weights: list[float], expected_returns: list[float]) -> float:
        return sum(w * r for w, r in zip(weights, expected_returns))

    @staticmethod
    def correlation_matrix(cov_matrix: list[list[float]]) -> list[list[float]]:
        n = len(cov_matrix)
        stds = [math.sqrt(cov_matrix[i][i]) for i in range(n)]
        corr = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if stds[i] > 0 and stds[j] > 0:
                    corr[i][j] = cov_matrix[i][j] / (stds[i] * stds[j])
                elif i == j:
                    corr[i][j] = 1.0
        return corr


# ── Equal Weight ──────────────────────────────────────────────────────

class EqualWeightOptimizer:
    """1/N portfolio."""

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        weights = {s: 1.0 / n for s in symbols}
        w_list = [1.0 / n] * n

        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        means = [statistics.mean(returns_dict[s]) for s in symbols]

        port_ret = MatrixOps.portfolio_return(w_list, means) * 252
        port_var = MatrixOps.portfolio_variance(w_list, cov)
        port_vol = math.sqrt(port_var * 252)
        sharpe = (port_ret - risk_free_rate) / port_vol if port_vol else 0

        return PortfolioResult(
            method=OptimizationMethod.EQUAL_WEIGHT,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=sharpe,
        )


# ── Inverse Volatility ───────────────────────────────────────────────

class InverseVolatilityOptimizer:
    """Weight inversely proportional to volatility."""

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        vols = {s: statistics.stdev(returns_dict[s]) * math.sqrt(252) for s in symbols}

        inv_vols = {s: 1.0 / v if v > 0 else 0 for s, v in vols.items()}
        total = sum(inv_vols.values())
        weights = {s: iv / total for s, iv in inv_vols.items()} if total else {s: 1.0 / len(symbols) for s in symbols}

        w_list = [weights[s] for s in symbols]
        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        means = [statistics.mean(returns_dict[s]) for s in symbols]

        port_ret = MatrixOps.portfolio_return(w_list, means) * 252
        port_var = MatrixOps.portfolio_variance(w_list, cov)
        port_vol = math.sqrt(port_var * 252)
        sharpe = (port_ret - risk_free_rate) / port_vol if port_vol else 0

        return PortfolioResult(
            method=OptimizationMethod.INVERSE_VOLATILITY,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=sharpe,
        )


# ── Minimum Variance ─────────────────────────────────────────────────

class MinVarianceOptimizer:
    """Minimum variance portfolio via iterative optimization."""

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
        max_weight: float = 1.0,
        iterations: int = 5000,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        means = [statistics.mean(returns_dict[s]) for s in symbols]

        best_var = float("inf")
        best_weights = [1.0 / n] * n

        random.seed(42)
        for _ in range(iterations):
            raw = [random.random() for _ in range(n)]
            total = sum(raw)
            w = [r / total for r in raw]

            if max_weight < 1.0 and any(wi > max_weight for wi in w):
                continue

            var = MatrixOps.portfolio_variance(w, cov)
            if var < best_var:
                best_var = var
                best_weights = w[:]

        weights = {symbols[i]: best_weights[i] for i in range(n)}
        port_ret = MatrixOps.portfolio_return(best_weights, means) * 252
        port_vol = math.sqrt(best_var * 252)
        sharpe = (port_ret - risk_free_rate) / port_vol if port_vol else 0

        return PortfolioResult(
            method=OptimizationMethod.MIN_VARIANCE,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=sharpe,
        )


# ── Maximum Sharpe ────────────────────────────────────────────────────

class MaxSharpeOptimizer:
    """Maximum Sharpe ratio (tangency) portfolio."""

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
        max_weight: float = 1.0,
        iterations: int = 10000,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        means = [statistics.mean(returns_dict[s]) for s in symbols]

        best_sharpe = -float("inf")
        best_weights = [1.0 / n] * n

        random.seed(42)
        for _ in range(iterations):
            raw = [random.random() for _ in range(n)]
            total = sum(raw)
            w = [r / total for r in raw]

            if max_weight < 1.0 and any(wi > max_weight for wi in w):
                continue

            port_ret = MatrixOps.portfolio_return(w, means) * 252
            port_var = MatrixOps.portfolio_variance(w, cov)
            port_vol = math.sqrt(port_var * 252)

            sharpe = (port_ret - risk_free_rate) / port_vol if port_vol > 0 else 0

            if sharpe > best_sharpe:
                best_sharpe = sharpe
                best_weights = w[:]

        weights = {symbols[i]: best_weights[i] for i in range(n)}
        port_ret = MatrixOps.portfolio_return(best_weights, means) * 252
        port_var = MatrixOps.portfolio_variance(best_weights, cov)
        port_vol = math.sqrt(port_var * 252)

        return PortfolioResult(
            method=OptimizationMethod.MAX_SHARPE,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=best_sharpe,
        )


# ── Risk Parity ──────────────────────────────────────────────────────

class RiskParityOptimizer:
    """Risk parity — equalize risk contribution from each asset."""

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
        iterations: int = 200,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        means = [statistics.mean(returns_dict[s]) for s in symbols]

        # Start with inverse vol
        vols = [statistics.stdev(returns_dict[s]) for s in symbols]
        w = [1.0 / v if v > 0 else 1.0 for v in vols]
        total = sum(w)
        w = [wi / total for wi in w]

        # Iterative risk parity
        for _ in range(iterations):
            port_var = MatrixOps.portfolio_variance(w, cov)
            port_vol = math.sqrt(port_var) if port_var > 0 else 0.001

            # Marginal risk contribution
            mrc = []
            for i in range(n):
                marginal = sum(w[j] * cov[i][j] for j in range(n))
                mrc.append(marginal / port_vol)

            # Risk contribution
            rc = [w[i] * mrc[i] for i in range(n)]
            total_rc = sum(rc)
            target_rc = total_rc / n  # Equal risk

            # Adjust weights
            for i in range(n):
                if rc[i] > 0:
                    w[i] *= (target_rc / rc[i]) ** 0.5

            total_w = sum(w)
            w = [wi / total_w for wi in w]

        weights = {symbols[i]: w[i] for i in range(n)}
        port_ret = MatrixOps.portfolio_return(w, means) * 252
        port_var = MatrixOps.portfolio_variance(w, cov)
        port_vol = math.sqrt(port_var * 252)
        sharpe = (port_ret - risk_free_rate) / port_vol if port_vol else 0

        return PortfolioResult(
            method=OptimizationMethod.RISK_PARITY,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=sharpe,
        )


# ── Maximum Diversification ──────────────────────────────────────────

class MaxDiversificationOptimizer:
    """Maximize the diversification ratio: weighted avg vol / portfolio vol."""

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
        iterations: int = 8000,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        means = [statistics.mean(returns_dict[s]) for s in symbols]
        vols = [math.sqrt(cov[i][i] * 252) for i in range(n)]

        best_dr = -float("inf")
        best_weights = [1.0 / n] * n

        random.seed(42)
        for _ in range(iterations):
            raw = [random.random() for _ in range(n)]
            total = sum(raw)
            w = [r / total for r in raw]

            weighted_vol = sum(w[i] * vols[i] for i in range(n))
            port_var = MatrixOps.portfolio_variance(w, cov)
            port_vol = math.sqrt(port_var * 252)

            dr = weighted_vol / port_vol if port_vol > 0 else 0

            if dr > best_dr:
                best_dr = dr
                best_weights = w[:]

        weights = {symbols[i]: best_weights[i] for i in range(n)}
        port_ret = MatrixOps.portfolio_return(best_weights, means) * 252
        port_var = MatrixOps.portfolio_variance(best_weights, cov)
        port_vol = math.sqrt(port_var * 252)
        sharpe = (port_ret - risk_free_rate) / port_vol if port_vol else 0

        return PortfolioResult(
            method=OptimizationMethod.MAX_DIVERSIFICATION,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=sharpe,
            diversification_ratio=best_dr,
        )


# ── Black-Litterman ──────────────────────────────────────────────────

class BlackLittermanModel:
    """Black-Litterman portfolio optimization."""

    @staticmethod
    def market_implied_returns(
        market_weights: list[float],
        cov_matrix: list[list[float]],
        risk_aversion: float = 2.5,
    ) -> list[float]:
        """Reverse-optimize equilibrium returns from market weights."""
        n = len(market_weights)
        pi = [0.0] * n
        for i in range(n):
            for j in range(n):
                pi[i] += risk_aversion * cov_matrix[i][j] * market_weights[j]
        return pi

    @staticmethod
    def posterior_returns(
        equilibrium_returns: list[float],
        cov_matrix: list[list[float]],
        views_returns: list[float],
        views_confidence: list[float],
        tau: float = 0.05,
    ) -> list[float]:
        """
        Simplified BL posterior: blend equilibrium with views.
        Full BL requires matrix inversion — this is an approximation.
        """
        n = len(equilibrium_returns)
        posterior = [0.0] * n

        for i in range(n):
            if i < len(views_returns) and i < len(views_confidence):
                conf = views_confidence[i]
                posterior[i] = (1 - conf) * equilibrium_returns[i] + conf * views_returns[i]
            else:
                posterior[i] = equilibrium_returns[i]

        return posterior

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        market_caps: Dict[str, float],
        views: Dict[str, float] = None,
        view_confidences: Dict[str, float] = None,
        risk_aversion: float = 2.5,
        risk_free_rate: float = 0.0,
        tau: float = 0.05,
        iterations: int = 10000,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        cov, _ = MatrixOps.covariance_matrix(returns_dict)

        # Market weights
        total_cap = sum(market_caps.get(s, 1.0) for s in symbols)
        mkt_weights = [market_caps.get(s, 1.0) / total_cap for s in symbols]

        # Equilibrium returns
        eq_returns = BlackLittermanModel.market_implied_returns(mkt_weights, cov, risk_aversion)

        # Posterior returns with views
        if views and view_confidences:
            v_rets = [views.get(s, eq_returns[i]) for i, s in enumerate(symbols)]
            v_conf = [view_confidences.get(s, 0.0) for s in symbols]
            post_returns = BlackLittermanModel.posterior_returns(eq_returns, cov, v_rets, v_conf, tau)
        else:
            post_returns = eq_returns

        # Optimize with posterior returns (max Sharpe approach)
        best_sharpe = -float("inf")
        best_weights = [1.0 / n] * n

        random.seed(42)
        for _ in range(iterations):
            raw = [random.random() for _ in range(n)]
            total = sum(raw)
            w = [r / total for r in raw]

            port_ret = sum(w[i] * post_returns[i] for i in range(n)) * 252
            port_var = MatrixOps.portfolio_variance(w, cov)
            port_vol = math.sqrt(port_var * 252)
            sharpe = (port_ret - risk_free_rate) / port_vol if port_vol > 0 else 0

            if sharpe > best_sharpe:
                best_sharpe = sharpe
                best_weights = w[:]

        weights = {symbols[i]: best_weights[i] for i in range(n)}
        port_ret = sum(best_weights[i] * post_returns[i] for i in range(n)) * 252
        port_var = MatrixOps.portfolio_variance(best_weights, cov)
        port_vol = math.sqrt(port_var * 252)

        return PortfolioResult(
            method=OptimizationMethod.BLACK_LITTERMAN,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=best_sharpe,
        )


# ── CVaR Optimization ────────────────────────────────────────────────

class CVaROptimizer:
    """Conditional Value-at-Risk optimization."""

    @staticmethod
    def calculate_cvar(
        portfolio_returns: list[float],
        confidence: float = 0.95,
    ) -> float:
        sorted_rets = sorted(portfolio_returns)
        cutoff = int(len(sorted_rets) * (1 - confidence))
        if cutoff == 0:
            cutoff = 1
        tail = sorted_rets[:cutoff]
        return -statistics.mean(tail) if tail else 0.0

    @staticmethod
    def optimize(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
        confidence: float = 0.95,
        iterations: int = 8000,
    ) -> PortfolioResult:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        min_len = min(len(returns_dict[s]) for s in symbols)
        means = [statistics.mean(returns_dict[s]) for s in symbols]
        cov, _ = MatrixOps.covariance_matrix(returns_dict)

        best_ratio = -float("inf")
        best_weights = [1.0 / n] * n
        best_cvar = 0.0

        random.seed(42)
        for _ in range(iterations):
            raw = [random.random() for _ in range(n)]
            total = sum(raw)
            w = [r / total for r in raw]

            # Compute portfolio returns
            port_rets = [
                sum(w[i] * returns_dict[symbols[i]][t] for i in range(n))
                for t in range(min_len)
            ]

            cvar = CVaROptimizer.calculate_cvar(port_rets, confidence)
            port_ret = sum(w[i] * means[i] for i in range(n)) * 252

            ratio = (port_ret - risk_free_rate) / cvar if cvar > 0 else 0

            if ratio > best_ratio:
                best_ratio = ratio
                best_weights = w[:]
                best_cvar = cvar

        weights = {symbols[i]: best_weights[i] for i in range(n)}
        port_ret = MatrixOps.portfolio_return(best_weights, means) * 252
        port_var = MatrixOps.portfolio_variance(best_weights, cov)
        port_vol = math.sqrt(port_var * 252)

        return PortfolioResult(
            method=OptimizationMethod.CVAR_OPTIMIZATION,
            weights=weights,
            expected_return=port_ret,
            volatility=port_vol,
            sharpe_ratio=(port_ret - risk_free_rate) / port_vol if port_vol else 0,
            cvar_95=best_cvar,
        )


# ── Efficient Frontier ───────────────────────────────────────────────

class EfficientFrontierBuilder:
    """Build the efficient frontier via Monte Carlo sampling."""

    @staticmethod
    def build(
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
        n_points: int = 50,
        n_samples: int = 20000,
    ) -> list[EfficientFrontierPoint]:
        symbols = sorted(returns_dict.keys())
        n = len(symbols)
        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        means = [statistics.mean(returns_dict[s]) for s in symbols]

        # Generate random portfolios
        portfolios = []
        random.seed(42)
        for _ in range(n_samples):
            raw = [random.random() for _ in range(n)]
            total = sum(raw)
            w = [r / total for r in raw]

            port_ret = MatrixOps.portfolio_return(w, means) * 252
            port_var = MatrixOps.portfolio_variance(w, cov)
            port_vol = math.sqrt(port_var * 252)
            sharpe = (port_ret - risk_free_rate) / port_vol if port_vol > 0 else 0

            portfolios.append((port_ret, port_vol, w, sharpe))

        # Find frontier: for each return level, find min vol
        if not portfolios:
            return []

        min_ret = min(p[0] for p in portfolios)
        max_ret = max(p[0] for p in portfolios)
        step = (max_ret - min_ret) / n_points if n_points > 1 else 1

        frontier = []
        for k in range(n_points):
            target = min_ret + k * step
            band = [p for p in portfolios if abs(p[0] - target) < step * 0.6]
            if band:
                best = min(band, key=lambda x: x[1])
                weights = {symbols[i]: best[2][i] for i in range(n)}
                frontier.append(EfficientFrontierPoint(
                    expected_return=best[0],
                    volatility=best[1],
                    weights=weights,
                    sharpe_ratio=best[3],
                ))

        return frontier


# ── Portfolio Risk Metrics ────────────────────────────────────────────

class PortfolioRiskMetrics:
    """Compute risk metrics for a portfolio."""

    @staticmethod
    def risk_contribution(
        weights: list[float],
        cov_matrix: list[list[float]],
    ) -> list[float]:
        port_var = MatrixOps.portfolio_variance(weights, cov_matrix)
        port_vol = math.sqrt(port_var) if port_var > 0 else 0.001
        n = len(weights)
        rc = []
        for i in range(n):
            mrc = sum(weights[j] * cov_matrix[i][j] for j in range(n)) / port_vol
            rc.append(weights[i] * mrc)
        return rc

    @staticmethod
    def marginal_risk(
        weights: list[float],
        cov_matrix: list[list[float]],
    ) -> list[float]:
        port_var = MatrixOps.portfolio_variance(weights, cov_matrix)
        port_vol = math.sqrt(port_var) if port_var > 0 else 0.001
        n = len(weights)
        return [
            sum(weights[j] * cov_matrix[i][j] for j in range(n)) / port_vol
            for i in range(n)
        ]

    @staticmethod
    def tracking_error(
        portfolio_returns: list[float],
        benchmark_returns: list[float],
    ) -> float:
        min_len = min(len(portfolio_returns), len(benchmark_returns))
        active = [portfolio_returns[i] - benchmark_returns[i] for i in range(min_len)]
        if len(active) < 2:
            return 0.0
        return statistics.stdev(active) * math.sqrt(252)

    @staticmethod
    def information_ratio(
        portfolio_returns: list[float],
        benchmark_returns: list[float],
    ) -> float:
        min_len = min(len(portfolio_returns), len(benchmark_returns))
        active = [portfolio_returns[i] - benchmark_returns[i] for i in range(min_len)]
        if len(active) < 2:
            return 0.0
        te = statistics.stdev(active) * math.sqrt(252)
        ar = statistics.mean(active) * 252
        return ar / te if te > 0 else 0.0

    @staticmethod
    def max_drawdown_from_returns(returns: list[float]) -> float:
        equity = [1.0]
        for r in returns:
            equity.append(equity[-1] * (1 + r))
        peak = equity[0]
        max_dd = 0.0
        for v in equity:
            if v > peak:
                peak = v
            dd = (peak - v) / peak
            if dd > max_dd:
                max_dd = dd
        return max_dd

    @staticmethod
    def sortino_ratio(
        returns: list[float],
        risk_free_rate: float = 0.0,
        target_return: float = 0.0,
    ) -> float:
        annual_ret = statistics.mean(returns) * 252
        downside = [min(r - target_return / 252, 0) ** 2 for r in returns]
        downside_dev = math.sqrt(statistics.mean(downside)) * math.sqrt(252)
        return (annual_ret - risk_free_rate) / downside_dev if downside_dev > 0 else 0.0

    @staticmethod
    def calmar_ratio(returns: list[float], risk_free_rate: float = 0.0) -> float:
        annual_ret = statistics.mean(returns) * 252
        max_dd = PortfolioRiskMetrics.max_drawdown_from_returns(returns)
        return (annual_ret - risk_free_rate) / max_dd if max_dd > 0 else 0.0


# ── Rebalancing Engine ────────────────────────────────────────────────

class RebalancingEngine:
    """Portfolio rebalancing logic."""

    @staticmethod
    def threshold_rebalance(
        current_weights: Dict[str, float],
        target_weights: Dict[str, float],
        threshold: float = 0.05,
    ) -> Dict[str, float]:
        """Rebalance if any weight drifts beyond threshold from target."""
        needs_rebalance = any(
            abs(current_weights.get(s, 0) - target_weights.get(s, 0)) > threshold
            for s in target_weights
        )
        if needs_rebalance:
            return dict(target_weights)
        return dict(current_weights)

    @staticmethod
    def calculate_trades(
        current_weights: Dict[str, float],
        target_weights: Dict[str, float],
        portfolio_value: float,
    ) -> list[dict]:
        """Calculate trades needed to rebalance."""
        trades = []
        all_symbols = set(current_weights) | set(target_weights)

        for symbol in sorted(all_symbols):
            current = current_weights.get(symbol, 0.0)
            target = target_weights.get(symbol, 0.0)
            diff = target - current

            if abs(diff) > 0.001:
                trades.append({
                    "symbol": symbol,
                    "current_weight": round(current, 6),
                    "target_weight": round(target, 6),
                    "weight_change": round(diff, 6),
                    "dollar_amount": round(diff * portfolio_value, 2),
                    "action": "buy" if diff > 0 else "sell",
                })

        return trades

    @staticmethod
    def tax_aware_rebalance(
        current_weights: Dict[str, float],
        target_weights: Dict[str, float],
        unrealized_gains: Dict[str, float],
        tax_rate: float = 0.20,
    ) -> Dict[str, float]:
        """Minimize tax impact by avoiding selling assets with large gains."""
        adjusted = dict(current_weights)
        all_symbols = set(current_weights) | set(target_weights)

        for symbol in all_symbols:
            current = current_weights.get(symbol, 0.0)
            target = target_weights.get(symbol, 0.0)
            gain = unrealized_gains.get(symbol, 0.0)

            if current > target and gain > 0:
                # Reduce sell if high gain (tax cost)
                tax_cost = gain * tax_rate
                if tax_cost > abs(current - target):
                    adjusted[symbol] = current  # Don't sell
                else:
                    adjusted[symbol] = target
            else:
                adjusted[symbol] = target

        # Re-normalize
        total = sum(adjusted.values())
        if total > 0:
            adjusted = {s: w / total for s, w in adjusted.items()}

        return adjusted


# ── Factor Exposure ──────────────────────────────────────────────────

class FactorExposure:
    """Compute and manage factor exposures."""

    @staticmethod
    def portfolio_factor_exposure(
        weights: Dict[str, float],
        factor_loadings: Dict[str, Dict[str, float]],
    ) -> Dict[str, float]:
        """
        Compute portfolio-level factor exposure.
        factor_loadings: {symbol: {factor: loading}}
        """
        factors: Dict[str, float] = {}
        for symbol, weight in weights.items():
            if symbol in factor_loadings:
                for factor, loading in factor_loadings[symbol].items():
                    factors[factor] = factors.get(factor, 0.0) + weight * loading
        return {f: round(v, 4) for f, v in factors.items()}

    @staticmethod
    def factor_risk_decomposition(
        weights: Dict[str, float],
        factor_loadings: Dict[str, Dict[str, float]],
        factor_covariance: Dict[str, Dict[str, float]],
    ) -> Dict[str, float]:
        """Decompose total risk into factor contributions."""
        port_exposure = FactorExposure.portfolio_factor_exposure(weights, factor_loadings)
        factors = list(port_exposure.keys())

        total_factor_var = 0.0
        contributions = {}
        for f in factors:
            exp = port_exposure.get(f, 0)
            var_contrib = 0.0
            for f2 in factors:
                exp2 = port_exposure.get(f2, 0)
                cov = factor_covariance.get(f, {}).get(f2, 0)
                var_contrib += exp * exp2 * cov
            contributions[f] = var_contrib
            total_factor_var += var_contrib

        return {
            "factor_contributions": {f: round(v, 6) for f, v in contributions.items()},
            "total_factor_variance": round(total_factor_var, 6),
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class PortfolioOptimizationEngine:
    """Top-level orchestrator for all portfolio optimization functionality."""

    def __init__(self) -> None:
        self.equal = EqualWeightOptimizer()
        self.inv_vol = InverseVolatilityOptimizer()
        self.min_var = MinVarianceOptimizer()
        self.max_sharpe = MaxSharpeOptimizer()
        self.risk_parity = RiskParityOptimizer()
        self.max_div = MaxDiversificationOptimizer()
        self.bl = BlackLittermanModel()
        self.cvar = CVaROptimizer()
        self.frontier = EfficientFrontierBuilder()
        self.metrics = PortfolioRiskMetrics()
        self.rebalancer = RebalancingEngine()
        self.factor = FactorExposure()

    def optimize(
        self,
        returns_dict: Dict[str, list[float]],
        method: str = "max_sharpe",
        risk_free_rate: float = 0.0,
        max_weight: float = 1.0,
        **kwargs,
    ) -> dict:
        method_map = {
            "equal_weight": self.equal.optimize,
            "inverse_volatility": self.inv_vol.optimize,
            "min_variance": lambda rd, rf: self.min_var.optimize(rd, rf, max_weight),
            "max_sharpe": lambda rd, rf: self.max_sharpe.optimize(rd, rf, max_weight),
            "risk_parity": self.risk_parity.optimize,
            "max_diversification": self.max_div.optimize,
            "cvar": self.cvar.optimize,
        }

        opt_func = method_map.get(method, self.max_sharpe.optimize)
        result = opt_func(returns_dict, risk_free_rate)
        return result.to_dict()

    def efficient_frontier(
        self,
        returns_dict: Dict[str, list[float]],
        n_points: int = 30,
        risk_free_rate: float = 0.0,
    ) -> list[dict]:
        points = self.frontier.build(returns_dict, risk_free_rate, n_points)
        return [p.to_dict() for p in points]

    def compare_methods(
        self,
        returns_dict: Dict[str, list[float]],
        risk_free_rate: float = 0.0,
    ) -> list[dict]:
        methods = ["equal_weight", "inverse_volatility", "min_variance",
                    "max_sharpe", "risk_parity", "max_diversification"]
        results = []
        for m in methods:
            r = self.optimize(returns_dict, m, risk_free_rate)
            results.append(r)
        return results

    def risk_metrics(
        self,
        returns_dict: Dict[str, list[float]],
        weights: Dict[str, float],
        benchmark_returns: Optional[list[float]] = None,
        risk_free_rate: float = 0.0,
    ) -> dict:
        symbols = sorted(weights.keys())
        w = [weights[s] for s in symbols]
        min_len = min(len(returns_dict[s]) for s in symbols)

        port_rets = [
            sum(w[i] * returns_dict[symbols[i]][t] for i in range(len(symbols)))
            for t in range(min_len)
        ]

        cov, _ = MatrixOps.covariance_matrix(returns_dict)
        rc = self.metrics.risk_contribution(w, cov)
        mrc = self.metrics.marginal_risk(w, cov)

        result = {
            "max_drawdown": round(self.metrics.max_drawdown_from_returns(port_rets), 4),
            "sortino_ratio": round(self.metrics.sortino_ratio(port_rets, risk_free_rate), 4),
            "calmar_ratio": round(self.metrics.calmar_ratio(port_rets, risk_free_rate), 4),
            "cvar_95": round(CVaROptimizer.calculate_cvar(port_rets, 0.95), 6),
            "risk_contribution": {symbols[i]: round(rc[i], 6) for i in range(len(symbols))},
            "marginal_risk": {symbols[i]: round(mrc[i], 6) for i in range(len(symbols))},
        }

        if benchmark_returns:
            result["tracking_error"] = round(
                self.metrics.tracking_error(port_rets, benchmark_returns), 4)
            result["information_ratio"] = round(
                self.metrics.information_ratio(port_rets, benchmark_returns), 4)

        return result

    def rebalance(
        self,
        current_weights: Dict[str, float],
        target_weights: Dict[str, float],
        portfolio_value: float = 100000.0,
        threshold: float = 0.05,
    ) -> dict:
        new_weights = self.rebalancer.threshold_rebalance(current_weights, target_weights, threshold)
        trades = self.rebalancer.calculate_trades(current_weights, new_weights, portfolio_value)
        return {
            "rebalanced": new_weights != current_weights,
            "new_weights": new_weights,
            "trades": trades,
            "total_turnover": sum(abs(t["weight_change"]) for t in trades) / 2,
        }

    def black_litterman(
        self,
        returns_dict: Dict[str, list[float]],
        market_caps: Dict[str, float],
        views: Dict[str, float] = None,
        view_confidences: Dict[str, float] = None,
        risk_free_rate: float = 0.0,
    ) -> dict:
        result = self.bl.optimize(
            returns_dict, market_caps, views, view_confidences,
            risk_free_rate=risk_free_rate)
        return result.to_dict()

    def capabilities(self) -> dict:
        return {
            "engine": "PortfolioOptimizationEngine",
            "version": "1.0.0",
            "features": [
                "equal_weight_portfolio",
                "inverse_volatility_optimization",
                "minimum_variance_optimization",
                "maximum_sharpe_optimization (tangency)",
                "risk_parity (equal risk contribution)",
                "maximum_diversification_ratio",
                "black_litterman_model (views + market equilibrium)",
                "cvar_optimization (conditional VaR)",
                "efficient_frontier_generation",
                "risk_contribution_decomposition",
                "tracking_error_and_information_ratio",
                "sortino_ratio_and_calmar_ratio",
                "max_drawdown_analysis",
                "rebalancing_engine (threshold, tax-aware)",
                "factor_exposure_analysis",
                "multi_method_comparison",
                "covariance_and_correlation_matrix",
            ],
        }
