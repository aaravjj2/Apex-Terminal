"""
Reporting Module
Generates daily reports and attribution analysis.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timedelta
from enum import Enum
import logging

from .config import AutopilotConfig
from .position_manager import PositionManager, OptionsPosition, PositionStatus
from .selector import SelectionResult
from .monitor import MonitoringResult

logger = logging.getLogger(__name__)


@dataclass
class TemplateAttribution:
    """P&L attribution by strategy template"""
    template: str
    trade_count: int
    win_count: int
    loss_count: int
    gross_pnl: float
    commission: float
    net_pnl: float
    avg_pnl_per_trade: float
    win_rate: float
    avg_win: float
    avg_loss: float
    profit_factor: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "template": self.template,
            "trade_count": self.trade_count,
            "win_count": self.win_count,
            "loss_count": self.loss_count,
            "gross_pnl": self.gross_pnl,
            "commission": self.commission,
            "net_pnl": self.net_pnl,
            "avg_pnl_per_trade": self.avg_pnl_per_trade,
            "win_rate": self.win_rate,
            "avg_win": self.avg_win,
            "avg_loss": self.avg_loss,
            "profit_factor": self.profit_factor,
        }


@dataclass
class SymbolAttribution:
    """P&L attribution by underlying symbol"""
    symbol: str
    trade_count: int
    net_pnl: float
    exposure_days: int
    avg_delta: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "trade_count": self.trade_count,
            "net_pnl": self.net_pnl,
            "exposure_days": self.exposure_days,
            "avg_delta": self.avg_delta,
        }


@dataclass
class DailyReport:
    """Daily summary report"""
    report_date: date
    generated_at: datetime
    
    # P&L Summary
    starting_equity: float
    ending_equity: float
    daily_pnl: float
    daily_return_pct: float
    
    # Trading Activity
    trades_opened: int
    trades_closed: int
    candidates_generated: int
    candidates_selected: int
    
    # Position Summary
    open_positions: int
    total_risk_outstanding: float
    
    # Attribution
    template_attribution: List[TemplateAttribution]
    symbol_attribution: List[SymbolAttribution]
    
    # Risk Metrics
    max_drawdown: float
    sharpe_estimate: float
    
    # Notes
    no_trade_reasons: List[str]
    alerts: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_date": self.report_date.isoformat(),
            "generated_at": self.generated_at.isoformat(),
            "pnl_summary": {
                "starting_equity": self.starting_equity,
                "ending_equity": self.ending_equity,
                "daily_pnl": self.daily_pnl,
                "daily_return_pct": self.daily_return_pct,
            },
            "trading_activity": {
                "trades_opened": self.trades_opened,
                "trades_closed": self.trades_closed,
                "candidates_generated": self.candidates_generated,
                "candidates_selected": self.candidates_selected,
            },
            "position_summary": {
                "open_positions": self.open_positions,
                "total_risk_outstanding": self.total_risk_outstanding,
            },
            "attribution": {
                "by_template": [t.to_dict() for t in self.template_attribution],
                "by_symbol": [s.to_dict() for s in self.symbol_attribution],
            },
            "risk_metrics": {
                "max_drawdown": self.max_drawdown,
                "sharpe_estimate": self.sharpe_estimate,
            },
            "notes": {
                "no_trade_reasons": self.no_trade_reasons,
                "alerts": self.alerts,
            },
        }
    
    def to_markdown(self) -> str:
        """Generate markdown report."""
        lines = [
            f"# Autopilot Daily Report - {self.report_date}",
            "",
            "## 📊 P&L Summary",
            f"- Starting Equity: ${self.starting_equity:,.2f}",
            f"- Ending Equity: ${self.ending_equity:,.2f}",
            f"- **Daily P&L: ${self.daily_pnl:+,.2f} ({self.daily_return_pct:+.2f}%)**",
            "",
            "## 📈 Trading Activity",
            f"- Trades Opened: {self.trades_opened}",
            f"- Trades Closed: {self.trades_closed}",
            f"- Candidates: {self.candidates_selected}/{self.candidates_generated} selected",
            "",
            "## 📋 Current Positions",
            f"- Open Positions: {self.open_positions}",
            f"- Total Risk: ${self.total_risk_outstanding:,.2f}",
            "",
        ]
        
        if self.template_attribution:
            lines.extend([
                "## 🎯 Attribution by Strategy",
                "| Template | Trades | Win Rate | Net P&L |",
                "|----------|--------|----------|---------|",
            ])
            for t in self.template_attribution:
                lines.append(
                    f"| {t.template} | {t.trade_count} | {t.win_rate:.0%} | ${t.net_pnl:+,.2f} |"
                )
            lines.append("")
        
        if self.no_trade_reasons:
            lines.extend([
                "## ⚠️ No Trade Reasons",
                *[f"- {r}" for r in self.no_trade_reasons],
                "",
            ])
        
        if self.alerts:
            lines.extend([
                "## 🚨 Alerts",
                *[f"- {a}" for a in self.alerts],
                "",
            ])
        
        lines.extend([
            "---",
            f"*Report generated at {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')} UTC*",
            "*Paper Trading Mode - Not Real Money*",
        ])
        
        return "\n".join(lines)


@dataclass
class RunCycleLog:
    """Log entry for a single autopilot cycle"""
    cycle_id: str
    started_at: datetime
    completed_at: datetime
    duration_ms: float
    
    # Results
    candidates_generated: int
    candidates_selected: int
    trades_executed: int
    exits_triggered: int
    
    # Status
    success: bool
    error_message: Optional[str] = None
    
    # Selection details
    selection_method: str = "deterministic"
    llm_used: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "cycle_id": self.cycle_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_ms": self.duration_ms,
            "candidates_generated": self.candidates_generated,
            "candidates_selected": self.candidates_selected,
            "trades_executed": self.trades_executed,
            "exits_triggered": self.exits_triggered,
            "success": self.success,
            "error_message": self.error_message,
            "selection_method": self.selection_method,
            "llm_used": self.llm_used,
        }


class ReportGenerator:
    """
    Generates reports and tracks autopilot activity.
    """
    
    def __init__(
        self,
        config: AutopilotConfig,
        position_manager: PositionManager,
    ):
        self.config = config
        self.positions = position_manager
        self._cycle_logs: List[RunCycleLog] = []
        self._daily_metrics: Dict[str, Dict[str, Any]] = {}
        self._cycle_counter = 0
    
    def generate_daily_report(
        self,
        report_date: Optional[date] = None,
        no_trade_reasons: Optional[List[str]] = None,
        alerts: Optional[List[str]] = None,
    ) -> DailyReport:
        """
        Generate daily summary report.
        
        Args:
            report_date: Date for report (defaults to today)
            no_trade_reasons: List of reasons no trades were made
            alerts: List of alerts from monitoring
            
        Returns:
            DailyReport
        """
        report_date = report_date or date.today()
        
        # Get portfolio state
        state = self.positions.get_portfolio_state()
        
        # Calculate daily metrics
        starting = self._get_starting_equity(report_date)
        daily_pnl = state.equity - starting
        daily_return = (daily_pnl / starting * 100) if starting > 0 else 0
        
        # Get closed positions today
        closed_today = self._get_positions_closed_on(report_date)
        opened_today = self._get_positions_opened_on(report_date)
        
        # Calculate attribution
        template_attr = self._calculate_template_attribution(closed_today)
        symbol_attr = self._calculate_symbol_attribution(closed_today)
        
        # Get cycle stats
        cycles_today = [c for c in self._cycle_logs 
                       if c.started_at.date() == report_date]
        
        return DailyReport(
            report_date=report_date,
            generated_at=datetime.utcnow(),
            starting_equity=starting,
            ending_equity=state.equity,
            daily_pnl=daily_pnl,
            daily_return_pct=daily_return,
            trades_opened=len(opened_today),
            trades_closed=len(closed_today),
            candidates_generated=sum(c.candidates_generated for c in cycles_today),
            candidates_selected=sum(c.candidates_selected for c in cycles_today),
            open_positions=state.position_count,
            total_risk_outstanding=state.total_risk,
            template_attribution=template_attr,
            symbol_attribution=symbol_attr,
            max_drawdown=self._calculate_max_drawdown(),
            sharpe_estimate=self._estimate_sharpe(),
            no_trade_reasons=no_trade_reasons or [],
            alerts=alerts or [],
        )
    
    def log_cycle(
        self,
        started_at: datetime,
        candidates_generated: int,
        selection_result: Optional[SelectionResult],
        trades_executed: int,
        monitoring_result: Optional[MonitoringResult],
        error: Optional[Exception] = None,
    ) -> RunCycleLog:
        """Log a completed autopilot cycle."""
        self._cycle_counter += 1
        completed_at = datetime.utcnow()
        
        log = RunCycleLog(
            cycle_id=f"CY{self._cycle_counter:06d}",
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=(completed_at - started_at).total_seconds() * 1000,
            candidates_generated=candidates_generated,
            candidates_selected=len(selection_result.selected) if selection_result else 0,
            trades_executed=trades_executed,
            exits_triggered=monitoring_result.exits_executed if monitoring_result else 0,
            success=error is None,
            error_message=str(error) if error else None,
            selection_method=selection_result.method if selection_result else "none",
            llm_used=not (selection_result.fallback_used if selection_result else True),
        )
        
        self._cycle_logs.append(log)
        
        # Keep only last 1000 logs
        if len(self._cycle_logs) > 1000:
            self._cycle_logs = self._cycle_logs[-1000:]
        
        return log
    
    def get_cycle_logs(
        self,
        limit: int = 100,
        since: Optional[datetime] = None,
    ) -> List[RunCycleLog]:
        """Get recent cycle logs."""
        logs = self._cycle_logs
        
        if since:
            logs = [l for l in logs if l.started_at >= since]
        
        return logs[-limit:]
    
    def _get_starting_equity(self, for_date: date) -> float:
        """Get starting equity for a date."""
        key = for_date.isoformat()
        if key in self._daily_metrics:
            return self._daily_metrics[key].get("starting_equity", self.config.paper_equity)
        
        # Store today's starting equity
        if for_date == date.today():
            state = self.positions.get_portfolio_state()
            self._daily_metrics[key] = {"starting_equity": state.equity}
            return state.equity
        
        return self.config.paper_equity
    
    def _get_positions_closed_on(self, target_date: date) -> List[OptionsPosition]:
        """Get positions closed on a specific date."""
        return [
            p for p in self.positions.get_all_positions()
            if p.status in [PositionStatus.CLOSED, PositionStatus.EXPIRED]
            and p.exit_time and p.exit_time.date() == target_date
        ]
    
    def _get_positions_opened_on(self, target_date: date) -> List[OptionsPosition]:
        """Get positions opened on a specific date."""
        return [
            p for p in self.positions.get_all_positions()
            if p.entry_time.date() == target_date
        ]
    
    def _calculate_template_attribution(
        self,
        positions: List[OptionsPosition],
    ) -> List[TemplateAttribution]:
        """Calculate P&L attribution by template."""
        by_template: Dict[str, List[OptionsPosition]] = {}
        
        for p in positions:
            by_template.setdefault(p.template, []).append(p)
        
        attributions = []
        for template, pos_list in by_template.items():
            wins = [p for p in pos_list if p.net_pnl > 0]
            losses = [p for p in pos_list if p.net_pnl <= 0]
            
            gross_pnl = sum(p.realized_pnl for p in pos_list)
            commission = sum(p.total_commission for p in pos_list)
            net_pnl = gross_pnl - commission
            
            total_wins = sum(p.net_pnl for p in wins) if wins else 0
            total_losses = abs(sum(p.net_pnl for p in losses)) if losses else 0
            
            attributions.append(TemplateAttribution(
                template=template,
                trade_count=len(pos_list),
                win_count=len(wins),
                loss_count=len(losses),
                gross_pnl=gross_pnl,
                commission=commission,
                net_pnl=net_pnl,
                avg_pnl_per_trade=net_pnl / len(pos_list) if pos_list else 0,
                win_rate=len(wins) / len(pos_list) if pos_list else 0,
                avg_win=total_wins / len(wins) if wins else 0,
                avg_loss=total_losses / len(losses) if losses else 0,
                profit_factor=total_wins / total_losses if total_losses > 0 else float('inf'),
            ))
        
        return sorted(attributions, key=lambda a: a.net_pnl, reverse=True)
    
    def _calculate_symbol_attribution(
        self,
        positions: List[OptionsPosition],
    ) -> List[SymbolAttribution]:
        """Calculate P&L attribution by symbol."""
        by_symbol: Dict[str, List[OptionsPosition]] = {}
        
        for p in positions:
            by_symbol.setdefault(p.symbol, []).append(p)
        
        attributions = []
        for symbol, pos_list in by_symbol.items():
            net_pnl = sum(p.net_pnl for p in pos_list)
            
            # Calculate exposure days (rough estimate)
            exposure_days = sum(
                (p.exit_time - p.entry_time).days if p.exit_time else 0
                for p in pos_list
            )
            
            attributions.append(SymbolAttribution(
                symbol=symbol,
                trade_count=len(pos_list),
                net_pnl=net_pnl,
                exposure_days=exposure_days,
                avg_delta=0,  # Would need historical data
            ))
        
        return sorted(attributions, key=lambda a: a.net_pnl, reverse=True)
    
    def _calculate_max_drawdown(self) -> float:
        """Calculate max drawdown (simplified)."""
        # Would need equity curve history
        state = self.positions.get_portfolio_state()
        peak = max(self.config.paper_equity, state.equity)
        return (peak - state.equity) / peak * 100 if peak > 0 else 0
    
    def _estimate_sharpe(self) -> float:
        """Estimate Sharpe ratio from recent returns."""
        # Would need daily return history
        return 0.0


class ActivityLogger:
    """
    Structured logging for autopilot activity.
    Provides logs for UI display.
    """
    
    def __init__(self, max_entries: int = 500):
        self.max_entries = max_entries
        self._entries: List[Dict[str, Any]] = []
    
    def log(
        self,
        event_type: str,
        message: str,
        level: str = "info",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add a log entry."""
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "message": message,
            "level": level,
            "details": details or {},
        }
        
        self._entries.append(entry)
        
        # Trim old entries
        if len(self._entries) > self.max_entries:
            self._entries = self._entries[-self.max_entries:]
        
        # Also log to standard logger
        log_method = getattr(logger, level, logger.info)
        log_method(f"[{event_type}] {message}")
    
    def get_entries(
        self,
        limit: int = 100,
        event_type: Optional[str] = None,
        level: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get log entries with optional filters."""
        entries = self._entries
        
        if event_type:
            entries = [e for e in entries if e["event_type"] == event_type]
        
        if level:
            entries = [e for e in entries if e["level"] == level]
        
        return entries[-limit:]
    
    def clear(self) -> None:
        """Clear all log entries."""
        self._entries.clear()
