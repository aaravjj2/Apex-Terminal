"""
Waves 11-20 — Online-Only Swing Equities v1 — Unit Tests
Tests all 10 backend service modules without network access.
"""
import pytest
import sys
from pathlib import Path
from datetime import datetime, date, timezone
from unittest.mock import patch, MagicMock

# Ensure services importable
sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Wave 11: Market Session ──

class TestMarketSession:
    def test_import(self):
        from services.waves11_20.market_session import MarketSessionEngine, SessionType, SessionState
        assert MarketSessionEngine is not None

    def test_singleton(self):
        from services.waves11_20.market_session import get_market_session_engine
        e1 = get_market_session_engine()
        e2 = get_market_session_engine()
        assert e1 is e2

    def test_session_types_enum(self):
        from services.waves11_20.market_session import SessionType
        assert SessionType.PRE_MARKET.value == "pre_market"
        assert SessionType.MARKET_OPEN.value == "market_open"
        assert SessionType.AFTER_HOURS.value == "after_hours"
        assert SessionType.CLOSED.value == "closed"
        assert SessionType.WEEKEND.value == "weekend"
        assert SessionType.HOLIDAY.value == "holiday"

    def test_classify_session(self):
        from services.waves11_20.market_session import get_market_session_engine, SessionType
        engine = get_market_session_engine()
        session_type = engine.classify_session()
        assert isinstance(session_type, SessionType)

    def test_get_state(self):
        from services.waves11_20.market_session import get_market_session_engine
        engine = get_market_session_engine()
        state = engine.get_state()
        assert state is not None
        assert hasattr(state, 'session')
        assert hasattr(state, 'is_trading_allowed')
        assert hasattr(state, 'next_open')
        assert hasattr(state, 'next_close')
        assert hasattr(state, 'description')

    def test_is_trading_day(self):
        from services.waves11_20.market_session import get_market_session_engine
        engine = get_market_session_engine()
        result = engine.is_trading_day()
        assert isinstance(result, bool)

    def test_is_holiday(self):
        from services.waves11_20.market_session import get_market_session_engine
        engine = get_market_session_engine()
        result = engine.is_holiday()
        assert isinstance(result, bool)

    def test_get_next_open(self):
        from services.waves11_20.market_session import get_market_session_engine
        engine = get_market_session_engine()
        nxt = engine.get_next_open()
        assert isinstance(nxt, datetime)

    def test_to_dict(self):
        from services.waves11_20.market_session import get_market_session_engine
        engine = get_market_session_engine()
        state = engine.get_state()
        d = state.to_dict()
        assert isinstance(d, dict)


# ── Wave 11: Elasticsearch Service ──

class TestElasticsearchService:
    def test_import(self):
        from services.waves11_20.elastic import ElasticsearchService, IndexName
        assert ElasticsearchService is not None

    def test_singleton(self):
        from services.waves11_20.elastic import get_elasticsearch_service
        s1 = get_elasticsearch_service()
        s2 = get_elasticsearch_service()
        assert s1 is s2

    def test_index_names(self):
        from services.waves11_20.elastic import IndexName
        assert IndexName.AUTOPILOT_RUNS.value == "apex-autopilot-runs"
        names = [n.value for n in IndexName]
        assert len(names) >= 17

    def test_index_templates_exist(self):
        from services.waves11_20.elastic import INDEX_TEMPLATES
        assert isinstance(INDEX_TEMPLATES, dict)
        assert len(INDEX_TEMPLATES) >= 17


# ── Wave 11: Data Spine ──

class TestDataSpine:
    def test_import(self):
        from services.waves11_20.data_spine import DataSpineService
        assert DataSpineService is not None

    def test_singleton(self):
        from services.waves11_20.data_spine import get_data_spine
        s1 = get_data_spine()
        s2 = get_data_spine()
        assert s1 is s2

    def test_default_universe(self):
        from services.waves11_20.data_spine import get_data_spine
        spine = get_data_spine()
        u = spine.get_universe()
        assert isinstance(u, list)
        assert len(u) == 10
        assert 'AAPL' in u
        assert 'MSFT' in u
        assert 'NVDA' in u


# ── Wave 11: Paper Broker ──

class TestPaperBroker:
    def test_import(self):
        from services.waves11_20.broker import PaperBrokerService, LiveTradingRefusedError, KillSwitchActiveError
        assert PaperBrokerService is not None

    def test_singleton(self):
        from services.waves11_20.broker import get_paper_broker
        b1 = get_paper_broker()
        b2 = get_paper_broker()
        assert b1 is b2

    def test_ensure_paper_only(self):
        from services.waves11_20.broker import get_paper_broker, LiveTradingRefusedError
        broker = get_paper_broker()
        # Should not raise for paper
        broker.ensure_paper_only()

    def test_kill_switch_activate_deactivate(self):
        from services.waves11_20.broker import get_paper_broker
        broker = get_paper_broker()
        broker.activate_kill_switch("test")
        assert broker.is_kill_switch_active()
        broker.deactivate_kill_switch()
        assert not broker.is_kill_switch_active()

    def test_readiness_check(self):
        from services.waves11_20.broker import get_paper_broker
        broker = get_paper_broker()
        broker.deactivate_kill_switch()  # ensure off
        r = broker.get_trading_readiness()
        assert isinstance(r, dict)
        assert 'broker_mode' in r
        assert 'kill_switch_active' in r


# ── Wave 12: Portfolio Allocator ──

class TestPortfolioAllocator:
    def test_import(self):
        from services.waves11_20.portfolio import PortfolioAllocator
        assert PortfolioAllocator is not None

    def test_singleton(self):
        from services.waves11_20.portfolio import get_portfolio_allocator
        p1 = get_portfolio_allocator()
        p2 = get_portfolio_allocator()
        assert p1 is p2

    def test_equal_weight(self):
        from services.waves11_20.portfolio import get_portfolio_allocator
        alloc = get_portfolio_allocator()
        prices = {'AAPL': 200.0, 'MSFT': 400.0, 'GOOGL': 170.0}
        result = alloc.allocate_equal_weight(['AAPL', 'MSFT', 'GOOGL'], 100000, prices)
        assert isinstance(result, list)
        assert len(result) == 3

    def test_sector_classification(self):
        from services.waves11_20.portfolio import SYMBOL_SECTORS
        sector = SYMBOL_SECTORS.get('AAPL', '')
        assert isinstance(sector, str)
        assert len(sector) > 0


# ── Wave 13: Performance Ledger ──

class TestPerformanceLedger:
    def test_import(self):
        from services.waves11_20.performance import PerformanceLedger
        assert PerformanceLedger is not None

    def test_singleton(self):
        from services.waves11_20.performance import get_performance_ledger
        l1 = get_performance_ledger()
        l2 = get_performance_ledger()
        assert l1 is l2

    def test_record_trade(self):
        from services.waves11_20.performance import get_performance_ledger, TradeRecord
        import uuid
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        ledger = get_performance_ledger()
        trade = TradeRecord(
            trade_id=str(uuid.uuid4()),
            strategy_id='test_strat',
            symbol='AAPL',
            side='buy',
            entry_price=150.0,
            exit_price=155.0,
            qty=10,
            pnl=50.0,
            entry_time=now,
            exit_time=now,
            is_winner=True,
        )
        ledger.record_trade(trade)
        metrics = ledger.compute_metrics('test_strat')
        assert metrics is not None
        assert metrics.total_trades >= 1


# ── Wave 14: Backtester v3 ──

class TestBacktesterV3:
    def test_import(self):
        from services.waves11_20.backtester import BacktesterV3, ExecutionModel
        assert BacktesterV3 is not None

    def test_singleton(self):
        from services.waves11_20.backtester import get_backtester_v3
        b1 = get_backtester_v3()
        b2 = get_backtester_v3()
        assert b1 is b2

    def test_execution_model_defaults(self):
        from services.waves11_20.backtester import ExecutionModel
        em = ExecutionModel()
        assert em.commission_per_share >= 0
        assert em.slippage_bps >= 0


# ── Wave 15: Strategy Discovery ──

class TestDiscovery:
    def test_import(self):
        from services.waves11_20.discovery import StrategyDiscoveryEngine, StrategyTemplate
        assert StrategyDiscoveryEngine is not None

    def test_singleton(self):
        from services.waves11_20.discovery import get_discovery_engine
        d1 = get_discovery_engine()
        d2 = get_discovery_engine()
        assert d1 is d2

    def test_templates(self):
        from services.waves11_20.discovery import StrategyTemplate
        templates = list(StrategyTemplate)
        assert len(templates) == 5

    def test_generate_candidates(self):
        from services.waves11_20.discovery import get_discovery_engine, StrategyTemplate
        engine = get_discovery_engine()
        candidates = engine.generate_candidates(StrategyTemplate.SMA_CROSSOVER, max_candidates=5)
        assert isinstance(candidates, list)
        assert len(candidates) <= 5


# ── Wave 16: AI Strategy Builder ──

class TestAIStrategyBuilder:
    def test_import(self):
        from services.waves11_20.ai_strategy import AIStrategyBuilder
        assert AIStrategyBuilder is not None

    def test_singleton(self):
        from services.waves11_20.ai_strategy import get_ai_strategy_builder
        b1 = get_ai_strategy_builder()
        b2 = get_ai_strategy_builder()
        assert b1 is b2

    def test_guardrail_rules_exist(self):
        from services.waves11_20.ai_strategy import GUARDRAIL_RULES
        assert isinstance(GUARDRAIL_RULES, (list, dict))
        assert len(GUARDRAIL_RULES) > 0


# ── Wave 17: Sentiment Pipeline ──

class TestSentimentPipeline:
    def test_import(self):
        from services.waves11_20.sentiment import SentimentPipeline
        assert SentimentPipeline is not None

    def test_singleton(self):
        from services.waves11_20.sentiment import get_sentiment_pipeline
        p1 = get_sentiment_pipeline()
        p2 = get_sentiment_pipeline()
        assert p1 is p2


# ── Wave 18: Workflow Engine ──

class TestWorkflowEngine:
    def test_import(self):
        from services.waves11_20.workflows import WorkflowEngine
        assert WorkflowEngine is not None

    def test_singleton(self):
        from services.waves11_20.workflows import get_workflow_engine
        w1 = get_workflow_engine()
        w2 = get_workflow_engine()
        assert w1 is w2

    def test_builtin_templates(self):
        from services.waves11_20.workflows import get_workflow_engine
        engine = get_workflow_engine()
        templates = engine.get_templates()
        assert isinstance(templates, dict)
        assert len(templates) >= 3


# ── Wave 19: Observability Service ──

class TestObservabilityService:
    def test_import(self):
        from services.waves11_20.observability import ObservabilityService
        assert ObservabilityService is not None

    def test_singleton(self):
        from services.waves11_20.observability import get_observability_service
        o1 = get_observability_service()
        o2 = get_observability_service()
        assert o1 is o2

    def test_system_health(self):
        from services.waves11_20.observability import get_observability_service
        svc = get_observability_service()
        health = svc.get_health()
        assert isinstance(health.to_dict(), dict)
        assert hasattr(health, 'status')

    def test_counter_increment(self):
        from services.waves11_20.observability import get_observability_service
        svc = get_observability_service()
        svc.inc_counter('test_requests', 1)
        metrics = svc.get_metrics()
        assert isinstance(metrics, list)


# ── Wave 20: Productization Service ──

class TestProductizationService:
    def test_import(self):
        from services.waves11_20.productization import ProductizationService
        assert ProductizationService is not None

    def test_singleton(self):
        from services.waves11_20.productization import get_productization_service
        p1 = get_productization_service()
        p2 = get_productization_service()
        assert p1 is p2

    def test_default_universe(self):
        from services.waves11_20.productization import get_productization_service
        svc = get_productization_service()
        universe = svc.get_universe()
        assert isinstance(universe, list)
        assert len(universe) == 10
        # Get symbols list
        symbols = svc.get_symbols()
        assert 'AAPL' in symbols

    def test_config_profiles(self):
        from services.waves11_20.productization import get_productization_service
        svc = get_productization_service()
        profiles = svc.list_profiles()
        assert isinstance(profiles, list)
        assert len(profiles) >= 3  # conservative, moderate, aggressive

    def test_builtin_runbooks(self):
        from services.waves11_20.productization import get_productization_service
        svc = get_productization_service()
        runbooks = svc.get_runbooks()
        assert isinstance(runbooks, list)
        assert len(runbooks) >= 5

    def test_release_info(self):
        from services.waves11_20.productization import get_productization_service
        svc = get_productization_service()
        info = svc.get_release_info()
        assert isinstance(info, dict)
        assert info['version'] == '2.0.0'


# ── Cross-module integration checks ──

class TestCrossModuleIntegration:
    def test_all_modules_import(self):
        """All 10 wave modules must import without error."""
        from services.waves11_20 import market_session, elastic, data_spine, broker
        from services.waves11_20 import portfolio, performance, backtester
        from services.waves11_20 import discovery, ai_strategy, sentiment
        from services.waves11_20 import workflows, observability, productization
        assert True

    def test_package_version(self):
        from services.waves11_20 import __version__
        assert __version__ == '2.0.0'

    def test_no_live_trading(self):
        """Paper-only enforcement must work."""
        from services.waves11_20.broker import get_paper_broker, LiveTradingRefusedError
        broker = get_paper_broker()
        # ensure_paper_only should not raise
        broker.ensure_paper_only()

    def test_default_universes_match(self):
        """Data spine and productization must agree on default universe size."""
        from services.waves11_20.data_spine import get_data_spine
        from services.waves11_20.productization import get_productization_service
        spine_u = get_data_spine().get_universe()
        prod_symbols = get_productization_service().get_symbols()
        assert len(spine_u) == len(prod_symbols) == 10
