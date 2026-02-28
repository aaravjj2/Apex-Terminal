# Current State: TradingView Recreation

**Complete Technical Reference**  
**Date**: 2026-01-16

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [Autopilot System](#4-autopilot-system)
5. [Options Integration](#5-options-integration)
6. [Testing Infrastructure](#6-testing-infrastructure)
7. [n8n Automation](#7-n8n-automation)
8. [Gap Analysis](#8-gap-analysis)

---

## 1. Project Overview

### What This Project Is
A **production-grade market workstation** combining TradingView-style charting with Bloomberg-terminal analytics and an AI-powered options autopilot.

### Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19.2, TypeScript, Vite, Tailwind CSS |
| Charting | Lightweight Charts (TradingView library) |
| State | Zustand |
| Backend | FastAPI, Python 3.11 |
| Database | SQLite (4.7MB current) |
| AI/LLM | Groq, Gemini |
| Brokers | Alpaca (execution), Tradier (options data) |
| Automation | n8n (workflow orchestration) |

### Project Structure
```
/Tradingview recreation/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── features/        # 24 feature modules (111 files)
│   │   ├── ui/              # 19 reusable UI components
│   │   ├── core/            # ChartEngine, DataManager
│   │   └── state/           # Zustand stores
│   └── tests/               # Vitest + Playwright
├── phase1/                   # Python backend
│   ├── services/            # 27 service modules
│   ├── database/            # SQLite DB
│   └── tests/               # 1033 pytest tests
└── n8n/                      # Automation workflows
    ├── docker-compose.yml
    └── workflows/           # 4 JSON workflow files
```

---

## 2. Frontend Architecture

### Feature Modules (24 folders, 111 files)
```
frontend/src/features/
├── autopilot/     # 10 files - Autopilot UI controls
├── chart/         # 8 files  - Chart components
├── indicators/    # 10 files - Technical indicators
├── layout/        # 29 files - Views and shell
├── options/       # 14 files - Options workstation
├── trading/       # 17 files - Trading tiles
├── portfolio/     # 2 files  - Portfolio views
├── strategy/      # 3 files  - Strategy builder
└── ...            # 13 other feature folders
```

### UI Components Library (`frontend/src/ui/`)
| Component | Purpose | Size |
|-----------|---------|------|
| `Button.tsx` | Primary buttons with variants | 1.9KB |
| `Modal.tsx` | Modal dialogs | 5.4KB |
| `Table.tsx` | Data tables with sorting | 5.8KB |
| `Dropdown.tsx` | Select dropdowns | 6.6KB |
| `Tabs.tsx` | Tab navigation | 3.2KB |
| `Toast.tsx` | Notifications | 3.8KB |
| `Panel.tsx` | Collapsible panels | 1.1KB |
| `Badge.tsx` | Status badges | 1.7KB |
| `Input.tsx` | Form inputs | 1.4KB |
| `Skeleton.tsx` | Loading skeletons | 2.5KB |
| `StatusIndicator.tsx` | Live status dots | 1.8KB |
| `Drawer.tsx` | Slide-out drawers | 3.4KB |

### Trading Dashboard Tiles (`frontend/src/features/trading/tiles/`)
| Tile | Purpose | Logic |
|------|---------|-------|
| `ChartTile.tsx` | Price chart display | Renders Lightweight Charts |
| `PositionsTile.tsx` | Open positions | Real-time P&L with 2s updates |
| `OrdersTile.tsx` | Pending orders | Order status tracking |
| `WatchlistTile.tsx` | Symbol watchlist | Price monitoring |
| `OptionChainTile.tsx` | Options chain | Strike/expiry grid |
| `GreeksTile.tsx` | Options Greeks | Delta, Gamma, Theta, Vega |
| `NewsTile.tsx` | News feed | Headline sentiment |
| `CalendarTile.tsx` | Earnings calendar | Event dates |
| `AlertsTile.tsx` | Price alerts | Trigger notifications |
| `ScannerTile.tsx` | Stock scanner | Filter criteria |
| `PerformanceTile.tsx` | Performance metrics | Charts and stats |
| `HeatmapTile.tsx` | Sector heatmap | Visual market view |
| `TimeAndSalesTile.tsx` | Time & sales | Trade tape |
| `VolSurfaceTile.tsx` | Implied vol surface | 3D vol visualization |
| `UncertaintyCone.tsx` | Price forecast cone | Probability ranges |

### Main Views (`frontend/src/features/layout/views/`)
| View | Lines | Purpose |
|------|-------|---------|
| `UnifiedDashboardView.tsx` | 693 | **Main dashboard** - Supergraph + AI Panel + Positions/Orders/Events |
| `AIPanel.tsx` | 38,832 bytes | AI autopilot controls and status |
| `AutomationView.tsx` | 37,944 bytes | n8n workflow management |
| `SupergraphModule.tsx` | 24,424 bytes | Main chart with trade markers |
| `TradeLifecycleDrawer.tsx` | 25,446 bytes | Trade detail slide-out |
| `StrategiesView.tsx` | 19,696 bytes | Strategy templates |
| `RunsAuditView.tsx` | 24,781 bytes | Autopilot run history |
| `AlertsView.tsx` | 14,925 bytes | Alert management |
| `OrdersView.tsx` | 13,976 bytes | Order history |
| `IncidentsView.tsx` | 14,183 bytes | Error/incident tracking |
| `PortfolioView.tsx` | 9,589 bytes | Portfolio summary |
| `OptionsView.tsx` | 5,490 bytes | Options workstation |
| `ReportsView.tsx` | 9,038 bytes | P&L reports |
| `SettingsView.tsx` | 9,026 bytes | Configuration |
| `ReplayView.tsx` | 4,337 bytes | Market replay |
| `DashboardView.tsx` | 13,346 bytes | Legacy dashboard |
| `AutopilotView.tsx` | 2,292 bytes | Simple autopilot view |

### UnifiedDashboardView Deep Dive
**File**: `frontend/src/features/layout/views/UnifiedDashboardView.tsx` (693 lines)

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│  B1: Header Strip                                           │
│  [Symbol ▼] [1D|5D|1M|3M|1Y] [Run Autopilot] [Monitor] [👁] │
├─────────────────────────────────────────────────────────────┤
│  B2: Main Grid                                              │
│  ┌───────────────────────────┬─────────────────────────────┐│
│  │                           │                             ││
│  │    Supergraph             │      AI Panel               ││
│  │    (Chart + Trades)       │      (Autopilot Controls)   ││
│  │                           │                             ││
│  └───────────────────────────┴─────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  E: Today Operational Strip                                 │
│  [Realized P&L] [Unrealized] [Daily Loss Cap ▓▓░░] [Open Risk]│
├─────────────────────────────────────────────────────────────┤
│  Bottom Section                                             │
│  ┌───────────┬──────────┬──────────┬────────────────────────┐│
│  │ Positions │ Orders   │ Event    │ Settings               ││
│  │ Widget    │ Widget   │ Log      │ Mini View              ││
│  └───────────┴──────────┴──────────┴────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Key Functions**:
```typescript
// Fetch autopilot daily stats (realized/unrealized P&L, risk caps)
fetchDailyStats() → GET /api/v1/autopilot/report

// Fetch open positions
fetchPositions() → GET /api/v1/autopilot/positions?status=open

// Fetch pending orders
fetchOrders() → GET /api/v1/portfolio/orders?status=open

// Fetch event log
fetchEventLog() → GET /api/v1/autopilot/logs?limit=20

// Fetch autopilot config (risk limits, strategies)
fetchConfig() → GET /api/v1/autopilot/config

// Run autopilot cycle NOW
runAutopilotNow() → POST /api/v1/autopilot/cycle

// Polling: Every 60 seconds refresh all data
```

### PositionsTile Logic
**File**: `frontend/src/features/trading/tiles/PositionsTile.tsx` (110 lines)

**Data Structure**:
```typescript
interface Position {
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
}
```

**Real-Time Updates**:
```typescript
// Every 2 seconds, simulate price updates
useEffect(() => {
    const interval = setInterval(() => {
        setPositions(prev => prev.map(pos => {
            const newPrice = pos.currentPrice * (1 + (Math.random() - 0.5) * 0.002);
            const marketValue = pos.quantity * newPrice;
            const unrealizedPL = marketValue - (pos.quantity * pos.avgCost);
            return { ...pos, currentPrice: newPrice, marketValue, unrealizedPL };
        }));
    }, 2000);
    return () => clearInterval(interval);
}, []);
```

---

## 3. Backend Architecture

### Service Modules (`phase1/services/`)
| Service | Files | Purpose |
|---------|-------|---------|
| `api/` | 31 | FastAPI routes and main app |
| `autopilot/` | 30 | **Core autopilot engine** |
| `options/` | 9 | Options data providers |
| `charting/` | 15 | Chart data services |
| `execution/` | 4 | Trade execution |
| `ingestion/` | 10 | Data ingestion |
| `llm/` | 9 | LLM providers |
| `portfolio/` | 3 | Portfolio management |
| `alerts/` | 2 | Alert system |
| `automation/` | 7 | Automation logic |
| `backtest/` | 3 | Backtesting |
| `strategy/` | 4 | Strategy definitions |
| `persistence/` | 4 | Database access |
| `monitoring/` | 2 | System monitoring |
| `forecasting/` | 2 | Price forecasting |
| `fundamentals/` | 2 | Fundamental data |
| `incidents/` | 3 | Error tracking |
| `recovery/` | 2 | Error recovery |

### API Routes (Available Endpoints)
```
GET  /health                      → System health
GET  /api/v1/autopilot/status     → Autopilot state
POST /api/v1/autopilot/cycle      → Trigger cycle
GET  /api/v1/autopilot/positions  → Open positions
GET  /api/v1/autopilot/report     → Daily stats
GET  /api/v1/autopilot/config     → Configuration
GET  /api/v1/autopilot/logs       → Event log
GET  /api/v1/portfolio/orders     → Order list
GET  /api/v1/options/chain        → Options chain
GET  /api/v1/bars/{symbol}        → Historical bars (404 issue)
```

### Database Schema
```sql
-- Current SQLite Tables
trades          -- Trade history
positions       -- Current positions
bars            -- Price history
autopilot_runs  -- Run audit log
trade_ledger    -- Detailed trade log
options_cache   -- Cached options data
```

---

## 4. Autopilot System

### File Inventory (`phase1/services/autopilot/`)
| File | Lines | Purpose |
|------|-------|---------|
| `unified_engine.py` | 1185 | **Main autopilot engine** |
| `candidates.py` | 34KB | Trade candidate generation |
| `hybrid_selector.py` | 280 | **Groq→Gemini LLM pipeline** |
| `monitoring.py` | 28KB | Position monitoring |
| `runloop.py` | 24KB | Scheduled execution |
| `unified_cycle.py` | 22KB | Cycle orchestration |
| `unified_router.py` | 23KB | API routing |
| `news_sentiment.py` | 22KB | News analysis |
| `news_provider.py` | 21KB | News data fetching |
| `position_manager.py` | 20KB | Position tracking |
| `broker_position_manager.py` | 19KB | Broker sync |
| `selector.py` | 20KB | Candidate selection |
| `validator.py` | 18KB | Trade validation |
| `reporting.py` | 18KB | Report generation |
| `features.py` | 17KB | Feature extraction |
| `trade_stream.py` | 16KB | Trade streaming |
| `paper_broker.py` | 16KB | Paper trading |
| `config.py` | 16KB | Configuration |
| `execution_simulator.py` | 15KB | Execution sim |
| `monitor.py` | 15KB | Monitoring |
| `ledger.py` | 14KB | Trade ledger |
| `data_fetcher.py` | 13KB | Data fetching |
| `research_reports.py` | 13KB | Research |
| `alpaca_client.py` | 19KB | Alpaca API |
| `alpaca_broker.py` | 10KB | Alpaca broker |
| `v1_templates.py` | 10KB | Strategy templates |
| `universe.py` | 9KB | Symbol universe |
| `state_manager.py` | 5KB | State management |
| `service.py` | 4KB | Service wrapper |

### UnifiedAutopilotEngine Deep Dive
**File**: `phase1/services/autopilot/unified_engine.py` (1185 lines)

**Cycle Phases**:
```python
class CyclePhase(str, Enum):
    INIT = "init"
    DATA_REFRESH = "data_refresh"
    BROKER_REFRESH = "broker_refresh"
    MONITORING = "monitoring"           # Check exits first
    CANDIDATE_GENERATION = "candidate_generation"
    SELECTION = "selection"             # LLM ranking
    VALIDATION = "validation"           # Risk checks
    EXECUTION = "execution"             # Place orders
    PERSISTENCE = "persistence"         # Save to DB
    UI_UPDATE = "ui_update"
    COMPLETE = "complete"
    ERROR = "error"
```

**Exit Reasons**:
```python
class ExitReason(str, Enum):
    PROFIT_TARGET = "profit_target"     # Hit 50% profit
    STOP_LOSS = "stop_loss"             # Hit 2x loss
    TIME_STOP = "time_stop"             # Max hold time
    DTE_THRESHOLD = "dte_threshold"     # DTE < 7
    EARNINGS_SHOCK = "earnings_shock"   # Earnings move
    NEWS_SHOCK = "news_shock"           # Major news
    MANUAL_CLOSE = "manual_close"       # User closed
    KILL_SWITCH = "kill_switch"         # Emergency stop
    RISK_LIMIT = "risk_limit"           # Risk exceeded
```

**Validation Gates**:
```python
class ValidationGate(str, Enum):
    RISK_BUDGET = "risk_budget"
    MAX_POSITIONS = "max_positions"
    MAX_PER_UNDERLYING = "max_per_underlying"
    SYMBOL_FILTER = "symbol_filter"
    CLUSTER_CONCENTRATION = "cluster_concentration"
    LIQUIDITY = "liquidity"
    SPREAD_WIDTH = "spread_width"
    EARNINGS_BLACKOUT = "earnings_blackout"
    NEWS_SENTIMENT = "news_sentiment"
    REGIME_MISMATCH = "regime_mismatch"
    DTE_BOUNDS = "dte_bounds"
    DELTA_BOUNDS = "delta_bounds"
```

**Run Artifact** (Audit Trail):
```python
@dataclass
class RunArtifact:
    run_id: str
    timestamp: datetime
    duration_ms: float
    success: bool
    
    # Snapshots
    health: Optional[HealthSnapshot]
    market_context: Optional[MarketContext]
    sentiment: Optional[SentimentSnapshot]
    broker_verification: Optional[BrokerVerification]
    
    # Candidates
    candidates_considered: List[CandidateRecord]
    candidates_selected: List[CandidateRecord]
    
    # Actions
    monitoring_actions: List[MonitoringAction]
    orders_placed: List[OrderRecord]
    
    # Explanations
    no_action_reasons: List[str]
    error: Optional[str]
```

**Key Methods**:
```python
class UnifiedAutopilotEngine:
    def run_cycle(self, dry_run=False, force=False, config=None):
        """Execute a single unified autopilot cycle."""
        # 1. Generate run ID
        # 2. Check kill switch
        # 3. Refresh market data
        # 4. Refresh sentiment data
        # 5. Refresh broker state (positions from Alpaca)
        # 6. Check health
        # 7. Run monitoring pass (exits first!)
        # 8. Generate candidates
        # 9. Select via LLM (Groq→Gemini)
        # 10. Validate against risk limits
        # 11. Execute trades
        # 12. Persist to database
        # 13. Emit UI events
        # 14. Return RunArtifact
    
    def _run_monitoring_pass(self, positions, market, sentiment, dry_run):
        """Evaluate exits for all positions."""
        # Check each position against exit triggers
    
    def activate_kill_switch(self):
        """Emergency stop - halts all automation."""
```

### HybridSelector Deep Dive
**File**: `phase1/services/autopilot/hybrid_selector.py` (280 lines)

**Workflow**:
```
1. Groq (Fast)     → Rank 30 candidates → Select top 5-8
2. Gemini (Deep)   → Validate top 5-8 → Select final 2-3
3. Fallback        → Deterministic if LLMs fail
```

**Selection Logic**:
```python
def select(self, candidates, config, portfolio_state, market_context):
    # Stage 1: Groq fast ranking
    if groq_available:
        groq_response = self.groq_provider.rank_candidates(groq_context)
        top_candidates = filter_by_groq_selection(candidates)
    
    # Stage 2: Gemini validation
    if gemini_available and top_candidates:
        gemini_response = self.gemini_provider.rank_candidates(gemini_context)
        return apply_selections(gemini_response)
    
    # Fallback
    if both_fail:
        return deterministic_fallback.select(...)
```

**Groq Context** (sent to Groq):
```python
{
    "market_regime": "neutral",
    "vix_level": 18.5,
    "portfolio": {"equity": 50000, "total_risk": 250},
    "candidates": [
        {
            "id": "...",
            "symbol": "AAPL",
            "template": "put_credit_spread",
            "max_loss": 45,
            "pop": 0.72,
            "dte": 35,
            "iv_rank": 0.65,
            "liquidity_score": 0.92
        }
    ],
    "instructions": "Rank and select top 5-8 based on POP, risk/reward, liquidity"
}
```

**Gemini Context** (sent to Gemini):
```python
{
    "candidates": [...],  # Top picks from Groq
    "groq_explanation": "...",
    "instructions": "Validate and select final 2-3. Provide detailed explanation."
}
```

---

## 5. Options Integration

### Tradier Provider
**File**: `phase1/services/options/tradier_provider.py` (379 lines)

**Capabilities**:
```python
class TradierOptionsProvider:
    def get_expirations(self, symbol) -> List[str]:
        """Get available expiration dates."""
    
    def get_option_chain(self, symbol, expiration, greeks=True) -> Dict:
        """Get full options chain with Greeks."""
    
    def get_quotes(self, option_symbols) -> Dict:
        """Get quotes for specific options."""
    
    def health_check(self) -> bool:
        """Verify API connectivity."""
```

**Features**:
- Caching with configurable TTL (60s default)
- Rate limiting (120 calls/60s window)
- Response normalization
- Error handling with retries

**Configuration**:
```python
TradierOptionsProvider(
    api_key=os.getenv("TRADIER_BROKERAGE_KEY"),
    base_url="https://api.tradier.com/v1",
    cache_ttl_seconds=60,
    rate_limit_calls=120,
    rate_limit_window=60
)
```

### Alpaca Broker
**Files**: `alpaca_broker.py` (10KB), `alpaca_client.py` (19KB)

**Capabilities**:
- Paper trading execution
- Position sync from broker
- Order placement and tracking
- Account info retrieval

---

## 6. Testing Infrastructure

### Backend Tests (1033 total)
```
phase1/tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
└── e2e/              # End-to-end tests
```

**Run Command**:
```bash
cd phase1 && source venv/bin/activate && pytest tests/ -v
```

### Frontend Tests
**Unit Tests (22/22 passing)**:
```bash
cd frontend && npm run test:unit
```

**E2E Tests (22 specs)**:
```bash
cd frontend && npm run test:e2e
```

### Test Results Summary
| Suite | Tests | Passing | Status |
|-------|-------|---------|--------|
| Backend | 1033 | ~90%+ | ✅ Partial run |
| Frontend Unit | 22 | 22 | ✅ 100% |
| Frontend E2E | 22 | - | ⏳ Needs build |

---

## 7. n8n Automation

### Configuration
**File**: `n8n/docker-compose.yml`

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - TZ=America/New_York
      - WEBHOOK_URL=http://localhost:8000
    volumes:
      - ./data:/home/node/.n8n
      - ./workflows:/home/node/workflows
```

### Workflows Available
| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `market_open.json` | 9:30 AM ET | Wake autopilot, first scan |
| `intraday_scan.json` | Every 30 min | Regular opportunity scans |
| `position_monitor.json` | Every 5 min | Check exit triggers |
| `daily_report.json` | 4:05 PM ET | Generate daily report |

### Current Status
- ⚠️ **Docker not available** in WSL environment
- Workflows are defined but cannot execute
- Need Docker Desktop WSL integration

---

## 8. Gap Analysis

### Current Capabilities ✅
| Capability | Status |
|------------|--------|
| Backend API | 🟢 Running on port 8000 |
| Alpaca connected | 🟢 Paper mode |
| Tradier connected | 🟢 Live data |
| Autopilot cycles | 🟢 13 successful |
| LLM integration | 🟢 Groq + Gemini |
| Frontend UI | 🟢 Functional |
| Unit tests | 🟢 22/22 passing |

### Missing for Autonomous Mode ❌
| Feature | Status |
|---------|--------|
| Scheduled execution | ❌ Docker needed |
| Market hours awareness | ❌ Not implemented |
| Automatic position monitoring | ❌ Manual only |
| Exit trigger automation | ❌ Not automated |
| Kill switch auto-recovery | ❌ Not implemented |
| Daily reports | ❌ Not automated |

### Missing for Industrial Grade ❌
| Feature | Status |
|---------|--------|
| Hallucination detection | ❌ Not implemented |
| Entry scoring (0-100) | ❌ LLM only |
| News sentiment engine | ⚠️ Basic |
| Monte Carlo simulation | ❌ Not implemented |
| Walk-forward backtesting | ❌ Not implemented |
| PostgreSQL database | ❌ Using SQLite |
| Redis caching | ❌ Not implemented |
| Observability stack | ❌ Basic logging only |

---

*Analysis complete. Ready for implementation planning.*
