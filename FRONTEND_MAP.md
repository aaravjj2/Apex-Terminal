# Apex Terminal — Frontend Structure Map
> Complete architectural map of the frontend codebase as of March 2026

---

## Tech Stack

| Layer | Library | Version | Role |
|-------|---------|---------|------|
| Framework | React | ^19.2.0 | UI rendering |
| Language | TypeScript | ~5.9.3 | Type safety |
| Build | Vite | ^5.2.0 | Dev server + bundler (port 5100) |
| Routing | react-router-dom | ^7.13.0 | SPA routing |
| State | Zustand + Immer | ^5.0.9 / ^11.1.3 | Global stores |
| Charts (primary) | lightweight-charts | ^5.1.0 | TradingView-style OHLCV canvas charts |
| Charts (secondary) | Recharts + Chart.js | ^3 / ^4 | Analytical charts (portfolio, risk) |
| Styling | Tailwind CSS v4 | ^4.1.18 | Utility-first styling |
| CSS utilities | clsx + tailwind-merge | ^2 / ^3 | Conditional classnames |
| Icons | lucide-react | ^0.562.0 | SVG icon system |
| Layout | react-resizable-panels | ^4.3.2 | Drag-resize panel layouts |
| Command palette | cmdk | ^1.1.1 | Bloomberg-style command line |
| Date helpers | date-fns | ^4.1.0 | Time formatting |
| Unit tests | Vitest | ^4.0.16 | Component unit tests |
| E2E tests | Playwright | ^1.57.0 | Browser automation tests |
| Accessibility | @axe-core/playwright | ^4.11.1 | A11y audit in CI |

**Backend proxy:** `/api` + `/ws` → `localhost:8000`

---

## Directory Tree

```
frontend/
├── index.html                    ← SPA entry shell
├── vite.config.ts                ← Port 5100, proxy config, git SHA injection
├── tailwind.config.js            ← Design tokens (see Design System section)
├── postcss.config.js
├── tsconfig.json / .app / .node
├── eslint.config.js
├── playwright.config.ts          ← Main E2E config
├── playwright.config.mcp.ts      ← MCP browser automation
├── playwright.risk-desk.config.ts
├── playwright.waves6-10.config.ts
├── vitest.config.ts
└── src/
    ├── App.tsx                   ← Root: routes / + /ui2/* + /legacy/*
    ├── main.tsx                  ← ReactDOM.createRoot entry
    ├── index.css                 ← Global reset
    ├── App.css
    │
    ├── api/                      ← REST API client functions
    ├── assets/                   ← Static assets
    ├── components/               ← Shared generic components
    ├── config/                   ← App-level configuration
    ├── core/                     ← Chart engine core
    ├── data/                     ← Live data clients (WS, HTTP, Clock)
    ├── designSystem/             ← Bloomberg design tokens
    ├── features/                 ← Feature modules (primary business logic)
    ├── hooks/                    ← Shared React hooks
    ├── lib/                      ← Pure domain logic (no React)
    ├── pages/                    ← Legacy UI1 page components
    ├── state/                    ← Global Zustand stores
    ├── styles/                   ← CSS design tokens (legacy)
    ├── ui/                       ← UI1 primitive component library
    ├── ui2/                      ← UI2 shell + 150+ pages (CURRENT)
    └── utils/                    ← Utility helpers
```

---

## Routing Architecture

```
/                   → redirect → /ui2/dashboard
/ui2/*              → AppShellUI2 (current primary)
/legacy/*           → Shell (UI1, legacy)
*                   → redirect → /ui2/dashboard
```

### UI2 Primary Routes (`/ui2/...`)

| Route | Component | Category |
|-------|-----------|----------|
| `dashboard` | DashboardUI2 | Core |
| `trading` | TradingUI2 | Core |
| `portfolio` | PortfolioUI2 | Core |
| `orders` | OrdersUI2 | Core |
| `blotter` | BlotterUI2 | Core |
| `alerts` | AlertsUI2 | Core |
| `search` | SearchUI2 | Core |
| `backtest` | BacktestUI2 | Strategy |
| `backtest-v4` | BacktestV4UI2 | Strategy |
| `walk-forward` / `v2/v3` | WalkForwardUI2 | Strategy |
| `monte-carlo` / `v2` | MonteCarloUI2 | Strategy |
| `strategy-optimizer` | StrategyOptimizerUI2 | Strategy |
| `strategy-builder-v2` | StrategyBuilderV2UI2 | Strategy |
| `strategy-studio-v3` | StrategyStudioV3UI2 | Strategy |
| `autopilot` | AutopilotUI2 | AI/Automation |
| `autopilot-v2` | AutopilotV2UI2 | AI/Automation |
| `automation` / `v2` | AutomationUI2 | AI/Automation |
| `agents` / `builder` / `registry` | AgentUI2 | AI/Automation |
| `options-matrix` | OptionsMatrixUI2 | Derivatives |
| `vol-surface` | VolSurfaceUI2 | Derivatives |
| `vol-scanner` | VolScannerUI2 | Derivatives |
| `greeks-service` | GreeksServiceUI2 | Derivatives |
| `payoff-lab` | PayoffLabUI2 | Derivatives |
| `risk` | RiskUI2 | Risk |
| `risk-governance` | RiskGovernanceUI2 | Risk |
| `stress-scenarios` | StressScenariosUI2 | Risk |
| `compliance` | ComplianceUI2 | Risk/Compliance |
| `observability` / `v2` | ObservabilityUI2 | Platform Ops |
| `health` / `health-v4` | PlatformHealthUI2 | Platform Ops |
| `research` | ResearchUI2 | Intelligence |
| `sentiment` / `v2` | SentimentUI2 | Intelligence |
| `regime` | RegimeUI2 | Intelligence |
| `factor-model` | FactorModelUI2 | Intelligence |
| `settings` | SettingsUI2 | Admin |
| `export` / `export-bundle` | ExportUI2 | Admin |
| `husk/dashboard` / `trading` / `portfolio` | Husk* | Skeleton previews |
| *(100+ more)* | — | — |

---

## Source Modules Deep Map

### `src/api/` — REST API Clients
```
client.ts              ← Base HTTP fetch wrapper
crossAssetApi.ts       ← Cross-asset quotes + correlations
factorModelApi.ts      ← Factor exposure / attribution
macroApi.ts            ← Macro economic data
sectorApi.ts           ← Sector rotation data
sentimentApi.ts        ← NLP sentiment scores
stressTestApi.ts       ← Stress scenario runner
```

### `src/core/` — Chart Engine Core
```
ChartEngine.ts         ← Wraps lightweight-charts, manages series/scale
Scales.ts              ← Price/time scale computation utilities
types.ts               ← Shared chart type definitions
```

### `src/data/` — Live Data Layer
```
ApiClient.ts           ← Typed REST client with error handling
ClockClient.ts         ← Virtual/real clock (supports E2E frozen time)
WebSocketClient.ts     ← WS client with configurable reconnect logic
```

### `src/hooks/` — Shared React Hooks
```
useChartData.ts        ← Fetches + subscribes to OHLCV data
useEventBus.ts         ← Pub/sub event bus
useKeyboard.ts         ← Global keyboard shortcut registry
useLocalStorage.ts     ← Typed localStorage state
useResizeObserver.ts   ← Element resize detection
useVirtualList.ts      ← Virtualized list rendering
useWebSocket.ts        ← WebSocket connection lifecycle
```

### `src/state/` — Global Zustand Stores
```
store.ts               ← Root combined store
appStore.ts            ← Active view, mode (live/paper/backtest/replay)
marketStore.ts         ← Live quotes, streaming tick data
portfolioStore.ts      ← Positions, valuations, P&L
workspaceStore.ts      ← Panel layout, splits, saved configurations
```

### `src/components/` — Shared Components

#### `components/charts/`
```
CorrelationMatrix.tsx      ← Asset correlation heatmap
EfficientFrontierChart.tsx ← Markowitz efficient frontier plot
FactorExposureRadar.tsx    ← Radar chart: factor exposures
SeasonalityHeatmap.tsx     ← Calendar heatmap: seasonality
SuperGraph.tsx             ← Multi-series supergraph (flagship)
VaRHistogram.tsx           ← Value-at-Risk distribution histogram
VolatilitySurface.tsx      ← 3D IV surface visualization
YieldCurveChart.tsx        ← Government/corporate yield curves
```

#### `components/shared/`
```
EmptyState.tsx         ← Placeholder for no-data states
SeverityBanner.tsx     ← Alert severity banner
Skeleton.tsx           ← Content loading skeleton
```

```
ErrorBanner.tsx        ← Error notification banner
ErrorBoundary.tsx      ← React error boundary
ProvenanceDisplay.tsx  ← Data provenance/citation display
ux-polish.tsx          ← UX polish utilities and micro-interactions
```

---

### `src/ui/` — UI1 Primitive Library (Legacy)

**Primitives:** Avatar, Badge, Banner, Button, Card, ChartFrame, DataTable, Drawer, Dropdown, EmptyState, ErrorState, IconButton, Input, KPIStrip, LiveDataIndicator, Modal, ModeBadge, PageHeader, Panel, ProgressBar, SegmentedControl, Skeleton, StatCard, StatusIndicator, Table, Tabs, Toast, TopBar

**Bloomberg sub-library (`ui/bloomberg/`):**
BloombergChart, BloombergForm, BloombergGauge, BloombergGrid, BloombergHeatmap, BloombergModal, BloombergNotification, BloombergPanel, BloombergTable, BloombergToolbar

---

### `src/ui2/` — UI2 Primary Shell

```
AppShellUI2.tsx        ← Top-level shell wrapping all UI2 routes
routes.tsx             ← 150+ named route definitions
```

#### `ui2/components/` — UI2 Primitive Library
```
ActionButton           ← Primary CTA with state variants
BentoGrid              ← Bento grid layout container
BottomDock             ← Bottom panel dock bar
Button                 ← Base button with size/variant
ChartFrame             ← Chart container with header strip
ClayButton             ← Claymorphism-style button variant
CommandPalette         ← Bloomberg-style command bar (cmdk)
DataTable              ← Virtualized sortable/filterable data table
DataTableUI2           ← Enhanced data table with frozen columns
EmptyState             ← Empty data state placeholder
ErrorBoundary          ← Component-level error boundary
ErrorCard              ← Inline error state card
GlassCard              ← Glassmorphism panel card
InsightsPanel          ← AI insights side panel
KPIStrip               ← Key metric strip (top of pages)
MarketTape             ← Scrolling live market ticker tape
MonitorGrid            ← Grid layout for monitoring dashboards
NumericDisplay         ← Formatted number (price, %, PnL)
OrderTicket            ← Order entry ticket form
PageHeader             ← Standard page header with breadcrumbs
PageShellUI2           ← Page-level layout wrapper
Panel                  ← Resizable content panel
Pill                   ← Status/mode pill badge
ProgressBar            ← Linear progress indicator
RightSidebar           ← Collapsible right sidebar
Skeleton               ← Loading skeleton
StatusBadge            ← Status indicator badge
Tabs                   ← Tabbed content container
```

#### `ui2/design/tokens.ts` — Design Token System
```typescript
typography: {
  fontFamily: { heading: 'Inter', mono: 'JetBrains Mono' },
  scale: { xxs: 10, xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 18, '2xl': 24, '3xl': 28 }
}
spacing: { base: 4, ... }  // 4px grid
colors: {
  bg: '#0C0E12',
  panel: '#131722',
  element: '#1E222D',
  border: '#2A2E39',
  brand: '#2962FF',
  up: '#089981', down: '#F23645',
  text: '#D1D4DC', textSecondary: '#787B86'
}
zIndex: { base:0, content:10, dock:20, header:30, dropdown:40, overlay:50, modal:60, toast:70, tooltip:80 }
```

#### `ui2/stores/` — UI2 Zustand Stores (30+)
```
tradingStore.ts              ← Live positions, orders, P&L streaming
autopilotStore.ts / v2 / V2  ← Autopilot trading system state
automationStore.ts / v2      ← Automation workflow execution state
agentStore.ts                ← AI agent orchestration state
searchStore.ts / Depth       ← Symbol search + depth results
backtestDepthStore.ts        ← Backtest run state
backtestEngineStore.ts       ← Backtest engine config + results
workflowDepthStore.ts        ← Workflow execution depth
scenarioStore.ts             ← Risk scenario definitions
platformHealthStore.ts       ← System health metrics
exportStore.ts               ← Export bundle build state
insightsStore.ts             ← AI signal + insight state
orderTicketStore.ts          ← Order entry form state
llmProviderStore.ts          ← Active LLM provider selection
telemetryStore.ts            ← Real-time telemetry data
workspaceStore.ts            ← Layout + panel configuration
commandRegistry.ts           ← Command palette registered commands
contextBusStore.ts           ← Cross-component context bus
deepLinks.ts                 ← Deep link routing helpers
streamSimulator.ts           ← Simulated live data (dev/demo)
datasetSnapshotStore.ts      ← Dataset snapshot management
wave*Stores.ts               ← Feature-wave-grouped stores (waves 11-50)
```

#### `ui2/pages/` — 150+ Pages (Grouped)

| Group | Pages |
|-------|-------|
| **Core Trading** | TradingUI2, DashboardUI2, PortfolioUI2, OrdersUI2, BlotterUI2, AlertsUI2, SearchUI2 |
| **Backtesting** | BacktestUI2, BacktestV4, WalkForwardUI2(x3), MonteCarloUI2(x2), StrategyOptimizer, StrategyBuilder, StrategyStudio, StrategySimUI2 |
| **AI/Agents** | AutopilotUI2(x4), AutomationUI2(x2), AgentUI2, AgentBuilder, AgentRegistry, AgentTools, AgentEvalHarness, AIStrategyUI2, AIProviderStatus |
| **Options/Derivatives** | OptionsMatrix, VolSurface, VolScanner, GreeksService, PayoffLab, SpreadTools, DerivativesOMS, CrossMargin, FuturesCurve, RatesMonitor, HedgeEngine, RiskAdjExec |
| **Risk/Compliance** | RiskUI2, RiskGovernance, RiskNetwork, PreTradeRisk, StressScenarios, ScenarioSim, ComplianceUI2, Surveillance, KriScoring, ThirdPartyRisk, IncidentCompliance, Supervisory, ControlFramework, ControlTower, PolicyAttestation, PolicyCode, PolicySignal |
| **Platform Ops** | OpsUI2, ObservabilityUI2(x2), TelemetryUI2, PlatformHealthUI2(x2), SystemHealth, MonitorUI2, IncidentsUI2, RunsUI2, WorkflowBuilder, WorkflowsV3, NLWorkflow, DlqOps, EsOps, Elasticsearch |
| **Research/Intelligence** | ResearchUI2, SentimentUI2(x2), RegimeUI2, ScoringUI2, Anomalies, AltData, SignalMarket, Microstructure, Liquidity, NewsEnrichment, ThemeClustering, ResearchNotebook, FactorModel, Attribution, CrossAssetQuote |
| **Portfolio/Performance** | PortfolioOptimizer, PortfolioV2, PerformanceUI2(x2), PnlExplain, Reconciliation |
| **Settings/Admin** | SettingsUI2, ExportUI2, ExportBundle, Collaboration, Entitlements, Jurisdiction |
| **Platform Infra** | MultiRegion, RegionalFailover, DataResidency, CapacityPlan, LatencyBudget, CostProfiler, ReliabilityEcon, GlobalReadiness, ReleaseQuality, TenantQuota, UsageMetering, BillingEvents, SupportSla |

---

### `src/features/` — Feature Modules (UI1 + Shared Logic)

#### Core Trading Features
```
chart/
  AdvancedChartEngine.tsx    ← Canvas chart orchestrator
  ChartCanvas.tsx            ← Raw canvas rendering
  ChartControls.tsx          ← Toolbar: timeframe, type, compare
  ChartHeaderStrip.tsx       ← Symbol + price header bar
  DrawingToolbar.tsx         ← Drawing tool selection sidebar
  IndicatorPicker.tsx        ← Indicator search + add dialog
  IndicatorRegistry.ts       ← All available indicators catalog
  IndicatorsModal.tsx        ← Indicator settings modal
  ReplayControls.tsx         ← Market replay playback controls
  SupergraphChart.tsx        ← Multi-series supergraph wrapper
  SymbolSearchModal.tsx      ← Symbol/ticker search modal
  hooks/useChartIndicators.ts← Indicator state management hook

drawings/
  DrawingLayer.tsx           ← Canvas drawing overlay (Fibonacci, trends, etc.)
  Toolbar.tsx                ← Drawing tool sidebar

indicators/
  IndicatorDock.tsx          ← Indicator status dock
  IndicatorManager.tsx       ← Add/remove/configure indicators
  IndicatorRegistry.ts       ← Registry of all indicators
  calculators.ts             ← Indicator calculation dispatch
  calculators/
    momentum.ts              ← RSI, MACD, Stochastic, CCI
    trend.ts                 ← ADX, Aroon, Supertrend, Ichimoku
    volatility.ts            ← Bollinger, ATR, Keltner
    volume.ts                ← OBV, MFI, VWAP, volume profile
    profile.ts               ← Market Profile (TPO)
```

#### Order Management
```
orders/
  OrdersBlotter.tsx          ← Active orders table with cancel/amend
trading/
  TradingBanner.tsx          ← Trading mode status banner
  tiles/                     ← 14 modular trading tiles:
    AlertTile, CalendarTile, ChartTile, GreeksTile, HeatmapTile,
    NewsTile, OptionChainTile, OrdersTile, PerformanceTile,
    PositionsTile, ScannerTile, TimeAndSalesTile,
    UncertaintyConeTile, VolSurfaceTile, WatchlistTile
```

#### Options Suite
```
options/
  OptionsChain.tsx           ← Full options chain table
  OptionsDashboard.tsx       ← Options overview dashboard
  IVSkewChart.tsx            ← IV skew by expiry
  IVTermStructure.tsx        ← IV term structure curve
  QuickActions.tsx           ← One-click strategy actions
  StrategyBuilder.tsx        ← Multi-leg strategy constructor
  components/
    GreeksPanel.tsx          ← Position Greeks summary
    IVAnalyticsPanel.tsx     ← IV analytics charts
    PayoffChart.tsx          ← P&L payoff diagram
    PutCallRatioPanel.tsx    ← Put/call ratio chart
  backtest/AnalyzeTab.tsx    ← Options strategy backtest
  riskDesk/
    RiskDeskPanel.tsx        ← Options risk desk
    PremiumRiskCharts.tsx    ← Premium risk visualizations
    ValidationResults.tsx   ← Strategy validation output
  strategyLab/
    StrategyLabPanel.tsx     ← Strategy lab environment
    StrategyDiffPanel.tsx    ← Strategy diff/compare
    StrategyArtifactsPanel.tsx← Strategy artifact browser
```

#### Portfolio & Risk
```
portfolio/
  EnhancedPortfolioView.tsx  ← Full portfolio with analytics
  MultiPortfolioSelector.tsx ← Multi-portfolio switcher
  PortfolioCrudPanel.tsx     ← Create/edit/delete portfolios
  PortfolioPanel.tsx         ← Main portfolio panel
  PositionModal.tsx          ← Position detail + edit modal

attribution/AttributionPanel.tsx     ← Brinson P&L attribution
correlation/CorrelationPanel.tsx     ← Asset correlation matrix
cross-asset/CrossAssetPanel.tsx      ← Cross-asset analysis
factor-model/FactorModelPanel.tsx    ← Factor exposure analysis
risk-scenarios/RiskScenariosPanel.tsx← Risk scenario runner
stress-test/StressTestPanel.tsx      ← Stress testing
```

#### Intelligence & Research
```
fundamentals/FundamentalsPanel.tsx   ← Company fundamentals (EPS, P/E, etc.)
sentiment/SocialSentimentPanel.tsx   ← Social + news sentiment
macro/MacroDashboard.tsx             ← Macro economic indicators
sector-rotation/SectorRotationPanel.tsx← Sector performance heatmap
earnings/EarningsCalendar.tsx        ← Earnings calendar
```

#### AI & Automation
```
autopilot/
  components/ (10 files)     ← Dashboard, cockpit, agents, proposals,
                                positions, settings, think-log
  api.ts / ops-api.ts        ← Autopilot REST endpoints
  store.ts / types.ts

agents/AgentsPanel.tsx       ← AI agent management
ide/StrategyIDE.tsx          ← In-browser strategy code editor
```

#### Platform / Shell
```
layout/shell/
  Shell.tsx                  ← UI1 main application shell
  TopBar.tsx / TopAppBarEnhanced.tsx
  LeftNav.tsx / LeftNavEnhanced.tsx
  CommandPalette.tsx         ← cmdk-based Bloomberg command bar
  TrustUX.tsx                ← Trust/safety indicators

layout/views/ (20+ files)    ← Routable view wrappers for all features
```

#### Support Features
```
alerts/AlertFeed.tsx + AlertsPanel.tsx
watchlist/WatchlistPanel.tsx
search/SearchPanel.tsx
reports/ReportBuilder.tsx
trades/TradesLedger.tsx
journal/JournalPanel.tsx
notes/NotesPanel.tsx
notifications/NotificationsPanel.tsx
tts/VoiceControl.tsx + AudioQueue.ts    ← Text-to-speech / voice alerts
audit/AuditLogPanel.tsx + AuditTrail.tsx
observability/PerformanceDashboard.tsx
replay/ReplayControlBar.tsx
backtest/BacktestPanel.tsx + BacktestLauncher.tsx
```

---

### `src/lib/` — Pure Domain Logic (No React)

#### `lib/indicators/`
```
movingAverages.ts   ← SMA, EMA, WMA, VWAP
momentum.ts         ← RSI, MACD, Stochastic, CCI, Williams %R
trend.ts            ← ADX, Aroon, Parabolic SAR, Supertrend
volatility.ts       ← Bollinger Bands, ATR, Keltner Channels
volume.ts           ← OBV, MFI, VWAP, Volume Profile
patterns.ts         ← Candlestick pattern recognition (40+ patterns)
```

#### `lib/options/`
```
blackScholes.ts     ← BSM pricing + Greeks (analytical)
binomial.ts         ← Binomial tree American options
monteCarlo.ts       ← Monte Carlo simulation pricing
greeks.ts           ← Delta, Gamma, Theta, Vega, Rho
volatilitySurface.ts← IV surface construction + interpolation
strategies.ts       ← Multi-leg strategy definitions
```

#### `lib/portfolio/`
```
performance.ts      ← Sharpe, Sortino, Calmar, alpha, beta, CAGR
attribution.ts      ← Brinson attribution model
optimization.ts     ← Mean-variance optimization (Markowitz)
risk.ts             ← Portfolio VaR, CVaR, drawdown
fixedIncome.ts      ← Bond pricing, duration, convexity
```

#### `lib/risk/`
```
marketRisk.ts       ← VaR (Historical/Parametric/Monte Carlo), CVaR
creditRisk.ts       ← Credit exposure, PD/LGD
operationalRisk.ts  ← Operational risk metrics
stressTesting.ts    ← Historical + hypothetical stress scenarios
regulatory.ts       ← Regulatory capital / margin calculations
limits.ts           ← Risk limit framework
```

#### `lib/backtest/`
```
engine.ts           ← Core backtest simulation engine (event-driven)
analytics.ts        ← Metrics: Sharpe, drawdown, win rate
optimization.ts     ← Grid search + random search parameter optimization
strategies.ts       ← Strategy interface + built-in templates
reporter.ts         ← HTML/JSON report generation
```

#### `lib/orders/`
```
execution.ts        ← Order execution logic (market, limit, stop)
orderBook.ts        ← Order book state management
smartRouter.ts      ← Smart order routing (venue selection)
riskChecks.ts       ← Pre-trade risk checks (position limits, notional)
tca.ts              ← Transaction cost analysis
```

#### `lib/marketData/`
```
feed.ts             ← Real-time feed abstractions (WS + REST)
historical.ts       ← Historical OHLCV data fetching
aggregator.ts       ← Multi-feed data aggregation
scanner.ts          ← Market scanner engine
screening.ts        ← Fundamental + technical screening criteria
economics.ts        ← Economic indicator data (CPI, GDP, NFP)
```

#### `lib/ml/`
```
linearModels.ts     ← Linear/logistic regression
trees.ts            ← Decision tree / random forest
preprocessing.ts    ← Feature engineering + normalization
```

#### `lib/assetClasses/`
```
commodities/types.ts
crypto/types.ts
forex/types.ts
forex/analytics.ts  ← Pip value, carry calculations
forex/strategies.ts ← FX strategy definitions
```

#### `lib/drawing/`
```
core.ts             ← Drawing tool base classes + hit-testing
renderers/
  annotations.ts    ← Text labels
  fibonacci.ts      ← Fibonacci retracement/extension
  gann.ts           ← Gann fan/grid
  lines.ts          ← Trend/horizontal/vertical lines
  measurements.ts   ← Price + time measurement
  patterns.ts       ← Chart pattern overlays (H&S, triangles)
  shapes.ts         ← Rectangle, circle, arrow
```

---

## Design System Tokens (Current)

### Colors (`tailwind.config.js`)
```
Background:   #0C0E12  (deepest bg)
Panel:        #131722  (panel bg / terminal bg)
Element:      #1E222D  (card/element bg)
Surface:      #181C27
Border:       #2A2E39
Border focus: #2962FF  (brand blue)
Brand:        #2962FF  (primary action blue)
Up/Bullish:   #089981  (TradingView green)
Down/Bearish: #F23645  (TradingView red)
Text:         #D1D4DC
Text sec:     #787B86
Text muted:   #5D606B
Warn:         #F7931A
Mode-Replay:  #9333EA
Mode-Backtest:#06B6D4
Mode-Paper:   #F59E0B
Mode-Live:    #089981
```

### Typography
```
Sans:   Inter (primary UI text)
Mono:   JetBrains Mono (prices, code, terminal output)
Scale:  xxs=10px, xs=11, sm=12, base=13, md=14, lg=16, xl=18, 2xl=24, 3xl=28
```

### Z-Index Layers
```
base=0, content=10, dock=20, header=30,
dropdown=40, overlay=50, modal=60, toast=70, tooltip=80
```

---

## Statistics

| Metric | Count |
|--------|-------|
| Total source files | ~330 |
| UI2 pages | ~150 |
| UI2 Zustand stores | ~30 |
| Feature modules | ~45 |
| Lib domain modules | 9 |
| UI primitive components (UI1 + UI2) | ~55 |
| Bloomberg-specific components | 10 |
| Shared hooks | 7 |
| Drawing renderers | 7 |
| Trading tile types | 14 |
| E2E config files | 4 |
| Route groups | 13 |
