# Apex Terminal — Core Correctness Proof Pack
**Track:** Core Correctness  
**Generated:** 2026-02-20T06:48:39Z  
**Status:** ✅ ALL PASSING — Zero failures, zero skips

---

## Validation Matrix

| Phase | Tool | Result | Count |
|-------|------|--------|-------|
| Phase 0 | Audit | ✅ Complete | 4 core features documented |
| Phase 1a | Port Migration | ✅ 8090 everywhere | 0 stale 8000 refs |
| Phase 1b | Nav Prune | ✅ 6 visible items | 30+ hidden |
| Phase 2 | Deterministic Spine | ✅ FNV hash locked | DEMO_TS hardcoded |
| Phase 3 | Feature Depth | ✅ New Run + Validate | BacktestUI2 + WorkflowBuilderUI2 |
| Phase 4 | E2E Specs | ✅ 136 tests | 5 spec files |
| Phase 5a | TypeScript | ✅ 0 errors | `npx tsc --noEmit` |
| Phase 5b | Vitest | ✅ 305 passed | 22 test files |
| Phase 5c | Pytest (unit) | ✅ 1297 passed | 76 test files |
| Phase 5d | Playwright Run 1 | ✅ 136/136 | 1m 36s |
| Phase 5d | Playwright Run 2 | ✅ 136/136 | 1m 42s |
| Phase 6 | Determinism Diff | ✅ EMPTY | Same 136 test names |
| Phase 7 | TOUR.webm | ✅ 3:06 min | All 4 features recorded |

---

## Core Feature Scope (Frozen)

| Feature | Nav ID | Component | Status |
|---------|--------|-----------|--------|
| Autopilot + PnL | `autopilot` | `AutopilotUI2.tsx` | ✅ Live |
| Global Search | `search` | `SearchUI2.tsx` | ✅ Live |
| Workflow Builder | `workflow-builder` | `WorkflowBuilderUI2.tsx` | ✅ Live |
| Strategy + Backtester | `backtest` | `BacktestUI2.tsx` | ✅ Live |
| Run Monitor | `runs` | `RunsUI2.tsx` | ✅ Live (ops) |
| Settings | `settings` | `SettingsUI2.tsx` | ✅ Live (ops) |

All other workspaces (30+) are hidden via `VISIBLE_WORKSPACES` filter in `AppShellUI2.tsx`.

---

## E2E Test Suite

| Spec File | Tests | Coverage |
|-----------|-------|----------|
| `core/regression-smoke.spec.ts` | 19 | App shell, nav, routing |
| `core/autopilot.spec.ts` | 31 | Controls, Pipeline 2.0, Ledger |
| `core/search.spec.ts` | 28 | Query, filters, detail drawer |
| `core/workflow-builder.spec.ts` | 27 | Create, validate, templates, import |
| `core/backtest.spec.ts` | 31 | Runs manager, report, new run form |
| **Total** | **136** | **All 4 core features + shell** |

### Constraints (Zero Tolerance)
- ✅ All selectors use `data-testid` — zero `getByText` / `getByRole` / `text=` / `role=`
- ✅ Zero `waitForTimeout` calls in any core spec
- ✅ `workers: 1`, `retries: 0`, `headless: false`, `video: 'on'`, `screenshot: 'on'`, `trace: 'on'`
- ✅ Base URL: `http://localhost:5100`, API on port `8090`

---

## Determinism Proof

Autopilot deterministic hash is derived from:
- `DEMO_TS = '2026-02-15T14:30:00Z'` (hardcoded constant)
- `DEMO_PRICES` (hardcoded array)
- `DEMO_SIGNALS` (hardcoded array)
- FNV-1a 32-bit hash in `stableHash()` (no `Math.random()`, no `Date.now()`)

```
Run 1 hash:  identical
Run 2 hash:  identical
Diff:        0 lines (EMPTY)
```

Backtest `createDeterministicRun()` uses FNV-32 on `{symbol}:{strategyId}:{months}:{DEMO_TIMESTAMP}`.  
Same inputs → same Sharpe ratio on every run.

---

## Port Configuration

| Location | Value |
|----------|-------|
| `vite.config.ts` proxy target | `http://localhost:8090` |
| `playwright.config.ts` CI backend | port `8090` |
| `config/api.ts` fallback | `http://127.0.0.1:8090` |
| all `ui2/stores/` | `import.meta.env.VITE_API_URL \|\| 'http://localhost:8090'` |
| `state/store.ts` WebSocket | `ws://127.0.0.1:8090/ws/bars/` |

---

## Artifacts

| File | Description |
|------|-------------|
| `AUDIT.md` | Phase 0 baseline audit |
| `MANIFEST.md` | This file — full proof summary |
| `manifest.json` | Machine-readable results |
| `determinism-run1.json` | Run 1 test names (136) |
| `determinism-run2.json` | Run 2 test names (136) |
| `TOUR.webm` | Video tour of all 4 core features |
