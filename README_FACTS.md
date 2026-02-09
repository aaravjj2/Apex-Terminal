# README FACTS — AUTHORITATIVE

## What this project IS
- A production-grade market workstation platform.
- A functional clone of TradingView's charting capabilities combined with Bloomberg-style analytics tiles.
- A simulation and paper-trading environment with deterministic historical replay.
- A complex microservices-based architecture (monorepo with distinct frontend and backend).

## What this project IS NOT
- A simple "create-react-app" demo or tutorial.
- A real-money execution platform for production use (currently focused on paper/simulation).
- A purely frontend project (requires heavy backend services for data ingestion and aggregation).
- A finished, bug-free commercial product (currently Phase 2, polishing ongoing).

## Current Features (shipped)
- **Advanced Charting**: Custom engine on Lightweight Charts, 35+ technical indicators, 30+ drawing tools.
- **Dashboard Workspace**: 14 configurable tiles including Watchlist, Scanner, Heatmap, and News.
- **Options Analytics**: Options Chain, Greeks Panel, and IV Surface visualization (integrated with Alpaca).
- **Replay Engine**: Tick-by-tick deterministic replay with speed control (0.5x - 10x).
- **Data Pipeline**: Real-time aggregation of ticks into OHLCV bars (1m to 1M timeframes).
- **Parity System**: SHA256 hashing of bars to verify data integrity between live and replay modes.

## Removed / Deprecated
- **Chart.js Filler Plugin**: Removed due to compatibility issues (referenced in test fix logs).
- **Legacy State Stores**: Some earlier Redux/Context approaches replaced by Zustand (`appStore`, `workspaceStore`).

## Planned (not implemented)
- **Live Real-Money Trading**: Fully automated execution on real accounts (infrastructure exists but focused on paper).
- **Full Autopilot**: "Market Open Autopilot" and AI agents are in codebase but not fully production-proven/integrated in UI.
- **Mobile Support**: Layouts are heavily optimized for desktop workstations.

## How to Run (authoritative)
- Backend:
  - command: `python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload` (run from `phase1` dir)
  - port: `8000`
- Frontend:
  - command: `npm run dev` (run from `frontend` dir)
  - port: `5100` (proxies API requests to 8000)

## Data Sources / APIs (actual)
- **Finnhub**: Real-time WebSocket streaming and REST historical data.
- **Alpaca**: Paper trading API, Options chain data, and real-time market data (IEX).
- **Yahoo Finance**: Historical data backfill (no auth required).
- **Mock**: CSV-based deterministic generator for testing and replay.

## Tech Stack (actual)
- **Frontend**: React 19.2, TypeScript 5.9, Vite, TailwindCSS, Zustand, Lightweight Charts.
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Pandas/NumPy, n8n (for workflows).
- **Database**: SQLite (dev), PostgreSQL (prod ready).
- **Testing**: Playwright (E2E), Pytest (Backend), Vitest (Unit).

## Known Limitations
- **Options Rendering**: The Options Workstation UI ("OptionsView") components are present in code but failing to render in tests/browser (active investigation).
- **Test Connectivity**: Automated tests often fail because they expect the backend to be running separately; no auto-spawn wrapper for tests.
- **Alpaca Live Feed**: Frontend currently relies on local backend proxy rather than direct Alpaca WebSocket connection for some feeds.
- **Browser Compatibility**: Optimized primarily for Chromium-based browsers (Playwright targets).
