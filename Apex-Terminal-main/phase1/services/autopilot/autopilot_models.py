"""
Autopilot SQLAlchemy Models

DB-backed persistence for autopilot runs, orders, positions, and incidents.
Uses same SQLite database as the rest of phase1 (phase1.db).
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import declarative_base, relationship
from enum import Enum

Base = declarative_base()


class RunStatus(str, Enum):
    """Status of an autopilot run."""
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OrderStatus(str, Enum):
    """Status of an order."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PositionStatus(str, Enum):
    """Status of a position."""
    OPEN = "open"
    CLOSING = "closing"
    CLOSED = "closed"


class IncidentSeverity(str, Enum):
    """Severity of an incident."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AutopilotRun(Base):
    """Record of an autopilot scan/execution cycle."""
    __tablename__ = "autopilot_runs"
    
    id = Column(String(36), primary_key=True)  # UUID
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default=RunStatus.RUNNING.value)
    
    # Cycle metadata
    phase = Column(String(30), nullable=True)  # Current phase of cycle
    symbols_scanned = Column(Integer, default=0)
    candidates_generated = Column(Integer, default=0)
    candidates_selected = Column(Integer, default=0)
    orders_placed = Column(Integer, default=0)
    positions_closed = Column(Integer, default=0)
    
    # Market context
    market_open = Column(Boolean, default=False)
    regime = Column(String(20), nullable=True)
    
    # Error info
    error_message = Column(Text, nullable=True)
    
    # Full think log (JSON)
    think_log = Column(JSON, nullable=True)
    
    # Relationships
    orders = relationship("AutopilotOrder", back_populates="run")
    candidates = relationship("AutopilotCandidate", back_populates="run")
    
    def __repr__(self):
        return f"<AutopilotRun {self.id[:8]} status={self.status}>"


class AutopilotCandidate(Base):
    """Record of a trade candidate considered during a run."""
    __tablename__ = "autopilot_candidates"
    
    id = Column(String(36), primary_key=True)  # UUID
    run_id = Column(String(36), ForeignKey("autopilot_runs.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Candidate info
    symbol = Column(String(10), nullable=False)
    strategy_template = Column(String(30), nullable=False)
    option_type = Column(String(10), nullable=True)  # call/put
    strike = Column(Float, nullable=True)
    expiry = Column(String(10), nullable=True)  # YYYY-MM-DD
    delta = Column(Float, nullable=True)
    
    # Scoring
    base_score = Column(Float, default=0.0)
    adjusted_score = Column(Float, default=0.0)
    
    # Premium/risk
    premium = Column(Float, nullable=True)  # Cost to enter
    max_loss = Column(Float, nullable=True)
    max_profit = Column(Float, nullable=True)
    dte = Column(Integer, nullable=True)
    
    # Selection outcome
    selected = Column(Boolean, default=False)
    rejection_reasons = Column(JSON, nullable=True)  # List of reasons
    
    # Relationship
    run = relationship("AutopilotRun", back_populates="candidates")
    
    def __repr__(self):
        return f"<AutopilotCandidate {self.symbol} {self.strategy_template}>"


class AutopilotOrder(Base):
    """Record of an order placed by autopilot."""
    __tablename__ = "autopilot_orders"
    
    client_order_id = Column(String(36), primary_key=True)  # Our ID
    run_id = Column(String(36), ForeignKey("autopilot_runs.id"), nullable=True)
    position_id = Column(String(36), ForeignKey("autopilot_positions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Order details
    symbol = Column(String(10), nullable=False)
    occ_symbol = Column(String(30), nullable=True)  # Full OCC symbol for options
    side = Column(String(10), nullable=False)  # buy/sell
    order_type = Column(String(10), nullable=False)  # market/limit
    qty = Column(Integer, nullable=False)
    limit_price = Column(Float, nullable=True)
    
    # Broker info
    alpaca_order_id = Column(String(50), nullable=True)
    status = Column(String(20), default=OrderStatus.PENDING.value)
    
    # Fill info
    filled_qty = Column(Integer, default=0)
    filled_avg_price = Column(Float, nullable=True)
    filled_at = Column(DateTime, nullable=True)
    
    # Error
    error_message = Column(Text, nullable=True)
    
    # Relationships
    run = relationship("AutopilotRun", back_populates="orders")
    position = relationship("AutopilotPosition", back_populates="orders")
    
    def __repr__(self):
        return f"<AutopilotOrder {self.client_order_id[:8]} {self.symbol} {self.side}>"


class AutopilotPosition(Base):
    """Record of an autopilot-managed position."""
    __tablename__ = "autopilot_positions"
    
    id = Column(String(36), primary_key=True)  # UUID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    
    # Position identity
    symbol = Column(String(10), nullable=False)
    occ_symbol = Column(String(30), nullable=True)  # Full OCC symbol
    strategy_template = Column(String(30), nullable=False)
    
    # Entry info
    entry_order_id = Column(String(36), nullable=True)
    entry_qty = Column(Integer, default=0)
    entry_price = Column(Float, nullable=True)  # Avg fill price
    entry_premium = Column(Float, nullable=True)  # Total cost to enter
    
    # Current state
    status = Column(String(20), default=PositionStatus.OPEN.value)
    current_qty = Column(Integer, default=0)
    current_price = Column(Float, nullable=True)  # Mark-to-market
    unrealized_pnl = Column(Float, nullable=True)
    
    # Exit info
    exit_order_id = Column(String(36), nullable=True)
    exit_price = Column(Float, nullable=True)
    exit_reason = Column(String(30), nullable=True)  # stop_loss, profit_target, time_stop, etc
    realized_pnl = Column(Float, nullable=True)
    
    # Exit rules (denormalized for monitoring)
    stop_loss_price = Column(Float, nullable=True)  # Trigger price for stop
    profit_target_price = Column(Float, nullable=True)  # Trigger price for profit
    time_stop_at = Column(DateTime, nullable=True)  # When to flatten
    
    # Relationships
    orders = relationship("AutopilotOrder", back_populates="position")
    
    def __repr__(self):
        return f"<AutopilotPosition {self.symbol} {self.status}>"


class AutopilotIncident(Base):
    """Record of an incident/error/alert during autopilot operation."""
    __tablename__ = "autopilot_incidents"
    
    id = Column(String(36), primary_key=True)  # UUID
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Incident info
    severity = Column(String(10), default=IncidentSeverity.WARNING.value)
    category = Column(String(30), nullable=False)  # broker_error, data_error, risk_limit, kill_switch
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Context
    run_id = Column(String(36), nullable=True)
    symbol = Column(String(10), nullable=True)
    
    # Resolution
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)
    
    def __repr__(self):
        return f"<AutopilotIncident {self.severity} {self.category}>"


class LLMLog(Base):
    """
    Audit log for every LLM interaction.
    Phase 1, Layer 4: Hallucination Prevention Record.
    """
    __tablename__ = "autopilot_llm_logs"
    
    id = Column(String(36), primary_key=True)  # UUID
    run_id = Column(String(36), ForeignKey("autopilot_runs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Provider Info
    provider = Column(String(50), nullable=False)  # groq, gemini
    model = Column(String(50), nullable=False)
    
    # Performance
    latency_ms = Column(Float, default=0.0)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    
    # Content (potentially large)
    context_summary = Column(Text, nullable=True)  # Brief of what was sent
    raw_response = Column(Text, nullable=True)     # Full JSON response
    
    # Outcome
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    
    # Link to validation
    validation_outcome = Column(String(20), nullable=True) # accepted/rejected/error
    
    def __repr__(self):
        return f"<LLMLog {self.provider} {self.model} success={self.success}>"
