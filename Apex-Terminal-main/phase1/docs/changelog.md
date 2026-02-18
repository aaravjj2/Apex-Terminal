# Changelog 📝

All notable changes implemented during Phase 1 verification loops.

## 2026-01-08 — Phase 1 stabilization
- Tests: All unit, integration, and parity tests fixed and passing (49 passed, 1 skipped).
- Defaults: `ingestion_mode` changed to `live` by default.
- Fixes:
  - `CanonicalExporter` API normalized to `export_csv` and `compute_hash`.
  - `BarComparator` API extended with `compare_with_reference` and tolerance params (`price_tolerance`, `volume_tolerance`).
  - Repository API `get_bars` used consistently in tests (`get_bars_range` → `get_bars`).
  - Cache API is async — tests updated to `await` cache calls.
  - `MockConnector` buffer and replay behavior clarified and used by `run_mock.py`.
- Scripts:
  - `scripts/run_mock.py` updated to use `get_settings()` and corrected method names.
  - `scripts/parity_compare.py` updated to pass tolerances correctly to `BarComparator`.

## Tickets
- See `docs/bug_tickets.md` for details of created and resolved tickets.

---

If you want an automated CHANGELOG generator or release tagging in git, I can add a small workflow to create versioned releases.