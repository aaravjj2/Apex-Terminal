# Apex Terminal Context Audit
Date: 2026-03-04

This document consolidates:
1. Source-of-truth architecture map
2. `tasks.md` claims vs current code reality
3. Prioritized risk map

Scope: repository state as inspected on 2026-03-04.

---

## 1) Source-of-Truth Architecture Map

### 1.1 Runtime entry and route spine
- Frontend app entry routes all traffic to UI2:
  - `frontend/src/App.tsx:31-39`
- UI2 route registry is centralized in:
  - `frontend/src/ui2/routes.tsx`
- Current observed scale:
  - UI2 route entries: `244`
  - UI2 page files matching `*UI2.tsx`: `239`
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
- Data wiring is mixed:
  - `useMarketData` is now real-data oriented and API-backed (`/api/v1/bars`, `/api/market-quote`, `/api/v4/screener/run`):
    - `frontend/src/ui2/hooks/useMarketData.ts:1-13`
    - `frontend/src/ui2/hooks/useMarketData.ts:317-406`
  - `useOrders` and `usePortfolio` still include self-contained stub sections:
    - `frontend/src/ui2/hooks/useOrders.ts:9-35`
    - `frontend/src/ui2/hooks/usePortfolio.ts:9-45`
- Flagship pages now show deterministic, non-random placeholders instead of random generators:
  - `frontend/src/ui2/pages/DashboardUI2.tsx:65-78`
  - `frontend/src/ui2/pages/TradingUI2.tsx:173-211`
- Quantified UI2 page data-pattern distribution:
  - Total UI2 pages: `239`
  - Pages with `fetch(...)`: `128`
  - Pages with `"/api/"` string: `131`
  - Pages with `Math.random`: `73`
  - Pages with `Math.random` and no `fetch`: `58`
  - Pages with `fetch` and no `Math.random`: `113`

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
- Autopilot UI endpoint wiring remains concrete:
  - `frontend/src/ui2/pages/AutopilotUI2.tsx:74-84`
- Matching backend router for `/api/autopilot/*` exists:
  - `phase1/services/api/routes/autopilot_v3.py:5-18`
  - `phase1/services/api/routes/autopilot_v3.py:33`

---

## 2) `tasks.md` Reconciliation (Claim vs Current Reality)

Reference source:
- `tasks.md:48-110`

### 2.1 Claim: "17 UI2 pages rewritten ... real API calls, no demo data"
- Claimed in:
  - `tasks.md:24-41`
- Current evidence:
  - `useMarketData` is now API-backed (improvement):
    - `frontend/src/ui2/hooks/useMarketData.ts:317-406`
  - However, key supporting domain hooks remain stub-based (`useOrders`, `usePortfolio`):
    - `frontend/src/ui2/hooks/useOrders.ts:9-35`
    - `frontend/src/ui2/hooks/usePortfolio.ts:9-45`
- Reconciliation verdict: **Improved but still partially drifted**.

### 2.2 Claim: Specific page naming in accomplishment log
- Claimed names include:
  - `NewsUI2`, `ScreenerUI2` (`tasks.md:36-37`)
- Current canonical page files are:
  - `NewsTerminalUI2.tsx`, `StockScreenerUI2.tsx`
- Reconciliation verdict: **Outdated naming in task log**.

### 2.3 Claim: "63/64 Playwright passing" as current validated state
- Claimed in:
  - `tasks.md:48`, `tasks.md:85-87`, `tasks.md:110`
- Current code reality:
  - No missing exports were detected in `frontend/src/ui2/pages/index.ts` against filesystem at audit time.
  - The repository is highly active (`166` modified/untracked paths), so the historical passing snapshot in `tasks.md` should be treated as point-in-time, not current proof.
- Reconciliation verdict: **Historically plausible, not current-state evidence**.

### 2.4 Claim: Autopilot backend/frontend wired and active
- Claimed in:
  - `tasks.md:43-47`, `tasks.md:73-74`
- Current evidence:
  - Frontend calls live autopilot endpoints:
    - `frontend/src/ui2/pages/AutopilotUI2.tsx:74-84`
  - Backend router provides those endpoints:
    - `phase1/services/api/routes/autopilot_v3.py:5-18`, `:33`
- Reconciliation verdict: **Mostly true**.

---

## 3) Prioritized Risk Map

Severity scale:
- P0: Immediate blocker / critical correctness
- P1: High-risk regression and integrity risk
- P2: Medium maintainability and operational risk

### P1-1: API semantics/documentation drift in v4 UI pages
- Cross-account has been corrected to backend-aligned endpoints (good):
  - Frontend fetches:
    - `frontend/src/ui2/pages/CrossAccountUI2.tsx:137-139`
  - Backend exposes:
    - `phase1/services/api/routes/w38_cross_account.py:11-44`
- Model Router fetches backend-aligned endpoints, but page hints/comments still reference old endpoint names (`/routes`, `/balancing`, `/fallbacks`, `/cost`, `/audit`):
  - Fetch calls:
    - `frontend/src/ui2/pages/ModelRouterUI2.tsx:137-141`
  - Old hints in UI empty states/comments:
    - `frontend/src/ui2/pages/ModelRouterUI2.tsx:5`
    - `frontend/src/ui2/pages/ModelRouterUI2.tsx:251,277,303,328,361`
- Impact:
  - Operational confusion and false troubleshooting paths even when backend wiring is correct.

### P1-2: Real-vs-live fidelity still uneven across UI2 domains
- Evidence:
  - `useMarketData` now real-data oriented:
    - `frontend/src/ui2/hooks/useMarketData.ts:1-13`
  - `useOrders` and `usePortfolio` remain stub-heavy foundations:
    - `frontend/src/ui2/hooks/useOrders.ts:9-35`
    - `frontend/src/ui2/hooks/usePortfolio.ts:9-45`
  - System-wide signal still shows many random-driven pages (`73`, with `58` random-no-fetch).
- Impact:
  - Parts of UI may appear integrated while behavior remains synthetic in certain domains.

### P1-3: Repository volatility risk
- Evidence:
  - Current modified/untracked entries in worktree snapshot: `166`
- Impact:
  - Increased regression probability, difficult attribution, and harder confidence in one-shot validation.

### P1-4: Encoding/mojibake contamination in UI copy
- Evidence examples:
  - `frontend/src/ui2/pages/EntitlementsUI2.tsx:2`
  - `frontend/src/ui2/pages/ReleaseQualityUI2.tsx:2`
  - `frontend/src/ui2/pages/BrokerScoringUI2.tsx:2`
- Impact:
  - UI text quality issues and maintainability friction.

### P2-1: Historical claims in `tasks.md` lag current codebase state
- Evidence:
  - `tasks.md` retains point-in-time test and completion statements:
    - `tasks.md:48`, `tasks.md:85-87`, `tasks.md:93`, `tasks.md:110`
- Impact:
  - Team decision-making can rely on stale confidence signals if not cross-checked.

---

## 4) Resolved Since Last Audit

The following issues from the prior audit are now resolved in current inspection:
- Missing UI2 export-file mismatch is resolved:
  - No missing exports detected from `frontend/src/ui2/pages/index.ts` to filesystem.
- Duplicate `autopilot_ws_router` include is resolved:
  - Single include now at `phase1/services/api/main.py:400`.
- Hygiene artifact counts improved:
  - `*_Zone.Identifier` files in repo: `0`.
  - `*.old`/`*.bak` under `frontend/src`: `0`.

---

## 5) Consolidated Conclusion

The codebase remains large and highly active, but several concrete blockers from the previous audit have been fixed (export integrity, duplicate websocket include, and artifact-file hygiene).

Current risk has shifted from hard compile breakpoints toward integration fidelity and semantic consistency:
- Backend/frontend endpoint semantics are improving, but some UI hints/comments remain outdated.
- Core data plumbing is mixed: `useMarketData` is materially improved, while `useOrders`/`usePortfolio` still rely on stub scaffolding.
- Given current branch churn (`166` changed/untracked entries), confidence should come from targeted re-validation rather than historical status statements.
