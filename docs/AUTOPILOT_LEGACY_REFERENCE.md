# AUTOPILOT LEGACY REFERENCE

> **Classification:** Engineering Reference — Do Not Remove
>
> This document is the authoritative record of the "legacy-parity" autopilot baseline.
> All future changes to the autopilot engine MUST be diff'd against the invariants
> documented here before merging.

---

## 1. Legacy Commit (Reference Baseline)

| Field | Value |
|-------|-------|
| **Short SHA** | `9580ba5` |
| **Full SHA** | `9580ba5613c3bd6bd1e22da53fa2e8333db2b05a` |
| **Date** | Mon Feb 23 14:43:53 2026 -0500 |
| **Author** | aaravjj2 |
| **Subject** | Phase 0-2: Remove all demo/mock/fake data from runtime paths |
| **Branch** | main |

### What this commit established

- Replaced ALL hardcoded demo/mock/seed data with live data providers (Alpaca, yfinance,
  Tradier, NewsAPI, FinancialModelingPrep).
- Wired `unified_engine.py` + `unified_router.py` as the single, canonical autopilot
  execution path — no more `autopilot_routes.py` demo endpoints.
- Established the 10-phase cycle order (see §4).
- Eliminated `_generate_synthetic_bars()`, hardcoded stock prices, demo portfolio seeds.

---

## 2. Legacy Engine File Inventory

### Primary Engine Files (verified present, backed by git history)

| File | Lines | Purpose |
|------|-------|---------|
| `phase1/services/autopilot/unified_engine.py` | 2426 | Core execution brain — the ONLY cycle runtime |
| `phase1/services/autopilot/unified_router.py` | 1114 | API router, WebSocket relay, kill-switch, panic-close |
| `phase1/services/autopilot/service.py` | 357 | Singleton lifecycle — starts background loops |
| `phase1/services/autopilot/ledger.py` | 375 | Trade ledger — `TradeLedgerEntry`, `AutopilotRunSummary` |

### Original "Even Older" Legacy Files (preserved as `.bak`)

These files predate `9580ba5` and represent the **v0 runloop architecture**. They are kept
as `.bak` to preserve institutional memory:

| File | Lines | Architecture |
|------|-------|-------------|
| `phase1/services/autopilot/_legacy_runloop.py.bak` | 678 | `AutopilotRunloop` — scan→select→execute→monitor |
| `phase1/services/autopilot/_legacy_unified_cycle.py.bak` | 591 | `CycleMetrics` with per-phase timing, `to_dict()` serialization |

**Key structures from `.bak` files that must remain represented in the current engine:**

- `CycleResult` fields: `candidates`, `selection`, `validation`, `execution`, `monitoring`
- `CycleMetrics` fields: `data_refresh_ms`, `broker_refresh_ms`, `monitoring_ms`,
  `candidate_generation_ms`, `selection_ms`, `validation_ms`, `execution_ms`,
  `persistence_ms`, `ui_update_ms`, `total_ms`

---

## 3. API Endpoint Inventory (Legacy-Parity Surface)

### Primary Autopilot API (`/api/v1/autopilot/*`)
Mounted in `main.py` via `unified_autopilot_router` at prefix `/api/v1`.

| Method | Path | Response Shape | Notes |
|--------|------|----------------|-------|
| GET | `/api/v1/autopilot/status` | `StatusResponse` | `is_running`, `automation_enabled`, `kill_switch_active`, `cycle_count`, `current_phase`, `last_run_id`, `state`, `trades_executed` |
| POST | `/api/v1/autopilot/cycle` | `CycleResponse` | Body: `{"dry_run": bool, "force": bool}` — triggers a full 10-phase cycle |
| POST | `/api/v1/autopilot/kill-switch` | `KillSwitchResponse` | Body: `{"activate": bool}` — hard stop |
| GET | `/api/v1/autopilot/positions` | `PositionResponse` | Live broker positions from Alpaca |
| GET | `/api/v1/autopilot/run/{run_id}` | `RunArtifact` | Full run artifact by ID |
| GET | `/api/v1/autopilot/runs` | `list[RunArtifact]` | All historical runs |
| GET | `/api/v1/autopilot/health` | `HealthSnapshot` | Engine health + deps |
| GET | `/api/v1/autopilot/broker/metrics` | `BrokerMetrics` | `equity`, `buying_power`, `cash`, `day_trade_count` |

### Ops Autopilot API (`/api/ops/autopilot/*`)
Mounted in `main.py` directly (router has its own `/api/ops/autopilot` prefix).

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/ops/autopilot/version` | `app_version`, `schema_version`, `git_sha`, feature flags |
| GET | `/api/ops/autopilot/health` | Full dependency health tree (Alpaca, ES, yfinance, tradier, news) |
| GET | `/api/ops/autopilot/cycle` | Last completed cycle summary |
| POST | `/api/ops/autopilot/arm` | Enable `automation_enabled = true` |
| GET | `/api/ops/autopilot/disarm` | Force-disable automation |
| POST | `/api/ops/autopilot/run-now` | Trigger immediate cycle (equivalent to `/api/v1/autopilot/cycle`) |

---

## 4. The 10-Phase Cycle (Canonical Execution Order)

Defined in `unified_engine.py` → `CyclePhase` enum (lines 42-54):

```
Phase 1:  DATA_REFRESH        — pull market data, news, sentiment
Phase 2:  BROKER_REFRESH      — sync positions and open orders from Alpaca
Phase 3:  MONITORING          — evaluate exits FIRST (stop-loss, take-profit, time-exit)
Phase 4:  CANDIDATE_GENERATION — screen universe if risk budget allows
Phase 5:  SELECTION           — deterministic ranking (LLM optional/advisory)
Phase 6:  VALIDATION          — apply caps, liquidity, earnings, sentiment gates
Phase 7:  EXECUTION           — submit limit orders to Alpaca paper account
Phase 8:  PERSISTENCE         — write RunArtifact to autopilot_v3.db
Phase 9:  UI_UPDATE           — broadcast CYCLE_COMPLETE via WebSocket
Phase 10: COMPLETE            — final metrics, think log entry
```

**Invariant:** Phases MUST execute in this exact order. Phases 3 (exits) before Phase 7
(entries) is a hard safety requirement.

---

## 5. Key Classes and Functions

### `unified_engine.py`

| Symbol | Line | Description |
|--------|------|-------------|
| `CyclePhase` | 42 | Enum of the 10 execution phases |
| `ExitReason` | ~58 | Enum: `STOP_LOSS`, `TAKE_PROFIT`, `TIME_EXIT`, `MANUAL` |
| `ValidationGate` | ~75 | Enum: `CAP_BREACH`, `ILLIQUID`, `EARNINGS_BLOCK`, `SENTIMENT_FAIL` |
| `HealthSnapshot` | ~100 | Dataclass: `alpaca_ok`, `es_ok`, `yfinance_ok`, `tradier_ok`, `market_session` |
| `MarketContext` | ~120 | Dataclass: `market_open`, `session_state`, `allow_trading`, `flatten_required` |
| `RunArtifact` | ~200 | Dataclass: full cycle result persisted to DB |
| `UnifiedAutopilotEngine` | 549 | Main class — singleton managing state + cycle execution |
| `UnifiedAutopilotEngine.run_cycle()` | 784 | The 10-phase cycle — must be called with `force=True` outside market hours |
| `get_unified_engine()` | ~2420 | Module-level factory returning the singleton |

### `unified_router.py`

| Symbol | Description |
|--------|-------------|
| `CycleRequest` | Body model: `{"dry_run": bool, "force": bool}` |
| `StatusResponse` | Full status shape returned by `GET /status` |
| `run_cycle()` at line 259 | Primary cycle endpoint handler |
| `run_cycle_legacy()` at line 287 | Legacy compat handler |

---

## 6. Known Working State (Verified Live — 2026-02-25)

```json
GET /api/v1/autopilot/status
{
  "is_running": true,
  "automation_enabled": false,
  "kill_switch_active": false,
  "current_phase": "complete",
  "last_run_id": "UAC-20260225172643-0001",
  "cycle_count": 1,
  "state": "running",
  "trades_executed": 0
}

GET /api/ops/autopilot/health
{
  "ok": true,
  "checks": [
    {"name": "alpaca", "status": "ok", "latency_ms": 22.24},
    {"name": "elasticsearch", "status": "ok", "latency_ms": 269.41},
    {"name": "yfinance", "status": "ok", "latency_ms": 295.85},
    {"name": "tradier", "status": "ok", "latency_ms": 0.0},
    {"name": "news_provider", "status": "ok"}
  ],
  "market_session": {
    "state": "flatten_required",
    "allow_trading": false,
    "reason": "After trading cutoff (14:15:00)"
  }
}

POST /api/v1/autopilot/cycle {"dry_run": false, "force": false}
{
  "run_id": "UAC-20260225172643-0001",
  "success": true,
  "duration_ms": 6794.296,
  "candidates_generated": 1,
  "candidates_selected": 1,
  "exits_triggered": 1,
  "exits_executed": 0,
  "orders_filled": 0,
  "no_action_reasons": [],
  "error": null
}
```

---

## 7. Root Bug Fixed: Windows cp1252 Emoji Encoding

### Symptom
Cycles failed with `'charmap' codec can't encode character '\U0001f6d1' in position 38`.
The emoji `🛑` (U+1F6D1) in `unified_engine.py` line 1828 and other autopilot files hit
the Windows default `cp1252` encoder when writing to log handlers.

### Fix Applied (2026-02-25)
1. **`phase1/services/api/main.py` lines 7-11:** Added UTF-8 reconfiguration at module top:
   ```python
   import sys
   if hasattr(sys.stdout, "reconfigure"):
       sys.stdout.reconfigure(encoding="utf-8", errors="replace")
   if hasattr(sys.stderr, "reconfigure"):
       sys.stderr.reconfigure(encoding="utf-8", errors="replace")
   ```
2. **Backend startup:** `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8` set in env.

### Files with Emoji in Logs (all now safe)
- `broker_position_manager.py` (5 emoji lines — print/logger)
- `exit_monitor.py` (9 emoji lines — logger.warning/info)
- `llm_advisor.py` (2 emoji lines — string literals)
- `position_agent.py` (6 emoji lines — logger.info)
- `profit_taker.py` (6 emoji lines — logger.info)
- `reporting.py` (6 emoji lines — markdown strings)
- `service.py` (5 emoji lines — logger.warning)
- `unified_engine.py` (45 emoji lines — think log + logger)
- `unified_router.py` (3 emoji lines — logger.warning)
- `v1_execution_contract.py` (6 emoji lines — logger.warning)

---

## 8. Outstanding Gaps at Baseline (Parity Contract Targets)

These items are required by `AUTOPILOT_LEGACY_PARITY_CONTRACT.md` but were absent at
the `9580ba5` baseline:

| Gap | Status | Fix |
|-----|--------|-----|
| `correlation_id` on every cycle event | Not present | Add in Phase 3 hardening |
| Incident detection (stale quotes, fill-without-position) | Not present | Add in Phase 3 |
| "Legacy Mode" UI banner showing active commit + parity version | Not present | Phase 3 frontend |
| Structured JSON event log per cycle (replaces ad-hoc logger calls) | Partial | Phase 3 |
| `/api/v1/autopilot/decisions` endpoint (selected candidates) | Not present | Phase 3 |
| `/api/v1/autopilot/rejections` endpoint (validation rejections) | Not present | Phase 3 |

---

*Document generated: 2026-02-25. Derived from git history, live endpoint verification,
and direct code inspection of `phase1/services/autopilot/`.*
