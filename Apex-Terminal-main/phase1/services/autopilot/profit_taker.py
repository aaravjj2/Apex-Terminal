"""
Profit Taking Engine - Optimized for High Win Rate

This module implements intelligent profit-taking mechanics:
1. Partial profit exits (scale out at +10%)
2. Trailing stops that lock in profits
3. Break-even stop management
4. Time-based scaling
5. Volatility-adjusted targets

GOAL: Lock in profits quickly and let winners run with trailing stops.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


# ============================================================================
# PROFIT TAKING CONSTANTS
# ============================================================================

# Scaling out thresholds
PARTIAL_PROFIT_PCT_1 = 0.10   # Take first partial at +10%
PARTIAL_PROFIT_PCT_2 = 0.20   # Take second partial at +20%
PARTIAL_PROFIT_PCT_3 = 0.30   # Take third partial at +30%
FULL_PROFIT_TARGET = 0.40     # Full exit at +40%

# Exit ratios at each level
PARTIAL_EXIT_RATIO_1 = 0.30   # Exit 30% at first target
PARTIAL_EXIT_RATIO_2 = 0.30   # Exit 30% at second target
PARTIAL_EXIT_RATIO_3 = 0.20   # Exit 20% at third target
# Remaining 20% rides with trailing stop

# Trailing stop configuration
TRAILING_ACTIVATION_PCT = 0.08     # Activate trailing at +8%
TRAILING_DISTANCE_PCT = 0.06       # Trail 6% below high watermark
TRAILING_TIGHTEN_AT_PCT = 0.20     # Tighten trail to 4% at +20%
TRAILING_TIGHT_DISTANCE_PCT = 0.04 # Tighter trail distance

# Break-even configuration  
BREAK_EVEN_TRIGGER_PCT = 0.05  # Move stop to break-even at +5%
BREAK_EVEN_BUFFER_PCT = 0.01   # Small buffer above entry for break-even

# Time-based adjustments
TIME_DECAY_TIGHTEN_DTE = 5     # Tighten targets below 5 DTE
TIME_DECAY_REDUCTION_PCT = 0.20 # Reduce targets by 20% near expiry


class ProfitAction(str, Enum):
    """Profit-taking action types."""
    HOLD = "hold"
    PARTIAL_EXIT_1 = "partial_exit_1"
    PARTIAL_EXIT_2 = "partial_exit_2"
    PARTIAL_EXIT_3 = "partial_exit_3"
    FULL_EXIT = "full_exit"
    TRAILING_STOP_EXIT = "trailing_stop_exit"
    BREAK_EVEN_EXIT = "break_even_exit"
    TIME_STOP_EXIT = "time_stop_exit"


@dataclass
class ProfitState:
    """Track profit-taking state for a position."""
    position_id: str
    entry_price: float
    entry_qty: int
    entry_time: datetime
    
    # Current state
    current_qty: int = 0
    realized_pnl: float = 0.0
    high_water_mark: float = 0.0
    
    # Tracking flags
    partial_1_taken: bool = False
    partial_2_taken: bool = False
    partial_3_taken: bool = False
    break_even_active: bool = False
    trailing_active: bool = False
    trailing_tight: bool = False
    
    # Dynamic levels
    current_stop_price: float = 0.0
    trailing_stop_price: float = 0.0
    break_even_price: float = 0.0
    
    # Metrics
    max_pnl_pct: float = 0.0
    min_pnl_pct: float = 0.0
    
    def __post_init__(self):
        """Initialize state."""
        self.current_qty = self.entry_qty
        self.high_water_mark = self.entry_price
        self.break_even_price = self.entry_price * (1 + BREAK_EVEN_BUFFER_PCT)


@dataclass
class ProfitSignal:
    """Signal from profit-taking analysis."""
    action: ProfitAction
    exit_qty: int
    exit_pct: float
    current_pnl_pct: float
    trigger_price: float
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action.value,
            "exit_qty": self.exit_qty,
            "exit_pct": self.exit_pct,
            "current_pnl_pct": self.current_pnl_pct,
            "trigger_price": self.trigger_price,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
        }


class ProfitTaker:
    """
    Intelligent profit-taking engine.
    
    Features:
    - Multi-level partial profit taking
    - Trailing stops that lock in gains
    - Break-even stop management
    - Time-decay aware adjustments
    - Volatility-based target adjustments
    """
    
    def __init__(self):
        self._positions: Dict[str, ProfitState] = {}
        self._total_realized_pnl: float = 0.0
        self._win_count: int = 0
        self._loss_count: int = 0
        logger.info("ProfitTaker initialized")
    
    def register_position(
        self,
        position_id: str,
        entry_price: float,
        entry_qty: int,
        entry_time: datetime = None,
    ) -> ProfitState:
        """Register a new position for profit management."""
        if entry_time is None:
            entry_time = datetime.now(timezone.utc)
        
        state = ProfitState(
            position_id=position_id,
            entry_price=entry_price,
            entry_qty=entry_qty,
            entry_time=entry_time,
        )
        
        self._positions[position_id] = state
        logger.info(f"ProfitTaker: Registered {position_id} (entry=${entry_price:.2f}, qty={entry_qty})")
        return state
    
    def check_position(
        self,
        position_id: str,
        current_price: float,
        dte: Optional[int] = None,
        iv_percentile: Optional[float] = None,
    ) -> Optional[ProfitSignal]:
        """
        Check a position for profit-taking opportunities.
        
        Returns ProfitSignal if action needed, None otherwise.
        """
        if position_id not in self._positions:
            logger.warning(f"Position {position_id} not registered with ProfitTaker")
            return None
        
        state = self._positions[position_id]
        now = datetime.now(timezone.utc)
        
        # Calculate P&L
        pnl_pct = (current_price - state.entry_price) / state.entry_price if state.entry_price > 0 else 0
        
        # Update tracking
        state.max_pnl_pct = max(state.max_pnl_pct, pnl_pct)
        state.min_pnl_pct = min(state.min_pnl_pct, pnl_pct)
        
        if current_price > state.high_water_mark:
            state.high_water_mark = current_price
        
        # Apply time decay adjustments if near expiry
        profit_reduction = 0.0
        if dte is not None and dte <= TIME_DECAY_TIGHTEN_DTE:
            profit_reduction = TIME_DECAY_REDUCTION_PCT
            logger.debug(f"{position_id}: Near expiry (DTE={dte}), reducing targets by {profit_reduction:.0%}")
        
        adjusted_partial_1 = PARTIAL_PROFIT_PCT_1 * (1 - profit_reduction)
        adjusted_partial_2 = PARTIAL_PROFIT_PCT_2 * (1 - profit_reduction)
        adjusted_partial_3 = PARTIAL_PROFIT_PCT_3 * (1 - profit_reduction)
        adjusted_full = FULL_PROFIT_TARGET * (1 - profit_reduction)
        
        # ====================================================================
        # CHECK PROFIT TARGETS (in order of priority)
        # ====================================================================
        
        # 1. FULL PROFIT TARGET
        if pnl_pct >= adjusted_full:
            exit_qty = state.current_qty
            logger.info(f"🎯 FULL PROFIT: {position_id} at {pnl_pct:.1%} (target: {adjusted_full:.1%})")
            return ProfitSignal(
                action=ProfitAction.FULL_EXIT,
                exit_qty=exit_qty,
                exit_pct=1.0,
                current_pnl_pct=pnl_pct,
                trigger_price=current_price,
                timestamp=now,
                details={"target": adjusted_full, "remaining_qty": 0}
            )
        
        # 2. PARTIAL PROFIT LEVEL 3 (+30%)
        if not state.partial_3_taken and pnl_pct >= adjusted_partial_3:
            exit_qty = int(state.entry_qty * PARTIAL_EXIT_RATIO_3)
            if exit_qty > 0 and exit_qty <= state.current_qty:
                state.partial_3_taken = True
                state.current_qty -= exit_qty
                realized = (current_price - state.entry_price) * exit_qty * 100
                state.realized_pnl += realized
                logger.info(f"💰 PARTIAL 3: {position_id} exit {exit_qty} at {pnl_pct:.1%} (+${realized:.2f})")
                return ProfitSignal(
                    action=ProfitAction.PARTIAL_EXIT_3,
                    exit_qty=exit_qty,
                    exit_pct=PARTIAL_EXIT_RATIO_3,
                    current_pnl_pct=pnl_pct,
                    trigger_price=current_price,
                    timestamp=now,
                    details={"realized_pnl": realized, "remaining_qty": state.current_qty}
                )
        
        # 3. PARTIAL PROFIT LEVEL 2 (+20%)
        if not state.partial_2_taken and pnl_pct >= adjusted_partial_2:
            exit_qty = int(state.entry_qty * PARTIAL_EXIT_RATIO_2)
            if exit_qty > 0 and exit_qty <= state.current_qty:
                state.partial_2_taken = True
                state.current_qty -= exit_qty
                realized = (current_price - state.entry_price) * exit_qty * 100
                state.realized_pnl += realized
                
                # Also tighten trailing stop at +20%
                state.trailing_tight = True
                logger.info(f"💰 PARTIAL 2: {position_id} exit {exit_qty} at {pnl_pct:.1%} (+${realized:.2f})")
                return ProfitSignal(
                    action=ProfitAction.PARTIAL_EXIT_2,
                    exit_qty=exit_qty,
                    exit_pct=PARTIAL_EXIT_RATIO_2,
                    current_pnl_pct=pnl_pct,
                    trigger_price=current_price,
                    timestamp=now,
                    details={"realized_pnl": realized, "remaining_qty": state.current_qty, "trail_tightened": True}
                )
        
        # 4. PARTIAL PROFIT LEVEL 1 (+10%)
        if not state.partial_1_taken and pnl_pct >= adjusted_partial_1:
            exit_qty = int(state.entry_qty * PARTIAL_EXIT_RATIO_1)
            if exit_qty > 0 and exit_qty <= state.current_qty:
                state.partial_1_taken = True
                state.current_qty -= exit_qty
                realized = (current_price - state.entry_price) * exit_qty * 100
                state.realized_pnl += realized
                logger.info(f"💰 PARTIAL 1: {position_id} exit {exit_qty} at {pnl_pct:.1%} (+${realized:.2f})")
                return ProfitSignal(
                    action=ProfitAction.PARTIAL_EXIT_1,
                    exit_qty=exit_qty,
                    exit_pct=PARTIAL_EXIT_RATIO_1,
                    current_pnl_pct=pnl_pct,
                    trigger_price=current_price,
                    timestamp=now,
                    details={"realized_pnl": realized, "remaining_qty": state.current_qty}
                )
        
        # ====================================================================
        # CHECK TRAILING STOP
        # ====================================================================
        
        # Activate trailing stop at +8%
        high_pnl_pct = (state.high_water_mark - state.entry_price) / state.entry_price
        if high_pnl_pct >= TRAILING_ACTIVATION_PCT:
            state.trailing_active = True
            
            # Calculate trailing stop price
            trail_distance = TRAILING_TIGHT_DISTANCE_PCT if state.trailing_tight else TRAILING_DISTANCE_PCT
            state.trailing_stop_price = state.high_water_mark * (1 - trail_distance)
            state.current_stop_price = max(state.current_stop_price, state.trailing_stop_price)
            
            # Check if trailing stop hit
            if current_price <= state.current_stop_price:
                exit_qty = state.current_qty
                trailing_pnl = (current_price - state.entry_price) / state.entry_price
                logger.info(f"📉 TRAILING STOP: {position_id} at {trailing_pnl:.1%} (from {high_pnl_pct:.1%} high)")
                return ProfitSignal(
                    action=ProfitAction.TRAILING_STOP_EXIT,
                    exit_qty=exit_qty,
                    exit_pct=1.0,
                    current_pnl_pct=trailing_pnl,
                    trigger_price=current_price,
                    timestamp=now,
                    details={
                        "high_water_mark": state.high_water_mark,
                        "trailing_stop_price": state.current_stop_price,
                        "locked_profit_pct": trailing_pnl,
                        "remaining_qty": 0,
                    }
                )
        
        # ====================================================================
        # CHECK BREAK-EVEN STOP
        # ====================================================================
        
        # Activate break-even at +5%
        if not state.trailing_active and pnl_pct >= BREAK_EVEN_TRIGGER_PCT:
            state.break_even_active = True
            state.current_stop_price = state.break_even_price
        
        # Check break-even stop
        if state.break_even_active and not state.trailing_active:
            if current_price <= state.current_stop_price:
                exit_qty = state.current_qty
                logger.info(f"🔒 BREAK-EVEN: {position_id} at ${current_price:.2f}")
                return ProfitSignal(
                    action=ProfitAction.BREAK_EVEN_EXIT,
                    exit_qty=exit_qty,
                    exit_pct=1.0,
                    current_pnl_pct=pnl_pct,
                    trigger_price=current_price,
                    timestamp=now,
                    details={"break_even_price": state.break_even_price, "remaining_qty": 0}
                )
        
        # No action needed
        return None
    
    def on_position_closed(
        self,
        position_id: str,
        final_price: float,
        exit_reason: str = "unknown",
    ) -> Dict[str, Any]:
        """Record final position close and calculate stats."""
        if position_id not in self._positions:
            return {}
        
        state = self._positions[position_id]
        
        # Calculate final P&L on remaining quantity
        if state.current_qty > 0:
            final_pnl = (final_price - state.entry_price) * state.current_qty * 100
            state.realized_pnl += final_pnl
        
        # Track win/loss
        if state.realized_pnl > 0:
            self._win_count += 1
        else:
            self._loss_count += 1
        
        self._total_realized_pnl += state.realized_pnl
        
        result = {
            "position_id": position_id,
            "entry_price": state.entry_price,
            "final_price": final_price,
            "entry_qty": state.entry_qty,
            "realized_pnl": state.realized_pnl,
            "max_pnl_pct": state.max_pnl_pct,
            "min_pnl_pct": state.min_pnl_pct,
            "partials_taken": sum([
                state.partial_1_taken,
                state.partial_2_taken,
                state.partial_3_taken,
            ]),
            "exit_reason": exit_reason,
        }
        
        del self._positions[position_id]
        logger.info(f"ProfitTaker: Closed {position_id}, PnL=${state.realized_pnl:.2f}, reason={exit_reason}")
        
        return result
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get profit-taking metrics."""
        total_trades = self._win_count + self._loss_count
        win_rate = self._win_count / total_trades if total_trades > 0 else 0.0
        
        return {
            "total_realized_pnl": self._total_realized_pnl,
            "win_count": self._win_count,
            "loss_count": self._loss_count,
            "win_rate": win_rate,
            "active_positions": len(self._positions),
        }
    
    def reset(self):
        """Reset for new trading session."""
        self._positions = {}
        self._total_realized_pnl = 0.0
        self._win_count = 0
        self._loss_count = 0
        logger.info("ProfitTaker: Reset for new session")


# ============================================================================
# SINGLETON ACCESS
# ============================================================================

_profit_taker: Optional[ProfitTaker] = None


def get_profit_taker() -> ProfitTaker:
    """Get singleton ProfitTaker instance."""
    global _profit_taker
    if _profit_taker is None:
        _profit_taker = ProfitTaker()
    return _profit_taker


def reset_profit_taker():
    """Reset singleton (for testing)."""
    global _profit_taker
    _profit_taker = None
