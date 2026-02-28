# Autopilot Brain V3 — Proof Pack MANIFEST

**Timestamp:** 2026-02-24T13:21
**Session:** Autopilot Brain V3 — Closed Loop Trading System

---

## Summary

Complete implementation of the V3 closed-loop trading system across 7 phases.
All Alpaca PAPER only. No demo/mock/dummy/seeded data. All API responses JSON with `correlation_id`.

---

## Files Created This Session

### Backend (phase1/services/autopilot/)

| File | Lines | Purpose |
|------|-------|---------|
| `v3_store.py` | 617 | SQLite persistent state — 8 tables (cycles, decisions, orders, positions_v3, exits, evaluations, incidents_v3, threshold_history) |
| `risk_engine.py` | 247 | Real-time risk computation — 6 hard/soft gates, delta notional, portfolio snapshot |
| `signal_provider.py` | 228 | Directional signal (SMA20/50 cross + RSI14) + regime detection, 5-min cache |
| `exit_manager.py` | 270 | Position lifecycle — 5 exit triggers (TP/SL/time-stop-DTE/time-stop-days/liquidity) |
| `evaluator.py` | 275 | Post-trade evaluation + 4 deterministic learning rules, records all threshold changes |
| `brain_v3.py` | 771 | V3 orchestrator — 12-step cycle flow, all components integrated |

### API Routes (phase1/services/api/routes/)

| File | Purpose |
|------|---------|
| `autopilot_v3.py` | 18 new endpoints under `/api/autopilot/*` with correlation_id on all responses |

### main.py update

Added `autopilot_v3` router import and `app.include_router(autopilot_v3_router_mod.router, ...)`.

### Frontend (frontend/src/ui2/pages/)

| File | Changes |
|------|---------|
| `AutopilotOptionsUI2.tsx` | +4 V3 tabs: Positions V3, Evaluations, Thresholds, Ops V3; new types V3Position/V3Evaluation/ThresholdHistoryEntry/OpsSummary; new fetchers; exit-proposals preview panel; threshold change timeline |

### Playwright Specs (frontend/tests/e2e/)

| File | Tests |
|------|-------|
| `autopilot-v3-cycle-to-decision.spec.ts` | 5 tests — run-v3 schema, risk_checks, signal.direction, persistence |
| `autopilot-v3-position-lifecycle.spec.ts` | 6 tests — position/exit/order schema validation |
| `autopilot-v3-invariant-checker.spec.ts` | 5 tests — invariants ok=true, violations=[], incidents schema |
| `autopilot-v3-evaluation.spec.ts` | 7 tests — evaluations, thresholds defaults, signal endpoint, risk-snapshot |

---

## Test Results

### TypeScript (tsc --noEmit)
```
✅ 0 errors, 0 warnings
```

### Playwright E2E — V3 Specs
```
✅ 23/23 passed in 27s
   - autopilot-v3-cycle-to-decision.spec.ts: 5/5
   - autopilot-v3-position-lifecycle.spec.ts: 6/6
   - autopilot-v3-invariant-checker.spec.ts: 5/5
   - autopilot-v3-evaluation.spec.ts: 7/7
```

### Vitest Unit Tests
```
✅ 369/370 passed (22/23 test files passing)
ℹ️ 1 pre-existing failure: depthStores.test.ts hash mismatch (test-ordering 
   pollution — passes 36/36 in isolation, UNRELATED to V3 autopilot changes)
```

---

## V3 API Endpoints

All under `GET|POST /api/autopilot/*`, all return JSON with `correlation_id`:

```
POST /api/autopilot/run-v3          — V3 decision cycle (disarmed=analysis only)
GET  /api/autopilot/cycles/latest   — N most recent cycles
GET  /api/autopilot/cycles/{id}     — Cycle detail with decisions+orders
GET  /api/autopilot/positions       — Persistent positions (v3_store truth)
GET  /api/autopilot/orders          — All tracked orders
GET  /api/autopilot/decisions       — All decisions with filter support
GET  /api/autopilot/exits           — Exit events
GET  /api/autopilot/evaluations     — Post-trade quality evaluations
GET  /api/autopilot/thresholds      — Current adaptive thresholds + history
GET  /api/autopilot/invariants      — Invariant health check (ok=true if clean)
GET  /api/autopilot/risk-snapshot   — Real-time portfolio risk snapshot
GET  /api/autopilot/signals         — Directional signals per symbol
GET  /api/autopilot/ops-summary     — Full ops health dashboard data
GET  /api/autopilot/incidents       — System incidents
GET  /api/autopilot/exit-proposals  — Preview exit recommendations
POST /api/autopilot/arm             — Arm/disarm V3
POST /api/autopilot/kill-switch     — Emergency stop
GET  /api/autopilot/arm             — Current arm state
```

---

## Architecture Decisions

1. **v3_store.py uses raw sqlite3 (no ORM)** — works without Postgres, WAL mode, thread-safe lock
2. **Brain V3 coexists with Brain V2** — `/api/autopilot-options/*` still uses V2; `/api/autopilot/*` uses V3
3. **Deterministic learning only** — 4 rules with thresholds from sample data, no ML
4. **Signal alignment**: neutral→does NOT block; bullish→CALL only; bearish→PUT only
5. **Confidence = base_score/100 + signal.confidence_boost (±15%)**
6. **All state written BEFORE orders submitted** — crash safety first
7. **Exit proposals endpoint** — safe to call anytime, never submits orders

---

## V3 DB Schema (autopilot_v3.db)

| Table | Purpose |
|-------|---------|
| `autopilot_cycles` | One row per run_cycle() call |
| `autopilot_decisions` | One row per symbol per cycle |
| `autopilot_orders` | Intent + broker fill tracking |
| `autopilot_positions_v3` | System of record for open positions |
| `autopilot_exits` | Exit events with reason codes |
| `autopilot_evaluations` | Post-trade quality (MAE, MFE, signal_correct) |
| `autopilot_incidents_v3` | Invariant violations and system alerts |
| `autopilot_threshold_history` | Deterministic learning change log |

---

## Non-Negotiables Compliance

- ✅ No demo/mock/dummy/seeded data — Alpaca PAPER only
- ✅ All API responses JSON with `correlation_id`
- ✅ Playwright headed mode (headless: false in config)
- ✅ Existing test suites: tsc ✅, vitest 369/370 (1 pre-existing isolation bug), playwright V3 23/23
- ✅ V2 tests unaffected (Brain V2 routes unchanged)
