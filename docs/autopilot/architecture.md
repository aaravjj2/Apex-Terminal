# Autopilot Architecture

Unified engine in `phase1/services/autopilot/unified_engine.py`.

## Cycle Order

1. DATA_REFRESH — market, news, sentiment
2. BROKER_REFRESH — positions, orders from Alpaca
3. MONITORING — exit evaluation for all open positions
4. CANDIDATE_GENERATION — generate candidates (if risk budget)
5. SELECTION — rank and select
6. VALIDATION — gates (risk, liquidity, earnings, sentiment)
7. EXECUTION — via Alpaca paper
8. PERSISTENCE — run artifact
9. UI_UPDATE — emit events

## CyclePhase Enum

INIT, DATA_REFRESH, BROKER_REFRESH, MONITORING, CANDIDATE_GENERATION, SELECTION, VALIDATION, EXECUTION, PERSISTENCE, UI_UPDATE, COMPLETE, ERROR
