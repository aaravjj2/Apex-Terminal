/**
 * RiskAnalysisPage.tsx
 * Full risk analysis page with Bloomberg-style layout.
 * Includes: portfolio VaR panel, drawdown analysis, stress scenarios,
 * risk decomposition, rolling volatility, beta analysis, tail risk, and risk limits.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskTab = 'overview' | 'var' | 'drawdown' | 'stress' | 'decomposition' | 'rolling' | 'tail' | 'limits';

interface RiskMetric {
  label: string;
  value: string;
  change?: string;
  status: 'ok' | 'warning' | 'breach';
  description?: string;
}

interface DrawdownPeriod {
  start: string;
  end: string | null;
  peak: number;
  trough: number;
  drawdown_pct: number;
  recovery_days?: number;
  duration_days: number;
}

interface StressScenario {
  name: string;
  description: string;
  portfolio_loss_pct: number;
  confidence: 'high' | 'medium' | 'low';
  category: 'historical' | 'hypothetical' | 'macro';
  date?: string;
}

interface RiskLimit {
  category: string;
  metric: string;
  limit: number;
  current: number;
  unit: string;
  status: 'ok' | 'warning' | 'breach';
}

interface FactorRiskAttribution {
  factor: string;
  contribution_pct: number;
  standalone_vol: number;
  color: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const RISK_METRICS: RiskMetric[] = [
  { label: 'Portfolio VaR (95%, 1D)', value: '-$124,500', change: '+3.2%', status: 'warning', description: '95% 1-day Value at Risk' },
  { label: 'Portfolio VaR (99%, 1D)', value: '-$198,200', change: '+4.1%', status: 'ok', description: '99% 1-day Value at Risk' },
  { label: 'CVaR / ES (95%, 1D)', value: '-$167,300', change: '+2.8%', status: 'ok', description: 'Expected Shortfall beyond VaR' },
  { label: 'Portfolio Beta', value: '1.14', change: '+0.06', status: 'warning', description: 'Beta vs S&P 500' },
  { label: 'Portfolio Volatility (Ann)', value: '18.3%', change: '+1.2%', status: 'ok', description: 'Annualized portfolio vol' },
  { label: 'Sharpe Ratio', value: '1.24', change: '-0.08', status: 'ok', description: 'Risk-adjusted return' },
  { label: 'Max Drawdown (1Y)', value: '-8.7%', change: '', status: 'ok', description: 'Max drawdown last 12 months' },
  { label: 'Calmar Ratio', value: '2.3', change: '', status: 'ok', description: 'Ann return / Max drawdown' },
  { label: 'Tail Risk (95%, 10D)', value: '-$393,800', change: '', status: 'warning', description: '10-day VaR scaled' },
  { label: 'Correlation to SPY', value: '0.82', change: '-0.04', status: 'ok', description: 'Rolling 60-day correlation' },
  { label: 'IR vs Benchmark', value: '0.66', change: '+0.12', status: 'ok', description: 'Information ratio' },
  { label: 'Tracking Error', value: '4.2%', change: '+0.3%', status: 'ok', description: 'Annualized tracking error' },
];

const DRAWDOWN_PERIODS: DrawdownPeriod[] = [
  { start: '2022-01-03', end: '2022-10-12', peak: 100, trough: 75.8, drawdown_pct: -24.2, recovery_days: 320, duration_days: 283 },
  { start: '2023-07-31', end: '2023-10-27', peak: 100, trough: 92.1, drawdown_pct: -7.9, recovery_days: 45, duration_days: 88 },
  { start: '2024-01-15', end: null, peak: 100, trough: 97.6, drawdown_pct: -2.4, recovery_days: undefined, duration_days: 14 },
  { start: '2020-02-19', end: '2020-08-18', peak: 100, trough: 66.8, drawdown_pct: -33.2, recovery_days: 148, duration_days: 181 },
  { start: '2018-10-03', end: '2019-01-26', peak: 100, trough: 81.5, drawdown_pct: -18.5, recovery_days: 84, duration_days: 115 },
];

const STRESS_SCENARIOS: StressScenario[] = [
  { name: '2008 Financial Crisis', description: 'Lehman Brothers collapse, credit freeze', portfolio_loss_pct: -38.4, confidence: 'high', category: 'historical', date: '2008' },
  { name: 'COVID-19 Crash', description: 'Pandemic-driven global selloff', portfolio_loss_pct: -24.6, confidence: 'high', category: 'historical', date: '2020-03' },
  { name: 'Dot-com Bust', description: '2000-2002 tech bubble collapse', portfolio_loss_pct: -28.1, confidence: 'medium', category: 'historical', date: '2000-2002' },
  { name: 'Fed Hikes 200bps', description: 'Aggressive Fed tightening scenario', portfolio_loss_pct: -14.2, confidence: 'medium', category: 'hypothetical' },
  { name: 'Equity -20% Shock', description: 'Broad equity market crash', portfolio_loss_pct: -21.8, confidence: 'high', category: 'hypothetical' },
  { name: 'USD Strengthens 15%', description: 'Dollar strengthening shock', portfolio_loss_pct: -6.3, confidence: 'medium', category: 'hypothetical' },
  { name: 'China Hard Landing', description: 'Chinese economy contracts 5%', portfolio_loss_pct: -11.7, confidence: 'low', category: 'macro' },
  { name: 'Stagflation', description: 'High inflation + recession combo', portfolio_loss_pct: -17.9, confidence: 'medium', category: 'macro' },
  { name: 'Geopolitical Escalation', description: 'Major conflict in Asia-Pacific', portfolio_loss_pct: -9.8, confidence: 'low', category: 'macro' },
  { name: 'Credit Default Wave', description: 'HY spreads +600bp, IG +150bp', portfolio_loss_pct: -16.4, confidence: 'low', category: 'macro' },
];

const RISK_LIMITS: RiskLimit[] = [
  { category: 'Market Risk', metric: 'VaR (95%, 1D)', limit: 150000, current: 124500, unit: '$', status: 'warning' },
  { category: 'Market Risk', metric: 'VaR (99%, 1D)', limit: 250000, current: 198200, unit: '$', status: 'ok' },
  { category: 'Market Risk', metric: 'Portfolio Beta', limit: 1.2, current: 1.14, unit: '', status: 'warning' },
  { category: 'Concentration', metric: 'Single Name (% NAV)', limit: 10, current: 7.8, unit: '%', status: 'ok' },
  { category: 'Concentration', metric: 'Sector (% NAV)', limit: 30, current: 28.4, unit: '%', status: 'warning' },
  { category: 'Concentration', metric: 'Country (% NAV)', limit: 70, current: 68.2, unit: '%', status: 'warning' },
  { category: 'Drawdown', metric: 'MTD Drawdown', limit: 5, current: 2.4, unit: '%', status: 'ok' },
  { category: 'Drawdown', metric: 'YTD Drawdown', limit: 15, current: 8.7, unit: '%', status: 'ok' },
  { category: 'Drawdown', metric: 'Max Drawdown (1Y)', limit: 20, current: 8.7, unit: '%', status: 'ok' },
  { category: 'Liquidity', metric: 'Days to Liquidate 90%', limit: 5, current: 3.2, unit: 'days', status: 'ok' },
];

const FACTOR_ATTRIBUTIONS: FactorRiskAttribution[] = [
  { factor: 'Market (Beta)', contribution_pct: 62.4, standalone_vol: 14.2, color: '#4a9eff' },
  { factor: 'Size (Small Cap)', contribution_pct: 8.1, standalone_vol: 6.3, color: '#00d4aa' },
  { factor: 'Value', contribution_pct: 6.7, standalone_vol: 5.8, color: '#ff9900' },
  { factor: 'Momentum', contribution_pct: 9.2, standalone_vol: 7.1, color: '#cc44ff' },
  { factor: 'Quality', contribution_pct: 4.3, standalone_vol: 3.9, color: '#ffcc00' },
  { factor: 'Low Volatility', contribution_pct: 3.1, standalone_vol: 2.8, color: '#66cc66' },
  { factor: 'Idiosyncratic', contribution_pct: 6.2, standalone_vol: 5.1, color: '#888' },
];

// ─── Component: Risk Overview ─────────────────────────────────────────────────

const RiskOverviewPanel: React.FC = () => {
  const statusColor = (s: 'ok' | 'warning' | 'breach') =>
    s === 'ok' ? '#00d4aa' : s === 'warning' ? '#ff9900' : '#ff4466';

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {RISK_METRICS.map((m, i) => (
          <div key={i} style={{
            background: '#0e1c2e', border: `1px solid ${statusColor(m.status)}33`,
            borderRadius: 4, padding: '8px 12px', minWidth: 170,
          }}>
            <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', marginBottom: 4 }}>{m.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: '#ddd', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>{m.value}</span>
              {m.change && (
                <span style={{ color: m.change.startsWith('+') ? '#ff4466' : '#00d4aa', fontSize: 9, fontFamily: 'monospace' }}>
                  {m.change}
                </span>
              )}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 4,
              padding: '1px 5px', borderRadius: 2, fontSize: 8, fontFamily: 'monospace',
              background: `${statusColor(m.status)}22`, color: statusColor(m.status),
            }}>
              {m.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Component: Drawdown Analysis ────────────────────────────────────────────

const DrawdownPanel: React.FC = () => {
  const maxDD = Math.min(...DRAWDOWN_PERIODS.map(d => d.drawdown_pct));
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        {[
          { label: 'Current Drawdown', value: '-2.4%', color: '#ffcc00' },
          { label: 'Max Drawdown (All Time)', value: '-33.2%', color: '#ff4466' },
          { label: 'Avg Recovery Days', value: '199', color: '#4a9eff' },
        ].map((item, i) => (
          <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '8px 14px' }}>
            <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{item.label}</div>
            <div style={{ color: item.color, fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#0e1c2e', borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#0a1628' }}>
              {['Period', 'Start', 'End', 'Drawdown', 'Duration', 'Recovery'].map((h, i) => (
                <th key={i} style={{ padding: '8px 12px', color: '#555', textAlign: i > 2 ? 'right' : 'left', borderBottom: '1px solid #1a2a38' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DRAWDOWN_PERIODS.sort((a, b) => a.drawdown_pct - b.drawdown_pct).map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
                <td style={{ padding: '6px 12px' }}>
                  <div style={{
                    display: 'inline-block', width: `${Math.abs(d.drawdown_pct) * 3}px`,
                    height: 8, background: d.drawdown_pct === maxDD ? '#ff4466' : '#ff9900', borderRadius: 1, marginRight: 8,
                  }} />
                </td>
                <td style={{ padding: '6px 12px', color: '#888' }}>{d.start}</td>
                <td style={{ padding: '6px 12px', color: '#888' }}>{d.end ?? 'Open'}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: d.drawdown_pct < -20 ? '#ff4466' : '#ff9900', fontWeight: 'bold' }}>
                  {d.drawdown_pct.toFixed(1)}%
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#888' }}>{d.duration_days}d</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#888' }}>
                  {d.recovery_days ? `${d.recovery_days}d` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Component: Stress Testing ───────────────────────────────────────────────

const StressPanel: React.FC = () => {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? STRESS_SCENARIOS : STRESS_SCENARIOS.filter(s => s.category === filter);
  const minLoss = Math.min(...STRESS_SCENARIOS.map(s => s.portfolio_loss_pct));

  const confColor = (c: string) => c === 'high' ? '#00d4aa' : c === 'medium' ? '#ffcc00' : '#ff9900';

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['all', 'historical', 'hypothetical', 'macro'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '3px 10px', background: filter === f ? '#4a9eff' : '#1a2a38',
            border: '1px solid #2a3a4a', borderRadius: 3, color: filter === f ? '#000' : '#888',
            cursor: 'pointer', fontSize: 10, fontFamily: 'monospace',
          }}>{f}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((s, i) => {
          const barPct = Math.abs(s.portfolio_loss_pct / minLoss) * 100;
          return (
            <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <span style={{ color: '#ccc', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' }}>{s.name}</span>
                  {s.date && <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', marginLeft: 8 }}>{s.date}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 8, fontFamily: 'monospace', color: confColor(s.confidence),
                    border: `1px solid ${confColor(s.confidence)}44`, padding: '1px 5px', borderRadius: 2,
                  }}>{s.confidence} conf</span>
                  <span style={{ color: '#ff4466', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {s.portfolio_loss_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div style={{ width: `${barPct}%`, height: 4, background: '#ff4466', borderRadius: 1, opacity: 0.6, marginBottom: 4 }} />
              <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{s.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Component: Risk Decomposition ───────────────────────────────────────────

const DecompositionPanel: React.FC = () => {
  const total = FACTOR_ATTRIBUTIONS.reduce((s, f) => s + f.contribution_pct, 0);
  let cumPct = 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 8 }}>Risk Factor Attribution (% of Portfolio Variance)</div>

        {/* Stacked bar */}
        <div style={{ height: 28, display: 'flex', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
          {FACTOR_ATTRIBUTIONS.map((f, i) => (
            <div
              key={i}
              style={{ width: `${f.contribution_pct}%`, background: f.color, opacity: 0.8 }}
              title={`${f.factor}: ${f.contribution_pct.toFixed(1)}%`}
            />
          ))}
        </div>

        {/* Legend + detail */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FACTOR_ATTRIBUTIONS.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, background: f.color, borderRadius: 2 }} />
              <span style={{ color: '#888', fontSize: 9, fontFamily: 'monospace' }}>{f.factor}</span>
              <span style={{ color: f.color, fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>{f.contribution_pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div style={{ background: '#0e1c2e', borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#0a1628' }}>
              {['Factor', 'Risk Contribution', '% of Total', 'Standalone Vol', 'Marginal VaR'].map((h, i) => (
                <th key={i} style={{ padding: '7px 12px', color: '#555', textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FACTOR_ATTRIBUTIONS.map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
                <td style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, background: f.color, borderRadius: 1 }} />
                  <span style={{ color: '#ccc' }}>{f.factor}</span>
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: f.color, fontWeight: 'bold' }}>{f.contribution_pct.toFixed(1)}%</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#888' }}>{((f.contribution_pct / total) * 100).toFixed(1)}%</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#888' }}>{f.standalone_vol.toFixed(1)}%</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#888' }}>${(f.contribution_pct * 1200).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Component: Risk Limits ───────────────────────────────────────────────────

const RiskLimitsPanel: React.FC = () => {
  const statusColor = (s: 'ok' | 'warning' | 'breach') =>
    s === 'ok' ? '#00d4aa' : s === 'warning' ? '#ff9900' : '#ff4466';

  const breachCount = RISK_LIMITS.filter(l => l.status === 'breach').length;
  const warningCount = RISK_LIMITS.filter(l => l.status === 'warning').length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Limits OK', value: RISK_LIMITS.filter(l => l.status === 'ok').length, color: '#00d4aa' },
          { label: 'Warnings', value: warningCount, color: '#ff9900' },
          { label: 'Breaches', value: breachCount, color: '#ff4466' },
        ].map((item, i) => (
          <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '6px 14px' }}>
            <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>{item.label}</div>
            <div style={{ color: item.color, fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#0e1c2e', borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#0a1628' }}>
              {['Category', 'Metric', 'Current', 'Limit', 'Utilization', 'Status'].map((h, i) => (
                <th key={i} style={{ padding: '7px 12px', color: '#555', textAlign: i > 1 ? 'right' : 'left', borderBottom: '1px solid #1a2a38' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RISK_LIMITS.map((l, i) => {
              const utilization = l.current / l.limit;
              return (
                <tr key={i} style={{ borderBottom: '1px solid #0a1628', background: l.status === 'breach' ? '#ff446608' : 'transparent' }}>
                  <td style={{ padding: '6px 12px', color: '#666' }}>{l.category}</td>
                  <td style={{ padding: '6px 12px', color: '#888' }}>{l.metric}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: statusColor(l.status), fontWeight: l.status !== 'ok' ? 'bold' : 'normal' }}>
                    {l.unit === '$' ? `$${l.current.toLocaleString()}` : `${l.current}${l.unit}`}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#555' }}>
                    {l.unit === '$' ? `$${l.limit.toLocaleString()}` : `${l.limit}${l.unit}`}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <div style={{ width: 60, height: 6, background: '#0a1628', borderRadius: 2 }}>
                        <div style={{
                          width: `${Math.min(100, utilization * 100)}%`, height: '100%',
                          background: statusColor(l.status), borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ color: statusColor(l.status), fontSize: 9 }}>{(utilization * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 2, fontSize: 8, fontFamily: 'monospace',
                      background: `${statusColor(l.status)}22`, color: statusColor(l.status),
                    }}>{l.status.toUpperCase()}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Tab Navigation ───────────────────────────────────────────────────────────

const TABS: Array<{ id: RiskTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'var', label: 'VaR' },
  { id: 'drawdown', label: 'Drawdown' },
  { id: 'stress', label: 'Stress' },
  { id: 'decomposition', label: 'Decomposition' },
  { id: 'rolling', label: 'Rolling' },
  { id: 'tail', label: 'Tail Risk' },
  { id: 'limits', label: 'Risk Limits' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const RiskAnalysisPage: React.FC = () => {
  const [tab, setTab] = useState<RiskTab>('overview');
  const [portfolioValue] = useState(2_460_000);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const renderTab = () => {
    switch (tab) {
      case 'overview': return <RiskOverviewPanel />;
      case 'drawdown': return <DrawdownPanel />;
      case 'stress': return <StressPanel />;
      case 'decomposition': return <DecompositionPanel />;
      case 'limits': return <RiskLimitsPanel />;
      default: return (
        <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>
          Risk module "{tab}" — data loading…
        </div>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060e18', color: '#ccc' }}>
      {/* Header bar */}
      <div style={{
        height: 44, background: '#0a1628', borderBottom: '1px solid #1a2a38',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#ff4466', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>RISK ANALYSIS</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888' }}>
            Portfolio NAV: <b style={{ color: '#ddd' }}>${portfolioValue.toLocaleString()}</b>
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: 3, fontSize: 9, fontFamily: 'monospace',
            background: '#ff990022', color: '#ff9900', border: '1px solid #ff990033',
          }}>
            3 WARNINGS
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handleRefresh} style={{
            padding: '4px 12px', background: '#1a2a38', border: '1px solid #2a3a4a',
            borderRadius: 3, color: '#888', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace',
          }}>
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
          <span style={{ color: '#444', fontSize: 10, fontFamily: 'monospace' }}>As of: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', background: '#0a1628', borderBottom: '1px solid #1a2a38',
        padding: '0 16px', gap: 2, overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px', background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '2px solid #ff4466' : '2px solid transparent',
              color: tab === t.id ? '#ff4466' : '#666',
              cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {renderTab()}
      </div>
    </div>
  );
};

export default RiskAnalysisPage;
