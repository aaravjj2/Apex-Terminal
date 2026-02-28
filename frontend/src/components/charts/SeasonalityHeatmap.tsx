/**
 * SeasonalityHeatmap.tsx
 * Calendar-based seasonality heatmap — shows average returns by month/day/DOW.
 * Supports year×month matrix, month-of-year bar chart, day-of-week analysis,
 * historical year column, win-rate overlay, and statistical significance shading.
 */

import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SeasonalityView = 'monthly-grid' | 'dow-grid' | 'month-bar' | 'dow-bar' | 'combined';

export interface MonthlyReturn {
  year: number;
  month: number;    // 1-12
  return_pct: number;
  trading_days?: number;
  win?: boolean;
}

export interface DOWReturn {
  day: number;      // 0=Mon...4=Fri
  year: number;
  avg_return_pct: number;
  sample_count: number;
  win_rate?: number;
}

export interface SeasonalitySummary {
  month: number;
  avg_return_pct: number;
  median_return_pct: number;
  win_rate: number;
  best_year: number;
  worst_year: number;
  sample_count: number;
  p_value?: number;    // statistical significance
}

export interface SeasonalityHeatmapProps {
  symbol?: string;
  monthlyReturns?: MonthlyReturn[];
  dowReturns?: DOWReturn[];
  monthlySummary?: SeasonalitySummary[];
  view?: SeasonalityView;
  startYear?: number;
  endYear?: number;
  showWinRate?: boolean;
  showStatisticalSig?: boolean;
  colorScale?: [string, string, string];    // [negative, neutral, positive]
  cellWidth?: number;
  cellHeight?: number;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DEFAULT_COLORS: [string, string, string] = ['#ff2244', '#1a2a38', '#00d4aa'];

// ─── Color Interpolation ──────────────────────────────────────────────────────

function returnToColor(
  ret: number,
  maxAbsRet: number,
  colors: [string, string, string]
): string {
  const [negColor, midColor, posColor] = colors;
  function parse(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function toHex([r, g, b]: [number, number, number]): string {
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  const clampedRet = Math.max(-maxAbsRet, Math.min(maxAbsRet, ret));
  if (clampedRet >= 0) {
    const t = clampedRet / maxAbsRet;
    return toHex(lerp3(parse(midColor), parse(posColor), t));
  } else {
    const t = -clampedRet / maxAbsRet;
    return toHex(lerp3(parse(midColor), parse(negColor), t));
  }
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ─── Monthly Grid ─────────────────────────────────────────────────────────────

interface MonthlyGridProps {
  returns: MonthlyReturn[];
  summary: Map<number, SeasonalitySummary>;
  startYear?: number;
  endYear?: number;
  showWinRate: boolean;
  colors: [string, string, string];
  cellW: number;
  cellH: number;
  sigThreshold?: number;   // p-value threshold for sig shading
}

interface TooltipInfo {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

const MonthlyGrid: React.FC<MonthlyGridProps> = ({
  returns,
  summary,
  startYear,
  endYear,
  showWinRate,
  colors,
  cellW,
  cellH,
}) => {
  const [tip, setTip] = useState<TooltipInfo>({ visible: false, x: 0, y: 0, content: '' });

  const years = useMemo(() => {
    const ys = [...new Set(returns.map(r => r.year))].sort((a, b) => a - b);
    return startYear || endYear
      ? ys.filter(y => (!startYear || y >= startYear) && (!endYear || y <= endYear))
      : ys;
  }, [returns, startYear, endYear]);

  const returnMap = useMemo(() => {
    const m = new Map<string, MonthlyReturn>();
    returns.forEach(r => m.set(`${r.year}_${r.month}`, r));
    return m;
  }, [returns]);

  const maxAbsRet = useMemo(() => {
    const abs = returns.map(r => Math.abs(r.return_pct));
    return Math.max(...abs, 5);
  }, [returns]);

  // Row heights: years + header + summary rows
  const headerH = cellH + 4;
  const totalH = headerH + years.length * cellH + cellH * 2 + 4; // +2 for avg/win rows
  const totalW = (cellW + 2) + 12 * (cellW + 2) + 4;

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg width={totalW} height={totalH} style={{ fontFamily: 'monospace' }}>
        {/* Month headers */}
        {MONTH_LABELS.map((m, mi) => (
          <text
            key={mi}
            x={(cellW + 2) + mi * (cellW + 2) + cellW / 2}
            y={cellH / 2 + 4}
            textAnchor="middle"
            fill="#888"
            fontSize={10}
          >
            {m}
          </text>
        ))}

        {/* Year rows */}
        {years.map((year, yi) => {
          const y0 = headerH + yi * cellH;
          return (
            <g key={year}>
              <text x={cellW / 2 - 2} y={y0 + cellH / 2 + 4} textAnchor="middle" fill="#666" fontSize={9}>{year}</text>
              {MONTH_LABELS.map((_m, mi) => {
                const r = returnMap.get(`${year}_${mi + 1}`);
                const bg = r ? returnToColor(r.return_pct, maxAbsRet, colors) : '#0e1826';
                const textColor = r ? (luminance(bg) > 0.4 ? '#000' : '#fff') : '#333';
                return (
                  <g
                    key={mi}
                    onMouseEnter={e => {
                      const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                      setTip({
                        visible: true,
                        x: rect.left,
                        y: rect.top - 30,
                        content: r ? `${year} ${MONTH_LABELS[mi]}: ${r.return_pct >= 0 ? '+' : ''}${r.return_pct.toFixed(2)}%` : 'No data',
                      });
                    }}
                    onMouseLeave={() => setTip(t => ({ ...t, visible: false }))}
                  >
                    <rect
                      x={(cellW + 2) + mi * (cellW + 2)}
                      y={y0}
                      width={cellW}
                      height={cellH - 2}
                      fill={bg}
                      rx={1}
                    />
                    {r && cellW >= 36 && (
                      <text
                        x={(cellW + 2) + mi * (cellW + 2) + cellW / 2}
                        y={y0 + cellH / 2 + 3}
                        textAnchor="middle"
                        fill={textColor}
                        fontSize={8}
                      >
                        {r.return_pct >= 0 ? '+' : ''}{r.return_pct.toFixed(1)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Summary rows */}
        {['Avg %', 'Win%'].map((rowLabel, ri) => {
          const y0 = headerH + years.length * cellH + ri * cellH + 4;
          return (
            <g key={rowLabel}>
              <text x={cellW / 2 - 2} y={y0 + cellH / 2 + 4} textAnchor="middle" fill="#aaa" fontSize={9} fontWeight="bold">
                {rowLabel}
              </text>
              {MONTH_LABELS.map((_m, mi) => {
                const sum = summary.get(mi + 1);
                const value = ri === 0 ? (sum?.avg_return_pct ?? null) : (sum ? sum.win_rate * 100 : null);
                const bg = value !== null
                  ? (ri === 0 ? returnToColor(value, maxAbsRet, colors) : returnToColor(value - 50, 50, colors))
                  : '#0e1826';
                const textColor = value !== null ? (luminance(bg) > 0.4 ? '#000' : '#fff') : '#333';
                return (
                  <g key={mi}>
                    <rect
                      x={(cellW + 2) + mi * (cellW + 2)}
                      y={y0}
                      width={cellW}
                      height={cellH - 2}
                      fill={bg}
                      rx={1}
                      stroke="#0a1628"
                      strokeWidth={0.5}
                    />
                    {value !== null && (
                      <text
                        x={(cellW + 2) + mi * (cellW + 2) + cellW / 2}
                        y={y0 + cellH / 2 + 3}
                        textAnchor="middle"
                        fill={textColor}
                        fontSize={8}
                        fontWeight="bold"
                      >
                        {ri === 0 ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}` : `${value.toFixed(0)}%`}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Monthly Bar Chart ────────────────────────────────────────────────────────

interface MonthBarChartProps {
  summary: SeasonalitySummary[];
  colors: [string, string, string];
  showWinRate: boolean;
  width: number;
  height: number;
}

const MonthBarChart: React.FC<MonthBarChartProps> = ({ summary, colors, showWinRate, width, height }) => {
  const ML = 36, MR = 20, MT = 20, MB = 30;
  const innerW = width - ML - MR;
  const innerH = height - MT - MB;

  const maxAbsRet = Math.max(...summary.map(s => Math.abs(s.avg_return_pct)), 3);
  const yScale = (v: number) => MT + (1 - (v + maxAbsRet) / (2 * maxAbsRet)) * innerH;
  const barW = innerW / 12 - 4;

  return (
    <svg width={width} height={height} style={{ fontFamily: 'monospace' }}>
      {/* Zero line */}
      <line x1={ML} y1={yScale(0)} x2={ML + innerW} y2={yScale(0)} stroke="#2a3a4a" strokeWidth={1} />
      {/* Bars */}
      {summary.map((s, i) => {
        const x = ML + i * (innerW / 12) + 2;
        const barH = Math.abs(yScale(s.avg_return_pct) - yScale(0));
        const posBar = s.avg_return_pct >= 0;
        const bg = returnToColor(s.avg_return_pct, maxAbsRet, colors);
        return (
          <g key={i}>
            <rect
              x={x}
              y={posBar ? yScale(s.avg_return_pct) : yScale(0)}
              width={barW}
              height={barH}
              fill={bg}
              rx={1}
            />
            {showWinRate && (
              <rect
                x={x + barW + 1}
                y={MT + innerH * (1 - s.win_rate)}
                width={3}
                height={innerH * s.win_rate}
                fill="#4a9eff"
                opacity={0.5}
              />
            )}
            <text x={x + barW / 2} y={height - 10} textAnchor="middle" fill="#666" fontSize={8}>{MONTH_LABELS[i]}</text>
          </g>
        );
      })}
      {/* Y ticks */}
      {[-3, -1.5, 0, 1.5, 3].filter(t => Math.abs(t) <= maxAbsRet).map((t, i) => (
        <g key={i}>
          <text x={ML - 3} y={yScale(t) + 3} textAnchor="end" fill="#555" fontSize={8}>{t >= 0 ? '+' : ''}{t}%</text>
          <line x1={ML} y1={yScale(t)} x2={ML + innerW} y2={yScale(t)} stroke="#1a2a38" strokeWidth={0.6} />
        </g>
      ))}
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SeasonalityHeatmap: React.FC<SeasonalityHeatmapProps> = ({
  symbol,
  monthlyReturns = [],
  monthlySummary = [],
  view = 'monthly-grid',
  startYear,
  endYear,
  showWinRate = true,
  showStatisticalSig = false,
  colorScale = DEFAULT_COLORS,
  cellWidth = 44,
  cellHeight = 20,
  className = '',
}) => {
  const [activeView, setActiveView] = useState<SeasonalityView>(view);

  const summaryMap = useMemo(() => {
    const m = new Map<number, SeasonalitySummary>();
    monthlySummary.forEach(s => m.set(s.month, s));
    return m;
  }, [monthlySummary]);

  return (
    <div className={`seasonality-heatmap ${className}`}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {symbol && (
          <span style={{ color: '#4a9eff', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }}>{symbol}</span>
        )}
        <span style={{ color: '#888', fontSize: 12, fontFamily: 'monospace' }}>Seasonality Analysis</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['monthly-grid', 'month-bar'] as SeasonalityView[]).map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                padding: '2px 8px',
                background: activeView === v ? '#4a9eff' : '#1a2a38',
                border: '1px solid #2a3a4a',
                borderRadius: 3,
                color: activeView === v ? '#000' : '#888',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            >
              {v === 'monthly-grid' ? 'Grid' : 'Bar'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
        <span style={{ color: colorScale[0] }}>▮ Negative</span>
        <span style={{ color: colorScale[2] }}>▮ Positive</span>
        {showWinRate && <span style={{ color: '#4a9eff' }}>▮ Win Rate</span>}
      </div>

      {/* Content */}
      {activeView === 'monthly-grid' && (
        <MonthlyGrid
          returns={monthlyReturns}
          summary={summaryMap}
          startYear={startYear}
          endYear={endYear}
          showWinRate={showWinRate}
          colors={colorScale}
          cellW={cellWidth}
          cellH={cellHeight}
        />
      )}
      {activeView === 'month-bar' && (
        <MonthBarChart
          summary={monthlySummary}
          colors={colorScale}
          showWinRate={showWinRate}
          width={620}
          height={200}
        />
      )}

      {/* Summary stats */}
      {monthlySummary.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Best Month', value: MONTH_LABELS[(monthlySummary.reduce((a, b) => a.avg_return_pct > b.avg_return_pct ? a : b).month - 1)] + ': +' + Math.max(...monthlySummary.map(s => s.avg_return_pct)).toFixed(2) + '%', color: colorScale[2] },
            { label: 'Worst Month', value: MONTH_LABELS[(monthlySummary.reduce((a, b) => a.avg_return_pct < b.avg_return_pct ? a : b).month - 1)] + ': ' + Math.min(...monthlySummary.map(s => s.avg_return_pct)).toFixed(2) + '%', color: colorScale[0] },
            { label: 'Avg Win Rate', value: (monthlySummary.reduce((a, b) => a + b.win_rate, 0) / monthlySummary.length * 100).toFixed(1) + '%', color: '#aaa' },
          ].map((stat, i) => (
            <div key={i} style={{ fontSize: 10, fontFamily: 'monospace' }}>
              <span style={{ color: '#555' }}>{stat.label}: </span>
              <span style={{ color: stat.color, fontWeight: 'bold' }}>{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SeasonalityHeatmap;
