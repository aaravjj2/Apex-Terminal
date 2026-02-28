# Apex Terminal — Comprehensive Codebase Audit Report

**Date:** 2026-02-20  
**Scope:** `/home/aarav/Aarav/Tradingview recreation` (non-venv, non-node_modules)  
**Type:** Research only — no files modified

---

## 1. DEMO / MOCK / FIXTURE / SYNTHETIC DATA

### 1A. Core Demo Data Layer (RUNTIME — used in production UI)

| File | Type | Description | Action |
|------|------|-------------|--------|
| `frontend/src/ui2/demo/demoStore.ts` | Runtime | Master demo store: DEMO_INSTRUMENTS, positions, orders, trades, alerts, etc. | **REPLACE** with live API calls |
| `frontend/src/ui2/demo/constants.ts` | Runtime | Fixed DEMO_TIMESTAMP (2026-02-15T14:30:00Z), DEMO_USER, DEMO_MARKET_STATUS, DEMO_WS_STATUS | **DELETE** |
| `frontend/src/ui2/demo/canonicalDemo.ts` | Runtime | BASE_PRICES, DEMO_QUOTES for SPY/AAPL/TSLA/NVDA/MSFT — single source of truth for all demo values | **DELETE** |
| `frontend/src/ui2/demo/demoHooks.ts` | Runtime | React hooks that consume demoStore | **REPLACE** with live data hooks |
| `frontend/src/ui2/demo/fixtures.ts` | Runtime | UI2 fixture data used in demo mode | **DELETE** |
| `frontend/src/ui2/stores/streamSimulator.ts` | Runtime | Deterministic PRNG (Mulberry32, seed=42) stream simulator generating fake ticks for 5 symbols | **REPLACE** with real WebSocket feed |
| `phase1/services/market_data/providers/demo_provider.py` | Runtime | DemoProvider class: loads bars from CSV fixtures (phase1/data/equity/*.csv) with replay-first policy | **REPLACE** with real provider (Yahoo/Polygon) |
| `phase1/services/ingestion/connectors/mock.py` | Runtime | MockConnector: reads ticks from CSV files for deterministic replay | **REPLACE** or gate behind test-only flag |
| `phase1/services/automation/strategies/mock_strategy.py` | Runtime | MockStrategy: random walk demo strategy generating random buy/sell signals | **DELETE** |
| `phase1/services/backtest_engine/fixtures.py` | Runtime | `generate_demo_bars()`: random.seed(42) OHLCV bar generator for backtesting | **REPLACE** with real historical data loader |
| `phase1/services/portfolio/fixtures.py` | Runtime | `create_demo_fixtures()`: hardcoded DEMO-PORT-001/002 portfolios with fixed positions/lots | **DELETE** (use user-created portfolios) |

### 1B. Backend API Routes with Hardcoded Demo Data (RUNTIME)

| File | Type | Description | Action |
|------|------|-------------|--------|
| `phase1/services/api/routes/search.py` | Runtime | In-memory DEMO_INDEX with 10+ hardcoded search entries — no external search backend | **REPLACE** with Elasticsearch |
| `phase1/services/api/routes/search_depth.py` | Runtime | Pure deterministic demo endpoints, Elasticsearch OFF by default, hardcoded provider status | **REPLACE** |
| `phase1/services/api/routes/agents.py` | Runtime | Demo agent data | **REPLACE** |
| `phase1/services/api/routes/attribution.py` | Runtime | Demo attribution data | **REPLACE** |
| `phase1/services/api/routes/audit_log.py` | Runtime | Demo audit log entries | **REPLACE** |
| `phase1/services/api/routes/autopilot.py` | Runtime | Contains demo/mock data | **REPLACE** |
| `phase1/services/api/routes/cache.py` | Runtime | Demo cache entries | **REPLACE** |
| `phase1/services/api/routes/citations.py` | Runtime | Demo citations | **REPLACE** |
| `phase1/services/api/routes/correlation.py` | Runtime | Demo correlation data | **REPLACE** |
| `phase1/services/api/routes/data_quality.py` | Runtime | Demo data quality metrics | **REPLACE** |
| `phase1/services/api/routes/journal.py` | Runtime | Demo journal entries | **REPLACE** |
| `phase1/services/api/routes/market_data.py` | Runtime | Demo market data | **REPLACE** |
| `phase1/services/api/routes/notifications.py` | Runtime | Demo notifications | **REPLACE** |
| `phase1/services/api/routes/platform_health.py` | Runtime | Demo platform health data | **REPLACE** |
| `phase1/services/api/routes/provider_registry.py` | Runtime | Demo provider registry | **REPLACE** |
| `phase1/services/api/routes/risk_desk.py` | Runtime | Demo risk data | **REPLACE** |
| `phase1/services/api/routes/risk_scenarios.py` | Runtime | Demo risk scenarios | **REPLACE** |
| `phase1/services/api/routes/strategy_compare.py` | Runtime | Demo strategy comparison data | **REPLACE** |
| `phase1/services/api/routes/watchlist.py` | Runtime | Demo watchlist data | **REPLACE** |
| `phase1/services/api/routes/ingest.py` | Runtime | Contains mock references | **REPLACE** |
| `phase1/services/api/routes/market_data_v1_13.py` | Runtime | Contains demo data | **REPLACE** |

### 1C. Frontend Components with Inline Demo Data (RUNTIME)

These components contain hardcoded demo/mock data inline (not from demoStore):

| File | Description |
|------|-------------|
| `frontend/src/features/dashboard/FinancialIntelligenceDashboard.tsx` | Inline mock data |
| `frontend/src/features/dashboard/MultiAgentFinancePanel.tsx` | Inline mock data |
| `frontend/src/features/dashboard/RealTimePnLAnalytics.tsx` | Inline mock data |
| `frontend/src/features/chart/ChartCanvas.tsx` | Demo price references |
| `frontend/src/features/chart/SupergraphChart.tsx` | Demo data |
| `frontend/src/features/backtest/BacktestPanel.tsx` | Demo backtest data |
| `frontend/src/features/search/SearchPanel.tsx` | Demo search data |
| `frontend/src/features/orders/OrdersBlotter.tsx` | Demo orders |
| `frontend/src/features/portfolio/EnhancedPortfolioView.tsx` | Demo portfolio |
| `frontend/src/features/portfolio/PortfolioCrudPanel.tsx` | Demo portfolios |
| `frontend/src/features/portfolio/PortfolioValuationCards.tsx` | Demo valuations |
| `frontend/src/features/options/riskDesk/RiskDeskPanel.tsx` | Demo risk desk data |
| `frontend/src/features/options/strategyLab/StrategyLabPanel.tsx` | Demo strategy data |
| `frontend/src/features/options/components/IVAnalyticsPanel.tsx` | Demo IV data |
| `frontend/src/features/trading/tiles/ChartTile.tsx` | Demo chart data |
| `frontend/src/features/trading/tiles/VolSurfaceTile.tsx` | Demo vol surface |
| `frontend/src/features/watchlist/WatchlistPanel.tsx` | Demo watchlist |
| `frontend/src/features/autopilot/api.ts` | Demo autopilot API |
| `frontend/src/features/autopilot/components/AdvancedAutopilotPanel.tsx` | Demo autopilot |
| `frontend/src/features/data/providers.ts` | Demo provider list |
| `frontend/src/features/data/DataSourceSelector.tsx` | Demo data sources |
| `frontend/src/ui2/stores/autopilotStore.ts` | Demo autopilot state |
| `frontend/src/ui2/stores/autopilotV2Store.ts` | Demo autopilot v2 state |
| `frontend/src/ui2/stores/autopilot2Store.ts` | Demo autopilot state |
| `frontend/src/ui2/stores/agentStore.ts` | Demo agent state |
| `frontend/src/ui2/stores/automationStore.ts` | Demo automation state |
| `frontend/src/ui2/stores/automationV2Store.ts` | Demo automation v2 state |
| `frontend/src/ui2/stores/exportStore.ts` | Demo export state |
| `frontend/src/ui2/stores/insightsStore.ts` | Demo insights |
| `frontend/src/ui2/stores/llmProviderStore.ts` | Demo LLM provider |
| `frontend/src/ui2/stores/orderTicketStore.ts` | Demo order ticket |
| `frontend/src/ui2/stores/platformHealthStore.ts` | Demo health data |
| `frontend/src/ui2/stores/scenarioStore.ts` | Demo scenario data |
| `frontend/src/ui2/stores/searchStore.ts` | Falls back to local in-memory DEMO_ENTITIES search |
| `frontend/src/ui2/stores/telemetryStore.ts` | Demo telemetry |
| `frontend/src/ui2/stores/wave1314Store.ts` | Demo wave 13-14 data |
| `frontend/src/ui2/stores/wave18Store.ts` | Demo wave 18 data |
| `frontend/src/ui2/components/MarketTape.tsx` | Demo market tape |
| `frontend/src/ui2/pages/DashboardUI2.tsx` | Demo dashboard |
| `frontend/src/ui2/pages/BacktestUI2.tsx` | Demo backtest |
| `frontend/src/ui2/pages/AutopilotExplainUI2.tsx` | Demo autopilot explain |
| `frontend/src/ui2/pages/ExportUI2.tsx` | Demo export |
| `frontend/src/ui2/pages/OpsUI2.tsx` | Demo ops |
| `frontend/src/ui2/pages/ResearchUI2.tsx` | Demo research |
| `frontend/src/ui2/pages/SettingsUI2.tsx` | Demo settings |
| `frontend/src/ui2/pages/TelemetryUI2.tsx` | Demo telemetry |

### 1D. Fixture Data Files (KEEP for testing, REMOVE from production data path)

| Path | Type |
|------|------|
| `phase1/fixtures/aapl_test_bars.csv` | Test fixture |
| `phase1/fixtures/aapl_test_bars.sha256` | Test fixture checksum |
| `phase1/fixtures/aapl_test_ticks.csv` | Test fixture |
| `phase1/fixtures/msft_test_ticks.csv` | Test fixture |
| `phase1/tests/fixtures/aapl_test_bars.csv` | Test fixture (duplicate) |
| `phase1/tests/fixtures/aapl_test_bars.sha256` | Test fixture checksum |
| `phase1/tests/fixtures/aapl_test_ticks.csv` | Test fixture |
| `phase1/tests/fixtures/msft_test_ticks.csv` | Test fixture |
| `phase1/services/risk_desk/fixtures/demo_portfolio.csv` | Risk desk demo data |
| `phase1/services/risk_desk/fixtures/demo_snapshot.json` | Risk desk demo snapshot |
| `frontend/tests/e2e/demo-fixtures.ts` | E2E test fixtures |
| `frontend/tests/e2e/waves1-5/fixtures.ts` | E2E test fixtures |
| `frontend/tests/e2e/fixtures/beep.mp3` | Test fixture |
| `frontend/tests/test-results-risk-desk/fixtures/*.csv` | Test result fixtures |

### 1E. Backend Service Files with Demo References (RUNTIME)

| File | Description |
|------|-------------|
| `phase1/services/config.py` | `ingestion_mode: Literal["mock", "live"]` default="live" — config toggle |
| `phase1/services/autopilot/candidates.py` | Contains demo references |
| `phase1/services/autopilot/strategy_templates.py` | Contains demo references |
| `phase1/services/autopilot/v1_providers.py` | Contains demo references |
| `phase1/services/autopilot/alpaca_client.py` | Contains mock references |
| `phase1/services/autopilot/decision/models.py` | Contains demo references |
| `phase1/services/ingestion/normalizer.py` | Mock references |
| `phase1/services/ingestion/connectors/finnhub_connector.py` | References mock |
| `phase1/services/ingestion/connectors/yfinance_connector.py` | References mock |
| `phase1/services/market_data/providers/__init__.py` | Registers demo provider |
| `phase1/services/market_data/providers/types.py` | Contains DEMO in ProviderName enum |
| `phase1/services/market_data/record_replay.py` | Replay/recording system |
| `phase1/services/risk_desk/*.py` | Multiple files with demo/mock data |
| `phase1/services/portfolio/pricing.py` | Demo pricing |
| `phase1/services/portfolio/store.py` | Demo store |
| `phase1/services/portfolio/valuation.py` | Demo valuation |
| `phase1/services/ticker/service.py` | Demo ticker |
| `phase1/services/api/ticker_resolver.py` | Demo resolver |

### 1F. Standalone Scripts with Demo Data (UTILITY — low priority)

| File | Type |
|------|------|
| `capture_comprehensive_demo.js` | Demo capture script |
| `check_determinism.py` | Determinism validation |
| `colab_readme_generator.py` | Docs generator |
| `scripts/determinism_proof.py` | Proof script |
| `scripts/determinism_proof_v1_12.py` | Proof script |
| `scripts/determinism_proof_v1_13.py` | Proof script |
| `scripts/verify_portfolio_determinism.py` | Proof script |
| `phase1/scripts/generate_fixtures.py` | Fixture generator |
| `phase1/scripts/parity_compare.py` | Parity comparison |
| `phase1/scripts/run_mock.py` | Mock runner |

---

## 2. SEARCH BACKENDS

### 2A. Current Implementation

| Component | Location | Description |
|-----------|----------|-------------|
| **In-memory DEMO search (backend)** | `phase1/services/api/routes/search.py` | Hardcoded `DEMO_INDEX` list with ~10 entries; simple string matching; NO external dependency |
| **Search depth route** | `phase1/services/api/routes/search_depth.py` | Returns `elastic_configured: false`, `elastic_url: null`; pure deterministic demo |
| **Elasticsearch gateway** | `phase1/services/api/routes/elasticsearch_gateway.py` | Lazy-imports `elasticsearch` Python package; routes at `/api/v1/elasticsearch/{search,status,hash}`; returns 503 if `elasticsearch-py` not installed |
| **Frontend local search** | `frontend/src/ui2/stores/searchStore.ts` L172-173 | Falls back to local in-memory `DEMO_ENTITIES.filter()` when API call fails |
| **Frontend search depth store** | `frontend/src/ui2/stores/searchDepthStore.ts` | `SearchProvider = 'local' | 'elastic'`; defaults to local |
| **Elasticsearch UI page** | `frontend/src/ui2/pages/ElasticsearchUI2.tsx` | Dedicated page: connects to `elasticsearchStore` from waveStores |
| **Elasticsearch store** | `frontend/src/ui2/stores/waveStores.ts` L220+ | Fetches from `/api/v1/elasticsearch/search` and `/api/v1/elasticsearch/status` |

### 2B. Search Config (Playwright)

| File | Description |
|------|-------------|
| `frontend/playwright.waves6-10.config.ts` | Checks `SEARCH_PROVIDER=elastic && ELASTIC_API_KEY`; has `elastic_local` project |

### 2C. Non-Elastic Fallbacks to Remove

| Location | Action |
|----------|--------|
| `phase1/services/api/routes/search.py` → DEMO_INDEX | **REPLACE** with Elasticsearch query |
| `frontend/src/ui2/stores/searchStore.ts` → local DEMO_ENTITIES filter | **REPLACE** with Elasticsearch API |
| `frontend/src/ui2/stores/searchDepthStore.ts` → default local | **CHANGE** default to elastic |

---

## 3. UI2 PAGES & NAVIGATION

### 3A. Navigation Rail (AppShellUI2.tsx — WORKSPACES array)

30 nav items in the sidebar rail:

| # | Label | Path | Core? |
|---|-------|------|-------|
| 1 | Dashboard | `/ui2/dashboard` | **CORE** |
| 2 | Trading | `/ui2/trading` | **CORE** |
| 3 | Portfolio | `/ui2/portfolio` | **CORE** |
| 4 | Orders | `/ui2/orders` | **CORE** |
| 5 | Risk & Options | `/ui2/risk` | **CORE** |
| 6 | Research | `/ui2/research` | **CORE** |
| 7 | Backtest | `/ui2/backtest` | **CORE** |
| 8 | Autopilot | `/ui2/autopilot` | **CORE** |
| 9 | Alerts | `/ui2/alerts` | CORE |
| 10 | Replay | `/ui2/replay` | CORE |
| 11 | Runs & Audit | `/ui2/runs` | Non-core (hide) |
| 12 | Ops | `/ui2/ops` | Non-core (hide) |
| 13 | Settings | `/ui2/settings` | CORE |
| 14 | Automation | `/ui2/automation` | **CORE** (Workflows/Agents) |
| 15 | Search | `/ui2/search` | **CORE** |
| 16 | AI Agent | `/ui2/agent` | **CORE** (Agents) |
| 17 | Autopilot V2 | `/ui2/autopilot-v2` | Non-core (duplicate) |
| 18 | Automation V2 | `/ui2/automation-v2` | Non-core (duplicate) |
| 19 | Export | `/ui2/export` | Non-core (hide) |
| 20 | Health | `/ui2/health` | Non-core (hide) |
| 21 | Telemetry | `/ui2/telemetry` | Non-core (hide) |
| 22 | Explain | `/ui2/autopilot-explain` | Non-core (fold into Autopilot) |
| 23 | Automation Runs | `/ui2/automation-runs` | Non-core (fold into Automation) |
| 24 | Workflow Builder | `/ui2/workflow-builder` | **CORE** (Workflows) |
| 25 | Incidents | `/ui2/incidents` | Non-core (hide) |
| 26 | Decisions | `/ui2/decisions` | Non-core (hide) |
| 27 | Health V4 | `/ui2/health-v4` | Non-core (duplicate) |
| 28 | AI Provider | `/ui2/ai-provider` | Non-core (hide) |
| 29 | Decision V2 | `/ui2/decision-explainer` | Non-core (duplicate) |
| 30 | NL Workflow | `/ui2/nl-workflow` | Non-core (hide) |

### 3B. Routes WITHOUT Nav Entries (routable but not in sidebar)

26 additional routes exist in `routes.tsx` but are NOT in the `WORKSPACES` nav array:

| Route | Wave | Category |
|-------|------|----------|
| `alt-data` | New Wave 8 | Non-core |
| `anomalies` | New Wave 7 | Non-core |
| `compliance` | Wave 10 | Non-core |
| `elasticsearch` | Wave 7 | Non-core (fold into Search) |
| `hedge-fund` | New Wave 10 | Non-core |
| `kill-switch-recovery` | Wave 9 | Non-core |
| `liquidity` | New Wave 9 | Non-core |
| `market-hours` | Wave 9 | Non-core |
| `microstructure` | New Wave 9 | Non-core |
| `monte-carlo` | Wave 6 | Non-core |
| `nova` | Wave 8 | Non-core (fold into AI Agent) |
| `observability` | Wave 10 | Non-core |
| `performance` | Wave 10 | Non-core |
| `policy-signal` | New Wave 10 | Non-core |
| `portfolio-optimizer` | New Wave 7 | Non-core |
| `regime` | Wave 6 | Non-core |
| `risk-network` | New Wave 10 | Non-core |
| `sandbox-runner` | New Wave 7 | Non-core |
| `scenario-sim` | New Wave 8 | Non-core |
| `scoring` | Wave 6 | Non-core |
| `sentiment` | Wave 6 | Non-core |
| `signal-market` | New Wave 8 | Non-core |
| `strategy-optimizer` | New Wave 6 | Non-core |
| `system-health` | Wave 9 | Non-core |
| `walk-forward` | Wave 6 | Non-core |

### 3C. Summary: Core Pages (keep visible)

1. **Dashboard** — main overview
2. **Trading** — chart + order entry
3. **Portfolio** — positions & valuation
4. **Orders** — order management
5. **Risk & Options** — greeks, risk desk
6. **Research** / **Backtest** — strategies, backtester
7. **Autopilot** — autonomous trading agent
8. **Search** — unified search
9. **Automation** / **Workflow Builder** — workflow/agent pipelines
10. **AI Agent** — LLM assistant
11. **Alerts** — alert management
12. **Replay** — historical replay
13. **Settings** — configuration

---

## 4. DATABASE SETUP

### 4A. ORM / Engine

- **SQLAlchemy** (async + sync) with `declarative_base()`
- Default DB URL: `sqlite+aiosqlite:///./phase1.db` (from `phase1/services/config.py` L30)
- Docker: `postgresql://{user}:{pass}@db:5432/{dbname}` (Postgres 15-Alpine)
- No **Alembic** migrations found — tables auto-created via `Base.metadata.create_all()`

### 4B. SQLAlchemy Models / Tables

| Model | Table | File | Description |
|-------|-------|------|-------------|
| `BarRecord` | `bars` | `phase1/services/persistence/__init__.py` L30-63 | OHLCV bar storage: symbol, timeframe, bar_index, OHLCV, volume, state, tick_count, bar_hash |
| `RawTickRecord` | `raw_ticks` | `phase1/services/persistence/__init__.py` L116-133 | Raw tick storage: source, symbol, ts_ms, price, size, tick_hash |
| `AutopilotRun` | `autopilot_runs` | `phase1/services/autopilot/autopilot_models.py` L52-85 | Autopilot execution runs |
| `AutopilotCandidate` | `autopilot_candidates` | `phase1/services/autopilot/autopilot_models.py` L87-122 | Trade candidates |
| `AutopilotOrder` | `autopilot_orders` | `phase1/services/autopilot/autopilot_models.py` L124-160 | Order records |
| `AutopilotPosition` | `autopilot_positions` | `phase1/services/autopilot/autopilot_models.py` L162-204 | Position tracking |
| `AutopilotIncident` | `autopilot_incidents` | `phase1/services/autopilot/autopilot_models.py` L206-230 | Incident records |
| `LLMLog` | `autopilot_llm_logs` | `phase1/services/autopilot/autopilot_models.py` L232+ | LLM call audit logs |
| `StrategyVersion` | `strategy_versions` | `phase1/services/persistence/version_store.py` L16-31 | Strategy version control |

### 4C. Additional DB Usage

- `phase1/services/tts/client.py` — uses raw `sqlite3` for TTS audio cache (`CACHE_DB_PATH`)
- `phase1/services/persistence/repository.py` — async repository with both SQLite and PostgreSQL dialect support (sqlite_insert / pg_insert)

---

## 5. DOCKER COMPOSE FILES

### 5A. File Inventory

| File | Services |
|------|----------|
| `docker-compose.unified.yml` | `db` (postgres:15-alpine, port 5432), `api` (port 8000), `n8n` (port 5678), `frontend` (implied) |
| `phase1/docker-compose.yml` | `db` (postgres:15-alpine, port 5432), `api` (port 7500), `ingestion` (mock mode default) |
| `n8n/docker-compose.yml` | `n8n` standalone (port 5678) |
| `phase1/n8n/docker-compose.yml` | `n8n` (duplicate) |

### 5B. Key Docker Settings

- **Postgres**: User=`dashboard_user`, DB=`financial_dashboard`, port 5432
- **API**: Exposes 8000 (unified) or 7500 (phase1)
- **Ingestion**: `INGESTION_MODE=${INGESTION_MODE:-mock}` — defaults to MOCK
- **n8n**: Port 5678, TZ=America/New_York, auth disabled for local dev

---

## 6. ENVIRONMENT VARIABLES (keys.env.example)

```
# Market data
FINNHUB_API_KEY
FINNHUB2_API_KEY
POLYGON_API_KEY
TIINGO_API_KEY

# LLM providers
GROQ_API_KEY
GROQ_MODEL=groq/compound
GEMINI_API_KEY
GEMINI_MODEL=gemini-1.5-flash
LLM_MODE=hybrid

# Broker / Trading
APCA_API_KEY_ID (Alpaca)
APCA_API_SECRET_KEY (Alpaca)
TRADIER_BROKERAGE_KEY

# Database
POSTGRES_USER=dashboard_user
POSTGRES_PASSWORD
POSTGRES_DB=financial_dashboard
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

**Missing from keys.env.example** (but used in code):
- `SEARCH_PROVIDER` (elastic/local)
- `ELASTIC_API_KEY`
- `APCA_ENDPOINT` (defaults to paper-api.alpaca.markets)
- `ELEVENLABS_API_KEY` (TTS)
- `N8N_*` settings

---

## 7. TEST STRUCTURE

### 7A. Test Directory Summary

| Directory | File Count | Language |
|-----------|-----------|----------|
| `phase1/tests/` | **86 .py** | Python |
| `tests/` | **36 .py** | Python |
| `frontend/tests/` | **136 .ts/.tsx** | TypeScript |
| `frontend/src/ui2/__tests__/` | **3 .ts/.tsx** | TypeScript |
| **Total** | **261 test files** | |

### 7B. Test Categories

**Python Backend Tests (phase1/tests/):**
- `unit/` — 38 files: bar engine, indicators, chart, risk desk, normalizer, autopilot, etc.
- `integration/` — 6 files: automation API, autopilot API, forecast API, pipeline, autopilot smoke
- `parity/` — 1 file: determinism parity verification
- `api/` — 2 files: strategies API, options routes
- Root level — 14 files: milestones 1-4, contract tests, v1 providers, patterns, market tape

**Python Root Tests (tests/):**
- `unit/` — 20 files: portfolio, risk desk, persistence, market data, fill simulator, depth routes
- `integration/` — 2 files: determinism, market data API
- Root level — 6 files: backtest export, risk desk export, strategy backtest, QC harness, UI smoke

**Frontend E2E Tests (frontend/tests/e2e/):**
- ~90 spec files covering: autopilot, backtest, portfolio, risk desk, UI2 waves 1-10, visual regression, captures
- `waves1-5/` — 5 wave-specific specs + fixtures
- `waves6-10/` — 5 wave-specific specs + preflight
- `core/` — 6 core regression specs (autopilot, backtest, search, workflow, depth, regression-smoke)
- `tour/` — 2 tour specs

**Frontend Unit Tests (frontend/tests/unit/):**
- 17 files: chart engine, indicators, providers, search store, state store, telemetry, watchlist, citations, wave stores

### 7C. Tests Using Demo/Mock Data

Nearly **ALL** tests use demo/mock data since the codebase has no real data integration tests. Key files:

| Test File | Mock Type |
|-----------|-----------|
| `frontend/tests/e2e/demo-fixtures.ts` | Shared e2e demo fixture data |
| `frontend/tests/e2e/waves1-5/fixtures.ts` | Wave-specific demo fixtures |
| `frontend/src/ui2/__tests__/demoStore.test.ts` | Tests the demo store itself |
| `frontend/tests/unit/no-fake-kpis.test.ts` | Validates KPIs are not fake (meta-test) |
| `frontend/tests/unit/providers.test.ts` | Tests demo providers |
| `phase1/tests/conftest.py` | Creates `sqlite+aiosqlite:///:memory:` DB for all tests |
| `phase1/tests/integration/test_pipeline.py` | Uses in-memory SQLite |
| `phase1/tests/unit/test_risk_desk.py` | Mock risk desk data |
| `tests/unit/test_market_data_providers.py` | Tests demo provider |
| `tests/unit/test_record_replay_v1_13.py` | Tests replay system |
| `tests/unit/test_replay_service.py` | Tests replay service |
| `tests/unit/phase4/test_fill_simulator.py` | Mock fill simulator |

---

## 8. API ROUTES INVENTORY

78 route files in `phase1/services/api/routes/`:

**Core Trading:** `autopilot.py`, `autopilot_depth.py`, `backtest.py`, `backtest_depth.py`, `bars.py`, `market_data.py`, `market_data_v1_13.py`, `portfolio.py`, `strategies.py`, `strategy_lab.py`, `strategy_artifacts.py`, `strategy_compare.py`, `strategy_optimizer.py`, `ticker.py`, `watchlist.py`, `alerts.py`, `automation.py`, `orders` (implied)

**Risk/Options:** `risk_desk.py`, `risk_scenarios.py`, `risk_network.py`, `options.py`, `correlation.py`

**Search:** `search.py`, `search_depth.py`, `elasticsearch_gateway.py`

**Intelligence:** `agents.py`, `nova.py`, `forecast.py`, `intelligence.py`, `scoring.py`, `sentiment.py`, `regime.py`, `monte_carlo.py`, `walk_forward.py`, `anomalies.py`, `microstructure.py`, `liquidity.py`

**Operations:** `platform_health.py`, `system_health.py`, `observability.py`, `cache.py`, `incidents.py`, `kill_switch_recovery.py`, `market_hours.py`, `compliance.py`, `performance_analytics.py`

**Data:** `ingest.py`, `data_quality.py`, `provider_registry.py`, `alt_data.py`, `signal_market.py`

**Audit/Logs:** `audit_log.py`, `journal.py`, `citations.py`, `attribution.py`, `notifications.py`, `reports.py`, `unified_runs.py`, `runs.py`

**Misc:** `debug.py`, `clock.py`, `drawings.py`, `fundamentals.py`, `metrics.py`, `notes.py`, `packages.py`, `parity.py`, `patterns.py`, `profiles.py`, `versions.py`, `hedge_fund.py`, `policy_signal.py`, `sandbox_runner.py`, `scenario_sim.py`, `workflow_depth.py`

---

## 9. KEY FINDINGS SUMMARY

### Critical Issues

1. **Pervasive demo data**: ~60+ runtime files contain hardcoded demo/mock/fixture data. The entire application runs on synthetic data by default with no clear production toggle.

2. **No real search backend**: The search feature uses an in-memory hardcoded list (`DEMO_INDEX`). Elasticsearch gateway exists but returns 503 (package not installed). Frontend falls back to local filter.

3. **No Alembic migrations**: Database schema is created via `Base.metadata.create_all()` — no migration history, no schema evolution path.

4. **SQLite as default**: Config defaults to `sqlite+aiosqlite:///./phase1.db` — Postgres only via Docker.

5. **Mock as default ingestion**: Docker-compose sets `INGESTION_MODE=mock` by default.

6. **56 routes, 26 hidden pages**: Many feature pages exist as routes but aren't in the nav sidebar — suggesting incomplete or speculative features.

7. **Duplicated codepaths**: Multiple autopilot versions (v1, v2), automation versions (v1, v2), health pages (v1, v4), decision explainers (v1, v2).

8. **Duplicated content**: `Apex-Terminal-main/` folder appears to be a stale copy of the entire project tree within itself.

### Action Priority

| Priority | Action | Files Affected |
|----------|--------|----------------|
| P0 | Remove/replace demo data in runtime code paths | ~60 files |
| P0 | Wire Elasticsearch as primary search backend | 3-5 files |
| P1 | Add Alembic migrations | New |
| P1 | Switch default DB to Postgres | config.py |
| P1 | Hide non-core nav items | AppShellUI2.tsx |
| P2 | Remove Apex-Terminal-main/ stale copy | Entire subdirectory |
| P2 | Add missing env vars to keys.env.example | keys.env.example |
| P2 | Consolidate duplicate v1/v2 features | ~10 files |
