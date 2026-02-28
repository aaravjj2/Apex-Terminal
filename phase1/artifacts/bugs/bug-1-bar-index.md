# Bug 1: BarIndexCalculator.get_interval_bounds Mismatch

## Severity
High (Incorrect interval calculations affecting bar timestamps)

## Failing Check
`tests/unit/test_bar_engine.py::TestBarIndexCalculator::test_get_interval_bounds`

## Log Excerpt
```
tests/unit/test_bar_engine.py:72: in test_get_interval_bounds
    assert end == 1704067260000
E   assert 1704056400000 == 1704067260000
```
Expected: 1704067260000
Actual:   1704056400000

## Reproduction
`pytest tests/unit/test_bar_engine.py::TestBarIndexCalculator::test_get_interval_bounds`

## Test Case
```python
def test_get_interval_bounds(self):
    calc = BarIndexCalculator(symbol="AAPL", timeframe="1m")
    ts = 1704067230000
    start, end = calc.get_interval_bounds(ts)
    assert start == 1704067200000
    assert end == 1704067260000
```

## Suggested Fix
Check `get_interval_bounds` logic in `services/bar_engine/bar_index.py`. It seems to be using an incorrect epoch or calculation logic.
