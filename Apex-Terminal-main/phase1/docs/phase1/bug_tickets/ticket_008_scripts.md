# Bug Ticket 008: Execution Scripts Import Errors

## Description
`scripts/run_mock.py` fails to run due to import errors.

## Issues
1. `ImportError: cannot import name 'settings' from 'services.config'`. The module exports `get_settings` function, not a `settings` instance.

## Impact
Unable to run end-to-end verification scripts.

## Plan
1. Update `scripts/run_mock.py` to import and usage `get_settings`.
