# Autopilot Execution

Execution via `execution_engine_v2.py` and `alpaca_broker.py`.

## Flow

1. Validate order against caps
2. Route to Alpaca paper
3. Track fill
4. Update position in store

## Alpaca

Single broker: Alpaca. Paper-only (no live).
