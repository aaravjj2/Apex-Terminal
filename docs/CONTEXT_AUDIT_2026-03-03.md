# Apex Terminal Context Audit
Date: 2026-03-03

This document consolidates:
1. Source-of-truth architecture map
2. `tasks.md` claims vs current code reality
3. Prioritized risk map

Scope: repository state as inspected on 2026-03-03.

---

## 1) Source-of-Truth Architecture Map

### 1.1 Runtime entry and route spine
- Frontend app entry routes all traffic to UI2:
  - `frontend/src/App.tsx:31-39`
- UI2 route registry is centralized in:
  - `frontend/src/ui2/routes.tsx`
- Current observed scale:
  - UI2 route entries: `244`
  - UI2 page files matching `*UI2.tsx`: `230`
  - Backend API route modules (`phase1/services/api/routes/*.py`): `247`

### 1.2 Frontend structure (actual)
- Primary shell:
  - `frontend/src/ui2/AppShellUI2.tsx`
  - `frontend/src/ui2/shell/TopBar.tsx`
  - `frontend/src/ui2/shell/LeftNav.tsx`
  - `frontend/src/ui2/shell/RightSidebarNew.tsx`
  - `frontend/src/ui2/shell/StatusBar.tsx`
  - `frontend/src/ui2/shell/CommandPaletteNew.tsx`
- Vite/proxy wiring:
  - Frontend dev/preview on `:5100`, backend proxy target `:8000`
  - `frontend/vite.config.ts:29-57`

### 1.3 Frontend data wiring reality
- Significant portion of `ui2/hooks` is still stub/self-contained:
  - `frontend/src/ui2/hooks/useMarketData.ts:9-29`
  - `frontend/src/ui2/hooks/useOrders.ts:9-35`
  - `frontend/src/ui2/hooks/usePortfolio.ts:9-45`
- `useMarketData` defaults to mock mode and auto-generates bars:
  - `frontend/src/ui2/hooks/useMarketData.ts:303`
  - `frontend/src/ui2/hooks/useMarketData.ts:315-343`
- Quantified UI2 page data pattern distribution:
  - Total UI2 pages: `230`
  - Pages with `fetch(...)`: `127`
  - Pages with `"/api/"` string: `129`
  - Pages with `Math.random`: `63`
  - Pages with `Math.random` and no `fetch`: `50`
  - Pages with `fetch` and no `Math.random`: `114`

### 1.4 Backend composition (actual)
- API is assembled in one large include block:
  - `phase1/services/api/main.py:345+`
- Startup lifecycle initializes persistence and starts autopilot loops:
  - `phase1/services/api/main.py:204-220`
- Autopilot service runs background cycle + monitoring loops:
  - `phase1/services/autopilot/service.py:66+`
- Generated masterplan routes are present at scale:
  - `90` route files include text: `"Generated backend API for the 2-year masterplan"`

### 1.5 Known integration strengths
- Autopilot UI endpoint wiring is concrete:
  - `frontend/src/ui2/pages/AutopilotUI2.tsx:69-77`
- Matching backend router for `/api/autopilot/*` exists:
  - `phase1/services/api/routes/autopilot_v3.py:33`

---

## 2) `tasks.md` Reconciliation (Claim vs Current Reality)

Reference source:
- `tasks.md:10-97`

### 2.1 Claim: "17 UI2 pages rewritten ... real API calls, no demo data"
- Claimed in:
  - `tasks.md:24-41`
- Current evidence:
  - Dashboard still contains local synthetic generators and `Math.random` paths:
    - `frontend/src/ui2/pages/DashboardUI2.tsx:64-163`
  - Trading still contains local synthetic generators and `Math.random` paths:
    - `frontend/src/ui2/pages/TradingUI2.tsx:198-255`
  - Hook layer used by many pages still defaults to mock data patterns:
    - `frontend/src/ui2/hooks/useMarketData.ts:303-343`
- Reconciliation verdict: **Partially true / drifted**.

### 2.2 Claim: Specific page naming in accomplishment log
- Claimed names include:
  - `NewsUI2`, `ScreenerUI2` (`tasks.md:36-37`)
- Current canonical page files are:
  - `NewsTerminalUI2.tsx`, `StockScreenerUI2.tsx`
- Reconciliation verdict: **Outdated naming in task log**.

### 2.3 Claim: "63/64 Playwright passing" as current validated state
- Claimed in:
  - `tasks.md:13`, `tasks.md:50-52`, `tasks.md:75`
- Current code reality:
  - UI page export barrel references missing modules:
    - `frontend/src/ui2/pages/index.ts:15,49,75,84,88,111,115`
  - Missing modules currently include:
    - `RunsUI2`, `ScoringUI2`, `SandboxRunnerUI2`, `LiquidityUI2`, `RiskNetworkUI2`, `MonteCarloV2UI2`, `EsOpsUI2`
- Reconciliation verdict: **Not aligned with current tree state**.

### 2.4 Claim: Autopilot backend/frontend wired and active
- Claimed in:
  - `tasks.md:43-47`, `tasks.md:73-74`
- Current evidence:
  - Frontend calls live autopilot endpoints:
    - `frontend/src/ui2/pages/AutopilotUI2.tsx:69-77`
  - Backend router provides those endpoints:
    - `phase1/services/api/routes/autopilot_v3.py:5-18`, `:33`
- Reconciliation verdict: **Mostly true**.

---

## 3) Prioritized Risk Map

Severity scale:
- P0: Immediate blocker / critical correctness
- P1: High-risk regression and integrity risk
- P2: Medium maintainability and operational risk

### P0-1: UI2 export/route integrity break risk
- Evidence:
  - Route import set depends on page barrel:
    - `frontend/src/ui2/routes.tsx:7-70`
  - Page barrel references missing files:
    - `frontend/src/ui2/pages/index.ts:15,49,75,84,88,111,115`
- Impact:
  - Build/startup can fail, or navigation coverage becomes unreliable.

### P0-2: Frontend/backend API contract mismatch (v4 masterplan pages)
- Cross-account mismatch example:
  - Frontend expects:
    - `/positions`, `/exposure`, `/margin`, `/reconciliation`
    - `frontend/src/ui2/pages/CrossAccountUI2.tsx:138-141`
  - Backend exposes:
    - `/positions/aggregated`, `/limits`, `/compliance`, etc.
    - `phase1/services/api/routes/w38_cross_account.py:32-80`
- Model-router mismatch example:
  - Frontend expects:
    - `/routes`, `/balancing`, `/fallbacks`, `/cost`, `/audit`
    - `frontend/src/ui2/pages/ModelRouterUI2.tsx:137-141`
  - Backend exposes:
    - `/models`, `/routing-table`, `/route`, `/costs`, `/latency`
    - `phase1/services/api/routes/w43_model_router.py:11-80`
- Impact:
  - UI shows persistent empty/error states while appearing "wired."

### P1-1: Real-vs-mock fidelity gap in flagship experiences
- Evidence:
  - `DashboardUI2` and `TradingUI2` still synthesize data heavily:
    - `frontend/src/ui2/pages/DashboardUI2.tsx:64-163`
    - `frontend/src/ui2/pages/TradingUI2.tsx:198-255`
  - Shared hook layer still mock-first in key domains:
    - `frontend/src/ui2/hooks/useMarketData.ts:303-343`
    - `frontend/src/ui2/hooks/useOrders.ts:9-35`
    - `frontend/src/ui2/hooks/usePortfolio.ts:9-45`
- Impact:
  - Demo behavior diverges from backend truth and can mask integration failures.

### P1-2: Repository hygiene and drift risk
- Evidence:
  - Current modified/untracked entries in worktree snapshot: `92`
  - `*_Zone.Identifier` artifacts in repo: `1188` (31 under `frontend/src/ui2/pages`)
  - Backup artifacts (`.old`, `.bak`) under frontend src: `18` total (`17` in pages)
- Impact:
  - Increased merge conflict, accidental import, and review noise risk.

### P1-3: Encoding/mojibake contamination in UI files
- Evidence examples:
  - `frontend/src/ui2/pages/ModelRouterUI2.tsx:2`
  - `frontend/src/ui2/pages/CrossAccountUI2.tsx:2`
  - Multiple files contain garbled text markers (`â€”`, `âš`, BOM artifacts).
- Impact:
  - UI copy quality degradation and potential toolchain/editor inconsistencies.

### P2-1: Backend include complexity and duplicate registration
- Evidence:
  - duplicate websocket include:
    - `phase1/services/api/main.py:400`
    - `phase1/services/api/main.py:401`
- Impact:
  - Debugging complexity and potential duplicate event behavior.

---

## 4) Consolidated Conclusion

The project has substantial implemented surface area and a broad route/module scaffold, but the current branch state shows active migration drift:
- Route/export integrity is not fully stable.
- Several frontend pages and hooks remain synthetic or mock-first.
- Many v4 page contracts do not match backend route shapes.
- Task log claims represent a prior point-in-time and are not fully synchronized with current files.

Autopilot is the strongest integrated vertical in current state; most other domains need contract reconciliation and stabilization before claims of broad parity can be treated as current.

