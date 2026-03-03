/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Portfolio Optimizer (UI2)                           │
 * │  Mean-variance optimization, efficient frontier, Black-Litterman,   │
 * │  risk parity, hierarchical risk parity, constraint management       │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface Asset {
  ticker: string;
  name: string;
  sector: string;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  currentWeight: number;
  optimalWeight: number;
  minWeight: number;
  maxWeight: number;
  beta: number;
}

interface FrontierPoint {
  risk: number;
  return_: number;
  sharpe: number;
  weights: number[];
  isOptimal: boolean;
  isCurrent: boolean;
}

interface PortfolioStats {
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  var95: number;
  cvar95: number;
  trackingError: number;
  infoRatio: number;
  beta: number;
  treynor: number;
  diversificationRatio: number;
}

/* ── Mock Data ───────────────────────────────────────────────────────── */
const COLORS = ['#2962FF', '#26A69A', '#EF5350', '#FF9800', '#AB47BC', '#42A5F5', '#EC407A', '#66BB6A', '#FFA726', '#5C6BC0', '#78909C', '#8D6E63'];

function generateAssets(): Asset[] {
  return [
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', expectedReturn: 12.5, volatility: 22.5, sharpe: 0.56, currentWeight: 15, optimalWeight: 18.2, minWeight: 0, maxWeight: 25, beta: 1.15 },
    { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', expectedReturn: 11.8, volatility: 20.1, sharpe: 0.59, currentWeight: 12, optimalWeight: 15.5, minWeight: 0, maxWeight: 25, beta: 1.08 },
    { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', expectedReturn: 25.0, volatility: 42.5, sharpe: 0.59, currentWeight: 8, optimalWeight: 12.8, minWeight: 0, maxWeight: 20, beta: 1.85 },
    { ticker: 'AMZN', name: 'Amazon', sector: 'Consumer', expectedReturn: 14.2, volatility: 28.5, sharpe: 0.50, currentWeight: 10, optimalWeight: 8.5, minWeight: 0, maxWeight: 20, beta: 1.25 },
    { ticker: 'GOOGL', name: 'Alphabet', sector: 'Technology', expectedReturn: 10.5, volatility: 24.2, sharpe: 0.43, currentWeight: 8, optimalWeight: 6.2, minWeight: 0, maxWeight: 15, beta: 1.10 },
    { ticker: 'JPM', name: 'JPMorgan', sector: 'Financials', expectedReturn: 9.5, volatility: 20.8, sharpe: 0.46, currentWeight: 6, optimalWeight: 5.8, minWeight: 0, maxWeight: 15, beta: 1.05 },
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', expectedReturn: 8.2, volatility: 25.5, sharpe: 0.32, currentWeight: 5, optimalWeight: 3.2, minWeight: 0, maxWeight: 10, beta: 0.85 },
    { ticker: 'JNJ', name: 'J&J', sector: 'Healthcare', expectedReturn: 6.5, volatility: 14.2, sharpe: 0.46, currentWeight: 7, optimalWeight: 8.5, minWeight: 0, maxWeight: 15, beta: 0.65 },
    { ticker: 'TLT', name: 'Long-Term Bonds', sector: 'Fixed Income', expectedReturn: 4.2, volatility: 15.8, sharpe: 0.27, currentWeight: 10, optimalWeight: 5.5, minWeight: 0, maxWeight: 30, beta: -0.15 },
    { ticker: 'GLD', name: 'Gold', sector: 'Commodities', expectedReturn: 5.5, volatility: 16.5, sharpe: 0.33, currentWeight: 5, optimalWeight: 4.8, minWeight: 0, maxWeight: 15, beta: 0.05 },
    { ticker: 'VWO', name: 'EM Equities', sector: 'Intl Equity', expectedReturn: 8.8, volatility: 22.0, sharpe: 0.40, currentWeight: 8, optimalWeight: 6.5, minWeight: 0, maxWeight: 15, beta: 0.95 },
    { ticker: 'CASH', name: 'Cash/T-Bills', sector: 'Cash', expectedReturn: 5.0, volatility: 0.5, sharpe: 10.0, currentWeight: 6, optimalWeight: 4.5, minWeight: 0, maxWeight: 100, beta: 0 },
  ];
}

function generateFrontier(): FrontierPoint[] {
  const points: FrontierPoint[] = [];
  for (let i = 0; i < 50; i++) {
    const risk = 5 + i * 0.8;
    const return_ = 3 + Math.sqrt(risk) * 3.5 + (Math.random() - 0.5) * 0.5;
    const sharpe = (return_ - 5) / risk;
    points.push({
      risk, return_, sharpe,
      weights: Array.from({ length: 12 }, () => Math.random()),
      isOptimal: i === 28,
      isCurrent: i === 22,
    });
  }
  return points;
}

function getPortfolioStats(type: 'current' | 'optimal'): PortfolioStats {
  if (type === 'optimal') {
    return { expectedReturn: 13.5, volatility: 18.2, sharpe: 0.74, sortino: 1.12, maxDrawdown: -15.5, var95: -2.85, cvar95: -3.95, trackingError: 5.2, infoRatio: 0.45, beta: 1.05, treynor: 0.081, diversificationRatio: 1.45 };
  }
  return { expectedReturn: 11.2, volatility: 19.5, sharpe: 0.58, sortino: 0.85, maxDrawdown: -18.2, var95: -3.15, cvar95: -4.35, trackingError: 6.1, infoRatio: 0.28, beta: 1.12, treynor: 0.063, diversificationRatio: 1.32 };
}

/* ── Canvas Components ───────────────────────────────────────────────── */
function EfficientFrontierCanvas({ frontier }: { frontier: FrontierPoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 500, H = 300;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const risks = frontier.map(p => p.risk);
    const rets = frontier.map(p => p.return_);
    const mnR = Math.min(...risks) - 2; const mxR = Math.max(...risks) + 2;
    const mnRet = Math.min(...rets) - 2; const mxRet = Math.max(...rets) + 2;

    // Grid
    ctx.strokeStyle = `${T.border}80`; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = (i / 5) * (H - 30) + 15;
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 10, y); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${(mxRet - i * (mxRet - mnRet) / 5).toFixed(1)}%`, 38, y + 3);
    }
    for (let i = 0; i <= 5; i++) {
      const x = 40 + (i / 5) * (W - 50);
      ctx.beginPath(); ctx.moveTo(x, 15); ctx.lineTo(x, H - 15); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${(mnR + i * (mxR - mnR) / 5).toFixed(1)}%`, x, H - 4);
    }

    // Frontier curve
    ctx.strokeStyle = T.brand; ctx.lineWidth = 2;
    ctx.beginPath();
    frontier.forEach((p, i) => {
      const x = 40 + ((p.risk - mnR) / (mxR - mnR)) * (W - 50);
      const y = 15 + ((mxRet - p.return_) / (mxRet - mnRet)) * (H - 30);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    frontier.forEach(p => {
      const x = 40 + ((p.risk - mnR) / (mxR - mnR)) * (W - 50);
      const y = 15 + ((mxRet - p.return_) / (mxRet - mnRet)) * (H - 30);
      if (p.isOptimal) {
        ctx.fillStyle = T.up; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('OPT', x, y - 10);
      } else if (p.isCurrent) {
        ctx.fillStyle = T.warn; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('CUR', x, y - 10);
      } else {
        ctx.fillStyle = `${T.brand}40`; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Capital Market Line
    const rf = 5; // risk-free rate
    const opt = frontier.find(p => p.isOptimal);
    if (opt) {
      ctx.strokeStyle = `${T.tx3}60`; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      const rfY = 15 + ((mxRet - rf) / (mxRet - mnRet)) * (H - 30);
      const optX = 40 + ((opt.risk - mnR) / (mxR - mnR)) * (W - 50);
      const optY = 15 + ((mxRet - opt.return_) / (mxRet - mnRet)) * (H - 30);
      ctx.beginPath(); ctx.moveTo(40, rfY); ctx.lineTo(optX * 1.5, optY - (rfY - optY) * 0.5); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Axis labels
    ctx.fillStyle = T.tx2; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Risk (Volatility %)', W / 2, H - 1);
    ctx.save(); ctx.translate(10, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('Return (%)', 0, 0); ctx.restore();
  }, [frontier]);
  return <canvas ref={ref} style={{ width: '100%', height: 300, borderRadius: T.r }} />;
}

function AllocationPieCanvas({ assets, type }: { assets: Asset[]; type: 'current' | 'optimal' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const S = 200;
    c.width = S * 2; c.height = S * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, S, S);

    const cx = S / 2; const cy = S / 2; const r = S / 2 - 10;
    let angle = -Math.PI / 2;
    assets.forEach((a, i) => {
      const w = type === 'current' ? a.currentWeight : a.optimalWeight;
      const sliceAngle = (w / 100) * Math.PI * 2;
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + sliceAngle);
      ctx.closePath(); ctx.fill();
      // Label
      if (w > 3) {
        const midAngle = angle + sliceAngle / 2;
        const lx = cx + Math.cos(midAngle) * (r * 0.65);
        const ly = cy + Math.sin(midAngle) * (r * 0.65);
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${a.ticker}`, lx, ly);
        ctx.font = '7px monospace';
        ctx.fillText(`${w.toFixed(1)}%`, lx, ly + 10);
      }
      angle += sliceAngle;
    });
    // Donut hole
    ctx.fillStyle = T.bg2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.tx0; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(type === 'current' ? 'Current' : 'Optimal', cx, cy + 4);
  }, [assets, type]);
  return <canvas ref={ref} style={{ width: 200, height: 200 }} />;
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function StatsComparison({ current, optimal }: { current: PortfolioStats; optimal: PortfolioStats }) {
  const rows = [
    { label: 'Expected Return', cur: `${current.expectedReturn.toFixed(1)}%`, opt: `${optimal.expectedReturn.toFixed(1)}%`, better: optimal.expectedReturn > current.expectedReturn },
    { label: 'Volatility', cur: `${current.volatility.toFixed(1)}%`, opt: `${optimal.volatility.toFixed(1)}%`, better: optimal.volatility < current.volatility },
    { label: 'Sharpe Ratio', cur: current.sharpe.toFixed(2), opt: optimal.sharpe.toFixed(2), better: optimal.sharpe > current.sharpe },
    { label: 'Sortino Ratio', cur: current.sortino.toFixed(2), opt: optimal.sortino.toFixed(2), better: optimal.sortino > current.sortino },
    { label: 'Max Drawdown', cur: `${current.maxDrawdown.toFixed(1)}%`, opt: `${optimal.maxDrawdown.toFixed(1)}%`, better: optimal.maxDrawdown > current.maxDrawdown },
    { label: 'VaR 95%', cur: `${current.var95.toFixed(2)}%`, opt: `${optimal.var95.toFixed(2)}%`, better: Math.abs(optimal.var95) < Math.abs(current.var95) },
    { label: 'CVaR 95%', cur: `${current.cvar95.toFixed(2)}%`, opt: `${optimal.cvar95.toFixed(2)}%`, better: Math.abs(optimal.cvar95) < Math.abs(current.cvar95) },
    { label: 'Beta', cur: current.beta.toFixed(2), opt: optimal.beta.toFixed(2), better: true },
    { label: 'Info Ratio', cur: current.infoRatio.toFixed(2), opt: optimal.infoRatio.toFixed(2), better: optimal.infoRatio > current.infoRatio },
    { label: 'Diversification', cur: `${current.diversificationRatio.toFixed(2)}x`, opt: `${optimal.diversificationRatio.toFixed(2)}x`, better: optimal.diversificationRatio > current.diversificationRatio },
  ];

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
          {['Metric', 'Current', 'Optimal', 'Δ'].map(h => (
            <th key={h} style={{ padding: '3px 6px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label} style={{ borderBottom: `1px solid ${T.border}` }}>
            <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'left' }}>{r.label}</td>
            <td style={{ padding: '3px 6px', color: T.tx1, textAlign: 'right' }}>{r.cur}</td>
            <td style={{ padding: '3px 6px', color: T.tx0, fontWeight: 600, textAlign: 'right' }}>{r.opt}</td>
            <td style={{ padding: '3px 6px', textAlign: 'right' }}>
              <span style={{ color: r.better ? T.up : T.dn, fontWeight: 600 }}>{r.better ? '▲' : '▼'}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AssetTable({ assets }: { assets: Asset[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
          {['Asset', 'Sector', 'E[R]', 'Vol', 'Sharpe', 'Current', 'Optimal', 'Δ', 'Beta'].map(h => (
            <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {assets.map((a, i) => {
          const delta = a.optimalWeight - a.currentWeight;
          return (
            <tr key={a.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: T.tx0, fontWeight: 600 }}>{a.ticker}</span>
                </div>
              </td>
              <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontSize: '7px' }}>{a.sector}</td>
              <td style={{ padding: '3px 4px', color: T.up, textAlign: 'right' }}>{a.expectedReturn.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{a.volatility.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: a.sharpe > 0.5 ? T.up : T.tx1, textAlign: 'right' }}>{a.sharpe.toFixed(2)}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{a.currentWeight.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: T.brand, fontWeight: 600, textAlign: 'right' }}>{a.optimalWeight.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: delta > 0 ? T.up : delta < 0 ? T.dn : T.tx3, textAlign: 'right', fontWeight: 600 }}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
              </td>
              <td style={{ padding: '3px 4px', color: a.beta > 1.2 ? T.warn : T.tx2, textAlign: 'right' }}>{a.beta.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
type OptTab = 'frontier' | 'allocation' | 'comparison' | 'constraints';

export default function PortfolioOptimizerUI2() {
  const [tab, setTab] = useState<OptTab>('frontier');
  const [method, setMethod] = useState('mvo');
  const assets = useMemo(() => generateAssets(), []);
  const frontier = useMemo(() => generateFrontier(), []);
  const currentStats = useMemo(() => getPortfolioStats('current'), []);
  const optimalStats = useMemo(() => getPortfolioStats('optimal'), []);

  return (
    <div data-testid="portfolio-optimizer-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>PORTFOLIO OPTIMIZER</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <select value={method} onChange={e => setMethod(e.target.value)}
          style={{ background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '9px', fontFamily: T.mono }}>
          <option value="mvo">Mean-Variance (MVO)</option>
          <option value="bl">Black-Litterman</option>
          <option value="rp">Risk Parity</option>
          <option value="hrp">Hierarchical RP</option>
          <option value="minvar">Min Variance</option>
          <option value="maxdiv">Max Diversification</option>
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '6px', fontSize: '8px', fontFamily: T.mono }}>
          <span style={{ color: T.tx3 }}>Current Sharpe: <span style={{ color: T.warn }}>{currentStats.sharpe.toFixed(2)}</span></span>
          <span style={{ color: T.tx3 }}>Optimal Sharpe: <span style={{ color: T.up }}>{optimalStats.sharpe.toFixed(2)}</span></span>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'frontier' as OptTab, label: '📈 Efficient Frontier' },
          { key: 'allocation' as OptTab, label: '🎯 Allocation' },
          { key: 'comparison' as OptTab, label: '⚖️ Comparison' },
          { key: 'constraints' as OptTab, label: '🔒 Constraints' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'frontier' && (
          <div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Efficient Frontier — {method.toUpperCase()}</div>
              <EfficientFrontierCanvas frontier={frontier} />
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Asset Universe</div>
              <AssetTable assets={assets} />
            </div>
          </div>
        )}
        {tab === 'allocation' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Current Portfolio</div>
              <AllocationPieCanvas assets={assets} type="current" />
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Optimal Portfolio</div>
              <AllocationPieCanvas assets={assets} type="optimal" />
            </div>
            <div style={{ flex: 1, minWidth: '300px', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Rebalancing Trades</div>
              {assets.filter(a => Math.abs(a.optimalWeight - a.currentWeight) > 0.5).map(a => {
                const delta = a.optimalWeight - a.currentWeight;
                return (
                  <div key={a.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${T.border}`, fontSize: '8px', fontFamily: T.mono }}>
                    <span style={{ color: T.tx0 }}>{a.ticker}</span>
                    <span style={{ color: delta > 0 ? T.up : T.dn, fontWeight: 700 }}>{delta > 0 ? 'BUY' : 'SELL'} {Math.abs(delta).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === 'comparison' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Current vs. Optimal — Full Comparison</div>
            <StatsComparison current={currentStats} optimal={optimalStats} />
          </div>
        )}
        {tab === 'constraints' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '8px' }}>Optimization Constraints</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Long Only', type: 'toggle', active: true },
                { label: 'Max Position', type: 'value', value: '25%' },
                { label: 'Min Position', type: 'value', value: '0%' },
                { label: 'Sector Cap', type: 'value', value: '40%' },
                { label: 'Max Turnover', type: 'value', value: '30%' },
                { label: 'Target Beta', type: 'range', value: '0.8 - 1.2' },
                { label: 'Max Tracking Error', type: 'value', value: '8%' },
                { label: 'Rebalance Cost', type: 'value', value: '10 bps' },
              ].map(c => (
                <div key={c.label} style={{ background: T.bg2, borderRadius: T.r, padding: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: '9px', color: T.tx1 }}>{c.label}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: T.brand, fontFamily: T.mono }}>{c.value ?? (c.active ? 'ON' : 'OFF')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { PortfolioOptimizerUI2 };
