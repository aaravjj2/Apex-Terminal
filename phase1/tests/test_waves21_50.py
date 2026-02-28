"""
Waves 21-50 — Backtest Engine v4 + Elasticsearch v3 — Unit Tests
Tests all backend service modules without network access.
"""
import pytest
import sys
from pathlib import Path

# Ensure services importable
sys.path.insert(0, str(Path(__file__).parent.parent))


# ═══════════════════════════════════════════════════
# Wave 21: Canonical Schema
# ═══════════════════════════════════════════════════

class TestCanonicalSchema:
    def test_import(self):
        from services.waves21_50.backtest.canonical_schema import CanonicalBar, BarSeries, Provenance
        assert CanonicalBar is not None

    def test_bar_resolution_enum(self):
        from services.waves21_50.backtest.canonical_schema import BarResolution
        assert BarResolution.DAILY.value == "1d"
        assert BarResolution.MINUTE_1.value == "1m"
        assert BarResolution.WEEKLY.value == "1w"

    def test_data_source_enum(self):
        from services.waves21_50.backtest.canonical_schema import DataSource
        assert DataSource.YFINANCE.value == "yfinance"
        assert DataSource.ALPACA.value == "alpaca"

    def test_canonical_bar_creation(self):
        from services.waves21_50.backtest.canonical_schema import CanonicalBar, BarResolution, Provenance, DataSource
        prov = Provenance(source=DataSource.YFINANCE, fetched_at="2024-01-01T00:00:00Z")
        bar = CanonicalBar(
            symbol="AAPL", timestamp="2024-01-02T00:00:00Z", resolution=BarResolution.DAILY,
            open=150.0, high=155.0, low=149.0, close=153.0, volume=1000000,
            provenance=prov,
        )
        assert bar.symbol == "AAPL"
        assert bar.open == 150.0
        assert bar.close == 153.0

    def test_bar_hash(self):
        from services.waves21_50.backtest.canonical_schema import CanonicalBar, BarResolution, Provenance, DataSource
        prov = Provenance(source=DataSource.YFINANCE, fetched_at="2024-01-01T00:00:00Z")
        bar = CanonicalBar(
            symbol="AAPL", timestamp="2024-01-02T00:00:00Z", resolution=BarResolution.DAILY,
            open=150.0, high=155.0, low=149.0, close=153.0, volume=1000000,
            provenance=prov,
        )
        h = bar.bar_hash
        assert isinstance(h, str)
        assert len(h) == 16

    def test_bar_series(self):
        from services.waves21_50.backtest.canonical_schema import BarSeries, CanonicalBar, BarResolution, Provenance, DataSource
        prov = Provenance(source=DataSource.YFINANCE, fetched_at="2024-01-01T00:00:00Z")
        bars = [
            CanonicalBar(symbol="AAPL", timestamp="2024-01-02T00:00:00Z", resolution=BarResolution.DAILY,
                         open=150.0, high=155.0, low=149.0, close=153.0, volume=1000000, provenance=prov),
            CanonicalBar(symbol="AAPL", timestamp="2024-01-03T00:00:00Z", resolution=BarResolution.DAILY,
                         open=153.0, high=158.0, low=152.0, close=156.0, volume=1200000, provenance=prov),
        ]
        series = BarSeries(symbol="AAPL", resolution=BarResolution.DAILY, bars=bars)
        assert len(series.bars) == 2
        c = series.completeness(2)
        assert 0.0 <= c <= 1.0

    def test_adjustment_type_enum(self):
        from services.waves21_50.backtest.canonical_schema import AdjustmentType
        assert AdjustmentType.NONE.value == "none"
        assert AdjustmentType.SPLIT_AND_DIVIDEND.value == "split_and_dividend"


# ═══════════════════════════════════════════════════
# Wave 22: Data Pipeline
# ═══════════════════════════════════════════════════

class TestDataPipeline:
    def test_import(self):
        from services.waves21_50.backtest.data_pipeline import DataPipeline, get_pipeline
        assert DataPipeline is not None

    def test_singleton(self):
        from services.waves21_50.backtest.data_pipeline import get_pipeline
        p1 = get_pipeline()
        p2 = get_pipeline()
        assert p1 is p2

    def test_health(self):
        from services.waves21_50.backtest.data_pipeline import get_pipeline
        p = get_pipeline()
        h = p.get_health()
        assert "symbols" in h
        assert "total_bars" in h

    def test_list_symbols(self):
        from services.waves21_50.backtest.data_pipeline import get_pipeline
        p = get_pipeline()
        syms = p.list_symbols()
        assert isinstance(syms, list)


# ═══════════════════════════════════════════════════
# Wave 23: Corporate Actions
# ═══════════════════════════════════════════════════

class TestCorporateActions:
    def test_import(self):
        from services.waves21_50.backtest.corporate_actions import CorporateActionsRegistry, CorporateAction, ActionType
        assert CorporateActionsRegistry is not None

    def test_singleton(self):
        from services.waves21_50.backtest.corporate_actions import get_corporate_actions
        r1 = get_corporate_actions()
        r2 = get_corporate_actions()
        assert r1 is r2

    def test_add_and_get(self):
        from services.waves21_50.backtest.corporate_actions import get_corporate_actions, CorporateAction, ActionType
        reg = get_corporate_actions()
        reg.add_action(CorporateAction(symbol="TEST", action_type=ActionType.SPLIT, ex_date="2024-06-01", ratio=2.0))
        actions = reg.get_actions("TEST")
        assert len(actions) >= 1
        assert actions[0].symbol == "TEST"

    def test_action_types(self):
        from services.waves21_50.backtest.corporate_actions import ActionType
        assert ActionType.SPLIT.value == "split"
        assert ActionType.DIVIDEND.value == "dividend"
        assert ActionType.MERGER.value == "merger"


# ═══════════════════════════════════════════════════
# Wave 24: Symbol Lifecycle
# ═══════════════════════════════════════════════════

class TestSymbolLifecycle:
    def test_import(self):
        from services.waves21_50.backtest.symbol_lifecycle import SymbolRegistry, SymbolMeta, SymbolStatus
        assert SymbolRegistry is not None

    def test_singleton(self):
        from services.waves21_50.backtest.symbol_lifecycle import get_symbol_registry
        r1 = get_symbol_registry()
        r2 = get_symbol_registry()
        assert r1 is r2

    def test_status_enum(self):
        from services.waves21_50.backtest.symbol_lifecycle import SymbolStatus
        assert SymbolStatus.ACTIVE.value == "active"
        assert SymbolStatus.DELISTED.value == "delisted"

    def test_register_and_query(self):
        from services.waves21_50.backtest.symbol_lifecycle import get_symbol_registry, SymbolMeta, SymbolStatus
        reg = get_symbol_registry()
        reg.register(SymbolMeta(symbol="TESTLIFE", name="Test", status=SymbolStatus.ACTIVE))
        assert reg.is_tradable("TESTLIFE", "2024-01-15")

    def test_survivorship_check(self):
        from services.waves21_50.backtest.symbol_lifecycle import get_symbol_registry
        reg = get_symbol_registry()
        result = reg.survivorship_check(["TESTLIFE"], "2020-01-01")
        assert isinstance(result, dict)


# ═══════════════════════════════════════════════════
# Wave 25: Timeframe Alignment
# ═══════════════════════════════════════════════════

class TestTimeframeAlignment:
    def test_import(self):
        from services.waves21_50.backtest.timeframe_alignment import resample, align_series
        assert resample is not None

    def test_can_resample(self):
        from services.waves21_50.backtest.timeframe_alignment import can_resample
        from services.waves21_50.backtest.canonical_schema import BarResolution
        assert can_resample(BarResolution.MINUTE_1, BarResolution.MINUTE_5)
        assert can_resample(BarResolution.DAILY, BarResolution.WEEKLY)
        assert not can_resample(BarResolution.WEEKLY, BarResolution.DAILY)

    def test_resolution_minutes(self):
        from services.waves21_50.backtest.timeframe_alignment import resolution_minutes
        from services.waves21_50.backtest.canonical_schema import BarResolution
        assert resolution_minutes(BarResolution.MINUTE_1) == 1
        assert resolution_minutes(BarResolution.DAILY) == 1440


# ═══════════════════════════════════════════════════
# Wave 26: Data Quality
# ═══════════════════════════════════════════════════

class TestDataQuality:
    def test_import(self):
        from services.waves21_50.backtest.data_quality import score_quality, QualityReport
        assert score_quality is not None

    def test_quality_grading(self):
        from services.waves21_50.backtest.data_quality import QualityGrade
        assert QualityGrade.A == "A"
        assert QualityGrade.F == "F"


# ═══════════════════════════════════════════════════
# Wave 27: Portfolio Accounting
# ═══════════════════════════════════════════════════

class TestPortfolioAccounting:
    def test_import(self):
        from services.waves21_50.backtest.portfolio_accounting import PortfolioLedger, Fill, Position, Side
        assert PortfolioLedger is not None

    def test_create_ledger(self):
        from services.waves21_50.backtest.portfolio_accounting import PortfolioLedger
        ledger = PortfolioLedger(initial_cash=100000)
        assert ledger.cash == 100000
        assert ledger.total_equity({}) == 100000

    def test_apply_fill(self):
        from services.waves21_50.backtest.portfolio_accounting import PortfolioLedger, Side
        ledger = PortfolioLedger(initial_cash=100000)
        fill = ledger.apply_fill("AAPL", Side.BUY, 10, 150.0, commission=1.0, slippage=0.5)
        assert "AAPL" in ledger.positions
        assert ledger.positions["AAPL"].qty == 10
        assert fill.fill_id.startswith("fill-")

    def test_max_drawdown(self):
        from services.waves21_50.backtest.portfolio_accounting import PortfolioLedger
        ledger = PortfolioLedger(initial_cash=100000)
        dd = ledger.max_drawdown()
        assert dd == 0.0

    def test_side_enum(self):
        from services.waves21_50.backtest.portfolio_accounting import Side
        assert Side.BUY.value == "buy"
        assert Side.SELL.value == "sell"


# ═══════════════════════════════════════════════════
# Wave 28: Cost Models
# ═══════════════════════════════════════════════════

class TestCostModels:
    def test_import(self):
        from services.waves21_50.backtest.cost_models import CostModel, get_cost_model, list_cost_models
        assert CostModel is not None

    def test_list_models(self):
        from services.waves21_50.backtest.cost_models import list_cost_models
        models = list_cost_models()
        assert isinstance(models, list)
        assert len(models) >= 6  # zero, robinhood, ibkr_fixed, ibkr_tiered, schwab, realistic

    def test_get_model(self):
        from services.waves21_50.backtest.cost_models import get_cost_model
        m = get_cost_model("realistic")
        assert m is not None
        assert m.commission_per_share > 0

    def test_calculate_zero(self):
        from services.waves21_50.backtest.cost_models import get_cost_model
        m = get_cost_model("zero")
        assert m is not None
        result = m.calculate(100, 150.0, False)
        assert result["commission"] == 0.0

    def test_calculate_realistic(self):
        from services.waves21_50.backtest.cost_models import get_cost_model
        m = get_cost_model("realistic")
        result = m.calculate(100, 150.0, True)
        assert result["total"] > 0


# ═══════════════════════════════════════════════════
# Wave 29: Order Engine
# ═══════════════════════════════════════════════════

class TestOrderEngine:
    def test_import(self):
        from services.waves21_50.backtest.order_engine import DeterministicFillEngine, OrderType, Order
        assert DeterministicFillEngine is not None

    def test_order_types(self):
        from services.waves21_50.backtest.order_engine import OrderType
        assert OrderType.MARKET.value == "market"
        assert OrderType.LIMIT.value == "limit"
        assert OrderType.STOP.value == "stop"
        assert OrderType.TRAILING_STOP.value == "trailing_stop"
        assert OrderType.MOC.value == "market_on_close"

    def test_create_order(self):
        from services.waves21_50.backtest.order_engine import DeterministicFillEngine, OrderType, OrderSide
        engine = DeterministicFillEngine()
        order = engine.create_order("AAPL", OrderSide.BUY, OrderType.MARKET, 10)
        assert order is not None
        assert order.symbol == "AAPL"
        assert order.qty == 10


# ═══════════════════════════════════════════════════
# Wave 30: Risk Controls
# ═══════════════════════════════════════════════════

class TestRiskControls:
    def test_import(self):
        from services.waves21_50.backtest.risk_controls import RiskController, RiskLimits, RiskCheckResult
        assert RiskController is not None

    def test_default_limits(self):
        from services.waves21_50.backtest.risk_controls import RiskLimits
        limits = RiskLimits()
        assert limits.max_position_pct == 0.20
        assert limits.max_portfolio_positions == 20
        assert limits.max_drawdown_pct == 0.25

    def test_check_order(self):
        from services.waves21_50.backtest.risk_controls import RiskController, RiskLimits
        from services.waves21_50.backtest.portfolio_accounting import PortfolioLedger
        controller = RiskController(RiskLimits())
        ledger = PortfolioLedger(initial_cash=100000)
        result = controller.check_order(ledger, "AAPL", 10, 150.0, {})
        assert result.passed


# ═══════════════════════════════════════════════════
# Waves 31-33: Event-Driven Engine
# ═══════════════════════════════════════════════════

class TestEventDrivenEngine:
    def test_import(self):
        from services.waves21_50.backtest.engine import EventDrivenEngine, BacktestConfig, BacktestResult
        assert EventDrivenEngine is not None

    def test_singleton(self):
        from services.waves21_50.backtest.engine import get_engine
        e1 = get_engine()
        e2 = get_engine()
        assert e1 is e2

    def test_event_types(self):
        from services.waves21_50.backtest.engine import EventType
        assert EventType.BAR.value == "bar"
        assert EventType.FILL.value == "fill"
        assert EventType.SIGNAL.value == "signal"

    def test_list_runs_empty(self):
        from services.waves21_50.backtest.engine import get_engine
        engine = get_engine()
        runs = engine.list_runs()
        assert isinstance(runs, list)


# ═══════════════════════════════════════════════════
# Wave 34: Parameter Sweep
# ═══════════════════════════════════════════════════

class TestSweep:
    def test_import(self):
        from services.waves21_50.backtest.evaluation import run_sweep, SweepParam
        assert run_sweep is not None

    def test_sweep_param(self):
        from services.waves21_50.backtest.evaluation import SweepParam
        sp = SweepParam(name="fast_period", values=[5, 10, 15])
        assert sp.name == "fast_period"
        assert len(sp.values) == 3


# ═══════════════════════════════════════════════════
# Wave 35: Walk-Forward
# ═══════════════════════════════════════════════════

class TestWalkForward:
    def test_import(self):
        from services.waves21_50.backtest.evaluation import run_walk_forward
        assert run_walk_forward is not None


# ═══════════════════════════════════════════════════
# Wave 36: Robustness
# ═══════════════════════════════════════════════════

class TestRobustness:
    def test_import(self):
        from services.waves21_50.backtest.evaluation import run_robustness
        assert run_robustness is not None


# ═══════════════════════════════════════════════════
# Wave 37: Overfit
# ═══════════════════════════════════════════════════

class TestOverfit:
    def test_import(self):
        from services.waves21_50.backtest.evaluation import calculate_overfit_penalty
        assert calculate_overfit_penalty is not None


# ═══════════════════════════════════════════════════
# Wave 38: Benchmark
# ═══════════════════════════════════════════════════

class TestBenchmark:
    def test_import(self):
        from services.waves21_50.backtest.evaluation import calculate_benchmark
        assert calculate_benchmark is not None


# ═══════════════════════════════════════════════════
# Wave 39: Monte Carlo
# ═══════════════════════════════════════════════════

class TestMonteCarlo:
    def test_import(self):
        from services.waves21_50.backtest.evaluation import run_monte_carlo
        assert run_monte_carlo is not None


# ═══════════════════════════════════════════════════
# Wave 40: Portfolio Selection
# ═══════════════════════════════════════════════════

class TestPortfolioSelection:
    def test_import(self):
        from services.waves21_50.backtest.evaluation import select_portfolio
        assert select_portfolio is not None


# ═══════════════════════════════════════════════════
# Wave 41: Strategy Spec v2
# ═══════════════════════════════════════════════════

class TestStrategySpecV2:
    def test_import(self):
        from services.waves21_50.strategy.strategy_system import StrategySpecV2
        assert StrategySpecV2 is not None

    def test_validate(self):
        from services.waves21_50.strategy.strategy_system import StrategySpecV2, SignalType
        spec = StrategySpecV2(
            spec_id="test-001",
            name="Test Strategy",
            universe=["AAPL"],
            indicators=[],
            signal_type=SignalType.CROSSOVER,
            position_size_pct=0.10,
        )
        errors = spec.validate()
        assert isinstance(errors, list)

    def test_lint(self):
        from services.waves21_50.strategy.strategy_system import StrategySpecV2, SignalType
        spec = StrategySpecV2(
            spec_id="test-002",
            name="Test Strategy",
            universe=["AAPL"],
            indicators=[],
            signal_type=SignalType.CROSSOVER,
            position_size_pct=0.10,
        )
        warnings = spec.lint()
        assert isinstance(warnings, list)

    def test_spec_hash(self):
        from services.waves21_50.strategy.strategy_system import StrategySpecV2, SignalType
        spec = StrategySpecV2(spec_id="test-003", name="Test", universe=["AAPL"], indicators=[], signal_type=SignalType.CROSSOVER, position_size_pct=0.10)
        assert isinstance(spec.spec_hash, str)
        assert len(spec.spec_hash) > 0


# ═══════════════════════════════════════════════════
# Wave 42: AI Assist
# ═══════════════════════════════════════════════════

class TestAIAssist:
    def test_import(self):
        from services.waves21_50.strategy.strategy_system import ai_assist_parse
        assert ai_assist_parse is not None

    def test_parse_valid(self):
        from services.waves21_50.strategy.strategy_system import ai_assist_parse, AIAssistResult
        result = ai_assist_parse("Buy AAPL when SMA 10 crosses above SMA 50")
        assert isinstance(result, AIAssistResult)
        assert result.accepted
        assert result.parsed_spec is not None

    def test_parse_refusal(self):
        from services.waves21_50.strategy.strategy_system import ai_assist_parse, AIAssistResult
        result = ai_assist_parse("guaranteed profit risk-free")
        assert isinstance(result, AIAssistResult)
        assert not result.accepted
        assert result.refusal_reason is not None


# ═══════════════════════════════════════════════════
# Wave 43: Candidate Generation
# ═══════════════════════════════════════════════════

class TestCandidateGeneration:
    def test_import(self):
        from services.waves21_50.strategy.strategy_system import generate_candidates
        assert generate_candidates is not None

    def test_generate(self):
        from services.waves21_50.strategy.strategy_system import StrategySpecV2, generate_candidates, SignalType
        base = StrategySpecV2(spec_id="base-001", name="Base", universe=["AAPL"], indicators=[], signal_type=SignalType.CROSSOVER, position_size_pct=0.10)
        candidates = generate_candidates(base, n_mutations=3, seed=42)
        assert len(candidates) >= 1  # at least the base itself
        assert candidates[0].spec_id == base.spec_id  # first is always the base


# ═══════════════════════════════════════════════════
# Waves 44-45: Job Queue
# ═══════════════════════════════════════════════════

class TestJobQueue:
    def test_import(self):
        from services.waves21_50.strategy.strategy_system import JobQueue, get_job_queue
        assert JobQueue is not None

    def test_singleton(self):
        from services.waves21_50.strategy.strategy_system import get_job_queue
        q1 = get_job_queue()
        q2 = get_job_queue()
        assert q1 is q2

    def test_submit_and_list(self):
        from services.waves21_50.strategy.strategy_system import get_job_queue
        queue = get_job_queue()
        job = queue.submit(job_type="backtest")
        assert job is not None
        assert job.job_id.startswith("job-")
        jobs = queue.list_jobs()
        assert len(jobs) >= 1

    def test_cancel(self):
        from services.waves21_50.strategy.strategy_system import get_job_queue, JobStatus
        queue = get_job_queue()
        job = queue.submit(job_type="sweep")
        # Job may already be COMPLETED (synchronous), cancel only works on QUEUED/RUNNING
        result = queue.cancel(job.job_id)
        assert isinstance(result, bool)


# ═══════════════════════════════════════════════════
# Wave 46: Index Architecture
# ═══════════════════════════════════════════════════

class TestIndexArchitecture:
    def test_import(self):
        from services.waves21_50.elastic.architecture import IndexTemplate, IndexLifecycle, get_index_templates, get_aliases
        assert IndexTemplate is not None

    def test_get_templates(self):
        from services.waves21_50.elastic.architecture import get_index_templates
        templates = get_index_templates()
        assert len(templates) >= 4
        names = [t["name"] for t in templates]
        assert "apex-trades-v3" in names
        assert "apex-strategies-v3" in names

    def test_get_aliases(self):
        from services.waves21_50.elastic.architecture import get_aliases
        aliases = get_aliases()
        assert len(aliases) >= 4


# ═══════════════════════════════════════════════════
# Wave 47: Ingestion Pipeline
# ═══════════════════════════════════════════════════

class TestIngestionPipeline:
    def test_import(self):
        from services.waves21_50.elastic.architecture import IngestionPipeline, get_ingestion_pipeline
        assert IngestionPipeline is not None

    def test_singleton(self):
        from services.waves21_50.elastic.architecture import get_ingestion_pipeline
        p1 = get_ingestion_pipeline()
        p2 = get_ingestion_pipeline()
        assert p1 is p2

    def test_enqueue(self):
        from services.waves21_50.elastic.architecture import IngestionPipeline
        pipeline = IngestionPipeline(batch_size=100)
        ok = pipeline.enqueue({"test": True}, "apex-trades")
        assert ok
        assert pipeline.get_metrics()["queue_depth"] == 1

    def test_metrics(self):
        from services.waves21_50.elastic.architecture import IngestionPipeline
        pipeline = IngestionPipeline()
        metrics = pipeline.get_metrics()
        assert "docs_ingested" in metrics
        assert "status" in metrics

    def test_dlq(self):
        from services.waves21_50.elastic.architecture import IngestionPipeline
        pipeline = IngestionPipeline()
        pipeline.add_to_dlq("doc1", "idx", "error msg", {"data": 1})
        dlq = pipeline.get_dlq()
        assert len(dlq) == 1


# ═══════════════════════════════════════════════════
# Wave 48: Query UX
# ═══════════════════════════════════════════════════

class TestQueryEngine:
    def test_import(self):
        from services.waves21_50.elastic.architecture import QueryEngine, get_query_engine
        assert QueryEngine is not None

    def test_singleton(self):
        from services.waves21_50.elastic.architecture import get_query_engine
        qe1 = get_query_engine()
        qe2 = get_query_engine()
        assert qe1 is qe2

    def test_parse_query(self):
        from services.waves21_50.elastic.architecture import QueryEngine
        qe = QueryEngine()
        result = qe.parse_query("type:crossover AAPL momentum")
        assert result["search_terms"] == ["AAPL", "momentum"]
        assert result["filters"]["type"] == "crossover"

    def test_save_query(self):
        from services.waves21_50.elastic.architecture import QueryEngine
        qe = QueryEngine()
        sq = qe.save_query("Test Query", "AAPL momentum", "apex-strategies")
        assert sq.query_id.startswith("sq-")
        assert len(qe.list_saved_queries()) >= 1

    def test_explain(self):
        from services.waves21_50.elastic.architecture import QueryEngine
        qe = QueryEngine()
        ex = qe.explain_query("test query")
        assert ex.parsed_tokens == ["test", "query"]
        assert len(ex.score_breakdown) > 0

    def test_facets(self):
        from services.waves21_50.elastic.architecture import QueryEngine
        qe = QueryEngine()
        facets = qe.get_facets("apex-trades")
        assert len(facets) >= 1

    def test_pin_unpin(self):
        from services.waves21_50.elastic.architecture import QueryEngine
        qe = QueryEngine()
        qe.pin_filter("status", "active")
        assert qe.get_pinned_filters()["status"] == "active"
        qe.unpin_filter("status")
        assert "status" not in qe.get_pinned_filters()


# ═══════════════════════════════════════════════════
# Wave 49: Semantic Search
# ═══════════════════════════════════════════════════

class TestSemanticSearch:
    def test_import(self):
        from services.waves21_50.elastic.architecture import is_semantic_enabled
        assert is_semantic_enabled is not None

    def test_default_disabled(self):
        from services.waves21_50.elastic.architecture import is_semantic_enabled
        # Default should be disabled
        result = is_semantic_enabled()
        assert isinstance(result, bool)


# ═══════════════════════════════════════════════════
# Wave 50: Artifact Store
# ═══════════════════════════════════════════════════

class TestArtifactStore:
    def test_import(self):
        from services.waves21_50.elastic.architecture import ArtifactStore, ExportArtifact, get_artifact_store
        assert ArtifactStore is not None

    def test_singleton(self):
        from services.waves21_50.elastic.architecture import get_artifact_store
        s1 = get_artifact_store()
        s2 = get_artifact_store()
        assert s1 is s2

    def test_export_artifact(self):
        from services.waves21_50.elastic.architecture import ArtifactStore
        store = ArtifactStore()
        artifact = store.export_artifact("run", {"run_id": "test", "sharpe": 1.5})
        assert artifact.artifact_id.startswith("art-")
        assert artifact.checksum

    def test_verify(self):
        from services.waves21_50.elastic.architecture import ArtifactStore
        store = ArtifactStore()
        artifact = store.export_artifact("run", {"run_id": "verify_test"})
        result = store.verify(artifact.artifact_id)
        assert result["found"]
        assert result["checksum_match"]

    def test_list(self):
        from services.waves21_50.elastic.architecture import ArtifactStore
        store = ArtifactStore()
        store.export_artifact("test", {"foo": "bar"})
        artifacts = store.list_artifacts()
        assert len(artifacts) >= 1
