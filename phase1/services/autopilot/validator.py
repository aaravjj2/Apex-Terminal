"""
Validator Module
Deterministic guardrails that enforce risk rules.
No trade can bypass the validator.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, date
from enum import Enum
import logging

from .candidates import TradeCandidate, CandidateStatus, OptionLeg
from .config import AutopilotConfig, EarningsPolicy
from .universe import UniverseManager

logger = logging.getLogger(__name__)


class RejectionCode(Enum):
    """Standardized rejection reason codes"""
    RISK_PER_TRADE_EXCEEDED = "risk_per_trade_exceeded"
    TOTAL_RISK_EXCEEDED = "total_risk_exceeded"
    DAILY_LOSS_EXCEEDED = "daily_loss_exceeded"
    POSITION_LIMIT_EXCEEDED = "position_limit_exceeded"
    SYMBOL_CONCENTRATION = "symbol_concentration"
    CLUSTER_CONCENTRATION = "cluster_concentration"
    EARNINGS_BLACKOUT = "earnings_blackout"
    LIQUIDITY_TOO_LOW = "liquidity_too_low"
    SPREAD_TOO_WIDE = "spread_too_wide"
    DTE_OUT_OF_RANGE = "dte_out_of_range"
    INVALID_LEGS = "invalid_legs"
    TEMPLATE_NOT_ALLOWED = "template_not_allowed"
    UNDERLYING_NOT_ALLOWED = "underlying_not_allowed"
    IV_OUT_OF_RANGE = "iv_out_of_range"
    KILL_SWITCH_ACTIVE = "kill_switch_active"
    INSUFFICIENT_EQUITY = "insufficient_equity"


@dataclass
class ValidationResult:
    """Result of validating a single candidate"""
    candidate_id: str
    is_valid: bool
    rejection_codes: List[RejectionCode] = field(default_factory=list)
    rejection_details: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    validated_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidate_id": self.candidate_id,
            "is_valid": self.is_valid,
            "rejection_codes": [r.value for r in self.rejection_codes],
            "rejection_details": self.rejection_details,
            "warnings": self.warnings,
            "validated_at": self.validated_at.isoformat(),
        }


@dataclass
class BatchValidationResult:
    """Result of validating a batch of candidates"""
    valid: List[TradeCandidate]
    invalid: List[Tuple[TradeCandidate, ValidationResult]]
    total_checked: int
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid_count": len(self.valid),
            "invalid_count": len(self.invalid),
            "total_checked": self.total_checked,
            "valid_ids": [c.id for c in self.valid],
            "invalid_ids": [(c.id, r.to_dict()) for c, r in self.invalid],
            "timestamp": self.timestamp.isoformat(),
        }


class TradeValidator:
    """
    Enforces deterministic risk rules on trade candidates.
    This is the final gatekeeper before paper execution.
    """
    
    # Cluster definitions for concentration
    SYMBOL_CLUSTERS = {
        "mega_tech": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "AMD"],
        "broad_market": ["SPY", "QQQ", "IWM", "DIA"],
        "sector_tech": ["XLK", "SMH"],
        "sector_fin": ["XLF"],
        "sector_energy": ["XLE"],
        "safe_haven": ["TLT", "GLD"],
    }
    
    def __init__(
        self,
        config: AutopilotConfig,
        universe_manager: UniverseManager,
    ):
        self.config = config
        self.universe = universe_manager
        self._kill_switch_active = False
    
    def activate_kill_switch(self) -> None:
        """Activate kill switch - blocks all new trades."""
        self._kill_switch_active = True
        logger.warning("Kill switch activated - all new trades blocked")
    
    def deactivate_kill_switch(self) -> None:
        """Deactivate kill switch."""
        self._kill_switch_active = False
        logger.info("Kill switch deactivated")
    
    @property
    def kill_switch_active(self) -> bool:
        return self._kill_switch_active
    
    def validate_candidate(
        self,
        candidate: TradeCandidate,
        portfolio_state: Dict[str, Any],
        market_data: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        """
        Validate a single trade candidate.
        
        Args:
            candidate: The trade candidate to validate
            portfolio_state: Current portfolio state (positions, risk, P&L)
            market_data: Optional live market data for additional checks
            
        Returns:
            ValidationResult with pass/fail and detailed reasons
        """
        result = ValidationResult(candidate_id=candidate.id, is_valid=True)
        
        # Check kill switch first
        if self._kill_switch_active:
            result.is_valid = False
            result.rejection_codes.append(RejectionCode.KILL_SWITCH_ACTIVE)
            result.rejection_details.append("Kill switch is active - no new trades allowed")
            return result
        
        # Run all validation checks
        self._check_risk_limits(candidate, portfolio_state, result)
        self._check_position_limits(candidate, portfolio_state, result)
        self._check_concentration(candidate, portfolio_state, result)
        self._check_earnings_blackout(candidate, result)
        self._check_liquidity(candidate, result)
        self._check_template_constraints(candidate, result)
        self._check_leg_validity(candidate, result)
        
        # Set overall validity
        result.is_valid = len(result.rejection_codes) == 0
        
        return result
    
    def validate_batch(
        self,
        candidates: List[TradeCandidate],
        portfolio_state: Dict[str, Any],
        market_data: Optional[Dict[str, Any]] = None,
    ) -> BatchValidationResult:
        """
        Validate a batch of candidates.
        
        Args:
            candidates: List of candidates to validate
            portfolio_state: Current portfolio state
            market_data: Optional market data
            
        Returns:
            BatchValidationResult with valid and invalid lists
        """
        valid = []
        invalid = []
        
        # Track cumulative additions for concentration checks
        cumulative_state = {
            "risk_added": 0,
            "positions_added": 0,
            "symbols_added": {},
            "clusters_added": {},
        }
        
        for candidate in candidates:
            # Create augmented state with cumulative additions
            augmented_state = self._augment_state(portfolio_state, cumulative_state)
            
            result = self.validate_candidate(candidate, augmented_state, market_data)
            
            if result.is_valid:
                valid.append(candidate)
                # Update cumulative state
                cumulative_state["risk_added"] += candidate.max_loss
                cumulative_state["positions_added"] += 1
                cumulative_state["symbols_added"][candidate.symbol] = (
                    cumulative_state["symbols_added"].get(candidate.symbol, 0) + 1
                )
                cluster = self._get_cluster(candidate.symbol)
                cumulative_state["clusters_added"][cluster] = (
                    cumulative_state["clusters_added"].get(cluster, 0) + candidate.max_loss
                )
            else:
                invalid.append((candidate, result))
                candidate.status = CandidateStatus.REJECTED
                candidate.rejection_reasons = result.rejection_details
        
        return BatchValidationResult(
            valid=valid,
            invalid=invalid,
            total_checked=len(candidates),
        )
    
    def _augment_state(
        self,
        base_state: Dict[str, Any],
        cumulative: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Augment portfolio state with cumulative additions."""
        augmented = base_state.copy()
        augmented["total_risk"] = base_state.get("total_risk", 0) + cumulative["risk_added"]
        augmented["position_count"] = base_state.get("position_count", 0) + cumulative["positions_added"]
        
        # Merge symbol exposure
        symbol_exp = dict(base_state.get("symbol_exposure", {}))
        for sym, count in cumulative["symbols_added"].items():
            symbol_exp[sym] = symbol_exp.get(sym, 0) + count
        augmented["symbol_exposure"] = symbol_exp
        
        # Merge cluster exposure
        cluster_exp = dict(base_state.get("cluster_exposure", {}))
        for cluster, risk in cumulative["clusters_added"].items():
            cluster_exp[cluster] = cluster_exp.get(cluster, 0) + risk
        augmented["cluster_exposure"] = cluster_exp
        
        return augmented
    
    def _check_risk_limits(
        self,
        candidate: TradeCandidate,
        state: Dict[str, Any],
        result: ValidationResult,
    ) -> None:
        """Check risk-related limits."""
        limits = self.config.risk_limits
        
        # Max risk per trade
        if candidate.max_loss > limits.max_risk_per_trade:
            result.rejection_codes.append(RejectionCode.RISK_PER_TRADE_EXCEEDED)
            result.rejection_details.append(
                f"Max loss ${candidate.max_loss:.0f} > limit ${limits.max_risk_per_trade:.0f}"
            )
        
        # Total risk capacity
        current_risk = state.get("total_risk", 0)
        if current_risk + candidate.max_loss > limits.max_total_risk:
            result.rejection_codes.append(RejectionCode.TOTAL_RISK_EXCEEDED)
            result.rejection_details.append(
                f"Would exceed total risk: ${current_risk:.0f} + ${candidate.max_loss:.0f} > ${limits.max_total_risk:.0f}"
            )
        
        # Daily loss limit
        daily_pnl = state.get("daily_pnl", 0)
        if daily_pnl < -limits.max_daily_loss:
            result.rejection_codes.append(RejectionCode.DAILY_LOSS_EXCEEDED)
            result.rejection_details.append(
                f"Daily loss limit exceeded: ${abs(daily_pnl):.0f} >= ${limits.max_daily_loss:.0f}"
            )
        
        # Equity check
        equity = state.get("equity", self.config.paper_equity)
        if candidate.max_loss > equity * 0.1:  # No single trade > 10% of equity
            result.rejection_codes.append(RejectionCode.INSUFFICIENT_EQUITY)
            result.rejection_details.append(
                f"Trade risk ${candidate.max_loss:.0f} > 10% of equity ${equity:.0f}"
            )
    
    def _check_position_limits(
        self,
        candidate: TradeCandidate,
        state: Dict[str, Any],
        result: ValidationResult,
    ) -> None:
        """Check position count limits."""
        current_positions = state.get("position_count", 0)
        max_positions = self.config.risk_limits.max_open_positions
        
        if current_positions >= max_positions:
            result.rejection_codes.append(RejectionCode.POSITION_LIMIT_EXCEEDED)
            result.rejection_details.append(
                f"Position limit reached: {current_positions} >= {max_positions}"
            )
    
    def _check_concentration(
        self,
        candidate: TradeCandidate,
        state: Dict[str, Any],
        result: ValidationResult,
    ) -> None:
        """Check concentration limits (symbol and cluster)."""
        limits = self.config.risk_limits
        symbol = candidate.symbol
        
        # Symbol concentration
        symbol_exposure = state.get("symbol_exposure", {})
        current_symbol_positions = symbol_exposure.get(symbol, 0)
        
        if current_symbol_positions >= limits.max_positions_per_underlying:
            result.rejection_codes.append(RejectionCode.SYMBOL_CONCENTRATION)
            result.rejection_details.append(
                f"Symbol {symbol} at position limit: {current_symbol_positions}"
            )
        
        # Cluster concentration
        cluster = self._get_cluster(symbol)
        cluster_exposure = state.get("cluster_exposure", {})
        current_cluster_risk = cluster_exposure.get(cluster, 0)
        
        # Max 60% of total risk in one cluster
        max_cluster_risk = limits.max_total_risk * limits.max_cluster_risk_pct
        if current_cluster_risk + candidate.max_loss > max_cluster_risk:
            result.rejection_codes.append(RejectionCode.CLUSTER_CONCENTRATION)
            result.rejection_details.append(
                f"Cluster {cluster} would exceed {limits.max_cluster_risk_pct:.0%} concentration"
            )
    
    def _check_earnings_blackout(
        self,
        candidate: TradeCandidate,
        result: ValidationResult,
    ) -> None:
        """Check earnings blackout rules."""
        policy = self.config.earnings_policy
        
        # Check if symbol is in earnings blackout
        is_blackout = self.universe.is_in_earnings_blackout(
            candidate.symbol,
            policy.blackout_days_before,
        )
        
        if is_blackout:
            # For credit strategies, enforce blackout
            if candidate.template.value in ["put_credit_spread", "call_credit_spread", "iron_condor"]:
                result.rejection_codes.append(RejectionCode.EARNINGS_BLACKOUT)
                result.rejection_details.append(
                    f"Earnings blackout for {candidate.symbol} ({policy.blackout_days_before} days)"
                )
    
    def _check_liquidity(
        self,
        candidate: TradeCandidate,
        result: ValidationResult,
    ) -> None:
        """Check liquidity requirements."""
        # Use default thresholds if not configured
        min_liquidity_score = getattr(self.config.strategy_constraints, 'min_liquidity_score', 0.3)
        max_spread_percent = getattr(self.config.strategy_constraints, 'max_spread_percent', 0.10)
        
        if candidate.liquidity_score < min_liquidity_score:
            result.rejection_codes.append(RejectionCode.LIQUIDITY_TOO_LOW)
            result.rejection_details.append(
                f"Liquidity score {candidate.liquidity_score:.2f} < {min_liquidity_score:.2f}"
            )
        
        if candidate.spread_percent > max_spread_percent:
            result.rejection_codes.append(RejectionCode.SPREAD_TOO_WIDE)
            result.rejection_details.append(
                f"Spread {candidate.spread_percent:.1%} > {max_spread_percent:.1%}"
            )
    
    def _check_template_constraints(
        self,
        candidate: TradeCandidate,
        result: ValidationResult,
    ) -> None:
        """Check template-specific constraints."""
        constraints = self.config.strategy_constraints
        
        # Check if template is allowed (use config.allowed_strategies)
        if candidate.template not in self.config.allowed_strategies:
            result.rejection_codes.append(RejectionCode.TEMPLATE_NOT_ALLOWED)
            result.rejection_details.append(
                f"Template {candidate.template.value} not in allowed list"
            )
        
        # Check DTE range
        if not (constraints.min_dte <= candidate.dte <= constraints.max_dte):
            result.rejection_codes.append(RejectionCode.DTE_OUT_OF_RANGE)
            result.rejection_details.append(
                f"DTE {candidate.dte} not in [{constraints.min_dte}, {constraints.max_dte}]"
            )
        
        # Check IV range (use defaults if not set)
        min_iv = getattr(constraints, 'min_iv_rank', 0)
        max_iv = getattr(constraints, 'max_iv_rank', 100)
        if not (min_iv <= candidate.iv_rank <= max_iv):
            result.rejection_codes.append(RejectionCode.IV_OUT_OF_RANGE)
            result.rejection_details.append(
                f"IV rank {candidate.iv_rank:.0f} not in [{min_iv}, {max_iv}]"
            )
    
    def _check_leg_validity(
        self,
        candidate: TradeCandidate,
        result: ValidationResult,
    ) -> None:
        """Check that option legs are valid."""
        if not candidate.legs:
            result.rejection_codes.append(RejectionCode.INVALID_LEGS)
            result.rejection_details.append("No option legs defined")
            return
        
        # Check leg count for each template
        expected_legs = {
            "put_credit_spread": 2,
            "call_credit_spread": 2,
            "iron_condor": 4,
            "call_debit_spread": 2,
            "put_debit_spread": 2,
        }
        
        expected = expected_legs.get(candidate.template.value, 2)
        if len(candidate.legs) != expected:
            result.rejection_codes.append(RejectionCode.INVALID_LEGS)
            result.rejection_details.append(
                f"Expected {expected} legs for {candidate.template.value}, got {len(candidate.legs)}"
            )
        
        # Check all legs have valid expiry
        for i, leg in enumerate(candidate.legs):
            if not leg.expiry:
                result.rejection_codes.append(RejectionCode.INVALID_LEGS)
                result.rejection_details.append(f"Leg {i+1} missing expiry")
            
            if leg.strike <= 0:
                result.rejection_codes.append(RejectionCode.INVALID_LEGS)
                result.rejection_details.append(f"Leg {i+1} invalid strike: {leg.strike}")
    
    def _get_cluster(self, symbol: str) -> str:
        """Get cluster for a symbol."""
        for cluster, symbols in self.SYMBOL_CLUSTERS.items():
            if symbol in symbols:
                return cluster
        return "other"
    
    def validate_exit(
        self,
        position_id: str,
        exit_reason: str,
        portfolio_state: Dict[str, Any],
    ) -> ValidationResult:
        """Validate an exit/close request."""
        result = ValidationResult(candidate_id=position_id, is_valid=True)
        
        # Exits are generally allowed unless kill switch prevents all activity
        # In paper mode, we allow all exits
        
        if exit_reason == "user_request":
            result.warnings.append("Manual exit requested")
        
        return result
