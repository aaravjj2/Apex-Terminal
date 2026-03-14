# Apex Terminal

**A Bloomberg-style trading workstation built for serious retail traders.**

<div align="center">

[![React](https://img.shields.io/badge/React_19-61DAFB.svg?style=flat-square&logo=React&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat-square&logo=TypeScript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?style=flat-square&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python_3.10+-3776AB.svg?style=flat-square&logo=Python&logoColor=white)](https://python.org)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33.svg?style=flat-square&logo=Playwright&logoColor=white)](https://playwright.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Testing](#-testing) • [Roadmap](#-roadmap)

</div>

---

## Screenshots

![Trading](media/screenshots/trading.png)
![Autopilot](media/screenshots/autopilot.png)
![Portfolio](media/screenshots/portfolio.png)
![Options Chain](media/screenshots/options-chain.png)

<!-- Additional screenshots in media/screenshots/ -->

---

## Features

### Charting
- Candlestick chart powered by **lightweight-charts v5** — 1m, 5m, 15m, 1h, 1D timeframes
- **35 server-side technical indicators**: SMA, EMA, VWAP, RSI, MACD, Bollinger Bands, ATR, Ichimoku Cloud, Stochastic, OBV, MFI, and more
- Bloomberg-style dense dashboard with live KPIs and equity curve

### Autopilot
- Multi-signal **AI paper trading engine** — scans a configurable symbol universe, scores candidates, executes paper trades autonomously
- Full pipeline view: signal generation → candidate scoring → order execution → ledger
- Equity curve rendered via ApexAreaChart (lightweight-charts)

### Portfolio
- Live positions and P&L via Alpaca paper account
- Sharpe ratio, max drawdown, volatility KPIs from live performance data
- Equity curve with drawdown overlay

### Options
- Full options chain with Greeks: Delta, Gamma, Vega, Theta, Implied Volatility
- Powered by **Tradier API** (optional)

### Data & Order Management
- Right sidebar: Order ticket, live Watchlist, Positions, News feed, L2 depth, Time & Sales
- Live quotes via Alpaca; WebSocket tick streaming via Finnhub; yfinance as delayed fallback
- Batch quote endpoint for efficient multi-symbol updates

---

## Architecture

```
Browser (http://localhost:5100/ui2)
  │
  │  React 19 + Vite 5 + Zustand + lightweight-charts v5
  │  Tailwind CSS 4 · TypeScript · React Router 7
  │
  └─── HTTP / WebSocket ──────────────────────────────────────────────
                                                                      │
                              FastAPI  (http://localhost:8000)        │
                              phase1/services/api/main.py             │
                                                                      │
                         ┌────────────────────────────────────────────┘
                         │
             ┌───────────┼────────────────┬───────────────┐
             │           │                │               │
          Alpaca      Tradier          Finnhub         yfinance
     (broker + data) (options)      (WS ticks)      (delayed fallback)
                                                          │
                                                       SQLite
                                               (bars.db · autopilot_v3.db)
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Clone & configure

```bash
git clone https://github.com/aaravjj2/Apex-Terminal.git
cd Apex-Terminal
cp .env.example keys.env
# Edit keys.env — fill in APCA_API_KEY_ID and APCA_API_SECRET_KEY at minimum
```

### 2. Start the backend

```bash
cd phase1
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn services.api.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev                       # Runs on http://localhost:5100
```

Open **http://localhost:5100/ui2**.

---

## Environment Variables

Copy `.env.example` to `keys.env` in the project root. Full documentation is in that file.

| Variable | Required | Description |
|---|---|---|
| `APCA_API_KEY_ID` | Yes | Alpaca API key — enables live market data and paper trading |
| `APCA_API_SECRET_KEY` | Yes | Alpaca API secret |
| `APCA_ENDPOINT` | Yes | `https://paper-api.alpaca.markets` for paper trading |
| `FINNHUB_API_KEY` | Optional | Real-time news feed and WebSocket tick streaming |
| `TRADIER_BROKERAGE_KEY` | Optional | Options chain data with Greeks |
| `POLYGON_API_KEY` | Optional | Additional equities/options data source |

Get Alpaca paper trading keys free at [alpaca.markets](https://alpaca.markets).

---

## Testing

```bash
# TypeScript type check
cd frontend && npx tsc --noEmit

# Backend unit tests
cd phase1 && source venv/bin/activate
python -m pytest tests/unit/ --tb=short -q

# E2E tests (Playwright, 108 tests across 7 suites)
cd frontend
npx playwright test
```

Run suites sequentially — concurrent Playwright runs cause trace write conflicts.

Suites: `navigation`, `portfolio`, `chart-views`, `autopilot`, `autopilot-live`, `investor-personas`, `indicators-e2e`.

---

## Project Structure

```
Apex-Terminal/
├── frontend/                  # React 19 + TypeScript + Vite 5
│   ├── src/ui2/               # Active UI (pages, shell, stores, services, components)
│   │   └── components/chart/  # ApexChart.tsx + ApexAreaChart.tsx (lightweight-charts v5)
│   └── tests/e2e/             # Playwright test suites
├── phase1/                    # FastAPI backend
│   ├── services/api/          # Route handlers (market data, portfolio, options, autopilot)
│   ├── services/autopilot/    # Autopilot engine (unified_engine.py, brain_v3.py)
│   └── data/                  # bars.db SQLite database
├── media/screenshots/         # App screenshots
├── .env.example               # Environment variable reference
└── tasks.md                   # Full improvement roadmap
```

---

## Roadmap

Full detail in [tasks.md](tasks.md).

- **Sprint 2** — Autopilot WebSocket (replace 13 polling timers), candidate drill-down panel, config save/load
- **Sprint 3** — Docker Compose full-stack deployment, nginx reverse proxy, rate limiting, DB connection pooling
- **Sprint 4** — Volume histogram overlay, virtual scroll for large option chains, performance regression tests, AI signal quality improvements

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first. Ensure `npx tsc --noEmit` and `npx playwright test` pass before opening a PR.

## License

[MIT](LICENSE)
