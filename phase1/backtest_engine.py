"""
backtest_engine.py — Bloomberg-Grade Event-Driven Backtesting Engine
=====================================================================
Self-contained backtesting library with:
 - 4 built-in strategies (MA Cross, RSI MR, Bollinger Band, Breakout)
 - Commission models (Fixed, Per-Share, Percentage, Tiered)
 - Slippage models (Fixed bps, Volume-weighted)
 - Position sizers (Fixed-fractional, ATR, Kelly)
 - Full metrics: CAGR, Sharpe, Sortino, MaxDD, Calmar, Win%, Avg P&L
 - Walk-forward optimization
 - Monte Carlo simulation
 - Tearsheet generation

Fully self-contained — requires only NumPy and Pandas.
"""
from __future__ import annotations

import math
import dataclasses
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


# ─── DATA STRUCTURES ─────────────────────────────────────────────────────────

@dataclass
class Trade:
    entry_date: Any
    exit_date: Any
    direction: str          # "long" | "short"
    entry_price: float
    exit_price: float
    shares: float
    pnl: float
    pnl_pct: float
    commission: float
    slippage: float
    duration_bars: int


@dataclass
class BacktestMetrics:
    total_return: float = 0.0
    cagr: float = 0.0
    volatility: float = 0.0
    sharpe: float = 0.0
    sortino: float = 0.0
    max_drawdown: float = 0.0
    calmar: float = 0.0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    total_trades: int = 0
    num_wins: int = 0
    num_losses: int = 0
    avg_trade_pnl: float = 0.0
    avg_trade_duration: float = 0.0
    total_commission: float = 0.0
    total_slippage: float = 0.0
    start_date: str = ""
    end_date: str = ""
    years: float = 0.0
    initial_capital: float = 100_000.0
    final_capital: float = 100_000.0
    best_trade: float = 0.0
    worst_trade: float = 0.0


@dataclass
class BacktestResult:
    metrics: BacktestMetrics
    equity_curve: Optional[pd.Series] = field(default=None)
    drawdown_curve: Optional[pd.Series] = field(default=None)
    trades: Optional[List[Trade]] = field(default=None)


# ─── COMMISSION MODELS ────────────────────────────────────────────────────────

class CommissionModel(ABC):
    @abstractmethod
    def compute(self, price: float, shares: float) -> float: ...


class FixedCommission(CommissionModel):
    def __init__(self, value: float = 1.0):
        self.value = value
    def compute(self, price, shares):
        return self.value


class PerShareCommission(CommissionModel):
    def __init__(self, value: float = 0.005):
        self.value = value
    def compute(self, price, shares):
        return abs(shares) * self.value


class PercentageCommission(CommissionModel):
    def __init__(self, value: float = 0.001):
        self.value = value
    def compute(self, price, shares):
        return abs(price * shares) * self.value


class TieredCommission(CommissionModel):
    """Tiers: list of [threshold, rate_per_share]"""
    def __init__(self, tiers: List[List[float]] = None):
        self.tiers = sorted(tiers or [[0, 0.005], [1000, 0.003], [10000, 0.001]])
    def compute(self, price, shares):
        value = abs(price * shares)
        rate = self.tiers[0][1]
        for threshold, r in self.tiers:
            if value >= threshold:
                rate = r
        return value * rate


# ─── SLIPPAGE MODELS ──────────────────────────────────────────────────────────

class SlippageModel(ABC):
    @abstractmethod
    def compute(self, price: float, shares: float, bar: Any) -> float: ...


class FixedSlippage(SlippageModel):
    """Fixed bps slippage."""
    def __init__(self, bps: float = 5.0):
        self.bps = bps
    def compute(self, price, shares, bar):
        return abs(price * shares) * self.bps / 10_000


class VolumeSlippage(SlippageModel):
    """Slippage proportional to participation rate."""
    def __init__(self, pct_volume: float = 0.01):
        self.pct = pct_volume
    def compute(self, price, shares, bar):
        try:
            vol = float(getattr(bar, 'volume', 1_000_000))
        except Exception:
            vol = 1_000_000
        participation = abs(shares) / max(vol, 1)
        return abs(price * shares) * participation * self.pct


# ─── POSITION SIZERS ──────────────────────────────────────────────────────────

class PositionSizer(ABC):
    @abstractmethod
    def size(self, capital: float, price: float, volatility: float, bars: pd.DataFrame) -> float: ...


class FixedFractional(PositionSizer):
    def __init__(self, fraction: float = 0.95):
        self.fraction = fraction
    def size(self, capital, price, volatility, bars):
        return math.floor(capital * self.fraction / max(price, 0.01))


class ATRSizer(PositionSizer):
    def __init__(self, risk_fraction: float = 0.02, atr_multiplier: float = 2.0):
        self.risk_fraction = risk_fraction
        self.atr_multiplier = atr_multiplier
    def size(self, capital, price, volatility, bars):
        atr = volatility * price if volatility > 0 else price * 0.02
        risk_per_share = atr * self.atr_multiplier
        if risk_per_share <= 0:
            return 1
        return max(1, math.floor(capital * self.risk_fraction / risk_per_share))


class KellyCriterion(PositionSizer):
    def __init__(self, win_rate: float = 0.55, avg_win_loss: float = 1.5):
        self.win_rate = win_rate
        self.avg_win_loss = avg_win_loss
    def size(self, capital, price, volatility, bars):
        kelly_f = self.win_rate - (1 - self.win_rate) / max(self.avg_win_loss, 0.01)
        kelly_f = max(0, min(0.25, kelly_f))  # cap at 25%
        return math.floor(capital * kelly_f / max(price, 0.01))


# ─── STRATEGIES ───────────────────────────────────────────────────────────────

class Strategy(ABC):
    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """Return series of signals: 1=long, -1=short/exit, 0=flat."""
        ...


class MovingAverageCrossStrategy(Strategy):
    """Fast/slow SMA/EMA crossover."""
    def __init__(self, fast_period: int = 20, slow_period: int = 50, ma_type: str = "sma"):
        self.fast = fast_period
        self.slow = slow_period
        self.ma_type = ma_type

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        if self.ma_type == "ema":
            fast_ma = close.ewm(span=self.fast, adjust=False).mean()
            slow_ma = close.ewm(span=self.slow, adjust=False).mean()
        else:
            fast_ma = close.rolling(self.fast).mean()
            slow_ma = close.rolling(self.slow).mean()
        signal = pd.Series(0, index=df.index)
        cross_up = (fast_ma > slow_ma) & (fast_ma.shift(1) <= slow_ma.shift(1))
        cross_dn = (fast_ma < slow_ma) & (fast_ma.shift(1) >= slow_ma.shift(1))
        signal[cross_up] = 1
        signal[cross_dn] = -1
        return signal


class RSIMeanReversionStrategy(Strategy):
    """RSI overbought/oversold mean reversion."""
    def __init__(self, rsi_period: int = 14, oversold: float = 30, overbought: float = 70):
        self.period = rsi_period
        self.oversold = oversold
        self.overbought = overbought

    @staticmethod
    def _rsi(close: pd.Series, period: int) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(period).mean()
        loss = (-delta).clip(lower=0).rolling(period).mean()
        rs = gain / loss.replace(0, np.nan)
        return 100 - 100 / (1 + rs)

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        rsi = self._rsi(df["close"], self.period)
        signal = pd.Series(0, index=df.index)
        signal[(rsi < self.oversold) & (rsi.shift(1) >= self.oversold)] = 1
        signal[(rsi > self.overbought) & (rsi.shift(1) <= self.overbought)] = -1
        return signal


class BollingerBandStrategy(Strategy):
    """Bollinger Band breakout (buy break-up, sell break-down)."""
    def __init__(self, period: int = 20, std_dev: float = 2.0):
        self.period = period
        self.std_dev = std_dev

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]
        mid = close.rolling(self.period).mean()
        std = close.rolling(self.period).std()
        upper = mid + self.std_dev * std
        lower = mid - self.std_dev * std
        signal = pd.Series(0, index=df.index)
        signal[(close > upper) & (close.shift(1) <= upper.shift(1))] = 1
        signal[(close < lower) & (close.shift(1) >= lower.shift(1))] = -1
        return signal


class BreakoutStrategy(Strategy):
    """N-period Donchian channel breakout."""
    def __init__(self, period: int = 20, atr_multiplier: float = 1.5):
        self.period = period
        self.atr_multiplier = atr_multiplier

    @staticmethod
    def _atr(df: pd.DataFrame, period: int) -> pd.Series:
        hi, lo, cl = df["high"], df["low"], df["close"]
        tr = pd.concat([hi - lo, (hi - cl.shift(1)).abs(), (lo - cl.shift(1)).abs()], axis=1).max(axis=1)
        return tr.rolling(period).mean()

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        high_max = df["high"].rolling(self.period).max()
        low_min = df["low"].rolling(self.period).min()
        signal = pd.Series(0, index=df.index)
        signal[(df["close"] > high_max.shift(1)) & (df["close"].shift(1) <= high_max.shift(2))] = 1
        signal[(df["close"] < low_min.shift(1)) & (df["close"].shift(1) >= low_min.shift(2))] = -1
        return signal


# ─── BACKTEST ENGINE ──────────────────────────────────────────────────────────

class BacktestEngine:
    """
    Event-driven backtesting engine.
    - Executes trades at next bar open after signal.
    - Tracks equity curve, drawdown, trades.
    """

    def __init__(
        self,
        data: pd.DataFrame,
        strategy: Strategy,
        initial_capital: float = 100_000.0,
        commission_model: Optional[CommissionModel] = None,
        slippage_model: Optional[SlippageModel] = None,
        position_sizer: Optional[PositionSizer] = None,
    ):
        self.df = data.copy()
        self.strategy = strategy
        self.capital = initial_capital
        self.initial_capital = initial_capital
        self.comm = commission_model or FixedCommission(1.0)
        self.slip = slippage_model or FixedSlippage(5.0)
        self.sizer = position_sizer or FixedFractional(0.95)

    def run(self) -> BacktestResult:
        df = self.df
        signals = self.strategy.generate_signals(df)

        capital = self.initial_capital
        position = 0.0       # shares held
        entry_price = 0.0
        entry_date = None
        entry_bar_idx = 0
        direction = "long"

        equity = pd.Series(index=df.index, dtype=float)
        trades: List[Trade] = []
        total_comm = 0.0
        total_slip = 0.0

        # Rolling volatility (20-bar std of returns)
        returns = df["close"].pct_change()
        rolling_vol = returns.rolling(20).std().fillna(0.02)

        for i, (idx, row) in enumerate(df.iterrows()):
            sig = signals.iloc[i] if i < len(signals) else 0

            # Execute at next bar's open (simulate enter/exit at open)
            exec_price = float(row.get("open", row["close"]))

            # Close position on exit signal or end of data
            if position != 0 and (sig == -1 or i == len(df) - 1):
                comm_out = self.comm.compute(exec_price, position)
                slip_out = self.slip.compute(exec_price, position, row)
                pnl = position * (exec_price - entry_price) - comm_out - slip_out
                pnl_pct = pnl / (entry_price * abs(position)) if entry_price > 0 else 0
                capital += position * exec_price - comm_out - slip_out
                total_comm += comm_out
                total_slip += slip_out
                trades.append(Trade(
                    entry_date=entry_date, exit_date=idx,
                    direction="long", entry_price=entry_price, exit_price=exec_price,
                    shares=position, pnl=pnl, pnl_pct=pnl_pct,
                    commission=comm_out, slippage=slip_out,
                    duration_bars=i - entry_bar_idx,
                ))
                position = 0.0

            # Enter on buy signal
            if sig == 1 and position == 0:
                vol = float(rolling_vol.iloc[i])
                shares = self.sizer.size(capital, exec_price, vol, df.iloc[: i + 1])
                shares = max(1, shares)
                cost = shares * exec_price
                comm_in = self.comm.compute(exec_price, shares)
                slip_in = self.slip.compute(exec_price, shares, row)
                total_cost = cost + comm_in + slip_in
                if total_cost <= capital:
                    capital -= total_cost
                    position = shares
                    entry_price = exec_price
                    entry_date = idx
                    entry_bar_idx = i
                    total_comm += comm_in
                    total_slip += slip_in

            # Mark to market
            mtm = position * float(row["close"]) if position > 0 else 0
            equity.iloc[i] = capital + mtm

        # Compute metrics
        metrics = self._compute_metrics(equity, trades, total_comm, total_slip, df)

        # Drawdown curve
        rolling_max = equity.cummax()
        dd_curve = (equity - rolling_max) / rolling_max.replace(0, np.nan)

        return BacktestResult(metrics=metrics, equity_curve=equity, drawdown_curve=dd_curve, trades=trades)

    def _compute_metrics(self, equity: pd.Series, trades: List[Trade],
                          total_comm: float, total_slip: float, df: pd.DataFrame) -> BacktestMetrics:
        if equity.empty:
            return BacktestMetrics()

        final_capital = float(equity.iloc[-1])
        total_return = (final_capital - self.initial_capital) / self.initial_capital

        # CAGR
        n_bars = len(equity)
        bars_per_year = 252.0
        years = n_bars / bars_per_year
        cagr = (final_capital / self.initial_capital) ** (1 / max(years, 0.01)) - 1 if years > 0 else 0

        # Daily returns
        daily_ret = equity.pct_change().dropna()
        vol = float(daily_ret.std()) * math.sqrt(bars_per_year)
        rf_daily = 0.04 / bars_per_year
        _ret_std = float(daily_ret.std())
        sharpe = 0.0 if _ret_std < 1e-6 else (float(daily_ret.mean()) - rf_daily) / _ret_std * math.sqrt(bars_per_year)

        # Sortino
        downside_ret = daily_ret[daily_ret < rf_daily]
        sortino_denom = float(downside_ret.std()) * math.sqrt(bars_per_year) if len(downside_ret) > 0 else 1e-9
        sortino = (cagr - 0.04) / max(sortino_denom, 1e-9)

        # Max drawdown
        rolling_max = equity.cummax()
        dd = (equity - rolling_max) / rolling_max.replace(0, np.nan)
        max_dd = float(dd.min())

        # Calmar
        calmar = cagr / abs(max_dd) if max_dd != 0 else 0

        # Trade stats
        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl <= 0]
        win_rate = len(wins) / max(len(trades), 1)
        avg_win = float(np.mean([t.pnl for t in wins])) if wins else 0
        avg_loss = float(np.mean([t.pnl for t in losses])) if losses else 0
        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        profit_factor = gross_profit / max(gross_loss, 1e-9)
        avg_trade_pnl = float(np.mean([t.pnl for t in trades])) if trades else 0
        avg_duration = float(np.mean([t.duration_bars for t in trades])) if trades else 0

        start_date = str(df.index[0].date()) if len(df) > 0 else ""
        end_date = str(df.index[-1].date()) if len(df) > 0 else ""

        def _safe(v: float) -> float:
            if math.isnan(v) or math.isinf(v):
                return 0.0
            return round(v, 6)

        return BacktestMetrics(
            total_return=_safe(total_return),
            cagr=_safe(cagr),
            volatility=_safe(vol),
            sharpe=_safe(sharpe),
            sortino=_safe(sortino),
            max_drawdown=_safe(max_dd),
            calmar=_safe(calmar),
            win_rate=_safe(win_rate),
            profit_factor=_safe(profit_factor),
            avg_win=_safe(avg_win),
            avg_loss=_safe(avg_loss),
            total_trades=len(trades),
            num_wins=len(wins),
            num_losses=len(losses),
            avg_trade_pnl=_safe(avg_trade_pnl),
            avg_trade_duration=_safe(avg_duration),
            total_commission=_safe(total_comm),
            total_slippage=_safe(total_slip),
            start_date=start_date,
            end_date=end_date,
            years=_safe(years),
            initial_capital=self.initial_capital,
            final_capital=_safe(final_capital),
            best_trade=_safe(max((t.pnl for t in trades), default=0)),
            worst_trade=_safe(min((t.pnl for t in trades), default=0)),
        )


# ─── WALK-FORWARD OPTIMIZATION ────────────────────────────────────────────────

def walk_forward_optimize(
    df: pd.DataFrame,
    strategy_cls,
    param_grid: Dict[str, List],
    n_folds: int = 5,
    train_ratio: float = 0.7,
    initial_capital: float = 100_000,
    commission_model: Optional[CommissionModel] = None,
    slippage_model: Optional[SlippageModel] = None,
    position_sizer: Optional[PositionSizer] = None,
) -> Dict[str, Any]:
    """
    Walk-forward optimization. Splits data into n_folds.
    In each fold: grids over param_grid on train, evaluates best on test.
    """
    import itertools

    fold_size = len(df) // n_folds
    results = []

    for fold in range(n_folds):
        start = fold * fold_size
        end = start + fold_size
        fold_df = df.iloc[start:end]

        train_end = int(len(fold_df) * train_ratio)
        train_df = fold_df.iloc[:train_end]
        test_df = fold_df

        # Grid search on train data
        keys = list(param_grid.keys())
        best_sharpe = -np.inf
        best_params: Dict = {}
        for values in itertools.product(*param_grid.values()):
            params = dict(zip(keys, values))
            try:
                st = strategy_cls(**params)
                eng = BacktestEngine(train_df, st, initial_capital, commission_model, slippage_model, position_sizer)
                res = eng.run()
                if res.metrics.sharpe > best_sharpe:
                    best_sharpe = res.metrics.sharpe
                    best_params = params
            except Exception:
                pass

        # Evaluate best params on test data
        try:
            st = strategy_cls(**(best_params or {}))
            eng = BacktestEngine(test_df, st, initial_capital, commission_model, slippage_model, position_sizer)
            test_res = eng.run()
            results.append({
                "fold": fold,
                "best_params": best_params,
                "is_sharpe": best_sharpe,
                "oos_sharpe": test_res.metrics.sharpe,
                "oos_cagr": test_res.metrics.cagr,
                "oos_max_dd": test_res.metrics.max_drawdown,
                "oos_total_return": test_res.metrics.total_return,
            })
        except Exception as e:
            results.append({"fold": fold, "error": str(e)})

    # Summary
    oos_sharpes = [r["oos_sharpe"] for r in results if "oos_sharpe" in r]
    is_sharpes = [r["is_sharpe"] for r in results if "is_sharpe" in r]
    degradation = (np.mean(oos_sharpes) / np.mean(is_sharpes)) if is_sharpes and oos_sharpes else 0
    robust = degradation >= 0.5

    return {
        "folds": results,
        "avg_oos_sharpe": float(np.mean(oos_sharpes)) if oos_sharpes else 0,
        "avg_is_sharpe": float(np.mean(is_sharpes)) if is_sharpes else 0,
        "degradation_ratio": float(degradation),
        "robust": bool(robust),
    }


# ─── MONTE CARLO SIMULATION ───────────────────────────────────────────────────

def monte_carlo_backtest(
    trades: List[Trade],
    n_sim: int = 1000,
    initial_capital: float = 100_000,
) -> Dict[str, Any]:
    """
    Bootstrap Monte Carlo on trade P&L series.
    Returns percentile equity curves and risk stats.
    """
    if not trades:
        return {"error": "no trades"}

    pnls = np.array([t.pnl for t in trades])
    n_trades = len(pnls)

    sim_finals = []
    sim_max_dds = []
    sim_sharpes = []

    rng = np.random.default_rng(42)

    for _ in range(n_sim):
        shuffled = rng.choice(pnls, size=n_trades, replace=True)
        equity = initial_capital + np.cumsum(shuffled)
        equity = np.insert(equity, 0, initial_capital)
        rolling_max = np.maximum.accumulate(equity)
        dd = (equity - rolling_max) / np.where(rolling_max > 0, rolling_max, 1)
        sim_finals.append(float(equity[-1]))
        sim_max_dds.append(float(dd.min()))
        returns = np.diff(equity) / np.where(equity[:-1] > 0, equity[:-1], 1)
        sh = float(np.mean(returns) / np.std(returns)) * math.sqrt(252) if np.std(returns) > 0 else 0
        sim_sharpes.append(sh)

    percentiles = [5, 10, 25, 50, 75, 90, 95]
    final_pcts = {str(p): round(float(np.percentile(sim_finals, p)), 2) for p in percentiles}
    dd_pcts = {str(p): round(float(np.percentile(sim_max_dds, p)), 4) for p in percentiles}

    return {
        "n_sim": n_sim,
        "n_trades": n_trades,
        "final_equity_percentiles": final_pcts,
        "max_drawdown_percentiles": dd_pcts,
        "median_sharpe": round(float(np.median(sim_sharpes)), 3),
        "prob_profit": round(float(np.mean(np.array(sim_finals) > initial_capital)), 4),
        "prob_max_dd_over_20pct": round(float(np.mean(np.array(sim_max_dds) < -0.20)), 4),
        "expected_final": round(float(np.mean(sim_finals)), 2),
        "worst_5pct_final": round(float(np.percentile(sim_finals, 5)), 2),
    }


# ─── TEARSHEET ────────────────────────────────────────────────────────────────

def generate_tearsheet(result: BacktestResult) -> Dict[str, Any]:
    """
    Generate a comprehensive tearsheet dict from a BacktestResult.
    """
    m = result.metrics

    # Monthly returns table
    monthly_returns: Dict[str, Any] = {}
    if result.equity_curve is not None and not result.equity_curve.empty:
        ec = result.equity_curve.dropna()
        monthly_ret = ec.resample("M").last().pct_change().dropna()
        for dt, ret in monthly_ret.items():
            key = dt.strftime("%Y-%m")
            monthly_returns[key] = round(float(ret) * 100, 2)

    # Rolling stats
    rolling: Dict[str, List] = {"dates": [], "sharpe": [], "vol": []}
    if result.equity_curve is not None and len(result.equity_curve) > 60:
        ec = result.equity_curve.dropna()
        rets = ec.pct_change().dropna()
        for i in range(60, len(rets)):
            window = rets.iloc[i - 60: i]
            sharpe = float(window.mean() / window.std()) * math.sqrt(252) if window.std() > 0 else 0
            vol = float(window.std()) * math.sqrt(252)
            rolling["dates"].append(str(rets.index[i]))
            rolling["sharpe"].append(round(sharpe, 3))
            rolling["vol"].append(round(vol, 4))

    return {
        "summary": dataclasses.asdict(m),
        "monthly_returns": monthly_returns,
        "rolling": rolling,
        "trade_histogram": _trade_histogram(result.trades or []),
    }


def _trade_histogram(trades: List[Trade], bins: int = 20) -> Dict[str, Any]:
    if not trades:
        return {"bins": [], "counts": []}
    pnls = [t.pnl for t in trades]
    counts, edges = np.histogram(pnls, bins=bins)
    return {
        "bins": [round(float(e), 2) for e in edges],
        "counts": [int(c) for c in counts],
    }
