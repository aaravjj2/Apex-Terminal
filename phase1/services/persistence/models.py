"""
Online-only canonical database models.
These tables are the system of record for all platform data.
No in-memory mocks — everything persists to Postgres.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class MarketBar(Base):
    """OHLCV bar data from market providers."""
    __tablename__ = "market_bars"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False)  # 1m, 5m, 1h, 1d
    timestamp = Column(DateTime, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False, default=0)
    provider = Column(String(20), nullable=False)  # finnhub, polygon, alpaca
    ingested_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "timestamp", name="uq_bar"),
        Index("ix_bar_lookup", "symbol", "timeframe", "timestamp"),
    )


class Order(Base):
    """Orders placed via the broker (Alpaca paper)."""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    broker_order_id = Column(String(64), unique=True, nullable=True)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(String(10), nullable=False)  # buy, sell
    qty = Column(Float, nullable=False)
    order_type = Column(String(20), nullable=False, default="market")
    limit_price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    filled_qty = Column(Float, default=0)
    filled_avg_price = Column(Float, nullable=True)
    strategy_id = Column(String(64), nullable=True, index=True)
    autopilot_run_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    filled_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)


class Fill(Base):
    """Individual fill events from the broker."""
    __tablename__ = "fills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    broker_fill_id = Column(String(64), unique=True, nullable=True)
    price = Column(Float, nullable=False)
    qty = Column(Float, nullable=False)
    side = Column(String(10), nullable=False)
    symbol = Column(String(20), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    commission = Column(Float, default=0)


class Position(Base):
    """Current positions from the broker."""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, unique=True)
    qty = Column(Float, nullable=False)
    avg_entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=True)
    market_value = Column(Float, nullable=True)
    unrealized_pnl = Column(Float, nullable=True)
    side = Column(String(10), nullable=False, default="long")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Strategy(Base):
    """Strategy definitions."""
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_id = Column(String(64), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=False, default="manual")  # manual, autopilot, agent
    symbols = Column(JSON, default=list)
    parameters = Column(JSON, default=dict)
    status = Column(String(20), default="draft")  # draft, active, paused, archived
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1)


class BacktestRun(Base):
    """Backtest execution records."""
    __tablename__ = "backtest_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False)
    strategy_id = Column(String(64), ForeignKey("strategies.strategy_id"), nullable=True)
    symbols = Column(JSON, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    initial_capital = Column(Float, nullable=False, default=100000)
    parameters = Column(JSON, default=dict)
    results = Column(JSON, nullable=True)  # sharpe, max_dd, total_return, etc.
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)


class Workflow(Base):
    """Workflow definitions for the workflow builder."""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(String(64), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    steps = Column(JSON, nullable=False, default=list)  # [{type, config, ...}]
    triggers = Column(JSON, default=list)  # [{type: cron|event, spec: ...}]
    status = Column(String(20), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkflowRun(Base):
    """Workflow execution records."""
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False)
    workflow_id = Column(String(64), ForeignKey("workflows.workflow_id"), nullable=False)
    status = Column(String(20), default="pending")
    step_results = Column(JSON, default=list)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)


# Note: AutopilotRun and related autopilot tables are defined in
# services/autopilot/autopilot_models.py using this same Base


class AuditLog(Base):
    """System audit trail."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(64), nullable=True)
    user = Column(String(100), default="system")
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# ── Phase 3: Market Data Pipeline tables ─────────────────────────────

class MarketDataBatch(Base):
    """
    Batch provenance for every market data fetch.
    Each row = one provider fetch for one symbol + timeframe + date range,
    with a deterministic SHA-256 checksum over the bar payload.
    """
    __tablename__ = "market_data_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(64), unique=True, nullable=False, index=True)
    provider = Column(String(20), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False, default="1d")
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    row_count = Column(Integer, nullable=False, default=0)
    sha256 = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="ok")  # ok, gap, stale, error
    gap_days = Column(Integer, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)

    __table_args__ = (
        Index("ix_batch_symbol_tf", "symbol", "timeframe"),
        Index("ix_batch_provider", "provider"),
    )
