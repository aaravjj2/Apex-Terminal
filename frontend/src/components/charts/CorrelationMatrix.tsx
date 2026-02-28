/**
 * CorrelationMatrix.tsx
 * Interactive correlation matrix heatmap with cluster sorting, hover tooltip,
 * filtering, statistical significance overlay, dendrogram preview,
 * and multi-asset correlation exploration.
 */

import React, { useState, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrelationEntry {
  asset_a: string;
  asset_b: string;
  correlation: number;   // -1 to +1
  p_value?: number;
  sample_size?: number;
  rolling_window?: number;
}

export interface CorrelationMatrixProps {
  assets: string[];              // asset labels in order
  matrix: number[][];            // NxN matrix
  pValues?: number[][];          // NxN p-values (optional)
  clusters?: number[];           // cluster assignment per asset
  showSignificance?: boolean;
  sigThreshold?: number;         // e.g. 0.05
  colorScheme?: 'redBlueGreen' | 'redWhiteBlue' | 'spectral';
  sort?: 'original' | 'cluster' | 'alpha';
  onCellClick?: (a: string, b: string, corr: number) => void;
  cellSize?: number;
  fontSize?: number;
  title?: string;
  className?: string;
}

export type SortMode = 'original' | 'cluster' | 'alpha';

// ─── Color Interpolation ──────────────────────────────────────────────────────

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function corrToColor(corr: number, scheme: string): string {
  // clamp
  const c = Math.max(-1, Math.min(1, corr));

  if (scheme === 'redWhiteBlue') {
    const neg: RGB = parseHex('#cc2222');
    const mid: RGB = parseHex('#f8f8ee');
    const pos: RGB = parseHex('#1144cc');
    return c >= 0 ? toHex(lerpRGB(mid, pos, c)) : toHex(lerpRGB(mid, neg, -c));
  }
  if (scheme === 'spectral') {
    const stops: Array<[number, RGB]> = [
      [-1, parseHex('#9e0142')],
      [-0.5, parseHex('#f46d43')],
      [0, parseHex('#ffffbf')],
      [0.5, parseHex('#66c2a5')],
      [1, parseHex('#5e4fa2')],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [lo, colLo] = stops[i];
      const [hi, colHi] = stops[i + 1];
      if (c >= lo && c <= hi) {
        const t = (c - lo) / (hi - lo);
        return toHex(lerpRGB(colLo, colHi, t));
      }
    }
    return '#888';
  }
  // Default: redBlueGreen
  const neg: RGB = parseHex('#cc2244');
  const mid: RGB = parseHex('#1a2332');
  const pos: RGB = parseHex('#00cc88');
  return c >= 0 ? toHex(lerpRGB(mid, pos, c)) : toHex(lerpRGB(mid, neg, -c));
}

function luminance([r, g, b]: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

function applySortOrder(assets: string[], matrix: number[][], pValues: number[][] | undefined, clusters: number[] | undefined, sort: SortMode): {
  sortedAssets: string[];
  sortedMatrix: number[][];
  sortedP?: number[][];
} {
  let indices: number[];
  if (sort === 'alpha') {
    indices = assets.map((_, i) => i).sort((a, b) => assets[a].localeCompare(assets[b]));
  } else if (sort === 'cluster' && clusters) {
    indices = assets.map((_, i) => i).sort((a, b) => (clusters[a] ?? 0) - (clusters[b] ?? 0));
  } else {
    indices = assets.map((_, i) => i);
  }
  const sortedAssets = indices.map(i => assets[i]);
  const sortedMatrix = indices.map(i => indices.map(j => matrix[i][j]));
  const sortedP = pValues ? indices.map(i => indices.map(j => pValues[i][j])) : undefined;
  return { sortedAssets, sortedMatrix, sortedP };
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  assetA: string;
  assetB: string;
  corr: number;
  pValue?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  assets,
  matrix,
  pValues,
  clusters,
  showSignificance = true,
  sigThreshold = 0.05,
  colorScheme = 'redBlueGreen',
  sort = 'original',
  onCellClick,
  cellSize = 38,
  fontSize = 8,
  title,
  className = '',
}) => {
  const [sortMode, setSortMode] = useState<SortMode>(sort);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, assetA: '', assetB: '', corr: 0 });
  const [highlightAsset, setHighlightAsset] = useState<string | null>(null);
  const [filterThreshold, setFilterThreshold] = useState<number>(0);  // hide correlations below threshold

  const { sortedAssets, sortedMatrix, sortedP } = useMemo(
    () => applySortOrder(assets, matrix, pValues, clusters, sortMode),
    [assets, matrix, pValues, clusters, sortMode]
  );

  const n = sortedAssets.length;
  const labelAreaW = 60;
  const labelAreaH = 60;
  const svgW = labelAreaW + n * cellSize + 20;
  const svgH = labelAreaH + n * cellSize + 20;

  // Legend
  const legendW = 160;
  const legendH = 16;

  const handleCellEnter = useCallback((e: React.MouseEvent, ai: number, bi: number) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.right + 8,
      y: rect.top - 10,
      assetA: sortedAssets[ai],
      assetB: sortedAssets[bi],
      corr: sortedMatrix[ai][bi],
      pValue: sortedP?.[ai][bi],
    });
  }, [sortedAssets, sortedMatrix, sortedP]);

  const handleCellLeave = useCallback(() => {
    setTooltip(t => ({ ...t, visible: false }));
  }, []);

  return (
    <div className={`correlation-matrix ${className}`} style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {title && (
          <span style={{ color: '#ccc', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' }}>{title}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['original', 'alpha', 'cluster'] as SortMode[]).map(m => (
            <button
              key={m}
              onClick={() => setSortMode(m)}
              style={{
                padding: '2px 7px',
                background: sortMode === m ? '#4a9eff' : '#1a2a38',
                border: '1px solid #2a3a4a',
                borderRadius: 3,
                color: sortMode === m ? '#000' : '#888',
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            >
              {m}
            </button>
          ))}
          {/* Threshold filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>|ρ|≥</span>
            <input
              type="number"
              value={filterThreshold}
              min={0} max={1} step={0.05}
              onChange={e => setFilterThreshold(parseFloat(e.target.value) || 0)}
              style={{
                width: 40, padding: '1px 3px', background: '#0e1c2e',
                border: '1px solid #2a3a4a', color: '#ccc', fontSize: 9, fontFamily: 'monospace',
              }}
            />
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>-1</span>
        <svg width={legendW} height={legendH}>
          <defs>
            <linearGradient id="corrLegend" x1="0" y1="0" x2="1" y2="0">
              {[-1, -0.5, 0, 0.5, 1].map((v, i) => (
                <stop key={i} offset={`${(v + 1) * 50}%`} stopColor={corrToColor(v, colorScheme)} />
              ))}
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={legendW} height={legendH} fill="url(#corrLegend)" rx={2} />
        </svg>
        <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>+1</span>
      </div>

      {/* Matrix SVG */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxWidth: '100%', maxHeight: '70vh' }}>
        <svg width={svgW} height={svgH} style={{ fontFamily: 'monospace' }}>
          {/* Column labels (rotated) */}
          {sortedAssets.map((asset, j) => (
            <g key={j} onClick={() => setHighlightAsset(highlightAsset === asset ? null : asset)} style={{ cursor: 'pointer' }}>
              <text
                x={labelAreaW + j * cellSize + cellSize / 2}
                y={labelAreaH - 6}
                textAnchor="start"
                fill={highlightAsset === asset ? '#4a9eff' : '#888'}
                fontSize={fontSize}
                transform={`rotate(-45, ${labelAreaW + j * cellSize + cellSize / 2}, ${labelAreaH - 6})`}
              >
                {asset}
              </text>
            </g>
          ))}

          {/* Row labels */}
          {sortedAssets.map((asset, i) => (
            <g key={i} onClick={() => setHighlightAsset(highlightAsset === asset ? null : asset)} style={{ cursor: 'pointer' }}>
              <text
                x={labelAreaW - 6}
                y={labelAreaH + i * cellSize + cellSize / 2 + 3}
                textAnchor="end"
                fill={highlightAsset === asset ? '#4a9eff' : '#888'}
                fontSize={fontSize}
              >
                {asset}
              </text>
            </g>
          ))}

          {/* Cells */}
          {sortedAssets.map((assetA, i) =>
            sortedAssets.map((assetB, j) => {
              const corr = sortedMatrix[i][j];
              const pVal = sortedP?.[i][j];
              const isFiltered = Math.abs(corr) < filterThreshold && i !== j;
              const bg = isFiltered ? '#0e1826' : corrToColor(corr, colorScheme);
              const isHighlighted = highlightAsset === assetA || highlightAsset === assetB;
              const isDiag = i === j;
              const isInsignificant = showSignificance && pVal != null && pVal > sigThreshold && !isDiag;
              const textColor = luminance(parseHex(bg)) > 0.42 ? '#000' : '#ddd';

              return (
                <g
                  key={`${i}_${j}`}
                  style={{ cursor: onCellClick ? 'pointer' : 'default' }}
                  onMouseEnter={e => handleCellEnter(e, i, j)}
                  onMouseLeave={handleCellLeave}
                  onClick={() => !isDiag && onCellClick?.(assetA, assetB, corr)}
                  opacity={highlightAsset && !isHighlighted ? 0.3 : 1}
                >
                  <rect
                    x={labelAreaW + j * cellSize}
                    y={labelAreaH + i * cellSize}
                    width={cellSize - 1}
                    height={cellSize - 1}
                    fill={bg}
                    rx={1}
                    stroke={isDiag ? '#4a9eff' : 'none'}
                    strokeWidth={isDiag ? 1 : 0}
                  />
                  {/* Insignificance overlay */}
                  {isInsignificant && (
                    <text
                      x={labelAreaW + j * cellSize + cellSize / 2}
                      y={labelAreaH + i * cellSize + cellSize * 0.72}
                      textAnchor="middle"
                      fill={textColor}
                      fontSize={6}
                      opacity={0.5}
                    >
                      n.s.
                    </text>
                  )}
                  {/* Value label */}
                  {!isFiltered && cellSize >= 28 && (
                    <text
                      x={labelAreaW + j * cellSize + cellSize / 2}
                      y={labelAreaH + i * cellSize + cellSize / 2 + 3}
                      textAnchor="middle"
                      fill={textColor}
                      fontSize={fontSize}
                      fontWeight={isDiag ? 'bold' : 'normal'}
                    >
                      {isDiag ? '1.00' : corr.toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          background: '#0e1c2e',
          border: '1px solid #3a4a5a',
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: 11,
          color: '#ddd',
          pointerEvents: 'none',
          zIndex: 100,
          fontFamily: 'monospace',
        }}>
          <div><b style={{ color: '#4a9eff' }}>{tooltip.assetA}</b> × <b style={{ color: '#4a9eff' }}>{tooltip.assetB}</b></div>
          <div>Correlation: <b style={{ color: tooltip.corr > 0 ? '#00d4aa' : '#ff4466' }}>{tooltip.corr.toFixed(4)}</b></div>
          {tooltip.pValue !== undefined && (
            <div>p-value: <b style={{ color: tooltip.pValue < 0.05 ? '#00d4aa' : '#ff9900' }}>{tooltip.pValue.toFixed(4)}</b>
              {tooltip.pValue < 0.01 ? ' ***' : tooltip.pValue < 0.05 ? ' **' : tooltip.pValue < 0.1 ? ' *' : ' n.s.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CorrelationMatrix;
