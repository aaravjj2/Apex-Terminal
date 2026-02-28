"""
backtest_engine.py — Event-Driven Backtesting Engine
====================================================
Full-featured backtesting system with:

  Event-driven simulation:
    - Bar-by-bar event loop (no look-ahead bias)
    - Market, Limit, Stop, Stop-Limit order types
    - Partial fills, order expiry, GTD/GTC/DAY orders
    - Realistic slippage model (volume-based)
    - Commission model (fixed, per-share, percentage, tiered)

  Strategy framework:
    - Strategy base class with standard lifecycle hooks
    - Built-in popular strategies (MA cross, RSI, BB mean reversion)
    - Signal-based and rule-based strategy support
    - Multi-asset (runs on a portfolio of symbols simultaneously)

  Risk management:
    - Position sizing (fixed fractional, Kelly criterion, ATR-based)
    - Portfolio-level risk limits (max drawdown, concentration)
    - Stop-loss, take-profit, trailing stop auto-management

  Performance analytics:
    - Full tearsheet metrics
    - Trade statistics (win rate, profit factor, avg hold time)
    - Walk-forward optimization framework
    - Monte Carlo simulation of strategy results
    - Benchmark comparison

  Data formats:
    - Accepts pd.DataFrame with OHLCV + any indicator columns
    - Vectorized pre-computation of indicators before simulation
"""

from __future__ import annotations
import math
import numpy as np
import pandas as pd
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import copy


# ─── ENUMS & CONSTANTS ───────────────────────────────────────────────────────

class OrderType(str, Enum):
    MARKET     = "market"
    LIMIT      = "limit"
    STOP       = "stop"
    STOP_LIMIT = "stop_limit"


class OrderSide(str, Enum):
    BUY  = "buy"
    SELL = "sell"


class OrderStatus(str, Enum):
    PENDING   = "pending"
    PARTIAL   = "partial"
    FILLED    = "filled"
    CANCELLED = "cancelled"
    EXPIRED   = "expired"
    REJECTED  = "rejected"


class OrderTIF(str, Enum):  # Time In Force
    DAY = "day"
    GTC = "gtc"   # Good Till Cancelled
    GTD = "gtd"   # Good Till Date
    IOC = "ioc"   # Immediate or Cancel
    FOK = "fok"   # Fill or Kill


class PositionDirection(str, Enum):
    LONG  = "long"
    SHORT = "short"


# ─── DATA STRUCTURES ─────────────────────────────────────────────────────────

@dataclass
class Order:
    """Represents a single order in the backtesting engine."""
    order_id:     str
    symbol:       str
    side:         OrderSide
    order_type:   OrderType
    quantity:     float
    limit_price:  Optional[float] = None
    stop_price:   Optional[float] = None
    tif:          OrderTIF = OrderTIF.DAY
    gtd_date:     Optional[pd.Timestamp] = None
    status:       OrderStatus = OrderStatus.PENDING
    filled_qty:   float = 0.0
    avg_fill:     float = 0.0
    commission:   float = 0.0
    slippage:     float = 0.0
    submitted_at: Optional[pd.Timestamp] = None
    filled_at:    Optional[pd.Timestamp] = None
    tags:         Dict[str, Any] = field(default_factory=dict)


@dataclass
class Fill:
    """A single execution fill record."""
    order_id:  str
    symbol:    str
    side:      OrderSide
    quantity:  float
    price:     float
    commission: float
    slippage:  float
    timestamp: pd.Timestamp


@dataclass
class Position:
    """Current open position in a symbol."""
    symbol:        str
    direction:     PositionDirection
    quantity:      float
    avg_cost:      float
    market_value:  float = 0.0
    unrealised_pnl: float = 0.0
    realised_pnl:  float = 0.0
    open_time:     Optional[pd.Timestamp] = None
    stop_loss:     Optional[float] = None
    take_profit:   Optional[float] = None
    trailing_stop: Optional[float] = None  # Trailing distance in $
    trailing_high: Optional[float] = None  # Highest price seen since entry


@dataclass
class Trade:
    """A completed round-trip trade."""
    trade_id:    int
    symbol:      str
    entry_time:  pd.Timestamp
    exit_time:   pd.Timestamp
    direction:   str
    entry_price: float
    exit_price:  float
    quantity:    float
    gross_pnl:   float
    commission:  float
    net_pnl:     float
    hold_bars:   int
    return_pct:  float
    mae:         float = 0.0   # Maximum Adverse Excursion
    mfe:         float = 0.0   # Maximum Favorable Excursion


@dataclass
class BacktestResult:
    """Full backtest results container."""
    equity_curve:        pd.Series
    positions_history:   pd.DataFrame
    trades:              List[Trade]
    orders:              List[Order]
    fills:               List[Fill]
    metrics:             Dict[str, float]
    params:              Dict[str, Any]
    strategy_name:       str


# ─── COMMISSION MODELS ────────────────────────────────────────────────────────

class CommissionModel:
    """Base commission model."""
    def compute(self, symbol: str, qty: float, price: float) -> float:
        raise NotImplementedError


class FixedCommission(CommissionModel):
    """Fixed dollar per trade."""
    def __init__(self, amount: float = 1.00):
        self.amount = amount
    def compute(self, symbol: str, qty: float, price: float) -> float:
        return self.amount


class PerShareCommission(CommissionModel):
    """Per share / contract commission."""
    def __init__(self, rate: float = 0.005, minimum: float = 1.00):
        self.rate = rate
        self.minimum = minimum
    def compute(self, symbol: str, qty: float, price: float) -> float:
        return max(self.minimum, abs(qty) * self.rate)


class PercentageCommission(CommissionModel):
    """Percentage of trade value."""
    def __init__(self, rate: float = 0.001, minimum: float = 1.00):
        self.rate = rate
        self.minimum = minimum
    def compute(self, symbol: str, qty: float, price: float) -> float:
        return max(self.minimum, abs(qty) * price * self.rate)


class TieredCommission(CommissionModel):
    """Tiered commission structure (mimics Interactive Brokers)."""
    def __init__(self):
        self.tiers = [
            (300_000, 0.0035),
            (3_000_000, 0.0020),
            (20_000_000, 0.0015),
            (100_000_000, 0.0010),
            (float("inf"), 0.0005),
        ]
    def compute(self, symbol: str, qty: float, price: float) -> float:
        notional = abs(qty) * price
        for tier_notional, rate in self.tiers:
            if notional <= tier_notional:
                return max(1.00, notional * rate)
        return max(1.00, notional * 0.0005)


# ─── SLIPPAGE MODELS ──────────────────────────────────────────────────────────

class SlippageModel:
    """Base slippage model."""
    def compute(self, symbol: str, qty: float, price: float, volume: float,
                side: OrderSide) -> float:
        raise NotImplementedError


class FixedSlippage(SlippageModel):
    """Fixed dollar slippage per share."""
    def __init__(self, per_share: float = 0.01):
        self.per_share = per_share
    def compute(self, symbol: str, qty: float, price: float, volume: float,
                side: OrderSide) -> float:
        return self.per_share * (1 if side == OrderSide.BUY else -1)


class VolumeSlippage(SlippageModel):
    """
    Volume-based market impact slippage.
    Order size as % of daily volume affects price: larger orders = more slippage.
    """
    def __init__(self, impact_factor: float = 0.1):
        self.impact_factor = impact_factor
    def compute(self, symbol: str, qty: float, price: float, volume: float,
                side: OrderSide) -> float:
        if volume <= 0:
            pct_vol = 0.01
        else:
            pct_vol = abs(qty) / volume
        slip_pct = self.impact_factor * math.sqrt(pct_vol)
        slip_dollar = price * slip_pct
        return slip_dollar * (1 if side == OrderSide.BUY else -1)


class SpreadSlippage(SlippageModel):
    """Half-spread slippage model."""
    def __init__(self, half_spread_pct: float = 0.0005):
        self.half_spread = half_spread_pct
    def compute(self, symbol: str, qty: float, price: float, volume: float,
                side: OrderSide) -> float:
        return price * self.half_spread * (1 if side == OrderSide.BUY else -1)


# ─── POSITION SIZER ──────────────────────────────────────────────────────────

class PositionSizer:
    """Base position sizer."""
    def compute_size(self, portfolio_value: float, risk_pct: float, price: float,
                     stop_loss: Optional[float] = None, atr: Optional[float] = None) -> float:
        raise NotImplementedError


class FixedFractional(PositionSizer):
    """Risk a fixed fraction of portfolio per trade."""
    def __init__(self, risk_pct: float = 0.02):
        self.risk_pct = risk_pct
    def compute_size(self, portfolio_value: float, risk_pct: float, price: float,
                     stop_loss: Optional[float] = None, atr: Optional[float] = None) -> float:
        r = risk_pct or self.risk_pct
        risk_amount = portfolio_value * r
        if stop_loss and stop_loss > 0:
            risk_per_share = abs(price - stop_loss)
        elif atr:
            risk_per_share = atr * 2
        else:
            risk_per_share = price * 0.02
        return max(1, math.floor(risk_amount / risk_per_share))


class ATRSizer(PositionSizer):
    """ATR-based position sizing (Turtle Trading style)."""
    def __init__(self, risk_pct: float = 0.02, atr_stop_multiples: float = 2.0):
        self.risk_pct = risk_pct
        self.atr_multiples = atr_stop_multiples
    def compute_size(self, portfolio_value: float, risk_pct: float, price: float,
                     stop_loss: Optional[float] = None, atr: Optional[float] = None) -> float:
        if not atr or atr <= 0:
            return max(1, math.floor(portfolio_value * (risk_pct or self.risk_pct) / price / 0.02))
        risk_amount = portfolio_value * (risk_pct or self.risk_pct)
        risk_per_share = self.atr_multiples * atr
        return max(1, math.floor(risk_amount / risk_per_share))


class KellyCriterion(PositionSizer):
    """Kelly Criterion position sizing."""
    def __init__(self, win_rate: float = 0.55, avg_win: float = 1.5, avg_loss: float = 1.0,
                 kelly_fraction: float = 0.5):
        self.win_rate = win_rate
        self.avg_win  = avg_win
        self.avg_loss = avg_loss
        self.kelly_fraction = kelly_fraction  # Half-Kelly is common

    def compute_size(self, portfolio_value: float, risk_pct: float, price: float,
                     stop_loss: Optional[float] = None, atr: Optional[float] = None) -> float:
        if self.avg_loss == 0:
            return 0
        b = self.avg_win / self.avg_loss
        p = self.win_rate
        q = 1 - p
        kelly = (b * p - q) / b
        kelly *= self.kelly_fraction
        kelly = max(0, min(kelly, 0.25))  # Cap at 25%
        position_value = portfolio_value * kelly
        return max(1, math.floor(position_value / price))


# ─── BASE STRATEGY ───────────────────────────────────────────────────────────

class Strategy(ABC):
    """
    Abstract base class for all backtesting strategies.

    Lifecycle:
        on_start()          → called once before simulation begins
        on_bar(bar, state)  → called every bar
        on_fill(fill)       → called when an order is filled
        on_end()            → called once after simulation ends
    """

    def __init__(self, params: Optional[Dict] = None):
        self.params: Dict = params or {}
        self.engine: Optional["BacktestEngine"] = None

    def on_start(self) -> None:
        """Called once before the first bar."""
        pass

    @abstractmethod
    def on_bar(self, bar: pd.Series, state: "PortfolioState") -> List[Order]:
        """
        Called for each bar. Return list of orders to submit.

        Args:
            bar:   Current OHLCV + indicators bar (pd.Series indexed by column)
            state: Current portfolio state

        Returns:
            List of Order objects to submit (can be empty)
        """
        ...

    def on_fill(self, fill: Fill, state: "PortfolioState") -> None:
        """Called when an order fill occurs."""
        pass

    def on_end(self, state: "PortfolioState") -> None:
        """Called once at the end of simulation."""
        pass

    # ── Order helpers ─────────────────────────────────────────────────────────

    def buy_market(self, symbol: str, qty: float, **tags) -> Order:
        return Order(order_id=f"O_{id(tags)}", symbol=symbol, side=OrderSide.BUY,
                     order_type=OrderType.MARKET, quantity=qty, tags=tags)

    def sell_market(self, symbol: str, qty: float, **tags) -> Order:
        return Order(order_id=f"O_{id(tags)}", symbol=symbol, side=OrderSide.SELL,
                     order_type=OrderType.MARKET, quantity=qty, tags=tags)

    def buy_limit(self, symbol: str, qty: float, limit: float,
                  tif: OrderTIF = OrderTIF.DAY, **tags) -> Order:
        return Order(order_id=f"O_{id(tags)}", symbol=symbol, side=OrderSide.BUY,
                     order_type=OrderType.LIMIT, quantity=qty, limit_price=limit, tif=tif, tags=tags)

    def sell_limit(self, symbol: str, qty: float, limit: float,
                   tif: OrderTIF = OrderTIF.DAY, **tags) -> Order:
        return Order(order_id=f"O_{id(tags)}", symbol=symbol, side=OrderSide.SELL,
                     order_type=OrderType.LIMIT, quantity=qty, limit_price=limit, tif=tif, tags=tags)

    def buy_stop(self, symbol: str, qty: float, stop: float, **tags) -> Order:
        return Order(order_id=f"O_{id(tags)}", symbol=symbol, side=OrderSide.BUY,
                     order_type=OrderType.STOP, quantity=qty, stop_price=stop, tags=tags)

    def sell_stop(self, symbol: str, qty: float, stop: float, **tags) -> Order:
        return Order(order_id=f"O_{id(tags)}", symbol=symbol, side=OrderSide.SELL,
                     order_type=OrderType.STOP, quantity=qty, stop_price=stop, tags=tags)


# ─── EXAMPLE STRATEGIES ──────────────────────────────────────────────────────

class MovingAverageCrossStrategy(Strategy):
    """
    Classic dual-moving-average crossover strategy.
    Params: fast_period, slow_period, symbol
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.position_open = False

    def on_bar(self, bar: pd.Series, state: "PortfolioState") -> List[Order]:
        orders = []
        fast_p = self.params.get("fast_period", 10)
        slow_p = self.params.get("slow_period", 30)
        symbol = self.params.get("symbol", bar.get("symbol", "UNKNOWN"))

        fast_col = f"SMA_{fast_p}"
        slow_col = f"SMA_{slow_p}"

        if fast_col not in bar.index or slow_col not in bar.index:
            return orders
        if pd.isna(bar[fast_col]) or pd.isna(bar[slow_col]):
            return orders

        fast_prev = bar.get(f"{fast_col}_prev", bar[fast_col])
        slow_prev = bar.get(f"{slow_col}_prev", bar[slow_col])

        pos_qty = state.positions.get(symbol, Position(symbol=symbol,
                    direction=PositionDirection.LONG, quantity=0, avg_cost=0)).quantity

        # Golden cross: enter long
        if bar[fast_col] > bar[slow_col] and fast_prev <= slow_prev and pos_qty == 0:
            size = FixedFractional(0.02).compute_size(state.cash + state.equity, 0.02, bar["close"])
            orders.append(self.buy_market(symbol, size))

        # Death cross: exit
        elif bar[fast_col] < bar[slow_col] and fast_prev >= slow_prev and pos_qty > 0:
            orders.append(self.sell_market(symbol, pos_qty))

        return orders


class RSIMeanReversionStrategy(Strategy):
    """
    RSI mean reversion: buy oversold, sell overbought.
    Params: rsi_period, oversold, overbought, symbol
    """
    def on_bar(self, bar: pd.Series, state: "PortfolioState") -> List[Order]:
        orders = []
        rsi_p   = self.params.get("rsi_period", 14)
        os_lvl  = self.params.get("oversold", 30)
        ob_lvl  = self.params.get("overbought", 70)
        symbol  = self.params.get("symbol", "UNKNOWN")
        rsi_col = f"RSI_{rsi_p}"

        if rsi_col not in bar.index or pd.isna(bar[rsi_col]):
            return orders

        pos_qty = 0
        if symbol in state.positions:
            pos_qty = state.positions[symbol].quantity

        if bar[rsi_col] < os_lvl and pos_qty == 0:
            size = FixedFractional(0.02).compute_size(state.cash + state.equity, 0.02, bar["close"])
            orders.append(self.buy_market(symbol, size))
        elif bar[rsi_col] > ob_lvl and pos_qty > 0:
            orders.append(self.sell_market(symbol, pos_qty))

        return orders


class BollingerBandStrategy(Strategy):
    """
    Bollinger Band mean reversion with ATR-based stops.
    Params: bb_period, bb_std, atr_period, stop_atr_mult
    """
    def on_bar(self, bar: pd.Series, state: "PortfolioState") -> List[Order]:
        orders = []
        period  = self.params.get("bb_period", 20)
        std_dev = self.params.get("bb_std", 2.0)
        atr_p   = self.params.get("atr_period", 14)
        symbol  = self.params.get("symbol", "UNKNOWN")

        upper_col = f"BB_Upper_{period}"
        lower_col = f"BB_Lower_{period}"
        atr_col   = f"ATR_{atr_p}"

        if not all(c in bar.index for c in [upper_col, lower_col]):
            return orders
        if pd.isna(bar[upper_col]) or pd.isna(bar[lower_col]):
            return orders

        pos_qty = 0
        if symbol in state.positions:
            pos_qty = state.positions[symbol].quantity

        if bar["close"] < bar[lower_col] and pos_qty == 0:
            size = FixedFractional(0.02).compute_size(state.cash + state.equity, 0.02, bar["close"])
            orders.append(self.buy_market(symbol, size))
        elif bar["close"] > bar[upper_col] and pos_qty > 0:
            orders.append(self.sell_market(symbol, pos_qty))

        return orders


class BreakoutStrategy(Strategy):
    """
    Donchian Channel breakout (Turtle Trading style).
    Params: entry_period, exit_period, atr_period, risk_pct
    """
    def on_bar(self, bar: pd.Series, state: "PortfolioState") -> List[Order]:
        orders = []
        en_p   = self.params.get("entry_period", 20)
        ex_p   = self.params.get("exit_period", 10)
        symbol = self.params.get("symbol", "UNKNOWN")

        upper_col = f"DC_Upper_{en_p}"
        lower_col = f"DC_Lower_{ex_p}"

        if upper_col not in bar.index:
            return orders

        pos_qty = 0
        if symbol in state.positions:
            pos_qty = state.positions[symbol].quantity

        # Breakout long
        if not pd.isna(bar.get(upper_col, float("nan"))):
            upper_prev = bar.get(f"{upper_col}_prev", bar[upper_col])
            if bar["close"] >= bar[upper_col] and bar["close"] <= upper_prev and pos_qty == 0:
                size = FixedFractional(0.01).compute_size(state.cash + state.equity, 0.01, bar["close"])
                orders.append(self.buy_market(symbol, size))

        # Exit on lower band
        if lower_col in bar.index and pos_qty > 0:
            if bar["close"] < bar[lower_col]:
                orders.append(self.sell_market(symbol, pos_qty))

        return orders


# ─── PORTFOLIO STATE ─────────────────────────────────────────────────────────

@dataclass
class PortfolioState:
    """Real-time state of the simulated portfolio."""
    cash:          float
    equity:        float                           # Market value of positions
    positions:     Dict[str, Position] = field(default_factory=dict)
    pending_orders: Dict[str, Order] = field(default_factory=dict)
    filled_orders: List[Order] = field(default_factory=list)
    fills:         List[Fill]  = field(default_factory=list)

    @property
    def total_value(self) -> float:
        return self.cash + self.equity

    @property
    def invested_pct(self) -> float:
        return self.equity / self.total_value * 100 if self.total_value > 0 else 0


# ─── BACKTEST ENGINE ─────────────────────────────────────────────────────────

class BacktestEngine:
    """
    Event-driven backtesting engine.

    Usage:
        engine = BacktestEngine(
            data=ohlcv_df,
            strategy=MovingAverageCrossStrategy({"fast_period": 10, "slow_period": 30}),
            initial_capital=100_000,
        )
        result = engine.run()
    """

    def __init__(
        self,
        data: pd.DataFrame,
        strategy: Strategy,
        initial_capital: float = 100_000,
        commission_model: Optional[CommissionModel] = None,
        slippage_model: Optional[SlippageModel] = None,
        short_borrow_rate: float = 0.02,   # Annual short borrow cost
        margin_rate: float = 0.50,         # Initial margin requirement
        max_position_pct: float = 0.20,    # Max single position size as % of portfolio
        benchmark: Optional[pd.Series] = None,
        symbol: str = "ASSET",
    ):
        self.data        = data.copy()
        self.strategy    = strategy
        self.strategy.engine = self
        self.initial_capital = initial_capital
        self.commission_model = commission_model or PerShareCommission(0.005, 1.00)
        self.slippage_model   = slippage_model   or SpreadSlippage(0.0005)
        self.short_borrow_rate = short_borrow_rate
        self.margin_rate = margin_rate
        self.max_position_pct = max_position_pct
        self.benchmark   = benchmark
        self.symbol      = symbol

        # Ensure lowercase column names
        self.data.columns = [c.lower() for c in self.data.columns]

        # Internal state
        self._state: Optional[PortfolioState] = None
        self._equity_curve: List[float]       = []
        self._timestamps: List[Any]            = []
        self._trades: List[Trade]              = []
        self._all_orders: List[Order]          = []
        self._order_counter                    = 0
        self._trade_counter                    = 0
        self._position_history: List[Dict]     = []

    def _next_order_id(self) -> str:
        self._order_counter += 1
        return f"ORD_{self._order_counter:08d}"

    def _next_trade_id(self) -> int:
        self._trade_counter += 1
        return self._trade_counter

    def _execute_market_order(self, order: Order, bar: pd.Series) -> Optional[Fill]:
        """Execute a market order against the current bar's open price."""
        price = float(bar["open"])
        volume = float(bar.get("volume", 1e9))
        slippage = self.slippage_model.compute(order.symbol, order.quantity, price, volume, order.side)
        fill_price = price + slippage
        commission = self.commission_model.compute(order.symbol, order.quantity, fill_price)

        order.status    = OrderStatus.FILLED
        order.filled_qty = order.quantity
        order.avg_fill  = fill_price
        order.commission = commission
        order.slippage  = slippage
        order.filled_at = bar.name if isinstance(bar.name, pd.Timestamp) else None

        return Fill(
            order_id=order.order_id, symbol=order.symbol,
            side=order.side, quantity=order.quantity,
            price=fill_price, commission=commission,
            slippage=slippage,
            timestamp=order.filled_at or pd.Timestamp.now(),
        )

    def _execute_limit_order(self, order: Order, bar: pd.Series) -> Optional[Fill]:
        """Try to fill a limit order against bar's OHLC."""
        lp = order.limit_price
        if order.side == OrderSide.BUY:
            if bar["low"] <= lp:
                fill_price = min(lp, bar["open"])
            else:
                return None
        else:
            if bar["high"] >= lp:
                fill_price = max(lp, bar["open"])
            else:
                return None

        volume  = float(bar.get("volume", 1e9))
        slippage = 0.0  # Limit orders get no additional slippage
        commission = self.commission_model.compute(order.symbol, order.quantity, fill_price)

        order.status    = OrderStatus.FILLED
        order.filled_qty = order.quantity
        order.avg_fill  = fill_price
        order.commission = commission
        order.filled_at = bar.name if isinstance(bar.name, pd.Timestamp) else None

        return Fill(
            order_id=order.order_id, symbol=order.symbol,
            side=order.side, quantity=order.quantity,
            price=fill_price, commission=commission, slippage=0.0,
            timestamp=order.filled_at or pd.Timestamp.now(),
        )

    def _execute_stop_order(self, order: Order, bar: pd.Series) -> Optional[Fill]:
        """Try to fill a stop order if stop price is touched."""
        sp = order.stop_price
        if order.side == OrderSide.BUY:
            if bar["high"] >= sp:
                fill_price = max(sp, bar["open"])
            else:
                return None
        else:
            if bar["low"] <= sp:
                fill_price = min(sp, bar["open"])
            else:
                return None

        volume   = float(bar.get("volume", 1e9))
        slippage = self.slippage_model.compute(order.symbol, order.quantity, fill_price, volume, order.side)
        fill_price += slippage
        commission = self.commission_model.compute(order.symbol, order.quantity, fill_price)

        order.status    = OrderStatus.FILLED
        order.filled_qty = order.quantity
        order.avg_fill  = fill_price
        order.commission = commission
        order.filled_at = bar.name if isinstance(bar.name, pd.Timestamp) else None

        return Fill(
            order_id=order.order_id, symbol=order.symbol,
            side=order.side, quantity=order.quantity,
            price=fill_price, commission=commission, slippage=slippage,
            timestamp=order.filled_at or pd.Timestamp.now(),
        )

    def _update_position(self, fill: Fill, state: PortfolioState) -> None:
        """Update positions and cash based on a fill."""
        symbol = fill.symbol
        if symbol not in state.positions:
            state.positions[symbol] = Position(
                symbol=symbol,
                direction=PositionDirection.LONG if fill.side == OrderSide.BUY else PositionDirection.SHORT,
                quantity=0, avg_cost=0,
                open_time=fill.timestamp,
            )

        pos = state.positions[symbol]

        if fill.side == OrderSide.BUY:
            total_cost = pos.avg_cost * pos.quantity + fill.price * fill.quantity
            pos.quantity += fill.quantity
            pos.avg_cost = total_cost / pos.quantity if pos.quantity > 0 else 0
            pos.direction = PositionDirection.LONG
            state.cash -= fill.quantity * fill.price + fill.commission
        else:
            # Selling / going short
            if pos.quantity >= fill.quantity:
                realised = fill.quantity * (fill.price - pos.avg_cost)
                pos.realised_pnl += realised
                pos.quantity -= fill.quantity
                state.cash += fill.quantity * fill.price - fill.commission
                if pos.quantity == 0:
                    # Record completed trade
                    self._trades.append(Trade(
                        trade_id  = self._next_trade_id(),
                        symbol    = symbol,
                        entry_time= pos.open_time or fill.timestamp,
                        exit_time = fill.timestamp,
                        direction = "long",
                        entry_price = pos.avg_cost,
                        exit_price  = fill.price,
                        quantity    = fill.quantity,
                        gross_pnl   = realised,
                        commission  = fill.commission,
                        net_pnl     = realised - fill.commission,
                        hold_bars   = 0,
                        return_pct  = (fill.price / pos.avg_cost - 1) * 100 if pos.avg_cost > 0 else 0,
                    ))
                    del state.positions[symbol]
            else:
                # Open a short
                pos.quantity = fill.quantity
                pos.avg_cost = fill.price
                pos.direction = PositionDirection.SHORT
                state.cash += fill.quantity * fill.price - fill.commission

        state.fills.append(fill)

    def _update_trailing_stops(self, bar: pd.Series, state: PortfolioState) -> List[Order]:
        """Generate stop orders for positions with trailing stops."""
        stop_orders = []
        for symbol, pos in list(state.positions.items()):
            if pos.trailing_stop is None:
                continue
            current_price = float(bar["close"])
            if pos.direction == PositionDirection.LONG:
                if pos.trailing_high is None or current_price > pos.trailing_high:
                    pos.trailing_high = current_price
                stop_price = pos.trailing_high - pos.trailing_stop
                if current_price <= stop_price:
                    stop_orders.append(Order(
                        order_id=self._next_order_id(), symbol=symbol,
                        side=OrderSide.SELL, order_type=OrderType.MARKET,
                        quantity=pos.quantity, tags={"reason": "trailing_stop"},
                    ))
        return stop_orders

    def _compute_equity(self, bar: pd.Series, state: PortfolioState) -> float:
        """Mark positions to market using current close."""
        equity = 0.0
        for symbol, pos in state.positions.items():
            current_price = float(bar["close"])
            pos.market_value = pos.quantity * current_price
            if pos.direction == PositionDirection.LONG:
                pos.unrealised_pnl = pos.quantity * (current_price - pos.avg_cost)
            else:
                pos.unrealised_pnl = pos.quantity * (pos.avg_cost - current_price)
            equity += pos.market_value
        return equity

    def run(self) -> BacktestResult:
        """
        Execute the backtest simulation.
        Returns BacktestResult with full analytics.
        """
        df      = self.data
        state   = PortfolioState(cash=self.initial_capital, equity=0.0)
        self._state = state

        self.strategy.on_start()
        pending_day_orders: List[Order] = []

        for idx, (timestamp, bar) in enumerate(df.iterrows()):
            bar = bar.copy()
            bar.name = timestamp

            # ── Step 1: Process previous bar's pending orders ──────────────
            filled_this_bar: List[Fill] = []
            carry_forward: List[Order]  = []

            for order in pending_day_orders:
                fill = None
                if order.order_type == OrderType.MARKET:
                    fill = self._execute_market_order(order, bar)
                elif order.order_type == OrderType.LIMIT:
                    fill = self._execute_limit_order(order, bar)
                elif order.order_type == OrderType.STOP:
                    fill = self._execute_stop_order(order, bar)

                if fill:
                    filled_this_bar.append(fill)
                    self._update_position(fill, state)
                    self.strategy.on_fill(fill, state)
                    self._all_orders.append(order)
                else:
                    if order.tif in (OrderTIF.DAY, OrderTIF.IOC, OrderTIF.FOK):
                        order.status = OrderStatus.EXPIRED
                        self._all_orders.append(order)
                    else:
                        carry_forward.append(order)

            pending_day_orders = carry_forward

            # ── Step 2: Check trailing stops ──────────────────────────────
            trailing_orders = self._update_trailing_stops(bar, state)
            for to in trailing_orders:
                fill = self._execute_market_order(to, bar)
                if fill:
                    self._update_position(fill, state)
            pending_day_orders.extend(trailing_orders)

            # ── Step 3: Update equity mark-to-market ──────────────────────
            state.equity = self._compute_equity(bar, state)

            # ── Step 4: Record equity curve ───────────────────────────────
            self._equity_curve.append(state.total_value)
            self._timestamps.append(timestamp)

            # ── Step 5: Call strategy.on_bar ──────────────────────────────
            try:
                new_orders = self.strategy.on_bar(bar, state)
            except Exception as e:
                new_orders = []

            # Assign IDs and validate
            for order in (new_orders or []):
                order.order_id      = self._next_order_id()
                order.submitted_at  = timestamp
                order.symbol        = order.symbol or self.symbol
                pending_day_orders.append(order)

            # ── Step 6: Record position snapshot ──────────────────────────
            self._position_history.append({
                "timestamp": timestamp,
                "cash":      state.cash,
                "equity":    state.equity,
                "total":     state.total_value,
                "open_positions": len(state.positions),
            })

        self.strategy.on_end(state)

        # ── Build result ──────────────────────────────────────────────────
        eq = pd.Series(self._equity_curve, index=self._timestamps, name="equity")
        pos_df = pd.DataFrame(self._position_history).set_index("timestamp") if self._position_history else pd.DataFrame()

        metrics = self._compute_metrics(eq)

        return BacktestResult(
            equity_curve=eq,
            positions_history=pos_df,
            trades=self._trades,
            orders=self._all_orders,
            fills=state.fills,
            metrics=metrics,
            params=self.strategy.params,
            strategy_name=type(self.strategy).__name__,
        )

    def _compute_metrics(self, equity: pd.Series) -> Dict[str, float]:
        """Compute full performance metrics from equity curve."""
        if len(equity) < 2:
            return {}

        returns = equity.pct_change().dropna()
        total_ret = (equity.iloc[-1] / equity.iloc[0] - 1) * 100
        n_days = len(returns)

        ann_ret  = float((equity.iloc[-1] / equity.iloc[0]) ** (252 / max(n_days, 1)) - 1) * 100
        ann_vol  = float(returns.std(ddof=1) * math.sqrt(252) * 100)
        sharpe   = float(returns.mean() / returns.std(ddof=1) * math.sqrt(252)) if returns.std() > 0 else 0

        # Drawdown
        rolling_max = equity.cummax()
        dd_series   = (equity - rolling_max) / rolling_max * 100
        max_dd      = float(dd_series.min())

        calmar = ann_ret / abs(max_dd) if abs(max_dd) > 0 else 0

        # Downside deviation
        downside = returns[returns < 0].std(ddof=1) * math.sqrt(252)
        sortino  = float(returns.mean() * 252 / downside) if downside > 0 else 0

        # Trade metrics
        trades = self._trades
        if trades:
            win_trades   = [t for t in trades if t.net_pnl > 0]
            lose_trades  = [t for t in trades if t.net_pnl <= 0]
            win_rate     = len(win_trades) / len(trades) * 100
            avg_win      = float(np.mean([t.net_pnl for t in win_trades])) if win_trades else 0
            avg_loss     = float(np.mean([t.net_pnl for t in lose_trades])) if lose_trades else 0
            gross_wins   = sum(t.net_pnl for t in win_trades)
            gross_losses = abs(sum(t.net_pnl for t in lose_trades))
            profit_factor = gross_wins / gross_losses if gross_losses > 0 else float("inf")
            avg_hold     = float(np.mean([t.hold_bars for t in trades]))
            total_pnl    = sum(t.net_pnl for t in trades)
        else:
            win_rate = avg_win = avg_loss = profit_factor = avg_hold = total_pnl = 0

        # Benchmark comparison
        bench_metrics = {}
        if self.benchmark is not None and len(self.benchmark) > 0:
            bench = self.benchmark.reindex(equity.index).ffill().dropna()
            port  = returns.reindex(bench.index).dropna()
            if len(port) > 10:
                cov = np.cov(port, bench.pct_change().dropna()) if len(bench) > 1 else np.eye(2)
                if cov.shape == (2, 2) and cov[1, 1] > 0:
                    beta  = cov[0, 1] / cov[1, 1]
                    alpha_ann = (float(port.mean()) - beta * bench.pct_change().mean()) * 252 * 100
                    bench_metrics = {"beta": round(beta, 4), "alpha": round(alpha_ann, 4)}

        metrics = {
            "total_return":        round(total_ret, 4),
            "annualised_return":   round(ann_ret, 4),
            "annualised_vol":      round(ann_vol, 4),
            "sharpe_ratio":        round(sharpe, 4),
            "sortino_ratio":       round(sortino, 4),
            "max_drawdown":        round(max_dd, 4),
            "calmar_ratio":        round(calmar, 4),
            "win_rate":            round(win_rate, 4),
            "avg_win":             round(avg_win, 2),
            "avg_loss":            round(avg_loss, 2),
            "profit_factor":       round(min(profit_factor, 999), 4),
            "avg_hold_bars":       round(avg_hold, 2),
            "total_trades":        len(trades),
            "total_net_pnl":       round(total_pnl, 2),
            "final_equity":        round(float(equity.iloc[-1]), 2),
            "initial_capital":     round(self.initial_capital, 2),
            **bench_metrics,
        }
        return metrics


# ─── WALK-FORWARD OPTIMIZATION ───────────────────────────────────────────────

def walk_forward_optimize(
    data: pd.DataFrame,
    strategy_class: type,
    param_grid: Dict[str, List],
    in_sample_pct: float = 0.70,
    n_folds: int = 5,
    objective: str = "sharpe_ratio",  # or "total_return", "calmar_ratio", etc.
    initial_capital: float = 100_000,
    **engine_kwargs,
) -> pd.DataFrame:
    """
    Walk-forward optimization of strategy parameters.
    Splits data into n_folds, optimizes in-sample, tests out-of-sample.

    Returns DataFrame with per-fold results and combined OOS performance.
    """
    import itertools

    n = len(data)
    fold_size = n // n_folds
    results   = []

    # Generate all parameter combinations
    param_names  = list(param_grid.keys())
    param_values = list(param_grid.values())
    all_combos   = list(itertools.product(*param_values))

    for fold in range(n_folds - 1):
        # In-sample range
        is_start = 0
        is_end   = fold_size * (fold + 1)
        oos_start = is_end
        oos_end   = min(oos_start + fold_size, n)

        is_data  = data.iloc[is_start:is_end]
        oos_data = data.iloc[oos_start:oos_end]

        if len(is_data) < 100 or len(oos_data) < 20:
            continue

        # Find best params on in-sample
        best_score  = -float("inf")
        best_params = {}

        for combo in all_combos[:500]:  # Limit to 500 combos for speed
            params = dict(zip(param_names, combo))
            try:
                engine  = BacktestEngine(is_data, strategy_class(params),
                                          initial_capital, **engine_kwargs)
                result  = engine.run()
                score   = result.metrics.get(objective, -float("inf"))
                if score > best_score:
                    best_score  = score
                    best_params = params.copy()
            except Exception:
                continue

        # Test best params on out-of-sample
        oos_metrics = {}
        if best_params:
            try:
                oos_engine = BacktestEngine(oos_data, strategy_class(best_params),
                                             initial_capital, **engine_kwargs)
                oos_result = oos_engine.run()
                oos_metrics = oos_result.metrics
            except Exception:
                pass

        results.append({
            "fold":       fold + 1,
            "is_bars":    len(is_data),
            "oos_bars":   len(oos_data),
            "best_params": str(best_params),
            "is_score":   round(best_score, 4),
            **{f"oos_{k}": round(v, 4) for k, v in oos_metrics.items()
               if isinstance(v, (int, float))},
        })

    return pd.DataFrame(results)


# ─── MONTE CARLO SIMULATION ──────────────────────────────────────────────────

def monte_carlo_backtest(
    base_result: BacktestResult,
    n_simulations: int = 1000,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Monte Carlo simulation of a completed backtest.
    Randomizes trade order to assess strategy robustness.

    Returns DataFrame with percentile equity curves.
    """
    rng    = np.random.default_rng(seed)
    trades = base_result.trades

    if not trades:
        return pd.DataFrame()

    pnls    = np.array([t.net_pnl for t in trades])
    capital = base_result.metrics.get("initial_capital", 100_000)

    all_curves = []
    for _ in range(n_simulations):
        shuffled = rng.permutation(pnls)
        equity   = capital + np.cumsum(shuffled)
        equity   = np.insert(equity, 0, capital)
        all_curves.append(equity)

    matrix = np.array(all_curves)
    length = min(c.shape[0] for c in all_curves)
    matrix = np.array([c[:length] for c in all_curves])

    percentiles = [5, 25, 50, 75, 95]
    result_dict = {}
    for p in percentiles:
        result_dict[f"p{p}"] = np.percentile(matrix, p, axis=0)

    return pd.DataFrame(result_dict)


# ─── TEARSHEET ───────────────────────────────────────────────────────────────

def generate_tearsheet(result: BacktestResult) -> Dict:
    """
    Generate a full tearsheet summary from backtest results.
    Returns a dict ready for JSON serialisation.
    """
    metrics = result.metrics
    trades  = result.trades
    equity  = result.equity_curve

    if len(equity) > 1:
        rets = equity.pct_change().dropna()
        monthly_rets = (1 + rets).resample("ME").prod() - 1 if isinstance(equity.index, pd.DatetimeIndex) else pd.Series()
        best_month   = float(monthly_rets.max())  if len(monthly_rets) > 0 else 0
        worst_month  = float(monthly_rets.min()) if len(monthly_rets) > 0 else 0
        pos_months   = int((monthly_rets > 0).sum()) if len(monthly_rets) > 0 else 0
        neg_months   = int((monthly_rets < 0).sum()) if len(monthly_rets) > 0 else 0
    else:
        best_month = worst_month = pos_months = neg_months = 0

    return {
        "overview": {
            "strategy_name":      result.strategy_name,
            "initial_capital":    metrics.get("initial_capital", 0),
            "final_equity":       metrics.get("final_equity", 0),
            "total_return":       metrics.get("total_return", 0),
            "annualised_return":  metrics.get("annualised_return", 0),
            "annualised_vol":     metrics.get("annualised_vol", 0),
        },
        "risk_metrics": {
            "sharpe_ratio":   metrics.get("sharpe_ratio", 0),
            "sortino_ratio":  metrics.get("sortino_ratio", 0),
            "calmar_ratio":   metrics.get("calmar_ratio", 0),
            "max_drawdown":   metrics.get("max_drawdown", 0),
        },
        "trade_statistics": {
            "total_trades":   metrics.get("total_trades", 0),
            "win_rate":       metrics.get("win_rate", 0),
            "avg_win":        metrics.get("avg_win", 0),
            "avg_loss":       metrics.get("avg_loss", 0),
            "profit_factor":  metrics.get("profit_factor", 0),
            "avg_hold_bars":  metrics.get("avg_hold_bars", 0),
            "total_net_pnl":  metrics.get("total_net_pnl", 0),
        },
        "monthly_returns": {
            "best_month":   round(best_month * 100, 4),
            "worst_month":  round(worst_month * 100, 4),
            "positive_months": pos_months,
            "negative_months": neg_months,
        },
        "params": result.params,
    }
