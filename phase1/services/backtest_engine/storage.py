"""
Backtest run storage (in-memory for v1/demo mode)
"""

from typing import Dict, List, Optional
from .models import BacktestRun


class BacktestStorage:
    """In-memory storage for backtest runs"""
    
    def __init__(self):
        self._runs: Dict[str, BacktestRun] = {}
    
    def save(self, run: BacktestRun) -> BacktestRun:
        """Save a backtest run"""
        self._runs[run.run_id] = run
        return run
    
    def get(self, run_id: str) -> Optional[BacktestRun]:
        """Get run by ID"""
        return self._runs.get(run_id)
    
    def list(self, strategy_id: Optional[str] = None) -> List[BacktestRun]:
        """List all runs, optionally filtered by strategy"""
        runs = list(self._runs.values())
        
        if strategy_id:
            runs = [r for r in runs if r.config.strategy_id == strategy_id]
        
        # Sort by started_at descending
        runs.sort(key=lambda r: r.started_at or r.completed_at, reverse=True)
        return runs


# Global instance
_storage = BacktestStorage()


def get_storage() -> BacktestStorage:
    """Get the global storage instance"""
    return _storage
