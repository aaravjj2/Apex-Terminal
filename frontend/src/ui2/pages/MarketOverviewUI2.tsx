import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Bloomberg Theme ──
const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

// ── Market Data ──
interface MarketIndex {
  name: string; region: string; value: number; change: number; changePct: number;
  volume: string; marketCap: string; pe: number; ytd: number; currency: string;
}

const INDICES: MarketIndex[] = [
  { name: 'S&P 500', region: 'US', value: 5321.41, change: 23.45, changePct: 0.44, volume: '3.2B', marketCap: '$44.8T', pe: 23.2, ytd: 12.3, currency: 'USD' },
  { name: 'Dow Jones', region: 'US', value: 39872.99, change: 134.21, changePct: 0.34, volume: '312M', marketCap: '$14.1T', pe: 20.8, ytd: 6.1, currency: 'USD' },
  { name: 'NASDAQ 100', region: 'US', value: 18808.35, change: 98.77, changePct: 0.53, volume: '5.4B', marketCap: '$26.2T', pe: 33.1, ytd: 14.8, currency: 'USD' },
  { name: 'Russell 2000', region: 'US', value: 2072.56, change: -8.34, changePct: -0.40, volume: '1.8B', marketCap: '$3.1T', pe: 26.5, ytd: 2.1, currency: 'USD' },
  { name: 'FTSE 100', region: 'EU', value: 8248.49, change: 42.31, changePct: 0.52, volume: '845M', marketCap: '£2.1T', pe: 14.2, ytd: 8.7, currency: 'GBP' },
  { name: 'DAX 40', region: 'EU', value: 18693.37, change: -56.12, changePct: -0.30, volume: '123M', marketCap: '€1.8T', pe: 15.4, ytd: 11.2, currency: 'EUR' },
  { name: 'CAC 40', region: 'EU', value: 8088.24, change: 18.67, changePct: 0.23, volume: '98M', marketCap: '€2.5T', pe: 16.1, ytd: 9.3, currency: 'EUR' },
  { name: 'Euro Stoxx 50', region: 'EU', value: 5023.89, change: 12.45, changePct: 0.25, volume: '265M', marketCap: '€4.2T', pe: 14.8, ytd: 10.5, currency: 'EUR' },
  { name: 'Nikkei 225', region: 'APAC', value: 38703.51, change: 234.56, changePct: 0.61, volume: '1.2B', marketCap: '¥860T', pe: 21.3, ytd: 16.2, currency: 'JPY' },
  { name: 'Hang Seng', region: 'APAC', value: 18415.18, change: -87.23, changePct: -0.47, volume: '1.6B', marketCap: 'HK$34T', pe: 9.8, ytd: 4.1, currency: 'HKD' },
  { name: 'Shanghai Comp', region: 'APAC', value: 3088.64, change: 15.89, changePct: 0.52, volume: '4.1B', marketCap: '¥63T', pe: 12.4, ytd: 3.8, currency: 'CNY' },
  { name: 'ASX 200', region: 'APAC', value: 7819.42, change: 28.67, changePct: 0.37, volume: '456M', marketCap: 'A$2.8T', pe: 17.6, ytd: 5.4, currency: 'AUD' },
  { name: 'KOSPI', region: 'APAC', value: 2734.89, change: -12.34, changePct: -0.45, volume: '1.1B', marketCap: '₩2100T', pe: 13.2, ytd: 1.9, currency: 'KRW' },
  { name: 'Sensex', region: 'APAC', value: 74339.44, change: 345.67, changePct: 0.47, volume: '892M', marketCap: '₹385T', pe: 24.1, ytd: 8.3, currency: 'INR' },
  { name: 'IBOVESPA', region: 'EM', value: 127483.12, change: -456.78, changePct: -0.36, volume: '2.3B', marketCap: 'R$4.8T', pe: 8.9, ytd: -5.2, currency: 'BRL' },
  { name: 'MOEX Russia', region: 'EM', value: 3423.67, change: 23.45, changePct: 0.69, volume: '78M', marketCap: '₽54T', pe: 5.2, ytd: 14.1, currency: 'RUB' },
];

// ── Sector Data ──
interface SectorPerf { name: string; change: number; volume: string; leaders: string[]; }
const SECTOR_DATA: SectorPerf[] = [
  { name: 'Technology', change: 0.82, volume: '2.1B', leaders: ['NVDA +3.2%', 'MSFT +1.1%', 'AAPL +0.8%'] },
  { name: 'Healthcare', change: -0.34, volume: '890M', leaders: ['LLY +2.1%', 'UNH -1.2%', 'JNJ -0.5%'] },
  { name: 'Financials', change: 0.45, volume: '1.3B', leaders: ['JPM +1.4%', 'GS +0.9%', 'BAC +0.6%'] },
  { name: 'Energy', change: -0.67, volume: '745M', leaders: ['XOM -1.2%', 'CVX -0.8%', 'SLB +0.3%'] },
  { name: 'Consumer Disc', change: 0.29, volume: '1.1B', leaders: ['AMZN +1.5%', 'TSLA +2.8%', 'HD -0.4%'] },
  { name: 'Industrials', change: 0.15, volume: '560M', leaders: ['GE +1.8%', 'CAT -0.3%', 'RTX +0.5%'] },
  { name: 'Materials', change: -0.21, volume: '320M', leaders: ['LIN +0.6%', 'APD -0.9%', 'FCX -1.1%'] },
  { name: 'Utilities', change: 0.08, volume: '180M', leaders: ['NEE +0.4%', 'SO +0.3%', 'DUK -0.1%'] },
  { name: 'Real Estate', change: -0.55, volume: '245M', leaders: ['PLD -0.8%', 'AMT +0.2%', 'CCI -1.0%'] },
  { name: 'Comm Services', change: 0.71, volume: '980M', leaders: ['META +2.3%', 'GOOGL +1.2%', 'NFLX +0.9%'] },
  { name: 'Consumer Stap', change: 0.12, volume: '410M', leaders: ['PG +0.5%', 'KO +0.3%', 'PEP -0.2%'] },
];

// ── Top Movers ──
interface Mover { symbol: string; price: number; change: number; volume: string; }
function genMovers(bull: boolean): Mover[] {
  const syms = bull
    ? ['NVDA', 'SMCI', 'ARM', 'PLTR', 'COIN', 'TSLA', 'AMD', 'META', 'CRM', 'NFLX']
    : ['INTC', 'BABA', 'NIO', 'LCID', 'RIVN', 'SNAP', 'PYPL', 'DIS', 'BA', 'PFE'];
  return syms.map((s, i) => ({
    symbol: s,
    price: 20 + Math.random() * 400,
    change: bull ? 1 + Math.random() * 8 : -(1 + Math.random() * 8),
    volume: fmtV(1e6 + Math.random() * 50e6),
  }));
}
function fmtV(v: number): string { return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K'; }

// ── World Clock ──
const MARKETS = [
  { name: 'New York', tz: 'America/New_York', open: 9.5, close: 16, flag: '🇺🇸' },
  { name: 'London', tz: 'Europe/London', open: 8, close: 16.5, flag: '🇬🇧' },
  { name: 'Frankfurt', tz: 'Europe/Berlin', open: 9, close: 17.5, flag: '🇩🇪' },
  { name: 'Tokyo', tz: 'Asia/Tokyo', open: 9, close: 15, flag: '🇯🇵' },
  { name: 'Hong Kong', tz: 'Asia/Hong_Kong', open: 9.5, close: 16, flag: '🇭🇰' },
  { name: 'Shanghai', tz: 'Asia/Shanghai', open: 9.5, close: 15, flag: '🇨🇳' },
  { name: 'Sydney', tz: 'Australia/Sydney', open: 10, close: 16, flag: '🇦🇺' },
  { name: 'Mumbai', tz: 'Asia/Kolkata', open: 9.25, close: 15.5, flag: '🇮🇳' },
];

// ── Advance / Decline ──
interface BreadthData { advances: number; declines: number; unchanged: number; newHighs: number; newLows: number; }
const BREADTH: BreadthData = { advances: 1847, declines: 1523, unchanged: 234, newHighs: 87, newLows: 23 };

// ── Canvas: Global Heatmap ──
function drawGlobalHeatmap(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = AMBER;
  ctx.font = 'bold 12px monospace';
  ctx.fillText('GLOBAL EQUITY INDICES — PERFORMANCE MAP', 15, 18);

  const regions: Record<string, MarketIndex[]> = { US: [], EU: [], APAC: [], EM: [] };
  INDICES.forEach(i => regions[i.region]?.push(i));

  let yOffset = 30;
  Object.entries(regions).forEach(([region, indices]) => {
    ctx.fillStyle = CYAN;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(region, 15, yOffset + 12);
    yOffset += 18;

    const cols = Math.min(indices.length, 4);
    const cellW = (w - 40) / cols;
    const cellH = 55;

    indices.forEach((idx, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 15 + col * cellW;
      const y = yOffset + row * (cellH + 4);

      const intensity = Math.min(1, Math.abs(idx.changePct) / 2);
      ctx.fillStyle = idx.changePct >= 0
        ? `rgba(38, 166, 154, ${0.15 + intensity * 0.5})`
        : `rgba(239, 83, 80, ${0.15 + intensity * 0.5})`;
      ctx.fillRect(x, y, cellW - 4, cellH);

      ctx.fillStyle = WHITE;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(idx.name, x + 6, y + 14);

      ctx.fillStyle = idx.changePct >= 0 ? GREEN : RED;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${idx.changePct >= 0 ? '+' : ''}${idx.changePct.toFixed(2)}%`, x + 6, y + 32);

      ctx.fillStyle = DIM;
      ctx.font = '9px monospace';
      ctx.fillText(idx.value.toLocaleString(), x + 6, y + 46);
    });

    const rows = Math.ceil(indices.length / cols);
    yOffset += rows * (cellH + 4) + 8;
  });
}

// ── Canvas: Sector Bars ──
function drawSectorBars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = AMBER;
  ctx.font = 'bold 11px monospace';
  ctx.fillText('SECTOR PERFORMANCE', 10, 16);

  const pad = { top: 28, right: 15, bottom: 10, left: 100 };
  const cw = w - pad.left - pad.right;
  const sorted = [...SECTOR_DATA].sort((a, b) => b.change - a.change);
  const maxAbs = Math.max(...sorted.map(s => Math.abs(s.change)), 0.5);
  const barH = Math.min(22, (h - pad.top - pad.bottom) / sorted.length - 2);

  sorted.forEach((s, i) => {
    const y = pad.top + i * (barH + 3);
    const barW = (s.change / maxAbs) * (cw / 2);
    const center = pad.left + cw / 2;

    ctx.fillStyle = DIM;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(s.name, pad.left - 5, y + barH / 2 + 3);

    ctx.fillStyle = s.change >= 0 ? GREEN : RED;
    if (s.change >= 0) {
      ctx.fillRect(center, y, barW, barH);
    } else {
      ctx.fillRect(center + barW, y, -barW, barH);
    }

    ctx.fillStyle = WHITE;
    ctx.font = '9px monospace';
    ctx.textAlign = s.change >= 0 ? 'left' : 'right';
    const labelX = s.change >= 0 ? center + barW + 5 : center + barW - 5;
    ctx.fillText(`${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%`, labelX, y + barH / 2 + 3);
  });
  ctx.textAlign = 'left';
}

// ── Main Component ──
const TABS = ['Overview', 'Indices', 'Sectors', 'Movers', 'World Clock', 'Breadth'];

export default function MarketOverviewUI2() {
  const [tab, setTab] = useState(0);
  const [region, setRegion] = useState('All');
  const [gainers] = useState(() => genMovers(true));
  const [losers] = useState(() => genMovers(false));
  const heatRef = useRef<HTMLCanvasElement>(null);
  const sectorRef = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (tab !== 0) return;
    const c = heatRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawGlobalHeatmap(ctx, r.width, r.height);
  }, [tab]);

  useEffect(() => {
    if (tab !== 2) return;
    const c = sectorRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawSectorBars(ctx, r.width, r.height);
  }, [tab]);

  const filteredIndices = INDICES.filter(i => region === 'All' || i.region === region);
  const adRatio = (BREADTH.advances / BREADTH.declines).toFixed(2);

  function getMarketTime(tz: string): string {
    try { return now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return '--:--'; }
  }

  function isMarketOpen(tz: string, open: number, close: number): boolean {
    try {
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const [h, m] = timeStr.split(':').map(Number);
      const t = h + m / 60;
      return t >= open && t < close;
    } catch { return false; }
  }

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>🌍 MARKET OVERVIEW</span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: GREEN }}>● LIVE</span>
        <span style={{ color: DIM }}>|</span>
        {['S&P', 'DOW', 'NDQ'].map((name, i) => {
          const idx = INDICES[i];
          return (
            <span key={name} style={{ color: idx.changePct >= 0 ? GREEN : RED, fontSize: 11 }}>
              {name} {idx.changePct >= 0 ? '+' : ''}{idx.changePct.toFixed(2)}%
            </span>
          );
        })}
        <span style={{ color: DIM, marginLeft: 'auto' }}>A/D: {adRatio}</span>
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
        {tab === 0 && (
          <div style={{ flex: 1, position: 'relative' }}>
            <canvas ref={heatRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {tab === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 8 }}>
              {['All', 'US', 'EU', 'APAC', 'EM'].map(r => (
                <button key={r} onClick={() => setRegion(r)} style={{
                  padding: '4px 12px', background: region === r ? AMBER : '#1a1a1a', color: region === r ? '#000' : DIM,
                  border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
                }}>{r}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
                    {['Index', 'Last', 'Change', '%', 'Volume', 'Mkt Cap', 'P/E', 'YTD', 'Ccy'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: AMBER, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredIndices.map(idx => (
                    <tr key={idx.name} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ color: WHITE, fontWeight: 'bold' }}>{idx.name}</span>
                        <span style={{ color: DIM, fontSize: 9, marginLeft: 8 }}>{idx.region}</span>
                      </td>
                      <td style={{ padding: '5px 8px', color: WHITE }}>{idx.value.toLocaleString()}</td>
                      <td style={{ padding: '5px 8px', color: idx.change >= 0 ? GREEN : RED }}>
                        {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)}
                      </td>
                      <td style={{ padding: '5px 8px', color: idx.changePct >= 0 ? GREEN : RED, fontWeight: 'bold' }}>
                        {idx.changePct >= 0 ? '+' : ''}{idx.changePct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '5px 8px', color: TEXT }}>{idx.volume}</td>
                      <td style={{ padding: '5px 8px', color: DIM }}>{idx.marketCap}</td>
                      <td style={{ padding: '5px 8px', color: TEXT }}>{idx.pe.toFixed(1)}</td>
                      <td style={{ padding: '5px 8px', color: idx.ytd >= 0 ? GREEN : RED }}>
                        {idx.ytd >= 0 ? '+' : ''}{idx.ytd.toFixed(1)}%
                      </td>
                      <td style={{ padding: '5px 8px', color: DIM }}>{idx.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: '1 1 60%', position: 'relative' }}>
              <canvas ref={sectorRef} style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={{ flex: '1 1 40%', overflow: 'auto', borderTop: `1px solid ${BORDER}`, padding: 12 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>SECTOR LEADERS</div>
              {SECTOR_DATA.map(s => (
                <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: WHITE, minWidth: 120 }}>{s.name}</span>
                  <span style={{ color: s.change >= 0 ? GREEN : RED, minWidth: 60 }}>
                    {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                  </span>
                  <span style={{ color: DIM, flex: 1, textAlign: 'right', fontSize: 10 }}>
                    {s.leaders.join(' | ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 3 && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto', padding: 12, borderRight: `1px solid ${BORDER}` }}>
              <div style={{ color: GREEN, fontWeight: 'bold', marginBottom: 8 }}>TOP GAINERS</div>
              {gainers.map(m => (
                <div key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: AMBER, fontWeight: 'bold', minWidth: 60 }}>{m.symbol}</span>
                  <span style={{ color: WHITE }}>${m.price.toFixed(2)}</span>
                  <span style={{ color: GREEN, fontWeight: 'bold' }}>+{m.change.toFixed(2)}%</span>
                  <span style={{ color: DIM, fontSize: 10 }}>{m.volume}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ color: RED, fontWeight: 'bold', marginBottom: 8 }}>TOP LOSERS</div>
              {losers.map(m => (
                <div key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: AMBER, fontWeight: 'bold', minWidth: 60 }}>{m.symbol}</span>
                  <span style={{ color: WHITE }}>${m.price.toFixed(2)}</span>
                  <span style={{ color: RED, fontWeight: 'bold' }}>{m.change.toFixed(2)}%</span>
                  <span style={{ color: DIM, fontSize: 10 }}>{m.volume}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 4 && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>GLOBAL MARKET HOURS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {MARKETS.map(mkt => {
                const open = isMarketOpen(mkt.tz, mkt.open, mkt.close);
                const time = getMarketTime(mkt.tz);
                return (
                  <div key={mkt.name} style={{
                    background: PANEL, border: `1px solid ${open ? GREEN : BORDER}`, padding: 16,
                    borderLeft: `4px solid ${open ? GREEN : DIM}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: WHITE, fontWeight: 'bold', fontSize: 14 }}>{mkt.flag} {mkt.name}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 2, fontSize: 10,
                        background: open ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.1)',
                        color: open ? GREEN : RED
                      }}>{open ? '● OPEN' : '○ CLOSED'}</span>
                    </div>
                    <div style={{ color: AMBER, fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>{time}</div>
                    <div style={{ color: DIM, fontSize: 10 }}>
                      Trading: {Math.floor(mkt.open)}:{((mkt.open % 1) * 60).toFixed(0).padStart(2, '0')} — {Math.floor(mkt.close)}:{((mkt.close % 1) * 60).toFixed(0).padStart(2, '0')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 5 && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 12 }}>MARKET BREADTH — NYSE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Advances', value: BREADTH.advances, color: GREEN },
                { label: 'Declines', value: BREADTH.declines, color: RED },
                { label: 'Unchanged', value: BREADTH.unchanged, color: DIM },
                { label: 'New 52W Highs', value: BREADTH.newHighs, color: AMBER },
                { label: 'New 52W Lows', value: BREADTH.newLows, color: RED },
                { label: 'A/D Ratio', value: adRatio, color: CYAN },
              ].map(item => (
                <div key={item.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ color: item.color, fontSize: 24, fontWeight: 'bold' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* A/D bar */}
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>ADVANCE / DECLINE BAR</div>
              <div style={{ display: 'flex', height: 30, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(BREADTH.advances / (BREADTH.advances + BREADTH.declines + BREADTH.unchanged)) * 100}%`, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 10, fontWeight: 'bold' }}>
                  {BREADTH.advances}
                </div>
                <div style={{ width: `${(BREADTH.unchanged / (BREADTH.advances + BREADTH.declines + BREADTH.unchanged)) * 100}%`, background: DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 10 }}>
                  {BREADTH.unchanged}
                </div>
                <div style={{ width: `${(BREADTH.declines / (BREADTH.advances + BREADTH.declines + BREADTH.unchanged)) * 100}%`, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 10, fontWeight: 'bold' }}>
                  {BREADTH.declines}
                </div>
              </div>
            </div>

            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 16 }}>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>BREADTH INDICATORS</div>
              {[
                { name: 'McClellan Oscillator', value: '+42.3', color: GREEN },
                { name: 'McClellan Summation', value: '+1,847', color: GREEN },
                { name: 'TRIN (Arms Index)', value: '0.87', color: GREEN },
                { name: 'Breadth Thrust', value: '0.62', color: DIM },
                { name: 'Up Volume %', value: '58.3%', color: GREEN },
                { name: 'Down Volume %', value: '41.7%', color: RED },
              ].map(item => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: TEXT }}>{item.name}</span>
                  <span style={{ color: item.color, fontWeight: 'bold' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{INDICES.length} global indices tracked</span>
        <span style={{ color: DIM }}>{SECTOR_DATA.length} sectors monitored</span>
        <span style={{ color: DIM }}>Updated: {now.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
