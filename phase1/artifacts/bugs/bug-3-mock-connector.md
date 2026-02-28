# Bug 3: MockConnector Missing load_csv

## Severity
Blocker (Cannot run integration tests)

## Failing Check
`tests/integration/test_pipeline.py::TestEndToEndPipeline::test_mock_csv_to_bars`

## Log Excerpt
```
E   AttributeError: 'MockConnector' object has no attribute 'load_csv'. Did you mean: '_read_csv'?
```

## Reproduction
`pytest tests/integration/test_pipeline.py::TestEndToEndPipeline::test_mock_csv_to_bars`

## Suggested Fix
Rename `_read_csv` to `load_csv` or implement `load_csv` in `services/ingestion/connectors/mock.py`.
