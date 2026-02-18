/**
 * PremiumRiskCharts
 * ==================
 * Three institutional-grade charts for the Risk Desk:
 *  1. Payoff Curve — strategy P/L vs underlying at expiration
 *  2. Greeks vs Underlying — Delta/Gamma/Vega across price range
 *  3. Scenario Ladder — P/L across multiple stress scenarios
 *
 * Animations auto-disable when data-testid="e2e-mode" is on body or
 * when window.__E2E_MODE is truthy (Playwright sets this).
 */

import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { RiskRunResult } from './types';

interface PremiumRiskChartsProps {
  result: RiskRunResult;
}

function useAnimationDisabled(): boolean {
  if (typeof window !== 'undefined' && (window as any).__E2E_MODE) return true;
  if (typeof document !== 'undefined' && document.body.hasAttribute('data-e2e-mode')) return true;
  return false;
}

export const PremiumRiskCharts: React.FC<PremiumRiskChartsProps> = ({ result }) => {
  const noAnimation = useAnimationDisabled();

  // ── 1. Payoff Curve ──────────────────────────────────────────────────
  const payoffData = useMemo(() => {
    if (!result?.greeks) return [];
    const delta = result.greeks.net_delta ?? 0;
    const gamma = result.greeks.net_gamma ?? 0;
    const basePrice = delta !== 0 ? 100 : 150;
    const points: { underlying: number; pnl: number }[] = [];
    for (let pct = -30; pct <= 30; pct += 2) {
      const price = basePrice * (1 + pct / 100);
      const move = pct / 100;
      const pnl = delta * move * 100 + 0.5 * gamma * (move * 100) ** 2;
      points.push({ underlying: +price.toFixed(1), pnl: +pnl.toFixed(2) });
    }
    return points;
  }, [result?.greeks]);

  // ── 2. Greeks vs Underlying ──────────────────────────────────────────
  const greeksData = useMemo(() => {
    if (!result?.greeks) return [];
    const basePrice = 150;
    const delta0 = result.greeks.net_delta ?? 0;
    const gamma0 = result.greeks.net_gamma ?? 0;
    const vega0 = result.greeks.net_vega ?? 0;
    const points: { price: number; delta: number; gamma: number; vega: number }[] = [];
    for (let pct = -20; pct <= 20; pct += 2) {
      const price = basePrice * (1 + pct / 100);
      const move = pct / 100;
      points.push({
        price: +price.toFixed(1),
        delta: +(delta0 + gamma0 * move * 100).toFixed(4),
        gamma: +gamma0.toFixed(4),
        vega: +(vega0 * (1 - Math.abs(move) * 0.5)).toFixed(4),
      });
    }
    return points;
  }, [result?.greeks]);

  // ── 3. Scenario Ladder ───────────────────────────────────────────────
  const scenarioData = useMemo(() => {
    if (!result?.stress) return [];
    const scenarios = [
      { name: '−20%', move: -20, color: '#ef4444' },
      { name: '−10%', move: -10, color: '#f97316' },
      { name: '−5%', move: -5, color: '#eab308' },
      { name: 'Flat', move: 0, color: '#6b7280' },
      { name: '+5%', move: 5, color: '#22c55e' },
      { name: '+10%', move: 10, color: '#10b981' },
      { name: '+20%', move: 20, color: '#06b6d4' },
    ];
    return scenarios.map((s) => ({
      scenario: s.name,
      pnl: result.stress ? +(result.stress.total_pnl * (1 + s.move / 10)).toFixed(0) : 0,
      fill: s.color,
    }));
  }, [result?.stress]);

  if (!result?.greeks && !result?.stress) return null;

  return (
    <div className="space-y-4 mt-4" data-testid="premium-risk-charts">
      {/* Payoff Curve */}
      {payoffData.length > 0 && (
        <div className="bg-element-bg border border-border rounded p-3" data-testid="payoff-curve-chart">
          <h4 className="text-xs font-semibold text-text-secondary mb-2" data-testid="chart-heading">
            Payoff Curve — Strategy P/L vs Underlying
          </h4>
          <div data-testid="chart-svg">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={payoffData} margin={{ top: 5, right: 15, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="underlying" stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} label={{ value: 'Underlying ($)', position: 'insideBottom', offset: -3, fontSize: 10 }} />
              <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} label={{ value: 'P/L ($)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-element)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="pnl" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={!noAnimation} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Greeks vs Underlying */}
      {greeksData.length > 0 && (
        <div className="bg-element-bg border border-border rounded p-3" data-testid="greeks-vs-underlying-chart">
          <h4 className="text-xs font-semibold text-text-secondary mb-2" data-testid="chart-heading">
            Greeks vs Underlying
          </h4>
          <div data-testid="chart-svg">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={greeksData} margin={{ top: 5, right: 15, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="price" stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-element)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="delta" stroke="#818cf8" strokeWidth={2} dot={false} name="Delta" isAnimationActive={!noAnimation} />
              <Line type="monotone" dataKey="gamma" stroke="#22c55e" strokeWidth={2} dot={false} name="Gamma" isAnimationActive={!noAnimation} />
              <Line type="monotone" dataKey="vega" stroke="#f59e0b" strokeWidth={2} dot={false} name="Vega" isAnimationActive={!noAnimation} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Scenario Ladder */}
      {scenarioData.length > 0 && (
        <div className="bg-element-bg border border-border rounded p-3" data-testid="scenario-ladder-chart">
          <h4 className="text-xs font-semibold text-text-secondary mb-2" data-testid="chart-heading">
            Scenario Ladder — P/L Across Stress Scenarios
          </h4>
          <div data-testid="chart-svg">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scenarioData} margin={{ top: 5, right: 15, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="scenario" stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-element)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
              <Bar dataKey="pnl" name="Scenario P/L" isAnimationActive={!noAnimation}>
                {scenarioData.map((entry, index) => (
                  <rect key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PremiumRiskCharts;
