PROJECT DOCUMENTATION — Phase 1: Deterministic Data & Bar Engine
===============================================================

Status & Snapshot
-----------------
- Tests: 676 passed (661 Unit + 15 Int/Parity) (Verified 2026-01-12)
- Zero-Trust Reset: 100% Pass Rate confirmed on Fresh Launch.
- Frontend: Verified Launch (Port 5100) & E2E (Dashboard Load Pass).
- Backend: Verified Launch (Port 8000) & API Response.
- Default ingestion mode: **live** (can be overridden per-run with `--mode mock` or `INGESTION_MODE` env)
- Primary docs consolidated into this single file (previous `docs/` folder is deprecated)

Table of contents
-----------------
1. Quick start
2. Architecture overview
3. Connectors
4. Running the system
5. Parity verification
6. Testing
7. Persistence & cache
8. Scripts and utilities
9. Developer notes & contributing
10. Changelog & bug tickets


1) Quick start
--------------
Requirements
- Python 3.11+ (3.12 tested)
- Recommended: virtual environment
- Optional: API keys for live connectors (store in `keys.env`)

Install
```
cd phase1
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Env (example in `keys.env`):
```
FINNHUB_API_KEY=...
APCA_API_KEY_ID=...
APCA_API_SECRET_KEY=...
INGESTION_MODE=live
DATABASE_URL=sqlite:///./phase1.db
```

Smoke test (live):
```
# Short live run (10s) verifying connection to configured live connector
timeout 10s bash -lc "cd phase1 && python -u -m services.ingestion.main --mode live --symbols AAPL"
```

Mock replay (deterministic offline runs):
```
python scripts/run_mock.py --csv fixtures/aapl_test_ticks.csv --symbols AAPL --timeframes 1m
```


2) Architecture overview
------------------------
High-level components:
- Ingestion service (`services.ingestion.main.IngestionService`) orchestrates connectors, normalizer, bar engine, persistence, and WebSocket broadcasting.
- Normalizer (`services.ingestion.normalizer.TickNormalizer`) canonicalizes ticks and enforces ordering/dedup.
- Bar engine (`services.bar_engine`) aggregates ticks into OHLCV bars across timeframes.
- Persistence (`services.persistence`) stores bars in DB, with `BarCache` (async LRU) and `TieredBarStore`.
- Parity/Verifier (`services.verifier`) exports deterministic CSVs and compares with references.

Data flow: Connector → Normalizer → Bar Engine → Store (Cache + DB) → Export/Parity


3) Connectors
-------------
Common interface in `BaseConnector`:
- `connect()`, `disconnect()`, `subscribe(symbols)`, `unsubscribe(symbols)`, `get_historical_ticks()` (async iterator), `register_callback(cb)`

Implemented connectors:
- `MockConnector` (CSV replay): `load_from_csv()`, `replay_ticks()`, `inject_tick(s)`
- `FinnhubConnector`: live WebSocket streaming + REST fallback (requires `FINNHUB_API_KEY`)
- `AlpacaConnector`: REST polling & historicals (requires `APCA_*` creds)
- `YFinanceConnector`: historical backfills (yfinance-based)

Notes:
- Default runtime mode is `live`. Use `--mode mock` or set `INGESTION_MODE=mock` for deterministic runs or CI.


4) Running the system
---------------------
Ingestion service (default `live`):
```
cd phase1
python -m services.ingestion.main --mode live --symbols AAPL,MSFT
```

API server (separate terminal):
```
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8000
```

Short smoke test (live):
```
timeout 10s bash -lc "cd phase1 && python -u -m services.ingestion.main --mode live --symbols AAPL"
```

Mock replay (CSV -> engine/store):
```
python scripts/run_mock.py --csv fixtures/aapl_test_ticks.csv --symbols AAPL --timeframes 1m --output output_bars.csv
```


5) Parity verification
----------------------
Canonical exporter (`CanonicalExporter`) formats CSV deterministically and `compute_hash()` returns `sha256:<hex>`.

`BarComparator` compares local bars with reference CSVs using `price_tolerance` & `volume_tolerance`.

CLI helper: `scripts/parity_compare.py --reference ref.csv --csv generated.csv --tolerance 1e-6`


6) Testing
----------
- Unit: `tests/unit/`
- Integration: `tests/integration/`
- Parity: `tests/parity/`

Run all tests:
```
pytest -q
```
Headed Playwright tests (if added):
```
python -m pip install playwright pytest-playwright
python -m playwright install
pytest --headed
```

Notes:
- Tests are deterministic and use `MockConnector` when needed. Default ingestion mode is `live`, so CI should set `INGESTION_MODE=mock` or run with `--mode mock` for test runs.
- Be sure to `await` async cache APIs in tests: `await cache.get(...)` and `await cache.clear()`.


7) Persistence & cache
----------------------
- Repository: `BarRepository` (SQLAlchemy + aiosqlite or PostgreSQL)
- Cache: `BarCache` is an async LRU; `TieredBarStore` reads from cache first then DB, writes both.


8) Scripts & utilities
----------------------
- `scripts/run_mock.py` — deterministic CSV replay into engine/store
- `scripts/parity_compare.py` — CLI parity tool to compare generated vs reference CSVs


9) Developer notes & contributing
--------------------------------
- Defaults now run in `live` mode. Use `INGESTION_MODE=mock` in CI or `--mode mock` locally for deterministic tests.
- For contributors: create small PRs, add tests for API changes, update this document if you change behavior.


10) Changelog & bug tickets
---------------------------
See consolidated changelog below (most recent entries):

2026-01-08 — Phase 1 stabilization
- Tests fixed and passing across unit/integration/parity.
- Defaults changed: `ingestion_mode` defaulted to `live`.
- Parity, exporter, comparator, and scripts updated for deterministic hashing & comparison.
- Bug tickets captured (docs/phase1/bug_tickets/), notable fixes: parity API mismatches, script import fixes, cache async fixes.


Appendix
--------
- To transition to a single-file doc officially, the `docs/` directory is now deprecated and its contents are superseded by this file. If you'd like the `docs/` files removed automatically, confirm and I will delete them.


If you want any sections expanded (e.g., add sample output CSV, diagrams, CI workflow snippets, or example GitHub Actions), tell me which and I'll add them inside this same file.