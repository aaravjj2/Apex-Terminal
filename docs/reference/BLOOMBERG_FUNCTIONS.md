# Bloomberg Function Reference

> Apex Terminal's Bloomberg-style command interface. Type commands in the terminal bar or command palette.

## Table of Contents

- [Overview](#overview)
- [Security Functions](#security-functions)
- [Charting & Analytics](#charting--analytics)
- [Portfolio & Trading](#portfolio--trading)
- [News & Research](#news--research)
- [Screening & Discovery](#screening--discovery)
- [System Commands](#system-commands)
- [Syntax Rules](#syntax-rules)

---

## Overview

Bloomberg functions follow the pattern `<SYMBOL> <FUNCTION>` or just `<FUNCTION>` for global commands. Access them via:

- Bloomberg terminal bar (bottom of screen in Bloomberg mode)
- Command palette (`Ctrl+K` then prefix with `>`)
- Direct URL: `/bloomberg/<FUNCTION>?s=<SYMBOL>`

---

## Security Functions

| Command | Name | Description | Example |
|---------|------|-------------|---------|
| `DES` | Description | Company overview, sector, market cap, key stats | `AAPL DES` |
| `BQ` | Quote | Real-time bid/ask/last/volume/change | `MSFT BQ` |
| `ALLQ` | All Quotes | Consolidated quotes across all exchanges | `TSLA ALLQ` |
| `HP` | Historical Price | OHLCV history with date range selector | `AMZN HP` |
| `DVD` | Dividends | Dividend history, yield, ex-dates, payout ratio | `JNJ DVD` |
| `ERN` | Earnings | EPS history, estimates, surprise, guidance | `GOOG ERN` |
| `FA` | Financial Analysis | Income statement, balance sheet, cash flow | `META FA` |
| `RV` | Relative Value | Peer comparison on valuation multiples | `NVDA RV` |
| `SPLC` | Supply Chain | Revenue exposure by customer/supplier | `AAPL SPLC` |
| `ANR` | Analyst Ratings | Consensus rating, price targets, recent changes | `AMZN ANR` |

### DES Fields

| Field | Description |
|-------|-------------|
| Name | Legal entity name |
| Ticker | Exchange ticker |
| Sector / Industry | GICS classification |
| Market Cap | Shares outstanding × price |
| P/E (TTM) | Price / trailing twelve months earnings |
| EPS (TTM) | Earnings per share |
| Dividend Yield | Annual dividend / price |
| 52-Week Range | Lowest and highest price over past year |
| Avg Volume (30D) | Average daily volume |
| Beta | 2-year weekly beta vs benchmark |

---

## Charting & Analytics

| Command | Name | Description | Example |
|---------|------|-------------|---------|
| `GP` | Graph Price | Interactive price chart with indicator overlay | `AAPL GP` |
| `GIP` | Intraday Graph | Intraday tick/minute chart | `SPY GIP` |
| `COMP` | Comparative | Multi-security overlay chart (up to 10) | `AAPL COMP MSFT GOOG` |
| `CORR` | Correlation | Correlation matrix across securities | `CORR` (uses watchlist) |
| `BETA` | Beta Analysis | Rolling beta with configurable benchmark | `TSLA BETA` |
| `SKEW` | Volatility Skew | Options IV skew by expiry | `AAPL SKEW` |
| `OMON` | Options Monitor | Options chain with Greeks, IV, volume | `SPY OMON` |
| `OVDV` | Vol Surface | 3D implied volatility surface | `AAPL OVDV` |
| `HVG` | Historical Vol | Historical vs implied volatility chart | `QQQ HVG` |
| `TRA` | Total Return | Total return analysis including dividends | `VTI TRA` |

---

## Portfolio & Trading

| Command | Name | Description | Example |
|---------|------|-------------|---------|
| `PORT` | Portfolio | Portfolio summary with P&L, allocation, risk | `PORT` |
| `PMON` | Position Monitor | Real-time P&L for all open positions | `PMON` |
| `RPA` | Risk & Performance | Sharpe, Sortino, VaR, drawdown analysis | `RPA` |
| `ATTR` | Attribution | Brinson attribution vs benchmark | `ATTR` |
| `BALC` | Balance | Cash balance and buying power | `BALC` |
| `BLOT` | Trade Blotter | Order history with fill details | `BLOT` |
| `OMS` | Order Management | Active orders with modify/cancel actions | `OMS` |
| `EQRP` | Equity Risk | Factor risk decomposition | `EQRP` |
| `MARS` | Margin Summary | Margin usage, requirements, excess | `MARS` |

---

## News & Research

| Command | Name | Description | Example |
|---------|------|-------------|---------|
| `NEWS` | News | Filtered news feed for security or market | `AAPL NEWS` |
| `TOP` | Top News | Market-wide top headlines | `TOP` |
| `NH` | News History | Historical news archive with search | `TSLA NH` |
| `ECO` | Economic Calendar | Upcoming economic events and releases | `ECO` |
| `EVTS` | Corporate Events | Earnings dates, splits, dividends, conferences | `MSFT EVTS` |
| `BI` | Bloomberg Intelligence | Sector research and analysis | `BI TECH` |
| `BRIEF` | Morning Brief | AI-generated daily market summary | `BRIEF` |

---

## Screening & Discovery

| Command | Name | Description | Example |
|---------|------|-------------|---------|
| `SRCH` | Screener | Multi-criteria equity screener | `SRCH` |
| `EQS` | Equity Screening | Advanced screening with 100+ filters | `EQS` |
| `WEI` | World Equity Index | Global index overview with heat map | `WEI` |
| `IMAP` | Industry Map | Sector/industry tree map by performance | `IMAP` |
| `MOST` | Most Active | Most active, gainers, losers by exchange | `MOST` |
| `IPO` | IPO Calendar | Upcoming and recent IPOs | `IPO` |
| `WL` | Watchlist | User watchlist management | `WL` |

---

## System Commands

| Command | Name | Description |
|---------|------|-------------|
| `HELP` | Help | Display help for a specific function |
| `DOCS` | Documentation | Open reference documentation |
| `SETTINGS` | Settings | Open application settings |
| `THEME` | Theme | Toggle dark/light or set a named theme |
| `LAYOUT` | Layout | Switch workspace layout preset |
| `EXPORT` | Export | Export current view (CSV, PNG, PDF) |
| `LOG` | Activity Log | View system log and API call history |
| `VER` | Version | Display application version and build info |
| `PERF` | Performance | Show rendering and network performance stats |

---

## Syntax Rules

### General Format

```
[SYMBOL] COMMAND [PARAMS]
```

### Chaining

Multiple commands can be run in sequence with `&&`:

```
AAPL DES && AAPL GP && AAPL FA
```

### Parameters

Some functions accept optional parameters after the command:

```
AAPL HP --from 2024-01-01 --to 2025-12-31 --interval daily
SRCH --sector Technology --mcap >100B --pe <25
COMP AAPL MSFT GOOG --period 1Y --normalize
```

### Autocomplete

The terminal provides fuzzy autocomplete as you type. Press `Tab` to accept the top suggestion, `↑↓` to navigate, `Enter` to execute.

### Aliases

Users can define custom aliases in Settings → Bloomberg → Aliases:

```json
{
  "q": "BQ",
  "ch": "GP",
  "port": "PORT"
}
```

---

*Source: `components/bloomberg/` — see `BloombergTerminal.tsx` and `bloombergCommands.ts`.*
