"""
V1 Strategy Template Definitions

Explicit parameter bounds and exit rules for each autopilot strategy template.
These are the production settings for paper-only trading.

Based on Research Plan v1 requirements.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class Regime(str, Enum):
    """Market regime classification."""
    TREND_UP = "trend_up"
    TREND_DOWN = "trend_down"
    RANGE = "range"
    CHAOS = "chaos"


class IVLevel(str, Enum):
    """Implied volatility environment."""
    LOW = "low"          # Below 25th percentile
    MEDIUM = "medium"    # 25-75 percentile
    HIGH = "high"        # Above 75th percentile


@dataclass
class ExitRules:
    """Exit rules for a strategy template."""
    take_profit_pct: float  # % of max profit to close
    time_stop_dte: int      # Close when DTE <= this
    loss_stop_credit_multiplier: float  # Close at N× credit loss
    loss_stop_max_loss_pct: float  # OR % of max loss


@dataclass
class TemplateParameterBounds:
    """
    Explicit parameter bounds for a strategy template.
    All values are validated before candidate generation.
    """
    # DTE constraints
    min_dte: int
    max_dte: int
    
    # Delta targets (for short legs)
    min_short_delta: float
    max_short_delta: float
    preferred_short_delta: float
    
    # Width bounds by underlying price
    width_by_price: Dict[str, Tuple[float, float]]  # price_range -> (min, max)
    
    # Credit/Debit constraints
    min_credit_ratio: Optional[float] = None  # credit >= ratio × width
    max_debit_ratio: Optional[float] = None   # debit <= ratio × width
    
    # Suitable regimes
    suitable_regimes: List[Regime] = field(default_factory=list)
    
    # IV environment
    suitable_iv: List[IVLevel] = field(default_factory=list)
    
    # Exit rules
    exit_rules: ExitRules = field(default_factory=lambda: ExitRules(
        take_profit_pct=0.50,
        time_stop_dte=7,
        loss_stop_credit_multiplier=2.0,
        loss_stop_max_loss_pct=0.70
    ))


# =============================================================================
# V1 STRATEGY TEMPLATE DEFINITIONS
# =============================================================================

# Template 1: Put Credit Spread (PCS)
PUT_CREDIT_SPREAD_V1 = TemplateParameterBounds(
    min_dte=21,
    max_dte=45,
    min_short_delta=0.15,
    max_short_delta=0.30,
    preferred_short_delta=0.22,
    width_by_price={
        "under_50": (1.0, 2.0),
        "50_to_200": (2.0, 5.0),
        "over_200": (5.0, 10.0),
    },
    min_credit_ratio=0.20,  # credit >= 0.20 × width
    suitable_regimes=[Regime.TREND_UP, Regime.RANGE],
    suitable_iv=[IVLevel.MEDIUM, IVLevel.HIGH],
    exit_rules=ExitRules(
        take_profit_pct=0.50,
        time_stop_dte=7,
        loss_stop_credit_multiplier=2.0,
        loss_stop_max_loss_pct=0.70
    )
)

# Template 2: Call Credit Spread (CCS)
CALL_CREDIT_SPREAD_V1 = TemplateParameterBounds(
    min_dte=21,
    max_dte=45,
    min_short_delta=0.15,
    max_short_delta=0.30,
    preferred_short_delta=0.22,
    width_by_price={
        "under_50": (1.0, 2.0),
        "50_to_200": (2.0, 5.0),
        "over_200": (5.0, 10.0),
    },
    min_credit_ratio=0.20,
    suitable_regimes=[Regime.TREND_DOWN, Regime.RANGE],
    suitable_iv=[IVLevel.MEDIUM, IVLevel.HIGH],
    exit_rules=ExitRules(
        take_profit_pct=0.50,
        time_stop_dte=7,
        loss_stop_credit_multiplier=2.0,
        loss_stop_max_loss_pct=0.70
    )
)

# Template 3: Iron Condor (IC)
IRON_CONDOR_V1 = TemplateParameterBounds(
    min_dte=30,
    max_dte=60,
    min_short_delta=0.10,
    max_short_delta=0.20,
    preferred_short_delta=0.15,
    width_by_price={
        "under_50": (1.0, 2.0),
        "50_to_200": (2.0, 5.0),
        "over_200": (5.0, 10.0),
    },
    min_credit_ratio=0.15,  # total credit >= 0.15 × avg wing width
    suitable_regimes=[Regime.RANGE],  # Avoid chaos!
    suitable_iv=[IVLevel.MEDIUM, IVLevel.HIGH],
    exit_rules=ExitRules(
        take_profit_pct=0.40,
        time_stop_dte=14,
        loss_stop_credit_multiplier=2.0,
        loss_stop_max_loss_pct=0.60
    )
)

# Template 4: Call Debit Spread (CDS)
CALL_DEBIT_SPREAD_V1 = TemplateParameterBounds(
    min_dte=14,
    max_dte=30,
    min_short_delta=0.25,  # Short leg delta
    max_short_delta=0.45,
    preferred_short_delta=0.35,
    width_by_price={
        "under_50": (1.0, 3.0),
        "50_to_200": (2.0, 5.0),
        "over_200": (5.0, 10.0),
    },
    max_debit_ratio=0.65,  # debit <= 0.65 × width
    suitable_regimes=[Regime.TREND_UP],
    suitable_iv=[IVLevel.LOW, IVLevel.MEDIUM],
    exit_rules=ExitRules(
        take_profit_pct=0.60,
        time_stop_dte=7,
        loss_stop_credit_multiplier=1.0,  # N/A for debit
        loss_stop_max_loss_pct=0.50  # Close if value drops to 50% of debit
    )
)

# Template 5: Put Debit Spread (PDS)
PUT_DEBIT_SPREAD_V1 = TemplateParameterBounds(
    min_dte=14,
    max_dte=30,
    min_short_delta=0.25,
    max_short_delta=0.45,
    preferred_short_delta=0.35,
    width_by_price={
        "under_50": (1.0, 3.0),
        "50_to_200": (2.0, 5.0),
        "over_200": (5.0, 10.0),
    },
    max_debit_ratio=0.65,
    suitable_regimes=[Regime.TREND_DOWN],
    suitable_iv=[IVLevel.LOW, IVLevel.MEDIUM],
    exit_rules=ExitRules(
        take_profit_pct=0.60,
        time_stop_dte=7,
        loss_stop_credit_multiplier=1.0,
        loss_stop_max_loss_pct=0.50
    )
)


# Template registry
V1_TEMPLATES = {
    "put_credit_spread": PUT_CREDIT_SPREAD_V1,
    "call_credit_spread": CALL_CREDIT_SPREAD_V1,
    "iron_condor": IRON_CONDOR_V1,
    "call_debit_spread": CALL_DEBIT_SPREAD_V1,
    "put_debit_spread": PUT_DEBIT_SPREAD_V1,
}


def get_template_bounds(template_name: str) -> Optional[TemplateParameterBounds]:
    """Get parameter bounds for a template."""
    return V1_TEMPLATES.get(template_name.lower().replace(" ", "_"))


def get_width_bounds(template: TemplateParameterBounds, underlying_price: float) -> Tuple[float, float]:
    """Get width bounds based on underlying price."""
    if underlying_price < 50:
        return template.width_by_price["under_50"]
    elif underlying_price <= 200:
        return template.width_by_price["50_to_200"]
    else:
        return template.width_by_price["over_200"]


def validate_candidate_against_template(
    template_name: str,
    dte: int,
    short_delta: float,
    width: float,
    credit_or_debit: float,
    underlying_price: float,
    current_regime: Optional[Regime] = None,
    current_iv: Optional[IVLevel] = None,
) -> Tuple[bool, List[str]]:
    """
    Validate a candidate against template bounds.
    
    Returns:
        (is_valid, list_of_rejection_reasons)
    """
    template = get_template_bounds(template_name)
    if not template:
        return False, [f"Unknown template: {template_name}"]
    
    rejections = []
    
    # DTE check
    if dte < template.min_dte:
        rejections.append(f"DTE {dte} below minimum {template.min_dte}")
    if dte > template.max_dte:
        rejections.append(f"DTE {dte} above maximum {template.max_dte}")
    
    # Delta check
    if short_delta < template.min_short_delta:
        rejections.append(f"Delta {short_delta:.2f} below minimum {template.min_short_delta:.2f}")
    if short_delta > template.max_short_delta:
        rejections.append(f"Delta {short_delta:.2f} above maximum {template.max_short_delta:.2f}")
    
    # Width check
    min_width, max_width = get_width_bounds(template, underlying_price)
    if width < min_width:
        rejections.append(f"Width {width} below minimum {min_width}")
    if width > max_width:
        rejections.append(f"Width {width} above maximum {max_width}")
    
    # Credit/Debit ratio check
    if template.min_credit_ratio and credit_or_debit > 0:
        min_credit = template.min_credit_ratio * width
        if credit_or_debit < min_credit:
            rejections.append(f"Credit {credit_or_debit:.2f} below minimum {min_credit:.2f}")
    
    if template.max_debit_ratio and credit_or_debit < 0:
        max_debit = template.max_debit_ratio * width
        if abs(credit_or_debit) > max_debit:
            rejections.append(f"Debit {abs(credit_or_debit):.2f} above maximum {max_debit:.2f}")
    
    # Regime check (warning only, not rejection)
    if current_regime and current_regime not in template.suitable_regimes:
        logger.warning(f"Template {template_name} not ideal for regime {current_regime.value}")
    
    # IV check (warning only)
    if current_iv and current_iv not in template.suitable_iv:
        logger.warning(f"Template {template_name} not ideal for IV level {current_iv.value}")
    
    return len(rejections) == 0, rejections


# =============================================================================
# LIQUIDITY GATES
# =============================================================================

@dataclass
class LiquidityGates:
    """Liquidity requirements for option legs."""
    max_spread_pct_etf: float = 0.02       # 2% for ETFs
    max_spread_pct_stock: float = 0.03     # 3% for single stocks
    min_open_interest: int = 200           # Per leg
    min_open_interest_etf: int = 100       # Relaxed for ETFs


ETF_SYMBOLS = {"SPY", "QQQ", "IWM", "DIA", "XLK", "SMH", "XLF", "XLE", "TLT", "GLD"}


def check_liquidity_gate(
    symbol: str,
    bid: float,
    ask: float,
    open_interest: int,
    gates: LiquidityGates = LiquidityGates(),
) -> Tuple[bool, Optional[str]]:
    """
    Check if an option leg passes liquidity gates.
    
    Returns:
        (passes, rejection_reason)
    """
    is_etf = symbol in ETF_SYMBOLS
    
    # Spread check
    mid = (bid + ask) / 2 if bid + ask > 0 else 1.0
    spread_pct = (ask - bid) / mid if mid > 0 else 1.0
    
    max_spread = gates.max_spread_pct_etf if is_etf else gates.max_spread_pct_stock
    if spread_pct > max_spread:
        return False, f"Spread {spread_pct:.1%} exceeds {max_spread:.1%}"
    
    # OI check
    min_oi = gates.min_open_interest_etf if is_etf else gates.min_open_interest
    if open_interest < min_oi:
        return False, f"OI {open_interest} below minimum {min_oi}"
    
    return True, None
