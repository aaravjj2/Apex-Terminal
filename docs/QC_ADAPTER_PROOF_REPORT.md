# QC Adapter Proof Report

**Date:** 2026-01-26
**Status:** **VALIDATED & HARDENED**

## 1. History Integrity
*   **Where Called:** `RollingStore.seed_history` (called only from `Initialize` in `main.py`).
*   **Safety:** History is strictly one-shot for seeding.
*   **Risk:** `RollingStore.add` assumes completed bars.
*   **Mitigation (Implemented):**
    *   `RollingStore.add` deduplicates by timestamp and works only on Daily bars passed via `OnData`.
    *   Strict type conversion ensures no leakage of QC objects into Brain.

## 2. Option Logic
*   **DTE Calculation:** Implemented `(expiry - current).days` in `SnapshotBuilder`.
*   **Filtering:**
    *   **Strict Filter:** `3 <= dte <= 7`.
    *   **Strike Band:** `+- 5%` from Underlying Price.
*   **Quotes:**
    *   **Hygiene:** Explicit check `bid > 0.05` and `ask > bid`. Zero-bid options are rejected.

## 3. Determinism
*   **Sorting:** `SnapshotBuilder` explicitly sorts options by `(Underlying, Expiry, Right, Strike, ContractID)` tuple.
*   **Candidates:** Brain sorts candidates by Score + ContractID.
*   **Verification:** `tests/brain/test_determinism.py` passed.

## 4. State & Tape
*   **Storage:** `StateStore` persists `BrainState` via pickle.
*   **Decision Tape:** Implemented JSONL writing to `tape/YYYY-MM-DD/scan-NNNN.json`.
    *   **Keying:** Deterministic `scan_index` logic ensures no overwrites.
    *   **Schema:** Includes `run_id`, `scan_index`, `snapshot_ready`, `actions`, `rejections`.
    *   **Validated:** `qc_harness.py` confirms tape existence and content.

## 5. Dry Run & Observability
*   **Gate:** `OrderRouter` has a strict `if self.dry_run` block for order placement.
*   **Observability:** Logic separates *Decision persistence* from *Order Execution*.
    *   Even when `dry_run=True`, `main.py` persists the Decision Tape (`write_tape_record`) and logs intention.
    *   Validated: Harness confirmed 0 orders placed but Tape record created.

## 6. Validation Summary
*   **Loop 1 (Unit):** Brain Determinism & Imports passed.
*   **Loop 2 (UI):** Playwright Smoke Test (Real Runner) passed.
*   **Loop 3 (Backtest):** High-Fidelity Python Simulation passed (Jan 2023).
    *   **Proxy Status:** **READY FOR REAL ENGINE**.
    *   **Sim Coverage:** 20 Days, 80 Scans, 80 Tape Files.
    *   **Real Engine:** Execution Blocked (Env). See `docs/LEAN_LOCAL_RUNBOOK_WINDOWS.md`.

## Hardening Status
1.  **RollingStore**: ✅ Deduplication & Conversion added (Strict Daily).
2.  **SnapshotBuilder**: ✅ Sorting, Quote Hygiene, Strict DTE (Date-based) added.
3.  **StateStore**: ✅ Decision Tape (JSON) with Deterministic Keying added.
4.  **OrderRouter**: ✅ Idempotency & Dry-Run Observability added.
