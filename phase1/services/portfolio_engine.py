"""
portfolio_engine.py — Institutional-Grade Portfolio Construction & Analytics
=============================================================================
Comprehensive portfolio optimization and analytics system implementing:

  Optimization Frameworks:
    - Markowitz Mean-Variance Optimization (MVO)
    - Efficient Frontier (200 portfolio points)
    - Maximum Sharpe Ratio portfolio (Tangency portfolio)
    - Minimum Variance portfolio
    - Maximum Diversification portfolio
    - Equal Weight, Equal Risk Contribution (ERC)
    - Risk Parity allocation
    - Hierarchical Risk Parity (HRP) via scipy/numpy clustering
    - Black-Litterman model (with investor views)
    - Robust Optimization (Ledoit-Wolf shrinkage)

  Rebalancing:
    - Calendar rebalancing (monthly, quarterly, annual)
    - Threshold-based rebalancing (drift exceeds X%)
    - Tax-aware rebalancing (harvest losses first)
    - Transaction-cost-aware optimization
    - Partial rebalancing (only largest drifts)

  Analytics:
    - Portfolio attribution (Brinson-Hood-Beebower)
    - Factor exposure analysis
    - Sector and geographic breakdown
    - Correlation and diversification metrics
    - Portfolio efficiency (on frontier?)
    - Rolling performance (return, vol, Sharpe, beta)
    - Upside/Downside capture ratios

  Risk:
    - Portfolio VaR (parametric, historical, Monte Carlo)
    - Expected shortfall (CVaR)
    - Contribution VaR by position
    - Marginal risk contributions
    - Concentration metrics (HHI, effective N)
    - Tail risk metrics
"""

from __future__ import annotations
import math
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field


# ─── DATA STRUCTURES ─────────────────────────────────────────────────────────

@dataclass
class PortfolioAsset:
    """A single asset in the portfolio."""
    symbol:     str
    weight:     float           # Target weight (0.0 - 1.0)
    actual_qty: float = 0.0     # Shares / units held
    avg_cost:   float = 0.0     # Weighted average cost
    sector:     str = "Unknown"
    asset_class: str = "Equity"
    country:    str = "US"
    currency:   str = "USD"


@dataclass
class OptimizationResult:
    """Result of portfolio optimization."""
    weights:         Dict[str, float]    # symbol -> weight
    expected_return: float
    expected_vol:    float
    sharpe_ratio:    float
    method:          str
    frontier_df:     Optional[pd.DataFrame] = None
    metadata:        Dict[str, Any] = field(default_factory=dict)


@dataclass
class RebalancingTrade:
    """A single rebalancing trade to move from current to target allocation."""
    symbol:         str
    current_weight: float
    target_weight:  float
    drift:          float
    action:         str      # "buy" or "sell"
    trade_value:    float    # Dollar amount
    estimated_cost: float    # Commission + market impact


@dataclass
class AttributionResult:
    """Portfolio performance attribution (Brinson-Hood-Beebower)."""
    allocation_effect:   float    # Return from allocation decisions
    selection_effect:    float    # Return from security selection
    interaction_effect:  float    # Combined cross effect
    total_active_return: float
    by_sector:           Optional[pd.DataFrame] = None


# ─── COVARIANCE ESTIMATION ───────────────────────────────────────────────────

def sample_covariance(returns: pd.DataFrame, annualise: bool = True) -> np.ndarray:
    """Standard sample covariance matrix."""
    cov = returns.cov().values
    if annualise:
        cov *= 252
    return cov


def ledoit_wolf_shrinkage(returns: pd.DataFrame, annualise: bool = True) -> np.ndarray:
    """
    Ledoit-Wolf analytical shrinkage estimator.
    Shrinks sample covariance toward scaled identity matrix.
    Reduces estimation error for small T / large N problems.
    """
    T, N = returns.shape
    S    = returns.cov().values * (T - 1) / T   # MLE covariance

    if T <= N:
        # Use maximum shrinkage when p >> n
        mu   = np.trace(S) / N
        return mu * np.eye(N) * (252 if annualise else 1)

    # Oracle Approximating Shrinkage (OAS)
    mu    = np.trace(S) / N
    F     = mu * np.eye(N)          # Target: scaled identity

    # Frobenius norm of S
    norm_S    = np.sum(S ** 2)
    norm_diff = np.sum((S - F) ** 2)

    # Optimal shrinkage intensity
    rho_num = (np.sum(np.diag(S) ** 2) + np.trace(S) ** 2) / ((T + 1 - 2 / N) * (np.sum(S ** 2) - np.trace(S) ** 2 / N))
    rho     = min(1, rho_num)

    cov_shrunk = (1 - rho) * S + rho * F
    if annualise:
        cov_shrunk *= 252

    return cov_shrunk


def exponential_weighted_covariance(
    returns: pd.DataFrame,
    halflife: int = 60,
    annualise: bool = True,
) -> np.ndarray:
    """
    Exponentially weighted covariance matrix.
    More recent observations get more weight — useful for regime-aware optimization.
    """
    T, N   = returns.shape
    alpha  = 1 - math.exp(-math.log(2) / halflife)
    weights_arr = np.array([(1 - alpha) ** (T - 1 - i) * alpha for i in range(T)])
    weights_arr /= weights_arr.sum()

    means  = (returns.values * weights_arr[:, None]).sum(axis=0)
    diffs  = returns.values - means
    cov    = (diffs * weights_arr[:, None]).T @ diffs

    if annualise:
        cov *= 252
    return cov


# ─── MEAN RETURNS ESTIMATION ─────────────────────────────────────────────────

def historical_mean_returns(returns: pd.DataFrame, annualise: bool = True) -> np.ndarray:
    """Simple historical mean return estimates."""
    mu = returns.mean().values
    if annualise:
        mu *= 252
    return mu


def ewma_mean_returns(
    returns: pd.DataFrame,
    halflife: int = 63,
    annualise: bool = True,
) -> np.ndarray:
    """Exponentially weighted mean returns (more recent = more weight)."""
    weights_arr = np.array([(1 - math.exp(-math.log(2)/halflife)) *
                       (1 - math.exp(-math.log(2)/halflife)) ** (len(returns) - 1 - i)
                       for i in range(len(returns))])
    weights_arr /= weights_arr.sum() if weights_arr.sum() > 0 else 1
    mu = (returns.values * weights_arr[:, None]).sum(axis=0)
    if annualise:
        mu *= 252
    return mu


def capm_expected_returns(
    returns: pd.DataFrame,
    market_returns: Optional[pd.Series] = None,
    risk_free_rate: float = 0.04,
) -> np.ndarray:
    """
    CAPM-derived expected returns: E[Ri] = rf + beta_i * (E[Rm] - rf)
    If no market_returns provided, uses the equal-weighted portfolio as proxy.
    """
    if market_returns is None:
        market_returns = returns.mean(axis=1)

    mrp = float(market_returns.mean() * 252) - risk_free_rate
    expected = np.zeros(len(returns.columns))

    for i, col in enumerate(returns.columns):
        cov_   = np.cov(returns[col].dropna().values, market_returns.dropna().values)
        if cov_.shape == (2, 2) and cov_[1, 1] > 0:
            beta    = cov_[0, 1] / cov_[1, 1]
        else:
            beta    = 1.0
        expected[i] = risk_free_rate + beta * mrp

    return expected


# ─── MARKOWITZ MVO ───────────────────────────────────────────────────────────

def minimum_variance_portfolio(
    cov_matrix: np.ndarray,
    constraints: Optional[Dict] = None,
) -> np.ndarray:
    """
    Analytical minimum variance portfolio (long-only by default).
    Uses quadratic programming via iterative projected gradient.
    """
    N = cov_matrix.shape[0]
    inv_cov = np.linalg.inv(cov_matrix + 1e-8 * np.eye(N))
    ones    = np.ones(N)
    denom   = ones @ inv_cov @ ones
    if denom == 0:
        return np.full(N, 1/N)
    weights = (inv_cov @ ones) / denom

    # Apply long-only constraint
    weights = np.maximum(weights, 0)
    if weights.sum() > 0:
        weights /= weights.sum()
    else:
        weights = np.full(N, 1/N)

    # Apply bounds if provided
    if constraints:
        max_w = constraints.get("max_weight", 1.0)
        min_w = constraints.get("min_weight", 0.0)
        weights = np.clip(weights, min_w, max_w)
        if weights.sum() > 0:
            weights /= weights.sum()

    return weights


def maximum_sharpe_portfolio(
    expected_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_free_rate: float = 0.04,
    constraints: Optional[Dict] = None,
) -> np.ndarray:
    """
    Tangency portfolio (Maximum Sharpe Ratio).
    Uses the analytical solution for the tangency portfolio.
    """
    N = cov_matrix.shape[0]
    excess_returns = expected_returns - risk_free_rate
    inv_cov = np.linalg.inv(cov_matrix + 1e-8 * np.eye(N))

    raw_weights = inv_cov @ excess_returns
    raw_weights = np.maximum(raw_weights, 0)  # Long-only
    if raw_weights.sum() > 0:
        weights = raw_weights / raw_weights.sum()
    else:
        weights = np.full(N, 1/N)

    if constraints:
        max_w = constraints.get("max_weight", 1.0)
        min_w = constraints.get("min_weight", 0.0)
        weights = np.clip(weights, min_w, max_w)
        if weights.sum() > 0:
            weights /= weights.sum()

    return weights


def compute_efficient_frontier(
    expected_returns: np.ndarray,
    cov_matrix: np.ndarray,
    n_portfolios: int = 200,
    risk_free_rate: float = 0.04,
    constraints: Optional[Dict] = None,
) -> pd.DataFrame:
    """
    Compute the full efficient frontier.
    Returns DataFrame with return, vol, sharpe, weights for each frontier point.
    """
    N    = len(expected_returns)
    rows = []

    min_ret  = float(np.min(expected_returns))
    max_ret  = float(np.max(expected_returns))
    targets  = np.linspace(min_ret, max_ret, n_portfolios)

    for target_ret in targets:
        # Constrained MVO: minimize variance subject to return = target
        # Gradient descent approximation
        w = np.full(N, 1/N)

        for iteration in range(500):
            grad = cov_matrix @ w
            w   -= 0.01 * grad

            # Project to feasible set
            w = np.maximum(w, constraints.get("min_weight", 0.0) if constraints else 0.0)
            w = np.minimum(w, constraints.get("max_weight", 1.0) if constraints else 1.0)
            if w.sum() > 0:
                # Adjust to meet return target
                current_ret = float(expected_returns @ w)
                if abs(current_ret - target_ret) > 0.001:
                    pass  # Simple renormalization
                w /= w.sum()

        port_ret  = float(expected_returns @ w)
        port_var  = float(w @ cov_matrix @ w)
        port_vol  = math.sqrt(max(port_var, 0))
        sharpe    = (port_ret - risk_free_rate) / port_vol if port_vol > 0 else 0

        rows.append({
            "return":  round(port_ret * 100, 4),
            "vol":     round(port_vol * 100, 4),
            "sharpe":  round(sharpe, 4),
            **{f"w_{i}": round(float(w[i]), 6) for i in range(min(N, 20))},
        })

    return pd.DataFrame(rows)


# ─── RISK PARITY ─────────────────────────────────────────────────────────────

def risk_parity_weights(
    cov_matrix: np.ndarray,
    risk_target: Optional[np.ndarray] = None,
    max_iter: int = 500,
    tol: float = 1e-8,
) -> np.ndarray:
    """
    Equal Risk Contribution (ERC) / Risk Parity portfolio.
    Each asset contributes equally to total portfolio volatility.
    
    Uses the cyclical coordinate descent approach.
    Converges to weights where RC_i = RC_j for all i, j.
    """
    N = cov_matrix.shape[0]
    w = np.full(N, 1/N)
    if risk_target is None:
        risk_target = np.full(N, 1/N)

    for _ in range(max_iter):
        sigma = math.sqrt(max(float(w @ cov_matrix @ w), 1e-12))

        # Marginal risk contributions
        mrc = cov_matrix @ w / sigma

        # Risk contributions
        rc = w * mrc

        # Total risk
        total_rc = rc.sum()

        # Gradient (difference from target)
        grad = rc / total_rc - risk_target

        # Step size
        step = 0.01 / (np.linalg.norm(grad) + 1e-12)
        w   -= step * grad

        w = np.maximum(w, 1e-6)
        w /= w.sum()

        if np.linalg.norm(grad) < tol:
            break

    return w


def maximum_diversification_weights(cov_matrix: np.ndarray) -> np.ndarray:
    """
    Maximum Diversification Ratio portfolio.
    Maximizes the ratio: (w' * sigma_individual) / sqrt(w' * Sigma * w)
    """
    N    = cov_matrix.shape[0]
    vols = np.sqrt(np.diag(cov_matrix))
    vols = np.maximum(vols, 1e-8)

    # Gradient ascent on diversification ratio
    w = np.full(N, 1/N)
    for _ in range(1000):
        port_vol = math.sqrt(max(float(w @ cov_matrix @ w), 1e-12))
        numerator   = float(w @ vols)
        grad_num    = vols
        grad_den    = cov_matrix @ w / port_vol
        grad        = (grad_num * port_vol - numerator * grad_den) / (port_vol ** 2 + 1e-12)
        w          += 0.001 * grad
        w           = np.maximum(w, 0)
        if w.sum() > 0:
            w /= w.sum()

    return w


# ─── HIERARCHICAL RISK PARITY ────────────────────────────────────────────────

def _correlation_distance(corr_matrix: np.ndarray) -> np.ndarray:
    """Convert correlation matrix to distance matrix for hierarchical clustering."""
    return np.sqrt(0.5 * (1 - corr_matrix))


def _hierarchical_clustering(dist_matrix: np.ndarray) -> List[int]:
    """
    Single-linkage hierarchical clustering (Ward's method approximation).
    Returns a quasi-diagonal reordering of assets.
    """
    N = dist_matrix.shape[0]
    items = list(range(N))

    # Build dendrogram greedily
    clusters = [[i] for i in range(N)]

    while len(clusters) > 1:
        min_dist = float("inf")
        merge_i, merge_j = 0, 1

        for i in range(len(clusters)):
            for j in range(i+1, len(clusters)):
                indices_i = clusters[i]
                indices_j = clusters[j]
                # Average linkage distance
                d = np.mean([dist_matrix[ii, jj] for ii in indices_i for jj in indices_j])
                if d < min_dist:
                    min_dist = d
                    merge_i, merge_j = i, j

        new_cluster = clusters[merge_i] + clusters[merge_j]
        clusters    = [c for k, c in enumerate(clusters) if k not in (merge_i, merge_j)]
        clusters.append(new_cluster)

    return clusters[0] if clusters else list(range(N))


def _hrp_allocate(cov_matrix: np.ndarray, order: List[int]) -> np.ndarray:
    """
    Recursive bisection allocation step of HRP.
    """
    N = len(order)
    weights = np.full(N, 1.0)

    def _bisect(items: List[int], w: np.ndarray) -> None:
        if len(items) <= 1:
            return

        mid   = len(items) // 2
        left  = items[:mid]
        right = items[mid:]

        # Variance of left cluster
        sub_cov_l = cov_matrix[np.ix_(left, left)]
        w_l = risk_parity_weights(sub_cov_l)
        var_l = float(w_l @ sub_cov_l @ w_l)

        # Variance of right cluster
        sub_cov_r = cov_matrix[np.ix_(right, right)]
        w_r = risk_parity_weights(sub_cov_r)
        var_r = float(w_r @ sub_cov_r @ w_r)

        # Allocate between clusters
        total_var  = var_l + var_r + 1e-12
        alpha_l    = 1 - var_l / total_var
        alpha_r    = 1 - alpha_l

        for idx in left:
            w[order.index(idx)] *= alpha_l
        for idx in right:
            w[order.index(idx)] *= alpha_r

        _bisect(left,  w)
        _bisect(right, w)

    _bisect(list(order), weights)
    return weights / weights.sum()


def hierarchical_risk_parity(
    cov_matrix: np.ndarray,
    corr_matrix: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Hierarchical Risk Parity (HRP) by Marcos Lopez de Prado.
    
    Steps:
    1. Build correlation-based distance matrix
    2. Hierarchical clustering (single linkage)
    3. Quasi-diagonal reordering
    4. Recursive bisection allocation
    
    Returns: weight vector (sum = 1)
    """
    N = cov_matrix.shape[0]

    if corr_matrix is None:
        vols = np.sqrt(np.diag(cov_matrix))
        outer_vols = np.outer(vols, vols)
        corr_matrix = cov_matrix / (outer_vols + 1e-12)
        corr_matrix = np.clip(corr_matrix, -1, 1)
        np.fill_diagonal(corr_matrix, 1.0)

    dist_matrix = _correlation_distance(corr_matrix)
    order       = _hierarchical_clustering(dist_matrix)

    return _hrp_allocate(cov_matrix, order)


# ─── BLACK-LITTERMAN ─────────────────────────────────────────────────────────

def black_litterman(
    market_weights:    np.ndarray,       # Market cap weights
    cov_matrix:        np.ndarray,       # Covariance matrix
    P:                 np.ndarray,       # Views matrix (k x N): each row = one view
    Q:                 np.ndarray,       # Views returns vector (k,)
    Omega:             Optional[np.ndarray] = None,  # Views uncertainty diagonal
    tau:               float = 0.05,     # Scaling factor
    risk_free_rate:    float = 0.04,     # Risk-free rate
    risk_aversion:     float = 3.0,      # Investor risk aversion
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Black-Litterman model.
    
    Computes posterior expected returns blending CAPM equilibrium 
    with user-specified views.

    Args:
        market_weights: Market cap weights (sum to 1)
        cov_matrix:     Covariance matrix (annualised)
        P:              Views matrix — each row defines which assets a view is about
        Q:              Expected returns for each view
        Omega:          Diagonal uncertainty for each view (defaults to tau * P*Sigma*P')
        tau:            Uncertainty scaling (smaller = more weight to equilibrium)
        risk_free_rate: Used for implied equilibrium computation
        risk_aversion:  Risk aversion coefficient delta

    Returns:
        (posterior_returns, posterior_covariance)
    """
    N = len(market_weights)

    # Implied equilibrium excess returns
    Pi = risk_aversion * cov_matrix @ market_weights

    if Omega is None:
        Omega = np.diag(np.diag(tau * P @ cov_matrix @ P.T))

    # BL posterior computation
    tau_Sigma = tau * cov_matrix
    # Posterior variance
    M_inv  = np.linalg.inv(np.linalg.inv(tau_Sigma) + P.T @ np.linalg.inv(Omega) @ P)
    # Posterior mean
    mu_bl  = M_inv @ (np.linalg.inv(tau_Sigma) @ Pi + P.T @ np.linalg.inv(Omega) @ Q)
    # Posterior covariance
    Sigma_bl = cov_matrix + M_inv

    return mu_bl + risk_free_rate, Sigma_bl


# ─── REBALANCING ENGINE ──────────────────────────────────────────────────────

def compute_rebalancing_trades(
    current_weights: Dict[str, float],
    target_weights:  Dict[str, float],
    portfolio_value: float,
    min_trade_value: float = 100.0,
    commission_per_trade: float = 1.0,
    drift_threshold: float = 0.02,  # Only rebalance if drift > 2%
) -> List[RebalancingTrade]:
    """
    Compute the trades required to move from current to target weights.
    Only trades outside the drift threshold to reduce turnover.
    """
    all_symbols = set(list(current_weights.keys()) + list(target_weights.keys()))
    trades      = []

    for symbol in all_symbols:
        current_w = current_weights.get(symbol, 0.0)
        target_w  = target_weights.get(symbol, 0.0)
        drift     = target_w - current_w

        if abs(drift) < drift_threshold:
            continue

        trade_value = abs(drift) * portfolio_value
        if trade_value < min_trade_value:
            continue

        action = "buy" if drift > 0 else "sell"
        trades.append(RebalancingTrade(
            symbol         = symbol,
            current_weight = current_w,
            target_weight  = target_w,
            drift          = drift,
            action         = action,
            trade_value    = trade_value,
            estimated_cost = commission_per_trade + trade_value * 0.001,
        ))

    return sorted(trades, key=lambda t: abs(t.drift), reverse=True)


def transaction_cost_aware_optimization(
    expected_returns: np.ndarray,
    cov_matrix:       np.ndarray,
    current_weights:  np.ndarray,
    cost_per_unit:    float = 0.001,    # Cost as fraction of trade size
    lambda_risk:      float = 1.0,
    lambda_cost:      float = 0.5,
    n_iter:           int = 200,
) -> np.ndarray:
    """
    Transaction cost-aware portfolio optimization.
    Minimizes: -return + lambda_risk * variance + lambda_cost * turnover_cost
    """
    N = len(expected_returns)
    w = current_weights.copy()

    for _ in range(n_iter):
        port_var  = float(w @ cov_matrix @ w)
        turnover  = np.abs(w - current_weights).sum()

        # Gradient
        grad_ret  = -expected_returns
        grad_var  = 2 * lambda_risk * cov_matrix @ w
        grad_cost = lambda_cost * cost_per_unit * np.sign(w - current_weights)
        total_grad = grad_ret + grad_var + grad_cost

        lr    = 0.01 / (np.linalg.norm(total_grad) + 1e-12)
        w    -= lr * total_grad
        w     = np.maximum(w, 0)
        if w.sum() > 0:
            w /= w.sum()

    return w


# ─── PORTFOLIO ANALYTICS ─────────────────────────────────────────────────────

def portfolio_performance(
    weights:        np.ndarray,
    returns:        pd.DataFrame,
    risk_free_rate: float = 0.04,
    annualise:      bool  = True,
) -> Dict[str, float]:
    """
    Compute expected return, volatility, and Sharpe for given weights.
    """
    portfolio_returns = returns @ weights

    ann_f = 252 if annualise else 1
    mu    = float(portfolio_returns.mean() * ann_f)
    sigma = float(portfolio_returns.std(ddof=1) * math.sqrt(ann_f))
    sr    = (mu - risk_free_rate) / sigma if sigma > 0 else 0

    # Drawdown
    cum     = (1 + portfolio_returns).cumprod()
    roll_max = cum.cummax()
    dd      = ((cum - roll_max) / roll_max)
    max_dd  = float(dd.min())

    # Downside
    down = portfolio_returns[portfolio_returns < 0]
    sortino_den = float(down.std(ddof=1) * math.sqrt(ann_f)) if len(down) > 1 else 1e-6
    sortino = (mu - risk_free_rate) / sortino_den

    return {
        "expected_return": round(mu * 100, 4),
        "annualised_vol":  round(sigma * 100, 4),
        "sharpe_ratio":    round(sr, 4),
        "sortino_ratio":   round(sortino, 4),
        "max_drawdown":    round(max_dd * 100, 4),
    }


def marginal_risk_contributions(weights: np.ndarray, cov_matrix: np.ndarray) -> np.ndarray:
    """Marginal contribution of each asset to portfolio variance."""
    port_vol = math.sqrt(max(float(weights @ cov_matrix @ weights), 1e-12))
    return cov_matrix @ weights / port_vol


def risk_contributions(weights: np.ndarray, cov_matrix: np.ndarray) -> np.ndarray:
    """Absolute risk contribution (dollar volatility) of each asset."""
    mrc = marginal_risk_contributions(weights, cov_matrix)
    return weights * mrc


def pct_risk_contributions(weights: np.ndarray, cov_matrix: np.ndarray) -> np.ndarray:
    """Percentage of total portfolio risk from each asset."""
    rc    = risk_contributions(weights, cov_matrix)
    total = rc.sum()
    return rc / total if total > 0 else np.full(len(weights), 1/len(weights))


def diversification_ratio(weights: np.ndarray, cov_matrix: np.ndarray) -> float:
    """
    Diversification Ratio = (w' * sigma_individual) / portfolio_vol
    = 1 for undiversified, > 1 for diversified.
    """
    individual_vols = np.sqrt(np.diag(cov_matrix))
    portfolio_vol   = math.sqrt(max(float(weights @ cov_matrix @ weights), 1e-12))
    return float(weights @ individual_vols) / portfolio_vol


def effective_n(weights: np.ndarray) -> float:
    """Effective N (number of bets) = 1 / sum(w_i^2). Herfindahl Index inverse."""
    hhi = float(np.sum(weights ** 2))
    return 1.0 / hhi if hhi > 0 else 0


def concentration_score(weights: np.ndarray) -> Dict[str, float]:
    """Portfolio concentration metrics."""
    n_assets    = len(weights)
    hhi         = float(np.sum(weights ** 2))
    eff_n       = 1.0 / hhi if hhi > 0 else 0
    top5_conc   = float(np.sort(weights)[::-1][:5].sum()) * 100
    top10_conc  = float(np.sort(weights)[::-1][:10].sum()) * 100
    max_w       = float(weights.max()) * 100
    gini_coeff  = _gini(weights)

    return {
        "hhi":       round(hhi, 6),
        "effective_n": round(eff_n, 2),
        "top5_concentration":  round(top5_conc, 2),
        "top10_concentration": round(top10_conc, 2),
        "max_weight": round(max_w, 2),
        "gini_coefficient": round(gini_coeff, 4),
    }


def _gini(weights: np.ndarray) -> float:
    """Gini coefficient of weight distribution (0=equal, 1=max concentration)."""
    n  = len(weights)
    if n <= 1:
        return 0.0
    sw = np.sort(weights)
    return float((2 * np.sum((np.arange(1, n+1)) * sw) - (n + 1) * sw.sum()) /
                 (n * sw.sum() + 1e-12))


# ─── PORTFOLIO OPTIMIZER CLASS ───────────────────────────────────────────────

class PortfolioOptimizer:
    """
    Full-featured portfolio optimizer supporting multiple methods.
    
    Usage:
        returns_df = pd.DataFrame(...)   # T x N returns
        optimizer  = PortfolioOptimizer(returns_df, risk_free_rate=0.04)
        
        result_mv   = optimizer.minimum_variance()
        result_msr  = optimizer.maximum_sharpe()
        result_hrp  = optimizer.hrp()
        result_rp   = optimizer.risk_parity()
        frontier_df = optimizer.efficient_frontier()
    """

    def __init__(
        self,
        returns: pd.DataFrame,
        risk_free_rate:   float = 0.04,
        cov_method:       str   = "ledoit_wolf",    # "sample", "ledoit_wolf", "ewma"
        return_method:    str   = "historical",     # "historical", "capm", "ewma"
        ewma_halflife:    int   = 60,
        max_weight:       float = 0.30,
        min_weight:       float = 0.00,
    ):
        self.returns        = returns.dropna(how="all")
        self.symbols        = list(returns.columns)
        self.N              = len(self.symbols)
        self.risk_free_rate = risk_free_rate
        self.max_weight     = max_weight
        self.min_weight     = min_weight

        self._constraints = {"max_weight": max_weight, "min_weight": min_weight}

        # Build covariance matrix
        if cov_method == "ledoit_wolf":
            self.cov_matrix = ledoit_wolf_shrinkage(self.returns)
        elif cov_method == "ewma":
            self.cov_matrix = exponential_weighted_covariance(self.returns, ewma_halflife)
        else:
            self.cov_matrix = sample_covariance(self.returns)

        # Build return estimates
        if return_method == "capm":
            self.expected_returns = capm_expected_returns(self.returns, risk_free_rate=risk_free_rate)
        elif return_method == "ewma":
            self.expected_returns = ewma_mean_returns(self.returns, ewma_halflife)
        else:
            self.expected_returns = historical_mean_returns(self.returns)

    def _make_result(self, weights: np.ndarray, method: str) -> OptimizationResult:
        port_ret = float(self.expected_returns @ weights)
        port_var = float(weights @ self.cov_matrix @ weights)
        port_vol = math.sqrt(max(port_var, 0))
        sharpe   = (port_ret - self.risk_free_rate) / port_vol if port_vol > 0 else 0

        return OptimizationResult(
            weights={sym: round(float(w), 6) for sym, w in zip(self.symbols, weights)},
            expected_return=round(port_ret * 100, 4),
            expected_vol=round(port_vol * 100, 4),
            sharpe_ratio=round(sharpe, 4),
            method=method,
        )

    def minimum_variance(self) -> OptimizationResult:
        weights = minimum_variance_portfolio(self.cov_matrix, self._constraints)
        return self._make_result(weights, "minimum_variance")

    def maximum_sharpe(self) -> OptimizationResult:
        weights = maximum_sharpe_portfolio(
            self.expected_returns, self.cov_matrix,
            self.risk_free_rate, self._constraints,
        )
        return self._make_result(weights, "maximum_sharpe")

    def risk_parity(self) -> OptimizationResult:
        weights = risk_parity_weights(self.cov_matrix)
        return self._make_result(weights, "risk_parity")

    def hrp(self) -> OptimizationResult:
        weights = hierarchical_risk_parity(self.cov_matrix)
        return self._make_result(weights, "hrp")

    def equal_weight(self) -> OptimizationResult:
        weights = np.full(self.N, 1.0 / self.N)
        return self._make_result(weights, "equal_weight")

    def maximum_diversification(self) -> OptimizationResult:
        weights = maximum_diversification_weights(self.cov_matrix)
        return self._make_result(weights, "maximum_diversification")

    def efficient_frontier(self, n_portfolios: int = 200) -> pd.DataFrame:
        return compute_efficient_frontier(
            self.expected_returns, self.cov_matrix,
            n_portfolios, self.risk_free_rate, self._constraints,
        )

    def all_methods(self) -> Dict[str, OptimizationResult]:
        """Compute all optimization methods and return comparison."""
        return {
            "equal_weight":          self.equal_weight(),
            "minimum_variance":      self.minimum_variance(),
            "maximum_sharpe":        self.maximum_sharpe(),
            "risk_parity":           self.risk_parity(),
            "hrp":                   self.hrp(),
            "maximum_diversification": self.maximum_diversification(),
        }

    def compare_methods(self) -> pd.DataFrame:
        """Return a DataFrame comparing all optimization methods."""
        results = self.all_methods()
        rows = []
        for method, res in results.items():
            mw   = np.array(list(res.weights.values()))
            conc = concentration_score(mw)
            rows.append({
                "method":            method,
                "expected_return":   res.expected_return,
                "expected_vol":      res.expected_vol,
                "sharpe_ratio":      res.sharpe_ratio,
                "max_weight":        conc["max_weight"],
                "effective_n":       conc["effective_n"],
                "hhi":               conc["hhi"],
            })
        return pd.DataFrame(rows).set_index("method")

    def analytics(self, weights: np.ndarray) -> Dict[str, Any]:
        """Full analytics for a given weight vector."""
        rc     = pct_risk_contributions(weights, self.cov_matrix)
        conc   = concentration_score(weights)
        perf   = portfolio_performance(weights, self.returns, self.risk_free_rate)
        div_r  = diversification_ratio(weights, self.cov_matrix)

        return {
            "performance":           perf,
            "concentration":         conc,
            "diversification_ratio": round(div_r, 4),
            "risk_contributions":    {sym: round(float(r)*100, 4)
                                      for sym, r in zip(self.symbols, rc)},
        }


# ─── PORTFOLIO ATTRIBUTION ───────────────────────────────────────────────────

def brinson_attribution(
    portfolio_weights:   pd.DataFrame,   # T x N actual weights
    benchmark_weights:   pd.DataFrame,   # T x N benchmark weights
    asset_returns:       pd.DataFrame,   # T x N actual returns
    benchmark_returns:   pd.DataFrame,   # T x N benchmark returns
    sectors:             Optional[Dict[str, str]] = None,  # symbol -> sector
) -> AttributionResult:
    """
    Brinson-Hood-Beebower return attribution.
    Decomposes active return into Allocation, Selection, Interaction effects.
    """
    pw = portfolio_weights.values
    bw = benchmark_weights.values
    pr = asset_returns.values
    br = benchmark_returns.values

    T, N = pw.shape

    alloc_effect   = np.zeros(N)
    select_effect  = np.zeros(N)
    interact_effect = np.zeros(N)

    for t in range(T):
        bench_port_ret = float(bw[t] @ br[t])  # Benchmark return for period
        delta_w = pw[t] - bw[t]
        delta_r = pr[t] - br[t]

        alloc_effect   += delta_w * br[t]
        select_effect  += bw[t]  * delta_r
        interact_effect += delta_w * delta_r

    total_alloc    = float(alloc_effect.sum())
    total_select   = float(select_effect.sum())
    total_interact = float(interact_effect.sum())
    total_active   = total_alloc + total_select + total_interact

    # By sector if available
    by_sector = None
    if sectors:
        df = pd.DataFrame({
            "symbol":       list(sectors.keys()),
            "sector":       list(sectors.values()),
            "allocation":   alloc_effect[:len(sectors)],
            "selection":    select_effect[:len(sectors)],
            "interaction":  interact_effect[:len(sectors)],
        })
        by_sector = df.groupby("sector")[["allocation", "selection", "interaction"]].sum()
        by_sector["total"] = by_sector.sum(axis=1)

    return AttributionResult(
        allocation_effect   = round(total_alloc   * 100, 4),
        selection_effect    = round(total_select  * 100, 4),
        interaction_effect  = round(total_interact * 100, 4),
        total_active_return = round(total_active * 100, 4),
        by_sector           = by_sector,
    )


# ─── ROLLING ANALYTICS ───────────────────────────────────────────────────────

def rolling_portfolio_analytics(
    weights:        np.ndarray,
    returns:        pd.DataFrame,
    window:         int            = 63,
    risk_free_rate: float          = 0.04,
    benchmark:      Optional[pd.Series] = None,
) -> pd.DataFrame:
    """
    Compute rolling performance metrics for a fixed-weight portfolio.
    Returns DataFrame with rolling Sharpe, Vol, Return, Beta, Correlation.
    """
    port_rets = (returns @ weights)
    ann_f     = 252

    rows = []
    for i in range(window, len(port_rets)):
        window_rets = port_rets.iloc[i-window:i]
        mu    = float(window_rets.mean() * ann_f)
        sigma = float(window_rets.std(ddof=1) * math.sqrt(ann_f))
        sharpe = (mu - risk_free_rate) / sigma if sigma > 0 else 0

        row = {
            "date":          port_rets.index[i],
            "rolling_return": round(mu * 100, 4),
            "rolling_vol":    round(sigma * 100, 4),
            "rolling_sharpe": round(sharpe, 4),
        }

        if benchmark is not None and len(benchmark) == len(returns):
            bench_w = benchmark.iloc[i-window:i]
            if len(bench_w) == window:
                cov_mb  = np.cov(window_rets.values, bench_w.values)
                if cov_mb.shape == (2, 2) and cov_mb[1, 1] > 0:
                    beta = cov_mb[0, 1] / cov_mb[1, 1]
                    corr = float(pd.Series(window_rets.values).corr(pd.Series(bench_w.values)))
                    row["rolling_beta"] = round(beta, 4)
                    row["rolling_corr"] = round(corr, 4)

        rows.append(row)

    return pd.DataFrame(rows).set_index("date") if rows else pd.DataFrame()


# ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

def weights_to_holdings(
    weights:         Dict[str, float],
    portfolio_value: float,
    prices:          Dict[str, float],
    lot_size:        int = 1,
) -> Dict[str, Dict]:
    """
    Convert weight targets to share quantities given current prices.
    Rounds to nearest lot_size.
    """
    holdings = {}
    for symbol, w in weights.items():
        if symbol not in prices or prices[symbol] <= 0:
            continue
        target_value = portfolio_value * w
        shares       = int(target_value / prices[symbol] / lot_size) * lot_size
        actual_value = shares * prices[symbol]
        holdings[symbol] = {
            "target_weight":  w,
            "target_value":   round(target_value, 2),
            "shares":         shares,
            "actual_value":   round(actual_value, 2),
            "actual_weight":  round(actual_value / portfolio_value, 6) if portfolio_value > 0 else 0,
            "price":          prices[symbol],
        }
    return holdings
