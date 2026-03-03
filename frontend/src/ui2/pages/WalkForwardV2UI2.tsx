/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Walk-Forward Optimization V2 (UI2)                 │
 * │  Anchored / rolling / combinatorial walk-forward with IS/OOS        │
 * │  splits, parameter stability analysis, and degradation metrics      │
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

/* ── Types ───────────────────────────────────────────────────────────── */
interface WFWindow {
  id: number;
  isStart: string;
  isEnd: string;
  oosStart: string;
  oosEnd: string;
  isSharpe: number;
  oosSharpe: number;
  isReturn: number;
  oosReturn: number;
  efficiency: number;
  bestParams: Record<string, number>;
  status: 'pass' | 'fail' | 'marginal';
}

interface ParamStability {
  name: string;
  values: number[];
  mean: number;
  std: number;
  cv: number; // coefficient of variation
  stable: boolean;
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateWindows(): WFWindow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const yr = 2022 + Math.floor(i / 4);
    const q = (i % 4) + 1;
    const isSharpe = 1.2 + Math.random() * 1.5;
    const eff = 0.3 + Math.random() * 0.6;
    const oosSharpe = isSharpe * eff;
    return {
      id: i + 1,
      isStart: `${yr}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`,
      isEnd: `${yr}-${String(q * 3).padStart(2, '0')}-${q === 4 ? '31' : '30'}`,
      oosStart: `${yr}-${String(q * 3 + 1 > 12 ? 1 : q * 3 + 1).padStart(2, '0')}-01`,
      oosEnd: `${yr + (q === 4 ? 1 : 0)}-${String(q === 4 ? 3 : (q + 1) * 3).padStart(2, '0')}-${q === 3 ? '31' : '30'}`,
      isSharpe,
      oosSharpe,
      isReturn: 5 + Math.random() * 20,
      oosReturn: -2 + Math.random() * 15,
      efficiency: eff,
      bestParams: {
        fastMA: Math.round(8 + Math.random() * 12),
        slowMA: Math.round(20 + Math.random() * 30),
        stopLoss: +(1.5 + Math.random() * 2).toFixed(1),
        takeProfit: +(2.5 + Math.random() * 3).toFixed(1),
        rsiPeriod: Math.round(10 + Math.random() * 10),
      },
      status: eff > 0.5 ? 'pass' : eff > 0.3 ? 'marginal' : 'fail',
    };
  });
}

function generateParamStability(windows: WFWindow[]): ParamStability[] {
  const params = ['fastMA', 'slowMA', 'stopLoss', 'takeProfit', 'rsiPeriod'];
  return params.map(p => {
    const values = windows.map(w => w.bestParams[p]);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const cv = std / mean;
    return { name: p, values, mean, std, cv, stable: cv < 0.2 };
  });
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function WFTimelineCanvas({ windows }: { windows: WFWindow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 600, H = 160;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const barH = 10; const gap = 3;
    const startY = 20;
    const colW = W / (windows.length + 1);

    windows.forEach((w, i) => {
      const x = (i + 0.5) * colW;
      const isH = barH;
      // IS bar
      ctx.fillStyle = `${T.brand}60`;
      ctx.fillRect(x, startY, colW - gap, isH);
      // OOS bar
      const oosColor = w.status === 'pass' ? `${T.up}60` : w.status === 'marginal' ? `${T.warn}60` : `${T.dn}60`;
      ctx.fillStyle = oosColor;
      ctx.fillRect(x, startY + isH + 2, colW - gap, isH);

      // Efficiency bar
      const effY = startY + isH * 2 + 14;
      const effH = 50;
      ctx.fillStyle = T.bg3;
      ctx.fillRect(x, effY, colW - gap, effH);
      const fillH = w.efficiency * effH;
      ctx.fillStyle = w.status === 'pass' ? T.up : w.status === 'marginal' ? T.warn : T.dn;
      ctx.fillRect(x, effY + effH - fillH, colW - gap, fillH);

      // Labels
      ctx.fillStyle = T.tx3; ctx.font = '6px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`W${w.id}`, x + (colW - gap) / 2, startY - 4);
      ctx.fillText(`${(w.efficiency * 100).toFixed(0)}%`, x + (colW - gap) / 2, effY + effH + 10);
    });

    // Labels
    ctx.fillStyle = T.tx2; ctx.font = '7px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('IS', 15, startY + barH / 2 + 2);
    ctx.fillText('OOS', 15, startY + barH + barH / 2 + 4);
    ctx.fillText('Eff', 15, startY + barH * 2 + 14 + 30);

    // 50% line
    const effY = startY + barH * 2 + 14;
    ctx.strokeStyle = `${T.warn}60`; ctx.lineWidth = 0.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(20, effY + 25); ctx.lineTo(W - 5, effY + 25); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.warn; ctx.font = '6px monospace'; ctx.fillText('50%', W - 2, effY + 23);
  }, [windows]);
  return <canvas ref={ref} style={{ width: '100%', height: 160, borderRadius: T.r }} />;
}

function ParamDriftCanvas({ stability }: { stability: ParamStability[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 400, H = 150;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const colors = [T.brand, T.up, T.warn, T.dn, T.purple];
    const pad = { l: 30, r: 10, t: 15, b: 20 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;

    stability.forEach((param, pi) => {
      if (pi > 4) return;
      const mn = Math.min(...param.values) * 0.9;
      const mx = Math.max(...param.values) * 1.1;
      const rng = mx - mn || 1;
      ctx.strokeStyle = colors[pi]; ctx.lineWidth = 1;
      ctx.beginPath();
      param.values.forEach((v, i) => {
        const x = pad.l + (i / (param.values.length - 1)) * plotW;
        const y = pad.t + (1 - (v - mn) / rng) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Legend
    stability.slice(0, 5).forEach((p, i) => {
      const x = pad.l + i * 75; const y = H - 4;
      ctx.fillStyle = colors[i]; ctx.fillRect(x, y - 4, 8, 4);
      ctx.fillStyle = T.tx3; ctx.font = '6px monospace'; ctx.textAlign = 'left';
      ctx.fillText(p.name, x + 11, y);
    });
  }, [stability]);
  return <canvas ref={ref} style={{ width: '100%', height: 150, borderRadius: T.r }} />;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type WFTab = 'timeline' | 'results' | 'params' | 'summary';

export default function WalkForwardV2UI2() {
  const [tab, setTab] = useState<WFTab>('timeline');
  const windows = useMemo(() => generateWindows(), []);
  const stability = useMemo(() => generateParamStability(windows), [windows]);
  const avgEff = windows.reduce((s, w) => s + w.efficiency, 0) / windows.length;
  const passRate = windows.filter(w => w.status === 'pass').length / windows.length;

  return (
    <div data-testid="walk-forward-v2-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>WALK-FORWARD OPTIMIZATION V2</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Windows: <span style={{ color: T.tx0 }}>{windows.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Avg Eff: <span style={{ color: avgEff > 0.5 ? T.up : T.warn }}>{(avgEff * 100).toFixed(1)}%</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Pass: <span style={{ color: passRate > 0.5 ? T.up : T.dn }}>{(passRate * 100).toFixed(0)}%</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'timeline' as WFTab, label: '📊 Timeline' },
          { key: 'results' as WFTab, label: '📋 Results' },
          { key: 'params' as WFTab, label: '🔧 Param Stability' },
          { key: 'summary' as WFTab, label: '📈 Summary' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'timeline' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>WF Efficiency Timeline</div>
            <WFTimelineCanvas windows={windows} />
          </div>
        )}
        {tab === 'results' && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Window Results</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                  {['#', 'IS Period', 'OOS Period', 'IS Sharpe', 'OOS Sharpe', 'IS Ret', 'OOS Ret', 'Efficiency', 'Status'].map(h => (
                    <th key={h} style={{ padding: '3px 4px', color: T.tx3, fontWeight: 600, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {windows.map(w => (
                  <tr key={w.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right' }}>{w.id}</td>
                    <td style={{ padding: '3px 4px', color: T.brand, textAlign: 'right', fontSize: '7px' }}>{w.isStart} → {w.isEnd}</td>
                    <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right', fontSize: '7px' }}>{w.oosStart} → {w.oosEnd}</td>
                    <td style={{ padding: '3px 4px', color: T.info, textAlign: 'right' }}>{w.isSharpe.toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: w.oosSharpe > 0.5 ? T.up : T.dn, textAlign: 'right', fontWeight: 700 }}>{w.oosSharpe.toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: T.up, textAlign: 'right' }}>+{w.isReturn.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: w.oosReturn > 0 ? T.up : T.dn, textAlign: 'right' }}>{w.oosReturn > 0 ? '+' : ''}{w.oosReturn.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: w.efficiency > 0.5 ? T.up : T.warn, textAlign: 'right' }}>{(w.efficiency * 100).toFixed(0)}%</td>
                    <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                      <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px',
                        background: w.status === 'pass' ? `${T.up}20` : w.status === 'marginal' ? `${T.warn}20` : `${T.dn}20`,
                        color: w.status === 'pass' ? T.up : w.status === 'marginal' ? T.warn : T.dn }}>
                        {w.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'params' && (
          <div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Parameter Drift Across Windows</div>
              <ParamDriftCanvas stability={stability} />
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Stability Analysis</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                    {['Parameter', 'Mean', 'Std', 'CV', 'Min', 'Max', 'Stable'].map(h => (
                      <th key={h} style={{ padding: '3px 6px', color: T.tx3, fontWeight: 600, textAlign: 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stability.map(p => (
                    <tr key={p.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '3px 6px', color: T.brand, textAlign: 'left', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '3px 6px', color: T.tx0, textAlign: 'right' }}>{p.mean.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right' }}>{p.std.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', color: p.cv < 0.2 ? T.up : T.warn, textAlign: 'right' }}>{(p.cv * 100).toFixed(1)}%</td>
                      <td style={{ padding: '3px 6px', color: T.tx3, textAlign: 'right' }}>{Math.min(...p.values).toFixed(1)}</td>
                      <td style={{ padding: '3px 6px', color: T.tx3, textAlign: 'right' }}>{Math.max(...p.values).toFixed(1)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                        <span style={{ color: p.stable ? T.up : T.dn, fontWeight: 700 }}>{p.stable ? '✓' : '✗'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'summary' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Total Windows', value: String(windows.length), color: T.tx0 },
              { label: 'Pass Rate', value: `${(passRate * 100).toFixed(0)}%`, color: passRate > 0.6 ? T.up : T.warn },
              { label: 'Avg IS Sharpe', value: (windows.reduce((s, w) => s + w.isSharpe, 0) / windows.length).toFixed(2), color: T.info },
              { label: 'Avg OOS Sharpe', value: (windows.reduce((s, w) => s + w.oosSharpe, 0) / windows.length).toFixed(2), color: T.up },
              { label: 'Avg Efficiency', value: `${(avgEff * 100).toFixed(1)}%`, color: avgEff > 0.5 ? T.up : T.warn },
              { label: 'Stable Params', value: `${stability.filter(s => s.stable).length}/${stability.length}`, color: T.brand },
              { label: 'Comb OOS Return', value: `${windows.reduce((s, w) => s + w.oosReturn, 0).toFixed(1)}%`, color: T.up },
              { label: 'Robustness Grade', value: passRate > 0.7 ? 'A' : passRate > 0.5 ? 'B' : 'C', color: passRate > 0.7 ? T.up : T.warn },
            ].map(s => (
              <div key={s.label} style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: T.tx3, marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: s.color, fontFamily: T.mono }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { WalkForwardV2UI2 };
