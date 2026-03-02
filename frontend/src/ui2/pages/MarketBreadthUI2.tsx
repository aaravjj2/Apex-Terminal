import React, { useState, useRef, useEffect, useCallback } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

interface BreadthData {
  date: string;
  advances: number;
  declines: number;
  unchanged: number;
  advVol: number;
  decVol: number;
  newHighs: number;
  newLows: number;
}

function generateBreadthHistory(days: number): BreadthData[] {
  const data: BreadthData[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);
  for (let i = 0; i < days; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const sentiment = Math.sin(i / 20) * 0.3 + (Math.random() - 0.5) * 0.4;
    const total = 3000 + Math.floor(Math.random() * 200);
    const advPct = 0.5 + sentiment * 0.3 + (Math.random() - 0.5) * 0.1;
    const advances = Math.floor(total * Math.max(0.15, Math.min(0.85, advPct)));
    const declines = Math.floor(total * (1 - Math.max(0.15, Math.min(0.85, advPct))) * 0.95);
    const unchanged = total - advances - declines;
    data.push({
      date: d.toISOString().slice(0, 10),
      advances,
      declines,
      unchanged,
      advVol: Math.floor((2 + Math.random() * 3) * 1e9 * Math.max(0.3, advPct)),
      decVol: Math.floor((2 + Math.random() * 3) * 1e9 * Math.max(0.3, 1 - advPct)),
      newHighs: Math.floor(20 + Math.random() * 150 * Math.max(0, sentiment + 0.5)),
      newLows: Math.floor(10 + Math.random() * 100 * Math.max(0, -sentiment + 0.5)),
    });
  }
  return data;
}

function computeIndicators(data: BreadthData[]) {
  // A/D Line (cumulative)
  const adLine: number[] = [];
  let cumAD = 0;
  data.forEach(d => {
    cumAD += d.advances - d.declines;
    adLine.push(cumAD);
  });

  // McClellan Oscillator: EMA19(A-D) - EMA39(A-D)
  const rawAD = data.map(d => d.advances - d.declines);
  const ema19 = ema(rawAD, 19);
  const ema39 = ema(rawAD, 39);
  const mcclellan = ema19.map((v, i) => v - ema39[i]);

  // McClellan Summation (cumulative of oscillator)
  const summation: number[] = [];
  let cumSum = 0;
  mcclellan.forEach(v => { cumSum += v; summation.push(cumSum); });

  // TRIN (Arms Index): (Advances/Declines) / (AdvVol/DecVol)
  const trin = data.map(d => {
    const adRatio = d.advances / Math.max(d.declines, 1);
    const volRatio = d.advVol / Math.max(d.decVol, 1);
    return adRatio / Math.max(volRatio, 0.01);
  });

  // Breadth Thrust: 10d EMA of Advances / (Advances + Declines)
  const breadthRatio = data.map(d => d.advances / (d.advances + d.declines));
  const thrustEMA = ema(breadthRatio, 10);

  // New Highs - New Lows
  const hiLo = data.map(d => d.newHighs - d.newLows);
  const hiLoMA = sma(hiLo, 10);

  return { adLine, mcclellan, summation, trin, thrustEMA, breadthRatio, hiLo, hiLoMA };
}

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(data[i]); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function drawLineChart(ctx: CanvasRenderingContext2D, w: number, h: number, data: number[], color: string, filled = false, zeroLine = false, barMode = false) {
  ctx.clearRect(0, 0, w, h);
  if (data.length === 0) return;
  const pad = { top: 15, right: 5, bottom: 15, left: 50 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;

  // Grid
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ch * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    const val = maxVal - (range * i) / 4;
    ctx.fillStyle = DIM; ctx.font = '8px monospace'; ctx.textAlign = 'right';
    ctx.fillText(val >= 1000 ? (val / 1000).toFixed(0) + 'K' : val.toFixed(val < 10 ? 2 : 0), pad.left - 3, y + 3);
  }

  if (zeroLine) {
    const zeroY = pad.top + ((maxVal - 0) / range) * ch;
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(pad.left + cw, zeroY); ctx.stroke();
  }

  if (barMode) {
    const barW = Math.max(1, cw / data.length - 1);
    const zeroY = pad.top + ((maxVal - 0) / range) * ch;
    data.forEach((v, i) => {
      const x = pad.left + (i / data.length) * cw;
      const y = pad.top + ((maxVal - v) / range) * ch;
      ctx.fillStyle = v >= 0 ? GREEN : RED;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, Math.min(y, zeroY), barW, Math.abs(y - zeroY));
      ctx.globalAlpha = 1;
    });
    return;
  }

  // Line
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad.left + (i / (data.length - 1)) * cw;
    const y = pad.top + ((maxVal - v) / range) * ch;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();

  if (filled) {
    const zeroY = zeroLine ? pad.top + ((maxVal - 0) / range) * ch : pad.top + ch;
    ctx.lineTo(pad.left + cw, zeroY);
    ctx.lineTo(pad.left, zeroY);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ',0.1)').replace('rgb', 'rgba');
    ctx.globalAlpha = 0.15;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Current value
  const lastVal = data[data.length - 1];
  const lastY = pad.top + ((maxVal - lastVal) / range) * ch;
  ctx.fillStyle = color; ctx.beginPath();
  ctx.arc(pad.left + cw, lastY, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'right';
  ctx.fillText(lastVal >= 1000 ? (lastVal / 1000).toFixed(1) + 'K' : lastVal.toFixed(lastVal < 10 ? 2 : 0), w - 3, lastY - 5);
}

const VIEWS = ['Dashboard', 'A/D Line', 'McClellan', 'TRIN', 'Breadth Thrust', 'Hi/Lo'];
const EXCHANGES = ['NYSE', 'NASDAQ', 'NYSE + NASDAQ'];

export default function MarketBreadthUI2() {
  const [view, setView] = useState(VIEWS[0]);
  const [exchange, setExchange] = useState('NYSE');
  const [lookback, setLookback] = useState(252);
  const [breadthData] = useState(() => generateBreadthHistory(500));
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const indicators = computeIndicators(breadthData);
  const today = breadthData[breadthData.length - 1];
  const yesterday = breadthData[breadthData.length - 2];

  const drawAll = useCallback(() => {
    const drawOne = (key: string, data: number[], color: string, filled = false, zeroLine = false, barMode = false) => {
      const c = canvasRefs.current[key]; if (!c) return;
      const ctx = c.getContext('2d'); if (!ctx) return;
      const r = c.parentElement!.getBoundingClientRect();
      c.width = r.width; c.height = r.height;
      drawLineChart(ctx, r.width, r.height, data.slice(-lookback), color, filled, zeroLine, barMode);
    };
    if (view === 'Dashboard') {
      drawOne('ad', indicators.adLine, GREEN, true);
      drawOne('mcclel', indicators.mcclellan, CYAN, false, true, true);
      drawOne('trin', indicators.trin, AMBER);
      drawOne('hilo', indicators.hiLo, GREEN, false, true, true);
    } else if (view === 'A/D Line') drawOne('adFull', indicators.adLine, GREEN, true);
    else if (view === 'McClellan') {
      drawOne('mccFull', indicators.mcclellan, CYAN, false, true, true);
      drawOne('sumFull', indicators.summation, AMBER, true);
    } else if (view === 'TRIN') drawOne('trinFull', indicators.trin, AMBER);
    else if (view === 'Breadth Thrust') drawOne('thrustFull', indicators.thrustEMA, GREEN);
    else if (view === 'Hi/Lo') drawOne('hiloFull', indicators.hiLo, GREEN, false, true, true);
  }, [view, lookback, indicators]);

  useEffect(() => { setTimeout(drawAll, 50); }, [drawAll]);

  const adDelta = today.advances - today.declines;
  const trinVal = indicators.trin[indicators.trin.length - 1];
  const mccVal = indicators.mcclellan[indicators.mcclellan.length - 1];
  const thrustVal = indicators.thrustEMA[indicators.thrustEMA.length - 1];

  const cs: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, position: 'relative', overflow: 'hidden' };

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderBottom: `1px solid ${BORDER}`, gap: 12 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>📊 MARKET BREADTH</span>
        <select value={exchange} onChange={e => setExchange(e.target.value)} style={{ padding: '3px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`, color: AMBER, fontFamily: 'monospace', fontSize: 11 }}>
          {EXCHANGES.map(e => <option key={e}>{e}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 2 }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '3px 8px', background: view === v ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: `1px solid ${view === v ? AMBER : 'transparent'}`, color: view === v ? AMBER : DIM,
              cursor: 'pointer', fontFamily: 'monospace', fontSize: 10
            }}>{v}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[63, 126, 252, 500].map(d => (
            <button key={d} onClick={() => setLookback(d)} style={{
              padding: '2px 6px', background: lookback === d ? CYAN : '#1a1a1a', color: lookback === d ? '#000' : DIM,
              border: `1px solid ${lookback === d ? CYAN : BORDER}`, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9
            }}>{d === 63 ? '3M' : d === 126 ? '6M' : d === 252 ? '1Y' : '2Y'}</button>
          ))}
        </div>
      </div>

      {/* Metrics strip */}
      <div style={{ display: 'flex', padding: '6px 16px', gap: 16, borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', fontSize: 10 }}>
        <span style={{ color: DIM }}>Adv: <span style={{ color: GREEN }}>{today.advances.toLocaleString()}</span></span>
        <span style={{ color: DIM }}>Dec: <span style={{ color: RED }}>{today.declines.toLocaleString()}</span></span>
        <span style={{ color: DIM }}>Unch: <span style={{ color: TEXT }}>{today.unchanged}</span></span>
        <span style={{ color: DIM }}>A/D: <span style={{ color: adDelta >= 0 ? GREEN : RED }}>{adDelta >= 0 ? '+' : ''}{adDelta}</span></span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: DIM }}>TRIN: <span style={{ color: trinVal < 1 ? GREEN : RED }}>{trinVal.toFixed(3)}</span></span>
        <span style={{ color: DIM }}>McClellan: <span style={{ color: mccVal >= 0 ? GREEN : RED }}>{mccVal.toFixed(1)}</span></span>
        <span style={{ color: DIM }}>Thrust: <span style={{ color: thrustVal > 0.5 ? GREEN : RED }}>{(thrustVal * 100).toFixed(1)}%</span></span>
        <span style={{ color: DIM }}>NH: <span style={{ color: GREEN }}>{today.newHighs}</span></span>
        <span style={{ color: DIM }}>NL: <span style={{ color: RED }}>{today.newLows}</span></span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'Dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, height: '100%', padding: 1 }}>
            {/* A/D Line */}
            <div style={cs}>
              <div style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: AMBER, fontSize: 10, fontWeight: 'bold' }}>ADVANCE/DECLINE LINE</span>
                <span style={{ color: indicators.adLine[indicators.adLine.length - 1] > indicators.adLine[indicators.adLine.length - 2] ? GREEN : RED, fontSize: 10 }}>
                  {indicators.adLine[indicators.adLine.length - 1].toLocaleString()}
                </span>
              </div>
              <div style={{ position: 'absolute', top: 24, left: 0, right: 0, bottom: 0 }}>
                <canvas ref={el => canvasRefs.current['ad'] = el} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>

            {/* McClellan */}
            <div style={cs}>
              <div style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: AMBER, fontSize: 10, fontWeight: 'bold' }}>McCLELLAN OSCILLATOR</span>
                <span style={{ color: mccVal >= 0 ? GREEN : RED, fontSize: 10 }}>{mccVal.toFixed(1)}</span>
              </div>
              <div style={{ position: 'absolute', top: 24, left: 0, right: 0, bottom: 0 }}>
                <canvas ref={el => canvasRefs.current['mcclel'] = el} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>

            {/* TRIN */}
            <div style={cs}>
              <div style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: AMBER, fontSize: 10, fontWeight: 'bold' }}>TRIN (ARMS INDEX)</span>
                <span style={{ color: trinVal < 1 ? GREEN : RED, fontSize: 10 }}>{trinVal.toFixed(3)} {trinVal < 0.8 ? '(Bullish)' : trinVal > 1.2 ? '(Bearish)' : '(Neutral)'}</span>
              </div>
              <div style={{ position: 'absolute', top: 24, left: 0, right: 0, bottom: 0 }}>
                <canvas ref={el => canvasRefs.current['trin'] = el} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>

            {/* New Highs / New Lows */}
            <div style={cs}>
              <div style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: AMBER, fontSize: 10, fontWeight: 'bold' }}>NEW HIGHS − NEW LOWS</span>
                <span style={{ color: (today.newHighs - today.newLows) >= 0 ? GREEN : RED, fontSize: 10 }}>{today.newHighs - today.newLows}</span>
              </div>
              <div style={{ position: 'absolute', top: 24, left: 0, right: 0, bottom: 0 }}>
                <canvas ref={el => canvasRefs.current['hilo'] = el} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
          </div>
        )}

        {view === 'A/D Line' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', display: 'flex', gap: 16, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>CUM. A/D</div>
                <div style={{ color: GREEN, fontSize: 18, fontWeight: 'bold' }}>{indicators.adLine[indicators.adLine.length - 1].toLocaleString()}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>TODAY A-D</div>
                <div style={{ color: adDelta >= 0 ? GREEN : RED, fontSize: 18, fontWeight: 'bold' }}>{adDelta >= 0 ? '+' : ''}{adDelta}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>BREADTH</div>
                <div style={{ color: AMBER, fontSize: 18, fontWeight: 'bold' }}>{((today.advances / (today.advances + today.declines)) * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={el => canvasRefs.current['adFull'] = el} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        )}

        {view === 'McClellan' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', display: 'flex', gap: 16, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>OSCILLATOR</div>
                <div style={{ color: mccVal >= 0 ? GREEN : RED, fontSize: 18, fontWeight: 'bold' }}>{mccVal.toFixed(1)}</div>
                <div style={{ color: DIM, fontSize: 8 }}>{mccVal > 100 ? 'Overbought' : mccVal < -100 ? 'Oversold' : 'Normal'}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>SUMMATION</div>
                <div style={{ color: AMBER, fontSize: 18, fontWeight: 'bold' }}>{indicators.summation[indicators.summation.length - 1].toFixed(0)}</div>
                <div style={{ color: DIM, fontSize: 8 }}>Cumulative</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>SIGNAL</div>
                <div style={{ color: mccVal > 0 ? GREEN : RED, fontSize: 18, fontWeight: 'bold' }}>{mccVal > 100 ? 'STRONG BUY' : mccVal > 0 ? 'BUY' : mccVal > -100 ? 'SELL' : 'STRONG SELL'}</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr 1fr', gap: 1 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ padding: '2px 8px', color: CYAN, fontSize: 9 }}>McClellan Oscillator</div>
                <div style={{ position: 'absolute', top: 18, left: 0, right: 0, bottom: 0 }}>
                  <canvas ref={el => canvasRefs.current['mccFull'] = el} style={{ width: '100%', height: '100%' }} />
                </div>
              </div>
              <div style={{ position: 'relative', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ padding: '2px 8px', color: AMBER, fontSize: 9 }}>McClellan Summation Index</div>
                <div style={{ position: 'absolute', top: 18, left: 0, right: 0, bottom: 0 }}>
                  <canvas ref={el => canvasRefs.current['sumFull'] = el} style={{ width: '100%', height: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'TRIN' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', display: 'flex', gap: 16, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>CURRENT TRIN</div>
                <div style={{ color: trinVal < 1 ? GREEN : RED, fontSize: 24, fontWeight: 'bold' }}>{trinVal.toFixed(3)}</div>
                <div style={{ color: DIM, fontSize: 8 }}>{trinVal < 0.5 ? 'Extreme Bullish' : trinVal < 0.8 ? 'Bullish' : trinVal < 1.2 ? 'Neutral' : trinVal < 2 ? 'Bearish' : 'Extreme Bearish'}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>A/D RATIO</div>
                <div style={{ color: WHITE, fontSize: 18, fontWeight: 'bold' }}>{(today.advances / Math.max(today.declines, 1)).toFixed(3)}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>VOL RATIO</div>
                <div style={{ color: WHITE, fontSize: 18, fontWeight: 'bold' }}>{(today.advVol / Math.max(today.decVol, 1)).toFixed(3)}</div>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={el => canvasRefs.current['trinFull'] = el} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        )}

        {view === 'Breadth Thrust' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', display: 'flex', gap: 16, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>THRUST (10d EMA)</div>
                <div style={{ color: thrustVal > 0.615 ? GREEN : thrustVal < 0.4 ? RED : AMBER, fontSize: 24, fontWeight: 'bold' }}>{(thrustVal * 100).toFixed(1)}%</div>
                <div style={{ color: DIM, fontSize: 8 }}>{thrustVal > 0.615 ? 'THRUST SIGNAL!' : 'No signal'}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>RAW BREADTH</div>
                <div style={{ color: WHITE, fontSize: 18, fontWeight: 'bold' }}>{((today.advances / (today.advances + today.declines)) * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={el => canvasRefs.current['thrustFull'] = el} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        )}

        {view === 'Hi/Lo' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', display: 'flex', gap: 16, borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>NEW HIGHS</div>
                <div style={{ color: GREEN, fontSize: 18, fontWeight: 'bold' }}>{today.newHighs}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>NEW LOWS</div>
                <div style={{ color: RED, fontSize: 18, fontWeight: 'bold' }}>{today.newLows}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>NET</div>
                <div style={{ color: (today.newHighs - today.newLows) >= 0 ? GREEN : RED, fontSize: 18, fontWeight: 'bold' }}>{today.newHighs - today.newLows >= 0 ? '+' : ''}{today.newHighs - today.newLows}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ color: DIM, fontSize: 9 }}>10D MA</div>
                <div style={{ color: AMBER, fontSize: 18, fontWeight: 'bold' }}>{indicators.hiLoMA[indicators.hiLoMA.length - 1].toFixed(0)}</div>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={el => canvasRefs.current['hiloFull'] = el} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>{exchange} | {today.date}</span>
        <span style={{ color: adDelta >= 0 ? GREEN : RED }}>Market Breadth: {adDelta >= 0 ? 'Positive' : 'Negative'}</span>
        <span style={{ color: DIM }}>Total Issues: {(today.advances + today.declines + today.unchanged).toLocaleString()}</span>
      </div>
    </div>
  );
}
