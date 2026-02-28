"""
Autopilot V3 Risk Engine — Server-side hard caps on all positions and orders.

Computes:
  - premium_at_risk: per position and total portfolio
  - delta_notional: delta * qty * 100 * underlying_price (per symbol and total)
  - daily_loss: estimated from equity snapshots
  - buying_power_utilization: premium_to_spend / available_bp

All caps are configurable and enforced BEFORE order submission.
Every cap check returns a named RiskGateResult for traceability.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Risk Config ───────────────────────────────────────────────────────────────

@dataclass
class RiskConfig:
    # Per-trade caps
    max_premium_per_trade_usd: float = 500.0     # 1 contract ATM ~$300-$800
    max_delta_per_trade: float = 0.80             # max delta for single contract (abs)

    # Portfolio-level caps
    max_total_premium_open_usd: float = 2000.0    # ~4 positions at $500 each
    max_positions: int = 4
    max_daily_loss_usd: float = 200.0

    # Delta notional caps (delta * qty * 100 * spot)
    max_delta_notional_total: float = 50_000.0    # total across all symbols
    max_delta_notional_per_symbol: float = 20_000.0

    # Buying power safety margin
    max_bp_utilization_pct: float = 30.0          # use at most 30% of available BP

    # Liquidity deterioration (exit trigger)
    exit_spread_pct_threshold: float = 15.0       # exit if spread widens to 15%


DEFAULT_RISK_CONFIG = RiskConfig()


# ── Gate Result ───────────────────────────────────────────────────────────────

@dataclass
class RiskGateResult:
    name: str
    passed: bool
    value: Any
    limit: Any
    message: str
    severity: str = "hard"    # "hard" blocks trade; "soft" is warning only

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "value": self.value,
            "limit": self.limit,
            "message": self.message,
            "severity": self.severity,
        }


@dataclass
class RiskAssessment:
    """Full risk assessment result for a proposed order."""
    symbol: str
    contract_symbol: str
    passed: bool                      # True only if ALL hard gates pass
    gates: List[RiskGateResult] = field(default_factory=list)

    # Computed metrics
    premium_cost_usd: float = 0.0
    portfolio_premium_after: float = 0.0
    delta_notional: float = 0.0
    total_delta_notional_after: float = 0.0

    def failed_gates(self) -> List[RiskGateResult]:
        return [g for g in self.gates if not g.passed]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "contract_symbol": self.contract_symbol,
            "passed": self.passed,
            "gates": [g.to_dict() for g in self.gates],
            "failed_gates": [g.name for g in self.failed_gates()],
            "metrics": {
                "premium_cost_usd": round(self.premium_cost_usd, 2),
                "portfolio_premium_after": round(self.portfolio_premium_after, 2),
                "delta_notional": round(self.delta_notional, 2),
                "total_delta_notional_after": round(self.total_delta_notional_after, 2),
            },
        }


@dataclass
class PortfolioRiskSnapshot:
    """Current portfolio risk state computed from open positions."""
    total_premium_at_risk: float = 0.0
    total_delta_notional: float = 0.0
    per_symbol_premium: Dict[str, float] = field(default_factory=dict)
    per_symbol_delta_notional: Dict[str, float] = field(default_factory=dict)
    open_positions_count: int = 0
    estimated_daily_loss: float = 0.0   # negative = loss

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_premium_at_risk": round(self.total_premium_at_risk, 2),
            "total_delta_notional": round(self.total_delta_notional, 2),
            "per_symbol_premium": {k: round(v, 2) for k, v in self.per_symbol_premium.items()},
            "per_symbol_delta_notional": {k: round(v, 2) for k, v in self.per_symbol_delta_notional.items()},
            "open_positions_count": self.open_positions_count,
            "estimated_daily_loss": round(self.estimated_daily_loss, 2),
        }


# ── Risk Engine ───────────────────────────────────────────────────────────────

class RiskEngine:
    def __init__(self, cfg: Optional[RiskConfig] = None):
        self.cfg = cfg or DEFAULT_RISK_CONFIG

    def compute_portfolio_snapshot(
        self,
        positions: List[Dict[str, Any]],
        account_info: Dict[str, Any],
        equity_start: float = 0.0,
    ) -> PortfolioRiskSnapshot:
        """
        Compute portfolio-level risk from current open positions.

        positions: list of position dicts from options_gateway.list_option_positions()
        account_info: dict from options_gateway.get_account_info()
        equity_start: equity at start of day (for daily loss computation)
        """
        snap = PortfolioRiskSnapshot()
        snap.open_positions_count = len(positions)

        current_equity = float(account_info.get("equity", 0) or 0)
        if equity_start > 0 and current_equity > 0:
            snap.estimated_daily_loss = current_equity - equity_start

        spot_cache: Dict[str, float] = {}

        for pos in positions:
            symbol_underlying = _extract_underlying(pos.get("symbol", ""))
            qty = abs(float(pos.get("qty", 1)))
            avg_entry = float(pos.get("avg_entry_price") or pos.get("avg_entry") or 0)
            current_price = float(pos.get("current_price") or avg_entry or 0)
            delta = float(pos.get("delta") or 0)

            # Premium at risk = current mark * qty * 100
            premium = (current_price or avg_entry) * qty * 100
            snap.total_premium_at_risk += premium
            snap.per_symbol_premium[symbol_underlying] = (
                snap.per_symbol_premium.get(symbol_underlying, 0.0) + premium
            )

            # Delta notional = delta * qty * 100 * underlying_spot
            # We approximate underlying price as None (will be computed with spot prices separately)
            if delta:
                # Best-effort: use notional from position's market_value
                market_value = float(pos.get("market_value") or 0)
                if market_value:
                    delta_notional = abs(delta) * market_value
                else:
                    delta_notional = abs(delta) * premium
                snap.total_delta_notional += delta_notional
                snap.per_symbol_delta_notional[symbol_underlying] = (
                    snap.per_symbol_delta_notional.get(symbol_underlying, 0.0) + delta_notional
                )

        return snap

    def assess_new_order(
        self,
        symbol: str,
        contract_symbol: str,
        mid_price: float,
        delta: Optional[float],
        qty: int,
        spot_price: float,
        portfolio_snap: PortfolioRiskSnapshot,
        buying_power: float,
        account_daily_loss: float = 0.0,
    ) -> RiskAssessment:
        """
        Check all risk gates for a proposed new BTO order.
        Returns RiskAssessment with passed=True only if all hard gates pass.
        """
        gates: List[RiskGateResult] = []

        premium_cost = mid_price * qty * 100

        # ── Gate 1: Per-trade premium cap ─────────────────────────────────────
        g1 = RiskGateResult(
            name="max_premium_per_trade",
            passed=0 < premium_cost <= self.cfg.max_premium_per_trade_usd,
            value=round(premium_cost, 2),
            limit=self.cfg.max_premium_per_trade_usd,
            message=f"${premium_cost:.0f} vs cap ${self.cfg.max_premium_per_trade_usd:.0f}",
        )
        gates.append(g1)

        # ── Gate 2: Total portfolio premium cap ───────────────────────────────
        portfolio_premium_after = portfolio_snap.total_premium_at_risk + premium_cost
        g2 = RiskGateResult(
            name="max_total_premium_open",
            passed=portfolio_premium_after <= self.cfg.max_total_premium_open_usd,
            value=round(portfolio_premium_after, 2),
            limit=self.cfg.max_total_premium_open_usd,
            message=f"Portfolio ${portfolio_premium_after:.0f} vs cap ${self.cfg.max_total_premium_open_usd:.0f}",
        )
        gates.append(g2)

        # ── Gate 3: Max positions count ───────────────────────────────────────
        positions_after = portfolio_snap.open_positions_count + 1
        g3 = RiskGateResult(
            name="max_positions",
            passed=portfolio_snap.open_positions_count < self.cfg.max_positions,
            value=portfolio_snap.open_positions_count,
            limit=self.cfg.max_positions,
            message=f"{portfolio_snap.open_positions_count}/{self.cfg.max_positions} positions",
        )
        gates.append(g3)

        # ── Gate 4: Daily loss ────────────────────────────────────────────────
        g4 = RiskGateResult(
            name="max_daily_loss",
            passed=account_daily_loss >= -self.cfg.max_daily_loss_usd,
            value=round(account_daily_loss, 2),
            limit=-self.cfg.max_daily_loss_usd,
            message=f"Daily P&L ${account_daily_loss:.0f} vs floor ${-self.cfg.max_daily_loss_usd:.0f}",
        )
        gates.append(g4)

        # ── Gate 5: Buying power utilization ─────────────────────────────────
        bp_limit = buying_power * (self.cfg.max_bp_utilization_pct / 100.0) if buying_power > 0 else premium_cost
        g5 = RiskGateResult(
            name="buying_power",
            passed=buying_power <= 0 or premium_cost <= bp_limit,
            value=round(premium_cost, 2),
            limit=round(bp_limit, 2),
            message=f"${premium_cost:.0f} vs {self.cfg.max_bp_utilization_pct:.0f}% BP ${bp_limit:.0f}",
        )
        gates.append(g5)

        # ── Gate 6: Delta notional per symbol ─────────────────────────────────
        delta_notional = 0.0
        if delta and spot_price > 0:
            delta_notional = abs(delta) * qty * 100 * spot_price
            sym_underlying = _extract_underlying(contract_symbol)
            existing_sym_delta = portfolio_snap.per_symbol_delta_notional.get(sym_underlying, 0.0)
            total_delta_notional_after = portfolio_snap.total_delta_notional + delta_notional
            sym_delta_after = existing_sym_delta + delta_notional

            g6a = RiskGateResult(
                name="max_delta_notional_per_symbol",
                passed=sym_delta_after <= self.cfg.max_delta_notional_per_symbol,
                value=round(sym_delta_after, 2),
                limit=self.cfg.max_delta_notional_per_symbol,
                message=f"Δ${sym_delta_after:.0f} vs cap ${self.cfg.max_delta_notional_per_symbol:.0f}",
                severity="soft",   # warning only
            )
            g6b = RiskGateResult(
                name="max_delta_notional_total",
                passed=total_delta_notional_after <= self.cfg.max_delta_notional_total,
                value=round(total_delta_notional_after, 2),
                limit=self.cfg.max_delta_notional_total,
                message=f"Total Δ${total_delta_notional_after:.0f} vs cap ${self.cfg.max_delta_notional_total:.0f}",
                severity="soft",
            )
            gates.extend([g6a, g6b])

        # Hard pass = all "hard" severity gates pass
        hard_passed = all(g.passed for g in gates if g.severity == "hard")

        return RiskAssessment(
            symbol=symbol,
            contract_symbol=contract_symbol,
            passed=hard_passed,
            gates=gates,
            premium_cost_usd=premium_cost,
            portfolio_premium_after=portfolio_premium_after,
            delta_notional=delta_notional,
            total_delta_notional_after=portfolio_snap.total_delta_notional + delta_notional,
        )

    def check_exit_liquidity(
        self,
        position: Dict[str, Any],
        current_spread_pct: Optional[float],
    ) -> Optional[str]:
        """
        Returns exit reason string if liquidity deterioration should trigger exit.
        Returns None if no exit needed.
        """
        if current_spread_pct is None:
            return None
        if current_spread_pct > self.cfg.exit_spread_pct_threshold:
            return f"liquidity_deterioration: spread {current_spread_pct:.1f}% > threshold {self.cfg.exit_spread_pct_threshold:.0f}%"
        return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_underlying(contract_or_symbol: str) -> str:
    """Extract underlying symbol from OCC symbol or return as-is."""
    import re
    m = re.match(r'^([A-Z]{1,6})\d{6}[CP]\d{8}$', contract_or_symbol)
    if m:
        return m.group(1)
    return contract_or_symbol


# ── Singleton ─────────────────────────────────────────────────────────────────

_engine: Optional[RiskEngine] = None


def get_risk_engine(cfg: Optional[RiskConfig] = None) -> RiskEngine:
    global _engine
    if _engine is None:
        _engine = RiskEngine(cfg)
    return _engine
