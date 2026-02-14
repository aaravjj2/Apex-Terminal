# Proof Pack Template

This template provides structure for v1.14 and v1.15 proof packs.

---

## Directory Structure

```
artifacts/proof/
  <TIMESTAMP>-v1.14/
    MANIFEST.md
    manifest.json
    README.md
    playwright-report/
    test-results/
    screenshots/
      01-riskdesk-provider-pill.png
      02-backtest-provider-pill.png
      03-mode-banner.png
      ...
    determinism/
      canonical-replay-key.json
      canonical-replay-key.sha256
    logs/
      phase0-check.log
      tsc.log
      vitest.log
      pytest.log
      playwright.log
      selector-gate.log
  <TIMESTAMP>-v1.15/
    (same structure)
```

---

## MANIFEST.md Template

```markdown
# Proof Pack: v1.14 — Replay-First Fetch Policy

**Timestamp:** <YYYYMMDD-HHMMSS>
**Git SHA:** <commit-sha>
**Branch:** main
**Agent:** Nova (Risk Desk Industrial Agent)

---

## Objective

Implement replay-first fetching:
- Hard-block provider network calls if replay exists
- Persist replay artifacts in LOCAL-only cache
- Extend provider listing to report replay status
- Show provider/source pills everywhere

**Acceptance Criteria:**
- [ ] Replay service with canonical key hashing
- [ ] DemoProvider checks replay before fixture
- [ ] Provider listing exposes `replay_available`, `replay_enabled`, `mode`
- [ ] UI components: `ProviderPill`, `ModeBanner`
- [ ] Pytest tests: replay-hit blocks provider fetch
- [ ] Playwright tests: Pills visible in Risk Desk, Backtest
- [ ] Full validation matrix: 0 failed, 0 skipped across all test runners

---

## Phase 0 Prechecks

**Repo Integrity:**
```bash
git rev-parse HEAD
# Output: <commit-sha>

git status --porcelain | wc -l
# Output: 0 (clean) or N (uncommitted changes)

grep -r "API_KEY.*=" . --include="*.py" --exclude-dir=".git"
# Output: (none — no secrets committed)
```

**Environment Invariants:**
```bash
echo $DEMO_MODE
# Output: 1 (DEMO mode)

echo $LLM_PROVIDER
# Output: mock

echo $ENABLE_NOVA
# Output: 0 (Nova disabled)
```

**Determinism Gate:**
```bash
python check_determinism.py --runs 2 --mode demo
# Output:
# Run 1 hash: abc123...
# Run 2 hash: abc123...
# ✅ Deterministic (hashes match)
```

**Test Harness Readiness:**
```bash
npx tsc --version
# Output: Version 5.x.x

npx vitest --version
# Output: v2.x.x

pytest --version
# Output: pytest 8.x.x

npx playwright --version
# Output: Version 1.49.0
```

**Playwright Evidence Readiness:**
```bash
npx playwright show-report --help
# Output: (help text — playwright installed)

ls playwright.config.ts
# Output: playwright.config.ts (exists)

grep "video.*on" playwright.config.ts
# Output: video: 'on'

grep "trace.*on" playwright.config.ts
# Output: trace: 'on'
```

---

## Test Matrix Execution

### Backend Unit Tests (pytest)

**Command:**
```bash
pytest tests/unit/test_replay_service.py -v --tb=short
```

**Output:**
```
tests/unit/test_replay_service.py::test_canonical_key_deterministic PASSED
tests/unit/test_replay_service.py::test_replay_save_and_retrieve PASSED
tests/unit/test_replay_service.py::test_replay_blocks_provider_fetch PASSED
...
========== 10 passed in 2.34s ==========
```

**Result:** ✅ 10 passed, 0 failed, 0 skipped

### Frontend Unit Tests (vitest)

**Command:**
```bash
cd frontend && npx vitest --run
```

**Output:**
```
 ✓ src/features/shared/ProviderPill.test.tsx (5 tests)
...
Test Files  12 passed (12)
     Tests  145 passed (145)
```

**Result:** ✅ 145 passed, 0 failed, 0 skipped

### TypeScript Compilation

**Command:**
```bash
cd frontend && npx tsc --noEmit
```

**Output:**
```
(no output — success)
```

**Result:** ✅ 0 errors

### Playwright E2E Tests

**Command:**
```bash
cd frontend && npx playwright test --config=playwright.config.ts
```

**Output:**
```
Running 425 tests using 1 worker
...
  425 passed (22.3m)
```

**Result:** ✅ 425 passed, 0 failed, 0 skipped, retries=0

**HTML Report:**
- Saved to: `playwright-report/index.html`
- Copied to: `artifacts/proof/<TIMESTAMP>-v1.14/playwright-report/`

**Test Results:**
- Saved to: `test-results/`
- Copied to: `artifacts/proof/<TIMESTAMP>-v1.14/test-results/`

---

## Evidence Artifacts

### Screenshots

**Location:** `artifacts/proof/<TIMESTAMP>-v1.14/screenshots/`

| File | Description |
|------|-------------|
| `01-riskdesk-provider-pill.png` | Risk Desk with provider pill visible |
| `02-backtest-provider-pill.png` | Backtest with provider pill in header |
| `03-mode-banner-demo.png` | Mode banner showing DEMO mode |
| `04-mode-banner-replay.png` | Mode banner showing replay available |
| `05-replay-hit-log.png` | Server logs showing replay cache hit |

### Determinism Proofs

**Location:** `artifacts/proof/<TIMESTAMP>-v1.14/determinism/`

**Canonical Replay Key Test:**
```bash
python -c "
from phase1.services.market_data.replay import _canonical_key
import json

params1 = {'symbol': 'AAPL', 'start': '2024-01-01', 'end': '2024-01-31'}
params2 = {'end': '2024-01-31', 'symbol': 'AAPL', 'start': '2024-01-01'}

key1 = _canonical_key('bars', params1)
key2 = _canonical_key('bars', params2)

result = {
  'params1_order': list(params1.keys()),
  'params2_order': list(params2.keys()),
  'key1': key1,
  'key2': key2,
  'match': key1 == key2
}

print(json.dumps(result, indent=2, sort_keys=True))
" > determinism/canonical-replay-key.json

cat determinism/canonical-replay-key.json | sha256sum > determinism/canonical-replay-key.sha256
```

**Output (canonical-replay-key.json):**
```json
{
  "key1": "bars_a1b2c3d4e5f6g7h8",
  "key2": "bars_a1b2c3d4e5f6g7h8",
  "match": true,
  "params1_order": ["symbol", "start", "end"],
  "params2_order": ["end", "symbol", "start"]
}
```

**SHA256:**
```
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  determinism/canonical-replay-key.json
```

### Logs

**Location:** `artifacts/proof/<TIMESTAMP>-v1.14/logs/`

| File | Description |
|------|-------------|
| `phase0-check.log` | Phase 0 precheck outputs |
| `tsc.log` | TypeScript compilation log |
| `vitest.log` | Frontend unit test log |
| `pytest.log` | Backend unit test log |
| `playwright.log` | Full E2E test log |
| `selector-gate.log` | Selector validation log |

---

## Final Verification Commands

**Reproduce test suite:**
```bash
# Backend
pytest tests/unit/test_replay_service.py -v

# Frontend types
cd frontend && npx tsc --noEmit

# Frontend units
npx vitest --run

# E2E
npx playwright test
```

**Expected results:**
- pytest: 10 passed, 0 failed, 0 skipped
- tsc: 0 errors
- vitest: 145 passed, 0 failed, 0 skipped
- playwright: 425 passed, 0 failed, 0 skipped

---

## Known Limitations

**NONE.** All acceptance criteria met.

---

## Sign-Off

**Agent:** Nova (Risk Desk Industrial Agent)
**Status:** ✅ COMPLETE
**Proof Pack Verified:** <TIMESTAMP>
```

---

## manifest.json Template

```json
{
  "proof_pack_version": "1.0",
  "release": "v1.14",
  "title": "Replay-First Fetch Policy",
  "timestamp": "<YYYYMMDD-HHMMSS>",
  "git": {
    "sha": "<commit-sha>",
    "branch": "main",
    "clean": true
  },
  "environment": {
    "node_version": "v22.21.1",
    "npm_version": "10.9.4",
    "python_version": "3.10.12",
    "playwright_version": "1.49.0",
    "demo_mode": true
  },
  "test_results": {
    "pytest": {
      "passed": 10,
      "failed": 0,
      "skipped": 0,
      "duration_seconds": 2.34
    },
    "vitest": {
      "passed": 145,
      "failed": 0,
      "skipped": 0,
      "duration_seconds": 8.12
    },
    "tsc": {
      "errors": 0
    },
    "playwright": {
      "passed": 425,
      "failed": 0,
      "skipped": 0,
      "retries": 0,
      "workers": 1,
      "duration_minutes": 22.3
    }
  },
  "artifacts": {
    "screenshots": [
      "screenshots/01-riskdesk-provider-pill.png",
      "screenshots/02-backtest-provider-pill.png",
      "screenshots/03-mode-banner-demo.png",
      "screenshots/04-mode-banner-replay.png",
      "screenshots/05-replay-hit-log.png"
    ],
    "determinism": [
      "determinism/canonical-replay-key.json",
      "determinism/canonical-replay-key.sha256"
    ],
    "logs": [
      "logs/phase0-check.log",
      "logs/tsc.log",
      "logs/vitest.log",
      "logs/pytest.log",
      "logs/playwright.log",
      "logs/selector-gate.log"
    ],
    "reports": [
      "playwright-report/",
      "test-results/"
    ]
  },
  "acceptance_criteria": {
    "replay_service_implemented": true,
    "replay_first_policy_enforced": true,
    "provider_listing_extended": true,
    "ui_components_created": true,
    "pytest_tests_passing": true,
    "playwright_tests_passing": true,
    "validation_matrix_clean": true
  },
  "known_limitations": []
}
```

---

## README.md Template

```markdown
# Proof Pack: v1.14 — Replay-First Fetch Policy

**Timestamp:** <YYYYMMDD-HHMMSS>
**Git SHA:** `<commit-sha>`
**Status:** ✅ COMPLETE

---

## Quick Verify

Copy/paste these commands to reproduce results:

```bash
# Navigate to repo
cd /home/aarav/Aarav/Tradingview\ recreation

# Backend tests
pytest tests/unit/test_replay_service.py -v
# Expected: 10 passed, 0 failed, 0 skipped

# Frontend types
cd frontend && npx tsc --noEmit
# Expected: (no output — 0 errors)

# Frontend units
npx vitest --run
# Expected: 145 passed, 0 failed, 0 skipped

# E2E tests
npx playwright test
# Expected: 425 passed, 0 failed, 0 skipped, retries=0, workers=1
```

---

## What Was Implemented

1. **Replay Service** (`phase1/services/market_data/replay.py`):
   - Canonical key hashing (SHA256-based, deterministic)
   - Replay artifact storage (JSON in `phase1/cache/replay/`)
   - Replay-first policy enforcement

2. **DemoProvider Integration** (`providers/demo_provider.py`):
   - Check replay cache before fixture load
   - Save replay artifacts in LOCAL mode
   - Respect `enable_replay_save` flag

3. **Provider Listing Extension** (`providers/__init__.py`, `types.py`):
   - Report `replay_available`, `replay_enabled`, `mode`
   - API endpoint `/api/v1/market_data/providers` updated

4. **UI Components** (`frontend/src/features/shared/ProviderPill.tsx`):
   - `ProviderPill`: Mode/provider/source badges with stable testids
   - `ModeBanner`: Persistent banner (DEMO vs LOCAL, replay status)

5. **Tests**:
   - Pytest: 10 unit tests for replay service
   - Playwright: 5 E2E tests for provider pills + mode banner

---

## Artifacts

- **Screenshots:** `screenshots/` (5 images)
- **Determinism Proofs:** `determinism/` (canonical key hash equality)
- **Logs:** `logs/` (phase0, tsc, vitest, pytest, playwright)
- **Reports:** `playwright-report/`, `test-results/`

---

## Known Limitations

**NONE.** All acceptance criteria met with 0 failed tests, 0 skipped tests.
```

---

## Execution Steps

### 1. Create Proof Pack Directories

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p artifacts/proof/${TIMESTAMP}-v1.14/{screenshots,determinism,logs}
mkdir -p artifacts/proof/${TIMESTAMP}-v1.15/{screenshots,determinism,logs}
```

### 2. Run Full Test Matrix & Capture Logs

```bash
# Backend
pytest tests/unit/test_replay_service.py -v > artifacts/proof/${TIMESTAMP}-v1.14/logs/pytest.log 2>&1

# Frontend types
cd frontend
npx tsc --noEmit > ../artifacts/proof/${TIMESTAMP}-v1.14/logs/tsc.log 2>&1

# Frontend units
npx vitest --run > ../artifacts/proof/${TIMESTAMP}-v1.14/logs/vitest.log 2>&1

# E2E
npx playwright test > ../artifacts/proof/${TIMESTAMP}-v1.14/logs/playwright.log 2>&1
```

### 3. Copy Final Reports

```bash
cp -r frontend/playwright-report artifacts/proof/${TIMESTAMP}-v1.14/
cp -r frontend/test-results artifacts/proof/${TIMESTAMP}-v1.14/
```

### 4. Generate Determinism Proofs

```bash
cd artifacts/proof/${TIMESTAMP}-v1.14/determinism
python -c "
from phase1.services.market_data.replay import _canonical_key
import json

params1 = {'symbol': 'AAPL', 'start': '2024-01-01', 'end': '2024-01-31'}
params2 = {'end': '2024-01-31', 'symbol': 'AAPL', 'start': '2024-01-01'}

key1 = _canonical_key('bars', params1)
key2 = _canonical_key('bars', params2)

result = {
  'params1_order': list(params1.keys()),
  'params2_order': list(params2.keys()),
  'key1': key1,
  'key2': key2,
  'match': key1 == key2
}

print(json.dumps(result, indent=2, sort_keys=True))
" > canonical-replay-key.json

sha256sum canonical-replay-key.json > canonical-replay-key.sha256
```

### 5. Copy Screenshots

```bash
# From Playwright test results
cp frontend/test-results/**/v1-14-*.png artifacts/proof/${TIMESTAMP}-v1.14/screenshots/
```

### 6. Write Manifests

Use templates above to create:
- `MANIFEST.md`
- `manifest.json`
- `README.md`

Replace placeholders with actual values:
- `<YYYYMMDD-HHMMSS>` → actual timestamp
- `<commit-sha>` → output of `git rev-parse HEAD`
- Test counts → actual results from logs

### 7. Repeat for v1.15

Same structure, update with v1.15-specific content (schema tests, error states, etc.)

---

## Checklist

- [ ] Directories created for both v1.14 and v1.15
- [ ] Full test matrix executed and logged
- [ ] Playwright reports copied
- [ ] Determinism proofs generated
- [ ] Screenshots copied from test results
- [ ] MANIFEST.md written with exact commands + results
- [ ] manifest.json created with structured metadata
- [ ] README.md created with quick verify commands
- [ ] Known limitations section is empty (or documents blockers)
- [ ] Git SHA recorded in all manifests
- [ ] Test counts match 0 failed / 0 skipped requirement

---

## NEXT STEP

After proof packs finalized, commit all changes and create final delivery summary.
