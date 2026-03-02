# Data Provider Guide

> Configure and manage market data sources for real-time and historical feeds.

Apex Terminal is data-source agnostic — it connects to your provider of choice through a pluggable adapter layer in the backend. This guide covers supported providers, configuration, and data quality management.

---

## Table of Contents

1. [Supported Data Providers](#supported-data-providers)
2. [Real-Time vs. Delayed Data](#real-time-vs-delayed-data)
3. [Historical Data Coverage](#historical-data-coverage)
4. [Configuring Data Sources](#configuring-data-sources)
5. [Data Quality Indicators](#data-quality-indicators)
6. [Switching Providers](#switching-providers)
7. [Custom Data Integration](#custom-data-integration)
8. [Tips](#tips)

---

## Supported Data Providers

The backend supports the following providers through adapter modules:

| Provider | Asset Classes | Real-Time | Historical | Free Tier |
|----------|--------------|-----------|-----------|-----------|
| **Polygon.io** | Equities, Options, Forex, Crypto | Yes | 20+ years | Limited |
| **Alpha Vantage** | Equities, Forex, Crypto | Delayed (15m) | 20+ years | Yes (5 calls/min) |
| **Finnhub** | Equities, Forex, Crypto | Yes | 10+ years | Yes (60 calls/min) |
| **IEX Cloud** | US Equities | Yes | 15+ years | Pay-per-use |
| **Yahoo Finance** | Global Equities, Indices | Delayed | 30+ years | Free (unofficial) |
| **Binance** | Crypto | Yes | 5+ years | Free |
| **Interactive Brokers** | All asset classes | Yes | Varies | Requires account |

> **Note:** Provider availability and terms change. Verify current offerings on each provider's website.

---

## Real-Time vs. Delayed Data

Understanding data latency:

| Data Type | Latency | Use Case |
|-----------|---------|----------|
| **Real-time** | < 1 second | Active day trading, scalping |
| **Near-real-time** | 1–5 seconds | Swing trading, monitoring |
| **Delayed** | 15–20 minutes | Research, analysis, paper trading |
| **End-of-day** | After market close | Portfolio review, backtesting |

The platform indicates data freshness in two places:

1. **Bottom bar** — Global connection status (green = real-time, yellow = delayed, red = disconnected)
2. **Chart header** — Per-symbol data indicator showing the last update timestamp

![Data Indicators](../assets/screenshots/data-indicators.png)

---

## Historical Data Coverage

Historical data availability by provider:

| Provider | Intraday | Daily | Tick |
|----------|----------|-------|------|
| Polygon.io | 5+ years (1m) | 20+ years | 2+ years |
| Alpha Vantage | 2 years (1m) | 20+ years | N/A |
| Finnhub | 1 year (1m) | 10+ years | N/A |
| IEX Cloud | 5 years (1m) | 15+ years | N/A |
| Yahoo Finance | 1 month (1m) | 30+ years | N/A |

> **Tip:** For backtesting, daily data is usually sufficient and has the deepest history. Use intraday data only for intraday strategy testing.

---

## Configuring Data Sources

### Backend Configuration

Set your provider in `backend/.env`:

```env
DATA_PROVIDER=polygon
DATA_API_KEY=your-api-key-here
DATA_PLAN=premium
```

### Provider-Specific Settings

Additional settings for each provider:

**Polygon.io:**
```env
POLYGON_API_KEY=pk_xxxxx
POLYGON_PLAN=starter
```

**Alpha Vantage:**
```env
ALPHAVANTAGE_API_KEY=xxxxx
ALPHAVANTAGE_RATE_LIMIT=5
```

**Finnhub:**
```env
FINNHUB_API_KEY=xxxxx
FINNHUB_SANDBOX=false
```

After updating `.env`, restart the backend:

```bash
uvicorn main:app --reload --port 8000
```

The frontend automatically detects the data source from the backend's `/config` endpoint.

---

## Data Quality Indicators

Apex Terminal displays data quality information to help you trust what you see:

| Indicator | Meaning |
|-----------|---------|
| Green dot | Data is live and updating in real-time |
| Yellow dot | Data is delayed (15–20 minutes) |
| Red dot | Connection lost — data is stale |
| Clock icon | Data source timestamp differs from expected |
| Warning triangle | Data gap detected (missing bars) |

Data gaps are handled gracefully — the chart skips missing bars rather than displaying incorrect data. A small marker indicates where gaps exist.

> **Note:** If you see frequent data gaps, consider switching to a more reliable provider or upgrading your plan.

---

## Switching Providers

To switch your data provider:

1. Update `DATA_PROVIDER` and API key in `backend/.env`.
2. Restart the backend.
3. Clear the frontend data cache: Settings → Advanced → Clear Data Cache.
4. Reload the application. The new provider is active immediately.

Historical data cached from the old provider is cleared automatically to avoid mixing sources.

---

## Custom Data Integration

For proprietary or unsupported data sources, create a custom adapter:

1. Create a new Python module in `backend/adapters/`.
2. Implement the `DataProvider` interface:

```python
class CustomProvider(DataProvider):
    async def get_quote(self, symbol: str) -> Quote:
        ...
    async def get_bars(self, symbol: str, timeframe: str, start: str, end: str) -> list[Bar]:
        ...
    async def subscribe(self, symbols: list[str], callback) -> None:
        ...
```

3. Register it in `backend/config.py`.
4. Set `DATA_PROVIDER=custom` in `.env`.

The adapter pattern ensures the frontend is completely decoupled from data source specifics.

---

## Tips

- **Start with a free tier** to evaluate the platform before committing to a paid data plan.
- **Use delayed data for development** — it's free and sufficient for building and testing features.
- **Cache aggressively** — historical data for past dates never changes. The backend caches automatically.
- **Monitor rate limits** — exceeding your provider's rate limit causes temporary data blackouts.
- **Check data quality periodically** — compare candles against a known source to verify accuracy.
- **Plan upgrades around your trading style** — day traders need real-time data; swing traders can use delayed.

---

*Next: [Best Practices](BEST_PRACTICES.md) for trading best practices and workflows.*
