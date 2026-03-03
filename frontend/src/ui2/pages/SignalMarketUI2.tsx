/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Signal Marketplace (UI2)                           │
 * │  Browse, subscribe, backtest, and trade community/proprietary       │
 * │  signals with performance tracking and risk scoring                 │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

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
interface Signal {
  id: string;
  name: string;
  provider: string;
  category: string;
  asset: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  avgTrade: number;
  subscribers: number;
  rating: number;
  price: number;
  pricePeriod: string;
  verified: boolean;
  liveMonths: number;
  signals30d: number;
  equityCurve: number[];
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateSignals(): Signal[] {
  const names = [
    { name: 'Alpha Momentum Pro', provider: 'QuantEdge Labs', cat: 'Momentum', asset: 'US Equities' },
    { name: 'Volatility Surface Arb', provider: 'Vol Capital', cat: 'Options', asset: 'SPX Options' },
    { name: 'Crypto Trend Follower', provider: 'Digital Alpha', cat: 'Trend', asset: 'BTC/ETH' },
    { name: 'Mean Reversion Daily', provider: 'StatArb Signals', cat: 'Mean Reversion', asset: 'US Equities' },
    { name: 'Macro Regime Allocator', provider: 'Macro Research Co', cat: 'Macro', asset: 'Multi-Asset' },
    { name: 'Earnings Catalyst', provider: 'Event Driven Alpha', cat: 'Event', asset: 'US Equities' },
    { name: 'FX Carry Optimizer', provider: 'Global FX Advisors', cat: 'Carry', asset: 'G10 FX' },
    { name: 'Sector Rotation AI', provider: 'ML Signals Inc', cat: 'Rotation', asset: 'US Sectors' },
    { name: 'Options Flow Scanner', provider: 'FlowTracker Pro', cat: 'Flow', asset: 'US Options' },
    { name: 'Fixed Income Relative Value', provider: 'Bond Alpha Ltd', cat: 'Relative Value', asset: 'US Treasuries' },
    { name: 'Small Cap Momentum', provider: 'MicroCap Alpha', cat: 'Momentum', asset: 'US Small Cap' },
    { name: 'Commodity Trend CTA', provider: 'Commodity TF Systems', cat: 'Trend', asset: 'Commodities' },
    { name: 'Pairs Trading Scanner', provider: 'PairsTrade AI', cat: 'Statistical Arb', asset: 'US Equities' },
    { name: 'Sentiment Edge NLP', provider: 'NLP Capital', cat: 'Sentiment', asset: 'US Equities' },
    { name: 'Tail Risk Hedge Timing', provider: 'Tail Protect Systems', cat: 'Hedging', asset: 'VIX/SPX' },
    { name: 'Intraday Scalper Pro', provider: 'HFT Lite Labs', cat: 'Scalping', asset: 'ES Futures' },
  ];

  return names.map((n, i) => {
    const curve = [100];
    for (let j = 1; j < 60; j++) curve.push(curve[j - 1] * (1 + (Math.random() - 0.42) * 0.03));
    return {
      id: `SIG-${String(i + 1).padStart(3, '0')}`,
      name: n.name,
      provider: n.provider,
      category: n.cat,
      asset: n.asset,
      sharpe: +(0.5 + Math.random() * 2.5).toFixed(2),
      totalReturn: +(15 + Math.random() * 120).toFixed(1),
      maxDrawdown: +(-5 - Math.random() * 25).toFixed(1),
      winRate: +(45 + Math.random() * 25).toFixed(1),
      avgTrade: +(0.1 + Math.random() * 1.5).toFixed(2),
      subscribers: Math.floor(50 + Math.random() * 2000),
      rating: +(3 + Math.random() * 2).toFixed(1),
      price: [0, 29, 49, 99, 149, 199, 299][Math.floor(Math.random() * 7)],
      pricePeriod: 'mo',
      verified: Math.random() > 0.3,
      liveMonths: Math.floor(3 + Math.random() * 36),
      signals30d: Math.floor(5 + Math.random() * 50),
      equityCurve: curve,
    };
  }).sort((a, b) => b.sharpe - a.sharpe);
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function MiniEquityCurve({ data, width = 80, height = 25 }: { data: number[]; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    c.width = width * 2; c.height = height * 2; ctx.scale(2, 2);
    const mn = Math.min(...data); const mx = Math.max(...data); const rng = mx - mn || 1;
    const positive = data[data.length - 1] >= data[0];
    ctx.strokeStyle = positive ? T.up : T.dn; ctx.lineWidth = 1;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d - mn) / rng) * (height - 2) - 1;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Fill
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath();
    ctx.fillStyle = positive ? `${T.up}15` : `${T.dn}15`; ctx.fill();
  }, [data, width, height]);
  return <canvas ref={ref} style={{ width, height }} />;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: '8px', letterSpacing: '1px' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < Math.round(rating) ? '#FFD700' : T.tx3 }}>★</span>
      ))}
    </span>
  );
}

/* ── Sub Components ──────────────────────────────────────────────────── */
function SignalCard({ sig }: { sig: Signal }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {sig.name}
            {sig.verified && <span style={{ fontSize: '7px', padding: '1px 3px', borderRadius: '2px', background: `${T.up}20`, color: T.up }}>✓ Verified</span>}
          </div>
          <div style={{ fontSize: '7px', color: T.tx3 }}>{sig.provider} · {sig.category} · {sig.asset}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: T.brand, fontFamily: T.mono }}>
            {sig.price === 0 ? 'FREE' : `$${sig.price}`}<span style={{ fontSize: '7px', color: T.tx3 }}>/{sig.pricePeriod}</span>
          </div>
          <Stars rating={sig.rating} />
        </div>
      </div>
      <MiniEquityCurve data={sig.equityCurve} width={200} height={40} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', fontSize: '7px', fontFamily: T.mono }}>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>Sharpe</div><div style={{ color: sig.sharpe > 1.5 ? T.up : T.tx0, fontWeight: 700 }}>{sig.sharpe}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>Return</div><div style={{ color: T.up }}>{sig.totalReturn}%</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>MDD</div><div style={{ color: T.dn }}>{sig.maxDrawdown}%</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ color: T.tx3 }}>Win Rate</div><div style={{ color: sig.winRate > 55 ? T.up : T.tx1 }}>{sig.winRate}%</div></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: T.tx3 }}>
        <span>{sig.subscribers.toLocaleString()} subscribers</span>
        <span>{sig.liveMonths} months live</span>
        <span>{sig.signals30d} signals/30d</span>
      </div>
      <button style={{ background: T.brand, color: '#FFF', border: 'none', borderRadius: T.r, padding: '5px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>Subscribe</button>
    </div>
  );
}

function LeaderboardView({ signals }: { signals: Signal[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Signal Leaderboard — Top Performers</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['#', 'Signal', 'Provider', 'Sharpe', 'Return', 'MDD', 'Win%', 'Subs', 'Rating', 'Curve'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, fontWeight: 600, textAlign: h === 'Signal' || h === 'Provider' ? 'left' : 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => (
            <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: i < 3 ? T.warn : T.tx3, fontWeight: i < 3 ? 700 : 400, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ padding: '3px 4px', textAlign: 'left' }}>
                <span style={{ color: T.tx0, fontWeight: 600 }}>{s.name}</span>
                {s.verified && <span style={{ color: T.up, marginLeft: '4px', fontSize: '7px' }}>✓</span>}
              </td>
              <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'left', fontSize: '7px' }}>{s.provider}</td>
              <td style={{ padding: '3px 4px', color: s.sharpe > 1.5 ? T.up : T.tx1, fontWeight: 700, textAlign: 'center' }}>{s.sharpe}</td>
              <td style={{ padding: '3px 4px', color: T.up, textAlign: 'center' }}>{s.totalReturn}%</td>
              <td style={{ padding: '3px 4px', color: T.dn, textAlign: 'center' }}>{s.maxDrawdown}%</td>
              <td style={{ padding: '3px 4px', color: s.winRate > 55 ? T.up : T.tx2, textAlign: 'center' }}>{s.winRate}%</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'center' }}>{s.subscribers.toLocaleString()}</td>
              <td style={{ padding: '3px 4px', textAlign: 'center' }}><Stars rating={s.rating} /></td>
              <td style={{ padding: '3px 4px', textAlign: 'center' }}><MiniEquityCurve data={s.equityCurve} width={60} height={18} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type SMTab = 'browse' | 'leaderboard';

export default function SignalMarketUI2() {
  const [tab, setTab] = useState<SMTab>('browse');
  const [filterCat, setFilterCat] = useState('all');
  const signals = useMemo(() => generateSignals(), []);
  const categories = useMemo(() => ['all', ...new Set(signals.map(s => s.category))], [signals]);
  const filtered = filterCat === 'all' ? signals : signals.filter(s => s.category === filterCat);

  return (
    <div data-testid="signal-market-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>SIGNAL MARKETPLACE</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '2px 6px', fontSize: '8px', fontFamily: T.mono }}>
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '8px', color: T.tx3, fontFamily: T.mono }}>{filtered.length} signals available</span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'browse' as SMTab, label: '🛒 Browse' },
          { key: 'leaderboard' as SMTab, label: '🏆 Leaderboard' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'browse' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
            {filtered.map(s => <SignalCard key={s.id} sig={s} />)}
          </div>
        )}
        {tab === 'leaderboard' && <LeaderboardView signals={filtered} />}
      </div>
    </div>
  );
}

export { SignalMarketUI2 };
