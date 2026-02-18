# Architecture Overview 🔧

## High-level components

- **Ingestion Service** (`services.ingestion.main.IngestionService`)
  - Orchestrates connectors, normalizer, bar engine, persistence, and broadcasting.
  - Modes: `live` (default) or `mock` (explicit) — live mode uses real connectors like Finnhub.

- **Connectors** (`services.ingestion.connectors`)
  - `MockConnector` — CSV-based replay for deterministic tests and offline debugging.
  - `FinnhubConnector` — WebSocket streaming + REST fallbacks.
  - `AlpacaConnector` — REST-based polling/paper trading interface.
  - `YFinanceConnector` — Historical backfill; produces synthetic ticks.

- **Normalizer** (`services.ingestion.normalizer.TickNormalizer`)
  - Canonicalizes raw ticks into `CanonicalTick` for the bar engine.
  - Deduplication and monotonic ordering protections.

- **Bar Engine** (`services.bar_engine`)
  - Aggregates incoming canonical ticks into bars across configured timeframes.
  - Emits forming bars and confirmed bars via callbacks; supports multi-symbol engine.

- **Persistence** (`services.persistence`)
  - `BarRepository` — Database CRUD for bars (SQLAlchemy + aiosqlite support).
  - `BarCache` — Async LRU in-memory cache.
  - `TieredBarStore` — Cache-first read, cache+DB write path.

- **Parity & Verifier** (`services.verifier`)
  - `CanonicalExporter` — Deterministic CSV export and hash computation.
  - `BarComparator` — Tolerance-aware comparison of generated vs reference bars.

- **Scripts**
  - `scripts/run_mock.py` — Run mock ingestion from CSV into engine/store.
  - `scripts/parity_compare.py` — CLI for parity comparison of generated vs reference CSVs.

## Data flow

1. Connector receives tick (live stream or CSV replay).
2. Tick is normalized to `CanonicalTick`.
3. `BarEngine` processes ticks and forms bars per timeframe.
4. Confirmed bars are persisted via `TieredBarStore` (cache + repository).
5. Parity verification or exporter tools can export bars deterministically for diffing and hashing.

---

For more details on each component see the linked docs in this directory.