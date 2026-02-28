"""
Performance Loop — Wave 13
Performance ledger, champion/challenger evaluation, auto-disable.
Rolling win rate, expectancy, drawdown, Sharpe proxy.
"""

import math
import logging
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class StrategyRole(str, Enum):
    CHAMPION = "champion"     # Currently trading
    CHALLENGER = "challenger" # Shadow evaluation only
    DISABLED = "disabled"     # Auto-disabled


@dataclass
class TradeRecord:
    trade_id: str
    strategy_id: str
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    qty: float
    pnl: float
    entry_time: str
    exit_time: str
    is_winner: bool

    def to_dict(self) -> dict:
        return {
            "trade_id": self.trade_id,
            "strategy_id": self.strategy_id,
            "symbol": self.symbol,
            "side": self.side,
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "qty": self.qty,
            "pnl": self.pnl,
            "entry_time": self.entry_time,
            "exit_time": self.exit_time,
            "is_winner": self.is_winner,
        }


@dataclass
class PerformanceMetrics:
    strategy_id: str
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    expectancy: float = 0.0
    total_pnl: float = 0.0
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_proxy: float = 0.0
    profit_factor: float = 0.0
    peak_equity: float = 0.0
    current_equity: float = 0.0
    last_updated: str = ""

    def to_dict(self) -> dict:
        return {
            "strategy_id": self.strategy_id,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate": round(self.win_rate, 4),
            "avg_win": round(self.avg_win, 2),
            "avg_loss": round(self.avg_loss, 2),
            "expectancy": round(self.expectancy, 2),
            "total_pnl": round(self.total_pnl, 2),
            "max_drawdown": round(self.max_drawdown, 2),
            "max_drawdown_pct": round(self.max_drawdown_pct, 2),
            "sharpe_proxy": round(self.sharpe_proxy, 4),
            "profit_factor": round(self.profit_factor, 4),
            "peak_equity": round(self.peak_equity, 2),
            "current_equity": round(self.current_equity, 2),
            "last_updated": self.last_updated,
        }


@dataclass
class AutoDisableRule:
    min_trades: int = 10          # Minimum trades before auto-disable can trigger
    min_win_rate: float = 0.30    # Disable if win rate drops below
    max_drawdown_pct: float = 10.0  # Disable if drawdown exceeds
    min_expectancy: float = -50.0   # Disable if expectancy drops below
    min_sharpe: float = -0.5        # Disable if Sharpe drops below
    lookback_trades: int = 20       # Rolling window for evaluation

    def to_dict(self) -> dict:
        return {
            "min_trades": self.min_trades,
            "min_win_rate": self.min_win_rate,
            "max_drawdown_pct": self.max_drawdown_pct,
            "min_expectancy": self.min_expectancy,
            "min_sharpe": self.min_sharpe,
            "lookback_trades": self.lookback_trades,
        }


@dataclass
class DisableEvent:
    strategy_id: str
    reason: str
    metrics_at_disable: dict
    timestamp: str

    def to_dict(self) -> dict:
        return {
            "strategy_id": self.strategy_id,
            "reason": self.reason,
            "metrics_at_disable": self.metrics_at_disable,
            "timestamp": self.timestamp,
        }


class PerformanceLedger:
    """
    Performance tracking with champion/challenger evaluation and auto-disable.
    """

    def __init__(self):
        self._trades: dict[str, list[TradeRecord]] = {}  # strategy_id -> trades
        self._roles: dict[str, StrategyRole] = {}  # strategy_id -> role
        self._auto_disable_rule = AutoDisableRule()
        self._disable_events: list[DisableEvent] = []

    def record_trade(self, trade: TradeRecord) -> None:
        """Record a completed trade."""
        if trade.strategy_id not in self._trades:
            self._trades[trade.strategy_id] = []
        self._trades[trade.strategy_id].append(trade)

    def set_role(self, strategy_id: str, role: StrategyRole) -> None:
        """Set strategy role (champion/challenger/disabled)."""
        self._roles[strategy_id] = role

    def get_role(self, strategy_id: str) -> StrategyRole:
        return self._roles.get(strategy_id, StrategyRole.CHALLENGER)

    def compute_metrics(self, strategy_id: str, lookback: Optional[int] = None) -> PerformanceMetrics:
        """Compute performance metrics for a strategy."""
        trades = self._trades.get(strategy_id, [])
        if lookback:
            trades = trades[-lookback:]

        metrics = PerformanceMetrics(strategy_id=strategy_id)
        if not trades:
            return metrics

        metrics.total_trades = len(trades)
        winners = [t for t in trades if t.is_winner]
        losers = [t for t in trades if not t.is_winner]
        metrics.winning_trades = len(winners)
        metrics.losing_trades = len(losers)

        metrics.win_rate = metrics.winning_trades / metrics.total_trades if metrics.total_trades > 0 else 0

        win_pnls = [t.pnl for t in winners]
        loss_pnls = [t.pnl for t in losers]
        metrics.avg_win = sum(win_pnls) / len(win_pnls) if win_pnls else 0
        metrics.avg_loss = sum(loss_pnls) / len(loss_pnls) if loss_pnls else 0

        # Expectancy = (win_rate * avg_win) + ((1 - win_rate) * avg_loss)
        metrics.expectancy = (metrics.win_rate * metrics.avg_win) + ((1 - metrics.win_rate) * metrics.avg_loss)

        # Total PnL and equity curve
        pnls = [t.pnl for t in trades]
        metrics.total_pnl = sum(pnls)

        # Drawdown computation
        equity = 100000.0
        peak = equity
        max_dd = 0.0
        for pnl in pnls:
            equity += pnl
            if equity > peak:
                peak = equity
            dd = peak - equity
            if dd > max_dd:
                max_dd = dd

        metrics.peak_equity = peak
        metrics.current_equity = equity
        metrics.max_drawdown = max_dd
        metrics.max_drawdown_pct = (max_dd / peak * 100) if peak > 0 else 0

        # Sharpe proxy (from trade PnLs)
        if len(pnls) >= 2:
            mean_pnl = sum(pnls) / len(pnls)
            variance = sum((p - mean_pnl) ** 2 for p in pnls) / (len(pnls) - 1)
            std_pnl = math.sqrt(variance) if variance > 0 else 0.001
            metrics.sharpe_proxy = (mean_pnl / std_pnl) * math.sqrt(252) if std_pnl > 0 else 0

        # Profit factor
        gross_profit = sum(p for p in pnls if p > 0)
        gross_loss = abs(sum(p for p in pnls if p < 0))
        metrics.profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')

        metrics.last_updated = datetime.now(timezone.utc).isoformat()
        return metrics

    def check_auto_disable(self, strategy_id: str) -> Optional[DisableEvent]:
        """Check if a strategy should be auto-disabled based on rules."""
        rule = self._auto_disable_rule
        metrics = self.compute_metrics(strategy_id, lookback=rule.lookback_trades)

        if metrics.total_trades < rule.min_trades:
            return None  # Not enough trades yet

        reasons = []
        if metrics.win_rate < rule.min_win_rate:
            reasons.append(f"Win rate {metrics.win_rate:.2%} < min {rule.min_win_rate:.2%}")
        if metrics.max_drawdown_pct > rule.max_drawdown_pct:
            reasons.append(f"Drawdown {metrics.max_drawdown_pct:.1f}% > max {rule.max_drawdown_pct}%")
        if metrics.expectancy < rule.min_expectancy:
            reasons.append(f"Expectancy ${metrics.expectancy:.2f} < min ${rule.min_expectancy:.2f}")
        if metrics.sharpe_proxy < rule.min_sharpe:
            reasons.append(f"Sharpe {metrics.sharpe_proxy:.2f} < min {rule.min_sharpe}")

        if reasons:
            event = DisableEvent(
                strategy_id=strategy_id,
                reason="; ".join(reasons),
                metrics_at_disable=metrics.to_dict(),
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            self._disable_events.append(event)
            self._roles[strategy_id] = StrategyRole.DISABLED
            logger.warning(f"AUTO-DISABLE {strategy_id}: {event.reason}")
            return event

        return None

    def get_champion(self) -> Optional[str]:
        """Get the current champion strategy."""
        for sid, role in self._roles.items():
            if role == StrategyRole.CHAMPION:
                return sid
        return None

    def get_challengers(self) -> list[str]:
        """Get all challenger strategies."""
        return [sid for sid, role in self._roles.items() if role == StrategyRole.CHALLENGER]

    def get_disable_events(self) -> list[DisableEvent]:
        return self._disable_events.copy()

    def get_all_metrics(self) -> dict[str, PerformanceMetrics]:
        """Get metrics for all tracked strategies."""
        return {sid: self.compute_metrics(sid) for sid in self._trades}


_ledger: Optional[PerformanceLedger] = None


def get_performance_ledger() -> PerformanceLedger:
    global _ledger
    if _ledger is None:
        _ledger = PerformanceLedger()
    return _ledger
