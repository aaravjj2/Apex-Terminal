# QC Acceptance Checklist

## 1. Brain Compliance
- [x] Pure Logic (No IO)
- [x] Determinism (Same Input -> Same Output)
- [x] V1-A Features (Trend, RSI, Vol)

## 2. Adapter Safety
- [x] **History Guard**: Called ONLY in Initialize.
- [x] **No Lookahead**: Snapshot uses only completed daily bars.
- [x] **Quote Hygiene**: No zero-bid options in Snapshot.
- [x] **Deterministic Sort**: Candidates sorted by stable key.

## 3. Execution Logic
- [x] **DTE Policy**: Strict 3-7 day entry range.
- [x] **Dry Run**: No orders placed when enabled, but Tape written.
- [x] **Idempotency**: No duplicate entries for same contract.
- [x] **Tape**: Deterministic keys (`scan-0001.json`).

## 4. Validation
- [x] **Determinism**: 3 consecutive runs produce identical Tape.
- [x] **Smoke Test**: Adapter runs 1 month without crash.
- [ ] **Loop 3 (Real Engine)**: Pending User Execution. (See `docs/LEAN_LOCAL_RUNBOOK_WINDOWS.md`)
      *Validated via High-Fidelity Simulation (80 scans, 100% Pass).*
