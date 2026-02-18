from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime

# ============================================================================
# ENUMS
# ============================================================================

class OptionRight(str, Enum):
    CALL = "CALL"
    PUT = "PUT"

class ActionType(str, Enum):
    ENTER = "ENTER"
    EXIT = "EXIT"
    HOLD = "HOLD"

class ActionReason(str, Enum):
    SIGNAL_ENTRY = "SIGNAL_ENTRY"
    STOP_LOSS = "STOP_LOSS"
    PROFIT_TARGET = "PROFIT_TARGET"
    TIME_STOP = "TIME_STOP"
    EOD_FLATTEN = "EOD_FLATTEN"  # 0DTE/Expire check
    KILL_SWITCH = "KILL_SWITCH"
    NO_SIGNAL = "NO_SIGNAL"
    RISK_BLOCK = "RISK_BLOCK"
    MISSING_DATA = "MISSING_DATA"

# ============================================================================
# SNAPSHOT MODELS (INPUT)
# ============================================================================

@dataclass
class Bar:
    """Single OHLCV bar."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float

@dataclass
class OptionContract:
    """Option contract details."""
    contract_id: str  # Canonical: TICKER|YYYY-MM-DD|C/P|STRIKE
    underlying: str
    expiry: datetime
    strike: float
    right: OptionRight
    bid: float
    ask: float
    mid: float
    delta: Optional[float] = None
    
    @property
    def spread_pct(self) -> float:
        if self.mid == 0: return 0.0
        return (self.ask - self.bid) / self.mid

@dataclass
class PositionView:
    """View of an open position."""
    contract_id: str
    qty: int
    entry_debit: float  # Per share
    current_mid: float  # Per share
    dte: int
    unrealized_pnl_pct: float
    meta: Dict[str, Any] = field(default_factory=dict) # Persisted metadata

@dataclass
class UnderlyingSnapshot:
    """Market data for an underlying."""
    ticker: str
    last_price: float
    bars_daily: List[Bar]  # Rollng 60 day window

@dataclass
class RiskCounters:
    """Current risk utilization."""
    open_positions_count: int = 0
    premium_exposure_used: float = 0.0
    trades_taken_today: int = 0
    daily_pnl_pct: float = 0.0
    kill_switch: bool = False

@dataclass
class Snapshot:
    """Complete input state for the brain (Pure)."""
    cycle_time: datetime
    minutes_to_close: float
    is_market_open: bool
    underlyings: Dict[str, UnderlyingSnapshot]
    options: List[OptionContract]
    positions: List[PositionView]
    risk: RiskCounters

# ============================================================================
# STATE MODELS (PERSISTED)
# ============================================================================

@dataclass
class PositionMeta:
    """Metadata tracked per position key."""
    contract_id: str
    entry_time: str # ISO
    strategy_id: str
    stop_loss_pct: float
    profit_target_pct: float
    max_days_hold: int

@dataclass
class BrainState:
    """Decision engine state preserved across cycles."""
    daily_trade_counter: int = 0
    daily_scan_index: int = 0 # For deterministic tape keying
    last_reset_date: str = "" # YYYY-MM-DD
    position_meta: Dict[str, PositionMeta] = field(default_factory=dict)
    global_cooldown_until: Optional[str] = None # ISO

# ============================================================================
# OUTPUT MODELS
# ============================================================================

@dataclass
class Action:
    """A decision to act."""
    type: ActionType
    contract_id: Optional[str]
    reason: ActionReason
    qty: int = 0
    limit_intent: Optional[float] = None # For entry
    details: str = ""

@dataclass
class Candidate:
    """Internal candidate for ranking."""
    contract: OptionContract
    score: float
    template: str # LONG_CALL / LONG_PUT
    predicted_credit: float
    metadata: Dict[str, Any]

@dataclass
class Explain:
    """Human-readable explanation of the cycle."""
    regime: str
    candidates_count: int
    actions_count: int
    skip_reasons: List[str] = field(default_factory=list)
    top_candidate_details: str = ""
