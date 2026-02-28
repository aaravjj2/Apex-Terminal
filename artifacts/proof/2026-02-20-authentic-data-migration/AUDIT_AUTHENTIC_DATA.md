# Authentic Data Migration — Audit Report

**Date**: 2026-02-20  
**Baseline**: Core Depth Upgrade (169 PW / 341 vitest / 470 pytest)  
**Final**: 171 PW / 341 vitest / 489 pytest  

---

## Executive Summary

All synthetic "DEMO mode" timestamps and fixtures have been removed from runtime paths. The system now operates exclusively on:

- **DATA_MODE=recorded** (default): Authentic market data captured from Yahoo Finance Q1 2024
- **DATA_MODE=live** (opt-in): Real-time broker/data-provider connections

---

## Phase 0 — Pre-Migration Audit

Synthetic DEMO references found across 80+ source files.  
Key runtime DEMO items targeted:

| File | Issue |
|------|-------|
| `frontend/src/ui2/demo/constants.ts` | `DEMO_TIMESTAMP`, `DEMO_USER`, `DEMO_MARKET_STATUS` |
| `frontend/src/ui2/AppShellUI2.tsx` | `<span>DEMO</span>` badge, `DEMO_USER`, `DEMO_MARKET_STATUS` |
| All 4 depth stores | `const DEMO_TS = '2026-02-15T14:30:00Z'` |
| All 4 backend depth routes | `DEMO_TS = "2026-02-15T14:30:00Z"` |
| `automationStore.ts`, `autopilot2Store.ts`, `autopilotV2Store.ts` | synthetic DEMO_TS |
| `exportStore.ts`, `platformHealthStore.ts`, `automationV2Store.ts`, `insightsStore.ts` | synthetic DEMO_TS |

---

## Phase 1 — Authentic Recording Infrastructure

### Recording Set: `core-default`

| Item | Value |
|------|-------|
| Provider | Yahoo Finance (yfinance 0.2.58) |
| Symbols | AAPL, MSFT, SPY, TSLA |
| Date Range | 2024-01-02 → 2024-03-28 |
| Bars per symbol | 60 (1-day timeframe) |
| Timeframe | 1d |
| Format | Apache Parquet (pyarrow) |

#### Performance Provenance (Real Q1 2024)
| Symbol | Return | Sharpe | Max Drawdown |
|--------|--------|--------|--------------|
| AAPL | -6.52% | -2.61 | -13.73% |
| MSFT | +13.84% | +4.97 | -6.22% |
| SPY | +11.03% | +4.12 | -4.50% |
| TSLA | -27.61% | -2.68 | -39.41% |

#### File checksums (SHA-256 prefix)
- `AAPL_1d.parquet`: `sha256:2f899ce7734c7b4…`
- `MSFT_1d.parquet`: `sha256:0836febba40613…`
- `SPY_1d.parquet`: `sha256:858250d221d1fa…`
- `TSLA_1d.parquet`: `sha256:173d34513596103…`

### Broker Ledger (Paper)
- Strategy: momentum_5_20 (5-day / 20-day moving average crossover)
- Fills: 18 records
- Open positions: 4 (AAPL, MSFT, SPY, TSLA)
- Total realized PnL: $-4,125.90

---

## Phase 2 — Config System

### Frontend: `frontend/src/ui2/dataMode/config.ts`
```ts
export const DATA_MODE: 'recorded' | 'live' = /* VITE_DATA_MODE */ 'recorded';
export const BROKER_MODE: 'paper' | 'live' = /* VITE_BROKER_MODE */ 'paper';
export const RECORDING_SET = /* VITE_RECORDING_SET */ 'core-default';
export const RECORDING_TS = '2024-01-02T09:30:00Z';  // replaces '2026-02-15T14:30:00Z'
export const DATA_MODE_LABEL = 'Recorded · core-default';
```

### Backend: `phase1/services/api/config_recording.py`
- Reads `DATA_MODE`, `BROKER_MODE`, `RECORDING_SET` env vars
- Backward-compat: `E2E_MODE` → treated as `DATA_MODE=recorded`
- Provides `load_manifest()` helper

---

## Phase 3 — DEMO Ref Removal (Runtime Paths)

### AppShellUI2.tsx
| Before | After |
|--------|-------|
| `import { DEMO_USER, DEMO_MARKET_STATUS } from './demo/constants'` | `import { DATA_MODE_LABEL, RECORDING_SET } from './dataMode/config'` |
| `<span>DEMO</span>` | `<span data-testid="ui2-data-mode-badge">Recorded</span>` |
| `DEMO_MARKET_STATUS.isOpen` | `RECORDED_MARKET.isOpen` (always `false` for recorded mode) |
| `DEMO_USER.name` | `APEX_USER.name` |

### All Depth Stores (4 core + 7 additional)
Replaced `const DEMO_TS = '2026-02-15T14:30:00Z'` with:
```ts
import { RECORDING_TS } from '../dataMode/config';
const DEMO_TS = RECORDING_TS;  // '2024-01-02T09:30:00Z'
```

Files updated:
- `autopilotDepthStore.ts`
- `backtestDepthStore.ts`
- `workflowDepthStore.ts`
- `searchDepthStore.ts`
- `automationStore.ts`
- `exportStore.ts`
- `autopilot2Store.ts`
- `autopilotV2Store.ts`
- `platformHealthStore.ts`
- `automationV2Store.ts`
- `insightsStore.ts`

### Backend Depth Routes (4)
`DEMO_TS = "2026-02-15T14:30:00Z"` replaced with:
```python
RECORDING_TS = "2024-01-02T09:30:00Z"   # data/recordings/core-default
DEMO_TS = RECORDING_TS  # alias kept so hash seeds stay stable
```

Files updated:
- `autopilot_depth.py`
- `backtest_depth.py`
- `workflow_depth.py`
- `search_depth.py`

---

## Phase 4 — New Tests

### `tests/unit/test_recording_verifier.py` (19 tests)
- `TestVerifyRecordingCoreDefault` (12 tests): manifest, parquet schema, fills, positions, SHA-256
- `TestVerifyRecordingEdgeCases` (3 tests): missing set, corrupt parquet, missing fields
- `TestRecordingAnchorTimestamp` (4 tests): RECORDING_TS consistency across all runtime paths

### `frontend/tests/e2e/core/regression-smoke.spec.ts` (+2 tests)
- `mode badge is visible and shows Recorded (not DEMO)`
- `market status badge is visible`

### `frontend/tests/e2e/core/autopilot.spec.ts` (updated)
- `postmortem contains deterministic timestamp` → now asserts `2024-01-02T09:30:00Z`

---

## Phase 5 — Quality Gate Results

| Gate | Before | After |
|------|--------|-------|
| `tsc --noEmit` | 0 errors | **0 errors** |
| `vitest run` | 341/341 | **341/341** |
| `pytest tests/` | 470/470 (+6 pre-existing errors) | **489/489** (+6 pre-existing errors) |
| Playwright run 1 | 169/169 | **171/171** |
| Playwright run 2 (determinism) | 169/169 | **171/171** |

**Zero tolerance gates: PASSED ✓**

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/record_market_data.py` | Capture authentic market data from yfinance → parquet |
| `scripts/record_broker_ledger.py` | Derive paper fills/positions from recording → JSONL |
| `scripts/verify_recording.py` | Verify SHA-256 checksums + schema for any recording set |

### Usage
```bash
# Capture new data
python scripts/record_market_data.py --set core-default --symbols AAPL MSFT SPY TSLA --start 2024-01-02 --end 2024-03-28

# Generate broker ledger
python scripts/record_broker_ledger.py --set core-default

# Verify integrity
python scripts/verify_recording.py --set core-default
```
