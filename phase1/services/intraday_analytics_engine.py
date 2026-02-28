"""
Intraday Analytics Engine — VWAP/TWAP calculations, intraday volume profiles,
session analysis, auction analysis, opening/closing cross, momentum detection,
price level analysis, intraday patterns, volume clock, time-and-sales analytics.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class SessionType(str, Enum):
    PRE_MARKET = "pre_market"
    REGULAR = "regular"
    POST_MARKET = "post_market"
    FULL_DAY = "full_day"


class IntradayPattern(str, Enum):
    U_SHAPE = "u_shape"
    OPENING_SPIKE = "opening_spike"
    CLOSING_SPIKE = "closing_spike"
    LUNCH_DIP = "lunch_dip"
    TREND_DAY = "trend_day"
    MEAN_REVERSION = "mean_reversion"
    RANGE_BOUND = "range_bound"


@dataclass
class IntradayBar:
    timestamp: float
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: float = 0.0
    trade_count: int = 0

    @property
    def typical_price(self) -> float:
        return (self.high + self.low + self.close) / 3

    @property
    def range(self) -> float:
        return self.high - self.low

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "open": round(self.open, 4),
            "high": round(self.high, 4),
            "low": round(self.low, 4),
            "close": round(self.close, 4),
            "volume": round(self.volume, 2),
            "vwap": round(self.vwap, 4),
            "trade_count": self.trade_count,
        }


@dataclass
class SessionSummary:
    session: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: float
    n_bars: int

    def to_dict(self) -> dict:
        return {
            "session": self.session,
            "open": round(self.open, 4),
            "high": round(self.high, 4),
            "low": round(self.low, 4),
            "close": round(self.close, 4),
            "volume": round(self.volume, 2),
            "vwap": round(self.vwap, 4),
            "n_bars": self.n_bars,
            "range": round(self.high - self.low, 4),
            "return_pct": round((self.close - self.open) / self.open * 100 if self.open > 0 else 0, 4),
        }


# ── VWAP Engine ───────────────────────────────────────────────────────

class IntradayVWAP:
    @staticmethod
    def calculate(bars: list[IntradayBar]) -> list[dict]:
        """Calculate cumulative intraday VWAP."""
        cum_pv = 0.0
        cum_vol = 0.0
        results = []

        for bar in bars:
            cum_pv += bar.typical_price * bar.volume
            cum_vol += bar.volume
            vwap = cum_pv / cum_vol if cum_vol > 0 else bar.typical_price

            results.append({
                "timestamp": bar.timestamp,
                "vwap": round(vwap, 4),
                "volume": round(cum_vol, 2),
                "price": round(bar.close, 4),
                "price_vs_vwap_pct": round((bar.close - vwap) / vwap * 100 if vwap > 0 else 0, 4),
            })

        return results

    @staticmethod
    def anchored_vwap(bars: list[IntradayBar], anchor_index: int = 0) -> list[dict]:
        """Calculate VWAP anchored to a specific bar."""
        cum_pv = 0.0
        cum_vol = 0.0
        results = []

        for i in range(anchor_index, len(bars)):
            bar = bars[i]
            cum_pv += bar.typical_price * bar.volume
            cum_vol += bar.volume
            vwap = cum_pv / cum_vol if cum_vol > 0 else bar.typical_price

            results.append({
                "timestamp": bar.timestamp,
                "anchored_vwap": round(vwap, 4),
                "close": round(bar.close, 4),
            })

        return results

    @staticmethod
    def vwap_bands(
        bars: list[IntradayBar],
        n_std: float = 1.0,
    ) -> list[dict]:
        """VWAP with standard deviation bands."""
        cum_pv = 0.0
        cum_vol = 0.0
        cum_pv2 = 0.0
        results = []

        for bar in bars:
            tp = bar.typical_price
            cum_pv += tp * bar.volume
            cum_vol += bar.volume
            cum_pv2 += tp ** 2 * bar.volume

            vwap = cum_pv / cum_vol if cum_vol > 0 else tp
            variance = (cum_pv2 / cum_vol - vwap ** 2) if cum_vol > 0 else 0
            std = math.sqrt(max(variance, 0))

            results.append({
                "timestamp": bar.timestamp,
                "vwap": round(vwap, 4),
                "upper_1": round(vwap + n_std * std, 4),
                "lower_1": round(vwap - n_std * std, 4),
                "upper_2": round(vwap + 2 * n_std * std, 4),
                "lower_2": round(vwap - 2 * n_std * std, 4),
                "std_dev": round(std, 4),
            })

        return results


# ── Volume Profile ────────────────────────────────────────────────────

class IntradayVolumeProfile:
    @staticmethod
    def time_profile(
        bars: list[IntradayBar],
        n_buckets: int = 78,  # 5-min buckets in 6.5hr
    ) -> list[dict]:
        """Volume distribution across time buckets."""
        if not bars:
            return []

        total_vol = sum(b.volume for b in bars)
        bucket_size = max(1, len(bars) // n_buckets)

        profile = []
        for i in range(0, len(bars), bucket_size):
            chunk = bars[i:i + bucket_size]
            vol = sum(b.volume for b in chunk)
            avg_price = statistics.mean(b.close for b in chunk)

            profile.append({
                "bucket": len(profile),
                "timestamp": chunk[0].timestamp,
                "volume": round(vol, 2),
                "volume_pct": round(vol / total_vol * 100 if total_vol > 0 else 0, 2),
                "avg_price": round(avg_price, 4),
                "bar_count": len(chunk),
            })

        return profile

    @staticmethod
    def price_volume_profile(
        bars: list[IntradayBar],
        n_levels: int = 50,
    ) -> list[dict]:
        """Volume at price levels."""
        if not bars:
            return []

        all_high = max(b.high for b in bars)
        all_low = min(b.low for b in bars)
        level_size = (all_high - all_low) / n_levels if n_levels > 0 else 1

        levels = defaultdict(float)
        for bar in bars:
            # Distribute volume across price range of bar
            bar_levels = max(1, int((bar.high - bar.low) / level_size))
            vol_per_level = bar.volume / bar_levels

            for k in range(bar_levels):
                price = bar.low + k * level_size
                level_idx = int((price - all_low) / level_size)
                levels[level_idx] += vol_per_level

        total_vol = sum(levels.values())
        max_vol = max(levels.values()) if levels else 0

        # POC (Point of Control) — price level with most volume
        poc_idx = max(levels.keys(), key=lambda k: levels[k]) if levels else 0

        profile = []
        for idx in sorted(levels.keys()):
            price = all_low + idx * level_size
            vol = levels[idx]
            profile.append({
                "price": round(price, 4),
                "volume": round(vol, 2),
                "volume_pct": round(vol / total_vol * 100 if total_vol > 0 else 0, 2),
                "is_poc": idx == poc_idx,
            })

        # Value Area (70% of volume around POC)
        sorted_by_vol = sorted(profile, key=lambda x: x["volume"], reverse=True)
        va_vol = 0.0
        va_levels = []
        for p in sorted_by_vol:
            va_vol += p["volume"]
            va_levels.append(p["price"])
            if va_vol >= total_vol * 0.70:
                break

        return {
            "levels": profile,
            "poc": round(all_low + poc_idx * level_size, 4),
            "value_area_high": round(max(va_levels) if va_levels else 0, 4),
            "value_area_low": round(min(va_levels) if va_levels else 0, 4),
            "total_volume": round(total_vol, 2),
        }


# ── Session Analysis ──────────────────────────────────────────────────

class SessionAnalysis:
    @staticmethod
    def session_summary(bars: list[IntradayBar]) -> SessionSummary:
        """Summarize a trading session."""
        if not bars:
            return SessionSummary("empty", 0, 0, 0, 0, 0, 0, 0)

        total_pv = sum(b.typical_price * b.volume for b in bars)
        total_vol = sum(b.volume for b in bars)

        return SessionSummary(
            session="regular",
            open=bars[0].open,
            high=max(b.high for b in bars),
            low=min(b.low for b in bars),
            close=bars[-1].close,
            volume=total_vol,
            vwap=total_pv / total_vol if total_vol > 0 else 0,
            n_bars=len(bars),
        )

    @staticmethod
    def opening_analysis(bars: list[IntradayBar], n_bars: int = 6) -> dict:
        """Analyze first N bars (opening range)."""
        opening = bars[:n_bars]
        if not opening:
            return {}

        opening_high = max(b.high for b in opening)
        opening_low = min(b.low for b in opening)
        opening_range = opening_high - opening_low
        opening_vol = sum(b.volume for b in opening)
        total_vol = sum(b.volume for b in bars)

        return {
            "opening_range_high": round(opening_high, 4),
            "opening_range_low": round(opening_low, 4),
            "opening_range": round(opening_range, 4),
            "opening_range_pct": round(opening_range / bars[0].open * 100 if bars[0].open > 0 else 0, 4),
            "opening_volume": round(opening_vol, 2),
            "opening_volume_pct": round(opening_vol / total_vol * 100 if total_vol > 0 else 0, 2),
            "gap": round(bars[0].open - bars[0].close, 4) if len(bars) > 1 else 0,
        }

    @staticmethod
    def closing_analysis(bars: list[IntradayBar], n_bars: int = 6) -> dict:
        """Analyze last N bars (closing auction)."""
        closing = bars[-n_bars:]
        if not closing:
            return {}

        closing_vol = sum(b.volume for b in closing)
        total_vol = sum(b.volume for b in bars)

        return {
            "closing_range": round(max(b.high for b in closing) - min(b.low for b in closing), 4),
            "closing_volume": round(closing_vol, 2),
            "closing_volume_pct": round(closing_vol / total_vol * 100 if total_vol > 0 else 0, 2),
            "close_vs_vwap": round(bars[-1].close - (sum(b.typical_price * b.volume for b in bars) / total_vol if total_vol > 0 else 0), 4),
            "close_location_pct": round(
                (bars[-1].close - min(b.low for b in bars)) / (max(b.high for b in bars) - min(b.low for b in bars))
                if max(b.high for b in bars) > min(b.low for b in bars) else 0.5, 4
            ),
        }


# ── Intraday Pattern Detection ───────────────────────────────────────

class IntradayPatternDetector:
    @staticmethod
    def detect_trend_day(bars: list[IntradayBar]) -> dict:
        """Detect if session is a trend day."""
        if len(bars) < 10:
            return {"is_trend_day": False}

        closes = [b.close for b in bars]
        n = len(closes)

        # Count consecutive directional bars
        up_streaks = 0
        down_streaks = 0
        current_streak = 0
        prev_dir = 0

        for i in range(1, n):
            direction = 1 if closes[i] > closes[i - 1] else -1
            if direction == prev_dir:
                current_streak += 1
            else:
                if prev_dir > 0:
                    up_streaks = max(up_streaks, current_streak)
                else:
                    down_streaks = max(down_streaks, current_streak)
                current_streak = 1
            prev_dir = direction

        # Monotonicity measure
        above_vwap = sum(1 for b in bars if b.close > b.vwap)
        monotonicity = above_vwap / n

        # Close near extreme
        day_high = max(b.high for b in bars)
        day_low = min(b.low for b in bars)
        day_range = day_high - day_low
        close_position = (bars[-1].close - day_low) / day_range if day_range > 0 else 0.5

        is_trend_up = close_position > 0.8 and monotonicity > 0.65
        is_trend_down = close_position < 0.2 and monotonicity < 0.35
        is_trend = is_trend_up or is_trend_down

        return {
            "is_trend_day": is_trend,
            "direction": "up" if is_trend_up else "down" if is_trend_down else "none",
            "close_position": round(close_position, 4),
            "monotonicity": round(monotonicity, 4),
            "max_up_streak": up_streaks,
            "max_down_streak": down_streaks,
        }

    @staticmethod
    def detect_volume_pattern(bars: list[IntradayBar]) -> dict:
        """Detect intraday volume pattern (U-shape, etc.)."""
        if len(bars) < 20:
            return {"pattern": "unknown"}

        n = len(bars)
        third = n // 3

        vol_first = sum(b.volume for b in bars[:third])
        vol_middle = sum(b.volume for b in bars[third:2 * third])
        vol_last = sum(b.volume for b in bars[2 * third:])

        total = vol_first + vol_middle + vol_last

        first_pct = vol_first / total if total > 0 else 0.33
        middle_pct = vol_middle / total if total > 0 else 0.33
        last_pct = vol_last / total if total > 0 else 0.33

        # Classify pattern
        if first_pct > 0.35 and last_pct > 0.35 and middle_pct < 0.30:
            pattern = IntradayPattern.U_SHAPE.value
        elif first_pct > 0.50:
            pattern = IntradayPattern.OPENING_SPIKE.value
        elif last_pct > 0.50:
            pattern = IntradayPattern.CLOSING_SPIKE.value
        elif middle_pct < 0.25:
            pattern = IntradayPattern.LUNCH_DIP.value
        else:
            pattern = IntradayPattern.RANGE_BOUND.value

        return {
            "pattern": pattern,
            "first_third_pct": round(first_pct * 100, 2),
            "middle_third_pct": round(middle_pct * 100, 2),
            "last_third_pct": round(last_pct * 100, 2),
        }


# ── Momentum Scanner ─────────────────────────────────────────────────

class IntradayMomentum:
    @staticmethod
    def rate_of_change(bars: list[IntradayBar], lookback: int = 10) -> list[dict]:
        """Calculate intraday rate of change."""
        results = []
        for i in range(lookback, len(bars)):
            roc = (bars[i].close - bars[i - lookback].close) / bars[i - lookback].close if bars[i - lookback].close > 0 else 0
            results.append({
                "timestamp": bars[i].timestamp,
                "roc_pct": round(roc * 100, 4),
                "momentum": "strong_up" if roc > 0.005 else "up" if roc > 0.001 else "flat" if roc > -0.001 else "down" if roc > -0.005 else "strong_down",
            })
        return results

    @staticmethod
    def cumulative_delta(
        buy_volumes: list[float],
        sell_volumes: list[float],
    ) -> list[dict]:
        """Calculate cumulative buy/sell delta."""
        results = []
        cum_delta = 0.0

        for i in range(min(len(buy_volumes), len(sell_volumes))):
            delta = buy_volumes[i] - sell_volumes[i]
            cum_delta += delta
            results.append({
                "index": i,
                "delta": round(delta, 2),
                "cumulative_delta": round(cum_delta, 2),
                "buy_volume": round(buy_volumes[i], 2),
                "sell_volume": round(sell_volumes[i], 2),
            })

        return results

    @staticmethod
    def breakout_detector(
        bars: list[IntradayBar],
        opening_bars: int = 6,
        volume_threshold: float = 2.0,
    ) -> list[dict]:
        """Detect intraday breakouts from opening range."""
        if len(bars) < opening_bars:
            return []

        opening_high = max(b.high for b in bars[:opening_bars])
        opening_low = min(b.low for b in bars[:opening_bars])
        avg_vol = statistics.mean(b.volume for b in bars[:opening_bars])

        breakouts = []
        for i in range(opening_bars, len(bars)):
            bar = bars[i]
            if bar.close > opening_high and bar.volume > avg_vol * volume_threshold:
                breakouts.append({
                    "timestamp": bar.timestamp,
                    "type": "upside_breakout",
                    "price": round(bar.close, 4),
                    "opening_range_high": round(opening_high, 4),
                    "volume_multiple": round(bar.volume / avg_vol if avg_vol > 0 else 0, 2),
                })
            elif bar.close < opening_low and bar.volume > avg_vol * volume_threshold:
                breakouts.append({
                    "timestamp": bar.timestamp,
                    "type": "downside_breakout",
                    "price": round(bar.close, 4),
                    "opening_range_low": round(opening_low, 4),
                    "volume_multiple": round(bar.volume / avg_vol if avg_vol > 0 else 0, 2),
                })

        return breakouts


# ── Time and Sales Analysis ──────────────────────────────────────────

class TimeAndSales:
    @staticmethod
    def analyze(
        prices: list[float],
        volumes: list[float],
        timestamps: list[float],
        trade_signs: list[int] | None = None,
    ) -> dict:
        """Analyze time and sales data."""
        n = len(prices)
        if n == 0:
            return {}

        total_vol = sum(volumes)
        buy_vol = 0.0
        sell_vol = 0.0

        if trade_signs:
            for i in range(min(n, len(trade_signs))):
                if trade_signs[i] > 0:
                    buy_vol += volumes[i]
                elif trade_signs[i] < 0:
                    sell_vol += volumes[i]
        else:
            for i in range(1, n):
                if prices[i] > prices[i - 1]:
                    buy_vol += volumes[i]
                elif prices[i] < prices[i - 1]:
                    sell_vol += volumes[i]

        # Trade size distribution
        size_bins = {"<100": 0, "100-499": 0, "500-999": 0, "1000-4999": 0, "5000+": 0}
        for v in volumes:
            if v < 100:
                size_bins["<100"] += 1
            elif v < 500:
                size_bins["100-499"] += 1
            elif v < 1000:
                size_bins["500-999"] += 1
            elif v < 5000:
                size_bins["1000-4999"] += 1
            else:
                size_bins["5000+"] += 1

        return {
            "total_trades": n,
            "total_volume": round(total_vol, 2),
            "buy_volume": round(buy_vol, 2),
            "sell_volume": round(sell_vol, 2),
            "buy_sell_ratio": round(buy_vol / sell_vol if sell_vol > 0 else float("inf"), 4),
            "avg_trade_size": round(statistics.mean(volumes), 2),
            "median_trade_size": round(statistics.median(volumes), 2),
            "price_range": round(max(prices) - min(prices), 4),
            "vwap": round(sum(p * v for p, v in zip(prices, volumes)) / total_vol if total_vol > 0 else 0, 4),
            "size_distribution": size_bins,
        }


# ── Orchestrator ──────────────────────────────────────────────────────

class IntradayAnalyticsEngine:
    def __init__(self) -> None:
        self.vwap = IntradayVWAP()
        self.volume = IntradayVolumeProfile()
        self.session = SessionAnalysis()
        self.patterns = IntradayPatternDetector()
        self.momentum = IntradayMomentum()
        self.tns = TimeAndSales()

    def calculate_vwap(self, bars: list[IntradayBar]) -> list[dict]:
        return self.vwap.calculate(bars)

    def vwap_with_bands(self, bars: list[IntradayBar]) -> list[dict]:
        return self.vwap.vwap_bands(bars)

    def time_volume_profile(self, bars: list[IntradayBar]) -> list[dict]:
        return self.volume.time_profile(bars)

    def price_volume_profile(self, bars: list[IntradayBar]) -> dict:
        return self.volume.price_volume_profile(bars)

    def session_summary(self, bars: list[IntradayBar]) -> dict:
        return self.session.session_summary(bars).to_dict()

    def opening_analysis(self, bars: list[IntradayBar]) -> dict:
        return self.session.opening_analysis(bars)

    def closing_analysis(self, bars: list[IntradayBar]) -> dict:
        return self.session.closing_analysis(bars)

    def detect_patterns(self, bars: list[IntradayBar]) -> dict:
        return {
            "trend": self.patterns.detect_trend_day(bars),
            "volume_pattern": self.patterns.detect_volume_pattern(bars),
        }

    def detect_breakouts(self, bars: list[IntradayBar]) -> list[dict]:
        return self.momentum.breakout_detector(bars)

    def time_and_sales(self, **kwargs) -> dict:
        return self.tns.analyze(**kwargs)

    def capabilities(self) -> dict:
        return {
            "engine": "IntradayAnalyticsEngine",
            "version": "1.0.0",
            "features": [
                "cumulative_VWAP",
                "anchored_VWAP",
                "VWAP_bands (standard deviation)",
                "time_volume_profile",
                "price_volume_profile (POC, value area)",
                "session_summary",
                "opening_range_analysis",
                "closing_auction_analysis",
                "trend_day_detection",
                "volume_pattern_classification",
                "intraday_rate_of_change",
                "cumulative_delta",
                "breakout_detection",
                "time_and_sales_analysis",
            ],
        }
