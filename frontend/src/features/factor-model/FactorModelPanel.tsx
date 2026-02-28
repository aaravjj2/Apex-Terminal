/**
 * FactorModelPanel.tsx
 * Bloomberg-style Multi-Factor Model Panel for Apex Terminal.
 * Displays Fama-French factor scores, factor attribution, smart-beta signals, portfolio construction.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FactorScore {
  symbol: string;
  value_score: number;    // -2 to 2 z-score
  momentum_score: number;
  quality_score: number;
  low_vol_score: number;
  size_score: number;
  profitability_score: number;
  investment_score: number;
  composite_score: number;
  rank: number;
}

interface FamaFrenchAlpha {
  symbol: string;
  alpha: number;
  alpha_tstat: number;
  mkt_beta: number;
  smb_beta: number;
  hml_beta: number;
  rmw_beta?: number;
  cma_beta?: number;
  r_squared: number;
  model: 'FF3' | 'FF5';
}

interface FactorAttribution {
  symbol: string;
  total_return: number;
  factor_returns: {
    market: number;
    size: number;
    value: number;
    momentum: number;
    quality: number;
    low_vol: number;
    alpha: number;
  };
}

interface SmartBetaSignal {
  strategy: string;
  description: string;
  signal: 'BUY' | 'NEUTRAL' | 'SELL' | 'OVERWEIGHT' | 'UNDERWEIGHT';
  conviction: number; // 0-1
  expected_premium?: number;
}

interface FactorTilt {
  phase: string;
  preferred_factors: string[];
  avoid_factors: string[];
  rationale: string;
  estimated_return_premium: number;
}

interface FactorModelDashboard {
  scores: FactorScore[];
  alpha_results: FamaFrenchAlpha[];
  attribution: FactorAttribution[];
  smart_beta_signals: SmartBetaSignal[];
  current_phase: string;
  factor_tilts: FactorTilt[];
  factor_returns_ytd: Record<string, number>;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FACTOR_LABELS: Record<string, string> = {
  value_score: 'Value',
  momentum_score: 'Momentum',
  quality_score: 'Quality',
  low_vol_score: 'Low Vol',
  size_score: 'Size',
  profitability_score: 'Profitability',
  investment_score: 'Investment',
  composite_score: 'Composite',
};

const FACTOR_COLORS: Record<string, string> = {
  value: '#f7931a',
  momentum: '#00aaff',
  quality: '#00d4aa',
  low_vol: '#88ccff',
  size: '#cc88ff',
  profitability: '#ffcc00',
  investment: '#ff9900',
  market: '#888',
  alpha: '#00d4aa',
};

const BETA_COLOR = '#88ccff';
const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK', 'JPM', 'JNJ', 'V', 'WMT'];

// ─── Mock Data Factory ────────────────────────────────────────────────────────

function randn(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateMockDashboard(): FactorModelDashboard {
  const scores: FactorScore[] = SYMBOLS.map((sym, i) => ({
    symbol: sym,
    value_score: Math.max(-2, Math.min(2, randn())),
    momentum_score: Math.max(-2, Math.min(2, randn())),
    quality_score: Math.max(-2, Math.min(2, randn())),
    low_vol_score: Math.max(-2, Math.min(2, randn())),
    size_score: Math.max(-2, Math.min(2, randn())),
    profitability_score: Math.max(-2, Math.min(2, randn())),
    investment_score: Math.max(-2, Math.min(2, randn())),
    composite_score: Math.max(-2, Math.min(2, randn())),
    rank: i + 1,
  })).sort((a, b) => b.composite_score - a.composite_score)
     .map((s, i) => ({ ...s, rank: i + 1 }));

  const alpha_results: FamaFrenchAlpha[] = SYMBOLS.slice(0, 6).map(sym => ({
    symbol: sym,
    alpha: randn() * 0.0015,
    alpha_tstat: randn() * 1.5,
    mkt_beta: 0.8 + Math.random() * 0.6,
    smb_beta: randn() * 0.5,
    hml_beta: randn() * 0.5,
    rmw_beta: randn() * 0.3,
    cma_beta: randn() * 0.3,
    r_squared: 0.6 + Math.random() * 0.35,
    model: 'FF5',
  }));

  const attribution: FactorAttribution[] = SYMBOLS.slice(0, 5).map(sym => {
    const total_return = randn() * 0.1;
    return {
      symbol: sym,
      total_return,
      factor_returns: {
        market: total_return * (0.5 + Math.random() * 0.3),
        size: randn() * 0.02,
        value: randn() * 0.015,
        momentum: randn() * 0.025,
        quality: randn() * 0.012,
        low_vol: randn() * 0.008,
        alpha: randn() * 0.01,
      },
    };
  });

  const smart_beta_signals: SmartBetaSignal[] = [
    { strategy: 'Value Factor', description: 'Book-to-market and earnings yield', signal: 'OVERWEIGHT', conviction: 0.72, expected_premium: 0.035 },
    { strategy: 'Quality Factor', description: 'High ROE, low leverage, stable earnings', signal: 'OVERWEIGHT', conviction: 0.81, expected_premium: 0.028 },
    { strategy: 'Momentum Factor', description: '12-1 month price momentum', signal: 'NEUTRAL', conviction: 0.48, expected_premium: 0.012 },
    { strategy: 'Low Volatility', description: 'Minimum variance portfolio', signal: 'UNDERWEIGHT', conviction: 0.55, expected_premium: -0.008 },
    { strategy: 'Size Premium', description: 'Small-cap tilt (SMB)', signal: 'NEUTRAL', conviction: 0.38, expected_premium: 0.005 },
    { strategy: 'Profitability', description: 'RMW factor premium', signal: 'OVERWEIGHT', conviction: 0.64, expected_premium: 0.022 },
  ];

  const factor_tilts: FactorTilt[] = [
    {
      phase: 'Early Cycle',
      preferred_factors: ['momentum', 'size', 'value'],
      avoid_factors: ['low_vol', 'quality'],
      rationale: 'Risk appetite increases, cyclicals outperform',
      estimated_return_premium: 0.054,
    },
    {
      phase: 'Mid Cycle',
      preferred_factors: ['quality', 'profitability'],
      avoid_factors: ['value'],
      rationale: 'Earnings growth consistent, quality rewarded',
      estimated_return_premium: 0.038,
    },
    {
      phase: 'Late Cycle',
      preferred_factors: ['quality', 'low_vol'],
      avoid_factors: ['momentum', 'size'],
      rationale: 'Defensive posturing, lower beta preferred',
      estimated_return_premium: 0.022,
    },
    {
      phase: 'Recession',
      preferred_factors: ['low_vol', 'quality', 'value'],
      avoid_factors: ['momentum', 'size'],
      rationale: 'Capital preservation, stable earnings',
      estimated_return_premium: 0.01,
    },
  ];

  return {
    scores,
    alpha_results,
    attribution,
    smart_beta_signals,
    current_phase: 'Mid Cycle',
    factor_tilts,
    factor_returns_ytd: {
      market: 0.14,
      momentum: 0.22,
      quality: 0.08,
      value: -0.04,
      low_vol: -0.06,
      size: 0.03,
      profitability: 0.11,
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface FactorScoreHeatmapProps {
  scores: FactorScore[];
}

const HEATMAP_FACTORS: (keyof FactorScore)[] = [
  'value_score', 'momentum_score', 'quality_score', 'low_vol_score',
  'size_score', 'profitability_score', 'composite_score',
];

function scoreToColor(v: number): string {
  if (v >= 1.5) return '#00d4aa';
  if (v >= 0.5) return '#44cc88';
  if (v >= -0.5) return '#334455';
  if (v >= -1.5) return '#cc4444';
  return '#ff2222';
}

const FactorScoreHeatmap: React.FC<FactorScoreHeatmapProps> = ({ scores }) => (
  <div className="factor-heatmap-wrapper">
    <table className="factor-heatmap">
      <thead>
        <tr>
          <th>Symbol</th>
          {HEATMAP_FACTORS.map(f => (
            <th key={f as string} className="factor-col-header">{FACTOR_LABELS[f as string]}</th>
          ))}
          <th>Rank</th>
        </tr>
      </thead>
      <tbody>
        {scores.map(s => (
          <tr key={s.symbol} className="factor-row">
            <td className="factor-symbol">{s.symbol}</td>
            {HEATMAP_FACTORS.map(f => {
              const v = s[f] as number;
              return (
                <td
                  key={f as string}
                  className="factor-cell"
                  style={{ backgroundColor: `${scoreToColor(v)}33`, color: scoreToColor(v) }}
                >
                  {v.toFixed(2)}
                </td>
              );
            })}
            <td className="factor-rank">#{s.rank}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface AlphaTableProps {
  alphas: FamaFrenchAlpha[];
}

const AlphaTable: React.FC<AlphaTableProps> = ({ alphas }) => (
  <table className="alpha-table">
    <thead>
      <tr>
        <th>Symbol</th>
        <th>Model</th>
        <th>Alpha (ann.)</th>
        <th>t-stat</th>
        <th>Mkt β</th>
        <th>SMB β</th>
        <th>HML β</th>
        <th>RMW β</th>
        <th>CMA β</th>
        <th>R²</th>
      </tr>
    </thead>
    <tbody>
      {alphas.map(a => {
        const alphaAnn = a.alpha * 252;
        const alphaColor = alphaAnn > 0.02 ? '#00d4aa' : alphaAnn > 0 ? '#88cc88' : alphaAnn > -0.02 ? '#cc4444' : '#ff2222';
        const sigColor = Math.abs(a.alpha_tstat) > 2 ? '#ffcc00' : '#666';
        return (
          <tr key={a.symbol} className="alpha-row">
            <td className="alpha-symbol">{a.symbol}</td>
            <td className="alpha-model">{a.model}</td>
            <td style={{ color: alphaColor, fontWeight: 'bold' }}>
              {alphaAnn > 0 ? '+' : ''}{(alphaAnn * 100).toFixed(2)}%
            </td>
            <td style={{ color: sigColor }}>{a.alpha_tstat.toFixed(2)}</td>
            <td style={{ color: BETA_COLOR }}>{a.mkt_beta.toFixed(3)}</td>
            <td style={{ color: BETA_COLOR }}>{a.smb_beta.toFixed(3)}</td>
            <td style={{ color: BETA_COLOR }}>{a.hml_beta.toFixed(3)}</td>
            <td style={{ color: BETA_COLOR }}>{a.rmw_beta?.toFixed(3) ?? '—'}</td>
            <td style={{ color: BETA_COLOR }}>{a.cma_beta?.toFixed(3) ?? '—'}</td>
            <td>{(a.r_squared * 100).toFixed(1)}%</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

interface AttributionWaterfallProps {
  attribution: FactorAttribution;
}

const AttributionWaterfall: React.FC<AttributionWaterfallProps> = ({ attribution }) => {
  const factors = Object.entries(attribution.factor_returns) as [string, number][];
  const maxAbs = Math.max(...factors.map(([, v]) => Math.abs(v)), 0.01);
  const W = 320; const H = 120;
  const barH = 14;
  const barGap = 4;
  const startX = 80;
  const zeroX = startX + (W - startX - 20) / 2;

  return (
    <div className="attribution-waterfall">
      <div className="attribution-symbol">{attribution.symbol}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {factors.map(([factor, ret], i) => {
          const barW = Math.abs(ret) / maxAbs * ((W - startX - 20) / 2);
          const y = 10 + i * (barH + barGap);
          const x = ret >= 0 ? zeroX : zeroX - barW;
          const color = FACTOR_COLORS[factor] || '#888';
          return (
            <g key={factor}>
              <text x={startX - 4} y={y + barH * 0.7} textAnchor="end" fill="#aaa" fontSize="9">
                {factor.replace(/_/g, ' ')}
              </text>
              <rect x={x} y={y} width={barW} height={barH} fill={`${color}88`} rx="2" />
              <text x={x + (ret >= 0 ? barW + 3 : -3)} y={y + barH * 0.75}
                textAnchor={ret >= 0 ? 'start' : 'end'} fill={color} fontSize="9">
                {(ret * 100).toFixed(2)}%
              </text>
            </g>
          );
        })}
        {/* Zero line */}
        <line x1={zeroX} y1="0" x2={zeroX} y2={H} stroke="#334" strokeWidth="1" />
      </svg>
      <div className="attribution-total">
        Total: <span style={{ color: attribution.total_return >= 0 ? '#00d4aa' : '#ff4444' }}>
          {attribution.total_return > 0 ? '+' : ''}{(attribution.total_return * 100).toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

interface SmartBetaGridProps {
  signals: SmartBetaSignal[];
}

const SIGNAL_COLORS: Record<string, string> = {
  OVERWEIGHT: '#00d4aa',
  BUY: '#00d4aa',
  NEUTRAL: '#ffcc00',
  UNDERWEIGHT: '#ff9900',
  SELL: '#ff4444',
};

const SmartBetaGrid: React.FC<SmartBetaGridProps> = ({ signals }) => (
  <div className="smart-beta-grid">
    {signals.map(sig => {
      const color = SIGNAL_COLORS[sig.signal] || '#888';
      return (
        <div key={sig.strategy} className="smart-beta-card" style={{ borderTopColor: color }}>
          <div className="smart-beta-card__strategy">{sig.strategy}</div>
          <div className="smart-beta-card__signal" style={{ color }}>{sig.signal}</div>
          <div className="smart-beta-card__desc">{sig.description}</div>
          <div className="smart-beta-card__conviction">
            <div className="conviction-track">
              <div className="conviction-fill" style={{ width: `${sig.conviction * 100}%`, backgroundColor: `${color}88` }} />
            </div>
            <span className="conviction-label">{(sig.conviction * 100).toFixed(0)}% conviction</span>
          </div>
          {sig.expected_premium !== undefined && (
            <div className="smart-beta-card__premium" style={{ color: sig.expected_premium >= 0 ? '#00d4aa' : '#ff4444' }}>
              {sig.expected_premium >= 0 ? '+' : ''}{(sig.expected_premium * 100).toFixed(1)}% premium
            </div>
          )}
        </div>
      );
    })}
  </div>
);

interface FactorReturnsBarProps {
  ytd: Record<string, number>;
}

const FactorReturnsBar: React.FC<FactorReturnsBarProps> = ({ ytd }) => {
  const entries = Object.entries(ytd).sort((a, b) => b[1] - a[1]);
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.01);

  return (
    <div className="factor-returns-bars">
      {entries.map(([factor, ret]) => {
        const color = FACTOR_COLORS[factor] || '#888';
        const pct = Math.abs(ret) / maxAbs * 100;
        return (
          <div key={factor} className="factor-return-row">
            <div className="factor-return-label">{factor.charAt(0).toUpperCase() + factor.slice(1)}</div>
            <div className="factor-return-bar-track">
              <div
                className="factor-return-bar-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: `${color}66`,
                  marginLeft: ret < 0 ? `${(1 - pct / 100) * 50}%` : '50%',
                }}
              />
            </div>
            <div className="factor-return-value" style={{ color: ret >= 0 ? '#00d4aa' : '#ff4444' }}>
              {ret > 0 ? '+' : ''}{(ret * 100).toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface CycleTiltCardProps {
  tilt: FactorTilt;
  isCurrent: boolean;
}

const CycleTiltCard: React.FC<CycleTiltCardProps> = ({ tilt, isCurrent }) => (
  <div className={`cycle-tilt-card${isCurrent ? ' cycle-tilt-card--current' : ''}`}>
    <div className="cycle-tilt-card__phase">
      {isCurrent && <span className="current-badge">CURRENT</span>}
      {tilt.phase}
    </div>
    <div className="cycle-tilt-card__factors">
      <div className="tilt-preferred">
        <span className="tilt-label">Prefer:</span>
        {tilt.preferred_factors.map(f => (
          <span key={f} className="factor-chip factor-chip--prefer">{f.replace('_', ' ')}</span>
        ))}
      </div>
      <div className="tilt-avoid">
        <span className="tilt-label">Avoid:</span>
        {tilt.avoid_factors.map(f => (
          <span key={f} className="factor-chip factor-chip--avoid">{f.replace('_', ' ')}</span>
        ))}
      </div>
    </div>
    <div className="cycle-tilt-card__rationale">{tilt.rationale}</div>
    <div className="cycle-tilt-card__premium" style={{ color: tilt.estimated_return_premium >= 0.03 ? '#00d4aa' : '#ffcc00' }}>
      Est. Premium: +{(tilt.estimated_return_premium * 100).toFixed(1)}%
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FactorModelPanelProps {
  className?: string;
  onRefresh?: () => Promise<FactorModelDashboard>;
  refreshIntervalMs?: number;
}

type FactorTab = 'overview' | 'scores' | 'alpha' | 'attribution' | 'smart-beta' | 'cycle';

const FactorModelPanel: React.FC<FactorModelPanelProps> = ({
  className = '',
  onRefresh,
  refreshIntervalMs = 60000,
}) => {
  const [activeTab, setActiveTab] = useState<FactorTab>('overview');
  const [data, setData] = useState<FactorModelDashboard>(generateMockDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedAttrib, setSelectedAttrib] = useState<string | null>(null);
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
      setError(e instanceof Error ? e.message : 'Failed to load factor data');
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, refreshIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh, refreshIntervalMs]);

  const topStock = useMemo(() => data.scores[0], [data.scores]);
  const worstStock = useMemo(() => data.scores[data.scores.length - 1], [data.scores]);

  const selectedAttribData = useMemo(
    () => selectedAttrib ? data.attribution.find(a => a.symbol === selectedAttrib) : data.attribution[0],
    [selectedAttrib, data.attribution]
  );

  const overweightCount = data.smart_beta_signals.filter(s => s.signal === 'OVERWEIGHT' || s.signal === 'BUY').length;

  const tabs: { id: FactorTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'scores', label: 'Factor Scores', icon: '▦' },
    { id: 'alpha', label: 'FF Alpha', icon: 'α' },
    { id: 'attribution', label: 'Attribution', icon: '∑' },
    { id: 'smart-beta', label: 'Smart Beta', icon: '⚙' },
    { id: 'cycle', label: 'Cycle Tilts', icon: '⟳' },
  ];

  return (
    <div className={`factor-model-panel ${className}`}>
      {/* Header */}
      <div className="factor-model-panel__header">
        <div className="factor-model-panel__title">
          <span>⊞</span> FACTOR MODEL
        </div>
        <div className="factor-model-panel__controls">
          <div className="current-phase-badge">
            Phase: <span style={{ color: '#00d4aa' }}>{data.current_phase}</span>
          </div>
          <span className="update-time">{loading ? 'Updating...' : lastUpdate.toLocaleTimeString()}</span>
          <button className="btn btn--icon" onClick={refresh} disabled={loading}>⟳</button>
        </div>
      </div>

      {error && <div className="panel-error">⚠ {error}</div>}

      {/* Tabs */}
      <div className="factor-model-panel__tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`factor-tab${activeTab === t.id ? ' factor-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="factor-tab__icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="factor-model-panel__content">

        {activeTab === 'overview' && (
          <div className="factor-overview">
            {/* Summary stats */}
            <div className="factor-summary-row">
              <div className="factor-summary-card">
                <div className="fsc-label">Top Ranked</div>
                <div className="fsc-value" style={{ color: '#00d4aa' }}>{topStock?.symbol}</div>
                <div className="fsc-sub">Score: {topStock?.composite_score.toFixed(2)}</div>
              </div>
              <div className="factor-summary-card">
                <div className="fsc-label">Lowest Ranked</div>
                <div className="fsc-value" style={{ color: '#ff4444' }}>{worstStock?.symbol}</div>
                <div className="fsc-sub">Score: {worstStock?.composite_score.toFixed(2)}</div>
              </div>
              <div className="factor-summary-card">
                <div className="fsc-label">Smart Beta OW</div>
                <div className="fsc-value" style={{ color: '#00d4aa' }}>{overweightCount}</div>
                <div className="fsc-sub">of {data.smart_beta_signals.length} strategies</div>
              </div>
              <div className="factor-summary-card">
                <div className="fsc-label">Market Regime</div>
                <div className="fsc-value">{data.current_phase}</div>
                <div className="fsc-sub" style={{ color: '#00d4aa' }}>Factor tilt active</div>
              </div>
            </div>

            {/* Factor returns YTD */}
            <div className="factor-returns-section">
              <h3 className="panel-title">Factor Premium Returns (YTD)</h3>
              <FactorReturnsBar ytd={data.factor_returns_ytd} />
            </div>

            {/* Top 5 scores */}
            <div className="top-scores-section">
              <h3 className="panel-title">Top 5 by Composite Score</h3>
              <div className="top-scores-list">
                {data.scores.slice(0, 5).map(s => (
                  <div key={s.symbol} className="top-score-row">
                    <span className="top-score-rank">#{s.rank}</span>
                    <span className="top-score-symbol">{s.symbol}</span>
                    <div className="top-score-bars">
                      {(['value_score', 'momentum_score', 'quality_score'] as (keyof FactorScore)[]).map(f => {
                        const v = s[f] as number;
                        const color = v >= 0 ? '#00d4aa' : '#ff4444';
                        return (
                          <div key={f as string} className="mini-factor" title={FACTOR_LABELS[f as string]}>
                            <div className="mini-factor__bar" style={{ backgroundColor: `${color}44`, width: `${Math.abs(v) / 2 * 30}px` }} />
                          </div>
                        );
                      })}
                    </div>
                    <span className="top-score-composite" style={{ color: s.composite_score >= 0 ? '#00d4aa' : '#ff4444' }}>
                      {s.composite_score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scores' && (
          <div className="scores-view">
            <h3 className="panel-title">Multi-Factor Score Heatmap</h3>
            <p className="panel-subtitle">Z-scores: green = positive relative to universe, red = negative</p>
            <FactorScoreHeatmap scores={data.scores} />
          </div>
        )}

        {activeTab === 'alpha' && (
          <div className="alpha-view">
            <h3 className="panel-title">Fama-French 5-Factor Alpha Decomposition</h3>
            <p className="panel-subtitle">Daily alpha annualized; t-stat &gt; 2.0 highlighted; R² shows factor model fit</p>
            <AlphaTable alphas={data.alpha_results} />
          </div>
        )}

        {activeTab === 'attribution' && (
          <div className="attribution-view">
            <div className="attribution-selector">
              <h3 className="panel-title">Return Attribution</h3>
              <select
                className="symbol-select"
                value={selectedAttrib || data.attribution[0]?.symbol}
                onChange={e => setSelectedAttrib(e.target.value)}
              >
                {data.attribution.map(a => (
                  <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                ))}
              </select>
            </div>
            {selectedAttribData && (
              <AttributionWaterfall attribution={selectedAttribData} />
            )}
            <div className="attribution-all">
              {data.attribution.map(a => (
                <AttributionWaterfall key={a.symbol} attribution={a} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'smart-beta' && (
          <div className="smart-beta-view">
            <h3 className="panel-title">Smart Beta Signal Dashboard</h3>
            <SmartBetaGrid signals={data.smart_beta_signals} />
          </div>
        )}

        {activeTab === 'cycle' && (
          <div className="cycle-view">
            <h3 className="panel-title">Business Cycle Factor Tilts</h3>
            <p className="panel-subtitle">Current phase: <strong style={{ color: '#ffcc00' }}>{data.current_phase}</strong></p>
            <div className="cycle-tilts-grid">
              {data.factor_tilts.map(tilt => (
                <CycleTiltCard
                  key={tilt.phase}
                  tilt={tilt}
                  isCurrent={tilt.phase === data.current_phase}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FactorModelPanel;
export type { FactorModelDashboard, FactorScore, FamaFrenchAlpha, SmartBetaSignal };
