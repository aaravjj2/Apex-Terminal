/**
 * DarkPoolUI2 — Dark Pool Activity, Block Trades, Hidden Liquidity
 * Monitors off-exchange prints, dark pool volume %, block trades,
 * short sale data, FINRA ADF/TRF, institutional sweeps.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';
const PURPLE = '#9b59b6', CYAN = '#00bcd4';

interface DPTrade {
  id: number; time: string; symbol: string; price: number; size: number;
  venue: string; type: 'BLOCK' | 'SWEEP' | 'PRINT' | 'CROSS';
  side: 'BUY' | 'SELL' | 'UNKNOWN'; premium: number; dpPercent: number;
}

interface DPSymbol {
  symbol: string; name: string; dpVol: number; litVol: number; dpPct: number;
  shortVol: number; shortPct: number; avgBlockSize: number;
  netPrem: number; darkSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  prints: number; blocks: number; sweeps: number;
}

interface Venue {
  name: string; code: string; volume: number; share: number; avgDelay: number; color: string;
}

/* ─── Mock Data ──────────────────────────────────────────────────────── */
function genData() {
  let s = 91;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  const syms = [
    { symbol: 'AAPL', name: 'Apple Inc' }, { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'NVDA', name: 'NVIDIA Corp' }, { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'AMZN', name: 'Amazon' }, { symbol: 'META', name: 'Meta Platforms' },
    { symbol: 'TSLA', name: 'Tesla Inc' }, { symbol: 'AMD', name: 'Advanced Micro' },
    { symbol: 'NFLX', name: 'Netflix' }, { symbol: 'SPY', name: 'SPDR S&P 500' },
    { symbol: 'QQQ', name: 'Invesco QQQ' }, { symbol: 'IWM', name: 'iShares R2000' },
    { symbol: 'COIN', name: 'Coinbase' }, { symbol: 'PLTR', name: 'Palantir' },
    { symbol: 'SQ', name: 'Block Inc' },
  ];

  const venues: Venue[] = [
    { name: 'FINRA TRF', code: 'TRF', volume: 0, share: 0, avgDelay: 0, color: '#4a90d9' },
    { name: 'FINRA ADF', code: 'ADF', volume: 0, share: 0, avgDelay: 0, color: '#f5a623' },
    { name: 'UBS ATS', code: 'UBS', volume: 0, share: 0, avgDelay: 0, color: '#26a69a' },
    { name: 'Crossfinder', code: 'CSFB', volume: 0, share: 0, avgDelay: 0, color: '#e74c3c' },
    { name: 'Sigma X', code: 'GS', volume: 0, share: 0, avgDelay: 0, color: '#9b59b6' },
    { name: 'MS Pool', code: 'MS', volume: 0, share: 0, avgDelay: 0, color: '#3498db' },
    { name: 'Level ATS', code: 'LEVEL', volume: 0, share: 0, avgDelay: 0, color: '#e67e22' },
    { name: 'IEX', code: 'IEX', volume: 0, share: 0, avgDelay: 0, color: '#1abc9c' },
  ];

  let totalVenueVol = 0;
  venues.forEach(v => { v.volume = Math.floor(rng() * 50000000 + 5000000); v.avgDelay = rng() * 30; totalVenueVol += v.volume; });
  venues.forEach(v => v.share = v.volume / totalVenueVol * 100);

  const symbols: DPSymbol[] = syms.map(sy => {
    const litVol = Math.floor(rng() * 80000000 + 10000000);
    const dpVol = Math.floor(litVol * (0.3 + rng() * 0.25));
    const shortVol = Math.floor((litVol + dpVol) * (0.2 + rng() * 0.3));
    const netPrem = (rng() - 0.4) * 5000000;
    return {
      ...sy, dpVol, litVol, dpPct: dpVol / (dpVol + litVol) * 100,
      shortVol, shortPct: shortVol / (litVol + dpVol) * 100,
      avgBlockSize: Math.floor(rng() * 50000 + 5000),
      netPrem, darkSentiment: netPrem > 1000000 ? 'BULLISH' : netPrem < -1000000 ? 'BEARISH' : 'NEUTRAL',
      prints: Math.floor(rng() * 5000 + 500),
      blocks: Math.floor(rng() * 200 + 10),
      sweeps: Math.floor(rng() * 100 + 5),
    };
  });

  const types: DPTrade['type'][] = ['BLOCK', 'SWEEP', 'PRINT', 'CROSS'];
  const sides: DPTrade['side'][] = ['BUY', 'SELL', 'UNKNOWN'];
  const trades: DPTrade[] = [];
  for (let i = 0; i < 100; i++) {
    const sym = syms[Math.floor(rng() * syms.length)];
    const h = Math.floor(rng() * 7) + 9;
    const m = Math.floor(rng() * 60);
    const sec = Math.floor(rng() * 60);
    const type = types[Math.floor(rng() * types.length)];
    const size = type === 'BLOCK' ? Math.floor(rng() * 100000 + 10000) :
                 type === 'SWEEP' ? Math.floor(rng() * 50000 + 5000) :
                 Math.floor(rng() * 5000 + 100);
    trades.push({
      id: i, time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`,
      symbol: sym.symbol, price: 100 + rng() * 400, size, type,
      venue: venues[Math.floor(rng() * venues.length)].code,
      side: sides[Math.floor(rng() * sides.length)],
      premium: (rng() - 0.4) * 2, dpPercent: 30 + rng() * 30,
    });
  }
  trades.sort((a, b) => b.time.localeCompare(a.time));

  return { symbols, venues, trades };
}

/* ─── Canvas: Dark Pool Volume Distribution ──────────────────────────── */
function DPVolumeChart({ venues }: { venues: Venue[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const sorted = [...venues].sort((a, b) => b.share - a.share);
    const barH = (h - 30) / sorted.length - 4;
    const maxShare = sorted[0]?.share || 1;

    sorted.forEach((v, i) => {
      const y = 10 + i * (barH + 4);
      const barW = (v.share / maxShare) * (w - 130);

      ctx.fillStyle = v.color + '44';
      ctx.fillRect(80, y, barW, barH);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(80, y, barW, barH);

      ctx.fillStyle = '#ccc'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
      ctx.fillText(v.code, 75, y + barH / 2 + 3);

      ctx.fillStyle = v.color; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${v.share.toFixed(1)}%`, 82 + barW + 4, y + barH / 2 + 3);
    });
  }, [venues]);
  return <canvas ref={ref} style={{ width: '100%', height: 220, borderRadius: 4 }} />;
}

/* ─── Canvas: Short Volume Histogram ─────────────────────────────────── */
function ShortVolumeChart({ symbols }: { symbols: DPSymbol[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const sorted = [...symbols].sort((a, b) => b.shortPct - a.shortPct).slice(0, 12);
    const barW = (w - 40) / sorted.length - 4;
    const maxS = Math.max(...sorted.map(s => s.shortPct));

    sorted.forEach((sym, i) => {
      const x = 30 + i * (barW + 4);
      const barH = (sym.shortPct / maxS) * (h - 40);
      const y = h - 20 - barH;

      const grad = ctx.createLinearGradient(x, y, x, h - 20);
      grad.addColorStop(0, sym.shortPct > 40 ? RED : sym.shortPct > 30 ? AMBER : PURPLE);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, barH);

      ctx.strokeStyle = sym.shortPct > 40 ? RED : sym.shortPct > 30 ? AMBER : PURPLE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barW, barH);

      ctx.fillStyle = '#ccc'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(sym.symbol, x + barW / 2, h - 8);
      ctx.fillStyle = sym.shortPct > 40 ? RED : MUTED; ctx.font = 'bold 7px monospace';
      ctx.fillText(`${sym.shortPct.toFixed(0)}%`, x + barW / 2, y - 4);
    });

    // 50% line
    const y50 = h - 20 - (50 / maxS) * (h - 40);
    if (y50 > 10) {
      ctx.strokeStyle = RED + '44'; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(30, y50); ctx.lineTo(w - 10, y50); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = RED; ctx.font = '7px monospace'; ctx.textAlign = 'left';
      ctx.fillText('50%', 2, y50 + 3);
    }
  }, [symbols]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: 4 }} />;
}

const TABS = ['TAPE', 'ANALYTICS', 'VENUES', 'SHORT SALE'] as const;
type Tab = typeof TABS[number];

export default function DarkPoolUI2() {
  const [tab, setTab] = useState<Tab>('TAPE');
  const [data] = useState(() => genData());
  const [filterType, setFilterType] = useState<string>('All');
  const [minSize, setMinSize] = useState(0);

  const filteredTrades = useMemo(() => {
    return data.trades.filter(t => {
      if (filterType !== 'All' && t.type !== filterType) return false;
      if (t.size < minSize) return false;
      return true;
    });
  }, [data.trades, filterType, minSize]);

  const totalDP = data.symbols.reduce((s, sym) => s + sym.dpVol, 0);
  const totalLit = data.symbols.reduce((s, sym) => s + sym.litVol, 0);
  const dpPctAll = totalDP / (totalDP + totalLit) * 100;

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: PURPLE }}>🕳️ DARK POOL MONITOR</span>
          {tab === 'TAPE' && (
            <>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '3px 8px', fontSize: 10 }}>
                <option>All</option><option>BLOCK</option><option>SWEEP</option><option>PRINT</option><option>CROSS</option>
              </select>
              <select value={minSize} onChange={e => setMinSize(+e.target.value)}
                style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '3px 8px', fontSize: 10 }}>
                <option value={0}>Min Size</option><option value={1000}>1K+</option><option value={10000}>10K+</option><option value={50000}>50K+</option><option value={100000}>100K+</option>
              </select>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 10, alignItems: 'center' }}>
          {[
            { l: 'DP Volume', v: `${(totalDP / 1e9).toFixed(1)}B`, c: PURPLE },
            { l: 'DP %', v: `${dpPctAll.toFixed(1)}%`, c: CYAN },
            { l: 'Prints', v: filteredTrades.length.toString() },
            { l: 'Blocks', v: filteredTrades.filter(t => t.type === 'BLOCK').length.toString(), c: AMBER },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: MUTED }}>{s.l}</div>
              <div style={{ fontWeight: 700, color: (s as any).c || '#eee' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? PURPLE : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${PURPLE}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'TAPE' && (
          <div style={panelStyle}>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: PANEL }}>
                    {['Time', 'Symbol', 'Price', 'Size', 'Notional', 'Type', 'Side', 'Venue', 'Premium', 'DP%'].map(h => (
                      <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Symbol' ? 'left' : 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map(t => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${BORDER}22`,
                      background: t.type === 'BLOCK' ? 'rgba(155,89,182,0.04)' : t.type === 'SWEEP' ? 'rgba(245,166,35,0.04)' : 'transparent',
                    }}>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontFamily: 'monospace', fontSize: 9 }}>{t.time}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>{t.symbol}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>${t.price.toFixed(2)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: t.size > 10000 ? 700 : 400, color: t.size > 50000 ? AMBER : '#eee' }}>
                        {t.size.toLocaleString()}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>${(t.price * t.size / 1e6).toFixed(2)}M</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <span style={{
                          padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 700,
                          background: t.type === 'BLOCK' ? `${PURPLE}22` : t.type === 'SWEEP' ? `${AMBER}22` : t.type === 'CROSS' ? `${CYAN}22` : `${MUTED}22`,
                          color: t.type === 'BLOCK' ? PURPLE : t.type === 'SWEEP' ? AMBER : t.type === 'CROSS' ? CYAN : MUTED,
                        }}>{t.type}</span>
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <span style={{ color: t.side === 'BUY' ? GREEN : t.side === 'SELL' ? RED : MUTED, fontWeight: 600 }}>{t.side}</span>
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontSize: 9 }}>{t.venue}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: t.premium > 0 ? GREEN : t.premium < 0 ? RED : MUTED }}>
                        {t.premium > 0 ? '+' : ''}{t.premium.toFixed(2)}%
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: PURPLE }}>{t.dpPercent.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'ANALYTICS' && (
          <div style={panelStyle}>
            <span style={{ color: PURPLE, fontWeight: 600, fontSize: 11, marginBottom: 8, display: 'block' }}>DARK POOL ACTIVITY BY SYMBOL</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Symbol', 'DP Vol', 'Lit Vol', 'DP %', 'Short %', 'Avg Block', 'Net Prem', 'Sentiment', 'Prints', 'Blocks', 'Sweeps'].map(h => (
                    <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Symbol' ? 'left' : 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.symbols].sort((a, b) => b.dpVol - a.dpVol).map(sym => (
                  <tr key={sym.symbol} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                    <td style={{ padding: '5px 6px', textAlign: 'left' }}>
                      <div><span style={{ fontWeight: 700 }}>{sym.symbol}</span></div>
                      <div style={{ color: MUTED, fontSize: 8 }}>{sym.name}</div>
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>{(sym.dpVol / 1e6).toFixed(1)}M</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>{(sym.litVol / 1e6).toFixed(1)}M</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <div style={{ width: 30, height: 4, background: '#1a1a1a', borderRadius: 2 }}>
                          <div style={{ width: `${sym.dpPct}%`, height: '100%', background: PURPLE, borderRadius: 2 }} />
                        </div>
                        <span style={{ color: PURPLE, fontWeight: 600 }}>{sym.dpPct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: sym.shortPct > 40 ? RED : MUTED }}>{sym.shortPct.toFixed(0)}%</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>{(sym.avgBlockSize / 1000).toFixed(1)}K</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: sym.netPrem > 0 ? GREEN : RED, fontWeight: 600 }}>
                      {sym.netPrem > 0 ? '+' : ''}${(sym.netPrem / 1e6).toFixed(1)}M
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      <span style={{
                        padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 700,
                        background: sym.darkSentiment === 'BULLISH' ? `${GREEN}22` : sym.darkSentiment === 'BEARISH' ? `${RED}22` : `${MUTED}22`,
                        color: sym.darkSentiment === 'BULLISH' ? GREEN : sym.darkSentiment === 'BEARISH' ? RED : MUTED,
                      }}>{sym.darkSentiment}</span>
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>{sym.prints.toLocaleString()}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: AMBER }}>{sym.blocks}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: CYAN }}>{sym.sweeps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'VENUES' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: PURPLE, fontWeight: 600, fontSize: 11 }}>VENUE MARKET SHARE</span>
              <DPVolumeChart venues={data.venues} />
            </div>
            <div style={panelStyle}>
              <span style={{ color: PURPLE, fontWeight: 600, fontSize: 11 }}>VENUE DETAILS</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Venue', 'Code', 'Volume', 'Share', 'Avg Delay'].map(h => (
                      <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Venue' ? 'left' : 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.venues].sort((a, b) => b.share - a.share).map(v => (
                    <tr key={v.code} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: '5px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: v.color }} />
                        {v.name}
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: MUTED, fontFamily: 'monospace' }}>{v.code}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>{(v.volume / 1e6).toFixed(1)}M</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: v.color }}>
                        {v.share.toFixed(1)}%
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: v.avgDelay > 15 ? RED : MUTED }}>{v.avgDelay.toFixed(1)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'SHORT SALE' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: PURPLE, fontWeight: 600, fontSize: 11 }}>SHORT VOLUME % BY SYMBOL</span>
              <ShortVolumeChart symbols={data.symbols} />
            </div>
            <div style={panelStyle}>
              <span style={{ color: PURPLE, fontWeight: 600, fontSize: 11 }}>SHORT SALE MONITOR</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Symbol', 'Short Vol', 'Total Vol', 'Short %', 'Alert'].map(h => (
                      <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Symbol' ? 'left' : 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.symbols].sort((a, b) => b.shortPct - a.shortPct).map(sym => (
                    <tr key={sym.symbol} style={{ borderBottom: `1px solid ${BORDER}22`, background: sym.shortPct > 45 ? 'rgba(239,83,80,0.04)' : 'transparent' }}>
                      <td style={{ padding: '5px 6px', fontWeight: 700 }}>{sym.symbol}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>{(sym.shortVol / 1e6).toFixed(1)}M</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>{((sym.litVol + sym.dpVol) / 1e6).toFixed(1)}M</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <div style={{ width: 40, height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                            <div style={{ width: `${Math.min(100, sym.shortPct * 2)}%`, height: '100%', borderRadius: 3,
                              background: sym.shortPct > 40 ? RED : sym.shortPct > 30 ? AMBER : GREEN }} />
                          </div>
                          <span style={{ color: sym.shortPct > 40 ? RED : MUTED, fontWeight: 600 }}>{sym.shortPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                        {sym.shortPct > 45 && <span style={{ padding: '1px 4px', borderRadius: 2, fontSize: 8, background: `${RED}22`, color: RED, fontWeight: 700 }}>HIGH</span>}
                        {sym.shortPct > 35 && sym.shortPct <= 45 && <span style={{ padding: '1px 4px', borderRadius: 2, fontSize: 8, background: `${AMBER}22`, color: AMBER }}>ELEVATED</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
