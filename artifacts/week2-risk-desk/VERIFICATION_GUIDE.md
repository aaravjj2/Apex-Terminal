# Week 2 Risk Desk — Quick Verification Guide

**For judges, reviewers, or future verification.**

## One-Command Verification

```bash
cd "/home/aarav/Aarav/Tradingview recreation" && make verify
```

Expected output:
- Backend: 33 passed in <1s
- E2E: 12 passed in ~56s

---

## Individual Layer Verification

### 1. Backend Unit Tests (33 tests)
```bash
python -m pytest test_risk_desk_w2.py -v --tb=short
```
Expected: `===== 33 passed in 0.96s =====`

### 2. TypeScript Type Safety (0 errors)
```bash
cd frontend && npx tsc --noEmit
```
Expected: No output (clean exit)

### 3. Playwright E2E (12 tests)
```bash
cd frontend && npx playwright test --config=playwright.risk-desk.config.ts
```
Expected: `12 passed (56.3s)`

### 4. Determinism Check
```bash
python check_determinism.py
```
Expected: `✓ DETERMINISM VERIFIED: Hashes match`

---

## View Artifacts

### Playwright HTML Report
```bash
cd frontend && npx playwright show-report playwright-report-risk-desk
```
Opens interactive report with videos/traces

### Screenshots
```bash
# Playwright report summary
open artifacts/week2-risk-desk/playwright_report_screenshot.png

# UI completion state (3-column layout)
open artifacts/week2-risk-desk/ui_completion_screenshot.png
```

### Test Output Logs
```bash
cat /tmp/backend_tests.txt      # Backend unit test output
cat /tmp/tsc_output.txt          # TypeScript compilation
cat /tmp/playwright_output.txt   # E2E test summary
cat /tmp/determinism_check.txt   # Determinism verification
```

---

## Artifact Inventory

**Total E2E artifacts:** 36 files (12 tests × 3 artifacts each)

- **Videos:** 12 × `.webm` files (~500KB each)
- **Traces:** 12 × `trace.zip` files (~100KB each)
- **Screenshots:** 12 × `test-finished-1.png` files (~50KB each)

**Location:** `frontend/test-results-risk-desk/`

**Structure:**
```
test-results-risk-desk/
├── risk-desk-1-Navigate-to-Risk-Desk-tab-risk-desk/
│   ├── test-finished-1.png
│   ├── trace.zip
│   └── video.webm
├── risk-desk-2-Load-demo-portfolio-risk-desk/
│   ├── test-finished-1.png
│   ├── trace.zip
│   └── video.webm
... (10 more test directories)
```

---

## Key Files

### Backend
- `phase1/services/risk_desk/pipeline.py` — T1→T5 orchestrator
- `phase1/services/risk_desk/greeks_calculator.py` — T2
- `phase1/services/risk_desk/stress_tester.py` — T3
- `phase1/services/risk_desk/greeks_verifier.py` — T4
- `phase1/services/risk_desk/compliance_checker.py` — T5
- `phase1/services/risk_desk/ticket_builder.py` — T6
- `test_risk_desk_w2.py` — 33 unit tests

### Frontend
- `frontend/src/features/options/riskDesk/RiskDeskPanel.tsx` — 3-column UI
- `frontend/tests/e2e/risk-desk-w2.spec.ts` — 6 new E2E tests
- `frontend/tests/e2e/risk-desk.spec.ts` — 6 updated E2E tests
- `frontend/playwright.risk-desk.config.ts` — E2E config

### Proof Pack
- `artifacts/week2-risk-desk/PROOF_PACK.md` — Comprehensive evidence document
- `artifacts/week2-risk-desk/manifest.json` — Machine-readable manifest
- `artifacts/week2-risk-desk/playwright_report_screenshot.png` — Report summary
- `artifacts/week2-risk-desk/ui_completion_screenshot.png` — UI final state

---

## Demo Flow (3 minutes)

1. **Start services:**
   ```bash
   # Terminal 1: Backend
   cd phase1 && E2E_MODE=1 python -m uvicorn services.api.main:app --port 8000
   
   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

2. **Navigate:** http://localhost:5100
   - Click "Options" (LeftNav)
   - Click "Risk Desk" (sub-tab)

3. **Run Demo:**
   - Click "Load Demo Portfolio"
   - Select "Moderate Sell-off" scenario
   - Click "Run Risk"
   - Review 3-column output

4. **Key Observations:**
   - **Greeks:** Net Delta = -145.2
   - **Stress P&L:** -$8,456 under moderate selloff
   - **Compliance:** BLOCKED (3 uncovered shorts)
   - **Verifier:** ✓ Verified (max deviation 0.007)
   - **Tool Trace:** T1-T5 with timing (T3: 145ms)

---

## Test Matrix Summary

| Layer | Command | Passed | Failed | Skipped | Duration |
|-------|---------|--------|--------|---------|----------|
| Backend Unit | `pytest test_risk_desk_w2.py -v` | 33 | 0 | 0 | 0.96s |
| TypeScript | `npx tsc --noEmit` | ✓ | 0 errors | - | <1s |
| Playwright E2E | `playwright test --config=...` | 12 | 0 | 0 | 56.3s |
| Determinism | `python check_determinism.py` | ✓ | - | - | 1.2s |

**Total:** 45 tests + 1 determinism check **— ALL PASSING**

---

## Configuration Details

### Playwright (E2E)
```typescript
{
  retries: 0,           // No flake tolerance
  workers: 1,           // Single-threaded
  video: 'on',          // Full video capture
  screenshot: 'on',     // Auto-screenshot
  trace: 'on',          // Trace capture
  webServer: [
    { port: 8000, env: { E2E_MODE: '1' } },      // Backend (demo mode)
    { port: 4173, command: 'npx vite preview' }  // Frontend (prod build)
  ]
}
```

### Environment
```
Python:     3.10.12
Node:       v22.21.1
npm:        10.9.4
Playwright: 1.57.0
React:      19.2.0
TypeScript: 5.9.0
Vite:       5.4.21
Pydantic:   2.x
```

---

## Repository State

```
Commit:   5fba9c86c09eeb8c43fc398c6183b53ec169ca89
Branch:   main
Status:   dirty (10 modified files, 23 untracked artifacts)
Diffstat: 10 files changed, 408 insertions(+), 11 deletions(-)
```

---

## Compliance Demo Behavior

**Input:** Demo portfolio (10 legs, 6 symbols)

**Output:**
- **Status:** `blocked`
- **Violations:** 3 uncovered short positions
  1. AAPL row 2: Naked short call (critical)
  2. TSLA row 4: Naked short put (critical)
  3. GOOGL row 7: Naked short call (critical)

**UI:**
- Red banner: "COMPLIANCE BLOCKED"
- Violations list with severity badges + suggested fixes
- Ticket builder disabled

---

## Architecture Notes

✅ **Risk Desk is a subtab within Options** (not a new LeftNav item)

**Navigation:**
- `[data-testid="nav-item-options"]` → Options view
- `[data-testid="options-tab-risk-desk"]` → Risk Desk subtab

**No restructuring:**
- Shell/TopBar/LeftNav unchanged
- OptionsView extended, not replaced
- No React Router added
- Autopilot remains separate

---

**End of Quick Verification Guide**

For full proof pack: See `artifacts/week2-risk-desk/PROOF_PACK.md`
