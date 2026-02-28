/**
 * BloombergHeatmap.tsx
 * Reusable color-matrix heatmap component for Apex Terminal.
 * Supports sector-vs-factor grids, correlation matrices, calendar heatmaps,
 * returns grids, and any arbitrary 2D data. Includes hover tooltip, row/column
 * sorting, color interpolation, and axis labeling.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeatmapCell {
  value: number | null;
  label?: string;             // override cell text
  tooltip?: string;           // tooltip override
  borderColor?: string;       // cell border highlight
}

export type HeatmapRow = HeatmapCell[];

export interface HeatmapColorScheme {
  name: string;
  stops: Array<{ value: number; color: string }>;
}

export type SortOrder = 'asc' | 'desc' | 'none';

export interface HeatmapColumnSort {
  colIndex: number;
  order: SortOrder;
}

export interface BloombergHeatmapProps {
  rows: HeatmapRow[];
  rowLabels: string[];
  colLabels: string[];
  title?: string;
  colorScheme?: HeatmapColorScheme;
  cellSize?: number;
  showValues?: boolean;
  valueFontSize?: number;
  valueFormatter?: (v: number) => string;
  minValue?: number;
  maxValue?: number;
  autoScale?: boolean;
  sortable?: boolean;
  onCellClick?: (rowIndex: number, colIndex: number, value: number | null) => void;
  highlightRow?: number;
  highlightCol?: number;
  rowLabelWidth?: number;
  colLabelHeight?: number;
  nullColor?: string;
  className?: string;
}

// ─── Color Schemes ────────────────────────────────────────────────────────────

export const COLOR_SCHEMES: Record<string, HeatmapColorScheme> = {
  redGreen: {
    name: 'Red-Green',
    stops: [
      { value: -1, color: '#ff2244' },
      { value: -0.5, color: '#cc3333' },
      { value: 0, color: '#1a2a38' },
      { value: 0.5, color: '#226633' },
      { value: 1, color: '#00d4aa' },
    ],
  },
  correlation: {
    name: 'Correlation',
    stops: [
      { value: -1, color: '#e55' },
      { value: -0.5, color: '#a33' },
      { value: 0, color: '#222' },
      { value: 0.5, color: '#335' },
      { value: 1, color: '#44f' },
    ],
  },
  heat: {
    name: 'Heat',
    stops: [
      { value: 0, color: '#0a1628' },
      { value: 0.3, color: '#220033' },
      { value: 0.6, color: '#882200' },
      { value: 0.8, color: '#ff6600' },
      { value: 1, color: '#ffee00' },
    ],
  },
  blueWhiteRed: {
    name: 'Blue-White-Red',
    stops: [
      { value: -1, color: '#2255cc' },
      { value: 0, color: '#cccccc' },
      { value: 1, color: '#cc2222' },
    ],
  },
  performance: {
    name: 'Performance',
    stops: [
      { value: -0.15, color: '#ff2244' },
      { value: -0.05, color: '#ff9900' },
      { value: 0, color: '#444444' },
      { value: 0.05, color: '#00aa77' },
      { value: 0.15, color: '#00ff9d' },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function interpolateColor(value: number, stops: HeatmapColorScheme['stops']): string {
  if (!stops.length) return '#888';
  const sorted = [...stops].sort((a, b) => a.value - b.value);
  if (value <= sorted[0].value) return sorted[0].color;
  if (value >= sorted[sorted.length - 1].value) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (value >= lo.value && value <= hi.value) {
      const t = (value - lo.value) / (hi.value - lo.value);
      const [r1, g1, b1] = hexToRgb(lo.color);
      const [r2, g2, b2] = hexToRgb(hi.color);
      return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
    }
  }
  return sorted[sorted.length - 1].color;
}

function normalizeValue(v: number, min: number, max: number): number {
  if (max === min) return 0;
  return (v - min) / (max - min);
}

function textColorForBackground(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.45 ? '#000' : '#fff';
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const BloombergHeatmap: React.FC<BloombergHeatmapProps> = ({
  rows,
  rowLabels,
  colLabels,
  title,
  colorScheme = COLOR_SCHEMES.redGreen,
  cellSize = 42,
  showValues = true,
  valueFontSize = 9,
  valueFormatter = (v) => v.toFixed(2),
  minValue,
  maxValue,
  autoScale = true,
  sortable = false,
  onCellClick,
  highlightRow,
  highlightCol,
  rowLabelWidth = 100,
  colLabelHeight = 44,
  nullColor = '#1a2332',
  className = '',
}) => {
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: '' });
  const [sortState, setSortState] = useState<HeatmapColumnSort | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute value range
  const { computedMin, computedMax } = useMemo(() => {
    if (!autoScale || (minValue !== undefined && maxValue !== undefined)) {
      return { computedMin: minValue ?? 0, computedMax: maxValue ?? 1 };
    }
    let lo = Infinity, hi = -Infinity;
    rows.forEach(row => row.forEach(cell => {
      if (cell.value !== null) {
        lo = Math.min(lo, cell.value);
        hi = Math.max(hi, cell.value);
      }
    }));
    const range = hi - lo;
    return { computedMin: lo - range * 0.05, computedMax: hi + range * 0.05 };
  }, [rows, minValue, maxValue, autoScale]);

  // Sort rows by a column
  const displayRows = useMemo(() => {
    if (!sortState || sortState.order === 'none') {
      return rows.map((row, i) => ({ row, originalIndex: i }));
    }
    const indexed = rows.map((row, i) => ({ row, originalIndex: i }));
    indexed.sort((a, b) => {
      const va = a.row[sortState.colIndex]?.value ?? -Infinity;
      const vb = b.row[sortState.colIndex]?.value ?? -Infinity;
      return sortState.order === 'asc' ? va - vb : vb - va;
    });
    return indexed;
  }, [rows, sortState]);

  const handleSort = useCallback((colIndex: number) => {
    if (!sortable) return;
    setSortState(prev => {
      if (!prev || prev.colIndex !== colIndex) return { colIndex, order: 'desc' };
      if (prev.order === 'desc') return { colIndex, order: 'asc' };
      return null;
    });
  }, [sortable]);

  const handleMouseEnterCell = useCallback(
    (e: React.MouseEvent, cell: HeatmapCell, rowLabel: string, colLabel: string) => {
      if (!cell.value === null) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const text = cell.tooltip ?? `${rowLabel} × ${colLabel}: ${cell.value !== null ? valueFormatter(cell.value) : 'N/A'}`;
      setTooltip({ visible: true, x: e.clientX - (rect?.left ?? 0) + 10, y: e.clientY - (rect?.top ?? 0) - 30, content: text });
    },
    [valueFormatter]
  );

  const handleMouseLeaveCell = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  const totalWidth = rowLabelWidth + colLabels.length * cellSize;
  const totalHeight = colLabelHeight + rows.length * cellSize;

  return (
    <div className={`bloomberg-heatmap ${className}`} ref={containerRef} style={{ position: 'relative', overflowX: 'auto' }}>
      {title && (
        <div className="bloomberg-heatmap__title" style={{ color: '#ccc', fontSize: 12, fontWeight: 'bold', marginBottom: 8, fontFamily: 'monospace' }}>
          {title}
        </div>
      )}

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg width={totalWidth} height={totalHeight}>
          {/* Column labels */}
          {colLabels.map((label, ci) => {
            const x = rowLabelWidth + ci * cellSize + cellSize / 2;
            const isSorted = sortState?.colIndex === ci;
            return (
              <g key={ci} onClick={() => handleSort(ci)} style={{ cursor: sortable ? 'pointer' : 'default' }}>
                <text
                  x={x}
                  y={colLabelHeight - 8}
                  textAnchor="middle"
                  fill={hoveredCol === ci || highlightCol === ci ? '#fff' : '#aaa'}
                  fontSize={9}
                  fontFamily="monospace"
                  transform={`rotate(-45, ${x}, ${colLabelHeight - 8})`}
                >
                  {label}
                </text>
                {isSorted && (
                  <text x={x} y={colLabelHeight - 2} textAnchor="middle" fill="#4a9eff" fontSize={8}>
                    {sortState?.order === 'asc' ? '▲' : '▼'}
                  </text>
                )}
              </g>
            );
          })}

          {/* Row labels and cells */}
          {displayRows.map(({ row, originalIndex }, ri) => {
            const y = colLabelHeight + ri * cellSize;
            const rowLabel = rowLabels[originalIndex] ?? '';
            const isHiRow = hoveredRow === ri || highlightRow === originalIndex;
            return (
              <g key={originalIndex} onMouseEnter={() => setHoveredRow(ri)} onMouseLeave={() => setHoveredRow(null)}>
                {/* Row label */}
                <text
                  x={rowLabelWidth - 6}
                  y={y + cellSize / 2 + 4}
                  textAnchor="end"
                  fill={isHiRow ? '#fff' : '#aaa'}
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {rowLabel}
                </text>
                {/* Cells */}
                {row.map((cell, ci) => {
                  const cx = rowLabelWidth + ci * cellSize;
                  const isHiCol = hoveredCol === ci || highlightCol === ci;
                  let bg = nullColor;
                  let textFill = '#888';
                  if (cell.value !== null) {
                    const norm = normalizeValue(cell.value, computedMin, computedMax);
                    const mapped = colorScheme.stops[0].value +
                      (colorScheme.stops[colorScheme.stops.length - 1].value - colorScheme.stops[0].value) * norm;
                    bg = interpolateColor(mapped, colorScheme.stops);
                    textFill = textColorForBackground(bg);
                  }
                  const stroke = cell.borderColor || (isHiRow || isHiCol ? '#4a9eff' : '#0a1628');
                  const strokeW = cell.borderColor ? 2 : isHiRow || isHiCol ? 1.5 : 0.5;
                  return (
                    <g
                      key={ci}
                      onMouseEnter={(e) => { setHoveredCol(ci); handleMouseEnterCell(e, cell, rowLabel, colLabels[ci]); }}
                      onMouseLeave={() => { setHoveredCol(null); handleMouseLeaveCell(); }}
                      onClick={() => cell.value !== null && onCellClick?.(originalIndex, ci, cell.value)}
                      style={{ cursor: onCellClick ? 'pointer' : 'default' }}
                    >
                      <rect
                        x={cx + 1}
                        y={y + 1}
                        width={cellSize - 2}
                        height={cellSize - 2}
                        fill={bg}
                        stroke={stroke}
                        strokeWidth={strokeW}
                        rx={2}
                      />
                      {showValues && cell.value !== null && (
                        <text
                          x={cx + cellSize / 2}
                          y={y + cellSize / 2 + valueFontSize / 3}
                          textAnchor="middle"
                          fill={textFill}
                          fontSize={valueFontSize}
                          fontFamily="monospace"
                        >
                          {cell.label ?? valueFormatter(cell.value)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="bloomberg-heatmap__tooltip"
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y,
              background: '#1a2a3a',
              border: '1px solid #4a9eff',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              color: '#ddd',
              pointerEvents: 'none',
              zIndex: 100,
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>

      {/* Color scale legend */}
      <ColorLegend scheme={colorScheme} minValue={computedMin} maxValue={computedMax} formatter={valueFormatter} />
    </div>
  );
};

// ─── Color Legend ─────────────────────────────────────────────────────────────

interface ColorLegendProps {
  scheme: HeatmapColorScheme;
  minValue: number;
  maxValue: number;
  formatter: (v: number) => string;
}

const ColorLegend: React.FC<ColorLegendProps> = ({ scheme, minValue, maxValue, formatter }) => {
  const steps = 40;
  const width = 200;
  const height = 12;

  return (
    <div className="bloomberg-heatmap__legend" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>{formatter(minValue)}</span>
      <svg width={width} height={height} style={{ flexShrink: 0 }}>
        {Array.from({ length: steps }, (_, i) => {
          const t = i / (steps - 1);
          const value = minValue + (maxValue - minValue) * t;
          const norm = t;
          const schemeRange = scheme.stops[scheme.stops.length - 1].value - scheme.stops[0].value;
          const mappedValue = scheme.stops[0].value + schemeRange * norm;
          const color = interpolateColor(mappedValue, scheme.stops);
          return (
            <rect key={i} x={(i / steps) * width} y={0} width={width / steps + 1} height={height} fill={color} />
          );
        })}
        <rect x={0} y={0} width={width} height={height} fill="none" stroke="#2a3a4a" strokeWidth={1} rx={2} />
      </svg>
      <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>{formatter(maxValue)}</span>
    </div>
  );
};

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

export interface CalendarHeatmapProps {
  data: Array<{ date: string; value: number }>;  // ISO date strings
  year?: number;
  colorScheme?: HeatmapColorScheme;
  cellSize?: number;
  valueFormatter?: (v: number) => string;
  onCellClick?: (date: string, value: number) => void;
  className?: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  data,
  year = new Date().getFullYear(),
  colorScheme = COLOR_SCHEMES.performance,
  cellSize = 13,
  valueFormatter = (v) => v.toFixed(2),
  onCellClick,
  className = '',
}) => {
  const dataMap = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach(d => m.set(d.date, d.value));
    return m;
  }, [data]);

  const allValues = data.map(d => d.value);
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const schemeRange = colorScheme.stops[colorScheme.stops.length - 1].value - colorScheme.stops[0].value;

  function getColor(value: number, scheme: HeatmapColorScheme): string {
    const norm = (value - minV) / ((maxV - minV) || 1);
    const mappedValue = scheme.stops[0].value + schemeRange * norm;
    return interpolateColor(mappedValue, scheme.stops);
  }

  const startDate = new Date(year, 0, 1);
  const startDoW = startDate.getDay();
  const totalWeeks = Math.ceil((365 + startDoW) / 7) + 1;
  const gap = 2;
  const svgWidth = totalWeeks * (cellSize + gap) + 28;
  const svgHeight = 7 * (cellSize + gap) + 24;

  const cells: Array<{ x: number; y: number; date: string; value: number | null }> = [];
  let dayOfYear = 0;
  for (let week = 0; week < totalWeeks; week++) {
    for (let dow = 0; dow < 7; dow++) {
      const dayIdx = week * 7 + dow - startDoW;
      if (dayIdx < 0 || dayIdx >= 365) continue;
      const d = new Date(year, 0, dayIdx + 1);
      const dateStr = d.toISOString().slice(0, 10);
      cells.push({
        x: 24 + week * (cellSize + gap),
        y: 18 + dow * (cellSize + gap),
        date: dateStr,
        value: dataMap.has(dateStr) ? dataMap.get(dateStr)! : null,
      });
      dayOfYear++;
    }
  }

  return (
    <div className={`calendar-heatmap ${className}`} style={{ overflowX: 'auto' }}>
      <svg width={svgWidth} height={svgHeight}>
        {/* Day labels */}
        {DAY_LABELS.map((d, i) => (
          <text key={i} x={0} y={18 + i * (cellSize + gap) + cellSize / 1.5} fill="#555" fontSize={8} fontFamily="monospace">{d}</text>
        ))}
        {/* Month labels */}
        {MONTH_LABELS.map((m, mi) => {
          const firstDay = new Date(year, mi, 1);
          const dayIdx = Math.floor((firstDay.getTime() - startDate.getTime()) / 86400000);
          const week = Math.floor((dayIdx + startDoW) / 7);
          return (
            <text key={mi} x={24 + week * (cellSize + gap)} y={12} fill="#666" fontSize={8} fontFamily="monospace">{m}</text>
          );
        })}
        {/* Cells */}
        {cells.map((cell, i) => (
          <rect
            key={i}
            x={cell.x}
            y={cell.y}
            width={cellSize}
            height={cellSize}
            fill={cell.value !== null ? getColor(cell.value, colorScheme) : '#1a2332'}
            rx={2}
            style={{ cursor: onCellClick ? 'pointer' : 'default' }}
            onClick={() => cell.value !== null && onCellClick?.(cell.date, cell.value)}
          >
            {cell.value !== null && (
              <title>{`${cell.date}: ${valueFormatter(cell.value)}`}</title>
            )}
          </rect>
        ))}
      </svg>
    </div>
  );
};

export default BloombergHeatmap;
