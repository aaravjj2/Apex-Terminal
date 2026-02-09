# Implementation Plan: Production-Grade Options Workstation

**Date**: January 13, 2026  
**Status**: In Progress  
**Engineer**: Autonomous Staff Engineer

---

## STEP 0: Repository Discovery ✅ COMPLETE

### Canonical Components
- **Backend**: `phase1/` (Python + FastAPI) - Port 8000 ✅ Running
- **Frontend**: `frontend/` (React + Vite + TypeScript) - Port 5100 ✅ Running
- **Data Providers**: Alpaca (LIVE), yfinance (Options), Finnhub (backup)

### Alpaca Configuration Status
✅ **Alpaca Live Keys Configured**:
- `ALPACA3_KEY=PK3OFL2DZZVBK75O3HON4URWAJ`
- `ALPACA3_SECRET=76TzT5eFr5sn7NKKZ2visigC9LMZAs2usqcZuALjSKb5`
- `ALPACA3_ENDPOINT=https://paper-api.alpaca.markets`

✅ **Active Ingestion Mode**: LIVE (Alpaca)
- Backend automatically detects Alpaca keys and switches to LIVE mode
- Ingestion service configured for symbols: AAPL, TSLA, MSFT

### Existing Implementation Status

#### Backend (`phase1/services/`)
**✅ COMPLETE:**
- Options data adapter (`options/adapter.py`) - yfinance integration with NaN sanitization
- Greeks calculator (`options/greeks.py`) - Black-Scholes Delta, Gamma, Theta, Vega, Rho
- IV Analytics (`options/iv_analytics.py`) - IV Rank, IV Percentile, Skew, Term Structure
- Strategy Factory (`options/strategy_factory.py`) - Strategy templates framework
- Options API routes (`api/routes/options.py`) - REST endpoints
- Bar engine + ingestion pipeline - Real-time ticks to candles
- Portfolio/execution adapters - Alpaca trading integration
- Persistence layer - SQLAlchemy + async support

**⚠️ NEEDS EXTENSION:**
- Volume Profile calculations (POC, VAH, VAL, HVN/LVN)
- Pattern detection engine
- Fundamentals data ingestion (ROIC, FCF, margins)
- Advanced indicator calculations (Anchored VWAP, ATR Bands)

#### Frontend (`frontend/src/features/`)
**✅ COMPLETE:**
- Shell/Layout system with workspaces (Chart, Dashboard)
- Chart canvas + indicator system (SMA, EMA, RSI, MACD, Bollinger, ATR, VWAP)
- Options Dashboard (`options/OptionsDashboard.tsx`)
- Greeks Panel (`options/components/GreeksPanel.tsx`)
- IV Analytics Panel (`options/components/IVAnalyticsPanel.tsx`)
- Strategy editor framework (`strategy/StrategyEditor.tsx`)
- Trading banner with account/mode display
- Bottom panel + Right dock infrastructure

**⚠️ NEEDS IMPLEMENTATION:**
- **Trust UX**: Persistent mode indicator (LIVE/REPLAY/PAPER/BACKTEST) + provider health
- **Options Integration**: Complete chain explorer, skew/term structure charts
- **Indicator Manager Dock**: Add/remove indicators, edit params, save presets
- **Volume Profile Overlays**: POC/VAH/VAL zones, HVN/LVN markers
- **Strategy Builder UI**: Complete payoff charts, Greeks exposure, strategy templates
- **Pattern Annotations**: Visual markers for flags, triangles, H&S, etc.
- **Fundamentals Panel**: ROIC, FCF, margins, quality metrics

---

## STEP 1: Build Plan & Milestones

### Phase 1: Backend Analytics (Options + Indicators)
**Goal**: Complete all backend calculation engines

#### 1.1 Options Analytics
- [ ] **IV Analytics Extensions**
  - Enhance term structure detection (contango/backwardation alerts)
  - Add skew anomaly detection (tail risk pricing)
  - Implement OI/Volume aggregation by strike/expiry
- [ ] **Put/Call Ratio Module**
  - Volume-based PCR (configurable window)
  - OI-based PCR
  - Historical PCR tracking
- [ ] **Greeks Aggregation**
  - Portfolio-level Greeks exposure
  - Strategy-level Greeks summaries
- **Files**: `phase1/services/options/iv_analytics.py`, new `pcr_calculator.py`
- **Tests**: `phase1/tests/unit/test_iv_analytics_extended.py`

#### 1.2 Volume Profile Engine
- [ ] **Profile Calculator**
  - Visible Range Volume Profile (VRVP)
  - Fixed Range Volume Profile (FRVP)
  - Session Profile (daily/weekly)
  - POC, VAH, VAL calculations
  - HVN/LVN zone detection
  - Developing POC (real-time)
- [ ] **API Routes**
  - `GET /api/v1/profiles/{symbol}?range=visible|fixed|session`
  - Query params: start_time, end_time, num_rows
- **Files**: `phase1/services/charting/volume_profile.py`, `phase1/services/api/routes/profiles.py`
- **Tests**: `phase1/tests/unit/test_volume_profile.py`

#### 1.3 Advanced Indicators
- [ ] **Anchored VWAP**
  - Support anchor points (timestamp, event, candle index)
  - VWAP bands (std dev multiples)
  - Multiple AVWAP instances per chart
- [ ] **ATR Extensions**
  - ATR Bands (price ± N*ATR)
  - ATR Trailing Stop
- [ ] **EMA Regime Filter**
  - Slope calculation (angle/rate of change)
  - Crossover state detection (20/50, 50/200)
  - Regime categorization (bullish/bearish/neutral)
- **Files**: `phase1/services/charting/indicators.py` (extend existing)
- **Tests**: `phase1/tests/unit/test_indicators_advanced.py`

#### 1.4 Strategy Factory Templates
- [ ] **Complete Strategy Definitions**
  - Covered Call, Cash-Secured Put, Protective Put
  - Collar, Vertical Spread (Debit/Credit)
  - Iron Condor, Calendar/Diagonal
  - Long Straddle/Strangle
  - Earnings Vol Crush templates
- [ ] **Payoff Calculator**
  - P&L at expiry for all strikes
  - Breakeven points
  - Max gain/loss
  - Greeks exposure per strategy
- [ ] **Backtest Integration** (stub if data unavailable)
  - Store strategy configs
  - Historical simulation (where data exists)
  - Return "backtest unavailable" clearly if no data
- **Files**: `phase1/services/options/strategy_factory.py` (extend)
- **Tests**: `phase1/tests/unit/test_strategy_templates.py`

#### 1.5 Pattern Detection Engine
- [ ] **Pattern Detection Module**
  - Flags/Pennants, Triangles, Rectangles/Ranges
  - Wedges, Double Top/Bottom
  - Head & Shoulders, Cup & Handle
  - Gap classification (breakaway/runaway/exhaustion)
  - Candle confirmations (limited set: engulfing, doji, hammer)
- [ ] **Context Filtering**
  - Require ATR regime check
  - Reference VWAP/profile levels
  - Structure confirmation (prior swing high/low)
- [ ] **API Routes**
  - `GET /api/v1/patterns/{symbol}?timeframe=1D&lookback=100`
  - Return: pattern type, confidence, context explanation
- **Files**: `phase1/services/charting/patterns.py`, `phase1/services/api/routes/patterns.py`
- **Tests**: `phase1/tests/unit/test_patterns.py`

#### 1.6 Fundamentals Ingestion
- [ ] **Fundamentals Data Adapter**
  - Source: yfinance, Alpaca fundamentals API, or public APIs
  - Metrics: ROIC, Gross Profit Margin, Operating Profit Margin
  - FCF, FCF Yield, Shareholder Yield
  - Leverage ratios (Debt/Equity)
  - Margin stability (trend over quarters)
  - Asset growth, Investment discipline proxies
  - Earnings quality (accruals vs cash where available)
  - EV/FCF or FCF Yield valuation
- [ ] **Storage & Caching**
  - Store snapshots with timestamps + provider metadata
  - Cache for 24h (fundamentals don't change intraday)
- [ ] **API Routes**
  - `GET /api/v1/fundamentals/{symbol}`
  - Return: all metrics + "unavailable" for missing fields
- **Files**: `phase1/services/fundamentals/adapter.py`, `phase1/services/api/routes/fundamentals.py`
- **Tests**: `phase1/tests/unit/test_fundamentals_adapter.py`

---

### Phase 2: Frontend Integration & Trust UX
**Goal**: Wire all analytics to UI with proper Trust UX

#### 2.1 Trust UX (CRITICAL - Always Visible)
- [ ] **Mode Indicator Chip**
  - Top bar persistent badge: LIVE | REPLAY | PAPER | BACKTEST
  - Color coded: Green (LIVE/PAPER), Blue (REPLAY), Gray (BACKTEST)
  - Click to show mode details modal
- [ ] **Provider Health Indicator**
  - Alpaca connection status (connected/disconnected)
  - Last tick timestamp (stale data warning if >5s old)
  - Heartbeat icon (pulse animation when live)
- [ ] **Data Provenance Banner**
  - Show active symbols + data sources
  - Example: "AAPL: Alpaca (LIVE) | Options: yfinance"
  - Warning if keys missing: "⚠️ No Alpaca keys - using mock data"
- **Files**: 
  - `frontend/src/features/layout/shell/TrustUX.tsx` (new component)
  - `frontend/src/features/layout/shell/TopBar.tsx` (integrate chip)
  - `frontend/src/state/appStore.ts` (add mode/health state)
- **Tests**: `frontend/tests/unit/TrustUX.test.tsx`

#### 2.2 Options Suite UI
- [ ] **Options Chain Explorer**
  - Full chain table: Strike, Bid, Ask, Volume, OI, IV, Greeks
  - Sortable columns, filter by delta/moneyness
  - Highlight ITM/ATM/OTM zones
  - Export to CSV
- [ ] **IV Analytics Panel**
  - IV Rank gauge (0-100 with historical range)
  - IV Percentile chart (line chart over lookback)
  - Volatility Skew chart (IV vs Strike scatter + regression line)
  - Term Structure chart (IV vs DTE line chart)
  - PCR indicators (Volume PCR, OI PCR badges with color coding)
- [ ] **Greeks Dashboard**
  - Portfolio Greeks summary (Net Delta, Gamma, Theta, Vega)
  - Position-level Greeks breakdown
  - Greeks by strategy (if strategy selected)
- **Files**:
  - `frontend/src/features/options/OptionsChainTable.tsx` (new)
  - `frontend/src/features/options/VolatilitySkewChart.tsx` (new)
  - `frontend/src/features/options/TermStructureChart.tsx` (new)
  - `frontend/src/features/options/components/IVAnalyticsPanel.tsx` (enhance)
  - `frontend/src/features/options/components/GreeksPanel.tsx` (enhance)
- **Tests**: `frontend/tests/integration/OptionsFlow.test.tsx`

#### 2.3 Indicator Manager Dock
- [ ] **Indicator Registry UI**
  - Right dock panel: "Indicators"
  - List all available indicators by category (Trend, Momentum, Volatility, Volume, Profile)
  - Search/filter indicators
- [ ] **Add Indicator Flow**
  - Click indicator → parameter editor modal
  - Adjust params (period, color, style)
  - Apply → indicator rendered on chart
- [ ] **Active Indicators Panel**
  - List active indicators with quick toggles (show/hide, delete)
  - Edit button → reopen params editor
- [ ] **Favorites & Presets**
  - Save indicator configs as presets
  - Load preset (e.g., "Day Trading Setup": EMA20, VWAP, ATR)
- **Files**:
  - `frontend/src/features/indicators/IndicatorDock.tsx` (enhance)
  - `frontend/src/features/indicators/IndicatorAddModal.tsx` (new)
  - `frontend/src/features/indicators/IndicatorParamsEditor.tsx` (new)
- **Tests**: `frontend/tests/integration/IndicatorManager.test.tsx`

#### 2.4 Volume Profile & Levels Overlay
- [ ] **Profile Visualization**
  - Horizontal histogram overlaid on price chart
  - POC line (brightest/thickest)
  - VAH/VAL lines (dashed)
  - HVN/LVN zones (shaded rectangles)
- [ ] **Profile Settings Panel**
  - Right dock: "Profile Settings"
  - Select profile type: VRVP, FRVP, Session
  - Adjust parameters: num_rows, range
  - Toggle POC/VAH/VAL visibility
- [ ] **Anchored VWAP Tool**
  - Drawing tool: click to anchor VWAP at specific candle
  - Multiple AVWAP instances with labels
  - AVWAP bands toggle (±1σ, ±2σ)
- **Files**:
  - `frontend/src/features/chart/overlays/VolumeProfile.tsx` (new)
  - `frontend/src/features/chart/overlays/AnchoredVWAP.tsx` (new)
  - `frontend/src/features/chart/ChartCanvas.tsx` (integrate overlays)
- **Tests**: `frontend/tests/integration/ProfileOverlays.test.tsx`

#### 2.5 Strategy Builder UI
- [ ] **Strategy Template Selector**
  - Modal/panel: "Build Strategy"
  - Dropdown: select template (Covered Call, Iron Condor, etc.)
  - Input fields: underlying, expiry, strikes
- [ ] **Payoff Chart**
  - Interactive payoff diagram (P&L vs underlying price at expiry)
  - Breakeven points marked
  - Max gain/loss annotations
- [ ] **Greeks Exposure Panel**
  - Show Delta, Gamma, Theta, Vega for selected strategy
  - Compare to current portfolio Greeks
- [ ] **Backtest Integration** (stub)
  - Button: "Backtest Strategy"
  - If data available: run simulation, show results
  - If unavailable: "⚠️ Backtest unavailable - insufficient historical options data"
- **Files**:
  - `frontend/src/features/strategy/StrategyBuilder.tsx` (new)
  - `frontend/src/features/strategy/PayoffChart.tsx` (enhance)
  - `frontend/src/features/strategy/StrategyGreeksPanel.tsx` (new)
- **Tests**: `frontend/tests/integration/StrategyBuilder.test.tsx`

#### 2.6 Pattern Annotations
- [ ] **Pattern Markers on Chart**
  - Visual markers (icons/shapes) for detected patterns
  - Hover: show pattern type + confidence + context explanation
  - Click: open pattern details modal
- [ ] **Pattern Filter Panel**
  - Right dock: "Patterns"
  - Checkboxes to enable/disable pattern types
  - Confidence threshold slider
- **Files**:
  - `frontend/src/features/chart/overlays/PatternMarkers.tsx` (new)
  - `frontend/src/features/chart/PatternFilterPanel.tsx` (new)
- **Tests**: `frontend/tests/integration/PatternDetection.test.tsx`

#### 2.7 Fundamentals Panel
- [ ] **Fundamentals Tile (Dashboard Workspace)**
  - Tile: "Fundamentals"
  - Display all metrics in categorized sections:
    - Profitability: ROIC, Gross Margin, Operating Margin
    - Cash Flow: FCF, FCF Yield, Shareholder Yield
    - Leverage: Debt/Equity
    - Quality: Margin stability, Earnings quality
    - Valuation: EV/FCF, FCF Yield
  - Show "Data unavailable" for missing metrics with reason
- [ ] **Historical Trend Charts** (optional)
  - Line charts for key metrics over quarters
  - Trend arrows (improving/declining)
- **Files**:
  - `frontend/src/features/dashboard/tiles/FundamentalsTile.tsx` (new)
  - `frontend/src/features/dashboard/DashboardView.tsx` (integrate tile)
- **Tests**: `frontend/tests/integration/FundamentalsTile.test.tsx`

---

### Phase 3: Testing & Verification (Loop A+B+C)
**Goal**: Achieve 100% pass rate with 0 skipped tests

#### 3.1 Loop A: Unit & Integration Tests
- [ ] **Backend Unit Tests**
  - Options: IV, Greeks, Strategy Factory, PCR
  - Indicators: Volume Profile, AVWAP, ATR, EMA Regime
  - Patterns: Detection, Context Filtering
  - Fundamentals: Adapter, Parsing
- [ ] **Backend Integration Tests**
  - Full options flow: Fetch chain → Calculate Greeks → Return JSON
  - Ingestion → Bar Engine → Indicator Calculation
  - Strategy Factory → Payoff → Backtest (stub)
- [ ] **Frontend Unit Tests**
  - Trust UX components
  - Indicator manager
  - Options panels
  - Strategy builder
- [ ] **Run Commands**:
  ```bash
  # Backend
  cd phase1
  pytest -v --tb=short --strict-markers -q
  
  # Frontend
  cd frontend
  npm run test:unit
  ```
- **Success Criteria**: All tests pass, 0 skipped

#### 3.2 Loop B: Playwright E2E (via .ag runner)
- [ ] **Create E2E Plan**: `.ag/inbox/plan.json`
- [ ] **E2E Scenarios**:
  1. App loads in LIVE mode with Alpaca keys
  2. Trust UX visible: Mode chip shows "LIVE", provider health green
  3. Switch symbol to AAPL → Chart updates
  4. Add 3 indicators (EMA20, ATR, VWAP) → Verify rendered
  5. Edit EMA params → Change period to 50 → Verify update
  6. Open Options panel → Verify chain loads (or "Data unavailable")
  7. Check IV Rank/Percentile and Skew/Term Structure charts
  8. Build Iron Condor strategy → Verify payoff chart + Greeks
  9. Switch to Dashboard workspace → Add Fundamentals tile
  10. Verify no console errors
  11. Take final screenshot
- [ ] **Run Command**:
  ```bash
  npm run ag:run -- --headed
  ```
- [ ] **Artifacts**: `.ag/artifacts/<sessionId>/` (trace.zip, screenshots, video)
- **Success Criteria**: `passed: true` in `.ag/outbox/results.json`

#### 3.3 Loop C: Full Test Suite
- [ ] **Run Full Suite**:
  ```bash
  # Backend
  cd phase1
  pytest tests/unit/ tests/integration/ -v --tb=short
  
  # Frontend
  cd frontend
  npm run test:unit
  npm run test:integration
  
  # E2E
  npm run ag:run
  ```
- [ ] **Parity Checks** (if applicable):
  - Compare indicator calculations with reference implementations
- [ ] **Live Sanity Check**:
  - Manually verify AAPL live data streaming
  - Check Alpaca WebSocket connection in logs
  - Verify options chain loads real data
- **Success Criteria**: 100% pass, 0 skipped, 0 errors

---

### Phase 4: Final Report & Artifacts
**Goal**: Deliver comprehensive proof of completion

#### 4.1 Generate Final Report
- [ ] **Create**: `docs/final_report.md`
- [ ] **Contents**:
  - Feature checklist (implemented vs not)
  - Exact commands executed (servers, tests)
  - Test outputs summary (0 skipped, 0 failed)
  - Links/paths to Playwright artifacts
  - Screenshots of Chart + Dashboard workspaces
  - Known limitations + next steps
- [ ] **Artifacts Paths**:
  - Backend tests: `phase1/test-results/`
  - Frontend tests: `frontend/test-results/`
  - E2E: `.ag/artifacts/<sessionId>/`

#### 4.2 Screenshots
- [ ] Chart workspace: AAPL with EMA20, VWAP, Volume Profile, Pattern markers
- [ ] Dashboard workspace: Options tile + Fundamentals tile + Strategy builder
- [ ] Trust UX: Mode chip + Provider health indicator

---

## ABSOLUTE STOP CONDITION

✅ **STOP ONLY WHEN**:
1. ✅ Backend running on port 8000 (LIVE mode with Alpaca)
2. ✅ Frontend running on port 5100
3. ✅ All unit/integration tests pass (0 skipped)
4. ✅ Playwright E2E reports `passed: true`
5. ✅ Artifacts exist: trace.zip, screenshots, video
6. ✅ `docs/final_report.md` generated with proof

---

## CURRENT STATUS

- [x] Backend running (Port 8000, LIVE mode)
- [x] Frontend running (Port 5100)
- [x] Alpaca keys configured & validated
- [ ] Options analytics complete
- [ ] Volume Profile implemented
- [ ] Trust UX integrated
- [ ] Full test suite green
- [ ] E2E passed
- [ ] Final report generated

**Next Action**: Begin Phase 1 implementation (Backend Analytics Extensions)
