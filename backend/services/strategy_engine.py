"""
Strategy Engine — §3.1–§3.4
============================
Strategy definition, backtest execution, performance analytics,
walk-forward optimization, Monte Carlo simulation.

Uses Polygon/yfinance for historical data. Fully deterministic backtests.
"""

import os
import math
import logging
import asyncio
import random
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

import httpx

logger = logging.getLogger("strategy_engine")

POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
TWELVE_KEY = os.getenv("TWELVEDATA_API_KEY", "")

TRADING_DAYS = 252
RISK_FREE_RATE = 0.052


# ═══════════════════════════════════════════════════════════════════════════════
# HISTORICAL DATA
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class OHLCV:
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    adj_close: Optional[float] = None


class DataLoader:
    """Load historical OHLCV data for backtesting."""

    def __init__(self):
        self._http: Optional[httpx.AsyncClient] = None
        self._cache: dict[str, list[OHLCV]] = {}

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=30.0)
        return self._http

    async def load(self, symbol: str, start: str, end: str,
                   interval: str = "1d") -> list[OHLCV]:
        cache_key = f"{symbol}_{start}_{end}_{interval}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        bars = []

        # Try Polygon
        if POLYGON_KEY:
            try:
                bars = await self._polygon_load(symbol, start, end, interval)
            except Exception as e:
                logger.warning(f"Polygon data load failed: {e}")

        # yfinance fallback
        if not bars:
            bars = await self._yfinance_load(symbol, start, end, interval)

        self._cache[cache_key] = bars
        return bars

    async def _polygon_load(self, symbol: str, start: str, end: str,
                             interval: str) -> list[OHLCV]:
        http = await self._get_http()
        multiplier = "1"
        timespan = "day"
        if interval == "1h":
            timespan = "hour"
        elif interval == "5m":
            multiplier = "5"
            timespan = "minute"
        elif interval == "1w":
            timespan = "week"
        elif interval == "1M":
            timespan = "month"

        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/{multiplier}/{timespan}/{start}/{end}?adjusted=true&sort=asc&limit=50000&apiKey={POLYGON_KEY}"
        resp = await http.get(url)
        data = resp.json()
        results = data.get("results", [])

        bars = []
        for r in results:
            ts = datetime.fromtimestamp(r["t"] / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            bars.append(OHLCV(
                timestamp=ts,
                open=r["o"],
                high=r["h"],
                low=r["l"],
                close=r["c"],
                volume=int(r.get("v", 0)),
                adj_close=r.get("c"),
            ))

        return bars

    async def _yfinance_load(self, symbol: str, start: str, end: str,
                              interval: str) -> list[OHLCV]:
        import concurrent.futures

        def _fetch():
            try:
                import yfinance as yf
                ticker = yf.Ticker(symbol)
                hist = ticker.history(start=start, end=end, interval=interval)
                bars = []
                for idx, row in hist.iterrows():
                    bars.append(OHLCV(
                        timestamp=str(idx),
                        open=float(row["Open"]),
                        high=float(row["High"]),
                        low=float(row["Low"]),
                        close=float(row["Close"]),
                        volume=int(row.get("Volume", 0)),
                    ))
                return bars
            except Exception as e:
                logger.warning(f"yfinance load failed: {e}")
                return []

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return await loop.run_in_executor(pool, _fetch)


# ═══════════════════════════════════════════════════════════════════════════════
# §3.1 — STRATEGY DEFINITION
# ═══════════════════════════════════════════════════════════════════════════════

class SignalType(str, Enum):
    BUY = "buy"
    SELL = "sell"
    SHORT = "short"
    COVER = "cover"
    HOLD = "hold"


@dataclass
class Signal:
    timestamp: str
    signal_type: str
    symbol: str
    price: float
    quantity: float = 0
    confidence: float = 0.0
    reason: str = ""
    metadata: dict = field(default_factory=dict)


@dataclass
class StrategyConfig:
    name: str
    description: str = ""
    symbols: list = field(default_factory=list)
    parameters: dict = field(default_factory=dict)
    initial_capital: float = 100000.0
    commission: float = 0.001  # 0.1% per trade
    slippage: float = 0.0005  # 0.05%
    max_position_pct: float = 0.20  # Max 20% per position
    stop_loss_pct: float = 0.05     # 5% stop loss
    take_profit_pct: float = 0.15   # 15% take profit
    allow_short: bool = False
    rebalance_frequency: str = "daily"  # daily, weekly, monthly


# ── Technical Indicator Helpers ──

def sma(prices: list[float], period: int) -> list[float]:
    result = [0.0] * len(prices)
    for i in range(period - 1, len(prices)):
        result[i] = sum(prices[i - period + 1:i + 1]) / period
    return result

def ema(prices: list[float], period: int) -> list[float]:
    result = [0.0] * len(prices)
    if not prices:
        return result
    mult = 2.0 / (period + 1)
    result[0] = prices[0]
    for i in range(1, len(prices)):
        result[i] = prices[i] * mult + result[i - 1] * (1 - mult)
    return result

def rsi(prices: list[float], period: int = 14) -> list[float]:
    result = [50.0] * len(prices)
    if len(prices) < period + 1:
        return result

    gains = []
    losses = []
    for i in range(1, len(prices)):
        change = prices[i] - prices[i - 1]
        gains.append(max(change, 0))
        losses.append(max(-change, 0))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss > 0:
            rs = avg_gain / avg_loss
            result[i + 1] = 100 - 100 / (1 + rs)
        else:
            result[i + 1] = 100

    return result

def macd(prices: list[float], fast: int = 12, slow: int = 26, signal: int = 9) -> tuple:
    fast_ema = ema(prices, fast)
    slow_ema = ema(prices, slow)
    macd_line = [fast_ema[i] - slow_ema[i] for i in range(len(prices))]
    signal_line = ema(macd_line, signal)
    histogram = [macd_line[i] - signal_line[i] for i in range(len(prices))]
    return macd_line, signal_line, histogram

def bollinger_bands(prices: list[float], period: int = 20, std_mult: float = 2.0) -> tuple:
    middle = sma(prices, period)
    upper = [0.0] * len(prices)
    lower = [0.0] * len(prices)

    for i in range(period - 1, len(prices)):
        window = prices[i - period + 1:i + 1]
        avg = sum(window) / period
        std = math.sqrt(sum((x - avg) ** 2 for x in window) / period)
        upper[i] = avg + std_mult * std
        lower[i] = avg - std_mult * std

    return upper, middle, lower

def atr(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> list[float]:
    result = [0.0] * len(closes)
    trs = [highs[0] - lows[0]]

    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1])
        )
        trs.append(tr)

    if len(trs) >= period:
        result[period - 1] = sum(trs[:period]) / period
        for i in range(period, len(trs)):
            result[i] = (result[i - 1] * (period - 1) + trs[i]) / period

    return result

def stochastic(highs: list[float], lows: list[float], closes: list[float],
               k_period: int = 14, d_period: int = 3) -> tuple:
    k_values = [50.0] * len(closes)
    for i in range(k_period - 1, len(closes)):
        period_high = max(highs[i - k_period + 1:i + 1])
        period_low = min(lows[i - k_period + 1:i + 1])
        if period_high != period_low:
            k_values[i] = (closes[i] - period_low) / (period_high - period_low) * 100
        else:
            k_values[i] = 50.0
    d_values = sma(k_values, d_period)
    return k_values, d_values

def adx(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> list[float]:
    result = [0.0] * len(closes)
    if len(closes) < period * 2:
        return result

    plus_dm = [0.0] * len(closes)
    minus_dm = [0.0] * len(closes)
    tr_list = [0.0] * len(closes)

    for i in range(1, len(closes)):
        up = highs[i] - highs[i - 1]
        down = lows[i - 1] - lows[i]
        plus_dm[i] = up if up > down and up > 0 else 0
        minus_dm[i] = down if down > up and down > 0 else 0
        tr_list[i] = max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))

    smooth_tr = ema(tr_list, period)
    smooth_plus = ema(plus_dm, period)
    smooth_minus = ema(minus_dm, period)

    dx = [0.0] * len(closes)
    for i in range(period, len(closes)):
        if smooth_tr[i] > 0:
            plus_di = smooth_plus[i] / smooth_tr[i] * 100
            minus_di = smooth_minus[i] / smooth_tr[i] * 100
            denom = plus_di + minus_di
            if denom > 0:
                dx[i] = abs(plus_di - minus_di) / denom * 100

    result = ema(dx, period)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# BUILT-IN STRATEGIES
# ═══════════════════════════════════════════════════════════════════════════════

class StrategyCatalog:
    """Built-in trading strategy implementations."""

    @staticmethod
    def sma_crossover(bars: list[OHLCV], fast_period: int = 10, slow_period: int = 30) -> list[Signal]:
        """Simple moving average crossover strategy."""
        closes = [b.close for b in bars]
        fast_sma = sma(closes, fast_period)
        slow_sma = sma(closes, slow_period)

        signals = []
        position = 0  # 0 = flat, 1 = long, -1 = short

        for i in range(slow_period, len(bars)):
            if fast_sma[i] > slow_sma[i] and fast_sma[i - 1] <= slow_sma[i - 1]:
                if position <= 0:
                    signals.append(Signal(
                        timestamp=bars[i].timestamp,
                        signal_type=SignalType.BUY,
                        symbol="",
                        price=bars[i].close,
                        confidence=0.6,
                        reason=f"SMA({fast_period}) crossed above SMA({slow_period})",
                    ))
                    position = 1

            elif fast_sma[i] < slow_sma[i] and fast_sma[i - 1] >= slow_sma[i - 1]:
                if position >= 0:
                    signals.append(Signal(
                        timestamp=bars[i].timestamp,
                        signal_type=SignalType.SELL,
                        symbol="",
                        price=bars[i].close,
                        confidence=0.6,
                        reason=f"SMA({fast_period}) crossed below SMA({slow_period})",
                    ))
                    position = -1

        return signals

    @staticmethod
    def rsi_mean_reversion(bars: list[OHLCV], period: int = 14,
                            oversold: float = 30, overbought: float = 70) -> list[Signal]:
        """RSI-based mean reversion strategy."""
        closes = [b.close for b in bars]
        rsi_values = rsi(closes, period)

        signals = []
        position = 0

        for i in range(period + 1, len(bars)):
            if rsi_values[i] < oversold and position <= 0:
                signals.append(Signal(
                    timestamp=bars[i].timestamp,
                    signal_type=SignalType.BUY,
                    symbol="",
                    price=bars[i].close,
                    confidence=min(0.9, (oversold - rsi_values[i]) / oversold),
                    reason=f"RSI({period}) = {rsi_values[i]:.1f} (oversold)",
                ))
                position = 1

            elif rsi_values[i] > overbought and position >= 0:
                signals.append(Signal(
                    timestamp=bars[i].timestamp,
                    signal_type=SignalType.SELL,
                    symbol="",
                    price=bars[i].close,
                    confidence=min(0.9, (rsi_values[i] - overbought) / (100 - overbought)),
                    reason=f"RSI({period}) = {rsi_values[i]:.1f} (overbought)",
                ))
                position = -1

        return signals

    @staticmethod
    def macd_strategy(bars: list[OHLCV], fast: int = 12, slow: int = 26,
                      signal_period: int = 9) -> list[Signal]:
        """MACD crossover strategy."""
        closes = [b.close for b in bars]
        macd_line, sig_line, hist = macd(closes, fast, slow, signal_period)

        signals = []
        position = 0

        for i in range(slow + signal_period, len(bars)):
            if hist[i] > 0 and hist[i - 1] <= 0:
                if position <= 0:
                    signals.append(Signal(
                        timestamp=bars[i].timestamp,
                        signal_type=SignalType.BUY,
                        symbol="",
                        price=bars[i].close,
                        confidence=0.65,
                        reason=f"MACD histogram turned positive",
                    ))
                    position = 1

            elif hist[i] < 0 and hist[i - 1] >= 0:
                if position >= 0:
                    signals.append(Signal(
                        timestamp=bars[i].timestamp,
                        signal_type=SignalType.SELL,
                        symbol="",
                        price=bars[i].close,
                        confidence=0.65,
                        reason=f"MACD histogram turned negative",
                    ))
                    position = -1

        return signals

    @staticmethod
    def bollinger_mean_reversion(bars: list[OHLCV], period: int = 20,
                                  std_mult: float = 2.0) -> list[Signal]:
        """Bollinger Bands mean reversion."""
        closes = [b.close for b in bars]
        upper, middle, lower = bollinger_bands(closes, period, std_mult)

        signals = []
        position = 0

        for i in range(period, len(bars)):
            if closes[i] < lower[i] and position <= 0:
                signals.append(Signal(
                    timestamp=bars[i].timestamp,
                    signal_type=SignalType.BUY,
                    symbol="",
                    price=bars[i].close,
                    confidence=0.7,
                    reason="Price below lower Bollinger Band",
                ))
                position = 1

            elif closes[i] > upper[i] and position >= 0:
                signals.append(Signal(
                    timestamp=bars[i].timestamp,
                    signal_type=SignalType.SELL,
                    symbol="",
                    price=bars[i].close,
                    confidence=0.7,
                    reason="Price above upper Bollinger Band",
                ))
                position = -1

            elif position == 1 and closes[i] > middle[i]:
                signals.append(Signal(
                    timestamp=bars[i].timestamp,
                    signal_type=SignalType.SELL,
                    symbol="",
                    price=bars[i].close,
                    confidence=0.5,
                    reason="Price returned to middle band (take profit)",
                ))
                position = 0

        return signals

    @staticmethod
    def dual_momentum(bars_asset: list[OHLCV], bars_benchmark: list[OHLCV],
                      lookback: int = 252) -> list[Signal]:
        """Dual momentum: absolute + relative momentum."""
        closes_asset = [b.close for b in bars_asset]
        closes_bench = [b.close for b in bars_benchmark]

        signals = []
        position = 0

        for i in range(lookback, min(len(bars_asset), len(bars_benchmark))):
            asset_mom = closes_asset[i] / closes_asset[i - lookback] - 1
            bench_mom = closes_bench[i] / closes_bench[i - lookback] - 1
            rf_return = RISK_FREE_RATE * lookback / TRADING_DAYS

            # Absolute momentum: asset return > risk-free
            # Relative momentum: asset > benchmark
            if asset_mom > rf_return and asset_mom > bench_mom:
                if position <= 0:
                    signals.append(Signal(
                        timestamp=bars_asset[i].timestamp,
                        signal_type=SignalType.BUY,
                        symbol="",
                        price=bars_asset[i].close,
                        confidence=0.7,
                        reason=f"Dual momentum: asset={asset_mom:.2%}, bench={bench_mom:.2%}",
                    ))
                    position = 1
            else:
                if position > 0:
                    signals.append(Signal(
                        timestamp=bars_asset[i].timestamp,
                        signal_type=SignalType.SELL,
                        symbol="",
                        price=bars_asset[i].close,
                        confidence=0.6,
                        reason=f"Dual momentum exit",
                    ))
                    position = 0

        return signals

    @staticmethod
    def trend_following(bars: list[OHLCV], atr_period: int = 14,
                        atr_mult: float = 2.0, ema_period: int = 50) -> list[Signal]:
        """Trend following with ATR-based stops."""
        closes = [b.close for b in bars]
        highs = [b.high for b in bars]
        lows = [b.low for b in bars]

        ema_values = ema(closes, ema_period)
        atr_values = atr(highs, lows, closes, atr_period)

        signals = []
        position = 0
        entry_price = 0
        stop_loss = 0

        for i in range(max(atr_period, ema_period), len(bars)):
            if position == 0:
                # Entry: price above EMA + rising ATR
                if closes[i] > ema_values[i] and closes[i] > closes[i - 1]:
                    entry_price = closes[i]
                    stop_loss = entry_price - atr_mult * atr_values[i]
                    signals.append(Signal(
                        timestamp=bars[i].timestamp,
                        signal_type=SignalType.BUY,
                        symbol="",
                        price=closes[i],
                        confidence=0.65,
                        reason=f"Trend entry: price > EMA({ema_period}), stop={stop_loss:.2f}",
                        metadata={"stop_loss": stop_loss},
                    ))
                    position = 1

            elif position == 1:
                # Trail stop
                new_stop = closes[i] - atr_mult * atr_values[i]
                stop_loss = max(stop_loss, new_stop)

                if closes[i] < stop_loss:
                    signals.append(Signal(
                        timestamp=bars[i].timestamp,
                        signal_type=SignalType.SELL,
                        symbol="",
                        price=closes[i],
                        confidence=0.8,
                        reason=f"Trailing stop hit: {stop_loss:.2f}",
                    ))
                    position = 0

        return signals

    @staticmethod
    def pairs_trading(bars_a: list[OHLCV], bars_b: list[OHLCV],
                      window: int = 60, entry_z: float = 2.0,
                      exit_z: float = 0.5) -> list[Signal]:
        """Statistical arbitrage pairs trading."""
        closes_a = [b.close for b in bars_a]
        closes_b = [b.close for b in bars_b]

        min_len = min(len(closes_a), len(closes_b))
        # Calculate spread (ratio)
        ratios = [closes_a[i] / closes_b[i] for i in range(min_len)]

        signals = []
        position = 0  # 0=flat, 1=long_spread, -1=short_spread

        for i in range(window, min_len):
            window_ratios = ratios[i - window:i]
            mean = sum(window_ratios) / window
            std = math.sqrt(sum((r - mean) ** 2 for r in window_ratios) / window)
            z_score = (ratios[i] - mean) / std if std > 0 else 0

            if z_score > entry_z and position <= 0:
                signals.append(Signal(
                    timestamp=bars_a[i].timestamp,
                    signal_type=SignalType.SELL,  # Sell A, buy B
                    symbol="",
                    price=closes_a[i],
                    confidence=min(0.9, abs(z_score) / 3),
                    reason=f"Pairs: spread z-score={z_score:.2f} (short spread)",
                    metadata={"z_score": z_score, "action": "short_A_long_B"},
                ))
                position = -1

            elif z_score < -entry_z and position >= 0:
                signals.append(Signal(
                    timestamp=bars_a[i].timestamp,
                    signal_type=SignalType.BUY,  # Buy A, sell B
                    symbol="",
                    price=closes_a[i],
                    confidence=min(0.9, abs(z_score) / 3),
                    reason=f"Pairs: spread z-score={z_score:.2f} (long spread)",
                    metadata={"z_score": z_score, "action": "long_A_short_B"},
                ))
                position = 1

            elif abs(z_score) < exit_z and position != 0:
                signals.append(Signal(
                    timestamp=bars_a[i].timestamp,
                    signal_type=SignalType.SELL if position == 1 else SignalType.BUY,
                    symbol="",
                    price=closes_a[i],
                    confidence=0.5,
                    reason=f"Pairs: z-score reverted to {z_score:.2f}",
                    metadata={"z_score": z_score, "action": "close"},
                ))
                position = 0

        return signals


# ═══════════════════════════════════════════════════════════════════════════════
# §3.2 — BACKTEST EXECUTION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Trade:
    entry_time: str
    exit_time: str
    symbol: str
    side: str  # long, short
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    pnl_pct: float
    commission: float
    slippage: float
    holding_period: int  # bars
    exit_reason: str = ""


@dataclass
class BacktestResult:
    strategy_name: str
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float
    final_equity: float
    total_return: float
    annualized_return: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    max_drawdown_duration: int
    calmar_ratio: float
    win_rate: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    avg_trade: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_holding_period: float
    total_commission: float
    total_slippage: float
    exposure_time: float  # % time in market
    equity_curve: list = field(default_factory=list)
    drawdown_curve: list = field(default_factory=list)
    monthly_returns: list = field(default_factory=list)
    trades: list = field(default_factory=list)
    run_hash: str = ""


class BacktestEngine:
    """Execute strategy backtests deterministically."""

    def __init__(self, config: StrategyConfig):
        self.config = config
        self.equity = config.initial_capital
        self.cash = config.initial_capital
        self.position_qty = 0.0
        self.position_side = ""
        self.entry_price = 0.0
        self.entry_time = ""
        self.trades: list[Trade] = []
        self.equity_curve: list[dict] = []
        self.peak_equity = config.initial_capital

    def run(self, bars: list[OHLCV], signals: list[Signal]) -> BacktestResult:
        """Execute backtest with given bars and signals."""
        self.equity = self.config.initial_capital
        self.cash = self.config.initial_capital
        self.position_qty = 0
        self.trades = []
        self.equity_curve = []
        self.peak_equity = self.config.initial_capital

        # Index signals by timestamp
        signal_map: dict[str, Signal] = {}
        for s in signals:
            signal_map[s.timestamp] = s

        for i, bar in enumerate(bars):
            # Update equity if in position
            if self.position_qty > 0:
                self.equity = self.cash + self.position_qty * bar.close
            else:
                self.equity = self.cash

            self.equity_curve.append({
                "timestamp": bar.timestamp,
                "equity": round(self.equity, 2),
                "price": bar.close,
            })

            self.peak_equity = max(self.peak_equity, self.equity)

            # Check stop loss / take profit
            if self.position_qty > 0:
                pnl_pct = (bar.close - self.entry_price) / self.entry_price
                if self.position_side == "long":
                    if pnl_pct <= -self.config.stop_loss_pct:
                        self._close_position(bar, "stop_loss")
                        continue
                    if pnl_pct >= self.config.take_profit_pct:
                        self._close_position(bar, "take_profit")
                        continue

            # Process signal
            signal = signal_map.get(bar.timestamp)
            if signal:
                if signal.signal_type in (SignalType.BUY, "buy"):
                    if self.position_qty <= 0:
                        if self.position_qty < 0:
                            self._close_position(bar, "signal_reversal")
                        self._open_position(bar, "long")

                elif signal.signal_type in (SignalType.SELL, "sell"):
                    if self.position_qty > 0:
                        self._close_position(bar, "signal_sell")
                    elif self.config.allow_short and self.position_qty == 0:
                        self._open_position(bar, "short")

        # Close any remaining position
        if self.position_qty != 0 and bars:
            self._close_position(bars[-1], "end_of_backtest")

        return self._compile_results(bars)

    def _open_position(self, bar: OHLCV, side: str):
        # Apply slippage
        slippage = bar.close * self.config.slippage
        fill_price = bar.close + slippage if side == "long" else bar.close - slippage

        # Position sizing
        max_value = self.cash * self.config.max_position_pct / self.config.max_position_pct  # Use available cash
        qty = int(self.cash * 0.95 / fill_price)  # Use 95% of cash
        if qty <= 0:
            return

        commission = qty * fill_price * self.config.commission

        self.position_qty = qty
        self.position_side = side
        self.entry_price = fill_price
        self.entry_time = bar.timestamp
        self.cash -= qty * fill_price + commission

    def _close_position(self, bar: OHLCV, reason: str):
        if self.position_qty == 0:
            return

        slippage = bar.close * self.config.slippage
        if self.position_side == "long":
            fill_price = bar.close - slippage
        else:
            fill_price = bar.close + slippage

        commission = abs(self.position_qty) * fill_price * self.config.commission

        if self.position_side == "long":
            pnl = (fill_price - self.entry_price) * self.position_qty
        else:
            pnl = (self.entry_price - fill_price) * abs(self.position_qty)

        pnl -= commission
        pnl_pct = pnl / (self.entry_price * abs(self.position_qty)) if self.entry_price > 0 else 0

        # Calculate holding period
        try:
            entry_dt = datetime.strptime(self.entry_time[:10], "%Y-%m-%d")
            exit_dt = datetime.strptime(bar.timestamp[:10], "%Y-%m-%d")
            holding = (exit_dt - entry_dt).days
        except:
            holding = 1

        self.trades.append(Trade(
            entry_time=self.entry_time,
            exit_time=bar.timestamp,
            symbol=self.config.symbols[0] if self.config.symbols else "",
            side=self.position_side,
            entry_price=self.entry_price,
            exit_price=fill_price,
            quantity=abs(self.position_qty),
            pnl=round(pnl, 2),
            pnl_pct=round(pnl_pct * 100, 2),
            commission=round(commission, 2),
            slippage=round(slippage * abs(self.position_qty), 2),
            holding_period=holding,
            exit_reason=reason,
        ))

        self.cash += abs(self.position_qty) * fill_price - commission + pnl
        self.position_qty = 0
        self.position_side = ""

    def _compile_results(self, bars: list[OHLCV]) -> BacktestResult:
        if not self.equity_curve:
            return BacktestResult(
                strategy_name=self.config.name,
                symbol=self.config.symbols[0] if self.config.symbols else "",
                start_date="", end_date="",
                initial_capital=self.config.initial_capital,
                final_equity=self.config.initial_capital,
                total_return=0, annualized_return=0,
                sharpe_ratio=0, sortino_ratio=0,
                max_drawdown=0, max_drawdown_duration=0,
                calmar_ratio=0, win_rate=0, profit_factor=0,
                avg_win=0, avg_loss=0, avg_trade=0,
                total_trades=0, winning_trades=0, losing_trades=0,
                avg_holding_period=0, total_commission=0, total_slippage=0,
                exposure_time=0,
            )

        final_equity = self.equity_curve[-1]["equity"]
        total_return = (final_equity / self.config.initial_capital - 1) * 100

        # Daily returns from equity curve
        daily_returns = []
        for i in range(1, len(self.equity_curve)):
            prev = self.equity_curve[i - 1]["equity"]
            curr = self.equity_curve[i]["equity"]
            if prev > 0:
                daily_returns.append(curr / prev - 1)

        # Annualized return
        num_days = len(self.equity_curve)
        years = num_days / TRADING_DAYS
        ann_return = ((final_equity / self.config.initial_capital) ** (1 / years) - 1) * 100 if years > 0 else 0

        # Volatility & Sharpe
        daily_vol = _std(daily_returns) if daily_returns else 0
        ann_vol = daily_vol * math.sqrt(TRADING_DAYS)
        sharpe = (ann_return / 100 - RISK_FREE_RATE) / ann_vol if ann_vol > 0 else 0

        # Sortino
        down_returns = [r for r in daily_returns if r < 0]
        down_vol = _std(down_returns) * math.sqrt(TRADING_DAYS) if down_returns else ann_vol
        sortino = (ann_return / 100 - RISK_FREE_RATE) / down_vol if down_vol > 0 else 0

        # Max drawdown
        peak = self.equity_curve[0]["equity"]
        max_dd = 0
        dd_start = 0
        dd_duration = 0
        max_dd_duration = 0
        current_dd_start = 0

        for i, e in enumerate(self.equity_curve):
            if e["equity"] > peak:
                peak = e["equity"]
                if dd_duration > max_dd_duration:
                    max_dd_duration = dd_duration
                dd_duration = 0
            else:
                dd = (peak - e["equity"]) / peak * 100
                if dd > max_dd:
                    max_dd = dd
                dd_duration += 1

        # Drawdown curve
        peak = self.equity_curve[0]["equity"]
        dd_curve = []
        for e in self.equity_curve:
            peak = max(peak, e["equity"])
            dd_curve.append({
                "timestamp": e["timestamp"],
                "drawdown": round((peak - e["equity"]) / peak * 100, 2),
            })

        # Trade statistics
        wins = [t for t in self.trades if t.pnl > 0]
        losses = [t for t in self.trades if t.pnl <= 0]
        total_trades = len(self.trades)
        win_rate = len(wins) / total_trades * 100 if total_trades > 0 else 0

        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 999

        avg_win = _mean([t.pnl for t in wins]) if wins else 0
        avg_loss = _mean([t.pnl for t in losses]) if losses else 0
        avg_trade = _mean([t.pnl for t in self.trades]) if self.trades else 0
        avg_holding = _mean([t.holding_period for t in self.trades]) if self.trades else 0

        total_commission = sum(t.commission for t in self.trades)
        total_slippage = sum(t.slippage for t in self.trades)

        # Exposure time
        bars_in_market = sum(1 for t in self.trades for _ in range(max(t.holding_period, 1)))
        exposure = bars_in_market / num_days * 100 if num_days > 0 else 0

        # Monthly returns
        monthly = defaultdict(float)
        for i in range(1, len(self.equity_curve)):
            month = self.equity_curve[i]["timestamp"][:7]
            prev = self.equity_curve[i - 1]["equity"]
            curr = self.equity_curve[i]["equity"]
            if prev > 0:
                monthly[month] += curr / prev - 1

        monthly_returns = [{"month": m, "return": round(r * 100, 2)} for m, r in sorted(monthly.items())]

        # Generate deterministic hash
        hash_input = json.dumps({
            "strategy": self.config.name,
            "trades": len(self.trades),
            "final_equity": round(final_equity, 2),
        })
        run_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:16]

        calmar = ann_return / max_dd if max_dd > 0 else 0

        return BacktestResult(
            strategy_name=self.config.name,
            symbol=self.config.symbols[0] if self.config.symbols else "",
            start_date=bars[0].timestamp if bars else "",
            end_date=bars[-1].timestamp if bars else "",
            initial_capital=self.config.initial_capital,
            final_equity=round(final_equity, 2),
            total_return=round(total_return, 2),
            annualized_return=round(ann_return, 2),
            sharpe_ratio=round(sharpe, 3),
            sortino_ratio=round(sortino, 3),
            max_drawdown=round(max_dd, 2),
            max_drawdown_duration=max_dd_duration,
            calmar_ratio=round(calmar, 3),
            win_rate=round(win_rate, 1),
            profit_factor=round(profit_factor, 2),
            avg_win=round(avg_win, 2),
            avg_loss=round(avg_loss, 2),
            avg_trade=round(avg_trade, 2),
            total_trades=total_trades,
            winning_trades=len(wins),
            losing_trades=len(losses),
            avg_holding_period=round(avg_holding, 1),
            total_commission=round(total_commission, 2),
            total_slippage=round(total_slippage, 2),
            exposure_time=round(exposure, 1),
            equity_curve=self.equity_curve,
            drawdown_curve=dd_curve,
            monthly_returns=monthly_returns,
            trades=[asdict(t) for t in self.trades],
            run_hash=run_hash,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# §3.4 — WALK-FORWARD & OPTIMIZATION
# ═══════════════════════════════════════════════════════════════════════════════

class WalkForwardOptimizer:
    """Walk-forward optimization and parameter tuning."""

    def __init__(self, data_loader: DataLoader):
        self.data = data_loader

    async def optimize(self, symbol: str, start: str, end: str,
                        strategy_name: str, param_grid: dict,
                        metric: str = "sharpe_ratio",
                        in_sample_pct: float = 0.70) -> dict:
        """Grid-search optimization with in-sample/out-of-sample split."""
        bars = await self.data.load(symbol, start, end)
        if not bars:
            return {"error": "No data available"}

        split_idx = int(len(bars) * in_sample_pct)
        in_sample = bars[:split_idx]
        out_sample = bars[split_idx:]

        # Generate parameter combinations
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())

        def _generate_combos(values, idx=0, current=None):
            if current is None:
                current = {}
            if idx == len(values):
                yield dict(current)
                return
            for v in values[idx]:
                current[param_names[idx]] = v
                yield from _generate_combos(values, idx + 1, current)

        combos = list(_generate_combos(param_values))
        results = []

        strategy_map = {
            "sma_crossover": StrategyCatalog.sma_crossover,
            "rsi_mean_reversion": StrategyCatalog.rsi_mean_reversion,
            "macd": StrategyCatalog.macd_strategy,
            "bollinger": StrategyCatalog.bollinger_mean_reversion,
            "trend_following": StrategyCatalog.trend_following,
        }

        strategy_func = strategy_map.get(strategy_name)
        if not strategy_func:
            return {"error": f"Unknown strategy: {strategy_name}"}

        for params in combos:
            # In-sample backtest
            signals = strategy_func(in_sample, **params)
            config = StrategyConfig(name=strategy_name, symbols=[symbol], parameters=params)
            engine = BacktestEngine(config)
            is_result = engine.run(in_sample, signals)

            # Out-of-sample backtest
            signals_oos = strategy_func(out_sample, **params)
            engine_oos = BacktestEngine(config)
            oos_result = engine_oos.run(out_sample, signals_oos)

            results.append({
                "params": params,
                "in_sample": {
                    "sharpe": is_result.sharpe_ratio,
                    "return": is_result.total_return,
                    "max_dd": is_result.max_drawdown,
                    "trades": is_result.total_trades,
                    "win_rate": is_result.win_rate,
                },
                "out_of_sample": {
                    "sharpe": oos_result.sharpe_ratio,
                    "return": oos_result.total_return,
                    "max_dd": oos_result.max_drawdown,
                    "trades": oos_result.total_trades,
                    "win_rate": oos_result.win_rate,
                },
            })

        # Sort by in-sample metric
        results.sort(key=lambda r: r["in_sample"].get(metric.replace("_ratio", ""), 0), reverse=True)

        best = results[0] if results else None

        return {
            "strategy": strategy_name,
            "symbol": symbol,
            "total_combinations": len(combos),
            "best_params": best["params"] if best else {},
            "best_in_sample": best["in_sample"] if best else {},
            "best_out_of_sample": best["out_of_sample"] if best else {},
            "robustness_ratio": round(
                best["out_of_sample"]["sharpe"] / best["in_sample"]["sharpe"], 2
            ) if best and best["in_sample"]["sharpe"] > 0 else 0,
            "top_10_results": results[:10],
        }

    async def walk_forward(self, symbol: str, start: str, end: str,
                            strategy_name: str, params: dict,
                            window_size: int = 252,
                            step_size: int = 63) -> dict:
        """Rolling walk-forward analysis."""
        bars = await self.data.load(symbol, start, end)
        if len(bars) < window_size + step_size:
            return {"error": "Insufficient data for walk-forward"}

        strategy_map = {
            "sma_crossover": StrategyCatalog.sma_crossover,
            "rsi_mean_reversion": StrategyCatalog.rsi_mean_reversion,
            "macd": StrategyCatalog.macd_strategy,
            "bollinger": StrategyCatalog.bollinger_mean_reversion,
        }

        strategy_func = strategy_map.get(strategy_name)
        if not strategy_func:
            return {"error": f"Unknown strategy: {strategy_name}"}

        windows = []
        total_oos_return = 1.0

        i = 0
        while i + window_size + step_size <= len(bars):
            in_sample = bars[i:i + window_size]
            out_sample = bars[i + window_size:i + window_size + step_size]

            signals_is = strategy_func(in_sample, **params)
            config = StrategyConfig(name=strategy_name, symbols=[symbol], parameters=params)
            engine_is = BacktestEngine(config)
            is_result = engine_is.run(in_sample, signals_is)

            signals_oos = strategy_func(out_sample, **params)
            engine_oos = BacktestEngine(config)
            oos_result = engine_oos.run(out_sample, signals_oos)

            period_return = oos_result.total_return / 100
            total_oos_return *= (1 + period_return)

            windows.append({
                "period": f"{out_sample[0].timestamp[:10]} to {out_sample[-1].timestamp[:10]}",
                "in_sample_sharpe": is_result.sharpe_ratio,
                "oos_return": round(oos_result.total_return, 2),
                "oos_sharpe": oos_result.sharpe_ratio,
                "oos_trades": oos_result.total_trades,
            })

            i += step_size

        return {
            "strategy": strategy_name,
            "symbol": symbol,
            "num_windows": len(windows),
            "cumulative_oos_return": round((total_oos_return - 1) * 100, 2),
            "avg_oos_sharpe": round(_mean([w["oos_sharpe"] for w in windows]), 3),
            "consistency": round(sum(1 for w in windows if w["oos_return"] > 0) / len(windows) * 100, 1) if windows else 0,
            "windows": windows,
        }

    async def monte_carlo_analysis(self, trades: list[Trade], num_sims: int = 1000,
                                     initial_capital: float = 100000) -> dict:
        """Monte Carlo simulation on trade sequence."""
        if not trades:
            return {"error": "No trades to simulate"}

        trade_returns = [t.pnl_pct / 100 for t in trades]

        final_equities = []
        max_drawdowns = []
        sharpes = []

        for _ in range(num_sims):
            shuffled = trade_returns[:]
            random.shuffle(shuffled)

            equity = initial_capital
            peak = equity
            max_dd = 0
            returns = []

            for ret in shuffled:
                equity *= (1 + ret)
                returns.append(ret)
                peak = max(peak, equity)
                dd = (peak - equity) / peak
                max_dd = max(max_dd, dd)

            final_equities.append(equity)
            max_drawdowns.append(max_dd)

            avg_r = _mean(returns)
            std_r = _std(returns)
            sharpe = avg_r / std_r * math.sqrt(TRADING_DAYS) if std_r > 0 else 0
            sharpes.append(sharpe)

        sorted_eq = sorted(final_equities)
        sorted_dd = sorted(max_drawdowns)

        return {
            "num_simulations": num_sims,
            "initial_capital": initial_capital,
            "median_final_equity": round(sorted_eq[len(sorted_eq) // 2], 2),
            "mean_final_equity": round(_mean(final_equities), 2),
            "worst_final_equity": round(sorted_eq[0], 2),
            "best_final_equity": round(sorted_eq[-1], 2),
            "pct_5_equity": round(_percentile(final_equities, 0.05), 2),
            "pct_25_equity": round(_percentile(final_equities, 0.25), 2),
            "pct_75_equity": round(_percentile(final_equities, 0.75), 2),
            "pct_95_equity": round(_percentile(final_equities, 0.95), 2),
            "median_max_drawdown": round(sorted_dd[len(sorted_dd) // 2] * 100, 2),
            "worst_max_drawdown": round(sorted_dd[-1] * 100, 2),
            "prob_profit": round(sum(1 for e in final_equities if e > initial_capital) / num_sims * 100, 1),
            "prob_ruin_50pct": round(sum(1 for e in final_equities if e < initial_capital * 0.5) / num_sims * 100, 1),
            "mean_sharpe": round(_mean(sharpes), 3),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED STRATEGY ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class StrategyEngine:
    """
    Unified entry point for strategy backtesting and optimization.
    """

    def __init__(self):
        self.data_loader = DataLoader()
        self.optimizer = WalkForwardOptimizer(self.data_loader)
        self.catalog = StrategyCatalog()
        self._results_cache: dict[str, BacktestResult] = {}

    async def backtest(self, symbol: str, strategy_name: str,
                        start: str = "2022-01-01", end: str = "2024-01-01",
                        params: Optional[dict] = None,
                        config_overrides: Optional[dict] = None) -> dict:
        """Run a full backtest."""
        bars = await self.data_loader.load(symbol, start, end)
        if not bars:
            return {"error": "No historical data available"}

        params = params or {}
        strategy_map = {
            "sma_crossover": self.catalog.sma_crossover,
            "rsi_mean_reversion": self.catalog.rsi_mean_reversion,
            "macd": self.catalog.macd_strategy,
            "bollinger": self.catalog.bollinger_mean_reversion,
            "trend_following": self.catalog.trend_following,
        }

        strategy_func = strategy_map.get(strategy_name)
        if not strategy_func:
            return {"error": f"Available strategies: {list(strategy_map.keys())}"}

        signals = strategy_func(bars, **params)

        config = StrategyConfig(
            name=strategy_name,
            symbols=[symbol],
            parameters=params,
            **(config_overrides or {}),
        )

        engine = BacktestEngine(config)
        result = engine.run(bars, signals)

        # Cache result
        self._results_cache[f"{symbol}_{strategy_name}"] = result

        return asdict(result)

    async def optimize_strategy(self, symbol: str, strategy_name: str,
                                  start: str = "2020-01-01", end: str = "2024-01-01",
                                  param_grid: Optional[dict] = None) -> dict:
        """Optimize strategy parameters."""
        if param_grid is None:
            default_grids = {
                "sma_crossover": {"fast_period": [5, 10, 15, 20], "slow_period": [20, 30, 50, 100]},
                "rsi_mean_reversion": {"period": [7, 14, 21], "oversold": [20, 25, 30], "overbought": [70, 75, 80]},
                "macd": {"fast": [8, 12, 16], "slow": [21, 26, 30], "signal_period": [7, 9, 12]},
                "bollinger": {"period": [15, 20, 25, 30], "std_mult": [1.5, 2.0, 2.5]},
            }
            param_grid = default_grids.get(strategy_name, {})

        return await self.optimizer.optimize(symbol, start, end, strategy_name, param_grid)

    async def walk_forward_analysis(self, symbol: str, strategy_name: str,
                                      params: dict, start: str = "2020-01-01",
                                      end: str = "2024-01-01") -> dict:
        return await self.optimizer.walk_forward(symbol, start, end, strategy_name, params)

    async def monte_carlo(self, symbol: str, strategy_name: str,
                           start: str = "2020-01-01", end: str = "2024-01-01",
                           params: Optional[dict] = None) -> dict:
        """Run Monte Carlo simulation on a strategy's trades."""
        result = await self.backtest(symbol, strategy_name, start, end, params)
        if "error" in result:
            return result

        trades = [Trade(**t) for t in result.get("trades", [])]
        return await self.optimizer.monte_carlo_analysis(trades)

    def list_strategies(self) -> list[dict]:
        return [
            {"name": "sma_crossover", "description": "Simple moving average crossover", "params": ["fast_period", "slow_period"]},
            {"name": "rsi_mean_reversion", "description": "RSI-based mean reversion", "params": ["period", "oversold", "overbought"]},
            {"name": "macd", "description": "MACD histogram crossover", "params": ["fast", "slow", "signal_period"]},
            {"name": "bollinger", "description": "Bollinger Bands mean reversion", "params": ["period", "std_mult"]},
            {"name": "trend_following", "description": "EMA + ATR trend following with trailing stops", "params": ["atr_period", "atr_mult", "ema_period"]},
            {"name": "dual_momentum", "description": "Absolute + relative momentum (requires benchmark)", "params": ["lookback"]},
            {"name": "pairs_trading", "description": "Statistical arbitrage pairs trading", "params": ["window", "entry_z", "exit_z"]},
        ]


# ── Singleton ──
_strategy_engine: Optional[StrategyEngine] = None

def get_strategy_engine() -> StrategyEngine:
    global _strategy_engine
    if _strategy_engine is None:
        _strategy_engine = StrategyEngine()
    return _strategy_engine
