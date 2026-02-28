"""
Apex Terminal — Bloomberg-Grade Market Replay & Historical Simulation Engine
=============================================================================

Comprehensive market replay and historical simulation:
- Tick-by-tick historical replay
- Bar-level replay at configurable speed (1x–100x)
- Order book reconstruction simulation
- Time-travel to any historical point
- Play/Pause/Rewind/Fast-forward controls
- Candle-by-candle stepping
- Volume replay and profiling
- Replay session state management
- Event overlay during replay (earnings, dividends, economic)
- Performance statistics during replay
- Trade simulation during replay
- Snapshot/bookmark historical states
- Multi-timeframe synchronized replay

Pure computation module — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class ReplayState(Enum):
    STOPPED = "stopped"
    PLAYING = "playing"
    PAUSED = "paused"
    STEPPING = "stepping"
    REWINDING = "rewinding"
    FINISHED = "finished"


class ReplaySpeed(Enum):
    SLOW_0_25X = 0.25
    SLOW_0_5X = 0.5
    NORMAL_1X = 1.0
    FAST_2X = 2.0
    FAST_5X = 5.0
    FAST_10X = 10.0
    FAST_25X = 25.0
    FAST_50X = 50.0
    FAST_100X = 100.0


class TimeframeType(Enum):
    TICK = "tick"
    SECOND_1 = "1s"
    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class TickData:
    """Single tick of market data."""
    timestamp: datetime
    price: float
    volume: float = 0.0
    bid: float = 0.0
    ask: float = 0.0
    trade_id: str = ""
    is_trade: bool = True

    @property
    def spread(self) -> float:
        if self.bid > 0 and self.ask > 0:
            return self.ask - self.bid
        return 0.0

    @property
    def mid_price(self) -> float:
        if self.bid > 0 and self.ask > 0:
            return (self.bid + self.ask) / 2
        return self.price

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "price": self.price,
            "volume": self.volume,
            "bid": self.bid,
            "ask": self.ask,
            "spread": self.spread,
        }


@dataclass
class ReplayBar:
    """OHLCV bar during replay."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    tick_count: int = 0
    vwap: float = 0.0

    @property
    def is_bullish(self) -> bool:
        return self.close >= self.open

    @property
    def body_size(self) -> float:
        return abs(self.close - self.open)

    @property
    def upper_wick(self) -> float:
        return self.high - max(self.open, self.close)

    @property
    def lower_wick(self) -> float:
        return min(self.open, self.close) - self.low

    @property
    def range(self) -> float:
        return self.high - self.low

    @property
    def change_pct(self) -> float:
        if self.open > 0:
            return ((self.close - self.open) / self.open) * 100
        return 0.0

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "vwap": self.vwap,
            "is_bullish": self.is_bullish,
            "change_pct": round(self.change_pct, 4),
        }


@dataclass
class ReplayOrder:
    """Simulated order during replay."""
    order_id: str
    side: OrderSide
    price: float
    quantity: float
    timestamp: datetime
    fill_price: float | None = None
    fill_time: datetime | None = None
    is_filled: bool = False
    pnl: float = 0.0

    def fill(self, fill_price: float, fill_time: datetime) -> None:
        self.fill_price = fill_price
        self.fill_time = fill_time
        self.is_filled = True

    def to_dict(self) -> dict:
        return {
            "order_id": self.order_id,
            "side": self.side.value,
            "price": self.price,
            "quantity": self.quantity,
            "timestamp": self.timestamp.isoformat(),
            "fill_price": self.fill_price,
            "is_filled": self.is_filled,
            "pnl": self.pnl,
        }


@dataclass
class ReplayBookmark:
    """Bookmark/snapshot of a replay position."""
    bookmark_id: str
    name: str
    bar_index: int
    timestamp: datetime
    price: float
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "bookmark_id": self.bookmark_id,
            "name": self.name,
            "bar_index": self.bar_index,
            "timestamp": self.timestamp.isoformat(),
            "price": self.price,
            "notes": self.notes,
        }


@dataclass
class ReplayStatistics:
    """Running statistics during replay."""
    bars_played: int = 0
    total_bars: int = 0
    total_volume: float = 0.0
    high_of_session: float = 0.0
    low_of_session: float = float('inf')
    session_open: float = 0.0
    current_price: float = 0.0
    trades_taken: int = 0
    winning_trades: int = 0
    total_pnl: float = 0.0

    @property
    def progress_pct(self) -> float:
        if self.total_bars > 0:
            return (self.bars_played / self.total_bars) * 100
        return 0.0

    @property
    def session_change_pct(self) -> float:
        if self.session_open > 0:
            return ((self.current_price - self.session_open) / self.session_open) * 100
        return 0.0

    @property
    def win_rate(self) -> float:
        if self.trades_taken > 0:
            return (self.winning_trades / self.trades_taken) * 100
        return 0.0

    def to_dict(self) -> dict:
        low_session = self.low_of_session if self.low_of_session != float('inf') else 0.0
        return {
            "bars_played": self.bars_played,
            "total_bars": self.total_bars,
            "progress_pct": round(self.progress_pct, 2),
            "total_volume": self.total_volume,
            "high_of_session": self.high_of_session,
            "low_of_session": low_session,
            "session_change_pct": round(self.session_change_pct, 4),
            "trades_taken": self.trades_taken,
            "win_rate": round(self.win_rate, 2),
            "total_pnl": round(self.total_pnl, 2),
        }


# ─── Bar Aggregator ─────────────────────────────────────────────────────────

class BarAggregator:
    """Aggregate ticks or bars into different timeframes."""

    @staticmethod
    def ticks_to_bars(ticks: list[TickData], bar_seconds: int = 60) -> list[ReplayBar]:
        """Aggregate ticks into time-based bars."""
        if not ticks:
            return []

        bars = []
        current_bar_start = ticks[0].timestamp.replace(second=0, microsecond=0)
        bar_ticks = []

        for tick in ticks:
            if (tick.timestamp - current_bar_start).total_seconds() >= bar_seconds:
                if bar_ticks:
                    bars.append(BarAggregator._aggregate_ticks(current_bar_start, bar_ticks))
                current_bar_start = tick.timestamp.replace(second=0, microsecond=0)
                bar_ticks = [tick]
            else:
                bar_ticks.append(tick)

        if bar_ticks:
            bars.append(BarAggregator._aggregate_ticks(current_bar_start, bar_ticks))

        return bars

    @staticmethod
    def _aggregate_ticks(timestamp: datetime, ticks: list[TickData]) -> ReplayBar:
        """Create bar from ticks."""
        prices = [t.price for t in ticks]
        volumes = [t.volume for t in ticks]
        total_vol = sum(volumes)
        vwap = sum(p * v for p, v in zip(prices, volumes)) / total_vol if total_vol > 0 else prices[-1]

        return ReplayBar(
            timestamp=timestamp,
            open=prices[0],
            high=max(prices),
            low=min(prices),
            close=prices[-1],
            volume=total_vol,
            tick_count=len(ticks),
            vwap=vwap,
        )

    @staticmethod
    def resample_bars(bars: list[ReplayBar], factor: int = 5) -> list[ReplayBar]:
        """Resample bars to higher timeframe (e.g., 5 x 1min = 5min)."""
        if not bars or factor < 1:
            return bars

        resampled = []
        for i in range(0, len(bars), factor):
            chunk = bars[i:i + factor]
            if not chunk:
                continue

            resampled.append(ReplayBar(
                timestamp=chunk[0].timestamp,
                open=chunk[0].open,
                high=max(b.high for b in chunk),
                low=min(b.low for b in chunk),
                close=chunk[-1].close,
                volume=sum(b.volume for b in chunk),
                tick_count=sum(b.tick_count for b in chunk),
            ))

        return resampled


# ─── Order Book Simulator ───────────────────────────────────────────────────

class OrderBookSimulator:
    """Simulate order book depth during replay."""

    @staticmethod
    def generate_book_snapshot(mid_price: float, depth: int = 10, avg_spread_pct: float = 0.05,
                                base_size: float = 100.0, seed: int | None = None) -> dict:
        """Generate a realistic order book snapshot."""
        rng = np.random.RandomState(seed)
        spread = mid_price * avg_spread_pct / 100
        half_spread = spread / 2

        bids = []
        asks = []

        for level in range(depth):
            offset = half_spread + (level * spread * 0.3)
            size_mult = rng.uniform(0.5, 3.0)

            bids.append({
                "price": round(mid_price - offset, 2),
                "size": round(base_size * size_mult, 0),
                "orders": rng.randint(1, 20),
            })
            asks.append({
                "price": round(mid_price + offset, 2),
                "size": round(base_size * size_mult * rng.uniform(0.8, 1.2), 0),
                "orders": rng.randint(1, 20),
            })

        total_bid = sum(b["size"] for b in bids)
        total_ask = sum(a["size"] for a in asks)

        return {
            "mid_price": mid_price,
            "spread": spread,
            "bids": bids,
            "asks": asks,
            "bid_depth": total_bid,
            "ask_depth": total_ask,
            "imbalance": (total_bid - total_ask) / (total_bid + total_ask) if (total_bid + total_ask) > 0 else 0.0,
        }

    @staticmethod
    def simulate_book_evolution(prices: list[float], depth: int = 5) -> list[dict]:
        """Simulate order book evolution over price series."""
        books = []
        for i, price in enumerate(prices):
            book = OrderBookSimulator.generate_book_snapshot(price, depth, seed=i * 42)
            books.append(book)
        return books


# ─── Volume Profiler ────────────────────────────────────────────────────────

class ReplayVolumeProfiler:
    """Build volume profile during replay session."""

    def __init__(self, num_levels: int = 50):
        self.num_levels = num_levels
        self.price_volumes: dict[float, float] = {}
        self.price_buy_volumes: dict[float, float] = {}
        self.price_sell_volumes: dict[float, float] = {}

    def add_bar(self, bar: ReplayBar, buy_ratio: float = 0.5) -> None:
        """Add a bar to the volume profile."""
        price_key = round(bar.vwap if bar.vwap > 0 else (bar.high + bar.low + bar.close) / 3, 2)
        self.price_volumes[price_key] = self.price_volumes.get(price_key, 0.0) + bar.volume
        self.price_buy_volumes[price_key] = self.price_buy_volumes.get(price_key, 0.0) + bar.volume * buy_ratio
        self.price_sell_volumes[price_key] = self.price_sell_volumes.get(price_key, 0.0) + bar.volume * (1 - buy_ratio)

    def profile(self) -> dict:
        """Get current volume profile."""
        if not self.price_volumes:
            return {"poc": 0.0, "vah": 0.0, "val": 0.0, "levels": []}

        # POC: Price of Control (highest volume price level)
        poc_price = max(self.price_volumes, key=self.price_volumes.get)

        # Value Area (70% of total volume)
        total_vol = sum(self.price_volumes.values())
        target_vol = total_vol * 0.70

        sorted_levels = sorted(self.price_volumes.items(), key=lambda x: x[1], reverse=True)
        running_vol = 0.0
        va_prices = []

        for price, vol in sorted_levels:
            running_vol += vol
            va_prices.append(price)
            if running_vol >= target_vol:
                break

        vah = max(va_prices) if va_prices else poc_price
        val = min(va_prices) if va_prices else poc_price

        levels = [
            {"price": p, "volume": v, "buy_volume": self.price_buy_volumes.get(p, 0),
             "sell_volume": self.price_sell_volumes.get(p, 0)}
            for p, v in sorted(self.price_volumes.items())
        ]

        return {
            "poc": poc_price,
            "vah": vah,
            "val": val,
            "total_volume": total_vol,
            "levels": levels,
        }

    def reset(self) -> None:
        self.price_volumes.clear()
        self.price_buy_volumes.clear()
        self.price_sell_volumes.clear()


# ─── Trade Simulator ────────────────────────────────────────────────────────

class ReplayTradeSimulator:
    """Simulate trades during market replay."""

    def __init__(self, initial_capital: float = 100000.0, commission_per_share: float = 0.005):
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.commission = commission_per_share
        self.position: float = 0.0
        self.avg_cost: float = 0.0
        self.orders: list[ReplayOrder] = []
        self.closed_trades: list[dict] = []
        self._next_id = 1

    def place_order(self, side: OrderSide, quantity: float, price: float, timestamp: datetime) -> ReplayOrder:
        """Place a simulated order."""
        order = ReplayOrder(
            order_id=f"R_{self._next_id:06d}",
            side=side,
            price=price,
            quantity=quantity,
            timestamp=timestamp,
        )
        self._next_id += 1

        # Immediate fill at given price
        commission = self.commission * quantity
        order.fill(price, timestamp)

        if side == OrderSide.BUY:
            cost = price * quantity + commission
            if cost <= self.capital:
                total_cost = self.avg_cost * self.position + price * quantity
                self.position += quantity
                self.avg_cost = total_cost / self.position if self.position > 0 else 0
                self.capital -= cost
            else:
                order.is_filled = False
        else:
            if quantity <= self.position:
                pnl = (price - self.avg_cost) * quantity - commission
                self.capital += price * quantity - commission
                self.position -= quantity
                order.pnl = pnl
                self.closed_trades.append({
                    "order_id": order.order_id,
                    "entry_price": self.avg_cost,
                    "exit_price": price,
                    "quantity": quantity,
                    "pnl": pnl,
                    "timestamp": timestamp.isoformat(),
                })
                if self.position == 0:
                    self.avg_cost = 0.0
            else:
                order.is_filled = False

        self.orders.append(order)
        return order

    @property
    def equity(self) -> float:
        return self.capital + self.position * self.avg_cost

    @property
    def unrealized_pnl(self) -> float:
        # Need current price — return 0 if no position
        return 0.0

    def trade_summary(self) -> dict:
        """Get summary of all trades."""
        if not self.closed_trades:
            return {
                "total_trades": 0, "winning": 0, "losing": 0,
                "win_rate": 0.0, "total_pnl": 0.0, "avg_pnl": 0.0,
            }

        pnls = [t["pnl"] for t in self.closed_trades]
        winners = [p for p in pnls if p > 0]
        losers = [p for p in pnls if p < 0]

        return {
            "total_trades": len(pnls),
            "winning": len(winners),
            "losing": len(losers),
            "win_rate": len(winners) / len(pnls) * 100 if pnls else 0.0,
            "total_pnl": sum(pnls),
            "avg_pnl": float(np.mean(pnls)),
            "avg_winner": float(np.mean(winners)) if winners else 0.0,
            "avg_loser": float(np.mean(losers)) if losers else 0.0,
            "profit_factor": abs(sum(winners) / sum(losers)) if losers and sum(losers) != 0 else 0.0,
            "largest_win": max(winners) if winners else 0.0,
            "largest_loss": min(losers) if losers else 0.0,
        }

    def reset(self) -> None:
        self.capital = self.initial_capital
        self.position = 0.0
        self.avg_cost = 0.0
        self.orders.clear()
        self.closed_trades.clear()


# ─── Replay Session ──────────────────────────────────────────────────────────

class ReplaySession:
    """A complete market replay session."""

    def __init__(self, symbol: str, bars: list[ReplayBar], timeframe: TimeframeType = TimeframeType.MINUTE_1):
        self.symbol = symbol
        self.bars = bars
        self.timeframe = timeframe
        self.state = ReplayState.STOPPED
        self.speed = ReplaySpeed.NORMAL_1X
        self.current_index: int = 0
        self.stats = ReplayStatistics(total_bars=len(bars))
        self.bookmarks: list[ReplayBookmark] = []
        self.visible_bars: list[ReplayBar] = []
        self.volume_profiler = ReplayVolumeProfiler()
        self.trade_sim = ReplayTradeSimulator()
        self._events_overlay: list[dict] = []

        if bars:
            self.stats.session_open = bars[0].open

    @property
    def current_bar(self) -> ReplayBar | None:
        if 0 <= self.current_index < len(self.bars):
            return self.bars[self.current_index]
        return None

    @property
    def is_at_end(self) -> bool:
        return self.current_index >= len(self.bars) - 1

    def play(self) -> None:
        """Start or resume replay."""
        if self.state != ReplayState.FINISHED:
            self.state = ReplayState.PLAYING

    def pause(self) -> None:
        self.state = ReplayState.PAUSED

    def stop(self) -> None:
        self.state = ReplayState.STOPPED
        self.current_index = 0
        self.visible_bars.clear()
        self.stats = ReplayStatistics(total_bars=len(self.bars))
        if self.bars:
            self.stats.session_open = self.bars[0].open

    def step_forward(self, steps: int = 1) -> list[ReplayBar]:
        """Step forward by N bars. Returns newly revealed bars."""
        new_bars = []
        for _ in range(steps):
            if self.current_index >= len(self.bars):
                self.state = ReplayState.FINISHED
                break

            bar = self.bars[self.current_index]
            self.visible_bars.append(bar)
            new_bars.append(bar)

            # Update stats
            self.stats.bars_played = self.current_index + 1
            self.stats.total_volume += bar.volume
            self.stats.high_of_session = max(self.stats.high_of_session, bar.high)
            self.stats.low_of_session = min(self.stats.low_of_session, bar.low)
            self.stats.current_price = bar.close

            # Update volume profile
            self.volume_profiler.add_bar(bar)

            self.current_index += 1

        return new_bars

    def step_backward(self, steps: int = 1) -> None:
        """Step backward by removing last N visible bars."""
        for _ in range(steps):
            if self.current_index <= 0:
                break
            self.current_index -= 1
            if self.visible_bars:
                self.visible_bars.pop()

        # Recalculate stats
        self._recalculate_stats()

    def jump_to(self, index: int) -> None:
        """Jump to a specific bar index."""
        index = max(0, min(index, len(self.bars) - 1))
        self.current_index = 0
        self.visible_bars.clear()
        self.volume_profiler.reset()
        self.step_forward(index + 1)

    def jump_to_time(self, target_time: datetime) -> int:
        """Jump to the bar closest to target time."""
        best_idx = 0
        best_diff = float('inf')
        for i, bar in enumerate(self.bars):
            diff = abs((bar.timestamp - target_time).total_seconds())
            if diff < best_diff:
                best_diff = diff
                best_idx = i

        self.jump_to(best_idx)
        return best_idx

    def add_bookmark(self, name: str, notes: str = "") -> ReplayBookmark:
        """Bookmark current position."""
        bar = self.current_bar
        bm = ReplayBookmark(
            bookmark_id=f"BM_{len(self.bookmarks) + 1:04d}",
            name=name,
            bar_index=self.current_index,
            timestamp=bar.timestamp if bar else datetime.now(),
            price=bar.close if bar else 0.0,
            notes=notes,
        )
        self.bookmarks.append(bm)
        return bm

    def goto_bookmark(self, bookmark_id: str) -> bool:
        """Jump to a bookmarked position."""
        for bm in self.bookmarks:
            if bm.bookmark_id == bookmark_id:
                self.jump_to(bm.bar_index)
                return True
        return False

    def add_event_overlay(self, timestamp: datetime, event_type: str, name: str) -> None:
        """Add an event marker to the replay timeline."""
        self._events_overlay.append({
            "timestamp": timestamp.isoformat(),
            "type": event_type,
            "name": name,
        })

    def get_events_in_range(self, start_idx: int, end_idx: int) -> list[dict]:
        """Get events that fall within visible bar range."""
        if start_idx >= len(self.bars) or end_idx < 0:
            return []
        start_time = self.bars[max(0, start_idx)].timestamp
        end_time = self.bars[min(end_idx, len(self.bars) - 1)].timestamp

        return [e for e in self._events_overlay
                if start_time.isoformat() <= e["timestamp"] <= end_time.isoformat()]

    def set_speed(self, speed: ReplaySpeed) -> None:
        self.speed = speed

    def place_trade(self, side: OrderSide, quantity: float) -> ReplayOrder | None:
        """Place a trade at current replay price."""
        bar = self.current_bar
        if not bar:
            return None
        order = self.trade_sim.place_order(side, quantity, bar.close, bar.timestamp)
        if order.is_filled:
            self.stats.trades_taken += 1
            if order.pnl > 0:
                self.stats.winning_trades += 1
            self.stats.total_pnl += order.pnl
        return order

    def _recalculate_stats(self) -> None:
        """Recalculate stats from visible bars."""
        self.stats = ReplayStatistics(total_bars=len(self.bars))
        self.volume_profiler.reset()

        if self.bars:
            self.stats.session_open = self.bars[0].open

        for bar in self.visible_bars:
            self.stats.bars_played += 1
            self.stats.total_volume += bar.volume
            self.stats.high_of_session = max(self.stats.high_of_session, bar.high)
            self.stats.low_of_session = min(self.stats.low_of_session, bar.low)
            self.stats.current_price = bar.close
            self.volume_profiler.add_bar(bar)

    def session_info(self) -> dict:
        """Get full session info."""
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe.value,
            "state": self.state.value,
            "speed": self.speed.value,
            "current_index": self.current_index,
            "statistics": self.stats.to_dict(),
            "bookmarks": [bm.to_dict() for bm in self.bookmarks],
            "volume_profile": self.volume_profiler.profile(),
            "trade_summary": self.trade_sim.trade_summary(),
        }


# ─── Multi-Timeframe Sync ──────────────────────────────────────────────────

class MultiTimeframeReplay:
    """Synchronized replay across multiple timeframes."""

    def __init__(self, base_bars: list[ReplayBar], symbol: str = ""):
        self.symbol = symbol
        self.sessions: dict[str, ReplaySession] = {}

        # Create base session
        self.sessions["1m"] = ReplaySession(symbol, base_bars, TimeframeType.MINUTE_1)

        # Create higher timeframe sessions
        aggregator = BarAggregator()
        for tf, factor in [("5m", 5), ("15m", 15), ("1h", 60)]:
            resampled = aggregator.resample_bars(base_bars, factor)
            if resampled:
                tf_enum = {"5m": TimeframeType.MINUTE_5, "15m": TimeframeType.MINUTE_15,
                           "1h": TimeframeType.HOUR_1}[tf]
                self.sessions[tf] = ReplaySession(symbol, resampled, tf_enum)

    def step_forward(self, steps: int = 1) -> dict[str, list[ReplayBar]]:
        """Step forward on base timeframe and sync higher TFs."""
        result = {}

        # Step base
        base = self.sessions.get("1m")
        if base:
            new_base = base.step_forward(steps)
            result["1m"] = new_base

            # Sync higher timeframes
            base_idx = base.current_index
            for tf, factor in [("5m", 5), ("15m", 15), ("1h", 60)]:
                session = self.sessions.get(tf)
                if session:
                    target_idx = base_idx // factor
                    while session.current_index < target_idx and session.current_index < len(session.bars):
                        new_bars = session.step_forward(1)
                        result[tf] = result.get(tf, []) + new_bars

        return result

    def info(self) -> dict:
        return {
            "symbol": self.symbol,
            "timeframes": list(self.sessions.keys()),
            "sessions": {tf: s.session_info() for tf, s in self.sessions.items()},
        }


# ─── Orchestrator ────────────────────────────────────────────────────────────

class MarketReplayEngine:
    """Top-level orchestrator for market replay."""

    def __init__(self):
        self.sessions: dict[str, ReplaySession] = {}
        self.multi_tf_sessions: dict[str, MultiTimeframeReplay] = {}
        self.aggregator = BarAggregator()

    def create_session(self, session_id: str, symbol: str, bars: list[ReplayBar],
                       timeframe: TimeframeType = TimeframeType.MINUTE_1) -> dict:
        """Create a new replay session."""
        session = ReplaySession(symbol, bars, timeframe)
        self.sessions[session_id] = session
        return session.session_info()

    def create_session_from_ohlcv(self, session_id: str, symbol: str,
                                    data: list[dict]) -> dict:
        """Create session from raw OHLCV dicts."""
        bars = []
        for d in data:
            dt = d.get("timestamp", datetime.now())
            if isinstance(dt, str):
                try:
                    dt = datetime.fromisoformat(dt)
                except Exception:
                    dt = datetime.now()
            bars.append(ReplayBar(
                timestamp=dt,
                open=d.get("open", 0),
                high=d.get("high", 0),
                low=d.get("low", 0),
                close=d.get("close", 0),
                volume=d.get("volume", 0),
            ))
        return self.create_session(session_id, symbol, bars)

    def create_multi_tf_session(self, session_id: str, symbol: str, base_bars: list[ReplayBar]) -> dict:
        """Create synchronized multi-timeframe replay session."""
        mtf = MultiTimeframeReplay(base_bars, symbol)
        self.multi_tf_sessions[session_id] = mtf
        return mtf.info()

    def play(self, session_id: str) -> dict:
        s = self.sessions.get(session_id)
        if s:
            s.play()
            return {"status": "playing"}
        return {"error": "session not found"}

    def pause(self, session_id: str) -> dict:
        s = self.sessions.get(session_id)
        if s:
            s.pause()
            return {"status": "paused"}
        return {"error": "session not found"}

    def stop(self, session_id: str) -> dict:
        s = self.sessions.get(session_id)
        if s:
            s.stop()
            return {"status": "stopped"}
        return {"error": "session not found"}

    def step(self, session_id: str, steps: int = 1) -> list[dict]:
        s = self.sessions.get(session_id)
        if s:
            new_bars = s.step_forward(steps)
            return [b.to_dict() for b in new_bars]
        return []

    def step_back(self, session_id: str, steps: int = 1) -> dict:
        s = self.sessions.get(session_id)
        if s:
            s.step_backward(steps)
            return {"current_index": s.current_index}
        return {"error": "session not found"}

    def jump(self, session_id: str, index: int) -> dict:
        s = self.sessions.get(session_id)
        if s:
            s.jump_to(index)
            return s.session_info()
        return {"error": "session not found"}

    def set_speed(self, session_id: str, speed: ReplaySpeed) -> dict:
        s = self.sessions.get(session_id)
        if s:
            s.set_speed(speed)
            return {"speed": speed.value}
        return {"error": "session not found"}

    def bookmark(self, session_id: str, name: str, notes: str = "") -> dict:
        s = self.sessions.get(session_id)
        if s:
            bm = s.add_bookmark(name, notes)
            return bm.to_dict()
        return {"error": "session not found"}

    def goto_bookmark(self, session_id: str, bookmark_id: str) -> dict:
        s = self.sessions.get(session_id)
        if s:
            ok = s.goto_bookmark(bookmark_id)
            return {"success": ok}
        return {"error": "session not found"}

    def place_trade(self, session_id: str, side: str, quantity: float) -> dict:
        s = self.sessions.get(session_id)
        if s:
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            order = s.place_trade(order_side, quantity)
            return order.to_dict() if order else {"error": "no current bar"}
        return {"error": "session not found"}

    def session_info(self, session_id: str) -> dict:
        s = self.sessions.get(session_id)
        if s:
            return s.session_info()
        return {"error": "session not found"}

    def volume_profile(self, session_id: str) -> dict:
        s = self.sessions.get(session_id)
        if s:
            return s.volume_profiler.profile()
        return {"error": "session not found"}

    def trade_summary(self, session_id: str) -> dict:
        s = self.sessions.get(session_id)
        if s:
            return s.trade_sim.trade_summary()
        return {"error": "session not found"}

    def generate_book(self, price: float, depth: int = 10) -> dict:
        return OrderBookSimulator.generate_book_snapshot(price, depth)

    def ticks_to_bars(self, ticks: list[TickData], bar_seconds: int = 60) -> list[dict]:
        bars = self.aggregator.ticks_to_bars(ticks, bar_seconds)
        return [b.to_dict() for b in bars]

    def delete_session(self, session_id: str) -> dict:
        if session_id in self.sessions:
            del self.sessions[session_id]
            return {"deleted": session_id}
        return {"error": "session not found"}

    def list_sessions(self) -> list[str]:
        return list(self.sessions.keys())

    def capabilities(self) -> dict:
        return {
            "engine": "MarketReplayEngine",
            "replay_speeds": [s.value for s in ReplaySpeed],
            "timeframes": [t.value for t in TimeframeType],
            "features": [
                "bar_by_bar_replay",
                "variable_speed_playback",
                "play_pause_stop_controls",
                "step_forward_backward",
                "jump_to_index_or_time",
                "bookmarks_and_snapshots",
                "volume_profile_during_replay",
                "order_book_simulation",
                "trade_simulation_during_replay",
                "multi_timeframe_sync",
                "event_overlay",
                "replay_statistics",
                "bar_aggregation",
                "tick_to_bar_conversion",
            ],
        }
