# Bug Ticket 007: Parity Test Failures

## Description
Parity verification tests in `tests/parity/test_parity.py` are failing due to API mismatches and assertion errors.

## Issues
1. `AttributeError: 'CanonicalExporter' object has no attribute 'export_to_csv'`. The method is likely named `export_csv`.
2. `AssertionError: assert 71 == 64`. The computed hash includes a `sha256:` prefix, which the test does not account for.
3. `TypeError: BarComparator.__init__() got an unexpected keyword argument 'tolerance'`. The constructor expects `price_tolerance` and `volume_tolerance`.

## Impact
Unable to verify parity tool correctness.

## Plan
1. Update `test_parity.py` to use `export_csv`.
2. Update hash length assertion to 71.
3. Update `BarComparator` instantiation to use `price_tolerance`.
