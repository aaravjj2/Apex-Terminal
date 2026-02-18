# Master Execution Checklist: v1.14 + v1.15

This checklist provides a single source of truth for completing both releases.

---

## 📋 PHASE 1: v1.14 UI Integration

### Task 1.1: Risk Desk Provider Pill
- [ ] Open `frontend/src/features/options/riskDesk/RiskDeskPanel.tsx`
- [ ] Import `ProviderPill` and `useState`, `useEffect`
- [ ] Add provider info state and fetch logic
- [ ] Add `<ProviderPill {...providerInfo} testIdPrefix="riskdesk-provider" />` in JSX
- [ ] Save file
- [ ] Rebuild: `cd frontend && npx vite build`
- [ ] Verify in UI: Navigate to Risk Desk, see pill

### Task 1.2: Backtest Provider Pill
- [ ] Open `frontend/src/features/backtest/BacktestPanel.tsx`
- [ ] Same pattern as Risk Desk, use `testIdPrefix="backtest-provider"`
- [ ] Save file
- [ ] Rebuild
- [ ] Verify in UI: Navigate to Backtest, see pill

### Task 1.3: Mode Banner in App Shell
- [ ] Open `frontend/src/features/layout/shell/Shell.tsx` (or equivalent)
- [ ] Import `ModeBanner`
- [ ] Add mode info state and fetch logic
- [ ] Add `<ModeBanner {...modeInfo} />` in JSX (near top)
- [ ] Save file
- [ ] Rebuild
- [ ] Verify in UI: See banner at top showing DEMO mode

---

## 📋 PHASE 2: v1.14 Tests

### Task 2.1: Pytest Replay Service Tests
- [ ] Create `tests/unit/test_replay_service.py`
- [ ] Copy test code from implementation guide
- [ ] Run: `pytest tests/unit/test_replay_service.py -v`
- [ ] Verify: 10 passed, 0 failed, 0 skipped
- [ ] Fix any failures immediately
- [ ] Commit: `test(replay): Add unit tests for replay service`

### Task 2.2: Playwright Provider Pill Tests
- [ ] Create `frontend/tests/e2e/provider-pills-v1-14.spec.ts`
- [ ] Copy test code from implementation guide
- [ ] Run: `npx playwright test provider-pills-v1-14.spec.ts`
- [ ] Verify: All tests pass, screenshots captured
- [ ] Check screenshots in `test-results/`
- [ ] Commit: `test(ui): Add E2E tests for provider pills`

### Task 2.3: v1.14 Validation Matrix
- [ ] Run tsc: `cd frontend && npx tsc --noEmit` → 0 errors
- [ ] Run vitest: `npx vitest --run` → 0 failed/0 skipped
- [ ] Run pytest: `pytest` → 0 failed/0 skipped
- [ ] Run playwright: `npx playwright test` → 425 passed, 0 failed, 0 skipped
- [ ] If ANY failures: fix, rerun, repeat until 0/0

---

## 📋 PHASE 3: v1.15 Backend (Schema Hardening)

### Task 3.1: Create Shared Schemas
- [ ] Create `phase1/services/market_data/schemas.py`
- [ ] Copy `BarSchema`, `QuoteSchema`, `ErrorSchema` from implementation guide
- [ ] Save file
- [ ] Run: `python -c "from phase1.services.market_data.schemas import BarSchema; print('OK')"`
- [ ] Verify: No import errors

### Task 3.2: Integrate Schema Validation in DemoProvider
- [ ] Open `phase1/services/market_data/providers/demo_provider.py`
- [ ] Add `from ..schemas import BarSchema, ValidationError`
- [ ] Update `get_bars()` to validate bars after load (see guide)
- [ ] Update `get_quote()` to use `QuoteSchema` (see guide)
- [ ] Save file

### Task 3.3: Schema Validation Tests
- [ ] Create `tests/unit/test_schemas_v1_15.py`
- [ ] Copy test code from implementation guide (12 tests)
- [ ] Run: `pytest tests/unit/test_schemas_v1_15.py -v`
- [ ] Verify: All pass
- [ ] Commit: `feat(schemas): Add shared schemas with strict validation`

---

## 📋 PHASE 4: v1.15 UI (Unified Forms + Error States)

### Task 4.1: Unified Symbol/Range Form
- [ ] Create `frontend/src/features/shared/SymbolRangeForm.tsx`
- [ ] Copy component code from implementation guide
- [ ] Save file
- [ ] Verify: `npx tsc --noEmit` → 0 errors

### Task 4.2: Data State Banners
- [ ] Create `frontend/src/features/shared/DataStateBanner.tsx`
- [ ] Copy component code from implementation guide
- [ ] Save file
- [ ] Verify: `npx tsc --noEmit` → 0 errors

### Task 4.3: Integrate Forms into Views
- [ ] Update Backtest Configure tab to use `SymbolRangeForm`
- [ ] Update Risk Desk to use `SymbolRangeForm` (if applicable)
- [ ] Add `DataStateBanner` for empty/error states
- [ ] Rebuild: `npx vite build`
- [ ] Verify in UI: See unified form, trigger error state

### Task 4.4: v1.15 E2E Tests
- [ ] Create `frontend/tests/e2e/invalid-request-v1-15.spec.ts`
- [ ] Copy test code from implementation guide
- [ ] Run: `npx playwright test invalid-request-v1-15.spec.ts`
- [ ] Verify: All pass, error/empty state screenshots captured
- [ ] Commit: `feat(ui): Add unified forms and error state banners`

---

## 📋 PHASE 5: v1.15 Validation Matrix

### Task 5.1: Full Suite Validation
- [ ] Run tsc: `cd frontend && npx tsc --noEmit` → 0 errors
- [ ] Run vitest: `npx vitest --run` → 0 failed/0 skipped
- [ ] Run pytest: `pytest` → 0 failed/0 skipped (now includes v1.15 schema tests)
- [ ] Run playwright: `npx playwright test` → 425+ passed, 0 failed, 0 skipped
- [ ] Record exact counts in scratch pad for proof pack

### Task 5.2: Determinism Verification
- [ ] Run: `python check_determinism.py --runs 2 --mode demo`
- [ ] Verify: Identical hashes across runs
- [ ] Capture output for proof pack

---

## 📋 PHASE 6: Hackathon Media Pack

### Task 6.1: Create Tour Script
- [ ] Create `frontend/scripts/hackathon-tour.ts`
- [ ] Copy script from hackathon media guide
- [ ] Add to `package.json` scripts: `"tour": "npx tsx scripts/hackathon-tour.ts"`
- [ ] Verify: `npm run tour --help` (or just run it)

### Task 6.2: Run Tour
- [ ] Ensure servers running (backend on 8000, frontend on 5100)
- [ ] Run: `cd frontend && npm run tour`
- [ ] Wait for completion (~3-5 minutes)
- [ ] Verify: `ls ../artifacts/hackathon/screenshots/*.png | wc -l` → 80+
- [ ] Verify: `ls ../artifacts/hackathon/videos/*.webm` → exists

### Task 6.3: Video Post-Processing (if needed)
- [ ] Check video duration: `ffprobe artifacts/hackathon/videos/<video>.webm`
- [ ] If > 3 minutes: `ffmpeg -i <video>.webm -ss 00:00:00 -t 00:03:00 -c copy demo-3min.mp4`
- [ ] Verify: `ffprobe demo-3min.mp4` → ~3 minutes

### Task 6.4: Update README
- [ ] Open root `README.md`
- [ ] Add Hackathon Submission section (see guide)
- [ ] Save file
- [ ] Commit: `docs: Add hackathon submission section to README`

---

## 📋 PHASE 7: Proof Packs Finalization

### Task 7.1: Create Directories
```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p artifacts/proof/${TIMESTAMP}-v1.14/{screenshots,determinism,logs}
mkdir -p artifacts/proof/${TIMESTAMP}-v1.15/{screenshots,determinism,logs}
```

### Task 7.2: Run Tests & Capture Logs (v1.14)
- [ ] Backend: `pytest tests/unit/test_replay_service.py -v > artifacts/proof/${TIMESTAMP}-v1.14/logs/pytest.log 2>&1`
- [ ] Types: `cd frontend && npx tsc --noEmit > ../artifacts/proof/${TIMESTAMP}-v1.14/logs/tsc.log 2>&1`
- [ ] Units: `npx vitest --run > ../artifacts/proof/${TIMESTAMP}-v1.14/logs/vitest.log 2>&1`
- [ ] E2E: `npx playwright test > ../artifacts/proof/${TIMESTAMP}-v1.14/logs/playwright.log 2>&1`

### Task 7.3: Copy Reports (v1.14)
- [ ] `cp -r frontend/playwright-report artifacts/proof/${TIMESTAMP}-v1.14/`
- [ ] `cp -r frontend/test-results artifacts/proof/${TIMESTAMP}-v1.14/`

### Task 7.4: Copy Screenshots (v1.14)
- [ ] `cp frontend/test-results/**/v1-14-*.png artifacts/proof/${TIMESTAMP}-v1.14/screenshots/`

### Task 7.5: Generate Determinism Proofs (v1.14)
- [ ] Run canonical key test (see proof pack template)
- [ ] Save to `artifacts/proof/${TIMESTAMP}-v1.14/determinism/canonical-replay-key.json`
- [ ] Generate SHA256: `sha256sum canonical-replay-key.json > canonical-replay-key.sha256`

### Task 7.6: Write v1.14 Manifests
- [ ] Create `artifacts/proof/${TIMESTAMP}-v1.14/MANIFEST.md` (use template, fill in actual values)
- [ ] Create `artifacts/proof/${TIMESTAMP}-v1.14/manifest.json` (use template, fill in actual values)
- [ ] Create `artifacts/proof/${TIMESTAMP}-v1.14/README.md` (use template)

### Task 7.7: Repeat for v1.15
- [ ] Run tests & capture logs (schema tests, invalid request E2E)
- [ ] Copy reports
- [ ] Copy screenshots (error/empty state screenshots)
- [ ] Generate determinism proofs (quote snapshot hash)
- [ ] Write manifests (MANIFEST.md, manifest.json, README.md)

---

## 📋 PHASE 8: Final Commit & Delivery

### Task 8.1: Clean Git State
- [ ] Review uncommitted changes: `git status`
- [ ] Stage relevant files: `git add <files>`
- [ ] Commit v1.14: `git commit -m "feat: v1.14 — Replay-first fetch policy with provider pills"`
- [ ] Commit v1.15: `git commit -m "feat: v1.15 — Schema hardening with unified forms"`
- [ ] Commit proof packs: `git commit -m "proof: Add v1.14 + v1.15 proof packs with full validation logs"`
- [ ] Commit media: `git commit -m "media: Add hackathon demo video + 80 screenshots"`

### Task 8.2: Final Verification
- [ ] Checkout fresh: `git clone <repo-url> /tmp/test-clone && cd /tmp/test-clone`
- [ ] Install deps: `npm install && cd frontend && npm install && cd ..`
- [ ] Run demo smoke: `make demo-smoke` (or equivalent)
- [ ] Run full test matrix one more time
- [ ] Verify: 425+ passed, 0 failed, 0 skipped

### Task 8.3: Delivery Summary
- [ ] Create `docs/v1.14-v1.15-delivery-summary.md`
- [ ] List all files changed
- [ ] List all tests added
- [ ] List all proof pack locations
- [ ] Final sign-off statement

---

## ✅ DELIVERABLES CHECKLIST

### v1.14 Backend
- [x] `phase1/services/market_data/replay.py` created
- [x] `phase1/services/market_data/providers/demo_provider.py` updated
- [x] `phase1/services/market_data/providers/__init__.py` updated
- [x] `phase1/services/market_data/providers/types.py` extended
- [x] `.gitignore` updated

### v1.14 Frontend
- [x] `frontend/src/features/shared/ProviderPill.tsx` created
- [ ] `ProviderPill` integrated in Risk Desk
- [ ] `ProviderPill` integrated in Backtest
- [ ] `ModeBanner` integrated in App Shell

### v1.14 Tests
- [ ] `tests/unit/test_replay_service.py` created (10 tests)
- [ ] `frontend/tests/e2e/provider-pills-v1-14.spec.ts` created (5 tests)
- [ ] Full validation matrix: 0/0 across all runners

### v1.15 Backend
- [ ] `phase1/services/market_data/schemas.py` created
- [ ] `DemoProvider.get_bars()` validates with `BarSchema`
- [ ] `DemoProvider.get_quote()` validates with `QuoteSchema`

### v1.15 Frontend
- [ ] `frontend/src/features/shared/SymbolRangeForm.tsx` created
- [ ] `frontend/src/features/shared/DataStateBanner.tsx` created
- [ ] Forms integrated into Backtest/Risk Desk
- [ ] Error/empty state banners visible

### v1.15 Tests
- [ ] `tests/unit/test_schemas_v1_15.py` created (12 tests)
- [ ] `frontend/tests/e2e/invalid-request-v1-15.spec.ts` created (2 tests)
- [ ] Full validation matrix: 0/0 across all runners

### Hackathon Media
- [ ] `frontend/scripts/hackathon-tour.ts` created
- [ ] `artifacts/hackathon/screenshots/` contains 80+ images
- [ ] `artifacts/hackathon/videos/demo-3min.mp4` exists
- [ ] Root `README.md` updated with Hackathon Submission section

### Proof Packs
- [ ] `artifacts/proof/<TIMESTAMP>-v1.14/` complete
  - [ ] MANIFEST.md
  - [ ] manifest.json
  - [ ] README.md
  - [ ] playwright-report/
  - [ ] test-results/
  - [ ] screenshots/
  - [ ] determinism/
  - [ ] logs/
- [ ] `artifacts/proof/<TIMESTAMP>-v1.15/` complete (same structure)

### Validation Matrix (FINAL)
- [ ] tsc: 0 errors
- [ ] vitest: 0 failed, 0 skipped
- [ ] pytest: 0 failed, 0 skipped
- [ ] playwright: 425+ passed, 0 failed, 0 skipped, retries=0, workers=1

---

## 🚨 CRITICAL GATES

**DO NOT PROCEED PAST A PHASE IF:**
- Any test runner shows failed > 0
- Any test runner shows skipped > 0
- TypeScript compilation has errors > 0
- Playwright retries > 0 or workers > 1
- Git shows secrets/keys committed

**IF GATE FAILS:**
1. Stop immediately
2. Identify root cause
3. Apply minimal fix
4. Rerun full validation matrix
5. Repeat until 0/0

---

## 📊 PROGRESS TRACKING

Current Status: **v1.14 Backend Complete, v1.14 UI Started**

| Phase | Status | Test Status |
|-------|--------|-------------|
| v1.14 Backend | ✅ Complete | Not yet tested |
| v1.14 UI | ⚠️ In Progress | Not started |
| v1.14 Tests | ❌ Not Started | - |
| v1.15 Backend | ❌ Not Started | - |
| v1.15 UI | ❌ Not Started | - |
| v1.15 Tests | ❌ Not Started | - |
| Media Pack | ❌ Not Started | - |
| Proof Packs | ❌ Not Started | - |

---

## NEXT IMMEDIATE ACTION

**START HERE:** Phase 1, Task 1.1 — Integrate ProviderPill into Risk Desk
