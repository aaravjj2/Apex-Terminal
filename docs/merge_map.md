# Merge Map: Unified Market Workstation

> Generated: 2026-01-12
> Status: Active Development

## Repository Overview

The merged repository contains multiple overlapping applications that must be consolidated:

### Current Applications

| Application | Location | Status | Action |
|------------|----------|--------|--------|
| Frontend (React/Vite) | `/frontend` | **PRIMARY** | Keep & Extend |
| Phase1 Backend (FastAPI) | `/phase1/services` | **PRIMARY** | Keep & Extend |
| Supergraph-Pro Frontend | `/Tradingview/supergraph-pro/frontend` | Prototype | Merge widgets → primary |
| Supergraph-Pro Backend | `/Tradingview/supergraph-pro/main.py` | Prototype | Extract logic → primary |
| Options Dashboard | `/Tradingview/options-dashboard` | Prototype | Merge → primary |
| Tradingview Sim | `/Tradingview/tradingview-sim` | Prototype | Deprecated |
| Volgate Integration | `/Tradingview/volgate-integration` | Prototype | Merge features → primary |

---

## Source of Truth Decisions

### 1. Chart Engine
- **Winner**: `frontend/src/core/ChartEngine.ts` + `lightweight-charts` (v5.1.0)
- **Reason**: Production-grade library, TypeScript, good performance
- **Supergraph CandleChart**: Extract mock data fallback pattern, merge indicator overlays

### 2. App Shell
- **Winner**: `frontend/src/App.tsx` + new unified shell
- **Action**: Restructure to terminal-grade layout with:
  - TopBar (mode, symbol, timeframe, health, clock)
  - LeftNav (Monitor, Charts, Replay, Strategies, Alerts, Portfolio, Reports, Automation, Settings)
  - RightDock (Indicators, Drawings, Data Inspector, Alerts)
  - BottomDock (Orders, Trades, Logs, Strategy Tester, Events)
  - Two workspaces: Chart | Dashboard

### 3. State Management
- **Winner**: `frontend/src/state/store.ts` (Zustand)
- **Action**: Extend with workspace mode, dashboard tiles, AI copilot state

### 4. Backend API
- **Winner**: `phase1/services/api/main.py` (FastAPI)
- **Routes**: 18 routers already implemented
- **Action**: Add options, AI, automation routes

### 5. Data Connectors
- **Winner**: `phase1/services/ingestion/connectors/`
- **Available**: Finnhub (live), Alpaca (live), YFinance (historical), Mock (test)
- **Action**: Enforce live-only runtime, mock only for CI

### 6. WebSocket Streaming
- **Winner**: `phase1/services/api/websocket.py`
- **Protocol**: BAR_FORMING, BAR_CONFIRMED, BAR_HISTORICAL
- **Action**: Add options, whale alerts channels

---

## Widget Adoption Matrix

### From Supergraph-Pro Frontend

| Widget | File | Action | Priority |
|--------|------|--------|----------|
| Dashboard | `Dashboard.tsx` | **Adopt** - regime cards, bot status | High |
| WhaleAlerts | `WhaleAlerts.tsx` | **Adopt** - whale flow tile | High |
| UncertaintyCone | `UncertaintyCone.tsx` | **Adopt** - risk visualization | Medium |
| GEXProfile | `GEXProfile.tsx` | **Adopt** - gamma exposure | Medium |
| VolSurface3D | `VolSurface3D.tsx` | **Adopt** - simplified 2D/3D | Medium |
| CommandPalette | `CommandPalette.tsx` | **Adopt** - AI command palette | High |
| TradeJournal | `TradeJournal.tsx` | **Adopt** - notes tile | High |
| WorkspaceManager | `WorkspaceManager.tsx` | **Adopt** - workspace switcher | High |
| TradingBot | `TradingBot.tsx` | **Review** - paper trading UI | Medium |
| StrategyLegos | `StrategyLegos.tsx` | **Rewrite** - strategy builder | Medium |
| Backtester | `Backtester.tsx` | **Merge** - with existing | High |
| GreeksPanel | `GreeksPanel.tsx` | **Adopt** - options analytics | High |
| IVSmile | `IVSmile.tsx` | **Adopt** - options analytics | Medium |
| AIStrategyRecommender | `AIStrategyRecommender.tsx` | **Adopt** - AI copilot | High |
| Runbook/* | `Runbook/` | **Adopt** - governance | High |
| ReplayControls/* | `ReplayControls/` | **Merge** - with existing | Medium |

### From Supergraph-Pro Backend

| Module | File | Action | Priority |
|--------|------|--------|----------|
| Options analytics | `src/options/` | **Adopt** - protective puts | High |
| Audit | `src/audit/` | **Adopt** - behavioral audit | High |
| Governance | `src/governance/` | **Adopt** - readiness scoring | High |
| Forecasting | `src/forecasting/` | **Review** - uncertainty cones | Medium |
| Signals | `src/signals/` | **Adopt** - signal generation | High |

---

## Duplicate Code Removal

### Frontend Duplicates

1. **Chart Components**
   - Keep: `frontend/src/features/chart/ChartCanvas.tsx`
   - Remove: `Tradingview/supergraph-pro/frontend/src/components/CandleChart.tsx` (extract patterns first)

2. **Symbol Selectors**
   - Keep: `frontend/src/features/layout/SymbolSelector.tsx`
   - Merge styles from: Supergraph header symbol picker

3. **Theme/Toggle**
   - Keep: `frontend/src/ui/` design system
   - Remove: Supergraph ThemeToggle (merge dark-first approach)

### Backend Duplicates

1. **Paper Trading**
   - Keep: `phase1/services/execution/`
   - Remove: `Tradingview/supergraph-pro/paper_trading.py` (extract logic)
   - Remove: `Tradingview/tradingview-sim/paper_trading.py`

2. **Database**
   - Keep: `phase1/services/persistence/`
   - Remove: `Tradingview/*/database.py` (duplicate SQLite logic)

3. **Config**
   - Keep: `phase1/services/config.py`
   - Merge: API keys from `Tradingview/*/config.py`

---

## API Contract Canonical Form

### REST Endpoints (Primary Backend: phase1)

```
GET    /health
GET    /api/v1/bars/{symbol}/{timeframe}
POST   /api/v1/ingest/tick
GET    /api/v1/parity/{symbol}/{timeframe}
GET    /api/v1/clock
POST   /api/v1/clock/control
GET    /api/v1/drawings/{symbol}
POST   /api/v1/drawings/{symbol}
DELETE /api/v1/drawings/{symbol}/{id}
GET    /api/v1/strategies
POST   /api/v1/strategies
GET    /api/v1/portfolio
GET    /api/v1/alerts
POST   /api/v1/alerts
GET    /api/v1/runs
GET    /api/v1/packages
GET    /api/v1/metrics
GET    /api/v1/incidents
GET    /api/v1/notes
GET    /api/v1/reports
```

### WebSocket Channels

```
ws://localhost:8000/ws/bars/{symbol}/{timeframe}
```

**Message Types:**
- `SUBSCRIBED` - Confirmation
- `BAR_HISTORICAL` - Historical bar
- `BAR_CONFIRMED` - Completed bar
- `BAR_FORMING` - In-progress bar

### New Endpoints (To Add)

```
# Options
GET    /api/v1/options/chain/{symbol}
GET    /api/v1/options/greeks/{symbol}
GET    /api/v1/options/iv-surface/{symbol}

# AI
POST   /api/v1/ai/analyze
POST   /api/v1/ai/recommend
GET    /api/v1/ai/proposals

# Automation
GET    /api/v1/automation/jobs
POST   /api/v1/automation/jobs
GET    /api/v1/automation/readiness/{strategy_id}

# WebSocket (New Channels)
ws://localhost:8000/ws/options/{symbol}
ws://localhost:8000/ws/whale-alerts
```

---

## File Migration Plan

### Phase 1: Core Structure (CURRENT)
1. Create `docs/merge_map.md` ✓
2. Create `docs/target_architecture.md` ✓
3. Establish unified shell component structure

### Phase 2: Widget Migration
1. Copy supergraph widgets to `frontend/src/features/dashboard/tiles/`
2. Adapt to design system (remove one-off styles)
3. Connect to primary state store

### Phase 3: Backend Consolidation
1. Add options routes to phase1 API
2. Add AI routes to phase1 API
3. Add automation routes to phase1 API
4. Remove prototype backends

### Phase 4: Cleanup
1. Archive `Tradingview/` folder
2. Update imports across codebase
3. Remove dead code paths

---

## Mock Data Elimination

### Current Mock Usage (To Remove)

| Location | Mock Type | Replacement |
|----------|-----------|-------------|
| `ChartCanvas.tsx` | `generateMockCandles()` | Live WS fallback only |
| `Supergraph App.tsx` | `generateMockCandleData()` | Remove - use live API |
| `Dashboard.tsx` | `generateMockRegime()` | API with graceful fallback |
| `WhaleAlerts.tsx` | `generateMockAlerts()` | API with "no data" state |
| `phase1/api/main.py` | Mock CSV replay | Live mode default |

### Allowed Mock Usage

- **Unit tests**: Deterministic test fixtures only
- **CI/Integration**: Recorded real data fixtures
- **Incident replay**: Captured bundles from real sessions

---

## Next Steps

1. **Implement unified shell** with workspace switcher
2. **Create plugin tile system** for dashboard widgets
3. **Migrate priority widgets** (WhaleAlerts, Dashboard, CommandPalette)
4. **Expand indicator library** to 30+ indicators
5. **Add options analytics suite**
6. **Implement AI copilot routes**
7. **Run verification loops**
