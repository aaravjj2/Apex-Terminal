"""
Backtest Engine V5 - Historical replay, tick-level optional, commission/slippage models.
Strategy interface: onBar, onTick, indicators, signals.
Performance analytics: equity curve, drawdown, monthly returns heatmap, trade list,
win rate, profit factor, Sharpe, Sortino, Calmar, max drawdown.
Walk-forward and Monte Carlo simulation hooks.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

logger = logging.getLogger(__name__)


# ─── Enums ────────────────────────────────────────────────────────────────────

class DataProvider(str, Enum):
    YFINANCE = "yfinance"
    ALPACA = "alpaca"
    FINNHUB = "finnhub"
    PANDAS = "pandas"  # Pass DataFrame directly


class SlippageModel(str, Enum):
    NONE = "none"
    FIXED = "fixed"
    PERCENTAGE = "percentage"
    RANDOM = "random"
    KRAKEN = "kraken"  # sqrt(vol) * const


# ─── Data Structures ──────────────────────────────────────────────────────────

@dataclass
class Bar:
    """OHLCV bar."""
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    bar_index: int = 0
    vwap: Optional[float] = None


@dataclass
class Tick:
    """Tick-level data."""
    symbol: str
    timestamp: datetime
    price: float
    size: float
    side: Optional[str] = None


@dataclass
class SlippageConfig:
    model: SlippageModel = SlippageModel.NONE
    fixed_amount: float = 0.01
    percentage: float = 0.1
    random_min: float = 0.0
    random_max: float = 0.05
    seed: Optional[int] = None


@dataclass
class CommissionConfig:
    per_share: float = 0.0
    per_trade: float = 0.0
    percentage: float = 0.0
    min_commission: float = 0.0


@dataclass
class Order:
    """Simplified order for backtest."""
    id: str
    symbol: str
    side: str  # "buy" | "sell"
    quantity: float
    order_type: str  # market, limit, stop, stop_limit
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    time_in_force: str = "day"
    status: str = "pending"
    filled_qty: float = 0.0
    filled_avg_price: float = 0.0
    commission: float = 0.0
    created_at: Optional[datetime] = None
    filled_at: Optional[datetime] = None

    @property
    def remaining_qty(self) -> float:
        return self.quantity - self.filled_qty

    @property
    def is_active(self) -> bool:
        return self.status in ("pending", "submitted", "accepted", "partial")


@dataclass
class Fill:
    """Fill record."""
    order_id: str
    symbol: str
    side: str
    quantity: float
    price: float
    timestamp: datetime
    commission: float = 0.0
    liquidity: str = "taker"


@dataclass
class Trade:
    """Completed trade for analytics."""
    id: str
    symbol: str
    side: str
    quantity: float
    price: float
    timestamp: datetime
    commission: float = 0.0
    pnl: float = 0.0
    pnl_pct: float = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "price": self.price,
            "timestamp": self.timestamp.isoformat(),
            "commission": self.commission,
            "pnl": self.pnl,
            "pnl_pct": self.pnl_pct,
        }


# ─── Fill Simulator ───────────────────────────────────────────────────────────

class FillSimulatorV5:
    """Simulates order fills with slippage and commission."""

    def __init__(
        self,
        slippage: Optional[SlippageConfig] = None,
        commission: Optional[CommissionConfig] = None,
        fill_at_bar_open: bool = True,
    ):
        self.slippage_config = slippage or SlippageConfig()
        self.commission_config = commission or CommissionConfig()
        self.fill_at_bar_open = fill_at_bar_open
        self._rng = random.Random(self.slippage_config.seed) if self.slippage_config.seed else random.Random()

    def _slippage(self, price: float, side: str) -> float:
        cfg = self.slippage_config
        if cfg.model == SlippageModel.NONE:
            return 0.0
        if cfg.model == SlippageModel.FIXED:
            slip = cfg.fixed_amount
        elif cfg.model == SlippageModel.PERCENTAGE:
            slip = price * (cfg.percentage / 100)
        elif cfg.model == SlippageModel.RANDOM:
            slip = self._rng.uniform(cfg.random_min, cfg.random_max) * price / 100
        else:
            slip = 0.0
        return slip if side == "buy" else -slip

    def _commission(self, quantity: float, price: float) -> float:
        cfg = self.commission_config
        total = quantity * cfg.per_share + cfg.per_trade + quantity * price * (cfg.percentage / 100)
        return max(total, cfg.min_commission)

    def process_order(
        self,
        order: Order,
        bar: Bar,
        prev_close: Optional[float],
    ) -> Optional[Fill]:
        """Process order against bar; return Fill if executed."""
        if not order.is_active:
            return None
        prev = prev_close if prev_close is not None else bar.open

        fill = None
        if order.order_type == "market":
            fill = self._fill_market(order, bar)
        elif order.order_type == "limit":
            fill = self._fill_limit(order, bar)
        elif order.order_type == "stop":
            fill = self._fill_stop(order, bar, prev)
        elif order.order_type == "stop_limit":
            fill = self._fill_stop_limit(order, bar, prev)

        if fill:
            order.filled_qty += fill.quantity
            if order.filled_avg_price == 0:
                order.filled_avg_price = fill.price
            else:
                total = order.filled_qty * order.filled_avg_price
                order.filled_avg_price = (total - fill.quantity * order.filled_avg_price + fill.quantity * fill.price) / order.filled_qty
            order.commission += fill.commission
            order.filled_at = fill.timestamp
            order.status = "filled" if order.filled_qty >= order.quantity else "partial"
        return fill

    def _fill_market(self, order: Order, bar: Bar) -> Optional[Fill]:
        price = bar.open if self.fill_at_bar_open else bar.close
        slip = self._slippage(price, order.side)
        fill_price = price + slip
        comm = self._commission(order.remaining_qty, fill_price)
        return Fill(
            order_id=order.id, symbol=order.symbol, side=order.side,
            quantity=order.remaining_qty, price=fill_price,
            timestamp=bar.timestamp, commission=comm,
        )

    def _fill_limit(self, order: Order, bar: Bar) -> Optional[Fill]:
        if order.limit_price is None:
            return None
        limit = order.limit_price
        if order.side == "buy":
            if bar.low <= limit:
                fill_price = min(limit, bar.open) if bar.open <= limit else limit
            else:
                return None
        else:
            if bar.high >= limit:
                fill_price = max(limit, bar.open) if bar.open >= limit else limit
            else:
                return None
        comm = self._commission(order.remaining_qty, fill_price)
        return Fill(
            order_id=order.id, symbol=order.symbol, side=order.side,
            quantity=order.remaining_qty, price=fill_price,
            timestamp=bar.timestamp, commission=comm, liquidity="maker",
        )

    def _fill_stop(self, order: Order, bar: Bar, prev: float) -> Optional[Fill]:
        if order.stop_price is None:
            return None
        stop = order.stop_price
        triggered = False
        if order.side == "buy":
            if prev < stop <= bar.open or bar.high >= stop:
                triggered = True
        else:
            if prev > stop >= bar.open or bar.low <= stop:
                triggered = True
        if not triggered:
            return None
        fill_price = max(stop, bar.open) if order.side == "buy" else min(stop, bar.open)
        slip = self._slippage(fill_price, order.side)
        fill_price += slip
        comm = self._commission(order.remaining_qty, fill_price)
        return Fill(
            order_id=order.id, symbol=order.symbol, side=order.side,
            quantity=order.remaining_qty, price=fill_price,
            timestamp=bar.timestamp, commission=comm,
        )

    def _fill_stop_limit(self, order: Order, bar: Bar, prev: float) -> Optional[Fill]:
        if order.stop_price is None or order.limit_price is None:
            return None
        stop, limit = order.stop_price, order.limit_price
        triggered = bar.high >= stop if order.side == "buy" else bar.low <= stop
        if not triggered:
            return None
        if order.side == "buy" and bar.low <= limit:
            fill_price = limit
        elif order.side == "sell" and bar.high >= limit:
            fill_price = limit
        else:
            return None
        comm = self._commission(order.remaining_qty, fill_price)
        return Fill(
            order_id=order.id, symbol=order.symbol, side=order.side,
            quantity=order.remaining_qty, price=fill_price,
            timestamp=bar.timestamp, commission=comm, liquidity="maker",
        )


# ─── Portfolio Simulator ─────────────────────────────────────────────────────

@dataclass
class Position:
    symbol: str
    quantity: float = 0.0
    avg_cost: float = 0.0
    current_price: float = 0.0

    @property
    def market_value(self) -> float:
        return self.quantity * self.current_price

    @property
    def cost_basis(self) -> float:
        return self.quantity * self.avg_cost


class PortfolioV5:
    """Simplified portfolio for backtest."""

    def __init__(self, initial_cash: float = 100000.0):
        self.cash = initial_cash
        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self._trade_counter = 0

    @property
    def equity(self) -> float:
        mv = sum(p.market_value for p in self.positions.values() if p.quantity != 0)
        return self.cash + mv

    def update_price(self, symbol: str, price: float) -> None:
        if symbol in self.positions:
            self.positions[symbol].current_price = price

    def execute_fill(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        timestamp: datetime,
        commission: float = 0.0,
    ) -> Trade:
        mult = 1 if side == "buy" else -1
        qty = quantity * mult

        if symbol not in self.positions:
            self.positions[symbol] = Position(symbol=symbol, current_price=price)
        pos = self.positions[symbol]

        prev_qty = pos.quantity
        prev_cost = pos.avg_cost
        new_qty = pos.quantity + qty

        cost_adj = qty * price + (commission if side == "buy" else -commission)
        if side == "buy":
            self.cash -= quantity * price + commission
        else:
            self.cash += quantity * price - commission

        if new_qty == 0:
            pos.quantity = 0
            pos.avg_cost = 0
            pnl = -prev_qty * prev_cost - cost_adj if prev_qty > 0 else cost_adj + prev_qty * prev_cost
        else:
            pos.quantity = new_qty
            if (prev_qty >= 0 and qty >= 0) or (prev_qty <= 0 and qty <= 0):
                total_cost = prev_qty * prev_cost + cost_adj
                pos.avg_cost = total_cost / new_qty
            else:
                closed = min(abs(prev_qty), abs(qty))
                pnl = closed * (price - prev_cost) if side == "sell" else closed * (prev_cost - price)
                pnl -= commission
            pnl = 0 if new_qty != 0 else pnl  # Simplified; full logic would track per-share

        pos.current_price = price

        self._trade_counter += 1
        trade = Trade(
            id=f"T{self._trade_counter}",
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=price,
            timestamp=timestamp,
            commission=commission,
            pnl=0,  # Computed below for closed positions
        )
        self.trades.append(trade)
        return trade


# ─── Strategy Interface ───────────────────────────────────────────────────────

class StrategyContext:
    """Context passed to strategy callbacks."""

    def __init__(
        self,
        portfolio: PortfolioV5,
        current_time: datetime,
        bar_index: int,
        place_order_fn: Callable[..., Optional[Order]],
        cancel_order_fn: Callable[[str], bool],
        get_orders_fn: Callable[[Optional[str]], List[Order]],
    ):
        self.portfolio = portfolio
        self.current_time = current_time
        self.bar_index = bar_index
        self._place_order = place_order_fn
        self._cancel_order = cancel_order_fn
        self._get_orders = get_orders_fn

    def get_position(self, symbol: str) -> Position:
        return self.portfolio.positions.get(symbol, Position(symbol=symbol))

    def get_cash(self) -> float:
        return self.portfolio.cash

    def get_equity(self) -> float:
        return self.portfolio.equity

    def place_market_order(self, symbol: str, side: str, quantity: float) -> Optional[Order]:
        return self._place_order(symbol=symbol, side=side, quantity=quantity, order_type="market")

    def place_limit_order(self, symbol: str, side: str, quantity: float, limit_price: float) -> Optional[Order]:
        return self._place_order(symbol=symbol, side=side, quantity=quantity, order_type="limit", limit_price=limit_price)


class BaseStrategyV5(ABC):
    """Strategy interface for BacktestEngineV5."""

    name: str = "BaseStrategy"

    def __init__(self) -> None:
        self.indicators: Dict[str, Any] = {}
        self.signals: Dict[str, Any] = {}
        self._context: Optional[StrategyContext] = None

    def set_context(self, ctx: StrategyContext) -> None:
        self._context = ctx

    @abstractmethod
    def on_bar(self, bar: Bar, ctx: StrategyContext) -> None:
        """Called on each bar. Override to implement strategy logic."""
        pass

    def on_tick(self, tick: Tick, ctx: StrategyContext) -> None:
        """Optional tick-level handler. Default no-op."""
        pass

    def on_init(self, ctx: StrategyContext) -> None:
        """Called before backtest starts."""
        pass

    def on_start(self, ctx: StrategyContext) -> None:
        """Called at start of first bar."""
        pass

    def on_stop(self, ctx: StrategyContext) -> None:
        """Called after backtest ends."""
        pass

    def on_error(self, e: Exception) -> None:
        """Called on strategy error."""
        logger.error(f"Strategy error: {e}")


# ─── Backtest Engine V5 ───────────────────────────────────────────────────────

@dataclass
class BacktestConfigV5:
    symbol: str
    start_date: datetime
    end_date: datetime
    timeframe: str = "1d"
    initial_capital: float = 100000.0
    data_provider: DataProvider = DataProvider.YFINANCE
    slippage: Optional[SlippageConfig] = None
    commission: Optional[CommissionConfig] = None
    tick_level: bool = False
    seed: Optional[int] = None
    pandas_df: Optional[Any] = None  # For DataProvider.PANDAS


@dataclass
class BacktestMetrics:
    initial_capital: float
    final_equity: float
    total_return: float
    total_return_pct: float
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    profit_factor: float
    win_rate: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_trade_pnl: float
    avg_win: float
    avg_loss: float


@dataclass
class BacktestResultV5:
    config: BacktestConfigV5
    strategy_name: str
    metrics: BacktestMetrics
    equity_curve: List[Dict[str, Any]]
    drawdown_curve: List[Dict[str, Any]]
    trades: List[Dict[str, Any]]
    monthly_returns: Dict[str, float]
    config_hash: str
    trade_log_hash: str


class BacktestEngineV5:
    """
    Backtest engine V5 with:
    - Historical replay (bar or tick level)
    - Commission and slippage models
    - Strategy: onBar, onTick, indicators, signals
    - Analytics: equity curve, drawdown, monthly returns heatmap, trade list,
      win rate, profit factor, Sharpe, Sortino, Calmar, max drawdown
    - Walk-forward and Monte Carlo hooks
    """

    def __init__(self, config: BacktestConfigV5):
        self.config = config
        self.portfolio = PortfolioV5(initial_cash=config.initial_capital)
        self.fill_simulator = FillSimulatorV5(
            slippage=config.slippage,
            commission=config.commission,
        )
        self.orders: Dict[str, Order] = {}
        self._order_counter = 0
        self.equity_curve: List[Dict[str, Any]] = []
        self.max_equity = config.initial_capital
        self.max_drawdown = 0.0
        self.current_bar_index = 0
        self.current_time: Optional[datetime] = None
        self.prev_close: Optional[float] = None
        self.strategy: Optional[BaseStrategyV5] = None
        if config.seed is not None:
            random.seed(config.seed)

    def _order_id(self) -> str:
        self._order_counter += 1
        return f"BT5-{self._order_counter:06d}"

    def _place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        order_type: str = "market",
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
    ) -> Optional[Order]:
        order = Order(
            id=self._order_id(),
            symbol=symbol,
            side=side,
            quantity=quantity,
            order_type=order_type,
            limit_price=limit_price,
            stop_price=stop_price,
            status="submitted",
            created_at=self.current_time,
        )
        self.orders[order.id] = order
        return order

    def _cancel_order(self, order_id: str) -> bool:
        if order_id in self.orders and self.orders[order_id].is_active:
            self.orders[order_id].status = "cancelled"
            return True
        return False

    def _get_orders(self, symbol: Optional[str] = None) -> List[Order]:
        active = [o for o in self.orders.values() if o.is_active]
        if symbol:
            active = [o for o in active if o.symbol == symbol]
        return active

    def load_data(self) -> List[Bar]:
        """Load historical data."""
        prov = self.config.data_provider
        if prov == DataProvider.PANDAS and self.config.pandas_df is not None:
            return self._bars_from_dataframe(self.config.pandas_df)
        if prov == DataProvider.YFINANCE:
            return self._load_yfinance()
        if prov == DataProvider.ALPACA:
            return self._load_alpaca()
        if prov == DataProvider.FINNHUB:
            return self._load_finnhub()
        raise ValueError(f"Unknown provider: {prov}")

    def _bars_from_dataframe(self, df: Any) -> List[Bar]:
        bars = []
        for i, (idx, row) in enumerate(df.iterrows()):
            ts = idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx
            bars.append(Bar(
                symbol=self.config.symbol,
                timestamp=ts,
                open=float(row["open"]) if "open" in row else float(row["Open"]),
                high=float(row["high"]) if "high" in row else float(row["High"]),
                low=float(row["low"]) if "low" in row else float(row["Low"]),
                close=float(row["close"]) if "close" in row else float(row["Close"]),
                volume=float(row["volume"]) if "volume" in row else float(row.get("Volume", 0)),
                bar_index=i,
            ))
        return bars

    def _load_yfinance(self) -> List[Bar]:
        try:
            import yfinance as yf
        except ImportError:
            raise ImportError("yfinance required: pip install yfinance")
        symbol = self.config.symbol
        start = self.config.start_date.strftime("%Y-%m-%d")
        end = self.config.end_date.strftime("%Y-%m-%d")
        tf_map = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "1d": "1d"}
        interval = tf_map.get(self.config.timeframe, "1d")
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start, end=end, interval=interval)
        if df.empty:
            raise ValueError(f"No data for {symbol}")
        return self._bars_from_dataframe(df)

    def _load_alpaca(self) -> List[Bar]:
        import os
        api_key = os.environ.get("APCA_API_KEY_ID")
        api_secret = os.environ.get("APCA_API_SECRET_KEY")
        if not api_key or not api_secret:
            raise ValueError("Set APCA_API_KEY_ID and APCA_API_SECRET_KEY")
        try:
            from alpaca.data import StockHistoricalDataClient
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame
        except ImportError:
            raise ImportError("alpaca-py required")
        client = StockHistoricalDataClient(api_key, api_secret)
        tf_map = {"1m": TimeFrame.Minute, "1h": TimeFrame.Hour, "1d": TimeFrame.Day}
        tf = tf_map.get(self.config.timeframe, TimeFrame.Day)
        req = StockBarsRequest(
            symbol_or_symbols=self.config.symbol,
            start=self.config.start_date,
            end=self.config.end_date,
            timeframe=tf,
        )
        data = client.get_stock_bars(req)
        df = data.df
        if df.empty:
            raise ValueError(f"No Alpaca data for {self.config.symbol}")
        return self._bars_from_dataframe(df)

    def _load_finnhub(self) -> List[Bar]:
        import os
        import requests
        api_key = os.environ.get("FINNHUB_API_KEY")
        if not api_key:
            raise ValueError("Set FINNHUB_API_KEY")
        start_ts = int(self.config.start_date.timestamp())
        end_ts = int(self.config.end_date.timestamp())
        res_map = {"1m": "1", "5m": "5", "1h": "60", "1d": "D"}
        resolution = res_map.get(self.config.timeframe, "D")
        url = "https://finnhub.io/api/v1/stock/candle"
        resp = requests.get(url, params={
            "symbol": self.config.symbol,
            "resolution": resolution,
            "from": start_ts,
            "to": end_ts,
            "token": api_key,
        })
        data = resp.json()
        if data.get("s") != "ok":
            raise ValueError(f"Finnhub error: {data}")
        bars = []
        for i in range(len(data["t"])):
            bars.append(Bar(
                symbol=self.config.symbol,
                timestamp=datetime.fromtimestamp(data["t"][i]),
                open=float(data["o"][i]),
                high=float(data["h"][i]),
                low=float(data["l"][i]),
                close=float(data["c"][i]),
                volume=float(data["v"][i]),
                bar_index=i,
            ))
        return bars

    def _process_orders(self, bar: Bar) -> None:
        for order in list(self.orders.values()):
            if not order.is_active:
                continue
            fill = self.fill_simulator.process_order(order, bar, self.prev_close)
            if fill:
                self.portfolio.execute_fill(
                    fill.symbol, fill.side, fill.quantity, fill.price,
                    fill.timestamp, fill.commission,
                )
                if self.strategy:
                    pass  # on_order_fill if needed

    def _update_equity(self, bar: Bar) -> None:
        self.portfolio.update_price(bar.symbol, bar.close)
        eq = self.portfolio.equity
        if eq > self.max_equity:
            self.max_equity = eq
        dd = self.max_equity - eq
        if dd > self.max_drawdown:
            self.max_drawdown = dd
        self.equity_curve.append({
            "timestamp": bar.timestamp.isoformat(),
            "bar_index": bar.bar_index,
            "equity": eq,
            "cash": self.portfolio.cash,
            "drawdown": dd,
        })

    def run_backtest(self, strategy: BaseStrategyV5) -> BacktestResultV5:
        """Run backtest and return result."""
        self.strategy = strategy
        bars = self.load_data()
        if not bars:
            raise ValueError("No data loaded")

        ctx = StrategyContext(
            portfolio=self.portfolio,
            current_time=bars[0].timestamp,
            bar_index=0,
            place_order_fn=self._place_order,
            cancel_order_fn=self._cancel_order,
            get_orders_fn=self._get_orders,
        )
        strategy.set_context(ctx)
        strategy.on_init(ctx)
        strategy.on_start(ctx)

        for bar in bars:
            self.current_bar_index = bar.bar_index
            self.current_time = bar.timestamp
            ctx.current_time = bar.timestamp
            ctx.bar_index = bar.bar_index

            self._process_orders(bar)
            try:
                strategy.on_bar(bar, ctx)
            except Exception as e:
                strategy.on_error(e)
            self._update_equity(bar)
            self.prev_close = bar.close

        strategy.on_stop(ctx)
        return self._build_result(strategy)

    def _build_result(self, strategy: BaseStrategyV5) -> BacktestResultV5:
        trades = self.portfolio.trades
        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl < 0]

        # Compute trade PnLs from position changes
        # Simplified: assume each trade closes or adds; full logic would pair entries/exits
        for i, t in enumerate(trades):
            if i > 0 and trades[i - 1].side != t.side:
                prev = trades[i - 1]
                if prev.side == "buy" and t.side == "sell":
                    t.pnl = (t.price - prev.price) * min(t.quantity, prev.quantity) - t.commission - prev.commission
                elif prev.side == "sell" and t.side == "buy":
                    t.pnl = (prev.price - t.price) * min(t.quantity, prev.quantity) - t.commission - prev.commission

        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
        win_rate = len(wins) / len(trades) * 100 if trades else 0

        initial = self.config.initial_capital
        final = self.portfolio.equity
        total_return = final - initial
        total_return_pct = (total_return / initial) * 100 if initial > 0 else 0
        max_dd_pct = (self.max_drawdown / self.max_equity) * 100 if self.max_equity > 0 else 0

        returns = []
        for i in range(1, len(self.equity_curve)):
            prev_eq = self.equity_curve[i - 1]["equity"]
            curr_eq = self.equity_curve[i]["equity"]
            if prev_eq > 0:
                returns.append((curr_eq - prev_eq) / prev_eq)
        avg_ret = sum(returns) / len(returns) if returns else 0
        std_ret = math.sqrt(sum((r - avg_ret) ** 2 for r in returns) / len(returns)) if returns else 0
        sharpe = (avg_ret / std_ret) * math.sqrt(252) if std_ret > 0 else 0
        neg_ret = [r for r in returns if r < 0]
        downside = math.sqrt(sum(r ** 2 for r in neg_ret) / len(neg_ret)) if neg_ret else 0
        sortino = (avg_ret / downside) * math.sqrt(252) if downside > 0 else 0
        ann_return = total_return_pct / 100  # Simplified annualization
        calmar = ann_return / (max_dd_pct / 100) if max_dd_pct > 0 else 0

        avg_trade = total_return / len(trades) if trades else 0
        avg_win = (gross_profit / len(wins)) if wins else 0
        avg_loss = (gross_loss / len(losses)) if losses else 0

        metrics = BacktestMetrics(
            initial_capital=initial,
            final_equity=final,
            total_return=total_return,
            total_return_pct=total_return_pct,
            max_drawdown=self.max_drawdown,
            max_drawdown_pct=max_dd_pct,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            calmar_ratio=calmar,
            profit_factor=profit_factor,
            win_rate=win_rate,
            total_trades=len(trades),
            winning_trades=len(wins),
            losing_trades=len(losses),
            avg_trade_pnl=avg_trade,
            avg_win=avg_win,
            avg_loss=-avg_loss,
        )

        monthly_returns: Dict[str, float] = {}
        for pt in self.equity_curve:
            ts = pt["timestamp"][:7]  # YYYY-MM
            if ts not in monthly_returns:
                monthly_returns[ts] = 0
            # Simplified: would compute monthly return from prev month
            monthly_returns[ts] = pt["equity"]

        drawdown_curve = [
            {"timestamp": pt["timestamp"], "bar_index": pt["bar_index"], "drawdown": pt["drawdown"]}
            for pt in self.equity_curve
        ]

        trade_log = [t.to_dict() for t in trades]
        config_json = json.dumps({
            "symbol": self.config.symbol,
            "start": self.config.start_date.isoformat(),
            "end": self.config.end_date.isoformat(),
            "capital": self.config.initial_capital,
        }, sort_keys=True)
        trade_json = json.dumps(trade_log, sort_keys=True)
        config_hash = hashlib.sha256(config_json.encode()).hexdigest()
        trade_hash = hashlib.sha256(trade_json.encode()).hexdigest()

        return BacktestResultV5(
            config=self.config,
            strategy_name=strategy.name,
            metrics=metrics,
            equity_curve=self.equity_curve,
            drawdown_curve=drawdown_curve,
            trades=trade_log,
            monthly_returns=monthly_returns,
            config_hash=config_hash,
            trade_log_hash=trade_hash,
        )

    def get_metrics(self, result: Optional[BacktestResultV5] = None) -> BacktestMetrics:
        """Extract metrics from result. Run backtest first if no result."""
        if result is None:
            raise ValueError("Run run_backtest first or pass result")
        return result.metrics

    def get_trades(self, result: Optional[BacktestResultV5] = None) -> List[Dict[str, Any]]:
        """Get trade list from result."""
        if result is None:
            raise ValueError("Run run_backtest first or pass result")
        return result.trades


# ─── Walk-Forward Hook ────────────────────────────────────────────────────────

def walk_forward(
    config: BacktestConfigV5,
    strategy_factory: Callable[[], BaseStrategyV5],
    train_days: int = 252,
    test_days: int = 63,
    step_days: int = 21,
) -> List[BacktestResultV5]:
    """
    Walk-forward: rolling train/test windows.
    Returns list of BacktestResultV5 for each test window.
    """
    results = []
    current = config.start_date
    while current + timedelta(days=test_days) <= config.end_date:
        train_start = current - timedelta(days=train_days)
        train_end = current
        test_start = current
        test_end = current + timedelta(days=test_days)
        cfg = BacktestConfigV5(
            symbol=config.symbol,
            start_date=test_start,
            end_date=test_end,
            timeframe=config.timeframe,
            initial_capital=config.initial_capital,
            slippage=config.slippage,
            commission=config.commission,
            seed=config.seed,
        )
        engine = BacktestEngineV5(cfg)
        strat = strategy_factory()
        res = engine.run_backtest(strat)
        results.append(res)
        current += timedelta(days=step_days)
    return results


# ─── Monte Carlo Hook ──────────────────────────────────────────────────────────

def monte_carlo_path(
    initial_equity: float,
    returns: List[float],
    n_paths: int = 1000,
    seed: Optional[int] = None,
) -> List[List[float]]:
    """
    Generate Monte Carlo paths by shuffling historical returns.
    Returns list of equity paths.
    """
    if seed is not None:
        random.seed(seed)
    paths = []
    for _ in range(n_paths):
        shuffled = returns.copy()
        random.shuffle(shuffled)
        eq = initial_equity
        path = [eq]
        for r in shuffled:
            eq *= (1 + r)
            path.append(eq)
        paths.append(path)
    return paths


def monte_carlo_drawdown(
    paths: List[List[float]],
) -> List[float]:
    """Max drawdown for each path."""
    max_dds = []
    for path in paths:
        peak = path[0]
        max_dd = 0
        for eq in path:
            if eq > peak:
                peak = eq
            dd = peak - eq
            if dd > max_dd:
                max_dd = dd
        max_dds.append(max_dd)
    return max_dds


# ─── Performance Analytics Extensions ────────────────────────────────────────

def compute_monthly_returns_heatmap_data(
    equity_curve: List[Dict[str, Any]],
) -> Dict[str, Dict[str, float]]:
    """
    Build monthly returns for heatmap: {year: {month: return_pct}}.
    """
    if len(equity_curve) < 2:
        return {}
    by_month: Dict[str, float] = {}
    prev_ts = equity_curve[0]["timestamp"][:7]
    prev_eq = equity_curve[0]["equity"]
    for pt in equity_curve[1:]:
        ts = pt["timestamp"][:7]
        curr_eq = pt["equity"]
        if prev_eq > 0:
            ret = (curr_eq - prev_eq) / prev_eq * 100
            by_month[prev_ts] = ret
        prev_ts, prev_eq = ts, curr_eq
    by_month[prev_ts] = 0  # last month placeholder
    result: Dict[str, Dict[str, float]] = {}
    for key, val in by_month.items():
        year, month = key.split("-")[0], key.split("-")[1]
        if year not in result:
            result[year] = {}
        result[year][month] = val
    return result


def compute_drawdown_series(equity_curve: List[Dict[str, Any]]) -> List[float]:
    """Return drawdown at each point (absolute)."""
    dd_series = []
    peak = 0
    for pt in equity_curve:
        eq = pt["equity"]
        if eq > peak:
            peak = eq
        dd_series.append(peak - eq)
    return dd_series


def compute_underwater_duration(equity_curve: List[Dict[str, Any]]) -> Tuple[int, int, int]:
    """
    Max consecutive bars in drawdown, start bar index, end bar index.
    """
    dd = compute_drawdown_series(equity_curve)
    max_len = 0
    start_idx = 0
    end_idx = 0
    curr_start = 0
    in_dd = False
    for i, d in enumerate(dd):
        if d > 0:
            if not in_dd:
                in_dd = True
                curr_start = i
            if i - curr_start + 1 > max_len:
                max_len = i - curr_start + 1
                start_idx = curr_start
                end_idx = i
        else:
            in_dd = False
    return max_len, start_idx, end_idx


def compute_cagr(
    initial: float,
    final: float,
    years: float,
) -> float:
    """Compound annual growth rate in percent."""
    if initial <= 0 or years <= 0:
        return 0
    return ((final / initial) ** (1 / years) - 1) * 100


def compute_rolling_sharpe(
    returns: List[float],
    window: int = 252,
    risk_free: float = 0,
) -> List[float]:
    """Rolling Sharpe ratio (annualized)."""
    result = []
    for i in range(window, len(returns) + 1):
        win = returns[i - window : i]
        avg = sum(win) / len(win)
        var = sum((r - avg) ** 2 for r in win) / len(win)
        std = math.sqrt(var) if var > 0 else 0
        sharpe = (avg - risk_free / 252) / std * math.sqrt(252) if std > 0 else 0
        result.append(sharpe)
    return result


def compute_excess_returns(
    strategy_returns: List[float],
    benchmark_returns: List[float],
) -> List[float]:
    """Strategy - benchmark return each period."""
    n = min(len(strategy_returns), len(benchmark_returns))
    return [
        strategy_returns[i] - benchmark_returns[i]
        for i in range(n)
    ]


def compute_information_ratio(
    strategy_returns: List[float],
    benchmark_returns: List[float],
) -> float:
    """Annualized information ratio."""
    excess = compute_excess_returns(strategy_returns, benchmark_returns)
    if not excess:
        return 0
    avg = sum(excess) / len(excess)
    var = sum((e - avg) ** 2 for e in excess) / len(excess)
    std = math.sqrt(var) if var > 0 else 0
    return (avg / std) * math.sqrt(252) if std > 0 else 0


def compute_sortino_ratio(
    returns: List[float],
    risk_free: float = 0,
) -> float:
    """Sortino ratio (downside deviation)."""
    if not returns:
        return 0
    avg = sum(returns) / len(returns)
    neg = [r for r in returns if r < 0]
    downside = math.sqrt(sum(r ** 2 for r in neg) / len(neg)) if neg else 0
    return (avg - risk_free / 252) / downside * math.sqrt(252) if downside > 0 else 0


def compute_calmar_ratio(
    total_return_pct: float,
    max_drawdown_pct: float,
    years: float = 1,
) -> float:
    """Calmar = CAGR / max_drawdown."""
    if max_drawdown_pct <= 0 or years <= 0:
        return 0
    cagr = ((1 + total_return_pct / 100) ** (1 / years) - 1) * 100
    return cagr / max_drawdown_pct


# ─── Example Strategies ────────────────────────────────────────────────────────

class SmaCrossoverStrategy(BaseStrategyV5):
    """Simple SMA cross: buy when fast > slow, sell when fast < slow."""

    name = "SMA_Crossover"

    def __init__(self, fast_period: int = 10, slow_period: int = 30):
        super().__init__()
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.prices: List[float] = []

    def on_bar(self, bar: Bar, ctx: StrategyContext) -> None:
        self.prices.append(bar.close)
        if len(self.prices) < self.slow_period:
            return
        fast = sum(self.prices[-self.fast_period :]) / self.fast_period
        slow = sum(self.prices[-self.slow_period :]) / self.slow_period
        pos = ctx.get_position(bar.symbol)
        if fast > slow and pos.quantity <= 0:
            ctx.place_market_order(bar.symbol, "buy", 100)
        elif fast < slow and pos.quantity >= 0:
            ctx.place_market_order(bar.symbol, "sell", abs(pos.quantity))


class MeanReversionStrategy(BaseStrategyV5):
    """Buy when price below mean - k*std, sell when above mean + k*std."""

    name = "MeanReversion"

    def __init__(self, window: int = 20, k: float = 2.0):
        super().__init__()
        self.window = window
        self.k = k
        self.prices: List[float] = []

    def on_bar(self, bar: Bar, ctx: StrategyContext) -> None:
        self.prices.append(bar.close)
        if len(self.prices) < self.window:
            return
        win = self.prices[-self.window :]
        mean = sum(win) / len(win)
        var = sum((p - mean) ** 2 for p in win) / len(win)
        std = math.sqrt(var) if var > 0 else 0
        upper = mean + self.k * std
        lower = mean - self.k * std
        pos = ctx.get_position(bar.symbol)
        if bar.close <= lower and pos.quantity <= 0:
            ctx.place_market_order(bar.symbol, "buy", 100)
        elif bar.close >= upper and pos.quantity > 0:
            ctx.place_market_order(bar.symbol, "sell", pos.quantity)


class MomentumStrategy(BaseStrategyV5):
    """Buy when momentum positive, sell when negative."""

    name = "Momentum"

    def __init__(self, lookback: int = 20):
        super().__init__()
        self.lookback = lookback
        self.prices: List[float] = []

    def on_bar(self, bar: Bar, ctx: StrategyContext) -> None:
        self.prices.append(bar.close)
        if len(self.prices) < self.lookback + 1:
            return
        mom = bar.close - self.prices[-self.lookback - 1]
        pos = ctx.get_position(bar.symbol)
        if mom > 0 and pos.quantity <= 0:
            ctx.place_market_order(bar.symbol, "buy", 100)
        elif mom < 0 and pos.quantity > 0:
            ctx.place_market_order(bar.symbol, "sell", pos.quantity)


# ─── Indicator Helpers (for strategy use) ──────────────────────────────────────

def sma(prices: List[float], period: int) -> Optional[float]:
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period


def ema(prices: List[float], period: int) -> Optional[float]:
    if not prices or period < 1:
        return None
    k = 2 / (period + 1)
    e = prices[0]
    for p in prices[1:]:
        e = k * p + (1 - k) * e
    return e


def rsi(prices: List[float], period: int = 14) -> Optional[float]:
    if len(prices) < period + 1:
        return None
    gains, losses = [], []
    for i in range(len(prices) - period, len(prices)):
        change = prices[i] - prices[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(-change)
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100
    rs = avg_gain / avg_loss
    return 100 - 100 / (1 + rs)


def bollinger_bands(
    prices: List[float],
    period: int = 20,
    k: float = 2,
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    if len(prices) < period:
        return None, None, None
    win = prices[-period:]
    mid = sum(win) / period
    var = sum((p - mid) ** 2 for p in win) / period
    std = math.sqrt(var) if var > 0 else 0
    upper = mid + k * std
    lower = mid - k * std
    return lower, mid, upper


# ─── Report / Export ───────────────────────────────────────────────────────────

def format_metrics_report(metrics: BacktestMetrics) -> str:
    """Human-readable metrics report."""
    return f"""
=== Backtest Metrics ===
Initial Capital:    ${metrics.initial_capital:,.2f}
Final Equity:       ${metrics.final_equity:,.2f}
Total Return:       ${metrics.total_return:,.2f} ({metrics.total_return_pct:.2f}%)
Max Drawdown:      ${metrics.max_drawdown:,.2f} ({metrics.max_drawdown_pct:.2f}%)

Risk-Adjusted:
  Sharpe Ratio:     {metrics.sharpe_ratio:.2f}
  Sortino Ratio:    {metrics.sortino_ratio:.2f}
  Calmar Ratio:     {metrics.calmar_ratio:.2f}

Trades:
  Total:            {metrics.total_trades}
  Winners:          {metrics.winning_trades}
  Losers:           {metrics.losing_trades}
  Win Rate:         {metrics.win_rate:.1f}%
  Profit Factor:    {metrics.profit_factor:.2f}

  Avg Trade PnL:    ${metrics.avg_trade_pnl:,.2f}
  Avg Win:          ${metrics.avg_win:,.2f}
  Avg Loss:         ${metrics.avg_loss:,.2f}
"""


def export_trades_csv(trades: List[Dict[str, Any]], path: str) -> None:
    """Export trades to CSV."""
    import csv
    if not trades:
        return
    keys = list(trades[0].keys())
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(trades)


def export_equity_curve_csv(equity_curve: List[Dict[str, Any]], path: str) -> None:
    """Export equity curve to CSV."""
    import csv
    if not equity_curve:
        return
    keys = list(equity_curve[0].keys())
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(equity_curve)


# ─── Run Backtest Entrypoint ──────────────────────────────────────────────────

def run_backtest(
    symbol: str,
    start_date: datetime,
    end_date: datetime,
    strategy: BaseStrategyV5,
    initial_capital: float = 100000.0,
    slippage: Optional[SlippageConfig] = None,
    commission: Optional[CommissionConfig] = None,
    timeframe: str = "1d",
    seed: Optional[int] = None,
) -> BacktestResultV5:
    """
    Convenience function to run a backtest.
    """
    config = BacktestConfigV5(
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        timeframe=timeframe,
        initial_capital=initial_capital,
        slippage=slippage,
        commission=commission,
        seed=seed,
    )
    engine = BacktestEngineV5(config)
    return engine.run_backtest(strategy)


# ─── Additional Strategy Examples ────────────────────────────────────────────

class RsiStrategy(BaseStrategyV5):
    """RSI oversold/overbought."""

    name = "RSI"

    def __init__(self, period: int = 14, oversold: float = 30, overbought: float = 70):
        super().__init__()
        self.period = period
        self.oversold = oversold
        self.overbought = overbought
        self.prices: List[float] = []

    def on_bar(self, bar: Bar, ctx: StrategyContext) -> None:
        self.prices.append(bar.close)
        r = rsi(self.prices, self.period)
        if r is None:
            return
        pos = ctx.get_position(bar.symbol)
        if r <= self.oversold and pos.quantity <= 0:
            ctx.place_market_order(bar.symbol, "buy", 100)
        elif r >= self.overbought and pos.quantity > 0:
            ctx.place_market_order(bar.symbol, "sell", pos.quantity)


class BollingerBandsStrategy(BaseStrategyV5):
    """Bollinger Bands mean reversion."""

    name = "BollingerBands"

    def __init__(self, period: int = 20, k: float = 2):
        super().__init__()
        self.period = period
        self.k = k
        self.prices: List[float] = []

    def on_bar(self, bar: Bar, ctx: StrategyContext) -> None:
        self.prices.append(bar.close)
        bb = bollinger_bands(self.prices, self.period, self.k)
        if bb[0] is None:
            return
        lower, mid, upper = bb
        pos = ctx.get_position(bar.symbol)
        if bar.close <= lower and pos.quantity <= 0:
            ctx.place_market_order(bar.symbol, "buy", 100)
        elif bar.close >= upper and pos.quantity > 0:
            ctx.place_market_order(bar.symbol, "sell", pos.quantity)


# ─── Heatmap Data Builder ────────────────────────────────────────────────────

def build_monthly_returns_heatmap(
    equity_curve: List[Dict[str, Any]],
) -> Tuple[List[str], List[str], List[List[float]]]:
    """
    Returns (years, months, matrix) for heatmap rendering.
    matrix[row][col] = return for year[row], month[col].
    """
    if len(equity_curve) < 2:
        return [], [], []
    by_key: Dict[str, float] = {}
    prev_ts = equity_curve[0]["timestamp"][:7]
    prev_eq = equity_curve[0]["equity"]
    for pt in equity_curve[1:]:
        ts = pt["timestamp"][:7]
        curr_eq = pt["equity"]
        if prev_eq > 0:
            by_key[prev_ts] = (curr_eq - prev_eq) / prev_eq * 100
        prev_ts, prev_eq = ts, curr_eq
    years = sorted(set(k.split("-")[0] for k in by_key))
    months = [f"{i:02d}" for i in range(1, 13)]
    matrix = []
    for y in years:
        row = []
        for m in months:
            key = f"{y}-{m}"
            row.append(by_key.get(key, float("nan")))
        matrix.append(row)
    return years, months, matrix


# ─── Drawdown Helpers ────────────────────────────────────────────────────────

def max_drawdown_from_curve(equity_curve: List[Dict[str, Any]]) -> float:
    peak = 0
    max_dd = 0
    for pt in equity_curve:
        eq = pt["equity"]
        if eq > peak:
            peak = eq
        dd = peak - eq
        if dd > max_dd:
            max_dd = dd
    return max_dd


def drawdown_duration_bars(equity_curve: List[Dict[str, Any]]) -> int:
    dd_series = compute_drawdown_series(equity_curve)
    max_len = 0
    curr_len = 0
    for d in dd_series:
        if d > 0:
            curr_len += 1
            if curr_len > max_len:
                max_len = curr_len
        else:
            curr_len = 0
    return max_len


# ─── Trade Analysis ──────────────────────────────────────────────────────────

def trade_analysis(trades: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not trades:
        return {
            "total": 0,
            "winners": 0,
            "losers": 0,
            "win_rate": 0,
            "avg_win": 0,
            "avg_loss": 0,
            "largest_win": 0,
            "largest_loss": 0,
            "profit_factor": 0,
        }
    pnls = [t.get("pnl", 0) for t in trades]
    winners = [p for p in pnls if p > 0]
    losers = [p for p in pnls if p < 0]
    gross_profit = sum(winners)
    gross_loss = abs(sum(losers))
    return {
        "total": len(trades),
        "winners": len(winners),
        "losers": len(losers),
        "win_rate": len(winners) / len(trades) * 100 if trades else 0,
        "avg_win": gross_profit / len(winners) if winners else 0,
        "avg_loss": -gross_loss / len(losers) if losers else 0,
        "largest_win": max(winners) if winners else 0,
        "largest_loss": min(losers) if losers else 0,
        "profit_factor": gross_profit / gross_loss if gross_loss > 0 else float("inf"),
    }


# ─── Optimizer Hook ──────────────────────────────────────────────────────────

def grid_search_strategy_params(
    config: BacktestConfigV5,
    strategy_factory: Callable[..., BaseStrategyV5],
    param_grid: Dict[str, List[Any]],
) -> List[Tuple[Dict[str, Any], BacktestResultV5]]:
    """
    Grid search over strategy parameters.
    param_grid e.g. {"fast_period": [5, 10, 15], "slow_period": [20, 30, 40]}
    """
    import itertools
    keys = list(param_grid.keys())
    values = list(param_grid.values())
    results = []
    for combo in itertools.product(*values):
        params = dict(zip(keys, combo))
        strat = strategy_factory(**params)
        engine = BacktestEngineV5(config)
        res = engine.run_backtest(strat)
        results.append((params, res))
    return results


# ─── Out-of-Sample Split ──────────────────────────────────────────────────────

def train_test_split(
    bars: List[Bar],
    train_pct: float = 0.7,
) -> Tuple[List[Bar], List[Bar]]:
    n = len(bars)
    split = int(n * train_pct)
    return bars[:split], bars[split:]


# ─── Bootstrap Returns ────────────────────────────────────────────────────────

def bootstrap_returns(returns: List[float], n_samples: int = 1000, seed: Optional[int] = None) -> List[List[float]]:
    if seed is not None:
        random.seed(seed)
    result = []
    for _ in range(n_samples):
        sample = [random.choice(returns) for _ in range(len(returns))]
        result.append(sample)
    return result
