# Apex Terminal

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

**Apex Terminal** is a production-grade options trading platform with AI-powered autopilot, strategy backtesting, workflow automation, and intelligent search. Built for quantitative researchers and algorithmic traders, it provides:

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
- **35 Technical Indicators** across 5 categories:
  - **Trend**: SMA, EMA, VWAP, Ichimoku Cloud, Supertrend, Parabolic SAR, ADX, Aroon
  - **Momentum**: RSI, MACD, Stochastic, Stochastic RSI, CCI, ROC, Williams %R, TRIX, Momentum
  - **Volatility**: Bollinger Bands, ATR, Keltner Channels, Donchian Channels, BB Width, Historical Volatility
  - **Volume**: OBV, MFI, CMF, ADL, VWMA, Volume Profile, Volume Bars
  - **Profile**: VRVP, Anchored VWAP, VWAP Bands, POC, VAH/VAL
- **30+ Drawing Tools** - Lines, Fibonacci tools, pitchforks, shapes, annotations, and pattern recognition
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
- **SQLAlchemy** - Database ORM (SQLite/PostgreSQL)
- **WebSockets** - Real-time bidirectional communication
- **Pandas/NumPy** - Data processing
- **Pytest** - Comprehensive testing (275+ tests)

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
│  • Strategy Engine                                          │
│  • Portfolio Manager                                        │
│  • SQLite/PostgreSQL Database                               │
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
| **n8n** | Workflow automation for Ops & Alerts | `workflows/alert_pipeline.json`, `docker-compose.yml` |
| **browser_extension** | Browser automation helpers | `manifest.json`, `content_scripts/scraper.js` |
| **cboe_pipeline** | Specialized Options Data Pipeline | `src/pipeline.py`, `analysis/volatility.py` |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** (3.12 recommended)
- **Node.js 18+** and npm
- **No API keys required** for default recorded data mode

### Installation

**1. Backend Setup:**

```bash
cd phase1

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**2. Frontend Setup:**

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build
```

**3. Start the System (Recorded + Paper Mode):**

**Terminal 1 - Backend (port 8090):**
```bash
cd phase1
source venv/bin/activate
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8090
```

**Terminal 2 - Frontend Preview (port 5100):**
```bash
cd frontend
npm run preview -- --port 5100 --host 0.0.0.0
```

### Access the Application

- **UI2 Frontend**: http://localhost:5100/ui2
- **Backend API**: http://localhost:8090
- **API Documentation**: http://localhost:8090/docs

### Optional: Elasticsearch Integration

Apex Terminal's search uses local/in-memory search by default. To enable Elasticsearch:

```bash
# In keys.env or environment
export SEARCH_PROVIDER=elastic
export ELASTICSEARCH_URL=http://localhost:9200
# ... add other Elasticsearch credentials if needed
```

**Note:** Elasticsearch is NOT required for core functionality or testing.

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

- **50,000+ lines of code**
- **35 Technical Indicators**
- **30+ Drawing Tools**
- **14 Dashboard Tiles**
- **5 Data Providers**
- **3 Built-in Strategies**
- **654 Automated Tests** (22 pytest + 112 Vitest + 520 Playwright E2E)
- **8 Major Service Modules**
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

- **Frontend**: React, TypeScript, Vite, Lightweight Charts, Tailwind CSS
- **Backend**: FastAPI, SQLAlchemy, WebSockets, Pandas, NumPy
- **Data**: Finnhub, Alpaca, Yahoo Finance
- **Testing**: Pytest, Playwright, Vitest

---

## 📝 License

[Add your license here]

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
