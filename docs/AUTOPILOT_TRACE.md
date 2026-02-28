# AUTOPILOT TRACE — Real Code Path Map

> Generated: 2026-02-24
> Purpose: Document the exact code path from UI2 button → API → decision → broker → persistence → UI2

---

## 1. Architecture Overview

```
┌──────────────────────── Frontend (Vite :5100) ────────────────────────┐
│ AutopilotUI2.tsx ──→ autopilotStore.ts / autopilot2Store.ts          │
│   ↓ fetch('/api/v1/autopilot/cycle', POST)                          │
│   ↓ fetch('/api/v1/autopilot/status', GET)                          │
│   ↓ fetch('/api/v1/autopilot/positions', GET)                       │
│   ↓ fetch('/api/v1/autopilot/kill-switch', POST)                    │
└──────────────────────────────────────────────────────────────────────┘
                              ↓ Vite proxy → :8000
┌─────────────────── Backend (FastAPI :8000) ──────────────────────────┐
│ main.py (lifespan)                                                   │
│   ├─ AutopilotService.start_background_loop(60s)                     │
│   └─ AutopilotService.start_monitoring_loop(15s)                     │
│                                                                      │
│ unified_router.py (prefix=/autopilot, mounted at /api/v1)            │
│   ├─ POST /cycle  → engine.run_cycle()                               │
│   ├─ GET  /status → engine status + session stats                    │
│   ├─ GET  /positions → AlpacaBrokerClient.list_positions()           │
│   ├─ POST /kill-switch → engine.activate_kill_switch()               │
│   ├─ GET  /health → connectivity check                               │
│   ├─ GET  /think-log → decision trace from RunArtifact               │
│   ├─ GET  /broker/sync → BrokerSyncService.sync()                   │
│   ├─ GET  /broker/metrics → account balance from Alpaca              │
│   └─ POST /config → update config + save to disk                     │
│                                                                      │
│ unified_engine.py (UnifiedAutopilotEngine)                           │
│   run_cycle() → 9-phase pipeline:                                    │
│   ├─ Phase 1: DATA_REFRESH                                          │
│   │   └─ _refresh_market_data() → yfinance/Alpaca price series      │
│   ├─ Phase 2: BROKER_REFRESH                                        │
│   │   └─ _refresh_broker_state() → AlpacaBrokerClient.list_pos/ord  │
│   ├─ Phase 3: MONITORING                                            │
│   │   └─ _run_monitoring_pass() → ExitMonitor.evaluate()            │
│   ├─ Phase 4: CANDIDATE_GENERATION                                  │
│   │   └─ _generate_candidates() → DecisionEngine.scan_universe()    │
│   ├─ Phase 5: SELECTION                                              │
│   │   └─ _select_candidates() → rank by score                       │
│   ├─ Phase 6: VALIDATION                                            │
│   │   └─ _validate_candidate() → risk gates, sentiment gates        │
│   ├─ Phase 7: EXECUTION                                              │
│   │   └─ _execute_trades() → AlpacaBrokerClient.submit_order()      │
│   ├─ Phase 8: PERSISTENCE                                           │
│   │   └─ _persist_artifact() → RunArtifact saved to history         │
│   └─ Phase 9: UI_UPDATE                                              │
│       └─ _emit_ui_events() → WebSocket broadcast                    │
│                                                                      │
│ alpaca_client.py (AlpacaBrokerClient)                                │
│   ├─ Uses alpaca-py TradingClient (paper=True)                       │
│   ├─ Credentials: APCA_API_KEY_ID + APCA_API_SECRET_KEY             │
│   ├─ Base URL: https://paper-api.alpaca.markets                      │
│   ├─ V1 GATE: Market orders BANNED, limit only                      │
│   ├─ submit_order() → LimitOrderRequest                             │
│   ├─ _submit_multileg_order() → atomic MLEG with 5% slippage        │
│   ├─ flatten_all() → cancel all orders + close all positions         │
│   └─ get_clock() → market hours from Alpaca or synthetic fallback   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key File Paths

| Layer | File | Lines | Purpose |
|-------|------|-------|---------|
| **API Router** | `phase1/services/autopilot/unified_router.py` | 1114 | ONLY autopilot API (25+ endpoints) |
| **Engine** | `phase1/services/autopilot/unified_engine.py` | 2313 | 9-phase cycle, RunArtifact, ThinkLog |
| **Service** | `phase1/services/autopilot/service.py` | 357 | Background loops (60s cycle + 15s monitor) |
| **Broker Client** | `phase1/services/autopilot/alpaca_client.py` | 817 | Alpaca SDK wrapper (positions, orders, clock) |
| **Broker v2** | `phase1/services/autopilot/alpaca_broker.py` | 293 | Dual paper+Alpaca hybrid |
| **Paper Broker** | `phase1/services/autopilot/paper_broker.py` | 500 | Internal sim (fill modeling, commissions) |
| **Decision** | `phase1/services/autopilot/decision_engine.py` | 301 | 7-step decision pipeline |
| **Candidates** | `phase1/services/autopilot/candidates.py` | 1118 | TradeCandidate + OptionLeg generation |
| **Config** | `phase1/services/autopilot/config.py` | 694 | Risk limits, templates, universe |
| **Exit Monitor** | `phase1/services/autopilot/exit_monitor.py` | 453 | Stop loss, profit target, trailing |
| **Position Agent** | `phase1/services/autopilot/position_agent.py` | 160 | Per-position monitoring agent |
| **Trading Window** | `phase1/services/autopilot/trading_window.py` | 292 | 9:30am→2:15pm ET gate |
| **Broker Sync** | `phase1/services/autopilot/broker_sync.py` | 195 | Full Alpaca reconciliation |
| **Position Mgr** | `phase1/services/autopilot/broker_position_manager.py` | 706 | Internal metadata for Alpaca positions |
| **Options Adapter** | `phase1/services/options/alpaca_adapter.py` | 280 | Options chain from Alpaca Data API |
| **Options Models** | `phase1/services/options/models.py` | 348 | OptionContract, OptionChain, Greeks |
| **Market Clock** | `phase1/services/clock/market_clock.py` | 370 | Live/virtual time source |
| **WebSocket** | `phase1/services/api/autopilot_websocket.py` | — | Autopilot event streaming |
| **UI2 Page** | `frontend/src/ui2/pages/AutopilotUI2.tsx` | 624 | Main autopilot page (5 tabs) |
| **UI2 Page v2** | `frontend/src/ui2/pages/AutopilotV2UI2.tsx` | 296 | Pipeline candidates page |
| **UI2 Explain** | `frontend/src/ui2/pages/AutopilotExplainUI2.tsx` | 347 | Decision explainability |
| **Store** | `frontend/src/ui2/stores/autopilotStore.ts` | 136 | Kill switch + rules |
| **Store v2** | `frontend/src/ui2/stores/autopilotV2Store.ts` | ~200 | Pipeline run store |
| **Main.py** | `phase1/services/api/main.py` | 547 | App factory + lifespan |

---

## 3. Payload Schemas

### POST /api/v1/autopilot/cycle (Request)
```json
{ "dry_run": false, "force": false }
```

### POST /api/v1/autopilot/cycle (Response: CycleResponse)
```json
{
  "run_id": "run-20260224-143022-abc123",
  "success": true,
  "duration_ms": 1250.5,
  "candidates_generated": 5,
  "candidates_selected": 2,
  "exits_triggered": 0,
  "exits_executed": 0,
  "orders_filled": 1,
  "no_action_reasons": [],
  "error": null
}
```

### GET /api/v1/autopilot/status (Response: StatusResponse)
```json
{
  "is_running": true,
  "automation_enabled": true,
  "kill_switch_active": false,
  "current_phase": "idle",
  "last_run_id": "run-...",
  "last_run_timestamp": "2026-02-24T14:30:22.000Z",
  "last_run_success": true,
  "cycle_count": 42,
  "state": "running",
  "kill_switch": false,
  "cycles_completed": 42,
  "trades_executed": 8,
  "win_rate": 0.75,
  "avg_win": 0.0,
  "avg_loss": 0.0,
  "sharpe_ratio": null,
  "last_cycle_at": "2026-02-24T14:30:22.000Z"
}
```

### GET /api/v1/autopilot/positions (Response)
```json
{
  "positions": [
    {
      "symbol": "AAPL260320C00225000",
      "qty": 1, "side": "long",
      "avg_entry_price": 3.50, "current_price": 4.10,
      "market_value": 410.0, "unrealized_pnl": 60.0, "unrealized_pnl_pct": 17.1,
      "asset_class": "us_option",
      "underlying": "AAPL", "expiration": "2026-03-20",
      "strike": 225.0, "option_type": "call", "dte": 24,
      "managed": true, "run_id": "run-...",
      "strategy_template": "long_call"
    }
  ],
  "portfolio": { "total_pnl": 60.0, "open_positions": 1 },
  "count": 1
}
```

### POST /api/v1/autopilot/kill-switch (Request)
```json
{ "active": true, "close_all": true }
```

---

## 4. Risk Controls (Server-side, cannot be bypassed)

| Control | Value | Source |
|---------|-------|--------|
| Max open positions | 10 | `V1_MAX_OPEN_POSITIONS` |
| Max total exposure | $1,000 | `V1_MAX_TOTAL_EXPOSURE_USD` |
| Per-position stop | 10% | `V1_PER_POSITION_STOP_PCT` |
| Max risk per trade | 10% of equity | `RiskLimits.max_risk_per_trade_pct` |
| Max buying power usage | 50% | `RiskLimits.max_buying_power_pct` |
| Max daily loss | 10% of equity | `RiskLimits.max_daily_loss_pct` |
| Max daily trades | 6 | `RiskLimits.max_daily_trades` |
| Max positions per underlying | 1 | `RiskLimits.max_positions_per_underlying` |
| Max per cluster | 2 | `RiskLimits.max_positions_per_cluster` |
| Market order ban | Enforced | `submit_order()` raises ValueError |
| Anti-thrash | Loss cooldown | `AntiThrashControls` |
| Trading window | 9:30am–2:15pm ET | `TradingWindowGate` |
| Kill switch | Instant halt | `activate_kill_switch(close_all=True)` |

---

## 5. Demo/Mock/Seeded Data Audit

| File | Finding |
|------|---------|
| `unified_engine.py` | No seeded data. Empty `_run_history` list on init. |
| `unified_router.py` | `/positions` fetches from live Alpaca. No mock positions. |
| `alpaca_client.py` | Real SDK calls. Synthetic clock only if SDK unavailable. |
| `decision_engine.py` | Scans universe live. No pre-computed results. |
| `candidates.py` | Generates from real market data. No hardcoded trades. |
| `service.py` | Background loop calls real engine. No stub cycles. |
| `AutopilotExplainUI2.tsx` | **WARNING**: Contains 4 hardcoded demo decisions for UI scaffolding. These are display-only and do NOT affect runtime behavior. Must be replaced. |
| `autopilotStore.ts` | Contains client-side rule toggles (simulated). No mock orders. |

**Verdict**: Runtime path is clean — no demo/seeded/mock data in production code paths. The `AutopilotExplainUI2.tsx` has display-only demo decisions that will be superseded by the new Autopilot Options UI2 page.

---

## 6. Options Trading Path (Current State)

```
AlpacaOptionsAdapter.get_chain(symbol)
  → Alpaca Data API /v1beta1/options/chains
  → Falls back to indicative quotes for Basic plan
  → Returns OptionChain (contracts + strikes + expirations)

AlpacaBrokerClient.submit_order(symbol, qty, "buy", "limit", limit_price)
  → V1 GATE: Market orders rejected
  → LimitOrderRequest via alpaca-py TradingClient
  → Returns AlpacaOrder (id, status, fills)

AlpacaBrokerClient._submit_multileg_order(candidate)
  → Builds OCC symbols from OptionLeg data
  → OptionLegRequest[] → MLEG OrderClass
  → 5% slippage tolerance
  → Returns AlpacaOrder
```

**Gap**: No dedicated `AlpacaOptionsGateway` class exists. Options chain fetching is in `services/options/alpaca_adapter.py`, order submission is in `alpaca_client.py`. These need to be unified into a single gateway for the new autopilot flow.
