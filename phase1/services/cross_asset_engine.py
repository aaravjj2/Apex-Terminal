"""
Cross-Asset Engine — Correlations and risk relationships across equities, bonds,
commodities, FX and crypto. Risk-on/off regime detection, cross-asset momentum,
carry trade signals, and flight-to-safety flows.
Pure computation — no FastAPI dependencies.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AssetClass(str, Enum):
    EQUITIES = "equities"
    BONDS = "bonds"
    COMMODITIES = "commodities"
    FX = "fx"
    CRYPTO = "crypto"
    REAL_ESTATE = "real_estate"
    CASH = "cash"


class RiskRegime(str, Enum):
    RISK_ON = "risk_on"
    RISK_OFF = "risk_off"
    NEUTRAL = "neutral"
    TRANSITION = "transition"


class CarrySignal(str, Enum):
    STRONG_CARRY = "strong_carry"
    MODERATE_CARRY = "moderate_carry"
    NEUTRAL = "neutral"
    CARRY_FUNDING = "carry_funding"


@dataclass
class AssetReturn:
    symbol: str
    asset_class: AssetClass
    returns: list[float] = field(default_factory=list)
    yield_rate: float = 0.0        # for bonds/cash
    carry: float = 0.0             # for FX carry
    volatility_series: list[float] = field(default_factory=list)

    @property
    def annualized_return(self) -> float:
        if not self.returns:
            return 0.0
        mean = statistics.mean(self.returns)
        return (1 + mean) ** 252 - 1

    @property
    def annualized_vol(self) -> float:
        if len(self.returns) < 2:
            return 0.0
        return statistics.stdev(self.returns) * math.sqrt(252)

    @property
    def sharpe(self, risk_free: float = 0.05) -> float:
        vol = self.annualized_vol
        if vol == 0:
            return 0.0
        return (self.annualized_return - risk_free) / vol

    @property
    def recent_return(self) -> float:
        if not self.returns:
            return 0.0
        return sum(self.returns[-21:])

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "asset_class": self.asset_class.value,
            "annualized_return": round(self.annualized_return, 4),
            "annualized_vol": round(self.annualized_vol, 4),
            "yield_rate": round(self.yield_rate, 4),
            "carry": round(self.carry, 4),
            "recent_return_1m": round(self.recent_return, 4),
        }


# ── Cross-Asset Correlation ───────────────────────────────────────────

class CrossAssetCorrelation:
    """Compute rolling and static correlations between asset classes."""

    @staticmethod
    def pearson_correlation(x: list[float], y: list[float]) -> float:
        n = min(len(x), len(y))
        if n < 2:
            return 0.0
        x = x[:n]
        y = y[:n]
        mean_x = statistics.mean(x)
        mean_y = statistics.mean(y)
        num = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
        den_x = math.sqrt(sum((xi - mean_x) ** 2 for xi in x))
        den_y = math.sqrt(sum((yi - mean_y) ** 2 for yi in y))
        if den_x == 0 or den_y == 0:
            return 0.0
        return round(num / (den_x * den_y), 4)

    @staticmethod
    def correlation_matrix(assets: list[AssetReturn]) -> dict:
        """Pairwise correlation matrix."""
        n = len(assets)
        if n == 0:
            return {}
        min_len = min(len(a.returns) for a in assets)
        matrix = {}
        for i in range(n):
            matrix[assets[i].symbol] = {}
            for j in range(n):
                if i == j:
                    matrix[assets[i].symbol][assets[j].symbol] = 1.0
                else:
                    corr = CrossAssetCorrelation.pearson_correlation(
                        assets[i].returns[-min_len:],
                        assets[j].returns[-min_len:],
                    )
                    matrix[assets[i].symbol][assets[j].symbol] = corr
        return matrix

    @staticmethod
    def rolling_correlation(
        x: list[float],
        y: list[float],
        window: int = 60,
    ) -> list[float]:
        """Rolling window correlation series."""
        result = []
        for i in range(len(min(x, y, key=len))):
            start = max(0, i - window + 1)
            xi = x[start : i + 1]
            yi = y[start : i + 1]
            if len(xi) < 5:
                result.append(0.0)
            else:
                result.append(CrossAssetCorrelation.pearson_correlation(xi, yi))
        return result

    @staticmethod
    def correlation_breakdown(
        x: list[float],
        y: list[float],
        normal_window: int = 252,
        crisis_window: int = 60,
    ) -> dict:
        """Compare correlation in crisis vs. normal periods."""
        min_len = min(len(x), len(y))
        x = x[:min_len]
        y = y[:min_len]

        normal = CrossAssetCorrelation.pearson_correlation(
            x[:min(normal_window, min_len)], y[:min(normal_window, min_len)]
        )
        crisis = CrossAssetCorrelation.pearson_correlation(
            x[-min(crisis_window, min_len):], y[-min(crisis_window, min_len):]
        )

        return {
            "normal_period_correlation": normal,
            "crisis_period_correlation": crisis,
            "correlation_jumped": abs(crisis) > abs(normal) + 0.15,
            "regime_change_detected": abs(crisis - normal) > 0.20,
        }


# ── Risk-On / Risk-Off Regime ────────────────────────────────────────

class RiskOnOffDetector:
    """
    Detect risk-on/off regimes from cross-asset signals.
    Risk-ON: equities up, bonds flat/down, USD weak, gold flat, VIX low.
    Risk-OFF: equities down, bonds up (flight to safety), USD strong, gold up, VIX high.
    """

    @staticmethod
    def score_risk_on(
        equity_return_5d: float,
        bond_return_5d: float,
        usd_return_5d: float,
        vix_level: float,
        gold_return_5d: float = 0.0,
    ) -> dict:
        """
        Risk-on score from -100 (max risk-off) to +100 (max risk-on).
        """
        score = 0.0

        # Equity signal (most important)
        score += equity_return_5d * 200    # -50% move → -100 score

        # Bond negative correlation with equities in risk-on
        score -= bond_return_5d * 150      # bonds up = risk-off

        # USD negative correlation (SPX vs DXY tends to be negative)
        score -= usd_return_5d * 100       # USD up = risk-off

        # VIX
        if vix_level < 15:
            score += 20
        elif vix_level < 20:
            score += 10
        elif vix_level > 30:
            score -= 30
        elif vix_level > 25:
            score -= 15

        # Gold
        score -= gold_return_5d * 100      # gold up = risk-off

        clamped = max(-100, min(100, score))

        regime = (
            RiskRegime.RISK_ON if clamped > 20
            else RiskRegime.RISK_OFF if clamped < -20
            else RiskRegime.NEUTRAL
        )

        return {
            "risk_on_score": round(clamped, 2),
            "regime": regime.value,
            "equity_contribution": round(equity_return_5d * 200, 2),
            "bond_contribution": round(-bond_return_5d * 150, 2),
            "usd_contribution": round(-usd_return_5d * 100, 2),
        }

    @staticmethod
    def regime_series(
        equity_rets: list[float],
        bond_rets: list[float],
        vix_levels: list[float],
        window: int = 5,
    ) -> list[str]:
        """Regime at each time step."""
        n = min(len(equity_rets), len(bond_rets), len(vix_levels))
        regimes = []
        for i in range(n):
            start = max(0, i - window + 1)
            eq_5d = sum(equity_rets[start : i + 1])
            bn_5d = sum(bond_rets[start : i + 1])
            vix = vix_levels[i]
            result = RiskOnOffDetector.score_risk_on(eq_5d, bn_5d, 0, vix)
            regimes.append(result["regime"])
        return regimes


# ── Carry Trade Analytics ─────────────────────────────────────────────

class CarryTradeAnalyzer:
    """FX carry trade, bond carry, and cross-asset carry signals."""

    @staticmethod
    def fx_carry(
        high_yield_currency_rate: float,
        low_yield_currency_rate: float,
        spot_return_annualized: float = 0.0,
    ) -> dict:
        """
        Net carry = interest rate differential - expected FX depreciation.
        """
        rate_diff = high_yield_currency_rate - low_yield_currency_rate
        net_carry = rate_diff + spot_return_annualized

        return {
            "rate_differential": round(rate_diff, 4),
            "spot_return": round(spot_return_annualized, 4),
            "net_carry": round(net_carry, 4),
            "signal": (
                CarrySignal.STRONG_CARRY if net_carry > 0.03
                else CarrySignal.MODERATE_CARRY if net_carry > 0.01
                else CarrySignal.CARRY_FUNDING if net_carry < -0.01
                else CarrySignal.NEUTRAL
            ).value,
        }

    @staticmethod
    def cross_asset_carry_ranking(assets: list[AssetReturn]) -> list[dict]:
        """Rank assets by carry (yield or income component)."""
        ranked = sorted(assets, key=lambda a: -a.carry)
        return [
            {
                "rank": i + 1,
                "symbol": a.symbol,
                "asset_class": a.asset_class.value,
                "carry": round(a.carry, 4),
                "carry_signal": (
                    CarrySignal.STRONG_CARRY if a.carry > 0.05
                    else CarrySignal.MODERATE_CARRY if a.carry > 0.02
                    else CarrySignal.NEUTRAL if a.carry > 0
                    else CarrySignal.CARRY_FUNDING
                ).value,
            }
            for i, a in enumerate(ranked)
        ]

    @staticmethod
    def bond_equity_carry(
        dividend_yield: float,
        earnings_yield: float,
        bond_yield_10y: float,
        risk_free: float = 0.05,
    ) -> dict:
        """Fed Model: equity yield vs. bond yield attractiveness."""
        equity_carry = earnings_yield - bond_yield_10y
        equity_risk_premium = earnings_yield - risk_free
        bond_real_yield = bond_yield_10y - 0.025  # assume 2.5% inflation

        return {
            "earnings_yield": round(earnings_yield, 4),
            "dividend_yield": round(dividend_yield, 4),
            "bond_yield_10y": round(bond_yield_10y, 4),
            "equity_vs_bond_carry": round(equity_carry, 4),
            "equity_risk_premium": round(equity_risk_premium, 4),
            "bond_real_yield": round(bond_real_yield, 4),
            "prefer_equities": equity_carry > 0,
            "signal": "overweight_equities" if equity_carry > 0.02 else "overweight_bonds" if equity_carry < -0.01 else "neutral",
        }


# ── Flight-to-Safety ─────────────────────────────────────────────────

class FlightToSafetyDetector:
    """Detect capital flows into safe-haven assets."""

    SAFE_HAVENS = ["USD", "JPY", "CHF", "GOLD", "US_TREASURY", "GERMAN_BUND"]

    @staticmethod
    def safe_haven_demand(
        assets: list[AssetReturn],
        lookback: int = 5,
    ) -> dict:
        """Measure recent performance of safe-haven vs. risk assets."""
        safe = [a for a in assets if a.symbol.upper() in FlightToSafetyDetector.SAFE_HAVENS or
                a.asset_class == AssetClass.BONDS]
        risky = [a for a in assets if a.asset_class in [AssetClass.EQUITIES, AssetClass.CRYPTO]]

        if not safe or not risky:
            return {"safe_haven_demand": "insufficient_data"}

        safe_ret = statistics.mean(sum(a.returns[-lookback:]) for a in safe)
        risky_ret = statistics.mean(sum(a.returns[-lookback:]) for a in risky)

        spread = safe_ret - risky_ret
        demand_level = (
            "extreme" if spread > 0.05
            else "high" if spread > 0.02
            else "moderate" if spread > 0
            else "low"
        )

        return {
            "safe_haven_avg_return": round(safe_ret, 4),
            "risky_asset_avg_return": round(risky_ret, 4),
            "spread": round(spread, 4),
            "demand_level": demand_level,
            "flight_to_safety": spread > 0.02,
        }


# ── Cross-Asset Momentum ──────────────────────────────────────────────

class CrossAssetMomentum:
    """Momentum signals across asset classes."""

    @staticmethod
    def time_series_momentum(
        asset: AssetReturn,
        lookback_months: int = 12,
        signal_months: int = 1,
    ) -> dict:
        """TSMOM: 12-month (1-month skipped) return as trend signal."""
        daily_lb = lookback_months * 21
        daily_signal = signal_months * 21

        if len(asset.returns) < daily_lb + daily_signal:
            return {"momentum": 0, "signal": "hold"}

        # Trend period = returns[0 : -(signal)] → skip most recent month
        trend_rets = asset.returns[-daily_lb: -daily_signal] if daily_signal > 0 else asset.returns[-daily_lb:]
        trend_return = sum(trend_rets)

        return {
            "symbol": asset.symbol,
            "trend_return": round(trend_return, 4),
            "signal": "long" if trend_return > 0 else "short" if trend_return < -0.05 else "hold",
            "signal_strength": round(abs(trend_return), 4),
        }

    @staticmethod
    def rank_cross_asset_momentum(
        assets: list[AssetReturn],
        lookback_months: int = 12,
    ) -> list[dict]:
        """Rank all assets by TSMOM signal."""
        signals = []
        for a in assets:
            sig = CrossAssetMomentum.time_series_momentum(a, lookback_months)
            sig["asset_class"] = a.asset_class.value
            signals.append(sig)
        return sorted(signals, key=lambda x: -x.get("trend_return", 0))


# ── Orchestrator ──────────────────────────────────────────────────────

class CrossAssetEngine:
    """Top-level orchestrator for cross-asset analytics."""

    def __init__(self):
        self.correlation = CrossAssetCorrelation()
        self.regime = RiskOnOffDetector()
        self.carry = CarryTradeAnalyzer()
        self.safety = FlightToSafetyDetector()
        self.momentum = CrossAssetMomentum()

    def correlation_matrix(self, assets: list[AssetReturn]) -> dict:
        return self.correlation.correlation_matrix(assets)

    def risk_regime(
        self,
        equity_ret: float,
        bond_ret: float,
        usd_ret: float,
        vix: float,
    ) -> dict:
        return self.regime.score_risk_on(equity_ret, bond_ret, usd_ret, vix)

    def carry_ranking(self, assets: list[AssetReturn]) -> list[dict]:
        return self.carry.cross_asset_carry_ranking(assets)

    def fed_model(
        self,
        dividend_yield: float,
        earnings_yield: float,
        bond_yield_10y: float,
    ) -> dict:
        return self.carry.bond_equity_carry(dividend_yield, earnings_yield, bond_yield_10y)

    def flight_to_safety(self, assets: list[AssetReturn]) -> dict:
        return self.safety.safe_haven_demand(assets)

    def momentum_ranking(self, assets: list[AssetReturn]) -> list[dict]:
        return self.momentum.rank_cross_asset_momentum(assets)

    def full_cross_asset_view(self, assets: list[AssetReturn], vix: float = 20.0) -> dict:
        """Complete cross-asset dashboard snapshot."""
        eq = [a for a in assets if a.asset_class == AssetClass.EQUITIES]
        bonds = [a for a in assets if a.asset_class == AssetClass.BONDS]

        eq_ret = sum(a.recent_return for a in eq) / max(len(eq), 1)
        bond_ret = sum(a.recent_return for a in bonds) / max(len(bonds), 1)

        return {
            "risk_regime": self.regime.score_risk_on(eq_ret, bond_ret, 0, vix),
            "momentum_leaders": self.momentum.rank_cross_asset_momentum(assets)[:3],
            "carry_leaders": self.carry.cross_asset_carry_ranking(assets)[:3],
            "flight_to_safety": self.safety.safe_haven_demand(assets),
        }

    def capabilities(self) -> dict:
        return {
            "engine": "CrossAssetEngine",
            "version": "1.0.0",
            "asset_classes": [c.value for c in AssetClass],
            "features": [
                "pairwise_pearson_correlation",
                "rolling_correlation_windows",
                "crisis_correlation_breakdown",
                "risk_on_off_regime_detection",
                "risk_regime_time_series",
                "fx_carry_trade_signal",
                "cross_asset_carry_ranking",
                "bond_equity_fed_model",
                "flight_to_safety_detection",
                "safe_haven_demand_level",
                "time_series_momentum_tsmom",
                "cross_asset_momentum_ranking",
                "full_cross_asset_dashboard",
            ],
        }
