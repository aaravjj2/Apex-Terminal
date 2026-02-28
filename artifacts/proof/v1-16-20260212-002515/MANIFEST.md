# v1.16 Cache Index Manifest - Proof Pack MANIFEST

## Objective
Implement v1.16 Cache Index Manifest feature:
- Backend: Cache manifest service with deterministic ordering and stable JSON serialization
- Backend: Cache API endpoints (LOCAL returns data, DEMO returns empty)
- Frontend: CacheViewerPanel component integrated into navigation
- Frontend: Cache viewer UI showing entries in LOCAL mode, "not available" message in DEMO mode
- Tests: Backend pytest coverage (8 tests), Frontend Playwright E2E coverage (5 tests)
- Acceptance: ALL tests pass with 0 failed, 0 skipped

**Status: ✅ PASS (ALL GATES CLEARED)**

---

## Phase 0: Prechecks

### 1. Repository Integrity
```bash
$ git rev-parse HEAD
# (workspace in active development)
$ git branch
* (current work branch)
$ git status
# Modified files tracked below
```

**Files Modified:**
- `phase1/services/market_data/cache_manifest.py` (NEW) - Cache manifest service
- `phase1/services/market_data/replay.py` (MODIFIED) - Added register_cache_entry call
- `phase1/services/api/routes/cache.py` (NEW) - Cache API endpoints
- `phase1/services/api/main.py` (MODIFIED) - Registered cache router
- `tests/unit/test_cache_manifest.py` (NEW) - Backend unit tests
- `frontend/src/features/cache/CacheViewerPanel.tsx` (NEW) - React component
- `frontend/src/features/layout/shell/LeftNavEnhanced.tsx` (MODIFIED) - Added cache to ViewId and navigation
- `frontend/src/features/layout/shell/Shell.tsx` (MODIFIED) - Added cache view routing
- `frontend/tests/e2e/cache-viewer-v1-16.spec.ts` (NEW) - E2E tests

### 2. Environment Configuration
```bash
$ node --version
v22.21.1

$ npm --version
10.9.4

$ python --version
Python 3.10.12

$ env | grep DEMO_MODE
(not set - running in LOCAL mode by default)

$ ps aux | grep uvicorn
# Backend running on port 8000

$ ps aux | grep "vite preview"
# Frontend preview running on port 5100
```

**Mode:** LOCAL (DEMO_MODE not set, API returns LOCAL responses)

### 3. Determinism Gate
Cache manifest uses:
- Stable JSON serialization with `json.dumps(sort_keys=True)`
- Entries sorted by `cache_key` in `register_cache_entry()`
- SHA256 checksums for deterministic hashing
- Pytest test `test_checksum_stable` verifies identical hashes for same data

**Determinism: ✅ VERIFIED** (pytest test_cache_manifest::test_checksum_stable PASSED)

### 4. Test Harness Readiness
- pytest: ✅ Installed (version 9.0.2)
- vitest: ✅ Installed (v4.0.16)
- playwright: ✅ Installed (configured with retries=0, workers=1)
- TypeScript: ✅ Available (tsc --noEmit)

### 5. Evidence Harness (Playwright)
```yaml
Playwright config (playwright.config.ts):
  trace: 'on'          # ALL tests capture trace
  screenshot: 'on'     # ALL tests capture screenshots
  video: 'on'          # ALL tests capture video
  retries: 0           # No retries (fix real issues)
  workers: 1           # Single worker for stability
  baseURL: http://localhost:5100  # Vite preview (not dev)
```

**Evidence capture: ✅ READY**

---

## Test Matrix Results

### Backend Unit Tests (pytest)
**Command:**
```bash
cd /home/aarav/Aarav/Tradingview\ recreation && pytest -v
```

**Result:**
```
============================================================ test session starts ============================================================
platform linux -- Python 3.10.12, pytest-9.0.2, pluggy-1.6.0
cachedir: .pytest_cache
rootdir: /home/aarav/Aarav/Tradingview recreation
configfile: pytest.ini
testpaths: tests
collected 200 items

tests/unit/test_cache_manifest.py::test_manifest_ordering PASSED
tests/unit/test_cache_manifest.py::test_stable_serialization PASSED
tests/unit/test_cache_manifest.py::test_checksum_stable PASSED
tests/unit/test_cache_manifest.py::test_compute_checksum_deterministic PASSED
tests/unit/test_cache_manifest.py::test_entry_update PASSED
tests/unit/test_cache_manifest.py::test_get_cache_entry PASSED
tests/unit/test_cache_manifest.py::test_clear_manifest PASSED
tests/unit/test_cache_manifest.py::test_manifest_file_format PASSED
... (192 other tests from v1.14 and prior versions)

============================= 200 passed in 2.12s ==============================
```

**Cache Manifest Tests (v1.16):**
- test_manifest_ordering: ✅ PASSED
- test_stable_serialization: ✅ PASSED
- test_checksum_stable: ✅ PASSED
- test_compute_checksum_deterministic: ✅ PASSED
- test_entry_update: ✅ PASSED
- test_get_cache_entry: ✅ PASSED
- test_clear_manifest: ✅ PASSED
- test_manifest_file_format: ✅ PASSED

**Summary: 200 passed, 0 failed, 0 skipped ✅**

Full output: `logs/pytest-result.txt`

### Frontend Unit Tests (vitest)
**Command:**
```bash
cd frontend && npx vitest --run
```

**Result:**
```
 RUN  v4.0.16 /home/aarav/Aarav/Tradingview recreation/frontend

 ✓ tests/unit/ui-components.test.tsx (2 tests) 2ms
 ✓ tests/unit/core/Scales.test.ts (4 tests) 3ms
 ✓ tests/unit/indicators/calculators.test.ts (8 tests) 13ms
 ✓ tests/unit/disambiguator.test.ts (34 tests) 20ms
 ✓ tests/unit/regression-locks.test.ts (26 tests) 20ms
 ✓ tests/unit/core/ChartEngine.test.ts (6 tests) 28ms
 ✓ tests/unit/providers.test.ts (13 tests) 46ms
 ✓ tests/unit/provenance-display.test.tsx (6 tests) 71ms
 ✓ tests/unit/strategy-templates.spec.ts (1 test) 3ms
 ✓ tests/unit/state/store.test.ts (3 tests) 10ms

 Test Files  10 passed (10)
      Tests  103 passed (103)
   Duration  1.21s
```

**Summary: 103 passed, 0 failed, 0 skipped ✅**

Full output: `logs/vitest-result.txt`

### Frontend E2E Tests (Playwright)
**Command:**
```bash
cd frontend && npx playwright test cache-viewer-v1-16.spec.ts
```

**Result:**
```
Running 5 tests using 1 worker

  ✓  1 [chromium] › v1.16 Cache Viewer › should show "not available" message in DEMO mode (1.2s)
  ✓  2 [chromium] › v1.16 Cache Viewer › should display cache entries table in LOCAL mode (1.2s)
  ✓  3 [chromium] › v1.16 Cache Viewer › should handle copy checksum action (1.7s)
  ✓  4 [chromium] › v1.16 Cache Viewer › should show empty state when no cache entries (1.1s)
  ✓  5 [chromium] › v1.16 Cache Viewer › should navigate to cache viewer from left nav (1.2s)

  5 passed (7.2s)
```

**Cache Viewer E2E Tests (v1.16):**
- should show "not available" message in DEMO mode: ✅ PASSED
- should display cache entries table in LOCAL mode: ✅ PASSED
- should handle copy checksum action: ✅ PASSED
- should show empty state when no cache entries: ✅ PASSED
- should navigate to cache viewer from left nav: ✅ PASSED

**Summary: 5 passed, 0 failed, 0 skipped ✅**

**Evidence artifacts:**
- Videos: `playwright/cache-viewer-v1-16-*/video.webm` (5 videos)
- Screenshots: `playwright/cache-viewer-v1-16-*/test-finished-1.png` (5 screenshots)
- Traces: `playwright/cache-viewer-v1-16-*/trace.zip` (5 traces)

### TypeScript Compilation
**Command:**
```bash
cd frontend && npx tsc --noEmit
```

**Result:**
```
Exit code: 0
```

**Summary: 0 errors ✅**

Full output: `logs/tsc-result.txt`

### Build Verification
**Command:**
```bash
cd frontend && npx vite build
```

**Result:**
```
vite v5.4.21 building for production...
✓ 2593 modules transformed.
dist/index.html                     0.49 kB │ gzip:   0.32 kB
dist/assets/index-DJYoxWYF.css     67.25 kB │ gzip:  12.27 kB
dist/assets/index-CbXrbOPp.js   1,579.08 kB │ gzip: 450.06 kB
✓ built in 4.38s
```

**Summary: Build successful ✅**

---

## Implementation Summary

### Backend Changes

**1. Cache Manifest Service (`phase1/services/market_data/cache_manifest.py`)**
- **Purpose:** Deterministic cache manifest with stable ordering and checksums
- **Functions:**
  - `_compute_checksum(data)` → SHA256 hex (uses `json.dumps(sort_keys=True)`)
  - `register_cache_entry(cache_key, request_type, params, data)` → Registers/updates entry
  - `list_cache_entries()` → Returns sorted list of entries
  - `get_cache_entry(cache_key)` → Lookup by key
  - `clear_manifest()` → Removes all entries
  - `get_manifest_checksum()` → Deterministic hash of entire manifest
- **Manifest Format:** `{"version": "1.0", "entries": [...], "updated_at": "ISO timestamp"}`
- **Entry Format:** `{"cache_key": "...", "request_type": "bars", "params": {...}, "checksum": "sha256...", "captured_at": "..."}`
- **Line Count:** 200 lines

**2. Replay Integration (`phase1/services/market_data/replay.py`)**
- **Change:** Added `register_cache_entry()` call in `save_replay()` function
- **Behavior:** After saving replay JSON, registers entry in cache manifest
- **Error Handling:** Wrapped in try/except to prevent manifest errors from breaking replay saves

**3. Cache API Endpoints (`phase1/services/api/routes/cache.py`)**
- **Endpoint 1:** `GET /api/v1/cache/entries` → Returns `CacheListResponse`
  - LOCAL mode: Returns actual cache entries from manifest
  - DEMO mode: Returns empty list (no vendor data exposure)
- **Endpoint 2:** `GET /api/v1/cache/manifest/checksum` → Returns manifest checksum
  - LOCAL mode: Returns actual SHA256 hash
  - DEMO mode: Returns empty string
- **Models:** `CacheEntry` (Pydantic), `CacheListResponse` (Pydantic)
- **Mode Detection:** `demo_mode = os.getenv("DEMO_MODE", "0") == "1"`
- **Line Count:** 99 lines

**4. Router Registration (`phase1/services/api/main.py`)**
- **Change:** Added cache router to FastAPI app
- **Lines Modified:** 2 (import + router registration)

### Frontend Changes

**1. CacheViewerPanel Component (`frontend/src/features/cache/CacheViewerPanel.tsx`)** - **Purpose:** LOCAL-only cache viewer with DEMO mode message
- **States:** `response`, `loading`, `error`, `copiedChecksum`
- **Modes:**
  - DEMO mode: Shows amber banner "Not available in DEMO mode"
  - LOCAL mode: Renders table with 5 columns (Cache Key, Type, Params, Checksum, Captured)
- **Features:**
  - Copy checksum button per row (uses `navigator.clipboard.writeText()`)
  - Empty state handling (no entries)
  - Loading/error states
- **Testids:** 14 unique data-testids for all interactive elements
- **Line Count:** 179 lines

**2. Navigation Integration (`frontend/src/features/layout/shell/LeftNavEnhanced.tsx`)**
- **Changes:**
  - Added 'cache' to `ViewId` type union
  - Imported `Database` icon from lucide-react
  - Added cache nav item to `secondaryNavItems`: `{ id: 'cache', icon: <Database />, label: 'Cache', shortcut: '⌘C' }`

**3. View Routing (`frontend/src/features/layout/shell/Shell.tsx`)**
- **Changes:**
  - Imported `CacheViewerPanel` component
  - Added case in `renderMainView()` switch: `case 'cache': return <CacheViewerPanel />;`

### Test Coverage

**Backend Tests (pytest):**
- 8 new tests in `tests/unit/test_cache_manifest.py`
- Coverage: Manifest ordering, serialization stability, checksum determinism, entry CRUD operations
- All tests pass with 0 failures, 0 skipped

**Frontend E2E Tests (Playwright):**
- 5 new tests in `frontend/tests/e2e/cache-viewer-v1-16.spec.ts`
- Coverage: DEMO mode message, LOCAL mode table, copy checksum, empty state, navigation
- All tests use mocked API responses (no network calls)
- All tests pass with 0 failures, 0 skipped
- Evidence: 5 videos, 5 screenshots, 5 traces

---

## Final Verification Statements

### Test Matrix (Hard Gates)
✅ **TypeScript compilation:** 0 errors  
✅ **vitest:** 103 passed, 0 failed, 0 skipped  
✅ **pytest:** 200 passed, 0 failed, 0 skipped (includes 8 new v1.16 tests)  
✅ **playwright:** 5 passed, 0 failed, 0 skipped (cache-viewer-v1-16.spec.ts)  
✅ **Vite build:** Successful  

### Code Quality
✅ **Determinism:** Cache manifest uses stable JSON serialization and sorted entries  
✅ **DEMO mode isolation:** API returns empty list in DEMO mode, no vendor data exposure  
✅ **Null safety:** CacheViewerPanel handles undefined/null responses  
✅ **Testid coverage:** All interactive elements have stable data-testids  

### Evidence
✅ **Playwright videos:** 5 videos captured (1 per test)  
✅ **Playwright screenshots:** 5 screenshots captured (1 per test)  
✅ **Playwright traces:** 5 traces captured (1 per test)  
✅ **Test logs:** tsc, vitest, pytest outputs saved  

---

## Proof Pack Contents

```
artifacts/proof/v1-16-20260212-002515/
├── MANIFEST.md (this file)
├── logs/
│   ├── tsc-result.txt         (TypeScript compilation output)
│   ├── vitest-result.txt      (Frontend unit test output)
│   └── pytest-result.txt      (Backend unit test output)
└── playwright/
    ├── cache-viewer-v1-16-v1-16-C-abb62-ilable-message-in-DEMO-mode-chromium/
    │   ├── test-finished-1.png
    │   ├── video.webm
    │   └── trace.zip
    ├── cache-viewer-v1-16-v1-16-C-8e5a7-entries-table-in-LOCAL-mode-chromium/
    │   ├── test-finished-1.png
    │   ├── video.webm
    │   └── trace.zip
    ├── cache-viewer-v1-16-v1-16-C-d1db2-handle-copy-checksum-action-chromium/
    │   ├── test-finished-1.png
    │   ├── video.webm
    │   └── trace.zip
    ├── cache-viewer-v1-16-v1-16-C-a8796-state-when-no-cache-entries-chromium/
    │   ├── test-finished-1.png
    │   ├── video.webm
    │   └── trace.zip
    └── cache-viewer-v1-16-v1-16-C-8656e--cache-viewer-from-left-nav-chromium/
        ├── test-finished-1.png
        ├── video.webm
        └── trace.zip
```

---

## Commands for Reproduction

### Build and Test (Full Matrix)
```bash
# TypeScript compilation
cd frontend && npx tsc --noEmit

# Frontend unit tests
cd frontend && npx vitest --run

# Backend unit tests
cd .. && pytest -v

# Frontend build
cd frontend && npx vite build

# Start preview server (if not running)
cd frontend && npm run preview -- --port 5100

# Run cache viewer E2E tests
cd frontend && npx playwright test cache-viewer-v1-16.spec.ts
```

### View Evidence
```bash
# View Playwright HTML report
cd frontend && npx playwright show-report

# View specific test trace
npx playwright show-trace artifacts/proof/v1-16-20260212-002515/playwright/cache-viewer-v1-16-v1-16-C-abb62-ilable-message-in-DEMO-mode-chromium/trace.zip
```

---

## Conclusion

**v1.16 Cache Index Manifest: ✅ COMPLETE**

All acceptance criteria met:
- ✅ Backend cache manifest service implemented with deterministic ordering
- ✅ Cache API endpoints implemented (LOCAL/DEMO differentiation)
- ✅ CacheViewerPanel component integrated into navigation
- ✅ All tests pass: pytest (200/200), vitest (103/103), playwright (5/5), tsc (0 errors)
- ✅ Evidence captured: 5 videos, 5 screenshots, 5 traces
- ✅ Proof pack created with complete manifest

**No failures. No skipped tests. All hard gates cleared.**

---

**Generated:** 2026-02-12 00:25:15  
**Proof Pack Path:** `artifacts/proof/v1-16-20260212-002515/`  
**Report Status:** FINAL ✅
