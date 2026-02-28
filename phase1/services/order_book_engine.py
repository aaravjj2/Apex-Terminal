"""
Order Book Engine — Level 2 market data processing, depth of market, order book
imbalance, volume-weighted analysis, microsecond-level analytics, bid-ask spread
analysis, liquidity metrics, market impact estimation, VWAP/TWAP calculations,
order flow toxicity (VPIN), Kyle's lambda.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import random
import statistics
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class OrderSide(str, Enum):
    BID = "bid"
    ASK = "ask"


class OrderType(str, Enum):
    LIMIT = "limit"
    MARKET = "market"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    ICEBERG = "iceberg"


class TradeDirection(str, Enum):
    BUY = "buy"
    SELL = "sell"
    UNKNOWN = "unknown"


@dataclass
class OrderBookLevel:
    price: float
    quantity: float
    order_count: int = 1
    timestamp: float = 0.0

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "quantity": round(self.quantity, 4),
            "order_count": self.order_count,
        }


@dataclass
class OrderBookSnapshot:
    symbol: str
    bids: list[OrderBookLevel]
    asks: list[OrderBookLevel]
    timestamp: float = 0.0

    @property
    def best_bid(self) -> float:
        return self.bids[0].price if self.bids else 0.0

    @property
    def best_ask(self) -> float:
        return self.asks[0].price if self.asks else 0.0

    @property
    def mid_price(self) -> float:
        return (self.best_bid + self.best_ask) / 2 if self.bids and self.asks else 0.0

    @property
    def spread(self) -> float:
        return self.best_ask - self.best_bid if self.bids and self.asks else 0.0

    @property
    def spread_bps(self) -> float:
        mid = self.mid_price
        return (self.spread / mid) * 10000 if mid > 0 else 0.0

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "best_bid": round(self.best_bid, 6),
            "best_ask": round(self.best_ask, 6),
            "mid_price": round(self.mid_price, 6),
            "spread": round(self.spread, 6),
            "spread_bps": round(self.spread_bps, 2),
            "bid_depth": len(self.bids),
            "ask_depth": len(self.asks),
            "bid_volume": round(sum(b.quantity for b in self.bids), 4),
            "ask_volume": round(sum(a.quantity for a in self.asks), 4),
            "bids": [b.to_dict() for b in self.bids[:10]],
            "asks": [a.to_dict() for a in self.asks[:10]],
        }


@dataclass
class Trade:
    price: float
    quantity: float
    direction: str = "unknown"
    timestamp: float = 0.0
    is_aggressive: bool = False

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 6),
            "quantity": round(self.quantity, 4),
            "direction": self.direction,
            "is_aggressive": self.is_aggressive,
        }


@dataclass
class MarketImpactResult:
    estimated_price_impact: float
    estimated_cost: float
    participation_rate: float
    execution_time_estimate: float
    slippage_bps: float

    def to_dict(self) -> dict:
        return {
            "estimated_price_impact": round(self.estimated_price_impact, 6),
            "estimated_cost": round(self.estimated_cost, 2),
            "participation_rate": round(self.participation_rate, 4),
            "execution_time_estimate": round(self.execution_time_estimate, 2),
            "slippage_bps": round(self.slippage_bps, 2),
        }


# ── Depth of Market Analytics ────────────────────────────────────────

class DepthAnalytics:
    @staticmethod
    def cumulative_depth(book: OrderBookSnapshot, levels: int = 20) -> dict:
        bid_cum = []
        ask_cum = []
        cum_bid = 0.0
        cum_ask = 0.0

        for i in range(min(levels, len(book.bids))):
            cum_bid += book.bids[i].quantity
            bid_cum.append({"price": round(book.bids[i].price, 6), "cumulative_qty": round(cum_bid, 4)})

        for i in range(min(levels, len(book.asks))):
            cum_ask += book.asks[i].quantity
            ask_cum.append({"price": round(book.asks[i].price, 6), "cumulative_qty": round(cum_ask, 4)})

        return {"bid_depth": bid_cum, "ask_depth": ask_cum}

    @staticmethod
    def weighted_mid_price(book: OrderBookSnapshot, levels: int = 5) -> float:
        bid_sum = sum(book.bids[i].price * book.bids[i].quantity for i in range(min(levels, len(book.bids))))
        ask_sum = sum(book.asks[i].price * book.asks[i].quantity for i in range(min(levels, len(book.asks))))
        bid_vol = sum(book.bids[i].quantity for i in range(min(levels, len(book.bids))))
        ask_vol = sum(book.asks[i].quantity for i in range(min(levels, len(book.asks))))
        total_vol = bid_vol + ask_vol
        return (bid_sum + ask_sum) / total_vol if total_vol > 0 else book.mid_price

    @staticmethod
    def microprice(book: OrderBookSnapshot) -> float:
        if not book.bids or not book.asks:
            return book.mid_price
        bid_qty = book.bids[0].quantity
        ask_qty = book.asks[0].quantity
        total = bid_qty + ask_qty
        if total <= 0:
            return book.mid_price
        return (book.bids[0].price * ask_qty + book.asks[0].price * bid_qty) / total

    @staticmethod
    def order_book_imbalance(book: OrderBookSnapshot, levels: int = 5) -> float:
        bid_vol = sum(book.bids[i].quantity for i in range(min(levels, len(book.bids))))
        ask_vol = sum(book.asks[i].quantity for i in range(min(levels, len(book.asks))))
        total = bid_vol + ask_vol
        return (bid_vol - ask_vol) / total if total > 0 else 0.0

    @staticmethod
    def depth_ratio(book: OrderBookSnapshot, levels: int = 10) -> dict:
        bid_vol = sum(book.bids[i].quantity for i in range(min(levels, len(book.bids))))
        ask_vol = sum(book.asks[i].quantity for i in range(min(levels, len(book.asks))))
        return {
            "bid_volume": round(bid_vol, 4),
            "ask_volume": round(ask_vol, 4),
            "ratio": round(bid_vol / ask_vol if ask_vol > 0 else float("inf"), 4),
            "imbalance": round((bid_vol - ask_vol) / (bid_vol + ask_vol) if (bid_vol + ask_vol) > 0 else 0, 4),
        }

    @staticmethod
    def price_levels_analysis(book: OrderBookSnapshot) -> dict:
        bid_prices = [b.price for b in book.bids]
        ask_prices = [a.price for a in book.asks]

        bid_spacing = [bid_prices[i] - bid_prices[i + 1] for i in range(len(bid_prices) - 1)] if len(bid_prices) > 1 else [0]
        ask_spacing = [ask_prices[i + 1] - ask_prices[i] for i in range(len(ask_prices) - 1)] if len(ask_prices) > 1 else [0]

        return {
            "bid_levels": len(bid_prices),
            "ask_levels": len(ask_prices),
            "avg_bid_spacing": round(statistics.mean(bid_spacing), 6) if bid_spacing else 0,
            "avg_ask_spacing": round(statistics.mean(ask_spacing), 6) if ask_spacing else 0,
            "bid_range": round(bid_prices[0] - bid_prices[-1], 6) if bid_prices else 0,
            "ask_range": round(ask_prices[-1] - ask_prices[0], 6) if ask_prices else 0,
        }


# ── Spread Analytics ──────────────────────────────────────────────────

class SpreadAnalytics:
    @staticmethod
    def effective_spread(
        trade_price: float,
        mid_price: float,
        direction: str = "buy",
    ) -> float:
        sign = 1 if direction == "buy" else -1
        return 2 * sign * (trade_price - mid_price)

    @staticmethod
    def realized_spread(
        trade_price: float,
        mid_price_after: float,
        direction: str = "buy",
        delay_seconds: float = 5.0,
    ) -> float:
        sign = 1 if direction == "buy" else -1
        return 2 * sign * (trade_price - mid_price_after)

    @staticmethod
    def quoted_spread_stats(spreads: list[float]) -> dict:
        if not spreads:
            return {"mean": 0, "median": 0, "std": 0, "min": 0, "max": 0}
        return {
            "mean": round(statistics.mean(spreads), 6),
            "median": round(statistics.median(spreads), 6),
            "std": round(statistics.stdev(spreads), 6) if len(spreads) > 1 else 0,
            "min": round(min(spreads), 6),
            "max": round(max(spreads), 6),
        }

    @staticmethod
    def roll_spread(returns: list[float]) -> float:
        """Roll (1984) implied spread from serial covariance of returns."""
        if len(returns) < 3:
            return 0.0
        cov = sum(returns[i] * returns[i - 1] for i in range(1, len(returns))) / (len(returns) - 1)
        return 2 * math.sqrt(-cov) if cov < 0 else 0.0


# ── VWAP / TWAP ──────────────────────────────────────────────────────

class VWAPCalculator:
    @staticmethod
    def vwap(trades: list[Trade]) -> float:
        total_volume = sum(t.quantity for t in trades)
        if total_volume <= 0:
            return 0.0
        return sum(t.price * t.quantity for t in trades) / total_volume

    @staticmethod
    def twap(trades: list[Trade]) -> float:
        if not trades:
            return 0.0
        return statistics.mean([t.price for t in trades])

    @staticmethod
    def vwap_bands(
        trades: list[Trade],
        n_bands: int = 3,
        band_width: float = 1.0,
    ) -> dict:
        vwap = VWAPCalculator.vwap(trades)
        prices = [t.price for t in trades]
        std = statistics.stdev(prices) if len(prices) > 1 else 0

        bands = {"vwap": round(vwap, 6)}
        for i in range(1, n_bands + 1):
            bands[f"upper_{i}"] = round(vwap + i * band_width * std, 6)
            bands[f"lower_{i}"] = round(vwap - i * band_width * std, 6)
        return bands

    @staticmethod
    def intraday_vwap_profile(
        trades: list[Trade],
        n_buckets: int = 78,  # 5-min in 6.5hr day
    ) -> list[dict]:
        if not trades:
            return []

        min_ts = min(t.timestamp for t in trades)
        max_ts = max(t.timestamp for t in trades)
        bucket_size = (max_ts - min_ts) / n_buckets if n_buckets > 0 else 1

        buckets = [{"volume": 0.0, "vwap": 0.0, "pv": 0.0} for _ in range(n_buckets)]
        for t in trades:
            idx = min(int((t.timestamp - min_ts) / bucket_size), n_buckets - 1) if bucket_size > 0 else 0
            buckets[idx]["volume"] += t.quantity
            buckets[idx]["pv"] += t.price * t.quantity

        result = []
        for i, b in enumerate(buckets):
            vwap = b["pv"] / b["volume"] if b["volume"] > 0 else 0
            result.append({
                "bucket": i,
                "volume": round(b["volume"], 4),
                "vwap": round(vwap, 6),
            })
        return result


# ── Market Impact ──────────────────────────────────────────────────────

class MarketImpactEstimator:
    @staticmethod
    def almgren_chriss(
        order_quantity: float,
        average_daily_volume: float,
        volatility: float,
        spread: float,
        eta: float = 0.01,
        gamma: float = 0.1,
    ) -> MarketImpactResult:
        """Almgren-Chriss market impact model."""
        participation = order_quantity / average_daily_volume if average_daily_volume > 0 else 1.0
        temporary = eta * volatility * (order_quantity / average_daily_volume) ** 0.6 if average_daily_volume > 0 else 0
        permanent = gamma * volatility * (order_quantity / average_daily_volume) ** 0.5 if average_daily_volume > 0 else 0
        total_impact = temporary + permanent + spread / 2

        exec_time = order_quantity / (average_daily_volume * 0.10) if average_daily_volume > 0 else 0
        slippage = total_impact / (spread / 2) * 10000 if spread > 0 else 0

        return MarketImpactResult(
            estimated_price_impact=total_impact,
            estimated_cost=total_impact * order_quantity,
            participation_rate=participation,
            execution_time_estimate=exec_time,
            slippage_bps=slippage,
        )

    @staticmethod
    def kyle_lambda(
        returns: list[float],
        volumes: list[float],
        signed_volumes: list[float],
    ) -> float:
        """Kyle's lambda — price impact coefficient."""
        n = min(len(returns), len(signed_volumes))
        if n < 3:
            return 0.0

        sv_mean = statistics.mean(signed_volumes[:n])
        r_mean = statistics.mean(returns[:n])

        ss_xy = sum((signed_volumes[i] - sv_mean) * (returns[i] - r_mean) for i in range(n))
        ss_xx = sum((signed_volumes[i] - sv_mean) ** 2 for i in range(n))

        return ss_xy / ss_xx if ss_xx > 0 else 0.0

    @staticmethod
    def cost_from_book(
        book: OrderBookSnapshot,
        order_quantity: float,
        side: str = "buy",
    ) -> dict:
        """Estimate execution cost by walking the order book."""
        levels = book.asks if side == "buy" else book.bids
        remaining = order_quantity
        total_cost = 0.0
        levels_consumed = 0

        for level in levels:
            fill = min(remaining, level.quantity)
            total_cost += fill * level.price
            remaining -= fill
            levels_consumed += 1
            if remaining <= 0:
                break

        avg_price = total_cost / order_quantity if order_quantity > 0 else 0
        mid = book.mid_price
        impact = (avg_price - mid) / mid if mid > 0 else 0
        if side == "sell":
            impact = -impact

        return {
            "average_fill_price": round(avg_price, 6),
            "total_cost": round(total_cost, 2),
            "market_impact_pct": round(impact * 100, 4),
            "market_impact_bps": round(impact * 10000, 2),
            "levels_consumed": levels_consumed,
            "unfilled_quantity": round(max(remaining, 0), 4),
        }


# ── Order Flow Toxicity (VPIN) ───────────────────────────────────────

class VPINCalculator:
    """Volume-Synchronized Probability of Informed Trading."""

    @staticmethod
    def classify_trades(trades: list[Trade]) -> list[Trade]:
        """Lee-Ready trade classification."""
        classified = []
        for i, t in enumerate(trades):
            if t.direction != "unknown":
                classified.append(t)
                continue

            if i > 0:
                prev = trades[i - 1]
                if t.price > prev.price:
                    t.direction = "buy"
                elif t.price < prev.price:
                    t.direction = "sell"
                else:
                    t.direction = prev.direction if prev.direction != "unknown" else "buy"
            else:
                t.direction = "buy"
            classified.append(t)
        return classified

    @staticmethod
    def calculate_vpin(
        trades: list[Trade],
        bucket_volume: float,
        n_buckets: int = 50,
    ) -> dict:
        """Calculate VPIN from trades."""
        classified = VPINCalculator.classify_trades(trades)

        buckets = []
        current_buy = 0.0
        current_sell = 0.0
        current_volume = 0.0

        for t in classified:
            remaining = t.quantity
            while remaining > 0:
                space = bucket_volume - current_volume
                fill = min(remaining, space)

                if t.direction == "buy":
                    current_buy += fill
                else:
                    current_sell += fill

                current_volume += fill
                remaining -= fill

                if current_volume >= bucket_volume:
                    buckets.append({
                        "buy_volume": current_buy,
                        "sell_volume": current_sell,
                        "imbalance": abs(current_buy - current_sell),
                    })
                    current_buy = 0.0
                    current_sell = 0.0
                    current_volume = 0.0

        if not buckets:
            return {"vpin": 0.0, "n_buckets": 0}

        # VPIN = mean of |buy - sell| / bucket_volume over last n_buckets
        recent = buckets[-n_buckets:]
        vpin = statistics.mean(b["imbalance"] for b in recent) / bucket_volume

        return {
            "vpin": round(vpin, 6),
            "n_buckets": len(recent),
            "avg_buy_volume": round(statistics.mean(b["buy_volume"] for b in recent), 4),
            "avg_sell_volume": round(statistics.mean(b["sell_volume"] for b in recent), 4),
            "toxicity_level": "high" if vpin > 0.7 else "medium" if vpin > 0.4 else "low",
        }


# ── Liquidity Metrics ────────────────────────────────────────────────

class LiquidityMetrics:
    @staticmethod
    def amihud_illiquidity(
        returns: list[float],
        volumes: list[float],
    ) -> float:
        """Amihud (2002) illiquidity measure."""
        n = min(len(returns), len(volumes))
        if n == 0:
            return 0.0
        ratios = [abs(returns[i]) / volumes[i] for i in range(n) if volumes[i] > 0]
        return statistics.mean(ratios) if ratios else 0.0

    @staticmethod
    def turnover_ratio(
        volumes: list[float],
        shares_outstanding: float,
    ) -> float:
        if shares_outstanding <= 0:
            return 0.0
        return sum(volumes) / shares_outstanding

    @staticmethod
    def hui_heubel(
        high: list[float],
        low: list[float],
        close: list[float],
        volumes: list[float],
        shares_outstanding: float,
    ) -> float:
        n = min(len(high), len(low), len(close), len(volumes))
        if n == 0 or shares_outstanding <= 0:
            return 0.0

        avg_volume = statistics.mean(volumes[:n])
        max_p = max(high[:n])
        min_p = min(low[:n])
        avg_close = statistics.mean(close[:n])

        if avg_close <= 0 or avg_volume <= 0:
            return 0.0

        return ((max_p - min_p) / avg_close) / (avg_volume / shares_outstanding)

    @staticmethod
    def effective_tick(prices: list[float]) -> float:
        if len(prices) < 2:
            return 0.0
        diffs = [abs(prices[i] - prices[i - 1]) for i in range(1, len(prices))]
        non_zero = [d for d in diffs if d > 0]
        return min(non_zero) if non_zero else 0.0

    @staticmethod
    def all_metrics(
        returns: list[float],
        volumes: list[float],
        high: list[float],
        low: list[float],
        close: list[float],
        shares_outstanding: float,
    ) -> dict:
        return {
            "amihud_illiquidity": round(LiquidityMetrics.amihud_illiquidity(returns, volumes), 8),
            "turnover_ratio": round(LiquidityMetrics.turnover_ratio(volumes, shares_outstanding), 4),
            "hui_heubel": round(LiquidityMetrics.hui_heubel(high, low, close, volumes, shares_outstanding), 6),
            "avg_daily_volume": round(statistics.mean(volumes), 2) if volumes else 0,
            "volume_volatility": round(statistics.stdev(volumes), 2) if len(volumes) > 1 else 0,
        }


# ── Order Book Reconstruction ────────────────────────────────────────

class OrderBookBuilder:
    """Build and maintain an order book from events."""

    def __init__(self, symbol: str) -> None:
        self.symbol = symbol
        self.bids: Dict[float, OrderBookLevel] = {}
        self.asks: Dict[float, OrderBookLevel] = {}

    def add_order(self, price: float, quantity: float, side: str) -> None:
        book = self.bids if side == "bid" else self.asks
        if price in book:
            book[price].quantity += quantity
            book[price].order_count += 1
        else:
            book[price] = OrderBookLevel(price=price, quantity=quantity, order_count=1)

    def remove_order(self, price: float, quantity: float, side: str) -> None:
        book = self.bids if side == "bid" else self.asks
        if price in book:
            book[price].quantity -= quantity
            if book[price].quantity <= 0:
                del book[price]

    def update_level(self, price: float, quantity: float, side: str) -> None:
        book = self.bids if side == "bid" else self.asks
        if quantity <= 0:
            book.pop(price, None)
        else:
            book[price] = OrderBookLevel(price=price, quantity=quantity)

    def snapshot(self) -> OrderBookSnapshot:
        sorted_bids = sorted(self.bids.values(), key=lambda x: -x.price)
        sorted_asks = sorted(self.asks.values(), key=lambda x: x.price)
        return OrderBookSnapshot(
            symbol=self.symbol,
            bids=sorted_bids,
            asks=sorted_asks,
        )

    def clear(self) -> None:
        self.bids.clear()
        self.asks.clear()


# ── Orchestrator ──────────────────────────────────────────────────────

class OrderBookEngine:
    def __init__(self) -> None:
        self.depth = DepthAnalytics()
        self.spread = SpreadAnalytics()
        self.vwap = VWAPCalculator()
        self.impact = MarketImpactEstimator()
        self.vpin = VPINCalculator()
        self.liquidity = LiquidityMetrics()
        self.builders: Dict[str, OrderBookBuilder] = {}

    def get_or_create_builder(self, symbol: str) -> OrderBookBuilder:
        if symbol not in self.builders:
            self.builders[symbol] = OrderBookBuilder(symbol)
        return self.builders[symbol]

    def analyze_book(self, book: OrderBookSnapshot) -> dict:
        return {
            "snapshot": book.to_dict(),
            "weighted_mid": round(self.depth.weighted_mid_price(book), 6),
            "microprice": round(self.depth.microprice(book), 6),
            "imbalance": round(self.depth.order_book_imbalance(book), 4),
            "depth_ratio": self.depth.depth_ratio(book),
            "cumulative_depth": self.depth.cumulative_depth(book),
            "price_levels": self.depth.price_levels_analysis(book),
        }

    def calculate_vwap(self, trades: list[Trade]) -> dict:
        vwap = self.vwap.vwap(trades)
        twap = self.vwap.twap(trades)
        bands = self.vwap.vwap_bands(trades)
        return {"vwap": round(vwap, 6), "twap": round(twap, 6), "bands": bands}

    def estimate_market_impact(
        self,
        order_qty: float,
        adv: float,
        volatility: float,
        spread: float,
    ) -> dict:
        result = self.impact.almgren_chriss(order_qty, adv, volatility, spread)
        return result.to_dict()

    def calculate_vpin(self, trades: list[Trade], bucket_volume: float) -> dict:
        return self.vpin.calculate_vpin(trades, bucket_volume)

    def liquidity_analysis(
        self,
        returns: list[float],
        volumes: list[float],
        high: list[float],
        low: list[float],
        close: list[float],
        shares_outstanding: float,
    ) -> dict:
        return self.liquidity.all_metrics(returns, volumes, high, low, close, shares_outstanding)

    def capabilities(self) -> dict:
        return {
            "engine": "OrderBookEngine",
            "version": "1.0.0",
            "features": [
                "order_book_construction_and_management",
                "depth_of_market_analysis",
                "weighted_mid_price_and_microprice",
                "order_book_imbalance",
                "cumulative_depth_profile",
                "spread_analytics (quoted, effective, realized, Roll)",
                "VWAP_TWAP_calculation",
                "VWAP_bands",
                "market_impact_estimation (Almgren-Chriss)",
                "kyle_lambda (price impact coefficient)",
                "VPIN (order flow toxicity)",
                "liquidity_metrics (Amihud, turnover, Hui-Heubel)",
                "intraday_VWAP_profile",
                "book_cost_estimation (walk the book)",
            ],
        }
