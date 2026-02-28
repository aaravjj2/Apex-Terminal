# PROOF PACK MANIFEST — v1.7 + v1.8 (Determinism + Industrial UI/UX)
**Generated:** 2026-02-08T00:46:34Z  
**Git SHA:** 5fba9c8  
**Branch:** main  

---

## Objective & Acceptance Criteria

Implement v1.7 (Determinism + Performance + Reliability Hardening) and v1.8 (Industrial UI/UX + Visual Regression + Accessibility):

| Criterion | Status |
|-----------|--------|
| TSC: 0 errors | ✅ PASS |
| Vitest: 50/50 (0 fail, 0 skip) | ✅ PASS |
| Pytest: 84/84 (0 fail, 0 skip) | ✅ PASS |
| Playwright v1.3–v1.8: 95/95 (0 fail, 0 skip) | ✅ PASS |
| v1.8 visual regression: ≥20 tests | ✅ 21 tests |
| v1.8 screenshot assertions: ≥12 | ✅ 15 screenshots |

---

## Phase 0 Outputs

- **Git SHA:** 5fba9c8 (branch: main)
- **Node:** v22.21.1, npm 10.9.4
- **Python:** 3.10.12
- **RUN_MODE:** demo (no API keys required)
- **Backend health:** `curl http://localhost:8000/health` → 200 OK
- **Frontend health:** `curl http://localhost:5100` → 200 OK

---

## Changes Summary

### v1.7 — Determinism + Performance + Reliability

| File | Change |
|------|--------|
| `phase1/services/risk_desk/schemas_w2.py` | Added `cache_hit`, `created_at`, `config_hash`, `portfolio_hash` fields |
| `phase1/services/risk_desk/pipeline.py` | Added `_is_demo_mode()`, `_make_run_id()`, `_portfolio_hash()`, `_config_hash()`, `_iso_now()` helpers; ISO timestamps on all T1–T5 trace entries |
| `phase1/services/api/routes/risk_desk.py` | Institutional export bundle: risk_run.json, tool_trace.json, compliance.json, snapshot.json, config_hash.txt, portfolio.csv, report.html, README.txt |
| `frontend/src/features/options/riskDesk/types.ts` | Added `started_at?`, `ended_at?`, `cache_hit?`, `created_at?`, `config_hash?`, `portfolio_hash?` |
| `frontend/src/features/options/riskDesk/api.ts` | Updated mock data with determinism fields |

### v1.8 — Industrial UI/UX + Accessibility + Visual Regression

| File | Change |
|------|--------|
| `frontend/src/features/options/riskDesk/RunStatusHeader.tsx` | NEW — Run status with run_id, config hash, badge, ARIA `role="status"` |
| `frontend/src/features/options/backtest/BacktestStatusHeader.tsx` | NEW — Backtest status header component |
| `frontend/src/features/options/riskDesk/RiskDeskPanel.tsx` | RunStatusHeader integration, ARIA `role="tablist"`/`role="tab"`/`aria-selected`, guided empty states with CTA, `focus-visible` |
| `frontend/src/features/options/backtest/BacktestPanel.tsx` | BacktestStatusHeader, ARIA tablist/tab/aria-selected, focus-visible |
| `frontend/src/features/layout/views/OptionsView.tsx` | ARIA role/tab/aria-selected on main + analytics subtabs |
| `frontend/tests/e2e/visual-regression-v1-8.spec.ts` | NEW — 21 tests, 15 screenshot assertions across 6 describe blocks |
| `Makefile` | Added `test-e2e-v1-8` target |

---

## Exact Commands Executed

```bash
# TSC
cd frontend && npx tsc --noEmit
# Result: 0 errors

# Vitest
cd frontend && npx vitest run
# Result: 7 files, 50 passed, 0 failed, 0 skipped

# Pytest
python3 -m pytest tests/ -x --tb=short -q
# Result: 84 passed in 1.06s

# Playwright (full matrix)
cd frontend && npx playwright test \
  tests/e2e/stability-coverage-v1-3.spec.ts \
  tests/e2e/visual-regression-v1-4.spec.ts \
  tests/e2e/unified-runs-v1-5.spec.ts \
  tests/e2e/visual-regression-v1-6.spec.ts \
  tests/e2e/visual-regression-v1-8.spec.ts
# Result: 95 passed (3.6m), 0 failed, 0 skipped
```

---

## Test Results Detail

### Playwright Breakdown

| Spec File | Tests | Status |
|-----------|-------|--------|
| stability-coverage-v1-3.spec.ts | 26 | ✅ PASS |
| visual-regression-v1-4.spec.ts | 14 | ✅ PASS |
| unified-runs-v1-5.spec.ts | 19 | ✅ PASS |
| visual-regression-v1-6.spec.ts | 15 | ✅ PASS |
| visual-regression-v1-8.spec.ts | 21 | ✅ PASS |
| **TOTAL** | **95** | **0 failed, 0 skipped** |

### v1.8 Test Details (21 tests)

| Test | Describe | Screenshot |
|------|----------|------------|
| v1.8-01 | Analytics tab default | v1.8-01-analytics-default.png |
| v1.8-02 | Risk Desk empty state | v1.8-02-risk-desk-empty.png |
| v1.8-03 | Strategy Lab tab | v1.8-03-strategy-lab.png |
| v1.8-04 | Backtest default | v1.8-04-backtest-default.png |
| v1.8-05 | Runs tab | v1.8-05-runs-tab.png |
| v1.8-06 | Empty state CTA text | — (assertion only) |
| v1.8-07 | Runs empty state | v1.8-07-runs-empty-state.png |
| v1.8-08 | Export no-run state | v1.8-08-export-no-run.png |
| v1.8-09 | Load demo click | — (assertion only) |
| v1.8-10 | RunStatusHeader | v1.8-10-run-status-header.png |
| v1.8-11 | Run_id text | — (assertion only) |
| v1.8-12 | Full run results | v1.8-12-full-run-results.png |
| v1.8-13 | Backtest configure | v1.8-13-backtest-configure.png |
| v1.8-14 | Backtest runs | v1.8-14-backtest-runs.png |
| v1.8-15 | Backtest export | v1.8-15-backtest-export.png |
| v1.8-16 | ARIA role=tab | — (assertion only) |
| v1.8-17 | Risk Desk ARIA tablist | — (assertion only) |
| v1.8-18 | Backtest ARIA tablist | — (assertion only) |
| v1.8-19 | Tool trace timeline | v1.8-19-tool-trace.png |
| v1.8-20 | Compliance card | v1.8-20-compliance-card.png |
| v1.8-21 | Verification card | v1.8-21-verification-card.png |

---

## Artifacts

| Path | Description |
|------|-------------|
| `playwright/html-report/` | Full Playwright HTML report |
| `screenshots/visual-regression-v1-8.spec.ts-snapshots/` | 16 baseline screenshots |
| `logs/playwright-full.log` | Full Playwright run output |

---

## Final Verification Statement

All acceptance criteria met:
- **failures = 0** across TSC, Vitest (50), Pytest (84), Playwright (95)
- **skipped = 0** across all suites
- v1.8 visual regression: **21 tests** (≥20 required), **15 screenshot assertions** (≥12 required)
- All evidence logged in this MANIFEST.md and backed by artifacts in this proof pack
