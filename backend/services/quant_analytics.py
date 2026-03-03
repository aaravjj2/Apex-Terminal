"""
┌───────────────────────────────────────────────────────────────────────┐
│  APEX TERMINAL — Quantitative Analytics Engine                       │
│  Factor models, statistical analysis, time series decomposition,     │
│  regime detection, correlation analysis, and risk decomposition      │
└───────────────────────────────────────────────────────────────────────┘
"""

import math
import statistics
import random
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# SECTION 1: DATA TYPES
# ══════════════════════════════════════════════════════════════════════

class RegimeType(str, Enum):
    BULL_QUIET = "bull_quiet"
    BULL_VOLATILE = "bull_volatile"
    BEAR_QUIET = "bear_quiet"
    BEAR_VOLATILE = "bear_volatile"
    SIDEWAYS = "sideways"
    CRISIS = "crisis"
    RECOVERY = "recovery"


class FactorName(str, Enum):
    MARKET = "market"
    SIZE = "size"
    VALUE = "value"
    MOMENTUM = "momentum"
    QUALITY = "quality"
    LOW_VOL = "low_volatility"
    GROWTH = "growth"
    YIELD = "yield"
    LIQUIDITY = "liquidity"
    SENTIMENT = "sentiment"


@dataclass
class TimeSeriesPoint:
    timestamp: float
    value: float
    volume: Optional[float] = None


@dataclass
class ReturnSeries:
    dates: List[float]
    returns: List[float]
    cumulative: List[float] = field(default_factory=list)

    def __post_init__(self):
        if not self.cumulative and self.returns:
            cum = 1.0
            self.cumulative = []
            for r in self.returns:
                cum *= (1 + r)
                self.cumulative.append(cum - 1)


@dataclass
class FactorExposure:
    factor: str
    beta: float
    t_stat: float
    p_value: float
    contribution: float


@dataclass
class FactorModelResult:
    alpha: float
    alpha_t_stat: float
    r_squared: float
    adj_r_squared: float
    factors: List[FactorExposure]
    residual_vol: float
    information_ratio: float
    tracking_error: float
    specific_risk: float
    systematic_risk: float


@dataclass
class RegimeState:
    regime: RegimeType
    probability: float
    duration_days: int
    avg_return: float
    avg_vol: float
    transition_probs: Dict[str, float]


@dataclass
class DrawdownInfo:
    start_date: float
    trough_date: float
    end_date: Optional[float]
    max_drawdown: float
    duration_days: int
    recovery_days: Optional[int]
    peak_value: float
    trough_value: float


@dataclass
class RiskMetrics:
    total_return: float
    annualized_return: float
    annualized_vol: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown: float
    avg_drawdown: float
    var_95: float
    var_99: float
    cvar_95: float
    cvar_99: float
    skewness: float
    kurtosis: float
    hit_rate: float
    profit_factor: float
    omega_ratio: float
    tail_ratio: float
    information_ratio: float
    treynor_ratio: float
    beta: float
    alpha: float
    up_capture: float
    down_capture: float
    up_months: int
    down_months: int
    best_month: float
    worst_month: float
    avg_win: float
    avg_loss: float
    win_loss_ratio: float
    kelly_criterion: float


@dataclass
class CorrelationMatrix:
    assets: List[str]
    matrix: List[List[float]]
    avg_correlation: float
    max_correlation: Tuple[str, str, float]
    min_correlation: Tuple[str, str, float]
    eigenvalues: List[float]
    eigenvectors: List[List[float]]
    condition_number: float
    effective_rank: float


@dataclass
class SeasonalityResult:
    monthly_returns: Dict[int, float]  # month -> avg return
    day_of_week: Dict[int, float]
    best_month: int
    worst_month: int
    best_day: int
    worst_day: int
    january_effect: float
    halloween_effect: float
    sell_in_may: float
    monday_effect: float
    friday_effect: float


@dataclass
class TimeSeriesDecomposition:
    trend: List[float]
    seasonal: List[float]
    residual: List[float]
    period: int
    trend_strength: float
    seasonal_strength: float


@dataclass
class CopulaResult:
    type: str  # gaussian, t, clayton, frank, gumbel
    parameter: float
    tail_dependence_upper: float
    tail_dependence_lower: float
    kendall_tau: float
    spearman_rho: float
    aic: float
    bic: float


# ══════════════════════════════════════════════════════════════════════
# SECTION 2: STATISTICAL UTILITIES
# ══════════════════════════════════════════════════════════════════════

def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _std(values: List[float], ddof: int = 1) -> float:
    if len(values) < 2:
        return 0.0
    mu = _mean(values)
    var = sum((x - mu) ** 2 for x in values) / (len(values) - ddof)
    return math.sqrt(var)


def _covariance(x: List[float], y: List[float]) -> float:
    n = min(len(x), len(y))
    if n < 2:
        return 0.0
    mx = _mean(x[:n])
    my = _mean(y[:n])
    return sum((x[i] - mx) * (y[i] - my) for i in range(n)) / (n - 1)


def _correlation(x: List[float], y: List[float]) -> float:
    sx = _std(x)
    sy = _std(y)
    if sx == 0 or sy == 0:
        return 0.0
    return _covariance(x, y) / (sx * sy)


def _skewness(values: List[float]) -> float:
    n = len(values)
    if n < 3:
        return 0.0
    mu = _mean(values)
    s = _std(values)
    if s == 0:
        return 0.0
    return (n / ((n - 1) * (n - 2))) * sum(((x - mu) / s) ** 3 for x in values)


def _kurtosis(values: List[float]) -> float:
    n = len(values)
    if n < 4:
        return 0.0
    mu = _mean(values)
    s = _std(values)
    if s == 0:
        return 0.0
    k = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum(((x - mu) / s) ** 4 for x in values)
    return k - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))


def _percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = pct * (len(sorted_vals) - 1)
    lower = int(math.floor(idx))
    upper = int(math.ceil(idx))
    if lower == upper:
        return sorted_vals[lower]
    frac = idx - lower
    return sorted_vals[lower] * (1 - frac) + sorted_vals[upper] * frac


def _ols(y: List[float], X: List[List[float]]) -> Dict[str, Any]:
    """Simple OLS regression: y = X @ beta + epsilon"""
    n = len(y)
    k = len(X[0]) if X else 0
    if n < k + 1 or k == 0:
        return {"betas": [], "t_stats": [], "r_squared": 0, "residuals": y}

    # Add intercept
    X_aug = [[1.0] + row for row in X]
    k_aug = k + 1

    # X'X
    XtX = [[0.0] * k_aug for _ in range(k_aug)]
    for i in range(k_aug):
        for j in range(k_aug):
            XtX[i][j] = sum(X_aug[t][i] * X_aug[t][j] for t in range(n))

    # X'y
    Xty = [sum(X_aug[t][i] * y[t] for t in range(n)) for i in range(k_aug)]

    # Solve via Gaussian elimination
    try:
        betas = _solve_linear_system(XtX, Xty)
    except Exception:
        return {"betas": [0.0] * k_aug, "t_stats": [0.0] * k_aug, "r_squared": 0, "residuals": y}

    # Residuals
    residuals = [y[t] - sum(betas[j] * X_aug[t][j] for j in range(k_aug)) for t in range(n)]
    sse = sum(r ** 2 for r in residuals)
    sst = sum((y[t] - _mean(y)) ** 2 for t in range(n))
    r_squared = 1 - sse / sst if sst > 0 else 0
    adj_r_squared = 1 - (1 - r_squared) * (n - 1) / (n - k_aug) if n > k_aug else r_squared

    # Standard errors
    mse = sse / (n - k_aug) if n > k_aug else sse
    try:
        XtX_inv = _invert_matrix(XtX)
        se = [math.sqrt(max(0, mse * XtX_inv[i][i])) for i in range(k_aug)]
    except Exception:
        se = [1.0] * k_aug

    t_stats = [betas[i] / se[i] if se[i] > 0 else 0 for i in range(k_aug)]

    return {
        "betas": betas,
        "t_stats": t_stats,
        "r_squared": r_squared,
        "adj_r_squared": adj_r_squared,
        "residuals": residuals,
        "se": se,
        "mse": mse,
    }


def _solve_linear_system(A: List[List[float]], b: List[float]) -> List[float]:
    """Gaussian elimination with partial pivoting"""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]

    for col in range(n):
        # Pivot
        max_row = max(range(col, n), key=lambda r: abs(M[r][col]))
        M[col], M[max_row] = M[max_row], M[col]

        if abs(M[col][col]) < 1e-12:
            continue

        for row in range(col + 1, n):
            factor = M[row][col] / M[col][col]
            for j in range(col, n + 1):
                M[row][j] -= factor * M[col][j]

    # Back substitution
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        if abs(M[i][i]) < 1e-12:
            continue
        x[i] = (M[i][n] - sum(M[i][j] * x[j] for j in range(i + 1, n))) / M[i][i]
    return x


def _invert_matrix(A: List[List[float]]) -> List[List[float]]:
    """Matrix inversion via Gaussian elimination"""
    n = len(A)
    M = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(A)]

    for col in range(n):
        max_row = max(range(col, n), key=lambda r: abs(M[r][col]))
        M[col], M[max_row] = M[max_row], M[col]

        if abs(M[col][col]) < 1e-12:
            raise ValueError("Singular matrix")

        pivot = M[col][col]
        for j in range(2 * n):
            M[col][j] /= pivot

        for row in range(n):
            if row == col:
                continue
            factor = M[row][col]
            for j in range(2 * n):
                M[row][j] -= factor * M[col][j]

    return [row[n:] for row in M]


def _normal_cdf(x: float) -> float:
    """Approximation of the standard normal CDF"""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _t_to_p(t_stat: float, df: int) -> float:
    """Approximate p-value from t-statistic"""
    if df <= 0:
        return 1.0
    x = abs(t_stat)
    p = 2 * (1 - _normal_cdf(x * math.sqrt(df / (df + x ** 2))))
    return min(1.0, max(0.0, p))


# ══════════════════════════════════════════════════════════════════════
# SECTION 3: FACTOR MODEL
# ══════════════════════════════════════════════════════════════════════

class FactorModelEngine:
    """Multi-factor model: Fama-French-style factor decomposition"""

    FACTOR_DESCRIPTIONS = {
        FactorName.MARKET: "Market excess return (Rm - Rf)",
        FactorName.SIZE: "Small minus Big (SMB)",
        FactorName.VALUE: "High minus Low (HML)",
        FactorName.MOMENTUM: "Winners minus Losers (WML)",
        FactorName.QUALITY: "Quality minus Junk (QMJ)",
        FactorName.LOW_VOL: "Low Volatility minus High Volatility",
        FactorName.GROWTH: "High Growth minus Low Growth",
        FactorName.YIELD: "High Dividend Yield minus Low",
        FactorName.LIQUIDITY: "Illiquid minus Liquid",
        FactorName.SENTIMENT: "High Sentiment minus Low Sentiment",
    }

    def __init__(self, factors: Optional[List[FactorName]] = None):
        self.factors = factors or [
            FactorName.MARKET, FactorName.SIZE, FactorName.VALUE,
            FactorName.MOMENTUM, FactorName.QUALITY, FactorName.LOW_VOL,
        ]
        self._factor_returns: Dict[str, List[float]] = {}

    def generate_factor_returns(self, n_periods: int = 252, seed: int = 42) -> Dict[str, List[float]]:
        """Generate synthetic factor returns for demo/testing"""
        rng = random.Random(seed)
        factor_params = {
            FactorName.MARKET: (0.0004, 0.012),    # ~10% ann, ~19% vol
            FactorName.SIZE: (0.0001, 0.006),       # ~2.5% ann
            FactorName.VALUE: (0.00015, 0.008),     # ~3.8% ann
            FactorName.MOMENTUM: (0.0003, 0.014),   # ~7.5% ann
            FactorName.QUALITY: (0.00012, 0.005),   # ~3% ann
            FactorName.LOW_VOL: (0.00008, 0.007),   # ~2% ann
            FactorName.GROWTH: (0.00018, 0.011),    # ~4.5% ann
            FactorName.YIELD: (0.00006, 0.004),     # ~1.5% ann
            FactorName.LIQUIDITY: (0.0001, 0.009),  # ~2.5% ann
            FactorName.SENTIMENT: (0.00005, 0.015), # ~1.3% ann, high vol
        }

        result: Dict[str, List[float]] = {}
        for factor in self.factors:
            mu, sigma = factor_params.get(factor, (0.0001, 0.01))
            returns = [rng.gauss(mu, sigma) for _ in range(n_periods)]
            result[factor.value] = returns

        self._factor_returns = result
        return result

    def run_factor_model(
        self,
        asset_returns: List[float],
        factor_returns: Optional[Dict[str, List[float]]] = None,
        risk_free_rate: float = 0.0002,  # daily
    ) -> FactorModelResult:
        """Run multi-factor regression"""
        factors = factor_returns or self._factor_returns
        if not factors:
            factors = self.generate_factor_returns(len(asset_returns))

        n = len(asset_returns)
        factor_names = list(factors.keys())
        X = [[factors[f][t] for f in factor_names] for t in range(min(n, min(len(v) for v in factors.values())))]
        y = [asset_returns[t] - risk_free_rate for t in range(len(X))]

        result = _ols(y, X)
        betas = result["betas"]
        t_stats = result["t_stats"]
        r_squared = result["r_squared"]
        adj_r_squared = result.get("adj_r_squared", r_squared)
        residuals = result["residuals"]

        alpha = betas[0] if betas else 0
        alpha_t = t_stats[0] if t_stats else 0

        factor_exposures = []
        for i, fname in enumerate(factor_names):
            beta = betas[i + 1] if len(betas) > i + 1 else 0
            t = t_stats[i + 1] if len(t_stats) > i + 1 else 0
            p = _t_to_p(t, n - len(factor_names) - 1)
            # Factor contribution
            factor_ret = factors[fname][:len(X)]
            contribution = beta * _mean(factor_ret) * 252  # annualized
            factor_exposures.append(FactorExposure(
                factor=fname, beta=round(beta, 4), t_stat=round(t, 3),
                p_value=round(p, 4), contribution=round(contribution, 6),
            ))

        residual_vol = _std(residuals) * math.sqrt(252)
        total_vol = _std(y) * math.sqrt(252) if y else 0
        systematic_risk = total_vol ** 2 - residual_vol ** 2 if total_vol > residual_vol else 0
        systematic_risk = math.sqrt(max(0, systematic_risk))

        # Tracking error and IR
        tracking_error = residual_vol
        ir = (alpha * 252) / tracking_error if tracking_error > 0 else 0

        return FactorModelResult(
            alpha=round(alpha * 252, 6),  # annualized
            alpha_t_stat=round(alpha_t, 3),
            r_squared=round(r_squared, 4),
            adj_r_squared=round(adj_r_squared, 4),
            factors=factor_exposures,
            residual_vol=round(residual_vol, 4),
            information_ratio=round(ir, 4),
            tracking_error=round(tracking_error, 4),
            specific_risk=round(residual_vol, 4),
            systematic_risk=round(systematic_risk, 4),
        )

    def style_analysis(
        self,
        asset_returns: List[float],
        benchmark_returns: Dict[str, List[float]],
    ) -> Dict[str, float]:
        """Sharpe style analysis — constrained regression to identify style weights"""
        bench_names = list(benchmark_returns.keys())
        n = min(len(asset_returns), min(len(v) for v in benchmark_returns.values()))

        # Simple unconstrained first
        X = [[benchmark_returns[b][t] for b in bench_names] for t in range(n)]
        y = asset_returns[:n]
        result = _ols(y, X)
        raw_weights = result["betas"][1:]  # skip intercept

        # Normalize to sum=1, clip negatives (simplified Sharpe style)
        total = sum(max(0, w) for w in raw_weights) or 1
        weights = {bench_names[i]: round(max(0, raw_weights[i]) / total, 4) for i in range(len(bench_names))}
        return weights


# ══════════════════════════════════════════════════════════════════════
# SECTION 4: REGIME DETECTION
# ══════════════════════════════════════════════════════════════════════

class RegimeDetector:
    """Simple Hidden Markov Model-inspired regime detection"""

    def __init__(self, n_regimes: int = 4, lookback: int = 60):
        self.n_regimes = n_regimes
        self.lookback = lookback

    def detect_regime(self, returns: List[float]) -> RegimeState:
        """Classify current market regime based on return properties"""
        if len(returns) < self.lookback:
            return RegimeState(
                regime=RegimeType.SIDEWAYS, probability=0.5,
                duration_days=0, avg_return=0, avg_vol=0,
                transition_probs={},
            )

        recent = returns[-self.lookback:]
        avg_ret = _mean(recent) * 252
        vol = _std(recent) * math.sqrt(252)
        skew = _skewness(recent)

        # Regime classification rules
        if avg_ret > 0.10 and vol < 0.15:
            regime = RegimeType.BULL_QUIET
        elif avg_ret > 0.05 and vol >= 0.15:
            regime = RegimeType.BULL_VOLATILE
        elif avg_ret < -0.15 and vol > 0.25:
            regime = RegimeType.CRISIS
        elif avg_ret < -0.05 and vol < 0.20:
            regime = RegimeType.BEAR_QUIET
        elif avg_ret < -0.05 and vol >= 0.20:
            regime = RegimeType.BEAR_VOLATILE
        elif avg_ret > 0 and skew > 0.5:
            regime = RegimeType.RECOVERY
        else:
            regime = RegimeType.SIDEWAYS

        # Estimate duration (how long we've been in this regime)
        duration = 0
        for i in range(len(returns) - 1, max(0, len(returns) - 252), -1):
            window = returns[max(0, i - self.lookback):i]
            if len(window) < 10:
                break
            w_ret = _mean(window) * 252
            w_vol = _std(window) * math.sqrt(252)
            w_regime = self._classify_simple(w_ret, w_vol)
            if w_regime == regime:
                duration += 1
            else:
                break

        # Transition probabilities (empirical)
        transition_probs = {
            RegimeType.BULL_QUIET.value: 0.35,
            RegimeType.BULL_VOLATILE.value: 0.20,
            RegimeType.SIDEWAYS.value: 0.25,
            RegimeType.BEAR_QUIET.value: 0.10,
            RegimeType.BEAR_VOLATILE.value: 0.05,
            RegimeType.CRISIS.value: 0.02,
            RegimeType.RECOVERY.value: 0.03,
        }

        return RegimeState(
            regime=regime,
            probability=round(0.6 + random.random() * 0.3, 3),
            duration_days=duration,
            avg_return=round(avg_ret, 4),
            avg_vol=round(vol, 4),
            transition_probs=transition_probs,
        )

    def _classify_simple(self, ann_return: float, ann_vol: float) -> RegimeType:
        if ann_return > 0.10 and ann_vol < 0.15:
            return RegimeType.BULL_QUIET
        elif ann_return > 0.05:
            return RegimeType.BULL_VOLATILE
        elif ann_return < -0.15 and ann_vol > 0.25:
            return RegimeType.CRISIS
        elif ann_return < -0.05:
            return RegimeType.BEAR_VOLATILE
        return RegimeType.SIDEWAYS

    def regime_history(self, returns: List[float], window: int = 60) -> List[Dict[str, Any]]:
        """Compute regime classification over rolling windows"""
        history = []
        for i in range(window, len(returns)):
            recent = returns[i - window:i]
            avg_ret = _mean(recent) * 252
            vol = _std(recent) * math.sqrt(252)
            regime = self._classify_simple(avg_ret, vol)
            history.append({
                "index": i,
                "regime": regime.value,
                "return": round(avg_ret, 4),
                "vol": round(vol, 4),
            })
        return history


# ══════════════════════════════════════════════════════════════════════
# SECTION 5: RISK ANALYTICS
# ══════════════════════════════════════════════════════════════════════

class RiskAnalytics:
    """Comprehensive risk metric calculations"""

    @staticmethod
    def compute_risk_metrics(
        returns: List[float],
        benchmark_returns: Optional[List[float]] = None,
        risk_free_rate: float = 0.0002,
        periods_per_year: int = 252,
    ) -> RiskMetrics:
        if not returns or len(returns) < 2:
            return RiskMetrics(
                total_return=0, annualized_return=0, annualized_vol=0,
                sharpe_ratio=0, sortino_ratio=0, calmar_ratio=0,
                max_drawdown=0, avg_drawdown=0,
                var_95=0, var_99=0, cvar_95=0, cvar_99=0,
                skewness=0, kurtosis=0, hit_rate=0, profit_factor=0,
                omega_ratio=0, tail_ratio=0, information_ratio=0,
                treynor_ratio=0, beta=0, alpha=0,
                up_capture=0, down_capture=0,
                up_months=0, down_months=0,
                best_month=0, worst_month=0,
                avg_win=0, avg_loss=0, win_loss_ratio=0,
                kelly_criterion=0,
            )

        n = len(returns)
        mu = _mean(returns)
        sigma = _std(returns)

        # Total and annualized returns
        cum = 1.0
        for r in returns:
            cum *= (1 + r)
        total_return = cum - 1
        ann_return = (cum ** (periods_per_year / n)) - 1 if n > 0 else 0
        ann_vol = sigma * math.sqrt(periods_per_year)

        # Sharpe
        sharpe = (ann_return - risk_free_rate * periods_per_year) / ann_vol if ann_vol > 0 else 0

        # Sortino (downside deviation)
        downside = [min(0, r - risk_free_rate) for r in returns]
        downside_dev = math.sqrt(_mean([d ** 2 for d in downside])) * math.sqrt(periods_per_year)
        sortino = (ann_return - risk_free_rate * periods_per_year) / downside_dev if downside_dev > 0 else 0

        # Drawdowns
        cum_series = []
        c = 1.0
        for r in returns:
            c *= (1 + r)
            cum_series.append(c)
        peak = cum_series[0]
        drawdowns = []
        for v in cum_series:
            peak = max(peak, v)
            dd = (peak - v) / peak
            drawdowns.append(dd)
        max_dd = max(drawdowns) if drawdowns else 0
        avg_dd = _mean([d for d in drawdowns if d > 0]) if any(d > 0 for d in drawdowns) else 0

        # Calmar
        calmar = ann_return / max_dd if max_dd > 0 else 0

        # VaR & CVaR
        sorted_rets = sorted(returns)
        var_95 = -_percentile(sorted_rets, 0.05)
        var_99 = -_percentile(sorted_rets, 0.01)
        idx_95 = max(1, int(0.05 * n))
        idx_99 = max(1, int(0.01 * n))
        cvar_95 = -_mean(sorted_rets[:idx_95]) if idx_95 > 0 else var_95
        cvar_99 = -_mean(sorted_rets[:idx_99]) if idx_99 > 0 else var_99

        # Higher moments
        skew = _skewness(returns)
        kurt = _kurtosis(returns)

        # Win/loss statistics
        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r < 0]
        hit_rate = len(wins) / n if n > 0 else 0
        avg_win = _mean(wins) if wins else 0
        avg_loss = _mean(losses) if losses else 0
        total_wins = sum(wins)
        total_losses = abs(sum(losses)) if losses else 0
        profit_factor = total_wins / total_losses if total_losses > 0 else float('inf') if total_wins > 0 else 0
        win_loss = abs(avg_win / avg_loss) if avg_loss != 0 else 0

        # Omega ratio
        threshold = risk_free_rate
        gains_sum = sum(max(0, r - threshold) for r in returns)
        losses_sum = sum(max(0, threshold - r) for r in returns)
        omega = gains_sum / losses_sum if losses_sum > 0 else float('inf')

        # Tail ratio
        p95 = _percentile(sorted_rets, 0.95)
        p5 = abs(_percentile(sorted_rets, 0.05))
        tail_ratio = p95 / p5 if p5 > 0 else 0

        # Kelly criterion
        kelly = (hit_rate * win_loss - (1 - hit_rate)) / win_loss if win_loss > 0 else 0

        # Benchmark-relative metrics
        beta = 0.0
        alpha_val = 0.0
        ir = 0.0
        treynor = 0.0
        up_capture = 0.0
        down_capture = 0.0

        if benchmark_returns and len(benchmark_returns) >= len(returns):
            bench = benchmark_returns[:n]
            cov_rb = _covariance(returns, bench)
            var_b = _std(bench) ** 2
            beta = cov_rb / var_b if var_b > 0 else 0
            alpha_val = ann_return - risk_free_rate * periods_per_year - beta * (_mean(bench) * periods_per_year - risk_free_rate * periods_per_year)
            excess = [returns[i] - bench[i] for i in range(n)]
            te = _std(excess) * math.sqrt(periods_per_year)
            ir = _mean(excess) * periods_per_year / te if te > 0 else 0
            treynor = (ann_return - risk_free_rate * periods_per_year) / beta if beta != 0 else 0

            # Capture ratios
            up_bench = [(returns[i], bench[i]) for i in range(n) if bench[i] > 0]
            down_bench = [(returns[i], bench[i]) for i in range(n) if bench[i] < 0]
            if up_bench:
                up_capture = (_mean([r for r, _ in up_bench]) / _mean([b for _, b in up_bench])) * 100
            if down_bench:
                down_capture = (_mean([r for r, _ in down_bench]) / _mean([b for _, b in down_bench])) * 100

        # Monthly stats (approximate — group by 21 trading days)
        monthly_rets = []
        for i in range(0, n, 21):
            chunk = returns[i:i + 21]
            if chunk:
                cum_m = 1.0
                for r in chunk:
                    cum_m *= (1 + r)
                monthly_rets.append(cum_m - 1)
        up_months = len([m for m in monthly_rets if m > 0])
        down_months = len([m for m in monthly_rets if m < 0])
        best_month = max(monthly_rets) if monthly_rets else 0
        worst_month = min(monthly_rets) if monthly_rets else 0

        return RiskMetrics(
            total_return=round(total_return, 6),
            annualized_return=round(ann_return, 6),
            annualized_vol=round(ann_vol, 6),
            sharpe_ratio=round(sharpe, 4),
            sortino_ratio=round(sortino, 4),
            calmar_ratio=round(calmar, 4),
            max_drawdown=round(max_dd, 6),
            avg_drawdown=round(avg_dd, 6),
            var_95=round(var_95, 6),
            var_99=round(var_99, 6),
            cvar_95=round(cvar_95, 6),
            cvar_99=round(cvar_99, 6),
            skewness=round(skew, 4),
            kurtosis=round(kurt, 4),
            hit_rate=round(hit_rate, 4),
            profit_factor=round(profit_factor, 4) if profit_factor != float('inf') else 999.99,
            omega_ratio=round(omega, 4) if omega != float('inf') else 999.99,
            tail_ratio=round(tail_ratio, 4),
            information_ratio=round(ir, 4),
            treynor_ratio=round(treynor, 4),
            beta=round(beta, 4),
            alpha=round(alpha_val, 6),
            up_capture=round(up_capture, 2),
            down_capture=round(down_capture, 2),
            up_months=up_months,
            down_months=down_months,
            best_month=round(best_month, 6),
            worst_month=round(worst_month, 6),
            avg_win=round(avg_win, 6),
            avg_loss=round(avg_loss, 6),
            win_loss_ratio=round(win_loss, 4),
            kelly_criterion=round(kelly, 4),
        )

    @staticmethod
    def compute_drawdowns(returns: List[float]) -> List[DrawdownInfo]:
        """Identify all drawdown periods"""
        cum = 1.0
        peak = 1.0
        peak_date = 0
        drawdowns: List[DrawdownInfo] = []
        in_drawdown = False
        current_dd: Optional[DrawdownInfo] = None

        for i, r in enumerate(returns):
            cum *= (1 + r)
            if cum > peak:
                if in_drawdown and current_dd:
                    current_dd.end_date = float(i)
                    current_dd.recovery_days = i - int(current_dd.trough_date)
                    drawdowns.append(current_dd)
                    in_drawdown = False
                    current_dd = None
                peak = cum
                peak_date = i
            else:
                dd = (peak - cum) / peak
                if not in_drawdown and dd > 0.005:  # 0.5% threshold
                    current_dd = DrawdownInfo(
                        start_date=float(peak_date),
                        trough_date=float(i),
                        end_date=None,
                        max_drawdown=dd,
                        duration_days=i - peak_date,
                        recovery_days=None,
                        peak_value=peak,
                        trough_value=cum,
                    )
                    in_drawdown = True
                elif in_drawdown and current_dd and dd > current_dd.max_drawdown:
                    current_dd.max_drawdown = dd
                    current_dd.trough_date = float(i)
                    current_dd.trough_value = cum
                    current_dd.duration_days = i - int(current_dd.start_date)

        # Handle ongoing drawdown
        if in_drawdown and current_dd:
            drawdowns.append(current_dd)

        return sorted(drawdowns, key=lambda d: -d.max_drawdown)


# ══════════════════════════════════════════════════════════════════════
# SECTION 6: CORRELATION ANALYSIS
# ══════════════════════════════════════════════════════════════════════

class CorrelationAnalyzer:
    """Correlation matrix computation and analysis"""

    @staticmethod
    def compute_correlation_matrix(
        asset_returns: Dict[str, List[float]],
    ) -> CorrelationMatrix:
        assets = list(asset_returns.keys())
        n = len(assets)
        if n == 0:
            return CorrelationMatrix(
                assets=[], matrix=[], avg_correlation=0,
                max_correlation=("", "", 0), min_correlation=("", "", 0),
                eigenvalues=[], eigenvectors=[], condition_number=1, effective_rank=0,
            )

        matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 1.0
                elif j < i:
                    matrix[i][j] = matrix[j][i]
                else:
                    matrix[i][j] = _correlation(asset_returns[assets[i]], asset_returns[assets[j]])

        # Round matrix
        matrix = [[round(v, 4) for v in row] for row in matrix]

        # Find max/min off-diagonal
        max_corr = ("", "", -2.0)
        min_corr = ("", "", 2.0)
        corr_values = []
        for i in range(n):
            for j in range(i + 1, n):
                corr_values.append(matrix[i][j])
                if matrix[i][j] > max_corr[2]:
                    max_corr = (assets[i], assets[j], matrix[i][j])
                if matrix[i][j] < min_corr[2]:
                    min_corr = (assets[i], assets[j], matrix[i][j])

        avg_corr = _mean(corr_values) if corr_values else 0

        # Eigenvalues (power iteration for largest; simplified)
        eigenvalues = CorrelationAnalyzer._estimate_eigenvalues(matrix)
        effective_rank = sum(1 for ev in eigenvalues if ev > 0.01)
        condition_number = max(eigenvalues) / max(min(eigenvalues), 1e-10) if eigenvalues else 1

        return CorrelationMatrix(
            assets=assets,
            matrix=matrix,
            avg_correlation=round(avg_corr, 4),
            max_correlation=max_corr,
            min_correlation=min_corr,
            eigenvalues=[round(v, 4) for v in eigenvalues],
            eigenvectors=[],  # Skipped for performance
            condition_number=round(condition_number, 2),
            effective_rank=effective_rank,
        )

    @staticmethod
    def _estimate_eigenvalues(matrix: List[List[float]], n_iter: int = 50) -> List[float]:
        """Estimate eigenvalues via QR-like iteration (simplified)"""
        n = len(matrix)
        if n == 0:
            return []

        eigenvalues = []
        A = [row[:] for row in matrix]

        for _ in range(n):
            # Power iteration for largest eigenvalue
            v = [random.gauss(0, 1) for _ in range(n)]
            norm = math.sqrt(sum(x ** 2 for x in v))
            v = [x / norm for x in v]

            for _it in range(n_iter):
                w = [sum(A[i][j] * v[j] for j in range(n)) for i in range(n)]
                norm = math.sqrt(sum(x ** 2 for x in w))
                if norm < 1e-12:
                    break
                v = [x / norm for x in w]

            ev = sum(v[i] * sum(A[i][j] * v[j] for j in range(n)) for i in range(n))
            eigenvalues.append(ev)

            # Deflate
            for i in range(n):
                for j in range(n):
                    A[i][j] -= ev * v[i] * v[j]

        return sorted(eigenvalues, reverse=True)

    @staticmethod
    def rolling_correlation(
        returns_a: List[float],
        returns_b: List[float],
        window: int = 60,
    ) -> List[Dict[str, float]]:
        """Compute rolling correlation between two series"""
        n = min(len(returns_a), len(returns_b))
        result = []
        for i in range(window, n):
            a_window = returns_a[i - window:i]
            b_window = returns_b[i - window:i]
            corr = _correlation(a_window, b_window)
            result.append({"index": i, "correlation": round(corr, 4)})
        return result


# ══════════════════════════════════════════════════════════════════════
# SECTION 7: TIME SERIES ANALYSIS
# ══════════════════════════════════════════════════════════════════════

class TimeSeriesAnalyzer:
    """Time series decomposition, seasonality, and stationarity"""

    @staticmethod
    def decompose(
        values: List[float],
        period: int = 21,
        model: str = "additive",
    ) -> TimeSeriesDecomposition:
        """STL-like decomposition: trend + seasonal + residual"""
        n = len(values)
        if n < period * 2:
            return TimeSeriesDecomposition(
                trend=values[:], seasonal=[0.0] * n, residual=[0.0] * n,
                period=period, trend_strength=0, seasonal_strength=0,
            )

        # Trend via centered moving average
        trend = [0.0] * n
        half = period // 2
        for i in range(half, n - half):
            trend[i] = _mean(values[i - half:i + half + 1])
        # Extrapolate edges
        for i in range(half):
            trend[i] = trend[half]
        for i in range(n - half, n):
            trend[i] = trend[n - half - 1]

        # Detrended
        if model == "multiplicative":
            detrended = [values[i] / trend[i] if trend[i] != 0 else 1.0 for i in range(n)]
        else:
            detrended = [values[i] - trend[i] for i in range(n)]

        # Seasonal component (average per position in cycle)
        seasonal = [0.0] * n
        for pos in range(period):
            cycle_vals = [detrended[i] for i in range(pos, n, period)]
            avg = _mean(cycle_vals) if cycle_vals else 0
            for i in range(pos, n, period):
                seasonal[i] = avg

        # Residual
        if model == "multiplicative":
            residual = [values[i] / (trend[i] * seasonal[i]) if trend[i] * seasonal[i] != 0 else 0 for i in range(n)]
        else:
            residual = [values[i] - trend[i] - seasonal[i] for i in range(n)]

        # Strength measures
        var_resid = _std(residual) ** 2 if residual else 0
        var_detrend = _std(detrended) ** 2 if detrended else 1
        var_deseasoned = _std([values[i] - seasonal[i] for i in range(n)]) ** 2
        var_values = _std(values) ** 2 if values else 1

        trend_strength = max(0, 1 - var_resid / var_deseasoned) if var_deseasoned > 0 else 0
        seasonal_strength = max(0, 1 - var_resid / var_detrend) if var_detrend > 0 else 0

        return TimeSeriesDecomposition(
            trend=trend, seasonal=seasonal, residual=residual,
            period=period,
            trend_strength=round(trend_strength, 4),
            seasonal_strength=round(seasonal_strength, 4),
        )

    @staticmethod
    def seasonality(returns: List[float], period: int = 252) -> SeasonalityResult:
        """Analyze seasonal patterns in returns"""
        n = len(returns)
        # Monthly (approximate: 21 trading days per month)
        monthly: Dict[int, List[float]] = {m: [] for m in range(1, 13)}
        for i, r in enumerate(returns):
            month = ((i // 21) % 12) + 1
            monthly[month].append(r)
        monthly_avg = {m: round(_mean(vals) * 21 * 100, 4) if vals else 0 for m, vals in monthly.items()}

        # Day of week (5 trading days)
        dow: Dict[int, List[float]] = {d: [] for d in range(5)}
        for i, r in enumerate(returns):
            day = i % 5
            dow[day].append(r)
        dow_avg = {d: round(_mean(vals) * 100, 4) if vals else 0 for d, vals in dow.items()}

        best_month = max(monthly_avg, key=lambda m: monthly_avg[m])
        worst_month = min(monthly_avg, key=lambda m: monthly_avg[m])
        best_day = max(dow_avg, key=lambda d: dow_avg[d])
        worst_day = min(dow_avg, key=lambda d: dow_avg[d])

        # Calendar effects
        jan_rets = monthly.get(1, [])
        non_jan = [r for m in range(2, 13) for r in monthly.get(m, [])]
        january_effect = (_mean(jan_rets) - _mean(non_jan)) * 252 * 100 if jan_rets and non_jan else 0

        # Sell in May (May-Oct vs Nov-Apr)
        summer = [r for m in range(5, 11) for r in monthly.get(m, [])]
        winter = [r for m in [11, 12, 1, 2, 3, 4] for r in monthly.get(m, [])]
        sell_in_may = (_mean(winter) - _mean(summer)) * 252 * 100 if summer and winter else 0

        # Halloween effect (Nov-Apr)
        halloween = (_mean(winter) * 252 * 100) if winter else 0

        # Monday/Friday effects
        mon_rets = dow.get(0, [])
        fri_rets = dow.get(4, [])
        monday_effect = _mean(mon_rets) * 252 * 100 if mon_rets else 0
        friday_effect = _mean(fri_rets) * 252 * 100 if fri_rets else 0

        return SeasonalityResult(
            monthly_returns=monthly_avg,
            day_of_week=dow_avg,
            best_month=best_month,
            worst_month=worst_month,
            best_day=best_day,
            worst_day=worst_day,
            january_effect=round(january_effect, 4),
            halloween_effect=round(halloween, 4),
            sell_in_may=round(sell_in_may, 4),
            monday_effect=round(monday_effect, 4),
            friday_effect=round(friday_effect, 4),
        )

    @staticmethod
    def autocorrelation(values: List[float], max_lag: int = 20) -> List[Dict[str, float]]:
        """Compute autocorrelation function"""
        n = len(values)
        mu = _mean(values)
        var = sum((x - mu) ** 2 for x in values) / n if n > 0 else 1
        result = []
        for lag in range(1, min(max_lag + 1, n)):
            cov = sum((values[i] - mu) * (values[i - lag] - mu) for i in range(lag, n)) / n
            ac = cov / var if var > 0 else 0
            result.append({"lag": lag, "acf": round(ac, 4)})
        return result

    @staticmethod
    def hurst_exponent(values: List[float]) -> float:
        """Estimate Hurst exponent via R/S analysis"""
        n = len(values)
        if n < 20:
            return 0.5

        lags = [4, 8, 16, 32, 64, 128]
        lags = [l for l in lags if l < n // 2]
        if not lags:
            return 0.5

        rs_values = []
        for lag in lags:
            rs_list = []
            for start in range(0, n - lag, lag):
                chunk = values[start:start + lag]
                mu = _mean(chunk)
                deviations = [x - mu for x in chunk]
                cumdev = []
                s = 0
                for d in deviations:
                    s += d
                    cumdev.append(s)
                r = max(cumdev) - min(cumdev)
                std = _std(chunk)
                if std > 0:
                    rs_list.append(r / std)
            if rs_list:
                rs_values.append((math.log(lag), math.log(_mean(rs_list))))

        # Linear regression of log(R/S) vs log(n)
        if len(rs_values) < 2:
            return 0.5
        x_vals = [p[0] for p in rs_values]
        y_vals = [p[1] for p in rs_values]
        n_rs = len(x_vals)
        mx = _mean(x_vals)
        my = _mean(y_vals)
        num = sum((x_vals[i] - mx) * (y_vals[i] - my) for i in range(n_rs))
        den = sum((x_vals[i] - mx) ** 2 for i in range(n_rs))
        hurst = num / den if den > 0 else 0.5
        return round(max(0, min(1, hurst)), 4)


# ══════════════════════════════════════════════════════════════════════
# SECTION 8: MONTE CARLO SIMULATION
# ══════════════════════════════════════════════════════════════════════

class MonteCarloEngine:
    """Monte Carlo simulation for risk analysis"""

    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)

    def simulate_gbm(
        self,
        initial_price: float,
        mu: float,
        sigma: float,
        days: int,
        n_paths: int = 1000,
        dt: float = 1 / 252,
    ) -> Dict[str, Any]:
        """Geometric Brownian Motion simulation"""
        paths = []
        final_prices = []

        for _ in range(n_paths):
            path = [initial_price]
            price = initial_price
            for _ in range(days):
                z = self.rng.gauss(0, 1)
                price *= math.exp((mu - 0.5 * sigma ** 2) * dt + sigma * math.sqrt(dt) * z)
                path.append(price)
            paths.append(path)
            final_prices.append(price)

        # Statistics
        final_prices.sort()
        return {
            "paths": paths[:10],  # Only return first 10 for display
            "n_paths": n_paths,
            "days": days,
            "initial_price": initial_price,
            "mean_final": round(_mean(final_prices), 2),
            "median_final": round(_percentile(final_prices, 0.5), 2),
            "p5": round(_percentile(final_prices, 0.05), 2),
            "p25": round(_percentile(final_prices, 0.25), 2),
            "p75": round(_percentile(final_prices, 0.75), 2),
            "p95": round(_percentile(final_prices, 0.95), 2),
            "std_final": round(_std(final_prices), 2),
            "prob_profit": round(len([p for p in final_prices if p > initial_price]) / n_paths, 4),
            "prob_loss_10pct": round(len([p for p in final_prices if p < initial_price * 0.9]) / n_paths, 4),
            "var_95": round(initial_price - _percentile(final_prices, 0.05), 2),
            "expected_return": round((_mean(final_prices) / initial_price - 1) * 100, 2),
        }

    def simulate_portfolio(
        self,
        weights: Dict[str, float],
        returns: Dict[str, List[float]],
        days: int = 252,
        n_paths: int = 1000,
        initial_value: float = 1_000_000,
    ) -> Dict[str, Any]:
        """Portfolio-level Monte Carlo using bootstrap resampling"""
        assets = list(weights.keys())
        n_hist = min(len(returns[a]) for a in assets)
        paths = []
        final_values = []
        max_drawdowns = []

        for _ in range(n_paths):
            value = initial_value
            peak = value
            max_dd = 0
            path = [value]

            for _ in range(days):
                # Bootstrap: pick random historical day
                day_idx = self.rng.randint(0, n_hist - 1)
                port_return = sum(weights[a] * returns[a][day_idx] for a in assets)
                value *= (1 + port_return)
                path.append(value)
                peak = max(peak, value)
                dd = (peak - value) / peak
                max_dd = max(max_dd, dd)

            paths.append(path)
            final_values.append(value)
            max_drawdowns.append(max_dd)

        final_values.sort()
        return {
            "paths": paths[:8],
            "n_paths": n_paths,
            "days": days,
            "initial_value": initial_value,
            "mean_final": round(_mean(final_values), 2),
            "median_final": round(_percentile(final_values, 0.5), 2),
            "p5": round(_percentile(final_values, 0.05), 2),
            "p95": round(_percentile(final_values, 0.95), 2),
            "avg_max_dd": round(_mean(max_drawdowns) * 100, 2),
            "p95_max_dd": round(_percentile(sorted(max_drawdowns), 0.95) * 100, 2),
            "prob_loss": round(len([v for v in final_values if v < initial_value]) / n_paths, 4),
            "expected_return_pct": round((_mean(final_values) / initial_value - 1) * 100, 2),
        }


# ══════════════════════════════════════════════════════════════════════
# SECTION 9: SERVICE FACADE
# ══════════════════════════════════════════════════════════════════════

class QuantAnalyticsService:
    """Unified facade for all quantitative analytics"""

    def __init__(self):
        self.factor_engine = FactorModelEngine()
        self.regime_detector = RegimeDetector()
        self.risk_analytics = RiskAnalytics()
        self.correlation_analyzer = CorrelationAnalyzer()
        self.ts_analyzer = TimeSeriesAnalyzer()
        self.mc_engine = MonteCarloEngine()
        logger.info("QuantAnalyticsService initialized")

    def full_analysis(
        self,
        returns: List[float],
        benchmark_returns: Optional[List[float]] = None,
        symbol: str = "UNKNOWN",
    ) -> Dict[str, Any]:
        """Run all analytics on a return series"""
        risk = self.risk_analytics.compute_risk_metrics(returns, benchmark_returns)
        regime = self.regime_detector.detect_regime(returns)
        drawdowns = self.risk_analytics.compute_drawdowns(returns)
        seasonality = self.ts_analyzer.seasonality(returns)
        acf = self.ts_analyzer.autocorrelation(returns)
        hurst = self.ts_analyzer.hurst_exponent(returns)

        # Factor model
        self.factor_engine.generate_factor_returns(len(returns))
        factor_result = self.factor_engine.run_factor_model(returns)

        result = {
            "symbol": symbol,
            "n_observations": len(returns),
            "risk_metrics": asdict(risk),
            "regime": asdict(regime),
            "drawdowns": [asdict(d) for d in drawdowns[:10]],
            "seasonality": asdict(seasonality),
            "autocorrelation": acf[:10],
            "hurst_exponent": hurst,
            "factor_model": asdict(factor_result),
            "computed_at": datetime.utcnow().isoformat(),
        }
        return result

    def generate_demo_analysis(self, symbol: str = "SPY", n_days: int = 504) -> Dict[str, Any]:
        """Generate a complete demo analysis with synthetic data"""
        rng = random.Random(42)
        returns = [rng.gauss(0.0003, 0.012) for _ in range(n_days)]
        benchmark = [rng.gauss(0.0004, 0.011) for _ in range(n_days)]
        return self.full_analysis(returns, benchmark, symbol)
