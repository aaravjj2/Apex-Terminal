/**
 * MacroDashboard.tsx
 * Bloomberg-style Macro Indicators Dashboard for Apex Terminal.
 * Displays yield curve, inflation regime, ISM signals, recession probability,
 * macro regime quadrant, and FOMC stance.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Type Definitions ─────────────────────────────────────────────────────────

interface YieldCurvePoint {
  maturity_years: number;
  yield_rate: number;
}

interface YieldCurveAnalysis {
  shape: string;
  '2y10y_spread': number;
  '3m10y_spread': number;
  '5y30y_spread': number;
  movement: string;
  long_rate: number;
  short_rate: number;
  term_premium?: number;
  dv01?: number;
  recession_signal?: string;
}

interface InflationRegime {
  regime: string;
  trend: string;
  cpi_yoy: number;
  pce_yoy: number;
  breakeven_10y: number;
  real_rate?: number;
  market_implications: string[];
}

interface ISMSignal {
  series: string;
  regime: string;
  is_expanding: boolean;
  is_accelerating: boolean;
  signal: string;
  current: number;
  previous: number;
}

interface RecessionProbability {
  recession_probability: number;
  risk_level: string;
  inputs: Record<string, number>;
}

interface MacroRegimeResult {
  regime: string;
  quadrant: string;
  gdp_growth: number;
  inflation: number;
  recommended_allocation: Record<string, number>;
  characteristics: string[];
}

interface FOMCStanceResult {
  stance: string;
  real_rate: number;
  rate_gap: number;
  guidance: string;
  next_move: string;
}

interface MacroDashboardData {
  yield_curve?: YieldCurveAnalysis;
  inflation_regime?: InflationRegime;
  ism_manufacturing?: ISMSignal;
  ism_services?: ISMSignal;
  recession_probability?: RecessionProbability;
  macro_regime?: MacroRegimeResult;
  fomc_stance?: FOMCStanceResult;
  timestamp?: string;
}

interface TabInfo {
  id: string;
  label: string;
  icon: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: TabInfo[] = [
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'yield-curve', label: 'Yield Curve', icon: '⟳' },
  { id: 'inflation', label: 'Inflation', icon: '△' },
  { id: 'ism', label: 'ISM / Activity', icon: '◼' },
  { id: 'regime', label: 'Macro Regime', icon: '⬡' },
  { id: 'fomc', label: 'FOMC', icon: '⚖' },
];

const REGIME_COLORS: Record<string, string> = {
  goldilocks: '#00d4aa',
  reflation: '#f7931a',
  stagflation: '#ff4444',
  deflation: '#8888aa',
};

const REGIME_ICONS: Record<string, string> = {
  goldilocks: '☀',
  reflation: '🔥',
  stagflation: '⚡',
  deflation: '❄',
};

const STANCE_COLORS: Record<string, string> = {
  very_hawkish: '#ff2020',
  hawkish: '#ff7700',
  neutral: '#ffcc00',
  dovish: '#44aaff',
  very_dovish: '#0055ff',
};

const RISK_COLORS: Record<string, string> = {
  low: '#00d4aa',
  elevated: '#f7931a',
  high: '#ff4444',
  very_high: '#cc0000',
};

const CURVE_SHAPE_INFO: Record<string, { color: string; desc: string }> = {
  normal: { color: '#00d4aa', desc: 'Growth-supportive environment' },
  steep: { color: '#22ff88', desc: 'Strong growth / early expansion' },
  flat: { color: '#ffcc00', desc: 'Late cycle / slowdown warning' },
  inverted: { color: '#ff4444', desc: 'Recession risk elevated' },
  humped: { color: '#ff9900', desc: 'Mid-cycle peak uncertainty' },
};

// ─── Utility Formatters ───────────────────────────────────────────────────────

const fmtPct = (v: number, digits = 2): string => `${(v * 100).toFixed(digits)}%`;
const fmtBps = (v: number): string => `${(v * 10000).toFixed(1)} bps`;
const fmtNum = (v: number, d = 1): string => v.toFixed(d);

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  accent?: boolean;
  tooltip?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, color, accent, tooltip }) => (
  <div
    className={`metric-card${accent ? ' metric-card--accent' : ''}`}
    style={{ borderColor: color || undefined }}
    title={tooltip}
  >
    <div className="metric-card__label">{label}</div>
    <div className="metric-card__value" style={{ color: color || undefined }}>{value}</div>
    {sub && <div className="metric-card__sub">{sub}</div>}
  </div>
);

interface SpreadRowProps {
  label: string;
  bps: number;
  tooltip?: string;
}

const SpreadRow: React.FC<SpreadRowProps> = ({ label, bps, tooltip }) => {
  const color = bps < 0 ? '#ff4444' : bps < 25 ? '#ffcc00' : '#00d4aa';
  return (
    <div className="spread-row" title={tooltip}>
      <span className="spread-row__label">{label}</span>
      <span className="spread-row__value" style={{ color }}>
        {bps >= 0 ? '+' : ''}{fmtBps(bps)}
      </span>
      <span className="spread-row__bar">
        <div
          className="spread-row__fill"
          style={{
            width: `${Math.min(100, Math.abs(bps) * 100 * 4)}%`,
            backgroundColor: color,
            marginLeft: bps < 0 ? 'auto' : undefined,
          }}
        />
      </span>
    </div>
  );
};

interface GaugeProps {
  value: number;   // 0-100
  label: string;
  color?: string;
  size?: number;
}

const Gauge: React.FC<GaugeProps> = ({ value, label, color = '#00d4aa', size = 120 }) => {
  const radius = (size - 20) / 2;
  const circ = Math.PI * radius;
  const dash = (value / 100) * circ;
  const cx = size / 2;
  const cy = size / 2 + 10;
  return (
    <div className="gauge" style={{ width: size, textAlign: 'center' }}>
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
        <path
          d={`M ${10} ${cy} A ${radius} ${radius} 0 0 1 ${size - 10} ${cy}`}
          fill="none" stroke="#1a2332" strokeWidth={12}
        />
        <path
          d={`M ${10} ${cy} A ${radius} ${radius} 0 0 1 ${size - 10} ${cy}`}
          fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
        <text x={cx} y={cy - 5} textAnchor="middle" fill={color} fontSize={20} fontWeight="bold">
          {value.toFixed(0)}%
        </text>
      </svg>
      <div style={{ color: '#aaa', fontSize: 11 }}>{label}</div>
    </div>
  );
};

interface RegimeQuadrantProps {
  regime: string;
  gdpGrowth: number;
  inflation: number;
}

const RegimeQuadrant: React.FC<RegimeQuadrantProps> = ({ regime, gdpGrowth, inflation }) => {
  const dotX = Math.min(95, Math.max(5, 50 + (gdpGrowth - 0.02) * 1000));
  const dotY = Math.min(95, Math.max(5, 50 - (inflation - 0.025) * 600));
  const regimeColor = REGIME_COLORS[regime] || '#888';
  return (
    <div className="regime-quadrant">
      <svg width="100%" viewBox="0 0 200 200">
        {/* Background quadrants */}
        <rect x="0" y="0" width="100" height="100" fill="#ff440015" />
        <rect x="100" y="0" width="100" height="100" fill="#f7931a15" />
        <rect x="0" y="100" width="100" height="100" fill="#88888815" />
        <rect x="100" y="100" width="100" height="100" fill="#00d4aa15" />
        {/* Axes */}
        <line x1="100" y1="0" x2="100" y2="200" stroke="#334" strokeWidth="1" />
        <line x1="0" y1="100" x2="200" y2="100" stroke="#334" strokeWidth="1" />
        {/* Labels */}
        <text x="50" y="15" textAnchor="middle" fill="#ff4444" fontSize="9">STAGFLATION</text>
        <text x="150" y="15" textAnchor="middle" fill="#f7931a" fontSize="9">REFLATION</text>
        <text x="50" y="195" textAnchor="middle" fill="#888" fontSize="9">DEFLATION</text>
        <text x="150" y="195" textAnchor="middle" fill="#00d4aa" fontSize="9">GOLDILOCKS</text>
        {/* Axis labels */}
        <text x="195" y="105" textAnchor="end" fill="#666" fontSize="8">GDP ▶</text>
        <text x="5" y="8" textAnchor="start" fill="#666" fontSize="8">▲ Inflation</text>
        {/* Data point */}
        <circle cx={`${dotX}%`} cy={`${dotY}%`} r="8" fill={regimeColor} opacity="0.9" />
        <circle cx={`${dotX}%`} cy={`${dotY}%`} r="5" fill="white" />
        <circle cx={`${dotX}%`} cy={`${dotY}%`} r="3" fill={regimeColor} />
      </svg>
      <div className="regime-quadrant__label" style={{ color: regimeColor }}>
        {REGIME_ICONS[regime] || '◈'} {regime.replace('_', ' ').toUpperCase()}
      </div>
    </div>
  );
};

interface FOMCStanceBarProps {
  stance: string;
}

const FOMCStanceBar: React.FC<FOMCStanceBarProps> = ({ stance }) => {
  const stances = ['very_dovish', 'dovish', 'neutral', 'hawkish', 'very_hawkish'];
  const idx = stances.indexOf(stance);
  return (
    <div className="fomc-bar">
      <div className="fomc-bar__track">
        {stances.map((s, i) => (
          <div
            key={s}
            className={`fomc-bar__segment${i === idx ? ' fomc-bar__segment--active' : ''}`}
            style={{ backgroundColor: i === idx ? STANCE_COLORS[s] : undefined }}
            title={s.replace('_', ' ')}
          />
        ))}
      </div>
      <div className="fomc-bar__labels">
        {stances.map((s) => (
          <div key={s} className="fomc-bar__tick" style={{ color: STANCE_COLORS[s] }}>
            {s === 'very_dovish' ? 'V.Dove' :
             s === 'very_hawkish' ? 'V.Hawk' :
             s.charAt(0).toUpperCase() + s.slice(1)}
          </div>
        ))}
      </div>
    </div>
  );
};

interface YieldCurveChartProps {
  points: YieldCurvePoint[];
  shape: string;
}

const YieldCurveChart: React.FC<YieldCurveChartProps> = ({ points, shape }) => {
  if (points.length < 2) return <div className="empty-state">No yield curve data</div>;
  const info = CURVE_SHAPE_INFO[shape] || { color: '#888', desc: '' };
  const minY = Math.min(...points.map(p => p.yield_rate));
  const maxY = Math.max(...points.map(p => p.yield_rate));
  const range = maxY - minY || 0.01;
  const padded = range * 0.2;
  const lo = minY - padded;
  const hi = maxY + padded;
  const W = 300; const H = 120;
  const xScale = (m: number) => {
    const maxM = Math.max(...points.map(p => p.maturity_years));
    return (m / maxM) * (W - 40) + 20;
  };
  const yScale = (y: number) => H - 20 - ((y - lo) / (hi - lo)) * (H - 40);
  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.maturity_years)} ${yScale(p.yield_rate)}`
  ).join(' ');
  return (
    <div className="yield-curve-chart">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="ycGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={info.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={info.color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Fill area under curve */}
        <path
          d={`${pathD} L ${xScale(points[points.length - 1].maturity_years)} ${H - 20} L ${xScale(points[0].maturity_years)} ${H - 20} Z`}
          fill="url(#ycGrad)"
        />
        {/* Curve line */}
        <path d={pathD} fill="none" stroke={info.color} strokeWidth="2" />
        {/* Data points */}
        {points.map((p) => (
          <circle
            key={p.maturity_years}
            cx={xScale(p.maturity_years)}
            cy={yScale(p.yield_rate)}
            r="3"
            fill={info.color}
          />
        ))}
        {/* X axis labels */}
        {points.map((p) => (
          <text
            key={p.maturity_years}
            x={xScale(p.maturity_years)}
            y={H - 5}
            textAnchor="middle"
            fill="#666"
            fontSize="7"
          >
            {p.maturity_years >= 1 ? `${p.maturity_years}Y` : `${p.maturity_years * 12}M`}
          </text>
        ))}
        {/* Y axis labels */}
        <text x="15" y={yScale(hi)} textAnchor="middle" fill="#666" fontSize="7">{fmtPct(hi, 1)}</text>
        <text x="15" y={yScale(lo)} textAnchor="middle" fill="#666" fontSize="7">{fmtPct(lo, 1)}</text>
      </svg>
      <div className="yield-curve-chart__caption" style={{ color: info.color }}>
        {shape.toUpperCase()} — {info.desc}
      </div>
    </div>
  );
};

// ─── Mock Data Generator ──────────────────────────────────────────────────────

function generateMockData(): MacroDashboardData {
  const now = new Date();
  return {
    timestamp: now.toISOString(),
    yield_curve: {
      shape: 'flat',
      '2y10y_spread': 0.0012,
      '3m10y_spread': -0.0025,
      '5y30y_spread': 0.0035,
      movement: 'bear_flattener',
      long_rate: 0.0455,
      short_rate: 0.0443,
      term_premium: 0.0021,
      dv01: -950,
      recession_signal: 'caution',
    },
    inflation_regime: {
      regime: 'elevated_inflation',
      trend: 'decelerating',
      cpi_yoy: 0.035,
      pce_yoy: 0.031,
      breakeven_10y: 0.027,
      real_rate: 0.018,
      market_implications: [
        'Value over growth',
        'Short duration bonds',
        'TIPS allocation',
        'Commodities hedge',
      ],
    },
    ism_manufacturing: {
      series: 'manufacturing',
      regime: 'moderate_expansion',
      is_expanding: true,
      is_accelerating: true,
      signal: 'bullish',
      current: 54.2,
      previous: 52.8,
    },
    ism_services: {
      series: 'services',
      regime: 'strong_expansion',
      is_expanding: true,
      is_accelerating: false,
      signal: 'neutral_bullish',
      current: 58.1,
      previous: 58.9,
    },
    recession_probability: {
      recession_probability: 22,
      risk_level: 'elevated',
      inputs: {
        yield_curve_spread_pct: 0.12,
        ism_composite: 56.8,
        unemployment_pct: 3.9,
        leading_index_yoy_pct: 0.5,
      },
    },
    macro_regime: {
      regime: 'goldilocks',
      quadrant: 'high_growth_low_inflation',
      gdp_growth: 0.028,
      inflation: 0.031,
      recommended_allocation: {
        equities: 0.55,
        bonds: 0.25,
        commodities: 0.10,
        cash: 0.10,
      },
      characteristics: [
        'Steady growth above trend',
        'Inflation near target',
        'Benign credit conditions',
        'Positive earnings revisions',
      ],
    },
    fomc_stance: {
      stance: 'neutral',
      real_rate: 0.018,
      rate_gap: 0.005,
      guidance: 'Data dependent, watching inflation trajectory',
      next_move: 'hold_or_cut',
    },
  };
}

const MOCK_YIELD_CURVE: YieldCurvePoint[] = [
  { maturity_years: 0.25, yield_rate: 0.0530 },
  { maturity_years: 0.5,  yield_rate: 0.0520 },
  { maturity_years: 1.0,  yield_rate: 0.0505 },
  { maturity_years: 2.0,  yield_rate: 0.0480 },
  { maturity_years: 5.0,  yield_rate: 0.0460 },
  { maturity_years: 10.0, yield_rate: 0.0455 },
  { maturity_years: 30.0, yield_rate: 0.0462 },
];

// ─── Tab Panels ───────────────────────────────────────────────────────────────

interface OverviewTabProps {
  data: MacroDashboardData;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ data }) => {
  const recession = data.recession_probability;
  const regime = data.macro_regime;
  const fomc = data.fomc_stance;
  const inflation = data.inflation_regime;
  const yc = data.yield_curve;

  return (
    <div className="tab-content tab-content--overview">
      <div className="overview-grid">
        {/* Macro Regime */}
        <div className="overview-panel overview-panel--regime">
          <h3 className="panel-title">Macro Regime</h3>
          {regime && (
            <RegimeQuadrant
              regime={regime.regime}
              gdpGrowth={regime.gdp_growth}
              inflation={regime.inflation}
            />
          )}
        </div>

        {/* Recession Probability */}
        <div className="overview-panel overview-panel--recession">
          <h3 className="panel-title">Recession Probability</h3>
          {recession && (
            <>
              <Gauge
                value={recession.recession_probability}
                label="12-Month Risk"
                color={RISK_COLORS[recession.risk_level]}
                size={140}
              />
              <div className="risk-level" style={{ color: RISK_COLORS[recession.risk_level] }}>
                {recession.risk_level.replace('_', ' ').toUpperCase()}
              </div>
            </>
          )}
        </div>

        {/* Key Metrics */}
        <div className="overview-panel overview-panel--metrics">
          <h3 className="panel-title">Key Indicators</h3>
          <div className="metrics-grid">
            {yc && (
              <>
                <MetricCard
                  label="2Y/10Y Spread"
                  value={fmtBps(yc['2y10y_spread'])}
                  color={yc['2y10y_spread'] < 0 ? '#ff4444' : '#00d4aa'}
                  tooltip="10y minus 2y yield spread; negative = inverted"
                />
                <MetricCard
                  label="Curve Shape"
                  value={yc.shape.toUpperCase()}
                  color={CURVE_SHAPE_INFO[yc.shape]?.color}
                />
              </>
            )}
            {inflation && (
              <>
                <MetricCard
                  label="CPI YoY"
                  value={fmtPct(inflation.cpi_yoy)}
                  color={inflation.cpi_yoy > 0.04 ? '#ff4444' : inflation.cpi_yoy > 0.025 ? '#ffcc00' : '#00d4aa'}
                />
                <MetricCard
                  label="Real Rate"
                  value={inflation.real_rate !== undefined ? fmtPct(inflation.real_rate) : 'N/A'}
                  color={inflation.real_rate !== undefined && inflation.real_rate < 0 ? '#ff4444' : '#00d4aa'}
                />
              </>
            )}
            {data.ism_manufacturing && (
              <MetricCard
                label="ISM Mfg"
                value={data.ism_manufacturing.current.toFixed(1)}
                sub={data.ism_manufacturing.is_expanding ? '▲ Expanding' : '▼ Contracting'}
                color={data.ism_manufacturing.is_expanding ? '#00d4aa' : '#ff4444'}
              />
            )}
            {data.ism_services && (
              <MetricCard
                label="ISM Svc"
                value={data.ism_services.current.toFixed(1)}
                sub={data.ism_services.is_expanding ? '▲ Expanding' : '▼ Contracting'}
                color={data.ism_services.is_expanding ? '#00d4aa' : '#ff4444'}
              />
            )}
          </div>
        </div>

        {/* FOMC Stance */}
        <div className="overview-panel overview-panel--fomc">
          <h3 className="panel-title">FOMC Stance</h3>
          {fomc && (
            <>
              <FOMCStanceBar stance={fomc.stance} />
              <div className="fomc-guidance">"{fomc.guidance}"</div>
              <div className="fomc-next-move">
                Next Move: <span style={{ color: '#f7931a' }}>
                  {fomc.next_move.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Recommended Allocation */}
        {regime && (
          <div className="overview-panel overview-panel--allocation">
            <h3 className="panel-title">Regime Allocation</h3>
            <div className="allocation-list">
              {Object.entries(regime.recommended_allocation).map(([asset, weight]) => (
                <div key={asset} className="allocation-row">
                  <span className="allocation-row__asset">{asset.charAt(0).toUpperCase() + asset.slice(1)}</span>
                  <div className="allocation-row__bar">
                    <div
                      className="allocation-row__fill"
                      style={{
                        width: `${(weight as number) * 100}%`,
                        backgroundColor: REGIME_COLORS[regime.regime] || '#00d4aa',
                      }}
                    />
                  </div>
                  <span className="allocation-row__pct">{fmtPct(weight as number, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Implications */}
        {inflation && (
          <div className="overview-panel overview-panel--implications">
            <h3 className="panel-title">Market Implications</h3>
            <ul className="implications-list">
              {inflation.market_implications.map((imp, i) => (
                <li key={i} className="implication-item">
                  <span className="implication-bullet" style={{ color: '#00d4aa' }}>▸</span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

interface YieldCurveTabProps {
  analysis: YieldCurveAnalysis | undefined;
  points: YieldCurvePoint[];
}

const YieldCurveTab: React.FC<YieldCurveTabProps> = ({ analysis, points }) => {
  if (!analysis) return <div className="empty-state">No yield curve data available</div>;
  return (
    <div className="tab-content tab-content--yc">
      <div className="yc-grid">
        <div className="yc-panel yc-panel--chart">
          <h3 className="panel-title">Yield Curve</h3>
          <YieldCurveChart points={points} shape={analysis.shape} />
        </div>

        <div className="yc-panel yc-panel--spreads">
          <h3 className="panel-title">Key Spreads</h3>
          <SpreadRow
            label="10Y – 2Y"
            bps={analysis['2y10y_spread']}
            tooltip="Classic recession indicator; inversion precedes recessions"
          />
          <SpreadRow
            label="10Y – 3M"
            bps={analysis['3m10y_spread']}
            tooltip="Fed preferred recession signal"
          />
          <SpreadRow
            label="30Y – 5Y"
            bps={analysis['5y30y_spread']}
            tooltip="Long-end steepness measure"
          />
          {analysis.term_premium !== undefined && (
            <SpreadRow label="Term Premium" bps={analysis.term_premium} />
          )}
        </div>

        <div className="yc-panel yc-panel--info">
          <h3 className="panel-title">Analysis</h3>
          <div className="info-grid">
            <MetricCard label="Shape" value={analysis.shape.toUpperCase()} color={CURVE_SHAPE_INFO[analysis.shape]?.color} />
            <MetricCard label="Movement" value={analysis.movement.replace(/_/g, ' ')} />
            <MetricCard label="Long Rate (10Y)" value={fmtPct(analysis.long_rate)} />
            <MetricCard label="Short Rate (3M)" value={fmtPct(analysis.short_rate)} />
            {analysis.dv01 && (
              <MetricCard label="DV01 ($1M)" value={`$${analysis.dv01.toFixed(0)}`} tooltip="Dollar value of 01: P&L change per 1 basis point" />
            )}
            {analysis.recession_signal && (
              <MetricCard
                label="Recession Signal"
                value={analysis.recession_signal.toUpperCase()}
                color={analysis.recession_signal === 'warning' || analysis.recession_signal === 'caution' ? '#ffcc00' : '#00d4aa'}
              />
            )}
          </div>
        </div>

        <div className="yc-panel yc-panel--history">
          <h3 className="panel-title">Historical Context</h3>
          <div className="historical-context">
            <div className="context-item">
              <span className="context-label">Since 1960:</span>
              <span className="context-value">All recessions preceded by inversion</span>
            </div>
            <div className="context-item">
              <span className="context-label">Avg lag to recession:</span>
              <span className="context-value">~12–18 months post-inversion</span>
            </div>
            <div className="context-item">
              <span className="context-label">False positives:</span>
              <span className="context-value">2 of 8 inversions since 1960</span>
            </div>
            <div className="context-item">
              <span className="context-label">Current shape interpretation:</span>
              <span className="context-value" style={{ color: CURVE_SHAPE_INFO[analysis.shape]?.color }}>
                {CURVE_SHAPE_INFO[analysis.shape]?.desc || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface InflationTabProps {
  data: InflationRegime | undefined;
}

const InflationTab: React.FC<InflationTabProps> = ({ data }) => {
  if (!data) return <div className="empty-state">No inflation data available</div>;
  const regimeBand = data.cpi_yoy > 0.04 ? '#ff4444' : data.cpi_yoy > 0.025 ? '#ffcc00' : '#00d4aa';
  return (
    <div className="tab-content tab-content--inflation">
      <div className="inflation-grid">
        <div className="inflation-panel inflation-panel--headline">
          <div className="headline-stat" style={{ color: regimeBand }}>
            {fmtPct(data.cpi_yoy)}
          </div>
          <div className="headline-label">CPI Year-over-Year</div>
          <div className="headline-trend" style={{ color: data.trend === 'decelerating' ? '#00d4aa' : '#ff4444' }}>
            {data.trend === 'decelerating' ? '▼ Decelerating' : data.trend === 'accelerating' ? '▲ Accelerating' : '→ Stable'}
          </div>
        </div>

        <div className="inflation-panel inflation-panel--regime">
          <h3 className="panel-title">Inflation Regime</h3>
          <div className="regime-badge" style={{ backgroundColor: `${regimeBand}22`, borderColor: regimeBand, color: regimeBand }}>
            {data.regime.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div className="metrics-grid">
            <MetricCard label="CPI YoY" value={fmtPct(data.cpi_yoy)} color={regimeBand} />
            <MetricCard label="PCE YoY" value={fmtPct(data.pce_yoy)} color={regimeBand} />
            <MetricCard label="10Y Breakeven" value={fmtPct(data.breakeven_10y)} />
            {data.real_rate !== undefined && (
              <MetricCard
                label="Real Rate (10Y)"
                value={fmtPct(data.real_rate)}
                color={data.real_rate < 0 ? '#ff4444' : '#00d4aa'}
                tooltip="Nominal 10Y yield minus 10Y breakeven inflation"
              />
            )}
          </div>
        </div>

        <div className="inflation-panel inflation-panel--implications">
          <h3 className="panel-title">Market Implications</h3>
          {data.market_implications.map((imp, i) => (
            <div key={i} className="implication-card">
              <span className="implication-num">{i + 1:&gt;</span>
              <span className="implication-text">{imp}</span>
            </div>
          ))}
        </div>

        <div className="inflation-panel inflation-panel--bands">
          <h3 className="panel-title">Inflation Band Indicator</h3>
          <div className="inflation-band">
            <div className="band-scale">
              {[0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07].map(v => (
                <div
                  key={v}
                  className="band-mark"
                  style={{
                    left: `${(v / 0.08) * 100}%`,
                    color: v > 0.04 ? '#ff4444' : v > 0.025 ? '#ffcc00' : '#00d4aa',
                  }}
                >
                  <div className="band-tick" />
                  <div className="band-label">{fmtPct(v, 0)}</div>
                </div>
              ))}
              <div
                className="band-cursor"
                style={{
                  left: `${Math.min(100, (data.cpi_yoy / 0.08) * 100)}%`,
                  backgroundColor: regimeBand,
                }}
              />
            </div>
            <div className="band-regions">
              <div className="band-region" style={{ width: '31%', backgroundColor: '#00d4aa11' }}>Below Target</div>
              <div className="band-region" style={{ width: '19%', backgroundColor: '#00d4aa22' }}>At Target</div>
              <div className="band-region" style={{ width: '25%', backgroundColor: '#ffcc0022' }}>Elevated</div>
              <div className="band-region" style={{ width: '25%', backgroundColor: '#ff444422' }}>High</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ISMTabProps {
  manufacturing: ISMSignal | undefined;
  services: ISMSignal | undefined;
}

const ISMTab: React.FC<ISMTabProps> = ({ manufacturing, services }) => {
  const composite = manufacturing && services
    ? manufacturing.current * 0.3 + services.current * 0.7
    : null;

  const renderISMPanel = (data: ISMSignal, title: string) => {
    const color = data.is_expanding ? '#00d4aa' : '#ff4444';
    const pct = ((data.current - 30) / 40) * 100; // scale 30-70 to 0-100%
    return (
      <div className="ism-panel">
        <h3 className="panel-title">{title}</h3>
        <div className="ism-reading">
          <span className="ism-value" style={{ color }}>{data.current.toFixed(1)}</span>
          <span className="ism-change" style={{ color: data.is_accelerating ? '#00d4aa' : '#ff7700' }}>
            {data.current > data.previous ? '+' : ''}{(data.current - data.previous).toFixed(1)}
          </span>
        </div>
        <div className="ism-meter">
          <div className="ism-meter__track">
            <div className="ism-meter__fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
            <div className="ism-meter__threshold" style={{ left: '50%' }} />
          </div>
          <div className="ism-meter__labels">
            <span>30 (Deep Contraction)</span>
            <span>50 (Neutral)</span>
            <span>70 (Boom)</span>
          </div>
        </div>
        <div className="ism-regime" style={{ color }}>
          {data.regime.replace(/_/g, ' ').toUpperCase()}
        </div>
        <div className={`ism-signal ism-signal--${data.signal}`}>
          Signal: {data.signal.replace(/_/g, ' ')}
        </div>
        <div className="ism-detail">
          <span>{data.is_expanding ? '✓ Expanding' : '✗ Contracting'}</span>
          <span>{data.is_accelerating ? '▲ Accelerating' : '▼ Decelerating'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="tab-content tab-content--ism">
      <div className="ism-grid">
        {manufacturing && renderISMPanel(manufacturing, 'ISM Manufacturing')}
        {services && renderISMPanel(services, 'ISM Services')}
        {composite !== null && (
          <div className="ism-panel ism-panel--composite">
            <h3 className="panel-title">ISM Composite (30/70 blend)</h3>
            <div className="ism-composite-value" style={{ color: composite >= 50 ? '#00d4aa' : '#ff4444' }}>
              {composite.toFixed(1)}
            </div>
            <div className="ism-composite-label">
              {composite >= 55 ? 'Strong Expansion' :
               composite >= 50 ? 'Moderate Expansion' :
               composite >= 45 ? 'Contraction' : 'Deep Contraction'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export interface MacroDashboardProps {
  className?: string;
  onRefresh?: () => Promise<MacroDashboardData>;
  refreshIntervalMs?: number;
}

const MacroDashboard: React.FC<MacroDashboardProps> = ({
  className = '',
  onRefresh,
  refreshIntervalMs = 60000,
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [data, setData] = useState<MacroDashboardData>(generateMockData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!onRefresh) {
      setData(generateMockData());
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
      setError(e instanceof Error ? e.message : 'Failed to load macro data');
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, refreshIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, refreshIntervalMs]);

  const regimeColor = useMemo(
    () => REGIME_COLORS[data.macro_regime?.regime || ''] || '#888',
    [data.macro_regime]
  );

  return (
    <div className={`macro-dashboard ${className}`}>
      {/* Header */}
      <div className="macro-dashboard__header">
        <div className="macro-dashboard__title">
          <span className="macro-dashboard__icon">◈</span>
          <span>MACRO INDICATORS</span>
          {data.macro_regime && (
            <span className="macro-dashboard__regime" style={{ color: regimeColor }}>
              — {data.macro_regime.regime.toUpperCase()} REGIME
            </span>
          )}
        </div>
        <div className="macro-dashboard__controls">
          <span className="macro-dashboard__update">
            {loading ? 'Updating...' : `Updated ${lastUpdate.toLocaleTimeString()}`}
          </span>
          <button className="btn btn--icon" onClick={refresh} disabled={loading} title="Refresh">⟳</button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="macro-dashboard__error">
          ⚠ {error}
        </div>
      )}

      {/* Tab navigation */}
      <div className="macro-dashboard__tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`macro-tab${activeTab === tab.id ? ' macro-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="macro-tab__icon">{tab.icon}</span>
            <span className="macro-tab__label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="macro-dashboard__content">
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'yield-curve' && (
          <YieldCurveTab analysis={data.yield_curve} points={MOCK_YIELD_CURVE} />
        )}
        {activeTab === 'inflation' && <InflationTab data={data.inflation_regime} />}
        {activeTab === 'ism' && (
          <ISMTab manufacturing={data.ism_manufacturing} services={data.ism_services} />
        )}
        {activeTab === 'regime' && (
          <div className="tab-content">
            {data.macro_regime && (
              <div className="regime-detail">
                <RegimeQuadrant
                  regime={data.macro_regime.regime}
                  gdpGrowth={data.macro_regime.gdp_growth}
                  inflation={data.macro_regime.inflation}
                />
                <div className="regime-characteristics">
                  <h3>Characteristics</h3>
                  <ul>
                    {data.macro_regime.characteristics.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'fomc' && (
          <div className="tab-content">
            {data.fomc_stance && (
              <div className="fomc-detail">
                <FOMCStanceBar stance={data.fomc_stance.stance} />
                <div className="fomc-metrics">
                  <MetricCard label="Real Rate" value={fmtPct(data.fomc_stance.real_rate)} />
                  <MetricCard label="Rate Gap" value={fmtPct(data.fomc_stance.rate_gap)} />
                  <MetricCard label="Next Move" value={data.fomc_stance.next_move.replace(/_/g, ' ')} />
                </div>
                <div className="fomc-guidance-card">
                  <span className="fomc-guidance-label">Forward Guidance:</span>
                  <blockquote className="fomc-guidance-text">"{data.fomc_stance.guidance}"</blockquote>
                </div>
                {data.recession_probability && (
                  <div className="recession-detail">
                    <h3>Recession Probability Model</h3>
                    <Gauge
                      value={data.recession_probability.recession_probability}
                      label="12-Month Risk"
                      color={RISK_COLORS[data.recession_probability.risk_level]}
                      size={160}
                    />
                    <div className="recession-inputs">
                      {Object.entries(data.recession_probability.inputs).map(([k, v]) => (
                        <MetricCard
                          key={k}
                          label={k.replace(/_/g, ' ')}
                          value={typeof v === 'number' ? v.toFixed(2) : String(v)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MacroDashboard;
export type { MacroDashboardData, MacroRegimeResult, YieldCurveAnalysis, InflationRegime };
