/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Strategy/Asset Scoring Engine (UI2)               │
 * │  Multi-factor scoring with composite rankings, factor weights,     │
 * │  sector breakdowns, and score attribution analysis                 │
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
interface ScoredAsset {
  symbol: string; name: string; sector: string;
  composite: number; rank: number;
  factors: { momentum: number; value: number; quality: number; growth: number; volatility: number; sentiment: number; technical: number; liquidity: number };
  priceChg1M: number; priceChg3M: number;
  marketCap: number; pe: number;
  sparkData: number[];
}

interface FactorWeight {
  name: string; weight: number; description: string;
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateScored(): ScoredAsset[] {
  const assets: [string, string, string][] = [
    ['NVDA', 'NVIDIA Corp', 'Tech'], ['AAPL', 'Apple Inc', 'Tech'],
    ['MSFT', 'Microsoft', 'Tech'], ['AMZN', 'Amazon.com', 'Consumer'],
    ['GOOGL', 'Alphabet', 'Tech'], ['META', 'Meta Platforms', 'Tech'],
    ['JPM', 'JPMorgan Chase', 'Finance'], ['V', 'Visa Inc', 'Finance'],
    ['UNH', 'UnitedHealth', 'Healthcare'], ['JNJ', 'Johnson & Johnson', 'Healthcare'],
    ['XOM', 'Exxon Mobil', 'Energy'], ['CVX', 'Chevron', 'Energy'],
    ['PG', 'Procter & Gamble', 'Consumer'], ['HD', 'Home Depot', 'Consumer'],
    ['MA', 'Mastercard', 'Finance'], ['TSLA', 'Tesla', 'Auto'],
    ['LLY', 'Eli Lilly', 'Healthcare'], ['WMT', 'Walmart', 'Consumer'],
    ['BAC', 'Bank of America', 'Finance'], ['COP', 'ConocoPhillips', 'Energy'],
  ];

  return assets.map(([sym, name, sector], i) => {
    const factors = {
      momentum: +(20 + Math.random() * 75).toFixed(1),
      value: +(15 + Math.random() * 80).toFixed(1),
      quality: +(30 + Math.random() * 65).toFixed(1),
      growth: +(10 + Math.random() * 85).toFixed(1),
      volatility: +(25 + Math.random() * 70).toFixed(1),
      sentiment: +(15 + Math.random() * 80).toFixed(1),
      technical: +(20 + Math.random() * 75).toFixed(1),
      liquidity: +(40 + Math.random() * 55).toFixed(1),
    };
    const composite = +(Object.values(factors).reduce((s, v) => s + +v, 0) / 8).toFixed(1);
    const spark = Array.from({ length: 30 }, () => 100 + (Math.random() - 0.48) * 15);

    return {
      symbol: sym, name, sector,
      composite, rank: 0,
      factors,
      priceChg1M: +((Math.random() - 0.4) * 12).toFixed(2),
      priceChg3M: +((Math.random() - 0.35) * 25).toFixed(2),
      marketCap: Math.floor(50 + Math.random() * 2950),
      pe: +(8 + Math.random() * 45).toFixed(1),
      sparkData: spark,
    };
  }).sort((a, b) => b.composite - a.composite).map((a, i) => ({ ...a, rank: i + 1 }));
}

function defaultWeights(): FactorWeight[] {
  return [
    { name: 'momentum', weight: 20, description: '12M price momentum, RSI, MACD signals' },
    { name: 'value', weight: 15, description: 'P/E, P/B, EV/EBITDA vs sector median' },
    { name: 'quality', weight: 15, description: 'ROE, debt/equity, earnings stability' },
    { name: 'growth', weight: 15, description: 'Revenue/EPS growth, forward estimates' },
    { name: 'volatility', weight: 10, description: 'Realized vol, beta, downside deviation' },
    { name: 'sentiment', weight: 10, description: 'News sentiment, social, analyst ratings' },
    { name: 'technical', weight: 10, description: 'MA crossovers, support/resistance, patterns' },
    { name: 'liquidity', weight: 5, description: 'Volume, spread, market cap, turnover' },
  ];
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function RadarChart({ factors, color }: { factors: ScoredAsset['factors']; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 200, H = 200;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2, r = 70;
    const keys = Object.keys(factors) as (keyof typeof factors)[];
    const n = keys.length;

    // Grid rings
    for (let ring = 1; ring <= 4; ring++) {
      const rr = (ring / 4) * r;
      ctx.strokeStyle = `${T.tx3}20`; ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * rr;
        const y = cy + Math.sin(angle) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Spokes + labels
    keys.forEach((k, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.strokeStyle = `${T.tx3}20`; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      const lx = cx + Math.cos(angle) * (r + 12);
      const ly = cy + Math.sin(angle) * (r + 12);
      ctx.fillStyle = T.tx2; ctx.font = `6px ${T.mono}`; ctx.textAlign = 'center';
      ctx.fillText(k.slice(0, 3).toUpperCase(), lx, ly + 2);
    });

    // Data polygon
    ctx.fillStyle = `${color}20`; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    keys.forEach((k, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const val = +factors[k] / 100;
      const x = cx + Math.cos(angle) * r * val;
      const y = cy + Math.sin(angle) * r * val;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Data points
    keys.forEach((k, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const val = +factors[k] / 100;
      const x = cx + Math.cos(angle) * r * val;
      const y = cy + Math.sin(angle) * r * val;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });
  }, [factors, color]);
  return <canvas ref={ref} style={{ width: 200, height: 200, borderRadius: T.r }} />;
}

function MiniSparkline({ data }: { data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 60, H = 20;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    const mn = Math.min(...data); const mx = Math.max(...data); const rng = mx - mn || 1;
    const positive = data[data.length-1] >= data[0];
    ctx.strokeStyle = positive ? T.up : T.dn; ctx.lineWidth = 1;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length-1)) * W;
      const y = H - 1 - ((d - mn) / rng) * (H - 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data]);
  return <canvas ref={ref} style={{ width: 60, height: 20, verticalAlign: 'middle' }} />;
}

/* ── Factor Bar ──────────────────────────────────────────────────────── */
function FactorBar({ value, maxWidth = 60 }: { value: number; maxWidth?: number }) {
  const color = value > 70 ? T.up : value > 45 ? T.warn : T.dn;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <div style={{ width: maxWidth, height: 4, background: T.bg3, borderRadius: 2 }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: '7px', color, fontWeight: 600, minWidth: 20 }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type ScTab = 'rankings' | 'factors' | 'radar' | 'sectors';

export default function ScoringUI2() {
  const [tab, setTab] = useState<ScTab>('rankings');
  const [sel, setSel] = useState(0);
  const scored = useMemo(() => generateScored(), []);
  const weights = useMemo(() => defaultWeights(), []);

  const sectorAvg = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    scored.forEach(s => {
      if (!map[s.sector]) map[s.sector] = { sum: 0, count: 0 };
      map[s.sector].sum += s.composite;
      map[s.sector].count++;
    });
    return Object.entries(map).map(([sector, { sum, count }]) => ({
      sector, avgScore: +(sum / count).toFixed(1), count,
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [scored]);

  return (
    <div data-testid="scoring-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>SCORING ENGINE</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Assets: <span style={{ color: T.tx0 }}>{scored.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Factors: <span style={{ color: T.brand }}>{weights.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Top: <span style={{ color: T.up }}>{scored[0]?.symbol}</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'rankings' as ScTab, label: '🏆 Rankings' },
          { key: 'factors' as ScTab, label: '⚖️ Factors' },
          { key: 'radar' as ScTab, label: '🎯 Radar' },
          { key: 'sectors' as ScTab, label: '📊 Sectors' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'rankings' && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
              <thead><tr style={{ background: T.bg2 }}>
                {['#','Symbol','Spark','Score','Mom.','Val.','Qual.','Grwth','1M','3M','MCap','P/E'].map(h => (
                  <th key={h} style={{ padding: '5px 3px', textAlign: h === 'Symbol' ? 'left' : 'right', color: T.tx3, fontWeight: 600, fontSize: '7px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {scored.map((s, i) => (
                  <tr key={s.symbol} onClick={() => setSel(i)} style={{ borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: sel === i ? `${T.brand}10` : 'transparent' }}>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx3, fontWeight: 700 }}>
                      {s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank-1] : s.rank}
                    </td>
                    <td style={{ padding: '4px 3px' }}>
                      <div style={{ fontWeight: 700, color: T.tx0 }}>{s.symbol}</div>
                      <div style={{ fontSize: '6px', color: T.tx3 }}>{s.sector}</div>
                    </td>
                    <td style={{ padding: '4px 3px', textAlign: 'right' }}><MiniSparkline data={s.sparkData} /></td>
                    <td style={{ padding: '4px 3px', textAlign: 'right' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: s.composite > 60 ? T.up : s.composite > 40 ? T.warn : T.dn }}>{s.composite}</span>
                    </td>
                    <td style={{ padding: '4px 3px', textAlign: 'right' }}><FactorBar value={+s.factors.momentum} maxWidth={40} /></td>
                    <td style={{ padding: '4px 3px', textAlign: 'right' }}><FactorBar value={+s.factors.value} maxWidth={40} /></td>
                    <td style={{ padding: '4px 3px', textAlign: 'right' }}><FactorBar value={+s.factors.quality} maxWidth={40} /></td>
                    <td style={{ padding: '4px 3px', textAlign: 'right' }}><FactorBar value={+s.factors.growth} maxWidth={40} /></td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: s.priceChg1M >= 0 ? T.up : T.dn }}>{s.priceChg1M >= 0 ? '+' : ''}{s.priceChg1M}%</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: s.priceChg3M >= 0 ? T.up : T.dn }}>{s.priceChg3M >= 0 ? '+' : ''}{s.priceChg3M}%</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx1 }}>${s.marketCap}B</td>
                    <td style={{ padding: '4px 3px', textAlign: 'right', color: T.tx1 }}>{s.pe}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'factors' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Factor Weights Configuration</div>
            {weights.map(w => (
              <div key={w.name} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px 8px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: T.tx0, textTransform: 'capitalize' }}>{w.name}</span>
                  <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.brand, fontWeight: 700 }}>{w.weight}%</span>
                </div>
                <div style={{ fontSize: '7px', color: T.tx3, marginBottom: '4px' }}>{w.description}</div>
                <div style={{ height: 4, background: T.bg3, borderRadius: 2 }}>
                  <div style={{ width: `${w.weight * 5}%`, height: '100%', background: T.brand, borderRadius: 2 }} />
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'right', fontSize: '8px', fontFamily: T.mono, color: T.tx3, marginTop: '4px' }}>
              Total: <span style={{ color: weights.reduce((s, w) => s + w.weight, 0) === 100 ? T.up : T.dn }}>{weights.reduce((s, w) => s + w.weight, 0)}%</span>
            </div>
          </div>
        )}
        {tab === 'radar' && (
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {scored.slice(0, 10).map((s, i) => (
                <button key={s.symbol} onClick={() => setSel(i)} style={{
                  background: sel === i ? T.brand : T.bg2, color: sel === i ? '#FFF' : T.tx2,
                  border: `1px solid ${sel === i ? T.brand : T.border}`, borderRadius: T.r,
                  padding: '3px 8px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
                }}>{s.symbol} <span style={{ fontSize: '7px', opacity: 0.7 }}>({s.composite})</span></button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <RadarChart factors={scored[sel].factors} color={T.brand} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: T.tx0, marginBottom: '2px' }}>{scored[sel].symbol}</div>
                <div style={{ fontSize: '8px', color: T.tx2, marginBottom: '8px' }}>{scored[sel].name} · {scored[sel].sector} · Rank #{scored[sel].rank}</div>
                {Object.entries(scored[sel].factors).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: '8px', color: T.tx2, textTransform: 'capitalize' }}>{k}</span>
                    <FactorBar value={+v} />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: '2px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: T.tx0 }}>Composite</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: scored[sel].composite > 60 ? T.up : T.warn, fontFamily: T.mono }}>{scored[sel].composite}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 'sectors' && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Sector Average Scores</div>
            {sectorAvg.map(s => (
              <div key={s.sector} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>{s.sector}</span>
                    <span style={{ fontSize: '7px', color: T.tx3, marginLeft: '6px' }}>{s.count} assets</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: s.avgScore > 55 ? T.up : T.warn, fontFamily: T.mono }}>{s.avgScore}</span>
                </div>
                <div style={{ height: 6, background: T.bg3, borderRadius: 3 }}>
                  <div style={{ width: `${s.avgScore}%`, height: '100%', background: s.avgScore > 55 ? T.up : T.warn, borderRadius: 3 }} />
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {scored.filter(a => a.sector === s.sector).map(a => (
                    <span key={a.symbol} style={{ fontSize: '7px', background: T.bg3, color: T.tx1, borderRadius: '2px', padding: '1px 4px', fontFamily: T.mono }}>
                      {a.symbol}: {a.composite}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ScoringUI2 };
