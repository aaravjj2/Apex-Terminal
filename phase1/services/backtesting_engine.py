"""
Apex Terminal — Bloomberg-Grade Backtesting Engine v2
=====================================================

Industrial-strength backtesting framework with:
- Walk-forward analysis and optimization
- Monte Carlo simulation for strategy robustness
- Multi-strategy portfolio backtesting
- Comprehensive performance analytics (Sharpe, Sortino, Calmar, etc.)
- Drawdown analysis and recovery statistics
- Trade-level analytics with MAE/MFE
- Benchmark comparison and alpha/beta decomposition
- Position sizing models (Kelly, fixed fractional, volatility targeting)
- Commission and slippage modeling
- Strategy signal generation (SMA cross, RSI, MACD, Bollinger, etc.)

Pure computation module — no FastAPI/DB imports.
"""

from __future__ import annotations

import math
import uuid
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

import numpy as np


# ─── Enums ───────────────────────────────────────────────────────────────────

class SignalType(Enum):
    BUY = "buy"
    SELL = "sell"
    SHORT = "short"
    COVER = "cover"
    HOLD = "hold"


class PositionSizingMethod(Enum):
    FIXED_FRACTIONAL = "fixed_fractional"
    KELLY_CRITERION = "kelly_criterion"
    VOLATILITY_TARGET = "volatility_target"
    EQUAL_WEIGHT = "equal_weight"
    RISK_PARITY = "risk_parity"
    FIXED_DOLLAR = "fixed_dollar"
    PERCENT_OF_EQUITY = "percent_of_equity"
    ATR_BASED = "atr_based"


class StrategyType(Enum):
    SMA_CROSSOVER = "sma_crossover"
    EMA_CROSSOVER = "ema_crossover"
    RSI_MEAN_REVERSION = "rsi_mean_reversion"
    MACD_TREND = "macd_trend"
    BOLLINGER_BREAKOUT = "bollinger_breakout"
    MOMENTUM = "momentum"
    PAIRS_TRADING = "pairs_trading"
    MEAN_REVERSION = "mean_reversion"
    BREAKOUT = "breakout"
    VWAP_STRATEGY = "vwap_strategy"
    DONCHIAN_CHANNEL = "donchian_channel"
    KELTNER_CHANNEL = "keltner_channel"
    ICHIMOKU = "ichimoku"
    TRIPLE_SCREEN = "triple_screen"
    CUSTOM = "custom"


class BenchmarkType(Enum):
    BUY_AND_HOLD = "buy_and_hold"
    SPY = "spy"
    EQUAL_WEIGHT = "equal_weight"
    RISK_FREE = "risk_free"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class OHLCV:
    """Single bar of OHLCV data."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    def typical_price(self) -> float:
        return (self.high + self.low + self.close) / 3.0

    def true_range(self, prev_close: float | None = None) -> float:
        if prev_close is None:
            return self.high - self.low
        return max(self.high - self.low, abs(self.high - prev_close), abs(self.low - prev_close))

    def body_size(self) -> float:
        return abs(self.close - self.open)

    def is_bullish(self) -> bool:
        return self.close > self.open

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
        }


@dataclass
class TradeRecord:
    """Record of a single completed trade."""
    trade_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    symbol: str = ""
    side: str = "long"  # long or short
    entry_time: datetime | None = None
    exit_time: datetime | None = None
    entry_price: float = 0.0
    exit_price: float = 0.0
    quantity: float = 0.0
    commission: float = 0.0
    slippage: float = 0.0
    mae: float = 0.0  # Maximum Adverse Excursion
    mfe: float = 0.0  # Maximum Favorable Excursion
    bars_held: int = 0

    @property
    def gross_pnl(self) -> float:
        if self.side == "long":
            return (self.exit_price - self.entry_price) * self.quantity
        return (self.entry_price - self.exit_price) * self.quantity

    @property
    def net_pnl(self) -> float:
        return self.gross_pnl - self.commission - self.slippage

    @property
    def return_pct(self) -> float:
        if self.entry_price == 0:
            return 0.0
        if self.side == "long":
            return (self.exit_price / self.entry_price - 1.0) * 100.0
        return (self.entry_price / self.exit_price - 1.0) * 100.0

    @property
    def is_winner(self) -> bool:
        return self.net_pnl > 0

    @property
    def risk_reward_ratio(self) -> float:
        if self.mae == 0:
            return 0.0
        return abs(self.mfe / self.mae)

    def to_dict(self) -> dict:
        return {
            "trade_id": self.trade_id,
            "symbol": self.symbol,
            "side": self.side,
            "entry_time": self.entry_time.isoformat() if self.entry_time else None,
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "quantity": self.quantity,
            "gross_pnl": self.gross_pnl,
            "net_pnl": self.net_pnl,
            "return_pct": self.return_pct,
            "commission": self.commission,
            "mae": self.mae,
            "mfe": self.mfe,
            "bars_held": self.bars_held,
        }


@dataclass
class EquityCurvePoint:
    """Single point on the equity curve."""
    timestamp: datetime
    equity: float
    cash: float
    positions_value: float
    drawdown_pct: float = 0.0
    daily_return: float = 0.0


@dataclass
class DrawdownInfo:
    """Information about a drawdown period."""
    start_time: datetime
    end_time: datetime | None = None
    recovery_time: datetime | None = None
    peak_equity: float = 0.0
    trough_equity: float = 0.0
    drawdown_pct: float = 0.0
    duration_bars: int = 0
    recovery_bars: int = 0
    is_recovered: bool = False

    @property
    def depth(self) -> float:
        if self.peak_equity == 0:
            return 0.0
        return (self.peak_equity - self.trough_equity) / self.peak_equity * 100.0


# ─── Strategy Signal Generators ──────────────────────────────────────────────

class StrategySignalGenerator:
    """Generates trading signals from OHLCV data using various strategies."""

    @staticmethod
    def sma_crossover(bars: list[OHLCV], fast_period: int = 10, slow_period: int = 30) -> list[SignalType]:
        """Simple Moving Average crossover strategy."""
        signals = []
        closes = [b.close for b in bars]
        n = len(closes)

        for i in range(n):
            if i < slow_period:
                signals.append(SignalType.HOLD)
                continue

            fast_sma = sum(closes[i - fast_period + 1:i + 1]) / fast_period
            slow_sma = sum(closes[i - slow_period + 1:i + 1]) / slow_period

            prev_fast = sum(closes[i - fast_period:i]) / fast_period
            prev_slow = sum(closes[i - slow_period:i]) / slow_period

            if fast_sma > slow_sma and prev_fast <= prev_slow:
                signals.append(SignalType.BUY)
            elif fast_sma < slow_sma and prev_fast >= prev_slow:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)

        return signals

    @staticmethod
    def ema_crossover(bars: list[OHLCV], fast_period: int = 12, slow_period: int = 26) -> list[SignalType]:
        """Exponential Moving Average crossover strategy."""
        signals = []
        closes = [b.close for b in bars]
        n = len(closes)

        fast_k = 2.0 / (fast_period + 1)
        slow_k = 2.0 / (slow_period + 1)

        fast_ema = closes[0] if closes else 0.0
        slow_ema = closes[0] if closes else 0.0

        prev_fast = fast_ema
        prev_slow = slow_ema

        for i in range(n):
            fast_ema = closes[i] * fast_k + fast_ema * (1 - fast_k)
            slow_ema = closes[i] * slow_k + slow_ema * (1 - slow_k)

            if i < slow_period:
                signals.append(SignalType.HOLD)
            elif fast_ema > slow_ema and prev_fast <= prev_slow:
                signals.append(SignalType.BUY)
            elif fast_ema < slow_ema and prev_fast >= prev_slow:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)

            prev_fast = fast_ema
            prev_slow = slow_ema

        return signals

    @staticmethod
    def rsi_strategy(bars: list[OHLCV], period: int = 14, oversold: float = 30.0, overbought: float = 70.0) -> list[SignalType]:
        """RSI mean reversion strategy."""
        signals = []
        closes = [b.close for b in bars]
        n = len(closes)

        if n < period + 1:
            return [SignalType.HOLD] * n

        # Calculate RSI
        gains = []
        losses = []
        for i in range(1, n):
            change = closes[i] - closes[i - 1]
            gains.append(max(0, change))
            losses.append(max(0, -change))

        rsi_values = [50.0] * n  # default to neutral
        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period

        for i in range(period, n - 1):
            if avg_loss == 0:
                rsi_values[i + 1] = 100.0
            else:
                rs = avg_gain / avg_loss
                rsi_values[i + 1] = 100.0 - 100.0 / (1.0 + rs)

            if i < len(gains):
                avg_gain = (avg_gain * (period - 1) + gains[i]) / period
                avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        prev_rsi = 50.0
        for i in range(n):
            rsi = rsi_values[i]
            if i < period + 1:
                signals.append(SignalType.HOLD)
            elif rsi < oversold and prev_rsi >= oversold:
                signals.append(SignalType.BUY)
            elif rsi > overbought and prev_rsi <= overbought:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)
            prev_rsi = rsi

        return signals

    @staticmethod
    def macd_strategy(bars: list[OHLCV], fast: int = 12, slow: int = 26, signal_period: int = 9) -> list[SignalType]:
        """MACD trend-following strategy."""
        signals = []
        closes = [b.close for b in bars]
        n = len(closes)

        if n < slow + signal_period:
            return [SignalType.HOLD] * n

        fast_k = 2.0 / (fast + 1)
        slow_k = 2.0 / (slow + 1)
        sig_k = 2.0 / (signal_period + 1)

        fast_ema = closes[0]
        slow_ema = closes[0]
        macd_line = 0.0
        signal_line = 0.0

        prev_macd = 0.0
        prev_signal = 0.0

        for i in range(n):
            fast_ema = closes[i] * fast_k + fast_ema * (1 - fast_k)
            slow_ema = closes[i] * slow_k + slow_ema * (1 - slow_k)
            macd_line = fast_ema - slow_ema
            signal_line = macd_line * sig_k + signal_line * (1 - sig_k)

            if i < slow + signal_period:
                signals.append(SignalType.HOLD)
            elif macd_line > signal_line and prev_macd <= prev_signal:
                signals.append(SignalType.BUY)
            elif macd_line < signal_line and prev_macd >= prev_signal:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)

            prev_macd = macd_line
            prev_signal = signal_line

        return signals

    @staticmethod
    def bollinger_strategy(bars: list[OHLCV], period: int = 20, num_std: float = 2.0) -> list[SignalType]:
        """Bollinger Bands breakout/mean reversion strategy."""
        signals = []
        closes = [b.close for b in bars]
        n = len(closes)

        for i in range(n):
            if i < period:
                signals.append(SignalType.HOLD)
                continue

            window = closes[i - period + 1:i + 1]
            sma = sum(window) / period
            std = (sum((x - sma) ** 2 for x in window) / period) ** 0.5

            upper = sma + num_std * std
            lower = sma - num_std * std

            if closes[i] < lower:
                signals.append(SignalType.BUY)
            elif closes[i] > upper:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)

        return signals

    @staticmethod
    def momentum_strategy(bars: list[OHLCV], lookback: int = 20, threshold: float = 0.0) -> list[SignalType]:
        """Price momentum strategy."""
        signals = []
        closes = [b.close for b in bars]
        n = len(closes)

        for i in range(n):
            if i < lookback:
                signals.append(SignalType.HOLD)
                continue

            mom = (closes[i] / closes[i - lookback] - 1.0) * 100.0
            if mom > threshold:
                signals.append(SignalType.BUY)
            elif mom < -threshold:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)

        return signals

    @staticmethod
    def donchian_channel(bars: list[OHLCV], period: int = 20) -> list[SignalType]:
        """Donchian Channel breakout strategy."""
        signals = []
        n = len(bars)

        for i in range(n):
            if i < period:
                signals.append(SignalType.HOLD)
                continue

            window = bars[i - period:i]
            upper = max(b.high for b in window)
            lower = min(b.low for b in window)

            if bars[i].close > upper:
                signals.append(SignalType.BUY)
            elif bars[i].close < lower:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)

        return signals

    @staticmethod
    def breakout_strategy(bars: list[OHLCV], period: int = 20, atr_mult: float = 1.5) -> list[SignalType]:
        """Volatility breakout strategy using ATR."""
        signals = []
        closes = [b.close for b in bars]
        n = len(bars)

        for i in range(n):
            if i < period + 1:
                signals.append(SignalType.HOLD)
                continue

            # Calculate ATR
            trs = []
            for j in range(i - period, i):
                tr = bars[j].true_range(bars[j - 1].close if j > 0 else None)
                trs.append(tr)
            atr = sum(trs) / len(trs)

            sma = sum(closes[i - period:i]) / period
            upper_band = sma + atr_mult * atr
            lower_band = sma - atr_mult * atr

            if closes[i] > upper_band:
                signals.append(SignalType.BUY)
            elif closes[i] < lower_band:
                signals.append(SignalType.SELL)
            else:
                signals.append(SignalType.HOLD)

        return signals

    def generate_signals(self, strategy: StrategyType, bars: list[OHLCV], **params) -> list[SignalType]:
        """Dispatch to the appropriate strategy."""
        dispatch = {
            StrategyType.SMA_CROSSOVER: self.sma_crossover,
            StrategyType.EMA_CROSSOVER: self.ema_crossover,
            StrategyType.RSI_MEAN_REVERSION: self.rsi_strategy,
            StrategyType.MACD_TREND: self.macd_strategy,
            StrategyType.BOLLINGER_BREAKOUT: self.bollinger_strategy,
            StrategyType.MOMENTUM: self.momentum_strategy,
            StrategyType.DONCHIAN_CHANNEL: self.donchian_channel,
            StrategyType.BREAKOUT: self.breakout_strategy,
        }
        fn = dispatch.get(strategy)
        if fn is None:
            return [SignalType.HOLD] * len(bars)
        return fn(bars, **params)


# ─── Position Sizing ────────────────────────────────────────────────────────

class PositionSizer:
    """Various position sizing methods."""

    @staticmethod
    def fixed_fractional(equity: float, risk_per_trade: float = 0.02, stop_distance: float = 1.0) -> float:
        """Risk a fixed fraction of equity per trade."""
        if stop_distance <= 0:
            return 0.0
        risk_amount = equity * risk_per_trade
        return risk_amount / stop_distance

    @staticmethod
    def kelly_criterion(win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Kelly criterion optimal fraction of equity to risk."""
        if avg_loss == 0 or avg_win == 0:
            return 0.0
        b = avg_win / avg_loss  # win/loss ratio
        p = win_rate
        q = 1.0 - p
        kelly = (b * p - q) / b
        # Half-Kelly for safety
        return max(0.0, min(kelly * 0.5, 0.25))

    @staticmethod
    def volatility_target(equity: float, target_vol: float, asset_vol: float, price: float) -> float:
        """Size position to target a specific portfolio volatility."""
        if asset_vol <= 0 or price <= 0:
            return 0.0
        dollar_vol = equity * target_vol
        shares = dollar_vol / (asset_vol * price)
        return max(0.0, shares)

    @staticmethod
    def equal_weight(equity: float, num_positions: int, price: float) -> float:
        """Equal weight across N positions."""
        if num_positions <= 0 or price <= 0:
            return 0.0
        allocation = equity / num_positions
        return allocation / price

    @staticmethod
    def risk_parity(equity: float, asset_vols: list[float], target_risk: float = 0.10) -> list[float]:
        """Risk parity weights — inversely proportional to volatility."""
        if not asset_vols or all(v == 0 for v in asset_vols):
            return [0.0] * len(asset_vols)
        inv_vols = [1.0 / v if v > 0 else 0.0 for v in asset_vols]
        total_inv = sum(inv_vols)
        if total_inv == 0:
            return [0.0] * len(asset_vols)
        weights = [iv / total_inv for iv in inv_vols]
        # Scale to target risk
        avg_vol = sum(asset_vols) / len(asset_vols)
        scale = target_risk / avg_vol if avg_vol > 0 else 1.0
        return [w * scale for w in weights]

    @staticmethod
    def atr_based(equity: float, atr: float, risk_per_trade: float = 0.01, atr_multiplier: float = 2.0) -> float:
        """ATR-based position sizing."""
        if atr <= 0:
            return 0.0
        stop_distance = atr * atr_multiplier
        risk_amount = equity * risk_per_trade
        return risk_amount / stop_distance

    @staticmethod
    def fixed_dollar(amount: float, price: float) -> float:
        """Fixed dollar amount per trade."""
        if price <= 0:
            return 0.0
        return amount / price

    @staticmethod
    def percent_of_equity(equity: float, pct: float, price: float) -> float:
        """Invest a percentage of equity."""
        if price <= 0:
            return 0.0
        return (equity * pct) / price


# ─── Commission & Slippage Models ───────────────────────────────────────────

class CommissionModel:
    """Flexible commission model."""

    def __init__(
        self,
        per_share: float = 0.005,
        min_commission: float = 1.0,
        max_commission: float = 50.0,
        pct_of_value: float = 0.0,  # percentage-based
    ):
        self.per_share = per_share
        self.min_commission = min_commission
        self.max_commission = max_commission
        self.pct_of_value = pct_of_value

    def calculate(self, quantity: float, price: float) -> float:
        """Calculate commission for a trade."""
        if self.pct_of_value > 0:
            return abs(quantity) * price * self.pct_of_value
        comm = abs(quantity) * self.per_share
        return max(self.min_commission, min(comm, self.max_commission))


class SlippageModel:
    """Realistic slippage model."""

    def __init__(self, fixed_bps: float = 2.0, volume_impact: float = 0.1):
        self.fixed_bps = fixed_bps
        self.volume_impact = volume_impact

    def calculate(self, price: float, quantity: float, avg_volume: float = 1e6) -> float:
        """Calculate slippage cost."""
        fixed_slip = price * (self.fixed_bps / 10000.0)
        # Volume impact: larger orders have more slippage
        if avg_volume > 0:
            participation = abs(quantity) / avg_volume
            vol_slip = price * self.volume_impact * math.sqrt(participation)
        else:
            vol_slip = 0.0
        return (fixed_slip + vol_slip) * abs(quantity)


# ─── Backtest Engine Core ────────────────────────────────────────────────────

class BacktestEngine:
    """Core backtesting engine with full lifecycle management."""

    def __init__(
        self,
        initial_capital: float = 100000.0,
        commission_model: CommissionModel | None = None,
        slippage_model: SlippageModel | None = None,
    ):
        self.initial_capital = initial_capital
        self.commission_model = commission_model or CommissionModel()
        self.slippage_model = slippage_model or SlippageModel()

        # State
        self.cash = initial_capital
        self.positions: dict[str, float] = {}  # symbol -> quantity
        self.position_costs: dict[str, float] = {}  # symbol -> avg cost
        self.equity_curve: list[EquityCurvePoint] = []
        self.trades: list[TradeRecord] = []
        self.open_trades: dict[str, dict] = {}  # symbol -> trade info

    def reset(self):
        """Reset engine state."""
        self.cash = self.initial_capital
        self.positions.clear()
        self.position_costs.clear()
        self.equity_curve.clear()
        self.trades.clear()
        self.open_trades.clear()

    def _execute_buy(self, symbol: str, quantity: float, price: float, timestamp: datetime, avg_volume: float = 1e6):
        """Execute a buy order."""
        commission = self.commission_model.calculate(quantity, price)
        slippage = self.slippage_model.calculate(price, quantity, avg_volume)
        fill_price = price + slippage / quantity if quantity > 0 else price
        total_cost = fill_price * quantity + commission

        if total_cost > self.cash:
            # Reduce to affordable
            quantity = (self.cash - commission) / fill_price
            if quantity <= 0:
                return
            total_cost = fill_price * quantity + commission

        # Update position
        current_qty = self.positions.get(symbol, 0.0)
        current_cost = self.position_costs.get(symbol, 0.0)

        if current_qty >= 0:
            # Adding to long
            new_qty = current_qty + quantity
            if new_qty > 0:
                self.position_costs[symbol] = (current_cost * current_qty + fill_price * quantity) / new_qty
            self.positions[symbol] = new_qty
        else:
            # Covering short
            self.positions[symbol] = current_qty + quantity
            if self.positions[symbol] >= 0:
                self.position_costs[symbol] = fill_price

        self.cash -= total_cost

        # Track open trade
        if symbol not in self.open_trades:
            self.open_trades[symbol] = {
                "entry_time": timestamp,
                "entry_price": fill_price,
                "quantity": quantity,
                "side": "long",
                "commission": commission,
                "slippage": slippage,
                "mae": 0.0,
                "mfe": 0.0,
                "bars_held": 0,
            }

    def _execute_sell(self, symbol: str, quantity: float, price: float, timestamp: datetime, avg_volume: float = 1e6):
        """Execute a sell order."""
        current_qty = self.positions.get(symbol, 0.0)
        if current_qty <= 0:
            return

        quantity = min(quantity, current_qty)
        commission = self.commission_model.calculate(quantity, price)
        slippage = self.slippage_model.calculate(price, quantity, avg_volume)
        fill_price = price - slippage / quantity if quantity > 0 else price
        proceeds = fill_price * quantity - commission

        self.cash += proceeds
        self.positions[symbol] = current_qty - quantity
        if self.positions[symbol] == 0:
            del self.positions[symbol]

        # Close trade record
        if symbol in self.open_trades:
            info = self.open_trades.pop(symbol)
            trade = TradeRecord(
                symbol=symbol,
                side=info["side"],
                entry_time=info["entry_time"],
                exit_time=timestamp,
                entry_price=info["entry_price"],
                exit_price=fill_price,
                quantity=quantity,
                commission=info["commission"] + commission,
                slippage=info["slippage"] + slippage,
                mae=info["mae"],
                mfe=info["mfe"],
                bars_held=info["bars_held"],
            )
            self.trades.append(trade)

    def _update_equity(self, timestamp: datetime, prices: dict[str, float]):
        """Update equity curve with current prices."""
        positions_value = sum(
            qty * prices.get(sym, 0.0)
            for sym, qty in self.positions.items()
        )
        equity = self.cash + positions_value

        # Calculate drawdown
        peak = max((e.equity for e in self.equity_curve), default=self.initial_capital)
        peak = max(peak, equity)
        dd_pct = (peak - equity) / peak * 100.0 if peak > 0 else 0.0

        # Daily return
        prev_eq = self.equity_curve[-1].equity if self.equity_curve else self.initial_capital
        daily_ret = (equity / prev_eq - 1.0) * 100.0 if prev_eq > 0 else 0.0

        point = EquityCurvePoint(
            timestamp=timestamp,
            equity=equity,
            cash=self.cash,
            positions_value=positions_value,
            drawdown_pct=dd_pct,
            daily_return=daily_ret,
        )
        self.equity_curve.append(point)

        # Update MAE/MFE for open trades
        for sym, info in self.open_trades.items():
            if sym in prices:
                cur_price = prices[sym]
                entry = info["entry_price"]
                if info["side"] == "long":
                    excursion = (cur_price - entry) / entry * 100.0
                else:
                    excursion = (entry - cur_price) / entry * 100.0
                info["mfe"] = max(info["mfe"], excursion)
                info["mae"] = min(info["mae"], excursion)
                info["bars_held"] += 1

    def run_backtest(self, bars: list[OHLCV], signals: list[SignalType], symbol: str = "AAPL",
                     position_size: float | None = None) -> dict:
        """Run a complete backtest with given signals."""
        self.reset()
        n = min(len(bars), len(signals))

        for i in range(n):
            bar = bars[i]
            signal = signals[i]
            price = bar.close

            # Determine position size
            if position_size is None:
                qty = self.cash * 0.95 / price if price > 0 else 0
            else:
                qty = position_size

            if signal == SignalType.BUY:
                if self.positions.get(symbol, 0) <= 0:
                    self._execute_buy(symbol, qty, price, bar.timestamp)
            elif signal == SignalType.SELL:
                if self.positions.get(symbol, 0) > 0:
                    self._execute_sell(symbol, self.positions[symbol], price, bar.timestamp)

            self._update_equity(bar.timestamp, {symbol: price})

        # Close any open positions at end
        if self.positions.get(symbol, 0) > 0 and bars:
            last_bar = bars[min(n - 1, len(bars) - 1)]
            self._execute_sell(symbol, self.positions[symbol], last_bar.close, last_bar.timestamp)
            self._update_equity(last_bar.timestamp, {symbol: last_bar.close})

        return self._generate_results()

    def _generate_results(self) -> dict:
        """Generate comprehensive backtest results."""
        return {
            "initial_capital": self.initial_capital,
            "final_equity": self.equity_curve[-1].equity if self.equity_curve else self.initial_capital,
            "total_return_pct": self._total_return(),
            "trades": len(self.trades),
            "trade_records": [t.to_dict() for t in self.trades],
            "equity_curve": [
                {"timestamp": e.timestamp.isoformat(), "equity": e.equity, "drawdown_pct": e.drawdown_pct}
                for e in self.equity_curve
            ],
        }

    def _total_return(self) -> float:
        if not self.equity_curve:
            return 0.0
        return (self.equity_curve[-1].equity / self.initial_capital - 1.0) * 100.0


# ─── Performance Analytics ───────────────────────────────────────────────────

class PerformanceAnalytics:
    """Comprehensive performance analysis suite."""

    @staticmethod
    def total_return(equity_curve: list[EquityCurvePoint]) -> float:
        """Total return percentage."""
        if len(equity_curve) < 2:
            return 0.0
        return (equity_curve[-1].equity / equity_curve[0].equity - 1.0) * 100.0

    @staticmethod
    def cagr(equity_curve: list[EquityCurvePoint], trading_days_per_year: int = 252) -> float:
        """Compound Annual Growth Rate."""
        if len(equity_curve) < 2:
            return 0.0
        total_days = len(equity_curve)
        years = total_days / trading_days_per_year
        if years <= 0:
            return 0.0
        total_ret = equity_curve[-1].equity / equity_curve[0].equity
        if total_ret <= 0:
            return -100.0
        return (total_ret ** (1.0 / years) - 1.0) * 100.0

    @staticmethod
    def daily_returns(equity_curve: list[EquityCurvePoint]) -> list[float]:
        """Extract daily returns from equity curve."""
        if len(equity_curve) < 2:
            return []
        returns = []
        for i in range(1, len(equity_curve)):
            prev = equity_curve[i - 1].equity
            curr = equity_curve[i].equity
            if prev > 0:
                returns.append(curr / prev - 1.0)
            else:
                returns.append(0.0)
        return returns

    @staticmethod
    def sharpe_ratio(returns: list[float], risk_free_rate: float = 0.02, periods_per_year: int = 252) -> float:
        """Annualized Sharpe ratio."""
        if len(returns) < 2:
            return 0.0
        rf_daily = risk_free_rate / periods_per_year
        excess = [r - rf_daily for r in returns]
        mean_excess = statistics.mean(excess)
        std = statistics.stdev(excess) if len(excess) > 1 else 1.0
        if std == 0:
            return 0.0
        return mean_excess / std * math.sqrt(periods_per_year)

    @staticmethod
    def sortino_ratio(returns: list[float], risk_free_rate: float = 0.02, periods_per_year: int = 252) -> float:
        """Sortino ratio — penalizes only downside volatility."""
        if len(returns) < 2:
            return 0.0
        rf_daily = risk_free_rate / periods_per_year
        excess = [r - rf_daily for r in returns]
        mean_excess = statistics.mean(excess)
        downside = [r for r in excess if r < 0]
        if not downside:
            return float('inf') if mean_excess > 0 else 0.0
        downside_std = (sum(d ** 2 for d in downside) / len(downside)) ** 0.5
        if downside_std == 0:
            return 0.0
        return mean_excess / downside_std * math.sqrt(periods_per_year)

    @staticmethod
    def calmar_ratio(cagr_value: float, max_drawdown: float) -> float:
        """Calmar ratio = CAGR / Max Drawdown."""
        if max_drawdown == 0:
            return 0.0
        return cagr_value / abs(max_drawdown)

    @staticmethod
    def max_drawdown(equity_curve: list[EquityCurvePoint]) -> float:
        """Maximum drawdown percentage."""
        if not equity_curve:
            return 0.0
        peak = equity_curve[0].equity
        max_dd = 0.0
        for point in equity_curve:
            peak = max(peak, point.equity)
            if peak > 0:
                dd = (peak - point.equity) / peak * 100.0
                max_dd = max(max_dd, dd)
        return max_dd

    @staticmethod
    def drawdown_analysis(equity_curve: list[EquityCurvePoint]) -> list[DrawdownInfo]:
        """Detailed drawdown analysis — identify all drawdown periods."""
        if not equity_curve:
            return []

        drawdowns = []
        peak = equity_curve[0].equity
        in_drawdown = False
        current_dd: DrawdownInfo | None = None

        for i, point in enumerate(equity_curve):
            if point.equity >= peak:
                peak = point.equity
                if in_drawdown and current_dd:
                    current_dd.recovery_time = point.timestamp
                    current_dd.recovery_bars = i - current_dd.duration_bars
                    current_dd.is_recovered = True
                    drawdowns.append(current_dd)
                    in_drawdown = False
                    current_dd = None
            else:
                if not in_drawdown:
                    current_dd = DrawdownInfo(
                        start_time=point.timestamp,
                        peak_equity=peak,
                    )
                    in_drawdown = True

                if current_dd:
                    dd_pct = (peak - point.equity) / peak * 100.0
                    if dd_pct > current_dd.drawdown_pct:
                        current_dd.drawdown_pct = dd_pct
                        current_dd.trough_equity = point.equity
                        current_dd.end_time = point.timestamp
                    current_dd.duration_bars = i

        if in_drawdown and current_dd:
            drawdowns.append(current_dd)

        return drawdowns

    @staticmethod
    def win_rate(trades: list[TradeRecord]) -> float:
        """Win rate percentage."""
        if not trades:
            return 0.0
        winners = sum(1 for t in trades if t.is_winner)
        return winners / len(trades) * 100.0

    @staticmethod
    def profit_factor(trades: list[TradeRecord]) -> float:
        """Gross profit / Gross loss."""
        gross_profit = sum(t.net_pnl for t in trades if t.net_pnl > 0)
        gross_loss = abs(sum(t.net_pnl for t in trades if t.net_pnl < 0))
        if gross_loss == 0:
            return float('inf') if gross_profit > 0 else 0.0
        return gross_profit / gross_loss

    @staticmethod
    def expectancy(trades: list[TradeRecord]) -> float:
        """Average expected PnL per trade."""
        if not trades:
            return 0.0
        return sum(t.net_pnl for t in trades) / len(trades)

    @staticmethod
    def avg_trade_duration(trades: list[TradeRecord]) -> float:
        """Average trade duration in bars."""
        if not trades:
            return 0.0
        return sum(t.bars_held for t in trades) / len(trades)

    @staticmethod
    def payoff_ratio(trades: list[TradeRecord]) -> float:
        """Average win / Average loss."""
        winners = [t.net_pnl for t in trades if t.net_pnl > 0]
        losers = [abs(t.net_pnl) for t in trades if t.net_pnl < 0]
        avg_win = statistics.mean(winners) if winners else 0.0
        avg_loss = statistics.mean(losers) if losers else 0.0
        if avg_loss == 0:
            return 0.0
        return avg_win / avg_loss

    @staticmethod
    def consecutive_wins_losses(trades: list[TradeRecord]) -> dict:
        """Max consecutive wins and losses."""
        max_wins = 0
        max_losses = 0
        current_wins = 0
        current_losses = 0

        for t in trades:
            if t.is_winner:
                current_wins += 1
                current_losses = 0
                max_wins = max(max_wins, current_wins)
            else:
                current_losses += 1
                current_wins = 0
                max_losses = max(max_losses, current_losses)

        return {"max_consecutive_wins": max_wins, "max_consecutive_losses": max_losses}

    @staticmethod
    def monthly_returns(equity_curve: list[EquityCurvePoint]) -> dict[str, float]:
        """Calculate returns by month."""
        if len(equity_curve) < 2:
            return {}

        monthly: dict[str, list[float]] = {}
        for i in range(1, len(equity_curve)):
            month_key = equity_curve[i].timestamp.strftime("%Y-%m")
            prev = equity_curve[i - 1].equity
            curr = equity_curve[i].equity
            ret = (curr / prev - 1.0) if prev > 0 else 0.0
            monthly.setdefault(month_key, []).append(ret)

        # Compound monthly returns
        result = {}
        for month, rets in monthly.items():
            compound = 1.0
            for r in rets:
                compound *= (1.0 + r)
            result[month] = (compound - 1.0) * 100.0

        return result

    @staticmethod
    def trade_analysis(trades: list[TradeRecord]) -> dict:
        """Comprehensive trade analysis."""
        if not trades:
            return {
                "total_trades": 0,
                "winners": 0,
                "losers": 0,
                "win_rate": 0.0,
                "avg_pnl": 0.0,
                "avg_win": 0.0,
                "avg_loss": 0.0,
                "largest_win": 0.0,
                "largest_loss": 0.0,
                "total_pnl": 0.0,
                "total_commission": 0.0,
            }

        winners = [t for t in trades if t.is_winner]
        losers = [t for t in trades if not t.is_winner]
        pnls = [t.net_pnl for t in trades]

        return {
            "total_trades": len(trades),
            "winners": len(winners),
            "losers": len(losers),
            "win_rate": len(winners) / len(trades) * 100.0,
            "avg_pnl": statistics.mean(pnls),
            "avg_win": statistics.mean([t.net_pnl for t in winners]) if winners else 0.0,
            "avg_loss": statistics.mean([t.net_pnl for t in losers]) if losers else 0.0,
            "largest_win": max(pnls) if pnls else 0.0,
            "largest_loss": min(pnls) if pnls else 0.0,
            "total_pnl": sum(pnls),
            "total_commission": sum(t.commission for t in trades),
            "avg_bars_held": sum(t.bars_held for t in trades) / len(trades),
            "avg_mae": statistics.mean([t.mae for t in trades]),
            "avg_mfe": statistics.mean([t.mfe for t in trades]),
        }

    def full_report(self, engine: BacktestEngine) -> dict:
        """Generate a comprehensive performance report."""
        eq = engine.equity_curve
        trades = engine.trades
        returns = self.daily_returns(eq)
        cagr_val = self.cagr(eq)
        max_dd = self.max_drawdown(eq)

        return {
            "summary": {
                "initial_capital": engine.initial_capital,
                "final_equity": eq[-1].equity if eq else engine.initial_capital,
                "total_return_pct": self.total_return(eq),
                "cagr_pct": cagr_val,
                "sharpe_ratio": self.sharpe_ratio(returns),
                "sortino_ratio": self.sortino_ratio(returns),
                "calmar_ratio": self.calmar_ratio(cagr_val, max_dd),
                "max_drawdown_pct": max_dd,
                "total_trades": len(trades),
            },
            "trade_analysis": self.trade_analysis(trades),
            "risk_metrics": {
                "volatility_annual": statistics.stdev(returns) * math.sqrt(252) * 100.0 if len(returns) > 1 else 0.0,
                "downside_deviation": self._downside_dev(returns),
                "var_95": self._value_at_risk(returns, 0.05),
                "cvar_95": self._conditional_var(returns, 0.05),
                "skewness": self._skewness(returns),
                "kurtosis": self._kurtosis(returns),
            },
            "drawdown_analysis": [
                {
                    "depth_pct": dd.depth,
                    "duration_bars": dd.duration_bars,
                    "recovered": dd.is_recovered,
                }
                for dd in self.drawdown_analysis(eq)[:5]
            ],
            "monthly_returns": self.monthly_returns(eq),
            "consecutive": self.consecutive_wins_losses(trades),
        }

    @staticmethod
    def _downside_dev(returns: list[float]) -> float:
        if not returns:
            return 0.0
        negative = [r for r in returns if r < 0]
        if not negative:
            return 0.0
        return (sum(r ** 2 for r in negative) / len(returns)) ** 0.5 * math.sqrt(252) * 100.0

    @staticmethod
    def _value_at_risk(returns: list[float], confidence: float = 0.05) -> float:
        if not returns:
            return 0.0
        sorted_r = sorted(returns)
        idx = int(len(sorted_r) * confidence)
        return sorted_r[idx] * 100.0

    @staticmethod
    def _conditional_var(returns: list[float], confidence: float = 0.05) -> float:
        if not returns:
            return 0.0
        sorted_r = sorted(returns)
        idx = max(1, int(len(sorted_r) * confidence))
        tail = sorted_r[:idx]
        return statistics.mean(tail) * 100.0 if tail else 0.0

    @staticmethod
    def _skewness(returns: list[float]) -> float:
        if len(returns) < 3:
            return 0.0
        n = len(returns)
        mean = statistics.mean(returns)
        std = statistics.stdev(returns)
        if std == 0:
            return 0.0
        return (n / ((n - 1) * (n - 2))) * sum(((r - mean) / std) ** 3 for r in returns)

    @staticmethod
    def _kurtosis(returns: list[float]) -> float:
        if len(returns) < 4:
            return 0.0
        n = len(returns)
        mean = statistics.mean(returns)
        std = statistics.stdev(returns)
        if std == 0:
            return 0.0
        kurt = sum(((r - mean) / std) ** 4 for r in returns) / n
        return kurt - 3.0  # Excess kurtosis


# ─── Benchmark Comparison ────────────────────────────────────────────────────

class BenchmarkComparison:
    """Compare strategy against benchmarks."""

    @staticmethod
    def buy_and_hold_returns(bars: list[OHLCV]) -> list[float]:
        """Buy and hold daily returns."""
        if len(bars) < 2:
            return []
        return [bars[i].close / bars[i - 1].close - 1.0 for i in range(1, len(bars))]

    @staticmethod
    def alpha_beta(strategy_returns: list[float], benchmark_returns: list[float]) -> dict:
        """Calculate alpha and beta using OLS regression."""
        n = min(len(strategy_returns), len(benchmark_returns))
        if n < 2:
            return {"alpha": 0.0, "beta": 0.0, "r_squared": 0.0, "tracking_error": 0.0}

        sr = strategy_returns[:n]
        br = benchmark_returns[:n]

        # Simple OLS: y = alpha + beta * x
        mean_s = statistics.mean(sr)
        mean_b = statistics.mean(br)

        cov = sum((s - mean_s) * (b - mean_b) for s, b in zip(sr, br)) / n
        var_b = sum((b - mean_b) ** 2 for b in br) / n

        beta = cov / var_b if var_b > 0 else 0.0
        alpha = mean_s - beta * mean_b

        # R-squared
        ss_res = sum((s - alpha - beta * b) ** 2 for s, b in zip(sr, br))
        ss_tot = sum((s - mean_s) ** 2 for s in sr)
        r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

        # Tracking error
        excess = [s - b for s, b in zip(sr, br)]
        tracking_error = statistics.stdev(excess) * math.sqrt(252) * 100.0 if len(excess) > 1 else 0.0

        return {
            "alpha": alpha * 252 * 100.0,  # Annualized alpha in %
            "beta": beta,
            "r_squared": r_squared,
            "tracking_error": tracking_error,
        }

    @staticmethod
    def information_ratio(strategy_returns: list[float], benchmark_returns: list[float]) -> float:
        """Information ratio = excess return / tracking error."""
        n = min(len(strategy_returns), len(benchmark_returns))
        if n < 2:
            return 0.0
        excess = [strategy_returns[i] - benchmark_returns[i] for i in range(n)]
        mean_excess = statistics.mean(excess)
        std_excess = statistics.stdev(excess)
        if std_excess == 0:
            return 0.0
        return mean_excess / std_excess * math.sqrt(252)


# ─── Walk-Forward Analysis ───────────────────────────────────────────────────

class WalkForwardAnalyzer:
    """Walk-forward optimization and out-of-sample testing."""

    def __init__(self, in_sample_pct: float = 0.70, num_folds: int = 5):
        self.in_sample_pct = in_sample_pct
        self.num_folds = num_folds

    def create_folds(self, bars: list[OHLCV]) -> list[dict]:
        """Create walk-forward folds."""
        n = len(bars)
        fold_size = n // self.num_folds
        folds = []

        for i in range(self.num_folds):
            start = i * fold_size
            end = start + fold_size if i < self.num_folds - 1 else n
            fold_bars = bars[start:end]

            split = int(len(fold_bars) * self.in_sample_pct)
            in_sample = fold_bars[:split]
            out_of_sample = fold_bars[split:]

            folds.append({
                "fold": i + 1,
                "total_bars": len(fold_bars),
                "in_sample_bars": len(in_sample),
                "out_of_sample_bars": len(out_of_sample),
                "in_sample": in_sample,
                "out_of_sample": out_of_sample,
            })

        return folds

    def run_walk_forward(
        self,
        bars: list[OHLCV],
        strategy: StrategyType,
        param_grid: dict[str, list],
        initial_capital: float = 100000.0,
    ) -> dict:
        """Run walk-forward analysis across folds."""
        folds = self.create_folds(bars)
        results = []
        generator = StrategySignalGenerator()
        analytics = PerformanceAnalytics()

        for fold_info in folds:
            in_sample = fold_info["in_sample"]
            oos = fold_info["out_of_sample"]

            # Optimize on in-sample
            best_params = {}
            best_sharpe = -999.0

            # Simple grid search
            param_names = list(param_grid.keys())
            if param_names:
                # Generate all combinations
                combos = self._param_combinations(param_grid)
                for combo in combos:
                    signals = generator.generate_signals(strategy, in_sample, **combo)
                    engine = BacktestEngine(initial_capital=initial_capital)
                    engine.run_backtest(in_sample, signals)
                    rets = analytics.daily_returns(engine.equity_curve)
                    sharpe = analytics.sharpe_ratio(rets)
                    if sharpe > best_sharpe:
                        best_sharpe = sharpe
                        best_params = combo
            else:
                best_params = {}

            # Test on out-of-sample with best params
            oos_signals = generator.generate_signals(strategy, oos, **best_params)
            oos_engine = BacktestEngine(initial_capital=initial_capital)
            oos_engine.run_backtest(oos, oos_signals)
            oos_rets = analytics.daily_returns(oos_engine.equity_curve)

            results.append({
                "fold": fold_info["fold"],
                "best_params": best_params,
                "in_sample_sharpe": best_sharpe,
                "oos_sharpe": analytics.sharpe_ratio(oos_rets),
                "oos_return": analytics.total_return(oos_engine.equity_curve),
                "oos_max_drawdown": analytics.max_drawdown(oos_engine.equity_curve),
                "oos_trades": len(oos_engine.trades),
            })

        # Aggregate
        avg_oos_sharpe = statistics.mean([r["oos_sharpe"] for r in results]) if results else 0.0
        avg_oos_return = statistics.mean([r["oos_return"] for r in results]) if results else 0.0

        return {
            "num_folds": self.num_folds,
            "in_sample_pct": self.in_sample_pct,
            "fold_results": results,
            "avg_oos_sharpe": avg_oos_sharpe,
            "avg_oos_return": avg_oos_return,
            "robustness_score": self._robustness_score(results),
        }

    @staticmethod
    def _param_combinations(grid: dict[str, list]) -> list[dict]:
        """Generate all parameter combinations from a grid."""
        keys = list(grid.keys())
        if not keys:
            return [{}]

        combos = [{}]
        for key in keys:
            new_combos = []
            for combo in combos:
                for val in grid[key]:
                    new_combo = {**combo, key: val}
                    new_combos.append(new_combo)
            combos = new_combos
        return combos

    @staticmethod
    def _robustness_score(results: list[dict]) -> float:
        """Score 0-100 based on consistency across folds."""
        if not results:
            return 0.0
        oos_sharpes = [r["oos_sharpe"] for r in results]
        positive_folds = sum(1 for s in oos_sharpes if s > 0)
        consistency = positive_folds / len(results) * 50.0

        # Average magnitude
        avg = statistics.mean(oos_sharpes)
        magnitude = min(avg * 25.0, 50.0) if avg > 0 else 0.0

        return min(consistency + magnitude, 100.0)


# ─── Monte Carlo Simulator ──────────────────────────────────────────────────

class MonteCarloSimulator:
    """Monte Carlo simulation for strategy robustness testing."""

    def __init__(self, num_simulations: int = 1000, seed: int | None = None):
        self.num_simulations = num_simulations
        self.rng = np.random.default_rng(seed)

    def simulate_returns(self, historical_returns: list[float]) -> dict:
        """Simulate equity curves by resampling historical returns."""
        if not historical_returns:
            return {"simulations": 0, "percentiles": {}}

        returns_arr = np.array(historical_returns)
        n = len(returns_arr)

        final_equities = []
        max_drawdowns = []
        sharpes = []

        for _ in range(self.num_simulations):
            # Bootstrap resampling
            sampled = self.rng.choice(returns_arr, size=n, replace=True)

            # Build equity curve
            equity = np.cumprod(1.0 + sampled)
            final_eq = equity[-1]
            final_equities.append(float(final_eq))

            # Max drawdown
            peak = np.maximum.accumulate(equity)
            dd = (peak - equity) / peak
            max_drawdowns.append(float(np.max(dd)) * 100.0)

            # Sharpe
            mean_r = np.mean(sampled)
            std_r = np.std(sampled)
            sharpe = mean_r / std_r * np.sqrt(252) if std_r > 0 else 0.0
            sharpes.append(float(sharpe))

        return {
            "simulations": self.num_simulations,
            "final_equity": {
                "mean": float(np.mean(final_equities)),
                "median": float(np.median(final_equities)),
                "p5": float(np.percentile(final_equities, 5)),
                "p25": float(np.percentile(final_equities, 25)),
                "p75": float(np.percentile(final_equities, 75)),
                "p95": float(np.percentile(final_equities, 95)),
                "min": float(np.min(final_equities)),
                "max": float(np.max(final_equities)),
            },
            "max_drawdown": {
                "mean": float(np.mean(max_drawdowns)),
                "median": float(np.median(max_drawdowns)),
                "p95": float(np.percentile(max_drawdowns, 95)),
                "worst": float(np.max(max_drawdowns)),
            },
            "sharpe_ratio": {
                "mean": float(np.mean(sharpes)),
                "median": float(np.median(sharpes)),
                "p5": float(np.percentile(sharpes, 5)),
                "p95": float(np.percentile(sharpes, 95)),
            },
            "probability_of_profit": float(np.mean(np.array(final_equities) > 1.0)) * 100.0,
            "probability_of_ruin": float(np.mean(np.array(final_equities) < 0.5)) * 100.0,
        }

    def simulate_trade_sequence(self, trades: list[TradeRecord], initial_capital: float = 100000.0) -> dict:
        """Monte Carlo on trade sequence — shuffle trade order."""
        if not trades:
            return {"simulations": 0}

        pnls = [t.net_pnl for t in trades]
        final_equities = []

        for _ in range(self.num_simulations):
            shuffled = self.rng.permutation(pnls)
            equity = initial_capital
            peak = equity
            max_dd = 0.0

            for pnl in shuffled:
                equity += pnl
                peak = max(peak, equity)
                dd = (peak - equity) / peak if peak > 0 else 0.0
                max_dd = max(max_dd, dd)

            final_equities.append(equity)

        arr = np.array(final_equities)
        return {
            "simulations": self.num_simulations,
            "initial_capital": initial_capital,
            "final_equity_mean": float(np.mean(arr)),
            "final_equity_median": float(np.median(arr)),
            "final_equity_p5": float(np.percentile(arr, 5)),
            "final_equity_p95": float(np.percentile(arr, 95)),
            "probability_of_profit": float(np.mean(arr > initial_capital)) * 100.0,
        }


# ─── Multi-Strategy Portfolio Backtest ───────────────────────────────────────

class MultiStrategyBacktester:
    """Backtest multiple strategies on multiple symbols."""

    def __init__(self, initial_capital: float = 1000000.0):
        self.initial_capital = initial_capital
        self.strategy_results: dict[str, dict] = {}

    def add_strategy_result(self, name: str, equity_curve: list[EquityCurvePoint], trades: list[TradeRecord]):
        """Add a strategy result."""
        self.strategy_results[name] = {
            "equity_curve": equity_curve,
            "trades": trades,
        }

    def combined_equity(self, weights: dict[str, float] | None = None) -> list[float]:
        """Combine strategy equity curves with weights."""
        if not self.strategy_results:
            return []

        names = list(self.strategy_results.keys())
        if weights is None:
            weights = {n: 1.0 / len(names) for n in names}

        # Normalize weights
        total_w = sum(weights.values())
        if total_w > 0:
            weights = {k: v / total_w for k, v in weights.items()}

        # Get returns for each strategy
        analytics = PerformanceAnalytics()
        all_returns: dict[str, list[float]] = {}
        min_len = float('inf')

        for name in names:
            rets = analytics.daily_returns(self.strategy_results[name]["equity_curve"])
            all_returns[name] = rets
            min_len = min(min_len, len(rets))

        if min_len == 0 or min_len == float('inf'):
            return []

        min_len = int(min_len)

        # Weighted combined returns
        combined = []
        for i in range(min_len):
            weighted_ret = sum(weights.get(n, 0) * all_returns[n][i] for n in names)
            combined.append(weighted_ret)

        return combined

    def correlation_matrix(self) -> dict:
        """Correlation between strategy returns."""
        analytics = PerformanceAnalytics()
        names = list(self.strategy_results.keys())
        returns = {}

        for name in names:
            returns[name] = analytics.daily_returns(self.strategy_results[name]["equity_curve"])

        min_len = min(len(r) for r in returns.values()) if returns else 0

        matrix = {}
        for n1 in names:
            matrix[n1] = {}
            for n2 in names:
                r1 = returns[n1][:min_len]
                r2 = returns[n2][:min_len]
                if min_len < 2:
                    matrix[n1][n2] = 0.0
                    continue
                m1, m2 = statistics.mean(r1), statistics.mean(r2)
                cov = sum((a - m1) * (b - m2) for a, b in zip(r1, r2)) / min_len
                s1 = statistics.stdev(r1) if len(r1) > 1 else 1.0
                s2 = statistics.stdev(r2) if len(r2) > 1 else 1.0
                matrix[n1][n2] = cov / (s1 * s2) if s1 * s2 > 0 else 0.0

        return matrix

    def summary(self) -> dict:
        """Summary of all strategies."""
        analytics = PerformanceAnalytics()
        summaries = {}

        for name, data in self.strategy_results.items():
            eq = data["equity_curve"]
            trades = data["trades"]
            rets = analytics.daily_returns(eq)
            summaries[name] = {
                "total_return": analytics.total_return(eq),
                "sharpe": analytics.sharpe_ratio(rets),
                "max_drawdown": analytics.max_drawdown(eq),
                "trades": len(trades),
                "win_rate": analytics.win_rate(trades),
            }

        return summaries


# ─── Orchestrator ────────────────────────────────────────────────────────────

class BacktestingEngineV2:
    """Top-level orchestrator for the backtesting engine."""

    def __init__(self, initial_capital: float = 100000.0):
        self.initial_capital = initial_capital
        self.signal_generator = StrategySignalGenerator()
        self.position_sizer = PositionSizer()
        self.analytics = PerformanceAnalytics()
        self.engine = BacktestEngine(initial_capital=initial_capital)
        self.monte_carlo = MonteCarloSimulator(num_simulations=500, seed=42)
        self.walk_forward = WalkForwardAnalyzer()
        self.multi_strategy = MultiStrategyBacktester(initial_capital=initial_capital)

    def run_strategy(self, strategy: StrategyType, bars: list[OHLCV], symbol: str = "AAPL", **params) -> dict:
        """Run a single strategy backtest."""
        signals = self.signal_generator.generate_signals(strategy, bars, **params)
        result = self.engine.run_backtest(bars, signals, symbol=symbol)
        report = self.analytics.full_report(self.engine)
        return {**result, "report": report}

    def run_monte_carlo(self, bars: list[OHLCV], strategy: StrategyType, **params) -> dict:
        """Run Monte Carlo simulation on a strategy."""
        signals = self.signal_generator.generate_signals(strategy, bars, **params)
        self.engine.run_backtest(bars, signals)
        returns = self.analytics.daily_returns(self.engine.equity_curve)
        return self.monte_carlo.simulate_returns(returns)

    def run_walk_forward_analysis(self, bars: list[OHLCV], strategy: StrategyType,
                                   param_grid: dict[str, list]) -> dict:
        """Run walk-forward analysis."""
        return self.walk_forward.run_walk_forward(bars, strategy, param_grid, self.initial_capital)

    def compare_strategies(self, bars: list[OHLCV], strategies: list[tuple[StrategyType, dict]]) -> dict:
        """Compare multiple strategies side by side."""
        results = {}
        for strategy, params in strategies:
            signals = self.signal_generator.generate_signals(strategy, bars, **params)
            eng = BacktestEngine(initial_capital=self.initial_capital)
            eng.run_backtest(bars, signals)
            rets = self.analytics.daily_returns(eng.equity_curve)
            results[strategy.value] = {
                "total_return": self.analytics.total_return(eng.equity_curve),
                "sharpe": self.analytics.sharpe_ratio(rets),
                "sortino": self.analytics.sortino_ratio(rets),
                "max_drawdown": self.analytics.max_drawdown(eng.equity_curve),
                "win_rate": self.analytics.win_rate(eng.trades),
                "profit_factor": self.analytics.profit_factor(eng.trades),
                "trades": len(eng.trades),
            }
        return results

    def position_size_analysis(self, equity: float, methods: list[PositionSizingMethod],
                                price: float = 100.0, **params) -> dict:
        """Compare different position sizing methods."""
        result = {}
        for method in methods:
            if method == PositionSizingMethod.FIXED_FRACTIONAL:
                shares = self.position_sizer.fixed_fractional(
                    equity, params.get("risk_per_trade", 0.02), params.get("stop_distance", 1.0))
            elif method == PositionSizingMethod.KELLY_CRITERION:
                frac = self.position_sizer.kelly_criterion(
                    params.get("win_rate", 0.55), params.get("avg_win", 100), params.get("avg_loss", 80))
                shares = (equity * frac) / price
            elif method == PositionSizingMethod.VOLATILITY_TARGET:
                shares = self.position_sizer.volatility_target(
                    equity, params.get("target_vol", 0.15), params.get("asset_vol", 0.25), price)
            elif method == PositionSizingMethod.EQUAL_WEIGHT:
                shares = self.position_sizer.equal_weight(equity, params.get("num_positions", 10), price)
            elif method == PositionSizingMethod.ATR_BASED:
                shares = self.position_sizer.atr_based(
                    equity, params.get("atr", 2.0), params.get("risk_per_trade", 0.01))
            elif method == PositionSizingMethod.FIXED_DOLLAR:
                shares = self.position_sizer.fixed_dollar(params.get("amount", 10000), price)
            elif method == PositionSizingMethod.PERCENT_OF_EQUITY:
                shares = self.position_sizer.percent_of_equity(equity, params.get("pct", 0.10), price)
            else:
                shares = 0.0

            result[method.value] = {
                "shares": round(shares, 2),
                "dollar_value": round(shares * price, 2),
                "pct_of_equity": round(shares * price / equity * 100.0, 2) if equity > 0 else 0.0,
            }

        return result

    def benchmark_comparison(self, bars: list[OHLCV], strategy: StrategyType, **params) -> dict:
        """Compare strategy vs buy-and-hold benchmark."""
        # Strategy returns
        signals = self.signal_generator.generate_signals(strategy, bars, **params)
        self.engine.run_backtest(bars, signals)
        strat_returns = self.analytics.daily_returns(self.engine.equity_curve)

        # Benchmark returns
        bench = BenchmarkComparison()
        bh_returns = bench.buy_and_hold_returns(bars)

        ab = bench.alpha_beta(strat_returns, bh_returns)
        ir = bench.information_ratio(strat_returns, bh_returns)

        return {
            "strategy_total_return": self.analytics.total_return(self.engine.equity_curve),
            "benchmark_total_return": (bars[-1].close / bars[0].close - 1.0) * 100.0 if len(bars) > 1 else 0.0,
            "alpha": ab["alpha"],
            "beta": ab["beta"],
            "r_squared": ab["r_squared"],
            "tracking_error": ab["tracking_error"],
            "information_ratio": ir,
        }

    def capabilities(self) -> dict:
        return {
            "engine": "BacktestingEngineV2",
            "strategies": [s.value for s in StrategyType],
            "position_sizing": [p.value for p in PositionSizingMethod],
            "features": [
                "walk_forward_analysis",
                "monte_carlo_simulation",
                "multi_strategy_comparison",
                "benchmark_alpha_beta",
                "comprehensive_trade_analytics",
                "drawdown_analysis",
                "monthly_returns",
                "risk_metrics_var_cvar",
                "position_sizing_models",
                "commission_slippage_modeling",
            ],
        }
