# Proof Pack MANIFEST — v1.5 + v1.6
**Generated:** 2025-02-07T22:58:57Z  
**Git SHA:** 5fba9c8  
**Branch:** main  
**OS:** Ubuntu 22.04.5 LTS (WSL2)  
**Node:** v22.21.1 · npm 10.9.4  
**Python:** 3.10.12  
**Playwright:** 1.57.0  

---

## Objective & Acceptance Criteria

### OBJECTIVE A (v1.5): Unified Run Ledger + Compare Mode + Convergence
- [x] A1: Unified Run Ledger — "Runs" tab (Ledger subtab) merging Risk + Backtest runs
- [x] A2: Compare Mode — select 2-4 runs, overlay metrics charts, metric diff table
- [x] A3: Risk Desk Before/After — payoff bar chart (Before Fix vs After Fix per leg)
- [x] A4: Centralized formatters — `formatNumberSafe`, `formatCurrencySafe`, `formatPercentSafe` wired into AnalyzeTab

### OBJECTIVE B (v1.6): Visual Regression + Harness + CI
- [x] B1: Visual regression suite ≥15 screenshot assertion tests
- [x] B2: DEMO_MODE harness with deterministic fixtures (`demo-fixtures.ts`)
- [x] B3: `make verify` / `npm run verify:all` CI command 
- [x] B4: Regression lock unit tests (26 tests: formatters, CSV headers, config)

---

## Phase 0 Outputs

```
GIT SHA: 5fba9c8 (main, dirty — working changes)
Node: v22.21.1, npm 10.9.4
Python: 3.10.12
Playwright: 1.57.0
Ports: :8000 (uvicorn), :5100 (vite preview)
OS: Ubuntu 22.04.5 LTS (WSL2, Linux 6.6.87.2-microsoft-standard-WSL2)
Secrets: None committed (env vars via keys.env, gitignored)
```

---

## Test Results — FULL MATRIX

### TSC (TypeScript Compiler)
```
cd frontend && npx tsc --noEmit
# 0 errors
```

### Vitest (Unit Tests)
```
cd frontend && npx vitest run
# Test Files  7 passed (7)
# Tests       50 passed (50)
# Duration    900ms
```

### Pytest (Backend)
```
python3 -m pytest tests/ -x --tb=short
# 84 passed in 0.98s
```

### Playwright E2E — v1.3 (Stability Coverage)
```
cd frontend && npx playwright test tests/e2e/stability-coverage-v1-3.spec.ts
# 26 passed (1.0m)
```

### Playwright E2E — v1.4 (Visual Regression)
```
cd frontend && npx playwright test tests/e2e/visual-regression-v1-4.spec.ts
# 14 passed (29.7s)
```

### Playwright E2E — v1.5 (Unified Runs + Compare)
```
cd frontend && npx playwright test tests/e2e/unified-runs-v1-5.spec.ts
# 19 passed (29.0s)
```

### Playwright E2E — v1.6 (Visual Regression)
```
cd frontend && npx playwright test tests/e2e/visual-regression-v1-6.spec.ts
# 15 passed (29.2s)
```

### Combined Playwright (all 4 suites)
```
cd frontend && npx playwright test tests/e2e/stability-coverage-v1-3.spec.ts tests/e2e/visual-regression-v1-4.spec.ts tests/e2e/unified-runs-v1-5.spec.ts tests/e2e/visual-regression-v1-6.spec.ts
# 74 passed (2.4m)
# 0 failed, 0 skipped
```

---

## Final Verification Summary

| Suite | Count | Status |
|-------|-------|--------|
| TSC | 0 errors | ✅ |
| Vitest | 50 passed | ✅ |
| Pytest | 84 passed | ✅ |
| Playwright v1.3 | 26 passed | ✅ |
| Playwright v1.4 | 14 passed | ✅ |
| Playwright v1.5 | 19 passed | ✅ |
| Playwright v1.6 | 15 passed | ✅ |
| **Playwright Total** | **74 passed** | ✅ (≥60) |
| **Total** | **failed=0, skipped=0** | ✅ |

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/utils/formatters.ts` | A4: Centralized formatting helpers (null-safe) |
| `frontend/src/features/options/runs/types.ts` | A1: Unified run ledger TypeScript types |
| `frontend/src/features/options/runs/RunsPanel.tsx` | A1+A2: Ledger table + Compare mode UI |
| `frontend/src/features/options/runs/index.ts` | Barrel export for RunsPanel |
| `phase1/services/api/routes/unified_runs.py` | A1: Backend GET /api/unified-runs endpoint |
| `frontend/tests/unit/regression-locks.test.ts` | B4: 26 regression lock unit tests |
| `frontend/tests/e2e/demo-fixtures.ts` | B2: Deterministic demo fixtures |
| `frontend/tests/e2e/unified-runs-v1-5.spec.ts` | v1.5: 19 functional E2E tests |
| `frontend/tests/e2e/visual-regression-v1-6.spec.ts` | v1.6: 15 visual regression tests |

### Modified Files
| File | Change |
|------|--------|
| `frontend/src/features/options/backtest/AnalyzeTab.tsx` | A4: Replaced scattered formatters with centralized imports |
| `frontend/src/features/options/riskDesk/RiskDeskPanel.tsx` | A3: Added Before/After Payoff chart (BarChart) |
| `frontend/src/features/layout/views/OptionsView.tsx` | A1: Added "Runs" tab + RunsPanel render |
| `phase1/services/api/main.py` | A1: Registered unified_runs router |
| `Makefile` | B3: Full `make verify` pipeline + per-suite targets |
| `frontend/package.json` | B3: Added verify:tsc, verify:unit, verify:e2e, verify:all scripts |
| `frontend/tests/e2e/__snapshots__/...vr-02...` | Updated snapshot (Runs tab changed header) |

---

## Artifacts

```
artifacts/proof/20260207-225857-v1-6/
├── MANIFEST.md              (this file)
├── screenshots/
│   ├── v1.5-01-runs-tab-visible.png
│   ├── v1.5-04-ledger-content.png
│   ├── v1.5-13-stress-card.png
│   ├── v1.5-15-before-after.png
│   ├── v1.5-16-formatter-convergence.png
│   ├── v1.5-19-tab-switching.png
│   └── test-finished-1.png
├── playwright/
│   ├── index.html           (HTML report)
│   ├── data/                (report data)
│   ├── trace/               (trace viewer)
│   ├── trace.zip            (Playwright trace)
│   └── video.webm           (test video)
├── logs/
└── demo-smoke/
```

---

## Verification Commands (copy/paste)

```bash
# Phase 0
cd "/home/aarav/Aarav/Tradingview recreation"
git rev-parse --short HEAD && git branch --show-current

# TSC
cd frontend && npx tsc --noEmit

# Vitest
cd frontend && npx vitest run

# Pytest
cd "/home/aarav/Aarav/Tradingview recreation" && python3 -m pytest tests/ -x --tb=short

# Playwright (all 4 suites combined)
cd frontend && npx playwright test tests/e2e/stability-coverage-v1-3.spec.ts tests/e2e/visual-regression-v1-4.spec.ts tests/e2e/unified-runs-v1-5.spec.ts tests/e2e/visual-regression-v1-6.spec.ts

# Or use make
make verify
```

---

**STATEMENT:** All tests pass with **failures=0 and skipped=0** across the full matrix. Total Playwright: 74 (≥60 required). Retries=0, workers=1. No Nova/LLM integration.
