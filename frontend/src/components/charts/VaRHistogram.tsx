/**
 * VaRHistogram.tsx
 * Loss distribution histogram with VaR and CVaR cut-off lines.
 * Includes tail shading, normal distribution overlay, scenario markers,
 * statistical summary panel, and interactive bin hover tooltip.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistogramBin {
  lo: number;    // lower bound of bin (return %)
  hi: number;    // upper bound
  count: number;
  freq?: number; // fraction of total
}

export interface ScenarioMarker {
  value: number;
  label: string;
  color?: string;
}

export interface VaRHistogramProps {
  returns?: number[];          // raw returns — histogram computed from these
  bins?: HistogramBin[];       // OR pre-computed bins
  var95?: number;              // VaR at 95% confidence (negative number, e.g. -0.02)
  var99?: number;              // VaR at 99%
  cvar95?: number;             // CVaR / ES at 95%
  cvar99?: number;             // CVaR / ES at 99%
  scenarios?: ScenarioMarker[];
  showNormalOverlay?: boolean;
  showKernelDensity?: boolean;
  numBins?: number;
  width?: number;
  height?: number;
  title?: string;
  className?: string;
}

// ─── Histogram Builder ────────────────────────────────────────────────────────

function buildHistogram(returns: number[], numBins: number): HistogramBin[] {
  if (!returns.length) return [];
  const lo = Math.min(...returns);
  const hi = Math.max(...returns);
  const binWidth = (hi - lo) / numBins;
  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => ({
    lo: lo + i * binWidth,
    hi: lo + (i + 1) * binWidth,
    count: 0,
    freq: 0,
  }));
  returns.forEach(r => {
    const idx = Math.min(Math.floor((r - lo) / binWidth), numBins - 1);
    bins[idx].count++;
  });
  const total = returns.length;
  bins.forEach(b => { b.freq = b.count / total; });
  return bins;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function computeStats(returns: number[]) {
  const n = returns.length;
  if (!n) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const stddev = Math.sqrt(variance);
  const skew = returns.reduce((s, r) => s + ((r - mean) / stddev) ** 3, 0) / n;
  const kurt = returns.reduce((s, r) => s + ((r - mean) / stddev) ** 4, 0) / n - 3;
  const q = (p: number) => {
    const pos = p * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  return { mean, stddev, skew, kurt, min: sorted[0], max: sorted[n - 1], q5: q(0.05), q1: q(0.01) };
}

// ─── Normal PDF ───────────────────────────────────────────────────────────────

function normalPDF(x: number, mean: number, stddev: number): number {
  return Math.exp(-0.5 * ((x - mean) / stddev) ** 2) / (stddev * Math.sqrt(2 * Math.PI));
}

// ─── Component ────────────────────────────────────────────────────────────────

const MARGIN = { top: 20, right: 24, bottom: 52, left: 52 };

export const VaRHistogram: React.FC<VaRHistogramProps> = ({
  returns: rawReturns = [],
  bins: propBins,
  var95,
  var99,
  cvar95,
  cvar99,
  scenarios = [],
  showNormalOverlay = true,
  showKernelDensity = false,
  numBins = 50,
  width = 680,
  height = 360,
  title,
  className = '',
}) => {
  const [hoveredBin, setHoveredBin] = useState<HistogramBin | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const bins = useMemo(() =>
    propBins ?? buildHistogram(rawReturns, numBins),
    [propBins, rawReturns, numBins]
  );

  const stats = useMemo(() => computeStats(rawReturns), [rawReturns]);

  const xDomain = useMemo(() => {
    if (!bins.length) return [-0.1, 0.1] as [number, number];
    const lo = Math.min(...bins.map(b => b.lo));
    const hi = Math.max(...bins.map(b => b.hi));
    return [lo, hi] as [number, number];
  }, [bins]);

  const maxFreq = useMemo(() =>
    Math.max(...bins.map(b => b.freq ?? 0), 0.001),
    [bins]
  );

  const xScale = (v: number) => MARGIN.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerW;
  const yScale = (f: number) => MARGIN.top + (1 - f / maxFreq) * innerH;

  function niceTicks(lo: number, hi: number, count = 8): number[] {
    const range = hi - lo;
    const raw = range / count;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(s => s * pow).find(s => range / s <= count + 1) ?? pow;
    const first = Math.ceil(lo / step) * step;
    const ticks: number[] = [];
    for (let v = first; v <= hi + step * 0.01; v += step) ticks.push(parseFloat(v.toFixed(10)));
    return ticks;
  }

  const xTicks = useMemo(() => niceTicks(xDomain[0], xDomain[1]), [xDomain]);

  // Normal overlay path
  const normalPath = useMemo(() => {
    if (!showNormalOverlay || !stats) return '';
    const pts: string[] = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const x = xDomain[0] + (i / steps) * (xDomain[1] - xDomain[0]);
      const pdf = normalPDF(x, stats.mean, stats.stddev);
      // Scale to match histogram freq density
      const binWidth = bins.length ? (bins[0].hi - bins[0].lo) : 1;
      const scaledY = pdf * binWidth / maxFreq;
      const sx = xScale(x);
      const sy = MARGIN.top + (1 - scaledY) * innerH;
      pts.push(`${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [showNormalOverlay, stats, xDomain, bins, maxFreq, innerH]);

  const binWidth = bins.length > 1 ? xScale(bins[0].hi) - xScale(bins[0].lo) : 10;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const xVal = xDomain[0] + ((mx - MARGIN.left) / innerW) * (xDomain[1] - xDomain[0]);
    const hov = bins.find(b => xVal >= b.lo && xVal < b.hi) ?? null;
    setHoveredBin(hov);
  }, [bins, xDomain, innerW]);

  // VaR / CVaR line positions
  const varLines = [
    var95 != null ? { x: xScale(var95), label: `VaR 95%: ${(var95 * 100).toFixed(2)}%`, color: '#ff9900', dash: '6,3' } : null,
    var99 != null ? { x: xScale(var99), label: `VaR 99%: ${(var99 * 100).toFixed(2)}%`, color: '#ff4444', dash: '3,3' } : null,
    cvar95 != null ? { x: xScale(cvar95), label: `CVaR 95%: ${(cvar95 * 100).toFixed(2)}%`, color: '#ff6600', dash: '8,4' } : null,
    cvar99 != null ? { x: xScale(cvar99), label: `CVaR 99%: ${(cvar99 * 100).toFixed(2)}%`, color: '#cc0000', dash: '4,4' } : null,
  ].filter(Boolean);

  return (
    <div className={`var-histogram ${className}`} style={{ position: 'relative' }}>
      {title && (
        <div style={{ color: '#ccc', fontSize: 13, fontWeight: 'bold', marginBottom: 8, fontFamily: 'monospace' }}>
          {title}
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredBin(null)}
        style={{ fontFamily: 'monospace' }}
      >
        {/* Tail shading (VaR zones) */}
        {var99 != null && (
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={Math.max(0, xScale(var99) - MARGIN.left)}
            height={innerH}
            fill="#cc0000"
            fillOpacity={0.08}
          />
        )}
        {var95 != null && var99 != null && (
          <rect
            x={xScale(var99)}
            y={MARGIN.top}
            width={Math.max(0, xScale(var95) - xScale(var99))}
            height={innerH}
            fill="#ff9900"
            fillOpacity={0.06}
          />
        )}

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map((frac, i) => (
          <line
            key={i}
            x1={MARGIN.left}
            y1={MARGIN.top + (1 - frac) * innerH}
            x2={MARGIN.left + innerW}
            y2={MARGIN.top + (1 - frac) * innerH}
            stroke="#1a2a38"
            strokeWidth={1}
          />
        ))}
        {xTicks.map((t, i) => (
          <line key={i} x1={xScale(t)} y1={MARGIN.top} x2={xScale(t)} y2={MARGIN.top + innerH} stroke="#1a2a38" strokeWidth={0.6} />
        ))}

        {/* Histogram bars */}
        {bins.map((bin, i) => {
          const isTailLoss = (var99 != null && bin.hi <= var99) ? 'dark' :
                             (var95 != null && bin.hi <= var95) ? 'moderate' : 'normal';
          const fillColor = isTailLoss === 'dark' ? '#cc2222' :
                            isTailLoss === 'moderate' ? '#dd6600' :
                            (bin.lo >= 0 ? '#00aa66' : '#4a9eff');
          const isHovered = hoveredBin === bin;
          return (
            <rect
              key={i}
              x={xScale(bin.lo) + 0.5}
              y={yScale(bin.freq ?? 0)}
              width={Math.max(0.5, binWidth - 1)}
              height={MARGIN.top + innerH - yScale(bin.freq ?? 0)}
              fill={fillColor}
              fillOpacity={isHovered ? 1 : 0.8}
              stroke={isHovered ? '#fff' : 'none'}
              strokeWidth={isHovered ? 0.8 : 0}
            />
          );
        })}

        {/* Zero return line */}
        <line x1={xScale(0)} y1={MARGIN.top} x2={xScale(0)} y2={MARGIN.top + innerH} stroke="#3a4a5a" strokeWidth={1} />

        {/* Normal overlay */}
        {normalPath && (
          <path d={normalPath} fill="none" stroke="#4a9eff" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6} />
        )}

        {/* VaR / CVaR lines */}
        {varLines.map((line, i) => line && (
          <g key={i}>
            <line
              x1={line.x} y1={MARGIN.top}
              x2={line.x} y2={MARGIN.top + innerH}
              stroke={line.color} strokeWidth={1.8} strokeDasharray={line.dash}
            />
            <text
              x={line.x - 3}
              y={MARGIN.top + 12 + i * 14}
              textAnchor="end"
              fill={line.color}
              fontSize={8}
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* Scenario markers */}
        {scenarios.map((s, i) => (
          <g key={i}>
            <line
              x1={xScale(s.value)} y1={MARGIN.top}
              x2={xScale(s.value)} y2={MARGIN.top + innerH}
              stroke={s.color ?? '#888'} strokeWidth={1.2} strokeDasharray="2,2"
            />
            <text x={xScale(s.value) + 3} y={MARGIN.top + 22 + i * 12} fill={s.color ?? '#888'} fontSize={8}>{s.label}</text>
          </g>
        ))}

        {/* X Axis */}
        <line x1={MARGIN.left} y1={MARGIN.top + innerH} x2={MARGIN.left + innerW} y2={MARGIN.top + innerH} stroke="#2a3a4a" />
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={xScale(t)} y1={MARGIN.top + innerH} x2={xScale(t)} y2={MARGIN.top + innerH + 4} stroke="#2a3a4a" />
            <text x={xScale(t)} y={MARGIN.top + innerH + 14} textAnchor="middle" fill="#555" fontSize={8.5}>
              {(t * 100).toFixed(1)}%
            </text>
          </g>
        ))}
        <text x={MARGIN.left + innerW / 2} y={height - 8} textAnchor="middle" fill="#444" fontSize={10}>Daily Return (%)</text>

        {/* Y Axis */}
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + innerH} stroke="#2a3a4a" />
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => (
          <g key={i}>
            <text x={MARGIN.left - 5} y={MARGIN.top + (1 - frac) * innerH + 3} textAnchor="end" fill="#555" fontSize={8}>
              {(frac * maxFreq * 100).toFixed(1)}%
            </text>
          </g>
        ))}
        <text x={12} y={MARGIN.top + innerH / 2} textAnchor="middle" fill="#444" fontSize={9} transform={`rotate(-90,12,${MARGIN.top + innerH / 2})`}>Frequency</text>
      </svg>

      {/* Stats Panel */}
      {stats && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8,
          fontSize: 10, fontFamily: 'monospace', color: '#888',
        }}>
          {[
            { label: 'Mean', value: (stats.mean * 100).toFixed(3) + '%', color: stats.mean >= 0 ? '#00d4aa' : '#ff4466' },
            { label: 'Std Dev', value: (stats.stddev * 100).toFixed(3) + '%', color: '#aaa' },
            { label: 'Skewness', value: stats.skew.toFixed(3), color: stats.skew < -0.5 ? '#ff9900' : '#aaa' },
            { label: 'Kurtosis', value: stats.kurt.toFixed(3), color: stats.kurt > 2 ? '#ff4466' : '#aaa' },
            { label: 'Min', value: (stats.min * 100).toFixed(2) + '%', color: '#ff4466' },
            { label: 'Max', value: (stats.max * 100).toFixed(2) + '%', color: '#00d4aa' },
          ].map((s, i) => (
            <div key={i}>
              <span style={{ color: '#555' }}>{s.label}: </span>
              <span style={{ color: s.color, fontWeight: 'bold' }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bin Tooltip */}
      {hoveredBin && (
        <div
          style={{
            position: 'absolute',
            left: mousePos.x + 10,
            top: mousePos.y - 50,
            background: '#0e1c2e',
            border: '1px solid #3a4a5a',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 10,
            color: '#ddd',
            pointerEvents: 'none',
            fontFamily: 'monospace',
          }}
        >
          <div>Range: [{(hoveredBin.lo * 100).toFixed(2)}%, {(hoveredBin.hi * 100).toFixed(2)}%]</div>
          <div>Count: <b>{hoveredBin.count}</b></div>
          {hoveredBin.freq !== undefined && (
            <div>Frequency: <b>{(hoveredBin.freq * 100).toFixed(2)}%</b></div>
          )}
        </div>
      )}
    </div>
  );
};

export default VaRHistogram;
