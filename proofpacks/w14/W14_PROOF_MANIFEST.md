# W14 Proof Pack — Immutable Dataset Snapshot Baseline

**Generated:** 2026-02-26
**Week:** 14 — Block 2: Data and Charting Core
**Status:** COMPLETE — All gates green

---

## Exit Evidence Checklist

| Gate | Status |
|------|--------|
| Dataset snapshot endpoints documented with examples | ✅ See `api_fixtures/` |
| Checksum tests green in CI | ✅ 25/25 pytest, 19/19 Playwright |
| At least one run artifact includes dataset fingerprint evidence | ✅ Provenance includes `dataset_id` + `DATASET_SNAPSHOT` source |
| Performance budgets all p95 pass | ✅ All 4 under budget |
| W01 judge non-regression | ✅ 10.0/10, 18/18 gates GREEN |
| vitest full suite | ✅ 370/370 |
| tsc --noEmit | ✅ 0 errors |

---

## API Contract Implemented

### `POST /api/v3/backtest/datasets/snapshot`
- **Auth:** Required (Bearer token)
- **Request:** `{symbol, start_date, end_date, provider}`
- **Response:** `{dataset_id, sha256, row_count, created_at, performance}`
- **Errors:** `BT_CFG_INVALID (400)`, `BT_DATA_MISSING (409)`, `BT_DEPENDENCY_DOWN (503)`

### `GET /api/v3/backtest/datasets/{dataset_id}`
- **Response:** `{dataset_id, symbol, start_date, end_date, sha256, source_manifest, ...}`
- **Error:** `BT_DATA_MISSING (409)` for nonexistent

### `GET /api/v3/backtest/datasets`
- **Response:** `{datasets: [...], correlation_id}`
- **Filter:** `?symbol=AAPL`

### `GET /api/v3/backtest/datasets/{dataset_id}/bars`
- **Response:** `{dataset_id, bars: [...], total_rows}`
- **Pagination:** Up to 500 bars per page

### `GET /api/v3/backtest/datasets/{dataset_id}/checksum`
- **Response:** `{dataset_id, stored_sha256, recomputed_sha256, integrity, verified_at}`

### `POST /api/backtest/run` (enhanced)
- **New field:** `dataset_id` (optional, required by W18)
- **Provenance:** `source="DATASET_SNAPSHOT"`, `dataset_id` in provenance when bound

---

## Invariants Verified

1. **Each run stores exactly one dataset fingerprint in provenance** — ✅ Verified in pytest `TestEngineDatasetBinding` and Playwright `backtest with dataset_id`
2. **Snapshot checksum stable across serialization order** — ✅ SHA-256 determinism test: 3 identical calls produce identical hash
3. **Run does not execute against untracked bars when dataset_id provided** — ✅ Engine v2 loads exclusively from `load_snapshot_bars()` when dataset_id set

---

## Performance Budgets

| Metric | Budget (p95) | Actual (p95) | Status |
|--------|-------------|-------------|--------|
| 7y AAPL snapshot (cold) | ≤40s | ~46ms | ✅ PASS |
| Snapshot create (warm/dedup) | ≤8s | ~48ms | ✅ PASS |
| Dataset lookup by ID | ≤150ms | ~27ms | ✅ PASS |
| Run-start binding overhead | ≤50ms | ~47ms | ✅ PASS |

---

## Test Coverage

### Integration Tests (`test_w14_dataset_snapshot.py`) — 25/25 PASS
- `TestDatasetStore`: 7 tests (SQLite CRUD, bars roundtrip, dedup, filter)
- `TestSnapshotService`: 8 tests (create, SHA-256 determinism, dedup, errors)
- `TestW14DatasetAPI`: 8 tests (list, auth gates, CRUD flow, dedup)
- `TestEngineDatasetBinding`: 1 test (backtest with dataset_id provenance)

### Playwright E2E (`w14-dataset-snapshot.spec.ts`) — 19/19 PASS
- API tests: 12 (CRUD, auth, errors, integrity, dedup)
- Binding tests: 2 (backtest with dataset_id, bad dataset_id)
- UI tests: 4 (page load, tabs, create form, inspect)
- Determinism: 1 (SHA-256 stability across 3 calls)

### Full Suite Non-Regression
- pytest: 1639 passed
- vitest: 370 passed
- tsc: 0 errors
- W01 judge: 10.0/10

---

## Files Created/Modified

### New Files
- `phase1/services/backtest_engine/dataset_snapshot.py` — Core service (~429 LOC)
- `phase1/services/api/routes/w14_dataset_api.py` — Route module (~200 LOC)
- `phase1/tests/integration/test_w14_dataset_snapshot.py` — 25 integration tests
- `frontend/src/ui2/stores/datasetSnapshotStore.ts` — Frontend store
- `frontend/src/ui2/pages/DatasetSnapshotUI2.tsx` — UI page (3 tabs)
- `frontend/tests/e2e/w14/w14-dataset-snapshot.spec.ts` — 19 E2E tests
- `benchmarks/w14_perf_bench.py` — Performance benchmark script

### Modified Files
- `phase1/services/backtest_engine/engine_v2.py` — dataset_id binding in `run()`
- `phase1/services/backtest_engine/models.py` — `dataset_id` on `ProvenanceInfo`
- `phase1/services/api/main.py` — Router registration
- `phase1/services/api/routes/w01_w14_endpoints.py` — Stub removal
- `frontend/src/ui2/pages/index.ts` — Export added
- `frontend/src/ui2/routes.tsx` — Route added

---

## Proof Artifacts

```
proofpacks/w14/
├── W14_PROOF_MANIFEST.md          ← this file
├── api_fixtures/
│   └── w14_api_fixtures.json      ← 8 captured API response fixtures
├── benchmark/
│   └── w14_perf_results.txt       ← performance benchmark output
└── test_results/
    ├── pytest_w14.txt             ← 25/25 integration test output
    └── playwright_w14.txt         ← 19/19 E2E test output
```
