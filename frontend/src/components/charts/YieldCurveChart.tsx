/**
 * YieldCurveChart.tsx
 * Interactive yield curve visualization for Apex Terminal.
 * Plots term structure of interest rates, supports historical comparison,
 * inversion shading, recession probability overlay, real yields vs nominal,
 * and animated curve transitions.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YieldPoint {
  maturityYears: number;
  yieldPct: number;
  realYieldPct?: number;
  label?: string;          // e.g. "3M", "2Y", "10Y"
}

export interface YieldCurveSeries {
  id: string;
  label: string;
  date?: string;
  points: YieldPoint[];
  color?: string;
  dashed?: boolean;
  opacity?: number;
}

export interface RecessionBand {
  startYear: number;
  endYear: number;
  label?: string;
}

export interface YieldCurveChartProps {
  series: YieldCurveSeries[];
  width?: number;
  height?: number;
  showInversionShading?: boolean;
  showSpread?: boolean;            // 10Y-2Y running spread
  showRecessionBands?: boolean;
  recessionBands?: RecessionBand[];
  showRealYields?: boolean;
  showTooltip?: boolean;
  animateTransitions?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  title?: string;
  subtitle?: string;
  onPointHover?: (point: YieldPoint | null, seriesId: string | null) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STANDARD_MATURITIES: Array<{ years: number; label: string }> = [
  { years: 0.25, label: '3M' },
  { years: 0.5, label: '6M' },
  { years: 1, label: '1Y' },
  { years: 2, label: '2Y' },
  { years: 3, label: '3Y' },
  { years: 5, label: '5Y' },
  { years: 7, label: '7Y' },
  { years: 10, label: '10Y' },
  { years: 20, label: '20Y' },
  { years: 30, label: '30Y' },
];

const DEFAULT_SERIES_COLORS = [
  '#4a9eff',   // blue
  '#00d4aa',   // teal
  '#ffcc00',   // yellow
  '#f97316',   // orange
  '#a855f7',   // purple
  '#ff4444',   // red
  '#00ff9d',   // green
];

const MARGIN = { top: 24, right: 24, bottom: 48, left: 56 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function linspace(start: number, end: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => start + ((end - start) * i) / (n - 1));
}

function niceTickCount(range: number): number {
  if (range <= 1) return 5;
  if (range <= 3) return 6;
  return 8;
}

function niceTicks(min: number, max: number): number[] {
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range))) / 2;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

function pointsToPath(
  points: YieldPoint[],
  xScale: (v: number) => number,
  yScale: (v: number) => number,
): string {
  if (!points.length) return '';
  const sortedPts = [...points].sort((a, b) => a.maturityYears - b.maturityYears);
  return sortedPts.map((p, i) => {
    const x = xScale(p.maturityYears);
    const y = yScale(p.yieldPct);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipData {
  x: number;
  y: number;
  maturity: string;
  yields: Array<{ label: string; yield: number; color: string }>;
  spread10y2y?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const YieldCurveChart: React.FC<YieldCurveChartProps> = ({
  series,
  width = 700,
  height = 360,
  showInversionShading = true,
  showSpread = true,
  showTooltip = true,
  showRealYields = false,
  animateTransitions = true,
  title,
  subtitle,
  xAxisLabel = 'Maturity',
  yAxisLabel = 'Yield (%)',
  onPointHover,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredSeriesId, setHoveredSeriesId] = useState<string | null>(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const spreadPanelH = showSpread ? 60 : 0;
  const mainH = innerH - spreadPanelH - (showSpread ? 8 : 0);

  // Compute x/y domains
  const allPoints = useMemo(
    () => series.flatMap(s => s.points.map(p => ({ ...p, seriesId: s.id }))),
    [series]
  );

  const xDomain = useMemo(() => {
    const maturities = allPoints.map(p => p.maturityYears);
    return [Math.min(...maturities), Math.max(...maturities)] as [number, number];
  }, [allPoints]);

  const yDomain = useMemo(() => {
    const yields = allPoints.map(p => showRealYields && p.realYieldPct !== undefined ? p.realYieldPct : p.yieldPct);
    const lo = Math.min(...yields);
    const hi = Math.max(...yields);
    const pad = (hi - lo) * 0.1;
    return [lo - pad, hi + pad] as [number, number];
  }, [allPoints, showRealYields]);

  const xScale = useCallback((v: number) => {
    const [lo, hi] = xDomain;
    return MARGIN.left + ((v - lo) / (hi - lo)) * innerW;
  }, [xDomain, innerW]);

  const yScale = useCallback((v: number) => {
    const [lo, hi] = yDomain;
    return MARGIN.top + (1 - (v - lo) / (hi - lo)) * mainH;
  }, [yDomain, mainH]);

  // X ticks: use standard maturities
  const xTicks = useMemo(() => {
    return STANDARD_MATURITIES.filter(
      m => m.years >= xDomain[0] && m.years <= xDomain[1]
    );
  }, [xDomain]);

  const yTicks = useMemo(() => niceTicks(yDomain[0], yDomain[1]), [yDomain]);

  // Inversion detection (2Y > 10Y for primary series)
  const inversionSegments = useMemo(() => {
    if (!showInversionShading || !series.length) return [];
    const pts = [...series[0].points].sort((a, b) => a.maturityYears - b.maturityYears);
    const twoYr = pts.find(p => Math.abs(p.maturityYears - 2) < 0.1);
    const tenYr = pts.find(p => Math.abs(p.maturityYears - 10) < 0.1);
    if (!twoYr || !tenYr || twoYr.yieldPct <= tenYr.yieldPct) return [];
    // Shade the region between 2Y and 10Y
    return [{ from: 2, to: 10 }];
  }, [series, showInversionShading]);

  // Spread series (10Y - 2Y) for each series
  const spreadData = useMemo(() => {
    if (!showSpread) return [];
    return series.map(s => {
      const twoYr = s.points.find(p => Math.abs(p.maturityYears - 2) < 0.1);
      const tenYr = s.points.find(p => Math.abs(p.maturityYears - 10) < 0.1);
      const spread = twoYr && tenYr ? tenYr.yieldPct - twoYr.yieldPct : null;
      return { seriesId: s.id, label: s.label, color: s.color ?? DEFAULT_SERIES_COLORS[0], spread };
    });
  }, [series, showSpread]);

  // Tooltip handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!showTooltip || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const scaledX = mouseX;
    const [lo, hi] = xDomain;
    const maturity = lo + ((scaledX - MARGIN.left) / innerW) * (hi - lo);
    if (maturity < lo || maturity > hi) { setTooltip(null); return; }

    // Find nearest standard maturity
    const nearest = STANDARD_MATURITIES.reduce((prev, cur) =>
      Math.abs(cur.years - maturity) < Math.abs(prev.years - maturity) ? cur : prev
    );

    const yields = series.map((s, si) => {
      const pt = s.points.find(p => Math.abs(p.maturityYears - nearest.years) < 0.3);
      return {
        label: s.label,
        yield: pt ? (showRealYields && pt.realYieldPct !== undefined ? pt.realYieldPct : pt.yieldPct) : 0,
        color: s.color ?? DEFAULT_SERIES_COLORS[si % DEFAULT_SERIES_COLORS.length],
      };
    }).filter(y => y.yield !== 0);

    const twoYr = series[0]?.points.find(p => Math.abs(p.maturityYears - 2) < 0.1);
    const tenYr = series[0]?.points.find(p => Math.abs(p.maturityYears - 10) < 0.1);
    const spread10y2y = twoYr && tenYr ? tenYr.yieldPct - twoYr.yieldPct : undefined;

    setTooltip({
      x: xScale(nearest.years) + 12,
      y: 20,
      maturity: nearest.label,
      yields,
      spread10y2y,
    });
  }, [showTooltip, xDomain, innerW, series, xScale, showRealYields]);

  return (
    <div className={`yield-curve-chart ${className}`} style={{ position: 'relative', display: 'inline-block' }}>
      {title && (
        <div style={{ color: '#ccc', fontSize: 13, fontWeight: 'bold', marginBottom: 4, fontFamily: 'monospace' }}>
          {title}
          {subtitle && <span style={{ color: '#888', fontWeight: 'normal', marginLeft: 8, fontSize: 11 }}>{subtitle}</span>}
        </div>
      )}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip(null); onPointHover?.(null, null); }}
        style={{ fontFamily: 'monospace' }}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={MARGIN.left}
            x2={MARGIN.left + innerW}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#1a2a38"
            strokeWidth={1}
          />
        ))}

        {/* Zero line */}
        {yDomain[0] < 0 && (
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + innerW}
            y1={yScale(0)}
            y2={yScale(0)}
            stroke="#3a4a5a"
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />
        )}

        {/* Inversion shading */}
        {inversionSegments.map((seg, i) => (
          <rect
            key={i}
            x={xScale(seg.from)}
            y={MARGIN.top}
            width={xScale(seg.to) - xScale(seg.from)}
            height={mainH}
            fill="#ff444420"
          />
        ))}
        {inversionSegments.length > 0 && (
          <text x={xScale(2) + 4} y={MARGIN.top + 14} fill="#ff6666" fontSize={9}>⚠ INVERTED</text>
        )}

        {/* Yield curves */}
        {series.map((s, si) => {
          const color = s.color ?? DEFAULT_SERIES_COLORS[si % DEFAULT_SERIES_COLORS.length];
          const isHovered = hoveredSeriesId === s.id;
          const opacity = hoveredSeriesId && !isHovered ? 0.3 : (s.opacity ?? 1);
          const yieldKey = showRealYields ? 'realYieldPct' : 'yieldPct';
          const pts = [...s.points].sort((a, b) => a.maturityYears - b.maturityYears);
          const pathD = pts.map((p, pi) => {
            const x = xScale(p.maturityYears);
            const y = yScale(showRealYields && p.realYieldPct !== undefined ? p.realYieldPct : p.yieldPct);
            return `${pi === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
          }).join(' ');

          return (
            <g
              key={s.id}
              opacity={opacity}
              onMouseEnter={() => setHoveredSeriesId(s.id)}
              onMouseLeave={() => setHoveredSeriesId(null)}
            >
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 1.8}
                strokeDasharray={s.dashed ? '6,4' : undefined}
                style={{ transition: animateTransitions ? 'stroke-width 0.15s ease, opacity 0.15s ease' : undefined }}
              />
              {/* Data points */}
              {pts.map((p, pi) => (
                <circle
                  key={pi}
                  cx={xScale(p.maturityYears)}
                  cy={yScale(showRealYields && p.realYieldPct !== undefined ? p.realYieldPct : p.yieldPct)}
                  r={isHovered ? 4 : 2.5}
                  fill={color}
                  stroke="#0a1628"
                  strokeWidth={1}
                />
              ))}
            </g>
          );
        })}

        {/* X Axis */}
        <line x1={MARGIN.left} y1={MARGIN.top + mainH} x2={MARGIN.left + innerW} y2={MARGIN.top + mainH} stroke="#2a3a4a" strokeWidth={1} />
        {xTicks.map((tick, i) => (
          <g key={i}>
            <line x1={xScale(tick.years)} y1={MARGIN.top + mainH} x2={xScale(tick.years)} y2={MARGIN.top + mainH + 4} stroke="#2a3a4a" />
            <text x={xScale(tick.years)} y={MARGIN.top + mainH + 14} textAnchor="middle" fill="#666" fontSize={9}>{tick.label}</text>
          </g>
        ))}
        <text x={MARGIN.left + innerW / 2} y={height - 8} textAnchor="middle" fill="#555" fontSize={10}>{xAxisLabel}</text>

        {/* Y Axis */}
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + mainH} stroke="#2a3a4a" strokeWidth={1} />
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={MARGIN.left} y1={yScale(tick)} x2={MARGIN.left - 4} y2={yScale(tick)} stroke="#2a3a4a" />
            <text x={MARGIN.left - 8} y={yScale(tick) + 4} textAnchor="end" fill="#666" fontSize={9}>{tick.toFixed(2)}</text>
          </g>
        ))}
        <text
          x={14}
          y={MARGIN.top + mainH / 2}
          textAnchor="middle"
          fill="#555"
          fontSize={10}
          transform={`rotate(-90, 14, ${MARGIN.top + mainH / 2})`}
        >
          {yAxisLabel}
        </text>

        {/* Legend */}
        {series.length > 1 && series.map((s, si) => {
          const color = s.color ?? DEFAULT_SERIES_COLORS[si % DEFAULT_SERIES_COLORS.length];
          return (
            <g key={s.id}>
              <line
                x1={MARGIN.left + innerW - (series.length - si) * 100 + 0}
                x2={MARGIN.left + innerW - (series.length - si) * 100 + 16}
                y1={MARGIN.top - 8}
                y2={MARGIN.top - 8}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '4,3' : undefined}
              />
              <text
                x={MARGIN.left + innerW - (series.length - si) * 100 + 20}
                y={MARGIN.top - 4}
                fill="#aaa"
                fontSize={9}
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* Spread panel */}
        {showSpread && (
          <g>
            <text x={MARGIN.left} y={MARGIN.top + mainH + 30} fill="#888" fontSize={9}>10Y-2Y Spread:</text>
            {spreadData.map((s, si) => {
              const color = s.spread !== null && s.spread < 0 ? '#ff4444' : '#00d4aa';
              return (
                <g key={s.seriesId}>
                  <rect
                    x={MARGIN.left + 90 + si * 110}
                    y={MARGIN.top + mainH + 22}
                    width={100}
                    height={14}
                    fill="#1a2a38"
                    rx={2}
                  />
                  <text
                    x={MARGIN.left + 140 + si * 110}
                    y={MARGIN.top + mainH + 33}
                    fill={color}
                    fontSize={9}
                    textAnchor="middle"
                  >
                    {s.spread !== null ? `${s.spread >= 0 ? '+' : ''}${(s.spread * 100).toFixed(0)}bps` : 'N/A'}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: '#0e1c2e',
            border: '1px solid #3a4a5a',
            borderRadius: 4,
            padding: '8px 12px',
            fontSize: 11,
            color: '#ddd',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 140,
            fontFamily: 'monospace',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#fff' }}>Maturity: {tooltip.maturity}</div>
          {tooltip.yields.map((y, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 8, height: 2, background: y.color, flexShrink: 0 }} />
              <span style={{ color: '#aaa' }}>{y.label}:</span>
              <span style={{ color: y.color, fontWeight: 'bold' }}>{y.yield.toFixed(3)}%</span>
            </div>
          ))}
          {tooltip.spread10y2y !== undefined && (
            <div style={{ marginTop: 4, borderTop: '1px solid #2a3a4a', paddingTop: 4 }}>
              <span style={{ color: '#888' }}>10Y-2Y: </span>
              <span style={{ color: tooltip.spread10y2y < 0 ? '#ff4444' : '#00d4aa', fontWeight: 'bold' }}>
                {tooltip.spread10y2y >= 0 ? '+' : ''}{(tooltip.spread10y2y * 100).toFixed(0)}bps
                {tooltip.spread10y2y < 0 && ' ⚠ INVERTED'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Yield Curve Comparison ───────────────────────────────────────────────────

export interface YieldCurveComparisonProps {
  current: YieldPoint[];
  historical?: Array<{ date: string; points: YieldPoint[] }>;
  width?: number;
  height?: number;
  maxHistorical?: number;
  className?: string;
}

export const YieldCurveComparison: React.FC<YieldCurveComparisonProps> = ({
  current,
  historical = [],
  width = 700,
  height = 360,
  maxHistorical = 5,
  className = '',
}) => {
  const historicalToShow = historical.slice(-maxHistorical);
  const seriesData: YieldCurveSeries[] = [
    {
      id: 'current',
      label: 'Current',
      points: current,
      color: '#4a9eff',
    },
    ...historicalToShow.map((h, i) => ({
      id: `hist_${i}`,
      label: h.date,
      points: h.points,
      color: `rgba(120,120,180,${0.3 + 0.15 * i})`,
      dashed: true,
      opacity: 0.5 + 0.1 * i,
    })),
  ];

  return (
    <YieldCurveChart
      series={seriesData}
      width={width}
      height={height}
      showInversionShading
      showSpread
      className={className}
    />
  );
};

export default YieldCurveChart;
