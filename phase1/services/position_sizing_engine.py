"""
Position Sizing Engine
========================
Industrial-grade position sizing for Apex Terminal.

Kelly criterion, fixed fractional, percent risk, volatility-based,
optimal-f, anti-martingale, CPR (constant proportion), portfolio
heat, max drawdown constraint, margin-aware sizing, multi-asset
allocation.
"""

from __future__ import annotations
import math
import numpy as np
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple


# ─── Enums ──────────────────────────────────────────────────────────────────

class SizingMethod(Enum):
    KELLY = "kelly"
    HALF_KELLY = "half_kelly"
    FIXED_FRACTIONAL = "fixed_fractional"
    PERCENT_RISK = "percent_risk"
    VOLATILITY_BASED = "volatility_based"
    OPTIMAL_F = "optimal_f"
    ANTI_MARTINGALE = "anti_martingale"
    CONSTANT_PROPORTION = "constant_proportion"
    MAX_DRAWDOWN = "max_drawdown"
    EQUAL_WEIGHT = "equal_weight"


class RiskUnit(Enum):
    DOLLARS = "dollars"
    PERCENT = "percent"
    ATR = "atr"
    VOLATILITY = "volatility"


# ─── Data Classes ───────────────────────────────────────────────────────────

@dataclass
class PositionSizeResult:
    """Result of a position sizing calculation."""
    method: str
    shares: int
    position_value: float
    risk_amount: float
    risk_percent: float
    capital_allocated_pct: float
    stop_distance: float = 0.0
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "shares": self.shares,
            "position_value": self.position_value,
            "risk_amount": round(self.risk_amount, 2),
            "risk_percent": round(self.risk_percent, 4),
            "capital_allocated_pct": round(self.capital_allocated_pct, 4),
            "stop_distance": round(self.stop_distance, 4),
            "notes": self.notes,
        }


@dataclass
class PortfolioRiskBudget:
    """Portfolio-level risk budget with position limits."""
    total_capital: float
    max_portfolio_risk_pct: float = 0.06
    max_single_position_pct: float = 0.10
    max_correlated_group_pct: float = 0.25
    max_sector_pct: float = 0.30
    max_positions: int = 20

    def to_dict(self) -> dict:
        return {
            "total_capital": self.total_capital,
            "max_portfolio_risk_pct": self.max_portfolio_risk_pct,
            "max_single_position_pct": self.max_single_position_pct,
            "max_correlated_group_pct": self.max_correlated_group_pct,
            "max_sector_pct": self.max_sector_pct,
            "max_positions": self.max_positions,
        }


@dataclass
class TradeSetup:
    """Input for a trade setup to be sized."""
    symbol: str
    entry_price: float
    stop_price: float
    target_price: float = 0.0
    atr: float = 0.0
    daily_volatility: float = 0.0
    sector: str = ""
    correlation_group: str = ""
    win_rate: float = 0.5
    avg_win: float = 1.0
    avg_loss: float = 1.0
    current_price: float = 0.0

    @property
    def stop_distance(self) -> float:
        return abs(self.entry_price - self.stop_price)

    @property
    def stop_distance_pct(self) -> float:
        if self.entry_price == 0:
            return 0.0
        return self.stop_distance / self.entry_price

    @property
    def reward_risk_ratio(self) -> float:
        if self.stop_distance == 0:
            return 0.0
        if self.target_price == 0:
            return 1.0
        return abs(self.target_price - self.entry_price) / self.stop_distance

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "entry_price": self.entry_price,
            "stop_price": self.stop_price,
            "target_price": self.target_price,
            "stop_distance": round(self.stop_distance, 4),
            "stop_distance_pct": round(self.stop_distance_pct, 4),
            "reward_risk_ratio": round(self.reward_risk_ratio, 2),
        }


# ─── Kelly Criterion Calculator ─────────────────────────────────────────────

class KellyCriterion:
    """Kelly criterion and fractional Kelly position sizing."""

    @staticmethod
    def full_kelly(win_rate: float, avg_win: float, avg_loss: float) -> float:
        """
        Kelly% = W - (1-W)/R
        W = win rate, R = avg_win/avg_loss
        Returns fraction of capital to risk (can be negative => don't trade).
        """
        if avg_loss <= 0:
            return 0.0
        r = avg_win / avg_loss
        if r <= 0:
            return 0.0
        kelly = win_rate - (1 - win_rate) / r
        return max(kelly, 0.0)

    @staticmethod
    def fractional_kelly(win_rate: float, avg_win: float, avg_loss: float,
                         fraction: float = 0.5) -> float:
        """Half-Kelly or custom fraction for lower variance."""
        return KellyCriterion.full_kelly(win_rate, avg_win, avg_loss) * fraction

    @staticmethod
    def kelly_from_series(returns: List[float]) -> float:
        """Estimate Kelly from historical returns series."""
        if len(returns) < 5:
            return 0.0
        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r < 0]
        if not wins or not losses:
            return 0.0
        win_rate = len(wins) / len(returns)
        avg_win = np.mean(wins)
        avg_loss = abs(np.mean(losses))
        return KellyCriterion.full_kelly(win_rate, avg_win, avg_loss)

    @staticmethod
    def kelly_for_multiple_bets(outcomes: List[Dict]) -> float:
        """
        Kelly for simultaneous independent bets.
        outcomes: [{"probability": p, "payout_ratio": r}, ...]
        Uses approximate sum of individual kellys capped at 1.0.
        """
        total = 0.0
        for o in outcomes:
            p = o.get("probability", 0)
            r = o.get("payout_ratio", 0)
            if r > 0:
                k = p - (1 - p) / r
                total += max(k, 0.0)
        return min(total, 1.0)


# ─── Fixed Fractional Sizing ────────────────────────────────────────────────

class FixedFractionalSizer:
    """Fixed percentage of capital per trade."""

    @staticmethod
    def size(capital: float, fraction: float, entry_price: float) -> PositionSizeResult:
        """Allocate a fixed fraction of capital to the position."""
        if entry_price <= 0 or capital <= 0:
            return PositionSizeResult("fixed_fractional", 0, 0, 0, 0, 0)
        position_value = capital * fraction
        shares = int(position_value / entry_price)
        actual_value = shares * entry_price
        return PositionSizeResult(
            method="fixed_fractional",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_value,
            risk_percent=actual_value / capital if capital > 0 else 0,
            capital_allocated_pct=actual_value / capital if capital > 0 else 0,
        )


# ─── Percent Risk Sizing ────────────────────────────────────────────────────

class PercentRiskSizer:
    """Risk a fixed percentage of capital; position size derived from stop distance."""

    @staticmethod
    def size(capital: float, risk_pct: float, entry_price: float,
             stop_price: float) -> PositionSizeResult:
        """
        shares = (capital * risk_pct) / |entry - stop|
        The most common professional sizing method.
        """
        stop_distance = abs(entry_price - stop_price)
        if stop_distance <= 0 or entry_price <= 0 or capital <= 0:
            return PositionSizeResult("percent_risk", 0, 0, 0, 0, 0)
        risk_amount = capital * risk_pct
        shares = int(risk_amount / stop_distance)
        actual_value = shares * entry_price
        actual_risk = shares * stop_distance
        return PositionSizeResult(
            method="percent_risk",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / capital,
            capital_allocated_pct=actual_value / capital,
            stop_distance=stop_distance,
        )


# ─── Volatility-Based Sizing ────────────────────────────────────────────────

class VolatilityBasedSizer:
    """Position size inversely proportional to volatility (Turtle-style)."""

    @staticmethod
    def size_by_atr(capital: float, risk_pct: float, entry_price: float,
                    atr: float, atr_multiplier: float = 2.0) -> PositionSizeResult:
        """Stop at entry - ATR*multiplier; size from risk budget."""
        if atr <= 0 or entry_price <= 0 or capital <= 0:
            return PositionSizeResult("volatility_atr", 0, 0, 0, 0, 0)
        stop_distance = atr * atr_multiplier
        risk_amount = capital * risk_pct
        shares = int(risk_amount / stop_distance)
        actual_value = shares * entry_price
        actual_risk = shares * stop_distance
        return PositionSizeResult(
            method="volatility_atr",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / capital,
            capital_allocated_pct=actual_value / capital,
            stop_distance=stop_distance,
            notes=f"ATR={atr:.4f}, multiplier={atr_multiplier}",
        )

    @staticmethod
    def size_by_volatility(capital: float, target_volatility: float,
                           entry_price: float, daily_vol: float) -> PositionSizeResult:
        """
        Target a specific portfolio volatility contribution.
        shares = (capital * target_vol) / (price * daily_vol * sqrt(252))
        """
        if daily_vol <= 0 or entry_price <= 0 or capital <= 0:
            return PositionSizeResult("volatility_target", 0, 0, 0, 0, 0)
        annual_vol = daily_vol * math.sqrt(252)
        dollar_vol_per_share = entry_price * annual_vol
        target_risk = capital * target_volatility
        shares = int(target_risk / dollar_vol_per_share)
        actual_value = shares * entry_price
        actual_risk = shares * dollar_vol_per_share
        return PositionSizeResult(
            method="volatility_target",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / capital,
            capital_allocated_pct=actual_value / capital,
            notes=f"annual_vol={annual_vol:.4f}, target_vol={target_volatility}",
        )


# ─── Optimal-f Calculator ───────────────────────────────────────────────────

class OptimalFCalculator:
    """
    Ralph Vince's Optimal-f: fraction that maximizes geometric growth.
    Uses TWR (Terminal Wealth Relative) over trade P&L series.
    """

    @staticmethod
    def find_optimal_f(trade_returns: List[float], steps: int = 100) -> Tuple[float, float]:
        """
        Brute-force search for optimal f in [0.01, 1.0].
        Returns (optimal_f, TWR_at_optimal_f).
        """
        if not trade_returns:
            return (0.0, 1.0)
        max_loss = abs(min(trade_returns)) if min(trade_returns) < 0 else 1.0
        if max_loss == 0:
            return (0.0, 1.0)

        best_f = 0.0
        best_twr = 1.0

        for i in range(1, steps + 1):
            f = i / steps
            twr = 1.0
            for r in trade_returns:
                hpp = 1 + f * (r / max_loss)
                if hpp <= 0:
                    twr = 0.0
                    break
                twr *= hpp
            if twr > best_twr:
                best_twr = twr
                best_f = f
        return (best_f, best_twr)

    @staticmethod
    def size_from_optimal_f(capital: float, optimal_f: float,
                            max_loss_per_share: float,
                            entry_price: float) -> PositionSizeResult:
        """Convert optimal-f into shares: shares = (capital * f) / max_loss."""
        if max_loss_per_share <= 0 or entry_price <= 0 or capital <= 0:
            return PositionSizeResult("optimal_f", 0, 0, 0, 0, 0)
        shares = int((capital * optimal_f) / max_loss_per_share)
        actual_value = shares * entry_price
        actual_risk = shares * max_loss_per_share
        return PositionSizeResult(
            method="optimal_f",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / capital,
            capital_allocated_pct=actual_value / capital,
            notes=f"optimal_f={optimal_f:.4f}",
        )


# ─── Anti-Martingale Sizing ─────────────────────────────────────────────────

class AntiMartingaleSizer:
    """Increase size with wins, decrease with losses."""

    @staticmethod
    def size(capital: float, base_risk_pct: float, entry_price: float,
             stop_price: float, consecutive_wins: int = 0,
             consecutive_losses: int = 0,
             scale_factor: float = 0.5) -> PositionSizeResult:
        """
        Adjust risk% based on winning/losing streak.
        Wins: risk_pct * (1 + wins * scale)
        Losses: risk_pct * (1 - losses * scale)  [min 0.25 * base]
        """
        stop_distance = abs(entry_price - stop_price)
        if stop_distance <= 0 or entry_price <= 0 or capital <= 0:
            return PositionSizeResult("anti_martingale", 0, 0, 0, 0, 0)

        if consecutive_wins > 0:
            adj = 1 + consecutive_wins * scale_factor
        elif consecutive_losses > 0:
            adj = max(1 - consecutive_losses * scale_factor, 0.25)
        else:
            adj = 1.0

        risk_pct = base_risk_pct * adj
        risk_pct = min(risk_pct, 0.10)  # Cap at 10%

        risk_amount = capital * risk_pct
        shares = int(risk_amount / stop_distance)
        actual_value = shares * entry_price
        actual_risk = shares * stop_distance
        return PositionSizeResult(
            method="anti_martingale",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / capital,
            capital_allocated_pct=actual_value / capital,
            stop_distance=stop_distance,
            notes=f"adj_factor={adj:.2f}, effective_risk={risk_pct:.4f}",
        )


# ─── Max Drawdown Constrained Sizing ────────────────────────────────────────

class MaxDrawdownSizer:
    """Size positions to limit maximum portfolio drawdown."""

    @staticmethod
    def size(capital: float, max_dd_pct: float, entry_price: float,
             stop_price: float, num_positions: int = 1,
             correlation: float = 0.5) -> PositionSizeResult:
        """
        risk_per_trade = max_dd / (num_positions * sqrt(correlation_factor))
        Accounts for portfolio diversification.
        """
        stop_distance = abs(entry_price - stop_price)
        if stop_distance <= 0 or entry_price <= 0 or capital <= 0 or num_positions <= 0:
            return PositionSizeResult("max_drawdown", 0, 0, 0, 0, 0)

        # Diversification factor
        corr_factor = 1 + (num_positions - 1) * abs(correlation)
        effective_dd = max_dd_pct / math.sqrt(corr_factor)
        risk_per_trade = effective_dd / num_positions

        risk_amount = capital * risk_per_trade
        shares = int(risk_amount / stop_distance)
        actual_value = shares * entry_price
        actual_risk = shares * stop_distance
        return PositionSizeResult(
            method="max_drawdown",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / capital,
            capital_allocated_pct=actual_value / capital,
            stop_distance=stop_distance,
            notes=f"max_dd={max_dd_pct:.2%}, positions={num_positions}, corr={correlation}",
        )


# ─── Margin-Aware Sizer ─────────────────────────────────────────────────────

class MarginAwareSizer:
    """Factor in margin requirements and buying power."""

    @staticmethod
    def size(capital: float, risk_pct: float, entry_price: float,
             stop_price: float, margin_multiplier: float = 2.0,
             margin_used: float = 0.0) -> PositionSizeResult:
        """
        Account for leveraged buying power, reduced by existing margin use.
        """
        stop_distance = abs(entry_price - stop_price)
        if stop_distance <= 0 or entry_price <= 0 or capital <= 0:
            return PositionSizeResult("margin_aware", 0, 0, 0, 0, 0)

        buying_power = (capital - margin_used) * margin_multiplier
        risk_amount = capital * risk_pct
        shares_from_risk = int(risk_amount / stop_distance)
        shares_from_margin = int(buying_power / entry_price)
        shares = min(shares_from_risk, shares_from_margin)
        shares = max(shares, 0)

        actual_value = shares * entry_price
        actual_risk = shares * stop_distance
        return PositionSizeResult(
            method="margin_aware",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / capital if capital > 0 else 0,
            capital_allocated_pct=actual_value / capital if capital > 0 else 0,
            stop_distance=stop_distance,
            notes=f"buying_power={buying_power:.0f}, margin_mult={margin_multiplier}",
        )


# ─── Portfolio Heat Monitor ─────────────────────────────────────────────────

class PortfolioHeatMonitor:
    """
    Track total portfolio risk ('heat') and enforce limits.
    Heat = sum of (shares * stop_distance) for all open positions.
    """

    @staticmethod
    def calculate_heat(positions: List[Dict], capital: float) -> Dict:
        """
        positions: [{"shares": n, "entry": p, "stop": s, "sector": "..."}, ...]
        Returns heat metrics.
        """
        if not positions or capital <= 0:
            return {"total_heat": 0, "heat_pct": 0, "by_sector": {}, "positions": 0}

        total_heat = 0.0
        sector_heat: Dict[str, float] = {}
        for pos in positions:
            sh = pos.get("shares", 0)
            entry = pos.get("entry", 0)
            stop = pos.get("stop", 0)
            risk = abs(sh * (entry - stop))
            total_heat += risk
            sector = pos.get("sector", "unknown")
            sector_heat[sector] = sector_heat.get(sector, 0) + risk

        return {
            "total_heat": round(total_heat, 2),
            "heat_pct": round(total_heat / capital, 4),
            "by_sector": {k: round(v / capital, 4) for k, v in sector_heat.items()},
            "positions": len(positions),
        }

    @staticmethod
    def remaining_risk_budget(current_heat_pct: float, max_heat_pct: float,
                              capital: float) -> float:
        """Dollars of risk remaining before hitting heat limit."""
        remaining_pct = max(max_heat_pct - current_heat_pct, 0)
        return remaining_pct * capital

    @staticmethod
    def can_add_position(current_heat_pct: float, proposed_risk_pct: float,
                         max_heat_pct: float) -> bool:
        return (current_heat_pct + proposed_risk_pct) <= max_heat_pct


# ─── Position Scaling Manager ───────────────────────────────────────────────

class PositionScalingManager:
    """Scale in/out of positions systematically."""

    @staticmethod
    def scale_in_plan(total_shares: int, num_entries: int,
                      method: str = "equal") -> List[Dict]:
        """
        Plan multiple entries.
        Methods: equal, pyramid (decreasing), inverted_pyramid (increasing)
        """
        if total_shares <= 0 or num_entries <= 0:
            return []
        if method == "pyramid":
            # Decreasing: largest first
            weights = list(range(num_entries, 0, -1))
        elif method == "inverted_pyramid":
            # Increasing: smallest first
            weights = list(range(1, num_entries + 1))
        else:
            weights = [1] * num_entries

        total_w = sum(weights)
        entries = []
        allocated = 0
        for i, w in enumerate(weights):
            if i == len(weights) - 1:
                shares = total_shares - allocated
            else:
                shares = int(total_shares * w / total_w)
            allocated += shares
            entries.append({
                "entry_number": i + 1,
                "shares": max(shares, 0),
                "cumulative": allocated,
                "pct_of_total": round(shares / total_shares, 4) if total_shares > 0 else 0,
            })
        return entries

    @staticmethod
    def scale_out_plan(total_shares: int, targets: List[float],
                       entry_price: float) -> List[Dict]:
        """Plan exits at profit targets."""
        if not targets or total_shares <= 0:
            return []
        portion = total_shares // len(targets)
        plan = []
        remaining = total_shares
        for i, target in enumerate(sorted(targets)):
            if i == len(targets) - 1:
                shares = remaining
            else:
                shares = min(portion, remaining)
            remaining -= shares
            pnl = shares * (target - entry_price)
            plan.append({
                "exit_number": i + 1,
                "target_price": target,
                "shares_to_sell": shares,
                "remaining_after": remaining,
                "projected_pnl": round(pnl, 2),
            })
        return plan


# ─── Risk-Reward Analyzer ───────────────────────────────────────────────────

class RiskRewardAnalyzer:
    """Evaluate trade quality for position sizing decisions."""

    @staticmethod
    def expectancy(win_rate: float, avg_win: float, avg_loss: float) -> float:
        """E = W * avg_win - (1-W) * avg_loss"""
        return win_rate * avg_win - (1 - win_rate) * avg_loss

    @staticmethod
    def edge_ratio(avg_mae: float, avg_mfe: float) -> float:
        """MFE / MAE — efficiency of trade execution."""
        if avg_mae <= 0:
            return 0.0
        return avg_mfe / avg_mae

    @staticmethod
    def payoff_ratio(avg_win: float, avg_loss: float) -> float:
        if avg_loss <= 0:
            return 0.0
        return avg_win / avg_loss

    @staticmethod
    def breakeven_win_rate(payoff: float) -> float:
        """Win rate needed to break even: 1 / (1 + payoff)"""
        if payoff <= 0:
            return 1.0
        return 1 / (1 + payoff)

    @staticmethod
    def should_take_trade(win_rate: float, avg_win: float, avg_loss: float,
                          min_expectancy: float = 0.1) -> Dict:
        """Evaluate whether a trade setup has positive expectancy."""
        exp = RiskRewardAnalyzer.expectancy(win_rate, avg_win, avg_loss)
        pr = RiskRewardAnalyzer.payoff_ratio(avg_win, avg_loss)
        be = RiskRewardAnalyzer.breakeven_win_rate(pr)
        take = exp >= min_expectancy
        return {
            "take_trade": take,
            "expectancy": round(exp, 4),
            "payoff_ratio": round(pr, 4),
            "breakeven_win_rate": round(be, 4),
            "edge_above_breakeven": round(win_rate - be, 4),
        }

    @staticmethod
    def risk_of_ruin(win_rate: float, payoff_ratio: float,
                     risk_per_trade_pct: float, ruin_threshold_pct: float = 0.5) -> float:
        """
        Approximate risk of ruin.
        RoR ≈ ((1-edge)/edge)^(units_at_risk)
        """
        if payoff_ratio <= 0 or win_rate <= 0 or risk_per_trade_pct <= 0:
            return 1.0
        edge = win_rate * payoff_ratio - (1 - win_rate)
        if edge <= 0:
            return 1.0
        a = (1 - edge) / (1 + edge)
        units = ruin_threshold_pct / risk_per_trade_pct
        if a >= 1:
            return 1.0
        return min(a ** units, 1.0)


# ─── Multi-Setup Allocator ──────────────────────────────────────────────────

class MultiSetupAllocator:
    """Allocate capital across multiple simultaneous trade setups."""

    @staticmethod
    def equal_risk_allocation(capital: float, setups: List[TradeSetup],
                              total_risk_pct: float = 0.06) -> List[Dict]:
        """Equal risk per trade, total capped at total_risk_pct."""
        if not setups or capital <= 0:
            return []
        risk_per_trade = (capital * total_risk_pct) / len(setups)
        results = []
        for setup in setups:
            sd = setup.stop_distance
            if sd <= 0:
                results.append({"symbol": setup.symbol, "shares": 0,
                                "risk": 0, "error": "no stop distance"})
                continue
            shares = int(risk_per_trade / sd)
            results.append({
                "symbol": setup.symbol,
                "shares": shares,
                "position_value": round(shares * setup.entry_price, 2),
                "risk_amount": round(shares * sd, 2),
                "risk_pct": round(shares * sd / capital, 4),
            })
        return results

    @staticmethod
    def expectancy_weighted_allocation(capital: float, setups: List[TradeSetup],
                                       total_risk_pct: float = 0.06) -> List[Dict]:
        """Weight allocation by expected edge (expectancy * RR)."""
        if not setups or capital <= 0:
            return []
        edges = []
        for s in setups:
            exp = RiskRewardAnalyzer.expectancy(s.win_rate, s.avg_win, s.avg_loss)
            weight = max(exp * s.reward_risk_ratio, 0)
            edges.append(weight)
        total_edge = sum(edges)
        if total_edge <= 0:
            return MultiSetupAllocator.equal_risk_allocation(capital, setups, total_risk_pct)

        total_risk = capital * total_risk_pct
        results = []
        for setup, edge in zip(setups, edges):
            fraction = edge / total_edge
            risk_for_trade = total_risk * fraction
            sd = setup.stop_distance
            if sd <= 0:
                results.append({"symbol": setup.symbol, "shares": 0, "risk": 0})
                continue
            shares = int(risk_for_trade / sd)
            results.append({
                "symbol": setup.symbol,
                "shares": shares,
                "position_value": round(shares * setup.entry_price, 2),
                "risk_amount": round(shares * sd, 2),
                "risk_pct": round(shares * sd / capital, 4),
                "weight": round(fraction, 4),
            })
        return results

    @staticmethod
    def volatility_parity_allocation(capital: float, setups: List[TradeSetup],
                                     total_risk_pct: float = 0.06) -> List[Dict]:
        """Inverse-volatility weighting for equal risk contribution."""
        if not setups or capital <= 0:
            return []
        inv_vols = []
        for s in setups:
            vol = s.daily_volatility if s.daily_volatility > 0 else s.stop_distance_pct
            inv_vols.append(1.0 / vol if vol > 0 else 0.0)
        total_inv = sum(inv_vols)
        if total_inv <= 0:
            return MultiSetupAllocator.equal_risk_allocation(capital, setups, total_risk_pct)

        total_risk = capital * total_risk_pct
        results = []
        for setup, iv in zip(setups, inv_vols):
            fraction = iv / total_inv
            risk_for_trade = total_risk * fraction
            sd = setup.stop_distance
            if sd <= 0:
                results.append({"symbol": setup.symbol, "shares": 0, "risk": 0})
                continue
            shares = int(risk_for_trade / sd)
            results.append({
                "symbol": setup.symbol,
                "shares": shares,
                "position_value": round(shares * setup.entry_price, 2),
                "risk_amount": round(shares * sd, 2),
                "risk_pct": round(shares * sd / capital, 4),
                "weight": round(fraction, 4),
            })
        return results


# ─── Position Sizing Engine (Orchestrator) ───────────────────────────────────

class PositionSizingEngine:
    """
    Master orchestrator for all position sizing methods.
    Provides a unified interface and cross-cutting concerns.
    """

    def __init__(self, capital: float = 100_000, default_risk_pct: float = 0.02):
        self.capital = capital
        self.default_risk_pct = default_risk_pct

    # --- Kelly ---
    def kelly_size(self, win_rate: float, avg_win: float, avg_loss: float,
                   entry_price: float, stop_price: float,
                   fraction: float = 0.5) -> PositionSizeResult:
        kelly_pct = KellyCriterion.fractional_kelly(win_rate, avg_win, avg_loss, fraction)
        if kelly_pct <= 0 or entry_price <= 0:
            return PositionSizeResult("kelly", 0, 0, 0, 0, 0)
        stop_distance = abs(entry_price - stop_price)
        if stop_distance <= 0:
            return PositionSizeResult("kelly", 0, 0, 0, 0, 0)
        risk_amount = self.capital * kelly_pct
        shares = int(risk_amount / stop_distance)
        actual_value = shares * entry_price
        actual_risk = shares * stop_distance
        return PositionSizeResult(
            method=f"kelly_{fraction:.0%}",
            shares=shares,
            position_value=actual_value,
            risk_amount=actual_risk,
            risk_percent=actual_risk / self.capital,
            capital_allocated_pct=actual_value / self.capital,
            stop_distance=stop_distance,
            notes=f"kelly_pct={kelly_pct:.4f}",
        )

    # --- Percent Risk ---
    def percent_risk_size(self, entry_price: float, stop_price: float,
                          risk_pct: float = None) -> PositionSizeResult:
        rp = risk_pct or self.default_risk_pct
        return PercentRiskSizer.size(self.capital, rp, entry_price, stop_price)

    # --- Volatility ---
    def volatility_size(self, entry_price: float, atr: float,
                        atr_multiplier: float = 2.0,
                        risk_pct: float = None) -> PositionSizeResult:
        rp = risk_pct or self.default_risk_pct
        return VolatilityBasedSizer.size_by_atr(self.capital, rp, entry_price, atr, atr_multiplier)

    # --- Fixed Fractional ---
    def fixed_fractional_size(self, entry_price: float,
                              fraction: float = 0.10) -> PositionSizeResult:
        return FixedFractionalSizer.size(self.capital, fraction, entry_price)

    # --- Anti-Martingale ---
    def anti_martingale_size(self, entry_price: float, stop_price: float,
                             consecutive_wins: int = 0,
                             consecutive_losses: int = 0) -> PositionSizeResult:
        return AntiMartingaleSizer.size(
            self.capital, self.default_risk_pct, entry_price, stop_price,
            consecutive_wins, consecutive_losses)

    # --- Max Drawdown ---
    def max_drawdown_size(self, entry_price: float, stop_price: float,
                          max_dd_pct: float = 0.20,
                          num_positions: int = 5) -> PositionSizeResult:
        return MaxDrawdownSizer.size(
            self.capital, max_dd_pct, entry_price, stop_price, num_positions)

    # --- Margin Aware ---
    def margin_size(self, entry_price: float, stop_price: float,
                    margin_multiplier: float = 2.0,
                    margin_used: float = 0.0) -> PositionSizeResult:
        return MarginAwareSizer.size(
            self.capital, self.default_risk_pct, entry_price, stop_price,
            margin_multiplier, margin_used)

    # --- Multi-setup ---
    def allocate_setups(self, setups: List[TradeSetup],
                        method: str = "equal_risk",
                        total_risk_pct: float = 0.06) -> List[Dict]:
        if method == "expectancy_weighted":
            return MultiSetupAllocator.expectancy_weighted_allocation(
                self.capital, setups, total_risk_pct)
        elif method == "volatility_parity":
            return MultiSetupAllocator.volatility_parity_allocation(
                self.capital, setups, total_risk_pct)
        return MultiSetupAllocator.equal_risk_allocation(
            self.capital, setups, total_risk_pct)

    # --- Portfolio Heat ---
    def portfolio_heat(self, positions: List[Dict]) -> Dict:
        return PortfolioHeatMonitor.calculate_heat(positions, self.capital)

    # --- Scaling ---
    def scale_in(self, total_shares: int, entries: int = 3,
                 method: str = "pyramid") -> List[Dict]:
        return PositionScalingManager.scale_in_plan(total_shares, entries, method)

    def scale_out(self, total_shares: int, targets: List[float],
                  entry_price: float) -> List[Dict]:
        return PositionScalingManager.scale_out_plan(total_shares, targets, entry_price)

    # --- Trade Evaluation ---
    def evaluate_trade(self, win_rate: float, avg_win: float,
                       avg_loss: float) -> Dict:
        return RiskRewardAnalyzer.should_take_trade(win_rate, avg_win, avg_loss)

    def risk_of_ruin(self, win_rate: float, payoff_ratio: float,
                     risk_per_trade_pct: float = None) -> float:
        rp = risk_per_trade_pct or self.default_risk_pct
        return RiskRewardAnalyzer.risk_of_ruin(win_rate, payoff_ratio, rp)

    # --- Compare Methods ---
    def compare_methods(self, entry_price: float, stop_price: float,
                        atr: float = 0.0,
                        win_rate: float = 0.5,
                        avg_win: float = 1.5,
                        avg_loss: float = 1.0) -> List[Dict]:
        """Compare all sizing methods for the same trade setup."""
        results = []
        results.append(self.percent_risk_size(entry_price, stop_price).to_dict())
        results.append(self.fixed_fractional_size(entry_price).to_dict())
        results.append(self.kelly_size(win_rate, avg_win, avg_loss,
                                       entry_price, stop_price).to_dict())
        results.append(self.anti_martingale_size(entry_price, stop_price).to_dict())
        results.append(self.max_drawdown_size(entry_price, stop_price).to_dict())
        results.append(self.margin_size(entry_price, stop_price).to_dict())
        if atr > 0:
            results.append(self.volatility_size(entry_price, atr).to_dict())
        return results

    def capabilities(self) -> Dict:
        return {
            "engine": "PositionSizingEngine",
            "version": "1.0.0",
            "features": [
                "Kelly criterion (full & fractional)",
                "Kelly from historical returns",
                "Kelly for multiple bets",
                "Fixed fractional sizing",
                "Percent risk sizing",
                "Volatility (ATR) sizing",
                "Volatility target sizing",
                "Optimal-f (Ralph Vince)",
                "Anti-martingale adaptive sizing",
                "Max drawdown constrained sizing",
                "Margin-aware sizing",
                "Portfolio heat monitoring",
                "Position scaling (in/out)",
                "Scale in: equal/pyramid/inverted",
                "Risk-reward analysis",
                "Trade expectancy evaluation",
                "Risk of ruin calculation",
                "Multi-setup allocation (equal/expectancy/vol parity)",
                "Breakeven win rate",
                "Edge ratio",
                "Portfolio risk budget management",
            ],
            "sizing_methods": [m.value for m in SizingMethod],
        }
