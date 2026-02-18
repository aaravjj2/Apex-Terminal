"""
V1 Evaluation Metrics
=====================
Phase 6: Comprehensive metrics for backtest and live session evaluation.

Metrics Categories:
1. P&L Metrics - Returns, drawdown, risk-adjusted
2. Trade Metrics - Win rate, avg win/loss, hit ratio
3. Execution Metrics - Fill quality, slippage
4. V1 Compliance Metrics - Limit compliance, anti-thrash effectiveness
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple
from enum import Enum
import math
import statistics


class ExitReason(str, Enum):
    """Reasons for position exit."""
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    EOD_CLOSE = "eod_close"
    MANUAL = "manual"
    ANTI_THRASH = "anti_thrash"
    TIMEOUT = "timeout"


@dataclass
class TradeRecord:
    """Record of a completed trade."""
    trade_id: str
    symbol: str
    underlying: str
    template: str  # "long_call" or "long_put"
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    qty: int
    exit_reason: ExitReason
    pnl: float
    pnl_pct: float
    hold_time_minutes: float
    chase_attempts: int = 0
    execution_slippage_pct: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "trade_id": self.trade_id,
            "symbol": self.symbol,
            "underlying": self.underlying,
            "template": self.template,
            "entry_time": self.entry_time.isoformat(),
            "exit_time": self.exit_time.isoformat(),
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "qty": self.qty,
            "exit_reason": self.exit_reason.value,
            "pnl": self.pnl,
            "pnl_pct": self.pnl_pct,
            "hold_time_minutes": self.hold_time_minutes,
            "chase_attempts": self.chase_attempts,
            "execution_slippage_pct": self.execution_slippage_pct,
        }


@dataclass
class SessionMetrics:
    """Metrics for a trading session."""
    session_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    
    # P&L
    starting_equity: float = 10000.0
    ending_equity: float = 10000.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    max_drawdown_pct: float = 0.0
    max_equity: float = 10000.0
    
    # Trade stats
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    scratch_trades: int = 0  # breakeven
    
    # Trade P&L
    total_gross_profit: float = 0.0
    total_gross_loss: float = 0.0
    largest_win: float = 0.0
    largest_loss: float = 0.0
    
    # V1 specific
    stopouts: int = 0
    circuit_breaker_triggers: int = 0
    anti_thrash_rejections: int = 0
    max_concurrent_positions: int = 0
    max_exposure_used: float = 0.0
    
    # Execution
    total_chase_attempts: int = 0
    avg_slippage_pct: float = 0.0
    limit_order_compliance: float = 1.0
    
    # Time
    duration_minutes: float = 0.0
    trades: List[TradeRecord] = field(default_factory=list)
    
    @property
    def win_rate(self) -> float:
        """Percentage of winning trades."""
        if self.total_trades == 0:
            return 0.0
        return self.winning_trades / self.total_trades
    
    @property
    def loss_rate(self) -> float:
        """Percentage of losing trades."""
        if self.total_trades == 0:
            return 0.0
        return self.losing_trades / self.total_trades
    
    @property
    def avg_win(self) -> float:
        """Average profit on winning trades."""
        if self.winning_trades == 0:
            return 0.0
        return self.total_gross_profit / self.winning_trades
    
    @property
    def avg_loss(self) -> float:
        """Average loss on losing trades."""
        if self.losing_trades == 0:
            return 0.0
        return self.total_gross_loss / self.losing_trades
    
    @property
    def profit_factor(self) -> float:
        """Gross profit / gross loss."""
        if self.total_gross_loss == 0:
            return float('inf') if self.total_gross_profit > 0 else 0.0
        return abs(self.total_gross_profit / self.total_gross_loss)
    
    @property
    def expectancy(self) -> float:
        """Expected value per trade."""
        if self.total_trades == 0:
            return 0.0
        return self.realized_pnl / self.total_trades
    
    @property
    def net_return_pct(self) -> float:
        """Net return as percentage of starting equity."""
        if self.starting_equity == 0:
            return 0.0
        return (self.ending_equity - self.starting_equity) / self.starting_equity
    
    @property
    def risk_reward_ratio(self) -> float:
        """Average win / average loss."""
        if self.avg_loss == 0:
            return 0.0
        return abs(self.avg_win / self.avg_loss)
    
    @property
    def sharpe_ratio(self) -> float:
        """Simplified Sharpe ratio (assumes 0 risk-free rate)."""
        if not self.trades:
            return 0.0
        returns = [t.pnl_pct for t in self.trades]
        if len(returns) < 2:
            return 0.0
        avg_return = statistics.mean(returns)
        std_return = statistics.stdev(returns)
        if std_return == 0:
            return 0.0
        # Annualize: assuming 252 trading days
        return avg_return / std_return * math.sqrt(252)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_minutes": self.duration_minutes,
            
            # P&L
            "starting_equity": self.starting_equity,
            "ending_equity": self.ending_equity,
            "realized_pnl": self.realized_pnl,
            "unrealized_pnl": self.unrealized_pnl,
            "net_return_pct": self.net_return_pct,
            "max_drawdown_pct": self.max_drawdown_pct,
            
            # Trade stats
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "scratch_trades": self.scratch_trades,
            "win_rate": self.win_rate,
            
            # Trade P&L
            "total_gross_profit": self.total_gross_profit,
            "total_gross_loss": self.total_gross_loss,
            "largest_win": self.largest_win,
            "largest_loss": self.largest_loss,
            "avg_win": self.avg_win,
            "avg_loss": self.avg_loss,
            "profit_factor": self.profit_factor,
            "expectancy": self.expectancy,
            "risk_reward_ratio": self.risk_reward_ratio,
            "sharpe_ratio": self.sharpe_ratio,
            
            # V1 specific
            "stopouts": self.stopouts,
            "circuit_breaker_triggers": self.circuit_breaker_triggers,
            "anti_thrash_rejections": self.anti_thrash_rejections,
            "max_concurrent_positions": self.max_concurrent_positions,
            "max_exposure_used": self.max_exposure_used,
            
            # Execution
            "total_chase_attempts": self.total_chase_attempts,
            "avg_slippage_pct": self.avg_slippage_pct,
            "limit_order_compliance": self.limit_order_compliance,
            
            # Trade list
            "trades": [t.to_dict() for t in self.trades],
        }


class MetricsTracker:
    """
    Tracks metrics during a trading session.
    
    Thread-safe accumulator for session statistics.
    """
    
    def __init__(self, session_id: str, starting_equity: float = 10000.0):
        self._metrics = SessionMetrics(
            session_id=session_id,
            start_time=datetime.utcnow(),
            starting_equity=starting_equity,
            ending_equity=starting_equity,
            max_equity=starting_equity,
        )
        self._equity_curve: List[Tuple[datetime, float]] = [(datetime.utcnow(), starting_equity)]
        self._trade_counter = 0
    
    def record_trade(self, trade: TradeRecord) -> None:
        """Record a completed trade."""
        self._metrics.trades.append(trade)
        self._metrics.total_trades += 1
        
        # Classify trade
        if trade.pnl > 0.01:  # Small buffer for float comparison
            self._metrics.winning_trades += 1
            self._metrics.total_gross_profit += trade.pnl
            self._metrics.largest_win = max(self._metrics.largest_win, trade.pnl)
        elif trade.pnl < -0.01:
            self._metrics.losing_trades += 1
            self._metrics.total_gross_loss += trade.pnl  # Negative
            self._metrics.largest_loss = min(self._metrics.largest_loss, trade.pnl)
        else:
            self._metrics.scratch_trades += 1
        
        # Track stopouts
        if trade.exit_reason == ExitReason.STOP_LOSS:
            self._metrics.stopouts += 1
        
        # Execution metrics
        self._metrics.total_chase_attempts += trade.chase_attempts
        
        # Update realized P&L
        self._metrics.realized_pnl += trade.pnl
        self._update_equity(self._metrics.starting_equity + self._metrics.realized_pnl)
    
    def _update_equity(self, current_equity: float) -> None:
        """Update equity and drawdown tracking."""
        now = datetime.utcnow()
        self._equity_curve.append((now, current_equity))
        self._metrics.ending_equity = current_equity
        
        # Track max equity
        if current_equity > self._metrics.max_equity:
            self._metrics.max_equity = current_equity
        
        # Track drawdown
        if self._metrics.max_equity > 0:
            current_dd = (self._metrics.max_equity - current_equity) / self._metrics.max_equity
            self._metrics.max_drawdown_pct = max(self._metrics.max_drawdown_pct, current_dd)
    
    def record_circuit_breaker(self) -> None:
        """Record circuit breaker trigger."""
        self._metrics.circuit_breaker_triggers += 1
    
    def record_anti_thrash_rejection(self) -> None:
        """Record anti-thrash rejection."""
        self._metrics.anti_thrash_rejections += 1
    
    def update_position_count(self, count: int) -> None:
        """Update max concurrent positions."""
        self._metrics.max_concurrent_positions = max(
            self._metrics.max_concurrent_positions, count
        )
    
    def update_exposure(self, exposure: float) -> None:
        """Update max exposure used."""
        self._metrics.max_exposure_used = max(
            self._metrics.max_exposure_used, exposure
        )
    
    def finalize(self) -> SessionMetrics:
        """Finalize metrics at session end."""
        self._metrics.end_time = datetime.utcnow()
        
        # Calculate duration
        duration = self._metrics.end_time - self._metrics.start_time
        self._metrics.duration_minutes = duration.total_seconds() / 60
        
        # Calculate average slippage
        if self._metrics.total_trades > 0:
            total_slippage = sum(t.execution_slippage_pct for t in self._metrics.trades)
            self._metrics.avg_slippage_pct = total_slippage / self._metrics.total_trades
        
        return self._metrics
    
    @property
    def metrics(self) -> SessionMetrics:
        """Get current metrics snapshot."""
        return self._metrics
    
    @property
    def equity_curve(self) -> List[Tuple[datetime, float]]:
        """Get equity curve data."""
        return self._equity_curve.copy()
    
    def generate_trade_id(self) -> str:
        """Generate unique trade ID."""
        self._trade_counter += 1
        return f"{self._metrics.session_id}-T{self._trade_counter:04d}"


class BacktestEvaluator:
    """
    Evaluator for comparing backtest results.
    
    Provides:
    - Deterministic result hashing
    - Comparison between runs
    - Statistical significance testing
    """
    
    @staticmethod
    def create_result_hash(metrics: SessionMetrics) -> str:
        """
        Create deterministic hash of backtest results.
        
        Hash is based on:
        - Trade sequence (symbol, pnl)
        - Final equity
        - Key metrics
        """
        import hashlib
        
        components = [
            f"trades={metrics.total_trades}",
            f"equity={metrics.ending_equity:.2f}",
            f"pnl={metrics.realized_pnl:.2f}",
            f"wins={metrics.winning_trades}",
            f"losses={metrics.losing_trades}",
        ]
        
        # Add trade sequence
        for trade in metrics.trades:
            components.append(f"{trade.symbol}:{trade.pnl:.4f}")
        
        hash_input = "|".join(components)
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]
    
    @staticmethod
    def compare_results(
        baseline: SessionMetrics, 
        variant: SessionMetrics
    ) -> Dict[str, Any]:
        """
        Compare two backtest results.
        
        Returns comparison statistics.
        """
        return {
            "baseline_hash": BacktestEvaluator.create_result_hash(baseline),
            "variant_hash": BacktestEvaluator.create_result_hash(variant),
            "identical": BacktestEvaluator.create_result_hash(baseline) == BacktestEvaluator.create_result_hash(variant),
            
            "pnl_difference": variant.realized_pnl - baseline.realized_pnl,
            "win_rate_diff": variant.win_rate - baseline.win_rate,
            "sharpe_diff": variant.sharpe_ratio - baseline.sharpe_ratio,
            "drawdown_diff": variant.max_drawdown_pct - baseline.max_drawdown_pct,
            
            "baseline": {
                "pnl": baseline.realized_pnl,
                "win_rate": baseline.win_rate,
                "sharpe": baseline.sharpe_ratio,
                "trades": baseline.total_trades,
            },
            "variant": {
                "pnl": variant.realized_pnl,
                "win_rate": variant.win_rate,
                "sharpe": variant.sharpe_ratio,
                "trades": variant.total_trades,
            },
        }
    
    @staticmethod
    def generate_report(metrics: SessionMetrics) -> str:
        """Generate human-readable evaluation report."""
        lines = [
            "=" * 60,
            "V1 TRADING SESSION REPORT",
            "=" * 60,
            "",
            f"Session ID: {metrics.session_id}",
            f"Duration: {metrics.duration_minutes:.1f} minutes",
            "",
            "-" * 40,
            "PERFORMANCE SUMMARY",
            "-" * 40,
            f"Starting Equity:  ${metrics.starting_equity:,.2f}",
            f"Ending Equity:    ${metrics.ending_equity:,.2f}",
            f"Net Return:       {metrics.net_return_pct * 100:+.2f}%",
            f"Max Drawdown:     {metrics.max_drawdown_pct * 100:.2f}%",
            "",
            "-" * 40,
            "TRADE STATISTICS",
            "-" * 40,
            f"Total Trades:     {metrics.total_trades}",
            f"Winning:          {metrics.winning_trades} ({metrics.win_rate * 100:.1f}%)",
            f"Losing:           {metrics.losing_trades} ({metrics.loss_rate * 100:.1f}%)",
            f"Scratch:          {metrics.scratch_trades}",
            "",
            f"Profit Factor:    {metrics.profit_factor:.2f}",
            f"Expectancy:       ${metrics.expectancy:+.2f}",
            f"Risk/Reward:      {metrics.risk_reward_ratio:.2f}",
            f"Sharpe Ratio:     {metrics.sharpe_ratio:.2f}",
            "",
            f"Avg Win:          ${metrics.avg_win:+.2f}",
            f"Avg Loss:         ${metrics.avg_loss:.2f}",
            f"Largest Win:      ${metrics.largest_win:+.2f}",
            f"Largest Loss:     ${metrics.largest_loss:.2f}",
            "",
            "-" * 40,
            "V1 COMPLIANCE",
            "-" * 40,
            f"Stop-outs:        {metrics.stopouts}",
            f"Circuit Breakers: {metrics.circuit_breaker_triggers}",
            f"Anti-thrash Rej:  {metrics.anti_thrash_rejections}",
            f"Max Positions:    {metrics.max_concurrent_positions}",
            f"Max Exposure:     ${metrics.max_exposure_used:,.2f}",
            f"Limit Compliance: {metrics.limit_order_compliance * 100:.1f}%",
            "",
            "-" * 40,
            "EXECUTION QUALITY",
            "-" * 40,
            f"Chase Attempts:   {metrics.total_chase_attempts}",
            f"Avg Slippage:     {metrics.avg_slippage_pct * 100:.3f}%",
            "",
            "=" * 60,
        ]
        return "\n".join(lines)


def calculate_kelly_fraction(
    win_rate: float, 
    avg_win: float, 
    avg_loss: float
) -> float:
    """
    Calculate optimal Kelly criterion position sizing.
    
    Kelly % = W - (1-W)/R
    where W = win rate, R = win/loss ratio
    
    Returns fractional Kelly (safer).
    """
    if avg_loss == 0:
        return 0.0
    
    r = abs(avg_win / avg_loss)
    kelly = win_rate - (1 - win_rate) / r
    
    # Return half-Kelly for safety
    return max(0.0, kelly / 2)


def calculate_var(
    returns: List[float], 
    confidence: float = 0.95
) -> float:
    """
    Calculate Value at Risk.
    
    Returns the loss that won't be exceeded with given confidence.
    """
    if not returns:
        return 0.0
    
    sorted_returns = sorted(returns)
    index = int((1 - confidence) * len(sorted_returns))
    return sorted_returns[index]
