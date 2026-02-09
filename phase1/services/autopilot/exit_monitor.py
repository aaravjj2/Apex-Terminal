"""
Exit Monitoring Engine - V1 SINGLE EXIT AUTHORITY (OPTIMIZED FOR WIN RATE)

V1 COMPLIANCE: This is the ONE and ONLY exit authority.
All exit decisions flow through this module.

OPTIMIZED Exit Rules (V1 Long Premium) - HIGH WIN RATE:
1. Hard stop at -15% (TIGHTER to preserve capital) - IMMEDIATE
2. Trailing stop activates at +10% gain, trails at 8% below high
3. Partial profit at +10% (exit 50% of position)
4. Full profit target at +20% (faster profit-taking)
5. Break-even stop: Move stop to entry after +8% gain
6. Time stop at DTE <= 2 (earlier exit for time decay)
7. Regime change: CHAOS → close ALL positions - IMMEDIATE
8. EOD flatten for 0DTE positions - IMMEDIATE
9. Maximum hold time: 5 days (avoid dead money)

NO OTHER MODULE should have independent exit logic.
"""

import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from collections import deque

logger = logging.getLogger(__name__)


# ============================================================================
# V1 EXIT CONSTANTS (OPTIMIZED FOR HIGH WIN RATE)
# ============================================================================
from .config import V1_PER_POSITION_STOP_PCT

# Use the V1 contract constant for hard stop to maintain consistency
V1_HARD_STOP_PCT = V1_PER_POSITION_STOP_PCT  # 10% hard stop (V1 CONTRACT)
V1_PROFIT_TARGET_PCT = 0.20      # +20% take profit (faster)
V1_PARTIAL_PROFIT_PCT = 0.10     # +10% partial profit (scale out)
V1_PARTIAL_EXIT_RATIO = 0.50     # Exit 50% at partial profit
V1_BREAK_EVEN_TRIGGER_PCT = 0.08 # Move stop to break-even at +8%
V1_TRAILING_STOP_ACTIVATION = 0.10  # Activate trailing at +10%
V1_TRAILING_STOP_DISTANCE = 0.08    # Trail 8% below high
V1_TIME_STOP_DTE = 2             # Close at DTE <= 2 (earlier)
V1_MAX_HOLD_DAYS = 5             # Max 5 days hold time


class ExitTrigger(str, Enum):
    """Exit trigger types."""
    HARD_STOP = "hard_stop"                # V1: -15% immediate
    TRAILING_STOP = "trailing_stop"        # Trail below high watermark
    BREAK_EVEN_STOP = "break_even_stop"    # Stop moved to entry
    PARTIAL_PROFIT = "partial_profit"      # +10% scale out
    PROFIT_TARGET = "profit_target"        # +20% full exit
    TIME_STOP = "time_stop"                # DTE <= 2
    MAX_HOLD_TIME = "max_hold_time"        # 5 days
    EOD_FLATTEN = "eod_flatten"            # End of day 0DTE
    REGIME_CHANGE = "regime_change"        # CHAOS regime
    DAILY_LOSS_CAP = "daily_loss_cap"
    NEWS_SHOCK = "news_shock"
    MANUAL = "manual"

@dataclass
class ExitSignal:
    """Exit signal with details."""
    trigger: ExitTrigger
    triggered: bool
    current_value: float
    threshold: float
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "trigger": self.trigger.value,
            "triggered": self.triggered,
            "current_value": self.current_value,
            "threshold": self.threshold,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
        }

@dataclass
class PositionMonitor:
    """Monitor state for a single position with ADVANCED exit logic."""
    position_id: str
    entry_price: float
    entry_time: datetime
    is_debit: bool  # True for V1 long premium
    # V1 CONTRACT: Optimized exit parameters
    hard_stop_pct: float = V1_HARD_STOP_PCT           # -15%
    profit_target_pct: float = V1_PROFIT_TARGET_PCT   # +20%
    partial_profit_pct: float = V1_PARTIAL_PROFIT_PCT # +10%
    partial_exit_ratio: float = V1_PARTIAL_EXIT_RATIO # 50%
    break_even_trigger_pct: float = V1_BREAK_EVEN_TRIGGER_PCT  # +8%
    trailing_stop_activation: float = V1_TRAILING_STOP_ACTIVATION  # +10%
    trailing_stop_distance: float = V1_TRAILING_STOP_DISTANCE      # 8%
    time_stop_dte: int = V1_TIME_STOP_DTE             # DTE <= 2
    max_hold_days: int = V1_MAX_HOLD_DAYS             # 5 days
    
    # Advanced tracking
    samples: List[Dict[str, Any]] = field(default_factory=list)
    min_price_seen: float = float('inf')
    max_price_seen: float = 0.0
    high_water_mark: float = 0.0  # For trailing stop
    dte: Optional[int] = None  # Days to expiration
    stop_moved_to_breakeven: bool = False  # Track if stop is at break-even
    partial_taken: bool = False  # Track if partial profit was taken
    trailing_active: bool = False  # Track if trailing stop is active
    current_stop_price: float = 0.0  # Dynamic stop price
    
    def __post_init__(self):
        """Initialize dynamic stop price."""
        self.current_stop_price = self.entry_price * (1 - self.hard_stop_pct)
        self.high_water_mark = self.entry_price
    
    def record_sample(self, current_price: float, timestamp: datetime, dte: Optional[int] = None) -> List[ExitSignal]:
        """
        Record a price sample and evaluate all exit triggers.
        
        OPTIMIZED V1: Advanced exit logic with trailing stops.
        
        Returns list of triggered signals.
        """
        self.samples.append({
            "timestamp": timestamp.isoformat(),
            "price": current_price,
        })
        
        if dte is not None:
            self.dte = dte
        
        self.min_price_seen = min(self.min_price_seen, current_price)
        self.max_price_seen = max(self.max_price_seen, current_price)
        
        # Update high water mark for trailing stop
        if current_price > self.high_water_mark:
            self.high_water_mark = current_price
        
        signals = []
        
        # V1: Long premium positions - loss = price decline from entry
        pnl_pct = (current_price - self.entry_price) / self.entry_price if self.entry_price > 0 else 0
        high_pnl_pct = (self.high_water_mark - self.entry_price) / self.entry_price if self.entry_price > 0 else 0
        
        # ====================================================================
        # 1. HARD STOP (-15%) - IMMEDIATE (V1 mandate)
        # ====================================================================
        if pnl_pct <= -self.hard_stop_pct:
            logger.warning(f"🛑 V1 HARD STOP: {self.position_id} at {pnl_pct*100:.1f}% loss")
            signals.append(ExitSignal(
                trigger=ExitTrigger.HARD_STOP,
                triggered=True,
                current_value=pnl_pct,
                threshold=-self.hard_stop_pct,
                timestamp=timestamp,
                details={"immediate": True, "v1_mandate": True}
            ))
            return signals  # Hard stop trumps everything
        
        # ====================================================================
        # 2. BREAK-EVEN STOP - Move stop to entry after +8% gain
        # ====================================================================
        if not self.stop_moved_to_breakeven and high_pnl_pct >= self.break_even_trigger_pct:
            self.stop_moved_to_breakeven = True
            self.current_stop_price = self.entry_price  # Move stop to break-even
            logger.info(f"📊 BREAK-EVEN: {self.position_id} stop moved to ${self.entry_price:.2f}")
        
        # Check break-even stop
        if self.stop_moved_to_breakeven and not self.trailing_active:
            if current_price <= self.current_stop_price:
                logger.info(f"🔒 BREAK-EVEN EXIT: {self.position_id} at break-even")
                signals.append(ExitSignal(
                    trigger=ExitTrigger.BREAK_EVEN_STOP,
                    triggered=True,
                    current_value=pnl_pct,
                    threshold=0,
                    timestamp=timestamp,
                    details={"break_even": True}
                ))
                return signals
        
        # ====================================================================
        # 3. TRAILING STOP - Activate at +10%, trail 8% below high
        # ====================================================================
        if high_pnl_pct >= self.trailing_stop_activation:
            if not self.trailing_active:
                self.trailing_active = True
                logger.info(f"📈 TRAILING ACTIVATED: {self.position_id} at {high_pnl_pct*100:.1f}% high")
            
            # Update trailing stop price
            trailing_stop_price = self.high_water_mark * (1 - self.trailing_stop_distance)
            self.current_stop_price = max(self.current_stop_price, trailing_stop_price)
            
            # Check if trailing stop triggered
            if current_price <= self.current_stop_price:
                trailing_pnl = (current_price - self.entry_price) / self.entry_price
                logger.info(f"📉 TRAILING STOP: {self.position_id} at {trailing_pnl*100:.1f}% (from {high_pnl_pct*100:.1f}% high)")
                signals.append(ExitSignal(
                    trigger=ExitTrigger.TRAILING_STOP,
                    triggered=True,
                    current_value=trailing_pnl,
                    threshold=self.trailing_stop_distance,
                    timestamp=timestamp,
                    details={
                        "high_water_mark": self.high_water_mark,
                        "trailing_stop_price": self.current_stop_price,
                        "locked_profit_pct": trailing_pnl,
                    }
                ))
                return signals
        
        # ====================================================================
        # 4. PARTIAL PROFIT (+10%) - Scale out 50%
        # ====================================================================
        if not self.partial_taken and pnl_pct >= self.partial_profit_pct:
            self.partial_taken = True
            logger.info(f"💰 PARTIAL PROFIT: {self.position_id} at {pnl_pct*100:.1f}% - exit {self.partial_exit_ratio*100:.0f}%")
            signals.append(ExitSignal(
                trigger=ExitTrigger.PARTIAL_PROFIT,
                triggered=True,
                current_value=pnl_pct,
                threshold=self.partial_profit_pct,
                timestamp=timestamp,
                details={
                    "exit_ratio": self.partial_exit_ratio,
                    "partial": True,
                }
            ))
            # Note: Don't return - allow checking other conditions
        
        # ====================================================================
        # 5. FULL PROFIT TARGET (+20%)
        # ====================================================================
        if pnl_pct >= self.profit_target_pct:
            logger.info(f"🎯 V1 PROFIT TARGET: {self.position_id} at {pnl_pct*100:.1f}% gain")
            signals.append(ExitSignal(
                trigger=ExitTrigger.PROFIT_TARGET,
                triggered=True,
                current_value=pnl_pct,
                threshold=self.profit_target_pct,
                timestamp=timestamp,
            ))
            return signals  # Full exit
        
        # ====================================================================
        # 6. TIME STOP (DTE <= 2) - Earlier exit for time decay
        # ====================================================================
        if self.dte is not None and self.dte <= self.time_stop_dte:
            logger.info(f"⏰ V1 TIME STOP: {self.position_id} at DTE={self.dte}")
            signals.append(ExitSignal(
                trigger=ExitTrigger.TIME_STOP,
                triggered=True,
                current_value=self.dte,
                threshold=self.time_stop_dte,
                timestamp=timestamp,
                details={"dte": self.dte}
            ))
        
        # ====================================================================
        # 7. MAX HOLD TIME (5 days) - Avoid dead money
        # ====================================================================
        hold_time = timestamp - self.entry_time
        if hold_time.days >= self.max_hold_days:
            logger.info(f"⏳ MAX HOLD TIME: {self.position_id} held {hold_time.days} days")
            signals.append(ExitSignal(
                trigger=ExitTrigger.MAX_HOLD_TIME,
                triggered=True,
                current_value=hold_time.days,
                threshold=self.max_hold_days,
                timestamp=timestamp,
                details={"hold_days": hold_time.days, "pnl_pct": pnl_pct}
            ))
        
        return signals

class ExitMonitor:
    """
    V1 SINGLE EXIT AUTHORITY
    
    Monitors all positions for exit conditions.
    This is the ONLY class that should evaluate exits.
    """
    
    def __init__(
        self,
        eod_exit_minutes: float = 30.0,  # Exit 30 min before close for 0DTE
        daily_loss_cap: float = 500.0,   # Stop trading after this loss
    ):
        self.eod_exit_minutes = eod_exit_minutes
        self.daily_loss_cap = daily_loss_cap
        self._positions: Dict[str, PositionMonitor] = {}
        self._daily_pnl: float = 0.0
        self._current_regime: str = "normal"
        logger.info("V1 ExitMonitor initialized (Single Exit Authority)")
    
    def set_regime(self, regime: str):
        """Set current market regime. CHAOS = force close all."""
        old_regime = self._current_regime
        self._current_regime = regime.lower()
        if old_regime != self._current_regime:
            logger.warning(f"Regime changed: {old_regime} → {self._current_regime}")
    
    def register_position(
        self,
        position_id: str,
        entry_price: float,
        entry_time: datetime,
        dte: Optional[int] = None,
    ) -> PositionMonitor:
        """
        Register a new position for monitoring.
        
        V1 COMPLIANCE: All positions use V1 exit rules (long premium).
        """
        monitor = PositionMonitor(
            position_id=position_id,
            entry_price=entry_price,
            entry_time=entry_time,
            is_debit=True,  # V1: Long premium only
            hard_stop_pct=V1_HARD_STOP_PCT,
            profit_target_pct=V1_PROFIT_TARGET_PCT,
            time_stop_dte=V1_TIME_STOP_DTE,
            dte=dte,
        )
        
        self._positions[position_id] = monitor
        logger.info(f"V1 ExitMonitor: Registered {position_id} (entry=${entry_price:.2f}, DTE={dte})")
        return monitor
    
    def check_position(
        self,
        position_id: str,
        current_price: float,
        market_close_time: Optional[datetime] = None,
        dte: Optional[int] = None,
    ) -> List[ExitSignal]:
        """
        Check a position for exit conditions.
        
        V1 SINGLE AUTHORITY: All exit decisions go through here.
        
        Returns list of triggered exit signals.
        """
        if position_id not in self._positions:
            logger.warning(f"Position {position_id} not registered for monitoring")
            return []
        
        monitor = self._positions[position_id]
        now = datetime.now(timezone.utc)
        
        signals = monitor.record_sample(current_price, now, dte=dte)
        
        # Check CHAOS regime → immediate exit
        if self._current_regime == "chaos":
            logger.warning(f"⚠️ CHAOS REGIME: Force closing {position_id}")
            signals.append(ExitSignal(
                trigger=ExitTrigger.REGIME_CHANGE,
                triggered=True,
                current_value=0,
                threshold=0,
                timestamp=now,
                details={"regime": "chaos", "immediate": True}
            ))
        
        # Check EOD flatten for 0DTE
        if market_close_time and monitor.dte is not None and monitor.dte == 0:
            minutes_to_close = (market_close_time - now).total_seconds() / 60
            if minutes_to_close <= self.eod_exit_minutes:
                logger.info(f"🌅 EOD FLATTEN: {position_id} (0DTE, {minutes_to_close:.0f}m to close)")
                signals.append(ExitSignal(
                    trigger=ExitTrigger.EOD_FLATTEN,
                    triggered=True,
                    current_value=minutes_to_close,
                    threshold=self.eod_exit_minutes,
                    timestamp=now,
                    details={"dte": 0, "minutes_to_close": minutes_to_close}
                ))
        
        # Check daily loss cap
        if self._daily_pnl <= -self.daily_loss_cap:
            signals.append(ExitSignal(
                trigger=ExitTrigger.DAILY_LOSS_CAP,
                triggered=True,
                current_value=self._daily_pnl,
                threshold=-self.daily_loss_cap,
                timestamp=now,
            ))
        
        return signals
    
    def check_all_positions(
        self,
        price_updates: Dict[str, float],
        market_close_time: Optional[datetime] = None,
    ) -> Dict[str, List[ExitSignal]]:
        """
        Check all registered positions for exit conditions.
        
        Args:
            price_updates: Dict mapping position_id to current_price
            market_close_time: When market closes (for EOD logic)
            
        Returns:
            Dict mapping position_id to list of exit signals
        """
        all_signals = {}
        
        for pos_id, monitor in self._positions.items():
            if pos_id in price_updates:
                signals = self.check_position(
                    pos_id,
                    price_updates[pos_id],
                    market_close_time=market_close_time,
                )
                if signals:
                    all_signals[pos_id] = signals
        
        return all_signals
    
    def on_position_closed(self, position_id: str, realized_pnl: float):
        """Record position close and update daily PnL."""
        if position_id in self._positions:
            del self._positions[position_id]
        self._daily_pnl += realized_pnl
        logger.info(f"Position {position_id} closed. PnL: ${realized_pnl:.2f}. Daily: ${self._daily_pnl:.2f}")
    
    def reset_daily(self):
        """Reset for new trading day."""
        self._daily_pnl = 0.0
        logger.info("V1 ExitMonitor: Daily reset complete")


# ============================================================================
# SINGLETON ACCESS
# ============================================================================

_exit_monitor: Optional[ExitMonitor] = None


def get_exit_monitor() -> ExitMonitor:
    """Get singleton ExitMonitor instance (V1 Single Authority)."""
    global _exit_monitor
    if _exit_monitor is None:
        _exit_monitor = ExitMonitor()
    return _exit_monitor


def reset_exit_monitor():
    """Reset singleton (for testing)."""
    global _exit_monitor
    _exit_monitor = None
