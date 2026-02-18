/**
 * Ticker Disambiguation Module
 * =============================
 * Rule-based normalizer that detects ambiguous ticker symbols
 * and provides resolution helpers.
 *
 * Rules:
 * 1. $ prefix → bypass disambiguation ("$ON" → "ON" is a ticker)
 * 2. Well-known tickers → no disambiguation needed
 * 3. Ambiguous tickers → flag for user confirmation
 * 4. Watchlist context → if symbol in user's watchlist, skip disambiguation
 */

import lexicon from './ticker-lexicon.json';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AmbiguousEntry {
  company: string;
  confusion: string;
}

export interface DisambiguationResult {
  /** The normalised symbol (uppercased, $ stripped) */
  symbol: string;
  /** Whether this symbol needs user confirmation */
  isAmbiguous: boolean;
  /** If ambiguous, the metadata for the disambiguation prompt */
  entry?: AmbiguousEntry;
  /** How the symbol was resolved */
  resolution: 'dollar-prefix' | 'well-known' | 'watchlist' | 'ambiguous' | 'passthrough';
}

// ── Lexicon access ─────────────────────────────────────────────────────────

const AMBIGUOUS_MAP: Record<string, AmbiguousEntry> = lexicon.ambiguous;
const WELL_KNOWN_SET: Set<string> = new Set(lexicon.wellKnown);

/** Get all ambiguous tickers */
export function getAmbiguousTickers(): Record<string, AmbiguousEntry> {
  return { ...AMBIGUOUS_MAP };
}

/** Get well-known tickers */
export function getWellKnownTickers(): string[] {
  return [...WELL_KNOWN_SET];
}

// ── Core disambiguation ───────────────────────────────────────────────────

/**
 * Normalise and disambiguate a raw user input string.
 *
 * @param raw - The raw text entered by the user (e.g. "$ON", "on", "AAPL")
 * @param watchlist - Optional array of symbols the user already watches
 * @returns DisambiguationResult describing how the input was resolved
 */
export function disambiguate(
  raw: string,
  watchlist: string[] = [],
): DisambiguationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { symbol: '', isAmbiguous: false, resolution: 'passthrough' };
  }

  // Rule 1: $ prefix → explicit ticker intent, bypass disambiguation
  if (trimmed.startsWith('$')) {
    const symbol = trimmed.slice(1).toUpperCase();
    return { symbol, isAmbiguous: false, resolution: 'dollar-prefix' };
  }

  const symbol = trimmed.toUpperCase();

  // Rule 2: Well-known tickers → no disambiguation needed
  if (WELL_KNOWN_SET.has(symbol)) {
    return { symbol, isAmbiguous: false, resolution: 'well-known' };
  }

  // Rule 3: Watchlist context → user actively tracks this, skip
  const upperWatchlist = watchlist.map((s) => s.toUpperCase());
  if (upperWatchlist.includes(symbol)) {
    return { symbol, isAmbiguous: false, resolution: 'watchlist' };
  }

  // Rule 4: Check ambiguous dictionary
  const entry = AMBIGUOUS_MAP[symbol];
  if (entry) {
    return { symbol, isAmbiguous: true, entry, resolution: 'ambiguous' };
  }

  // Rule 5: Passthrough — not in any list, treat as-is
  return { symbol, isAmbiguous: false, resolution: 'passthrough' };
}

/**
 * Quick check: is this symbol in the ambiguous dictionary?
 */
export function isAmbiguous(symbol: string): boolean {
  return symbol.toUpperCase() in AMBIGUOUS_MAP;
}

/**
 * Quick check: is this a well-known ticker?
 */
export function isWellKnown(symbol: string): boolean {
  return WELL_KNOWN_SET.has(symbol.toUpperCase());
}

/**
 * Get the ambiguous entry for a symbol, if any.
 */
export function getAmbiguousEntry(symbol: string): AmbiguousEntry | undefined {
  return AMBIGUOUS_MAP[symbol.toUpperCase()];
}

/**
 * Build a user-friendly prompt string for an ambiguous ticker.
 */
export function buildDisambiguationPrompt(symbol: string, entry: AmbiguousEntry): string {
  return `"${symbol}" is the ticker for ${entry.company}. Did you mean the stock ticker, or were you typing the word "${symbol.toLowerCase()}"?`;
}
