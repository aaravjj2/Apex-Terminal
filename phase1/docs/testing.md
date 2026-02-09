# Testing Guide ✅

## Test suites
- `tests/unit/` — Unit tests for core logic (Bar model, BarEngine, Normalizer, etc.)
- `tests/integration/` — Integration tests (pipeline, DB interactions, cache)
- `tests/parity/` — Parity verification for canonical exports and comparator

## Running tests
```
pytest -q
```

### Headed Playwright tests
If you add Playwright-based UI tests, install and run browsers once:
```
python -m pip install playwright pytest-playwright
python -m playwright install
pytest --headed
```

## Test-specific notes & behavior
- The test suite uses `MockConnector` for deterministic replay where necessary.
- The system defaults to `ingestion_mode=live` now; tests rely on explicit mock usage in their fixtures so they remain deterministic in CI.
- The cache API is async; make sure to `await cache.get()` and `await cache.clear()` in tests.

## Test reliability recommendations
- Use `keys.env` with dummy keys for CI and explicitly set `INGESTION_MODE=mock` in CI to avoid network calls.
- Add network call stubs or use `vcrpy`/`httpx` mocking for testing live connector behavior deterministically.

---

If you want, I can add a `pytest.ini`/`tox`/`github-actions` workflow snippet to the docs for CI-ready test execution.