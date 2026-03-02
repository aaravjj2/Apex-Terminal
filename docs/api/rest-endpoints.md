# REST Endpoints

API base paths and endpoint catalog.

## Base URL

`/api` — all REST endpoints are under this prefix.

## Trading

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/trading/orders | Submit order |
| DELETE | /api/trading/orders/:id | Cancel order |
| PATCH | /api/trading/orders/:id | Modify order |
| GET | /api/trading/orders | List orders |
| GET | /api/trading/orders/:id | Get order |
| GET | /api/trading/fills | List fills |
| GET | /api/trading/positions | List positions |
| GET | /api/trading/positions/:symbol | Get position |
| POST | /api/trading/positions/:symbol/close | Close position |
| POST | /api/trading/positions/close-all | Close all |
| GET | /api/trading/account | Account info |
| GET | /api/trading/tca/:orderId | TCA report |
| GET | /api/trading/broker/status | Broker status |
| POST | /api/trading/orders/bracket | Bracket order |

## Market Data

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/market-data/quotes/:symbol | Quote |
| GET | /api/market-data/quotes | Multi-quote |
| GET | /api/market-data/bars/:symbol | Historical bars |
| GET | /api/market-data/level2/:symbol | Level 2 |
| GET | /api/market-data/trades/:symbol | Trades |
| GET | /api/market-data/vwap/:symbol | VWAP |
| GET | /api/market-data/snapshot | Snapshot |
| GET | /api/market-data/status | Market status |

## Portfolio

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/portfolio | Portfolio |
| GET | /api/portfolio/history | History |
| GET | /api/portfolio/performance | Performance |
| GET | /api/portfolio/risk | Risk metrics |
| GET | /api/portfolio/attribution | Attribution |
| GET | /api/portfolio/optimization | Optimization |
| GET | /api/portfolio/rebalance | Rebalance |
| GET | /api/portfolio/exposures | Exposures |
| GET | /api/portfolio/benchmark | Benchmark comparison |

## Options

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/options/chain/:symbol | Options chain |
| GET | /api/options/expirations/:symbol | Expirations |
| GET | /api/options/strikes/:symbol | Strikes |
| GET | /api/options/greeks/:symbol | Greeks |
| GET | /api/options/vol-surface/:symbol | Vol surface |
| GET | /api/options/unusual-activity | Unusual activity |
