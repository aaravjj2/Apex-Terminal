# AUDIT_NO_DEMO.md — Runtime Demo/Mock/Dummy/Fake Scan

**Generated:** 2026-02-23  
**Baseline SHA:** 7030dfb  
**Scan patterns:** `demo`, `mock`, `dummy`, `fake`, `fallback.*price`, `get_demo_bars`, `placeholder.*quote`  
**Scope:** `phase1/services/**/*.py` (runtime backend code only)

## Summary

| Category | Count |
|----------|-------|
| RUNTIME hits | 656 |
| TEST-ONLY hits | 29 |
| Unique RUNTIME files | 91 |

## Critical Runtime Files (Top 20 by hit count)

| Hits | File | Severity | Notes |
|------|------|----------|-------|
| 24 | `phase1/services/ingestion/main.py` | HIGH | Ingestion pipeline has mock mode logic |
| 19 | `phase1/services/api/routes/market_data_v1_13.py` | HIGH | Market data route with demo patterns |
| 17 | `phase1/services/api/routes/provider_registry.py` | MED | Provider registry references mock |
| 17 | `phase1/services/autopilot/v1_providers.py` | HIGH | Contains MockQuoteProvider, MockNewsProvider, MockBrokerProvider classes |
| 17 | `phase1/services/market_data/providers/__init__.py` | HIGH | Provider init with mock/demo fallback |
| 16 | `phase1/services/api/routes/workflow_depth.py` | LOW | Workflow routes with mock data patterns |
| 16 | `phase1/services/api/routes/journal.py` | LOW | Journal routes with mock patterns |
| 16 | `phase1/services/api/routes/nova.py` | LOW | LLM routes with mock fallback |
| 16 | `phase1/services/strategy_lab/storage.py` | MED | Strategy storage with demo data |
| 16 | `phase1/services/portfolio/fixtures.py` | HIGH | Portfolio fixtures for demo mode |
| 15 | `phase1/services/portfolio/store.py` | HIGH | Portfolio store with demo mode |
| 14 | `phase1/services/api/routes/platform_health.py` | MED | Health routes with mock data |
| 14 | `phase1/services/api/routes/agents.py` | LOW | Agent routes with mock data |
| 13 | `phase1/services/ingestion/connectors/mock.py` | HIGH | Entire mock connector class |
| 12 | `phase1/services/api/routes/correlation.py` | LOW | Correlation routes with mock data |
| 12 | `phase1/services/risk_desk/pipeline.py` | MED | Risk desk pipeline with mock patterns |
| 11 | `phase1/services/api/routes/cache.py` | LOW | Cache routes with mock patterns |
| 11 | `phase1/services/api/routes/search.py` | MED | Search routes with mock data |
| 10 | `phase1/services/api/routes/risk_desk.py` | MED | Risk desk routes with mock patterns |
| 10 | `phase1/services/api/routes/data_quality.py` | LOW | Data quality with mock patterns |

## Classification

### MUST FIX (Runtime paths that return fabricated data)
1. **`phase1/services/ingestion/main.py`** — Has mock mode that generates fake bars
2. **`phase1/services/autopilot/v1_providers.py`** — MockQuoteProvider returns fake prices (100.0)
3. **`phase1/services/ingestion/connectors/mock.py`** — Entire mock connector returns synthetic bars
4. **`phase1/services/portfolio/fixtures.py`** — Demo fixtures with hardcoded values
5. **`phase1/services/portfolio/store.py`** — Demo store that bypasses real data
6. **`phase1/services/portfolio/api.py`** — `get_demo_store()` used in runtime
7. **`phase1/services/market_data/providers/demo_provider.py`** — Demo market data provider
8. **`phase1/services/api/main.py`** — Health endpoint reports `bars_source: "mock_csv"` and `mode: "mock"`
9. **`phase1/services/api/autopilot_routes.py`** — `_generate_demo_candidates()` fabricates trades

### ACCEPTABLE (Mock classes used only by test injection)
- `phase1/services/autopilot/v1_providers.py` Mock* classes — OK if only injected by tests
- `phase1/services/automation/strategies/mock_strategy.py` — Test-only strategy

### LOW PRIORITY (Comments, docstrings, or gated-off code)
- Most route files with "demo" in comments/docstrings
- Files where "mock" appears only in variable names or logging

## Remediation Plan
1. Remove all demo/mock runtime code paths from ingestion, portfolio, market data
2. Make mock providers importable ONLY from test modules (move to test fixtures)
3. Health endpoint must never report `mode: "mock"` — fail if no real provider configured
4. `_generate_demo_candidates()` must be replaced with real candidate generation
5. Portfolio `get_demo_store()` must be replaced with real portfolio backed by broker
