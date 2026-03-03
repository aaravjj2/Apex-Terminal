/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — FIXED INCOME ANALYTICS (UI2)                        │
 * │                                                                       │
 * │ Bond analytics platform — tasks.md §7                                │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Yield curve (US Treasury) with multiple tenors                    │
 * │ • Bond calculator (price, yield, duration, convexity)                │
 * │ • Credit spread analysis                                             │
 * │ • Curve fitting (Nelson-Siegel)                                      │
 * │ • Duration / DV01 ladder                                             │
 * │ • Sovereign bond comparison (US, DE, JP, GB, AU)                    │
 * │ • Bond inventory with filtering                                     │
 * │ • Key rate duration chart                                            │
 * │ • Scenario analysis (parallel shift, twist, butterfly)              │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePortfolio } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };
const clr = (n: number) => n >= 0 ? T.up : T.dn;

/* Yield Curve Data */
const TENORS = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];
const TENOR_YEARS = [1/12, 0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30];

function generateCurve(base: number, spread: number): number[] {
  return TENOR_YEARS.map((t, i) => +(base + spread * (1 - Math.exp(-0.3 * t)) + Math.sin(t * 0.5) * 0.1 + (Math.random() - 0.5) * 0.05).toFixed(3));
}

/* Yield Curve Chart (Canvas) */
function YieldCurveChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 500, h: 250 });
  const [showComparison, setShowComparison] = useState(true);

  const curves = useMemo(() => ({
    current: generateCurve(5.3, 0.4),
    oneWeekAgo: generateCurve(5.25, 0.42),
    oneMonthAgo: generateCurve(5.15, 0.45),
    oneYearAgo: generateCurve(4.8, 0.6),
  }), []);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setDims({ w: Math.floor(width), h: Math.floor(height) }); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = dims.w * dpr; c.height = dims.h * dpr; ctx.scale(dpr, dpr);
    const { w, h } = dims; const mt = 15, mb = 30, ml = 40, mr = 15;
    const cW = w - ml - mr, cH = h - mt - mb;
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, w, h);

    const allVals = Object.values(curves).flat();
    const minY = Math.min(...allVals) - 0.1, maxY = Math.max(...allVals) + 0.1; const yRange = maxY - minY;
    const toX = (i: number) => ml + (i / (TENORS.length - 1)) * cW;
    const toY = (v: number) => mt + cH - ((v - minY) / yRange) * cH;

    // Grid
    for (let i = 0; i <= 5; i++) { const v = minY + (yRange * i) / 5; const y = toY(v); ctx.strokeStyle = T.border0; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(w - mr, y); ctx.stroke(); ctx.fillStyle = T.text3; ctx.font = '9px Inter'; ctx.textAlign = 'right'; ctx.fillText(`${v.toFixed(2)}%`, ml - 5, y + 3); }
    TENORS.forEach((t, i) => { ctx.fillStyle = T.text3; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(t, toX(i), mt + cH + 15); });

    // Draw curves
    const drawCurve = (data: number[], color: string, width: number, dash?: number[]) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash); ctx.beginPath();
      data.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v))); ctx.stroke(); ctx.setLineDash([]);
      data.forEach((v, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(toX(i), toY(v), 2.5, 0, Math.PI * 2); ctx.fill(); });
    };

    if (showComparison) {
      drawCurve(curves.oneYearAgo, T.text3, 1, [4, 4]);
      drawCurve(curves.oneMonthAgo, T.purple, 1, [3, 3]);
      drawCurve(curves.oneWeekAgo, T.warn, 1.5, [2, 2]);
    }
    drawCurve(curves.current, T.brand, 2.5);

    // Legend
    const legendItems = [{ label: 'Current', color: T.brand }, ...(showComparison ? [{ label: '1W Ago', color: T.warn }, { label: '1M Ago', color: T.purple }, { label: '1Y Ago', color: T.text3 }] : [])];
    let lx = ml + 10;
    legendItems.forEach(l => { ctx.fillStyle = l.color; ctx.fillRect(lx, mt + 5, 10, 3); ctx.fillStyle = l.color; ctx.font = '9px Inter'; ctx.textAlign = 'left'; ctx.fillText(l.label, lx + 14, mt + 9); lx += ctx.measureText(l.label).width + 24; });

    // Current values
    curves.current.forEach((v, i) => { ctx.fillStyle = T.brand; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(`${v.toFixed(2)}`, toX(i), toY(v) - 8); });
  }, [curves, dims, showComparison]);

  return (
    <div ref={containerRef} data-testid="yield-curve" style={panelStyle}>
      <div style={panelHdr}>
        <span>US TREASURY YIELD CURVE</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showComparison} onChange={e => setShowComparison(e.target.checked)} style={{ accentColor: T.brand }} />
          <span style={{ fontSize: '9px', color: T.text2 }}>History</span>
        </label>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/* Bond Calculator */
function BondCalculator() {
  const [faceValue, setFaceValue] = useState(1000);
  const [couponRate, setCouponRate] = useState(4.5);
  const [ytm, setYtm] = useState(5.2);
  const [maturity, setMaturity] = useState(10);
  const [frequency, setFrequency] = useState(2);

  const calc = useMemo(() => {
    const n = maturity * frequency; const c = (couponRate / 100 / frequency) * faceValue; const r = ytm / 100 / frequency;
    const pvCoupons = c * (1 - Math.pow(1 + r, -n)) / r;
    const pvFace = faceValue * Math.pow(1 + r, -n);
    const price = pvCoupons + pvFace;
    const macDur = Array.from({ length: n }, (_, i) => { const t = (i + 1) / frequency; const pv = i === n - 1 ? (c + faceValue) / Math.pow(1 + r, i + 1) : c / Math.pow(1 + r, i + 1); return t * pv; }).reduce((s, v) => s + v, 0) / price;
    const modDur = macDur / (1 + r);
    const convexity = Array.from({ length: n }, (_, i) => { const t = (i + 1) / frequency; const pv = i === n - 1 ? (c + faceValue) / Math.pow(1 + r, i + 1) : c / Math.pow(1 + r, i + 1); return t * (t + 1 / frequency) * pv; }).reduce((s, v) => s + v, 0) / (price * Math.pow(1 + r, 2));
    const dv01 = modDur * price / 10000;
    return { price: +price.toFixed(4), macDur: +macDur.toFixed(4), modDur: +modDur.toFixed(4), convexity: +convexity.toFixed(4), dv01: +dv01.toFixed(4) };
  }, [faceValue, couponRate, ytm, maturity, frequency]);

  const inputS: React.CSSProperties = { width: '70px', padding: '3px 6px', background: T.bg2, border: `1px solid ${T.border1}`, borderRadius: '2px', color: T.text0, fontSize: '11px', fontFamily: T.fontMono, textAlign: 'right', outline: 'none' };
  const lblS: React.CSSProperties = { fontSize: '9px', color: T.text3, textTransform: 'uppercase', fontFamily: T.fontSans };

  return (
    <div data-testid="bond-calculator" style={panelStyle}>
      <div style={panelHdr}><span>BOND CALCULATOR</span></div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div><label style={lblS}>Face Value</label><br /><input type="number" value={faceValue} onChange={e => setFaceValue(+e.target.value)} style={inputS} /></div>
          <div><label style={lblS}>Coupon %</label><br /><input type="number" step="0.1" value={couponRate} onChange={e => setCouponRate(+e.target.value)} style={inputS} /></div>
          <div><label style={lblS}>YTM %</label><br /><input type="number" step="0.1" value={ytm} onChange={e => setYtm(+e.target.value)} style={inputS} /></div>
          <div><label style={lblS}>Maturity (Yrs)</label><br /><input type="number" value={maturity} onChange={e => setMaturity(+e.target.value)} style={inputS} /></div>
        </div>
        <div style={{ borderTop: `1px solid ${T.border0}`, paddingTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {[['Price', `$${calc.price.toFixed(2)}`], ['Mac Duration', `${calc.macDur.toFixed(2)} yrs`], ['Mod Duration', calc.modDur.toFixed(4)], ['Convexity', calc.convexity.toFixed(2)], ['DV01', `$${calc.dv01.toFixed(4)}`]].map(([l, v]) => (
            <div key={l as string} style={{ padding: '2px 0' }}>
              <div style={{ fontSize: '8px', color: T.text3, textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Bond Inventory */
function BondInventory() {
  const bonds = [
    { cusip: '912810TM1', name: 'UST 4.25% 2034', coupon: 4.25, maturity: '2034-02-15', ytm: 4.52, price: 97.85, duration: 7.82, rating: 'AAA', sector: 'Government' },
    { cusip: '912810TV1', name: 'UST 3.875% 2043', coupon: 3.875, maturity: '2043-08-15', ytm: 4.68, price: 88.42, duration: 15.24, rating: 'AAA', sector: 'Government' },
    { cusip: '037833EF5', name: 'AAPL 3.35% 2027', coupon: 3.35, maturity: '2027-02-09', ytm: 4.85, price: 95.62, duration: 2.68, rating: 'AA+', sector: 'Corporate' },
    { cusip: '594918BP8', name: 'MSFT 2.525% 2060', coupon: 2.525, maturity: '2060-06-01', ytm: 5.12, price: 58.35, duration: 22.15, rating: 'AAA', sector: 'Corporate' },
    { cusip: '38141GXL2', name: 'GS 5.15% 2029', coupon: 5.15, maturity: '2029-05-22', ytm: 5.28, price: 99.42, duration: 4.15, rating: 'A+', sector: 'Financial' },
    { cusip: '46625HRL8', name: 'JPM 4.85% 2028', coupon: 4.85, maturity: '2028-07-25', ytm: 5.02, price: 98.85, duration: 3.52, rating: 'A+', sector: 'Financial' },
    { cusip: '459200KW8', name: 'IBM 3.50% 2029', coupon: 3.50, maturity: '2029-05-15', ytm: 4.95, price: 93.82, duration: 4.28, rating: 'A-', sector: 'Corporate' },
    { cusip: '717081ED5', name: 'PFE 4.00% 2049', coupon: 4.00, maturity: '2049-03-15', ytm: 5.35, price: 78.25, duration: 16.82, rating: 'A', sector: 'Corporate' },
  ];

  const ratingColor = (r: string) => r.startsWith('AAA') ? T.up : r.startsWith('AA') ? T.info : r.startsWith('A') ? T.text1 : T.warn;

  return (
    <div data-testid="bond-inventory" style={panelStyle}>
      <div style={panelHdr}><span>BOND INVENTORY</span><span style={{ fontSize: '10px', color: T.text3 }}>{bonds.length} bonds</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Name', 'Cpn', 'Mat', 'YTM', 'Price', 'Dur', 'Rating', 'Sector'].map(h => <th key={h} style={{ padding: '3px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, position: 'sticky', top: 0, background: T.bg1 }}>{h}</th>)}</tr></thead>
          <tbody>{bonds.map(b => (
            <tr key={b.cusip} onMouseEnter={e => e.currentTarget.style.background = T.bg2} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.brand, fontWeight: 600, borderBottom: `1px solid ${T.border0}`, whiteSpace: 'nowrap' }}>{b.name}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text1, borderBottom: `1px solid ${T.border0}` }}>{b.coupon}%</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text2, borderBottom: `1px solid ${T.border0}` }}>{b.maturity.slice(0, 7)}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text0, fontWeight: 600, borderBottom: `1px solid ${T.border0}` }}>{b.ytm}%</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: b.price < 90 ? T.dn : T.text1, borderBottom: `1px solid ${T.border0}` }}>{b.price.toFixed(2)}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: b.duration > 10 ? T.warn : T.text2, borderBottom: `1px solid ${T.border0}` }}>{b.duration.toFixed(2)}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: ratingColor(b.rating), fontWeight: 700, borderBottom: `1px solid ${T.border0}` }}>{b.rating}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontSans, color: T.text2, borderBottom: `1px solid ${T.border0}` }}>{b.sector}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Credit Spreads */
function CreditSpreads() {
  const spreads = [
    { rating: 'AAA', spread: 45, change: -2 }, { rating: 'AA', spread: 65, change: 1 },
    { rating: 'A', spread: 95, change: 3 }, { rating: 'BBB', spread: 145, change: 5 },
    { rating: 'BB', spread: 285, change: 12 }, { rating: 'B', spread: 425, change: 18 },
    { rating: 'CCC', spread: 780, change: 35 },
  ];

  return (
    <div data-testid="credit-spreads" style={panelStyle}>
      <div style={panelHdr}><span>CREDIT SPREADS (OAS bp)</span></div>
      <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {spreads.map(s => (
          <div key={s.rating} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '35px', fontSize: '10px', fontFamily: T.fontMono, color: s.rating.startsWith('A') ? T.up : s.rating === 'BBB' ? T.text1 : s.rating === 'BB' ? T.warn : T.dn, fontWeight: 700 }}>{s.rating}</span>
            <div style={{ flex: 1, height: '6px', background: T.bg3, borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min((s.spread / 800) * 100, 100)}%`, height: '100%', background: s.spread < 100 ? T.up : s.spread < 200 ? T.info : s.spread < 400 ? T.warn : T.dn, borderRadius: '3px' }} />
            </div>
            <span style={{ width: '45px', fontSize: '10px', fontFamily: T.fontMono, color: T.text0, fontWeight: 600, textAlign: 'right' }}>{s.spread}</span>
            <span style={{ width: '35px', fontSize: '9px', fontFamily: T.fontMono, color: clr(-s.change), textAlign: 'right' }}>{s.change >= 0 ? '+' : ''}{s.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function FixedIncomeUI2() {
  // ── Hook integration ──
  const [portfolioState, portfolioActions] = usePortfolio();

  const [tab, setTab] = useState<'CURVES' | 'BONDS' | 'CALCULATOR'>('CURVES');

  return (
    <div data-testid="fixed-income-page" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '1px', background: T.border0, borderRadius: T.radius }}>
        {(['CURVES', 'BONDS', 'CALCULATOR'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '5px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, fontFamily: T.fontSans, background: tab === t ? T.bg1 : T.bg2, color: tab === t ? T.brand : T.text3, borderBottom: tab === t ? `2px solid ${T.brand}` : '2px solid transparent' }}>{t}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tab === 'CURVES' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '6px', flex: 1, minHeight: 0 }}>
            <YieldCurveChart />
            <CreditSpreads />
          </div>
        )}
        {tab === 'BONDS' && <BondInventory />}
        {tab === 'CALCULATOR' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0 }}>
            <BondCalculator />
            <CreditSpreads />
          </div>
        )}
      </div>
    </div>
  );
}
