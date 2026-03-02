"""
FastAPI application for REST and WebSocket APIs.
"""

# Ensure UTF-8 everywhere on Windows (emoji in logs must not crash the process)
import sys
import io
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

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

# ── Masterplan W15-W104: 2-Year Feature Set ──
from .routes import (
    w15_cross_asset_quote,
    w16_corporate_actions,
    w17_economic_calendar,
    w18_news_enrichment,
    w19_entity_resolution,
    w20_theme_clustering,
    w21_research_notebook,
    w22_bql_query,
    w23_search_explain,
    w24_screeners,
    w25_collaboration,
    w26_research_governance,
    w27_execution_cockpit,
    w28_blotter,
    w29_pre_trade_risk,
    w30_surveillance,
    w31_attribution,
    w32_factor_model,
    w33_stress_scenarios,
    w34_pnl_explain,
    w35_reconciliation,
    w36_smart_routing,
    w37_broker_scoring,
    w38_cross_account,
    w39_risk_governance,
    w40_agent_registry,
    w41_autopilot_playbook,
    w42_prompt_firewall,
    w43_model_router,
    w44_eval_harness,
    w45_approval_queue,
    w46_strategy_sim,
    w47_signal_provenance,
    w48_incident_ai,
    w49_drift_detection,
    w50_control_tower,
    w51_policy_attestation,
    w52_ai_governance,
    w53_options_matrix,
    w54_greeks_service,
    w55_vol_surface,
    w56_payoff_lab,
    w57_spread_tools,
    w58_futures_curve,
    w59_rates_monitor,
    w60_cross_margin,
    w61_derivatives_oms,
    w62_vol_scanner,
    w63_hedge_engine,
    w64_risk_adj_exec,
    w65_derivatives_gov,
    w66_policy_code,
    w67_entitlements,
    w68_approval_chain,
    w69_evidence_vault,
    w70_retention_policy,
    w71_audit_replay,
    w72_incident_compliance,
    w73_supervisory,
    w74_kri_scoring,
    w75_third_party_risk,
    w76_sso_hardening,
    w77_jurisdiction,
    w78_control_framework,
    w79_plugin_runtime,
    w80_sdk_api,
    w81_app_sandbox,
    w82_marketplace,
    w83_partner_ci,
    w84_usage_metering,
    w85_billing_events,
    w86_ext_observability,
    w87_tenant_quota,
    w88_compat_matrix,
    w89_dev_portal,
    w90_support_sla,
    w91_marketplace_trust,
    w92_multi_region,
    w93_latency_budget,
    w94_cost_profiler,
    w95_reliability_econ,
    w96_regional_failover,
    w97_data_residency,
    w98_ops_automation_ai,
    w99_hot_path,
    w100_release_quality,
    w101_capacity_plan,
    w102_platform_debt,
    w103_operator_enable,
    w104_global_readiness,
)

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
# ── Autopilot Options (real options autopilot) ─────────────────────────────
from .routes import autopilot_options as autopilot_options_router_mod
# ── Autopilot V3 (closed-loop trading system) ───────────────────────────────
from .routes import autopilot_v3 as autopilot_v3_router_mod
# ── Reality Repair routes (Phases A-G) ─────────────────────────────────────
from .routes import ops_version            # Phase A: /api/ops/version
from .routes import ops_market_session     # Phase D: /api/ops/market_session
from .routes import ops_broker             # Phase E: /api/broker/*
# ── Ops Autopilot Health (Phase 0: Autopilot Revolution) ──────────────────
from .routes import ops_autopilot          # /api/ops/autopilot/*
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
    # ── Compat: expose /api/v1/positions and /api/v1/orders (legacy shortcuts) ──
    app.include_router(portfolio.router, prefix="/api/v1", tags=["portfolio-compat"])
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
    # ── Real BSM options chain (POST /api/v4/options/chain) ──────────────────
    from .routes.options_chain_v4 import router as options_chain_v4_router
    app.include_router(options_chain_v4_router, tags=["options-chain-v4"])
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
    # ── W01-W14 endpoint coverage for Nuclear Judge (after backtest_v2 to avoid conflict) ──
    from .routes.w01_w14_endpoints import router as w01_w14_router
    app.include_router(w01_w14_router, tags=["w01-w14-nuclear"])
    # ── W14 production dataset snapshot API ──
    from .routes.w14_dataset_api import router as w14_dataset_router
    app.include_router(w14_dataset_router, tags=["w14-dataset-snapshot"])
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
    # ── Autopilot Options (real options autopilot with Alpaca paper) ──
    app.include_router(autopilot_options_router_mod.router, tags=["autopilot-options"])
    # ── Autopilot V3 (closed-loop trading system) ──────────────────────────
    app.include_router(autopilot_v3_router_mod.router, tags=["autopilot-v3"])
    # ── Reality Repair routes (Phases A-G) ──
    app.include_router(ops_version.router, tags=["ops-version"])
    app.include_router(ops_market_session.router, tags=["ops-market-session"])
    app.include_router(ops_broker.router, tags=["ops-broker-alpaca"])
    # ── Ops Autopilot Health (Phase 0: Autopilot Revolution) ──
    app.include_router(ops_autopilot.router, tags=["ops-autopilot"])
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

    # ── Masterplan W15-W104: 2-Year Feature Set ──
    app.include_router(w15_cross_asset_quote.router, tags=["w15-cross-asset-quote"])
    app.include_router(w16_corporate_actions.router, tags=["w16-corporate-actions"])
    app.include_router(w17_economic_calendar.router, tags=["w17-economic-calendar"])
    app.include_router(w18_news_enrichment.router, tags=["w18-news-enrichment"])
    app.include_router(w19_entity_resolution.router, tags=["w19-entity-resolution"])
    app.include_router(w20_theme_clustering.router, tags=["w20-theme-clustering"])
    app.include_router(w21_research_notebook.router, tags=["w21-research-notebook"])
    app.include_router(w22_bql_query.router, tags=["w22-bql-query"])
    app.include_router(w23_search_explain.router, tags=["w23-search-explain"])
    app.include_router(w24_screeners.router, tags=["w24-screeners"])
    app.include_router(w25_collaboration.router, tags=["w25-collaboration"])
    app.include_router(w26_research_governance.router, tags=["w26-research-governance"])
    app.include_router(w27_execution_cockpit.router, tags=["w27-execution-cockpit"])
    app.include_router(w28_blotter.router, tags=["w28-blotter"])
    app.include_router(w29_pre_trade_risk.router, tags=["w29-pre-trade-risk"])
    app.include_router(w30_surveillance.router, tags=["w30-surveillance"])
    app.include_router(w31_attribution.router, tags=["w31-attribution"])
    app.include_router(w32_factor_model.router, tags=["w32-factor-model"])
    app.include_router(w33_stress_scenarios.router, tags=["w33-stress-scenarios"])
    app.include_router(w34_pnl_explain.router, tags=["w34-pnl-explain"])
    app.include_router(w35_reconciliation.router, tags=["w35-reconciliation"])
    app.include_router(w36_smart_routing.router, tags=["w36-smart-routing"])
    app.include_router(w37_broker_scoring.router, tags=["w37-broker-scoring"])
    app.include_router(w38_cross_account.router, tags=["w38-cross-account"])
    app.include_router(w39_risk_governance.router, tags=["w39-risk-governance"])
    app.include_router(w40_agent_registry.router, tags=["w40-agent-registry"])
    app.include_router(w41_autopilot_playbook.router, tags=["w41-autopilot-playbook"])
    app.include_router(w42_prompt_firewall.router, tags=["w42-prompt-firewall"])
    app.include_router(w43_model_router.router, tags=["w43-model-router"])
    app.include_router(w44_eval_harness.router, tags=["w44-eval-harness"])
    app.include_router(w45_approval_queue.router, tags=["w45-approval-queue"])
    app.include_router(w46_strategy_sim.router, tags=["w46-strategy-sim"])
    app.include_router(w47_signal_provenance.router, tags=["w47-signal-provenance"])
    app.include_router(w48_incident_ai.router, tags=["w48-incident-ai"])
    app.include_router(w49_drift_detection.router, tags=["w49-drift-detection"])
    app.include_router(w50_control_tower.router, tags=["w50-control-tower"])
    app.include_router(w51_policy_attestation.router, tags=["w51-policy-attestation"])
    app.include_router(w52_ai_governance.router, tags=["w52-ai-governance"])
    app.include_router(w53_options_matrix.router, tags=["w53-options-matrix"])
    app.include_router(w54_greeks_service.router, tags=["w54-greeks-service"])
    app.include_router(w55_vol_surface.router, tags=["w55-vol-surface"])
    app.include_router(w56_payoff_lab.router, tags=["w56-payoff-lab"])
    app.include_router(w57_spread_tools.router, tags=["w57-spread-tools"])
    app.include_router(w58_futures_curve.router, tags=["w58-futures-curve"])
    app.include_router(w59_rates_monitor.router, tags=["w59-rates-monitor"])
    app.include_router(w60_cross_margin.router, tags=["w60-cross-margin"])
    app.include_router(w61_derivatives_oms.router, tags=["w61-derivatives-oms"])
    app.include_router(w62_vol_scanner.router, tags=["w62-vol-scanner"])
    app.include_router(w63_hedge_engine.router, tags=["w63-hedge-engine"])
    app.include_router(w64_risk_adj_exec.router, tags=["w64-risk-adj-exec"])
    app.include_router(w65_derivatives_gov.router, tags=["w65-derivatives-gov"])
    app.include_router(w66_policy_code.router, tags=["w66-policy-code"])
    app.include_router(w67_entitlements.router, tags=["w67-entitlements"])
    app.include_router(w68_approval_chain.router, tags=["w68-approval-chain"])
    app.include_router(w69_evidence_vault.router, tags=["w69-evidence-vault"])
    app.include_router(w70_retention_policy.router, tags=["w70-retention-policy"])
    app.include_router(w71_audit_replay.router, tags=["w71-audit-replay"])
    app.include_router(w72_incident_compliance.router, tags=["w72-incident-compliance"])
    app.include_router(w73_supervisory.router, tags=["w73-supervisory"])
    app.include_router(w74_kri_scoring.router, tags=["w74-kri-scoring"])
    app.include_router(w75_third_party_risk.router, tags=["w75-third-party-risk"])
    app.include_router(w76_sso_hardening.router, tags=["w76-sso-hardening"])
    app.include_router(w77_jurisdiction.router, tags=["w77-jurisdiction"])
    app.include_router(w78_control_framework.router, tags=["w78-control-framework"])
    app.include_router(w79_plugin_runtime.router, tags=["w79-plugin-runtime"])
    app.include_router(w80_sdk_api.router, tags=["w80-sdk-api"])
    app.include_router(w81_app_sandbox.router, tags=["w81-app-sandbox"])
    app.include_router(w82_marketplace.router, tags=["w82-marketplace"])
    app.include_router(w83_partner_ci.router, tags=["w83-partner-ci"])
    app.include_router(w84_usage_metering.router, tags=["w84-usage-metering"])
    app.include_router(w85_billing_events.router, tags=["w85-billing-events"])
    app.include_router(w86_ext_observability.router, tags=["w86-ext-observability"])
    app.include_router(w87_tenant_quota.router, tags=["w87-tenant-quota"])
    app.include_router(w88_compat_matrix.router, tags=["w88-compat-matrix"])
    app.include_router(w89_dev_portal.router, tags=["w89-dev-portal"])
    app.include_router(w90_support_sla.router, tags=["w90-support-sla"])
    app.include_router(w91_marketplace_trust.router, tags=["w91-marketplace-trust"])
    app.include_router(w92_multi_region.router, tags=["w92-multi-region"])
    app.include_router(w93_latency_budget.router, tags=["w93-latency-budget"])
    app.include_router(w94_cost_profiler.router, tags=["w94-cost-profiler"])
    app.include_router(w95_reliability_econ.router, tags=["w95-reliability-econ"])
    app.include_router(w96_regional_failover.router, tags=["w96-regional-failover"])
    app.include_router(w97_data_residency.router, tags=["w97-data-residency"])
    app.include_router(w98_ops_automation_ai.router, tags=["w98-ops-automation-ai"])
    app.include_router(w99_hot_path.router, tags=["w99-hot-path"])
    app.include_router(w100_release_quality.router, tags=["w100-release-quality"])
    app.include_router(w101_capacity_plan.router, tags=["w101-capacity-plan"])
    app.include_router(w102_platform_debt.router, tags=["w102-platform-debt"])
    app.include_router(w103_operator_enable.router, tags=["w103-operator-enable"])
    app.include_router(w104_global_readiness.router, tags=["w104-global-readiness"])

    
    # ── ElastiHack: Unified ES Excellence Router (Waves 001-070) ──
    from .routes import elastihack
    app.include_router(elastihack.router, tags=["elastihack"])
    
    # ── Market Quote (live prices for judge) ──
    from .routes.market_quote import router as market_quote_router
    app.include_router(market_quote_router, tags=["market-quote"])
    
    # ── v4 Engines: TA, Options, Risk, Screener, Portfolio, Backtest ──────────
    try:
        from .routes import ta_indicators_v4, options_v4, risk_v4, screener_v4, portfolio_v4, backtest_v4
        app.include_router(ta_indicators_v4.router, tags=["ta-indicators-v4"])
        app.include_router(options_v4.router,       tags=["options-v4"])
        app.include_router(risk_v4.router,          tags=["risk-v4"])
        app.include_router(screener_v4.router,      tags=["screener-v4"])
        app.include_router(portfolio_v4.router,     tags=["portfolio-v4"])
        app.include_router(backtest_v4.router,       tags=["backtest-v4"])
    except Exception as _v4_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"v4 engine routes not loaded: {_v4_err}")

    # ── v5 Advanced TA Engine: Candlestick, Volume Profile, Fibonacci, Order Flow ──
    try:
        from .routes import ta_indicators_v5
        app.include_router(ta_indicators_v5.router, tags=["ta-indicators-v5"])
    except Exception as _v5_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"v5 TA routes not loaded: {_v5_err}")

    # ── Chart Annotations Engine: drawings, Fibonacci, Pitchfork, Gann, groups, undo/redo ──
    try:
        from .routes import chart_annotations
        app.include_router(chart_annotations.router, tags=["chart-annotations"])
    except Exception as _ann_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Chart annotations routes not loaded: {_ann_err}")

    # ── Market Data v2: tick processing, bar aggregation, book analysis, breadth, VWAP ──
    try:
        from .routes import market_data_v2
        app.include_router(market_data_v2.router, tags=["market-data-v2"])
    except Exception as _md2_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Market data v2 routes not loaded: {_md2_err}")

    # ── Portfolio Analytics: performance metrics, optimization, attribution, risk budgeting ──
    try:
        from .routes import portfolio_analytics
        app.include_router(portfolio_analytics.router, tags=["portfolio-analytics"])
    except Exception as _pa_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Portfolio analytics routes not loaded: {_pa_err}")

    # ── Risk Management: sizing, exposure, margin, Greeks, scenarios, compliance ──
    try:
        from .routes import risk_management
        app.include_router(risk_management.router, tags=["risk-management"])
    except Exception as _rm_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Risk management routes not loaded: {_rm_err}")

    # ── Options Pricing: BS, binomial, MC, IV, vol surface, chains, strategies, exotics ──
    try:
        from .routes import options_pricing
        app.include_router(options_pricing.router, tags=["options-pricing"])
    except Exception as _op_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Options pricing routes not loaded: {_op_err}")

    # ── Scanner: predefined scans, composite, custom filters ──
    try:
        from .routes import scanner
        app.include_router(scanner.router, tags=["scanner"])
    except Exception as _sc_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Scanner routes not loaded: {_sc_err}")

    # ── Alert System v2: price/volume/indicator/portfolio/news alerts, scheduling ──
    try:
        from .routes import alert_system
        app.include_router(alert_system.router, tags=["alert-system-v2"])
    except Exception as _as_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Alert system v2 routes not loaded: {_as_err}")

    # ── Watchlists: CRUD, quotes, sort, filter, analytics, heatmaps ──
    try:
        from .routes import watchlists
        app.include_router(watchlists.router, tags=["watchlists"])
    except Exception as _wl_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Watchlists routes not loaded: {_wl_err}")

    # ── News & Sentiment: ingestion, analysis, aggregation, impact ──
    try:
        from .routes import news_sentiment
        app.include_router(news_sentiment.router, tags=["news-sentiment"])
    except Exception as _ns_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"News sentiment routes not loaded: {_ns_err}")

    # ── Order Management: orders, fills, positions, analytics ──
    try:
        from .routes import order_management
        app.include_router(order_management.router, tags=["order-management"])
    except Exception as _om_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Order management routes not loaded: {_om_err}")

    # ── Execution: algos, simulation, cost analysis ──
    try:
        from .routes import execution
        app.include_router(execution.router, tags=["execution"])
    except Exception as _ex_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Execution routes not loaded: {_ex_err}")

    # ── Backtesting v2: strategies, walk-forward, Monte Carlo, multi-strategy ──
    try:
        from .routes import backtesting_v2_routes
        app.include_router(backtesting_v2_routes.router, tags=["backtesting-v2"])
    except Exception as _bt2_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Backtesting v2 routes not loaded: {_bt2_err}")

    # ── Charting Calculations: Heikin Ashi, Renko, Kagi, VWAP, Pivots, Ichimoku ──
    try:
        from .routes import charting_calculations
        app.include_router(charting_calculations.router, tags=["charting-calculations"])
    except Exception as _cc_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Charting calculations routes not loaded: {_cc_err}")

    # ── Correlation Analysis: matrix, rolling, PCA, beta, lead-lag, regime ──
    try:
        from .routes import correlation_analysis
        app.include_router(correlation_analysis.router, tags=["correlation-analysis"])
    except Exception as _ca_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Correlation analysis routes not loaded: {_ca_err}")

    # ── Economic Calendar: surprise, impact, earnings, seasonal, events ──
    try:
        from .routes import economic_calendar_v2
        app.include_router(economic_calendar_v2.router, tags=["economic-calendar-v2"])
    except Exception as _ec_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Economic calendar v2 routes not loaded: {_ec_err}")

    # ── Market Replay: sessions, aggregation, orderbook, trade sim ──
    try:
        from .routes import market_replay
        app.include_router(market_replay.router, tags=["market-replay"])
    except Exception as _mr_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Market replay routes not loaded: {_mr_err}")

    # ── Pattern Recognition: candlestick, chart, S/R, trend lines ──
    try:
        from .routes import pattern_recognition
        app.include_router(pattern_recognition.router, tags=["pattern-recognition"])
    except Exception as _pr_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Pattern recognition routes not loaded: {_pr_err}")

    # ── Multi-Asset Analysis: cross-asset, carry trade, yield curve, macro ──
    try:
        from .routes import multi_asset_analysis
        app.include_router(multi_asset_analysis.router, tags=["multi-asset-analysis"])
    except Exception as _maa_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Multi-asset analysis routes not loaded: {_maa_err}")

    # ── Heat Map: sector treemaps, correlation, performance, volume, breadth ──
    try:
        from .routes import heat_map
        app.include_router(heat_map.router, tags=["heat-map"])
    except Exception as _hm_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Heat map routes not loaded: {_hm_err}")

    # ── UI2 Heatmap + Fixed-Income compat routes ──
    try:
        from .routes import heatmap_compat
        app.include_router(heatmap_compat.router, tags=["ui2-compat"])
    except Exception as _hc_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"UI2 compat routes not loaded: {_hc_err}")

    # ── Volatility Surface: BS pricing, IV, hist vol, surface, Greeks, regime ──
    try:
        from .routes import volatility_surface
        app.include_router(volatility_surface.router, tags=["volatility-surface"])
    except Exception as _vs_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Volatility surface routes not loaded: {_vs_err}")

    # ── Position Sizing: Kelly, percent risk, ATR, optimal-f, portfolio heat ──
    try:
        from .routes import position_sizing
        app.include_router(position_sizing.router, tags=["position-sizing"])
    except Exception as _ps_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Position sizing routes not loaded: {_ps_err}")

    # ── Trade Journal: logging, performance, streaks, R-multiples, discipline ──
    try:
        from .routes import trade_journal
        app.include_router(trade_journal.router, tags=["trade-journal"])
    except Exception as _tj_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Trade journal routes not loaded: {_tj_err}")

    # ── Market Breadth: A/D, McClellan, TRIN, Hindenburg, thrust, rotation ──
    try:
        from .routes import market_breadth
        app.include_router(market_breadth.router, tags=["market-breadth"])
    except Exception as _mb_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Market breadth routes not loaded: {_mb_err}")

    # ── Statistical Arbitrage: pairs screening, cointegration, signals, backtest ──
    try:
        from .routes import statistical_arb
        app.include_router(statistical_arb.router, tags=["statistical-arb"])
    except Exception as _sa_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Statistical arb routes not loaded: {_sa_err}")

    # ── Regime Detection: market/vol/trend/momentum regimes, breaks, strategy ──
    try:
        from .routes import regime_detection
        app.include_router(regime_detection.router, tags=["regime-detection"])
    except Exception as _rd_err:
        import logging as _logging
        _logging.getLogger(__name__).warning(f"Regime detection routes not loaded: {_rd_err}")

    # ── Nuclear Compatibility endpoints (backtest aliases, indicators, etc.) ──
    from .routes.nuclear_compat import router as nuclear_compat_router
    app.include_router(nuclear_compat_router, tags=["nuclear-compat"])
    
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
