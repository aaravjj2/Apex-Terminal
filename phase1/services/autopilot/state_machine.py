"""
Agent State Machine (Milestone 1)

Implements the deterministic state machine for the autonomous autopilot.
All state transitions are logged for backtesting reproducibility.

States:
- IDLE: No position, ready for new entry
- IN_TRADE: Position open, monitoring
- EXITING: Exit order working
- COOLDOWN: Waiting before re-entry (10-15 min)
- TOKEN_TRADE_PENDING: Daily participation not yet done
"""

import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class AgentState(str, Enum):
    """Agent states."""
    IDLE = "idle"
    IN_TRADE = "in_trade"
    EXITING = "exiting"
    COOLDOWN = "cooldown"
    TOKEN_TRADE_PENDING = "token_trade_pending"

class AgentAction(str, Enum):
    """Bounded actions the agent can take."""
    OPEN_POSITION = "open_position"
    EXIT_POSITION = "exit_position"
    PLACE_TOKEN_TRADE = "place_token_trade"
    DO_NOTHING = "do_nothing"

@dataclass
class StateTransition:
    """Record of a state transition for audit."""
    timestamp: datetime
    from_state: AgentState
    to_state: AgentState
    action: AgentAction
    reason: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "from_state": self.from_state.value,
            "to_state": self.to_state.value,
            "action": self.action.value,
            "reason": self.reason,
            "details": self.details,
        }

class AgentStateMachine:
    """
    Deterministic state machine for the autopilot agent.
    
    Key constraint: Every state transition is logged and reproducible.
    """
    
    def __init__(
        self,
        cooldown_seconds: float = 600.0,  # 10 min
        daily_token_required: bool = True,
    ):
        self._state = AgentState.TOKEN_TRADE_PENDING if daily_token_required else AgentState.IDLE
        self._cooldown_duration = timedelta(seconds=cooldown_seconds)
        self._cooldown_end: Optional[datetime] = None
        self._daily_token_required = daily_token_required
        self._token_trade_done = False
        self._current_position_id: Optional[str] = None
        
        # Transition history for audit
        self._transitions: List[StateTransition] = []
        
        # Today's date for daily reset
        self._last_reset_date: Optional[datetime] = None
        
    @property
    def state(self) -> AgentState:
        """Current state."""
        return self._state
    
    @property
    def in_cooldown(self) -> bool:
        """Check if currently in cooldown."""
        if self._state != AgentState.COOLDOWN:
            return False
        if self._cooldown_end and datetime.utcnow() >= self._cooldown_end:
            # Cooldown expired, transition to IDLE
            self._transition(
                AgentState.IDLE,
                AgentAction.DO_NOTHING,
                "Cooldown expired"
            )
            return False
        return True
    
    @property
    def token_trade_done(self) -> bool:
        return self._token_trade_done
    
    def get_allowed_actions(self) -> List[AgentAction]:
        """Get actions allowed in current state."""
        self._check_cooldown_expiry()
        
        if self._state == AgentState.IDLE:
            return [AgentAction.OPEN_POSITION, AgentAction.DO_NOTHING]
        
        elif self._state == AgentState.TOKEN_TRADE_PENDING:
            return [AgentAction.OPEN_POSITION, AgentAction.PLACE_TOKEN_TRADE, AgentAction.DO_NOTHING]
        
        elif self._state == AgentState.IN_TRADE:
            return [AgentAction.EXIT_POSITION, AgentAction.DO_NOTHING]
        
        elif self._state == AgentState.EXITING:
            return [AgentAction.DO_NOTHING]
        
        elif self._state == AgentState.COOLDOWN:
            if self._daily_token_required and not self._token_trade_done:
                return [AgentAction.PLACE_TOKEN_TRADE, AgentAction.DO_NOTHING]
            return [AgentAction.DO_NOTHING]
        
        return [AgentAction.DO_NOTHING]
    
    def on_position_opened(self, position_id: str, is_token: bool = False) -> StateTransition:
        """Called when a position is successfully opened."""
        self._current_position_id = position_id
        
        if is_token:
            self._token_trade_done = True
        
        return self._transition(
            AgentState.IN_TRADE,
            AgentAction.OPEN_POSITION if not is_token else AgentAction.PLACE_TOKEN_TRADE,
            f"Position opened: {position_id}",
            {"position_id": position_id, "is_token": is_token}
        )
    
    def on_exit_initiated(self, position_id: str, reason: str) -> StateTransition:
        """Called when an exit order is submitted."""
        return self._transition(
            AgentState.EXITING,
            AgentAction.EXIT_POSITION,
            f"Exit initiated: {reason}",
            {"position_id": position_id, "exit_reason": reason}
        )
    
    def on_position_closed(self, position_id: str, pnl: Optional[float] = None) -> StateTransition:
        """Called when a position is fully closed."""
        self._current_position_id = None
        self._cooldown_end = datetime.utcnow() + self._cooldown_duration
        
        return self._transition(
            AgentState.COOLDOWN,
            AgentAction.DO_NOTHING,
            f"Position closed, entering cooldown",
            {"position_id": position_id, "pnl": pnl, "cooldown_until": self._cooldown_end.isoformat()}
        )
    
    def on_day_start(self):
        """Reset for new trading day."""
        today = datetime.utcnow().date()
        if self._last_reset_date == today:
            return  # Already reset today
        
        self._last_reset_date = today
        self._token_trade_done = False
        self._cooldown_end = None
        
        if self._daily_token_required and self._state in [AgentState.IDLE, AgentState.COOLDOWN]:
            self._transition(
                AgentState.TOKEN_TRADE_PENDING,
                AgentAction.DO_NOTHING,
                "New trading day: token trade required"
            )
        
        logger.info(f"Agent reset for new trading day: {today}")
    
    def _check_cooldown_expiry(self):
        """Check and handle cooldown expiry."""
        if self._state == AgentState.COOLDOWN and self._cooldown_end:
            if datetime.utcnow() >= self._cooldown_end:
                target = AgentState.IDLE
                if self._daily_token_required and not self._token_trade_done:
                    target = AgentState.TOKEN_TRADE_PENDING
                
                self._transition(target, AgentAction.DO_NOTHING, "Cooldown expired")
    
    def _transition(
        self,
        to_state: AgentState,
        action: AgentAction,
        reason: str,
        details: Dict[str, Any] = None
    ) -> StateTransition:
        """Execute state transition and log it."""
        transition = StateTransition(
            timestamp=datetime.utcnow(),
            from_state=self._state,
            to_state=to_state,
            action=action,
            reason=reason,
            details=details or {}
        )
        
        logger.info(
            f"Agent: {self._state.value} → {to_state.value} | {action.value} | {reason}"
        )
        
        self._state = to_state
        self._transitions.append(transition)
        
        return transition
    
    def get_transition_history(self) -> List[Dict[str, Any]]:
        """Get full transition history for audit."""
        return [t.to_dict() for t in self._transitions]
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize current state for logging."""
        return {
            "state": self._state.value,
            "in_cooldown": self.in_cooldown,
            "cooldown_end": self._cooldown_end.isoformat() if self._cooldown_end else None,
            "token_trade_done": self._token_trade_done,
            "current_position_id": self._current_position_id,
            "transition_count": len(self._transitions),
        }
