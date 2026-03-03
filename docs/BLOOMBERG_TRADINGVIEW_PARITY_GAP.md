# Apex Terminal vs Bloomberg Terminal vs TradingView — Feature Parity Gap Analysis

> Comprehensive comparison of what exists, what's missing, and what needs major improvement.
> Based on full codebase audit and tasks.md.

---

## Executive Summary

| Platform | Primary Focus | Apex Status |
|----------|---------------|-------------|
| **Bloomberg Terminal** | Institutional data, analytics, execution (EMSX/TOMS), fixed income, FX, commodities, risk (MARS) | Partial coverage; strong on UI shell, weak on asset-class depth |
| **TradingView** | Retail charting, drawing tools, indicators, strategy backtesting, social, paper trading | Partial coverage; chart types and drawings exist in lib but UI wiring incomplete |

**Key gap:** Apex has substantial *library* and *backend* code (chart-types, drawing-tools, order-types, indicators-extended, etc.) but much of it is **not fully wired into the live UI** or is implemented at a **basic** level.

---

## PART 1 — MISSING FEATURES

### 1.1 Chart Types (vs TradingView's 20+)

| Feature | TradingView | Bloomberg GP | Apex Status |
|---------|-------------|--------------|-------------|
| Tick charts | ✓ | Limited | **MISSING** |
| Volume Profile (visible range) | ✓ (TPO, SVP) | Limited | Lib exists, **UI MISSING** |
| Footprint charts | ✓ (Volume footprint) | No | Lib exists, **UI MISSING** |
| Market Profile (TPO) | ✓ | No | Lib exists, **UI MISSING** |
| Equivolume | ✓ | No | Lib exists, **UI MISSING** |
| Baseline chart | ✓ | No | Lib exists, **UI MISSING** |
| Step line | ✓ | ✓ | **MISSING** |
| Line with markers | ✓ | ✓ | **MISSING** |
| HLC area chart | ✓ | No | **MISSING** |
| Volume candle chart | ✓ | No | **MISSING** |
| Column chart (economic) | ✓ | Limited | **MISSING** |
| TPO chart (standalone) | ✓ | No | **MISSING** |
| SVP chart (Session Volume Profile) | ✓ | No | **MISSING** |

**Note:** P&F, Kagi, Line Break, Renko, Range Bars exist in both lib and UI (partially wired).

---

### 1.2 Multi-Chart Layouts (vs TradingView & Bloomberg)

| Feature | TradingView | Bloomberg | Apex Status |
|---------|-------------|-----------|-------------|
| Split 2/4/6/8 panels | ✓ | ✓ (Launchpad) | **Partial** (MultiChartLayoutUI2 exists, sync limited) |
| Synchronized crosshair across charts | ✓ | ✓ | **MISSING** (chartStore has flags, not fully implemented) |
| Symbol/timeframe sync | ✓ | ✓ | **MISSING** |
| Tabbed chart workspaces | ✓ | ✓ | **MISSING** |
| Floating chart windows | ✓ | ✓ | **MISSING** |
| Chart templates (save/load) | ✓ | Limited | **MISSING** |

---

### 1.3 Drawing Tools (vs TradingView's 70+)

| Category | TradingView | Apex Lib | Apex UI | Gap |
|----------|-------------|----------|---------|-----|
| **Patterns** | Elliott Wave, H&S, ABCD, XABCD, Three Drives, Triangle, Cypher, Cyclic Lines | Few (in lib) | **MISSING** | All pattern tools |
| **Forecasting** | Projection, Ghost Feed, Bars Pattern, Forecast | Partial | **MISSING** | Full forecasting tools |
| **Volume-based drawings** | Anchored VWAP, Fixed Range VP, Anchored VP | No | **MISSING** | All volume drawings |
| **Annotation** | Comment, Callout, Table, Note, Anchored Text, Price Note, Pin, Flag, Image | Text, Note | **Partial** | Table, Pin, Flag, Image |
| **Icons/Emojis** | Emojis, stickers, icons | No | **MISSING** | All |
| **Magnets** | Snap to OHLC, snap to indicators | No | **MISSING** | Full magnet mode |
| **Lock/Hide drawings** | Per-drawing lock, hide all | No | **MISSING** | All |
| **Sync across layouts** | ✓ | No | **MISSING** | Full sync |
| **Rotated rectangle** | ✓ | No | **MISSING** | Shape |
| **Path / Double curve** | ✓ | No | **MISSING** | Shapes |
| **Trend Angle** | ✓ | No | **MISSING** | Line variant |
| **Pitchfan, Fib Wedge, Fib Arcs, Fib Spiral, Fib Circles** | ✓ | Most in lib | **Partial** (lib wired to DrawingLayer) | UI polish |
| **Measure tool** | ✓ (distance, %, bars) | Lib has Measure | **Partial** | Full UI |
| **Zoom tool** | ✓ | No | **MISSING** | Dedicated zoom tool |

**Note:** Apex has 39 tools in `drawing-tools.ts` and ~26 in DrawingToolbar. DrawingLayer uses `getDrawingTool()` for some; toolbar is hardcoded, not lib-driven.

---

### 1.4 Technical Indicators (vs TradingView 100+)

| Category | TradingView | Apex IndicatorRegistry | Apex indicators-extended | Gap |
|----------|-------------|------------------------|---------------------------|-----|
| Moving averages | SMA, EMA, WMA, DEMA, TEMA, Hull, VWMA, KAMA, ALMA, FRAMA, T3 | ~60 via API | 80+ client | **API-only; no client fallback in chart** |
| Pattern recognition | 40+ candlestick, chart patterns | Few | patterns.ts | **MISSING** full catalog |
| Custom formula builder | Pine Script | No | No | **MISSING** |
| Multi-timeframe indicators | ✓ | Limited | Limited | **MISSING** |
| Breadth (McClellan, A/D, TRIN) | ✓ | No | No | **MISSING** |

---

### 1.5 Chart Interaction

| Feature | TradingView | Bloomberg | Apex Status |
|---------|-------------|-----------|-------------|
| Crosshair with rich data tooltip | ✓ | ✓ | **Partial** (basic) |
| Measure tool (price change, bars) | ✓ | Limited | **MISSING** full UI |
| Screenshot/Export chart | ✓ | ✓ (PDF, image) | **MISSING** |
| Print chart | ✓ | ✓ | **MISSING** |
| Chart overlay comparison (multiple symbols) | ✓ | ✓ | **MISSING** |
| Price scale: log, %, auto/fixed | ✓ | ✓ | **Partial** |
| Right-click context menu | ✓ | ✓ | **Partial** |
| 60+ keyboard shortcuts | ✓ | ✓ | **Partial** (docs exist, coverage incomplete) |
| Touch/gesture support | ✓ | Limited | **MISSING** |
| Go-to date/time | ✓ | ✓ | **MISSING** |
| Bookmark timestamps | ✓ | No | **MISSING** |

---

### 1.6 Order Management (vs Bloomberg EMSX/TOMS & TradingView)

| Feature | Bloomberg | TradingView | Apex Status |
|---------|------------|-------------|-------------|
| IOC, FOK, GTD | ✓ | Limited | **Lib exists, UI MISSING** |
| MOO, MOC, LOO, LOC | ✓ | No | **Lib exists, UI MISSING** |
| Peg orders (midpoint, market) | ✓ | No | **Lib exists, UI MISSING** |
| Bracket order (TP + SL) | ✓ | ✓ | **Partial** (TradingUI2 has bracket) |
| OCO, OTO | ✓ | Limited | **MISSING** |
| Iceberg/Reserve | ✓ | Limited | **Lib exists, UI MISSING** |
| Execution algos: TWAP, VWAP, POV, Dark Pool, SOR | ✓ (EMSX) | No | **Lib exists, UI Partial** (TradingUI2 has algo select) |
| Pre-trade compliance | ✓ (TOMS) | No | **MISSING** |
| TCA (Transaction Cost Analysis) | ✓ | No | **Lib exists (tca.ts), UI MISSING** |
| Best execution reporting | ✓ | No | **MISSING** |

---

### 1.7 Order Book & Market Depth (vs Bloomberg)

| Feature | Bloomberg | Apex Status |
|---------|-----------|-------------|
| Level 2 display | ✓ | **Partial** (L2OrderBookPanel, OrderBookDepthUI2) |
| Order book heatmap | ✓ | **MISSING** |
| Order flow / trade reconstruction | ✓ | **MISSING** |
| Volume at price | ✓ | **MISSING** |
| Order book imbalance indicators | ✓ | **MISSING** |
| Market microstructure analytics | ✓ | **MISSING** |
| level2_processor.py | N/A | **Exists but not fully wired to UI** |

---

### 1.8 Backtesting (vs TradingView Strategy Tester)

| Feature | TradingView | Apex Status |
|---------|-------------|-------------|
| Visual strategy builder (drag-and-drop) | ✓ | **MISSING** |
| Pine Script–equivalent (code editor) | ✓ | **Partial** (strategy panels) |
| Pre-built strategy templates (20+) | ✓ | **MISSING** |
| Tick-level precision | ✓ | **Partial** (v5_engine exists) |
| Walk-forward analysis | ✓ | **Partial** (backend) |
| Monte Carlo simulation | ✓ | **Partial** (backend) |
| Optimization heatmaps | ✓ | **MISSING** |
| Parameter sensitivity / overfitting detection | ✓ | **MISSING** |

---

### 1.9 Options Analytics (vs Bloomberg OMON, OVME, MARS)

| Feature | Bloomberg | Apex Status |
|---------|-----------|-------------|
| Full chain, OI, IV, Greeks | ✓ | **Partial** (OptionsChainUI2, VolSurfaceUI2) |
| IV surface 3D, smile, term structure | ✓ | **Partial** |
| Multi-leg strategy constructor | ✓ | **Partial** |
| Pre-built strategies (Iron Condor, Jade Lizard, etc.) | ✓ | **MISSING** full set |
| SABR, GARCH, exotic pricing | ✓ | **Lib exists, UI MISSING** |

---

### 1.10 Fixed Income (Bloomberg-only)

| Feature | Bloomberg | Apex Status |
|---------|-----------|-------------|
| Bond pricing, YTM, duration, convexity | ✓ | **MISSING** |
| Yield curves, OAS, Z-spread | ✓ | **MISSING** |
| FixedIncomePanel, YieldCurveChart | N/A | **Components exist, limited wiring** |

---

### 1.11 FX, Commodities, Crypto

| Asset Class | Bloomberg | TradingView | Apex Status |
|-------------|-----------|-------------|-------------|
| FX analytics (forwards, options) | ✓ | Limited | **MISSING** |
| Commodity curves, roll yield | ✓ | Limited | **MISSING** |
| Crypto (multi-exchange, on-chain) | Limited | ✓ | **MISSING** |

---

### 1.12 News, Research, Social

| Feature | Bloomberg | TradingView | Apex Status |
|---------|------------|-------------|-------------|
| Real-time news feed, symbol news | ✓ | ✓ | **Partial** (NewsTerminalUI2) |
| News sentiment, impact analysis | ✓ | Limited | **MISSING** |
| Social (ideas, comments, follow) | No | ✓ | **MISSING** |
| Analyst consensus, earnings | ✓ | Limited | **MISSING** |

---

### 1.13 Screening & Scanning

| Feature | TradingView | Apex Status |
|---------|-------------|-------------|
| Fundamental + technical filters | ✓ | **Partial** (StockScreenerUI2) |
| Custom formula filters | ✓ | **MISSING** |
| Real-time scanner (breakouts, volume) | ✓ | **Partial** |
| Unusual options activity | ✓ | **MISSING** |
| Backtesting screens | ✓ | **MISSING** |

---

### 1.14 Alerts & Notifications

| Feature | TradingView | Apex Status |
|---------|-------------|-------------|
| Price, indicator, drawing cross alerts | ✓ | **Partial** |
| Webhook, SMS, email delivery | ✓ | **MISSING** |
| Alert on screen changes | ✓ | **MISSING** |
| News/economic event alerts | ✓ | **MISSING** |

---

### 1.15 Platform Infrastructure

| Feature | Apex Status |
|---------|-------------|
| Sub-100ms chart render | **Unknown** |
| WCAG 2.1 AA | **MISSING** |
| Workspace save/load | **Partial** |
| Keyboard shortcut customization | **MISSING** |
| BQL-style query editor | **MISSING** |

---

## PART 2 — FEATURES NEEDING MAJOR IMPROVEMENTS

### 2.1 Chart Engine

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| P&F, Kagi, Line Break in UI | Converted to candlestick-like; not native P&F/Kagi rendering | **Native rendering** for P&F (X/O columns), Kagi (segments), Line Break (blocks) |
| Volume profile, Footprint, Market Profile | Lib only; no UI | **Full UI** with proper pane layout |
| Indicator fallback | Chart uses API only; indicators-extended not used on failure | **Wire indicators-extended** as client-side fallback |
| Lightweight-charts | Single library; no tick chart support | **Evaluate** tick aggregation or alternative for tick charts |

---

### 2.2 Drawing Tools

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| DrawingToolbar | 26 tools hardcoded; not driven by drawing-tools.ts | **Drive toolbar from lib** (single source of truth) |
| DrawingLayer → getDrawingTool | Works for some tools; viewport/coord mapping may be wrong | **Validate** coordinate transform (time/price ↔ pixels) |
| Hit testing | Lib has hitTest; DrawingLayer uses simple point-in-rect | **Full hitTest** for selection, resize, move |
| Serialization | toJSON/fromJSON in lib | **Persist to backend** (/api/v1/drawings), load on chart open |
| Keep drawing mode | No | **Add** "keep drawing" so user can place multiple objects |
| Drawing properties panel | Basic/absent | **Full properties** (color, width, extend, lock) |

---

### 2.3 Order Entry & OMS

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| OrderTicket (UI2) | Market, Limit, Stop, Stop-Limit; uses order-types validateOrderSpec | **Add** IOC, FOK, GTD, MOO, MOC, bracket, OCO |
| AdvancedOrderForm | Uses order-types | **Consolidate** with OrderTicket; single form |
| Blotter | OrdersUI2, BlotterUI2 | **Real-time updates** (WebSocket), **TCA column** |
| Paper vs Live | Mode badge, PaperBroker | **Clear UX** switch; **reconciliation** view |
| Execution algos | TWAP, VWAP in UI | **Full UI** for POV, Dark Pool, SOR, params |

---

### 2.4 Market Data & Layout

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| L2 Order Book | L2OrderBookPanel, 10 levels | **Heatmap view**, **order flow**, **delta column** |
| Time & Sales | TimeSales component | **Faster tape**, **filter by size**, **color by side** |
| Multi-chart | MultiChartLayoutUI2 | **Synced crosshair**, **linked symbol/timeframe** |
| Watchlist | WatchlistManagerUI2 | **Custom columns**, **streaming updates**, **shared lists** |

---

### 2.5 Backtesting

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| Backtest UIs | Multiple (v2, v3, v4, v5) | **Unify** into single flow; v5 as default |
| Tearsheet / metrics | Reporter exists | **UI parity** with TradingView (equity curve, drawdown, monthly heatmap) |
| Walk-forward, Monte Carlo | Backend routes exist | **Full UI** for config + results |
| Strategy code editor | StrategyIDE, panels | **Pine-like** syntax, **syntax highlight**, **run/debug** |

---

### 2.6 Options

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| Options chain | OptionsChainUI2 | **Custom columns**, **OI/volume**, **IV by strike** |
| IV surface | VolSurfaceUI2 | **3D view**, **term structure** tab |
| Strategy lab | PayoffLabUI2 | **Pre-built templates**, **probability of profit** |
| pricing-models.ts | BSM, binomial | **Used in UI** for theoretical vs market |

---

### 2.7 Portfolio & Risk

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| Portfolio | PortfolioUI2, positions | **Brinson attribution**, **benchmark comparison** |
| Risk | RiskDashboardUI2 | **VaR drill-down**, **stress scenario UI** |
| Optimization | PortfolioOptimizerProUI2 | **Efficient frontier** viz, **constraint editor** |

---

### 2.8 Demo vs React App

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| Demo (static HTML) | 23 views, api-bridge | **Not primary app**; many features only there |
| React SPA | 60+ UI2 pages | **Feature parity** with demo where applicable |
| api-bridge.js | Wires demo to /api | **Shared** fetch logic; **fallback** to mock when API down |

---

### 2.9 UI/UX

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| Themes | Bloomberg, dark, light | **More presets** (Matrix, Neon); **user custom** |
| Command palette | CommandPaletteNew, ⌘K | **More commands**; **symbol jump**; **action history** |
| Left nav | Grouped items | **Collapsible groups**; **recent/favorites** |
| Keyboard shortcuts | Partial | **Full coverage**; **customizable**; **cheat sheet** |
| Status bar | Basic | **Connection**, **latency**, **data freshness** |

---

### 2.10 Replay Mode

| Current State | Issues | Improvement Needed |
|---------------|--------|--------------------|
| ReplayControls | Step, play, speed | **Scrubber** (click to jump); **speed presets** |
| chartStore replay | startReplay, setReplaySpeed | **Persist** replay state; **sync** with order replay |
| ReplayView | Exists | **Full integration** with chart + blotter |

---

## PART 3 — PRIORITY MATRIX (Recommended)

| Priority | Area | Action |
|----------|------|--------|
| **P0** | Chart types (Volume Profile, Footprint, TPO) | Wire lib → UI; native rendering where needed |
| **P0** | Drawing toolbar | Drive from drawing-tools.ts; fix hitTest + persistence |
| **P0** | Multi-chart sync | Crosshair + symbol/timeframe sync |
| **P0** | L2 order book | Heatmap, order flow, wire level2_processor |
| **P1** | Order types (IOC, FOK, bracket, OCO) | Extend OrderTicket; wire order-types fully |
| **P1** | Indicator client fallback | Use indicators-extended when API fails |
| **P1** | Backtest unification | Single UI; v5 engine; full tearsheet |
| **P1** | Export (chart image, CSV, PDF) | Implement export actions |
| **P2** | Fixed income, FX, commodities | Expand asset coverage |
| **P2** | Social features | Ideas, comments (TradingView-style) |
| **P2** | Accessibility | WCAG 2.1 AA |

---

## Summary

- **Missing:** ~60% of TradingView chart/drawing/indicator features; ~80% of Bloomberg asset-class and OMS depth.
- **Needs improvement:** Chart engine (native P&F/Kagi), drawing layer (lib-driven, hitTest, persist), order types (full OMS), multi-chart sync, L2, backtest UI, options strategy builder.
- **Strength:** Solid foundation—libs exist (chart-types, drawing-tools, order-types, indicators-extended). Main work is wiring to UI and polishing UX.
