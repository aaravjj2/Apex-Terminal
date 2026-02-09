# Run Commands & Examples ⚙️

## Run tests
- Run entire test suite (fast):
```
pytest -q
```
- Run specific tests:
```
pytest tests/integration/test_pipeline.py -k TestEndToEndPipeline -q
```
- Run tests in headed mode (for Playwright):
```
pytest --headed
```

## Ingestion service
- Live mode (default):
```
cd phase1
python -m services.ingestion.main --mode live --symbols AAPL
```
- Mock replay via `IngestionService` helper:
```
cd phase1
python -m services.ingestion.main --mode mock --csv fixtures/aapl_test_ticks.csv
```

## Scripts
- Run mock script (CSV → engine → store):
```
python scripts/run_mock.py --csv fixtures/aapl_test_ticks.csv --symbols AAPL --timeframes 1m
```
- Parity comparison:
```
python scripts/parity_compare.py --reference fixtures/aapl_test_bars.csv --csv output_bars.csv --tolerance 1e-6
```

## Debugging tips
- To run a short live session with timeout for smoke testing:
```
# Run for ~10 seconds
timeout 10s bash -lc "cd phase1 && python -u -m services.ingestion.main --mode live --symbols AAPL"
```
- To force mock mode regardless of defaults:
```
cd phase1
python -m services.ingestion.main --mode mock --csv fixtures/aapl_test_ticks.csv
```

---

If you prefer, I can make a `Makefile` or small helper scripts to standardize these commands.