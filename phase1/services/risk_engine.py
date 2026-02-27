"""
risk_engine.py — Full Portfolio Risk Analytics Engine
=====================================================
Implements Bloomberg PRISK / PORT-level risk metrics:

  Value at Risk:
    - Historical Simulation VaR
    - Parametric VaR (Variance-Covariance)
    - Monte Carlo VaR
    - Conditional VaR (CVaR / Expected Shortfall)
    - Component VaR, Marginal VaR, Incremental VaR

  Stress Testing:
    - Historical scenario replay (2008 GFC, COVID, 2022 rate shock, etc.)
    - User-defined stress scenarios
    - Reverse stress testing (what scenario causes X% loss)

  Factor Risk Decomposition:
    - Fama-French 3-factor and 5-factor
    - Brinson attribution (allocation, selection, interaction)
    - Sector and country attribution

  Performance Metrics:
    - Sharpe Ratio, Sortino Ratio, Calmar Ratio, Omega Ratio
    - Maximum Drawdown, Drawdown duration
    - Information Ratio, Tracking Error
    - Beta, Alpha, R-squared, Treynor Ratio
    - Return distribution statistics

  Correlation Analysis:
    - Rolling correlation matrix
    - Correlation regime detection
    - Distance correlation
"""

from __future__ import annotations
import math
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field


# ─── DATA STRUCTURES ─────────────────────────────────────────────────────────

@dataclass
class VaRResult:
    """Container for VaR calculation results."""
    var_95:          float   # 95% VaR (loss)
    var_99:          float   # 99% VaR (loss)
    var_999:         float   # 99.9% VaR (loss)
    cvar_95:         float   # 95% CVaR / Expected Shortfall
    cvar_99:         float   # 99% CVaR / Expected Shortfall
    method:          str
    portfolio_value: float
    var_95_pct:      float   # VaR as % of portfolio
    var_99_pct:      float
    confidence_levels: Dict[float, float] = field(default_factory=dict)
    return_distribution: Optional[np.ndarray] = None


@dataclass
class DrawdownResult:
    """Drawdown analysis container."""
    max_drawdown:        float
    max_drawdown_start:  Optional[pd.Timestamp]
    max_drawdown_end:    Optional[pd.Timestamp]
    max_drawdown_recovery: Optional[pd.Timestamp]
    max_drawdown_duration_days: int
    current_drawdown:    float
    average_drawdown:    float
    calmar_ratio:        float
    ulcer_index:         float
    pain_index:          float
    drawdown_series:     pd.Series


@dataclass
class FactorExposure:
    """Factor model risk decomposition."""
    factor_betas:     Dict[str, float]
    factor_contrib:   Dict[str, float]    # % of variance from each factor
    specific_risk:    float               # Idiosyncratic risk (%)
    systematic_risk:  float               # Factor risk (%)
    total_risk:       float               # Total risk (%)
    r_squared:        float
    alpha:            float


@dataclass
class AttributionResult:
    """Brinson-Hood-Beebower performance attribution."""
    total_active_return:    float
    allocation_effect:      Dict[str, float]   # By sector/country
    selection_effect:       Dict[str, float]
    interaction_effect:     Dict[str, float]
    total_by_sector:        Dict[str, float]


@dataclass
class StressResult:
    """Stress test scenario result."""
    scenario_name:  str
    portfolio_pnl:  float
    portfolio_pnl_pct: float
    position_pnl:   Dict[str, float]    # PnL by position
    worst_position: str
    best_position:  str
    factor_shocks:  Dict[str, float]


# ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

def _portfolio_returns(weights: np.ndarray, returns_matrix: np.ndarray) -> np.ndarray:
    """Weighted portfolio return series."""
    return returns_matrix @ weights


def _ewma_cov(returns: np.ndarray, lambda_: float = 0.94) -> np.ndarray:
    """EWMA covariance matrix (RiskMetrics methodology)."""
    n_obs, n_assets = returns.shape
    cov = np.cov(returns[:10].T)  # Seed with first 10 days
    for i in range(10, n_obs):
        r = returns[i:i+1].T
        cov = lambda_ * cov + (1 - lambda_) * (r @ r.T)
    return cov


def _cornish_fisher_z(z: float, skew: float, kurt: float) -> float:
    """Cornish-Fisher expansion for non-normal VaR."""
    return (z + (z**2 - 1) * skew / 6 +
            (z**3 - 3*z) * (kurt - 3) / 24 -
            (2*z**3 - 5*z) * skew**2 / 36)


# ─── VAR ENGINES ─────────────────────────────────────────────────────────────

class HistoricalVaR:
    """Historical Simulation VaR."""

    @staticmethod
    def compute(
        returns: pd.Series,
        portfolio_value: float = 1_000_000,
        confidence_levels: List[float] = None,
        holding_period: int = 1,
    ) -> VaRResult:
        """
        Historical VaR using actual return distribution.
        No distribution assumptions.

        Args:
            returns:            Daily portfolio return series (decimal)
            portfolio_value:    Current portfolio value in dollars
            confidence_levels:  List of confidence levels (e.g. [0.95, 0.99])
            holding_period:     Number of days (scales VaR by sqrt of time)
        """
        if confidence_levels is None:
            confidence_levels = [0.90, 0.95, 0.99, 0.999]

        rets = returns.dropna().to_numpy()
        if len(rets) < 30:
            raise ValueError("Need at least 30 observations for historical VaR")

        scale = math.sqrt(holding_period)

        def _var_at(conf: float) -> float:
            return -float(np.percentile(rets, (1 - conf) * 100)) * portfolio_value * scale

        def _cvar_at(conf: float) -> float:
            var_threshold = np.percentile(rets, (1 - conf) * 100)
            tail = rets[rets <= var_threshold]
            if len(tail) == 0:
                return _var_at(conf)
            return -float(np.mean(tail)) * portfolio_value * scale

        var_95  = _var_at(0.95)
        var_99  = _var_at(0.99)
        var_999 = _var_at(0.999)
        cvar_95 = _cvar_at(0.95)
        cvar_99 = _cvar_at(0.99)

        cl_dict = {cl: _var_at(cl) for cl in confidence_levels}

        return VaRResult(
            var_95=round(var_95, 2), var_99=round(var_99, 2),
            var_999=round(var_999, 2), cvar_95=round(cvar_95, 2),
            cvar_99=round(cvar_99, 2), method="Historical",
            portfolio_value=portfolio_value,
            var_95_pct=round(var_95 / portfolio_value * 100, 4),
            var_99_pct=round(var_99 / portfolio_value * 100, 4),
            confidence_levels={round(k, 4): round(v, 2) for k, v in cl_dict.items()},
            return_distribution=rets,
        )


class ParametricVaR:
    """Parametric / Variance-Covariance VaR."""

    @staticmethod
    def compute(
        returns: pd.Series,
        portfolio_value: float = 1_000_000,
        holding_period: int = 1,
        use_ewma: bool = False,
        use_cornish_fisher: bool = False,
        lambda_ewma: float = 0.94,
    ) -> VaRResult:
        """
        Parametric VaR assuming normal (or Cornish-Fisher adjusted) distribution.

        Args:
            returns:              Daily portfolio return series
            portfolio_value:      Portfolio value in USD
            holding_period:       Days to scale VaR
            use_ewma:             Use EWMA variance instead of simple variance
            use_cornish_fisher:   Apply CF correction for skew/kurtosis
            lambda_ewma:          EWMA decay factor (RiskMetrics default 0.94)
        """
        rets = returns.dropna().to_numpy()
        scale = math.sqrt(holding_period)

        if use_ewma:
            # EWMA variance
            var_t = float(np.var(rets[:10]))
            for r_t in rets[10:]:
                var_t = lambda_ewma * var_t + (1 - lambda_ewma) * r_t ** 2
            sigma = math.sqrt(var_t)
        else:
            sigma = float(np.std(rets, ddof=1))

        mu = float(np.mean(rets))
        skew = float(pd.Series(rets).skew())
        kurt = float(pd.Series(rets).kurtosis())

        try:
            from scipy.stats import norm
            z95, z99, z999 = norm.ppf(0.05), norm.ppf(0.01), norm.ppf(0.001)
        except ImportError:
            z95, z99, z999 = -1.6449, -2.3263, -3.0902

        if use_cornish_fisher:
            z95  = _cornish_fisher_z(z95, skew, kurt)
            z99  = _cornish_fisher_z(z99, skew, kurt)
            z999 = _cornish_fisher_z(z999, skew, kurt)

        def _var(z):
            return -(mu * holding_period + z * sigma * scale) * portfolio_value

        var_95  = max(0, _var(z95))
        var_99  = max(0, _var(z99))
        var_999 = max(0, _var(z999))

        # CVaR = mean of truncated normal
        try:
            from scipy.stats import norm
            phi_z95  = norm.pdf(norm.ppf(0.05)) / 0.05
            phi_z99  = norm.pdf(norm.ppf(0.01)) / 0.01
        except ImportError:
            phi_z95  = math.exp(-0.5 * z95**2) / (math.sqrt(2 * math.pi) * 0.05)
            phi_z99  = math.exp(-0.5 * z99**2) / (math.sqrt(2 * math.pi) * 0.01)

        cvar_95 = -(mu * holding_period - sigma * scale * phi_z95) * portfolio_value
        cvar_99 = -(mu * holding_period - sigma * scale * phi_z99) * portfolio_value

        method = "Parametric" + (" EWMA" if use_ewma else "") + (" CF" if use_cornish_fisher else "")
        return VaRResult(
            var_95=round(var_95, 2), var_99=round(var_99, 2),
            var_999=round(var_999, 2), cvar_95=round(max(0, cvar_95), 2),
            cvar_99=round(max(0, cvar_99), 2), method=method,
            portfolio_value=portfolio_value,
            var_95_pct=round(var_95 / portfolio_value * 100, 4),
            var_99_pct=round(var_99 / portfolio_value * 100, 4),
            confidence_levels={0.95: round(var_95, 2), 0.99: round(var_99, 2)},
        )


class MonteCarloVaR:
    """Monte Carlo VaR using GBM simulation."""

    @staticmethod
    def compute(
        returns: pd.Series,
        portfolio_value: float = 1_000_000,
        holding_period: int = 1,
        n_simulations: int = 50_000,
        use_fat_tails: bool = True,
        degrees_of_freedom: int = 4,
        seed: Optional[int] = 42,
    ) -> VaRResult:
        """
        Monte Carlo VaR via parametric simulation.

        Args:
            returns:           Return series for parameter estimation
            portfolio_value:   USD portfolio value
            holding_period:    Days for VaR horizon
            n_simulations:     Number of Monte Carlo paths
            use_fat_tails:     Use Student-t distribution for fat tails
            degrees_of_freedom: DOF for t-distribution (lower = fatter)
            seed:              Random seed for reproducibility
        """
        rng = np.random.default_rng(seed)
        rets = returns.dropna().to_numpy()
        mu = float(np.mean(rets))
        sigma = float(np.std(rets, ddof=1))

        if use_fat_tails:
            # Scale t-distribution to match empirical std
            t_scale = sigma * math.sqrt((degrees_of_freedom - 2) / degrees_of_freedom)
            sim_rets = rng.standard_t(degrees_of_freedom, size=n_simulations) * t_scale + mu
        else:
            sim_rets = rng.normal(mu, sigma, size=n_simulations)

        # Scale to holding period
        scale = math.sqrt(holding_period)
        sim_pnl = sim_rets * portfolio_value * scale

        def _var_at(conf):
            return -float(np.percentile(sim_pnl, (1 - conf) * 100))

        def _cvar_at(conf):
            cutoff = np.percentile(sim_pnl, (1 - conf) * 100)
            tail = sim_pnl[sim_pnl <= cutoff]
            return -float(np.mean(tail)) if len(tail) > 0 else _var_at(conf)

        var_95  = _var_at(0.95)
        var_99  = _var_at(0.99)
        var_999 = _var_at(0.999)
        cvar_95 = _cvar_at(0.95)
        cvar_99 = _cvar_at(0.99)

        return VaRResult(
            var_95=round(var_95, 2), var_99=round(var_99, 2),
            var_999=round(var_999, 2), cvar_95=round(cvar_95, 2),
            cvar_99=round(cvar_99, 2),
            method=f"MonteCarlo_{n_simulations}" + ("_t" if use_fat_tails else "_normal"),
            portfolio_value=portfolio_value,
            var_95_pct=round(var_95 / portfolio_value * 100, 4),
            var_99_pct=round(var_99 / portfolio_value * 100, 4),
            confidence_levels={0.95: round(var_95, 2), 0.99: round(var_99, 2)},
            return_distribution=sim_pnl / portfolio_value / scale,
        )


class ComponentVaR:
    """Component, Marginal, and Incremental VaR for multi-asset portfolios."""

    @staticmethod
    def compute(
        weights: np.ndarray,
        cov_matrix: np.ndarray,
        portfolio_value: float,
        confidence: float = 0.99,
        holding_period: int = 1,
    ) -> Dict:
        """
        Compute Component VaR: how much each asset contributes to total portfolio VaR.
        Uses the analytical equal-weighting formula under normality assumption.

        Args:
            weights:           Portfolio weights array (summing to ~1)
            cov_matrix:        Covariance matrix of returns [n×n]
            portfolio_value:   Total portfolio USD value
            confidence:        VaR confidence level
            holding_period:    Days

        Returns: dict with component_var, marginal_var, pct_contribution
        """
        try:
            from scipy.stats import norm
            z = norm.ppf(1 - confidence)
        except ImportError:
            z = {0.95: -1.6449, 0.99: -2.3263, 0.999: -3.0902}.get(confidence, -2.3263)

        scale = math.sqrt(holding_period)
        sigma_p = math.sqrt(weights @ cov_matrix @ weights)
        portfolio_var = -z * sigma_p * scale * portfolio_value

        # Marginal VaR = dVaR/dw_i = -z * (cov_matrix @ w) / sigma_p * scale
        marginal = (-z * cov_matrix @ weights / sigma_p * scale * portfolio_value).tolist()

        # Component VaR = w_i * dVaR/dw_i
        component = (weights * np.array(marginal)).tolist()

        # Pct contribution
        total_comp = sum(component)
        pct_contrib = [c / total_comp * 100 if abs(total_comp) > 1e-10 else 0 for c in component]

        # Incremental VaR: VaR change from removing each position
        incremental = []
        for i in range(len(weights)):
            new_weights = weights.copy()
            old_w = new_weights[i]
            new_weights[i] = 0
            if new_weights.sum() > 0:
                new_weights /= new_weights.sum()
            sigma_new = math.sqrt(new_weights @ cov_matrix @ new_weights)
            new_var = -z * sigma_new * scale * portfolio_value
            incremental.append(portfolio_var - new_var)

        return {
            "portfolio_var":    round(portfolio_var, 2),
            "portfolio_sigma":  round(sigma_p * 100, 4),
            "marginal_var":     [round(m, 6) for m in marginal],
            "component_var":    [round(c, 2) for c in component],
            "pct_contribution": [round(p, 4) for p in pct_contrib],
            "incremental_var":  [round(v, 2) for v in incremental],
        }


# ─── DRAWDOWN ANALYSIS ───────────────────────────────────────────────────────

def compute_drawdowns(portfolio_values: pd.Series) -> DrawdownResult:
    """
    Full drawdown analysis on a portfolio equity curve.

    Args:
        portfolio_values: Series of portfolio NAV over time

    Returns: DrawdownResult with all drawdown metrics
    """
    if portfolio_values.empty:
        raise ValueError("Empty portfolio series")

    pv = portfolio_values.dropna()
    rolling_max = pv.cummax()
    drawdown_series = (pv - rolling_max) / rolling_max

    max_dd = float(drawdown_series.min())
    current_dd = float(drawdown_series.iloc[-1])
    avg_dd = float(drawdown_series[drawdown_series < 0].mean()) if (drawdown_series < 0).any() else 0.0

    # Find max drawdown period
    max_dd_idx = drawdown_series.idxmin()
    max_dd_start = None
    max_dd_end = None
    max_dd_recovery = None

    if max_dd_idx is not None:
        max_dd_end = max_dd_idx
        # Walk back to find peak
        sub = rolling_max.loc[:max_dd_idx]
        peak_val = rolling_max.loc[max_dd_idx]
        peaks = rolling_max.loc[:max_dd_idx]
        if not peaks.empty:
            peak_candidates = peaks[peaks == peak_val]
            if not peak_candidates.empty:
                max_dd_start = peak_candidates.index[0]

        # Walk forward to find recovery
        if max_dd_start is not None:
            peak_price = float(pv.loc[max_dd_start])
            future = pv.loc[max_dd_idx:]
            recoveries = future[future >= peak_price]
            if not recoveries.empty:
                max_dd_recovery = recoveries.index[0]

    # Duration
    duration_days = 0
    if max_dd_start is not None and max_dd_end is not None:
        try:
            duration_days = (max_dd_end - max_dd_start).days
        except Exception:
            duration_days = int(drawdown_series.argmin())

    # Ulcer Index
    ulcer_index = float(math.sqrt(np.mean(drawdown_series.to_numpy() ** 2)))
    pain_index  = float(np.mean(drawdown_series.clip(upper=0).abs().to_numpy()))

    # Calmar Ratio
    annual_return = float(pv.pct_change().mean() * 252) if len(pv) > 1 else 0.0
    calmar = annual_return / abs(max_dd) if abs(max_dd) > 1e-10 else 0.0

    return DrawdownResult(
        max_drawdown=round(max_dd * 100, 4),
        max_drawdown_start=max_dd_start,
        max_drawdown_end=max_dd_end,
        max_drawdown_recovery=max_dd_recovery,
        max_drawdown_duration_days=duration_days,
        current_drawdown=round(current_dd * 100, 4),
        average_drawdown=round(avg_dd * 100, 4),
        calmar_ratio=round(calmar, 4),
        ulcer_index=round(ulcer_index * 100, 4),
        pain_index=round(pain_index * 100, 4),
        drawdown_series=drawdown_series * 100,
    )


# ─── PERFORMANCE METRICS ─────────────────────────────────────────────────────

def performance_metrics(
    returns: pd.Series,
    benchmark_returns: Optional[pd.Series] = None,
    risk_free_rate: float = 0.05,
    periods_per_year: int = 252,
) -> Dict:
    """
    Comprehensive performance metrics matching Bloomberg PORT analytics.

    Returns all standard risk-adjusted performance metrics.
    """
    rets = returns.dropna()
    n = len(rets)
    if n < 5:
        return {}

    rf_daily = (1 + risk_free_rate) ** (1 / periods_per_year) - 1
    excess_rets = rets - rf_daily

    # Return stats
    total_ret = float((rets + 1).prod() - 1)
    ann_ret   = float((rets + 1).prod() ** (periods_per_year / n) - 1)
    ann_vol   = float(rets.std(ddof=1) * math.sqrt(periods_per_year))

    # Ratios
    sharpe   = float(excess_rets.mean() / rets.std(ddof=1) * math.sqrt(periods_per_year)) if rets.std() > 0 else 0
    downside = float(rets[rets < rf_daily].std(ddof=1) * math.sqrt(periods_per_year)) if (rets < rf_daily).any() else 0.001
    sortino  = float(excess_rets.mean() * periods_per_year / downside) if downside > 0 else 0

    # Distribution stats
    skew  = float(rets.skew())
    kurt  = float(rets.kurtosis())
    mean_daily = float(rets.mean())
    max_daily_gain = float(rets.max())
    max_daily_loss = float(rets.min())

    # Win rate
    win_rate = float((rets > 0).mean())
    avg_gain = float(rets[rets > 0].mean()) if (rets > 0).any() else 0
    avg_loss = float(rets[rets < 0].mean()) if (rets < 0).any() else 0
    profit_factor = abs(avg_gain / avg_loss) if avg_loss != 0 else float("inf")
    gain_to_pain = float(rets.sum() / rets[rets < 0].abs().sum()) if (rets < 0).any() else float("inf")

    # Omega Ratio (ratio of area above threshold to area below)
    threshold = rf_daily
    gains = (rets - threshold)[rets > threshold].sum()
    losses = (threshold - rets)[rets < threshold].sum()
    omega = float(gains / losses) if losses > 0 else float("inf")

    # Value at Risk (historical)
    var_95 = float(np.percentile(rets, 5))
    var_99 = float(np.percentile(rets, 1))
    cvar_95 = float(rets[rets <= np.percentile(rets, 5)].mean()) if (rets <= np.percentile(rets, 5)).any() else var_95

    # Drawdown
    pv_series = (1 + rets).cumprod()
    dd_result = compute_drawdowns(pv_series)

    calmar = ann_ret / abs(dd_result.max_drawdown / 100) if abs(dd_result.max_drawdown) > 0 else 0

    result = {
        "total_return":      round(total_ret * 100, 4),
        "annualised_return": round(ann_ret * 100, 4),
        "annualised_vol":    round(ann_vol * 100, 4),
        "sharpe_ratio":      round(sharpe, 4),
        "sortino_ratio":     round(sortino, 4),
        "calmar_ratio":      round(calmar, 4),
        "omega_ratio":       round(min(omega, 999), 4),
        "max_drawdown":      round(dd_result.max_drawdown, 4),
        "current_drawdown":  round(dd_result.current_drawdown, 4),
        "ulcer_index":       round(dd_result.ulcer_index, 4),
        "pain_index":        round(dd_result.pain_index, 4),
        "var_95_daily":      round(var_95 * 100, 4),
        "var_99_daily":      round(var_99 * 100, 4),
        "cvar_95_daily":     round(cvar_95 * 100, 4),
        "skewness":          round(skew, 4),
        "kurtosis":          round(kurt, 4),
        "mean_daily_return": round(mean_daily * 100, 6),
        "max_daily_gain":    round(max_daily_gain * 100, 4),
        "max_daily_loss":    round(max_daily_loss * 100, 4),
        "win_rate":          round(win_rate * 100, 4),
        "avg_gain":          round(avg_gain * 100, 4),
        "avg_loss":          round(avg_loss * 100, 4),
        "profit_factor":     round(min(profit_factor, 999), 4),
        "gain_to_pain":      round(min(gain_to_pain, 999), 4),
        "n_observations":    n,
    }

    if benchmark_returns is not None:
        bench = benchmark_returns.dropna().reindex(rets.index).dropna()
        aligned = rets.reindex(bench.index).dropna()
        if len(aligned) > 10:
            cov_matrix = np.cov(aligned, bench)
            beta  = float(cov_matrix[0, 1] / cov_matrix[1, 1]) if cov_matrix[1, 1] > 0 else 0
            alpha_daily = float(aligned.mean() - beta * bench.mean())
            alpha_ann   = float(alpha_daily * periods_per_year * 100)
            tracking_err = float((aligned - bench).std(ddof=1) * math.sqrt(periods_per_year) * 100)
            ir = float((aligned.mean() - bench.mean()) * periods_per_year / ((aligned - bench).std(ddof=1) * math.sqrt(periods_per_year))) \
                 if (aligned - bench).std() > 0 else 0
            correlation = float(np.corrcoef(aligned, bench)[0, 1])
            r_squared   = correlation ** 2
            treynor      = float((ann_ret - risk_free_rate) / beta) if abs(beta) > 1e-6 else 0
            result.update({
                "beta":                  round(beta, 4),
                "alpha_annualised":      round(alpha_ann, 4),
                "r_squared":             round(r_squared, 4),
                "tracking_error":        round(tracking_err, 4),
                "information_ratio":     round(ir, 4),
                "correlation_benchmark": round(correlation, 4),
                "treynor_ratio":         round(treynor, 4),
            })

    return result


# ─── STRESS TESTING ──────────────────────────────────────────────────────────

# Historical stress scenarios: {name: {factor: shock_pct}}
STRESS_SCENARIOS = {
    "2008_GFC_Lehman": {
        "SPX":    -0.57,  "VIX":    +3.50,  "HY_Spread": +20.0,
        "USD":    +0.15,  "Oil":    -0.70,  "Gold":      +0.05,
        "IG_Bonds": +0.08, "Rates_10y": -0.015
    },
    "COVID_March_2020": {
        "SPX":    -0.34,  "VIX":    +5.50,  "HY_Spread": +12.0,
        "USD":    +0.07,  "Oil":    -0.65,  "Gold":      +0.03,
        "IG_Bonds": +0.05, "Rates_10y": -0.008
    },
    "2022_Rate_Shock": {
        "SPX":    -0.19,  "VIX":    +0.90,  "HY_Spread": +4.5,
        "USD":    +0.15,  "Oil":    +0.45,  "Gold":      -0.04,
        "IG_Bonds": -0.15, "Rates_10y": +0.025
    },
    "1987_Black_Monday": {
        "SPX":    -0.23,  "VIX":    +8.00,  "HY_Spread": +5.0,
        "USD":    -0.05,  "Oil":    -0.10,  "Gold":      +0.08,
        "IG_Bonds": +0.02, "Rates_10y": -0.004
    },
    "2000_Dotcom_Bust": {
        "SPX":    -0.49,  "VIX":    +2.00,  "HY_Spread": +8.0,
        "USD":    -0.10,  "Oil":    -0.30,  "Gold":      +0.10,
        "IG_Bonds": +0.12, "Rates_10y": -0.012
    },
    "2011_Euro_Debt_Crisis": {
        "SPX":    -0.19,  "VIX":    +1.50,  "HY_Spread": +6.0,
        "USD":    -0.02,  "Oil":    -0.22,  "Gold":      +0.25,
        "IG_Bonds": +0.10, "Rates_10y": -0.010
    },
    "Rates_Up_300bps": {
        "SPX":    -0.25,  "VIX":    +1.20,  "HY_Spread": +5.0,
        "USD":    +0.08,  "Oil":    +0.05,  "Gold":      -0.12,
        "IG_Bonds": -0.20, "Rates_10y": +0.030
    },
    "USD_Crash_15pct": {
        "SPX":    +0.05,  "VIX":    +0.50,  "HY_Spread": +2.0,
        "USD":    -0.15,  "Oil":    +0.20,  "Gold":      +0.15,
        "IG_Bonds": 0.00, "Rates_10y": 0.000
    },
    "China_Slowdown": {
        "SPX":    -0.12,  "VIX":    +0.80,  "HY_Spread": +3.5,
        "USD":    +0.05,  "Oil":    -0.30,  "Gold":      -0.05,
        "IG_Bonds": +0.04, "Rates_10y": -0.005
    },
    "Inflation_Surge": {
        "SPX":    -0.15,  "VIX":    +0.70,  "HY_Spread": +2.5,
        "USD":    +0.03,  "Oil":    +0.35,  "Gold":      +0.20,
        "IG_Bonds": -0.12, "Rates_10y": +0.020
    },
}


def run_stress_test(
    positions: Dict[str, Dict],   # {symbol: {value, beta, duration, ...}}
    scenario_name: str = "2008_GFC_Lehman",
    custom_shocks: Optional[Dict[str, float]] = None,
) -> StressResult:
    """
    Run a single stress test scenario on a portfolio.

    Each position needs at minimum:
        value:     USD market value
        beta:      Equity beta (0 for bonds)
        duration:  IR duration (0 for equities)
        fx_exposure: fraction in non-USD currency

    Args:
        positions:      Position dict
        scenario_name:  Name from STRESS_SCENARIOS
        custom_shocks:  Override factor shocks

    Returns: StressResult with position-level and portfolio-level P&L
    """
    shocks = custom_shocks or STRESS_SCENARIOS.get(scenario_name, {})

    spx_shock   = shocks.get("SPX", 0.0)
    rates_shock = shocks.get("Rates_10y", 0.0)  # In decimal
    usd_shock   = shocks.get("USD", 0.0)

    position_pnl = {}
    total_pnl = 0.0

    for symbol, pos in positions.items():
        value    = float(pos.get("value", 0))
        beta     = float(pos.get("beta", 1.0))
        duration = float(pos.get("duration", 0.0))
        fx_exp   = float(pos.get("fx_exposure", 0.0))   # Fraction in foreign currency
        credit_spread_dur = float(pos.get("spread_duration", 0.0))
        hy_shock = shocks.get("HY_Spread", 0.0) / 100.0  # Convert bps to decimal for bonds

        # Equity P&L: beta-adjusted SPX shock
        equity_pnl = value * beta * spx_shock

        # Interest rate P&L: -duration * rate_change * value
        ir_pnl = -duration * rates_shock * value

        # FX P&L
        fx_pnl = value * fx_exp * (-usd_shock)  # If USD weakens, foreign positions gain

        # Credit spread P&L: -spread_duration * spread_change
        credit_pnl = -credit_spread_dur * hy_shock * value

        pos_pnl = equity_pnl + ir_pnl + fx_pnl + credit_pnl
        position_pnl[symbol] = round(pos_pnl, 2)
        total_pnl += pos_pnl

    total_value = sum(pos.get("value", 0) for pos in positions.values())
    pnl_pct = total_pnl / total_value * 100 if total_value > 0 else 0.0

    worst = min(position_pnl, key=position_pnl.get) if position_pnl else ""
    best  = max(position_pnl, key=position_pnl.get) if position_pnl else ""

    return StressResult(
        scenario_name=scenario_name,
        portfolio_pnl=round(total_pnl, 2),
        portfolio_pnl_pct=round(pnl_pct, 4),
        position_pnl=position_pnl,
        worst_position=worst,
        best_position=best,
        factor_shocks=shocks,
    )


def run_all_stress_tests(positions: Dict[str, Dict]) -> List[StressResult]:
    """Run all predefined stress scenarios."""
    return [run_stress_test(positions, s) for s in STRESS_SCENARIOS]


def reverse_stress_test(
    positions: Dict[str, Dict],
    target_loss_pct: float = -0.10,
) -> List[Dict]:
    """
    Reverse stress testing: find factor shocks that produce target_loss_pct.
    Returns sorted list of scenarios closest to the target loss.
    """
    results = run_all_stress_tests(positions)
    total_value = sum(pos.get("value", 0) for pos in positions.values())

    ranked = []
    for r in results:
        diff = abs(r.portfolio_pnl_pct - target_loss_pct * 100)
        ranked.append({
            "scenario":           r.scenario_name,
            "pnl_pct":            r.portfolio_pnl_pct,
            "distance_to_target": round(diff, 4),
            "pnl_usd":            r.portfolio_pnl,
        })
    return sorted(ranked, key=lambda x: x["distance_to_target"])


# ─── FACTOR RISK DECOMPOSITION ───────────────────────────────────────────────

def fama_french_decomposition(
    portfolio_returns: pd.Series,
    factor_returns: pd.DataFrame,
    risk_free: Optional[pd.Series] = None,
) -> FactorExposure:
    """
    Fama-French multi-factor model via OLS regression.

    Args:
        portfolio_returns:  Portfolio daily return series
        factor_returns:     DataFrame with columns for each factor (Mkt-RF, SMB, HML, etc.)
        risk_free:          Risk-free rate series (if None, assumes 0)

    Returns: FactorExposure with betas and risk decomposition
    """
    aligned = portfolio_returns.dropna()
    ff = factor_returns.reindex(aligned.index).dropna()
    aligned = aligned.reindex(ff.index)

    if risk_free is not None:
        rf = risk_free.reindex(ff.index).fillna(0)
    else:
        rf = pd.Series(0.0, index=ff.index)

    excess_ret = aligned - rf

    # OLS: y = alpha + B1*F1 + B2*F2 + ... + e
    X = np.column_stack([np.ones(len(ff))] + [ff[c].to_numpy() for c in ff.columns])
    y = excess_ret.to_numpy()

    try:
        coeffs, residuals, rank, sv = np.linalg.lstsq(X, y, rcond=None)
    except np.linalg.LinAlgError:
        return FactorExposure(
            factor_betas={}, factor_contrib={}, specific_risk=0,
            systematic_risk=0, total_risk=0, r_squared=0, alpha=0,
        )

    alpha = float(coeffs[0])
    betas = {c: float(b) for c, b in zip(ff.columns, coeffs[1:])}

    # Calculate predicted values
    y_hat = X @ coeffs
    ss_res = float(np.sum((y - y_hat) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r_sq   = 1 - ss_res / ss_tot if ss_tot > 0 else 0

    # Risk decomposition
    total_var = float(np.var(y, ddof=1))
    specific_var = float(np.var(y - y_hat, ddof=1))
    systematic_var = total_var - specific_var

    # Factor contributions to variance
    factor_contrib = {}
    for i, col in enumerate(ff.columns):
        beta_i = coeffs[i + 1]
        factor_var = float(np.var(ff[col].to_numpy(), ddof=1))
        factor_contrib[col] = round(beta_i ** 2 * factor_var / total_var * 100 if total_var > 0 else 0, 4)

    return FactorExposure(
        factor_betas={k: round(v, 6) for k, v in betas.items()},
        factor_contrib=factor_contrib,
        specific_risk=round(math.sqrt(max(0, specific_var) * 252) * 100, 4),
        systematic_risk=round(math.sqrt(max(0, systematic_var) * 252) * 100, 4),
        total_risk=round(math.sqrt(max(0, total_var) * 252) * 100, 4),
        r_squared=round(max(0, r_sq), 6),
        alpha=round(alpha * 252 * 100, 4),  # Annualised alpha in %
    )


# ─── BRINSON ATTRIBUTION ─────────────────────────────────────────────────────

def brinson_attribution(
    portfolio_weights: Dict[str, float],
    benchmark_weights: Dict[str, float],
    portfolio_returns: Dict[str, float],
    benchmark_returns: Dict[str, float],
) -> AttributionResult:
    """
    Brinson-Hood-Beebower performance attribution.

    Args:
        portfolio_weights:  {sector: weight} for portfolio
        benchmark_weights:  {sector: weight} for benchmark
        portfolio_returns:  {sector: period_return} for portfolio
        benchmark_returns:  {sector: period_return} for benchmark

    Returns: AttributionResult with allocation/selection/interaction effects
    """
    sectors = set(list(portfolio_weights.keys()) + list(benchmark_weights.keys()))

    allocation    = {}
    selection     = {}
    interaction   = {}
    total_by_sec  = {}

    bench_total = sum(benchmark_weights.get(s, 0) * benchmark_returns.get(s, 0) for s in sectors)

    for s in sectors:
        wp  = portfolio_weights.get(s, 0.0)
        wb  = benchmark_weights.get(s, 0.0)
        rp  = portfolio_returns.get(s, 0.0)
        rb  = benchmark_returns.get(s, 0.0)
        rb_total = bench_total

        alloc   = (wp - wb) * (rb - rb_total)
        select  = wb * (rp - rb)
        interact = (wp - wb) * (rp - rb)

        allocation[s]  = round(alloc * 100, 6)
        selection[s]   = round(select * 100, 6)
        interaction[s] = round(interact * 100, 6)
        total_by_sec[s] = round((alloc + select + interact) * 100, 6)

    total_active = sum(total_by_sec.values())

    return AttributionResult(
        total_active_return=round(total_active, 6),
        allocation_effect=allocation,
        selection_effect=selection,
        interaction_effect=interaction,
        total_by_sector=total_by_sec,
    )


# ─── CORRELATION ANALYSIS ────────────────────────────────────────────────────

def rolling_correlation_matrix(
    returns_df: pd.DataFrame,
    window: int = 60,
) -> Dict[str, pd.DataFrame]:
    """
    Compute rolling correlation matrix with regime detection.
    Returns dict with 'current', 'min', 'max', 'mean' correlation matrices.
    """
    current = returns_df.iloc[-window:].corr()
    all_corr = returns_df.rolling(window).corr()

    # Compute statistics across time (last level of MultiIndex)
    stats = {}
    assets = returns_df.columns.tolist()
    for stat, fn in [("min", "min"), ("max", "max"), ("mean", "mean")]:
        matrix = pd.DataFrame(np.eye(len(assets)), index=assets, columns=assets)
        for a1 in assets:
            for a2 in assets:
                if a1 != a2:
                    try:
                        series = all_corr.xs(a1, level=1)[a2].dropna() if isinstance(all_corr.index, pd.MultiIndex) else pd.Series()
                        matrix.loc[a1, a2] = getattr(series, fn)() if len(series) > 0 else 0
                    except Exception:
                        pass
        stats[stat] = matrix

    return {"current": current, **stats}


def correlation_regime(returns: pd.Series, benchmark: pd.Series, window: int = 60) -> pd.Series:
    """
    Detect correlation regimes (high/low/negative) via rolling correlation.
    Returns Series with labels: 'high', 'moderate', 'low', 'negative'
    """
    roll_corr = returns.rolling(window).corr(benchmark)
    regime = pd.cut(roll_corr, bins=[-1.0, -0.3, 0.3, 0.7, 1.0],
                    labels=["negative", "low", "moderate", "high"])
    return regime


# ─── RISK ENGINE CLASS (unified API) ─────────────────────────────────────────

class RiskEngine:
    """
    Unified risk engine combining all risk analytics.
    Designed to be used as a portfolio-level risk calculator.
    """

    def __init__(
        self,
        returns: pd.Series,
        portfolio_value: float = 1_000_000,
        benchmark_returns: Optional[pd.Series] = None,
        risk_free_rate: float = 0.05,
    ):
        self.returns = returns.dropna()
        self.portfolio_value = portfolio_value
        self.benchmark_returns = benchmark_returns
        self.risk_free_rate = risk_free_rate

    def var_suite(self, holding_period: int = 1) -> Dict:
        """Compute VaR using all three methods and return comparison."""
        historical = HistoricalVaR.compute(self.returns, self.portfolio_value, holding_period=holding_period)
        parametric  = ParametricVaR.compute(self.returns, self.portfolio_value, holding_period=holding_period)
        mc          = MonteCarloVaR.compute(self.returns, self.portfolio_value, holding_period=holding_period)
        return {
            "historical":   {"var_95": historical.var_95, "var_99": historical.var_99, "cvar_95": historical.cvar_95, "cvar_99": historical.cvar_99},
            "parametric":   {"var_95": parametric.var_95, "var_99": parametric.var_99, "cvar_95": parametric.cvar_95, "cvar_99": parametric.cvar_99},
            "monte_carlo":  {"var_95": mc.var_95, "var_99": mc.var_99, "cvar_95": mc.cvar_95, "cvar_99": mc.cvar_99},
            "method_labels": ["Historical", "Parametric", "Monte Carlo"],
        }

    def drawdown_analysis(self) -> Dict:
        """Portfolio drawdown analytics."""
        pv = (1 + self.returns).cumprod() * self.portfolio_value
        dd = compute_drawdowns(pv)
        return {
            "max_drawdown":       dd.max_drawdown,
            "current_drawdown":   dd.current_drawdown,
            "average_drawdown":   dd.average_drawdown,
            "calmar_ratio":       dd.calmar_ratio,
            "ulcer_index":        dd.ulcer_index,
            "pain_index":         dd.pain_index,
            "duration_days":      dd.max_drawdown_duration_days,
        }

    def performance_summary(self) -> Dict:
        """Full performance analytics."""
        return performance_metrics(
            self.returns, self.benchmark_returns, self.risk_free_rate
        )

    def rolling_risk(self, window: int = 252) -> pd.DataFrame:
        """Rolling risk metrics over a lookback window."""
        rets = self.returns
        vol    = rets.rolling(window).std(ddof=1) * math.sqrt(252) * 100
        sharpe = rets.rolling(window).apply(
            lambda x: x.mean() / x.std(ddof=1) * math.sqrt(252) if x.std() > 0 else 0,
            raw=True
        )
        var95 = rets.rolling(window).apply(
            lambda x: -np.percentile(x, 5) * 100, raw=True
        )
        return pd.DataFrame({
            "rolling_vol":    vol,
            "rolling_sharpe": sharpe,
            "rolling_var_95": var95,
        })

    def stress_test_portfolio(self, positions: Dict[str, Dict]) -> List[Dict]:
        """Run all stress scenarios."""
        results = run_all_stress_tests(positions)
        return [
            {
                "scenario": r.scenario_name,
                "pnl_usd": r.portfolio_pnl,
                "pnl_pct": r.portfolio_pnl_pct,
                "worst_position": r.worst_position,
            }
            for r in sorted(results, key=lambda x: x.portfolio_pnl_pct)
        ]
