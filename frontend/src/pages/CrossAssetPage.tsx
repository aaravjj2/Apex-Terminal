/**
 * CrossAssetPage.tsx
 * Cross-asset analytics hub.
 * Equity vs credit vs rates vs FX vs commodities.
 * Regime detection, inter-market correlations,
 * Fed model, carry analysis, and macro regimes.
 */

import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CrossView = 'overview' | 'returns' | 'correlations' | 'regimes' | 'carry' | 'fedmodel';

interface AssetReturn {
  asset: string;
  class: 'equity' | 'rates' | 'credit' | 'fx' | 'commodity' | 'crypto';
  ticker: string;
  price: number;
  d1: number;
  d5: number;
  d21: number;
  ytd: number;
  z_score_1y: number;
  vol_21d: number;
}

interface MacroRegime {
  name: string;
  phase: 'expansion' | 'slowdown' | 'contraction' | 'recovery';
  probability: number;
  equity_outlook: 'Bullish' | 'Neutral' | 'Bearish';
  duration_months: number;
  best_factors: string[];
}

interface CarryTrade {
  pair: string;
  long_rate: number;
  short_rate: number;
  carry: number;
  spot_chg_ytd: number;
  total_return: number;
  vol_30d: number;
  sharpe: number;
}

interface FedModelData {
  earnings_yield: number;
  real_10yr: number;
  equity_premium: number;
  fair_value_pe: number;
  actual_pe: number;
  overvalued_pct: number;
  historical_avg_premium: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const ASSETS: AssetReturn[] = [
  { asset: 'S&P 500', class: 'equity', ticker: 'SPX', price: 5284, d1: 0.4, d5: 1.8, d21: 3.2, ytd: 12.6, z_score_1y: 1.42, vol_21d: 11.2 },
  { asset: 'Nasdaq', class: 'equity', ticker: 'NDX', price: 18424, d1: 0.8, d5: 2.8, d21: 5.4, ytd: 16.8, z_score_1y: 1.64, vol_21d: 14.4 },
  { asset: 'Russell 2000', class: 'equity', ticker: 'RUT', price: 2082, d1: -0.2, d5: 0.4, d21: 1.6, ytd: 4.2, z_score_1y: 0.28, vol_21d: 18.4 },
  { asset: 'US 10Y Treasury', class: 'rates', ticker: 'TNX', price: 4.32, d1: 0.02, d5: -0.08, d21: -0.14, ytd: 0.24, z_score_1y: 0.84, vol_21d: 8.6 },
  { asset: 'US 2Y Treasury', class: 'rates', ticker: 'UST2Y', price: 4.82, d1: 0.01, d5: -0.04, d21: -0.06, ytd: 0.12, z_score_1y: 0.62, vol_21d: 6.4 },
  { asset: 'IG Credit Spread', class: 'credit', ticker: 'LQD', price: 78, d1: -2, d5: -6, d21: -12, ytd: -24, z_score_1y: -0.84, vol_21d: 4.2 },
  { asset: 'HY Spread', class: 'credit', ticker: 'HYG', price: 342, d1: -4, d5: -12, d21: -28, ytd: -68, z_score_1y: -1.22, vol_21d: 6.8 },
  { asset: 'EUR/USD', class: 'fx', ticker: 'EURUSD', price: 1.0842, d1: 0.12, d5: -0.28, d21: -0.42, ytd: -1.84, z_score_1y: -0.44, vol_21d: 6.2 },
  { asset: 'USD/JPY', class: 'fx', ticker: 'USDJPY', price: 149.82, d1: 0.24, d5: 0.84, d21: 2.14, ytd: 6.4, z_score_1y: 1.82, vol_21d: 8.4 },
  { asset: 'Gold', class: 'commodity', ticker: 'GC', price: 2382, d1: 0.6, d5: -0.4, d21: 2.4, ytd: 10.8, z_score_1y: 1.24, vol_21d: 12.4 },
  { asset: 'Oil (WTI)', class: 'commodity', ticker: 'CL', price: 78.42, d1: -0.8, d5: -2.4, d21: -4.2, ytd: -8.4, z_score_1y: -0.94, vol_21d: 24.6 },
  { asset: 'Bitcoin', class: 'crypto', ticker: 'BTC', price: 68420, d1: 2.4, d5: 6.8, d21: 18.4, ytd: 62.4, z_score_1y: 1.84, vol_21d: 48.4 },
];

const MACRO_REGIMES: MacroRegime[] = [
  { name: 'Risk-On Expansion', phase: 'expansion', probability: 0.54, equity_outlook: 'Bullish', duration_months: 8, best_factors: ['Momentum', 'Growth', 'Tech'] },
  { name: 'Late-Cycle Slowdown', phase: 'slowdown', probability: 0.28, equity_outlook: 'Neutral', duration_months: 4, best_factors: ['Quality', 'Value', 'Defensives'] },
  { name: 'Recession', phase: 'contraction', probability: 0.12, equity_outlook: 'Bearish', duration_months: 2, best_factors: ['Low Vol', 'Bonds', 'Cash'] },
  { name: 'Early Recovery', phase: 'recovery', probability: 0.06, equity_outlook: 'Bullish', duration_months: 1, best_factors: ['Small Cap', 'Cyclicals', 'High Beta'] },
];

const CARRY_TRADES: CarryTrade[] = [
  { pair: 'AUD/JPY', long_rate: 4.35, short_rate: 0.10, carry: 4.25, spot_chg_ytd: -2.4, total_return: 1.85, vol_30d: 9.4, sharpe: 0.68 },
  { pair: 'MXN/USD', long_rate: 11.25, short_rate: 5.33, carry: 5.92, spot_chg_ytd: 6.8, total_return: 12.72, vol_30d: 12.8, sharpe: 1.24 },
  { pair: 'NZD/JPY', long_rate: 5.50, short_rate: 0.10, carry: 5.40, spot_chg_ytd: -1.8, total_return: 3.60, vol_30d: 10.4, sharpe: 0.84 },
  { pair: 'BRL/USD', long_rate: 10.75, short_rate: 5.33, carry: 5.42, spot_chg_ytd: -4.2, total_return: 1.22, vol_30d: 18.6, sharpe: 0.42 },
  { pair: 'TRY/USD', long_rate: 45.00, short_rate: 5.33, carry: 39.67, spot_chg_ytd: -28.4, total_return: 11.27, vol_30d: 42.4, sharpe: 0.54 },
];

const FED_MODEL: FedModelData = {
  earnings_yield: 4.82,
  real_10yr: 2.14,
  equity_premium: 2.68,
  fair_value_pe: 20.8,
  actual_pe: 22.4,
  overvalued_pct: 7.7,
  historical_avg_premium: 3.14,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classColor(cls: AssetReturn['class']): string {
  return cls === 'equity' ? '#4a9eff' :
         cls === 'rates' ? '#ffcc00' :
         cls === 'credit' ? '#ff9900' :
         cls === 'fx' ? '#00d4aa' :
         cls === 'commodity' ? '#cc44ff' : '#ff6633';
}

// ─── Asset Returns Table ──────────────────────────────────────────────────────

const AssetReturnsTable: React.FC = () => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
    <thead>
      <tr style={{ background: '#0a1628' }}>
        {['Asset', 'Class', 'Ticker', 'Price', '1D%', '5D%', '21D%', 'YTD%', 'Vol 21D', 'Z-Score'].map((h, i) => (
          <th key={i} style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: i <= 2 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {ASSETS.map((a, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
          <td style={{ padding: '6px 10px', color: '#ccc', fontSize: 10 }}>{a.asset}</td>
          <td style={{ padding: '6px 10px' }}>
            <span style={{ color: classColor(a.class), fontSize: 8, fontFamily: 'monospace', background: `${classColor(a.class)}22`, padding: '1px 5px', borderRadius: 2 }}>
              {a.class.toUpperCase()}
            </span>
          </td>
          <td style={{ padding: '6px 10px', color: '#4a9eff', fontWeight: 'bold' }}>{a.ticker}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ddd' }}>{a.price.toLocaleString()}</td>
          {[a.d1, a.d5, a.d21, a.ytd].map((v, ci) => (
            <td key={ci} style={{ padding: '6px 10px', textAlign: 'right', color: v >= 0 ? '#00d4aa' : '#ff4466', fontWeight: 'bold' }}>
              {v >= 0 ? '+' : ''}{v.toFixed(2)}{a.class === 'rates' || a.class === 'credit' ? 'bp' : '%'}
            </td>
          ))}
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{a.vol_21d.toFixed(1)}%</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: Math.abs(a.z_score_1y) > 1.5 ? '#ff9900' : '#888' }}>
            {a.z_score_1y > 0 ? '+' : ''}{a.z_score_1y.toFixed(2)}σ
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Regime Panel ─────────────────────────────────────────────────────────────

const RegimePanel: React.FC = () => (
  <div>
    <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 12 }}>MACRO REGIME PROBABILITIES</h3>
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      {MACRO_REGIMES.map((r, i) => {
        const phaseColor = r.phase === 'expansion' ? '#00d4aa' : r.phase === 'recovery' ? '#4a9eff' :
                           r.phase === 'slowdown' ? '#ff9900' : '#ff4466';
        return (
          <div key={i} style={{ flex: 1, background: '#0e1c2e', borderRadius: 4, padding: '12px 16px', borderTop: `3px solid ${phaseColor}` }}>
            <div style={{ color: '#888', fontSize: 10, fontFamily: 'monospace', marginBottom: 4 }}>{r.name}</div>
            <div style={{ color: phaseColor, fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 8 }}>
              {(r.probability * 100).toFixed(0)}%
            </div>
            <div style={{ width: '100%', height: 6, background: '#0a1628', borderRadius: 3, marginBottom: 8 }}>
              <div style={{ width: `${r.probability * 100}%`, height: 6, background: phaseColor, borderRadius: 3 }} />
            </div>
            <div style={{ color: r.equity_outlook === 'Bullish' ? '#00d4aa' : r.equity_outlook === 'Bearish' ? '#ff4466' : '#888', fontSize: 9, fontFamily: 'monospace', marginBottom: 4 }}>
              Equity: {r.equity_outlook}
            </div>
            <div style={{ color: '#555', fontSize: 8, fontFamily: 'monospace' }}>Best: {r.best_factors.join(', ')}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Fed Model Panel ──────────────────────────────────────────────────────────

const FedModelPanel: React.FC = () => (
  <div style={{ display: 'flex', gap: 20 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 280 }}>
      {[
        { label: 'S&P 500 Earnings Yield', val: `${FED_MODEL.earnings_yield.toFixed(2)}%`, color: '#4a9eff' },
        { label: 'Real 10Y Treasury Yield', val: `${FED_MODEL.real_10yr.toFixed(2)}%`, color: '#ffcc00' },
        { label: 'Equity Risk Premium', val: `${FED_MODEL.equity_premium.toFixed(2)}%`, color: FED_MODEL.equity_premium > 0 ? '#00d4aa' : '#ff4466' },
        { label: 'Historical Avg ERP', val: `${FED_MODEL.historical_avg_premium.toFixed(2)}%`, color: '#888' },
        { label: 'Fed Model Fair Value P/E', val: `${FED_MODEL.fair_value_pe.toFixed(1)}x`, color: '#888' },
        { label: 'Actual P/E', val: `${FED_MODEL.actual_pe.toFixed(1)}x`, color: '#ccc' },
        { label: 'Overvaluation', val: `${FED_MODEL.overvalued_pct.toFixed(1)}%`, color: '#ff9900' },
      ].map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0e1c2e', borderRadius: 4 }}>
          <span style={{ color: '#888', fontSize: 10, fontFamily: 'monospace' }}>{item.label}</span>
          <span style={{ color: item.color, fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.val}</span>
        </div>
      ))}
    </div>
    <div style={{ flex: 1, background: '#0e1c2e', borderRadius: 4, padding: '12px 16px' }}>
      <h4 style={{ color: '#888', fontSize: 10, fontFamily: 'monospace', marginBottom: 12 }}>INTERPRETATION</h4>
      <div style={{ color: '#ff9900', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 8 }}>
        MODERATELY OVERVALUED ({FED_MODEL.overvalued_pct.toFixed(1)}%)
      </div>
      <p style={{ color: '#888', fontSize: 10, fontFamily: 'monospace', lineHeight: 1.6 }}>
        The equity risk premium of {FED_MODEL.equity_premium.toFixed(2)}% is below the historical average
        of {FED_MODEL.historical_avg_premium.toFixed(2)}%, suggesting equities are offering less
        compensation relative to bonds than usual. While not in extreme territory,
        the Fed Model implies modest downside risk relative to fair value.
      </p>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {[
          { label: 'Since 2020', val: '+142%' },
          { label: 'Annual Trend', val: '+18.4%' },
          { label: 'Bull/Bear', val: '2.4x' },
        ].map((item, i) => (
          <div key={i} style={{ background: '#0a1628', padding: '6px 10px', borderRadius: 4 }}>
            <div style={{ color: '#555', fontSize: 8, fontFamily: 'monospace' }}>{item.label}</div>
            <div style={{ color: '#4a9eff', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>{item.val}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Carry Table ──────────────────────────────────────────────────────────────

const CarryTable: React.FC = () => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
    <thead>
      <tr style={{ background: '#0a1628' }}>
        {['Pair', 'Long Rate', 'Short Rate', 'Net Carry', 'Spot YTD', 'Total Ret', 'Vol 30D', 'Sharpe'].map((h, i) => (
          <th key={i} style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid #1a2a38' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {CARRY_TRADES.sort((a, b) => b.sharpe - a.sharpe).map((c, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
          <td style={{ padding: '6px 10px', color: '#4a9eff', fontWeight: 'bold' }}>{c.pair}</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#00d4aa' }}>{c.long_rate.toFixed(2)}%</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ff4466' }}>{c.short_rate.toFixed(2)}%</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ffcc00', fontWeight: 'bold' }}>{c.carry.toFixed(2)}%</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: c.spot_chg_ytd >= 0 ? '#00d4aa' : '#ff4466' }}>
            {c.spot_chg_ytd >= 0 ? '+' : ''}{c.spot_chg_ytd.toFixed(1)}%
          </td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: c.total_return >= 0 ? '#00d4aa' : '#ff4466', fontWeight: 'bold' }}>
            {c.total_return >= 0 ? '+' : ''}{c.total_return.toFixed(2)}%
          </td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{c.vol_30d.toFixed(1)}%</td>
          <td style={{ padding: '6px 10px', textAlign: 'right', color: c.sharpe >= 0.8 ? '#00d4aa' : '#888', fontWeight: c.sharpe >= 0.8 ? 'bold' : 'normal' }}>
            {c.sharpe.toFixed(2)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const VIEW_TABS: Array<{ id: CrossView; label: string }> = [
  { id: 'overview', label: 'Asset Returns' },
  { id: 'returns', label: 'Return Heatmap' },
  { id: 'correlations', label: 'Correlations' },
  { id: 'regimes', label: 'Macro Regimes' },
  { id: 'carry', label: 'Carry Trades' },
  { id: 'fedmodel', label: 'Fed Model' },
];

export const CrossAssetPage: React.FC = () => {
  const [view, setView] = useState<CrossView>('overview');

  const renderView = () => {
    switch (view) {
      case 'overview': return <AssetReturnsTable />;
      case 'regimes': return <RegimePanel />;
      case 'carry': return <CarryTable />;
      case 'fedmodel': return <FedModelPanel />;
      default: return <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>Module: {view}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060e18', color: '#ccc' }}>
      <div style={{ height: 44, background: '#0a1628', borderBottom: '1px solid #1a2a38', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <span style={{ color: '#ffcc00', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>CROSS-ASSET ANALYTICS</span>
      </div>
      <div style={{ display: 'flex', background: '#0a1628', borderBottom: '1px solid #1a2a38', padding: '0 16px' }}>
        {VIEW_TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '8px 14px', background: 'transparent', border: 'none',
            borderBottom: view === t.id ? '2px solid #ffcc00' : '2px solid transparent',
            color: view === t.id ? '#ffcc00' : '#666', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {renderView()}
      </div>
    </div>
  );
};

export default CrossAssetPage;
