import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * FixedIncomeUI2 — Bloomberg Terminal-Grade Fixed Income Dashboard
 * Yield curve canvas charts, bond search, analytics calculator, credit spreads,
 * and global rates monitor. All inline Bloomberg styling, zero external deps.
 */

// ─── Bloomberg APEX palette ─────────────────────────────────────────────────
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

// ─── Shared micro-styles ────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: PANEL, border: `1px solid ${BORDER}`, borderTop: `2px solid ${AMBER}`,
  overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 0,
};
const panelHdr: React.CSSProperties = {
  padding: '4px 10px', background: 'rgba(245,166,35,0.06)', borderBottom: `1px solid ${BORDER}`,
  fontSize: 9, color: AMBER, fontWeight: 700, letterSpacing: '0.12em',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  textTransform: 'uppercase', fontFamily: MONO,
};
const btnBase: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${BORDER}`, color: SUBTLE,
  fontFamily: MONO, fontSize: 10, padding: '3px 10px', cursor: 'pointer',
  letterSpacing: '0.08em', transition: 'all 0.15s',
};
const btnActive: React.CSSProperties = {
  ...btnBase, background: 'rgba(245,166,35,0.12)', color: AMBER, borderColor: AMBER,
};
const cellStyle: React.CSSProperties = {
  padding: '3px 8px', fontSize: 10, fontFamily: MONO, color: TEXT,
  borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};
const thStyle: React.CSSProperties = {
  ...cellStyle, color: AMBER, fontWeight: 700, fontSize: 9, letterSpacing: '0.1em',
  position: 'sticky' as const, top: 0, background: PANEL, zIndex: 2,
  cursor: 'pointer', userSelect: 'none',
};
const inputStyle: React.CSSProperties = {
  background: '#0d0d0d', border: `1px solid ${BORDER}`, color: TEXT,
  fontFamily: MONO, fontSize: 10, padding: '4px 8px', borderRadius: 0,
  outline: 'none', width: '100%',
};

// ─── Types ──────────────────────────────────────────────────────────────────
type TabKey = 'YIELD CURVE' | 'BOND SEARCH' | 'ANALYTICS' | 'CREDIT SPREADS' | 'RATES MONITOR';

interface YieldPoint { maturity: string; years: number; yield: number; change: number; prev1m: number; prev1y: number; }
interface BondRow {
  cusip: string; issuer: string; type: 'Treasury' | 'Corporate' | 'Municipal' | 'Agency';
  coupon: number; maturityDate: string; yield: number; price: number;
  ratingMoodys: string; ratingSP: string; duration: number; spread: number;
  sector?: string;
}
interface SpreadRow { rating: string; current: number; w52Low: number; w52High: number; zScore: number; pctRank: number; color: string; }
interface GlobalRate { country: string; flag: string; y2: number; y5: number; y10: number; y30: number; chg10: number; }
interface CentralBankRate { bank: string; rate: number; lastMove: string; nextMeet: string; }
interface MoneyRate { name: string; rate: number; change: number; }
interface SwapRate { tenor: string; rate: number; spread: number; change: number; }

// ─── Mock Data ──────────────────────────────────────────────────────────────
const MATURITIES: YieldPoint[] = [
  { maturity: '1M',  years: 1/12,  yield: 5.33, change: -0.02, prev1m: 5.35, prev1y: 5.45 },
  { maturity: '3M',  years: 0.25,  yield: 5.28, change: -0.01, prev1m: 5.30, prev1y: 5.40 },
  { maturity: '6M',  years: 0.5,   yield: 5.12, change: -0.03, prev1m: 5.18, prev1y: 5.35 },
  { maturity: '1Y',  years: 1,     yield: 4.85, change: -0.05, prev1m: 4.95, prev1y: 5.20 },
  { maturity: '2Y',  years: 2,     yield: 4.52, change: -0.08, prev1m: 4.68, prev1y: 4.95 },
  { maturity: '3Y',  years: 3,     yield: 4.28, change: -0.06, prev1m: 4.40, prev1y: 4.72 },
  { maturity: '5Y',  years: 5,     yield: 4.15, change: -0.04, prev1m: 4.22, prev1y: 4.50 },
  { maturity: '7Y',  years: 7,     yield: 4.22, change: -0.02, prev1m: 4.28, prev1y: 4.45 },
  { maturity: '10Y', years: 10,    yield: 4.28, change:  0.01, prev1m: 4.30, prev1y: 4.38 },
  { maturity: '20Y', years: 20,    yield: 4.55, change:  0.03, prev1m: 4.52, prev1y: 4.48 },
  { maturity: '30Y', years: 30,    yield: 4.48, change:  0.02, prev1m: 4.45, prev1y: 4.35 },
];

const MOCK_BONDS: BondRow[] = [
  // Treasury
  { cusip: '912828ZT6', issuer: 'US Treasury', type: 'Treasury', coupon: 0.125, maturityDate: '2025-06-30', yield: 5.01, price: 97.42, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 0.4, spread: 0, sector: 'Government' },
  { cusip: '91282CHV1', issuer: 'US Treasury', type: 'Treasury', coupon: 4.625, maturityDate: '2026-09-15', yield: 4.58, price: 100.12, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 1.3, spread: 0, sector: 'Government' },
  { cusip: '91282CJR8', issuer: 'US Treasury', type: 'Treasury', coupon: 4.250, maturityDate: '2028-12-31', yield: 4.22, price: 100.18, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 3.8, spread: 0, sector: 'Government' },
  { cusip: '91282CKA3', issuer: 'US Treasury', type: 'Treasury', coupon: 4.375, maturityDate: '2033-11-15', yield: 4.30, price: 100.55, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 7.9, spread: 0, sector: 'Government' },
  { cusip: '912810TM0', issuer: 'US Treasury', type: 'Treasury', coupon: 4.750, maturityDate: '2053-11-15', yield: 4.50, price: 104.20, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 17.2, spread: 0, sector: 'Government' },
  // Corporate IG
  { cusip: '037833DX1', issuer: 'Apple Inc', type: 'Corporate', coupon: 3.850, maturityDate: '2029-05-04', yield: 4.38, price: 97.85, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 4.2, spread: 16, sector: 'Technology' },
  { cusip: '594918CE3', issuer: 'Microsoft Corp', type: 'Corporate', coupon: 3.500, maturityDate: '2030-02-12', yield: 4.42, price: 96.10, ratingMoodys: 'Aaa', ratingSP: 'AAA', duration: 5.1, spread: 20, sector: 'Technology' },
  { cusip: '459200KQ4', issuer: 'IBM Corp', type: 'Corporate', coupon: 4.150, maturityDate: '2028-07-27', yield: 4.65, price: 98.52, ratingMoodys: 'A2', ratingSP: 'A-', duration: 3.5, spread: 43, sector: 'Technology' },
  { cusip: '369604BQ2', issuer: 'General Electric', type: 'Corporate', coupon: 4.350, maturityDate: '2032-03-15', yield: 4.88, price: 96.30, ratingMoodys: 'Baa1', ratingSP: 'BBB+', duration: 6.5, spread: 66, sector: 'Industrials' },
  { cusip: '46625HRL6', issuer: 'JPMorgan Chase', type: 'Corporate', coupon: 4.850, maturityDate: '2031-06-01', yield: 4.95, price: 99.38, ratingMoodys: 'A1', ratingSP: 'A-', duration: 5.4, spread: 73, sector: 'Financials' },
  { cusip: '06051GJD8', issuer: 'Bank of America', type: 'Corporate', coupon: 5.015, maturityDate: '2033-07-22', yield: 5.18, price: 98.60, ratingMoodys: 'A1', ratingSP: 'A-', duration: 6.8, spread: 96, sector: 'Financials' },
  { cusip: '17275RAR1', issuer: 'Cisco Systems', type: 'Corporate', coupon: 4.950, maturityDate: '2031-02-26', yield: 4.52, price: 102.45, ratingMoodys: 'A1', ratingSP: 'AA-', duration: 5.0, spread: 30, sector: 'Technology' },
  { cusip: '78013XGP1', issuer: 'Royal Dutch Shell', type: 'Corporate', coupon: 3.750, maturityDate: '2029-09-12', yield: 4.60, price: 96.25, ratingMoodys: 'Aa2', ratingSP: 'A+', duration: 4.3, spread: 38, sector: 'Energy' },
  { cusip: '30231GAV4', issuer: 'Exxon Mobil', type: 'Corporate', coupon: 4.227, maturityDate: '2034-03-19', yield: 4.75, price: 96.88, ratingMoodys: 'Aa1', ratingSP: 'AA-', duration: 7.6, spread: 53, sector: 'Energy' },
  { cusip: '58933YAZ8', issuer: 'Merck & Co', type: 'Corporate', coupon: 4.500, maturityDate: '2033-05-17', yield: 4.68, price: 98.72, ratingMoodys: 'A1', ratingSP: 'A+', duration: 6.9, spread: 46, sector: 'Healthcare' },
  // Corporate HY
  { cusip: '345370DA5', issuer: 'Ford Motor Co', type: 'Corporate', coupon: 6.100, maturityDate: '2032-08-19', yield: 6.55, price: 96.82, ratingMoodys: 'Ba2', ratingSP: 'BB+', duration: 5.8, spread: 233, sector: 'Autos' },
  { cusip: '247361ZZ9', issuer: 'Delta Air Lines', type: 'Corporate', coupon: 7.000, maturityDate: '2029-05-01', yield: 6.18, price: 103.15, ratingMoodys: 'Ba1', ratingSP: 'BB+', duration: 3.6, spread: 196, sector: 'Airlines' },
  { cusip: '29444UBF0', issuer: 'Equinix Inc', type: 'Corporate', coupon: 5.500, maturityDate: '2034-01-15', yield: 5.42, price: 100.55, ratingMoodys: 'Baa2', ratingSP: 'BBB-', duration: 7.1, spread: 120, sector: 'REITs' },
  { cusip: '655044AH5', issuer: 'Nordstrom Inc', type: 'Corporate', coupon: 6.950, maturityDate: '2028-03-15', yield: 7.20, price: 99.10, ratingMoodys: 'Ba3', ratingSP: 'BB-', duration: 2.8, spread: 298, sector: 'Retail' },
  { cusip: '172967MR9', issuer: 'Cinemark Holdings', type: 'Corporate', coupon: 7.750, maturityDate: '2030-06-15', yield: 7.85, price: 99.38, ratingMoodys: 'B1', ratingSP: 'B+', duration: 4.0, spread: 363, sector: 'Entertainment' },
  { cusip: '14913Q2E1', issuer: 'Carvana Co', type: 'Corporate', coupon: 9.000, maturityDate: '2028-12-01', yield: 9.65, price: 97.50, ratingMoodys: 'B3', ratingSP: 'B-', duration: 2.5, spread: 543, sector: 'Autos' },
  // Municipal
  { cusip: '13063DFM3', issuer: 'California GO', type: 'Municipal', coupon: 5.000, maturityDate: '2033-10-01', yield: 3.45, price: 110.85, ratingMoodys: 'Aa2', ratingSP: 'AA-', duration: 6.8, spread: -83, sector: 'State GO' },
  { cusip: '64966QFT4', issuer: 'New York City GO', type: 'Municipal', coupon: 5.250, maturityDate: '2034-08-01', yield: 3.62, price: 111.20, ratingMoodys: 'Aa2', ratingSP: 'AA', duration: 7.2, spread: -66, sector: 'City GO' },
  { cusip: '88279KBC1', issuer: 'Texas Water Dev', type: 'Municipal', coupon: 4.500, maturityDate: '2030-08-01', yield: 3.15, price: 106.38, ratingMoodys: 'Aaa', ratingSP: 'AAA', duration: 4.8, spread: -107, sector: 'Revenue' },
  { cusip: '282780HK3', issuer: 'Illinois GO', type: 'Municipal', coupon: 5.500, maturityDate: '2031-03-01', yield: 4.10, price: 106.55, ratingMoodys: 'Baa1', ratingSP: 'BBB+', duration: 4.5, spread: -12, sector: 'State GO' },
  { cusip: '574193TT2', issuer: 'Massachusetts GO', type: 'Municipal', coupon: 5.000, maturityDate: '2035-01-01', yield: 3.52, price: 112.10, ratingMoodys: 'Aa1', ratingSP: 'AA+', duration: 7.5, spread: -76, sector: 'State GO' },
  // Agency
  { cusip: '3130AWQT5', issuer: 'FHLB', type: 'Agency', coupon: 4.875, maturityDate: '2028-06-14', yield: 4.35, price: 101.82, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 3.2, spread: 13, sector: 'Agency' },
  { cusip: '3135G0ZR7', issuer: 'FNMA', type: 'Agency', coupon: 5.250, maturityDate: '2030-09-15', yield: 4.48, price: 104.20, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 4.8, spread: 26, sector: 'Agency' },
  { cusip: '3137EAEP5', issuer: 'FHLMC', type: 'Agency', coupon: 4.500, maturityDate: '2029-01-13', yield: 4.40, price: 100.35, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 3.6, spread: 18, sector: 'Agency' },
  { cusip: '313385VV2', issuer: 'FHLB', type: 'Agency', coupon: 5.500, maturityDate: '2033-03-09', yield: 4.60, price: 106.50, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 6.4, spread: 38, sector: 'Agency' },
  { cusip: '36962G7X0', issuer: 'GNMA II', type: 'Agency', coupon: 5.000, maturityDate: '2053-08-20', yield: 4.88, price: 101.80, ratingMoodys: 'Aaa', ratingSP: 'AA+', duration: 6.2, spread: 66, sector: 'MBS' },
];

const SPREAD_DATA: SpreadRow[] = [
  { rating: 'AAA', current: 48, w52Low: 38, w52High: 72, zScore: -0.3, pctRank: 22, color: GREEN },
  { rating: 'AA',  current: 62, w52Low: 48, w52High: 98, zScore: -0.1, pctRank: 30, color: '#4dd0e1' },
  { rating: 'A',   current: 95, w52Low: 72, w52High: 135, zScore: 0.2, pctRank: 42, color: BLUE },
  { rating: 'BBB', current: 138, w52Low: 105, w52High: 195, zScore: 0.4, pctRank: 48, color: AMBER },
  { rating: 'BB',  current: 215, w52Low: 165, w52High: 340, zScore: 0.1, pctRank: 38, color: ORANGE },
  { rating: 'B',   current: 365, w52Low: 280, w52High: 520, zScore: 0.5, pctRank: 52, color: RED },
  { rating: 'CCC', current: 820, w52Low: 580, w52High: 1250, zScore: 0.8, pctRank: 62, color: PURPLE },
];

const GLOBAL_RATES: GlobalRate[] = [
  { country: 'United States', flag: 'US', y2: 4.52, y5: 4.15, y10: 4.28, y30: 4.48, chg10: 0.01 },
  { country: 'United Kingdom', flag: 'GB', y2: 4.38, y5: 4.05, y10: 4.12, y30: 4.65, chg10: -0.03 },
  { country: 'Germany', flag: 'DE', y2: 2.82, y5: 2.35, y10: 2.42, y30: 2.68, chg10: -0.02 },
  { country: 'Japan', flag: 'JP', y2: 0.15, y5: 0.45, y10: 0.92, y30: 1.78, chg10: 0.04 },
  { country: 'Australia', flag: 'AU', y2: 3.95, y5: 3.88, y10: 4.15, y30: 4.55, chg10: 0.02 },
  { country: 'Canada', flag: 'CA', y2: 3.92, y5: 3.55, y10: 3.48, y30: 3.42, chg10: -0.04 },
  { country: 'France', flag: 'FR', y2: 2.95, y5: 2.72, y10: 3.05, y30: 3.45, chg10: -0.01 },
  { country: 'Italy', flag: 'IT', y2: 3.52, y5: 3.48, y10: 3.88, y30: 4.32, chg10: 0.03 },
  { country: 'Switzerland', flag: 'CH', y2: 1.05, y5: 0.82, y10: 0.85, y30: 0.92, chg10: -0.01 },
  { country: 'China', flag: 'CN', y2: 2.12, y5: 2.35, y10: 2.58, y30: 2.85, chg10: 0.02 },
];

const CB_RATES: CentralBankRate[] = [
  { bank: 'Federal Reserve (Fed)', rate: 5.25, lastMove: 'Jul 2023 (+25bp)', nextMeet: 'Mar 18-19' },
  { bank: 'European Central Bank', rate: 4.50, lastMove: 'Sep 2023 (+25bp)', nextMeet: 'Mar 06' },
  { bank: 'Bank of England', rate: 5.25, lastMove: 'Aug 2023 (+25bp)', nextMeet: 'Mar 20' },
  { bank: 'Bank of Japan', rate: -0.10, lastMove: 'Jan 2016 (-20bp)', nextMeet: 'Mar 18-19' },
  { bank: 'Bank of Canada', rate: 5.00, lastMove: 'Jul 2023 (+25bp)', nextMeet: 'Mar 06' },
  { bank: 'Reserve Bank of Aus.', rate: 4.35, lastMove: 'Nov 2023 (+25bp)', nextMeet: 'Mar 18-19' },
  { bank: 'Swiss National Bank', rate: 1.75, lastMove: 'Jun 2023 (+25bp)', nextMeet: 'Mar 21' },
  { bank: 'People\'s Bank of China', rate: 3.45, lastMove: 'Aug 2023 (-10bp)', nextMeet: 'Mar 15' },
];

const MONEY_RATES: MoneyRate[] = [
  { name: 'SOFR', rate: 5.31, change: 0.00 },
  { name: 'Fed Funds Effective', rate: 5.33, change: 0.00 },
  { name: 'AMERIBOR', rate: 5.36, change: -0.01 },
  { name: '4-Week T-Bill', rate: 5.28, change: -0.02 },
  { name: '13-Week T-Bill', rate: 5.24, change: -0.01 },
  { name: '26-Week T-Bill', rate: 5.10, change: -0.03 },
  { name: 'Overnight Repo', rate: 5.30, change: 0.01 },
  { name: 'Commercial Paper 1M', rate: 5.35, change: 0.00 },
];

const SWAP_RATES: SwapRate[] = [
  { tenor: '1Y', rate: 5.08, spread: -25, change: -0.02 },
  { tenor: '2Y', rate: 4.62, spread: 10, change: -0.05 },
  { tenor: '3Y', rate: 4.38, spread: 10, change: -0.04 },
  { tenor: '5Y', rate: 4.22, spread: 7, change: -0.03 },
  { tenor: '7Y', rate: 4.28, spread: 6, change: -0.01 },
  { tenor: '10Y', rate: 4.32, spread: 4, change: 0.01 },
  { tenor: '15Y', rate: 4.40, spread: 2, change: 0.02 },
  { tenor: '20Y', rate: 4.50, spread: -5, change: 0.02 },
  { tenor: '30Y', rate: 4.45, spread: -3, change: 0.01 },
];

const SECTOR_SPREADS = [
  { sector: 'Technology', ig: 28, hy: 310 },
  { sector: 'Financials', ig: 85, hy: 420 },
  { sector: 'Healthcare', ig: 52, hy: 345 },
  { sector: 'Energy', ig: 68, hy: 390 },
  { sector: 'Industrials', ig: 72, hy: 375 },
  { sector: 'Consumer Disc.', ig: 65, hy: 358 },
  { sector: 'Utilities', ig: 88, hy: 285 },
  { sector: 'REITs', ig: 110, hy: 440 },
  { sector: 'Telecom', ig: 95, hy: 395 },
  { sector: 'Materials', ig: 78, hy: 360 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const clr = (v: number) => v > 0 ? GREEN : v < 0 ? RED : SUBTLE;
const fmtBps = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)} bp`;
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtYld = (v: number) => `${v.toFixed(3)}%`;

// ─── KPI Data ───────────────────────────────────────────────────────────────
const KPI_ITEMS = [
  { label: '10Y UST', value: '4.280%', chg: '+1.0 bp', color: GREEN },
  { label: '2s10s', value: '-24 bp', chg: '+9 bp', color: RED },
  { label: 'IG OAS', value: '95 bp', chg: '-2 bp', color: GREEN },
  { label: 'HY OAS', value: '365 bp', chg: '+5 bp', color: RED },
  { label: 'Fed Funds', value: '5.25-5.50%', chg: 'UNCH', color: SUBTLE },
  { label: 'MOVE', value: '112.4', chg: '-1.8', color: GREEN },
];

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════
const FixedIncomeUI2: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('YIELD CURVE');
  const TABS: TabKey[] = ['YIELD CURVE', 'BOND SEARCH', 'ANALYTICS', 'CREDIT SPREADS', 'RATES MONITOR'];

  // ── Yield Curve state / canvas ──────────────────────────────────────────
  const ycCanvasRef = useRef<HTMLCanvasElement>(null);
  const [ycData, setYcData] = useState<YieldPoint[]>(MATURITIES);
  const [showPrev1m, setShowPrev1m] = useState(true);
  const [showPrev1y, setShowPrev1y] = useState(true);

  useEffect(() => {
    fetch('/api/v1/fixed-income/yield-curve')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: YieldPoint[]) => { if (Array.isArray(d) && d.length) setYcData(d); })
      .catch(() => { /* keep mock */ });
  }, []);

  const inversions = useMemo(() => {
    const inv: string[] = [];
    for (let i = 0; i < ycData.length - 1; i++) {
      if (ycData[i].yield > ycData[i + 1].yield) {
        inv.push(`${ycData[i].maturity} > ${ycData[i + 1].maturity}`);
      }
    }
    return inv;
  }, [ycData]);

  const drawYieldCurve = useCallback(() => {
    const cvs = ycCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { t: 24, r: 30, b: 36, l: 55 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

    // clear
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // data ranges
    const allYields = ycData.flatMap(p => [p.yield, p.prev1m, p.prev1y]);
    const yMin = Math.floor(Math.min(...allYields) * 10) / 10 - 0.2;
    const yMax = Math.ceil(Math.max(...allYields) * 10) / 10 + 0.2;

    const xPos = (i: number) => pad.l + (i / (ycData.length - 1)) * cw;
    const yPos = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ch;

    // gridlines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const ySteps = 8;
    for (let i = 0; i <= ySteps; i++) {
      const y = pad.t + (i / ySteps) * ch;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    }
    for (let i = 0; i < ycData.length; i++) {
      const x = xPos(i);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ch); ctx.stroke();
    }

    // axes labels
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = SUBTLE;
    ctx.textAlign = 'center';
    ycData.forEach((p, i) => {
      ctx.fillText(p.maturity, xPos(i), pad.t + ch + 16);
    });
    ctx.textAlign = 'right';
    for (let i = 0; i <= ySteps; i++) {
      const v = yMin + (yMax - yMin) * (1 - i / ySteps);
      ctx.fillText(v.toFixed(2) + '%', pad.l - 6, pad.t + (i / ySteps) * ch + 3);
    }

    // draw line helper
    const drawLine = (data: number[], color: string, lineWidth: number, dashed: boolean = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dashed ? [4, 3] : []);
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = xPos(i), y = yPos(v);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      // dots
      data.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(xPos(i), yPos(v), lineWidth + 1, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    };

    // 1yr ago
    if (showPrev1y) drawLine(ycData.map(p => p.prev1y), SUBTLE, 1, true);
    // 1mo ago
    if (showPrev1m) drawLine(ycData.map(p => p.prev1m), BLUE, 1.2, true);
    // current
    drawLine(ycData.map(p => p.yield), AMBER, 2);

    // legend
    ctx.font = `bold 9px ${MONO}`;
    const leg = [
      { label: 'CURRENT', color: AMBER },
      ...(showPrev1m ? [{ label: '1M AGO', color: BLUE }] : []),
      ...(showPrev1y ? [{ label: '1Y AGO', color: SUBTLE }] : []),
    ];
    let lx = pad.l + 8;
    leg.forEach(l => {
      ctx.fillStyle = l.color;
      ctx.fillRect(lx, pad.t + 4, 14, 2);
      ctx.fillText(l.label, lx + 18, pad.t + 9);
      lx += ctx.measureText(l.label).width + 32;
    });

    // inversion markers
    for (let i = 0; i < ycData.length - 1; i++) {
      if (ycData[i].yield > ycData[i + 1].yield) {
        const mx = (xPos(i) + xPos(i + 1)) / 2;
        const my = Math.min(yPos(ycData[i].yield), yPos(ycData[i + 1].yield)) - 8;
        ctx.fillStyle = RED;
        ctx.font = `bold 8px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText('▼ INV', mx, my);
      }
    }
  }, [ycData, showPrev1m, showPrev1y]);

  useEffect(() => {
    if (tab === 'YIELD CURVE') { drawYieldCurve(); }
  }, [tab, drawYieldCurve]);

  useEffect(() => {
    const handleResize = () => { if (tab === 'YIELD CURVE') drawYieldCurve(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tab, drawYieldCurve]);

  // ── Bond Search state ───────────────────────────────────────────────────
  const [bondSearch, setBondSearch] = useState('');
  const [bondTypeFilter, setBondTypeFilter] = useState<string>('All');
  const [bondMinYield, setBondMinYield] = useState('');
  const [bondMaxYield, setBondMaxYield] = useState('');
  const [bondRatingFilter, setBondRatingFilter] = useState('All');
  const [bondSort, setBondSort] = useState<{ col: string; asc: boolean }>({ col: 'issuer', asc: true });

  const filteredBonds = useMemo(() => {
    let list = [...MOCK_BONDS];
    if (bondSearch) {
      const q = bondSearch.toLowerCase();
      list = list.filter(b => b.issuer.toLowerCase().includes(q) || b.cusip.toLowerCase().includes(q));
    }
    if (bondTypeFilter !== 'All') list = list.filter(b => b.type === bondTypeFilter);
    if (bondMinYield) list = list.filter(b => b.yield >= parseFloat(bondMinYield));
    if (bondMaxYield) list = list.filter(b => b.yield <= parseFloat(bondMaxYield));
    if (bondRatingFilter !== 'All') list = list.filter(b => b.ratingSP.startsWith(bondRatingFilter));
    const col = bondSort.col;
    list.sort((a: any, b: any) => {
      const av = a[col], bv = b[col];
      if (typeof av === 'number') return bondSort.asc ? av - bv : bv - av;
      return bondSort.asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [bondSearch, bondTypeFilter, bondMinYield, bondMaxYield, bondRatingFilter, bondSort]);

  const toggleSort = (col: string) => {
    setBondSort(prev => ({ col, asc: prev.col === col ? !prev.asc : true }));
  };

  // ── Analytics state ─────────────────────────────────────────────────────
  const [calcCoupon, setCalcCoupon] = useState('5.0');
  const [calcYield, setCalcYield] = useState('4.5');
  const [calcMaturity, setCalcMaturity] = useState('10');
  const [calcFace, setCalcFace] = useState('1000');
  const [calcFreq, setCalcFreq] = useState('2');
  const [shiftBps, setShiftBps] = useState('100');
  const [twistBps, setTwistBps] = useState('50');

  const analytics = useMemo(() => {
    const c = parseFloat(calcCoupon) / 100;
    const y = parseFloat(calcYield) / 100;
    const n = parseFloat(calcMaturity);
    const fv = parseFloat(calcFace);
    const freq = parseInt(calcFreq);
    if ([c, y, n, fv, freq].some(isNaN) || freq <= 0 || y <= 0) return null;

    const periods = n * freq;
    const couponPmt = (c * fv) / freq;
    const r = y / freq;

    // Price
    let price = 0;
    const cashFlows: { period: number; cf: number; pv: number }[] = [];
    for (let t = 1; t <= periods; t++) {
      const cf = t === periods ? couponPmt + fv : couponPmt;
      const pv = cf / Math.pow(1 + r, t);
      price += pv;
      cashFlows.push({ period: t, cf, pv });
    }

    // Macaulay Duration
    let macD = 0;
    for (let t = 1; t <= periods; t++) {
      const cf = t === periods ? couponPmt + fv : couponPmt;
      macD += (t / freq) * (cf / Math.pow(1 + r, t));
    }
    macD /= price;

    // Modified Duration
    const modD = macD / (1 + r);

    // Convexity
    let conv = 0;
    for (let t = 1; t <= periods; t++) {
      const cf = t === periods ? couponPmt + fv : couponPmt;
      conv += (t * (t + 1)) * (cf / Math.pow(1 + r, t));
    }
    conv /= (price * freq * freq * Math.pow(1 + r, 2));

    // DV01
    const dv01 = modD * price / 10000;

    // Price at shifted yield
    const shift = parseInt(shiftBps) / 10000;
    const yUp = y + shift;
    const yDn = y - shift;
    let priceUp = 0, priceDn = 0;
    const rUp = yUp / freq, rDn = yDn / freq;
    for (let t = 1; t <= periods; t++) {
      const cf = t === periods ? couponPmt + fv : couponPmt;
      priceUp += cf / Math.pow(1 + rUp, t);
      priceDn += cf / Math.pow(1 + rDn, t);
    }

    // Twist scenario
    const twistV = parseInt(twistBps) / 10000;

    return {
      price, macD, modD, conv, dv01, cashFlows: cashFlows.slice(0, 20),
      priceUp, priceDn, shiftPnL: priceUp - price, shiftPnLDn: priceDn - price,
      twistShort: -modD * twistV * price * 0.3,
      twistLong: -modD * (-twistV) * price * 0.7,
      butterfly: -conv * twistV * twistV * price * 50,
    };
  }, [calcCoupon, calcYield, calcMaturity, calcFace, calcFreq, shiftBps, twistBps]);

  // ── Credit Spreads canvas ───────────────────────────────────────────────
  const csCanvasRef = useRef<HTMLCanvasElement>(null);

  const drawCreditSpreads = useCallback(() => {
    const cvs = csCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { t: 30, r: 20, b: 36, l: 55 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // Generate 24 historical data points for IG and HY
    const months = 24;
    const igBase = [82, 78, 85, 88, 92, 96, 105, 112, 108, 102, 98, 95,
                    93, 90, 88, 92, 98, 102, 100, 97, 95, 93, 96, 95];
    const hyBase = [320, 310, 335, 345, 360, 375, 410, 440, 425, 400, 378, 365,
                    355, 345, 340, 355, 380, 400, 390, 375, 365, 358, 368, 365];

    const allVals = [...igBase, ...hyBase];
    const yMin = 0;
    const yMax = Math.ceil(Math.max(...allVals) / 50) * 50 + 50;

    const xPos = (i: number) => pad.l + (i / (months - 1)) * cw;
    const yPos = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ch;

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const y = pad.t + (i / 8) * ch;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    }

    // Y labels
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = SUBTLE;
    ctx.textAlign = 'right';
    for (let i = 0; i <= 8; i++) {
      const v = yMin + (yMax - yMin) * (1 - i / 8);
      ctx.fillText(v.toFixed(0) + ' bp', pad.l - 6, pad.t + (i / 8) * ch + 3);
    }

    // X labels
    ctx.textAlign = 'center';
    const monthLabels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    for (let i = 0; i < months; i += 3) {
      ctx.fillText(monthLabels[i % 12], xPos(i), pad.t + ch + 16);
    }

    // IG area fill
    ctx.fillStyle = 'rgba(66,165,245,0.08)';
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(0));
    igBase.forEach((v, i) => ctx.lineTo(xPos(i), yPos(v)));
    ctx.lineTo(xPos(months - 1), yPos(0));
    ctx.fill();

    // HY area fill
    ctx.fillStyle = 'rgba(239,83,80,0.06)';
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(0));
    hyBase.forEach((v, i) => ctx.lineTo(xPos(i), yPos(v)));
    ctx.lineTo(xPos(months - 1), yPos(0));
    ctx.fill();

    // Lines
    const drawL = (data: number[], color: string, lw: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      data.forEach((v, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)); });
      ctx.stroke();
    };
    drawL(igBase, BLUE, 2);
    drawL(hyBase, RED, 2);

    // Legend
    ctx.font = `bold 9px ${MONO}`;
    ctx.fillStyle = BLUE; ctx.fillRect(pad.l + 10, pad.t + 6, 14, 2);
    ctx.fillText('IG OAS', pad.l + 28, pad.t + 11);
    ctx.fillStyle = RED; ctx.fillRect(pad.l + 85, pad.t + 6, 14, 2);
    ctx.fillText('HY OAS', pad.l + 103, pad.t + 11);

    // Title
    ctx.fillStyle = AMBER;
    ctx.font = `bold 10px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText('CREDIT SPREAD HISTORY (24M)', W - pad.r, pad.t + 11);
  }, []);

  useEffect(() => {
    if (tab === 'CREDIT SPREADS') { setTimeout(drawCreditSpreads, 50); }
  }, [tab, drawCreditSpreads]);

  useEffect(() => {
    const handleResize = () => { if (tab === 'CREDIT SPREADS') drawCreditSpreads(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tab, drawCreditSpreads]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, fontFamily: MONO, color: TEXT, overflow: 'hidden',
    }}>
      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, borderBottom: `1px solid ${BORDER}`,
        background: PANEL, flexShrink: 0, overflow: 'hidden',
      }}>
        <div style={{
          padding: '5px 12px', background: 'rgba(245,166,35,0.10)', borderRight: `1px solid ${BORDER}`,
          fontSize: 10, fontWeight: 800, color: AMBER, letterSpacing: '0.15em', whiteSpace: 'nowrap',
        }}>
          FIXED INCOME
        </div>
        {KPI_ITEMS.map((k, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px',
            borderRight: `1px solid ${BORDER}`, fontSize: 9, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: SUBTLE, letterSpacing: '0.08em' }}>{k.label}</span>
            <span style={{ color: TEXT, fontWeight: 700 }}>{k.value}</span>
            <span style={{ color: k.color, fontWeight: 600, fontSize: 8 }}>{k.chg}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '4px 12px', fontSize: 8, color: SUBTLE }}>
          {new Date().toLocaleTimeString()} UTC
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={tab === t ? {
              ...btnActive, borderBottom: `2px solid ${AMBER}`, padding: '6px 16px',
              fontSize: 10, fontWeight: 700,
            } : {
              ...btnBase, padding: '6px 16px', fontSize: 10,
              borderBottom: '2px solid transparent',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Content Area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══ YIELD CURVE TAB ═══ */}
        {tab === 'YIELD CURVE' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Inversion alerts */}
            {inversions.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px',
                background: 'rgba(239,83,80,0.08)', borderBottom: `1px solid ${BORDER}`,
                fontSize: 9, color: RED, fontWeight: 600,
              }}>
                <span style={{ fontSize: 11 }}>⚠</span>
                YIELD CURVE INVERSION: {inversions.join(', ')}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Chart */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ ...panelHdr }}>
                  <span>US TREASURY YIELD CURVE</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setShowPrev1m(p => !p)}
                      style={showPrev1m ? btnActive : btnBase}>1M AGO</button>
                    <button onClick={() => setShowPrev1y(p => !p)}
                      style={showPrev1y ? btnActive : btnBase}>1Y AGO</button>
                  </div>
                </div>
                <div style={{ flex: 1, padding: 4 }}>
                  <canvas ref={ycCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                </div>
              </div>

              {/* Key Rates Panel */}
              <div style={{ width: 320, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ ...panelHdr, borderTop: `2px solid ${BLUE}` }}>
                  <span>KEY RATES</span>
                  <span style={{ color: SUBTLE, fontWeight: 400 }}>{ycData.length} TENORS</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['TENOR', 'YIELD', 'CHG', 'SPREAD'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ycData.map((p, i) => {
                        const spread = i > 0 ? ((p.yield - ycData[i - 1].yield) * 100).toFixed(1) : '—';
                        const isInv = i > 0 && ycData[i - 1].yield > p.yield;
                        return (
                          <tr key={i} style={{ background: isInv ? 'rgba(239,83,80,0.06)' : 'transparent' }}>
                            <td style={{ ...cellStyle, fontWeight: 700, color: AMBER }}>{p.maturity}</td>
                            <td style={cellStyle}>{fmtYld(p.yield)}</td>
                            <td style={{ ...cellStyle, color: clr(p.change) }}>
                              {p.change > 0 ? '+' : ''}{(p.change * 100).toFixed(1)} bp
                            </td>
                            <td style={{ ...cellStyle, color: isInv ? RED : SUBTLE }}>
                              {typeof spread === 'string' ? spread : `${spread} bp`}
                              {isInv && <span style={{ color: RED, marginLeft: 4, fontSize: 8 }}>INV</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Curve stats */}
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: 8, fontSize: 9 }}>
                  {[
                    { label: '2s10s Spread', val: `${((ycData[8]?.yield ?? 0) - (ycData[4]?.yield ?? 0)) * 100 | 0} bp`, c: ((ycData[8]?.yield ?? 0) - (ycData[4]?.yield ?? 0)) < 0 ? RED : GREEN },
                    { label: '2s30s Spread', val: `${((ycData[10]?.yield ?? 0) - (ycData[4]?.yield ?? 0)) * 100 | 0} bp`, c: ((ycData[10]?.yield ?? 0) - (ycData[4]?.yield ?? 0)) < 0 ? RED : GREEN },
                    { label: '5s30s Spread', val: `${((ycData[10]?.yield ?? 0) - (ycData[6]?.yield ?? 0)) * 100 | 0} bp`, c: ((ycData[10]?.yield ?? 0) - (ycData[6]?.yield ?? 0)) < 0 ? RED : GREEN },
                    { label: '3m10y Spread', val: `${((ycData[8]?.yield ?? 0) - (ycData[1]?.yield ?? 0)) * 100 | 0} bp`, c: ((ycData[8]?.yield ?? 0) - (ycData[1]?.yield ?? 0)) < 0 ? RED : GREEN },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span style={{ color: SUBTLE }}>{s.label}</span>
                      <span style={{ color: s.c, fontWeight: 700 }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BOND SEARCH TAB ═══ */}
        {tab === 'BOND SEARCH' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Filters row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              background: PANEL, borderBottom: `1px solid ${BORDER}`, flexShrink: 0, flexWrap: 'wrap',
            }}>
              <input placeholder="Search CUSIP / Issuer..."
                value={bondSearch} onChange={e => setBondSearch(e.target.value)}
                style={{ ...inputStyle, width: 200 }} />

              <select value={bondTypeFilter} onChange={e => setBondTypeFilter(e.target.value)}
                style={{ ...inputStyle, width: 110, cursor: 'pointer' }}>
                <option value="All">All Types</option>
                <option value="Treasury">Treasury</option>
                <option value="Corporate">Corporate</option>
                <option value="Municipal">Municipal</option>
                <option value="Agency">Agency</option>
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: SUBTLE }}>
                <span>YLD</span>
                <input placeholder="Min" value={bondMinYield}
                  onChange={e => setBondMinYield(e.target.value)}
                  style={{ ...inputStyle, width: 50 }} />
                <span>—</span>
                <input placeholder="Max" value={bondMaxYield}
                  onChange={e => setBondMaxYield(e.target.value)}
                  style={{ ...inputStyle, width: 50 }} />
              </div>

              <select value={bondRatingFilter} onChange={e => setBondRatingFilter(e.target.value)}
                style={{ ...inputStyle, width: 90, cursor: 'pointer' }}>
                <option value="All">All Ratings</option>
                {['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 9, color: SUBTLE }}>{filteredBonds.length} BONDS</span>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {[
                      { key: 'cusip', label: 'CUSIP' },
                      { key: 'issuer', label: 'ISSUER' },
                      { key: 'type', label: 'TYPE' },
                      { key: 'coupon', label: 'CPN' },
                      { key: 'maturityDate', label: 'MATURITY' },
                      { key: 'yield', label: 'YTM' },
                      { key: 'price', label: 'PRICE' },
                      { key: 'ratingMoodys', label: "MOODY'S" },
                      { key: 'ratingSP', label: 'S&P' },
                      { key: 'duration', label: 'DUR' },
                      { key: 'spread', label: 'OAS' },
                    ].map(h => (
                      <th key={h.key} onClick={() => toggleSort(h.key)}
                        style={{ ...thStyle, cursor: 'pointer' }}>
                        {h.label}
                        {bondSort.col === h.key && (
                          <span style={{ marginLeft: 3 }}>{bondSort.asc ? '▲' : '▼'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBonds.map((b, i) => {
                    const typeColor = b.type === 'Treasury' ? AMBER : b.type === 'Corporate' ? BLUE
                      : b.type === 'Municipal' ? GREEN : PURPLE;
                    return (
                      <tr key={i} style={{
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      }}>
                        <td style={{ ...cellStyle, color: SUBTLE, fontSize: 9 }}>{b.cusip}</td>
                        <td style={{ ...cellStyle, fontWeight: 600 }}>{b.issuer}</td>
                        <td style={cellStyle}>
                          <span style={{
                            display: 'inline-block', padding: '1px 5px', fontSize: 8,
                            background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30`,
                            fontWeight: 600, letterSpacing: '0.05em',
                          }}>{b.type.toUpperCase()}</span>
                        </td>
                        <td style={cellStyle}>{b.coupon.toFixed(3)}%</td>
                        <td style={cellStyle}>{b.maturityDate}</td>
                        <td style={{ ...cellStyle, fontWeight: 700 }}>{b.yield.toFixed(3)}%</td>
                        <td style={cellStyle}>{b.price.toFixed(2)}</td>
                        <td style={cellStyle}>{b.ratingMoodys}</td>
                        <td style={cellStyle}>{b.ratingSP}</td>
                        <td style={cellStyle}>{b.duration.toFixed(1)}</td>
                        <td style={{ ...cellStyle, color: b.spread >= 200 ? RED : b.spread >= 80 ? ORANGE : b.spread < 0 ? GREEN : TEXT }}>
                          {b.spread} bp
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {tab === 'ANALYTICS' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: inputs + results */}
            <div style={{ width: 380, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <div style={{ ...panelHdr, borderTop: `2px solid ${PURPLE}` }}>
                <span>BOND CALCULATOR</span>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Coupon Rate (%)', val: calcCoupon, set: setCalcCoupon },
                  { label: 'Yield to Maturity (%)', val: calcYield, set: setCalcYield },
                  { label: 'Years to Maturity', val: calcMaturity, set: setCalcMaturity },
                  { label: 'Face Value ($)', val: calcFace, set: setCalcFace },
                  { label: 'Coupon Frequency', val: calcFreq, set: setCalcFreq },
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ width: 140, fontSize: 9, color: SUBTLE, letterSpacing: '0.05em' }}>
                      {f.label}
                    </label>
                    <input value={f.val} onChange={e => f.set(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }} />
                  </div>
                ))}
              </div>

              {analytics && (
                <>
                  {/* Key metrics */}
                  <div style={{ ...panelHdr, borderTop: `2px solid ${BLUE}` }}>
                    <span>BOND METRICS</span>
                  </div>
                  <div style={{ padding: 8 }}>
                    {[
                      { label: 'Clean Price', val: `$${analytics.price.toFixed(4)}`, c: TEXT },
                      { label: 'Macaulay Duration', val: `${analytics.macD.toFixed(4)} yrs`, c: BLUE },
                      { label: 'Modified Duration', val: analytics.modD.toFixed(4), c: BLUE },
                      { label: 'Convexity', val: analytics.conv.toFixed(4), c: PURPLE },
                      { label: 'DV01', val: `$${analytics.dv01.toFixed(4)}`, c: AMBER },
                      { label: 'Yield (%)', val: fmtYld(parseFloat(calcYield)), c: GREEN },
                    ].map((m, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '3px 4px',
                        borderBottom: `1px solid ${BORDER}`, fontSize: 10,
                      }}>
                        <span style={{ color: SUBTLE }}>{m.label}</span>
                        <span style={{ color: m.c, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Scenario Analysis */}
                  <div style={{ ...panelHdr, borderTop: `2px solid ${ORANGE}` }}>
                    <span>SCENARIO ANALYSIS</span>
                  </div>
                  <div style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 8, color: SUBTLE }}>PARALLEL SHIFT (bp)</label>
                        <input value={shiftBps} onChange={e => setShiftBps(e.target.value)}
                          style={{ ...inputStyle, marginTop: 2 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 8, color: SUBTLE }}>TWIST (bp)</label>
                        <input value={twistBps} onChange={e => setTwistBps(e.target.value)}
                          style={{ ...inputStyle, marginTop: 2 }} />
                      </div>
                    </div>
                    {[
                      { label: `+${shiftBps}bp Price`, val: `$${analytics.priceUp.toFixed(2)}`, chg: `${analytics.shiftPnL >= 0 ? '+' : ''}${analytics.shiftPnL.toFixed(2)}`, c: clr(analytics.shiftPnL) },
                      { label: `-${shiftBps}bp Price`, val: `$${analytics.priceDn.toFixed(2)}`, chg: `${analytics.shiftPnLDn >= 0 ? '+' : ''}${analytics.shiftPnLDn.toFixed(2)}`, c: clr(analytics.shiftPnLDn) },
                      { label: 'Twist (Short End)', val: `$${analytics.twistShort.toFixed(2)}`, chg: '', c: clr(analytics.twistShort) },
                      { label: 'Twist (Long End)', val: `$${analytics.twistLong.toFixed(2)}`, chg: '', c: clr(analytics.twistLong) },
                      { label: 'Butterfly Impact', val: `$${analytics.butterfly.toFixed(2)}`, chg: '', c: PURPLE },
                    ].map((s, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '3px 4px',
                        borderBottom: `1px solid ${BORDER}`, fontSize: 10,
                      }}>
                        <span style={{ color: SUBTLE }}>{s.label}</span>
                        <span>
                          <span style={{ color: s.c, fontWeight: 700 }}>{s.val}</span>
                          {s.chg && <span style={{ color: s.c, fontSize: 8, marginLeft: 4 }}>{s.chg}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right: cash flow table + key rate durations */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ ...panelHdr, borderTop: `2px solid ${GREEN}` }}>
                <span>CASH FLOW PRESENT VALUE BREAKDOWN</span>
                {analytics && <span style={{ color: SUBTLE, fontWeight: 400 }}>{analytics.cashFlows.length} periods shown</span>}
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {analytics ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['PERIOD', 'CASH FLOW', 'PV', 'CUMULATIVE PV', '% OF PRICE'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let cum = 0;
                        return analytics.cashFlows.map((cf, i) => {
                          cum += cf.pv;
                          const pct = (cf.pv / analytics.price) * 100;
                          return (
                            <tr key={i}>
                              <td style={{ ...cellStyle, color: AMBER }}>{cf.period}</td>
                              <td style={cellStyle}>${cf.cf.toFixed(2)}</td>
                              <td style={cellStyle}>${cf.pv.toFixed(4)}</td>
                              <td style={cellStyle}>${cum.toFixed(4)}</td>
                              <td style={cellStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <div style={{
                                    width: Math.max(2, pct * 2), height: 6,
                                    background: `linear-gradient(90deg, ${GREEN}, ${BLUE})`,
                                    borderRadius: 1,
                                  }} />
                                  <span>{pct.toFixed(2)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: SUBTLE, fontSize: 11 }}>
                    Enter valid bond parameters to see cash flow analysis
                  </div>
                )}
              </div>

              {/* Key Rate Duration */}
              {analytics && (
                <div style={{ borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
                  <div style={{ ...panelHdr, borderTop: `2px solid ${AMBER}` }}>
                    <span>KEY RATE DURATIONS (ESTIMATED)</span>
                  </div>
                  <div style={{ display: 'flex', padding: 6, gap: 1, flexWrap: 'wrap' }}>
                    {['1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'].map((tenor, i) => {
                      const krd = analytics.modD * (i === 5 ? 0.35 : i === 7 ? 0.22 : i === 4 ? 0.15 : i === 3 ? 0.12 : i === 6 ? 0.08 : 0.03);
                      return (
                        <div key={tenor} style={{
                          flex: 1, minWidth: 60, padding: '4px 6px', textAlign: 'center',
                          background: 'rgba(245,166,35,0.04)', border: `1px solid ${BORDER}`,
                        }}>
                          <div style={{ fontSize: 8, color: SUBTLE }}>{tenor}</div>
                          <div style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>{krd.toFixed(3)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ CREDIT SPREADS TAB ═══ */}
        {tab === 'CREDIT SPREADS' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Chart */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...panelHdr }}>
                  <span>IG vs HY OAS — 24 MONTH</span>
                </div>
                <div style={{ flex: 1, padding: 4, minHeight: 180 }}>
                  <canvas ref={csCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                </div>
              </div>

              {/* Spread table */}
              <div style={{ width: 420, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ ...panelHdr, borderTop: `2px solid ${RED}` }}>
                  <span>SPREAD BY RATING</span>
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['RATING', 'CURRENT', '52W LOW', '52W HIGH', 'Z-SCORE', 'PCTL'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SPREAD_DATA.map((s, i) => (
                        <tr key={i}>
                          <td style={{ ...cellStyle, fontWeight: 700, color: s.color }}>{s.rating}</td>
                          <td style={{ ...cellStyle, fontWeight: 700 }}>{s.current} bp</td>
                          <td style={{ ...cellStyle, color: GREEN }}>{s.w52Low}</td>
                          <td style={{ ...cellStyle, color: RED }}>{s.w52High}</td>
                          <td style={{ ...cellStyle, color: s.zScore > 1 ? RED : s.zScore < -1 ? GREEN : TEXT }}>
                            {s.zScore > 0 ? '+' : ''}{s.zScore.toFixed(1)}
                          </td>
                          <td style={cellStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{
                                width: 40, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${s.pctRank}%`, height: '100%',
                                  background: s.pctRank > 75 ? RED : s.pctRank > 50 ? ORANGE : s.pctRank > 25 ? AMBER : GREEN,
                                }} />
                              </div>
                              <span style={{ fontSize: 9 }}>{s.pctRank}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sector heatmap */}
            <div style={{ borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div style={{ ...panelHdr, borderTop: `2px solid ${ORANGE}` }}>
                <span>CORPORATE SPREAD HEATMAP BY SECTOR</span>
              </div>
              <div style={{ display: 'flex', padding: 4, gap: 2, overflowX: 'auto' }}>
                {SECTOR_SPREADS.map((s, i) => {
                  const igHeat = s.ig < 50 ? GREEN : s.ig < 80 ? AMBER : s.ig < 100 ? ORANGE : RED;
                  const hyHeat = s.hy < 320 ? GREEN : s.hy < 380 ? AMBER : s.hy < 420 ? ORANGE : RED;
                  return (
                    <div key={i} style={{
                      flex: 1, minWidth: 80, padding: '6px 4px', textAlign: 'center',
                      background: PANEL, border: `1px solid ${BORDER}`,
                    }}>
                      <div style={{ fontSize: 8, color: SUBTLE, marginBottom: 4, letterSpacing: '0.05em' }}>
                        {s.sector.toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 7, color: SUBTLE }}>IG</div>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: '#000',
                            background: igHeat, padding: '1px 4px', borderRadius: 1,
                          }}>{s.ig}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 7, color: SUBTLE }}>HY</div>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: '#000',
                            background: hyHeat, padding: '1px 4px', borderRadius: 1,
                          }}>{s.hy}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ RATES MONITOR TAB ═══ */}
        {tab === 'RATES MONITOR' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Global Government Yields */}
            <div style={panelStyle}>
              <div style={panelHdr}>
                <span>GLOBAL GOVERNMENT BOND YIELDS</span>
                <span style={{ color: SUBTLE, fontWeight: 400 }}>{GLOBAL_RATES.length} COUNTRIES</span>
              </div>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['COUNTRY', '2Y', '5Y', '10Y', '30Y', '10Y CHG'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {GLOBAL_RATES.map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...cellStyle, fontWeight: 600 }}>
                          <span style={{ marginRight: 6, fontSize: 12 }}>{
                            r.flag === 'US' ? '🇺🇸' : r.flag === 'GB' ? '🇬🇧' : r.flag === 'DE' ? '🇩🇪' :
                            r.flag === 'JP' ? '🇯🇵' : r.flag === 'AU' ? '🇦🇺' : r.flag === 'CA' ? '🇨🇦' :
                            r.flag === 'FR' ? '🇫🇷' : r.flag === 'IT' ? '🇮🇹' : r.flag === 'CH' ? '🇨🇭' : '🇨🇳'
                          }</span>
                          {r.country}
                        </td>
                        <td style={cellStyle}>{r.y2.toFixed(2)}%</td>
                        <td style={cellStyle}>{r.y5.toFixed(2)}%</td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: AMBER }}>{r.y10.toFixed(2)}%</td>
                        <td style={cellStyle}>{r.y30.toFixed(2)}%</td>
                        <td style={{ ...cellStyle, color: clr(r.chg10), fontWeight: 600 }}>
                          {r.chg10 > 0 ? '+' : ''}{(r.chg10 * 100).toFixed(1)} bp
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Central Bank + Money Market side by side */}
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Central Bank Rates */}
              <div style={{ ...panelStyle, flex: 1 }}>
                <div style={{ ...panelHdr, borderTop: `2px solid ${PURPLE}` }}>
                  <span>CENTRAL BANK RATES</span>
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['CENTRAL BANK', 'RATE', 'LAST MOVE', 'NEXT MEETING'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CB_RATES.map((cb, i) => (
                        <tr key={i}>
                          <td style={{ ...cellStyle, fontWeight: 600 }}>{cb.bank}</td>
                          <td style={{ ...cellStyle, fontWeight: 700, color: AMBER }}>{cb.rate.toFixed(2)}%</td>
                          <td style={{ ...cellStyle, fontSize: 9, color: cb.lastMove.includes('+') ? RED : cb.lastMove.includes('-') ? GREEN : SUBTLE }}>
                            {cb.lastMove}
                          </td>
                          <td style={{ ...cellStyle, color: SUBTLE }}>{cb.nextMeet}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Money Market Rates */}
              <div style={{ ...panelStyle, flex: 1 }}>
                <div style={{ ...panelHdr, borderTop: `2px solid ${GREEN}` }}>
                  <span>MONEY MARKET RATES</span>
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['INSTRUMENT', 'RATE', 'CHANGE'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MONEY_RATES.map((mr, i) => (
                        <tr key={i}>
                          <td style={{ ...cellStyle, fontWeight: 600 }}>{mr.name}</td>
                          <td style={{ ...cellStyle, fontWeight: 700, color: AMBER }}>{mr.rate.toFixed(2)}%</td>
                          <td style={{ ...cellStyle, color: clr(mr.change), fontWeight: 600 }}>
                            {mr.change > 0 ? '+' : ''}{(mr.change * 100).toFixed(1)} bp
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Swap Rates */}
            <div style={panelStyle}>
              <div style={{ ...panelHdr, borderTop: `2px solid ${BLUE}` }}>
                <span>INTEREST RATE SWAPS (USD)</span>
              </div>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['TENOR', 'SWAP RATE', 'SPREAD TO TSY', 'CHANGE'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SWAP_RATES.map((sw, i) => (
                      <tr key={i}>
                        <td style={{ ...cellStyle, fontWeight: 700, color: AMBER }}>{sw.tenor}</td>
                        <td style={{ ...cellStyle, fontWeight: 700 }}>{sw.rate.toFixed(3)}%</td>
                        <td style={{ ...cellStyle, color: sw.spread >= 0 ? TEXT : GREEN }}>
                          {sw.spread > 0 ? '+' : ''}{sw.spread} bp
                        </td>
                        <td style={{ ...cellStyle, color: clr(sw.change), fontWeight: 600 }}>
                          {sw.change > 0 ? '+' : ''}{(sw.change * 100).toFixed(1)} bp
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Status Bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 12px', borderTop: `1px solid ${BORDER}`,
        background: PANEL, fontSize: 8, color: SUBTLE, flexShrink: 0,
        letterSpacing: '0.08em',
      }}>
        <span>APEX FIXED INCOME v2.0 &bull; BLOOMBERG-GRADE ANALYTICS</span>
        <span>{MOCK_BONDS.length} BONDS &bull; {GLOBAL_RATES.length} COUNTRIES &bull; {SWAP_RATES.length} SWAP TENORS</span>
        <span>LAST UPDATE: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default FixedIncomeUI2;
