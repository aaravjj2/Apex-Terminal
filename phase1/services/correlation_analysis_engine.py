"""
Apex Terminal — Bloomberg-Grade Correlation & Cross-Asset Analysis Engine
=========================================================================

Comprehensive cross-asset analysis engine:
- Correlation matrix computation (Pearson, Spearman, Kendall)
- Rolling correlation windows
- Covariance matrix and eigenvalue decomposition
- Principal Component Analysis (PCA)
- Beta calculation (single, rolling, conditional)
- Sector/industry rotation analysis
- Cross-asset momentum scoring
- Dispersion analysis (cross-sectional volatility)
- Lead-lag relationship detection
- Regime detection via correlation clustering
- Minimum variance portfolio optimization
- Risk contribution decomposition
- Correlation stability analysis

Pure computation module — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class CorrelationType(Enum):
    PEARSON = "pearson"
    SPEARMAN = "spearman"
    KENDALL = "kendall"


class RegimeType(Enum):
    HIGH_CORRELATION = "high_correlation"
    LOW_CORRELATION = "low_correlation"
    RISK_ON = "risk_on"
    RISK_OFF = "risk_off"
    TRANSITION = "transition"


class OptimizationType(Enum):
    MIN_VARIANCE = "min_variance"
    MAX_SHARPE = "max_sharpe"
    RISK_PARITY = "risk_parity"
    EQUAL_WEIGHT = "equal_weight"
    MAX_DIVERSIFICATION = "max_diversification"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class CorrelationMatrix:
    """Full correlation matrix with metadata."""
    symbols: list[str]
    matrix: np.ndarray
    correlation_type: str = "pearson"
    window: int = 0
    timestamp: datetime | None = None

    def get(self, sym1: str, sym2: str) -> float:
        """Get correlation between two symbols."""
        try:
            i = self.symbols.index(sym1)
            j = self.symbols.index(sym2)
            return float(self.matrix[i, j])
        except ValueError:
            return 0.0

    def top_correlations(self, n: int = 10) -> list[dict]:
        """Get top N correlated pairs."""
        pairs = []
        size = len(self.symbols)
        for i in range(size):
            for j in range(i + 1, size):
                pairs.append({
                    "symbol1": self.symbols[i],
                    "symbol2": self.symbols[j],
                    "correlation": float(self.matrix[i, j]),
                })
        pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)
        return pairs[:n]

    def least_correlated(self, n: int = 10) -> list[dict]:
        """Get least correlated pairs."""
        pairs = self.top_correlations(n=len(self.symbols) * (len(self.symbols) - 1) // 2)
        pairs.sort(key=lambda x: abs(x["correlation"]))
        return pairs[:n]

    def to_dict(self) -> dict:
        return {
            "symbols": self.symbols,
            "matrix": self.matrix.tolist(),
            "correlation_type": self.correlation_type,
            "window": self.window,
        }


@dataclass
class BetaResult:
    """Beta calculation result."""
    symbol: str
    benchmark: str
    beta: float
    alpha: float
    r_squared: float
    std_error: float = 0.0
    p_value: float = 0.0

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "benchmark": self.benchmark,
            "beta": round(self.beta, 4),
            "alpha": round(self.alpha, 6),
            "r_squared": round(self.r_squared, 4),
            "std_error": round(self.std_error, 4),
        }


@dataclass
class PCAResult:
    """Principal Component Analysis result."""
    components: np.ndarray
    explained_variance: np.ndarray
    explained_variance_ratio: np.ndarray
    loadings: np.ndarray | None = None
    symbols: list[str] = field(default_factory=list)

    def cumulative_variance(self) -> list[float]:
        return list(np.cumsum(self.explained_variance_ratio))

    def n_components_for_variance(self, target: float = 0.95) -> int:
        """Number of components needed to explain target variance."""
        cum = np.cumsum(self.explained_variance_ratio)
        for i, c in enumerate(cum):
            if c >= target:
                return i + 1
        return len(self.explained_variance_ratio)

    def to_dict(self) -> dict:
        return {
            "explained_variance_ratio": self.explained_variance_ratio.tolist(),
            "cumulative_variance": self.cumulative_variance(),
            "n_components_95pct": self.n_components_for_variance(0.95),
            "symbols": self.symbols,
        }


@dataclass
class RegimeInfo:
    """Market regime information."""
    regime: RegimeType
    avg_correlation: float
    dispersion: float
    confidence: float
    start_date: datetime | None = None

    def to_dict(self) -> dict:
        return {
            "regime": self.regime.value,
            "avg_correlation": round(self.avg_correlation, 4),
            "dispersion": round(self.dispersion, 4),
            "confidence": round(self.confidence, 4),
        }


# ─── Correlation Calculator ─────────────────────────────────────────────────

class CorrelationCalculator:
    """Calculate various types of correlation matrices."""

    @staticmethod
    def pearson(returns: dict[str, list[float]]) -> CorrelationMatrix:
        """Pearson correlation matrix."""
        symbols = list(returns.keys())
        n = len(symbols)
        if n == 0:
            return CorrelationMatrix([], np.array([]))

        # Align lengths
        min_len = min(len(v) for v in returns.values())
        matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i, j] = 1.0
                elif j > i:
                    r1 = np.array(returns[symbols[i]][:min_len])
                    r2 = np.array(returns[symbols[j]][:min_len])
                    if len(r1) < 2 or np.std(r1) == 0 or np.std(r2) == 0:
                        matrix[i, j] = 0.0
                    else:
                        corr = np.corrcoef(r1, r2)[0, 1]
                        matrix[i, j] = float(corr) if not np.isnan(corr) else 0.0
                    matrix[j, i] = matrix[i, j]

        return CorrelationMatrix(symbols, matrix, "pearson")

    @staticmethod
    def spearman(returns: dict[str, list[float]]) -> CorrelationMatrix:
        """Spearman rank correlation matrix."""
        symbols = list(returns.keys())
        n = len(symbols)
        if n == 0:
            return CorrelationMatrix([], np.array([]))

        min_len = min(len(v) for v in returns.values())
        matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i, j] = 1.0
                elif j > i:
                    r1 = returns[symbols[i]][:min_len]
                    r2 = returns[symbols[j]][:min_len]
                    if len(r1) < 2:
                        matrix[i, j] = 0.0
                    else:
                        # Rank correlation
                        rank1 = CorrelationCalculator._rank(r1)
                        rank2 = CorrelationCalculator._rank(r2)
                        r1a = np.array(rank1)
                        r2a = np.array(rank2)
                        if np.std(r1a) == 0 or np.std(r2a) == 0:
                            matrix[i, j] = 0.0
                        else:
                            corr = np.corrcoef(r1a, r2a)[0, 1]
                            matrix[i, j] = float(corr) if not np.isnan(corr) else 0.0
                    matrix[j, i] = matrix[i, j]

        return CorrelationMatrix(symbols, matrix, "spearman")

    @staticmethod
    def kendall(returns: dict[str, list[float]]) -> CorrelationMatrix:
        """Kendall tau rank correlation matrix."""
        symbols = list(returns.keys())
        n = len(symbols)
        if n == 0:
            return CorrelationMatrix([], np.array([]))

        min_len = min(len(v) for v in returns.values())
        matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i, j] = 1.0
                elif j > i:
                    r1 = returns[symbols[i]][:min_len]
                    r2 = returns[symbols[j]][:min_len]
                    matrix[i, j] = CorrelationCalculator._kendall_tau(r1, r2)
                    matrix[j, i] = matrix[i, j]

        return CorrelationMatrix(symbols, matrix, "kendall")

    @staticmethod
    def _rank(data: list[float]) -> list[float]:
        """Assign ranks to data."""
        indexed = sorted(enumerate(data), key=lambda x: x[1])
        ranks = [0.0] * len(data)
        for rank, (idx, _) in enumerate(indexed):
            ranks[idx] = float(rank + 1)
        return ranks

    @staticmethod
    def _kendall_tau(x: list[float], y: list[float]) -> float:
        """Kendall tau correlation coefficient."""
        n = min(len(x), len(y))
        if n < 2:
            return 0.0
        concordant = 0
        discordant = 0
        for i in range(n):
            for j in range(i + 1, n):
                dx = x[i] - x[j]
                dy = y[i] - y[j]
                if dx * dy > 0:
                    concordant += 1
                elif dx * dy < 0:
                    discordant += 1
        total = concordant + discordant
        if total == 0:
            return 0.0
        return (concordant - discordant) / total

    @staticmethod
    def rolling_correlation(r1: list[float], r2: list[float], window: int = 30) -> list[float]:
        """Rolling Pearson correlation between two series."""
        n = min(len(r1), len(r2))
        result = []
        for i in range(n):
            if i < window - 1:
                result.append(0.0)
                continue
            w1 = np.array(r1[i - window + 1:i + 1])
            w2 = np.array(r2[i - window + 1:i + 1])
            if np.std(w1) == 0 or np.std(w2) == 0:
                result.append(0.0)
            else:
                corr = np.corrcoef(w1, w2)[0, 1]
                result.append(float(corr) if not np.isnan(corr) else 0.0)
        return result

    def calculate(self, returns: dict[str, list[float]], corr_type: CorrelationType = CorrelationType.PEARSON) -> CorrelationMatrix:
        """Dispatch to correlation type."""
        dispatch = {
            CorrelationType.PEARSON: self.pearson,
            CorrelationType.SPEARMAN: self.spearman,
            CorrelationType.KENDALL: self.kendall,
        }
        return dispatch[corr_type](returns)


# ─── Covariance Analysis ────────────────────────────────────────────────────

class CovarianceAnalyzer:
    """Covariance matrix analysis and decomposition."""

    @staticmethod
    def covariance_matrix(returns: dict[str, list[float]]) -> tuple[list[str], np.ndarray]:
        """Calculate covariance matrix."""
        symbols = list(returns.keys())
        if not symbols:
            return [], np.array([])

        min_len = min(len(v) for v in returns.values())
        data = np.array([returns[s][:min_len] for s in symbols])
        cov = np.cov(data) if data.shape[1] > 1 else np.zeros((len(symbols), len(symbols)))
        return symbols, cov

    @staticmethod
    def eigenvalue_decomposition(cov_matrix: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Eigenvalue decomposition of covariance matrix."""
        if cov_matrix.size == 0:
            return np.array([]), np.array([])
        eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)
        # Sort descending
        idx = np.argsort(eigenvalues)[::-1]
        return eigenvalues[idx], eigenvectors[:, idx]

    @staticmethod
    def condition_number(cov_matrix: np.ndarray) -> float:
        """Condition number of covariance matrix."""
        if cov_matrix.size == 0:
            return 0.0
        eigenvalues = np.linalg.eigvalsh(cov_matrix)
        min_eig = np.min(np.abs(eigenvalues))
        max_eig = np.max(np.abs(eigenvalues))
        if min_eig == 0:
            return float('inf')
        return float(max_eig / min_eig)


# ─── PCA ─────────────────────────────────────────────────────────────────────

class PCAAnalyzer:
    """Principal Component Analysis for asset returns."""

    @staticmethod
    def fit(returns: dict[str, list[float]], n_components: int | None = None) -> PCAResult:
        """Perform PCA on asset returns."""
        symbols = list(returns.keys())
        if not symbols:
            return PCAResult(np.array([]), np.array([]), np.array([]))

        min_len = min(len(v) for v in returns.values())
        data = np.array([returns[s][:min_len] for s in symbols]).T  # samples x features

        if data.shape[0] < 2 or data.shape[1] < 1:
            return PCAResult(np.array([]), np.array([]), np.array([]), symbols=symbols)

        # Center data
        mean = np.mean(data, axis=0)
        centered = data - mean

        # SVD
        U, S, Vt = np.linalg.svd(centered, full_matrices=False)

        # Explained variance
        n_samples = data.shape[0]
        explained_var = (S ** 2) / (n_samples - 1)
        total_var = np.sum(explained_var)
        explained_ratio = explained_var / total_var if total_var > 0 else np.zeros_like(explained_var)

        if n_components is not None:
            n_components = min(n_components, len(explained_var))
            Vt = Vt[:n_components]
            explained_var = explained_var[:n_components]
            explained_ratio = explained_ratio[:n_components]

        # Loadings: components x features
        loadings = Vt

        return PCAResult(
            components=Vt,
            explained_variance=explained_var,
            explained_variance_ratio=explained_ratio,
            loadings=loadings,
            symbols=symbols,
        )


# ─── Beta Calculator ────────────────────────────────────────────────────────

class BetaCalculator:
    """Calculate various types of beta."""

    @staticmethod
    def single_beta(asset_returns: list[float], benchmark_returns: list[float]) -> BetaResult:
        """Calculate single-period beta using OLS."""
        n = min(len(asset_returns), len(benchmark_returns))
        if n < 2:
            return BetaResult("", "", 0.0, 0.0, 0.0)

        x = np.array(benchmark_returns[:n])
        y = np.array(asset_returns[:n])

        mean_x = np.mean(x)
        mean_y = np.mean(y)

        cov_xy = np.sum((x - mean_x) * (y - mean_y)) / n
        var_x = np.sum((x - mean_x) ** 2) / n

        beta = float(cov_xy / var_x) if var_x > 0 else 0.0
        alpha = float(mean_y - beta * mean_x)

        # R-squared
        y_pred = alpha + beta * x
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - mean_y) ** 2)
        r_squared = float(1.0 - ss_res / ss_tot) if ss_tot > 0 else 0.0

        # Standard error
        if n > 2 and var_x > 0:
            mse = ss_res / (n - 2)
            std_error = float(np.sqrt(mse / (n * var_x)))
        else:
            std_error = 0.0

        return BetaResult("", "", beta, alpha, r_squared, std_error)

    @staticmethod
    def rolling_beta(asset_returns: list[float], benchmark_returns: list[float], window: int = 60) -> list[float]:
        """Rolling beta over a window."""
        n = min(len(asset_returns), len(benchmark_returns))
        result = []

        for i in range(n):
            if i < window - 1:
                result.append(0.0)
                continue

            x = np.array(benchmark_returns[i - window + 1:i + 1])
            y = np.array(asset_returns[i - window + 1:i + 1])

            mean_x = np.mean(x)
            cov = np.sum((x - mean_x) * (y - np.mean(y)))
            var = np.sum((x - mean_x) ** 2)
            beta = float(cov / var) if var > 0 else 0.0
            result.append(beta)

        return result

    @staticmethod
    def conditional_beta(asset_returns: list[float], benchmark_returns: list[float],
                          condition: str = "down") -> float:
        """Beta conditional on market direction."""
        n = min(len(asset_returns), len(benchmark_returns))
        if n < 2:
            return 0.0

        if condition == "down":
            mask = [i for i in range(n) if benchmark_returns[i] < 0]
        else:
            mask = [i for i in range(n) if benchmark_returns[i] >= 0]

        if len(mask) < 2:
            return 0.0

        filtered_asset = [asset_returns[i] for i in mask]
        filtered_bench = [benchmark_returns[i] for i in mask]

        result = BetaCalculator.single_beta(filtered_asset, filtered_bench)
        return result.beta


# ─── Dispersion Analysis ────────────────────────────────────────────────────

class DispersionAnalyzer:
    """Cross-sectional dispersion and rotation analysis."""

    @staticmethod
    def cross_sectional_dispersion(returns: dict[str, list[float]]) -> list[float]:
        """Calculate cross-sectional standard deviation at each time period."""
        symbols = list(returns.keys())
        if not symbols:
            return []

        min_len = min(len(v) for v in returns.values())
        result = []

        for t in range(min_len):
            cross = [returns[s][t] for s in symbols]
            if len(cross) > 1:
                result.append(float(np.std(cross)))
            else:
                result.append(0.0)

        return result

    @staticmethod
    def sector_rotation_score(sector_returns: dict[str, list[float]], lookback: int = 20) -> dict[str, float]:
        """Score sector momentum for rotation analysis."""
        scores = {}
        for sector, rets in sector_returns.items():
            if len(rets) >= lookback:
                recent = rets[-lookback:]
                cumulative = np.prod([1 + r for r in recent]) - 1
                volatility = np.std(recent) if len(recent) > 1 else 0.001
                # Risk-adjusted momentum
                scores[sector] = float(cumulative / volatility) if volatility > 0 else 0.0
            else:
                scores[sector] = 0.0
        return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True))

    @staticmethod
    def momentum_scores(returns: dict[str, list[float]], periods: list[int] = None) -> dict[str, dict]:
        """Multi-period momentum scoring."""
        if periods is None:
            periods = [5, 10, 20, 60]

        scores = {}
        for symbol, rets in returns.items():
            symbol_scores = {}
            for period in periods:
                if len(rets) >= period:
                    cum_ret = np.prod([1 + r for r in rets[-period:]]) - 1
                    symbol_scores[f"mom_{period}d"] = float(cum_ret * 100)
                else:
                    symbol_scores[f"mom_{period}d"] = 0.0

            # Composite score (average of z-scores across periods)
            period_values = list(symbol_scores.values())
            if period_values:
                symbol_scores["composite"] = float(np.mean(period_values))
            scores[symbol] = symbol_scores

        return scores

    @staticmethod
    def relative_strength(returns: dict[str, list[float]], benchmark: str, period: int = 20) -> dict[str, float]:
        """Relative strength vs benchmark."""
        if benchmark not in returns:
            return {}

        bench_rets = returns[benchmark]
        result = {}

        for symbol, rets in returns.items():
            if symbol == benchmark:
                continue
            n = min(len(rets), len(bench_rets), period)
            if n < 1:
                result[symbol] = 0.0
                continue

            asset_cum = np.prod([1 + r for r in rets[-n:]]) - 1
            bench_cum = np.prod([1 + r for r in bench_rets[-n:]]) - 1

            # Relative strength = asset return / benchmark return
            if bench_cum != 0:
                result[symbol] = float((1 + asset_cum) / (1 + bench_cum) - 1.0)
            else:
                result[symbol] = float(asset_cum)

        return result


# ─── Lead-Lag Detection ─────────────────────────────────────────────────────

class LeadLagDetector:
    """Detect lead-lag relationships between time series."""

    @staticmethod
    def cross_correlation(r1: list[float], r2: list[float], max_lag: int = 10) -> dict[int, float]:
        """Cross-correlation at various lags."""
        n = min(len(r1), len(r2))
        if n < 3:
            return {}

        a1 = np.array(r1[:n])
        a2 = np.array(r2[:n])

        # Normalize
        a1 = (a1 - np.mean(a1))
        a2 = (a2 - np.mean(a2))
        s1 = np.std(a1) if np.std(a1) > 0 else 1.0
        s2 = np.std(a2) if np.std(a2) > 0 else 1.0

        result = {}
        for lag in range(-max_lag, max_lag + 1):
            if lag >= 0:
                x = a1[:n - lag] if lag < n else np.array([])
                y = a2[lag:n] if lag < n else np.array([])
            else:
                x = a1[-lag:n] if -lag < n else np.array([])
                y = a2[:n + lag] if -lag < n else np.array([])

            if len(x) < 2:
                result[lag] = 0.0
                continue

            corr = float(np.sum(x * y) / (len(x) * s1 * s2))
            result[lag] = corr

        return result

    @staticmethod
    def granger_causality_simple(x: list[float], y: list[float], lag: int = 1) -> dict:
        """Simple Granger-like causality test."""
        n = min(len(x), len(y))
        if n < lag + 3:
            return {"f_statistic": 0.0, "direction": "none"}

        # Restricted model: y_t = a + b * y_{t-1}
        y_arr = np.array(y[:n])
        x_arr = np.array(x[:n])

        y_dep = y_arr[lag:]
        y_lag = y_arr[:-lag] if lag > 0 else y_arr

        # Fit restricted
        if len(y_dep) < 2:
            return {"f_statistic": 0.0, "direction": "none"}

        y_mean = np.mean(y_dep)
        ss_res_r = np.sum((y_dep - y_mean) ** 2)

        # Unrestricted: y_t = a + b * y_{t-1} + c * x_{t-1}
        x_lag = x_arr[:-lag] if lag > 0 else x_arr
        x_lag = x_lag[:len(y_dep)]
        y_lag = y_lag[:len(y_dep)]

        if len(x_lag) != len(y_dep):
            return {"f_statistic": 0.0, "direction": "none"}

        # Simple regression with both
        X = np.column_stack([np.ones(len(y_dep)), y_lag, x_lag])
        try:
            beta = np.linalg.lstsq(X, y_dep, rcond=None)[0]
            y_pred = X @ beta
            ss_res_u = np.sum((y_dep - y_pred) ** 2)
        except Exception:
            return {"f_statistic": 0.0, "direction": "none"}

        # F-statistic
        k = 1  # Added regressors
        n_obs = len(y_dep)
        if ss_res_u == 0 or n_obs <= X.shape[1]:
            f_stat = 0.0
        else:
            f_stat = ((ss_res_r - ss_res_u) / k) / (ss_res_u / (n_obs - X.shape[1]))

        direction = "x_leads_y" if f_stat > 2.0 else "none"

        return {
            "f_statistic": float(f_stat),
            "direction": direction,
            "lag": lag,
        }


# ─── Regime Detection ───────────────────────────────────────────────────────

class RegimeDetector:
    """Detect market regimes based on correlation patterns."""

    @staticmethod
    def detect_regime(returns: dict[str, list[float]], window: int = 60) -> RegimeInfo:
        """Detect current market regime."""
        symbols = list(returns.keys())
        if len(symbols) < 2:
            return RegimeInfo(RegimeType.TRANSITION, 0.0, 0.0, 0.0)

        # Calculate average pairwise correlation
        min_len = min(len(v) for v in returns.values())
        recent_window = min(window, min_len)

        correlations = []
        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                r1 = np.array(returns[symbols[i]][-recent_window:])
                r2 = np.array(returns[symbols[j]][-recent_window:])
                if np.std(r1) > 0 and np.std(r2) > 0:
                    corr = float(np.corrcoef(r1, r2)[0, 1])
                    if not np.isnan(corr):
                        correlations.append(corr)

        if not correlations:
            return RegimeInfo(RegimeType.TRANSITION, 0.0, 0.0, 0.0)

        avg_corr = float(np.mean(correlations))
        dispersion = float(np.std(correlations))

        # Classify regime
        if avg_corr > 0.7:
            regime = RegimeType.HIGH_CORRELATION
            confidence = min(avg_corr, 1.0)
        elif avg_corr < 0.2:
            regime = RegimeType.LOW_CORRELATION
            confidence = 1.0 - avg_corr
        elif avg_corr > 0.5:
            # Check if positive or negative trend
            avg_returns = [float(np.mean(returns[s][-recent_window:])) for s in symbols]
            if np.mean(avg_returns) > 0:
                regime = RegimeType.RISK_ON
            else:
                regime = RegimeType.RISK_OFF
            confidence = abs(avg_corr)
        else:
            regime = RegimeType.TRANSITION
            confidence = 0.5

        return RegimeInfo(
            regime=regime,
            avg_correlation=avg_corr,
            dispersion=dispersion,
            confidence=confidence,
        )

    @staticmethod
    def rolling_regime(returns: dict[str, list[float]], window: int = 60, step: int = 20) -> list[RegimeInfo]:
        """Detect regimes over rolling windows."""
        symbols = list(returns.keys())
        if not symbols:
            return []

        min_len = min(len(v) for v in returns.values())
        regimes = []

        for start in range(0, min_len - window, step):
            windowed = {s: returns[s][start:start + window] for s in symbols}
            regime = RegimeDetector.detect_regime(windowed, window)
            regimes.append(regime)

        return regimes


# ─── Portfolio Optimization ──────────────────────────────────────────────────

class PortfolioOptimizer:
    """Portfolio optimization using correlation/covariance analysis."""

    @staticmethod
    def minimum_variance(returns: dict[str, list[float]]) -> dict[str, float]:
        """Find minimum variance portfolio weights."""
        symbols = list(returns.keys())
        if len(symbols) == 0:
            return {}
        if len(symbols) == 1:
            return {symbols[0]: 1.0}

        min_len = min(len(v) for v in returns.values())
        data = np.array([returns[s][:min_len] for s in symbols])

        if data.shape[1] < 2:
            return {s: 1.0 / len(symbols) for s in symbols}

        cov = np.cov(data)

        # Analytical solution: w = (Σ^-1 * 1) / (1^T * Σ^-1 * 1)
        try:
            cov_inv = np.linalg.inv(cov)
            ones = np.ones(len(symbols))
            w = cov_inv @ ones
            w = w / np.sum(w)
            return {symbols[i]: float(w[i]) for i in range(len(symbols))}
        except np.linalg.LinAlgError:
            return {s: 1.0 / len(symbols) for s in symbols}

    @staticmethod
    def risk_parity(returns: dict[str, list[float]]) -> dict[str, float]:
        """Risk parity portfolio weights."""
        symbols = list(returns.keys())
        if not symbols:
            return {}

        min_len = min(len(v) for v in returns.values())
        vols = {}
        for s in symbols:
            r = np.array(returns[s][:min_len])
            vols[s] = float(np.std(r)) if np.std(r) > 0 else 0.001

        # Inverse volatility weighting
        inv_vols = {s: 1.0 / v for s, v in vols.items()}
        total = sum(inv_vols.values())
        return {s: iv / total for s, iv in inv_vols.items()}

    @staticmethod
    def max_diversification(returns: dict[str, list[float]]) -> dict[str, float]:
        """Maximum diversification ratio portfolio."""
        symbols = list(returns.keys())
        if len(symbols) <= 1:
            return {s: 1.0 for s in symbols}

        # Start with risk parity as approximation
        return PortfolioOptimizer.risk_parity(returns)

    @staticmethod
    def risk_contribution(weights: dict[str, float], returns: dict[str, list[float]]) -> dict[str, float]:
        """Calculate risk contribution of each asset."""
        symbols = list(weights.keys())
        if not symbols:
            return {}

        min_len = min(len(returns.get(s, [])) for s in symbols)
        if min_len < 2:
            return {s: 1.0 / len(symbols) for s in symbols}

        data = np.array([returns[s][:min_len] for s in symbols])
        cov = np.cov(data)
        w = np.array([weights[s] for s in symbols])

        port_var = w @ cov @ w
        if port_var == 0:
            return {s: 1.0 / len(symbols) for s in symbols}

        # Marginal risk contribution
        mrc = cov @ w
        # Risk contribution = w * MRC
        rc = w * mrc
        rc_pct = rc / np.sum(rc)

        return {symbols[i]: float(rc_pct[i]) for i in range(len(symbols))}


# ─── Correlation Stability ──────────────────────────────────────────────────

class CorrelationStabilityAnalyzer:
    """Analyze stability and changes in correlation over time."""

    @staticmethod
    def correlation_change(returns: dict[str, list[float]], window1: int = 60, window2: int = 60) -> dict:
        """Compare recent vs historical correlation."""
        symbols = list(returns.keys())
        min_len = min(len(v) for v in returns.values())

        if min_len < window1 + window2:
            return {"change": 0.0, "recent_avg": 0.0, "historical_avg": 0.0}

        # Historical corr
        hist_returns = {s: returns[s][-(window1 + window2):-window2] for s in symbols}
        hist_corr = CorrelationCalculator.pearson(hist_returns)

        # Recent corr
        recent_returns = {s: returns[s][-window2:] for s in symbols}
        recent_corr = CorrelationCalculator.pearson(recent_returns)

        hist_avg = float(np.mean(hist_corr.matrix[np.triu_indices(len(symbols), k=1)])) if len(symbols) > 1 else 0.0
        recent_avg = float(np.mean(recent_corr.matrix[np.triu_indices(len(symbols), k=1)])) if len(symbols) > 1 else 0.0

        return {
            "change": recent_avg - hist_avg,
            "recent_avg_correlation": recent_avg,
            "historical_avg_correlation": hist_avg,
            "symbols": symbols,
        }

    @staticmethod
    def correlation_breakdowns(returns: dict[str, list[float]], window: int = 60, threshold: float = 0.3) -> list[dict]:
        """Detect significant correlation breakdowns."""
        symbols = list(returns.keys())
        min_len = min(len(v) for v in returns.values())
        breakdowns = []

        if min_len < window * 2:
            return breakdowns

        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                r1_hist = returns[symbols[i]][-(window * 2):-window]
                r2_hist = returns[symbols[j]][-(window * 2):-window]
                r1_recent = returns[symbols[i]][-window:]
                r2_recent = returns[symbols[j]][-window:]

                a1h, a2h = np.array(r1_hist), np.array(r2_hist)
                a1r, a2r = np.array(r1_recent), np.array(r2_recent)

                if np.std(a1h) > 0 and np.std(a2h) > 0:
                    hist_corr = float(np.corrcoef(a1h, a2h)[0, 1])
                else:
                    hist_corr = 0.0

                if np.std(a1r) > 0 and np.std(a2r) > 0:
                    recent_corr = float(np.corrcoef(a1r, a2r)[0, 1])
                else:
                    recent_corr = 0.0

                change = abs(recent_corr - hist_corr)
                if change >= threshold:
                    breakdowns.append({
                        "symbol1": symbols[i],
                        "symbol2": symbols[j],
                        "historical_corr": round(hist_corr, 4),
                        "recent_corr": round(recent_corr, 4),
                        "change": round(change, 4),
                    })

        breakdowns.sort(key=lambda x: x["change"], reverse=True)
        return breakdowns


# ─── Orchestrator ────────────────────────────────────────────────────────────

class CorrelationAnalysisEngine:
    """Top-level orchestrator for correlation & cross-asset analysis."""

    def __init__(self):
        self.correlation = CorrelationCalculator()
        self.covariance = CovarianceAnalyzer()
        self.pca = PCAAnalyzer()
        self.beta_calc = BetaCalculator()
        self.dispersion = DispersionAnalyzer()
        self.lead_lag = LeadLagDetector()
        self.regime = RegimeDetector()
        self.optimizer = PortfolioOptimizer()
        self.stability = CorrelationStabilityAnalyzer()

    def correlation_matrix(self, returns: dict[str, list[float]],
                            corr_type: CorrelationType = CorrelationType.PEARSON) -> dict:
        """Calculate correlation matrix."""
        result = self.correlation.calculate(returns, corr_type)
        return result.to_dict()

    def top_correlations(self, returns: dict[str, list[float]], n: int = 10) -> list[dict]:
        result = self.correlation.pearson(returns)
        return result.top_correlations(n)

    def least_correlated(self, returns: dict[str, list[float]], n: int = 10) -> list[dict]:
        result = self.correlation.pearson(returns)
        return result.least_correlated(n)

    def rolling_correlation(self, r1: list[float], r2: list[float], window: int = 30) -> list[float]:
        return self.correlation.rolling_correlation(r1, r2, window)

    def calculate_beta(self, asset: list[float], benchmark: list[float], symbol: str = "", bench_name: str = "SPY") -> dict:
        result = self.beta_calc.single_beta(asset, benchmark)
        result.symbol = symbol
        result.benchmark = bench_name
        return result.to_dict()

    def rolling_beta(self, asset: list[float], benchmark: list[float], window: int = 60) -> list[float]:
        return self.beta_calc.rolling_beta(asset, benchmark, window)

    def conditional_beta(self, asset: list[float], benchmark: list[float], condition: str = "down") -> float:
        return self.beta_calc.conditional_beta(asset, benchmark, condition)

    def run_pca(self, returns: dict[str, list[float]], n_components: int | None = None) -> dict:
        return self.pca.fit(returns, n_components).to_dict()

    def dispersion_analysis(self, returns: dict[str, list[float]]) -> list[float]:
        return self.dispersion.cross_sectional_dispersion(returns)

    def sector_rotation(self, sector_returns: dict[str, list[float]], lookback: int = 20) -> dict:
        return self.dispersion.sector_rotation_score(sector_returns, lookback)

    def momentum_scores(self, returns: dict[str, list[float]]) -> dict:
        return self.dispersion.momentum_scores(returns)

    def relative_strength(self, returns: dict[str, list[float]], benchmark: str, period: int = 20) -> dict:
        return self.dispersion.relative_strength(returns, benchmark, period)

    def lead_lag_analysis(self, r1: list[float], r2: list[float], max_lag: int = 10) -> dict:
        return self.lead_lag.cross_correlation(r1, r2, max_lag)

    def granger_causality(self, x: list[float], y: list[float], lag: int = 1) -> dict:
        return self.lead_lag.granger_causality_simple(x, y, lag)

    def detect_regime(self, returns: dict[str, list[float]], window: int = 60) -> dict:
        return self.regime.detect_regime(returns, window).to_dict()

    def optimize_portfolio(self, returns: dict[str, list[float]], method: OptimizationType = OptimizationType.MIN_VARIANCE) -> dict:
        dispatch = {
            OptimizationType.MIN_VARIANCE: self.optimizer.minimum_variance,
            OptimizationType.RISK_PARITY: self.optimizer.risk_parity,
            OptimizationType.MAX_DIVERSIFICATION: self.optimizer.max_diversification,
            OptimizationType.EQUAL_WEIGHT: lambda r: {s: 1.0 / len(r) for s in r},
        }
        fn = dispatch.get(method, self.optimizer.minimum_variance)
        weights = fn(returns)
        risk_contrib = self.optimizer.risk_contribution(weights, returns)
        return {"weights": weights, "risk_contribution": risk_contrib, "method": method.value}

    def correlation_stability(self, returns: dict[str, list[float]], window: int = 60) -> dict:
        return self.stability.correlation_change(returns, window, window)

    def correlation_breakdowns(self, returns: dict[str, list[float]], window: int = 60) -> list[dict]:
        return self.stability.correlation_breakdowns(returns, window)

    def capabilities(self) -> dict:
        return {
            "engine": "CorrelationAnalysisEngine",
            "correlation_types": [c.value for c in CorrelationType],
            "optimization_types": [o.value for o in OptimizationType],
            "regime_types": [r.value for r in RegimeType],
            "features": [
                "pearson_spearman_kendall_correlation",
                "rolling_correlation",
                "covariance_matrix",
                "eigenvalue_decomposition",
                "pca_analysis",
                "single_rolling_conditional_beta",
                "cross_sectional_dispersion",
                "sector_rotation_scoring",
                "momentum_scoring",
                "relative_strength",
                "lead_lag_detection",
                "granger_causality",
                "regime_detection",
                "portfolio_optimization",
                "risk_contribution",
                "correlation_stability",
            ],
        }
