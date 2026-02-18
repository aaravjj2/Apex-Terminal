"""
Monitor Module
Implements exit logic and portfolio risk monitoring.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, date, timedelta
from enum import Enum
import logging

from .config import AutopilotConfig
from .position_manager import PositionManager, OptionsPosition, PositionStatus
from .paper_broker import PaperBroker
from .candidates import OptionLeg

logger = logging.getLogger(__name__)


class ExitReason(Enum):
    """Reasons for exiting a position"""
    PROFIT_TARGET = "profit_target"
    LOSS_LIMIT = "loss_limit"
    TIME_STOP = "time_stop"
    EARNINGS_CLOSE = "earnings_close"
    RISK_LIMIT = "risk_limit"
    KILL_SWITCH = "kill_switch"
    MANUAL = "manual"
    EXPIRATION = "expiration"


@dataclass
class ExitSignal:
    """Signal to exit a position"""
    position_id: str
    reason: ExitReason
    priority: int  # Lower = more urgent
    details: str
    target_price: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "position_id": self.position_id,
            "reason": self.reason.value,
            "priority": self.priority,
            "details": self.details,
            "target_price": self.target_price,
            "created_at": self.created_at.isoformat(),
        }


@dataclass 
class RiskAlert:
    """Risk alert for portfolio"""
    alert_id: str
    alert_type: str
    severity: str  # "warning", "critical"
    message: str
    current_value: float
    threshold: float
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "message": self.message,
            "current_value": self.current_value,
            "threshold": self.threshold,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class MonitoringResult:
    """Result of a monitoring cycle"""
    exit_signals: List[ExitSignal]
    risk_alerts: List[RiskAlert]
    positions_checked: int
    exits_executed: int
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "exit_signals": [s.to_dict() for s in self.exit_signals],
            "risk_alerts": [a.to_dict() for a in self.risk_alerts],
            "positions_checked": self.positions_checked,
            "exits_executed": self.exits_executed,
            "timestamp": self.timestamp.isoformat(),
        }


class PositionMonitor:
    """
    Monitors positions and generates exit signals.
    Also monitors portfolio-level risk.
    """
    
    # Exit thresholds by template type
    EXIT_RULES = {
        # Credit strategies
        "put_credit_spread": {
            "profit_target_pct": 50,  # Take profit at 50% of max
            "loss_limit_pct": 200,    # 2x credit received
            "time_stop_dte": 1,       # Close at 1 DTE
        },
        "call_credit_spread": {
            "profit_target_pct": 50,
            "loss_limit_pct": 200,
            "time_stop_dte": 1,
        },
        "iron_condor": {
            "profit_target_pct": 50,
            "loss_limit_pct": 200,
            "time_stop_dte": 1,
        },
        # Debit strategies
        "call_debit_spread": {
            "profit_target_pct": 50,  # Take profit at 50% gain
            "loss_limit_pct": 50,     # Cut loss at 50% of debit
            "time_stop_dte": 1,      # Close at 1 DTE
        },
        "put_debit_spread": {
            "profit_target_pct": 50,
            "loss_limit_pct": 50,
            "time_stop_dte": 1,
        },
    }
    
    def __init__(
        self,
        config: AutopilotConfig,
        position_manager: PositionManager,
        paper_broker: PaperBroker,
    ):
        self.config = config
        self.positions = position_manager
        self.broker = paper_broker
        self._alert_counter = 0
        self._active_alerts: Dict[str, RiskAlert] = {}
    
    def run_monitoring_cycle(
        self,
        market_data: Optional[Dict[str, Any]] = None,
        auto_execute_exits: bool = True,
    ) -> MonitoringResult:
        """
        Run a full monitoring cycle.
        
        Args:
            market_data: Current market data for position updates
            auto_execute_exits: Whether to automatically execute exit orders
            
        Returns:
            MonitoringResult with signals and alerts
        """
        # Update position values
        if market_data:
            self.positions.update_position_values(market_data)
        
        # Check positions for exit signals
        exit_signals = self._check_all_positions()
        
        # Check portfolio risk
        risk_alerts = self._check_portfolio_risk()
        
        # Execute exits if enabled
        exits_executed = 0
        if auto_execute_exits:
            exits_executed = self._execute_exits(exit_signals)
        
        return MonitoringResult(
            exit_signals=exit_signals,
            risk_alerts=risk_alerts,
            positions_checked=len(self.positions.get_open_positions()),
            exits_executed=exits_executed,
        )
    
    def _check_all_positions(self) -> List[ExitSignal]:
        """Check all open positions for exit conditions."""
        signals = []
        
        for position in self.positions.get_open_positions():
            position_signals = self._check_position(position)
            signals.extend(position_signals)
        
        # Sort by priority (lower = more urgent)
        signals.sort(key=lambda s: s.priority)
        
        return signals
    
    def _check_position(self, position: OptionsPosition) -> List[ExitSignal]:
        """Check a single position for exit conditions."""
        signals = []
        rules = self.EXIT_RULES.get(position.template, self.EXIT_RULES["put_credit_spread"])
        
        # Check profit target
        profit_signal = self._check_profit_target(position, rules)
        if profit_signal:
            signals.append(profit_signal)
        
        # Check loss limit
        loss_signal = self._check_loss_limit(position, rules)
        if loss_signal:
            signals.append(loss_signal)
        
        # Check time stop
        time_signal = self._check_time_stop(position, rules)
        if time_signal:
            signals.append(time_signal)
        
        # Check earnings proximity
        earnings_signal = self._check_earnings(position)
        if earnings_signal:
            signals.append(earnings_signal)
        
        return signals
    
    def _check_profit_target(
        self,
        position: OptionsPosition,
        rules: Dict[str, Any],
    ) -> Optional[ExitSignal]:
        """Check if position has hit profit target."""
        target_pct = rules.get("profit_target_pct", 50)
        
        if position.max_profit <= 0:
            return None
        
        profit_pct = (position.unrealized_pnl / position.max_profit) * 100
        
        if profit_pct >= target_pct:
            return ExitSignal(
                position_id=position.position_id,
                reason=ExitReason.PROFIT_TARGET,
                priority=2,  # Medium priority
                details=f"Profit target hit: {profit_pct:.0f}% >= {target_pct}%",
            )
        
        return None
    
    def _check_loss_limit(
        self,
        position: OptionsPosition,
        rules: Dict[str, Any],
    ) -> Optional[ExitSignal]:
        """Check if position has hit loss limit."""
        limit_pct = rules.get("loss_limit_pct", 200)
        
        if position.max_loss <= 0:
            return None
        
        # Calculate current loss as % of max loss
        current_loss = min(0, position.unrealized_pnl)
        loss_pct = abs(current_loss / position.max_loss) * 100
        
        if loss_pct >= limit_pct:
            return ExitSignal(
                position_id=position.position_id,
                reason=ExitReason.LOSS_LIMIT,
                priority=1,  # High priority
                details=f"Loss limit hit: {loss_pct:.0f}% >= {limit_pct}%",
            )
        
        return None
    
    def _check_time_stop(
        self,
        position: OptionsPosition,
        rules: Dict[str, Any],
    ) -> Optional[ExitSignal]:
        """Check if position should be closed due to time."""
        time_stop_dte = rules.get("time_stop_dte", 7)
        
        if position.dte <= time_stop_dte and position.dte > 0:
            return ExitSignal(
                position_id=position.position_id,
                reason=ExitReason.TIME_STOP,
                priority=3,  # Lower priority
                details=f"Time stop: {position.dte} DTE <= {time_stop_dte}",
            )
        
        # Check for expiration day
        if position.dte == 0:
            return ExitSignal(
                position_id=position.position_id,
                reason=ExitReason.EXPIRATION,
                priority=0,  # Highest priority
                details="Expiration day - must close",
            )
        
        return None
    
    def _check_earnings(self, position: OptionsPosition) -> Optional[ExitSignal]:
        """Check if position should be closed before earnings."""
        policy = self.config.earnings_policy
        
        if not policy.auto_close_before_earnings:
            return None
        
        # Only for credit strategies
        if position.template not in ["put_credit_spread", "call_credit_spread", "iron_condor"]:
            return None
        
        # Check if earnings is within blackout period
        # (Simplified: would need actual earnings date data)
        
        return None
    
    def _check_portfolio_risk(self) -> List[RiskAlert]:
        """Check portfolio-level risk metrics."""
        alerts = []
        state = self.positions.get_portfolio_state()
        limits = self.config.risk_limits
        
        # Check total risk
        risk_usage = state.total_risk / limits.max_total_risk if limits.max_total_risk > 0 else 0
        if risk_usage > 0.9:
            alerts.append(self._create_alert(
                alert_type="total_risk",
                severity="critical" if risk_usage > 0.95 else "warning",
                message=f"Total risk at {risk_usage:.0%} of limit",
                current_value=state.total_risk,
                threshold=limits.max_total_risk,
            ))
        
        # Check daily loss
        if state.daily_pnl < -limits.max_daily_loss * 0.8:
            alerts.append(self._create_alert(
                alert_type="daily_loss",
                severity="critical" if state.daily_pnl < -limits.max_daily_loss else "warning",
                message=f"Daily P&L: ${state.daily_pnl:.0f}",
                current_value=abs(state.daily_pnl),
                threshold=limits.max_daily_loss,
            ))
        
        # Check position count
        pos_usage = state.position_count / limits.max_open_positions if limits.max_open_positions > 0 else 0
        if pos_usage > 0.9:
            alerts.append(self._create_alert(
                alert_type="position_count",
                severity="warning",
                message=f"Position count at {pos_usage:.0%} of limit",
                current_value=state.position_count,
                threshold=limits.max_open_positions,
            ))
        
        # Check concentration
        for cluster, risk in state.cluster_exposure.items():
            cluster_pct = risk / limits.max_total_risk if limits.max_total_risk > 0 else 0
            if cluster_pct > limits.max_cluster_risk_pct * 0.9:
                alerts.append(self._create_alert(
                    alert_type="concentration",
                    severity="warning",
                    message=f"Cluster '{cluster}' at {cluster_pct:.0%} concentration",
                    current_value=risk,
                    threshold=limits.max_total_risk * limits.max_cluster_risk_pct,
                ))
        
        # Check delta exposure
        delta_limit = limits.max_total_risk / 10  # Rough delta limit
        if abs(state.total_delta) > delta_limit:
            alerts.append(self._create_alert(
                alert_type="delta_exposure",
                severity="warning",
                message=f"Portfolio delta: {state.total_delta:.1f}",
                current_value=abs(state.total_delta),
                threshold=delta_limit,
            ))
        
        return alerts
    
    def _create_alert(
        self,
        alert_type: str,
        severity: str,
        message: str,
        current_value: float,
        threshold: float,
    ) -> RiskAlert:
        """Create a risk alert."""
        self._alert_counter += 1
        
        return RiskAlert(
            alert_id=f"A{self._alert_counter:06d}",
            alert_type=alert_type,
            severity=severity,
            message=message,
            current_value=current_value,
            threshold=threshold,
        )
    
    def _execute_exits(self, signals: List[ExitSignal]) -> int:
        """Execute exit orders for signals."""
        executed = 0
        
        for signal in signals:
            position = self.positions.get_position(signal.position_id)
            if not position or position.status != PositionStatus.OPEN:
                continue
            
            try:
                # Create closing order
                exit_order = self.broker.close_position(
                    symbol=position.symbol,
                    legs=position.legs,
                    reason=signal.reason.value,
                )
                
                # Update position
                self.positions.close_position(
                    position_id=signal.position_id,
                    exit_order=exit_order,
                    reason=signal.reason.value,
                )
                
                executed += 1
                
                logger.info(
                    f"Exit executed: {position.position_id} - {signal.reason.value}"
                )
                
            except Exception as e:
                logger.error(f"Failed to execute exit for {signal.position_id}: {e}")
        
        return executed
    
    def get_active_alerts(self) -> List[RiskAlert]:
        """Get current active alerts."""
        return list(self._active_alerts.values())
    
    def clear_alert(self, alert_id: str) -> None:
        """Clear an alert."""
        self._active_alerts.pop(alert_id, None)
