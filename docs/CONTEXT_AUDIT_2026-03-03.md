# Apex Terminal Context Audit
Date: 2026-03-06 _(last updated; previous: 2026-03-04)_

This document consolidates:
1. Source-of-truth architecture map
2. `tasks.md` claims vs current code reality
3. Prioritized risk map

Scope: repository state as inspected on 2026-03-06. All metrics are re-verified from live source; deltas from the 2026-03-04 audit are noted inline.

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
  - `frontend/src/ui2/shell/LeftNav.tsx` _(now exports `<nav>` element; previously `<div>`, fixed 2026-03-04)_
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
  - `usePortfolio` now calls `/api/v1/portfolio` and `/api/v1/portfolio/positions` (lines 274, 279) but still contains ~35 local math-library stubs at the top (no-op `const sampleCovarianceMatrix = ...` etc.) that are never exercised:
    - `frontend/src/ui2/hooks/usePortfolio.ts:9-45`
  - `useOrders` remains entirely self-contained: all 35+ algo/risk/routing constants are no-op stubs and no `fetch()` calls exist in the file:
    - `frontend/src/ui2/hooks/useOrders.ts:9-35`
- Flagship pages now show deterministic, non-random placeholders instead of random generators:
  - `frontend/src/ui2/pages/DashboardUI2.tsx:65-78`
  - `frontend/src/ui2/pages/TradingUI2.tsx:173-211`
- Debug path strings (`" — check /api/v4/..."`) were removed from 101 UI2 pages (2026-03-04).
- Quantified UI2 page data-pattern distribution _(re-measured 2026-03-06)_:
  - Total UI2 pages: `239` _(unchanged)_
  - Pages with `fetch(...)`: `130` _(↑ from 128)_
  - Pages with `'/api/'` string: `132` _(stable; note: 101 debug-hint strings purged, real API references held at 132)_
  - Pages with `Math.random`: `73` _(unchanged)_
  - Pages with `Math.random` and no `fetch`: `57` _(↓ from 58)_
  - Pages with `fetch` and no `Math.random`: `114` _(↑ from 113)_

### 1.4 Backend composition (actual)
- API is assembled in one large include block:
  - `phase1/services/api/main.py:345+`
- Startup lifecycle initializes persistence and starts autopilot loops:
  - `phase1/services/api/main.py:204-220`
- Autopilot service runs background cycle + monitoring loops:
  - `phase1/services/autopilot/service.py:66+`
- Generated masterplan routes are present at scale:
  - `247` total route modules under `phase1/services/api/routes/*.py`
  - Of those, `~90` include text `"Generated backend API for the 2-year masterplan"` in source (`.py` only; the `grep -rl` count including `.pyc` cache files returns 270 — use source count)
- Greeks calculator now uses a real Alpaca → yfinance price chain with a 10-second TTL in-process cache (no hardcoded `price=150`):
  - `phase1/services/risk_desk/greeks_calculator.py:_get_underlying_price`
- Shared async quote helper serves `/api/v1/market-data/quote` and intelligence routes:
  - `phase1/services/api/routes/_quote_helper.py`

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
  - `useMarketData` is now API-backed (confirmed):
    - `frontend/src/ui2/hooks/useMarketData.ts:317-406`
  - `usePortfolio` now makes 2 real `fetch()` calls (lines 274, 279) — material improvement since last audit.
  - `useOrders` still contains only no-op stubs with zero API calls:
    - `frontend/src/ui2/hooks/useOrders.ts:9-35`
- Reconciliation verdict: **Improved. `usePortfolio` now has API plumbing; `useOrders` remains fully stubbed.**

### 2.2 Claim: Specific page naming in accomplishment log
- Claimed names include:
  - `NewsUI2`, `ScreenerUI2` (`tasks.md:36-37`)
- Current canonical page files are:
  - `NewsTerminalUI2.tsx`, `StockScreenerUI2.tsx`
- Reconciliation verdict: **Stale naming in task log — not yet updated.**

### 2.3 Claim: "63/64 Playwright passing" / "153/153 passing"
- Claimed in:
  - `tasks.md:48`, `tasks.md:85-87`, `tasks.md:110`
  - Latest session entry: `153/153 passing (0 failed, 0 skipped)` (autopilot full rewrite session)
- Current verified state (2026-03-06):
  - `tests/e2e/unified-autopilot.spec.ts` — **2/2 passing** (fixed this session)
  - Full Playwright suite last full run: unverified since autopilot rewrite — should be treated as a claim, not current evidence
  - Backend unit tests: **4746/4746 passing** (`pytest`, 2026-03-06) — ahead of tasks.md claim of 4663
- Reconciliation verdict: **Backend test count is now higher than claimed (4746 vs 4663). Playwright full-suite claim is point-in-time and should be re-validated.**

### 2.4 Claim: Autopilot backend/frontend wired and active
- Claimed in:
  - `tasks.md:43-47`, `tasks.md:73-74`
- Current evidence:
  - Frontend calls live autopilot endpoints:
    - `frontend/src/ui2/pages/AutopilotUI2.tsx:74-84`
  - Backend router provides those endpoints:
    - `phase1/services/api/routes/autopilot_v3.py:5-18`, `:33`
  - `AutopilotUI2.tsx` DATA_TABS now have `data-testid` attributes (added 2026-03-04).
- Reconciliation verdict: **True and hardened.**

### 2.5 Claim: TypeScript compile "0 errors"
- Claimed in: `tasks.md` (current session entry)
- Current evidence:
  - `npx tsc --noEmit` exits 0 (clean, verified 2026-03-06)
- Reconciliation verdict: **Confirmed current.**

---

## 3) Prioritized Risk Map

Severity scale:
- P0: Immediate blocker / critical correctness
- P1: High-risk regression and integrity risk
- P2: Medium maintainability and operational risk

### P1-1: ModelRouterUI2 — three tabs silently render empty (schema mismatch)
- The `balancing`, `fallbacks`, and `audit` tabs in `ModelRouterUI2` never populate because:
  - Fetch calls:
    - `frontend/src/ui2/pages/ModelRouterUI2.tsx:137-141`
  - The component maps `/models` data → `balancing` state, `/latency` → `fallbacks` state, `/route` → `audit` state
  - Backend provides: `/models`, `/routing-table`, `/route`, `/costs`, `/latency` — no `/balancing`, `/fallbacks`, or `/audit` endpoints exist:
    - `phase1/services/api/routes/w43_model_router.py:11-71`
  - Data shapes are semantically incompatible: `/models` returns `RouterRoute[]`, not `BalancingEntry[]`, so `balancing.length === 0` always
- The header comment at line 3–5 is now accurate (`/routing-table, /models, /latency, /costs, /route`); the prior audit's description of "stale comment endpoint names" was only partially correct — the real issue is the model/schema mismatch between what's fetched and what each tab renders.
- Impact:
  - 3 of 5 tabs in Model Router always show "No nodes" / "No fallback chains" / "No audit entries" at runtime, silently.

### P1-2: Order execution algorithm stubs block algo-order runtime
- `useOrders` is **API-backed for data loading and order submission** — it calls:
  - `GET /api/v1/portfolio/orders` on mount (lines 272, 362)
  - `GET /api/v1/portfolio/positions` on mount (line 302, 370)
  - `POST /api/v1/portfolio/orders` for order submission (line 335)
  - `DELETE /api/v1/orders/{id}` for cancellation (line 348)
- The stub block at lines 9–35 is for **algorithm implementations only** (`TWAPAlgo`, `VWAPAlgo`, `SmartRouter`, etc.) — these return `{}` and do nothing when called. Market/limit orders work end-to-end; TWAP/VWAP/Iceberg/POV algo submissions are no-ops.
- `usePortfolio` is also API-backed (lines 274, 279) but retains a large unused stub block:
  - `frontend/src/ui2/hooks/usePortfolio.ts:9-45`
- Impact:
  - Standard market/limit orders submit and display correctly. Algo order types (TWAP, VWAP, Iceberg) are accepted by the UI but execute as no-ops on the client side. Risk checks (`runAllChecks`) call no-op stubs, meaning pre-trade risk validation always passes.
  - **This is lower severity than the prior audit assessment** which wrongly characterised the full hook as unstubbed from the API.

### P1-3: Repository volatility risk
- Evidence (2026-03-06):
  - Current modified/untracked entries in worktree: `0` _(branch is clean, just pushed — significantly improved from 166 at last audit)_
- Impact:
  - Regression risk is currently low; volatility risk will re-emerge as new sessions add work.

### P1-4: Encoding/mojibake contamination in UI copy
- Scope (re-measured 2026-03-06): **29 files** contain non-ASCII characters (↑ from examples at 3; full scope now quantified)
- Nature: primarily the Unicode warning sign `⚠` (U+26A0) used in status badges, e.g.:
  - `frontend/src/ui2/pages/EntitlementsUI2.tsx:220-222`
  - `frontend/src/ui2/pages/ReleaseQualityUI2.tsx:225-227`
  - `frontend/src/ui2/pages/BrokerScoringUI2.tsx` (similar pattern)
- These are valid UTF-8 in JSX (TypeScript compile is clean), but render as `⚠'` in some terminal/grep views due to variation selector U+FE0F being stripped.
- Impact:
  - Not a runtime error (TypeScript exits 0). Risk is cosmetic: the warning icon may render inconsistently across OS/browser if the emoji variation selector is absent. Lower priority than originally framed.

### P2-1: Historical claims in `tasks.md` lag current codebase state
- Evidence:
  - `tasks.md` retains point-in-time test and completion statements:
    - Backend unit count: claims `4663` — actual is now `4746`
    - Playwright: claims `153/153` from most recent session — not re-validated after current-session changes
    - Page name references (`NewsUI2`, `ScreenerUI2`) don't match actual filenames
- Impact:
  - Wrong confidence signals if `tasks.md` is used as primary status reference without cross-checking.

### P2-2: Algo-order implementations are no-ops
- The lib functions (`TWAPAlgo`, `VWAPAlgo`, `SmartRouter`, `runAllChecks`, etc.) are defined as `() => ({})` stubs at `frontend/src/ui2/hooks/useOrders.ts:9-35`.
- Actual order routing and risk calculation require replacing these stubs with either proper client-side implementations or delegating to server-side endpoints.
- The existing `frontend/src/lib/oms/` layer has algorithm implementations but is not imported by `useOrders`.
- Impact: Medium. Standard order submission works end-to-end. Algo order types silently succeed on the client without computing expected execution schedules.

---

## 4) Resolved Since Last Audit

The following issues from the prior audit (2026-03-04) are now resolved:

**Structural fixes:**
- `LeftNav.tsx` — changed `<div className="apex-leftnav">` to `<nav>` with ARIA role; Playwright `waitForSelector('nav')` now reliably finds it.
- `AutopilotUI2.tsx` DATA_TABS — added `data-testid="autopilot-tab-{k}"` to all five tab buttons (`positions`, `orders`, `decisions`, `exits`, `cycles`). Previously had no testids.
- `unified-autopilot.spec.ts` — rewritten with correct tab IDs; Autopilot Playwright spec now **2/2 passing**.

**Backend correctness fixes:**
- `greeks_calculator.py` — `_get_underlying_price` completely replaced. Root cause: `get_provider()` called with no argument → `TypeError` silently caught → `price=None` → all legs priced incorrectly. Replaced with sync Alpaca (requests) → yfinance fallback chain plus a **10-second TTL in-process cache** (`_PRICE_CACHE`) that ensures determinism across back-to-back `calculate_greeks()` calls. All 33 risk desk tests pass; all 3 determinism tests pass.
- `market_data_v1_13.py` — `price=150.0` hardcode removed; real price via `_quote_helper.get_real_quote()`.
- `intelligence.py` — `price=150.0 + random.random()*200` removed; real Alpaca price per symbol.
- `_quote_helper.py` (new) — shared async Alpaca → yfinance → None utility used by route handlers.

**Frontend hygiene:**
- 101 UI2 pages had `" — check /api/v4/..."` debug path strings in UI copy; all removed via bulk sed.
- Debug artifact counts (`*_Zone.Identifier`, `*.old`/`*.bak`): still 0, unchanged — resolved in prior audit.

**Test suite:**
- Backend: **4746 passed, 0 failed, 0 skipped** (up from 4742 before greeks fix).
- TypeScript: **`tsc --noEmit` exits 0** (clean compile confirmed).
- Repository worktree: **0 dirty files** (branch pushed and clean).

**Issues from 2026-03-04 audit that are now resolved:**
- Missing UI2 export-file mismatch: still resolved (no regressions).
- Duplicate `autopilot_ws_router` include: still resolved at `phase1/services/api/main.py:400`.
- `*_Zone.Identifier` files: still 0.

---

## 5) Consolidated Conclusion _(updated 2026-03-06)_

The codebase is in the healthiest measured state to date: 4746 backend tests all pass, TypeScript compiles clean, the repository is on a clean commit, and the two primary Playwright regressions (nav element, autopilot tab IDs) are fixed.

Current risk has shifted toward **integration fidelity gaps** rather than hard failures:

1. **ModelRouterUI2 silent empty tabs** (P1-1): The three tabs for load-balancing, fallback chains, and audit will always render empty because the backend has no dedicated endpoints for those data shapes. This is a functional gap that is invisible until a user navigates those tabs.

2. **`useOrders` fully stubbed** (P1-2): Order execution flows across `TradingUI2` and `OrdersUI2` rely entirely on no-op stubs. Real broker order submission requires replacing or wrapping these with the existing `frontend/src/lib/oms/` layer.

3. **`usePortfolio` partially wired** (P1-2): Now makes real API calls but retains a large unused stub block. Low regression risk; medium cleanup debt.

4. **`Math.random` pages** (57 pages): These pages generate display values from `Math.random()` without any `fetch()` call. Most are non-trading utility pages but the count should trend toward 0 as data wiring continues.

5. **`tasks.md` staleness** (P2-1): Backend test count and Playwright suite status in `tasks.md` are now behind reality. Tasks should be re-baselined against the 2026-03-06 state.
