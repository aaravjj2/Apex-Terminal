/**
 * PortfolioOptimizerProUI2 — Mean-Variance, Black-Litterman, Risk Parity
 * Efficient frontier, asset allocation, constraint editor, rebalancing.
 */
import { useState, useRef, useEffect, useMemo } from 'react';

const BG = '#0a0a0a', PANEL = '#111111', BORDER = '#1e1e1e';
const AMBER = '#f5a623', GREEN = '#26a69a', RED = '#ef5350', MUTED = '#888';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Asset { ticker: string; name: string; weight: number; expectedReturn: number; vol: number; assetClass: string; color: string }
interface FrontierPoint { ret: number; vol: number; sharpe: number; weights: number[] }
interface Constraint { type: string; asset?: string; min?: number; max?: number; enabled: boolean }
interface View { asset: string; direction: 'bullish' | 'bearish'; magnitude: number; confidence: number }

/* ─── Asset Universe ─────────────────────────────────────────────────── */
const ASSET_COLORS = ['#4fc3f7', '#f5a623', '#26a69a', '#ef5350', '#ba68c8', '#ff8a65', '#66bb6a', '#42a5f5', '#ffca28', '#ab47bc', '#26c6da', '#ec407a', '#9ccc65', '#5c6bc0', '#78909c'];
const ASSETS: Asset[] = [
  { ticker: 'SPY', name: 'S&P 500', weight: 25, expectedReturn: 10.2, vol: 15.5, assetClass: 'US Equity', color: ASSET_COLORS[0] },
  { ticker: 'QQQ', name: 'Nasdaq 100', weight: 15, expectedReturn: 13.5, vol: 20.2, assetClass: 'US Equity', color: ASSET_COLORS[1] },
  { ticker: 'IWM', name: 'Russell 2000', weight: 5, expectedReturn: 9.8, vol: 19.8, assetClass: 'US Equity', color: ASSET_COLORS[2] },
  { ticker: 'EFA', name: 'Intl Dev Markets', weight: 10, expectedReturn: 7.5, vol: 14.8, assetClass: 'Intl Equity', color: ASSET_COLORS[3] },
  { ticker: 'EEM', name: 'Emerging Markets', weight: 5, expectedReturn: 8.2, vol: 19.5, assetClass: 'Intl Equity', color: ASSET_COLORS[4] },
  { ticker: 'AGG', name: 'US Agg Bond', weight: 15, expectedReturn: 3.5, vol: 3.8, assetClass: 'Fixed Income', color: ASSET_COLORS[5] },
  { ticker: 'TLT', name: 'Long Treasury', weight: 5, expectedReturn: 2.8, vol: 13.5, assetClass: 'Fixed Income', color: ASSET_COLORS[6] },
  { ticker: 'LQD', name: 'IG Corporate', weight: 5, expectedReturn: 4.2, vol: 6.2, assetClass: 'Fixed Income', color: ASSET_COLORS[7] },
  { ticker: 'GLD', name: 'Gold', weight: 5, expectedReturn: 5.5, vol: 15.2, assetClass: 'Commodities', color: ASSET_COLORS[8] },
  { ticker: 'DBC', name: 'Commodities', weight: 3, expectedReturn: 4.8, vol: 16.5, assetClass: 'Commodities', color: ASSET_COLORS[9] },
  { ticker: 'VNQ', name: 'REITs', weight: 4, expectedReturn: 7.2, vol: 18.5, assetClass: 'Real Estate', color: ASSET_COLORS[10] },
  { ticker: 'BTC', name: 'Bitcoin', weight: 3, expectedReturn: 35.0, vol: 65.0, assetClass: 'Crypto', color: ASSET_COLORS[11] },
];

/* ─── Correlation Matrix (simplified) ─────────────────────────────────── */
function genCorrelation(n: number): number[][] {
  const mat: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    mat[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      // Simplified: same asset class → higher correlation
      const r = 0.1 + Math.random() * 0.6;
      mat[i][j] = r; mat[j][i] = r;
    }
  }
  return mat;
}

/* ─── Efficient Frontier Generator ────────────────────────────────────── */
function generateFrontier(assets: Asset[]): FrontierPoint[] {
  const points: FrontierPoint[] = [];
  const n = assets.length;
  const rf = 4.5; // risk free rate

  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    // Vary from min-vol to max-return
    const weights: number[] = [];
    let wSum = 0;
    for (let j = 0; j < n; j++) {
      const bias = t * assets[j].expectedReturn / 100 + (1 - t) * (1 / (assets[j].vol + 0.1));
      weights.push(bias);
      wSum += bias;
    }
    weights.forEach((_, j) => weights[j] /= wSum);

    const ret = weights.reduce((s, w, j) => s + w * assets[j].expectedReturn, 0);
    // Simplified portfolio vol
    let vol2 = 0;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const corr = a === b ? 1 : 0.3 + (Math.abs(a - b) / n) * 0.3;
        vol2 += weights[a] * weights[b] * assets[a].vol * assets[b].vol * corr / 100;
      }
    }
    const vol = Math.sqrt(vol2);
    const sharpe = (ret - rf) / vol;
    points.push({ ret, vol, sharpe, weights });
  }
  return points;
}

/* ─── Canvas: Efficient Frontier ──────────────────────────────────────── */
function EfficientFrontierChart({ assets, frontier, currentWeights }: {
  assets: Asset[]; frontier: FrontierPoint[]; currentWeights: number[]
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const pad = { l: 50, r: 20, t: 25, b: 35 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    const allVol = [...frontier.map(p => p.vol), ...assets.map(a => a.vol)];
    const allRet = [...frontier.map(p => p.ret), ...assets.map(a => a.expectedReturn)];
    const minV = Math.max(0, Math.min(...allVol) - 2), maxV = Math.max(...allVol) + 5;
    const minR = Math.min(0, Math.min(...allRet) - 2), maxR = Math.max(...allRet) + 5;

    const px = (v: number) => pad.l + ((v - minV) / (maxV - minV)) * cw;
    const py = (r: number) => pad.t + ((maxR - r) / (maxR - minR)) * ch;

    // Grid
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const v = minV + (maxV - minV) * i / 5;
      const r = minR + (maxR - minR) * i / 5;
      ctx.beginPath(); ctx.moveTo(px(v), pad.t); ctx.lineTo(px(v), h - pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, py(r)); ctx.lineTo(w - pad.r, py(r)); ctx.stroke();
      ctx.fillStyle = MUTED; ctx.font = '8px monospace';
      ctx.textAlign = 'center'; ctx.fillText(`${v.toFixed(0)}%`, px(v), h - pad.b + 12);
      ctx.textAlign = 'right'; ctx.fillText(`${r.toFixed(0)}%`, pad.l - 5, py(r) + 3);
    }

    // Frontier curve
    ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
    ctx.beginPath();
    frontier.forEach((p, i) => i === 0 ? ctx.moveTo(px(p.vol), py(p.ret)) : ctx.lineTo(px(p.vol), py(p.ret)));
    ctx.stroke();

    // Fill below frontier
    ctx.lineTo(px(frontier[frontier.length - 1].vol), h - pad.b);
    ctx.lineTo(px(frontier[0].vol), h - pad.b);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245,166,35,0.04)';
    ctx.fill();

    // Max Sharpe point
    const maxSharpe = frontier.reduce((best, p) => p.sharpe > best.sharpe ? p : best, frontier[0]);
    ctx.fillStyle = GREEN;
    ctx.beginPath(); ctx.arc(px(maxSharpe.vol), py(maxSharpe.ret), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eee'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`Max Sharpe: ${maxSharpe.sharpe.toFixed(2)}`, px(maxSharpe.vol) + 8, py(maxSharpe.ret) + 3);

    // Min vol point
    const minVolP = frontier.reduce((best, p) => p.vol < best.vol ? p : best, frontier[0]);
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.arc(px(minVolP.vol), py(minVolP.ret), 5, 0, Math.PI * 2); ctx.fill();

    // Asset points
    assets.forEach(a => {
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.arc(px(a.vol), py(a.expectedReturn), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#999'; ctx.font = '7px monospace'; ctx.textAlign = 'left';
      ctx.fillText(a.ticker, px(a.vol) + 6, py(a.expectedReturn) + 3);
    });

    // Current portfolio
    const curRet = currentWeights.reduce((s, w, i) => s + w / 100 * assets[i].expectedReturn, 0);
    let curVol2 = 0;
    for (let a = 0; a < assets.length; a++) {
      for (let b = 0; b < assets.length; b++) {
        const corr = a === b ? 1 : 0.35;
        curVol2 += (currentWeights[a] / 100) * (currentWeights[b] / 100) * assets[a].vol * assets[b].vol * corr / 100;
      }
    }
    const curVol = Math.sqrt(curVol2);
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(px(curVol), py(curRet), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace';
    ctx.fillText('YOU', px(curVol) + 8, py(curRet) + 3);

    // Axis labels
    ctx.fillStyle = MUTED; ctx.font = '9px monospace';
    ctx.textAlign = 'center'; ctx.fillText('Volatility (%)', w / 2, h - 4);
    ctx.save(); ctx.translate(12, h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Expected Return (%)', 0, 0); ctx.restore();
  }, [assets, frontier, currentWeights]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', borderRadius: 4 }} />;
}

/* ─── Canvas: Allocation Donut ────────────────────────────────────────── */
function AllocationDonut({ assets, weights }: { assets: Asset[]; weights: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = 2;
    const W = c.width = c.offsetWidth * dpr, H = c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = W / dpr, h = H / dpr;
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 15, inner = r * 0.55;
    let angle = -Math.PI / 2;
    const total = weights.reduce((s, v) => s + v, 0);

    assets.forEach((a, i) => {
      if (weights[i] <= 0) return;
      const sweep = (weights[i] / total) * Math.PI * 2;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.arc(cx, cy, inner, angle + sweep, angle, true);
      ctx.closePath(); ctx.fill();

      // Label
      if (weights[i] > 3) {
        const mid = angle + sweep / 2;
        const lr = (r + inner) / 2;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`${weights[i].toFixed(0)}%`, cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr + 3);
      }
      angle += sweep;
    });

    // Center text
    ctx.fillStyle = '#eee'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${assets.length}`, cx, cy - 2);
    ctx.fillStyle = MUTED; ctx.font = '8px monospace';
    ctx.fillText('ASSETS', cx, cy + 10);
  }, [assets, weights]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: 4 }} />;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
const TABS = ['OPTIMIZER', 'ALLOCATION', 'CONSTRAINTS', 'BLACK-LITTERMAN'] as const;
type Tab = typeof TABS[number];

export default function PortfolioOptimizerProUI2() {
  const [tab, setTab] = useState<Tab>('OPTIMIZER');
  const [assets, setAssets] = useState<Asset[]>(ASSETS);
  const [weights, setWeights] = useState<number[]>(ASSETS.map(a => a.weight));
  const [method, setMethod] = useState<'Mean-Variance' | 'Risk Parity' | 'Black-Litterman' | 'Min Variance' | 'Max Sharpe'>('Mean-Variance');
  const [riskFree, setRiskFree] = useState(4.5);
  const [constraints, setConstraints] = useState<Constraint[]>([
    { type: 'Max Position', max: 40, enabled: true },
    { type: 'Min Position', min: 1, enabled: true },
    { type: 'Max Asset Class', asset: 'US Equity', max: 60, enabled: true },
    { type: 'Min Bonds', asset: 'Fixed Income', min: 15, enabled: true },
  ]);
  const [views, setViews] = useState<View[]>([
    { asset: 'QQQ', direction: 'bullish', magnitude: 5, confidence: 70 },
    { asset: 'EEM', direction: 'bearish', magnitude: 3, confidence: 50 },
    { asset: 'GLD', direction: 'bullish', magnitude: 2, confidence: 60 },
  ]);

  const frontier = useMemo(() => generateFrontier(assets), [assets]);
  const correlation = useMemo(() => genCorrelation(assets.length), [assets.length]);

  const stats = useMemo(() => {
    const portRet = weights.reduce((s, w, i) => s + (w / 100) * assets[i].expectedReturn, 0);
    let pVol2 = 0;
    for (let a = 0; a < assets.length; a++) {
      for (let b = 0; b < assets.length; b++) {
        pVol2 += (weights[a] / 100) * (weights[b] / 100) * assets[a].vol * assets[b].vol * (correlation[a]?.[b] ?? 0.3) / 100;
      }
    }
    const portVol = Math.sqrt(pVol2);
    return { ret: portRet, vol: portVol, sharpe: (portRet - riskFree) / portVol };
  }, [weights, assets, riskFree, correlation]);

  const optimize = (target: string) => {
    let newW: number[];
    if (target === 'Max Sharpe') {
      const best = frontier.reduce((b, p) => p.sharpe > b.sharpe ? p : b, frontier[0]);
      newW = best.weights.map(w => w * 100);
    } else if (target === 'Min Variance') {
      const best = frontier.reduce((b, p) => p.vol < b.vol ? p : b, frontier[0]);
      newW = best.weights.map(w => w * 100);
    } else if (target === 'Risk Parity') {
      const invVol = assets.map(a => 1 / a.vol);
      const total = invVol.reduce((s, v) => s + v, 0);
      newW = invVol.map(v => (v / total) * 100);
    } else {
      // Equal weight
      newW = assets.map(() => 100 / assets.length);
    }
    setWeights(newW);
  };

  const ps: React.CSSProperties = { background: BG, color: '#eee', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','SF Mono',monospace", fontSize: 12 };
  const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12 };

  return (
    <div style={ps}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>📊 PORTFOLIO OPTIMIZER</span>
          <select value={method} onChange={e => setMethod(e.target.value as any)}
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, color: '#eee', padding: '4px 8px', fontSize: 11 }}>
            {['Mean-Variance', 'Risk Parity', 'Black-Litterman', 'Min Variance', 'Max Sharpe'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Max Sharpe', 'Min Variance', 'Risk Parity', 'Equal Weight'].map(opt => (
            <button key={opt} onClick={() => optimize(opt)} style={{
              background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 4,
              color: AMBER, padding: '5px 12px', fontSize: 10, cursor: 'pointer', fontWeight: 600
            }}>{opt}</button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 24, padding: '6px 16px', borderBottom: `1px solid ${BORDER}` }}>
        {[
          { l: 'Expected Return', v: `${stats.ret.toFixed(1)}%`, c: stats.ret > 0 ? GREEN : RED },
          { l: 'Volatility', v: `${stats.vol.toFixed(1)}%`, c: stats.vol > 20 ? RED : AMBER },
          { l: 'Sharpe Ratio', v: stats.sharpe.toFixed(2), c: stats.sharpe > 1 ? GREEN : stats.sharpe > 0.5 ? AMBER : RED },
          { l: 'Risk-Free Rate', v: `${riskFree.toFixed(1)}%`, c: MUTED },
          { l: 'Assets', v: assets.length.toString(), c: '#eee' },
          { l: 'Max Weight', v: `${Math.max(...weights).toFixed(0)}%`, c: Math.max(...weights) > 40 ? RED : '#eee' },
        ].map(s => (
          <div key={s.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ color: MUTED, fontSize: 9 }}>{s.l}</span>
            <span style={{ color: s.c, fontWeight: 700, fontSize: 13 }}>{s.v}</span>
          </div>
        ))}
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
        {tab === 'OPTIMIZER' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, height: '100%' }}>
            <div style={{ ...panelStyle, height: '100%' }}>
              <div style={{ color: AMBER, fontWeight: 600, fontSize: 11, marginBottom: 6 }}>EFFICIENT FRONTIER</div>
              <div style={{ height: 'calc(100% - 20px)' }}>
                <EfficientFrontierChart assets={assets} frontier={frontier} currentWeights={weights} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={panelStyle}>
                <div style={{ color: AMBER, fontWeight: 600, fontSize: 11, marginBottom: 6 }}>ALLOCATION</div>
                <AllocationDonut assets={assets} weights={weights} />
              </div>
              <div style={panelStyle}>
                <div style={{ color: AMBER, fontWeight: 600, fontSize: 11, marginBottom: 6 }}>BY ASSET CLASS</div>
                {Array.from(new Set(assets.map(a => a.assetClass))).map(ac => {
                  const total = assets.reduce((s, a, i) => a.assetClass === ac ? s + weights[i] : s, 0);
                  return (
                    <div key={ac} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                        <span style={{ color: '#ccc' }}>{ac}</span>
                        <span style={{ color: AMBER, fontWeight: 600 }}>{total.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                        <div style={{ width: `${total}%`, height: '100%', background: AMBER, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'ALLOCATION' && (
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>ASSET WEIGHTS</span>
              <span style={{ color: MUTED, fontSize: 10 }}>Total: {weights.reduce((s, w) => s + w, 0).toFixed(1)}%</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Asset', 'Class', 'Weight', '', 'Exp.Ret', 'Vol', 'Contribution'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: MUTED, fontSize: 10, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((a, i) => (
                  <tr key={a.ticker} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
                        <span style={{ fontWeight: 600 }}>{a.ticker}</span>
                        <span style={{ color: MUTED, fontSize: 10 }}>{a.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', color: MUTED, fontSize: 10 }}>{a.assetClass}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: AMBER, width: 60 }}>
                      <input type="number" value={weights[i].toFixed(1)} step="0.5" min="0" max="100"
                        onChange={e => { const nw = [...weights]; nw[i] = Number(e.target.value); setWeights(nw); }}
                        style={{ width: 50, background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '2px 4px', fontSize: 11, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '6px 8px', width: 120 }}>
                      <input type="range" min="0" max="50" step="0.5" value={weights[i]}
                        onChange={e => { const nw = [...weights]; nw[i] = Number(e.target.value); setWeights(nw); }}
                        style={{ width: '100%', accentColor: a.color }} />
                    </td>
                    <td style={{ padding: '6px 8px', color: a.expectedReturn > 10 ? GREEN : '#eee', fontSize: 11 }}>{a.expectedReturn.toFixed(1)}%</td>
                    <td style={{ padding: '6px 8px', color: a.vol > 25 ? RED : MUTED, fontSize: 11 }}>{a.vol.toFixed(1)}%</td>
                    <td style={{ padding: '6px 8px', fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 40, height: 6, background: '#1a1a1a', borderRadius: 3 }}>
                          <div style={{ width: `${weights[i] * 2}%`, height: '100%', background: a.color, borderRadius: 3 }} />
                        </div>
                        <span style={{ color: MUTED }}>{(weights[i] / 100 * a.expectedReturn).toFixed(2)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'CONSTRAINTS' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>ACTIVE CONSTRAINTS</span>
                <button onClick={() => setConstraints(prev => [...prev, { type: 'Max Position', max: 30, enabled: true }])}
                  style={{ background: 'transparent', border: `1px solid ${AMBER}`, borderRadius: 3, color: AMBER, padding: '2px 8px', fontSize: 9, cursor: 'pointer' }}>+ ADD</button>
              </div>
              {constraints.map((con, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4,
                  background: '#0a0a0a', border: `1px solid ${con.enabled ? AMBER + '33' : BORDER}`,
                  borderRadius: 6, opacity: con.enabled ? 1 : 0.5,
                }}>
                  <input type="checkbox" checked={con.enabled}
                    onChange={() => { const nc = [...constraints]; nc[i] = { ...nc[i], enabled: !nc[i].enabled }; setConstraints(nc); }}
                    style={{ accentColor: AMBER }} />
                  <select value={con.type}
                    onChange={e => { const nc = [...constraints]; nc[i] = { ...nc[i], type: e.target.value }; setConstraints(nc); }}
                    style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '3px 6px', fontSize: 10 }}>
                    {['Max Position', 'Min Position', 'Max Asset Class', 'Min Asset Class', 'Max Sector', 'Turnover Limit', 'Tracking Error'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  {con.asset && <span style={{ color: MUTED, fontSize: 10 }}>{con.asset}</span>}
                  {con.max !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: MUTED, fontSize: 9 }}>max:</span>
                      <input type="number" value={con.max}
                        onChange={e => { const nc = [...constraints]; nc[i] = { ...nc[i], max: Number(e.target.value) }; setConstraints(nc); }}
                        style={{ width: 45, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '2px 4px', fontSize: 10, textAlign: 'right' }} />
                      <span style={{ color: MUTED, fontSize: 9 }}>%</span>
                    </div>
                  )}
                  {con.min !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: MUTED, fontSize: 9 }}>min:</span>
                      <input type="number" value={con.min}
                        onChange={e => { const nc = [...constraints]; nc[i] = { ...nc[i], min: Number(e.target.value) }; setConstraints(nc); }}
                        style={{ width: 45, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: AMBER, padding: '2px 4px', fontSize: 10, textAlign: 'right' }} />
                      <span style={{ color: MUTED, fontSize: 9 }}>%</span>
                    </div>
                  )}
                  <button onClick={() => setConstraints(prev => prev.filter((_, j) => j !== i))}
                    style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>

            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>CORRELATION MATRIX</span>
              <div style={{ overflow: 'auto', marginTop: 8 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 3 }}></th>
                      {assets.slice(0, 8).map(a => <th key={a.ticker} style={{ padding: 3, color: MUTED, transform: 'rotate(-45deg)', width: 30 }}>{a.ticker}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {assets.slice(0, 8).map((a, i) => (
                      <tr key={a.ticker}>
                        <td style={{ padding: 3, color: MUTED, fontWeight: 600 }}>{a.ticker}</td>
                        {assets.slice(0, 8).map((_, j) => {
                          const v = correlation[i]?.[j] ?? 0;
                          const intensity = Math.abs(v);
                          const color = v > 0.5 ? `rgba(239,83,80,${intensity * 0.6})` : v > 0 ? `rgba(245,166,35,${intensity * 0.4})` : `rgba(38,166,154,${intensity * 0.4})`;
                          return (
                            <td key={j} style={{ padding: 3, textAlign: 'center', background: color, borderRadius: 1, color: '#ccc' }}>
                              {v.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'BLACK-LITTERMAN' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>INVESTOR VIEWS</span>
                <button onClick={() => setViews(prev => [...prev, { asset: 'SPY', direction: 'bullish', magnitude: 3, confidence: 50 }])}
                  style={{ background: 'transparent', border: `1px solid ${AMBER}`, borderRadius: 3, color: AMBER, padding: '2px 8px', fontSize: 9, cursor: 'pointer' }}>+ ADD VIEW</button>
              </div>
              <div style={{ color: MUTED, fontSize: 10, marginBottom: 12 }}>
                Express subjective views on expected returns. The Black-Litterman model blends these
                with market equilibrium to produce posterior expected returns.
              </div>
              {views.map((view, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 6,
                  background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: 6,
                  borderLeft: `3px solid ${view.direction === 'bullish' ? GREEN : RED}`,
                }}>
                  <select value={view.asset}
                    onChange={e => { const nv = [...views]; nv[i] = { ...nv[i], asset: e.target.value }; setViews(nv); }}
                    style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '3px 6px', fontSize: 10, fontWeight: 700 }}>
                    {assets.map(a => <option key={a.ticker}>{a.ticker}</option>)}
                  </select>
                  <select value={view.direction}
                    onChange={e => { const nv = [...views]; nv[i] = { ...nv[i], direction: e.target.value as any }; setViews(nv); }}
                    style={{
                      background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3,
                      color: view.direction === 'bullish' ? GREEN : RED,
                      padding: '3px 6px', fontSize: 10, fontWeight: 600
                    }}>
                    <option value="bullish">BULLISH</option>
                    <option value="bearish">BEARISH</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: MUTED, fontSize: 9 }}>α:</span>
                    <input type="number" step="0.5" value={view.magnitude}
                      onChange={e => { const nv = [...views]; nv[i] = { ...nv[i], magnitude: Number(e.target.value) }; setViews(nv); }}
                      style={{ width: 40, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: '#eee', padding: '2px 4px', fontSize: 10, textAlign: 'right' }} />
                    <span style={{ color: MUTED, fontSize: 9 }}>%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                    <span style={{ color: MUTED, fontSize: 9 }}>conf:</span>
                    <input type="range" min="10" max="100" value={view.confidence}
                      onChange={e => { const nv = [...views]; nv[i] = { ...nv[i], confidence: Number(e.target.value) }; setViews(nv); }}
                      style={{ flex: 1, accentColor: AMBER }} />
                    <span style={{ color: AMBER, fontSize: 10, fontWeight: 600, minWidth: 28 }}>{view.confidence}%</span>
                  </div>
                  <button onClick={() => setViews(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>

            <div style={panelStyle}>
              <span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>POSTERIOR EXPECTED RETURNS</span>
              <div style={{ color: MUTED, fontSize: 10, marginBottom: 12 }}>
                Blended equilibrium + views. Higher confidence pushes posterior closer to view.
              </div>
              {assets.map(a => {
                const view = views.find(v => v.asset === a.ticker);
                const adjustment = view ? (view.direction === 'bullish' ? 1 : -1) * view.magnitude * view.confidence / 100 : 0;
                const posterior = a.expectedReturn + adjustment;
                return (
                  <div key={a.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
                    <span style={{ width: 40, fontWeight: 600 }}>{a.ticker}</span>
                    <span style={{ color: MUTED, fontSize: 10, width: 55 }}>{a.expectedReturn.toFixed(1)}%</span>
                    <span style={{ color: MUTED, fontSize: 10 }}>→</span>
                    <span style={{ color: posterior > a.expectedReturn ? GREEN : posterior < a.expectedReturn ? RED : '#eee', fontWeight: 600, width: 50, fontSize: 11 }}>{posterior.toFixed(1)}%</span>
                    <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 3, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: `${(a.expectedReturn / 40) * 100}%`, top: 0, width: 1, height: 6, background: MUTED }} />
                      <div style={{
                        position: 'absolute',
                        left: `${(Math.min(a.expectedReturn, posterior) / 40) * 100}%`,
                        width: `${(Math.abs(adjustment) / 40) * 100}%`,
                        height: '100%', borderRadius: 3,
                        background: adjustment > 0 ? GREEN : adjustment < 0 ? RED : 'transparent',
                        opacity: 0.5,
                      }} />
                    </div>
                    {view && <span style={{ fontSize: 8, color: view.direction === 'bullish' ? GREEN : RED }}>
                      {view.direction === 'bullish' ? '▲' : '▼'} {view.confidence}%
                    </span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
