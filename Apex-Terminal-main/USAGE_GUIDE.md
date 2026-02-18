# TradingView Recreation - Complete Usage Guide

## 📋 Overview

This is a **TradingView-style market workstation** with a React frontend and Python FastAPI backend. It combines:

- **Real-time market data** (via Finnhub, Alpaca, or mock data)
- **Advanced charting** with indicators and drawings
- **Dashboard workspace** with analytics tiles
- **Strategy backtesting** and execution
- **Portfolio management**
- **Incident replay** for deterministic testing

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  Port: 5100 (dev) / 4173 (preview)                      │
│  - Chart Workspace (TradingView-like)                   │
│  - Dashboard Workspace (Bloomberg-like)                 │
│  - Real-time WebSocket connections                       │
└─────────────────────────────────────────────────────────┘
                        ↕ WebSocket/REST
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                     │
│  Port: 8000 (default)                                    │
│  - Data Ingestion Service                                │
│  - Bar Engine (OHLCV aggregation)                       │
│  - Strategy Engine                                       │
│  - Portfolio Manager                                     │
│  - SQLite/PostgreSQL Database                           │
│  - Options Analytics Engine                             │
└─────────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────────┐
│              DATA SOURCES                                │
│  - Finnhub (WebSocket + REST)                           │
│  - Alpaca (REST polling)                                 │
│  - YFinance (historical backfill)                       │
│  - Mock CSV (deterministic testing)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** (3.12 recommended)
- **Node.js 18+** and npm
- **API Keys** (optional, for live data):
  - Finnhub API key
  - Alpaca API credentials

### Step 1: Backend Setup

```bash
# Navigate to backend directory
cd phase1

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables (optional for live data)
cp keys.env.example keys.env
# Edit keys.env and add your API keys:
# FINNHUB_API_KEY=your_key_here
# APCA_API_KEY_ID=your_key_here
# APCA_API_SECRET_KEY=your_secret_here
```

### Step 2: Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install
```

### Step 3: Start the System

**Terminal 1 - Backend:**

```bash
cd phase1
source venv/bin/activate
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

**Terminal 3 - Data Ingestion (Optional, if not auto-started):**

```bash
cd phase1
source venv/bin/activate
python -m services.ingestion.main --mode live --symbols AAPL,MSFT,TSLA
```

### Step 4: Access the Application

- **Frontend**: <http://localhost:5100> (or port shown in terminal)
- **Backend API**: <http://localhost:8000>
- **API Docs**: <http://localhost:8000/docs>

---

## 📖 How It Works

### Data Flow

1. **Ingestion Service** (`services/ingestion/main.py`)
   - Connects to data provider (Finnhub/Alpaca/Mock)
   - Receives tick data (price, volume, timestamp)
   - Normalizes ticks (deduplication, ordering)
   - Sends to Bar Engine

2. **Bar Engine** (`services/bar_engine/`)
   - Aggregates ticks into OHLCV bars
   - Supports multiple timeframes (1m, 5m, 15m, 1H, 1D)
   - Emits `BAR_FORMING` (incomplete) and `BAR_CONFIRMED` events

3. **Persistence** (`services/persistence/`)
   - Stores bars in SQLite/PostgreSQL
   - Async LRU cache for fast reads
   - Tiered storage (cache → DB)

4. **WebSocket Broadcasting**
   - Real-time bar updates to frontend
   - Frontend subscribes to `ws://localhost:8000/ws/bars/{symbol}/{timeframe}`

5. **Frontend State** (`frontend/src/state/`)
   - Zustand stores manage:
     - `appStore`: Mode, symbol, timeframe, replay state
     - `workspaceStore`: Active workspace (chart/dashboard)
     - Chart data, indicators, drawings

### Modes

| Mode | Description | Color |
|------|-------------|-------|
| **LIVE** | Real-time data, paper/live trading | Green |
| **REPLAY** | Deterministic replay from recordings | Yellow |
| **BACKTEST** | Historical simulation | Blue |
| **PAPER** | Paper trading (no real orders) | Orange |

---

## 🎯 Key Features

### 1. Chart Workspace

**Access**: Press `Ctrl/Cmd + 1` or click "Monitor" in left nav

**Features**:

- Candlestick charts with volume
- 30+ indicators (RSI, MACD, Bollinger Bands, etc.)
- Drawing tools (lines, channels, pitchforks, annotations)
- Multi-timeframe support
- Real-time streaming

**Keyboard Shortcuts**:

- `1/2/3/4/5` - Switch timeframe (1m/5m/15m/1H/1D)
- `Ctrl/Cmd + Z` - Undo drawing
- `Ctrl/Cmd + Y` - Redo drawing

### 2. Dashboard Workspace

**Access**: Press `Ctrl/Cmd + 2` or click "Dashboard" in left nav

**Features**:

- Draggable/resizable tiles
- Analytics widgets:
  - Regime Card (Trend/Chop detection)
  - Whale Flow Alerts
  - Trust Score & Readiness
  - GEX Profile
  - Options Chain
  - Greeks Panel
  - Uncertainty Cone
- Trade Journal
- Mini charts

### 3. AI Options Autopilot (Paper Mode)

**Access**: Click "Autopilot" in left nav

The AI Options Autopilot is a paper-only automated options trading system that scans for opportunities, generates trade candidates, and executes paper trades within strict risk limits.

**Key Features**:
- **Paper Trading Only** - No real capital at risk
- **Defined-Risk Strategies** - Put/Call Credit Spreads, Iron Condors, Debit Spreads
- **Deterministic Guardrails** - Hard risk limits enforced automatically
- **Optional LLM Ranking** - AI-powered candidate selection (uses Groq by default)

**Dashboard Tabs**:
- **Dashboard** - Status, portfolio summary, run controls
- **Positions** - Current open positions with Greeks exposure
- **Proposals** - Trade candidates and LLM rationale
- **Activity** - Trade log and events
- **Settings** - Configuration and risk limits

**Default Settings** (for $1,000 paper equity):
| Setting | Default | Description |
|---------|---------|-------------|
| Max Risk/Trade | $50 | 5% of equity |
| Max Total Risk | $300 | 30% of equity |
| Max Daily Loss | $30 | 3% of equity |
| Max Positions | 10 | Concentration limit |

**Strategy Templates**:
1. **Put Credit Spread** - Bullish/neutral outlook
2. **Call Credit Spread** - Bearish/neutral outlook
3. **Iron Condor** - Range-bound outlook
4. **Call Debit Spread** - Bullish trend
5. **Put Debit Spread** - Bearish trend

**API Endpoints**:
- `GET /api/v1/autopilot/status` - Current state and metrics
- `POST /api/v1/autopilot/run` - Trigger autopilot cycle
- `GET /api/v1/autopilot/positions` - View positions
- `GET /api/v1/autopilot/proposals` - View candidates
- `POST /api/v1/autopilot/kill_switch` - Emergency stop

**n8n Integration**:
Sample workflows are provided in `n8n/workflows/`:
- `autopilot_scheduled_run.json` - Schedule runs at market hours
- `daily_report_generator.json` - Generate daily P&L reports
- `regime_change_handler.json` - Auto-adjust risk on volatility

### 4. Strategy Testing

**Access**: Click "Strategies" in left nav

**Features**:

- Write strategies in Python
- Backtest against historical data
- Paper trading execution
- Performance metrics

### 5. Replay Mode

**Access**: Press `Ctrl/Cmd + 3` or click "Replay" in left nav

**Features**:

- Deterministic replay of recorded market data
- Step through bars one-by-one
- Test strategies on historical incidents
- Virtual clock for deterministic timing

**Controls**:

- `Space` - Play/Pause
- `→` - Step forward
- `←` - Step backward
- `Shift + →` - Step 10 bars forward

### 6. Portfolio Management

**Access**: Click "Portfolio" in left nav

**Features**:

- Position tracking
- P&L monitoring
- Risk metrics
- Trade history

---

## 🔧 Configuration

### Backend Configuration

**Environment Variables** (`phase1/keys.env`):

```bash
# Data Sources
FINNHUB_API_KEY=your_key
APCA_API_KEY_ID=your_key
APCA_API_SECRET_KEY=your_secret
APCA_ENDPOINT=https://paper-api.alpaca.markets

# Database
DATABASE_URL=sqlite:///./phase1.db  # or PostgreSQL URL

# Ingestion Mode
INGESTION_MODE=live  # or 'mock' for testing

# Server
API_HOST=0.0.0.0
API_PORT=8000
```

### Frontend Configuration

**API Endpoint** (`frontend/src/data/APIClient.ts`):

- Default: `http://localhost:8000`
- Change in `APIClient.ts` if backend runs on different port

**WebSocket URL** (`frontend/src/data/WebSocketClient.ts`):

- Default: `ws://localhost:8000/ws`
- Auto-connects on app load

---

## 📡 API Endpoints

### REST API

**Bars**:

- `GET /api/v1/bars/{symbol}/{timeframe}` - Get historical bars
- `GET /api/v1/bars/{symbol}/{timeframe}?from=2025-01-01&to=2025-01-02` - Date range

**Clock**:

- `GET /api/v1/clock` - Get market clock status

**Strategies**:

- `GET /api/v1/strategies` - List strategies
- `POST /api/v1/strategies` - Create strategy
- `POST /api/v1/strategies/{id}/backtest` - Run backtest

**Portfolio**:

- `GET /api/v1/portfolio` - Get portfolio state
- `GET /api/v1/portfolio/positions` - Get positions

**Drawings**:

- `GET /api/v1/drawings/{symbol}` - Get saved drawings
- `POST /api/v1/drawings/{symbol}` - Save drawings

### WebSocket

**Bar Updates**:

```
ws://localhost:8000/ws/bars/{symbol}/{timeframe}
```

**Message Types**:

- `BAR_FORMING` - Incomplete bar (updates in real-time)
- `BAR_CONFIRMED` - Completed bar (final OHLCV)

**Example Message**:

```json
{
  "type": "BAR_CONFIRMED",
  "symbol": "AAPL",
  "timeframe": "1m",
  "bar": {
    "timestamp": "2025-01-12T09:30:00Z",
    "open": 150.25,
    "high": 150.50,
    "low": 150.20,
    "close": 150.45,
    "volume": 1000000
  }
}
```

---

## 🧪 Testing

### Backend Tests

```bash
cd phase1
source venv/bin/activate

# Run all tests
pytest -v

# Run specific test suite
pytest tests/unit/ -v
pytest tests/integration/ -v
pytest tests/parity/ -v

# Run with coverage
pytest --cov=services --cov-report=html
```

### Frontend Tests

```bash
cd frontend

# Unit tests
npm run test:unit

# Integration tests
npm run test:int

# E2E tests (requires Playwright)
npm run test:e2e

# Run all tests
npm run test:3loop
```

### Mock Data Testing

**Run deterministic replay**:

```bash
cd phase1
python scripts/run_mock.py \
  --csv fixtures/aapl_test_ticks.csv \
  --symbols AAPL \
  --timeframes 1m,5m \
  --output output_bars.csv
```

---

## 🐛 Troubleshooting

### Backend Won't Start

1. **Check Python version**: `python --version` (need 3.11+)
2. **Check virtual environment**: `which python` should point to `phase1/venv`
3. **Check dependencies**: `pip list` should show fastapi, uvicorn, etc.
4. **Check port**: Port 8000 might be in use. Change in `keys.env` or command line

### Frontend Won't Connect to Backend

1. **Check backend is running**: Visit <http://localhost:8000/docs>
2. **Check CORS**: Backend allows all origins by default
3. **Check WebSocket**: Open browser console, look for connection errors
4. **Check API URL**: Verify `APIClient.ts` has correct backend URL

### No Data Appearing

1. **Check ingestion service**: Should see logs in backend terminal
2. **Check API keys**: If using live mode, verify keys in `keys.env`
3. **Check mode**: Backend defaults to `mock` if no API keys. Use `--mode live` explicitly
4. **Check symbols**: Verify symbols are subscribed (default: AAPL, MSFT, TSLA)

### Database Issues

1. **Reset database**: Delete `phase1/phase1.db` and restart
2. **Check migrations**: Database auto-initializes on first run
3. **Check permissions**: Ensure write permissions in `phase1/` directory

---

## 📚 Key Files Reference

### Backend

- `phase1/services/api/main.py` - FastAPI app entry point
- `phase1/services/ingestion/main.py` - Data ingestion service
- `phase1/services/bar_engine/engine.py` - Bar aggregation logic
- `phase1/services/persistence/` - Database and cache
- `phase1/DOCUMENTATION.md` - Detailed backend docs

### Frontend

- `frontend/src/main.tsx` - React entry point
- `frontend/src/features/layout/shell/Shell.tsx` - Main app shell
- `frontend/src/features/chart/ChartCanvas.tsx` - Chart component
- `frontend/src/state/appStore.ts` - Main app state
- `frontend/src/data/WebSocketClient.ts` - WebSocket connection
- `frontend/src/data/APIClient.ts` - REST API client

---

## 🎨 Customization

### Adding Indicators

1. Create calculator in `frontend/src/features/indicators/calculators/`
2. Register in `frontend/src/features/indicators/IndicatorRegistry.ts`
3. Add renderer if needed in `frontend/src/features/indicators/renderers/`

### Adding Dashboard Tiles

1. Create tile component in `frontend/src/features/dashboard/tiles/`
2. Register in `frontend/src/features/dashboard/TileRegistry.ts`
3. Define data requirements and layout

### Adding Data Connectors

1. Create connector in `phase1/services/ingestion/connectors/`
2. Inherit from `BaseConnector`
3. Implement required methods
4. Register in ingestion service

---

## 🚢 Deployment

### Development

Already covered in Quick Start section.

### Production

**Backend**:

```bash
cd phase1
# Use production WSGI server
gunicorn services.api.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Frontend**:

```bash
cd frontend
npm run build
# Serve dist/ with nginx or similar
```

**Docker** (if available):

```bash
cd phase1
docker-compose up -d
```

---

## 📞 Support & Resources

- **Backend Docs**: `phase1/DOCUMENTATION.md`
- **Architecture**: `docs/target_architecture.md`
- **API Docs**: <http://localhost:8000/docs> (when backend is running)

---

## 🎯 Next Steps

1. **Start the system** using Quick Start guide
2. **Explore Chart Workspace** - Add indicators, create drawings
3. **Try Dashboard** - Add tiles, customize layout
4. **Test a Strategy** - Write a simple moving average crossover
5. **Use Replay Mode** - Test strategies on historical data

Happy trading! 📈
