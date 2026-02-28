"""
Factor Model Engine — Multi-factor equity models including Fama-French 3/5 factor,
momentum, quality, low volatility, value, size factors. Portfolio factor exposure,
factor return attribution, factor timing, and custom factor construction.
Pure computation — no FastAPI dependencies.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class FactorType(str, Enum):
    MARKET = "market"
    SIZE = "size"
    VALUE = "value"
    MOMENTUM = "momentum"
    QUALITY = "quality"
    LOW_VOL = "low_vol"
    PROFITABILITY = "profitability"
    INVESTMENT = "investment"
    LIQUIDITY = "liquidity"
    GROWTH = "growth"


class FactorExposureLevel(str, Enum):
    STRONG_POSITIVE = "strong_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    STRONG_NEGATIVE = "strong_negative"


@dataclass
class StockFactorData:
    """Factor data for a single stock."""
    symbol: str
    market_cap: float         # in millions
    book_value: float         # per share
    price: float
    eps_ttm: float
    revenue_growth: float     # YoY %
    roe: float                # decimal
    debt_to_equity: float
    gross_margin: float       # decimal
    prices_12m: list[float] = field(default_factory=list)

    @property
    def book_to_market(self) -> float:
        """B/M ratio (value factor proxy)."""
        if self.price == 0:
            return 0.0
        return self.book_value / self.price

    @property
    def pe_ratio(self) -> float:
        if self.eps_ttm <= 0:
            return float("inf")
        return self.price / self.eps_ttm

    @property
    def momentum_12m_2m(self) -> float:
        """12-month minus 2-month return (classic momentum)."""
        if len(self.prices_12m) < 10:
            return 0.0
        last_2m_idx = max(0, len(self.prices_12m) - 44)  # ~2 months avg
        return (self.prices_12m[last_2m_idx] / self.prices_12m[0] - 1) * 100

    @property
    def volatility(self) -> float:
        """Realized volatility from price history."""
        if len(self.prices_12m) < 20:
            return 0.0
        rets = [(self.prices_12m[i] / self.prices_12m[i - 1]) - 1 for i in range(1, len(self.prices_12m))]
        return statistics.stdev(rets) * math.sqrt(252) if len(rets) > 1 else 0.0

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "market_cap_m": self.market_cap,
            "book_to_market": round(self.book_to_market, 4),
            "pe_ratio": round(self.pe_ratio, 2),
            "momentum_12m_2m": round(self.momentum_12m_2m, 2),
            "volatility": round(self.volatility, 4),
            "roe": round(self.roe, 4),
            "gross_margin": round(self.gross_margin, 4),
            "revenue_growth": round(self.revenue_growth, 4),
        }


# ── Factor Scoring ────────────────────────────────────────────────────

class FactorScorer:
    """Score individual stocks on each factor using cross-sectional ranking."""

    @staticmethod
    def cross_sectional_rank(values: list[float], ascending: bool = True) -> list[float]:
        """Rank values cross-sectionally, return percentile scores (0-100)."""
        if not values:
            return []
        n = len(values)
        indexed = sorted(enumerate(values), key=lambda x: x[1])
        ranks = [0.0] * n
        for rank, (idx, _) in enumerate(indexed):
            ranks[idx] = (rank / (n - 1) * 100) if n > 1 else 50.0
        if not ascending:
            ranks = [100 - r for r in ranks]
        return [round(r, 2) for r in ranks]

    @staticmethod
    def z_score_normalize(values: list[float]) -> list[float]:
        """Z-score normalize a list of values."""
        if len(values) < 2:
            return [0.0] * len(values)
        mean = statistics.mean(values)
        std = statistics.stdev(values)
        if std == 0:
            return [0.0] * len(values)
        return [round((v - mean) / std, 4) for v in values]

    @staticmethod
    def value_score(stocks: list[StockFactorData]) -> list[float]:
        """Value factor: high B/M ratio, low P/E → high score."""
        bm_scores = FactorScorer.cross_sectional_rank(
            [s.book_to_market for s in stocks], ascending=True
        )
        pe_scores = FactorScorer.cross_sectional_rank(
            [s.pe_ratio if s.pe_ratio != float("inf") else 999 for s in stocks],
            ascending=False,  # Lower P/E = better value = higher score
        )
        return [round((b + p) / 2, 2) for b, p in zip(bm_scores, pe_scores)]

    @staticmethod
    def size_score(stocks: list[StockFactorData]) -> list[float]:
        """Size factor: small cap = high score (SMB)."""
        return FactorScorer.cross_sectional_rank(
            [s.market_cap for s in stocks], ascending=False
        )

    @staticmethod
    def momentum_score(stocks: list[StockFactorData]) -> list[float]:
        """Momentum factor: 12m-2m return."""
        return FactorScorer.cross_sectional_rank(
            [s.momentum_12m_2m for s in stocks], ascending=True
        )

    @staticmethod
    def quality_score(stocks: list[StockFactorData]) -> list[float]:
        """Quality factor: high ROE + high gross margin + low D/E."""
        roe_scores = FactorScorer.cross_sectional_rank([s.roe for s in stocks])
        margin_scores = FactorScorer.cross_sectional_rank([s.gross_margin for s in stocks])
        de_scores = FactorScorer.cross_sectional_rank(
            [s.debt_to_equity for s in stocks], ascending=False
        )
        return [round((r + m + d) / 3, 2) for r, m, d in zip(roe_scores, margin_scores, de_scores)]

    @staticmethod
    def low_vol_score(stocks: list[StockFactorData]) -> list[float]:
        """Low volatility factor: lower vol = higher score."""
        return FactorScorer.cross_sectional_rank(
            [s.volatility for s in stocks], ascending=False
        )

    @staticmethod
    def growth_score(stocks: list[StockFactorData]) -> list[float]:
        """Growth factor: revenue growth."""
        return FactorScorer.cross_sectional_rank(
            [s.revenue_growth for s in stocks], ascending=True
        )


# ── Fama-French Model ─────────────────────────────────────────────────

class FamaFrenchModel:
    """
    Fama-French 3-factor and 5-factor model exposure calculation.
    3F: Market (Rm-Rf), Size (SMB), Value (HML)
    5F: + Quality/Profitability (RMW), Investment (CMA)
    """

    @staticmethod
    def ols_regression(y: list[float], X: list[list[float]]) -> dict:
        """
        Multiple OLS regression via normal equations.
        Returns coefficients, R-squared.
        """
        n = len(y)
        p = len(X[0]) if X else 0
        if n < p + 2:
            return {"coefficients": [0.0] * p, "r_squared": 0.0, "alpha": 0.0}

        # Add intercept column
        X_aug = [[1.0] + list(row) for row in X]
        k = p + 1

        # X'X matrix
        XtX = [[sum(X_aug[i][a] * X_aug[i][b] for i in range(n)) for b in range(k)] for a in range(k)]
        Xty = [sum(X_aug[i][a] * y[i] for i in range(n)) for a in range(k)]

        # Simple Gaussian elimination for small k
        aug = [XtX[i][:] + [Xty[i]] for i in range(k)]
        for col in range(k):
            pivot_row = max(range(col, k), key=lambda r: abs(aug[r][col]))
            aug[col], aug[pivot_row] = aug[pivot_row], aug[col]
            if abs(aug[col][col]) < 1e-12:
                continue
            for row in range(k):
                if row != col:
                    factor = aug[row][col] / aug[col][col]
                    for j in range(k + 1):
                        aug[row][j] -= factor * aug[col][j]

        coeffs = [aug[i][k] / aug[i][i] if abs(aug[i][i]) > 1e-12 else 0.0 for i in range(k)]
        alpha = coeffs[0]
        betas = coeffs[1:]

        y_mean = statistics.mean(y)
        y_pred = [sum(X_aug[i][j] * coeffs[j] for j in range(k)) for i in range(n)]
        ss_res = sum((y[i] - y_pred[i]) ** 2 for i in range(n))
        ss_tot = sum((y[i] - y_mean) ** 2 for i in range(n))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

        return {
            "alpha": round(alpha, 6),
            "coefficients": [round(b, 6) for b in betas],
            "r_squared": round(r2, 4),
        }

    @staticmethod
    def three_factor_exposure(
        stock_returns: list[float],
        mkt_returns: list[float],
        smb_returns: list[float],
        hml_returns: list[float],
    ) -> dict:
        """Estimate Fama-French 3-factor loadings."""
        if len(stock_returns) < 20:
            return {"alpha": 0, "beta_mkt": 1, "beta_smb": 0, "beta_hml": 0, "r_squared": 0}

        X = list(zip(mkt_returns, smb_returns, hml_returns))
        result = FamaFrenchModel.ols_regression(stock_returns, X)
        coeffs = result["coefficients"]
        return {
            "alpha": result["alpha"],
            "beta_mkt": coeffs[0] if len(coeffs) > 0 else 0,
            "beta_smb": coeffs[1] if len(coeffs) > 1 else 0,
            "beta_hml": coeffs[2] if len(coeffs) > 2 else 0,
            "r_squared": result["r_squared"],
        }

    @staticmethod
    def five_factor_exposure(
        stock_returns: list[float],
        mkt_returns: list[float],
        smb_returns: list[float],
        hml_returns: list[float],
        rmw_returns: list[float],
        cma_returns: list[float],
    ) -> dict:
        """Estimate Fama-French 5-factor loadings."""
        if len(stock_returns) < 24:
            return {"alpha": 0, "beta_mkt": 1, "beta_smb": 0, "beta_hml": 0, "beta_rmw": 0, "beta_cma": 0}

        X = list(zip(mkt_returns, smb_returns, hml_returns, rmw_returns, cma_returns))
        result = FamaFrenchModel.ols_regression(stock_returns, X)
        coeffs = result["coefficients"]
        return {
            "alpha": result["alpha"],
            "beta_mkt": coeffs[0] if len(coeffs) > 0 else 0,
            "beta_smb": coeffs[1] if len(coeffs) > 1 else 0,
            "beta_hml": coeffs[2] if len(coeffs) > 2 else 0,
            "beta_rmw": coeffs[3] if len(coeffs) > 3 else 0,
            "beta_cma": coeffs[4] if len(coeffs) > 4 else 0,
            "r_squared": result["r_squared"],
        }


# ── Factor Return Attribution ─────────────────────────────────────────

class FactorReturnAttribution:
    """Decompose portfolio/stock returns into factor contributions."""

    @staticmethod
    def attribute_returns(
        total_return: float,
        factor_exposures: dict[str, float],
        factor_returns: dict[str, float],
    ) -> dict:
        """
        Return = sum(factor_exposure * factor_return) + alpha.
        """
        explained = {}
        total_explained = 0.0

        for factor, exposure in factor_exposures.items():
            factor_ret = factor_returns.get(factor, 0.0)
            contribution = exposure * factor_ret
            explained[factor] = round(contribution, 6)
            total_explained += contribution

        alpha = total_return - total_explained

        return {
            "total_return": round(total_return, 6),
            "factor_contributions": explained,
            "total_factor_return": round(total_explained, 6),
            "alpha": round(alpha, 6),
            "r_squared_proxy": round(1 - abs(alpha) / max(abs(total_return), 0.0001), 4),
        }

    @staticmethod
    def portfolio_factor_attribution(
        holdings: list[dict],  # [{"symbol": ..., "weight": ..., "exposures": {...}}]
        factor_returns: dict[str, float],
    ) -> dict:
        """Portfolio-level factor attribution."""
        if not holdings:
            return {}

        portfolio_exposures: dict[str, float] = {}
        for h in holdings:
            w = h.get("weight", 0)
            for f, e in h.get("exposures", {}).items():
                portfolio_exposures[f] = portfolio_exposures.get(f, 0) + w * e

        factor_contributions = {
            f: round(e * factor_returns.get(f, 0), 6)
            for f, e in portfolio_exposures.items()
        }

        return {
            "portfolio_exposures": {k: round(v, 4) for k, v in portfolio_exposures.items()},
            "factor_contributions": factor_contributions,
            "total_factor_return": round(sum(factor_contributions.values()), 6),
        }


# ── Factor Timing ─────────────────────────────────────────────────────

class FactorTimingModel:
    """
    Model when to tilt toward certain factors based on macro regime.
    Value works in early recovery; momentum in bull markets; quality in downturns.
    """

    FACTOR_REGIMES: dict[str, dict] = {
        "early_recovery": {
            "preferred": ["value", "size", "momentum"],
            "avoid": ["low_vol", "quality"],
            "reason": "Risk-on rotation to cheap cyclicals",
        },
        "expansion": {
            "preferred": ["momentum", "growth", "quality"],
            "avoid": ["value"],
            "reason": "Earnings upgrades, trend continuation",
        },
        "late_cycle": {
            "preferred": ["quality", "low_vol"],
            "avoid": ["size", "momentum"],
            "reason": "Risk-off, flight to safety",
        },
        "recession": {
            "preferred": ["quality", "low_vol", "value"],
            "avoid": ["growth", "momentum"],
            "reason": "Defensive positioning, dividends",
        },
    }

    @staticmethod
    def get_factor_tilt(regime: str) -> dict:
        """Get recommended factor tilts for given macro regime."""
        info = FactorTimingModel.FACTOR_REGIMES.get(regime, FactorTimingModel.FACTOR_REGIMES["expansion"])
        return {
            "regime": regime,
            **info,
        }

    @staticmethod
    def factor_momentum(
        factor_returns_history: dict[str, list[float]],
        lookback: int = 12,
    ) -> dict:
        """
        Factor momentum: which factors have been working lately?
        Invest in factors with positive recent returns.
        """
        result = {}
        for factor, returns in factor_returns_history.items():
            if len(returns) < lookback:
                result[factor] = 0.0
                continue
            recent = returns[-lookback:]
            cumulative = sum(recent)
            result[factor] = round(cumulative, 4)

        ranked = sorted(result.items(), key=lambda x: -x[1])

        return {
            "factor_momentum": result,
            "top_factors": [f for f, _ in ranked[:3]],
            "bottom_factors": [f for f, _ in ranked[-3:]],
        }


# ── Multi-Factor Portfolio Constructor ───────────────────────────────

class MultifactorPortfolioConstructor:
    """Construct portfolios optimized for specific factor exposures."""

    @staticmethod
    def composite_factor_score(
        stocks: list[StockFactorData],
        factor_weights: dict[str, float] = None,
    ) -> list[dict]:
        """
        Build composite factor score from individual factor scores.
        Default: equal weight across factors.
        """
        if factor_weights is None:
            factor_weights = {
                FactorType.VALUE: 0.2,
                FactorType.MOMENTUM: 0.25,
                FactorType.QUALITY: 0.25,
                FactorType.LOW_VOL: 0.15,
                FactorType.SIZE: 0.15,
            }

        value_sc = FactorScorer.value_score(stocks)
        momentum_sc = FactorScorer.momentum_score(stocks)
        quality_sc = FactorScorer.quality_score(stocks)
        low_vol_sc = FactorScorer.low_vol_score(stocks)
        size_sc = FactorScorer.size_score(stocks)
        growth_sc = FactorScorer.growth_score(stocks)

        scorer_map = {
            FactorType.VALUE: value_sc,
            FactorType.MOMENTUM: momentum_sc,
            FactorType.QUALITY: quality_sc,
            FactorType.LOW_VOL: low_vol_sc,
            FactorType.SIZE: size_sc,
            FactorType.GROWTH: growth_sc,
        }

        results = []
        for i, stock in enumerate(stocks):
            composite = 0.0
            factor_detail = {}
            for ftype, weight in factor_weights.items():
                scores_list = scorer_map.get(ftype, [50.0] * len(stocks))
                sc = scores_list[i] if i < len(scores_list) else 50.0
                composite += weight * sc
                factor_detail[ftype.value] = round(sc, 2)

            results.append({
                "symbol": stock.symbol,
                "composite_score": round(composite, 2),
                "factor_scores": factor_detail,
                "exposure_level": (
                    FactorExposureLevel.STRONG_POSITIVE if composite > 75
                    else FactorExposureLevel.POSITIVE if composite > 55
                    else FactorExposureLevel.NEUTRAL if composite > 40
                    else FactorExposureLevel.NEGATIVE if composite > 25
                    else FactorExposureLevel.STRONG_NEGATIVE
                ).value,
            })

        return sorted(results, key=lambda x: -x["composite_score"])

    @staticmethod
    def top_bottom_portfolio(
        ranked_stocks: list[dict],
        top_pct: float = 0.2,
        bottom_pct: float = 0.2,
    ) -> dict:
        """Long top quintile, short bottom quintile."""
        n = len(ranked_stocks)
        top_n = max(1, int(n * top_pct))
        bottom_n = max(1, int(n * bottom_pct))

        long_leg = ranked_stocks[:top_n]
        short_leg = ranked_stocks[-bottom_n:]

        return {
            "long_leg": long_leg,
            "short_leg": short_leg,
            "long_count": len(long_leg),
            "short_count": len(short_leg),
            "avg_long_score": round(statistics.mean(s["composite_score"] for s in long_leg), 2),
            "avg_short_score": round(statistics.mean(s["composite_score"] for s in short_leg), 2),
        }


# ── Smart Beta Calculator ─────────────────────────────────────────────

class SmartBetaCalculator:
    """Calculate smart beta portfolio characteristics."""

    @staticmethod
    def equal_weight_portfolio(symbols: list[str]) -> dict:
        """Equal weight portfolio."""
        if not symbols:
            return {}
        weight = 1.0 / len(symbols)
        return {s: round(weight, 6) for s in symbols}

    @staticmethod
    def factor_weighted_portfolio(
        symbols: list[str],
        scores: list[float],
        min_weight: float = 0.01,
        max_weight: float = 0.10,
    ) -> dict:
        """Weight by factor score, capped at min/max per position."""
        if not symbols or not scores or len(symbols) != len(scores):
            return {}

        # Normalize scores to sum to 1
        total = sum(max(s, 0) for s in scores)
        if total == 0:
            return FactorScorer.cross_sectional_rank.__class__

        raw_weights = {s: max(sc, 0) / total for s, sc in zip(symbols, scores)}
        # Apply caps
        capped = {s: max(min_weight, min(max_weight, w)) for s, w in raw_weights.items()}
        total_capped = sum(capped.values())
        normalized = {s: round(w / total_capped, 6) for s, w in capped.items()}
        return normalized

    @staticmethod
    def tracking_error(
        portfolio_returns: list[float],
        benchmark_returns: list[float],
    ) -> float:
        """Annualized tracking error."""
        if len(portfolio_returns) != len(benchmark_returns) or len(portfolio_returns) < 2:
            return 0.0
        diffs = [p - b for p, b in zip(portfolio_returns, benchmark_returns)]
        return round(statistics.stdev(diffs) * math.sqrt(252), 4)

    @staticmethod
    def information_ratio(
        portfolio_returns: list[float],
        benchmark_returns: list[float],
    ) -> float:
        """Information ratio = active return / tracking error."""
        if len(portfolio_returns) != len(benchmark_returns) or not portfolio_returns:
            return 0.0
        active = [p - b for p, b in zip(portfolio_returns, benchmark_returns)]
        avg_active = statistics.mean(active)
        te = SmartBetaCalculator.tracking_error(portfolio_returns, benchmark_returns)
        if te == 0:
            return 0.0
        return round(avg_active * 252 / te, 4)


# ── Orchestrator ──────────────────────────────────────────────────────

class FactorModelEngine:
    """Top-level orchestrator for all factor model analytics."""

    def __init__(self):
        self.scorer = FactorScorer()
        self.ff = FamaFrenchModel()
        self.attribution = FactorReturnAttribution()
        self.timing = FactorTimingModel()
        self.constructor = MultifactorPortfolioConstructor()
        self.smart_beta = SmartBetaCalculator()

    def score_stocks(
        self,
        stocks: list[StockFactorData],
        factor_weights: dict = None,
    ) -> list[dict]:
        """Score and rank stocks by composite factor score."""
        return self.constructor.composite_factor_score(stocks, factor_weights)

    def three_factor_alpha(
        self,
        stock_rets: list[float],
        mkt_rets: list[float],
        smb_rets: list[float],
        hml_rets: list[float],
    ) -> dict:
        return self.ff.three_factor_exposure(stock_rets, mkt_rets, smb_rets, hml_rets)

    def five_factor_alpha(
        self,
        stock_rets: list[float],
        mkt_rets: list[float],
        smb_rets: list[float],
        hml_rets: list[float],
        rmw_rets: list[float],
        cma_rets: list[float],
    ) -> dict:
        return self.ff.five_factor_exposure(stock_rets, mkt_rets, smb_rets, hml_rets, rmw_rets, cma_rets)

    def attribute_returns(
        self,
        total_return: float,
        exposures: dict,
        factor_returns: dict,
    ) -> dict:
        return self.attribution.attribute_returns(total_return, exposures, factor_returns)

    def get_factor_tilt(self, regime: str) -> dict:
        return self.timing.get_factor_tilt(regime)

    def build_portfolio(
        self,
        stocks: list[StockFactorData],
        factor_weights: dict = None,
    ) -> dict:
        ranked = self.constructor.composite_factor_score(stocks, factor_weights)
        portfolio = self.constructor.top_bottom_portfolio(ranked)
        return portfolio

    def capabilities(self) -> dict:
        return {
            "engine": "FactorModelEngine",
            "version": "1.0.0",
            "features": [
                "fama_french_3_factor",
                "fama_french_5_factor",
                "ols_multi_factor_regression",
                "value_factor_scoring",
                "size_factor_smb",
                "momentum_factor_12m_2m",
                "quality_factor_roe_margin",
                "low_volatility_factor",
                "growth_factor",
                "composite_multi_factor_score",
                "cross_sectional_ranking",
                "z_score_normalization",
                "return_attribution_by_factor",
                "portfolio_factor_attribution",
                "factor_timing_by_regime",
                "factor_momentum_ranking",
                "top_bottom_quintile_portfolio",
                "smart_beta_weighting",
                "tracking_error",
                "information_ratio",
            ],
        }
