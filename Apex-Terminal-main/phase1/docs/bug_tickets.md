# Bug Tickets and Fixes 🐞

This project followed a Test → Bug Ticket → Fix workflow while stabilizing Phase 1.

## Summary of notable tickets

- **Ticket 001-006** — Various import and API mismatches detected in early test runs (fixes included renaming, imports, and adding exports).
- **Ticket 007** — Parity tests failing due to mismatched API names and hash format. Fixed by renaming `export_to_csv` → `export_csv`, updating hash length expectations, and adding `compare_with_reference`.
- **Ticket 008** — `scripts/run_mock.py` import error and usage of `settings`; fixed by using `get_settings()` and aligning save/load method names.

## Where to find more details
- Historical tickets are captured under `docs/phase1/bug_tickets/` and in-memory notes within the repo. If you'd like, I can open GitHub issues for each ticket with PRs attached.

## Tips
- When creating new tests, if an AttributeError appears, check for API naming mismatches (common causes observed during stabilization).

---

Let me know if you want these tickets exported to a project tracker (e.g., GitHub Issues) automatically.