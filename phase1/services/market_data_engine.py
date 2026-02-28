"""
market_data_engine.py — Real-Time Market Data Aggregation & Processing Engine
==============================================================================
Handles multi-resolution bar aggregation, tick-to-bar conversion, real-time
statistics, market breadth calculations, order book processing, and
time-and-sales reconstruction.

Features:
 • Tick-to-bar aggregation (time-based, volume-based, tick-count, range, renko)
 • Multi-timeframe aggregation from 1m → higher TFs
 • Real-time bar building with partial bar updates
 • Market microstructure statistics
 • Order book depth processing
 • Time & Sales tape reconstruction
 • Market breadth indicators (AD line, TRIN, McClellan)
 • Sector/industry rotation analysis
 • Intraday VWAP with bands
 • Pre-market and after-hours gap analysis
 • Session analytics (RTH/ETH volume distribution)
 • Multi-symbol correlation matrix (rolling)

Pure computation — no Flask/FastAPI imports.
"""

from __future__ import annotations

import math
import time as time_module
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import (
    Any, Callable, Deque, Dict, FrozenSet, List, Literal,
    Optional, Sequence, Set, Tuple, Union,
)

import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta


# ═══════════════════════════════════════════════════════════════════════════════
#  Enums & Constants
# ═══════════════════════════════════════════════════════════════════════════════

class BarType(str, Enum):
    TIME    = "time"
    TICK    = "tick"
    VOLUME  = "volume"
    RANGE   = "range"
    RENKO   = "renko"
    KAGI    = "kagi"
    PNF     = "point_and_figure"


class SessionType(str, Enum):
    PRE_MARKET   = "pre_market"
    REGULAR      = "regular"
    AFTER_HOURS  = "after_hours"
    EXTENDED     = "extended"


# US market hours (Eastern)
RTH_OPEN  = (9, 30)
RTH_CLOSE = (16, 0)
PRE_OPEN  = (4, 0)
AH_CLOSE  = (20, 0)

# Standard timeframe seconds
TF_SECONDS: Dict[str, int] = {
    '1s': 1, '5s': 5, '10s': 10, '15s': 15, '30s': 30,
    '1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600,
    '15m': 900, '20m': 1200, '30m': 1800,
    '1h': 3600, '2h': 7200, '4h': 14400,
    '1D': 86400, '1W': 604800, '1M': 2592000,
}


# ═══════════════════════════════════════════════════════════════════════════════
#  Data Classes
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Tick:
    """A single market tick."""
    symbol: str
    price: float
    size: float
    timestamp: float                    # unix seconds (with microseconds)
    side: Literal['buy', 'sell', 'unknown'] = 'unknown'
    exchange: str = ''
    conditions: List[str] = field(default_factory=list)

    @property
    def is_uptick(self) -> bool:
        return self.side == 'buy'

    @property
    def notional(self) -> float:
        return self.price * self.size


@dataclass
class Bar:
    """OHLCV bar with extended fields."""
    time: float               # unix seconds — bar open time
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    volume: float = 0.0
    trades: int = 0           # tick count
    vwap: float = 0.0
    buy_volume: float = 0.0
    sell_volume: float = 0.0
    # For ongoing bars
    is_closed: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            'time': self.time,
            'open': self.open,
            'high': self.high,
            'low': self.low,
            'close': self.close,
            'volume': self.volume,
            'trades': self.trades,
            'vwap': self.vwap,
            'buy_volume': self.buy_volume,
            'sell_volume': self.sell_volume,
            'is_closed': self.is_closed,
        }

    def update_with_tick(self, tick: Tick) -> None:
        """Update this bar with a new tick."""
        if self.trades == 0:
            self.open = tick.price
            self.high = tick.price
            self.low = tick.price
        else:
            if tick.price > self.high:
                self.high = tick.price
            if tick.price < self.low:
                self.low = tick.price
        self.close = tick.price
        self.volume += tick.size
        self.trades += 1
        if tick.side == 'buy':
            self.buy_volume += tick.size
        elif tick.side == 'sell':
            self.sell_volume += tick.size
        # Running VWAP
        total_notional = self.vwap * (self.volume - tick.size) + tick.notional
        self.vwap = total_notional / self.volume if self.volume > 0 else tick.price


@dataclass
class OrderBookLevel:
    """A single price level in the order book."""
    price: float
    size: float
    count: int = 1
    timestamp: float = 0.0

    @property
    def notional(self) -> float:
        return self.price * self.size


@dataclass
class OrderBook:
    """Full L2 order book snapshot."""
    symbol: str
    bids: List[OrderBookLevel] = field(default_factory=list)   # sorted high→low
    asks: List[OrderBookLevel] = field(default_factory=list)   # sorted low→high
    timestamp: float = 0.0

    @property
    def best_bid(self) -> Optional[float]:
        return self.bids[0].price if self.bids else None

    @property
    def best_ask(self) -> Optional[float]:
        return self.asks[0].price if self.asks else None

    @property
    def mid_price(self) -> Optional[float]:
        bb = self.best_bid
        ba = self.best_ask
        if bb is not None and ba is not None:
            return (bb + ba) / 2
        return None

    @property
    def spread(self) -> Optional[float]:
        bb = self.best_bid
        ba = self.best_ask
        if bb is not None and ba is not None:
            return ba - bb
        return None

    @property
    def spread_bps(self) -> Optional[float]:
        mid = self.mid_price
        s = self.spread
        if mid and s:
            return (s / mid) * 10000
        return None

    @property
    def total_bid_depth(self) -> float:
        return sum(l.size for l in self.bids)

    @property
    def total_ask_depth(self) -> float:
        return sum(l.size for l in self.asks)

    @property
    def imbalance(self) -> float:
        """Order book imbalance: (bid_depth - ask_depth) / (bid_depth + ask_depth). Range [-1, 1]."""
        t = self.total_bid_depth + self.total_ask_depth
        if t == 0:
            return 0
        return (self.total_bid_depth - self.total_ask_depth) / t


@dataclass
class TradeRecord:
    """A time & sales entry."""
    timestamp: float
    price: float
    size: float
    side: str
    exchange: str = ''
    is_block: bool = False
    is_sweep: bool = False
    is_odd_lot: bool = False

    @property
    def notional(self) -> float:
        return self.price * self.size


# ═══════════════════════════════════════════════════════════════════════════════
#  Tick-to-Bar Aggregator
# ═══════════════════════════════════════════════════════════════════════════════

class BarAggregator:
    """
    Aggregates ticks into bars of various types.

    Supports:
     • Time-based (1s, 1m, 5m, ... 1M)
     • Tick-count based (e.g., every 100 ticks)
     • Volume-based (e.g., every 10000 shares)
     • Range-based (e.g., $1 range bars)
     • Renko (fixed brick size)
    """

    def __init__(
        self,
        bar_type: BarType = BarType.TIME,
        interval: Union[int, float] = 60,     # seconds for time, ticks for tick, shares for volume, price for range/renko
        symbol: str = '',
    ) -> None:
        self.bar_type = bar_type
        self.interval = interval
        self.symbol = symbol
        self._current_bar: Optional[Bar] = None
        self._completed_bars: List[Bar] = []
        self._renko_last_price: Optional[float] = None
        self._tick_count_in_bar = 0
        self._volume_in_bar = 0.0
        self._callbacks: List[Callable[[Bar], None]] = []

    def on_bar_complete(self, callback: Callable[[Bar], None]) -> None:
        """Register callback for completed bars."""
        self._callbacks.append(callback)

    def process_tick(self, tick: Tick) -> Optional[Bar]:
        """Process a tick. Returns a completed bar if one was closed, else None."""
        completed = None

        if self.bar_type == BarType.TIME:
            completed = self._process_time_bar(tick)
        elif self.bar_type == BarType.TICK:
            completed = self._process_tick_bar(tick)
        elif self.bar_type == BarType.VOLUME:
            completed = self._process_volume_bar(tick)
        elif self.bar_type == BarType.RANGE:
            completed = self._process_range_bar(tick)
        elif self.bar_type == BarType.RENKO:
            completed = self._process_renko_bar(tick)

        if completed:
            self._completed_bars.append(completed)
            for cb in self._callbacks:
                cb(completed)

        return completed

    def process_ticks(self, ticks: List[Tick]) -> List[Bar]:
        """Process multiple ticks, return all completed bars."""
        result = []
        for tick in ticks:
            bar = self.process_tick(tick)
            if bar:
                result.append(bar)
        return result

    @property
    def current_bar(self) -> Optional[Bar]:
        return self._current_bar

    @property
    def bars(self) -> List[Bar]:
        return self._completed_bars

    def reset(self) -> None:
        self._current_bar = None
        self._completed_bars.clear()
        self._renko_last_price = None
        self._tick_count_in_bar = 0
        self._volume_in_bar = 0.0

    # ── Bar type specific processing ────────────────────────────────

    def _process_time_bar(self, tick: Tick) -> Optional[Bar]:
        """Time-based bar aggregation."""
        interval = self.interval
        bar_time = math.floor(tick.timestamp / interval) * interval

        if self._current_bar is None:
            self._current_bar = Bar(time=bar_time, is_closed=False)
            self._current_bar.update_with_tick(tick)
            return None

        if bar_time > self._current_bar.time:
            # Close current bar
            self._current_bar.is_closed = True
            completed = self._current_bar
            # Start new bar
            self._current_bar = Bar(time=bar_time, is_closed=False)
            self._current_bar.update_with_tick(tick)
            return completed

        self._current_bar.update_with_tick(tick)
        return None

    def _process_tick_bar(self, tick: Tick) -> Optional[Bar]:
        """Tick-count bar aggregation."""
        if self._current_bar is None:
            self._current_bar = Bar(time=tick.timestamp, is_closed=False)
            self._tick_count_in_bar = 0

        self._current_bar.update_with_tick(tick)
        self._tick_count_in_bar += 1

        if self._tick_count_in_bar >= self.interval:
            self._current_bar.is_closed = True
            completed = self._current_bar
            self._current_bar = None
            self._tick_count_in_bar = 0
            return completed

        return None

    def _process_volume_bar(self, tick: Tick) -> Optional[Bar]:
        """Volume-based bar aggregation."""
        if self._current_bar is None:
            self._current_bar = Bar(time=tick.timestamp, is_closed=False)
            self._volume_in_bar = 0.0

        self._current_bar.update_with_tick(tick)
        self._volume_in_bar += tick.size

        if self._volume_in_bar >= self.interval:
            self._current_bar.is_closed = True
            completed = self._current_bar
            self._current_bar = None
            self._volume_in_bar = 0.0
            return completed

        return None

    def _process_range_bar(self, tick: Tick) -> Optional[Bar]:
        """Range-based bar aggregation (fixed price range per bar)."""
        if self._current_bar is None:
            self._current_bar = Bar(time=tick.timestamp, is_closed=False)
            self._current_bar.update_with_tick(tick)
            return None

        self._current_bar.update_with_tick(tick)
        bar_range = self._current_bar.high - self._current_bar.low

        if bar_range >= self.interval:
            self._current_bar.is_closed = True
            completed = self._current_bar
            # Start new bar from current price
            self._current_bar = Bar(time=tick.timestamp, is_closed=False)
            self._current_bar.update_with_tick(tick)
            return completed

        return None

    def _process_renko_bar(self, tick: Tick) -> Optional[Bar]:
        """Renko bar aggregation."""
        brick = self.interval
        if self._renko_last_price is None:
            self._renko_last_price = tick.price
            return None

        diff = tick.price - self._renko_last_price
        if abs(diff) >= brick:
            direction = 1 if diff > 0 else -1
            bricks_count = int(abs(diff) / brick)
            completed = None
            for _ in range(bricks_count):
                new_price = self._renko_last_price + direction * brick
                bar = Bar(
                    time=tick.timestamp,
                    open=self._renko_last_price,
                    high=max(self._renko_last_price, new_price),
                    low=min(self._renko_last_price, new_price),
                    close=new_price,
                    volume=tick.size / bricks_count,
                    trades=1,
                    is_closed=True,
                )
                self._completed_bars.append(bar)
                for cb in self._callbacks:
                    cb(bar)
                self._renko_last_price = new_price
                completed = bar
            return completed

        return None


# ═══════════════════════════════════════════════════════════════════════════════
#  Multi-Timeframe Aggregator
# ═══════════════════════════════════════════════════════════════════════════════

class MultiTimeframeAggregator:
    """Aggregate 1-minute bars into higher timeframes."""

    @staticmethod
    def aggregate(
        bars_1m: pd.DataFrame,
        target_tf: str,
    ) -> pd.DataFrame:
        """
        Aggregate 1-minute OHLCV bars into higher timeframe.

        Parameters:
          bars_1m: DataFrame with columns [time, open, high, low, close, volume]
          target_tf: Target timeframe string (e.g., '5m', '15m', '1h', '4h', '1D')

        Returns:
          Aggregated DataFrame.
        """
        if bars_1m.empty:
            return bars_1m.copy()

        seconds = TF_SECONDS.get(target_tf)
        if seconds is None:
            raise ValueError(f"Unknown timeframe: {target_tf}")

        df = bars_1m.copy()
        df['bar_group'] = (df['time'] // seconds) * seconds

        agg = df.groupby('bar_group').agg(
            time=('bar_group', 'first'),
            open=('open', 'first'),
            high=('high', 'max'),
            low=('low', 'min'),
            close=('close', 'last'),
            volume=('volume', 'sum'),
        ).reset_index(drop=True)

        return agg

    @staticmethod
    def aggregate_with_extras(
        bars_1m: pd.DataFrame,
        target_tf: str,
    ) -> pd.DataFrame:
        """Aggregate with additional columns: trades, vwap, buy_volume, sell_volume."""
        if bars_1m.empty:
            return bars_1m.copy()

        seconds = TF_SECONDS.get(target_tf)
        if seconds is None:
            raise ValueError(f"Unknown timeframe: {target_tf}")

        df = bars_1m.copy()
        df['bar_group'] = (df['time'] // seconds) * seconds

        # Ensure optional columns exist
        for col in ['trades', 'buy_volume', 'sell_volume']:
            if col not in df.columns:
                df[col] = 0

        if 'vwap' not in df.columns:
            df['vwap'] = (df['high'] + df['low'] + df['close']) / 3

        agg_dict: Dict[str, Any] = {
            'time': ('bar_group', 'first'),
            'open': ('open', 'first'),
            'high': ('high', 'max'),
            'low': ('low', 'min'),
            'close': ('close', 'last'),
            'volume': ('volume', 'sum'),
            'trades': ('trades', 'sum'),
            'buy_volume': ('buy_volume', 'sum'),
            'sell_volume': ('sell_volume', 'sum'),
        }

        agg = df.groupby('bar_group').agg(**agg_dict).reset_index(drop=True)

        # Recalculate VWAP
        if 'vwap' in df.columns and 'volume' in df.columns:
            # Weighted VWAP across sub-bars
            df['_notional'] = df['vwap'] * df['volume']
            notional_agg = df.groupby('bar_group')['_notional'].sum().reset_index()
            vol_agg = df.groupby('bar_group')['volume'].sum().reset_index()
            merged = notional_agg.merge(vol_agg, on='bar_group')
            merged['vwap'] = np.where(merged['volume'] > 0, merged['_notional'] / merged['volume'], 0)
            agg = agg.merge(merged[['bar_group', 'vwap']], left_on='time', right_on='bar_group', how='left')
            if 'bar_group' in agg.columns:
                agg.drop(columns=['bar_group'], inplace=True)

        return agg


# ═══════════════════════════════════════════════════════════════════════════════
#  Real-Time Statistics
# ═══════════════════════════════════════════════════════════════════════════════

class RealTimeStats:
    """Running statistics on streaming data (ticks or bar updates)."""

    def __init__(self, window: int = 1000) -> None:
        self._prices: Deque[float] = deque(maxlen=window)
        self._volumes: Deque[float] = deque(maxlen=window)
        self._timestamps: Deque[float] = deque(maxlen=window)
        self._buy_count = 0
        self._sell_count = 0
        self._total_volume = 0.0
        self._total_notional = 0.0
        self._high = -math.inf
        self._low = math.inf
        self._last_price = 0.0
        self._session_open = 0.0
        self._tick_count = 0

    def update(self, tick: Tick) -> None:
        """Update stats with a new tick."""
        self._prices.append(tick.price)
        self._volumes.append(tick.size)
        self._timestamps.append(tick.timestamp)

        if tick.price > self._high:
            self._high = tick.price
        if tick.price < self._low:
            self._low = tick.price

        self._last_price = tick.price
        self._total_volume += tick.size
        self._total_notional += tick.notional
        self._tick_count += 1

        if self._session_open == 0:
            self._session_open = tick.price

        if tick.side == 'buy':
            self._buy_count += 1
        elif tick.side == 'sell':
            self._sell_count += 1

    def snapshot(self) -> Dict[str, Any]:
        """Current statistics snapshot."""
        prices = list(self._prices)
        if not prices:
            return {'tick_count': 0}

        returns = np.diff(prices) / prices[:-1] if len(prices) > 1 else []
        vols = list(self._volumes)

        return {
            'tick_count': self._tick_count,
            'last_price': self._last_price,
            'session_open': self._session_open,
            'high': self._high if self._high != -math.inf else None,
            'low': self._low if self._low != math.inf else None,
            'range': self._high - self._low if self._high != -math.inf else 0,
            'total_volume': self._total_volume,
            'vwap': self._total_notional / self._total_volume if self._total_volume > 0 else 0,
            'buy_count': self._buy_count,
            'sell_count': self._sell_count,
            'buy_ratio': self._buy_count / self._tick_count if self._tick_count > 0 else 0,
            'avg_trade_size': np.mean(vols) if vols else 0,
            'median_trade_size': np.median(vols) if vols else 0,
            'max_trade_size': max(vols) if vols else 0,
            'volatility_window': float(np.std(returns)) if len(returns) > 1 else 0,
            'mean_return': float(np.mean(returns)) if len(returns) > 0 else 0,
            'skewness': float(_skewness(returns)) if len(returns) > 2 else 0,
            'kurtosis': float(_kurtosis(returns)) if len(returns) > 3 else 0,
        }

    def reset(self) -> None:
        self._prices.clear()
        self._volumes.clear()
        self._timestamps.clear()
        self._buy_count = 0
        self._sell_count = 0
        self._total_volume = 0.0
        self._total_notional = 0.0
        self._high = -math.inf
        self._low = math.inf
        self._last_price = 0.0
        self._session_open = 0.0
        self._tick_count = 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Order Book Processor
# ═══════════════════════════════════════════════════════════════════════════════

class OrderBookProcessor:
    """Process and analyze L2 order book data."""

    @staticmethod
    def depth_chart(book: OrderBook, levels: int = 20) -> Dict[str, Any]:
        """Generate depth chart data (cumulative size at each price level)."""
        bid_cum = []
        running = 0.0
        for i, b in enumerate(book.bids[:levels]):
            running += b.size
            bid_cum.append({'price': b.price, 'size': b.size, 'cumulative': running})

        ask_cum = []
        running = 0.0
        for i, a in enumerate(book.asks[:levels]):
            running += a.size
            ask_cum.append({'price': a.price, 'size': a.size, 'cumulative': running})

        return {
            'bids': bid_cum,
            'asks': ask_cum,
            'mid_price': book.mid_price,
            'spread': book.spread,
            'spread_bps': book.spread_bps,
            'imbalance': book.imbalance,
        }

    @staticmethod
    def book_pressure(book: OrderBook, depth: int = 5) -> Dict[str, Any]:
        """Measure buying vs selling pressure from top N levels."""
        bid_total = sum(l.size for l in book.bids[:depth])
        ask_total = sum(l.size for l in book.asks[:depth])
        total = bid_total + ask_total

        return {
            'bid_pressure': bid_total / total if total > 0 else 0.5,
            'ask_pressure': ask_total / total if total > 0 else 0.5,
            'pressure_ratio': bid_total / ask_total if ask_total > 0 else float('inf'),
            'bid_depth': bid_total,
            'ask_depth': ask_total,
            'bias': 'buy' if bid_total > ask_total * 1.2 else 'sell' if ask_total > bid_total * 1.2 else 'neutral',
        }

    @staticmethod
    def detect_walls(
        book: OrderBook, threshold_multiple: float = 3.0, depth: int = 20,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Detect large size walls in the order book."""
        bid_sizes = [l.size for l in book.bids[:depth]]
        ask_sizes = [l.size for l in book.asks[:depth]]

        avg_bid = np.mean(bid_sizes) if bid_sizes else 1
        avg_ask = np.mean(ask_sizes) if ask_sizes else 1

        bid_walls = [
            {'price': book.bids[i].price, 'size': book.bids[i].size, 'multiple': book.bids[i].size / avg_bid}
            for i in range(len(book.bids[:depth]))
            if book.bids[i].size > avg_bid * threshold_multiple
        ]

        ask_walls = [
            {'price': book.asks[i].price, 'size': book.asks[i].size, 'multiple': book.asks[i].size / avg_ask}
            for i in range(len(book.asks[:depth]))
            if book.asks[i].size > avg_ask * threshold_multiple
        ]

        return {'bid_walls': bid_walls, 'ask_walls': ask_walls}

    @staticmethod
    def weighted_mid_price(book: OrderBook) -> Optional[float]:
        """Volume-weighted mid-price — biased toward the side with less size."""
        if not book.bids or not book.asks:
            return None
        bb = book.bids[0]
        ba = book.asks[0]
        total = bb.size + ba.size
        if total == 0:
            return (bb.price + ba.price) / 2
        return (bb.price * ba.size + ba.price * bb.size) / total

    @staticmethod
    def micro_price(book: OrderBook) -> Optional[float]:
        """Micro-price: size-weighted mid that better predicts next trade."""
        return OrderBookProcessor.weighted_mid_price(book)

    @staticmethod
    def book_shape(book: OrderBook, levels: int = 10) -> Dict[str, Any]:
        """Analyze the shape (convexity) of the order book."""
        bid_sizes = [l.size for l in book.bids[:levels]]
        ask_sizes = [l.size for l in book.asks[:levels]]

        # How much size is concentrated near the top
        if bid_sizes:
            bid_concentration = bid_sizes[0] / sum(bid_sizes) if sum(bid_sizes) > 0 else 0
        else:
            bid_concentration = 0

        if ask_sizes:
            ask_concentration = ask_sizes[0] / sum(ask_sizes) if sum(ask_sizes) > 0 else 0
        else:
            ask_concentration = 0

        return {
            'bid_concentration': bid_concentration,
            'ask_concentration': ask_concentration,
            'bid_shape': 'concentrated' if bid_concentration > 0.3 else 'distributed',
            'ask_shape': 'concentrated' if ask_concentration > 0.3 else 'distributed',
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  Time & Sales Processor
# ═══════════════════════════════════════════════════════════════════════════════

class TimeAndSalesProcessor:
    """Process and analyze the time and sales tape."""

    def __init__(self, window: int = 5000) -> None:
        self._trades: Deque[TradeRecord] = deque(maxlen=window)
        self._block_threshold: float = 10000       # shares
        self._sweep_time_window: float = 0.5       # seconds
        self._odd_lot_threshold: float = 100

    def add_trade(self, trade: TradeRecord) -> None:
        """Add a trade to the tape."""
        trade.is_block = trade.size >= self._block_threshold
        trade.is_odd_lot = trade.size < self._odd_lot_threshold
        # Detect sweep: multiple trades at same price within short window
        if len(self._trades) >= 2:
            recent = [t for t in self._trades if abs(t.timestamp - trade.timestamp) < self._sweep_time_window]
            same_side = [t for t in recent if t.side == trade.side]
            if len(same_side) >= 3:
                trade.is_sweep = True
        self._trades.append(trade)

    def add_trades(self, trades: List[TradeRecord]) -> None:
        for t in trades:
            self.add_trade(t)

    def block_trades(self, n: int = 50) -> List[Dict[str, Any]]:
        """Return recent block trades."""
        blocks = [t for t in self._trades if t.is_block]
        return [
            {
                'timestamp': t.timestamp,
                'price': t.price,
                'size': t.size,
                'side': t.side,
                'notional': t.notional,
            }
            for t in list(blocks)[-n:]
        ]

    def sweep_trades(self, n: int = 50) -> List[Dict[str, Any]]:
        """Return recent sweep trades."""
        sweeps = [t for t in self._trades if t.is_sweep]
        return [
            {
                'timestamp': t.timestamp,
                'price': t.price,
                'size': t.size,
                'side': t.side,
            }
            for t in list(sweeps)[-n:]
        ]

    def tape_speed(self, window_seconds: float = 60) -> Dict[str, Any]:
        """Measure tape speed (trades per second) over a rolling window."""
        if not self._trades:
            return {'tps': 0, 'avg_size': 0, 'total_volume': 0}
        now = self._trades[-1].timestamp
        window_trades = [t for t in self._trades if t.timestamp >= now - window_seconds]
        n = len(window_trades)
        if n == 0:
            return {'tps': 0, 'avg_size': 0, 'total_volume': 0}
        elapsed = max(window_trades[-1].timestamp - window_trades[0].timestamp, 1)
        total_vol = sum(t.size for t in window_trades)
        return {
            'tps': n / elapsed,
            'avg_size': total_vol / n,
            'total_volume': total_vol,
            'buy_volume': sum(t.size for t in window_trades if t.side == 'buy'),
            'sell_volume': sum(t.size for t in window_trades if t.side == 'sell'),
            'trades_in_window': n,
        }

    def price_at_volume(self, levels: int = 20) -> List[Dict[str, Any]]:
        """Volume profile from trade tape."""
        if not self._trades:
            return []
        prices = [t.price for t in self._trades]
        min_p = min(prices)
        max_p = max(prices)
        if max_p == min_p:
            return [{'price': min_p, 'volume': sum(t.size for t in self._trades)}]
        step = (max_p - min_p) / levels
        buckets: Dict[int, float] = defaultdict(float)
        for t in self._trades:
            idx = min(int((t.price - min_p) / step), levels - 1)
            buckets[idx] += t.size
        return [
            {'price': round(min_p + (i + 0.5) * step, 4), 'volume': buckets.get(i, 0)}
            for i in range(levels)
        ]


# ═══════════════════════════════════════════════════════════════════════════════
#  Market Breadth
# ═══════════════════════════════════════════════════════════════════════════════

class MarketBreadth:
    """Market breadth indicators for index-level analysis."""

    @staticmethod
    def advance_decline_line(
        advances: pd.Series, declines: pd.Series,
    ) -> pd.Series:
        """Cumulative advance-decline line."""
        return (advances - declines).cumsum()

    @staticmethod
    def advance_decline_ratio(
        advances: pd.Series, declines: pd.Series,
    ) -> pd.Series:
        """A/D ratio."""
        return advances / declines.replace(0, 1)

    @staticmethod
    def trin(
        advances: pd.Series, declines: pd.Series,
        advance_volume: pd.Series, decline_volume: pd.Series,
    ) -> pd.Series:
        """
        TRIN (Arms Index).
        TRIN < 1 = bullish, > 1 = bearish.
        """
        ad_ratio = advances / declines.replace(0, 1)
        vol_ratio = advance_volume / decline_volume.replace(0, 1)
        return ad_ratio / vol_ratio.replace(0, 1)

    @staticmethod
    def mcclellan_oscillator(
        advances: pd.Series, declines: pd.Series,
        fast: int = 19, slow: int = 39,
    ) -> pd.DataFrame:
        """McClellan Oscillator and Summation Index."""
        breadth = advances - declines
        ema_fast = breadth.ewm(span=fast, adjust=False).mean()
        ema_slow = breadth.ewm(span=slow, adjust=False).mean()
        oscillator = ema_fast - ema_slow
        summation = oscillator.cumsum()
        return pd.DataFrame({
            'oscillator': oscillator,
            'summation': summation,
            'ema_fast': ema_fast,
            'ema_slow': ema_slow,
        })

    @staticmethod
    def new_highs_lows(
        new_highs: pd.Series, new_lows: pd.Series,
    ) -> pd.DataFrame:
        """New highs minus new lows."""
        diff = new_highs - new_lows
        return pd.DataFrame({
            'new_highs': new_highs,
            'new_lows': new_lows,
            'diff': diff,
            'cumulative': diff.cumsum(),
            'ma_10': diff.rolling(10).mean(),
        })

    @staticmethod
    def percent_above_ma(
        closes: pd.DataFrame,  # DataFrame with one column per symbol
        ma_period: int = 50,
    ) -> pd.Series:
        """Percentage of symbols trading above their N-day MA."""
        ma = closes.rolling(ma_period).mean()
        above = (closes > ma).sum(axis=1)
        total = closes.notna().sum(axis=1)
        return (above / total.replace(0, 1)) * 100

    @staticmethod
    def sector_rotation(
        sector_returns: pd.DataFrame,
        market_return: pd.Series,
        lookback: int = 20,
    ) -> pd.DataFrame:
        """
        Sector rotation analysis: relative strength vs market.
        Returns rolling relative performance for each sector.
        """
        rolling_sector = sector_returns.rolling(lookback).mean()
        rolling_market = market_return.rolling(lookback).mean()
        relative = rolling_sector.subtract(rolling_market, axis=0)
        return relative


# ═══════════════════════════════════════════════════════════════════════════════
#  Session Analytics
# ═══════════════════════════════════════════════════════════════════════════════

class SessionAnalytics:
    """Analyze trading sessions (pre-market, regular hours, after-hours)."""

    @staticmethod
    def classify_session(timestamp: float) -> SessionType:
        """Classify a timestamp into a session type (assumes US/Eastern)."""
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        # Rough UTC offset for Eastern (not DST-aware)
        et = dt - timedelta(hours=5)
        h, m = et.hour, et.minute
        t = h * 60 + m
        rth_open = RTH_OPEN[0] * 60 + RTH_OPEN[1]
        rth_close = RTH_CLOSE[0] * 60 + RTH_CLOSE[1]
        pre_open = PRE_OPEN[0] * 60 + PRE_OPEN[1]
        ah_close = AH_CLOSE[0] * 60 + AH_CLOSE[1]

        if rth_open <= t < rth_close:
            return SessionType.REGULAR
        elif pre_open <= t < rth_open:
            return SessionType.PRE_MARKET
        elif rth_close <= t < ah_close:
            return SessionType.AFTER_HOURS
        else:
            return SessionType.EXTENDED

    @staticmethod
    def session_stats(bars: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        """Compute statistics for each session type."""
        if bars.empty or 'time' not in bars.columns:
            return {}
        df = bars.copy()
        df['session'] = df['time'].apply(SessionAnalytics.classify_session)
        result = {}
        for session_type in SessionType:
            subset = df[df['session'] == session_type.value]
            if subset.empty:
                continue
            result[session_type.value] = {
                'bar_count': len(subset),
                'total_volume': float(subset['volume'].sum()),
                'avg_volume': float(subset['volume'].mean()),
                'high': float(subset['high'].max()),
                'low': float(subset['low'].min()),
                'open': float(subset['open'].iloc[0]),
                'close': float(subset['close'].iloc[-1]),
                'range': float(subset['high'].max() - subset['low'].min()),
                'avg_range': float((subset['high'] - subset['low']).mean()),
            }
        return result

    @staticmethod
    def gap_analysis(daily_bars: pd.DataFrame) -> pd.DataFrame:
        """Compute overnight gaps (close-to-open)."""
        if daily_bars.empty or len(daily_bars) < 2:
            return pd.DataFrame()
        df = daily_bars.copy()
        df['prev_close'] = df['close'].shift(1)
        df['gap'] = df['open'] - df['prev_close']
        df['gap_pct'] = (df['gap'] / df['prev_close']) * 100
        df['gap_type'] = np.where(
            df['gap'] > 0,
            np.where(df['low'] > df['prev_close'], 'full_gap_up', 'partial_gap_up'),
            np.where(df['gap'] < 0,
                np.where(df['high'] < df['prev_close'], 'full_gap_down', 'partial_gap_down'),
                'no_gap',
            ),
        )
        df['gap_filled'] = np.where(
            df['gap'] > 0,
            df['low'] <= df['prev_close'],
            np.where(df['gap'] < 0, df['high'] >= df['prev_close'], True),
        )
        return df[['time', 'open', 'prev_close', 'gap', 'gap_pct', 'gap_type', 'gap_filled']].dropna()


# ═══════════════════════════════════════════════════════════════════════════════
#  Intraday VWAP Calculator
# ═══════════════════════════════════════════════════════════════════════════════

class IntradayVWAP:
    """Session VWAP with standard deviation bands."""

    @staticmethod
    def calculate(
        bars: pd.DataFrame,
        bands: List[float] = [1.0, 2.0, 3.0],
    ) -> pd.DataFrame:
        """
        Compute session VWAP with deviation bands.

        Parameters:
          bars: DataFrame with time, high, low, close, volume
          bands: Standard deviation multipliers for bands

        Returns:
          DataFrame with vwap, upper_1, lower_1, upper_2, lower_2, etc.
        """
        if bars.empty:
            return bars.copy()

        df = bars.copy()
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        cum_vol = df['volume'].cumsum()
        cum_tp_vol = (typical_price * df['volume']).cumsum()

        vwap = cum_tp_vol / cum_vol.replace(0, 1)
        df['vwap'] = vwap

        # Standard deviation from VWAP
        df['_dev_sq'] = ((typical_price - vwap) ** 2 * df['volume'])
        cum_dev_sq = df['_dev_sq'].cumsum()
        std_dev = np.sqrt(cum_dev_sq / cum_vol.replace(0, 1))

        for mult in bands:
            df[f'upper_{mult}'] = vwap + std_dev * mult
            df[f'lower_{mult}'] = vwap - std_dev * mult

        df.drop(columns=['_dev_sq'], inplace=True)
        return df

    @staticmethod
    def anchored_vwap(
        bars: pd.DataFrame,
        anchor_time: float,
    ) -> pd.Series:
        """VWAP anchored to a specific time."""
        df = bars[bars['time'] >= anchor_time].copy()
        if df.empty:
            return pd.Series(dtype=float)
        tp = (df['high'] + df['low'] + df['close']) / 3
        cum_vol = df['volume'].cumsum()
        cum_tp_vol = (tp * df['volume']).cumsum()
        return cum_tp_vol / cum_vol.replace(0, 1)


# ═══════════════════════════════════════════════════════════════════════════════
#  Correlation Matrix
# ═══════════════════════════════════════════════════════════════════════════════

class CorrelationAnalyzer:
    """Rolling correlation matrix for multiple symbols."""

    @staticmethod
    def correlation_matrix(
        close_prices: pd.DataFrame,
        window: int = 20,
    ) -> pd.DataFrame:
        """
        Compute rolling correlation matrix.

        Parameters:
          close_prices: DataFrame with one column per symbol
          window: Lookback period

        Returns:
          Correlation matrix of log returns.
        """
        log_returns = np.log(close_prices / close_prices.shift(1)).dropna()
        return log_returns.corr()

    @staticmethod
    def rolling_correlation(
        series_a: pd.Series, series_b: pd.Series, window: int = 20,
    ) -> pd.Series:
        """Rolling correlation between two series."""
        return series_a.rolling(window).corr(series_b)

    @staticmethod
    def beta(
        asset: pd.Series, benchmark: pd.Series, window: int = 252,
    ) -> pd.Series:
        """Rolling beta of asset vs benchmark."""
        asset_ret = asset.pct_change()
        bench_ret = benchmark.pct_change()
        cov = asset_ret.rolling(window).cov(bench_ret)
        var = bench_ret.rolling(window).var()
        return cov / var.replace(0, np.nan)

    @staticmethod
    def pair_divergence(
        series_a: pd.Series, series_b: pd.Series, window: int = 20,
    ) -> pd.DataFrame:
        """Detect divergence between two correlated series."""
        norm_a = series_a / series_a.iloc[0]
        norm_b = series_b / series_b.iloc[0]
        spread = norm_a - norm_b
        z = (spread - spread.rolling(window).mean()) / spread.rolling(window).std().replace(0, 1)
        return pd.DataFrame({
            'spread': spread,
            'z_score': z,
            'signal': np.where(z > 2, 'short_a_long_b',
                      np.where(z < -2, 'long_a_short_b', 'neutral')),
        })


# ═══════════════════════════════════════════════════════════════════════════════
#  Market Data Engine (Orchestrator)
# ═══════════════════════════════════════════════════════════════════════════════

class MarketDataEngine:
    """
    Main orchestrator for real-time market data processing.

    Integrates:
     • Tick-to-bar aggregation
     • Real-time stats
     • Time & Sales
     • Order book processing
     • VWAP calculation
     • Session analytics
    """

    def __init__(self) -> None:
        self._aggregators: Dict[str, Dict[str, BarAggregator]] = {}  # symbol → {tf → agg}
        self._stats: Dict[str, RealTimeStats] = {}
        self._tape: Dict[str, TimeAndSalesProcessor] = {}
        self._books: Dict[str, OrderBook] = {}

    def register_symbol(
        self,
        symbol: str,
        timeframes: Optional[List[str]] = None,
        bar_types: Optional[Dict[str, BarType]] = None,
    ) -> None:
        """Register a symbol for real-time processing."""
        if timeframes is None:
            timeframes = ['1m', '5m', '15m', '1h']

        self._stats[symbol] = RealTimeStats()
        self._tape[symbol] = TimeAndSalesProcessor()
        self._aggregators[symbol] = {}

        for tf in timeframes:
            bt = BarType.TIME
            interval = TF_SECONDS.get(tf, 60)
            if bar_types and tf in bar_types:
                bt = bar_types[tf]
            self._aggregators[symbol][tf] = BarAggregator(
                bar_type=bt, interval=interval, symbol=symbol,
            )

    def process_tick(self, tick: Tick) -> Dict[str, Optional[Bar]]:
        """
        Process an incoming tick across all registered timeframes.
        Returns dict of {timeframe: completed_bar or None}.
        """
        sym = tick.symbol
        result: Dict[str, Optional[Bar]] = {}

        # Update stats
        if sym in self._stats:
            self._stats[sym].update(tick)

        # Update tape
        if sym in self._tape:
            self._tape[sym].add_trade(TradeRecord(
                timestamp=tick.timestamp,
                price=tick.price,
                size=tick.size,
                side=tick.side,
            ))

        # Process through aggregators
        if sym in self._aggregators:
            for tf, agg in self._aggregators[sym].items():
                result[tf] = agg.process_tick(tick)

        return result

    def update_book(self, book: OrderBook) -> None:
        """Update order book for a symbol."""
        self._books[book.symbol] = book

    def get_stats(self, symbol: str) -> Dict[str, Any]:
        s = self._stats.get(symbol)
        return s.snapshot() if s else {}

    def get_book_analysis(self, symbol: str) -> Dict[str, Any]:
        book = self._books.get(symbol)
        if not book:
            return {}
        return {
            **OrderBookProcessor.depth_chart(book),
            'pressure': OrderBookProcessor.book_pressure(book),
            'walls': OrderBookProcessor.detect_walls(book),
            'micro_price': OrderBookProcessor.micro_price(book),
            'shape': OrderBookProcessor.book_shape(book),
        }

    def get_tape_analysis(self, symbol: str) -> Dict[str, Any]:
        tape = self._tape.get(symbol)
        if not tape:
            return {}
        return {
            'speed': tape.tape_speed(),
            'block_trades': tape.block_trades(20),
            'sweep_trades': tape.sweep_trades(20),
            'price_at_volume': tape.price_at_volume(),
        }

    def get_bars(self, symbol: str, timeframe: str) -> List[Bar]:
        """Get completed bars for a symbol/timeframe."""
        agg = self._aggregators.get(symbol, {}).get(timeframe)
        return agg.bars if agg else []

    def get_current_bar(self, symbol: str, timeframe: str) -> Optional[Bar]:
        agg = self._aggregators.get(symbol, {}).get(timeframe)
        return agg.current_bar if agg else None


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _skewness(data: Union[List[float], np.ndarray]) -> float:
    arr = np.array(data) if not isinstance(data, np.ndarray) else data
    n = len(arr)
    if n < 3:
        return 0.0
    m = np.mean(arr)
    s = np.std(arr, ddof=1)
    if s == 0:
        return 0.0
    return (n / ((n - 1) * (n - 2))) * np.sum(((arr - m) / s) ** 3)


def _kurtosis(data: Union[List[float], np.ndarray]) -> float:
    arr = np.array(data) if not isinstance(data, np.ndarray) else data
    n = len(arr)
    if n < 4:
        return 0.0
    m = np.mean(arr)
    s = np.std(arr, ddof=1)
    if s == 0:
        return 0.0
    k4 = np.mean(((arr - m) / s) ** 4)
    return k4 - 3  # excess kurtosis
