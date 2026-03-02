/**
 * CorrelationMatrixUI2 — Cross-Asset Correlation Analysis
 * Real-time correlation heatmap, rolling correlations, PCA,
 * regime detection, factor decomposition.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

const ASSETS = [
  { sym: 'SPY', name: 'S&P 500', class: 'Equity' },
  { sym: 'QQQ', name: 'Nasdaq', class: 'Equity' },
  { sym: 'IWM', name: 'Russell 2K', class: 'Equity' },
  { sym: 'EFA', name: 'EAFE', class: 'Intl Equity' },
  { sym: 'EEM', name: 'Emerging', class: 'Intl Equity' },
  { sym: 'TLT', name: 'Long Bond', class: 'Fixed Income' },
  { sym: 'IEF', name: '7-10Y Tsy', class: 'Fixed Income' },
  { sym: 'HYG', name: 'High Yield', class: 'Fixed Income' },
  { sym: 'LQD', name: 'IG Corp', class: 'Fixed Income' },
  { sym: 'GLD', name: 'Gold', class: 'Commodity' },
  { sym: 'SLV', name: 'Silver', class: 'Commodity' },
  { sym: 'USO', name: 'Oil', class: 'Commodity' },
  { sym: 'DBA', name: 'Agriculture', class: 'Commodity' },
  { sym: 'VNQ', name: 'REITs', class: 'Real Estate' },
  { sym: 'UUP', name: 'US Dollar', class: 'Currency' },
  { sym: 'FXE', name: 'Euro', class: 'Currency' },
  { sym: 'FXY', name: 'Yen', class: 'Currency' },
  { sym: 'BTC-USD', name: 'Bitcoin', class: 'Crypto' },
  { sym: 'ETH-USD', name: 'Ethereum', class: 'Crypto' },
  { sym: 'VIX', name: 'VIX', class: 'Volatility' },
];

/* ─── Generate correlation matrix ────────────────────────────────────── */
function genCorrelationMatrix(): number[][] {
  let s = 31;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const n = ASSETS.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      let corr: number;
      const a = ASSETS[i], b = ASSETS[j];
      // Same class → strong positive
      if (a.class === b.class) {
        corr = 0.5 + rng() * 0.45;
      }
      // Equity vs Bonds → negative
      else if ((a.class === 'Equity' && b.class === 'Fixed Income') || (a.class === 'Fixed Income' && b.class === 'Equity')) {
        corr = -0.5 + rng() * 0.6;
      }
      // VIX vs Equity → strong negative
      else if ((a.sym === 'VIX' && b.class === 'Equity') || (a.class === 'Equity' && b.sym === 'VIX')) {
        corr = -0.6 - rng() * 0.3;
      }
      // Crypto vs Equity → mild positive
      else if ((a.class === 'Crypto' && b.class === 'Equity') || (a.class === 'Equity' && b.class === 'Crypto')) {
        corr = 0.1 + rng() * 0.4;
      }
      // Dollar vs everything else → mild negative
      else if (a.sym === 'UUP' || b.sym === 'UUP') {
        corr = -0.3 + rng() * 0.4;
      }
      else {
        corr = -0.3 + rng() * 0.6;
      }
      corr = Math.max(-1, Math.min(1, corr));
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }
  return matrix;
}

/* ─── Generate rolling correlations ──────────────────────────────────── */
function genRollingCorr(pair: [number, number]): { date: string; corr: number }[] {
  let s = pair[0] * 100 + pair[1];
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const baseCorr = -0.3 + rng() * 0.6;
  const points: { date: string; corr: number }[] = [];
  let corr = baseCorr;
  for (let i = 0; i < 252; i++) {
    corr += (rng() - 0.5) * 0.04;
    corr = corr * 0.985 + baseCorr * 0.015;
    corr = Math.max(-1, Math.min(1, corr));
    const d = new Date(2024, 0, 1);
    d.setDate(d.getDate() + i);
    points.push({ date: d.toISOString().split('T')[0], corr });
  }
  return points;
}

/* ─── Canvas: Heatmap ────────────────────────────────────────────────── */
function HeatmapCanvas({ matrix, selected, onSelect }: {
  matrix: number[][]; selected: [number, number] | null;
  onSelect: (pair: [number, number]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  const corrColor = (v: number) => {
    if (v >= 0) {
      const t = Math.min(1, v);
      return `rgb(${Math.round(38 + (255 - 38) * (1 - t))}, ${Math.round(166 + (255 - 166) * (1 - t))}, ${Math.round(154 + (255 - 154) * (1 - t))})`;
    }
    const t = Math.min(1, -v);
    return `rgb(${Math.round(239)}, ${Math.round(83 + (255 - 83) * (1 - t))}, ${Math.round(80 + (255 - 80) * (1 - t))})`;
  };

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const n = matrix.length;
    const margin = 50;
    const cellW = (w - margin) / n;
    const cellH = (h - margin) / n;

    // Labels
    ctx.textAlign = 'right'; ctx.font = '7px monospace';
    ASSETS.forEach((a, i) => {
      ctx.fillStyle = selected && (selected[0] === i || selected[1] === i) ? AMBER : MUTED;
      ctx.fillText(a.sym, margin - 3, margin + i * cellH + cellH / 2 + 3);
    });
    ctx.save(); ctx.textAlign = 'left';
    ASSETS.forEach((a, i) => {
      ctx.save();
      ctx.translate(margin + i * cellW + cellW / 2, margin - 3);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = selected && (selected[0] === i || selected[1] === i) ? AMBER : MUTED;
      ctx.fillText(a.sym, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // Cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = margin + j * cellW;
        const y = margin + i * cellH;
        const v = matrix[i][j];
        const intensity = Math.abs(v);

        ctx.fillStyle = i === j ? '#1a1a1a' : corrColor(v);
        ctx.globalAlpha = i === j ? 1 : 0.15 + intensity * 0.7;
        ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
        ctx.globalAlpha = 1;

        if (selected && selected[0] === i && selected[1] === j) {
          ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellW, cellH);
        }

        // Value text for reasonable cell sizes
        if (cellW > 18 && i !== j) {
          ctx.fillStyle = intensity > 0.5 ? '#000' : '#ccc';
          ctx.font = `${Math.min(7, cellW / 4)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(v.toFixed(2), x + cellW / 2, y + cellH / 2 + 2);
        }
      }
    }
  }, [matrix, selected]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = ref.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const n = matrix.length;
    const margin = 50;
    const cellW = (rect.width - margin) / n;
    const cellH = (rect.height - margin) / n;
    const j = Math.floor((e.clientX - rect.left - margin) / cellW);
    const i = Math.floor((e.clientY - rect.top - margin) / cellH);
    if (i >= 0 && i < n && j >= 0 && j < n && i !== j) onSelect([i, j]);
  };

  return <canvas ref={ref} onClick={handleClick} style={{ width: '100%', height: 500, borderRadius: 4, cursor: 'crosshair' }} />;
}

/* ─── Canvas: Rolling Correlation ────────────────────────────────────── */
function RollingCorrChart({ data }: { data: { date: string; corr: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const pad = { l: 35, r: 10, t: 10, b: 20 };
    const px = (i: number) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
    const py = (v: number) => pad.t + ((1 - v) / 2) * (h - pad.t - pad.b);

    // Grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
    [-1, -0.5, 0, 0.5, 1].forEach(v => {
      ctx.beginPath(); ctx.moveTo(pad.l, py(v)); ctx.lineTo(w - pad.r, py(v)); ctx.stroke();
      ctx.fillStyle = MUTED; ctx.font = '7px monospace'; ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(1), pad.l - 3, py(v) + 3);
    });

    // Zero line
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(pad.l, py(0)); ctx.lineTo(w - pad.r, py(0)); ctx.stroke();

    // Area
    ctx.beginPath(); ctx.moveTo(px(0), py(0));
    data.forEach((d, i) => ctx.lineTo(px(i), py(d.corr)));
    ctx.lineTo(px(data.length - 1), py(0)); ctx.closePath();
    const avgCorr = data.reduce((s2, d) => s2 + d.corr, 0) / data.length;
    ctx.fillStyle = avgCorr >= 0 ? 'rgba(38,166,154,0.06)' : 'rgba(239,83,80,0.06)'; ctx.fill();

    // Line
    ctx.strokeStyle = avgCorr >= 0 ? GREEN : RED; ctx.lineWidth = 1.2;
    ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(px(i), py(d.corr)) : ctx.lineTo(px(i), py(d.corr)));
    ctx.stroke();

    // Current value
    const last = data[data.length - 1];
    ctx.fillStyle = last.corr >= 0 ? GREEN : RED;
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${last.corr >= 0 ? '+' : ''}${last.corr.toFixed(3)}`, w - pad.r, py(last.corr) - 6);
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 180, borderRadius: 4 }} />;
}

const TABS = ['HEATMAP', 'ROLLING', 'PCA', 'REGIME'] as const;
type Tab = typeof TABS[number];

export default function CorrelationMatrixUI2() {
  const [tab, setTab] = useState<Tab>('HEATMAP');
  const [matrix] = useState(() => genCorrelationMatrix());
  const [selected, setSelected] = useState<[number, number] | null>([0, 5]);
  const [window, setWindow] = useState(60);
  const [filterClass, setFilterClass] = useState('All');

  const rollingData = useMemo(() => {
    if (!selected) return [];
    return genRollingCorr(selected);
  }, [selected]);

  // PCA mock
  const pcaComponents = useMemo(() => {
    let s2 = 99;
    const rng = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
    return Array.from({ length: 5 }, (_, i) => ({
      pc: i + 1,
      variance: (40 - i * 8) * (1 + rng() * 0.2),
      cumVar: 0,
      topLoadings: ASSETS.slice(0, 5).map(a => ({ sym: a.sym, loading: (rng() - 0.3) * 0.6 })).sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading)),
    })).map((p, i, arr) => {
      p.cumVar = arr.slice(0, i + 1).reduce((s3, pc) => s3 + pc.variance, 0);
      return p;
    });
  }, []);

  const classes = useMemo(() => [...new Set(ASSETS.map(a => a.class))], []);

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>📊 CORRELATION MATRIX</span>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '3px 8px', fontSize: 10 }}>
            <option>All</option>{classes.map(cl => <option key={cl}>{cl}</option>)}
          </select>
          <select value={window} onChange={e => setWindow(+e.target.value)}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: MUTED, padding: '3px 8px', fontSize: 10 }}>
            <option value={20}>20D</option><option value={60}>60D</option><option value={120}>120D</option><option value={252}>252D</option>
          </select>
        </div>
        {selected && (
          <div style={{ fontSize: 10, color: MUTED }}>
            <span style={{ color: AMBER, fontWeight: 700 }}>{ASSETS[selected[0]].sym}</span>
            {' × '}
            <span style={{ color: AMBER, fontWeight: 700 }}>{ASSETS[selected[1]].sym}</span>
            {' = '}
            <span style={{ color: matrix[selected[0]][selected[1]] >= 0 ? GREEN : RED, fontWeight: 700, fontSize: 12 }}>
              {matrix[selected[0]][selected[1]].toFixed(3)}
            </span>
          </div>
        )}
      </div>

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
        {tab === 'HEATMAP' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
            <div style={panelStyle}>
              <HeatmapCanvas matrix={matrix} selected={selected} onSelect={setSelected} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>MOST CORRELATED</span>
                {(() => {
                  const pairs: { i: number; j: number; corr: number }[] = [];
                  for (let i = 0; i < matrix.length; i++)
                    for (let j = i + 1; j < matrix.length; j++)
                      pairs.push({ i, j, corr: matrix[i][j] });
                  return pairs.sort((a, b) => b.corr - a.corr).slice(0, 8).map(p => (
                    <div key={`${p.i}-${p.j}`} onClick={() => setSelected([p.i, p.j])} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10, cursor: 'pointer',
                      borderBottom: `1px solid ${BORDER}22`,
                    }}>
                      <span>{ASSETS[p.i].sym} × {ASSETS[p.j].sym}</span>
                      <span style={{ color: GREEN, fontWeight: 600 }}>+{p.corr.toFixed(3)}</span>
                    </div>
                  ));
                })()}
              </div>
              <div style={panelStyle}>
                <span style={{ color: RED, fontWeight: 600, fontSize: 11 }}>MOST ANTI-CORRELATED</span>
                {(() => {
                  const pairs: { i: number; j: number; corr: number }[] = [];
                  for (let i = 0; i < matrix.length; i++)
                    for (let j = i + 1; j < matrix.length; j++)
                      pairs.push({ i, j, corr: matrix[i][j] });
                  return pairs.sort((a, b) => a.corr - b.corr).slice(0, 8).map(p => (
                    <div key={`${p.i}-${p.j}`} onClick={() => setSelected([p.i, p.j])} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10, cursor: 'pointer',
                      borderBottom: `1px solid ${BORDER}22`,
                    }}>
                      <span>{ASSETS[p.i].sym} × {ASSETS[p.j].sym}</span>
                      <span style={{ color: RED, fontWeight: 600 }}>{p.corr.toFixed(3)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {tab === 'ROLLING' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>
                  ROLLING {window}D: {selected ? `${ASSETS[selected[0]].sym} × ${ASSETS[selected[1]].sym}` : 'Select pair'}
                </span>
              </div>
              {rollingData.length > 0 && <RollingCorrChart data={rollingData} />}
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { l: 'Current', v: rollingData[rollingData.length - 1]?.corr.toFixed(3) || '-' },
                  { l: 'Average', v: (rollingData.reduce((s2, d) => s2 + d.corr, 0) / (rollingData.length || 1)).toFixed(3) },
                  { l: 'Std Dev', v: (() => {
                    const avg = rollingData.reduce((s2, d) => s2 + d.corr, 0) / (rollingData.length || 1);
                    return Math.sqrt(rollingData.reduce((s2, d) => s2 + (d.corr - avg) ** 2, 0) / (rollingData.length || 1)).toFixed(3);
                  })() },
                ].map(m => (
                  <div key={m.l} style={{ textAlign: 'center', padding: 6, background: '#0a0a0a', borderRadius: 4 }}>
                    <div style={{ fontSize: 8, color: MUTED }}>{m.l}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>SELECT PAIR</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                {ASSETS.map((a, i) => (
                  <button key={a.sym} onClick={() => selected && setSelected([selected[0] === i ? selected[1] : i, selected[0] === i ? selected[1] : selected[0]])}
                    style={{
                      padding: '4px 6px', borderRadius: 3, fontSize: 9, cursor: 'pointer',
                      background: selected && (selected[0] === i || selected[1] === i) ? `${AMBER}22` : '#0a0a0a',
                      color: selected && (selected[0] === i || selected[1] === i) ? AMBER : MUTED,
                      border: `1px solid ${selected && (selected[0] === i || selected[1] === i) ? AMBER + '44' : BORDER}`,
                    }}>{a.sym}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'PCA' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>PRINCIPAL COMPONENTS</span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['PC', 'Var %', 'Cum %', 'Interpretation'].map(h => (
                      <th key={h} style={{ padding: '5px 6px', textAlign: 'left', color: MUTED, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pcaComponents.map(pc => (
                    <tr key={pc.pc} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                      <td style={{ padding: '5px 6px', fontWeight: 700, color: AMBER }}>PC{pc.pc}</td>
                      <td style={{ padding: '5px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 50, height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                            <div style={{ width: `${pc.variance}%`, height: '100%', background: AMBER, borderRadius: 3 }} />
                          </div>
                          {pc.variance.toFixed(1)}%
                        </div>
                      </td>
                      <td style={{ padding: '5px 6px', fontWeight: 600 }}>{pc.cumVar.toFixed(1)}%</td>
                      <td style={{ padding: '5px 6px', color: MUTED, fontSize: 9 }}>
                        {pc.pc === 1 ? 'Market Risk' : pc.pc === 2 ? 'Rate Sensitivity' : pc.pc === 3 ? 'Credit Spread' : pc.pc === 4 ? 'Commodity Risk' : 'Crypto/Alt'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>FACTOR LOADINGS</span>
              {pcaComponents.slice(0, 3).map(pc => (
                <div key={pc.pc} style={{ marginTop: 8 }}>
                  <span style={{ color: AMBER, fontSize: 9, fontWeight: 600 }}>PC{pc.pc} — {pc.variance.toFixed(1)}% Variance</span>
                  {pc.topLoadings.map(l => (
                    <div key={l.sym} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 10 }}>
                      <span style={{ width: 50, fontWeight: 600 }}>{l.sym}</span>
                      <div style={{ flex: 1, height: 6, position: 'relative', background: '#1a1a1a', borderRadius: 3 }}>
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#333' }} />
                        <div style={{
                          position: 'absolute',
                          [l.loading >= 0 ? 'left' : 'right']: '50%',
                          width: `${Math.abs(l.loading) * 100}%`, height: '100%', borderRadius: 3,
                          background: l.loading >= 0 ? GREEN : RED,
                        }} />
                      </div>
                      <span style={{ width: 40, textAlign: 'right', color: l.loading >= 0 ? GREEN : RED, fontWeight: 600 }}>
                        {l.loading >= 0 ? '+' : ''}{l.loading.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'REGIME' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>CORRELATION REGIME</span>
              {[
                { regime: 'Risk-On', prob: 35, desc: 'High equity-bond divergence, tight credit', color: GREEN },
                { regime: 'Risk-Off', prob: 20, desc: 'Flight to safety, correlations spike', color: RED },
                { regime: 'Normal', prob: 30, desc: 'Typical diversification, moderate correlations', color: AMBER },
                { regime: 'Crisis', prob: 8, desc: 'All correlations → 1, diversification fails', color: '#e74c3c' },
                { regime: 'Reflation', prob: 7, desc: 'Equity+commodity up, bond down', color: '#9b59b6' },
              ].map(r => (
                <div key={r.regime} style={{ padding: '6px 0', borderBottom: `1px solid ${BORDER}22` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: r.color }}>{r.regime}</span>
                    <span style={{ fontWeight: 700, color: '#eee' }}>{r.prob}%</span>
                  </div>
                  <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, marginBottom: 3 }}>
                    <div style={{ width: `${r.prob}%`, height: '100%', background: r.color, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 9, color: MUTED }}>{r.desc}</div>
                </div>
              ))}
            </div>
            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>CORRELATION DISPERSION</span>
              {(() => {
                const allCorrs: number[] = [];
                for (let i = 0; i < matrix.length; i++)
                  for (let j = i + 1; j < matrix.length; j++)
                    allCorrs.push(matrix[i][j]);
                const avg = allCorrs.reduce((s2, c) => s2 + c, 0) / allCorrs.length;
                const std = Math.sqrt(allCorrs.reduce((s2, c) => s2 + (c - avg) ** 2, 0) / allCorrs.length);
                const median = allCorrs.sort((a, b) => a - b)[Math.floor(allCorrs.length / 2)];
                return [
                  { l: 'Pairs Analyzed', v: allCorrs.length },
                  { l: 'Mean Correlation', v: avg.toFixed(3) },
                  { l: 'Median', v: median.toFixed(3) },
                  { l: 'Std Deviation', v: std.toFixed(3) },
                  { l: 'Max Positive', v: Math.max(...allCorrs).toFixed(3), c: GREEN },
                  { l: 'Max Negative', v: Math.min(...allCorrs).toFixed(3), c: RED },
                  { l: 'Positive Pairs', v: `${allCorrs.filter(c => c > 0).length} (${(allCorrs.filter(c => c > 0).length / allCorrs.length * 100).toFixed(0)}%)`, c: GREEN },
                  { l: 'Negative Pairs', v: `${allCorrs.filter(c => c < 0).length} (${(allCorrs.filter(c => c < 0).length / allCorrs.length * 100).toFixed(0)}%)`, c: RED },
                ].map(m => (
                  <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}22`, fontSize: 10 }}>
                    <span style={{ color: MUTED }}>{m.l}</span>
                    <span style={{ color: (m as any).c || '#eee', fontWeight: 600 }}>{m.v}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
