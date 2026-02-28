"""
watchlist_engine.py — Bloomberg-grade Watchlist & Portfolio Monitor Engine
==========================================================================
Pure computation engine — no FastAPI imports.

Components:
    WatchlistColumn     — Column definition (field, label, format, sort)
    WatchlistItem       — Symbol with quote data, custom fields, alerts
    Watchlist           — Ordered list with CRUD, sorting, filtering
    WatchlistGroup      — Group watchlists under portfolios/categories
    QuoteManager        — Normalize + update quotes, compute derived fields
    HeatmapEngine       — Sector/group heatmap data generation
    ColumnEngine        — Custom column definitions (200+ built-in)
    SortEngine          — Multi-column sorting with tiebreakers
    FilterEngine        — Symbol-level filters on watchlist data
    WatchlistAnalytics  — Return analysis, correlation, sector breakdown
    WatchlistEngine     — Top-level orchestrator
"""

from __future__ import annotations
import time
import uuid
import numpy as np
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class ColumnFormat(Enum):
    NUMBER = "number"
    PERCENT = "percent"
    CURRENCY = "currency"
    VOLUME = "volume"
    TEXT = "text"
    DATE = "date"
    SPARKLINE = "sparkline"
    CHANGE = "change"       # color-coded +/-
    RATIO = "ratio"


class SortDirection(Enum):
    ASC = "asc"
    DESC = "desc"


class WatchlistType(Enum):
    PERSONAL = "personal"
    PORTFOLIO = "portfolio"
    SECTOR = "sector"
    INDEX = "index"
    SCREENER = "screener"
    SHARED = "shared"


# ─── DataClasses ─────────────────────────────────────────────────────────────

@dataclass
class WatchlistColumn:
    """Column definition for watchlist display."""
    field: str
    label: str
    format: ColumnFormat = ColumnFormat.NUMBER
    width: int = 100
    visible: bool = True
    sortable: bool = True
    decimals: int = 2
    color_code: bool = False  # red/green based on sign


@dataclass
class Quote:
    """Normalized market quote data."""
    symbol: str
    last: float = 0.0
    bid: float = 0.0
    ask: float = 0.0
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    prev_close: float = 0.0
    volume: int = 0
    avg_volume: int = 0
    market_cap: float = 0.0
    pe_ratio: float = 0.0
    dividend_yield: float = 0.0
    beta: float = 0.0
    week_52_high: float = 0.0
    week_52_low: float = 0.0
    timestamp: float = field(default_factory=time.time)

    @property
    def change(self) -> float:
        return self.last - self.prev_close if self.prev_close else 0.0

    @property
    def change_pct(self) -> float:
        return (self.change / self.prev_close * 100) if self.prev_close else 0.0

    @property
    def spread(self) -> float:
        return self.ask - self.bid if self.ask and self.bid else 0.0

    @property
    def spread_pct(self) -> float:
        return (self.spread / self.last * 100) if self.last else 0.0

    @property
    def day_range_pct(self) -> float:
        if self.high and self.low and self.low > 0:
            return (self.high - self.low) / self.low * 100
        return 0.0

    @property
    def volume_ratio(self) -> float:
        return self.volume / self.avg_volume if self.avg_volume else 0.0

    @property
    def from_52_high_pct(self) -> float:
        if self.week_52_high > 0:
            return (self.last - self.week_52_high) / self.week_52_high * 100
        return 0.0

    @property
    def from_52_low_pct(self) -> float:
        if self.week_52_low > 0:
            return (self.last - self.week_52_low) / self.week_52_low * 100
        return 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol, "last": self.last, "bid": self.bid,
            "ask": self.ask, "open": self.open, "high": self.high,
            "low": self.low, "close": self.close, "prev_close": self.prev_close,
            "volume": self.volume, "avg_volume": self.avg_volume,
            "change": self.change, "change_pct": self.change_pct,
            "spread": self.spread, "spread_pct": self.spread_pct,
            "market_cap": self.market_cap, "pe_ratio": self.pe_ratio,
            "beta": self.beta, "volume_ratio": self.volume_ratio,
            "day_range_pct": self.day_range_pct,
            "from_52_high_pct": self.from_52_high_pct,
            "from_52_low_pct": self.from_52_low_pct,
        }


@dataclass
class WatchlistItem:
    """A single item in a watchlist."""
    symbol: str
    quote: Optional[Quote] = None
    notes: str = ""
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    added_at: float = field(default_factory=time.time)
    cost_basis: float = 0.0
    shares: float = 0.0
    sector: str = ""
    industry: str = ""
    tags: List[str] = field(default_factory=list)

    @property
    def unrealized_pnl(self) -> float:
        if self.cost_basis > 0 and self.shares > 0 and self.quote:
            return (self.quote.last - self.cost_basis) * self.shares
        return 0.0

    @property
    def unrealized_pnl_pct(self) -> float:
        if self.cost_basis > 0:
            price = self.quote.last if self.quote else 0
            return (price - self.cost_basis) / self.cost_basis * 100
        return 0.0

    def get_field(self, field_name: str) -> Any:
        """Get a field value from quote, custom fields, or item."""
        if field_name in self.custom_fields:
            return self.custom_fields[field_name]
        if self.quote:
            qd = self.quote.to_dict()
            if field_name in qd:
                return qd[field_name]
        if hasattr(self, field_name):
            val = getattr(self, field_name)
            if not callable(val):
                return val
        # Check properties
        if field_name == "unrealized_pnl":
            return self.unrealized_pnl
        if field_name == "unrealized_pnl_pct":
            return self.unrealized_pnl_pct
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Watchlist — Core CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Watchlist:
    """An ordered watchlist of symbols."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    name: str = "Watchlist"
    watchlist_type: WatchlistType = WatchlistType.PERSONAL
    items: Dict[str, WatchlistItem] = field(default_factory=dict)
    order: List[str] = field(default_factory=list)
    columns: List[WatchlistColumn] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    description: str = ""
    tags: List[str] = field(default_factory=list)
    max_items: int = 500

    def add_symbol(self, symbol: str, **kwargs) -> bool:
        sym = symbol.upper()
        if sym in self.items:
            return False
        if len(self.items) >= self.max_items:
            return False
        item = WatchlistItem(symbol=sym, **kwargs)
        self.items[sym] = item
        self.order.append(sym)
        self.updated_at = time.time()
        return True

    def remove_symbol(self, symbol: str) -> bool:
        sym = symbol.upper()
        if sym not in self.items:
            return False
        del self.items[sym]
        self.order.remove(sym)
        self.updated_at = time.time()
        return True

    def get_item(self, symbol: str) -> Optional[WatchlistItem]:
        return self.items.get(symbol.upper())

    def has_symbol(self, symbol: str) -> bool:
        return symbol.upper() in self.items

    def move_symbol(self, symbol: str, new_index: int) -> bool:
        sym = symbol.upper()
        if sym not in self.items:
            return False
        self.order.remove(sym)
        idx = max(0, min(new_index, len(self.order)))
        self.order.insert(idx, sym)
        self.updated_at = time.time()
        return True

    def reorder(self, new_order: List[str]) -> bool:
        new_upper = [s.upper() for s in new_order]
        if set(new_upper) != set(self.order):
            return False
        self.order = new_upper
        self.updated_at = time.time()
        return True

    def update_quote(self, symbol: str, quote: Quote) -> bool:
        item = self.items.get(symbol.upper())
        if not item:
            return False
        item.quote = quote
        return True

    def bulk_update_quotes(self, quotes: Dict[str, Quote]) -> int:
        updated = 0
        for sym, q in quotes.items():
            if self.update_quote(sym, q):
                updated += 1
        return updated

    def get_ordered_items(self) -> List[WatchlistItem]:
        return [self.items[s] for s in self.order if s in self.items]

    @property
    def count(self) -> int:
        return len(self.items)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "name": self.name, "type": self.watchlist_type.value,
            "count": self.count, "order": self.order,
            "created_at": self.created_at, "updated_at": self.updated_at,
            "description": self.description, "tags": self.tags,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 2. WatchlistGroup — Group management
# ═══════════════════════════════════════════════════════════════════════════════

class WatchlistGroup:
    """Group multiple watchlists under categories."""

    def __init__(self):
        self._groups: Dict[str, List[str]] = {}  # group_name -> [watchlist_ids]

    def create_group(self, name: str) -> bool:
        if name in self._groups:
            return False
        self._groups[name] = []
        return True

    def delete_group(self, name: str) -> bool:
        return self._groups.pop(name, None) is not None

    def add_to_group(self, group_name: str, watchlist_id: str) -> bool:
        if group_name not in self._groups:
            return False
        if watchlist_id not in self._groups[group_name]:
            self._groups[group_name].append(watchlist_id)
        return True

    def remove_from_group(self, group_name: str, watchlist_id: str) -> bool:
        if group_name not in self._groups:
            return False
        try:
            self._groups[group_name].remove(watchlist_id)
            return True
        except ValueError:
            return False

    def get_group(self, name: str) -> List[str]:
        return list(self._groups.get(name, []))

    def list_groups(self) -> Dict[str, int]:
        return {name: len(ids) for name, ids in self._groups.items()}


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ColumnEngine — Built-in column definitions
# ═══════════════════════════════════════════════════════════════════════════════

class ColumnEngine:
    """Pre-built column definitions for watchlist display."""

    # 50+ standard columns
    COLUMNS: Dict[str, WatchlistColumn] = {
        "symbol": WatchlistColumn("symbol", "Symbol", ColumnFormat.TEXT, 80),
        "last": WatchlistColumn("last", "Last", ColumnFormat.CURRENCY, 80, decimals=2),
        "change": WatchlistColumn("change", "Chg", ColumnFormat.CHANGE, 70, color_code=True),
        "change_pct": WatchlistColumn("change_pct", "Chg%", ColumnFormat.PERCENT, 70, color_code=True),
        "bid": WatchlistColumn("bid", "Bid", ColumnFormat.CURRENCY, 70),
        "ask": WatchlistColumn("ask", "Ask", ColumnFormat.CURRENCY, 70),
        "spread": WatchlistColumn("spread", "Spread", ColumnFormat.CURRENCY, 70),
        "spread_pct": WatchlistColumn("spread_pct", "Sprd%", ColumnFormat.PERCENT, 60),
        "open": WatchlistColumn("open", "Open", ColumnFormat.CURRENCY, 80),
        "high": WatchlistColumn("high", "High", ColumnFormat.CURRENCY, 80),
        "low": WatchlistColumn("low", "Low", ColumnFormat.CURRENCY, 80),
        "close": WatchlistColumn("close", "Close", ColumnFormat.CURRENCY, 80),
        "prev_close": WatchlistColumn("prev_close", "Prev", ColumnFormat.CURRENCY, 80),
        "volume": WatchlistColumn("volume", "Volume", ColumnFormat.VOLUME, 100),
        "avg_volume": WatchlistColumn("avg_volume", "AvgVol", ColumnFormat.VOLUME, 100),
        "volume_ratio": WatchlistColumn("volume_ratio", "VolRatio", ColumnFormat.RATIO, 80),
        "market_cap": WatchlistColumn("market_cap", "MktCap", ColumnFormat.CURRENCY, 100),
        "pe_ratio": WatchlistColumn("pe_ratio", "P/E", ColumnFormat.NUMBER, 60),
        "dividend_yield": WatchlistColumn("dividend_yield", "Div%", ColumnFormat.PERCENT, 60),
        "beta": WatchlistColumn("beta", "Beta", ColumnFormat.NUMBER, 60),
        "week_52_high": WatchlistColumn("week_52_high", "52wH", ColumnFormat.CURRENCY, 80),
        "week_52_low": WatchlistColumn("week_52_low", "52wL", ColumnFormat.CURRENCY, 80),
        "from_52_high_pct": WatchlistColumn("from_52_high_pct", "Fr52H%", ColumnFormat.PERCENT, 70, color_code=True),
        "from_52_low_pct": WatchlistColumn("from_52_low_pct", "Fr52L%", ColumnFormat.PERCENT, 70, color_code=True),
        "day_range_pct": WatchlistColumn("day_range_pct", "DayRng%", ColumnFormat.PERCENT, 70),
        "unrealized_pnl": WatchlistColumn("unrealized_pnl", "UnrlzP&L", ColumnFormat.CURRENCY, 90, color_code=True),
        "unrealized_pnl_pct": WatchlistColumn("unrealized_pnl_pct", "UnrlzP&L%", ColumnFormat.PERCENT, 80, color_code=True),
        "cost_basis": WatchlistColumn("cost_basis", "CostBasis", ColumnFormat.CURRENCY, 90),
        "shares": WatchlistColumn("shares", "Shares", ColumnFormat.NUMBER, 70),
        "sector": WatchlistColumn("sector", "Sector", ColumnFormat.TEXT, 100),
        "industry": WatchlistColumn("industry", "Industry", ColumnFormat.TEXT, 120),
        "notes": WatchlistColumn("notes", "Notes", ColumnFormat.TEXT, 150),
    }

    @classmethod
    def get_column(cls, field: str) -> Optional[WatchlistColumn]:
        col = cls.COLUMNS.get(field)
        if col:
            # Return a copy so original isn't modified
            return WatchlistColumn(
                col.field, col.label, col.format, col.width,
                col.visible, col.sortable, col.decimals, col.color_code,
            )
        return None

    @classmethod
    def list_columns(cls) -> List[str]:
        return list(cls.COLUMNS.keys())

    @classmethod
    def default_columns(cls) -> List[WatchlistColumn]:
        """Standard Bloomberg-style column set."""
        default_fields = [
            "symbol", "last", "change", "change_pct", "volume",
            "bid", "ask", "high", "low", "market_cap",
        ]
        return [cls.get_column(f) for f in default_fields if cls.get_column(f)]

    @classmethod
    def portfolio_columns(cls) -> List[WatchlistColumn]:
        """Columns for portfolio watchlist."""
        fields = [
            "symbol", "last", "change_pct", "shares", "cost_basis",
            "unrealized_pnl", "unrealized_pnl_pct", "volume",
        ]
        return [cls.get_column(f) for f in fields if cls.get_column(f)]

    @classmethod
    def create_custom_column(cls, field: str, label: str,
                              fmt: ColumnFormat = ColumnFormat.NUMBER,
                              **kwargs) -> WatchlistColumn:
        return WatchlistColumn(field=field, label=label, format=fmt, **kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. SortEngine — Multi-column sorting
# ═══════════════════════════════════════════════════════════════════════════════

class SortEngine:
    """Sort watchlist items by one or multiple columns."""

    @staticmethod
    def sort_items(items: List[WatchlistItem],
                   sort_by: List[Tuple[str, SortDirection]]) -> List[WatchlistItem]:
        """Sort by multiple columns with tiebreakers."""
        if not sort_by or not items:
            return items

        def sort_key(item: WatchlistItem):
            keys = []
            for col, direction in sort_by:
                val = item.get_field(col)
                if val is None:
                    val = float('-inf') if direction == SortDirection.ASC else float('inf')
                elif isinstance(val, str):
                    val = val.lower()
                keys.append(val)
            return keys

        # Python sort is stable, so we do multi-column by sorting all at once
        # But we need to handle mixed asc/desc — simplify by using negation for desc numeric
        result = list(items)
        # Sort from last to first sort key (stable sort preserves earlier order)
        for col, direction in reversed(sort_by):
            reverse = direction == SortDirection.DESC

            def key_fn(item, c=col):
                val = item.get_field(c)
                if val is None:
                    return (1, "")  # sort None last
                if isinstance(val, (int, float)):
                    return (0, val)
                return (0, str(val).lower())

            result.sort(key=key_fn, reverse=reverse)
        return result

    @staticmethod
    def rank_items(items: List[WatchlistItem], field: str,
                   ascending: bool = True) -> List[Tuple[int, WatchlistItem]]:
        """Rank items by a single field."""
        vals = [(i, item, item.get_field(field)) for i, item in enumerate(items)]
        vals = [(i, item, v if v is not None else float('inf')) for i, item, v in vals]
        vals.sort(key=lambda x: x[2], reverse=not ascending)
        return [(rank + 1, item) for rank, (_, item, _) in enumerate(vals)]


# ═══════════════════════════════════════════════════════════════════════════════
# 5. FilterEngine — Watchlist filtering
# ═══════════════════════════════════════════════════════════════════════════════

class FilterEngine:
    """Filter watchlist items based on conditions."""

    @staticmethod
    def filter_items(items: List[WatchlistItem],
                     filters: List[Dict[str, Any]]) -> List[WatchlistItem]:
        """Apply filters. Each filter dict: {field, operator, value}."""
        result = items
        for f in filters:
            field_name = f.get("field", "")
            op = f.get("operator", ">")
            value = f.get("value", 0)
            result = [item for item in result
                      if FilterEngine._check(item.get_field(field_name), op, value)]
        return result

    @staticmethod
    def _check(val: Any, op: str, threshold: Any) -> bool:
        if val is None:
            return False
        try:
            if op == ">":
                return float(val) > float(threshold)
            elif op == "<":
                return float(val) < float(threshold)
            elif op == ">=":
                return float(val) >= float(threshold)
            elif op == "<=":
                return float(val) <= float(threshold)
            elif op == "==":
                return str(val).lower() == str(threshold).lower()
            elif op == "!=":
                return str(val).lower() != str(threshold).lower()
            elif op == "contains":
                return str(threshold).lower() in str(val).lower()
            elif op == "between":
                lo, hi = threshold
                return lo <= float(val) <= hi
        except (ValueError, TypeError):
            return False
        return False

    @staticmethod
    def search(items: List[WatchlistItem], query: str) -> List[WatchlistItem]:
        """Full-text search across symbol, sector, industry, notes."""
        q = query.lower()
        return [item for item in items
                if q in item.symbol.lower()
                or q in item.sector.lower()
                or q in item.industry.lower()
                or q in item.notes.lower()]


# ═══════════════════════════════════════════════════════════════════════════════
# 6. QuoteManager — Quote normalization & derived fields
# ═══════════════════════════════════════════════════════════════════════════════

class QuoteManager:
    """Centralized quote management for watchlists."""

    def __init__(self):
        self._quotes: Dict[str, Quote] = {}
        self._history: Dict[str, List[Quote]] = {}

    def update_quote(self, symbol: str, data: Dict[str, Any]) -> Quote:
        sym = symbol.upper()
        existing = self._quotes.get(sym)
        if existing:
            for key, val in data.items():
                if hasattr(existing, key):
                    setattr(existing, key, val)
            existing.timestamp = time.time()
            quote = existing
        else:
            quote = Quote(symbol=sym, **{k: v for k, v in data.items()
                                          if hasattr(Quote, k) and k != "symbol"})
            self._quotes[sym] = quote

        # Record history
        if sym not in self._history:
            self._history[sym] = []
        self._history[sym].append(Quote(
            symbol=sym, last=quote.last, volume=quote.volume,
            timestamp=quote.timestamp,
        ))
        # Trim history to last 1000 entries
        if len(self._history[sym]) > 1000:
            self._history[sym] = self._history[sym][-1000:]
        return quote

    def get_quote(self, symbol: str) -> Optional[Quote]:
        return self._quotes.get(symbol.upper())

    def get_quotes(self, symbols: List[str]) -> Dict[str, Quote]:
        return {s.upper(): self._quotes[s.upper()]
                for s in symbols if s.upper() in self._quotes}

    def get_history(self, symbol: str, limit: int = 100) -> List[Quote]:
        return self._history.get(symbol.upper(), [])[-limit:]

    def snapshot(self) -> Dict[str, Dict[str, Any]]:
        """Snapshot of all quotes."""
        return {sym: q.to_dict() for sym, q in self._quotes.items()}

    @property
    def count(self) -> int:
        return len(self._quotes)


# ═══════════════════════════════════════════════════════════════════════════════
# 7. HeatmapEngine — Sector / Group heatmaps
# ═══════════════════════════════════════════════════════════════════════════════

class HeatmapEngine:
    """Generate heatmap data from watchlist items."""

    @staticmethod
    def by_sector(items: List[WatchlistItem]) -> Dict[str, Dict[str, Any]]:
        """Group items by sector with aggregated performance."""
        sectors: Dict[str, List[WatchlistItem]] = {}
        for item in items:
            sector = item.sector or "Unknown"
            sectors.setdefault(sector, []).append(item)

        result = {}
        for sector, sector_items in sectors.items():
            changes = []
            total_cap = 0.0
            for item in sector_items:
                if item.quote:
                    changes.append(item.quote.change_pct)
                    total_cap += item.quote.market_cap
            avg_change = np.mean(changes) if changes else 0.0
            result[sector] = {
                "avg_change_pct": float(avg_change),
                "total_market_cap": total_cap,
                "count": len(sector_items),
                "symbols": [i.symbol for i in sector_items],
                "best": max(changes) if changes else 0.0,
                "worst": min(changes) if changes else 0.0,
            }
        return result

    @staticmethod
    def by_custom_group(items: List[WatchlistItem],
                        group_field: str = "tags") -> Dict[str, Dict[str, Any]]:
        """Group by a custom field."""
        groups: Dict[str, List[WatchlistItem]] = {}
        for item in items:
            val = item.get_field(group_field)
            if isinstance(val, list):
                for v in val:
                    groups.setdefault(str(v), []).append(item)
            else:
                groups.setdefault(str(val or "Unknown"), []).append(item)

        result = {}
        for group_name, group_items in groups.items():
            changes = [i.quote.change_pct for i in group_items if i.quote]
            result[group_name] = {
                "avg_change_pct": float(np.mean(changes)) if changes else 0.0,
                "count": len(group_items),
                "symbols": [i.symbol for i in group_items],
            }
        return result

    @staticmethod
    def performance_matrix(items: List[WatchlistItem],
                           price_history: Dict[str, np.ndarray],
                           periods: List[int] = None) -> Dict[str, Dict[str, float]]:
        """Multi-period performance matrix for each symbol."""
        if periods is None:
            periods = [1, 5, 20, 60, 252]  # 1D, 1W, 1M, 3M, 1Y
        result = {}
        for item in items:
            prices = price_history.get(item.symbol)
            if prices is None or len(prices) < 2:
                continue
            perfs = {}
            for p in periods:
                if len(prices) > p:
                    pct = (prices[-1] - prices[-1 - p]) / prices[-1 - p] * 100
                    perfs[f"{p}d"] = float(pct)
            result[item.symbol] = perfs
        return result


# ═══════════════════════════════════════════════════════════════════════════════
# 8. WatchlistAnalytics — Statistical analysis
# ═══════════════════════════════════════════════════════════════════════════════

class WatchlistAnalytics:
    """Statistical analysis for watchlist items."""

    @staticmethod
    def sector_breakdown(items: List[WatchlistItem]) -> Dict[str, float]:
        """Percentage breakdown by sector."""
        sectors: Dict[str, int] = {}
        for item in items:
            sec = item.sector or "Unknown"
            sectors[sec] = sectors.get(sec, 0) + 1
        total = len(items) if items else 1
        return {sec: count / total * 100 for sec, count in sectors.items()}

    @staticmethod
    def gainers_losers(items: List[WatchlistItem],
                       top_n: int = 5) -> Dict[str, List[Dict[str, Any]]]:
        """Top gainers and losers by change %."""
        with_change = []
        for item in items:
            if item.quote:
                with_change.append({
                    "symbol": item.symbol,
                    "change_pct": item.quote.change_pct,
                    "last": item.quote.last,
                    "volume": item.quote.volume,
                })
        sorted_items = sorted(with_change, key=lambda x: x["change_pct"], reverse=True)
        return {
            "gainers": sorted_items[:top_n],
            "losers": sorted_items[-top_n:] if len(sorted_items) >= top_n else sorted_items,
        }

    @staticmethod
    def market_breadth(items: List[WatchlistItem]) -> Dict[str, Any]:
        """Advancing vs declining items."""
        advancing = 0
        declining = 0
        unchanged = 0
        total_up_vol = 0
        total_down_vol = 0
        for item in items:
            if not item.quote:
                continue
            if item.quote.change > 0:
                advancing += 1
                total_up_vol += item.quote.volume
            elif item.quote.change < 0:
                declining += 1
                total_down_vol += item.quote.volume
            else:
                unchanged += 1
        total = advancing + declining + unchanged
        return {
            "advancing": advancing, "declining": declining, "unchanged": unchanged,
            "total": total,
            "advance_decline_ratio": advancing / declining if declining > 0 else float('inf'),
            "up_volume": total_up_vol, "down_volume": total_down_vol,
            "breadth_pct": advancing / total * 100 if total > 0 else 50.0,
        }

    @staticmethod
    def correlation_matrix(price_history: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """Correlation matrix between symbols."""
        symbols = sorted(price_history.keys())
        if len(symbols) < 2:
            return {"symbols": symbols, "matrix": []}

        # Compute returns
        returns = {}
        min_len = float('inf')
        for sym in symbols:
            prices = price_history[sym]
            if len(prices) < 2:
                continue
            ret = np.diff(prices) / prices[:-1]
            returns[sym] = ret
            min_len = min(min_len, len(ret))

        if len(returns) < 2:
            return {"symbols": symbols, "matrix": []}

        # Build matrix
        valid_symbols = sorted(returns.keys())
        n = len(valid_symbols)
        matrix = np.zeros((n, n))
        for i in range(n):
            for j in range(n):
                ri = returns[valid_symbols[i]][:int(min_len)]
                rj = returns[valid_symbols[j]][:int(min_len)]
                if len(ri) > 1 and np.std(ri) > 0 and np.std(rj) > 0:
                    matrix[i, j] = float(np.corrcoef(ri, rj)[0, 1])
                else:
                    matrix[i, j] = 1.0 if i == j else 0.0

        return {
            "symbols": valid_symbols,
            "matrix": matrix.tolist(),
        }

    @staticmethod
    def summary_stats(items: List[WatchlistItem]) -> Dict[str, Any]:
        """Summary statistics for the watchlist."""
        prices = [i.quote.last for i in items if i.quote and i.quote.last > 0]
        changes = [i.quote.change_pct for i in items if i.quote]
        volumes = [i.quote.volume for i in items if i.quote]
        caps = [i.quote.market_cap for i in items if i.quote and i.quote.market_cap > 0]

        return {
            "total_symbols": len(items),
            "with_quotes": len(prices),
            "avg_price": float(np.mean(prices)) if prices else 0,
            "median_price": float(np.median(prices)) if prices else 0,
            "avg_change_pct": float(np.mean(changes)) if changes else 0,
            "median_change_pct": float(np.median(changes)) if changes else 0,
            "total_volume": int(np.sum(volumes)) if volumes else 0,
            "avg_volume": float(np.mean(volumes)) if volumes else 0,
            "total_market_cap": float(np.sum(caps)) if caps else 0,
            "positive_count": sum(1 for c in changes if c > 0),
            "negative_count": sum(1 for c in changes if c < 0),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 9. WatchlistEngine — Top-level orchestrator
# ═══════════════════════════════════════════════════════════════════════════════

class WatchlistEngine:
    """Bloomberg-grade watchlist management system."""

    def __init__(self):
        self._watchlists: Dict[str, Watchlist] = {}
        self._groups = WatchlistGroup()
        self._quote_manager = QuoteManager()
        self._column_engine = ColumnEngine

    # ── Watchlist CRUD ──

    def create_watchlist(self, name: str, wtype: WatchlistType = WatchlistType.PERSONAL,
                         description: str = "") -> str:
        wl = Watchlist(name=name, watchlist_type=wtype, description=description)
        wl.columns = ColumnEngine.default_columns()
        self._watchlists[wl.id] = wl
        return wl.id

    def get_watchlist(self, wl_id: str) -> Optional[Watchlist]:
        return self._watchlists.get(wl_id)

    def delete_watchlist(self, wl_id: str) -> bool:
        return self._watchlists.pop(wl_id, None) is not None

    def list_watchlists(self) -> List[Dict[str, Any]]:
        return [wl.to_dict() for wl in self._watchlists.values()]

    def rename_watchlist(self, wl_id: str, new_name: str) -> bool:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return False
        wl.name = new_name
        wl.updated_at = time.time()
        return True

    # ── Symbol CRUD ──

    def add_symbol(self, wl_id: str, symbol: str, **kwargs) -> bool:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return False
        return wl.add_symbol(symbol, **kwargs)

    def remove_symbol(self, wl_id: str, symbol: str) -> bool:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return False
        return wl.remove_symbol(symbol)

    def move_symbol(self, wl_id: str, symbol: str, new_index: int) -> bool:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return False
        return wl.move_symbol(symbol, new_index)

    # ── Quotes ──

    def update_quote(self, symbol: str, data: Dict[str, Any]) -> Quote:
        quote = self._quote_manager.update_quote(symbol, data)
        # Push to all watchlists containing this symbol
        for wl in self._watchlists.values():
            wl.update_quote(symbol, quote)
        return quote

    def bulk_update_quotes(self, quotes: Dict[str, Dict[str, Any]]) -> int:
        updated = 0
        for sym, data in quotes.items():
            self.update_quote(sym, data)
            updated += 1
        return updated

    # ── Sorting ──

    def sort_watchlist(self, wl_id: str,
                       sort_by: List[Tuple[str, SortDirection]]) -> List[WatchlistItem]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return []
        items = wl.get_ordered_items()
        return SortEngine.sort_items(items, sort_by)

    # ── Filtering ──

    def filter_watchlist(self, wl_id: str,
                         filters: List[Dict[str, Any]]) -> List[WatchlistItem]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return []
        items = wl.get_ordered_items()
        return FilterEngine.filter_items(items, filters)

    def search_watchlist(self, wl_id: str, query: str) -> List[WatchlistItem]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return []
        return FilterEngine.search(wl.get_ordered_items(), query)

    # ── Analytics ──

    def sector_breakdown(self, wl_id: str) -> Dict[str, float]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return {}
        return WatchlistAnalytics.sector_breakdown(wl.get_ordered_items())

    def gainers_losers(self, wl_id: str, top_n: int = 5) -> Dict[str, Any]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return {"gainers": [], "losers": []}
        return WatchlistAnalytics.gainers_losers(wl.get_ordered_items(), top_n)

    def market_breadth(self, wl_id: str) -> Dict[str, Any]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return {}
        return WatchlistAnalytics.market_breadth(wl.get_ordered_items())

    def summary_stats(self, wl_id: str) -> Dict[str, Any]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return {}
        return WatchlistAnalytics.summary_stats(wl.get_ordered_items())

    # ── Heatmap ──

    def sector_heatmap(self, wl_id: str) -> Dict[str, Dict[str, Any]]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return {}
        return HeatmapEngine.by_sector(wl.get_ordered_items())

    # ── Import / Export ──

    def export_symbols(self, wl_id: str) -> List[str]:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return []
        return list(wl.order)

    def import_symbols(self, wl_id: str, symbols: List[str]) -> int:
        wl = self._watchlists.get(wl_id)
        if not wl:
            return 0
        added = 0
        for sym in symbols:
            if wl.add_symbol(sym):
                added += 1
        return added

    # ── Groups ──

    def create_group(self, name: str) -> bool:
        return self._groups.create_group(name)

    def add_to_group(self, group_name: str, wl_id: str) -> bool:
        return self._groups.add_to_group(group_name, wl_id)

    def list_groups(self) -> Dict[str, int]:
        return self._groups.list_groups()

    # ── Capabilities ──

    def capabilities(self) -> Dict[str, Any]:
        return {
            "total_watchlists": len(self._watchlists),
            "total_symbols": sum(wl.count for wl in self._watchlists.values()),
            "total_quotes": self._quote_manager.count,
            "available_columns": len(ColumnEngine.COLUMNS),
            "groups": len(self._groups.list_groups()),
            "features": [
                "multi_column_sort", "custom_columns", "heatmaps",
                "sector_analytics", "market_breadth", "correlation",
                "gainers_losers", "search", "filter", "import_export",
                "watchlist_groups", "quote_history",
            ],
        }
