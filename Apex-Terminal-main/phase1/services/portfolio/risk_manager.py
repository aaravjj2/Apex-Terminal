"""
Risk Manager - Pre-trade risk checks and position limits.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import logging

from .manager import PortfolioManager, Position


logger = logging.getLogger(__name__)


class RiskCheckResult(str, Enum):
    PASSED = "passed"
    REJECTED = "rejected"
    WARNING = "warning"


@dataclass
class RiskLimits:
    """Configuration for risk limits."""
    # Position limits
    max_position_size: float = 10000.0  # Max notional value per position
    max_position_pct: float = 20.0  # Max % of equity per position
    max_shares_per_order: int = 1000  # Max shares per single order
    
    # Portfolio limits
    max_total_exposure: float = 100000.0  # Max total notional exposure
    max_exposure_pct: float = 100.0  # Max % of equity as exposure
    max_leverage: float = 1.0  # Max leverage ratio
    
    # Order limits
    min_order_value: float = 10.0  # Minimum order value
    max_order_value: float = 50000.0  # Maximum order value
    
    # Loss limits
    max_daily_loss: float = 5000.0  # Max daily loss before halt
    max_daily_loss_pct: float = 5.0  # Max daily loss % before halt
    stop_loss_required: bool = False  # Require stop-loss on all orders
    
    # Symbol restrictions
    allowed_symbols: Optional[List[str]] = None  # If set, only these allowed
    blocked_symbols: List[str] = field(default_factory=list)


@dataclass
class RiskCheckResponse:
    """Result of a risk check."""
    result: RiskCheckResult
    checks: Dict[str, Tuple[bool, str]]  # check_name -> (passed, message)
    
    @property
    def passed(self) -> bool:
        return self.result == RiskCheckResult.PASSED
    
    @property
    def rejection_reasons(self) -> List[str]:
        return [msg for passed, msg in self.checks.values() if not passed]
    
    def to_dict(self) -> dict:
        return {
            "result": self.result.value,
            "passed": self.passed,
            "checks": {k: {"passed": v[0], "message": v[1]} for k, v in self.checks.items()},
            "rejection_reasons": self.rejection_reasons,
        }


class RiskManager:
    """
    Manages risk limits and performs pre-trade checks.
    """
    
    def __init__(
        self,
        portfolio: PortfolioManager,
        limits: Optional[RiskLimits] = None
    ):
        self.portfolio = portfolio
        self.limits = limits or RiskLimits()
        self.daily_realized_pnl: float = 0.0
        self.trading_halted: bool = False
        self.halt_reason: Optional[str] = None
    
    def check_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        order_type: str = "market"
    ) -> RiskCheckResponse:
        """
        Perform pre-trade risk checks on an order.
        
        Args:
            symbol: Instrument symbol
            side: "buy" or "sell"
            quantity: Number of shares
            price: Expected price
            order_type: Order type (market, limit, etc.)
        
        Returns:
            RiskCheckResponse with all check results
        """
        checks: Dict[str, Tuple[bool, str]] = {}
        
        # Check if trading is halted
        if self.trading_halted:
            checks["trading_halt"] = (False, f"Trading halted: {self.halt_reason}")
            return RiskCheckResponse(result=RiskCheckResult.REJECTED, checks=checks)
        
        order_value = quantity * price
        position = self.portfolio.get_position(symbol)
        
        # 1. Symbol allowed check
        if self.limits.allowed_symbols:
            allowed = symbol in self.limits.allowed_symbols
            checks["symbol_allowed"] = (
                allowed,
                f"Symbol {'allowed' if allowed else 'not in allowed list'}"
            )
        
        # 2. Symbol blocked check
        blocked = symbol in self.limits.blocked_symbols
        checks["symbol_blocked"] = (
            not blocked,
            f"Symbol {'blocked' if blocked else 'not blocked'}"
        )
        
        # 3. Min order value
        min_ok = order_value >= self.limits.min_order_value
        checks["min_order_value"] = (
            min_ok,
            f"Order value ${order_value:.2f} {'meets' if min_ok else 'below'} minimum ${self.limits.min_order_value:.2f}"
        )
        
        # 4. Max order value
        max_ok = order_value <= self.limits.max_order_value
        checks["max_order_value"] = (
            max_ok,
            f"Order value ${order_value:.2f} {'within' if max_ok else 'exceeds'} maximum ${self.limits.max_order_value:.2f}"
        )
        
        # 5. Max shares per order
        shares_ok = quantity <= self.limits.max_shares_per_order
        checks["max_shares"] = (
            shares_ok,
            f"Quantity {quantity} {'within' if shares_ok else 'exceeds'} limit of {self.limits.max_shares_per_order}"
        )
        
        # 6. Position size after order
        new_position_qty = position.quantity
        if side == "buy":
            new_position_qty += quantity
        else:
            new_position_qty -= quantity
        
        new_position_value = abs(new_position_qty * price)
        pos_size_ok = new_position_value <= self.limits.max_position_size
        checks["max_position_size"] = (
            pos_size_ok,
            f"Position value ${new_position_value:.2f} {'within' if pos_size_ok else 'exceeds'} limit ${self.limits.max_position_size:.2f}"
        )
        
        # 7. Position as % of equity
        equity = self.portfolio.equity
        if equity > 0:
            pos_pct = (new_position_value / equity) * 100
            pos_pct_ok = pos_pct <= self.limits.max_position_pct
            checks["max_position_pct"] = (
                pos_pct_ok,
                f"Position {pos_pct:.1f}% of equity {'within' if pos_pct_ok else 'exceeds'} limit {self.limits.max_position_pct:.1f}%"
            )
        
        # 8. Total exposure after order
        current_exposure = sum(abs(p.market_value) for p in self.portfolio.positions.values())
        # Adjust for this order
        delta_exposure = new_position_value - abs(position.market_value)
        new_exposure = current_exposure + delta_exposure
        
        exp_ok = new_exposure <= self.limits.max_total_exposure
        checks["max_total_exposure"] = (
            exp_ok,
            f"Total exposure ${new_exposure:.2f} {'within' if exp_ok else 'exceeds'} limit ${self.limits.max_total_exposure:.2f}"
        )
        
        # 9. Exposure as % of equity
        if equity > 0:
            exp_pct = (new_exposure / equity) * 100
            exp_pct_ok = exp_pct <= self.limits.max_exposure_pct
            checks["max_exposure_pct"] = (
                exp_pct_ok,
                f"Exposure {exp_pct:.1f}% of equity {'within' if exp_pct_ok else 'exceeds'} limit {self.limits.max_exposure_pct:.1f}%"
            )
        
        # 10. Cash sufficiency for buys
        if side == "buy":
            cash_needed = order_value
            cash_ok = self.portfolio.cash >= cash_needed
            checks["cash_available"] = (
                cash_ok,
                f"Cash ${self.portfolio.cash:.2f} {'sufficient' if cash_ok else 'insufficient'} for ${cash_needed:.2f} order"
            )
        
        # 11. Daily loss limit
        if self.daily_realized_pnl < -self.limits.max_daily_loss:
            checks["daily_loss_limit"] = (
                False,
                f"Daily loss ${abs(self.daily_realized_pnl):.2f} exceeds limit ${self.limits.max_daily_loss:.2f}"
            )
        else:
            checks["daily_loss_limit"] = (True, "Daily loss within limits")
        
        # Determine overall result
        all_passed = all(passed for passed, _ in checks.values())
        
        if all_passed:
            result = RiskCheckResult.PASSED
        else:
            result = RiskCheckResult.REJECTED
        
        response = RiskCheckResponse(result=result, checks=checks)
        
        if not response.passed:
            logger.warning(
                "Risk check failed",
                extra={
                    "symbol": symbol,
                    "side": side,
                    "quantity": quantity,
                    "price": price,
                    "reasons": response.rejection_reasons,
                }
            )
        
        return response
    
    def update_daily_pnl(self, pnl: float) -> None:
        """Update daily realized PnL and check for halt conditions."""
        self.daily_realized_pnl += pnl
        
        # Check daily loss limits
        if self.daily_realized_pnl <= -self.limits.max_daily_loss:
            self.halt_trading(f"Daily loss limit reached: ${abs(self.daily_realized_pnl):.2f}")
        
        equity = self.portfolio.equity
        if equity > 0:
            loss_pct = (abs(self.daily_realized_pnl) / equity) * 100
            if self.daily_realized_pnl < 0 and loss_pct >= self.limits.max_daily_loss_pct:
                self.halt_trading(f"Daily loss percentage reached: {loss_pct:.1f}%")
    
    def halt_trading(self, reason: str) -> None:
        """Halt all trading."""
        self.trading_halted = True
        self.halt_reason = reason
        logger.error(f"Trading halted: {reason}")
    
    def resume_trading(self) -> None:
        """Resume trading."""
        self.trading_halted = False
        self.halt_reason = None
        logger.info("Trading resumed")
    
    def reset_daily_limits(self) -> None:
        """Reset daily limits (call at start of trading day)."""
        self.daily_realized_pnl = 0.0
        if self.halt_reason and "Daily" in self.halt_reason:
            self.resume_trading()
    
    def get_status(self) -> dict:
        """Get current risk status."""
        equity = self.portfolio.equity
        exposure = sum(abs(p.market_value) for p in self.portfolio.positions.values())
        
        return {
            "trading_halted": self.trading_halted,
            "halt_reason": self.halt_reason,
            "daily_realized_pnl": self.daily_realized_pnl,
            "current_exposure": exposure,
            "exposure_pct": (exposure / equity * 100) if equity > 0 else 0,
            "limits": {
                "max_position_size": self.limits.max_position_size,
                "max_total_exposure": self.limits.max_total_exposure,
                "max_daily_loss": self.limits.max_daily_loss,
            }
        }
