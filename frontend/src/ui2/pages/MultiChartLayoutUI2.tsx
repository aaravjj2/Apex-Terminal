/**
 * MultiChartLayoutUI2 — Multi-Panel Chart Workspace
 * TradingView-style: 1–8 chart panels, per-panel symbol/interval/chart-type,
 * synced crosshair, layout presets, comparison overlay, drawing tools.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ChartPanel {
  id: string; symbol: string; interval: string; chartType: string;
  showVolume: boolean; showGrid: boolean;
  indicators: string[]; comparison: string[];
}
interface LayoutPreset { name: string; icon: string; cols: number; rows: number; panels: number }
interface DrawingTool { id: string; name: string; icon: string; category: string }

/* ─── Constants ──────────────────────────────────────────────────────── */
const SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
  'JPM', 'V', 'UNH', 'XOM', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'CVX',
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY',
  'SPX', 'NDX', 'DJI', 'RUT', 'VIX', 'DXY',
  'GC=F', 'SI=F', 'CL=F', 'NG=F',
];
const INTERVALS = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
const CHART_TYPES = ['Candles', 'Bars', 'Line', 'Area', 'Heikin-Ashi', 'Renko', 'Kagi', 'P&F'];
const INDICATOR_LIST = [
  'SMA', 'EMA', 'VWAP', 'Bollinger Bands', 'Ichimoku', 'MACD', 'RSI',
  'Stochastics', 'ATR', 'ADX', 'OBV', 'Volume Profile', 'Pivot Points',
];

const LAYOUTS: LayoutPreset[] = [
  { name: 'Single', icon: '☐', cols: 1, rows: 1, panels: 1 },
  { name: '2 Vertical', icon: '║', cols: 2, rows: 1, panels: 2 },
  { name: '2 Horizontal', icon: '═', cols: 1, rows: 2, panels: 2 },
  { name: '3 Top+2 Bot', icon: '⊞', cols: 3, rows: 2, panels: 5 },
  { name: '2×2 Grid', icon: '⊞', cols: 2, rows: 2, panels: 4 },
  { name: '3×2 Grid', icon: '⊞', cols: 3, rows: 2, panels: 6 },
  { name: '1 Left + 3 Right', icon: '◧', cols: 2, rows: 3, panels: 4 },
  { name: '4×2 Grid', icon: '⊞', cols: 4, rows: 2, panels: 8 },
];

const DRAWING_TOOLS: DrawingTool[] = [
  { id: 'trend', name: 'Trend Line', icon: '╲', category: 'Lines' },
  { id: 'horiz', name: 'Horizontal', icon: '—', category: 'Lines' },
  { id: 'vert', name: 'Vertical', icon: '│', category: 'Lines' },
  { id: 'ray', name: 'Ray', icon: '↗', category: 'Lines' },
  { id: 'channel', name: 'Channel', icon: '▭', category: 'Channels' },
  { id: 'pitchfork', name: 'Pitchfork', icon: 'Ψ', category: 'Channels' },
  { id: 'fib', name: 'Fib Retracement', icon: 'φ', category: 'Fibonacci' },
  { id: 'fib-ext', name: 'Fib Extension', icon: 'Φ', category: 'Fibonacci' },
  { id: 'rect', name: 'Rectangle', icon: '▢', category: 'Shapes' },
  { id: 'circle', name: 'Circle', icon: '○', category: 'Shapes' },
  { id: 'triangle', name: 'Triangle', icon: '△', category: 'Shapes' },
  { id: 'arrow', name: 'Arrow', icon: '→', category: 'Patterns' },
  { id: 'text', name: 'Text', icon: 'T', category: 'Annotations' },
  { id: 'price-range', name: 'Price Range', icon: '↕', category: 'Measurement' },
  { id: 'date-range', name: 'Date Range', icon: '↔', category: 'Measurement' },
  { id: 'measure', name: 'Measure', icon: '📏', category: 'Measurement' },
];

let panelIdCounter = 0;
function newPanel(sym = 'AAPL', interval = '1D'): ChartPanel {
  return {
    id: `p${++panelIdCounter}`,
    symbol: sym,
    interval,
    chartType: 'Candles',
    showVolume: true,
    showGrid: true,
    indicators: ['SMA', 'EMA'],
    comparison: [],
  };
}

/* ─── Generate OHLCV data ────────────────────────────────────────────── */
function genOHLCV(sym: string, n = 120) {
  // Seed from symbol for consistency
  let s = 0; for (const c of sym) s += c.charCodeAt(0);
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const base = 50 + rng() * 400;
  const data: { o: number; h: number; l: number; c: number; v: number }[] = [];
  let prev = base;
  for (let i = 0; i < n; i++) {
    const move = (rng() - 0.48) * prev * 0.025;
    const o = prev;
    const c = o + move;
    const h = Math.max(o, c) + rng() * Math.abs(move) * 0.5;
    const l = Math.min(o, c) - rng() * Math.abs(move) * 0.5;
    const v = 100000 + rng() * 5000000;
    data.push({ o, h, l, c, v });
    prev = c;
  }
  return data;
}

/* ─── Canvas Chart ───────────────────────────────────────────────────── */
function CandleChart({ panel, crosshairX, onCrosshair, active }: {
  panel: ChartPanel; crosshairX: number | null;
  onCrosshair: (x: number | null) => void; active: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useMemo(() => genOHLCV(panel.symbol), [panel.symbol]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    const priceH = panel.showVolume ? h * 0.75 : h - 20;
    const volH = panel.showVolume ? h - priceH - 1 : 0;

    // Background
    ctx.fillStyle = active ? '#0c0c0c' : PANEL;
    ctx.fillRect(0, 0, w, h);

    // Grid
    if (panel.showGrid) {
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
      for (let i = 1; i < 5; i++) { const y = (priceH / 5) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let i = 1; i < 8; i++) { const x = (w / 8) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke(); }
    }

    const n = data.length;
    const allH = data.map(d => d.h), allL = data.map(d => d.l);
    const minP = Math.min(...allL), maxP = Math.max(...allH);
    const range = maxP - minP || 1;
    const barW = (w - 60) / n;
    const px = (i: number) => 10 + i * barW + barW / 2;
    const py = (v: number) => 15 + ((maxP - v) / range) * (priceH - 30);

    // Candles
    data.forEach((d, i) => {
      const x = px(i);
      const bullish = d.c >= d.o;
      const color = bullish ? GREEN : RED;

      // Wick
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, py(d.h)); ctx.lineTo(x, py(d.l)); ctx.stroke();

      // Body
      const bodyTop = py(Math.max(d.o, d.c));
      const bodyBot = py(Math.min(d.o, d.c));
      const bodyH = Math.max(bodyBot - bodyTop, 1);
      if (panel.chartType === 'Line' || panel.chartType === 'Area') {
        // Line
        if (i === 0) { ctx.beginPath(); ctx.moveTo(x, py(d.c)); }
        else ctx.lineTo(x, py(d.c));
        if (i === n - 1) {
          ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5; ctx.stroke();
          if (panel.chartType === 'Area') {
            ctx.lineTo(x, priceH);
            ctx.lineTo(px(0), priceH);
            ctx.closePath();
            ctx.fillStyle = 'rgba(245,166,35,0.08)';
            ctx.fill();
          }
        }
      } else {
        ctx.fillStyle = bullish ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)';
        ctx.fillRect(x - barW * 0.35, bodyTop, barW * 0.7, bodyH);
      }
    });

    // SMA overlay
    if (panel.indicators.includes('SMA') && panel.chartType !== 'Line') {
      const period = 20;
      ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = period; i < n; i++) {
        let sum = 0; for (let j = i - period; j < i; j++) sum += data[j].c;
        const avg = sum / period;
        i === period ? ctx.moveTo(px(i), py(avg)) : ctx.lineTo(px(i), py(avg));
      }
      ctx.stroke();
    }

    // EMA overlay
    if (panel.indicators.includes('EMA') && panel.chartType !== 'Line') {
      const period = 50; const k = 2 / (period + 1);
      let ema = data[0].c;
      ctx.strokeStyle = '#ff8a65'; ctx.lineWidth = 1;
      ctx.beginPath();
      data.forEach((d, i) => {
        ema = d.c * k + ema * (1 - k);
        if (i < period) return;
        i === period ? ctx.moveTo(px(i), py(ema)) : ctx.lineTo(px(i), py(ema));
      });
      ctx.stroke();
    }

    // Volume
    if (panel.showVolume) {
      const maxV = Math.max(...data.map(d => d.v));
      data.forEach((d, i) => {
        const x = px(i);
        const vH = (d.v / maxV) * (volH - 5);
        ctx.fillStyle = d.c >= d.o ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
        ctx.fillRect(x - barW * 0.35, h - vH, barW * 0.7, vH);
      });
    }

    // Crosshair
    if (crosshairX !== null && crosshairX >= 0 && crosshairX <= 1) {
      const cx = crosshairX * w;
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
      ctx.setLineDash([]);
      
      // Price label
      const idx = Math.min(Math.floor(crosshairX * n), n - 1);
      if (idx >= 0 && idx < n) {
        const d = data[idx];
        ctx.fillStyle = '#222'; ctx.fillRect(cx + 5, 2, 120, 48);
        ctx.fillStyle = '#ccc'; ctx.font = '9px monospace';
        ctx.fillText(`O: ${d.o.toFixed(2)}`, cx + 10, 14);
        ctx.fillText(`H: ${d.h.toFixed(2)}`, cx + 10, 24);
        ctx.fillText(`L: ${d.l.toFixed(2)}`, cx + 10, 34);
        ctx.fillText(`C: ${d.c.toFixed(2)}`, cx + 10, 44);
      }
    }

    // Price axis
    ctx.fillStyle = MUTED; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const price = maxP - (range / 4) * i;
      ctx.fillText(price.toFixed(2), w - 2, 15 + (priceH - 30) * (i / 4) + 4);
    }

    // Current price tag
    const last = data[n - 1].c;
    const lastY = py(last);
    ctx.fillStyle = last >= data[n - 2].c ? GREEN : RED;
    ctx.fillRect(w - 55, lastY - 8, 55, 16);
    ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    ctx.fillText(last.toFixed(2), w - 4, lastY + 3);

    // Symbol label
    ctx.textAlign = 'left'; ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#eee';
    ctx.fillText(panel.symbol, 8, 14);
    ctx.font = '9px monospace'; ctx.fillStyle = MUTED;
    ctx.fillText(`${panel.interval} · ${panel.chartType}`, 8 + panel.symbol.length * 8 + 8, 14);
  }, [panel, crosshairX, active, data]);

  const handleMouse = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onCrosshair((e.clientX - rect.left) / rect.width);
  }, [onCrosshair]);

  return (
    <canvas ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => onCrosshair(null)}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }} />
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function MultiChartLayoutUI2() {
  const [layout, setLayout] = useState<LayoutPreset>(LAYOUTS[4]); // Default 2×2
  const [panels, setPanels] = useState<ChartPanel[]>([
    newPanel('AAPL', '1D'), newPanel('NVDA', '1D'),
    newPanel('BTC/USD', '4H'), newPanel('SPX', '1D'),
  ]);
  const [activePanel, setActivePanel] = useState<string>(panels[0].id);
  const [crosshairX, setCrosshairX] = useState<number | null>(null);
  const [crosshairSync, setCrosshairSync] = useState(true);
  const [showDrawings, setShowDrawings] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showIndicators, setShowIndicators] = useState(false);

  const activePanelData = panels.find(p => p.id === activePanel)!;

  const updatePanel = (id: string, updates: Partial<ChartPanel>) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleLayoutChange = (preset: LayoutPreset) => {
    setLayout(preset);
    while (panels.length < preset.panels) {
      const sym = SYMBOLS[panels.length % SYMBOLS.length];
      panels.push(newPanel(sym, '1D'));
    }
    setPanels([...panels.slice(0, preset.panels)]);
  };

  return (
    <div style={{ background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 }}>
      {/* Top toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {/* Layout selector */}
        <div style={{ display: 'flex', gap: 2, marginRight: 8 }}>
          {LAYOUTS.map(l => (
            <button key={l.name} onClick={() => handleLayoutChange(l)} title={l.name}
              style={{
                width: 26, height: 22, background: layout.name === l.name ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${layout.name === l.name ? AMBER : BORDER}`, borderRadius: 3,
                color: layout.name === l.name ? AMBER : MUTED, cursor: 'pointer', fontSize: 11,
              }}>{l.icon}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: BORDER }} />

        {/* Active panel symbol */}
        <select value={activePanelData?.symbol || SYMBOLS[0]}
          onChange={e => updatePanel(activePanel, { symbol: e.target.value })}
          style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>
          {SYMBOLS.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Interval */}
        <div style={{ display: 'flex', gap: 2 }}>
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => updatePanel(activePanel, { interval: iv })}
              style={{
                padding: '3px 6px', background: activePanelData?.interval === iv ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${activePanelData?.interval === iv ? AMBER : 'transparent'}`,
                color: activePanelData?.interval === iv ? AMBER : MUTED,
                borderRadius: 3, cursor: 'pointer', fontSize: 10,
              }}>{iv}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: BORDER }} />

        {/* Chart type */}
        <select value={activePanelData?.chartType || 'Candles'}
          onChange={e => updatePanel(activePanel, { chartType: e.target.value })}
          style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: MUTED, padding: '3px 8px', fontSize: 11 }}>
          {CHART_TYPES.map(ct => <option key={ct}>{ct}</option>)}
        </select>

        {/* Indicators */}
        <button onClick={() => setShowIndicators(v => !v)} style={{
          background: showIndicators ? 'rgba(245,166,35,0.15)' : 'transparent',
          border: `1px solid ${showIndicators ? AMBER : BORDER}`, borderRadius: 3,
          color: showIndicators ? AMBER : MUTED, padding: '3px 8px', cursor: 'pointer', fontSize: 10,
        }}>ƒx Indicators</button>

        {/* Drawings */}
        <button onClick={() => setShowDrawings(v => !v)} style={{
          background: showDrawings ? 'rgba(245,166,35,0.15)' : 'transparent',
          border: `1px solid ${showDrawings ? AMBER : BORDER}`, borderRadius: 3,
          color: showDrawings ? AMBER : MUTED, padding: '3px 8px', cursor: 'pointer', fontSize: 10,
        }}>✏ Draw</button>

        <div style={{ flex: 1 }} />

        {/* Crosshair sync */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: MUTED, fontSize: 10 }}>
          <input type="checkbox" checked={crosshairSync} onChange={() => setCrosshairSync(v => !v)}
            style={{ accentColor: AMBER }} />
          Sync Crosshair
        </label>

        {/* Volume toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: MUTED, fontSize: 10 }}>
          <input type="checkbox" checked={activePanelData?.showVolume ?? true}
            onChange={() => updatePanel(activePanel, { showVolume: !activePanelData?.showVolume })}
            style={{ accentColor: AMBER }} />
          Vol
        </label>
      </div>

      {/* Drawing tools sidebar */}
      {showDrawings && (
        <div style={{ position: 'absolute', left: 0, top: 70, bottom: 0, width: 150, background: PANEL, borderRight: `1px solid ${BORDER}`, zIndex: 10, overflowY: 'auto', padding: 8 }}>
          <div style={{ color: AMBER, fontSize: 10, fontWeight: 700, marginBottom: 8 }}>DRAWING TOOLS</div>
          {Array.from(new Set(DRAWING_TOOLS.map(t => t.category))).map(cat => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ color: MUTED, fontSize: 9, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{cat}</div>
              {DRAWING_TOOLS.filter(t => t.category === cat).map(tool => (
                <div key={tool.id} onClick={() => setSelectedTool(tool.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 3,
                    cursor: 'pointer', fontSize: 11,
                    background: selectedTool === tool.id ? 'rgba(245,166,35,0.12)' : 'transparent',
                    color: selectedTool === tool.id ? AMBER : '#ccc',
                  }}>
                  <span style={{ width: 16, textAlign: 'center' }}>{tool.icon}</span>
                  <span>{tool.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Indicators panel */}
      {showIndicators && (
        <div style={{ position: 'absolute', right: 0, top: 70, width: 200, background: PANEL, borderLeft: `1px solid ${BORDER}`, zIndex: 10, padding: 12 }}>
          <div style={{ color: AMBER, fontSize: 10, fontWeight: 700, marginBottom: 8 }}>INDICATORS</div>
          {INDICATOR_LIST.map(ind => {
            const active = activePanelData?.indicators.includes(ind);
            return (
              <div key={ind} onClick={() => {
                const cur = activePanelData?.indicators || [];
                updatePanel(activePanel, { indicators: active ? cur.filter(i => i !== ind) : [...cur, ind] });
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 3,
                cursor: 'pointer', fontSize: 11, marginBottom: 2,
                background: active ? 'rgba(245,166,35,0.08)' : 'transparent',
                color: active ? AMBER : '#ccc',
              }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${active ? AMBER : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
                  {active ? '✓' : ''}
                </span>
                {ind}
              </div>
            );
          })}
        </div>
      )}

      {/* Chart grid */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        gap: 1, background: BORDER, overflow: 'hidden',
        marginLeft: showDrawings ? 150 : 0,
      }}>
        {panels.slice(0, layout.panels).map((panel) => (
          <div key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            style={{
              position: 'relative', overflow: 'hidden',
              border: activePanel === panel.id ? `1px solid ${AMBER}44` : '1px solid transparent',
            }}>
            <CandleChart
              panel={panel}
              crosshairX={crosshairSync ? crosshairX : (activePanel === panel.id ? crosshairX : null)}
              onCrosshair={setCrosshairX}
              active={activePanel === panel.id}
            />
            {/* Panel header overlay */}
            <div style={{
              position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4, zIndex: 5,
            }}>
              <select value={panel.symbol}
                onChange={e => { e.stopPropagation(); updatePanel(panel.id, { symbol: e.target.value }); }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#000a', border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '2px 4px', fontSize: 9 }}>
                {SYMBOLS.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={panel.interval}
                onChange={e => { e.stopPropagation(); updatePanel(panel.id, { interval: e.target.value }); }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#000a', border: `1px solid ${BORDER}`, borderRadius: 3, color: MUTED, padding: '2px 4px', fontSize: 9 }}>
                {INTERVALS.map(iv => <option key={iv}>{iv}</option>)}
              </select>
            </div>

            {/* Active indicator */}
            {activePanel === panel.id && (
              <div style={{
                position: 'absolute', bottom: 4, left: 4, padding: '1px 6px', borderRadius: 3,
                background: `${AMBER}22`, color: AMBER, fontSize: 8, fontWeight: 700,
              }}>ACTIVE</div>
            )}

            {/* Indicator badges */}
            {panel.indicators.length > 0 && (
              <div style={{ position: 'absolute', top: 22, left: 8, display: 'flex', gap: 4 }}>
                {panel.indicators.map(ind => (
                  <span key={ind} style={{ padding: '1px 4px', borderRadius: 2, background: '#000a', fontSize: 8, color: MUTED }}>{ind}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 12px', borderTop: `1px solid ${BORDER}`, fontSize: 10, color: MUTED }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>Layout: {layout.name} ({layout.panels} panels)</span>
          <span>Active: {activePanelData?.symbol}</span>
          <span>Interval: {activePanelData?.interval}</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: GREEN }}>● Market Open</span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
