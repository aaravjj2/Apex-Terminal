"""
Apex Terminal — Bloomberg-Grade Charting Calculations Engine
============================================================

Advanced chart types and calculations:
- Heikin Ashi candlestick transformation
- Renko bricks from OHLCV data
- Kagi chart construction
- Point & Figure (PnF) chart construction
- Line Break charts
- Range bars
- Tick charts aggregation
- Market Profile (TPO) analysis
- Volume Profile with POC, VAH, VAL
- VWAP with standard deviation bands
- Pivot Points (Standard, Fibonacci, Camarilla, Woodie, DeMark)
- Ichimoku Cloud calculations
- Supertrend indicator
- Anchored VWAP

Pure computation module — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class ChartType(Enum):
    HEIKIN_ASHI = "heikin_ashi"
    RENKO = "renko"
    KAGI = "kagi"
    POINT_AND_FIGURE = "point_and_figure"
    LINE_BREAK = "line_break"
    RANGE_BAR = "range_bar"
    TICK_CHART = "tick_chart"


class PivotType(Enum):
    STANDARD = "standard"
    FIBONACCI = "fibonacci"
    CAMARILLA = "camarilla"
    WOODIE = "woodie"
    DEMARK = "demark"


class ProfileType(Enum):
    MARKET_PROFILE = "market_profile"
    VOLUME_PROFILE = "volume_profile"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class Bar:
    """Generic OHLCV bar."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "open": self.open, "high": self.high,
            "low": self.low, "close": self.close,
            "volume": self.volume,
        }


@dataclass
class RenkoBrick:
    """Single Renko brick."""
    timestamp: datetime
    open: float
    close: float
    direction: str  # "up" or "down"
    high: float = 0.0
    low: float = 0.0

    def __post_init__(self):
        self.high = max(self.open, self.close)
        self.low = min(self.open, self.close)

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "open": self.open, "close": self.close,
            "high": self.high, "low": self.low,
            "direction": self.direction,
        }


@dataclass
class KagiLine:
    """Kagi chart segment."""
    timestamp: datetime
    price: float
    direction: str  # "yang" (thick/up) or "yin" (thin/down)
    is_reversal: bool = False

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "price": self.price,
            "direction": self.direction,
            "is_reversal": self.is_reversal,
        }


@dataclass
class PnFColumn:
    """Point & Figure chart column."""
    start_price: float
    end_price: float
    column_type: str  # "X" (up) or "O" (down)
    boxes: int = 0

    def to_dict(self) -> dict:
        return {
            "start_price": self.start_price,
            "end_price": self.end_price,
            "type": self.column_type,
            "boxes": self.boxes,
        }


@dataclass
class PivotLevels:
    """Pivot point levels."""
    pivot: float
    r1: float = 0.0
    r2: float = 0.0
    r3: float = 0.0
    r4: float = 0.0
    s1: float = 0.0
    s2: float = 0.0
    s3: float = 0.0
    s4: float = 0.0

    def to_dict(self) -> dict:
        return {
            "pivot": round(self.pivot, 4),
            "r1": round(self.r1, 4), "r2": round(self.r2, 4),
            "r3": round(self.r3, 4), "r4": round(self.r4, 4),
            "s1": round(self.s1, 4), "s2": round(self.s2, 4),
            "s3": round(self.s3, 4), "s4": round(self.s4, 4),
        }


@dataclass
class VWAPData:
    """VWAP with deviation bands."""
    timestamp: datetime
    vwap: float
    upper_1: float = 0.0
    upper_2: float = 0.0
    upper_3: float = 0.0
    lower_1: float = 0.0
    lower_2: float = 0.0
    lower_3: float = 0.0

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "vwap": round(self.vwap, 4),
            "upper_1": round(self.upper_1, 4),
            "upper_2": round(self.upper_2, 4),
            "upper_3": round(self.upper_3, 4),
            "lower_1": round(self.lower_1, 4),
            "lower_2": round(self.lower_2, 4),
            "lower_3": round(self.lower_3, 4),
        }


@dataclass
class IchimokuData:
    """Ichimoku Cloud data point."""
    timestamp: datetime
    tenkan_sen: float = 0.0     # Conversion line (9-period)
    kijun_sen: float = 0.0      # Base line (26-period)
    senkou_span_a: float = 0.0  # Leading Span A
    senkou_span_b: float = 0.0  # Leading Span B
    chikou_span: float = 0.0    # Lagging Span

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "tenkan_sen": round(self.tenkan_sen, 4),
            "kijun_sen": round(self.kijun_sen, 4),
            "senkou_span_a": round(self.senkou_span_a, 4),
            "senkou_span_b": round(self.senkou_span_b, 4),
            "chikou_span": round(self.chikou_span, 4),
        }


@dataclass
class SupertrendData:
    """Supertrend indicator data point."""
    timestamp: datetime
    supertrend: float
    direction: int  # 1 = bullish, -1 = bearish
    upper_band: float = 0.0
    lower_band: float = 0.0

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "supertrend": round(self.supertrend, 4),
            "direction": self.direction,
            "upper_band": round(self.upper_band, 4),
            "lower_band": round(self.lower_band, 4),
        }


@dataclass
class MarketProfileData:
    """Market Profile / TPO analysis."""
    price_level: float
    tpo_count: int  # Time Price Opportunity count
    volume: float
    is_poc: bool = False   # Point of Control
    is_vah: bool = False   # Value Area High
    is_val: bool = False   # Value Area Low

    def to_dict(self) -> dict:
        return {
            "price_level": round(self.price_level, 4),
            "tpo_count": self.tpo_count,
            "volume": self.volume,
            "is_poc": self.is_poc,
            "is_vah": self.is_vah,
            "is_val": self.is_val,
        }


# ─── Heikin Ashi ─────────────────────────────────────────────────────────────

class HeikinAshiCalculator:
    """Transform OHLCV bars to Heikin Ashi candlesticks."""

    @staticmethod
    def calculate(bars: list[Bar]) -> list[Bar]:
        """Convert standard OHLCV to Heikin Ashi."""
        if not bars:
            return []

        result = []
        prev_ha_open = bars[0].open
        prev_ha_close = (bars[0].open + bars[0].high + bars[0].low + bars[0].close) / 4.0

        for i, bar in enumerate(bars):
            ha_close = (bar.open + bar.high + bar.low + bar.close) / 4.0

            if i == 0:
                ha_open = bar.open
            else:
                ha_open = (prev_ha_open + prev_ha_close) / 2.0

            ha_high = max(bar.high, ha_open, ha_close)
            ha_low = min(bar.low, ha_open, ha_close)

            result.append(Bar(
                timestamp=bar.timestamp,
                open=round(ha_open, 4),
                high=round(ha_high, 4),
                low=round(ha_low, 4),
                close=round(ha_close, 4),
                volume=bar.volume,
            ))

            prev_ha_open = ha_open
            prev_ha_close = ha_close

        return result


# ─── Renko ───────────────────────────────────────────────────────────────────

class RenkoCalculator:
    """Generate Renko bricks from OHLCV data."""

    @staticmethod
    def calculate(bars: list[Bar], brick_size: float = 1.0) -> list[RenkoBrick]:
        """Generate Renko bricks with fixed brick size."""
        if not bars or brick_size <= 0:
            return []

        bricks = []
        current_price = bars[0].close
        # Round to nearest brick
        base_price = math.floor(current_price / brick_size) * brick_size

        for bar in bars[1:]:
            price = bar.close
            diff = price - base_price

            # Check for up bricks
            while diff >= brick_size:
                new_base = base_price + brick_size
                bricks.append(RenkoBrick(
                    timestamp=bar.timestamp,
                    open=base_price,
                    close=new_base,
                    direction="up",
                ))
                base_price = new_base
                diff = price - base_price

            # Check for down bricks
            while diff <= -brick_size:
                new_base = base_price - brick_size
                bricks.append(RenkoBrick(
                    timestamp=bar.timestamp,
                    open=base_price,
                    close=new_base,
                    direction="down",
                ))
                base_price = new_base
                diff = price - base_price

        return bricks

    @staticmethod
    def atr_brick_size(bars: list[Bar], period: int = 14) -> float:
        """Calculate ATR-based brick size."""
        if len(bars) < 2:
            return 1.0

        trs = []
        for i in range(1, min(len(bars), period + 1)):
            hl = bars[i].high - bars[i].low
            hc = abs(bars[i].high - bars[i - 1].close)
            lc = abs(bars[i].low - bars[i - 1].close)
            trs.append(max(hl, hc, lc))

        return statistics.mean(trs) if trs else 1.0


# ─── Kagi ────────────────────────────────────────────────────────────────────

class KagiCalculator:
    """Generate Kagi chart lines from price data."""

    @staticmethod
    def calculate(bars: list[Bar], reversal_pct: float = 4.0) -> list[KagiLine]:
        """Generate Kagi lines with percentage reversal."""
        if not bars or reversal_pct <= 0:
            return []

        lines = []
        current_price = bars[0].close
        direction = "yang"
        high_since = current_price
        low_since = current_price

        lines.append(KagiLine(
            timestamp=bars[0].timestamp,
            price=current_price,
            direction=direction,
        ))

        for bar in bars[1:]:
            price = bar.close
            reversal_amount = current_price * (reversal_pct / 100.0)

            if direction == "yang":
                if price > high_since:
                    high_since = price
                    current_price = price
                elif high_since - price >= reversal_amount:
                    # Reversal down
                    lines.append(KagiLine(
                        timestamp=bar.timestamp,
                        price=high_since,
                        direction="yang",
                    ))
                    direction = "yin"
                    current_price = price
                    low_since = price
                    high_since = price
                    lines.append(KagiLine(
                        timestamp=bar.timestamp,
                        price=price,
                        direction="yin",
                        is_reversal=True,
                    ))
            else:
                if price < low_since:
                    low_since = price
                    current_price = price
                elif price - low_since >= reversal_amount:
                    # Reversal up
                    lines.append(KagiLine(
                        timestamp=bar.timestamp,
                        price=low_since,
                        direction="yin",
                    ))
                    direction = "yang"
                    current_price = price
                    high_since = price
                    low_since = price
                    lines.append(KagiLine(
                        timestamp=bar.timestamp,
                        price=price,
                        direction="yang",
                        is_reversal=True,
                    ))

        return lines


# ─── Point & Figure ──────────────────────────────────────────────────────────

class PointAndFigureCalculator:
    """Generate Point & Figure chart columns."""

    @staticmethod
    def calculate(bars: list[Bar], box_size: float = 1.0, reversal: int = 3) -> list[PnFColumn]:
        """Generate PnF columns with box size and reversal count."""
        if not bars or box_size <= 0:
            return []

        columns = []
        current_type = "X"
        current_start = math.floor(bars[0].close / box_size) * box_size
        current_end = current_start
        boxes = 0

        for bar in bars:
            price = bar.close
            rounded = math.floor(price / box_size) * box_size

            if current_type == "X":
                if rounded > current_end:
                    diff_boxes = int((rounded - current_end) / box_size)
                    current_end = rounded
                    boxes += diff_boxes
                elif current_end - rounded >= box_size * reversal:
                    # Save current column and start new O column
                    if boxes > 0:
                        columns.append(PnFColumn(current_start, current_end, current_type, boxes))
                    current_type = "O"
                    current_start = current_end - box_size
                    current_end = rounded
                    boxes = int((current_start - current_end) / box_size)
            else:
                if rounded < current_end:
                    diff_boxes = int((current_end - rounded) / box_size)
                    current_end = rounded
                    boxes += diff_boxes
                elif rounded - current_end >= box_size * reversal:
                    if boxes > 0:
                        columns.append(PnFColumn(current_start, current_end, current_type, boxes))
                    current_type = "X"
                    current_start = current_end + box_size
                    current_end = rounded
                    boxes = int((current_end - current_start) / box_size)

        # Add final column
        if boxes > 0:
            columns.append(PnFColumn(current_start, current_end, current_type, boxes))

        return columns


# ─── Line Break ──────────────────────────────────────────────────────────────

class LineBreakCalculator:
    """Generate Three Line Break chart."""

    @staticmethod
    def calculate(bars: list[Bar], num_lines: int = 3) -> list[Bar]:
        """Generate line break chart."""
        if not bars:
            return []

        result = []
        closes = [bars[0].close]
        current_open = bars[0].open
        current_close = bars[0].close

        result.append(Bar(
            timestamp=bars[0].timestamp,
            open=current_open,
            high=max(current_open, current_close),
            low=min(current_open, current_close),
            close=current_close,
        ))

        for bar in bars[1:]:
            price = bar.close

            if price > current_close:
                # New up line
                new_line = Bar(
                    timestamp=bar.timestamp,
                    open=current_close,
                    high=price,
                    low=current_close,
                    close=price,
                )
                result.append(new_line)
                closes.append(price)
                current_open = current_close
                current_close = price
            elif len(closes) >= num_lines and price < closes[-num_lines]:
                # Reversal down
                new_line = Bar(
                    timestamp=bar.timestamp,
                    open=current_close,
                    high=current_close,
                    low=price,
                    close=price,
                )
                result.append(new_line)
                closes.append(price)
                current_open = current_close
                current_close = price
            elif price < current_close:
                # New down line (if below last close)
                lookback = closes[-num_lines:] if len(closes) >= num_lines else closes
                if price < min(lookback):
                    new_line = Bar(
                        timestamp=bar.timestamp,
                        open=current_close,
                        high=current_close,
                        low=price,
                        close=price,
                    )
                    result.append(new_line)
                    closes.append(price)
                    current_close = price

        return result


# ─── Range Bars ──────────────────────────────────────────────────────────────

class RangeBarCalculator:
    """Generate range bars from tick/bar data."""

    @staticmethod
    def calculate(bars: list[Bar], range_size: float = 1.0) -> list[Bar]:
        """Aggregate into range bars of fixed range size."""
        if not bars or range_size <= 0:
            return []

        result = []
        current_open = bars[0].open
        current_high = bars[0].high
        current_low = bars[0].low
        current_volume = bars[0].volume
        current_time = bars[0].timestamp

        for bar in bars:
            # Update current range bar
            test_high = max(current_high, bar.high)
            test_low = min(current_low, bar.low)

            if test_high - test_low >= range_size:
                # Close current bar
                close_price = current_open + range_size if bar.close >= current_open else current_open - range_size
                result.append(Bar(
                    timestamp=current_time,
                    open=round(current_open, 4),
                    high=round(current_high, 4),
                    low=round(current_low, 4),
                    close=round(close_price, 4),
                    volume=current_volume,
                ))
                # Start new bar
                current_open = close_price
                current_high = max(close_price, bar.close)
                current_low = min(close_price, bar.close)
                current_volume = 0
                current_time = bar.timestamp
            else:
                current_high = test_high
                current_low = test_low
                current_volume += bar.volume

        # Add remaining bar
        if current_volume > 0 or not result:
            result.append(Bar(
                timestamp=current_time,
                open=round(current_open, 4),
                high=round(current_high, 4),
                low=round(current_low, 4),
                close=round(bars[-1].close, 4),
                volume=current_volume,
            ))

        return result


# ─── VWAP Calculator ────────────────────────────────────────────────────────

class VWAPCalculator:
    """Volume Weighted Average Price with deviation bands."""

    @staticmethod
    def calculate(bars: list[Bar], num_deviations: int = 3) -> list[VWAPData]:
        """Calculate VWAP with standard deviation bands."""
        if not bars:
            return []

        result = []
        cum_tp_vol = 0.0
        cum_vol = 0.0
        cum_tp2_vol = 0.0

        for bar in bars:
            tp = (bar.high + bar.low + bar.close) / 3.0
            vol = bar.volume if bar.volume > 0 else 1.0

            cum_tp_vol += tp * vol
            cum_vol += vol
            cum_tp2_vol += (tp ** 2) * vol

            vwap = cum_tp_vol / cum_vol
            # Variance = E[X^2] - E[X]^2
            variance = max(0, cum_tp2_vol / cum_vol - vwap ** 2)
            std_dev = math.sqrt(variance)

            data = VWAPData(
                timestamp=bar.timestamp,
                vwap=vwap,
                upper_1=vwap + std_dev,
                upper_2=vwap + 2 * std_dev,
                upper_3=vwap + 3 * std_dev,
                lower_1=vwap - std_dev,
                lower_2=vwap - 2 * std_dev,
                lower_3=vwap - 3 * std_dev,
            )
            result.append(data)

        return result

    @staticmethod
    def anchored_vwap(bars: list[Bar], anchor_index: int = 0) -> list[VWAPData]:
        """Calculate anchored VWAP from a specific bar."""
        if not bars or anchor_index >= len(bars):
            return []
        return VWAPCalculator.calculate(bars[anchor_index:])


# ─── Pivot Points ───────────────────────────────────────────────────────────

class PivotPointCalculator:
    """Calculate various types of pivot points."""

    @staticmethod
    def standard(high: float, low: float, close: float) -> PivotLevels:
        """Standard pivot points."""
        pivot = (high + low + close) / 3.0
        return PivotLevels(
            pivot=pivot,
            r1=2 * pivot - low,
            r2=pivot + (high - low),
            r3=high + 2 * (pivot - low),
            s1=2 * pivot - high,
            s2=pivot - (high - low),
            s3=low - 2 * (high - pivot),
        )

    @staticmethod
    def fibonacci(high: float, low: float, close: float) -> PivotLevels:
        """Fibonacci pivot points."""
        pivot = (high + low + close) / 3.0
        range_ = high - low
        return PivotLevels(
            pivot=pivot,
            r1=pivot + 0.382 * range_,
            r2=pivot + 0.618 * range_,
            r3=pivot + 1.000 * range_,
            s1=pivot - 0.382 * range_,
            s2=pivot - 0.618 * range_,
            s3=pivot - 1.000 * range_,
        )

    @staticmethod
    def camarilla(high: float, low: float, close: float) -> PivotLevels:
        """Camarilla pivot points."""
        range_ = high - low
        return PivotLevels(
            pivot=(high + low + close) / 3.0,
            r1=close + range_ * 1.1 / 12,
            r2=close + range_ * 1.1 / 6,
            r3=close + range_ * 1.1 / 4,
            r4=close + range_ * 1.1 / 2,
            s1=close - range_ * 1.1 / 12,
            s2=close - range_ * 1.1 / 6,
            s3=close - range_ * 1.1 / 4,
            s4=close - range_ * 1.1 / 2,
        )

    @staticmethod
    def woodie(high: float, low: float, close: float) -> PivotLevels:
        """Woodie pivot points (gives more weight to closing price)."""
        pivot = (high + low + 2 * close) / 4.0
        return PivotLevels(
            pivot=pivot,
            r1=2 * pivot - low,
            r2=pivot + (high - low),
            r3=high + 2 * (pivot - low),
            s1=2 * pivot - high,
            s2=pivot - (high - low),
            s3=low - 2 * (high - pivot),
        )

    @staticmethod
    def demark(high: float, low: float, close: float, open_: float) -> PivotLevels:
        """DeMark pivot points."""
        if close < open_:
            x = high + 2 * low + close
        elif close > open_:
            x = 2 * high + low + close
        else:
            x = high + low + 2 * close
        pivot = x / 4.0
        return PivotLevels(
            pivot=pivot,
            r1=x / 2.0 - low,
            s1=x / 2.0 - high,
        )

    def calculate(self, pivot_type: PivotType, high: float, low: float, close: float,
                  open_: float = 0.0) -> PivotLevels:
        """Dispatch to appropriate pivot type."""
        dispatch = {
            PivotType.STANDARD: lambda: self.standard(high, low, close),
            PivotType.FIBONACCI: lambda: self.fibonacci(high, low, close),
            PivotType.CAMARILLA: lambda: self.camarilla(high, low, close),
            PivotType.WOODIE: lambda: self.woodie(high, low, close),
            PivotType.DEMARK: lambda: self.demark(high, low, close, open_),
        }
        fn = dispatch.get(pivot_type, lambda: self.standard(high, low, close))
        return fn()


# ─── Ichimoku Cloud ─────────────────────────────────────────────────────────

class IchimokuCalculator:
    """Ichimoku Kinko Hyo (Ichimoku Cloud) calculator."""

    @staticmethod
    def _period_midpoint(bars: list[Bar], end: int, period: int) -> float:
        """Highest high + lowest low / 2 over period."""
        start = max(0, end - period + 1)
        segment = bars[start:end + 1]
        if not segment:
            return 0.0
        highest = max(b.high for b in segment)
        lowest = min(b.low for b in segment)
        return (highest + lowest) / 2.0

    @staticmethod
    def calculate(bars: list[Bar], tenkan: int = 9, kijun: int = 26, senkou_b: int = 52) -> list[IchimokuData]:
        """Calculate full Ichimoku indicator."""
        if not bars:
            return []

        n = len(bars)
        result = []

        for i in range(n):
            tenkan_sen = IchimokuCalculator._period_midpoint(bars, i, tenkan)
            kijun_sen = IchimokuCalculator._period_midpoint(bars, i, kijun)
            span_a = (tenkan_sen + kijun_sen) / 2.0
            span_b = IchimokuCalculator._period_midpoint(bars, i, senkou_b)
            chikou = bars[i].close  # Plotted 26 periods back

            result.append(IchimokuData(
                timestamp=bars[i].timestamp,
                tenkan_sen=tenkan_sen,
                kijun_sen=kijun_sen,
                senkou_span_a=span_a,
                senkou_span_b=span_b,
                chikou_span=chikou,
            ))

        return result


# ─── Supertrend ──────────────────────────────────────────────────────────────

class SupertrendCalculator:
    """Supertrend indicator calculator."""

    @staticmethod
    def calculate(bars: list[Bar], period: int = 10, multiplier: float = 3.0) -> list[SupertrendData]:
        """Calculate Supertrend indicator."""
        if len(bars) < period + 1:
            return [SupertrendData(b.timestamp, b.close, 1) for b in bars]

        n = len(bars)
        atr = [0.0] * n
        upper_band = [0.0] * n
        lower_band = [0.0] * n
        supertrend = [0.0] * n
        direction = [1] * n  # 1 = bullish, -1 = bearish

        # Calculate ATR
        trs = []
        for i in range(1, n):
            hl = bars[i].high - bars[i].low
            hc = abs(bars[i].high - bars[i - 1].close)
            lc = abs(bars[i].low - bars[i - 1].close)
            trs.append(max(hl, hc, lc))

            if i >= period:
                atr[i] = statistics.mean(trs[max(0, i - period):i])
            else:
                atr[i] = statistics.mean(trs[:i]) if trs else 0

        # Calculate bands
        for i in range(1, n):
            hl2 = (bars[i].high + bars[i].low) / 2.0
            upper_band[i] = hl2 + multiplier * atr[i]
            lower_band[i] = hl2 - multiplier * atr[i]

            # Adjust bands
            if lower_band[i] > lower_band[i - 1] or bars[i - 1].close < lower_band[i - 1]:
                pass  # Keep current lower band
            else:
                lower_band[i] = lower_band[i - 1]

            if upper_band[i] < upper_band[i - 1] or bars[i - 1].close > upper_band[i - 1]:
                pass  # Keep current upper band
            else:
                upper_band[i] = upper_band[i - 1]

            # Direction
            if i > 0:
                if supertrend[i - 1] == upper_band[i - 1]:
                    direction[i] = -1 if bars[i].close <= upper_band[i] else 1
                else:
                    direction[i] = 1 if bars[i].close >= lower_band[i] else -1

            supertrend[i] = lower_band[i] if direction[i] == 1 else upper_band[i]

        result = []
        for i in range(n):
            result.append(SupertrendData(
                timestamp=bars[i].timestamp,
                supertrend=round(supertrend[i], 4),
                direction=direction[i],
                upper_band=round(upper_band[i], 4),
                lower_band=round(lower_band[i], 4),
            ))

        return result


# ─── Market Profile ─────────────────────────────────────────────────────────

class MarketProfileCalculator:
    """Market Profile (TPO) and Volume Profile analysis."""

    @staticmethod
    def volume_profile(bars: list[Bar], num_levels: int = 50) -> list[MarketProfileData]:
        """Calculate volume profile with POC, VAH, VAL."""
        if not bars:
            return []

        # Find price range
        all_highs = [b.high for b in bars]
        all_lows = [b.low for b in bars]
        price_high = max(all_highs)
        price_low = min(all_lows)
        price_range = price_high - price_low

        if price_range == 0:
            return [MarketProfileData(price_low, len(bars), sum(b.volume for b in bars), is_poc=True)]

        level_size = price_range / num_levels

        # Build volume at each price level
        levels: dict[int, dict] = {}
        for i in range(num_levels):
            levels[i] = {
                "price": price_low + (i + 0.5) * level_size,
                "volume": 0.0,
                "tpo": 0,
            }

        for bar in bars:
            for i in range(num_levels):
                level_low = price_low + i * level_size
                level_high = level_low + level_size
                if bar.low <= level_high and bar.high >= level_low:
                    # Bar overlaps this level
                    overlap = min(bar.high, level_high) - max(bar.low, level_low)
                    bar_range = bar.high - bar.low if bar.high > bar.low else 1.0
                    vol_fraction = overlap / bar_range
                    levels[i]["volume"] += bar.volume * vol_fraction
                    levels[i]["tpo"] += 1

        # Find POC (highest volume level)
        poc_idx = max(levels.keys(), key=lambda k: levels[k]["volume"])

        # Value Area = 70% of volume
        total_volume = sum(levels[k]["volume"] for k in levels)
        va_target = total_volume * 0.70

        va_volume = levels[poc_idx]["volume"]
        va_low_idx = poc_idx
        va_high_idx = poc_idx

        while va_volume < va_target:
            up_vol = levels.get(va_high_idx + 1, {}).get("volume", 0)
            down_vol = levels.get(va_low_idx - 1, {}).get("volume", 0)

            if up_vol == 0 and down_vol == 0:
                break

            if up_vol >= down_vol:
                va_high_idx += 1
                va_volume += up_vol
            else:
                va_low_idx -= 1
                va_volume += down_vol

        result = []
        for i in sorted(levels.keys()):
            data = MarketProfileData(
                price_level=levels[i]["price"],
                tpo_count=levels[i]["tpo"],
                volume=levels[i]["volume"],
                is_poc=(i == poc_idx),
                is_vah=(i == va_high_idx),
                is_val=(i == va_low_idx),
            )
            result.append(data)

        return result

    @staticmethod
    def market_profile_tpo(bars: list[Bar], num_levels: int = 30, tick_size: float = 0.0) -> list[MarketProfileData]:
        """Calculate TPO-based market profile using time periods."""
        if not bars:
            return []

        price_high = max(b.high for b in bars)
        price_low = min(b.low for b in bars)
        price_range = price_high - price_low

        if price_range == 0:
            return [MarketProfileData(price_low, len(bars), sum(b.volume for b in bars), is_poc=True)]

        if tick_size <= 0:
            tick_size = price_range / num_levels

        num_ticks = int(price_range / tick_size) + 1
        tpo_counts = [0] * num_ticks
        volumes = [0.0] * num_ticks

        for bar in bars:
            low_tick = int((bar.low - price_low) / tick_size)
            high_tick = int((bar.high - price_low) / tick_size)
            high_tick = min(high_tick, num_ticks - 1)

            for t in range(low_tick, high_tick + 1):
                tpo_counts[t] += 1
                if high_tick > low_tick:
                    volumes[t] += bar.volume / (high_tick - low_tick + 1)
                else:
                    volumes[t] += bar.volume

        poc_idx = tpo_counts.index(max(tpo_counts)) if tpo_counts else 0

        result = []
        for i in range(num_ticks):
            result.append(MarketProfileData(
                price_level=round(price_low + i * tick_size, 4),
                tpo_count=tpo_counts[i],
                volume=round(volumes[i], 2),
                is_poc=(i == poc_idx),
            ))

        return result


# ─── Orchestrator ────────────────────────────────────────────────────────────

class ChartingCalculationsEngine:
    """Top-level orchestrator for charting calculations."""

    def __init__(self):
        self.heikin_ashi = HeikinAshiCalculator()
        self.renko = RenkoCalculator()
        self.kagi = KagiCalculator()
        self.pnf = PointAndFigureCalculator()
        self.line_break = LineBreakCalculator()
        self.range_bar = RangeBarCalculator()
        self.vwap = VWAPCalculator()
        self.pivot = PivotPointCalculator()
        self.ichimoku = IchimokuCalculator()
        self.supertrend = SupertrendCalculator()
        self.market_profile = MarketProfileCalculator()

    def calculate_heikin_ashi(self, bars: list[Bar]) -> list[dict]:
        return [b.to_dict() for b in self.heikin_ashi.calculate(bars)]

    def calculate_renko(self, bars: list[Bar], brick_size: float = 1.0) -> list[dict]:
        return [b.to_dict() for b in self.renko.calculate(bars, brick_size)]

    def calculate_kagi(self, bars: list[Bar], reversal_pct: float = 4.0) -> list[dict]:
        return [l.to_dict() for l in self.kagi.calculate(bars, reversal_pct)]

    def calculate_pnf(self, bars: list[Bar], box_size: float = 1.0, reversal: int = 3) -> list[dict]:
        return [c.to_dict() for c in self.pnf.calculate(bars, box_size, reversal)]

    def calculate_line_break(self, bars: list[Bar], num_lines: int = 3) -> list[dict]:
        return [b.to_dict() for b in self.line_break.calculate(bars, num_lines)]

    def calculate_range_bars(self, bars: list[Bar], range_size: float = 1.0) -> list[dict]:
        return [b.to_dict() for b in self.range_bar.calculate(bars, range_size)]

    def calculate_vwap(self, bars: list[Bar]) -> list[dict]:
        return [v.to_dict() for v in self.vwap.calculate(bars)]

    def calculate_anchored_vwap(self, bars: list[Bar], anchor_index: int = 0) -> list[dict]:
        return [v.to_dict() for v in self.vwap.anchored_vwap(bars, anchor_index)]

    def calculate_pivots(self, pivot_type: PivotType, high: float, low: float, close: float,
                          open_: float = 0.0) -> dict:
        return self.pivot.calculate(pivot_type, high, low, close, open_).to_dict()

    def calculate_ichimoku(self, bars: list[Bar], tenkan: int = 9, kijun: int = 26, senkou_b: int = 52) -> list[dict]:
        return [d.to_dict() for d in self.ichimoku.calculate(bars, tenkan, kijun, senkou_b)]

    def calculate_supertrend(self, bars: list[Bar], period: int = 10, multiplier: float = 3.0) -> list[dict]:
        return [d.to_dict() for d in self.supertrend.calculate(bars, period, multiplier)]

    def calculate_volume_profile(self, bars: list[Bar], num_levels: int = 50) -> list[dict]:
        return [d.to_dict() for d in self.market_profile.volume_profile(bars, num_levels)]

    def calculate_market_profile(self, bars: list[Bar], num_levels: int = 30) -> list[dict]:
        return [d.to_dict() for d in self.market_profile.market_profile_tpo(bars, num_levels)]

    def capabilities(self) -> dict:
        return {
            "engine": "ChartingCalculationsEngine",
            "chart_types": [ct.value for ct in ChartType],
            "pivot_types": [pt.value for pt in PivotType],
            "features": [
                "heikin_ashi", "renko", "kagi", "point_and_figure",
                "line_break", "range_bars", "vwap_with_bands",
                "anchored_vwap", "pivot_points_5_types",
                "ichimoku_cloud", "supertrend",
                "volume_profile", "market_profile_tpo",
            ],
        }
