"""
Wave 27 — Unified Portfolio Accounting
Single portfolio ledger used by backtester + evaluation + walk-forward.
"""
from __future__ import annotations
import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


@dataclass
class Fill:
    fill_id: str
    symbol: str
    side: Side
    qty: float
    price: float
    commission: float = 0.0
    slippage: float = 0.0
    timestamp: str = ""

    @property
    def net_cost(self) -> float:
        sign = 1 if self.side == Side.BUY else -1
        return sign * self.qty * self.price + self.commission + abs(self.slippage)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fill_id": self.fill_id,
            "symbol": self.symbol,
            "side": self.side.value,
            "qty": self.qty,
            "price": self.price,
            "commission": self.commission,
            "slippage": self.slippage,
            "timestamp": self.timestamp,
            "net_cost": round(self.net_cost, 4),
        }


@dataclass
class Position:
    symbol: str
    qty: float = 0.0
    avg_price: float = 0.0
    realized_pnl: float = 0.0
    cost_basis: float = 0.0

    @property
    def is_flat(self) -> bool:
        return abs(self.qty) < 1e-10

    def market_value(self, current_price: float) -> float:
        return self.qty * current_price

    def unrealized_pnl(self, current_price: float) -> float:
        if self.is_flat:
            return 0.0
        return self.qty * (current_price - self.avg_price)

    def to_dict(self, current_price: Optional[float] = None) -> Dict[str, Any]:
        d = {
            "symbol": self.symbol,
            "qty": self.qty,
            "avg_price": round(self.avg_price, 4),
            "realized_pnl": round(self.realized_pnl, 4),
            "cost_basis": round(self.cost_basis, 4),
        }
        if current_price is not None:
            d["market_value"] = round(self.market_value(current_price), 4)
            d["unrealized_pnl"] = round(self.unrealized_pnl(current_price), 4)
        return d


class PortfolioLedger:
    """Unified portfolio with full accounting invariants."""

    def __init__(self, initial_cash: float = 100000.0) -> None:
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.positions: Dict[str, Position] = {}
        self.fills: List[Fill] = []
        self.equity_curve: List[Dict[str, Any]] = []
        self._fill_counter = 0

    def apply_fill(self, symbol: str, side: Side, qty: float, price: float,
                   commission: float = 0.0, slippage: float = 0.0,
                   timestamp: str = "") -> Fill:
        """Apply a fill to the portfolio. Returns the fill record."""
        self._fill_counter += 1
        fill_id = f"fill-{self._fill_counter:06d}"

        fill = Fill(
            fill_id=fill_id,
            symbol=symbol,
            side=side,
            qty=qty,
            price=price,
            commission=commission,
            slippage=slippage,
            timestamp=timestamp,
        )

        pos = self.positions.get(symbol)
        if pos is None:
            pos = Position(symbol=symbol)
            self.positions[symbol] = pos

        if side == Side.BUY:
            # Adding to position
            total_cost = pos.qty * pos.avg_price + qty * price
            pos.qty += qty
            pos.avg_price = total_cost / pos.qty if pos.qty != 0 else 0.0
            pos.cost_basis += qty * price
            self.cash -= qty * price + commission + abs(slippage)
        else:
            # Reducing/closing position
            if pos.qty > 0:
                realized = qty * (price - pos.avg_price)
                pos.realized_pnl += realized
            pos.qty -= qty
            self.cash += qty * price - commission - abs(slippage)
            if pos.is_flat:
                pos.avg_price = 0.0

        self.fills.append(fill)
        return fill

    def snapshot(self, prices: Dict[str, float], timestamp: str = "") -> Dict[str, Any]:
        """Take equity snapshot at current prices."""
        positions_value = sum(
            pos.market_value(prices.get(sym, pos.avg_price))
            for sym, pos in self.positions.items()
            if not pos.is_flat
        )
        equity = self.cash + positions_value
        snap = {
            "timestamp": timestamp,
            "cash": round(self.cash, 2),
            "positions_value": round(positions_value, 2),
            "equity": round(equity, 2),
            "total_fills": len(self.fills),
        }
        self.equity_curve.append(snap)
        return snap

    def total_equity(self, prices: Dict[str, float]) -> float:
        positions_value = sum(
            pos.market_value(prices.get(sym, pos.avg_price))
            for sym, pos in self.positions.items()
            if not pos.is_flat
        )
        return self.cash + positions_value

    def total_return(self, prices: Dict[str, float]) -> float:
        eq = self.total_equity(prices)
        return (eq - self.initial_cash) / self.initial_cash if self.initial_cash > 0 else 0.0

    def max_drawdown(self) -> float:
        if not self.equity_curve:
            return 0.0
        peak = 0.0
        max_dd = 0.0
        for snap in self.equity_curve:
            eq = snap["equity"]
            peak = max(peak, eq)
            dd = (peak - eq) / peak if peak > 0 else 0.0
            max_dd = max(max_dd, dd)
        return round(max_dd, 4)

    def ledger_hash(self) -> str:
        payload = "|".join(f.fill_id for f in self.fills)
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def to_dict(self, prices: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        p = prices or {}
        return {
            "initial_cash": self.initial_cash,
            "cash": round(self.cash, 2),
            "equity": round(self.total_equity(p), 2),
            "total_return": round(self.total_return(p), 4),
            "max_drawdown": self.max_drawdown(),
            "positions": {
                sym: pos.to_dict(p.get(sym))
                for sym, pos in self.positions.items()
                if not pos.is_flat
            },
            "total_fills": len(self.fills),
            "ledger_hash": self.ledger_hash(),
        }

    def accounting_invariant_check(self, prices: Dict[str, float]) -> Dict[str, Any]:
        """Verify accounting invariants hold."""
        eq = self.total_equity(prices)
        total_commissions = sum(f.commission for f in self.fills)
        total_slippage = sum(abs(f.slippage) for f in self.fills)
        total_realized = sum(p.realized_pnl for p in self.positions.values())
        total_unrealized = sum(
            p.unrealized_pnl(prices.get(sym, p.avg_price))
            for sym, p in self.positions.items()
        )

        expected_equity = self.initial_cash + total_realized + total_unrealized - total_commissions - total_slippage
        diff = abs(eq - expected_equity)

        return {
            "equity": round(eq, 2),
            "expected_equity": round(expected_equity, 2),
            "difference": round(diff, 4),
            "invariant_holds": diff < 0.01,
            "total_commissions": round(total_commissions, 4),
            "total_slippage": round(total_slippage, 4),
            "total_realized_pnl": round(total_realized, 4),
            "total_unrealized_pnl": round(total_unrealized, 4),
        }
