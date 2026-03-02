# Getting Started with Apex Terminal

> Your first steps into professional-grade financial analytics and trading.

Apex Terminal is a comprehensive financial analytics and trading platform featuring real-time charting, order management, portfolio optimization, backtesting, and Bloomberg-style terminal commands — all in a modern React-based interface.

---

## Table of Contents

1. [Welcome](#welcome)
2. [First-Time Setup](#first-time-setup)
3. [Navigating the Interface](#navigating-the-interface)
4. [Key Features Overview](#key-features-overview)
5. [Quick Tour](#quick-tour)
6. [Next Steps](#next-steps)

---

## Welcome

Apex Terminal brings institutional-quality tools to every trader and analyst. Whether you are monitoring equities, analyzing options Greeks, running backtests, or screening for setups, everything lives in a single unified workspace.

**What you'll learn in this guide:**

- How to launch the platform for the first time
- How the interface is organized
- Where to find the most important features

---

## First-Time Setup

1. Ensure the development server is running on **port 5100** and the FastAPI backend on **port 8000** (see [Installation Guide](INSTALLATION.md) for details).
2. Open your browser and navigate to `http://localhost:5100`.
3. On first load the platform initializes default workspace layouts and theme settings.
4. You will land on the **Dashboard** — the central hub for market overview, watchlists, and quick access panels.

> **Tip:** Press `Ctrl+K` at any time to open the Bloomberg-style command bar for rapid navigation.

---

## Navigating the Interface

The UI is divided into several primary zones:

| Area | Purpose |
|------|---------|
| **Top Bar** | Symbol search, timeframe selector, theme toggle, workspace switcher |
| **Sidebar** | Watchlist, scanner, alerts, news feed |
| **Main Canvas** | Charts, order blotter, portfolio view — configurable via panels |
| **Bottom Bar** | Status indicators, connection health, active alerts count |
| **Command Bar** | Bloomberg-style terminal (Ctrl+K) for keyboard-driven workflows |

Panels are powered by `react-resizable-panels` — drag borders to resize, right-click headers to add or remove panels.

![Interface Overview](../assets/screenshots/interface-overview.png)

---

## Key Features Overview

- **Charting** — 7 chart types, 35+ technical indicators, 70+ drawing tools
- **Order Management** — Market, limit, stop, bracket, and OCO orders
- **Options Analytics** — Black-Scholes pricing, Greeks, payoff diagrams
- **Portfolio Management** — Markowitz optimization, risk attribution
- **Backtesting** — Walk-forward analysis, equity curves, optimization
- **Risk Analytics** — Value-at-Risk (VaR), stress testing, drawdown analysis
- **Screener & Scanner** — Fundamental and technical filters with real-time scanning
- **Bloomberg Terminal Mode** — Command-line navigation via `Ctrl+K`
- **Alerts** — Price, indicator, and volume-based notifications
- **Themes** — Dark, Light, and Midnight palettes

---

## Quick Tour

### Dashboard

The dashboard shows your watchlist, market movers, portfolio summary, and recent alerts at a glance. Click any symbol to open its chart.

![Dashboard Screenshot](../assets/screenshots/dashboard.png)

### Chart View

Switch to the chart by clicking a symbol or using the command bar (`Ctrl+K` → type the ticker). Use the toolbar on the left for drawing tools and the indicator menu at the top to overlay studies.

![Chart Screenshot](../assets/screenshots/chart-view.png)

### Trading Panel

Open the order ticket from the chart context menu or press `Shift+T`. Select order type, set quantity and price, then submit. Active orders appear in the blotter below the chart.

![Trading Panel Screenshot](../assets/screenshots/trading-panel.png)

### Workspace Switching

Click the workspace dropdown in the top bar to switch between saved layouts — or create a new one. Layouts persist across sessions via IndexedDB.

> **Note:** Use `Ctrl+Shift+1` through `Ctrl+Shift+5` to quickly toggle between your first five saved workspaces.

---

## Next Steps

| Guide | What You'll Learn |
|-------|-------------------|
| [Installation](INSTALLATION.md) | Full setup and environment configuration |
| [First Trade](FIRST_TRADE.md) | Place your first order step by step |
| [Chart Tutorial](CHART_TUTORIAL.md) | Master charting tools and indicators |
| [Bloomberg Commands](BLOOMBERG_COMMANDS.md) | Keyboard-driven terminal workflows |
| [Workspace Tutorial](WORKSPACE_TUTORIAL.md) | Build custom multi-panel layouts |

---

*Apex Terminal — Professional analytics, accessible to everyone.*
