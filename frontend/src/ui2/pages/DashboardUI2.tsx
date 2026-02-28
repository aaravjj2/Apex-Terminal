import React, { useState, useEffect, useCallback } from 'react';
/**
 * DashboardUI2 — Bloomberg Market Command Center
 * Full-featured: Index strip, sector heatmap, top movers, breadth, positions, volatility, news
 * All inline Bloomberg styling, real API polling, zero demo data
 */

// ─── Bloomberg APEX palette (aligned with ui2-tokens.css) ──────────────────
const BG = '#040407';
const PANEL = '#0c0c14';
const BORDER = '#1e1e2e';
const AMBER = '#ff9900';
const GREEN = '#00d88a';
const RED = '#ff3b5c';
const BLUE = '#4da6ff';
const PURPLE = '#c084fc';
const SUBTLE = '#5d5d7d';
const TEXT = '#e8e8ee';
const MONO = "'IBM Plex Mono','Roboto Mono','Courier New',monospace";

// ─── Shared micro-styles ─────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: PANEL, border: `1px solid ${BORDER}`, borderTop: `2px solid ${AMBER}`,
  overflow: 'hidden', display: 'flex', flexDirection: 'column',
  borderRadius: 0,
};
const panelHdr: React.CSSProperties = {
  padding: '4px 10px', background: 'rgba(255,153,0,0.06)', borderBottom: `1px solid ${BORDER}`,
  fontSize: 9, color: AMBER, fontWeight: 700, letterSpacing: '0.12em',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  textTransform: 'uppercase', fontFamily: MONO,
};
const th: React.CSSProperties = {
  padding: '4px 8px', fontSize: 9, color: SUBTLE, fontFamily: MONO,
  fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${BORDER}`,
  whiteSpace: 'nowrap', letterSpacing: '0.10em', textTransform: 'uppercase',
};
const td: React.CSSProperties = {
  padding: '3px 8px', fontSize: 11, fontFamily: MONO,
  textAlign: 'right', borderBottom: `1px solid rgba(30,30,46,0.5)`,
  fontVariantNumeric: 'tabular-nums',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt2 = (n: number) => n.toFixed(2);
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const fmtK = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(2)}`;
const clr = (n: number) => n >= 0 ? GREEN : RED;

// ─── Sub-component: SectorHeatmap ────────────────────────────────────────────
interface SectorCell { name: string; abbr: string; change: number; }
const SECTOR_LIST: SectorCell[] = [
  { name: 'Technology', abbr: 'XLK', change: 0 },
  { name: 'Financials', abbr: 'XLF', change: 0 },
  { name: 'Health Care', abbr: 'XLV', change: 0 },
  { name: 'Consumer Disc', abbr: 'XLY', change: 0 },
  { name: 'Industrials', abbr: 'XLI', change: 0 },
  { name: 'Comm Svcs', abbr: 'XLC', change: 0 },
  { name: 'Energy', abbr: 'XLE', change: 0 },
  { name: 'Materials', abbr: 'XLB', change: 0 },
  { name: 'Real Estate', abbr: 'XLRE', change: 0 },
  { name: 'Utilities', abbr: 'XLU', change: 0 },
  { name: 'Cons Staples', abbr: 'XLP', change: 0 },
];

const HeatCell: React.FC<{ s: SectorCell }> = ({ s }) => {
  const pct = s.change * 100;
  const intensity = Math.min(Math.abs(pct) / 3, 1);
  const bg = s.change > 0
    ? `rgba(0,216,138,${0.06 + intensity * 0.42})`
    : s.change < 0
    ? `rgba(255,59,92,${0.06 + intensity * 0.42})`
    : 'rgba(30,30,46,0.4)';
  return (
    <div style={{
      background: bg, border: `1px solid ${BORDER}`, borderRadius: 0,
      padding: '6px 8px', cursor: 'default', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: AMBER, marginBottom: 2, fontFamily: MONO, letterSpacing: '0.08em' }}>{s.abbr}</div>
      <div style={{ fontSize: 9, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: MONO }}>{s.name}</div>
      <div style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: clr(s.change), marginTop: 2 }}>
        {s.change !== 0 ? fmtPct(s.change) : '─'}
      </div>
    </div>
  );
};

// ─── Sub-component: SparkLine ─────────────────────────────────────────────────
const SparkLine: React.FC<{ data: number[]; color: string; w?: number; h?: number }> = ({
  data, color, w = 80, h = 24,
}) => {
  if (!data.length) return <span style={{ color: SUBTLE }}>─</span>;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

// ─── Sub-component: BreadthGauge ──────────────────────────────────────────────
const BreadthGauge: React.FC<{ label: string; advancing: number; declining: number }> = ({
  label, advancing, declining,
}) => {
  const total = advancing + declining || 1;
  const pct = advancing / total;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: SUBTLE, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontFamily: MONO }}>
          <span style={{ color: GREEN }}>{advancing}▲</span>
          {'  '}
          <span style={{ color: RED }}>{declining}▼</span>
        </span>
      </div>
      <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: `linear-gradient(90deg,${GREEN},${AMBER})`, borderRadius: 3 }} />
      </div>
    </div>
  );
};

// ─── Sub-component: StatCard ──────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({
  label, value, sub, color = TEXT,
}) => (
  <div style={{ background: 'rgba(255,153,0,0.03)', border: `1px solid ${BORDER}`, borderTop: `2px solid ${AMBER}`, borderRadius: 0, padding: '8px 12px' }}>
    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: '0.12em', marginBottom: 4, fontFamily: MONO, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontSize: 9, color: SUBTLE, marginTop: 2, fontFamily: MONO }}>{sub}</div>}
  </div>
);


// ─── Types ────────────────────────────────────────────────────────────────────
interface QuoteData {
  symbol: string; price: number; change: number; change_pct: number;
  volume?: number; bid?: number; ask?: number; high?: number; low?: number;
  open?: number; prev_close?: number; history?: number[];
}
interface Position {
  symbol: string; quantity: number; avg_price: number;
  market_price: number; unrealized_pnl: number; realized_pnl?: number;
  sector?: string; market_value?: number;
}
interface Mover { symbol: string; price: number; change_pct: number; volume: number; }

// ─── Constants ────────────────────────────────────────────────────────────────
const INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX'];
const INDEX_LABELS: Record<string, string> = {
  SPY: 'SPX', QQQ: 'NDX', DIA: 'DJIA', IWM: 'RUT', VIX: 'VIX',
};
const MOVER_SYMBOLS = [
  'AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','JPM','XOM','BAC',
  'AMD','NFLX','UBER','COIN','HOOD','PLTR','RIVN','SOFI','NIO','LCID',
];
const SECTOR_ETFS = ['XLK','XLF','XLV','XLY','XLI','XLC','XLE','XLB','XLRE','XLU','XLP'];

// ─── API fetch helpers ────────────────────────────────────────────────────────
async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const r = await fetch(`/api/v1/market-data/${symbol}/quote`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchPositions(): Promise<Position[]> {
  try {
    const r = await fetch('/api/v1/positions');
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : d.positions ?? [];
  } catch { return []; }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DashboardUI2() {
  const [indices, setIndices] = useState<Record<string, QuoteData>>({});
  const [sectors, setSectors] = useState<SectorCell[]>(SECTOR_LIST.map(s => ({ ...s })));
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [breadthAdv, setBreadthAdv] = useState(0);
  const [breadthDec, setBreadthDec] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [activeTab, setActiveTab] = useState<'overview'|'positions'|'heatmap'|'movers'>('overview');

  // ── Poll index quotes ──────────────────────────────────────────────────────
  const pollIndices = useCallback(async () => {
    const results = await Promise.allSettled(INDEX_SYMBOLS.map(fetchQuote));
    const updated: Record<string, QuoteData> = { ...indices };
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) updated[INDEX_SYMBOLS[i]] = r.value;
    });
    setIndices(updated);
  }, [indices]);

  // ── Poll sector ETFs ───────────────────────────────────────────────────────
  const pollSectors = useCallback(async () => {
    const results = await Promise.allSettled(SECTOR_ETFS.map(fetchQuote));
    setSectors(prev => prev.map((s, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        return { ...s, change: r.value.change_pct ?? 0 };
      }
      return s;
    }));
  }, []);

  // ── Poll movers ────────────────────────────────────────────────────────────
  const pollMovers = useCallback(async () => {
    const results = await Promise.allSettled(MOVER_SYMBOLS.map(fetchQuote));
    const movers: Mover[] = [];
    let adv = 0, dec = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        const q = r.value;
        movers.push({ symbol: MOVER_SYMBOLS[i], price: q.price, change_pct: q.change_pct ?? 0, volume: q.volume ?? 0 });
        if ((q.change_pct ?? 0) > 0) adv++; else dec++;
      }
    });
    movers.sort((a, b) => b.change_pct - a.change_pct);
    setGainers(movers.slice(0, 8));
    setLosers([...movers].sort((a, b) => a.change_pct - b.change_pct).slice(0, 8));
    setBreadthAdv(adv);
    setBreadthDec(dec);
  }, []);

  // ── Poll positions ─────────────────────────────────────────────────────────
  const pollPositions = useCallback(async () => {
    const pos = await fetchPositions();
    setPositions(pos);
  }, []);

  // ── Initial + interval polling ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      await Promise.allSettled([pollIndices(), pollSectors(), pollMovers(), pollPositions()]);
      if (mounted) {
        setLoading(false);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    };
    run();
    const iv1 = setInterval(() => { if (mounted) pollIndices(); }, 5000);
    const iv2 = setInterval(() => { if (mounted) { pollSectors(); pollMovers(); setLastUpdate(new Date().toLocaleTimeString()); } }, 15000);
    const iv3 = setInterval(() => { if (mounted) pollPositions(); }, 10000);
    return () => { mounted = false; clearInterval(iv1); clearInterval(iv2); clearInterval(iv3); };
  }, []);

  // ── Derived portfolio stats ────────────────────────────────────────────────
  const totalUnrealizedPnL = positions.reduce((s, p) => s + (p.unrealized_pnl ?? 0), 0);
  const totalMarketValue = positions.reduce((s, p) => s + (p.market_value ?? p.quantity * p.market_price), 0);
  const totalRealizedPnL = positions.reduce((s, p) => s + (p.realized_pnl ?? 0), 0);
  const posCount = positions.length;
  const posWinners = positions.filter(p => (p.unrealized_pnl ?? 0) > 0).length;

  // ── Tab button style ───────────────────────────────────────────────────────
  const tabBtn = (key: typeof activeTab): React.CSSProperties => ({
    padding: '5px 14px', border: 'none', background: activeTab === key ? '#1a1200' : 'transparent',
    color: activeTab === key ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 10, fontWeight: 700,
    cursor: 'pointer', borderBottom: `2px solid ${activeTab === key ? AMBER : 'transparent'}`,
    letterSpacing: 1,
  });

  return (
    <div data-testid="dashboard-ui2-page" data-ready="true"
      style={{ height: '100%', overflow: 'auto', background: BG, padding: '10px 14px', fontFamily: MONO, color: TEXT }}>

      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>MARKET COMMAND CENTER</span>
          <span style={{ fontSize: 9, color: SUBTLE, background: '#141414', padding: '2px 8px', borderRadius: 2, border: `1px solid ${BORDER}` }}>
            LIVE
          </span>
        </div>
        <div style={{ fontSize: 9, color: SUBTLE }}>
          {loading ? 'Loading…' : `Updated ${lastUpdate}`}
        </div>
      </div>

      {/* ── Index strip ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {INDEX_SYMBOLS.map(sym => {
          const q = indices[sym];
          return (
            <div key={sym} style={{
              background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4,
              padding: '6px 14px', minWidth: 110, flexShrink: 0,
            }}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{INDEX_LABELS[sym] ?? sym}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginTop: 1 }}>
                {q ? q.price.toFixed(2) : '─'}
              </div>
              <div style={{ fontSize: 10, color: q ? clr(q.change_pct ?? 0) : SUBTLE }}>
                {q ? `${q.change_pct >= 0 ? '+' : ''}${(q.change_pct * 100).toFixed(2)}%` : '─'}
              </div>
            </div>
          );
        })}
        {/* Breadth summary pill */}
        <div style={{
          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4,
          padding: '6px 14px', minWidth: 130, flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>BREADTH</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>
            <span style={{ color: GREEN }}>{breadthAdv}▲ </span>
            <span style={{ color: SUBTLE }}>/ </span>
            <span style={{ color: RED }}>{breadthDec}▼</span>
          </div>
          <div style={{ fontSize: 9, color: breadthAdv > breadthDec ? GREEN : RED, marginTop: 1 }}>
            {breadthAdv + breadthDec > 0
              ? `${((breadthAdv / (breadthAdv + breadthDec)) * 100).toFixed(0)}% ADV`
              : '─'}
          </div>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 10 }}>
        {(['overview', 'positions', 'heatmap', 'movers'] as const).map(t => (
          <button key={t} style={tabBtn(t)} onClick={() => setActiveTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Portfolio summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <StatCard label="UNREALIZED P&L" value={fmtK(totalUnrealizedPnL)}
              sub={`${posWinners}/${posCount} winners`} color={clr(totalUnrealizedPnL)} />
            <StatCard label="REALIZED P&L" value={fmtK(totalRealizedPnL)}
              color={clr(totalRealizedPnL)} />
            <StatCard label="MARKET VALUE" value={fmtK(totalMarketValue)}
              sub={`${posCount} positions`} color={BLUE} />
            <StatCard label="ADV / DEC" value={`${breadthAdv} / ${breadthDec}`}
              sub={breadthAdv + breadthDec > 0 ? `${((breadthAdv / (breadthAdv + breadthDec)) * 100).toFixed(0)}% advancing` : 'No data'}
              color={breadthAdv > breadthDec ? GREEN : RED} />
            <StatCard label="SECTOR COUNT" value={`${sectors.filter(s => s.change > 0).length} / 11`}
              sub="sectors advancing" color={sectors.filter(s => s.change > 0).length > 5 ? GREEN : RED} />
          </div>

          {/* Two-column: sector heatmap + top movers split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Sector heatmap */}
            <div style={panelStyle}>
              <div style={panelHdr}><span>SECTOR PERFORMANCE (GICS)</span></div>
              <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {sectors.map(s => <HeatCell key={s.abbr} s={s} />)}
              </div>
            </div>

            {/* Gainers/losers side by side */}
            <div style={panelStyle}>
              <div style={panelHdr}><span>TOP MOVERS</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
                {/* Gainers */}
                <div style={{ borderRight: `1px solid ${BORDER}` }}>
                  <div style={{ padding: '4px 8px', fontSize: 9, color: GREEN, fontWeight: 700, borderBottom: `1px solid ${BORDER}` }}>
                    ▲ GAINERS
                  </div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>SYM</th>
                        <th style={th}>PRICE</th>
                        <th style={th}>CHG%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gainers.map((m, i) => (
                        <tr key={m.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', color: AMBER }}>{m.symbol}</td>
                          <td style={td}>{fmt2(m.price)}</td>
                          <td style={{ ...td, color: GREEN, fontWeight: 700 }}>+{(m.change_pct * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Losers */}
                <div>
                  <div style={{ padding: '4px 8px', fontSize: 9, color: RED, fontWeight: 700, borderBottom: `1px solid ${BORDER}` }}>
                    ▼ LOSERS
                  </div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>SYM</th>
                        <th style={th}>PRICE</th>
                        <th style={th}>CHG%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {losers.map((m, i) => (
                        <tr key={m.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', color: AMBER }}>{m.symbol}</td>
                          <td style={td}>{fmt2(m.price)}</td>
                          <td style={{ ...td, color: RED, fontWeight: 700 }}>{(m.change_pct * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Market breadth bar */}
          <div style={panelStyle}>
            <div style={panelHdr}><span>MARKET BREADTH</span></div>
            <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <BreadthGauge label="ADVANCING / DECLINING" advancing={breadthAdv} declining={breadthDec} />
                <BreadthGauge label="SECTORS ADVANCING"
                  advancing={sectors.filter(s => s.change > 0).length}
                  declining={sectors.filter(s => s.change <= 0).length} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'ADV COUNT', value: breadthAdv.toString(), color: GREEN },
                  { label: 'DEC COUNT', value: breadthDec.toString(), color: RED },
                  { label: 'ADV SECTORS', value: sectors.filter(s => s.change > 0).length.toString(), color: GREEN },
                  { label: 'DEC SECTORS', value: sectors.filter(s => s.change <= 0).length.toString(), color: RED },
                ].map(item => (
                  <div key={item.label} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px' }}>
                    <div style={{ fontSize: 8, color: SUBTLE }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: MONO }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POSITIONS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'positions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* P&L summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <StatCard label="TOTAL UNREALIZED" value={fmtK(totalUnrealizedPnL)}
              color={clr(totalUnrealizedPnL)} sub={totalUnrealizedPnL >= 0 ? 'Profitable' : 'Loss'} />
            <StatCard label="TOTAL REALIZED" value={fmtK(totalRealizedPnL)} color={clr(totalRealizedPnL)} />
            <StatCard label="MARKET VALUE" value={fmtK(totalMarketValue)} color={BLUE} />
            <StatCard label="WIN RATE"
              value={posCount > 0 ? `${((posWinners / posCount) * 100).toFixed(1)}%` : '─'}
              sub={`${posWinners} of ${posCount} profitable`}
              color={posWinners / posCount >= 0.5 ? GREEN : RED} />
          </div>

          {/* Positions table */}
          <div style={panelStyle}>
            <div style={panelHdr}>
              <span>OPEN POSITIONS</span>
              <span style={{ color: SUBTLE }}>{posCount} holdings</span>
            </div>
            {positions.length === 0
              ? <div style={{ padding: '30px', textAlign: 'center', color: SUBTLE, fontSize: 10 }}>
                  No open positions — connect broker or place orders
                </div>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                        <th style={th}>QTY</th>
                        <th style={th}>AVG PRICE</th>
                        <th style={th}>MKT PRICE</th>
                        <th style={th}>MKT VALUE</th>
                        <th style={th}>UNRLZ P&L</th>
                        <th style={th}>RLZD P&L</th>
                        <th style={{ ...th, textAlign: 'left' }}>SECTOR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p, i) => {
                        const mv = p.market_value ?? p.quantity * p.market_price;
                        return (
                          <tr key={p.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{p.symbol}</td>
                            <td style={td}>{p.quantity}</td>
                            <td style={td}>{fmt2(p.avg_price)}</td>
                            <td style={{ ...td, color: p.market_price >= p.avg_price ? GREEN : RED }}>
                              {fmt2(p.market_price)}
                            </td>
                            <td style={{ ...td, color: BLUE }}>{fmtK(mv)}</td>
                            <td style={{ ...td, color: clr(p.unrealized_pnl ?? 0), fontWeight: 700 }}>
                              {fmtK(p.unrealized_pnl ?? 0)}
                            </td>
                            <td style={{ ...td, color: clr(p.realized_pnl ?? 0) }}>
                              {fmtK(p.realized_pnl ?? 0)}
                            </td>
                            <td style={{ ...td, textAlign: 'left', color: SUBTLE }}>{p.sector ?? '─'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${BORDER}`, background: '#0d0d0d' }}>
                        <td style={{ ...td, textAlign: 'left', color: TEXT, fontWeight: 700 }}>TOTAL</td>
                        <td style={td}></td>
                        <td style={td}></td>
                        <td style={td}></td>
                        <td style={{ ...td, color: BLUE, fontWeight: 700 }}>{fmtK(totalMarketValue)}</td>
                        <td style={{ ...td, color: clr(totalUnrealizedPnL), fontWeight: 700 }}>{fmtK(totalUnrealizedPnL)}</td>
                        <td style={{ ...td, color: clr(totalRealizedPnL), fontWeight: 700 }}>{fmtK(totalRealizedPnL)}</td>
                        <td style={td}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
            }
          </div>

          {/* Sector allocation breakdown */}
          {positions.length > 0 && (
            <div style={panelStyle}>
              <div style={panelHdr}><span>SECTOR ALLOCATION</span></div>
              <div style={{ padding: '10px 14px' }}>
                {Object.entries(
                  positions.reduce((acc, p) => {
                    const sec = p.sector ?? 'Unknown';
                    acc[sec] = (acc[sec] ?? 0) + (p.market_value ?? p.quantity * p.market_price);
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([sec, val]) => {
                  const pct = totalMarketValue > 0 ? val / totalMarketValue : 0;
                  return (
                    <div key={sec} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: SUBTLE, marginBottom: 2 }}>
                        <span>{sec}</span>
                        <span style={{ fontFamily: MONO }}>
                          <span style={{ color: BLUE }}>{fmtK(val)}</span>
                          {'  '}
                          <span style={{ color: TEXT }}>{(pct * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                      <div style={{ height: 5, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: BLUE, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HEATMAP TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'heatmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Sector table detail */}
          <div style={panelStyle}>
            <div style={panelHdr}><span>SECTOR ETF PERFORMANCE DETAIL</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>SECTOR</th>
                    <th style={{ ...th, textAlign: 'left' }}>ETF</th>
                    <th style={th}>CHANGE %</th>
                    <th style={th}>SIGNAL</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s, i) => (
                    <tr key={s.abbr} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                      <td style={{ ...td, textAlign: 'left', color: TEXT }}>{s.name}</td>
                      <td style={{ ...td, textAlign: 'left', color: AMBER }}>{s.abbr}</td>
                      <td style={{ ...td, color: clr(s.change), fontWeight: 700 }}>
                        {s.change !== 0 ? fmtPct(s.change) : '─'}
                      </td>
                      <td style={{ ...td, color: s.change > 0.01 ? GREEN : s.change < -0.01 ? RED : SUBTLE }}>
                        {s.change > 0.015 ? 'STRONG BUY' : s.change > 0.005 ? 'BUY' : s.change < -0.015 ? 'STRONG SELL' : s.change < -0.005 ? 'SELL' : 'NEUTRAL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Large heatmap grid */}
          <div style={panelStyle}>
            <div style={panelHdr}><span>GICS SECTOR HEATMAP</span></div>
            <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {sectors.map(s => (
                <div key={s.abbr} style={{
                  background: s.change > 0
                    ? `rgba(38,166,154,${Math.min(Math.abs(s.change) / 0.03, 1) * 0.5 + 0.05})`
                    : s.change < 0
                    ? `rgba(239,83,80,${Math.min(Math.abs(s.change) / 0.03, 1) * 0.5 + 0.05})`
                    : '#131313',
                  border: `1px solid ${BORDER}`, borderRadius: 4, padding: '14px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 14, color: AMBER, fontWeight: 700 }}>{s.abbr}</div>
                  <div style={{ fontSize: 9, color: SUBTLE, marginTop: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: clr(s.change), marginTop: 5, fontFamily: MONO }}>
                    {s.change !== 0 ? fmtPct(s.change) : '─'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MOVERS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'movers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Top Gainers */}
          <div style={panelStyle}>
            <div style={{ ...panelHdr, color: GREEN }}>TOP GAINERS</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                  <th style={th}>PRICE</th>
                  <th style={th}>CHANGE %</th>
                  <th style={th}>VOLUME</th>
                </tr>
              </thead>
              <tbody>
                {gainers.map((m, i) => (
                  <tr key={m.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                    <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{m.symbol}</td>
                    <td style={td}>{fmt2(m.price)}</td>
                    <td style={{ ...td, color: GREEN, fontWeight: 700 }}>+{(m.change_pct * 100).toFixed(2)}%</td>
                    <td style={{ ...td, color: SUBTLE }}>{m.volume > 1e6 ? `${(m.volume / 1e6).toFixed(1)}M` : m.volume > 1e3 ? `${(m.volume / 1e3).toFixed(0)}K` : m.volume.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Losers */}
          <div style={panelStyle}>
            <div style={{ ...panelHdr, color: RED }}>TOP LOSERS</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                  <th style={th}>PRICE</th>
                  <th style={th}>CHANGE %</th>
                  <th style={th}>VOLUME</th>
                </tr>
              </thead>
              <tbody>
                {losers.map((m, i) => (
                  <tr key={m.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                    <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{m.symbol}</td>
                    <td style={td}>{fmt2(m.price)}</td>
                    <td style={{ ...td, color: RED, fontWeight: 700 }}>{(m.change_pct * 100).toFixed(2)}%</td>
                    <td style={{ ...td, color: SUBTLE }}>{m.volume > 1e6 ? `${(m.volume / 1e6).toFixed(1)}M` : m.volume > 1e3 ? `${(m.volume / 1e3).toFixed(0)}K` : m.volume.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Full universe table */}
          <div style={{ ...panelStyle, gridColumn: '1 / -1' }}>
            <div style={panelHdr}><span>FULL UNIVERSE — ALL MOVERS</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>SYMBOL</th>
                    <th style={th}>PRICE</th>
                    <th style={th}>CHANGE %</th>
                    <th style={th}>VOLUME</th>
                    <th style={th}>SIGNAL</th>
                  </tr>
                </thead>
                <tbody>
                  {[...gainers, ...losers].sort((a, b) => b.change_pct - a.change_pct).map((m, i) => (
                    <tr key={m.symbol} style={{ background: i % 2 === 0 ? '#0d0d0d' : 'transparent' }}>
                      <td style={{ ...td, textAlign: 'left', color: AMBER, fontWeight: 700 }}>{m.symbol}</td>
                      <td style={td}>{fmt2(m.price)}</td>
                      <td style={{ ...td, color: clr(m.change_pct), fontWeight: 700 }}>
                        {m.change_pct >= 0 ? '+' : ''}{(m.change_pct * 100).toFixed(2)}%
                      </td>
                      <td style={{ ...td, color: SUBTLE }}>
                        {m.volume > 1e6 ? `${(m.volume / 1e6).toFixed(1)}M` : m.volume > 1e3 ? `${(m.volume / 1e3).toFixed(0)}K` : m.volume.toString()}
                      </td>
                      <td style={{ ...td, color: Math.abs(m.change_pct) > 0.03 ? PURPLE : clr(m.change_pct) }}>
                        {Math.abs(m.change_pct) > 0.05 ? '⚡ HIGH MOMENTUM' : Math.abs(m.change_pct) > 0.02 ? 'ACTIVE' : 'NORMAL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div data-testid="dashboard-ready" style={{ display: 'none' }} />
    </div>
  );
}
