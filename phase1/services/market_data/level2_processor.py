"""
Level 2 Market Data Processor — Order book L2, time & sales, volume at price,
imbalance calculations, and real-time L2 analytics.

Processes raw L2 feeds, maintains consolidated order book, computes volume profiles,
time & sales aggregates, and order flow imbalance metrics.
"""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class Side(str, Enum):
    BID = "bid"
    ASK = "ask"


class UpdateType(str, Enum):
    ADD = "add"
    MODIFY = "modify"
    DELETE = "delete"


# ─── Order Book Level 2 Structures ────────────────────────────────────────────


@dataclass
class L2Level:
    """Single price level in the order book."""

    price: float
    size: float
    order_count: int = 1
    timestamp_ns: int = 0

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "size": round(self.size, 4),
            "order_count": self.order_count,
            "timestamp_ns": self.timestamp_ns,
        }


@dataclass
class L2Snapshot:
    """Full Level 2 order book snapshot."""

    symbol: str
    bids: List[L2Level]
    asks: List[L2Level]
    timestamp_ns: int = 0
    sequence: int = 0

    @property
    def best_bid(self) -> float:
        return self.bids[0].price if self.bids else 0.0

    @property
    def best_ask(self) -> float:
        return self.asks[0].price if self.asks else 0.0

    @property
    def mid_price(self) -> float:
        if self.bids and self.asks:
            return (self.best_bid + self.best_ask) / 2
        return 0.0

    @property
    def spread(self) -> float:
        return self.best_ask - self.best_bid if self.bids and self.asks else 0.0

    @property
    def spread_bps(self) -> float:
        mid = self.mid_price
        return (self.spread / mid) * 10000 if mid > 0 else 0.0

    def bid_volume(self, levels: int = 10) -> float:
        return sum(b.size for b in self.bids[:levels])

    def ask_volume(self, levels: int = 10) -> float:
        return sum(a.size for a in self.asks[:levels])

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "best_bid": round(self.best_bid, 6),
            "best_ask": round(self.best_ask, 6),
            "mid_price": round(self.mid_price, 6),
            "spread": round(self.spread, 6),
            "spread_bps": round(self.spread_bps, 2),
            "bid_levels": len(self.bids),
            "ask_levels": len(self.asks),
            "timestamp_ns": self.timestamp_ns,
            "sequence": self.sequence,
        }


@dataclass
class L2Update:
    """Incremental L2 update (add/modify/delete)."""

    symbol: str
    side: Side
    price: float
    size: float
    update_type: UpdateType
    order_id: str = ""
    timestamp_ns: int = 0
    sequence: int = 0


# ─── Time & Sales ──────────────────────────────────────────────────────────────


@dataclass
class TimeAndSalesTick:
    """Single time & sales (tape) tick."""

    symbol: str
    price: float
    size: float
    timestamp_ns: int
    side: str = "unknown"
    trade_id: str = ""
    is_block: bool = False

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "price": round(self.price, 6),
            "size": round(self.size, 4),
            "timestamp_ns": self.timestamp_ns,
            "side": self.side,
            "trade_id": self.trade_id,
            "is_block": self.is_block,
        }


# ─── Volume at Price (VAP) ────────────────────────────────────────────────────


@dataclass
class VolumeAtPrice:
    """Volume traded at a specific price level."""

    price: float
    volume: float
    buy_volume: float = 0.0
    sell_volume: float = 0.0
    trade_count: int = 0

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "volume": round(self.volume, 4),
            "buy_volume": round(self.buy_volume, 4),
            "sell_volume": round(self.sell_volume, 4),
            "trade_count": self.trade_count,
        }


# ─── Order Book Processor ──────────────────────────────────────────────────────


class Level2Processor:
    """
    Maintains a consolidated L2 order book from snapshots and incremental updates.
    Supports add/modify/delete operations with price-time priority.
    """

    def __init__(self, symbol: str):
        self.symbol = symbol
        self._bids: Dict[float, L2Level] = {}
        self._asks: Dict[float, L2Level] = {}
        self._sequence = 0
        self._last_timestamp_ns = 0

    def apply_snapshot(self, snapshot: L2Snapshot) -> None:
        """Replace book with full snapshot."""
        self._bids.clear()
        self._asks.clear()
        for level in snapshot.bids:
            self._bids[level.price] = L2Level(
                price=level.price,
                size=level.size,
                order_count=level.order_count,
                timestamp_ns=level.timestamp_ns or snapshot.timestamp_ns,
            )
        for level in snapshot.asks:
            self._asks[level.price] = L2Level(
                price=level.price,
                size=level.size,
                order_count=level.order_count,
                timestamp_ns=level.timestamp_ns or snapshot.timestamp_ns,
            )
        self._sequence = snapshot.sequence
        self._last_timestamp_ns = snapshot.timestamp_ns

    def apply_update(self, update: L2Update) -> bool:
        """Apply incremental update. Returns True if applied successfully."""
        book = self._bids if update.side == Side.BID else self._asks

        if update.update_type == UpdateType.ADD:
            book[update.price] = L2Level(
                price=update.price,
                size=update.size,
                order_count=1,
                timestamp_ns=update.timestamp_ns,
            )
        elif update.update_type == UpdateType.MODIFY:
            if update.price in book:
                book[update.price] = L2Level(
                    price=update.price,
                    size=update.size,
                    order_count=book[update.price].order_count,
                    timestamp_ns=update.timestamp_ns,
                )
        elif update.update_type == UpdateType.DELETE:
            book.pop(update.price, None)

        self._sequence = update.sequence
        self._last_timestamp_ns = update.timestamp_ns
        return True

    def get_snapshot(self, depth: int = 20) -> L2Snapshot:
        """Get current book as snapshot, sorted by price."""
        bid_levels = sorted(
            self._bids.values(),
            key=lambda x: -x.price,
        )[:depth]
        ask_levels = sorted(
            self._asks.values(),
            key=lambda x: x.price,
        )[:depth]
        return L2Snapshot(
            symbol=self.symbol,
            bids=[L2Level(price=l.price, size=l.size, order_count=l.order_count, timestamp_ns=l.timestamp_ns) for l in bid_levels],
            asks=[L2Level(price=l.price, size=l.size, order_count=l.order_count, timestamp_ns=l.timestamp_ns) for l in ask_levels],
            timestamp_ns=self._last_timestamp_ns,
            sequence=self._sequence,
        )


# ─── Time & Sales Processor ────────────────────────────────────────────────────


class TimeAndSalesProcessor:
    """Processes time & sales ticks, maintains aggregates and VAP."""

    def __init__(self, symbol: str):
        self.symbol = symbol
        self._ticks: deque[TimeAndSalesTick] = deque(maxlen=100000)
        self._vap: Dict[float, VolumeAtPrice] = defaultdict(
            lambda: VolumeAtPrice(price=0, volume=0, buy_volume=0, sell_volume=0, trade_count=0)
        )

    def add_tick(self, tick: TimeAndSalesTick) -> None:
        """Add a tape tick and update VAP."""
        self._ticks.append(tick)

        price = tick.price
        if price not in self._vap or self._vap[price].price == 0:
            self._vap[price].price = price
        self._vap[price].volume += tick.size
        self._vap[price].trade_count += 1
        if tick.side.lower() == "buy" or tick.side.lower() == "bid":
            self._vap[price].buy_volume += tick.size
        elif tick.side.lower() == "sell" or tick.side.lower() == "ask":
            self._vap[price].sell_volume += tick.size

    def get_volume_at_price(self, price_tick: float = 0.01) -> List[VolumeAtPrice]:
        """Get VAP histogram, optionally bucketed by price tick."""
        if price_tick <= 0:
            return [v for v in self._vap.values() if v.volume > 0]
        buckets: Dict[float, VolumeAtPrice] = {}
        for price, vap in self._vap.items():
            if vap.volume <= 0:
                continue
            bucket = round(price / price_tick) * price_tick
            if bucket not in buckets:
                buckets[bucket] = VolumeAtPrice(price=bucket, volume=0, buy_volume=0, sell_volume=0, trade_count=0)
            b = buckets[bucket]
            b.volume += vap.volume
            b.buy_volume += vap.buy_volume
            b.sell_volume += vap.sell_volume
            b.trade_count += vap.trade_count
        return sorted(buckets.values(), key=lambda x: x.price)

    def get_trades_in_window(self, start_ns: int, end_ns: int) -> List[TimeAndSalesTick]:
        """Get all ticks in a time window."""
        return [t for t in self._ticks if start_ns <= t.timestamp_ns <= end_ns]

    def total_volume(self) -> float:
        return sum(v.volume for v in self._vap.values())

    def vwap(self) -> float:
        """Volume-weighted average price of all trades."""
        total = 0.0
        pv = 0.0
        for v in self._vap.values():
            pv += v.price * v.volume
            total += v.volume
        return pv / total if total > 0 else 0.0


# ─── Imbalance Calculations ──────────────────────────────────────────────────


class ImbalanceCalculator:
    """Order flow and book imbalance metrics."""

    @staticmethod
    def order_book_imbalance(
        bid_volume: float,
        ask_volume: float,
    ) -> float:
        """Imbalance in [-1, 1]. Positive = bid heavy."""
        total = bid_volume + ask_volume
        return (bid_volume - ask_volume) / total if total > 0 else 0.0

    @staticmethod
    def weighted_imbalance(
        bids: List[Tuple[float, float]],
        asks: List[Tuple[float, float]],
        levels: int = 5,
    ) -> float:
        """Imbalance weighted by inverse depth (closer levels matter more)."""
        bid_sum = 0.0
        ask_sum = 0.0
        for i in range(min(levels, len(bids))):
            price, qty = bids[i]
            weight = 1.0 / (i + 1)
            bid_sum += weight * qty
        for i in range(min(levels, len(asks))):
            price, qty = asks[i]
            weight = 1.0 / (i + 1)
            ask_sum += weight * qty
        total = bid_sum + ask_sum
        return (bid_sum - ask_sum) / total if total > 0 else 0.0

    @staticmethod
    def trade_imbalance(
        buy_volume: float,
        sell_volume: float,
    ) -> float:
        """Trade flow imbalance in [-1, 1]."""
        total = buy_volume + sell_volume
        return (buy_volume - sell_volume) / total if total > 0 else 0.0

    @staticmethod
    def microprice_imbalance(
        best_bid: float,
        best_ask: float,
        bid_size: float,
        ask_size: float,
    ) -> float:
        """Microprice-derived imbalance."""
        total = bid_size + ask_size
        if total <= 0:
            return 0.0
        microprice = (best_bid * ask_size + best_ask * bid_size) / total
        mid = (best_bid + best_ask) / 2
        spread = best_ask - best_bid
        if spread <= 0:
            return 0.0
        return 2 * (microprice - mid) / spread


# ─── Aggregated L2 Analytics ──────────────────────────────────────────────────


class L2Analytics:
    """Aggregated L2 analytics over a book snapshot."""

    @staticmethod
    def cumulative_depth(
        snapshot: L2Snapshot,
        levels: int = 20,
    ) -> Dict[str, List[Dict[str, float]]]:
        bid_cum = []
        ask_cum = []
        cum_bid = 0.0
        cum_ask = 0.0
        for i in range(min(levels, len(snapshot.bids))):
            l = snapshot.bids[i]
            cum_bid += l.size
            bid_cum.append({"price": l.price, "cumulative_qty": cum_bid})
        for i in range(min(levels, len(snapshot.asks))):
            l = snapshot.asks[i]
            cum_ask += l.size
            ask_cum.append({"price": l.price, "cumulative_qty": cum_ask})
        return {"bid_depth": bid_cum, "ask_depth": ask_cum}

    @staticmethod
    def weighted_mid(snapshot: L2Snapshot, levels: int = 5) -> float:
        bid_pv = sum(snapshot.bids[i].price * snapshot.bids[i].size for i in range(min(levels, len(snapshot.bids))))
        ask_pv = sum(snapshot.asks[i].price * snapshot.asks[i].size for i in range(min(levels, len(snapshot.asks))))
        bid_vol = sum(snapshot.bids[i].size for i in range(min(levels, len(snapshot.bids))))
        ask_vol = sum(snapshot.asks[i].size for i in range(min(levels, len(snapshot.asks))))
        total = bid_vol + ask_vol
        return (bid_pv + ask_pv) / total if total > 0 else snapshot.mid_price

    @staticmethod
    def microprice(snapshot: L2Snapshot) -> float:
        if not snapshot.bids or not snapshot.asks:
            return snapshot.mid_price
        bid_q = snapshot.bids[0].size
        ask_q = snapshot.asks[0].size
        total = bid_q + ask_q
        if total <= 0:
            return snapshot.mid_price
        return (
            snapshot.bids[0].price * ask_q + snapshot.asks[0].price * bid_q
        ) / total

    @staticmethod
    def imbalance(snapshot: L2Snapshot, levels: int = 5) -> float:
        bid_vol = snapshot.bid_volume(levels)
        ask_vol = snapshot.ask_volume(levels)
        return ImbalanceCalculator.order_book_imbalance(bid_vol, ask_vol)

    @staticmethod
    def effective_spread(
        trade_price: float,
        mid: float,
        side: str,
    ) -> float:
        sign = 1 if side.lower() in ("buy", "bid") else -1
        return 2 * sign * (trade_price - mid)


# ─── Rollover / Resample Helpers ──────────────────────────────────────────────


def resample_ticks_to_bars(
    ticks: List[TimeAndSalesTick],
    bucket_size_ns: int,
) -> List[Dict[str, Any]]:
    """Resample T&S ticks into OHLCV bars by time bucket."""
    if not ticks:
        return []
    buckets: Dict[int, List[TimeAndSalesTick]] = defaultdict(list)
    for t in ticks:
        bucket = (t.timestamp_ns // bucket_size_ns) * bucket_size_ns
        buckets[bucket].append(t)

    bars = []
    for bucket_ns in sorted(buckets.keys()):
        bticks = buckets[bucket_ns]
        prices = [tt.price for tt in bticks]
        volumes = [tt.size for tt in bticks]
        bars.append({
            "timestamp_ns": bucket_ns,
            "open": prices[0],
            "high": max(prices),
            "low": min(prices),
            "close": prices[-1],
            "volume": sum(volumes),
            "trade_count": len(bticks),
            "vwap": sum(p * v for p, v in zip(prices, volumes)) / sum(volumes) if volumes else 0,
        })
    return bars


def aggregate_vap_by_time(
    vap_list: List[VolumeAtPrice],
    bucket_size_ns: int,
    timestamp_getter=None,
) -> Dict[int, List[VolumeAtPrice]]:
    """Aggregate VAP data by time buckets (placeholder for timestamp in VAP)."""
    result: Dict[int, List[VolumeAtPrice]] = defaultdict(list)
    for vap in vap_list:
        ts = timestamp_getter(vap) if timestamp_getter else 0
        bucket = (ts // bucket_size_ns) * bucket_size_ns
        result[bucket].append(vap)
    return dict(result)
