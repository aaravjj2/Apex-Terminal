"""
Statistical Arbitrage Engine — Pairs trading, mean reversion, cointegration, and spread analysis.

Covers:
  - Pairs selection (correlation + cointegration screening)
  - Engle-Granger cointegration test (ADF on spread)
  - Spread calculation (price ratio and OLS residual)
  - Z-score calculation and z-score mean reversion signals
  - Half-life of mean reversion (Ornstein-Uhlenbeck)
  - Hurst exponent (mean-reverting vs trending)
  - Optimal hedge ratio (OLS regression)
  - Rolling z-score bands
  - Entry/exit signal generation
  - Pairs P&L simulation
  - Distance method pairs ranking
  - Multi-pair portfolio construction
  - Risk metrics for stat arb strategies
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ── Enums ───────────────────────────────────────────────────────────────

class SpreadMethod(Enum):
    RATIO = "ratio"
    RESIDUAL = "residual"
    LOG_RATIO = "log_ratio"


class SignalType(Enum):
    ENTRY_LONG = "entry_long"    # spread below -threshold → buy spread
    ENTRY_SHORT = "entry_short"  # spread above +threshold → sell spread
    EXIT = "exit"                # spread reverts to mean
    STOP = "stop"                # spread hits stop level
    NONE = "none"


# ── Data Classes ────────────────────────────────────────────────────────

@dataclass
class PairCandidate:
    """A candidate pair for stat arb."""
    symbol_a: str
    symbol_b: str
    correlation: float
    cointegration_pvalue: float
    hedge_ratio: float
    half_life: float
    hurst_exponent: float
    spread_std: float

    @property
    def is_cointegrated(self) -> bool:
        return self.cointegration_pvalue < 0.05

    @property
    def is_mean_reverting(self) -> bool:
        return self.hurst_exponent < 0.5

    @property
    def quality_score(self) -> float:
        """Score 0-100 for pair quality."""
        score = 0.0
        # Correlation component (higher = better but not too high)
        corr_abs = abs(self.correlation)
        if 0.7 <= corr_abs <= 0.95:
            score += 30
        elif 0.5 <= corr_abs < 0.7:
            score += 15

        # Cointegration (lower p-value = better)
        if self.cointegration_pvalue < 0.01:
            score += 30
        elif self.cointegration_pvalue < 0.05:
            score += 20
        elif self.cointegration_pvalue < 0.10:
            score += 10

        # Hurst (lower = more mean-reverting)
        if self.hurst_exponent < 0.3:
            score += 25
        elif self.hurst_exponent < 0.5:
            score += 15

        # Half-life (3-50 days is tradeable)
        if 3 <= self.half_life <= 50:
            score += 15
        elif 1 <= self.half_life <= 100:
            score += 7

        return round(score, 2)

    def to_dict(self) -> dict:
        return {
            "symbol_a": self.symbol_a,
            "symbol_b": self.symbol_b,
            "correlation": round(self.correlation, 4),
            "cointegration_pvalue": round(self.cointegration_pvalue, 4),
            "hedge_ratio": round(self.hedge_ratio, 4),
            "half_life": round(self.half_life, 2),
            "hurst_exponent": round(self.hurst_exponent, 4),
            "spread_std": round(self.spread_std, 4),
            "is_cointegrated": self.is_cointegrated,
            "is_mean_reverting": self.is_mean_reverting,
            "quality_score": self.quality_score,
        }


@dataclass
class SpreadSignal:
    """A trading signal generated from spread analysis."""
    date_idx: int
    signal_type: SignalType
    z_score: float
    spread_value: float
    symbol_a_action: str  # "buy" or "sell"
    symbol_b_action: str  # "buy" or "sell"

    def to_dict(self) -> dict:
        return {
            "date_idx": self.date_idx,
            "signal_type": self.signal_type.value,
            "z_score": round(self.z_score, 4),
            "spread_value": round(self.spread_value, 4),
            "symbol_a_action": self.symbol_a_action,
            "symbol_b_action": self.symbol_b_action,
        }


# ── Correlation & Cointegration ─────────────────────────────────────────

class CorrelationScreener:
    """Screen pairs by correlation."""

    @staticmethod
    def pearson_correlation(x: list[float], y: list[float]) -> float:
        n = min(len(x), len(y))
        if n < 3:
            return 0.0
        x, y = x[:n], y[:n]
        mx = statistics.mean(x)
        my = statistics.mean(y)
        cov = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y)) / n
        sx = math.sqrt(sum((xi - mx) ** 2 for xi in x) / n)
        sy = math.sqrt(sum((yi - my) ** 2 for yi in y) / n)
        if sx == 0 or sy == 0:
            return 0.0
        return cov / (sx * sy)

    @staticmethod
    def rank_pairs_by_correlation(
        prices: dict[str, list[float]], min_corr: float = 0.7
    ) -> list[dict]:
        """Rank all pairs by correlation."""
        symbols = list(prices.keys())
        pairs = []
        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                corr = CorrelationScreener.pearson_correlation(
                    prices[symbols[i]], prices[symbols[j]]
                )
                if abs(corr) >= min_corr:
                    pairs.append({
                        "symbol_a": symbols[i],
                        "symbol_b": symbols[j],
                        "correlation": round(corr, 4),
                    })
        pairs.sort(key=lambda p: abs(p["correlation"]), reverse=True)
        return pairs


class CointegrationTester:
    """Test for cointegration using simplified ADF approach."""

    @staticmethod
    def ols_regression(y: list[float], x: list[float]) -> tuple[float, float, list[float]]:
        """
        Simple OLS: y = alpha + beta * x + residuals.
        Returns (alpha, beta, residuals).
        """
        n = min(len(y), len(x))
        y, x = y[:n], x[:n]
        mx = statistics.mean(x)
        my = statistics.mean(y)
        cov = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
        var_x = sum((xi - mx) ** 2 for xi in x)
        beta = cov / var_x if var_x != 0 else 0.0
        alpha = my - beta * mx
        residuals = [yi - (alpha + beta * xi) for yi, xi in zip(y, x)]
        return alpha, beta, residuals

    @staticmethod
    def adf_test_simplified(series: list[float]) -> tuple[float, float]:
        """
        Simplified ADF test statistic.
        Returns (adf_stat, approximate_pvalue).
        ADF stat = (rho - 1) / std_error where dy = (rho-1)*y_lag + error.
        """
        if len(series) < 10:
            return 0.0, 1.0

        dy = [series[i] - series[i - 1] for i in range(1, len(series))]
        y_lag = series[:-1]
        n = len(dy)

        # OLS: dy = gamma * y_lag + e  where gamma = rho - 1
        my = statistics.mean(y_lag)
        mdy = statistics.mean(dy)
        cov = sum((y_lag[i] - my) * (dy[i] - mdy) for i in range(n)) / n
        var_y = sum((y_lag[i] - my) ** 2 for i in range(n)) / n
        gamma = cov / var_y if var_y != 0 else 0.0

        # Residuals
        residuals = [dy[i] - gamma * y_lag[i] for i in range(n)]
        sse = sum(r ** 2 for r in residuals)
        se_gamma = math.sqrt(sse / (n - 1) / (var_y * n)) if var_y > 0 and n > 1 else 1.0
        adf_stat = gamma / se_gamma if se_gamma != 0 else 0.0

        # Approximate p-value from ADF critical values (n>100)
        # -3.43 → 1%, -2.86 → 5%, -2.57 → 10%
        if adf_stat < -3.43:
            p_val = 0.005
        elif adf_stat < -2.86:
            p_val = 0.03
        elif adf_stat < -2.57:
            p_val = 0.07
        elif adf_stat < -1.94:
            p_val = 0.15
        else:
            p_val = 0.5 + (adf_stat + 1.94) * 0.1  # rough linear extrapolation
            p_val = min(max(p_val, 0.15), 1.0)

        return adf_stat, p_val

    def test_cointegration(
        self, prices_a: list[float], prices_b: list[float]
    ) -> dict:
        """
        Engle-Granger two-step cointegration test.
        Step 1: OLS regression  y = a + b*x
        Step 2: ADF test on residuals
        """
        alpha, beta, residuals = self.ols_regression(prices_a, prices_b)
        adf_stat, p_val = self.adf_test_simplified(residuals)

        return {
            "hedge_ratio": round(beta, 4),
            "intercept": round(alpha, 4),
            "adf_statistic": round(adf_stat, 4),
            "p_value": round(p_val, 4),
            "is_cointegrated": p_val < 0.05,
            "residual_std": round(statistics.stdev(residuals), 4) if len(residuals) > 1 else 0.0,
        }


# ── Spread Calculator ──────────────────────────────────────────────────

class SpreadCalculator:
    """Calculate and analyze spreads between two price series."""

    @staticmethod
    def ratio_spread(prices_a: list[float], prices_b: list[float]) -> list[float]:
        """Spread = price_a / price_b."""
        n = min(len(prices_a), len(prices_b))
        return [prices_a[i] / prices_b[i] if prices_b[i] != 0 else 0 for i in range(n)]

    @staticmethod
    def log_ratio_spread(prices_a: list[float], prices_b: list[float]) -> list[float]:
        """Spread = log(price_a / price_b)."""
        n = min(len(prices_a), len(prices_b))
        return [
            math.log(prices_a[i] / prices_b[i]) if prices_b[i] > 0 and prices_a[i] > 0 else 0
            for i in range(n)
        ]

    @staticmethod
    def residual_spread(prices_a: list[float], prices_b: list[float]) -> tuple[list[float], float]:
        """Spread = price_a - hedge_ratio * price_b (OLS residual)."""
        _, beta, residuals = CointegrationTester.ols_regression(prices_a, prices_b)
        return residuals, beta

    @staticmethod
    def z_score(spread: list[float], lookback: int = 20) -> list[float]:
        """Rolling z-score of the spread."""
        result = []
        for i in range(len(spread)):
            window = spread[max(0, i - lookback + 1):i + 1]
            if len(window) < 2:
                result.append(0.0)
                continue
            mean = statistics.mean(window)
            std = statistics.stdev(window) if len(window) > 1 else 1.0
            z = (spread[i] - mean) / std if std > 0 else 0.0
            result.append(z)
        return result


# ── Half-Life & Hurst ──────────────────────────────────────────────────

class MeanReversionAnalyzer:
    """Analyze mean reversion properties of a spread."""

    @staticmethod
    def half_life(spread: list[float]) -> float:
        """
        Half-life of mean reversion using OU process.
        dy = lambda * (y - mean) → half_life = -log(2) / lambda.
        """
        if len(spread) < 10:
            return float("inf")

        dy = [spread[i] - spread[i - 1] for i in range(1, len(spread))]
        y_lag = spread[:-1]
        n = len(dy)

        # OLS: dy = gamma * y_lag + e
        my = statistics.mean(y_lag)
        mdy = statistics.mean(dy)
        cov = sum((y_lag[i] - my) * (dy[i] - mdy) for i in range(n))
        var_y = sum((y_lag[i] - my) ** 2 for i in range(n))
        gamma = cov / var_y if var_y != 0 else 0.0

        if gamma >= 0:
            return float("inf")  # not mean reverting

        half_life = -math.log(2) / gamma
        return max(half_life, 0.1)  # clamp to positive

    @staticmethod
    def hurst_exponent(series: list[float], max_lag: int = 20) -> float:
        """
        Hurst exponent using R/S analysis (simplified).
        H < 0.5 → mean reverting, H = 0.5 → random walk, H > 0.5 → trending.
        """
        if len(series) < max_lag * 2:
            return 0.5  # default to random walk

        # Compute variance of lagged differences
        lags = list(range(2, min(max_lag + 1, len(series) // 2)))
        if len(lags) < 3:
            return 0.5

        log_lags = []
        log_vars = []
        for lag in lags:
            diffs = [series[i] - series[i - lag] for i in range(lag, len(series))]
            if not diffs:
                continue
            variance = statistics.variance(diffs) if len(diffs) > 1 else 0.0
            if variance > 0:
                log_lags.append(math.log(lag))
                log_vars.append(math.log(variance))

        if len(log_lags) < 3:
            return 0.5

        # OLS: log(var) = H * 2 * log(lag) + c  → H = slope/2
        mx = statistics.mean(log_lags)
        my = statistics.mean(log_vars)
        cov = sum((log_lags[i] - mx) * (log_vars[i] - my) for i in range(len(log_lags)))
        var_x = sum((log_lags[i] - mx) ** 2 for i in range(len(log_lags)))
        slope = cov / var_x if var_x != 0 else 1.0
        hurst = slope / 2.0
        return max(0.0, min(1.0, hurst))  # clamp [0, 1]


# ── Signal Generator ───────────────────────────────────────────────────

class StatArbSignalGenerator:
    """Generate entry/exit signals for pairs trades."""

    def __init__(
        self,
        entry_z: float = 2.0,
        exit_z: float = 0.5,
        stop_z: float = 3.5,
    ) -> None:
        self.entry_z = entry_z
        self.exit_z = exit_z
        self.stop_z = stop_z

    def generate_signals(self, z_scores: list[float]) -> list[SpreadSignal]:
        """Generate trading signals from z-score series."""
        signals = []
        in_position = False
        position_direction = None  # "long" or "short"

        for i, z in enumerate(z_scores):
            if not in_position:
                if z <= -self.entry_z:
                    # Spread below -entry → buy spread (long A, short B)
                    signals.append(SpreadSignal(
                        date_idx=i,
                        signal_type=SignalType.ENTRY_LONG,
                        z_score=z,
                        spread_value=z,  # using z-score as proxy
                        symbol_a_action="buy",
                        symbol_b_action="sell",
                    ))
                    in_position = True
                    position_direction = "long"
                elif z >= self.entry_z:
                    # Spread above +entry → sell spread (short A, long B)
                    signals.append(SpreadSignal(
                        date_idx=i,
                        signal_type=SignalType.ENTRY_SHORT,
                        z_score=z,
                        spread_value=z,
                        symbol_a_action="sell",
                        symbol_b_action="buy",
                    ))
                    in_position = True
                    position_direction = "short"
            else:
                # Check for exit or stop
                if position_direction == "long":
                    if z >= -self.exit_z:
                        signals.append(SpreadSignal(
                            date_idx=i, signal_type=SignalType.EXIT,
                            z_score=z, spread_value=z,
                            symbol_a_action="sell", symbol_b_action="buy",
                        ))
                        in_position = False
                    elif z <= -self.stop_z:
                        signals.append(SpreadSignal(
                            date_idx=i, signal_type=SignalType.STOP,
                            z_score=z, spread_value=z,
                            symbol_a_action="sell", symbol_b_action="buy",
                        ))
                        in_position = False
                elif position_direction == "short":
                    if z <= self.exit_z:
                        signals.append(SpreadSignal(
                            date_idx=i, signal_type=SignalType.EXIT,
                            z_score=z, spread_value=z,
                            symbol_a_action="buy", symbol_b_action="sell",
                        ))
                        in_position = False
                    elif z >= self.stop_z:
                        signals.append(SpreadSignal(
                            date_idx=i, signal_type=SignalType.STOP,
                            z_score=z, spread_value=z,
                            symbol_a_action="buy", symbol_b_action="sell",
                        ))
                        in_position = False

        return signals


# ── Pairs P&L Simulator ────────────────────────────────────────────────

class PairsPnLSimulator:
    """Simulate P&L for a pairs trade."""

    @staticmethod
    def simulate(
        prices_a: list[float],
        prices_b: list[float],
        signals: list[SpreadSignal],
        capital_per_leg: float = 50000.0,
        commission_per_trade: float = 2.0,
    ) -> dict:
        """Simulate P&L from signals."""
        trades = []
        total_pnl = 0.0
        total_commission = 0.0

        # Pair up entry/exit signals
        entries = [s for s in signals if s.signal_type in (SignalType.ENTRY_LONG, SignalType.ENTRY_SHORT)]
        exits = [s for s in signals if s.signal_type in (SignalType.EXIT, SignalType.STOP)]

        n_trades = min(len(entries), len(exits))
        n_prices = min(len(prices_a), len(prices_b))

        for i in range(n_trades):
            entry = entries[i]
            exit_sig = exits[i]

            if entry.date_idx >= n_prices or exit_sig.date_idx >= n_prices:
                continue

            entry_a = prices_a[entry.date_idx]
            entry_b = prices_b[entry.date_idx]
            exit_a = prices_a[exit_sig.date_idx]
            exit_b = prices_b[exit_sig.date_idx]

            if entry_a == 0 or entry_b == 0:
                continue

            qty_a = capital_per_leg / entry_a
            qty_b = capital_per_leg / entry_b

            if entry.signal_type == SignalType.ENTRY_LONG:
                # Long A, short B
                pnl_a = (exit_a - entry_a) * qty_a
                pnl_b = (entry_b - exit_b) * qty_b
            else:
                # Short A, long B
                pnl_a = (entry_a - exit_a) * qty_a
                pnl_b = (exit_b - entry_b) * qty_b

            trade_pnl = pnl_a + pnl_b - commission_per_trade * 4  # 4 legs
            total_pnl += trade_pnl
            total_commission += commission_per_trade * 4

            trades.append({
                "entry_idx": entry.date_idx,
                "exit_idx": exit_sig.date_idx,
                "direction": "long_spread" if entry.signal_type == SignalType.ENTRY_LONG else "short_spread",
                "exit_type": exit_sig.signal_type.value,
                "pnl": round(trade_pnl, 2),
                "holding_period": exit_sig.date_idx - entry.date_idx,
            })

        winners = [t for t in trades if t["pnl"] > 0]
        losers = [t for t in trades if t["pnl"] <= 0]

        return {
            "total_trades": len(trades),
            "winners": len(winners),
            "losers": len(losers),
            "win_rate": round(len(winners) / len(trades), 4) if trades else 0.0,
            "total_pnl": round(total_pnl, 2),
            "total_commission": round(total_commission, 2),
            "avg_pnl": round(total_pnl / len(trades), 2) if trades else 0.0,
            "avg_holding_period": round(
                statistics.mean(t["holding_period"] for t in trades), 2
            ) if trades else 0,
            "trades": trades,
        }


# ── Distance Method ────────────────────────────────────────────────────

class DistanceMethodRanker:
    """Rank pairs using distance method (sum of squared differences of normalized prices)."""

    @staticmethod
    def normalize(prices: list[float]) -> list[float]:
        """Normalize prices to start at 1.0."""
        if not prices or prices[0] == 0:
            return prices
        return [p / prices[0] for p in prices]

    @staticmethod
    def squared_distance(norm_a: list[float], norm_b: list[float]) -> float:
        """Sum of squared differences."""
        n = min(len(norm_a), len(norm_b))
        return sum((norm_a[i] - norm_b[i]) ** 2 for i in range(n))

    def rank_pairs(self, prices: dict[str, list[float]], top_n: int = 10) -> list[dict]:
        """Rank all pairs by minimum distance (normalized price)."""
        symbols = list(prices.keys())
        normalized = {s: self.normalize(prices[s]) for s in symbols}

        pairs = []
        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                dist = self.squared_distance(
                    normalized[symbols[i]], normalized[symbols[j]]
                )
                pairs.append({
                    "symbol_a": symbols[i],
                    "symbol_b": symbols[j],
                    "distance": round(dist, 6),
                })

        pairs.sort(key=lambda p: p["distance"])
        return pairs[:top_n]


# ── Multi-Pair Portfolio Builder ────────────────────────────────────────

class MultiPairPortfolio:
    """Build a portfolio of pairs trades."""

    @staticmethod
    def select_uncorrelated_pairs(
        candidates: list[PairCandidate],
        max_pairs: int = 5,
    ) -> list[PairCandidate]:
        """Select pairs that don't share symbols (for diversification)."""
        selected = []
        used_symbols: set[str] = set()

        # Sort by quality score
        sorted_candidates = sorted(candidates, key=lambda c: c.quality_score, reverse=True)

        for c in sorted_candidates:
            if c.symbol_a not in used_symbols and c.symbol_b not in used_symbols:
                selected.append(c)
                used_symbols.add(c.symbol_a)
                used_symbols.add(c.symbol_b)
                if len(selected) >= max_pairs:
                    break

        return selected

    @staticmethod
    def portfolio_allocation(
        pairs: list[PairCandidate],
        total_capital: float = 500000.0,
        method: str = "equal",
    ) -> list[dict]:
        """Allocate capital to pairs."""
        if not pairs:
            return []

        if method == "quality_weighted":
            total_score = sum(p.quality_score for p in pairs)
            if total_score == 0:
                method = "equal"

        allocations = []
        for p in pairs:
            if method == "equal":
                alloc = total_capital / len(pairs)
            elif method == "quality_weighted":
                alloc = total_capital * (p.quality_score / total_score)
            else:
                alloc = total_capital / len(pairs)

            allocations.append({
                "symbol_a": p.symbol_a,
                "symbol_b": p.symbol_b,
                "quality_score": p.quality_score,
                "capital_allocated": round(alloc, 2),
                "per_leg": round(alloc / 2, 2),
            })

        return allocations


# ── Risk Metrics ────────────────────────────────────────────────────────

class StatArbRiskMetrics:
    """Risk metrics specific to statistical arbitrage."""

    @staticmethod
    def spread_risk(spread: list[float]) -> dict:
        """Risk metrics for a spread."""
        if len(spread) < 2:
            return {"insufficient_data": True}

        mean = statistics.mean(spread)
        std = statistics.stdev(spread)
        returns = [(spread[i] - spread[i - 1]) / abs(spread[i - 1])
                    for i in range(1, len(spread)) if spread[i - 1] != 0]

        max_spread = max(spread)
        min_spread = min(spread)

        # Spread drawdown (deviation from mean)
        deviations = [abs(s - mean) for s in spread]
        max_deviation = max(deviations) if deviations else 0.0

        return {
            "mean": round(mean, 4),
            "std": round(std, 4),
            "max": round(max_spread, 4),
            "min": round(min_spread, 4),
            "range": round(max_spread - min_spread, 4),
            "max_deviation_from_mean": round(max_deviation, 4),
            "current_z": round((spread[-1] - mean) / std, 4) if std > 0 else 0.0,
            "return_vol": round(statistics.stdev(returns) * 100, 4) if len(returns) > 1 else 0.0,
        }

    @staticmethod
    def correlation_breakdown_risk(
        prices_a: list[float],
        prices_b: list[float],
        window: int = 20,
    ) -> dict:
        """Assess risk of correlation breakdown."""
        n = min(len(prices_a), len(prices_b))
        if n < window * 2:
            return {"insufficient_data": True}

        # Rolling correlation
        correlations = []
        for i in range(window, n):
            wa = prices_a[i - window:i]
            wb = prices_b[i - window:i]
            corr = CorrelationScreener.pearson_correlation(wa, wb)
            correlations.append(corr)

        if not correlations:
            return {"insufficient_data": True}

        min_corr = min(correlations)
        max_corr = max(correlations)
        avg_corr = statistics.mean(correlations)
        current_corr = correlations[-1]

        # Correlation is "breaking down" if current is significantly below average
        breakdown_risk = "low"
        if current_corr < avg_corr - 0.3:
            breakdown_risk = "high"
        elif current_corr < avg_corr - 0.15:
            breakdown_risk = "medium"

        return {
            "current_correlation": round(current_corr, 4),
            "avg_correlation": round(avg_corr, 4),
            "min_correlation": round(min_corr, 4),
            "max_correlation": round(max_corr, 4),
            "correlation_std": round(statistics.stdev(correlations), 4) if len(correlations) > 1 else 0,
            "breakdown_risk": breakdown_risk,
        }


# ── Orchestrator ────────────────────────────────────────────────────────

class StatisticalArbEngine:
    """Top-level orchestrator for statistical arbitrage analysis."""

    def __init__(self) -> None:
        self._corr_screener = CorrelationScreener()
        self._coint_tester = CointegrationTester()
        self._spread_calc = SpreadCalculator()
        self._mr_analyzer = MeanReversionAnalyzer()
        self._signal_gen = StatArbSignalGenerator()
        self._pnl_sim = PairsPnLSimulator()
        self._distance_ranker = DistanceMethodRanker()
        self._portfolio = MultiPairPortfolio()
        self._risk = StatArbRiskMetrics()

    def screen_pairs(
        self,
        prices: dict[str, list[float]],
        min_correlation: float = 0.7,
    ) -> list[dict]:
        """Screen all pairs by correlation."""
        return self._corr_screener.rank_pairs_by_correlation(prices, min_correlation)

    def analyze_pair(
        self,
        prices_a: list[float],
        prices_b: list[float],
        symbol_a: str = "A",
        symbol_b: str = "B",
    ) -> dict:
        """Full analysis of a single pair."""
        # Cointegration
        coint = self._coint_tester.test_cointegration(prices_a, prices_b)

        # Spread
        residuals, hedge_ratio = self._spread_calc.residual_spread(prices_a, prices_b)

        # Z-scores
        z_scores = self._spread_calc.z_score(residuals)

        # Mean reversion properties
        hl = self._mr_analyzer.half_life(residuals)
        hurst = self._mr_analyzer.hurst_exponent(residuals)

        # Correlation
        corr = self._corr_screener.pearson_correlation(prices_a, prices_b)

        # Spread risk
        spread_risk = self._risk.spread_risk(residuals)

        candidate = PairCandidate(
            symbol_a=symbol_a,
            symbol_b=symbol_b,
            correlation=corr,
            cointegration_pvalue=coint["p_value"],
            hedge_ratio=hedge_ratio,
            half_life=hl if hl != float("inf") else 999.0,
            hurst_exponent=hurst,
            spread_std=coint["residual_std"],
        )

        return {
            "pair": candidate.to_dict(),
            "cointegration": coint,
            "half_life": round(hl, 2) if hl != float("inf") else "inf",
            "hurst_exponent": round(hurst, 4),
            "spread_risk": spread_risk,
            "current_z_score": round(z_scores[-1], 4) if z_scores else 0.0,
        }

    def generate_signals(
        self,
        prices_a: list[float],
        prices_b: list[float],
        entry_z: float = 2.0,
        exit_z: float = 0.5,
        stop_z: float = 3.5,
        z_lookback: int = 20,
    ) -> list[dict]:
        """Generate trading signals for a pair."""
        residuals, _ = self._spread_calc.residual_spread(prices_a, prices_b)
        z_scores = self._spread_calc.z_score(residuals, z_lookback)
        gen = StatArbSignalGenerator(entry_z, exit_z, stop_z)
        signals = gen.generate_signals(z_scores)
        return [s.to_dict() for s in signals]

    def backtest_pair(
        self,
        prices_a: list[float],
        prices_b: list[float],
        entry_z: float = 2.0,
        exit_z: float = 0.5,
        stop_z: float = 3.5,
        capital_per_leg: float = 50000.0,
    ) -> dict:
        """Backtest a pairs trading strategy."""
        residuals, _ = self._spread_calc.residual_spread(prices_a, prices_b)
        z_scores = self._spread_calc.z_score(residuals)
        gen = StatArbSignalGenerator(entry_z, exit_z, stop_z)
        signals = gen.generate_signals(z_scores)
        return self._pnl_sim.simulate(prices_a, prices_b, signals, capital_per_leg)

    def distance_ranking(
        self, prices: dict[str, list[float]], top_n: int = 10
    ) -> list[dict]:
        """Rank pairs by distance method."""
        return self._distance_ranker.rank_pairs(prices, top_n)

    def correlation_risk(
        self,
        prices_a: list[float],
        prices_b: list[float],
        window: int = 20,
    ) -> dict:
        """Assess correlation breakdown risk."""
        return self._risk.correlation_breakdown_risk(prices_a, prices_b, window)

    def build_portfolio(
        self,
        candidates: list[PairCandidate],
        total_capital: float = 500000.0,
        max_pairs: int = 5,
        method: str = "equal",
    ) -> dict:
        """Build a diversified pairs portfolio."""
        selected = self._portfolio.select_uncorrelated_pairs(candidates, max_pairs)
        allocations = self._portfolio.portfolio_allocation(selected, total_capital, method)
        return {
            "selected_pairs": len(selected),
            "total_capital": total_capital,
            "method": method,
            "allocations": allocations,
        }

    def capabilities(self) -> dict:
        return {
            "engine": "StatisticalArbEngine",
            "version": "1.0.0",
            "features": [
                "correlation_screening",
                "cointegration_testing",
                "spread_calculation",
                "z_score_analysis",
                "half_life_estimation",
                "hurst_exponent",
                "signal_generation",
                "pairs_backtesting",
                "distance_method_ranking",
                "multi_pair_portfolio",
                "correlation_breakdown_risk",
                "spread_risk_metrics",
            ],
        }
