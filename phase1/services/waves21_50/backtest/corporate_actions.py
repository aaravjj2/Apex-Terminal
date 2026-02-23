"""
Wave 23 — Corporate Actions
Adjustments for splits, dividends, and other corporate actions.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import List, Optional, Dict, Any
from .canonical_schema import CanonicalBar, BarSeries, AdjustmentType


class ActionType(str, Enum):
    SPLIT = "split"
    REVERSE_SPLIT = "reverse_split"
    DIVIDEND = "dividend"
    SPECIAL_DIVIDEND = "special_dividend"
    SPINOFF = "spinoff"
    MERGER = "merger"


@dataclass(frozen=True)
class CorporateAction:
    symbol: str
    action_type: ActionType
    ex_date: str           # ISO date
    ratio: float = 1.0    # e.g. 4.0 for 4:1 split
    amount: float = 0.0   # dividend amount per share
    description: str = ""
    source: str = "yfinance"

    @property
    def action_id(self) -> str:
        import hashlib
        payload = f"{self.symbol}|{self.action_type.value}|{self.ex_date}|{self.ratio}|{self.amount}"
        return hashlib.sha256(payload.encode()).hexdigest()[:12]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action_id": self.action_id,
            "symbol": self.symbol,
            "action_type": self.action_type.value,
            "ex_date": self.ex_date,
            "ratio": self.ratio,
            "amount": self.amount,
            "description": self.description,
            "source": self.source,
        }


class CorporateActionsRegistry:
    """Registry of corporate actions with adjustment engine."""

    def __init__(self) -> None:
        self._actions: Dict[str, List[CorporateAction]] = {}

    def add_action(self, action: CorporateAction) -> None:
        if action.symbol not in self._actions:
            self._actions[action.symbol] = []
        # Dedup by action_id
        existing_ids = {a.action_id for a in self._actions[action.symbol]}
        if action.action_id not in existing_ids:
            self._actions[action.symbol].append(action)
            self._actions[action.symbol].sort(key=lambda a: a.ex_date)

    def get_actions(self, symbol: str, start_date: Optional[str] = None,
                    end_date: Optional[str] = None) -> List[CorporateAction]:
        actions = self._actions.get(symbol, [])
        if start_date:
            actions = [a for a in actions if a.ex_date >= start_date]
        if end_date:
            actions = [a for a in actions if a.ex_date <= end_date]
        return actions

    def adjust_bars(self, bars: List[CanonicalBar], symbol: str) -> List[CanonicalBar]:
        """Apply corporate actions adjustments to bars (backward adjustment)."""
        actions = self.get_actions(symbol)
        if not actions:
            return bars

        adjusted: List[CanonicalBar] = []
        for bar in bars:
            adj_factor = 1.0
            div_adj = 0.0
            for action in actions:
                if bar.timestamp[:10] < action.ex_date:
                    if action.action_type in (ActionType.SPLIT, ActionType.REVERSE_SPLIT):
                        adj_factor *= action.ratio
                    elif action.action_type in (ActionType.DIVIDEND, ActionType.SPECIAL_DIVIDEND):
                        div_adj += action.amount

            if adj_factor != 1.0 or div_adj != 0.0:
                adj_bar = CanonicalBar(
                    symbol=bar.symbol,
                    timestamp=bar.timestamp,
                    resolution=bar.resolution,
                    open=round(bar.open / adj_factor - div_adj, 4),
                    high=round(bar.high / adj_factor - div_adj, 4),
                    low=round(bar.low / adj_factor - div_adj, 4),
                    close=round(bar.close / adj_factor - div_adj, 4),
                    volume=int(bar.volume * adj_factor),
                    adj_close=round(bar.close / adj_factor - div_adj, 4),
                    vwap=bar.vwap,
                    trade_count=bar.trade_count,
                    provenance=bar.provenance,
                )
                adjusted.append(adj_bar)
            else:
                adjusted.append(bar)

        return adjusted

    def symbols(self) -> List[str]:
        return list(self._actions.keys())

    def count(self, symbol: Optional[str] = None) -> int:
        if symbol:
            return len(self._actions.get(symbol, []))
        return sum(len(v) for v in self._actions.values())


# Singleton
_registry: Optional[CorporateActionsRegistry] = None

def get_corporate_actions() -> CorporateActionsRegistry:
    global _registry
    if _registry is None:
        _registry = CorporateActionsRegistry()
    return _registry
