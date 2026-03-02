"""
Market Microstructure — Spread analysis, queue position estimation,
flow toxicity (VPIN, order flow imbalance), and execution quality metrics.

Provides institutional-grade microstructure analytics for execution analysis,
market making, and toxic flow detection.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass
from typing import List, Optional, Tuple


# ─── Spread Analytics ────────────────────────────────────────────────────────


@dataclass
class SpreadMetrics:
    """Comprehensive spread metrics."""

    quoted_spread: float
    quoted_spread_bps: float
    effective_spread: float
    realized_spread: float
    price_impact: float
    roll_implied_spread: float

    def to_dict(self) -> dict:
        return {
            "quoted_spread": round(self.quoted_spread, 6),
            "quoted_spread_bps": round(self.quoted_spread_bps, 2),
            "effective_spread": round(self.effective_spread, 6),
            "realized_spread": round(self.realized_spread, 6),
            "price_impact": round(self.price_impact, 6),
            "roll_implied_spread": round(self.roll_implied_spread, 6),
        }


class SpreadAnalyzer:
    """Spread decomposition and analytics."""

    @staticmethod
    def quoted_spread(best_bid: float, best_ask: float) -> float:
        return best_ask - best_bid if best_bid > 0 and best_ask > 0 else 0.0

    @staticmethod
    def quoted_spread_bps(best_bid: float, best_ask: float) -> float:
        mid = (best_bid + best_ask) / 2
        spread = SpreadAnalyzer.quoted_spread(best_bid, best_ask)
        return (spread / mid) * 10000 if mid > 0 else 0.0

    @staticmethod
    def effective_spread(trade_price: float, mid: float, side: str) -> float:
        """Effective spread = 2 * |trade_price - mid| for direction-adjusted."""
        sign = 1 if side.lower() in ("buy", "bid", "aggressive_buy") else -1
        return 2 * sign * (trade_price - mid)

    @staticmethod
    def realized_spread(
        trade_price: float,
        mid_before: float,
        mid_after: float,
        side: str,
    ) -> float:
        """Realized spread = 2 * (trade_price - mid_after) * sign."""
        sign = 1 if side.lower() in ("buy", "bid") else -1
        return 2 * sign * (trade_price - mid_after)

    @staticmethod
    def price_impact(
        trade_price: float,
        mid_before: float,
        mid_after: float,
        side: str,
    ) -> float:
        """Price impact = mid_after - mid_before (for buys, opposite for sells)."""
        sign = 1 if side.lower() in ("buy", "bid") else -1
        return sign * (mid_after - mid_before)

    @staticmethod
    def roll_spread(returns: List[float]) -> float:
        """Roll (1984) model: implied spread from return autocovariance."""
        if len(returns) < 3:
            return 0.0
        n = len(returns)
        mean_r = sum(returns) / n
        cov = sum((returns[i] - mean_r) * (returns[i - 1] - mean_r) for i in range(1, n)) / (n - 1)
        return 2 * math.sqrt(-cov) if cov < 0 else 0.0

    @staticmethod
    def spread_decomposition(
        trades: List[Tuple[float, float, str]],
        mid_series: List[Tuple[int, float]],
    ) -> SpreadMetrics:
        """
        Decompose spread from trade data.
        trades: [(price, size, side), ...]
        mid_series: [(timestamp_idx, mid_price), ...]
        """
        if not trades or not mid_series:
            return SpreadMetrics(0, 0, 0, 0, 0, 0)

        # Use first/last trade mid as proxy for quoted
        first_mid = mid_series[0][1] if mid_series else 0
        last_mid = mid_series[-1][1] if mid_series else 0

        effective_spreads = []
        for i, (price, size, side) in enumerate(trades):
            mid = mid_series[min(i, len(mid_series) - 1)][1]
            eff = SpreadAnalyzer.effective_spread(price, mid, side)
            effective_spreads.append(eff)

        avg_effective = sum(effective_spreads) / len(effective_spreads) if effective_spreads else 0
        returns = []
        for i in range(1, len(mid_series)):
            r = (mid_series[i][1] - mid_series[i - 1][1]) / mid_series[i - 1][1] if mid_series[i - 1][1] > 0 else 0
            returns.append(r)
        roll = SpreadAnalyzer.roll_spread(returns)

        return SpreadMetrics(
            quoted_spread=abs(last_mid - first_mid),
            quoted_spread_bps=(abs(last_mid - first_mid) / ((first_mid + last_mid) / 2) * 10000) if (first_mid + last_mid) > 0 else 0,
            effective_spread=avg_effective,
            realized_spread=0,
            price_impact=0,
            roll_implied_spread=roll,
        )


# ─── Queue Position ──────────────────────────────────────────────────────────


@dataclass
class QueuePosition:
    """Estimated queue position at a price level."""

    price: float
    side: str
    position: int
    total_orders: int
    cumulative_size_ahead: float
    estimated_wait_pct: float

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "side": self.side,
            "position": self.position,
            "total_orders": self.total_orders,
            "cumulative_size_ahead": round(self.cumulative_size_ahead, 4),
            "estimated_wait_pct": round(self.estimated_wait_pct, 4),
        }


class QueuePositionEstimator:
    """Estimate queue position in order book."""

    @staticmethod
    def queue_position(
        price: float,
        side: str,
        order_book_bids: List[Tuple[float, float]],
        order_book_asks: List[Tuple[float, float]],
    ) -> Optional[QueuePosition]:
        """
        Estimate queue position. Assumes order book is [(price, size), ...]
        sorted best first.
        """
        book = order_book_bids if side.lower() == "bid" else order_book_asks
        if not book:
            return None

        cum = 0.0
        position = 0
        total_orders = 0
        found = False

        for i, (p, size) in enumerate(book):
            if abs(p - price) < 1e-9:
                position = i + 1
                found = True
                break
            cum += size
            total_orders += 1

        if not found:
            return None

        total_size = sum(s for _, s in book)
        wait_pct = (cum / total_size * 100) if total_size > 0 else 0

        return QueuePosition(
            price=price,
            side=side,
            position=position,
            total_orders=len(book),
            cumulative_size_ahead=cum,
            estimated_wait_pct=wait_pct,
        )

    @staticmethod
    def time_weighted_position(
        orders_ahead: List[Tuple[float, float]],
        arrival_rate: float = 1.0,
    ) -> float:
        """
        Estimate fill probability based on size ahead.
        Simplified: uses cumulative size / rate.
        """
        if not orders_ahead or arrival_rate <= 0:
            return 0.0
        total_ahead = sum(s for _, s in orders_ahead)
        return total_ahead / arrival_rate


# ─── Flow Toxicity (VPIN) ─────────────────────────────────────────────────────


@dataclass
class VPINBucket:
    """Single VPIN volume bucket."""

    buy_volume: float
    sell_volume: float
    total_volume: float
    vpin: float
    timestamp: float

    def to_dict(self) -> dict:
        return {
            "buy_volume": round(self.buy_volume, 4),
            "sell_volume": round(self.sell_volume, 4),
            "total_volume": round(self.total_volume, 4),
            "vpin": round(self.vpin, 6),
            "timestamp": self.timestamp,
        }


class VPINCalculator:
    """
    Volume-Synchronized Probability of Informed Trading (VPIN).
    Measures order flow toxicity.
    """

    def __init__(self, n_buckets: int = 50):
        self.n_buckets = n_buckets
        self._buy_vol: float = 0.0
        self._sell_vol: float = 0.0
        self._bucket_size: Optional[float] = None
        self._buckets: deque[VPINBucket] = deque(maxlen=n_buckets)

    def add_trade(self, price: float, size: float, side: str, timestamp: float = 0) -> None:
        """Add trade and update bucket."""
        if side.lower() in ("buy", "bid"):
            self._buy_vol += size
        else:
            self._sell_vol += size

    def set_bucket_volume(self, target_volume: float) -> None:
        """Set target volume per bucket for VPIN."""
        self._bucket_size = target_volume

    def flush_bucket(self, timestamp: float = 0) -> Optional[VPINBucket]:
        """Flush current bucket when target volume reached."""
        total = self._buy_vol + self._sell_vol
        if self._bucket_size is None or total < self._bucket_size:
            return None
        vpin = abs(self._buy_vol - self._sell_vol) / total if total > 0 else 0
        bucket = VPINBucket(
            buy_volume=self._buy_vol,
            sell_volume=self._sell_vol,
            total_volume=total,
            vpin=vpin,
            timestamp=timestamp,
        )
        self._buckets.append(bucket)
        self._buy_vol = 0.0
        self._sell_vol = 0.0
        return bucket

    def current_vpin(self) -> float:
        """Current VPIN from recent buckets."""
        if not self._buckets:
            return 0.0
        return sum(b.vpin for b in self._buckets) / len(self._buckets)

    def toxicity_signal(self, threshold: float = 0.5) -> bool:
        """True if flow is toxic (VPIN above threshold)."""
        return self.current_vpin() >= threshold


# ─── Order Flow Imbalance ────────────────────────────────────────────────────


class OrderFlowImbalance:
    """Order flow imbalance over rolling window."""

    def __init__(self, window_ticks: int = 100):
        self.window = window_ticks
        self._buy_vols: deque[float] = deque(maxlen=window_ticks)
        self._sell_vols: deque[float] = deque(maxlen=window_ticks)

    def add(self, buy_volume: float, sell_volume: float) -> None:
        self._buy_vols.append(buy_volume)
        self._sell_vols.append(sell_volume)

    def imbalance(self) -> float:
        """Imbalance in [-1, 1]."""
        total_buy = sum(self._buy_vols)
        total_sell = sum(self._sell_vols)
        total = total_buy + total_sell
        return (total_buy - total_sell) / total if total > 0 else 0.0

    def net_flow(self) -> float:
        return sum(self._buy_vols) - sum(self._sell_vols)


# ─── Kyle's Lambda ────────────────────────────────────────────────────────────


def kyle_lambda(
    order_flow: List[float],
    price_changes: List[float],
) -> float:
    """
    Kyle's lambda: price impact per unit order flow.
    lambda = Cov(ΔP, Q) / Var(Q)
    """
    if len(order_flow) < 2 or len(price_changes) < 2:
        return 0.0
    n = min(len(order_flow), len(price_changes))
    of = order_flow[:n]
    pc = price_changes[:n]
    mean_of = sum(of) / n
    mean_pc = sum(pc) / n
    cov = sum((of[i] - mean_of) * (pc[i] - mean_pc) for i in range(n)) / (n - 1)
    var_of = sum((of[i] - mean_of) ** 2 for i in range(n)) / (n - 1)
    return cov / var_of if var_of > 0 else 0.0


# ─── Execution Quality Metrics ────────────────────────────────────────────────


@dataclass
class ExecutionQuality:
    """Execution quality metrics."""

    vwap_slippage_bps: float
    arrival_price_slippage_bps: float
    implementation_shortfall_bps: float
    participation_rate: float

    def to_dict(self) -> dict:
        return {
            "vwap_slippage_bps": round(self.vwap_slippage_bps, 2),
            "arrival_price_slippage_bps": round(self.arrival_price_slippage_bps, 2),
            "implementation_shortfall_bps": round(self.implementation_shortfall_bps, 2),
            "participation_rate": round(self.participation_rate, 4),
        }


def execution_quality(
    arrival_price: float,
    vwap: float,
    avg_execution_price: float,
    total_volume: float,
    executed_volume: float,
    decision_price: float = 0,
) -> ExecutionQuality:
    """
    Compute execution quality metrics.
    """
    mid = arrival_price
    vwap_slip = (vwap - mid) / mid * 10000 if mid > 0 else 0
    arrival_slip = (avg_execution_price - arrival_price) / arrival_price * 10000 if arrival_price > 0 else 0
    impl_shortfall = 0.0
    if decision_price > 0:
        impl_shortfall = (avg_execution_price - decision_price) / decision_price * 10000
    participation = executed_volume / total_volume if total_volume > 0 else 0

    return ExecutionQuality(
        vwap_slippage_bps=vwap_slip,
        arrival_price_slippage_bps=arrival_slip,
        implementation_shortfall_bps=impl_shortfall,
        participation_rate=participation,
    )


# ─── Adverse Selection ───────────────────────────────────────────────────────


def adverse_selection_cost(
    effective_spreads: List[float],
    realized_spreads: List[float],
) -> float:
    """
    Adverse selection = E[effective spread] - E[realized spread].
    """
    if not effective_spreads or not realized_spreads:
        return 0.0
    n = min(len(effective_spreads), len(realized_spreads))
    avg_eff = sum(effective_spreads[:n]) / n
    avg_real = sum(realized_spreads[:n]) / n
    return avg_eff - avg_real


# ─── Aggregated Microstructure Report ──────────────────────────────────────


@dataclass
class MicrostructureReport:
    """Aggregated microstructure analytics."""

    spread_metrics: SpreadMetrics
    vpin: float
    flow_imbalance: float
    kyle_lambda: float
    adverse_selection: float

    def to_dict(self) -> dict:
        return {
            "spread_metrics": self.spread_metrics.to_dict(),
            "vpin": round(self.vpin, 6),
            "flow_imbalance": round(self.flow_imbalance, 6),
            "kyle_lambda": round(self.kyle_lambda, 6),
            "adverse_selection": round(self.adverse_selection, 6),
        }
