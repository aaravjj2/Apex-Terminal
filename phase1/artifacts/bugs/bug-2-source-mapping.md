# Bug 2: TickNormalizer Source Mapping Failure

## Severity
Medium (Source tracking incorrect)

## Failing Check
`tests/unit/test_normalizer.py::TestTickNormalizer::test_source_mapping`

## Log Excerpt
```
tests/unit/test_normalizer.py:200: in test_source_mapping
    assert canonical is not None
E   assert None is not None
```
Captured stdout:
`out_of_order_tick component=normalizer source=finnhub tick_ts=-4856242058023123473`

## Reproduction
`pytest tests/unit/test_normalizer.py::TestTickNormalizer::test_source_mapping`

## Root Cause
The test generates a unique timestamp using `ts_ms=1704067200000 + hash(source_str)`. `hash()` in Python can return negative values or very large values, leading to timestamps that might be causing issues or considered invalid/way out of order especially if `hash` is negative.

## Suggested Fix
Use a deterministic counter for timestamp generation in the test instead of `hash()`.
