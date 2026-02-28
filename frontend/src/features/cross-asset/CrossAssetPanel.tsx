/**
 * CrossAssetPanel.tsx
 * Bloomberg-style Cross-Asset Analysis Panel for Apex Terminal.
 * Shows asset correlations, risk-on/off regimes, carry trades, FX, Fed model, and flight-to-safety signals.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetClass = 'equities' | 'bonds' | 'commodities' | 'currencies' | 'crypto' | 'real_estate' | 'alternatives';

interface AssetReturn {
  asset: string;
  asset_class: AssetClass;
  return_1d: number;
  return_1w: number;
  return_1m: number;
  return_3m: number;
  return_ytd: number;
  volatility: number;
}

interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];
  period: string;
}

interface RollingCorrelation {
  asset_a: string;
  asset_b: string;
  correlations: number[];
  dates: string[];
  current: number;
  average: number;
  is_breakdown: boolean;
}

interface RiskRegime {
  regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' | 'TRANSITION';
  confidence: number;
  equity_vol: number;
  credit_spread: number;
  vix: number;
  gold_ratio: number;
  yen_strength: number;
  description: string;
}

interface CarryTrade {
  symbol: string;
  carry_yield: number; // annualized carry
  spot_return: number;
  total_return: number;
  sharpe: number;
  rank: number;
  asset_class: AssetClass;
}

interface FedModel {
  earnings_yield: number;
  bond_yield: number;
  equity_risk_premium: number;
  signal: 'EQUITIES_CHEAP' | 'EQUITIES_EXPENSIVE' | 'FAIRLY_VALUED';
  z_score: number;
}

interface FlightToSafety {
  detected: boolean;
  confidence: number;
  safe_havens: string[];
  risk_assets: string[];
  gold_return: number;
  yen_return: number;
  tlt_return: number;
  vix_change: number;
}

interface CrossAssetDashboard {
  returns: AssetReturn[];
  correlation_matrix: CorrelationMatrix;
  risk_regime: RiskRegime;
  carry_trades: CarryTrade[];
  fed_model: FedModel;
  flight_to_safety: FlightToSafety;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  equities: '#00aaff',
  bonds: '#88ccff',
  commodities: '#f7931a',
  currencies: '#00d4aa',
  crypto: '#ff9900',
  real_estate: '#cc88ff',
  alternatives: '#ffcc00',
};

const RISK_REGIME_COLORS: Record<string, string> = {
  RISK_ON: '#00d4aa',
  RISK_OFF: '#ff4444',
  NEUTRAL: '#ffcc00',
  TRANSITION: '#ff9900',
};

const FED_MODEL_COLORS: Record<string, string> = {
  EQUITIES_CHEAP: '#00d4aa',
  EQUITIES_EXPENSIVE: '#ff4444',
  FAIRLY_VALUED: '#ffcc00',
};

const BENCHMARK_ASSETS = [
  { asset: 'SPY', asset_class: 'equities' as AssetClass },
  { asset: 'QQQ', asset_class: 'equities' as AssetClass },
  { asset: 'TLT', asset_class: 'bonds' as AssetClass },
  { asset: 'AGG', asset_class: 'bonds' as AssetClass },
  { asset: 'GLD', asset_class: 'commodities' as AssetClass },
  { asset: 'USO', asset_class: 'commodities' as AssetClass },
  { asset: 'EURUSD', asset_class: 'currencies' as AssetClass },
  { asset: 'USDJPY', asset_class: 'currencies' as AssetClass },
  { asset: 'BTC', asset_class: 'crypto' as AssetClass },
  { asset: 'ETH', asset_class: 'crypto' as AssetClass },
  { asset: 'VNQ', asset_class: 'real_estate' as AssetClass },
];

// ─── Mock Data Factory ────────────────────────────────────────────────────────

function rnd(a: number, b: number): number { return a + Math.random() * (b - a); }
function randn(): number {
  const u = 1 - Math.random(); const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateMockDashboard(): CrossAssetDashboard {
  const returns: AssetReturn[] = BENCHMARK_ASSETS.map(a => ({
    ...a,
    return_1d: randn() * 0.015,
    return_1w: randn() * 0.035,
    return_1m: randn() * 0.07,
    return_3m: randn() * 0.12,
    return_ytd: randn() * 0.18,
    volatility: rnd(0.05, 0.45),
  }));

  const assets = BENCHMARK_ASSETS.map(a => a.asset);
  const n = assets.length;
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      if (i === j) return 1;
      const base = randn() * 0.4;
      return Math.max(-0.95, Math.min(0.95, base));
    })
  );
  // Symmetrize
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      matrix[j][i] = matrix[i][j];
    }
  }

  const carry_trades: CarryTrade[] = BENCHMARK_ASSETS.slice(0, 8).map((a, i) => ({
    symbol: a.asset,
    carry_yield: rnd(-0.02, 0.12),
    spot_return: randn() * 0.08,
    total_return: randn() * 0.10,
    sharpe: randn() * 1.2,
    rank: i + 1,
    asset_class: a.asset_class,
  })).sort((a, b) => b.carry_yield - a.carry_yield)
     .map((c, i) => ({ ...c, rank: i + 1 }));

  return {
    returns,
    correlation_matrix: { assets, matrix, period: '90D' },
    risk_regime: {
      regime: Math.random() > 0.5 ? 'RISK_ON' : 'RISK_OFF',
      confidence: rnd(0.55, 0.92),
      equity_vol: rnd(12, 35),
      credit_spread: rnd(50, 350),
      vix: rnd(14, 45),
      gold_ratio: rnd(0.8, 1.2),
      yen_strength: rnd(-5, 5),
      description: 'Equity volatility elevated; credit spreads widening; defensives outperforming',
    },
    carry_trades,
    fed_model: {
      earnings_yield: rnd(0.03, 0.07),
      bond_yield: rnd(0.03, 0.06),
      equity_risk_premium: rnd(-0.01, 0.03),
      signal: 'EQUITIES_CHEAP',
      z_score: randn() * 1.5,
    },
    flight_to_safety: {
      detected: Math.random() > 0.6,
      confidence: rnd(0.4, 0.9),
      safe_havens: ['TLT', 'GLD', 'USDJPY', 'CHF'],
      risk_assets: ['SPY', 'HYG', 'EEM', 'BTC'],
      gold_return: rnd(0.005, 0.04),
      yen_return: rnd(0.003, 0.025),
      tlt_return: rnd(0.002, 0.02),
      vix_change: rnd(10, 40),
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface ReturnTableProps {
  returns: AssetReturn[];
  period: '1d' | '1w' | '1m' | '3m' | 'ytd';
}

const ReturnTable: React.FC<ReturnTableProps> = ({ returns, period }) => {
  const key = `return_${period}` as keyof AssetReturn;
  const sorted = [...returns].sort((a, b) => (b[key] as number) - (a[key] as number));

  return (
    <table className="cross-asset-table">
      <thead>
        <tr>
          <th>Asset</th>
          <th>Class</th>
          <th>{period.toUpperCase()}</th>
          <th>Vol (Ann.)</th>
          <th>Bar</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => {
          const ret = r[key] as number;
          const color = ASSET_CLASS_COLORS[r.asset_class];
          const retColor = ret > 0.005 ? '#00d4aa' : ret < -0.005 ? '#ff4444' : '#ffcc00';
          const barW = Math.abs(ret) / 0.2 * 80;
          return (
            <tr key={r.asset} className="cross-asset-row">
              <td className="ca-symbol" style={{ color }}>{r.asset}</td>
              <td className="ca-class">
                <span className="class-badge" style={{ borderColor: `${color}44`, color }}>{r.asset_class}</span>
              </td>
              <td style={{ color: retColor, fontWeight: 'bold' }}>
                {ret > 0 ? '+' : ''}{(ret * 100).toFixed(2)}%
              </td>
              <td>{(r.volatility * 100).toFixed(1)}%</td>
              <td>
                <div className="ca-bar">
                  <div className="ca-bar__fill" style={{ width: `${Math.min(barW, 100)}%`, backgroundColor: `${retColor}66` }} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

interface CorrelationHeatmapProps {
  matrix: CorrelationMatrix;
}

function corrToColor(v: number): string {
  if (v >= 0.7) return '#cc0000';
  if (v >= 0.3) return '#ff6666';
  if (v >= -0.3) return '#334455';
  if (v >= -0.7) return '#6699ff';
  return '#0066dd';
}

const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ matrix }) => (
  <div className="corr-heatmap-wrapper">
    <table className="corr-heatmap-table">
      <thead>
        <tr>
          <th></th>
          {matrix.assets.map(a => <th key={a} className="corr-col-header">{a}</th>)}
        </tr>
      </thead>
      <tbody>
        {matrix.assets.map((rowAsset, i) => (
          <tr key={rowAsset}>
            <td className="corr-row-label">{rowAsset}</td>
            {matrix.matrix[i].map((val, j) => (
              <td
                key={j}
                className="corr-cell"
                style={{ backgroundColor: `${corrToColor(val)}66`, color: corrToColor(val) }}
                title={`${rowAsset} vs ${matrix.assets[j]}: ${val.toFixed(3)}`}
              >
                {i === j ? '—' : val.toFixed(2)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface RiskRegimeIndicatorProps {
  regime: RiskRegime;
}

const RiskRegimeIndicator: React.FC<RiskRegimeIndicatorProps> = ({ regime }) => {
  const color = RISK_REGIME_COLORS[regime.regime] || '#888';
  return (
    <div className="risk-regime-indicator" style={{ borderColor: `${color}44` }}>
      <div className="rri__regime" style={{ color }}>
        {regime.regime === 'RISK_ON' ? '▲ RISK-ON' :
         regime.regime === 'RISK_OFF' ? '▼ RISK-OFF' :
         regime.regime === 'TRANSITION' ? '↔ TRANSITION' : '- NEUTRAL'}
      </div>
      <div className="rri__confidence">{(regime.confidence * 100).toFixed(0)}% confidence</div>
      <div className="rri__description">{regime.description}</div>
      <div className="rri__stats">
        <div className="rri-stat"><span>VIX</span><span style={{ color: regime.vix > 25 ? '#ff4444' : '#00d4aa' }}>{regime.vix.toFixed(1)}</span></div>
        <div className="rri-stat"><span>Eq. Vol</span><span>{regime.equity_vol.toFixed(1)}%</span></div>
        <div className="rri-stat"><span>Credit Spread</span><span>{regime.credit_spread.toFixed(0)}bp</span></div>
        <div className="rri-stat"><span>Gold Ratio</span><span>{regime.gold_ratio.toFixed(3)}</span></div>
        <div className="rri-stat"><span>JPY Strength</span><span style={{ color: regime.yen_strength > 1 ? '#00d4aa' : regime.yen_strength < -1 ? '#ff4444' : '#ffcc00' }}>
          {regime.yen_strength > 0 ? '+' : ''}{regime.yen_strength.toFixed(2)}%
        </span></div>
      </div>
    </div>
  );
};

interface CarryTableProps {
  carries: CarryTrade[];
}

const CarryTable: React.FC<CarryTableProps> = ({ carries }) => (
  <table className="carry-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>Asset</th>
        <th>Carry Yield</th>
        <th>Spot Return</th>
        <th>Total Return</th>
        <th>Sharpe</th>
      </tr>
    </thead>
    <tbody>
      {carries.map(c => {
        const color = ASSET_CLASS_COLORS[c.asset_class];
        const carryColor = c.carry_yield > 0.05 ? '#00d4aa' : c.carry_yield > 0 ? '#88cc88' : '#ff4444';
        const totalColor = c.total_return > 0 ? '#00d4aa' : '#ff4444';
        const sharpeColor = c.sharpe > 1 ? '#00d4aa' : c.sharpe > 0 ? '#ffcc00' : '#ff4444';
        return (
          <tr key={c.symbol} className="carry-row">
            <td className="carry-rank">#{c.rank}</td>
            <td className="carry-symbol" style={{ color }}>{c.symbol}</td>
            <td style={{ color: carryColor }}>{(c.carry_yield * 100).toFixed(2)}%</td>
            <td style={{ color: c.spot_return > 0 ? '#88cc88' : '#cc6666' }}>
              {c.spot_return > 0 ? '+' : ''}{(c.spot_return * 100).toFixed(2)}%
            </td>
            <td style={{ color: totalColor, fontWeight: 'bold' }}>
              {c.total_return > 0 ? '+' : ''}{(c.total_return * 100).toFixed(2)}%
            </td>
            <td style={{ color: sharpeColor }}>{c.sharpe.toFixed(2)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

interface FedModelDisplayProps {
  model: FedModel;
}

const FedModelDisplay: React.FC<FedModelDisplayProps> = ({ model }) => {
  const signalColor = FED_MODEL_COLORS[model.signal] || '#888';
  const erp = model.equity_risk_premium;
  const erpColor = erp > 0.01 ? '#00d4aa' : erp > -0.01 ? '#ffcc00' : '#ff4444';

  return (
    <div className="fed-model-display">
      <div className="fed-model-signal" style={{ color: signalColor }}>
        {model.signal.replace(/_/g, ' ')}
      </div>
      <div className="fed-model-stats">
        <div className="fmd-row">
          <span>Earnings Yield (E/P)</span>
          <span style={{ color: '#00d4aa' }}>{(model.earnings_yield * 100).toFixed(2)}%</span>
        </div>
        <div className="fmd-row">
          <span>10Y Bond Yield</span>
          <span style={{ color: '#88ccff' }}>{(model.bond_yield * 100).toFixed(2)}%</span>
        </div>
        <div className="fmd-row fmd-row--highlighted">
          <span>Equity Risk Premium</span>
          <span style={{ color: erpColor, fontWeight: 'bold' }}>
            {erp > 0 ? '+' : ''}{(erp * 100).toFixed(2)}%
          </span>
        </div>
        <div className="fmd-row">
          <span>Z-Score</span>
          <span>{model.z_score.toFixed(2)}σ</span>
        </div>
      </div>

      {/* Visual gauge */}
      <div className="fed-model-gauge">
        <span style={{ color: '#ff4444' }}>Expensive</span>
        <div className="fed-gauge-track">
          <div className="fed-gauge-fill" style={{
            left: `${Math.max(0, Math.min(100, 50 + model.z_score * 20))}%`,
            backgroundColor: signalColor,
          }} />
        </div>
        <span style={{ color: '#00d4aa' }}>Cheap</span>
      </div>
    </div>
  );
};

interface FlightToSafetyAlertProps {
  fts: FlightToSafety;
}

const FlightToSafetyAlert: React.FC<FlightToSafetyAlertProps> = ({ fts }) => {
  const color = fts.detected ? '#ff9900' : '#666';
  return (
    <div className="fts-alert" style={{ borderColor: `${color}55` }}>
      <div className="fts-status">
        <span className="fts-indicator" style={{ backgroundColor: color }} />
        <span className="fts-title" style={{ color }}>
          {fts.detected ? '⚠ FLIGHT-TO-SAFETY DETECTED' : 'No Flight-to-Safety Signal'}
        </span>
        <span className="fts-confidence">{(fts.confidence * 100).toFixed(0)}% confidence</span>
      </div>

      {fts.detected && (
        <div className="fts-details">
          <div className="fts-col">
            <div className="fts-col-title" style={{ color: '#00d4aa' }}>Safe Haven Inflows</div>
            {fts.safe_havens.map(a => <span key={a} className="fts-asset">{a}</span>)}
          </div>
          <div className="fts-col">
            <div className="fts-col-title" style={{ color: '#ff4444' }}>Risk Asset Outflows</div>
            {fts.risk_assets.map(a => <span key={a} className="fts-risk-asset">{a}</span>)}
          </div>
          <div className="fts-signals">
            <div className="fts-sig"><span>Gold</span><span style={{ color: '#00d4aa' }}>+{(fts.gold_return * 100).toFixed(2)}%</span></div>
            <div className="fts-sig"><span>JPY</span><span style={{ color: '#00d4aa' }}>+{(fts.yen_return * 100).toFixed(2)}%</span></div>
            <div className="fts-sig"><span>TLT</span><span style={{ color: '#00d4aa' }}>+{(fts.tlt_return * 100).toFixed(2)}%</span></div>
            <div className="fts-sig"><span>VIX Δ</span><span style={{ color: '#ff9900' }}>+{fts.vix_change.toFixed(1)}%</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export interface CrossAssetPanelProps {
  className?: string;
  onRefresh?: () => Promise<CrossAssetDashboard>;
  refreshIntervalMs?: number;
}

type CrossAssetTab = 'overview' | 'returns' | 'correlation' | 'regime' | 'carry' | 'fed-model';
type ReturnPeriod = '1d' | '1w' | '1m' | '3m' | 'ytd';

const CrossAssetPanel: React.FC<CrossAssetPanelProps> = ({
  className = '',
  onRefresh,
  refreshIntervalMs = 60000,
}) => {
  const [activeTab, setActiveTab] = useState<CrossAssetTab>('overview');
  const [returnPeriod, setReturnPeriod] = useState<ReturnPeriod>('1d');
  const [data, setData] = useState<CrossAssetDashboard>(generateMockDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!onRefresh) {
      setData(generateMockDashboard());
      setLastUpdate(new Date());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await onRefresh();
      setData(result);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cross-asset data');
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, refreshIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh, refreshIntervalMs]);

  const topGainer = useMemo(() => {
    const key = `return_${returnPeriod}` as keyof AssetReturn;
    return [...data.returns].sort((a, b) => (b[key] as number) - (a[key] as number))[0];
  }, [data.returns, returnPeriod]);

  const topLoser = useMemo(() => {
    const key = `return_${returnPeriod}` as keyof AssetReturn;
    return [...data.returns].sort((a, b) => (a[key] as number) - (b[key] as number))[0];
  }, [data.returns, returnPeriod]);

  const regimeColor = RISK_REGIME_COLORS[data.risk_regime.regime] || '#888';

  const tabs: { id: CrossAssetTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'returns', label: 'Returns', icon: '↑↓' },
    { id: 'correlation', label: 'Correlation', icon: '⊡' },
    { id: 'regime', label: 'Risk Regime', icon: '⚡' },
    { id: 'carry', label: 'Carry', icon: '₿' },
    { id: 'fed-model', label: 'Fed Model', icon: 'Ω' },
  ];

  return (
    <div className={`cross-asset-panel ${className}`}>
      {/* Header */}
      <div className="cross-asset-panel__header">
        <div className="cross-asset-panel__title">⊞ CROSS-ASSET</div>
        <div className="cross-asset-panel__controls">
          <div className="regime-chip" style={{ borderColor: `${regimeColor}44`, color: regimeColor }}>
            {data.risk_regime.regime.replace(/_/g, '-')}
          </div>
          <span className="update-time">{loading ? 'Updating...' : lastUpdate.toLocaleTimeString()}</span>
          <button className="btn btn--icon" onClick={refresh} disabled={loading}>⟳</button>
        </div>
      </div>

      {error && <div className="panel-error">⚠ {error}</div>}

      {/* Tabs */}
      <div className="cross-asset-panel__tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`ca-tab${activeTab === t.id ? ' ca-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="cross-asset-panel__content">

        {activeTab === 'overview' && (
          <div className="ca-overview">
            {/* Regime */}
            <div className="ca-overview__regime">
              <h3 className="panel-title">Risk Regime</h3>
              <RiskRegimeIndicator regime={data.risk_regime} />
            </div>

            {/* Top movers */}
            <div className="ca-overview__movers">
              <h3 className="panel-title">Best / Worst (1D)</h3>
              <div className="mover-cards">
                <div className="mover-card mover-card--bull">
                  <div className="mover-card__label">Best</div>
                  <div className="mover-card__asset" style={{ color: '#00d4aa' }}>{topGainer?.asset}</div>
                  <div className="mover-card__return" style={{ color: '#00d4aa' }}>
                    +{((topGainer?.return_1d || 0) * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="mover-card mover-card--bear">
                  <div className="mover-card__label">Worst</div>
                  <div className="mover-card__asset" style={{ color: '#ff4444' }}>{topLoser?.asset}</div>
                  <div className="mover-card__return" style={{ color: '#ff4444' }}>
                    {((topLoser?.return_1d || 0) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            {/* FTS */}
            <div className="ca-overview__fts">
              <h3 className="panel-title">Flight-to-Safety</h3>
              <FlightToSafetyAlert fts={data.flight_to_safety} />
            </div>

            {/* Fed Model summary */}
            <div className="ca-overview__fed">
              <h3 className="panel-title">Fed Model Signal</h3>
              <FedModelDisplay model={data.fed_model} />
            </div>
          </div>
        )}

        {activeTab === 'returns' && (
          <div className="returns-view">
            <div className="period-selector">
              {(['1d', '1w', '1m', '3m', 'ytd'] as ReturnPeriod[]).map(p => (
                <button
                  key={p}
                  className={`period-btn${returnPeriod === p ? ' period-btn--active' : ''}`}
                  onClick={() => setReturnPeriod(p)}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
            <ReturnTable returns={data.returns} period={returnPeriod} />
          </div>
        )}

        {activeTab === 'correlation' && (
          <div className="correlation-view">
            <h3 className="panel-title">Cross-Asset Correlation Matrix ({data.correlation_matrix.period})</h3>
            <div className="corr-legend">
              <span style={{ color: '#cc0000' }}>■ Strong Positive</span>
              <span style={{ color: '#334455' }}>■ Neutral</span>
              <span style={{ color: '#0066dd' }}>■ Strong Negative</span>
            </div>
            <CorrelationHeatmap matrix={data.correlation_matrix} />
          </div>
        )}

        {activeTab === 'regime' && (
          <div className="regime-view">
            <h3 className="panel-title">Risk On / Risk Off Regime</h3>
            <RiskRegimeIndicator regime={data.risk_regime} />
          </div>
        )}

        {activeTab === 'carry' && (
          <div className="carry-view">
            <h3 className="panel-title">Carry Trade Ranking</h3>
            <p className="panel-subtitle">Assets ranked by carry yield (income return excluding spot movement)</p>
            <CarryTable carries={data.carry_trades} />
          </div>
        )}

        {activeTab === 'fed-model' && (
          <div className="fed-model-view">
            <h3 className="panel-title">Fed Model — Equity vs Bond Valuation</h3>
            <p className="panel-subtitle">Compares S&P 500 earnings yield to 10Y Treasury yield; positive ERP = equities cheap</p>
            <FedModelDisplay model={data.fed_model} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossAssetPanel;
export type { CrossAssetDashboard, RiskRegime, CarryTrade, FedModel, FlightToSafety };
