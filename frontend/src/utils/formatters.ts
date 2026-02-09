/**
 * Centralized formatting helpers (A4)
 * All chart/UI formatting goes through these to prevent null/undefined crashes.
 */

/**
 * Safely format a number with fixed decimals.
 * Handles null, undefined, NaN, and non-number inputs.
 */
export function formatNumberSafe(
  val: number | null | undefined,
  decimals: number = 2,
  fallback: number = 0
): string {
  if (val == null || typeof val !== 'number' || isNaN(val)) {
    return fallback.toFixed(decimals);
  }
  return val.toFixed(decimals);
}

/**
 * Safely format a currency value (USD).
 */
export function formatCurrencySafe(
  val: number | null | undefined,
  fallback: number = 0
): string {
  const safe = val != null && typeof val === 'number' && !isNaN(val) ? val : fallback;
  return `$${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Safely format a percentage value.
 */
export function formatPercentSafe(
  val: number | null | undefined,
  decimals: number = 2,
  fallback: number = 0
): string {
  if (val == null || typeof val !== 'number' || isNaN(val)) {
    return `${fallback.toFixed(decimals)}%`;
  }
  return `${val.toFixed(decimals)}%`;
}

/**
 * Recharts tickFormatter helper — always returns a string, never crashes.
 */
export function tickFormatCurrency(val: unknown): string {
  const n = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `$${(n / 1000).toFixed(0)}k`;
}

/**
 * Recharts tickFormatter helper for percentages.
 */
export function tickFormatPercent(val: unknown, decimals: number = 1): string {
  const n = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `${n.toFixed(decimals)}%`;
}
