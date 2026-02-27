"""
backtest_v4.py — Backtesting API Routes (v4)
=============================================
REST API powered by backtest_engine.py

Endpoints:
    POST /api/v4/backtest/run          → Run a backtest with built-in strategy
    POST /api/v4/backtest/tearsheet    → Generate tearsheet from result data
    POST /api/v4/backtest/wfo          → Walk-forward optimization
    POST /api/v4/backtest/montecarlo   → Monte Carlo simulation of equity curve
    POST /api/v4/backtest/compare      → Compare multiple strategies on same data
    GET  /api/v4/backtest/strategies   → List available built-in strategies
    GET  /api/v4/backtest/commissions  → List commission model types
"""

from __future__ import annotations
import math
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
import numpy as np
import pandas as pd

try:
    from ...backtest_engine import (
        BacktestEngine,
        BacktestResult,
        MovingAverageCrossStrategy,
        RSIMeanReversionStrategy,
        BollingerBandStrategy,
        BreakoutStrategy,
        FixedCommission,
        PerShareCommission,
        PercentageCommission,
        TieredCommission,
        FixedSlippage,
        VolumeSlippage,
        FixedFractional,
        ATRSizer,
        KellyCriterion,
        walk_forward_optimize,
        monte_carlo_backtest,
        generate_tearsheet,
    )
    _BACKTEST_AVAILABLE = True
except ImportError:
    _BACKTEST_AVAILABLE = False

router = APIRouter(prefix="/api/v4/backtest", tags=["Backtest v4"])


# ─── PYDANTIC MODELS ──────────────────────────────────────────────────────────

class OHLCVBar(BaseModel):
    date:   Optional[str] = None      # "YYYY-MM-DD" string
    time:   Optional[int] = None      # Unix timestamp (ms or s) from frontend
    open:   float
    high:   float
    low:    float
    close:  float
    volume: float = 0.0

    @model_validator(mode="after")
    def _resolve_date(self) -> "OHLCVBar":
        if self.date is None:
            if self.time is not None:
                ts = self.time
                if ts > 1e10:  # milliseconds
                    ts = ts / 1000
                self.date = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
            else:
                self.date = "1970-01-01"
        return self


class CommissionConfig(BaseModel):
    type:   Literal["fixed", "per_share", "percentage", "tiered"] = "fixed"
    value:  float = Field(1.0, ge=0)    # flat fee / per-share / percentage
    tiers:  Optional[List[List[float]]] = None  # [[volume, rate], ...]


class SlippageConfig(BaseModel):
    type:   Literal["fixed", "volume"] = "fixed"
    value:  float = Field(0.0005, ge=0)  # % of price or impact factor


class PositionSizerConfig(BaseModel):
    type:          Literal["fixed_fractional", "atr", "kelly"] = "fixed_fractional"
    risk_fraction: float = Field(0.02, ge=0.001, le=0.5)
    atr_multiplier: float = 2.0


class BacktestRequest(BaseModel):
    ohlcv:           List[OHLCVBar]
    strategy:        Literal[
        "ma_cross", "rsi_mean_reversion", "bollinger_band", "breakout"
    ] = "ma_cross"
    params:          Optional[Dict[str, Any]] = None
    initial_capital: float = Field(100_000.0, gt=0)
    commission:      CommissionConfig = CommissionConfig()
    slippage:        SlippageConfig   = SlippageConfig()
    position_sizer:  PositionSizerConfig = PositionSizerConfig()


class WFORequest(BaseModel):
    ohlcv:            List[OHLCVBar]
    strategy:         Literal["ma_cross", "rsi_mean_reversion", "bollinger_band", "breakout"] = "ma_cross"
    param_grid:       Dict[str, List[Any]]
    initial_capital:  float = 100_000.0
    in_sample_pct:    float = Field(0.7, gt=0, le=0.95)
    n_windows:        int   = Field(5, ge=2, le=20)
    optimize_metric:  str   = "sharpe_ratio"
    commission:       CommissionConfig = CommissionConfig()


class MonteCarloRequest(BaseModel):
    trade_returns:    List[float]   # list of individual trade P&L percentages
    initial_capital:  float = 100_000.0
    n_simulations:    int   = Field(1000, ge=100, le=50_000)
    confidence_level: float = Field(0.95, ge=0.5, le=0.9999)


class MultistratRequest(BaseModel):
    ohlcv:           List[OHLCVBar]
    strategies:      List[Dict[str, Any]]  # [{strategy, params}, ...]
    initial_capital: float = 100_000.0
    commission:      CommissionConfig = CommissionConfig()


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def safe(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 6)
    except Exception:
        return None


def bars_to_df(ohlcv: List[OHLCVBar]) -> pd.DataFrame:
    rows = []
    for b in ohlcv:
        rows.append({
            "date":   b.date,
            "open":   b.open,
            "high":   b.high,
            "low":    b.low,
            "close":  b.close,
            "volume": b.volume,
        })
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")
    df.sort_index(inplace=True)
    return df


def build_commission(cfg: CommissionConfig):
    if not _BACKTEST_AVAILABLE:
        return None
    if cfg.type == "fixed":
        return FixedCommission(cfg.value)
    if cfg.type == "per_share":
        return PerShareCommission(cfg.value)
    if cfg.type == "percentage":
        return PercentageCommission(cfg.value)
    if cfg.type == "tiered":
        tiers = cfg.tiers or [[0, 0.005], [1000, 0.003], [10000, 0.001]]
        return TieredCommission(tiers)
    return FixedCommission(1.0)


def build_slippage(cfg: SlippageConfig):
    if not _BACKTEST_AVAILABLE:
        return None
    if cfg.type == "volume":
        return VolumeSlippage(cfg.value)
    return FixedSlippage(cfg.value)


def build_sizer(cfg: PositionSizerConfig):
    if not _BACKTEST_AVAILABLE:
        return None
    if cfg.type == "atr":
        return ATRSizer(cfg.risk_fraction, cfg.atr_multiplier)
    if cfg.type == "kelly":
        return KellyCriterion(cfg.risk_fraction)
    return FixedFractional(cfg.risk_fraction)


STRATEGY_MAP = {
    "ma_cross":            MovingAverageCrossStrategy if _BACKTEST_AVAILABLE else None,
    "rsi_mean_reversion":  RSIMeanReversionStrategy   if _BACKTEST_AVAILABLE else None,
    "bollinger_band":      BollingerBandStrategy       if _BACKTEST_AVAILABLE else None,
    "breakout":            BreakoutStrategy             if _BACKTEST_AVAILABLE else None,
} if _BACKTEST_AVAILABLE else {}


def result_to_response(res: "BacktestResult", strategy_name: str = "backtest") -> Dict:
    import dataclasses
    import numpy as np

    m = res.metrics

    # VaR 95% as percentage (5th percentile of daily returns)
    var_95 = None
    if res.equity_curve is not None and len(res.equity_curve) > 5:
        rets = res.equity_curve.pct_change().dropna().values
        if len(rets) > 0:
            var_95 = safe(float(np.percentile(rets, 5)))

    # Flat metrics matching frontend BacktestMetrics interface
    flat_metrics = {
        "total_return":      safe(m.total_return),
        "annualized_return": safe(m.cagr),
        "sharpe_ratio":      safe(m.sharpe),
        "sortino_ratio":     safe(m.sortino),
        "calmar_ratio":      safe(m.calmar),
        "max_drawdown":      safe(m.max_drawdown),
        "win_rate":          safe(m.win_rate),
        "profit_factor":     safe(m.profit_factor),
        "total_trades":      m.total_trades,
        "initial_capital":   safe(m.initial_capital),
        "final_equity":      safe(m.final_capital),
        "volatility":        safe(m.volatility),
        "var_95":            var_95,
        "strategy_name":     strategy_name,
        # Extra detail fields
        "num_wins":          m.num_wins,
        "num_losses":        m.num_losses,
        "avg_win":           safe(m.avg_win),
        "avg_loss":          safe(m.avg_loss),
        "best_trade":        safe(m.best_trade),
        "worst_trade":       safe(m.worst_trade),
        "years":             safe(m.years),
        "total_commission":  safe(m.total_commission),
        "total_slippage":    safe(m.total_slippage),
        "start_date":        m.start_date,
        "end_date":          m.end_date,
    }

    # Equity curve as plain array of numbers
    equity = []
    equity_dates = []
    if res.equity_curve is not None:
        for d, v in res.equity_curve.items():
            try:
                equity_dates.append(str(d.date()))
                equity.append(safe(v))
            except Exception:
                pass

    # Drawdown as plain array (frontend calls it drawdown_series)
    drawdown = []
    if res.drawdown_curve is not None:
        for d, v in res.drawdown_curve.items():
            try:
                drawdown.append(safe(v) or 0.0)
            except Exception:
                pass

    # Trades in frontend Trade interface format
    trades_out = []
    if res.trades:
        for t in res.trades[:500]:
            try:
                entry_ts = int(pd.Timestamp(t.entry_date).timestamp()) if t.entry_date else 0
                exit_ts  = int(pd.Timestamp(t.exit_date).timestamp()) if t.exit_date else 0
            except Exception:
                entry_ts, exit_ts = 0, 0
            trades_out.append({
                "entry_time":  entry_ts,
                "exit_time":   exit_ts,
                "side":        t.direction or "long",
                "entry_price": safe(t.entry_price),
                "exit_price":  safe(t.exit_price),
                "quantity":    safe(t.shares),
                "pnl":         safe(t.pnl),
                "pnl_pct":     safe(t.pnl_pct),
                "return_pct":  safe(t.pnl_pct),
                "commission":  safe(t.commission),
                "slippage":    safe(t.slippage),
                "duration_bars": t.duration_bars,
            })

    return {
        **flat_metrics,
        "equity_curve":    equity,
        "equity_dates":    equity_dates,
        "drawdown_series": drawdown,
        "trades":          trades_out,
    }



# ─── ROUTES ───────────────────────────────────────────────────────────────────

@router.post("/run")
async def run_backtest(req: BacktestRequest):
    """
    Run an event-driven backtest on OHLCV data.

    Built-in strategies:
    - **ma_cross**: Fast/slow moving average crossover. Params: fast_period, slow_period, ma_type.
    - **rsi_mean_reversion**: RSI oversold/overbought entry/exit. Params: rsi_period, oversold, overbought.
    - **bollinger_band**: Band breakout with mean-reversion exit. Params: period, std_dev.
    - **breakout**: N-period high breakout with ATR trailing stop. Params: period, atr_multiplier.

    Returns metrics, equity curve, drawdown curve, trade log (capped at 500).
    """
    if not _BACKTEST_AVAILABLE:
        raise HTTPException(503, "Backtest engine unavailable")

    df = bars_to_df(req.ohlcv)
    if len(df) < 50:
        raise HTTPException(400, "Minimum 50 bars required for backtesting")

    strategy_cls = STRATEGY_MAP.get(req.strategy)
    if not strategy_cls:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    try:
        params   = req.params or {}
        strategy = strategy_cls(**params)
        comm     = build_commission(req.commission)
        slip     = build_slippage(req.slippage)
        sizer    = build_sizer(req.position_sizer)

        engine = BacktestEngine(
            data             = df,
            strategy         = strategy,
            initial_capital  = req.initial_capital,
            commission_model = comm,
            slippage_model   = slip,
            position_sizer   = sizer,
        )

        result = engine.run()
        _STRAT_NAMES = {
            "ma_cross": "MA Cross (20/50 SMA)",
            "rsi_mean_reversion": "RSI Mean Reversion (30/70)",
            "bollinger_band": "Bollinger Band Breakout",
            "breakout": "20-Day Channel Breakout",
        }
        return result_to_response(result, strategy_name=_STRAT_NAMES.get(req.strategy, req.strategy))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/wfo")
async def walk_forward_optimization(req: WFORequest):
    """
    Walk-Forward Optimization (WFO) — avoids curve-fitting by out-of-sample validation.

    Splits data into N in-sample/out-of-sample windows. For each window:
    1. Grid-searches param_grid on in-sample data.
    2. Tests best params on out-of-sample data.
    3. Concatenates OOS equity curves for a realistic cumulative result.

    Returns per-window results, best params per window, and combined OOS metrics.
    """
    if not _BACKTEST_AVAILABLE:
        raise HTTPException(503, "Backtest engine unavailable")

    df = bars_to_df(req.ohlcv)
    strategy_cls = STRATEGY_MAP.get(req.strategy)
    if not strategy_cls:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    if len(df) < 100:
        raise HTTPException(400, "Minimum 100 bars required for WFO")

    try:
        comm = build_commission(req.commission)
        results = walk_forward_optimize(
            data              = df,
            strategy_class    = strategy_cls,
            param_grid        = req.param_grid,
            n_windows         = req.n_windows,
            in_sample_pct     = req.in_sample_pct,
            initial_capital   = req.initial_capital,
            optimize_on       = req.optimize_metric,
            commission_model  = comm,
        )

        windows_out = []
        for w in results.get("windows", []):
            windows_out.append({
                "window":       w.get("window"),
                "best_params":  w.get("best_params", {}),
                "is_sharpe":    safe(w.get("in_sample_sharpe")),
                "oos_sharpe":   safe(w.get("out_of_sample_sharpe")),
                "oos_return":   safe(w.get("out_of_sample_total_return")),
                "oos_max_dd":   safe(w.get("out_of_sample_max_drawdown")),
            })

        return {
            "windows":          windows_out,
            "combined_sharpe":  safe(results.get("combined_oos_sharpe")),
            "combined_return":  safe(results.get("combined_oos_return")),
            "n_windows":        len(windows_out),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/montecarlo")
async def monte_carlo(req: MonteCarloRequest):
    """
    Monte Carlo simulation of portfolio equity curve from trade returns.

    Shuffles trade returns across N simulations to produce:
    - Percentile equity curves (5th, 25th, 50th, 75th, 95th)
    - Distribution of final equity
    - P(ruin) — probability of 50%+ drawdown
    - Expected CAGR and max drawdown at chosen confidence level
    """
    if not _BACKTEST_AVAILABLE:
        raise HTTPException(503, "Backtest engine unavailable")

    if len(req.trade_returns) < 5:
        raise HTTPException(400, "Minimum 5 trades required")

    try:
        result = monte_carlo_backtest(
            trade_returns     = req.trade_returns,
            initial_capital   = req.initial_capital,
            n_simulations     = req.n_simulations,
            confidence_level  = req.confidence_level,
        )

        p = result.get("percentiles", {})
        curves_out = {}
        for pct_key, curve in p.items():
            curves_out[pct_key] = [safe(v) for v in (curve[:500] if hasattr(curve, "__len__") else [])]

        return {
            "n_simulations":         req.n_simulations,
            "initial_capital":       req.initial_capital,
            "percentile_curves":     curves_out,
            "median_final":          safe(result.get("median_final_equity")),
            "worst_case_final":      safe(result.get("pct5_final_equity")),
            "best_case_final":       safe(result.get("pct95_final_equity")),
            "prob_of_ruin":          safe(result.get("prob_ruin")),
            "expected_max_drawdown": safe(result.get("expected_max_drawdown")),
            "var_at_confidence":     safe(result.get("var_at_confidence")),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/compare")
async def compare_strategies(req: MultistratRequest):
    """
    Compare multiple strategies on the same dataset.
    Each entry in `strategies` is {strategy: str, params: dict}.
    Returns side-by-side metrics table and equity curves for all strategies.
    """
    if not _BACKTEST_AVAILABLE:
        raise HTTPException(503, "Backtest engine unavailable")

    df   = bars_to_df(req.ohlcv)
    comm = build_commission(req.commission)

    if len(df) < 50:
        raise HTTPException(400, "Minimum 50 bars required")
    if len(req.strategies) < 1:
        raise HTTPException(400, "At least one strategy required")
    if len(req.strategies) > 10:
        raise HTTPException(400, "Maximum 10 strategies for comparison")

    results_out = []
    for strat_cfg in req.strategies:
        name  = strat_cfg.get("strategy", "ma_cross")
        prms  = strat_cfg.get("params", {})

        cls = STRATEGY_MAP.get(name)
        if not cls:
            results_out.append({"strategy": name, "error": f"Unknown strategy: {name}"})
            continue

        try:
            strategy = cls(**prms)
            engine = BacktestEngine(
                data             = df,
                strategy         = strategy,
                initial_capital  = req.initial_capital,
                commission_model = comm,
                slippage_model   = FixedSlippage(0.0005),
            )
            res = engine.run()
            r   = result_to_response(res)
            results_out.append({
                "strategy":      name,
                "params":        prms,
                "metrics":       r["metrics"],
                "equity_curve":  r["equity_curve"],
                "total_trades":  r["total_trades"],
            })
        except Exception as exc:
            results_out.append({"strategy": name, "params": prms, "error": str(exc)})

    return {"results": results_out, "strategies_tested": len(results_out)}


@router.post("/tearsheet")
async def generate_tearsheet_endpoint(req: BacktestRequest):
    """
    Run a backtest AND return a full quantitative tearsheet.
    Includes all metrics, monthly returns table, trade distribution, drawdown analysis.
    """
    if not _BACKTEST_AVAILABLE:
        raise HTTPException(503, "Backtest engine unavailable")

    df           = bars_to_df(req.ohlcv)
    strategy_cls = STRATEGY_MAP.get(req.strategy)
    if not strategy_cls:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    try:
        strategy = strategy_cls(**(req.params or {}))
        engine = BacktestEngine(
            data             = df,
            strategy         = strategy,
            initial_capital  = req.initial_capital,
            commission_model = build_commission(req.commission),
            slippage_model   = build_slippage(req.slippage),
            position_sizer   = build_sizer(req.position_sizer),
        )
        result   = engine.run()
        tearsheet = generate_tearsheet(result)

        # Convert monthly returns to list of records
        monthly = tearsheet.get("monthly_returns", {})
        if isinstance(monthly, dict):
            monthly_out = [{"period": str(k), "return": safe(v)} for k, v in monthly.items()]
        else:
            monthly_out = []

        return {
            **result_to_response(result),
            "tearsheet": {
                "monthly_returns":    monthly_out,
                "win_rate":           safe(tearsheet.get("win_rate")),
                "profit_factor":      safe(tearsheet.get("profit_factor")),
                "avg_win":            safe(tearsheet.get("avg_win")),
                "avg_loss":           safe(tearsheet.get("avg_loss")),
                "avg_hold_bars":      safe(tearsheet.get("avg_hold_bars")),
                "best_trade":         safe(tearsheet.get("best_trade")),
                "worst_trade":        safe(tearsheet.get("worst_trade")),
                "consecutive_wins":   tearsheet.get("max_consecutive_wins"),
                "consecutive_losses": tearsheet.get("max_consecutive_losses"),
                "trade_return_dist":  [safe(v) for v in (tearsheet.get("trade_returns", []) or [])[:200]],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/strategies")
async def list_strategies():
    """List all available built-in backtest strategies and their parameters."""
    return {
        "strategies": [
            {
                "name":        "ma_cross",
                "display":     "Moving Average Crossover",
                "description": "Classic dual-MA crossover. Long when fast MA crosses above slow MA.",
                "params": {
                    "fast_period": {"type": "int", "default": 20,  "range": [5,   200]},
                    "slow_period": {"type": "int", "default": 50,  "range": [10,  500]},
                    "ma_type":     {"type": "str", "default": "ema", "options": ["sma","ema","wma"]},
                },
            },
            {
                "name":        "rsi_mean_reversion",
                "display":     "RSI Mean Reversion",
                "description": "Long when RSI crosses above oversold level, exits at overbought.",
                "params": {
                    "rsi_period": {"type": "int",   "default": 14,  "range": [5,  50]},
                    "oversold":   {"type": "float", "default": 30,  "range": [10, 50]},
                    "overbought": {"type": "float", "default": 70,  "range": [50, 90]},
                },
            },
            {
                "name":        "bollinger_band",
                "display":     "Bollinger Band Reversion",
                "description": "Buy at lower band, sell at upper band or middle (mean reversion).",
                "params": {
                    "period":  {"type": "int",   "default": 20,  "range": [10,  100]},
                    "std_dev": {"type": "float", "default": 2.0, "range": [1.0, 3.0]},
                },
            },
            {
                "name":        "breakout",
                "display":     "N-Period Breakout",
                "description": "Buy on N-bar high breakout with ATR-based trailing stop.",
                "params": {
                    "period":         {"type": "int",   "default": 20,  "range": [5,  100]},
                    "atr_multiplier": {"type": "float", "default": 2.0, "range": [1.0, 5.0]},
                    "atr_period":     {"type": "int",   "default": 14,  "range": [5,  30]},
                },
            },
        ]
    }


@router.get("/commissions")
async def list_commission_models():
    """Describe available commission model types."""
    return {
        "models": [
            {"type": "fixed",     "description": "Flat fee per trade (e.g. $1 per trade)", "value_field": "per_trade_usd"},
            {"type": "per_share", "description": "Per-share fee (e.g. $0.005 per share)", "value_field": "per_share_usd"},
            {"type": "percentage","description": "% of trade value (e.g. 0.001 = 0.1%)",  "value_field": "fraction"},
            {"type": "tiered",    "description": "Tiered volume-discount rate schedule",    "value_field": "tiers: [[volume, rate], ...]"},
        ]
    }
