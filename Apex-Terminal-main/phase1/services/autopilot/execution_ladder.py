"""
Order Execution Engine (Milestone 1)

Implements the limit order retry ladder strategy:
1. Attempt at mid
2. Improve by 10-20% of spread
3. Cap at 40-50% of spread
4. Track fill status from broker (no "assume filled")
"""

import logging
import asyncio
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ExecutionState(str, Enum):
    """Order execution states."""
    PENDING = "pending"
    WORKING = "working"
    IMPROVING = "improving"
    FILLED = "filled"
    PARTIAL = "partial"
    CANCELLED = "cancelled"
    FAILED = "failed"
    TIMEOUT = "timeout"

@dataclass
class OrderAttempt:
    """Record of a single order attempt."""
    attempt_num: int
    limit_price: float
    submitted_at: datetime
    status: ExecutionState = ExecutionState.PENDING
    filled_qty: int = 0
    fill_price: Optional[float] = None
    broker_order_id: Optional[str] = None
    error: Optional[str] = None

@dataclass
class ExecutionResult:
    """Final result of execution ladder."""
    success: bool
    state: ExecutionState
    filled_qty: int
    avg_fill_price: Optional[float]
    total_attempts: int
    attempts: List[OrderAttempt] = field(default_factory=list)
    latency_ms: float = 0.0
    slippage_bps: float = 0.0  # vs mid price
    error: Optional[str] = None

class LimitOrderLadder:
    """
    Executes orders using an improving limit order strategy.
    
    Strategy per spec:
    - Start at mid price
    - Improve by step_pct of spread each retry
    - Cap improvement at max_improve_pct of spread
    - Timeout after max_attempts or max_duration
    """
    
    def __init__(
        self,
        step_pct: float = 0.15,       # 15% of spread improvement per step
        max_improve_pct: float = 0.45, # Cap at 45% of spread
        max_attempts: int = 5,
        attempt_interval_sec: float = 3.0,
        max_duration_sec: float = 30.0,
    ):
        self.step_pct = step_pct
        self.max_improve_pct = max_improve_pct
        self.max_attempts = max_attempts
        self.attempt_interval = attempt_interval_sec
        self.max_duration = max_duration_sec

    async def execute(
        self,
        symbol: str,
        side: str,  # "buy" or "sell"
        qty: int,
        bid: float,
        ask: float,
        submit_fn: Callable,  # async fn(symbol, side, qty, limit_price) -> order_id
        check_fn: Callable,   # async fn(order_id) -> (status, filled_qty, fill_price)
        cancel_fn: Callable,  # async fn(order_id) -> bool
    ) -> ExecutionResult:
        """
        Execute order with retry ladder.
        
        Args:
            symbol: OCC symbol or ticker
            side: "buy" or "sell"
            qty: Quantity to fill
            bid: Current best bid
            ask: Current best ask
            submit_fn: Function to submit limit order
            check_fn: Function to check order status
            cancel_fn: Function to cancel order
        """
        start_time = datetime.utcnow()
        attempts = []
        remaining_qty = qty
        total_filled = 0
        fill_prices = []
        
        spread = ask - bid
        mid = (bid + ask) / 2
        
        # Calculate price ladder
        if side == "buy":
            # Buyer starts at mid, improves toward ask
            start_price = mid
            improve_direction = 1  # Move up toward ask
            limit_cap = bid + spread * self.max_improve_pct
        else:
            # Seller starts at mid, improves toward bid
            start_price = mid
            improve_direction = -1  # Move down toward bid
            limit_cap = ask - spread * self.max_improve_pct
            
        current_price = start_price
        
        for attempt_num in range(1, self.max_attempts + 1):
            # Check timeout
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            if elapsed > self.max_duration:
                logger.warning(f"Execution timeout after {elapsed:.1f}s")
                return ExecutionResult(
                    success=total_filled > 0,
                    state=ExecutionState.TIMEOUT,
                    filled_qty=total_filled,
                    avg_fill_price=sum(fill_prices) / len(fill_prices) if fill_prices else None,
                    total_attempts=attempt_num - 1,
                    attempts=attempts,
                    latency_ms=elapsed * 1000,
                )
            
            # Calculate limit price for this attempt
            if attempt_num > 1:
                improvement = spread * self.step_pct * (attempt_num - 1)
                current_price = start_price + improve_direction * improvement
                # Cap at max improvement
                if side == "buy":
                    current_price = min(current_price, limit_cap)
                else:
                    current_price = max(current_price, limit_cap)
            
            # Round to 2 decimal places
            limit_price = round(current_price, 2)
            
            attempt = OrderAttempt(
                attempt_num=attempt_num,
                limit_price=limit_price,
                submitted_at=datetime.utcnow(),
            )
            
            try:
                # Submit order
                order_id = await submit_fn(symbol, side, remaining_qty, limit_price)
                attempt.broker_order_id = order_id
                attempt.status = ExecutionState.WORKING
                
                logger.info(
                    f"Attempt {attempt_num}: {side} {remaining_qty}x {symbol} @ ${limit_price:.2f}"
                )
                
                # Wait and check
                await asyncio.sleep(self.attempt_interval)
                
                status, filled, price = await check_fn(order_id)
                
                if filled > 0:
                    attempt.filled_qty = filled
                    attempt.fill_price = price
                    attempt.status = ExecutionState.FILLED if filled >= remaining_qty else ExecutionState.PARTIAL
                    
                    total_filled += filled
                    if price:
                        fill_prices.extend([price] * filled)
                    remaining_qty -= filled
                    
                    if remaining_qty <= 0:
                        attempts.append(attempt)
                        
                        avg_price = sum(fill_prices) / len(fill_prices) if fill_prices else limit_price
                        slippage = abs(avg_price - mid) / mid * 10000  # bps
                        
                        return ExecutionResult(
                            success=True,
                            state=ExecutionState.FILLED,
                            filled_qty=total_filled,
                            avg_fill_price=avg_price,
                            total_attempts=attempt_num,
                            attempts=attempts,
                            latency_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
                            slippage_bps=slippage,
                        )
                
                # Cancel remaining if not fully filled
                if remaining_qty > 0 and attempt_num < self.max_attempts:
                    await cancel_fn(order_id)
                    
            except Exception as e:
                attempt.status = ExecutionState.FAILED
                attempt.error = str(e)
                logger.error(f"Attempt {attempt_num} failed: {e}")
                
            attempts.append(attempt)
        
        # Max attempts reached
        return ExecutionResult(
            success=total_filled > 0,
            state=ExecutionState.PARTIAL if total_filled > 0 else ExecutionState.FAILED,
            filled_qty=total_filled,
            avg_fill_price=sum(fill_prices) / len(fill_prices) if fill_prices else None,
            total_attempts=len(attempts),
            attempts=attempts,
            latency_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
            error="Max attempts reached" if total_filled == 0 else None,
        )
