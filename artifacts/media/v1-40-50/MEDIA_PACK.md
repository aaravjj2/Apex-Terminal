# Media Pack — v1.41–v1.50 Integrated Delivery

## Screenshots (30 PNG files)

| Version | Feature | Files |
|---------|---------|-------|
| v1.40 | Agent Runner | v40-01, v40-02, v40-03 |
| v1.41 | Watchlist Manager | v41-01, v41-02, v41-03 |
| v1.42 | Correlation Matrix | v42-01, v42-02, v42-03 |
| v1.43 | Trade Journal | v43-01, v43-02, v43-03 |
| v1.44 | Notifications Center | v44-01, v44-02, v44-03 |
| v1.45 | System Audit Log | v45-01, v45-02, v45-03 |
| v1.46 | Performance Attribution | v46-01, v46-02, v46-03 |
| v1.47 | Risk Scenarios | v47-01, v47-02, v47-03 |
| v1.48 | Data Quality Monitor | v48-01, v48-02, v48-03 |
| v1.49 | Strategy Comparison | v49-01, v49-02, v49-03 |
| v1.50 | Platform Health | v50-01, v50-02, v50-03, v50-04 |

## Videos (32 WebM files)

Playwright-captured headed-mode videos of each test case navigating to and
interacting with each panel. Located in `videos/` subdirectory.

## Capture Method

- **Mode**: Headed Chrome via Playwright (`headless: false, channel: 'chrome'`)
- **Workers**: 1 (sequential)
- **Retries**: 0
- **Video**: ON for all tests
- **Trace**: ON for all tests
- **Screenshots**: ON for all tests
- **DEMO_MODE**: Deterministic data via `E2E_MODE=1 DEMO_MODE=1`

## Test Results

- **New v1.41–v1.50 Playwright tests**: 31/31 passed
- **New v1.41–v1.50 pytest tests**: 50/50 passed
- **Full Playwright suite**: 518 passed, 33 pre-existing failures (none in new tests)
- **Full pytest suite**: 367/367 passed (0 failures)
- **Vitest**: 112/112 passed
- **tsc --noEmit**: 0 errors
- **Vite build**: Success (1,673 KB JS)
