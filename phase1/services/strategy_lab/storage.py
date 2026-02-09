"""
Strategy storage (in-memory for v1/demo mode)
"""

from typing import Dict, List, Optional
from datetime import datetime
import uuid
from .models import StrategyDefinition


class StrategyStorage:
    """In-memory strategy storage with DEMO fixtures"""
    
    def __init__(self):
        self._strategies: Dict[str, StrategyDefinition] = {}
        self._init_demo_strategies()
    
    def _init_demo_strategies(self):
        """Initialize with demo strategies"""
        # Demo strategy 1: SMA Crossover
        demo1 = StrategyDefinition(
            id="demo-sma-crossover",
            name="SMA Crossover 20/50",
            description="Buy when SMA20 crosses above SMA50, sell on cross below",
            strategy_type="crossover",
            indicators=[
                {"type": "SMA", "params": {"period": 20}},
                {"type": "SMA", "params": {"period": 50}}
            ],
            entry_condition={
                "condition_type": "cross_above",
                "indicator": "SMA_20",
                "reference_indicator": "SMA_50"
            },
            exit_condition={
                "condition_type": "cross_below",
                "indicator": "SMA_20",
                "reference_indicator": "SMA_50"
            },
            stop_loss_pct=2.0,
            take_profit_pct=5.0,
            tags=["momentum", "trend", "demo"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self._strategies[demo1.id] = demo1
        
        # Demo strategy 2: RSI Mean Reversion
        demo2 = StrategyDefinition(
            id="demo-rsi-mean-reversion",
            name="RSI Mean Reversion",
            description="Buy when RSI < 30, sell when RSI > 70",
            strategy_type="mean_reversion",
            indicators=[
                {"type": "RSI", "params": {"period": 14}}
            ],
            entry_condition={
                "condition_type": "below",
                "indicator": "RSI_14",
                "reference": 30.0
            },
            exit_condition={
                "condition_type": "above",
                "indicator": "RSI_14",
                "reference": 70.0
            },
            stop_loss_pct=3.0,
            take_profit_pct=10.0,
            tags=["mean-reversion", "oscillator", "demo"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self._strategies[demo2.id] = demo2
    
    def save(self, strategy: StrategyDefinition) -> StrategyDefinition:
        """Save a strategy. Generates ID if not provided."""
        if not strategy.id:
            strategy.id = f"strat-{uuid.uuid4().hex[:12]}"
        
        now = datetime.utcnow()
        if not strategy.created_at:
            strategy.created_at = now
        strategy.updated_at = now
        
        self._strategies[strategy.id] = strategy
        return strategy
    
    def get(self, strategy_id: str) -> Optional[StrategyDefinition]:
        """Get strategy by ID"""
        return self._strategies.get(strategy_id)
    
    def list(self, tags: Optional[List[str]] = None) -> List[StrategyDefinition]:
        """List all strategies, optionally filtered by tags"""
        strategies = list(self._strategies.values())
        
        if tags:
            strategies = [
                s for s in strategies
                if any(tag in s.tags for tag in tags)
            ]
        
        # Sort by updated_at descending
        strategies.sort(key=lambda s: s.updated_at or s.created_at or datetime.min, reverse=True)
        return strategies
    
    def delete(self, strategy_id: str) -> bool:
        """Delete a strategy. Returns True if deleted, False if not found."""
        if strategy_id in self._strategies:
            del self._strategies[strategy_id]
            return True
        return False


# Global instance for demo mode
_storage = StrategyStorage()


def get_storage() -> StrategyStorage:
    """Get the global storage instance"""
    return _storage
