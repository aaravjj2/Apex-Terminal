# Bug 5: MultiSymbolBarEngine Missing symbols Argument

## Severity
High (Multi-symbol pipeline failure)

## Failing Check
`tests/integration/test_pipeline.py::TestEndToEndPipeline::test_multi_symbol_pipeline`

## Log Excerpt
```
E   TypeError: MultiSymbolBarEngine.__init__() missing 1 required positional argument: 'symbols'
```

## Reproduction
`pytest tests/integration/test_pipeline.py::TestEndToEndPipeline::test_multi_symbol_pipeline`

## Suggested Fix
Update test to provide `symbols` list to `MultiSymbolBarEngine` constructor, or update `MultiSymbolBarEngine` to default to empty list/allow dynamic symbols.
