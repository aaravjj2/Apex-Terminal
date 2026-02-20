/**
 * Canonical demo data — single source of truth for UI2 demo values
 * Used by stream simulator, demo store and mock UI tiles.
 */
import { DEMO_TIMESTAMP } from './constants';

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  change: number;
  changePct: number;
  timestamp: number;
}

export const BASE_PRICES: Record<string, number> = {
  SPY: 547.23,
  AAPL: 182.41,
  TSLA: 218.77,
  NVDA: 789.55,
  MSFT: 412.33,
};

export const DEMO_QUOTES: Quote[] = [
  { symbol: 'SPY', bid: 547.20, ask: 547.25, last: 547.23, volume: 42_150_000, change: 3.45, changePct: 0.63, timestamp: DEMO_TIMESTAMP },
  { symbol: 'AAPL', bid: 182.40, ask: 182.43, last: 182.41, volume: 38_200_000, change: -1.23, changePct: -0.67, timestamp: DEMO_TIMESTAMP },
  { symbol: 'TSLA', bid: 218.75, ask: 218.80, last: 218.77, volume: 51_300_000, change: 5.12, changePct: 2.40, timestamp: DEMO_TIMESTAMP },
  { symbol: 'NVDA', bid: 789.50, ask: 789.60, last: 789.55, volume: 28_900_000, change: -8.45, changePct: -1.06, timestamp: DEMO_TIMESTAMP },
  { symbol: 'MSFT', bid: 412.30, ask: 412.35, last: 412.33, volume: 19_800_000, change: 2.15, changePct: 0.52, timestamp: DEMO_TIMESTAMP },
];

export function getDemoQuote(symbol: string) {
  return DEMO_QUOTES.find(q => q.symbol === symbol);
}

export function getBasePrice(symbol: string) {
  return BASE_PRICES[symbol] ?? getDemoQuote(symbol)?.last ?? 0;
}
