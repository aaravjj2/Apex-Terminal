"""
test_watchlist_engine.py — Comprehensive tests for watchlist_engine.py
=======================================================================
Tests: Quote, WatchlistItem, Watchlist, WatchlistGroup, ColumnEngine,
       SortEngine, FilterEngine, QuoteManager, HeatmapEngine,
       WatchlistAnalytics, WatchlistEngine
"""

import time
import pytest
import numpy as np
from services.watchlist_engine import (
    ColumnFormat, SortDirection, WatchlistType,
    WatchlistColumn, Quote, WatchlistItem, Watchlist, WatchlistGroup,
    ColumnEngine, SortEngine, FilterEngine, QuoteManager,
    HeatmapEngine, WatchlistAnalytics, WatchlistEngine,
)


# ── Helpers ──

def _make_quote(symbol: str, last: float = 100.0, prev_close: float = 95.0,
                volume: int = 1_000_000, market_cap: float = 1e9,
                **kwargs) -> Quote:
    return Quote(symbol=symbol, last=last, prev_close=prev_close,
                 volume=volume, avg_volume=800_000, market_cap=market_cap,
                 open=96, high=102, low=94, close=last,
                 bid=last - 0.05, ask=last + 0.05, **kwargs)


def _make_item(symbol: str, sector: str = "Tech", **kwargs) -> WatchlistItem:
    q = _make_quote(symbol, **kwargs)
    return WatchlistItem(symbol=symbol, quote=q, sector=sector)


# ═══════════════════════════════════════════════════════════════════════════════
# Quote
# ═══════════════════════════════════════════════════════════════════════════════

class TestQuote:
    def test_change(self):
        q = _make_quote("AAPL", last=100.0, prev_close=95.0)
        assert abs(q.change - 5.0) < 1e-10

    def test_change_pct(self):
        q = _make_quote("AAPL", last=100.0, prev_close=95.0)
        assert abs(q.change_pct - (5.0 / 95.0 * 100)) < 1e-6

    def test_spread(self):
        q = _make_quote("AAPL", last=100.0)
        assert q.spread == pytest.approx(0.1, abs=0.01)

    def test_spread_pct(self):
        q = _make_quote("AAPL", last=100.0)
        assert q.spread_pct > 0

    def test_day_range_pct(self):
        q = _make_quote("X", last=100)
        assert q.day_range_pct > 0  # high=102, low=94

    def test_volume_ratio(self):
        q = _make_quote("X", volume=1_600_000)
        assert q.volume_ratio == pytest.approx(2.0)

    def test_from_52_high(self):
        q = Quote(symbol="X", last=90, week_52_high=100)
        assert q.from_52_high_pct == pytest.approx(-10.0)

    def test_from_52_low(self):
        q = Quote(symbol="X", last=110, week_52_low=100)
        assert q.from_52_low_pct == pytest.approx(10.0)

    def test_zero_prev_close(self):
        q = Quote(symbol="X", last=100, prev_close=0)
        assert q.change == 0
        assert q.change_pct == 0

    def test_to_dict(self):
        q = _make_quote("AAPL")
        d = q.to_dict()
        assert d["symbol"] == "AAPL"
        assert "change" in d
        assert "change_pct" in d


# ═══════════════════════════════════════════════════════════════════════════════
# WatchlistItem
# ═══════════════════════════════════════════════════════════════════════════════

class TestWatchlistItem:
    def test_basic(self):
        item = _make_item("AAPL")
        assert item.symbol == "AAPL"
        assert item.sector == "Tech"

    def test_unrealized_pnl(self):
        item = _make_item("AAPL", last=110.0)
        item.cost_basis = 100.0
        item.shares = 10.0
        assert item.unrealized_pnl == pytest.approx(100.0)

    def test_unrealized_pnl_pct(self):
        item = _make_item("AAPL", last=110.0)
        item.cost_basis = 100.0
        assert item.unrealized_pnl_pct == pytest.approx(10.0)

    def test_unrealized_no_cost(self):
        item = _make_item("AAPL")
        assert item.unrealized_pnl == 0.0
        assert item.unrealized_pnl_pct == 0.0

    def test_get_field_from_quote(self):
        item = _make_item("AAPL")
        assert item.get_field("last") == 100.0

    def test_get_field_custom(self):
        item = _make_item("AAPL")
        item.custom_fields["rating"] = 5
        assert item.get_field("rating") == 5

    def test_get_field_property(self):
        item = _make_item("AAPL", last=120)
        item.cost_basis = 100
        item.shares = 10
        assert item.get_field("unrealized_pnl") == pytest.approx(200.0)

    def test_get_field_none(self):
        item = _make_item("AAPL")
        assert item.get_field("nonexistent_xyz") is None


# ═══════════════════════════════════════════════════════════════════════════════
# Watchlist
# ═══════════════════════════════════════════════════════════════════════════════

class TestWatchlist:
    def test_add_symbol(self):
        wl = Watchlist(name="Test")
        assert wl.add_symbol("AAPL") is True
        assert wl.count == 1
        assert "AAPL" in wl.order

    def test_add_duplicate(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("AAPL")
        assert wl.add_symbol("aapl") is False  # case insensitive

    def test_add_over_max(self):
        wl = Watchlist(name="Test", max_items=2)
        wl.add_symbol("A")
        wl.add_symbol("B")
        assert wl.add_symbol("C") is False

    def test_remove_symbol(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("AAPL")
        assert wl.remove_symbol("AAPL") is True
        assert wl.count == 0

    def test_remove_nonexistent(self):
        wl = Watchlist(name="Test")
        assert wl.remove_symbol("NOPE") is False

    def test_has_symbol(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("AAPL")
        assert wl.has_symbol("AAPL") is True
        assert wl.has_symbol("TSLA") is False

    def test_move_symbol(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("A")
        wl.add_symbol("B")
        wl.add_symbol("C")
        assert wl.move_symbol("C", 0) is True
        assert wl.order == ["C", "A", "B"]

    def test_reorder(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("A")
        wl.add_symbol("B")
        wl.add_symbol("C")
        assert wl.reorder(["C", "B", "A"]) is True
        assert wl.order == ["C", "B", "A"]

    def test_reorder_invalid(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("A")
        wl.add_symbol("B")
        assert wl.reorder(["A", "C"]) is False  # C not in watchlist

    def test_update_quote(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("AAPL")
        q = _make_quote("AAPL", last=155.0)
        assert wl.update_quote("AAPL", q) is True
        assert wl.get_item("AAPL").quote.last == 155.0

    def test_bulk_update_quotes(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("A")
        wl.add_symbol("B")
        quotes = {"A": _make_quote("A"), "B": _make_quote("B"), "C": _make_quote("C")}
        updated = wl.bulk_update_quotes(quotes)
        assert updated == 2  # C not in watchlist

    def test_get_ordered_items(self):
        wl = Watchlist(name="Test")
        wl.add_symbol("B")
        wl.add_symbol("A")
        items = wl.get_ordered_items()
        assert items[0].symbol == "B"
        assert items[1].symbol == "A"

    def test_to_dict(self):
        wl = Watchlist(name="My WL", description="test")
        wl.add_symbol("AAPL")
        d = wl.to_dict()
        assert d["name"] == "My WL"
        assert d["count"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# WatchlistGroup
# ═══════════════════════════════════════════════════════════════════════════════

class TestWatchlistGroup:
    def test_create_group(self):
        g = WatchlistGroup()
        assert g.create_group("Tech") is True
        assert g.create_group("Tech") is False  # duplicate

    def test_delete_group(self):
        g = WatchlistGroup()
        g.create_group("Tech")
        assert g.delete_group("Tech") is True
        assert g.delete_group("Tech") is False

    def test_add_remove(self):
        g = WatchlistGroup()
        g.create_group("Tech")
        assert g.add_to_group("Tech", "wl1") is True
        assert g.add_to_group("NonExistent", "wl1") is False
        assert g.get_group("Tech") == ["wl1"]
        assert g.remove_from_group("Tech", "wl1") is True
        assert g.get_group("Tech") == []

    def test_list_groups(self):
        g = WatchlistGroup()
        g.create_group("A")
        g.create_group("B")
        g.add_to_group("A", "w1")
        g.add_to_group("A", "w2")
        groups = g.list_groups()
        assert groups["A"] == 2
        assert groups["B"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# ColumnEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestColumnEngine:
    def test_get_column(self):
        col = ColumnEngine.get_column("last")
        assert col is not None
        assert col.field == "last"

    def test_get_column_nonexistent(self):
        assert ColumnEngine.get_column("xxx") is None

    def test_list_columns(self):
        cols = ColumnEngine.list_columns()
        assert len(cols) >= 30

    def test_default_columns(self):
        cols = ColumnEngine.default_columns()
        assert len(cols) >= 8
        fields = [c.field for c in cols]
        assert "symbol" in fields
        assert "last" in fields

    def test_portfolio_columns(self):
        cols = ColumnEngine.portfolio_columns()
        fields = [c.field for c in cols]
        assert "cost_basis" in fields
        assert "unrealized_pnl" in fields

    def test_custom_column(self):
        col = ColumnEngine.create_custom_column("my_col", "My Column",
                                                 ColumnFormat.PERCENT)
        assert col.field == "my_col"
        assert col.format == ColumnFormat.PERCENT


# ═══════════════════════════════════════════════════════════════════════════════
# SortEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestSortEngine:
    def _items(self):
        return [
            _make_item("AAPL", last=150, volume=1_000_000),
            _make_item("TSLA", last=200, volume=500_000),
            _make_item("MSFT", last=300, volume=2_000_000),
        ]

    def test_sort_by_price_asc(self):
        items = self._items()
        sorted_items = SortEngine.sort_items(items, [("last", SortDirection.ASC)])
        assert sorted_items[0].symbol == "AAPL"
        assert sorted_items[2].symbol == "MSFT"

    def test_sort_by_price_desc(self):
        items = self._items()
        sorted_items = SortEngine.sort_items(items, [("last", SortDirection.DESC)])
        assert sorted_items[0].symbol == "MSFT"

    def test_sort_by_symbol(self):
        items = self._items()
        sorted_items = SortEngine.sort_items(items, [("symbol", SortDirection.ASC)])
        assert sorted_items[0].symbol == "AAPL"
        assert sorted_items[1].symbol == "MSFT"
        assert sorted_items[2].symbol == "TSLA"

    def test_sort_empty(self):
        assert SortEngine.sort_items([], [("last", SortDirection.ASC)]) == []

    def test_rank_items(self):
        items = self._items()
        ranked = SortEngine.rank_items(items, "last", ascending=True)
        assert ranked[0][0] == 1  # rank 1
        assert ranked[0][1].symbol == "AAPL"


# ═══════════════════════════════════════════════════════════════════════════════
# FilterEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestFilterEngine:
    def _items(self):
        return [
            _make_item("AAPL", sector="Tech", last=150, volume=1_000_000),
            _make_item("XOM", sector="Energy", last=80, volume=2_000_000),
            _make_item("JPM", sector="Finance", last=170, volume=500_000),
        ]

    def test_filter_greater_than(self):
        items = self._items()
        result = FilterEngine.filter_items(items, [
            {"field": "last", "operator": ">", "value": 100}
        ])
        assert len(result) == 2

    def test_filter_equals(self):
        items = self._items()
        result = FilterEngine.filter_items(items, [
            {"field": "sector", "operator": "==", "value": "Tech"}
        ])
        assert len(result) == 1

    def test_filter_contains(self):
        items = self._items()
        items[0].notes = "great company"
        result = FilterEngine.filter_items(items, [
            {"field": "notes", "operator": "contains", "value": "great"}
        ])
        assert len(result) == 1

    def test_filter_between(self):
        items = self._items()
        result = FilterEngine.filter_items(items, [
            {"field": "last", "operator": "between", "value": [100, 160]}
        ])
        assert len(result) == 1  # only AAPL at 150

    def test_search(self):
        items = self._items()
        result = FilterEngine.search(items, "tech")
        assert len(result) == 1
        assert result[0].symbol == "AAPL"

    def test_search_symbol(self):
        items = self._items()
        result = FilterEngine.search(items, "jpm")
        assert len(result) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# QuoteManager
# ═══════════════════════════════════════════════════════════════════════════════

class TestQuoteManager:
    def test_update_and_get(self):
        qm = QuoteManager()
        q = qm.update_quote("AAPL", {"last": 150.0, "volume": 1_000_000})
        assert q.last == 150.0
        fetched = qm.get_quote("AAPL")
        assert fetched.last == 150.0

    def test_update_existing(self):
        qm = QuoteManager()
        qm.update_quote("AAPL", {"last": 150.0})
        qm.update_quote("AAPL", {"last": 155.0})
        assert qm.get_quote("AAPL").last == 155.0

    def test_get_quotes(self):
        qm = QuoteManager()
        qm.update_quote("AAPL", {"last": 150.0})
        qm.update_quote("TSLA", {"last": 200.0})
        quotes = qm.get_quotes(["AAPL", "TSLA", "MISSING"])
        assert len(quotes) == 2

    def test_history(self):
        qm = QuoteManager()
        qm.update_quote("AAPL", {"last": 150.0})
        qm.update_quote("AAPL", {"last": 155.0})
        hist = qm.get_history("AAPL")
        assert len(hist) == 2

    def test_snapshot(self):
        qm = QuoteManager()
        qm.update_quote("AAPL", {"last": 150.0})
        snap = qm.snapshot()
        assert "AAPL" in snap

    def test_count(self):
        qm = QuoteManager()
        qm.update_quote("A", {"last": 1})
        qm.update_quote("B", {"last": 2})
        assert qm.count == 2


# ═══════════════════════════════════════════════════════════════════════════════
# HeatmapEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestHeatmapEngine:
    def test_by_sector(self):
        items = [
            _make_item("AAPL", sector="Tech", last=105, prev_close=100),
            _make_item("MSFT", sector="Tech", last=110, prev_close=100),
            _make_item("XOM", sector="Energy", last=90, prev_close=100),
        ]
        result = HeatmapEngine.by_sector(items)
        assert "Tech" in result
        assert "Energy" in result
        assert result["Tech"]["count"] == 2
        assert result["Tech"]["avg_change_pct"] > 0

    def test_by_custom_group(self):
        items = [
            _make_item("AAPL", sector="Tech"),
            _make_item("TSLA", sector="Auto"),
        ]
        items[0].tags = ["growth", "mega"]
        items[1].tags = ["growth", "ev"]
        result = HeatmapEngine.by_custom_group(items, "tags")
        assert "growth" in result
        assert result["growth"]["count"] == 2

    def test_performance_matrix(self):
        items = [_make_item("AAPL"), _make_item("TSLA")]
        history = {
            "AAPL": np.linspace(90, 100, 300),
            "TSLA": np.linspace(180, 200, 300),
        }
        result = HeatmapEngine.performance_matrix(items, history, [1, 5, 20])
        assert "AAPL" in result
        assert "1d" in result["AAPL"]


# ═══════════════════════════════════════════════════════════════════════════════
# WatchlistAnalytics
# ═══════════════════════════════════════════════════════════════════════════════

class TestWatchlistAnalytics:
    def _items(self):
        return [
            _make_item("AAPL", sector="Tech", last=105, prev_close=100, volume=1_000_000),
            _make_item("MSFT", sector="Tech", last=95, prev_close=100, volume=800_000),
            _make_item("XOM", sector="Energy", last=110, prev_close=100, volume=1_200_000),
        ]

    def test_sector_breakdown(self):
        items = self._items()
        breakdown = WatchlistAnalytics.sector_breakdown(items)
        assert abs(breakdown["Tech"] - 200 / 3) < 1e-6
        assert abs(breakdown["Energy"] - 100 / 3) < 1e-6

    def test_gainers_losers(self):
        items = self._items()
        gl = WatchlistAnalytics.gainers_losers(items, top_n=2)
        assert len(gl["gainers"]) == 2
        assert gl["gainers"][0]["change_pct"] > gl["gainers"][1]["change_pct"]

    def test_market_breadth(self):
        items = self._items()
        mb = WatchlistAnalytics.market_breadth(items)
        assert mb["advancing"] == 2  # AAPL(+5%), XOM(+10%)
        assert mb["declining"] == 1  # MSFT(-5%)
        assert mb["total"] == 3

    def test_correlation_matrix(self):
        history = {
            "AAPL": np.cumsum(np.random.randn(100)) + 100,
            "MSFT": np.cumsum(np.random.randn(100)) + 100,
        }
        result = WatchlistAnalytics.correlation_matrix(history)
        assert len(result["symbols"]) == 2
        assert len(result["matrix"]) == 2
        # Diagonal should be 1.0
        assert abs(result["matrix"][0][0] - 1.0) < 1e-6
        assert abs(result["matrix"][1][1] - 1.0) < 1e-6

    def test_correlation_matrix_single(self):
        result = WatchlistAnalytics.correlation_matrix({"AAPL": np.array([1, 2, 3])})
        assert result["matrix"] == []

    def test_summary_stats(self):
        items = self._items()
        stats = WatchlistAnalytics.summary_stats(items)
        assert stats["total_symbols"] == 3
        assert stats["with_quotes"] == 3
        assert stats["positive_count"] == 2
        assert stats["negative_count"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# WatchlistEngine — Orchestrator
# ═══════════════════════════════════════════════════════════════════════════════

class TestWatchlistEngine:
    def setup_method(self):
        self.engine = WatchlistEngine()

    def test_create_and_get(self):
        wl_id = self.engine.create_watchlist("My WL")
        wl = self.engine.get_watchlist(wl_id)
        assert wl is not None
        assert wl.name == "My WL"

    def test_delete(self):
        wl_id = self.engine.create_watchlist("Del")
        assert self.engine.delete_watchlist(wl_id) is True
        assert self.engine.get_watchlist(wl_id) is None

    def test_list_watchlists(self):
        self.engine.create_watchlist("A")
        self.engine.create_watchlist("B")
        wls = self.engine.list_watchlists()
        assert len(wls) == 2

    def test_rename(self):
        wl_id = self.engine.create_watchlist("Old")
        assert self.engine.rename_watchlist(wl_id, "New") is True
        assert self.engine.get_watchlist(wl_id).name == "New"

    def test_add_remove_symbol(self):
        wl_id = self.engine.create_watchlist("Test")
        assert self.engine.add_symbol(wl_id, "AAPL") is True
        assert self.engine.add_symbol(wl_id, "TSLA") is True
        assert self.engine.remove_symbol(wl_id, "AAPL") is True
        wl = self.engine.get_watchlist(wl_id)
        assert wl.count == 1

    def test_move_symbol(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "A")
        self.engine.add_symbol(wl_id, "B")
        self.engine.add_symbol(wl_id, "C")
        assert self.engine.move_symbol(wl_id, "C", 0) is True
        wl = self.engine.get_watchlist(wl_id)
        assert wl.order[0] == "C"

    def test_update_quote(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "AAPL")
        self.engine.update_quote("AAPL", {"last": 155.0, "prev_close": 150.0})
        wl = self.engine.get_watchlist(wl_id)
        assert wl.get_item("AAPL").quote.last == 155.0

    def test_bulk_update(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "A")
        self.engine.add_symbol(wl_id, "B")
        updated = self.engine.bulk_update_quotes({
            "A": {"last": 10}, "B": {"last": 20}, "C": {"last": 30},
        })
        assert updated == 3  # all 3 go to QuoteManager

    def test_sort_watchlist(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "A")
        self.engine.add_symbol(wl_id, "B")
        self.engine.update_quote("A", {"last": 200})
        self.engine.update_quote("B", {"last": 100})
        sorted_items = self.engine.sort_watchlist(wl_id, [("last", SortDirection.ASC)])
        assert sorted_items[0].symbol == "B"

    def test_filter_watchlist(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "A")
        self.engine.add_symbol(wl_id, "B")
        self.engine.update_quote("A", {"last": 200})
        self.engine.update_quote("B", {"last": 50})
        result = self.engine.filter_watchlist(wl_id, [
            {"field": "last", "operator": ">", "value": 100}
        ])
        assert len(result) == 1
        assert result[0].symbol == "A"

    def test_search_watchlist(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "AAPL", sector="Tech")
        self.engine.add_symbol(wl_id, "XOM", sector="Energy")
        result = self.engine.search_watchlist(wl_id, "tech")
        assert len(result) == 1

    def test_sector_breakdown(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "A", sector="Tech")
        self.engine.add_symbol(wl_id, "B", sector="Tech")
        self.engine.add_symbol(wl_id, "C", sector="Energy")
        breakdown = self.engine.sector_breakdown(wl_id)
        assert abs(breakdown["Tech"] - 200 / 3) < 1e-6

    def test_market_breadth(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "A")
        self.engine.add_symbol(wl_id, "B")
        self.engine.update_quote("A", {"last": 105, "prev_close": 100})
        self.engine.update_quote("B", {"last": 95, "prev_close": 100})
        mb = self.engine.market_breadth(wl_id)
        assert mb["advancing"] == 1
        assert mb["declining"] == 1

    def test_export_import(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "AAPL")
        self.engine.add_symbol(wl_id, "TSLA")
        exported = self.engine.export_symbols(wl_id)
        assert len(exported) == 2

        wl_id2 = self.engine.create_watchlist("Test2")
        imported = self.engine.import_symbols(wl_id2, exported)
        assert imported == 2

    def test_groups(self):
        assert self.engine.create_group("Tech") is True
        wl_id = self.engine.create_watchlist("TechWL")
        assert self.engine.add_to_group("Tech", wl_id) is True
        groups = self.engine.list_groups()
        assert groups["Tech"] == 1

    def test_capabilities(self):
        wl_id = self.engine.create_watchlist("Test")
        self.engine.add_symbol(wl_id, "AAPL")
        caps = self.engine.capabilities()
        assert caps["total_watchlists"] == 1
        assert caps["total_symbols"] == 1
        assert len(caps["features"]) >= 10

    def test_nonexistent_watchlist_operations(self):
        assert self.engine.add_symbol("nope", "A") is False
        assert self.engine.remove_symbol("nope", "A") is False
        assert self.engine.move_symbol("nope", "A", 0) is False
        assert self.engine.sort_watchlist("nope", []) == []
        assert self.engine.filter_watchlist("nope", []) == []
        assert self.engine.search_watchlist("nope", "x") == []
        assert self.engine.sector_breakdown("nope") == {}
        assert self.engine.export_symbols("nope") == []
        assert self.engine.rename_watchlist("nope", "x") is False
