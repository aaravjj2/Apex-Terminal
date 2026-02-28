/**
 * FactorExposureRadar.tsx
 * Radar / Spider chart for visualizing multi-factor portfolio exposures.
 * Supports portfolio vs benchmark comparison, animated transitions,
 * fill/stroke customization, multiple overlaid portfolios, and axis labeling.
 */

import React, { useState, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadarAxis {
  key: string;
  label: string;
  min?: number;
  max?: number;
  formatter?: (v: number) => string;
}

export interface RadarSeries {
  id: string;
  label: string;
  values: Record<string, number>;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface FactorExposureRadarProps {
  axes: RadarAxis[];
  series: RadarSeries[];
  radius?: number;
  levels?: number;                // grid ring count
  showValues?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  showAxisLabels?: boolean;
  title?: string;
  animateTransitions?: boolean;
  onSeriesHover?: (id: string | null) => void;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function polarToXY(angle: number, r: number, cx: number, cy: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function normalizeValue(v: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

function computeAxisAngle(index: number, total: number): number {
  return (index / total) * 2 * Math.PI - Math.PI / 2;
}

function buildPolygonPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
}

const DEFAULT_COLORS = [
  '#4a9eff',
  '#00d4aa',
  '#ffcc00',
  '#f97316',
  '#a855f7',
  '#ff4444',
];

// ─── Component ────────────────────────────────────────────────────────────────

export const FactorExposureRadar: React.FC<FactorExposureRadarProps> = ({
  axes,
  series,
  radius = 120,
  levels = 5,
  showValues = true,
  showLegend = true,
  showGrid = true,
  showAxisLabels = true,
  title,
  animateTransitions = true,
  onSeriesHover,
  className = '',
}) => {
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  const size = (radius + 60) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const n = axes.length;

  // Axis configurations
  const axisConfig = useMemo(() =>
    axes.map((axis, i) => {
      const angle = computeAxisAngle(i, n);
      const allValues = series.map(s => s.values[axis.key] ?? 0);
      const min = axis.min ?? Math.min(...allValues, 0);
      const max = axis.max ?? Math.max(...allValues, 1);
      const tip = polarToXY(angle, radius, cx, cy);
      const labelR = radius + 24;
      const labelPos = polarToXY(angle, labelR, cx, cy);
      return { axis, angle, min, max, tip, labelPos };
    }),
    [axes, series, n, radius, cx, cy]
  );

  // Grid rings
  const gridRings = useMemo(() =>
    Array.from({ length: levels }, (_, i) => {
      const r = radius * ((i + 1) / levels);
      const ringPoints = axisConfig.map(ac => polarToXY(ac.angle, r, cx, cy));
      return buildPolygonPath(ringPoints);
    }),
    [levels, radius, axisConfig, cx, cy]
  );

  // Series paths
  const seriesPolygons = useMemo(() =>
    series.map(s => {
      const points = axisConfig.map(ac => {
        const value = s.values[ac.axis.key] ?? 0;
        const norm = normalizeValue(value, ac.min, ac.max);
        return polarToXY(ac.angle, norm * radius, cx, cy);
      });
      return { ...s, path: buildPolygonPath(points), points };
    }),
    [series, axisConfig, radius, cx, cy]
  );

  const handleSeriesHover = useCallback((id: string | null) => {
    setHoveredSeries(id);
    onSeriesHover?.(id);
  }, [onSeriesHover]);

  return (
    <div className={`factor-radar ${className}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {title && (
        <div style={{ color: '#ccc', fontSize: 13, fontWeight: 'bold', marginBottom: 8, fontFamily: 'monospace' }}>
          {title}
        </div>
      )}
      <svg width={size} height={size} style={{ fontFamily: 'monospace' }}>
        {/* Grid rings */}
        {showGrid && gridRings.map((path, i) => (
          <path
            key={i}
            d={path}
            fill="none"
            stroke="#1a2a38"
            strokeWidth={1}
          />
        ))}
        {/* Grid ring labels (level values) */}
        {showGrid && Array.from({ length: levels }, (_, i) => {
          const r = radius * ((i + 1) / levels);
          const pt = polarToXY(-Math.PI / 2 + 0.1, r, cx, cy);
          const pct = ((i + 1) / levels * 100).toFixed(0);
          return (
            <text key={i} x={pt.x + 3} y={pt.y} fill="#444" fontSize={8}>
              {pct}%
            </text>
          );
        })}

        {/* Axis lines */}
        {axisConfig.map((ac, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={ac.tip.x}
            y2={ac.tip.y}
            stroke="#2a3a4a"
            strokeWidth={1}
          />
        ))}

        {/* Axis labels */}
        {showAxisLabels && axisConfig.map((ac, i) => {
          const textAnchor = ac.labelPos.x < cx - 5 ? 'end' : ac.labelPos.x > cx + 5 ? 'start' : 'middle';
          return (
            <text
              key={i}
              x={ac.labelPos.x}
              y={ac.labelPos.y + 4}
              textAnchor={textAnchor}
              fill="#aaa"
              fontSize={11}
            >
              {ac.axis.label}
            </text>
          );
        })}

        {/* Series polygons */}
        {seriesPolygons.map((s, si) => {
          const color = s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length];
          const isHovered = hoveredSeries === s.id;
          const isDimmed = hoveredSeries && !isHovered;
          const fillOpacity = isHovered ? (s.fillOpacity ?? 0.2) * 1.8 : (s.fillOpacity ?? 0.15);
          return (
            <g
              key={s.id}
              opacity={isDimmed ? 0.25 : 1}
              onMouseEnter={() => handleSeriesHover(s.id)}
              onMouseLeave={() => handleSeriesHover(null)}
              style={{ cursor: 'pointer', transition: animateTransitions ? 'opacity 0.2s ease' : undefined }}
            >
              <path
                d={s.path}
                fill={color}
                fillOpacity={fillOpacity}
                stroke={color}
                strokeWidth={isHovered ? (s.strokeWidth ?? 2) + 1 : (s.strokeWidth ?? 2)}
                strokeDasharray={s.dashed ? '6,3' : undefined}
              />
              {/* Vertex dots */}
              {s.points.map((pt, pi) => (
                <circle
                  key={pi}
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 4 : 2.5}
                  fill={color}
                  stroke="#0a1628"
                  strokeWidth={1}
                />
              ))}
              {/* Value labels on hover */}
              {isHovered && showValues && s.points.map((pt, pi) => {
                const ac = axisConfig[pi];
                const value = s.values[ac.axis.key] ?? 0;
                const fmt = ac.axis.formatter ?? (v => v.toFixed(2));
                const angle = ac.angle;
                const offset = 12;
                const lx = pt.x + offset * Math.cos(angle);
                const ly = pt.y + offset * Math.sin(angle);
                return (
                  <text
                    key={pi}
                    x={lx}
                    y={ly + 4}
                    textAnchor="middle"
                    fill={color}
                    fontSize={9}
                    fontWeight="bold"
                  >
                    {fmt(value)}
                  </text>
                );
              })}
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill="#3a4a5a" />
      </svg>

      {/* Legend */}
      {showLegend && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {series.map((s, si) => {
            const color = s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length];
            const isHovered = hoveredSeries === s.id;
            return (
              <div
                key={s.id}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: hoveredSeries && !isHovered ? 0.4 : 1, transition: 'opacity 0.2s' }}
                onMouseEnter={() => handleSeriesHover(s.id)}
                onMouseLeave={() => handleSeriesHover(null)}
              >
                <div style={{
                  width: 28,
                  height: 2,
                  background: color,
                  borderTop: s.dashed ? '2px dashed ' + color : undefined,
                  opacity: 0.9,
                }} />
                <span style={{ fontSize: 11, color: isHovered ? '#fff' : '#aaa', fontFamily: 'monospace' }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Portfolio vs Benchmark ───────────────────────────────────────────────────

export interface PortfolioVsBenchmarkRadarProps {
  portfolioValues: Record<string, number>;
  benchmarkValues: Record<string, number>;
  axes?: RadarAxis[];
  radius?: number;
  className?: string;
}

const DEFAULT_FACTOR_AXES: RadarAxis[] = [
  { key: 'value', label: 'Value', min: -3, max: 3 },
  { key: 'momentum', label: 'Momentum', min: -3, max: 3 },
  { key: 'quality', label: 'Quality', min: -3, max: 3 },
  { key: 'low_vol', label: 'Low Vol', min: -3, max: 3 },
  { key: 'size', label: 'Size', min: -3, max: 3 },
  { key: 'profitability', label: 'Profitability', min: -3, max: 3 },
];

export const PortfolioVsBenchmarkRadar: React.FC<PortfolioVsBenchmarkRadarProps> = ({
  portfolioValues,
  benchmarkValues,
  axes = DEFAULT_FACTOR_AXES,
  radius = 110,
  className = '',
}) => {
  const series: RadarSeries[] = [
    {
      id: 'portfolio',
      label: 'Portfolio',
      values: portfolioValues,
      color: '#4a9eff',
      fillOpacity: 0.2,
    },
    {
      id: 'benchmark',
      label: 'Benchmark',
      values: benchmarkValues,
      color: '#888',
      fillOpacity: 0.1,
      dashed: true,
    },
  ];
  return (
    <FactorExposureRadar
      axes={axes}
      series={series}
      radius={radius}
      title="Factor Exposure"
      className={className}
    />
  );
};

// ─── Single Portfolio Radar ───────────────────────────────────────────────────

export interface SinglePortfolioRadarProps {
  values: Record<string, number>;
  axes?: RadarAxis[];
  color?: string;
  radius?: number;
  label?: string;
  className?: string;
}

export const SinglePortfolioRadar: React.FC<SinglePortfolioRadarProps> = ({
  values,
  axes = DEFAULT_FACTOR_AXES,
  color = '#00d4aa',
  radius = 100,
  label = 'Portfolio',
  className = '',
}) => (
  <FactorExposureRadar
    axes={axes}
    series={[{ id: 'portfolio', label, values, color, fillOpacity: 0.2 }]}
    radius={radius}
    showLegend={false}
    className={className}
  />
);

// ─── Factor Score Radar Grid ──────────────────────────────────────────────────

export interface RadarGridProps {
  items: Array<{
    id: string;
    label: string;
    values: Record<string, number>;
  }>;
  axes?: RadarAxis[];
  radius?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const RadarGrid: React.FC<RadarGridProps> = ({
  items,
  axes = DEFAULT_FACTOR_AXES,
  radius = 80,
  columns = 3,
  className = '',
}) => (
  <div
    className={`radar-grid ${className}`}
    style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}
  >
    {items.map(item => (
      <div key={item.id} style={{ textAlign: 'center' }}>
        <SinglePortfolioRadar
          values={item.values}
          axes={axes}
          radius={radius}
          label={item.label}
        />
        <div style={{ color: '#aaa', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>{item.label}</div>
      </div>
    ))}
  </div>
);

export default FactorExposureRadar;
