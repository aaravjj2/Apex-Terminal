# Side Project Review: Local-Only VWAP Paper Trading System

## 1) Repository Analysis (Detailed, Current State)

### 1.0 Analysis Inputs (Commands Executed)
- `ls`
- `sed -n '1,200p' README.md`
- `sed -n '1,200p' CURRENT_STATE.md`
- `sed -n '1,200p' TEST_STATUS_SUMMARY.md`
- `sed -n '1,160p' QUICK_REFERENCE.md`

### 1.1 Repository Purpose and Scope
- The repo is a **TradingView-style market workstation** with charting, analytics, strategy tooling, and paper trading. It is built as a production-grade platform combining charting and Bloomberg-style dashboards, with a strong focus on indicators and strategy tooling.【F:README.md†L1-L169】
- The architecture uses **React + TypeScript + Vite** on the frontend and **FastAPI + SQLAlchemy** on the backend, with a real-time WebSocket layer for streaming updates.【F:README.md†L169-L214】

### 1.2 Top-Level Project Layout (Documented)
- The `CURRENT_STATE.md` file provides a structured overview of the current repo layout, including `frontend/`, `phase1/` (backend), and `n8n/` automation workflows, with counts of modules and tests.【F:CURRENT_STATE.md†L24-L67】
- The README details the full feature set, including advanced indicators, strategy development, and paper trading capabilities, which indicates a **broad market analysis platform** rather than a single-purpose trading bot.【F:README.md†L62-L166】

### 1.3 Frontend (React) Architecture
- The frontend is organized into **feature modules** (charting, indicators, layout, options, trading, portfolio, etc.) and a UI component library. This suggests a fairly mature UI layer with reusable primitives and large views.【F:CURRENT_STATE.md†L68-L139】
- There is a major **UnifiedDashboardView** that appears to orchestrate the UI for positions, orders, and other widgets in one main screen, with references to API calls for autopilot reporting and portfolio data.【F:CURRENT_STATE.md†L141-L201】

### 1.4 Backend (FastAPI) Architecture
- The backend (in `phase1/`) is described as a service-based architecture with a SQLite database, data ingestion, bar engine, and strategy engine components. The README indicates that SQLite is the default, with PostgreSQL support also present.【F:README.md†L193-L213】
- A local-only deployment appears already supported through the quick start docs and CLI commands documented in the repo.【F:QUICK_REFERENCE.md†L1-L73】

### 1.5 Testing & Tooling
- The repository includes Playwright-based frontend tests; the test status report indicates UI tests exist and are currently partially passing, with specific failures traced to backend connectivity and UI rendering issues in options-related views.【F:TEST_STATUS_SUMMARY.md†L1-L150】
- The quick reference documents separate test commands for backend and frontend, suggesting a standard split testing workflow for Python + React stacks.【F:QUICK_REFERENCE.md†L55-L73】

### 1.6 Operations & Developer UX
- The quick reference includes expected runtime commands for the backend, frontend, and ingestion components, showing the repo already has a **multi-service workflow** and a defined developer path for running it locally.【F:QUICK_REFERENCE.md†L1-L36】

---

## 2) Review of Your Proposed Side Project vs. This Repo

### 2.1 Fit with Existing Architecture
- Your proposed system (Runner + FastAPI + React dashboard + local SQLite) aligns closely with this repo’s established architecture: a FastAPI backend, React frontend, and local database with real-time updates.【F:README.md†L169-L214】
- The repo already includes indicators (EMA/RSI/ADX/VWAP) and strategy tooling, which means **core technical components exist** that could be reused or extended for the VWAP dual-engine strategy you describe.【F:README.md†L80-L112】

### 2.2 Where It Diverges
- The proposed side project is focused on a **single deterministic paper-trading strategy** with strict constraints, while the existing repo is a **generalized platform** with multiple modes (live, replay, backtest, paper), wide feature scope, and several subsystems (options workstation, autopilot, etc.).【F:README.md†L120-L158】
- The project already has a large surface area (dashboard tiles, options workflows, automation/n8n). That breadth increases complexity if you attempt to integrate a new, tightly constrained runner + dashboard without isolating it well.【F:CURRENT_STATE.md†L68-L139】

---

## 3) Recommendation: Separate Project vs. Integrate

### Recommendation Summary
**Build the VWAP dual-engine paper-trading system as a separate, minimal repo initially, then integrate only after the core system passes tests and stabilizes.**

### Why separate first
1. **Scope containment:** Your spec is deterministic and test-heavy (indicator parity tests, idempotency, full Playwright MCP non-headless E2E), which is best validated in a minimal environment where you control all variables.
2. **Risk isolation:** The current repo has non-trivial testing failures and large optional components (options workstation, automation). Adding new strategy logic here risks expanding the failure surface while you’re still in development mode.【F:TEST_STATUS_SUMMARY.md†L1-L150】
3. **Cleaner contracts:** You can design the Runner, DB schema, and metrics with a single-purpose API. Once stable, these components can be ported or integrated into the larger workstation backend (e.g., under `phase1/services/`).

### When to integrate
- After the standalone system demonstrates 100% test passing with deterministic demo mode, integrate by **embedding your Runner + DB schema into the existing backend** and **mounting the React dashboard as a separate route**, keeping boundaries clean to avoid breaking existing features.
- This repo’s backend and frontend stacks are aligned, so the integration path is straightforward once the core logic is proven stable.【F:README.md†L169-L214】

---

## 4) Suggested Integration Strategy (If You Decide to Merge Later)

1. **Backend**: Add a dedicated `services/vwap_runner` module in `phase1/` and keep its schema migrations isolated to avoid cross-impact.
2. **API**: Namespace endpoints under `/api/v2/vwap/` or `/api/v1/paper/vwap/` to keep the existing API stable.
3. **UI**: Add a new dashboard view under `frontend/src/features/` and keep it routed separately from the current dashboards to avoid regressions.
4. **Tests**: Mirror your Playwright non-headless E2E suite but keep it in a separate test project until existing test status is stabilized.

---

## 5) Final Guidance

Given the repo’s breadth and current partial test failures, the fastest route to your spec is **a clean, dedicated codebase** with only the runner + API + dashboard you need. Then, once validated, merge into this repo as a structured feature module that doesn’t disturb existing functionality.【F:TEST_STATUS_SUMMARY.md†L1-L150】
