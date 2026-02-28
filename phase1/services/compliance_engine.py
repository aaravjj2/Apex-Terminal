"""
Compliance Engine — Position limits, concentration rules, restricted lists,
regulatory checks, pre-trade compliance, post-trade monitoring, exposure limits,
cross-border rules, order validation, audit trail.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class ComplianceStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    PENDING = "pending"


class RuleType(str, Enum):
    POSITION_LIMIT = "position_limit"
    CONCENTRATION_LIMIT = "concentration_limit"
    SECTOR_LIMIT = "sector_limit"
    COUNTRY_LIMIT = "country_limit"
    LIQUIDITY_CONSTRAINT = "liquidity_constraint"
    RESTRICTED_LIST = "restricted_list"
    SHORT_SELL_RESTRICTION = "short_sell_restriction"
    LEVERAGE_LIMIT = "leverage_limit"
    EXPOSURE_LIMIT = "exposure_limit"
    TURNOVER_LIMIT = "turnover_limit"


class ViolationSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class ComplianceRule:
    rule_id: str
    rule_type: str
    description: str
    threshold: float
    severity: str = "medium"
    active: bool = True

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "rule_type": self.rule_type,
            "description": self.description,
            "threshold": self.threshold,
            "severity": self.severity,
            "active": self.active,
        }


@dataclass
class ComplianceCheck:
    rule_id: str
    status: str
    current_value: float
    threshold: float
    message: str
    severity: str = "medium"
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "status": self.status,
            "current_value": round(self.current_value, 4),
            "threshold": round(self.threshold, 4),
            "message": self.message,
            "severity": self.severity,
            "details": self.details,
        }


@dataclass
class ComplianceReport:
    timestamp: str
    total_checks: int
    passed: int
    failed: int
    warnings: int
    checks: list[ComplianceCheck]

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "total_checks": self.total_checks,
            "passed": self.passed,
            "failed": self.failed,
            "warnings": self.warnings,
            "overall_status": "fail" if self.failed > 0 else "warning" if self.warnings > 0 else "pass",
            "checks": [c.to_dict() for c in self.checks],
        }


# ── Position Limit Checks ────────────────────────────────────────────

class PositionLimitChecker:
    @staticmethod
    def check_absolute_limit(
        position_value: float,
        max_value: float,
        symbol: str = "",
    ) -> ComplianceCheck:
        """Check if position value exceeds absolute limit."""
        status = ComplianceStatus.PASS.value
        message = f"Position {symbol} within limits"
        severity = ViolationSeverity.LOW.value

        if position_value > max_value:
            status = ComplianceStatus.FAIL.value
            message = f"Position {symbol} exceeds limit: ${position_value:,.2f} > ${max_value:,.2f}"
            severity = ViolationSeverity.HIGH.value
        elif position_value > max_value * 0.9:
            status = ComplianceStatus.WARNING.value
            message = f"Position {symbol} approaching limit: {position_value / max_value * 100:.1f}%"
            severity = ViolationSeverity.MEDIUM.value

        return ComplianceCheck(
            rule_id="POS_ABS_LIMIT",
            status=status,
            current_value=position_value,
            threshold=max_value,
            message=message,
            severity=severity,
            details={"symbol": symbol, "utilization_pct": round(position_value / max_value * 100 if max_value > 0 else 0, 2)},
        )

    @staticmethod
    def check_portfolio_pct(
        position_value: float,
        portfolio_value: float,
        max_pct: float,
        symbol: str = "",
    ) -> ComplianceCheck:
        """Check if position exceeds portfolio percentage limit."""
        pct = position_value / portfolio_value if portfolio_value > 0 else 0
        status = ComplianceStatus.PASS.value
        message = f"Position {symbol} is {pct * 100:.2f}% of portfolio"

        if pct > max_pct:
            status = ComplianceStatus.FAIL.value
            message = f"Position {symbol} exceeds {max_pct * 100:.1f}% limit: {pct * 100:.2f}%"

        return ComplianceCheck(
            rule_id="POS_PCT_LIMIT",
            status=status,
            current_value=pct,
            threshold=max_pct,
            message=message,
            severity=ViolationSeverity.HIGH.value if status == "fail" else ViolationSeverity.LOW.value,
        )

    @staticmethod
    def check_adv_limit(
        position_shares: float,
        avg_daily_volume: float,
        max_days_to_liquidate: float = 5.0,
        participation_rate: float = 0.10,
    ) -> ComplianceCheck:
        """Check if position can be liquidated within required timeframe."""
        daily_liquidation = avg_daily_volume * participation_rate
        days_to_liquidate = position_shares / daily_liquidation if daily_liquidation > 0 else float("inf")

        status = ComplianceStatus.PASS.value if days_to_liquidate <= max_days_to_liquidate else ComplianceStatus.FAIL.value
        message = f"Estimated {days_to_liquidate:.1f} days to liquidate at {participation_rate * 100:.0f}% participation"

        return ComplianceCheck(
            rule_id="ADV_LIMIT",
            status=status,
            current_value=days_to_liquidate,
            threshold=max_days_to_liquidate,
            message=message,
            severity=ViolationSeverity.HIGH.value if status == "fail" else ViolationSeverity.LOW.value,
        )


# ── Concentration Limits ──────────────────────────────────────────────

class ConcentrationChecker:
    @staticmethod
    def sector_concentration(
        positions: dict[str, float],  # sector -> value
        portfolio_value: float,
        max_sector_pct: float = 0.25,
    ) -> list[ComplianceCheck]:
        """Check sector concentration limits."""
        checks = []

        for sector, value in positions.items():
            pct = value / portfolio_value if portfolio_value > 0 else 0
            status = ComplianceStatus.PASS.value
            severity = ViolationSeverity.LOW.value

            if pct > max_sector_pct:
                status = ComplianceStatus.FAIL.value
                severity = ViolationSeverity.HIGH.value
            elif pct > max_sector_pct * 0.85:
                status = ComplianceStatus.WARNING.value
                severity = ViolationSeverity.MEDIUM.value

            checks.append(ComplianceCheck(
                rule_id=f"SECTOR_CONC_{sector.upper().replace(' ', '_')}",
                status=status,
                current_value=pct,
                threshold=max_sector_pct,
                message=f"Sector {sector}: {pct * 100:.2f}% (limit: {max_sector_pct * 100:.1f}%)",
                severity=severity,
            ))

        return checks

    @staticmethod
    def issuer_concentration(
        positions: dict[str, float],  # issuer -> value
        portfolio_value: float,
        max_issuer_pct: float = 0.05,
    ) -> list[ComplianceCheck]:
        """Check single issuer concentration."""
        checks = []

        for issuer, value in positions.items():
            pct = value / portfolio_value if portfolio_value > 0 else 0

            if pct > max_issuer_pct:
                checks.append(ComplianceCheck(
                    rule_id=f"ISSUER_CONC_{issuer.upper()[:10]}",
                    status=ComplianceStatus.FAIL.value,
                    current_value=pct,
                    threshold=max_issuer_pct,
                    message=f"Issuer {issuer} concentration {pct * 100:.2f}% exceeds {max_issuer_pct * 100:.1f}%",
                    severity=ViolationSeverity.CRITICAL.value,
                ))
            elif pct > max_issuer_pct * 0.8:
                checks.append(ComplianceCheck(
                    rule_id=f"ISSUER_CONC_{issuer.upper()[:10]}",
                    status=ComplianceStatus.WARNING.value,
                    current_value=pct,
                    threshold=max_issuer_pct,
                    message=f"Issuer {issuer} approaching limit: {pct * 100:.2f}%",
                    severity=ViolationSeverity.MEDIUM.value,
                ))

        return checks

    @staticmethod
    def hhi_concentration(
        position_weights: list[float],
        max_hhi: float = 2500,
    ) -> ComplianceCheck:
        """Check portfolio concentration using HHI."""
        hhi = sum(w ** 2 for w in position_weights) * 10000
        status = ComplianceStatus.PASS.value if hhi <= max_hhi else ComplianceStatus.WARNING.value

        return ComplianceCheck(
            rule_id="HHI_CONCENTRATION",
            status=status,
            current_value=hhi,
            threshold=max_hhi,
            message=f"Portfolio HHI: {hhi:.0f} ({'concentrated' if hhi > max_hhi else 'diversified'})",
            severity=ViolationSeverity.MEDIUM.value,
        )


# ── Restricted List ───────────────────────────────────────────────────

class RestrictedListChecker:
    @staticmethod
    def check_restricted(
        symbol: str,
        restricted_list: list[str],
        watch_list: list[str] | None = None,
    ) -> ComplianceCheck:
        """Check if symbol is on restricted or watch list."""
        if symbol.upper() in [s.upper() for s in restricted_list]:
            return ComplianceCheck(
                rule_id="RESTRICTED_LIST",
                status=ComplianceStatus.FAIL.value,
                current_value=1,
                threshold=0,
                message=f"{symbol} is on the RESTRICTED list — trading prohibited",
                severity=ViolationSeverity.CRITICAL.value,
            )

        if watch_list and symbol.upper() in [s.upper() for s in watch_list]:
            return ComplianceCheck(
                rule_id="WATCH_LIST",
                status=ComplianceStatus.WARNING.value,
                current_value=1,
                threshold=0,
                message=f"{symbol} is on the WATCH list — enhanced monitoring required",
                severity=ViolationSeverity.MEDIUM.value,
            )

        return ComplianceCheck(
            rule_id="RESTRICTED_LIST",
            status=ComplianceStatus.PASS.value,
            current_value=0,
            threshold=0,
            message=f"{symbol} is not restricted",
            severity=ViolationSeverity.INFO.value,
        )


# ── Pre-Trade Compliance ──────────────────────────────────────────────

class PreTradeCompliance:
    @staticmethod
    def validate_order(
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        portfolio_value: float,
        current_position: float,
        avg_daily_volume: float,
        restricted_list: list[str],
        max_position_pct: float = 0.05,
        max_order_pct_adv: float = 0.25,
        max_notional: float = 1_000_000,
    ) -> dict:
        """Run pre-trade compliance checks."""
        checks = []

        # Restricted list
        rc = RestrictedListChecker.check_restricted(symbol, restricted_list)
        checks.append(rc)

        # Order size vs ADV
        order_pct_adv = quantity / avg_daily_volume if avg_daily_volume > 0 else 1
        adv_status = ComplianceStatus.PASS.value if order_pct_adv <= max_order_pct_adv else ComplianceStatus.FAIL.value
        checks.append(ComplianceCheck(
            rule_id="ORDER_ADV_CHECK",
            status=adv_status,
            current_value=order_pct_adv,
            threshold=max_order_pct_adv,
            message=f"Order is {order_pct_adv * 100:.1f}% of ADV (limit: {max_order_pct_adv * 100:.0f}%)",
            severity=ViolationSeverity.HIGH.value if adv_status == "fail" else ViolationSeverity.LOW.value,
        ))

        # Notional check
        notional = quantity * price
        not_status = ComplianceStatus.PASS.value if notional <= max_notional else ComplianceStatus.FAIL.value
        checks.append(ComplianceCheck(
            rule_id="ORDER_NOTIONAL",
            status=not_status,
            current_value=notional,
            threshold=max_notional,
            message=f"Order notional ${notional:,.2f} (limit: ${max_notional:,.2f})",
            severity=ViolationSeverity.HIGH.value if not_status == "fail" else ViolationSeverity.LOW.value,
        ))

        # Post-trade position check
        if side == "buy":
            new_position_value = (current_position + quantity) * price
        else:
            new_position_value = abs(current_position - quantity) * price

        pos_pct = new_position_value / portfolio_value if portfolio_value > 0 else 0
        pos_status = ComplianceStatus.PASS.value if pos_pct <= max_position_pct else ComplianceStatus.FAIL.value
        checks.append(ComplianceCheck(
            rule_id="POST_TRADE_POSITION",
            status=pos_status,
            current_value=pos_pct,
            threshold=max_position_pct,
            message=f"Post-trade position: {pos_pct * 100:.2f}% (limit: {max_position_pct * 100:.1f}%)",
            severity=ViolationSeverity.HIGH.value if pos_status == "fail" else ViolationSeverity.LOW.value,
        ))

        # Short-sell check
        if side == "sell" and current_position < quantity:
            checks.append(ComplianceCheck(
                rule_id="SHORT_SELL_CHECK",
                status=ComplianceStatus.WARNING.value,
                current_value=current_position - quantity,
                threshold=0,
                message=f"Order would result in short position of {current_position - quantity:.0f} shares",
                severity=ViolationSeverity.MEDIUM.value,
            ))

        passed = sum(1 for c in checks if c.status == "pass")
        failed = sum(1 for c in checks if c.status == "fail")
        warnings = sum(1 for c in checks if c.status == "warning")

        return {
            "order_allowed": failed == 0,
            "total_checks": len(checks),
            "passed": passed,
            "failed": failed,
            "warnings": warnings,
            "checks": [c.to_dict() for c in checks],
        }


# ── Leverage Monitoring ───────────────────────────────────────────────

class LeverageMonitor:
    @staticmethod
    def check_leverage(
        gross_exposure: float,
        net_exposure: float,
        nav: float,
        max_gross_leverage: float = 2.0,
        max_net_leverage: float = 1.0,
    ) -> list[ComplianceCheck]:
        """Check leverage limits."""
        checks = []

        gross_lev = gross_exposure / nav if nav > 0 else 0
        net_lev = abs(net_exposure) / nav if nav > 0 else 0

        checks.append(ComplianceCheck(
            rule_id="GROSS_LEVERAGE",
            status=ComplianceStatus.PASS.value if gross_lev <= max_gross_leverage else ComplianceStatus.FAIL.value,
            current_value=gross_lev,
            threshold=max_gross_leverage,
            message=f"Gross leverage: {gross_lev:.2f}x (limit: {max_gross_leverage:.1f}x)",
            severity=ViolationSeverity.CRITICAL.value if gross_lev > max_gross_leverage else ViolationSeverity.LOW.value,
        ))

        checks.append(ComplianceCheck(
            rule_id="NET_LEVERAGE",
            status=ComplianceStatus.PASS.value if net_lev <= max_net_leverage else ComplianceStatus.FAIL.value,
            current_value=net_lev,
            threshold=max_net_leverage,
            message=f"Net leverage: {net_lev:.2f}x (limit: {max_net_leverage:.1f}x)",
            severity=ViolationSeverity.HIGH.value if net_lev > max_net_leverage else ViolationSeverity.LOW.value,
        ))

        return checks


# ── Exposure Limits ───────────────────────────────────────────────────

class ExposureMonitor:
    @staticmethod
    def check_country_exposure(
        country_exposures: dict[str, float],
        portfolio_value: float,
        max_country_pct: float = 0.20,
        single_country_exceptions: dict[str, float] | None = None,
    ) -> list[ComplianceCheck]:
        """Check country exposure limits."""
        checks = []
        exceptions = single_country_exceptions or {}

        for country, exposure in country_exposures.items():
            pct = exposure / portfolio_value if portfolio_value > 0 else 0
            limit = exceptions.get(country, max_country_pct)

            status = ComplianceStatus.PASS.value if pct <= limit else ComplianceStatus.FAIL.value
            checks.append(ComplianceCheck(
                rule_id=f"COUNTRY_EXP_{country.upper()[:3]}",
                status=status,
                current_value=pct,
                threshold=limit,
                message=f"Country {country}: {pct * 100:.2f}% (limit: {limit * 100:.1f}%)",
                severity=ViolationSeverity.HIGH.value if status == "fail" else ViolationSeverity.LOW.value,
            ))

        return checks

    @staticmethod
    def check_asset_class_exposure(
        asset_exposures: dict[str, float],
        portfolio_value: float,
        limits: dict[str, float],
    ) -> list[ComplianceCheck]:
        """Check asset class exposure limits."""
        checks = []

        for asset_class, exposure in asset_exposures.items():
            pct = exposure / portfolio_value if portfolio_value > 0 else 0
            limit = limits.get(asset_class, 1.0)

            status = ComplianceStatus.PASS.value if pct <= limit else ComplianceStatus.FAIL.value
            checks.append(ComplianceCheck(
                rule_id=f"ASSET_CLASS_{asset_class.upper()[:10]}",
                status=status,
                current_value=pct,
                threshold=limit,
                message=f"Asset class {asset_class}: {pct * 100:.2f}% (limit: {limit * 100:.1f}%)",
                severity=ViolationSeverity.HIGH.value if status == "fail" else ViolationSeverity.LOW.value,
            ))

        return checks


# ── Audit Trail ───────────────────────────────────────────────────────

class AuditTrail:
    def __init__(self) -> None:
        self.entries: list[dict] = []

    def log_check(
        self,
        rule_id: str,
        status: str,
        details: str,
        user: str = "system",
    ) -> None:
        self.entries.append({
            "timestamp": datetime.now().isoformat(),
            "rule_id": rule_id,
            "status": status,
            "details": details,
            "user": user,
        })

    def log_override(
        self,
        rule_id: str,
        reason: str,
        approver: str,
    ) -> None:
        self.entries.append({
            "timestamp": datetime.now().isoformat(),
            "type": "override",
            "rule_id": rule_id,
            "reason": reason,
            "approver": approver,
        })

    def get_entries(self, n: int = 100) -> list[dict]:
        return self.entries[-n:]

    def get_violations(self) -> list[dict]:
        return [e for e in self.entries if e.get("status") == "fail"]


# ── Orchestrator ──────────────────────────────────────────────────────

class ComplianceEngine:
    def __init__(self) -> None:
        self.position = PositionLimitChecker()
        self.concentration = ConcentrationChecker()
        self.restricted = RestrictedListChecker()
        self.pretrade = PreTradeCompliance()
        self.leverage = LeverageMonitor()
        self.exposure = ExposureMonitor()
        self.audit = AuditTrail()

    def pre_trade_check(self, **kwargs) -> dict:
        result = self.pretrade.validate_order(**kwargs)

        # Log to audit trail
        for check in result.get("checks", []):
            self.audit.log_check(check["rule_id"], check["status"], check["message"])

        return result

    def portfolio_compliance_report(
        self,
        positions: dict[str, float],
        sector_positions: dict[str, float],
        country_positions: dict[str, float],
        portfolio_value: float,
        gross_exposure: float,
        net_exposure: float,
    ) -> dict:
        """Run full portfolio compliance check."""
        checks = []

        # Concentration
        for symbol, value in positions.items():
            checks.append(self.position.check_portfolio_pct(value, portfolio_value, 0.05, symbol))

        # Sector limits
        checks.extend(self.concentration.sector_concentration(sector_positions, portfolio_value))

        # Country limits
        checks.extend(self.exposure.check_country_exposure(country_positions, portfolio_value))

        # Leverage
        checks.extend(self.leverage.check_leverage(gross_exposure, net_exposure, portfolio_value))

        # HHI
        if positions:
            weights = [v / portfolio_value for v in positions.values()] if portfolio_value > 0 else []
            checks.append(self.concentration.hhi_concentration(weights))

        report = ComplianceReport(
            timestamp=datetime.now().isoformat(),
            total_checks=len(checks),
            passed=sum(1 for c in checks if c.status == "pass"),
            failed=sum(1 for c in checks if c.status == "fail"),
            warnings=sum(1 for c in checks if c.status == "warning"),
            checks=checks,
        )

        return report.to_dict()

    def capabilities(self) -> dict:
        return {
            "engine": "ComplianceEngine",
            "version": "1.0.0",
            "features": [
                "position_limit_checks (absolute, pct, ADV)",
                "concentration_analysis (sector, issuer, HHI)",
                "restricted_and_watch_list_screening",
                "pre_trade_compliance_validation",
                "leverage_monitoring (gross/net)",
                "country_exposure_limits",
                "asset_class_exposure_limits",
                "short_sell_detection",
                "audit_trail_logging",
                "compliance_override_tracking",
                "full_portfolio_compliance_report",
            ],
        }
