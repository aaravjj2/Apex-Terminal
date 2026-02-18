# API Contracts: Unified Market Workstation

> Generated: 2026-01-12
> Version: 1.0.0
> Status: Canonical Contract Specification

This document defines **all** REST and WebSocket contracts the frontend may call. No additional endpoints are allowed without updating this document.

---

## Base Configuration

| Environment | Backend URL | WebSocket URL |
|-------------|-------------|---------------|
| Development | `http://localhost:8000` | `ws://localhost:8000` |
| Production  | `$BACKEND_URL` | `$WS_URL` |

---

## Authentication

Currently using API key-based auth for external providers (Finnhub, Alpaca).

### Headers
```
X-API-Key: <optional for internal calls>
Content-Type: application/json
```

---

## REST Endpoints

### Health & Status

#### `GET /health`
Returns service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-12T10:30:00Z",
  "version": "1.0.0"
}
```

#### `GET /api/v1/ingest/provider-status`
Returns data provider connection status.

**Response:**
```json
{
  "provider": "alpaca",
  "status": "connected",
  "last_tick_ts": 1736678400000,
  "mode": "LIVE"
}
```

---

### Bars (OHLCV Data)

#### `GET /api/v1/bars/{symbol}/{timeframe}`
Fetch historical bars for a symbol.

**Path Parameters:**
- `symbol` (string): Ticker symbol (e.g., "AAPL")
- `timeframe` (string): Bar interval ("1m", "5m", "15m", "1H", "4H", "1D", "1W")

**Query Parameters:**
- `limit` (int, optional): Max bars to return (default: 500)
- `start` (ISO datetime, optional): Start timestamp
- `end` (ISO datetime, optional): End timestamp

**Response:**
```json
{
  "symbol": "AAPL",
  "timeframe": "1m",
  "bars": [
    {
      "timestamp": 1736678400000,
      "open": 150.25,
      "high": 150.50,
      "low": 150.10,
      "close": 150.40,
      "volume": 125000
    }
  ]
}
```

---

### Clock & Timing

#### `GET /api/v1/clock`
Get current market clock state.

**Response:**
```json
{
  "mode": "LIVE",
  "current_time": "2026-01-12T10:30:00Z",
  "market_open": true,
  "session": "regular",
  "next_event": "market_close",
  "next_event_time": "2026-01-12T16:00:00Z"
}
```

#### `POST /api/v1/clock/control`
Control replay/backtest clock.

**Request Body:**
```json
{
  "action": "play|pause|step|seek",
  "speed": 1.0,
  "target_time": "2026-01-12T10:00:00Z"
}
```

---

### Drawings

#### `GET /api/v1/drawings/{symbol}`
Get all drawings for a symbol.

**Response:**
```json
{
  "symbol": "AAPL",
  "drawings": [
    {
      "id": "drawing_123",
      "type": "trendline",
      "points": [
        {"time": 1736678400, "price": 150.25},
        {"time": 1736682000, "price": 151.50}
      ],
      "style": {
        "color": "#2196F3",
        "lineWidth": 2
      },
      "created_at": "2026-01-12T10:30:00Z"
    }
  ]
}
```

#### `POST /api/v1/drawings/{symbol}`
Create a new drawing.

#### `PUT /api/v1/drawings/{symbol}/{id}`
Update an existing drawing.

#### `DELETE /api/v1/drawings/{symbol}/{id}`
Delete a drawing.

---

### Strategies

#### `GET /api/v1/strategies`
List all strategies.

**Response:**
```json
{
  "strategies": [
    {
      "id": "strat_001",
      "name": "SMA Crossover",
      "status": "active",
      "mode": "paper",
      "created_at": "2026-01-10T08:00:00Z"
    }
  ]
}
```

#### `POST /api/v1/strategies`
Create a new strategy.

#### `GET /api/v1/strategies/{id}`
Get strategy details.

#### `PUT /api/v1/strategies/{id}`
Update strategy.

#### `DELETE /api/v1/strategies/{id}`
Delete strategy.

---

### Portfolio

#### `GET /api/v1/portfolio`
Get portfolio summary.

**Response:**
```json
{
  "total_value": 100000.00,
  "cash": 50000.00,
  "positions_value": 50000.00,
  "unrealized_pnl": 1250.00,
  "realized_pnl": 500.00,
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 100,
      "avg_cost": 150.00,
      "current_price": 152.50,
      "unrealized_pnl": 250.00,
      "market_value": 15250.00
    }
  ]
}
```

#### `GET /api/v1/portfolio/positions`
Get all positions.

#### `GET /api/v1/portfolio/trades`
Get trade history.

---

### Alerts

#### `GET /api/v1/alerts`
List all alerts.

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_001",
      "symbol": "AAPL",
      "condition": "price_above",
      "threshold": 155.00,
      "status": "active",
      "triggered_at": null
    }
  ]
}
```

#### `POST /api/v1/alerts`
Create an alert.

#### `DELETE /api/v1/alerts/{id}`
Delete an alert.

---

### Runs (Backtest/Paper Runs)

#### `GET /api/v1/runs`
List all strategy runs.

**Response:**
```json
{
  "runs": [
    {
      "id": "run_001",
      "strategy_id": "strat_001",
      "mode": "backtest",
      "status": "completed",
      "start_time": "2025-01-01T00:00:00Z",
      "end_time": "2025-12-31T23:59:59Z",
      "metrics": {
        "total_return": 0.15,
        "sharpe_ratio": 1.2,
        "max_drawdown": -0.08
      }
    }
  ]
}
```

#### `POST /api/v1/runs`
Start a new run.

#### `GET /api/v1/runs/{id}`
Get run details.

---

### Packages (Indicator/Strategy Packages)

#### `GET /api/v1/packages`
List installed packages.

#### `POST /api/v1/packages`
Install a package.

#### `DELETE /api/v1/packages/{id}`
Uninstall a package.

---

### Incidents (Bundle Recording)

#### `GET /api/v1/incidents`
List recorded incidents/bundles.

**Response:**
```json
{
  "incidents": [
    {
      "id": "bundle_001",
      "name": "AAPL_2026-01-12_session",
      "recorded_at": "2026-01-12T16:00:00Z",
      "duration_seconds": 23400,
      "tick_count": 125000,
      "hash": "sha256:abc123..."
    }
  ]
}
```

#### `POST /api/v1/incidents/record`
Start recording a bundle.

#### `POST /api/v1/incidents/{id}/stop`
Stop recording.

#### `GET /api/v1/incidents/{id}/replay`
Get bundle for replay.

---

### Notes

#### `GET /api/v1/notes`
List all notes.

#### `POST /api/v1/notes`
Create a note.

#### `PUT /api/v1/notes/{id}`
Update a note.

#### `DELETE /api/v1/notes/{id}`
Delete a note.

---

### Reports

#### `GET /api/v1/reports`
List generated reports.

#### `POST /api/v1/reports`
Generate a new report.

#### `GET /api/v1/reports/{id}`
Get report content.

---

### Metrics (Observability)

#### `GET /api/v1/metrics`
Get system metrics (Prometheus format).

---

### Parity (Hash Verification)

#### `GET /api/v1/parity/{symbol}/{timeframe}`
Get parity hash for verification.

**Response:**
```json
{
  "symbol": "AAPL",
  "timeframe": "1m",
  "bar_count": 390,
  "hash": "sha256:def456...",
  "verified": true
}
```

---

## New Endpoints (To Be Implemented)

### Options Analytics

#### `GET /api/v1/options/chain/{symbol}`
Get options chain for a symbol.

**Response:**
```json
{
  "symbol": "AAPL",
  "underlying_price": 152.50,
  "expirations": ["2026-01-17", "2026-01-24"],
  "chains": {
    "2026-01-17": {
      "calls": [...],
      "puts": [...]
    }
  }
}
```

#### `GET /api/v1/options/greeks/{symbol}`
Get aggregate Greeks.

#### `GET /api/v1/options/iv-surface/{symbol}`
Get IV surface data.

---

### AI Endpoints

#### `POST /api/v1/ai/analyze`
Request AI analysis.

**Request Body:**
```json
{
  "type": "market_scan|backtest_analysis|incident_explain",
  "context": {...}
}
```

#### `POST /api/v1/ai/recommend`
Get AI strategy recommendations.

#### `GET /api/v1/ai/proposals`
List AI-generated proposals (drawings, annotations).

#### `POST /api/v1/ai/proposals/{id}/apply`
Apply an AI proposal.

---

### Automation (Autopilot)

#### `GET /api/v1/automation/status`
Get autopilot status.

**Response:**
```json
{
  "armed": false,
  "mode": "paper",
  "budget": {
    "max_total_notional": 10000,
    "max_daily_spend": 1000,
    "max_per_trade": 500,
    "current_spent_today": 250
  },
  "active_strategies": [],
  "kill_switch_triggered": false
}
```

#### `POST /api/v1/automation/arm`
Arm autopilot (requires confirmation).

#### `POST /api/v1/automation/disarm`
Disarm autopilot.

#### `POST /api/v1/automation/kill`
Emergency kill switch.

#### `GET /api/v1/automation/jobs`
List automation jobs.

#### `POST /api/v1/automation/jobs`
Queue a new job.

#### `GET /api/v1/automation/readiness/{strategy_id}`
Get strategy readiness score.

---

## WebSocket Channels

### Bar Streaming

#### `ws://localhost:8000/ws/bars/{symbol}/{timeframe}`

**Subscribe:**
```json
{"action": "subscribe", "symbol": "AAPL", "timeframe": "1m"}
```

**Message Types:**

1. **SUBSCRIBED** - Confirmation
```json
{"type": "SUBSCRIBED", "symbol": "AAPL", "timeframe": "1m"}
```

2. **BAR_HISTORICAL** - Historical bar
```json
{
  "type": "BAR_HISTORICAL",
  "bar": {
    "timestamp": 1736678400000,
    "open": 150.25,
    "high": 150.50,
    "low": 150.10,
    "close": 150.40,
    "volume": 125000
  }
}
```

3. **BAR_CONFIRMED** - Completed bar
```json
{
  "type": "BAR_CONFIRMED",
  "bar": {...}
}
```

4. **BAR_FORMING** - In-progress bar
```json
{
  "type": "BAR_FORMING",
  "bar": {...}
}
```

---

### Options Streaming (New)

#### `ws://localhost:8000/ws/options/{symbol}`

Streams real-time options chain updates.

---

### Whale Alerts (New)

#### `ws://localhost:8000/ws/whale-alerts`

Streams large order flow alerts.

**Message:**
```json
{
  "type": "WHALE_ALERT",
  "symbol": "AAPL",
  "side": "BUY",
  "size": 50000,
  "price": 152.50,
  "timestamp": 1736678400000
}
```

---

### Automation Events (New)

#### `ws://localhost:8000/ws/automation`

Streams autopilot events.

**Message Types:**
- `JOB_STARTED`
- `JOB_COMPLETED`
- `ORDER_PLACED`
- `BUDGET_WARNING`
- `KILL_SWITCH_TRIGGERED`

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid symbol format",
    "details": {...}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Missing/invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `PROVIDER_ERROR` | 502 | Upstream provider error |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| REST (general) | 100 req/min |
| WebSocket connections | 10 per IP |
| AI endpoints | 10 req/min |
| Automation actions | 60 req/min |

---

## Versioning

API version is indicated in the URL path: `/api/v1/...`

Breaking changes will increment the version number.

---

## CORS Configuration

Allowed origins (development):
- `http://localhost:5100`
- `http://localhost:4173`
- `http://127.0.0.1:5100`

---

## Changelog

### v1.0.0 (2026-01-12)
- Initial canonical contract specification
- Core endpoints: bars, clock, drawings, strategies, portfolio, alerts
- WebSocket: bar streaming
- Planned: options, AI, automation endpoints
