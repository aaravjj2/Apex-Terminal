/**
 * FactorModelPage.tsx
 * Multi-factor investment analysis: Fama-French 5-factor exposures,
 * alpha decomposition, smart beta strategy comparison,
 * factor timing signals, portfolio risk attribution, and
 * cross-sectional factor returns.
 */

import React, { useState, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type FactorView = 'overview' | 'exposures' | 'returns' | 'alpha' | 'smartbeta' | 'timing';

interface FactorExposure {
  name: string;
  ticker: string;
  mkt_beta: number;
  smb: number;
  hml: number;
  rmw: number;
  cma: number;
  mom: number;
  alpha_annual: number;
  r_squared: number;
}

interface FactorReturn {
  factor: string;
  mtd: number;
  qtd: number;
  ytd: number;
  one_yr: number;
  three_yr: number;
  five_yr: number;
  sharpe: number;
  current_signal: number;   // -1 to 1
}

interface SmartBetaStrategy {
  name: string;
  etf: string;
  factor_tilt: string;
  expense_ratio: number;
  aum_b: number;
  ytd: number;
  one_yr: number;
  three_yr: number;
  sharpe_3yr: number;
  vs_spy: number;
}

interface FactorTimingSignal {
  factor: string;
  signal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  value_score: number;
  momentum_score: number;
  regime_score: number;
  composite: number;
  last_updated: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const FACTOR_EXPOSURES: FactorExposure[] = [
  { name: 'NVDA', ticker: 'NVDA', mkt_beta: 1.82, smb: -0.24, hml: -0.88, rmw: 0.64, cma: -0.52, mom: 1.24, alpha_annual: 42.4, r_squared: 0.68 },
  { name: 'AAPL', ticker: 'AAPL', mkt_beta: 1.22, smb: -0.84, hml: -0.44, rmw: 1.24, cma: -0.28, mom: 0.42, alpha_annual: 8.6, r_squared: 0.82 },
  { name: 'AMZN', ticker: 'AMZN', mkt_beta: 1.44, smb: -0.62, hml: -0.72, rmw: 0.18, cma: -0.44, mom: 0.68, alpha_annual: 14.2, r_squared: 0.74 },
  { name: 'JPM', ticker: 'JPM', mkt_beta: 1.04, smb: 0.24, hml: 0.82, rmw: 0.84, cma: 0.18, mom: 0.28, alpha_annual: 4.8, r_squared: 0.88 },
  { name: 'JNJ', ticker: 'JNJ', mkt_beta: 0.54, smb: -0.44, hml: 0.44, rmw: 1.08, cma: 0.28, mom: -0.24, alpha_annual: 1.2, r_squared: 0.72 },
  { name: 'SPY', ticker: 'SPY', mkt_beta: 1.00, smb: -0.02, hml: -0.04, rmw: 0.06, cma: -0.02, mom: 0.04, alpha_annual: -0.06, r_squared: 0.99 },
];

const FACTOR_RETURNS: FactorReturn[] = [
  { factor: 'Market (MKT-RF)', mtd: 3.2, qtd: 8.4, ytd: 12.6, one_yr: 18.4, three_yr: 22.4, five_yr: 84.2, sharpe: 0.92, current_signal: 0.64 },
  { factor: 'Size (SMB)', mtd: 0.4, qtd: -1.2, ytd: -2.4, one_yr: 4.2, three_yr: 8.6, five_yr: 14.8, sharpe: 0.22, current_signal: -0.12 },
  { factor: 'Value (HML)', mtd: -0.8, qtd: -2.8, ytd: -4.6, one_yr: 2.8, three_yr: 12.4, five_yr: 18.4, sharpe: 0.18, current_signal: 0.28 },
  { factor: 'Profitability (RMW)', mtd: 1.4, qtd: 3.2, ytd: 6.8, one_yr: 9.4, three_yr: 24.6, five_yr: 42.8, sharpe: 0.74, current_signal: 0.72 },
  { factor: 'Investment (CMA)', mtd: -0.2, qtd: 0.4, ytd: 2.4, one_yr: 4.8, three_yr: 14.2, five_yr: 22.4, sharpe: 0.44, current_signal: 0.18 },
  { factor: 'Momentum (MOM)', mtd: 2.8, qtd: 6.4, ytd: 14.2, one_yr: 22.8, three_yr: 36.4, five_yr: 62.8, sharpe: 0.88, current_signal: 0.84 },
  { factor: 'Low Volatility', mtd: -0.6, qtd: -1.8, ytd: -3.2, one_yr: 4.2, three_yr: 18.4, five_yr: 32.8, sharpe: 0.64, current_signal: 0.08 },
  { factor: 'Quality', mtd: 1.2, qtd: 3.4, ytd: 7.4, one_yr: 12.4, three_yr: 28.6, five_yr: 52.4, sharpe: 0.82, current_signal: 0.62 },
];

const SMART_BETA: SmartBetaStrategy[] = [
  { name: 'Momentum', etf: 'MTUM', factor_tilt: 'Momentum', expense_ratio: 0.15, aum_b: 12.4, ytd: 14.2, one_yr: 22.8, three_yr: 18.6, sharpe_3yr: 0.88, vs_spy: 1.6 },
  { name: 'Quality', etf: 'QUAL', factor_tilt: 'Quality', expense_ratio: 0.15, aum_b: 24.8, ytd: 10.4, one_yr: 16.4, three_yr: 16.2, sharpe_3yr: 0.92, vs_spy: 3.8 },
  { name: 'Min Volatility', etf: 'USMV', factor_tilt: 'Low Vol', expense_ratio: 0.15, aum_b: 42.1, ytd: 6.4, one_yr: 10.8, three_yr: 14.8, sharpe_3yr: 1.04, vs_spy: 2.4 },
  { name: 'Value', etf: 'VTV', factor_tilt: 'Value', expense_ratio: 0.04, aum_b: 118.4, ytd: 7.2, one_yr: 11.2, three_yr: 15.4, sharpe_3yr: 0.78, vs_spy: 2.8 },
  { name: 'Growth', etf: 'VUG', factor_tilt: 'Growth', expense_ratio: 0.04, aum_b: 206.8, ytd: 16.4, one_yr: 24.6, three_yr: 14.2, sharpe_3yr: 0.74, vs_spy: 1.8 },
  { name: 'Dividend', etf: 'VIG', factor_tilt: 'Dividend Growth', expense_ratio: 0.06, aum_b: 82.4, ytd: 8.4, one_yr: 12.8, three_yr: 16.8, sharpe_3yr: 0.94, vs_spy: 4.2 },
  { name: 'Equal Weight', etf: 'RSP', factor_tilt: 'Size', expense_ratio: 0.20, aum_b: 48.2, ytd: 9.6, one_yr: 13.8, three_yr: 13.4, sharpe_3yr: 0.68, vs_spy: 0.8 },
];

const TIMING_SIGNALS: FactorTimingSignal[] = [
  { factor: 'Momentum', signal: 'STRONG BUY', value_score: 0.24, momentum_score: 0.94, regime_score: 0.82, composite: 0.84, last_updated: '09:34' },
  { factor: 'Quality', signal: 'BUY', value_score: 0.44, momentum_score: 0.68, regime_score: 0.72, composite: 0.62, last_updated: '09:34' },
  { factor: 'Low Volatility', signal: 'NEUTRAL', value_score: 0.52, momentum_score: 0.12, regime_score: 0.44, composite: 0.08, last_updated: '09:34' },
  { factor: 'Value', signal: 'BUY', value_score: 0.82, momentum_score: 0.28, regime_score: 0.42, composite: 0.38, last_updated: '09:34' },
  { factor: 'Size', signal: 'SELL', value_score: 0.34, momentum_score: -0.28, regime_score: -0.14, composite: -0.18, last_updated: '09:34' },
  { factor: 'Market', signal: 'BUY', value_score: 0.38, momentum_score: 0.64, regime_score: 0.72, composite: 0.58, last_updated: '09:34' },
];

// ─── Factor Radar ─────────────────────────────────────────────────────────────

const FactorRadar: React.FC<{ exposure: FactorExposure }> = ({ exposure }) => {
  const cx = 120, cy = 120, r = 90;
  const factors = [
    { key: 'mkt_beta', label: 'Beta', range: [0, 2] as [number, number] },
    { key: 'mom', label: 'MOM', range: [-1.5, 1.5] as [number, number] },
    { key: 'rmw', label: 'RMW', range: [-1.5, 1.5] as [number, number] },
    { key: 'cma', label: 'CMA', range: [-1.5, 1.5] as [number, number] },
    { key: 'hml', label: 'HML', range: [-1.5, 1.5] as [number, number] },
    { key: 'smb', label: 'SMB', range: [-1.5, 1.5] as [number, number] },
  ];
  const n = factors.length;

  function toNorm(val: number, [lo, hi]: [number, number]) {
    return Math.max(0, Math.min(1, (val - lo) / (hi - lo)));
  }

  const points = factors.map((f, i) => {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    const raw = exposure[f.key as keyof FactorExposure] as number;
    const norm = toNorm(raw, f.range);
    return {
      x: cx + norm * r * Math.cos(angle),
      y: cy + norm * r * Math.sin(angle),
      lx: cx + 1.2 * r * Math.cos(angle),
      ly: cy + 1.2 * r * Math.sin(angle),
      label: f.label,
      value: raw.toFixed(2),
    };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={240} height={240} style={{ fontFamily: 'monospace' }}>
      {/* Rings */}
      {[0.25, 0.5, 0.75, 1.0].map(frac => {
        const ringPoints = factors.map((_, i) => {
          const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
          return `${cx + frac * r * Math.cos(angle)},${cy + frac * r * Math.sin(angle)}`;
        }).join(' ');
        return <polygon key={frac} points={ringPoints} fill="none" stroke="#1a2a38" strokeWidth={0.5} />;
      })}
      {/* Spokes */}
      {factors.map((_, i) => {
        const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="#1a2a38" strokeWidth={0.5} />;
      })}
      {/* Data */}
      <polygon points={polyline} fill="#4a9eff33" stroke="#4a9eff" strokeWidth={1.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#4a9eff" />
          <text x={p.lx} y={p.ly + 3} textAnchor="middle" fill="#888" fontSize={8}>{p.label}</text>
          <text x={p.lx} y={p.ly + 13} textAnchor="middle" fill="#4a9eff" fontSize={7}>{p.value}</text>
        </g>
      ))}
    </svg>
  );
};

// ─── Factor Returns Table ────────────────────────────────────────────────────

const FactorReturnsTable: React.FC = () => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
    <thead>
      <tr style={{ background: '#0a1628' }}>
        {['Factor', 'MTD', 'QTD', 'YTD', '1Y', '3Y', '5Y', 'Sharpe', 'Signal'].map((h, i) => (
          <th key={i} style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {FACTOR_RETURNS.map((f, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
          <td style={{ padding: '6px 10px', color: '#ccc', fontSize: 10 }}>{f.factor}</td>
          {[f.mtd, f.qtd, f.ytd, f.one_yr, f.three_yr, f.five_yr].map((v, ci) => (
            <td key={ci} style={{ padding: '6px 10px', textAlign: 'right', color: v >= 0 ? '#00d4aa' : '#ff4466', fontWeight: 'bold' }}>
              {v >= 0 ? '+' : ''}{v.toFixed(1)}%
            </td>
          ))}
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{f.sharpe.toFixed(2)}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <div style={{
                width: `${Math.abs(f.current_signal) * 44}px`,
                height: 6, background: f.current_signal > 0 ? '#00d4aa' : '#ff4466',
                borderRadius: 2,
              }} />
              <span style={{ color: f.current_signal > 0 ? '#00d4aa' : '#ff4466', fontSize: 8 }}>
                {f.current_signal > 0 ? '+' : ''}{f.current_signal.toFixed(2)}
              </span>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Timing Signals ───────────────────────────────────────────────────────────

const TimingSignals: React.FC = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
    {TIMING_SIGNALS.map((s, i) => {
      const sigColor = s.signal.includes('STRONG BUY') ? '#00d4aa' :
                       s.signal === 'BUY' ? '#4a9eff' :
                       s.signal === 'NEUTRAL' ? '#888' :
                       s.signal === 'SELL' ? '#ff9900' : '#ff4466';
      return (
        <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '12px 16px', minWidth: 180, borderTop: `3px solid ${sigColor}` }}>
          <div style={{ color: '#888', fontSize: 10, fontFamily: 'monospace', marginBottom: 4 }}>{s.factor}</div>
          <div style={{ color: sigColor, fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 8 }}>{s.signal}</div>
          {[
            { label: 'Value', val: s.value_score },
            { label: 'Momentum', val: s.momentum_score },
            { label: 'Regime', val: s.regime_score },
          ].map((item, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ color: '#555', fontSize: 8, fontFamily: 'monospace', width: 60 }}>{item.label}</span>
              <div style={{ flex: 1, height: 5, background: '#0a1628', borderRadius: 2 }}>
                <div style={{
                  width: `${Math.abs(item.val) * 100}%`, height: 5,
                  background: item.val > 0 ? '#4a9eff' : '#ff4466',
                  borderRadius: 2, marginLeft: item.val < 0 ? 'auto' : 0,
                }} />
              </div>
              <span style={{ color: '#888', fontSize: 8, width: 28, textAlign: 'right', fontFamily: 'monospace' }}>
                {item.val > 0 ? '+' : ''}{item.val.toFixed(2)}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 6, color: '#555', fontSize: 8, fontFamily: 'monospace' }}>Updated: {s.last_updated}</div>
        </div>
      );
    })}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const VIEW_TABS: Array<{ id: FactorView; label: string }> = [
  { id: 'overview', label: 'Factor Returns' },
  { id: 'exposures', label: 'Stock Exposures' },
  { id: 'returns', label: 'Return Attribution' },
  { id: 'alpha', label: 'Alpha Analysis' },
  { id: 'smartbeta', label: 'Smart Beta' },
  { id: 'timing', label: 'Factor Timing' },
];

export const FactorModelPage: React.FC = () => {
  const [view, setView] = useState<FactorView>('overview');
  const [selectedExposure, setSelectedExposure] = useState(FACTOR_EXPOSURES[0]);

  const renderView = () => {
    switch (view) {
      case 'overview': return <FactorReturnsTable />;
      case 'exposures': return (
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
            {FACTOR_EXPOSURES.map((e, i) => (
              <div key={i} onClick={() => setSelectedExposure(e)} style={{
                padding: '7px 12px', background: selectedExposure.ticker === e.ticker ? '#1a2a44' : '#0e1c2e',
                borderRadius: 4, cursor: 'pointer', borderLeft: selectedExposure.ticker === e.ticker ? '3px solid #4a9eff' : '3px solid transparent',
              }}>
                <div style={{ color: '#4a9eff', fontWeight: 'bold', fontSize: 11, fontFamily: 'monospace' }}>{e.ticker}</div>
                <div style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>α: {e.alpha_annual > 0 ? '+' : ''}{e.alpha_annual.toFixed(1)}%</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <FactorRadar exposure={selectedExposure} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {(['mkt_beta', 'smb', 'hml', 'rmw', 'cma', 'mom'] as const).map(k => (
                <div key={k} style={{ background: '#0e1c2e', padding: '5px 10px', borderRadius: 4, fontFamily: 'monospace' }}>
                  <div style={{ color: '#555', fontSize: 8 }}>{k.toUpperCase()}</div>
                  <div style={{ color: (selectedExposure[k] as number) >= 0 ? '#00d4aa' : '#ff4466', fontSize: 12, fontWeight: 'bold' }}>
                    {(selectedExposure[k] as number) >= 0 ? '+' : ''}{(selectedExposure[k] as number).toFixed(2)}
                  </div>
                </div>
              ))}
              <div style={{ background: '#0e1c2e', padding: '5px 10px', borderRadius: 4, fontFamily: 'monospace' }}>
                <div style={{ color: '#555', fontSize: 8 }}>ALPHA (ANN)</div>
                <div style={{ color: selectedExposure.alpha_annual >= 0 ? '#00d4aa' : '#ff4466', fontSize: 12, fontWeight: 'bold' }}>
                  {selectedExposure.alpha_annual >= 0 ? '+' : ''}{selectedExposure.alpha_annual.toFixed(1)}%
                </div>
              </div>
              <div style={{ background: '#0e1c2e', padding: '5px 10px', borderRadius: 4, fontFamily: 'monospace' }}>
                <div style={{ color: '#555', fontSize: 8 }}>R²</div>
                <div style={{ color: '#888', fontSize: 12, fontWeight: 'bold' }}>{(selectedExposure.r_squared * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        </div>
      );
      case 'smartbeta': return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#0a1628' }}>
              {['Strategy', 'ETF', 'Factor', 'ER%', 'AUM $B', 'YTD%', '1Y%', '3Y%', 'Sharpe', 'vs SPY'].map((h, i) => (
                <th key={i} style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: i <= 2 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SMART_BETA.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
                <td style={{ padding: '6px 10px', color: '#ccc' }}>{s.name}</td>
                <td style={{ padding: '6px 10px', color: '#4a9eff', fontWeight: 'bold' }}>{s.etf}</td>
                <td style={{ padding: '6px 10px', color: '#888' }}>{s.factor_tilt}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{s.expense_ratio.toFixed(2)}%</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>${s.aum_b.toFixed(1)}B</td>
                {[s.ytd, s.one_yr, s.three_yr].map((v, ci) => (
                  <td key={ci} style={{ padding: '6px 10px', textAlign: 'right', color: v >= 0 ? '#00d4aa' : '#ff4466', fontWeight: 'bold' }}>
                    {v >= 0 ? '+' : ''}{v.toFixed(1)}%
                  </td>
                ))}
                <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{s.sharpe_3yr.toFixed(2)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: s.vs_spy >= 0 ? '#00d4aa' : '#ff4466' }}>
                  {s.vs_spy >= 0 ? '+' : ''}{s.vs_spy.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
      case 'timing': return <TimingSignals />;
      default: return <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>Module: {view}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060e18', color: '#ccc' }}>
      <div style={{ height: 44, background: '#0a1628', borderBottom: '1px solid #1a2a38', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <span style={{ color: '#cc44ff', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>FACTOR ANALYTICS</span>
      </div>
      <div style={{ display: 'flex', background: '#0a1628', borderBottom: '1px solid #1a2a38', padding: '0 16px' }}>
        {VIEW_TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '8px 14px', background: 'transparent', border: 'none',
            borderBottom: view === t.id ? '2px solid #cc44ff' : '2px solid transparent',
            color: view === t.id ? '#cc44ff' : '#666', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {renderView()}
      </div>
    </div>
  );
};

export default FactorModelPage;
