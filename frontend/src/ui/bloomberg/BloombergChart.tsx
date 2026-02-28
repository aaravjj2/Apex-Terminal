/**
 * BloombergChart.tsx
 * Reusable Bloomberg-style chart components for Apex Terminal.
 * Includes: LineChart, BarChart, CandlestickChart, AreaChart, MultiLineChart, PriceChart, VolumeChart.
 * All charts are SVG-based with no external dependencies.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataPoint {
  x: number | string | Date;
  y: number;
  label?: string;
  color?: string;
  meta?: Record<string, unknown>;
}

export interface OHLCV {
  timestamp: number | string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartSeries {
  id: string;
  label: string;
  data: DataPoint[];
  color?: string;
  lineWidth?: number;
  dashed?: boolean;
  showArea?: boolean;
  areaOpacity?: number;
  visible?: boolean;
}

export interface ChartAxis {
  label?: string;
  tickCount?: number;
  tickFormat?: (v: number) => string;
  min?: number;
  max?: number;
  gridLines?: boolean;
}

export interface ChartTooltipData {
  x: string;
  y: number;
  seriesId?: string;
  seriesLabel?: string;
  color?: string;
  extras?: Record<string, string | number>;
}

export interface BloombergChartProps {
  width?: number | string;
  height?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  xAxis?: ChartAxis;
  yAxis?: ChartAxis;
  title?: string;
  subtitle?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
  loading?: boolean;
  noDataMessage?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  '#00d4aa', '#00aaff', '#f7931a', '#ff4444', '#cc88ff', '#ffcc00', '#88cc44', '#ff9900',
];

const DEFAULT_PADDING = { top: 24, right: 20, bottom: 36, left: 60 };

const DEFAULT_TICK_FORMAT = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(4);
};

// ─── Helper: Nice ticks ───────────────────────────────────────────────────────

function niceRange(min: number, max: number, tickCount = 5): { min: number; max: number; ticks: number[] } {
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const rawStep = range / (tickCount - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.ceil(rawStep / mag) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.01; v += step) {
    ticks.push(parseFloat(v.toFixed(10)));
  }
  return { min: niceMin, max: niceMax, ticks };
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  x: number;
  y: number;
  data: ChartTooltipData[];
  visible: boolean;
  chartWidth: number;
}

const ChartTooltip: React.FC<TooltipProps> = ({ x, y, data, visible, chartWidth }) => {
  if (!visible || data.length === 0) return null;
  const flip = x > chartWidth / 2;
  const toX = flip ? x - 160 : x + 12;
  return (
    <g>
      <line x1={x} y1={0} x2={x} y2={9999} stroke="#ffffff22" strokeWidth="1" strokeDasharray="4,4" />
      <foreignObject x={toX} y={y - 10} width={150} height={data.length * 20 + 28}>
        <div className="bloomberg-chart-tooltip">
          <div className="bloomberg-chart-tooltip__header">{data[0]?.x}</div>
          {data.map((d, i) => (
            <div key={i} className="bloomberg-chart-tooltip__row">
              {d.color && <span className="bloomberg-chart-tooltip__dot" style={{ backgroundColor: d.color }} />}
              <span className="bloomberg-chart-tooltip__label">{d.seriesLabel || ''}</span>
              <span className="bloomberg-chart-tooltip__value" style={{ color: d.color }}>
                {DEFAULT_TICK_FORMAT(d.y)}
              </span>
            </div>
          ))}
        </div>
      </foreignObject>
    </g>
  );
};

// ─── Grid and Axes ────────────────────────────────────────────────────────────

interface GridLinesProps {
  ticks: number[];
  yScale: (v: number) => number;
  width: number;
  padLeft: number;
  padRight: number;
}

const GridLines: React.FC<GridLinesProps> = ({ ticks, yScale, width, padLeft, padRight }) => (
  <>
    {ticks.map(tick => (
      <line
        key={tick}
        x1={padLeft}
        y1={yScale(tick)}
        x2={width - padRight}
        y2={yScale(tick)}
        stroke="#1e2d3d"
        strokeWidth="1"
      />
    ))}
  </>
);

interface YAxisProps {
  ticks: number[];
  yScale: (v: number) => number;
  padLeft: number;
  tickFormat: (v: number) => string;
  label?: string;
  height: number;
}

const YAxis: React.FC<YAxisProps> = ({ ticks, yScale, padLeft, tickFormat, label, height }) => (
  <>
    {ticks.map(tick => (
      <g key={tick}>
        <line x1={padLeft - 4} y1={yScale(tick)} x2={padLeft} y2={yScale(tick)} stroke="#334" />
        <text x={padLeft - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" fill="#667" fontSize="10">
          {tickFormat(tick)}
        </text>
      </g>
    ))}
    <line x1={padLeft} y1={0} x2={padLeft} y2={height} stroke="#334" strokeWidth="1" />
    {label && (
      <text x={14} y={height / 2} textAnchor="middle" fill="#667" fontSize="11"
        transform={`rotate(-90, 14, ${height / 2})`}>{label}</text>
    )}
  </>
);

// ─── LineChart ────────────────────────────────────────────────────────────────

export interface LineChartProps extends BloombergChartProps {
  series: ChartSeries[];
  onHover?: (data: ChartTooltipData | null) => void;
}

export const LineChart: React.FC<LineChartProps> = ({
  series,
  width = '100%',
  height = 200,
  padding = DEFAULT_PADDING,
  xAxis = {},
  yAxis = {},
  title,
  subtitle,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  className = '',
  loading = false,
  noDataMessage = 'No data',
  onHover,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: ChartTooltipData[] } | null>(null);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setSvgWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = svgWidth;
  const H = typeof height === 'number' ? height : 200;
  const pad = padding;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const allY = series.flatMap(s => s.data.map(p => p.y));
  const allX = series[0]?.data.map((_, i) => i) ?? [];

  const yMinRaw = yAxis.min ?? (allY.length > 0 ? Math.min(...allY) : 0);
  const yMaxRaw = yAxis.max ?? (allY.length > 0 ? Math.max(...allY) : 1);
  const { min: yMin, max: yMax, ticks: yTicks } = niceRange(yMinRaw, yMaxRaw, yAxis.tickCount ?? 5);

  const xMin = 0;
  const xMax = Math.max(1, allX.length - 1);

  const xScale = (i: number) => pad.left + (i / xMax) * innerW;
  const yScale = (v: number) => pad.top + ((yMax - v) / (yMax - yMin)) * innerH;

  const xTickStep = Math.max(1, Math.floor(allX.length / 6));
  const xTicks = allX.filter((_, i) => i % xTickStep === 0 || i === allX.length - 1);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!showTooltip || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relX = mouseX - pad.left;
    const idx = Math.round((relX / innerW) * xMax);
    if (idx < 0 || idx >= (series[0]?.data.length ?? 0)) { setTooltip(null); return; }
    const tooltipData: ChartTooltipData[] = series
      .filter(s => s.visible !== false)
      .map((s, si) => ({
        x: String(s.data[idx]?.x ?? idx),
        y: s.data[idx]?.y ?? 0,
        seriesId: s.id,
        seriesLabel: s.label,
        color: s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length],
      }));
    setTooltip({ x: mouseX, y: pad.top + innerH / 4, data: tooltipData });
    onHover?.(tooltipData[0] || null);
  }, [showTooltip, pad, innerW, xMax, series, onHover]);

  const visibleSeries = series.filter(s => s.visible !== false);

  return (
    <div className={`bloomberg-chart bloomberg-linechart ${className}`}>
      {(title || subtitle) && (
        <div className="bloomberg-chart__header">
          {title && <div className="bloomberg-chart__title">{title}</div>}
          {subtitle && <div className="bloomberg-chart__subtitle">{subtitle}</div>}
        </div>
      )}
      {loading && <div className="bloomberg-chart__loading">⟳ Loading...</div>}
      {!loading && allY.length === 0 && <div className="bloomberg-chart__nodata">{noDataMessage}</div>}
      {!loading && allY.length > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setTooltip(null); onHover?.(null); }}
          className="bloomberg-chart__svg"
        >
          {showGrid && <GridLines ticks={yTicks} yScale={yScale} width={W} padLeft={pad.left} padRight={pad.right} />}
          <YAxis ticks={yTicks} yScale={yScale} padLeft={pad.left} tickFormat={yAxis.tickFormat ?? DEFAULT_TICK_FORMAT} label={yAxis.label} height={H} />

          {/* X axis ticks */}
          {xTicks.map(i => {
            const pt = series[0]?.data[i];
            const label = pt ? String(pt.x).slice(0, 10) : String(i);
            return (
              <g key={i}>
                <line x1={xScale(i)} y1={H - pad.bottom} x2={xScale(i)} y2={H - pad.bottom + 4} stroke="#334" />
                <text x={xScale(i)} y={H - pad.bottom + 14} textAnchor="middle" fill="#667" fontSize="9">{label}</text>
              </g>
            );
          })}
          <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="#334" />
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={H - pad.bottom} stroke="#334" />

          {/* Series */}
          {visibleSeries.map((s, si) => {
            const color = s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length];
            const pts = s.data.map((p, i) => `${xScale(i)},${yScale(p.y)}`);
            const pathD = `M ${pts.join(' L ')}`;
            const areaD = `${pathD} L ${xScale(s.data.length - 1)},${yScale(yMin)} L ${xScale(0)},${yScale(yMin)} Z`;
            return (
              <g key={s.id}>
                {(s.showArea) && (
                  <path d={areaD} fill={`${color}${Math.round((s.areaOpacity ?? 0.1) * 255).toString(16).padStart(2, '0')}`} />
                )}
                <path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={s.lineWidth ?? 1.5}
                  strokeDasharray={s.dashed ? '6,3' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* Tooltip */}
          {tooltip && showTooltip && (
            <ChartTooltip x={tooltip.x} y={tooltip.y} data={tooltip.data} visible chartWidth={W} />
          )}
        </svg>
      )}

      {/* Legend */}
      {showLegend && visibleSeries.length > 1 && (
        <div className="bloomberg-chart__legend">
          {series.map((s, si) => (
            <div key={s.id} className="bloomberg-chart__legend-item">
              <span className="bloomberg-chart__legend-line" style={{ backgroundColor: s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length] }} />
              <span className="bloomberg-chart__legend-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── BarChart ─────────────────────────────────────────────────────────────────

export interface BarChartProps extends BloombergChartProps {
  data: DataPoint[];
  color?: string;
  positiveColor?: string;
  negativeColor?: string;
  getColor?: (d: DataPoint, i: number) => string;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  width = '100%',
  height = 180,
  padding = DEFAULT_PADDING,
  yAxis = {},
  title,
  className = '',
  loading = false,
  noDataMessage = 'No data',
  positiveColor = '#00d4aa',
  negativeColor = '#ff4444',
  color,
  getColor,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(500);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(e => { setSvgWidth(e[0]?.contentRect.width ?? 500); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = svgWidth;
  const H = typeof height === 'number' ? height : 180;
  const pad = padding;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const allY = data.map(p => p.y);
  const yMinRaw = yAxis.min ?? Math.min(0, ...allY);
  const yMaxRaw = yAxis.max ?? Math.max(0, ...allY);
  const { min: yMin, max: yMax, ticks: yTicks } = niceRange(yMinRaw, yMaxRaw);
  const yScale = (v: number) => pad.top + ((yMax - v) / (yMax - yMin)) * innerH;
  const zero = yScale(0);

  const barW = Math.max(2, (innerW / Math.max(data.length, 1)) - 2);

  return (
    <div className={`bloomberg-chart bloomberg-barchart ${className}`}>
      {title && <div className="bloomberg-chart__title">{title}</div>}
      {loading && <div className="bloomberg-chart__loading">⟳</div>}
      {!loading && data.length === 0 && <div className="bloomberg-chart__nodata">{noDataMessage}</div>}
      {!loading && data.length > 0 && (
        <svg ref={svgRef} width={width} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {<GridLines ticks={yTicks} yScale={yScale} width={W} padLeft={pad.left} padRight={pad.right} />}
          <YAxis ticks={yTicks} yScale={yScale} padLeft={pad.left} tickFormat={yAxis.tickFormat ?? DEFAULT_TICK_FORMAT} height={H} />
          <line x1={pad.left} y1={zero} x2={W - pad.right} y2={zero} stroke="#334" />

          {data.map((d, i) => {
            const x = pad.left + i * (innerW / data.length) + 1;
            const barColor = getColor ? getColor(d, i) : color ?? (d.y >= 0 ? positiveColor : negativeColor);
            const bH = Math.abs(yScale(d.y) - zero);
            const bY = d.y >= 0 ? yScale(d.y) : zero;
            return (
              <g key={i}>
                <rect x={x} y={bY} width={barW} height={bH} fill={`${barColor}88`} rx="1" />
                {data.length <= 20 && (
                  <text x={x + barW / 2} y={H - pad.bottom + 14} textAnchor="middle" fill="#667" fontSize="9">
                    {String(d.x).slice(0, 4)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};

// ─── CandlestickChart ────────────────────────────────────────────────────────

export interface CandlestickChartProps extends BloombergChartProps {
  data: OHLCV[];
  upColor?: string;
  downColor?: string;
  showVolume?: boolean;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  width = '100%',
  height = 300,
  padding = DEFAULT_PADDING,
  title,
  className = '',
  loading = false,
  noDataMessage = 'No data',
  upColor = '#00d4aa',
  downColor = '#ff4444',
  showVolume = true,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(e => { setSvgWidth(e[0]?.contentRect.width ?? 600); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = svgWidth;
  const H = typeof height === 'number' ? height : 300;
  const pad = { ...DEFAULT_PADDING, ...padding };
  const priceAreaH = showVolume ? (H - pad.top - pad.bottom) * 0.75 : H - pad.top - pad.bottom;
  const volAreaH = showVolume ? (H - pad.top - pad.bottom) * 0.2 : 0;
  const innerW = W - pad.left - pad.right;

  const prices = data.flatMap(d => [d.high, d.low]);
  const yMinRaw = prices.length > 0 ? Math.min(...prices) : 0;
  const yMaxRaw = prices.length > 0 ? Math.max(...prices) : 1;
  const { min: yMin, max: yMax, ticks: yTicks } = niceRange(yMinRaw, yMaxRaw);
  const yScale = (v: number) => pad.top + ((yMax - v) / (yMax - yMin)) * priceAreaH;

  const volumes = data.map(d => d.volume);
  const maxVol = Math.max(1, ...volumes);
  const volBase = pad.top + priceAreaH + (H - pad.top - pad.bottom) * 0.05;
  const volScale = (v: number) => volBase + volAreaH - (v / maxVol) * volAreaH;

  const candleW = Math.max(2, (innerW / Math.max(data.length, 1)) * 0.6);
  const xScale = (i: number) => pad.left + (i + 0.5) * (innerW / Math.max(data.length, 1));

  return (
    <div className={`bloomberg-chart bloomberg-candlestick ${className}`}>
      {title && <div className="bloomberg-chart__title">{title}</div>}
      {loading && <div className="bloomberg-chart__loading">⟳ Loading...</div>}
      {!loading && data.length === 0 && <div className="bloomberg-chart__nodata">{noDataMessage}</div>}
      {!loading && data.length > 0 && (
        <svg ref={svgRef} width={width} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <GridLines ticks={yTicks} yScale={yScale} width={W} padLeft={pad.left} padRight={pad.right} />
          <YAxis ticks={yTicks} yScale={yScale} padLeft={pad.left} tickFormat={DEFAULT_TICK_FORMAT} height={H} />

          {data.map((c, i) => {
            const x = xScale(i);
            const isUp = c.close >= c.open;
            const clr = isUp ? upColor : downColor;
            const bodyTop = yScale(Math.max(c.open, c.close));
            const bodyBot = yScale(Math.min(c.open, c.close));
            const bodyH = Math.max(1, bodyBot - bodyTop);
            const wickX = x;
            return (
              <g key={i}>
                {/* Wick */}
                <line x1={wickX} y1={yScale(c.high)} x2={wickX} y2={yScale(c.low)} stroke={clr} strokeWidth="1" />
                {/* Body */}
                <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={isUp ? `${clr}88` : `${clr}cc`} stroke={clr} strokeWidth="0.5" />
                {/* Volume */}
                {showVolume && (
                  <rect
                    x={x - candleW / 2}
                    y={volScale(c.volume)}
                    width={candleW}
                    height={volBase + volAreaH - volScale(c.volume)}
                    fill={`${clr}44`}
                  />
                )}
              </g>
            );
          })}
          <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="#334" />
        </svg>
      )}
    </div>
  );
};

// ─── Export all ──────────────────────────────────────────────────────────────

export default LineChart;
