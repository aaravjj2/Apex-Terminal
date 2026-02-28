# Apex Terminal

> **Elasticsearch Vector Search Hackathon Entry** — Apex Terminal uses Elasticsearch as its **primary data store** with **dense_vector fields** (64-dim cosine) across 9 indices, **kNN similarity search**, **hybrid BM25+kNN with Reciprocal Rank Fusion (RRF)**, and **ELSER semantic search** (text_expansion with learned sparse encoding). 24 indices store 400+ documents covering backtests, strategies, autopilot cycles, events, tickets, and controls. **Novel application**: vector search for financial strategy pattern recognition — traders find similar backtests and strategies by their 64-dimensional performance fingerprint, not just text. Complete search stack: BM25, kNN, Hybrid RRF, and ELSER. 2143+ automated tests pass.

<div align="center">

**A Production-Grade Market Workstation Platform**

*Combining TradingView-style charting with Bloomberg-terminal analytics*

**Built with the tools and technologies:**

<img src="https://img.shields.io/badge/JSON-000000.svg?style=flat-square&logo=JSON&logoColor=white" alt="JSON">
<img src="https://img.shields.io/badge/npm-CB3837.svg?style=flat-square&logo=npm&logoColor=white" alt="npm">
<img src="https://img.shields.io/badge/Autoprefixer-DD3735.svg?style=flat-square&logo=Autoprefixer&logoColor=white" alt="Autoprefixer">
<img src="https://img.shields.io/badge/SQLAlchemy-D71F00.svg?style=flat-square&logo=SQLAlchemy&logoColor=white" alt="SQLAlchemy">
<img src="https://img.shields.io/badge/PostCSS-DD3A0A.svg?style=flat-square&logo=PostCSS&logoColor=white" alt="PostCSS">
<img src="https://img.shields.io/badge/TOML-9C4121.svg?style=flat-square&logo=TOML&logoColor=white" alt="TOML">
<img src="https://img.shields.io/badge/Polars-CD792C.svg?style=flat-square&logo=Polars&logoColor=white" alt="Polars">
<img src="https://img.shields.io/badge/tqdm-FFC107.svg?style=flat-square&logo=tqdm&logoColor=black" alt="tqdm">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat-square&logo=JavaScript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/DuckDB-FFF000.svg?style=flat-square&logo=DuckDB&logoColor=black" alt="DuckDB">
<img src="https://img.shields.io/badge/Ruff-D7FF64.svg?style=flat-square&logo=Ruff&logoColor=black" alt="Ruff">
<img src="https://img.shields.io/badge/Vitest-6E9F18.svg?style=flat-square&logo=Vitest&logoColor=white" alt="Vitest">
<img src="https://img.shields.io/badge/GNU%20Bash-4EAA25.svg?style=flat-square&logo=GNU-Bash&logoColor=white" alt="GNU%20Bash">
<img src="https://img.shields.io/badge/Immer-00E7C3.svg?style=flat-square&logo=Immer&logoColor=white" alt="Immer">
<img src="https://img.shields.io/badge/FastAPI-009688.svg?style=flat-square&logo=FastAPI&logoColor=white" alt="FastAPI">
<img src="https://img.shields.io/badge/React-61DAFB.svg?style=flat-square&logo=React&logoColor=black" alt="React">
<br>
<img src="https://img.shields.io/badge/NumPy-013243.svg?style=flat-square&logo=NumPy&logoColor=white" alt="NumPy">
<img src="https://img.shields.io/badge/Pytest-0A9EDC.svg?style=flat-square&logo=Pytest&logoColor=white" alt="Pytest">
<img src="https://img.shields.io/badge/Docker-2496ED.svg?style=flat-square&logo=Docker&logoColor=white" alt="Docker">
<img src="https://img.shields.io/badge/Python-3776AB.svg?style=flat-square&logo=Python&logoColor=white" alt="Python">
<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat-square&logo=TypeScript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/GitHub%20Actions-2088FF.svg?style=flat-square&logo=GitHub-Actions&logoColor=white" alt="GitHub%20Actions">
<img src="https://img.shields.io/badge/AIOHTTP-2C5BB4.svg?style=flat-square&logo=AIOHTTP&logoColor=white" alt="AIOHTTP">
<img src="https://img.shields.io/badge/Vite-646CFF.svg?style=flat-square&logo=Vite&logoColor=white" alt="Vite">
<img src="https://img.shields.io/badge/ESLint-4B32C3.svg?style=flat-square&logo=ESLint&logoColor=white" alt="ESLint">
<img src="https://img.shields.io/badge/pandas-150458.svg?style=flat-square&logo=pandas&logoColor=white" alt="pandas">
<img src="https://img.shields.io/badge/Axios-5A29E4.svg?style=flat-square&logo=Axios&logoColor=white" alt="Axios">
<img src="https://img.shields.io/badge/CSS-663399.svg?style=flat-square&logo=CSS&logoColor=white" alt="CSS">
<img src="https://img.shields.io/badge/datefns-770C56.svg?style=flat-square&logo=date-fns&logoColor=white" alt="datefns">
<img src="https://img.shields.io/badge/Pydantic-E92063.svg?style=flat-square&logo=Pydantic&logoColor=white" alt="Pydantic">
<img src="https://img.shields.io/badge/Chart.js-FF6384.svg?style=flat-square&logo=chartdotjs&logoColor=white" alt="Chart.js">
<img src="https://img.shields.io/badge/YAML-CB171E.svg?style=flat-square&logo=YAML&logoColor=white" alt="YAML">

[Features](#-key-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Documentation](#-documentation)

</div>

---

> [!IMPORTANT]
> **⚡ Run in 3 Commands** (Recorded Data - No API Keys Required)
> ```bash
> # 1. Clone the repo
> git clone https://github.com/aaravjj2/Apex-Terminal.git
> cd Apex-Terminal
> 
> # 2. Start backend (uses recorded authentic data)
> cd phase1 && pip install -r requirements.txt && python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8090 &
> 
> # 3. Start UI2 frontend
> cd frontend && npm install && npm run build && npm run preview -- --port 5100
> ```
> **Access UI2:**
> - Frontend: http://localhost:5100/ui2
> - API Docs: http://localhost:8090/docs

> [!CAUTION]
> **Disclaimer**: This is a **paper trading system** for research and development. It uses **recorded authentic market data** for deterministic testing. **Paper broker only** - no live broker integration. Not investment advice.

---

## 🎯 What is Apex Terminal?

### The Problem

Retail traders face a fragmented tooling landscape: charting lives in TradingView, analytics in Bloomberg, backtesting in Python notebooks, and strategy search requires manually browsing forums. **Unlike** existing platforms that bolt on search as an afterthought, we built Apex Terminal from the ground up with Elasticsearch as the **primary data store** — **because** finding similar strategies by their performance fingerprint (not just keywords) is the challenge no existing tool solves. **Instead of** treating search as a feature, we made it the foundation.

### Why We Built This

**Apex Terminal** is a production-grade options trading platform **powered by Elasticsearch** for intelligent document storage, vector similarity search, and hybrid BM25+kNN retrieval. It combines AI-powered autopilot, strategy backtesting, workflow automation, and semantic search — all backed by Elasticsearch as the **primary data store**.

### Elasticsearch as Primary Storage

All core domain entities are stored in and retrieved from Elasticsearch:

- **Backtests** → `apex-backtests` index with `dense_vector` fields (cosine, 64 dims)
- **Strategies** → `apex-strategies` index with kNN similarity search
- **Autopilot Cycles** → `apex-workflows` index with hybrid BM25+kNN retrieval
- **Events & Audit Trail** → `apex-events` index (append-only, compliance)
- **Tickets & Edges** → `apex-tickets` + `apex-ticket-edges` (graph relationships)
- **Controls & Reconciliation** → `apex-controls-*` indices (AP/AR, risk controls)

**Vector Search Features:**
- `dense_vector` fields (64 dimensions, cosine similarity) across 9 indices
- kNN endpoints: `/api/v4/elastihack/knn/similar_backtests`, `/knn/similar_strategies`
- Hybrid search: BM25 + kNN with Reciprocal Rank Fusion (RRF)
- Core usage proof: `/api/v4/elastihack/proof/core_usage` — live ES integration metrics

Built for quantitative researchers and algorithmic traders, it provides:

### Core Features (UI2)

1. **Autopilot + Profitability** - AI-driven options autopilot with paper broker integration, risk controls, and real-time P&L tracking
2. **Strategy Builder + Backtester** - Create, test, and optimize trading strategies with parameter sweeps and walk-forward analysis
3. **Workflow Builder** - Automate trading workflows with scheduling, templates, and audit trails
4. **Global Search** - Intelligent search across strategies, workflows, runs, and system entities with deep linking

### Data & Execution Modes

- **DATA_MODE=recorded** (default) - Uses authentic recorded market data stored in `phase1/cache/replay/` for deterministic, offline operation
- **BROKER_MODE=paper** (only mode) - Paper trading simulation with realistic order execution and position tracking
- **No live broker** - Live broker integration not yet implemented

### Perfect For:
- 📊 **Quant Researchers** - Deterministic backtesting and strategy development
- 🔬 **Algorithmic Traders** - Automated options trading with risk controls
- 🧪 **Testing & Development** - Reproducible test environments with recorded data
- 🎓 **Learning** - Understanding options trading mechanics in a safe environment

---

## ✨ Key Features

### 📊 Advanced Charting Engine

- **TradingView-style Interface** - Professional candlestick charts with multi-pane support
- **60+ Technical Indicators** across 6 categories:
  - **Trend**: SMA, EMA, WMA, DEMA, TEMA, VWAP, Ichimoku Cloud, Supertrend, Parabolic SAR, ADX, Aroon
  - **Momentum**: RSI, MACD, Stochastic, Stochastic RSI, CCI, ROC, Williams %R, TRIX, Momentum, CMO
  - **Volatility**: Bollinger Bands, ATR, Keltner Channels, Donchian Channels, BB Width, Historical Vol (4 methods), Vol Surface
  - **Volume**: OBV, MFI, CMF, ADL, VWMA, Volume Profile, Volume Bars, Force Index
  - **Profile**: VRVP, Anchored VWAP, VWAP Bands, POC, VAH/VAL, Market Profile/TPO
  - **Charting**: Heikin Ashi, Renko, Kagi, Point & Figure, Line Break, Range Bars, Pivot Points (5 types)
- **35+ Drawing Tools** - Lines, Fibonacci suite (retracement/extension/fan/arcs/time zones), Andrews'/Schiff Pitchfork, Gann fan/box/square, pattern overlays
- **Auto Pattern Recognition** - 35 candlestick patterns, double top/bottom, H&S, triangles, auto S/R, trend lines, ABCD harmonics
- **Real-time Updates** - Live bar formation and confirmation via WebSocket
- **Multi-timeframe Support** - 1m, 5m, 15m, 1H, 4H, 1D, 1W views

### 📈 Dashboard Workspace (Bloomberg-style)

**14 Configurable Analytics Tiles:**

1. **MiniChart** - Compact chart widgets for quick overview
2. **Scanner** - Market scanner with top movers, gainers, losers
3. **Heatmap** - Sector performance visualization
4. **Watchlist** - Multi-symbol monitoring with real-time prices
5. **Positions** - Open positions with P&L tracking
6. **Orders** - Orders blotter (pending, filled, cancelled)
7. **Alerts** - Price and indicator alerts
8. **News** - Real-time market news feed
9. **Calendar** - Economic calendar and earnings releases
10. **TickTable** - Tick-by-tick trade flow
11. **OptionsChain** - Options chain with Greeks
12. **GreeksPanel** - Portfolio Greeks aggregation
13. **IVSurface** - Implied volatility surface visualization
14. **PnLAnalytics** - Performance analytics and metrics

### 🔄 Strategy Development & Backtesting

- **In-Browser Strategy Editor** - Monaco Editor with Python syntax highlighting
- **Built-in Strategy Framework** - Extensible strategy system
- **Comprehensive Backtesting** - Historical performance analysis
- **Deterministic Replay** - Test strategies with exact historical data
- **Paper Trading** - Risk-free strategy execution
- **Real-time Execution Logs** - Monitor strategy signals and orders

### 🔌 Multiple Data Providers

- **Finnhub** - Real-time WebSocket streaming + REST API
- **Alpaca** - Professional trading API integration
- **Yahoo Finance** - Historical data backfill
- **Mock Data** - Deterministic CSV-based testing
- **Custom Providers** - Extensible provider system

### 🎮 Multiple Operating Modes

- **LIVE** - Real-time market data streaming
- **REPLAY** - Deterministic historical replay with speed control (0.5x - 10x)
- **BACKTEST** - Historical strategy testing
- **PAPER** - Paper trading mode

### 💼 Portfolio Management

- **Position Tracking** - Real-time P&L (realized + unrealized)
- **Order Management** - Market, limit, stop orders
- **Trade History** - Complete trade log with export to CSV
- **Performance Analytics** - Win rate, profit factor, drawdown analysis
- **Risk Metrics** - Portfolio Greeks, exposure tracking

---

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- **React 19.2** with TypeScript 5.9
- **Vite** - Lightning-fast build tool
- **Lightweight Charts** - High-performance charting library
- **Zustand** - State management
- **Tailwind CSS** - Utility-first styling
- **Playwright** - End-to-end testing

**Backend:**
- **FastAPI** - Modern Python web framework
- **Elasticsearch** - Primary data store with dense_vector fields (kNN, hybrid BM25+kNN, RRF)
- **WebSockets** - Real-time bidirectional communication
- **Pandas/NumPy** - Data processing
- **Pytest** - Comprehensive testing (2143+ tests)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
│  Port: 5100 (dev) / 4173 (preview)                         │
│  • Chart Workspace (TradingView-style)                      │
│  • Dashboard Workspace (Bloomberg-style)                    │
│  • Real-time WebSocket connections                          │
└─────────────────────────────────────────────────────────────┘
                        ↕ WebSocket/REST
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                        │
│  Port: 8000                                                 │
│  • Data Ingestion Service                                   │
│  • Bar Engine (OHLCV aggregation)                           │
│  • Strategy + Backtesting Engine (8 strategies, Monte Carlo)│
│  • Portfolio Manager + Risk Engine (VaR, CVaR, stress test) │
│  • 27 Computation Engines (TA, Options, Patterns, Sizing…)  │
│  • 350+ API Endpoints (REST + WebSocket)                    │
│  • Elasticsearch (primary data store, 24 indices)           │
│  • dense_vector kNN + hybrid BM25+kNN search                │
└─────────────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────────────┐
│            ELASTICSEARCH (Port 9200)                        │
│  • 24 indices (backtests, strategies, workflows, events)    │
│  • dense_vector fields (64-dim cosine) in 9 indices         │
│  • kNN similarity search + hybrid BM25+kNN with RRF        │
│  • Append-only audit trail + compliance logging             │
└─────────────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────────────┐
│              DATA SOURCES                                   │
│  • Finnhub (WebSocket + REST)                              │
│  • Alpaca (REST API)                                        │
│  • Yahoo Finance (Historical)                               │
│  • Mock CSV (Testing)                                       │
└─────────────────────────────────────────────────────────────┘
```

## System Architecture & Modules

| Module | Description | Key Components |
|--------|-------------|----------------|
| **frontend** | React/Vite-based UI similar to TradingView & Bloomberg | `features/chart`, `features/dashboard`, `core/ChartEngine`, `ui/SharedComponents` |
| **phase1** | Python/FastAPI Backend Core | `services/api`, `services/ingestion`, `services/bar_engine`, `services/strategy` |
| **phase1/services/ingestion** | Real-time market data ingestion | `FinnhubClient`, `AlpacaClient`, `StreamManager` |
| **phase1/services/bar_engine** | Aggregates ticks into OHLCV bars | `BarAggregator`, `TimeframeManager`, `ohlcv_buffer` |
| **phase1/services/strategy** | System for running trading algorithms | `StrategyEngine`, `VectorBT` integration, `SignalGenerator` |
| **phase1/services/ta_engine** | Technical Analysis (5 modules) | `ta_engine.py` (1349 LOC), `ta_engine_advanced.py`, `ta_engine_volume_profile.py`, `ta_engine_fibonacci.py`, `ta_engine_order_flow.py` |
| **phase1/services/chart_annotations_engine** | Annotations & Drawing Tools | 35+ drawing tools, Fibonacci suite, Gann, Andrews' Pitchfork, undo/redo |
| **phase1/services/market_data_engine** | Market Data Processing | Multi-provider, OHLCV, timeframe conversion, market hours |
| **phase1/services/portfolio_analytics_engine** | Portfolio Analytics | Returns analysis, risk metrics, attribution, drawdown decomposition |
| **phase1/services/risk_management_engine** | Risk Management | VaR (3 methods), CVaR, stress testing, margin, Greeks, scenario analysis |
| **phase1/services/options_pricing_engine** | Options Pricing | Black-Scholes, binomial, Monte Carlo, Greeks, IV surface, strategies |
| **phase1/services/scanner_engine** | Market Scanner | 20+ scan types, technical/fundamental/custom filters, composite scoring |
| **phase1/services/alert_engine** | Price & Indicator Alerts | Multi-condition alerts, cooldowns, severity levels, notification routing |
| **phase1/services/watchlist_engine** | Watchlist Management | Portfolios, real-time sync, sorting, filtering, performance tracking |
| **phase1/services/news_sentiment_engine** | News & Sentiment Analysis | NLP scoring, keyword extraction, sentiment aggregation, impact assessment |
| **phase1/services/order_management_engine** | Order Management System | Order lifecycle, OCO/bracket, GTC/GTD, partial fills, amendments |
| **phase1/services/execution_engine** | Trade Execution | Smart routing, TWAP/VWAP algos, slippage model, fill simulation |
| **phase1/services/backtesting_engine** | Strategy Backtesting | 8 strategies, walk-forward, Monte Carlo, multi-strategy, benchmark comparison |
| **phase1/services/charting_calculations_engine** | Advanced Charting | Heikin Ashi, Renko, Kagi, P&F, Line Break, Range Bars, VWAP, Market/Volume Profile |
| **phase1/services/correlation_analysis_engine** | Correlation Analysis | Correlation matrix, PCA, beta, lead-lag, regime detection, portfolio optimization |
| **phase1/services/economic_calendar_engine** | Economic Calendar | Surprise calculator, event impact, earnings analysis, seasonal patterns |
| **phase1/services/market_replay_engine** | Market Replay | Tick replay, bar aggregation, order book sim, multi-timeframe, trade simulation |
| **phase1/services/pattern_recognition_engine** | Auto Pattern Recognition | 35 candlestick patterns, chart patterns, S/R detection, harmonics (ABCD) |
| **phase1/services/multi_asset_analysis_engine** | Multi-Asset Analytics | Cross-asset correlation, carry trades, yield curves, macro factors, allocation |
| **phase1/services/heat_map_engine** | Heat Map Visualization | Sector, correlation, performance, volume, breadth, calendar heat maps |
| **phase1/services/volatility_surface_engine** | Volatility Surface | Black-Scholes, IV solver, historical vol (4 methods), Greeks surface, vol regime |
| **phase1/services/position_sizing_engine** | Position Sizing | Kelly, optimal-f, percent-risk, volatility, anti-martingale, portfolio heat, scaling |
| **n8n** | Workflow automation for Ops & Alerts | `workflows/alert_pipeline.json`, `docker-compose.yml` |
| **browser_extension** | Browser automation helpers | `manifest.json`, `content_scripts/scraper.js` |
| **cboe_pipeline** | Specialized Options Data Pipeline | `src/pipeline.py`, `analysis/volatility.py` |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** (3.14 recommended)
- **Node.js 18+** and npm
- **Elasticsearch 8.x** (running on port 9200)
- **No API keys required** for default recorded data mode

### Installation

**1. Elasticsearch Setup:**

```bash
# Start Elasticsearch (Windows service)
Start-Service Elasticsearch

# Or start manually:
cd "C:\Program Files\Elastic\Elasticsearch\bin"
.\elasticsearch.bat

# Verify ES is running:
curl http://localhost:9200/_cluster/health
# Expected: {"status":"green","number_of_nodes":1,...}

# Set replicas to 0 for single-node (makes cluster green):
curl -X PUT http://localhost:9200/_settings -H "Content-Type: application/json" -d '{"index":{"number_of_replicas":0}}'
```

**2. Backend Setup:**

```bash
cd phase1

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**3. Frontend Setup:**

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build
```

**4. Start the System:**

```bash
# Terminal 1 - Backend (port 8000):
cd phase1
source venv/bin/activate
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend Preview (port 5100):
cd frontend
npm run preview -- --port 5100 --host 0.0.0.0
```

### Verify Everything Works

```bash
# ES cluster health (should be green):
curl http://localhost:9200/_cluster/health

# Backend health:
curl http://localhost:8000/docs

# ES integration proof:
curl http://localhost:8000/api/v4/elastihack/proof/core_usage

# Run kNN similarity search:
curl -X POST http://localhost:8000/api/v4/elastihack/knn/similar_backtests \
  -H "Content-Type: application/json" \
  -d '{"vector": [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}'

# Run hybrid BM25+kNN search:
curl -X POST http://localhost:8000/api/v4/elastihack/hybrid/search \
  -H "Content-Type: application/json" \
  -d '{"query": "AAPL momentum strategy"}'
```

### Access the Application

- **UI2 Frontend**: http://localhost:5100/ui2
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **ES Cluster Health**: http://localhost:9200/_cluster/health

### Elasticsearch Setup (Required)

Apex Terminal requires Elasticsearch as its primary data store:

```bash
# Elasticsearch must be running on port 9200
# On Windows (if installed as service):
Start-Service Elasticsearch

# Verify:
curl http://localhost:9200/_cluster/health
```

**Elasticsearch Integration Details:**
- **24 indices** for all core domain entities (backtests, strategies, workflows, events, tickets, controls)
- **dense_vector fields** (64 dimensions, cosine similarity) in 9 indices for kNN search
- **Hybrid search** combining BM25 full-text + kNN vector similarity with Reciprocal Rank Fusion
- **Core usage proof** endpoint: `GET /api/v4/elastihack/proof/core_usage`

```bash
# Verify ES integration is working:
curl http://localhost:8000/api/v4/elastihack/proof/core_usage
# Returns: core_flows, doc_counts, vector_search details
```

---

## 📚 Documentation

- **[Complete Usage Guide](USAGE_GUIDE.md)** - Comprehensive user manual
- **[Project Report](PROJECT_REPORT.md)** - Detailed technical documentation
- **[Quick Reference](QUICK_REFERENCE.md)** - Quick command reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + 1` | Chart Workspace |
| `Ctrl/Cmd + 2` | Dashboard Workspace |
| `Ctrl/Cmd + 3` | Replay Mode |
| `Ctrl/Cmd + K` | Command Palette |
| `1/2/3/4/5` | Switch Timeframe (1m/5m/15m/1H/1D) |
| `Space` | Play/Pause Replay |
| `→` | Step Forward (Replay) |
| `←` | Step Backward (Replay) |
| `Ctrl/Cmd + Z` | Undo Drawing |
| `Ctrl/Cmd + Y` | Redo Drawing |

---

## 🧪 Testing

> **Strict Testing Policy** — All tests must pass with 0 failures, 0 skipped

### Backend Unit Tests (pytest)

```bash
cd phase1
source venv/bin/activate
python -m pytest tests/unit/ --tb=short -q
```

### Frontend Unit Tests (vitest)

```bash
cd frontend
npx vitest run
```

### End-to-End Tests (Playwright)

**Prerequisites:**
- Backend running on port 8090
- Frontend build + preview running on port 5100

```bash
cd frontend

# Build frontend
npm run build

# Start preview (separate terminal)
npm run preview -- --port 5100 --host 0.0.0.0 &

# Run E2E tests (headed, workers=1, retries=0)
npx playwright test tests/e2e/core/ --reporter=list
```

**Configuration:** 
- `retries=0` - No test retries (fix real issues)
- `workers=1` - Single worker for deterministic execution
- `headless=false` - Headed mode for observation
- `video=on` - All test runs recorded
- `trace=on` - Full trace capture
- `screenshot=on` - Screenshots at key steps

### Media Pack Capture (Evidence)

```bash
cd frontend
npx playwright test tests/e2e/evidence-capture.spec.ts --reporter=list
# Output: artifacts/proof/20260220-evidence-media-pack/SCREENSHOTS/ (21 PNG files)
# + test-results/ contains videos
```

---

## 📊 Project Statistics

- **597,000+ lines of code** (350K Python + 247K Frontend)
- **60+ Technical Indicators** across 6 categories (trend, momentum, volatility, volume, profile, charting)
- **35+ Drawing Tools** (Fibonacci suite, Gann, Andrews' Pitchfork, pattern overlays)
- **35 Auto-Detected Candlestick Patterns** + chart patterns, S/R, ABCD harmonics
- **14 Dashboard Tiles** (Bloomberg-style configurable workspace)
- **5 Data Providers** (Finnhub, Alpaca, Yahoo Finance, Mock CSV, Custom)
- **8 Built-in Strategies** (SMA crossover, RSI, MACD, Bollinger, VWAP, Momentum, MeanRev, Breakout)
- **2143+ Automated Tests** (pytest unit + Vitest + Playwright E2E) — 0 failures
- **27 Backend Engine Modules** (TA, charting, portfolio, risk, options, backtesting, pattern recognition, etc.)
- **350+ API Endpoints** across v1-v4 routes
- **15 Navigable Views** (Dashboard, Chart, Options, Backtests, Autopilot, ...)

---

## 🛠️ Development

### Project Structure

```
Tradingview recreation/
```sh
└── /
    ├── .github
    │   ├── prompts
    │   └── workflows
    ├── AUTOPILOT_EXPLANATION.md
    ├── CURRENT_STATE.md
    ├── IMPLEMENTATION_STATUS.md
    ├── MASTER_PLAN.md
    ├── Makefile
    ├── PROJECT_REPORT.md
    ├── QUICK_REFERENCE.md
    ├── README.html
    ├── README.md
    ├── README_FACTS.md
    ├── README_Generator_Colab.ipynb
    ├── README_NEW.html
    ├── README_NEW.md
    ├── ROBUSTNESS_IMPROVEMENTS.md
    ├── RUNBOOK.md
    ├── Readme ai.code-workspace
    ├── TEST_STATUS_SUMMARY.md
    ├── Tradingview
    │   ├── .pytest_cache
    │   └── keys.env
    ├── USAGE_GUIDE.md
    ├── artifacts
    │   ├── backend_status.log
    │   ├── dist
    │   ├── phase1
    │   ├── phase4
    │   ├── release
    │   └── verification
    ├── backend.log
    ├── browser_extension
    │   ├── manifest.json
    │   ├── popup.html
    │   └── popup.js
    ├── cboe_pipeline
    │   ├── README.md
    │   ├── analysis
    │   ├── audit_data.py
    │   ├── check_progress.py
    │   ├── config.yaml
    │   ├── data
    │   ├── main.py
    │   ├── pipeline.log
    │   ├── requirements.txt
    │   └── src
    ├── colab_readme_generator.py
    ├── current_dashboard.png
    ├── data
    │   └── equity
    ├── debug_browser_ws.js
    ├── debug_db.py
    ├── diagnose_browser.js
    ├── docker-compose.unified.yml
    ├── docs
    │   ├── ACCEPTANCE_CHECKLIST.md
    │   ├── LEAN_LOCAL_RUNBOOK_WINDOWS.md
    │   ├── QC_ACCEPTANCE_CHECKLIST.md
    │   ├── QC_ADAPTER_PROOF_REPORT.md
    │   ├── QC_BRAIN_CONTRACT.md
    │   ├── QC_CLOUD_RUNBOOK.md
    │   ├── QC_PATTERN_A_PORT.md
    │   ├── QC_REAL_RUN_SUMMARY.md
    │   ├── RUNBOOK.md
    │   ├── V1_SPEC.md
    │   ├── api_contracts.md
    │   ├── build_plan.md
    │   ├── delivery_summary.md
    │   ├── final_report.md
    │   ├── implementation_plan.md
    │   ├── merge_map.md
    │   ├── side_project_review.md
    │   ├── smoke_snapshot.png
    │   ├── smoke_snapshot_pytest.png
    │   └── target_architecture.md
    ├── frontend
    │   ├── .env.development
    │   ├── .gitignore
    │   ├── .pytest_cache
    │   ├── README.md
    │   ├── artifacts
    │   ├── backend_status.log
    │   ├── dist
    │   ├── eslint.config.js
    │   ├── frontend
    │   ├── frontend.log
    │   ├── frontend_status.log
    │   ├── index.html
    │   ├── node_modules
    │   ├── nohup.out
    │   ├── package-lock.json
    │   ├── package.json
    │   ├── playwright-report
    │   ├── playwright.config.ts
    │   ├── playwright.video.config.ts
    │   ├── postcss.config.js
    │   ├── preview.log
    │   ├── public
    │   ├── screenshots
    │   ├── scripts
    │   ├── src
    │   ├── tailwind.config.js
    │   ├── test-results
    │   ├── test_ws.py
    │   ├── tests
    │   ├── tsconfig.app.json
    │   ├── tsconfig.json
    │   ├── tsconfig.node.json
    │   ├── verify_dashboard_prices.cjs
    │   ├── verify_gate0.cjs
    │   ├── verify_gate2.cjs
    │   ├── vite.config.ts
    │   ├── vite.out
    │   └── vitest.config.ts
    ├── frontend.log
    ├── full_implementation_plan.md
    ├── full_implementation_plan.md:Zone.Identifier
    ├── generate_readme_html.py
    ├── improvement_guide.md
    ├── inspect_alpaca.py
    ├── inspect_leg.py
    ├── keys.env
    ├── keys.env.example
    ├── lean.json
    ├── logs
    │   ├── backend.log
    │   ├── frontend.log
    │   └── n8n_docker.log
    ├── monitor.log
    ├── monitor_trades.py
    ├── n8n
    │   ├── README.md
    │   ├── docker-compose.yml
    │   └── workflows
    ├── n8n_workflow_validation_report.md
    ├── node_modules
    │   ├── .bin
    │   ├── .package-lock.json
    │   ├── @playwright
    │   ├── playwright
    │   └── playwright-core
    ├── package-lock.json
    ├── package.json
    ├── phase1
    │   ├── .dockerignore
    │   ├── .pytest_cache
    │   ├── =15.0.0
    │   ├── =2024.1
    │   ├── DOCUMENTATION.md
    │   ├── Dockerfile
    │   ├── Makefile
    │   ├── README.md
    │   ├── SYSTEM_AUDIT.md
    │   ├── artifacts
    │   ├── autopilot_brain
    │   ├── autopilot_config.json
    │   ├── backend.log
    │   ├── check_creds.py
    │   ├── data
    │   ├── debug_db.py
    │   ├── docker-compose.yml
    │   ├── docs
    │   ├── fixtures
    │   ├── keys.env
    │   ├── keys.env.example
    │   ├── n8n
    │   ├── nohup.out
    │   ├── phase1.db
    │   ├── pytest.ini
    │   ├── requirements.txt
    │   ├── scripts
    │   ├── server.log
    │   ├── services
    │   ├── tests
    │   ├── trade_ledger.json
    │   ├── uvicorn.out
    │   └── venv
    ├── phase1.db
    ├── proxy.log
    ├── qc
    │   ├── AutopilotQC_v1
    │   └── Library
    ├── quick_ws_test.py
    ├── readme-config.toml
    ├── run_all.sh
    ├── sanity.log
    ├── scripts
    │   ├── backtest.py
    │   ├── live_run.py
    │   └── sync_brain.py
    ├── smoke.log
    ├── smoke_retry.log
    ├── strategies
    │   ├── rsi_breakout.py
    │   ├── sma_crossover.py
    │   └── vwap_reversion.py
    ├── test_backend.py
    ├── test_n8n_from_container.sh
    ├── test_n8n_workflow.py
    ├── test_snapshot.js
    ├── test_websocket.py
    ├── tests
    │   ├── __pycache__
    │   ├── brain
    │   ├── full_month_backtest.py
    │   ├── integration
    │   ├── qc_harness.py
    │   ├── test_ui_smoke.py
    │   ├── ui_smoke_test.py
    │   └── unit
    ├── tools
    │   └── generate_lean_data.py
    ├── verify_extension.js
    ├── vwap_paper
    │   ├── backend
    │   ├── config
    │   ├── frontend
    │   └── scripts
    ├── vwap_trading_system
    │   ├── .pytest_cache
    │   ├── README.md
    │   ├── backend
    │   ├── backend.log
    │   ├── config
    │   ├── data
    │   ├── frontend
    │   ├── playwright.config.ts
    │   ├── pytest.ini
    │   ├── requirements.txt
    │   ├── run_tests.sh
    │   ├── start.sh
    │   ├── start_demo.sh
    │   └── tests
    ```

### Key Technologies

- **Frontend**: React 19.2, TypeScript 5.9, Vite, Lightweight Charts, Tailwind CSS, Zustand, Chart.js, Recharts
- **Backend**: FastAPI, SQLAlchemy 2.0, WebSockets, Pandas, NumPy, SciPy, Pydantic
- **Data**: Finnhub (WebSocket + REST), Alpaca, Yahoo Finance, Elasticsearch (kNN, BM25, RRF)
- **Computation**: 27 pure-computation engines (TA, backtesting, options, risk, pattern recognition, position sizing, etc.)
- **Testing**: Pytest (2143+ tests), Playwright (E2E), Vitest (unit)

---

## 📝 License

[Add your license here]

---

## 🌐 Live Demo

**Live Demo:** https://apex-terminal.vercel.app

> **Note:** The live demo runs in recorded data mode. For full live market data, clone and configure API keys per the Quick Start below.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Contact

[Add your contact information here]

---

<div align="center">

**Built with ❤️ for traders, quants, and financial professionals**

[Back to Top](#tradingview-recreation)

</div>
