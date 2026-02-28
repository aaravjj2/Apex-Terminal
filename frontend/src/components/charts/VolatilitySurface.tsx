/**
 * VolatilitySurface.tsx
 * Implied volatility surface visualization (3D isometric projection in SVG).
 * Shows IV as a function of strike and expiry, with color gradient from low to
 * high vol, interactive hover, smile/skew cross-sections, and term structure panel.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VolPoint {
  strike: number;       // absolute or moneyness (e.g. 0.9 to 1.1)
  expiry_days: number;  // days to expiration
  iv: number;           // implied volatility (decimal, e.g. 0.25 = 25%)
  option_type?: 'call' | 'put' | 'combined';
}

export interface VolatilitySurfaceProps {
  points: VolPoint[];
  spotPrice?: number;             // for moneyness labeling
  currentIV?: number;             // ATM vol for reference
  showSmile?: boolean;            // show vol smile overlay
  showTermStructure?: boolean;    // show term structure panel
  colorLow?: string;
  colorHigh?: string;
  width?: number;
  height?: number;
  title?: string;
  className?: string;
}

// ─── Color ────────────────────────────────────────────────────────────────────

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

// ─── Isometric Projection ─────────────────────────────────────────────────────

interface IsoOptions {
  scaleX: number; scaleY: number; scaleZ: number;
  originX: number; originY: number;
  tiltX: number; tiltY: number;
}

function isoProject(x: number, y: number, z: number, opts: IsoOptions): { px: number; py: number } {
  // Simple isometric: x → right-down, y → left-down, z → up
  const { scaleX, scaleY, scaleZ, originX, originY, tiltX, tiltY } = opts;
  const px = originX + (x * tiltX - y * tiltY) * scaleX;
  const py = originY - z * scaleZ + (x * tiltX + y * tiltY) * scaleY * 0.4;
  return { px, py };
}

// ─── Surface Grid Builder ─────────────────────────────────────────────────────

function buildGrid(points: VolPoint[]): {
  strikes: number[];
  expiries: number[];
  grid: Map<string, number>;
  minIV: number;
  maxIV: number;
} {
  const strikesSet = new Set<number>();
  const expiriesSet = new Set<number>();
  const grid = new Map<string, number>();

  points.forEach(p => {
    strikesSet.add(p.strike);
    expiriesSet.add(p.expiry_days);
    grid.set(`${p.strike}_${p.expiry_days}`, p.iv);
  });

  const strikes = [...strikesSet].sort((a, b) => a - b);
  const expiries = [...expiriesSet].sort((a, b) => a - b);
  const ivValues = points.map(p => p.iv);
  const minIV = Math.min(...ivValues);
  const maxIV = Math.max(...ivValues);

  return { strikes, expiries, grid, minIV, maxIV };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const VolatilitySurface: React.FC<VolatilitySurfaceProps> = ({
  points,
  spotPrice,
  currentIV,
  showSmile = true,
  showTermStructure = true,
  colorLow = '#1144aa',
  colorHigh = '#ff4422',
  width = 680,
  height = 420,
  title,
  className = '',
}) => {
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; strike: number; expiry: number; iv: number } | null>(null);
  const [highlightExpiry, setHighlightExpiry] = useState<number | null>(null);
  const [view, setView] = useState<'surface' | 'smile' | 'term'>('surface');

  const { strikes, expiries, grid, minIV, maxIV } = useMemo(() => buildGrid(points), [points]);

  const ivRange = maxIV - minIV || 0.01;
  const ivColor = (iv: number) => toHex(lerpRGB(parseHex(colorLow), parseHex(colorHigh), (iv - minIV) / ivRange));

  // Isometric options
  const isoOpts: IsoOptions = {
    scaleX: 1,
    scaleY: 1,
    scaleZ: (height * 0.45) / ivRange,
    originX: width * 0.36,
    originY: height * 0.78,
    tiltX: (width * 0.38) / (strikes.length || 1),
    tiltY: (width * 0.28) / (expiries.length || 1),
  };

  // Build surface quads
  const quads = useMemo(() => {
    const qs: Array<{ x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; x4: number; y4: number; iv: number; color: string }> = [];
    for (let ei = 0; ei < expiries.length - 1; ei++) {
      for (let si = 0; si < strikes.length - 1; si++) {
        const iv00 = grid.get(`${strikes[si]}_${expiries[ei]}`) ?? minIV;
        const iv10 = grid.get(`${strikes[si + 1]}_${expiries[ei]}`) ?? minIV;
        const iv11 = grid.get(`${strikes[si + 1]}_${expiries[ei + 1]}`) ?? minIV;
        const iv01 = grid.get(`${strikes[si]}_${expiries[ei + 1]}`) ?? minIV;
        const avgIV = (iv00 + iv10 + iv11 + iv01) / 4;
        const p00 = isoProject(si, ei, iv00 - minIV, isoOpts);
        const p10 = isoProject(si + 1, ei, iv10 - minIV, isoOpts);
        const p11 = isoProject(si + 1, ei + 1, iv11 - minIV, isoOpts);
        const p01 = isoProject(si, ei + 1, iv01 - minIV, isoOpts);
        qs.push({
          x1: p00.px, y1: p00.py,
          x2: p10.px, y2: p10.py,
          x3: p11.px, y3: p11.py,
          x4: p01.px, y4: p01.py,
          iv: avgIV,
          color: ivColor(avgIV),
        });
      }
    }
    return qs;
  }, [strikes, expiries, grid, minIV, isoOpts, ivColor]);

  // Smile chart (for a single expiry)
  const smileData = useMemo(() => {
    const expiry = highlightExpiry ?? expiries[Math.floor(expiries.length / 2)];
    return strikes.map(k => ({ strike: k, iv: grid.get(`${k}_${expiry}`) ?? null }));
  }, [strikes, expiries, highlightExpiry, grid]);

  // Term structure (ATM or nearest-to-ATM)
  const termData = useMemo(() => {
    const atmStrike = spotPrice ? strikes.reduce((a, b) => Math.abs(a - spotPrice) < Math.abs(b - spotPrice) ? a : b) : strikes[Math.floor(strikes.length / 2)];
    return expiries.map(e => ({ expiry: e, iv: grid.get(`${atmStrike}_${e}`) ?? null }));
  }, [expiries, strikes, grid, spotPrice]);

  const smileML = 36, smileMR = 16, smileMT = 16, smileMB = 32;
  const smileW = 260, smileH = 140;
  const smileInnerW = smileW - smileML - smileMR;
  const smileInnerH = smileH - smileMT - smileMB;

  const smileXDomain = strikes.length ? [strikes[0], strikes[strikes.length - 1]] : [0.8, 1.2];
  const smileYDomain = [minIV * 0.95, maxIV * 1.05];

  const smileXScale = (k: number) => smileML + ((k - smileXDomain[0]) / (smileXDomain[1] - smileXDomain[0])) * smileInnerW;
  const smileYScale = (v: number) => smileMT + (1 - (v - smileYDomain[0]) / (smileYDomain[1] - smileYDomain[0])) * smileInnerH;

  const smilePath = smileData
    .filter(d => d.iv != null)
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${smileXScale(d.strike).toFixed(1)} ${smileYScale(d.iv!).toFixed(1)}`)
    .join(' ');

  const termXDomain = expiries.length ? [expiries[0], expiries[expiries.length - 1]] : [0, 365];
  const termXScale = (e: number) => smileML + ((e - termXDomain[0]) / (termXDomain[1] - termXDomain[0])) * smileInnerW;
  const termYDomain = smileYDomain;
  const termYScale = smileYScale;
  const termPath = termData
    .filter(d => d.iv != null)
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${termXScale(d.expiry).toFixed(1)} ${termYScale(d.iv!).toFixed(1)}`)
    .join(' ');

  return (
    <div className={`volatility-surface ${className}`} style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {title && <span style={{ color: '#ccc', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' }}>{title}</span>}
        {currentIV != null && (
          <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
            ATM IV: <b style={{ color: '#4a9eff' }}>{(currentIV * 100).toFixed(1)}%</b>
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['surface', 'smile', 'term'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '2px 8px', background: view === v ? '#4a9eff' : '#1a2a38',
                border: '1px solid #2a3a4a', borderRadius: 3,
                color: view === v ? '#000' : '#888', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace',
              }}
            >
              {v === 'surface' ? '3D Surface' : v === 'smile' ? 'Vol Smile' : 'Term Structure'}
            </button>
          ))}
        </div>
      </div>

      {/* Main SVG */}
      {view === 'surface' && (
        <svg width={width} height={height} style={{ fontFamily: 'monospace', background: '#060e18', borderRadius: 4 }}>
          {/* Gradient legend */}
          <defs>
            <linearGradient id="ivGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colorLow} />
              <stop offset="100%" stopColor={colorHigh} />
            </linearGradient>
          </defs>
          <rect x={width - 100} y={12} width={80} height={10} fill="url(#ivGradient)" rx={2} />
          <text x={width - 104} y={21} textAnchor="end" fill="#555" fontSize={8}>{(minIV * 100).toFixed(0)}%</text>
          <text x={width - 16} y={21} textAnchor="start" fill="#555" fontSize={8}>{(maxIV * 100).toFixed(0)}%</text>
          <text x={width - 60} y={36} textAnchor="middle" fill="#444" fontSize={8}>IV</text>

          {/* Surface quads (back to front for painter's algorithm) */}
          {quads.map((q, i) => (
            <polygon
              key={i}
              points={`${q.x1},${q.y1} ${q.x2},${q.y2} ${q.x3},${q.y3} ${q.x4},${q.y4}`}
              fill={q.color}
              fillOpacity={0.85}
              stroke="#060e18"
              strokeWidth={0.4}
            />
          ))}

          {/* Axis labels */}
          {/* Strike axis */}
          {strikes.filter((_, i) => i % Math.max(1, Math.floor(strikes.length / 5)) === 0).map((k, i) => {
            const idx = strikes.indexOf(k);
            const p = isoProject(idx, 0, 0, isoOpts);
            const text = spotPrice ? `${(k / spotPrice * 100 - 100).toFixed(0)}%` : k.toFixed(2);
            return (
              <text key={i} x={p.px} y={p.py + 14} textAnchor="middle" fill="#555" fontSize={7}>{text}</text>
            );
          })}

          {/* Expiry axis */}
          {expiries.filter((_, i) => i % Math.max(1, Math.floor(expiries.length / 5)) === 0).map((e, i) => {
            const idx = expiries.indexOf(e);
            const p = isoProject(0, idx, 0, isoOpts);
            return (
              <text key={i} x={p.px - 10} y={p.py + 5} textAnchor="end" fill="#555" fontSize={7}>{e}d</text>
            );
          })}

          {/* IV Z axis */}
          {[0.1, 0.2, 0.3, 0.4, 0.5].filter(v => v >= minIV * 0.98 && v <= maxIV * 1.02).map((v, i) => {
            const p = isoProject(0, 0, v - minIV, isoOpts);
            return (
              <text key={i} x={p.px - 6} y={p.py + 3} textAnchor="end" fill="#444" fontSize={7}>{(v * 100).toFixed(0)}%</text>
            );
          })}

          <text x={width / 2} y={height - 4} textAnchor="middle" fill="#333" fontSize={9}>Strike / Moneyness</text>
        </svg>
      )}

      {/* Vol Smile */}
      {view === 'smile' && (
        <div>
          <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace', marginBottom: 6 }}>
            Expiry:
            {expiries.map(e => (
              <button key={e} onClick={() => setHighlightExpiry(e)}
                style={{
                  marginLeft: 4, padding: '1px 6px',
                  background: highlightExpiry === e ? '#4a9eff' : '#1a2a38',
                  border: '1px solid #2a3a4a', borderRadius: 3,
                  color: highlightExpiry === e ? '#000' : '#888', cursor: 'pointer', fontSize: 9, fontFamily: 'monospace',
                }}
              >{e}d</button>
            ))}
          </div>
          <svg width={smileW} height={smileH} style={{ fontFamily: 'monospace' }}>
            <line x1={smileML} y1={smileMT} x2={smileML} y2={smileMT + smileInnerH} stroke="#2a3a4a" />
            <line x1={smileML} y1={smileMT + smileInnerH} x2={smileML + smileInnerW} y2={smileMT + smileInnerH} stroke="#2a3a4a" />
            <path d={smilePath} fill="none" stroke="#4a9eff" strokeWidth={2} />
            {smileData.filter(d => d.iv != null).map((d, i) => (
              <circle key={i} cx={smileXScale(d.strike)} cy={smileYScale(d.iv!)} r={3} fill="#4a9eff" />
            ))}
            <text x={smileML + smileInnerW / 2} y={smileH - 4} textAnchor="middle" fill="#444" fontSize={9}>Strike</text>
            <text x={8} y={smileMT + smileInnerH / 2} textAnchor="middle" fill="#444" fontSize={9}
              transform={`rotate(-90, 8, ${smileMT + smileInnerH / 2})`}>IV</text>
          </svg>
        </div>
      )}

      {/* Term Structure */}
      {view === 'term' && (
        <svg width={smileW} height={smileH} style={{ fontFamily: 'monospace' }}>
          <line x1={smileML} y1={smileMT} x2={smileML} y2={smileMT + smileInnerH} stroke="#2a3a4a" />
          <line x1={smileML} y1={smileMT + smileInnerH} x2={smileML + smileInnerW} y2={smileMT + smileInnerH} stroke="#2a3a4a" />
          {currentIV != null && (
            <line x1={smileML} y1={termYScale(currentIV)} x2={smileML + smileInnerW} y2={termYScale(currentIV)} stroke="#ffcc00" strokeWidth={1} strokeDasharray="4,3" />
          )}
          <path d={termPath} fill="none" stroke="#00d4aa" strokeWidth={2} />
          {termData.filter(d => d.iv != null).map((d, i) => (
            <circle key={i} cx={termXScale(d.expiry)} cy={termYScale(d.iv!)} r={3} fill="#00d4aa" />
          ))}
          <text x={smileML + smileInnerW / 2} y={smileH - 4} textAnchor="middle" fill="#444" fontSize={9}>Days to Expiry</text>
          <text x={8} y={smileMT + smileInnerH / 2} textAnchor="middle" fill="#444" fontSize={9}
            transform={`rotate(-90, 8, ${smileMT + smileInnerH / 2})`}>ATM IV</text>
        </svg>
      )}
    </div>
  );
};

export default VolatilitySurface;
