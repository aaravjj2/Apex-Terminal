---
name: full-hardening-run
description: Use when the goal is to retire runloop, harden Alpaca websockets, stabilize Playwright headed Chrome E2E, enforce data-testid contract, and reach 0 failed / 0 skipped with evidence.
---

# Full Hardening Run

## HARD RULES
- Skipped tests count as failure.
- Do not claim “fixed” unless you provide evidence: failing run -> passing run (0 failed, 0 skipped).
- For websocket health: include Chrome DevTools evidence (WS lifecycle + reconnect attempts) and console/network logs.
- Use the required MCP tools when applicable; do not substitute reasoning for evidence.
- Prefer smallest diffs; no refactors unless required for correctness/stability.

## REQUIRED TOOLS (MCP)
- playwright
- chromeDevtools
- (optional) openaiDocs
- (optional) git

## EXECUTION PLAN (MUST FOLLOW IN ORDER)

### Phase 0 — Inventory (no changes yet)
1) Identify how to install dependencies and run:
   - dev server(s)
   - unit/integration tests
   - Playwright E2E tests
2) Identify where runloop, websocket client, and UI status live.

### Phase 1 — Repo Autopsy + Autofix Loop
1) Run the smallest command that reproduces current failures.
2) Fix minimal root cause.
3) Re-run the exact same command.
4) Repeat until unit/integration tests are 0 failed / 0 skipped.

### Phase 2 — E2E Stabilizer (Headed Chrome)
1) Ensure Playwright starts backend + frontend (webServer or equivalent) and waits for readiness.
2) Enforce headed Chrome (no headless) for verification runs.
3) Replace waitForTimeout with app-ready waits (health endpoint, stable UI signals, deterministic waits).
4) Enable trace + screenshot (and optionally video) on failure.
5) Repeat until headed E2E is 0 failed / 0 skipped.

### Phase 3 — WebSocket Hardening + Diagnostics (P0)
1) Implement reconnect state machine (explicit states; backoff; jitter; max cap).
2) Implement stale detection (heartbeat/last-message timer) and trigger reconnect.
3) Add triggers: online/offline, focus/visibility change, manual force reconnect.
4) Add UI: status pill + last message timestamp + retry countdown + manual reconnect control.
5) PROOF REQUIREMENT:
   - Use DevTools tooling to capture WS connect -> disconnect -> reconnect and confirm no console/network errors.
6) Add/Run E2E test that forces disconnect and verifies reconnect in headed Chrome.
7) Repeat until test passes and evidence is captured.

### Phase 4 — UI Contract & TestIDs
1) Define a data-testid contract for critical surfaces:
   - dashboard
   - portfolio
   - orders
   - websocket status pill
2) Update UI to comply.
3) Update tests to assert only via data-testid (no layout/CSS selectors).
4) Re-run headed E2E suite.

## DELIVERABLES (DEFINITION OF DONE)
- Paste logs showing: unit/integration tests = 0 failed / 0 skipped.
- Paste logs showing: headed Playwright E2E = 0 failed / 0 skipped.
- Attach/playback evidence:
  - Playwright trace (or trace summary + where it is saved)
  - DevTools evidence: WS lifecycle connect/disconnect/reconnect + console/network logs
- Summarize git diff: list files changed + why each change was necessary.
