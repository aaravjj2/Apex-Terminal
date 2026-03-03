/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Strategy Robustness Testing (UI2)                  │
 * │  Multi-dimensional robustness: parameter sensitivity, Monte Carlo   │
 * │  permutation, regime analysis, slippage stress, data perturbation   │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

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
interface RobustnessTest {
  name: string;
  description: string;
  baselineSharpe: number;
  degradedSharpe: number;
  degradation: number;
  pValue: number;
  status: 'pass' | 'warn' | 'fail';
  details: string;
}

interface ParameterSensitivity {
  param: string;
  values: number[];
  sharpes: number[];
  returns: number[];
  bestValue: number;
  sensitivity: number; // 0-1, higher = more sensitive
}

/* ── Mock ─────────────────────────────────────────────────────────────── */
function generateTests(): RobustnessTest[] {
  return [
    { name: 'Parameter Stability', description: 'Test performance with ±20% parameter perturbation', baselineSharpe: 1.85, degradedSharpe: 1.52, degradation: 17.8, pValue: 0.045, status: 'pass', details: '1000 random parameter combinations tested. 82% maintain positive Sharpe.' },
    { name: 'Monte Carlo Permutation', description: 'Shuffle trade returns to test significance', baselineSharpe: 1.85, degradedSharpe: 0.12, degradation: 93.5, pValue: 0.002, status: 'pass', details: '10000 permutations. Strategy Sharpe exceeds 99.8% of random shuffles.' },
    { name: 'Walk-Forward Consistency', description: 'Rolling OOS windows performance', baselineSharpe: 1.85, degradedSharpe: 1.15, degradation: 37.8, pValue: 0.032, status: 'warn', details: '12 quarterly windows. 75% show positive OOS returns. Avg efficiency: 62%.' },
    { name: 'Regime Robustness', description: 'Performance across bull/bear/sideways regimes', baselineSharpe: 1.85, degradedSharpe: 0.95, degradation: 48.6, pValue: 0.018, status: 'warn', details: 'Bull: 2.1, Bear: 0.45, Sideways: 1.2. Significant underperformance in bear markets.' },
    { name: 'Transaction Cost Stress', description: 'Impact of 2x-5x slippage and commissions', baselineSharpe: 1.85, degradedSharpe: 1.35, degradation: 27.0, pValue: 0.065, status: 'pass', details: 'At 3x costs: Sharpe=1.35. At 5x costs: Sharpe=0.85. Break-even at 7.2x.' },
    { name: 'Data Snooping (White Reality Check)', description: 'Adjust for multiple testing bias', baselineSharpe: 1.85, degradedSharpe: 1.40, degradation: 24.3, pValue: 0.038, status: 'pass', details: 'SPA Test p=0.038. Strategy survives data snooping correction for 50 alternatives.' },
    { name: 'Overnight Gap Removal', description: 'Intraday-only performance', baselineSharpe: 1.85, degradedSharpe: 0.60, degradation: 67.6, pValue: 0.12, status: 'fail', details: 'Strategy heavily relies on overnight gaps. Intraday-only Sharpe drops to 0.60.' },
    { name: 'Sector Concentration', description: 'Test with sector-neutral constraint', baselineSharpe: 1.85, degradedSharpe: 1.45, degradation: 21.6, pValue: 0.054, status: 'pass', details: 'Sector-neutral version retains 78% of returns. No single sector drives performance.' },
    { name: 'Market Cap Filter', description: 'Performance across cap-weight quintiles', baselineSharpe: 1.85, degradedSharpe: 1.20, degradation: 35.1, pValue: 0.041, status: 'warn', details: 'Large-cap: 1.6, Mid-cap: 1.2, Small-cap: 0.8. Performance declines with liquidity.' },
    { name: 'Survivorship Bias Check', description: 'Include delisted stocks', baselineSharpe: 1.85, degradedSharpe: 1.55, degradation: 16.2, pValue: 0.082, status: 'pass', details: '145 delisted stocks added. Performance reduction of 16%. Acceptable level.' },
  ];
}

function generateParamSensitivity(): ParameterSensitivity[] {
  return [
    { param: 'lookbackPeriod', values: [5, 10, 15, 20, 25, 30, 35, 40, 50, 60], sharpes: [0.8, 1.2, 1.5, 1.85, 1.75, 1.6, 1.4, 1.3, 1.1, 0.9], returns: [8, 12, 16, 22, 20, 18, 15, 13, 10, 8], bestValue: 20, sensitivity: 0.35 },
    { param: 'entryThreshold', values: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0], sharpes: [0.5, 0.9, 1.4, 1.85, 1.7, 1.3, 0.8, 0.4], returns: [5, 10, 15, 22, 19, 14, 9, 4], bestValue: 2.0, sensitivity: 0.65 },
    { param: 'stopLoss', values: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0], sharpes: [0.3, 0.8, 1.4, 1.85, 1.8, 1.65, 1.3, 1.0], returns: [3, 8, 14, 22, 21, 18, 14, 10], bestValue: 2.0, sensitivity: 0.45 },
    { param: 'positionSize', values: [0.5, 1.0, 2.0, 3.0, 5.0, 7.0, 10.0], sharpes: [1.85, 1.85, 1.82, 1.75, 1.5, 1.1, 0.6], returns: [5, 11, 22, 30, 42, 45, 38], bestValue: 2.0, sensitivity: 0.28 },
    { param: 'exitPeriod', values: [3, 5, 7, 10, 15, 20, 30], sharpes: [1.2, 1.5, 1.75, 1.85, 1.7, 1.4, 0.9], returns: [10, 14, 18, 22, 20, 15, 8], bestValue: 10, sensitivity: 0.38 },
  ];
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
function SensitivityHeatmap({ data }: { data: ParameterSensitivity[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 500, H = 200;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const padL = 80; const padT = 20; const padR = 10; const padB = 10;
    const plotW = W - padL - padR;
    const rowH = (H - padT - padB) / data.length;

    data.forEach((param, pi) => {
      const y = padT + pi * rowH;
      // Label
      ctx.fillStyle = T.tx1; ctx.font = '8px monospace'; ctx.textAlign = 'right';
      ctx.fillText(param.param, padL - 5, y + rowH / 2 + 3);
      // Heatmap cells
      const maxS = Math.max(...param.sharpes);
      const cellW = plotW / param.values.length;
      param.sharpes.forEach((s, vi) => {
        const x = padL + vi * cellW;
        const intensity = s / maxS;
        const r = Math.round(239 * (1 - intensity) + 38 * intensity);
        const g = Math.round(83 * (1 - intensity) + 166 * intensity);
        const b = Math.round(80 * (1 - intensity) + 154 * intensity);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + 1, y + 1, cellW - 2, rowH - 2);
        // Value
        ctx.fillStyle = intensity > 0.5 ? '#000' : '#FFF'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
        ctx.fillText(s.toFixed(1), x + cellW / 2, y + rowH / 2 + 3);
      });
    });
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 200, borderRadius: T.r }} />;
}

function DegradationChart({ tests }: { tests: RobustnessTest[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = 500, H = 180;
    c.width = W * 2; c.height = H * 2; ctx.scale(2, 2);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = T.bg2; ctx.fillRect(0, 0, W, H);

    const barW = (W - 20) / tests.length;
    const maxD = 100;

    tests.forEach((t, i) => {
      const x = 10 + i * barW;
      const barH = (t.degradation / maxD) * (H - 30);
      const y = H - 15 - barH;
      ctx.fillStyle = t.status === 'pass' ? `${T.up}80` : t.status === 'warn' ? `${T.warn}80` : `${T.dn}80`;
      ctx.fillRect(x + 2, y, barW - 4, barH);
      // Label
      ctx.save(); ctx.translate(x + barW / 2, H - 3); ctx.rotate(-0.5);
      ctx.fillStyle = T.tx3; ctx.font = '6px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(t.name.slice(0, 12), 0, 0); ctx.restore();
      // Value
      ctx.fillStyle = T.tx0; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${t.degradation.toFixed(0)}%`, x + barW / 2, y - 4);
    });

    // 30% threshold
    const threshY = H - 15 - (30 / maxD) * (H - 30);
    ctx.strokeStyle = `${T.warn}60`; ctx.lineWidth = 0.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(5, threshY); ctx.lineTo(W - 5, threshY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.warn; ctx.font = '7px monospace'; ctx.textAlign = 'right';
    ctx.fillText('30% threshold', W - 5, threshY - 3);
  }, [tests]);
  return <canvas ref={ref} style={{ width: '100%', height: 180, borderRadius: T.r }} />;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
type RobTab = 'overview' | 'tests' | 'sensitivity' | 'score';

export default function RobustnessUI2() {
  const [tab, setTab] = useState<RobTab>('overview');
  const tests = useMemo(() => generateTests(), []);
  const sensitivity = useMemo(() => generateParamSensitivity(), []);
  const passCount = tests.filter(t => t.status === 'pass').length;
  const overallScore = Math.round((passCount / tests.length) * 100);

  return (
    <div data-testid="robustness-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>ROBUSTNESS TESTING</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Tests: <span style={{ color: T.tx0 }}>{tests.length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Pass: <span style={{ color: T.up }}>{passCount}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Warn: <span style={{ color: T.warn }}>{tests.filter(t => t.status === 'warn').length}</span></span>
        <span style={{ fontSize: '8px', fontFamily: T.mono, color: T.tx3 }}>Fail: <span style={{ color: T.dn }}>{tests.filter(t => t.status === 'fail').length}</span></span>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg1, flexShrink: 0 }}>
        {([
          { key: 'overview' as RobTab, label: '📊 Overview' },
          { key: 'tests' as RobTab, label: '🧪 Tests' },
          { key: 'sensitivity' as RobTab, label: '📉 Sensitivity' },
          { key: 'score' as RobTab, label: '🎯 Score' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? T.bg3 : 'transparent', color: tab === t.key ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 14px', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
            borderBottom: tab === t.key ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'overview' && (
          <div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Performance Degradation by Test</div>
              <DegradationChart tests={tests} />
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Quick Results</div>
              {tests.map(t => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: '10px', color: t.status === 'pass' ? T.up : t.status === 'warn' ? T.warn : T.dn }}>{t.status === 'pass' ? '✓' : t.status === 'warn' ? '⚠' : '✗'}</span>
                  <span style={{ fontSize: '8px', color: T.tx0, fontWeight: 600, flex: 1 }}>{t.name}</span>
                  <span style={{ fontSize: '8px', fontFamily: T.mono, color: t.degradation < 30 ? T.up : t.degradation < 50 ? T.warn : T.dn }}>{t.degradation.toFixed(1)}% deg.</span>
                  <span style={{ fontSize: '7px', fontFamily: T.mono, color: T.tx3 }}>p={t.pValue.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'tests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tests.map(t => (
              <div key={t.name} style={{ background: T.bg1, border: `1px solid ${t.status === 'pass' ? `${T.up}30` : t.status === 'warn' ? `${T.warn}30` : `${T.dn}30`}`, borderRadius: T.r, padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>{t.name}</div>
                  <span style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '2px', fontWeight: 700,
                    background: t.status === 'pass' ? `${T.up}20` : t.status === 'warn' ? `${T.warn}20` : `${T.dn}20`,
                    color: t.status === 'pass' ? T.up : t.status === 'warn' ? T.warn : T.dn }}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '8px', color: T.tx3, marginBottom: '4px' }}>{t.description}</div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '8px', fontFamily: T.mono, marginBottom: '4px' }}>
                  <span style={{ color: T.tx2 }}>Baseline: <span style={{ color: T.tx0 }}>{t.baselineSharpe}</span></span>
                  <span style={{ color: T.tx2 }}>Degraded: <span style={{ color: t.degradedSharpe < 0.5 ? T.dn : T.warn }}>{t.degradedSharpe}</span></span>
                  <span style={{ color: T.tx2 }}>Δ: <span style={{ color: T.dn }}>-{t.degradation.toFixed(1)}%</span></span>
                  <span style={{ color: T.tx2 }}>p-value: <span style={{ color: t.pValue < 0.05 ? T.up : T.warn }}>{t.pValue.toFixed(3)}</span></span>
                </div>
                <div style={{ fontSize: '7px', color: T.tx2, background: T.bg2, padding: '4px', borderRadius: T.r }}>{t.details}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'sensitivity' && (
          <div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Parameter Sensitivity Heatmap (Sharpe)</div>
              <SensitivityHeatmap data={sensitivity} />
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.tx0, marginBottom: '6px' }}>Parameter Details</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
                    {['Parameter', 'Best Value', 'Sensitivity', 'Sharpe Range', 'Return Range', 'Grade'].map(h => (
                      <th key={h} style={{ padding: '3px 6px', color: T.tx3, fontWeight: 600, textAlign: 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.map(p => (
                    <tr key={p.param} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '3px 6px', color: T.brand, textAlign: 'left', fontWeight: 600 }}>{p.param}</td>
                      <td style={{ padding: '3px 6px', color: T.tx0, textAlign: 'right' }}>{p.bestValue}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          <div style={{ width: 40, height: 4, background: T.bg3, borderRadius: 2 }}>
                            <div style={{ width: `${p.sensitivity * 100}%`, height: '100%', background: p.sensitivity > 0.5 ? T.dn : T.up, borderRadius: 2 }} />
                          </div>
                          <span style={{ color: p.sensitivity > 0.5 ? T.dn : T.up }}>{(p.sensitivity * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right' }}>{Math.min(...p.sharpes).toFixed(1)} - {Math.max(...p.sharpes).toFixed(1)}</td>
                      <td style={{ padding: '3px 6px', color: T.tx2, textAlign: 'right' }}>{Math.min(...p.returns).toFixed(0)} - {Math.max(...p.returns).toFixed(0)}%</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: p.sensitivity < 0.3 ? T.up : p.sensitivity < 0.5 ? T.warn : T.dn }}>
                          {p.sensitivity < 0.3 ? 'A' : p.sensitivity < 0.5 ? 'B' : 'C'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'score' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
            <div style={{ textAlign: 'center', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '30px 50px' }}>
              <div style={{ fontSize: '14px', color: T.tx3, marginBottom: '8px' }}>Robustness Score</div>
              <div style={{ fontSize: '48px', fontWeight: 900, color: overallScore > 70 ? T.up : overallScore > 50 ? T.warn : T.dn, fontFamily: T.mono }}>{overallScore}</div>
              <div style={{ fontSize: '10px', color: T.tx2, marginTop: '4px' }}>{overallScore > 70 ? 'ROBUST — Ready for deployment' : overallScore > 50 ? 'MODERATE — Needs improvement' : 'FRAGILE — Do not deploy'}</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
                {['pass', 'warn', 'fail'].map(s => (
                  <div key={s} style={{ padding: '4px 10px', borderRadius: T.r, background: s === 'pass' ? `${T.up}20` : s === 'warn' ? `${T.warn}20` : `${T.dn}20`, fontSize: '8px', fontFamily: T.mono }}>
                    <span style={{ color: s === 'pass' ? T.up : s === 'warn' ? T.warn : T.dn, fontWeight: 700 }}>
                      {tests.filter(t => t.status === s).length} {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { RobustnessUI2 };
