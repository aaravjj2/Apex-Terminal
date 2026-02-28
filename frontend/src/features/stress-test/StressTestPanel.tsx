/**
 * StressTestPanel.tsx
 * Comprehensive Stress Testing & Risk Analysis Panel for Apex Terminal.
 * Displays VaR, CVaR, drawdown analysis, historical scenarios, and Monte Carlo simulation.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaRResult {
  var: number;
  confidence: number;
  holding_period: number;
  method: string;
  observations?: number;
}

interface CVaRResult {
  cvar: number;
  var: number;
  confidence: number;
  tail_size: number;
}

interface DrawdownResult {
  max_drawdown: number;
  peak_idx: number;
  trough_idx: number;
  recovery_idx?: number;
  drawdown_duration_days: number;
  recovery_duration_days?: number;
  calmar_ratio?: number;
  underwater_pct?: number;
}

interface ScenarioResult {
  name: string;
  description: string;
  portfolio_loss: number;
  asset_shocks: Record<string, number>;
  severity: string;
}

interface LossDistribution {
  var_95: number;
  var_99: number;
  cvar_95: number;
  cvar_99: number;
  expected_loss: number;
  worst_loss: number;
  skewness: number;
  excess_kurtosis: number;
  loss_histogram: number[];
  bucket_edges: number[];
}

interface FullRiskReport {
  var_suite: Record<string, VaRResult>;
  cvar: CVaRResult;
  drawdown: DrawdownResult;
  scenarios: ScenarioResult[];
  loss_distribution?: LossDistribution;
  risk_score?: number;
  timestamp: string;
}

interface AssetWeight {
  symbol: string;
  weight: number;
  asset_class: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_LEVELS = [0.90, 0.95, 0.99, 0.999];
const HOLDING_PERIODS = [1, 5, 10, 21, 63];
const SCENARIO_SEVERITY_COLORS: Record<string, string> = {
  mild: '#88cc88',
  moderate: '#ffcc00',
  severe: '#ff9900',
  extreme: '#ff4444',
  catastrophic: '#cc0000',
};
const VAR_METHOD_LABELS: Record<string, string> = {
  historical: 'Historical Simulation',
  parametric: 'Parametric (Normal)',
  cornish_fisher: 'Cornish-Fisher',
  monte_carlo: 'Monte Carlo',
};

// ─── Mock Data Factory ────────────────────────────────────────────────────────

function generateMockRiskReport(): FullRiskReport {
  return {
    timestamp: new Date().toISOString(),
    var_suite: {
      historical: { var: -0.0248, confidence: 0.95, holding_period: 1, method: 'historical', observations: 252 },
      parametric: { var: -0.0235, confidence: 0.95, holding_period: 1, method: 'parametric' },
      cornish_fisher: { var: -0.0261, confidence: 0.95, holding_period: 1, method: 'cornish_fisher' },
      monte_carlo: { var: -0.0252, confidence: 0.95, holding_period: 1, method: 'monte_carlo' },
    },
    cvar: { cvar: -0.0381, var: -0.0248, confidence: 0.95, tail_size: 13 },
    drawdown: {
      max_drawdown: -0.2341,
      peak_idx: 45,
      trough_idx: 189,
      recovery_idx: 287,
      drawdown_duration_days: 144,
      recovery_duration_days: 98,
      calmar_ratio: 0.85,
      underwater_pct: 23.4,
    },
    scenarios: [
      { name: 'GFC_2008', description: 'Global Financial Crisis 2008-09', portfolio_loss: -0.4120, asset_shocks: { equity: -0.55, bonds: 0.08, gold: 0.25, usd: 0.12 }, severity: 'catastrophic' },
      { name: 'COVID_2020', description: 'COVID-19 Market Crash 2020', portfolio_loss: -0.2890, asset_shocks: { equity: -0.34, bonds: 0.07, gold: 0.05, usd: 0.05 }, severity: 'extreme' },
      { name: 'RATE_SHOCK_2022', description: 'Fed Rate Hike Shock 2022', portfolio_loss: -0.2250, asset_shocks: { equity: -0.25, bonds: -0.18, gold: -0.02, usd: 0.08 }, severity: 'severe' },
      { name: 'DOTCOM', description: 'Dot-com Bust 2000-02', portfolio_loss: -0.1980, asset_shocks: { equity: -0.49, bonds: 0.15, gold: 0.08, usd: 0.05 }, severity: 'severe' },
      { name: 'FLASH_CRASH', description: 'Flash Crash 2010', portfolio_loss: -0.0410, asset_shocks: { equity: -0.09, bonds: 0.02, gold: 0.01, usd: 0.01 }, severity: 'moderate' },
      { name: 'EURO_CRISIS', description: 'European Sovereign Debt 2011', portfolio_loss: -0.1230, asset_shocks: { equity: -0.20, bonds: 0.06, gold: 0.12, usd: 0.08 }, severity: 'severe' },
      { name: 'RUSSIA_1998', description: 'Russia Default / LTCM 1998', portfolio_loss: -0.1560, asset_shocks: { equity: -0.22, bonds: -0.05, gold: 0.03, usd: 0.09 }, severity: 'severe' },
      { name: 'INFLATION_SHOCK', description: 'Inflation Shock Scenario', portfolio_loss: -0.1820, asset_shocks: { equity: -0.20, bonds: -0.25, gold: 0.15, usd: 0.05 }, severity: 'severe' },
    ],
    loss_distribution: {
      var_95: -0.0248,
      var_99: -0.0381,
      cvar_95: -0.0381,
      cvar_99: -0.0555,
      expected_loss: -0.0005,
      worst_loss: -0.0712,
      skewness: -0.82,
      excess_kurtosis: 2.14,
      loss_histogram: [1, 3, 8, 15, 35, 60, 95, 140, 180, 190, 165, 120, 80, 45, 25, 12, 8, 5, 3, 2],
      bucket_edges: Array.from({ length: 21 }, (_, i) => -0.08 + i * 0.008),
    },
    risk_score: 38,
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

const fmtPct = (v: number, d = 2): string => `${(v * 100).toFixed(d)}%`;
const fmtDollar = (v: number, portfolio = 1_000_000): string => {
  const loss = Math.abs(v) * portfolio;
  return loss >= 1000 ? `$${(loss / 1000).toFixed(1)}K` : `$${loss.toFixed(0)}`;
};

interface RiskBadgeProps {
  score: number; // 0-100
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ score }) => {
  const color = score < 25 ? '#00d4aa' : score < 50 ? '#ffcc00' : score < 75 ? '#ff9900' : '#ff4444';
  const label = score < 25 ? 'Low Risk' : score < 50 ? 'Moderate' : score < 75 ? 'High Risk' : 'Extreme';
  return (
    <div className="risk-badge" style={{ borderColor: color, color }}>
      <div className="risk-badge__score">{score}</div>
      <div className="risk-badge__label">{label}</div>
      <svg width="60" height="30" viewBox="0 0 60 30">
        <path d="M 5 28 A 25 25 0 0 1 55 28" fill="none" stroke="#1a2332" strokeWidth="5" />
        <path
          d="M 5 28 A 25 25 0 0 1 55 28"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${(score / 100) * 78.5} 78.5`}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

interface VaRComparisonProps {
  varSuite: Record<string, VaRResult>;
  portfolioSize?: number;
}

const VaRComparison: React.FC<VaRComparisonProps> = ({ varSuite, portfolioSize = 1_000_000 }) => {
  const methods = Object.keys(varSuite);
  const maxLoss = Math.max(...methods.map(m => Math.abs(varSuite[m].var)));

  return (
    <div className="var-comparison">
      <h3 className="panel-title">VaR — Method Comparison</h3>
      <div className="var-comparison__subtitle">95% Confidence, 1-Day Holding Period</div>

      <div className="var-method-grid">
        {methods.map(method => {
          const result = varSuite[method];
          const lossPct = Math.abs(result.var) / maxLoss;
          const color = method === 'cornish_fisher' ? '#f7931a' :
                        method === 'monte_carlo' ? '#00aaff' :
                        method === 'parametric' ? '#88ccff' : '#00d4aa';
          return (
            <div key={method} className="var-method-card" style={{ borderColor: `${color}44` }}>
              <div className="var-method-card__name">{VAR_METHOD_LABELS[method] || method}</div>
              <div className="var-method-card__value" style={{ color }}>
                {fmtPct(result.var)}
              </div>
              <div className="var-method-card__dollar">{fmtDollar(result.var, portfolioSize)}</div>
              <div className="var-method-card__bar">
                <div style={{ width: `${lossPct * 100}%`, backgroundColor: color, height: 4, borderRadius: 2 }} />
              </div>
              {result.observations && (
                <div className="var-method-card__obs">{result.observations} obs</div>
              )}
            </div>
          );
        })}
      </div>

      {/* CVaR note */}
      <div className="cvar-note">
        <span className="cvar-note__label">Expected Shortfall (CVaR 95%):</span>
        <span className="cvar-note__value" style={{ color: '#ff9900' }}>
          Beyond VaR worst tail avg
        </span>
      </div>
    </div>
  );
};

interface DrawdownChartProps {
  drawdown: DrawdownResult;
}

const DrawdownChart: React.FC<DrawdownChartProps> = ({ drawdown }) => {
  // Synthetic underwater curve
  const n = 300;
  const curve: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < drawdown.peak_idx) {
      curve.push(0);
    } else if (i <= drawdown.trough_idx) {
      const progress = (i - drawdown.peak_idx) / (drawdown.trough_idx - drawdown.peak_idx);
      const ease = Math.sin(progress * Math.PI / 2);
      curve.push(drawdown.max_drawdown * ease);
    } else if (drawdown.recovery_idx && i <= drawdown.recovery_idx) {
      const progress = (i - drawdown.trough_idx) / (drawdown.recovery_idx - drawdown.trough_idx);
      curve.push(drawdown.max_drawdown * (1 - progress));
    } else {
      curve.push(0);
    }
  }

  const W = 350; const H = 140;
  const minV = Math.min(...curve);
  const yScale = (v: number) => 10 + ((v - minV) / (0 - minV)) * (H - 20);
  const xScale = (i: number) => (i / (n - 1)) * (W - 20) + 10;

  const pathD = curve.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');

  return (
    <div className="drawdown-chart">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ff4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Zero line */}
        <line x1="10" y1="10" x2={W - 10} y2="10" stroke="#334" strokeWidth="1" strokeDasharray="4,4" />
        {/* Area fill */}
        <path
          d={`${pathD} L ${xScale(n - 1)} ${H - 10} L ${xScale(0)} ${H - 10} Z`}
          fill="url(#ddGrad)"
        />
        {/* Curve line */}
        <path d={pathD} fill="none" stroke="#ff4444" strokeWidth="1.5" />
        {/* Peak marker */}
        <line x1={xScale(drawdown.peak_idx)} y1="5" x2={xScale(drawdown.peak_idx)} y2={H - 10} stroke="#00d4aa88" strokeWidth="1" strokeDasharray="3,3" />
        <text x={xScale(drawdown.peak_idx)} y="6" textAnchor="middle" fill="#00d4aa" fontSize="7">Peak</text>
        {/* Trough marker */}
        <line x1={xScale(drawdown.trough_idx)} y1="5" x2={xScale(drawdown.trough_idx)} y2={H - 10} stroke="#ff444488" strokeWidth="1" strokeDasharray="3,3" />
        <text x={xScale(drawdown.trough_idx)} y={yScale(drawdown.max_drawdown) - 5} textAnchor="middle" fill="#ff4444" fontSize="8">
          {fmtPct(drawdown.max_drawdown)}
        </text>
        {/* Recovery marker */}
        {drawdown.recovery_idx && (
          <>
            <line x1={xScale(drawdown.recovery_idx)} y1="5" x2={xScale(drawdown.recovery_idx)} y2={H - 10} stroke="#00d4aa88" strokeWidth="1" strokeDasharray="3,3" />
            <text x={xScale(drawdown.recovery_idx)} y="6" textAnchor="middle" fill="#00d4aa" fontSize="7">Recovery</text>
          </>
        )}
      </svg>
    </div>
  );
};

interface ScenarioTableProps {
  scenarios: ScenarioResult[];
  portfolioSize: number;
}

const ScenarioTable: React.FC<ScenarioTableProps> = ({ scenarios, portfolioSize }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const sorted = [...scenarios].sort((a, b) => a.portfolio_loss - b.portfolio_loss);
  const worstLoss = Math.abs(sorted[0]?.portfolio_loss || 1);

  const selectedScenario = useMemo(
    () => selected ? scenarios.find(s => s.name === selected) : null,
    [selected, scenarios]
  );

  return (
    <div className="scenario-panel">
      <table className="scenario-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Portfolio Loss</th>
            <th>$Impact</th>
            <th>Severity</th>
            <th>Bar</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => {
            const color = SCENARIO_SEVERITY_COLORS[s.severity] || '#888';
            const barPct = (Math.abs(s.portfolio_loss) / worstLoss) * 100;
            return (
              <tr
                key={s.name}
                className={`scenario-row${selected === s.name ? ' scenario-row--selected' : ''}`}
                onClick={() => setSelected(prev => prev === s.name ? null : s.name)}
              >
                <td className="scenario-td scenario-td--name">
                  <div className="scenario-name">{s.name.replace(/_/g, ' ')}</div>
                  <div className="scenario-desc">{s.description}</div>
                </td>
                <td className="scenario-td" style={{ color: '#ff4444' }}>
                  {fmtPct(s.portfolio_loss)}
                </td>
                <td className="scenario-td" style={{ color: '#ff4444' }}>
                  -{fmtDollar(Math.abs(s.portfolio_loss), portfolioSize)}
                </td>
                <td className="scenario-td">
                  <span className="severity-badge" style={{ color, borderColor: `${color}44` }}>
                    {s.severity.toUpperCase()}
                  </span>
                </td>
                <td className="scenario-td scenario-td--bar">
                  <div className="scenario-bar">
                    <div className="scenario-bar__fill" style={{ width: `${barPct}%`, backgroundColor: `${color}88` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Drill-down: asset-class shocks */}
      {selectedScenario && (
        <div className="scenario-drilldown">
          <h4 className="scenario-drilldown__title">{selectedScenario.name.replace(/_/g, ' ')} — Asset Class Shocks</h4>
          <div className="shock-grid">
            {Object.entries(selectedScenario.asset_shocks).map(([asset, shock]) => (
              <div key={asset} className="shock-card" style={{ borderColor: shock >= 0 ? '#00d4aa44' : '#ff444444' }}>
                <div className="shock-card__asset">{asset.toUpperCase()}</div>
                <div className="shock-card__value" style={{ color: shock >= 0 ? '#00d4aa' : '#ff4444' }}>
                  {shock >= 0 ? '+' : ''}{fmtPct(shock)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface LossHistogramProps {
  dist: LossDistribution;
}

const LossHistogram: React.FC<LossHistogramProps> = ({ dist }) => {
  const maxFreq = Math.max(...dist.loss_histogram);
  const W = 350; const H = 140;
  const n = dist.loss_histogram.length;
  const barW = (W - 40) / n - 1;

  const getBarColor = (i: number): string => {
    const bucketLoss = dist.bucket_edges[i];
    if (bucketLoss <= dist.var_99) return '#cc0000';
    if (bucketLoss <= dist.var_95) return '#ff4444';
    if (bucketLoss <= 0) return '#ff9900';
    return '#00d4aa44';
  };

  const var95X = ((dist.var_95 - dist.bucket_edges[0]) / (dist.bucket_edges[n] - dist.bucket_edges[0])) * (W - 40) + 20;
  const var99X = ((dist.var_99 - dist.bucket_edges[0]) / (dist.bucket_edges[n] - dist.bucket_edges[0])) * (W - 40) + 20;

  return (
    <div className="loss-histogram">
      <div className="loss-histogram__stats">
        <div className="dist-stat">
          <span className="dist-stat__label">Expected Loss</span>
          <span className="dist-stat__value">{fmtPct(dist.expected_loss)}</span>
        </div>
        <div className="dist-stat">
          <span className="dist-stat__label">VaR 95%</span>
          <span className="dist-stat__value" style={{ color: '#ff9900' }}>{fmtPct(dist.var_95)}</span>
        </div>
        <div className="dist-stat">
          <span className="dist-stat__label">VaR 99%</span>
          <span className="dist-stat__value" style={{ color: '#ff4444' }}>{fmtPct(dist.var_99)}</span>
        </div>
        <div className="dist-stat">
          <span className="dist-stat__label">Skewness</span>
          <span className="dist-stat__value">{dist.skewness.toFixed(2)}</span>
        </div>
        <div className="dist-stat">
          <span className="dist-stat__label">Excess Kurt.</span>
          <span className="dist-stat__value">{dist.excess_kurtosis.toFixed(2)}</span>
        </div>
        <div className="dist-stat">
          <span className="dist-stat__label">Worst Loss</span>
          <span className="dist-stat__value" style={{ color: '#cc0000' }}>{fmtPct(dist.worst_loss)}</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {dist.loss_histogram.map((freq, i) => {
          const barH = (freq / maxFreq) * (H - 30);
          const x = 20 + i * (barW + 1);
          const y = H - 20 - barH;
          return (
            <rect key={i} x={x} y={y} width={barW} height={barH}
              fill={getBarColor(i)} opacity={0.85} />
          );
        })}
        {/* VaR lines */}
        <line x1={var95X} y1="5" x2={var95X} y2={H - 20} stroke="#ff9900" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x={var95X} y="4" textAnchor="middle" fill="#ff9900" fontSize="8">VaR95</text>
        <line x1={var99X} y1="5" x2={var99X} y2={H - 20} stroke="#ff4444" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x={var99X} y="4" textAnchor="middle" fill="#ff4444" fontSize="8">VaR99</text>
        {/* X axis */}
        <line x1="20" y1={H - 20} x2={W - 10} y2={H - 20} stroke="#334" />
        <text x="20" y={H - 10} fill="#666" fontSize="7">{fmtPct(dist.bucket_edges[0])}</text>
        <text x={W - 10} y={H - 10} textAnchor="end" fill="#666" fontSize="7">
          {fmtPct(dist.bucket_edges[dist.bucket_edges.length - 1])}
        </text>
      </svg>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export interface StressTestPanelProps {
  className?: string;
  portfolioSize?: number;
  onRefresh?: () => Promise<FullRiskReport>;
  refreshIntervalMs?: number;
}

type StressTab = 'overview' | 'var' | 'drawdown' | 'scenarios' | 'distribution';

const StressTestPanel: React.FC<StressTestPanelProps> = ({
  className = '',
  portfolioSize = 1_000_000,
  onRefresh,
  refreshIntervalMs = 60000,
}) => {
  const [activeTab, setActiveTab] = useState<StressTab>('overview');
  const [report, setReport] = useState<FullRiskReport>(generateMockRiskReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0.95);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!onRefresh) {
      setReport(generateMockRiskReport());
      setLastUpdate(new Date());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await onRefresh();
      setReport(result);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load risk data');
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, refreshIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh, refreshIntervalMs]);

  const worstScenario = useMemo(
    () => report.scenarios.reduce((a, b) => a.portfolio_loss < b.portfolio_loss ? a : b, report.scenarios[0]),
    [report.scenarios]
  );

  const tabs: { id: StressTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'var', label: 'VaR Analysis', icon: '▽' },
    { id: 'drawdown', label: 'Drawdown', icon: '↘' },
    { id: 'scenarios', label: 'Scenarios', icon: '⚡' },
    { id: 'distribution', label: 'Loss Distribution', icon: '∫' },
  ];

  return (
    <div className={`stress-test-panel ${className}`}>
      {/* Header */}
      <div className="stress-test-panel__header">
        <div className="stress-test-panel__title">
          <span>⚠</span> STRESS TESTING & RISK
        </div>
        <div className="stress-test-panel__controls">
          <select
            className="confidence-select"
            value={confidence}
            onChange={e => setConfidence(Number(e.target.value))}
          >
            {CONFIDENCE_LEVELS.map(c => (
              <option key={c} value={c}>{(c * 100).toFixed(1)}% Confidence</option>
            ))}
          </select>
          <span className="update-time">{loading ? 'Updating...' : lastUpdate.toLocaleTimeString()}</span>
          <button className="btn btn--icon" onClick={refresh} disabled={loading}>⟳</button>
        </div>
      </div>

      {error && <div className="panel-error">⚠ {error}</div>}

      {/* Tabs */}
      <div className="stress-test-panel__tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`stress-tab${activeTab === t.id ? ' stress-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="stress-test-panel__content">

        {activeTab === 'overview' && (
          <div className="overview-grid stress-overview">
            {/* Risk Score */}
            <div className="stress-overview__risk">
              <h3 className="panel-title">Portfolio Risk Score</h3>
              {report.risk_score !== undefined && <RiskBadge score={report.risk_score} />}
            </div>

            {/* Key Risk Numbers */}
            <div className="stress-overview__vars">
              <h3 className="panel-title">Key Risk Metrics</h3>
              <div className="risk-metrics-grid">
                <div className="risk-metric">
                  <div className="risk-metric__label">VaR 95% (1D)</div>
                  <div className="risk-metric__value" style={{ color: '#ff9900' }}>
                    {fmtPct(report.var_suite.historical?.var || 0)}
                  </div>
                  <div className="risk-metric__dollar">{fmtDollar(Math.abs(report.var_suite.historical?.var || 0), portfolioSize)}</div>
                </div>
                <div className="risk-metric">
                  <div className="risk-metric__label">CVaR 95% (1D)</div>
                  <div className="risk-metric__value" style={{ color: '#ff4444' }}>
                    {fmtPct(report.cvar.cvar)}
                  </div>
                  <div className="risk-metric__dollar">{fmtDollar(Math.abs(report.cvar.cvar), portfolioSize)}</div>
                </div>
                <div className="risk-metric">
                  <div className="risk-metric__label">Max Drawdown</div>
                  <div className="risk-metric__value" style={{ color: '#ff4444' }}>
                    {fmtPct(report.drawdown.max_drawdown)}
                  </div>
                  <div className="risk-metric__dollar">{report.drawdown.drawdown_duration_days}d duration</div>
                </div>
                {report.drawdown.calmar_ratio && (
                  <div className="risk-metric">
                    <div className="risk-metric__label">Calmar Ratio</div>
                    <div className="risk-metric__value" style={{ color: report.drawdown.calmar_ratio >= 1 ? '#00d4aa' : '#ffcc00' }}>
                      {report.drawdown.calmar_ratio.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Worst scenario */}
            {worstScenario && (
              <div className="stress-overview__worst">
                <h3 className="panel-title">Worst Historical Scenario</h3>
                <div className="worst-scenario">
                  <div className="worst-scenario__name">{worstScenario.name.replace(/_/g, ' ')}</div>
                  <div className="worst-scenario__desc">{worstScenario.description}</div>
                  <div className="worst-scenario__loss" style={{ color: '#cc0000' }}>
                    {fmtPct(worstScenario.portfolio_loss)}
                  </div>
                  <div className="worst-scenario__dollar" style={{ color: '#ff4444' }}>
                    -{fmtDollar(Math.abs(worstScenario.portfolio_loss), portfolioSize)}
                  </div>
                </div>
              </div>
            )}

            {/* Drawdown mini */}
            <div className="stress-overview__drawdown">
              <h3 className="panel-title">Drawdown Profile</h3>
              <DrawdownChart drawdown={report.drawdown} />
            </div>
          </div>
        )}

        {activeTab === 'var' && (
          <VaRComparison varSuite={report.var_suite} portfolioSize={portfolioSize} />
        )}

        {activeTab === 'drawdown' && (
          <div className="drawdown-detail">
            <DrawdownChart drawdown={report.drawdown} />
            <div className="drawdown-stats-grid">
              <div className="dd-stat">
                <div className="dd-stat__label">Maximum Drawdown</div>
                <div className="dd-stat__value" style={{ color: '#ff4444' }}>{fmtPct(report.drawdown.max_drawdown)}</div>
                <div className="dd-stat__sub">{fmtDollar(Math.abs(report.drawdown.max_drawdown), portfolioSize)} on ${(portfolioSize / 1e6).toFixed(0)}M portfolio</div>
              </div>
              <div className="dd-stat">
                <div className="dd-stat__label">Duration to Trough</div>
                <div className="dd-stat__value">{report.drawdown.drawdown_duration_days} days</div>
              </div>
              {report.drawdown.recovery_duration_days && (
                <div className="dd-stat">
                  <div className="dd-stat__label">Recovery Duration</div>
                  <div className="dd-stat__value" style={{ color: '#00d4aa' }}>{report.drawdown.recovery_duration_days} days</div>
                </div>
              )}
              {report.drawdown.calmar_ratio && (
                <div className="dd-stat">
                  <div className="dd-stat__label">Calmar Ratio</div>
                  <div className="dd-stat__value" style={{ color: report.drawdown.calmar_ratio >= 1 ? '#00d4aa' : '#ffcc00' }}>
                    {report.drawdown.calmar_ratio.toFixed(3)}
                  </div>
                  <div className="dd-stat__sub">Annualized Return / Max DD</div>
                </div>
              )}
              {report.drawdown.underwater_pct && (
                <div className="dd-stat">
                  <div className="dd-stat__label">Underwater Time</div>
                  <div className="dd-stat__value">{report.drawdown.underwater_pct.toFixed(1)}%</div>
                  <div className="dd-stat__sub">% of time below peak</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'scenarios' && (
          <ScenarioTable scenarios={report.scenarios} portfolioSize={portfolioSize} />
        )}

        {activeTab === 'distribution' && report.loss_distribution && (
          <div className="distribution-detail">
            <LossHistogram dist={report.loss_distribution} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StressTestPanel;
export type { FullRiskReport, ScenarioResult, VaRResult, DrawdownResult };
