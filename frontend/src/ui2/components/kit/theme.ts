/**
 * TradingView-Inspired Design Tokens for Apex Terminal
 * Replaces old Bloomberg amber theme (#ff9900) with modern TradingView blue (#2962FF)
 * 
 * Usage: import { T } from './theme';
 *        style={{ background: T.bg1, color: T.text1 }}
 */

export const T = {
  /* ── Brand ── */
  brand:   '#2962FF',
  brandLt: '#5B8DEF',
  brandDk: '#1E4FCC',

  /* ── Surfaces ── */
  bg0:     '#0C0E12',  // darkest – body
  bg1:     '#131722',  // panels / cards
  bg2:     '#1E222D',  // elevated panels
  bg3:     '#2A2E39',  // inputs, dropdowns
  bg4:     '#363A45',  // hover states

  /* ── Borders ── */
  border0: '#1E222D',
  border1: '#2A2E39',
  border2: '#363A45',

  /* ── Text ── */
  text0:   '#FFFFFF',
  text1:   '#D1D4DC',
  text2:   '#787B86',
  text3:   '#50535E',

  /* ── Semantic ── */
  up:      '#26A69A',  // bullish green
  dn:      '#EF5350',  // bearish red
  upBg:    'rgba(38,166,154,0.12)',
  dnBg:    'rgba(239,83,80,0.12)',
  warn:    '#FF9800',
  warnBg:  'rgba(255,152,0,0.12)',
  info:    '#42A5F5',
  infoBg:  'rgba(66,165,245,0.12)',
  
  /* ── Special ── */
  gold:    '#FFD700',
  purple:  '#AB47BC',
  orange:  '#FF9800',
  cyan:    '#00BCD4',
  pink:    '#E91E63',
  lime:    '#CDDC39',

  /* ── Typography ── */
  fontSans:  "'Inter','Segoe UI',system-ui,sans-serif",
  fontMono:  "'JetBrains Mono','Fira Code','Cascadia Code',monospace",
  
  /* ── Sizing ── */
  radius:  '4px',
  radiusMd:'6px',
  radiusLg:'8px',
  radiusXl:'12px',

  /* ── Shadows ── */
  shadow1: '0 1px 3px rgba(0,0,0,0.3)',
  shadow2: '0 4px 12px rgba(0,0,0,0.4)',
  shadow3: '0 8px 24px rgba(0,0,0,0.5)',

  /* ── Transitions ── */
  fast:    '100ms ease',
  normal:  '200ms ease',
  slow:    '300ms ease',
} as const;

/* ── Common Style Mixins ── */
export const S = {
  panel: {
    background: T.bg1,
    border: `1px solid ${T.border0}`,
    borderRadius: T.radius,
  } as React.CSSProperties,

  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: `1px solid ${T.border0}`,
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: T.text2,
    fontFamily: T.fontSans,
  } as React.CSSProperties,

  panelBody: {
    padding: '8px',
    flex: 1,
    overflow: 'auto',
  } as React.CSSProperties,

  input: {
    background: T.bg3,
    border: `1px solid ${T.border1}`,
    borderRadius: T.radius,
    padding: '6px 10px',
    color: T.text1,
    fontSize: '12px',
    fontFamily: T.fontSans,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  select: {
    background: T.bg3,
    border: `1px solid ${T.border1}`,
    borderRadius: T.radius,
    padding: '6px 10px',
    color: T.text1,
    fontSize: '12px',
    fontFamily: T.fontSans,
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  button: {
    background: T.brand,
    color: '#fff',
    border: 'none',
    borderRadius: T.radius,
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: T.fontSans,
    cursor: 'pointer',
    transition: T.fast,
  } as React.CSSProperties,

  buttonGhost: {
    background: 'transparent',
    color: T.text1,
    border: `1px solid ${T.border1}`,
    borderRadius: T.radius,
    padding: '6px 12px',
    fontSize: '12px',
    fontFamily: T.fontSans,
    cursor: 'pointer',
    transition: T.fast,
  } as React.CSSProperties,

  th: {
    padding: '6px 8px',
    textAlign: 'left' as const,
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: T.text3,
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${T.border0}`,
    fontFamily: T.fontSans,
    position: 'sticky' as const,
    top: 0,
    background: T.bg1,
    zIndex: 1,
  } as React.CSSProperties,

  td: {
    padding: '4px 8px',
    fontSize: '11px',
    fontFamily: T.fontMono,
    color: T.text1,
    borderBottom: `1px solid ${T.border0}`,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  badge: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 600,
    fontFamily: T.fontSans,
  } as React.CSSProperties,

  kpi: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    padding: '8px 12px',
  } as React.CSSProperties,

  kpiLabel: {
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    color: T.text3,
    letterSpacing: '0.5px',
    fontFamily: T.fontSans,
  } as React.CSSProperties,

  kpiValue: {
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: T.fontMono,
    color: T.text0,
  } as React.CSSProperties,

  scrollbar: {
    scrollbarWidth: 'thin' as const,
    scrollbarColor: `${T.bg4} transparent`,
  } as React.CSSProperties,

  flexRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  flexCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  } as React.CSSProperties,

  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px',
  } as React.CSSProperties,

  grid4: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '8px',
  } as React.CSSProperties,
} as const;

/* ── Formatters ── */
export const fmt = {
  usd:  (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n.toFixed(2)}`,
  num:  (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct:  (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`,
  bp:   (n: number) => `${n.toFixed(0)} bp`,
  vol:  (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : n.toString(),
  ts:   (d: Date) => d.toLocaleTimeString('en-US', { hour12: false }),
  date: (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  clr:  (n: number) => n >= 0 ? T.up : T.dn,
  clrBg:(n: number) => n >= 0 ? T.upBg : T.dnBg,
  sign: (n: number) => n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2),
} as const;

/* ── Sparkline SVG generator ── */
export function sparklineSVG(data: number[], w = 60, h = 20, color = T.up): string {
  if (data.length < 2) return '';
  const mn = Math.min(...data), mx = Math.max(...data);
  const range = mx - mn || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - mn) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

/* ── Random walk data generator ── */
export function randomWalk(len: number, start = 100, vol = 0.02): number[] {
  const d: number[] = [start];
  for (let i = 1; i < len; i++) {
    d.push(d[i-1] * (1 + (Math.random() - 0.5) * vol));
  }
  return d;
}

/* ── OHLCV bar generator ── */
export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function generateOHLCV(bars: number, startPrice = 150, startTime?: number): OHLCVBar[] {
  const result: OHLCVBar[] = [];
  let price = startPrice;
  const baseTime = startTime || Date.now() - bars * 60000;
  for (let i = 0; i < bars; i++) {
    const open = price;
    const change = (Math.random() - 0.48) * 2;
    const high = open + Math.abs(change) + Math.random() * 1.5;
    const low = open - Math.abs(change) - Math.random() * 1.5;
    const close = open + change;
    const volume = Math.floor(50000 + Math.random() * 200000);
    result.push({
      time: baseTime + i * 60000,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +Math.min(open, close, low).toFixed(2),
      close: +close.toFixed(2),
      volume,
    });
    price = close;
  }
  return result;
}

/* type for re-export */
import React from 'react';
