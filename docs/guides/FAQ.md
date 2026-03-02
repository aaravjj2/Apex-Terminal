# Frequently Asked Questions

> Answers to the most common questions about Apex Terminal.

---

## Table of Contents

1. [General](#general)
2. [Data and Market Coverage](#data-and-market-coverage)
3. [Trading](#trading)
4. [Charting](#charting)
5. [Technical Issues](#technical-issues)
6. [Account and Configuration](#account-and-configuration)

---

## General

### What is Apex Terminal?

Apex Terminal is a professional-grade financial analytics and trading platform built with React 19, TypeScript, and a FastAPI backend. It provides charting, order management, options analytics, portfolio optimization, backtesting, risk analysis, and Bloomberg-style terminal capabilities.

### Who is Apex Terminal for?

It is designed for retail traders, quantitative analysts, portfolio managers, and anyone who wants institutional-quality tools in an open, customizable platform.

### What tech stack does Apex Terminal use?

- **Frontend:** React 19, TypeScript, Zustand (state), Tailwind v4 (styling), lightweight-charts (charting), Vite 5 (build), react-resizable-panels (layouts)
- **Backend:** FastAPI, Python 3.10+, uvicorn
- **Data:** WebSocket for real-time, REST for historical

### Is Apex Terminal free?

Yes, the platform is open source. You provide your own data source and brokerage connection.

### Can I use Apex Terminal for live trading?

The platform supports order management and can be connected to supported brokerages. However, live trading involves real financial risk. Always test thoroughly in simulation mode first.

---

## Data and Market Coverage

### What data providers are supported?

Apex Terminal supports configurable data providers. Configure your provider in the backend `.env` file. See the [Data Sources Guide](DATA_SOURCES.md) for details.

### Is the data real-time or delayed?

This depends on your data provider and subscription. The platform displays data as it receives it — if your provider delivers real-time, you get real-time. A data quality indicator in the bottom bar shows whether data is live or delayed.

### What asset classes are supported?

Equities, options, futures, forex, and crypto — depending on your data provider's coverage.

### How far back does historical data go?

Historical depth depends on your data source. Most providers offer 10–20 years of daily data and 1–5 years of intraday data.

### Can I use multiple data sources simultaneously?

Currently the backend connects to one primary data provider. Multi-source aggregation is on the roadmap.

---

## Trading

### What order types are available?

Market, limit, stop, stop-limit, bracket (with take-profit and stop-loss), and OCO (one-cancels-other).

### Can I paper trade?

Yes. Switch to simulation mode in Settings → Trading → Paper Trading. All order logic works identically, but no real orders are sent.

### How do I set up bracket orders?

Open the order ticket (Shift+T), switch to the Advanced tab, select "Bracket", and configure the entry price, take-profit, and stop-loss levels. See the [First Trade Guide](FIRST_TRADE.md) for a walkthrough.

### Are there commissions in paper trading?

You can configure simulated commissions in Settings → Trading → Commissions to make paper trading more realistic.

### Can I cancel or modify an order after submission?

Yes. Click any pending order in the blotter to modify quantity, price, or cancel it entirely.

---

## Charting

### How many indicators can I add to a chart?

There is no hard limit, but performance is best with up to 10 indicators per chart. Use multi-chart layouts for more indicators.

### Can I save my chart setup as a template?

Yes. Click the Template button → Save as Template. Templates include chart type, indicators, settings, and drawings. See [Chart Tutorial](CHART_TUTORIAL.md).

### How do I draw on the chart?

Select a tool from the left toolbar, then click on the chart to place anchor points. Right-click a drawing to edit or delete. Over 70 tools are available. See [Chart Tutorial](CHART_TUTORIAL.md).

### Can I compare multiple symbols on one chart?

Yes. Use the command bar: `Ctrl+K` → `COMP AAPL MSFT GOOG` to overlay multiple securities.

### Are Heikin-Ashi and Renko charts available?

Yes. Switch chart types from the dropdown in the chart toolbar. All 7 chart types (Candlestick, OHLC, Line, Area, Heikin-Ashi, Renko, Baseline) are supported.

### Can I link charts so they scroll together?

Yes. Enable linked crosshairs and synchronized scrolling in Settings → Charts → Link Charts.

---

## Technical Issues

### Why is the WebSocket connection dropping?

Check that the backend is running on port 8000, your firewall allows the connection, and no browser extension is blocking WebSocket traffic. See [Troubleshooting](TROUBLESHOOTING.md).

### The chart area is blank — what should I do?

Verify the backend is running, try a common symbol like AAPL, and check the browser console for errors. See [Troubleshooting](TROUBLESHOOTING.md).

### How do I fix slow performance?

Reduce open panels, limit indicators per chart, close DevTools, and use Chrome or Edge. See the performance section in [Troubleshooting](TROUBLESHOOTING.md).

### What browsers are supported?

Chrome 110+, Edge 110+, Firefox 115+, and Safari 16+. Internet Explorer is not supported.

### How do I clear all saved data?

Go to Settings → Advanced → Clear All Data. This removes workspaces, templates, and preferences from IndexedDB.

### Can I run Apex Terminal on a different port?

Yes. Set `VITE_PORT=5200` in the frontend `.env` file and update `CORS_ORIGINS` in the backend `.env` accordingly.

---

## Account and Configuration

### How do I change the theme?

Click the theme toggle in the top bar, or use the command bar: `Ctrl+K` → `theme dark`, `theme light`, or `theme midnight`.

### Can I export my workspaces?

Yes. Click the workspace dropdown → Export to download a JSON file. Import on another machine with the Import option. See [Workspace Tutorial](WORKSPACE_TUTORIAL.md).

### How do I reset everything to defaults?

Settings → Advanced → Factory Reset. This clears all customizations and restores the default workspace, theme, and preferences.

### Are keyboard shortcuts customizable?

The default shortcuts are documented in the app. Custom key bindings are planned for a future release.

### Where is my data stored?

All user preferences, workspaces, and chart templates are stored in the browser's IndexedDB. No data is sent to external servers unless you configure a cloud sync provider.

---

*For issues not covered here, see [Troubleshooting](TROUBLESHOOTING.md) or open a GitHub issue.*
