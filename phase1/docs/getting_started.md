# Getting Started 🚀

## Prerequisites
- Python 3.11+ / 3.12 recommended
- `pip` or other package manager
- Optional: API keys for live connectors (store them in `keys.env` at project root)

## Recommended packages (examples)
```
python -m pip install -r requirements.txt
# If a requirements.txt is not provided, install minimal packages used in tests:
python -m pip install pytest pytest-asyncio pytest-playwright structlog sqlalchemy aiosqlite cachetools
```

## Environment
- Create `.env` or `keys.env` at repository root to store API keys. Example variables (from existing `keys.env`):
  - `FINNHUB_API_KEY` — required for Finnhub live streaming
  - `APCA_API_KEY_ID`, `APCA_API_SECRET_KEY` — for Alpaca
  - `INGESTION_MODE` — override default ingestion mode (default is `live`)

## Project Layout (key files)
- `services/ingestion` — connectors and ingestion orchestration
- `services/bar_engine` — bar aggregation and internal logic
- `services/persistence` — repo, cache, and DB models
- `services/verifier` — canonical export and comparator
- `scripts/` — run utilities (mock runner, parity compare)
- `tests/` — unit, integration, parity tests

## Quick start
1. Activate venv: `python -m venv .venv && source .venv/bin/activate`
2. Install dependencies (see above)
3. Ensure `keys.env` contains necessary keys (or run in mock mode explicitly)
4. Run tests: `pytest -q`

To run the ingestion service (live mode):
```
cd phase1
python -m services.ingestion.main --mode live --symbols AAPL,MSFT
```
To replay from CSV using mock mode:
```
python scripts/run_mock.py --csv fixtures/aapl_test_ticks.csv --symbols AAPL --timeframes 1m
```

---

If you'd like, I can add a `requirements.txt` and a simple `Makefile` to make this setup fully reproducible.