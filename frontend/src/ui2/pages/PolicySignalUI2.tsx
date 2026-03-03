/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Policy / Macro Signal Dashboard (UI2)              │
 * │  Central bank policy, macro indicators, Fed/ECB signals,            │
 * │  yield curve analysis, fiscal policy tracking                       │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

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

/* ── Data Types ──────────────────────────────────────────────────────── */
interface PolicyEvent {
  date: string;
  bank: string;
  event: string;
  actual: string;
  expected: string;
  prior: string;
  impact: 'high' | 'medium' | 'low';
  signal: 'hawkish' | 'dovish' | 'neutral';
}

interface MacroIndicator {
  name: string;
  value: number;
  unit: string;
  change: number;
  trend: 'up' | 'down' | 'flat';
  signal: 'bullish' | 'bearish' | 'neutral';
  lastUpdate: string;
  history: number[];
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generatePolicyEvents(): PolicyEvent[] {
  return [
    { date: '2024-03-20', bank: 'FED', event: 'Federal Funds Rate', actual: '5.50%', expected: '5.50%', prior: '5.50%', impact: 'high', signal: 'hawkish' },
    { date: '2024-03-14', bank: 'ECB', event: 'Main Refinancing Rate', actual: '4.50%', expected: '4.50%', prior: '4.50%', impact: 'high', signal: 'dovish' },
    { date: '2024-03-19', bank: 'BOJ', event: 'Policy Rate', actual: '0.10%', expected: '-0.10%', prior: '-0.10%', impact: 'high', signal: 'hawkish' },
    { date: '2024-03-21', bank: 'BOE', event: 'Bank Rate', actual: '5.25%', expected: '5.25%', prior: '5.25%', impact: 'high', signal: 'neutral' },
    { date: '2024-03-12', bank: 'FED', event: 'CPI YoY', actual: '3.2%', expected: '3.1%', prior: '3.1%', impact: 'high', signal: 'hawkish' },
    { date: '2024-03-08', bank: 'FED', event: 'Non-Farm Payrolls', actual: '275K', expected: '200K', prior: '229K', impact: 'high', signal: 'hawkish' },
    { date: '2024-03-14', bank: 'FED', event: 'PPI MoM', actual: '0.6%', expected: '0.3%', prior: '0.3%', impact: 'medium', signal: 'hawkish' },
    { date: '2024-03-15', bank: 'FED', event: 'Consumer Sentiment', actual: '76.5', expected: '77.1', prior: '76.9', impact: 'medium', signal: 'neutral' },
    { date: '2024-03-07', bank: 'ECB', event: 'GDP QoQ', actual: '0.0%', expected: '0.0%', prior: '-0.1%', impact: 'medium', signal: 'dovish' },
    { date: '2024-03-05', bank: 'FED', event: 'ISM Services PMI', actual: '52.6', expected: '53.0', prior: '53.4', impact: 'medium', signal: 'bearish' },
    { date: '2024-03-01', bank: 'FED', event: 'PCE Core YoY', actual: '2.8%', expected: '2.8%', prior: '2.9%', impact: 'high', signal: 'dovish' },
    { date: '2024-02-27', bank: 'FED', event: 'Durable Goods Orders', actual: '-6.1%', expected: '-4.5%', prior: '0.0%', impact: 'medium', signal: 'dovish' },
  ];
}

function generateMacroIndicators(): MacroIndicator[] {
  const hist = () => Array.from({ length: 24 }, (_, i) => 2 + Math.sin(i * 0.5) * 1.5 + Math.random() * 0.5);
  return [
    { name: 'Fed Funds Rate', value: 5.50, unit: '%', change: 0, trend: 'flat', signal: 'neutral', lastUpdate: '2024-03-20', history: hist() },
    { name: 'US CPI YoY', value: 3.2, unit: '%', change: 0.1, trend: 'up', signal: 'bearish', lastUpdate: '2024-03-12', history: hist() },
    { name: 'US 10Y Yield', value: 4.28, unit: '%', change: -0.05, trend: 'down', signal: 'neutral', lastUpdate: '2024-03-22', history: hist() },
    { name: 'US Unemployment', value: 3.9, unit: '%', change: 0.2, trend: 'up', signal: 'bearish', lastUpdate: '2024-03-08', history: hist() },
    { name: 'ISM Manufacturing', value: 47.8, unit: '', change: -1.3, trend: 'down', signal: 'bearish', lastUpdate: '2024-03-01', history: hist() },
    { name: 'US GDP QoQ', value: 3.2, unit: '%', change: 0.0, trend: 'flat', signal: 'bullish', lastUpdate: '2024-02-28', history: hist() },
    { name: 'PCE Core YoY', value: 2.8, unit: '%', change: -0.1, trend: 'down', signal: 'bullish', lastUpdate: '2024-03-01', history: hist() },
    { name: 'Consumer Confidence', value: 106.7, unit: '', change: 2.1, trend: 'up', signal: 'bullish', lastUpdate: '2024-02-27', history: hist() },
    { name: 'EUR/USD', value: 1.0835, unit: '', change: -0.0012, trend: 'down', signal: 'neutral', lastUpdate: '2024-03-22', history: hist() },
    { name: 'Gold ($/oz)', value: 2185.5, unit: '$', change: 15.2, trend: 'up', signal: 'bullish', lastUpdate: '2024-03-22', history: hist() },
    { name: 'Crude Oil WTI', value: 81.5, unit: '$', change: 1.8, trend: 'up', signal: 'neutral', lastUpdate: '2024-03-22', history: hist() },
    { name: 'VIX', value: 13.2, unit: '', change: -0.8, trend: 'down', signal: 'bullish', lastUpdate: '2024-03-22', history: hist() },
  ];
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function YieldCurveCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 450, H = 200;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const maturities = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];
    const currentYields = [5.48, 5.35, 5.32, 4.95, 4.60, 4.35, 4.18, 4.25, 4.28, 4.55, 4.45];
    const priorYields = [5.50, 5.40, 5.38, 5.05, 4.72, 4.48, 4.30, 4.35, 4.35, 4.60, 4.52];
    const yearAgoYields = [4.65, 4.85, 5.05, 5.00, 4.15, 3.80, 3.55, 3.55, 3.50, 3.85, 3.65];

    const mnY = 3.0; const mxY = 6.0;
    const pad = { l: 35, r: 10, t: 20, b: 30 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;

    // Grid
    ctx.strokeStyle = `${T.border}80`; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 6; i++) {
      const y = pad.t + (i / 6) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${(mxY - i * (mxY - mnY) / 6).toFixed(1)}%`, pad.l - 3, y + 3);
    }

    // X labels
    maturities.forEach((m, i) => {
      const x = pad.l + (i / (maturities.length - 1)) * plotW;
      ctx.fillStyle = T.tx3; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(m, x, H - pad.b + 12);
    });

    // Draw curve
    function drawCurve(yields: number[], color: string, dash: number[] = []) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(dash);
      ctx.beginPath();
      yields.forEach((y, i) => {
        const x = pad.l + (i / (yields.length - 1)) * plotW;
        const py = pad.t + ((mxY - y) / (mxY - mnY)) * plotH;
        i === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py);
      });
      ctx.stroke(); ctx.setLineDash([]);
    }

    drawCurve(yearAgoYields, `${T.tx3}80`, [4, 3]);
    drawCurve(priorYields, `${T.warn}80`, [2, 2]);
    drawCurve(currentYields, T.brand);

    // Legend
    const legends = [
      { label: 'Current', color: T.brand, dash: false },
      { label: '1 Week Ago', color: `${T.warn}80`, dash: true },
      { label: '1 Year Ago', color: `${T.tx3}80`, dash: true },
    ];
    legends.forEach((l, i) => {
      const x = pad.l + 10 + i * 90; const y = 10;
      ctx.strokeStyle = l.color; ctx.lineWidth = 1.5;
      if (l.dash) ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = T.tx2; ctx.font = '7px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(l.label, x + 24, y + 3);
    });
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: T.r }} />;
}

function SparkCanvas({ data, color }: { data: number[]; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 60, H = 20;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    const mn = Math.min(...data); const mx = Math.max(...data);
    const rng = mx - mn || 1;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d - mn) / rng) * (H - 2) - 1;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data, color]);
  return <canvas ref={ref} style={{ width: 60, height: 20 }} />;
}

function FedProbabilities() {
  const meetings = [
    { date: 'May 1', hold: 92, cut25: 8, cut50: 0 },
    { date: 'Jun 12', hold: 48, cut25: 47, cut50: 5 },
    { date: 'Jul 31', hold: 28, cut25: 52, cut50: 18 },
    { date: 'Sep 18', hold: 12, cut25: 38, cut50: 38 },
    { date: 'Nov 7', hold: 5, cut25: 22, cut50: 45 },
    { date: 'Dec 18', hold: 2, cut25: 15, cut50: 42 },
  ];

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Fed Rate Cut Probabilities (CME FedWatch)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Meeting', 'Hold', '-25bps', '-50bps', 'Market Pricing'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, fontWeight: 600, textAlign: h === 'Meeting' ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meetings.map(m => (
            <tr key={m.date} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600 }}>{m.date}</td>
              <td style={{ padding: '3px 4px', color: m.hold > 50 ? T.tx0 : T.tx3, textAlign: 'right' }}>{m.hold}%</td>
              <td style={{ padding: '3px 4px', color: m.cut25 > 30 ? T.up : T.tx3, textAlign: 'right' }}>{m.cut25}%</td>
              <td style={{ padding: '3px 4px', color: m.cut50 > 30 ? T.up : T.tx3, textAlign: 'right' }}>{m.cut50}%</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                <div style={{ display: 'flex', height: 8, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${m.hold}%`, background: T.tx3 }} />
                  <div style={{ width: `${m.cut25}%`, background: T.info }} />
                  <div style={{ width: `${m.cut50}%`, background: T.up }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type PolTab = 'dashboard' | 'calendar' | 'yieldcurve' | 'fedwatch';

export default function PolicySignalUI2() {
  const [tab, setTab] = useState<PolTab>('dashboard');
  const events = useMemo(() => generatePolicyEvents(), []);
  const indicators = useMemo(() => generateMacroIndicators(), []);

  return (
    <div data-testid="policy-signal-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>POLICY & MACRO SIGNALS</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Fed: <span style={{ color: T.warn }}>HAWKISH-HOLD</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>ECB: <span style={{ color: T.up }}>DOVISH-PIVOT</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'dashboard' as PolTab, label: '📊 Dashboard' },
          { key: 'calendar' as PolTab, label: '📅 Calendar' },
          { key: 'yieldcurve' as PolTab, label: '📈 Yield Curve' },
          { key: 'fedwatch' as PolTab, label: '🏛️ Fed Watch' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px', marginBottom: '8px' }}>
              {indicators.map(ind => (
                <div key={ind.name} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ fontSize: '8px', color: T.tx3 }}>{ind.name}</div>
                    <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px',
                      background: ind.signal === 'bullish' ? `${T.up}20` : ind.signal === 'bearish' ? `${T.dn}20` : `${T.tx3}20`,
                      color: ind.signal === 'bullish' ? T.up : ind.signal === 'bearish' ? T.dn : T.tx2 }}>
                      {ind.signal}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: T.tx0, fontFamily: T.mono }}>
                      {ind.unit === '$' ? `$${ind.value.toLocaleString()}` : `${ind.value}${ind.unit}`}
                    </span>
                    <span style={{ fontSize: '8px', color: ind.change > 0 ? T.up : ind.change < 0 ? T.dn : T.tx3, fontWeight: 600, fontFamily: T.mono }}>
                      {ind.change > 0 ? '+' : ''}{ind.change}{ind.unit === '%' ? 'pp' : ''}
                    </span>
                  </div>
                  <div style={{ marginTop: '4px' }}><SparkCanvas data={ind.history} color={ind.signal === 'bullish' ? T.up : ind.signal === 'bearish' ? T.dn : T.info} /></div>
                  <div style={{ fontSize: '7px', color: T.tx3, marginTop: '2px' }}>Updated: {ind.lastUpdate}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'calendar' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Economic Calendar</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                  {['Date', 'Bank', 'Event', 'Actual', 'Expected', 'Prior', 'Impact', 'Signal'].map(h => (
                    <th key={h} style={{ padding: '3px 4px', color: T.tx3, fontWeight: 600, textAlign: h === 'Event' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'center' }}>{e.date}</td>
                    <td style={{ padding: '3px 4px', color: T.brand, fontWeight: 700, textAlign: 'center' }}>{e.bank}</td>
                    <td style={{ padding: '3px 4px', color: T.tx0, textAlign: 'left' }}>{e.event}</td>
                    <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 700, textAlign: 'center' }}>{e.actual}</td>
                    <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'center' }}>{e.expected}</td>
                    <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'center' }}>{e.prior}</td>
                    <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                      <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px',
                        background: e.impact === 'high' ? `${T.dn}20` : `${T.warn}20`,
                        color: e.impact === 'high' ? T.dn : T.warn }}>
                        {e.impact}
                      </span>
                    </td>
                    <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                      <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px',
                        background: e.signal === 'hawkish' ? `${T.dn}20` : e.signal === 'dovish' ? `${T.up}20` : `${T.tx3}20`,
                        color: e.signal === 'hawkish' ? T.dn : e.signal === 'dovish' ? T.up : T.tx2 }}>
                        {e.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'yieldcurve' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>US Treasury Yield Curve</div>
            <YieldCurveCanvas />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {[
                { label: '2s/10s Spread', value: '-32bp', color: T.dn },
                { label: '3M/10Y Spread', value: '-107bp', color: T.dn },
                { label: 'Curve Shape', value: 'INVERTED', color: T.dn },
                { label: 'Recession Signal', value: 'ACTIVE', color: T.warn },
              ].map(s => (
                <div key={s.label} style={{ background: T.bg2, borderRadius: T.r, padding: '6px 10px', flex: '1 1 100px', textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', color: T.tx3 }}>{s.label}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: s.color, fontFamily: T.mono }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'fedwatch' && <FedProbabilities />}
      </div>
    </div>
  );
}

export { PolicySignalUI2 };
