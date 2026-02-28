"""
risk_management_engine.py — Comprehensive Risk Management Engine
================================================================
Position sizing, exposure limits, margin calculations, Greeks risk,
scenario analysis, compliance checking, and risk reporting.

Classes:
    PositionSizer       — Kelly, fixed fractional, volatility-scaled, optimal-f
    ExposureLimiter     — Per-symbol, sector, asset-class, gross/net limits
    MarginCalculator    — Reg-T, portfolio margin, options margin
    GreeksRisk          — Portfolio-level Greeks aggregation & analysis
    ScenarioEngine      — What-if analysis, historical stress tests
    ComplianceChecker   — Rule-based pre-trade and portfolio compliance
    RiskReporter        — Risk dashboard aggregation, alerts
    CorrelationRisk     — Correlation regime, crowded trades, diversification score
    TailRisk            — Extreme value theory, tail dependence, crash risk
    LiquidityRisk       — Position liquidity, market impact estimation
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
import math
import uuid

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats


# ═══════════════════════════════════════════════════════════════════════════════
#  Enums & Data Classes
# ═══════════════════════════════════════════════════════════════════════════════

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SizingMethod(str, Enum):
    FIXED_FRACTIONAL = "fixed_fractional"
    KELLY = "kelly"
    VOLATILITY_SCALED = "volatility_scaled"
    OPTIMAL_F = "optimal_f"
    EQUAL_WEIGHT = "equal_weight"
    MAX_DRAWDOWN = "max_drawdown"
    ATR_BASED = "atr_based"


class MarginType(str, Enum):
    REG_T = "reg_t"
    PORTFOLIO = "portfolio"
    SPAN = "span"


@dataclass
class RiskAlert:
    level: RiskLevel
    category: str
    message: str
    value: float = 0.0
    limit: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "level": self.level.value, "category": self.category,
            "message": self.message, "value": self.value, "limit": self.limit,
            "timestamp": self.timestamp,
        }


@dataclass
class RiskLimits:
    max_position_size_pct: float = 0.10
    max_sector_exposure_pct: float = 0.30
    max_single_loss_pct: float = 0.02
    max_daily_loss_pct: float = 0.05
    max_gross_leverage: float = 2.0
    max_net_leverage: float = 1.5
    max_concentration_hhi: float = 0.15
    max_correlation: float = 0.85
    max_var_pct: float = 0.03
    min_liquidity_days: float = 1.0
    max_options_delta: float = 500.0
    max_options_gamma: float = 100.0
    max_options_vega: float = 1000.0


@dataclass
class GreeksSnapshot:
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    vanna: float = 0.0
    charm: float = 0.0
    speed: float = 0.0
    color: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {
            "delta": self.delta, "gamma": self.gamma, "theta": self.theta,
            "vega": self.vega, "rho": self.rho, "vanna": self.vanna,
            "charm": self.charm, "speed": self.speed, "color": self.color,
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  PositionSizer
# ═══════════════════════════════════════════════════════════════════════════════

class PositionSizer:
    """Multiple position sizing algorithms."""

    @staticmethod
    def fixed_fractional(capital: float, risk_pct: float, entry: float,
                         stop_loss: float) -> Dict[str, Any]:
        risk_per_share = abs(entry - stop_loss)
        if risk_per_share == 0:
            return {"shares": 0, "position_value": 0, "risk_amount": 0}
        risk_amount = capital * risk_pct
        shares = int(risk_amount / risk_per_share)
        return {
            "shares": shares,
            "position_value": round(shares * entry, 2),
            "risk_amount": round(risk_amount, 2),
            "risk_per_share": round(risk_per_share, 2),
            "pct_of_capital": round(shares * entry / capital * 100, 2) if capital > 0 else 0,
        }

    @staticmethod
    def kelly(win_rate: float, avg_win: float, avg_loss: float,
              kelly_fraction: float = 0.5) -> Dict[str, Any]:
        if avg_loss == 0:
            return {"kelly_pct": 0, "recommended_pct": 0}
        b = avg_win / avg_loss
        q = 1 - win_rate
        kelly_full = win_rate - q / b
        recommended = kelly_full * kelly_fraction
        return {
            "kelly_full": round(kelly_full, 4),
            "kelly_pct": round(max(0, recommended) * 100, 2),
            "recommended_pct": round(max(0, min(recommended, 0.25)) * 100, 2),
            "edge": round(kelly_full, 4),
        }

    @staticmethod
    def volatility_scaled(capital: float, target_vol: float,
                          asset_vol: float, price: float) -> Dict[str, Any]:
        if asset_vol == 0 or price == 0:
            return {"shares": 0, "position_value": 0}
        notional = capital * target_vol / asset_vol
        shares = int(notional / price)
        return {
            "shares": shares,
            "position_value": round(shares * price, 2),
            "asset_vol": round(asset_vol, 4),
            "target_vol": round(target_vol, 4),
            "vol_ratio": round(target_vol / asset_vol, 4),
            "pct_of_capital": round(shares * price / capital * 100, 2) if capital > 0 else 0,
        }

    @staticmethod
    def optimal_f(trades_pnl: List[float]) -> Dict[str, Any]:
        if not trades_pnl:
            return {"optimal_f": 0, "geometric_mean": 0}
        max_loss = min(trades_pnl)
        if max_loss >= 0:
            return {"optimal_f": 1.0, "geometric_mean": 0}
        best_f = 0.0
        best_geo = 0.0
        for f_test in np.arange(0.01, 1.0, 0.01):
            hpr = [1 + f_test * (t / abs(max_loss)) for t in trades_pnl]
            if any(h <= 0 for h in hpr):
                continue
            geo = np.prod(hpr) ** (1 / len(hpr))
            if geo > best_geo:
                best_geo = geo
                best_f = f_test
        return {
            "optimal_f": round(best_f, 4),
            "geometric_mean": round(best_geo, 6),
            "half_f": round(best_f / 2, 4),
        }

    @staticmethod
    def atr_based(capital: float, risk_pct: float, atr: float,
                  atr_multiple: float = 2.0, price: float = 0.0) -> Dict[str, Any]:
        stop_distance = atr * atr_multiple
        if stop_distance == 0:
            return {"shares": 0, "position_value": 0}
        risk_amount = capital * risk_pct
        shares = int(risk_amount / stop_distance)
        return {
            "shares": shares,
            "position_value": round(shares * price, 2) if price > 0 else 0,
            "stop_distance": round(stop_distance, 4),
            "risk_amount": round(risk_amount, 2),
        }

    @staticmethod
    def equal_weight(capital: float, n_positions: int, price: float) -> Dict[str, Any]:
        if n_positions == 0 or price == 0:
            return {"shares": 0, "position_value": 0}
        alloc = capital / n_positions
        shares = int(alloc / price)
        return {
            "shares": shares,
            "position_value": round(shares * price, 2),
            "allocation": round(alloc, 2),
            "weight": round(1 / n_positions * 100, 2),
        }

    @staticmethod
    def max_drawdown_sized(capital: float, max_dd_pct: float,
                           expected_dd: float, price: float) -> Dict[str, Any]:
        if expected_dd == 0 or price == 0:
            return {"shares": 0, "position_value": 0}
        max_loss = capital * max_dd_pct
        position_capital = max_loss / expected_dd
        shares = int(position_capital / price)
        return {
            "shares": shares,
            "position_value": round(shares * price, 2),
            "max_loss_allowed": round(max_loss, 2),
            "implied_leverage": round(shares * price / capital, 4) if capital > 0 else 0,
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  ExposureLimiter
# ═══════════════════════════════════════════════════════════════════════════════

class ExposureLimiter:
    """Enforce exposure limits across multiple dimensions."""

    @staticmethod
    def check_position_limit(position_value: float, total_equity: float,
                             limit_pct: float = 0.10) -> Dict[str, Any]:
        if total_equity == 0:
            return {"allowed": False, "ratio": 0, "limit": limit_pct}
        ratio = abs(position_value) / total_equity
        return {
            "allowed": ratio <= limit_pct,
            "ratio": round(ratio, 4),
            "limit": limit_pct,
            "headroom": round(max(0, limit_pct - ratio), 4),
        }

    @staticmethod
    def check_sector_limit(sector_exposure: Dict[str, float], total_equity: float,
                           limit_pct: float = 0.30) -> Dict[str, Any]:
        breaches = []
        for sector, exposure in sector_exposure.items():
            ratio = abs(exposure) / total_equity if total_equity > 0 else 0
            if ratio > limit_pct:
                breaches.append({
                    "sector": sector, "exposure": exposure,
                    "ratio": round(ratio, 4), "limit": limit_pct,
                })
        return {"compliant": len(breaches) == 0, "breaches": breaches}

    @staticmethod
    def check_leverage(gross_exposure: float, net_exposure: float,
                       total_equity: float, limits: RiskLimits) -> Dict[str, Any]:
        gross_lev = gross_exposure / total_equity if total_equity > 0 else 0
        net_lev = abs(net_exposure) / total_equity if total_equity > 0 else 0
        return {
            "gross_leverage": round(gross_lev, 4),
            "net_leverage": round(net_lev, 4),
            "gross_ok": gross_lev <= limits.max_gross_leverage,
            "net_ok": net_lev <= limits.max_net_leverage,
            "gross_headroom": round(max(0, limits.max_gross_leverage - gross_lev), 4),
            "net_headroom": round(max(0, limits.max_net_leverage - net_lev), 4),
        }

    @staticmethod
    def max_additional_exposure(current_gross: float, total_equity: float,
                                max_leverage: float) -> float:
        return max(0, total_equity * max_leverage - current_gross)

    @staticmethod
    def check_concentration(position_weights: List[float],
                            max_hhi: float = 0.15) -> Dict[str, Any]:
        if not position_weights:
            return {"hhi": 0, "compliant": True}
        total = sum(abs(w) for w in position_weights)
        if total == 0:
            return {"hhi": 0, "compliant": True}
        normalized = [abs(w) / total for w in position_weights]
        hhi = sum(w ** 2 for w in normalized)
        effective_n = 1 / hhi if hhi > 0 else 0
        return {
            "hhi": round(hhi, 6),
            "effective_positions": round(effective_n, 1),
            "compliant": hhi <= max_hhi,
            "limit": max_hhi,
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  MarginCalculator
# ═══════════════════════════════════════════════════════════════════════════════

class MarginCalculator:
    """Margin requirement computations."""

    @staticmethod
    def reg_t_equity(position_value: float, is_long: bool = True) -> Dict[str, float]:
        initial_margin = position_value * 0.5 if is_long else position_value * 0.5
        maintenance_margin = position_value * 0.25 if is_long else position_value * 0.30
        return {
            "initial_margin": round(initial_margin, 2),
            "maintenance_margin": round(maintenance_margin, 2),
            "buying_power_used": round(initial_margin, 2),
        }

    @staticmethod
    def reg_t_options(option_type: str, underlying_price: float,
                      strike: float, premium: float, quantity: int) -> Dict[str, float]:
        multiplier = 100
        if option_type == "long_call" or option_type == "long_put":
            margin = premium * quantity * multiplier
            return {"margin": round(margin, 2), "type": "debit"}
        elif option_type == "short_call":
            oom = max(0, strike - underlying_price)
            margin1 = (0.20 * underlying_price - oom + premium) * quantity * multiplier
            margin2 = (0.10 * underlying_price + premium) * quantity * multiplier
            margin = max(margin1, margin2)
            return {"margin": round(margin, 2), "type": "credit"}
        elif option_type == "short_put":
            oom = max(0, underlying_price - strike)
            margin1 = (0.20 * underlying_price - oom + premium) * quantity * multiplier
            margin2 = (0.10 * strike + premium) * quantity * multiplier
            margin = max(margin1, margin2)
            return {"margin": round(margin, 2), "type": "credit"}
        return {"margin": 0, "type": "unknown"}

    @staticmethod
    def portfolio_margin_estimate(positions: List[Dict[str, Any]]) -> Dict[str, float]:
        """Simplified portfolio margin — uses stress test approach."""
        total_margin = 0.0
        for pos in positions:
            mv = abs(pos.get("market_value", 0))
            asset_class = pos.get("asset_class", "equity")
            if asset_class == "equity":
                stress = mv * 0.15
            elif asset_class == "option":
                stress = mv * 0.25
            elif asset_class == "futures":
                stress = mv * 0.10
            elif asset_class == "forex":
                stress = mv * 0.04
            else:
                stress = mv * 0.20
            total_margin += stress
        return {
            "total_margin": round(total_margin, 2),
            "margin_type": "portfolio",
        }

    @staticmethod
    def margin_call_price(equity: float, maintenance_margin_rate: float,
                          loan_value: float, shares: float) -> float:
        if shares == 0:
            return 0.0
        # Margin call when equity = maintenance_margin_rate * position_value
        # equity = shares * price - loan_value
        # shares * price - loan = maintenance_margin_rate * shares * price
        # price * (shares - shares * rate) = loan
        denom = shares * (1 - maintenance_margin_rate)
        if denom == 0:
            return 0.0
        return round(loan_value / denom, 2)


# ═══════════════════════════════════════════════════════════════════════════════
#  GreeksRisk
# ═══════════════════════════════════════════════════════════════════════════════

class GreeksRisk:
    """Portfolio-level Greeks aggregation & risk analysis."""

    @staticmethod
    def aggregate_greeks(positions: List[Dict[str, Any]]) -> GreeksSnapshot:
        total = GreeksSnapshot()
        for pos in positions:
            qty = pos.get("quantity", 0)
            mult = pos.get("multiplier", 100)
            total.delta += pos.get("delta", 0) * qty * mult
            total.gamma += pos.get("gamma", 0) * qty * mult
            total.theta += pos.get("theta", 0) * qty * mult
            total.vega += pos.get("vega", 0) * qty * mult
            total.rho += pos.get("rho", 0) * qty * mult
            total.vanna += pos.get("vanna", 0) * qty * mult
            total.charm += pos.get("charm", 0) * qty * mult
        return total

    @staticmethod
    def greeks_pnl_estimate(greeks: GreeksSnapshot, price_change: float,
                            vol_change: float, time_decay: float = 1 / 252) -> Dict[str, float]:
        delta_pnl = greeks.delta * price_change
        gamma_pnl = 0.5 * greeks.gamma * price_change ** 2
        theta_pnl = greeks.theta * time_decay
        vega_pnl = greeks.vega * vol_change
        total = delta_pnl + gamma_pnl + theta_pnl + vega_pnl
        return {
            "delta_pnl": round(delta_pnl, 2),
            "gamma_pnl": round(gamma_pnl, 2),
            "theta_pnl": round(theta_pnl, 2),
            "vega_pnl": round(vega_pnl, 2),
            "total_estimated_pnl": round(total, 2),
        }

    @staticmethod
    def greeks_stress_matrix(greeks: GreeksSnapshot,
                             price_range: Tuple[float, float] = (-5, 5),
                             vol_range: Tuple[float, float] = (-0.10, 0.10),
                             steps: int = 11) -> Dict[str, Any]:
        prices = np.linspace(price_range[0], price_range[1], steps)
        vols = np.linspace(vol_range[0], vol_range[1], steps)
        matrix = []
        for dp in prices:
            row = []
            for dv in vols:
                pnl = (greeks.delta * dp +
                       0.5 * greeks.gamma * dp ** 2 +
                       greeks.vega * dv)
                row.append(round(pnl, 2))
            matrix.append(row)
        return {
            "price_changes": prices.tolist(),
            "vol_changes": vols.tolist(),
            "pnl_matrix": matrix,
        }

    @staticmethod
    def delta_hedge_ratio(portfolio_delta: float, underlying_price: float) -> Dict[str, Any]:
        shares_to_hedge = -int(portfolio_delta)
        cost = abs(shares_to_hedge) * underlying_price
        return {
            "shares_needed": shares_to_hedge,
            "hedge_cost": round(cost, 2),
            "residual_delta": round(portfolio_delta + shares_to_hedge, 2),
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  ScenarioEngine
# ═══════════════════════════════════════════════════════════════════════════════

class ScenarioEngine:
    """What-if analysis, historical stress tests."""

    HISTORICAL_SCENARIOS: Dict[str, Dict[str, float]] = {
        "2008_financial_crisis": {"equity": -0.38, "bonds": 0.05, "gold": 0.25, "oil": -0.54},
        "2020_covid_crash": {"equity": -0.34, "bonds": 0.02, "gold": 0.04, "oil": -0.65},
        "2022_rate_hikes": {"equity": -0.19, "bonds": -0.13, "gold": -0.01, "oil": 0.07},
        "dotcom_bust": {"equity": -0.49, "bonds": 0.10, "gold": -0.06, "oil": -0.25},
        "flash_crash_2010": {"equity": -0.09, "bonds": 0.01, "gold": 0.01, "oil": -0.05},
        "taper_tantrum_2013": {"equity": -0.06, "bonds": -0.05, "gold": -0.15, "oil": -0.03},
        "brexit_2016": {"equity": -0.05, "bonds": 0.02, "gold": 0.08, "oil": -0.04},
        "vol_explosion_2018": {"equity": -0.10, "bonds": 0.01, "gold": 0.01, "oil": -0.07},
    }

    @staticmethod
    def run_scenario(positions: List[Dict[str, Any]], scenario: Dict[str, float]) -> Dict[str, Any]:
        total_pnl = 0.0
        detail = []
        for pos in positions:
            symbol = pos.get("symbol", "")
            mv = pos.get("market_value", 0)
            ac = pos.get("asset_class", "equity")
            shock = scenario.get(symbol, scenario.get(ac, 0.0))
            pnl = mv * shock
            total_pnl += pnl
            detail.append({
                "symbol": symbol, "market_value": mv,
                "shock": shock, "pnl": round(pnl, 2),
            })
        return {"total_pnl": round(total_pnl, 2), "detail": detail}

    @staticmethod
    def run_historical_scenarios(positions: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = {}
        for name, scenario in ScenarioEngine.HISTORICAL_SCENARIOS.items():
            results[name] = ScenarioEngine.run_scenario(positions, scenario)
        return results

    @staticmethod
    def sensitivity_analysis(positions: List[Dict[str, Any]],
                             shocks: List[float] = None) -> Dict[str, Any]:
        if shocks is None:
            shocks = [-0.20, -0.15, -0.10, -0.05, -0.02, 0.02, 0.05, 0.10, 0.15, 0.20]
        total_mv = sum(abs(p.get("market_value", 0)) for p in positions)
        results = []
        for shock in shocks:
            pnl = total_mv * shock
            results.append({
                "shock_pct": round(shock * 100, 1),
                "pnl": round(pnl, 2),
                "pnl_pct": round(shock * 100, 2),
            })
        return {"sensitivity": results, "total_market_value": round(total_mv, 2)}

    @staticmethod
    def custom_scenario(positions: List[Dict[str, Any]],
                        symbol_shocks: Dict[str, float]) -> Dict[str, Any]:
        return ScenarioEngine.run_scenario(positions, symbol_shocks)


# ═══════════════════════════════════════════════════════════════════════════════
#  ComplianceChecker
# ═══════════════════════════════════════════════════════════════════════════════

class ComplianceChecker:
    """Pre-trade and portfolio compliance."""

    @staticmethod
    def pre_trade_check(
        symbol: str,
        side: str,
        quantity: int,
        price: float,
        portfolio_equity: float,
        current_positions: List[Dict[str, Any]],
        limits: RiskLimits,
    ) -> Dict[str, Any]:
        alerts: List[Dict[str, Any]] = []
        trade_value = quantity * price

        # Position size check
        pct = trade_value / portfolio_equity if portfolio_equity > 0 else 0
        if pct > limits.max_position_size_pct:
            alerts.append(RiskAlert(
                level=RiskLevel.HIGH, category="position_size",
                message=f"{symbol}: position size {pct:.1%} exceeds limit {limits.max_position_size_pct:.1%}",
                value=pct, limit=limits.max_position_size_pct,
            ).to_dict())

        # Gross leverage check
        current_gross = sum(abs(p.get("market_value", 0)) for p in current_positions)
        new_gross = current_gross + trade_value
        new_leverage = new_gross / portfolio_equity if portfolio_equity > 0 else 0
        if new_leverage > limits.max_gross_leverage:
            alerts.append(RiskAlert(
                level=RiskLevel.CRITICAL, category="leverage",
                message=f"Gross leverage {new_leverage:.2f}x exceeds limit {limits.max_gross_leverage:.2f}x",
                value=new_leverage, limit=limits.max_gross_leverage,
            ).to_dict())

        return {
            "approved": len(alerts) == 0,
            "alerts": alerts,
            "trade_value": round(trade_value, 2),
            "position_pct": round(pct * 100, 2),
            "new_gross_leverage": round(new_leverage, 4),
        }

    @staticmethod
    def portfolio_compliance(
        positions: List[Dict[str, Any]],
        equity: float,
        limits: RiskLimits,
    ) -> Dict[str, Any]:
        alerts: List[Dict[str, Any]] = []

        # Gross leverage
        gross = sum(abs(p.get("market_value", 0)) for p in positions)
        gross_lev = gross / equity if equity > 0 else 0
        if gross_lev > limits.max_gross_leverage:
            alerts.append(RiskAlert(
                level=RiskLevel.HIGH, category="leverage",
                message=f"Gross leverage {gross_lev:.2f}x exceeds {limits.max_gross_leverage:.2f}x",
                value=gross_lev, limit=limits.max_gross_leverage,
            ).to_dict())

        # Concentration
        weights = [abs(p.get("market_value", 0)) / equity for p in positions] if equity > 0 else []
        hhi = sum(w ** 2 for w in weights) if weights else 0
        if hhi > limits.max_concentration_hhi:
            alerts.append(RiskAlert(
                level=RiskLevel.MEDIUM, category="concentration",
                message=f"HHI {hhi:.4f} exceeds limit {limits.max_concentration_hhi:.4f}",
                value=hhi, limit=limits.max_concentration_hhi,
            ).to_dict())

        # Individual position limits
        for pos in positions:
            mv = abs(pos.get("market_value", 0))
            pct = mv / equity if equity > 0 else 0
            if pct > limits.max_position_size_pct:
                alerts.append(RiskAlert(
                    level=RiskLevel.MEDIUM, category="position_size",
                    message=f"{pos.get('symbol', '?')}: {pct:.1%} exceeds limit {limits.max_position_size_pct:.1%}",
                    value=pct, limit=limits.max_position_size_pct,
                ).to_dict())

        # Sector exposure
        sectors: Dict[str, float] = {}
        for pos in positions:
            s = pos.get("sector", "Unknown")
            sectors[s] = sectors.get(s, 0) + abs(pos.get("market_value", 0))
        for sector, exp in sectors.items():
            pct = exp / equity if equity > 0 else 0
            if pct > limits.max_sector_exposure_pct:
                alerts.append(RiskAlert(
                    level=RiskLevel.MEDIUM, category="sector_exposure",
                    message=f"Sector '{sector}': {pct:.1%} exceeds {limits.max_sector_exposure_pct:.1%}",
                    value=pct, limit=limits.max_sector_exposure_pct,
                ).to_dict())

        return {
            "compliant": len(alerts) == 0,
            "alert_count": len(alerts),
            "alerts": alerts,
            "gross_leverage": round(gross_lev, 4),
            "hhi": round(hhi, 6),
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  RiskReporter
# ═══════════════════════════════════════════════════════════════════════════════

class RiskReporter:
    """Aggregate risk dashboard."""

    @staticmethod
    def daily_risk_report(
        positions: List[Dict[str, Any]],
        equity: float,
        returns: pd.Series,
        limits: RiskLimits,
        greeks: Optional[GreeksSnapshot] = None,
    ) -> Dict[str, Any]:
        from phase1.services.portfolio_analytics_engine import (
            PerformanceEngine, DrawdownAnalyzer,
        )

        report: Dict[str, Any] = {"timestamp": datetime.now(timezone.utc).isoformat()}

        # P&L summary
        gross = sum(abs(p.get("market_value", 0)) for p in positions)
        long_exp = sum(p.get("market_value", 0) for p in positions if p.get("side") == "long")
        short_exp = abs(sum(p.get("market_value", 0) for p in positions if p.get("side") == "short"))
        report["exposure"] = {
            "gross": round(gross, 2), "long": round(long_exp, 2),
            "short": round(short_exp, 2), "net": round(long_exp - short_exp, 2),
            "leverage": round(gross / equity, 4) if equity > 0 else 0,
        }

        # VaR/CVaR
        if len(returns) > 10:
            report["risk_metrics"] = {
                "var_95": round(PerformanceEngine.var_historical(returns, 0.95), 6),
                "var_99": round(PerformanceEngine.var_historical(returns, 0.99), 6),
                "cvar_95": round(PerformanceEngine.cvar(returns, 0.95), 6),
                "volatility": round(PerformanceEngine.annualized_volatility(returns), 6),
                "max_drawdown": round(DrawdownAnalyzer.max_drawdown(returns), 6),
            }
        else:
            report["risk_metrics"] = {}

        # Greeks
        if greeks:
            report["greeks"] = greeks.to_dict()

        # Compliance
        compliance = ComplianceChecker.portfolio_compliance(positions, equity, limits)
        report["compliance"] = compliance

        # Position summary
        report["position_count"] = len(positions)
        report["total_equity"] = round(equity, 2)

        return report


# ═══════════════════════════════════════════════════════════════════════════════
#  CorrelationRisk
# ═══════════════════════════════════════════════════════════════════════════════

class CorrelationRisk:
    """Correlation regime analysis and diversification metrics."""

    @staticmethod
    def diversification_ratio(weights: np.ndarray, cov_matrix: np.ndarray) -> float:
        vols = np.sqrt(np.diag(cov_matrix))
        weighted_vol = weights @ vols
        port_vol = np.sqrt(weights @ cov_matrix @ weights)
        if port_vol == 0:
            return 1.0
        return float(weighted_vol / port_vol)

    @staticmethod
    def effective_correlation(weights: np.ndarray, cov_matrix: np.ndarray) -> float:
        dr = CorrelationRisk.diversification_ratio(weights, cov_matrix)
        n = len(weights)
        if n <= 1:
            return 0.0
        rho_eff = (dr ** 2 - 1) / (n - 1)
        return max(-1, min(1, float(rho_eff)))

    @staticmethod
    def correlation_regime(returns: pd.DataFrame, window: int = 60) -> pd.Series:
        """Rolling average pairwise correlation."""
        n_assets = returns.shape[1]
        if n_assets < 2:
            return pd.Series(dtype=float)
        result = pd.Series(index=returns.index, dtype=float)
        for i in range(window, len(returns)):
            window_data = returns.iloc[i - window:i]
            corr = window_data.corr()
            mask = np.triu(np.ones(corr.shape, dtype=bool), k=1)
            avg_corr = corr.values[mask].mean()
            result.iloc[i] = avg_corr
        return result

    @staticmethod
    def crowded_trade_score(returns: pd.DataFrame, threshold: float = 0.80,
                            window: int = 60) -> Dict[str, Any]:
        """Detect crowded trades — highly correlated positions."""
        if len(returns) < window or returns.shape[1] < 2:
            return {"score": 0, "pairs": []}
        recent = returns.iloc[-window:]
        corr = recent.corr()
        pairs = []
        cols = corr.columns
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                c = corr.iloc[i, j]
                if abs(c) >= threshold:
                    pairs.append({
                        "a": cols[i], "b": cols[j],
                        "correlation": round(c, 4),
                    })
        score = len(pairs) / max(1, len(cols) * (len(cols) - 1) / 2)
        return {"score": round(score, 4), "pairs": pairs, "threshold": threshold}


# ═══════════════════════════════════════════════════════════════════════════════
#  TailRisk
# ═══════════════════════════════════════════════════════════════════════════════

class TailRisk:
    """Extreme value theory, tail analysis."""

    @staticmethod
    def tail_ratio(returns: pd.Series, percentile: float = 5) -> float:
        right = np.percentile(returns, 100 - percentile)
        left = abs(np.percentile(returns, percentile))
        if left == 0:
            return float('inf') if right > 0 else 0.0
        return float(right / left)

    @staticmethod
    def gain_to_pain(returns: pd.Series) -> float:
        total_return = returns.sum()
        pain = returns[returns < 0].abs().sum()
        if pain == 0:
            return float('inf') if total_return > 0 else 0.0
        return float(total_return / pain)

    @staticmethod
    def tail_dependence(returns_a: pd.Series, returns_b: pd.Series,
                        threshold_pct: float = 5) -> Dict[str, float]:
        """Lower and upper tail dependence coefficients."""
        n = min(len(returns_a), len(returns_b))
        if n < 20:
            return {"lower": 0, "upper": 0}
        a = returns_a.iloc[:n]
        b = returns_b.iloc[:n]
        lower_thresh_a = np.percentile(a, threshold_pct)
        lower_thresh_b = np.percentile(b, threshold_pct)
        upper_thresh_a = np.percentile(a, 100 - threshold_pct)
        upper_thresh_b = np.percentile(b, 100 - threshold_pct)
        lower_both = ((a <= lower_thresh_a) & (b <= lower_thresh_b)).sum()
        lower_a = (a <= lower_thresh_a).sum()
        upper_both = ((a >= upper_thresh_a) & (b >= upper_thresh_b)).sum()
        upper_a = (a >= upper_thresh_a).sum()
        return {
            "lower": round(lower_both / lower_a, 4) if lower_a > 0 else 0,
            "upper": round(upper_both / upper_a, 4) if upper_a > 0 else 0,
        }

    @staticmethod
    def crash_probability(returns: pd.Series, threshold: float = -0.10,
                          window: int = 252) -> float:
        """Probability of a crash (return < threshold) in the given window."""
        if len(returns) < window:
            return 0.0
        crash_count = 0
        for i in range(len(returns) - window + 1):
            window_return = (1 + returns.iloc[i:i + window]).prod() - 1
            if window_return < threshold:
                crash_count += 1
        return crash_count / (len(returns) - window + 1)

    @staticmethod
    def expected_shortfall_decomposition(returns: pd.DataFrame, weights: np.ndarray,
                                         confidence: float = 0.95) -> Dict[str, Any]:
        port_returns = returns.values @ weights
        var = float(np.percentile(port_returns, (1 - confidence) * 100))
        tail_mask = port_returns <= var
        if not tail_mask.any():
            return {"total_es": 0, "contributions": {}}
        tail_returns = returns.values[tail_mask]
        es = float(port_returns[tail_mask].mean())
        contributions = {}
        for i, col in enumerate(returns.columns):
            comp_es = float(tail_returns[:, i].mean() * weights[i])
            contributions[col] = round(comp_es, 6)
        return {"total_es": round(es, 6), "contributions": contributions}


# ═══════════════════════════════════════════════════════════════════════════════
#  LiquidityRisk
# ═══════════════════════════════════════════════════════════════════════════════

class LiquidityRisk:
    """Position liquidity and market impact estimation."""

    @staticmethod
    def days_to_liquidate(position_size: float, avg_daily_volume: float,
                          participation_rate: float = 0.10) -> float:
        allowable_volume = avg_daily_volume * participation_rate
        if allowable_volume == 0:
            return float('inf')
        return position_size / allowable_volume

    @staticmethod
    def market_impact_estimate(position_size: float, avg_daily_volume: float,
                               spread_bps: float = 5.0, price: float = 100.0,
                               volatility: float = 0.20) -> Dict[str, float]:
        if avg_daily_volume == 0:
            return {"temporary_impact": 0, "permanent_impact": 0, "total_cost": 0}
        participation = position_size / avg_daily_volume
        half_spread = spread_bps / 10000 / 2
        temporary = half_spread + 0.5 * volatility * np.sqrt(participation)
        permanent = 0.1 * volatility * participation
        total_cost = (temporary + permanent) * position_size * price
        return {
            "temporary_impact_bps": round(temporary * 10000, 2),
            "permanent_impact_bps": round(permanent * 10000, 2),
            "total_impact_bps": round((temporary + permanent) * 10000, 2),
            "total_cost": round(total_cost, 2),
            "participation_rate": round(participation, 4),
        }

    @staticmethod
    def liquidity_score(avg_volume: float, spread_bps: float,
                        market_cap: float = 0.0) -> float:
        vol_score = min(1, avg_volume / 1_000_000)
        spread_score = max(0, 1 - spread_bps / 100)
        cap_score = min(1, market_cap / 10_000_000_000) if market_cap > 0 else 0.5
        return round(vol_score * 0.4 + spread_score * 0.3 + cap_score * 0.3, 4)

    @staticmethod
    def portfolio_liquidity(positions: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not positions:
            return {"avg_days_to_liquidate": 0, "worst_position": "", "scores": []}
        results = []
        for pos in positions:
            size = abs(pos.get("quantity", 0))
            adv = pos.get("avg_daily_volume", 0)
            dtl = LiquidityRisk.days_to_liquidate(size, adv) if adv > 0 else float('inf')
            score = LiquidityRisk.liquidity_score(
                adv, pos.get("spread_bps", 10), pos.get("market_cap", 0)
            )
            results.append({
                "symbol": pos.get("symbol", "?"),
                "days_to_liquidate": round(dtl, 2) if dtl != float('inf') else None,
                "liquidity_score": score,
            })
        finite_dtl = [r["days_to_liquidate"] for r in results if r["days_to_liquidate"] is not None]
        avg_dtl = sum(finite_dtl) / len(finite_dtl) if finite_dtl else 0
        worst = max(results, key=lambda r: r["days_to_liquidate"] or 0)
        return {
            "avg_days_to_liquidate": round(avg_dtl, 2),
            "worst_position": worst["symbol"],
            "scores": results,
        }
