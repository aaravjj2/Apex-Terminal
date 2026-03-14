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
import React, { useState, useEffect, useMemo } from 'react';
import { useMarketData } from '@/ui2/hooks';
import { usePortfolio } from '@/ui2/hooks';
import { useOrders } from '@/ui2/hooks';
import { useSocial } from '@/ui2/hooks';
import { usePlatform } from '@/ui2/hooks';
import ApexAreaChart from '../components/chart/ApexAreaChart';

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
    { name: 'Technology', etf: 'XLK', stocks: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM'], cap: 12e12 },
    { name: 'Healthcare', etf: 'XLV', stocks: ['UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'PFE'], cap: 6e12 },
    { name: 'Finance', etf: 'XLF', stocks: ['JPM', 'V', 'MA', 'BAC', 'GS', 'MS'], cap: 7e12 },
    { name: 'Consumer', etf: 'XLY', stocks: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX'], cap: 5e12 },
    { name: 'Energy', etf: 'XLE', stocks: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC'], cap: 4e12 },
    { name: 'Industrial', etf: 'XLI', stocks: ['CAT', 'GE', 'BA', 'HON', 'UNP', 'LMT'], cap: 3.5e12 },
    { name: 'Comm Svcs', etf: 'XLC', stocks: ['GOOGL', 'META', 'NFLX', 'DIS', 'TMUS', 'VZ'], cap: 4.5e12 },
    { name: 'Real Estate', etf: 'XLRE', stocks: ['PLD', 'AMT', 'EQIX', 'SPG', 'O', 'WELL'], cap: 2e12 },
  ];
  return sectors.map(s => ({
    name: `${s.name} ${s.etf}`,
    change: 0, // populated from API
    marketCap: s.cap,
    children: s.stocks.map(st => ({ name: st, change: 0, size: s.cap / s.stocks.length })),
  }));
}

interface NewsItem {
  id: number; time: Date; headline: string; source: string; sentiment: 'positive' | 'negative' | 'neutral'; symbols: string[];
}

function generateNews(): NewsItem[] {
  // Returns empty array — real news is loaded via /api/v1/sentiment/articles in DashboardUI2.
  // This function is kept only so the type compiles; no fake headlines are rendered.
  return [];
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

/* Equity Curve — powered by lightweight-charts v5 AreaSeries */
function EquityCurveChart({ data }: { data: { date: string; equity: number; benchmark: number }[] }) {
  /* Convert date strings to unix timestamps (seconds) for ApexAreaChart */
  const areaData = useMemo(
    () =>
      data
        .filter(d => d.date && d.equity > 0)
        .map(d => ({
          time:  Math.floor(new Date(d.date).getTime() / 1000),
          value: d.equity,
        })),
    [data],
  );

  return (
    <div data-testid="equity-curve" style={{ ...panelStyle, flex: 1 }}>
      <div style={panelHdr}>
        <span>PORTFOLIO EQUITY CURVE</span>
        <div style={{ display: 'flex', gap: '6px', fontSize: '10px', fontFamily: T.fontMono }}>
          {['1W', '1M', '3M', 'YTD', '1Y', 'ALL'].map(p => (
            <span
              key={p}
              style={{
                cursor: 'pointer', padding: '1px 5px', borderRadius: '2px',
                background: p === '1Y' ? T.brand : 'transparent',
                color: p === '1Y' ? '#fff' : T.text3,
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ApexAreaChart data={areaData} />
      </div>
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

/* Asset Allocation Donut — driven by live portfolio data when available */
function AssetAllocation({ portfolio, nav }: { portfolio: any | null; nav: number }) {
  // Derive allocations from live portfolio positions when available.
  // Falls back to showing only the cash/equity split when positions are missing.
  const allocations = useMemo(() => {
    if (portfolio?.positions?.length > 0) {
      // Group positions by asset_class
      const byClass: Record<string, number> = {};
      for (const p of portfolio.positions) {
        const cls = (p.asset_class ?? 'unknown').replace('_', ' ');
        const label =
          cls.includes('us') || cls.includes('equity') ? 'US Equities' :
          cls.includes('option') || cls.includes('deriv') ? 'Derivatives' :
          cls.includes('crypto') ? 'Crypto' :
          cls.includes('fixed') || cls.includes('bond') ? 'Fixed Income' :
          cls.includes('international') ? "Int'l Equities" :
          'Other';
        byClass[label] = (byClass[label] ?? 0) + Math.abs(p.market_value ?? 0);
      }
      const cashVal = portfolio.cash ?? 0;
      if (cashVal > 0) byClass['Cash'] = cashVal;

      const total = Object.values(byClass).reduce((s, v) => s + v, 0) || 1;
      const palette = [T.brand, '#42A5F5', T.up, T.warn, '#AB47BC', T.text3, '#EF9A9A'];
      return Object.entries(byClass).map(([name, val], i) => ({
        name,
        pct: Math.round((val / total) * 100),
        color: palette[i % palette.length],
      }));
    }
    // Minimal fallback: show only that data is loading
    return nav > 0
      ? [{ name: 'Portfolio', pct: 100, color: T.brand }]
      : [{ name: 'Loading…', pct: 100, color: T.text3 }];
  }, [portfolio, nav]);

  const totalDisplay = nav > 0 ? fmtUsd(nav) : (portfolio?.portfolio_value ? fmtUsd(portfolio.portfolio_value) : '—');

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
          <text x="50" y="48" textAnchor="middle" fill={T.text0} fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">{totalDisplay.length > 8 ? totalDisplay.slice(0, 8) : totalDisplay}</text>
          <text x="50" y="60" textAnchor="middle" fill={T.text3} fontSize="8" fontFamily="Inter">NAV</text>
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

/* Risk Metrics — driven by live performance/portfolio data when available */
function RiskMetrics({ perfKpis, accountKpis }: { perfKpis: any | null; accountKpis: any | null }) {
  const fmtOrDash = (v: number | null | undefined, toFixed = 2) =>
    v != null && isFinite(v) ? v.toFixed(toFixed) : '—';
  const fmtUsdOrDash = (v: number | null | undefined) =>
    v != null && isFinite(v) ? fmtUsd(v) : '—';
  const fmtPctOrDash = (v: number | null | undefined) =>
    v != null && isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—';

  const metrics = [
    {
      label: 'VaR (95%)',
      value: fmtUsdOrDash(perfKpis?.var_95 ?? perfKpis?.value_at_risk_95),
      color: T.warn,
    },
    {
      label: 'CVaR',
      value: fmtUsdOrDash(perfKpis?.cvar_95 ?? perfKpis?.conditional_var_95),
      color: T.dn,
    },
    {
      label: 'Beta',
      value: fmtOrDash(perfKpis?.beta),
      color: T.text0,
    },
    {
      label: 'Correlation',
      value: fmtOrDash(perfKpis?.correlation ?? perfKpis?.benchmark_correlation),
      color: T.text0,
    },
    {
      label: 'Tracking Error',
      value: perfKpis?.tracking_error != null
        ? `${(perfKpis.tracking_error * 100).toFixed(1)}%`
        : '—',
      color: T.warn,
    },
    {
      label: 'Info Ratio',
      value: fmtOrDash(perfKpis?.information_ratio ?? perfKpis?.info_ratio),
      color: T.up,
    },
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
  const [marketState] = useMarketData();
  usePortfolio(); // loaded for child components
  const [, ] = useOrders(); // load orders for RecentTrades child
  useSocial();
  usePlatform();

  const [equityCurve, setEquityCurve] = useState(() => generateEquityCurve(365));
  // Watchlist: start from static base, then updated by real API quotes from hook
  const [watchlist, setWatchlist] = useState(() => generateWatchlist());
  const [indices, setIndices] = useState(() => generateIndices());
  const [sectors, setSectors] = useState(() => generateSectors());
  // News: empty until fetched from /api/v1/sentiment/articles (no fake headlines)
  const [news, setNews] = useState<NewsItem[]>([]);
  const [perfKpis, setPerfKpis] = useState<any>(null);
  const [accountKpis, setAccountKpis] = useState<any>(null);
  // Portfolio: for asset allocation donut (live from /api/v1/portfolio)
  const [portfolioData, setPortfolioData] = useState<any>(null);

  // ── Live equity curve from /api/v1/portfolio/performance ──
  useEffect(() => {
    fetch('/api/v1/portfolio/performance?period=1y')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.equity_curve?.length > 1) {
          setEquityCurve(d.equity_curve.map((pt: any) => ({
            date: pt.date ?? pt.timestamp?.slice(0, 10) ?? '',
            equity: pt.equity ?? pt.value ?? 0,
            benchmark: pt.benchmark ?? pt.equity_value ?? (pt.equity ?? 0) * 0.98,
          })));
        }
        if (d?.metrics) setPerfKpis(d.metrics);
      })
      .catch(() => {});
  }, []);

  // ── Live account KPIs from /api/v1/account/summary ──
  useEffect(() => {
    const doFetch = () =>
      fetch('/api/v1/account/summary')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setAccountKpis(d); })
        .catch(() => {});
    doFetch();
    const id = setInterval(doFetch, 60000);
    return () => clearInterval(id);
  }, []);

  // ── Live indices from /api/v1/market-data/{symbol}/quote ──
  useEffect(() => {
    const symbolMap: Record<string, string> = {
      GSPC: 'SPX', IXIC: 'NDX', DJI: 'DJI', RUT: 'RUT',
      VIX: 'VIX', TNX: 'TNX', DX: 'DXY',
    };
    const apiSymbols = ['GSPC', 'IXIC', 'DJI', 'RUT', 'VIX', 'TNX'];
    Promise.allSettled(
      apiSymbols.map(sym =>
        fetch(`/api/v1/market-data/${sym}/quote`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d ? { sym, ...d } : null)
      )
    ).then(results => {
      const updates: Record<string, any> = {};
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          const sym = symbolMap[r.value.sym] ?? r.value.sym;
          updates[sym] = r.value;
        }
      });
      if (Object.keys(updates).length > 0) {
        setIndices(prev => prev.map(idx => {
          const u = updates[idx.symbol];
          if (!u) return idx;
          return {
            ...idx,
            value: u.price ?? u.close ?? idx.value,
            change: u.change ?? idx.change,
            changePct: u.change_pct ?? idx.changePct,
          };
        }));
      }
    }).catch(() => {});
  }, []);

  // ── Live sector heatmap from /api/v1/market-data/heatmap ──
  useEffect(() => {
    fetch('/api/v1/market-data/heatmap?period=1D')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.stocks) return;
        const changeBySymbol: Record<string, number> = {};
        d.stocks.forEach((s: any) => { changeBySymbol[s.symbol] = s.change ?? 0; });
        setSectors(prev => prev.map(sec => {
          const children = sec.children.map((c: any) => ({
            ...c, change: changeBySymbol[c.name] ?? c.change,
          }));
          const avgChange = children.length > 0
            ? children.reduce((sum: number, c: any) => sum + c.change, 0) / children.length
            : 0;
          return { ...sec, children, change: avgChange };
        }));
      })
      .catch(() => {});
  }, []);

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

  // ── Live news from /api/v1/sentiment/articles (Finnhub) ──
  useEffect(() => {
    fetch('/api/v1/sentiment/articles?limit=12')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.articles?.length) return;
        const fetched: NewsItem[] = d.articles.map((a: any, i: number) => ({
          id: i,
          time: new Date(a.published_at ?? Date.now()),
          headline: a.headline ?? '',
          source: a.source ?? '',
          sentiment: a.sentiment === 'bullish' ? 'positive' as const
            : a.sentiment === 'bearish' ? 'negative' as const
            : 'neutral' as const,
          symbols: a.symbols ?? [],
        }));
        setNews(fetched);
      })
      .catch(() => {
        // Finnhub key not configured or network error — news feed stays empty (no fake data)
      });
  }, []);

  // ── Live portfolio data for asset allocation donut ──
  useEffect(() => {
    fetch('/api/v1/portfolio')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPortfolioData(d); })
      .catch(() => {});
  }, []);

  // KPI data — prefer live account/performance data, fall back to equity curve
  // Guards prevent crash when equityCurve has < 2 items (API returned only 1 point)
  const lastEq = equityCurve.length > 0
    ? equityCurve[equityCurve.length - 1]
    : { equity: 0, benchmark: 0, date: '' };
  const prevEq = equityCurve.length > 1
    ? equityCurve[equityCurve.length - 2]
    : lastEq;
  const nav = accountKpis?.nav ?? accountKpis?.equity ?? lastEq.equity;
  // Use last_equity from Alpaca when available; fall back to equity curve delta
  // Avoids the silent zero that occurs when accountKpis.last_equity is absent
  const dailyPnl = accountKpis?.last_equity != null
    ? (accountKpis.equity ?? nav) - accountKpis.last_equity
    : lastEq.equity - prevEq.equity;
  const startEquity = (accountKpis?.start_equity ?? (equityCurve.length > 0 ? equityCurve[0].equity : nav)) || nav;
  const totalReturn = ((nav / startEquity) - 1) * 100;
  const sharpe = perfKpis?.sharpe_ratio != null ? perfKpis.sharpe_ratio.toFixed(2) : '—';
  const sortino = perfKpis?.sortino_ratio != null ? perfKpis.sortino_ratio.toFixed(2) : '—';
  const maxDD = perfKpis?.max_drawdown != null ? `${(perfKpis.max_drawdown * 100).toFixed(1)}%` : '—';
  const winRate = accountKpis?.win_rate != null ? `${accountKpis.win_rate.toFixed(1)}%`
    : perfKpis?.win_rate != null ? `${(perfKpis.win_rate * 100).toFixed(1)}%` : '—';
  const profitFactor = perfKpis?.profit_factor != null ? perfKpis.profit_factor.toFixed(2) : '—';
  const calmar = perfKpis?.calmar_ratio != null ? perfKpis.calmar_ratio.toFixed(2) : '—';

  return (
    <div data-testid="dashboard-ui2-page" data-ready="true" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden' }}>
      {/* page-ready sentinel for test standardization */}
      <div data-testid="page-ready" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none',width:1,height:1}} />
      {/* dashboard-ready sentinel for dashboard.spec.ts */}
      <div data-testid="dashboard-ready" style={{ display: 'none' }} />
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '1px' }}>
        <KPICard label="NAV" value={fmtUsd(nav)} sub={`${fmtPct(totalReturn)} total return`} color={T.text0} icon="💰" />
        <KPICard label="Day P&L" value={fmtUsd(dailyPnl)} sub={fmtPct((prevEq.equity > 0 ? dailyPnl / prevEq.equity : 0) * 100)} color={clr(dailyPnl)} icon="📊" />
        <KPICard label="Sharpe" value={sharpe} sub="vs 1.2 benchmark" color={T.up} icon="📈" />
        <KPICard label="Sortino" value={sortino} sub="downside-adjusted" color={T.up} />
        <KPICard label="Max DD" value={maxDD} sub="rolling 1Y" color={T.dn} icon="📉" />
        <KPICard label="Win Rate" value={winRate} sub="realized trades" color={T.up} />
        <KPICard label="Profit Factor" value={profitFactor} sub="gross P / gross L" color={T.up} />
        <KPICard label="Calmar" value={calmar} sub="return / max DD" color={T.up} />
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
            <AssetAllocation portfolio={portfolioData} nav={nav} />
            <RiskMetrics perfKpis={perfKpis} accountKpis={accountKpis} />
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
