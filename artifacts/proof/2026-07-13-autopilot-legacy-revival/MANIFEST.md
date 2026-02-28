# Autopilot Legacy Revival — Proof Pack

**Date:** 2026-02-25  
**Baseline commit:** `9580ba5613c3bd6bd1e22da53fa2e8333db2b05a`  
**Contract version:** `v1.0.0`  
**Engineer:** GitHub Copilot (Claude Sonnet 4.6)

---

## Gates Passed

| Gate | Result | Detail |
|------|--------|--------|
| `tsc --noEmit` | ✅ 0 errors | Clean TypeScript compile |
| `pytest tests/ -q` | ✅ 0 new failures | 1598 passed; 16 pre-existing chart renderer failures (unrelated) |
| Playwright legacy suite (run 1) | ✅ 84/84 passed | `playwright-legacy-output.txt` |
| Playwright legacy suite (run 2 — determinism) | ✅ 84/84 passed | `playwright-legacy-final.txt` |

---

## Root Bug Fixed

| | |
|-|-|
| **Bug** | Windows cp1252 encoder crashed on emoji `🛑` (U+1F6D1) in log output |
| **Symptom** | Every autopilot cycle returned `"success": false`, `"error": "charmap codec can't encode..."` |
| **Fix** | `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` in `phase1/services/api/main.py` |
| **Env** | Backend started with `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` |
| **Verified** | Live cycle returns `"success": true`, `"candidates_generated": 1` |

---

## Hardening Changes

### 1. `correlation_id` in RunArtifact  
`phase1/services/autopilot/unified_engine.py`  
- Added `correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))` to `RunArtifact` dataclass  
- Included in `to_dict()` output  
- **Live verified:** `"correlation_id": "629edfb2-ce22-4d78-9c58-fe911460732a"` in run artifact  

### 2. Structured event logging  
`phase1/services/autopilot/unified_engine.py`  
- `CYCLE_COMPLETE` event emitted via `structlog` on every successful cycle  
- `AUTOPILOT_CYCLE_ERROR` incident emitted via `structlog` on every exception  

### 3. Legacy Mode banner  
`frontend/src/ui2/pages/AutopilotCommandCenterUI2.tsx`  
- Banner with `data-testid="legacy-mode-banner"` added to UI  
- Shows baseline commit SHA (`data-testid="legacy-commit-sha"` = `9580ba5`)  
- Shows contract version (`data-testid="legacy-contract-version"` = `v1.0.0`)  
- Shows: "Real Alpaca paper · No demo data"  

---

## Documentation Created

| File | Purpose |
|------|---------|
| `docs/AUTOPILOT_LEGACY_REFERENCE.md` | Authoritative record: baseline commit, all endpoints, 10-phase cycle, key classes |
| `docs/AUTOPILOT_LEGACY_PARITY_CONTRACT.md` | Binding behavioral contract: invariants, endpoint shapes, event log spec, no-demo verification |

---

## Playwright Spec Files Created

| File | Tests | Coverage |
|------|-------|----------|
| `frontend/tests/e2e/autopilot_legacy/legacy-health.spec.ts` | ~15 | All endpoints return 200; run_id format; Alpaca connected; UI badges |
| `frontend/tests/e2e/autopilot_legacy/legacy-cycle-disarmed.spec.ts` | ~9 | Kill-switch; disarmed cycle returns success; no phantom orders |
| `frontend/tests/e2e/autopilot_legacy/legacy-cycle-armed-order-preview.spec.ts` | ~10 | Arm/disarm; cycle artifact shape; correlation_id; runs list growth |
| `frontend/tests/e2e/autopilot_legacy/legacy-reconciliation.spec.ts` | ~8 | Determinism; run_ids in list; Positions/PnL tabs render |
| `frontend/tests/e2e/autopilot_legacy/legacy-ui-parity.spec.ts` | ~29 | All 8 tabs; all key testids; buttons; status badges; content panels |
| `frontend/tests/e2e/autopilot_legacy/legacy-no-demo.spec.ts` | ~13 | No demo data; real broker metrics; no mock positions |

**Total: 84 tests, 0 failures**

---

## Run Artifact Shape (Verified)

```json
{
  "run_id": "UAC-20260223123456-0001",
  "correlation_id": "629edfb2-ce22-4d78-9c58-fe911460732a",
  "success": true,
  "candidates": {
    "generated": 1,
    "selected": 1,
    "details": [...]
  },
  "monitoring": {
    "exits_triggered": 1,
    "...": "..."
  },
  "orders": {
    "filled": 0,
    "...": "..."
  }
}
```

---

## Key API Reference (Canonical)

| Endpoint | Method | Body | Notes |
|----------|--------|------|-------|
| `/api/v1/autopilot/cycle` | POST | `{"dry_run": bool, "force": bool}` | ~5-10s; use `timeout: 60_000` |
| `/api/v1/autopilot/status` | GET | — | Returns `automation_enabled`, `is_running` |
| `/api/v1/autopilot/runs` | GET | `?limit=100` | Default limit=20; always use limit=100 |
| `/api/v1/autopilot/run/{id}` | GET | — | Full artifact with nested candidate/order/monitoring shape |
| `/api/v1/autopilot/kill-switch` | POST | `{"active": bool, "close_all": bool}` | Field is `active` (NOT `activate`) |
| `/api/ops/autopilot/arm` | POST | — | Sets `automation_enabled: true` |
| `/api/ops/autopilot/disarm` | POST | — | POST (NOT GET); sets `automation_enabled: false` |
| `/api/ops/autopilot/run-now` | POST | — | Background task; returns immediately |

---

## Artifacts in This Directory

```
artifacts/proof/2026-07-13-autopilot-legacy-revival/
├── MANIFEST.md                    ← this file
├── playwright-legacy-output.txt   ← run 1 output (earlier session)
└── playwright-legacy-final.txt    ← run 2 output (determinism confirmation)
```
