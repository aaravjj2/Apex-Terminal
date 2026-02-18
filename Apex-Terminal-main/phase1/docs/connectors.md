# Connectors Reference 🔌

The project supports several connectors for both live streaming and historical data.

## Common connector interface (BaseConnector)
- `connect()` — async: open connection
- `disconnect()` — async: close connection
- `subscribe(symbols: list[str])` — async: signal connector to provide updates
- `unsubscribe(symbols: list[str])` — async: stop updates
- `get_historical_ticks(symbol, start_ms, end_ms)` — async iterator for historical data
- `register_callback(cb)` — callback registration for raw ticks

## MockConnector
- Purpose: deterministic CSV replay for tests & local debugging
- Key methods:
  - `load_from_csv(path)` — loads CSV into internal buffer
  - `replay_ticks(realtime=False)` — emits ticks from internal buffer
  - `inject_tick` / `inject_ticks` — manual injection for tests
- Notes: There is no `stream()` async iterator; tests and scripts iterate over `_tick_buffer` or use `replay_ticks()`.

## FinnhubConnector
- Live WebSocket streaming connector (requires `FINNHUB_API_KEY`).
- Provides `get_historical_ticks` fallback that converts candles to synthetic ticks when necessary.

## AlpacaConnector
- REST-based polling connector; primarily for paper trading and historical fetches.
- Requires `APCA_API_KEY_ID`/`APCA_API_SECRET_KEY` and optionally `APCA_ENDPOINT`.

## YFinanceConnector
- Historical-only; retrieves bars using `yfinance` and converts them to ticks.
- Useful for backfills or deterministic reproducible historical replays.

---

If you want, I can add configuration examples showing how to enable each connector with environment variables and example outputs.