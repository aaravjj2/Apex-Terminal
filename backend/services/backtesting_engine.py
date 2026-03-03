"""
┌───────────────────────────────────────────────────────────────────────┐
│  APEX TERMINAL — Advanced Backtesting Engine                         │
│  Walk-forward analysis, realistic execution simulation,              │
│  multi-asset support, Monte Carlo bootstrapping, risk analytics      │
└───────────────────────────────────────────────────────────────────────┘
"""

import math
import random
import statistics
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# SECTION 1: TYPES & ENUMS
# ══════════════════════════════════════════════════════════════════════

class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    MOC = "market_on_close"
    MOO = "market_on_open"
    TRAILING_STOP = "trailing_stop"


class FillModel(str, Enum):
    INSTANT = "instant"
    NEXT_BAR = "next_bar"
    VWAP = "vwap"
    SLIPPAGE = "slippage"
    REALISTIC = "realistic"


class PositionSizing(str, Enum):
    FIXED_DOLLAR = "fixed_dollar"
    FIXED_SHARES = "fixed_shares"
    PERCENT_EQUITY = "percent_equity"
    VOLATILITY_TARGET = "volatility_target"
    KELLY = "kelly"
    EQUAL_WEIGHT = "equal_weight"
    RISK_PARITY = "risk_parity"


@dataclass
class BacktestBar:
    timestamp: float
    open: float
    high: float
    low: float
    close: float
    volume: int
    symbol: str = "SYM"
    adj_close: Optional[float] = None


@dataclass
class BacktestConfig:
    initial_capital: float = 1_000_000.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    commission_per_share: float = 0.005
    commission_min: float = 1.0
    commission_max: float = 0.5  # percent of trade value
    slippage_bps: float = 5.0  # basis points
    fill_model: FillModel = FillModel.NEXT_BAR
    position_sizing: PositionSizing = PositionSizing.PERCENT_EQUITY
    max_position_pct: float = 0.10  # 10% of portfolio
    max_positions: int = 20
    max_leverage: float = 1.0
    margin_rate: float = 0.05  # annual
    risk_free_rate: float = 0.04
    benchmark: str = "SPY"
    rebalance_frequency: int = 0  # 0 = no scheduled rebalance
    walk_forward_windows: int = 5
    monte_carlo_trials: int = 1000
    use_fractional_shares: bool = False
    tax_rate_short: float = 0.37
    tax_rate_long: float = 0.20
    wash_sale_window: int = 30  # days


@dataclass
class BacktestOrder:
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    trailing_amount: Optional[float] = None
    time_in_force: str = "day"
    submitted_at: float = 0
    filled_at: Optional[float] = None
    fill_price: Optional[float] = None
    fill_quantity: Optional[float] = None
    commission: float = 0.0
    slippage: float = 0.0
    status: str = "pending"  # pending, filled, partial, cancelled, rejected


@dataclass
class BacktestPosition:
    symbol: str
    quantity: float = 0
    avg_cost: float = 0.0
    current_price: float = 0.0
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0
    entry_date: Optional[float] = None
    last_update: Optional[float] = None
    trades: int = 0
    max_favorable: float = 0.0
    max_adverse: float = 0.0


@dataclass
class TradeRecord:
    trade_id: str
    symbol: str
    side: str
    quantity: float
    entry_price: float
    exit_price: float
    entry_time: float
    exit_time: float
    pnl: float
    pnl_pct: float
    commission: float
    holding_period: float  # in bars
    mae: float  # max adverse excursion
    mfe: float  # max favorable excursion


@dataclass
class EquityPoint:
    timestamp: float
    equity: float
    cash: float
    positions_value: float
    drawdown: float
    drawdown_pct: float
    margin_used: float = 0.0


@dataclass
class RiskMetrics:
    total_return: float
    annualized_return: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown: float
    max_drawdown_duration: int  # in bars
    avg_drawdown: float
    volatility: float
    downside_vol: float
    skewness: float
    kurtosis: float
    var_95: float
    var_99: float
    cvar_95: float
    cvar_99: float
    beta: float
    alpha: float
    information_ratio: float
    treynor_ratio: float
    omega_ratio: float
    tail_ratio: float
    profit_factor: float
    expectancy: float
    payoff_ratio: float
    win_rate: float
    total_trades: int
    avg_win: float
    avg_loss: float
    largest_win: float
    largest_loss: float
    avg_holding_period: float
    max_consecutive_wins: int
    max_consecutive_losses: int
    ulcer_index: float
    recovery_factor: float
    kelly_criterion: float


@dataclass
class MonteCarloResult:
    trials: int
    median_return: float
    mean_return: float
    p5_return: float
    p25_return: float
    p75_return: float
    p95_return: float
    median_drawdown: float
    p95_drawdown: float
    ruin_probability: float  # chance of losing > 50%
    confidence_intervals: Dict[str, Dict[str, float]] = field(default_factory=dict)
    distribution: List[float] = field(default_factory=list)


@dataclass
class WalkForwardWindow:
    window_index: int
    train_start: int
    train_end: int
    test_start: int
    test_end: int
    in_sample_return: float
    out_sample_return: float
    in_sample_sharpe: float
    out_sample_sharpe: float
    parameters: Dict[str, Any] = field(default_factory=dict)
    efficiency_ratio: float = 0.0


@dataclass
class FullBacktestResult:
    config: Dict[str, Any]
    risk_metrics: Dict[str, Any]
    equity_curve: List[Dict[str, float]]
    trades: List[Dict[str, Any]]
    monthly_returns: List[Dict[str, Any]]
    annual_returns: List[Dict[str, Any]]
    drawdown_analysis: Dict[str, Any]
    monte_carlo: Optional[Dict[str, Any]] = None
    walk_forward: Optional[List[Dict[str, Any]]] = None
    run_id: str = ""
    run_at: str = ""
    duration_ms: float = 0


# ══════════════════════════════════════════════════════════════════════
# SECTION 2: EXECUTION SIMULATOR
# ══════════════════════════════════════════════════════════════════════

class ExecutionSimulator:
    """Realistic order execution simulation"""

    def __init__(self, config: BacktestConfig):
        self.config = config
        self._rng = random.Random(42)

    def calculate_commission(self, quantity: float, price: float) -> float:
        per_share = self.config.commission_per_share * abs(quantity)
        commission = max(per_share, self.config.commission_min)
        max_pct = abs(quantity) * price * self.config.commission_max / 100
        return min(commission, max_pct) if max_pct > 0 else commission

    def calculate_slippage(self, side: OrderSide, price: float, volume: int, quantity: float) -> float:
        """Market impact model: linear + sqrt components"""
        base_slip = price * self.config.slippage_bps / 10_000
        # Volume participation impact
        participation = abs(quantity) / max(volume, 1)
        impact = price * 0.001 * math.sqrt(participation) if participation > 0.01 else 0
        total = base_slip + impact
        return total if side == OrderSide.BUY else -total

    def try_fill(self, order: BacktestOrder, bar: BacktestBar) -> bool:
        """Attempt to fill an order against a bar"""
        if order.status != "pending":
            return False

        # Market orders
        if order.order_type == OrderType.MARKET:
            if self.config.fill_model == FillModel.NEXT_BAR:
                fill_price = bar.open
            elif self.config.fill_model == FillModel.VWAP:
                fill_price = (bar.high + bar.low + bar.close * 2) / 4  # approximate VWAP
            else:
                fill_price = bar.open

            slippage = self.calculate_slippage(order.side, fill_price, bar.volume, order.quantity)
            order.fill_price = round(fill_price + slippage, 4)
            order.slippage = round(abs(slippage), 4)
            order.fill_quantity = order.quantity
            order.commission = round(self.calculate_commission(order.quantity, fill_price), 4)
            order.filled_at = bar.timestamp
            order.status = "filled"
            return True

        # MOC orders
        if order.order_type == OrderType.MOC:
            fill_price = bar.close
            slippage = self.calculate_slippage(order.side, fill_price, bar.volume, order.quantity)
            order.fill_price = round(fill_price + slippage, 4)
            order.slippage = round(abs(slippage), 4)
            order.fill_quantity = order.quantity
            order.commission = round(self.calculate_commission(order.quantity, fill_price), 4)
            order.filled_at = bar.timestamp
            order.status = "filled"
            return True

        # MOO orders
        if order.order_type == OrderType.MOO:
            fill_price = bar.open
            order.fill_price = round(fill_price, 4)
            order.fill_quantity = order.quantity
            order.commission = round(self.calculate_commission(order.quantity, fill_price), 4)
            order.filled_at = bar.timestamp
            order.status = "filled"
            return True

        # Limit orders
        if order.order_type == OrderType.LIMIT and order.limit_price is not None:
            if order.side == OrderSide.BUY and bar.low <= order.limit_price:
                fill_price = min(order.limit_price, bar.open) if bar.open <= order.limit_price else order.limit_price
                order.fill_price = round(fill_price, 4)
                order.fill_quantity = order.quantity
                order.commission = round(self.calculate_commission(order.quantity, fill_price), 4)
                order.filled_at = bar.timestamp
                order.status = "filled"
                return True
            elif order.side == OrderSide.SELL and bar.high >= order.limit_price:
                fill_price = max(order.limit_price, bar.open) if bar.open >= order.limit_price else order.limit_price
                order.fill_price = round(fill_price, 4)
                order.fill_quantity = order.quantity
                order.commission = round(self.calculate_commission(order.quantity, fill_price), 4)
                order.filled_at = bar.timestamp
                order.status = "filled"
                return True

        # Stop orders
        if order.order_type == OrderType.STOP and order.stop_price is not None:
            if order.side == OrderSide.SELL and bar.low <= order.stop_price:
                fill_price = min(order.stop_price, bar.open) if bar.open <= order.stop_price else order.stop_price
                slippage = self.calculate_slippage(order.side, fill_price, bar.volume, order.quantity)
                order.fill_price = round(fill_price + slippage, 4)
                order.slippage = round(abs(slippage), 4)
                order.fill_quantity = order.quantity
                order.commission = round(self.calculate_commission(order.quantity, fill_price), 4)
                order.filled_at = bar.timestamp
                order.status = "filled"
                return True
            elif order.side == OrderSide.BUY and bar.high >= order.stop_price:
                fill_price = max(order.stop_price, bar.open) if bar.open >= order.stop_price else order.stop_price
                slippage = self.calculate_slippage(order.side, fill_price, bar.volume, order.quantity)
                order.fill_price = round(fill_price + slippage, 4)
                order.slippage = round(abs(slippage), 4)
                order.fill_quantity = order.quantity
                order.commission = round(self.calculate_commission(order.quantity, fill_price), 4)
                order.filled_at = bar.timestamp
                order.status = "filled"
                return True

        # Stop-limit orders
        if order.order_type == OrderType.STOP_LIMIT and order.stop_price is not None and order.limit_price is not None:
            triggered = False
            if order.side == OrderSide.SELL and bar.low <= order.stop_price:
                triggered = True
            elif order.side == OrderSide.BUY and bar.high >= order.stop_price:
                triggered = True

            if triggered:
                # Convert to limit order behavior
                if order.side == OrderSide.BUY and bar.low <= order.limit_price:
                    order.fill_price = round(min(order.limit_price, bar.open), 4)
                    order.fill_quantity = order.quantity
                    order.commission = round(self.calculate_commission(order.quantity, order.fill_price), 4)
                    order.filled_at = bar.timestamp
                    order.status = "filled"
                    return True
                elif order.side == OrderSide.SELL and bar.high >= order.limit_price:
                    order.fill_price = round(max(order.limit_price, bar.open), 4)
                    order.fill_quantity = order.quantity
                    order.commission = round(self.calculate_commission(order.quantity, order.fill_price), 4)
                    order.filled_at = bar.timestamp
                    order.status = "filled"
                    return True

        return False


# ══════════════════════════════════════════════════════════════════════
# SECTION 3: POSITION SIZER
# ══════════════════════════════════════════════════════════════════════

class PositionSizer:
    """Calculate position sizes based on various methods"""

    def __init__(self, config: BacktestConfig):
        self.config = config

    def calculate_size(
        self,
        method: PositionSizing,
        equity: float,
        price: float,
        volatility: float = 0.2,
        win_rate: float = 0.5,
        avg_win_loss_ratio: float = 1.5,
        n_positions: int = 1,
    ) -> float:
        """Calculate position size in shares"""
        if method == PositionSizing.FIXED_DOLLAR:
            target = equity * self.config.max_position_pct
            return target / price if price > 0 else 0

        elif method == PositionSizing.FIXED_SHARES:
            return 100  # Default fixed shares

        elif method == PositionSizing.PERCENT_EQUITY:
            target = equity * self.config.max_position_pct
            shares = target / price if price > 0 else 0
            if not self.config.use_fractional_shares:
                shares = math.floor(shares)
            return shares

        elif method == PositionSizing.VOLATILITY_TARGET:
            # Target 15% portfolio vol, scale by asset vol
            target_vol = 0.15
            position_weight = target_vol / (volatility * math.sqrt(252)) if volatility > 0 else 0
            position_weight = min(position_weight, self.config.max_position_pct)
            shares = (equity * position_weight) / price if price > 0 else 0
            if not self.config.use_fractional_shares:
                shares = math.floor(shares)
            return shares

        elif method == PositionSizing.KELLY:
            # Kelly criterion: f* = (p*b - q) / b
            p = win_rate
            q = 1 - p
            b = avg_win_loss_ratio
            kelly_frac = (p * b - q) / b if b > 0 else 0
            kelly_frac = max(0, min(kelly_frac, self.config.max_position_pct))
            # Half-Kelly for safety
            kelly_frac *= 0.5
            shares = (equity * kelly_frac) / price if price > 0 else 0
            if not self.config.use_fractional_shares:
                shares = math.floor(shares)
            return shares

        elif method == PositionSizing.EQUAL_WEIGHT:
            weight = 1.0 / max(n_positions, 1)
            weight = min(weight, self.config.max_position_pct)
            shares = (equity * weight) / price if price > 0 else 0
            if not self.config.use_fractional_shares:
                shares = math.floor(shares)
            return shares

        elif method == PositionSizing.RISK_PARITY:
            # Inverse volatility weighting
            inv_vol = 1.0 / (volatility * math.sqrt(252)) if volatility > 0 else 1
            weight = min(inv_vol * 0.05, self.config.max_position_pct)
            shares = (equity * weight) / price if price > 0 else 0
            if not self.config.use_fractional_shares:
                shares = math.floor(shares)
            return shares

        return 0


# ══════════════════════════════════════════════════════════════════════
# SECTION 4: RISK ANALYTICS ENGINE
# ══════════════════════════════════════════════════════════════════════

class BacktestRiskAnalytics:
    """Compute comprehensive risk metrics from backtest results"""

    def __init__(self, risk_free_rate: float = 0.04):
        self.risk_free_rate = risk_free_rate

    def compute_metrics(
        self,
        equity_curve: List[float],
        trades: List[TradeRecord],
        benchmark_returns: Optional[List[float]] = None,
        bars_per_year: int = 252,
    ) -> RiskMetrics:
        """Compute full risk metrics"""
        n = len(equity_curve)
        if n < 2:
            return self._empty_metrics()

        # Returns
        returns = [(equity_curve[i] - equity_curve[i-1]) / equity_curve[i-1]
                    for i in range(1, n) if equity_curve[i-1] != 0]
        n_ret = len(returns)
        if n_ret == 0:
            return self._empty_metrics()

        # Basic stats
        total_return = (equity_curve[-1] - equity_curve[0]) / equity_curve[0]
        mean_ret = sum(returns) / n_ret
        ann_factor = bars_per_year / n_ret if n_ret > 0 else 1
        ann_return = (1 + total_return) ** ann_factor - 1

        # Volatility
        vol = self._std(returns) * math.sqrt(bars_per_year)
        downside_rets = [r for r in returns if r < 0]
        downside_vol = self._std(downside_rets) * math.sqrt(bars_per_year) if downside_rets else 0

        # Sharpe, Sortino, Calmar
        daily_rf = self.risk_free_rate / bars_per_year
        excess_returns = [r - daily_rf for r in returns]
        sharpe = (sum(excess_returns) / len(excess_returns)) / (self._std(returns)) * math.sqrt(bars_per_year) if self._std(returns) > 0 else 0
        sortino = (ann_return - self.risk_free_rate) / downside_vol if downside_vol > 0 else 0

        # Drawdown analysis
        dd_info = self._compute_drawdowns(equity_curve)
        max_dd = dd_info["max_drawdown"]
        max_dd_dur = dd_info["max_duration"]
        avg_dd = dd_info["avg_drawdown"]
        calmar = ann_return / max_dd if max_dd > 0 else 0

        # Higher moments
        skewness = self._skewness(returns)
        kurtosis = self._kurtosis(returns)

        # VaR / CVaR
        sorted_rets = sorted(returns)
        var_95 = abs(sorted_rets[int(n_ret * 0.05)]) if n_ret > 20 else 0
        var_99 = abs(sorted_rets[int(n_ret * 0.01)]) if n_ret > 100 else 0
        cvar_95 = abs(sum(sorted_rets[:int(n_ret * 0.05)]) / max(1, int(n_ret * 0.05))) if n_ret > 20 else 0
        cvar_99 = abs(sum(sorted_rets[:int(n_ret * 0.01)]) / max(1, int(n_ret * 0.01))) if n_ret > 100 else 0

        # Beta / Alpha
        if benchmark_returns and len(benchmark_returns) >= n_ret:
            bm = benchmark_returns[:n_ret]
            beta = self._covariance(returns, bm) / self._variance(bm) if self._variance(bm) > 0 else 1
            alpha = ann_return - (self.risk_free_rate + beta * (self._annualize(bm, bars_per_year) - self.risk_free_rate))
            tracking_error = self._std([returns[i] - bm[i] for i in range(n_ret)]) * math.sqrt(bars_per_year)
            info_ratio = (ann_return - self._annualize(bm, bars_per_year)) / tracking_error if tracking_error > 0 else 0
        else:
            beta, alpha, info_ratio = 1.0, 0.0, 0.0

        treynor = (ann_return - self.risk_free_rate) / beta if beta != 0 else 0

        # Omega ratio (threshold = 0)
        gains = sum(max(0, r) for r in returns)
        losses = abs(sum(min(0, r) for r in returns))
        omega = gains / losses if losses > 0 else float('inf')

        # Tail ratio
        p95 = sorted_rets[int(n_ret * 0.95)] if n_ret > 20 else 0
        p5 = sorted_rets[int(n_ret * 0.05)] if n_ret > 20 else 0
        tail_ratio = abs(p95 / p5) if p5 != 0 else 1.0

        # Trade statistics
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl <= 0]
        n_trades = len(trades)
        win_rate = len(winning_trades) / n_trades if n_trades > 0 else 0
        avg_win = sum(t.pnl for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(t.pnl for t in losing_trades) / len(losing_trades) if losing_trades else 0
        largest_win = max((t.pnl for t in trades), default=0)
        largest_loss = min((t.pnl for t in trades), default=0)
        payoff = abs(avg_win / avg_loss) if avg_loss != 0 else 0
        profit_factor = abs(sum(t.pnl for t in winning_trades)) / abs(sum(t.pnl for t in losing_trades)) if losing_trades else 0
        expectancy = avg_win * win_rate + avg_loss * (1 - win_rate) if n_trades > 0 else 0
        avg_hold = sum(t.holding_period for t in trades) / n_trades if n_trades > 0 else 0

        # Consecutive wins/losses
        max_consec_wins, max_consec_losses = self._consecutive_streaks(trades)

        # Ulcer index
        ulcer = self._ulcer_index(equity_curve)

        # Recovery factor
        recovery = total_return / max_dd if max_dd > 0 else 0

        # Kelly
        kelly = (win_rate * payoff - (1 - win_rate)) / payoff if payoff > 0 else 0

        return RiskMetrics(
            total_return=round(total_return, 6),
            annualized_return=round(ann_return, 6),
            sharpe_ratio=round(sharpe, 4),
            sortino_ratio=round(sortino, 4),
            calmar_ratio=round(calmar, 4),
            max_drawdown=round(max_dd, 6),
            max_drawdown_duration=max_dd_dur,
            avg_drawdown=round(avg_dd, 6),
            volatility=round(vol, 6),
            downside_vol=round(downside_vol, 6),
            skewness=round(skewness, 4),
            kurtosis=round(kurtosis, 4),
            var_95=round(var_95, 6),
            var_99=round(var_99, 6),
            cvar_95=round(cvar_95, 6),
            cvar_99=round(cvar_99, 6),
            beta=round(beta, 4),
            alpha=round(alpha, 6),
            information_ratio=round(info_ratio, 4),
            treynor_ratio=round(treynor, 4),
            omega_ratio=round(omega, 4) if omega != float('inf') else 999.99,
            tail_ratio=round(tail_ratio, 4),
            profit_factor=round(profit_factor, 4),
            expectancy=round(expectancy, 4),
            payoff_ratio=round(payoff, 4),
            win_rate=round(win_rate, 4),
            total_trades=n_trades,
            avg_win=round(avg_win, 2),
            avg_loss=round(avg_loss, 2),
            largest_win=round(largest_win, 2),
            largest_loss=round(largest_loss, 2),
            avg_holding_period=round(avg_hold, 1),
            max_consecutive_wins=max_consec_wins,
            max_consecutive_losses=max_consec_losses,
            ulcer_index=round(ulcer, 6),
            recovery_factor=round(recovery, 4),
            kelly_criterion=round(kelly, 4),
        )

    def _compute_drawdowns(self, equity: List[float]) -> Dict[str, Any]:
        peak = equity[0]
        drawdowns = []
        current_dd = 0
        dd_start = 0
        max_dd = 0
        max_dd_dur = 0
        current_dur = 0

        for i, eq in enumerate(equity):
            if eq >= peak:
                if current_dd > 0:
                    drawdowns.append(current_dd)
                peak = eq
                current_dd = 0
                current_dur = 0
            else:
                current_dd = (peak - eq) / peak
                current_dur += 1
                if current_dd > max_dd:
                    max_dd = current_dd
                    max_dd_dur = current_dur

        if current_dd > 0:
            drawdowns.append(current_dd)

        return {
            "max_drawdown": max_dd,
            "max_duration": max_dd_dur,
            "avg_drawdown": sum(drawdowns) / len(drawdowns) if drawdowns else 0,
            "n_drawdowns": len(drawdowns),
        }

    def _std(self, values: List[float]) -> float:
        if len(values) < 2: return 0.0
        mu = sum(values) / len(values)
        return math.sqrt(sum((x - mu) ** 2 for x in values) / (len(values) - 1))

    def _variance(self, values: List[float]) -> float:
        if len(values) < 2: return 0.0
        mu = sum(values) / len(values)
        return sum((x - mu) ** 2 for x in values) / (len(values) - 1)

    def _covariance(self, x: List[float], y: List[float]) -> float:
        n = min(len(x), len(y))
        if n < 2: return 0.0
        mx = sum(x[:n]) / n
        my = sum(y[:n]) / n
        return sum((x[i] - mx) * (y[i] - my) for i in range(n)) / (n - 1)

    def _skewness(self, values: List[float]) -> float:
        n = len(values)
        if n < 3: return 0.0
        mu = sum(values) / n
        std = self._std(values)
        if std == 0: return 0.0
        return (n / ((n-1) * (n-2))) * sum(((x - mu) / std) ** 3 for x in values)

    def _kurtosis(self, values: List[float]) -> float:
        n = len(values)
        if n < 4: return 0.0
        mu = sum(values) / n
        std = self._std(values)
        if std == 0: return 0.0
        k = sum(((x - mu) / std) ** 4 for x in values) / n
        return k - 3  # excess kurtosis

    def _annualize(self, returns: List[float], bars_per_year: int) -> float:
        cum = 1
        for r in returns:
            cum *= (1 + r)
        return cum ** (bars_per_year / max(len(returns), 1)) - 1

    def _consecutive_streaks(self, trades: List[TradeRecord]) -> Tuple[int, int]:
        max_wins = max_losses = 0
        curr_wins = curr_losses = 0
        for t in trades:
            if t.pnl > 0:
                curr_wins += 1
                curr_losses = 0
                max_wins = max(max_wins, curr_wins)
            else:
                curr_losses += 1
                curr_wins = 0
                max_losses = max(max_losses, curr_losses)
        return max_wins, max_losses

    def _ulcer_index(self, equity: List[float]) -> float:
        peak = equity[0]
        sum_sq = 0
        for eq in equity:
            peak = max(peak, eq)
            dd = (peak - eq) / peak * 100
            sum_sq += dd ** 2
        return math.sqrt(sum_sq / len(equity)) if equity else 0

    def _empty_metrics(self) -> RiskMetrics:
        return RiskMetrics(
            total_return=0, annualized_return=0, sharpe_ratio=0, sortino_ratio=0,
            calmar_ratio=0, max_drawdown=0, max_drawdown_duration=0, avg_drawdown=0,
            volatility=0, downside_vol=0, skewness=0, kurtosis=0,
            var_95=0, var_99=0, cvar_95=0, cvar_99=0,
            beta=1, alpha=0, information_ratio=0, treynor_ratio=0,
            omega_ratio=1, tail_ratio=1, profit_factor=0, expectancy=0,
            payoff_ratio=0, win_rate=0, total_trades=0,
            avg_win=0, avg_loss=0, largest_win=0, largest_loss=0,
            avg_holding_period=0, max_consecutive_wins=0, max_consecutive_losses=0,
            ulcer_index=0, recovery_factor=0, kelly_criterion=0,
        )


# ══════════════════════════════════════════════════════════════════════
# SECTION 5: BACKTEST ENGINE
# ══════════════════════════════════════════════════════════════════════

class BacktestEngine:
    """Core backtesting engine with full strategy support"""

    def __init__(self, config: Optional[BacktestConfig] = None):
        self.config = config or BacktestConfig()
        self.executor = ExecutionSimulator(self.config)
        self.sizer = PositionSizer(self.config)
        self.analytics = BacktestRiskAnalytics(self.config.risk_free_rate)

        # State
        self.cash: float = self.config.initial_capital
        self.positions: Dict[str, BacktestPosition] = {}
        self.pending_orders: List[BacktestOrder] = []
        self.filled_orders: List[BacktestOrder] = []
        self.trades: List[TradeRecord] = []
        self.equity_curve: List[float] = [self.config.initial_capital]
        self.equity_points: List[EquityPoint] = []

        self._order_counter = 0
        self._trade_counter = 0
        self._bar_index = 0
        self._rng = random.Random(42)

    def reset(self) -> None:
        self.cash = self.config.initial_capital
        self.positions.clear()
        self.pending_orders.clear()
        self.filled_orders.clear()
        self.trades.clear()
        self.equity_curve = [self.config.initial_capital]
        self.equity_points.clear()
        self._bar_index = 0

    def submit_order(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        order_type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
    ) -> str:
        """Submit an order"""
        self._order_counter += 1
        order_id = f"BT_{self._order_counter}"
        order = BacktestOrder(
            order_id=order_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            limit_price=limit_price,
            stop_price=stop_price,
            submitted_at=float(self._bar_index),
        )
        self.pending_orders.append(order)
        return order_id

    def process_bar(self, bars: Dict[str, BacktestBar]) -> None:
        """Process a single bar for all symbols"""
        self._bar_index += 1

        # Try to fill pending orders
        for order in self.pending_orders[:]:
            bar = bars.get(order.symbol)
            if bar and self.executor.try_fill(order, bar):
                self.pending_orders.remove(order)
                self.filled_orders.append(order)
                self._update_position(order)

        # Update positions with current prices
        positions_value = 0
        for sym, pos in self.positions.items():
            bar = bars.get(sym)
            if bar:
                pos.current_price = bar.close
                pos.unrealized_pnl = (bar.close - pos.avg_cost) * pos.quantity
                pos.last_update = bar.timestamp

                # Track MAE/MFE
                if pos.quantity > 0:
                    pct_change = (bar.close - pos.avg_cost) / pos.avg_cost
                    pos.max_favorable = max(pos.max_favorable, pct_change)
                    pos.max_adverse = min(pos.max_adverse, pct_change)
                elif pos.quantity < 0:
                    pct_change = (pos.avg_cost - bar.close) / pos.avg_cost
                    pos.max_favorable = max(pos.max_favorable, pct_change)
                    pos.max_adverse = min(pos.max_adverse, pct_change)

            positions_value += pos.current_price * abs(pos.quantity)

        # Record equity
        equity = self.cash + sum(
            p.current_price * p.quantity for p in self.positions.values()
        )
        self.equity_curve.append(equity)

        peak = max(self.equity_curve)
        dd = (peak - equity) / peak if peak > 0 else 0

        # Find any timestamp
        ts = 0.0
        for bar in bars.values():
            ts = bar.timestamp
            break

        self.equity_points.append(EquityPoint(
            timestamp=ts,
            equity=round(equity, 2),
            cash=round(self.cash, 2),
            positions_value=round(positions_value, 2),
            drawdown=round(peak - equity, 2),
            drawdown_pct=round(dd, 6),
        ))

    def _update_position(self, order: BacktestOrder) -> None:
        """Update position after order fill"""
        sym = order.symbol
        if sym not in self.positions:
            self.positions[sym] = BacktestPosition(symbol=sym)

        pos = self.positions[sym]
        fill_price = order.fill_price or 0
        fill_qty = order.fill_quantity or 0

        if order.side == OrderSide.BUY:
            cost = fill_price * fill_qty + order.commission
            self.cash -= cost

            if pos.quantity >= 0:
                # Adding to long
                total_cost = pos.avg_cost * pos.quantity + fill_price * fill_qty
                pos.quantity += fill_qty
                pos.avg_cost = total_cost / pos.quantity if pos.quantity > 0 else 0
            else:
                # Covering short
                pnl = (pos.avg_cost - fill_price) * min(fill_qty, abs(pos.quantity))
                pos.realized_pnl += pnl - order.commission
                old_qty = pos.quantity
                pos.quantity += fill_qty
                if pos.quantity > 0:
                    pos.avg_cost = fill_price
                elif pos.quantity == 0:
                    self._record_trade(pos, fill_price, order)
                    pos.avg_cost = 0

            if pos.entry_date is None or pos.quantity == fill_qty:
                pos.entry_date = order.filled_at
            pos.trades += 1

        elif order.side == OrderSide.SELL:
            proceeds = fill_price * fill_qty - order.commission
            self.cash += proceeds

            if pos.quantity <= 0:
                # Adding to short
                total_cost = abs(pos.avg_cost * pos.quantity) + fill_price * fill_qty
                pos.quantity -= fill_qty
                pos.avg_cost = total_cost / abs(pos.quantity) if pos.quantity != 0 else 0
            else:
                # Selling long
                pnl = (fill_price - pos.avg_cost) * min(fill_qty, pos.quantity)
                pos.realized_pnl += pnl - order.commission
                old_qty = pos.quantity
                pos.quantity -= fill_qty
                if pos.quantity < 0:
                    pos.avg_cost = fill_price
                elif pos.quantity == 0:
                    self._record_trade(pos, fill_price, order)
                    pos.avg_cost = 0

            if pos.entry_date is None or pos.quantity == -fill_qty:
                pos.entry_date = order.filled_at
            pos.trades += 1

    def _record_trade(self, pos: BacktestPosition, exit_price: float, order: BacktestOrder) -> None:
        """Record a completed trade"""
        self._trade_counter += 1
        entry_time = pos.entry_date or 0
        exit_time = order.filled_at or 0
        pnl = pos.realized_pnl
        quantity = abs(order.fill_quantity or 0)
        entry_price = pos.avg_cost

        self.trades.append(TradeRecord(
            trade_id=f"TRD_{self._trade_counter}",
            symbol=pos.symbol,
            side="long" if order.side == OrderSide.SELL else "short",
            quantity=quantity,
            entry_price=round(entry_price, 4),
            exit_price=round(exit_price, 4),
            entry_time=entry_time,
            exit_time=exit_time,
            pnl=round(pnl, 2),
            pnl_pct=round(pnl / (entry_price * quantity), 6) if entry_price * quantity > 0 else 0,
            commission=round(order.commission, 4),
            holding_period=exit_time - entry_time if exit_time and entry_time else 0,
            mae=round(pos.max_adverse, 6),
            mfe=round(pos.max_favorable, 6),
        ))

        # Reset position tracking
        pos.max_favorable = 0
        pos.max_adverse = 0
        pos.realized_pnl = 0

    def get_equity(self) -> float:
        return self.equity_curve[-1] if self.equity_curve else self.config.initial_capital

    def get_position(self, symbol: str) -> Optional[BacktestPosition]:
        return self.positions.get(symbol)


# ══════════════════════════════════════════════════════════════════════
# SECTION 6: MONTE CARLO SIMULATOR
# ══════════════════════════════════════════════════════════════════════

class MonteCarloSimulator:
    """Monte Carlo simulation for backtest results"""

    def __init__(self, n_trials: int = 1000, seed: int = 42):
        self.n_trials = n_trials
        self.rng = random.Random(seed)

    def bootstrap_returns(self, returns: List[float], n_periods: Optional[int] = None) -> MonteCarloResult:
        """Bootstrap simulation of returns"""
        n = n_periods or len(returns)
        if not returns:
            return MonteCarloResult(trials=0, median_return=0, mean_return=0,
                                    p5_return=0, p25_return=0, p75_return=0, p95_return=0,
                                    median_drawdown=0, p95_drawdown=0, ruin_probability=0)

        terminal_returns = []
        max_drawdowns = []

        for _ in range(self.n_trials):
            # Resample returns with replacement
            sampled = [self.rng.choice(returns) for _ in range(n)]
            equity = 1.0
            peak = 1.0
            max_dd = 0

            for r in sampled:
                equity *= (1 + r)
                peak = max(peak, equity)
                dd = (peak - equity) / peak
                max_dd = max(max_dd, dd)

            terminal_returns.append(equity - 1)
            max_drawdowns.append(max_dd)

        terminal_returns.sort()
        max_drawdowns.sort()

        def pct(arr, p):
            idx = int(len(arr) * p)
            return arr[min(idx, len(arr)-1)]

        ruin_count = sum(1 for r in terminal_returns if r < -0.5)

        return MonteCarloResult(
            trials=self.n_trials,
            median_return=round(pct(terminal_returns, 0.5), 6),
            mean_return=round(sum(terminal_returns) / len(terminal_returns), 6),
            p5_return=round(pct(terminal_returns, 0.05), 6),
            p25_return=round(pct(terminal_returns, 0.25), 6),
            p75_return=round(pct(terminal_returns, 0.75), 6),
            p95_return=round(pct(terminal_returns, 0.95), 6),
            median_drawdown=round(pct(max_drawdowns, 0.5), 6),
            p95_drawdown=round(pct(max_drawdowns, 0.95), 6),
            ruin_probability=round(ruin_count / self.n_trials, 6),
            confidence_intervals={
                "90%": {"lower": round(pct(terminal_returns, 0.05), 6),
                        "upper": round(pct(terminal_returns, 0.95), 6)},
                "95%": {"lower": round(pct(terminal_returns, 0.025), 6),
                        "upper": round(pct(terminal_returns, 0.975), 6)},
                "99%": {"lower": round(pct(terminal_returns, 0.005), 6),
                        "upper": round(pct(terminal_returns, 0.995), 6)},
            },
            distribution=terminal_returns[::max(1, len(terminal_returns) // 50)],  # Sample for response
        )

    def trade_shuffle(self, trades: List[TradeRecord], initial_capital: float = 1_000_000) -> MonteCarloResult:
        """Shuffle trade order to test path dependency"""
        if not trades:
            return MonteCarloResult(trials=0, median_return=0, mean_return=0,
                                    p5_return=0, p25_return=0, p75_return=0, p95_return=0,
                                    median_drawdown=0, p95_drawdown=0, ruin_probability=0)

        terminal_returns = []
        max_drawdowns = []

        for _ in range(self.n_trials):
            shuffled = trades[:]
            self.rng.shuffle(shuffled)

            equity = initial_capital
            peak = equity
            max_dd = 0

            for t in shuffled:
                equity += t.pnl
                peak = max(peak, equity)
                dd = (peak - equity) / peak if peak > 0 else 0
                max_dd = max(max_dd, dd)

            terminal_returns.append((equity - initial_capital) / initial_capital)
            max_drawdowns.append(max_dd)

        terminal_returns.sort()
        max_drawdowns.sort()

        def pct(arr, p):
            idx = int(len(arr) * p)
            return arr[min(idx, len(arr)-1)]

        return MonteCarloResult(
            trials=self.n_trials,
            median_return=round(pct(terminal_returns, 0.5), 6),
            mean_return=round(sum(terminal_returns) / len(terminal_returns), 6),
            p5_return=round(pct(terminal_returns, 0.05), 6),
            p25_return=round(pct(terminal_returns, 0.25), 6),
            p75_return=round(pct(terminal_returns, 0.75), 6),
            p95_return=round(pct(terminal_returns, 0.95), 6),
            median_drawdown=round(pct(max_drawdowns, 0.5), 6),
            p95_drawdown=round(pct(max_drawdowns, 0.95), 6),
            ruin_probability=round(sum(1 for r in terminal_returns if r < -0.5) / self.n_trials, 6),
            distribution=terminal_returns[::max(1, len(terminal_returns) // 50)],
        )


# ══════════════════════════════════════════════════════════════════════
# SECTION 7: WALK-FORWARD ANALYZER
# ══════════════════════════════════════════════════════════════════════

class WalkForwardAnalyzer:
    """Walk-forward optimization and analysis"""

    def __init__(self, n_windows: int = 5, train_ratio: float = 0.7):
        self.n_windows = n_windows
        self.train_ratio = train_ratio

    def analyze(
        self,
        bars: List[BacktestBar],
        strategy_fn: Callable[[List[BacktestBar], Dict[str, Any]], List[float]],
        param_grid: List[Dict[str, Any]],
    ) -> List[WalkForwardWindow]:
        """Run walk-forward analysis"""
        n = len(bars)
        window_size = n // self.n_windows
        results = []

        for w in range(self.n_windows):
            test_end = (w + 1) * window_size
            train_size = int(test_end * self.train_ratio)
            test_start = train_size

            if test_end > n or train_size < 50:
                break

            train_bars = bars[:train_size]
            test_bars = bars[test_start:test_end]

            # Optimize on train set
            best_params = param_grid[0] if param_grid else {}
            best_sharpe = -999
            for params in param_grid:
                try:
                    signals = strategy_fn(train_bars, params)
                    returns = self._signals_to_returns(signals, train_bars)
                    sharpe = self._compute_sharpe(returns)
                    if sharpe > best_sharpe:
                        best_sharpe = sharpe
                        best_params = params
                except Exception:
                    continue

            # Apply best params to test set
            try:
                in_signals = strategy_fn(train_bars, best_params)
                out_signals = strategy_fn(test_bars, best_params)
                in_returns = self._signals_to_returns(in_signals, train_bars)
                out_returns = self._signals_to_returns(out_signals, test_bars)
            except Exception:
                in_returns = []
                out_returns = []

            in_sample_ret = sum(in_returns) if in_returns else 0
            out_sample_ret = sum(out_returns) if out_returns else 0
            in_sharpe = self._compute_sharpe(in_returns)
            out_sharpe = self._compute_sharpe(out_returns)
            efficiency = out_sharpe / in_sharpe if in_sharpe > 0 else 0

            results.append(WalkForwardWindow(
                window_index=w,
                train_start=0,
                train_end=train_size,
                test_start=test_start,
                test_end=test_end,
                in_sample_return=round(in_sample_ret, 6),
                out_sample_return=round(out_sample_ret, 6),
                in_sample_sharpe=round(in_sharpe, 4),
                out_sample_sharpe=round(out_sharpe, 4),
                parameters=best_params,
                efficiency_ratio=round(efficiency, 4),
            ))

        return results

    def _signals_to_returns(self, signals: List[float], bars: List[BacktestBar]) -> List[float]:
        returns = []
        for i in range(1, min(len(signals), len(bars))):
            bar_ret = (bars[i].close - bars[i-1].close) / bars[i-1].close if bars[i-1].close > 0 else 0
            returns.append(signals[i-1] * bar_ret)
        return returns

    def _compute_sharpe(self, returns: List[float], rf: float = 0.04 / 252) -> float:
        if len(returns) < 10:
            return 0
        excess = [r - rf for r in returns]
        mean_excess = sum(excess) / len(excess)
        std = math.sqrt(sum((r - mean_excess) ** 2 for r in excess) / (len(excess) - 1)) if len(excess) > 1 else 0
        return (mean_excess / std) * math.sqrt(252) if std > 0 else 0


# ══════════════════════════════════════════════════════════════════════
# SECTION 8: SERVICE FACADE
# ══════════════════════════════════════════════════════════════════════

class BacktestingService:
    """Unified backtesting service for Apex Terminal"""

    def __init__(self, config: Optional[BacktestConfig] = None):
        self.config = config or BacktestConfig()
        self.engine = BacktestEngine(self.config)
        self.monte_carlo = MonteCarloSimulator(self.config.monte_carlo_trials)
        self.walk_forward = WalkForwardAnalyzer(self.config.walk_forward_windows)
        logger.info("BacktestingService initialized")

    def generate_demo_bars(self, n_bars: int = 504, symbol: str = "DEMO", seed: int = 42) -> List[BacktestBar]:
        """Generate synthetic price bars for demo"""
        rng = random.Random(seed)
        price = 450.0
        bars = []
        ts = 1700000000.0  # arbitrary start

        for i in range(n_bars):
            drift = 0.0003
            vol = 0.012
            change = rng.gauss(drift, vol)
            o = price
            c = o * (1 + change)
            h = max(o, c) * (1 + abs(rng.gauss(0, 0.004)))
            l = min(o, c) * (1 - abs(rng.gauss(0, 0.004)))
            v = int(5e6 + rng.gauss(0, 2e6) + abs(change) * 1e8)

            bars.append(BacktestBar(
                timestamp=ts + i * 86400,
                open=round(o, 2),
                high=round(h, 2),
                low=round(l, 2),
                close=round(c, 2),
                volume=max(1000, v),
                symbol=symbol,
            ))
            price = c

        return bars

    def run_momentum_strategy(self, n_bars: int = 504, lookback: int = 20, threshold: float = 0.02) -> FullBacktestResult:
        """Run a simple momentum strategy backtest"""
        import time as time_mod
        start = time_mod.time()

        bars = self.generate_demo_bars(n_bars)
        self.engine.reset()

        for i in range(lookback, len(bars)):
            current = bars[i]
            bar_dict = {current.symbol: current}

            # Momentum signal
            momentum = (bars[i].close - bars[i - lookback].close) / bars[i - lookback].close

            pos = self.engine.get_position(current.symbol)
            qty = pos.quantity if pos else 0

            if momentum > threshold and qty <= 0:
                # Buy signal
                size = self.engine.sizer.calculate_size(
                    self.config.position_sizing,
                    self.engine.get_equity(),
                    current.close,
                )
                if size > 0:
                    if qty < 0:
                        self.engine.submit_order(current.symbol, OrderSide.BUY, abs(qty))  # Cover
                    self.engine.submit_order(current.symbol, OrderSide.BUY, size)

            elif momentum < -threshold and qty >= 0:
                # Sell signal
                if qty > 0:
                    self.engine.submit_order(current.symbol, OrderSide.SELL, qty)  # Flatten

            self.engine.process_bar(bar_dict)

        # Close any remaining positions
        if bars:
            last = bars[-1]
            for sym, pos in list(self.engine.positions.items()):
                if pos.quantity > 0:
                    self.engine.submit_order(sym, OrderSide.SELL, pos.quantity)
                elif pos.quantity < 0:
                    self.engine.submit_order(sym, OrderSide.BUY, abs(pos.quantity))
            self.engine.process_bar({last.symbol: last})

        # Compute analytics
        risk_metrics = self.engine.analytics.compute_metrics(
            self.engine.equity_curve,
            self.engine.trades,
        )

        # Monte Carlo
        returns = [(self.engine.equity_curve[i] - self.engine.equity_curve[i-1]) / self.engine.equity_curve[i-1]
                    for i in range(1, len(self.engine.equity_curve)) if self.engine.equity_curve[i-1] != 0]
        mc_result = self.monte_carlo.bootstrap_returns(returns)

        # Monthly returns
        monthly = []
        for m in range(0, len(returns), 21):
            chunk = returns[m:m+21]
            if chunk:
                cum = 1.0
                for r in chunk:
                    cum *= (1 + r)
                monthly.append({"month": m // 21, "return": round(cum - 1, 6)})

        # Annual returns
        annual = []
        for y in range(0, len(returns), 252):
            chunk = returns[y:y+252]
            if chunk:
                cum = 1.0
                for r in chunk:
                    cum *= (1 + r)
                annual.append({"year": y // 252, "return": round(cum - 1, 6)})

        elapsed = (time_mod.time() - start) * 1000

        # Run ID
        run_id = hashlib.md5(f"{n_bars}_{lookback}_{threshold}_{datetime.utcnow().isoformat()}".encode()).hexdigest()[:12]

        return FullBacktestResult(
            config=asdict(self.config),
            risk_metrics=asdict(risk_metrics),
            equity_curve=[asdict(ep) for ep in self.engine.equity_points[::max(1, len(self.engine.equity_points) // 200)]],
            trades=[asdict(t) for t in self.engine.trades[:100]],
            monthly_returns=monthly,
            annual_returns=annual,
            drawdown_analysis=self.engine.analytics._compute_drawdowns(self.engine.equity_curve),
            monte_carlo=asdict(mc_result),
            run_id=run_id,
            run_at=datetime.utcnow().isoformat(),
            duration_ms=round(elapsed, 2),
        )

    def run_mean_reversion_strategy(self, n_bars: int = 504, lookback: int = 20, z_threshold: float = 2.0) -> FullBacktestResult:
        """Run a mean reversion strategy backtest"""
        import time as time_mod
        start = time_mod.time()

        bars = self.generate_demo_bars(n_bars, seed=99)
        self.engine.reset()

        for i in range(lookback, len(bars)):
            current = bars[i]
            bar_dict = {current.symbol: current}

            # Z-score
            window = [bars[j].close for j in range(i - lookback, i)]
            mean_price = sum(window) / len(window)
            std_price = math.sqrt(sum((p - mean_price) ** 2 for p in window) / (len(window) - 1)) if len(window) > 1 else 0
            z_score = (current.close - mean_price) / std_price if std_price > 0 else 0

            pos = self.engine.get_position(current.symbol)
            qty = pos.quantity if pos else 0

            if z_score < -z_threshold and qty <= 0:
                size = self.engine.sizer.calculate_size(
                    self.config.position_sizing,
                    self.engine.get_equity(),
                    current.close,
                )
                if size > 0:
                    self.engine.submit_order(current.symbol, OrderSide.BUY, size)

            elif z_score > z_threshold and qty >= 0:
                if qty > 0:
                    self.engine.submit_order(current.symbol, OrderSide.SELL, qty)

            elif abs(z_score) < 0.5 and qty != 0:
                # Close at mean
                if qty > 0:
                    self.engine.submit_order(current.symbol, OrderSide.SELL, qty)
                elif qty < 0:
                    self.engine.submit_order(current.symbol, OrderSide.BUY, abs(qty))

            self.engine.process_bar(bar_dict)

        # Compute results (same as momentum)
        risk_metrics = self.engine.analytics.compute_metrics(
            self.engine.equity_curve,
            self.engine.trades,
        )

        returns = [(self.engine.equity_curve[i] - self.engine.equity_curve[i-1]) / self.engine.equity_curve[i-1]
                    for i in range(1, len(self.engine.equity_curve)) if self.engine.equity_curve[i-1] != 0]
        mc_result = self.monte_carlo.bootstrap_returns(returns)

        elapsed = (time_mod.time() - start) * 1000
        run_id = hashlib.md5(f"mr_{n_bars}_{lookback}_{z_threshold}".encode()).hexdigest()[:12]

        return FullBacktestResult(
            config=asdict(self.config),
            risk_metrics=asdict(risk_metrics),
            equity_curve=[asdict(ep) for ep in self.engine.equity_points[::max(1, len(self.engine.equity_points) // 200)]],
            trades=[asdict(t) for t in self.engine.trades[:100]],
            monthly_returns=[],
            annual_returns=[],
            drawdown_analysis=self.engine.analytics._compute_drawdowns(self.engine.equity_curve),
            monte_carlo=asdict(mc_result),
            run_id=run_id,
            run_at=datetime.utcnow().isoformat(),
            duration_ms=round(elapsed, 2),
        )

    def run_pairs_trading_strategy(self, n_bars: int = 504) -> FullBacktestResult:
        """Run a pairs trading strategy backtest"""
        import time as time_mod
        start = time_mod.time()

        bars_a = self.generate_demo_bars(n_bars, symbol="STOCK_A", seed=42)
        bars_b = self.generate_demo_bars(n_bars, symbol="STOCK_B", seed=84)
        self.engine.reset()

        lookback = 30
        z_entry = 2.0
        z_exit = 0.5

        for i in range(lookback, n_bars):
            bar_dict = {"STOCK_A": bars_a[i], "STOCK_B": bars_b[i]}

            # Spread = log(A) - log(B)
            spreads = [math.log(bars_a[j].close) - math.log(bars_b[j].close) for j in range(i - lookback, i)]
            mean_spread = sum(spreads) / len(spreads)
            std_spread = math.sqrt(sum((s - mean_spread) ** 2 for s in spreads) / (len(spreads) - 1)) if len(spreads) > 1 else 0
            current_spread = math.log(bars_a[i].close) - math.log(bars_b[i].close)
            z = (current_spread - mean_spread) / std_spread if std_spread > 0 else 0

            pos_a = self.engine.get_position("STOCK_A")
            qty_a = pos_a.quantity if pos_a else 0

            # Spread too wide: short A, long B
            if z > z_entry and qty_a >= 0:
                size = self.engine.sizer.calculate_size(
                    PositionSizing.PERCENT_EQUITY, self.engine.get_equity(), bars_a[i].close,
                )
                if size > 0:
                    if qty_a > 0:
                        self.engine.submit_order("STOCK_A", OrderSide.SELL, qty_a)
                    self.engine.submit_order("STOCK_A", OrderSide.SELL, size)
                    size_b = int(size * bars_a[i].close / bars_b[i].close)
                    if size_b > 0:
                        self.engine.submit_order("STOCK_B", OrderSide.BUY, size_b)

            # Spread too narrow: long A, short B
            elif z < -z_entry and qty_a <= 0:
                size = self.engine.sizer.calculate_size(
                    PositionSizing.PERCENT_EQUITY, self.engine.get_equity(), bars_a[i].close,
                )
                if size > 0:
                    if qty_a < 0:
                        self.engine.submit_order("STOCK_A", OrderSide.BUY, abs(qty_a))
                    self.engine.submit_order("STOCK_A", OrderSide.BUY, size)
                    size_b = int(size * bars_a[i].close / bars_b[i].close)
                    if size_b > 0:
                        self.engine.submit_order("STOCK_B", OrderSide.SELL, size_b)

            # Exit zone
            elif abs(z) < z_exit and qty_a != 0:
                for sym in ["STOCK_A", "STOCK_B"]:
                    p = self.engine.get_position(sym)
                    if p and p.quantity > 0:
                        self.engine.submit_order(sym, OrderSide.SELL, p.quantity)
                    elif p and p.quantity < 0:
                        self.engine.submit_order(sym, OrderSide.BUY, abs(p.quantity))

            self.engine.process_bar(bar_dict)

        risk_metrics = self.engine.analytics.compute_metrics(
            self.engine.equity_curve,
            self.engine.trades,
        )

        elapsed = (time_mod.time() - start) * 1000
        run_id = hashlib.md5(f"pairs_{n_bars}".encode()).hexdigest()[:12]

        return FullBacktestResult(
            config=asdict(self.config),
            risk_metrics=asdict(risk_metrics),
            equity_curve=[asdict(ep) for ep in self.engine.equity_points[::max(1, len(self.engine.equity_points) // 200)]],
            trades=[asdict(t) for t in self.engine.trades[:100]],
            monthly_returns=[],
            annual_returns=[],
            drawdown_analysis=self.engine.analytics._compute_drawdowns(self.engine.equity_curve),
            run_id=run_id,
            run_at=datetime.utcnow().isoformat(),
            duration_ms=round(elapsed, 2),
        )

    def compare_strategies(self) -> Dict[str, Any]:
        """Run and compare multiple strategies"""
        results = {}
        for name, fn in [
            ("momentum", lambda: self.run_momentum_strategy()),
            ("mean_reversion", lambda: self.run_mean_reversion_strategy()),
            ("pairs", lambda: self.run_pairs_trading_strategy()),
        ]:
            try:
                result = fn()
                results[name] = {
                    "risk_metrics": result.risk_metrics,
                    "trade_count": len(result.trades),
                    "run_id": result.run_id,
                    "duration_ms": result.duration_ms,
                }
            except Exception as e:
                results[name] = {"error": str(e)}

        return {"comparison": results, "run_at": datetime.utcnow().isoformat()}
