/**
 * SectorRotationPanel.tsx
 * Bloomberg-style Sector Rotation Analysis Panel for Apex Terminal.
 * Shows GICS sector performance, rotation signals, breadth, valuation, and cycle analysis.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Type Definitions ─────────────────────────────────────────────────────────

interface SectorEntry {
  sector: string;
  rank: number;
  return: number;
  signal: string;
  momentum_3m: number;
  momentum_6m: number;
  momentum_12m: number;
  volatility: number;
  pe_ratio: number;
  market_cap_b: number;
  earnings_growth: number;
  revenue_growth: number;
  dividend_yield: number;
  jdj_score?: number;
}

interface RotationSignals {
  current_leaders: string[];
  current_laggards: string[];
  accelerating: string[];
  decelerating: string[];
  cycle_phase: string;
}

interface SectorBreadth {
  sector: string;
  advancing: number;
  declining: number;
  pct_advancing: number;
  breadth_signal: string;
}

interface MarketBreadth {
  total_advancing: number;
  total_declining: number;
  market_breadth: string;
  advance_decline_ratio: number;
}

interface CorrelationMatrix {
  [sectorA: string]: { [sectorB: string]: number };
}

interface SectorPanelData {
  rankings: SectorEntry[];
  rotation: RotationSignals;
  breadth: SectorBreadth[];
  market_breadth: MarketBreadth;
  correlation_matrix: CorrelationMatrix;
  cycle_allocation: Record<string, number>;
  timestamp: string;
}

interface ViewMode {
  id: string;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEW_MODES: ViewMode[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'breadth', label: 'Breadth' },
  { id: 'correlation', label: 'Correlation' },
  { id: 'valuation', label: 'Valuation' },
];

const SECTOR_COLORS: Record<string, string> = {
  information_technology: '#00d4ff',
  healthcare: '#00d4aa',
  financials: '#f7931a',
  consumer_discretionary: '#ff6699',
  industrials: '#aaaaff',
  communication_services: '#ffcc00',
  consumer_staples: '#88ff88',
  energy: '#ff4444',
  utilities: '#ffaa00',
  real_estate: '#99aaff',
  materials: '#ff9944',
};

const SECTOR_ABBREVIATIONS: Record<string, string> = {
  information_technology: 'IT',
  healthcare: 'HC',
  financials: 'FIN',
  consumer_discretionary: 'CD',
  industrials: 'IND',
  communication_services: 'CS',
  consumer_staples: 'CST',
  energy: 'ENE',
  utilities: 'UTL',
  real_estate: 'RE',
  materials: 'MAT',
};

const SIGNAL_COLORS: Record<string, string> = {
  strong_buy: '#00ff88',
  buy: '#00d4aa',
  neutral_bullish: '#88cc88',
  neutral: '#888888',
  neutral_bearish: '#cc8888',
  sell: '#ff4444',
  strong_sell: '#ff0000',
};

const CYCLE_PHASE_DESCRIPTIONS: Record<string, { label: string; color: string; preferred: string[] }> = {
  early_cycle: {
    label: 'Early Cycle',
    color: '#00d4aa',
    preferred: ['consumer_discretionary', 'financials', 'industrials'],
  },
  mid_cycle: {
    label: 'Mid Cycle',
    color: '#f7931a',
    preferred: ['information_technology', 'industrials', 'materials'],
  },
  late_cycle: {
    label: 'Late Cycle',
    color: '#ffcc00',
    preferred: ['energy', 'materials', 'healthcare'],
  },
  recession: {
    label: 'Recession',
    color: '#ff4444',
    preferred: ['utilities', 'consumer_staples', 'healthcare'],
  },
};

// ─── Utility Helpers ──────────────────────────────────────────────────────────

const fmtPct = (v: number, d = 2): string => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(d)}%`;
};

const fmtB = (v: number): string => `$${v.toFixed(1)}B`;
const fmtNum = (v: number, d = 1): string => v.toFixed(d);

function generateMockSectorData(): SectorPanelData {
  const sectors = [
    'information_technology',
    'healthcare',
    'financials',
    'consumer_discretionary',
    'industrials',
    'communication_services',
    'consumer_staples',
    'energy',
    'utilities',
    'real_estate',
    'materials',
  ];

  const mockReturns: Record<string, number> = {
    information_technology: 0.0215,
    healthcare: 0.0089,
    financials: 0.0178,
    consumer_discretionary: -0.0045,
    industrials: 0.0134,
    communication_services: 0.0167,
    consumer_staples: -0.0023,
    energy: 0.0312,
    utilities: -0.0189,
    real_estate: -0.0234,
    materials: 0.0098,
  };

  const sorted = sectors
    .map((s, i) => ({ sector: s, ret: mockReturns[s] || 0 }))
    .sort((a, b) => b.ret - a.ret);

  const rankings: SectorEntry[] = sorted.map((s, i) => ({
    sector: s.sector,
    rank: i + 1,
    return: s.ret,
    signal: i < 3 ? 'buy' : i < 5 ? 'neutral_bullish' : i < 8 ? 'neutral' : 'sell',
    momentum_3m: s.ret * 3,
    momentum_6m: s.ret * 5.5,
    momentum_12m: s.ret * 10,
    volatility: 0.12 + Math.random() * 0.15,
    pe_ratio: 15 + Math.random() * 25,
    market_cap_b: 1000 + Math.random() * 5000,
    earnings_growth: -0.05 + Math.random() * 0.30,
    revenue_growth: -0.02 + Math.random() * 0.20,
    dividend_yield: 0.005 + Math.random() * 0.04,
    jdj_score: 40 + Math.random() * 60,
  }));

  const breadth: SectorBreadth[] = sectors.map(s => {
    const r = mockReturns[s] || 0;
    const advancing = r > 0 ? 55 + Math.floor(Math.random() * 25) : 20 + Math.floor(Math.random() * 25);
    const declining = 100 - advancing;
    return {
      sector: s,
      advancing,
      declining,
      pct_advancing: advancing,
      breadth_signal: advancing > 60 ? 'bullish' : advancing > 40 ? 'neutral' : 'bearish',
    };
  });

  // Build correlation matrix (symmetric with 1.0 diagonal)
  const corrMatrix: CorrelationMatrix = {};
  sectors.forEach(a => {
    corrMatrix[a] = {};
    sectors.forEach(b => {
      if (a === b) {
        corrMatrix[a][b] = 1.0;
      } else if (b in corrMatrix && a in corrMatrix[b]) {
        corrMatrix[a][b] = corrMatrix[b][a];
      } else {
        corrMatrix[a][b] = Math.round((0.2 + Math.random() * 0.7) * 100) / 100;
      }
    });
  });

  return {
    rankings,
    rotation: {
      current_leaders: ['energy', 'information_technology', 'financials'],
      current_laggards: ['utilities', 'real_estate', 'consumer_discretionary'],
      accelerating: ['energy', 'industrials'],
      decelerating: ['utilities', 'consumer_staples'],
      cycle_phase: 'mid_cycle',
    },
    breadth,
    market_breadth: {
      total_advancing: breadth.reduce((sum, b) => sum + b.advancing, 0),
      total_declining: breadth.reduce((sum, b) => sum + b.declining, 0),
      market_breadth: 'positive',
      advance_decline_ratio: 1.45,
    },
    correlation_matrix: corrMatrix,
    cycle_allocation: {
      information_technology: 0.22,
      consumer_discretionary: 0.12,
      industrials: 0.14,
      healthcare: 0.11,
      financials: 0.10,
      communication_services: 0.08,
      energy: 0.07,
      materials: 0.06,
      consumer_staples: 0.04,
      real_estate: 0.03,
      utilities: 0.03,
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface PerformanceBarProps {
  value: number;
  maxAbs: number;
}

const PerformanceBar: React.FC<PerformanceBarProps> = ({ value, maxAbs }) => {
  const pct = Math.min(100, (Math.abs(value) / maxAbs) * 50);
  const color = value >= 0 ? '#00d4aa' : '#ff4444';
  return (
    <div className="perf-bar">
      <div className="perf-bar__center" />
      {value >= 0 ? (
        <div className="perf-bar__fill perf-bar__fill--pos" style={{ width: `${pct}%`, backgroundColor: color }} />
      ) : (
        <div className="perf-bar__fill perf-bar__fill--neg" style={{ width: `${pct}%`, backgroundColor: color, marginLeft: 'auto' }} />
      )}
    </div>
  );
};

interface SectorTableProps {
  rankings: SectorEntry[];
  sortField: keyof SectorEntry;
  sortDir: 'asc' | 'desc';
  onSort: (field: keyof SectorEntry) => void;
  selectedSector: string | null;
  onSelect: (sector: string) => void;
}

const SectorTable: React.FC<SectorTableProps> = ({
  rankings, sortField, sortDir, onSort, selectedSector, onSelect
}) => {
  const maxAbs = useMemo(
    () => Math.max(...rankings.map(r => Math.abs(r.return)), 0.01),
    [rankings]
  );

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="sort-icon sort-icon--none">⇅</span>;
    return <span className="sort-icon sort-icon--active">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const TH = ({ field, label }: { field: keyof SectorEntry; label: string }) => (
    <th className="sector-th" onClick={() => onSort(field)}>
      {label} <SortIcon field={field} />
    </th>
  );

  return (
    <table className="sector-table">
      <thead>
        <tr>
          <th className="sector-th sector-th--rank">#</th>
          <th className="sector-th sector-th--name">Sector</th>
          <TH field="return" label="MTD Ret" />
          <th className="sector-th sector-th--bar">Chart</th>
          <TH field="momentum_3m" label="3M Mom" />
          <TH field="momentum_12m" label="12M Mom" />
          <TH field="pe_ratio" label="P/E" />
          <TH field="earnings_growth" label="EPS Gr" />
          <th className="sector-th">Signal</th>
        </tr>
      </thead>
      <tbody>
        {rankings.map(entry => {
          const color = SECTOR_COLORS[entry.sector] || '#888';
          const sigColor = SIGNAL_COLORS[entry.signal] || '#888';
          const isSelected = selectedSector === entry.sector;
          return (
            <tr
              key={entry.sector}
              className={`sector-row${isSelected ? ' sector-row--selected' : ''}`}
              onClick={() => onSelect(entry.sector)}
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <td className="sector-td sector-td--rank" style={{ color: '#888' }}>{entry.rank}</td>
              <td className="sector-td sector-td--name">
                <span className="sector-abbr" style={{ color }}>
                  {SECTOR_ABBREVIATIONS[entry.sector] || entry.sector.slice(0, 3).toUpperCase()}
                </span>
                <span className="sector-fullname">{entry.sector.replace(/_/g, ' ')}</span>
              </td>
              <td className="sector-td sector-td--return" style={{ color: entry.return >= 0 ? '#00d4aa' : '#ff4444' }}>
                {fmtPct(entry.return)}
              </td>
              <td className="sector-td sector-td--bar">
                <PerformanceBar value={entry.return} maxAbs={maxAbs} />
              </td>
              <td className="sector-td" style={{ color: entry.momentum_3m >= 0 ? '#00d4aa' : '#ff4444' }}>
                {fmtPct(entry.momentum_3m)}
              </td>
              <td className="sector-td" style={{ color: entry.momentum_12m >= 0 ? '#00d4aa' : '#ff4444' }}>
                {fmtPct(entry.momentum_12m)}
              </td>
              <td className="sector-td">{fmtNum(entry.pe_ratio)}x</td>
              <td className="sector-td" style={{ color: entry.earnings_growth >= 0 ? '#00d4aa' : '#ff4444' }}>
                {fmtPct(entry.earnings_growth)}
              </td>
              <td className="sector-td">
                <span className="signal-badge" style={{ color: sigColor, borderColor: `${sigColor}44` }}>
                  {entry.signal.replace(/_/g, ' ').toUpperCase()}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

interface RotationWheelProps {
  rotation: RotationSignals;
  rankings: SectorEntry[];
}

const RotationWheel: React.FC<RotationWheelProps> = ({ rotation, rankings }) => {
  const sectors = rankings.map(r => r.sector);
  const n = sectors.length;
  const centerX = 160;
  const centerY = 160;
  const outerR = 130;
  const innerR = 60;
  const labelR = 148;

  const angleStep = (2 * Math.PI) / n;

  const getSliceColor = (sector: string): string => {
    if (rotation.current_leaders.includes(sector)) return '#00d4aa';
    if (rotation.current_laggards.includes(sector)) return '#ff4444';
    if (rotation.accelerating.includes(sector)) return '#f7931a';
    if (rotation.decelerating.includes(sector)) return '#8888aa';
    return '#334455';
  };

  const slicePath = (idx: number): string => {
    const startAngle = idx * angleStep - Math.PI / 2;
    const endAngle = startAngle + angleStep - 0.03;
    const x1 = centerX + outerR * Math.cos(startAngle);
    const y1 = centerY + outerR * Math.sin(startAngle);
    const x2 = centerX + outerR * Math.cos(endAngle);
    const y2 = centerY + outerR * Math.sin(endAngle);
    const ix1 = centerX + innerR * Math.cos(startAngle);
    const iy1 = centerY + innerR * Math.sin(startAngle);
    const ix2 = centerX + innerR * Math.cos(endAngle);
    const iy2 = centerY + innerR * Math.sin(endAngle);
    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1} Z`;
  };

  const labelPos = (idx: number) => {
    const angle = (idx + 0.5) * angleStep - Math.PI / 2;
    return {
      x: centerX + labelR * Math.cos(angle),
      y: centerY + labelR * Math.sin(angle),
    };
  };

  const cycleInfo = CYCLE_PHASE_DESCRIPTIONS[rotation.cycle_phase] || {
    label: 'Unknown Phase', color: '#888', preferred: []
  };

  return (
    <div className="rotation-wheel">
      <div className="rotation-wheel__svg-wrap">
        <svg width="320" height="320" viewBox="0 0 320 320">
          {/* Center circle */}
          <circle cx={centerX} cy={centerY} r={innerR - 2} fill="#0d1821" />
          <text x={centerX} y={centerY - 10} textAnchor="middle" fill={cycleInfo.color} fontSize="14" fontWeight="bold">
            {rotation.cycle_phase.replace('_', '\n')}
          </text>
          <text x={centerX} y={centerY + 8} textAnchor="middle" fill="#666" fontSize="9">
            {cycleInfo.label}
          </text>

          {/* Sector slices */}
          {sectors.map((sector, idx) => (
            <g key={sector}>
              <path
                d={slicePath(idx)}
                fill={getSliceColor(sector)}
                opacity={0.85}
                stroke="#0d1821"
                strokeWidth="1"
              >
                <title>{sector.replace(/_/g, ' ')}</title>
              </path>
              <text
                x={labelPos(idx).x}
                y={labelPos(idx).y}
                textAnchor="middle"
                fill="#ffffffcc"
                fontSize="8"
                dominantBaseline="middle"
              >
                {SECTOR_ABBREVIATIONS[sector] || sector.slice(0, 3).toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="rotation-legend">
        {[
          { color: '#00d4aa', label: 'Leaders' },
          { color: '#ff4444', label: 'Laggards' },
          { color: '#f7931a', label: 'Accelerating' },
          { color: '#8888aa', label: 'Decelerating' },
          { color: '#334455', label: 'Neutral' },
        ].map(({ color, label }) => (
          <div key={label} className="rotation-legend__item">
            <div className="rotation-legend__dot" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Rotation table */}
      <div className="rotation-signals">
        {[
          { title: 'Leaders', sectors: rotation.current_leaders, color: '#00d4aa' },
          { title: 'Accelerating', sectors: rotation.accelerating, color: '#f7931a' },
          { title: 'Decelerating', sectors: rotation.decelerating, color: '#8888aa' },
          { title: 'Laggards', sectors: rotation.current_laggards, color: '#ff4444' },
        ].map(({ title, sectors: sects, color }) => (
          <div key={title} className="rotation-signal-group">
            <div className="rotation-signal-title" style={{ color }}>{title}</div>
            {sects.map(s => (
              <div key={s} className="rotation-signal-item" style={{ borderColor: `${color}44` }}>
                <span className="sector-dot" style={{ backgroundColor: color }} />
                {s.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface BreadthViewProps {
  breadth: SectorBreadth[];
  marketBreadth: MarketBreadth;
}

const BreadthView: React.FC<BreadthViewProps> = ({ breadth, marketBreadth }) => {
  const breadthColor = marketBreadth.market_breadth === 'positive' ? '#00d4aa' :
                       marketBreadth.market_breadth === 'negative' ? '#ff4444' : '#888';
  return (
    <div className="breadth-view">
      {/* Market breadth summary */}
      <div className="breadth-summary">
        <div className="breadth-summary__metric">
          <span className="breadth-summary__value" style={{ color: breadthColor }}>
            {marketBreadth.advance_decline_ratio.toFixed(2)}
          </span>
          <span className="breadth-summary__label">A/D Ratio</span>
        </div>
        <div className="breadth-summary__metric">
          <span className="breadth-summary__value" style={{ color: '#00d4aa' }}>
            {marketBreadth.total_advancing}
          </span>
          <span className="breadth-summary__label">Advancing</span>
        </div>
        <div className="breadth-summary__metric">
          <span className="breadth-summary__value" style={{ color: '#ff4444' }}>
            {marketBreadth.total_declining}
          </span>
          <span className="breadth-summary__label">Declining</span>
        </div>
        <div className="breadth-summary__status" style={{ color: breadthColor }}>
          {marketBreadth.market_breadth.toUpperCase()}
        </div>
      </div>

      {/* Per-sector breadth bars */}
      <div className="breadth-bars">
        {breadth.sort((a, b) => b.pct_advancing - a.pct_advancing).map(b => {
          const signal = b.breadth_signal;
          const barColor = signal === 'bullish' ? '#00d4aa' : signal === 'bearish' ? '#ff4444' : '#888';
          const sectorColor = SECTOR_COLORS[b.sector] || '#888';
          return (
            <div key={b.sector} className="breadth-bar-row">
              <div className="breadth-bar-row__label" style={{ color: sectorColor }}>
                {SECTOR_ABBREVIATIONS[b.sector] || b.sector.slice(0, 3).toUpperCase()}
              </div>
              <div className="breadth-bar-row__track">
                <div
                  className="breadth-bar-row__fill"
                  style={{ width: `${b.pct_advancing}%`, backgroundColor: barColor }}
                />
              </div>
              <div className="breadth-bar-row__pct" style={{ color: barColor }}>
                {b.pct_advancing.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface CorrelationHeatmapProps {
  matrix: CorrelationMatrix;
}

const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ matrix }) => {
  const sectors = Object.keys(matrix);
  if (sectors.length === 0) return <div className="empty-state">No correlation data</div>;

  const getColor = (v: number): string => {
    // red = high corr (>0.8), green = low corr (<0.3), white = 1.0 diagonal
    if (v >= 1.0) return '#ffffff';
    const r = Math.round(255 * Math.max(0, (v - 0.5) / 0.5));
    const g = Math.round(200 * Math.max(0, (0.5 - v) / 0.5));
    const b = Math.round(100 * (1 - Math.abs(v - 0.5)));
    return `rgb(${r},${g},${b})`;
  };

  const cellSize = Math.min(30, Math.floor(280 / sectors.length));
  const abbr = (s: string) => SECTOR_ABBREVIATIONS[s] || s.slice(0, 3).toUpperCase();

  return (
    <div className="correlation-heatmap">
      <div className="correlation-heatmap__scroll">
        <table className="corr-table">
          <thead>
            <tr>
              <th className="corr-th corr-th--corner" />
              {sectors.map(s => (
                <th key={s} className="corr-th corr-th--col" style={{ color: SECTOR_COLORS[s] || '#888' }}>
                  {abbr(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectors.map(rowSector => (
              <tr key={rowSector}>
                <td className="corr-td corr-td--label" style={{ color: SECTOR_COLORS[rowSector] || '#888' }}>
                  {abbr(rowSector)}
                </td>
                {sectors.map(colSector => {
                  const val = matrix[rowSector][colSector];
                  const bg = getColor(val);
                  return (
                    <td
                      key={colSector}
                      className="corr-td corr-td--cell"
                      style={{
                        backgroundColor: bg,
                        width: cellSize,
                        height: cellSize,
                        color: val >= 0.8 || val === 1.0 ? '#000' : '#fff',
                      }}
                      title={`${abbr(rowSector)} / ${abbr(colSector)}: ${val.toFixed(2)}`}
                    >
                      {val === 1.0 ? '—' : val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="corr-legend">
        <span style={{ color: '#ff6666' }}>■ High Correlation</span>
        <span style={{ color: '#888' }}>■ Moderate</span>
        <span style={{ color: '#66cc66' }}>■ Low Correlation</span>
      </div>
    </div>
  );
};

interface ValuationViewProps {
  rankings: SectorEntry[];
}

const ValuationView: React.FC<ValuationViewProps> = ({ rankings }) => {
  const sorted = [...rankings].sort((a, b) => a.pe_ratio - b.pe_ratio);
  const maxPE = Math.max(...rankings.map(r => r.pe_ratio));

  return (
    <div className="valuation-view">
      <div className="valuation-chart">
        {sorted.map(entry => {
          const color = SECTOR_COLORS[entry.sector] || '#888';
          const pePct = (entry.pe_ratio / maxPE) * 100;
          const epsColor = entry.earnings_growth >= 0 ? '#00d4aa' : '#ff4444';
          return (
            <div key={entry.sector} className="valuation-row">
              <div className="valuation-row__label" style={{ color }}>
                {SECTOR_ABBREVIATIONS[entry.sector] || entry.sector.slice(0, 3)}
              </div>
              <div className="valuation-row__pe-bar">
                <div
                  className="valuation-row__pe-fill"
                  style={{ width: `${pePct}%`, backgroundColor: `${color}88` }}
                />
                <span className="valuation-row__pe-value">{fmtNum(entry.pe_ratio)}x</span>
              </div>
              <div className="valuation-row__stats">
                <span style={{ color: epsColor }}>{fmtPct(entry.earnings_growth)} EPS</span>
                <span style={{ color: '#888' }}>{fmtPct(entry.dividend_yield, 1)} Yld</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="valuation-summary">
        <div className="valuation-stat">
          <span className="valuation-stat__label">Cheapest Sector</span>
          <span className="valuation-stat__value" style={{ color: SECTOR_COLORS[sorted[0]?.sector] }}>
            {SECTOR_ABBREVIATIONS[sorted[0]?.sector] || ''} ({fmtNum(sorted[0]?.pe_ratio)}x)
          </span>
        </div>
        <div className="valuation-stat">
          <span className="valuation-stat__label">Most Expensive</span>
          <span className="valuation-stat__value" style={{ color: SECTOR_COLORS[sorted[sorted.length - 1]?.sector] }}>
            {SECTOR_ABBREVIATIONS[sorted[sorted.length - 1]?.sector] || ''} ({fmtNum(sorted[sorted.length - 1]?.pe_ratio)}x)
          </span>
        </div>
        <div className="valuation-stat">
          <span className="valuation-stat__label">Highest EPS Growth</span>
          <span className="valuation-stat__value" style={{ color: '#00d4aa' }}>
            {SECTOR_ABBREVIATIONS[rankings.reduce((a, b) => a.earnings_growth > b.earnings_growth ? a : b).sector] || ''}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export interface SectorRotationPanelProps {
  className?: string;
  onRefresh?: () => Promise<SectorPanelData>;
  refreshIntervalMs?: number;
}

type SortDirection = 'asc' | 'desc';

const SectorRotationPanel: React.FC<SectorRotationPanelProps> = ({
  className = '',
  onRefresh,
  refreshIntervalMs = 30000,
}) => {
  const [activeView, setActiveView] = useState<string>('performance');
  const [data, setData] = useState<SectorPanelData>(generateMockSectorData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof SectorEntry>('rank');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!onRefresh) {
      setData(generateMockSectorData());
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
      setError(e instanceof Error ? e.message : 'Failed to load sector data');
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

  const handleSort = useCallback((field: keyof SectorEntry) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const sortedRankings = useMemo(() => {
    const arr = [...data.rankings];
    arr.sort((a, b) => {
      const va = a[sortField] as number | string;
      const vb = b[sortField] as number | string;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [data.rankings, sortField, sortDir]);

  const cycleInfo = CYCLE_PHASE_DESCRIPTIONS[data.rotation.cycle_phase];

  return (
    <div className={`sector-rotation-panel ${className}`}>
      {/* Header */}
      <div className="sector-rotation-panel__header">
        <div className="sector-rotation-panel__title">
          <span className="sector-rotation-panel__icon">⬡</span>
          <span>SECTOR ROTATION</span>
          {cycleInfo && (
            <span className="sector-rotation-panel__phase" style={{ color: cycleInfo.color }}>
              — {cycleInfo.label}
            </span>
          )}
        </div>
        <div className="sector-rotation-panel__controls">
          <span className="update-time">
            {loading ? 'Updating...' : `Updated ${lastUpdate.toLocaleTimeString()}`}
          </span>
          <button className="btn btn--icon" onClick={refresh} disabled={loading}>⟳</button>
        </div>
      </div>

      {error && <div className="panel-error">⚠ {error}</div>}

      {/* View tabs */}
      <div className="sector-rotation-panel__tabs">
        {VIEW_MODES.map(mode => (
          <button
            key={mode.id}
            className={`view-tab${activeView === mode.id ? ' view-tab--active' : ''}`}
            onClick={() => setActiveView(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Views */}
      <div className="sector-rotation-panel__content">
        {activeView === 'performance' && (
          <SectorTable
            rankings={sortedRankings}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            selectedSector={selectedSector}
            onSelect={setSelectedSector}
          />
        )}
        {activeView === 'rotation' && (
          <RotationWheel rotation={data.rotation} rankings={data.rankings} />
        )}
        {activeView === 'breadth' && (
          <BreadthView breadth={data.breadth} marketBreadth={data.market_breadth} />
        )}
        {activeView === 'correlation' && (
          <CorrelationHeatmap matrix={data.correlation_matrix} />
        )}
        {activeView === 'valuation' && (
          <ValuationView rankings={data.rankings} />
        )}
      </div>
    </div>
  );
};

export default SectorRotationPanel;
export type { SectorEntry, SectorPanelData, RotationSignals };
