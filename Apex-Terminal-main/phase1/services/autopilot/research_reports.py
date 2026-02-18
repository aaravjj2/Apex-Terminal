"""
Research Reporting Suite

Generates portfolio-level, template attribution, regime attribution,
parameter sweep, and fragility analysis reports.

Based on Research Plan v1 requirements.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
import json
import logging
from pathlib import Path

from .v1_templates import Regime
from .execution_simulator import FillStatus, ExecutionMetrics

logger = logging.getLogger(__name__)


@dataclass
class TradeRecord:
    """Record of a completed trade for analysis."""
    trade_id: str
    template: str
    symbol: str
    regime: str
    entry_time: datetime
    exit_time: Optional[datetime]
    entry_price: float
    exit_price: Optional[float]
    pnl: float = 0.0
    max_profit: float = 0.0
    max_loss: float = 0.0
    dte_entry: int = 0
    delta_target: float = 0.0
    width: float = 0.0
    fill_status: str = ""
    slippage: float = 0.0
    exit_reason: str = ""
    
    @property
    def is_winner(self) -> bool:
        return self.pnl > 0
    
    @property
    def holding_days(self) -> int:
        if self.exit_time:
            return (self.exit_time - self.entry_time).days
        return 0


@dataclass
class PortfolioMetrics:
    """Portfolio-level metrics for a backtest period."""
    period_start: datetime
    period_end: datetime
    total_return: float = 0.0
    total_return_pct: float = 0.0
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    sharpe_ratio: float = 0.0
    trades_per_day: float = 0.0
    avg_holding_days: float = 0.0
    avg_delta_exposure: float = 0.0
    max_delta_exposure: float = 0.0


@dataclass
class TemplateAttribution:
    """Attribution metrics for a single template."""
    template: str
    trade_count: int = 0
    win_rate: float = 0.0
    total_pnl: float = 0.0
    avg_pnl: float = 0.0
    max_drawdown_contribution: float = 0.0
    fill_rate: float = 0.0
    avg_slippage: float = 0.0
    best_trades: List[Dict] = field(default_factory=list)
    worst_trades: List[Dict] = field(default_factory=list)


@dataclass
class RegimeAttribution:
    """Attribution metrics for a market regime."""
    regime: str
    trade_count: int = 0
    win_rate: float = 0.0
    total_pnl: float = 0.0
    avg_pnl: float = 0.0
    template_breakdown: Dict[str, float] = field(default_factory=dict)
    skip_reasons: Dict[str, int] = field(default_factory=dict)
    fill_rate: float = 0.0
    avg_slippage: float = 0.0


@dataclass
class ParameterSweepCell:
    """Single cell in a parameter sweep heatmap."""
    dte_bucket: str
    delta_bucket: str
    trade_count: int = 0
    win_rate: float = 0.0
    avg_pnl: float = 0.0
    stability_score: float = 0.0  # Performance under stress


@dataclass
class FragilityResult:
    """Result of fragility analysis under stress."""
    scenario: str
    slippage_multiplier: float = 1.0
    fill_strictness: str = "normal"
    total_return: float = 0.0
    return_delta_pct: float = 0.0
    max_drawdown: float = 0.0
    drawdown_delta_pct: float = 0.0
    fragile_templates: List[str] = field(default_factory=list)


@dataclass
class FailureTaxonomy:
    """Taxonomy of failure modes."""
    validator_rejections: Dict[str, int] = field(default_factory=dict)
    unfilled_orders: int = 0
    partial_fill_incidents: int = 0
    data_provider_failures: int = 0
    total_failures: int = 0


class ResearchReportGenerator:
    """
    Generates comprehensive research reports from trade history.
    """
    
    def __init__(self, trades: List[TradeRecord], starting_equity: float = 1000.0):
        self.trades = trades
        self.starting_equity = starting_equity
    
    def generate_portfolio_report(self) -> PortfolioMetrics:
        """Generate portfolio-level metrics."""
        if not self.trades:
            return PortfolioMetrics(
                period_start=datetime.now(),
                period_end=datetime.now()
            )
        
        # Sort by entry time
        sorted_trades = sorted(self.trades, key=lambda t: t.entry_time)
        
        period_start = sorted_trades[0].entry_time
        period_end = sorted_trades[-1].exit_time or datetime.now()
        days = max(1, (period_end - period_start).days)
        
        # Calculate metrics
        total_pnl = sum(t.pnl for t in self.trades)
        winners = [t for t in self.trades if t.is_winner]
        losers = [t for t in self.trades if not t.is_winner]
        
        win_rate = len(winners) / len(self.trades) if self.trades else 0
        avg_win = sum(t.pnl for t in winners) / len(winners) if winners else 0
        avg_loss = sum(t.pnl for t in losers) / len(losers) if losers else 0
        
        # Profit factor
        gross_profit = sum(t.pnl for t in winners)
        gross_loss = abs(sum(t.pnl for t in losers))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        
        # Expectancy
        expectancy = win_rate * avg_win + (1 - win_rate) * avg_loss
        
        # Drawdown (simplified)
        equity_curve = [self.starting_equity]
        for trade in sorted_trades:
            equity_curve.append(equity_curve[-1] + trade.pnl)
        
        peak = self.starting_equity
        max_dd = 0
        for equity in equity_curve:
            if equity > peak:
                peak = equity
            dd = peak - equity
            if dd > max_dd:
                max_dd = dd
        
        # Average holding
        holding_days = [t.holding_days for t in self.trades if t.holding_days > 0]
        avg_holding = sum(holding_days) / len(holding_days) if holding_days else 0
        
        return PortfolioMetrics(
            period_start=period_start,
            period_end=period_end,
            total_return=total_pnl,
            total_return_pct=total_pnl / self.starting_equity * 100,
            max_drawdown=max_dd,
            max_drawdown_pct=max_dd / self.starting_equity * 100,
            win_rate=win_rate,
            total_trades=len(self.trades),
            winning_trades=len(winners),
            losing_trades=len(losers),
            avg_win=avg_win,
            avg_loss=avg_loss,
            profit_factor=profit_factor,
            expectancy=expectancy,
            trades_per_day=len(self.trades) / days,
            avg_holding_days=avg_holding,
        )
    
    def generate_template_attribution(self) -> Dict[str, TemplateAttribution]:
        """Generate attribution by template."""
        templates: Dict[str, List[TradeRecord]] = {}
        
        for trade in self.trades:
            if trade.template not in templates:
                templates[trade.template] = []
            templates[trade.template].append(trade)
        
        results = {}
        for template, trades in templates.items():
            winners = [t for t in trades if t.is_winner]
            
            results[template] = TemplateAttribution(
                template=template,
                trade_count=len(trades),
                win_rate=len(winners) / len(trades) if trades else 0,
                total_pnl=sum(t.pnl for t in trades),
                avg_pnl=sum(t.pnl for t in trades) / len(trades) if trades else 0,
                avg_slippage=sum(t.slippage for t in trades) / len(trades) if trades else 0,
                best_trades=[
                    {"id": t.trade_id, "pnl": t.pnl}
                    for t in sorted(trades, key=lambda x: x.pnl, reverse=True)[:5]
                ],
                worst_trades=[
                    {"id": t.trade_id, "pnl": t.pnl}
                    for t in sorted(trades, key=lambda x: x.pnl)[:5]
                ],
            )
        
        return results
    
    def generate_regime_attribution(self) -> Dict[str, RegimeAttribution]:
        """Generate attribution by regime."""
        regimes: Dict[str, List[TradeRecord]] = {}
        
        for trade in self.trades:
            if trade.regime not in regimes:
                regimes[trade.regime] = []
            regimes[trade.regime].append(trade)
        
        results = {}
        for regime, trades in regimes.items():
            winners = [t for t in trades if t.is_winner]
            
            # Template breakdown
            template_pnl: Dict[str, float] = {}
            for trade in trades:
                if trade.template not in template_pnl:
                    template_pnl[trade.template] = 0
                template_pnl[trade.template] += trade.pnl
            
            results[regime] = RegimeAttribution(
                regime=regime,
                trade_count=len(trades),
                win_rate=len(winners) / len(trades) if trades else 0,
                total_pnl=sum(t.pnl for t in trades),
                avg_pnl=sum(t.pnl for t in trades) / len(trades) if trades else 0,
                template_breakdown=template_pnl,
                avg_slippage=sum(t.slippage for t in trades) / len(trades) if trades else 0,
            )
        
        return results
    
    def generate_parameter_sweep(self) -> List[ParameterSweepCell]:
        """Generate DTE × Delta heatmap."""
        # Define buckets
        dte_buckets = ["14-21", "22-30", "31-45", "46-60"]
        delta_buckets = ["0.10-0.15", "0.16-0.20", "0.21-0.25", "0.26-0.30"]
        
        def get_dte_bucket(dte: int) -> str:
            if dte <= 21:
                return "14-21"
            elif dte <= 30:
                return "22-30"
            elif dte <= 45:
                return "31-45"
            else:
                return "46-60"
        
        def get_delta_bucket(delta: float) -> str:
            if delta <= 0.15:
                return "0.10-0.15"
            elif delta <= 0.20:
                return "0.16-0.20"
            elif delta <= 0.25:
                return "0.21-0.25"
            else:
                return "0.26-0.30"
        
        # Group trades
        cells: Dict[str, List[TradeRecord]] = {}
        for trade in self.trades:
            dte_b = get_dte_bucket(trade.dte_entry)
            delta_b = get_delta_bucket(trade.delta_target)
            key = f"{dte_b}:{delta_b}"
            
            if key not in cells:
                cells[key] = []
            cells[key].append(trade)
        
        # Calculate metrics per cell
        results = []
        for dte_b in dte_buckets:
            for delta_b in delta_buckets:
                key = f"{dte_b}:{delta_b}"
                trades = cells.get(key, [])
                
                if not trades:
                    results.append(ParameterSweepCell(
                        dte_bucket=dte_b,
                        delta_bucket=delta_b,
                    ))
                    continue
                
                winners = [t for t in trades if t.is_winner]
                results.append(ParameterSweepCell(
                    dte_bucket=dte_b,
                    delta_bucket=delta_b,
                    trade_count=len(trades),
                    win_rate=len(winners) / len(trades),
                    avg_pnl=sum(t.pnl for t in trades) / len(trades),
                ))
        
        return results
    
    def to_json(self) -> Dict[str, Any]:
        """Export full report as JSON."""
        return {
            "portfolio": self.generate_portfolio_report().__dict__,
            "template_attribution": {
                k: v.__dict__ for k, v in self.generate_template_attribution().items()
            },
            "regime_attribution": {
                k: v.__dict__ for k, v in self.generate_regime_attribution().items()
            },
            "parameter_sweep": [c.__dict__ for c in self.generate_parameter_sweep()],
        }
    
    def save_report(self, path: str):
        """Save report to JSON file."""
        report = self.to_json()
        
        # Convert datetime objects
        def serialize(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return obj
        
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w') as f:
            json.dump(report, f, indent=2, default=serialize)
        
        logger.info(f"Research report saved to {path}")
