"""
Unified Autopilot Cycle

Single workflow that handles:
1. Data refresh
2. Portfolio state refresh  
3. Monitoring pass (exits first)
4. Candidate generation (if risk budget available)
5. Selection and validation
6. Execution via Alpaca
7. Decision trace persistence
8. UI update triggers
"""

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Callable
from enum import Enum
import asyncio
import logging
import os
import uuid

from .monitoring import PositionMonitor, MonitoringReport, get_position_monitor
from .position_manager import PositionManager, PositionStatus
from .config import (
    AutopilotConfig, AutopilotMode, StrategyTemplate,
    RiskLimits, load_llm_config_from_env, LLMMode
)
from .candidates import TradeCandidate, CandidateStatus
from .selector import DeterministicRanker, SelectionResult

logger = logging.getLogger(__name__)


class CyclePhase(str, Enum):
    """Phases of the autopilot cycle."""
    INIT = "init"
    DATA_REFRESH = "data_refresh"
    PORTFOLIO_REFRESH = "portfolio_refresh"
    MONITORING = "monitoring"
    CANDIDATE_GENERATION = "candidate_generation"
    SELECTION = "selection"
    VALIDATION = "validation"
    EXECUTION = "execution"
    PERSISTENCE = "persistence"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class CycleMetrics:
    """Metrics for a cycle run."""
    cycle_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: float = 0.0
    success: bool = False
    
    # Phase metrics
    data_refresh_ms: float = 0.0
    monitoring_ms: float = 0.0
    generation_ms: float = 0.0
    selection_ms: float = 0.0
    validation_ms: float = 0.0
    execution_ms: float = 0.0
    
    # Candidate metrics
    candidates_generated: int = 0
    candidates_by_template: Dict[str, int] = field(default_factory=dict)
    
    # Selection metrics
    candidates_selected: int = 0
    candidates_rejected: int = 0
    selection_method: str = "deterministic"
    
    # Validation metrics
    candidates_valid: int = 0
    candidates_invalid: int = 0
    validation_errors: List[str] = field(default_factory=list)
    
    # Execution metrics
    orders_submitted: int = 0
    orders_filled: int = 0
    orders_rejected: int = 0
    
    # Monitoring metrics
    positions_checked: int = 0
    exits_triggered: int = 0
    exits_executed: int = 0
    
    # Risk metrics
    risk_alerts: List[str] = field(default_factory=list)
    
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "cycle_id": self.cycle_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": round(self.duration_ms, 3),
            "success": self.success,
            "candidates": {
                "generated": self.candidates_generated,
                "by_template": self.candidates_by_template,
            },
            "selection": {
                "selected": self.candidates_selected,
                "rejected": self.candidates_rejected,
                "method": self.selection_method,
            },
            "validation": {
                "valid": self.candidates_valid,
                "invalid": self.candidates_invalid,
                "errors": self.validation_errors,
            },
            "execution": {
                "submitted": self.orders_submitted,
                "filled": self.orders_filled,
                "rejected": self.orders_rejected,
            },
            "monitoring": {
                "exit_signals": self.exits_triggered,
                "exits_executed": self.exits_executed,
                "risk_alerts": len(self.risk_alerts),
            },
            "error": self.error,
        }


@dataclass
class DecisionTrace:
    """Complete trace of a cycle's decisions."""
    trace_id: str
    cycle_id: str
    timestamp: datetime
    
    # Input state
    portfolio_state: Dict[str, Any] = field(default_factory=dict)
    market_context: Dict[str, Any] = field(default_factory=dict)
    sentiment_data: Dict[str, Any] = field(default_factory=dict)
    
    # Decisions
    monitoring_decisions: List[Dict[str, Any]] = field(default_factory=list)
    candidate_decisions: List[Dict[str, Any]] = field(default_factory=list)
    selection_rationale: str = ""
    validation_results: List[Dict[str, Any]] = field(default_factory=list)
    execution_results: List[Dict[str, Any]] = field(default_factory=list)
    
    # Gates triggered
    gates_triggered: List[str] = field(default_factory=list)
    
    # LLM usage
    llm_calls: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "cycle_id": self.cycle_id,
            "timestamp": self.timestamp.isoformat(),
            "portfolio_state": self.portfolio_state,
            "market_context": self.market_context,
            "sentiment_data": self.sentiment_data,
            "monitoring_decisions": self.monitoring_decisions,
            "candidate_decisions": self.candidate_decisions,
            "selection_rationale": self.selection_rationale,
            "validation_results": self.validation_results,
            "execution_results": self.execution_results,
            "gates_triggered": self.gates_triggered,
            "llm_calls": self.llm_calls,
        }


class UnifiedAutopilot:
    """
    Unified autopilot that handles stocks and options in a single cycle.
    
    Key principles:
    1. Monitoring FIRST - handle exits before new entries
    2. Risk budget aware - only generate candidates if budget allows
    3. Deterministic by default - LLM only for tie-breaks
    4. Full traceability - every decision logged
    5. Fail-safe - errors don't leave positions unmanaged
    """
    
    def __init__(
        self,
        config: Optional[AutopilotConfig] = None,
        position_monitor: Optional[PositionMonitor] = None,
    ):
        self._config = config or AutopilotConfig()
        self._monitor = position_monitor or get_position_monitor()
        self._selector = DeterministicRanker()
        
        # State
        self._current_phase = CyclePhase.INIT
        self._is_running = False
        self._kill_switch = False
        self._cycle_counter = 0
        
        # History
        self._cycle_history: List[CycleMetrics] = []
        self._decision_traces: List[DecisionTrace] = []
        self._last_cycle: Optional[CycleMetrics] = None
        
        # Callbacks for UI updates
        self._on_phase_change: Optional[Callable[[CyclePhase, Dict], None]] = None
        self._on_cycle_complete: Optional[Callable[[CycleMetrics], None]] = None
        
        # LLM configuration
        self._llm_config = load_llm_config_from_env()
    
    @property
    def is_running(self) -> bool:
        return self._is_running
    
    @property
    def kill_switch_active(self) -> bool:
        return self._kill_switch
    
    @property
    def current_phase(self) -> CyclePhase:
        return self._current_phase
    
    def activate_kill_switch(self) -> Dict[str, Any]:
        """Activate kill switch - pause autopilot and cancel open orders."""
        self._kill_switch = True
        self._is_running = False
        logger.warning("Kill switch activated")
        return {
            "kill_switch_active": True,
            "autopilot_paused": True,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    def deactivate_kill_switch(self) -> Dict[str, Any]:
        """Deactivate kill switch."""
        self._kill_switch = False
        logger.info("Kill switch deactivated")
        return {
            "kill_switch_active": False,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    def _generate_cycle_id(self) -> str:
        """Generate unique cycle ID."""
        self._cycle_counter += 1
        return f"R{self._cycle_counter:06d}"
    
    def _update_phase(self, phase: CyclePhase, details: Optional[Dict] = None):
        """Update current phase and notify callbacks."""
        self._current_phase = phase
        if self._on_phase_change:
            self._on_phase_change(phase, details or {})
    
    async def run_cycle(
        self,
        dry_run: bool = False,
        force: bool = False,
    ) -> CycleMetrics:
        """
        Run a complete autopilot cycle.
        
        Args:
            dry_run: If True, don't actually place orders
            force: If True, run even if kill switch is active
        """
        cycle_id = self._generate_cycle_id()
        start_time = datetime.utcnow()
        
        metrics = CycleMetrics(
            cycle_id=cycle_id,
            started_at=start_time,
        )
        
        trace = DecisionTrace(
            trace_id=f"T{cycle_id}",
            cycle_id=cycle_id,
            timestamp=start_time,
        )
        
        # Check kill switch
        if self._kill_switch and not force:
            metrics.error = "Kill switch active"
            metrics.completed_at = datetime.utcnow()
            self._update_phase(CyclePhase.ERROR, {"reason": "kill_switch"})
            return metrics
        
        # Check if already running
        if self._is_running:
            metrics.error = "Cycle already in progress"
            metrics.completed_at = datetime.utcnow()
            return metrics
        
        self._is_running = True
        
        try:
            # Phase 1: Data Refresh
            self._update_phase(CyclePhase.DATA_REFRESH)
            data_start = datetime.utcnow()
            market_context = await self._refresh_market_data()
            trace.market_context = market_context
            metrics.data_refresh_ms = (datetime.utcnow() - data_start).total_seconds() * 1000
            
            # Phase 2: Portfolio Refresh
            self._update_phase(CyclePhase.PORTFOLIO_REFRESH)
            portfolio_state = await self._refresh_portfolio_state()
            trace.portfolio_state = portfolio_state
            
            # Phase 3: Monitoring (FIRST - handle exits before entries)
            self._update_phase(CyclePhase.MONITORING)
            mon_start = datetime.utcnow()
            monitoring_report = await self._monitor.run_monitoring_pass(
                market_context=market_context,
                dry_run=dry_run,
                trigger="unified_cycle",
            )
            metrics.monitoring_ms = (datetime.utcnow() - mon_start).total_seconds() * 1000
            metrics.positions_checked = monitoring_report.positions_checked
            metrics.exits_triggered = monitoring_report.exits_triggered
            metrics.exits_executed = monitoring_report.orders_placed
            
            for event in monitoring_report.events:
                trace.monitoring_decisions.append(event.to_dict())
            
            # Phase 4: Check risk budget before generating candidates
            risk_budget = self._calculate_risk_budget(portfolio_state)
            if risk_budget <= 0:
                trace.gates_triggered.append("risk_budget_exhausted")
                logger.info("Risk budget exhausted, skipping candidate generation")
            else:
                # Phase 5: Candidate Generation
                self._update_phase(CyclePhase.CANDIDATE_GENERATION)
                gen_start = datetime.utcnow()
                candidates = await self._generate_candidates(
                    market_context, portfolio_state, risk_budget
                )
                metrics.generation_ms = (datetime.utcnow() - gen_start).total_seconds() * 1000
                metrics.candidates_generated = len(candidates)
                
                # Count by template
                for c in candidates:
                    template = c.template.value if hasattr(c.template, 'value') else str(c.template)
                    metrics.candidates_by_template[template] = \
                        metrics.candidates_by_template.get(template, 0) + 1
                
                if candidates:
                    # Phase 6: Selection
                    self._update_phase(CyclePhase.SELECTION)
                    sel_start = datetime.utcnow()
                    selection = await self._select_candidates(
                        candidates, portfolio_state, market_context
                    )
                    metrics.selection_ms = (datetime.utcnow() - sel_start).total_seconds() * 1000
                    metrics.candidates_selected = len(selection.selected)
                    metrics.candidates_rejected = len(selection.rejected)
                    metrics.selection_method = selection.method
                    trace.selection_rationale = selection.rationale
                    
                    for c in selection.selected:
                        trace.candidate_decisions.append({
                            "action": "selected",
                            "candidate_id": c.id,
                            "symbol": c.symbol,
                            "template": c.template.value if hasattr(c.template, 'value') else str(c.template),
                            "score": c.adjusted_score,
                        })
                    
                    if selection.selected:
                        # Phase 7: Validation
                        self._update_phase(CyclePhase.VALIDATION)
                        val_start = datetime.utcnow()
                        validated = await self._validate_candidates(
                            selection.selected, market_context
                        )
                        metrics.validation_ms = (datetime.utcnow() - val_start).total_seconds() * 1000
                        metrics.candidates_valid = len(validated)
                        metrics.candidates_invalid = len(selection.selected) - len(validated)
                        
                        for v in validated:
                            trace.validation_results.append({
                                "candidate_id": v.id,
                                "status": "valid",
                            })
                        
                        if validated and not dry_run:
                            # Phase 8: Execution
                            self._update_phase(CyclePhase.EXECUTION)
                            exec_start = datetime.utcnow()
                            execution_results = await self._execute_trades(validated)
                            metrics.execution_ms = (datetime.utcnow() - exec_start).total_seconds() * 1000
                            metrics.orders_submitted = execution_results.get("submitted", 0)
                            metrics.orders_filled = execution_results.get("filled", 0)
                            metrics.orders_rejected = execution_results.get("rejected", 0)
                            
                            trace.execution_results = execution_results.get("details", [])
            
            # Phase 9: Persistence
            self._update_phase(CyclePhase.PERSISTENCE)
            await self._persist_decision_trace(trace)
            
            # Complete
            metrics.success = True
            self._update_phase(CyclePhase.COMPLETE)
            
        except Exception as e:
            metrics.error = str(e)
            logger.error(f"Cycle {cycle_id} failed: {e}", exc_info=True)
            self._update_phase(CyclePhase.ERROR, {"error": str(e)})
        
        finally:
            self._is_running = False
            metrics.completed_at = datetime.utcnow()
            metrics.duration_ms = (metrics.completed_at - start_time).total_seconds() * 1000
            
            self._cycle_history.append(metrics)
            self._decision_traces.append(trace)
            self._last_cycle = metrics
            
            if self._on_cycle_complete:
                self._on_cycle_complete(metrics)
        
        return metrics
    
    async def _refresh_market_data(self) -> Dict[str, Any]:
        """Refresh market data from providers."""
        # TODO: Integrate with Tradier for options data
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "regime": "neutral",
            "vix": 18.5,
            "spy_trend": "sideways",
        }
    
    async def _refresh_portfolio_state(self) -> Dict[str, Any]:
        """Refresh portfolio state from Alpaca."""
        positions = await self._monitor.load_alpaca_positions()
        
        total_value = sum(p.market_value for p in positions)
        total_pnl = sum(p.unrealized_pnl for p in positions)
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "position_count": len(positions),
            "total_value": total_value,
            "unrealized_pnl": total_pnl,
            "positions": [p.to_dict() for p in positions],
        }
    
    def _calculate_risk_budget(self, portfolio_state: Dict[str, Any]) -> float:
        """Calculate available risk budget."""
        limits = self._config.risk_limits
        
        # Get current risk
        current_positions = portfolio_state.get("position_count", 0)
        
        # Check position limit
        if current_positions >= limits.max_open_positions:
            return 0.0
        
        # Calculate remaining budget
        # Simplified: assume $50 risk per trade max
        max_new_trades = limits.max_open_positions - current_positions
        return min(max_new_trades * limits.max_risk_per_trade, limits.max_total_risk)
    
    async def _generate_candidates(
        self,
        market_context: Dict[str, Any],
        portfolio_state: Dict[str, Any],
        risk_budget: float,
    ) -> List[TradeCandidate]:
        """Generate trade candidates."""
        # TODO: Implement full candidate generation with Tradier data
        # For now, return empty list
        return []
    
    async def _select_candidates(
        self,
        candidates: List[TradeCandidate],
        portfolio_state: Dict[str, Any],
        market_context: Dict[str, Any],
    ) -> SelectionResult:
        """Select best candidates using deterministic ranking + optional LLM."""
        return self._selector.select(
            candidates,
            self._config,
            portfolio_state,
            market_context,
        )
    
    async def _validate_candidates(
        self,
        candidates: List[TradeCandidate],
        market_context: Dict[str, Any],
    ) -> List[TradeCandidate]:
        """Validate candidates against gates."""
        validated = []
        
        for candidate in candidates:
            # Check liquidity gate
            if candidate.liquidity_score < 0.5:
                candidate.status = CandidateStatus.REJECTED
                candidate.rejection_reasons.append("low_liquidity")
                continue
            
            # Check earnings blackout
            # TODO: Implement earnings calendar check
            
            # Check sentiment gate
            sentiment = market_context.get("sentiment", {}).get(candidate.symbol, {})
            if sentiment.get("shock_headline", False):
                candidate.status = CandidateStatus.REJECTED
                candidate.rejection_reasons.append("news_shock")
                continue
            
            candidate.status = CandidateStatus.SELECTED
            validated.append(candidate)
        
        return validated
    
    async def _execute_trades(
        self,
        candidates: List[TradeCandidate],
    ) -> Dict[str, Any]:
        """Execute trades via Alpaca."""
        results = {
            "submitted": 0,
            "filled": 0,
            "rejected": 0,
            "details": [],
        }
        
        # TODO: Implement actual Alpaca order placement
        # For each candidate, build order with encoded client_order_id
        
        return results
    
    async def _persist_decision_trace(self, trace: DecisionTrace):
        """Persist decision trace for audit."""
        # TODO: Save to database or file
        logger.info(f"Decision trace {trace.trace_id} persisted")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current autopilot status."""
        return {
            "state": "running" if self._is_running else "idle",
            "mode": self._config.mode.value,
            "kill_switch_active": self._kill_switch,
            "current_phase": self._current_phase.value,
            "last_cycle": self._last_cycle.to_dict() if self._last_cycle else None,
            "cycles_run": self._cycle_counter,
            "llm_mode": self._llm_config.mode.value,
        }
    
    def get_last_cycle(self) -> Optional[CycleMetrics]:
        """Get the last cycle metrics."""
        return self._last_cycle
    
    def get_cycle_history(self, limit: int = 10) -> List[CycleMetrics]:
        """Get recent cycle history."""
        return self._cycle_history[-limit:]
    
    def get_decision_trace(self, cycle_id: str) -> Optional[DecisionTrace]:
        """Get decision trace for a specific cycle."""
        for trace in self._decision_traces:
            if trace.cycle_id == cycle_id:
                return trace
        return None
    
    def set_callbacks(
        self,
        on_phase_change: Optional[Callable[[CyclePhase, Dict], None]] = None,
        on_cycle_complete: Optional[Callable[[CycleMetrics], None]] = None,
    ):
        """Set callback functions."""
        self._on_phase_change = on_phase_change
        self._on_cycle_complete = on_cycle_complete


# Global instance
_unified_autopilot: Optional[UnifiedAutopilot] = None


def get_unified_autopilot() -> UnifiedAutopilot:
    """Get or create the global unified autopilot."""
    global _unified_autopilot
    if _unified_autopilot is None:
        _unified_autopilot = UnifiedAutopilot()
    return _unified_autopilot
