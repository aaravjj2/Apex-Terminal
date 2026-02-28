# APEX Terminal Tour v1.12 — Full Walkthrough Guide

**Video**: `APEX_TERMINAL_TOUR_v1_12.webm`  
**Duration**: ~5–7 minutes  
**Mode**: DEMO (fixture-driven, no network calls)  
**Date**: February 8, 2026  

---

## Overview

This tour demonstrates the complete APEX Options Terminal end-to-end, showcasing:
- Dashboard entry and navigation
- **NEW (v1.12)**: Finance lexicon disambiguation for ambiguous tickers (A, I, ON, IT, ARE)
- Options → Risk Desk: demo pipeline execution with trace and export
- Options → Strategy Lab: strategy creation, validation, and storage
- **Backtest (top-level tool)**: configuration, run, analysis, comparison, and export
  - Now promoted from Options submenu to standalone top navigation item
- Market data provider toggle (Demo vs Local with caching)
- Reporting and offline report viewing

All features run in **DEMO mode** for deterministic, network-free operation.

---

## Timestamped Chapters

### 00:00–00:30 — Dashboard Entry & Overview
- Launch APEX Terminal at `http://localhost:5100`
- Dashboard landing page visible
- Top navigation: Dashboard, Options, **Backtest** (promoted in v1.12), Autopilot
- Data Source Selector: "Demo Fixtures" (default)
- Brief overview of layout and theme

### 00:30–00:45 — Data Provider Toggle
- Click Data Source Selector dropdown
- Show three options: Demo Fixtures, Cached Yahoo, Yahoo Finance (network)
- Explain Demo = fixtures, Cached = disk cache, Yahoo = live (LOCAL mode)
- Select "Cached Yahoo" briefly, then return to "Demo Fixtures"
- Emphasize: DEMO mode uses NO network calls

### 00:45–01:15 — **NEW: Finance Lexicon Disambiguation (v1.12)**
- Navigate to chart or ticker input field
- Enter ambiguous ticker: "A" (could be ticker for Agilent or article "a")
- **Disambiguation Modal Appears**:
  - Title: "Ambiguous Input: 'A'"
  - Two options:
    1. **Ticker Symbol: A** (Agilent Technologies Inc.) — Load market data
    2. **English Word: "A"** — Ignore as ticker
  - Click "Ticker Symbol" option
- Modal closes, chart loads with AAPL data
- **Session Persistence**: Enter "A" again — no modal (session storage remembers choice)
- Click "Options" tab
- Enter "ON" — disambiguation modal appears again for different ambiguous ticker
- Click "English Word" — modal closes, no data loaded
- Demonstrate "Cancel" button restoring prior state

### 01:15–02:30 — Options → Risk Desk
- Click "Options" in top nav
- Default tab: Analytics (quick view)
- Click "Risk Desk" tab
- **Empty state**: Click "Load Demo"
- Demo positions load (AAPL calls/puts)
- Click "Run" button
- **Pipeline execution**: Status shows "Running"
- Wait for completion (~2-3 seconds)
- **Results display**:
  - Greeks card: Delta, Gamma, Vega, Theta visible
  - Scenario analysis table
  - Premium risk charts (payoff curve, Greeks sensitivity)
- **Tool Trace**: Click "Trace" subtab
  - Show step-by-step tool execution log
  - Each step has timestamp, tool name, status
  - Deterministic order: load → calculate → analyze → export
- **Audit Export**: Click "Export" subtab
  - Click "Download Bundle" button
  - ZIP file downloads: `risk_desk_audit_<run_id>.zip`
  - Contents: `manifest.json`, `trace.json`, `results.json`, `report.html`
  - Open `report.html` offline to show compliance-ready report

### 02:30–03:30 — Options → Strategy Lab
- Click "Strategy Lab" tab
- Default subtab: Builder
- **Builder**:
  - Select strategy template (e.g., Iron Condor)
  - Adjust strikes and quantities
  - Real-time P/L preview chart updates
- **Library subtab**:
  - Show pre-built demo strategies (Straddle, Strangle, Butterfly)
  - Click one to load into builder
- **Validate subtab**:
  - Paste strategy JSON (demo example provided)
  - Click "Validate"
  - Success: Green banner, "Strategy valid"
  - Failure example: Invalid JSON → Red banner with error details
- **Store subtab**:
  - Save validated strategy with name and tags
  - Confirm storage in local ledger

### 03:30–06:00 — **Backtest (Top-Level Tool, Promoted in v1.12)**
- **Click "Backtest" in top nav** (NOT inside Options)
  - Previously nested under Options, now standalone for v1.12
- **Configure subtab (default)**:
  - Strategy dropdown: Select "SMA Crossover"
  - Symbol: AAPL (pre-filled)
  - Date range: 2023-01-01 to 2023-03-31
  - Initial capital: $100,000
  - Click "Run Backtest"
- **Execution**:
  - Progress indicator shows "Running backtest..."
  - Completes in ~2-3 seconds
  - Auto-navigate to Runs subtab
- **Runs subtab**:
  - Table shows Run 0: run_id, strategy, date range, status=completed
  - Metrics: Total Return, Sharpe Ratio, Max Drawdown
  - Click row to expand details
- **Analyze subtab**:
  - Click "Analyze" subtab
  - **Chart 1**: Equity curve (interactive, brush zoom)
  - **Chart 2**: Drawdown chart (area fill, percentage)
  - **Chart 3**: Daily returns histogram
  - **Chart 4**: Monthly returns heatmap
  - **Chart 5**: Rolling 30-day Sharpe ratio
  - Trade blotter table below charts
  - All charts use deterministic rendering (no animation flicker)
- **Compare subtab**:
  - Click "Compare" subtab
  - Select 2 runs (if multiple exist, else show placeholder)
  - Delta metrics table: Sharpe Ratio Δ, Return Δ, Drawdown Δ
  - Overlay equity curves chart
- **Export subtab**:
  - Click "Export" subtab
  - Click "Download Export Package"
  - ZIP file downloads: `backtest_export_<run_id>.zip`
  - Contents: `report.html`, `trades.csv`, `equity.csv`, `manifest.json`
  - Open `report.html` offline to show full analysis with embedded charts (SVG)
- **Determinism Verification** (v1.12):
  - Run same configuration twice
  - Compare exported JSON outputs (byte-level identical)
  - Demonstrate canonical hashing with SHA256
  - Show proof artifacts in `artifacts/proof/.../determinism/`

### 06:00–06:30 — Reporting & Offline Viewing
- Navigate to Downloads folder
- Open `risk_desk_audit_<run_id>/report.html` in browser
- Show: Standalone, offline-viewable report with full trace and results
- Open `backtest_export_<run_id>/report.html` in browser
- Show: Standalone backtest report with charts, metrics, and trade log
- Emphasize: Compliance-ready, auditable, shareable

### 06:30–07:00 — Market Data Provider Caching Demo
- Return to Dashboard
- Click Data Source Selector → "Cached Yahoo"
- Explain: In LOCAL mode, first fetch downloads data and caches to disk
- Subsequent requests hit cache (instant, deterministic)
- Show cache directory: `.cache/market_data/` (optional quick peek in terminal)
- Return to "Demo Fixtures" for demo consistency

### 07:00–07:30 — Recap & Summary
- **Dashboard**: Entry point, navigation, data provider toggle
- **NEW (v1.12)**: Lexicon disambiguation modal for ambiguous tickers
- **Options → Risk Desk**: Demo pipeline, Greeks, trace, audit export
- **Options → Strategy Lab**: Builder, library, validate, store
- **Backtest (top-level, v1.12)**: Configure, run, analyze (5 charts), compare, export
- **Determinism (v1.12)**: Byte-level verification with canonical hashing
- **Offline Reports**: Compliance-ready HTML exports
- **Deterministic Operation**: DEMO mode = zero network calls, reproducible results
- **Zero test failures**: TypeScript ✓, Vitest ✓, Pytest ✓, Playwright ✓ (core tests)

---

## v1.12 Changes Highlighted in Tour

1. **Finance Lexicon Disambiguation**: Modal for ambiguous tickers (A, I, ON, IT, ARE)
2. **Backtest Module Promotion**: Moved from Options submenu to top-level navigation
3. **Determinism Proof**: Demonstrated canonical hashing and byte-level output verification
4. **Selector Policy**: All E2E interactions use data-testid only (no text/role selectors)
5. **Session Storage**: Disambiguation choices persist per session (ephemeral)

---

## Recording Notes

**Environment**:
- DEMO_MODE=1 (backend)
- Frontend: Vite preview build
- Resolution: 1440×900 (matches E2E viewport)
- Browser: Chrome, no dev tools, clean profile

**Tips**:
- Use OBS, Screenflow, or Playwright video capture
- Disable browser animations if recording with OBS (CSS override in tour script)
- Use smooth mouse movements and pause briefly at each milestone
- Add chapter markers in post if video editor supports

**Audio** (optional):
- Narration explaining each step
- Or generate with ElevenLabs using script above as transcript

---

## Deliverable Checklist

- [ ] Record `APEX_TERMINAL_TOUR_v1_11.webm` (5–7 minutes)
- [ ] Add chapter markers or timestamps in video metadata
- [ ] Include video in proof pack: `artifacts/proof/<timestamp>-v1.11/tour/`
- [ ] Verify video plays in VLC, Chrome, and Firefox
- [ ] TOUR.md (this file) included in proof pack
- [ ] Video demonstrates ALL objectives (D, E, F) from v1.11 requirements

---

## Quick Start (Reproduce This Tour)

```bash
# 1. Start backend (DEMO mode)
cd phase1
source ../keys.env
DEMO_MODE=1 uvicorn services.api.main:app --host 0.0.0.0 --port 8000

# 2. Build and start frontend
cd ../frontend
npm run build
npm run preview -- --port 5100

# 3. Open browser
open http://localhost:5100

# 4. Follow timestamped chapters above
```

---

**End of Tour Guide**
