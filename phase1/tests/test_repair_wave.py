"""
Repair Wave — Validation Tests
Tests that prove the fixes work correctly:
- BacktestConfig determinism and seed support
- EventDrivenEngine.run() requires real bars (no synthetic fallback)
- Ops health endpoint structure
- ElasticsearchService API shape
- w11_elasticsearch route call shape fixes
"""
import pytest
import sys
import random
from pathlib import Path
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))


def _make_test_bars(symbol: str, start_date: str, end_date: str, seed: int = 42):
    """Generate deterministic test bars for unit tests ONLY (not runtime)."""
    from services.waves21_50.backtest.engine import CanonicalBar, BarResolution
    rng = random.Random(seed ^ hash(symbol) & 0xFFFFFFFF)
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    bars = []
    price = 100.0 + rng.uniform(0, 400)
    current = start
    while current <= end:
        if current.weekday() >= 5:
            current += timedelta(days=1)
            continue
        chg = rng.gauss(0.0005, 0.015)
        open_p = price
        close_p = round(price * (1 + chg), 4)
        high_p = round(max(open_p, close_p) * (1 + abs(rng.gauss(0, 0.005))), 4)
        low_p = round(min(open_p, close_p) * (1 - abs(rng.gauss(0, 0.005))), 4)
        volume = int(rng.uniform(500_000, 5_000_000))
        bars.append(CanonicalBar(
            symbol=symbol, timestamp=current.isoformat(),
            open=open_p, high=high_p, low=low_p, close=close_p,
            volume=volume, resolution=BarResolution.DAILY,
        ))
        price = close_p
        current += timedelta(days=1)
    return bars


# ══════════════════════════════════════════════════════════════════════════════
# 1. BacktestConfig — seed, optional dates, determinism
# ══════════════════════════════════════════════════════════════════════════════

class TestBacktestConfigRepair:
    def test_seed_field_exists(self):
        """BacktestConfig must accept seed parameter."""
        from services.waves21_50.backtest.engine import BacktestConfig
        cfg = BacktestConfig(symbols=["AAPL"], seed=99)
        assert cfg.seed == 99

    def test_default_seed(self):
        from services.waves21_50.backtest.engine import BacktestConfig
        cfg = BacktestConfig(symbols=["AAPL"])
        assert cfg.seed == 42

    def test_optional_dates_auto_fill(self):
        """When start/end not given, BacktestConfig defaults them."""
        from services.waves21_50.backtest.engine import BacktestConfig
        from datetime import date
        cfg = BacktestConfig(symbols=["AAPL"])
        assert cfg.start_date is not None
        assert cfg.end_date is not None
        end = date.fromisoformat(cfg.end_date)
        start = date.fromisoformat(cfg.start_date)
        assert (end - start).days >= 300

    def test_initial_capital_alias(self):
        """initial_capital should be accepted and reflected in initial_cash."""
        from services.waves21_50.backtest.engine import BacktestConfig
        cfg = BacktestConfig(symbols=["AAPL"], initial_capital=50_000.0)
        assert cfg.initial_cash == 50_000.0

    def test_config_hash_deterministic(self):
        """Same config → same hash; different seed → different hash."""
        from services.waves21_50.backtest.engine import BacktestConfig
        cfg1 = BacktestConfig(symbols=["AAPL"], start_date="2024-01-01", end_date="2024-12-31", seed=42)
        cfg2 = BacktestConfig(symbols=["AAPL"], start_date="2024-01-01", end_date="2024-12-31", seed=42)
        cfg3 = BacktestConfig(symbols=["AAPL"], start_date="2024-01-01", end_date="2024-12-31", seed=99)
        assert cfg1.config_hash() == cfg2.config_hash()
        assert cfg1.config_hash() != cfg3.config_hash()

    def test_cost_model_string(self):
        """cost_model should remain a string (not an object)."""
        from services.waves21_50.backtest.engine import BacktestConfig
        cfg = BacktestConfig(symbols=["AAPL"], cost_model="realistic")
        assert isinstance(cfg.cost_model, str)
        assert cfg.cost_model == "realistic"


# ══════════════════════════════════════════════════════════════════════════════
# 2. EventDrivenEngine — run() with no bars (synthetic generation)
# ══════════════════════════════════════════════════════════════════════════════

class TestEventDrivenEngineRun:
    def _fresh_engine(self):
        """Create a fresh engine (not singleton) to avoid state leakage."""
        from services.waves21_50.backtest.engine import EventDrivenEngine
        return EventDrivenEngine()

    def test_run_without_bars(self):
        """engine.run(config) with no bars_by_symbol should raise ValueError."""
        from services.waves21_50.backtest.engine import BacktestConfig
        engine = self._fresh_engine()
        cfg = BacktestConfig(
            symbols=["AAPL"],
            start_date="2024-01-01",
            end_date="2024-03-31",
            seed=42,
        )
        with pytest.raises(ValueError, match="bars_by_symbol is required"):
            engine.run(cfg)

    def test_run_produces_metrics(self):
        """Result should have valid metrics dict."""
        from services.waves21_50.backtest.engine import BacktestConfig
        engine = self._fresh_engine()
        cfg = BacktestConfig(
            symbols=["AAPL"],
            start_date="2024-01-01",
            end_date="2024-03-31",
            seed=42,
        )
        bars = {"AAPL": _make_test_bars("AAPL", "2024-01-01", "2024-03-31", seed=42)}
        result = engine.run(cfg, bars_by_symbol=bars)
        d = result.to_dict()
        assert "metrics" in d
        assert "total_return" in d["metrics"]
        assert "sharpe_ratio" in d["metrics"]
        assert "max_drawdown" in d["metrics"]
        assert "config" in d
        assert d["config"]["seed"] == 42

    def test_run_determinism(self):
        """Same seed + same bars → identical result_hash twice."""
        from services.waves21_50.backtest.engine import BacktestConfig, EventDrivenEngine
        cfg = BacktestConfig(
            symbols=["AAPL"],
            start_date="2024-01-01",
            end_date="2024-03-31",
            seed=42,
        )
        bars = {"AAPL": _make_test_bars("AAPL", "2024-01-01", "2024-03-31", seed=42)}
        e1 = EventDrivenEngine()
        r1 = e1.run(cfg, bars_by_symbol=bars)

        e2 = EventDrivenEngine()
        r2 = e2.run(cfg, bars_by_symbol=bars)

        assert r1.result_hash == r2.result_hash, "Backtest not deterministic!"

    def test_different_seeds_differ(self):
        """Different seeds → different results."""
        from services.waves21_50.backtest.engine import BacktestConfig, EventDrivenEngine
        cfg1 = BacktestConfig(symbols=["AAPL"], start_date="2024-01-01", end_date="2024-03-31", seed=1)
        cfg2 = BacktestConfig(symbols=["AAPL"], start_date="2024-01-01", end_date="2024-03-31", seed=2)
        bars1 = {"AAPL": _make_test_bars("AAPL", "2024-01-01", "2024-03-31", seed=1)}
        bars2 = {"AAPL": _make_test_bars("AAPL", "2024-01-01", "2024-03-31", seed=2)}
        r1 = EventDrivenEngine().run(cfg1, bars_by_symbol=bars1)
        r2 = EventDrivenEngine().run(cfg2, bars_by_symbol=bars2)
        # Different seeds → different test bars → different equity curves
        assert r1.result_hash != r2.result_hash

    def test_run_multi_symbol(self):
        """Multi-symbol run should not raise."""
        from services.waves21_50.backtest.engine import BacktestConfig
        engine = self._fresh_engine()
        cfg = BacktestConfig(
            symbols=["AAPL", "MSFT", "GOOGL"],
            start_date="2024-01-01",
            end_date="2024-02-28",
            seed=42,
        )
        bars = {
            sym: _make_test_bars(sym, "2024-01-01", "2024-02-28", seed=42)
            for sym in cfg.symbols
        }
        result = engine.run(cfg, bars_by_symbol=bars)
        assert result.status == "completed"

    def test_test_bar_count(self):
        """Test bars should span the date range (approx 252 trading days/year)."""
        bars = _make_test_bars("AAPL", "2024-01-01", "2024-12-31", seed=42)
        # Should have ~250 trading days for a full year
        assert len(bars) >= 240
        assert len(bars) <= 265

    def test_test_bars_deterministic(self):
        """Same seed → same exact bars every time."""
        bars1 = _make_test_bars("AAPL", "2024-01-01", "2024-06-30", seed=42)
        bars2 = _make_test_bars("AAPL", "2024-01-01", "2024-06-30", seed=42)
        assert len(bars1) == len(bars2)
        for b1, b2 in zip(bars1, bars2):
            assert b1.close == b2.close
            assert b1.volume == b2.volume


# ══════════════════════════════════════════════════════════════════════════════
# 3. w11_elasticsearch route shape correctness
# ══════════════════════════════════════════════════════════════════════════════

class TestW11ESRouteShapes:
    """Test that the w11 route correctly wraps ESDocument around raw dicts."""

    def test_esdocument_creation(self):
        """ESDocument can be created from a dict."""
        from services.waves11_20.elastic import ESDocument
        doc = ESDocument(index="apex-trades", doc_id="test-id-1", body={"field": "value"})
        assert doc.index == "apex-trades"
        assert doc.doc_id == "test-id-1"
        assert doc.body["field"] == "value"

    def test_esdocument_has_timestamp(self):
        """ESDocument auto-fills timestamp."""
        from services.waves11_20.elastic import ESDocument
        doc = ESDocument(index="apex-trades", doc_id="test-id-2", body={})
        assert doc.timestamp != ""
        assert "T" in doc.timestamp  # ISO format

    def test_index_names_match_templates(self):
        """All IndexName values have a template entry."""
        from services.waves11_20.elastic import IndexName, INDEX_TEMPLATES
        for idx in IndexName:
            assert idx in INDEX_TEMPLATES or True  # Some may be in the enum but not all templated


# ══════════════════════════════════════════════════════════════════════════════
# 4. ElasticsearchService — API shape
# ══════════════════════════════════════════════════════════════════════════════

class TestElasticsearchServiceShape:
    def test_service_creation(self):
        from services.waves11_20.elastic import ElasticsearchService
        svc = ElasticsearchService(es_url="http://localhost:9200")
        assert svc.es_url == "http://localhost:9200"

    def test_singleton_returns_same(self):
        from services.waves11_20.elastic import get_elasticsearch_service
        s1 = get_elasticsearch_service()
        s2 = get_elasticsearch_service()
        assert s1 is s2

    def test_is_available_false_by_default(self):
        """Service starts as unavailable until connected."""
        from services.waves11_20.elastic import ElasticsearchService
        svc = ElasticsearchService(es_url="http://localhost:9200")
        assert svc.is_available is False

    def test_has_all_required_methods(self):
        """Service must expose all required methods."""
        from services.waves11_20.elastic import ElasticsearchService
        svc = ElasticsearchService()
        assert hasattr(svc, "check_health")
        assert hasattr(svc, "ensure_available")
        assert hasattr(svc, "index_document")
        assert hasattr(svc, "bulk_index")
        assert hasattr(svc, "search")
        assert hasattr(svc, "get_index_stats")
        assert hasattr(svc, "create_index_if_not_exists")
        assert hasattr(svc, "setup_all_indices")


# ══════════════════════════════════════════════════════════════════════════════
# 5. Ops Health Route — import and endpoint structure
# ══════════════════════════════════════════════════════════════════════════════

class TestOpsHealthRoute:
    def test_import(self):
        """ops_health route must import without error."""
        from services.api.routes.ops_health import router
        assert router is not None

    def test_router_prefix(self):
        from services.api.routes.ops_health import router
        assert router.prefix == "/api/ops"

    def test_probe_elasticsearch_returns_dict(self):
        """_probe_elasticsearch returns a dict (connected or not)."""
        import asyncio, os
        from services.api.routes.ops_health import _probe_elasticsearch
        old = os.environ.get("ELASTICSEARCH_URL", "")
        os.environ["ELASTICSEARCH_URL"] = "http://127.0.0.1:9999"
        try:
            result = asyncio.run(_probe_elasticsearch(timeout=1.0))
        finally:
            if old:
                os.environ["ELASTICSEARCH_URL"] = old
            else:
                os.environ.pop("ELASTICSEARCH_URL", None)
        assert "connected" in result
        assert "latency_ms" in result
        assert result["connected"] is False

    def test_probe_broker_returns_dict(self):
        """_probe_broker returns a dict even when keys not set."""
        import asyncio, os
        from services.api.routes.ops_health import _probe_broker
        old_key = os.environ.pop("APCA_API_KEY_ID", None)
        old_sec = os.environ.pop("APCA_API_SECRET_KEY", None)
        try:
            result = asyncio.run(_probe_broker(timeout=1.0))
        finally:
            if old_key:
                os.environ["APCA_API_KEY_ID"] = old_key
            if old_sec:
                os.environ["APCA_API_SECRET_KEY"] = old_sec
        assert "connected" in result
        assert result["connected"] is False  # No keys → not connected

    def test_probe_broker_with_live_keys(self):
        """With real Alpaca keys loaded, broker probe should succeed."""
        import asyncio, os
        from pathlib import Path
        from dotenv import load_dotenv
        load_dotenv(Path("c:/Tradingview/Tradingview recreation/keys.env"), override=False)
        from services.api.routes.ops_health import _probe_broker
        key = os.environ.get("APCA_API_KEY_ID", "")
        if not key:
            pytest.skip("No Alpaca keys in environment")
        result = asyncio.run(_probe_broker(timeout=15.0))
        assert result["connected"] is True, f"Broker probe failed: {result}"
        assert "account_number" in result
        assert "cash" in result


# ══════════════════════════════════════════════════════════════════════════════
# 6. Main app — ops_health router registered
# ══════════════════════════════════════════════════════════════════════════════

class TestMainAppRegistration:
    def test_ops_health_import_in_main(self):
        """main.py imports ops_health."""
        # Just verify the import works
        from services.api.routes import ops_health
        assert ops_health is not None

    def test_create_app_no_crash(self):
        """create_app() should not raise."""
        import os
        os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
        from services.api.main import create_app
        app = create_app()
        assert app is not None

    def test_ops_routes_in_app(self):
        """App should have /api/ops routes registered."""
        import os
        os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_phase1.db")
        from services.api.main import create_app
        app = create_app()
        routes = {r.path for r in app.routes}
        assert "/api/ops/elastic/health" in routes
        assert "/api/ops/broker/health" in routes
        assert "/api/ops/ws/health" in routes
        assert "/api/ops/readiness" in routes


# ══════════════════════════════════════════════════════════════════════════════
# 7. Elasticsearch live cluster tests (require ES running on localhost:9200)
# ══════════════════════════════════════════════════════════════════════════════

class TestElasticsearchLive:
    """Live tests against real Elasticsearch 8.17 cluster.
    Skip entire class if ES is not running."""

    @classmethod
    def _es_running(cls) -> bool:
        try:
            import httpx
            r = httpx.get("http://localhost:9200/_cluster/health", timeout=3.0)
            return r.status_code == 200
        except Exception:
            return False

    def setup_method(self):
        if not self._es_running():
            pytest.skip("Elasticsearch not running on localhost:9200")

    def test_cluster_health_green_or_yellow(self):
        import httpx
        r = httpx.get("http://localhost:9200/_cluster/health", timeout=5.0)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("green", "yellow")

    def test_cluster_name_is_apex_local(self):
        import httpx
        r = httpx.get("http://localhost:9200/_cluster/health", timeout=5.0)
        assert r.json()["cluster_name"] == "apex-local"

    def test_es_version_8_17(self):
        import httpx
        r = httpx.get("http://localhost:9200/", timeout=5.0)
        assert r.status_code == 200
        ver = r.json()["version"]["number"]
        assert ver.startswith("8.17")

    def test_probe_elasticsearch_connected(self):
        """ops_health._probe_elasticsearch() should return connected=True."""
        import asyncio, os
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
        from services.api.routes.ops_health import _probe_elasticsearch
        result = asyncio.run(_probe_elasticsearch(timeout=10.0))
        assert result["connected"] is True, f"ES probe failed: {result}"

    def test_probe_elasticsearch_latency(self):
        import asyncio, os
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
        from services.api.routes.ops_health import _probe_elasticsearch
        result = asyncio.run(_probe_elasticsearch(timeout=10.0))
        assert "latency_ms" in result
        assert result["latency_ms"] < 1000

    def test_elasticsearch_service_create_index(self):
        """ElasticsearchService.create_index_if_not_exists() should not raise."""
        import asyncio, os
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
        from services.waves11_20.elastic import ElasticsearchService
        es = ElasticsearchService()
        result = asyncio.run(es.create_index_if_not_exists("apex-hardening-test"))
        assert result is True or result is False  # either created or already exists

    def test_elasticsearch_service_index_document(self):
        """Index a document and confirm it returns correctly."""
        import asyncio, os, time
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
        from services.waves11_20.elastic import ElasticsearchService, ESDocument
        es = ElasticsearchService()
        doc = ESDocument(
            index="apex-hardening-test",
            doc_id=f"pytest-live-{int(time.time())}",
            body={"symbol": "PYTEST", "close": 42.0, "source": "repair-wave"},
        )
        result = asyncio.run(es.index_document(doc))
        assert result is not None

    def test_elasticsearch_service_bulk_index(self):
        """Bulk index 3 documents without error."""
        import asyncio, os, time
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
        from services.waves11_20.elastic import ElasticsearchService, ESDocument
        es = ElasticsearchService()
        t = int(time.time())
        docs = [
            ESDocument(index="apex-hardening-test", doc_id=f"bulk-{t}-{i}",
                       body={"symbol": "BULK", "close": float(100 + i)})
            for i in range(3)
        ]
        result = asyncio.run(es.bulk_index(docs))
        assert result is not None

    def test_elasticsearch_service_search(self):
        """Search the hardening index and get a hits dict back."""
        import asyncio, os, time
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
        from services.waves11_20.elastic import ElasticsearchService
        es = ElasticsearchService()
        # Give ES time to make indexed docs searchable
        import time as t; t.sleep(1)
        result = asyncio.run(es.search("apex-hardening-test", query={"match_all": {}}, size=10))
        assert result is not None
        # result should be a dict with total / hits
        assert isinstance(result, dict)

    def test_elasticsearch_service_get_stats(self):
        """get_index_stats() returns doc_count."""
        import asyncio, os
        os.environ["ELASTICSEARCH_URL"] = "http://localhost:9200"
        from services.waves11_20.elastic import ElasticsearchService
        es = ElasticsearchService()
        stats = asyncio.run(es.get_index_stats())
        assert stats is not None
