# Target Architecture: Unified Market Workstation

> Generated: 2026-01-12
> Version: 1.0.0

## Overview

A production-grade market workstation combining TradingView-style charting with Bloomberg-style analytics. Two explicit workspaces: **Chart** and **Dashboard**.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UNIFIED MARKET WORKSTATION                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                            TOP BAR                                   │   │
│  │  [Mode: LIVE] [AAPL ▼] [1m ▼] [Health: ●●●] [Clock: 09:31:42]       │   │
│  │  [Workspace: Chart | Dashboard]                              [⌘K]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────┬───────────────────────────────────────────────┬──────────┐   │
│  │          │                                               │          │   │
│  │  LEFT    │                                               │  RIGHT   │   │
│  │  NAV     │              MAIN CONTENT                     │  DOCK    │   │
│  │          │                                               │          │   │
│  │ Monitor  │  ┌─────────────────────────────────────────┐  │ Ind.     │   │
│  │ Charts   │  │                                         │  │ Draw.    │   │
│  │ Replay   │  │         CHART WORKSPACE                 │  │ Data     │   │
│  │ Strategy │  │         or                              │  │ Alerts   │   │
│  │ Alerts   │  │         DASHBOARD WORKSPACE             │  │          │   │
│  │ Portfolio│  │                                         │  │          │   │
│  │ Reports  │  │                                         │  │          │   │
│  │ Auto.    │  └─────────────────────────────────────────┘  │          │   │
│  │ Settings │                                               │          │   │
│  │          │                                               │          │   │
│  └──────────┴───────────────────────────────────────────────┴──────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          BOTTOM DOCK                                 │   │
│  │  [Orders] [Trades] [Logs] [Strategy Tester] [Events]                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Workspace Modes

### Mode 1: Chart Workspace (TradingView-like)

```
┌────────────────────────────────────────────────────────────┐
│                     CHART AREA (dominant)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │                   Candlestick Chart                  │  │
│  │                   + Volume                           │  │
│  │                   + Indicators (overlays)            │  │
│  │                   + Drawings                         │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SEPARATE PANES: RSI | MACD | ATR | Volume Profile   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

Features:
- Full-screen chart with resizable panes
- Indicator library (30+ indicators)
- Drawing tools with layer manager
- Multi-timeframe support
- Real-time streaming

### Mode 2: Dashboard Workspace (Bloomberg-like)

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │  Regime Card  │  │  Whale Flow   │  │  Trust Score  │        │
│  │  (Trend/Chop) │  │  Alerts       │  │  Readiness    │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│  ┌───────────────────────────────────┐  ┌───────────────┐        │
│  │                                   │  │  GEX Profile  │        │
│  │         Mini Chart                │  │               │        │
│  │                                   │  └───────────────┘        │
│  └───────────────────────────────────┘  ┌───────────────┐        │
│  ┌───────────────┐  ┌───────────────┐  │  Uncertainty  │        │
│  │  Options      │  │  Greeks       │  │  Cone         │        │
│  │  Chain        │  │  Panel        │  │               │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│  ┌───────────────────────────────────────────────────────┐       │
│  │              Trade Journal / Notes                     │       │
│  └───────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

Features:
- Draggable/resizable tiles
- Plugin-based tile system
- Real data adapters with error states
- Workspace persistence

---

## Component Architecture

### Frontend Structure

```
frontend/src/
├── App.tsx                     # Main app with shell
├── main.tsx                    # Entry point
├── index.css                   # Global styles
│
├── core/                       # Core utilities
│   ├── types.ts               # Type definitions
│   ├── ChartEngine.ts         # Custom chart engine (fallback)
│   └── Scales.ts              # Price/time scale utilities
│
├── state/                      # State management
│   ├── store.ts               # Main Zustand store
│   ├── appStore.ts            # App-level state
│   ├── workspaceStore.ts      # Workspace state (NEW)
│   └── aiStore.ts             # AI copilot state (NEW)
│
├── ui/                         # Design system
│   ├── Button.tsx
│   ├── Badge.tsx
│   ├── Modal.tsx
│   ├── Panel.tsx
│   ├── Table.tsx              # Virtualized tables
│   ├── Toast.tsx
│   └── index.ts
│
├── features/                   # Feature modules
│   ├── shell/                 # App shell (NEW)
│   │   ├── Shell.tsx
│   │   ├── TopBar.tsx
│   │   ├── LeftNav.tsx
│   │   ├── RightDock.tsx
│   │   ├── BottomDock.tsx
│   │   └── WorkspaceSwitcher.tsx
│   │
│   ├── chart/                 # Chart workspace
│   │   ├── ChartCanvas.tsx
│   │   ├── ChartControls.tsx
│   │   ├── ReplayControls.tsx
│   │   └── PaneManager.tsx
│   │
│   ├── indicators/            # Indicator system (EXPAND)
│   │   ├── IndicatorPanel.tsx
│   │   ├── IndicatorRegistry.ts
│   │   ├── calculators/
│   │   │   ├── trend.ts       # Ichimoku, Supertrend, SAR, ADX
│   │   │   ├── momentum.ts    # Stoch, StochRSI, CCI, ROC, WilliamsR
│   │   │   ├── volatility.ts  # Keltner, Donchian, BBWidth, HV
│   │   │   ├── volume.ts      # OBV, MFI, CMF, ADL, VWMA
│   │   │   └── profile.ts     # VRVP, AnchoredVWAP
│   │   └── renderers/
│   │       ├── LineRenderer.ts
│   │       ├── HistogramRenderer.ts
│   │       └── ProfileRenderer.ts
│   │
│   ├── drawings/              # Drawing tools (EXPAND)
│   │   ├── DrawingLayer.tsx
│   │   ├── Toolbar.tsx
│   │   ├── DrawingManager.tsx
│   │   └── tools/
│   │       ├── channels.ts
│   │       ├── pitchforks.ts
│   │       ├── measurement.ts
│   │       └── annotations.ts
│   │
│   ├── dashboard/             # Dashboard workspace (NEW)
│   │   ├── DashboardWorkspace.tsx
│   │   ├── TileGrid.tsx
│   │   ├── TileRegistry.ts
│   │   └── tiles/
│   │       ├── WhaleFlowTile.tsx
│   │       ├── RegimeTile.tsx
│   │       ├── GEXTile.tsx
│   │       ├── UncertaintyTile.tsx
│   │       ├── TrustScoreTile.tsx
│   │       ├── OptionsChainTile.tsx
│   │       ├── GreeksTile.tsx
│   │       ├── JournalTile.tsx
│   │       └── MiniChartTile.tsx
│   │
│   ├── options/               # Options analytics (NEW)
│   │   ├── OptionsChain.tsx
│   │   ├── PayoffVisualizer.tsx
│   │   ├── GreeksPanel.tsx
│   │   └── IVSurface.tsx
│   │
│   ├── backtest/              # Strategy tester
│   │   ├── BacktestLauncher.tsx
│   │   ├── ResultsPanel.tsx
│   │   ├── EquityCurve.tsx
│   │   ├── TradeList.tsx
│   │   └── MetricsSummary.tsx
│   │
│   ├── automation/            # Strategy factory (NEW)
│   │   ├── AutomationCenter.tsx
│   │   ├── JobQueue.tsx
│   │   ├── ReadinessScore.tsx
│   │   └── RunbookManager.tsx
│   │
│   ├── ai/                    # AI copilot (NEW)
│   │   ├── AICopilot.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── ProposalReview.tsx
│   │   └── ResearchPanel.tsx
│   │
│   ├── incidents/             # Incident replay
│   │   ├── IncidentList.tsx
│   │   ├── IncidentPlayer.tsx
│   │   └── TimelineView.tsx
│   │
│   ├── portfolio/             # Portfolio view
│   │   ├── PortfolioSummary.tsx
│   │   └── PositionTable.tsx
│   │
│   └── reports/               # Reports
│       ├── ReportBuilder.tsx
│       └── DailyReport.tsx
│
├── data/                       # Data layer
│   ├── WebSocketClient.ts
│   ├── ClockClient.ts
│   ├── APIClient.ts
│   └── adapters/
│       ├── MarketDataAdapter.ts
│       ├── OptionsAdapter.ts
│       └── WhaleAlertAdapter.ts
│
└── tests/                      # Test suites
    ├── unit/
    ├── integration/
    └── e2e/
```

### Backend Structure

```
phase1/services/
├── api/                        # FastAPI application
│   ├── main.py                # App factory
│   ├── websocket.py           # WS handlers
│   └── routes/
│       ├── bars.py
│       ├── clock.py
│       ├── drawings.py
│       ├── strategies.py
│       ├── portfolio.py
│       ├── alerts.py
│       ├── incidents.py
│       ├── reports.py
│       ├── options.py         # NEW
│       ├── ai.py              # NEW
│       └── automation.py      # NEW
│
├── ingestion/                  # Data ingestion
│   ├── main.py
│   ├── normalizer.py
│   └── connectors/
│       ├── finnhub_connector.py
│       ├── alpaca_connector.py
│       ├── yfinance_connector.py
│       └── mock.py            # Test only
│
├── bar_engine/                 # Bar aggregation
│   └── engine.py
│
├── strategy/                   # Strategy execution
│   ├── engine.py
│   ├── base_strategy.py
│   └── sandbox.py
│
├── backtest/                   # Backtesting
│   ├── backtester.py
│   └── fill_simulator.py
│
├── execution/                  # Order execution
│   ├── order_types.py
│   └── alpaca_adapter.py
│
├── portfolio/                  # Portfolio management
│   ├── manager.py
│   └── risk_manager.py
│
├── incidents/                  # Incident capture
│   ├── capture.py
│   └── replay.py
│
├── options/                    # Options analytics (NEW)
│   ├── chain.py
│   ├── greeks.py
│   ├── iv_surface.py
│   └── pricing.py
│
├── ai/                         # AI integration (NEW)
│   ├── router.py
│   ├── copilot.py
│   ├── analyzer.py
│   └── proposals.py
│
├── automation/                 # Strategy factory (NEW)
│   ├── pipeline.py
│   ├── jobs.py
│   ├── readiness.py
│   └── scheduler.py
│
└── persistence/                # Database
    ├── database.py
    └── models.py
```

---

## Data Flow

### Live Mode

```
[Finnhub/Alpaca] → [Connector] → [Normalizer] → [Bar Engine]
                                                      │
                                                      ▼
                                              [Persistence]
                                                      │
                                                      ▼
                                              [WebSocket Broadcast]
                                                      │
                                                      ▼
                                              [Frontend Store]
                                                      │
                                                      ▼
                                              [Chart/Dashboard]
```

### Replay Mode

```
[Incident Bundle] → [Replay Engine] → [Strategy Engine]
                                             │
                                             ▼
                                      [Virtual Clock]
                                             │
                                             ▼
                                      [Frontend (replay indicators)]
```

---

## Mode & Trust System

### Modes (Always Visible)

| Mode | Color | Description |
|------|-------|-------------|
| LIVE | Green | Real-time data, paper/live trading |
| REPLAY | Yellow | Deterministic replay from recordings |
| BACKTEST | Blue | Historical simulation |
| PAPER | Orange | Paper trading (no real orders) |

### Trust Indicators

1. **Provider Health**: 3 dots showing connector status
2. **Last Tick Time**: Staleness detection (>5s = warning)
3. **Parity Status**: Hash verification (verified/mismatch)
4. **Risk State**: Portfolio risk limits (normal/warning/critical)

---

## Plugin Tile System

### Tile Interface

```typescript
interface TileDefinition {
  id: string;
  name: string;
  category: 'analytics' | 'trading' | 'risk' | 'ai' | 'journal';
  component: React.ComponentType<TileProps>;
  
  // Data requirements
  dataRequirements: {
    endpoint: string;
    refreshRate: number; // ms
    params?: Record<string, unknown>;
  };
  
  // Layout
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  
  // Performance
  renderBudgetMs: number;
  
  // States
  emptyState: React.ReactNode;
  errorState: (error: Error) => React.ReactNode;
  loadingState: React.ReactNode;
}
```

### Tile Categories

1. **Analytics**: GEX, Uncertainty, IVSurface, Regime
2. **Trading**: Orders, Positions, Trade Journal
3. **Risk**: Trust Score, Readiness, Portfolio Heatmap
4. **AI**: Copilot, Proposals, Research
5. **Journal**: Notes, Trade Annotations

---

## Indicator Registry

### Registry Schema

```typescript
interface IndicatorDefinition {
  id: string;
  name: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'profile';
  
  // Params
  params: ParamDefinition[];
  defaults: Record<string, number>;
  
  // Rendering
  paneType: 'overlay' | 'separate';
  renderType: 'line' | 'histogram' | 'area' | 'cloud' | 'profile';
  outputs: OutputDefinition[];
  
  // Calculation
  calculate: (candles: Candle[], params: Record<string, number>) => IndicatorOutput;
}
```

### Indicator List (30+ Target)

**Trend (6):**
- Ichimoku Cloud
- Supertrend
- Parabolic SAR
- ADX/DMI
- Aroon
- Moving Average Ribbon

**Momentum (7):**
- Stochastic
- Stochastic RSI
- CCI
- ROC
- Williams %R
- TRIX
- Momentum

**Volatility (5):**
- Keltner Channel
- Donchian Channel
- BB Width
- Historical Volatility
- ATR Bands

**Volume (6):**
- OBV
- MFI
- CMF
- ADL
- VWMA
- Volume Profile

**Profile (4):**
- VRVP (Volume by Price)
- POC/VAH/VAL
- Anchored VWAP
- VWAP Bands

**Existing (7):**
- SMA
- EMA
- VWAP
- RSI
- MACD
- Bollinger Bands
- ATR

---

## AI Integration Architecture

### Model Router

```
[User Query] → [Intent Classifier]
                      │
            ┌─────────┼─────────┐
            ▼         ▼         ▼
      [Quick/UI]  [Analysis] [Reports]
      (Small LLM) (Med LLM)  (Large LLM)
```

### AI Use Cases

1. **Strategy Copilot**
   - Input: Natural language strategy description
   - Output: Proposal with code diff
   - Action: Review → Apply (safe changes only)

2. **Research Summarizer**
   - Input: Topic/symbol
   - Output: Grounded summary with sources
   - Storage: Source metadata preserved

3. **Backtest Analyst**
   - Input: Backtest results
   - Output: Overfitting analysis, regime breakdown
   - Suggestions: Robustness improvements

4. **Incident Explainer**
   - Input: Incident bundle
   - Output: Timeline + likely causes
   - Links: System facts, logs, signals

### AI Safety Rules

- Execution logic remains deterministic (non-LLM)
- Never auto-trade; proposal-based only
- All outputs include confidence + reasoning
- Rate limits: tokens/user/day
- Model outputs logged for audit

---

## Testing Strategy

### Unit Tests
- Indicator calculations (exact values)
- Drawing geometry
- Tile adapters
- AI proposal formatting

### Integration Tests
- WS → Store → Chart
- Strategy → Chart markers
- Options chain → Payoff → Greeks

### E2E Tests (Playwright)
- Live chart loads
- Symbol/timeframe switch
- Add indicators
- Create drawings
- Dashboard tiles
- Backtest flow
- Paper trading
- AI proposal flow

### Verification Loops

```
Loop A: Bug Fixes
  └─→ Fix failing tests
  └─→ Remove mock paths

Loop B: Playwright Snapshots
  └─→ npm run ag:run -- --headed
  └─→ Capture artifacts
  └─→ Auto-analyze failures

Loop C: Full E2E
  └─→ Unit → Integration → E2E
  └─→ Provider connectivity
  └─→ Repeat until 100% pass
```

---

## Performance Budgets

| Component | Budget | Metric |
|-----------|--------|--------|
| Initial Load | <2s | LCP |
| Chart Render | <16ms | Frame time |
| Tile Render | <50ms | Per tile |
| WS Message | <10ms | Processing |
| Indicator Calc | <100ms | Full series |
| Table (1000 rows) | <100ms | Virtual scroll |

---

## Security Considerations

1. **API Keys**: Never in frontend; env vars only
2. **CORS**: Configured for production domains
3. **WebSocket**: Auth token validation
4. **AI**: Prompt injection prevention
5. **Trading**: Paper mode by default; live disabled

---

## Deployment

### Development
```bash
# Backend
cd phase1 && uvicorn services.api.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

### Production
```bash
# Build
cd frontend && npm run build

# Serve (static + API)
docker-compose up
```

---

## Migration Checklist

- [ ] Create unified shell components
- [ ] Implement workspace switcher
- [ ] Create indicator registry
- [ ] Expand indicator library (30+)
- [ ] Create drawing manager
- [ ] Implement tile plugin system
- [ ] Migrate supergraph widgets
- [ ] Add options analytics
- [ ] Add AI routes
- [ ] Add automation center
- [ ] Remove mock data paths
- [ ] Run verification loops
- [ ] Update documentation
