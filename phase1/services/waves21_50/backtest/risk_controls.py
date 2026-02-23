"""
Wave 30 — Risk Controls in Simulation
Position limits, drawdown breakers, sector limits, and risk checks during backtest.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from .portfolio_accounting import PortfolioLedger


@dataclass
class RiskLimits:
    """Configurable risk limits for backtest simulation."""
    max_position_pct: float = 0.20       # Max % of equity in single position
    max_portfolio_positions: int = 20     # Max concurrent positions
    max_drawdown_pct: float = 0.25       # Kill switch at this drawdown
    max_daily_loss_pct: float = 0.05     # Max daily loss
    max_sector_pct: float = 0.40         # Max sector concentration
    min_cash_reserve_pct: float = 0.05   # Always keep this % in cash
    max_order_size: float = 10000        # Max shares per order
    max_leverage: float = 1.0            # No leverage by default

    def to_dict(self) -> Dict[str, Any]:
        return {
            "max_position_pct": self.max_position_pct,
            "max_portfolio_positions": self.max_portfolio_positions,
            "max_drawdown_pct": self.max_drawdown_pct,
            "max_daily_loss_pct": self.max_daily_loss_pct,
            "max_sector_pct": self.max_sector_pct,
            "min_cash_reserve_pct": self.min_cash_reserve_pct,
            "max_order_size": self.max_order_size,
            "max_leverage": self.max_leverage,
        }


@dataclass
class RiskCheckResult:
    passed: bool = True
    violations: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    drawdown_breaker_triggered: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "violations": self.violations,
            "warnings": self.warnings,
            "drawdown_breaker_triggered": self.drawdown_breaker_triggered,
        }


class RiskController:
    """Risk controller for backtest simulation."""

    def __init__(self, limits: Optional[RiskLimits] = None) -> None:
        self.limits = limits or RiskLimits()
        self._daily_start_equity: float = 0.0
        self._breaker_triggered = False
        self._violation_log: List[Dict[str, Any]] = []

    def set_day_start(self, equity: float) -> None:
        self._daily_start_equity = equity

    def check_order(self, ledger: PortfolioLedger, symbol: str,
                    qty: float, price: float, prices: Dict[str, float]) -> RiskCheckResult:
        """Check if an order passes risk limits."""
        result = RiskCheckResult()
        equity = ledger.total_equity(prices)

        if self._breaker_triggered:
            result.passed = False
            result.violations.append("Drawdown breaker previously triggered")
            result.drawdown_breaker_triggered = True
            return result

        # Max drawdown check
        dd = ledger.max_drawdown()
        if dd >= self.limits.max_drawdown_pct:
            result.passed = False
            result.drawdown_breaker_triggered = True
            self._breaker_triggered = True
            result.violations.append(
                f"Max drawdown breaker: {dd:.2%} >= {self.limits.max_drawdown_pct:.2%}"
            )
            return result

        # Position size check
        position_value = abs(qty * price)
        if equity > 0 and position_value / equity > self.limits.max_position_pct:
            result.passed = False
            result.violations.append(
                f"Position size {position_value / equity:.2%} exceeds max {self.limits.max_position_pct:.2%}"
            )

        # Max positions check
        active_positions = sum(1 for p in ledger.positions.values() if not p.is_flat)
        if active_positions >= self.limits.max_portfolio_positions:
            # Allow closing existing positions
            existing = ledger.positions.get(symbol)
            if existing is None or existing.is_flat:
                result.passed = False
                result.violations.append(
                    f"Max positions ({self.limits.max_portfolio_positions}) reached"
                )

        # Order size check
        if abs(qty) > self.limits.max_order_size:
            result.passed = False
            result.violations.append(
                f"Order size {abs(qty)} exceeds max {self.limits.max_order_size}"
            )

        # Cash reserve check
        min_cash = equity * self.limits.min_cash_reserve_pct
        if ledger.cash - position_value < min_cash:
            result.warnings.append("Order would breach minimum cash reserve")

        # Daily loss check
        if self._daily_start_equity > 0:
            daily_loss = (self._daily_start_equity - equity) / self._daily_start_equity
            if daily_loss >= self.limits.max_daily_loss_pct:
                result.passed = False
                result.violations.append(
                    f"Daily loss {daily_loss:.2%} >= max {self.limits.max_daily_loss_pct:.2%}"
                )

        if not result.passed:
            self._violation_log.append({
                "symbol": symbol,
                "qty": qty,
                "price": price,
                "violations": result.violations,
            })

        return result

    def get_violations(self) -> List[Dict[str, Any]]:
        return self._violation_log

    def reset(self) -> None:
        self._breaker_triggered = False
        self._daily_start_equity = 0.0
        self._violation_log = []
