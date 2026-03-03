"""
Strategy Engine — Full strategy definition, backtesting, optimization & walk-forward
======================================================================================
Covers tasks.md §3.1–§3.4:
  §3.1 Strategy Definition (Pine Script parser, visual builder, conditions, multi-TF)
  §3.2 Backtest Execution (event/vector engine, slippage, commissions, margin)
  §3.3 Performance Analytics (Sharpe, Sortino, Calmar, drawdown, trade log, equity curve)
  §3.4 Strategy Optimization (grid search, genetic, walk-forward, Monte Carlo, cluster)

Uses real keys from keys.env: Alpaca for execution, Polygon/yfinance for data.
"""

from __future__ import annotations
import asyncio
import math
import os
import json
import hashlib
import time
import statistics
import itertools
import random
import re
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, date
from enum import Enum, auto
from typing import (
    Any, Callable, Dict, List, Optional, Sequence, Set, Tuple, Union
)
import logging

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class Side(Enum):
    LONG = "long"
    SHORT = "short"

class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"

class TimeInForce(Enum):
    DAY = "day"
    GTC = "gtc"
    IOC = "ioc"
    FOK = "fok"

class SignalType(Enum):
    ENTRY_LONG = "entry_long"
    ENTRY_SHORT = "entry_short"
    EXIT_LONG = "exit_long"
    EXIT_SHORT = "exit_short"
    SCALE_IN = "scale_in"
    SCALE_OUT = "scale_out"

class BarField(Enum):
    OPEN = "open"
    HIGH = "high"
    LOW = "low"
    CLOSE = "close"
    VOLUME = "volume"
    VWAP = "vwap"
    HL2 = "hl2"
    HLC3 = "hlc3"
    OHLC4 = "ohlc4"

class Timeframe(Enum):
    M1   = "1m"
    M5   = "5m"
    M15  = "15m"
    M30  = "30m"
    H1   = "1h"
    H4   = "4h"
    D1   = "1D"
    W1   = "1W"
    MN1  = "1M"

@dataclass
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: float = 0.0

    @property
    def hl2(self) -> float:
        return (self.high + self.low) / 2

    @property
    def hlc3(self) -> float:
        return (self.high + self.low + self.close) / 3

    @property
    def ohlc4(self) -> float:
        return (self.open + self.high + self.low + self.close) / 4

    def field(self, f: BarField) -> float:
        mapping = {
            BarField.OPEN: self.open, BarField.HIGH: self.high,
            BarField.LOW: self.low, BarField.CLOSE: self.close,
            BarField.VOLUME: self.volume, BarField.VWAP: self.vwap,
            BarField.HL2: self.hl2, BarField.HLC3: self.hlc3,
            BarField.OHLC4: self.ohlc4,
        }
        return mapping.get(f, self.close)

@dataclass
class Signal:
    timestamp: datetime
    signal_type: SignalType
    symbol: str
    price: float
    quantity: float = 0.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Fill:
    timestamp: datetime
    symbol: str
    side: Side
    price: float
    quantity: float
    commission: float = 0.0
    slippage: float = 0.0
    order_type: OrderType = OrderType.MARKET

@dataclass
class Trade:
    entry_time: datetime
    exit_time: Optional[datetime]
    symbol: str
    side: Side
    entry_price: float
    exit_price: Optional[float]
    quantity: float
    pnl: float = 0.0
    pnl_pct: float = 0.0
    commission: float = 0.0
    slippage: float = 0.0
    bars_held: int = 0
    max_favorable: float = 0.0
    max_adverse: float = 0.0
    r_multiple: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Position:
    symbol: str
    side: Side
    quantity: float
    avg_price: float
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0
    entry_time: Optional[datetime] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

@dataclass
class PortfolioState:
    timestamp: datetime
    cash: float
    equity: float
    positions: Dict[str, Position] = field(default_factory=dict)
    margin_used: float = 0.0
    buying_power: float = 0.0
    drawdown: float = 0.0
    peak_equity: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# §3.1 — STRATEGY DEFINITION
# ═══════════════════════════════════════════════════════════════════════════════

class IndicatorNode:
    """Represents a computed indicator in the strategy graph."""
    def __init__(self, name: str, func: Callable, params: Dict[str, Any],
                 source: BarField = BarField.CLOSE):
        self.name = name
        self.func = func
        self.params = params
        self.source = source
        self.values: List[float] = []

    def compute(self, bars: List[Bar]) -> List[float]:
        data = [b.field(self.source) for b in bars]
        self.values = self.func(data, **self.params)
        return self.values

    def last(self, offset: int = 0) -> float:
        idx = len(self.values) - 1 - offset
        return self.values[idx] if 0 <= idx < len(self.values) else float('nan')


class Condition:
    """A boolean condition comparing indicators/values."""
    def __init__(self, left: str, operator: str, right: Union[str, float],
                 delay: int = 0):
        self.left = left
        self.operator = operator
        self.right = right
        self.delay = delay

    def evaluate(self, context: Dict[str, Any]) -> bool:
        lval = self._resolve(self.left, context)
        rval = self._resolve(self.right, context) if isinstance(self.right, str) else self.right
        if math.isnan(lval) or (isinstance(rval, float) and math.isnan(rval)):
            return False
        ops = {
            '>': lambda a, b: a > b,
            '<': lambda a, b: a < b,
            '>=': lambda a, b: a >= b,
            '<=': lambda a, b: a <= b,
            '==': lambda a, b: abs(a - b) < 1e-10,
            '!=': lambda a, b: abs(a - b) >= 1e-10,
            'crosses_above': lambda a, b: a > b,  # Simplified; full requires prev
            'crosses_below': lambda a, b: a < b,
        }
        return ops.get(self.operator, lambda a, b: False)(lval, rval)

    def _resolve(self, name: str, context: Dict[str, Any]) -> float:
        if name in context:
            v = context[name]
            return v if isinstance(v, (int, float)) else float('nan')
        parts = name.split('[')
        if len(parts) == 2:
            ind_name = parts[0]
            offset = int(parts[1].rstrip(']'))
            ind = context.get(f'_ind_{ind_name}')
            if ind and hasattr(ind, 'last'):
                return ind.last(offset)
        return float('nan')


class ConditionGroup:
    """AND/OR group of conditions."""
    def __init__(self, conditions: List[Condition], logic: str = 'AND'):
        self.conditions = conditions
        self.logic = logic

    def evaluate(self, context: Dict[str, Any]) -> bool:
        if self.logic == 'AND':
            return all(c.evaluate(context) for c in self.conditions)
        return any(c.evaluate(context) for c in self.conditions)


class StrategyRule:
    """A complete entry/exit rule with conditions and actions."""
    def __init__(self, name: str, signal_type: SignalType,
                 conditions: ConditionGroup,
                 position_size: Union[float, str] = 1.0,
                 order_type: OrderType = OrderType.MARKET,
                 limit_offset: float = 0.0,
                 stop_loss_pct: Optional[float] = None,
                 take_profit_pct: Optional[float] = None,
                 trail_stop_pct: Optional[float] = None,
                 max_positions: int = 1,
                 cooldown_bars: int = 0,
                 timeframe_filter: Optional[List[Timeframe]] = None):
        self.name = name
        self.signal_type = signal_type
        self.conditions = conditions
        self.position_size = position_size
        self.order_type = order_type
        self.limit_offset = limit_offset
        self.stop_loss_pct = stop_loss_pct
        self.take_profit_pct = take_profit_pct
        self.trail_stop_pct = trail_stop_pct
        self.max_positions = max_positions
        self.cooldown_bars = cooldown_bars
        self.timeframe_filter = timeframe_filter
        self._last_triggered: int = -999


# ── Built-in Indicator Functions ──────────────────────────────────────────────

def _sma(data: List[float], period: int = 20) -> List[float]:
    result = [float('nan')] * len(data)
    for i in range(period - 1, len(data)):
        result[i] = sum(data[i - period + 1:i + 1]) / period
    return result

def _ema(data: List[float], period: int = 20) -> List[float]:
    result = [float('nan')] * len(data)
    if len(data) < period:
        return result
    k = 2.0 / (period + 1)
    result[period - 1] = sum(data[:period]) / period
    for i in range(period, len(data)):
        result[i] = data[i] * k + result[i - 1] * (1 - k)
    return result

def _wma(data: List[float], period: int = 20) -> List[float]:
    result = [float('nan')] * len(data)
    denom = period * (period + 1) / 2
    for i in range(period - 1, len(data)):
        wsum = sum(data[i - period + 1 + j] * (j + 1) for j in range(period))
        result[i] = wsum / denom
    return result

def _dema(data: List[float], period: int = 20) -> List[float]:
    e1 = _ema(data, period)
    e2 = _ema([x for x in e1 if not math.isnan(x)], period)
    result = [float('nan')] * len(data)
    offset = len(data) - len(e2)
    for i in range(len(e2)):
        idx = offset + i
        if idx < len(e1) and not math.isnan(e1[idx]):
            result[idx] = 2 * e1[idx] - e2[i]
    return result

def _tema(data: List[float], period: int = 20) -> List[float]:
    e1 = _ema(data, period)
    valid1 = [x for x in e1 if not math.isnan(x)]
    e2 = _ema(valid1, period)
    valid2 = [x for x in e2 if not math.isnan(x)]
    e3 = _ema(valid2, period)
    result = [float('nan')] * len(data)
    off1 = len(data) - len(valid1)
    off2 = len(data) - len(valid2)
    off3 = len(data) - len(e3)
    for i in range(len(e3)):
        idx = off3 + i
        i1 = idx - off1
        i2 = idx - off2
        if 0 <= i1 < len(valid1) and 0 <= i2 < len(valid2):
            result[idx] = 3 * valid1[i1] - 3 * valid2[i2] + e3[i]
    return result

def _hull_ma(data: List[float], period: int = 20) -> List[float]:
    half = max(1, period // 2)
    wma_half = _wma(data, half)
    wma_full = _wma(data, period)
    diff = []
    for i in range(len(data)):
        if math.isnan(wma_half[i]) or math.isnan(wma_full[i]):
            diff.append(float('nan'))
        else:
            diff.append(2 * wma_half[i] - wma_full[i])
    sqrt_p = max(1, int(math.sqrt(period)))
    valid = [x for x in diff if not math.isnan(x)]
    hull = _wma(valid, sqrt_p)
    result = [float('nan')] * len(data)
    offset = len(data) - len(hull)
    for i in range(len(hull)):
        result[offset + i] = hull[i]
    return result

def _rsi(data: List[float], period: int = 14) -> List[float]:
    result = [float('nan')] * len(data)
    if len(data) < period + 1:
        return result
    gains, losses = [], []
    for i in range(1, len(data)):
        d = data[i] - data[i - 1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    if avg_loss == 0:
        result[period] = 100.0
    else:
        result[period] = 100 - 100 / (1 + avg_gain / avg_loss)
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            result[i + 1] = 100.0
        else:
            result[i + 1] = 100 - 100 / (1 + avg_gain / avg_loss)
    return result

def _macd(data: List[float], fast: int = 12, slow: int = 26,
          signal: int = 9) -> List[float]:
    ema_fast = _ema(data, fast)
    ema_slow = _ema(data, slow)
    macd_line = []
    for i in range(len(data)):
        if math.isnan(ema_fast[i]) or math.isnan(ema_slow[i]):
            macd_line.append(float('nan'))
        else:
            macd_line.append(ema_fast[i] - ema_slow[i])
    valid = [x for x in macd_line if not math.isnan(x)]
    sig_line = _ema(valid, signal)
    result = [float('nan')] * len(data)
    offset = len(data) - len(sig_line)
    for i in range(len(sig_line)):
        result[offset + i] = sig_line[i]
    return result

def _bollinger_bands(data: List[float], period: int = 20,
                     std_dev: float = 2.0) -> List[float]:
    sma = _sma(data, period)
    result = [float('nan')] * len(data)
    for i in range(period - 1, len(data)):
        window = data[i - period + 1:i + 1]
        sd = statistics.stdev(window) if len(window) > 1 else 0
        result[i] = sma[i] + std_dev * sd  # Upper band
    return result

def _atr(data: List[float], period: int = 14, highs: Optional[List[float]] = None,
         lows: Optional[List[float]] = None) -> List[float]:
    h = highs or data
    l = lows or data
    result = [float('nan')] * len(data)
    if len(data) < 2:
        return result
    tr = [h[0] - l[0]]
    for i in range(1, len(data)):
        tr.append(max(h[i] - l[i], abs(h[i] - data[i - 1]), abs(l[i] - data[i - 1])))
    if len(tr) < period:
        return result
    atr_val = sum(tr[:period]) / period
    result[period - 1] = atr_val
    for i in range(period, len(tr)):
        atr_val = (atr_val * (period - 1) + tr[i]) / period
        result[i] = atr_val
    return result

def _stochastic(data: List[float], period: int = 14, smooth_k: int = 3,
                smooth_d: int = 3) -> List[float]:
    result = [float('nan')] * len(data)
    raw_k = [float('nan')] * len(data)
    for i in range(period - 1, len(data)):
        window = data[i - period + 1:i + 1]
        lo, hi = min(window), max(window)
        raw_k[i] = ((data[i] - lo) / (hi - lo) * 100) if hi != lo else 50
    k = _sma(raw_k, smooth_k)
    return _sma(k, smooth_d)

def _cci(data: List[float], period: int = 20) -> List[float]:
    result = [float('nan')] * len(data)
    for i in range(period - 1, len(data)):
        window = data[i - period + 1:i + 1]
        mean = sum(window) / period
        mad = sum(abs(x - mean) for x in window) / period
        result[i] = (data[i] - mean) / (0.015 * mad) if mad != 0 else 0
    return result

def _williams_r(data: List[float], period: int = 14) -> List[float]:
    result = [float('nan')] * len(data)
    for i in range(period - 1, len(data)):
        window = data[i - period + 1:i + 1]
        hi, lo = max(window), min(window)
        result[i] = ((hi - data[i]) / (hi - lo) * -100) if hi != lo else -50
    return result

def _roc(data: List[float], period: int = 12) -> List[float]:
    result = [float('nan')] * len(data)
    for i in range(period, len(data)):
        if data[i - period] != 0:
            result[i] = ((data[i] - data[i - period]) / data[i - period]) * 100
    return result

def _momentum(data: List[float], period: int = 10) -> List[float]:
    result = [float('nan')] * len(data)
    for i in range(period, len(data)):
        result[i] = data[i] - data[i - period]
    return result

def _adx(data: List[float], period: int = 14, highs: Optional[List[float]] = None,
         lows: Optional[List[float]] = None) -> List[float]:
    h = highs or data
    l = lows or data
    result = [float('nan')] * len(data)
    if len(data) < period + 1:
        return result
    plus_dm, minus_dm, tr_list = [], [], []
    for i in range(1, len(data)):
        up = h[i] - h[i - 1]
        dn = l[i - 1] - l[i]
        plus_dm.append(up if up > dn and up > 0 else 0)
        minus_dm.append(dn if dn > up and dn > 0 else 0)
        tr_list.append(max(h[i] - l[i], abs(h[i] - data[i - 1]), abs(l[i] - data[i - 1])))
    atr_val = sum(tr_list[:period]) / period
    plus_di_val = (sum(plus_dm[:period]) / period) / atr_val * 100 if atr_val else 0
    minus_di_val = (sum(minus_dm[:period]) / period) / atr_val * 100 if atr_val else 0
    dx_list = []
    di_sum = plus_di_val + minus_di_val
    dx_list.append(abs(plus_di_val - minus_di_val) / di_sum * 100 if di_sum else 0)
    smoothed_plus = sum(plus_dm[:period])
    smoothed_minus = sum(minus_dm[:period])
    smoothed_tr = sum(tr_list[:period])
    for i in range(period, len(tr_list)):
        smoothed_plus = smoothed_plus - smoothed_plus / period + plus_dm[i]
        smoothed_minus = smoothed_minus - smoothed_minus / period + minus_dm[i]
        smoothed_tr = smoothed_tr - smoothed_tr / period + tr_list[i]
        if smoothed_tr == 0:
            dx_list.append(0)
            continue
        pdi = (smoothed_plus / smoothed_tr) * 100
        mdi = (smoothed_minus / smoothed_tr) * 100
        s = pdi + mdi
        dx_list.append(abs(pdi - mdi) / s * 100 if s else 0)
    if len(dx_list) < period:
        return result
    adx_val = sum(dx_list[:period]) / period
    result[2 * period - 1] = adx_val
    for i in range(period, len(dx_list)):
        adx_val = (adx_val * (period - 1) + dx_list[i]) / period
        idx = i + period
        if idx < len(result):
            result[idx] = adx_val
    return result

def _obv(data: List[float], volume: Optional[List[float]] = None) -> List[float]:
    vol = volume or [1.0] * len(data)
    result = [0.0]
    for i in range(1, len(data)):
        if data[i] > data[i - 1]:
            result.append(result[-1] + vol[i])
        elif data[i] < data[i - 1]:
            result.append(result[-1] - vol[i])
        else:
            result.append(result[-1])
    return result

def _vwap(data: List[float], volume: Optional[List[float]] = None,
          highs: Optional[List[float]] = None,
          lows: Optional[List[float]] = None) -> List[float]:
    vol = volume or [1.0] * len(data)
    h = highs or data
    l = lows or data
    result = [float('nan')] * len(data)
    cum_vol = 0.0
    cum_tp_vol = 0.0
    for i in range(len(data)):
        tp = (h[i] + l[i] + data[i]) / 3
        cum_vol += vol[i]
        cum_tp_vol += tp * vol[i]
        result[i] = cum_tp_vol / cum_vol if cum_vol else tp
    return result

def _parabolic_sar(data: List[float], af_start: float = 0.02,
                   af_step: float = 0.02, af_max: float = 0.2,
                   highs: Optional[List[float]] = None,
                   lows: Optional[List[float]] = None) -> List[float]:
    h = highs or data
    l = lows or data
    n = len(data)
    result = [float('nan')] * n
    if n < 2:
        return result
    bull = True
    sar = l[0]
    ep = h[0]
    af = af_start
    result[0] = sar
    for i in range(1, n):
        prev_sar = sar
        sar = prev_sar + af * (ep - prev_sar)
        if bull:
            sar = min(sar, l[i - 1])
            if i >= 2:
                sar = min(sar, l[i - 2])
            if l[i] < sar:
                bull = False
                sar = ep
                ep = l[i]
                af = af_start
            else:
                if h[i] > ep:
                    ep = h[i]
                    af = min(af + af_step, af_max)
        else:
            sar = max(sar, h[i - 1])
            if i >= 2:
                sar = max(sar, h[i - 2])
            if h[i] > sar:
                bull = True
                sar = ep
                ep = h[i]
                af = af_start
            else:
                if l[i] < ep:
                    ep = l[i]
                    af = min(af + af_step, af_max)
        result[i] = sar
    return result

def _supertrend(data: List[float], period: int = 10, multiplier: float = 3.0,
                highs: Optional[List[float]] = None,
                lows: Optional[List[float]] = None) -> List[float]:
    h = highs or data
    l = lows or data
    n = len(data)
    atr = _atr(data, period, h, l)
    result = [float('nan')] * n
    upper_band = [float('nan')] * n
    lower_band = [float('nan')] * n
    supertrend = [float('nan')] * n
    direction = [1] * n
    for i in range(period, n):
        if math.isnan(atr[i]):
            continue
        hl2 = (h[i] + l[i]) / 2
        upper_band[i] = hl2 + multiplier * atr[i]
        lower_band[i] = hl2 - multiplier * atr[i]
        if i > period and not math.isnan(upper_band[i - 1]):
            if upper_band[i] > upper_band[i - 1] or data[i - 1] > upper_band[i - 1]:
                pass
            else:
                upper_band[i] = upper_band[i - 1]
            if lower_band[i] < lower_band[i - 1] or data[i - 1] < lower_band[i - 1]:
                pass
            else:
                lower_band[i] = lower_band[i - 1]
        if i == period:
            direction[i] = 1
        elif not math.isnan(supertrend[i - 1]):
            if supertrend[i - 1] == upper_band[i - 1]:
                direction[i] = -1 if data[i] > upper_band[i] else 1
            else:
                direction[i] = 1 if data[i] < lower_band[i] else -1
        supertrend[i] = lower_band[i] if direction[i] == -1 else upper_band[i]
        result[i] = supertrend[i]
    return result

def _ichimoku_tenkan(data: List[float], period: int = 9) -> List[float]:
    result = [float('nan')] * len(data)
    for i in range(period - 1, len(data)):
        window = data[i - period + 1:i + 1]
        result[i] = (max(window) + min(window)) / 2
    return result


INDICATOR_REGISTRY: Dict[str, Callable] = {
    'SMA': _sma, 'EMA': _ema, 'WMA': _wma, 'DEMA': _dema, 'TEMA': _tema,
    'HullMA': _hull_ma, 'RSI': _rsi, 'MACD': _macd,
    'BollingerBands': _bollinger_bands, 'ATR': _atr,
    'Stochastic': _stochastic, 'CCI': _cci, 'WilliamsR': _williams_r,
    'ROC': _roc, 'Momentum': _momentum, 'ADX': _adx, 'OBV': _obv,
    'VWAP': _vwap, 'ParabolicSAR': _parabolic_sar,
    'Supertrend': _supertrend, 'IchimokuTenkan': _ichimoku_tenkan,
}


# ── Pine Script ↔ JSON Strategy Parser ───────────────────────────────────────

class PineScriptParser:
    """Parse a subset of Pine Script into strategy rules."""

    PINE_FUNCTIONS = {
        'ta.sma': ('SMA', ['period']),
        'ta.ema': ('EMA', ['period']),
        'ta.wma': ('WMA', ['period']),
        'ta.rsi': ('RSI', ['period']),
        'ta.macd': ('MACD', ['fast', 'slow', 'signal']),
        'ta.atr': ('ATR', ['period']),
        'ta.cci': ('CCI', ['period']),
        'ta.stoch': ('Stochastic', ['period', 'smooth_k', 'smooth_d']),
        'ta.supertrend': ('Supertrend', ['period', 'multiplier']),
        'ta.obv': ('OBV', []),
        'ta.vwap': ('VWAP', []),
        'ta.bb': ('BollingerBands', ['period', 'std_dev']),
        'ta.adx': ('ADX', ['period']),
        'ta.roc': ('ROC', ['period']),
        'ta.mom': ('Momentum', ['period']),
        'ta.sar': ('ParabolicSAR', ['af_start', 'af_step', 'af_max']),
        'ta.wpr': ('WilliamsR', ['period']),
    }

    def __init__(self):
        self.indicators: List[IndicatorNode] = []
        self.rules: List[StrategyRule] = []
        self.variables: Dict[str, Any] = {}

    def parse(self, script: str) -> 'StrategyDefinition':
        lines = script.strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line or line.startswith('//'):
                continue
            if '=' in line and not line.startswith('strategy.') and not line.startswith('if '):
                self._parse_assignment(line)
            elif line.startswith('strategy.entry'):
                self._parse_entry(line)
            elif line.startswith('strategy.close'):
                self._parse_exit(line)
            elif line.startswith('strategy.exit'):
                self._parse_stop_target(line)

        return StrategyDefinition(
            name="PineScript Strategy",
            indicators=self.indicators,
            rules=self.rules,
            params=self.variables,
        )

    def _parse_assignment(self, line: str):
        parts = line.split('=', 1)
        if len(parts) != 2:
            return
        var_name = parts[0].strip()
        expr = parts[1].strip()
        for pine_fn, (ind_name, param_names) in self.PINE_FUNCTIONS.items():
            if pine_fn in expr:
                params = self._extract_params(expr, param_names)
                source = BarField.CLOSE
                if 'close' in expr:
                    source = BarField.CLOSE
                elif 'open' in expr:
                    source = BarField.OPEN
                elif 'high' in expr:
                    source = BarField.HIGH
                elif 'low' in expr:
                    source = BarField.LOW
                elif 'hl2' in expr:
                    source = BarField.HL2
                elif 'hlc3' in expr:
                    source = BarField.HLC3
                func = INDICATOR_REGISTRY.get(ind_name, _sma)
                node = IndicatorNode(var_name, func, params, source)
                self.indicators.append(node)
                self.variables[var_name] = node
                return
        # Simple numeric or cross reference
        try:
            self.variables[var_name] = float(expr)
        except ValueError:
            self.variables[var_name] = expr

    def _extract_params(self, expr: str, param_names: List[str]) -> Dict[str, Any]:
        params: Dict[str, Any] = {}
        match = re.search(r'\(([^)]+)\)', expr)
        if match:
            args = match.group(1).split(',')
            for i, arg in enumerate(args):
                arg = arg.strip()
                if '=' in arg:
                    k, v = arg.split('=', 1)
                    try:
                        params[k.strip()] = float(v.strip())
                    except ValueError:
                        params[k.strip()] = v.strip()
                elif i < len(param_names):
                    try:
                        params[param_names[i]] = float(arg)
                    except ValueError:
                        pass
        return params

    def _parse_entry(self, line: str):
        signal = SignalType.ENTRY_LONG if 'long' in line.lower() else SignalType.ENTRY_SHORT
        name = re.search(r'"([^"]+)"', line)
        rule_name = name.group(1) if name else "Entry"
        rule = StrategyRule(
            name=rule_name,
            signal_type=signal,
            conditions=ConditionGroup([]),
        )
        self.rules.append(rule)

    def _parse_exit(self, line: str):
        signal = SignalType.EXIT_LONG if 'long' in line.lower() else SignalType.EXIT_SHORT
        name = re.search(r'"([^"]+)"', line)
        rule_name = name.group(1) if name else "Exit"
        rule = StrategyRule(
            name=rule_name,
            signal_type=signal,
            conditions=ConditionGroup([]),
        )
        self.rules.append(rule)

    def _parse_stop_target(self, line: str):
        stop = re.search(r'stop\s*=\s*([\d.]+)', line)
        limit = re.search(r'limit\s*=\s*([\d.]+)', line)
        if stop:
            logger.info(f"Stop parsed: {stop.group(1)}")
        if limit:
            logger.info(f"Limit parsed: {limit.group(1)}")


# ── Visual Strategy Builder JSON Schema ──────────────────────────────────────

class VisualStrategyBuilder:
    """Build strategies from JSON visual builder format."""

    @staticmethod
    def from_json(config: Dict[str, Any]) -> 'StrategyDefinition':
        indicators = []
        rules = []
        for ind_cfg in config.get('indicators', []):
            name = ind_cfg['name']
            func_name = ind_cfg.get('function', 'SMA')
            params = ind_cfg.get('params', {})
            source = BarField[ind_cfg.get('source', 'CLOSE').upper()]
            func = INDICATOR_REGISTRY.get(func_name, _sma)
            indicators.append(IndicatorNode(name, func, params, source))
        for rule_cfg in config.get('rules', []):
            conditions = []
            for cond in rule_cfg.get('conditions', []):
                conditions.append(Condition(
                    left=cond['left'],
                    operator=cond['operator'],
                    right=cond.get('right', 0),
                    delay=cond.get('delay', 0),
                ))
            rules.append(StrategyRule(
                name=rule_cfg.get('name', 'Rule'),
                signal_type=SignalType[rule_cfg.get('signal', 'ENTRY_LONG').upper()],
                conditions=ConditionGroup(conditions, rule_cfg.get('logic', 'AND')),
                position_size=rule_cfg.get('position_size', 1.0),
                order_type=OrderType[rule_cfg.get('order_type', 'MARKET').upper()],
                stop_loss_pct=rule_cfg.get('stop_loss_pct'),
                take_profit_pct=rule_cfg.get('take_profit_pct'),
                trail_stop_pct=rule_cfg.get('trail_stop_pct'),
                max_positions=rule_cfg.get('max_positions', 1),
                cooldown_bars=rule_cfg.get('cooldown_bars', 0),
            ))
        return StrategyDefinition(
            name=config.get('name', 'Visual Strategy'),
            indicators=indicators,
            rules=rules,
            params=config.get('params', {}),
        )


@dataclass
class StrategyDefinition:
    name: str
    indicators: List[IndicatorNode]
    rules: List[StrategyRule]
    params: Dict[str, Any] = field(default_factory=dict)
    symbols: List[str] = field(default_factory=lambda: ['SPY'])
    timeframe: Timeframe = Timeframe.D1
    initial_capital: float = 100_000.0
    commission_pct: float = 0.001
    slippage_pct: float = 0.0005
    margin_requirement: float = 1.0  # 1.0 = no margin
    max_drawdown_pct: float = 0.25
    risk_per_trade_pct: float = 0.02
    max_positions: int = 10
    pyramid_max: int = 1


# ═══════════════════════════════════════════════════════════════════════════════
# §3.2 — BACKTEST EXECUTION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class SlippageModel:
    """Configurable slippage model."""
    def __init__(self, fixed_pct: float = 0.0005, volume_impact: float = 0.1,
                 spread_bps: float = 1.0):
        self.fixed_pct = fixed_pct
        self.volume_impact = volume_impact
        self.spread_bps = spread_bps

    def estimate(self, price: float, quantity: float, avg_volume: float,
                 side: Side) -> float:
        fixed_slip = price * self.fixed_pct
        vol_ratio = quantity / max(avg_volume, 1)
        vol_slip = price * self.volume_impact * vol_ratio
        spread_slip = price * self.spread_bps / 10_000
        total = fixed_slip + vol_slip + spread_slip
        return total if side == Side.LONG else -total


class CommissionModel:
    """Configurable commission model."""
    def __init__(self, pct: float = 0.001, min_fee: float = 0.0,
                 per_share: float = 0.0, per_contract: float = 0.0):
        self.pct = pct
        self.min_fee = min_fee
        self.per_share = per_share
        self.per_contract = per_contract

    def calculate(self, price: float, quantity: float) -> float:
        pct_fee = price * quantity * self.pct
        share_fee = quantity * self.per_share
        return max(pct_fee + share_fee, self.min_fee)


class MarginModel:
    """Margin and leverage tracking."""
    def __init__(self, initial_margin: float = 0.5, maintenance_margin: float = 0.25,
                 max_leverage: float = 4.0):
        self.initial_margin = initial_margin
        self.maintenance_margin = maintenance_margin
        self.max_leverage = max_leverage
        self.margin_calls: List[Dict[str, Any]] = []

    def check_margin(self, portfolio: PortfolioState) -> bool:
        if portfolio.equity <= 0:
            return False
        leverage = portfolio.margin_used / portfolio.equity if portfolio.equity > 0 else 999
        if leverage > self.max_leverage:
            self.margin_calls.append({
                'time': portfolio.timestamp.isoformat(),
                'leverage': leverage,
                'equity': portfolio.equity,
                'margin_used': portfolio.margin_used,
            })
            return False
        return True

    def required_margin(self, price: float, quantity: float) -> float:
        return price * quantity * self.initial_margin


class BacktestEngine:
    """Event-driven backtesting engine with full lifecycle support."""

    def __init__(self, strategy: StrategyDefinition,
                 slippage: Optional[SlippageModel] = None,
                 commission: Optional[CommissionModel] = None,
                 margin: Optional[MarginModel] = None):
        self.strategy = strategy
        self.slippage = slippage or SlippageModel(strategy.slippage_pct)
        self.commission = commission or CommissionModel(strategy.commission_pct)
        self.margin = margin or MarginModel()

        # State
        self.cash = strategy.initial_capital
        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self.fills: List[Fill] = []
        self.signals: List[Signal] = []
        self.equity_curve: List[Tuple[datetime, float]] = []
        self.portfolio_states: List[PortfolioState] = []
        self.bar_index = 0
        self.peak_equity = strategy.initial_capital
        self.max_drawdown = 0.0
        self._open_trades: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def run(self, bars_by_symbol: Dict[str, List[Bar]]) -> 'BacktestResult':
        """Run the complete backtest."""
        start_time = time.time()
        symbols = list(bars_by_symbol.keys())
        if not symbols:
            raise ValueError("No bar data provided")

        # Determine shared timeline
        max_bars = max(len(bars) for bars in bars_by_symbol.values())
        primary = symbols[0]
        primary_bars = bars_by_symbol[primary]

        # Compute all indicators on primary
        for ind in self.strategy.indicators:
            ind.compute(primary_bars)

        # Event loop
        for i in range(max_bars):
            self.bar_index = i
            current_bar = primary_bars[i] if i < len(primary_bars) else None
            if current_bar is None:
                continue

            # Build context
            context = self._build_context(i, current_bar, bars_by_symbol)

            # Update open positions with current prices
            self._update_positions(current_bar, bars_by_symbol)

            # Check stop-losses and take-profits
            self._check_sl_tp(current_bar, bars_by_symbol)

            # Evaluate rules
            for rule in self.strategy.rules:
                if rule.cooldown_bars > 0 and (i - rule._last_triggered) < rule.cooldown_bars:
                    continue
                if rule.conditions.evaluate(context):
                    self._execute_signal(rule, current_bar, i)
                    rule._last_triggered = i

            # Record equity
            equity = self._compute_equity(bars_by_symbol, i)
            self.equity_curve.append((current_bar.timestamp, equity))
            self.peak_equity = max(self.peak_equity, equity)
            dd = (self.peak_equity - equity) / self.peak_equity if self.peak_equity > 0 else 0
            self.max_drawdown = max(self.max_drawdown, dd)

            # Max drawdown circuit breaker
            if dd > self.strategy.max_drawdown_pct:
                self._close_all_positions(current_bar, bars_by_symbol, i, "Max DD breached")
                break

            # Record portfolio state
            state = PortfolioState(
                timestamp=current_bar.timestamp,
                cash=self.cash,
                equity=equity,
                positions=dict(self.positions),
                margin_used=sum(p.avg_price * p.quantity for p in self.positions.values()),
                buying_power=self.cash * self.margin.max_leverage,
                drawdown=dd,
                peak_equity=self.peak_equity,
            )
            self.portfolio_states.append(state)

        # Close remaining positions at last bar
        if primary_bars:
            last_bar = primary_bars[-1]
            self._close_all_positions(last_bar, bars_by_symbol, len(primary_bars) - 1, "Backtest end")

        elapsed = time.time() - start_time
        return BacktestResult(
            strategy_name=self.strategy.name,
            start_date=primary_bars[0].timestamp if primary_bars else datetime.now(),
            end_date=primary_bars[-1].timestamp if primary_bars else datetime.now(),
            initial_capital=self.strategy.initial_capital,
            final_equity=self.equity_curve[-1][1] if self.equity_curve else self.strategy.initial_capital,
            trades=self.trades,
            fills=self.fills,
            signals=self.signals,
            equity_curve=self.equity_curve,
            portfolio_states=self.portfolio_states,
            max_drawdown=self.max_drawdown,
            execution_time_seconds=elapsed,
        )

    def _build_context(self, bar_idx: int, bar: Bar,
                       bars_by_symbol: Dict[str, List[Bar]]) -> Dict[str, Any]:
        context: Dict[str, Any] = {
            'bar_index': bar_idx,
            'open': bar.open, 'high': bar.high, 'low': bar.low,
            'close': bar.close, 'volume': bar.volume,
            'hl2': bar.hl2, 'hlc3': bar.hlc3, 'ohlc4': bar.ohlc4,
            'position_count': len(self.positions),
            'cash': self.cash,
            'equity': self._compute_equity(bars_by_symbol, bar_idx),
        }
        for ind in self.strategy.indicators:
            context[ind.name] = ind.last(0)
            context[f'{ind.name}_prev'] = ind.last(1)
            context[f'_ind_{ind.name}'] = ind
        for sym, pos in self.positions.items():
            context[f'position_{sym}'] = pos.quantity if pos.side == Side.LONG else -pos.quantity
        return context

    def _execute_signal(self, rule: StrategyRule, bar: Bar, bar_idx: int):
        symbol = self.strategy.symbols[0] if self.strategy.symbols else 'UNKNOWN'
        price = bar.close

        if rule.signal_type in (SignalType.ENTRY_LONG, SignalType.ENTRY_SHORT):
            if len(self.positions) >= self.strategy.max_positions:
                return
            if symbol in self.positions:
                existing = self.positions[symbol]
                if existing.side == (Side.LONG if rule.signal_type == SignalType.ENTRY_LONG else Side.SHORT):
                    return  # Already in position

            side = Side.LONG if rule.signal_type == SignalType.ENTRY_LONG else Side.SHORT
            qty = self._calculate_position_size(rule, price)
            if qty <= 0:
                return

            slip = self.slippage.estimate(price, qty, bar.volume, side)
            fill_price = price + slip
            comm = self.commission.calculate(fill_price, qty)

            if fill_price * qty + comm > self.cash:
                qty = max(0, int((self.cash - comm) / fill_price))
                if qty <= 0:
                    return

            self.cash -= fill_price * qty + comm
            sl = fill_price * (1 - rule.stop_loss_pct) if rule.stop_loss_pct and side == Side.LONG else \
                 fill_price * (1 + rule.stop_loss_pct) if rule.stop_loss_pct else None
            tp = fill_price * (1 + rule.take_profit_pct) if rule.take_profit_pct and side == Side.LONG else \
                 fill_price * (1 - rule.take_profit_pct) if rule.take_profit_pct else None

            self.positions[symbol] = Position(
                symbol=symbol, side=side, quantity=qty,
                avg_price=fill_price, entry_time=bar.timestamp,
                stop_loss=sl, take_profit=tp,
            )
            self._open_trades[symbol].append({
                'entry_time': bar.timestamp, 'entry_price': fill_price,
                'quantity': qty, 'side': side, 'commission': comm,
                'slippage': abs(slip), 'stop_loss': sl, 'take_profit': tp,
            })
            fill = Fill(bar.timestamp, symbol, side, fill_price, qty, comm, abs(slip))
            self.fills.append(fill)
            signal = Signal(bar.timestamp, rule.signal_type, symbol, fill_price, qty, sl, tp)
            self.signals.append(signal)

        elif rule.signal_type in (SignalType.EXIT_LONG, SignalType.EXIT_SHORT):
            if symbol not in self.positions:
                return
            pos = self.positions[symbol]
            expected_side = Side.LONG if rule.signal_type == SignalType.EXIT_LONG else Side.SHORT
            if pos.side != expected_side:
                return
            self._close_position(symbol, bar, bar_idx, "Rule exit")

    def _close_position(self, symbol: str, bar: Bar, bar_idx: int, reason: str = ""):
        if symbol not in self.positions:
            return
        pos = self.positions[symbol]
        exit_price = bar.close
        slip = self.slippage.estimate(exit_price, pos.quantity, bar.volume,
                                      Side.SHORT if pos.side == Side.LONG else Side.LONG)
        fill_price = exit_price + slip
        comm = self.commission.calculate(fill_price, pos.quantity)

        if pos.side == Side.LONG:
            pnl = (fill_price - pos.avg_price) * pos.quantity - comm
        else:
            pnl = (pos.avg_price - fill_price) * pos.quantity - comm

        self.cash += fill_price * pos.quantity - comm

        for open_trade in self._open_trades.get(symbol, []):
            trade = Trade(
                entry_time=open_trade['entry_time'],
                exit_time=bar.timestamp,
                symbol=symbol,
                side=open_trade['side'],
                entry_price=open_trade['entry_price'],
                exit_price=fill_price,
                quantity=open_trade['quantity'],
                pnl=pnl,
                pnl_pct=(pnl / (open_trade['entry_price'] * open_trade['quantity'])) * 100 if open_trade['entry_price'] else 0,
                commission=open_trade['commission'] + comm,
                slippage=open_trade['slippage'] + abs(slip),
                bars_held=bar_idx - (self.bar_index if not open_trade.get('bar_idx') else open_trade['bar_idx']),
                metadata={'reason': reason},
            )
            self.trades.append(trade)

        self._open_trades.pop(symbol, None)
        del self.positions[symbol]

        fill = Fill(bar.timestamp, symbol,
                    Side.SHORT if pos.side == Side.LONG else Side.LONG,
                    fill_price, pos.quantity, comm, abs(slip))
        self.fills.append(fill)

    def _close_all_positions(self, bar: Bar, bars_by_symbol: Dict[str, List[Bar]],
                             bar_idx: int, reason: str):
        for sym in list(self.positions.keys()):
            self._close_position(sym, bar, bar_idx, reason)

    def _check_sl_tp(self, bar: Bar, bars_by_symbol: Dict[str, List[Bar]]):
        for sym in list(self.positions.keys()):
            pos = self.positions[sym]
            if pos.stop_loss is not None:
                if pos.side == Side.LONG and bar.low <= pos.stop_loss:
                    self._close_position(sym, bar, self.bar_index, "Stop loss")
                    continue
                elif pos.side == Side.SHORT and bar.high >= pos.stop_loss:
                    self._close_position(sym, bar, self.bar_index, "Stop loss")
                    continue
            if pos.take_profit is not None:
                if pos.side == Side.LONG and bar.high >= pos.take_profit:
                    self._close_position(sym, bar, self.bar_index, "Take profit")
                    continue
                elif pos.side == Side.SHORT and bar.low <= pos.take_profit:
                    self._close_position(sym, bar, self.bar_index, "Take profit")
                    continue

    def _update_positions(self, bar: Bar, bars_by_symbol: Dict[str, List[Bar]]):
        for sym, pos in self.positions.items():
            if pos.side == Side.LONG:
                pos.unrealized_pnl = (bar.close - pos.avg_price) * pos.quantity
            else:
                pos.unrealized_pnl = (pos.avg_price - bar.close) * pos.quantity

    def _compute_equity(self, bars_by_symbol: Dict[str, List[Bar]], bar_idx: int) -> float:
        equity = self.cash
        for sym, pos in self.positions.items():
            bars = bars_by_symbol.get(sym, [])
            if bar_idx < len(bars):
                price = bars[bar_idx].close
            else:
                price = pos.avg_price
            equity += price * pos.quantity
        return equity

    def _calculate_position_size(self, rule: StrategyRule, price: float) -> float:
        if isinstance(rule.position_size, str):
            if rule.position_size == 'risk_pct':
                risk_amount = self.cash * self.strategy.risk_per_trade_pct
                if rule.stop_loss_pct and rule.stop_loss_pct > 0:
                    return max(1, int(risk_amount / (price * rule.stop_loss_pct)))
            elif rule.position_size == 'equal_weight':
                weight = 1.0 / max(self.strategy.max_positions, 1)
                return max(1, int(self.cash * weight / price))
            elif rule.position_size == 'kelly':
                return max(1, int(self.cash * 0.25 / price))  # Simplified
            return max(1, int(self.cash * 0.1 / price))
        else:
            if rule.position_size <= 1:
                return max(1, int(self.cash * rule.position_size / price))
            return int(rule.position_size)


# ═══════════════════════════════════════════════════════════════════════════════
# §3.3 — PERFORMANCE ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class BacktestResult:
    strategy_name: str
    start_date: datetime
    end_date: datetime
    initial_capital: float
    final_equity: float
    trades: List[Trade]
    fills: List[Fill]
    signals: List[Signal]
    equity_curve: List[Tuple[datetime, float]]
    portfolio_states: List[PortfolioState]
    max_drawdown: float
    execution_time_seconds: float

    @property
    def total_return(self) -> float:
        return (self.final_equity - self.initial_capital) / self.initial_capital

    @property
    def total_return_pct(self) -> float:
        return self.total_return * 100

    @property
    def total_trades(self) -> int:
        return len(self.trades)

    @property
    def winning_trades(self) -> int:
        return sum(1 for t in self.trades if t.pnl > 0)

    @property
    def losing_trades(self) -> int:
        return sum(1 for t in self.trades if t.pnl <= 0)

    @property
    def win_rate(self) -> float:
        return self.winning_trades / max(self.total_trades, 1)

    @property
    def avg_win(self) -> float:
        wins = [t.pnl for t in self.trades if t.pnl > 0]
        return sum(wins) / len(wins) if wins else 0

    @property
    def avg_loss(self) -> float:
        losses = [t.pnl for t in self.trades if t.pnl <= 0]
        return sum(losses) / len(losses) if losses else 0

    @property
    def profit_factor(self) -> float:
        gross_profit = sum(t.pnl for t in self.trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in self.trades if t.pnl < 0))
        return gross_profit / gross_loss if gross_loss > 0 else float('inf')

    @property
    def expectancy(self) -> float:
        return self.win_rate * self.avg_win + (1 - self.win_rate) * self.avg_loss

    @property
    def avg_bars_held(self) -> float:
        bars = [t.bars_held for t in self.trades if t.bars_held > 0]
        return sum(bars) / len(bars) if bars else 0

    @property
    def max_consecutive_wins(self) -> int:
        return self._max_consecutive(True)

    @property
    def max_consecutive_losses(self) -> int:
        return self._max_consecutive(False)

    def _max_consecutive(self, winning: bool) -> int:
        max_streak = 0
        current = 0
        for t in self.trades:
            if (t.pnl > 0) == winning:
                current += 1
                max_streak = max(max_streak, current)
            else:
                current = 0
        return max_streak

    def daily_returns(self) -> List[float]:
        if len(self.equity_curve) < 2:
            return []
        returns = []
        prev = self.equity_curve[0][1]
        for _, eq in self.equity_curve[1:]:
            ret = (eq - prev) / prev if prev != 0 else 0
            returns.append(ret)
            prev = eq
        return returns

    def sharpe_ratio(self, risk_free_rate: float = 0.04, periods: int = 252) -> float:
        rets = self.daily_returns()
        if not rets or len(rets) < 2:
            return 0.0
        rf_daily = risk_free_rate / periods
        excess = [r - rf_daily for r in rets]
        mean_excess = sum(excess) / len(excess)
        std = statistics.stdev(excess) if len(excess) > 1 else 1
        return (mean_excess / std) * math.sqrt(periods) if std > 0 else 0

    def sortino_ratio(self, risk_free_rate: float = 0.04, periods: int = 252) -> float:
        rets = self.daily_returns()
        if not rets:
            return 0.0
        rf_daily = risk_free_rate / periods
        excess = [r - rf_daily for r in rets]
        mean_excess = sum(excess) / len(excess)
        downside = [r for r in excess if r < 0]
        if not downside:
            return float('inf')
        down_std = math.sqrt(sum(r ** 2 for r in downside) / len(downside))
        return (mean_excess / down_std) * math.sqrt(periods) if down_std > 0 else 0

    def calmar_ratio(self) -> float:
        if self.max_drawdown == 0:
            return float('inf')
        days = (self.end_date - self.start_date).days
        ann_return = self.total_return * (365 / max(days, 1))
        return ann_return / self.max_drawdown

    def omega_ratio(self, threshold: float = 0.0) -> float:
        rets = self.daily_returns()
        above = sum(r - threshold for r in rets if r > threshold)
        below = sum(threshold - r for r in rets if r < threshold)
        return above / below if below > 0 else float('inf')

    def max_drawdown_duration(self) -> int:
        peak = self.equity_curve[0][1] if self.equity_curve else 0
        max_dur = 0
        dd_start = 0
        in_dd = False
        for i, (ts, eq) in enumerate(self.equity_curve):
            if eq >= peak:
                if in_dd:
                    max_dur = max(max_dur, i - dd_start)
                    in_dd = False
                peak = eq
            elif not in_dd:
                dd_start = i
                in_dd = True
        if in_dd:
            max_dur = max(max_dur, len(self.equity_curve) - dd_start)
        return max_dur

    def ulcer_index(self) -> float:
        if not self.equity_curve:
            return 0.0
        peak = self.equity_curve[0][1]
        sum_sq = 0.0
        for _, eq in self.equity_curve:
            peak = max(peak, eq)
            dd_pct = ((peak - eq) / peak) * 100 if peak > 0 else 0
            sum_sq += dd_pct ** 2
        return math.sqrt(sum_sq / len(self.equity_curve))

    def cagr(self) -> float:
        days = (self.end_date - self.start_date).days
        if days <= 0 or self.initial_capital <= 0:
            return 0.0
        years = days / 365.25
        return (self.final_equity / self.initial_capital) ** (1 / years) - 1

    def mar_ratio(self) -> float:
        return self.cagr() / self.max_drawdown if self.max_drawdown > 0 else float('inf')

    def tail_ratio(self, pct: float = 5.0) -> float:
        rets = sorted(self.daily_returns())
        if len(rets) < 20:
            return 0.0
        n = max(1, int(len(rets) * pct / 100))
        left_tail = abs(sum(rets[:n]) / n) if n > 0 else 1
        right_tail = sum(rets[-n:]) / n if n > 0 else 0
        return right_tail / left_tail if left_tail > 0 else 0

    def common_sense_ratio(self) -> float:
        return self.tail_ratio() * self.profit_factor

    def kurtosis(self) -> float:
        rets = self.daily_returns()
        if len(rets) < 4:
            return 0.0
        mean = sum(rets) / len(rets)
        std = statistics.stdev(rets) if len(rets) > 1 else 1
        if std == 0:
            return 0.0
        n = len(rets)
        kurt = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * \
               sum(((r - mean) / std) ** 4 for r in rets) - \
               (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
        return kurt

    def skewness(self) -> float:
        rets = self.daily_returns()
        if len(rets) < 3:
            return 0.0
        mean = sum(rets) / len(rets)
        std = statistics.stdev(rets) if len(rets) > 1 else 1
        if std == 0:
            return 0.0
        n = len(rets)
        return (n / ((n - 1) * (n - 2))) * sum(((r - mean) / std) ** 3 for r in rets)

    def monthly_returns(self) -> Dict[str, float]:
        monthly: Dict[str, List[float]] = {}
        for ts, eq in self.equity_curve:
            key = ts.strftime('%Y-%m')
            if key not in monthly:
                monthly[key] = [eq]
            else:
                monthly[key].append(eq)
        result: Dict[str, float] = {}
        for key, eqs in monthly.items():
            if len(eqs) >= 2:
                result[key] = (eqs[-1] - eqs[0]) / eqs[0] if eqs[0] else 0
        return result

    def yearly_returns(self) -> Dict[str, float]:
        yearly: Dict[str, List[float]] = {}
        for ts, eq in self.equity_curve:
            key = str(ts.year)
            if key not in yearly:
                yearly[key] = [eq]
            else:
                yearly[key].append(eq)
        result: Dict[str, float] = {}
        for key, eqs in yearly.items():
            if len(eqs) >= 2:
                result[key] = (eqs[-1] - eqs[0]) / eqs[0] if eqs[0] else 0
        return result

    def to_dict(self) -> Dict[str, Any]:
        return {
            'strategy_name': self.strategy_name,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'initial_capital': self.initial_capital,
            'final_equity': round(self.final_equity, 2),
            'total_return_pct': round(self.total_return_pct, 2),
            'cagr': round(self.cagr() * 100, 2),
            'max_drawdown_pct': round(self.max_drawdown * 100, 2),
            'max_drawdown_duration_bars': self.max_drawdown_duration(),
            'sharpe_ratio': round(self.sharpe_ratio(), 3),
            'sortino_ratio': round(self.sortino_ratio(), 3),
            'calmar_ratio': round(self.calmar_ratio(), 3),
            'omega_ratio': round(self.omega_ratio(), 3),
            'profit_factor': round(self.profit_factor, 3),
            'expectancy': round(self.expectancy, 2),
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'losing_trades': self.losing_trades,
            'win_rate_pct': round(self.win_rate * 100, 1),
            'avg_win': round(self.avg_win, 2),
            'avg_loss': round(self.avg_loss, 2),
            'avg_bars_held': round(self.avg_bars_held, 1),
            'max_consecutive_wins': self.max_consecutive_wins,
            'max_consecutive_losses': self.max_consecutive_losses,
            'ulcer_index': round(self.ulcer_index(), 4),
            'mar_ratio': round(self.mar_ratio(), 3),
            'tail_ratio': round(self.tail_ratio(), 3),
            'common_sense_ratio': round(self.common_sense_ratio(), 3),
            'kurtosis': round(self.kurtosis(), 4),
            'skewness': round(self.skewness(), 4),
            'execution_time_seconds': round(self.execution_time_seconds, 3),
            'total_commission': round(sum(t.commission for t in self.trades), 2),
            'total_slippage': round(sum(t.slippage for t in self.trades), 2),
            'monthly_returns': {k: round(v * 100, 2) for k, v in self.monthly_returns().items()},
            'yearly_returns': {k: round(v * 100, 2) for k, v in self.yearly_returns().items()},
        }


# ═══════════════════════════════════════════════════════════════════════════════
# §3.4 — STRATEGY OPTIMIZATION
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OptimizationParam:
    name: str
    min_val: float
    max_val: float
    step: float
    current: float = 0.0

    def values(self) -> List[float]:
        vals = []
        v = self.min_val
        while v <= self.max_val + 1e-10:
            vals.append(round(v, 6))
            v += self.step
        return vals


class GridSearchOptimizer:
    """Exhaustive grid search over parameter space."""

    def __init__(self, strategy_factory: Callable[..., StrategyDefinition],
                 data: Dict[str, List[Bar]],
                 params: List[OptimizationParam],
                 objective: str = 'sharpe_ratio'):
        self.strategy_factory = strategy_factory
        self.data = data
        self.params = params
        self.objective = objective
        self.results: List[Dict[str, Any]] = []

    def run(self) -> List[Dict[str, Any]]:
        param_values = [p.values() for p in self.params]
        param_names = [p.name for p in self.params]
        total = 1
        for pv in param_values:
            total *= len(pv)
        logger.info(f"Grid search: {total} combinations")

        for combo in itertools.product(*param_values):
            param_dict = dict(zip(param_names, combo))
            try:
                strategy = self.strategy_factory(**param_dict)
                engine = BacktestEngine(strategy)
                result = engine.run(self.data)
                score = self._get_score(result)
                entry = {**param_dict, 'score': score, 'metrics': result.to_dict()}
                self.results.append(entry)
            except Exception as e:
                logger.warning(f"Combo {param_dict} failed: {e}")

        self.results.sort(key=lambda x: x['score'], reverse=True)
        return self.results

    def _get_score(self, result: BacktestResult) -> float:
        mapping = {
            'sharpe_ratio': result.sharpe_ratio,
            'sortino_ratio': result.sortino_ratio,
            'calmar_ratio': result.calmar_ratio,
            'total_return': lambda: result.total_return,
            'profit_factor': lambda: result.profit_factor,
            'win_rate': lambda: result.win_rate,
        }
        scorer = mapping.get(self.objective, result.sharpe_ratio)
        return scorer() if callable(scorer) else scorer


class GeneticOptimizer:
    """Genetic algorithm for strategy parameter optimization."""

    def __init__(self, strategy_factory: Callable[..., StrategyDefinition],
                 data: Dict[str, List[Bar]],
                 params: List[OptimizationParam],
                 objective: str = 'sharpe_ratio',
                 population_size: int = 50,
                 generations: int = 100,
                 mutation_rate: float = 0.1,
                 crossover_rate: float = 0.7,
                 elitism: int = 5):
        self.strategy_factory = strategy_factory
        self.data = data
        self.params = params
        self.objective = objective
        self.pop_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.elitism = elitism
        self.best_results: List[Dict[str, Any]] = []

    def run(self) -> Dict[str, Any]:
        population = self._init_population()
        best_ever = None

        for gen in range(self.generations):
            fitness_scores = []
            for individual in population:
                score = self._evaluate(individual)
                fitness_scores.append((individual, score))

            fitness_scores.sort(key=lambda x: x[1], reverse=True)
            if best_ever is None or fitness_scores[0][1] > best_ever[1]:
                best_ever = fitness_scores[0]

            if (gen + 1) % 10 == 0:
                logger.info(f"Gen {gen + 1}: best={fitness_scores[0][1]:.4f}")

            # Selection + crossover + mutation
            new_pop = [ind for ind, _ in fitness_scores[:self.elitism]]

            while len(new_pop) < self.pop_size:
                parent1 = self._tournament_select(fitness_scores)
                parent2 = self._tournament_select(fitness_scores)

                if random.random() < self.crossover_rate:
                    child = self._crossover(parent1, parent2)
                else:
                    child = dict(parent1)

                child = self._mutate(child)
                new_pop.append(child)

            population = new_pop

        param_names = [p.name for p in self.params]
        return {
            'best_params': {k: best_ever[0][k] for k in param_names} if best_ever else {},
            'best_score': best_ever[1] if best_ever else 0,
            'generations': self.generations,
            'population_size': self.pop_size,
        }

    def _init_population(self) -> List[Dict[str, float]]:
        population = []
        for _ in range(self.pop_size):
            individual: Dict[str, float] = {}
            for p in self.params:
                vals = p.values()
                individual[p.name] = random.choice(vals)
            population.append(individual)
        return population

    def _evaluate(self, individual: Dict[str, float]) -> float:
        try:
            strategy = self.strategy_factory(**individual)
            engine = BacktestEngine(strategy)
            result = engine.run(self.data)
            return GridSearchOptimizer._get_score(
                GridSearchOptimizer.__new__(GridSearchOptimizer), result)
        except Exception:
            return -999.0

    def _tournament_select(self, scored: List[Tuple[Dict, float]],
                           k: int = 3) -> Dict[str, float]:
        candidates = random.sample(scored, min(k, len(scored)))
        best = max(candidates, key=lambda x: x[1])
        return best[0]

    def _crossover(self, p1: Dict[str, float], p2: Dict[str, float]) -> Dict[str, float]:
        child: Dict[str, float] = {}
        for p in self.params:
            child[p.name] = p1[p.name] if random.random() < 0.5 else p2[p.name]
        return child

    def _mutate(self, individual: Dict[str, float]) -> Dict[str, float]:
        for p in self.params:
            if random.random() < self.mutation_rate:
                vals = p.values()
                individual[p.name] = random.choice(vals)
        return individual


class WalkForwardOptimizer:
    """Walk-forward analysis: optimize on in-sample, validate on out-of-sample."""

    def __init__(self, strategy_factory: Callable[..., StrategyDefinition],
                 data: Dict[str, List[Bar]],
                 params: List[OptimizationParam],
                 in_sample_pct: float = 0.7,
                 num_windows: int = 5,
                 objective: str = 'sharpe_ratio'):
        self.strategy_factory = strategy_factory
        self.data = data
        self.params = params
        self.in_sample_pct = in_sample_pct
        self.num_windows = num_windows
        self.objective = objective
        self.window_results: List[Dict[str, Any]] = []

    def run(self) -> Dict[str, Any]:
        primary_sym = list(self.data.keys())[0]
        total_bars = len(self.data[primary_sym])
        window_size = total_bars // self.num_windows
        is_size = int(window_size * self.in_sample_pct)
        oos_size = window_size - is_size

        for w in range(self.num_windows):
            start = w * window_size
            is_end = start + is_size
            oos_end = min(start + window_size, total_bars)

            # Split data
            is_data = {sym: bars[start:is_end] for sym, bars in self.data.items()}
            oos_data = {sym: bars[is_end:oos_end] for sym, bars in self.data.items()}

            if not is_data[primary_sym] or not oos_data[primary_sym]:
                continue

            # Optimize on in-sample
            optimizer = GridSearchOptimizer(
                self.strategy_factory, is_data, self.params, self.objective
            )
            results = optimizer.run()
            if not results:
                continue

            best = results[0]

            # Validate on out-of-sample
            param_names = [p.name for p in self.params]
            best_params = {k: best[k] for k in param_names if k in best}
            strategy = self.strategy_factory(**best_params)
            engine = BacktestEngine(strategy)
            oos_result = engine.run(oos_data)

            self.window_results.append({
                'window': w,
                'in_sample_bars': is_size,
                'out_of_sample_bars': oos_size,
                'best_params': best_params,
                'in_sample_score': best['score'],
                'out_of_sample_score': self._score(oos_result),
                'out_of_sample_return': oos_result.total_return_pct,
                'out_of_sample_sharpe': oos_result.sharpe_ratio(),
            })

        # Compute walk-forward efficiency
        is_scores = [w['in_sample_score'] for w in self.window_results if w['in_sample_score'] != 0]
        oos_scores = [w['out_of_sample_score'] for w in self.window_results]

        wfe = 0.0
        if is_scores and oos_scores:
            avg_is = sum(is_scores) / len(is_scores)
            avg_oos = sum(oos_scores) / len(oos_scores)
            wfe = avg_oos / avg_is if avg_is != 0 else 0

        return {
            'num_windows': self.num_windows,
            'walk_forward_efficiency': round(wfe, 4),
            'avg_oos_return': round(sum(w['out_of_sample_return'] for w in self.window_results) / max(len(self.window_results), 1), 2),
            'windows': self.window_results,
        }

    def _score(self, result: BacktestResult) -> float:
        mapping = {
            'sharpe_ratio': result.sharpe_ratio(),
            'sortino_ratio': result.sortino_ratio(),
            'total_return': result.total_return,
        }
        return mapping.get(self.objective, result.sharpe_ratio())


class MonteCarloSimulator:
    """Monte Carlo simulation for robustness testing."""

    def __init__(self, trades: List[Trade], initial_capital: float = 100_000,
                 num_simulations: int = 1000, num_trades: Optional[int] = None):
        self.trades = trades
        self.initial_capital = initial_capital
        self.num_simulations = num_simulations
        self.num_trades = num_trades or len(trades)

    def run(self) -> Dict[str, Any]:
        if not self.trades:
            return {'error': 'No trades to simulate'}

        pnl_series = [t.pnl for t in self.trades]
        final_equities = []
        max_drawdowns = []
        sharpe_ratios = []

        for _ in range(self.num_simulations):
            shuffled = random.choices(pnl_series, k=self.num_trades)
            equity = self.initial_capital
            peak = equity
            max_dd = 0.0
            equity_curve = [equity]

            for pnl in shuffled:
                equity += pnl
                equity_curve.append(equity)
                peak = max(peak, equity)
                dd = (peak - equity) / peak if peak > 0 else 0
                max_dd = max(max_dd, dd)

            final_equities.append(equity)
            max_drawdowns.append(max_dd)

            # Daily returns approximation
            returns = [(equity_curve[i] - equity_curve[i - 1]) / equity_curve[i - 1]
                       for i in range(1, len(equity_curve)) if equity_curve[i - 1] != 0]
            if len(returns) > 1:
                mean_r = sum(returns) / len(returns)
                std_r = statistics.stdev(returns)
                sharpe = (mean_r / std_r) * math.sqrt(252) if std_r > 0 else 0
                sharpe_ratios.append(sharpe)

        final_equities.sort()
        max_drawdowns.sort()

        return {
            'num_simulations': self.num_simulations,
            'num_trades': self.num_trades,
            'median_final_equity': round(final_equities[len(final_equities) // 2], 2),
            'percentile_5': round(final_equities[int(len(final_equities) * 0.05)], 2),
            'percentile_25': round(final_equities[int(len(final_equities) * 0.25)], 2),
            'percentile_75': round(final_equities[int(len(final_equities) * 0.75)], 2),
            'percentile_95': round(final_equities[int(len(final_equities) * 0.95)], 2),
            'mean_final_equity': round(sum(final_equities) / len(final_equities), 2),
            'std_final_equity': round(statistics.stdev(final_equities), 2),
            'median_max_drawdown': round(max_drawdowns[len(max_drawdowns) // 2] * 100, 2),
            'worst_case_drawdown': round(max_drawdowns[-1] * 100, 2),
            'mean_sharpe': round(sum(sharpe_ratios) / max(len(sharpe_ratios), 1), 3),
            'probability_profit': round(sum(1 for e in final_equities if e > self.initial_capital) / len(final_equities) * 100, 1),
            'probability_ruin': round(sum(1 for e in final_equities if e < self.initial_capital * 0.5) / len(final_equities) * 100, 1),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# DATA FETCHER — Real Alpaca/Polygon/yfinance
# ═══════════════════════════════════════════════════════════════════════════════

class MarketDataFetcher:
    """Fetch real OHLCV data from Alpaca, Polygon, or yfinance."""

    def __init__(self):
        from dotenv import load_dotenv
        load_dotenv('keys.env')
        self.alpaca_key = os.getenv('APCA_API_KEY_ID', '')
        self.alpaca_secret = os.getenv('APCA_API_SECRET_KEY', '')
        self.alpaca_endpoint = os.getenv('APCA_ENDPOINT', 'https://paper-api.alpaca.markets')
        self.polygon_key = os.getenv('POLYGON_API_KEY', '')

    async def fetch_bars(self, symbol: str, timeframe: str = '1Day',
                         start: Optional[str] = None, end: Optional[str] = None,
                         limit: int = 500) -> List[Bar]:
        """Try Alpaca → Polygon → yfinance fallback chain."""
        try:
            return await self._fetch_alpaca(symbol, timeframe, start, end, limit)
        except Exception as e:
            logger.warning(f"Alpaca failed for {symbol}: {e}")

        try:
            return await self._fetch_polygon(symbol, timeframe, start, end, limit)
        except Exception as e:
            logger.warning(f"Polygon failed for {symbol}: {e}")

        return self._fetch_yfinance(symbol, timeframe, start, end, limit)

    async def _fetch_alpaca(self, symbol: str, timeframe: str,
                            start: Optional[str], end: Optional[str],
                            limit: int) -> List[Bar]:
        import aiohttp
        headers = {
            'APCA-API-KEY-ID': self.alpaca_key,
            'APCA-API-SECRET-KEY': self.alpaca_secret,
        }
        params: Dict[str, Any] = {
            'timeframe': timeframe,
            'limit': limit,
            'adjustment': 'split',
            'feed': 'sip',
        }
        if start:
            params['start'] = start
        if end:
            params['end'] = end

        url = f"https://data.alpaca.markets/v2/stocks/{symbol}/bars"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as resp:
                if resp.status != 200:
                    raise Exception(f"Alpaca HTTP {resp.status}")
                data = await resp.json()

        bars = []
        for b in data.get('bars', []):
            bars.append(Bar(
                timestamp=datetime.fromisoformat(b['t'].replace('Z', '+00:00')),
                open=b['o'], high=b['h'], low=b['l'], close=b['c'],
                volume=b['v'], vwap=b.get('vw', 0),
            ))
        return bars

    async def _fetch_polygon(self, symbol: str, timeframe: str,
                             start: Optional[str], end: Optional[str],
                             limit: int) -> List[Bar]:
        import aiohttp
        tf_map = {
            '1Min': ('minute', 1), '5Min': ('minute', 5), '15Min': ('minute', 15),
            '30Min': ('minute', 30), '1Hour': ('hour', 1), '4Hour': ('hour', 4),
            '1Day': ('day', 1), '1Week': ('week', 1), '1Month': ('month', 1),
        }
        span, mult = tf_map.get(timeframe, ('day', 1))
        s = start or (datetime.now() - timedelta(days=365 * 2)).strftime('%Y-%m-%d')
        e = end or datetime.now().strftime('%Y-%m-%d')
        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/{mult}/{span}/{s}/{e}"
        params = {'apiKey': self.polygon_key, 'limit': limit, 'adjusted': 'true'}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    raise Exception(f"Polygon HTTP {resp.status}")
                data = await resp.json()

        bars = []
        for r in data.get('results', []):
            bars.append(Bar(
                timestamp=datetime.fromtimestamp(r['t'] / 1000),
                open=r['o'], high=r['h'], low=r['l'], close=r['c'],
                volume=r['v'], vwap=r.get('vw', 0),
            ))
        return bars

    def _fetch_yfinance(self, symbol: str, timeframe: str,
                        start: Optional[str], end: Optional[str],
                        limit: int) -> List[Bar]:
        try:
            import yfinance as yf
        except ImportError:
            logger.error("yfinance not installed")
            return []

        tf_map = {
            '1Min': '1m', '5Min': '5m', '15Min': '15m', '30Min': '30m',
            '1Hour': '1h', '4Hour': '4h', '1Day': '1d', '1Week': '1wk',
            '1Month': '1mo',
        }
        yf_tf = tf_map.get(timeframe, '1d')
        period_map = {
            '1m': '7d', '5m': '60d', '15m': '60d', '30m': '60d',
            '1h': '730d', '4h': '730d', '1d': 'max', '1wk': 'max', '1mo': 'max',
        }
        period = period_map.get(yf_tf, '2y')

        ticker = yf.Ticker(symbol)
        if start and end:
            df = ticker.history(start=start, end=end, interval=yf_tf)
        else:
            df = ticker.history(period=period, interval=yf_tf)

        bars = []
        for idx, row in df.iterrows():
            bars.append(Bar(
                timestamp=idx.to_pydatetime(),
                open=row['Open'], high=row['High'],
                low=row['Low'], close=row['Close'],
                volume=row['Volume'],
            ))
        return bars[-limit:] if len(bars) > limit else bars


# ═══════════════════════════════════════════════════════════════════════════════
# MULTI-TIMEFRAME ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

class MultiTimeframeAnalyzer:
    """Analyze strategy signals across multiple timeframes."""

    def __init__(self, fetcher: MarketDataFetcher):
        self.fetcher = fetcher

    async def analyze(self, symbol: str, timeframes: List[str],
                      indicators: List[Dict[str, Any]]) -> Dict[str, Any]:
        results: Dict[str, Any] = {}
        for tf in timeframes:
            bars = await self.fetcher.fetch_bars(symbol, tf)
            tf_results: Dict[str, List[float]] = {}
            for ind_cfg in indicators:
                name = ind_cfg['name']
                func_name = ind_cfg.get('function', 'SMA')
                params = ind_cfg.get('params', {})
                source = BarField[ind_cfg.get('source', 'CLOSE').upper()]
                func = INDICATOR_REGISTRY.get(func_name, _sma)
                data = [b.field(source) for b in bars]
                tf_results[name] = func(data, **params)
            results[tf] = {
                'bars': len(bars),
                'indicators': {k: v[-1] if v and not math.isnan(v[-1]) else None
                               for k, v in tf_results.items()},
                'last_close': bars[-1].close if bars else None,
            }
        return results


# ═══════════════════════════════════════════════════════════════════════════════
# COMPOUND INDICATOR BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

class CompoundIndicator:
    """Build indicators that combine multiple base indicators."""

    def __init__(self, name: str, expression: str, indicators: Dict[str, IndicatorNode]):
        self.name = name
        self.expression = expression
        self.indicators = indicators
        self.values: List[float] = []

    def compute(self, bars: List[Bar]) -> List[float]:
        # Compute all component indicators
        for ind in self.indicators.values():
            ind.compute(bars)

        # Evaluate expression for each bar
        self.values = []
        for i in range(len(bars)):
            context = {}
            for name, ind in self.indicators.items():
                context[name] = ind.values[i] if i < len(ind.values) else float('nan')
            try:
                # Safe eval of mathematical expression
                val = self._safe_eval(self.expression, context)
                self.values.append(val)
            except Exception:
                self.values.append(float('nan'))
        return self.values

    def _safe_eval(self, expr: str, ctx: Dict[str, float]) -> float:
        # Replace indicator names with values
        for name, val in ctx.items():
            expr = expr.replace(name, str(val))
        # Only allow safe math operations
        allowed_chars = set('0123456789.+-*/() ')
        if not all(c in allowed_chars for c in expr):
            return float('nan')
        try:
            return float(eval(expr))  # noqa: S307
        except Exception:
            return float('nan')


# ═══════════════════════════════════════════════════════════════════════════════
# STRATEGY TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════════

def create_sma_crossover_strategy(fast: int = 10, slow: int = 50,
                                   **kwargs) -> StrategyDefinition:
    fast_sma = IndicatorNode('fast_sma', _sma, {'period': fast})
    slow_sma = IndicatorNode('slow_sma', _sma, {'period': slow})

    entry_long = StrategyRule(
        name="SMA Cross Long",
        signal_type=SignalType.ENTRY_LONG,
        conditions=ConditionGroup([
            Condition('fast_sma', 'crosses_above', 'slow_sma'),
        ]),
        stop_loss_pct=kwargs.get('stop_loss', 0.02),
        take_profit_pct=kwargs.get('take_profit', 0.06),
    )
    exit_long = StrategyRule(
        name="SMA Cross Exit",
        signal_type=SignalType.EXIT_LONG,
        conditions=ConditionGroup([
            Condition('fast_sma', 'crosses_below', 'slow_sma'),
        ]),
    )
    return StrategyDefinition(
        name=f"SMA Crossover ({fast}/{slow})",
        indicators=[fast_sma, slow_sma],
        rules=[entry_long, exit_long],
        **{k: v for k, v in kwargs.items() if k not in ('stop_loss', 'take_profit')},
    )

def create_rsi_mean_reversion(period: int = 14, oversold: float = 30,
                               overbought: float = 70, **kwargs) -> StrategyDefinition:
    rsi_ind = IndicatorNode('rsi', _rsi, {'period': period})

    entry = StrategyRule(
        name="RSI Oversold Entry",
        signal_type=SignalType.ENTRY_LONG,
        conditions=ConditionGroup([
            Condition('rsi', '<', oversold),
        ]),
        stop_loss_pct=0.03,
        take_profit_pct=0.05,
    )
    exit_rule = StrategyRule(
        name="RSI Overbought Exit",
        signal_type=SignalType.EXIT_LONG,
        conditions=ConditionGroup([
            Condition('rsi', '>', overbought),
        ]),
    )
    return StrategyDefinition(
        name=f"RSI Mean Reversion ({period}/{oversold}/{overbought})",
        indicators=[rsi_ind],
        rules=[entry, exit_rule],
    )

def create_macd_strategy(fast: int = 12, slow: int = 26, signal: int = 9,
                          **kwargs) -> StrategyDefinition:
    macd_ind = IndicatorNode('macd_signal', _macd, {'fast': fast, 'slow': slow, 'signal': signal})
    macd_line = IndicatorNode('macd_line', lambda data, **kw: [
        _ema(data, fast)[i] - _ema(data, slow)[i] if not math.isnan(_ema(data, fast)[i])
        and not math.isnan(_ema(data, slow)[i]) else float('nan')
        for i in range(len(data))
    ], {})

    entry = StrategyRule(
        name="MACD Cross Long",
        signal_type=SignalType.ENTRY_LONG,
        conditions=ConditionGroup([
            Condition('macd_line', 'crosses_above', 'macd_signal'),
        ]),
    )
    exit_rule = StrategyRule(
        name="MACD Cross Exit",
        signal_type=SignalType.EXIT_LONG,
        conditions=ConditionGroup([
            Condition('macd_line', 'crosses_below', 'macd_signal'),
        ]),
    )
    return StrategyDefinition(
        name=f"MACD ({fast}/{slow}/{signal})",
        indicators=[macd_ind, macd_line],
        rules=[entry, exit_rule],
    )

def create_bollinger_breakout(period: int = 20, std_dev: float = 2.0,
                               **kwargs) -> StrategyDefinition:
    bb_upper = IndicatorNode('bb_upper', _bollinger_bands, {'period': period, 'std_dev': std_dev})
    sma_mid = IndicatorNode('bb_mid', _sma, {'period': period})

    entry = StrategyRule(
        name="BB Breakout Long",
        signal_type=SignalType.ENTRY_LONG,
        conditions=ConditionGroup([
            Condition('close', '>', 'bb_upper'),
        ]),
        stop_loss_pct=0.02,
    )
    exit_rule = StrategyRule(
        name="BB Return to Mean",
        signal_type=SignalType.EXIT_LONG,
        conditions=ConditionGroup([
            Condition('close', '<', 'bb_mid'),
        ]),
    )
    return StrategyDefinition(
        name=f"Bollinger Breakout ({period}/{std_dev})",
        indicators=[bb_upper, sma_mid],
        rules=[entry, exit_rule],
    )

def create_supertrend_strategy(period: int = 10, multiplier: float = 3.0,
                                **kwargs) -> StrategyDefinition:
    st_ind = IndicatorNode('supertrend', _supertrend, {'period': period, 'multiplier': multiplier})

    entry = StrategyRule(
        name="Supertrend Long",
        signal_type=SignalType.ENTRY_LONG,
        conditions=ConditionGroup([
            Condition('close', '>', 'supertrend'),
        ]),
        stop_loss_pct=0.025,
    )
    exit_rule = StrategyRule(
        name="Supertrend Exit",
        signal_type=SignalType.EXIT_LONG,
        conditions=ConditionGroup([
            Condition('close', '<', 'supertrend'),
        ]),
    )
    return StrategyDefinition(
        name=f"Supertrend ({period}/{multiplier})",
        indicators=[st_ind],
        rules=[entry, exit_rule],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# API INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

class StrategyAPI:
    """High-level API for strategy management."""

    TEMPLATES = {
        'sma_crossover': create_sma_crossover_strategy,
        'rsi_mean_reversion': create_rsi_mean_reversion,
        'macd': create_macd_strategy,
        'bollinger_breakout': create_bollinger_breakout,
        'supertrend': create_supertrend_strategy,
    }

    def __init__(self):
        self.fetcher = MarketDataFetcher()
        self.parser = PineScriptParser()
        self.builder = VisualStrategyBuilder()
        self._cached_results: Dict[str, BacktestResult] = {}

    def list_templates(self) -> List[Dict[str, Any]]:
        return [
            {'id': name, 'name': name.replace('_', ' ').title(),
             'description': f"Built-in {name} strategy template"}
            for name in self.TEMPLATES
        ]

    async def create_from_template(self, template_id: str,
                                    params: Dict[str, Any]) -> StrategyDefinition:
        factory = self.TEMPLATES.get(template_id)
        if not factory:
            raise ValueError(f"Unknown template: {template_id}")
        return factory(**params)

    def create_from_pine(self, script: str) -> StrategyDefinition:
        return self.parser.parse(script)

    def create_from_visual(self, config: Dict[str, Any]) -> StrategyDefinition:
        return self.builder.from_json(config)

    async def backtest(self, strategy: StrategyDefinition,
                        symbol: str = 'SPY',
                        start: Optional[str] = None,
                        end: Optional[str] = None) -> BacktestResult:
        strategy.symbols = [symbol]
        bars = await self.fetcher.fetch_bars(symbol, '1Day', start, end, 1000)
        if not bars:
            raise ValueError(f"No data for {symbol}")

        engine = BacktestEngine(strategy)
        result = engine.run({symbol: bars})
        cache_key = hashlib.md5(f"{strategy.name}:{symbol}:{start}:{end}".encode()).hexdigest()
        self._cached_results[cache_key] = result
        return result

    async def optimize_grid(self, strategy_factory: Callable,
                            symbol: str, params: List[Dict[str, Any]],
                            objective: str = 'sharpe_ratio') -> List[Dict[str, Any]]:
        bars = await self.fetcher.fetch_bars(symbol, '1Day', limit=1000)
        opt_params = [OptimizationParam(**p) for p in params]
        optimizer = GridSearchOptimizer(strategy_factory, {symbol: bars}, opt_params, objective)
        return optimizer.run()

    async def optimize_genetic(self, strategy_factory: Callable,
                               symbol: str, params: List[Dict[str, Any]],
                               generations: int = 50) -> Dict[str, Any]:
        bars = await self.fetcher.fetch_bars(symbol, '1Day', limit=1000)
        opt_params = [OptimizationParam(**p) for p in params]
        optimizer = GeneticOptimizer(strategy_factory, {symbol: bars}, opt_params,
                                    generations=generations)
        return optimizer.run()

    async def walk_forward(self, strategy_factory: Callable,
                           symbol: str, params: List[Dict[str, Any]],
                           windows: int = 5) -> Dict[str, Any]:
        bars = await self.fetcher.fetch_bars(symbol, '1Day', limit=2000)
        opt_params = [OptimizationParam(**p) for p in params]
        wf = WalkForwardOptimizer(strategy_factory, {symbol: bars}, opt_params,
                                  num_windows=windows)
        return wf.run()

    async def monte_carlo(self, result: BacktestResult,
                          simulations: int = 1000) -> Dict[str, Any]:
        mc = MonteCarloSimulator(result.trades, result.initial_capital, simulations)
        return mc.run()

    async def multi_timeframe(self, symbol: str,
                              timeframes: List[str],
                              indicators: List[Dict[str, Any]]) -> Dict[str, Any]:
        analyzer = MultiTimeframeAnalyzer(self.fetcher)
        return await analyzer.analyze(symbol, timeframes, indicators)
