// ============================================================================
// Types
// ============================================================================

export interface CurrencyFormatOptions {
  symbol?: string;
  locale?: string;
  precision?: number;
  showSymbol?: boolean;
  accounting?: boolean; // parentheses for negative
}

export interface ChangeFormatResult {
  text: string;
  color: string;
  prefix: string;
}

export type MarketCapTier = 'Mega' | 'Large' | 'Mid' | 'Small' | 'Micro' | 'Nano';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type SignalStrength = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';

// ============================================================================
// Currency Formatting
// ============================================================================

export function formatCurrency(
  value: number,
  options: CurrencyFormatOptions = {}
): string {
  const {
    symbol = '$',
    locale = 'en-US',
    precision = 2,
    showSymbol = true,
    accounting = false,
  } = options;

  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  const prefix = showSymbol ? symbol : '';

  if (value < 0) {
    return accounting ? `(${prefix}${formatted})` : `-${prefix}${formatted}`;
  }
  return `${prefix}${formatted}`;
}

export function formatCurrencyByCode(value: number, currencyCode: string, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  } catch {
    return formatCurrency(value, { symbol: currencyCode + ' ' });
  }
}

// ============================================================================
// Percentage Formatting
// ============================================================================

export function formatPercentage(
  value: number,
  precision = 2,
  showSign = false
): string {
  const formatted = (value * 100).toFixed(precision);
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

export function formatPercentageFromValue(
  value: number,
  precision = 2,
  showSign = false
): string {
  const formatted = value.toFixed(precision);
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

// ============================================================================
// Compact Number Formatting
// ============================================================================

const COMPACT_SUFFIXES: Array<{ threshold: number; suffix: string; divisor: number }> = [
  { threshold: 1e15, suffix: 'Q', divisor: 1e15 },
  { threshold: 1e12, suffix: 'T', divisor: 1e12 },
  { threshold: 1e9, suffix: 'B', divisor: 1e9 },
  { threshold: 1e6, suffix: 'M', divisor: 1e6 },
  { threshold: 1e3, suffix: 'K', divisor: 1e3 },
];

export function formatCompact(value: number, precision = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { threshold, suffix, divisor } of COMPACT_SUFFIXES) {
    if (abs >= threshold) {
      return `${sign}${(abs / divisor).toFixed(precision)}${suffix}`;
    }
  }
  return value.toFixed(precision);
}

export function formatCompactCurrency(value: number, symbol = '$', precision = 1): string {
  return `${symbol}${formatCompact(value, precision)}`;
}

// ============================================================================
// Basis Points
// ============================================================================

export function formatBasisPoints(value: number, precision = 1): string {
  return `${(value * 10000).toFixed(precision)} bps`;
}

export function basisPointsToPercentage(bps: number): number {
  return bps / 100;
}

export function percentageToBasisPoints(pct: number): number {
  return pct * 100;
}

// ============================================================================
// Significant Digits & Tick Size
// ============================================================================

export function formatSignificantDigits(value: number, digits = 4): string {
  if (value === 0) return '0';
  const d = Math.ceil(Math.log10(Math.abs(value)));
  const power = digits - d;
  const magnitude = Math.pow(10, power);
  return (Math.round(value * magnitude) / magnitude).toString();
}

export function formatTickSize(value: number, tickSize: number): string {
  const precision = tickSize < 1
    ? Math.ceil(-Math.log10(tickSize))
    : 0;
  const rounded = Math.round(value / tickSize) * tickSize;
  return rounded.toFixed(precision);
}

export function getTickSizeForPrice(price: number): number {
  if (price >= 1000) return 0.05;
  if (price >= 100) return 0.01;
  if (price >= 10) return 0.005;
  if (price >= 1) return 0.001;
  return 0.0001;
}

// ============================================================================
// Greek Letter Formatting
// ============================================================================

const GREEK_SYMBOLS: Record<string, string> = {
  delta: 'Δ', gamma: 'Γ', theta: 'Θ', vega: 'V', rho: 'ρ',
  alpha: 'α', beta: 'β', sigma: 'σ', lambda: 'λ', mu: 'μ',
};

export function formatGreek(name: string, value: number, precision = 4): string {
  const symbol = GREEK_SYMBOLS[name.toLowerCase()] ?? name;
  return `${symbol} ${value >= 0 ? ' ' : ''}${value.toFixed(precision)}`;
}

export function formatGreekSet(greeks: Record<string, number>, precision = 4): string[] {
  return Object.entries(greeks).map(([name, value]) => formatGreek(name, value, precision));
}

// ============================================================================
// Change Formatting
// ============================================================================

export function formatChange(
  value: number,
  precision = 2,
  options: { upColor?: string; downColor?: string; neutralColor?: string } = {}
): ChangeFormatResult {
  const { upColor = '#00C853', downColor = '#FF1744', neutralColor = '#9E9E9E' } = options;

  const prefix = value > 0 ? '+' : value < 0 ? '' : '';
  const color = value > 0 ? upColor : value < 0 ? downColor : neutralColor;
  const text = `${prefix}${value.toFixed(precision)}`;

  return { text, color, prefix };
}

export function formatPriceChange(
  current: number,
  previous: number,
  precision = 2
): { absolute: ChangeFormatResult; percentage: ChangeFormatResult } {
  const change = current - previous;
  const pctChange = previous !== 0 ? change / previous : 0;

  return {
    absolute: formatChange(change, precision),
    percentage: formatChange(pctChange * 100, precision),
  };
}

// ============================================================================
// Volume Formatting
// ============================================================================

export function formatVolume(volume: number): string {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toString();
}

export function formatTurnover(price: number, volume: number): string {
  return formatCompactCurrency(price * volume);
}

// ============================================================================
// Time Elapsed (Human Readable)
// ============================================================================

export function formatTimeElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function formatTimestamp(date: Date, includeMs = false): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const base = `${h}:${m}:${s}`;
  if (includeMs) return `${base}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  return base;
}

// ============================================================================
// Market Cap Tier
// ============================================================================

export function getMarketCapTier(marketCap: number): MarketCapTier {
  if (marketCap >= 200e9) return 'Mega';
  if (marketCap >= 10e9) return 'Large';
  if (marketCap >= 2e9) return 'Mid';
  if (marketCap >= 300e6) return 'Small';
  if (marketCap >= 50e6) return 'Micro';
  return 'Nano';
}

export function formatMarketCap(marketCap: number): string {
  const tier = getMarketCapTier(marketCap);
  return `${formatCompactCurrency(marketCap)} (${tier} Cap)`;
}

// ============================================================================
// Risk Level Formatting
// ============================================================================

const RISK_COLORS: Record<RiskLevel, string> = {
  Low: '#4CAF50',
  Medium: '#FF9800',
  High: '#F44336',
  Critical: '#9C27B0',
};

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 0.25) return 'Low';
  if (score <= 0.5) return 'Medium';
  if (score <= 0.75) return 'High';
  return 'Critical';
}

export function formatRiskLevel(score: number): { label: RiskLevel; color: string; score: string } {
  const label = getRiskLevel(score);
  return { label, color: RISK_COLORS[label], score: (score * 100).toFixed(0) + '%' };
}

// ============================================================================
// Signal Strength Formatting
// ============================================================================

const SIGNAL_COLORS: Record<SignalStrength, string> = {
  'Strong Buy': '#00C853',
  Buy: '#66BB6A',
  Neutral: '#9E9E9E',
  Sell: '#EF5350',
  'Strong Sell': '#FF1744',
};

export function getSignalStrength(score: number): SignalStrength {
  if (score >= 0.6) return 'Strong Buy';
  if (score >= 0.2) return 'Buy';
  if (score >= -0.2) return 'Neutral';
  if (score >= -0.6) return 'Sell';
  return 'Strong Sell';
}

export function formatSignalStrength(score: number): { label: SignalStrength; color: string } {
  const label = getSignalStrength(score);
  return { label, color: SIGNAL_COLORS[label] };
}

// ============================================================================
// Ratio Formatting
// ============================================================================

export function formatRatio(value: number, precision = 2, label?: string): string {
  const formatted = value.toFixed(precision);
  return label ? `${label}: ${formatted}x` : `${formatted}x`;
}

export function formatPERatio(pe: number): string {
  if (!isFinite(pe) || pe <= 0) return 'N/A';
  return formatRatio(pe, 1, 'P/E');
}

export function formatPBRatio(pb: number): string {
  if (!isFinite(pb) || pb <= 0) return 'N/A';
  return formatRatio(pb, 2, 'P/B');
}

export function formatDebtToEquity(ratio: number): string {
  return formatRatio(ratio, 2, 'D/E');
}

export function formatSharpeRatio(sharpe: number): string {
  return `Sharpe: ${sharpe.toFixed(2)}`;
}

// ============================================================================
// Duration Formatting
// ============================================================================

export function formatDuration(totalDays: number): string {
  if (totalDays < 1) {
    const hours = Math.round(totalDays * 24);
    return `${hours}h`;
  }
  if (totalDays < 30) return `${Math.round(totalDays)}d`;
  if (totalDays < 365) {
    const months = Math.floor(totalDays / 30);
    const days = Math.round(totalDays % 30);
    return days > 0 ? `${months}m ${days}d` : `${months}m`;
  }
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  return months > 0 ? `${years}y ${months}m` : `${years}y`;
}

export function formatBondDuration(duration: number): string {
  return `${duration.toFixed(2)} years`;
}

// ============================================================================
// Number Formatting Helpers
// ============================================================================

export function formatNumber(value: number, precision = 2, locale = 'en-US'): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function formatInteger(value: number, locale = 'en-US'): string {
  return Math.round(value).toLocaleString(locale);
}

export function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function padNumber(value: number, width: number, fill = ' '): string {
  const str = value.toString();
  return str.length >= width ? str : fill.repeat(width - str.length) + str;
}

export function truncateString(str: string, maxLength: number, ellipsis = '…'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}
