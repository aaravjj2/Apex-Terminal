"""
Apex Terminal — Bloomberg-Grade Multi-Asset Analysis Engine
===========================================================

Cross-asset analysis spanning equities, forex, crypto, futures, bonds, commodities:

Asset Classes:
- Equities: stocks, ETFs, indices
- Forex: major, minor, exotic pairs
- Crypto: BTC, ETH, altcoins, stablecoins
- Futures: commodity, financial, index
- Fixed Income: treasuries, corporate bonds, yield curves
- Commodities: metals, energy, agriculture

Multi-Asset Analytics:
- Cross-asset correlation matrix
- Risk parity allocation
- Carry trade analysis
- Relative value analysis
- Macro factor decomposition
- Flight-to-quality detection
- Cross-asset momentum
- Regime-dependent allocation
- Currency-hedged returns
- Real yield analysis

Pure computation — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class AssetClass(Enum):
    EQUITY = "equity"
    FOREX = "forex"
    CRYPTO = "crypto"
    FUTURES = "futures"
    FIXED_INCOME = "fixed_income"
    COMMODITY = "commodity"
    INDEX = "index"


class Currency(Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    CHF = "CHF"
    AUD = "AUD"
    CAD = "CAD"
    NZD = "NZD"
    BTC = "BTC"
    ETH = "ETH"


class MacroFactor(Enum):
    GROWTH = "growth"
    INFLATION = "inflation"
    RATES = "rates"
    CREDIT = "credit"
    LIQUIDITY = "liquidity"
    VOLATILITY = "volatility"
    MOMENTUM = "momentum"
    VALUE = "value"
    SIZE = "size"
    QUALITY = "quality"


class AllocationMethod(Enum):
    EQUAL_WEIGHT = "equal_weight"
    RISK_PARITY = "risk_parity"
    MINIMUM_VARIANCE = "minimum_variance"
    MAX_SHARPE = "max_sharpe"
    INVERSE_VOLATILITY = "inverse_volatility"
    MOMENTUM_WEIGHTED = "momentum_weighted"
    MACRO_WEIGHTED = "macro_weighted"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class AssetInfo:
    """Asset metadata."""
    symbol: str
    name: str
    asset_class: AssetClass
    currency: Currency = Currency.USD
    sector: str = ""
    country: str = ""
    exchange: str = ""

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "name": self.name,
            "asset_class": self.asset_class.value,
            "currency": self.currency.value,
            "sector": self.sector,
            "country": self.country,
            "exchange": self.exchange,
        }


@dataclass
class AssetReturn:
    """Return data for an asset."""
    symbol: str
    returns: list[float]
    timestamps: list[datetime] = field(default_factory=list)

    @property
    def cumulative_return(self) -> float:
        cum = 1.0
        for r in self.returns:
            cum *= (1 + r)
        return cum - 1

    @property
    def annualized_return(self) -> float:
        n = len(self.returns)
        if n == 0:
            return 0.0
        cum = 1 + self.cumulative_return
        if cum <= 0:
            return -1.0
        return cum ** (252 / n) - 1

    @property
    def volatility(self) -> float:
        if len(self.returns) < 2:
            return 0.0
        return float(np.std(self.returns, ddof=1) * np.sqrt(252))

    @property
    def sharpe_ratio(self) -> float:
        vol = self.volatility
        if vol < 1e-10:
            return 0.0
        return self.annualized_return / vol

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "cumulative_return": round(self.cumulative_return, 6),
            "annualized_return": round(self.annualized_return, 6),
            "volatility": round(self.volatility, 6),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
            "num_observations": len(self.returns),
        }


@dataclass
class CrossAssetCorrelation:
    """Cross-asset correlation result."""
    asset1: str
    asset2: str
    correlation: float
    rolling_30d: float | None = None
    rolling_90d: float | None = None

    def to_dict(self) -> dict:
        return {
            "asset1": self.asset1,
            "asset2": self.asset2,
            "correlation": round(self.correlation, 4),
            "rolling_30d": round(self.rolling_30d, 4) if self.rolling_30d is not None else None,
            "rolling_90d": round(self.rolling_90d, 4) if self.rolling_90d is not None else None,
        }


@dataclass
class YieldCurvePoint:
    """A point on the yield curve."""
    maturity_years: float
    yield_pct: float
    timestamp: datetime | None = None

    def to_dict(self) -> dict:
        return {
            "maturity_years": self.maturity_years,
            "yield_pct": round(self.yield_pct, 4),
        }


@dataclass
class CarryTradeResult:
    """Carry trade analysis."""
    long_currency: str
    short_currency: str
    carry_return: float  # Interest rate differential
    spot_return: float
    total_return: float
    sharpe: float

    def to_dict(self) -> dict:
        return {
            "long_currency": self.long_currency,
            "short_currency": self.short_currency,
            "carry_return": round(self.carry_return, 6),
            "spot_return": round(self.spot_return, 6),
            "total_return": round(self.total_return, 6),
            "sharpe": round(self.sharpe, 4),
        }


@dataclass
class MacroRegime:
    """Current macro regime classification."""
    regime: str  # "risk_on", "risk_off", "inflationary", "deflationary", "neutral"
    confidence: float
    growth_signal: float
    inflation_signal: float
    rates_signal: float
    volatility_signal: float

    def to_dict(self) -> dict:
        return {
            "regime": self.regime,
            "confidence": round(self.confidence, 4),
            "growth_signal": round(self.growth_signal, 4),
            "inflation_signal": round(self.inflation_signal, 4),
            "rates_signal": round(self.rates_signal, 4),
            "volatility_signal": round(self.volatility_signal, 4),
        }


# ─── Cross-Asset Correlation Analyzer ───────────────────────────────────────

class CrossAssetAnalyzer:
    """Analyze correlations and relationships across asset classes."""

    @staticmethod
    def correlation_matrix(asset_returns: dict[str, list[float]]) -> dict:
        """Compute full correlation matrix across assets."""
        symbols = list(asset_returns.keys())
        n = len(symbols)
        if n < 2:
            return {"symbols": symbols, "matrix": [[1.0]], "avg_correlation": 0.0}

        # Align lengths
        min_len = min(len(r) for r in asset_returns.values())
        data = np.array([asset_returns[s][:min_len] for s in symbols])

        corr = np.corrcoef(data)
        if np.any(np.isnan(corr)):
            corr = np.nan_to_num(corr, nan=0.0)

        # Calculate avg pairwise
        upper = []
        for i in range(n):
            for j in range(i + 1, n):
                upper.append(corr[i][j])

        return {
            "symbols": symbols,
            "matrix": corr.tolist(),
            "avg_correlation": float(np.mean(upper)) if upper else 0.0,
            "max_correlation": float(np.max(upper)) if upper else 0.0,
            "min_correlation": float(np.min(upper)) if upper else 0.0,
        }

    @staticmethod
    def rolling_correlation(returns1: list[float], returns2: list[float],
                            window: int = 30) -> list[float]:
        """Rolling correlation between two return series."""
        n = min(len(returns1), len(returns2))
        if n < window:
            return []

        r1 = np.array(returns1[:n])
        r2 = np.array(returns2[:n])
        result = []

        for i in range(window, n + 1):
            w1 = r1[i - window:i]
            w2 = r2[i - window:i]
            c = np.corrcoef(w1, w2)[0, 1]
            result.append(float(c) if not np.isnan(c) else 0.0)

        return result

    @staticmethod
    def pairwise_correlations(asset_returns: dict[str, list[float]]) -> list[CrossAssetCorrelation]:
        """Compute pairwise correlations with rolling windows."""
        symbols = list(asset_returns.keys())
        results = []

        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                s1, s2 = symbols[i], symbols[j]
                r1 = asset_returns[s1]
                r2 = asset_returns[s2]
                n = min(len(r1), len(r2))
                if n < 2:
                    continue

                corr = float(np.corrcoef(r1[:n], r2[:n])[0, 1])

                roll_30 = None
                roll_90 = None
                if n >= 30:
                    roll = CrossAssetAnalyzer.rolling_correlation(r1, r2, 30)
                    if roll:
                        roll_30 = roll[-1]
                if n >= 90:
                    roll = CrossAssetAnalyzer.rolling_correlation(r1, r2, 90)
                    if roll:
                        roll_90 = roll[-1]

                results.append(CrossAssetCorrelation(
                    s1, s2, corr, roll_30, roll_90))

        return results


# ─── Relative Value Analyzer ────────────────────────────────────────────────

class RelativeValueAnalyzer:
    """Relative value and spread analysis."""

    @staticmethod
    def z_score(series: list[float], lookback: int = 60) -> float:
        """Z-score of most recent value vs lookback period."""
        if len(series) < lookback + 1:
            lookback = len(series) - 1
        if lookback < 2:
            return 0.0

        recent = series[-1]
        window = series[-lookback - 1:-1]
        mean = np.mean(window)
        std = np.std(window, ddof=1)
        if std == 0:
            return 0.0
        return float((recent - mean) / std)

    @staticmethod
    def spread_analysis(series1: list[float], series2: list[float]) -> dict:
        """Analyze spread between two price series."""
        n = min(len(series1), len(series2))
        if n < 2:
            return {"spread": [], "z_score": 0.0}

        s1 = np.array(series1[:n])
        s2 = np.array(series2[:n])
        spread = (s1 - s2).tolist()

        z = RelativeValueAnalyzer.z_score(spread)
        mean = float(np.mean(spread))
        std = float(np.std(spread, ddof=1))

        return {
            "spread": spread,
            "current_spread": spread[-1],
            "mean_spread": mean,
            "std_spread": std,
            "z_score": z,
            "percentile": float(np.searchsorted(np.sort(spread), spread[-1]) / n * 100),
        }

    @staticmethod
    def ratio_analysis(series1: list[float], series2: list[float]) -> dict:
        """Analyze price ratio between two assets."""
        n = min(len(series1), len(series2))
        if n < 2:
            return {"ratio": [], "z_score": 0.0}

        s1 = np.array(series1[:n])
        s2 = np.array(series2[:n])

        # Avoid division by zero
        mask = s2 != 0
        ratio = np.where(mask, s1 / s2, 0.0).tolist()

        z = RelativeValueAnalyzer.z_score(ratio)

        return {
            "ratio": ratio,
            "current_ratio": ratio[-1],
            "mean_ratio": float(np.mean(ratio)),
            "z_score": z,
        }


# ─── Carry Trade Analyzer ──────────────────────────────────────────────────

class CarryTradeAnalyzer:
    """Analyze carry trade opportunities."""

    @staticmethod
    def calculate_carry(long_rate: float, short_rate: float,
                        spot_returns: list[float]) -> CarryTradeResult:
        """Calculate carry trade return."""
        # Carry = interest rate differential (annualized per period)
        carry_per_day = (long_rate - short_rate) / 252
        n = len(spot_returns)

        if n == 0:
            return CarryTradeResult("", "", 0, 0, 0, 0)

        carry_return = carry_per_day * n
        spot_return = sum(spot_returns)
        total_return = carry_return + spot_return

        # Compute Sharpe
        daily_total = [r + carry_per_day for r in spot_returns]
        mean_daily = np.mean(daily_total)
        std_daily = np.std(daily_total, ddof=1) if len(daily_total) > 1 else 1.0
        sharpe = float(mean_daily / std_daily * np.sqrt(252)) if std_daily > 0 else 0.0

        return CarryTradeResult(
            long_currency="", short_currency="",
            carry_return=carry_return,
            spot_return=spot_return,
            total_return=total_return,
            sharpe=sharpe,
        )

    @staticmethod
    def carry_rankings(rates: dict[str, float], spot_returns: dict[str, list[float]]) -> list[dict]:
        """Rank carry trade opportunities."""
        currencies = list(rates.keys())
        results = []

        for i in range(len(currencies)):
            for j in range(len(currencies)):
                if i == j:
                    continue
                long_c = currencies[i]
                short_c = currencies[j]
                long_rate = rates[long_c]
                short_rate = rates[short_c]

                # Need spot returns for the pair
                pair_key = f"{long_c}/{short_c}"
                if pair_key in spot_returns:
                    result = CarryTradeAnalyzer.calculate_carry(
                        long_rate, short_rate, spot_returns[pair_key])
                    result.long_currency = long_c
                    result.short_currency = short_c
                    results.append(result.to_dict())

        results.sort(key=lambda x: x["total_return"], reverse=True)
        return results


# ─── Yield Curve Analyzer ──────────────────────────────────────────────────

class YieldCurveAnalyzer:
    """Yield curve analysis for fixed income."""

    @staticmethod
    def calculate_spread(curve: list[YieldCurvePoint], short_maturity: float,
                         long_maturity: float) -> float:
        """Calculate yield spread between two maturities."""
        short_yield = None
        long_yield = None

        for p in curve:
            if abs(p.maturity_years - short_maturity) < 0.01:
                short_yield = p.yield_pct
            if abs(p.maturity_years - long_maturity) < 0.01:
                long_yield = p.yield_pct

        if short_yield is None or long_yield is None:
            return 0.0
        return long_yield - short_yield

    @staticmethod
    def curve_shape(curve: list[YieldCurvePoint]) -> str:
        """Determine yield curve shape."""
        if len(curve) < 2:
            return "insufficient_data"

        sorted_curve = sorted(curve, key=lambda x: x.maturity_years)
        yields = [p.yield_pct for p in sorted_curve]

        # Check if inverted (short > long)
        if yields[0] > yields[-1]:
            return "inverted"

        # Check if flat (small spread)
        if abs(yields[-1] - yields[0]) < 0.25:
            return "flat"

        # Check if humped (midpoint higher than start and end)
        mid = len(yields) // 2
        if mid > 0 and mid < len(yields) - 1:
            if yields[mid] > yields[0] and yields[mid] > yields[-1]:
                return "humped"

        return "normal"

    @staticmethod
    def real_yield(nominal_yield: float, inflation_rate: float) -> float:
        """Calculate real yield using Fisher equation."""
        return ((1 + nominal_yield / 100) / (1 + inflation_rate / 100) - 1) * 100

    @staticmethod
    def forward_rate(spot_rate_1: float, maturity_1: float,
                     spot_rate_2: float, maturity_2: float) -> float:
        """Calculate implied forward rate."""
        if maturity_2 <= maturity_1:
            return 0.0

        # (1 + s2)^t2 = (1 + s1)^t1 * (1 + f)^(t2-t1)
        compound_2 = (1 + spot_rate_2 / 100) ** maturity_2
        compound_1 = (1 + spot_rate_1 / 100) ** maturity_1
        dt = maturity_2 - maturity_1

        if compound_1 == 0:
            return 0.0

        forward = (compound_2 / compound_1) ** (1 / dt) - 1
        return forward * 100


# ─── Macro Factor Analyzer ─────────────────────────────────────────────────

class MacroFactorAnalyzer:
    """Decompose returns into macro factors."""

    @staticmethod
    def factor_exposure(asset_returns: list[float], factor_returns: dict[str, list[float]]) -> dict:
        """Calculate factor exposures (betas) for an asset."""
        n = len(asset_returns)
        exposures = {}

        for factor_name, factor_ret in factor_returns.items():
            fn = min(n, len(factor_ret))
            if fn < 10:
                exposures[factor_name] = 0.0
                continue

            y = np.array(asset_returns[:fn])
            x = np.array(factor_ret[:fn])

            # OLS: beta = cov(x,y) / var(x)
            cov = np.cov(x, y, ddof=1)
            var_x = cov[0, 0]
            if var_x == 0:
                exposures[factor_name] = 0.0
            else:
                exposures[factor_name] = float(cov[0, 1] / var_x)

        return exposures

    @staticmethod
    def detect_regime(indicators: dict[str, list[float]]) -> MacroRegime:
        """Detect current macro regime from indicators."""
        growth = 0.0
        inflation = 0.0
        rates = 0.0
        volatility = 0.0

        if "growth" in indicators and indicators["growth"]:
            growth = float(np.mean(indicators["growth"][-20:]))
        if "inflation" in indicators and indicators["inflation"]:
            inflation = float(np.mean(indicators["inflation"][-20:]))
        if "rates" in indicators and indicators["rates"]:
            rates = float(np.mean(indicators["rates"][-20:]))
        if "volatility" in indicators and indicators["volatility"]:
            volatility = float(np.mean(indicators["volatility"][-20:]))

        # Classify regime
        if growth > 0 and volatility < 0:
            regime = "risk_on"
            confidence = min(1.0, abs(growth) + abs(volatility)) / 2
        elif growth < 0 and volatility > 0:
            regime = "risk_off"
            confidence = min(1.0, abs(growth) + abs(volatility)) / 2
        elif inflation > 0.5:
            regime = "inflationary"
            confidence = min(1.0, abs(inflation))
        elif inflation < -0.5:
            regime = "deflationary"
            confidence = min(1.0, abs(inflation))
        else:
            regime = "neutral"
            confidence = 0.3

        return MacroRegime(regime, confidence, growth, inflation, rates, volatility)


# ─── Multi-Asset Allocator ─────────────────────────────────────────────────

class MultiAssetAllocator:
    """Portfolio allocation across asset classes."""

    @staticmethod
    def equal_weight(n_assets: int) -> list[float]:
        if n_assets == 0:
            return []
        w = 1.0 / n_assets
        return [w] * n_assets

    @staticmethod
    def inverse_volatility(volatilities: list[float]) -> list[float]:
        """Weight inversely proportional to volatility."""
        if not volatilities or all(v == 0 for v in volatilities):
            return MultiAssetAllocator.equal_weight(len(volatilities))

        inv_vol = [1.0 / v if v > 0 else 0.0 for v in volatilities]
        total = sum(inv_vol)
        if total == 0:
            return MultiAssetAllocator.equal_weight(len(volatilities))
        return [w / total for w in inv_vol]

    @staticmethod
    def risk_parity(cov_matrix: list[list[float]]) -> list[float]:
        """Risk parity allocation from covariance matrix."""
        n = len(cov_matrix)
        if n == 0:
            return []

        cov = np.array(cov_matrix)
        vol = np.sqrt(np.diag(cov))
        vol = np.where(vol > 0, vol, 1e-10)

        inv_vol = 1.0 / vol
        weights = inv_vol / inv_vol.sum()
        return weights.tolist()

    @staticmethod
    def momentum_weighted(returns_dict: dict[str, list[float]], lookback: int = 60) -> dict[str, float]:
        """Weight based on recent momentum."""
        momentum_scores = {}
        for symbol, returns in returns_dict.items():
            if len(returns) >= lookback:
                cum_ret = 1.0
                for r in returns[-lookback:]:
                    cum_ret *= (1 + r)
                momentum_scores[symbol] = cum_ret - 1
            else:
                momentum_scores[symbol] = 0.0

        # Rank and weight by momentum
        total = sum(max(0, m) for m in momentum_scores.values())
        if total == 0:
            n = len(returns_dict)
            return {s: 1.0 / n if n > 0 else 0.0 for s in returns_dict}

        return {s: max(0, m) / total for s, m in momentum_scores.items()}


# ─── Currency Hedging ───────────────────────────────────────────────────────

class CurrencyHedger:
    """Currency-hedged return calculations."""

    @staticmethod
    def hedged_return(asset_return: float, fx_return: float, hedge_ratio: float = 1.0) -> float:
        """Calculate currency-hedged return."""
        unhedged = (1 + asset_return) * (1 + fx_return) - 1
        hedged = asset_return  # Fully hedged = local return only
        return hedge_ratio * hedged + (1 - hedge_ratio) * unhedged

    @staticmethod
    def hedged_series(asset_returns: list[float], fx_returns: list[float],
                      hedge_ratio: float = 1.0) -> list[float]:
        """Currency-hedged return series."""
        n = min(len(asset_returns), len(fx_returns))
        return [CurrencyHedger.hedged_return(asset_returns[i], fx_returns[i], hedge_ratio)
                for i in range(n)]

    @staticmethod
    def optimal_hedge_ratio(asset_returns: list[float], fx_returns: list[float]) -> float:
        """Optimal hedge ratio minimizing portfolio variance."""
        n = min(len(asset_returns), len(fx_returns))
        if n < 10:
            return 1.0

        ar = np.array(asset_returns[:n])
        fr = np.array(fx_returns[:n])

        # h* = -cov(r_a, r_fx) / var(r_fx)
        cov = np.cov(ar, fr, ddof=1)
        var_fx = cov[1, 1]
        if var_fx == 0:
            return 1.0
        h = -cov[0, 1] / var_fx
        return float(np.clip(h, 0, 1))


# ─── Flight to Quality Detector ────────────────────────────────────────────

class FlightToQualityDetector:
    """Detect flight-to-quality events across asset classes."""

    @staticmethod
    def detect(equity_returns: list[float], bond_returns: list[float],
               gold_returns: list[float], vix_changes: list[float],
               lookback: int = 5) -> dict:
        """Detect flight-to-quality conditions."""
        n = min(len(equity_returns), len(bond_returns), len(gold_returns), len(vix_changes))
        if n < lookback:
            return {"flight_to_quality": False, "score": 0.0}

        # Recent windows
        eq = np.array(equity_returns[-lookback:])
        bd = np.array(bond_returns[-lookback:])
        gd = np.array(gold_returns[-lookback:])
        vx = np.array(vix_changes[-lookback:])

        score = 0.0
        signals = []

        # Equity selling + bond buying
        if np.mean(eq) < -0.005 and np.mean(bd) > 0.001:
            score += 0.3
            signals.append("equity_sell_bond_buy")

        # VIX spike
        if np.mean(vx) > 0.05:
            score += 0.3
            signals.append("vix_spike")

        # Gold rally
        if np.mean(gd) > 0.003:
            score += 0.2
            signals.append("gold_rally")

        # Negative eq-bond correlation
        if n >= lookback:
            corr = np.corrcoef(eq, bd)[0, 1]
            if corr < -0.3:
                score += 0.2
                signals.append("negative_eq_bond_corr")

        return {
            "flight_to_quality": score > 0.5,
            "score": score,
            "signals": signals,
        }


# ─── Orchestrator ────────────────────────────────────────────────────────────

class MultiAssetAnalysisEngine:
    """Top-level multi-asset analysis engine."""

    def __init__(self):
        self.cross_asset = CrossAssetAnalyzer()
        self.relative_value = RelativeValueAnalyzer()
        self.carry_trade = CarryTradeAnalyzer()
        self.yield_curve = YieldCurveAnalyzer()
        self.macro = MacroFactorAnalyzer()
        self.allocator = MultiAssetAllocator()
        self.currency_hedger = CurrencyHedger()
        self.ftq_detector = FlightToQualityDetector()
        self._assets: dict[str, AssetInfo] = {}

    def register_asset(self, info: AssetInfo):
        self._assets[info.symbol] = info

    def get_asset(self, symbol: str) -> AssetInfo | None:
        return self._assets.get(symbol)

    def list_assets(self, asset_class: AssetClass | None = None) -> list[dict]:
        assets = self._assets.values()
        if asset_class:
            assets = [a for a in assets if a.asset_class == asset_class]
        return [a.to_dict() for a in assets]

    def correlation_matrix(self, returns: dict[str, list[float]]) -> dict:
        return self.cross_asset.correlation_matrix(returns)

    def pairwise_correlations(self, returns: dict[str, list[float]]) -> list[dict]:
        return [c.to_dict() for c in self.cross_asset.pairwise_correlations(returns)]

    def rolling_correlation(self, r1: list[float], r2: list[float], window: int = 30) -> list[float]:
        return self.cross_asset.rolling_correlation(r1, r2, window)

    def spread_analysis(self, s1: list[float], s2: list[float]) -> dict:
        return self.relative_value.spread_analysis(s1, s2)

    def ratio_analysis(self, s1: list[float], s2: list[float]) -> dict:
        return self.relative_value.ratio_analysis(s1, s2)

    def z_score(self, series: list[float], lookback: int = 60) -> float:
        return self.relative_value.z_score(series, lookback)

    def carry_trade(self, long_rate: float, short_rate: float,
                    spot_returns: list[float]) -> dict:
        return self.carry_trade.calculate_carry(long_rate, short_rate, spot_returns).to_dict()

    def yield_spread(self, curve: list[YieldCurvePoint], short_m: float, long_m: float) -> float:
        return self.yield_curve.calculate_spread(curve, short_m, long_m)

    def curve_shape(self, curve: list[YieldCurvePoint]) -> str:
        return self.yield_curve.curve_shape(curve)

    def real_yield(self, nominal: float, inflation: float) -> float:
        return self.yield_curve.real_yield(nominal, inflation)

    def forward_rate(self, s1: float, t1: float, s2: float, t2: float) -> float:
        return self.yield_curve.forward_rate(s1, t1, s2, t2)

    def factor_exposure(self, asset_ret: list[float], factor_ret: dict[str, list[float]]) -> dict:
        return self.macro.factor_exposure(asset_ret, factor_ret)

    def detect_regime(self, indicators: dict[str, list[float]]) -> dict:
        return self.macro.detect_regime(indicators).to_dict()

    def equal_weight_allocation(self, n: int) -> list[float]:
        return self.allocator.equal_weight(n)

    def inverse_vol_allocation(self, vols: list[float]) -> list[float]:
        return self.allocator.inverse_volatility(vols)

    def risk_parity_allocation(self, cov: list[list[float]]) -> list[float]:
        return self.allocator.risk_parity(cov)

    def momentum_allocation(self, returns: dict[str, list[float]], lookback: int = 60) -> dict:
        return self.allocator.momentum_weighted(returns, lookback)

    def hedged_return(self, asset_r: float, fx_r: float, ratio: float = 1.0) -> float:
        return self.currency_hedger.hedged_return(asset_r, fx_r, ratio)

    def hedged_series(self, asset_r: list[float], fx_r: list[float], ratio: float = 1.0) -> list[float]:
        return self.currency_hedger.hedged_series(asset_r, fx_r, ratio)

    def optimal_hedge_ratio(self, asset_r: list[float], fx_r: list[float]) -> float:
        return self.currency_hedger.optimal_hedge_ratio(asset_r, fx_r)

    def flight_to_quality(self, eq: list[float], bd: list[float],
                          gd: list[float], vx: list[float]) -> dict:
        return self.ftq_detector.detect(eq, bd, gd, vx)

    def asset_summary(self, returns: dict[str, list[float]]) -> list[dict]:
        """Summary stats for all assets."""
        return [AssetReturn(s, r).to_dict() for s, r in returns.items()]

    def capabilities(self) -> dict:
        return {
            "engine": "MultiAssetAnalysisEngine",
            "asset_classes": [ac.value for ac in AssetClass],
            "features": [
                "cross_asset_correlation",
                "rolling_correlation",
                "relative_value_analysis",
                "spread_and_ratio_analysis",
                "carry_trade_analysis",
                "yield_curve_analysis",
                "forward_rate_calculation",
                "real_yield_calculation",
                "macro_factor_decomposition",
                "regime_detection",
                "risk_parity_allocation",
                "momentum_allocation",
                "inverse_volatility_allocation",
                "currency_hedging",
                "optimal_hedge_ratio",
                "flight_to_quality_detection",
            ],
        }
