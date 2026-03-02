import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Bloomberg Theme ──
const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', CYAN = '#00bcd4';
const DIM = '#555', TEXT = '#ccc', WHITE = '#e0e0e0';

// ── Tenors ──
const TENORS = ['1M','2M','3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];
const TENOR_X: Record<string,number> = {'1M':0.083,'2M':0.167,'3M':0.25,'6M':0.5,'1Y':1,'2Y':2,'3Y':3,'5Y':5,'7Y':7,'10Y':10,'20Y':20,'30Y':30};

// ── Curve Data ──
interface CurvePoint { tenor: string; yield: number; change: number; }

function generateCurve(base: number, steepness: number, hump: number): CurvePoint[] {
  return TENORS.map(t => {
    const x = TENOR_X[t];
    const y = base + steepness * Math.log(1 + x) + hump * x * Math.exp(-0.3 * x) + (Math.random() - 0.5) * 0.05;
    return { tenor: t, yield: Math.round(y * 1000) / 1000, change: Math.round((Math.random() - 0.4) * 10) / 100 };
  });
}

const CURVES_CONFIG = [
  { id: 'ust', name: 'US Treasury', color: AMBER, base: 4.35, steepness: 0.5, hump: 0.2 },
  { id: 'swap', name: 'USD Swap', color: CYAN, base: 4.55, steepness: 0.45, hump: 0.15 },
  { id: 'corp_ig', name: 'Corp IG (A)', color: GREEN, base: 4.85, steepness: 0.55, hump: 0.25 },
  { id: 'corp_hy', name: 'Corp HY (BB)', color: RED, base: 6.2, steepness: 0.6, hump: 0.3 },
  { id: 'tips', name: 'TIPS (Real)', color: '#9c27b0', base: 1.8, steepness: 0.3, hump: 0.1 },
  { id: 'muni', name: 'Muni AAA', color: '#ff9800', base: 3.1, steepness: 0.35, hump: 0.12 },
];

function generateAllCurves() {
  const map: Record<string, CurvePoint[]> = {};
  CURVES_CONFIG.forEach(c => { map[c.id] = generateCurve(c.base, c.steepness, c.hump); });
  return map;
}

// ── Nelson-Siegel Model ──
interface NSParams { beta0: number; beta1: number; beta2: number; lambda: number; }

function nelsonSiegel(t: number, p: NSParams): number {
  const lt = p.lambda * t;
  const explt = Math.exp(-lt);
  const factor = lt > 0.001 ? (1 - explt) / lt : 1;
  return p.beta0 + p.beta1 * factor + p.beta2 * (factor - explt);
}

function fitNelsonSiegel(curve: CurvePoint[]): NSParams {
  // Simple calibration: b0=long, b1=short-long, b2=hump
  const shortY = curve[0].yield;
  const longY = curve[curve.length - 1].yield;
  const midY = curve[Math.floor(curve.length / 2)].yield;
  return {
    beta0: longY,
    beta1: shortY - longY,
    beta2: 2 * (midY - (shortY + longY) / 2),
    lambda: 0.6
  };
}

// ── Forward Rates ──
function computeForwards(curve: CurvePoint[]): { tenor: string; forward: number }[] {
  const fwds: { tenor: string; forward: number }[] = [];
  for (let i = 1; i < curve.length; i++) {
    const t1 = TENOR_X[curve[i - 1].tenor], t2 = TENOR_X[curve[i].tenor];
    const y1 = curve[i - 1].yield / 100, y2 = curve[i].yield / 100;
    const dt = t2 - t1;
    const fwd = dt > 0 ? ((y2 * t2 - y1 * t1) / dt) * 100 : y2 * 100;
    fwds.push({ tenor: `${curve[i - 1].tenor}-${curve[i].tenor}`, forward: Math.round(fwd * 1000) / 1000 });
  }
  return fwds;
}

// ── Historical Dates ──
const HIST_DATES = ['Today', '1W Ago', '1M Ago', '3M Ago', '6M Ago', '1Y Ago'];
function generateHistCurves(): Record<string, CurvePoint[]> {
  const map: Record<string, CurvePoint[]> = {};
  const offsets = [0, -0.1, -0.25, -0.5, -0.3, -0.8];
  HIST_DATES.forEach((d, i) => {
    map[d] = generateCurve(4.35 + offsets[i], 0.5 + offsets[i] * 0.1, 0.2 + offsets[i] * 0.05);
  });
  return map;
}

// ── Spread Analysis ──
interface SpreadData { tenor: string; spread: number; zSpread: number; oas: number; }

function computeSpreads(curve1: CurvePoint[], curve2: CurvePoint[]): SpreadData[] {
  return TENORS.map((t, i) => {
    const s = (curve1[i]?.yield || 0) - (curve2[i]?.yield || 0);
    return {
      tenor: t,
      spread: Math.round(s * 100),  // bps
      zSpread: Math.round(s * 100 + (Math.random() - 0.5) * 5),
      oas: Math.round(s * 100 - 3 + (Math.random() - 0.5) * 3),
    };
  });
}

// ── Canvas Drawing ──
function drawCurveChart(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  curves: { name: string; color: string; data: CurvePoint[] }[],
  title: string,
  showNS: boolean,
  nsParams?: NSParams
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 35, right: 20, bottom: 40, left: 55 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  // Title
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(title, pad.left, 16);

  // Data range
  let minY = Infinity, maxY = -Infinity;
  curves.forEach(c => c.data.forEach(p => { minY = Math.min(minY, p.yield); maxY = Math.max(maxY, p.yield); }));
  if (showNS && nsParams) {
    for (let t = 0.08; t <= 30; t += 0.5) {
      const v = nelsonSiegel(t, nsParams);
      minY = Math.min(minY, v); maxY = Math.max(maxY, v);
    }
  }
  const range = maxY - minY || 1;
  minY -= range * 0.1; maxY += range * 0.1;

  const xScale = (t: number) => pad.left + (Math.log(1 + t) / Math.log(31)) * cw;
  const yScale = (y: number) => pad.top + ch - ((y - minY) / (maxY - minY)) * ch;

  // Grid
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (i / 5) * ch;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    const val = maxY - (i / 5) * (maxY - minY);
    ctx.fillStyle = DIM;
    ctx.font = '10px monospace';
    ctx.fillText(val.toFixed(2) + '%', 5, y + 3);
  }

  // Tenor labels
  TENORS.forEach(t => {
    const x = xScale(TENOR_X[t]);
    ctx.fillStyle = DIM;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t, x, h - 5);
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ch);
    ctx.strokeStyle = '#1a1a1a'; ctx.stroke();
  });
  ctx.textAlign = 'left';

  // NS fitted curve
  if (showNS && nsParams) {
    ctx.strokeStyle = '#ff4081';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let t = 0.08; t <= 30; t += 0.1) {
      const y = nelsonSiegel(t, nsParams);
      const px = xScale(t), py = yScale(y);
      t === 0.08 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Curves
  curves.forEach(curve => {
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    curve.data.forEach((p, i) => {
      const px = xScale(TENOR_X[p.tenor]), py = yScale(p.yield);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Dots
    curve.data.forEach(p => {
      const px = xScale(TENOR_X[p.tenor]), py = yScale(p.yield);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = curve.color;
      ctx.fill();
    });
  });

  // Legend
  let lx = w - pad.right - 10;
  curves.forEach(c => {
    ctx.fillStyle = c.color;
    ctx.font = '10px monospace';
    const tw = ctx.measureText(c.name).width;
    lx -= tw + 20;
    ctx.fillRect(lx, 22, 8, 8);
    ctx.fillText(c.name, lx + 12, 30);
  });
  if (showNS) {
    lx -= 80;
    ctx.fillStyle = '#ff4081';
    ctx.fillRect(lx, 22, 8, 8);
    ctx.fillText('N-S Fit', lx + 12, 30);
  }
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  data: { label: string; value: number }[],
  title: string,
  color: string
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 30, right: 15, bottom: 35, left: 50 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  ctx.fillStyle = AMBER;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(title, pad.left, 16);

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const barW = Math.max(4, (cw / data.length) - 3);

  data.forEach((d, i) => {
    const x = pad.left + (i / data.length) * cw + 2;
    const barH = (Math.abs(d.value) / maxVal) * ch;
    const y = d.value >= 0 ? pad.top + ch - barH : pad.top + ch;
    ctx.fillStyle = d.value >= 0 ? GREEN : RED;
    ctx.fillRect(x, y, barW, barH || 1);

    if (i % 2 === 0) {
      ctx.fillStyle = DIM;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, h - 5);
    }
  });
  ctx.textAlign = 'left';
}

// ── Main Component ──
const TABS = ['Live Curves', 'Historical', 'Forward Rates', 'Spreads', 'Nelson-Siegel', 'Curve Builder'];

export default function YieldCurveUI2() {
  const [tab, setTab] = useState(0);
  const [activeCurves, setActiveCurves] = useState<Set<string>>(new Set(['ust', 'swap', 'corp_ig']));
  const [allCurves, setAllCurves] = useState(generateAllCurves);
  const [histCurves] = useState(generateHistCurves);
  const [selectedHist, setSelectedHist] = useState<Set<string>>(new Set(['Today', '1M Ago', '1Y Ago']));
  const [showNS, setShowNS] = useState(true);
  const [builderTarget, setBuilderTarget] = useState('ust');
  const mainRef = useRef<HTMLCanvasElement>(null);
  const fwdRef = useRef<HTMLCanvasElement>(null);
  const spreadRef = useRef<HTMLCanvasElement>(null);

  // Refresh data periodically
  useEffect(() => {
    const iv = setInterval(() => setAllCurves(generateAllCurves()), 5000);
    return () => clearInterval(iv);
  }, []);

  // Draw main curve chart
  const drawMain = useCallback(() => {
    const c = mainRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;

    if (tab === 0) {
      // Live curves
      const curvesToDraw = CURVES_CONFIG.filter(cc => activeCurves.has(cc.id)).map(cc => ({
        name: cc.name, color: cc.color, data: allCurves[cc.id]
      }));
      const nsParams = showNS ? fitNelsonSiegel(allCurves['ust']) : undefined;
      drawCurveChart(ctx, r.width, r.height, curvesToDraw, 'YIELD CURVES — LIVE', showNS, nsParams);
    } else if (tab === 1) {
      // Historical
      const curvesToDraw = HIST_DATES.filter(d => selectedHist.has(d)).map((d, i) => ({
        name: d, color: [AMBER, CYAN, GREEN, RED, '#9c27b0', '#ff9800'][i], data: histCurves[d]
      }));
      drawCurveChart(ctx, r.width, r.height, curvesToDraw, 'US TREASURY — HISTORICAL COMPARISON', false);
    } else if (tab === 4) {
      // Nelson-Siegel
      const nsParams = fitNelsonSiegel(allCurves['ust']);
      drawCurveChart(ctx, r.width, r.height, [
        { name: 'UST Actual', color: AMBER, data: allCurves['ust'] }
      ], 'NELSON-SIEGEL FIT — US TREASURY', true, nsParams);
    }
  }, [tab, activeCurves, allCurves, histCurves, selectedHist, showNS]);

  const drawForwards = useCallback(() => {
    const c = fwdRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    const fwds = computeForwards(allCurves['ust']);
    drawBarChart(ctx, r.width, r.height, fwds.map(f => ({ label: f.tenor, value: f.forward })), 'FORWARD RATES (BPS)', AMBER);
  }, [allCurves]);

  const drawSpreads = useCallback(() => {
    const c = spreadRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const r = c.parentElement!.getBoundingClientRect();
    c.width = r.width; c.height = r.height;
    const spds = computeSpreads(allCurves['corp_ig'], allCurves['ust']);
    drawBarChart(ctx, r.width, r.height, spds.map(s => ({ label: s.tenor, value: s.spread })), 'CORP IG vs UST SPREAD (BPS)', CYAN);
  }, [allCurves]);

  useEffect(() => { drawMain(); }, [drawMain]);
  useEffect(() => { if (tab === 2) drawForwards(); }, [tab, drawForwards]);
  useEffect(() => { if (tab === 3) drawSpreads(); }, [tab, drawSpreads]);

  const toggleCurve = (id: string) => {
    setActiveCurves(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleHist = (d: string) => {
    setSelectedHist(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
  };

  // Nelson-Siegel params
  const nsParams = fitNelsonSiegel(allCurves['ust']);
  const forwards = computeForwards(allCurves['ust']);
  const spreads = computeSpreads(allCurves['corp_ig'], allCurves['ust']);

  // Curve builder data
  const builderCurve = allCurves[builderTarget] || allCurves['ust'];

  return (
    <div style={{ width: '100%', height: '100%', background: BG, color: TEXT, fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, gap: 16 }}>
        <span style={{ color: AMBER, fontWeight: 'bold', fontSize: 14 }}>📐 YIELD CURVE ANALYSIS</span>
        <span style={{ color: DIM }}>|</span>
        <span style={{ color: GREEN }}>● LIVE</span>
        <span style={{ color: DIM, marginLeft: 'auto' }}>UST 10Y: {allCurves['ust']?.[9]?.yield?.toFixed(3) || '—'}%</span>
        <span style={{ color: DIM }}>2s10s: {((allCurves['ust']?.[9]?.yield || 0) - (allCurves['ust']?.[4]?.yield || 0)).toFixed(0)}bp</span>
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

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel */}
        <div style={{ width: 220, borderRight: `1px solid ${BORDER}`, overflow: 'auto', padding: 12 }}>
          {tab === 0 && (
            <>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>ACTIVE CURVES</div>
              {CURVES_CONFIG.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeCurves.has(c.id)} onChange={() => toggleCurve(c.id)} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                  <span style={{ color: TEXT, fontSize: 11 }}>{c.name}</span>
                </label>
              ))}
              <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showNS} onChange={() => setShowNS(!showNS)} />
                  <span style={{ color: '#ff4081', fontSize: 11 }}>Nelson-Siegel Fit</span>
                </label>
              </div>
              <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 4, fontSize: 10 }}>KEY RATES</div>
                {(allCurves['ust'] || []).map(p => (
                  <div key={p.tenor} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: DIM }}>{p.tenor}</span>
                    <span style={{ color: WHITE }}>{p.yield.toFixed(3)}%</span>
                    <span style={{ color: p.change >= 0 ? GREEN : RED, fontSize: 10 }}>{p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 1 && (
            <>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>SELECT DATES</div>
              {HIST_DATES.map((d, i) => (
                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedHist.has(d)} onChange={() => toggleHist(d)} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: [AMBER, CYAN, GREEN, RED, '#9c27b0', '#ff9800'][i], display: 'inline-block' }} />
                  <span style={{ color: TEXT, fontSize: 11 }}>{d}</span>
                </label>
              ))}
              <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 4, fontSize: 10 }}>CURVE CHANGES</div>
                {TENORS.map(t => {
                  const today = histCurves['Today']?.find(p => p.tenor === t)?.yield || 0;
                  const yearAgo = histCurves['1Y Ago']?.find(p => p.tenor === t)?.yield || 0;
                  const diff = today - yearAgo;
                  return (
                    <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span style={{ color: DIM }}>{t}</span>
                      <span style={{ color: diff >= 0 ? GREEN : RED, fontSize: 10 }}>{diff >= 0 ? '+' : ''}{(diff * 100).toFixed(0)}bp</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {tab === 2 && (
            <>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>FORWARD RATES</div>
              {forwards.map(f => (
                <div key={f.tenor} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: DIM }}>{f.tenor}</span>
                  <span style={{ color: WHITE }}>{f.forward.toFixed(3)}%</span>
                </div>
              ))}
              <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 8, color: DIM, fontSize: 10 }}>
                Forward rates derived from bootstrapped spot rates using linear interpolation.
              </div>
            </>
          )}
          {tab === 3 && (
            <>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>SPREAD TABLE</div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 8 }}>Corp IG (A) vs UST</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, fontSize: 9 }}>
                <span style={{ color: AMBER }}>Tenor</span>
                <span style={{ color: AMBER }}>Nom</span>
                <span style={{ color: AMBER }}>Z-Spd</span>
                <span style={{ color: AMBER }}>OAS</span>
                {spreads.map(s => (
                  <React.Fragment key={s.tenor}>
                    <span style={{ color: DIM }}>{s.tenor}</span>
                    <span style={{ color: WHITE }}>{s.spread}</span>
                    <span style={{ color: CYAN }}>{s.zSpread}</span>
                    <span style={{ color: GREEN }}>{s.oas}</span>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
          {tab === 4 && (
            <>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>N-S PARAMETERS</div>
              {(['beta0', 'beta1', 'beta2', 'lambda'] as const).map(k => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: '#ff4081' }}>{k}</span>
                  <span style={{ color: WHITE }}>{nsParams[k].toFixed(4)}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, color: DIM, fontSize: 10, lineHeight: '16px' }}>
                y(τ) = β₀ + β₁·[(1-e^(-λτ))/(λτ)] + β₂·[(1-e^(-λτ))/(λτ) - e^(-λτ)]
              </div>
              <div style={{ marginTop: 12, color: DIM, fontSize: 10 }}>
                β₀ = Long-term level<br />
                β₁ = Short-term component<br />
                β₂ = Medium-term (hump)<br />
                λ = Decay factor
              </div>
            </>
          )}
          {tab === 5 && (
            <>
              <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8 }}>CURVE BUILDER</div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: DIM, fontSize: 10 }}>Base Curve:</span>
                <select value={builderTarget} onChange={e => setBuilderTarget(e.target.value)} style={{
                  width: '100%', marginTop: 4, padding: '4px 8px', background: '#1a1a1a', border: `1px solid ${BORDER}`,
                  color: WHITE, fontFamily: 'monospace', fontSize: 11
                }}>
                  {CURVES_CONFIG.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ color: DIM, fontSize: 10, marginBottom: 8 }}>Spot Rates (edit):</div>
              {builderCurve.map(p => (
                <div key={p.tenor} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                  <span style={{ color: DIM, width: 30, fontSize: 10 }}>{p.tenor}</span>
                  <input type="number" defaultValue={p.yield.toFixed(3)} step={0.01} style={{
                    flex: 1, padding: '2px 4px', background: '#1a1a1a', border: `1px solid ${BORDER}`,
                    color: WHITE, fontFamily: 'monospace', fontSize: 10, width: 60
                  }} />
                  <span style={{ color: DIM, fontSize: 9 }}>%</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Main Chart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <canvas ref={mainRef} style={{ width: '100%', height: '100%' }} />
          </div>
          {(tab === 2 || tab === 3) && (
            <div style={{ height: '40%', borderTop: `1px solid ${BORDER}`, position: 'relative' }}>
              <canvas ref={tab === 2 ? fwdRef : spreadRef} style={{ width: '100%', height: '100%' }} />
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ width: 200, borderLeft: `1px solid ${BORDER}`, overflow: 'auto', padding: 12 }}>
          <div style={{ color: AMBER, fontWeight: 'bold', marginBottom: 8, fontSize: 10 }}>CURVE METRICS</div>

          {/* Key spreads */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: DIM, fontSize: 9, marginBottom: 4 }}>KEY SPREADS</div>
            {[
              { label: '2s10s', val: ((allCurves['ust']?.[9]?.yield || 0) - (allCurves['ust']?.[4]?.yield || 0)) * 100 },
              { label: '2s30s', val: ((allCurves['ust']?.[11]?.yield || 0) - (allCurves['ust']?.[4]?.yield || 0)) * 100 },
              { label: '5s30s', val: ((allCurves['ust']?.[11]?.yield || 0) - (allCurves['ust']?.[7]?.yield || 0)) * 100 },
              { label: '3m10y', val: ((allCurves['ust']?.[9]?.yield || 0) - (allCurves['ust']?.[2]?.yield || 0)) * 100 },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: DIM }}>{s.label}</span>
                <span style={{ color: s.val >= 0 ? GREEN : RED }}>{s.val.toFixed(0)}bp</span>
              </div>
            ))}
          </div>

          {/* Swap spreads */}
          <div style={{ marginBottom: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            <div style={{ color: DIM, fontSize: 9, marginBottom: 4 }}>SWAP SPREADS</div>
            {TENORS.filter((_, i) => i % 3 === 0).map(t => {
              const ustY = allCurves['ust']?.find(p => p.tenor === t)?.yield || 0;
              const swapY = allCurves['swap']?.find(p => p.tenor === t)?.yield || 0;
              const diff = (swapY - ustY) * 100;
              return (
                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: DIM }}>{t}</span>
                  <span style={{ color: diff >= 0 ? CYAN : RED }}>{diff >= 0 ? '+' : ''}{diff.toFixed(0)}bp</span>
                </div>
              );
            })}
          </div>

          {/* Real yields */}
          <div style={{ marginBottom: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            <div style={{ color: DIM, fontSize: 9, marginBottom: 4 }}>REAL YIELDS (TIPS)</div>
            {(allCurves['tips'] || []).filter((_, i) => i % 3 === 0).map(p => (
              <div key={p.tenor} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: DIM }}>{p.tenor}</span>
                <span style={{ color: '#9c27b0' }}>{p.yield.toFixed(3)}%</span>
              </div>
            ))}
          </div>

          {/* Breakevens */}
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
            <div style={{ color: DIM, fontSize: 9, marginBottom: 4 }}>BREAKEVEN INFLATION</div>
            {TENORS.filter((_, i) => i >= 4 && i % 2 === 0).map(t => {
              const nomY = allCurves['ust']?.find(p => p.tenor === t)?.yield || 0;
              const realY = allCurves['tips']?.find(p => p.tenor === t)?.yield || 0;
              const bei = nomY - realY;
              return (
                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: DIM }}>{t}</span>
                  <span style={{ color: AMBER }}>{bei.toFixed(2)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', borderTop: `1px solid ${BORDER}`, background: '#080808', fontSize: 10 }}>
        <span style={{ color: DIM }}>Source: Fed H.15 | ICE BofA | Bloomberg BVAL</span>
        <span style={{ color: DIM }}>{CURVES_CONFIG.filter(c => activeCurves.has(c.id)).length} curves active</span>
        <span style={{ color: DIM }}>Last update: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
