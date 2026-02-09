# Brain Contract

## Snapshot (Input)
Represents the entire world state at time T. Pure input.
- `cycle_time`: datetime of scan
- `underlyings`: map of Ticker -> {price, 60_day_bars}
- `options`: list of available contracts
- `positions`: list of current holdings
- `risk`: usage counters

## State (Persisted)
Internal memory carried forward.
- `position_meta`: entry time, strategy ID, stop/limit targets.

## Actions (Output)
- `ENTER`: Open new position.
- `EXIT`: Close existing.
- `HOLD`: Do nothing.

## Invariants
- Deterministic: Snapshot + State -> Actions + NewState
- No Side Effects: No IO, no globals.

## Pure Feature Set
Brain computes these Features locally from `UnderlyingSnapshot.bars_daily`:
- **Trend**: SMA20/50 crossovers, Price vs SMA.
- **RSI**: 14-period RSI from daily closes.
- **Volatility**: 20-day Annualized Realized Volatility from log returns.
*Note: IV Rank and Greeks are EXPLICITLY DROPPED in V1-A in favor of pure price-action features.*
