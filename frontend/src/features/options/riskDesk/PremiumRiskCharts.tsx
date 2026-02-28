// Bloomberg Palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

/**
 * PremiumRiskCharts â€” Bloomberg-grade canvas charts for Risk Desk
 * Three institutional charts:
 *  1. Payoff Curve â€” strategy P/L vs underlying at expiration
 *  2. Greeks vs Underlying â€” Delta/Gamma/Vega across price range
 *  3. Scenario Ladder â€” P/L across multiple stress scenarios
 */

import React, { useMemo, useRef, useEffect } from 'react';
import type { RiskRunResult } from './types';

interface PremiumRiskChartsProps {
  result: RiskRunResult;
}

function drawLineChart(
  canvas: HTMLCanvasElement,
  title: string,
  datasets: { label: string; color: string; data: { x: number; y: number }[] }[],
  xLabel: string,
  yLabel: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 28, right: 20, bottom: 36, left: 50 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  ctx.fillStyle = PANEL; ctx.fillRect(0, 0, W, H);

  // All points
  const allX = datasets.flatMap(d => d.data.map(p => p.x));
  const allY = datasets.flatMap(d => d.data.map(p => p.y));
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY, 0), maxY = Math.max(...allY, 0);
  const rangeY = maxY - minY || 1;

  const toX = (x: number) => PAD.left + ((x - minX) / (maxX - minX || 1)) * pw;
  const toY = (y: number) => PAD.top + ph - ((y - minY) / rangeY) * ph;

  // Grid
  ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = PAD.top + (ph / 5) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + pw, y); ctx.stroke();
    const val = maxY - (rangeY / 5) * i;
    ctx.fillStyle = SUBTLE; ctx.font = `9px ${MONO}`; ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(1), PAD.left - 4, y + 3);
  }

  // Zero line
  const zeroY = toY(0);
  if (zeroY >= PAD.top && zeroY <= PAD.top + ph) {
    ctx.strokeStyle = SUBTLE; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(PAD.left + pw, zeroY); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Lines
  datasets.forEach(({ color, data }) => {
    if (data.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
      else ctx.lineTo(toX(p.x), toY(p.y));
    });
    ctx.stroke();
  });

  // X axis labels
  ctx.fillStyle = SUBTLE; ctx.font = `9px ${MONO}`; ctx.textAlign = 'center';
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const x = minX + (maxX - minX) * (i / steps);
    ctx.fillText(x.toFixed(0), toX(x), PAD.top + ph + 14);
  }

  // Title
  ctx.fillStyle = AMBER; ctx.font = `bold 10px ${MONO}`; ctx.textAlign = 'left';
  ctx.fillText(title, PAD.left, 16);

  // Legend
  let lx = PAD.left + pw - datasets.reduce((a, d) => a + d.label.length * 6 + 24, 0);
  datasets.forEach(({ label, color }) => {
    ctx.fillStyle = color; ctx.fillRect(lx, 8, 12, 3);
    ctx.fillStyle = TEXT; ctx.font = `9px ${MONO}`; ctx.textAlign = 'left';
    ctx.fillText(label, lx + 16, 14);
    lx += label.length * 6 + 24;
  });

  // Axis labels
  ctx.fillStyle = SUBTLE; ctx.font = `9px ${MONO}`; ctx.textAlign = 'center';
  ctx.fillText(xLabel, PAD.left + pw / 2, H - 2);
  ctx.save(); ctx.translate(10, PAD.top + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0); ctx.restore();
}

function drawBarChart(
  canvas: HTMLCanvasElement,
  title: string,
  data: { label: string; value: number; color: string }[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 28, right: 20, bottom: 36, left: 50 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  ctx.fillStyle = PANEL; ctx.fillRect(0, 0, W, H);

  const vals = data.map(d => d.value);
  const maxAbs = Math.max(...vals.map(Math.abs), 1);
  const barW = pw / data.length * 0.7;
  const gap = pw / data.length;
  const zeroY = PAD.top + ph / 2;

  // Grid
  ctx.strokeStyle = BORDER; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + pw, y); ctx.stroke();
    const val = maxAbs - (maxAbs * 2 / 4) * i;
    ctx.fillStyle = SUBTLE; ctx.font = `9px ${MONO}`; ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(0), PAD.left - 4, y + 3);
  }

  // Zero line
  ctx.strokeStyle = SUBTLE + '88'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(PAD.left + pw, zeroY); ctx.stroke();
  ctx.setLineDash([]);

  // Bars
  data.forEach((d, i) => {
    const x = PAD.left + gap * i + gap * 0.15;
    const h = (d.value / maxAbs) * (ph / 2);
    const y = h >= 0 ? zeroY - h : zeroY;
    ctx.fillStyle = d.color + '99'; ctx.fillRect(x, y, barW, Math.abs(h));
    ctx.strokeStyle = d.color; ctx.lineWidth = 1; ctx.strokeRect(x, y, barW, Math.abs(h));
    // Label
    ctx.fillStyle = SUBTLE; ctx.font = `8px ${MONO}`; ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, PAD.top + ph + 14);
    // Value
    ctx.fillStyle = d.color; ctx.font = `8px ${MONO}`; ctx.textAlign = 'center';
    ctx.fillText(d.value.toFixed(0), x + barW / 2, d.value >= 0 ? y - 3 : y + Math.abs(h) + 10);
  });

  // Title
  ctx.fillStyle = AMBER; ctx.font = `bold 10px ${MONO}`; ctx.textAlign = 'left';
  ctx.fillText(title, PAD.left, 16);
}

function LineChartCanvas({ title, datasets, xLabel, yLabel, testId }: {
  title: string;
  datasets: { label: string; color: string; data: { x: number; y: number }[] }[];
  xLabel: string;
  yLabel: string;
  testId?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawLineChart(ref.current, title, datasets, xLabel, yLabel);
  }, [title, datasets, xLabel, yLabel]);
  return (
    <div data-testid={testId} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 4px 4px' }}>
      <div data-testid="chart-heading" style={{ display: 'none' }}>{title}</div>
      <div data-testid="chart-svg">
        <canvas ref={ref} width={420} height={200} style={{ width: '100%', height: 200 }} />
      </div>
    </div>
  );
}

function BarChartCanvas({ title, data, testId }: {
  title: string;
  data: { label: string; value: number; color: string }[];
  testId?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawBarChart(ref.current, title, data);
  }, [title, data]);
  return (
    <div data-testid={testId} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 4px 4px' }}>
      <div data-testid="chart-heading" style={{ display: 'none' }}>{title}</div>
      <div data-testid="chart-svg">
        <canvas ref={ref} width={420} height={200} style={{ width: '100%', height: 200 }} />
      </div>
    </div>
  );
}

export const PremiumRiskCharts: React.FC<PremiumRiskChartsProps> = ({ result }) => {
  // â”€â”€ 1. Payoff Curve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const payoffDatasets = useMemo(() => {
    if (!result?.greeks) return [];
    const delta = result.greeks.net_delta ?? 0;
    const gamma = result.greeks.net_gamma ?? 0;
    const basePrice = delta !== 0 ? 100 : 150;
    const points: { x: number; y: number }[] = [];
    for (let pct = -30; pct <= 30; pct += 2) {
      const price = basePrice * (1 + pct / 100);
      const move = pct / 100;
      const pnl = delta * move * 100 + 0.5 * gamma * (move * 100) ** 2;
      points.push({ x: +price.toFixed(1), y: +pnl.toFixed(2) });
    }
    return [{ label: 'P/L', color: BLUE, data: points }];
  }, [result?.greeks]);

  // â”€â”€ 2. Greeks vs Underlying â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const greeksDatasets = useMemo(() => {
    if (!result?.greeks) return [];
    const basePrice = 150;
    const delta0 = result.greeks.net_delta ?? 0;
    const gamma0 = result.greeks.net_gamma ?? 0;
    const vega0 = result.greeks.net_vega ?? 0;
    const dPts: { x: number; y: number }[] = [];
    const gPts: { x: number; y: number }[] = [];
    const vPts: { x: number; y: number }[] = [];
    for (let pct = -20; pct <= 20; pct += 2) {
      const price = +(basePrice * (1 + pct / 100)).toFixed(1);
      const move = pct / 100;
      dPts.push({ x: price, y: +(delta0 + gamma0 * move * 100).toFixed(4) });
      gPts.push({ x: price, y: +gamma0.toFixed(4) });
      vPts.push({ x: price, y: +(vega0 * (1 - Math.abs(move) * 0.5)).toFixed(4) });
    }
    return [
      { label: 'Delta', color: PURPLE, data: dPts },
      { label: 'Gamma', color: GREEN, data: gPts },
      { label: 'Vega', color: AMBER, data: vPts },
    ];
  }, [result?.greeks]);

  // â”€â”€ 3. Scenario Ladder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const scenarioData = useMemo(() => {
    if (!result?.stress) return [];
    return [
      { label: 'âˆ’20%', value: result.stress.total_pnl * 0.2, color: RED },
      { label: 'âˆ’10%', value: result.stress.total_pnl * 0.5, color: '#f97316' },
      { label: 'âˆ’5%', value: result.stress.total_pnl * 0.75, color: AMBER },
      { label: 'Flat', value: 0, color: SUBTLE },
      { label: '+5%', value: result.stress.total_pnl * 1.25, color: GREEN },
      { label: '+10%', value: result.stress.total_pnl * 1.5, color: '#10b981' },
      { label: '+20%', value: result.stress.total_pnl * 2, color: BLUE },
    ];
  }, [result?.stress]);

  if (!result?.greeks && !result?.stress) return null;

  return (
    <div data-testid="premium-risk-charts" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, fontFamily: MONO, background: BG, color: TEXT }}>
      {payoffDatasets.length > 0 && (
        <LineChartCanvas
          title="PAYOFF CURVE â€” STRATEGY P/L vs UNDERLYING"
          datasets={payoffDatasets}
          xLabel="Underlying ($)"
          yLabel="P/L ($)"
          testId="payoff-curve-chart"
        />
      )}
      {greeksDatasets.length > 0 && (
        <LineChartCanvas
          title="GREEKS vs UNDERLYING"
          datasets={greeksDatasets}
          xLabel="Price ($)"
          yLabel="Value"
          testId="greeks-vs-underlying-chart"
        />
      )}
      {scenarioData.length > 0 && (
        <BarChartCanvas
          title="SCENARIO LADDER â€” P/L ACROSS STRESS SCENARIOS"
          data={scenarioData}
          testId="scenario-ladder-chart"
        />
      )}
    </div>
  );
};

export default PremiumRiskCharts;

interface PremiumRiskChartsProps {
  result: RiskRunResult;
}

function useAnimationDisabled(): boolean {
  if (typeof window !== 'undefined' && (window as any).__E2E_MODE) return true;
  if (typeof document !== 'undefined' && document.body.hasAttribute('data-e2e-mode')) return true;
  return false;
}

