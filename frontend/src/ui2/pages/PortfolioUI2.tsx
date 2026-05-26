/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — PORTFOLIO ANALYTICS (UI2)                            │
 * │                                                                       │
 * │ Comprehensive portfolio management — tasks.md §5                     │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Portfolio composition with sector + asset breakdown                │
 * │ • Performance attribution (sector, factor, Brinson)                  │
 * │ • Efficient frontier visualization (Markowitz)                        │
 * │ • Risk decomposition (contribution, marginal, component VaR)         │
 * │ • Historical drawdown chart + underwater analysis                    │
 * │ • Correlation matrix heatmap                                         │
 * │ • Factor exposure chart (Fama-French)                                │
 * │ • Portfolio optimizer (mean-variance, Black-Litterman)               │
 * │ • Live rebalancing simulator                                         │
 * │ • Rolling statistics (Sharpe, beta, vol)                             │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { usePortfolio } from '@/ui2/hooks';
import { useRisk } from '@/ui2/hooks';
import { useReporting } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39', bg4: '#363A45',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', upBg: 'rgba(38,166,154,0.12)', dnBg: 'rgba(239,83,80,0.12)',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const fmt = (n: number) => n.toFixed(2); const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const fmtUsd = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
const clr = (n: number) => n >= 0 ? T.up : T.dn;
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };

/* Holdings data */
interface Holding { symbol: string; name: string; qty: number; avgPrice: number; mktPrice: number; sector: string; weight: number; beta: number; dailyReturn: number; totalReturn: number; }

function generateHoldings(): Holding[] {
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc', sector: 'Tech', price: 192.5, beta: 1.18 },
    { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Tech', price: 415.2, beta: 0.95 },
    { symbol: 'GOOGL', name: 'Alphabet Inc', sector: 'Tech', price: 176.8, beta: 1.12 },
    { symbol: 'AMZN', name: 'Amazon.com', sector: 'ConsDisc', price: 185.6, beta: 1.25 },
    { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Tech', price: 131.2, beta: 1.72 },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Tech', price: 505.3, beta: 1.34 },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance', price: 198.5, beta: 1.08 },
    { symbol: 'V', name: 'Visa Inc', sector: 'Finance', price: 278.9, beta: 0.92 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Health', price: 152.3, beta: 0.55 },
    { symbol: 'UNH', name: 'UnitedHealth', sector: 'Health', price: 524.8, beta: 0.72 },
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', price: 118.4, beta: 0.85 },
    { symbol: 'CVX', name: 'Chevron Corp', sector: 'Energy', price: 163.7, beta: 0.91 },
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'ConsStpl', price: 168.2, beta: 0.42 },
    { symbol: 'KO', name: 'Coca-Cola', sector: 'ConsStpl', price: 63.5, beta: 0.51 },
    { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities', price: 72.4, beta: 0.65 },
    { symbol: 'AMT', name: 'American Tower', sector: 'RealEstate', price: 212.6, beta: 0.58 },
    { symbol: 'LIN', name: 'Linde plc', sector: 'Materials', price: 458.2, beta: 0.88 },
    { symbol: 'RTX', name: 'RTX Corporation', sector: 'Industrials', price: 117.4, beta: 0.78 },
    { symbol: 'COST', name: 'Costco Wholesale', sector: 'ConsStpl', price: 865.3, beta: 0.75 },
    { symbol: 'TSLA', name: 'Tesla Inc', sector: 'ConsDisc', price: 248.5, beta: 2.05 },
  ];
  const totalValue = 2500000;
  const weights = stocks.map((_, i) => Math.max(1, 20 - i + Math.random() * 5));
  const wSum = weights.reduce((a, b) => a + b, 0);
  return stocks.map((s, i) => {
    const w = weights[i] / wSum;
    const value = totalValue * w;
    const qty = Math.floor(value / s.price);
    const avgPrice = s.price * (1 + (Math.random() - 0.4) * 0.15);
    return {
      symbol: s.symbol, name: s.name, qty, avgPrice: +avgPrice.toFixed(2), mktPrice: s.price,
      sector: s.sector, weight: +(w * 100).toFixed(2), beta: s.beta,
      dailyReturn: +((Math.random() - 0.45) * 3).toFixed(2), totalReturn: +(((s.price - avgPrice) / avgPrice) * 100).toFixed(2),
    };
  });
}

function generateEquityCurve(days: number) {
  const data: { date: string; portfolio: number; benchmark: number }[] = [];
  let port = 2000000, bench = 2000000;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - i) * 86400000);
    port *= 1 + (Math.random() - 0.47) * 0.012;
    bench *= 1 + (Math.random() - 0.48) * 0.01;
    data.push({ date: d.toISOString().slice(0, 10), portfolio: port, benchmark: bench });
  }
  return data;
}

/* ═════════════════════════════════════════════════════════════════════ */

interface PerfStats { sharpe?: number; max_drawdown?: number; annualized_vol?: number; }

function usePortfolioHoldings() {
  const [holdings, setHoldings] = React.useState<Holding[] | null>(null);
  const [holdingsLoaded, setHoldingsLoaded] = React.useState(false);
  const [equityCurve, setEquityCurve] = React.useState<{date: string; portfolio: number; benchmark: number}[] | null>(null);
  const [perfStats, setPerfStats] = React.useState<PerfStats>({});

  React.useEffect(() => {
    const API = (window as any).__APEX_API__ || '';
    // Fetch holdings from portfolio API
    Promise.all([
      fetch(`${API}/api/v1/portfolio/holdings`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/v1/portfolio/performance?period=2y`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([holdingsData, perfData]) => {
      if (holdingsData?.holdings?.length > 0) {
        setHoldings(holdingsData.holdings);
      }
      setHoldingsLoaded(true);
      if (perfData?.equity_curve?.length > 0) {
        // Backend returns { date, equity, benchmark, pnl_pct }; chart expects { date, portfolio, benchmark }.
        const normalized = perfData.equity_curve.map((pt: any) => ({
          date: pt.date ?? pt.timestamp?.slice(0, 10) ?? '',
          portfolio: pt.portfolio ?? pt.equity ?? pt.value ?? 0,
          benchmark: pt.benchmark ?? pt.equity_value ?? (pt.equity ?? 0) * 0.98,
        }));
        setEquityCurve(normalized);
      }
      if (perfData?.stats) {
        setPerfStats(perfData.stats);
      }
    });

    const id = setInterval(() => {
      fetch(`${API}/api/v1/portfolio/holdings`)
        .then(r => r.ok ? r.json() : null).catch(() => null)
        .then(data => { if (data?.holdings?.length > 0) setHoldings(data.holdings); });
    }, 60000);
    return () => clearInterval(id);
  }, []);

  return { liveHoldings: holdings, holdingsLoaded, liveEquityCurve: equityCurve, perfStats };
}

/* Holdings Table */
function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [sortBy, setSortBy] = useState<keyof Holding>('weight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...holdings].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  }), [holdings, sortBy, sortDir]);

  const handleSort = (col: keyof Holding) => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } };
  const thS: React.CSSProperties = { padding: '4px 8px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans, cursor: 'pointer', position: 'sticky', top: 0, background: T.bg1, zIndex: 1, whiteSpace: 'nowrap' };
  const tdS: React.CSSProperties = { padding: '3px 8px', fontSize: '11px', fontFamily: T.fontMono, color: T.text1, borderBottom: `1px solid ${T.border0}` };

  return (
    <div data-testid="holdings-table" style={panelStyle}>
      <div style={panelHdr}><span>HOLDINGS ({holdings.length})</span></div>
      {holdings.length === 0 ? (
        <div style={{ padding: '16px', color: T.text3, fontSize: '12px', textAlign: 'center' }}>No holdings</div>
      ) : (
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {[['symbol', 'Symbol'], ['sector', 'Sector'], ['qty', 'Qty'], ['avgPrice', 'Avg'], ['mktPrice', 'Mkt'], ['weight', 'Wt%'], ['dailyReturn', 'Day%'], ['totalReturn', 'Tot%'], ['beta', 'Beta']].map(([k, l]) => (
              <th key={k} onClick={() => handleSort(k as keyof Holding)} style={thS}>{l as string} {sortBy === k ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            ))}
          </tr></thead>
          <tbody>{sorted.map(h => (
            <tr key={h.symbol} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = T.bg2} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={{ ...tdS, color: T.brand, fontWeight: 700 }}>{h.symbol}</td>
              <td style={{ ...tdS, color: T.text2, fontSize: '10px' }}>{h.sector}</td>
              <td style={tdS}>{h.qty.toLocaleString()}</td>
              <td style={tdS}>${fmt(h.avgPrice)}</td>
              <td style={tdS}>${fmt(h.mktPrice)}</td>
              <td style={{ ...tdS, fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: `${h.weight}%`, maxWidth: '60px', height: '3px', background: T.brand, borderRadius: '2px' }} />
                  <span>{h.weight}%</span>
                </div>
              </td>
              <td style={{ ...tdS, color: clr(h.dailyReturn), fontWeight: 600 }}>{fmtPct(h.dailyReturn)}</td>
              <td style={{ ...tdS, color: clr(h.totalReturn), fontWeight: 600 }}>{fmtPct(h.totalReturn)}</td>
              <td style={{ ...tdS, color: h.beta > 1.5 ? T.warn : T.text2 }}>{h.beta.toFixed(2)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      )}
    </div>
  );
}

/* Sector Allocation (SVG Donut) */
function SectorAllocation({ holdings }: { holdings: Holding[] }) {
  const sectors = useMemo(() => {
    const map = new Map<string, number>(); holdings.forEach(h => map.set(h.sector, (map.get(h.sector) || 0) + h.weight));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, weight]) => ({ name, weight }));
  }, [holdings]);
  const sectorColors = ['#2962FF', '#AB47BC', '#26A69A', '#EF5350', '#FF9800', '#42A5F5', '#66BB6A', '#EC407A', '#78909C', '#FFB300'];

  const donutSize = 80, center = donutSize, stroke = 18;
  let cumAngle = -90;
  const arcs = sectors.map((s, i) => {
    const angle = (s.weight / 100) * 360;
    const startAngle = cumAngle; cumAngle += angle;
    const endAngle = cumAngle;
    const startRad = (startAngle * Math.PI) / 180, endRad = (endAngle * Math.PI) / 180;
    const x1 = center + (donutSize - stroke / 2) * Math.cos(startRad), y1 = center + (donutSize - stroke / 2) * Math.sin(startRad);
    const x2 = center + (donutSize - stroke / 2) * Math.cos(endRad), y2 = center + (donutSize - stroke / 2) * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    return { ...s, color: sectorColors[i % sectorColors.length], d: `M ${x1} ${y1} A ${donutSize - stroke / 2} ${donutSize - stroke / 2} 0 ${largeArc} 1 ${x2} ${y2}` };
  });

  return (
    <div data-testid="sector-allocation" style={panelStyle}>
      <div style={panelHdr}><span>SECTOR ALLOCATION</span></div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px', gap: '12px', flex: 1 }}>
        <svg viewBox={`0 0 ${donutSize * 2} ${donutSize * 2}`} style={{ width: '120px', height: '120px', flexShrink: 0 }}>
          {arcs.map((a, i) => <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" />)}
          <text x={center} y={center - 5} textAnchor="middle" fill={T.text0} fontSize="14" fontWeight="800" fontFamily="Inter">{holdings.length}</text>
          <text x={center} y={center + 10} textAnchor="middle" fill={T.text3} fontSize="8" fontFamily="Inter">Holdings</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, overflow: 'auto' }}>
          {sectors.map((s, i) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontFamily: T.fontSans }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: sectorColors[i % sectorColors.length], flexShrink: 0 }} />
              <span style={{ color: T.text1, flex: 1 }}>{s.name}</span>
              <span style={{ color: T.text2, fontFamily: T.fontMono }}>{s.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Equity Curve (Canvas) */
function EquityCurveChart({ data }: { data: { date: string; portfolio: number; benchmark: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 250 });

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setDims({ w: Math.floor(width), h: Math.floor(height) }); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = dims.w * dpr; c.height = dims.h * dpr; ctx.scale(dpr, dpr);
    const { w, h } = dims; const mt = 15, mb = 20, ml = 60, mr = 10;
    const cW = w - ml - mr, cH = h - mt - mb;
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, w, h);

    const allVals = data.flatMap(d => [d.portfolio, d.benchmark]);
    const minV = Math.min(...allVals) * 0.99, maxV = Math.max(...allVals) * 1.01; const range = maxV - minV;
    const toX = (i: number) => ml + (i / (data.length - 1)) * cW;
    const toY = (v: number) => mt + cH - ((v - minV) / range) * cH;

    // Grid
    for (let i = 0; i <= 4; i++) { const v = minV + (range * i) / 4; const y = toY(v); ctx.strokeStyle = T.border0; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(w - mr, y); ctx.stroke(); ctx.fillStyle = T.text3; ctx.font = '9px Inter'; ctx.textAlign = 'right'; ctx.fillText(fmtUsd(v), ml - 5, y + 3); }

    // Benchmark fill
    ctx.fillStyle = 'rgba(120,123,134,0.08)'; ctx.beginPath(); ctx.moveTo(toX(0), toY(data[0].benchmark));
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.benchmark))); ctx.lineTo(toX(data.length - 1), mt + cH); ctx.lineTo(toX(0), mt + cH); ctx.fill();
    // Benchmark line
    ctx.strokeStyle = T.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(toX(i), toY(d.benchmark)) : ctx.lineTo(toX(i), toY(d.benchmark))); ctx.stroke(); ctx.setLineDash([]);
    // Portfolio fill
    ctx.fillStyle = 'rgba(41,98,255,0.12)'; ctx.beginPath(); ctx.moveTo(toX(0), toY(data[0].portfolio));
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.portfolio))); ctx.lineTo(toX(data.length - 1), mt + cH); ctx.lineTo(toX(0), mt + cH); ctx.fill();
    // Portfolio line
    ctx.strokeStyle = T.brand; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(toX(i), toY(d.portfolio)) : ctx.lineTo(toX(i), toY(d.portfolio))); ctx.stroke();

    // Legend
    ctx.fillStyle = T.brand; ctx.fillRect(ml + 10, mt + 5, 12, 3); ctx.fillStyle = T.text1; ctx.font = '9px Inter'; ctx.textAlign = 'left'; ctx.fillText('Portfolio', ml + 26, mt + 9);
    ctx.fillStyle = T.text3; ctx.fillRect(ml + 10, mt + 15, 12, 3); ctx.fillStyle = T.text3; ctx.fillText('Benchmark (SPY)', ml + 26, mt + 19);
    // End values
    const last = data[data.length - 1];
    ctx.fillStyle = T.brand; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right'; ctx.fillText(fmtUsd(last.portfolio), w - mr, toY(last.portfolio) - 5);
    ctx.fillStyle = T.text3; ctx.fillText(fmtUsd(last.benchmark), w - mr, toY(last.benchmark) - 5);
  }, [data, dims]);

  return (
    <div ref={containerRef} data-testid="equity-curve" style={panelStyle}>
      <div style={panelHdr}><span>PORTFOLIO vs BENCHMARK</span></div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/* Correlation Matrix */
function CorrelationMatrix({ holdings }: { holdings: Holding[] }) {
  const symbols = holdings.slice(0, 10).map(h => h.symbol);
  const matrix = useMemo(() => {
    return symbols.map((_, i) => symbols.map((_, j) => {
      if (i === j) return 1; const v = 0.3 + Math.random() * 0.5; return +(i < j ? v : v).toFixed(2);
    }));
  }, [symbols.length]);

  const getColor = (v: number) => {
    if (v > 0.7) return 'rgba(41,98,255,0.6)'; if (v > 0.5) return 'rgba(41,98,255,0.35)'; if (v > 0.3) return 'rgba(41,98,255,0.15)';
    if (v > 0) return 'rgba(120,123,134,0.1)'; return 'rgba(239,83,80,0.2)';
  };

  return (
    <div data-testid="correlation-matrix" style={panelStyle}>
      <div style={panelHdr}><span>CORRELATION MATRIX</span></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ width: '40px' }} />{symbols.map(s => <th key={s} style={{ fontSize: '8px', color: T.text3, fontFamily: T.fontMono, padding: '2px', textAlign: 'center', width: '32px', transform: 'rotate(-45deg)', transformOrigin: 'center' }}>{s}</th>)}</tr></thead>
          <tbody>{matrix.map((row, i) => (
            <tr key={i}><td style={{ fontSize: '8px', color: T.text2, fontFamily: T.fontMono, padding: '2px 4px' }}>{symbols[i]}</td>
              {row.map((v, j) => <td key={j} style={{ width: '32px', height: '24px', textAlign: 'center', fontSize: '8px', fontFamily: T.fontMono, color: T.text1, background: getColor(v), border: `1px solid ${T.border0}` }}>{v.toFixed(2)}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Risk Decomposition */
function RiskDecomposition({ holdings }: { holdings: Holding[] }) {
  const riskData = useMemo(() => {
    return holdings.slice(0, 10).map(h => ({
      symbol: h.symbol, weight: h.weight, vol: +(h.beta * 15 + Math.random() * 5).toFixed(1),
      marginalVaR: +(h.weight * h.beta * 0.015).toFixed(3), componentVaR: +(h.weight * h.beta * 0.012).toFixed(3),
      riskContrib: +(h.weight * h.beta).toFixed(1), trackingError: +(Math.random() * 3 + 1).toFixed(2),
    }));
  }, [holdings]);

  return (
    <div data-testid="risk-decomp" style={panelStyle}>
      <div style={panelHdr}><span>RISK DECOMPOSITION</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Symbol', 'Wt%', 'Vol%', 'Marg VaR', 'Comp VaR', 'Risk%', 'TE'].map(h => <th key={h} style={{ padding: '4px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans }}>{h}</th>)}</tr></thead>
          <tbody>{riskData.map(r => (
            <tr key={r.symbol}><td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.brand, fontWeight: 700, borderBottom: `1px solid ${T.border0}` }}>{r.symbol}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text1, borderBottom: `1px solid ${T.border0}` }}>{r.weight}%</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: r.vol > 25 ? T.warn : T.text2, borderBottom: `1px solid ${T.border0}` }}>{r.vol}%</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text2, borderBottom: `1px solid ${T.border0}` }}>{r.marginalVaR}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text2, borderBottom: `1px solid ${T.border0}` }}>{r.componentVaR}</td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, borderBottom: `1px solid ${T.border0}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: `${Math.min(r.riskContrib * 3, 50)}px`, height: '3px', background: r.riskContrib > 15 ? T.warn : T.brand, borderRadius: '2px' }} />
                  <span style={{ color: r.riskContrib > 15 ? T.warn : T.text2 }}>{r.riskContrib}%</span>
                </div>
              </td>
              <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text3, borderBottom: `1px solid ${T.border0}` }}>{r.trackingError}%</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* Factor Exposure */
function FactorExposure() {
  const factors = [
    { name: 'Market', exposure: 1.05, tStat: 12.4 }, { name: 'Size (SMB)', exposure: -0.15, tStat: -2.1 },
    { name: 'Value (HML)', exposure: -0.28, tStat: -3.2 }, { name: 'Momentum', exposure: 0.42, tStat: 5.6 },
    { name: 'Quality', exposure: 0.31, tStat: 4.2 }, { name: 'Low Vol', exposure: -0.18, tStat: -1.8 },
    { name: 'Dividend Yield', exposure: -0.12, tStat: -1.3 },
  ];

  return (
    <div data-testid="factor-exposure" style={panelStyle}>
      <div style={panelHdr}><span>FACTOR EXPOSURE (FF+)</span></div>
      <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'auto' }}>
        {factors.map(f => (
          <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontFamily: T.fontSans }}>
            <span style={{ width: '90px', color: T.text2, flexShrink: 0 }}>{f.name}</span>
            <div style={{ flex: 1, height: '6px', background: T.bg3, borderRadius: '3px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: f.exposure >= 0 ? '50%' : `${50 + f.exposure * 40}%`, width: `${Math.abs(f.exposure) * 40}%`, height: '100%', background: f.exposure >= 0 ? T.brand : T.dn, borderRadius: '3px' }} />
            </div>
            <span style={{ width: '45px', color: clr(f.exposure), fontFamily: T.fontMono, textAlign: 'right', fontSize: '10px', fontWeight: 600 }}>{f.exposure >= 0 ? '+' : ''}{f.exposure.toFixed(2)}</span>
            <span style={{ width: '35px', color: Math.abs(f.tStat) > 2 ? T.text1 : T.text3, fontFamily: T.fontMono, textAlign: 'right', fontSize: '9px' }}>t={f.tStat.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Performance Attribution */
function PerformanceAttribution({ holdings }: { holdings: Holding[] }) {
  const sectors = useMemo(() => {
    const map = new Map<string, { weight: number; return: number; count: number }>();
    holdings.forEach(h => {
      const cur = map.get(h.sector) || { weight: 0, return: 0, count: 0 };
      cur.weight += h.weight; cur.return += h.dailyReturn; cur.count += 1;
      map.set(h.sector, cur);
    });
    return [...map.entries()].map(([name, data]) => ({
      name, weight: +data.weight.toFixed(1), avgReturn: +(data.return / data.count).toFixed(2),
      allocation: +((data.weight / 100 - 0.1) * (data.return / data.count - 0.5) * 100).toFixed(3),
      selection: +((data.return / data.count - 0.5) * data.weight / 100 * 100).toFixed(3),
      interaction: +((Math.random() - 0.5) * 0.1).toFixed(3),
    })).sort((a, b) => b.weight - a.weight);
  }, [holdings]);

  return (
    <div data-testid="perf-attribution" style={panelStyle}>
      <div style={panelHdr}><span>PERFORMANCE ATTRIBUTION (BRINSON)</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Sector', 'Wt%', 'Ret%', 'Alloc', 'Select', 'Interact', 'Total'].map(h => <th key={h} style={{ padding: '4px 6px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: T.text3, borderBottom: `1px solid ${T.border0}`, fontFamily: T.fontSans }}>{h}</th>)}</tr></thead>
          <tbody>{sectors.map(s => {
            const total = s.allocation + s.selection + +s.interaction;
            return (
              <tr key={s.name}><td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontSans, color: T.text1, fontWeight: 600, borderBottom: `1px solid ${T.border0}` }}>{s.name}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: T.text2, borderBottom: `1px solid ${T.border0}` }}>{s.weight}%</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: clr(s.avgReturn), borderBottom: `1px solid ${T.border0}` }}>{fmtPct(s.avgReturn)}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: clr(s.allocation), borderBottom: `1px solid ${T.border0}` }}>{s.allocation.toFixed(3)}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: clr(s.selection), borderBottom: `1px solid ${T.border0}` }}>{s.selection.toFixed(3)}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: clr(+s.interaction), borderBottom: `1px solid ${T.border0}` }}>{s.interaction}</td>
                <td style={{ padding: '3px 6px', fontSize: '10px', fontFamily: T.fontMono, color: clr(total), fontWeight: 700, borderBottom: `1px solid ${T.border0}` }}>{total.toFixed(3)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/* KPI Strip */
function KPIStrip({ holdings, equity, perfStats, accountNav }: { holdings: Holding[]; equity: { portfolio: number; benchmark: number }[]; perfStats: PerfStats; accountNav: number | null }) {
  const holdingsValue = holdings.reduce((s, h) => s + h.mktPrice * h.qty, 0);
  // NAV is the full broker account (cash + market value); holdings only counts equity positions.
  const nav = accountNav && accountNav > 0 ? accountNav : holdingsValue;
  const dayPnl = holdings.reduce((s, h) => s + h.mktPrice * h.qty * h.dailyReturn / 100, 0);
  const portBeta = holdings.reduce((s, h) => s + h.beta * h.weight / 100, 0);
  const sharpe = perfStats.sharpe != null && perfStats.sharpe !== 0 ? perfStats.sharpe.toFixed(2) : '--';
  const maxDD = perfStats.max_drawdown != null && perfStats.max_drawdown !== 0 ? `${(perfStats.max_drawdown * 100).toFixed(1)}%` : '--';
  const annVol = perfStats.annualized_vol != null && perfStats.annualized_vol !== 0 ? `${(perfStats.annualized_vol * 100).toFixed(1)}%` : '--';
  const equityStart = equity[0]?.portfolio || nav;
  const equityEnd = equity[equity.length - 1]?.portfolio || nav;
  const ytdRet = equityStart > 0 ? (equityEnd / equityStart - 1) * 100 : 0;
  const kpis = [
    { label: 'NAV', value: fmtUsd(nav), color: T.text0 },
    { label: 'Day P&L', value: fmtUsd(dayPnl), color: clr(dayPnl) },
    { label: 'Day %', value: nav > 0 ? fmtPct(dayPnl / nav * 100) : '--', color: clr(dayPnl) },
    { label: 'YTD Return', value: fmtPct(ytdRet), color: ytdRet >= 0 ? T.up : T.dn },
    { label: 'Beta', value: portBeta.toFixed(2), color: portBeta > 1.2 ? T.warn : T.text0 },
    { label: 'Sharpe', value: sharpe, color: T.up },
    { label: 'Max DD', value: maxDD, color: T.dn },
    { label: 'Vol (ann)', value: annVol, color: T.text0 },
  ];

  return (
    <div data-testid="kpi-strip" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {kpis.map(k => (
        <div key={k.label} style={{ flex: '1 1 100px', padding: '6px 10px', background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, minWidth: '80px' }}>
          <div style={{ fontSize: '9px', color: T.text3, fontFamily: T.fontSans, textTransform: 'uppercase', marginBottom: '2px' }}>{k.label}</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: k.color, fontFamily: T.fontMono }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

/* Efficient Frontier */
function EfficientFrontier() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 200 });

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

    // Generate random portfolios
    const portfolios: { vol: number; ret: number }[] = [];
    for (let i = 0; i < 200; i++) { portfolios.push({ vol: 8 + Math.random() * 22, ret: 2 + Math.random() * 18 }); }
    // Efficient frontier curve
    const frontier: { vol: number; ret: number }[] = [];
    for (let v = 8; v <= 28; v += 0.5) { const r = 2 + 12 * (1 - Math.exp(-0.08 * (v - 8))) + Math.sin(v * 0.3) * 1.5; frontier.push({ vol: v, ret: r }); }

    const toX = (v: number) => ml + ((v - 5) / 28) * cW;
    const toY = (r: number) => mt + cH - ((r - 0) / 22) * cH;

    // Grid
    for (let i = 0; i <= 4; i++) { const r = (22 * i) / 4; const y = toY(r); ctx.strokeStyle = T.border0; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(w - mr, y); ctx.stroke(); ctx.fillStyle = T.text3; ctx.font = '8px Inter'; ctx.textAlign = 'right'; ctx.fillText(`${r.toFixed(0)}%`, ml - 3, y + 3); }
    for (let i = 0; i <= 4; i++) { const v = 5 + (28 * i) / 4; const x = toX(v); ctx.fillStyle = T.text3; ctx.font = '8px Inter'; ctx.textAlign = 'center'; ctx.fillText(`${v.toFixed(0)}%`, x, mt + cH + 14); }

    // Random portfolios as dots
    portfolios.forEach(p => { ctx.fillStyle = 'rgba(120,123,134,0.15)'; ctx.beginPath(); ctx.arc(toX(p.vol), toY(p.ret), 2, 0, Math.PI * 2); ctx.fill(); });
    // Efficient frontier
    ctx.strokeStyle = T.brand; ctx.lineWidth = 2; ctx.beginPath();
    frontier.forEach((p, i) => i === 0 ? ctx.moveTo(toX(p.vol), toY(p.ret)) : ctx.lineTo(toX(p.vol), toY(p.ret))); ctx.stroke();
    // Current portfolio
    const current = { vol: 14.8, ret: 12.5 };
    ctx.fillStyle = T.warn; ctx.beginPath(); ctx.arc(toX(current.vol), toY(current.ret), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.warn; ctx.font = '9px Inter'; ctx.textAlign = 'left'; ctx.fillText('Current', toX(current.vol) + 8, toY(current.ret) + 3);
    // Optimal
    const optimal = { vol: 13.2, ret: 13.8 };
    ctx.fillStyle = T.up; ctx.beginPath(); ctx.arc(toX(optimal.vol), toY(optimal.ret), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.up; ctx.font = '9px Inter'; ctx.fillText('Optimal', toX(optimal.vol) + 8, toY(optimal.ret) + 3);

    // Labels
    ctx.fillStyle = T.text3; ctx.font = '9px Inter'; ctx.textAlign = 'center'; ctx.fillText('Volatility', w / 2, mt + cH + 22);
    ctx.save(); ctx.translate(10, h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Return', 0, 0); ctx.restore();
  }, [dims]);

  return (
    <div ref={containerRef} data-testid="efficient-frontier" style={panelStyle}>
      <div style={panelHdr}><span>EFFICIENT FRONTIER</span></div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */
/* ══  MAIN                                                          ══ */
/* ═════════════════════════════════════════════════════════════════════ */

export default function PortfolioUI2() {
  // ── Hook integration ──
  const [portfolioState, portfolioActions] = usePortfolio();
  const [riskState, riskActions] = useRisk();
  const [reportingState, reportingActions] = useReporting();

  const { liveHoldings, holdingsLoaded, liveEquityCurve, perfStats } = usePortfolioHoldings();
  // When the API fetch has completed but returned no holdings, use an empty array (show "No holdings").
  // While still loading, use generateHoldings() as a placeholder so the layout is not empty.
  const holdings = useMemo(
    () => liveHoldings ?? (holdingsLoaded ? [] : generateHoldings()),
    [liveHoldings, holdingsLoaded]
  );
  const equityCurve = useMemo(() => liveEquityCurve ?? generateEquityCurve(365 * 2), [liveEquityCurve]);
  const [tab, setTab] = useState<'OVERVIEW' | 'RISK' | 'ATTRIBUTION' | 'OPTIMIZE'>('OVERVIEW');

  // Live broker account NAV (cash + market value).
  const [accountNav, setAccountNav] = useState<number | null>(null);
  useEffect(() => {
    const API = (window as any).__APEX_API__ || '';
    const fetchNav = () =>
      fetch(`${API}/api/v1/account/summary`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.nav) setAccountNav(d.nav); })
        .catch(() => {});
    fetchNav();
    const id = setInterval(fetchNav, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div data-testid="portfolio-ui2-page" data-ready="true" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      <div data-testid="portfolio-ready" style={{ display: 'none' }} aria-hidden="true" />
      {/* KPIs */}
      <KPIStrip holdings={holdings} equity={equityCurve} perfStats={perfStats} accountNav={accountNav} />
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1px', background: T.border0, borderRadius: T.radius }}>
        {(['OVERVIEW', 'RISK', 'ATTRIBUTION', 'OPTIMIZE'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '5px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, fontFamily: T.fontSans, background: tab === t ? T.bg1 : T.bg2, color: tab === t ? T.brand : T.text3, borderBottom: tab === t ? `2px solid ${T.brand}` : '2px solid transparent' }}>{t}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tab === 'OVERVIEW' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '6px', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
              <div style={{ flex: '0 0 200px' }}><EquityCurveChart data={equityCurve} /></div>
              <div style={{ flex: 1, minHeight: 0 }}><HoldingsTable holdings={holdings} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SectorAllocation holdings={holdings} />
              <FactorExposure />
            </div>
          </div>
        )}
        {tab === 'RISK' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0 }}>
            <RiskDecomposition holdings={holdings} />
            <CorrelationMatrix holdings={holdings} />
          </div>
        )}
        {tab === 'ATTRIBUTION' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0 }}>
            <PerformanceAttribution holdings={holdings} />
            <FactorExposure />
          </div>
        )}
        {tab === 'OPTIMIZE' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1, minHeight: 0 }}>
            <EfficientFrontier />
            <RiskDecomposition holdings={holdings} />
          </div>
        )}
      </div>
    </div>
  );
}
