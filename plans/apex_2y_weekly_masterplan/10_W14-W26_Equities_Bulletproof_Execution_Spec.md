# Backtesting Engine Execution Spec - Equities Bulletproof Phase (Weeks 14-26)

**Scope:** This document is the execution-grade spec for Weeks 14-26 and supersedes high-level wording in broader roadmap docs for these weeks.
**Goal:** Make equities backtesting production-safe before expanding DSL sophistication and broader multi-asset scope.

## Why This Exists
- Prior weekly plans were structurally complete but too templated to drive deterministic implementation.
- This spec enforces week-level engineering tickets with exact paths, API contracts, invariants, proof artifacts, and performance budgets.
- Promotion is blocked unless each week's invariants and budgets pass.

## Success Metrics (Replaces LOC-Centric Gating)
- Invariant pass rate: `>=99.5%` for `no_lookahead`, `equity_balance`, `fill_rules`, and `deterministic_rng`.
- Reproducibility pass rate: `100%` for same config + same dataset snapshot + same seed.
- Data integrity pass rate: `100%` manifest checksum verification for released datasets.
- Performance compliance: all weekly budgets pass at p95.
- Evidence completeness: all required artifacts are present under `proofpacks/wXX/`.

## Typed Error Taxonomy (Mandatory)
- `BT_CFG_INVALID` (400): request schema or domain validation failure.
- `BT_DATA_MISSING` (409): required bars/snapshot unavailable.
- `BT_DATA_STALE` (409): freshness policy breach for near-live mode.
- `BT_INVARIANT_FAIL` (422): correctness invariant violation.
- `BT_DEPENDENCY_DOWN` (503): provider/downstream service unavailable.
- `BT_RUN_TIMEOUT` (504): runtime exceeds enforced budget.

## Mandatory Weekly Ticket Template
For every week below, implementation must include:
- Code targets (exact paths).
- API contract (exact endpoints + request/response shape + typed errors).
- Invariants (provable and testable).
- Proof requirements (tests, screenshots, and when required, walkthrough video).
- Performance budgets (explicit p95 targets).
- Exit evidence (go/no-go checklist).

---

## Week 14 - Immutable Dataset Snapshot Baseline
### Code Targets
- `phase1/services/backtest_engine/data_pipeline.py`
- `phase1/services/backtest_engine/models.py`
- `phase1/services/backtest_engine/storage.py`
- `phase1/services/api/routes/backtest_v2.py`
- `phase1/services/api/routes/market_data_v1_13.py`
- `tests/unit/test_record_replay_v1_13.py`
- `tests/integration/test_determinism_v1_12.py`

### API Contract
- `POST /api/v3/backtest/datasets/snapshot`
  - Request: `{symbol,start_date,end_date,provider}`
  - Response: `{dataset_id,sha256,row_count,created_at}`
- `GET /api/v3/backtest/datasets/{dataset_id}`
  - Response: `{dataset_id,symbol,start_date,end_date,sha256,source_manifest}`
- `POST /api/backtest/run`
  - Add optional `dataset_id` in W14; required by W18.
- Errors: `BT_CFG_INVALID`, `BT_DATA_MISSING`, `BT_DEPENDENCY_DOWN`

### Invariants
- Each run must store exactly one dataset fingerprint in provenance.
- Snapshot checksum must be stable across serialization order.
- Run must not execute against untracked bars when `dataset_id` is provided.

### Proof Requirements
- Add `tests/integration/test_w14_dataset_snapshot.py`.
- Extend determinism integration test to assert dataset fingerprint fields.
- Capture API fixtures in `proofpacks/w14/`.

### Performance Budgets
- 7y AAPL snapshot create: p95 `<=40s` cold, `<=8s` warm.
- Dataset lookup endpoint: p95 `<=150ms`.
- Run-start dataset binding overhead: p95 `<=50ms`.

### Exit Evidence
- Dataset snapshot endpoints documented with examples.
- Checksum tests green in CI.
- At least one run artifact includes dataset fingerprint evidence.

---

## Week 15 - yfinance Adapter Hardening and Symbol Canon
### Code Targets
- `phase1/services/market_data/providers/yahoo_provider.py`
- `phase1/services/market_data/provider_router.py`
- `phase1/services/market_data/models.py`
- `phase1/services/api/routes/market_data.py`
- `phase1/services/api/routes/market_data_v1_13.py`
- `tests/unit/test_market_data_providers.py`
- `frontend/src/features/backtest/BacktestPanel.tsx`

### API Contract
- `POST /api/v1/market-data/bars`
  - Enforce canonical symbol normalization.
- `POST /api/v1/market-data/quote`
  - Include `provenance.provider` and `provenance.source`.
- `GET /api/v1/market-data/providers`
  - Include mode-aware deterministic capability flags.
- Errors: `BT_CFG_INVALID`, `BT_DEPENDENCY_DOWN`, `BT_DATA_STALE`

### Invariants
- Symbol normalization is deterministic (`aapl`, ` AAPL ` -> `AAPL`).
- Provider resolution cannot silently drift for same request+mode.
- Replay/cache responses preserve checksum identity.

### Proof Requirements
- Add `tests/unit/test_w15_symbol_canon.py`.
- Extend replay tests for provider identity and checksum.
- Add Playwright smoke for provider state visibility in configure flow.

### Performance Budgets
- Providers endpoint: p95 `<=80ms`.
- Bars endpoint (cache hit, 2y daily): p95 `<=300ms`.
- Quote endpoint (replay path): p95 `<=250ms`.

### Exit Evidence
- Canonical symbol policy documented and tested.
- Replay and fetch paths output same normalized schema.
- Backtest run payloads use canonical symbols.

---

## Week 16 - Canonical Bar Schema and Corporate-Action Adjustment
### Code Targets
- `phase1/services/waves21_50/backtest/canonical_schema.py`
- `phase1/services/waves21_50/backtest/corporate_actions.py`
- `phase1/services/backtest_engine/data_pipeline.py`
- `phase1/services/backtest_engine/models.py`
- `phase1/services/api/routes/backtest_v2.py`
- `tests/unit/test_w16_corporate_actions.py`
- `frontend/src/features/backtest/AnalyzeTab.tsx`

### API Contract
- `GET /api/v3/backtest/datasets/{dataset_id}/adjustments`
  - Response includes split/dividend adjustment log.
- `POST /api/backtest/run`
  - Add `adjustment_mode`: `raw|split_adjusted|total_return_adjusted`.
- `GET /api/backtest/run/{run_id}`
  - Include `adjustment_mode` and `adjustment_checksum` in provenance.
- Errors: `BT_CFG_INVALID`, `BT_DATA_MISSING`, `BT_INVARIANT_FAIL`

### Invariants
- Adjustment transform preserves row order and cardinality.
- Total-return mode is fully reconstructable from event log.
- Bar validity remains true (`low <= open/close <= high`).

### Proof Requirements
- Add `tests/integration/test_w16_adjustment_consistency.py`.
- Add deterministic split/dividend fixtures.
- Capture before/after charts in `proofpacks/w16/`.

### Performance Budgets
- Adjustment transform (10y daily, single symbol): p95 `<=500ms`.
- Run-start provenance enrichment: p95 `<=75ms`.
- Adjustments endpoint: p95 `<=200ms`.

### Exit Evidence
- Adjustment modes wired end-to-end.
- Fixtures + expected outputs committed.
- Invariant failures return typed error payloads.

---

## Week 17 - Near-Live Polling Scheduler and Freshness Gates
### Code Targets
- `phase1/services/ingestion/connectors/__init__.py`
- `phase1/services/market_data/provider_router.py`
- `phase1/services/market_data/cache_manifest.py`
- `phase1/services/api/routes/market_data_v1_13.py`
- `phase1/services/api/routes/ops_health.py`
- `frontend/src/features/chart/ChartHeaderStrip.tsx`
- `tests/unit/test_w17_freshness.py`

### API Contract
- `POST /api/v3/market-data/schedule`
  - Request: `{symbols,timeframe,poll_seconds}`
  - Response: `{schedule_id,status}`
- `GET /api/v3/market-data/freshness?symbol=...`
  - Response: `{symbol,last_fetch,age_seconds,status}`
- `POST /api/backtest/run`
  - Add `freshness_max_age_seconds` for near-live mode.
- Errors: `BT_DATA_STALE`, `BT_DEPENDENCY_DOWN`, `BT_CFG_INVALID`

### Invariants
- Partial bars are never marked final before interval close.
- Freshness age uses monotonic time source.
- Near-live runs are blocked when freshness threshold is violated.

### Proof Requirements
- Add `tests/integration/test_w17_freshness_gate.py`.
- Add Playwright coverage for freshness badge transitions.
- Archive scheduler + health traces in `proofpacks/w17/`.

### Performance Budgets
- Freshness endpoint: p95 `<=120ms`.
- Scheduler dispatch jitter: p95 `<=2s`.
- UI freshness badge update latency: `<=1s`.

### Exit Evidence
- Freshness gate enforced in run-start path.
- Ops health reports freshness/backlog correctly.
- Stale-feed failures emit typed deterministic errors.

---

## Week 18 - Replay Substrate and Provenance Ledger Completion
### Code Targets
- `phase1/services/market_data/record_replay.py`
- `phase1/services/backtest_engine/report_generator.py`
- `phase1/services/backtest_engine/storage.py`
- `phase1/services/api/routes/backtest_v2.py`
- `phase1/services/api/routes/market_data_v1_13.py`
- `tests/unit/test_record_replay_v1_13.py`
- `tests/test_backtest_export.py`

### API Contract
- `GET /api/v1/market-data/replays`
  - Return replay metadata with `cache_key`, `checksum`, `fetched_at`.
- `GET /api/backtest/run/{run_id}/artifacts`
  - Must include `run.json`, `manifest.json`, `ledger.json`.
- `POST /api/backtest/run`
  - Require one of `{dataset_id,provenance.cache_key}` by W18 exit.
- Errors: `BT_CFG_INVALID`, `BT_DATA_MISSING`, `BT_INVARIANT_FAIL`

### Invariants
- Every promoted run includes non-empty provenance + stable config hash.
- Replay artifacts are content-addressable and checksum-verified.
- Bundle ledger is internally hash-consistent.

### Proof Requirements
- Add `tests/integration/test_w18_artifact_ledger.py`.
- Add corrupted-replay negative test cases.
- Archive one full artifact bundle validation result in `proofpacks/w18/`.

### Performance Budgets
- Artifact bundle generation (<=5k trades): p95 `<=2.5s`.
- Replay lookup: p95 `<=100ms`.
- Artifact endpoint stream-start: p95 `<=400ms`.

### Exit Evidence
- No promoted run without ledger + manifest.
- Corrupted replay path emits `BT_INVARIANT_FAIL`.
- Evidence package complete in `proofpacks/w18/`.

---

## Week 19 - Multi-Timeframe Bar Builder and Alignment
### Code Targets
- `phase1/services/waves21_50/backtest/timeframe_alignment.py`
- `phase1/services/waves21_50/backtest/data_pipeline.py`
- `phase1/services/backtest_engine/data_pipeline.py`
- `phase1/services/api/routes/bars.py`
- `phase1/services/api/routes/backtest_v2.py`
- `frontend/src/features/chart/ChartCanvas.tsx`
- `tests/unit/test_w19_resampling.py`

### API Contract
- `POST /api/v3/backtest/bars/resample`
  - Request: `{dataset_id,from_tf,to_tf,session_template}`
  - Response: `{series_hash,row_count,gap_count}`
- `GET /api/v3/backtest/bars/alignment/{run_id}`
  - Response: `{run_id,session_template,gaps,overlaps}`
- `POST /api/backtest/run`
  - Add `timeframe` enum and `session_template`.
- Errors: `BT_CFG_INVALID`, `BT_INVARIANT_FAIL`, `BT_DATA_MISSING`

### Invariants
- Resample math is exact (`open=first, high=max, low=min, close=last, volume=sum`).
- No duplicate timestamps post-resample.
- Session boundaries are deterministic for same template.

### Proof Requirements
- Add `tests/unit/test_w19_resampling.py` with golden fixtures.
- Add DST/session-boundary integration tests.
- Archive alignment diagnostics in `proofpacks/w19/`.

### Performance Budgets
- Resample 1y of 1m -> 5m: p95 `<=900ms`.
- Alignment diagnostics endpoint: p95 `<=250ms`.
- Chart payload build (10k candles): p95 `<=350ms`.

### Exit Evidence
- Golden resample fixtures pass in CI.
- Alignment outputs included in run artifacts.
- Timeframe switch does not desync panes.

---

## Week 20 - Chart Contract and Synchronized Pane Engine
### Code Targets
- `frontend/src/features/chart/SupergraphChart.tsx`
- `frontend/src/features/chart/ChartControls.tsx`
- `frontend/src/features/chart/ChartHeaderStrip.tsx`
- `frontend/src/features/chart/hooks/useChartIndicators.ts`
- `phase1/services/charting/sync.py`
- `phase1/services/api/routes/bars.py`
- `frontend/tests/e2e/supergraph-chart.spec.ts`

### API Contract
- `GET /api/v3/chart/workspaces/{workspace_id}`
  - Response includes pane layout + sync groups + overlays.
- `POST /api/v3/chart/workspaces/{workspace_id}/sync`
  - Update cursor/link-group policy.
- `GET /api/v3/chart/series?symbol=...&timeframe=...`
  - Contract-stable candle schema.
- Errors: `BT_CFG_INVALID`, `BT_DATA_MISSING`, `BT_DEPENDENCY_DOWN`

### Invariants
- Linked panes share identical logical cursor timestamp.
- Series order strictly ascending by timestamp.
- Overlay calculations reference visible base-series hash.

### Proof Requirements
- Expand `supergraph-chart.spec.ts` for pane sync and overlay consistency.
- Add snapshot baselines for key chart workspace states.
- Store chart contract fixtures in `proofpacks/w20/`.

### Performance Budgets
- Chart first meaningful render (10k candles, 3 overlays): p95 `<=1.2s`.
- Crosshair sync propagation: p95 `<=16ms`.
- Workspace load endpoint: p95 `<=220ms`.

### Exit Evidence
- Pane sync e2e + screenshot gates pass.
- Chart contract versioned/documented.
- Replay cursor consistency verified across panes.

---

## Week 21 - Deterministic Fill Model Enforcement
### Code Targets
- `phase1/services/backtest/fill_simulator.py`
- `phase1/services/backtest_engine/engine_v2.py`
- `phase1/services/waves21_50/backtest/order_engine.py`
- `phase1/services/api/routes/w21_backtest_v4.py`
- `phase1/services/api/routes/backtest_v2.py`
- `tests/unit/phase4/test_fill_simulator.py`
- `tests/test_strategy_backtest.py`

### API Contract
- `POST /api/backtest/run`
  - Add `fill_model`: `{market_rule,limit_rule,stop_rule,latency_ms}`.
- `GET /api/v3/backtest/fill-models`
  - Return named model presets.
- `GET /api/backtest/run/{run_id}`
  - Include fill-model hash in metadata.
- Errors: `BT_CFG_INVALID`, `BT_INVARIANT_FAIL`

### Invariants
- No fill may reference bars after simulation cursor.
- Fill outcome is deterministic for same bars + model + seed.
- Order state machine cannot skip legal transitions.

### Proof Requirements
- Extend unit tests with no-lookahead fill assertions.
- Add `tests/integration/test_w21_fill_determinism.py`.
- Archive repeated-run trade-ledger hash comparisons.

### Performance Budgets
- Fill processing per event: p95 `<=40us`.
- 7y AAPL run (daily): p95 `<=8s` cold.
- Run detail endpoint: p95 `<=180ms`.

### Exit Evidence
- Fill-model schema and presets published.
- Deterministic trade-ledger proof in `proofpacks/w21/`.
- Invariant failures return structured typed errors.

---

## Week 22 - Commission, Slippage, and Spread Realism
### Code Targets
- `phase1/services/waves21_50/backtest/cost_models.py`
- `phase1/services/backtest/fill_simulator.py`
- `phase1/services/backtest_engine/engine_v2.py`
- `phase1/services/api/routes/backtest_v2.py`
- `frontend/src/features/backtest/BacktestLauncher.tsx`
- `frontend/src/features/backtest/types.ts`
- `tests/unit/test_w22_cost_models.py`

### API Contract
- `GET /api/v3/backtest/cost-models`
  - Return broker-style preset library + parameter bounds.
- `POST /api/backtest/run`
  - Accept `cost_model_id` or explicit `cost_model`.
- `GET /api/backtest/run/{run_id}`
  - Include per-trade cost breakdown.
- Errors: `BT_CFG_INVALID`, `BT_INVARIANT_FAIL`

### Invariants
- Cost model output is deterministic and non-negative.
- PnL identity: `gross_pnl - total_cost = net_pnl`.
- Cost-model version id is present in run manifest.

### Proof Requirements
- Add `tests/unit/test_w22_cost_models.py`.
- Add integration tests comparing zero-cost vs realistic-cost paths.
- Add UI tests for cost-model roundtrip in run payload.

### Performance Budgets
- Cost compute per fill: p95 `<=30us`.
- Cost aggregation overhead: `<=3%` total runtime.
- Cost model listing endpoint: p95 `<=90ms`.

### Exit Evidence
- Cost realism visible in API and analyze UI.
- Preset assumptions documented.
- Cost invariants fully covered in CI.

---

## Week 23 - Backtest Correctness Contract and Golden Runs
### Code Targets
- `phase1/services/api/routes/backtest_contract.py`
- `backend/core/backtest_v3.py`
- `frontend/tests/e2e/hardening/w97-backtest-contract.spec.ts`
- `tests/integration/test_determinism_v1_12.py`
- `tests/test_strategy_backtest.py`
- `docs/ops/JUDGE_MODE.md`
- `judge_loop.py`

### API Contract
- `GET /api/v3/backtest-contract/invariants`
- `POST /api/v3/backtest-contract/golden-runs/{golden_id}/execute`
- `GET /api/v3/backtest-contract/runs`
- Errors: `BT_CFG_INVALID`, `BT_INVARIANT_FAIL`

### Invariants
- `no_lookahead`, `equity_balance`, `fill_rules` all pass for every golden run.
- Golden expected results are immutable unless version-bumped with signed approval.
- Validation payload schema remains stable and machine-readable.

### Proof Requirements
- Execute Playwright suite `w97-backtest-contract.spec.ts`.
- Archive golden execution outputs/diffs in `proofpacks/w23/`.
- Update judge runbook with deterministic pass/fail interpretation.

### Performance Budgets
- Golden execute endpoint: p95 `<=2.0s`.
- Invariants endpoint: p95 `<=80ms`.
- Contract runs listing endpoint: p95 `<=120ms`.

### Exit Evidence
- All 3 golden runs pass.
- Judge-mode docs updated and validated.
- Contract checks wired to CI gate.

---

## Week 24 - Explainability and Reproducible Artifact Bundles
### Code Targets
- `phase1/services/backtest_engine/report_generator.py`
- `phase1/services/backtest_engine/storage.py`
- `phase1/services/api/routes/backtest_v2.py`
- `phase1/services/api/routes/strategy_artifacts.py`
- `frontend/src/features/backtest/AnalyzeTab.tsx`
- `frontend/src/features/trades/TradesLedger.tsx`
- `tests/test_backtest_export.py`

### API Contract
- `GET /api/backtest/run/{run_id}/artifacts`
  - Must include `run.json`, `manifest.json`, `ledger.json`, `report.html`.
- `GET /api/v3/backtest/runs/{run_id}/explain`
  - Return decision trace and feature references per trade.
- `GET /api/v3/backtest/runs/{run_id}/similarity`
  - Return nearest-run matches with explanation vector metadata.
- Errors: `BT_DATA_MISSING`, `BT_INVARIANT_FAIL`, `BT_DEPENDENCY_DOWN`

### Invariants
- Every trade links to deterministic decision trace id.
- Artifact bundle hash is stable across repeated download.
- Similarity payload includes dataset + strategy hash context.

### Proof Requirements
- Add `tests/integration/test_w24_explainability_bundle.py`.
- Add e2e tests for explainability drilldown in Analyze tab.
- Capture `>=3 min` walkthrough video (UX materially changed).

### Performance Budgets
- Explain endpoint (<=1k trades): p95 `<=300ms`.
- Similarity endpoint: p95 `<=250ms`.
- Artifact stream-start: p95 `<=450ms`.

### Exit Evidence
- Export bundle contract passes automated checks.
- Explainability trace visible and validated in UI.
- Latency report archived under `proofpacks/w24/`.

---

## Week 25 - Backtest UI Workflow Hardening
### Code Targets
- `frontend/src/features/backtest/BacktestPanel.tsx`
- `frontend/src/features/backtest/BacktestStatusHeader.tsx`
- `frontend/src/features/chart/ReplayControls.tsx`
- `frontend/src/features/replay/ReplayControlBar.tsx`
- `frontend/src/features/watchlist/WatchlistPanel.tsx`
- `frontend/tests/e2e/backtest-polish-v1-17.spec.ts`
- `frontend/tests/e2e/replay.spec.ts`

### API Contract
- `POST /api/backtest/run`
  - Error payload must include `{error_code,correlation_id,message}`.
- `GET /api/backtest/runs`
  - Deterministic sorting + cursor pagination.
- `GET /api/v3/backtest/runs/{run_id}/timeline`
  - Replay timeline hydration contract.
- Errors: `BT_CFG_INVALID`, `BT_RUN_TIMEOUT`, `BT_DEPENDENCY_DOWN`

### Invariants
- UI may not silently downgrade to demo on deterministic API failure.
- Replay cursor and analysis metrics must share same run identity/fingerprint.
- Keyboard-only flow covers configure -> run -> analyze -> replay.

### Proof Requirements
- Extend backtest/replay e2e suites for failure states + keyboard paths.
- Capture screenshots for all core workflow states.
- Capture `>=3 min` workflow walkthrough video.

### Performance Budgets
- Analyze page TTFR: p95 `<=1.5s`.
- Runs table load (100 rows): p95 `<=500ms`.
- Replay control action-to-paint: p95 `<=120ms`.

### Exit Evidence
- E2E + accessibility checks pass for full workflow.
- Typed error handling visible in UI.
- Workflow evidence archived in `proofpacks/w25/`.

---

## Week 26 - Equities Bulletproof Certification Gate
### Code Targets
- `phase1/services/api/routes/backtest_v2.py`
- `phase1/services/api/routes/backtest_contract.py`
- `phase1/services/api/routes/perf_budget.py`
- `frontend/tests/e2e/hardening/backtest-determinism.spec.ts`
- `tests/integration/test_determinism_v1_12.py`
- `docs/ops/JUDGE_MODE.md`
- `w01_judge_result.json`

### API Contract
- `GET /api/v3/perf/budgets/backtest-equities`
- `POST /api/v3/backtest-contract/certify`
- `GET /api/v3/backtest-contract/certification/latest`
- Errors: `BT_INVARIANT_FAIL`, `BT_RUN_TIMEOUT`

### Invariants
- Certification fails on any golden-run invariant failure.
- Certification fails on unresolved performance-budget breach.
- Certification artifact must include dataset/version/hash evidence.

### Proof Requirements
- Run full determinism + contract + UI hardening suites.
- Produce signed operator certification checklist.
- Capture final certification walkthrough video.

### Performance Budgets
- 7y AAPL daily run: p95 `<=8s` cold, `<=3s` warm.
- Compare endpoint: p95 `<=250ms`.
- Analyze TTFR at 10k points: p95 `<=1.5s`.

### Exit Evidence
- Equities backtesting declared production-ready with signed bundle.
- All blocking suites green in CI + judge mode.
- Week 27+ work blocked if W26 certification is not green.

---

## Carry-Forward Rule for Weeks 27-104
- Use this same ticket template for every week.
- No week can start without prior week invariant and performance signoff.
- Create one ticket file per week under:
  - `plans/apex_2y_weekly_masterplan/tickets/WXX_<slug>.md`
