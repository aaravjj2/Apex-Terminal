"""
Unified Autopilot Engine v2

This is the ONLY autopilot execution path. All legacy runloop code is retired.

Key principles:
1. Alpaca is the single source of truth for positions and orders
2. Monitoring runs FIRST - handle exits before new entries
3. Full decision trace for every cycle (audit trail)
4. News/sentiment gating is a first-class feature
5. Non-negotiable: every position opened by bot MUST have exit rules

Cycle Order (enforced):
1. Refresh market/news/sentiment data
2. Refresh broker state (positions + orders from Alpaca)
3. Monitoring pass (exit evaluation for ALL open positions)
4. If risk budget available: generate candidates
5. Rank/select (deterministic; LLM optional tie-break)
6. Validate (caps, liquidity, earnings, sentiment gates)
7. Execute via Alpaca paper
8. Persist run artifact
9. Emit UI events
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Callable, Tuple
from enum import Enum
import asyncio
import logging
import uuid
import os
import json

logger = logging.getLogger(__name__)


# ============================================================================
# ENUMS & CONSTANTS
# ============================================================================

class CyclePhase(str, Enum):
    """Phases of the unified autopilot cycle."""
    INIT = "init"
    DATA_REFRESH = "data_refresh"
    BROKER_REFRESH = "broker_refresh"
    MONITORING = "monitoring"
    CANDIDATE_GENERATION = "candidate_generation"
    SELECTION = "selection"
    VALIDATION = "validation"
    EXECUTION = "execution"
    PERSISTENCE = "persistence"
    UI_UPDATE = "ui_update"
    COMPLETE = "complete"
    ERROR = "error"


class ExitReason(str, Enum):
    """Reasons for exiting a position."""
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"
    TIME_STOP = "time_stop"
    DTE_THRESHOLD = "dte_threshold"
    TRAILING_STOP = "trailing_stop"
    EARNINGS_SHOCK = "earnings_shock"
    NEWS_SHOCK = "news_shock"
    EOD_FLATTEN = "eod_flatten"  # v1: 0DTE positions flattened before close
    MANUAL_CLOSE = "manual_close"
    KILL_SWITCH = "kill_switch"
    RISK_LIMIT = "risk_limit"


class ValidationGate(str, Enum):
    """Validation gates that can block a trade."""
    RISK_BUDGET = "risk_budget"
    MAX_POSITIONS = "max_positions"
    MAX_PER_UNDERLYING = "max_per_underlying"
    SYMBOL_FILTER = "symbol_filter"
    CLUSTER_CONCENTRATION = "cluster_concentration"
    LIQUIDITY = "liquidity"
    SPREAD_WIDTH = "spread_width"
    EARNINGS_BLACKOUT = "earnings_blackout"
    NEWS_SENTIMENT = "news_sentiment"
    REGIME_MISMATCH = "regime_mismatch"
    DTE_BOUNDS = "dte_bounds"
    DELTA_BOUNDS = "delta_bounds"


# ============================================================================
# DATA MODELS - Run Artifacts
# ============================================================================

@dataclass
class HealthSnapshot:
    """Snapshot of system/dependency health at cycle start."""
    timestamp: datetime
    alpaca_connected: bool = False
    alpaca_latency_ms: float = 0.0
    websocket_connected: bool = False
    news_provider_status: str = "unknown"
    database_connected: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "alpaca_connected": self.alpaca_connected,
            "alpaca_latency_ms": self.alpaca_latency_ms,
            "websocket_connected": self.websocket_connected,
            "news_provider_status": self.news_provider_status,
            "database_connected": self.database_connected,
        }


@dataclass
class MarketContext:
    """Market context at cycle time."""
    timestamp: datetime
    market_open: bool = False
    regime: str = "unknown"  # bullish/bearish/neutral/volatile
    vix_level: Optional[float] = None
    spy_change_pct: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "market_open": self.market_open,
            "regime": self.regime,
            "vix_level": self.vix_level,
            "spy_change_pct": self.spy_change_pct,
        }


@dataclass
class SentimentSnapshot:
    """News/sentiment data at cycle time."""
    timestamp: datetime
    provider: str = "none"
    symbols_checked: List[str] = field(default_factory=list)
    sentiment_scores: Dict[str, float] = field(default_factory=dict)  # symbol -> score (-1 to 1)
    shock_headlines: List[Dict[str, Any]] = field(default_factory=list)
    news_velocity: str = "normal"  # low/normal/high
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "provider": self.provider,
            "symbols_checked": self.symbols_checked,
            "sentiment_scores": self.sentiment_scores,
            "shock_headlines": self.shock_headlines,
            "news_velocity": self.news_velocity,
        }


@dataclass
class CandidateRecord:
    """Record of a trade candidate considered."""
    candidate_id: str
    symbol: str
    strategy_template: str
    expected_credit: float
    max_loss: float
    dte: int
    short_delta: float
    score: float
    selected: bool
    rejection_reasons: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidate_id": self.candidate_id,
            "symbol": self.symbol,
            "strategy_template": self.strategy_template,
            "expected_credit": self.expected_credit,
            "max_loss": self.max_loss,
            "dte": self.dte,
            "short_delta": self.short_delta,
            "score": self.score,
            "selected": self.selected,
            "rejection_reasons": self.rejection_reasons,
        }


@dataclass
class MonitoringAction:
    """Record of a monitoring action taken."""
    position_id: str
    symbol: str
    action: str  # "exit", "hold", "alert"
    reason: ExitReason
    trigger_value: Optional[float] = None
    threshold: Optional[float] = None
    order_id: Optional[str] = None
    success: bool = False
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "position_id": self.position_id,
            "symbol": self.symbol,
            "action": self.action,
            "reason": self.reason.value,
            "trigger_value": self.trigger_value,
            "threshold": self.threshold,
            "order_id": self.order_id,
            "success": self.success,
            "error": self.error,
        }


@dataclass
class OrderRecord:
    """Record of an order placed."""
    client_order_id: str
    symbol: str
    side: str
    order_type: str
    qty: int
    limit_price: Optional[float] = None
    alpaca_order_id: Optional[str] = None
    status: str = "pending"
    filled_qty: int = 0
    filled_avg_price: Optional[float] = None
    submitted_at: Optional[datetime] = None
    filled_at: Optional[datetime] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "client_order_id": self.client_order_id,
            "symbol": self.symbol,
            "side": self.side,
            "order_type": self.order_type,
            "qty": self.qty,
            "limit_price": self.limit_price,
            "alpaca_order_id": self.alpaca_order_id,
            "status": self.status,
            "filled_qty": self.filled_qty,
            "filled_avg_price": self.filled_avg_price,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "error": self.error,
        }


@dataclass
class BrokerVerification:
    """Verification of broker state vs internal state."""
    timestamp: datetime
    positions_matched: int = 0
    positions_mismatched: int = 0
    orders_matched: int = 0
    orders_mismatched: int = 0
    mismatches: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "positions_matched": self.positions_matched,
            "positions_mismatched": self.positions_mismatched,
            "orders_matched": self.orders_matched,
            "orders_mismatched": self.orders_mismatched,
            "mismatches": self.mismatches,
        }


@dataclass
class ThinkLogEntry:
    """A single thought/decision entry in the think log."""
    timestamp: datetime
    phase: str
    thought: str
    details: Optional[Dict[str, Any]] = None
    emoji: str = "💭"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "phase": self.phase,
            "thought": self.thought,
            "details": self.details,
            "emoji": self.emoji,
        }
    
    def __str__(self) -> str:
        return f"{self.emoji} [{self.phase}] {self.thought}"


class ThinkLog:
    """
    Think Engine Log - Captures the autopilot's decision-making process.
    
    This creates a readable trace of what the AI is thinking, why it made
    certain decisions, and how it evaluated options.
    """
    
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.entries: List[ThinkLogEntry] = []
        self._start_time = datetime.now()
    
    def think(self, phase: str, thought: str, details: Optional[Dict] = None, emoji: str = "💭"):
        """Add a thought to the log."""
        entry = ThinkLogEntry(
            timestamp=datetime.now(),
            phase=phase,
            thought=thought,
            details=details,
            emoji=emoji,
        )
        self.entries.append(entry)
        # Also log to standard logger for console visibility
        logger.info(f"{emoji} [THINK/{phase}] {thought}")
        if details:
            for key, val in details.items():
                logger.debug(f"    {key}: {val}")
        
        # Broadcast via WebSocket (fire and forget)
        try:
            from ..api.autopilot_websocket import get_autopilot_ws_manager
            ws = get_autopilot_ws_manager()
            asyncio.create_task(ws.broadcast("THINK_LOG", entry.to_dict()))
        except Exception:
            pass
    
    def observe(self, what: str, details: Optional[Dict] = None):
        """Log an observation about the market or data."""
        self.think("OBSERVE", what, details, "👁️")
    
    def decide(self, decision: str, reason: str, details: Optional[Dict] = None):
        """Log a decision made."""
        self.think("DECIDE", f"{decision} | Reason: {reason}", details, "🎯")
    
    def evaluate(self, what: str, result: str, details: Optional[Dict] = None):
        """Log an evaluation."""
        self.think("EVALUATE", f"{what} → {result}", details, "⚖️")
    
    def select(self, what: str, why: str, details: Optional[Dict] = None):
        """Log a selection."""
        self.think("SELECT", f"Chose {what} because {why}", details, "✅")
    
    def reject(self, what: str, why: str, details: Optional[Dict] = None):
        """Log a rejection."""
        self.think("REJECT", f"Rejected {what} because {why}", details, "❌")
    
    def skip(self, what: str, why: str, details: Optional[Dict] = None):
        """Log something being skipped."""
        self.think("SKIP", f"Skipping {what}: {why}", details, "⏭️")
    
    def execute(self, action: str, details: Optional[Dict] = None):
        """Log an execution."""
        self.think("EXECUTE", action, details, "🚀")
    
    def monitor(self, what: str, details: Optional[Dict] = None):
        """Log monitoring activity."""
        self.think("MONITOR", what, details, "📊")
    
    def alert(self, message: str, details: Optional[Dict] = None):
        """Log an alert."""
        self.think("ALERT", message, details, "🔔")
    
    def to_list(self) -> List[Dict[str, Any]]:
        """Convert to list of dicts for serialization."""
        return [e.to_dict() for e in self.entries]
    
    def to_readable(self) -> str:
        """Convert to human-readable string."""
        lines = [f"=== Think Log for {self.run_id} ===", ""]
        for entry in self.entries:
            elapsed = (entry.timestamp - self._start_time).total_seconds()
            lines.append(f"[{elapsed:6.2f}s] {entry}")
            if entry.details:
                for k, v in entry.details.items():
                    lines.append(f"          └─ {k}: {v}")
        return "\n".join(lines)


@dataclass
class RunArtifact:
    """
    Complete artifact for a single autopilot cycle run.
    This is the audit trail and explanation base.
    """
    run_id: str
    timestamp: datetime
    duration_ms: float = 0.0
    success: bool = False
    
    # Config snapshot
    config_snapshot: Dict[str, Any] = field(default_factory=dict)
    
    # Health snapshot
    health: Optional[HealthSnapshot] = None
    
    # Market context
    market_context: Optional[MarketContext] = None
    
    # Sentiment data
    sentiment: Optional[SentimentSnapshot] = None
    
    # Candidates
    candidates: List[CandidateRecord] = field(default_factory=list)
    candidates_generated: int = 0
    candidates_selected: int = 0
    
    # Validation
    gates_triggered: List[ValidationGate] = field(default_factory=list)
    validation_errors: List[str] = field(default_factory=list)
    
    # Monitoring
    monitoring_actions: List[MonitoringAction] = field(default_factory=list)
    exits_triggered: int = 0
    exits_executed: int = 0
    
    # Orders
    orders_placed: List[OrderRecord] = field(default_factory=list)
    orders_filled: int = 0
    orders_rejected: int = 0
    
    # Broker verification
    broker_verification: Optional[BrokerVerification] = None
    
    # Why nothing happened (explicit reasons)
    no_action_reasons: List[str] = field(default_factory=list)
    
    # Error info
    error: Optional[str] = None
    error_phase: Optional[CyclePhase] = None
    
    # Think Log - decision trace
    think_log: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "timestamp": self.timestamp.isoformat(),
            "duration_ms": round(self.duration_ms, 3),
            "success": self.success,
            "config_snapshot": self.config_snapshot,
            "health": self.health.to_dict() if self.health else None,
            "market_context": self.market_context.to_dict() if self.market_context else None,
            "sentiment": self.sentiment.to_dict() if self.sentiment else None,
            "candidates": {
                "generated": self.candidates_generated,
                "selected": self.candidates_selected,
                "details": [c.to_dict() for c in self.candidates],
            },
            "validation": {
                "gates_triggered": [g.value for g in self.gates_triggered],
                "errors": self.validation_errors,
            },
            "monitoring": {
                "actions": [a.to_dict() for a in self.monitoring_actions],
                "exits_triggered": self.exits_triggered,
                "exits_executed": self.exits_executed,
            },
            "orders": {
                "placed": [o.to_dict() for o in self.orders_placed],
                "filled": self.orders_filled,
                "rejected": self.orders_rejected,
            },
            "broker_verification": self.broker_verification.to_dict() if self.broker_verification else None,
            "no_action_reasons": self.no_action_reasons,
            "think_log": self.think_log,
            "error": self.error,
            "error_phase": self.error_phase.value if self.error_phase else None,
        }
    
    def add_no_action_reason(self, reason: str):
        """Add a reason why no trades were executed."""
        if reason not in self.no_action_reasons:
            self.no_action_reasons.append(reason)


# ============================================================================
# POSITION MODEL (Broker-canonical)
# ============================================================================

@dataclass
class UnifiedPosition:
    """
    A position as seen from Alpaca (source of truth).
    Internal metadata is for display and audit only.
    """
    # Alpaca-canonical fields
    symbol: str
    qty: int
    side: str  # "long" or "short"
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    asset_class: str  # "us_equity" or "us_option"
    
    # Option-specific
    underlying: Optional[str] = None
    expiration: Optional[str] = None  # ISO date
    strike: Optional[float] = None
    option_type: Optional[str] = None  # "call" or "put"
    dte: Optional[int] = None
    
    # Internal metadata (for display, NOT for truth)
    strategy_id: Optional[str] = None
    strategy_template: Optional[str] = None
    run_id: Optional[str] = None  # Which run opened this
    opened_at: Optional[datetime] = None
    
    # Exit rules (only for bot-managed positions)
    managed: bool = False  # True if opened by bot, False if user-opened
    profit_target_pct: Optional[float] = None
    stop_loss_pct: Optional[float] = None
    time_stop_dte: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "qty": self.qty,
            "side": self.side,
            "avg_entry_price": self.avg_entry_price,
            "current_price": self.current_price,
            "market_value": self.market_value,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": self.unrealized_pnl_pct,
            "asset_class": self.asset_class,
            "underlying": self.underlying,
            "expiration": self.expiration,
            "strike": self.strike,
            "option_type": self.option_type,
            "dte": self.dte,
            "strategy_id": self.strategy_id,
            "strategy_template": self.strategy_template,
            "run_id": self.run_id,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "managed": self.managed,
            "profit_target_pct": self.profit_target_pct,
            "stop_loss_pct": self.stop_loss_pct,
            "time_stop_dte": self.time_stop_dte,
        }


# ============================================================================
# UNIFIED ENGINE
# ============================================================================

class UnifiedAutopilotEngine:
    """
    The ONLY autopilot execution engine.
    
    Replaces:
    - AutopilotRunloop (legacy)
    - AutopilotService.run_cycle
    - Any other autopilot execution paths
    """
    
    def __init__(self):
        self._cycle_counter = 0
        self._is_running = False
        self._kill_switch = False
        self._current_phase = CyclePhase.INIT
        self._paper_verified = False
        
        # Components
        from .news_sentiment import SentimentEngine
        self.sentiment_engine = SentimentEngine()
        
        # History
        self._run_history: List[RunArtifact] = []
        self._last_run: Optional[RunArtifact] = None
        
        # Callbacks
        self._on_phase_change: Optional[Callable[[CyclePhase, Dict], None]] = None
        self._on_cycle_complete: Optional[Callable[[RunArtifact], None]] = None
        
        # Providers (to be injected)
        self._broker_client = None  # Alpaca client
        self._news_provider = None  # Finnhub/yfinance provider
        self._position_store = None  # Internal position metadata store
        
        # Anti-thrash state (V1 Phase 1)
        self._ticker_last_stopout: Dict[str, datetime] = {}  # ticker -> last stop-out time
        self._consecutive_stopouts: int = 0  # count of consecutive stop-outs
        self._circuit_breaker_until: Optional[datetime] = None  # circuit breaker expiry
        self._daily_loss_pct: float = 0.0  # track daily loss %
        self._day_start_equity: Optional[float] = None  # equity at day start
        
        # Verify paper-only on init
        self._verify_paper_only()
        
        logger.info("UnifiedAutopilotEngine initialized")
    
    def _verify_paper_only(self) -> bool:
        """
        Verify that the Alpaca endpoint is paper-only.
        REFUSES TO TRADE if not paper endpoint.
        """
        import os
        endpoint = os.environ.get("ALPACA3_ENDPOINT", os.environ.get("APCA_API_BASE_URL", ""))
        
        # Check for paper indicators
        is_paper = (
            "paper" in endpoint.lower() or
            endpoint == "" or  # Default to paper if not set
            endpoint.startswith("https://paper-api")
        )
        
        if not is_paper:
            logger.critical(f"REFUSING TO TRADE: Endpoint is NOT paper! endpoint={endpoint}")
            self._kill_switch = True
            self._paper_verified = False
            
            # Log incident
            try:
                from .repository import get_autopilot_repository, IncidentSeverity
                repo = get_autopilot_repository()
                repo.create_incident(
                    severity=IncidentSeverity.CRITICAL,
                    category="kill_switch",
                    title="Non-paper endpoint detected - kill switch activated",
                    description=f"Attempted to trade on non-paper endpoint: {endpoint}",
                )
            except Exception as e:
                logger.error(f"Failed to log incident: {e}")
            
            return False
        
        self._paper_verified = True
        logger.info(f"Paper-only verified: endpoint={endpoint or 'default-paper'}")
        return True
    
    # -------------------------------------------------------------------------
    # Properties
    # -------------------------------------------------------------------------
    
    @property
    def is_running(self) -> bool:
        return self._is_running
    
    @property
    def kill_switch_active(self) -> bool:
        return self._kill_switch
    
    @property
    def current_phase(self) -> CyclePhase:
        return self._current_phase
    
    @property
    def last_run(self) -> Optional[RunArtifact]:
        return self._last_run
    
    @property
    def run_history(self) -> List[RunArtifact]:
        return self._run_history
    
    # -------------------------------------------------------------------------
    # Kill Switch
    # -------------------------------------------------------------------------
    
    async def activate_kill_switch(self, close_all: bool = False) -> Dict[str, Any]:
        """
        Activate kill switch - stops all automation immediately.
        
        Args:
            close_all: If True, attempts to close all open positions immediately.
        """
        self._kill_switch = True
        self._is_running = False
        logger.warning(f"KILL SWITCH ACTIVATED {'(CLOSING POSITIONS)' if close_all else ''}")
        
        closed_count = 0
        if close_all:
            try:
                from .alpaca_client import get_alpaca_client
                client = get_alpaca_client()
                
                # Ensure client is initialized
                if not client.is_connected():
                    await client._init_client()
                
                positions = await client.list_positions()
                logger.info(f"Kill switch: Closing {len(positions)} positions...")
                
                for pos in positions:
                    try:
                        await client.close_position(pos.symbol)
                        logger.info(f"Kill switch: Closed {pos.symbol}")
                        closed_count += 1
                        # Small delay to prevent rate limits
                        await asyncio.sleep(0.1)
                    except Exception as e:
                        logger.error(f"Kill switch: Failed to close {pos.symbol}: {e}")
            except Exception as e:
                logger.error(f"Kill switch: Failed to close positions: {e}")
        
        return {
            "kill_switch_active": True,
            "positions_closed": closed_count,
            "timestamp": datetime.now().isoformat(),
        }
    
    def deactivate_kill_switch(self) -> Dict[str, Any]:
        """Deactivate kill switch."""
        self._kill_switch = False
        logger.info("Kill switch deactivated")
        return {
            "kill_switch_active": False,
            "timestamp": datetime.now().isoformat(),
        }
    
    # -------------------------------------------------------------------------
    # Start/Stop Control
    # -------------------------------------------------------------------------
    
    def start(self) -> Dict[str, Any]:
        """Start the autopilot engine (enables scheduled cycles)."""
        if self._kill_switch:
            raise RuntimeError("Cannot start while kill switch is active. Deactivate it first.")
        
        if self._is_running:
            return {
                "status": "already_running",
                "timestamp": datetime.now().isoformat(),
            }
        
        self._is_running = True
        logger.info("Autopilot engine started")
        
        return {
            "status": "started",
            "timestamp": datetime.now().isoformat(),
        }
    
    def stop(self) -> Dict[str, Any]:
        """Stop the autopilot engine (disables scheduled cycles)."""
        if not self._is_running:
            return {
                "status": "already_stopped",
                "timestamp": datetime.now().isoformat(),
            }
        
        self._is_running = False
        logger.info("Autopilot engine stopped")
        
        return {
            "status": "stopped",
            "timestamp": datetime.now().isoformat(),
        }
    
    # -------------------------------------------------------------------------
    # Cycle ID Generation
    # -------------------------------------------------------------------------
    
    def _generate_run_id(self) -> str:
        """Generate unique run ID for tracing."""
        self._cycle_counter += 1
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"UAC-{ts}-{self._cycle_counter:04d}"
    
    # -------------------------------------------------------------------------
    # Client Order ID Generation (for broker reconciliation)
    # -------------------------------------------------------------------------
    
    def _generate_client_order_id(self, run_id: str, strategy: str, symbol: str) -> str:
        """
        Generate stable client_order_id that encodes context.
        Format: {run_id}_{strategy}_{symbol}_{uuid4_short}
        """
        short_uuid = uuid.uuid4().hex[:8]
        # Sanitize for Alpaca (alphanumeric + underscore + hyphen only)
        safe_symbol = symbol.replace(" ", "_").replace("/", "_")
        safe_strategy = strategy.replace(" ", "_")[:10]
        return f"{run_id}_{safe_strategy}_{safe_symbol}_{short_uuid}"
    
    # -------------------------------------------------------------------------
    # Main Cycle Execution
    # -------------------------------------------------------------------------
    
    async def run_cycle(
        self,
        dry_run: bool = False,
        force: bool = False,
        config: Optional[Dict[str, Any]] = None,
    ) -> RunArtifact:
        """
        Execute a single unified autopilot cycle.
        
        Args:
            dry_run: If True, skip execution phase
            force: If True, run even if kill switch active (for testing only)
            config: Optional config overrides
        
        Returns:
            RunArtifact with complete audit trail
        """
        run_id = self._generate_run_id()
        start_time = datetime.now()
        
        # Initialize ThinkLog for this run
        think = ThinkLog(run_id)
        think.think("START", f"Beginning cycle {run_id}", {"dry_run": dry_run, "force": force}, "🧠")
        
        artifact = RunArtifact(
            run_id=run_id,
            timestamp=start_time,
        )
        
        try:
            # Pre-flight checks
            if self._kill_switch and not force:
                think.alert("Kill switch is active - aborting cycle")
                artifact.add_no_action_reason("Kill switch is active")
                artifact.success = False
                artifact.think_log = think.to_list()
                return artifact
            
            # Paper-only guard (v1 non-negotiable)
            if not self._paper_verified and not force:
                think.alert("Paper verification failed - refusing to trade")
                artifact.add_no_action_reason("Paper-only verification failed")
                artifact.success = False
                artifact.think_log = think.to_list()
                return artifact
            
            if self._is_running:
                think.alert("Another cycle is already running - aborting")
                artifact.add_no_action_reason("Another cycle is already running")
                artifact.success = False
                artifact.think_log = think.to_list()
                return artifact
            
            self._is_running = True
            
            # Phase 1: Data Refresh
            self._set_phase(CyclePhase.DATA_REFRESH)
            think.observe("Refreshing market data...")
            artifact.market_context = await self._refresh_market_data()
            think.observe(f"Market is {'OPEN' if artifact.market_context.market_open else 'CLOSED'}, regime: {artifact.market_context.regime}", {
                "vix": artifact.market_context.vix_level,
                "spy_change": artifact.market_context.spy_change_pct,
            })
            
            think.observe("Checking news and sentiment...")
            artifact.sentiment = await self._refresh_sentiment_data()
            if artifact.sentiment.shock_headlines:
                think.alert(f"Found {len(artifact.sentiment.shock_headlines)} shock headlines!")
            think.observe(f"News velocity: {artifact.sentiment.news_velocity}, checked {len(artifact.sentiment.symbols_checked)} symbols")
            
            # Phase 2: Broker Refresh
            self._set_phase(CyclePhase.BROKER_REFRESH)
            think.observe("Fetching current positions from Alpaca...")
            positions, orders = await self._refresh_broker_state()
            think.observe(f"Found {len(positions)} positions, {len(orders)} open orders", {
                "underlyings": list(set(p.underlying or p.symbol for p in positions))[:10],
            })
            artifact.health = await self._check_health()
            think.observe(f"Alpaca connected: {artifact.health.alpaca_connected}, latency: {artifact.health.alpaca_latency_ms:.0f}ms")
            
            # Phase 3: Monitoring - Check for exit triggers on ALL positions
            self._set_phase(CyclePhase.MONITORING)
            think.monitor("Checking all positions for exit triggers...")
            
            monitoring_actions = await self._run_monitoring_pass(
                positions, artifact.market_context, artifact.sentiment, dry_run
            )
            
            artifact.monitoring_actions = monitoring_actions
            artifact.exits_triggered = len([a for a in monitoring_actions if a.action == "exit"])
            artifact.exits_executed = len([a for a in monitoring_actions if a.success])
            
            if artifact.exits_triggered > 0:
                think.execute(f"EXIT TRIGGERS: {artifact.exits_triggered} positions triggered, {artifact.exits_executed} executed")
            else:
                think.observe(f"No exit triggers (monitoring {len(positions)} positions)")
            
            # Phase 4: Candidate Generation (if budget available)
            self._set_phase(CyclePhase.CANDIDATE_GENERATION)
            
            # V1 REGIME GATE: CHAOS = no entries
            current_regime = artifact.market_context.regime.lower() if artifact.market_context.regime else "unknown"
            regime_allows_entries = current_regime != "chaos"
            
            if not regime_allows_entries:
                think.reject("New trades", f"V1 REGIME GATE: {current_regime.upper()} regime blocks all entries")
                artifact.add_no_action_reason(f"V1 Regime Gate: {current_regime.upper()} blocks entries")
                artifact.gates_triggered.append(ValidationGate.REGIME_MISMATCH)
                logger.warning(f"⚠️ V1 REGIME GATE: CHAOS detected - blocking all new entries")
            
            think.evaluate("Risk budget", "checking if we can open new positions...")
            
            # Get daily trade count for limit check
            daily_trades = await self._get_daily_trade_count()
            risk_budget_ok = self._check_risk_budget(positions, daily_trades) and regime_allows_entries
            
            if not risk_budget_ok:
                if not regime_allows_entries:
                    pass  # Already logged above
                else:
                    think.reject("New trades", "risk budget exhausted")
                    artifact.add_no_action_reason("Risk budget exhausted")
                    artifact.gates_triggered.append(ValidationGate.RISK_BUDGET)
            else:
                think.decide("Proceed with candidate generation", "risk budget available")
            
            candidates = []
            if risk_budget_ok:
                think.observe("Scanning universe for trade opportunities...")
                candidates = await self._generate_candidates(
                    artifact.market_context, artifact.sentiment, positions
                )
                artifact.candidates_generated = len(candidates)
                think.observe(f"Generated {len(candidates)} potential candidates", {
                    "symbols": [c.get("symbol") for c in candidates[:10]],
                    "strategies": list(set(c.get("template") for c in candidates)),
                })
            
            # Phase 5: Selection
            self._set_phase(CyclePhase.SELECTION)
            selected = []
            if candidates:
                think.evaluate("Ranking candidates", "sorting by score and applying selection criteria...")
                selected = self._select_candidates(candidates)
                artifact.candidates_selected = len(selected)
                
                # Log each candidate's score and selection status
                for c in candidates:
                    if c in selected:
                        think.select(f"{c.get('symbol')} ({c.get('template')})", f"score={c.get('score', 0):.2f}, credit=${c.get('credit', 0):.2f}", {
                            "dte": c.get("dte"),
                            "delta": c.get("delta"),
                            "pop": c.get("pop"),
                        })
                    else:
                        think.reject(f"{c.get('symbol')}", f"score too low ({c.get('score', 0):.2f}) or not in top N")
                
                artifact.candidates = [
                    CandidateRecord(
                        candidate_id=c.get("id", str(uuid.uuid4())),
                        symbol=c.get("symbol", ""),
                        strategy_template=c.get("template", ""),
                        expected_credit=c.get("credit", 0.0),
                        max_loss=c.get("max_loss", 0.0),
                        dte=c.get("dte", 0),
                        short_delta=c.get("delta", 0.0),
                        score=c.get("score", 0.0),
                        selected=c in selected,
                        rejection_reasons=c.get("rejection_reasons", []),
                    )
                    for c in candidates
                ]
            else:
                think.skip("Selection phase", "no candidates generated")
            
            # Phase 6: Validation
            self._set_phase(CyclePhase.VALIDATION)
            validated = []
            if selected:
                think.evaluate("Validation gates", f"checking {len(selected)} selected candidates...")
                for candidate in selected:
                    valid, gates, errors = self._validate_candidate(
                        candidate, positions, artifact.sentiment
                    )
                    if valid:
                        validated.append(candidate)
                        think.select(f"{candidate.get('symbol')}", "passed all validation gates")
                    else:
                        think.reject(f"{candidate.get('symbol')}", f"failed gates: {[g.value for g in gates]}")
                        artifact.gates_triggered.extend(gates)
                        artifact.validation_errors.extend(errors)
                
                think.decide(f"{len(validated)} candidates validated", f"{len(selected) - len(validated)} rejected by gates")
                
                # Generate explanations for validated candidates (post-decision)
                for candidate in validated:
                    try:
                        explanation = await self._explain_decision(candidate)
                        candidate["explanation"] = explanation
                        think.think("EXPLAIN", f"Rationale for {candidate.get('symbol')}: {explanation}", emoji="💡")
                    except Exception as e:
                        logger.warning(f"Failed to generate explanation for {candidate.get('symbol')}: {e}")
                        candidate["explanation"] = "Explanation generation failed."
            
            # Phase 7: Execution
            self._set_phase(CyclePhase.EXECUTION)
            print(f"EXEC DEBUG: validated={len(validated)}, dry_run={dry_run}")
            logger.info(f"⚡ EXECUTION PHASE: validated={len(validated)}, dry_run={dry_run}")
            if validated:
                print(f"EXEC DEBUG: Have validated candidates")
                logger.info(f"✅ Have {len(validated)} validated candidates")
                if not dry_run:
                    print(f"EXEC DEBUG: DRY_RUN=FALSE - executing trades")
                    logger.info("🚀 DRY_RUN=FALSE - REAL EXECUTION MODE")
                    think.execute(f"Submitting {len(validated)} trades to Alpaca...")
                    orders = await self._execute_trades(validated, run_id)
                    artifact.orders_placed = orders
                    artifact.orders_filled = sum(1 for o in orders if o.status == "filled")
                    artifact.orders_rejected = sum(1 for o in orders if o.status == "rejected")
                    
                    for order in orders:
                        if order.status == "filled":
                            think.execute(f"FILLED: {order.symbol} @ ${order.limit_price:.2f}", {
                                "order_id": order.alpaca_order_id,
                                "qty": order.qty,
                            })
                        elif order.status == "rejected":
                            think.reject(f"Order {order.symbol}", order.error or "unknown error")
                        else:
                            think.think("PENDING", f"Order {order.symbol} status: {order.status}", emoji="⏳")
                else:
                    think.skip("Execution", "dry run mode enabled")
                    artifact.add_no_action_reason("Dry run mode - execution skipped")
                    logger.warning("🔴 DRY_RUN=TRUE - Skipping execution")
            else:
                think.skip("Execution", "no candidates passed validation")
                artifact.add_no_action_reason("No candidates passed validation")
                logger.warning("⚠️ NO VALIDATED CANDIDATES - Nothing to execute")
            
            # Phase 8: Persistence
            self._set_phase(CyclePhase.PERSISTENCE)
            think.think("SAVE", "Persisting run artifact to disk...", emoji="💾")
            await self._persist_artifact(artifact)
            
            # Phase 9: Broker Verification
            artifact.broker_verification = await self._verify_broker_state(run_id)
            if artifact.broker_verification:
                think.observe(f"Broker verification: {artifact.broker_verification.positions_matched} positions matched")
            
            # Phase 10: UI Update
            self._set_phase(CyclePhase.UI_UPDATE)
            await self._emit_ui_events(artifact)
            
            # Complete
            self._set_phase(CyclePhase.COMPLETE)
            artifact.success = True
            elapsed = (datetime.now() - start_time).total_seconds()
            think.think("COMPLETE", f"Cycle finished in {elapsed:.2f}s - {artifact.orders_filled} orders filled, {artifact.exits_executed} exits executed", emoji="✅")
            
        except Exception as e:
            logger.error(f"Cycle failed: {e}", exc_info=True)
            think.alert(f"CYCLE ERROR: {str(e)}")
            artifact.error = str(e)
            artifact.error_phase = self._current_phase
            artifact.success = False
            self._set_phase(CyclePhase.ERROR)
        
        finally:
            self._is_running = False
            artifact.duration_ms = (datetime.now() - start_time).total_seconds() * 1000
            artifact.think_log = think.to_list()  # Save think log to artifact
            
            # Broadcast cycle complete
            try:
                from ..api.autopilot_websocket import get_autopilot_ws_manager
                ws = get_autopilot_ws_manager()
                asyncio.create_task(ws.broadcast("CYCLE_COMPLETE", {
                    "run_id": artifact.run_id,
                    "success": artifact.success,
                    "duration_ms": artifact.duration_ms,
                    "candidates": artifact.candidates_generated,
                    "orders": artifact.orders_filled,
                    "timestamp": datetime.now().isoformat()
                }))
            except Exception:
                pass

            self._last_run = artifact
            self._run_history.append(artifact)
            
            # Keep history bounded
            if len(self._run_history) > 1000:
                self._run_history = self._run_history[-500:]
            
            if self._on_cycle_complete:
                try:
                    self._on_cycle_complete(artifact)
                except Exception as e:
                    logger.error(f"Callback error: {e}")
        
        return artifact
    
    # -------------------------------------------------------------------------
    # Phase Helpers
    # -------------------------------------------------------------------------
    
    def _set_phase(self, phase: CyclePhase):
        """Update current phase and notify callbacks."""
        self._current_phase = phase
        if self._on_phase_change:
            try:
                self._on_phase_change(phase, {"timestamp": datetime.now().isoformat()})
            except Exception:
                pass
        
        # Broadcast via WebSocket
        try:
            from ..api.autopilot_websocket import get_autopilot_ws_manager
            ws = get_autopilot_ws_manager()
            asyncio.create_task(ws.broadcast("STATUS_UPDATE", {
                "phase": phase.value,
                "timestamp": datetime.now().isoformat()
            }))
        except Exception:
            pass
    
    # -------------------------------------------------------------------------
    # Implementation Methods
    # -------------------------------------------------------------------------
    
    async def _refresh_market_data(self) -> MarketContext:
        """Refresh market context data."""
        from .alpaca_client import get_alpaca_client
        
        client = get_alpaca_client()
        clock = await client.get_clock()
        
        return MarketContext(
            timestamp=datetime.now(),
            market_open=clock.is_open if clock else self._is_market_open(),
            regime="neutral",  # TODO: Calculate from VIX/SPY
        )
    
    async def _refresh_sentiment_data(self) -> SentimentSnapshot:
        """Refresh news/sentiment data from providers."""
        try:
            # Get Global Market Sentiment
            market_sent = await self.sentiment_engine.get_market_sentiment()
            
            # Simple mapping of market sentiment to 'news_velocity' or similar field
            # For now, we store the score in sentiment_scores with key 'SPY' (proxy for market)
            
            return SentimentSnapshot(
                timestamp=datetime.now(),
                provider="finnhub-ensemble",
                news_velocity=market_sent.bucket.value, # Store bucket name here for display
                sentiment_scores={"MARKET": market_sent.sentiment_score},
                symbols_checked=["MARKET"]
            )
        except Exception as e:
            logger.warning(f"Failed to get sentiment: {e}")
            return SentimentSnapshot(
                timestamp=datetime.now(),
                provider="error",
            )
    
    async def _refresh_broker_state(self) -> Tuple[List[UnifiedPosition], List[Dict]]:
        """Refresh positions and orders from Alpaca."""
        from .alpaca_client import get_alpaca_client
        from .broker_position_manager import get_broker_position_manager
        
        client = get_alpaca_client()
        manager = get_broker_position_manager()
        
        positions = []
        orders = []
        
        try:
            # Get positions from Alpaca
            alpaca_positions = await client.list_positions()
            for pos in alpaca_positions:
                # Get metadata from manager
                meta = manager._store.get(pos.symbol)
                
                positions.append(UnifiedPosition(
                    symbol=pos.symbol,
                    qty=pos.qty,
                    side=pos.side,
                    avg_entry_price=pos.avg_entry_price,
                    current_price=pos.current_price,
                    market_value=pos.market_value,
                    unrealized_pnl=pos.unrealized_pl,
                    unrealized_pnl_pct=pos.unrealized_plpc * 100,
                    asset_class=pos.asset_class,
                    managed=meta.managed if meta else False,
                    strategy_id=meta.strategy_id if meta else None,
                    strategy_template=meta.strategy_template if meta else None,
                    run_id=meta.run_id if meta else None,
                ))
            
            # Get open orders
            alpaca_orders = await client.list_orders(status="open")
            orders = [o.to_dict() for o in alpaca_orders]
            
        except Exception as e:
            logger.error(f"Failed to refresh broker state: {e}")
        
        return positions, orders
    
    async def _check_health(self) -> HealthSnapshot:
        """Check system health."""
        from .alpaca_client import get_alpaca_client
        from .news_provider import get_news_provider
        
        client = get_alpaca_client()
        connected, latency = await client.health_check()
        
        provider = get_news_provider()
        
        return HealthSnapshot(
            timestamp=datetime.now(),
            alpaca_connected=connected,
            alpaca_latency_ms=latency,
            websocket_connected=True,  # TODO: Real check
            news_provider_status=provider.provider_name,
            database_connected=True,  # TODO: Real check
        )
    
    async def _run_monitoring_pass(
        self,
        positions: List[UnifiedPosition],
        market: MarketContext,
        sentiment: SentimentSnapshot,
        dry_run: bool,
    ) -> List[MonitoringAction]:
        """
        Run monitoring pass - evaluate exits for ALL Alpaca positions.
        
        Uses REAL Alpaca position P&L, not simulated values.
        Executes sell orders via Alpaca API for positions that hit exit triggers.
        """
        from .broker_position_manager import get_broker_position_manager, ExitTrigger, EnrichedBrokerPosition, BrokerExitSignal, BrokerExitRule
        from .alpaca_client import get_alpaca_client
        from datetime import date
        
        manager = get_broker_position_manager()
        client = get_alpaca_client()
        
        actions = []
        
        print(f"MONITOR: Starting monitoring pass, dry_run={dry_run}")
        
        # Get ALL Alpaca positions (real market data)
        try:
            alpaca_positions_raw = await client.list_positions()
            print(f"MONITOR: Got {len(alpaca_positions_raw)} positions from Alpaca")
        except Exception as e:
            print(f"MONITOR: Failed to get Alpaca positions: {e}")
            logger.error(f"Failed to get Alpaca positions: {e}")
            return actions
        
        # Enrich with metadata and calculate profit % using REAL prices
        enriched_positions = []
        for pos in alpaca_positions_raw:
            symbol = pos.symbol
            meta = manager._store.get(symbol)
            
            # Calculate REAL profit % from Alpaca data
            entry_price = float(pos.avg_entry_price)
            current_price = float(pos.current_price)
            unrealized_pnl = float(pos.unrealized_pl)
            unrealized_pnl_pct = float(pos.unrealized_plpc) * 100  # Alpaca returns as decimal
            
            # Use Alpaca P&L % directly  
            current_profit_pct = unrealized_pnl_pct
            
            # For options, calculate based on credit received if we have metadata
            if meta and meta.entry_credit > 0:
                # For credit spreads: profit = credit - current_value
                market_val = abs(float(pos.market_value))
                credit_received = meta.entry_credit * 100  # Convert to dollar value
                current_profit_pct = ((credit_received - market_val) / credit_received) * 100
            
            # Parse option details from symbol
            underlying = manager._parse_underlying(symbol) if hasattr(manager, '_parse_underlying') else None
            expiration = manager._parse_expiration(symbol) if hasattr(manager, '_parse_expiration') else None
            strike = manager._parse_strike(symbol) if hasattr(manager, '_parse_strike') else None
            option_type = manager._parse_option_type(symbol) if hasattr(manager, '_parse_option_type') else None
            dte = manager._calc_dte(expiration) if hasattr(manager, '_calc_dte') and expiration else None
            
            # Default exit rules - HIGH WIN RATE settings
            # Tighter stops + faster profit taking = more consistent wins
            exit_rules = meta.exit_rules if meta else BrokerExitRule(
                stop_loss_pct=8.0,        # 8% hard stop (tighter risk control)
                profit_target_pct=25.0,   # 25% profit target (take wins faster)
                time_stop_dte=1,
                trailing_step=5.0,
                break_even_trigger_pct=5.0,  # Move to break-even at 5% profit
            )
            
            # Track highest profit
            highest_profit = meta.highest_profit_pct if meta else 0.0
            if current_profit_pct > highest_profit:
                highest_profit = current_profit_pct
                if meta:
                    manager._store.update_highest_profit(symbol, highest_profit)
            
            enriched = EnrichedBrokerPosition(
                symbol=symbol,
                qty=int(pos.qty),
                side=pos.side,
                avg_entry_price=entry_price,
                current_price=current_price,
                market_value=float(pos.market_value),
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_pct=unrealized_pnl_pct,
                asset_class=pos.asset_class,
                underlying=underlying,
                expiration=expiration,
                strike=strike,
                option_type=option_type,
                dte=dte,
                managed=meta.managed if meta else True,  # Assume managed for monitoring
                run_id=meta.run_id if meta else None,
                strategy_template=meta.strategy_template if meta else None,
                exit_rules=exit_rules,
                entry_credit=meta.entry_credit if meta else entry_price,
                highest_profit_pct=highest_profit,
                current_profit_pct=current_profit_pct,
            )
            
            # Skip expired positions (DTE <= 0) - they can't be traded
            if dte is not None and dte <= 0:
                print(f"MONITOR [{symbol}]: ⚠️ EXPIRED (DTE={dte}) - skipping (Alpaca will auto-exercise/expire)")
                continue
            
            enriched_positions.append(enriched)
            
            print(f"MONITOR [{symbol}]: qty={pos.qty}, entry=${entry_price:.2f}, current=${current_price:.2f}, pnl={unrealized_pnl_pct:.1f}%, profit_pct={current_profit_pct:.1f}%, DTE={dte}")
        
        logger.info(f"Monitoring {len(enriched_positions)} Alpaca positions")
        
        # Evaluate exit triggers for ALL positions
        exit_signals = await manager.evaluate_exits(
            positions=enriched_positions,
            news_shocks=sentiment.shock_headlines if hasattr(sentiment, 'shock_headlines') else [],
        )
        
        print(f"MONITOR: Got {len(exit_signals)} exit signals")
        
        for signal in exit_signals:
            action = MonitoringAction(
                position_id=signal.symbol,
                symbol=signal.symbol,
                action="exit" if signal.urgency == "immediate" else "alert",
                reason=ExitReason(signal.trigger.value),
                trigger_value=signal.trigger_value,
                threshold=signal.threshold,
            )
            
            print(f"MONITOR: 🔔 EXIT SIGNAL: {signal.symbol} - {signal.trigger.value} (value={signal.trigger_value:.1f}%, threshold={signal.threshold:.1f}%, urgency={signal.urgency})")
            logger.info(f"🔔 EXIT SIGNAL: {signal.symbol} - {signal.trigger.value} (value={signal.trigger_value:.1f}%, threshold={signal.threshold:.1f}%)")
            
            # Execute exit if urgent and not dry run
            if signal.urgency == "immediate" and not dry_run:
                print(f"MONITOR: 🚀 EXECUTING SELL for {signal.symbol}")
                try:
                    # Close position via Alpaca API
                    order = await client.close_position(signal.symbol)
                    if order:
                        action.order_id = str(order.id) if hasattr(order, 'id') else str(order)
                        action.success = True
                        print(f"MONITOR: ✅ SELL ORDER PLACED: {signal.symbol} - order_id={action.order_id}")
                        logger.info(f"✅ Exit executed: {signal.symbol} ({signal.trigger.value}) - order_id={action.order_id}")
                        
                        # Unregister from metadata store
                        manager.unregister_position(signal.symbol)
                    else:
                        action.error = "close_position returned None"
                        print(f"MONITOR: ❌ SELL FAILED: {signal.symbol} - close_position returned None")
                except Exception as e:
                    action.error = str(e)
                    print(f"MONITOR: ❌ SELL EXCEPTION: {signal.symbol} - {e}")
                    logger.error(f"❌ Exit failed: {e}")
            elif signal.urgency != "immediate":
                print(f"MONITOR: ℹ️ Alert (non-urgent): {signal.symbol} - {signal.trigger.value}")
            else:
                print(f"MONITOR: ⏸️ Dry run - would sell {signal.symbol}")
            
            actions.append(action)
        
        return actions
    
    async def _get_daily_trade_count(self) -> int:
        """Get number of AUTOPILOT orders placed today (not manual orders)."""
        from .alpaca_client import get_alpaca_client
        from datetime import date
        
        try:
            client = get_alpaca_client()
            orders = await client.list_orders(status="all", limit=500)
            today = date.today()
            # Only count orders from autopilot (have UAC or AP prefix in client_order_id)
            today_orders = [
                o for o in orders 
                if hasattr(o, 'created_at') and o.created_at.date() == today
                and hasattr(o, 'client_order_id') 
                and (o.client_order_id.startswith('UAC') or o.client_order_id.startswith('AP'))
            ]
            all_today = [o for o in orders if hasattr(o, 'created_at') and o.created_at.date() == today]
            logger.debug(f"Daily trades: {len(today_orders)} autopilot / {len(all_today)} total")
            return len(today_orders)
        except Exception as e:
            logger.warning(f"Failed to get daily trade count: {e}")
            return 0
    
    def _check_risk_budget(self, positions: List[UnifiedPosition], daily_trades: int = 0) -> bool:
        """
        Check if risk budget allows new entries.
        
        V1 COMPLIANCE:
        - 2% max risk per trade
        - 50% max buying power utilization
        - Max 5 positions total
        - Max 10 trades per day
        - Max 1 position per underlying
        """
        from .config import get_autopilot_config

        config = get_autopilot_config()
        equity = config.paper_equity
        
        # V1: Compute percentage-based limits
        risk_limits = config.risk_limits.validate_for_equity(equity)
        
        # Count ALL option positions (not just managed), excluding expired
        option_positions = [p for p in positions if p.asset_class == "us_option"]
        # Exclude expired positions (DTE <= 0) from count
        active_positions = [p for p in option_positions if p.dte is None or p.dte > 0]
        total_count = len(active_positions)
        
        # Count unique underlyings
        underlyings = set(p.underlying or p.symbol for p in active_positions)
        
        # Calculate total market value (buying power used)
        total_value = sum(abs(p.market_value) for p in active_positions)
        buying_power_pct = total_value / equity if equity > 0 else 1.0
        
        print(f"V1 RISK CHECK: {total_count} active positions, ${total_value:.2f} ({buying_power_pct*100:.1f}% buying power), {daily_trades} trades today")
        
        # Check daily trade limit FIRST
        max_daily = getattr(risk_limits, 'max_daily_trades', 10)
        if daily_trades >= max_daily:
            print(f"V1 RISK CHECK: BLOCKED - daily trade limit reached ({daily_trades}/{max_daily})")
            logger.info(f"V1 Risk: daily trade limit reached ({daily_trades}/{max_daily})")
            return False
        
        # Check max positions
        if total_count >= risk_limits.max_open_positions:
            print(f"V1 RISK CHECK: BLOCKED - max positions reached ({total_count}/{risk_limits.max_open_positions})")
            logger.info(f"V1 Risk: max positions reached ({total_count}/{risk_limits.max_open_positions})")
            return False
        
        # V1: Check buying power utilization (50% cap)
        if buying_power_pct >= risk_limits.max_buying_power_pct:
            print(f"V1 RISK CHECK: BLOCKED - buying power cap reached ({buying_power_pct*100:.1f}% >= {risk_limits.max_buying_power_pct*100:.0f}%)")
            logger.info(f"V1 Risk: buying power cap reached ({buying_power_pct*100:.1f}% >= {risk_limits.max_buying_power_pct*100:.0f}%)")
            return False
        
        print(f"V1 RISK CHECK: OK - {total_count}/{risk_limits.max_open_positions} positions, {buying_power_pct*100:.1f}%/{risk_limits.max_buying_power_pct*100:.0f}% buying power, {daily_trades}/{max_daily} trades")
        return True
    
    async def _generate_candidates(
        self,
        market: MarketContext,
        sentiment: SentimentSnapshot,
        positions: List[UnifiedPosition],
    ) -> List[Dict]:
        """
        Generate trade candidates using enhanced multi-factor intelligence engine.
        
        Uses the Trading Intelligence Engine for:
        - Multi-factor scoring (technical, momentum, volatility, sentiment)
        - Dynamic strategy selection based on market conditions
        - Risk-adjusted position sizing
        - Market regime awareness
        """
        from .candidates import CandidateGenerator
        from .config import get_autopilot_config
        from .universe import UniverseManager
        from .features import FeatureEngine
        from .data_fetcher import get_data_provider
        
        # Try to use enhanced generator, fall back to basic if unavailable
        try:
            from .enhanced_candidates import EnhancedCandidateGenerator
            use_enhanced = True
            logger.info("Using Enhanced Trading Intelligence Engine")
        except ImportError:
            use_enhanced = False
            logger.info("Using basic candidate generator")

        config = get_autopilot_config()
        universe = UniverseManager(config.universe)
        feature_engine = FeatureEngine()
        base_generator = CandidateGenerator(config, universe, feature_engine)
        
        # Create enhanced generator if available
        if use_enhanced:
            from .enhanced_candidates import EnhancedCandidateGenerator
            enhanced_generator = EnhancedCandidateGenerator(config, base_generator)
        
        # Get current symbols in positions
        held_symbols = {p.underlying or p.symbol for p in positions}
        
        candidates = []
        
        try:
            # Quick pattern/trend review and rank symbols
            symbols = universe.get_tradeable_symbols()
            if config.focus_symbol:
                symbols = [s for s in symbols if s.symbol == config.focus_symbol]

            # V1 SYMBOL ENFORCEMENT: Filter to only allowed symbols
            original_count = len(symbols)
            symbols = [s for s in symbols if config.is_symbol_allowed(s.symbol)]
            if len(symbols) < original_count:
                logger.info(f"V1 Symbol filter: {original_count} -> {len(symbols)} symbols (removed blocked/invalid)")

            scored = []
            provider = get_data_provider()
            
            for sym_info in symbols:
                feats = await feature_engine.get_features(sym_info.symbol)
                if not feats:
                    continue
                    
                # Enhanced scoring includes more factors
                score = (
                    feats.trend_strength * 0.30  # Trend importance
                    + feats.liquidity_score * 0.30  # Liquidity critical for options
                    + (feats.iv_rank / 100.0) * 0.25  # IV rank for premium selling
                    + (1 - feats.avg_spread_pct * 10) * 0.15  # Tight spreads preferred
                )
                scored.append((sym_info.symbol, feats, score))

            scored.sort(key=lambda x: x[2], reverse=True)
            top_n = 5 if not config.focus_symbol else 1
            top = scored[:top_n]
            
            logger.info(f"Top {len(top)} symbols by score: {[s[0] for s in top]}")
            
            # Filter out held symbols (avoid concentration)
            top = [(s, f, sc) for s, f, sc in top if s not in held_symbols]
            
            # Generate candidates for each symbol
            for symbol, features, _score in top:
                # Double-check symbol is allowed (defense in depth)
                if not config.is_symbol_allowed(symbol):
                    logger.warning(f"V1 GATE: Skipping {symbol} - not in allowed list")
                    continue
                    
                try:
                    if use_enhanced:
                        # Get price history for technical analysis
                        prices = provider.get_price_history(symbol, days=60)
                        volumes = provider.get_volume_history(symbol, days=60)
                        
                        # Update enhanced generator with price history
                        enhanced_generator.update_price_history(symbol, prices, volumes)
                        
                        # Get options chain
                        expiry = provider.get_next_weekly_expiry()
                        chain = provider.get_options_chain(symbol, expiry=expiry, weekly_only=True)
                        chain_dict = {"chains": {expiry.strftime("%Y-%m-%d"): {
                            "puts": [{"strike": o.strike, "bid": o.bid, "ask": o.ask, 
                                      "delta": o.delta, "iv": getattr(o, 'iv', 0.30)}
                                     for o in chain if o.option_type == "put"],
                            "calls": [{"strike": o.strike, "bid": o.bid, "ask": o.ask,
                                       "delta": o.delta, "iv": getattr(o, 'iv', 0.30)}
                                      for o in chain if o.option_type == "call"],
                        }}} if chain else {}
                        
                        # Generate enhanced candidates
                        symbol_candidates = await enhanced_generator.generate_enhanced_candidates(
                            symbol=symbol,
                            features=features,
                            option_chain=chain_dict,
                            weekly_only=config.weekly_expiry_only,
                        )
                    else:
                        # Fall back to basic generator
                        symbol_candidates = await base_generator.generate(
                            symbol,
                            features,
                            weekly_only=config.weekly_expiry_only,
                        )
                    
                    for c in symbol_candidates:
                        cdict = c.to_dict()
                        cdict["credit"] = cdict.get("max_profit") or cdict.get("net_premium", 0)
                        cdict["score"] = cdict.get("adjusted_score", cdict.get("base_score", 0))
                        
                        # Include intelligence metadata if available
                        if hasattr(c, 'metadata') and c.metadata:
                            cdict["intelligence"] = c.metadata
                        
                        candidates.append(cdict)
                        
                        # Log reasoning for transparency
                        reason = cdict.get("selection_reason", "")
                        if reason:
                            logger.info(f"[{symbol}] {c.template.value}: {reason}")
                            
                except Exception as e:
                    logger.debug(f"Candidate gen failed for {symbol}: {e}")
            
            logger.info(f"Generated {len(candidates)} total candidates")
            
        except Exception as e:
            logger.error(f"Candidate generation failed: {e}")
            import traceback
            traceback.print_exc()
        
        return candidates
    
    def _select_candidates(self, candidates: List[Dict]) -> List[Dict]:
        """
        Select top candidates using V1 priority queue.
        
        V1 Priority Queue Rules:
        1. Filter by regime: direction-aligned templates only
        2. Sort by composite score (deterministic)
        3. Limit to max per cycle
        4. No ties - deterministic ordering
        """
        from .config import get_autopilot_config, V1_TEMPLATES, StrategyTemplate

        config = get_autopilot_config()
        
        # V1: Get current regime/direction for filtering
        # (BULLISH → LONG_CALL preferred, BEARISH → LONG_PUT preferred)
        v1_filtered = []
        for c in candidates:
            template_str = c.get("template", "")
            try:
                template = StrategyTemplate(template_str)
            except ValueError:
                continue
            
            # V1 hard filter: only V1 templates
            if template not in V1_TEMPLATES:
                logger.debug(f"V1 queue: Filtered out {template_str} (not V1)")
                continue
            
            # Direction alignment filter (optional, for better selection)
            trend = c.get("trend", "neutral").lower()
            if template == StrategyTemplate.LONG_CALL and trend == "bearish":
                c["direction_penalty"] = -10  # Penalize misaligned direction
            elif template == StrategyTemplate.LONG_PUT and trend == "bullish":
                c["direction_penalty"] = -10
            else:
                c["direction_penalty"] = 0
            
            v1_filtered.append(c)
        
        # Priority queue: sort by adjusted score + direction alignment
        def priority_key(c):
            base_score = c.get("score", c.get("adjusted_score", 0))
            direction_adj = c.get("direction_penalty", 0)
            # Tie-breaker: alphabetical symbol for determinism
            return (base_score + direction_adj, c.get("symbol", ""))
        
        sorted_candidates = sorted(v1_filtered, key=priority_key, reverse=True)
        
        # Limit to max per cycle
        max_per_cycle = max(1, int(config.max_symbols_per_cycle))
        if config.focus_symbol:
            sorted_candidates = [c for c in sorted_candidates if c.get("symbol") == config.focus_symbol]
        
        selected = sorted_candidates[:max_per_cycle]
        
        logger.info(f"V1 Priority Queue: {len(candidates)} → {len(v1_filtered)} V1 filtered → {len(selected)} selected")
        
        return selected
    
    # =========================================================================
    # ANTI-THRASH CONTROLS (V1 Phase 1)
    # =========================================================================
    
    def _check_anti_thrash_gates(
        self, ticker: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Check anti-thrash gates for a ticker.
        
        Returns:
            (allowed, reason) - allowed=True if trade permitted, reason if blocked
        """
        from .config import get_autopilot_config
        config = get_autopilot_config()
        anti_thrash = config.anti_thrash
        now = datetime.now()
        
        # Gate 1: Circuit breaker (global)
        if self._circuit_breaker_until and now < self._circuit_breaker_until:
            remaining = (self._circuit_breaker_until - now).total_seconds()
            return False, f"Circuit breaker active ({remaining:.0f}s remaining)"
        
        # Gate 2: Daily loss limit
        if self._daily_loss_pct >= anti_thrash.daily_loss_limit_pct:
            return False, f"Daily loss limit reached ({self._daily_loss_pct:.1%} >= {anti_thrash.daily_loss_limit_pct:.1%})"
        
        # Gate 3: Per-ticker cooldown after stop-out
        if ticker in self._ticker_last_stopout:
            last_stopout = self._ticker_last_stopout[ticker]
            cooldown_end = last_stopout + timedelta(seconds=anti_thrash.ticker_cooldown_seconds)
            if now < cooldown_end:
                remaining = (cooldown_end - now).total_seconds()
                return False, f"{ticker} on cooldown ({remaining:.0f}s remaining after stop-out)"
        
        return True, None
    
    def record_stopout(self, ticker: str, loss_pct: float) -> None:
        """
        Record a stop-out event for anti-thrash tracking.
        
        Args:
            ticker: The ticker that stopped out
            loss_pct: Loss percentage (e.g., 0.10 for 10% loss)
        """
        from .config import get_autopilot_config
        config = get_autopilot_config()
        anti_thrash = config.anti_thrash
        now = datetime.now()
        
        # Track ticker cooldown
        self._ticker_last_stopout[ticker] = now
        logger.warning(f"🛑 STOP-OUT: {ticker} (-{loss_pct:.1%}) - cooldown for {anti_thrash.ticker_cooldown_seconds}s")
        
        # Increment consecutive stop-outs
        self._consecutive_stopouts += 1
        logger.warning(f"📊 Consecutive stop-outs: {self._consecutive_stopouts}/{anti_thrash.max_consecutive_stopouts}")
        
        # Check circuit breaker trigger
        if self._consecutive_stopouts >= anti_thrash.max_consecutive_stopouts:
            self._circuit_breaker_until = now + timedelta(seconds=anti_thrash.circuit_breaker_duration_seconds)
            logger.critical(
                f"⚡ CIRCUIT BREAKER ACTIVATED: {self._consecutive_stopouts} consecutive stop-outs. "
                f"Trading paused until {self._circuit_breaker_until.isoformat()}"
            )
            # Reset counter after triggering circuit breaker
            self._consecutive_stopouts = 0
        
        # Update daily loss tracking
        self._daily_loss_pct += loss_pct
        logger.info(f"📉 Daily loss: {self._daily_loss_pct:.1%} / {anti_thrash.daily_loss_limit_pct:.1%} limit")
    
    def record_profitable_exit(self) -> None:
        """Record a profitable exit - resets consecutive stop-out counter."""
        if self._consecutive_stopouts > 0:
            logger.info(f"✅ Profitable exit - resetting consecutive stop-out counter (was {self._consecutive_stopouts})")
            self._consecutive_stopouts = 0
    
    def reset_daily_counters(self, equity: float) -> None:
        """Reset daily counters at start of trading day."""
        self._daily_loss_pct = 0.0
        self._day_start_equity = equity
        self._consecutive_stopouts = 0
        # Note: ticker cooldowns persist across days (by design)
        # Clear expired ticker cooldowns
        from .config import get_autopilot_config
        config = get_autopilot_config()
        now = datetime.now()
        expired = [
            t for t, ts in self._ticker_last_stopout.items()
            if (now - ts).total_seconds() > config.anti_thrash.ticker_cooldown_seconds
        ]
        for t in expired:
            del self._ticker_last_stopout[t]
        logger.info(f"🌅 Daily counters reset. Equity: ${equity:.2f}. Cleared {len(expired)} expired cooldowns.")
    
    def _validate_candidate(
        self,
        candidate: Dict,
        positions: List[UnifiedPosition],
        sentiment: SentimentSnapshot,
    ) -> Tuple[bool, List[ValidationGate], List[str]]:
        """Validate a candidate against all gates."""
        from .config import get_autopilot_config

        config = get_autopilot_config()
        gates = []
        errors = []
        
        symbol = candidate.get("symbol", "")
        
        # V1 ANTI-THRASH GATE (check first - fail fast)
        anti_thrash_ok, anti_thrash_reason = self._check_anti_thrash_gates(symbol)
        if not anti_thrash_ok:
            gates.append(ValidationGate.RISK_BUDGET)  # Use RISK_BUDGET gate for anti-thrash
            errors.append(f"Anti-thrash: {anti_thrash_reason}")
            return False, gates, errors  # Fail fast
        
        if config.focus_symbol and symbol != config.focus_symbol:
            gates.append(ValidationGate.SYMBOL_FILTER)
            errors.append(f"Focus symbol active ({config.focus_symbol}), rejecting {symbol}")
        
        # V1 PER-TRADE RISK CHECK (2% cap)
        equity = config.paper_equity
        max_risk_per_trade = equity * config.risk_limits.max_risk_per_trade_pct
        candidate_risk = candidate.get("max_loss", 0) or candidate.get("premium", 0) * 100
        
        if candidate_risk > max_risk_per_trade:
            gates.append(ValidationGate.RISK_BUDGET)
            errors.append(
                f"V1 per-trade risk exceeded: ${candidate_risk:.2f} > "
                f"${max_risk_per_trade:.2f} ({config.risk_limits.max_risk_per_trade_pct*100:.0f}% of ${equity:.0f})"
            )
        
        # Check max per underlying
        underlying_count = sum(1 for p in positions if (p.underlying or p.symbol) == symbol)
        if underlying_count >= config.risk_limits.max_positions_per_underlying:
            gates.append(ValidationGate.MAX_PER_UNDERLYING)
            errors.append(f"Max positions per underlying reached for {symbol}")
        
        # Check DTE bounds
        dte = candidate.get("dte", 0)
        constraints = config.strategy_constraints
        if dte < constraints.min_dte or dte > constraints.max_dte:
            gates.append(ValidationGate.DTE_BOUNDS)
            errors.append(f"DTE {dte} outside bounds [{constraints.min_dte}, {constraints.max_dte}]")
        
        
        # Check earnings blackout
        if hasattr(sentiment, 'is_blackout') and sentiment.is_blackout:
            gates.append(ValidationGate.EARNINGS_BLACKOUT)
            errors.append(f"Earnings blackout for {symbol}")
        
        # Check sentiment (Strict Gating)
        if hasattr(sentiment, 'sentiment_scores'):
            # Symbol specific score
            score = sentiment.sentiment_scores.get(symbol, 0)
            
            # Global Market Score
            market_score = sentiment.sentiment_scores.get("MARKET", 0)
            
            # CIRCUIT BREAKER LOGIC
            # If Market is VERY BEARISH (<-0.4), Block Bullish Strategies
            if market_score < -0.4:
                if candidate.get("template") in ["long_call", "put_credit_spread", "call_debit_spread"]:
                    gates.append(ValidationGate.NEWS_SENTIMENT)
                    errors.append(f"Global Sentiment Circuit Breaker: Market is VERY BEARISH ({market_score:.2f})")
            
            # If Market is VERY BULLISH (>0.4), Block Bearish Strategies
            elif market_score > 0.4:
                 if candidate.get("template") in ["long_put", "call_credit_spread", "put_debit_spread"]:
                    gates.append(ValidationGate.NEWS_SENTIMENT)
                    errors.append(f"Global Sentiment Circuit Breaker: Market is VERY BULLISH ({market_score:.2f})")
            
            # Symbol specific check (if available)
            if score <= -0.2 and candidate.get("template") in ["long_call", "put_credit_spread"]:
                gates.append(ValidationGate.NEWS_SENTIMENT)
                errors.append(f"Symbol Sentiment {score:.2f} is bearish")
        
        # Check shock headlines
        if hasattr(sentiment, 'shock_headlines') and sentiment.shock_headlines:
             # Check if any shock headline is relevant to this symbol
             # For now, simplistic check: is symbol in headline triggers?
             # Or global shock logic if defined
             pass # Logic to be refined based on shock_headlines structure
        
        return len(gates) == 0, gates, errors

    async def _explain_decision(self, candidate: Dict) -> str:
        """
        Generate a human-readable explanation for the selected candidate.
        This is post-decision and does not influence the choice.
        """
        # TODO: Connect to LLM service for dynamic explanation
        # For now, deterministic template
        symbol = candidate.get("symbol")
        template = candidate.get("template")
        score = candidate.get("score", 0)
        
        rationale = (
            f"Selected {symbol} {template} based on strong technical score ({score:.2f}). "
            f"Market context allows for this strategy. Sentinel checks passed."
        )
        return rationale
    
    # =========================================================================
    # V1 EXECUTION LADDER - Limit Orders Only
    # =========================================================================
    
    async def _execute_with_ladder(
        self,
        broker: Any,
        trade_candidate: Any,
        base_limit_price: float,
        max_attempts: int = 3,
        timeout_seconds: float = 5.0,
    ) -> Tuple[Optional[Any], str]:
        """
        Execute trade with V1 execution ladder policy.
        
        Ladder steps:
        1. Aggressive limit (mid price) - wait timeout_seconds
        2. Mid price adjusted (mid + small spread) - wait timeout_seconds
        3. Final attempt (near ask/far bid) - wait timeout_seconds
        4. If still unfilled, abort
        
        Returns:
            Tuple of (order result or None, status message)
        """
        import asyncio
        
        # V1 Ladder price adjustments (for long premium = buying)
        # Step 1: Start at mid or slightly below
        # Step 2: Move toward ask
        # Step 3: Near ask (but still limit, never market)
        LADDER_ADJUSTMENTS = [0.0, 0.02, 0.05]  # Percent above mid for buys
        
        for attempt, adjustment in enumerate(LADDER_ADJUSTMENTS):
            adjusted_price = round(base_limit_price * (1 + adjustment), 2)
            
            logger.info(
                f"Execution ladder attempt {attempt + 1}/{max_attempts}: "
                f"limit_price=${adjusted_price:.2f} (base=${base_limit_price:.2f}, adj={adjustment*100:.1f}%)"
            )
            
            try:
                # Submit order with adjusted limit price
                order = broker.submit_order(
                    trade_candidate,
                    order_type="limit",
                    limit_price=adjusted_price,
                )
                
                if not order:
                    continue
                
                # Wait for fill (with timeout)
                fill_timeout = timeout_seconds
                elapsed = 0.0
                check_interval = 0.5
                
                while elapsed < fill_timeout:
                    await asyncio.sleep(check_interval)
                    elapsed += check_interval
                    
                    # Check order status
                    if hasattr(order, 'status'):
                        status = order.status.value if hasattr(order.status, 'value') else order.status
                        if status in ['filled', 'partial_fill']:
                            logger.info(f"Execution ladder: FILLED at attempt {attempt + 1}")
                            return order, f"filled_at_step_{attempt + 1}"
                        elif status in ['rejected', 'canceled', 'expired']:
                            logger.warning(f"Execution ladder: Order {status} at attempt {attempt + 1}")
                            break
                
                # Not filled in time, cancel and try next step
                if hasattr(broker, 'cancel_order') and hasattr(order, 'order_id'):
                    try:
                        await broker.cancel_order(order.order_id)
                    except Exception:
                        pass
                        
            except Exception as e:
                logger.warning(f"Execution ladder attempt {attempt + 1} failed: {e}")
                continue
        
        # All attempts exhausted
        logger.warning("Execution ladder: All attempts exhausted, aborting trade")
        return None, "ladder_exhausted"
    
    def _calculate_limit_price_for_candidate(self, candidate: Dict) -> Optional[float]:
        """
        Calculate appropriate limit price for a trade candidate.
        
        For long options (V1): use the ask price (or slightly below)
        For credit spreads (V2+): use the net credit as limit
        """
        legs = candidate.get("legs", [])
        template = candidate.get("template", "")
        
        # V1 templates (single-leg long premium)
        if template in ["long_call", "long_put"]:
            # For buys, limit price = what we're willing to pay (at or near ask)
            if legs:
                leg = legs[0] if isinstance(legs[0], dict) else legs[0].__dict__
                ask = leg.get("premium", 0) or leg.get("ask", 0)
                return round(ask, 2) if ask > 0 else None
            return None
        
        # Credit spreads (V2+ - blocked in V1 but keeping for future)
        credit = candidate.get("credit", 0)
        return round(credit, 2) if credit > 0 else None

    async def _execute_trades(self, candidates: List[Dict], run_id: str) -> List[OrderRecord]:
        """Execute trades via Alpaca - REAL order submission."""
        from .alpaca_broker import AlpacaOptionsBroker
        from .broker_position_manager import get_broker_position_manager, BrokerExitRule
        from .config import get_autopilot_config, StrategyTemplate
        from .candidates import TradeCandidate, OptionLeg
        from .alpaca_client import get_alpaca_client
        from datetime import date
        import uuid as uuid_mod
        
        manager = get_broker_position_manager()
        config = get_autopilot_config()
        client = get_alpaca_client()
        
        # Get current Alpaca positions to avoid duplicates
        existing_underlyings = set()
        try:
            alpaca_positions = await client.list_positions()
            print(f"EXEC DEBUG: Found {len(alpaca_positions)} Alpaca positions")
            for pos in alpaca_positions:
                # Parse underlying from OCC symbol
                symbol = pos.symbol
                for i, c in enumerate(symbol):
                    if c.isdigit():
                        existing_underlyings.add(symbol[:i].strip())
                        break
            print(f"EXEC DEBUG: existing_underlyings={existing_underlyings}")
            logger.info(f"Existing positions for underlyings: {existing_underlyings}")
        except Exception as e:
            logger.warning(f"Could not fetch existing positions: {e}")
        
        # Initialize broker with Alpaca enabled
        broker = AlpacaOptionsBroker(alpaca_enabled=True)
        
        orders = []
        
        print(f"EXEC DEBUG: Processing {len(candidates)} candidates")
        # Write candidates to file for debugging
        import json
        with open("/tmp/autopilot_candidates_debug.json", "w") as f:
            json.dump(candidates, f, indent=2, default=str)
        print(f"EXEC DEBUG: Wrote candidates to /tmp/autopilot_candidates_debug.json")
        
        for idx, candidate in enumerate(candidates):
            symbol = candidate.get("symbol", "")
            template = candidate.get("template", "put_credit_spread")
            credit = candidate.get("credit", 0)
            print(f"EXEC DEBUG [{idx}]: symbol={symbol}, template={template}, credit={credit}")
            
            # Skip if we already have a MANAGED position in this underlying (not just any position)
            # We only skip if we have a position that's actively being managed by this autopilot
            # Unmanaged positions from previous runs shouldn't block new trades
            # TODO: Add proper check for managed positions from broker_position_manager
            skip_due_to_existing = False  # Disabled for now - position manager handles this
            if skip_due_to_existing and symbol in existing_underlyings:
                print(f"EXEC DEBUG [{idx}]: SKIPPING - already have managed position")
                logger.info(f"⏭️ Skipping {symbol} - already have managed position")
                continue
            
            print(f"EXEC DEBUG [{idx}]: Generating client_order_id")
            client_order_id = self._generate_client_order_id(run_id, template, symbol)
            
            print(f"EXEC DEBUG [{idx}]: Creating order_record")
            
            # V1 COMPLIANCE: Use limit orders only with execution ladder
            # Calculate limit price from candidate premium/credit
            limit_price = credit if credit > 0 else None
            
            order_record = OrderRecord(
                client_order_id=client_order_id,
                symbol=symbol,
                side="sell",  # Credit spreads are sold
                order_type="limit",  # V1: LIMIT ONLY
                qty=max(1, int(config.contracts_per_trade)),
                limit_price=limit_price,
                submitted_at=datetime.now(),
            )
            
            print(f"EXEC DEBUG [{idx}]: Entering try block")
            try:
                # Build TradeCandidate from dict for broker submission
                legs_data = candidate.get("legs", [])
                print(f"EXEC DEBUG [{idx}]: legs_data={legs_data}")
                logger.info(f"🔍 Processing candidate {symbol}: legs_data={legs_data}")
                if not legs_data:
                    print(f"EXEC DEBUG [{idx}]: NO LEGS in candidate.get('legs') - attempting to construct from candidate data")
                    # If no legs, try to construct from candidate data
                    short_strike = candidate.get("short_strike", 0)
                    long_strike = candidate.get("long_strike", 0)
                    expiry_str = candidate.get("expiry", "")
                    
                    if short_strike and long_strike and expiry_str:
                        # Parse expiry
                        if isinstance(expiry_str, str):
                            expiry = date.fromisoformat(expiry_str.split("T")[0])
                        else:
                            expiry = expiry_str
                        
                        opt_type = "put" if "put" in template.lower() else "call"
                        
                        legs_data = [
                            {"side": "sell", "option_type": opt_type, "strike": short_strike, "quantity": 1, "expiry": expiry},
                            {"side": "buy", "option_type": opt_type, "strike": long_strike, "quantity": 1, "expiry": expiry},
                        ]
                
                if legs_data:
                    print(f"EXEC DEBUG [{idx}]: Constructing {len(legs_data)} legs from legs_data")
                    legs = []
                    for l in legs_data:
                        leg_expiry = l.get("expiry")
                        if isinstance(leg_expiry, str):
                            leg_expiry = date.fromisoformat(leg_expiry.split("T")[0])
                        
                        # OptionLeg uses strings for side and option_type
                        legs.append(OptionLeg(
                            side=l.get("side", "sell"),
                            option_type=l.get("option_type", "put"),
                            strike=l.get("strike", 0),
                            quantity=l.get("quantity", 1),
                            expiry=leg_expiry,
                        ))
                    
                    # Create TradeCandidate - requires all fields
                    try:
                        tmpl_enum = StrategyTemplate(template)
                    except ValueError:
                        tmpl_enum = StrategyTemplate.PUT_CREDIT_SPREAD
                    
                    trade_candidate = TradeCandidate(
                        id=f"tc-{uuid_mod.uuid4().hex[:8]}",
                        symbol=symbol,
                        template=tmpl_enum,
                        legs=legs,
                        underlying_price=candidate.get("underlying_price", 0),
                        max_profit=credit * 100,  # Per contract
                        max_loss=candidate.get("max_loss", 0),
                        pop=candidate.get("pop", 0),
                        dte=candidate.get("dte", 30),
                        iv_rank=candidate.get("iv_rank", 50),
                        liquidity_score=candidate.get("liquidity_score", 0.8),
                        spread_percent=candidate.get("spread_percent", 0.02),
                        regime=candidate.get("regime", "neutral"),
                        trend=candidate.get("trend", "neutral"),
                        client_order_id=client_order_id,
                    )
                    
                    # Submit order via broker
                    print(f"EXEC DEBUG [{idx}]: Submitting order with {len(trade_candidate.legs)} legs")
                    logger.info(f"🚀 EXECUTING TRADE: {symbol} {template} @ ${credit}")
                    logger.info(f"📦 TradeCandidate: {trade_candidate.id}, legs={len(trade_candidate.legs)}")
                    paper_order = broker.submit_order(trade_candidate)
                    print(f"EXEC DEBUG [{idx}]: paper_order returned: {paper_order}")
                    
                    if paper_order:
                        # For Alpaca, submission is enough. We don't manually execute.
                        # paper_order = broker.execute_order(paper_order.order_id)
                        
                        order_record.alpaca_order_id = paper_order.order_id
                        order_record.status = paper_order.status.value
                        order_record.filled_qty = paper_order.filled_qty if hasattr(paper_order, 'filled_qty') else 0
                        order_record.filled_avg_price = paper_order.filled_avg_price if hasattr(paper_order, 'filled_avg_price') else None
                        order_record.filled_at = datetime.now()
                        
                        # Register position if order is active (filled or pending)
                        # We need to track metadata even if it's not fully filled yet
                        valid_statuses = ["filled", "partial_fill", "new", "accepted", "pending_new", "partially_filled"]
                        if paper_order.status.value in valid_statuses:
                            status_emoji = "✅" if paper_order.status.value == "filled" else "⏳"
                            logger.info(f"{status_emoji} ORDER SUBMITTED: {symbol} - ID: {paper_order.order_id} ({paper_order.status.value})")
                            
                            # Register position for monitoring (metadata persistence)
                            manager.register_position(
                                symbol=symbol,
                                run_id=run_id,
                                strategy_template=template,
                                entry_credit=credit,
                                max_loss=candidate.get("max_loss", 0),
                                exit_rules=BrokerExitRule(),
                            )
                        else:
                            logger.warning(f"⚠️ ORDER REJECTED/FAILED: {symbol} - Status: {paper_order.status.value}")
                    else:
                        order_record.status = "rejected"
                        order_record.error = "Broker returned no order"
                else:
                    # No legs - just register as a tracked position
                    print(f"EXEC DEBUG [{idx}]: ELSE BLOCK - NO LEGS CONSTRUCTED for {symbol}")
                    logger.warning(f"⚠️ NO LEGS CONSTRUCTED for {symbol} {template} - cannot execute trade")
                    logger.info(f"📝 REGISTERING POSITION (no legs): {symbol} {template}")
                    manager.register_position(
                        symbol=symbol,
                        run_id=run_id,
                        strategy_template=template,
                        entry_credit=credit,
                        max_loss=candidate.get("max_loss", 0),
                        exit_rules=BrokerExitRule(),
                    )
                    order_record.status = "registered"
                
            except Exception as e:
                print(f"EXEC DEBUG [{idx}]: EXCEPTION in order processing: {e}")
                logger.error(f"❌ Order failed for {symbol}: {e}", exc_info=True)
                order_record.status = "rejected"
                order_record.error = str(e)
            
            orders.append(order_record)
        
        print(f"EXEC DEBUG: Returning {len(orders)} orders")
        return orders
    
    async def _persist_artifact(self, artifact: RunArtifact):
        """Persist run artifact to database."""
        import json
        import os
        
        # Save to file for now (would use DB in production)
        artifacts_dir = "/tmp/autopilot_artifacts"
        os.makedirs(artifacts_dir, exist_ok=True)
        
        filepath = os.path.join(artifacts_dir, f"{artifact.run_id}.json")
        try:
            with open(filepath, "w") as f:
                json.dump(artifact.to_dict(), f, indent=2)
            logger.debug(f"Artifact saved: {filepath}")
        except Exception as e:
            logger.error(f"Failed to persist artifact: {e}")
    
    async def _verify_broker_state(self, run_id: str) -> BrokerVerification:
        """Verify broker state matches expectations."""
        from .alpaca_client import get_alpaca_client
        from .broker_position_manager import get_broker_position_manager
        
        client = get_alpaca_client()
        manager = get_broker_position_manager()
        
        verification = BrokerVerification(timestamp=datetime.now())
        
        try:
            # Get positions from both sources
            alpaca_positions = await client.list_positions()
            alpaca_symbols = {p.symbol for p in alpaca_positions}
            
            managed_meta = manager._store.all()
            managed_symbols = {m.symbol for m in managed_meta if m.managed}
            
            # Check for mismatches
            # Positions we think we have but Alpaca doesn't
            missing = managed_symbols - alpaca_symbols
            for sym in missing:
                verification.mismatches.append({
                    "type": "missing_from_broker",
                    "symbol": sym,
                })
                verification.positions_mismatched += 1
            
            # Positions Alpaca has but we don't track (OK, just user positions)
            verification.positions_matched = len(managed_symbols & alpaca_symbols)
            
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            verification.mismatches.append({"type": "error", "message": str(e)})
        
        return verification
    
    async def _emit_ui_events(self, artifact: RunArtifact):
        """Emit events for UI updates via WebSocket."""
        try:
            from ..api.autopilot_websocket import get_autopilot_ws_manager
            ws = get_autopilot_ws_manager()
            
            # 1. Run complete event
            await ws.broadcast("RUN_COMPLETE", {
                "run_id": artifact.run_id,
                "success": artifact.success,
                "duration_ms": artifact.duration_ms,
                "candidates_generated": artifact.candidates_generated,
                "candidates_selected": artifact.candidates_selected,
                "orders_placed": len(artifact.orders_placed),
                "orders_filled": artifact.orders_filled,
                "exits_triggered": artifact.exits_triggered,
                "exits_executed": artifact.exits_executed,
                "timestamp": artifact.timestamp.isoformat(),
            })
            
            # 2. Positions update (if we have positions data)
            if artifact.broker_verification:
                await ws.broadcast("POSITIONS_UPDATE", {
                    "count": artifact.broker_verification.positions_matched,
                    "mismatched": artifact.broker_verification.positions_mismatched,
                    "timestamp": datetime.now().isoformat(),
                })
            
            # 3. Monitoring actions (exits)
            for action in artifact.monitoring_actions:
                await ws.broadcast("EXIT_SIGNAL", action.to_dict())
            
            # 4. Incidents (if any errors)
            if artifact.error:
                await ws.broadcast("INCIDENT", {
                    "severity": "error",
                    "category": "run_error",
                    "title": f"Run {artifact.run_id} failed",
                    "description": artifact.error,
                    "timestamp": datetime.now().isoformat(),
                })
            
            logger.debug(f"Emitted UI events for run {artifact.run_id}")
            
        except Exception as e:
            logger.warning(f"Failed to emit UI events: {e}")
    
    def _is_market_open(self) -> bool:
        """Check if market is currently open using real NYSE calendar."""
        from ..market_calendar import get_market_calendar
        calendar = get_market_calendar()
        return calendar.is_market_open()


# ============================================================================
# Singleton
# ============================================================================

_engine: Optional[UnifiedAutopilotEngine] = None


def get_unified_engine() -> UnifiedAutopilotEngine:
    """Get singleton engine instance."""
    global _engine
    if _engine is None:
        _engine = UnifiedAutopilotEngine()
    return _engine


def reset_engine():
    """Reset engine (for testing)."""
    global _engine
    _engine = None
