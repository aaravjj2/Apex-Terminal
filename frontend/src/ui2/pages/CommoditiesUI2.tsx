import React, { useState, useRef, useEffect, useCallback } from 'react';

/* ── Bloomberg dark‑theme constants ────────────────────────── */
const BG      = '#0a0a0a';
const PANEL   = '#111111';
const BORDER  = '#1e1e1e';
const AMBER   = '#f5a623';
const GREEN   = '#26a69a';
const RED     = '#ef5350';
const BLUE    = '#42a5f5';
const PURPLE  = '#ab47bc';
const ORANGE  = '#ff8a65';
const SUBTLE  = '#555';
const TEXT    = '#d1d4dc';
const MONO    = '"Roboto Mono","Courier New",monospace';

/* ── Types ─────────────────────────────────────────────────── */
interface Commodity {
  name: string; ticker: string;
  last: number; change: number; changePct: number;
  bid: number; ask: number; open: number; high: number; low: number;
  volume: number; openInterest: number; unit: string;
}

interface FuturesContract {
  month: string; code: string; price: number; change: number;
  daysToExpiry: number; impliedCarry: number; volume: number; oi: number;
}

interface SpreadRow {
  name: string; front: number; back: number; spread: number;
  change: number; changePct: number; daysToExpiry: number;
}

interface SeasonalMonth { month: string; avg5y: number; avg10y: number; current: number; }

/* ── Mock data ─────────────────────────────────────────────── */
const ENERGY: Commodity[] = [
  { name: 'WTI Crude Oil',     ticker: 'CL',  last: 78.42, change: 1.23,  changePct: 1.59,  bid: 78.40, ask: 78.44, open: 77.15, high: 78.90, low: 76.85, volume: 384520, openInterest: 1842600, unit: '$/bbl' },
  { name: 'Brent Crude Oil',   ticker: 'CO',  last: 82.68, change: 0.95,  changePct: 1.16,  bid: 82.66, ask: 82.70, open: 81.70, high: 83.10, low: 81.25, volume: 263400, openInterest: 1456200, unit: '$/bbl' },
  { name: 'Natural Gas',       ticker: 'NG',  last: 2.84,  change: -0.12, changePct: -4.05, bid: 2.83,  ask: 2.85,  open: 2.96,  high: 2.98,  low: 2.80,  volume: 215800, openInterest: 985400,  unit: '$/mmBtu' },
  { name: 'Heating Oil',       ticker: 'HO',  last: 2.65,  change: 0.04,  changePct: 1.53,  bid: 2.64,  ask: 2.66,  open: 2.61,  high: 2.68,  low: 2.59,  volume: 58900,  openInterest: 245100,  unit: '$/gal' },
  { name: 'RBOB Gasoline',     ticker: 'RB',  last: 2.58,  change: 0.07,  changePct: 2.79,  bid: 2.57,  ask: 2.59,  open: 2.51,  high: 2.61,  low: 2.49,  volume: 72300,  openInterest: 198600,  unit: '$/gal' },
  { name: 'Coal (Newcastle)',  ticker: 'NCF', last: 135.20,change: -2.40, changePct: -1.74, bid: 135.0,ask: 135.4,open: 137.60,high: 138.10,low: 134.80,volume: 4200,   openInterest: 32100,   unit: '$/mt' },
];

const PRECIOUS_METALS: Commodity[] = [
  { name: 'Gold',      ticker: 'GC', last: 2024.60, change: 12.40, changePct: 0.62,  bid: 2024.40, ask: 2024.80, open: 2012.20, high: 2028.50, low: 2008.70, volume: 189500, openInterest: 456200, unit: '$/oz' },
  { name: 'Silver',    ticker: 'SI', last: 23.45,   change: 0.38,  changePct: 1.65,  bid: 23.43,   ask: 23.47,   open: 23.05,   high: 23.62,   low: 22.95,   volume: 72400,  openInterest: 142800, unit: '$/oz' },
  { name: 'Platinum',  ticker: 'PL', last: 912.30,  change: -5.70, changePct: -0.62, bid: 911.50,  ask: 913.10,  open: 918.00,  high: 920.40,  low: 908.60,  volume: 18600,  openInterest: 62100,  unit: '$/oz' },
  { name: 'Palladium', ticker: 'PA', last: 968.50,  change: 8.20,  changePct: 0.85,  bid: 967.00,  ask: 970.00,  open: 960.30,  high: 975.80,  low: 955.20,  volume: 8400,   openInterest: 21500,  unit: '$/oz' },
];

const INDUSTRIAL_METALS: Commodity[] = [
  { name: 'Copper',    ticker: 'HG', last: 3.95,    change: 0.06,  changePct: 1.54,  bid: 3.94,    ask: 3.96,    open: 3.89,    high: 3.98,    low: 3.87,    volume: 68200,  openInterest: 184500, unit: '$/lb' },
  { name: 'Aluminum',  ticker: 'ALI',last: 2285.0,  change: 18.0,  changePct: 0.79,  bid: 2283.0,  ask: 2287.0,  open: 2267.0,  high: 2298.0,  low: 2260.0,  volume: 12500,  openInterest: 45600,  unit: '$/mt' },
  { name: 'Zinc',      ticker: 'ZNC',last: 2485.0,  change: -32.0, changePct: -1.27, bid: 2483.0,  ask: 2487.0,  open: 2517.0,  high: 2520.0,  low: 2478.0,  volume: 8900,   openInterest: 28400,  unit: '$/mt' },
  { name: 'Nickel',    ticker: 'NI', last: 16420.0, change: 120.0, changePct: 0.74,  bid: 16400.0, ask: 16440.0, open: 16300.0, high: 16550.0, low: 16250.0, volume: 6200,   openInterest: 18500,  unit: '$/mt' },
  { name: 'Iron Ore',  ticker: 'TIO',last: 118.50,  change: -1.80, changePct: -1.50, bid: 118.30,  ask: 118.70,  open: 120.30,  high: 121.00,  low: 117.80,  volume: 42000,  openInterest: 98400,  unit: '$/mt' },
  { name: 'Steel HRC', ticker: 'HRC',last: 825.0,   change: 5.0,   changePct: 0.61,  bid: 823.0,   ask: 827.0,   open: 820.0,   high: 830.0,   low: 818.0,   volume: 3800,   openInterest: 12100,  unit: '$/st' },
];

const GRAINS: Commodity[] = [
  { name: 'Corn',     ticker: 'ZC', last: 486.25,  change: 4.50,  changePct: 0.93,  bid: 486.00,  ask: 486.50,  open: 481.75,  high: 488.00,  low: 480.25,  volume: 142500, openInterest: 624800, unit: '¢/bu' },
  { name: 'Wheat',    ticker: 'ZW', last: 612.50,  change: -8.25, changePct: -1.33, bid: 612.00,  ask: 613.00,  open: 620.75,  high: 622.50,  low: 608.75,  volume: 98400,  openInterest: 358200, unit: '¢/bu' },
  { name: 'Soybeans', ticker: 'ZS', last: 1345.00, change: 12.75, changePct: 0.96,  bid: 1344.50, ask: 1345.50, open: 1332.25, high: 1348.50, low: 1328.00, volume: 118600, openInterest: 462500, unit: '¢/bu' },
  { name: 'Oats',     ticker: 'ZO', last: 382.00,  change: 2.25,  changePct: 0.59,  bid: 381.50,  ask: 382.50,  open: 379.75,  high: 384.00,  low: 378.50,  volume: 2800,   openInterest: 8400,   unit: '¢/bu' },
  { name: 'Rice',     ticker: 'ZR', last: 17.38,   change: -0.12, changePct: -0.69, bid: 17.36,   ask: 17.40,   open: 17.50,   high: 17.55,   low: 17.28,   volume: 3200,   openInterest: 6800,   unit: '¢/cwt' },
];

const SOFTS: Commodity[] = [
  { name: 'Coffee',       ticker: 'KC', last: 185.40, change: 3.20,  changePct: 1.76,  bid: 185.20, ask: 185.60, open: 182.20, high: 186.80, low: 181.50, volume: 32400,  openInterest: 124600, unit: '¢/lb' },
  { name: 'Cocoa',        ticker: 'CC', last: 4285.0, change: 45.0,  changePct: 1.06,  bid: 4280.0, ask: 4290.0, open: 4240.0, high: 4310.0, low: 4220.0, volume: 18600,  openInterest: 62400,  unit: '$/mt' },
  { name: 'Sugar #11',    ticker: 'SB', last: 24.65,  change: -0.32, changePct: -1.28, bid: 24.63,  ask: 24.67,  open: 24.97,  high: 25.10,  low: 24.50,  volume: 86200,  openInterest: 298400, unit: '¢/lb' },
  { name: 'Cotton',       ticker: 'CT', last: 82.45,  change: 0.85,  changePct: 1.04,  bid: 82.40,  ask: 82.50,  open: 81.60,  high: 83.10,  low: 81.20,  volume: 24800,  openInterest: 142600, unit: '¢/lb' },
  { name: 'Orange Juice', ticker: 'OJ', last: 348.50, change: 5.20,  changePct: 1.51,  bid: 348.00, ask: 349.00, open: 343.30, high: 350.80, low: 342.00, volume: 4200,   openInterest: 18400,  unit: '¢/lb' },
];

const LIVESTOCK: Commodity[] = [
  { name: 'Live Cattle',   ticker: 'LE', last: 178.45, change: 0.62,  changePct: 0.35,  bid: 178.40, ask: 178.50, open: 177.83, high: 179.10, low: 177.50, volume: 42600, openInterest: 284500, unit: '¢/lb' },
  { name: 'Lean Hogs',     ticker: 'HE', last: 82.35,  change: -1.25, changePct: -1.50, bid: 82.30,  ask: 82.40,  open: 83.60,  high: 83.80,  low: 81.90,  volume: 28400, openInterest: 186200, unit: '¢/lb' },
  { name: 'Feeder Cattle', ticker: 'GF', last: 242.80, change: 1.15,  changePct: 0.48,  bid: 242.70, ask: 242.90, open: 241.65, high: 243.50, low: 241.20, volume: 8600,  openInterest: 48200,  unit: '¢/lb' },
];

/* WTI Futures Curve */
const WTI_CURVE: FuturesContract[] = [
  { month: 'Jan 25', code: 'CLF5', price: 78.42, change: 1.23,  daysToExpiry: 18,  impliedCarry: 0.00, volume: 384520, oi: 1842600 },
  { month: 'Feb 25', code: 'CLG5', price: 78.15, change: 1.10,  daysToExpiry: 48,  impliedCarry: -0.41, volume: 245800, oi: 684200 },
  { month: 'Mar 25', code: 'CLH5', price: 77.82, change: 0.98,  daysToExpiry: 76,  impliedCarry: -0.51, volume: 186400, oi: 542100 },
  { month: 'Apr 25', code: 'CLJ5', price: 77.45, change: 0.85,  daysToExpiry: 107, impliedCarry: -0.47, volume: 124600, oi: 384500 },
  { month: 'May 25', code: 'CLK5', price: 77.02, change: 0.72,  daysToExpiry: 137, impliedCarry: -0.41, volume: 98200,  oi: 298400 },
  { month: 'Jun 25', code: 'CLM5', price: 76.58, change: 0.60,  daysToExpiry: 168, impliedCarry: -0.39, volume: 142800, oi: 462100 },
  { month: 'Jul 25', code: 'CLN5', price: 76.12, change: 0.48,  daysToExpiry: 198, impliedCarry: -0.37, volume: 62400,  oi: 184600 },
  { month: 'Aug 25', code: 'CLQ5', price: 75.65, change: 0.38,  daysToExpiry: 229, impliedCarry: -0.36, volume: 48200,  oi: 142800 },
  { month: 'Sep 25', code: 'CLU5', price: 75.18, change: 0.28,  daysToExpiry: 260, impliedCarry: -0.34, volume: 86400,  oi: 268400 },
  { month: 'Oct 25', code: 'CLV5', price: 74.72, change: 0.20,  daysToExpiry: 290, impliedCarry: -0.32, volume: 32600,  oi: 98400  },
  { month: 'Nov 25', code: 'CLX5', price: 74.28, change: 0.12,  daysToExpiry: 321, impliedCarry: -0.31, volume: 28400,  oi: 86200  },
  { month: 'Dec 25', code: 'CLZ5', price: 73.85, change: 0.05,  daysToExpiry: 351, impliedCarry: -0.29, volume: 124600, oi: 384500 },
];

const GOLD_CURVE: FuturesContract[] = [
  { month: 'Jan 25', code: 'GCF5', price: 2024.60, change: 12.40, daysToExpiry: 15,  impliedCarry: 0.00,  volume: 189500, oi: 456200 },
  { month: 'Feb 25', code: 'GCG5', price: 2032.80, change: 11.80, daysToExpiry: 46,  impliedCarry: 4.87,  volume: 142600, oi: 324800 },
  { month: 'Apr 25', code: 'GCJ5', price: 2048.20, change: 11.20, daysToExpiry: 107, impliedCarry: 3.82,  volume: 98400,  oi: 248600 },
  { month: 'Jun 25', code: 'GCM5', price: 2063.40, change: 10.60, daysToExpiry: 168, impliedCarry: 3.48,  volume: 62400,  oi: 184500 },
  { month: 'Aug 25', code: 'GCQ5', price: 2078.10, change: 10.00, daysToExpiry: 229, impliedCarry: 3.28,  volume: 32400,  oi: 98600  },
  { month: 'Dec 25', code: 'GCZ5', price: 2105.80, change: 9.20,  daysToExpiry: 351, impliedCarry: 4.16,  volume: 86200,  oi: 286400 },
];

const SPREADS_DATA: SpreadRow[] = [
  { name: 'WTI CL M1-M2',        front: 78.42, back: 78.15, spread: 0.27,   change: 0.13,  changePct: 92.86,  daysToExpiry: 30 },
  { name: 'WTI CL M1-M6',        front: 78.42, back: 76.58, spread: 1.84,   change: 0.63,  changePct: 52.07,  daysToExpiry: 150 },
  { name: 'WTI CL M1-M12',       front: 78.42, back: 73.85, spread: 4.57,   change: 1.18,  changePct: 34.81,  daysToExpiry: 333 },
  { name: 'Brent-WTI',           front: 82.68, back: 78.42, spread: 4.26,   change: -0.28, changePct: -6.17,  daysToExpiry: 0 },
  { name: 'Crack 3-2-1',         front: 78.42, back: 0,     spread: 28.65,  change: 1.42,  changePct: 5.22,   daysToExpiry: 0 },
  { name: 'Soybean Crush',       front: 1345.0,back: 0,     spread: 186.25, change: 4.80,  changePct: 2.65,   daysToExpiry: 0 },
  { name: 'Gold-Platinum',       front: 2024.60,back: 912.30,spread: 1112.30,change: 18.10, changePct: 1.65,   daysToExpiry: 0 },
  { name: 'Gold/Silver Ratio',   front: 2024.60,back: 23.45, spread: 86.34,  change: -0.82, changePct: -0.94,  daysToExpiry: 0 },
];

const SEASONAL: SeasonalMonth[] = [
  { month: 'Jan', avg5y: 2.1,  avg10y: 1.8,  current: 3.2 },
  { month: 'Feb', avg5y: 1.5,  avg10y: 0.9,  current: -0.8 },
  { month: 'Mar', avg5y: -0.3, avg10y: 0.2,  current: 1.5 },
  { month: 'Apr', avg5y: 0.8,  avg10y: 1.2,  current: 2.8 },
  { month: 'May', avg5y: -1.2, avg10y: -0.8, current: -2.1 },
  { month: 'Jun', avg5y: 2.4,  avg10y: 1.9,  current: 4.2 },
  { month: 'Jul', avg5y: 3.1,  avg10y: 2.5,  current: 1.8 },
  { month: 'Aug', avg5y: -0.5, avg10y: 0.3,  current: -1.2 },
  { month: 'Sep', avg5y: -1.8, avg10y: -1.2, current: 0.5 },
  { month: 'Oct', avg5y: 0.6,  avg10y: 0.4,  current: -0.3 },
  { month: 'Nov', avg5y: 1.2,  avg10y: 0.8,  current: 2.1 },
  { month: 'Dec', avg5y: -0.4, avg10y: -0.1, current: 1.6 },
];

/* KPIs */
const KPI_DATA = [
  { label: 'WTI', value: 78.42, change: 1.59 },
  { label: 'GOLD', value: 2024.60, change: 0.62 },
  { label: 'COPPER', value: 3.95, change: 1.54 },
  { label: 'NAT GAS', value: 2.84, change: -4.05 },
  { label: 'CORN', value: 486.25, change: 0.93 },
  { label: 'DBA', value: 24.18, change: -0.42 },
];

/* OPEC Data */
const OPEC_DATA = [
  { label: 'OPEC Production', value: '27.08 mb/d', change: -0.2 },
  { label: 'OPEC+ Quota', value: '36.50 mb/d', change: 0 },
  { label: 'Compliance %', value: '114%', change: 2 },
  { label: 'Next Meeting', value: 'Mar 1', change: 0 },
];

const INVENTORY_DATA = [
  { label: 'API Crude', value: -2.4, unit: 'mb', consensus: -1.8 },
  { label: 'EIA Crude', value: -3.1, unit: 'mb', consensus: -2.0 },
  { label: 'SPR', value: 351.2, unit: 'mb', consensus: 0 },
  { label: 'Cushing', value: 22.3, unit: 'mb', consensus: 0 },
  { label: 'Gasoline', value: 1.8, unit: 'mb', consensus: 0.5 },
  { label: 'Distillates', value: -1.2, unit: 'mb', consensus: -0.8 },
];

/* Curves for selection */
const CURVE_OPTIONS = [
  { label: 'WTI Crude (CL)', data: WTI_CURVE },
  { label: 'Gold (GC)', data: GOLD_CURVE },
];

const SEASONAL_COMMODITIES = ['WTI Crude', 'Gold', 'Copper', 'Natural Gas', 'Corn', 'Soybeans'];

/* ── Styles ────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  root: { background: BG, color: TEXT, fontFamily: MONO, fontSize: 11, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' },
  kpiStrip: { display: 'flex', gap: 1, padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', flexShrink: 0 },
  kpiItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px', borderRight: `1px solid ${BORDER}` },
  kpiLabel: { color: SUBTLE, fontSize: 9, letterSpacing: 1.2 },
  kpiValue: { fontSize: 12, fontWeight: 600 },
  tabBar: { display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', flexShrink: 0 },
  tab: { padding: '6px 16px', cursor: 'pointer', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const, borderBottom: '2px solid transparent', color: SUBTLE, transition: 'all .15s' },
  tabActive: { color: AMBER, borderBottomColor: AMBER },
  body: { flex: 1, overflow: 'auto', padding: 8 },
  panel: { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, marginBottom: 8 },
  panelHead: { padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 10, letterSpacing: 1.2, color: AMBER, textTransform: 'uppercase' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th: { padding: '5px 8px', textAlign: 'right' as const, color: SUBTLE, fontSize: 9, letterSpacing: 1, borderBottom: `1px solid ${BORDER}`, position: 'sticky' as const, top: 0, background: PANEL },
  thLeft: { textAlign: 'left' as const },
  td: { padding: '4px 8px', textAlign: 'right' as const, borderBottom: `1px solid ${BORDER}22` },
  tdLeft: { textAlign: 'left' as const },
  select: { background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, padding: '3px 8px', fontSize: 10, borderRadius: 2, fontFamily: MONO },
  gridRow: { display: 'grid', gap: 8 },
};

/* ── Helpers ───────────────────────────────────────────────── */
function fmt(v: number, dec = 2): string { return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function chColor(v: number): string { return v >= 0 ? GREEN : RED; }
function chSign(v: number): string { return v >= 0 ? '+' : ''; }

/* ── KPI Strip ─────────────────────────────────────────────── */
const KPIStrip: React.FC = () => (
  <div style={S.kpiStrip}>
    {KPI_DATA.map(k => (
      <div key={k.label} style={S.kpiItem}>
        <span style={S.kpiLabel}>{k.label}</span>
        <span style={{ ...S.kpiValue, color: chColor(k.change) }}>{fmt(k.value)}</span>
        <span style={{ fontSize: 10, color: chColor(k.change) }}>{chSign(k.change)}{fmt(k.change)}%</span>
      </div>
    ))}
  </div>
);

/* ── Commodity Table ───────────────────────────────────────── */
const CommodityTable: React.FC<{ rows: Commodity[]; title: string }> = ({ rows, title }) => (
  <div style={S.panel}>
    <div style={S.panelHead}>{title}<span style={{ color: SUBTLE, fontSize: 9 }}>{rows.length} instruments</span></div>
    <div style={{ overflow: 'auto', maxHeight: 280 }}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, ...S.thLeft }}>NAME</th>
            <th style={S.th}>LAST</th>
            <th style={S.th}>CHG</th>
            <th style={S.th}>%CHG</th>
            <th style={S.th}>BID</th>
            <th style={S.th}>ASK</th>
            <th style={S.th}>OPEN</th>
            <th style={S.th}>HIGH</th>
            <th style={S.th}>LOW</th>
            <th style={S.th}>VOLUME</th>
            <th style={S.th}>OI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.ticker} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ ...S.td, ...S.tdLeft }}>
                <span style={{ color: AMBER }}>{r.ticker}</span>
                <span style={{ marginLeft: 8, color: SUBTLE }}>{r.name}</span>
              </td>
              <td style={S.td}>{fmt(r.last)}</td>
              <td style={{ ...S.td, color: chColor(r.change) }}>{chSign(r.change)}{fmt(r.change)}</td>
              <td style={{ ...S.td, color: chColor(r.changePct) }}>{chSign(r.changePct)}{fmt(r.changePct)}%</td>
              <td style={S.td}>{fmt(r.bid)}</td>
              <td style={S.td}>{fmt(r.ask)}</td>
              <td style={S.td}>{fmt(r.open)}</td>
              <td style={{ ...S.td, color: GREEN }}>{fmt(r.high)}</td>
              <td style={{ ...S.td, color: RED }}>{fmt(r.low)}</td>
              <td style={S.td}>{(r.volume / 1000).toFixed(1)}K</td>
              <td style={S.td}>{(r.openInterest / 1000).toFixed(1)}K</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ── Energy Tab ────────────────────────────────────────────── */
const EnergyTab: React.FC = () => (
  <div>
    <CommodityTable rows={ENERGY} title="ENERGY FUTURES" />
    <div style={{ ...S.gridRow, gridTemplateColumns: '1fr 1fr' }}>
      <div style={S.panel}>
        <div style={S.panelHead}>OPEC SUPPLY / DEMAND</div>
        <div style={{ padding: 8 }}>
          {OPEC_DATA.map(d => (
            <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22` }}>
              <span style={{ color: SUBTLE }}>{d.label}</span>
              <span style={{ color: d.change > 0 ? GREEN : d.change < 0 ? RED : TEXT }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.panel}>
        <div style={S.panelHead}>GLOBAL INVENTORIES</div>
        <div style={{ padding: 8 }}>
          <table style={S.table}>
            <thead><tr><th style={{ ...S.th, ...S.thLeft }}>REPORT</th><th style={S.th}>ACTUAL</th><th style={S.th}>CONS.</th><th style={S.th}>SURPRISE</th></tr></thead>
            <tbody>
              {INVENTORY_DATA.map(d => {
                const surprise = d.consensus !== 0 ? d.value - d.consensus : 0;
                return (
                  <tr key={d.label}>
                    <td style={{ ...S.td, ...S.tdLeft, color: SUBTLE }}>{d.label}</td>
                    <td style={{ ...S.td, color: d.value < 0 ? GREEN : RED }}>{chSign(d.value)}{fmt(d.value, 1)} {d.unit}</td>
                    <td style={S.td}>{d.consensus !== 0 ? `${chSign(d.consensus)}${fmt(d.consensus, 1)}` : '—'}</td>
                    <td style={{ ...S.td, color: surprise < 0 ? GREEN : surprise > 0 ? RED : SUBTLE }}>{d.consensus !== 0 ? `${chSign(surprise)}${fmt(surprise, 1)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

/* ── Metals Tab ────────────────────────────────────────────── */
const MetalsTab: React.FC = () => {
  const gsRatio = PRECIOUS_METALS[0].last / PRECIOUS_METALS[1].last;
  return (
    <div>
      <CommodityTable rows={PRECIOUS_METALS} title="PRECIOUS METALS" />
      <CommodityTable rows={INDUSTRIAL_METALS} title="INDUSTRIAL METALS" />
      <div style={{ ...S.gridRow, gridTemplateColumns: '1fr 1fr' }}>
        <div style={S.panel}>
          <div style={S.panelHead}>RATIOS</div>
          <div style={{ padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: SUBTLE }}>Gold/Silver Ratio</span><span style={{ color: AMBER }}>{fmt(gsRatio, 1)}x</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: SUBTLE }}>Gold/Platinum Spread</span><span style={{ color: GREEN }}>+${fmt(PRECIOUS_METALS[0].last - PRECIOUS_METALS[2].last, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: SUBTLE }}>Palladium/Platinum</span><span>{fmt(PRECIOUS_METALS[3].last / PRECIOUS_METALS[2].last, 2)}x</span>
            </div>
          </div>
        </div>
        <div style={S.panel}>
          <div style={S.panelHead}>METAL ETFs</div>
          <div style={{ padding: 8 }}>
            {[{ name: 'GLD', price: 186.42, ch: 0.58 }, { name: 'SLV', price: 21.85, ch: 1.42 }, { name: 'PPLT', price: 84.20, ch: -0.65 }, { name: 'PALL', price: 89.60, ch: 0.82 }, { name: 'COPX', price: 38.45, ch: 1.25 }].map(e => (
              <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22` }}>
                <span style={{ color: AMBER }}>{e.name}</span>
                <span>{fmt(e.price)}</span>
                <span style={{ color: chColor(e.ch) }}>{chSign(e.ch)}{fmt(e.ch)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Agriculture Tab ───────────────────────────────────────── */
const AgricultureTab: React.FC = () => (
  <div>
    <CommodityTable rows={GRAINS} title="GRAINS" />
    <CommodityTable rows={SOFTS} title="SOFTS" />
    <CommodityTable rows={LIVESTOCK} title="LIVESTOCK" />
    <div style={S.panel}>
      <div style={S.panelHead}>USDA CROP CONDITIONS & REPORTS</div>
      <div style={{ padding: 8 }}>
        <table style={S.table}>
          <thead><tr><th style={{ ...S.th, ...S.thLeft }}>REPORT</th><th style={S.th}>DATE</th><th style={S.th}>CROP</th><th style={S.th}>G/E %</th><th style={S.th}>PREV</th><th style={S.th}>YR AGO</th></tr></thead>
          <tbody>
            {[
              { report: 'Crop Progress', date: 'Dec 2', crop: 'Winter Wheat', ge: 47, prev: 50, yr: 34 },
              { report: 'WASDE', date: 'Dec 10', crop: 'Corn', ge: 0, prev: 0, yr: 0 },
              { report: 'Export Sales', date: 'Weekly', crop: 'Soybeans', ge: 0, prev: 0, yr: 0 },
              { report: 'Cattle on Feed', date: 'Dec 22', crop: 'Cattle', ge: 0, prev: 0, yr: 0 },
            ].map(r => (
              <tr key={r.report}>
                <td style={{ ...S.td, ...S.tdLeft, color: BLUE }}>{r.report}</td>
                <td style={S.td}>{r.date}</td>
                <td style={{ ...S.td, color: AMBER }}>{r.crop}</td>
                <td style={{ ...S.td, color: r.ge > 0 ? GREEN : SUBTLE }}>{r.ge > 0 ? `${r.ge}%` : '—'}</td>
                <td style={S.td}>{r.prev > 0 ? `${r.prev}%` : '—'}</td>
                <td style={{ ...S.td, color: r.yr > 0 && r.ge > r.yr ? GREEN : r.yr > 0 ? RED : SUBTLE }}>{r.yr > 0 ? `${r.yr}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

/* ── Futures Curve Tab (Canvas) ────────────────────────────── */
const FuturesCurveTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCurve, setSelectedCurve] = useState(0);
  const curveData = CURVE_OPTIONS[selectedCurve].data;

  const drawCurve = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = 320;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 30, right: 60, bottom: 40, left: 80 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const prices = curveData.map(c => c.price);
    const minP = Math.min(...prices) * 0.998;
    const maxP = Math.max(...prices) * 1.002;
    const yScale = (v: number) => pad.top + chartH - ((v - minP) / (maxP - minP)) * chartH;
    const xScale = (i: number) => pad.left + (i / (curveData.length - 1)) * chartW;

    // Grid
    ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      const val = maxP - ((maxP - minP) / 5) * i;
      ctx.fillStyle = SUBTLE; ctx.font = '9px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(fmt(val), pad.left - 6, y + 3);
    }

    // X labels
    ctx.textAlign = 'center'; ctx.fillStyle = SUBTLE; ctx.font = '9px ' + MONO;
    curveData.forEach((c, i) => { ctx.fillText(c.month, xScale(i), H - pad.bottom + 16); });

    // Determine contango or backwardation
    const isContango = prices[prices.length - 1] < prices[0];

    // Area fill
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(prices[0]));
    prices.forEach((p, i) => ctx.lineTo(xScale(i), yScale(p)));
    ctx.lineTo(xScale(prices.length - 1), pad.top + chartH);
    ctx.lineTo(xScale(0), pad.top + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    if (isContango) { grad.addColorStop(0, `${RED}30`); grad.addColorStop(1, `${RED}05`); }
    else { grad.addColorStop(0, `${GREEN}30`); grad.addColorStop(1, `${GREEN}05`); }
    ctx.fillStyle = grad; ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(prices[0]));
    prices.forEach((p, i) => ctx.lineTo(xScale(i), yScale(p)));
    ctx.strokeStyle = isContango ? RED : GREEN; ctx.lineWidth = 2; ctx.stroke();

    // Dots
    prices.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(p), 3, 0, Math.PI * 2);
      ctx.fillStyle = isContango ? RED : GREEN; ctx.fill();
    });

    // Label
    ctx.fillStyle = AMBER; ctx.font = 'bold 11px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText(isContango ? 'BACKWARDATION' : 'CONTANGO', pad.left + 4, pad.top + 14);

    // Spot label
    ctx.fillStyle = TEXT; ctx.font = '10px ' + MONO;
    ctx.fillText(`Spot: ${fmt(prices[0])}`, pad.left + 4, pad.top + 28);
    ctx.fillText(`Deferred: ${fmt(prices[prices.length - 1])}`, pad.left + 4, pad.top + 42);
    const spread = prices[0] - prices[prices.length - 1];
    ctx.fillStyle = spread > 0 ? GREEN : RED;
    ctx.fillText(`Spread: ${chSign(spread)}${fmt(spread)}`, pad.left + 4, pad.top + 56);
  }, [curveData]);

  useEffect(() => { drawCurve(); }, [drawCurve]);
  useEffect(() => {
    const obs = new ResizeObserver(drawCurve);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [drawCurve]);

  return (
    <div>
      <div style={{ ...S.panel }}>
        <div style={S.panelHead}>
          <span>FUTURES TERM STRUCTURE</span>
          <select style={S.select} value={selectedCurve} onChange={e => setSelectedCurve(Number(e.target.value))}>
            {CURVE_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
          </select>
        </div>
        <div ref={containerRef} style={{ padding: 4 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>CONTRACT DETAILS<span style={{ color: SUBTLE, fontSize: 9 }}>{curveData.length} contracts</span></div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft }}>MONTH</th>
                <th style={S.th}>CODE</th>
                <th style={S.th}>PRICE</th>
                <th style={S.th}>CHG</th>
                <th style={S.th}>DTE</th>
                <th style={S.th}>CARRY (ann.)</th>
                <th style={S.th}>VOLUME</th>
                <th style={S.th}>O.I.</th>
              </tr>
            </thead>
            <tbody>
              {curveData.map((c, i) => (
                <tr key={c.code}>
                  <td style={{ ...S.td, ...S.tdLeft, color: i === 0 ? AMBER : TEXT }}>{c.month}{i === 0 ? ' ★' : ''}</td>
                  <td style={{ ...S.td, color: BLUE }}>{c.code}</td>
                  <td style={S.td}>{fmt(c.price)}</td>
                  <td style={{ ...S.td, color: chColor(c.change) }}>{chSign(c.change)}{fmt(c.change)}</td>
                  <td style={S.td}>{c.daysToExpiry}</td>
                  <td style={{ ...S.td, color: c.impliedCarry >= 0 ? GREEN : RED }}>{c.impliedCarry !== 0 ? `${chSign(c.impliedCarry)}${fmt(c.impliedCarry)}%` : '—'}</td>
                  <td style={S.td}>{(c.volume / 1000).toFixed(1)}K</td>
                  <td style={S.td}>{(c.oi / 1000).toFixed(1)}K</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ── Seasonality Tab (Canvas) ──────────────────────────────── */
const SeasonalityTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = 300;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 30, right: 40, bottom: 40, left: 60 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    const allVals = SEASONAL.flatMap(s => [s.avg5y, s.avg10y, s.current]);
    const minV = Math.min(...allVals) - 1;
    const maxV = Math.max(...allVals) + 1;
    const yScale = (v: number) => pad.top + chartH - ((v - minV) / (maxV - minV)) * chartH;
    const xScale = (i: number) => pad.left + (i / 11) * chartW;

    // Zero line
    const zeroY = yScale(0);
    ctx.strokeStyle = SUBTLE; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(pad.left + chartW, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // Grid
    ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      const val = maxV - ((maxV - minV) / 5) * i;
      ctx.fillStyle = SUBTLE; ctx.font = '9px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText(`${fmt(val, 1)}%`, pad.left - 6, y + 3);
    }

    // X labels
    ctx.textAlign = 'center'; ctx.fillStyle = SUBTLE; ctx.font = '9px ' + MONO;
    SEASONAL.forEach((s, i) => { ctx.fillText(s.month, xScale(i), H - pad.bottom + 16); });

    // Bar chart for current year
    const barW = chartW / 12 * 0.5;
    SEASONAL.forEach((s, i) => {
      const x = xScale(i) - barW / 2;
      const barH = Math.abs(s.current) / (maxV - minV) * chartH;
      const y = s.current >= 0 ? zeroY - barH : zeroY;
      ctx.fillStyle = s.current >= 0 ? `${GREEN}60` : `${RED}60`;
      ctx.fillRect(x, y, barW, barH);
    });

    // Lines
    const drawLine = (data: number[], color: string, dash: number[] = []) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(dash);
      data.forEach((v, i) => { i === 0 ? ctx.moveTo(xScale(i), yScale(v)) : ctx.lineTo(xScale(i), yScale(v)); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    drawLine(SEASONAL.map(s => s.avg10y), BLUE, [6, 3]);
    drawLine(SEASONAL.map(s => s.avg5y), PURPLE, [3, 3]);
    drawLine(SEASONAL.map(s => s.current), AMBER);

    // Dots for current
    SEASONAL.forEach((s, i) => {
      ctx.beginPath(); ctx.arc(xScale(i), yScale(s.current), 3, 0, Math.PI * 2);
      ctx.fillStyle = AMBER; ctx.fill();
    });

    // Legend
    const legendY = pad.top + 6;
    [[AMBER, '— Current Year'], [PURPLE, '··· 5Y Avg'], [BLUE, '--- 10Y Avg']].forEach(([c, l], i) => {
      ctx.fillStyle = c as string; ctx.font = '9px ' + MONO; ctx.textAlign = 'left';
      ctx.fillText(l as string, pad.left + 4 + i * 120, legendY);
    });
  }, [selected]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const obs = new ResizeObserver(draw);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div>
      <div style={S.panel}>
        <div style={S.panelHead}>
          <span>SEASONAL PATTERN</span>
          <select style={S.select} value={selected} onChange={e => setSelected(Number(e.target.value))}>
            {SEASONAL_COMMODITIES.map((c, i) => <option key={i} value={i}>{c}</option>)}
          </select>
        </div>
        <div ref={containerRef} style={{ padding: 4 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>MONTHLY RETURNS (%)</div>
        <div style={{ overflow: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.thLeft }}>MONTH</th>
                <th style={S.th}>5Y AVG</th>
                <th style={S.th}>10Y AVG</th>
                <th style={S.th}>CURRENT</th>
                <th style={S.th}>BEST YEAR</th>
                <th style={S.th}>WORST YEAR</th>
              </tr>
            </thead>
            <tbody>
              {SEASONAL.map(s => (
                <tr key={s.month}>
                  <td style={{ ...S.td, ...S.tdLeft, color: AMBER }}>{s.month}</td>
                  <td style={{ ...S.td, color: chColor(s.avg5y) }}>{chSign(s.avg5y)}{fmt(s.avg5y, 1)}%</td>
                  <td style={{ ...S.td, color: chColor(s.avg10y) }}>{chSign(s.avg10y)}{fmt(s.avg10y, 1)}%</td>
                  <td style={{ ...S.td, color: chColor(s.current), fontWeight: 600 }}>{chSign(s.current)}{fmt(s.current, 1)}%</td>
                  <td style={{ ...S.td, color: GREEN }}>{`+${fmt(Math.abs(s.avg5y) * 3.2, 1)}%`}</td>
                  <td style={{ ...S.td, color: RED }}>{`-${fmt(Math.abs(s.avg10y) * 2.8, 1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ── Spreads Tab ───────────────────────────────────────────── */
const SpreadsTab: React.FC = () => (
  <div>
    <div style={S.panel}>
      <div style={S.panelHead}>CALENDAR & INTER-COMMODITY SPREADS</div>
      <div style={{ overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.thLeft }}>SPREAD</th>
              <th style={S.th}>FRONT</th>
              <th style={S.th}>BACK</th>
              <th style={S.th}>SPREAD</th>
              <th style={S.th}>CHG</th>
              <th style={S.th}>%CHG</th>
            </tr>
          </thead>
          <tbody>
            {SPREADS_DATA.map(s => (
              <tr key={s.name}>
                <td style={{ ...S.td, ...S.tdLeft, color: AMBER }}>{s.name}</td>
                <td style={S.td}>{fmt(s.front)}</td>
                <td style={S.td}>{s.back > 0 ? fmt(s.back) : '—'}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{fmt(s.spread)}</td>
                <td style={{ ...S.td, color: chColor(s.change) }}>{chSign(s.change)}{fmt(s.change)}</td>
                <td style={{ ...S.td, color: chColor(s.changePct) }}>{chSign(s.changePct)}{fmt(s.changePct)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div style={{ ...S.gridRow, gridTemplateColumns: '1fr 1fr 1fr' }}>
      {[
        { title: 'CRACK SPREAD (3-2-1)', desc: 'Refining margin: 3 bbl crude → 2 bbl gasoline + 1 bbl heating oil', value: '$28.65/bbl', ch: 5.22 },
        { title: 'CRUSH SPREAD', desc: 'Soybean processing margin: beans → meal + oil', value: '$1.8625/bu', ch: 2.65 },
        { title: 'FRAC SPREAD', desc: 'Natural gas processing margin: gas → NGL', value: '$12.40/bbl', ch: -3.18 },
      ].map(s => (
        <div key={s.title} style={S.panel}>
          <div style={S.panelHead}>{s.title}</div>
          <div style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: chColor(s.ch) }}>{s.value}</div>
            <div style={{ color: chColor(s.ch), fontSize: 11, marginTop: 4 }}>{chSign(s.ch)}{fmt(s.ch)}%</div>
            <div style={{ color: SUBTLE, fontSize: 9, marginTop: 8 }}>{s.desc}</div>
          </div>
        </div>
      ))}
    </div>

    <div style={S.panel}>
      <div style={S.panelHead}>SPREAD ANALYTICS</div>
      <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Brent-WTI Avg (30d)', value: '$4.15', color: BLUE },
          { label: 'WTI Backwardation', value: '$4.57/yr', color: GREEN },
          { label: 'Gold/Silver Ratio', value: '86.3x', color: AMBER },
          { label: 'Contango Cost (WTI)', value: '-5.8%/yr', color: RED },
        ].map(a => (
          <div key={a.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: a.color }}>{a.value}</div>
            <div style={{ color: SUBTLE, fontSize: 9, marginTop: 4 }}>{a.label}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Main Component ────────────────────────────────────────── */
const TABS = ['ENERGY', 'METALS', 'AGRICULTURE', 'FUTURES CURVE', 'SEASONALITY', 'SPREADS'] as const;
type Tab = typeof TABS[number];

export default function CommoditiesUI2() {
  const [tab, setTab] = useState<Tab>('ENERGY');

  return (
    <div style={S.root}>
      <KPIStrip />
      <div style={S.tabBar}>
        {TABS.map(t => (
          <div key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>
      <div style={S.body}>
        {tab === 'ENERGY' && <EnergyTab />}
        {tab === 'METALS' && <MetalsTab />}
        {tab === 'AGRICULTURE' && <AgricultureTab />}
        {tab === 'FUTURES CURVE' && <FuturesCurveTab />}
        {tab === 'SEASONALITY' && <SeasonalityTab />}
        {tab === 'SPREADS' && <SpreadsTab />}
      </div>
    </div>
  );
}
