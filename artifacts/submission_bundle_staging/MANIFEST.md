# MANIFEST — Submission Proof Bundle

## Git
| Field | Value |
|-------|-------|
| SHA | `5f88f59c89aff044c6ac3b8fd43620585fe83d88` |
| Branch | `main` |
| Commit | Reality Repair: kill all demo/mock/seeded state, wire Alpaca paper broker, add market session + version endpoints, safe JSON parsing |

## Build
```
npx vite build          → dist/ (5.76s, 4 chunks + index.html)
vite preview --port 5100 → http://localhost:5100 (200 OK)
Backend                  → http://localhost:8090 (healthy, alpaca_connected=true, mode=paper)
```

## Playwright Config
| Setting | Value |
|---------|-------|
| headless | `false` (headed) |
| channel | `chrome` |
| workers | `1` |
| retries | `0` |
| video | `on` |
| trace | `on` |
| screenshot | `on` |
| slowMo | `50ms` |
| baseURL | `http://localhost:5100` |
| selectors | `data-testid` ONLY |
| waitForTimeout | NOT USED |

## Reality Suite Results (3× Flake Detection)

| Run | Expected | Unexpected | Skipped | Duration |
|-----|----------|------------|---------|----------|
| 1 | 37 | 0 | 0 | 69.6s |
| 2 | 37 | 0 | 0 | 70.5s |
| 3 | 37 | 0 | 0 | 71.0s |
| **Final** | **37** | **0** | **0** | **251.2s** |

**Flake rate: 0.0%** — Zero failures across 3 consecutive runs (111 test executions).

## Determinism Proof
```
Compare-Object det1.txt det2.txt → empty diff
```
Runs 1 and 2 produce byte-identical sorted test outcome lists.

## Tour Video
| Field | Value |
|-------|-------|
| File | `TOUR.webm` |
| Duration | ≥ 3.0 min (182.5s) |
| Size | 7.47 MB |
| Source | Playwright video capture from `reality-tour.spec.ts` |
| Content | 15 phases: shell verification, API checks, 7 passes through all 9 core pages, 30 extra pages, 20 command palette searches, keyboard navigation |

## Screenshots (13 named PNGs)
| # | File | What it proves |
|---|------|----------------|
| 00 | 00-app-shell-loaded.png | Full shell renders: topbar, rail, drawer, center, dock |
| 01 | 01-topbar-status-pills.png | Mode badge, market status, connection status visible |
| 02 | 02-data-mode-online.png | Data mode badge reads "Online" (no demo/mock) |
| 03 | 03-left-rail-navigation.png | Left rail with core nav items (autopilot, search, broker, etc.) |
| 05 | 05-market-session-badge.png | Market session badge with valid session attribute |
| 06 | 06-broker-alpaca-paper.png | Broker V2 page (Alpaca Paper) renders |
| 07 | 07-autopilot.png | Autopilot page renders |
| 08 | 08-backtester-v3.png | Backtester V3 page renders |
| 09 | 09-search-page.png | Search page renders |
| 10 | 10-workflow-builder.png | Workflow Builder page renders |
| 11 | 11-observability-ops.png | Observability / Ops Center page renders |
| 12 | 12-settings.png | Settings page renders |
| 13 | 13-command-palette.png | Command palette opens and displays search |

Tests 04 and 14 are API-only (version endpoint + backend health) — no visual screenshot, captured in trace.

## Backend Health (at time of run)
```json
{
  "status": "healthy",
  "ready": true,
  "alpaca_configured": true,
  "alpaca_connected": true,
  "elasticsearch_connected": true,
  "tradier_configured": true,
  "bars_source": "alpaca",
  "mode": "paper"
}
```

## Spec Files
| File | Tests | Category |
|------|-------|----------|
| reality-version-match.spec.ts | 2 | Version endpoint + mismatch banner |
| reality-no-demo.spec.ts | 5 | No "DEMO STREAM", no DEMO badges, empty autopilot feed |
| reality-json-contract.spec.ts | 5 | 404 JSON, correlation-id, broker/market/health endpoints |
| reality-broker-alpaca.spec.ts | 5 | Broker health/account/orders/positions/UI render |
| reality-market-session.spec.ts | 5 | Session schema, valid values, UI badge attribute |
| reality-screenshots.spec.ts | 15 | Named screenshot capture (13 visual + 2 API) |
| reality-tour.spec.ts | 1 | ≥3 min walkthrough video with 15 phases |
| **Total** | **37** | |

## Proof Artifacts
```
artifacts/proof/
├── screenshots/
│   ├── 00-app-shell-loaded.png
│   ├── 01-topbar-status-pills.png
│   ├── 02-data-mode-online.png
│   ├── 03-left-rail-navigation.png
│   ├── 05-market-session-badge.png
│   ├── 06-broker-alpaca-paper.png
│   ├── 07-autopilot.png
│   ├── 08-backtester-v3.png
│   ├── 09-search-page.png
│   ├── 10-workflow-builder.png
│   ├── 11-observability-ops.png
│   ├── 12-settings.png
│   └── 13-command-palette.png
├── TOUR.webm
├── determinism-run1.json
├── determinism-run2.json
├── determinism-run3.json
├── reality-final.json
├── det1.txt
├── det2.txt
└── playwright-report/
```

## Commands to Reproduce
```powershell
# 1. Build frontend
cd frontend
npx vite build

# 2. Start preview server (background)
npx vite preview --port 5100 &

# 3. Ensure backend is running on port 8090
curl.exe -s http://localhost:8090/health

# 4. Run Reality suite (3x flake detection)
npx playwright test tests/e2e/reality/ --reporter=json > run1.json
npx playwright test tests/e2e/reality/ --reporter=json > run2.json
npx playwright test tests/e2e/reality/ --reporter=json > run3.json

# 5. Determinism proof
# Extract sorted test names+status from run1 and run2, diff should be empty
```
