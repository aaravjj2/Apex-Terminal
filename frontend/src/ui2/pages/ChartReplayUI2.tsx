import React, { useState, useRef, useEffect, useCallback } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }

function generateHistory(symbol: string, barCount: number): Candle[] {
  const candles: Candle[] = [];
  let price = symbol === 'AAPL' ? 180 : symbol === 'MSFT' ? 400 : symbol === 'GOOGL' ? 170 : 150;
  const baseTime = Date.now() - barCount * 60000;
  for (let i = 0; i < barCount; i++) {
    const volatility = price * 0.005;
    const change = (Math.random() - 0.48) * volatility * 2;
    const open = price;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    candles.push({
      time: baseTime + i * 60000,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(50000 + Math.random() * 200000),
    });
    price = close;
  }
  return candles;
}

const SPEEDS = [0.5, 1, 2, 5, 10, 25, 50, 100];
const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'];
const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'JPM', 'SPY'];

function drawCandlestick(ctx: CanvasRenderingContext2D, w: number, h: number, candles: Candle[], visibleCount: number, currentIdx: number, showVolume: boolean, showSMA: boolean) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);

  const pad = { top: 20, right: 60, bottom: showVolume ? 80 : 30, left: 10 };
  const chartH = h - pad.top - pad.bottom - (showVolume ? 60 : 0);
  const startIdx = Math.max(0, currentIdx - visibleCount);
  const visible = candles.slice(startIdx, currentIdx + 1);
  if (visible.length === 0) return;

  const maxPrice = Math.max(...visible.map(c => c.high));
  const minPrice = Math.min(...visible.map(c => c.low));
  const priceRange = maxPrice - minPrice || 1;
  const candleW = Math.max(3, (w - pad.left - pad.right) / visibleCount);

  // Grid
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (chartH * i) / 5;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    const price = maxPrice - (priceRange * i) / 5;
    ctx.fillStyle = DIM; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('$' + price.toFixed(2), w - pad.right + 3, y + 3);
  }

  // Candles
  visible.forEach((c, i) => {
    const x = pad.left + i * candleW;
    const isGreen = c.close >= c.open;

    // Wick
    const wickX = x + candleW / 2;
    const highY = pad.top + ((maxPrice - c.high) / priceRange) * chartH;
    const lowY = pad.top + ((maxPrice - c.low) / priceRange) * chartH;
    ctx.strokeStyle = isGreen ? GREEN : RED;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(wickX, highY); ctx.lineTo(wickX, lowY); ctx.stroke();

    // Body
    const openY = pad.top + ((maxPrice - c.open) / priceRange) * chartH;
    const closeY = pad.top + ((maxPrice - c.close) / priceRange) * chartH;
    const bodyTop = Math.min(openY, closeY);
    const bodyH = Math.max(Math.abs(closeY - openY), 1);
    ctx.fillStyle = isGreen ? GREEN : RED;
    ctx.globalAlpha = isGreen ? 0.9 : 0.9;
    ctx.fillRect(x + 1, bodyTop, candleW - 2, bodyH);
    ctx.globalAlpha = 1;
  });

  // SMA overlay
  if (showSMA && visible.length >= 20) {
    [{ period: 20, color: AMBER }, { period: 50, color: CYAN }].forEach(sma => {
      if (visible.length < sma.period) return;
      ctx.strokeStyle = sma.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
      ctx.beginPath();
      let started = false;
      for (let i = sma.period - 1; i < visible.length; i++) {
        const avg = visible.slice(i - sma.period + 1, i + 1).reduce((a, c) => a + c.close, 0) / sma.period;
        const x = pad.left + i * candleW + candleW / 2;
        const y = pad.top + ((maxPrice - avg) / priceRange) * chartH;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  // Volume
  if (showVolume) {
    const volTop = h - pad.bottom;
    const volH = 50;
    const maxVol = Math.max(...visible.map(c => c.volume));
    visible.forEach((c, i) => {
      const x = pad.left + i * candleW;
      const barH = (c.volume / maxVol) * volH;
      ctx.fillStyle = c.close >= c.open ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.fillRect(x + 1, volTop - barH, candleW - 2, barH);
    });
  }

  // Current price line
  if (visible.length > 0) {
    const lastCandle = visible[visible.length - 1];
    const priceY = pad.top + ((maxPrice - lastCandle.close) / priceRange) * chartH;
    ctx.strokeStyle = lastCandle.close >= lastCandle.open ? GREEN : RED;
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(pad.left, priceY); ctx.lineTo(w - pad.right, priceY); ctx.stroke();
    ctx.setLineDash([]);
    // Price label
    ctx.fillStyle = lastCandle.close >= lastCandle.open ? GREEN : RED;
    ctx.fillRect(w - pad.right, priceY - 8, 56, 16);
    ctx.fillStyle = '#000'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('$' + lastCandle.close.toFixed(2), w - pad.right + 2, priceY + 3);
  }

  // Playhead position
  ctx.fillStyle = AMBER; ctx.font = '10px monospace'; ctx.textAlign = 'left';
  const timestamp = visible.length > 0 ? new Date(visible[visible.length - 1].time) : new Date();
  ctx.fillText(`${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`, pad.left, h - 5);

  ctx.textAlign = 'right';
  ctx.fillText(`Bar ${currentIdx + 1} / ${candles.length}`, w - pad.right, h - 5);
}

export default function ChartReplayUI2() {
  const [symbol, setSymbol] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1m');
  const [candles] = useState(() => {
    const map: Record<string, Candle[]> = {};
    SYMBOLS.forEach(s => { map[s] = generateHistory(s, 500); });
    return map;
  });
  const [currentIdx, setCurrentIdx] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [visibleBars, setVisibleBars] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number | null>(null);
  const data = candles[symbol] || [];

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    drawCandlestick(ctx, r.width, r.height, data, visibleBars, currentIdx, showVolume, showSMA);
  }, [data, visibleBars, currentIdx, showVolume, showSMA]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = window.setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= data.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, 1000 / speed);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, speed, data.length]);

  const currentCandle = data[currentIdx];
  const prevCandle = currentIdx > 0 ? data[currentIdx - 1] : null;
  const change = currentCandle && prevCandle ? currentCandle.close - prevCandle.close : 0;
  const changePct = prevCandle ? (change / prevCandle.close) * 100 : 0;

  // Stats for visible range
  const visibleData = data.slice(Math.max(0, currentIdx - visibleBars), currentIdx + 1);
  const sessionHigh = visibleData.length ? Math.max(...visibleData.map(c => c.high)) : 0;
  const sessionLow = visibleData.length ? Math.min(...visibleData.map(c => c.low)) : 0;
  const totalVolume = visibleData.reduce((a, c) => a + c.volume, 0);
  const avgVolume = visibleData.length ? totalVolume / visibleData.length : 0;

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>⏪ CHART REPLAY</span>
        <select value={symbol} onChange={e => { setSymbol(e.target.value); setCurrentIdx(50); setIsPlaying(false); }} style={{ padding: '3px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: AMBER, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' }}>
          {SYMBOLS.map(s => <option key={s}>{s}</option>)}
        </select>
        {currentCandle && (
          <>
            <span style={{ color: WHITE, fontSize: 16, fontWeight: 'bold' }}>${currentCandle.close.toFixed(2)}</span>
            <span style={{ color: change >= 0 ? GREEN : RED }}>{change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)</span>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{
              padding: '2px 8px', background: timeframe === tf ? AMBER : '#1a1a1a', color: timeframe === tf ? '#000' : DIM,
              border: `1px solid ${timeframe === tf ? AMBER : BORDER}`, cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
            }}>{tf}</button>
          ))}
        </div>
      </div>

      {/* OHLCV Bar */}
      {currentCandle && (
        <div style={{ display: 'flex', padding: '4px 16px', gap: 16, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', fontSize: 10 }}>
          <span style={{ color: DIM }}>O: <span style={{ color: WHITE }}>{currentCandle.open.toFixed(2)}</span></span>
          <span style={{ color: DIM }}>H: <span style={{ color: GREEN }}>{currentCandle.high.toFixed(2)}</span></span>
          <span style={{ color: DIM }}>L: <span style={{ color: RED }}>{currentCandle.low.toFixed(2)}</span></span>
          <span style={{ color: DIM }}>C: <span style={{ color: change >= 0 ? GREEN : RED }}>{currentCandle.close.toFixed(2)}</span></span>
          <span style={{ color: DIM }}>V: <span style={{ color: TEXT }}>{(currentCandle.volume / 1000).toFixed(0)}K</span></span>
          <span style={{ color: DIM }}>|</span>
          <span style={{ color: DIM }}>Hi: <span style={{ color: GREEN }}>{sessionHigh.toFixed(2)}</span></span>
          <span style={{ color: DIM }}>Lo: <span style={{ color: RED }}>{sessionLow.toFixed(2)}</span></span>
          <span style={{ color: DIM }}>Avg Vol: <span style={{ color: TEXT }}>{(avgVolume / 1000).toFixed(0)}K</span></span>
        </div>
      )}

      {/* Chart Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Control bar */}
      <div style={{ borderTop: `1px solid ${BORDER}`, background: '#0d0d0d' }}>
        {/* Transport controls */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 8 }}>
          <button onClick={() => { setCurrentIdx(50); setIsPlaying(false); }} title="Go to start" style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 14 }}>⏮</button>
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 10))} title="Back 10" style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 14 }}>⏪</button>
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} title="Back 1" style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 14 }}>◀</button>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{
            padding: '4px 16px', background: isPlaying ? 'rgba(239,83,80,0.2)' : 'rgba(38,166,154,0.2)',
            border: `1px solid ${isPlaying ? RED : GREEN}`, color: isPlaying ? RED : GREEN,
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 14
          }}>{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={() => setCurrentIdx(i => Math.min(data.length - 1, i + 1))} title="Forward 1" style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 14 }}>▶</button>
          <button onClick={() => setCurrentIdx(i => Math.min(data.length - 1, i + 10))} title="Forward 10" style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 14 }}>⏩</button>
          <button onClick={() => { setCurrentIdx(data.length - 1); setIsPlaying(false); }} title="Go to end" style={{ padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', fontFamily: 'monospace', fontSize: 14 }}>⏭</button>

          <span style={{ color: DIM, marginLeft: 12, fontSize: 10 }}>Speed:</span>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              padding: '2px 6px', background: speed === s ? AMBER : '#1a1a1a', color: speed === s ? '#000' : DIM,
              border: `1px solid ${speed === s ? AMBER : BORDER}`, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9
            }}>{s}x</button>
          ))}

          <span style={{ color: DIM, marginLeft: 12, fontSize: 10 }}>Bars:</span>
          {[50, 100, 200, 300].map(b => (
            <button key={b} onClick={() => setVisibleBars(b)} style={{
              padding: '2px 6px', background: visibleBars === b ? CYAN : '#1a1a1a', color: visibleBars === b ? '#000' : DIM,
              border: `1px solid ${visibleBars === b ? CYAN : BORDER}`, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9
            }}>{b}</button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: DIM, fontSize: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={showVolume} onChange={() => setShowVolume(!showVolume)} style={{ accentColor: AMBER }} />Volume
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: DIM, fontSize: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={showSMA} onChange={() => setShowSMA(!showSMA)} style={{ accentColor: AMBER }} />SMA
            </label>
          </div>
        </div>

        {/* Scrub bar */}
        <div style={{ padding: '0 16px 8px' }}>
          <input type="range" min={0} max={data.length - 1} value={currentIdx} onChange={e => { setCurrentIdx(parseInt(e.target.value)); setIsPlaying(false); }}
            style={{ width: '100%', accentColor: AMBER, cursor: 'pointer' }} />
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{symbol} | {timeframe}</span>
        <span style={{ color: isPlaying ? GREEN : DIM }}>{isPlaying ? `Playing at ${speed}x` : 'Paused'}</span>
        <span style={{ color: DIM }}>Bar {currentIdx + 1} / {data.length}</span>
        <span style={{ color: DIM }}>Historical Market Replay</span>
      </div>
    </div>
  );
}
