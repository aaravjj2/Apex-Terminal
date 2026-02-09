"""
Deterministic Paper Execution Simulator

Simulates realistic fills, slippage, and partial-fill failures for paper trading.
All operations are deterministic when given the same seed for reproducible backtests.

Based on Research Plan v1 requirements.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import hashlib
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class FillStatus(str, Enum):
    """Status of a fill attempt."""
    FILLED = "filled"
    PARTIAL = "partial"
    UNFILLED = "unfilled"
    CANCELLED = "cancelled"


class TimeBucket(str, Enum):
    """Time-to-fill buckets."""
    INSTANT = "0s"
    FAST = "30s"
    MEDIUM = "2m"
    SLOW = "5m"
    TIMEOUT = "timeout"


@dataclass
class LegQuote:
    """Quote data for a single option leg."""
    symbol: str
    bid: float
    ask: float
    mid: float = 0.0
    open_interest: int = 0
    volume: int = 0
    is_etf: bool = False
    
    def __post_init__(self):
        if self.mid == 0.0:
            self.mid = (self.bid + self.ask) / 2
    
    @property
    def spread(self) -> float:
        return self.ask - self.bid
    
    @property
    def spread_pct(self) -> float:
        if self.mid <= 0:
            return 1.0
        return self.spread / self.mid


@dataclass
class ComboOrder:
    """Multi-leg combo order for execution."""
    order_id: str
    legs: List[LegQuote]
    is_credit: bool  # True = selling premium (credit), False = buying (debit)
    limit_price: float  # Net limit price (positive = credit, negative = debit)
    attempt_number: int = 1


@dataclass
class FillResult:
    """Result of a fill attempt."""
    status: FillStatus
    fill_price: float = 0.0
    slippage: float = 0.0
    time_bucket: TimeBucket = TimeBucket.TIMEOUT
    partial_legs: List[str] = field(default_factory=list)
    rejection_reason: Optional[str] = None
    attempt_number: int = 1


@dataclass
class ExecutionMetrics:
    """Metrics for execution analysis."""
    total_attempts: int = 0
    filled_count: int = 0
    partial_count: int = 0
    unfilled_count: int = 0
    total_slippage: float = 0.0
    avg_slippage: float = 0.0
    fill_rate: float = 0.0
    avg_time_bucket: str = ""


class DeterministicExecutionSimulator:
    """
    Deterministic paper execution simulator.
    
    Features:
    - Seeded randomness for reproducibility
    - Fill probability based on spread and liquidity
    - Retry ladder with price improvement
    - Slippage model tied to spread and attempt
    - Partial fill incidents with forced close
    """
    
    MAX_ATTEMPTS = 3
    
    def __init__(self, seed_base: str = "autopilot"):
        self.seed_base = seed_base
        self._metrics = ExecutionMetrics()
    
    def _get_deterministic_random(self, order_id: str, attempt: int, purpose: str) -> float:
        """
        Generate deterministic pseudo-random value [0, 1) from order context.
        Same inputs always produce same output.
        """
        seed_str = f"{self.seed_base}:{order_id}:{attempt}:{purpose}"
        hash_bytes = hashlib.sha256(seed_str.encode()).digest()
        # Use first 8 bytes as integer, normalize to [0, 1)
        int_val = int.from_bytes(hash_bytes[:8], 'big')
        return int_val / (2**64)
    
    def calculate_fill_probability(self, combo: ComboOrder) -> float:
        """
        Calculate fill probability for a combo order.
        
        Factors:
        - Average spread% across legs
        - Worst leg spread% (weakest link)
        - ETF vs stock (ETFs have better fills)
        - Attempt number (price improvements help)
        """
        if not combo.legs:
            return 0.0
        
        # Calculate spread metrics
        spreads = [leg.spread_pct for leg in combo.legs]
        avg_spread = sum(spreads) / len(spreads)
        max_spread = max(spreads)
        
        # Base probability from average spread
        if avg_spread <= 0.005:  # <= 0.5%
            base_prob = 0.85
        elif avg_spread <= 0.015:  # 0.5-1.5%
            base_prob = 0.55
        elif avg_spread <= 0.025:  # 1.5-2.5%
            base_prob = 0.30
        else:  # > 2.5%
            base_prob = 0.10
        
        # Penalty for worst leg
        if max_spread > 0.03:
            base_prob *= 0.7
        
        # ETF bonus
        etf_ratio = sum(1 for leg in combo.legs if leg.is_etf) / len(combo.legs)
        base_prob += 0.10 * etf_ratio
        
        # Attempt bonus (price improvements)
        attempt_bonus = {1: 0.0, 2: 0.15, 3: 0.25}
        base_prob += attempt_bonus.get(combo.attempt_number, 0.25)
        
        return min(0.95, max(0.05, base_prob))
    
    def calculate_slippage_fraction(self, attempt: int, is_etf: bool) -> float:
        """
        Calculate slippage as fraction of spread.
        
        Attempt 1: 0-20% of spread
        Attempt 2: 20-40% of spread
        Attempt 3: 40-50% of spread
        """
        slippage_ranges = {
            1: (0.00, 0.20),
            2: (0.20, 0.40),
            3: (0.40, 0.50),
        }
        
        min_slip, max_slip = slippage_ranges.get(attempt, (0.40, 0.50))
        
        # ETFs get slightly better fills
        if is_etf:
            max_slip *= 0.8
        
        return (min_slip + max_slip) / 2  # Use midpoint for determinism
    
    def calculate_limit_price_improvement(self, attempt: int, avg_spread: float) -> float:
        """
        Calculate price improvement for retry attempts.
        
        Attempt 2: Improve by 10-20% of spread
        Attempt 3: Improve by 30-40% more
        """
        improvements = {
            1: 0.0,
            2: 0.15 * avg_spread,
            3: 0.35 * avg_spread,
        }
        return improvements.get(attempt, 0.40 * avg_spread)
    
    def simulate_time_to_fill(self, order_id: str, attempt: int, fill_prob: float) -> TimeBucket:
        """
        Simulate time-to-fill bucket based on probability.
        """
        rand = self._get_deterministic_random(order_id, attempt, "time")
        
        if fill_prob >= 0.8:
            # High probability = fast fills
            if rand < 0.7:
                return TimeBucket.INSTANT
            elif rand < 0.9:
                return TimeBucket.FAST
            else:
                return TimeBucket.MEDIUM
        elif fill_prob >= 0.5:
            # Medium probability
            if rand < 0.3:
                return TimeBucket.FAST
            elif rand < 0.7:
                return TimeBucket.MEDIUM
            else:
                return TimeBucket.SLOW
        else:
            # Low probability = slow or timeout
            if rand < 0.4:
                return TimeBucket.MEDIUM
            elif rand < 0.7:
                return TimeBucket.SLOW
            else:
                return TimeBucket.TIMEOUT
    
    def check_partial_fill_risk(self, order_id: str, attempt: int) -> bool:
        """
        Determine if a partial fill incident occurs.
        
        Partial fills are rare but must be modeled for realism.
        ~5% chance per fill attempt.
        """
        rand = self._get_deterministic_random(order_id, attempt, "partial")
        return rand < 0.05
    
    def simulate_fill(self, combo: ComboOrder) -> FillResult:
        """
        Simulate a single fill attempt for a combo order.
        
        Returns FillResult with status, price, slippage, and timing.
        """
        self._metrics.total_attempts += 1
        
        # Calculate fill probability
        fill_prob = self.calculate_fill_probability(combo)
        
        # Deterministic "coin flip" for fill
        rand = self._get_deterministic_random(
            combo.order_id, combo.attempt_number, "fill"
        )
        
        if rand > fill_prob:
            # No fill
            self._metrics.unfilled_count += 1
            return FillResult(
                status=FillStatus.UNFILLED,
                time_bucket=TimeBucket.TIMEOUT,
                attempt_number=combo.attempt_number,
                rejection_reason=f"Fill probability {fill_prob:.1%} not met"
            )
        
        # Check for partial fill incident
        if self.check_partial_fill_risk(combo.order_id, combo.attempt_number):
            self._metrics.partial_count += 1
            # Pick a random leg that "fills first"
            leg_idx = int(self._get_deterministic_random(
                combo.order_id, combo.attempt_number, "leg"
            ) * len(combo.legs))
            partial_leg = combo.legs[leg_idx].symbol
            
            return FillResult(
                status=FillStatus.PARTIAL,
                fill_price=combo.limit_price,
                partial_legs=[partial_leg],
                time_bucket=TimeBucket.MEDIUM,
                attempt_number=combo.attempt_number,
                rejection_reason=f"Partial fill on {partial_leg}, forced close required"
            )
        
        # Full fill - calculate slippage
        is_mostly_etf = sum(1 for leg in combo.legs if leg.is_etf) > len(combo.legs) / 2
        avg_spread = sum(leg.spread for leg in combo.legs) / len(combo.legs)
        
        slip_frac = self.calculate_slippage_fraction(combo.attempt_number, is_mostly_etf)
        slippage = slip_frac * avg_spread
        
        # Apply slippage (negative for buyer, positive for seller)
        if combo.is_credit:
            # Selling premium: worse = lower credit
            fill_price = combo.limit_price - slippage
        else:
            # Buying premium: worse = higher debit
            fill_price = combo.limit_price + slippage
        
        # Time to fill
        time_bucket = self.simulate_time_to_fill(
            combo.order_id, combo.attempt_number, fill_prob
        )
        
        self._metrics.filled_count += 1
        self._metrics.total_slippage += abs(slippage)
        
        return FillResult(
            status=FillStatus.FILLED,
            fill_price=fill_price,
            slippage=slippage,
            time_bucket=time_bucket,
            attempt_number=combo.attempt_number
        )
    
    def execute_with_retries(self, combo: ComboOrder) -> FillResult:
        """
        Execute order with retry ladder.
        
        Up to MAX_ATTEMPTS with price improvements on each retry.
        """
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            combo.attempt_number = attempt
            
            # Apply price improvement for retries
            if attempt > 1:
                avg_spread = sum(leg.spread for leg in combo.legs) / len(combo.legs)
                improvement = self.calculate_limit_price_improvement(attempt, avg_spread)
                
                if combo.is_credit:
                    # Accept lower credit
                    combo.limit_price -= improvement
                else:
                    # Accept higher debit
                    combo.limit_price += improvement
            
            result = self.simulate_fill(combo)
            
            if result.status == FillStatus.FILLED:
                return result
            
            if result.status == FillStatus.PARTIAL:
                # Partial fills don't retry, must handle incident
                return result
        
        # All attempts failed
        return FillResult(
            status=FillStatus.UNFILLED,
            time_bucket=TimeBucket.TIMEOUT,
            attempt_number=self.MAX_ATTEMPTS,
            rejection_reason=f"Failed after {self.MAX_ATTEMPTS} attempts"
        )
    
    def handle_partial_fill_incident(
        self,
        partial_result: FillResult,
        combo: ComboOrder,
    ) -> Tuple[FillResult, float]:
        """
        Handle a partial fill incident.
        
        When one leg fills but others don't:
        1. Attempt to fill hedge leg at worse price
        2. If hedge fails, force-close partial at market
        
        Returns:
            (final_result, incident_cost)
        """
        if partial_result.status != FillStatus.PARTIAL:
            return partial_result, 0.0
        
        # Simulate hedge attempt (one more try at worse price)
        hedge_success_rand = self._get_deterministic_random(
            combo.order_id, combo.attempt_number, "hedge"
        )
        
        if hedge_success_rand > 0.3:
            # Hedge succeeded with extra slippage
            extra_slippage = sum(leg.spread for leg in combo.legs) * 0.25
            
            final_result = FillResult(
                status=FillStatus.FILLED,
                fill_price=partial_result.fill_price,
                slippage=partial_result.slippage + extra_slippage,
                time_bucket=TimeBucket.SLOW,
                attempt_number=partial_result.attempt_number,
                rejection_reason="Recovered from partial fill"
            )
            return final_result, extra_slippage
        else:
            # Forced close at market
            force_close_cost = sum(leg.spread for leg in combo.legs) * 0.5
            
            final_result = FillResult(
                status=FillStatus.CANCELLED,
                fill_price=0.0,
                slippage=force_close_cost,
                time_bucket=TimeBucket.SLOW,
                attempt_number=partial_result.attempt_number,
                rejection_reason=f"Partial fill forced close, cost ${force_close_cost:.2f}"
            )
            return final_result, force_close_cost
    
    def get_metrics(self) -> ExecutionMetrics:
        """Get accumulated execution metrics."""
        if self._metrics.filled_count > 0:
            self._metrics.avg_slippage = (
                self._metrics.total_slippage / self._metrics.filled_count
            )
        
        total = (
            self._metrics.filled_count +
            self._metrics.partial_count +
            self._metrics.unfilled_count
        )
        if total > 0:
            self._metrics.fill_rate = self._metrics.filled_count / total
        
        return self._metrics
    
    def reset_metrics(self):
        """Reset accumulated metrics."""
        self._metrics = ExecutionMetrics()


# Singleton instance
_simulator: Optional[DeterministicExecutionSimulator] = None


def get_execution_simulator(seed: str = "autopilot") -> DeterministicExecutionSimulator:
    """Get or create the execution simulator."""
    global _simulator
    if _simulator is None or _simulator.seed_base != seed:
        _simulator = DeterministicExecutionSimulator(seed)
    return _simulator
