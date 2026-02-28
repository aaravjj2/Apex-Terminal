# Core Correctness Track — Full Audit

**Date**: 2025-07-01  
**Agent**: GitHub Copilot (Claude Sonnet 4.6)  
**Scope**: Apex Terminal — 4 Core Features Only

---

## Baseline (pre-change)

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** ✅ |
| `pytest tests/ -q --tb=no` | **437 passed, 0 failed** ✅ |
| `npx vitest run` | **305 passed (22 files)** ✅ |

---

## Scope Freeze

Only these 4 features ship in the core track. All others are feature-flagged OFF.

| Feature | Route | Page File | Backend Routes |
|---|---|---|---|
| **Autopilot + PnL** | `/ui2/autopilot` | `AutopilotUI2.tsx` (399 lines) | `autopilot.py`, `autopilot2Store` |
| **Global Search** | `/ui2/search` | `SearchUI2.tsx` (330 lines) | `search.py` |
| **Workflow Builder** | `/ui2/workflow-builder` | `WorkflowBuilderUI2.tsx` (245 lines) | `automation.py` |
| **Strategy + Backtester** | `/ui2/backtest` | `BacktestUI2.tsx` (178 lines) | `backtest.py`, `strategies.py` |

Minimal ops kept visible: `/ui2/runs` (Runs & Audit), `/ui2/settings`.

---

## Feature Inventory

### Backend routes (73 total in `phase1/services/api/routes/`)

**Core (ALWAYS ON — 7 routes):**
- `autopilot.py` — kill switch, rules, activity, v2 run
- `search.py` — entity search with Elasticsearch fallback
- `automation.py` — workflow CRUD
- `backtest.py` — run backtest jobs
- `strategies.py` — strategy CRUD
- `runs.py` — audit runs
- `backtest.py` related: `unified_runs.py`, `strategy_artifacts.py`

**Non-core (feature-flagged OFF — 66 routes):**
All wave 6-10 routes: `monte_carlo`, `walk_forward`, `scoring`, `sentiment`, `regime`, `elasticsearch_gateway`, `nova`, `market_hours`, `kill_switch_recovery`, `system_health`, `observability`, `compliance`, `performance_analytics`, `strategy_optimizer`, `anomalies`, `portfolio_optimizer`, `sandbox_runner`, `scenario_sim`, `alt_data`, `signal_market`, `microstructure`, `liquidity`, plus ~44 others (dashboard, trading, portfolio, risk, alerts, research, etc.).

**Note**: All non-core routes remain registered in `main.py` (pytest tests still use them), but their UI counterparts are hidden behind `VITE_FEATURE_FULL_NAV` flag.

### Frontend pages (80+ in `frontend/src/ui2/pages/`)

**Core (visible):** 4 core + 2 ops = 6 routes shown in nav  
**Non-core (hidden):** All others hidden with `data-testid="nav-hidden"` and route guard

---

## Core Feature Depth Assessment

### Autopilot + PnL (`AutopilotUI2.tsx` — 399 lines)
- ✅ Kill switch with confirm modal (`data-testid="autopilot-kill-switch-btn"`)
- ✅ Rule toggles (`data-testid="autopilot-rule-toggle-{id}"`)
- ✅ Activity feed table (`data-testid="autopilot-activity-table"`)
- ✅ Pipeline 2.0 stage timeline (`data-testid="autopilot-stage-timeline"`)
- ✅ Decision ledger with 4 sub-tabs (`data-testid="autopilot-ledger-tab-{name}"`)
- ✅ Deterministic hash on every run (`data-testid="autopilot-run-hash"`)
- ✅ Run selector for multiple pipeline runs
- **VERDICT**: Complete — 3 main tabs, deterministic pipeline, full ledger

### Global Search (`SearchUI2.tsx` — 330 lines)
- ✅ Search input with Enter key support (`data-testid="search-input"`)
- ✅ Entity type filter chips (`data-testid="search-filter-{type}"`)
- ✅ Symbol filter input (`data-testid="search-symbol-filter"`)
- ✅ Results DataTable (`data-testid="search-results-table"`)
- ✅ Detail drawer with deep-link (`data-testid="search-detail-drawer"`)
- ✅ Related entities list (`data-testid="search-related-entities"`)
- ✅ Recent searches dropdown with clear (`data-testid="search-recent-dropdown"`)
- ✅ Backend search via `searchStore.searchBackend()`
- **VERDICT**: Complete — full pipeline from input → filter → results → detail

### Workflow Builder (`WorkflowBuilderUI2.tsx` — 245 lines)
- ✅ Create/edit workflow form (`data-testid="ui2-workflow-form"`)
- ✅ Trigger type selector (`data-testid="ui2-workflow-trigger-select"`) 
- ✅ Actions array with add/remove (`data-testid="ui2-workflow-add-action-btn"`)
- ✅ Save workflow (`data-testid="ui2-workflow-save-btn"`)
- ✅ Templates tab with "Use Template" (`data-testid="ui2-workflow-apply-template-{id}"`)
- ✅ Import/Export JSON (`data-testid="ui2-workflow-import-btn"`)
- ✅ Delete workflow (`data-testid="ui2-workflow-delete-{id}"`)
- **VERDICT**: Complete — full CRUD, templates, import/export

### Strategy + Backtester (`BacktestUI2.tsx` — 178 lines)
- ✅ Runs manager with filters (`data-testid="backtest-runs-manager"`)
- ✅ Filter by symbol and strategy (`data-testid="backtest-filter-symbol"`)
- ✅ Runs DataTable with status badges (`data-testid="backtest-runs-table"`)
- ✅ Open run → navigate to report tab
- ✅ Report viewer with provenance section (`data-testid="backtest-report-provenance"`)
- ✅ 5 metrics stats grid (`data-testid="backtest-stat-{name}"`)
- ⚠️ Data source: `DEMO_BACKTEST_RUNS` from `demoStore.ts` (static fixture — deterministic ✅)
- **VERDICT**: Complete for demo + determinism; data is fixture-based (always same)

---

## Port Configuration

| Location | Current Value | Required |
|---|---|---|
| `vite.config.ts` proxy target | `http://localhost:8090` | ✅ Already correct |
| Playwright CI `webServer` | `--port 8090` | ✅ Already correct |
| `tradingStore.ts` (line 58-59) | `localhost:8000` | ❌ Must fix → 8090 |
| `telemetryStore.ts` (line 40) | `localhost:8000` | ❌ Must fix → 8090 |
| `autopilotV2Store.ts` (line 151) | `localhost:8000` | ❌ Must fix → 8090 |
| `frontend/src/config/api.ts` (line 8) | falls back to `127.0.0.1:8000` | ❌ Must fix |
| `keys.env` `VITE_API_URL` | not set | ❌ Must set to 8090 |

---

## Test Infrastructure

| File | Tests | Status |
|---|---|---|
| `tests/unit/test_autopilot.py` | ~20 | ✅ passing |
| `tests/unit/test_search.py` | ~20 | ✅ passing |
| `tests/unit/test_automation.py` | ~20 | ✅ passing |
| `tests/unit/test_backtest.py` | ~20 | ✅ passing |
| `frontend/tests/e2e/core/` | **TO CREATE** | ❌ not yet |

---

## Determinism Proof Requirements

Every `autopilot2Store.execute()` call must produce identical:
- `deterministic_hash` value
- Stage counts (input_count, output_count)
- Decision/rejection counts
- Fixture symbols and prices

Proof: Run suite twice, compare JSON summaries → diff must be empty.

---

## Phase Plan

- [x] Phase 0: Audit (this document)
- [ ] Phase 1: Port 8090 fix + nav prune to 4 core + feature flag env
- [ ] Phase 2: Validate deterministic data spine (clock, hash, fixtures)
- [ ] Phase 3: Deepen core features (PnL ledger, search index, workflow simulate, backtest run)
- [ ] Phase 4: Build `frontend/tests/e2e/core/` — 5 spec files ≥75 tests
- [ ] Phase 5: Full matrix — tsc, vitest, pytest, Playwright MCP headed, determinism proof
- [ ] Phase 6: Proof pack at `artifacts/proof/2025-core-correctness/`
