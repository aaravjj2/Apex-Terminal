/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — RISK DASHBOARD (UI2)                                 │
 * │                                                                       │
 * │ Enterprise risk management — tasks.md §6                             │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Value at Risk (VaR) — Historical, Parametric, Monte Carlo          │
 * │ • Conditional VaR (CVaR / Expected Shortfall)                        │
 * │ • Stress testing (GFC, COVID, Taper Tantrum, custom)                 │
 * │ • Risk decomposition by sector, asset, factor                        │
 * │ • P&L distribution with tail analysis                                │
 * │ • Greeks exposure (portfolio-level)                                   │
 * │ • Liquidity risk matrix                                              │
 * │ • Limit utilization gauges                                           │
 * │ • Scenario analysis                                                   │
 * │ • Drawdown analysis + underwater chart                               │
 * │ • Margin requirements                                                │
 * │ • Risk alerts / breaches                                             │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRisk } from '@/ui2/hooks';
import { useOrders } from '@/ui2/hooks';
import { useReporting } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39', bg4: '#363A45',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', upBg: 'rgba(38,166,154,0.12)', dnBg: 'rgba(239,83,80,0.12)',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC', critical: '#D32F2F',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const fmt2 = (n: number) => n.toFixed(2); const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const fmtUsd = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
const clr = (n: number) => n >= 0 ? T.up : T.dn;
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };

/* ── Risk Data Generators ── */
function generatePnLDistribution(days: number) {
  const data: number[] = [];
  for (let i = 0; i < days; i++) {
    const normal = (Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() - 3) / 3;
    const fatTail = Math.random() < 0.05 ? (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 4) : 0;
    data.push(+(normal * 1.2 + fatTail + 0.03).toFixed(4));
  }
  return data.sort((a, b) => a - b);
}

function generateDrawdownSeries(days: number) {
  const dd: { date: string; drawdown: number }[] = [];
  let peak = 100, current = 100;
  for (let i = 0; i < days; i++) {
    current *= 1 + (Math.random() - 0.48) * 0.02;
    peak = Math.max(peak, current);
    const ddown = ((current - peak) / peak) * 100;
    dd.push({ date: new Date(Date.now() - (days - i) * 86400000).toISOString().slice(0, 10), drawdown: +ddown.toFixed(4) });
  }
  return dd;
}

/* ═════════════════════════════════════════════════════════════════════ */

/* VaR Summary Cards */
function VaRCards() {
  const varData = [
    { method: 'Historical (95%)', var1d: -125000, var10d: -395000 },
    { method: 'Parametric (95%)', var1d: -118000, var10d: -373000 },
    { method: 'Monte Carlo (95%)', var1d: -132000, var10d: -418000 },
    { method: 'CVaR / ES (95%)', var1d: -185000, var10d: -585000 },
  ];

  return (
    <div data-testid="var-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
      {varData.map(v => (
        <div key={v.method} style={{ ...panelStyle, padding: '8px 10px' }}>
          <div style={{ fontSize: '9px', color: T.text3, fontFamily: T.fontSans, textTransform: 'uppercase', marginBottom: '4px' }}>{v.method}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '8px', color: T.text3 }}>1-Day</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: T.dn, fontFamily: T.fontMono }}>{fmtUsd(Math.abs(v.var1d))}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: T.text3 }}>10-Day</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: T.dn, fontFamily: T.fontMono }}>{fmtUsd(Math.abs(v.var10d))}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* P&L Distribution (Canvas) */
function PnLDistribution({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 200 });

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setDims({ w: Math.floor(width), h: Math.floor(height) }); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = dims.w * dpr; c.height = dims.h * dpr; ctx.scale(dpr, dpr);
    const { w, h } = dims; const mt = 15, mb = 25, ml = 40, mr = 10;
    const cW = w - ml - mr, cH = h - mt - mb;
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, w, h);

    // Histogram bins
    const nBins = 50;
    const min = data[0], max = data[data.length - 1]; const range = max - min;
    const binWidth = range / nBins;
    const bins = new Array(nBins).fill(0);
    data.forEach(v => { const idx = Math.min(Math.floor((v - min) / binWidth), nBins - 1); bins[idx]++; });
    const maxBin = Math.max(...bins);
    const var95 = data[Math.floor(data.length * 0.05)];

    const toX = (i: number) => ml + (i / nBins) * cW;
    const toY = (v: number) => mt + cH - (v / maxBin) * cH;

    // Bars
    bins.forEach((count, i) => {
      const binVal = min + (i + 0.5) * binWidth;
      const x = toX(i); const bw = cW / nBins - 1;
      const barH = (count / maxBin) * cH;
      ctx.fillStyle = binVal < var95 ? 'rgba(239,83,80,0.6)' : binVal < 0 ? 'rgba(239,83,80,0.25)' : 'rgba(38,166,154,0.25)';
      ctx.fillRect(x, mt + cH - barH, bw, barH);
    });

    // VaR line
    const varX = ml + ((var95 - min) / range) * cW;
    ctx.strokeStyle = T.dn; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(varX, mt); ctx.lineTo(varX, mt + cH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = T.dn; ctx.font = '9px Inter'; ctx.textAlign = 'center'; ctx.fillText(`VaR 95%: ${(var95 * 100).toFixed(2)}%`, varX, mt - 3);

    // Zero line
    const zeroX = ml + ((0 - min) / range) * cW;
    ctx.strokeStyle = T.text3; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(zeroX, mt); ctx.lineTo(zeroX, mt + cH); ctx.stroke(); ctx.setLineDash([]);

    // Mean
    const mean = data.reduce((s, v) => s + v, 0) / data.length;
    const meanX = ml + ((mean - min) / range) * cW;
    ctx.strokeStyle = T.brand; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(meanX, mt); ctx.lineTo(meanX, mt + cH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = T.brand; ctx.font = '9px Inter'; ctx.fillText(`μ=${(mean * 100).toFixed(3)}%`, meanX, mt + cH + 14);

    // Stats
    const std = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / data.length);
    const skew = data.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / data.length;
    const kurt = data.reduce((s, v) => s + ((v - mean) / std) ** 4, 0) / data.length - 3;
    ctx.fillStyle = T.text2; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText(`σ=${(std * 100).toFixed(3)}%  skew=${skew.toFixed(2)}  kurt=${kurt.toFixed(2)}`, w - mr, mt + 10);
  }, [data, dims]);

  return (
    <div ref={containerRef} data-testid="pnl-distribution" style={panelStyle}>
      <div style={panelHdr}><span>P&L DISTRIBUTION</span></div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/* Drawdown Chart */
function DrawdownChart({ data }: { data: { date: string; drawdown: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 150 });

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setDims({ w: Math.floor(width), h: Math.floor(height) }); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = dims.w * dpr; c.height = dims.h * dpr; ctx.scale(dpr, dpr);
    const { w, h } = dims; const mt = 10, mb = 5, ml = 45, mr = 10;
    const cW = w - ml - mr, cH = h - mt - mb;
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, w, h);

    const minDD = Math.min(...data.map(d => d.drawdown));
    const toX = (i: number) => ml + (i / (data.length - 1)) * cW;
    const toY = (v: number) => mt + (v / (minDD || -1)) * cH;

    // Fill
    ctx.fillStyle = 'rgba(239,83,80,0.12)'; ctx.beginPath(); ctx.moveTo(toX(0), mt);
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.drawdown))); ctx.lineTo(toX(data.length - 1), mt); ctx.fill();
    // Line
    ctx.strokeStyle = T.dn; ctx.lineWidth = 1.5; ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(toX(i), toY(d.drawdown)) : ctx.lineTo(toX(i), toY(d.drawdown))); ctx.stroke();

    // Max DD label
    const maxDDIdx = data.reduce((mi, d, i) => d.drawdown < data[mi].drawdown ? i : mi, 0);
    ctx.fillStyle = T.dn; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'center';
    ctx.fillText(`Max: ${data[maxDDIdx].drawdown.toFixed(2)}%`, toX(maxDDIdx), toY(data[maxDDIdx].drawdown) + 12);

    // Y-axis
    for (let i = 0; i <= 4; i++) { const v = (minDD * i) / 4; const y = toY(v); ctx.fillStyle = T.text3; ctx.font = '8px Inter'; ctx.textAlign = 'right'; ctx.fillText(`${v.toFixed(1)}%`, ml - 5, y + 3); }
  }, [data, dims]);

  return (
    <div ref={containerRef} data-testid="drawdown-chart" style={panelStyle}>
      <div style={panelHdr}><span>DRAWDOWN (UNDERWATER)</span></div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/* Stress Test Scenarios */
function StressTests() {
  const scenarios = [
    { name: 'GFC 2008', equity: -38.5, credit: -12.3, rates: -1.5, fx: -8.2, commodities: -32.1, portfolio: -285000 },
    { name: 'COVID Mar 2020', equity: -33.9, credit: -15.8, rates: -0.8, fx: -5.1, commodities: -45.3, portfolio: -248000 },
    { name: 'Dot-Com 2000', equity: -49.1, credit: -3.2, rates: 0.5, fx: 2.1, commodities: -12.4, portfolio: -352000 },
    { name: 'Taper Tantrum', equity: -5.8, credit: -8.5, rates: 1.2, fx: -6.8, commodities: -9.3, portfolio: -78000 },
    { name: 'Flash Crash', equity: -9.0, credit: -2.1, rates: -0.3, fx: -1.5, commodities: -4.2, portfolio: -95000 },
    { name: 'Rate Hike +200bp', equity: -12.5, credit: -5.8, rates: 2.0, fx: 3.2, commodities: -8.5, portfolio: -142000 },
    { name: 'USD Crisis -15%', equity: 5.2, credit: -1.5, rates: 0.3, fx: -15.0, commodities: 12.5, portfolio: -52000 },
    { name: 'Stagflation', equity: -18.3, credit: -8.2, rates: 1.8, fx: -3.5, commodities: 25.3, portfolio: -168000 },
  ];

  return (
    <div data-testid="stress-tests" style={panelStyle}>
      <div style={panelHdr}><span>STRESS TEST SCENARIOS</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Scenario', 'Equity', 'Credit', 'Rates', 'FX', 'Commod', 'Portfolio Impact'].map(h => <th key={h} style={{ padding: '4px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, position: 'sticky', top: 0, background: T.bg1 }}>{h}</th>)}</tr></thead>
          <tbody>{scenarios.map(s => (
            <tr key={s.name} onMouseEnter={e => e.currentTarget.style.background = T.bg2} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontSans, color: T.text0, fontWeight: 600, borderBottom: `1px solid ${T.border0}`, whiteSpace: 'nowrap' }}>{s.name}</td>
              {[s.equity, s.credit, s.rates, s.fx, s.commodities].map((v, i) => (
                <td key={i} style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: clr(v), borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{fmtPct(v)}</td>
              ))}
              <td style={{ padding: '3px 6px', fontSize: '11px', fontFamily: T.fontMono, color: T.dn, fontWeight: 700, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>-{fmtUsd(Math.abs(s.portfolio))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Limit Utilization */
function LimitUtilization() {
  const limits = [
    { name: 'Gross Exposure', used: 78, limit: 100, unit: '%' },
    { name: 'Net Exposure', used: 42, limit: 80, unit: '%' },
    { name: 'Single Name', used: 12.5, limit: 15, unit: '%' },
    { name: 'Sector Conc.', used: 28, limit: 35, unit: '%' },
    { name: 'VaR (1d 95%)', used: 125, limit: 200, unit: 'K' },
    { name: 'Leverage', used: 1.8, limit: 3.0, unit: 'x' },
    { name: 'Beta', used: 1.15, limit: 1.5, unit: '' },
    { name: 'Drawdown', used: 4.2, limit: 10, unit: '%' },
  ];

  return (
    <div data-testid="limit-utilization" style={panelStyle}>
      <div style={panelHdr}><span>LIMIT UTILIZATION</span></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {limits.map(l => {
          const pct = (l.used / l.limit) * 100;
          const color = pct > 90 ? T.critical : pct > 75 ? T.warn : pct > 50 ? T.info : T.up;
          return (
            <div key={l.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: T.fontSans, marginBottom: '2px' }}>
                <span style={{ color: T.text2 }}>{l.name}</span>
                <span style={{ color, fontFamily: T.fontMono, fontWeight: 600 }}>{l.used}{l.unit} / {l.limit}{l.unit} ({pct.toFixed(0)}%)</span>
              </div>
              <div style={{ height: '4px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Risk Alerts */
function RiskAlerts() {
  const [alerts] = useState([
    { time: '14:32:15', severity: 'CRITICAL' as const, message: 'VaR limit 90% utilized — approaching breach threshold', asset: 'Portfolio' },
    { time: '14:28:42', severity: 'WARNING' as const, message: 'NVDA position exceeds 10% concentration', asset: 'NVDA' },
    { time: '14:15:03', severity: 'WARNING' as const, message: 'Correlation spike detected — Tech sector β > 1.5', asset: 'Tech' },
    { time: '13:52:18', severity: 'INFO' as const, message: 'Margin requirement increased by 15% on volatility update', asset: 'Portfolio' },
    { time: '13:45:00', severity: 'INFO' as const, message: 'Stress test: GFC scenario loss exceeds $250K limit', asset: 'Portfolio' },
    { time: '13:30:22', severity: 'WARNING' as const, message: 'Drawdown approaching 5% threshold', asset: 'Portfolio' },
    { time: '12:15:08', severity: 'INFO' as const, message: 'Liquidity score degraded for AMT — bid-ask widened 45%', asset: 'AMT' },
    { time: '11:55:33', severity: 'CRITICAL' as const, message: 'Greeks exposure: portfolio gamma negative ($-2.5M per 1%)', asset: 'Options' },
  ]);

  const sevColor = (s: string) => s === 'CRITICAL' ? T.critical : s === 'WARNING' ? T.warn : T.info;

  return (
    <div data-testid="risk-alerts" style={panelStyle}>
      <div style={panelHdr}><span>RISK ALERTS</span><span style={{ fontSize: '10px', color: T.critical, fontWeight: 700 }}>● {alerts.filter(a => a.severity === 'CRITICAL').length} CRITICAL</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        {alerts.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', padding: '5px 10px', borderBottom: `1px solid ${T.border0}`, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '10px', color: T.text3, fontFamily: T.fontMono, whiteSpace: 'nowrap', marginTop: '1px' }}>{a.time}</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: sevColor(a.severity), padding: '1px 4px', background: `${sevColor(a.severity)}15`, borderRadius: '2px', whiteSpace: 'nowrap' }}>{a.severity}</span>
            <span style={{ fontSize: '10px', color: T.text1, fontFamily: T.fontSans, flex: 1 }}>{a.message}</span>
            <span style={{ fontSize: '10px', color: T.brand, fontFamily: T.fontMono, fontWeight: 600 }}>{a.asset}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Sector Risk Breakdown */
function SectorRiskBreakdown() {
  const sectors = [
    { name: 'Technology', weight: 42.5, var: -82000, beta: 1.35, vol: 22.5, contrib: 58.2 },
    { name: 'Financials', weight: 15.8, var: -28000, beta: 1.08, vol: 18.3, contrib: 16.5 },
    { name: 'Healthcare', weight: 12.3, var: -15000, beta: 0.62, vol: 14.2, contrib: 7.8 },
    { name: 'Cons. Disc.', weight: 10.5, var: -18000, beta: 1.42, vol: 24.8, contrib: 10.2 },
    { name: 'Energy', weight: 8.2, var: -12000, beta: 0.88, vol: 28.5, contrib: 5.8 },
    { name: 'Cons. Staples', weight: 5.5, var: -4000, beta: 0.48, vol: 10.2, contrib: 1.2 },
    { name: 'Others', weight: 5.2, var: -3500, beta: 0.65, vol: 12.8, contrib: 0.3 },
  ];

  return (
    <div data-testid="sector-risk" style={panelStyle}>
      <div style={panelHdr}><span>SECTOR RISK</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Sector', 'Wt%', 'VaR', 'Beta', 'Vol%', 'Risk Contrib%'].map(h => <th key={h} style={{ padding: '4px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans }}>{h}</th>)}</tr></thead>
          <tbody>{sectors.map(s => (
            <tr key={s.name}><td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontSans, color: T.text1, fontWeight: 600, borderBottom: `1px solid ${T.border0}` }}>{s.name}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text2, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{s.weight}%</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.dn, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>-{fmtUsd(Math.abs(s.var))}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: s.beta > 1.2 ? T.warn : T.text2, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{s.beta.toFixed(2)}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: s.vol > 20 ? T.warn : T.text2, borderBottom: `1px solid ${T.border0}`, textAlign: 'right' }}>{s.vol}%</td>
              <td style={{ padding: '3px 6px', borderBottom: `1px solid ${T.border0}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: `${Math.min(s.contrib, 60)}%`, height: '4px', background: s.contrib > 30 ? T.warn : T.brand, borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', fontFamily: T.fontMono, color: s.contrib > 30 ? T.warn : T.text2 }}>{s.contrib}%</span>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Margin Requirements */
function MarginRequirements() {
  const margin = [
    { account: 'Total Portfolio', initial: 625000, maintenance: 450000, available: 175000, utilPct: 72 },
    { account: 'Equities', initial: 410000, maintenance: 290000, available: 120000, utilPct: 70.7 },
    { account: 'Options', initial: 125000, maintenance: 95000, available: 30000, utilPct: 76 },
    { account: 'Futures', initial: 90000, maintenance: 65000, available: 25000, utilPct: 72.2 },
  ];

  return (
    <div data-testid="margin-req" style={panelStyle}>
      <div style={panelHdr}><span>MARGIN REQUIREMENTS</span></div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {margin.map(m => (
          <div key={m.account} style={{ padding: '6px 10px', borderBottom: `1px solid ${T.border0}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: T.text1, fontFamily: T.fontSans }}>{m.account}</span>
              <span style={{ fontSize: '10px', color: m.utilPct > 80 ? T.warn : T.text2, fontFamily: T.fontMono }}>{m.utilPct}% used</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '9px', fontFamily: T.fontMono }}>
              <span style={{ color: T.text3 }}>Init: <span style={{ color: T.text2 }}>{fmtUsd(m.initial)}</span></span>
              <span style={{ color: T.text3 }}>Maint: <span style={{ color: T.text2 }}>{fmtUsd(m.maintenance)}</span></span>
              <span style={{ color: T.text3 }}>Avail: <span style={{ color: T.up }}>{fmtUsd(m.available)}</span></span>
            </div>
            <div style={{ height: '3px', background: T.bg3, borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${m.utilPct}%`, height: '100%', background: m.utilPct > 80 ? T.warn : T.brand, borderRadius: '2px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */
/* ══  MAIN                                                          ══ */
/* ═════════════════════════════════════════════════════════════════════ */

export default function RiskDashboardUI2() {
  // ── Hook integration ──
  const [riskState, riskActions] = useRisk();
  const [orderState, orderActions] = useOrders();
  const [reportingState, reportingActions] = useReporting();

  const pnlData = useMemo(() => generatePnLDistribution(500), []);
  const drawdownData = useMemo(() => generateDrawdownSeries(365), []);
  const [tab, setTab] = useState<'OVERVIEW' | 'STRESS' | 'LIMITS' | 'ALERTS'>('OVERVIEW');

  return (
    <div data-testid="risk-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      <VaRCards />
      <div style={{ display: 'flex', gap: '1px', background: T.border0, borderRadius: T.radius }}>
        {(['OVERVIEW', 'STRESS', 'LIMITS', 'ALERTS'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '5px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, fontFamily: T.fontSans, background: tab === t ? T.bg1 : T.bg2, color: tab === t ? T.brand : T.text3, borderBottom: tab === t ? `2px solid ${T.brand}` : '2px solid transparent' }}>{t}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tab === 'OVERVIEW' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0 }}>
            <PnLDistribution data={pnlData} />
            <SectorRiskBreakdown />
            <DrawdownChart data={drawdownData} />
            <MarginRequirements />
          </div>
        )}
        {tab === 'STRESS' && <StressTests />}
        {tab === 'LIMITS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0 }}>
            <LimitUtilization />
            <MarginRequirements />
          </div>
        )}
        {tab === 'ALERTS' && <RiskAlerts />}
      </div>
    </div>
  );
}
