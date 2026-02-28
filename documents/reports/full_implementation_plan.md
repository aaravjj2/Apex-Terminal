# Full Implementation Plan — Paper-Only AI Options Autopilot (TradingView Recreation Repo)

## Summary
You have one primary product (React UI in `frontend/` + FastAPI backend in `phase1/`) and a secondary Streamlit prototype (`Tradingview/options-dashboard/`) that duplicates options math and is not integrated into the product surface. The immediate goal is **build + test only** (paper mode only, no real money) while delivering an **Options Alpha–style bot framework** where an AI selects **(ticker + strategy template + parameters)** automatically within strict deterministic guardrails.

This plan has two deliverables:
1) **Implementation blueprint**: exact modules to add/modify, APIs, UI/UX, paper-broker simulation, forecasting, LLM integration, and local n8n orchestration.
2) **Superprompt**: a single “do-the-work” prompt for a coding agent to implement and test everything end-to-end with Playwright MCP and Chrome DevTools MCP, with **0 skipped tests** and repeated verification loops until green.

---

## 1) Decisions and constraints from our discussion

### Mode and risk posture
- **Paper-only**: no live trading; no real capital at risk.
- **Auto-execute**: autopilot is allowed to place paper trades without user approval.
- **Budget cap**: treat “$1,000 overall spend” as **paper account equity**; enforce limits using **max loss (risk)**, not “premium paid.”
- **Open positions**: target **5–10 concurrent positions**, with concentration controls.
- **Strategy style**: “any works” → implement a **hybrid** system:
  - “Credit” (premium selling) templates for range/high-IV regimes
  - “Debit” (directional) templates for trend/low-IV regimes
- **Earnings policy**: “any works” → choose a default that avoids catastrophic paper “wins”:
  - **Default**: conservative earnings blackout (no new short-premium positions inside 7 calendar days of earnings; optional auto-close before earnings for existing short premium).

### Universe
- Restrict to liquid, optionable large names:
  - Mega-cap tech (AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA, AMD)
  - Core ETFs (SPY, QQQ, IWM, DIA)
  - Sector ETFs (XLK, SMH, XLF, XLE)
  - Optional hedges (TLT, GLD)

---

## 2) Current repo reality check (what’s integrated vs not)

### Primary app (real product)
- Frontend: `frontend/` (React/Vite, existing dashboards including OptionsDashboard)
- Backend: `phase1/` (FastAPI routes, strategy engine, options services, run orchestrator, reports, incidents)

### Secondary project folder
- `Tradingview/options-dashboard/` is a standalone Streamlit app duplicating Black–Scholes/Greeks and payoff logic already present in `phase1/services/options/`.

### Changelog signal (you uploaded “latest changelog results”)
- `phase1/docs/changelog.md` indicates **49 passed, 1 skipped** during Phase 1 stabilization.
- Skips are caused by missing fixtures:
  - `phase1/tests/integration/test_pipeline.py` skips if `aapl_test_ticks.csv` fixture is missing.
  - `phase1/tests/parity/test_parity.py` skips if CSV/hash fixtures are missing.
- Your new acceptance criteria requires **0 skipped**. This plan includes turning those tests into self-contained fixtures (or bundling fixtures in-repo) so they never skip.

---

## 3) What you are building (product-level definition)

### User-facing product: “AI Options Autopilot Workstation” (paper)
A user sets:
- paper equity = 1000
- max risk per trade, max total risk outstanding, max daily loss
- allowed universe + allowed strategy templates
- optional forecast influence level
- optional LLM mode (on/off)

Then the system:
- scans the market on schedule
- generates candidate trades (deterministic)
- uses LLM (optional) to rank/select candidates
- validates with deterministic risk rules
- auto-executes paper trades via a paper broker simulator
- monitors and manages exits
- produces daily reports and logs

---

## 4) Architecture blueprint (minimal viable, testable)

### 4.1 Modules to add (backend)
Create a new service namespace:
- `phase1/services/autopilot/`
  - `config.py` — autopilot configuration schema (budget, limits, universe, strategy whitelist)
  - `universe.py` — universe lists + dynamic filters (liquidity and spread checks)
  - `features.py` — feature computation (trend, vol regime, IV rank, liquidity score, forecast outputs)
  - `strategy_library/` — bot templates (PCS/CCS/IC/CDS/PDS) + parameter bounds + exits
  - `candidates.py` — deterministic candidate generation
  - `selector.py` — selection interface:
    - `DeterministicRanker` (baseline, test default)
    - `LLMRanker` (optional, calls LLM gateway)
  - `validator.py` — hard deterministic guardrails; returns reject reasons
  - `paper_broker.py` — paper execution simulation for multileg options
  - `position_manager.py` — options position ledger + exposures (delta/vega/theta)
  - `monitor.py` — exit logic and portfolio risk monitoring
  - `reporting.py` — daily digest + attribution (by template, by underlying, by regime)
  - `runloop.py` — orchestrates a full autopilot cycle (scan → select → execute → monitor)

Add a gateway:
- `phase1/services/llm/`
  - `provider.py` — interface for LLM calls
  - `providers/http_endpoint.py` — calls a remote endpoint (Colab-hosted) using JSON
  - `providers/offline_stub.py` — deterministic stub used by tests

### 4.2 Integrate with existing orchestration
Leverage the existing run orchestrator:
- Extend `phase1/services/execution/orchestrator.py` run types to include `autopilot_paper`.
- Add a handler that runs `services.autopilot.runloop.run()` on schedule or via API.

### 4.3 Data sources (paper-friendly and keyless)
For paper mode, prefer providers that do not require brokerage credentials:
- Options chain and greeks:
  - Continue using `phase1/services/options/adapter.py` (yfinance-based) as the default chain source.
  - Reuse existing `phase1/services/options/greeks.py` and `strategy_factory.py` as the canonical math.
- Underlying prices:
  - Use the existing bars/ingestion system when available; otherwise fallback to the options adapter’s last price.

Important: paper fills must be modeled realistically enough to avoid “paper fantasy.” Track fill-rate KPIs.

---

## 5) Strategy templates (“bots”) and constraints

### 5.1 Strategy library (v1)
Implement only defined-risk templates:

**Credit (premium selling)**
1) Put Credit Spread (bullish/neutral)
2) Call Credit Spread (bearish/neutral)
3) Iron Condor (neutral/range)

**Debit (directional)**
4) Call Debit Spread (bullish trend)
5) Put Debit Spread (bearish trend)

Each template specifies:
- Eligibility:
  - regime (trend vs range)
  - IV rank thresholds
  - minimum liquidity score (spread %, OI)
  - earnings blackout rules
- Parameters (bounded):
  - DTE range (e.g., 14–45)
  - target short-leg delta range (e.g., 0.15–0.35 for credit)
  - spread width range (e.g., 1–10 depending on underlying)
  - max slippage tolerance
- Exit rules:
  - credit: take profit at 50% of max profit, time stop at DTE<=7, loss stop at 2x credit or fixed max loss
  - debit: take profit at 50–100% gain, time stop if thesis invalidated, loss stop at 50% of debit

### 5.2 Budget and risk limits (for $1,000 paper)
Recommended defaults (configurable in UI):
- Paper equity: 1000
- Max risk per trade: 50 (5% of equity)
- Max total risk outstanding: 300–500 (30–50% of equity)
- Max daily loss: 30 (3% of equity)
- Max open positions: 10
- Concentration:
  - Max 2 positions per “cluster” (mega-cap tech bucket)
  - Max 2 positions per underlying
  - Max 60% of total risk concentrated in one sector proxy (tech)

---

## 6) Forecasting (use it as an indicator, not an oracle)

### 6.1 Forecast outputs (minimal useful set)
Per underlying, per horizon (5D and 20D):
- P10 / P50 / P90 return bands (distribution)
- 20D volatility forecast
- Confidence score:
  - data quality (missingness, stale quotes)
  - regime stability (recent variance spikes)
  - calibration history (see below)

### 6.2 How forecast affects decisions (bounded influence)
Forecast influences strategy selection only through deterministic scoring:
- Direction tilt:
  - P50 positive → bullish templates score boost
  - P50 negative → bearish templates score boost
- Uncertainty:
  - wide bands → smaller size and prefer defined-risk; avoid short premium unless IV is compensating
- Confidence:
  - low confidence → reduce size or skip

### 6.3 Calibration report (required)
Track whether realized returns fall inside forecast bands:
- Rolling coverage: % of days price stayed within P10–P90
- If coverage is poor, downweight forecast influence automatically.

---

## 7) LLM usage (constrained “brain”)

### 7.1 What the LLM is allowed to do
- Rank/select among pre-generated candidates.
- Provide concise rationales and risk notes for the UI.
- Optionally tag news/event context into structured labels (earnings, macro, litigation).

### 7.2 What the LLM is not allowed to do
- Invent strategy structures outside the library.
- Set position size beyond bounded ranges.
- Override risk rules, earnings rules, liquidity rules, or concentration rules.
- Execute trades directly.

### 7.3 Candidate ranking contract (strict schema)
The autopilot provides the LLM a JSON bundle:
- market regime summary
- portfolio state summary
- a list of trade candidates with:
  - template id
  - legs (strikes/DTE)
  - max loss, max profit, POP proxy
  - liquidity score and spread %
  - IV rank
  - forecast bands and confidence
  - reasons-for/against tags

LLM output must be:
- chosen subset (0–N) of candidate ids
- optional parameter adjustments within allowed bounds
- explanation text

### 7.4 Which model to use + Colab plan
Because you may not have API keys, implement a pluggable LLM provider:
- Default in tests and local dev: deterministic ranker
- Optional “LLM endpoint” provider: call a Colab-hosted inference endpoint

Colab approach (operationally realistic for paper mode):
- Colab runs a small HTTP server exposing `/rank_candidates`.
- Local backend calls it via a secure tunnel (Cloudflare Tunnel or ngrok).
- If the endpoint is down, autopilot falls back to deterministic ranker (and logs the degradation).

---

## 8) Local n8n (orchestration only)

### 8.1 n8n responsibilities
- Scheduling (run scan at set times)
- Notifications (reports, alerts, “no trade” reasons)
- Optional “approval mode” wiring (even if default is auto-execute, keep a switch)
- Health checks (LLM endpoint reachable, backend reachable)

### 8.2 Keep trading logic out of n8n
n8n should call backend endpoints only:
- `/api/v1/autopilot/run`
- `/api/v1/autopilot/status`
- `/api/v1/reports/daily`
- `/api/v1/alerts`

Store sample n8n workflows in-repo (not buried in artifacts):
- Create `n8n/workflows/` and move the existing `Regime Change Handler` JSON into it as a versioned workflow example.

---

## 9) API design (backend endpoints to add)

Add a new router: `phase1/services/api/routes/autopilot.py`

Endpoints:
- `GET /api/v1/autopilot/config` — current config + defaults
- `POST /api/v1/autopilot/config` — update config (budget, limits, universe, templates, forecast influence, llm mode)
- `POST /api/v1/autopilot/run` — trigger a single autopilot cycle (paper)
- `GET /api/v1/autopilot/status` — current run status, last run summary, next scheduled time (if any)
- `GET /api/v1/autopilot/proposals` — candidates and decisions from last run
- `GET /api/v1/autopilot/positions` — options ledger with greeks exposures
- `GET /api/v1/autopilot/logs` — structured logs for UI
- `POST /api/v1/autopilot/kill_switch` — pause autopilot (paper), close-all toggle optional

Note: even paper mode needs a kill switch because “runaway logic” is a failure mode.

---

## 10) UI/UX changes (frontend)

### 10.1 Navigation / IA
Add an “Autopilot” top-level area:
- Dashboard: status, next run, summary, risk
- Positions: current positions with greeks + max loss
- Activity: trades placed, fills, exits
- Proposals: candidates + chosen trades + rationale
- Settings: budget and guardrails

### 10.2 Key UX requirements
- Always show a prominent badge: **PAPER MODE**.
- “Budget” should be stated as:
  - Account equity
  - Max risk per trade
  - Max total risk
  - Max daily loss
  - Max open positions
- Provide an “Explain” drawer per trade:
  - template name
  - entry reasons, exit rules
  - forecast influence summary
  - risks and invalidation conditions
- Provide a “Why no trades today?” panel:
  - liquidity too low
  - earnings blackout
  - risk caps hit
  - LLM unavailable → fallback used

### 10.3 Where to integrate existing options UI
Reuse the current OptionsDashboard components:
- GreeksPanel, IVAnalyticsPanel, PayoffChart
Augment them with “Bot Template” context and “Candidate view.”

### 10.4 Frontend modules to add
- `frontend/src/features/autopilot/` (new)
  - `AutopilotDashboard.tsx`
  - `AutopilotPositions.tsx`
  - `AutopilotProposals.tsx`
  - `AutopilotSettings.tsx`
  - `api.ts`, `store.ts`, `types.ts`

Update:
- App routing and side-nav to include Autopilot.
- `SettingsView` to include autopilot defaults and (optional) LLM endpoint configuration.

---

## 11) Testing plan (must hit 0 skipped)

### 11.1 Fix existing skipped backend tests
Convert skipped tests into self-contained fixtures:
- `phase1/tests/integration/test_pipeline.py`
  - If fixture CSV missing, generate minimal synthetic ticks within the test (or bundle a CSV under `phase1/tests/fixtures/`).
- `phase1/tests/parity/test_parity.py`
  - Generate the CSV/hash fixtures during the test (or commit canonical fixtures into repo) so tests never skip.

Acceptance: backend test run must show **0 skipped**.

### 11.2 New backend tests to add
Unit tests:
- candidate generation yields bounded parameters
- validator rejects constraint violations with correct reason codes
- paper broker fill logic is deterministic given a seeded price path
- forecast outputs are well-formed and calibration counters update

Integration tests:
- `/autopilot/run` runs end-to-end using deterministic ranker
- `/autopilot/positions` returns exposures after trades

### 11.3 Frontend tests to add
- Component tests for Autopilot pages rendering, empty states, and error states.
- Ensure no `passWithNoTests` masking: tests should exist for new features.

### 11.4 E2E (Playwright MCP + Chrome DevTools MCP)
Mandatory E2E flows:
1) App boots, backend reachable.
2) Navigate to Autopilot Dashboard, confirm PAPER MODE badge.
3) Configure budget and risk caps.
4) Trigger “Run Autopilot.”
5) Verify proposals appear, trades executed (paper), positions updated.
6) Verify no console errors and no failed network calls.

Use Chrome DevTools MCP to:
- inspect any failing API calls
- capture console stack traces
- verify performance if UI hangs

### 11.5 Verification loop requirement
The agent must repeat until green:
- Loop A: Bug fixes
- Loop B: Playwright MCP snapshot & clicker
- Loop C: Full E2E run

Zero skipped tests. Zero failing tests.

---

## 12) How to run and use (developer runbook)

### Backend
- Run dev server from `phase1/`:
  - Start API on port 8000 (as described in `USAGE_GUIDE.md`)
- Run backend tests:
  - `make test` (or run unit/integration/parity targets)

### Frontend
- Run dev server from `frontend/`:
  - `npm run dev`
- Run tests:
  - `npm run test:unit`
  - `npm run test:int`
  - `npm run test:e2e`
  - `npm run test:3loop`

### Autopilot usage (paper)
- Open Autopilot Settings:
  - set equity=1000
  - set max risk/trade and caps
  - enable auto-execute
  - keep LLM disabled initially (deterministic ranker) to stabilize
- Trigger Autopilot run
- Review positions and daily report output
- Enable LLM endpoint only after deterministic pipeline is stable

---

## 13) Tradeoffs and failure modes (paper still needs realism)

### Key failure modes to design against
- Unrealistic fills → paper results meaningless
- Overtrading noise → constant churn, no signal
- Concentration drift → all exposure becomes QQQ/tech
- Forecast overreliance → false confidence
- LLM hallucination → prevented by validator, but still needs monitoring

### Minimal mitigations
- Seeded deterministic paper fill model + fill-rate KPIs
- Hard caps and concentration rules
- Forecast used as a bounded feature; auto-downweight when miscalibrated
- Fallback to deterministic ranker when LLM unavailable

---

# 14) Superprompt — “Implement everything” (for your coding agent)

## Summary
Implement a paper-only AI options autopilot inside the existing TradingView Recreation product (FastAPI + React), integrating forecasting, strategy templates, deterministic risk validation, optional LLM ranking, and local n8n orchestration hooks. Remove skipped tests (0 skips), and prove the system works via repeated Playwright MCP and Chrome DevTools MCP end-to-end verification loops until fully green.

## The prompt
ROLE: Principal full-stack engineer responsible for merging functionality, implementing new autopilot modules, updating UI/UX, and delivering complete test coverage.

NON-NEGOTIABLES
1) Do not stop until 100% success. Skipped tests count as failure.
2) Repeatedly run the 3-loop sequence until everything works:
   - Loop A: Bug fixes and refactors
   - Loop B: Playwright MCP snapshot & clicker (capture snapshots and failures)
   - Loop C: End-to-end loop (fresh start, run full test suite, validate no console errors)
3) Use Playwright MCP primarily. Use Chrome DevTools MCP to debug console/network/performance issues discovered during E2E.

SCOPE
A) Paper-only AI Options Autopilot
- Add backend module `phase1/services/autopilot/` implementing:
  - universe, features, forecasting indicator outputs, strategy templates, candidate generation
  - deterministic validator and paper broker simulator for multileg options
  - monitoring/exits and daily reporting
- Add backend module `phase1/services/llm/` with a pluggable provider interface:
  - deterministic stub used by tests
  - HTTP endpoint provider (Colab optional)
- Add API routes under `phase1/services/api/routes/autopilot.py` with endpoints defined in this plan.
- Integrate autopilot into the existing run orchestrator as `autopilot_paper`.

B) UI/UX
- Add `frontend/src/features/autopilot/` pages:
  - Dashboard, Positions, Proposals, Activity, Settings
- Ensure PAPER MODE is prominent.
- Add configuration UI for equity=1000, caps, max positions, strategy whitelist, forecast influence, and LLM enablement.
- Integrate with existing OptionsDashboard components for greeks and payoff visualization.

C) Testing
- Fix existing skipped backend tests by adding self-contained fixtures:
  - Remove all conditional `pytest.skip()` paths by generating/bundling fixtures.
- Add unit and integration tests for new autopilot modules.
- Add Playwright E2E tests for full autopilot flow.
- Ensure total test runs have 0 skipped and 0 failing.

D) Repo hygiene and docs
- Move any relevant n8n workflow examples into `n8n/workflows/` and document how to import them.
- Update `USAGE_GUIDE.md` to include Autopilot usage and configuration.
- Ensure the legacy Streamlit prototype is either removed from the product surface or explicitly documented as “not used” (no duplicated options math allowed).

ACCEPTANCE CRITERIA
- Autopilot can run a full cycle in paper mode and update UI state (proposals, trades, positions, exposures).
- Risk caps and concentration rules prevent runaway behavior.
- Forecast outputs are shown in UI and used only as bounded indicators.
- LLM ranking is optional; deterministic ranker is default and used in tests.
- All tests pass with 0 skips; E2E passes with no console errors and no failed network calls.
- The agent demonstrates the 3-loop sequence in the final report (logs and artifacts captured).

---

## Appendix A — Specific files likely to touch
Backend:
- Add: `phase1/services/autopilot/**`, `phase1/services/llm/**`
- Modify: `phase1/services/api/main.py` (register autopilot router), `phase1/services/execution/orchestrator.py` (add run type), `phase1/services/portfolio/*` (options ledger integration, or separate options book)
- Modify: tests under `phase1/tests/**` to eliminate skips and add new coverage

Frontend:
- Add: `frontend/src/features/autopilot/**`
- Modify: router/navigation, Settings UI, and possibly the dashboard tiles

---

End of plan.
