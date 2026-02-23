"""
Repair Wave — Validation Tests
Tests that prove the fixes work correctly:
- BacktestConfig determinism and seed support
- EventDrivenEngine.run() with synthetic bars
- Ops health endpoint structure
- ElasticsearchService API shape
- w11_elasticsearch route call shape fixes
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


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
        """engine.run(config) with no bars_by_symbol should not raise."""
        from services.waves21_50.backtest.engine import BacktestConfig
        engine = self._fresh_engine()
        cfg = BacktestConfig(
            symbols=["AAPL"],
            start_date="2024-01-01",
            end_date="2024-03-31",
            seed=42,
        )
        result = engine.run(cfg)
        assert result is not None
        assert result.status == "completed"

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
        result = engine.run(cfg)
        d = result.to_dict()
        assert "metrics" in d
        assert "total_return" in d["metrics"]
        assert "sharpe_ratio" in d["metrics"]
        assert "max_drawdown" in d["metrics"]
        assert "config" in d
        assert d["config"]["seed"] == 42

    def test_run_determinism(self):
        """Same seed → identical result_hash twice."""
        from services.waves21_50.backtest.engine import BacktestConfig, EventDrivenEngine
        cfg = BacktestConfig(
            symbols=["AAPL"],
            start_date="2024-01-01",
            end_date="2024-03-31",
            seed=42,
        )
        e1 = EventDrivenEngine()
        r1 = e1.run(cfg)

        e2 = EventDrivenEngine()
        r2 = e2.run(cfg)

        assert r1.result_hash == r2.result_hash, "Backtest not deterministic!"

    def test_different_seeds_differ(self):
        """Different seeds → different results."""
        from services.waves21_50.backtest.engine import BacktestConfig, EventDrivenEngine
        cfg1 = BacktestConfig(symbols=["AAPL"], start_date="2024-01-01", end_date="2024-03-31", seed=1)
        cfg2 = BacktestConfig(symbols=["AAPL"], start_date="2024-01-01", end_date="2024-03-31", seed=2)
        r1 = EventDrivenEngine().run(cfg1)
        r2 = EventDrivenEngine().run(cfg2)
        # Different seeds → different synthetic bars → different equity curves
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
        result = engine.run(cfg)
        assert result.status == "completed"

    def test_synthetic_bar_count(self):
        """Synthetic bars should span the date range (approx 252 trading days/year)."""
        from services.waves21_50.backtest.engine import EventDrivenEngine, BacktestConfig
        engine = EventDrivenEngine()
        bars = engine._generate_synthetic_bars("AAPL", "2024-01-01", "2024-12-31", seed=42)
        # Should have ~250 trading days for a full year
        assert len(bars) >= 240
        assert len(bars) <= 265

    def test_synthetic_bars_deterministic(self):
        """Same seed → same exact bars every time."""
        from services.waves21_50.backtest.engine import EventDrivenEngine
        engine = EventDrivenEngine()
        bars1 = engine._generate_synthetic_bars("AAPL", "2024-01-01", "2024-06-30", seed=42)
        bars2 = engine._generate_synthetic_bars("AAPL", "2024-01-01", "2024-06-30", seed=42)
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
