/**
 * Design Tokens — single source of truth for the terminal design system.
 * Mirrors CSS custom properties in index.css; import this TS map when
 * you need token values inside component logic (e.g. Chart.js config).
 */

/* ─── Spacing scale (8px base) ─── */
export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

/* ─── Typography ─── */
export const fontFamily = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif",
  mono: "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
} as const;

export const fontSize = {
  xxs: '10px',
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  '4xl': '32px',
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: '1.2',
  snug: '1.35',
  normal: '1.5',
  relaxed: '1.625',
} as const;

/* ─── Color palette ─── */
export const colors = {
  // Backgrounds
  background: '#0C0E12',
  panel: '#131722',
  element: '#1E222D',
  surface: '#252A37',
  surfaceHover: '#2C3244',

  // Borders
  border: '#2A2E39',
  borderActive: '#434651',
  borderFocus: '#2962FF',

  // Brand
  brand: '#2962FF',
  brandHover: '#1E53E4',
  brandMuted: 'rgba(41, 98, 255, 0.15)',

  // Semantic — direction
  up: '#089981',
  upHover: '#0AAE8E',
  upMuted: 'rgba(8, 153, 129, 0.15)',
  down: '#F23645',
  downHover: '#FF4757',
  downMuted: 'rgba(242, 54, 69, 0.15)',

  // Semantic — status
  warn: '#F7931A',
  warnMuted: 'rgba(247, 147, 26, 0.15)',
  info: '#2962FF',
  infoMuted: 'rgba(41, 98, 255, 0.15)',

  // Mode
  live: '#089981',
  replay: '#9333EA',
  backtest: '#06B6D4',
  paper: '#F59E0B',

  // Text
  text: '#D1D4DC',
  textSecondary: '#787B86',
  textMuted: '#5D606B',
  textInverse: '#0C0E12',
} as const;

/* ─── Radii ─── */
export const radii = {
  none: '0px',
  sm: '2px',
  DEFAULT: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const;

/* ─── Shadows / elevation ─── */
export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.25)',
  md: '0 4px 12px rgba(0,0,0,0.35)',
  lg: '0 8px 24px rgba(0,0,0,0.45)',
  xl: '0 12px 40px rgba(0,0,0,0.55)',
  dock: '0 -4px 20px rgba(0,0,0,0.3)',
  dropdown: '0 4px 20px rgba(0,0,0,0.4)',
  modal: '0 8px 32px rgba(0,0,0,0.5)',
  toast: '0 4px 12px rgba(0,0,0,0.3)',
  inset: 'inset 0 1px 3px rgba(0,0,0,0.3)',
} as const;

/* ─── Z-index scale ─── */
export const zIndex = {
  base: 0,
  content: 10,
  dock: 20,
  header: 30,
  dropdown: 40,
  overlay: 50,
  modal: 60,
  toast: 70,
  tooltip: 80,
} as const;

/* ─── Transitions ─── */
export const transitions = {
  fast: '100ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;

/* ─── Chart.js / Recharts theming ─── */
export const chartTheme = {
  gridColor: 'rgba(42, 46, 57, 0.6)',
  axisColor: colors.textMuted,
  tooltipBg: colors.panel,
  tooltipBorder: colors.border,
  tooltipText: colors.text,
  candleUp: colors.up,
  candleDown: colors.down,
  volumeUp: 'rgba(8, 153, 129, 0.35)',
  volumeDown: 'rgba(242, 54, 69, 0.35)',
  crosshair: '#758696',
  lineDefault: colors.brand,
} as const;

/* ─── Number formatting helpers ─── */
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const pctFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = {
  usd: (v: number) => usdFormatter.format(v),
  usdCompact: (v: number) => usdCompact.format(v),
  pct: (v: number) => pctFormatter.format(v / 100),
  num: (v: number, decimals = 2) => {
    if (decimals === 2) return numFormatter.format(v);
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
  },
  int: (v: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v),
  delta: (v: number) => (v >= 0 ? '+' : '') + numFormatter.format(v),
  deltaUsd: (v: number) => (v >= 0 ? '+' : '') + usdFormatter.format(v),
  deltaPct: (v: number) => (v >= 0 ? '+' : '') + pctFormatter.format(v / 100),
} as const;
