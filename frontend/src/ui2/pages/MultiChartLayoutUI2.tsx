/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ APEX TERMINAL — MULTI-CHART LAYOUT (UI2)                             │
 * │                                                                       │
 * │ Split-screen synchronized multi-chart — tasks.md §1.2               │
 * │                                                                       │
 * │ Features:                                                             │
 * │ • 1×1, 2×1, 1×2, 2×2, 3×2 layout presets                          │
 * │ • Independent symbol/timeframe per chart                             │
 * │ • Synchronized crosshair across charts                               │
 * │ • Canvas candlestick charts with volume                              │
 * │ • Quick symbol change per tile                                       │
 * │ • Timeframe selector per tile (1m, 5m, 15m, 1H, 4H, D, W)         │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useIndicators } from '@/ui2/hooks';
import { useDrawing } from '@/ui2/hooks';
import { useChartTypes } from '@/ui2/hooks';

const T = {
  brand: '#2962FF', bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border0: '#1E222D', border1: '#2A2E39', text0: '#FFF', text1: '#D1D4DC', text2: '#787B86', text3: '#50535E',
  up: '#26A69A', dn: '#EF5350', warn: '#FF9800', info: '#42A5F5',
  fontSans: "'Inter','Segoe UI',system-ui,sans-serif", fontMono: "'JetBrains Mono','Fira Code',monospace", radius: '4px',
};

interface Candle { o: number; h: number; l: number; c: number; v: number; }

function generateCandles(basePrice: number, count: number): Candle[] {
  const candles: Candle[] = [];
  let p = basePrice;
  for (let i = 0; i < count; i++) {
    const o = p;
    const r = (Math.random() - 0.48) * 0.025;
    const c = +(o * (1 + r)).toFixed(2);
    const h = +Math.max(o, c, o * (1 + Math.random() * 0.015)).toFixed(2);
    const l = +Math.min(o, c, o * (1 - Math.random() * 0.015)).toFixed(2);
    const v = Math.round(1e6 + Math.random() * 5e6);
    candles.push({ o, h, l, c, v });
    p = c;
  }
  return candles;
}

const SYMBOLS = [
  { sym: 'AAPL', price: 192.5 }, { sym: 'MSFT', price: 425.8 }, { sym: 'NVDA', price: 125.4 },
  { sym: 'GOOGL', price: 178.3 }, { sym: 'AMZN', price: 188.5 }, { sym: 'META', price: 505.2 },
  { sym: 'TSLA', price: 182.5 }, { sym: 'SPY', price: 542.8 }, { sym: 'QQQ', price: 468.2 },
  { sym: 'BTC', price: 67842 }, { sym: 'ETH', price: 3485 }, { sym: 'GC', price: 2382 },
];
const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', 'D', 'W'];

type Layout = '1x1' | '2x1' | '1x2' | '2x2' | '3x2';

interface Tile { symbol: string; timeframe: string; candles: Candle[]; }

/* Single Chart Tile */
function ChartTile({ tile, onSymbolChange, onTfChange, crosshairX }: { tile: Tile; onSymbolChange: (sym: string) => void; onTfChange: (tf: string) => void; crosshairX: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);

  const draw = useCallback(() => {
    const cvs = canvasRef.current; const con = containerRef.current;
    if (!cvs || !con) return;
    cvs.width = con.clientWidth; cvs.height = con.clientHeight;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const w = cvs.width, h = cvs.height;
    const pad = { t: 4, r: 40, b: 30, l: 4 };

    const candles = tile.candles;
    if (!candles.length) return;
    const prices = candles.flatMap(c => [c.h, c.l]);
    const mn = Math.min(...prices) * 0.998, mx = Math.max(...prices) * 1.002;
    const maxVol = Math.max(...candles.map(c => c.v));
    const barW = Math.max(1, (w - pad.l - pad.r) / candles.length);
    const chartH = (h - pad.t - pad.b) * 0.75;
    const volH = (h - pad.t - pad.b) * 0.2;
    const volTop = pad.t + chartH + 4;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = T.border0; ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = pad.t + (i / 3) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      const val = mx - (i / 3) * (mx - mn);
      ctx.fillStyle = T.text3; ctx.font = `8px ${T.fontMono}`; ctx.textAlign = 'left';
      ctx.fillText(val.toFixed(2), w - pad.r + 2, y + 3);
    }

    // Candles
    candles.forEach((c, i) => {
      const x = pad.l + i * barW + barW / 2;
      const isUp = c.c >= c.o;
      const col = isUp ? T.up : T.dn;

      // Wick
      const hY = pad.t + ((mx - c.h) / (mx - mn)) * chartH;
      const lY = pad.t + ((mx - c.l) / (mx - mn)) * chartH;
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, hY); ctx.lineTo(x, lY); ctx.stroke();

      // Body
      const oY = pad.t + ((mx - c.o) / (mx - mn)) * chartH;
      const cY = pad.t + ((mx - c.c) / (mx - mn)) * chartH;
      const bodyTop = Math.min(oY, cY);
      const bodyH = Math.max(Math.abs(cY - oY), 1);
      ctx.fillStyle = col;
      ctx.fillRect(x - barW * 0.35, bodyTop, barW * 0.7, bodyH);

      // Volume
      const vH = (c.v / maxVol) * volH;
      ctx.fillStyle = isUp ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.fillRect(x - barW * 0.35, volTop + volH - vH, barW * 0.7, vH);
    });

    // Last price line
    const last = candles[candles.length - 1];
    const lastY = pad.t + ((mx - last.c) / (mx - mn)) * chartH;
    ctx.setLineDash([2, 2]); ctx.strokeStyle = last.c >= last.o ? T.up : T.dn; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, lastY); ctx.lineTo(w - pad.r, lastY); ctx.stroke();
    ctx.setLineDash([]);
    // Price label
    ctx.fillStyle = last.c >= last.o ? T.up : T.dn;
    ctx.fillRect(w - pad.r, lastY - 7, 38, 14);
    ctx.fillStyle = '#FFF'; ctx.font = `bold 8px ${T.fontMono}`; ctx.textAlign = 'left';
    ctx.fillText(last.c.toFixed(2), w - pad.r + 2, lastY + 3);

    // Crosshair
    if (crosshairX !== null) {
      const idx = Math.floor((crosshairX / w) * candles.length);
      if (idx >= 0 && idx < candles.length) {
        const cx = pad.l + idx * barW + barW / 2;
        ctx.strokeStyle = T.text3; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [tile.candles, crosshairX]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { const obs = new ResizeObserver(draw); if (containerRef.current) obs.observe(containerRef.current); return () => obs.disconnect(); }, [draw]);

  const last = tile.candles[tile.candles.length - 1];
  const first = tile.candles[0];
  const ch = last ? ((last.c - first.o) / first.o) * 100 : 0;

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '3px 6px', borderBottom: `1px solid ${T.border0}`, gap: '6px', flexShrink: 0 }}>
        <span onClick={() => setShowSymbolPicker(!showSymbolPicker)} style={{ fontSize: '11px', fontWeight: 800, color: T.text0, fontFamily: T.fontMono, cursor: 'pointer' }}>{tile.symbol}</span>
        {last && <span style={{ fontSize: '10px', fontWeight: 600, color: T.text0, fontFamily: T.fontMono }}>{last.c.toFixed(2)}</span>}
        <span style={{ fontSize: '9px', color: ch >= 0 ? T.up : T.dn, fontFamily: T.fontMono, fontWeight: 600 }}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '1px' }}>
          {TIMEFRAMES.map(tf => <button key={tf} onClick={() => onTfChange(tf)} style={{ background: tile.timeframe === tf ? T.brand : 'transparent', color: tile.timeframe === tf ? '#FFF' : T.text3, border: 'none', padding: '1px 4px', borderRadius: '2px', fontSize: '8px', fontWeight: 600, cursor: 'pointer', fontFamily: T.fontSans }}>{tf}</button>)}
        </div>
      </div>

      {/* Symbol picker dropdown */}
      {showSymbolPicker && (
        <div style={{ position: 'absolute', top: '24px', left: '4px', zIndex: 100, background: T.bg2, border: `1px solid ${T.border1}`, borderRadius: T.radius, padding: '4px', maxHeight: '200px', overflow: 'auto', scrollbarWidth: 'thin' }}>
          {SYMBOLS.map(s => <div key={s.sym} onClick={() => { onSymbolChange(s.sym); setShowSymbolPicker(false); }} style={{ padding: '3px 8px', fontSize: '10px', color: T.text0, fontFamily: T.fontMono, cursor: 'pointer', fontWeight: 600, borderRadius: '2px' }} onMouseEnter={e => e.currentTarget.style.background = T.bg3} onMouseLeave={e => e.currentTarget.style.background = ''}>{s.sym} <span style={{ color: T.text3, fontSize: '9px' }}>${s.price.toFixed(2)}</span></div>)}
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, minHeight: '80px' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (typeof (window as unknown as Record<string, unknown>).__setCrosshairX === 'function') {
              ((window as unknown as Record<string, (x: number) => void>).__setCrosshairX)(x);
            }
          }}
          onMouseLeave={() => {
            if (typeof (window as unknown as Record<string, unknown>).__setCrosshairX === 'function') {
              ((window as unknown as Record<string, (x: number | null) => void>).__setCrosshairX)(null);
            }
          }}
        />
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */

const LAYOUT_CONFIGS: Record<Layout, { cols: number; rows: number; count: number }> = {
  '1x1': { cols: 1, rows: 1, count: 1 },
  '2x1': { cols: 2, rows: 1, count: 2 },
  '1x2': { cols: 1, rows: 2, count: 2 },
  '2x2': { cols: 2, rows: 2, count: 4 },
  '3x2': { cols: 3, rows: 2, count: 6 },
};

export default function MultiChartLayoutUI2() {
  // ── Hook integration ──
  const [indicatorState, indicatorActions] = useIndicators();
  const [drawingState, drawingActions] = useDrawing();
  const [chartTypeState, chartTypeActions] = useChartTypes();

  const [layout, setLayout] = useState<Layout>('2x2');
  const [crosshairX, setCrosshairX] = useState<number | null>(null);
  const config = LAYOUT_CONFIGS[layout];

  // Expose setCrosshairX globally so ChartTile canvas events can call it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setCrosshairX = setCrosshairX;
    return () => { delete (window as unknown as Record<string, unknown>).__setCrosshairX; };
  }, [setCrosshairX]);

  const [tiles, setTiles] = useState<Tile[]>(() => {
    const defaults = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'TSLA'];
    return defaults.map((sym, i) => {
      const s = SYMBOLS.find(s => s.sym === sym) || SYMBOLS[0];
      return { symbol: sym, timeframe: 'D', candles: generateCandles(s.price, 80 + i * 10) };
    });
  });

  const onSymbolChange = (idx: number, sym: string) => {
    const s = SYMBOLS.find(s => s.sym === sym);
    if (!s) return;
    setTiles(prev => prev.map((t, i) => i === idx ? { ...t, symbol: sym, candles: generateCandles(s.price, 80) } : t));
  };

  const onTfChange = (idx: number, tf: string) => {
    setTiles(prev => prev.map((t, i) => i === idx ? { ...t, timeframe: tf } : t));
  };

  return (
    <div data-testid="multichart-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '6px', background: T.bg0, fontFamily: T.fontSans, overflow: 'hidden', gap: '6px' }}>
      {/* Toolbar */}
      <div style={{ background: T.bg1, border: `1px solid ${T.border0}`, borderRadius: T.radius, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: T.text0 }}>MULTI-CHART</span>
        <div style={{ height: '14px', width: '1px', background: T.border1 }} />
        <span style={{ fontSize: '9px', color: T.text3 }}>Layout:</span>
        {(Object.keys(LAYOUT_CONFIGS) as Layout[]).map(l => (
          <button key={l} onClick={() => setLayout(l)} style={{ background: layout === l ? T.brand : T.bg3, color: layout === l ? '#FFF' : T.text2, border: 'none', padding: '2px 8px', borderRadius: '2px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: T.fontSans }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '9px', color: T.text3 }}>Sync crosshair: ON</span>
      </div>

      {/* Chart Grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${config.cols}, 1fr)`, gridTemplateRows: `repeat(${config.rows}, 1fr)`, gap: '4px', minHeight: 0 }}>
        {tiles.slice(0, config.count).map((tile, i) => (
          <ChartTile key={i} tile={tile} onSymbolChange={sym => onSymbolChange(i, sym)} onTfChange={tf => onTfChange(i, tf)} crosshairX={crosshairX} />
        ))}
      </div>
    </div>
  );
}
