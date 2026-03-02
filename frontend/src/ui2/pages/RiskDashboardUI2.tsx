/**
 * RiskDashboardUI2.tsx — Bloomberg RISKMON / Risk Management Dashboard
 * =====================================================================
 * Comprehensive risk dashboard with:
 * - Real-time VaR / CVaR gauges
 * - Exposure breakdown by asset class, region, sector
 * - Stress test scenarios
 * - Correlation heatmap (Canvas)
 * - Concentration risk indicators
 * - Limit utilization bars
 * - Risk factor decomposition
 * - Bloomberg dark theme
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff9800';
const TEAL = '#4db6ac';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Types ────────────────────────────────────────────────────────────────────
interface RiskMetric {
  label: string;
  value: number;
  limit: number;
  unit: string;
  status: 'normal' | 'warning' | 'breach';
}

interface StressScenario {
  name: string;
  description: string;
  portfolioImpact: number;
  varImpact: number;
  probability: number;
}

interface Exposure {
  name: string;
  gross: number;
  net: number;
  limit: number;
  color: string;
}

// ── Mock data ────────────────────────────────────────────────────────────────
function generateRiskMetrics(): RiskMetric[] {
  return [
    { label: '1-Day VaR (95%)', value: 2.34, limit: 3.0, unit: '%', status: 'normal' },
    { label: '1-Day VaR (99%)', value: 3.87, limit: 5.0, unit: '%', status: 'warning' },
    { label: '10-Day VaR (95%)', value: 7.41, limit: 10.0, unit: '%', status: 'normal' },
    { label: 'CVaR (ES 95%)', value: 3.56, limit: 4.5, unit: '%', status: 'normal' },
    { label: 'Portfolio Beta', value: 1.12, limit: 1.5, unit: '', status: 'normal' },
    { label: 'Max Sector Conc.', value: 32.4, limit: 35.0, unit: '%', status: 'warning' },
    { label: 'Max Position', value: 8.7, limit: 10.0, unit: '%', status: 'normal' },
    { label: 'Leverage Ratio', value: 1.45, limit: 2.0, unit: 'x', status: 'normal' },
  ];
}

function generateStress(): StressScenario[] {
  return [
    { name: '2008 GFC Replay', description: 'Global financial crisis scenario', portfolioImpact: -34.2, varImpact: 8.7, probability: 0.02 },
    { name: 'COVID March 2020', description: 'Pandemic market crash', portfolioImpact: -28.5, varImpact: 7.2, probability: 0.03 },
    { name: 'Rate Shock +200bps', description: 'Sudden rate increase', portfolioImpact: -12.8, varImpact: 4.1, probability: 0.08 },
    { name: 'Tech Selloff -30%', description: 'Technology sector collapse', portfolioImpact: -18.4, varImpact: 5.3, probability: 0.05 },
    { name: 'USD Crash -15%', description: 'Dollar devaluation', portfolioImpact: -8.6, varImpact: 3.2, probability: 0.04 },
    { name: 'Oil Shock +100%', description: 'Energy crisis', portfolioImpact: -11.3, varImpact: 3.8, probability: 0.06 },
    { name: 'China Hard Landing', description: 'Chinese economic crash', portfolioImpact: -15.7, varImpact: 4.5, probability: 0.04 },
    { name: 'Flash Crash -10%', description: 'Sudden market dislocation', portfolioImpact: -9.8, varImpact: 6.1, probability: 0.07 },
  ];
}

function generateExposures(): { sector: Exposure[]; region: Exposure[]; assetClass: Exposure[] } {
  return {
    sector: [
      { name: 'Technology', gross: 35.2, net: 28.4, limit: 40, color: BLUE },
      { name: 'Healthcare', gross: 18.5, net: 15.2, limit: 25, color: GREEN },
      { name: 'Financials', gross: 15.8, net: 12.3, limit: 30, color: AMBER },
      { name: 'Consumer Disc.', gross: 12.4, net: 9.8, limit: 20, color: PURPLE },
      { name: 'Energy', gross: 8.3, net: 5.6, limit: 15, color: RED },
      { name: 'Industrials', gross: 5.8, net: 4.2, limit: 15, color: ORANGE },
      { name: 'Other', gross: 4.0, net: 3.1, limit: 20, color: MUTED },
    ],
    region: [
      { name: 'North America', gross: 62.4, net: 54.2, limit: 70, color: BLUE },
      { name: 'Europe', gross: 18.3, net: 15.8, limit: 30, color: AMBER },
      { name: 'Asia Pacific', gross: 12.6, net: 8.4, limit: 25, color: GREEN },
      { name: 'Emerging Markets', gross: 6.7, net: 4.2, limit: 15, color: PURPLE },
    ],
    assetClass: [
      { name: 'Equities', gross: 72.5, net: 65.3, limit: 80, color: BLUE },
      { name: 'Fixed Income', gross: 15.2, net: 14.8, limit: 30, color: GREEN },
      { name: 'Alternatives', gross: 8.3, net: 7.1, limit: 15, color: AMBER },
      { name: 'Cash', gross: 4.0, net: 4.0, limit: 100, color: MUTED },
    ],
  };
}

// ── Canvas: Correlation Heatmap ──────────────────────────────────────────────
function CorrelationHeatmap({ size = 350 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const assets = ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD', 'USO', 'EEM', 'VIX'];

  const matrix = useMemo(() => {
    return assets.map((_, i) =>
      assets.map((_, j) => {
        if (i === j) return 1;
        // Generate plausible correlations
        const base = [
          [1, 0.95, 0.88, -0.45, 0.12, 0.35, 0.72, -0.78],
          [0.95, 1, 0.82, -0.52, 0.08, 0.28, 0.68, -0.82],
          [0.88, 0.82, 1, -0.38, 0.15, 0.42, 0.78, -0.72],
          [-0.45, -0.52, -0.38, 1, 0.28, -0.15, -0.32, 0.45],
          [0.12, 0.08, 0.15, 0.28, 1, 0.35, 0.22, -0.12],
          [0.35, 0.28, 0.42, -0.15, 0.35, 1, 0.48, -0.38],
          [0.72, 0.68, 0.78, -0.32, 0.22, 0.48, 1, -0.65],
          [-0.78, -0.82, -0.72, 0.45, -0.12, -0.38, -0.65, 1],
        ];
        return base[i]?.[j] ?? 0;
      })
    );
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr;
    cv.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const margin = 40;
    const cellSize = (size - margin) / assets.length;

    assets.forEach((asset, i) => {
      // Row labels
      ctx.fillStyle = TEXT;
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(asset, margin - 4, margin + i * cellSize + cellSize / 2);

      // Col labels
      ctx.save();
      ctx.translate(margin + i * cellSize + cellSize / 2, margin - 4);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'right';
      ctx.fillText(asset, 0, 0);
      ctx.restore();

      assets.forEach((_, j) => {
        const val = matrix[i][j];
        const x = margin + j * cellSize;
        const y = margin + i * cellSize;

        // Color: green for positive, red for negative
        const intensity = Math.abs(val);
        if (val >= 0) {
          ctx.fillStyle = `rgba(38,166,154,${intensity * 0.8})`;
        } else {
          ctx.fillStyle = `rgba(239,83,80,${intensity * 0.8})`;
        }
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);

        // Value text
        if (cellSize > 30) {
          ctx.fillStyle = intensity > 0.5 ? '#ffffff' : MUTED;
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val.toFixed(2), x + cellSize / 2, y + cellSize / 2);
        }
      });
    });
  }, [matrix, size]);

  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

// ── VaR Gauge component ──────────────────────────────────────────────────────
function VaRGauge({ value, limit, label }: { value: number; limit: number; label: string }) {
  const pct = Math.min(value / limit, 1.2);
  const color = pct > 0.9 ? RED : pct > 0.7 ? ORANGE : GREEN;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 100, height: 60, margin: '0 auto' }}>
        {/* Background arc */}
        <svg width={100} height={60} viewBox="0 0 100 60" style={{ position: 'absolute', top: 0, left: 0 }}>
          <path
            d="M 10 55 A 40 40 0 0 1 90 55"
            fill="none"
            stroke={BORDER}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <path
            d={`M 10 55 A 40 40 0 0 1 ${10 + 80 * Math.min(pct, 1) * Math.cos(Math.PI - Math.PI * Math.min(pct, 1))} ${55 - 80 * Math.min(pct, 1) * Math.sin(Math.PI * Math.min(pct, 1)) / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${pct * 126} 126`}
          />
        </svg>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}>
          <div style={{ color, fontSize: 16, fontWeight: 700 }}>{value.toFixed(1)}%</div>
        </div>
      </div>
      <div style={{ color: MUTED, fontSize: 8, marginTop: 4 }}>{label}</div>
      <div style={{ color: MUTED, fontSize: 7 }}>Limit: {limit}%</div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'exposure' | 'stress' | 'correlation';

export default function RiskDashboardUI2() {
  const [metrics] = useState<RiskMetric[]>(() => generateRiskMetrics());
  const [scenarios] = useState<StressScenario[]>(() => generateStress());
  const [exposures] = useState(() => generateExposures());
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exposureView, setExposureView] = useState<'sector' | 'region' | 'assetClass'>('sector');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'exposure', label: 'EXPOSURE' },
    { key: 'stress', label: 'STRESS TEST' },
    { key: 'correlation', label: 'CORRELATION' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* Header */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, fontSize: 11 }}>
          RISK MONITOR
        </span>
        <span style={{
          padding: '2px 8px',
          borderRadius: 3,
          fontSize: 8,
          background: metrics.some(m => m.status === 'breach') ? `${RED}33` : metrics.some(m => m.status === 'warning') ? `${ORANGE}33` : `${GREEN}33`,
          color: metrics.some(m => m.status === 'breach') ? RED : metrics.some(m => m.status === 'warning') ? ORANGE : GREEN,
        }}>
          {metrics.some(m => m.status === 'breach') ? 'LIMIT BREACH' : metrics.some(m => m.status === 'warning') ? 'WARNING' : 'ALL CLEAR'}
        </span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{
                background: activeTab === t.key ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${activeTab === t.key ? AMBER : 'transparent'}`,
                color: activeTab === t.key ? AMBER : MUTED,
                padding: '4px 10px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'overview' && (
          <div>
            {/* VaR gauges */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 16,
            }}>
              {metrics.slice(0, 4).map((m, i) => (
                <div key={i} style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 16,
                }}>
                  <VaRGauge value={m.value} limit={m.limit} label={m.label} />
                </div>
              ))}
            </div>

            {/* Limit utilization */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>LIMIT UTILIZATION</div>
              {metrics.map((m, i) => {
                const pct = m.value / m.limit;
                const color = pct > 0.9 ? RED : pct > 0.7 ? ORANGE : GREEN;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ width: 180, fontSize: 10 }}>{m.label}</span>
                    <div style={{ flex: 1, height: 14, background: BORDER, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(pct * 100, 100)}%`,
                        background: color,
                        opacity: 0.6,
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                      {/* Limit line */}
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: RED,
                      }} />
                    </div>
                    <span style={{ width: 60, textAlign: 'right', fontSize: 9, color }}>
                      {m.value}{m.unit}
                    </span>
                    <span style={{ width: 50, textAlign: 'right', fontSize: 8, color: MUTED }}>
                      / {m.limit}{m.unit}
                    </span>
                    <span style={{ width: 45, textAlign: 'right', fontSize: 9, fontWeight: 600, color }}>
                      {(pct * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'exposure' && (
          <div>
            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {(['sector', 'region', 'assetClass'] as const).map(v => (
                <button
                  key={v}
                  style={{
                    background: exposureView === v ? 'rgba(245,166,35,0.12)' : 'transparent',
                    border: `1px solid ${exposureView === v ? AMBER : BORDER}`,
                    color: exposureView === v ? AMBER : MUTED,
                    padding: '4px 10px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 9,
                    fontFamily: '"Roboto Mono", monospace',
                    textTransform: 'uppercase',
                  }}
                  onClick={() => setExposureView(v)}
                >
                  {v === 'assetClass' ? 'Asset Class' : v}
                </button>
              ))}
            </div>

            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>
                EXPOSURE BY {exposureView.toUpperCase()}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'right' }}>Gross %</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'right' }}>Net %</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'right' }}>Limit %</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'left' }}>Utilization</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exposures[exposureView].map((exp, i) => {
                    const util = exp.gross / exp.limit;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: exp.color }} />
                          {exp.name}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{exp.gross.toFixed(1)}%</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: BLUE }}>{exp.net.toFixed(1)}%</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: MUTED }}>{exp.limit}%</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(util * 100, 100)}%`,
                                background: util > 0.9 ? RED : util > 0.7 ? ORANGE : GREEN,
                                opacity: 0.7,
                                borderRadius: 4,
                              }} />
                            </div>
                            <span style={{ fontSize: 8, color: MUTED, width: 28, textAlign: 'right' }}>{(util * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 7,
                            background: util > 0.9 ? `${RED}22` : util > 0.7 ? `${ORANGE}22` : `${GREEN}22`,
                            color: util > 0.9 ? RED : util > 0.7 ? ORANGE : GREEN,
                          }}>
                            {util > 0.9 ? 'HIGH' : util > 0.7 ? 'WARN' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stress' && (
          <div>
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>STRESS TEST SCENARIOS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'left' }}>Scenario</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'right' }}>Portfolio Impact</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'right' }}>VaR Impact</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'right' }}>Probability</th>
                    <th style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: 'left' }}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.sort((a, b) => a.portfolioImpact - b.portfolioImpact).map((s, i) => {
                    const severity = Math.abs(s.portfolioImpact) > 25 ? 'CRITICAL' : Math.abs(s.portfolioImpact) > 15 ? 'HIGH' : 'MODERATE';
                    const sevColor = severity === 'CRITICAL' ? RED : severity === 'HIGH' ? ORANGE : AMBER;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '8px', color: MUTED, fontSize: 9 }}>{s.description}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: RED, fontWeight: 700, fontSize: 12 }}>
                          {s.portfolioImpact.toFixed(1)}%
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: ORANGE }}>{s.varImpact.toFixed(1)}%</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: MUTED }}>{(s.probability * 100).toFixed(0)}%</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 7,
                            background: sevColor + '22',
                            color: sevColor,
                          }}>
                            {severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Impact visualization */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
              marginTop: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>IMPACT COMPARISON</div>
              {scenarios.sort((a, b) => a.portfolioImpact - b.portfolioImpact).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ width: 140, fontSize: 9, color: TEXT }}>{s.name}</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      height: 14,
                      width: `${Math.abs(s.portfolioImpact) / 40 * 100}%`,
                      background: Math.abs(s.portfolioImpact) > 25 ? RED : Math.abs(s.portfolioImpact) > 15 ? ORANGE : AMBER,
                      opacity: 0.6,
                      borderRadius: '0 4px 4px 0',
                    }} />
                  </div>
                  <span style={{ width: 50, textAlign: 'right', color: RED, fontWeight: 600, fontSize: 10 }}>
                    {s.portfolioImpact.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'correlation' && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}>
              <div style={{
                background: PANEL,
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
                padding: 16,
              }}>
                <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>
                  ASSET CORRELATION MATRIX
                </div>
                <CorrelationHeatmap size={380} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8, fontSize: 8 }}>
                  <span style={{ color: RED }}>■ Negative</span>
                  <span style={{ color: MUTED }}>■ Low</span>
                  <span style={{ color: GREEN }}>■ Positive</span>
                </div>
              </div>

              <div>
                <div style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>CONCENTRATION RISK</div>
                  {[
                    { label: 'Top 5 Holdings', value: 45.8, limit: 60, color: BLUE },
                    { label: 'Max Single Position', value: 8.7, limit: 10, color: AMBER },
                    { label: 'Top Sector', value: 32.4, limit: 35, color: PURPLE },
                    { label: 'Top Region', value: 62.4, limit: 70, color: GREEN },
                  ].map((c, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 0',
                      borderBottom: `1px solid ${BORDER}`,
                    }}>
                      <span style={{ width: 120, fontSize: 9 }}>{c.label}</span>
                      <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${(c.value / c.limit) * 100}%`,
                          background: c.color,
                          opacity: 0.7,
                          borderRadius: 4,
                        }} />
                      </div>
                      <span style={{ width: 40, textAlign: 'right', fontSize: 9, color: c.color }}>{c.value}%</span>
                    </div>
                  ))}
                </div>

                <div style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 16,
                }}>
                  <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>RISK DECOMPOSITION</div>
                  {[
                    { factor: 'Market Risk', contrib: 68.2, color: BLUE },
                    { factor: 'Sector Risk', contrib: 12.4, color: PURPLE },
                    { factor: 'Idiosyncratic Risk', contrib: 8.6, color: AMBER },
                    { factor: 'Currency Risk', contrib: 5.3, color: GREEN },
                    { factor: 'Interest Rate Risk', contrib: 3.8, color: RED },
                    { factor: 'Liquidity Risk', contrib: 1.7, color: ORANGE },
                  ].map((f, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                      borderBottom: `1px solid ${BORDER}`,
                    }}>
                      <span style={{ width: 120, fontSize: 9 }}>{f.factor}</span>
                      <div style={{ flex: 1, height: 12, background: BORDER, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${f.contrib}%`,
                          background: f.color,
                          opacity: 0.7,
                          borderRadius: 4,
                        }} />
                      </div>
                      <span style={{ width: 40, textAlign: 'right', fontSize: 9, color: f.color }}>{f.contrib}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
