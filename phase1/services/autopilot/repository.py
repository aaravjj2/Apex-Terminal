"""
Autopilot Repository

CRUD operations for autopilot database entities.
Uses async SQLAlchemy with the same DB as phase1.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session
from contextlib import contextmanager
import logging

from .autopilot_models import (
    Base, 
    AutopilotRun, RunStatus,
    AutopilotOrder, OrderStatus,
    AutopilotPosition, PositionStatus,
    AutopilotIncident, IncidentSeverity,
    AutopilotCandidate,
)

logger = logging.getLogger(__name__)

# Sync engine for simplicity (can be made async later)
_engine = None


def get_engine():
    """Get or create database engine."""
    global _engine
    if _engine is None:
        from ..config import get_settings
        settings = get_settings()
        # Use sync SQLite (no aiosqlite needed for repo operations)
        db_url = settings.database_url.replace("+aiosqlite", "")
        _engine = create_engine(db_url, echo=False)
    return _engine


def init_autopilot_db():
    """Initialize autopilot tables (create if not exist)."""
    engine = get_engine()
    Base.metadata.create_all(engine)
    logger.info("Autopilot DB tables initialized")


@contextmanager
def get_session():
    """Get a database session."""
    engine = get_engine()
    with Session(engine) as session:
        yield session


class AutopilotRepository:
    """Repository for autopilot entity CRUD operations."""
    
    # =========================================================================
    # RUNS
    # =========================================================================
    
    def create_run(self, **kwargs) -> AutopilotRun:
        """Create a new run record."""
        run_id = kwargs.pop("id", str(uuid.uuid4()))
        run = AutopilotRun(id=run_id, **kwargs)
        with get_session() as session:
            session.add(run)
            session.commit()
            session.refresh(run)
            return run
    
    def get_run(self, run_id: str) -> Optional[AutopilotRun]:
        """Get run by ID."""
        with get_session() as session:
            return session.get(AutopilotRun, run_id)
    
    def update_run(self, run_id: str, **kwargs) -> Optional[AutopilotRun]:
        """Update run fields."""
        with get_session() as session:
            run = session.get(AutopilotRun, run_id)
            if run:
                for key, value in kwargs.items():
                    setattr(run, key, value)
                session.commit()
                session.refresh(run)
            return run
    
    def complete_run(self, run_id: str, status: RunStatus = RunStatus.COMPLETED, 
                     error_message: str = None) -> Optional[AutopilotRun]:
        """Mark run as completed or failed."""
        return self.update_run(
            run_id,
            status=status.value,
            completed_at=datetime.utcnow(),
            error_message=error_message,
        )
    
    def list_runs(self, limit: int = 50, offset: int = 0) -> List[AutopilotRun]:
        """List recent runs."""
        with get_session() as session:
            stmt = select(AutopilotRun).order_by(
                AutopilotRun.started_at.desc()
            ).limit(limit).offset(offset)
            result = session.execute(stmt)
            return list(result.scalars().all())
    
    # =========================================================================
    # ORDERS
    # =========================================================================
    
    def create_order(self, **kwargs) -> AutopilotOrder:
        """Create a new order record."""
        client_order_id = kwargs.pop("client_order_id", str(uuid.uuid4()))
        order = AutopilotOrder(client_order_id=client_order_id, **kwargs)
        with get_session() as session:
            session.add(order)
            session.commit()
            session.refresh(order)
            return order
    
    def get_order(self, client_order_id: str) -> Optional[AutopilotOrder]:
        """Get order by client_order_id."""
        with get_session() as session:
            return session.get(AutopilotOrder, client_order_id)
    
    def update_order(self, client_order_id: str, **kwargs) -> Optional[AutopilotOrder]:
        """Update order fields."""
        with get_session() as session:
            order = session.get(AutopilotOrder, client_order_id)
            if order:
                for key, value in kwargs.items():
                    setattr(order, key, value)
                session.commit()
                session.refresh(order)
            return order
    
    def list_orders(self, run_id: str = None, status: str = None, 
                    limit: int = 100) -> List[AutopilotOrder]:
        """List orders, optionally filtered."""
        with get_session() as session:
            stmt = select(AutopilotOrder).order_by(
                AutopilotOrder.created_at.desc()
            ).limit(limit)
            if run_id:
                stmt = stmt.where(AutopilotOrder.run_id == run_id)
            if status:
                stmt = stmt.where(AutopilotOrder.status == status)
            result = session.execute(stmt)
            return list(result.scalars().all())
    
    # =========================================================================
    # POSITIONS
    # =========================================================================
    
    def create_position(self, **kwargs) -> AutopilotPosition:
        """Create a new position record."""
        pos_id = kwargs.pop("id", str(uuid.uuid4()))
        position = AutopilotPosition(id=pos_id, **kwargs)
        with get_session() as session:
            session.add(position)
            session.commit()
            session.refresh(position)
            return position
    
    def get_position(self, position_id: str) -> Optional[AutopilotPosition]:
        """Get position by ID."""
        with get_session() as session:
            return session.get(AutopilotPosition, position_id)
    
    def update_position(self, position_id: str, **kwargs) -> Optional[AutopilotPosition]:
        """Update position fields."""
        with get_session() as session:
            position = session.get(AutopilotPosition, position_id)
            if position:
                for key, value in kwargs.items():
                    setattr(position, key, value)
                session.commit()
                session.refresh(position)
            return position
    
    def list_open_positions(self) -> List[AutopilotPosition]:
        """List all open positions."""
        with get_session() as session:
            stmt = select(AutopilotPosition).where(
                AutopilotPosition.status == PositionStatus.OPEN.value
            ).order_by(AutopilotPosition.created_at.desc())
            result = session.execute(stmt)
            return list(result.scalars().all())
    
    def close_position(self, position_id: str, exit_price: float, 
                       exit_reason: str, realized_pnl: float = None) -> Optional[AutopilotPosition]:
        """Mark position as closed."""
        return self.update_position(
            position_id,
            status=PositionStatus.CLOSED.value,
            closed_at=datetime.utcnow(),
            exit_price=exit_price,
            exit_reason=exit_reason,
            realized_pnl=realized_pnl,
        )
    
    # =========================================================================
    # INCIDENTS
    # =========================================================================
    
    def create_incident(self, severity: IncidentSeverity, category: str, 
                        title: str, **kwargs) -> AutopilotIncident:
        """Create a new incident record."""
        incident = AutopilotIncident(
            id=str(uuid.uuid4()),
            severity=severity.value,
            category=category,
            title=title,
            **kwargs
        )
        with get_session() as session:
            session.add(incident)
            session.commit()
            session.refresh(incident)
            return incident
    
    def list_incidents(self, unresolved_only: bool = False, 
                       limit: int = 100) -> List[AutopilotIncident]:
        """List incidents."""
        with get_session() as session:
            stmt = select(AutopilotIncident).order_by(
                AutopilotIncident.created_at.desc()
            ).limit(limit)
            if unresolved_only:
                stmt = stmt.where(AutopilotIncident.resolved == False)
            result = session.execute(stmt)
            return list(result.scalars().all())
    
    def resolve_incident(self, incident_id: str, note: str = None) -> Optional[AutopilotIncident]:
        """Mark incident as resolved."""
        with get_session() as session:
            incident = session.get(AutopilotIncident, incident_id)
            if incident:
                incident.resolved = True
                incident.resolved_at = datetime.utcnow()
                incident.resolution_note = note
                session.commit()
                session.refresh(incident)
            return incident
    
    # =========================================================================
    # CANDIDATES
    # =========================================================================
    
    def create_candidate(self, **kwargs) -> AutopilotCandidate:
        """Create a candidate record."""
        cand_id = kwargs.pop("id", str(uuid.uuid4()))
        candidate = AutopilotCandidate(id=cand_id, **kwargs)
        with get_session() as session:
            session.add(candidate)
            session.commit()
            session.refresh(candidate)
            return candidate
    
    def list_candidates(self, run_id: str) -> List[AutopilotCandidate]:
        """List candidates for a run."""
        with get_session() as session:
            stmt = select(AutopilotCandidate).where(
                AutopilotCandidate.run_id == run_id
            ).order_by(AutopilotCandidate.adjusted_score.desc())
            result = session.execute(stmt)
            return list(result.scalars().all())


# Singleton instance
_repo: Optional[AutopilotRepository] = None


def get_autopilot_repository() -> AutopilotRepository:
    """Get singleton repository instance."""
    global _repo
    if _repo is None:
        _repo = AutopilotRepository()
    return _repo
