"""
Wave 28 — Cost Model Library
Multi-tier commission/fee/spread cost models for realistic backtesting.
"""
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, Optional


class CostModelType(str, Enum):
    ZERO = "zero"
    FLAT = "flat"
    PER_SHARE = "per_share"
    PERCENTAGE = "percentage"
    TIERED = "tiered"
    IBKR_FIXED = "ibkr_fixed"
    IBKR_TIERED = "ibkr_tiered"


@dataclass
class CostModel:
    """Configurable cost model for backtest execution."""
    name: str
    model_type: CostModelType
    commission_per_share: float = 0.0
    commission_flat: float = 0.0
    commission_pct: float = 0.0
    min_commission: float = 0.0
    max_commission: float = float("inf")
    spread_bps: float = 0.0        # Spread in basis points
    sec_fee_per_dollar: float = 0.0  # SEC fee (sells only)
    taf_per_share: float = 0.0      # TAF fee
    exchange_fee_per_share: float = 0.0

    def calculate(self, qty: float, price: float, is_sell: bool = False) -> Dict[str, float]:
        """Calculate total costs for a trade."""
        notional = abs(qty * price)

        # Commission
        if self.model_type == CostModelType.ZERO:
            commission = 0.0
        elif self.model_type == CostModelType.FLAT:
            commission = self.commission_flat
        elif self.model_type == CostModelType.PER_SHARE:
            commission = abs(qty) * self.commission_per_share
        elif self.model_type == CostModelType.PERCENTAGE:
            commission = notional * self.commission_pct
        elif self.model_type in (CostModelType.TIERED, CostModelType.IBKR_TIERED):
            commission = abs(qty) * self.commission_per_share
        elif self.model_type == CostModelType.IBKR_FIXED:
            commission = max(abs(qty) * self.commission_per_share, self.min_commission)
        else:
            commission = 0.0

        commission = max(commission, self.min_commission)
        commission = min(commission, self.max_commission)

        # Spread cost
        spread_cost = notional * (self.spread_bps / 10000)

        # Regulatory fees (sells only)
        sec_fee = notional * self.sec_fee_per_dollar if is_sell else 0.0
        taf_fee = abs(qty) * self.taf_per_share if is_sell else 0.0
        exchange_fee = abs(qty) * self.exchange_fee_per_share

        total = commission + spread_cost + sec_fee + taf_fee + exchange_fee

        return {
            "commission": round(commission, 4),
            "spread_cost": round(spread_cost, 4),
            "sec_fee": round(sec_fee, 6),
            "taf_fee": round(taf_fee, 6),
            "exchange_fee": round(exchange_fee, 6),
            "total": round(total, 4),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "model_type": self.model_type.value,
            "commission_per_share": self.commission_per_share,
            "commission_flat": self.commission_flat,
            "commission_pct": self.commission_pct,
            "min_commission": self.min_commission,
            "spread_bps": self.spread_bps,
        }


# Pre-built cost model library
COST_MODELS: Dict[str, CostModel] = {
    "zero": CostModel(name="Zero Cost", model_type=CostModelType.ZERO),
    "robinhood": CostModel(
        name="Robinhood",
        model_type=CostModelType.ZERO,
        spread_bps=2.0,  # PFOF spread
    ),
    "ibkr_fixed": CostModel(
        name="IBKR Fixed",
        model_type=CostModelType.IBKR_FIXED,
        commission_per_share=0.005,
        min_commission=1.0,
        max_commission=0.5,  # 0.5% of trade value cap
        sec_fee_per_dollar=0.0000278,
        taf_per_share=0.000166,
        exchange_fee_per_share=0.003,
    ),
    "ibkr_tiered": CostModel(
        name="IBKR Tiered",
        model_type=CostModelType.IBKR_TIERED,
        commission_per_share=0.0035,
        min_commission=0.35,
        max_commission=0.5,
        sec_fee_per_dollar=0.0000278,
        taf_per_share=0.000166,
    ),
    "schwab": CostModel(
        name="Schwab",
        model_type=CostModelType.ZERO,
        spread_bps=1.5,
    ),
    "realistic": CostModel(
        name="Realistic (Conservative)",
        model_type=CostModelType.PER_SHARE,
        commission_per_share=0.005,
        min_commission=1.0,
        spread_bps=5.0,
        sec_fee_per_dollar=0.0000278,
        taf_per_share=0.000166,
    ),
}


def get_cost_model(name: str) -> CostModel:
    return COST_MODELS.get(name, COST_MODELS["realistic"])


def list_cost_models() -> list:
    return [m.to_dict() for m in COST_MODELS.values()]
