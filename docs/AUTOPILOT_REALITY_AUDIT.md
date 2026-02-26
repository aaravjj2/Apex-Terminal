# Autopilot Reality Audit
**Date:** 2026-02-25  
**Auditor:** Autopilot Revolution Agent  
**Repo:** Apex Terminal  
**Branch:** main  

---

## 1. Executive Summary

The Autopilot subsystem exists as a substantial but partially-connected system.
The core brain, risk engine, and quote/options gateways are implemented with real-data paths.
Several **demo/seed/mock data** occurrences were found in runtime paths and have been catalogued here for removal.

---

## 2. Code Path Map: End-to-End (UI2 → API → Brain → Broker → Persistence → UI2)

```
UI2 (AutopilotCommandCenterUI2.tsx)
  │
  ├── GET  /api/ops/autopilot/version        → ops_autopilot.py:get_version()
  ├── GET  /api/ops/autopilot/health         → ops_autopilot.py:get_health()
  ├── GET  /api/ops/autopilot/cycle          → ops_autopilot.py:get_last_cycle()
  ├── POST /api/ops/autopilot/arm            → ops_autopilot.py:arm_autopilot()
  ├── POST /api/ops/autopilot/run-now        → ops_autopilot.py:run_now()
  │
  ├── GET  /autopilot/status                 → unified_router.py:get_status()
  ├── POST /autopilot/cycle                  → unified_router.py:run_cycle()
  ├── GET  /autopilot/positions              → unified_router.py:get_positions()
  ├── GET  /autopilot/runs                   → unified_router.py:list_runs()
  │
  ├── GET  /api/autopilot-options/health     → autopilot_options_router:health()
  ├── GET  /api/autopilot-options/decisions  → autopilot_options_router:decisions()
  ├── GET  /api/autopilot-options/rejections → autopilot_options_router:rejections()
  ├── GET  /api/autopilot-options/orders     → autopilot_options_router:orders()
  ├── GET  /api/autopilot-options/positions  → autopilot_options_router:positions()
  ├── GET  /api/autopilot-options/pnl        → autopilot_options_router:pnl_summary()
  │
  └── WS   /ws/autopilot                     → autopilot_websocket.py
                                                  ↓
                              AutopilotService (service.py — singleton)
                                  uses UnifiedAutopilotEngine (unified_engine.py)
                                        ↓
                             ┌──────────────────────────────┐
                             │  BrainV3 (brain_v3.py)       │
                             │  ┌──────────────────────┐    │
                             │  │ A. Data Plane         │    │
                             │  │   QuoteGateway        │    │  ← Alpaca WS / REST / yfinance
                             │  │   OptionsGateway      │    │  ← Alpaca Options API (paper)
                             │  │   MarketSession       │    │  ← trading_window.py (ET)
                             │  ├──────────────────────┤    │
                             │  │ B. Signal Plane       │    │
                             │  │   SignalProvider      │    │  ← signal_provider.py
                             │  │   RegimeClassifier    │    │  ← regime_classifier.py
                             │  ├──────────────────────┤    │
                             │  │ C. Candidate Gen      │    │
                             │  │   EnhancedCandidates  │    │  ← enhanced_candidates.py
                             │  │   ContractScorer      │    │  ← contract_scorer.py
                             │  ├──────────────────────┤    │
                             │  │ D. Brain / Policy     │    │
                             │  │   DecisionEngine      │    │  ← decision_engine.py
                             │  │   RiskEngine          │    │  ← risk_engine.py (hard caps)
                             │  ├──────────────────────┤    │
                             │  │ E. Execution          │    │
                             │  │   OptionsGateway      │    │  ← options_gateway.py (Alpaca paper)
                             │  │   ExecutionLadder     │    │  ← execution_ladder.py
                             │  ├──────────────────────┤    │
                             │  │ F. Position Lifecycle │    │
                             │  │   ExitManager         │    │  ← exit_manager.py
                             │  │   PositionAgent       │    │  ← position_agent.py
                             │  ├──────────────────────┤    │
                             │  │ G. Observability      │    │
                             │  │   CycleIndexer        │    │  ← cycle_indexer.py
                             │  │   V3Store             │    │  ← v3_store.py (SQLite)
                             │  └──────────────────────┘    │
                             └──────────────────────────────┘
                                        ↓
                             Alpaca Paper Broker
                               - Order placement (BTO/STC)
                               - Position reads
                               - Account / buying power
                                        ↓
                             SQLite: autopilot_v3.db
                               cycles / decisions / orders / positions_v3 / exits / evaluations
                                        ↓
                             Elasticsearch (optional)
                               cycle_indexer.py → index "autopilot-cycles-*"
                                        ↓
                             UI2 polling / WS push
```

---

## 3. Demo / Seed / Mock Occurrences Audit

### 3.1 Critical — Remove from Runtime Paths

| File | Line Pattern | Status | Resolution |
|------|-------------|--------|------------|
| `phase1/services/autopilot/execution_simulator.py` | `SimulatedFill`, random fill generation | REMOVE from runtime | Only allowed in backtest/sandbox paths |
| `phase1/services/autopilot/paper_broker.py` | `_simulate_fill()` call | REVIEW | Must route to Alpaca paper, not local simulator |
| `phase1/services/autopilot/data_fetcher.py` | `_generate_mock_bars()` fallback | REMOVE | Must fail with structured error if real data unavailable |
| `phase1/fixtures/` | All fixture files | BLOCK | Must never load from fixtures in production runtime |
| `phase1/services/autopilot/backtest_engine.py` | Simulated pricing used in live path | ISOLATE | Backtest only |
| `phase1/services/autopilot/v1_providers.py` | `MockQuoteProvider` | REMOVE | Replace with `QuoteGateway` singleton only |
| `phase1/services/autopilot/v1_templates.py` | Seeded trade templates | REMOVE | No pre-seeded decisions |

### 3.2 Non-Critical — Test/Backtest Only (acceptable)

| File | Usage | Status |
|------|-------|--------|
| `phase1/tests/` | All fixture/mock usage inside `tests/` | ACCEPTABLE |
| `phase1/data/*.csv` | Historical OHLCV for deterministic backtest | ACCEPTABLE |
| `phase1/services/autopilot/backtest_engine.py` | Simulation within backtest module | ACCEPTABLE |
| `frontend/src/ui2/` | No mock data in import chains | VERIFIED OK |

### 3.3 Endpoints That Were Returning Seeded Trades

| Endpoint | Problem | Fix |
|----------|---------|-----|
| `/api/v1/autopilot/trades` (legacy) | Returned `trade_ledger.json` fixture | DEPRECATED — route removed |
| `/api/autopilot-options/decisions` | May return empty list as `[]` if no cycles run | ACCEPTABLE — empty is honest |
| `/api/autopilot-options/positions` | Must read from Alpaca, not ledger | VERIFIED — reads `alpaca_client.get_positions()` |

---

## 4. Panels Showing Non-Broker-Truth Data

| Panel / Tab | Previous Behavior | Required Behavior |
|-------------|------------------|-------------------|
| AutopilotUI2 → Positions | Read from `trade_ledger.json` | Must read from `/autopilot/positions` → Alpaca |
| AutopilotV2UI2 → Orders | Read from simulator | Must read from Alpaca `/v2/orders` |
| AutopilotOptionsUI2 → PnL | Used local simulated pricing | Must use `unrealized_pl` from Alpaca position records |
| AutopilotCommandCenter → Status Strip | Hardcoded "Connected" badge | Must be live check against Alpaca health endpoint |

All panels have been updated as part of this revolution to use broker-truth data through the command center.

---

## 5. Feature Flags Map

| Flag | Env Var | Default | Meaning |
|------|---------|---------|---------|
| `quote_gateway_ws` | `FF_QUOTE_GATEWAY_WS` | `0` | Enable Alpaca WS real-time quotes |
| `options_chain_live` | `FF_OPTIONS_CHAIN_LIVE` | `0` | Enable live Alpaca options chain fetch |
| `regime_classifier_v2` | `FF_REGIME_CLASSIFIER_V2` | `1` | Enable enhanced regime classifier |
| `es_cycle_indexing` | `FF_ES_CYCLE_INDEXING` | `1` | Index cycles to Elasticsearch |
| `position_agents` | `FF_POSITION_AGENTS` | `1` | Enable per-symbol position agents |
| `llm_tiebreak` | `FF_LLM_TIEBREAK` | `0` | Use LLM for tie-breaking between equal-score candidates |

---

## 6. Risk Controls Inventory

All enforced in `risk_engine.py` BEFORE order submission. Cannot be bypassed via API.

| Control | Value | Gate Type |
|---------|-------|-----------|
| `max_premium_per_trade_usd` | $500 | hard — blocks trade |
| `max_total_premium_open_usd` | $2,000 | hard — blocks if exceeded |
| `max_positions` | 4 concurrent | hard — blocks new entries |
| `max_daily_loss_usd` | $200 | hard — triggers kill switch |
| `max_delta_notional_total` | $50,000 | hard |
| `max_delta_notional_per_symbol` | $20,000 | hard |
| `max_bp_utilization_pct` | 30% | hard |
| `exit_spread_pct_threshold` | 15% | soft — triggers exit check |

---

## 7. Market Session Truth

Server-side truth lives in `trading_window.py`:
- Reads `alpaca_clock` from Alpaca `/v2/clock` when connected
- Falls back to `pandas_market_calendars` with NYSE calendar
- All time in America/New_York (ET)
- API: `GET /api/ops/market_session` → `{state, allow_trading, reason, trigger_flatten}`

---

## 8. LLM Use Constraints

The LLM (Gemini / Groq / Ollama) can ONLY be used for:
1. Post-cycle narrative summaries (cosmetic)
2. Explanation text for decisions (display only)
3. Cache by prompt hash — stored in `autopilot_llm_logs` table

The LLM CANNOT:
- Produce an order payload
- Override risk checks
- Select a contract
- Influence entry/exit prices

All order payloads are generated deterministically by `brain_v3.py` → `risk_engine.py` → `options_gateway.py`.

---

## 9. Observability Coverage

| Entity | SQLite Table | ES Index | UI Tab |
|--------|-------------|----------|--------|
| Cycles | `autopilot_cycles` | `autopilot-cycles-*` | Cycles |
| Decisions | `autopilot_decisions` | `autopilot-decisions-*` | Decisions |
| Rejections | embedded in `decisions` | `autopilot-rejections-*` | Rejections |
| Orders | `autopilot_orders` | `autopilot-orders-*` | Orders |
| Positions | `autopilot_positions_v3` | `autopilot-positions-*` | Positions |
| Exits | `autopilot_exits` | via positions index | Exit events in positions drawer |
| Evaluations | `autopilot_evaluations` | `autopilot-evals-*` | PnL / Eval |
| LLM responses | `autopilot_llm_logs` | — | LLM tab |

---

## 10. Remediation Actions Required

### Immediate (runtime demo removal):
```bash
# Search for banned words in runtime paths (must return 0 for each):
grep -rn "mock\|demo\|seed\|fixture\|simulated" \
  phase1/services/autopilot/ \
  --include="*.py" \
  -l | grep -v "_test\|backtest\|simulator\|evaluation"
```

### Structural Improvements Shipped (this revolution):
1. `AutopilotCommandCenterUI2.tsx` — new single-source-of-truth Cockpit, all tabs, all data-testid
2. `phase1/services/autopilot/signal_engine_v2.py` — enhanced signal plane reading real bars
3. `phase1/services/autopilot/data_pipeline.py` — data plane orchestrator with SLA enforcement
4. `phase1/services/autopilot/cycle_observer.py` — immutable cycle event emitter
5. `phase1/services/autopilot/execution_engine_v2.py` — clean execution engine with full lifecycle
6. `phase1/services/autopilot/position_journal.py` — position lifecycle journal synced to broker
7. `frontend/tests/e2e/autopilot_live/` — 5 Playwright MCP spec files
8. `artifacts/proof/<timestamp>-autopilot-revolution/` — proof pack

---

*End of Autopilot Reality Audit*
