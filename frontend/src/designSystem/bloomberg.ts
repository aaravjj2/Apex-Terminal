/**
 * Bloomberg Design System — Shared Constants & Types
 * ===================================================
 * Single source of truth for the Apex Terminal Bloomberg-grade design system.
 * All pages MUST import from here instead of defining local color constants.
 * 
 * Usage:
 *   import { BLOOMBERG, bloombergStyles } from '../../designSystem/bloomberg';
 */

import { CSSProperties } from 'react';

// ─── COLOR PALETTE ────────────────────────────────────────────────────────────

export const BLOOMBERG = {
  // Backgrounds
  BG:          '#0a0a0a',   // page background
  BG_ALT:      '#040407',   // alternative darker bg (TradingUI2 style)
  PANEL:       '#111111',   // panel / card background
  PANEL_ALT:   '#0c0c14',   // alternative panel bg
  SURFACE:     '#161616',   // elevated surface (dropdown, modal)
  SURFACE_2:   '#1a1a1a',   // secondary surface
  OVERLAY:     'rgba(0,0,0,0.7)',  // backdrop overlay

  // Borders
  BORDER:      '#1e1e1e',   // primary border
  BORDER_ALT:  '#1e1e2e',   // alternative border (blue tint)
  BORDER_FOCUS:'#f5a623',   // focus ring border (amber)
  BORDER_HOVER:'#2a2a2a',   // hovered element border

  // Primary Accent — Bloomberg Amber
  AMBER:       '#f5a623',
  AMBER_DIM:   '#c68a1a',   // dimmed amber
  AMBER_GLOW:  'rgba(245,166,35,0.15)',  // soft amber glow for hover
  AMBER_BG:    'rgba(245,166,35,0.06)',   // amber-tinted background

  // Alternative Amber (TradingUI2 bright)
  AMBER_BRIGHT:'#ff9900',

  // Semantic — Status Colors
  GREEN:       '#26a69a',   // positive / profit / bullish
  GREEN_BRIGHT:'#00d88a',   // brighter green variant
  GREEN_DIM:   '#1b8075',   // dimmed green
  GREEN_BG:    'rgba(38,166,154,0.10)',   // green-tinted bg

  RED:         '#ef5350',   // negative / loss / bearish
  RED_BRIGHT:  '#ff3b5c',   // brighter red variant
  RED_DIM:     '#b33d3a',   // dimmed red
  RED_BG:      'rgba(239,83,80,0.10)',    // red-tinted bg

  BLUE:        '#42a5f5',   // info / links / neutral
  BLUE_DIM:    '#2979b9',   // dimmed blue
  BLUE_BG:     'rgba(66,165,245,0.10)',   // blue-tinted bg

  PURPLE:      '#ab47bc',   // special highlights
  CYAN:        '#26c6da',   // secondary accent
  ORANGE:      '#ff7043',   // warnings
  YELLOW:      '#ffca28',   // caution

  // Text
  TEXT:        '#e8e8ee',   // primary text
  TEXT_DIM:    '#d1d4dc',   // secondary text
  TEXT_MUTED:  '#8a8a9a',   // muted/tertiary text
  TEXT_SUBTLE: '#5d5d7d',   // very subtle text
  TEXT_INVERSE:'#0a0a0a',   // inverse (on bright bg)

  // Functional
  SCROLLBAR:   '#2a2a2a',
  SCROLLBAR_HOVER: '#3a3a3a',
  SELECTION:   'rgba(245,166,35,0.2)',

  // Chart-specific
  CHART: {
    BG:        '#0a0a0a',
    GRID:      '#1a1a1a',
    CROSSHAIR: '#5d5d7d',
    CANDLE_UP:   '#26a69a',
    CANDLE_DOWN: '#ef5350',
    CANDLE_UP_WICK:   '#26a69a',
    CANDLE_DOWN_WICK: '#ef5350',
    VOLUME_UP:   'rgba(38,166,154,0.35)',
    VOLUME_DOWN: 'rgba(239,83,80,0.35)',
    WATERMARK:   'rgba(255,255,255,0.03)',
  },
} as const;

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  // Font families
  MONO:    "'IBM Plex Mono', 'Roboto Mono', 'Fira Code', 'Courier New', monospace",
  SANS:    "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  DISPLAY: "'IBM Plex Sans', 'Inter', system-ui, sans-serif",

  // Font sizes (px)
  SIZE: {
    MICRO:  '9px',
    TINY:   '10px',
    SMALL:  '11px',
    BODY:   '12px',
    MEDIUM: '13px',
    LARGE:  '14px',
    XL:     '16px',
    XXL:    '20px',
    XXXL:   '24px',
    HERO:   '32px',
  },

  // Font weights
  WEIGHT: {
    LIGHT:    300,
    REGULAR:  400,
    MEDIUM:   500,
    SEMI:     600,
    BOLD:     700,
  },

  // Line heights
  LINE_HEIGHT: {
    TIGHT:   1.1,
    NORMAL:  1.4,
    LOOSE:   1.6,
  },

  // Letter spacing
  LETTER_SPACING: {
    TIGHT:    '-0.02em',
    NORMAL:   '0em',
    WIDE:     '0.04em',
    EXTRA:    '0.08em',
    LABEL:    '0.12em',
  },
} as const;

// ─── SPACING ──────────────────────────────────────────────────────────────────

export const SPACING = {
  XXXS: '2px',
  XXS:  '4px',
  XS:   '6px',
  SM:   '8px',
  MD:   '12px',
  LG:   '16px',
  XL:   '20px',
  XXL:  '24px',
  XXXL: '32px',
  GUTTER: '1px',  // Bloomberg-style 1px gutters between panels
} as const;

// ─── BORDERS & RADII ─────────────────────────────────────────────────────────

export const BORDERS = {
  RADIUS: {
    NONE: '0px',
    XS:   '2px',
    SM:   '4px',
    MD:   '6px',
    LG:   '8px',
    XL:   '12px',
    FULL: '9999px',
  },
  WIDTH: {
    THIN:   '1px',
    MEDIUM: '2px',
    THICK:  '3px',
  },
} as const;

// ─── SHADOWS ──────────────────────────────────────────────────────────────────

export const SHADOWS = {
  NONE:    'none',
  SM:      '0 1px 2px rgba(0,0,0,0.5)',
  MD:      '0 2px 6px rgba(0,0,0,0.5)',
  LG:      '0 4px 16px rgba(0,0,0,0.6)',
  XL:      '0 8px 32px rgba(0,0,0,0.7)',
  GLOW_AMBER: '0 0 12px rgba(245,166,35,0.15)',
  GLOW_GREEN: '0 0 8px rgba(38,166,154,0.2)',
  GLOW_RED:   '0 0 8px rgba(239,83,80,0.2)',
  INSET:      'inset 0 1px 2px rgba(0,0,0,0.3)',
} as const;

// ─── TRANSITIONS ──────────────────────────────────────────────────────────────

export const TRANSITIONS = {
  FAST:   'all 0.1s ease',
  NORMAL: 'all 0.2s ease',
  SLOW:   'all 0.3s ease',
  SPRING: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  COLOR:  'color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
} as const;

// ─── Z-INDEX LAYERS ──────────────────────────────────────────────────────────

export const Z_INDEX = {
  BASE:        0,
  PANEL:       10,
  FLOATING:    100,
  DROPDOWN:    200,
  STICKY:      300,
  OVERLAY:     400,
  MODAL:       500,
  POPOVER:     600,
  TOOLTIP:     700,
  TOAST:       800,
  COMMAND:     900,
  TOP:         1000,
} as const;

// ─── COMMON STYLE PRESETS ─────────────────────────────────────────────────────

export const bloombergStyles = {
  // Panel container (primary building block)
  panel: {
    background: BLOOMBERG.PANEL,
    border: `1px solid ${BLOOMBERG.BORDER}`,
    borderRadius: BORDERS.RADIUS.SM,
    overflow: 'hidden',
  } as CSSProperties,

  // Panel with amber top accent
  panelAccent: {
    background: BLOOMBERG.PANEL,
    border: `1px solid ${BLOOMBERG.BORDER}`,
    borderTop: `2px solid ${BLOOMBERG.AMBER}`,
    borderRadius: BORDERS.RADIUS.SM,
    overflow: 'hidden',
  } as CSSProperties,

  // Panel header bar
  panelHeader: {
    padding: `${SPACING.SM} ${SPACING.MD}`,
    borderBottom: `1px solid ${BLOOMBERG.BORDER}`,
    background: `linear-gradient(180deg, ${BLOOMBERG.AMBER_BG}, transparent)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '32px',
  } as CSSProperties,

  // Panel header title text
  panelTitle: {
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMI,
    color: BLOOMBERG.AMBER,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.LABEL,
    lineHeight: TYPOGRAPHY.LINE_HEIGHT.TIGHT,
    margin: 0,
  } as CSSProperties,

  // Data cell (numbers)
  dataCell: {
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    color: BLOOMBERG.TEXT,
    textAlign: 'right' as const,
    padding: `${SPACING.XXS} ${SPACING.SM}`,
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  // Label cell
  labelCell: {
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.TINY,
    color: BLOOMBERG.TEXT_MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
    padding: `${SPACING.XXS} ${SPACING.SM}`,
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  // Positive value
  positive: {
    color: BLOOMBERG.GREEN,
  } as CSSProperties,

  // Negative value
  negative: {
    color: BLOOMBERG.RED,
  } as CSSProperties,

  // Neutral value
  neutral: {
    color: BLOOMBERG.TEXT_DIM,
  } as CSSProperties,

  // Button primary (amber)
  buttonPrimary: {
    background: BLOOMBERG.AMBER,
    color: BLOOMBERG.TEXT_INVERSE,
    border: 'none',
    borderRadius: BORDERS.RADIUS.XS,
    padding: `${SPACING.XS} ${SPACING.MD}`,
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMI,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
    cursor: 'pointer',
    transition: TRANSITIONS.FAST,
  } as CSSProperties,

  // Button secondary (outlined)
  buttonSecondary: {
    background: 'transparent',
    color: BLOOMBERG.AMBER,
    border: `1px solid ${BLOOMBERG.AMBER_DIM}`,
    borderRadius: BORDERS.RADIUS.XS,
    padding: `${SPACING.XS} ${SPACING.MD}`,
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
    cursor: 'pointer',
    transition: TRANSITIONS.FAST,
  } as CSSProperties,

  // Button ghost (no border)
  buttonGhost: {
    background: 'transparent',
    color: BLOOMBERG.TEXT_MUTED,
    border: 'none',
    borderRadius: BORDERS.RADIUS.XS,
    padding: `${SPACING.XXS} ${SPACING.SM}`,
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.TINY,
    cursor: 'pointer',
    transition: TRANSITIONS.FAST,
  } as CSSProperties,

  // Input field
  input: {
    background: BLOOMBERG.BG,
    color: BLOOMBERG.TEXT,
    border: `1px solid ${BLOOMBERG.BORDER}`,
    borderRadius: BORDERS.RADIUS.XS,
    padding: `${SPACING.XS} ${SPACING.SM}`,
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    outline: 'none',
    transition: TRANSITIONS.FAST,
  } as CSSProperties,

  // Select dropdown
  select: {
    background: BLOOMBERG.BG,
    color: BLOOMBERG.TEXT,
    border: `1px solid ${BLOOMBERG.BORDER}`,
    borderRadius: BORDERS.RADIUS.XS,
    padding: `${SPACING.XXS} ${SPACING.SM}`,
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.TINY,
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none' as const,
  } as CSSProperties,

  // Table row
  tableRow: {
    borderBottom: `1px solid ${BLOOMBERG.BORDER}`,
    transition: TRANSITIONS.FAST,
  } as CSSProperties,

  // Table header
  tableHeader: {
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.TINY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMI,
    color: BLOOMBERG.TEXT_MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
    padding: `${SPACING.XS} ${SPACING.SM}`,
    borderBottom: `1px solid ${BLOOMBERG.BORDER}`,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  } as CSSProperties,

  // KPI Card
  kpiCard: {
    background: BLOOMBERG.PANEL,
    border: `1px solid ${BLOOMBERG.BORDER}`,
    borderTop: `2px solid ${BLOOMBERG.AMBER}`,
    borderRadius: BORDERS.RADIUS.SM,
    padding: SPACING.MD,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: SPACING.XXS,
  } as CSSProperties,

  // KPI Label
  kpiLabel: {
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.MICRO,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    color: BLOOMBERG.TEXT_MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.LABEL,
  } as CSSProperties,

  // KPI Value
  kpiValue: {
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.XXL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    color: BLOOMBERG.TEXT,
    lineHeight: TYPOGRAPHY.LINE_HEIGHT.TIGHT,
  } as CSSProperties,

  // Status dot
  statusDot: (color: string): CSSProperties => ({
    width: '6px',
    height: '6px',
    borderRadius: BORDERS.RADIUS.FULL,
    background: color,
    boxShadow: `0 0 4px ${color}`,
    display: 'inline-block',
  }),

  // Badge
  badge: (bgColor: string, textColor: string): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${SPACING.XXXS} ${SPACING.XS}`,
    borderRadius: BORDERS.RADIUS.XS,
    background: bgColor,
    color: textColor,
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.MICRO,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMI,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
    lineHeight: 1,
  }),

  // Price value (colored by direction)
  priceValue: (value: number): CSSProperties => ({
    fontFamily: TYPOGRAPHY.MONO,
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    color: value > 0 ? BLOOMBERG.GREEN : value < 0 ? BLOOMBERG.RED : BLOOMBERG.TEXT_DIM,
  }),

  // Scrollbar mixin CSS string (for use in styled-components or CSS module)
  scrollbarCSS: `
    scrollbar-width: thin;
    scrollbar-color: ${BLOOMBERG.SCROLLBAR} transparent;
    &::-webkit-scrollbar { width: 6px; height: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: ${BLOOMBERG.SCROLLBAR}; border-radius: 3px; }
    &::-webkit-scrollbar-thumb:hover { background: ${BLOOMBERG.SCROLLBAR_HOVER}; }
  `,

  // Page background
  pageBackground: {
    background: BLOOMBERG.BG,
    color: BLOOMBERG.TEXT,
    minHeight: '100vh',
    fontFamily: TYPOGRAPHY.SANS,
  } as CSSProperties,

  // Flex row
  flexRow: (gap: string = SPACING.SM): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap,
  }),

  // Flex column
  flexCol: (gap: string = SPACING.SM): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap,
  }),

  // Grid
  grid: (columns: string, gap: string = SPACING.GUTTER): CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: columns,
    gap,
  }),
} as const;

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

/** Get color for a P&L value (green for positive, red for negative) */
export function pnlColor(value: number): string {
  if (value > 0) return BLOOMBERG.GREEN;
  if (value < 0) return BLOOMBERG.RED;
  return BLOOMBERG.TEXT_DIM;
}

/** Format number with commas and decimals */
export function formatNumber(value: number, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format as currency */
export function formatCurrency(value: number, decimals: number = 2, symbol: string = '$'): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  const absVal = Math.abs(value);
  const formatted = absVal.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/** Format large numbers with K/M/B/T suffixes */
export function formatCompact(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

/** Format percentage */
export function formatPercent(value: number, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/** Format change with sign and color hint */
export function formatChange(value: number, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

/** Relative time string (e.g., "2m ago", "1h ago") */
export function relativeTime(date: Date | string | number): string {
  const now = Date.now();
  const ts = typeof date === 'number' ? date : new Date(date).getTime();
  const diffMs = now - ts;
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

/** Determine trend direction string */
export function trendArrow(value: number): string {
  if (value > 0) return '▲';
  if (value < 0) return '▼';
  return '—';
}
