"""
V1 Execution Contract
=====================
Phase 2: Deterministic, limit-only execution with bounded chase.

V1 Execution Rules:
1. LIMIT ORDERS ONLY - market orders are rejected
2. Bounded chase ladder - max 3 attempts, max 5% spread improvement
3. Deterministic paper fills - mid-point slippage
4. Position validation before execution
5. Anti-thrash integration
6. HARD $1000 TOTAL EXPOSURE LIMIT - absolute cap, no exceptions

This module provides the V1ExecutionContract that wraps all execution logic.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple
from enum import Enum
import logging
import asyncio

from .config import V1_MAX_TOTAL_EXPOSURE_USD, V1_PAPER_EQUITY

logger = logging.getLogger(__name__)


# =============================================================================
# V1 EXECUTION CONSTANTS
# =============================================================================

V1_MAX_CHASE_ATTEMPTS = 3           # Max limit order attempts per trade
V1_MAX_CHASE_SPREAD_PCT = 0.05      # Max 5% of spread to chase
V1_CHASE_STEP_PCT = 0.02            # 2% of spread per step
V1_ATTEMPT_TIMEOUT_SEC = 5.0        # Timeout per attempt
V1_TOTAL_TIMEOUT_SEC = 20.0         # Total execution timeout

# HARD LIMITS (non-negotiable)
V1_MAX_SINGLE_POSITION_USD = 150.0  # Max $150 per position
V1_MAX_TOTAL_COST_USD = 500.0       # Max $500 total deployed


class ExecutionStatus(str, Enum):
    """V1 Execution status codes."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    FILLED = "filled"
    PARTIAL = "partial"
    TIMEOUT = "timeout"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    BLOCKED_RISK = "blocked_risk"
    BLOCKED_THRASH = "blocked_thrash"


@dataclass
class V1ExecutionAttempt:
    """Record of a single execution attempt."""
    attempt_num: int
    limit_price: float
    submitted_at: datetime
    status: ExecutionStatus = ExecutionStatus.PENDING
    filled_qty: int = 0
    fill_price: Optional[float] = None
    broker_order_id: Optional[str] = None
    error: Optional[str] = None
    latency_ms: float = 0.0


@dataclass
class V1ExecutionResult:
    """Result of V1 execution attempt."""
    success: bool
    status: ExecutionStatus
    ticker: str
    template: str
    requested_qty: int
    filled_qty: int
    avg_fill_price: Optional[float]
    total_attempts: int
    attempts: List[V1ExecutionAttempt] = field(default_factory=list)
    total_latency_ms: float = 0.0
    slippage_bps: float = 0.0  # Basis points from mid price
    rejection_reason: Optional[str] = None
    broker_order_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "status": self.status.value,
            "ticker": self.ticker,
            "template": self.template,
            "requested_qty": self.requested_qty,
            "filled_qty": self.filled_qty,
            "avg_fill_price": self.avg_fill_price,
            "total_attempts": self.total_attempts,
            "total_latency_ms": self.total_latency_ms,
            "slippage_bps": self.slippage_bps,
            "rejection_reason": self.rejection_reason,
            "broker_order_id": self.broker_order_id,
        }


class V1ExecutionContract:
    """
    V1 Execution Contract - enforces all V1 execution rules.
    
    This class is the ONLY valid entry point for trade execution in V1.
    It enforces:
    - Limit orders only
    - Bounded chase ladder
    - Risk limit validation
    - Anti-thrash gates
    - Deterministic paper fills
    - HARD $1000 TOTAL EXPOSURE LIMIT (CRITICAL)
    - MAX $150 per single position
    - MAX $500 total deployed
    """
    
    def __init__(self):
        self._execution_count = 0
        self._fill_count = 0
        self._rejection_count = 0
        
        # HARD LIMIT TRACKING
        self._total_deployed_usd = 0.0
        self._position_costs: Dict[str, float] = {}  # position_id -> cost
        
        # Metrics
        self._total_slippage_bps = 0.0
        self._total_latency_ms = 0.0
    
    def get_total_deployed(self) -> float:
        """Get current total deployed capital."""
        return self._total_deployed_usd
    
    def get_available_capital(self) -> float:
        """Get available capital for new trades."""
        return max(0, V1_MAX_TOTAL_COST_USD - self._total_deployed_usd)
    
    def record_position_closed(self, position_id: str, cost: float = None):
        """Record a position being closed, freeing up capital."""
        if position_id in self._position_costs:
            freed = self._position_costs.pop(position_id)
            self._total_deployed_usd -= freed
            logger.info(f"💰 Capital freed: ${freed:.2f} (total deployed: ${self._total_deployed_usd:.2f})")
        elif cost is not None:
            self._total_deployed_usd = max(0, self._total_deployed_usd - cost)
            logger.info(f"💰 Capital freed: ${cost:.2f} (total deployed: ${self._total_deployed_usd:.2f})")
    
    def reset_capital_tracking(self):
        """Reset capital tracking (for new day or testing)."""
        self._total_deployed_usd = 0.0
        self._position_costs = {}
        logger.info("V1 Execution: Capital tracking reset")
    
    async def execute(
        self,
        candidate: Dict[str, Any],
        bid: float,
        ask: float,
        broker_submit_fn,
        broker_check_fn,
        broker_cancel_fn,
        engine: Any = None,  # UnifiedAutopilotEngine for anti-thrash
        current_positions: List[Dict[str, Any]] = None,  # Current open positions
    ) -> V1ExecutionResult:
        """
        Execute a trade candidate with V1 contract enforcement.
        
        Args:
            candidate: Trade candidate dict with symbol, template, qty, etc.
            bid: Current best bid
            ask: Current best ask
            broker_submit_fn: async fn(symbol, limit_price, qty) -> order_id
            broker_check_fn: async fn(order_id) -> (status, filled_qty, fill_price)
            broker_cancel_fn: async fn(order_id) -> bool
            engine: Optional UnifiedAutopilotEngine for anti-thrash checking
            current_positions: List of current open positions for exposure check
        
        Returns:
            V1ExecutionResult with fill details
        """
        self._execution_count += 1
        start_time = datetime.utcnow()
        
        ticker = candidate.get("symbol", "UNKNOWN")
        template = candidate.get("template", "unknown")
        qty = candidate.get("qty", 1)
        multiplier = candidate.get("multiplier", 100)  # Options multiplier
        
        # Estimate trade cost (for long premium, cost = mid price * qty * multiplier)
        mid_estimate = (bid + ask) / 2
        estimated_cost = mid_estimate * qty * multiplier
        
        # V1 GATE 1: Template validation (only long premium)
        if template not in ["long_call", "long_put"]:
            self._rejection_count += 1
            return V1ExecutionResult(
                success=False,
                status=ExecutionStatus.REJECTED,
                ticker=ticker,
                template=template,
                requested_qty=qty,
                filled_qty=0,
                avg_fill_price=None,
                total_attempts=0,
                rejection_reason=f"V1 rejects template {template} - only long_call/long_put allowed",
            )
        
        # ====================================================================
        # V1 GATE 2: HARD $1000 TOTAL EXPOSURE LIMIT (CRITICAL)
        # ====================================================================
        # Calculate current total exposure from positions
        current_exposure = self._total_deployed_usd
        if current_positions:
            # Recalculate from actual positions as source of truth
            current_exposure = sum(
                pos.get("cost_basis", 0) or pos.get("entry_price", 0) * pos.get("qty", 1) * 100
                for pos in current_positions
            )
            self._total_deployed_usd = current_exposure  # Sync
        
        new_total_exposure = current_exposure + estimated_cost
        
        if new_total_exposure > V1_MAX_TOTAL_EXPOSURE_USD:
            self._rejection_count += 1
            logger.warning(f"🚫 V1 HARD LIMIT: Trade rejected - would exceed $1000 limit "
                          f"(current: ${current_exposure:.2f}, trade: ${estimated_cost:.2f}, "
                          f"total: ${new_total_exposure:.2f})")
            return V1ExecutionResult(
                success=False,
                status=ExecutionStatus.BLOCKED_RISK,
                ticker=ticker,
                template=template,
                requested_qty=qty,
                filled_qty=0,
                avg_fill_price=None,
                total_attempts=0,
                rejection_reason=f"V1 HARD LIMIT: Would exceed $1000 total exposure "
                               f"(current: ${current_exposure:.2f}, trade: ${estimated_cost:.2f})",
            )
        
        # ====================================================================
        # V1 GATE 3: MAX $150 PER SINGLE POSITION
        # ====================================================================
        if estimated_cost > V1_MAX_SINGLE_POSITION_USD:
            self._rejection_count += 1
            logger.warning(f"🚫 V1 POSITION LIMIT: Trade rejected - ${estimated_cost:.2f} > ${V1_MAX_SINGLE_POSITION_USD} max")
            return V1ExecutionResult(
                success=False,
                status=ExecutionStatus.BLOCKED_RISK,
                ticker=ticker,
                template=template,
                requested_qty=qty,
                filled_qty=0,
                avg_fill_price=None,
                total_attempts=0,
                rejection_reason=f"V1 POSITION LIMIT: ${estimated_cost:.2f} exceeds ${V1_MAX_SINGLE_POSITION_USD} max per position",
            )
        
        # ====================================================================
        # V1 GATE 4: MAX $500 TOTAL DEPLOYED
        # ====================================================================
        if new_total_exposure > V1_MAX_TOTAL_COST_USD:
            self._rejection_count += 1
            logger.warning(f"🚫 V1 DEPLOYMENT LIMIT: Trade rejected - would exceed $500 deployed capital")
            return V1ExecutionResult(
                success=False,
                status=ExecutionStatus.BLOCKED_RISK,
                ticker=ticker,
                template=template,
                requested_qty=qty,
                filled_qty=0,
                avg_fill_price=None,
                total_attempts=0,
                rejection_reason=f"V1 DEPLOYMENT LIMIT: Would exceed $500 max deployed "
                               f"(current: ${current_exposure:.2f}, trade: ${estimated_cost:.2f})",
            )
        
        # V1 GATE 5: Anti-thrash check (if engine provided)
        if engine is not None:
            allowed, reason = engine._check_anti_thrash_gates(ticker)
            if not allowed:
                self._rejection_count += 1
                return V1ExecutionResult(
                    success=False,
                    status=ExecutionStatus.BLOCKED_THRASH,
                    ticker=ticker,
                    template=template,
                    requested_qty=qty,
                    filled_qty=0,
                    avg_fill_price=None,
                    total_attempts=0,
                    rejection_reason=f"Anti-thrash: {reason}",
                )
        
        # V1 GATE 6: Valid bid/ask
        if bid <= 0 or ask <= 0 or ask < bid:
            self._rejection_count += 1
            return V1ExecutionResult(
                success=False,
                status=ExecutionStatus.REJECTED,
                ticker=ticker,
                template=template,
                requested_qty=qty,
                filled_qty=0,
                avg_fill_price=None,
                total_attempts=0,
                rejection_reason=f"Invalid bid/ask: bid={bid}, ask={ask}",
            )
        
        # Calculate execution ladder
        spread = ask - bid
        mid = (bid + ask) / 2
        
        # For long premium (buying), start at mid, chase up toward ask
        # V1: Max 3 attempts, max 5% of spread improvement
        attempts = []
        filled_qty = 0
        fill_price = None
        broker_order_id = None
        
        for attempt_num in range(1, V1_MAX_CHASE_ATTEMPTS + 1):
            # Check total timeout
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            if elapsed > V1_TOTAL_TIMEOUT_SEC:
                logger.warning(f"V1 execution timeout for {ticker} after {elapsed:.1f}s")
                break
            
            # Calculate limit price for this attempt
            # Step 1: mid, Step 2: mid + 2% spread, Step 3: mid + 4% spread (capped at 5%)
            chase_pct = min(V1_CHASE_STEP_PCT * (attempt_num - 1), V1_MAX_CHASE_SPREAD_PCT)
            limit_price = round(mid + spread * chase_pct, 2)
            
            # Never exceed the ask (cap at ask - 0.01)
            limit_price = min(limit_price, ask - 0.01)
            
            attempt = V1ExecutionAttempt(
                attempt_num=attempt_num,
                limit_price=limit_price,
                submitted_at=datetime.utcnow(),
            )
            
            logger.info(f"V1 execution attempt {attempt_num}/{V1_MAX_CHASE_ATTEMPTS}: "
                       f"{ticker} limit=${limit_price:.2f} (mid=${mid:.2f}, chase={chase_pct*100:.1f}%)")
            
            try:
                # Submit limit order
                order_id = await broker_submit_fn(ticker, limit_price, qty)
                attempt.broker_order_id = order_id
                broker_order_id = order_id
                attempt.status = ExecutionStatus.SUBMITTED
                
                # Wait for fill with timeout
                attempt_start = datetime.utcnow()
                while (datetime.utcnow() - attempt_start).total_seconds() < V1_ATTEMPT_TIMEOUT_SEC:
                    await asyncio.sleep(0.3)
                    
                    status, fill_qty, fill_px = await broker_check_fn(order_id)
                    
                    if status == "filled":
                        attempt.status = ExecutionStatus.FILLED
                        attempt.filled_qty = fill_qty
                        attempt.fill_price = fill_px
                        filled_qty = fill_qty
                        fill_price = fill_px
                        break
                    elif status in ["rejected", "cancelled", "expired"]:
                        attempt.status = ExecutionStatus.REJECTED
                        attempt.error = status
                        break
                
                attempt.latency_ms = (datetime.utcnow() - attempt_start).total_seconds() * 1000
                
                # If filled, we're done
                if attempt.status == ExecutionStatus.FILLED:
                    attempts.append(attempt)
                    break
                
                # Not filled, cancel and try next step
                if attempt.status == ExecutionStatus.SUBMITTED:
                    try:
                        await broker_cancel_fn(order_id)
                        attempt.status = ExecutionStatus.CANCELLED
                    except Exception:
                        pass
                
            except Exception as e:
                attempt.status = ExecutionStatus.REJECTED
                attempt.error = str(e)
                logger.warning(f"V1 execution attempt {attempt_num} failed: {e}")
            
            attempts.append(attempt)
        
        # Build result
        total_latency = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        if filled_qty > 0:
            self._fill_count += 1
            slippage_bps = ((fill_price - mid) / mid) * 10000 if fill_price else 0
            self._total_slippage_bps += slippage_bps
            self._total_latency_ms += total_latency
            
            # TRACK DEPLOYED CAPITAL (CRITICAL for $1000 limit)
            actual_cost = fill_price * filled_qty * multiplier
            position_id = f"{ticker}_{template}_{datetime.utcnow().timestamp()}"
            self._position_costs[position_id] = actual_cost
            self._total_deployed_usd += actual_cost
            logger.info(f"💵 Capital deployed: ${actual_cost:.2f} (total: ${self._total_deployed_usd:.2f} / ${V1_MAX_TOTAL_EXPOSURE_USD})")
            
            return V1ExecutionResult(
                success=True,
                status=ExecutionStatus.FILLED,
                ticker=ticker,
                template=template,
                requested_qty=qty,
                filled_qty=filled_qty,
                avg_fill_price=fill_price,
                total_attempts=len(attempts),
                attempts=attempts,
                total_latency_ms=total_latency,
                slippage_bps=slippage_bps,
                broker_order_id=broker_order_id,
            )
        else:
            self._rejection_count += 1
            return V1ExecutionResult(
                success=False,
                status=ExecutionStatus.TIMEOUT,
                ticker=ticker,
                template=template,
                requested_qty=qty,
                filled_qty=0,
                avg_fill_price=None,
                total_attempts=len(attempts),
                attempts=attempts,
                total_latency_ms=total_latency,
                rejection_reason="All execution attempts exhausted",
            )
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get execution metrics."""
        return {
            "total_executions": self._execution_count,
            "fills": self._fill_count,
            "rejections": self._rejection_count,
            "fill_rate": self._fill_count / self._execution_count if self._execution_count > 0 else 0.0,
            "avg_slippage_bps": self._total_slippage_bps / self._fill_count if self._fill_count > 0 else 0.0,
            "avg_latency_ms": self._total_latency_ms / self._fill_count if self._fill_count > 0 else 0.0,
        }
    
    def reset_metrics(self) -> None:
        """Reset execution metrics."""
        self._execution_count = 0
        self._fill_count = 0
        self._rejection_count = 0
        self._total_slippage_bps = 0.0
        self._total_latency_ms = 0.0


# =============================================================================
# DETERMINISTIC PAPER FILL SIMULATOR
# =============================================================================

class V1DeterministicFillSimulator:
    """
    Deterministic fill simulator for V1 paper trading.
    
    Rules:
    - Fills at mid-point of spread (deterministic slippage)
    - No random rejection
    - Immediate fill if limit price >= ask (for buys)
    - Commission: $0.65 per contract
    """
    
    COMMISSION_PER_CONTRACT = 0.65
    
    def __init__(self):
        self._order_counter = 0
        self._fills: List[Dict] = []
    
    async def submit_order(self, symbol: str, limit_price: float, qty: int) -> str:
        """Submit a paper order."""
        self._order_counter += 1
        order_id = f"V1-PAPER-{self._order_counter:06d}"
        logger.debug(f"V1 paper order submitted: {order_id} {symbol} @ ${limit_price:.2f} x {qty}")
        return order_id
    
    async def check_order(
        self, order_id: str, bid: float = 0.0, ask: float = 0.0
    ) -> Tuple[str, int, Optional[float]]:
        """
        Check order status - deterministic fill logic.
        
        For V1 paper trading:
        - Always fills at mid-point (deterministic)
        - No random failure
        """
        mid = (bid + ask) / 2 if bid > 0 and ask > 0 else None
        
        # Deterministic: always fill at mid
        fill_price = mid if mid else 1.0  # Fallback to $1.00 if no quotes
        
        self._fills.append({
            "order_id": order_id,
            "fill_price": fill_price,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        return "filled", 1, fill_price
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel a paper order."""
        logger.debug(f"V1 paper order cancelled: {order_id}")
        return True
    
    def get_fills(self) -> List[Dict]:
        """Get all fills."""
        return self._fills.copy()
    
    def reset(self) -> None:
        """Reset simulator state."""
        self._order_counter = 0
        self._fills.clear()


# =============================================================================
# SINGLETON ACCESS
# =============================================================================

_v1_execution_contract: Optional[V1ExecutionContract] = None


def get_v1_execution_contract() -> V1ExecutionContract:
    """Get the singleton V1 execution contract."""
    global _v1_execution_contract
    if _v1_execution_contract is None:
        _v1_execution_contract = V1ExecutionContract()
    return _v1_execution_contract


def reset_v1_execution_contract() -> None:
    """Reset the V1 execution contract (for testing)."""
    global _v1_execution_contract
    _v1_execution_contract = None
