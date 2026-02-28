# AUTOPILOT LEGACY PARITY CONTRACT

> **Version:** 1.0.0
> **Baseline Commit:** `9580ba5613c3bd6bd1e22da53fa2e8333db2b05a`
> **Maintainer:** Apex Terminal Engineering
>
> This contract defines the minimum observable behaviors that the production autopilot
> system MUST satisfy. Any implementation that passes all contract checks is considered
> "legacy-parity compliant." Violations are bugs, not features.

---

## 1. Contract Philosophy

The legacy autopilot (`9580ba5`) did four things unambiguously:

1. **Connected** — all external dependencies (Alpaca, yfinance, ES, Tradier) returned
   live data before a cycle started.
2. **Cycled** — a `POST /api/v1/autopilot/cycle` returned `{"success":true}` with real
   `candidates_generated`, `exits_triggered`, non-null `run_id`.
3. **Reported** — every cycle produced a persisted `RunArtifact` readable via
   `GET /api/v1/autopilot/run/{run_id}`.
4. **Guarded** — orders were validated before execution; the kill-switch was always
   reachable and honored within 1 cycle.

This contract codifies those four behaviors plus the UI surface required to observe them.

---

## 2. Required UI Screens (Frontend Parity)

The operator-facing UI MUST expose the following tabs/panels. Each tab MUST be reachable
from the main autopilot page and render without error when the backend is live:

| Tab | `data-testid` | Minimum Required Content |
|-----|---------------|--------------------------|
| **Status / Overview** | `autopilot-status-panel` | `is_running`, `automation_enabled`, `cycle_count`, `current_phase`, `last_run_id` |
| **Decisions** | `autopilot-decisions-panel` | Candidates selected in last cycle; columns: `symbol`, `strategy`, `confidence`, `reason` |
| **Rejections** | `autopilot-rejections-panel` | Candidates rejected in last cycle; columns: `symbol`, `gate`, `reason` |
| **Orders** | `autopilot-orders-panel` | Orders submitted; columns: `symbol`, `side`, `qty`, `status`, `filled_at` |
| **Positions** | `autopilot-positions-panel` | Open broker positions; columns: `symbol`, `qty`, `avg_entry`, `current_pnl` |
| **PnL** | `autopilot-pnl-panel` | Cumulative P&L curve or table across run history |
| **Ops Health** | `autopilot-ops-health-panel` | All dep checks (alpaca, elasticsearch, yfinance, tradier, news_provider) with `ok/degraded/error` badge |

---

## 3. Required Backend Endpoints

### MUST return 200 at all times (even outside market hours)

```
GET  /api/v1/autopilot/status
GET  /api/v1/autopilot/runs
GET  /api/v1/autopilot/health
GET  /api/v1/autopilot/broker/metrics
GET  /api/ops/autopilot/health
GET  /api/ops/autopilot/version
```

### MUST return 200 given valid body

```
POST /api/v1/autopilot/cycle          body: {"dry_run": bool, "force": bool}
POST /api/v1/autopilot/kill-switch    body: {"activate": bool}
POST /api/ops/autopilot/arm
POST /api/ops/autopilot/run-now
```

### Response Shape Invariants

**`GET /status`** MUST include:
```json
{
  "is_running": <bool>,
  "automation_enabled": <bool>,
  "kill_switch_active": <bool>,
  "current_phase": <string>,
  "cycle_count": <integer>,
  "last_run_id": <string|null>,
  "state": <string>,
  "trades_executed": <integer>
}
```

**`POST /cycle` success** MUST include:
```json
{
  "run_id": <string matching /^UAC-\d{14}-\d{4}$/>,
  "success": true,
  "duration_ms": <number gt 0>,
  "candidates_generated": <integer gte 0>,
  "candidates_selected": <integer gte 0>,
  "error": null
}
```

**`GET /ops/health` OK** MUST include:
```json
{
  "ok": true,
  "checks": [
    {"name": "alpaca", "status": "ok"},
    {"name": "elasticsearch", "status": "ok"},
    {"name": "yfinance", "status": "ok"}
  ],
  "market_session": {"state": <string>, "allow_trading": <bool>}
}
```

---

## 4. Behavioral Invariants (Hard Rules)

These invariants MUST pass for every cycle. Violations must be surfaced as incidents:

### 4.1 Exit-Before-Entry
```
INVARIANT: CyclePhase.MONITORING completes BEFORE CyclePhase.CANDIDATE_GENERATION starts.
PROOF: RunArtifact.phase_timings["monitoring"].end_ts < RunArtifact.phase_timings["candidate_generation"].start_ts
```

### 4.2 Fill-Without-Position Mismatch
```
INVARIANT: If orders_filled > 0, then live broker positions MUST contain the traded symbol
           OR a closing order for that position must exist in the same cycle.
TOLERANCE: 30 seconds (Alpaca propagation lag allowed)
VIOLATION: Create incident type "FILL_WITHOUT_POSITION" with run_id, symbol, timestamp
```

### 4.3 No Demo Data in Runtime
```
INVARIANT: Status endpoint must never return mock run IDs (format: "mock-*", "demo-*", "seed-*").
INVARIANT: Broker metrics must never return exactly {"equity": 100000.0, "buying_power": 100000.0, "cash": 100000.0}.
INVARIANT: Positions endpoint must never return {"symbol": "DEMO", ...} entries.
```

### 4.4 Kill-Switch Honored
```
INVARIANT: When kill_switch_active = true, POST /cycle MUST return {"success": false, "error": "kill_switch_active"}.
INVARIANT: Kill-switch can be toggled back to false via POST /kill-switch {"activate": false}.
```

### 4.5 Cycle Run-ID Format Parity
```
INVARIANT: All run_id values MUST match the regex /^UAC-\d{14}-\d{4}$/.
EXAMPLE: UAC-20260225172643-0001
```

### 4.6 Determinism (Two-Run Rule)
```
INVARIANT: Two identical successive cycles (same market context, same positions, same
           candidates) MUST produce the same selection set.
PROOF: Run cycle twice in <5 seconds; diff candidates_selected — must be identical.
       (LLM is advisory/non-blocking; selection algorithm itself is deterministic.)
```

---

## 5. Structured Event Log Contract

Every cycle MUST emit a structured event log entry with the following minimum fields.
This entry must be persisted to the database and accessible via `GET /api/v1/autopilot/run/{run_id}`.

```json
{
  "run_id": "UAC-20260225172643-0001",
  "correlation_id": "<uuid4>",
  "cycle_number": 1,
  "started_at": "<ISO-8601>",
  "completed_at": "<ISO-8601>",
  "market_session": "flatten_required",
  "allow_trading": false,
  "candidates_generated": 1,
  "candidates_selected": 1,
  "rejections": [],
  "exits_triggered": 1,
  "exits_executed": 0,
  "orders_filled": 0,
  "duration_ms": 6794.296,
  "phase_timings": {
    "data_refresh_ms": <number>,
    "broker_refresh_ms": <number>,
    "monitoring_ms": <number>,
    "candidate_generation_ms": <number>,
    "selection_ms": <number>,
    "validation_ms": <number>,
    "execution_ms": <number>,
    "persistence_ms": <number>,
    "ui_update_ms": <number>
  },
  "error": null
}
```

---

## 6. Incident Contract

The system MUST detect and surface the following incident types. Incidents are written
to the `incidents` table and accessible via `GET /api/incidents` (existing endpoint):

| Incident Type | Trigger Condition | Severity |
|--------------|-------------------|----------|
| `AUTOPILOT_CYCLE_ERROR` | `RunArtifact.success == false` with non-null `error` | HIGH |
| `FILL_WITHOUT_POSITION` | `orders_filled > 0` but symbol absent from broker positions after 30s | CRITICAL |
| `STALE_QUOTES` | Data refresh returns quotes older than 5 minutes during market hours | MEDIUM |
| `STALE_OPTIONS_CHAIN` | Options chain age > 10 minutes during market hours | MEDIUM |
| `BROKER_STALENESS` | Broker refresh returns positions with last_trade_time > 60s old | MEDIUM |
| `KILL_SWITCH_ACTIVATED` | Kill switch toggled to `true` | INFO |
| `ENCODING_ERROR` | Any `UnicodeEncodeError` in autopilot subsystem | HIGH |

---

## 7. No-Demo Verification

This contract requires that the live system has NO demo/mock/seed data in its runtime
paths. The following checks MUST pass:

```python
# Check 1: No mock run IDs
runs = GET /api/v1/autopilot/runs
assert not any(r["run_id"].startswith(("mock-", "demo-", "seed-")) for r in runs)

# Check 2: No hardcoded broker equity
metrics = GET /api/v1/autopilot/broker/metrics
assert not (metrics["equity"] == 100000.0 and metrics["buying_power"] == 100000.0)

# Check 3: No demo positions
positions = GET /api/v1/autopilot/positions
assert not any(p["symbol"] == "DEMO" for p in positions.get("positions", []))

# Check 4: Alpaca directly confirmed in health
health = GET /api/ops/autopilot/health
alpaca_check = next(c for c in health["checks"] if c["name"] == "alpaca")
assert alpaca_check["status"] == "ok"
```

---

## 8. UI Parity Checklist (Playwright Verification)

The following `data-testid` attributes MUST be present and non-empty in the rendered UI
when the backend is live:

```
[data-testid="autopilot-status-panel"]         — visible
[data-testid="autopilot-phase-badge"]           — shows current_phase value
[data-testid="autopilot-cycle-count"]           — shows integer >= 0
[data-testid="autopilot-last-run-id"]          — shows run_id or "—"
[data-testid="autopilot-arm-button"]            — clickable
[data-testid="autopilot-kill-switch-button"]   — clickable
[data-testid="autopilot-ops-health-panel"]     — shows all dep rows
[data-testid="autopilot-decisions-panel"]      — visible (may be empty list)
[data-testid="autopilot-rejections-panel"]     — visible (may be empty list)
[data-testid="autopilot-positions-panel"]      — visible
[data-testid="autopilot-orders-panel"]         — visible
```

---

## 9. Parity Compliance Matrix

| Contract Section | Verified By | Status |
|-----------------|-------------|--------|
| §3 All endpoints return 200 | `legacy-health.spec.ts` | [x] Implemented |
| §4.1 Exit-before-entry | `legacy-cycle-disarmed.spec.ts` | [x] Implemented |
| §4.3 No demo data | `legacy-no-demo.spec.ts` | [x] Implemented |
| §4.4 Kill-switch honored | `legacy-cycle-disarmed.spec.ts` | [x] Implemented |
| §4.5 Run-ID format | `legacy-health.spec.ts` | [x] Implemented |
| §4.6 Determinism | `legacy-reconciliation.spec.ts` | [x] Implemented |
| §5 Structured event log | `legacy-cycle-armed-order-preview.spec.ts` | [x] Implemented |
| §7 No demo data | `legacy-no-demo.spec.ts` | [x] Implemented |
| §8 UI parity | `legacy-ui-parity.spec.ts` | [x] Implemented |

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-25 | Initial contract derived from commit `9580ba5` and live endpoint verification |

---

*This contract is binding. Any PR that changes `unified_engine.py`, `unified_router.py`,
`service.py`, or `ledger.py` MUST include evidence that all invariants in §4 still hold.*
