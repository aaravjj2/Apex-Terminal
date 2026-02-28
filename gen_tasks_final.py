#!/usr/bin/env python3
"""Final expansion to push tasks.md past 10,000."""
import os, re

extra = {}

# ─── OPTIONS STRATEGY P&L DIAGRAMS ───────────────────────────────────────────
strategies = [
    "Long Call", "Long Put", "Short Call", "Short Put",
    "Covered Call", "Cash-Secured Put", "Protective Put", "Collar",
    "Bull Call Spread", "Bear Call Spread", "Bull Put Spread", "Bear Put Spread",
    "Long Straddle", "Short Straddle", "Long Strangle", "Short Strangle",
    "Iron Condor", "Iron Butterfly", "Broken Wing Butterfly",
    "Calendar Spread (Call)", "Calendar Spread (Put)",
    "Diagonal Spread (Call)", "Diagonal Spread (Put)",
    "Ratio Call Spread", "Ratio Put Spread", "Ratio Back Spread",
    "Synthetic Long", "Synthetic Short", "Conversion", "Reversal",
    "Box Spread", "Jade Lizard", "Twisted Sister",
    "Christmas Tree Call", "Christmas Tree Put",
    "Condor (Call)", "Condor (Put)", "Skip Strike Butterfly",
    "Double Calendar", "Double Diagonal",
    "Risk Reversal", "Gut Straddle", "Gut Strangle",
]
opt_tasks = []
for s in strategies:
    opt_tasks.append(f"Options Strategy '{s}': implement payoff calculation engine")
    opt_tasks.append(f"Options Strategy '{s}': interactive P&L diagram rendering")
    opt_tasks.append(f"Options Strategy '{s}': breakeven point(s) computation")
    opt_tasks.append(f"Options Strategy '{s}': max profit/max loss labels")
    opt_tasks.append(f"Options Strategy '{s}': probability of profit (PoP) calculation")
    opt_tasks.append(f"Options Strategy '{s}': theta decay simulation (animate)")
    opt_tasks.append(f"Options Strategy '{s}': Greeks aggregation for combined position")
    opt_tasks.append(f"Options Strategy '{s}': suggested strikes auto-selector")
extra["OPTIONS STRATEGY P&L (42 STRATEGIES × 8)"] = opt_tasks

# ─── FINANCIAL RATIOS ENGINE ─────────────────────────────────────────────────
ratios = [
    "P/E Trailing", "P/E Forward", "PEG Ratio", "P/S Ratio", "P/B Ratio",
    "P/CF Ratio", "P/FCF Ratio", "EV/Revenue", "EV/EBITDA", "EV/EBIT",
    "EV/FCF", "Debt/Equity", "Debt/EBITDA", "Debt/Assets",
    "Current Ratio", "Quick Ratio", "Cash Ratio",
    "Gross Margin", "Operating Margin", "Net Margin", "EBITDA Margin",
    "FCF Margin", "ROE", "ROA", "ROIC", "ROC",
    "Asset Turnover", "Inventory Turnover", "Receivable Turnover",
    "Interest Coverage", "DSCR", "Fixed Charge Coverage",
    "Dividend Yield", "Dividend Payout Ratio", "Buyback Yield",
    "Shareholder Yield", "Earnings Yield", "FCF Yield",
    "Revenue Growth YoY", "EPS Growth YoY", "EBITDA Growth YoY",
    "Book Value Growth YoY", "FCF Growth YoY",
    "Altman Z-Score", "Piotroski F-Score", "Beneish M-Score",
    "Graham Number", "Lynch Fair Value", "DCF Intrinsic Value",
]
ratio_tasks = []
for r in ratios:
    ratio_tasks.append(f"Ratio engine: calculate {r} from financial data")
    ratio_tasks.append(f"Frontend: display {r} in fundamental data panel")
    ratio_tasks.append(f"Screener: add {r} as filterable metric")
    ratio_tasks.append(f"Test: verify {r} calculation with known values")
extra["FINANCIAL RATIOS (50 RATIOS × 4)"] = ratio_tasks

# ─── SECTOR/INDUSTRY ANALYSIS ────────────────────────────────────────────────
sectors = [
    "Technology", "Healthcare", "Financials", "Consumer Discretionary",
    "Consumer Staples", "Energy", "Industrials", "Materials",
    "Real Estate", "Utilities", "Communication Services",
]
sector_tasks = []
for s in sectors:
    sector_tasks.append(f"Sector {s}: performance chart (1d, 1w, 1m, YTD, 1Y)")
    sector_tasks.append(f"Sector {s}: constituent list with key metrics table")
    sector_tasks.append(f"Sector {s}: relative strength vs S&P 500 chart")
    sector_tasks.append(f"Sector {s}: breadth indicators (% above 50-day MA)")
    sector_tasks.append(f"Sector {s}: ETF proxy performance (XLK, XLF, etc)")
    sector_tasks.append(f"Sector {s}: top 5 gainers/losers today")
    sector_tasks.append(f"Sector {s}: average P/E multiple comparison")
    sector_tasks.append(f"Sector {s}: earnings estimate revisions chart")
    sector_tasks.append(f"Sector {s}: rotation model phase (improving/leading/weakening/lagging)")
    sector_tasks.append(f"Sector {s}: flow analysis (ETF inflows/outflows)")
extra["PER-SECTOR ANALYSIS (11 SECTORS × 10)"] = sector_tasks

# ─── CANDLESTICK PATTERN RECOGNITION ─────────────────────────────────────────
patterns = [
    "Doji", "Hammer", "Inverted Hammer", "Shooting Star",
    "Hanging Man", "Engulfing Bullish", "Engulfing Bearish",
    "Morning Star", "Evening Star", "Three White Soldiers",
    "Three Black Crows", "Harami Bullish", "Harami Bearish",
    "Piercing Line", "Dark Cloud Cover", "Tweezer Top",
    "Tweezer Bottom", "Spinning Top", "Marubozu Bullish",
    "Marubozu Bearish", "Three Inside Up", "Three Inside Down",
    "Three Outside Up", "Three Outside Down", "Rising Three Methods",
    "Falling Three Methods", "Abandoned Baby Bullish",
    "Abandoned Baby Bearish", "Dragonfly Doji", "Gravestone Doji",
    "Long-Legged Doji", "Rickshaw Man", "Belt Hold Bullish",
    "Belt Hold Bearish", "Kicker Bullish", "Kicker Bearish",
    "Ladder Bottom", "Ladder Top", "Mat Hold", "Advance Block",
]
pat_tasks = []
for p in patterns:
    pat_tasks.append(f"Pattern '{p}': implement detection algorithm")
    pat_tasks.append(f"Pattern '{p}': mark on chart with icon overlay")
    pat_tasks.append(f"Pattern '{p}': tooltip with pattern description")
    pat_tasks.append(f"Pattern '{p}': add to screener filter")
    pat_tasks.append(f"Pattern '{p}': backtest historical accuracy")
    pat_tasks.append(f"Test: '{p}' detection unit test with known bars")
extra["CANDLESTICK PATTERNS (40 PATTERNS × 6)"] = pat_tasks

# ─── MARKET INDICES ──────────────────────────────────────────────────────────
indices = [
    "S&P 500 (SPX)", "NASDAQ 100 (NDX)", "Dow Jones (DJIA)",
    "Russell 2000 (RUT)", "NYSE Composite", "S&P MidCap 400",
    "STOXX 600", "DAX 40", "FTSE 100", "CAC 40", "IBEX 35",
    "Nikkei 225", "Hang Seng", "Shanghai Composite", "KOSPI",
    "ASX 200", "BSE Sensex", "Nifty 50", "Taiwan TAIEX",
    "VIX", "MOVE Index", "US Dollar Index (DXY)",
]
idx_tasks = []
for i in indices:
    idx_tasks.append(f"Index {i}: real-time price display widget")
    idx_tasks.append(f"Index {i}: mini sparkline chart (intraday)")
    idx_tasks.append(f"Index {i}: change amount and % change display")
    idx_tasks.append(f"Index {i}: level bar (% off all-time high)")
    idx_tasks.append(f"Index {i}: click to open full chart")
extra["GLOBAL MARKET INDICES (22 × 5)"] = idx_tasks

# ─── BOND/YIELD MONITOR ──────────────────────────────────────────────────────
tenors = ["3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"]
bond_tasks = []
for t in tenors:
    bond_tasks.append(f"Treasury {t}: real-time yield display")
    bond_tasks.append(f"Treasury {t}: yield chart (1d, 1m, 1y, 5y history)")
    bond_tasks.append(f"Treasury {t}: change and basis point change display")
    bond_tasks.append(f"Treasury {t}: DV01 sensitivity calculation")
    bond_tasks.append(f"Treasury {t}: auction schedule and results display")
extra["TREASURY YIELDS (10 TENORS × 5)"] = bond_tasks

# ─── COMMODITY MONITOR ───────────────────────────────────────────────────────
commodities = [
    "WTI Crude Oil (CL)", "Brent Crude (BZ)", "Natural Gas (NG)",
    "Heating Oil (HO)", "RBOB Gasoline (RB)",
    "Gold (GC)", "Silver (SI)", "Platinum (PL)", "Palladium (PA)", "Copper (HG)",
    "Corn (ZC)", "Soybeans (ZS)", "Wheat (ZW)", "Oats (ZO)",
    "Sugar (SB)", "Coffee (KC)", "Cocoa (CC)", "Cotton (CT)",
    "Live Cattle (LE)", "Lean Hogs (HE)", "Lumber (LBS)",
]
comm_tasks = []
for c in commodities:
    comm_tasks.append(f"Commodity {c}: real-time price display")
    comm_tasks.append(f"Commodity {c}: mini chart widget")
    comm_tasks.append(f"Commodity {c}: change amount and % display")
    comm_tasks.append(f"Commodity {c}: futures curve (front month + deferred)")
    comm_tasks.append(f"Commodity {c}: seasonality chart (5-year avg overlay)")
extra["COMMODITIES MONITOR (21 × 5)"] = comm_tasks

# ─── FX CURRENCY PAIRS ──────────────────────────────────────────────────────
fx_pairs = [
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD",
    "USD/CAD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "NZD/JPY",
    "CHF/JPY", "EUR/AUD", "EUR/NZD", "GBP/AUD", "GBP/NZD",
    "AUD/NZD", "AUD/CAD", "EUR/CHF", "GBP/CHF",
    "USD/BRL", "USD/MXN", "USD/TRY", "USD/ZAR", "USD/RUB",
    "USD/INR", "USD/CNY", "USD/KRW", "USD/SGD", "USD/HKD",
]
fx_tasks = []
for pair in fx_pairs:
    fx_tasks.append(f"FX {pair}: real-time bid/ask display")
    fx_tasks.append(f"FX {pair}: mini chart (1d, 1w, 1m)")
    fx_tasks.append(f"FX {pair}: spread display (in pips)")
    fx_tasks.append(f"FX {pair}: daily range bar visualization")
extra["FX CURRENCY PAIRS (31 × 4)"] = fx_tasks

# ─── ERROR HANDLING & EDGE CASES ────────────────────────────────────────────
error_tasks = [
    "Handle API timeout (>5s) with retry and user notification",
    "Handle API 429 (rate limited) with backoff and queue",
    "Handle API 500 with error boundary and recovery option",
    "Handle API 401 with re-authentication redirect",
    "Handle API 403 with permission denied message",
    "Handle WebSocket disconnect with auto-reconnect indicator",
    "Handle WebSocket message parse error gracefully",
    "Handle empty data response (show 'no data available')",
    "Handle NaN/Infinity in chart data (skip/interpolate)",
    "Handle negative prices in display (guard against)",
    "Handle very large numbers in display (scientific notation)",
    "Handle very small numbers (<0.01) in display (proper precision)",
    "Handle timezone conversion for all timestamp displays",
    "Handle DST transitions for intraday chart bars",
    "Handle market holidays (no data periods)",
    "Handle pre/post market data availability differences",
    "Handle stock split events in historical data",
    "Handle delisted symbols gracefully",
    "Handle symbol change events (ticker changes)",
    "Handle concurrent API requests (deduplication)",
    "Handle browser tab sleep/resume (reconnect on wake)",
    "Handle memory leak prevention (cleanup on unmount)",
    "Handle localStorage quota exceeded gracefully",
    "Handle clipboard API permission denial",
    "Handle download API for file exports",
]
extra["ERROR HANDLING & EDGE CASES"] = error_tasks

# ─── LOCALIZATION / FORMAT ───────────────────────────────────────────────────
loc_tasks = []
currencies = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "INR"]
for c in currencies:
    loc_tasks.append(f"Number format: display prices in {c} with proper symbol/decimals")
    loc_tasks.append(f"Number format: display volume in {c} with K/M/B abbreviations")

timezones = ["America/New_York", "America/Chicago", "America/Los_Angeles",
             "Europe/London", "Europe/Frankfurt", "Europe/Zurich",
             "Asia/Tokyo", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Singapore",
             "Asia/Mumbai", "Australia/Sydney"]
for tz in timezones:
    loc_tasks.append(f"Timezone {tz}: all timestamps converted correctly")
    loc_tasks.append(f"Timezone {tz}: chart x-axis labels in local time")
    loc_tasks.append(f"Timezone {tz}: trading hours overlay adjusted")
extra["LOCALIZATION & NUMBER FORMATTING"] = loc_tasks

# ─── PERFORMANCE BENCHMARKS ─────────────────────────────────────────────────
perf_tasks = [
    "Benchmark: chart renders 10,000 bars in < 200ms",
    "Benchmark: chart renders 100,000 bars in < 1s",
    "Benchmark: indicator calculation (SMA 200) on 10k bars in < 50ms",
    "Benchmark: order book update in < 16ms (60fps)",
    "Benchmark: time & sales tape scroll in < 16ms",
    "Benchmark: watchlist with 100 symbols updates in < 100ms",
    "Benchmark: screener filters 10k stocks in < 500ms",
    "Benchmark: backtest 10 years daily data in < 3s",
    "Benchmark: Monte Carlo 10,000 paths in < 5s",
    "Benchmark: options chain 500 strikes render in < 200ms",
    "Benchmark: portfolio metrics recalculate in < 100ms",
    "Benchmark: initial page load < 2s (first contentful paint)",
    "Benchmark: bundle size < 2MB gzipped",
    "Benchmark: memory usage < 200MB with 5 charts open",
    "Benchmark: WebSocket message processing < 1ms per message",
    "Profile: identify and fix React re-render hotspots",
    "Profile: identify and fix slow useEffect dependencies",
    "Profile: identify and fix unnecessary state updates",
    "Profile: identify and fix memory leaks (detached DOM)",
    "Profile: Lighthouse performance score > 80",
]
extra["PERFORMANCE BENCHMARKS & PROFILING"] = perf_tasks

# ─── CRYPTO-SPECIFIC FEATURES ───────────────────────────────────────────────
crypto_coins = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX",
    "DOT", "MATIC", "LINK", "UNI", "ATOM", "LTC", "FIL",
    "APT", "ARB", "OP", "SUI", "INJ",
]
crypto_tasks = []
for coin in crypto_coins:
    crypto_tasks.append(f"Crypto {coin}: real-time price from exchange API")
    crypto_tasks.append(f"Crypto {coin}: 24h volume and market cap display")
    crypto_tasks.append(f"Crypto {coin}: funding rate (perpetual futures)")
    crypto_tasks.append(f"Crypto {coin}: open interest chart")
    crypto_tasks.append(f"Crypto {coin}: liquidation data feed")
extra["CRYPTO ASSETS (20 COINS × 5)"] = crypto_tasks

# ─── INTEGRATION/CONNECTOR TASKS ────────────────────────────────────────────
extra["DATA SOURCE CONNECTORS"] = [
    "Connector: Alpaca Markets REST API authentication setup",
    "Connector: Alpaca Markets WebSocket streaming setup",
    "Connector: yfinance Python library integration wrapper",
    "Connector: Alpha Vantage REST API integration wrapper",
    "Connector: FRED (Federal Reserve) API integration wrapper",
    "Connector: Polygon.io REST API integration wrapper",
    "Connector: Polygon.io WebSocket streaming setup",
    "Connector: IEX Cloud REST API integration wrapper",
    "Connector: Finnhub REST + WebSocket integration",
    "Connector: Twelve Data API integration wrapper",
    "Connector: Quandl/Nasdaq Data Link API wrapper",
    "Connector: SEC EDGAR API integration (filings)",
    "Connector: News API integration (newsapi.org)",
    "Connector: Twitter/X API v2 integration (sentiment)",
    "Connector: Reddit API integration (wallstreetbets)",
    "Connector: Interactive Brokers TWS API connector",
    "Connector: Coinbase/Binance crypto data connector",
    "Connector: CME Group market data connector",
    "Connector: CBOE options data connector",
    "Connector: implement data provider abstraction layer",
    "Connector: implement fallback chain (source1 -> source2 -> cache)",
    "Connector: implement rate limit tracking per provider",
    "Connector: implement API key rotation support",
    "Connector: implement request retry with circuit breaker",
    "Connector: implement response caching with TTL per endpoint",
]

# ─── DOCUMENTATION TASKS ────────────────────────────────────────────────────
doc_pages = [
    "Getting Started Guide", "Installation & Setup",
    "Architecture Overview", "Frontend Component Library",
    "Backend API Reference", "WebSocket API Reference",
    "Chart Engine Documentation", "Indicator Library Reference",
    "Drawing Tools Reference", "Backtest Engine Documentation",
    "Options Pricing Documentation", "Risk Engine Documentation",
    "Portfolio Analytics Documentation", "Data Provider Integration Guide",
    "Keyboard Shortcuts Reference", "Theming & Customization Guide",
    "Bloomberg Function Equivalents Map", "TradingView Feature Parity Map",
    "Performance Tuning Guide", "Deployment Guide",
]
doc_tasks = []
for d in doc_pages:
    doc_tasks.append(f"Documentation: write {d}")
    doc_tasks.append(f"Documentation: add code examples to {d}")
    doc_tasks.append(f"Documentation: add screenshots/diagrams to {d}")
extra["DOCUMENTATION (20 DOCS × 3)"] = doc_tasks

# ─── Write ────────────────────────────────────────────────────────────────────
outpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.md")

with open(outpath, "r", encoding="utf-8") as f:
    content = f.read()

task_num = content.count("- [ ] TASK-")
content = re.sub(r'\n---\n## TOTAL TASKS: \d+\n?', '', content)

with open(outpath, "w", encoding="utf-8") as f:
    f.write(content)
    for section, tasks in extra.items():
        f.write(f"\n\n## {section}\n\n")
        for task in tasks:
            task_num += 1
            f.write(f"- [ ] TASK-{task_num:05d}: {task}\n")
    f.write(f"\n\n---\n## TOTAL TASKS: {task_num}\n")

print(f"Total tasks after final expansion: {task_num}")
