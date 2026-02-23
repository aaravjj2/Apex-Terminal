/**
 * Online-only platform configuration.
 *
 * APP_MODE: always 'online' — no demo, no mock, no recordings.
 * MARKET_PROVIDER: real market-data provider (finnhub | polygon | tiingo | alpaca)
 * BROKER_PROVIDER: real broker for paper trading (alpaca)
 * ELASTIC_REQUIRED: Elasticsearch must be reachable.
 *
 * Overridable via VITE_ env vars at build time.
 */

/** The platform always runs online — no demo/mock/recorded modes. */
export const APP_MODE = 'online' as const;

/** Market data provider name (read from env or default to finnhub). */
export const MARKET_PROVIDER: string =
  import.meta.env.VITE_MARKET_PROVIDER || 'finnhub';

/** Broker for paper-trade execution (currently only alpaca). */
export const BROKER_PROVIDER: string =
  import.meta.env.VITE_BROKER_PROVIDER || 'alpaca';

/** Elasticsearch is required for search. */
export const ELASTIC_REQUIRED = true;

/**
 * Human-readable label shown in the UI mode badge.
 */
export const DATA_MODE_LABEL = `Online · ${MARKET_PROVIDER}`;

// ── Backward-compat shims (consumed by stores during migration) ──
// These will be removed once all stores use Date.now() directly.
/** @deprecated Use new Date().toISOString() instead. */
export const RECORDING_TS = new Date().toISOString();
/** @deprecated Use MARKET_PROVIDER instead. */
export const RECORDING_SET = MARKET_PROVIDER;
