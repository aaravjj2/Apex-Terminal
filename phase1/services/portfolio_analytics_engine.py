"""
portfolio_analytics_engine.py — Portfolio Analytics & Performance Engine
========================================================================
Bloomberg-grade portfolio analytics: performance attribution, risk metrics,
drawdown analysis, factor exposure, position management, P&L decomposition,
Sharpe/Sortino/Calmar ratios, and portfolio optimization helpers.

Classes:
    Position         — Single position with P&L tracking
    Portfolio        — Collection of positions with aggregate metrics
    PerformanceEngine — Return/risk computations on time series
    DrawdownAnalyzer — Maximum drawdown, underwater curves, recovery analysis
    FactorModel      — Factor exposure, alpha/beta decomposition, style analysis
    PortfolioOptimizer — Mean-variance, risk-parity, max-Sharpe
    AttributionEngine — Brinson attribution, sector/security contribution
    RiskBudgeting    — Risk contribution, marginal risk, component VaR
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import math
import uuid

import numpy as np
import pandas as pd
from scipy import optimize as scipy_opt, stats as scipy_stats


# ═══════════════════════════════════════════════════════════════════════════════
#  Data Classes
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Position:
    """Single position with real-time P&L tracking."""
    symbol: str
    quantity: float = 0.0
    avg_cost: float = 0.0
    current_price: float = 0.0
    side: str = "long"  # long / short
    asset_class: str = "equity"
    sector: str = ""
    currency: str = "USD"
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    opened_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def market_value(self) -> float:
        mv = self.quantity * self.current_price
        return mv if self.side == "long" else -mv

    @property
    def cost_basis(self) -> float:
        return self.quantity * self.avg_cost

    @property
    def unrealized_pnl(self) -> float:
        if self.side == "long":
            return self.quantity * (self.current_price - self.avg_cost)
        return self.quantity * (self.avg_cost - self.current_price)

    @property
    def unrealized_pnl_pct(self) -> float:
        if self.cost_basis == 0:
            return 0.0
        return self.unrealized_pnl / abs(self.cost_basis) * 100

    @property
    def is_profitable(self) -> bool:
        return self.unrealized_pnl > 0

    def update_price(self, price: float) -> None:
        self.current_price = price

    def add_quantity(self, qty: float, price: float) -> None:
        total_cost = self.avg_cost * self.quantity + price * qty
        self.quantity += qty
        if self.quantity > 0:
            self.avg_cost = total_cost / self.quantity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "symbol": self.symbol, "quantity": self.quantity,
            "avg_cost": self.avg_cost, "current_price": self.current_price,
            "side": self.side, "asset_class": self.asset_class, "sector": self.sector,
            "currency": self.currency, "opened_at": self.opened_at,
            "market_value": self.market_value, "cost_basis": self.cost_basis,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": round(self.unrealized_pnl_pct, 4),
        }


@dataclass
class TradeRecord:
    """Completed trade for P&L history."""
    symbol: str
    side: str
    quantity: float
    entry_price: float
    exit_price: float
    entry_time: str
    exit_time: str
    pnl: float = 0.0
    pnl_pct: float = 0.0
    commission: float = 0.0
    id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def __post_init__(self):
        if self.pnl == 0.0 and self.entry_price > 0:
            if self.side == "long":
                self.pnl = self.quantity * (self.exit_price - self.entry_price) - self.commission
            else:
                self.pnl = self.quantity * (self.entry_price - self.exit_price) - self.commission
        if self.pnl_pct == 0.0 and self.entry_price > 0:
            self.pnl_pct = (self.exit_price / self.entry_price - 1) * 100
            if self.side == "short":
                self.pnl_pct = -self.pnl_pct


# ═══════════════════════════════════════════════════════════════════════════════
#  Portfolio
# ═══════════════════════════════════════════════════════════════════════════════

class Portfolio:
    """Position manager with aggregated metrics."""

    def __init__(self, name: str = "Default", initial_capital: float = 100000.0):
        self.name = name
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self._positions: Dict[str, Position] = {}
        self._closed_trades: List[TradeRecord] = []
        self._equity_curve: List[Tuple[str, float]] = []
        self._created_at = datetime.now(timezone.utc).isoformat()

    # ── Properties ──

    @property
    def positions(self) -> List[Position]:
        return list(self._positions.values())

    @property
    def position_count(self) -> int:
        return len(self._positions)

    @property
    def total_market_value(self) -> float:
        return sum(p.market_value for p in self._positions.values())

    @property
    def total_equity(self) -> float:
        return self.cash + self.total_market_value

    @property
    def total_unrealized_pnl(self) -> float:
        return sum(p.unrealized_pnl for p in self._positions.values())

    @property
    def total_realized_pnl(self) -> float:
        return sum(t.pnl for t in self._closed_trades)

    @property
    def total_pnl(self) -> float:
        return self.total_unrealized_pnl + self.total_realized_pnl

    @property
    def return_pct(self) -> float:
        if self.initial_capital == 0:
            return 0.0
        return (self.total_equity / self.initial_capital - 1) * 100

    @property
    def long_exposure(self) -> float:
        return sum(p.market_value for p in self._positions.values() if p.side == "long")

    @property
    def short_exposure(self) -> float:
        return abs(sum(p.market_value for p in self._positions.values() if p.side == "short"))

    @property
    def gross_exposure(self) -> float:
        return self.long_exposure + self.short_exposure

    @property
    def net_exposure(self) -> float:
        return self.long_exposure - self.short_exposure

    @property
    def leverage(self) -> float:
        if self.total_equity == 0:
            return 0.0
        return self.gross_exposure / self.total_equity

    # ── Position Management ──

    def open_position(self, symbol: str, quantity: float, price: float,
                      side: str = "long", asset_class: str = "equity",
                      sector: str = "", commission: float = 0.0) -> Position:
        cost = quantity * price + commission
        if side == "long":
            self.cash -= cost
        else:
            self.cash += quantity * price - commission
        pos = Position(
            symbol=symbol, quantity=quantity, avg_cost=price,
            current_price=price, side=side, asset_class=asset_class, sector=sector,
        )
        self._positions[pos.id] = pos
        return pos

    def close_position(self, position_id: str, price: float,
                       commission: float = 0.0) -> Optional[TradeRecord]:
        pos = self._positions.get(position_id)
        if not pos:
            return None
        if pos.side == "long":
            self.cash += pos.quantity * price - commission
        else:
            self.cash -= pos.quantity * price + commission
        trade = TradeRecord(
            symbol=pos.symbol, side=pos.side, quantity=pos.quantity,
            entry_price=pos.avg_cost, exit_price=price,
            entry_time=pos.opened_at,
            exit_time=datetime.now(timezone.utc).isoformat(),
            commission=commission,
        )
        self._closed_trades.append(trade)
        del self._positions[position_id]
        return trade

    def update_price(self, symbol: str, price: float) -> None:
        for pos in self._positions.values():
            if pos.symbol == symbol:
                pos.update_price(price)

    def update_prices(self, prices: Dict[str, float]) -> None:
        for symbol, price in prices.items():
            self.update_price(symbol, price)

    def record_equity(self) -> None:
        self._equity_curve.append(
            (datetime.now(timezone.utc).isoformat(), self.total_equity)
        )

    def get_position_by_symbol(self, symbol: str) -> Optional[Position]:
        for pos in self._positions.values():
            if pos.symbol == symbol:
                return pos
        return None

    # ── Sector/Asset Breakdown ──

    def sector_exposure(self) -> Dict[str, float]:
        sectors: Dict[str, float] = {}
        for pos in self._positions.values():
            s = pos.sector or "Unknown"
            sectors[s] = sectors.get(s, 0) + pos.market_value
        return sectors

    def asset_class_exposure(self) -> Dict[str, float]:
        classes: Dict[str, float] = {}
        for pos in self._positions.values():
            ac = pos.asset_class or "Unknown"
            classes[ac] = classes.get(ac, 0) + pos.market_value
        return classes

    def concentration(self, top_n: int = 5) -> Dict[str, Any]:
        weights = []
        te = self.total_equity
        if te == 0:
            return {"top_positions": [], "hhi": 0, "top_n_weight": 0}
        for pos in self._positions.values():
            w = abs(pos.market_value) / te
            weights.append({"symbol": pos.symbol, "weight": w, "market_value": pos.market_value})
        weights.sort(key=lambda x: abs(x["weight"]), reverse=True)
        all_weights = [abs(pos.market_value) / te for pos in self._positions.values()]
        hhi = sum(w ** 2 for w in all_weights)
        top_weight = sum(w["weight"] for w in weights[:top_n])
        return {"top_positions": weights[:top_n], "hhi": round(hhi, 6), "top_n_weight": round(top_weight, 4)}

    # ── Summary ──

    def summary(self) -> Dict[str, Any]:
        return {
            "name": self.name, "initial_capital": self.initial_capital,
            "cash": round(self.cash, 2), "total_equity": round(self.total_equity, 2),
            "market_value": round(self.total_market_value, 2),
            "unrealized_pnl": round(self.total_unrealized_pnl, 2),
            "realized_pnl": round(self.total_realized_pnl, 2),
            "total_pnl": round(self.total_pnl, 2),
            "return_pct": round(self.return_pct, 4),
            "position_count": self.position_count,
            "closed_trades": len(self._closed_trades),
            "long_exposure": round(self.long_exposure, 2),
            "short_exposure": round(self.short_exposure, 2),
            "gross_exposure": round(self.gross_exposure, 2),
            "net_exposure": round(self.net_exposure, 2),
            "leverage": round(self.leverage, 4),
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  PerformanceEngine
# ═══════════════════════════════════════════════════════════════════════════════

class PerformanceEngine:
    """Return and risk metrics on equity/return time series."""

    @staticmethod
    def returns(prices: pd.Series) -> pd.Series:
        return prices.pct_change().dropna()

    @staticmethod
    def log_returns(prices: pd.Series) -> pd.Series:
        return np.log(prices / prices.shift(1)).dropna()

    @staticmethod
    def cumulative_returns(returns: pd.Series) -> pd.Series:
        return (1 + returns).cumprod() - 1

    @staticmethod
    def annualized_return(returns: pd.Series, periods_per_year: int = 252) -> float:
        if len(returns) == 0:
            return 0.0
        total = (1 + returns).prod()
        n_years = len(returns) / periods_per_year
        if n_years <= 0:
            return 0.0
        return float(total ** (1 / n_years) - 1)

    @staticmethod
    def annualized_volatility(returns: pd.Series, periods_per_year: int = 252) -> float:
        if len(returns) < 2:
            return 0.0
        return float(returns.std() * np.sqrt(periods_per_year))

    @staticmethod
    def sharpe_ratio(returns: pd.Series, risk_free_rate: float = 0.0,
                     periods_per_year: int = 252) -> float:
        ann_ret = PerformanceEngine.annualized_return(returns, periods_per_year)
        ann_vol = PerformanceEngine.annualized_volatility(returns, periods_per_year)
        if ann_vol == 0:
            return 0.0
        return (ann_ret - risk_free_rate) / ann_vol

    @staticmethod
    def sortino_ratio(returns: pd.Series, risk_free_rate: float = 0.0,
                      periods_per_year: int = 252) -> float:
        ann_ret = PerformanceEngine.annualized_return(returns, periods_per_year)
        downside = returns[returns < 0]
        if len(downside) < 2:
            return 0.0
        downside_vol = float(downside.std() * np.sqrt(periods_per_year))
        if downside_vol == 0:
            return 0.0
        return (ann_ret - risk_free_rate) / downside_vol

    @staticmethod
    def calmar_ratio(returns: pd.Series, periods_per_year: int = 252) -> float:
        ann_ret = PerformanceEngine.annualized_return(returns, periods_per_year)
        dd = DrawdownAnalyzer.max_drawdown(returns)
        if dd == 0:
            return 0.0
        return ann_ret / abs(dd)

    @staticmethod
    def omega_ratio(returns: pd.Series, threshold: float = 0.0) -> float:
        gains = returns[returns > threshold] - threshold
        losses = threshold - returns[returns <= threshold]
        loss_sum = losses.sum()
        if loss_sum == 0:
            return float('inf') if gains.sum() > 0 else 0.0
        return float(gains.sum() / loss_sum)

    @staticmethod
    def information_ratio(returns: pd.Series, benchmark_returns: pd.Series,
                          periods_per_year: int = 252) -> float:
        excess = returns - benchmark_returns
        if len(excess) < 2:
            return 0.0
        ann_excess = PerformanceEngine.annualized_return(excess, periods_per_year)
        tracking_error = float(excess.std() * np.sqrt(periods_per_year))
        if tracking_error == 0:
            return 0.0
        return ann_excess / tracking_error

    @staticmethod
    def var_historical(returns: pd.Series, confidence: float = 0.95) -> float:
        if len(returns) == 0:
            return 0.0
        return float(np.percentile(returns, (1 - confidence) * 100))

    @staticmethod
    def var_parametric(returns: pd.Series, confidence: float = 0.95) -> float:
        if len(returns) < 2:
            return 0.0
        mu = returns.mean()
        sigma = returns.std()
        z = scipy_stats.norm.ppf(1 - confidence)
        return float(mu + z * sigma)

    @staticmethod
    def cvar(returns: pd.Series, confidence: float = 0.95) -> float:
        var = PerformanceEngine.var_historical(returns, confidence)
        tail = returns[returns <= var]
        if len(tail) == 0:
            return var
        return float(tail.mean())

    @staticmethod
    def win_rate(trades: List[TradeRecord]) -> float:
        if not trades:
            return 0.0
        winners = sum(1 for t in trades if t.pnl > 0)
        return winners / len(trades) * 100

    @staticmethod
    def profit_factor(trades: List[TradeRecord]) -> float:
        gross_profit = sum(t.pnl for t in trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in trades if t.pnl < 0))
        if gross_loss == 0:
            return float('inf') if gross_profit > 0 else 0.0
        return gross_profit / gross_loss

    @staticmethod
    def avg_win_loss_ratio(trades: List[TradeRecord]) -> float:
        winners = [t.pnl for t in trades if t.pnl > 0]
        losers = [abs(t.pnl) for t in trades if t.pnl < 0]
        avg_win = np.mean(winners) if winners else 0.0
        avg_loss = np.mean(losers) if losers else 0.0
        if avg_loss == 0:
            return float('inf') if avg_win > 0 else 0.0
        return float(avg_win / avg_loss)

    @staticmethod
    def expectancy(trades: List[TradeRecord]) -> float:
        if not trades:
            return 0.0
        return sum(t.pnl for t in trades) / len(trades)

    @staticmethod
    def kelly_criterion(trades: List[TradeRecord]) -> float:
        wr = PerformanceEngine.win_rate(trades) / 100
        ratio = PerformanceEngine.avg_win_loss_ratio(trades)
        if ratio == 0 or ratio == float('inf'):
            return 0.0
        return wr - (1 - wr) / ratio

    @staticmethod
    def rolling_sharpe(returns: pd.Series, window: int = 60,
                       periods_per_year: int = 252) -> pd.Series:
        rolling_mean = returns.rolling(window).mean()
        rolling_std = returns.rolling(window).std()
        return (rolling_mean * np.sqrt(periods_per_year)) / rolling_std

    @staticmethod
    def monthly_returns_table(returns: pd.Series, dates: pd.DatetimeIndex) -> pd.DataFrame:
        df = pd.DataFrame({"return": returns.values}, index=dates[:len(returns)])
        df["year"] = df.index.year
        df["month"] = df.index.month
        monthly = df.groupby(["year", "month"])["return"].apply(lambda x: (1 + x).prod() - 1)
        return monthly.unstack(level="month").fillna(0)

    @staticmethod
    def full_report(returns: pd.Series, benchmark: Optional[pd.Series] = None,
                    risk_free_rate: float = 0.0, trades: Optional[List[TradeRecord]] = None) -> Dict[str, Any]:
        report: Dict[str, Any] = {
            "total_return": float((1 + returns).prod() - 1) if len(returns) > 0 else 0.0,
            "annualized_return": PerformanceEngine.annualized_return(returns),
            "annualized_volatility": PerformanceEngine.annualized_volatility(returns),
            "sharpe_ratio": PerformanceEngine.sharpe_ratio(returns, risk_free_rate),
            "sortino_ratio": PerformanceEngine.sortino_ratio(returns, risk_free_rate),
            "calmar_ratio": PerformanceEngine.calmar_ratio(returns),
            "omega_ratio": PerformanceEngine.omega_ratio(returns),
            "max_drawdown": DrawdownAnalyzer.max_drawdown(returns),
            "var_95": PerformanceEngine.var_historical(returns, 0.95),
            "cvar_95": PerformanceEngine.cvar(returns, 0.95),
            "skewness": float(returns.skew()) if len(returns) > 2 else 0.0,
            "kurtosis": float(returns.kurtosis()) if len(returns) > 3 else 0.0,
            "best_day": float(returns.max()) if len(returns) > 0 else 0.0,
            "worst_day": float(returns.min()) if len(returns) > 0 else 0.0,
            "positive_days": int((returns > 0).sum()),
            "negative_days": int((returns < 0).sum()),
            "total_days": len(returns),
        }
        if benchmark is not None and len(benchmark) == len(returns):
            report["information_ratio"] = PerformanceEngine.information_ratio(returns, benchmark)
            report["beta"] = float(
                np.cov(returns, benchmark)[0][1] / np.var(benchmark)
            ) if np.var(benchmark) > 0 else 0.0
            report["alpha"] = report["annualized_return"] - report["beta"] * PerformanceEngine.annualized_return(benchmark)
        if trades:
            report["win_rate"] = PerformanceEngine.win_rate(trades)
            report["profit_factor"] = PerformanceEngine.profit_factor(trades)
            report["avg_win_loss_ratio"] = PerformanceEngine.avg_win_loss_ratio(trades)
            report["expectancy"] = PerformanceEngine.expectancy(trades)
            report["kelly_criterion"] = PerformanceEngine.kelly_criterion(trades)
            report["total_trades"] = len(trades)
        return report


# ═══════════════════════════════════════════════════════════════════════════════
#  DrawdownAnalyzer
# ═══════════════════════════════════════════════════════════════════════════════

class DrawdownAnalyzer:
    """Max drawdown, underwater curves, recovery analysis."""

    @staticmethod
    def max_drawdown(returns: pd.Series) -> float:
        if len(returns) == 0:
            return 0.0
        cum = (1 + returns).cumprod()
        peak = cum.cummax()
        dd = (cum - peak) / peak
        return float(dd.min())

    @staticmethod
    def drawdown_series(returns: pd.Series) -> pd.Series:
        cum = (1 + returns).cumprod()
        peak = cum.cummax()
        return (cum - peak) / peak

    @staticmethod
    def underwater_curve(returns: pd.Series) -> pd.Series:
        return DrawdownAnalyzer.drawdown_series(returns)

    @staticmethod
    def drawdown_periods(returns: pd.Series, top_n: int = 5) -> List[Dict[str, Any]]:
        dd = DrawdownAnalyzer.drawdown_series(returns)
        periods = []
        in_dd = False
        start_idx = 0
        for i in range(len(dd)):
            if dd.iloc[i] < 0 and not in_dd:
                in_dd = True
                start_idx = i
            elif dd.iloc[i] >= 0 and in_dd:
                in_dd = False
                min_dd = dd.iloc[start_idx:i].min()
                min_idx = dd.iloc[start_idx:i].idxmin()
                periods.append({
                    "start": start_idx,
                    "trough": min_idx if isinstance(min_idx, int) else dd.iloc[start_idx:i].values.argmin() + start_idx,
                    "end": i,
                    "depth": float(min_dd),
                    "length": i - start_idx,
                    "recovery": i - (min_idx if isinstance(min_idx, int) else dd.iloc[start_idx:i].values.argmin() + start_idx),
                })
        if in_dd:
            min_dd = dd.iloc[start_idx:].min()
            periods.append({
                "start": start_idx, "trough": len(dd) - 1,
                "end": None, "depth": float(min_dd),
                "length": len(dd) - start_idx, "recovery": None,
            })
        periods.sort(key=lambda x: x["depth"])
        return periods[:top_n]

    @staticmethod
    def time_to_recovery(returns: pd.Series) -> Optional[int]:
        dd = DrawdownAnalyzer.drawdown_series(returns)
        max_dd_idx = dd.idxmin()
        if isinstance(max_dd_idx, int):
            idx = max_dd_idx
        else:
            idx = dd.values.argmin()
        for i in range(idx, len(dd)):
            if dd.iloc[i] >= 0:
                return i - idx
        return None

    @staticmethod
    def calmar_series(returns: pd.Series, window: int = 252) -> pd.Series:
        result = pd.Series(index=returns.index, dtype=float)
        for i in range(window, len(returns)):
            window_ret = returns.iloc[i - window:i]
            ann_ret = PerformanceEngine.annualized_return(window_ret)
            dd = DrawdownAnalyzer.max_drawdown(window_ret)
            result.iloc[i] = ann_ret / abs(dd) if dd != 0 else 0.0
        return result

    @staticmethod
    def pain_index(returns: pd.Series) -> float:
        dd = DrawdownAnalyzer.drawdown_series(returns)
        return float(dd.abs().mean())

    @staticmethod
    def ulcer_index(returns: pd.Series) -> float:
        dd = DrawdownAnalyzer.drawdown_series(returns)
        return float(np.sqrt((dd ** 2).mean()))


# ═══════════════════════════════════════════════════════════════════════════════
#  FactorModel
# ═══════════════════════════════════════════════════════════════════════════════

class FactorModel:
    """Factor exposure, alpha/beta decomposition, style analysis."""

    @staticmethod
    def single_factor(returns: pd.Series, factor: pd.Series) -> Dict[str, float]:
        if len(returns) < 3 or len(factor) < 3:
            return {"alpha": 0, "beta": 0, "r_squared": 0, "residual_vol": 0}
        aligned = pd.DataFrame({"r": returns, "f": factor}).dropna()
        if len(aligned) < 3:
            return {"alpha": 0, "beta": 0, "r_squared": 0, "residual_vol": 0}
        slope, intercept, r_value, p_value, std_err = scipy_stats.linregress(
            aligned["f"], aligned["r"]
        )
        residuals = aligned["r"] - (intercept + slope * aligned["f"])
        return {
            "alpha": float(intercept * 252),
            "beta": float(slope),
            "r_squared": float(r_value ** 2),
            "residual_vol": float(residuals.std() * np.sqrt(252)),
            "p_value": float(p_value),
            "std_error": float(std_err),
        }

    @staticmethod
    def multi_factor(returns: pd.Series, factors: pd.DataFrame) -> Dict[str, Any]:
        if len(returns) < 5:
            return {"alpha": 0, "betas": {}, "r_squared": 0}
        aligned = pd.concat([returns.rename("r"), factors], axis=1).dropna()
        if len(aligned) < 5:
            return {"alpha": 0, "betas": {}, "r_squared": 0}
        y = aligned["r"].values
        X = aligned.drop(columns=["r"]).values
        X_aug = np.column_stack([np.ones(len(X)), X])
        try:
            betas, residuals, rank, sv = np.linalg.lstsq(X_aug, y, rcond=None)
        except np.linalg.LinAlgError:
            return {"alpha": 0, "betas": {}, "r_squared": 0}
        y_pred = X_aug @ betas
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - y.mean()) ** 2)
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
        factor_names = [c for c in aligned.columns if c != "r"]
        return {
            "alpha": float(betas[0] * 252),
            "betas": {name: float(betas[i + 1]) for i, name in enumerate(factor_names)},
            "r_squared": float(r2),
            "adj_r_squared": float(1 - (1 - r2) * (len(y) - 1) / max(len(y) - len(betas), 1)),
        }

    @staticmethod
    def rolling_beta(returns: pd.Series, benchmark: pd.Series,
                     window: int = 60) -> pd.Series:
        result = pd.Series(index=returns.index, dtype=float)
        for i in range(window, len(returns)):
            r = returns.iloc[i - window:i]
            b = benchmark.iloc[i - window:i]
            cov = np.cov(r, b)
            var_b = cov[1][1]
            result.iloc[i] = cov[0][1] / var_b if var_b > 0 else 0
        return result

    @staticmethod
    def style_analysis(returns: pd.Series, style_indices: pd.DataFrame) -> Dict[str, float]:
        """Sharpe style analysis — constrained regression (weights sum to 1, non-negative)."""
        aligned = pd.concat([returns.rename("r"), style_indices], axis=1).dropna()
        if len(aligned) < 10:
            return {}
        y = aligned["r"].values
        X = aligned.drop(columns=["r"]).values
        n_factors = X.shape[1]

        def objective(w):
            return np.sum((y - X @ w) ** 2)

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0, 1)] * n_factors
        w0 = np.ones(n_factors) / n_factors
        result = scipy_opt.minimize(objective, w0, bounds=bounds, constraints=constraints,
                                    method="SLSQP")
        names = [c for c in aligned.columns if c != "r"]
        return {name: float(result.x[i]) for i, name in enumerate(names)}


# ═══════════════════════════════════════════════════════════════════════════════
#  PortfolioOptimizer
# ═══════════════════════════════════════════════════════════════════════════════

class PortfolioOptimizer:
    """Mean-variance, risk-parity, max-Sharpe optimization."""

    @staticmethod
    def mean_variance(returns: pd.DataFrame, target_return: Optional[float] = None,
                      risk_free_rate: float = 0.0) -> Dict[str, Any]:
        mu = returns.mean() * 252
        cov = returns.cov() * 252
        n = len(mu)

        def neg_sharpe(w):
            port_ret = w @ mu
            port_vol = np.sqrt(w @ cov.values @ w)
            return -(port_ret - risk_free_rate) / port_vol if port_vol > 0 else 0

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        if target_return is not None:
            constraints.append({"type": "eq", "fun": lambda w: w @ mu - target_return})
        bounds = [(0, 1)] * n
        w0 = np.ones(n) / n
        result = scipy_opt.minimize(neg_sharpe, w0, bounds=bounds,
                                    constraints=constraints, method="SLSQP")
        weights = result.x
        port_ret = float(weights @ mu)
        port_vol = float(np.sqrt(weights @ cov.values @ weights))
        return {
            "weights": {col: float(weights[i]) for i, col in enumerate(returns.columns)},
            "expected_return": port_ret,
            "volatility": port_vol,
            "sharpe_ratio": (port_ret - risk_free_rate) / port_vol if port_vol > 0 else 0,
        }

    @staticmethod
    def min_variance(returns: pd.DataFrame) -> Dict[str, Any]:
        cov = returns.cov() * 252
        n = len(cov)

        def variance(w):
            return w @ cov.values @ w

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0, 1)] * n
        w0 = np.ones(n) / n
        result = scipy_opt.minimize(variance, w0, bounds=bounds,
                                    constraints=constraints, method="SLSQP")
        weights = result.x
        mu = returns.mean() * 252
        port_ret = float(weights @ mu)
        port_vol = float(np.sqrt(weights @ cov.values @ weights))
        return {
            "weights": {col: float(weights[i]) for i, col in enumerate(returns.columns)},
            "expected_return": port_ret,
            "volatility": port_vol,
        }

    @staticmethod
    def risk_parity(returns: pd.DataFrame) -> Dict[str, Any]:
        cov = returns.cov() * 252
        n = len(cov)

        def risk_budget_objective(w):
            port_vol = np.sqrt(w @ cov.values @ w)
            if port_vol == 0:
                return 0
            marginal = cov.values @ w
            risk_contrib = w * marginal / port_vol
            target = port_vol / n
            return np.sum((risk_contrib - target) ** 2)

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0.01, 1)] * n
        w0 = np.ones(n) / n
        result = scipy_opt.minimize(risk_budget_objective, w0, bounds=bounds,
                                    constraints=constraints, method="SLSQP")
        weights = result.x
        mu = returns.mean() * 252
        port_vol = float(np.sqrt(weights @ cov.values @ weights))
        marginal = cov.values @ weights
        risk_contrib = weights * marginal / port_vol if port_vol > 0 else np.zeros(n)
        return {
            "weights": {col: float(weights[i]) for i, col in enumerate(returns.columns)},
            "expected_return": float(weights @ mu),
            "volatility": port_vol,
            "risk_contributions": {col: float(risk_contrib[i]) for i, col in enumerate(returns.columns)},
        }

    @staticmethod
    def efficient_frontier(returns: pd.DataFrame, n_points: int = 50,
                           risk_free_rate: float = 0.0) -> List[Dict[str, float]]:
        mu = returns.mean() * 252
        min_ret = float(mu.min())
        max_ret = float(mu.max())
        targets = np.linspace(min_ret, max_ret, n_points)
        frontier = []
        for target in targets:
            try:
                result = PortfolioOptimizer.mean_variance(returns, target_return=target,
                                                          risk_free_rate=risk_free_rate)
                frontier.append({
                    "return": result["expected_return"],
                    "volatility": result["volatility"],
                    "sharpe": result["sharpe_ratio"],
                })
            except Exception:
                continue
        return frontier


# ═══════════════════════════════════════════════════════════════════════════════
#  AttributionEngine
# ═══════════════════════════════════════════════════════════════════════════════

class AttributionEngine:
    """Brinson attribution, sector/security contribution analysis."""

    @staticmethod
    def brinson_attribution(
        portfolio_weights: pd.Series,
        benchmark_weights: pd.Series,
        portfolio_returns: pd.Series,
        benchmark_returns: pd.Series,
    ) -> Dict[str, Any]:
        """Brinson-Fachler single-period attribution."""
        sectors = portfolio_weights.index.union(benchmark_weights.index)
        pw = portfolio_weights.reindex(sectors, fill_value=0)
        bw = benchmark_weights.reindex(sectors, fill_value=0)
        pr = portfolio_returns.reindex(sectors, fill_value=0)
        br = benchmark_returns.reindex(sectors, fill_value=0)

        total_br = float((bw * br).sum())
        allocation = (pw - bw) * (br - total_br)
        selection = bw * (pr - br)
        interaction = (pw - bw) * (pr - br)
        total_effect = allocation + selection + interaction

        detail = {}
        for s in sectors:
            detail[s] = {
                "allocation": float(allocation[s]),
                "selection": float(selection[s]),
                "interaction": float(interaction[s]),
                "total": float(total_effect[s]),
            }

        return {
            "total_allocation": float(allocation.sum()),
            "total_selection": float(selection.sum()),
            "total_interaction": float(interaction.sum()),
            "active_return": float(total_effect.sum()),
            "detail": detail,
        }

    @staticmethod
    def security_contribution(weights: pd.Series, returns: pd.Series) -> pd.DataFrame:
        contribution = weights * returns
        total = contribution.sum()
        df = pd.DataFrame({
            "weight": weights,
            "return": returns,
            "contribution": contribution,
            "pct_of_total": contribution / total * 100 if total != 0 else 0,
        })
        return df.sort_values("contribution", ascending=False)


# ═══════════════════════════════════════════════════════════════════════════════
#  RiskBudgeting
# ═══════════════════════════════════════════════════════════════════════════════

class RiskBudgeting:
    """Risk contribution, marginal risk, component VaR."""

    @staticmethod
    def risk_contributions(weights: np.ndarray, cov_matrix: np.ndarray) -> Dict[str, Any]:
        port_vol = np.sqrt(weights @ cov_matrix @ weights)
        if port_vol == 0:
            return {"total_risk": 0, "contributions": [], "pct_contributions": []}
        marginal = cov_matrix @ weights / port_vol
        component = weights * marginal
        return {
            "total_risk": float(port_vol),
            "marginal_risk": marginal.tolist(),
            "contributions": component.tolist(),
            "pct_contributions": (component / port_vol * 100).tolist(),
        }

    @staticmethod
    def component_var(weights: np.ndarray, cov_matrix: np.ndarray,
                      confidence: float = 0.95, portfolio_value: float = 1.0) -> Dict[str, Any]:
        port_vol = np.sqrt(weights @ cov_matrix @ weights)
        z = scipy_stats.norm.ppf(confidence)
        total_var = z * port_vol * portfolio_value
        if port_vol == 0:
            return {"total_var": 0, "component_var": []}
        marginal = cov_matrix @ weights / port_vol
        comp_var = weights * marginal * z * portfolio_value
        return {
            "total_var": float(total_var),
            "component_var": comp_var.tolist(),
            "pct_contribution": (comp_var / total_var * 100).tolist() if total_var > 0 else [],
        }

    @staticmethod
    def marginal_var(weights: np.ndarray, cov_matrix: np.ndarray,
                     confidence: float = 0.95) -> np.ndarray:
        port_vol = np.sqrt(weights @ cov_matrix @ weights)
        z = scipy_stats.norm.ppf(confidence)
        if port_vol == 0:
            return np.zeros_like(weights)
        return z * cov_matrix @ weights / port_vol

    @staticmethod
    def stress_test(returns: pd.DataFrame, scenarios: Dict[str, Dict[str, float]],
                    weights: np.ndarray) -> Dict[str, float]:
        """Apply predefined stress scenarios."""
        results = {}
        for name, shocks in scenarios.items():
            port_return = 0.0
            for i, col in enumerate(returns.columns):
                shock = shocks.get(col, 0.0)
                port_return += weights[i] * shock
            results[name] = float(port_return)
        return results

    @staticmethod
    def monte_carlo_var(returns: pd.DataFrame, weights: np.ndarray,
                        n_simulations: int = 10000, horizon: int = 1,
                        confidence: float = 0.95,
                        seed: int = 42) -> Dict[str, float]:
        rng = np.random.RandomState(seed)
        mu = returns.mean().values
        cov = returns.cov().values
        sims = rng.multivariate_normal(mu * horizon, cov * horizon, n_simulations)
        port_returns = sims @ weights
        var = float(np.percentile(port_returns, (1 - confidence) * 100))
        cvar = float(port_returns[port_returns <= var].mean()) if (port_returns <= var).any() else var
        return {
            "var": var,
            "cvar": cvar,
            "mean": float(port_returns.mean()),
            "median": float(np.median(port_returns)),
            "std": float(port_returns.std()),
            "worst": float(port_returns.min()),
            "best": float(port_returns.max()),
            "simulations": n_simulations,
        }
