#!/usr/bin/env python3
"""Expand tasks.md to 10,000+ by adding granular sub-tasks."""
import os

extra_sections = {}

# ─── PER-INDICATOR DETAILED SUBTASKS ──────────────────────────────────────────
indicators = [
    "SMA", "EMA", "WMA", "HMA", "DEMA", "TEMA", "KAMA", "ALMA", "VWAP",
    "Anchored VWAP", "Bollinger Bands", "BB Width", "BB %B", "Keltner Channel",
    "Donchian Channel", "Envelope", "PSAR", "Supertrend", "Ichimoku Cloud",
    "RSI", "Stochastic", "Stochastic RSI", "Williams %R", "CCI", "ROC",
    "Momentum", "MACD", "MACD Histogram", "PPO", "DPO", "TSI", "CMO",
    "Aroon Oscillator", "Aroon Up/Down", "ADX", "+DI/-DI", "DMI", "ATR",
    "Historical Volatility", "Chaikin Volatility", "Volume", "Volume MA",
    "OBV", "Volume Oscillator", "CMF", "MFI", "A/D Line", "Force Index",
    "Ease of Movement", "Elder Ray Bull", "Elder Ray Bear", "TRIX",
    "Mass Index", "Vortex Indicator", "Schaff Trend Cycle", "KST",
    "Fisher Transform", "Coppock Curve", "Pivot Points Traditional",
    "Pivot Points Fibonacci", "Pivot Points Woodie", "Pivot Points Camarilla",
    "Average Daily Range", "Chandelier Exit", "ZigZag", "52W High/Low",
    "Fractal (Williams)", "Volume Profile Visible", "Volume Profile Fixed",
    "Volume Profile Session", "Market Profile", "Value Area High/Low",
    "Point of Control", "Delta Volume", "Cumulative Delta",
    "Volume Delta Histogram", "Relative Volume", "Squeeze Momentum",
    "TTM Squeeze", "Elder Impulse System", "Linear Regression Channel",
    "Standard Deviation Channel", "Regression Line", "VIDYA",
    "Rainbow MA", "Guppy MMA", "Alligator", "AO", "AC", "DeMarker",
    "Klinger Volume Osc", "Choppiness Index", "Connors RSI",
    "Ultimate Oscillator", "Ehlers Fisher", "Laguerre RSI",
    "McGinley Dynamic", "RVI", "Balance of Power", "Net Volume",
    "Positive Volume Index", "Negative Volume Index", "PVT",
    "Trend Intensity", "VHF", "Qstick", "Swing Index", "ASI",
    "Hurst Exponent", "Fractal Dimension",
]

ind_subtasks = []
for ind in indicators:
    ind_subtasks.append(f"Frontend: add {ind} to indicator picker dropdown")
    ind_subtasks.append(f"Frontend: {ind} parameter inputs UI (period, multiplier, etc)")
    ind_subtasks.append(f"Frontend: {ind} color and style picker (line width, opacity)")
    ind_subtasks.append(f"Frontend: {ind} toggle visibility (eye icon)")
    ind_subtasks.append(f"Frontend: {ind} render correctly in sub-pane or overlay")
    ind_subtasks.append(f"Backend: {ind} calculation function implementation")
    ind_subtasks.append(f"Backend: {ind} vectorized numpy computation for performance")
    ind_subtasks.append(f"Test: {ind} calculation unit test with known values")
    ind_subtasks.append(f"Test: {ind} edge case (empty data, single bar, NaN values)")
    ind_subtasks.append(f"Test: {ind} parameter validation (negative period, zero)")
extra_sections["PER-INDICATOR SUBTASKS (110 INDICATORS × 10)"] = ind_subtasks

# ─── PER-DRAWING TOOL SUBTASKS ───────────────────────────────────────────────
drawings = [
    "Trend Line", "Extended Line", "Ray", "Horizontal Line", "Vertical Line",
    "Cross/Plus", "Arrow", "Rectangle", "Circle", "Triangle", "Ellipse",
    "Parallel Channel", "Regression Channel", "Flat Top/Bottom Channel",
    "Disjoint Angle", "Pitchfork", "Schiff Pitchfork", "Modified Schiff",
    "Pitchfan", "Fibonacci Retracement", "Fibonacci Extension",
    "Fibonacci Channel", "Fibonacci Fan", "Fibonacci Arc", "Fibonacci Spiral",
    "Fibonacci Time Zones", "Gann Box", "Gann Fan", "Gann Square",
    "Elliott Wave 12345", "Elliott Wave ABC", "XABCD Harmonic",
    "Cypher Harmonic", "Bat Harmonic", "Gartley Harmonic",
    "Butterfly Harmonic", "Crab Harmonic", "Head and Shoulders",
    "Double Top/Bottom", "Cup and Handle", "Flag/Pennant", "Wedge",
    "Triangle Pattern", "Text Label", "Price Label", "Note/Sticky",
    "Long Position", "Short Position", "Forecast Line", "Date Range",
    "Price Range", "Brush (Freehand)", "Highlighter", "Measurement",
]

draw_subtasks = []
for d in drawings:
    draw_subtasks.append(f"Drawing {d}: mouse interaction (click-drag-release) handler")
    draw_subtasks.append(f"Drawing {d}: lightweight-charts rendering (series/plugin)")
    draw_subtasks.append(f"Drawing {d}: property panel UI (color, width, style)")
    draw_subtasks.append(f"Drawing {d}: persistence (save/load via JSON)")
    draw_subtasks.append(f"Drawing {d}: click selection and move/resize handles")
    draw_subtasks.append(f"Drawing {d}: snap to OHLC price levels (magnet)")
    draw_subtasks.append(f"Drawing {d}: deletion confirmation and undo integration")
    draw_subtasks.append(f"Test: Drawing {d} creation E2E test")
extra_sections["PER-DRAWING TOOL SUBTASKS (54 TOOLS × 8)"] = draw_subtasks

# ─── PER-API ENDPOINT DETAILED TASKS ─────────────────────────────────────────
endpoints = [
    ("GET", "/api/v4/quotes/{symbol}", "real-time quote data"),
    ("GET", "/api/v4/bars/{symbol}", "OHLCV bar data by timeframe"),
    ("WS", "/api/v4/quotes/stream", "WebSocket real-time quotes"),
    ("WS", "/api/v4/bars/stream", "WebSocket real-time OHLCV"),
    ("WS", "/api/v4/orderbook/stream", "WebSocket L2 order book"),
    ("WS", "/api/v4/trades/stream", "WebSocket time & sales"),
    ("GET", "/api/v4/news", "aggregated news articles"),
    ("GET", "/api/v4/fundamentals/{symbol}", "fundamental data"),
    ("GET", "/api/v4/earnings/{symbol}", "earnings history"),
    ("GET", "/api/v4/analyst/{symbol}", "analyst ratings"),
    ("POST", "/api/v4/screener", "stock screener with filters"),
    ("GET", "/api/v4/alerts", "list all alerts"),
    ("POST", "/api/v4/alerts", "create new alert"),
    ("PUT", "/api/v4/alerts/{id}", "update existing alert"),
    ("DELETE", "/api/v4/alerts/{id}", "delete alert"),
    ("GET", "/api/v4/watchlists", "list all watchlists"),
    ("POST", "/api/v4/watchlists", "create watchlist"),
    ("PUT", "/api/v4/watchlists/{id}", "update watchlist"),
    ("DELETE", "/api/v4/watchlists/{id}", "delete watchlist"),
    ("GET", "/api/v4/portfolio", "portfolio positions"),
    ("GET", "/api/v4/portfolio/pnl", "portfolio P&L"),
    ("GET", "/api/v4/portfolio/allocation", "portfolio allocation"),
    ("POST", "/api/v4/risk/var", "calculate VaR"),
    ("POST", "/api/v4/risk/stress", "run stress test"),
    ("GET", "/api/v4/risk/limits", "risk limits status"),
    ("GET", "/api/v4/yieldcurve", "Treasury yield curve"),
    ("GET", "/api/v4/fxrates", "FX cross rates"),
    ("GET", "/api/v4/commodities", "commodity prices"),
    ("GET", "/api/v4/economic-calendar", "economic events"),
    ("GET", "/api/v4/options/chain/{symbol}", "options chain data"),
    ("POST", "/api/v4/options/greeks", "compute Greeks"),
    ("GET", "/api/v4/options/iv-surface/{symbol}", "IV surface"),
    ("GET", "/api/v4/options/flow/{symbol}", "options flow"),
    ("POST", "/api/v4/indicators/compute", "compute indicators"),
    ("POST", "/api/v4/backtest/run", "run backtest"),
    ("POST", "/api/v4/backtest/walkforward", "walk-forward opt"),
    ("POST", "/api/v4/backtest/montecarlo", "Monte Carlo simulation"),
    ("GET", "/api/v4/orders", "list all orders"),
    ("POST", "/api/v4/orders", "submit new order"),
    ("DELETE", "/api/v4/orders/{id}", "cancel order"),
    ("PUT", "/api/v4/orders/{id}", "modify order"),
    ("GET", "/api/v4/trades", "list all trades"),
    ("GET", "/api/v4/positions", "list all positions"),
    ("GET", "/api/v4/account", "account summary"),
    ("GET", "/api/v4/market/breadth", "market breadth data"),
    ("GET", "/api/v4/market/movers", "top movers data"),
    ("GET", "/api/v4/market/sectors", "sector performance"),
    ("GET", "/api/v4/sec/filings/{symbol}", "SEC filings"),
    ("GET", "/api/v4/sec/insiders/{symbol}", "insider transactions"),
    ("GET", "/api/v4/social/sentiment/{symbol}", "social sentiment"),
]

api_subtasks = []
for method, path, desc in endpoints:
    api_subtasks.append(f"Backend: define {method} {path} route handler ({desc})")
    api_subtasks.append(f"Backend: Pydantic request model for {method} {path}")
    api_subtasks.append(f"Backend: Pydantic response model for {method} {path}")
    api_subtasks.append(f"Backend: input validation and error handling for {path}")
    api_subtasks.append(f"Backend: rate limiting for {method} {path}")
    api_subtasks.append(f"Backend: caching layer for {path} responses")
    api_subtasks.append(f"Frontend: API client function for {method} {path}")
    api_subtasks.append(f"Frontend: Zustand store slice for {path} data")
    api_subtasks.append(f"Frontend: loading/error state handling for {path}")
    api_subtasks.append(f"Test: unit test for {method} {path} handler logic")
    api_subtasks.append(f"Test: integration test {method} {path} returns 200")
    api_subtasks.append(f"Test: integration test {method} {path} validates bad input")
extra_sections["PER-API ENDPOINT SUBTASKS (50 ENDPOINTS × 12)"] = api_subtasks

# ─── PER-COMPONENT UI TASKS ──────────────────────────────────────────────────
components = [
    "ChartFrame", "DataTable", "Panel", "KPIStrip", "TickerBar",
    "QuoteBar", "OrderBook", "TimeSales", "OrderTicket", "PositionTable",
    "TradeLog", "AlertList", "WatchlistTable", "NewsCard", "SentimentGauge",
    "VolumeProfile", "HeatMap", "TreeMap", "DonutChart", "BarChart",
    "LineChart", "CandlestickChart", "SankeyDiagram", "ScatterPlot",
    "FunnelChart", "GaugeWidget", "SparkLine", "MiniChart", "TabPanel",
    "Modal", "Tooltip", "Breadcrumb", "CommandPalette", "StatusBar",
    "Sidebar", "TopBar", "NotificationToast", "DropdownMenu", "SearchBar",
    "DatePicker", "RangeSlider", "ToggleSwitch", "RadioGroup", "Checkbox",
    "Badge", "Tag", "ProgressBar", "Skeleton",
]

comp_subtasks = []
for comp in components:
    comp_subtasks.append(f"Component {comp}: Bloomberg amber theme styling")
    comp_subtasks.append(f"Component {comp}: dark mode color scheme (#0a0a0a bg)")
    comp_subtasks.append(f"Component {comp}: responsive layout (desktop + laptop)")
    comp_subtasks.append(f"Component {comp}: keyboard navigation support")
    comp_subtasks.append(f"Component {comp}: aria labels and roles for accessibility")
    comp_subtasks.append(f"Component {comp}: loading skeleton state")
    comp_subtasks.append(f"Component {comp}: error state with retry button")
    comp_subtasks.append(f"Component {comp}: animation/transition effects")
    comp_subtasks.append(f"Component {comp}: React.memo optimization")
    comp_subtasks.append(f"Component {comp}: TypeScript strict type safety")
    comp_subtasks.append(f"Component {comp}: unit test with React Testing Library")
    comp_subtasks.append(f"Component {comp}: visual regression test snapshot")
extra_sections["PER-COMPONENT SUBTASKS (48 COMPONENTS × 12)"] = comp_subtasks

# ─── PER-STRATEGY BACKTEST TASKS ─────────────────────────────────────────────
strategies = [
    "MA Crossover (2 SMA)", "MA Crossover (3 EMA)", "MA Crossover (SMA+EMA)",
    "RSI Mean Reversion", "RSI Divergence", "RSI Range (30-70)",
    "Bollinger Band Breakout", "Bollinger Band Mean Reversion",
    "Bollinger Band Squeeze", "MACD Signal Crossover", "MACD Histogram Reversal",
    "MACD Zero-Line Cross", "Stochastic Crossover", "Stochastic Oversold Bounce",
    "CCI Breakout", "CCI Mean Reversion", "ADX Trend Following",
    "DMI Crossover", "Parabolic SAR Reversal", "Supertrend Following",
    "Ichimoku Cloud Break", "Ichimoku TK Cross", "VWAP Reversion",
    "Volume Breakout", "OBV Divergence", "ATR Channel Breakout",
    "Donchian Channel Breakout", "Keltner Channel Breakout",
    "Pivot Point Bounce", "Fibonacci Retracement Entry",
    "Opening Range Breakout", "Gap and Go", "Pairs Trading (Z-Score)",
    "Mean Reversion (Z-Score)", "Momentum Factor", "Value+Momentum Combo",
    "Dual Momentum (Absolute + Relative)", "Sector Rotation",
    "Risk Parity Allocation", "Turtle Trading Rules",
    "Larry Williams %R Strategy", "Williams Fractal Breakout",
    "Elder Triple Screen", "Connors RSI Mean Reversion",
    "Short Squeeze Detection", "Dark Pool Activity Follow",
    "Options Flow Sentiment", "VIX Mean Reversion",
    "Calendar Spread Roll", "Iron Condor Systematic",
]

strat_subtasks = []
for s in strategies:
    strat_subtasks.append(f"Strategy '{s}': implement signal generation logic")
    strat_subtasks.append(f"Strategy '{s}': implement entry and exit rules")
    strat_subtasks.append(f"Strategy '{s}': add configurable parameters")
    strat_subtasks.append(f"Strategy '{s}': add parameter optimization ranges")
    strat_subtasks.append(f"Strategy '{s}': implement risk management rules")
    strat_subtasks.append(f"Strategy '{s}': backtest with 10 years of SPY data")
    strat_subtasks.append(f"Strategy '{s}': generate performance tearsheet")
    strat_subtasks.append(f"Strategy '{s}': walk-forward validation test")
    strat_subtasks.append(f"Strategy '{s}': Monte Carlo simulation (1000 paths)")
    strat_subtasks.append(f"Strategy '{s}': unit test signal correctness")
extra_sections["PER-STRATEGY SUBTASKS (50 STRATEGIES × 10)"] = strat_subtasks

# ─── CHART TIMEFRAME COMBINATIONS ────────────────────────────────────────────
timeframes = [
    "1s", "5s", "15s", "30s", "1m", "3m", "5m", "10m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h", "D", "2D", "3D", "W", "2W", "M", "3M", "6M", "Y",
]
chart_types = ["Candlestick", "Heikin-Ashi", "Line", "Area", "Bar", "Hollow Candle",
               "Renko", "Kagi", "Point-Figure", "Range", "Tick"]

tf_subtasks = []
for tf in timeframes:
    tf_subtasks.append(f"Timeframe {tf}: implement bar aggregation from tick/minute data")
    tf_subtasks.append(f"Timeframe {tf}: add to timeframe picker UI button bar")
    tf_subtasks.append(f"Timeframe {tf}: backend data endpoint support")
    tf_subtasks.append(f"Timeframe {tf}: real-time update logic (partial bar)")
for ct in chart_types:
    for tf in ["1m", "5m", "15m", "1h", "4h", "D", "W"]:
        tf_subtasks.append(f"ChartType {ct} + {tf}: render test with real data")
extra_sections["TIMEFRAME & CHART TYPE COMBINATIONS"] = tf_subtasks

# ─── DATA PROVIDERS INTEGRATION ──────────────────────────────────────────────
symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM",
           "V", "JNJ", "WMT", "PG", "UNH", "HD", "MA", "DIS", "PYPL", "NFLX",
           "ADBE", "CRM", "INTC", "AMD", "COIN", "ABNB", "SQ", "SHOP", "UBER"]

dp_subtasks = []
for sym in symbols:
    dp_subtasks.append(f"Data: fetch and cache {sym} daily bars (10 years)")
    dp_subtasks.append(f"Data: fetch and cache {sym} minute bars (30 days)")
    dp_subtasks.append(f"Data: fetch {sym} fundamental data (quarterly)")
    dp_subtasks.append(f"Data: fetch {sym} options chain data")
    dp_subtasks.append(f"Data: validate {sym} data integrity (no gaps/outliers)")
extra_sections["PER-SYMBOL DATA TASKS (27 SYMBOLS × 5)"] = dp_subtasks

# ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
shortcut_tasks = []
shortcuts = {
    "Ctrl+K": "Open command palette",
    "Ctrl+/": "Toggle sidebar",
    "Ctrl+1-9": "Switch to tab N",
    "Ctrl+N": "New watchlist",
    "Ctrl+S": "Save current layout",
    "Ctrl+P": "Quick symbol search",
    "Ctrl+B": "Toggle order ticket panel",
    "Ctrl+L": "Lock/unlock drawing tools",
    "Ctrl+M": "Toggle market data panel",
    "Ctrl+T": "Add symbol to watchlist",
    "F1": "Quick buy market order",
    "F2": "Quick sell market order",
    "F3": "Toggle level 2 order book",
    "F4": "Toggle time and sales panel",
    "F5": "Refresh all data",
    "F6": "Toggle chart layout mode",
    "F7": "Toggle indicator panel",
    "F8": "Toggle alert manager",
    "F9": "Toggle portfolio view",
    "F10": "Toggle settings panel",
    "F11": "Toggle Bloomberg command line",
    "F12": "Developer tools panel",
    "Escape": "Cancel current action / close modal",
    "Space": "Fit chart to view / play-pause replay",
    "D": "Toggle drawing mode",
    "I": "Open indicator picker",
    "A": "Open alert creation",
    "T": "Text annotation tool",
    "L": "Trendline drawing tool",
    "H": "Horizontal line tool",
    "V": "Vertical line tool",
    "F": "Fibonacci retracement tool",
    "R": "Rectangle drawing tool",
    "C": "Circle/ellipse drawing tool",
    "P": "Parallel channel tool",
    "G": "Gann drawing tools menu",
    "E": "Elliott wave annotation",
    "Delete": "Remove selected drawing object",
    "Ctrl+Z": "Undo last drawing operation",
    "Ctrl+Y": "Redo last undo operation",
    "Ctrl+A": "Select all drawings",
    "Ctrl+D": "Duplicate selected drawing",
    "Alt+S": "Quick screenshot",
    "Alt+C": "Copy chart as PNG to clipboard",
    "+/-": "Zoom in/out on chart",
    "Arrow Left/Right": "Scroll chart forward/back",
    "Arrow Up/Down": "Adjust zoom vertically",
    "Home": "Jump to most recent bar",
    "End": "Jump to oldest loaded bar",
}

for key, action in shortcuts.items():
    shortcut_tasks.append(f"Shortcut {key}: implement {action}")
    shortcut_tasks.append(f"Shortcut {key}: add to keyboard shortcuts reference panel")
    shortcut_tasks.append(f"Shortcut {key}: make customizable in settings")
extra_sections["KEYBOARD SHORTCUTS (50 SHORTCUTS × 3)"] = shortcut_tasks

# ─── DETAILED TESTING MATRIX ─────────────────────────────────────────────────
test_matrix = []
test_pages = [
    "DashboardUI2", "TradingUI2", "PortfolioUI2", "RiskUI2",
    "AlertsUI2", "OrdersUI2", "ScreenersUI2", "ResearchUI2",
    "SentimentUI2", "MonteCarloUI2", "WalkForwardUI2",
    "BacktesterV3UI2", "OptionsMatrixUI2", "ExecutionCockpitUI2",
    "ControlTowerUI2", "WorkflowBuilderUI2", "AutopilotUI2",
    "NovaUI2", "StrategyStudioV3UI2", "SettingsUI2",
    "RunsUI2", "EconomicCalendarUI2", "BlotterUI2",
    "PerformanceUI2", "ObservabilityUI2",
]

for page in test_pages:
    test_matrix.append(f"Test {page}: renders without crashing")
    test_matrix.append(f"Test {page}: displays loading state correctly")
    test_matrix.append(f"Test {page}: handles API error gracefully")
    test_matrix.append(f"Test {page}: keyboard navigation works")
    test_matrix.append(f"Test {page}: all interactive elements clickable")
    test_matrix.append(f"Test {page}: responsive at 1920px width")
    test_matrix.append(f"Test {page}: responsive at 1280px width")
    test_matrix.append(f"Test {page}: no console errors in browser")
    test_matrix.append(f"Test {page}: accessibility audit passes (axe)")
    test_matrix.append(f"Test {page}: visual regression snapshot test")
extra_sections["PER-PAGE TESTING MATRIX (25 PAGES × 10)"] = test_matrix

# ─── ADDITIONAL FEATURE-LEVEL TASKS ──────────────────────────────────────────
extra_sections["CHART ENGINE — OVERLAY SYSTEMS"] = [
    f"Overlay: earnings events markers on chart (pin icons)",
    f"Overlay: dividend markers on chart (flag icons)",
    f"Overlay: stock split markers on chart (S icon)",
    f"Overlay: analyst price target lines overlay",
    f"Overlay: support/resistance auto-detection lines",
    f"Overlay: pivot points auto-calculated overlay",
    f"Overlay: gap detection and fill visualization",
    f"Overlay: opening/closing range shading",
    f"Overlay: VWAP deviation bands (+/- 1,2,3 sigma)",
    f"Overlay: volume-weighted moving average lines",
    f"Overlay: previous day H/L/C reference lines",
    f"Overlay: weekly H/L/C reference lines",
    f"Overlay: monthly H/L/C reference lines",
    f"Overlay: premarket/afterhours activity shading",
    f"Overlay: holiday market closure markers",
    f"Overlay: custom horizontal price level with label",
    f"Overlay: trade entry/exit markers from backtest results",
    f"Overlay: position average cost line (portfolio view)",
    f"Overlay: stop loss / take profit lines (active orders)",
    f"Overlay: alert trigger price lines with notification icon",
]

extra_sections["CHART ENGINE — MULTI-SYMBOL ANALYSIS"] = [
    "Multi-symbol: overlay up to 5 symbols on one chart",
    "Multi-symbol: normalize to % change mode for comparison",
    "Multi-symbol: normalize to index 100 mode",
    "Multi-symbol: color-coded per symbol legend",
    "Multi-symbol: individual visibility toggle per overlay",
    "Multi-symbol: correlation coefficient display in header",
    "Multi-symbol: spread/ratio chart mode (Symbol1/Symbol2)",
    "Multi-symbol: beta calculation overlay",
    "Multi-symbol: relative strength comparison vs benchmark",
    "Multi-symbol: sync crosshair across all overlaid symbols",
    "Multi-symbol: individual symbol tooltip on hover",
    "Multi-symbol: add symbol search dropdown for overlay",
    "Multi-symbol: remove overlay symbol button",
    "Multi-symbol: overlay symbol mini quote in legend",
    "Multi-symbol: volume comparison mode (overlaid volumes)",
]

extra_sections["DATA VISUALIZATION LIBRARY"] = [
    "Build reusable area chart component (D3 or lightweight-charts)",
    "Build reusable bar chart component (horizontal + vertical)",
    "Build reusable donut/pie chart component",
    "Build reusable heatmap component (2D grid with color scale)",
    "Build reusable treemap component (nested rectangles)",
    "Build reusable scatter plot component",
    "Build reusable histogram component",
    "Build reusable gauge/dial component (0-100 with zones)",
    "Build reusable sparkline component (inline mini chart)",
    "Build reusable Sankey diagram component",
    "Build reusable waterfall chart component",
    "Build reusable radar/spider chart component",
    "Build reusable funnel chart component",
    "Build reusable box plot / candlestick statistical component",
    "Build reusable bullet chart component",
    "All charts: Bloomberg amber color palette integration",
    "All charts: dark theme compatibility",
    "All charts: responsive sizing (ResizeObserver)",
    "All charts: tooltip on hover with data values",
    "All charts: export as PNG functionality",
    "All charts: export underlying data as CSV",
    "All charts: animation on data load",
    "All charts: legend component with toggle visibility",
    "All charts: axis label formatting (auto K/M/B/T)",
    "All charts: gridlines styling (dashed subtle gray)",
]

extra_sections["BLOOMBERG TERMINAL FUNCTIONS (100+)"] = [
    "Implement Bloomberg DES (Description) function display",
    "Implement Bloomberg GP (Graph Price) function display",
    "Implement Bloomberg FA (Financial Analysis) function display",
    "Implement Bloomberg ERN (Earnings) function display",
    "Implement Bloomberg AN (Analyst Recommendations) display",
    "Implement Bloomberg RV (Relative Value) function display",
    "Implement Bloomberg DVD (Dividends) function display",
    "Implement Bloomberg OMON (Options Monitor) function display",
    "Implement Bloomberg OV (Option Valuation) function display",
    "Implement Bloomberg OVME (Option Valuation Model Editor)",
    "Implement Bloomberg GIP (Graph Intraday Price)",
    "Implement Bloomberg HDS (Holders/Shareholders) display",
    "Implement Bloomberg CACS (Corporate Actions)",
    "Implement Bloomberg CN (Company News) display",
    "Implement Bloomberg CIX (Corporate Index Memberships)",
    "Implement Bloomberg SI (Short Interest) display",
    "Implement Bloomberg CQ (Market Quotes) display",
    "Implement Bloomberg BQ (Block Quotes) display",
    "Implement Bloomberg MEMB (Index Members) display",
    "Implement Bloomberg GE (Government Bond Explorer)",
    "Implement Bloomberg YAS (Yield Analysis) display",
    "Implement Bloomberg FXIP (FX Information Pricing)",
    "Implement Bloomberg ECST (Economic Statistics)",
    "Implement Bloomberg ECO (Economic Calendar)",
    "Implement Bloomberg WECO (World Economic Calendar)",
    "Implement Bloomberg ECFC (Forecast) function display",
    "Implement Bloomberg PORT (Portfolio Analytics)",
    "Implement Bloomberg MARS (Risk Management)",
    "Implement Bloomberg PMEN (Portfolio Menu)",
    "Implement Bloomberg PRTU (Portfolio Upload)",
    "Implement Bloomberg DRSK (Derivatives Risk)",
    "Implement Bloomberg SSRC (Stock Screener)",
    "Implement Bloomberg EQS (Equity Screening)",
    "Implement Bloomberg TOP (Top News) display",
    "Implement Bloomberg NI (News Intelligence) display",
    "Implement Bloomberg BRC (BRICS Research)",
    "Implement Bloomberg BI (Bloomberg Intelligence)",
    "Implement Bloomberg COMP (Comparison) function",
    "Implement Bloomberg SECF (Security Finder)",
    "Implement Bloomberg FHM (Fundamental Heat Map)",
    "Implement Bloomberg WEI (World Equity Indices)",
    "Implement Bloomberg IMAP (Interactive Maps)",
    "Implement Bloomberg GMAP (Geo Map) display",
    "Implement Bloomberg XLTP (Excel Template)",
    "Implement Bloomberg MOST (Most Active Securities)",
    "Implement Bloomberg MMAP (Market Map) sector heat map",
    "Implement Bloomberg CSTM (Custom Studies/Strategies)",
    "Implement Bloomberg TRA (Trade Summary) display",
    "Implement Bloomberg AQR (Advanced Quote Report)",
    "Implement Bloomberg VWAP (VWAP Analytics) display",
    "Implement Bloomberg BLP (Bloomberg Launchpad) mode",
]

extra_sections["ZUSTAND STATE MANAGEMENT"] = [
    "Create marketDataStore: quotes, bars, orderbook, trades",
    "Create portfolioStore: positions, P&L, allocations",
    "Create ordersStore: open orders, order history, fills",
    "Create alertStore: active alerts, triggered history",
    "Create watchlistStore: multiple lists with symbols",
    "Create settingsStore: user preferences, theme, hotkeys",
    "Create chartStore: active symbol, timeframe, indicators, drawings",
    "Create screenerStore: filters, results, presets",
    "Create riskStore: VaR, stress tests, limits, exposures",
    "Create newsStore: articles, sentiment scores, bookmarks",
    "Create backtestStore: config, results, trades, metrics",
    "Create optionsStore: chain data, Greeks, strategies, IV surface",
    "Create macroStore: economic calendar, FRED data, commods, FX",
    "Create connectionStore: WebSocket status, API health, latency",
    "Store: implement persist middleware for localStorage",
    "Store: implement devtools middleware for debugging",
    "Store: implement immer middleware for immutable updates",
    "Store: implement subscribeWithSelector for fine-grained updates",
    "Store: cross-store selectors (derived data)",
    "Store: optimistic update patterns for order submission",
    "Store: batch update support for high-frequency data",
    "Store: saga/effect pattern for complex async flows",
    "Store: data normalization (entities by ID)",
    "Store: stale data detection and refetch triggers",
    "Store: connection-aware data fetching (retry on reconnect)",
]

extra_sections["WEBSOCKET INFRASTRUCTURE"] = [
    "Implement WebSocket connection manager (singleton)",
    "WS: auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)",
    "WS: heartbeat/ping-pong keepalive (every 15s)",
    "WS: message queue during reconnect (replay on reconnect)",
    "WS: subscription management (subscribe/unsubscribe channels)",
    "WS: channel multiplexing (single connection, multiple streams)",
    "WS: message decompression (gzip/deflate)",
    "WS: message rate limiting (throttle high-frequency updates)",
    "WS: connection status indicator in UI (green/amber/red dot)",
    "WS: graceful close on page navigation",
    "WS: automatic resub on reconnect",
    "WS: error handling with user notification",
    "WS: binary message support for market data",
    "WS: snapshot + incremental update pattern",
    "WS: sequence number gap detection",
    "Backend WS: implement subscription handler",
    "Backend WS: implement channel routing",
    "Backend WS: implement broadcast to all subscribers",
    "Backend WS: implement per-symbol subscription",
    "Backend WS: implement rate limiting per client",
    "Backend WS: implement authentication handshake",
    "Backend WS: implement heartbeat monitor",
    "Backend WS: implement graceful disconnect handler",
    "Backend WS: implement message serialization (msgpack/JSON)",
    "Backend WS: implement connection pool management",
]

extra_sections["RESPONSIVE LAYOUT & WINDOW MANAGEMENT"] = [
    "Implement panelized window system (resizable/draggable panels)",
    "Panel system: drag panel to reposition in grid",
    "Panel system: resize panel via drag handle",
    "Panel system: minimize panel to title bar",
    "Panel system: maximize panel to full workspace",
    "Panel system: close panel with animation",
    "Panel system: add panel from menu",
    "Panel system: save layout to named preset",
    "Panel system: load layout from preset list",
    "Panel system: default layout presets (Trading, Research, Risk)",
    "Panel system: auto-save layout on change",
    "Panel system: restore last session layout on load",
    "Panel system: tab groups within panels",
    "Panel system: tear-off panel to floating window",
    "Panel system: dock floating window back to grid",
    "Responsive: 1920×1080 full HD layout",
    "Responsive: 2560×1440 QHD layout (use extra space)",
    "Responsive: 3840×2160 4K layout (ultra-dense mode)",
    "Responsive: 1366×768 laptop layout (compact mode)",
    "Responsive: handle browser zoom 80%-150%",
]

# ─── Write the additions to tasks.md ─────────────────────────────────────────
outpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.md")

# Read existing content to get current task count
with open(outpath, "r", encoding="utf-8") as f:
    content = f.read()

# Find current task count
import re
match = re.search(r"TASK-(\d+):", content[::-1][:200][::-1])
# Just count them
task_num = content.count("- [ ] TASK-")

# Remove trailing total line
content = re.sub(r'\n---\n## TOTAL TASKS: \d+\n?', '', content)

with open(outpath, "w", encoding="utf-8") as f:
    f.write(content)
    
    for section, tasks in extra_sections.items():
        f.write(f"\n\n## {section}\n\n")
        for task in tasks:
            task_num += 1
            f.write(f"- [ ] TASK-{task_num:05d}: {task}\n")
    
    f.write(f"\n\n---\n## TOTAL TASKS: {task_num}\n")

print(f"Total tasks after expansion: {task_num}")
print(f"Written to: {outpath}")
