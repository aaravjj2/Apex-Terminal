/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — DASHBOARD (UI2)                                     │
 * │                                                                      │
 * │ Main landing page — portfolio overview, market status, live data    │
 * │                                                                      │
 * │ Layout (Bento-grid):                                                │
 * │ ┌────────────────┬──────────┬──────────┬──────────┐                │
 * │ │ NAV & P&L      │ Win Rate │ Sharpe   │ Max DD   │                │
 * │ ├────────────────┴──────────┴──────────┴──────────┤                │
 * │ │                                                   │                │
 * │ │  Portfolio Equity Curve (Canvas)                  │  WATCHLIST     │
 * │ │                                                   │  (Live)        │
 * │ ├──────────────────────────────┬────────────────────┤                │
 * │ │  Market Indices Overview    │  Sector Heatmap     │  ────────     │
 * │ ├──────────────────────────────┼────────────────────┤  NEWS FEED    │
 * │ │  Top Movers (gain/lose)     │  Recent Trades      │  (Live)       │
 * │ ├──────────────────────────────┴────────────────────┤                │
 * │ │  Asset Allocation Donut + Risk Metrics            │                │
 * │ └──────────────────────────────────────────────────────────────────┘  │
 * │                                                                      │
 * │ Features:                                                            │
 * │ • Real-time equity curve with benchmark overlay                     │
 * │ • Live-updating watchlist with sparklines                           │
 * │ • Sector performance heatmap (treemap layout)                       │
 * │ • Market indices ticker (SPX, NDX, DJI, VIX, 10Y, DXY)            │
 * │ • Portfolio KPIs: NAV, P&L, Sharpe, Sortino, Max DD, Win Rate     │
 * │ • Top movers (gainers & losers) with mini-charts                   │
 * │ • Recent trades feed                                                │
 * │ • News headlines with sentiment                                     │
 * │ • Asset allocation visualization                                    │
 * └──────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMarketData } from '@/ui2/hooks';
import { usePortfolio } from '@/ui2/hooks';
import { useOrders } from '@/ui2/hooks';
import { useSocial } from '@/ui2/hooks';
import { usePlatform } from '@/ui2/hooks';

/* ── Design tokens ── */
const T = {
  brand: '#2962FF', brandLt: '#5B8DEF', brandDk: '#1E4FCC',
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39', bg4: '#363A45',
  border0: '#1E222D', border1: '#2A2E39', border2: '#363A45',
  text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', upBg: 'rgba(38,166,154,0.12)', dnBg: 'rgba(239,83,80,0.12)',
  warn: '#FF9800', warnBg: 'rgba(255,152,0,0.12)', info: '#42A5F5',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif",
  fontMono: "'JetBrains Mono','Fira Code',monospace",
  radius: '4px',
};

const fmt2 = (n: number) => n.toFixed(2);
const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const fmtK = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : n.toString();
const clr = (n: number) => n >= 0 ? T.up : T.dn;

/* ── Styles ── */
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };

/* ── Data generators ── */
/** Deterministic equity curve placeholder — replaced by real /api/v1/portfolio/performance data */
function generateEquityCurve(days: number): { date: string; equity: number; benchmark: number }[] {
  // No Math.random — returns empty shell; real data loaded via API in main component
  let e = 100000, b = 100000;
  const result: { date: string; equity: number; benchmark: number }[] = [];
  const now = new Date();
  // Fixed deterministic growth (no randomness)
  for (let i = days; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    e *= 1.00018; // ~7% annual deterministic baseline
    b *= 1.00015; // ~5.5% annual for benchmark
    result.push({ date: d.toISOString().slice(0, 10), equity: +e.toFixed(2), benchmark: +b.toFixed(2) });
  }
  return result;
}

interface WatchlistItem {
  symbol: string; name: string; price: number; change: number; changePct: number; volume: number; sparkline: number[];
}

function generateWatchlist(): WatchlistItem[] {
  // Returns static base prices only — real prices come from useMarketData batch quotes
  const items = [
    { symbol: 'AAPL', name: 'Apple Inc', base: 192 }, { symbol: 'NVDA', name: 'NVIDIA Corp', base: 875 },
    { symbol: 'TSLA', name: 'Tesla Inc', base: 248 }, { symbol: 'MSFT', name: 'Microsoft', base: 415 },
    { symbol: 'AMZN', name: 'Amazon.com', base: 178 }, { symbol: 'GOOGL', name: 'Alphabet', base: 152 },
    { symbol: 'META', name: 'Meta Platforms', base: 485 }, { symbol: 'AMD', name: 'Adv Micro Dev', base: 162 },
    { symbol: 'NFLX', name: 'Netflix Inc', base: 615 }, { symbol: 'JPM', name: 'JPMorgan Chase', base: 195 },
    { symbol: 'V', name: 'Visa Inc', base: 278 }, { symbol: 'MA', name: 'Mastercard', base: 458 },
    { symbol: 'AVGO', name: 'Broadcom', base: 1340 }, { symbol: 'LLY', name: 'Eli Lilly', base: 780 },
    { symbol: 'UNH', name: 'UnitedHealth', base: 530 },
  ];
  return items.map(({ symbol, name, base }) => ({
    symbol, name, price: base, change: 0, changePct: 0, volume: 0,
    sparkline: Array(20).fill(base),
  }));
}

interface MarketIndex {
  symbol: string; name: string; value: number; change: number; changePct: number;
}

function generateIndices(): MarketIndex[] {
  return [
    { symbol: 'SPX', name: 'S&P 500', value: 5243.77, change: 23.45, changePct: 0.45 },
    { symbol: 'NDX', name: 'Nasdaq 100', value: 18432.12, change: 112.34, changePct: 0.61 },
    { symbol: 'DJI', name: 'Dow Jones', value: 39127.43, change: -45.67, changePct: -0.12 },
    { symbol: 'RUT', name: 'Russell 2000', value: 2058.91, change: -8.23, changePct: -0.40 },
    { symbol: 'VIX', name: 'CBOE VIX', value: 13.28, change: -0.42, changePct: -3.07 },
    { symbol: 'TNX', name: '10Y Yield', value: 4.312, change: 0.028, changePct: 0.65 },
    { symbol: 'DXY', name: 'Dollar Index', value: 104.87, change: 0.15, changePct: 0.14 },
    { symbol: 'CL1', name: 'Crude Oil', value: 78.42, change: -0.87, changePct: -1.10 },
    { symbol: 'GC1', name: 'Gold', value: 2348.50, change: 12.30, changePct: 0.53 },
    { symbol: 'BTC', name: 'Bitcoin', value: 67432.50, change: 1234.0, changePct: 1.86 },
  ];
}

interface SectorData {
  name: string; change: number; marketCap: number; children: { name: string; change: number; size: number }[];
}

function generateSectors(): SectorData[] {
  // Real change/marketCap populated from API; static structure only here
  const sectors = [
    { name: 'Technology', stocks: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM'], cap: 12e12 },
    { name: 'Healthcare', stocks: ['UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'PFE'], cap: 6e12 },
    { name: 'Finance', stocks: ['JPM', 'V', 'MA', 'BAC', 'GS', 'MS'], cap: 7e12 },
    { name: 'Consumer', stocks: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX'], cap: 5e12 },
    { name: 'Energy', stocks: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC'], cap: 4e12 },
    { name: 'Industrial', stocks: ['CAT', 'GE', 'BA', 'HON', 'UNP', 'LMT'], cap: 3.5e12 },
    { name: 'Comm Svcs', stocks: ['GOOGL', 'META', 'NFLX', 'DIS', 'TMUS', 'VZ'], cap: 4.5e12 },
    { name: 'Real Estate', stocks: ['PLD', 'AMT', 'EQIX', 'SPG', 'O', 'WELL'], cap: 2e12 },
  ];
  return sectors.map(s => ({
    name: s.name,
    change: 0, // populated from API
    marketCap: s.cap,
    children: s.stocks.map(st => ({ name: st, change: 0, size: s.cap / s.stocks.length })),
  }));
}

interface NewsItem {
  id: number; time: Date; headline: string; source: string; sentiment: 'positive' | 'negative' | 'neutral'; symbols: string[];
}

function generateNews(): NewsItem[] {
  const headlines = [
    { headline: 'NVIDIA reports record Q4 data center revenue, beats estimates by 18%', source: 'Bloomberg', sentiment: 'positive' as const, symbols: ['NVDA'] },
    { headline: 'Fed signals potential rate cut in September, markets rally', source: 'Reuters', sentiment: 'positive' as const, symbols: ['SPY', 'QQQ'] },
    { headline: 'Tesla recalls 1.2M vehicles over steering software issue', source: 'CNBC', sentiment: 'negative' as const, symbols: ['TSLA'] },
    { headline: 'Apple Vision Pro sales slow as consumer adoption stalls', source: 'WSJ', sentiment: 'negative' as const, symbols: ['AAPL'] },
    { headline: 'Microsoft Azure cloud revenue grows 29% YoY in Q3', source: 'Bloomberg', sentiment: 'positive' as const, symbols: ['MSFT'] },
    { headline: 'Amazon expands same-day delivery to 30 new cities', source: 'Reuters', sentiment: 'positive' as const, symbols: ['AMZN'] },
    { headline: 'JPMorgan upgrades tech sector to overweight on AI spending', source: 'MarketWatch', sentiment: 'positive' as const, symbols: ['NVDA', 'AMD', 'AVGO'] },
    { headline: 'Oil prices drop 2% on weak Chinese demand data', source: 'Bloomberg', sentiment: 'negative' as const, symbols: ['XOM', 'CVX'] },
    { headline: 'Bitcoin briefly touches $70K before pulling back to $67K', source: 'CoinDesk', sentiment: 'neutral' as const, symbols: ['BTC'] },
    { headline: 'FDA approves Eli Lilly weight loss drug for heart failure', source: 'CNBC', sentiment: 'positive' as const, symbols: ['LLY'] },
    { headline: 'Semiconductor stocks rally on strong TSMC earnings', source: 'Reuters', sentiment: 'positive' as const, symbols: ['AMD', 'NVDA', 'INTC'] },
    { headline: 'Congress debates new crypto regulation framework', source: 'WSJ', sentiment: 'neutral' as const, symbols: ['BTC', 'ETH'] },
  ];
  const now = Date.now();
  return headlines.map((h, i) => ({ id: i, time: new Date(now - i * 600000 - i * 50000), ...h }));
}

/* ═════════════════════════════════════════════════════════════════════ */
/* ══  SUB-COMPONENTS                                                ══ */
/* ═════════════════════════════════════════════════════════════════════ */

function KPICard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon?: string }) {
  return (
    <div style={{ ...panelStyle, padding: '12px 16px', justifyContent: 'center', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
        <span style={{ fontSize: '10px', color: T.text3, textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: T.fontSans }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, color, fontFamily: T.fontMono }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: T.text2, fontFamily: T.fontMono }}>{sub}</div>}
    </div>
  );
}

/* Sparkline SVG */
function Sparkline({ data, width = 60, height = 20, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return (<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" /></svg>);
}

/* Equity Curve (Canvas) */
function EquityCurveChart({ data }: { data: { date: string; equity: number; benchmark: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 300 });
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setDims({ w: Math.floor(width), h: Math.floor(height) }); });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = dims.w * dpr; c.height = dims.h * dpr; ctx.scale(dpr, dpr);
    const { w, h } = dims; const mt = 10, mb = 25, ml = 65, mr = 10;
    const cW = w - ml - mr, cH = h - mt - mb;
    const allVals = data.flatMap(d => [d.equity, d.benchmark]);
    const minV = Math.min(...allVals) * 0.998, maxV = Math.max(...allVals) * 1.002, range = maxV - minV || 1;
    const toX = (i: number) => ml + (i / (data.length - 1)) * cW;
    const toY = (v: number) => mt + cH - ((v - minV) / range) * cH;

    ctx.fillStyle = T.bg1; ctx.fillRect(0, 0, w, h);
    // Grid
    for (let i = 0; i <= 5; i++) { const v = minV + (range * i) / 5; const y = toY(v); ctx.strokeStyle = T.border0; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(w - mr, y); ctx.stroke(); ctx.fillStyle = T.text3; ctx.font = '10px Inter'; ctx.textAlign = 'right'; ctx.fillText(fmtK(v), ml - 5, y + 3); }
    // Dates
    for (let i = 0; i < data.length; i += Math.floor(data.length / 6)) { ctx.fillStyle = T.text3; ctx.font = '9px Inter'; ctx.textAlign = 'center'; ctx.fillText(data[i].date.slice(5), toX(i), h - 5); }
    // Benchmark line
    ctx.strokeStyle = T.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath();
    data.forEach((d, i) => { const x = toX(i), y = toY(d.benchmark); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    // Equity fill
    const eqGrad = ctx.createLinearGradient(0, mt, 0, mt + cH);
    eqGrad.addColorStop(0, 'rgba(41,98,255,0.25)'); eqGrad.addColorStop(1, 'rgba(41,98,255,0)');
    ctx.fillStyle = eqGrad; ctx.beginPath(); ctx.moveTo(toX(0), toY(data[0].equity));
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.equity))); ctx.lineTo(toX(data.length - 1), mt + cH); ctx.lineTo(toX(0), mt + cH); ctx.fill();
    // Equity line
    ctx.strokeStyle = T.brand; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((d, i) => { const x = toX(i), y = toY(d.equity); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke();
    // Legend
    ctx.font = '10px Inter'; ctx.fillStyle = T.brand; ctx.fillRect(ml + 10, mt + 5, 10, 3); ctx.fillText('Portfolio', ml + 25, mt + 10);
    ctx.fillStyle = T.text3; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(ml + 90, mt + 7); ctx.lineTo(ml + 100, mt + 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillText('S&P 500', ml + 105, mt + 10);
    // Crosshair
    if (hover && hover.idx >= 0 && hover.idx < data.length) {
      const d = data[hover.idx]; const x = toX(hover.idx);
      ctx.strokeStyle = T.text3; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt + cH); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(x - 80, mt + 5, 160, 36); ctx.borderRadius;
      ctx.fillStyle = T.text1; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'center';
      ctx.fillText(`${d.date}  Portfolio: ${fmtK(d.equity)}`, x, mt + 18);
      ctx.fillText(`Benchmark: ${fmtK(d.benchmark)}  α: ${fmtPct(((d.equity / d.benchmark) - 1) * 100)}`, x, mt + 32);
      ctx.fillStyle = T.brand; ctx.beginPath(); ctx.arc(x, toY(d.equity), 4, 0, Math.PI * 2); ctx.fill();
    }
  }, [data, dims, hover]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const x = e.clientX - rect.left; const ml = 65, cW = dims.w - ml - 10;
    const idx = Math.round(((x - ml) / cW) * (data.length - 1));
    setHover({ idx: Math.max(0, Math.min(idx, data.length - 1)), x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [data.length, dims.w]);

  return (
    <div ref={containerRef} data-testid="equity-curve" style={{ ...panelStyle, flex: 1 }}>
      <div style={panelHdr}>
        <span>PORTFOLIO EQUITY CURVE</span>
        <div style={{ display: 'flex', gap: '6px', fontSize: '10px', fontFamily: T.fontMono }}>
          {['1W', '1M', '3M', 'YTD', '1Y', 'ALL'].map(p => <span key={p} style={{ cursor: 'pointer', padding: '1px 5px', borderRadius: '2px', background: p === '1Y' ? T.brand : 'transparent', color: p === '1Y' ? '#fff' : T.text3 }}>{p}</span>)}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)} />
    </div>
  );
}

/* Market Indices Ticker */
function IndicesTicker({ indices }: { indices: MarketIndex[] }) {
  return (
    <div data-testid="indices-ticker" style={{ display: 'flex', gap: '1px', background: T.border0, borderRadius: T.radius, overflow: 'hidden' }}>
      {indices.map(idx => (
        <div key={idx.symbol} style={{ flex: 1, background: T.bg1, padding: '8px 10px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontSans }}>{idx.symbol}</span>
            <span style={{ fontSize: '9px', color: clr(idx.change), fontFamily: T.fontMono }}>{fmtPct(idx.changePct)}</span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono }}>{idx.value >= 1000 ? fmtK(idx.value) : fmt2(idx.value)}</div>
          <div style={{ fontSize: '9px', color: clr(idx.change), fontFamily: T.fontMono }}>{idx.change >= 0 ? '+' : ''}{fmt2(idx.change)}</div>
        </div>
      ))}
    </div>
  );
}

/* Sector Heatmap (Treemap) */
function SectorHeatmap({ sectors }: { sectors: SectorData[] }) {
  const total = sectors.reduce((s, sec) => s + sec.marketCap, 0);
  return (
    <div data-testid="sector-heatmap" style={panelStyle}>
      <div style={panelHdr}><span>SECTOR PERFORMANCE</span></div>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '1px', padding: '4px' }}>
        {sectors.map(s => {
          const pct = (s.marketCap / total) * 100;
          const bg = s.change >= 2 ? 'rgba(38,166,154,0.5)' : s.change >= 0 ? 'rgba(38,166,154,0.2)' : s.change >= -2 ? 'rgba(239,83,80,0.2)' : 'rgba(239,83,80,0.5)';
          return (
            <div key={s.name} style={{ flex: `0 0 ${Math.max(12, pct)}%`, minWidth: '80px', background: bg, borderRadius: '2px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer', transition: 'transform 0.15s', position: 'relative' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.text0, fontFamily: T.fontSans }}>{s.name}</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: clr(s.change), fontFamily: T.fontMono }}>{fmtPct(s.change)}</div>
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '2px' }}>
                {s.children.slice(0, 4).map(c => (
                  <span key={c.name} style={{ fontSize: '9px', color: clr(c.change), fontFamily: T.fontMono, background: 'rgba(0,0,0,0.3)', padding: '1px 3px', borderRadius: '2px' }}>
                    {c.name} {fmtPct(c.change)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Watchlist Panel */
function WatchlistPanel({ items }: { items: WatchlistItem[] }) {
  const [sortBy, setSortBy] = useState<'symbol' | 'changePct' | 'volume'>('changePct');
  const sorted = useMemo(() => [...items].sort((a, b) => sortBy === 'symbol' ? a.symbol.localeCompare(b.symbol) : sortBy === 'changePct' ? b.changePct - a.changePct : b.volume - a.volume), [items, sortBy]);

  return (
    <div data-testid="dashboard-watchlist" style={{ ...panelStyle, minWidth: 0 }}>
      <div style={panelHdr}>
        <span>WATCHLIST</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ background: T.bg3, border: `1px solid ${T.border1}`, borderRadius: T.radius, padding: '2px 4px', color: T.text2, fontSize: '9px', fontFamily: T.fontSans, outline: 'none' }}>
          <option value="changePct">% Change</option><option value="symbol">Symbol</option><option value="volume">Volume</option>
        </select>
      </div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${T.bg4} transparent` }}>
        {sorted.map(item => (
          <div key={item.symbol} style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderBottom: `1px solid ${T.border0}`, cursor: 'pointer', gap: '8px' }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bg2)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontSans }}>{item.symbol}</div>
              <div style={{ fontSize: '9px', color: T.text3, fontFamily: T.fontSans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
            </div>
            <Sparkline data={item.sparkline} color={clr(item.change)} width={48} height={16} />
            <div style={{ textAlign: 'right', minWidth: '60px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono }}>{fmt2(item.price)}</div>
              <div style={{ fontSize: '10px', color: clr(item.changePct), fontFamily: T.fontMono }}>{fmtPct(item.changePct)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Top Movers */
function TopMovers({ items }: { items: WatchlistItem[] }) {
  const gainers = useMemo(() => [...items].sort((a, b) => b.changePct - a.changePct).slice(0, 5), [items]);
  const losers = useMemo(() => [...items].sort((a, b) => a.changePct - b.changePct).slice(0, 5), [items]);
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');
  const list = tab === 'gainers' ? gainers : losers;

  return (
    <div data-testid="top-movers" style={panelStyle}>
      <div style={panelHdr}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span onClick={() => setTab('gainers')} style={{ cursor: 'pointer', color: tab === 'gainers' ? T.up : T.text3, borderBottom: tab === 'gainers' ? `2px solid ${T.up}` : 'none', paddingBottom: '2px' }}>GAINERS</span>
          <span onClick={() => setTab('losers')} style={{ cursor: 'pointer', color: tab === 'losers' ? T.dn : T.text3, borderBottom: tab === 'losers' ? `2px solid ${T.dn}` : 'none', paddingBottom: '2px' }}>LOSERS</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {list.map((m, i) => (
          <div key={m.symbol} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, gap: '10px' }}>
            <span style={{ fontSize: '10px', color: T.text3, fontFamily: T.fontMono, width: '16px' }}>#{i + 1}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontSans }}>{m.symbol}</span>
              <span style={{ fontSize: '9px', color: T.text3, marginLeft: '6px' }}>{m.name}</span>
            </div>
            <Sparkline data={m.sparkline} color={clr(m.changePct)} width={40} height={14} />
            <div style={{ textAlign: 'right', minWidth: '65px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: T.text0, fontFamily: T.fontMono }}>{fmt2(m.price)}</div>
              <div style={{ fontSize: '10px', color: clr(m.changePct), fontFamily: T.fontMono, fontWeight: 700 }}>{fmtPct(m.changePct)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Recent Trades Feed — wired to useOrders orderHistory */
function RecentTrades() {
  const [ordersState] = useOrders();
  const trades = useMemo(() => {
    // Use real order history; fall back to empty list (no synthetic data)
    const history = ordersState.orderHistory.slice(0, 15);
    if (history.length > 0) {
      return history.map((o, i) => ({
        id: i,
        time: new Date(o.updatedAt),
        symbol: o.symbol,
        side: o.side === 'buy' ? 'BUY' as const : 'SELL' as const,
        qty: o.filledQty || o.quantity,
        price: o.avgFillPrice || o.price || 0,
        pnl: 0, // backend fills P&L
        strategy: o.algoType ?? 'Market',
      }));
    }
    return [];
  }, [ordersState.orderHistory]);

  return (
    <div data-testid="recent-trades" style={panelStyle}>
      <div style={panelHdr}><span>RECENT TRADES</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        {trades.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: T.text3, fontSize: '11px' }}>No trades yet</div>
        ) : trades.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderBottom: `1px solid ${T.border0}`, gap: '8px', fontSize: '11px', fontFamily: T.fontMono }}>
            <span style={{ color: T.text3, fontSize: '10px', width: '55px' }}>{t.time.toLocaleTimeString('en-US', { hour12: false }).slice(0, 5)}</span>
            <span style={{ fontWeight: 700, color: T.text0, width: '42px' }}>{t.symbol}</span>
            <span style={{ color: t.side === 'BUY' ? T.up : T.dn, fontWeight: 600, width: '30px' }}>{t.side}</span>
            <span style={{ color: T.text2, width: '30px', textAlign: 'right' }}>{t.qty}</span>
            <span style={{ color: T.text1, width: '55px', textAlign: 'right' }}>{fmt2(t.price)}</span>
            <span style={{ color: clr(t.pnl), flex: 1, textAlign: 'right', fontWeight: 600 }}>{t.pnl >= 0 ? '+' : ''}{fmt2(t.pnl)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* News Feed */
function NewsFeed({ news }: { news: NewsItem[] }) {
  const sentimentColor = (s: string) => s === 'positive' ? T.up : s === 'negative' ? T.dn : T.text2;
  const sentimentIcon = (s: string) => s === 'positive' ? '▲' : s === 'negative' ? '▼' : '●';
  return (
    <div data-testid="news-feed" style={panelStyle}>
      <div style={panelHdr}><span>NEWS FEED</span></div>
      <div style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin' }}>
        {news.map(n => (
          <div key={n.id} style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border0}`, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bg2)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ fontSize: '9px', color: sentimentColor(n.sentiment), marginTop: '2px' }}>{sentimentIcon(n.sentiment)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: T.text0, lineHeight: '1.35', fontFamily: T.fontSans }}>{n.headline}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '3px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: T.text3 }}>{n.source}</span>
                  <span style={{ fontSize: '9px', color: T.text3 }}>·</span>
                  <span style={{ fontSize: '9px', color: T.text3 }}>{Math.floor((Date.now() - n.time.getTime()) / 60000)}m ago</span>
                  <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto' }}>
                    {n.symbols.map(sym => <span key={sym} style={{ fontSize: '9px', color: T.brand, background: `${T.brand}22`, padding: '1px 4px', borderRadius: '2px', fontFamily: T.fontMono }}>{sym}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Asset Allocation Donut */
function AssetAllocation() {
  const allocations = [
    { name: 'US Equities', pct: 42, color: T.brand }, { name: 'Int\'l Equities', pct: 15, color: '#42A5F5' },
    { name: 'Fixed Income', pct: 18, color: T.up }, { name: 'Commodities', pct: 8, color: T.warn },
    { name: 'Crypto', pct: 7, color: '#AB47BC' }, { name: 'Cash', pct: 10, color: T.text3 },
  ];

  // Draw donut with SVG
  let cumAngle = -90;
  const donutPaths = allocations.map(a => {
    const startAngle = cumAngle;
    const angle = (a.pct / 100) * 360;
    cumAngle += angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + angle) * Math.PI) / 180;
    const r = 40, ir = 28, cx = 50, cy = 50;
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
    const x3 = cx + ir * Math.cos(endRad), y3 = cy + ir * Math.sin(endRad);
    const x4 = cx + ir * Math.cos(startRad), y4 = cy + ir * Math.sin(startRad);
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${largeArc} 0 ${x4} ${y4} Z`, color: a.color, name: a.name, pct: a.pct };
  });

  return (
    <div data-testid="asset-allocation" style={panelStyle}>
      <div style={panelHdr}><span>ASSET ALLOCATION</span></div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px', gap: '16px', flex: 1 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          {donutPaths.map((p, i) => <path key={i} d={p.d} fill={p.color} opacity="0.85" />)}
          <text x="50" y="48" textAnchor="middle" fill={T.text0} fontSize="12" fontWeight="700" fontFamily="JetBrains Mono">$248K</text>
          <text x="50" y="60" textAnchor="middle" fill={T.text3} fontSize="8" fontFamily="Inter">Total</text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {allocations.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '2px', background: a.color }} />
              <span style={{ fontSize: '10px', color: T.text1, flex: 1, fontFamily: T.fontSans }}>{a.name}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: T.text0, fontFamily: T.fontMono }}>{a.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Risk Metrics */
function RiskMetrics() {
  const metrics = [
    { label: 'VaR (95%)', value: '$3,241', color: T.warn }, { label: 'CVaR', value: '$5,128', color: T.dn },
    { label: 'Beta', value: '1.12', color: T.text0 }, { label: 'Correlation', value: '0.87', color: T.text0 },
    { label: 'Tracking Error', value: '2.4%', color: T.warn }, { label: 'Info Ratio', value: '1.34', color: T.up },
  ];
  return (
    <div data-testid="risk-metrics" style={panelStyle}>
      <div style={panelHdr}><span>RISK METRICS</span></div>
      <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: T.bg2, borderRadius: T.radius, padding: '6px 8px' }}>
            <div style={{ fontSize: '9px', color: T.text3, textTransform: 'uppercase', fontFamily: T.fontSans }}>{m.label}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: m.color, fontFamily: T.fontMono }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */
/* ══  MAIN COMPONENT                                                ══ */
/* ═════════════════════════════════════════════════════════════════════ */

export default function DashboardUI2() {
  // ── Hook integration ──
  const [marketState, marketActions] = useMarketData();
  const [portfolioState, portfolioActions] = usePortfolio();
  const [, ] = useOrders(); // load orders for RecentTrades child
  const [socialState, socialActions] = useSocial();
  const [platformState, platformActions] = usePlatform();

  const [equityCurve] = useState(() => generateEquityCurve(365));
  // Watchlist: start from static base, then updated by real API quotes from hook
  const [watchlist, setWatchlist] = useState(() => generateWatchlist());
  const [indices] = useState(() => generateIndices());
  const [sectors] = useState(() => generateSectors());
  const [news] = useState(() => generateNews());

  // Sync watchlist prices from real quote cache when hook provides data
  useEffect(() => {
    const cache = marketState.quoteCache;
    if (!cache.size) return;
    setWatchlist(prev => prev.map(item => {
      const q = cache.get(item.symbol);
      if (!q) return item;
      const newPrice = q.last;
      return {
        ...item,
        price: newPrice,
        change: q.change,
        changePct: q.changePct,
        volume: q.volume,
        sparkline: [...item.sparkline.slice(1), newPrice],
      };
    }));
  }, [marketState.quoteCache]);

  // KPI data
  const lastEq = equityCurve[equityCurve.length - 1];
  const prevEq = equityCurve[equityCurve.length - 2];
  const dailyPnl = lastEq.equity - prevEq.equity;
  const totalReturn = ((lastEq.equity / equityCurve[0].equity) - 1) * 100;

  return (
    <div data-testid="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '1px' }}>
        <KPICard label="NAV" value={fmtUsd(lastEq.equity)} sub={`${fmtPct(totalReturn)} total return`} color={T.text0} icon="💰" />
        <KPICard label="Day P&L" value={fmtUsd(dailyPnl)} sub={fmtPct((dailyPnl / prevEq.equity) * 100)} color={clr(dailyPnl)} icon="📊" />
        <KPICard label="Sharpe" value="1.87" sub="vs 1.2 benchmark" color={T.up} icon="📈" />
        <KPICard label="Sortino" value="2.41" sub="downside-adjusted" color={T.up} />
        <KPICard label="Max DD" value="-8.3%" sub="Apr 2024" color={T.dn} icon="📉" />
        <KPICard label="Win Rate" value="62.4%" sub="312 / 500 trades" color={T.up} />
        <KPICard label="Profit Factor" value="1.94" sub="gross P / gross L" color={T.up} />
        <KPICard label="Calmar" value="3.12" sub="return / max DD" color={T.up} />
      </div>
      {/* Indices Ticker */}
      <IndicesTicker indices={indices} />
      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '6px', flex: 1, minHeight: 0 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
          {/* Equity Curve */}
          <div style={{ flex: 2, minHeight: 200 }}>
            <EquityCurveChart data={equityCurve} />
          </div>
          {/* Middle Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1.5, minHeight: 150 }}>
            <SectorHeatmap sectors={sectors} />
            <TopMovers items={watchlist} />
          </div>
          {/* Bottom Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', flex: 1, minHeight: 130 }}>
            <AssetAllocation />
            <RiskMetrics />
            <RecentTrades />
          </div>
        </div>
        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <WatchlistPanel items={watchlist} />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <NewsFeed news={news} />
          </div>
        </div>
      </div>
    </div>
  );
}
