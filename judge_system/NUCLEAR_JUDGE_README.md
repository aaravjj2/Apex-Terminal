# Apex Nuclear Judge v3.0 — W01-W14 + $1M Valuation Threshold

## What Changed from v2

| Dimension | v2 (old) | v3 (this) |
|---|---|---|
| Coverage | W01 only | **W01–W13 full block + W14 backtest baseline** |
| Strictness | Pass at 70% | **$1M valuation scoring — explicit PROMOTE/HOLD/REJECT** |
| Pytest | Runs suite | **Stops at first failure (`-x` flag), strict exit code** |
| HTTP Probes | W1 endpoints only | **All unique endpoints across all 14 weeks (30+ routes)** |
| Auth check | Sample only | **All privileged endpoints: orders, risk, portfolio, accounts, audit-log, backtest snapshot** |
| Playwright | Basic DOM | **Ctrl+K palette, 6 keyboard shortcuts, aria count ≥20, canvas ≥1, 0 console errors, network failures** |
| Source audit | grep | **Full TS file scan: hooks, aria attrs, event handlers, keyboard refs, tsconfig strict** |
| DB audit | Not present | **SQLite table coverage: 10 required tables including backtest_runs** |
| Bloomberg parity | Not present | **8 Bloomberg indicators: BQL templates, PORT analytics, EMSX blotter, command palette, keyboard map, monitor layouts, linked context, risk panel** |
| W14 gates | Not present | **6 W14-specific gates: snapshot endpoint, SHA-256, dataset list, run binding, BT_CFG_INVALID taxonomy, p95 latency** |
| LLM prompt | Generic | **$1M valuation prompt: dollar estimate, top 3 blockers, critical path to $1M, week-by-week W01-W14 readiness scores** |
| Dashboard | 3-col | **Week navigator (W01-W14), valuation ring meter, per-section stat cards, ClawWork export** |

## Gate Categories

### P — Process (2 gates)
- P1: Frontend port 5100 live
- P2: Backend port 8000 live

### E — Pytest (3 gates)
- E1: ≥300 tests collected
- E2: ≥70% coverage
- E3: Exit code 0 (zero failures)

### F — Vitest (1 gate)
- F1: Frontend test suite passes

### HTTP — Endpoint probes (30+ gates)
- One gate per unique endpoint across W01-W14
- Pass: HTTP 2xx/404 + p95 within SLO budget

### C — Contract (1 gate)
- C1: Idempotency — duplicate POST returns same order_id

### S — Security (1 gate)
- S1: All privileged routes return 401/403 without auth

### U — UI/Playwright (7 gates)
- U1: Ctrl+K opens command palette
- U2: ≥20 aria-label attributes in live DOM
- U3: ≥5 semantic headings
- U4: ≥1 canvas element (charts rendering)
- U5: 0 browser console errors
- U6: ≥10 buttons/interactive elements
- U7: ≥3 keyboard shortcuts respond

### A — Source audit (6 gates)
- A1: ≥70% required components present across W01-W14
- A2: ≥50 aria attributes in source
- A3: ≥30 React hooks
- A4: ≥10 keyboard handler references
- A5: TypeScript strict mode enabled
- A6: ≥40 event handlers

### D — Database (3 gates)
- D1: SQLite DB file exists
- D2: ≥80% of 10 required tables present
- D3: `backtest_runs` table exists

### L — LOC (1 gate)
- L1: ≥35,000 source lines

### W14 — Backtest baseline (6 gates)
- W14_1: `/api/v3/backtest/datasets/snapshot` endpoint exists
- W14_2: SHA-256 checksum returned in snapshot response
- W14_3: `/api/v3/backtest/datasets` list endpoint returns 200
- W14_4: `/api/backtest/run` accepts `dataset_id` field
- W14_5: Garbage payload returns BT_CFG_INVALID (400/422)
- W14_6: Dataset lookup p95 ≤ 150ms

### BB — Bloomberg parity (11 gates)
- BB_BQ_analysis_templates, PORT_analytics, EMSX_blotter
- BB_command_palette, keyboard_shortcuts_20, monitor_layouts
- BB_linked_context, risk_panel
- BB_idempotency_keys, versioned_routes, error_taxonomy

## Valuation Scoring

| Score | Valuation | Verdict |
|---|---|---|
| ≥85% | $1,000,000+ | PROMOTE |
| 70–84% | $500K–$999K | HOLD |
| 50–69% | $100K–$499K | HOLD with blockers |
| <50% | <$100K | REJECT |

## Setup

```bash
pip install fastapi uvicorn httpx openai playwright psutil --break-system-packages
playwright install chromium
pip install pytest pytest-cov pytest-json-report --break-system-packages

# Optional: faster JS test collection
npm install -g vitest

# Start judge backend
uvicorn judge_server_nuclear:app --host 0.0.0.0 --port 7474

# Drop NuclearJudge.jsx into your React project as App.jsx
```

## Environment Variables

```bash
REPO_ROOT=/path/to/Apex-Terminal   # default: /home/user/Apex-Terminal
FRONTEND_URL=http://localhost:5100
BACKEND_URL=http://localhost:8000
OLLAMA_BASE=http://localhost:11434/v1
OLLAMA_MODEL=devstral:latest        # same as your previous scripts
```

## ClawWork Integration (HKUDS/ClawWork)

After run completes, artifact is written to `w01_w14_judge_report/clawwork_artifact.md`.
Pass to your ClawWork agent:

```python
submit_work(artifact=open("w01_w14_judge_report/clawwork_artifact.md").read())
```
