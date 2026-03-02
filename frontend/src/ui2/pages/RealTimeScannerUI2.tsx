import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Bloomberg Theme ──
const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

// ── Scanner Criteria ──
interface ScanCriteria {
  id: string; name: string; enabled: boolean;
  type: 'price' | 'volume' | 'technical' | 'fundamental';
  operator: '>' | '<' | '=' | 'crosses_above' | 'crosses_below';
  value: number; field: string;
}

const DEFAULT_CRITERIA: ScanCriteria[] = [
  { id: 'c1', name: 'Volume > 2x Avg', enabled: true, type: 'volume', operator: '>', value: 2, field: 'rel_volume' },
  { id: 'c2', name: 'RSI < 30 (Oversold)', enabled: true, type: 'technical', operator: '<', value: 30, field: 'rsi_14' },
  { id: 'c3', name: 'Price > SMA 200', enabled: false, type: 'technical', operator: '>', value: 0, field: 'above_sma200' },
  { id: 'c4', name: 'Gap Up > 3%', enabled: true, type: 'price', operator: '>', value: 3, field: 'gap_pct' },
  { id: 'c5', name: '52W High Breakout', enabled: false, type: 'price', operator: '>', value: 0, field: '52w_high' },
  { id: 'c6', name: 'MACD Cross Up', enabled: false, type: 'technical', operator: 'crosses_above', value: 0, field: 'macd_signal' },
  { id: 'c7', name: 'Unusual Options Activity', enabled: true, type: 'volume', operator: '>', value: 5, field: 'options_vol_ratio' },
  { id: 'c8', name: 'Market Cap > $1B', enabled: false, type: 'fundamental', operator: '>', value: 1e9, field: 'market_cap' },
];

// ── Mock Scan Results ──
interface ScanResult {
  symbol: string; name: string; price: number; change: number; changePct: number;
  volume: number; avgVolume: number; relVolume: number;
  rsi: number; macdSignal: string; pattern: string;
  sector: string; marketCap: number; alertType: string;
  time: string; momentum: number;
}

const SECTORS = ['Technology', 'Healthcare', 'Financial', 'Energy', 'Consumer', 'Industrial', 'Materials', 'Utilities'];
const PATTERNS = ['Bull Flag', 'Cup & Handle', 'Double Bottom', 'Breakout', 'Gap Up', 'Reversal', 'Squeeze', 'Momentum', 'VWAP Reclaim'];
const ALERTS = ['Volume Spike', 'RSI Extreme', '52W High', 'Gap', 'Options Activity', 'Breakout', 'Unusual Flow'];

function generateResults(count: number): ScanResult[] {
  const syms = ['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','AMD','CRM','NFLX','BABA','PLTR','SHOP','SQ','COIN',
    'SNOW','NET','DDOG','ZS','CRWD','ABNB','UBER','RIVN','LCID','NIO','SOFI','MARA','RIOT','GME','AMC',
    'INTC','MU','QCOM','AVGO','TXN','LRCX','ASML','MRVL','ON','SMCI','ARM','PANW','FTNT','OKTA','MNDY'];
  const names = ['Apple Inc','Microsoft','NVIDIA','Tesla','Amazon','Meta','Alphabet','AMD','Salesforce','Netflix',
    'Alibaba','Palantir','Shopify','Block','Coinbase','Snowflake','Cloudflare','Datadog','Zscaler','CrowdStrike',
    'Airbnb','Uber','Rivian','Lucid','NIO','SoFi','Marathon','Riot','GameStop','AMC',
    'Intel','Micron','Qualcomm','Broadcom','TI','Lam Research','ASML','Marvell','ON Semi','Super Micro','ARM','Palo Alto','Fortinet','Okta','Monday'];

  return Array.from({ length: count }, (_, i) => {
    const idx = i % syms.length;
    const price = 20 + Math.random() * 400;
    const changePct = (Math.random() - 0.3) * 12;
    const vol = Math.round(1e6 + Math.random() * 50e6);
    const avgVol = Math.round(vol / (1 + Math.random() * 4));
    return {
      symbol: syms[idx], name: names[idx],
      price: Math.round(price * 100) / 100,
      change: Math.round(price * changePct / 100 * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume: vol, avgVolume: avgVol,
      relVolume: Math.round((vol / avgVol) * 10) / 10,
      rsi: Math.round(20 + Math.random() * 60),
      macdSignal: Math.random() > 0.5 ? 'BULL' : 'BEAR',
      pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
      sector: SECTORS[Math.floor(Math.random() * SECTORS.length)],
      marketCap: Math.round((1 + Math.random() * 300) * 1e9),
      alertType: ALERTS[Math.floor(Math.random() * ALERTS.length)],
      time: `${9 + Math.floor(Math.random() * 7)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      momentum: Math.round((Math.random() - 0.3) * 100) / 10,
    };
  });
}

function fmtVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(v);
}

function fmtCap(v: number): string {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(0) + 'B';
  return '$' + (v / 1e6).toFixed(0) + 'M';
}

// ── Mini Sparkline ──
function Sparkline({ positive }: { positive: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    c.width = 60; c.height = 20;
    ctx.clearRect(0, 0, 60, 20);
    ctx.strokeStyle = positive ? GREEN : RED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let y = 10;
    for (let x = 0; x < 60; x += 3) {
      y += (Math.random() - (positive ? 0.35 : 0.65)) * 3;
      y = Math.max(2, Math.min(18, y));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [positive]);
  return <canvas ref={ref} style={{ width: 60, height: 20 }} />;
}

// ── Live Feed ──
interface LiveEvent { time: string; symbol: string; event: string; color: string; }

function generateFeed(): LiveEvent[] {
  const events = [
    { ev: 'Volume spike detected', color: AMBER },
    { ev: 'RSI oversold (< 30)', color: RED },
    { ev: '52-week high breakout', color: GREEN },
    { ev: 'MACD bullish crossover', color: CYAN },
    { ev: 'Unusual options activity', color: '#ff9800' },
    { ev: 'Gap up > 3%', color: GREEN },
    { ev: 'VWAP reclaim', color: CYAN },
    { ev: 'Squeeze firing', color: AMBER },
  ];
  const syms = ['AAPL','TSLA','NVDA','AMD','META','AMZN','GOOGL','MSFT','CRM','NFLX','COIN','PLTR'];
  return Array.from({ length: 50 }, () => {
    const e = events[Math.floor(Math.random() * events.length)];
    return {
      time: `${9 + Math.floor(Math.random() * 7)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      symbol: syms[Math.floor(Math.random() * syms.length)],
      event: e.ev,
      color: e.color,
    };
  }).sort((a, b) => b.time.localeCompare(a.time));
}

// ── Volume Heatmap Canvas ──
function drawVolumeHeatmap(ctx: CanvasRenderingContext2D, w: number, h: number, results: ScanResult[]) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = AMBER;
  ctx.font = 'bold 11px monospace';
  ctx.fillText('RELATIVE VOLUME HEATMAP', 10, 16);

  const pad = 30;
  const cols = Math.ceil(Math.sqrt(results.length));
  const rows = Math.ceil(results.length / cols);
  const cellW = (w - pad * 2) / cols;
  const cellH = (h - pad - 25) / rows;

  results.forEach((r, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * cellW, y = 25 + row * cellH;
    const intensity = Math.min(1, r.relVolume / 5);
    const g = Math.round(intensity * 200);
    const red = Math.round((1 - intensity) * 50);
    ctx.fillStyle = r.changePct >= 0
      ? `rgba(38, 166, 154, ${0.2 + intensity * 0.8})`
      : `rgba(239, 83, 80, ${0.2 + intensity * 0.8})`;
    ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

    ctx.fillStyle = WHITE;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(r.symbol, x + cellW / 2, y + cellH / 2 - 2);
    ctx.fillStyle = DIM;
    ctx.font = '8px monospace';
    ctx.fillText(r.relVolume + 'x', x + cellW / 2, y + cellH / 2 + 10);
  });
  ctx.textAlign = 'left';
}

// ── Main Component ──
const TABS = ['Scanner', 'Live Feed', 'Volume Map', 'Patterns', 'Presets'];
const SORT_OPTIONS = ['Rel Volume', 'Change %', 'RSI', 'Market Cap', 'Momentum'];

export default function RealTimeScannerUI2() {
  const [tab, setTab] = useState(0);
  const [criteria, setCriteria] = useState<ScanCriteria[]>(DEFAULT_CRITERIA);
  const [results, setResults] = useState<ScanResult[]>(() => generateResults(40));
  const [feed] = useState<LiveEvent[]>(generateFeed);
  const [sortBy, setSortBy] = useState('Rel Volume');
  const [filterSector, setFilterSector] = useState('All');
  const [isScanning, setIsScanning] = useState(true);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);

  // Periodic refresh
  useEffect(() => {
    if (!isScanning) return;
    const iv = setInterval(() => setResults(generateResults(40)), 3000);
    return () => clearInterval(iv);
  }, [isScanning]);

  // Sort & filter results
  const filtered = results
    .filter(r => filterSector === 'All' || r.sector === filterSector)
    .sort((a, b) => {
      switch (sortBy) {
        case 'Change %': return Math.abs(b.changePct) - Math.abs(a.changePct);
        case 'RSI': return a.rsi - b.rsi;
        case 'Market Cap': return b.marketCap - a.marketCap;
        case 'Momentum': return b.momentum - a.momentum;
        default: return b.relVolume - a.relVolume;
      }
    });

  // Draw heatmap
  useEffect(() => {
    if (tab !== 2) return;
    const c = heatRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawVolumeHeatmap(ctx, r.width, r.height, filtered.slice(0, 36));
  }, [tab, filtered]);

  const toggleCriteria = (id: string) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  // Stats
  const stats = {
    total: filtered.length,
    bullish: filtered.filter(r => r.changePct > 0).length,
    bearish: filtered.filter(r => r.changePct < 0).length,
    avgRelVol: filtered.length ? (filtered.reduce((s, r) => s + r.relVolume, 0) / filtered.length).toFixed(1) : '0',
    highestGainer: filtered.reduce((max, r) => r.changePct > max.changePct ? r : max, filtered[0]),
    biggestLoser: filtered.reduce((min, r) => r.changePct < min.changePct ? r : min, filtered[0]),
  };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>🔍 REAL-TIME SCANNER</span>
        <span style={{ color: DIM }}>|</span>
        <button onClick={() => setIsScanning(!isScanning)} style={{
          padding: '3px 12px', background: isScanning ? GREEN : RED, border: 'none', color: '#000',
          fontFamily: 'monospace', fontSize: 10, cursor: 'pointer', borderRadius: 2
        }}>{isScanning ? '● SCANNING' : '■ PAUSED'}</button>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: DIM }}>{stats.total} matches</span>
        <span style={{ color: GREEN }}>↑{stats.bullish}</span>
        <span style={{ color: RED }}>↓{stats.bearish}</span>
        <span style={{ color: DIM, marginLeft: 'auto' }}>Avg Rel Vol: {stats.avgRelVol}x</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', background: tab === i ? PANEL : 'transparent', color: tab === i ? AMBER : DIM,
            border: 'none', borderBottom: tab === i ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 11
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left — Criteria */}
        <div style={{ width: 240, borderRight: `1px solid ${BORDER}`, overflow: 'auto', padding: 12 }}>
          <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>SCAN CRITERIA</div>
          {criteria.map(c => (
            <label key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px',
              borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
              background: c.enabled ? 'rgba(245,166,35,0.05)' : 'transparent'
            }}>
              <input type="checkbox" checked={c.enabled} onChange={() => toggleCriteria(c.id)} />
              <div>
                <div style={{ color: c.enabled ? WHITE : DIM, fontSize: 11 }}>{c.name}</div>
                <div style={{ color: DIM, fontSize: 9 }}>{c.type.toUpperCase()}</div>
              </div>
            </label>
          ))}

          <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 10 }}>FILTERS</div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: DIM, fontSize: 10 }}>Sector:</span>
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={{
                width: '100%', marginTop: 4, padding: '4px', background: '#1a1a1a',
                border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 10
              }}>
                <option value="All">All Sectors</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span style={{ color: DIM, fontSize: 10 }}>Sort By:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                width: '100%', marginTop: 4, padding: '4px', background: '#1a1a1a',
                border: `1px solid ${BORDER}`, color: WHITE, fontFamily: 'monospace', fontSize: 10
              }}>
                {SORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 10 }}>TOP MOVERS</div>
            {stats.highestGainer && (
              <div style={{ padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ color: DIM, fontSize: 9 }}>Biggest Gainer</div>
                <div style={{ color: GREEN }}>{stats.highestGainer.symbol} +{stats.highestGainer.changePct}%</div>
              </div>
            )}
            {stats.biggestLoser && (
              <div style={{ padding: '4px 0' }}>
                <div style={{ color: DIM, fontSize: 9 }}>Biggest Loser</div>
                <div style={{ color: RED }}>{stats.biggestLoser.symbol} {stats.biggestLoser.changePct}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tab === 0 && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                    {['Symbol', 'Price', 'Change', '%', 'Volume', 'Rel Vol', 'RSI', 'Pattern', 'Alert', 'Chart', 'Time'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.symbol + r.time}
                      onClick={() => setSelectedRow(r.symbol)}
                      style={{
                        cursor: 'pointer',
                        background: selectedRow === r.symbol ? 'rgba(245,166,35,0.1)' : 'transparent',
                        borderBottom: `1px solid ${BORDER}`
                      }}>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ color: AMBER, fontWeight: 'bold' }}>{r.symbol}</span>
                        <div style={{ color: DIM, fontSize: 9 }}>{r.name}</div>
                      </td>
                      <td style={{ padding: '5px 8px', color: WHITE }}>${r.price.toFixed(2)}</td>
                      <td style={{ padding: '5px 8px', color: r.change >= 0 ? GREEN : RED }}>
                        {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}
                      </td>
                      <td style={{ padding: '5px 8px', color: r.changePct >= 0 ? GREEN : RED }}>
                        {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '5px 8px', color: TEXT }}>{fmtVol(r.volume)}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{
                          color: r.relVolume > 3 ? AMBER : r.relVolume > 1.5 ? GREEN : DIM,
                          fontWeight: r.relVolume > 3 ? 'bold' : 'normal'
                        }}>{r.relVolume}x</span>
                      </td>
                      <td style={{ padding: '5px 8px', color: r.rsi < 30 ? RED : r.rsi > 70 ? GREEN : TEXT }}>{r.rsi}</td>
                      <td style={{ padding: '5px 8px', color: CYAN, fontSize: 10 }}>{r.pattern}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ padding: '1px 6px', borderRadius: 2, fontSize: 9, background: 'rgba(245,166,35,0.15)', color: AMBER }}>
                          {r.alertType}
                        </span>
                      </td>
                      <td style={{ padding: '5px 8px' }}><Sparkline positive={r.changePct >= 0} /></td>
                      <td style={{ padding: '5px 8px', color: DIM, fontSize: 10 }}>{r.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 1 && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>LIVE ALERT FEED</div>
              {feed.map((e, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '6px 8px',
                  borderBottom: `1px solid ${BORDER}`,
                  background: i < 3 ? 'rgba(245,166,35,0.05)' : 'transparent'
                }}>
                  <span style={{ color: DIM, fontSize: 10, minWidth: 65 }}>{e.time}</span>
                  <span style={{ color: AMBER, fontWeight: 'bold', minWidth: 50 }}>{e.symbol}</span>
                  <span style={{ color: e.color, flex: 1 }}>{e.event}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 2 && (
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={heatRef} style={{ width: '100%', height: '100%' }} />
            </div>
          )}

          {tab === 3 && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>PATTERN RECOGNITION — DETECTED TODAY</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
                {PATTERNS.map(pattern => {
                  const matches = filtered.filter(r => r.pattern === pattern);
                  return (
                    <div key={pattern} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
                      <div style={{ color: CYAN, fontWeight: 'bold', marginBottom: 6 }}>{pattern}</div>
                      <div style={{ color: DIM, fontSize: 10, marginBottom: 8 }}>{matches.length} matches</div>
                      {matches.slice(0, 4).map(m => (
                        <div key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span style={{ color: AMBER }}>{m.symbol}</span>
                          <span style={{ color: m.changePct >= 0 ? GREEN : RED }}>
                            {m.changePct >= 0 ? '+' : ''}{m.changePct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 4 && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>SCANNER PRESETS</div>
              {[
                { name: 'Momentum Breakouts', desc: 'Price > SMA20 & SMA50, Volume > 2x, RSI 50-70', type: 'Momentum' },
                { name: 'Oversold Reversals', desc: 'RSI < 25, MACD cross up, Vol spike, Near support', type: 'Mean Reversion' },
                { name: 'Gap Up Runners', desc: 'Gap > 3%, Volume > 3x avg, Pre-market high', type: 'Day Trading' },
                { name: 'Earnings Volatility', desc: 'Earnings within 5 days, IV > 50%, Volume spike', type: 'Options' },
                { name: 'Dark Pool Prints', desc: 'Dark pool volume > 40%, Block trades > $1M', type: 'Institutional' },
                { name: 'New 52W Highs', desc: 'Price > 52W high, Volume confirm, Trend up', type: 'Trend Following' },
                { name: 'Squeeze Play', desc: 'BB inside KC, Low vol, Momentum building', type: 'Volatility' },
                { name: 'VWAP Reclaim', desc: 'Price crosses above VWAP, Volume confirms', type: 'Intraday' },
              ].map((preset, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderBottom: `1px solid ${BORDER}`,
                  background: PANEL, marginBottom: 4, cursor: 'pointer'
                }}>
                  <div>
                    <div style={{ color: WHITE, fontWeight: 'bold', marginBottom: 2 }}>{preset.name}</div>
                    <div style={{ color: DIM, fontSize: 10 }}>{preset.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', background: 'rgba(0,188,212,0.15)', color: CYAN, fontSize: 9, borderRadius: 2 }}>
                      {preset.type}
                    </span>
                    <div style={{ marginTop: 4 }}>
                      <button style={{
                        padding: '3px 10px', background: 'rgba(245,166,35,0.2)', border: 'none',
                        color: AMBER, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer'
                      }}>LOAD</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{criteria.filter(c => c.enabled).length} criteria active</span>
        <span style={{ color: isScanning ? GREEN : RED }}>{isScanning ? 'Scanning every 3s' : 'Paused'}</span>
        <span style={{ color: DIM }}>Last scan: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
