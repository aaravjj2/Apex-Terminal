"""
Statistical Arbitrage Engine — Pure-Python stat-arb signals and analytics.
Cointegration tests, spread modeling, z-score signals, mean-reversion detection,
hedge ratio estimation, Ornstein-Uhlenbeck parameter fitting, pairs ranking.
No numpy/scipy dependency.
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

class SpreadSignal(str, Enum):
    STRONG_BUY = "strong_buy"       # spread very negative
    BUY = "buy"                     # spread below lower threshold
    HOLD = "hold"                   # within bands
    SELL = "sell"                   # spread above upper threshold
    STRONG_SELL = "strong_sell"     # spread very positive
    STOP_LOSS = "stop_loss"         # beyond stop threshold


class MeanReversionStrength(str, Enum):
    NONE = "none"
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"
    VERY_STRONG = "very_strong"


class PairStatus(str, Enum):
    ACTIVE = "active"
    MONITORING = "monitoring"
    DIVERGED = "diverged"
    CONVERGED = "converged"


# ═══════════════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class PairCandidate:
    symbol_a: str
    symbol_b: str
    correlation: float
    hedge_ratio: float
    spread_mean: float
    spread_std: float
    half_life: float
    score: float = 0.0

    def to_dict(self) -> dict:
        return {
            "pair": f"{self.symbol_a}/{self.symbol_b}",
            "correlation": round(self.correlation, 4),
            "hedge_ratio": round(self.hedge_ratio, 4),
            "spread_mean": round(self.spread_mean, 6),
            "spread_std": round(self.spread_std, 6),
            "half_life": round(self.half_life, 2),
            "score": round(self.score, 4),
        }


@dataclass
class SpreadState:
    current_spread: float
    z_score: float
    signal: SpreadSignal
    spread_mean: float
    spread_std: float
    percentile: float       # where in historical distribution

    def to_dict(self) -> dict:
        return {
            "spread": round(self.current_spread, 6),
            "z_score": round(self.z_score, 4),
            "signal": self.signal.value,
            "mean": round(self.spread_mean, 6),
            "std": round(self.spread_std, 6),
            "percentile": round(self.percentile, 2),
        }


@dataclass
class OUParameters:
    """Ornstein-Uhlenbeck process parameters."""
    theta: float    # mean reversion speed
    mu: float       # long-run mean
    sigma: float    # volatility
    half_life: float

    def to_dict(self) -> dict:
        return {
            "theta": round(self.theta, 6),
            "mu": round(self.mu, 6),
            "sigma": round(self.sigma, 6),
            "half_life": round(self.half_life, 2),
        }


# ═══════════════════════════════════════════════════════════════════════
# Correlation Calculator
# ═══════════════════════════════════════════════════════════════════════

class CorrelationCalculator:
    """Pairwise and rolling correlation."""

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
        return round(cov / (sx * sy), 6)

    @staticmethod
    def spearman(x: list[float], y: list[float]) -> float:
        """Spearman rank correlation."""
        n = min(len(x), len(y))
        if n < 2:
            return 0.0
        rx = CorrelationCalculator._rank(x[:n])
        ry = CorrelationCalculator._rank(y[:n])
        return CorrelationCalculator.pearson(rx, ry)

    @staticmethod
    def _rank(data: list[float]) -> list[float]:
        indexed = sorted(enumerate(data), key=lambda x: x[1])
        ranks = [0.0] * len(data)
        for rank, (idx, _) in enumerate(indexed, 1):
            ranks[idx] = float(rank)
        return ranks

    @staticmethod
    def rolling_correlation(
        x: list[float],
        y: list[float],
        window: int = 60,
    ) -> list[float]:
        n = min(len(x), len(y))
        if n < window:
            return []
        return [
            CorrelationCalculator.pearson(x[i - window:i], y[i - window:i])
            for i in range(window, n + 1)
        ]


# ═══════════════════════════════════════════════════════════════════════
# Hedge Ratio Estimator
# ═══════════════════════════════════════════════════════════════════════

class HedgeRatioEstimator:
    """Estimate hedge ratios for pairs."""

    @staticmethod
    def ols_hedge_ratio(y: list[float], x: list[float]) -> dict:
        """OLS regression: y = beta * x + alpha + epsilon."""
        n = min(len(y), len(x))
        if n < 2:
            return {"beta": 0.0, "alpha": 0.0, "r_squared": 0.0}

        mx = statistics.mean(x[:n])
        my = statistics.mean(y[:n])

        cov_xy = sum((x[i] - mx) * (y[i] - my) for i in range(n)) / (n - 1)
        var_x = sum((x[i] - mx)**2 for i in range(n)) / (n - 1)

        if var_x == 0:
            return {"beta": 0.0, "alpha": 0.0, "r_squared": 0.0}

        beta = cov_xy / var_x
        alpha = my - beta * mx

        # R-squared
        ss_res = sum((y[i] - (alpha + beta * x[i]))**2 for i in range(n))
        ss_tot = sum((y[i] - my)**2 for i in range(n))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

        return {
            "beta": round(beta, 6),
            "alpha": round(alpha, 6),
            "r_squared": round(max(0, r2), 4),
        }

    @staticmethod
    def rolling_hedge_ratio(
        y: list[float],
        x: list[float],
        window: int = 60,
    ) -> list[dict]:
        n = min(len(y), len(x))
        if n < window:
            return []
        return [
            HedgeRatioEstimator.ols_hedge_ratio(y[i - window:i], x[i - window:i])
            for i in range(window, n + 1)
        ]

    @staticmethod
    def total_least_squares(y: list[float], x: list[float]) -> dict:
        """TLS (orthogonal regression) hedge ratio."""
        n = min(len(y), len(x))
        if n < 2:
            return {"beta": 0.0, "alpha": 0.0}

        mx = statistics.mean(x[:n])
        my = statistics.mean(y[:n])

        var_x = sum((x[i] - mx)**2 for i in range(n)) / (n - 1)
        var_y = sum((y[i] - my)**2 for i in range(n)) / (n - 1)
        cov_xy = sum((x[i] - mx) * (y[i] - my) for i in range(n)) / (n - 1)

        diff = var_y - var_x
        discriminant = diff**2 + 4 * cov_xy**2
        beta = (diff + math.sqrt(max(discriminant, 0))) / (2 * cov_xy) if cov_xy != 0 else 0

        alpha = my - beta * mx

        return {"beta": round(beta, 6), "alpha": round(alpha, 6)}


# ═══════════════════════════════════════════════════════════════════════
# Spread Calculator
# ═══════════════════════════════════════════════════════════════════════

class SpreadCalculator:
    """Calculate and analyze spreads."""

    @staticmethod
    def price_spread(
        prices_a: list[float],
        prices_b: list[float],
        hedge_ratio: float = 1.0,
    ) -> list[float]:
        n = min(len(prices_a), len(prices_b))
        return [round(prices_a[i] - hedge_ratio * prices_b[i], 6) for i in range(n)]

    @staticmethod
    def log_spread(
        prices_a: list[float],
        prices_b: list[float],
        hedge_ratio: float = 1.0,
    ) -> list[float]:
        n = min(len(prices_a), len(prices_b))
        result = []
        for i in range(n):
            if prices_a[i] > 0 and prices_b[i] > 0:
                result.append(round(math.log(prices_a[i]) - hedge_ratio * math.log(prices_b[i]), 6))
            else:
                result.append(0.0)
        return result

    @staticmethod
    def ratio_spread(
        prices_a: list[float],
        prices_b: list[float],
    ) -> list[float]:
        n = min(len(prices_a), len(prices_b))
        return [
            round(prices_a[i] / prices_b[i], 6) if prices_b[i] != 0 else 0.0
            for i in range(n)
        ]

    @staticmethod
    def z_score(spread: list[float], lookback: int = 0) -> list[float]:
        """Rolling z-score. If lookback=0, use expanding window."""
        if not spread:
            return []

        z_scores = []
        for i in range(len(spread)):
            if lookback > 0:
                window = spread[max(0, i - lookback + 1):i + 1]
            else:
                window = spread[:i + 1]

            if len(window) < 2:
                z_scores.append(0.0)
            else:
                mean = statistics.mean(window)
                std = statistics.stdev(window)
                if std == 0:
                    z_scores.append(0.0)
                else:
                    z_scores.append(round((spread[i] - mean) / std, 4))
        return z_scores

    @staticmethod
    def percentile_rank(value: float, history: list[float]) -> float:
        if not history:
            return 50.0
        below = sum(1 for h in history if h < value)
        return round(below / len(history) * 100, 2)


# ═══════════════════════════════════════════════════════════════════════
# Cointegration Test (Engle-Granger simplified)
# ═══════════════════════════════════════════════════════════════════════

class CointegrationTest:
    """Simplified Engle-Granger two-step cointegration test."""

    @staticmethod
    def test(
        y: list[float],
        x: list[float],
        significance: float = 0.05,
    ) -> dict:
        """
        Step 1: Regress y on x to get residuals
        Step 2: Test residuals for stationarity (simplified ADF)
        """
        n = min(len(y), len(x))
        if n < 20:
            return {
                "cointegrated": False,
                "hedge_ratio": 0.0,
                "residual_adf_stat": 0.0,
                "p_value_approx": 1.0,
                "half_life": float('inf'),
            }

        # OLS regression
        reg = HedgeRatioEstimator.ols_hedge_ratio(y[:n], x[:n])
        beta = reg["beta"]
        alpha = reg["alpha"]

        # Calculate residuals
        residuals = [y[i] - (alpha + beta * x[i]) for i in range(n)]

        # Simplified ADF test on residuals
        adf_result = CointegrationTest._simplified_adf(residuals)

        # Half-life from OU model
        ou = OrnsteinUhlenbeckEstimator.fit(residuals)

        return {
            "cointegrated": adf_result["stationary"],
            "hedge_ratio": beta,
            "alpha": alpha,
            "r_squared": reg["r_squared"],
            "residual_adf_stat": adf_result["test_stat"],
            "p_value_approx": adf_result["p_value_approx"],
            "half_life": ou.half_life,
            "residual_mean": round(statistics.mean(residuals), 6),
            "residual_std": round(statistics.stdev(residuals), 6),
        }

    @staticmethod
    def _simplified_adf(series: list[float]) -> dict:
        """Simplified ADF: test regression of Δy on y_{t-1}."""
        n = len(series)
        if n < 10:
            return {"test_stat": 0.0, "p_value_approx": 1.0, "stationary": False}

        dy = [series[i] - series[i - 1] for i in range(1, n)]
        y_lag = series[:-1]

        # Regress dy on y_lag
        n_reg = len(dy)
        mx = statistics.mean(y_lag)
        my = statistics.mean(dy)
        cov = sum((y_lag[i] - mx) * (dy[i] - my) for i in range(n_reg)) / max(n_reg - 1, 1)
        var_x = sum((y_lag[i] - mx)**2 for i in range(n_reg)) / max(n_reg - 1, 1)

        if var_x == 0:
            return {"test_stat": 0.0, "p_value_approx": 1.0, "stationary": False}

        gamma = cov / var_x

        # Standard error of gamma
        alpha_hat = my - gamma * mx
        residuals = [dy[i] - (alpha_hat + gamma * y_lag[i]) for i in range(n_reg)]
        sse = sum(r**2 for r in residuals)
        se_gamma = math.sqrt(sse / max(n_reg - 2, 1) / max(var_x * (n_reg - 1), 1e-10))

        if se_gamma == 0:
            return {"test_stat": 0.0, "p_value_approx": 1.0, "stationary": False}

        t_stat = gamma / se_gamma

        # Approximate p-value using critical values for EG test
        # -3.34 (5%), -3.90 (1%) for n=100
        if t_stat < -3.90:
            p_approx = 0.01
        elif t_stat < -3.34:
            p_approx = 0.05
        elif t_stat < -2.86:
            p_approx = 0.10
        else:
            p_approx = 0.50

        return {
            "test_stat": round(t_stat, 4),
            "p_value_approx": p_approx,
            "stationary": t_stat < -3.34,
            "gamma": round(gamma, 6),
        }


# ═══════════════════════════════════════════════════════════════════════
# Ornstein-Uhlenbeck Estimator
# ═══════════════════════════════════════════════════════════════════════

class OrnsteinUhlenbeckEstimator:
    """Fit OU process: dX = θ(μ - X)dt + σ dW."""

    @staticmethod
    def fit(series: list[float], dt: float = 1.0 / 252) -> OUParameters:
        n = len(series)
        if n < 10:
            return OUParameters(theta=0, mu=0, sigma=0, half_life=float('inf'))

        # OLS: X_{t+1} = a + b*X_t + epsilon
        y = series[1:]
        x = series[:-1]

        mx = statistics.mean(x)
        my = statistics.mean(y)
        cov = sum((x[i] - mx) * (y[i] - my) for i in range(len(y))) / max(len(y) - 1, 1)
        var_x = sum((xi - mx)**2 for xi in x) / max(len(x) - 1, 1)

        if var_x == 0:
            return OUParameters(theta=0, mu=statistics.mean(series), sigma=0, half_life=float('inf'))

        b = cov / var_x
        a = my - b * mx

        if b >= 1 or b <= 0:
            return OUParameters(
                theta=0,
                mu=statistics.mean(series),
                sigma=statistics.stdev(series) if n > 1 else 0,
                half_life=float('inf'),
            )

        theta = -math.log(b) / dt
        mu = a / (1 - b)

        residuals = [y[i] - (a + b * x[i]) for i in range(len(y))]
        sigma_e = statistics.stdev(residuals) if len(residuals) > 1 else 0
        sigma = sigma_e * math.sqrt(2 * theta / (1 - b**2)) if (1 - b**2) > 0 and theta > 0 else sigma_e

        half_life = math.log(2) / theta if theta > 0 else float('inf')

        return OUParameters(
            theta=round(theta, 6),
            mu=round(mu, 6),
            sigma=round(sigma, 6),
            half_life=round(half_life, 2),
        )


# ═══════════════════════════════════════════════════════════════════════
# Mean Reversion Detector
# ═══════════════════════════════════════════════════════════════════════

class MeanReversionDetector:
    """Classify mean reversion strength of a series."""

    @staticmethod
    def classify(series: list[float]) -> dict:
        ou = OrnsteinUhlenbeckEstimator.fit(series)

        if ou.half_life == float('inf') or ou.theta <= 0:
            strength = MeanReversionStrength.NONE
        elif ou.half_life < 5:
            strength = MeanReversionStrength.VERY_STRONG
        elif ou.half_life < 15:
            strength = MeanReversionStrength.STRONG
        elif ou.half_life < 30:
            strength = MeanReversionStrength.MODERATE
        elif ou.half_life < 60:
            strength = MeanReversionStrength.WEAK
        else:
            strength = MeanReversionStrength.NONE

        # Variance ratio test (simplified)
        vr = MeanReversionDetector._variance_ratio(series, lag=10)

        return {
            "strength": strength.value,
            "half_life": ou.half_life,
            "theta": ou.theta,
            "mu": ou.mu,
            "variance_ratio": vr,
            "mean_reverting": strength != MeanReversionStrength.NONE,
        }

    @staticmethod
    def _variance_ratio(series: list[float], lag: int = 10) -> float:
        """Variance ratio test: VR(k) = Var(k-period returns) / (k * Var(1-period returns))."""
        n = len(series)
        if n < lag + 2:
            return 1.0

        returns_1 = [series[i] - series[i - 1] for i in range(1, n)]
        returns_k = [series[i] - series[i - lag] for i in range(lag, n)]

        if len(returns_1) < 2 or len(returns_k) < 2:
            return 1.0

        var_1 = statistics.variance(returns_1)
        var_k = statistics.variance(returns_k)

        if var_1 == 0 or lag == 0:
            return 1.0
        return round(var_k / (lag * var_1), 4)


# ═══════════════════════════════════════════════════════════════════════
# Signal Generator
# ═══════════════════════════════════════════════════════════════════════

class StatArbSignalGenerator:
    """Generate trading signals from spread z-scores."""

    @staticmethod
    def generate_signal(
        z_score: float,
        entry_threshold: float = 2.0,
        exit_threshold: float = 0.5,
        stop_threshold: float = 4.0,
    ) -> SpreadSignal:
        if abs(z_score) > stop_threshold:
            return SpreadSignal.STOP_LOSS
        if z_score < -entry_threshold:
            return SpreadSignal.BUY if z_score > -(entry_threshold * 1.5) else SpreadSignal.STRONG_BUY
        if z_score > entry_threshold:
            return SpreadSignal.SELL if z_score < (entry_threshold * 1.5) else SpreadSignal.STRONG_SELL
        if abs(z_score) < exit_threshold:
            return SpreadSignal.HOLD
        return SpreadSignal.HOLD

    @staticmethod
    def backtest_signals(
        spread: list[float],
        entry: float = 2.0,
        exit_threshold: float = 0.5,
        stop: float = 4.0,
    ) -> dict:
        """Simple signal backtest."""
        z_scores = SpreadCalculator.z_score(spread, lookback=60)
        trades = []
        in_trade = False
        entry_z = 0.0
        entry_spread = 0.0
        trade_type = ""

        for i, z in enumerate(z_scores):
            signal = StatArbSignalGenerator.generate_signal(z, entry, exit_threshold, stop)

            if not in_trade:
                if signal in (SpreadSignal.BUY, SpreadSignal.STRONG_BUY):
                    in_trade = True
                    entry_z = z
                    entry_spread = spread[i]
                    trade_type = "long"
                elif signal in (SpreadSignal.SELL, SpreadSignal.STRONG_SELL):
                    in_trade = True
                    entry_z = z
                    entry_spread = spread[i]
                    trade_type = "short"
            else:
                if signal == SpreadSignal.HOLD or signal == SpreadSignal.STOP_LOSS:
                    pnl = (spread[i] - entry_spread) if trade_type == "long" else (entry_spread - spread[i])
                    trades.append({
                        "entry_idx": i - 1,
                        "exit_idx": i,
                        "type": trade_type,
                        "pnl": round(pnl, 6),
                        "exit_reason": "mean_reversion" if signal == SpreadSignal.HOLD else "stop_loss",
                    })
                    in_trade = False

        wins = [t for t in trades if t["pnl"] > 0]
        return {
            "total_trades": len(trades),
            "wins": len(wins),
            "losses": len(trades) - len(wins),
            "win_rate": round(len(wins) / max(len(trades), 1) * 100, 2),
            "total_pnl": round(sum(t["pnl"] for t in trades), 6),
            "avg_pnl": round(statistics.mean([t["pnl"] for t in trades]), 6) if trades else 0,
            "trades": trades,
        }


# ═══════════════════════════════════════════════════════════════════════
# Pairs Ranker
# ═══════════════════════════════════════════════════════════════════════

class PairsRanker:
    """Rank potential pairs for stat arb."""

    @staticmethod
    def rank_pairs(
        universe: dict[str, list[float]],
        min_correlation: float = 0.7,
        max_half_life: float = 30,
    ) -> list[PairCandidate]:
        symbols = list(universe.keys())
        candidates = []

        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                sa, sb = symbols[i], symbols[j]
                corr = CorrelationCalculator.pearson(universe[sa], universe[sb])

                if abs(corr) < min_correlation:
                    continue

                hedge = HedgeRatioEstimator.ols_hedge_ratio(universe[sa], universe[sb])
                spread = SpreadCalculator.price_spread(universe[sa], universe[sb], hedge["beta"])

                if len(spread) < 20:
                    continue

                ou = OrnsteinUhlenbeckEstimator.fit(spread)
                if ou.half_life > max_half_life or ou.half_life == float('inf'):
                    continue

                # Score: higher correlation + lower half-life + higher R²
                score = abs(corr) * 0.3 + (1 - ou.half_life / max_half_life) * 0.4 + hedge["r_squared"] * 0.3

                candidates.append(PairCandidate(
                    symbol_a=sa,
                    symbol_b=sb,
                    correlation=corr,
                    hedge_ratio=hedge["beta"],
                    spread_mean=statistics.mean(spread),
                    spread_std=statistics.stdev(spread) if len(spread) > 1 else 0,
                    half_life=ou.half_life,
                    score=score,
                ))

        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates


# ═══════════════════════════════════════════════════════════════════════
# Orchestrator
# ═══════════════════════════════════════════════════════════════════════

class StatisticalArbitrageEngine:
    """Top-level statistical arbitrage engine."""

    def __init__(self):
        self.corr = CorrelationCalculator()
        self.hedge = HedgeRatioEstimator()
        self.spread_calc = SpreadCalculator()
        self.coint = CointegrationTest()
        self.ou = OrnsteinUhlenbeckEstimator()
        self.mr_detector = MeanReversionDetector()
        self.signal_gen = StatArbSignalGenerator()
        self.ranker = PairsRanker()

    def analyze_pair(
        self,
        prices_a: list[float],
        prices_b: list[float],
        symbol_a: str = "A",
        symbol_b: str = "B",
    ) -> dict:
        corr = self.corr.pearson(prices_a, prices_b)
        hedge = self.hedge.ols_hedge_ratio(prices_a, prices_b)
        spread = self.spread_calc.price_spread(prices_a, prices_b, hedge["beta"])
        coint = self.coint.test(prices_a, prices_b)

        z_scores = self.spread_calc.z_score(spread, lookback=60)
        current_z = z_scores[-1] if z_scores else 0.0
        signal = self.signal_gen.generate_signal(current_z)

        mr = self.mr_detector.classify(spread)

        return {
            "pair": f"{symbol_a}/{symbol_b}",
            "correlation": corr,
            "hedge_ratio": hedge["beta"],
            "r_squared": hedge["r_squared"],
            "cointegrated": coint["cointegrated"],
            "half_life": coint["half_life"],
            "current_z_score": current_z,
            "signal": signal.value,
            "mean_reversion": mr,
        }

    def scan_universe(
        self,
        universe: dict[str, list[float]],
        min_correlation: float = 0.7,
    ) -> list[dict]:
        candidates = self.ranker.rank_pairs(universe, min_correlation)
        return [c.to_dict() for c in candidates]

    def spread_state(
        self,
        prices_a: list[float],
        prices_b: list[float],
        hedge_ratio: float = 1.0,
    ) -> dict:
        spread = self.spread_calc.price_spread(prices_a, prices_b, hedge_ratio)
        if not spread:
            return {"error": "insufficient data"}

        z_scores = self.spread_calc.z_score(spread, lookback=60)
        current_z = z_scores[-1] if z_scores else 0.0
        signal = self.signal_gen.generate_signal(current_z)
        percentile = self.spread_calc.percentile_rank(spread[-1], spread)

        state = SpreadState(
            current_spread=spread[-1],
            z_score=current_z,
            signal=signal,
            spread_mean=statistics.mean(spread),
            spread_std=statistics.stdev(spread) if len(spread) > 1 else 0,
            percentile=percentile,
        )
        return state.to_dict()

    def capabilities(self) -> dict:
        return {
            "engine": "StatisticalArbitrageEngine",
            "version": "1.0.0",
            "features": [
                "pearson_spearman_correlation",
                "rolling_correlation",
                "ols_hedge_ratio",
                "total_least_squares_hedge",
                "rolling_hedge_ratio",
                "price_log_ratio_spread",
                "z_score_signals",
                "engle_granger_cointegration",
                "simplified_adf_test",
                "ornstein_uhlenbeck_fitting",
                "mean_reversion_classification",
                "variance_ratio_test",
                "signal_generation_entry_exit",
                "signal_backtesting",
                "pairs_ranking_scoring",
                "universe_scanning",
            ],
        }
