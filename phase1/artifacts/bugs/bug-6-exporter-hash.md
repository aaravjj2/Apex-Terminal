# Bug 6: CanonicalExporter Missing compute_bars_hash

## Severity
High (Parity check failure)

## Failing Check
`tests/integration/test_pipeline.py::TestDeterminism::test_canonical_hash_consistency`

## Log Excerpt
```
E   AttributeError: 'CanonicalExporter' object has no attribute 'compute_bars_hash'. Did you mean: 'compute_hash'?
```

## Reproduction
`pytest tests/integration/test_pipeline.py::TestDeterminism::test_canonical_hash_consistency`

## Suggested Fix
Rename `compute_hash` to `compute_bars_hash` in `services/verifier/exporter.py` or update tests to use `compute_hash`.
