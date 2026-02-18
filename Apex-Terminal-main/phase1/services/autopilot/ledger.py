"""
Internal Trade Ledger
Records all autopilot trade attempts with status tracking.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum
import json
import os
import logging

logger = logging.getLogger(__name__)


class TradeStatus(str, Enum):
    """Status of a trade in the ledger."""
    PROPOSED = "proposed"
    VALIDATED = "validated"
    PLACED = "placed"
    FILLED = "filled"
    PARTIAL = "partial"
    FAILED = "failed"
    CLOSED = "closed"


@dataclass
class TradeLedgerEntry:
    """Single entry in the trade ledger."""
    id: str
    run_id: str
    symbol: str
    template: str
    status: TradeStatus
    proposed_at: datetime
    max_loss: float
    max_profit: float
    selection_reason: str = ""
    rejection_reasons: List[str] = field(default_factory=list)
    validated_at: Optional[datetime] = None
    placed_at: Optional[datetime] = None
    filled_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    alpaca_order_id: Optional[str] = None
    fill_price: Optional[float] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "run_id": self.run_id,
            "symbol": self.symbol,
            "template": self.template,
            "status": self.status.value,
            "proposed_at": self.proposed_at.isoformat(),
            "max_loss": self.max_loss,
            "max_profit": self.max_profit,
            "selection_reason": self.selection_reason,
            "rejection_reasons": self.rejection_reasons,
            "validated_at": self.validated_at.isoformat() if self.validated_at else None,
            "placed_at": self.placed_at.isoformat() if self.placed_at else None,
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "alpaca_order_id": self.alpaca_order_id,
            "fill_price": self.fill_price,
            "error_message": self.error_message,
            "metadata": self.metadata,
        }


@dataclass
class AutopilotRunSummary:
    """Summary of an autopilot run."""
    run_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "running"
    candidates_count: int = 0
    selected_count: int = 0
    validated_count: int = 0
    placed_count: int = 0
    filled_count: int = 0
    failed_count: int = 0
    llm_provider: str = "deterministic"
    selection_method: str = "deterministic"
    rationale: str = ""
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "candidates_count": self.candidates_count,
            "selected_count": self.selected_count,
            "validated_count": self.validated_count,
            "placed_count": self.placed_count,
            "filled_count": self.filled_count,
            "failed_count": self.failed_count,
            "llm_provider": self.llm_provider,
            "selection_method": self.selection_method,
            "rationale": self.rationale,
            "error_message": self.error_message,
        }


class TradeLedger:
    """
    In-memory trade ledger with optional persistence.
    """
    
    def __init__(self, persist_path: Optional[str] = None):
        self._entries: Dict[str, TradeLedgerEntry] = {}
        self._runs: Dict[str, AutopilotRunSummary] = {}
        self._persist_path = persist_path
        
        if persist_path and os.path.exists(persist_path):
            self._load()
    
    def create_run(self, run_id: str) -> AutopilotRunSummary:
        """Create a new autopilot run."""
        summary = AutopilotRunSummary(
            run_id=run_id,
            started_at=datetime.utcnow(),
        )
        self._runs[run_id] = summary
        return summary
    
    def get_run(self, run_id: str) -> Optional[AutopilotRunSummary]:
        """Get run summary by ID."""
        return self._runs.get(run_id)
    
    def get_last_run(self) -> Optional[AutopilotRunSummary]:
        """Get the most recent run."""
        if not self._runs:
            return None
        return max(self._runs.values(), key=lambda r: r.started_at)
    
    def complete_run(
        self,
        run_id: str,
        status: str = "completed",
        error: Optional[str] = None,
    ) -> None:
        """Mark a run as complete."""
        if run_id in self._runs:
            run = self._runs[run_id]
            run.completed_at = datetime.utcnow()
            run.status = status
            run.error_message = error
            self._persist()
    
    def add_entry(self, entry: TradeLedgerEntry) -> None:
        """Add a trade entry."""
        self._entries[entry.id] = entry
        
        # Update run counts
        if entry.run_id in self._runs:
            run = self._runs[entry.run_id]
            if entry.status == TradeStatus.PROPOSED:
                run.candidates_count += 1
            elif entry.status == TradeStatus.VALIDATED:
                run.validated_count += 1
            elif entry.status == TradeStatus.PLACED:
                run.placed_count += 1
            elif entry.status == TradeStatus.FILLED:
                run.filled_count += 1
            elif entry.status == TradeStatus.FAILED:
                run.failed_count += 1
        
        self._persist()
    
    def update_entry(
        self,
        entry_id: str,
        status: Optional[TradeStatus] = None,
        **updates,
    ) -> Optional[TradeLedgerEntry]:
        """Update a trade entry."""
        if entry_id not in self._entries:
            return None
        
        entry = self._entries[entry_id]
        
        if status:
            old_status = entry.status
            entry.status = status
            
            # Update timestamps
            now = datetime.utcnow()
            if status == TradeStatus.VALIDATED:
                entry.validated_at = now
            elif status == TradeStatus.PLACED:
                entry.placed_at = now
            elif status == TradeStatus.FILLED:
                entry.filled_at = now
            elif status == TradeStatus.CLOSED:
                entry.closed_at = now
            
            # Update run counts
            if entry.run_id in self._runs:
                run = self._runs[entry.run_id]
                if status == TradeStatus.VALIDATED:
                    run.validated_count += 1
                elif status == TradeStatus.PLACED:
                    run.placed_count += 1
                elif status == TradeStatus.FILLED:
                    run.filled_count += 1
                elif status == TradeStatus.FAILED:
                    run.failed_count += 1
        
        for key, value in updates.items():
            if hasattr(entry, key):
                setattr(entry, key, value)
        
        self._persist()
        return entry
    
    def get_entry(self, entry_id: str) -> Optional[TradeLedgerEntry]:
        """Get entry by ID."""
        return self._entries.get(entry_id)
    
    def get_entries_for_run(self, run_id: str) -> List[TradeLedgerEntry]:
        """Get all entries for a run."""
        return [e for e in self._entries.values() if e.run_id == run_id]
    
    def get_open_positions(self) -> List[TradeLedgerEntry]:
        """Get entries that are currently open (filled but not closed)."""
        return [
            e for e in self._entries.values()
            if e.status in [TradeStatus.FILLED, TradeStatus.PARTIAL]
        ]
    
    def get_verification_summary(self, run_id: Optional[str] = None) -> Dict[str, Any]:
        """Get verification summary for a run or the last run."""
        if run_id:
            run = self._runs.get(run_id)
        else:
            run = self.get_last_run()
        
        if not run:
            return {
                "status": "no_runs",
                "message": "No autopilot runs found",
            }
        
        entries = self.get_entries_for_run(run.run_id)
        
        by_status = {}
        for entry in entries:
            status = entry.status.value
            if status not in by_status:
                by_status[status] = []
            by_status[status].append({
                "id": entry.id,
                "symbol": entry.symbol,
                "template": entry.template,
                "alpaca_order_id": entry.alpaca_order_id,
            })
        
        return {
            "run_id": run.run_id,
            "status": run.status,
            "started_at": run.started_at.isoformat(),
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "counts": {
                "candidates": run.candidates_count,
                "selected": run.selected_count,
                "validated": run.validated_count,
                "placed": run.placed_count,
                "filled": run.filled_count,
                "failed": run.failed_count,
            },
            "by_status": by_status,
            "llm_provider": run.llm_provider,
            "selection_method": run.selection_method,
        }
    
    def _persist(self) -> None:
        """Persist ledger to disk."""
        if not self._persist_path:
            return
        
        try:
            data = {
                "entries": {k: v.to_dict() for k, v in self._entries.items()},
                "runs": {k: v.to_dict() for k, v in self._runs.items()},
            }
            with open(self._persist_path, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist ledger: {e}")
    
    def _load(self) -> None:
        """Load ledger from disk."""
        try:
            with open(self._persist_path, "r") as f:
                data = json.load(f)
            
            for entry_data in data.get("entries", {}).values():
                entry = TradeLedgerEntry(
                    id=entry_data["id"],
                    run_id=entry_data["run_id"],
                    symbol=entry_data["symbol"],
                    template=entry_data["template"],
                    status=TradeStatus(entry_data["status"]),
                    proposed_at=datetime.fromisoformat(entry_data["proposed_at"]),
                    max_loss=entry_data["max_loss"],
                    max_profit=entry_data["max_profit"],
                    selection_reason=entry_data.get("selection_reason", ""),
                    rejection_reasons=entry_data.get("rejection_reasons", []),
                    alpaca_order_id=entry_data.get("alpaca_order_id"),
                    fill_price=entry_data.get("fill_price"),
                    error_message=entry_data.get("error_message"),
                    metadata=entry_data.get("metadata", {}),
                )
                if entry_data.get("validated_at"):
                    entry.validated_at = datetime.fromisoformat(entry_data["validated_at"])
                if entry_data.get("placed_at"):
                    entry.placed_at = datetime.fromisoformat(entry_data["placed_at"])
                if entry_data.get("filled_at"):
                    entry.filled_at = datetime.fromisoformat(entry_data["filled_at"])
                if entry_data.get("closed_at"):
                    entry.closed_at = datetime.fromisoformat(entry_data["closed_at"])
                self._entries[entry.id] = entry
            
            for run_data in data.get("runs", {}).values():
                run = AutopilotRunSummary(
                    run_id=run_data["run_id"],
                    started_at=datetime.fromisoformat(run_data["started_at"]),
                    status=run_data.get("status", "completed"),
                    candidates_count=run_data.get("candidates_count", 0),
                    selected_count=run_data.get("selected_count", 0),
                    validated_count=run_data.get("validated_count", 0),
                    placed_count=run_data.get("placed_count", 0),
                    filled_count=run_data.get("filled_count", 0),
                    failed_count=run_data.get("failed_count", 0),
                    llm_provider=run_data.get("llm_provider", "deterministic"),
                    selection_method=run_data.get("selection_method", "deterministic"),
                    rationale=run_data.get("rationale", ""),
                    error_message=run_data.get("error_message"),
                )
                if run_data.get("completed_at"):
                    run.completed_at = datetime.fromisoformat(run_data["completed_at"])
                self._runs[run.run_id] = run
        except Exception as e:
            logger.error(f"Failed to load ledger: {e}")


# Global ledger instance
_ledger: Optional[TradeLedger] = None
_ledger_instance: Optional[TradeLedger] = None  # Alias for tests


def get_ledger() -> TradeLedger:
    """Get the global ledger instance."""
    global _ledger, _ledger_instance
    if _ledger is None:
        persist_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "trade_ledger.json"
        )
        _ledger = TradeLedger(persist_path=persist_path)
        _ledger_instance = _ledger
    return _ledger


def reset_ledger() -> None:
    """Reset the global ledger (for testing)."""
    global _ledger, _ledger_instance
    _ledger = None
    _ledger_instance = None
