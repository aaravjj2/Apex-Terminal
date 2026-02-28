# Bug 4: TieredBarStore Missing store Method

## Severity
Blocker (Persistence failure)

## Failing Check
`tests/integration/test_pipeline.py::TestEndToEndPipeline::test_pipeline_with_persistence`

## Log Excerpt
```
E   AttributeError: 'TieredBarStore' object has no attribute 'store'
```

## Reproduction
`pytest tests/integration/test_pipeline.py::TestEndToEndPipeline::test_pipeline_with_persistence`

## Suggested Fix
Implement `store` method in `services/persistence/cache.py` (TieredBarStore). It might be named `put` or `save` or just missing.
