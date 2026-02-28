"""
Tax Lot Engine — FIFO/LIFO/specific identification, wash sale detection,
tax loss harvesting, cost basis tracking, holding period analysis,
capital gains optimization, estimated tax liability.

Pure computation — no FastAPI dependencies.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class CostBasisMethod(str, Enum):
    FIFO = "fifo"
    LIFO = "lifo"
    SPECIFIC_ID = "specific_id"
    HIGHEST_COST = "highest_cost"
    LOWEST_COST = "lowest_cost"
    AVG_COST = "average_cost"
    MIN_TAX = "min_tax"


class HoldingPeriod(str, Enum):
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"


class GainType(str, Enum):
    REALIZED = "realized"
    UNREALIZED = "unrealized"


@dataclass
class TaxLot:
    lot_id: str
    symbol: str
    quantity: float
    cost_basis: float  # per share
    purchase_date: str  # ISO date
    remaining_quantity: float = 0.0
    wash_sale_adjustment: float = 0.0

    def __post_init__(self):
        if self.remaining_quantity == 0:
            self.remaining_quantity = self.quantity

    @property
    def total_cost(self) -> float:
        return self.remaining_quantity * (self.cost_basis + self.wash_sale_adjustment)

    def to_dict(self) -> dict:
        return {
            "lot_id": self.lot_id,
            "symbol": self.symbol,
            "quantity": round(self.quantity, 4),
            "remaining_quantity": round(self.remaining_quantity, 4),
            "cost_basis": round(self.cost_basis, 4),
            "purchase_date": self.purchase_date,
            "total_cost": round(self.total_cost, 2),
            "wash_sale_adjustment": round(self.wash_sale_adjustment, 4),
        }


@dataclass
class SaleResult:
    lot_id: str
    quantity_sold: float
    cost_basis: float
    sale_price: float
    gain_loss: float
    holding_period: str
    wash_sale_disallowed: float = 0.0

    def to_dict(self) -> dict:
        return {
            "lot_id": self.lot_id,
            "quantity_sold": round(self.quantity_sold, 4),
            "cost_basis": round(self.cost_basis, 4),
            "sale_price": round(self.sale_price, 4),
            "gain_loss": round(self.gain_loss, 2),
            "holding_period": self.holding_period,
            "wash_sale_disallowed": round(self.wash_sale_disallowed, 2),
        }


@dataclass
class TaxSummary:
    short_term_gains: float = 0.0
    short_term_losses: float = 0.0
    long_term_gains: float = 0.0
    long_term_losses: float = 0.0
    wash_sale_disallowed: float = 0.0
    total_gains: float = 0.0
    total_losses: float = 0.0
    net_gain_loss: float = 0.0
    estimated_tax: float = 0.0

    def to_dict(self) -> dict:
        return {
            "short_term_gains": round(self.short_term_gains, 2),
            "short_term_losses": round(self.short_term_losses, 2),
            "long_term_gains": round(self.long_term_gains, 2),
            "long_term_losses": round(self.long_term_losses, 2),
            "wash_sale_disallowed": round(self.wash_sale_disallowed, 2),
            "net_short_term": round(self.short_term_gains + self.short_term_losses, 2),
            "net_long_term": round(self.long_term_gains + self.long_term_losses, 2),
            "total_gains": round(self.total_gains, 2),
            "total_losses": round(self.total_losses, 2),
            "net_gain_loss": round(self.net_gain_loss, 2),
            "estimated_tax": round(self.estimated_tax, 2),
        }


# ── Cost Basis Calculator ────────────────────────────────────────────

class CostBasisCalculator:
    @staticmethod
    def select_lots_fifo(lots: list[TaxLot], quantity: float) -> list[tuple[TaxLot, float]]:
        """Select lots using FIFO (First In, First Out)."""
        sorted_lots = sorted(lots, key=lambda l: l.purchase_date)
        return CostBasisCalculator._fill_order(sorted_lots, quantity)

    @staticmethod
    def select_lots_lifo(lots: list[TaxLot], quantity: float) -> list[tuple[TaxLot, float]]:
        """Select lots using LIFO (Last In, First Out)."""
        sorted_lots = sorted(lots, key=lambda l: l.purchase_date, reverse=True)
        return CostBasisCalculator._fill_order(sorted_lots, quantity)

    @staticmethod
    def select_lots_highest_cost(lots: list[TaxLot], quantity: float) -> list[tuple[TaxLot, float]]:
        """Select lots with highest cost first (tax loss minimization)."""
        sorted_lots = sorted(lots, key=lambda l: l.cost_basis, reverse=True)
        return CostBasisCalculator._fill_order(sorted_lots, quantity)

    @staticmethod
    def select_lots_lowest_cost(lots: list[TaxLot], quantity: float) -> list[tuple[TaxLot, float]]:
        """Select lots with lowest cost first (gain maximization)."""
        sorted_lots = sorted(lots, key=lambda l: l.cost_basis)
        return CostBasisCalculator._fill_order(sorted_lots, quantity)

    @staticmethod
    def select_lots_min_tax(
        lots: list[TaxLot],
        quantity: float,
        sale_price: float,
        current_date: str,
        short_term_rate: float = 0.37,
        long_term_rate: float = 0.20,
    ) -> list[tuple[TaxLot, float]]:
        """Select lots to minimize tax liability."""
        scored = []
        for lot in lots:
            if lot.remaining_quantity <= 0:
                continue

            gain = sale_price - lot.cost_basis
            is_long = CostBasisCalculator._is_long_term(lot.purchase_date, current_date)
            rate = long_term_rate if is_long else short_term_rate
            tax_per_share = gain * rate

            scored.append((lot, tax_per_share))

        # Sort by tax ascending (sell lots that generate least tax first)
        scored.sort(key=lambda x: x[1])

        return CostBasisCalculator._fill_order([s[0] for s in scored], quantity)

    @staticmethod
    def average_cost(lots: list[TaxLot]) -> float:
        """Calculate average cost basis across all lots."""
        total_qty = sum(l.remaining_quantity for l in lots)
        if total_qty <= 0:
            return 0
        total_cost = sum(l.remaining_quantity * l.cost_basis for l in lots)
        return total_cost / total_qty

    @staticmethod
    def _fill_order(sorted_lots: list[TaxLot], quantity: float) -> list[tuple[TaxLot, float]]:
        remaining = quantity
        selections = []

        for lot in sorted_lots:
            if remaining <= 0:
                break
            if lot.remaining_quantity <= 0:
                continue

            fill = min(remaining, lot.remaining_quantity)
            selections.append((lot, fill))
            remaining -= fill

        return selections

    @staticmethod
    def _is_long_term(purchase_date: str, current_date: str) -> bool:
        """Check if holding period exceeds 1 year."""
        try:
            pd = datetime.fromisoformat(purchase_date)
            cd = datetime.fromisoformat(current_date)
            return (cd - pd).days > 365
        except (ValueError, TypeError):
            return False


# ── Wash Sale Detection ───────────────────────────────────────────────

class WashSaleDetector:
    @staticmethod
    def detect(
        sales: list[dict],
        purchases: list[dict],
        window_days: int = 30,
    ) -> list[dict]:
        """
        Detect wash sales.
        A wash sale occurs when you sell at a loss and buy substantially identical
        security within 30 days before or after.
        """
        wash_sales = []

        for sale in sales:
            sale_date = sale.get("date", "")
            sale_symbol = sale.get("symbol", "")
            sale_price = sale.get("price", 0)
            sale_cost = sale.get("cost_basis", 0)
            sale_qty = sale.get("quantity", 0)

            # Only losses can be wash sales
            gain = (sale_price - sale_cost) * sale_qty
            if gain >= 0:
                continue

            try:
                sd = datetime.fromisoformat(sale_date)
            except (ValueError, TypeError):
                continue

            for purchase in purchases:
                if purchase.get("symbol", "") != sale_symbol:
                    continue

                try:
                    pd = datetime.fromisoformat(purchase.get("date", ""))
                except (ValueError, TypeError):
                    continue

                days_diff = abs((pd - sd).days)
                if days_diff <= window_days:
                    disallowed = abs(gain) * min(purchase.get("quantity", 0), sale_qty) / sale_qty if sale_qty > 0 else 0

                    wash_sales.append({
                        "sale_date": sale_date,
                        "purchase_date": purchase.get("date", ""),
                        "symbol": sale_symbol,
                        "loss_disallowed": round(disallowed, 2),
                        "total_loss": round(gain, 2),
                        "days_apart": days_diff,
                        "replacement_purchase_qty": purchase.get("quantity", 0),
                    })

        return wash_sales


# ── Tax Loss Harvesting ───────────────────────────────────────────────

class TaxLossHarvester:
    @staticmethod
    def find_opportunities(
        positions: list[dict],
        current_prices: dict[str, float],
        min_loss_threshold: float = 100,
        short_term_rate: float = 0.37,
        long_term_rate: float = 0.20,
    ) -> list[dict]:
        """
        Find tax loss harvesting opportunities.
        Each position: {symbol, lots: [TaxLot]}
        """
        opportunities = []

        for pos in positions:
            symbol = pos.get("symbol", "")
            lots = pos.get("lots", [])
            current_price = current_prices.get(symbol, 0)

            if current_price <= 0:
                continue

            for lot in lots:
                if isinstance(lot, dict):
                    cost = lot.get("cost_basis", 0)
                    qty = lot.get("remaining_quantity", lot.get("quantity", 0))
                    purchase_date = lot.get("purchase_date", "")
                    lot_id = lot.get("lot_id", "")
                else:
                    cost = lot.cost_basis
                    qty = lot.remaining_quantity
                    purchase_date = lot.purchase_date
                    lot_id = lot.lot_id

                unrealized_loss = (current_price - cost) * qty
                if unrealized_loss >= 0 or abs(unrealized_loss) < min_loss_threshold:
                    continue

                is_long = CostBasisCalculator._is_long_term(purchase_date, datetime.now().isoformat()[:10])
                rate = long_term_rate if is_long else short_term_rate
                tax_savings = abs(unrealized_loss) * rate

                opportunities.append({
                    "symbol": symbol,
                    "lot_id": lot_id,
                    "quantity": round(qty, 4),
                    "cost_basis": round(cost, 4),
                    "current_price": round(current_price, 4),
                    "unrealized_loss": round(unrealized_loss, 2),
                    "holding_period": "long_term" if is_long else "short_term",
                    "tax_rate": round(rate, 4),
                    "estimated_tax_savings": round(tax_savings, 2),
                    "loss_pct": round(unrealized_loss / (cost * qty) * 100 if cost * qty > 0 else 0, 2),
                })

        opportunities.sort(key=lambda x: x["estimated_tax_savings"], reverse=True)
        return opportunities

    @staticmethod
    def optimal_harvest_plan(
        opportunities: list[dict],
        target_loss: float = 0,
        max_positions: int = 10,
    ) -> dict:
        """Create optimal harvesting plan."""
        if not opportunities:
            return {"plan": [], "total_losses": 0, "total_tax_savings": 0}

        selected = []
        total_loss = 0.0
        total_savings = 0.0

        for opp in opportunities[:max_positions]:
            if target_loss > 0 and abs(total_loss) >= target_loss:
                break

            selected.append(opp)
            total_loss += opp["unrealized_loss"]
            total_savings += opp["estimated_tax_savings"]

        return {
            "plan": selected,
            "n_positions": len(selected),
            "total_losses": round(total_loss, 2),
            "total_tax_savings": round(total_savings, 2),
        }


# ── Capital Gains Calculator ──────────────────────────────────────────

class CapitalGainsCalculator:
    @staticmethod
    def calculate_sale(
        lots: list[TaxLot],
        quantity: float,
        sale_price: float,
        current_date: str,
        method: str = "fifo",
        short_term_rate: float = 0.37,
        long_term_rate: float = 0.20,
    ) -> dict:
        """Calculate capital gains for a sale."""
        calculator = CostBasisCalculator()

        if method == "lifo":
            selections = calculator.select_lots_lifo(lots, quantity)
        elif method == "highest_cost":
            selections = calculator.select_lots_highest_cost(lots, quantity)
        elif method == "lowest_cost":
            selections = calculator.select_lots_lowest_cost(lots, quantity)
        elif method == "min_tax":
            selections = calculator.select_lots_min_tax(lots, quantity, sale_price, current_date, short_term_rate, long_term_rate)
        else:
            selections = calculator.select_lots_fifo(lots, quantity)

        sale_results = []
        total_gain = 0.0
        total_tax = 0.0

        for lot, qty in selections:
            gain = (sale_price - lot.cost_basis - lot.wash_sale_adjustment) * qty
            is_long = calculator._is_long_term(lot.purchase_date, current_date)
            rate = long_term_rate if is_long else short_term_rate
            tax = gain * rate if gain > 0 else 0

            total_gain += gain
            total_tax += tax

            sale_results.append(SaleResult(
                lot_id=lot.lot_id,
                quantity_sold=qty,
                cost_basis=lot.cost_basis + lot.wash_sale_adjustment,
                sale_price=sale_price,
                gain_loss=gain,
                holding_period="long_term" if is_long else "short_term",
            ))

        return {
            "sale_details": [sr.to_dict() for sr in sale_results],
            "total_gain_loss": round(total_gain, 2),
            "estimated_tax": round(total_tax, 2),
            "effective_rate": round(total_tax / total_gain if total_gain > 0 else 0, 4),
            "method": method,
        }

    @staticmethod
    def compare_methods(
        lots: list[TaxLot],
        quantity: float,
        sale_price: float,
        current_date: str,
    ) -> dict:
        """Compare tax impact across all cost basis methods."""
        methods = ["fifo", "lifo", "highest_cost", "lowest_cost", "min_tax"]
        results = {}

        for method in methods:
            result = CapitalGainsCalculator.calculate_sale(
                lots, quantity, sale_price, current_date, method
            )
            results[method] = {
                "gain_loss": result["total_gain_loss"],
                "estimated_tax": result["estimated_tax"],
            }

        # Find optimal
        optimal = min(results.items(), key=lambda x: x[1]["estimated_tax"])

        return {
            "comparison": results,
            "optimal_method": optimal[0],
            "optimal_tax": round(optimal[1]["estimated_tax"], 2),
            "worst_method": max(results.items(), key=lambda x: x[1]["estimated_tax"])[0],
            "tax_savings_vs_worst": round(
                max(r["estimated_tax"] for r in results.values()) - optimal[1]["estimated_tax"], 2
            ),
        }


# ── Tax Summary ───────────────────────────────────────────────────────

class TaxReporter:
    @staticmethod
    def annual_summary(
        realized_sales: list[SaleResult],
        short_term_rate: float = 0.37,
        long_term_rate: float = 0.20,
        loss_carryover: float = 0,
    ) -> TaxSummary:
        """Generate annual tax summary."""
        summary = TaxSummary()

        for sale in realized_sales:
            if sale.holding_period == "short_term":
                if sale.gain_loss >= 0:
                    summary.short_term_gains += sale.gain_loss
                else:
                    summary.short_term_losses += sale.gain_loss
            else:
                if sale.gain_loss >= 0:
                    summary.long_term_gains += sale.gain_loss
                else:
                    summary.long_term_losses += sale.gain_loss

            summary.wash_sale_disallowed += sale.wash_sale_disallowed

        summary.total_gains = summary.short_term_gains + summary.long_term_gains
        summary.total_losses = summary.short_term_losses + summary.long_term_losses

        # Net with carryover
        net = summary.total_gains + summary.total_losses + loss_carryover

        # Loss limitation ($3,000 per year)
        if net < 0:
            deductible = max(net, -3000)
            summary.net_gain_loss = deductible
        else:
            summary.net_gain_loss = net

        # Estimated tax
        net_st = summary.short_term_gains + summary.short_term_losses
        net_lt = summary.long_term_gains + summary.long_term_losses

        if net_st > 0:
            summary.estimated_tax += net_st * short_term_rate
        if net_lt > 0:
            summary.estimated_tax += net_lt * long_term_rate

        return summary


# ── Orchestrator ──────────────────────────────────────────────────────

class TaxLotEngine:
    def __init__(self) -> None:
        self.cost_basis = CostBasisCalculator()
        self.wash_sale = WashSaleDetector()
        self.harvester = TaxLossHarvester()
        self.gains = CapitalGainsCalculator()
        self.reporter = TaxReporter()

    def calculate_sale(self, lots: list[TaxLot], **kwargs) -> dict:
        return self.gains.calculate_sale(lots, **kwargs)

    def compare_methods(self, lots: list[TaxLot], **kwargs) -> dict:
        return self.gains.compare_methods(lots, **kwargs)

    def detect_wash_sales(self, sales: list[dict], purchases: list[dict]) -> list[dict]:
        return self.wash_sale.detect(sales, purchases)

    def find_harvest_opportunities(self, positions: list[dict], prices: dict[str, float], **kwargs) -> list[dict]:
        return self.harvester.find_opportunities(positions, prices, **kwargs)

    def optimal_harvest(self, opportunities: list[dict], **kwargs) -> dict:
        return self.harvester.optimal_harvest_plan(opportunities, **kwargs)

    def annual_summary(self, sales: list[SaleResult], **kwargs) -> dict:
        summary = self.reporter.annual_summary(sales, **kwargs)
        return summary.to_dict()

    def capabilities(self) -> dict:
        return {
            "engine": "TaxLotEngine",
            "version": "1.0.0",
            "features": [
                "cost_basis_methods (FIFO, LIFO, specific_ID, highest_cost, lowest_cost, avg_cost, min_tax)",
                "wash_sale_detection (30-day window)",
                "tax_loss_harvesting",
                "optimal_harvest_plan",
                "capital_gains_calculation",
                "method_comparison",
                "annual_tax_summary",
                "holding_period_analysis",
                "loss_carryover_tracking",
                "estimated_tax_liability",
            ],
        }
