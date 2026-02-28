/**
 * EfficientFrontierChart.tsx
 * Efficient frontier visualization for portfolio optimization.
 * Plots the mean-variance frontier, individual assets, optimal portfolios,
 * capital market line, and current portfolio position with risk-return labels.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioPoint {
  return_pct: number;        // annualized return
  volatility_pct: number;    // annualized volatility
  sharpe?: number;
  label?: string;
  type?: 'frontier' | 'asset' | 'portfolio' | 'optimal' | 'cml' | 'current';
  color?: string;
  symbol?: string;
}

export interface EfficientFrontierChartProps {
  frontierPoints: PortfolioPoint[];         // efficient frontier curve
  assets?: PortfolioPoint[];                // individual assets
  portfolios?: PortfolioPoint[];            // user portfolios
  riskFreeRate?: number;                    // for CML
  currentPortfolio?: PortfolioPoint;        // highlight current
  showCML?: boolean;
  showAssetLabels?: boolean;
  showSharpeContours?: boolean;
  width?: number;
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  onPointClick?: (point: PortfolioPoint) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN = { top: 24, right: 24, bottom: 52, left: 60 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function linspace(start: number, end: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => start + ((end - start) * i) / (n - 1));
}

function niceTicks(min: number, max: number, count = 6): number[] {
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / count)));
  const roundedStep = [1, 2, 2.5, 5, 10].map(s => s * step).find(s => range / s <= count * 1.5) ?? step;
  const first = Math.ceil(min / roundedStep) * roundedStep;
  const ticks: number[] = [];
  for (let v = first; v <= max + roundedStep * 0.01; v += roundedStep) {
    ticks.push(parseFloat(v.toFixed(10)));
  }
  return ticks;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EfficientFrontierChart: React.FC<EfficientFrontierChartProps> = ({
  frontierPoints,
  assets = [],
  portfolios = [],
  riskFreeRate = 0.05,
  currentPortfolio,
  showCML = true,
  showAssetLabels = true,
  showSharpeContours = false,
  width = 680,
  height = 440,
  title,
  xLabel = 'Volatility / Risk (%)',
  yLabel = 'Expected Return (%)',
  onPointClick,
  className = '',
}) => {
  const [tooltip, setTooltip] = useState<{ point: PortfolioPoint; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  // All points for domain calculation
  const allPoints = useMemo(() => [
    ...frontierPoints,
    ...assets,
    ...portfolios,
    ...(currentPortfolio ? [currentPortfolio] : []),
  ], [frontierPoints, assets, portfolios, currentPortfolio]);

  const xDomain = useMemo(() => {
    const vols = allPoints.map(p => p.volatility_pct);
    const lo = Math.min(...vols);
    const hi = Math.max(...vols);
    const pad = (hi - lo) * 0.12;
    return [Math.max(0, lo - pad), hi + pad] as [number, number];
  }, [allPoints]);

  const yDomain = useMemo(() => {
    const rets = allPoints.map(p => p.return_pct);
    const lo = Math.min(...rets);
    const hi = Math.max(...rets);
    const pad = (hi - lo) * 0.12;
    return [lo - pad, hi + pad] as [number, number];
  }, [allPoints]);

  const xScale = useCallback((v: number) => {
    const [lo, hi] = xDomain;
    return MARGIN.left + ((v - lo) / (hi - lo)) * innerW;
  }, [xDomain, innerW]);

  const yScale = useCallback((v: number) => {
    const [lo, hi] = yDomain;
    return MARGIN.top + (1 - (v - lo) / (hi - lo)) * innerH;
  }, [yDomain, innerH]);

  const xTicks = useMemo(() => niceTicks(xDomain[0], xDomain[1]), [xDomain]);
  const yTicks = useMemo(() => niceTicks(yDomain[0], yDomain[1]), [yDomain]);

  // Frontier path
  const frontierPath = useMemo(() => {
    const sorted = [...frontierPoints].sort((a, b) => a.volatility_pct - b.volatility_pct);
    if (!sorted.length) return '';
    return sorted.map((p, i) => {
      const x = xScale(p.volatility_pct);
      const y = yScale(p.return_pct);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [frontierPoints, xScale, yScale]);

  // Fill below frontier (feasible region)
  const frontierFillPath = useMemo(() => {
    const sorted = [...frontierPoints].sort((a, b) => a.volatility_pct - b.volatility_pct);
    if (!sorted.length) return '';
    const pts = sorted.map(p => `${xScale(p.volatility_pct).toFixed(1)} ${yScale(p.return_pct).toFixed(1)}`);
    const first = pts[0];
    const last = pts[pts.length - 1];
    const [lx, _ly] = last.split(' ');
    const [fx, _fy] = first.split(' ');
    const bottom = yScale(yDomain[0]) + 2;
    return `M ${first} L ${pts.slice(1).join(' L ')} L ${lx} ${bottom} L ${fx} ${bottom} Z`;
  }, [frontierPoints, xScale, yScale, yDomain]);

  // CML line
  const cmlLine = useMemo(() => {
    if (!showCML || !frontierPoints.length) return null;
    // Max Sharpe portfolio (tangency)
    const tangency = frontierPoints.reduce((best, p) => {
      const sharpe = (p.return_pct - riskFreeRate) / p.volatility_pct;
      const bestSharpe = (best.return_pct - riskFreeRate) / best.volatility_pct;
      return sharpe > bestSharpe ? p : best;
    }, frontierPoints[0]);

    // CML: from (0, rfr) through tangency portfolio, extended to right edge
    const rfX = xScale(0);
    const rfY = yScale(riskFreeRate);
    const slope = (tangency.return_pct - riskFreeRate) / tangency.volatility_pct;
    const rightVol = xDomain[1];
    const rightRet = riskFreeRate + slope * rightVol;

    return {
      x1: rfX, y1: rfY,
      x2: xScale(rightVol), y2: yScale(rightRet),
      tangency,
    };
  }, [showCML, frontierPoints, riskFreeRate, xScale, yScale, xDomain]);

  // Sharpe contours
  const sharpeContours = useMemo(() => {
    if (!showSharpeContours) return [];
    const sharpeValues = [0.5, 1.0, 1.5, 2.0];
    return sharpeValues.map(sharpe => {
      const points = linspace(xDomain[0], xDomain[1], 40).map(vol => ({
        x: xScale(vol),
        y: yScale(riskFreeRate + sharpe * vol),
      }));
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return { sharpe, d };
    });
  }, [showSharpeContours, xDomain, xScale, yScale, riskFreeRate]);

  function linspace(start: number, end: number, n: number): number[] {
    return Array.from({ length: n }, (_, i) => start + ((end - start) * i) / (n - 1));
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if near a point
    const allPts = [...assets, ...portfolios, ...(currentPortfolio ? [currentPortfolio] : [])];
    const near = allPts.find(p => {
      const px = xScale(p.volatility_pct);
      const py = yScale(p.return_pct);
      return Math.hypot(mouseX - px, mouseY - py) < 14;
    });
    if (near) {
      setTooltip({ point: near, x: mouseX + 10, y: mouseY - 40 });
    } else {
      setTooltip(null);
    }
  }, [assets, portfolios, currentPortfolio, xScale, yScale]);

  return (
    <div className={`efficient-frontier ${className}`} style={{ position: 'relative' }}>
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
        onMouseLeave={() => setTooltip(null)}
        style={{ fontFamily: 'monospace' }}
      >
        {/* Grid */}
        {xTicks.map((tick, i) => (
          <line key={`gx${i}`} x1={xScale(tick)} y1={MARGIN.top} x2={xScale(tick)} y2={MARGIN.top + innerH} stroke="#1a2a38" strokeWidth={1} />
        ))}
        {yTicks.map((tick, i) => (
          <line key={`gy${i}`} x1={MARGIN.left} y1={yScale(tick)} x2={MARGIN.left + innerW} y2={yScale(tick)} stroke="#1a2a38" strokeWidth={1} />
        ))}

        {/* Feasible region fill */}
        <path d={frontierFillPath} fill="#4a9eff" fillOpacity={0.04} />

        {/* Sharpe contours */}
        {sharpeContours.map((c, i) => (
          <g key={i}>
            <path d={c.d} fill="none" stroke="#4a9eff" strokeWidth={0.6} strokeDasharray="4,4" opacity={0.3} />
            <text x={MARGIN.left + innerW - 30} y={yScale(riskFreeRate + c.sharpe * xDomain[1]) - 3} fill="#4a9eff" fontSize={8} opacity={0.5}>
              SR={c.sharpe}
            </text>
          </g>
        ))}

        {/* CML */}
        {cmlLine && (
          <g>
            <line
              x1={cmlLine.x1} y1={cmlLine.y1}
              x2={cmlLine.x2} y2={cmlLine.y2}
              stroke="#ffcc00" strokeWidth={1.2} strokeDasharray="8,4" opacity={0.6}
            />
            <text x={cmlLine.x2 - 60} y={cmlLine.y2 - 6} fill="#ffcc00" fontSize={9} opacity={0.8}>CML</text>
          </g>
        )}

        {/* Efficient frontier */}
        <path d={frontierPath} fill="none" stroke="#4a9eff" strokeWidth={2.5} />

        {/* Tangency portfolio */}
        {cmlLine?.tangency && (
          <g>
            <circle
              cx={xScale(cmlLine.tangency.volatility_pct)}
              cy={yScale(cmlLine.tangency.return_pct)}
              r={7}
              fill="none"
              stroke="#ffcc00"
              strokeWidth={2}
            />
            <text
              x={xScale(cmlLine.tangency.volatility_pct) + 10}
              y={yScale(cmlLine.tangency.return_pct) + 4}
              fill="#ffcc00"
              fontSize={9}
            >
              Max Sharpe
            </text>
          </g>
        )}

        {/* Asset points */}
        {assets.map((asset, i) => {
          const ax = xScale(asset.volatility_pct);
          const ay = yScale(asset.return_pct);
          const col = asset.color ?? '#888';
          return (
            <g key={i} style={{ cursor: onPointClick ? 'pointer' : 'default' }} onClick={() => onPointClick?.(asset)}>
              <circle cx={ax} cy={ay} r={5} fill={col} stroke="#0a1628" strokeWidth={1.5} />
              {showAssetLabels && asset.symbol && (
                <text x={ax + 7} y={ay + 4} fill={col} fontSize={9}>{asset.symbol}</text>
              )}
            </g>
          );
        })}

        {/* User portfolios */}
        {portfolios.map((p, i) => {
          const px = xScale(p.volatility_pct);
          const py = yScale(p.return_pct);
          return (
            <g key={i} style={{ cursor: onPointClick ? 'pointer' : 'default' }} onClick={() => onPointClick?.(p)}>
              <rect x={px - 5} y={py - 5} width={10} height={10} fill={p.color ?? '#00d4aa'} stroke="#0a1628" strokeWidth={1.5} rx={1} />
              {p.label && <text x={px + 8} y={py + 4} fill={p.color ?? '#00d4aa'} fontSize={9}>{p.label}</text>}
            </g>
          );
        })}

        {/* Current portfolio */}
        {currentPortfolio && (
          <g>
            <circle
              cx={xScale(currentPortfolio.volatility_pct)}
              cy={yScale(currentPortfolio.return_pct)}
              r={9}
              fill="none"
              stroke="#ff9900"
              strokeWidth={2.5}
            />
            <circle
              cx={xScale(currentPortfolio.volatility_pct)}
              cy={yScale(currentPortfolio.return_pct)}
              r={4}
              fill="#ff9900"
            />
            <text
              x={xScale(currentPortfolio.volatility_pct) + 13}
              y={yScale(currentPortfolio.return_pct) + 4}
              fill="#ff9900"
              fontSize={10}
              fontWeight="bold"
            >
              Current
            </text>
          </g>
        )}

        {/* Risk-free rate marker */}
        <circle cx={xScale(0)} cy={yScale(riskFreeRate)} r={4} fill="#888" />
        <text x={xScale(0) + 6} y={yScale(riskFreeRate) + 4} fill="#666" fontSize={8}>Rf={riskFreeRate.toFixed(1)}%</text>

        {/* X Axis */}
        <line x1={MARGIN.left} y1={MARGIN.top + innerH} x2={MARGIN.left + innerW} y2={MARGIN.top + innerH} stroke="#2a3a4a" />
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={xScale(t)} y1={MARGIN.top + innerH} x2={xScale(t)} y2={MARGIN.top + innerH + 4} stroke="#2a3a4a" />
            <text x={xScale(t)} y={MARGIN.top + innerH + 14} textAnchor="middle" fill="#666" fontSize={9}>{t.toFixed(1)}%</text>
          </g>
        ))}
        <text x={MARGIN.left + innerW / 2} y={height - 10} textAnchor="middle" fill="#555" fontSize={10}>{xLabel}</text>

        {/* Y Axis */}
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + innerH} stroke="#2a3a4a" />
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={MARGIN.left} y1={yScale(t)} x2={MARGIN.left - 4} y2={yScale(t)} stroke="#2a3a4a" />
            <text x={MARGIN.left - 8} y={yScale(t) + 4} textAnchor="end" fill="#666" fontSize={9}>{t.toFixed(1)}%</text>
          </g>
        ))}
        <text
          x={14}
          y={MARGIN.top + innerH / 2}
          textAnchor="middle"
          fill="#555"
          fontSize={10}
          transform={`rotate(-90, 14, ${MARGIN.top + innerH / 2})`}
        >
          {yLabel}
        </text>
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
            fontFamily: 'monospace',
          }}
        >
          {tooltip.point.label && <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{tooltip.point.label}</div>}
          {tooltip.point.symbol && <div style={{ color: '#4a9eff' }}>{tooltip.point.symbol}</div>}
          <div>Vol: <b>{tooltip.point.volatility_pct.toFixed(2)}%</b></div>
          <div>Ret: <b>{tooltip.point.return_pct.toFixed(2)}%</b></div>
          {tooltip.point.sharpe !== undefined && (
            <div>Sharpe: <b style={{ color: tooltip.point.sharpe > 1 ? '#00d4aa' : '#ffcc00' }}>
              {tooltip.point.sharpe.toFixed(2)}
            </b></div>
          )}
        </div>
      )}
    </div>
  );
};

export default EfficientFrontierChart;
