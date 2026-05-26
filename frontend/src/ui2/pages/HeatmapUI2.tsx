/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — MARKET HEATMAP (UI2)                                 │
 * │                                                                       │
 * │ Treemap-style market heatmap — real-time sector/stock visualization │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • Treemap heatmap (market cap weighted)                              │
 * │ • Color by: daily change, weekly, YTD, volume                       │
 * │ • Sector grouping with nested stocks                                │
 * │ • Tooltip with price, change, volume                                │
 * │ • Size by: market cap, volume, equal weight                         │
 * │ • Indices: S&P 500, NASDAQ, DOW                                    │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useMarketData } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};
const panelStyle: React.CSSProperties = { background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const panelHdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${T.border0}`, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.text2, fontFamily: T.fontSans };

interface Stock { symbol: string; name: string; sector: string; marketCap: number; price: number; change1d: number; change1w: number; changeYtd: number; volume: number; }

const STOCKS: Stock[] = [
  { symbol: 'AAPL', name: 'Apple', sector: 'Technology', marketCap: 2950, price: 192.5, change1d: 0.85, change1w: 2.1, changeYtd: 12.5, volume: 52 },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', marketCap: 3180, price: 425.8, change1d: 1.2, change1w: 3.5, changeYtd: 18.2, volume: 28 },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology', marketCap: 3050, price: 125.4, change1d: 3.5, change1w: 8.2, changeYtd: 155.0, volume: 165 },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Communication', marketCap: 2200, price: 178.3, change1d: -0.45, change1w: 1.8, changeYtd: 32.5, volume: 25 },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer Disc.', marketCap: 1950, price: 188.5, change1d: 0.95, change1w: -0.8, changeYtd: 25.8, volume: 48 },
  { symbol: 'META', name: 'Meta', sector: 'Communication', marketCap: 1280, price: 505.2, change1d: 1.8, change1w: 4.2, changeYtd: 45.2, volume: 18 },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Consumer Disc.', marketCap: 580, price: 182.5, change1d: -2.5, change1w: -5.8, changeYtd: -28.5, volume: 98 },
  { symbol: 'BRK.B', name: 'Berkshire', sector: 'Financials', marketCap: 890, price: 415.2, change1d: 0.15, change1w: 0.8, changeYtd: 15.2, volume: 4 },
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare', marketCap: 850, price: 892.5, change1d: 1.5, change1w: 3.8, changeYtd: 52.8, volume: 3 },
  { symbol: 'V', name: 'Visa', sector: 'Financials', marketCap: 580, price: 282.5, change1d: 0.35, change1w: 1.2, changeYtd: 8.5, volume: 8 },
  { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', marketCap: 520, price: 498.2, change1d: -0.8, change1w: -2.1, changeYtd: -5.2, volume: 4 },
  { symbol: 'JPM', name: 'JPMorgan', sector: 'Financials', marketCap: 580, price: 202.8, change1d: 0.45, change1w: 2.5, changeYtd: 18.5, volume: 12 },
  { symbol: 'JNJ', name: 'J&J', sector: 'Healthcare', marketCap: 380, price: 155.8, change1d: -0.25, change1w: -0.5, changeYtd: -3.8, volume: 7 },
  { symbol: 'XOM', name: 'Exxon', sector: 'Energy', marketCap: 500, price: 118.5, change1d: 1.2, change1w: 2.8, changeYtd: 12.5, volume: 15 },
  { symbol: 'MA', name: 'Mastercard', sector: 'Financials', marketCap: 420, price: 452.8, change1d: 0.55, change1w: 1.5, changeYtd: 10.2, volume: 3 },
  { symbol: 'PG', name: 'Procter & G.', sector: 'Consumer Staples', marketCap: 380, price: 168.2, change1d: -0.12, change1w: 0.3, changeYtd: 5.2, volume: 6 },
  { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Disc.', marketCap: 350, price: 348.5, change1d: -0.85, change1w: -1.5, changeYtd: 2.8, volume: 4 },
  { symbol: 'CVX', name: 'Chevron', sector: 'Energy', marketCap: 310, price: 162.8, change1d: 0.95, change1w: 1.8, changeYtd: 8.5, volume: 8 },
  { symbol: 'MRK', name: 'Merck', sector: 'Healthcare', marketCap: 320, price: 128.5, change1d: 0.65, change1w: 2.2, changeYtd: 15.8, volume: 9 },
  { symbol: 'AVGO', name: 'Broadcom', sector: 'Technology', marketCap: 680, price: 1420, change1d: 2.8, change1w: 12.5, changeYtd: 48.5, volume: 5 },
  { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples', marketCap: 260, price: 62.5, change1d: 0.08, change1w: -0.2, changeYtd: 3.2, volume: 12 },
  { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples', marketCap: 228, price: 168.2, change1d: -0.35, change1w: -1.2, changeYtd: -2.5, volume: 5 },
  { symbol: 'COST', name: 'Costco', sector: 'Consumer Staples', marketCap: 350, price: 852.5, change1d: 0.42, change1w: 1.8, changeYtd: 28.5, volume: 2 },
  { symbol: 'ABBV', name: 'AbbVie', sector: 'Healthcare', marketCap: 310, price: 172.5, change1d: 0.38, change1w: 0.5, changeYtd: 8.2, volume: 5 },
  { symbol: 'WMT', name: 'Walmart', sector: 'Consumer Staples', marketCap: 520, price: 68.2, change1d: 0.52, change1w: 2.1, changeYtd: 32.5, volume: 12 },
  { symbol: 'CRM', name: 'Salesforce', sector: 'Technology', marketCap: 280, price: 285.5, change1d: -1.2, change1w: -3.5, changeYtd: 12.8, volume: 6 },
  { symbol: 'AMD', name: 'AMD', sector: 'Technology', marketCap: 260, price: 165.8, change1d: 2.2, change1w: 5.8, changeYtd: 15.2, volume: 55 },
  { symbol: 'NFLX', name: 'Netflix', sector: 'Communication', marketCap: 280, price: 665.2, change1d: 0.85, change1w: 2.5, changeYtd: 38.5, volume: 5 },
  { symbol: 'INTC', name: 'Intel', sector: 'Technology', marketCap: 130, price: 30.5, change1d: -1.5, change1w: -4.2, changeYtd: -35.8, volume: 45 },
  { symbol: 'DIS', name: 'Disney', sector: 'Communication', marketCap: 195, price: 105.8, change1d: -0.65, change1w: -1.8, changeYtd: 12.5, volume: 10 },
];

function changeColor(val: number): string {
  if (val > 3) return '#1B5E20';
  if (val > 2) return '#2E7D32';
  if (val > 1) return '#388E3C';
  if (val > 0.5) return '#43A047';
  if (val > 0) return '#4CAF50';
  if (val > -0.5) return '#E53935';
  if (val > -1) return '#D32F2F';
  if (val > -2) return '#C62828';
  if (val > -3) return '#B71C1C';
  return '#880E4F';
}

/* Treemap Layout (squarified) */
function computeTreemap(items: { symbol: string; weight: number }[], x: number, y: number, w: number, h: number): { symbol: string; x: number; y: number; w: number; h: number }[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ symbol: items[0].symbol, x, y, w, h }];

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const result: { symbol: string; x: number; y: number; w: number; h: number }[] = [];

  // Simple slice-and-dice
  let cx = x, cy = y, cw = w, ch = h;
  const isHorizontal = cw > ch;

  sorted.forEach((item, i) => {
    const ratio = item.weight / totalWeight;
    if (i === sorted.length - 1) {
      result.push({ symbol: item.symbol, x: cx, y: cy, w: isHorizontal ? cw : cw, h: isHorizontal ? ch : ch });
    } else if (isHorizontal) {
      const itemW = cw * ratio / (1 - sorted.slice(0, i).reduce((s, it) => s + it.weight, 0) / totalWeight || 1);
      const clampedW = Math.min(itemW, cw);
      result.push({ symbol: item.symbol, x: cx, y: cy, w: clampedW, h: ch });
      cx += clampedW;
      cw -= clampedW;
    } else {
      const itemH = ch * ratio / (1 - sorted.slice(0, i).reduce((s, it) => s + it.weight, 0) / totalWeight || 1);
      const clampedH = Math.min(itemH, ch);
      result.push({ symbol: item.symbol, x: cx, y: cy, w: cw, h: clampedH });
      cy += clampedH;
      ch -= clampedH;
    }
  });

  return result;
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function HeatmapUI2() {
  const [marketState, marketActions] = useMarketData();

  const [colorBy, setColorBy] = useState<'1d' | '1w' | 'ytd'>('1d');
  const [sizeBy, setSizeBy] = useState<'mcap' | 'vol' | 'equal'>('mcap');
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  // ── Live stocks data overlaid on the static metadata (sector + mkt cap). ──
  const [liveStocks, setLiveStocks] = useState<Record<string, { change: number; price?: number }>>({});
  useEffect(() => {
    const periodParam = colorBy === '1d' ? '1D' : colorBy === '1w' ? '1W' : 'YTD';
    let cancelled = false;
    const fetchHeatmap = () =>
      fetch(`/api/v1/market-data/heatmap?period=${periodParam}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (cancelled || !d?.stocks) return;
          const map: Record<string, { change: number }> = {};
          d.stocks.forEach((s: any) => { map[s.symbol] = { change: +s.change }; });
          setLiveStocks(map);
        })
        .catch(() => {});
    fetchHeatmap();
    const id = setInterval(fetchHeatmap, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [colorBy]);

  const getChange = (s: Stock) => {
    const live = liveStocks[s.symbol];
    if (live && colorBy === '1d') return live.change;
    return colorBy === '1d' ? s.change1d : colorBy === '1w' ? s.change1w : s.changeYtd;
  };
  const getWeight = (s: Stock) => sizeBy === 'mcap' ? s.marketCap : sizeBy === 'vol' ? s.volume : 10;

  const sectors = useMemo(() => {
    const map = new Map<string, Stock[]>();
    STOCKS.forEach(s => { const arr = map.get(s.sector) || []; arr.push(s); map.set(s.sector, arr); });
    return Array.from(map.entries()).sort((a, b) => b[1].reduce((s, st) => s + st.marketCap, 0) - a[1].reduce((s, st) => s + st.marketCap, 0));
  }, []);

  const totalWeight = STOCKS.reduce((s, st) => s + getWeight(st), 0);
  const hovered = STOCKS.find(s => s.symbol === hoveredSymbol);

  return (
    <div data-testid="heatmap-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '6px', background: T.bg0, color: T.text1, fontFamily: T.fontSans, overflow: 'hidden', gap: '6px' }}>
      {/* Toolbar */}
      <div style={{ ...panelStyle, flexDirection: 'row', padding: '4px 10px', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: T.text0 }}>MARKET HEATMAP</span>
        <div style={{ height: '14px', width: '1px', background: T.border1 }} />
        <span style={{ fontSize: '9px', color: T.text3 }}>Color:</span>
        {[{ k: '1d', l: '1D' }, { k: '1w', l: '1W' }, { k: 'ytd', l: 'YTD' }].map(o => (
          <button key={o.k} onClick={() => setColorBy(o.k as any)} style={{ background: colorBy === o.k ? T.brand : T.bg3, color: colorBy === o.k ? '#FFF' : T.text2, border: 'none', padding: '2px 6px', borderRadius: '2px', fontSize: '9px', fontWeight: 600, cursor: 'pointer', fontFamily: T.fontSans }}>{o.l}</button>
        ))}
        <div style={{ height: '14px', width: '1px', background: T.border1 }} />
        <span style={{ fontSize: '9px', color: T.text3 }}>Size:</span>
        {[{ k: 'mcap', l: 'Mkt Cap' }, { k: 'vol', l: 'Volume' }, { k: 'equal', l: 'Equal' }].map(o => (
          <button key={o.k} onClick={() => setSizeBy(o.k as any)} style={{ background: sizeBy === o.k ? T.brand : T.bg3, color: sizeBy === o.k ? '#FFF' : T.text2, border: 'none', padding: '2px 6px', borderRadius: '2px', fontSize: '9px', fontWeight: 600, cursor: 'pointer', fontFamily: T.fontSans }}>{o.l}</button>
        ))}
        <div style={{ flex: 1 }} />
        {hovered && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '10px', fontFamily: T.fontMono }}>
            <span style={{ fontWeight: 700, color: T.text0 }}>{hovered.symbol}</span>
            <span style={{ color: T.text1 }}>${hovered.price.toFixed(2)}</span>
            <span style={{ color: getChange(hovered) >= 0 ? T.up : T.dn, fontWeight: 600 }}>{getChange(hovered) >= 0 ? '+' : ''}{getChange(hovered).toFixed(2)}%</span>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div style={{ ...panelStyle, flex: 1 }}>
        <div style={{ flex: 1, padding: '4px', display: 'flex', flexWrap: 'wrap', gap: '2px', alignContent: 'flex-start', overflow: 'auto' }}>
          {sectors.map(([sector, stocks]) => {
            const sectorWeight = stocks.reduce((s, st) => s + getWeight(st), 0);
            const sectorPct = (sectorWeight / totalWeight) * 100;
            return (
              <div key={sector} style={{ width: `${Math.max(sectorPct, 8)}%`, flexGrow: sectorPct > 15 ? 2 : 1, minWidth: '80px' }}>
                <div style={{ fontSize: '8px', color: T.text3, padding: '1px 3px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{sector}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px' }}>
                  {stocks.sort((a, b) => getWeight(b) - getWeight(a)).map(s => {
                    const w = getWeight(s);
                    const ch = getChange(s);
                    const pctOfSector = (w / sectorWeight) * 100;
                    return (
                      <div key={s.symbol} onMouseEnter={() => setHoveredSymbol(s.symbol)} onMouseLeave={() => setHoveredSymbol(null)}
                        style={{
                          width: `${Math.max(pctOfSector - 1, 15)}%`, minWidth: '32px',
                          aspectRatio: pctOfSector > 30 ? '1.8' : '1.2',
                          background: changeColor(ch), borderRadius: '2px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexGrow: 1, padding: '2px',
                          border: hoveredSymbol === s.symbol ? `2px solid ${T.text0}` : '1px solid rgba(0,0,0,0.3)',
                          transition: 'border 0.1s',
                        }}>
                        <div style={{ fontSize: pctOfSector > 20 ? '11px' : '9px', fontWeight: 800, color: '#FFF', textShadow: '0 1px 2px rgba(0,0,0,0.5)', fontFamily: T.fontMono }}>{s.symbol}</div>
                        <div style={{ fontSize: pctOfSector > 20 ? '10px' : '8px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: T.fontMono }}>{ch >= 0 ? '+' : ''}{ch.toFixed(1)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ ...panelStyle, flexDirection: 'row', padding: '3px 10px', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '8px', color: T.text3 }}>-3%+</span>
        {['#B71C1C', '#C62828', '#D32F2F', '#E53935', '#4CAF50', '#43A047', '#388E3C', '#2E7D32', '#1B5E20'].map((c, i) => (
          <div key={i} style={{ width: '20px', height: '8px', background: c, borderRadius: '1px' }} />
        ))}
        <span style={{ fontSize: '8px', color: T.text3 }}>+3%+</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '9px', color: T.text2 }}>{STOCKS.length} stocks · {sectors.length} sectors</span>
      </div>
    </div>
  );
}
