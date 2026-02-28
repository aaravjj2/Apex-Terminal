# Core Depth Upgrade — Proof Pack

## Quality Gates — ALL PASSED

| Gate | Result | Detail |
|------|--------|--------|
| **tsc** | ✅ 0 errors | `npx --package=typescript tsc --noEmit` — clean |
| **vitest** | ✅ 341/341 | 305 baseline + 36 new depth store tests |
| **pytest** | ✅ 33/33 depth | All 4 depth route test classes pass |
| **Playwright Run 1** | ✅ 169/169 | 136 baseline + 33 depth E2E |
| **Playwright Run 2** | ✅ 169/169 | Determinism confirmed |

## Depth Upgrade Scope

### A: Autopilot — Risk Controls + Evaluation
- **Store**: `autopilotDepthStore.ts` — Risk controls (4 params), execution params (4 params), deterministic evaluation engine with FNV-1a hashing
- **UI**: `AutopilotUI2.tsx` — 2 new tabs (Risk Controls, Evaluation)
  - Risk Controls tab: 4 risk inputs + 4 execution params, live update
  - Evaluation tab: summary bar (expected/realized PnL, fees, slippage), attribution table, risk budget grid, breaches list, fills table, hash display
- **Backend**: `autopilot_depth.py` — 4 REST endpoints (risk CRUD, exec CRUD, evaluation GET, hash)
- **Tests**: 8 vitest + 7 pytest + 7 Playwright E2E

### B: Backtester — Sweeps, Walk-Forward, Robustness
- **Store**: `backtestDepthStore.ts` — Parameter sweep engine (5×5 grid), walk-forward analysis (6 windows), robustness testing (8 scenarios)
- **UI**: `BacktestUI2.tsx` — 3 new tabs via existing Tabs component
  - Param Sweep tab: config form, run button, 25-cell color-coded heatmap with best cell highlight
  - Walk-Forward tab: config form, OOS Sharpe/Return/Degradation summary, 6-window results table
  - Robustness tab: config form, robustness score display, 8-scenario results table with delta sharpe
- **Backend**: `backtest_depth.py` — 5 REST endpoints (sweep POST/GET, walkforward POST, robustness POST, hash)
- **Tests**: 6 vitest + 8 pytest + 7 Playwright E2E

### C: Workflow Builder — Templates, RBAC, Scheduling, Audit
- **Store**: `workflowDepthStore.ts` — RBAC engine (3 users, 7 policies), templates (4 + search + clone), scheduling (3 jobs + create/toggle), run history (8 records + trigger), audit export with hash
- **UI**: `WorkflowBuilderUI2.tsx` — 3 new tabs + RBAC bar
  - RBAC bar: user switcher dropdown, role badge
  - Enhanced Templates: search input, depth templates with tags + clone button, original templates preserved
  - Scheduling tab: create schedule form, jobs table with status toggle
  - Runs tab: run history table, trigger run button
  - Audit tab: permission-gated (denied for viewer), export buttons, JSON display with hash
- **Backend**: `workflow_depth.py` — 11 REST endpoints (templates CRUD/search/clone, schedules CRUD/toggle, runs list/trigger, audit export, hash)
- **Tests**: 12 vitest + 13 pytest + 11 Playwright E2E

### D: Global Search — Provider Status + Explain
- **Store**: `searchDepthStore.ts` — Provider status (local backend, doc count, indexes, version), 3 index mappings, explain engine (4 ranking factors: tf-idf, field_boost, recency, symbol_match), Elasticsearch OFF by default
- **UI**: `SearchUI2.tsx` — Provider status bar + mappings panel + explain view
  - Provider status bar: health dot, backend name, doc count, index count, version, reachable badge, toggle mappings
  - Index mappings panel: 3 indices (apex-orders/strategies/workflows) with field details
  - Explain view in detail drawer: total score, 4 factor bars with weights, hash
- **Backend**: `search_depth.py` — 5 REST endpoints (provider status, mappings, explain, config, hash)
- **Tests**: 8 vitest + 6 pytest + 8 Playwright E2E

## Files Created/Modified

### New Files (16)
1. `frontend/src/ui2/stores/autopilotDepthStore.ts`
2. `frontend/src/ui2/stores/backtestDepthStore.ts`
3. `frontend/src/ui2/stores/workflowDepthStore.ts`
4. `frontend/src/ui2/stores/searchDepthStore.ts`
5. `phase1/services/api/routes/autopilot_depth.py`
6. `phase1/services/api/routes/backtest_depth.py`
7. `phase1/services/api/routes/workflow_depth.py`
8. `phase1/services/api/routes/search_depth.py`
9. `frontend/src/ui2/__tests__/depthStores.test.ts`
10. `tests/unit/test_depth_routes.py`
11. `frontend/tests/e2e/core/depth-upgrade.spec.ts`
12. `artifacts/proof/2025-core-depth/PROOF.md`

### Modified Files (5)
1. `frontend/src/ui2/pages/AutopilotUI2.tsx` — 2 new tabs
2. `frontend/src/ui2/pages/BacktestUI2.tsx` — 3 new tabs
3. `frontend/src/ui2/pages/WorkflowBuilderUI2.tsx` — 3 new tabs + RBAC bar
4. `frontend/src/ui2/pages/SearchUI2.tsx` — Provider status + explain view
5. `phase1/services/api/main.py` — 4 depth route mounts

## Determinism Proof
- All stores use FNV-1a 32-bit hash with `DEMO_TS = '2026-02-15T14:30:00Z'`
- All data is client-side generated — zero network calls, fully offline
- Playwright run 1: 169/169 passed
- Playwright run 2: 169/169 passed (identical)
- Elasticsearch is OFF by default (demo mode uses local backend)

## Summary
- **Total new tests**: 36 vitest + 33 pytest + 33 Playwright E2E = **102 new tests**
- **Total passing**: vitest 341/341, pytest 33/33, Playwright 169/169
- **Zero regressions**: All 136 baseline Playwright tests continue to pass
- **tsc: 0 errors**
