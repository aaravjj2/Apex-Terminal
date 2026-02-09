# Phase 2: Realtime & Replay Parity (Deterministic Reproduction)

This repository now implements Phase 2 features: deterministic realtime replay parity, a virtual market clock for deterministic tests, a tick replayer for deterministic emission, parity hashing and signed parity proofs, an E2E Playwright harness, and a 3-loop CI runner that enforces strict TDD (unit → integration → parity → E2E).

## Snapshot & Status ✅
- Tests: **275 passed, 1 skipped** (verified 2026-01-08)
- Python: **3.12+** recommended for Phase 2 features
- Release: **Phase 2 complete** — see new modules & scripts below

---

## What’s New in Phase 2 🔧
- **Deterministic Market Clock** (`services/clock/market_clock.py`)
  - Virtual mode for deterministic step-through and deterministic advance/seek/freeze semantics.
- **Deterministic Tick Replayer** (`services/replay/tick_replayer.py`)
  - CSV and in-memory tick sources, deterministic emission, batching and callbacks.
- **Parity Hashing & Signatures** (`services/parity/hashing.py`)
  - StreamHasher / ParityTracker for live vs replay comparison, incremental checkpoints, and signed parity proofs using HMAC.
- **E2E Playwright Harness** (`tests/e2e/harness.py`)
  - Browser-driven capture of live vs replay WebSocket streams, visual checks, message recording and hashing.
- **3-Loop CI Runner** (`scripts/run_3loop.py`) ✅
  - Automates the strict 3-loop verification: unit → integration → parity (optionally E2E). Loops until all tests pass or max iterations reached.

---

## Quick Links
- Documentation: `DOCUMENTATION.md` (source of truth)
- Scripts: `scripts/run_mock.py`, `scripts/parity_compare.py`, `scripts/run_3loop.py`
- Tests: `tests/unit/`, `tests/integration/`, `tests/parity/`, `tests/e2e/`

---

## Quick Start (Phase 2)

### Prerequisites
- Python 3.12+
- Docker & Docker Compose (optional)
- PostgreSQL (or use SQLite for development)
- Playwright (for E2E) — see `pip install playwright` and `playwright install`

### Environment Variables
Use `keys.env` or `.env`:

```bash
# API / keys
FINNHUB_API_KEY=your_finnhub_key
APCA_API_KEY_ID=your_alpaca_key
APCA_API_SECRET_KEY=your_alpaca_secret
APCA_ENDPOINT=https://paper-api.alpaca.markets

# Database
DATABASE_URL=sqlite:///./phase1.db

# Server
API_HOST=0.0.0.0
API_PORT=8000
```

### Installation

```bash
cd phase1
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# If you plan to run E2E tests:
pip install playwright
python -m playwright install
```

### Useful Commands
- Run API server (dev):
```bash
python -m uvicorn services.api.main:app --reload
```

- Run deterministic replay (example):
```bash
python -m scripts.run_mock --input fixtures/aapl_2025_01_minute_ticks.csv --replay
```

---

## APIs & WebSocket (Same as Phase 1)
- REST: `/api/v1/bars/{symbol}/{timeframe}` — confirmed bars
- WS: `ws://localhost:8000/ws/bars/{symbol}/{timeframe}` — forms and confirmed events

Message types include `BAR_FORMING` and `BAR_CONFIRMED` (now may include `hash` field used in parity verification).

---

## Parity & Verification 🔐
- The project uses canonical normalization + SHA256 for deterministic parity checks.
- Parity workflow:
  1. Capture live stream (messages/bars) and compute stream hash (StreamHasher/ParityTracker).
  2. Replay the same source deterministically using `DeterministicTickReplayer` (virtual clock) and compute replay stream hash.
  3. Compare hashes; generate signed proof (HMAC) describing match/mismatch.

Commands:
```bash
# Export bars for comparison
curl "http://localhost:8000/api/v1/parity/export/AAPL/1m?from=2025-01-02&to=2025-01-03" > local_bars.csv

# Compare (CSV-based)
python -m scripts.parity_compare --local local_bars.csv --reference tradingview_export.csv --output diff_report.json
```

Programmatic APIs available in `services.parity.hasing` for generating proofs and verifying them.

---

## E2E Playwright Harness 🧪
- `tests/e2e/harness.py` provides utilities to:
  - Start/stop local server (ServerManager)
  - Record WebSocket streams (WebSocketRecorder)
  - Run live vs replay parity tests (ParityE2ERunner)
  - Visual checks via Playwright (VisualVerifier)

Run E2E tests (headless):
```bash
# Run specific E2E test file
pytest --headed tests/e2e/ -k test_parity_flow -s

# Run all E2E tests headless
pytest tests/e2e/ -k "not slow" -v
```
Tip: Use `--headed` to run Playwright in headed mode for interactive debugging (supported by test helpers in the repo).

---

## 3-Loop CI Runner (Strict TDD) 🔁
- Script: `scripts/run_3loop.py`
- Purpose: Run unit → integration → parity (→ optionally E2E). If any step fails, iterate (up to max iterations) until everything passes.

Usage:
```bash
# Default: 3 iterations, no E2E
python scripts/run_3loop.py --project-root . --max-iterations 3

# Include E2E tests (may require Playwright & browser dependencies)
python scripts/run_3loop.py --project-root . --max-iterations 5 --include-e2e --report ./build/3loop_report.json
```

Output: JSON report containing per-iteration pass/fail counts and pass rates.

---

## Testing (Phase 2 additions)

Run everything:
```bash
# Full test suite
pytest tests/ -v

# Run unit tests only
pytest tests/unit/ -v

# Run integration tests
pytest tests/integration/ -v

# Run parity tests
pytest tests/parity/ -v

# Run E2E (requires Playwright)
pytest tests/e2e/ -v --headed
```

Notes:
- The Parity tests include a skipped test when a cross-check fixture is not present (this is intentional for CI reproducibility).
- The 3-loop runner automates the iterative re-run & reporting (preferred for release verification).

---

## Architecture (Updated)
```
phase1/
├── services/
│   ├── clock/           # MarketClock (LIVE / VIRTUAL)
│   ├── replay/          # Replay controller, Tick replayer
│   ├── parity/          # Stream hashing & parity proofs
│   ├── ingestion/       # Data connectors
│   ├── bar_engine/      # Aggregation & lifecycle
│   └── api/             # FastAPI REST + WebSocket
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── parity/
│   └── e2e/             # Playwright-based E2E harness
├── fixtures/
└── scripts/             # run_mock, parity_compare, run_3loop
```

---

## Determinism Guarantees (Phase 2)
1. **Clock determinism**: Virtual market clock ensures identical timing for replay runs
2. **Emission determinism**: `TickSource` + `DeterministicTickReplayer` produce deterministic sequences from the same seed/input
3. **Canonical normalization**: Identical JSON normalization across runs for repeatable hashing
4. **Incremental checkpoints**: StreamHasher can produce checkpoints (chunked), enabling efficient incremental verification
5. **Signed proofs**: HMAC-signed parity proofs provide tamper-evident verification of match/mismatch

---

## Contributing & Release Process
- Follow TDD: add unit -> integration -> parity tests for every feature
- Use `scripts/run_3loop.py` before creating a release branch and ensure **all** loops pass
- For any parity regression, add failing parity test and debug using `tests/e2e/harness.py`

---

## Contact & Support
- Slack: `#data-parity`
- Issues: Create ticket in this repo with `parity` label

---

## License
MIT

