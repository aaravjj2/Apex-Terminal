/**
 * VolatilitySurfaceUI2 — Implied Vol Surface, Skew, Term Structure
 * 3D surface rendering, vol smile per expiry, ATM term structure,
 * Greeks surface, historical vol cone, vol-of-vol.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface VolPoint { strike: number; expiry: number; iv: number; delta: number; gamma: number; vega: number; theta: number }
interface Expiry { label: string; dte: number; atmIV: number }

/* ─── Data Generation ─────────────────────────────────────────────────── */
const SPOT = 185.50;
const EXPIRIES: Expiry[] = [
  { label: '1W', dte: 7, atmIV: 28.5 },
  { label: '2W', dte: 14, atmIV: 26.8 },
  { label: '1M', dte: 30, atmIV: 25.2 },
  { label: '2M', dte: 60, atmIV: 24.5 },
  { label: '3M', dte: 90, atmIV: 23.8 },
  { label: '6M', dte: 180, atmIV: 23.2 },
  { label: '9M', dte: 270, atmIV: 22.8 },
  { label: '1Y', dte: 365, atmIV: 22.5 },
];

const STRIKES = Array.from({ length: 21 }, (_, i) => SPOT * (0.8 + i * 0.02));

function generateSurface(): VolPoint[] {
  const points: VolPoint[] = [];
  EXPIRIES.forEach(exp => {
    STRIKES.forEach(strike => {
      const moneyness = Math.log(strike / SPOT);
      // Vol smile: higher IV for OTM options
      const skew = 0.15 * moneyness * moneyness + 0.08 * moneyness;
      const termAdj = Math.sqrt(30 / exp.dte) * 0.03;
      const iv = exp.atmIV + skew * 100 + termAdj * 100 + (Math.random() - 0.5) * 0.8;
      
      // Greeks
      const d1 = (Math.log(strike / SPOT) + (0.045 + iv * iv / 200) * exp.dte / 365) / (iv / 100 * Math.sqrt(exp.dte / 365));
      const delta = strike < SPOT ? 0.5 + 0.4 * (SPOT - strike) / SPOT : 0.5 - 0.4 * (strike - SPOT) / SPOT;
      const gamma = Math.exp(-d1 * d1 / 2) / (SPOT * iv / 100 * Math.sqrt(exp.dte / 365 * 2 * Math.PI));
      const vega = SPOT * Math.sqrt(exp.dte / 365) * Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI) / 100;
      const theta = -(SPOT * iv / 100 * Math.exp(-d1 * d1 / 2)) / (2 * Math.sqrt(2 * Math.PI * exp.dte / 365)) / 365;

      points.push({ strike, expiry: exp.dte, iv, delta, gamma, vega, theta });
    });
  });
  return points;
}

/* ─── Canvas: Vol Surface 3D ──────────────────────────────────────────── */
function VolSurface3D({ surface, mode }: { surface: VolPoint[]; mode: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const nStrike = STRIKES.length, nExpiry = EXPIRIES.length;
    const pad = { l: 40, r: 30, t: 30, b: 50 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    // Isometric projection parameters
    const angleX = 0.6, angleY = 0.4;
    const scaleX = cw / (nStrike + nExpiry * 0.5);
    const scaleY = ch / 40;

    const project = (si: number, ei: number, val: number) => {
      const x = pad.l + si * scaleX * 0.8 + ei * scaleX * 0.4;
      const baseY = h - pad.b - ei * scaleY * 0.5;
      const y = baseY - val * scaleY * 0.8;
      return { x, y };
    };

    const getValue = (pt: VolPoint) => {
      if (mode === 'IV') return pt.iv;
      if (mode === 'Delta') return Math.abs(pt.delta) * 30;
      if (mode === 'Gamma') return pt.gamma * 5000;
      if (mode === 'Vega') return Math.abs(pt.vega) * 2;
      if (mode === 'Theta') return Math.abs(pt.theta) * 50;
      return pt.iv;
    };

    const colorForVal = (v: number) => {
      const t = Math.min(1, Math.max(0, (v - 18) / 20));
      const r = Math.floor(40 + t * 200);
      const g = Math.floor(166 - t * 120);
      const b = Math.floor(154 - t * 100);
      return `rgb(${r},${g},${b})`;
    };

    // Draw surface as filled quads (back to front)
    for (let ei = nExpiry - 2; ei >= 0; ei--) {
      for (let si = 0; si < nStrike - 1; si++) {
        const idx = (i: number, j: number) => j * nStrike + i;
        const p00 = surface[idx(si, ei)];
        const p10 = surface[idx(si + 1, ei)];
        const p01 = surface[idx(si, ei + 1)];
        const p11 = surface[idx(si + 1, ei + 1)];
        if (!p00 || !p10 || !p01 || !p11) continue;

        const v00 = getValue(p00), v10 = getValue(p10), v01 = getValue(p01), v11 = getValue(p11);
        const avg = (v00 + v10 + v01 + v11) / 4;

        const a = project(si, ei, v00);
        const b2 = project(si + 1, ei, v10);
        const c2 = project(si + 1, ei + 1, v11);
        const d = project(si, ei + 1, v01);

        ctx.fillStyle = colorForVal(avg);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ATM line
    const atmIdx = Math.floor(nStrike / 2);
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let ei = 0; ei < nExpiry; ei++) {
      const pt = surface[ei * nStrike + atmIdx];
      if (!pt) continue;
      const p = project(atmIdx, ei, getValue(pt));
      ei === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes labels
    ctx.fillStyle = MUTED; ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Strike →', w / 2, h - 8);
    ctx.save(); ctx.translate(12, h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${mode} ↑`, 0, 0); ctx.restore();
    ctx.fillText('Expiry ↗', w - 60, h - 25);

    // Legend
    ctx.font = '8px monospace';
    ctx.fillText(`ATM: $${SPOT.toFixed(2)}`, w - 70, 15);
    ctx.fillStyle = AMBER;
    ctx.fillText('— ATM line', w - 70, 25);
  }, [surface, mode]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', borderRadius: 4 }} />;
}

/* ─── Canvas: Vol Smile ───────────────────────────────────────────────── */
function VolSmileChart({ surface, selectedExpiry }: { surface: VolPoint[]; selectedExpiry: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const pad = { l: 40, r: 15, t: 15, b: 30 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    // Get points for selected expiry
    const expiryPoints = surface.filter(p => p.expiry === selectedExpiry);
    if (expiryPoints.length === 0) return;

    const minIV = Math.min(...expiryPoints.map(p => p.iv)) - 1;
    const maxIV = Math.max(...expiryPoints.map(p => p.iv)) + 1;
    const minK = Math.min(...expiryPoints.map(p => p.strike));
    const maxK = Math.max(...expiryPoints.map(p => p.strike));

    const px = (k: number) => pad.l + ((k - minK) / (maxK - minK)) * cw;
    const py = (iv: number) => pad.t + ((maxIV - iv) / (maxIV - minIV)) * ch;

    // Grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ch * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      const iv = maxIV - (maxIV - minIV) * i / 4;
      ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${iv.toFixed(1)}%`, pad.l - 4, y + 3);
    }

    // ATM line
    ctx.strokeStyle = AMBER + '44'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px(SPOT), pad.t); ctx.lineTo(px(SPOT), h - pad.b); ctx.stroke();
    ctx.setLineDash([]);

    // Vol smile curve
    ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
    ctx.beginPath();
    expiryPoints.forEach((p, i) => i === 0 ? ctx.moveTo(px(p.strike), py(p.iv)) : ctx.lineTo(px(p.strike), py(p.iv)));
    ctx.stroke();

    // Points
    expiryPoints.forEach(p => {
      ctx.fillStyle = Math.abs(p.strike - SPOT) < 3 ? GREEN : '#eee';
      ctx.beginPath(); ctx.arc(px(p.strike), py(p.iv), 2.5, 0, Math.PI * 2); ctx.fill();
    });

    // Labels
    ctx.fillStyle = MUTED; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Strike', w / 2, h - 5);
    const expLabel = EXPIRIES.find(e => e.dte === selectedExpiry)?.label || '';
    ctx.fillStyle = AMBER; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${expLabel} Vol Smile`, pad.l, 12);
  }, [surface, selectedExpiry]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: 4 }} />;
}

/* ─── Canvas: Term Structure ──────────────────────────────────────────── */
function TermStructureChart({ surface }: { surface: VolPoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const pad = { l: 40, r: 15, t: 15, b: 35 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    // Get ATM IV for each expiry
    const atmIdx = Math.floor(STRIKES.length / 2);
    const atmPoints = EXPIRIES.map((exp, ei) => ({
      dte: exp.dte,
      iv: surface[ei * STRIKES.length + atmIdx]?.iv ?? exp.atmIV,
      label: exp.label,
    }));

    const minIV = Math.min(...atmPoints.map(p => p.iv)) - 2;
    const maxIV = Math.max(...atmPoints.map(p => p.iv)) + 2;

    const px = (i: number) => pad.l + (i / (atmPoints.length - 1)) * cw;
    const py = (iv: number) => pad.t + ((maxIV - iv) / (maxIV - minIV)) * ch;

    // Grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ch * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      const iv = maxIV - (maxIV - minIV) * i / 4;
      ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${iv.toFixed(1)}%`, pad.l - 4, y + 3);
    }

    // Area fill
    ctx.fillStyle = 'rgba(245,166,35,0.06)';
    ctx.beginPath();
    ctx.moveTo(px(0), h - pad.b);
    atmPoints.forEach((p, i) => ctx.lineTo(px(i), py(p.iv)));
    ctx.lineTo(px(atmPoints.length - 1), h - pad.b);
    ctx.closePath(); ctx.fill();

    // Line
    ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
    ctx.beginPath();
    atmPoints.forEach((p, i) => i === 0 ? ctx.moveTo(px(i), py(p.iv)) : ctx.lineTo(px(i), py(p.iv)));
    ctx.stroke();

    // Points + labels
    atmPoints.forEach((p, i) => {
      ctx.fillStyle = GREEN;
      ctx.beginPath(); ctx.arc(px(i), py(p.iv), 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = MUTED; ctx.font = '8px monospace'; ctx.textAlign = 'center';
      ctx.fillText(p.label, px(i), h - pad.b + 14);
      ctx.fillStyle = '#ccc'; ctx.fillText(`${p.iv.toFixed(1)}%`, px(i), py(p.iv) - 8);
    });

    ctx.fillStyle = AMBER; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
    ctx.fillText('ATM Term Structure', pad.l, 12);
  }, [surface]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: 4 }} />;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['3D SURFACE', 'VOL SMILE', 'TERM STRUCTURE', 'GREEKS'] as const;
type Tab = typeof TABS[number];

export default function VolatilitySurfaceUI2() {
  const [tab, setTab] = useState<Tab>('3D SURFACE');
  const [surfaceMode, setSurfaceMode] = useState<string>('IV');
  const [selectedExpiry, setSelectedExpiry] = useState(EXPIRIES[2].dte); // 1M
  const [symbol] = useState('AAPL');

  const surface = useMemo(() => generateSurface(), []);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  // Stats
  const atmIV = surface.find(p => Math.abs(p.strike - SPOT) < 2 && p.expiry === 30)?.iv ?? 25;
  const skew25d = (surface.find(p => p.delta < -0.2 && p.delta > -0.3 && p.expiry === 30)?.iv ?? 28) -
                  (surface.find(p => p.delta > 0.2 && p.delta < 0.3 && p.expiry === 30)?.iv ?? 23);

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>🌊 VOLATILITY SURFACE</span>
          <span style={{ color: '#eee', fontWeight: 700, fontSize: 16 }}>{symbol}</span>
          <span style={{ color: MUTED }}>Spot: ${SPOT.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { l: 'ATM IV (30d)', v: `${atmIV.toFixed(1)}%`, c: AMBER },
            { l: '25Δ Skew', v: `${skew25d.toFixed(1)}%`, c: skew25d > 5 ? RED : GREEN },
            { l: 'HV 30d', v: '22.1%', c: '#eee' },
            { l: 'IV Rank', v: '62', c: AMBER },
            { l: 'IV Pctl', v: '58%', c: '#eee' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ color: MUTED, fontSize: 9 }}>{s.l}</div>
              <div style={{ color: s.c, fontWeight: 700, fontSize: 12 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            color: tab === t ? AMBER : MUTED, fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? `2px solid ${AMBER}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 11, letterSpacing: 0.5
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === '3D SURFACE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              {['IV', 'Delta', 'Gamma', 'Vega', 'Theta'].map(m => (
                <button key={m} onClick={() => setSurfaceMode(m)} style={{
                  padding: '4px 12px', borderRadius: 4,
                  background: surfaceMode === m ? 'rgba(245,166,35,0.15)' : '#0a0a0a',
                  border: `1px solid ${surfaceMode === m ? AMBER : BORDER}`,
                  color: surfaceMode === m ? AMBER : MUTED, cursor: 'pointer', fontSize: 10,
                }}>{m}</button>
              ))}
            </div>
            <div style={{ ...panelStyle, flex: 1 }}>
              <VolSurface3D surface={surface} mode={surfaceMode} />
            </div>
          </div>
        )}

        {tab === 'VOL SMILE' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EXPIRIES.filter((_, i) => i % 2 === 0).map(exp => (
                <div key={exp.dte} style={panelStyle}>
                  <VolSmileChart surface={surface} selectedExpiry={exp.dte} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>EXPIRY</span>
                {EXPIRIES.map(exp => (
                  <div key={exp.dte} onClick={() => setSelectedExpiry(exp.dte)} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 4,
                    cursor: 'pointer', marginTop: 4,
                    background: selectedExpiry === exp.dte ? 'rgba(245,166,35,0.1)' : 'transparent',
                    border: `1px solid ${selectedExpiry === exp.dte ? AMBER : 'transparent'}`,
                  }}>
                    <span style={{ fontWeight: 600 }}>{exp.label}</span>
                    <span style={{ color: MUTED }}>{exp.dte}d</span>
                    <span style={{ color: AMBER }}>{exp.atmIV.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>SKEW METRICS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {[
                    { l: '25Δ Put-Call Skew', v: `${skew25d.toFixed(1)}%` },
                    { l: '10Δ Put IV', v: '32.4%' },
                    { l: '25Δ Put IV', v: '28.1%' },
                    { l: 'ATM IV', v: `${atmIV.toFixed(1)}%` },
                    { l: '25Δ Call IV', v: '23.2%' },
                    { l: '10Δ Call IV', v: '21.8%' },
                    { l: 'Put/Call IV Ratio', v: '1.21' },
                  ].map(s => (
                    <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: MUTED }}>{s.l}</span>
                      <span style={{ fontWeight: 600 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'TERM STRUCTURE' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <TermStructureChart surface={surface} />
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>HISTORICAL VOL CONE</span>
              <div style={{ marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Window', 'Current', 'Min', 'P25', 'Median', 'P75', 'Max'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { w: '10d', cur: 28.5, min: 12.1, p25: 18.2, med: 22.5, p75: 28.0, max: 52.3 },
                      { w: '20d', cur: 25.2, min: 10.8, p25: 16.5, med: 21.2, p75: 26.5, max: 48.1 },
                      { w: '30d', cur: 23.8, min: 10.2, p25: 15.8, med: 20.5, p75: 25.2, max: 45.6 },
                      { w: '60d', cur: 22.1, min: 9.5, p25: 14.8, med: 19.2, p75: 23.8, max: 42.3 },
                      { w: '90d', cur: 21.5, min: 9.2, p25: 14.2, med: 18.8, p75: 23.1, max: 40.5 },
                      { w: '180d', cur: 20.8, min: 8.8, p25: 13.5, med: 18.0, p75: 22.5, max: 38.2 },
                      { w: '252d', cur: 20.2, min: 8.5, p25: 13.0, med: 17.5, p75: 22.0, max: 36.5 },
                    ].map(row => {
                      const pctl = ((row.cur - row.min) / (row.max - row.min) * 100);
                      return (
                        <tr key={row.w} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600 }}>{row.w}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', color: pctl > 70 ? RED : pctl > 30 ? AMBER : GREEN, fontWeight: 700 }}>{row.cur.toFixed(1)}%</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>{row.min.toFixed(1)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>{row.p25.toFixed(1)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>{row.med.toFixed(1)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>{row.p75.toFixed(1)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', color: MUTED }}>{row.max.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>IV vs HV ANALYSIS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {[
                  { l: 'IV 30d', v: `${atmIV.toFixed(1)}%`, bar: atmIV },
                  { l: 'HV 30d', v: '22.1%', bar: 22.1 },
                  { l: 'IV Premium', v: `${(atmIV - 22.1).toFixed(1)}%`, bar: atmIV - 22.1 },
                  { l: 'IV Rank (52w)', v: '62', bar: 62 * 0.4 },
                  { l: 'IV Percentile', v: '58%', bar: 58 * 0.4 },
                ].map(s => (
                  <div key={s.l}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                      <span style={{ color: MUTED }}>{s.l}</span>
                      <span style={{ fontWeight: 600 }}>{s.v}</span>
                    </div>
                    <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                      <div style={{ width: `${Math.min(100, s.bar * 2.5)}%`, height: '100%', background: AMBER, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>VOLATILITY OF VOLATILITY</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, fontSize: 11 }}>
                {[
                  { l: 'VoV (10d)', v: '4.2%' },
                  { l: 'VoV (30d)', v: '3.8%' },
                  { l: 'Realized Vol of Vol', v: '12.5%' },
                  { l: 'Vol Regime', v: 'Normal', c: GREEN },
                  { l: 'Mean Reversion Z', v: '-0.3σ' },
                  { l: 'Vol Term Spread', v: `${(EXPIRIES[EXPIRIES.length - 1].atmIV - EXPIRIES[0].atmIV).toFixed(1)}%`, c: EXPIRIES[0].atmIV > EXPIRIES[EXPIRIES.length - 1].atmIV ? RED : GREEN },
                  { l: 'Structure', v: EXPIRIES[0].atmIV > EXPIRIES[EXPIRIES.length - 1].atmIV ? 'Backwardation' : 'Contango' },
                ].map(s => (
                  <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: MUTED }}>{s.l}</span>
                    <span style={{ fontWeight: 600, color: (s as any).c || '#eee' }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'GREEKS' && (
          <div style={panelStyle}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>GREEKS TABLE — </span>
              <select value={selectedExpiry} onChange={e => setSelectedExpiry(Number(e.target.value))}
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '2px 8px', fontSize: 11 }}>
                {EXPIRIES.map(e => <option key={e.dte} value={e.dte}>{e.label} ({e.dte}d)</option>)}
              </select>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Strike', 'IV', 'Delta', 'Gamma', 'Theta', 'Vega', 'Rho', 'OI', 'Volume', 'Bid IV', 'Ask IV'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'right', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {surface.filter(p => p.expiry === selectedExpiry).map(p => {
                    const isATM = Math.abs(p.strike - SPOT) < 3;
                    return (
                      <tr key={p.strike} style={{
                        borderBottom: `1px solid ${BORDER}22`,
                        background: isATM ? 'rgba(245,166,35,0.05)' : 'transparent',
                      }}>
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: isATM ? 700 : 400, color: isATM ? AMBER : '#eee' }}>${p.strike.toFixed(2)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: p.iv > 30 ? RED : p.iv < 20 ? GREEN : '#eee' }}>{p.iv.toFixed(1)}%</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{p.delta.toFixed(3)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{p.gamma.toFixed(4)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: RED }}>{p.theta.toFixed(3)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: GREEN }}>{p.vega.toFixed(2)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: MUTED }}>{(p.delta * 0.02).toFixed(3)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: MUTED }}>{Math.floor(500 + Math.random() * 5000)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: MUTED }}>{Math.floor(50 + Math.random() * 500)}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: MUTED }}>{(p.iv - 0.3).toFixed(1)}%</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: MUTED }}>{(p.iv + 0.3).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
