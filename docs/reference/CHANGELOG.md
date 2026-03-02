# Changelog

All notable changes to Apex Terminal are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Table of Contents

- [1.0.0 — Production Release](#100--2026-02-15)
- [0.9.x — Social & Collaboration](#09x)
- [0.8.x — Machine Learning](#08x)
- [0.7.x — Bloomberg Mode](#07x)
- [0.6.x — Backtesting Engine](#06x)
- [0.5.x — Portfolio Management](#05x)
- [0.4.x — Options Analytics](#04x)
- [0.3.x — Trading Engine](#03x)
- [0.2.x — Technical Indicators](#02x)
- [0.1.x — Foundation](#01x)

---

## [1.0.0] — 2026-02-15

Production-ready release of Apex Terminal.

### Added
- Comprehensive documentation suite (15 reference files, architecture guides, API docs)
- Visual regression testing with Playwright and pixelmatch
- Performance budgets enforced in CI (LCP < 1.5s, bundle < 500KB)
- Onboarding tutorial flow for new users

### Changed
- Upgraded React 19 to stable release, TypeScript 5.9, Vite 5
- Replaced custom state selectors with Zustand v5 `useShallow`
- Final UI polish pass across all components

### Fixed
- Memory leak in WebSocket reconnection logic
- Chart flickering during rapid timeframe switching
- Options chain loading timeout on high-strike-count underlyings

---

## 0.9.x

### [0.9.0] — 2026-01-20

### Added
- Social trading feed with follow/copy-trade functionality
- User profiles with public portfolios and track records
- Shared chart layouts with permalink support
- Community watchlists and idea sharing
- Real-time collaboration cursors on shared charts

### Fixed
- Race condition in alert notification delivery
- News sentiment score calibration drift

---

## 0.8.x

### [0.8.0] — 2025-12-10

### Added
- ML prediction engine (`lib/ml/`) with LSTM and random forest models
- Anomaly detection for unusual volume/price patterns
- Sentiment analysis pipeline using transformer embeddings
- Feature importance visualization for ML models
- Model training and evaluation dashboard

### Changed
- Moved heavy ML computations to dedicated Web Worker (`mlWorker.ts`)

---

## 0.7.x

### [0.7.0] — 2025-11-01

### Added
- Bloomberg-style terminal mode with 9 command components
- Bloomberg function parser supporting 40+ commands (DES, GP, FA, BQ, PORT, etc.)
- Terminal autocomplete with fuzzy matching
- Command chaining with `&&` operator
- Bloomberg-style color scheme and typography

### Changed
- Refactored command palette (cmdk) to support Bloomberg command syntax
- Unified search across symbols, functions, and settings

---

## 0.6.x

### [0.6.0] — 2025-09-25

### Added
- Backtesting engine (`lib/backtest/`) with event-driven architecture
- Strategy builder with visual drag-and-drop conditions
- Backtest results dashboard (equity curve, drawdown, trade log)
- Walk-forward optimization with parameter sweeps
- Backtest Web Worker for non-blocking execution

### Changed
- Extended indicator library to support historical-only computation mode

### Fixed
- VWAP reset logic at session boundaries

---

## 0.5.x

### [0.5.0] — 2025-08-15

### Added
- Portfolio management dashboard with real-time P&L
- Brinson performance attribution (allocation, selection, interaction)
- Risk analytics panel (VaR, CVaR, Sharpe, Sortino, drawdown)
- Sector and asset class allocation heat map
- Portfolio rebalancing tool with target weight editor

### Changed
- Consolidated position and P&L computation into `portfolioStore`

---

## 0.4.x

### [0.4.0] — 2025-07-01

### Added
- Options analytics module (`lib/options/`)
- Black-Scholes pricing with full Greeks calculation
- Binomial tree model for American options
- Monte Carlo simulator for exotic payoffs
- Implied volatility solver (Newton-Raphson with bisection fallback)
- 3D volatility surface visualization
- Options chain viewer with Greeks overlay
- Options P&L diagram (payoff chart)

---

## 0.3.x

### [0.3.0] — 2025-05-20

### Added
- Order entry panel (market, limit, stop, stop-limit)
- Order management system with modify/cancel
- Position tracker with unrealized/realized P&L
- Bracket orders (SL + TP) and OCO support
- Trade blotter with fill history
- Paper trading mode with simulated fills
- Order execution Web Worker

### Changed
- Added WebSocket channels for order status updates

---

## 0.2.x

### [0.2.0] — 2025-04-10

### Added
- 27 technical indicators across 6 categories
  - Momentum: RSI, MACD, Stochastic, CCI, Williams %R, ROC
  - Moving Averages: SMA, EMA, WMA, DEMA, TEMA, VWAP, HMA
  - Volatility: Bollinger Bands, ATR, Keltner Channel, Donchian Channel, Std Dev
  - Volume: OBV, MFI, AD, CMF
  - Trend: ADX, Aroon, Ichimoku, Parabolic SAR, Supertrend
  - Patterns: candlestick pattern recognition engine
- Indicator parameter customization panel
- Multi-indicator overlay on a single chart
- Indicator computation Web Worker

### Changed
- Moved all indicator math to `lib/indicators/` for testability

---

## 0.1.x

### [0.1.0] — 2025-03-01

### Added
- Project scaffolding: React 19, TypeScript, Vite 5, Tailwind v4
- Interactive candlestick chart using lightweight-charts
- Real-time market data via WebSocket with reconnection
- Symbol search with fuzzy matching
- Watchlist with drag-and-drop reordering
- Resizable multi-panel layout (react-resizable-panels)
- Dark/light theme with system preference detection
- Zustand state management (initial stores)
- Client-side routing with react-router-dom v7
- Icon system via lucide-react
- Base test setup with Vitest

---

## Migration Notes

### Upgrading from 0.x to 1.0

1. Run `npm install` to pick up dependency version bumps.
2. Clear IndexedDB storage (`Settings → Storage → Clear`) — schema changed in 0.8.
3. Saved layouts from < 0.7 are automatically migrated on first load.
4. Custom keyboard bindings from < 0.5 require re-export/import.

---

*For detailed commit history, see `git log --oneline`.*
