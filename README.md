# Apex Terminal

<div align="center">

**A Production-Grade Market Workstation Platform**
*Built with Elastic Agent Builder — Combining TradingView-style charting with Bloomberg-terminal analytics and an ES|QL-powered Autonomous Options Agent.*

[**🏆 ELASTICSEARCH AGENT BUILDER HACKATHON SUBMISSION**](https://elasticsearch.devpost.com/)

[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/elastic?style=social)](https://x.com/elastic_devs)  *(Official hackathon social post link goes here: [X Post](https://x.com/your_handle/status/id) @elastic_devs @elastic)*

<img src="https://img.shields.io/badge/React-61DAFB.svg?style=flat-square&logo=React&logoColor=black" alt="React">
<img src="https://img.shields.io/badge/FastAPI-009688.svg?style=flat-square&logo=FastAPI&logoColor=white" alt="FastAPI">
<img src="https://img.shields.io/badge/Elasticsearch-005571.svg?style=flat-square&logo=Elasticsearch&logoColor=white" alt="Elastic">
<img src="https://img.shields.io/badge/Python-3776AB.svg?style=flat-square&logo=Python&logoColor=white" alt="Python">
<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat-square&logo=TypeScript&logoColor=white" alt="TypeScript">

[Features](#-key-features) • [Architecture](#-architecture) • [Directory Structure](#-directory-structure) • [Installation & Run](#-installation--run) • [Testing Stack](#-testing-stack)

</div>

---

### 🎯 Problem Statement & Solution Overview

**The Problem:** Financial quant tooling is incredibly fragmented. Retail traders rely on basic charting software, while elite institutional firms leverage massive, bespoke, deterministic systems (like the Bloomberg Terminal). Developing, testing, and dynamically scaling multi-agent AI workflows on massive financial time-series data requires assembling a custom tech stack from scratch, locking innovative but under-resourced traders out of advanced mathematical modeling.

**The Solution:** Apex Terminal securely bridges this gap. Breaking from fragmented retail environments, it seamlessly unites custom deterministic algorithmic backtesting, comprehensive technical analysis, and complete live market workflows inside a single unified Workstation natively powered by Elastic Agent Builder.

### Core Workspaces
- **Chart View (TradingView Clone):** Highly interactive graphical interface rendering OHLCV candles, real-time tick streaming, and a dock housing **35 technical indicators** and **30+ drawing tools**.
- **Bloomberg-Style Dashboard:** Deep analytics layout running 14 modular drag-and-drop tiles (Orders, Heatmaps, Options Chains, Volatility Surfaces, Scanners, P&L Metrics).
- **The AI Autopilot System (Elastic Agent Builder):** A heavily guarded multi-agent pipeline orchestrated natively using **Elastic Workflows** and **Agent Builder**. By wrapping external LLMs (Groq, Gemini) as Tools within the Elastic ecosystem, the Agent directly queries market data via **ES|QL**, evaluates pre-trade Risk Managers, and triggers execution layers based on dynamic semantic rulesets.

---

## ✨ Key Features Breakdown

### 🤖 Elastic Agent Builder Integration
Apex Terminal leverages the absolute bleeding edge of the Elastic AI stack to drive its autonomous decision systems:
- **Elastic Workflows:** Chains together distinct Sub-Agents (Risk Evaluator, Market Analyst, Compliance Officer) to process multi-step analysis without hallucination loops.
- **ES|QL Driven Memory:** Agents natively construct and execute ES|QL queries to rapidly aggregate historical option chains and spot volatility anomalies in runtime.
- **Hybrid Search (kNN + BM25):** The system stores all historical trades and strategy blueprints across 24 indices utilizing 64-dimensional `dense_vector` fields, ensuring Agents have perfect memory recall via Reciprocal Rank Fusion (RRF).

### 📊 35 Technical Indicators (Calculated server-side)
1. **Trend:** SMA, EMA, VWAP, Ichimoku Cloud, Supertrend, Parabolic SAR, ADX, Aroon
2. **Momentum:** RSI, MACD, Stochastic (Standard & RSI), CCI, ROC, Williams %R, TRIX, Price Velocity
3. **Volatility:** Bollinger Bands (incl. Width), ATR, Keltner Channels, Donchian Channels, Historic Vol (Rolling Methods)
4. **Volume:** OBV, MFI, CMF, ADL, VWMA, Force Index, Standard Profile
5. **Advanced Profiles:** VRVP, Anchored VWAP, VWAP StdDev Bands, Point of Control (POC), VAH/VAL TPOs

### 🧠 Auto-Pattern Recognition Engines
Apex Terminal natively tracks mathematical breakouts mapping them across the canvas:
- 35 standard candlestick patterns (Dojis, Haramis, Engulfings)
- Chart geometries (Triangles, Pennants, Wedges, Head & Shoulders)
- Deep Harmonics (ABCD retracements)
- Fibonacci suites, Gann fans, and Andrews' Pitchfork layouts

### 🔄 Execution Vectors (Paper Trading)
Runs purely deterministic integrations via REST and WebSockets using:
- **Alpaca API** for mock Portfolio margin validations and ledger synchronization.
- **Tradier API** for live options chains and Greek metric extrapolations (Delta, Gamma, Vega).

---

## 🏗 System Architecture

Apex utilizes a multi-engine `FastAPI` back end connected statically directly to `React 19`. Bar aggregates and executions run entirely independent of the UI logic, supporting safe autonomous headless deployments alongside `n8n`.

```text
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
│  • Chart Workspace / Dashboard / Autopilot Monitors         │
│  • Zustand State Management & Lightweight Charts Canvas     │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP / WebSockets
┌───────────────────────▼─────────────────────────────────────┐
│                    BACKEND (FastAPI - phase1)               │
│  • 27 Engines (Risk, Backtests, Sizing, Pattern Checks)     │
│  • Parity & Verification Tracker (HMAC-SHA256 audits)       │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│               ELASTIC AGENT BUILDER (Core)                  │
│  • Workflows connecting LLMs as specialized Sub-Agents      │
│  • ES|QL query generation for advanced runtime analytics    │
│  • 24 active indices (tickets, workflows, compliance)       │
│  • dense_vector (64-dim, cosine) & Hybrid (kNN + RRF)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```text
Tradingview recreation/
├── frontend/             # React 19 + TypeScript + Vite UI Application
├── phase1/               # Python/FastAPI Backend Services & Core Engines
├── n8n/                  # Dockerized workflow automations (Intraday Scans, Alerts)
├── scripts/              # Independent root-level execution and utility scripts
├── media/                # Application screenshots and playback videos
├── devpost_submission_materials/ # Dedicated PDF briefs and Business Plans for Hackathons
├── documents/            # Architectural plans, gap analysis, status trackers
├── logs/                 # Isolated system execution logs and output traces
├── data/                 # Evaluation outputs, cache, SQLite/DuckDB bases
├── judge_system/         # Standalone system evaluators and test harnesses
├── strategies/           # Specialized built-in algorithms (SMA, VWAP, Breakout)
└── archives/             # Compressed submission bundles and backup artifacts
```

---

## 🏗 Future Scope / Roadmap

- **Phase 1 (Current):** Open-source deterministic FastAPI architecture, 35 technical indicators, and full React frontend. Live market tracking (paper trading) via Alpaca.
- **Phase 2 (Enterprise):** Introduce multi-tenant workspaces, cloud-hosted Elasticsearch clusters, and deep PCA/Monte Carlo backtesting visualizations directly within the UI.
- **Phase 3 (SaaS Scale):** Establish public LLM Sub-Agent marketplaces allowing users to drag-and-drop proprietary Groq/Gemini logic into rigid Elastic workflows.

---

## 📚 Libraries, Datasets & Tools Used

To maintain rigorous production quality, Apex integrates the following open-source frameworks and API providers:
- **Core Orchestration:** Elastic Agent Builder, Elasticsearch (v8.x), FastAPI, Uvicorn, n8n.
- **Frontend Stack:** React 19.2, TypeScript, Vite, Tailwind CSS, Zustand.
- **Charting Engine:** TradingView Lightweight Charts, Recharts.
- **Data Providers:** Alpaca (Market Data & Brokerage), Tradier (Live Options Chains), Finnhub, Yahoo Finance.
- **AI Models:** Groq (Llama 3 8B/70B), Google Gemini 1.5 Pro.

---

## 🚀 Installation & Run

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & npm
- **Elasticsearch 8.x** running locally on port `9200`

### 1. Configuration (Environment keys)
Create a `keys.env` file in the root based off `keys.env.example` to attach the system to live data pipes.

```env
# Example keys.env
APCA_API_KEY_ID=your_alpaca_key_id_here
APCA_API_SECRET_KEY=your_alpaca_secret_key_here
APCA_ENDPOINT=https://paper-api.alpaca.markets
TRADIER_BROKERAGE_KEY=your_tradier_key_here
```

### 2. Start the Backend (`phase1`)
```bash
cd phase1
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start FastAPI Uvicorn engine
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000
```
> **Notice:** Start Elasticsearch prior to triggering the backend router to avoid connection dropping. Verify ES via `curl http://localhost:9200/_cluster/health`.

### 3. Start the Frontend (`frontend`)
```bash
cd frontend
npm install
npm run build
npm run preview -- --port 5100 --host 0.0.0.0
```

### 🔗 Application Access:
- **UI Terminal:** `http://localhost:5100/ui2`
- **Backend API Docs:** `http://localhost:8000/docs`

---

## 🧪 Testing Stack

The project operates under a strict testing guideline and maintains a **0 skipped, 0 failed** policy across active branches. Verification ensures deterministic replays (`Parity System` using SHA256 hashes against all parsed tick data) and safety net thresholds aren't breached.

**Test Coverage (2143+ Assertions):**
- **Unit and Integration (Backend):** `Pytest` running from `phase1/tests/unit/` isolating exact computational engine behavior.
- **Unit (Frontend):** `Vitest` testing hooks and state synchronizations.
- **E2E & UI Parity (Frontend):** `Playwright` workflows running headless/headed verifying interactions within the Dashboard widgets and executing test buys.

#### Run the Test Suite
```bash
# Backend Test Harness
cd phase1 && source venv/bin/activate
python -m pytest tests/unit/ --tb=short -q

# Frontend DOM and Integration Harness
cd frontend
npx vitest run          # Run Unit tests
npx playwright test     # Run E2E Workflows 
```

---
*Developed as a premier institutional-grade simulation interface.*
