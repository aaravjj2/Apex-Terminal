# Proof Pack: v1.30 + v1.31 Combined Release

## Release Info
| Key | Value |
|-----|-------|
| Versions | v1.30 (Strategy Diff Viewer + Version Lineage), v1.31 (Strategy-to-Backtest Binding) |
| Git SHA | 075c0fe2436033fa30bb846a99317ebb29f3663a |
| Date | 2026-02-12 |
| Node | v22.21.1 |
| Python | 3.10.12 |
| Playwright | 1.57 |

## v1.30: Strategy Diff Viewer + Version Lineage

### Backend Changes
- `phase1/services/strategy_lab/artifact_models.py`: Added `DEMO_TIMESTAMP`, `parent_id`, `derived_from` fields to `StrategyArtifact`, updated `build_artifact()`
- `phase1/services/strategy_lab/artifact_diff.py`: **NEW** — Deterministic diff engine with `compute_diff()`, `compute_diff_hash()`, `get_lineage_chain()`
- `phase1/services/strategy_lab/artifact_store.py`: Updated `create()` to accept lineage params
- `phase1/services/api/routes/strategy_artifacts.py`: Added `POST /diff`, `GET /{id}/lineage` endpoints

### Frontend Changes
- `frontend/src/features/options/strategyLab/artifactTypes.ts`: Added `DiffChange`, `DiffResult`, `LineageEntry` types
- `frontend/src/features/options/strategyLab/StrategyDiffPanel.tsx`: **NEW** — Side-by-side canonical JSON diff viewer
- `frontend/src/features/options/strategyLab/StrategyLabPanel.tsx`: Added "Diff" tab
- `frontend/src/features/options/strategyLab/index.ts`: Export new component

### E2E Tests
- `frontend/tests/e2e/strategy-diff-v1-30.spec.ts`: 7 tests, all passing

### Determinism Proofs
- `determinism/v1.30/diff_input.json`: Input artifact pair
- `determinism/v1.30/diff_output.json`: Deterministic diff output
- `determinism/v1.30/diff_output.sha256`: SHA-256 verification (3/3 identical runs)

### data-testid Selectors
- `strategy-diff-panel`: Diff viewer container
- `strategy-diff-left-select`: Left artifact selector
- `strategy-diff-right-select`: Right artifact selector
- `strategy-diff-open`: Compute diff button
- `strategy-diff-left-json`: Left canonical JSON display
- `strategy-diff-right-json`: Right canonical JSON display
- `strategy-diff-changes`: Changes list container
- `strategy-diff-ready`: Hidden marker for E2E readiness
- `strategy-lineage-panel`: Lineage chain container
- `strategy-lineage-item-{n}`: Individual lineage entries

## v1.31: Strategy-to-Backtest Binding

### Backend Changes
- `phase1/services/backtest_engine/models.py`: Added `strategy_artifact_id` to `BacktestConfig` (auto-included in `config_hash`)

### Frontend Changes
- `frontend/src/features/backtest/types.ts`: Added `strategy_artifact_id` to `BacktestConfig`
- `frontend/src/features/backtest/BacktestPanel.tsx`: Added artifact ID field, consumes `pendingStrategyArtifactId` from app store
- `frontend/src/features/options/strategyLab/StrategyArtifactsPanel.tsx`: Added "Run Backtest" button per artifact row
- `frontend/src/state/appStore.ts`: Added `pendingStrategyArtifactId` + setter
- `frontend/src/features/layout/shell/Shell.tsx`: Added `navigate-to-backtest` event listener

### E2E Tests
- `frontend/tests/e2e/strategy-backtest-binding-v1-31.spec.ts`: 4 tests, all passing

### Determinism Proofs
- `determinism/v1.31/backtest_config_manifest.json`: Config with/without artifact_id + hash comparison
- `determinism/v1.31/backtest_config_manifest.sha256`: SHA-256 verification (3/3 identical runs)

### data-testid Selectors
- `strategy-run-backtest`: "Run Backtest" button on artifact rows
- `backtest-strategy-artifact-select`: Strategy artifact area in backtest config
- `backtest-strategy-artifact-current`: Current artifact ID input

## Test Matrix Results

| Suite | Count | Status |
|-------|-------|--------|
| Vitest (frontend unit) | 103 | All passed |
| Pytest (backend unit) | 1067 | All passed |
| TypeScript (tsc --noEmit) | 0 errors | Clean |
| Playwright v1.28 | 4 | All passed |
| Playwright v1.29 | 5 | All passed |
| Playwright v1.30 | 7 | All passed |
| Playwright v1.31 | 4 | All passed |

## Directory Structure
```
v1-30-31-20260212-194122/
├── determinism/
│   ├── v1.30/
│   │   ├── diff_input.json
│   │   ├── diff_output.json
│   │   └── diff_output.sha256
│   └── v1.31/
│       ├── backtest_config_manifest.json
│       └── backtest_config_manifest.sha256
├── logs/
│   └── e2e-v1-30-31.txt
├── screenshots/
├── playwright-report/
├── test-results/
└── MANIFEST.md
```
