/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Chart Replay Engine (UI2)                           │
 * │  Tick-by-tick replay with speed control, overlay annotations,        │
 * │  strategy tester, and performance analytics — tasks.md §12           │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/* ── Design Tokens ───────────────────────────────────────────────────── */
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
interface ReplayCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ReplayTrade {
  id: string;
  time: number;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  pnl: number;
  strategy: string;
}

interface ReplayAnnotation {
  id: string;
  time: number;
  price: number;
  text: string;
  type: 'signal' | 'entry' | 'exit' | 'alert';
  color: string;
}

interface PerformancePoint {
  time: number;
  equity: number;
  drawdown: number;
  trades: number;
}

type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 5 | 10 | 25 | 50;

/* ── Mock Data Generators ────────────────────────────────────────────── */
function generateReplayCandles(symbol: string, count: number): ReplayCandle[] {
  const bases: Record<string, number> = {
    'AAPL': 185, 'MSFT': 420, 'GOOGL': 175, 'AMZN': 185, 'TSLA': 245,
    'NVDA': 880, 'META': 505, 'SPY': 510, 'QQQ': 440, 'IWM': 210,
  };
  let price = bases[symbol] ?? 100 + Math.random() * 400;
  const candles: ReplayCandle[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const volatility = 0.003 + Math.random() * 0.005;
    const drift = (Math.random() - 0.48) * volatility;
    const o = price;
    const c = +(o * (1 + drift)).toFixed(2);
    const h = +Math.max(o, c, o * (1 + Math.random() * volatility)).toFixed(2);
    const l = +Math.min(o, c, o * (1 - Math.random() * volatility)).toFixed(2);
    candles.push({ time: now - (count - i) * 300000, open: o, high: h, low: l, close: c, volume: Math.round(100000 + Math.random() * 2000000) });
    price = c;
  }
  return candles;
}

function generateTrades(candles: ReplayCandle[]): ReplayTrade[] {
  const trades: ReplayTrade[] = [];
  let position = 0;
  let entryPrice = 0;
  const strategies = ['MA Crossover', 'RSI Divergence', 'VWAP Bounce', 'Breakout'];
  for (let i = 20; i < candles.length; i++) {
    if (Math.random() > 0.92 && position === 0) {
      const side: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
      position = side === 'BUY' ? 1 : -1;
      entryPrice = candles[i].close;
      trades.push({ id: `T${trades.length + 1}`, time: candles[i].time, side, price: candles[i].close, qty: Math.round(10 + Math.random() * 90), pnl: 0, strategy: strategies[Math.floor(Math.random() * strategies.length)] });
    } else if (Math.random() > 0.90 && position !== 0) {
      const exitSide: 'BUY' | 'SELL' = position > 0 ? 'SELL' : 'BUY';
      const pnl = position > 0 ? (candles[i].close - entryPrice) * trades[trades.length - 1].qty : (entryPrice - candles[i].close) * trades[trades.length - 1].qty;
      trades.push({ id: `T${trades.length + 1}`, time: candles[i].time, side: exitSide, price: candles[i].close, qty: trades[trades.length - 1].qty, pnl: +pnl.toFixed(2), strategy: trades[trades.length - 1].strategy });
      position = 0; entryPrice = 0;
    }
  }
  return trades;
}

function generateAnnotations(candles: ReplayCandle[]): ReplayAnnotation[] {
  const annotations: ReplayAnnotation[] = [];
  const types: ReplayAnnotation['type'][] = ['signal', 'entry', 'exit', 'alert'];
  const texts = ['MA Cross Up', 'MA Cross Down', 'RSI Overbought', 'RSI Oversold', 'VWAP Touch', 'Volume Spike', 'Gap Up', 'Gap Down', 'Support Test', 'Resistance Break'];
  for (let i = 10; i < candles.length; i += Math.floor(10 + Math.random() * 30)) {
    const type = types[Math.floor(Math.random() * types.length)];
    annotations.push({ id: `A${annotations.length + 1}`, time: candles[i].time, price: candles[i].close, text: texts[Math.floor(Math.random() * texts.length)], type, color: type === 'entry' ? T.up : type === 'exit' ? T.dn : type === 'signal' ? T.brand : T.warn });
  }
  return annotations;
}

function computePerformance(trades: ReplayTrade[], candles: ReplayCandle[]): PerformancePoint[] {
  const points: PerformancePoint[] = [];
  let equity = 100000, maxEquity = equity, tradeIdx = 0;
  for (const candle of candles) {
    while (tradeIdx < trades.length && trades[tradeIdx].time <= candle.time) { equity += trades[tradeIdx].pnl; if (equity > maxEquity) maxEquity = equity; tradeIdx++; }
    points.push({ time: candle.time, equity, drawdown: maxEquity > 0 ? ((maxEquity - equity) / maxEquity) * 100 : 0, trades: tradeIdx });
  }
  return points;
}

/* ── Indicator Calculations ──────────────────────────────────────────── */
function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => i < period - 1 ? null : closes.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period);
}
function calcEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1); const ema: (number | null)[] = []; let prev: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { ema.push(null); continue; }
    if (prev === null) { prev = closes.slice(0, period).reduce((s, v) => s + v, 0) / period; } else { prev = closes[i] * k + prev * (1 - k); }
    ema.push(prev);
  }
  return ema;
}
function calcRSI(closes: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = []; let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { rsi.push(null); continue; }
    const change = closes[i] - closes[i - 1], gain = change > 0 ? change : 0, loss = change < 0 ? -change : 0;
    if (i <= period) { avgGain += gain / period; avgLoss += loss / period; if (i === period) rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)); else rsi.push(null); }
    else { avgGain = (avgGain * (period - 1) + gain) / period; avgLoss = (avgLoss * (period - 1) + loss) / period; rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)); }
  }
  return rsi;
}
function calcVWAP(candles: ReplayCandle[]): number[] {
  let cumVol = 0, cumTP = 0;
  return candles.map(c => { const tp = (c.high + c.low + c.close) / 3; cumVol += c.volume; cumTP += tp * c.volume; return cumVol > 0 ? cumTP / cumVol : tp; });
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function PlaybackControls({ speed, setSpeed, playing, onPlay, onPause, onStop, onStepForward, onStepBack, progress, totalCandles, currentCandle, onSeek }: {
  speed: PlaybackSpeed; setSpeed: (s: PlaybackSpeed) => void; playing: boolean; onPlay: () => void; onPause: () => void; onStop: () => void; onStepForward: () => void; onStepBack: () => void; progress: number; totalCandles: number; currentCandle: number; onSeek: (pos: number) => void;
}) {
  const speeds: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 5, 10, 25, 50];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.r }}>
      <button onClick={onStop} title="Stop" style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>⏹</button>
      <button onClick={onStepBack} title="Step Back" style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>⏮</button>
      <button onClick={playing ? onPause : onPlay} title={playing ? 'Pause' : 'Play'} style={{ background: playing ? T.warn : T.brand, color: '#FFF', border: 'none', borderRadius: '3px', padding: '4px 12px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}>{playing ? '⏸' : '▶'}</button>
      <button onClick={onStepForward} title="Step Forward" style={{ background: T.bg3, color: T.tx1, border: `1px solid ${T.border}`, borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>⏭</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px' }}>
        <span style={{ fontSize: '8px', color: T.tx3, marginRight: '3px' }}>SPEED</span>
        {speeds.map(s => (
          <button key={s} onClick={() => setSpeed(s)} style={{ background: speed === s ? T.brand : T.bg3, color: speed === s ? '#FFF' : T.tx2, border: `1px solid ${speed === s ? T.brand : T.border}`, borderRadius: '2px', padding: '2px 5px', cursor: 'pointer', fontSize: '8px', fontFamily: T.mono, fontWeight: 600 }}>{s}x</button>
        ))}
      </div>
      <div style={{ flex: 1, marginLeft: '8px' }}>
        <input type="range" min={0} max={totalCandles - 1} value={currentCandle} onChange={e => onSeek(+e.target.value)} style={{ width: '100%', height: '4px', accentColor: T.brand }} />
      </div>
      <span style={{ fontSize: '9px', fontFamily: T.mono, color: T.tx2, minWidth: '80px', textAlign: 'right' }}>
        {currentCandle + 1} / {totalCandles} ({(progress * 100).toFixed(1)}%)
      </span>
    </div>
  );
}

function TradeBlotter({ trades, visibleTrades }: { trades: ReplayTrade[]; visibleTrades: ReplayTrade[] }) {
  const totalPnl = visibleTrades.filter(t => t.pnl !== 0).reduce((s, t) => s + t.pnl, 0);
  const winners = visibleTrades.filter(t => t.pnl > 0).length;
  const losers = visibleTrades.filter(t => t.pnl < 0).length;
  const winRate = winners + losers > 0 ? (winners / (winners + losers)) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>Trade Blotter</span>
        <div style={{ display: 'flex', gap: '8px', fontSize: '8px', fontFamily: T.mono }}>
          <span style={{ color: totalPnl >= 0 ? T.up : T.dn }}>P&L: ${totalPnl.toFixed(2)}</span>
          <span style={{ color: T.up }}>W: {winners}</span>
          <span style={{ color: T.dn }}>L: {losers}</span>
          <span style={{ color: T.tx2 }}>WR: {winRate.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ overflow: 'auto', maxHeight: '200px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {['ID', 'Time', 'Side', 'Price', 'Qty', 'P&L', 'Strategy'].map(h => (
                <th key={h} style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTrades.slice(-20).reverse().map(t => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'left' }}>{t.id}</td>
                <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{new Date(t.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ padding: '3px 4px', color: t.side === 'BUY' ? T.up : T.dn, textAlign: 'right', fontWeight: 700 }}>{t.side}</td>
                <td style={{ padding: '3px 4px', color: T.tx0, textAlign: 'right' }}>${t.price.toFixed(2)}</td>
                <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{t.qty}</td>
                <td style={{ padding: '3px 4px', color: t.pnl > 0 ? T.up : t.pnl < 0 ? T.dn : T.tx3, textAlign: 'right' }}>{t.pnl !== 0 ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{t.strategy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquityCurve({ perfData, currentIdx }: { perfData: PerformancePoint[]; currentIdx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs || !perfData.length) return;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const parent = cvs.parentElement; cvs.width = parent?.clientWidth ?? 400; cvs.height = 120;
    const w = cvs.width, h = cvs.height; ctx.clearRect(0, 0, w, h);
    const visible = perfData.slice(0, currentIdx + 1); if (!visible.length) return;
    const equities = visible.map(p => p.equity);
    const mn = Math.min(...equities) * 0.999, mx = Math.max(...equities) * 1.001, range = mx - mn || 1;
    ctx.strokeStyle = T.border; ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) { const y = 5 + (i / 3) * (h - 15); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const isUp = equities[equities.length - 1] >= equities[0];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); visible.forEach((p, i) => { const x = (i / (perfData.length - 1)) * w; const y = 5 + ((mx - p.equity) / range) * (h - 15); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.lineTo((visible.length - 1) / (perfData.length - 1) * w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); visible.forEach((p, i) => { const x = (i / (perfData.length - 1)) * w; const y = 5 + ((mx - p.equity) / range) * (h - 15); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = isUp ? T.up : T.dn; ctx.lineWidth = 1.5; ctx.stroke();
    const lastEq = visible[visible.length - 1].equity;
    ctx.fillStyle = T.tx0; ctx.font = 'bold 10px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText(`$${lastEq.toLocaleString(undefined, { minimumFractionDigits: 0 })}`, w - 5, 14);
    ctx.fillStyle = T.tx3; ctx.font = '8px Inter'; ctx.fillText('Equity Curve', w - 5, 24);
  }, [perfData, currentIdx]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: '120px' }} />;
}

function DrawdownChart({ perfData, currentIdx }: { perfData: PerformancePoint[]; currentIdx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs || !perfData.length) return;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const parent = cvs.parentElement; cvs.width = parent?.clientWidth ?? 400; cvs.height = 80;
    const w = cvs.width, h = cvs.height; ctx.clearRect(0, 0, w, h);
    const visible = perfData.slice(0, currentIdx + 1); if (!visible.length) return;
    const maxDD = Math.max(...visible.map(p => p.drawdown), 0.1);
    visible.forEach((p, i) => { const x = (i / (perfData.length - 1)) * w; const barH = (p.drawdown / maxDD) * (h - 5); ctx.fillStyle = `rgba(239,83,80,${0.2 + (p.drawdown / maxDD) * 0.6})`; ctx.fillRect(x, 0, Math.max(w / perfData.length, 1), barH); });
    ctx.fillStyle = T.tx3; ctx.font = '8px Inter'; ctx.textAlign = 'right'; ctx.fillText(`Max DD: ${maxDD.toFixed(2)}%`, w - 5, h - 5);
  }, [perfData, currentIdx]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: '80px' }} />;
}

function StatsSidebar({ trades, perfData, currentIdx }: { trades: ReplayTrade[]; perfData: PerformancePoint[]; currentIdx: number }) {
  const closedTrades = trades.filter(t => t.pnl !== 0 && trades.indexOf(t) <= currentIdx);
  const winners = closedTrades.filter(t => t.pnl > 0);
  const losers = closedTrades.filter(t => t.pnl < 0);
  const totalPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.pnl, 0) / losers.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin * winners.length / (avgLoss * losers.length)) : 0;
  const maxWin = winners.length > 0 ? Math.max(...winners.map(t => t.pnl)) : 0;
  const maxLoss = losers.length > 0 ? Math.min(...losers.map(t => t.pnl)) : 0;
  const currentEquity = perfData[currentIdx]?.equity ?? 100000;
  const currentDD = perfData[currentIdx]?.drawdown ?? 0;
  const maxDD = Math.max(...perfData.slice(0, currentIdx + 1).map(p => p.drawdown));
  const stats = [
    { label: 'Total P&L', value: `$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? T.up : T.dn },
    { label: 'Equity', value: `$${currentEquity.toLocaleString()}`, color: T.tx0 },
    { label: 'Trades', value: `${closedTrades.length}`, color: T.tx1 },
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? T.up : T.dn },
    { label: 'Avg Win', value: `$${avgWin.toFixed(2)}`, color: T.up },
    { label: 'Avg Loss', value: `$${avgLoss.toFixed(2)}`, color: T.dn },
    { label: 'Profit Factor', value: `${profitFactor.toFixed(2)}`, color: profitFactor >= 1 ? T.up : T.dn },
    { label: 'Max Win', value: `$${maxWin.toFixed(2)}`, color: T.up },
    { label: 'Max Loss', value: `$${maxLoss.toFixed(2)}`, color: T.dn },
    { label: 'Current DD', value: `${currentDD.toFixed(2)}%`, color: currentDD > 5 ? T.dn : T.tx1 },
    { label: 'Max DD', value: `${maxDD.toFixed(2)}%`, color: maxDD > 10 ? T.dn : T.warn },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '3px' }}>Performance Stats</div>
      {stats.map(s => (
        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ fontSize: '8px', color: T.tx3 }}>{s.label}</span>
          <span style={{ fontSize: '9px', fontWeight: 700, color: s.color, fontFamily: T.mono }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function IndicatorPanel({ candles, currentIdx }: { candles: ReplayCandle[]; currentIdx: number }) {
  const visible = candles.slice(0, currentIdx + 1);
  const closes = visible.map(c => c.close);
  const rsi = calcRSI(closes); const sma20 = calcSMA(closes, 20); const ema9 = calcEMA(closes, 9); const vwap = calcVWAP(visible);
  const lastRSI = rsi[rsi.length - 1]; const lastSMA20 = sma20[sma20.length - 1]; const lastEMA9 = ema9[ema9.length - 1]; const lastVWAP = vwap[vwap.length - 1]; const lastClose = closes[closes.length - 1];
  const indicators = [
    { label: 'RSI(14)', value: lastRSI?.toFixed(1) ?? '—', signal: !lastRSI ? 'neutral' : lastRSI > 70 ? 'sell' : lastRSI < 30 ? 'buy' : 'neutral' },
    { label: 'SMA(20)', value: lastSMA20?.toFixed(2) ?? '—', signal: !lastSMA20 ? 'neutral' : lastClose > lastSMA20 ? 'buy' : 'sell' },
    { label: 'EMA(9)', value: lastEMA9?.toFixed(2) ?? '—', signal: !lastEMA9 ? 'neutral' : lastClose > lastEMA9 ? 'buy' : 'sell' },
    { label: 'VWAP', value: lastVWAP?.toFixed(2) ?? '—', signal: lastClose > lastVWAP ? 'buy' : 'sell' },
    { label: 'Close', value: lastClose?.toFixed(2) ?? '—', signal: 'neutral' },
  ];
  const signalColors = { buy: T.up, sell: T.dn, neutral: T.tx2 };
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Indicators</div>
      {indicators.map(ind => (
        <div key={ind.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', color: T.tx3 }}>{ind.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '9px', fontFamily: T.mono, color: T.tx0 }}>{ind.value}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: signalColors[ind.signal as keyof typeof signalColors] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
export default function ReplayUI2() {
  const [symbol, setSymbol] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('5m');
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [playing, setPlaying] = useState(false);
  const [currentCandle, setCurrentCandle] = useState(0);
  const [showIndicators, setShowIndicators] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);

  const allCandles = useMemo(() => generateReplayCandles(symbol, 500), [symbol]);
  const allTrades = useMemo(() => generateTrades(allCandles), [allCandles]);
  const allAnnotations = useMemo(() => generateAnnotations(allCandles), [allCandles]);
  const perfData = useMemo(() => computePerformance(allTrades, allCandles), [allTrades, allCandles]);

  const visibleCandles = allCandles.slice(0, currentCandle + 1);
  const visibleTrades = allTrades.filter(t => t.time <= (allCandles[currentCandle]?.time ?? 0));
  const visibleAnnotations = allAnnotations.filter(a => a.time <= (allCandles[currentCandle]?.time ?? 0));

  useEffect(() => {
    if (playing) {
      intervalRef.current = window.setInterval(() => {
        setCurrentCandle(prev => { if (prev >= allCandles.length - 1) { setPlaying(false); return prev; } return prev + 1; });
      }, 1000 / speed);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, allCandles.length]);

  // Draw chart
  useEffect(() => {
    const cvs = chartRef.current; if (!cvs || !visibleCandles.length) return;
    const parent = cvs.parentElement; if (!parent) return;
    cvs.width = parent.clientWidth; cvs.height = parent.clientHeight;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const w = cvs.width, h = cvs.height, pad = { t: 25, r: 60, b: 30, l: 5 };
    ctx.clearRect(0, 0, w, h);
    const maxBars = Math.min(100, visibleCandles.length);
    const displayCandles = visibleCandles.slice(-maxBars);
    const prices = displayCandles.flatMap(c => [c.high, c.low]);
    const mn = Math.min(...prices) * 0.9995, mx = Math.max(...prices) * 1.0005, range = mx - mn || 1;
    const chartH = showVolume ? (h - pad.t - pad.b) * 0.75 : (h - pad.t - pad.b);
    const volH = showVolume ? (h - pad.t - pad.b) * 0.18 : 0;
    const volTop = pad.t + chartH + 8;
    const barW = Math.max(3, (w - pad.l - pad.r) / maxBars);
    const maxVol = Math.max(...displayCandles.map(c => c.volume));

    // Grid
    ctx.strokeStyle = T.border; ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = pad.t + (i / 5) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'left';
      ctx.fillText('$' + (mx - (i / 5) * range).toFixed(2), w - pad.r + 4, y + 3);
    }

    // Candles
    displayCandles.forEach((c, i) => {
      const x = pad.l + i * barW + barW / 2;
      const isUp = c.close >= c.open; const col = isUp ? T.up : T.dn;
      const hY = pad.t + ((mx - c.high) / range) * chartH;
      const lY = pad.t + ((mx - c.low) / range) * chartH;
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, hY); ctx.lineTo(x, lY); ctx.stroke();
      const oY = pad.t + ((mx - c.open) / range) * chartH;
      const cY = pad.t + ((mx - c.close) / range) * chartH;
      const bodyTop = Math.min(oY, cY); const bodyH = Math.max(Math.abs(cY - oY), 1);
      ctx.fillStyle = col; ctx.fillRect(x - barW * 0.35, bodyTop, barW * 0.7, bodyH);
      if (showVolume) { const vH = (c.volume / maxVol) * volH; ctx.fillStyle = isUp ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)'; ctx.fillRect(x - barW * 0.35, volTop + volH - vH, barW * 0.7, vH); }
    });

    // Indicators
    if (showIndicators) {
      const closes = displayCandles.map(c => c.close);
      const sma20 = calcSMA(closes, Math.min(20, closes.length));
      const ema9 = calcEMA(closes, Math.min(9, closes.length));
      const vwap = calcVWAP(displayCandles);
      [[sma20, '#FF9800', 1], [ema9, T.purple, 1], [vwap, T.info, 1]].forEach(([data, color, lw]) => {
        ctx.beginPath(); ctx.strokeStyle = color as string; ctx.lineWidth = lw as number;
        (data as (number | null)[]).forEach((v, i) => { if (v === null) return; const x = pad.l + i * barW + barW / 2; const y = pad.t + ((mx - v) / range) * chartH; if (i === 0 || (data as (number | null)[])[i - 1] === null) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
      });
    }

    // Annotations
    if (showAnnotations) {
      const startTime = displayCandles[0]?.time ?? 0; const endTime = displayCandles[displayCandles.length - 1]?.time ?? 0;
      visibleAnnotations.filter(a => a.time >= startTime && a.time <= endTime).forEach(a => {
        const idx = displayCandles.findIndex(c => c.time >= a.time); if (idx < 0) return;
        const x = pad.l + idx * barW + barW / 2; const y = pad.t + ((mx - a.price) / range) * chartH;
        ctx.fillStyle = a.color; ctx.beginPath(); ctx.arc(x, y - 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.font = '6px JetBrains Mono'; ctx.textAlign = 'center'; ctx.fillText(a.type[0].toUpperCase(), x, y - 6);
      });
    }

    // Trade markers
    const startTime = displayCandles[0]?.time ?? 0; const endTime = displayCandles[displayCandles.length - 1]?.time ?? 0;
    visibleTrades.filter(t => t.time >= startTime && t.time <= endTime).forEach(trade => {
      const idx = displayCandles.findIndex(c => c.time >= trade.time); if (idx < 0) return;
      const x = pad.l + idx * barW + barW / 2; const y = pad.t + ((mx - trade.price) / range) * chartH;
      const isBuy = trade.side === 'BUY'; ctx.fillStyle = isBuy ? T.up : T.dn;
      ctx.beginPath();
      if (isBuy) { ctx.moveTo(x, y + 12); ctx.lineTo(x - 5, y + 20); ctx.lineTo(x + 5, y + 20); }
      else { ctx.moveTo(x, y - 12); ctx.lineTo(x - 5, y - 20); ctx.lineTo(x + 5, y - 20); }
      ctx.closePath(); ctx.fill();
    });

    // Price line + label
    const last = displayCandles[displayCandles.length - 1];
    const lastY = pad.t + ((mx - last.close) / range) * chartH;
    ctx.setLineDash([3, 3]); ctx.strokeStyle = last.close >= last.open ? T.up : T.dn; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(pad.l, lastY); ctx.lineTo(w - pad.r, lastY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = last.close >= last.open ? T.up : T.dn; ctx.fillRect(w - pad.r, lastY - 8, 58, 16);
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px JetBrains Mono'; ctx.textAlign = 'left';
    ctx.fillText('$' + last.close.toFixed(2), w - pad.r + 3, lastY + 4);
    ctx.fillStyle = T.tx0; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'left';
    ctx.fillText(`${symbol} — Replay ${timeframe}`, pad.l + 4, pad.t - 5);
  }, [visibleCandles, showIndicators, showAnnotations, showVolume, symbol, timeframe, visibleTrades, visibleAnnotations]);

  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'SPY', 'QQQ', 'IWM'];
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D'];

  return (
    <div data-testid="replay-ui2-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>CHART REPLAY</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <select value={symbol} onChange={e => { setSymbol(e.target.value); setCurrentCandle(0); setPlaying(false); }}
          style={{ background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '3px 6px', fontSize: '10px', fontFamily: T.mono }}>
          {symbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
          style={{ background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '3px 6px', fontSize: '10px', fontFamily: T.mono }}>
          {timeframes.map(tf => <option key={tf} value={tf}>{tf}</option>)}
        </select>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        {[{ label: 'Indicators', value: showIndicators, set: setShowIndicators },
          { label: 'Annotations', value: showAnnotations, set: setShowAnnotations },
          { label: 'Volume', value: showVolume, set: setShowVolume },
        ].map(toggle => (
          <button key={toggle.label} onClick={() => toggle.set(!toggle.value)} style={{
            background: toggle.value ? T.brand : T.bg3, color: toggle.value ? '#FFF' : T.tx3,
            border: `1px solid ${toggle.value ? T.brand : T.border}`, borderRadius: '2px', padding: '2px 6px', fontSize: '8px', fontWeight: 600, cursor: 'pointer',
          }}>{toggle.label}</button>
        ))}
      </div>
      <div style={{ padding: '4px 10px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <PlaybackControls speed={speed} setSpeed={setSpeed} playing={playing} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onStop={() => { setPlaying(false); setCurrentCandle(0); }}
          onStepForward={() => setCurrentCandle(Math.min(currentCandle + 1, allCandles.length - 1))}
          onStepBack={() => setCurrentCandle(Math.max(currentCandle - 1, 0))}
          progress={allCandles.length > 0 ? currentCandle / (allCandles.length - 1) : 0}
          totalCandles={allCandles.length} currentCandle={currentCandle}
          onSeek={pos => { setCurrentCandle(pos); setPlaying(false); }}
        />
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '4px', flexShrink: 0 }}>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px' }}>
              <EquityCurve perfData={perfData} currentIdx={currentCandle} />
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '6px' }}>
              <DrawdownChart perfData={perfData} currentIdx={currentCandle} />
            </div>
          </div>
        </div>
        <div style={{ width: '220px', flexShrink: 0, overflow: 'auto', padding: '8px', borderLeft: `1px solid ${T.border}`, background: T.bg1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <StatsSidebar trades={allTrades} perfData={perfData} currentIdx={currentCandle} />
          <div style={{ height: 1, background: T.border }} />
          <IndicatorPanel candles={allCandles} currentIdx={currentCandle} />
          <div style={{ height: 1, background: T.border }} />
          <TradeBlotter trades={allTrades} visibleTrades={visibleTrades} />
        </div>
      </div>
    </div>
  );
}

export { ReplayUI2 };
