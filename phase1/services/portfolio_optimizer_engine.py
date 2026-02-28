"""
portfolio_optimizer_engine.py
Mean-variance optimization, Black-Litterman model,
risk parity, and efficient frontier via scipy.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple

try:
    import numpy as np
    from scipy.optimize import minimize, differential_evolution
    from scipy.linalg import cholesky
    _SCIPY = True
except ImportError:
    _SCIPY = False

# ─── Enums ────────────────────────────────────────────────────────────────────

class OptimizationMethod(Enum):
    MEAN_VARIANCE   = "MEAN_VARIANCE"
    MAX_SHARPE      = "MAX_SHARPE"
    MIN_VOLATILITY  = "MIN_VOLATILITY"
    RISK_PARITY     = "RISK_PARITY"
    MAX_DIVERSIF    = "MAX_DIVERSIFICATION"
    EQUAL_WEIGHT    = "EQUAL_WEIGHT"
    BLACK_LITTERMAN = "BLACK_LITTERMAN"

class ConstraintType(Enum):
    LONG_ONLY       = "LONG_ONLY"
    LONG_SHORT      = "LONG_SHORT"
    MARKET_NEUTRAL  = "MARKET_NEUTRAL"

# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class AssetData:
    ticker:          str
    expected_return: float    # annualized
    volatility:      float    # annualized
    market_cap:      float    # USD billions
    beta:            float = 1.0
    sector:          str = ""
    country:         str = "US"

@dataclass
class OptimizationConstraints:
    method:           OptimizationMethod      = OptimizationMethod.MAX_SHARPE
    constraint_type:  ConstraintType          = ConstraintType.LONG_ONLY
    min_weight:       float                   = 0.0
    max_weight:       float                   = 0.40
    target_return:    Optional[float]         = None
    target_risk:      Optional[float]         = None
    sector_limits:    Dict[str, float]        = field(default_factory=dict)
    rf_rate:          float                   = 0.053
    risk_aversion:    float                   = 3.0

@dataclass
class OptimizedPortfolio:
    method:             OptimizationMethod
    weights:            Dict[str, float]
    expected_return:    float
    volatility:         float
    sharpe_ratio:       float
    max_drawdown_est:   float
    var_95:             float
    var_99:             float
    diversification:    float
    concentration_hhi:  float
    effective_n:        float
    converged:          bool
    iterations:         int
    objective_value:    float

@dataclass
class EfficientFrontierPoint:
    target_return:   float
    min_volatility:  float
    sharpe:          float
    weights:         Dict[str, float]
    is_max_sharpe:   bool = False
    is_min_vol:      bool = False

@dataclass
class BlLittermanOutput:
    equilibrium_returns: Dict[str, float]
    bl_returns:          Dict[str, float]
    bl_covariance:       Dict[str, Dict[str, float]]
    portfolio:           OptimizedPortfolio
    view_consistency:    float

@dataclass
class PortfolioAnalytics:
    portfolio:           OptimizedPortfolio
    marginal_contrib:    Dict[str, float]
    risk_contrib_pct:    Dict[str, float]
    component_var:       Dict[str, float]
    tail_risk:           float
    turnover_est:        float
    tracking_error:      Optional[float]

# ─── Sample Data ─────────────────────────────────────────────────────────────

DEFAULT_ASSETS = [
    AssetData("NVDA",   0.28, 0.55, 3200, 1.85, "Technology"),
    AssetData("AAPL",   0.15, 0.28, 3100, 1.20, "Technology"),
    AssetData("MSFT",   0.17, 0.25, 3000, 1.15, "Technology"),
    AssetData("AMZN",   0.20, 0.35, 1900, 1.35, "Consumer"),
    AssetData("META",   0.22, 0.38, 1300, 1.40, "Technology"),
    AssetData("GOOGL",  0.18, 0.28, 2100, 1.18, "Technology"),
    AssetData("JPM",    0.12, 0.22, 650,  1.05, "Financials"),
    AssetData("JNJ",    0.08, 0.15, 380,  0.55, "Health Care"),
    AssetData("XOM",    0.10, 0.28, 500,  0.85, "Energy"),
    AssetData("BRK_B",  0.11, 0.18, 900,  0.72, "Financials"),
    AssetData("UNH",    0.14, 0.20, 450,  0.78, "Health Care"),
    AssetData("LLY",    0.25, 0.30, 850,  0.82, "Health Care"),
]

# ─── Engine ───────────────────────────────────────────────────────────────────

class CovarianceEstimator:
    """Estimates covariance matrix from asset data."""

    def estimate(self, assets: List[AssetData]) -> "np.ndarray | List":
        n = len(assets)
        if not _SCIPY:
            return self._fallback_cov(assets)
        vols = np.array([a.volatility for a in assets])
        corr = self._build_correlation(assets)
        cov = np.outer(vols, vols) * corr
        return cov

    def _build_correlation(self, assets: List[AssetData]) -> "np.ndarray":
        n = len(assets)
        corr = np.eye(n)
        sector_corr = 0.55
        cross_corr = 0.30
        for i in range(n):
            for j in range(i+1, n):
                rho = sector_corr if assets[i].sector == assets[j].sector else cross_corr
                noise = random.uniform(-0.08, 0.08)
                corr[i, j] = corr[j, i] = min(0.95, max(0.05, rho + noise))
        return corr

    def _fallback_cov(self, assets: List[AssetData]) -> List[List[float]]:
        n = len(assets)
        cov = [[0.0]*n for _ in range(n)]
        for i, a in enumerate(assets):
            for j, b in enumerate(assets):
                if i == j:
                    cov[i][j] = a.volatility ** 2
                else:
                    rho = 0.5 if a.sector == b.sector else 0.25
                    cov[i][j] = rho * a.volatility * b.volatility
        return cov


class MeanVarianceOptimizer:
    """Classic Markowitz mean-variance optimizer."""

    def __init__(self):
        self._cov_est = CovarianceEstimator()
        self._rng = random.Random(42)

    def optimize(self, assets: List[AssetData], constraints: OptimizationConstraints) -> OptimizedPortfolio:
        n = len(assets)
        if not _SCIPY:
            return self._fallback_optimize(assets, constraints)

        mu = np.array([a.expected_return for a in assets])
        cov = self._cov_est.estimate(assets)
        rf = constraints.rf_rate

        bounds = [(constraints.min_weight, constraints.max_weight) for _ in range(n)]
        cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
        if constraints.constraint_type == ConstraintType.MARKET_NEUTRAL:
            betas = np.array([a.beta for a in assets])
            cons.append({"type": "eq", "fun": lambda w: np.dot(w, betas)})

        w0 = np.ones(n) / n
        obj_fn = self._get_objective(constraints.method, mu, cov, rf, constraints.risk_aversion)
        result = minimize(obj_fn, w0, method='SLSQP', bounds=bounds, constraints=cons,
                          options={'ftol': 1e-10, 'maxiter': 2000, 'disp': False})

        w = result.x
        w = np.clip(w, 0, 1); w /= w.sum()
        port_ret = float(np.dot(w, mu))
        port_vol = float(np.sqrt(w @ cov @ w))
        sharpe = (port_ret - rf) / max(1e-9, port_vol)
        hhi = float(np.sum(w**2))
        eff_n = 1 / hhi if hhi > 0 else n
        diversif = float(np.dot(w, np.sqrt(np.diag(cov)))) / max(1e-9, port_vol)
        var95 = -port_ret / 252 + 1.645 * port_vol / math.sqrt(252)
        var99 = -port_ret / 252 + 2.326 * port_vol / math.sqrt(252)
        mdd_est = port_vol * 2.0 / math.sqrt(252) * 60

        return OptimizedPortfolio(
            method=constraints.method,
            weights={a.ticker: round(float(wt), 6) for a, wt in zip(assets, w)},
            expected_return=round(port_ret, 6), volatility=round(port_vol, 6),
            sharpe_ratio=round(sharpe, 4), max_drawdown_est=round(mdd_est, 4),
            var_95=round(var95, 6), var_99=round(var99, 6),
            diversification=round(diversif, 4), concentration_hhi=round(hhi, 6),
            effective_n=round(eff_n, 2), converged=result.success,
            iterations=result.nit, objective_value=float(result.fun),
        )

    def _get_objective(self, method, mu, cov, rf, risk_aversion):
        if method == OptimizationMethod.MAX_SHARPE:
            def obj(w):
                r = np.dot(w, mu)
                v = np.sqrt(max(1e-12, w @ cov @ w))
                return -(r - rf) / v
        elif method == OptimizationMethod.MIN_VOLATILITY:
            def obj(w): return np.sqrt(max(1e-12, w @ cov @ w))
        elif method == OptimizationMethod.MEAN_VARIANCE:
            def obj(w):
                r = np.dot(w, mu)
                v = w @ cov @ w
                return -r + risk_aversion * v / 2
        else:
            def obj(w): return -(np.dot(w, mu) - rf) / max(1e-9, np.sqrt(w @ cov @ w))
        return obj

    def _fallback_optimize(self, assets: List[AssetData], constraints: OptimizationConstraints) -> OptimizedPortfolio:
        n = len(assets)
        weights = {a.ticker: 1.0 / n for a in assets}
        avg_ret = sum(a.expected_return for a in assets) / n
        avg_vol = sum(a.volatility for a in assets) / n * 0.7
        sharpe = (avg_ret - constraints.rf_rate) / max(1e-9, avg_vol)
        return OptimizedPortfolio(
            method=constraints.method, weights=weights,
            expected_return=round(avg_ret, 4), volatility=round(avg_vol, 4),
            sharpe_ratio=round(sharpe, 4), max_drawdown_est=round(avg_vol * 3, 4),
            var_95=0.02, var_99=0.03, diversification=1.5,
            concentration_hhi=round(1/n, 4), effective_n=float(n),
            converged=True, iterations=0, objective_value=0.0,
        )


class EfficientFrontierBuilder:
    """Builds the mean-variance efficient frontier."""

    def __init__(self):
        self._optimizer = MeanVarianceOptimizer()

    def build_frontier(self, assets: List[AssetData], n_points: int = 20, rf: float = 0.053) -> List[EfficientFrontierPoint]:
        if not _SCIPY:
            return self._mock_frontier(assets, n_points, rf)
        mu = [a.expected_return for a in assets]
        min_ret = min(mu) * 0.5
        max_ret = max(mu) * 1.1
        target_returns = [min_ret + (max_ret - min_ret) * i / (n_points - 1) for i in range(n_points)]
        points = []
        max_sharpe_idx = 0
        best_sharpe = -999.0
        for i, tgt in enumerate(target_returns):
            cons = OptimizationConstraints(method=OptimizationMethod.MIN_VOLATILITY, rf_rate=rf, target_return=tgt)
            port = self._optimizer.optimize(assets, cons)
            sharpe = (port.expected_return - rf) / max(1e-9, port.volatility)
            if sharpe > best_sharpe:
                best_sharpe = sharpe; max_sharpe_idx = i
            points.append(EfficientFrontierPoint(
                target_return=round(tgt, 6), min_volatility=port.volatility,
                sharpe=round(sharpe, 4), weights=port.weights,
            ))
        if points:
            points[max_sharpe_idx].is_max_sharpe = True
            min_vol_idx = min(range(len(points)), key=lambda i: points[i].min_volatility)
            points[min_vol_idx].is_min_vol = True
        return points

    def _mock_frontier(self, assets: List[AssetData], n: int, rf: float) -> List[EfficientFrontierPoint]:
        pts = []
        n_assets = len(assets)
        for i in range(n):
            t = i / (n - 1)
            expected_ret = 0.05 + t * 0.20
            vol = 0.10 + t * 0.25 - (t * (1-t)) * 0.10
            sharpe = (expected_ret - rf) / max(1e-9, vol)
            w = {a.ticker: 1/n_assets for a in assets}
            pts.append(EfficientFrontierPoint(target_return=expected_ret, min_volatility=vol, sharpe=sharpe, weights=w))
        return pts


class RiskParityOptimizer:
    """Equalizes risk contribution from each asset."""

    def __init__(self):
        self._cov_est = CovarianceEstimator()

    def optimize(self, assets: List[AssetData], rf: float = 0.053) -> OptimizedPortfolio:
        n = len(assets)
        if not _SCIPY:
            return self._fallback(assets, rf)
        cov = self._cov_est.estimate(assets)
        w0 = np.ones(n) / n
        cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
        bounds = [(0.01, 0.5)] * n

        def risk_parity_obj(w):
            port_vol = np.sqrt(w @ cov @ w)
            mrc = cov @ w / max(1e-12, port_vol)
            rc = w * mrc
            target = port_vol / n
            return float(np.sum((rc - target) ** 2))

        result = minimize(risk_parity_obj, w0, method='SLSQP', bounds=bounds, constraints=cons,
                          options={'ftol': 1e-12, 'maxiter': 3000})
        w = result.x; w = np.clip(w, 0, 1); w /= w.sum()
        mu = np.array([a.expected_return for a in assets])
        port_ret = float(np.dot(w, mu))
        port_vol = float(np.sqrt(w @ cov @ w))
        sharpe = (port_ret - rf) / max(1e-9, port_vol)
        hhi = float(np.sum(w**2))
        return OptimizedPortfolio(
            method=OptimizationMethod.RISK_PARITY,
            weights={a.ticker: round(float(wt), 6) for a, wt in zip(assets, w)},
            expected_return=round(port_ret, 6), volatility=round(port_vol, 6),
            sharpe_ratio=round(sharpe, 4), max_drawdown_est=round(port_vol * 3, 4),
            var_95=round(port_vol / math.sqrt(252) * 1.645, 6),
            var_99=round(port_vol / math.sqrt(252) * 2.326, 6),
            diversification=round(n / (hhi * n), 4), concentration_hhi=round(hhi, 6),
            effective_n=round(1 / hhi, 2), converged=result.success,
            iterations=result.nit, objective_value=float(result.fun),
        )

    def _fallback(self, assets: List[AssetData], rf: float) -> OptimizedPortfolio:
        inv_vols = [1.0 / a.volatility for a in assets]
        total = sum(inv_vols)
        weights = {a.ticker: round(iv / total, 6) for a, iv in zip(assets, inv_vols)}
        avg_ret = sum(a.expected_return * weights[a.ticker] for a in assets)
        avg_vol = sum(a.volatility * weights[a.ticker] for a in assets) * 0.7
        return OptimizedPortfolio(
            method=OptimizationMethod.RISK_PARITY, weights=weights,
            expected_return=round(avg_ret, 4), volatility=round(avg_vol, 4),
            sharpe_ratio=round((avg_ret - rf) / max(1e-9, avg_vol), 4),
            max_drawdown_est=round(avg_vol * 3, 4), var_95=0.012, var_99=0.018,
            diversification=2.0, concentration_hhi=round(1/len(assets), 4),
            effective_n=float(len(assets)), converged=True, iterations=0, objective_value=0.0,
        )


class BlackLittermanModel:
    """Black-Litterman return model with investor views."""

    def __init__(self):
        self._cov_est = CovarianceEstimator()
        self._mv_optimizer = MeanVarianceOptimizer()

    def compute(self, assets: List[AssetData], views: Optional[Dict[str, float]] = None,
                view_confidence: float = 0.5, risk_aversion: float = 3.0, rf: float = 0.053) -> BlLittermanOutput:
        if not _SCIPY:
            return self._fallback(assets, views, rf)
        n = len(assets)
        cov = self._cov_est.estimate(assets)
        market_caps = np.array([a.market_cap for a in assets])
        w_mkt = market_caps / market_caps.sum()
        tau = 0.05
        pi = risk_aversion * cov @ w_mkt
        if views:
            view_tickers = list(views.keys())
            view_returns = np.array([views[t] - pi[list(t for t in (a.ticker for a in assets)).index(t)] for t in view_tickers if t in {a.ticker for a in assets}])
            k = len(view_returns)
            if k > 0:
                P = np.zeros((k, n))
                for idx, vt in enumerate(view_tickers):
                    for ai, a in enumerate(assets):
                        if a.ticker == vt:
                            P[idx, ai] = 1.0
                omega = np.diag([view_confidence] * k)
                tau_sigma = tau * cov
                M1 = np.linalg.inv(tau_sigma)
                M2 = P.T @ np.linalg.inv(omega) @ P
                bl_cov_inv = M1 + M2
                mu_bl_part = M1 @ pi + P.T @ np.linalg.inv(omega) @ (view_returns + P @ pi)
                bl_mu = np.linalg.solve(bl_cov_inv, mu_bl_part)
                bl_cov = np.linalg.inv(bl_cov_inv) + cov
            else:
                bl_mu = pi.copy(); bl_cov = cov.copy()
        else:
            bl_mu = pi.copy(); bl_cov = cov.copy()

        bl_ret_dict = {a.ticker: round(float(mu), 6) for a, mu in zip(assets, bl_mu)}
        eq_ret_dict = {a.ticker: round(float(p), 6) for a, p in zip(assets, pi)}
        bl_cov_dict = {a1.ticker: {a2.ticker: round(float(bl_cov[i, j]), 8) for j, a2 in enumerate(assets)} for i, a1 in enumerate(assets)}

        bl_assets = [AssetData(a.ticker, float(bl_mu[i]), math.sqrt(float(bl_cov[i, i])), a.market_cap, a.beta, a.sector)
                     for i, a in enumerate(assets)]
        cons = OptimizationConstraints(method=OptimizationMethod.MAX_SHARPE, rf_rate=rf, risk_aversion=risk_aversion)
        portfolio = self._mv_optimizer.optimize(bl_assets, cons)
        return BlLittermanOutput(
            equilibrium_returns=eq_ret_dict, bl_returns=bl_ret_dict,
            bl_covariance=bl_cov_dict, portfolio=portfolio,
            view_consistency=round(view_confidence, 4),
        )

    def _fallback(self, assets: List[AssetData], views, rf: float) -> BlLittermanOutput:
        eq_ret = {a.ticker: round(a.expected_return * 0.7, 4) for a in assets}
        bl_ret = {a.ticker: round(a.expected_return, 4) for a in assets}
        bl_cov = {a1.ticker: {a2.ticker: (a1.volatility * a2.volatility * 0.3 if a1.ticker != a2.ticker else a1.volatility**2) for a2 in assets} for a1 in assets}
        n = len(assets)
        weights = {a.ticker: 1/n for a in assets}
        avg = sum(a.expected_return for a in assets) / n
        vol = sum(a.volatility for a in assets) / n * 0.8
        port = OptimizedPortfolio(method=OptimizationMethod.BLACK_LITTERMAN, weights=weights,
                                   expected_return=avg, volatility=vol, sharpe_ratio=(avg-rf)/vol,
                                   max_drawdown_est=vol*3, var_95=0.02, var_99=0.03,
                                   diversification=2.0, concentration_hhi=1/n, effective_n=float(n),
                                   converged=True, iterations=0, objective_value=0.0)
        return BlLittermanOutput(equilibrium_returns=eq_ret, bl_returns=bl_ret, bl_covariance=bl_cov,
                                  portfolio=port, view_consistency=0.5)


class PortfolioOptimizerEngine:
    """Main engine combining all optimization approaches."""

    def __init__(self):
        self._mv = MeanVarianceOptimizer()
        self._rp = RiskParityOptimizer()
        self._bl = BlackLittermanModel()
        self._frontier = EfficientFrontierBuilder()
        self._cov_est = CovarianceEstimator()

    def optimize(self, assets: Optional[List[AssetData]] = None,
                 constraints: Optional[OptimizationConstraints] = None) -> OptimizedPortfolio:
        if assets is None: assets = DEFAULT_ASSETS
        if constraints is None: constraints = OptimizationConstraints()
        if constraints.method == OptimizationMethod.RISK_PARITY:
            return self._rp.optimize(assets, constraints.rf_rate)
        if constraints.method == OptimizationMethod.EQUAL_WEIGHT:
            n = len(assets); w = {a.ticker: round(1/n, 6) for a in assets}
            avg_r = sum(a.expected_return / n for a in assets)
            avg_v = sum(a.volatility / n for a in assets) * 0.75
            return OptimizedPortfolio(method=OptimizationMethod.EQUAL_WEIGHT, weights=w,
                                       expected_return=round(avg_r, 4), volatility=round(avg_v, 4),
                                       sharpe_ratio=round((avg_r-constraints.rf_rate)/max(1e-9, avg_v), 4),
                                       max_drawdown_est=round(avg_v*3, 4), var_95=0.016, var_99=0.024,
                                       diversification=2.5, concentration_hhi=round(1/n, 6),
                                       effective_n=float(n), converged=True, iterations=0, objective_value=0.0)
        return self._mv.optimize(assets, constraints)

    def get_efficient_frontier(self, assets: Optional[List[AssetData]] = None, n_points: int = 25,
                                rf: float = 0.053) -> List[EfficientFrontierPoint]:
        if assets is None: assets = DEFAULT_ASSETS
        return self._frontier.build_frontier(assets, n_points, rf)

    def run_black_litterman(self, assets: Optional[List[AssetData]] = None,
                             views: Optional[Dict[str, float]] = None, rf: float = 0.053) -> BlLittermanOutput:
        if assets is None: assets = DEFAULT_ASSETS
        return self._bl.compute(assets, views, rf=rf)

    def compare_methods(self, assets: Optional[List[AssetData]] = None, rf: float = 0.053) -> Dict[str, OptimizedPortfolio]:
        if assets is None: assets = DEFAULT_ASSETS
        results = {}
        for method in [OptimizationMethod.MAX_SHARPE, OptimizationMethod.MIN_VOLATILITY,
                        OptimizationMethod.RISK_PARITY, OptimizationMethod.EQUAL_WEIGHT]:
            cons = OptimizationConstraints(method=method, rf_rate=rf)
            results[method.value] = self.optimize(assets, cons)
        return results

    def get_analytics(self, portfolio: OptimizedPortfolio,
                       assets: Optional[List[AssetData]] = None) -> PortfolioAnalytics:
        if assets is None: assets = DEFAULT_ASSETS
        if not _SCIPY:
            mrc_dict = {t: round(w * 0.01, 4) for t, w in portfolio.weights.items()}
            rc_pct = {t: round(100 / len(portfolio.weights), 2) for t in portfolio.weights}
            comp_var = {t: round(w * portfolio.var_95, 6) for t, w in portfolio.weights.items()}
            return PortfolioAnalytics(portfolio=portfolio, marginal_contrib=mrc_dict,
                                       risk_contrib_pct=rc_pct, component_var=comp_var,
                                       tail_risk=portfolio.var_99 * 1.2, turnover_est=0.15, tracking_error=None)
        asset_map = {a.ticker: a for a in assets}
        ordered_assets = [asset_map[t] for t in portfolio.weights if t in asset_map]
        w = np.array([portfolio.weights.get(a.ticker, 0) for a in ordered_assets])
        cov = self._cov_est.estimate(ordered_assets)
        port_vol = float(np.sqrt(w @ cov @ w))
        mrc = cov @ w / max(1e-12, port_vol)
        rc = w * mrc
        rc_pct_arr = rc / max(1e-12, rc.sum()) * 100
        mrc_dict = {a.ticker: round(float(m), 6) for a, m in zip(ordered_assets, mrc)}
        rc_pct_dict = {a.ticker: round(float(r), 3) for a, r in zip(ordered_assets, rc_pct_arr)}
        comp_var = {a.ticker: round(float(m * portfolio.var_95), 6) for a, m in zip(ordered_assets, mrc)}
        tail_risk = portfolio.var_99 * 1.15
        eq_weights = {a.ticker: 1/len(ordered_assets) for a in ordered_assets}
        turnover = sum(abs(portfolio.weights.get(t, 0) - eq_weights.get(t, 0)) for t in portfolio.weights) / 2
        return PortfolioAnalytics(portfolio=portfolio, marginal_contrib=mrc_dict,
                                   risk_contrib_pct=rc_pct_dict, component_var=comp_var,
                                   tail_risk=round(tail_risk, 6), turnover_est=round(turnover, 4), tracking_error=None)


# ─── Module-level helpers ─────────────────────────────────────────────────────

_engine = PortfolioOptimizerEngine()


def optimize_portfolio(assets: Optional[List[AssetData]] = None,
                        method: str = "MAX_SHARPE", rf: float = 0.053) -> OptimizedPortfolio:
    m = OptimizationMethod[method]
    cons = OptimizationConstraints(method=m, rf_rate=rf)
    return _engine.optimize(assets, cons)


def get_efficient_frontier(assets: Optional[List[AssetData]] = None, n_points: int = 25,
                            rf: float = 0.053) -> List[EfficientFrontierPoint]:
    return _engine.get_efficient_frontier(assets, n_points, rf)


def run_bl(assets: Optional[List[AssetData]] = None,
            views: Optional[Dict[str, float]] = None, rf: float = 0.053) -> BlLittermanOutput:
    return _engine.run_black_litterman(assets, views, rf)


def compare_all(assets: Optional[List[AssetData]] = None, rf: float = 0.053) -> Dict[str, OptimizedPortfolio]:
    return _engine.compare_methods(assets, rf)
