import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type DataType = 'correlation' | 'returns' | 'spreads';
type TimePeriod = '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

interface MatrixCell {
  row: number;
  col: number;
  value: number;
}

interface MatrixViewProps {
  className?: string;
  tickers?: string[];
}

// ─── Mock Data & Helpers ────────────────────────────────────────────────────

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'XOM', 'GLD'];

function generateCorrelationMatrix(tickers: string[], seed: number): number[][] {
  const n = tickers.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  const sectorMap: Record<string, number> = {
    AAPL: 0, MSFT: 0, GOOGL: 0, AMZN: 0, NVDA: 0, META: 0,
    TSLA: 1, JPM: 2, V: 2, JNJ: 3, XOM: 4, GLD: 5,
  };

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sameSector = sectorMap[tickers[i]] === sectorMap[tickers[j]];
      const base = sameSector ? 0.65 : 0.25;
      const noise = (pseudoRandom(seed + i * 100 + j) - 0.5) * 0.4;
      const val = Math.max(-1, Math.min(1, base + noise));
      matrix[i][j] = val;
      matrix[j][i] = val;
    }
  }
  return matrix;
}

function generateReturnsMatrix(tickers: string[], seed: number): number[][] {
  const n = tickers.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      return (pseudoRandom(seed + i * 50 + j * 3) - 0.4) * 30;
    })
  );
}

function generateSpreadsMatrix(tickers: string[], seed: number): number[][] {
  const n = tickers.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      return (pseudoRandom(seed + i * 77 + j * 11) - 0.5) * 200;
    })
  );
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function getCorrelationColor(value: number): string {
  if (value >= 0.8) return 'bg-[#00cc66]';
  if (value >= 0.6) return 'bg-[#00cc66]/70';
  if (value >= 0.4) return 'bg-[#00cc66]/40';
  if (value >= 0.2) return 'bg-[#00cc66]/20';
  if (value > -0.2) return 'bg-[#333]';
  if (value > -0.4) return 'bg-[#ff3333]/20';
  if (value > -0.6) return 'bg-[#ff3333]/40';
  if (value > -0.8) return 'bg-[#ff3333]/70';
  return 'bg-[#ff3333]';
}

function getValueColor(value: number, type: DataType): string {
  if (type === 'correlation') return getCorrelationColor(value);
  if (value > 0) {
    const intensity = Math.min(1, Math.abs(value) / (type === 'returns' ? 20 : 100));
    if (intensity > 0.7) return 'bg-[#00cc66]';
    if (intensity > 0.4) return 'bg-[#00cc66]/50';
    return 'bg-[#00cc66]/20';
  }
  if (value < 0) {
    const intensity = Math.min(1, Math.abs(value) / (type === 'returns' ? 20 : 100));
    if (intensity > 0.7) return 'bg-[#ff3333]';
    if (intensity > 0.4) return 'bg-[#ff3333]/50';
    return 'bg-[#ff3333]/20';
  }
  return 'bg-[#1a1a2e]';
}

function getTextColor(value: number, type: DataType): string {
  if (type === 'correlation') {
    if (Math.abs(value) > 0.6) return 'text-white';
    return 'text-[#ccc]';
  }
  if (Math.abs(value) > (type === 'returns' ? 12 : 60)) return 'text-white';
  return 'text-[#ccc]';
}

function formatValue(value: number, type: DataType): string {
  if (type === 'correlation') return value.toFixed(2);
  if (type === 'returns') return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}bp`;
}

const PERIOD_SEEDS: Record<TimePeriod, number> = {
  '1W': 42, '1M': 137, '3M': 256, '6M': 389, '1Y': 512, '3Y': 701, '5Y': 888,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function MatrixView({ className = '', tickers = DEFAULT_TICKERS }: MatrixViewProps) {
  const [dataType, setDataType] = useState<DataType>('correlation');
  const [period, setPeriod] = useState<TimePeriod>('1Y');
  const [hoveredCell, setHoveredCell] = useState<MatrixCell | null>(null);
  const [sortOrder, setSortOrder] = useState<number[] | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const matrix = useMemo(() => {
    const seed = PERIOD_SEEDS[period];
    switch (dataType) {
      case 'correlation': return generateCorrelationMatrix(tickers, seed);
      case 'returns': return generateReturnsMatrix(tickers, seed);
      case 'spreads': return generateSpreadsMatrix(tickers, seed);
    }
  }, [tickers, dataType, period]);

  const orderedIndices = useMemo(() => {
    if (sortOrder) return sortOrder;
    return Array.from({ length: tickers.length }, (_, i) => i);
  }, [sortOrder, tickers.length]);

  const clusterSort = useCallback(() => {
    const n = tickers.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    indices.sort((a, b) => {
      const sumA = matrix[a].reduce((s, v) => s + v, 0);
      const sumB = matrix[b].reduce((s, v) => s + v, 0);
      return sumB - sumA;
    });
    setSortOrder(indices);
  }, [matrix, tickers.length]);

  const resetSort = useCallback(() => setSortOrder(null), []);

  const handleExport = useCallback(() => {
    const header = ['', ...orderedIndices.map(i => tickers[i])].join(',');
    const rows = orderedIndices.map(ri => {
      const row = [tickers[ri], ...orderedIndices.map(ci => formatValue(matrix[ri][ci], dataType))];
      return row.join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${dataType}-matrix.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [orderedIndices, tickers, matrix, dataType]);

  const stats = useMemo(() => {
    const vals: number[] = [];
    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        vals.push(matrix[orderedIndices[i]][orderedIndices[j]]);
      }
    }
    vals.sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const median = vals[Math.floor(vals.length / 2)];
    const min = vals[0];
    const max = vals[vals.length - 1];
    return { mean, median, min, max, count: vals.length };
  }, [matrix, orderedIndices, tickers.length]);

  const cellSize = Math.max(28, Math.min(50, 50 * zoomLevel));

  return (
    <div className={`bg-[#0a0a14] border border-[#1a1a2e] font-mono flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0f0f1e]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#ff9900] font-bold text-xs tracking-wider">MATRIX</span>
          <div className="flex items-center gap-2">
            <button onClick={clusterSort} className="text-[10px] text-[#555] hover:text-[#ff9900]">CLUSTER</button>
            <button onClick={resetSort} className="text-[10px] text-[#555] hover:text-[#ff9900]">RESET</button>
            <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="text-[10px] text-[#555] hover:text-[#ff9900]">−</button>
            <span className="text-[10px] text-[#666]">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(2, z + 0.1))} className="text-[10px] text-[#555] hover:text-[#ff9900]">+</button>
            <button onClick={handleExport} className="text-[10px] text-[#555] hover:text-[#ff9900]">EXPORT</button>
          </div>
        </div>

        {/* Data Type */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#555]">TYPE</span>
            {(['correlation', 'returns', 'spreads'] as DataType[]).map(dt => (
              <button
                key={dt}
                onClick={() => setDataType(dt)}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  dataType === dt ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'text-[#555] hover:text-[#888]'
                }`}
              >{dt.toUpperCase()}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#555]">PERIOD</span>
            {(['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y'] as TimePeriod[]).map(tp => (
              <button
                key={tp}
                onClick={() => setPeriod(tp)}
                className={`px-2 py-0.5 text-[10px] rounded ${
                  period === tp ? 'bg-[#6699ff]/20 text-[#6699ff]' : 'text-[#555] hover:text-[#888]'
                }`}
              >{tp}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Matrix Grid */}
      <div ref={containerRef} className="flex-1 overflow-auto p-3">
        <div className="inline-block">
          <table className="border-collapse" style={{ fontSize: `${Math.max(8, 10 * zoomLevel)}px` }}>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-[#0a0a14]" style={{ width: 60 }} />
                {orderedIndices.map(ci => (
                  <th
                    key={ci}
                    className="sticky top-0 z-10 bg-[#0a0a14] text-[#ff9900] font-bold px-0.5 py-1"
                    style={{ width: cellSize, minWidth: cellSize }}
                  >
                    <div className="transform -rotate-45 origin-bottom-left whitespace-nowrap">
                      {tickers[ci]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderedIndices.map((ri, rowVisIdx) => (
                <tr key={ri}>
                  <td className="sticky left-0 z-10 bg-[#0a0a14] text-[#ff9900] font-bold text-right pr-2 py-0"
                    style={{ width: 60 }}>
                    {tickers[ri]}
                  </td>
                  {orderedIndices.map((ci, colVisIdx) => {
                    const value = matrix[ri][ci];
                    const isHovered =
                      hoveredCell?.row === rowVisIdx && hoveredCell?.col === colVisIdx;
                    const isRowOrCol =
                      hoveredCell?.row === rowVisIdx || hoveredCell?.col === colVisIdx;
                    const isDiagonal = ri === ci;

                    return (
                      <td
                        key={ci}
                        onMouseEnter={() => setHoveredCell({ row: rowVisIdx, col: colVisIdx, value })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`text-center transition-all cursor-crosshair ${
                          isDiagonal ? 'bg-[#1a1a2e]' : getValueColor(value, dataType)
                        } ${isHovered ? 'ring-1 ring-[#ff9900]' : ''} ${
                          isRowOrCol && !isHovered ? 'brightness-125' : ''
                        }`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          minWidth: cellSize,
                          padding: 0,
                        }}
                      >
                        <span className={`${isDiagonal ? 'text-[#555]' : getTextColor(value, dataType)} leading-none`}>
                          {isDiagonal
                            ? (dataType === 'correlation' ? '1.00' : '—')
                            : formatValue(value, dataType)
                          }
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="px-3 py-1.5 border-t border-[#1a1a2e] bg-[#0f0f1e] flex items-center gap-4">
          <span className="text-[#ff9900] text-xs font-bold">
            {tickers[orderedIndices[hoveredCell.row]]} × {tickers[orderedIndices[hoveredCell.col]]}
          </span>
          <span className={`text-xs font-bold ${
            hoveredCell.value >= 0 ? 'text-[#00cc66]' : 'text-[#ff3333]'
          }`}>
            {formatValue(hoveredCell.value, dataType)}
          </span>
          <span className="text-[10px] text-[#555]">
            {dataType === 'correlation' ? (
              hoveredCell.value > 0.7 ? 'Strong positive' :
              hoveredCell.value > 0.3 ? 'Moderate positive' :
              hoveredCell.value > -0.3 ? 'Weak/No correlation' :
              hoveredCell.value > -0.7 ? 'Moderate negative' : 'Strong negative'
            ) : ''}
          </span>
        </div>
      )}

      {/* Color Scale & Stats */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1a1a2e] bg-[#0f0f1e]">
        {/* Color Legend */}
        <div className="flex items-center gap-1">
          {dataType === 'correlation' ? (
            <>
              <span className="text-[9px] text-[#ff3333]">-1.0</span>
              <div className="flex h-2">
                {['bg-[#ff3333]', 'bg-[#ff3333]/70', 'bg-[#ff3333]/40', 'bg-[#ff3333]/20', 'bg-[#333]', 'bg-[#00cc66]/20', 'bg-[#00cc66]/40', 'bg-[#00cc66]/70', 'bg-[#00cc66]'].map((c, i) => (
                  <div key={i} className={`w-4 ${c}`} />
                ))}
              </div>
              <span className="text-[9px] text-[#00cc66]">+1.0</span>
            </>
          ) : (
            <>
              <span className="text-[9px] text-[#ff3333]">NEG</span>
              <div className="flex h-2">
                {['bg-[#ff3333]', 'bg-[#ff3333]/50', 'bg-[#ff3333]/20', 'bg-[#333]', 'bg-[#00cc66]/20', 'bg-[#00cc66]/50', 'bg-[#00cc66]'].map((c, i) => (
                  <div key={i} className={`w-5 ${c}`} />
                ))}
              </div>
              <span className="text-[9px] text-[#00cc66]">POS</span>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-[#555]">Mean: <span className="text-[#ccc]">{formatValue(stats.mean, dataType)}</span></span>
          <span className="text-[#555]">Med: <span className="text-[#ccc]">{formatValue(stats.median, dataType)}</span></span>
          <span className="text-[#555]">Min: <span className="text-[#ff3333]">{formatValue(stats.min, dataType)}</span></span>
          <span className="text-[#555]">Max: <span className="text-[#00cc66]">{formatValue(stats.max, dataType)}</span></span>
          <span className="text-[#555]">{tickers.length}×{tickers.length} • {stats.count} pairs</span>
        </div>
      </div>
    </div>
  );
}
