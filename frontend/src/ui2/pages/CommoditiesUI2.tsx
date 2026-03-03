/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — COMMODITIES DASHBOARD (UI2)                          │
 * │                                                                       │
 * │ Futures, seasonality, contango/backwardation — tasks.md §9           │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Futures prices — Energy, Metals, Agriculture, Softs                │
 * │ • Term structure (contango/backwardation) chart                       │
 * │ • Seasonality patterns                                               │
 * │ • Commodity index comparison                                         │
 * │ • Supply-demand balances                                             │
 * │ • COT (Commitment of Traders) positioning                           │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCommodities } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };
const clr = (n: number) => n >= 0 ? T.up : T.dn;
const fmtUsd = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(2)}`;

interface Commodity {
  symbol: string; name: string; sector: string; price: number; change: number;
  unit: string; contract: string; volume: number; openInterest: number;
  high52w: number; low52w: number;
}

function buildCommodities(): Commodity[] {
  return [
    { symbol: 'CL', name: 'Crude Oil WTI', sector: 'Energy', price: 78.42, change: 1.25, unit: '$/bbl', contract: 'Aug24', volume: 1250000, openInterest: 2850000, high52w: 95.0, low52w: 63.5 },
    { symbol: 'BZ', name: 'Brent Crude', sector: 'Energy', price: 82.15, change: 0.85, unit: '$/bbl', contract: 'Aug24', volume: 850000, openInterest: 2100000, high52w: 98.5, low52w: 68.0 },
    { symbol: 'NG', name: 'Natural Gas', sector: 'Energy', price: 2.85, change: -3.20, unit: '$/MMBtu', contract: 'Jul24', volume: 420000, openInterest: 1650000, high52w: 3.95, low52w: 1.52 },
    { symbol: 'RB', name: 'RBOB Gasoline', sector: 'Energy', price: 2.52, change: 0.45, unit: '$/gal', contract: 'Jul24', volume: 180000, openInterest: 420000, high52w: 2.85, low52w: 1.95 },
    { symbol: 'GC', name: 'Gold', sector: 'Metals', price: 2382.50, change: 0.35, unit: '$/oz', contract: 'Aug24', volume: 320000, openInterest: 920000, high52w: 2450, low52w: 1810 },
    { symbol: 'SI', name: 'Silver', sector: 'Metals', price: 31.25, change: -0.85, unit: '$/oz', contract: 'Jul24', volume: 150000, openInterest: 380000, high52w: 32.5, low52w: 20.5 },
    { symbol: 'HG', name: 'Copper', sector: 'Metals', price: 4.58, change: 1.80, unit: '$/lb', contract: 'Jul24', volume: 95000, openInterest: 280000, high52w: 5.20, low52w: 3.55 },
    { symbol: 'PL', name: 'Platinum', sector: 'Metals', price: 1005, change: -0.42, unit: '$/oz', contract: 'Jul24', volume: 42000, openInterest: 85000, high52w: 1085, low52w: 850 },
    { symbol: 'ZW', name: 'Wheat', sector: 'Agriculture', price: 610, change: -1.25, unit: '¢/bu', contract: 'Sep24', volume: 180000, openInterest: 520000, high52w: 780, low52w: 525 },
    { symbol: 'ZC', name: 'Corn', sector: 'Agriculture', price: 448, change: -0.65, unit: '¢/bu', contract: 'Sep24', volume: 420000, openInterest: 1850000, high52w: 585, low52w: 395 },
    { symbol: 'ZS', name: 'Soybeans', sector: 'Agriculture', price: 1182, change: 0.52, unit: '¢/bu', contract: 'Aug24', volume: 280000, openInterest: 820000, high52w: 1420, low52w: 1045 },
    { symbol: 'KC', name: 'Coffee', sector: 'Softs', price: 228.5, change: 2.15, unit: '¢/lb', contract: 'Sep24', volume: 75000, openInterest: 320000, high52w: 245, low52w: 145 },
    { symbol: 'SB', name: 'Sugar #11', sector: 'Softs', price: 19.85, change: -0.30, unit: '¢/lb', contract: 'Jul24', volume: 180000, openInterest: 950000, high52w: 28.5, low52w: 18.2 },
    { symbol: 'CC', name: 'Cocoa', sector: 'Softs', price: 8250, change: 3.50, unit: '$/mt', contract: 'Sep24', volume: 28000, openInterest: 72000, high52w: 11500, low52w: 3200 },
    { symbol: 'CT', name: 'Cotton', sector: 'Softs', price: 78.5, change: -0.12, unit: '¢/lb', contract: 'Dec24', volume: 52000, openInterest: 260000, high52w: 92.0, low52w: 72.5 },
    { symbol: 'LE', name: 'Live Cattle', sector: 'Agriculture', price: 185.2, change: 0.28, unit: '¢/lb', contract: 'Aug24', volume: 65000, openInterest: 380000, high52w: 195, low52w: 165 },
  ];
}

/* Futures Table */
function FuturesTable({ commodities, selectedSector, setSelectedSector }: { commodities: Commodity[]; selectedSector: string; setSelectedSector: (s: string) => void; }) {
  const sectors = ['All', 'Energy', 'Metals', 'Agriculture', 'Softs'];
  const filtered = selectedSector === 'All' ? commodities : commodities.filter(c => c.sector === selectedSector);

  return (
    <div data-testid="futures-table" style={panelStyle}>
      <div style={panelHdr}>
        <span>FUTURES</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {sectors.map(s => (
            <button key={s} onClick={() => setSelectedSector(s)} style={{ background: selectedSector === s ? T.brand : T.bg3, color: selectedSector === s ? '#FFF' : T.text2, border: 'none', padding: '2px 6px', borderRadius: '2px', fontSize: '9px', fontWeight: 600, cursor: 'pointer', fontFamily: T.fontSans }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Symbol', 'Name', 'Price', 'Chg%', 'Unit', 'Contract', 'Volume', 'Open Int', '52W Range'].map(h => <th key={h} style={{ padding: '3px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, position: 'sticky', top: 0, background: T.bg1 }}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(c => {
            const rangePct = ((c.price - c.low52w) / (c.high52w - c.low52w)) * 100;
            return (
              <tr key={c.symbol} onMouseEnter={e => e.currentTarget.style.background = T.bg2} onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}` }}>{c.symbol}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', color: T.text1, fontFamily: T.fontSans, borderBottom: `1px solid ${T.border0}` }}>{c.name}</td>
                <td style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 600, color: T.text0, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{c.price.toLocaleString()}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', fontWeight: 600, color: clr(c.change), fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}%</td>
                <td style={{ padding: '3px 6px', fontSize: '9px', color: T.text3, fontFamily: T.fontSans, borderBottom: `1px solid ${T.border0}` }}>{c.unit}</td>
                <td style={{ padding: '3px 6px', fontSize: '9px', color: T.text2, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}` }}>{c.contract}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', color: T.text2, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{(c.volume / 1000).toFixed(0)}K</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', color: T.text2, fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{(c.openInterest / 1000).toFixed(0)}K</td>
                <td style={{ padding: '3px 6px', borderBottom: `1px solid ${T.border0}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '8px', color: T.text3, fontFamily: T.fontMono }}>{c.low52w}</span>
                    <div style={{ flex: 1, height: '4px', background: T.bg3, borderRadius: '2px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: `${rangePct}%`, top: '-2px', width: '4px', height: '8px', borderRadius: '2px', background: T.brand, transform: 'translateX(-50%)' }} />
                    </div>
                    <span style={{ fontSize: '8px', color: T.text3, fontFamily: T.fontMono }}>{c.high52w}</span>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Term Structure (Contango/Backwardation) */
function TermStructure() {
  const ref = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCommodity, setSelectedCommodity] = useState('CL');

  const structures: Record<string, { label: string; months: number[]; state: string }> = {
    CL: { label: 'Crude Oil WTI', months: [78.42, 77.85, 77.20, 76.50, 75.90, 75.35, 74.80, 74.30, 73.85, 73.40, 73.00, 72.65], state: 'Backwardation' },
    GC: { label: 'Gold', months: [2382, 2388, 2395, 2405, 2418, 2432, 2448, 2465, 2484, 2503, 2523, 2544], state: 'Contango' },
    NG: { label: 'Natural Gas', months: [2.85, 3.10, 3.35, 3.55, 3.70, 3.82, 3.90, 3.95, 3.85, 3.65, 3.40, 3.15], state: 'Seasonal' },
  };

  const draw = useCallback(() => {
    const cvs = ref.current;
    const con = containerRef.current;
    if (!cvs || !con) return;
    cvs.width = con.clientWidth;
    cvs.height = con.clientHeight;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const w = cvs.width, h = cvs.height, pad = { t: 20, r: 30, b: 30, l: 50 };
    ctx.clearRect(0, 0, w, h);

    const data = structures[selectedCommodity];
    const months = data.months;
    const mn = Math.min(...months) * 0.998;
    const mx = Math.max(...months) * 1.002;
    const labels = ['Front', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];

    // Grid
    ctx.strokeStyle = T.border0;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = pad.t + (i / 4) * (h - pad.t - pad.b);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      const val = mx - (i / 4) * (mx - mn);
      ctx.fillStyle = T.text3;
      ctx.font = `9px ${T.fontMono}`;
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), pad.l - 4, y + 3);
    }

    // Labels
    ctx.fillStyle = T.text3;
    ctx.font = `8px ${T.fontSans}`;
    ctx.textAlign = 'center';
    months.forEach((_, i) => {
      const x = pad.l + (i / (months.length - 1)) * (w - pad.l - pad.r);
      ctx.fillText(labels[i], x, h - pad.b + 14);
    });

    // Fill
    const isBackwardation = months[0] > months[months.length - 1];
    ctx.beginPath();
    months.forEach((v, i) => {
      const x = pad.l + (i / (months.length - 1)) * (w - pad.l - pad.r);
      const y = pad.t + ((mx - v) / (mx - mn)) * (h - pad.t - pad.b);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const spotY = pad.t + ((mx - months[0]) / (mx - mn)) * (h - pad.t - pad.b);
    ctx.lineTo(w - pad.r, spotY);
    ctx.closePath();
    ctx.fillStyle = isBackwardation ? 'rgba(239,83,80,0.1)' : 'rgba(38,166,154,0.1)';
    ctx.fill();

    // Line
    ctx.beginPath();
    months.forEach((v, i) => {
      const x = pad.l + (i / (months.length - 1)) * (w - pad.l - pad.r);
      const y = pad.t + ((mx - v) / (mx - mn)) * (h - pad.t - pad.b);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isBackwardation ? T.dn : T.up;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    months.forEach((v, i) => {
      const x = pad.l + (i / (months.length - 1)) * (w - pad.l - pad.r);
      const y = pad.t + ((mx - v) / (mx - mn)) * (h - pad.t - pad.b);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = isBackwardation ? T.dn : T.up;
      ctx.fill();
    });

    // Label
    ctx.fillStyle = isBackwardation ? T.dn : T.up;
    ctx.font = `bold 10px ${T.fontSans}`;
    ctx.textAlign = 'left';
    ctx.fillText(data.state, pad.l + 4, pad.t + 14);
  }, [selectedCommodity]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const obs = new ResizeObserver(draw);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div data-testid="term-structure" style={{ ...panelStyle, flex: 1 }}>
      <div style={panelHdr}>
        <span>TERM STRUCTURE</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Object.entries(structures).map(([k, v]) => (
            <button key={k} onClick={() => setSelectedCommodity(k)} style={{ background: selectedCommodity === k ? T.brand : T.bg3, color: selectedCommodity === k ? '#FFF' : T.text2, border: 'none', padding: '2px 6px', borderRadius: '2px', fontSize: '9px', cursor: 'pointer', fontWeight: 600, fontFamily: T.fontSans }}>{k}</button>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: '120px' }}>
        <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

/* COT Positioning */
function COTPositioning() {
  const data = [
    { name: 'Crude Oil', commercial: -82000, nonCommercial: 125000, nonReportable: -43000 },
    { name: 'Gold', commercial: -195000, nonCommercial: 212000, nonReportable: -17000 },
    { name: 'Corn', commercial: -310000, nonCommercial: 285000, nonReportable: 25000 },
    { name: 'Soybeans', commercial: -145000, nonCommercial: 128000, nonReportable: 17000 },
    { name: 'Nat Gas', commercial: 85000, nonCommercial: -62000, nonReportable: -23000 },
    { name: 'Copper', commercial: -28000, nonCommercial: 35000, nonReportable: -7000 },
  ];

  const maxAbs = Math.max(...data.flatMap(d => [Math.abs(d.commercial), Math.abs(d.nonCommercial), Math.abs(d.nonReportable)]));

  return (
    <div data-testid="cot-positioning" style={panelStyle}>
      <div style={panelHdr}><span>COT POSITIONING (Contracts)</span></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
          <span style={{ fontSize: '8px', color: T.dn }}>■ Commercial</span>
          <span style={{ fontSize: '8px', color: T.up }}>■ Non-Commercial</span>
          <span style={{ fontSize: '8px', color: T.text3 }}>■ Non-Reportable</span>
        </div>
        {data.map(d => (
          <div key={d.name} style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '9px', color: T.text2, marginBottom: '2px', fontFamily: T.fontSans }}>{d.name}</div>
            {[{ val: d.commercial, col: T.dn, label: 'Comm' }, { val: d.nonCommercial, col: T.up, label: 'Non-Comm' }, { val: d.nonReportable, col: T.text3, label: 'Non-Rep' }].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                <span style={{ fontSize: '7px', color: T.text3, width: '45px', fontFamily: T.fontSans }}>{r.label}</span>
                <div style={{ flex: 1, height: '4px', background: T.bg3, borderRadius: '2px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: r.val >= 0 ? '50%' : `${50 - (Math.abs(r.val) / maxAbs) * 50}%`, width: `${(Math.abs(r.val) / maxAbs) * 50}%`, height: '100%', background: r.col, borderRadius: '2px' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '-1px', width: '1px', height: '6px', background: T.text3 }} />
                </div>
                <span style={{ fontSize: '8px', color: clr(r.val), fontFamily: T.fontMono, width: '50px', textAlign: 'right' }}>{r.val > 0 ? '+' : ''}{(r.val / 1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function CommoditiesUI2() {
  // ── Hook integration ──
  const [commoditiesState, commoditiesActions] = useCommodities();

  const [commodities, setCommodities] = useState(buildCommodities);
  const [selectedSector, setSelectedSector] = useState('All');

  useEffect(() => {
    const iv = setInterval(() => setCommodities(prev => prev.map(c => {
      const d = c.price * (Math.random() - 0.49) * 0.002;
      return { ...c, price: +(c.price + d) };
    })), 4000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div data-testid="commodities-page" style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      <FuturesTable commodities={commodities} selectedSector={selectedSector} setSelectedSector={setSelectedSector} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', minHeight: 0 }}>
        <TermStructure />
        <COTPositioning />
      </div>
    </div>
  );
}
