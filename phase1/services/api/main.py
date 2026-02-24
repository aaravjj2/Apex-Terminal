"""
FastAPI application for REST and WebSocket APIs.
"""

# Load environment before any other imports that might read os.environ
from pathlib import Path
from dotenv import load_dotenv
_keys_path = Path(__file__).parent.parent.parent / "keys.env"
if _keys_path.exists():
    load_dotenv(_keys_path)

import asyncio
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from ..config import get_settings
from ..persistence import init_database, get_database
from .routes import bars, ingest, parity, debug, clock, drawings, strategies, portfolio, alerts, versions, runs, packages, metrics, incidents, notes, reports, options, profiles, patterns, fundamentals, automation, forecast, intelligence, risk_desk, strategy_lab, strategy_artifacts, backtest, backtest_v2, unified_runs, ticker, market_data_v1_13, cache, provider_registry, citations, search, agents, watchlist, correlation, journal, notifications, audit_log, attribution, risk_scenarios, data_quality, strategy_compare, platform_health
# Wave 6-10 routes
from .routes import monte_carlo, walk_forward, scoring, sentiment, regime
from .routes import elasticsearch_gateway, nova
from .routes import market_hours, kill_switch_recovery, system_health
from .routes import observability, compliance, performance_analytics
# New Wave 6-10 feature routes
from .routes import strategy_optimizer, anomalies, portfolio_optimizer
from .routes import sandbox_runner, scenario_sim, alt_data, signal_market
from .routes import microstructure, liquidity
from .routes import policy_signal, risk_network, hedge_fund
# Core Depth Upgrade routes
from .routes import autopilot_depth, backtest_depth, workflow_depth, search_depth
# ── Waves 11-20: Online-Only Swing Equities v1 ──
from .routes import (
    w11_market_session, w11_elasticsearch, w11_data_spine, w11_broker,
    w12_portfolio, w13_performance, w14_backtester, w15_discovery,
    w16_ai_strategy, w17_sentiment, w18_workflows, w19_observability,
    w20_productization,
)
# ── Waves 21-50: Backtest Engine v4 + Elasticsearch v3 ──
from .routes import w21_backtest_v4, w46_elasticsearch_v3
# ── Ops Health ──────────────────────────────────────────────────────────────
from .routes import ops_health
from .routes import ops_health_v3  # Wave 84: /api/v3/ops/* endpoints
from .routes import evidence        # Wave 93: /api/v3/evidence/* endpoints
from .routes import agent_tools_v3  # Wave 94: /api/v3/agent/* endpoints
from .routes import elastic_agent    # Wave 95: /api/v3/elastic-agent/* endpoints
from .routes import search_ux_v3     # Wave 96: /api/v3/search-ux/* endpoints
from .routes import backtest_contract # Wave 97: /api/v3/backtest-contract/* endpoints
from .routes import walkforward_v3    # Wave 98: /api/v3/walkforward/* endpoints
from .routes import strategy_studio_v3 # Wave 99: /api/v3/strategy-studio/* endpoints
from .routes import job_queue_v2       # Wave 100: /api/v3/jobs/* endpoints
from .routes import convergence_cockpit_v1 # Wave 101: /api/v3/cockpit/* endpoints
from .routes import agent_eval_harness     # Wave 102: /api/v3/eval/* endpoints
from .routes import ui_page_registry       # Wave 103: /api/v3/pages/* endpoints
from .routes import a11y_audit             # Wave 104: /api/v3/a11y/* endpoints
from .routes import perf_budget            # Wave 105: /api/v3/perf/* endpoints
from .routes import controls_domain        # Wave 106: /api/v3/controls/* endpoints
from .routes import safe_actions           # Wave 107: /api/v3/tickets/* endpoints
from .routes import export_bundle          # Wave 108: /api/v3/export/* endpoints
from .routes import ops_reset              # Wave 112: /api/v3/ops/reset* endpoints
# ── Reality Repair routes (Phases A-G) ─────────────────────────────────────
from .routes import ops_version            # Phase A: /api/ops/version
from .routes import ops_market_session     # Phase D: /api/ops/market_session
from .routes import ops_broker             # Phase E: /api/broker/*
# ── Wave 85: Domain routers (audit, broker) ────────────────────────────────
try:
    from backend.domains.audit import routes as audit_domain_routes  # noqa: E402
    from backend.domains.broker import routes as broker_domain_routes  # noqa: E402
    _w85_domains_loaded = True
except ImportError as _e:
    import logging as _logging
    _logging.getLogger(__name__).warning(f"W85 domain routes not loaded: {_e}")
    audit_domain_routes = None
    broker_domain_routes = None
    _w85_domains_loaded = False
from .websocket import router as ws_router
from .health_router import router as health_router
from .verification_routes import router as verification_router
# UNIFIED AUTOPILOT ROUTER - This is the ONLY autopilot API
from ..autopilot.unified_router import router as unified_autopilot_router
# v1.19 + v1.20: Portfolio CRUD
from ..portfolio import portfolio_router


logger = structlog.get_logger()


from ..ingestion.main import IngestionService
from ..autopilot.service import get_autopilot_service
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("application_startup")
    
    # Initialize database
    await init_database()
    logger.info("database_initialized")
    
    # Initialize autopilot DB tables
    from ..autopilot.repository import init_autopilot_db
    init_autopilot_db()
    logger.info("autopilot_db_initialized")
    
    # Start Autopilot Service (Background)
    # This runs the cycle every 60 seconds autonomously
    try:
        autopilot_service = get_autopilot_service()
        await autopilot_service.start_background_loop(interval_seconds=60)
        # Start continuous position monitoring (every 15 seconds)
        await autopilot_service.start_monitoring_loop(interval_seconds=15)
    except Exception as e:
        logger.error(f"Failed to start autopilot service: {e}")
    
    # Start Ingestion Service (Background)
    settings = get_settings()
    
    # Waves 11-20: Online-only mode — no mock/demo/synthetic
    # Prefer Alpaca, fallback to Finnhub, but never mock
    mode = "live"
    csv_path = None
    provider_override = None

    if settings.apca_api_key_id:
        provider_override = "alpaca"
        logger.info("using_alpaca_live_data")
    elif settings.finnhub_api_key:
        provider_override = "finnhub"
        logger.info("using_finnhub_live_data")
    else:
        # Online-only: still set mode=live, ingestion will use yfinance
        logger.warning("no_api_keys_configured_using_yfinance_fallback")

    ingestion = IngestionService(mode=mode, symbols=["AAPL", "TSLA", "MSFT"], provider=provider_override) # Default symbols
    
    # Start ingestion
    try:
        await ingestion.start()

        # Expose ingestion on app state for status endpoints
        try:
            app.state.ingestion = ingestion
        except Exception:
            pass
            
    except Exception as e:
        logger.error("ingestion_startup_failed", error=str(e))

    # Start WebSocket manager heartbeat
    try:
        from .websocket import get_manager as get_ws_manager
        ws_manager = get_ws_manager()
        await ws_manager.start()
        app.state.ws_manager = ws_manager
        
        # Start Autopilot WebSocket Manager
        from .autopilot_websocket import get_autopilot_ws_manager
        auto_ws = get_autopilot_ws_manager()
        await auto_ws.start()
        app.state.auto_ws = auto_ws
    except Exception as e:
        logger.error("ws_manager_start_failed", error=str(e))
    
    # Start health monitoring
    try:
        from ..monitoring.health import get_health_monitor
        health_monitor = get_health_monitor()
        await health_monitor.start_monitoring()
        app.state.health_monitor = health_monitor
    except Exception as e:
        logger.error("health_monitor_start_failed", error=str(e))
    
    yield
    
    # Cleanup Ingestion
    await ingestion.stop()

    # Stop health monitoring
    try:
        health_monitor = getattr(app.state, 'health_monitor', None)
        if health_monitor:
            await health_monitor.stop_monitoring()
    except Exception as e:
        logger.error("health_monitor_stop_failed", error=str(e))

    # Stop WebSocket manager
    try:
        ws_manager = getattr(app.state, 'ws_manager', None)
        if ws_manager:
            await ws_manager.stop()
        
        auto_ws = getattr(app.state, 'auto_ws', None)
        if auto_ws:
            await auto_ws.stop()
    except Exception as e:
        logger.error("ws_manager_stop_failed", error=str(e))
    
    # Cleanup Autopilot
    await autopilot_service.stop_background_loop()
    
    # Cleanup DB
    db = get_database()
    await db.close()
    logger.info("application_shutdown")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="Apex Terminal — Online-Only Swing Equities v1",
        description="Waves 11-20: REST and WebSocket APIs for swing equity trading",
        version="2.0.0",
        lifespan=lifespan,
    )
    
    # JSON Error Middleware — guarantees all errors return valid JSON
    from .middleware.json_errors import JsonErrorMiddleware
    app.add_middleware(JsonErrorMiddleware)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(bars.router, prefix="/api/v1/bars", tags=["bars"])
    app.include_router(ingest.router, prefix="/api/v1/ingest", tags=["ingest"])
    app.include_router(parity.router, prefix="/api/v1/parity", tags=["parity"])
    app.include_router(debug.router, prefix="/api/v1/debug", tags=["debug"])
    app.include_router(clock.router, prefix="/api/v1/clock", tags=["clock"])
    app.include_router(drawings.router, prefix="/api/v1/drawings", tags=["drawings"])
    app.include_router(strategies.router, prefix="/api/v1/strategies", tags=["strategies"])
    app.include_router(portfolio.router, prefix="/api/v1/portfolio", tags=["portfolio"])
    app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
    app.include_router(versions.router, prefix="/api/v1", tags=["versions"])
    app.include_router(runs.router, prefix="/api/v1", tags=["runs"])
    app.include_router(packages.router, prefix="/api/v1", tags=["packages"])
    app.include_router(metrics.router, prefix="/api/v1", tags=["metrics"])
    app.include_router(incidents.router, prefix="/api/v1", tags=["incidents"])
    app.include_router(notes.router, prefix="/api/v1", tags=["notes"])
    app.include_router(reports.router, prefix="/api/v1", tags=["reports"])
    app.include_router(health_router, prefix="/api/v1", tags=["health"])
    app.include_router(options.router, prefix="/api/v1", tags=["options"])
    app.include_router(profiles.router, prefix="/api/v1/profiles", tags=["profiles"])
    app.include_router(patterns.router, prefix="/api/v1/patterns", tags=["patterns"])
    app.include_router(fundamentals.router, prefix="/api/v1/fundamentals", tags=["fundamentals"])
    # Ticker Resolution (v1.10)
    app.include_router(ticker.router, prefix="/api/v1/ticker", tags=["ticker"])
    # Market Data with Record/Replay (v1.13) - available at both v1 and v2 for backward compatibility
    app.include_router(market_data_v1_13.router, prefix="/api/v1/market-data", tags=["market-data-v1.13"])
    app.include_router(market_data_v1_13.router, prefix="/api/v2/market-data", tags=["market-data-v1.13-v2"])
    app.include_router(automation.router, prefix="/api/v1", tags=["automation"])
    app.include_router(forecast.router, prefix="/api/v1", tags=["forecast"])
    app.include_router(intelligence.router, prefix="/api/v1", tags=["intelligence"])
    app.include_router(risk_desk.router, prefix="/api", tags=["risk-desk"])    
    # v1.19 + v1.20: Portfolio CRUD (different from legacy /api/v1/portfolio)
    app.include_router(portfolio_router, tags=["portfolios-v19-v20"])
    # Strategy Lab and Backtest (NEW)
    app.include_router(strategy_lab.router, tags=["strategy_lab"])
    app.include_router(strategy_artifacts.router, tags=["strategy_artifacts"])
    app.include_router(backtest_v2.router, tags=["backtest"])
    # Unified Run Ledger (v1.5)
    app.include_router(unified_runs.router, tags=["unified-runs"])
    # Cache API (v1.16)
    app.include_router(cache.router, tags=["cache"])
    # UNIFIED AUTOPILOT ROUTER - This is the ONLY autopilot API
    app.include_router(unified_autopilot_router, prefix="/api/v1", tags=["autopilot"])
    app.include_router(ws_router, prefix="/ws", tags=["websocket"])
    from .autopilot_websocket import router as autopilot_ws_router
    app.include_router(autopilot_ws_router, prefix="/ws", tags=["autopilot-websocket"])
    app.include_router(autopilot_ws_router, prefix="/ws", tags=["autopilot-websocket"])
    app.include_router(verification_router, tags=["verification"])
    # v1.37: Provider Registry
    app.include_router(provider_registry.router, tags=["provider-registry"])
    # v1.38: Citations
    app.include_router(citations.router, tags=["citations"])
    # v1.39: Search Index
    app.include_router(search.router, tags=["search"])
    # v1.40: Agent Runner
    app.include_router(agents.router, tags=["agents"])
    # v1.41: Watchlist Manager
    app.include_router(watchlist.router, tags=["watchlists"])
    # v1.42: Correlation Matrix
    app.include_router(correlation.router, tags=["correlation"])
    # v1.43: Trade Journal
    app.include_router(journal.router, tags=["journal"])
    # v1.44: Notifications Center
    app.include_router(notifications.router, tags=["notifications"])
    # v1.45: System Audit Log
    app.include_router(audit_log.router, tags=["audit"])
    # v1.46: Performance Attribution
    app.include_router(attribution.router, tags=["attribution"])
    # v1.47: Risk Scenarios
    app.include_router(risk_scenarios.router, tags=["risk-scenarios"])
    # v1.48: Data Quality Monitor
    app.include_router(data_quality.router, tags=["data-quality"])
    # v1.49: Strategy Comparison Matrix
    app.include_router(strategy_compare.router, tags=["strategy-compare"])
    # v1.50: Platform Health Dashboard
    app.include_router(platform_health.router, tags=["platform-health"])
    # ── Ops Health Probes (real connectivity) ──
    app.include_router(ops_health.router, tags=["ops-health"])
    # ── Wave 84: v3 ops health with correlation_id ──
    app.include_router(ops_health_v3.router, tags=["ops-v3"])
    app.include_router(ops_reset.router, tags=["ops-reset"])
    # ── Wave 93: Evidence graph (nodes + edges) ──
    app.include_router(evidence.router, prefix="/api/v3/evidence", tags=["evidence-v3"])
    # ── Wave 94: Agent tools v1 (strict tools + audit trail) ──
    app.include_router(agent_tools_v3.router, prefix="/api/v3/agent", tags=["agent-v3"])
    # ── Wave 95: Elastic Agent Builder integration ──
    app.include_router(elastic_agent.router, prefix="/api/v3/elastic-agent", tags=["elastic-agent-v3"])
    # ── Wave 96: Search UX v3 (facets + saved searches + explain) ──
    app.include_router(search_ux_v3.router, prefix="/api/v3/search-ux", tags=["search-ux-v3"])
    # ── Wave 97: Backtesting correctness contract + golden runs ──
    app.include_router(backtest_contract.router, prefix="/api/v3/backtest-contract", tags=["backtest-contract-v3"])
    # ── Wave 98: Walk-forward + robustness v3 ──
    app.include_router(walkforward_v3.router, prefix="/api/v3/walkforward", tags=["walkforward-v3"])
    # ── Wave 99: Strategy Studio v3 ──
    app.include_router(strategy_studio_v3.router, prefix="/api/v3/strategy-studio", tags=["strategy-studio-v3"])
    # ── Wave 100: Job Queue v2 + WebSocket progress ──
    app.include_router(job_queue_v2.router, prefix="/api/v3/jobs", tags=["job-queue-v2"])
    # ── Wave 101: Convergence Cockpit v1 ──
    app.include_router(convergence_cockpit_v1.router, prefix="/api/v3/cockpit", tags=["convergence-cockpit-v1"])
    app.include_router(agent_eval_harness.router, prefix="/api/v3/eval", tags=["agent-eval-harness"])
    app.include_router(ui_page_registry.router, prefix="/api/v3/pages", tags=["ui-page-registry"])
    app.include_router(a11y_audit.router, prefix="/api/v3/a11y", tags=["a11y-audit"])
    app.include_router(perf_budget.router, prefix="/api/v3/perf", tags=["perf-budget"])
    app.include_router(controls_domain.router, prefix="/api/v3/controls", tags=["controls-domain"])
    app.include_router(safe_actions.router, prefix="/api/v3/tickets", tags=["safe-actions-v3"])
    app.include_router(export_bundle.router, prefix="/api/v3/export", tags=["export-bundle-v3"])
    # ── Reality Repair routes (Phases A-G) ──
    app.include_router(ops_version.router, tags=["ops-version"])
    app.include_router(ops_market_session.router, tags=["ops-market-session"])
    app.include_router(ops_broker.router, tags=["ops-broker-alpaca"])
    # ── Wave 85: Domain routers (audit events + broker health) ──
    if audit_domain_routes is not None:
        app.include_router(audit_domain_routes.router, tags=["audit-domain-v3"])
    if broker_domain_routes is not None:
        app.include_router(broker_domain_routes.router, tags=["broker-domain-v3"])
    
    # ── Wave 6: Market Intelligence ──
    app.include_router(monte_carlo.router, tags=["monte-carlo"])
    app.include_router(walk_forward.router, tags=["walk-forward"])
    app.include_router(scoring.router, tags=["scoring"])
    app.include_router(sentiment.router, tags=["sentiment"])
    app.include_router(regime.router, tags=["regime"])
    # ── Wave 7: Elasticsearch (gated OFF by default) ──
    app.include_router(elasticsearch_gateway.router, tags=["elasticsearch"])
    # ── Wave 8: Amazon Nova LLM (gated OFF by default) ──
    app.include_router(nova.router, tags=["nova"])
    # ── Wave 9: System Operations ──
    app.include_router(market_hours.router, tags=["market-hours"])
    app.include_router(kill_switch_recovery.router, tags=["kill-switch-recovery"])
    app.include_router(system_health.router, tags=["system-health"])
    # ── Wave 10: Observability & Reporting ──
    app.include_router(observability.router, tags=["observability"])
    app.include_router(compliance.router, tags=["compliance"])
    app.include_router(performance_analytics.router, tags=["performance-analytics"])
    # ── New Wave 6: Strategy Optimization ──
    app.include_router(strategy_optimizer.router, tags=["strategy-optimizer"])
    # ── New Wave 7: Anomalies + Portfolio + Sandbox ──
    app.include_router(anomalies.router, tags=["anomalies"])
    app.include_router(portfolio_optimizer.router, tags=["portfolio-optimizer"])
    app.include_router(sandbox_runner.router, tags=["sandbox-runner"])
    # ── New Wave 8: Scenario + Alt Data + Signal Market ──
    app.include_router(scenario_sim.router, tags=["scenario-sim"])
    app.include_router(alt_data.router, tags=["alt-data"])
    app.include_router(signal_market.router, tags=["signal-market"])
    # ── New Wave 9: Microstructure + Liquidity ──
    app.include_router(microstructure.router, tags=["microstructure"])
    app.include_router(liquidity.router, tags=["liquidity"])
    # ── New Wave 10: Policy Signal + Risk Network + Hedge Fund ──
    app.include_router(policy_signal.router, tags=["policy-signal"])
    app.include_router(risk_network.router, tags=["risk-network"])
    app.include_router(hedge_fund.router, tags=["hedge-fund"])
    # ── Core Depth Upgrade ──
    app.include_router(autopilot_depth.router, tags=["autopilot-depth"])
    app.include_router(backtest_depth.router, tags=["backtest-depth"])
    app.include_router(workflow_depth.router, tags=["workflow-depth"])
    app.include_router(search_depth.router, tags=["search-depth"])
    
    # ── Waves 11-20: Online-Only Swing Equities v1 ──
    app.include_router(w11_market_session.router, tags=["market-session-v2"])
    app.include_router(w11_elasticsearch.router, tags=["elasticsearch-v2"])
    app.include_router(w11_data_spine.router, tags=["data-spine-v2"])
    app.include_router(w11_broker.router, tags=["broker-v2"])
    app.include_router(w12_portfolio.router, tags=["portfolio-v2"])
    app.include_router(w13_performance.router, tags=["performance-v2"])
    app.include_router(w14_backtester.router, tags=["backtester-v3"])
    app.include_router(w15_discovery.router, tags=["discovery-v2"])
    app.include_router(w16_ai_strategy.router, tags=["ai-strategy-v2"])
    app.include_router(w17_sentiment.router, tags=["sentiment-v2"])
    app.include_router(w18_workflows.router, tags=["workflows-v3"])
    app.include_router(w19_observability.router, tags=["observability-v2"])
    app.include_router(w20_productization.router, tags=["productization-v2"])
    
    # ── Waves 21-50: Backtest Engine v4 + Elasticsearch v3 ──
    app.include_router(w21_backtest_v4.router, tags=["backtest-v4"])
    app.include_router(w46_elasticsearch_v3.router, tags=["elasticsearch-v3"])
    
    # ── ElastiHack: Unified ES Excellence Router (Waves 001-070) ──
    from .routes import elastihack
    app.include_router(elastihack.router, tags=["elastihack"])
    
    # ElevenLabs TTS
    from .tts_routes import router as tts_router
    app.include_router(tts_router, prefix="/api/v1/tts", tags=["tts"])
    
    # Global exception handler — stable JSON error schema
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        import uuid as _uuid
        cid = request.headers.get("x-correlation-id") or str(_uuid.uuid4())
        logger.error("unhandled_exception", error=str(exc), path=request.url.path, correlation_id=cid)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "code": "INTERNAL_ERROR",
                "message": str(exc),
                "correlation_id": cid,
                "details": None,
            },
            headers={"X-Correlation-Id": cid},
        )
    
    # Health check with data source status — uses REAL probes, never lies
    @app.get("/health")
    async def health_check():
        """
        Quick health check that does real connectivity probes.
        Uses the same backend.core.startup_checks as /api/v3/ops/health.
        """
        from backend.core.startup_checks import run_all_checks  # type: ignore
        result = await run_all_checks(timeout=5.0)
        
        deps = result.get("dependencies", {})
        es = deps.get("elasticsearch", {})
        broker = deps.get("broker", {})
        
        settings = get_settings()
        
        # Determine actual bars source
        if broker.get("connected"):
            bars_source = "alpaca"
        elif settings.finnhub_api_key:
            bars_source = "finnhub"
        elif settings.tiingo_api_key:
            bars_source = "yfinance"
        else:
            bars_source = "none"
        
        return {
            "status": "healthy" if result.get("ready") else "degraded",
            "ready": result.get("ready", False),
            "correlation_id": result.get("correlation_id"),
            "alpaca_configured": bool(settings.apca_api_key_id),
            "alpaca_connected": broker.get("connected", False),
            "elasticsearch_connected": es.get("connected", False),
            "tradier_configured": bool(settings.tradier_brokerage_key),
            "bars_source": bars_source,
            "mode": "paper" if broker.get("connected") else "no-broker",
        }
    
    # Root endpoint
    @app.get("/")
    async def root():
        return {
            "name": "Apex Terminal API",
            "version": "2.0.0",
            "docs": "/docs",
        }
    
    # Config echo — redacted, no secrets
    @app.get("/api/ops/config")
    async def ops_config():
        """
        Returns active runtime configuration with all secrets redacted.
        Use this to verify port/base_url/mode/provider statuses.
        """
        import platform
        settings = get_settings()
        
        def _redact(val):
            if not val:
                return None
            s = str(val)
            if len(s) <= 6:
                return "***"
            return s[:4] + "***" + s[-2:]
        
        return {
            "runtime": {
                "python_version": platform.python_version(),
                "profile": settings.profile,
                "api_port": settings.api_port,
                "log_level": settings.log_level,
            },
            "providers": {
                "alpaca": {
                    "configured": bool(settings.apca_api_key_id),
                    "key_preview": _redact(settings.apca_api_key_id),
                    "endpoint": settings.apca_endpoint,
                },
                "finnhub": {
                    "configured": bool(settings.finnhub_api_key),
                    "key_preview": _redact(settings.finnhub_api_key),
                },
                "tiingo": {
                    "configured": bool(settings.tiingo_api_key),
                    "key_preview": _redact(settings.tiingo_api_key),
                },
                "tradier": {
                    "configured": bool(settings.tradier_brokerage_key),
                    "key_preview": _redact(settings.tradier_brokerage_key),
                    "options_provider": settings.options_data_provider,
                },
            },
            "elasticsearch": {
                "url": os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200"),
                "api_key_configured": bool(os.environ.get("ELASTICSEARCH_API_KEY")),
            },
            "database": {
                "url_scheme": settings.database_url.split("://")[0] if "://" in settings.database_url else "unknown",
            },
            "ingestion": {
                "mode": settings.ingestion_mode,
                "symbols": settings.symbols_list,
            },
        }
    
    return app


# Create default app instance
app = create_app()
