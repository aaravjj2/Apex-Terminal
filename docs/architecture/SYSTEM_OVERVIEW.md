# System Overview

> High-level architecture of the Apex Terminal platform — a professional-grade financial analytics and trading system built with React 19, TypeScript, and a FastAPI backend.

---

## Table of Contents

- [Platform Vision](#platform-vision)
- [Architecture Layers](#architecture-layers)
- [Technology Stack](#technology-stack)
- [Module Map](#module-map)
- [Data Flow Summary](#data-flow-summary)
- [Deployment Topology](#deployment-topology)
- [Key Design Decisions](#key-design-decisions)

---

## Platform Vision

Apex Terminal is a Bloomberg-class trading and analytics platform delivered as a single-page web application. It provides institutional-quality charting, order management, risk analytics, portfolio construction, options pricing, backtesting, and real-time market data — all running in the browser with Web Worker offloading for CPU-intensive tasks.

### Core Capabilities

| Domain | Capabilities |
|--------|-------------|
| **Charting** | 35+ indicators, 70+ drawing tools, 7 chart types (candlestick, Heikin-Ashi, Renko, Kagi, Point & Figure, Line Break, Equivolume) |
| **Trading** | Order ticket, execution algorithms (TWAP/VWAP), bracket/OCO orders, smart routing |
| **Options** | Black-Scholes, binomial pricing, Greeks, IV surface, strategy builder |
| **Portfolio** | Markowitz optimization, Black-Litterman, Brinson attribution, factor models |
| **Risk** | VaR (historical/parametric/Monte Carlo), stress testing, credit risk, regulatory metrics |
| **Backtesting** | Walk-forward analysis, Monte Carlo simulation, parameter sweeps, optimization |
| **ML** | Anomaly detection, clustering, linear models, decision trees, time series forecasting |
| **Bloomberg Mode** | Command line, security finder, formula grid, monitor grid, launchpad |

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│  React 19 · Tailwind v4 · lightweight-charts · Recharts  │
├─────────────────────────────────────────────────────────┤
│                    State Management                       │
│  Zustand stores · Immer middleware · Event Bus            │
├─────────────────────────────────────────────────────────┤
│                    Feature Modules                        │
│  50+ feature modules (chart, options, backtest, risk...) │
├─────────────────────────────────────────────────────────┤
│                    Core Libraries                         │
│  Indicators · Drawing · Orders · Portfolio · Risk · ML    │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                             │
│  API Client · WebSocket Client · IndexedDB · Workers      │
├─────────────────────────────────────────────────────────┤
│                    Backend Services                       │
│  FastAPI · WebSocket Gateway · Market Data Feeds          │
└─────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **Presentation** — React components render the UI. Tailwind provides styling. Chart libraries handle canvas rendering. The `ui2/` module contains 223+ page components and 150+ routes.

2. **State Management** — Zustand stores (11 core + 26 in ui2) manage application state with Immer for immutable updates. An event bus enables decoupled cross-module communication.

3. **Feature Modules** — Self-contained feature slices under `features/` encapsulate domain logic, UI, and state for specific capabilities (options risk desk, backtest lab, etc.).

4. **Core Libraries** — Pure TypeScript computation libraries under `lib/` handle indicator math, options pricing, risk calculations, ML models — all framework-agnostic.

5. **Data Layer** — The API client handles HTTP with retry/caching/auth. WebSocket provides real-time streams. Web Workers offload heavy computation. IndexedDB persists local data.

6. **Backend** — FastAPI on port 8000 serves REST endpoints and WebSocket connections, proxied through Vite's dev server at `/api` and `/ws`.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.x |
| Language | TypeScript | 5.9 |
| Build Tool | Vite | 5.x |
| State | Zustand + Immer | Latest |
| Styling | Tailwind CSS | 4.x |
| Charts | lightweight-charts, Recharts, Chart.js | Various |
| Routing | react-router-dom | 7.x |
| Command Palette | cmdk | Latest |
| Layout | react-resizable-panels | Latest |
| Icons | lucide-react | Latest |
| Unit Testing | Vitest | Latest |
| E2E Testing | Playwright | Latest |
| Backend | FastAPI (Python) | Latest |

---

## Module Map

```
frontend/src/
├── api/              # 17 API client modules
├── components/       # Reusable UI components
│   ├── bloomberg/    # Bloomberg-style terminal widgets
│   ├── charts/       # Analytics and advanced chart components
│   ├── pages/        # Full-page views
│   ├── shared/       # Shared primitives (Skeleton, EmptyState)
│   └── trading/      # Trading-specific UI
├── core/             # ChartEngine, Scales, core types
├── data/             # ApiClient, WebSocketClient, ClockClient
├── features/         # 50+ self-contained feature modules
├── hooks/            # 25 custom React hooks
├── lib/              # 117 pure computation libraries
├── stores/           # 11 Zustand stores
├── ui2/              # Primary UI layer (223+ pages, routes)
├── workers/          # 5 Web Workers
└── tests/            # Unit (30+), E2E (204), integration
```

---

## Data Flow Summary

```
Market Data Feed → WebSocket Gateway → WebSocket Client
                                            ↓
                                    Zustand Stores
                                     ↙         ↘
                              Workers          React Components
                           (indicators,           ↓
                            backtest,        Rendered UI
                            screening)
```

1. Real-time data arrives via WebSocket from the FastAPI backend
2. The WebSocket client dispatches updates to Zustand stores
3. React components subscribe to store slices and re-render
4. CPU-intensive work (indicator calculations, backtests, screening) is offloaded to Web Workers
5. User actions flow back through API calls or WebSocket messages

---

## Deployment Topology

```
Browser ←→ CDN (Static Assets)
   ↕
Vite Dev Server (port 5100)
   ↕ proxy /api, /ws
FastAPI Backend (port 8000)
   ↕
Market Data Providers / Databases
```

- **Development**: Vite dev server with HMR proxies API calls to FastAPI
- **Production**: Static build served via CDN, API calls to deployed FastAPI instances
- **Git SHA**: Injected at build time via `VITE_GIT_SHA` for version tracking

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **React 19** | Concurrent features, improved Suspense, automatic batching |
| **Zustand over Redux** | Simpler API, less boilerplate, excellent TypeScript support |
| **Web Workers** | Offload heavy math to prevent UI jank during indicator/backtest calculations |
| **Feature modules** | Encapsulation enables independent development and lazy loading |
| **Tailwind v4** | Design token system, JIT compilation, zero-runtime CSS |
| **lightweight-charts** | High-performance financial charting with Canvas rendering |
| **Vite** | Fast HMR, ESM-native, optimized production builds |
| **cmdk** | Keyboard-first command palette for Bloomberg-style workflows |
