/**
 * BloombergGauge.tsx
 * Full gauge component library for Apex Terminal's Bloomberg-style UI.
 * Includes arc gauge (donut style), linear gauge (horizontal bar),
 * speed gauge (half-circle), radial meter (needle), and thermometer gauge.
 */

import React, { useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GaugeColorStop = { value: number; color: string };

export interface ArcGaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  sublabel?: string;
  colorStops?: GaugeColorStop[];
  thickness?: number;
  radius?: number;
  showValue?: boolean;
  valueFormatter?: (v: number) => string;
  className?: string;
  animateDuration?: number;
}

export interface LinearGaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  colorStops?: GaugeColorStop[];
  height?: number;
  showTicks?: boolean;
  tickCount?: number;
  valueFormatter?: (v: number) => string;
  thresholds?: Array<{ value: number; label: string; color: string }>;
  className?: string;
}

export interface SpeedGaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  bands?: Array<{ from: number; to: number; color: string; label?: string }>;
  radius?: number;
  showNeedle?: boolean;
  valueFormatter?: (v: number) => string;
  className?: string;
}

export interface RadialMeterProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  color?: string;
  radius?: number;
  valueFormatter?: (v: number) => string;
  className?: string;
}

export interface ThermometerProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  height?: number;
  colorStops?: GaugeColorStop[];
  className?: string;
}

export interface MultiArcGaugeProps {
  segments: Array<{ label: string; value: number; color: string; max?: number }>;
  radius?: number;
  thickness?: number;
  gapDeg?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  className?: string;
}

export interface BulletGaugeProps {
  actual: number;
  target: number;
  min?: number;
  max?: number;
  label?: string;
  ranges?: Array<{ from: number; to: number; color: string }>;
  height?: number;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pct(value: number, min: number, max: number): number {
  return (clamp(value, min, max) - min) / (max - min);
}

function interpolateColor(value: number, stops: GaugeColorStop[]): string {
  if (!stops.length) return '#888';
  if (stops.length === 1) return stops[0].color;
  const sorted = [...stops].sort((a, b) => a.value - b.value);
  if (value <= sorted[0].value) return sorted[0].color;
  if (value >= sorted[sorted.length - 1].value) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (value >= sorted[i].value && value <= sorted[i + 1].value) {
      // Simple linear: pick nearest
      const mid = (sorted[i].value + sorted[i + 1].value) / 2;
      return value < mid ? sorted[i].color : sorted[i + 1].color;
    }
  }
  return sorted[sorted.length - 1].color;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (Math.abs(endDeg - startDeg) >= 360) {
    return [
      `M ${cx - r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
    ].join(' ');
  }
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

const DEFAULT_COLOR_STOPS: GaugeColorStop[] = [
  { value: 0, color: '#ff4444' },
  { value: 30, color: '#ff9900' },
  { value: 60, color: '#ffcc00' },
  { value: 80, color: '#00d4aa' },
  { value: 100, color: '#00ff9d' },
];

// ─── Arc Gauge ────────────────────────────────────────────────────────────────

export const ArcGauge: React.FC<ArcGaugeProps> = ({
  value,
  min = 0,
  max = 100,
  label,
  sublabel,
  colorStops = DEFAULT_COLOR_STOPS,
  thickness = 12,
  radius = 52,
  showValue = true,
  valueFormatter = (v) => v.toFixed(1),
  className = '',
}) => {
  const size = (radius + thickness) * 2 + 8;
  const cx = size / 2;
  const cy = size / 2;
  const p = pct(value, min, max);
  const startDeg = -220;
  const totalDeg = 260;
  const fillDeg = startDeg + totalDeg * p;
  const trackPath = arcPath(cx, cy, radius, startDeg, startDeg + totalDeg);
  const fillPath = arcPath(cx, cy, radius, startDeg, fillDeg);
  const color = interpolateColor(value, colorStops);

  return (
    <div className={`bloomberg-gauge bloomberg-gauge--arc ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="bloomberg-gauge__svg">
        {/* Track */}
        <path d={trackPath} fill="none" stroke="#2a3a4a" strokeWidth={thickness} strokeLinecap="round" />
        {/* Fill */}
        {p > 0 && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" />
        )}
        {/* Center text */}
        {showValue && (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={18} fontWeight="bold" fontFamily="monospace">
              {valueFormatter(value)}
            </text>
            {label && (
              <text x={cx} y={cy + 14} textAnchor="middle" fill="#aaa" fontSize={10} fontFamily="monospace">
                {label}
              </text>
            )}
            {sublabel && (
              <text x={cx} y={cy + 26} textAnchor="middle" fill="#666" fontSize={9} fontFamily="monospace">
                {sublabel}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
};

// ─── Linear Gauge ─────────────────────────────────────────────────────────────

export const LinearGauge: React.FC<LinearGaugeProps> = ({
  value,
  min = 0,
  max = 100,
  label,
  colorStops = DEFAULT_COLOR_STOPS,
  height = 12,
  showTicks = true,
  tickCount = 5,
  valueFormatter = (v) => v.toFixed(0),
  thresholds,
  className = '',
}) => {
  const p = pct(value, min, max);
  const color = interpolateColor(value, colorStops);
  const ticks = useMemo(() => {
    if (!showTicks) return [];
    return Array.from({ length: tickCount }, (_, i) => ({
      pct: i / (tickCount - 1),
      val: lerp(min, max, i / (tickCount - 1)),
    }));
  }, [showTicks, tickCount, min, max]);

  return (
    <div className={`bloomberg-gauge bloomberg-gauge--linear ${className}`} style={{ width: '100%' }}>
      {label && (
        <div className="linear-gauge__header">
          <span className="linear-gauge__label" style={{ color: '#aaa', fontSize: 11 }}>{label}</span>
          <span className="linear-gauge__value" style={{ color, fontSize: 11, fontWeight: 'bold' }}>
            {valueFormatter(value)}
          </span>
        </div>
      )}
      <div className="linear-gauge__track" style={{ height, background: '#1a2a38', borderRadius: height, overflow: 'hidden', position: 'relative' }}>
        <div
          className="linear-gauge__fill"
          style={{ width: `${p * 100}%`, height: '100%', background: color, borderRadius: height, transition: 'width 0.4s ease' }}
        />
        {thresholds?.map((t, i) => (
          <div
            key={i}
            className="linear-gauge__threshold"
            style={{
              position: 'absolute',
              left: `${pct(t.value, min, max) * 100}%`,
              top: -4,
              bottom: -4,
              width: 2,
              background: t.color,
              borderRadius: 1,
            }}
            title={`${t.label}: ${valueFormatter(t.value)}`}
          />
        ))}
      </div>
      {showTicks && (
        <div className="linear-gauge__ticks" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {ticks.map((tick, i) => (
            <span key={i} style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>
              {valueFormatter(tick.val)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Speed Gauge (Half-Circle) ────────────────────────────────────────────────

export const SpeedGauge: React.FC<SpeedGaugeProps> = ({
  value,
  min = 0,
  max = 100,
  label,
  bands = [
    { from: 0, to: 30, color: '#ff4444', label: 'Low' },
    { from: 30, to: 70, color: '#ffcc00', label: 'Mid' },
    { from: 70, to: 100, color: '#00d4aa', label: 'High' },
  ],
  radius = 70,
  showNeedle = true,
  valueFormatter = (v) => v.toFixed(0),
  className = '',
}) => {
  const width = (radius + 24) * 2;
  const height = radius + 40;
  const cx = width / 2;
  const cy = radius + 16;
  const startDeg = 180;
  const totalDeg = 180;

  const nDeg = startDeg - pct(value, min, max) * totalDeg;
  const needleLen = radius - 14;
  const nx = cx + needleLen * Math.cos((nDeg * Math.PI) / 180);
  const ny = cy + needleLen * Math.sin((nDeg * Math.PI) / 180);

  return (
    <div className={`bloomberg-gauge bloomberg-gauge--speed ${className}`}>
      <svg width={width} height={height}>
        {/* Bands */}
        {bands.map((band, i) => {
          const s = startDeg - pct(band.from, min, max) * totalDeg;
          const e = startDeg - pct(band.to, min, max) * totalDeg;
          return (
            <path
              key={i}
              d={arcPath(cx, cy, radius, -s + 90, -e + 90)}
              fill="none"
              stroke={band.color}
              strokeWidth={16}
              strokeLinecap="butt"
              opacity={0.7}
            />
          );
        })}
        {/* Track outline */}
        <path d={arcPath(cx, cy, radius, -startDeg + 90, -startDeg + 90 + totalDeg)} fill="none" stroke="#2a3a4a" strokeWidth={18} />
        {/* Needle */}
        {showNeedle && (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={6} fill="#3a4a5a" stroke="#fff" strokeWidth={1.5} />
          </>
        )}
        {/* Center label */}
        <text x={cx} y={cy + 22} textAnchor="middle" fill="#ccc" fontSize={16} fontWeight="bold" fontFamily="monospace">
          {valueFormatter(value)}
        </text>
        {label && (
          <text x={cx} y={cy + 36} textAnchor="middle" fill="#888" fontSize={10} fontFamily="monospace">
            {label}
          </text>
        )}
      </svg>
    </div>
  );
};

// ─── Multi Arc Gauge ──────────────────────────────────────────────────────────

export const MultiArcGauge: React.FC<MultiArcGaugeProps> = ({
  segments,
  radius = 60,
  thickness = 10,
  gapDeg = 10,
  centerLabel,
  centerSubLabel,
  className = '',
}) => {
  const size = (radius + thickness + 4) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcPerSegment = (360 - gapDeg * segments.length) / segments.length;

  return (
    <div className={`bloomberg-gauge bloomberg-gauge--multi ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {segments.map((seg, i) => {
          const r = radius - i * (thickness + 4);
          const startDeg = i * (arcPerSegment + gapDeg);
          const segMax = seg.max ?? 100;
          const fillDeg = arcPerSegment * (clamp(seg.value, 0, segMax) / segMax);
          const trackPath = arcPath(cx, cy, r, startDeg, startDeg + arcPerSegment);
          const fillPath = arcPath(cx, cy, r, startDeg, startDeg + fillDeg);
          return (
            <g key={i}>
              <path d={trackPath} fill="none" stroke="#2a3a4a" strokeWidth={thickness - 2} strokeLinecap="round" />
              {fillDeg > 0 && (
                <path d={fillPath} fill="none" stroke={seg.color} strokeWidth={thickness - 2} strokeLinecap="round" />
              )}
            </g>
          );
        })}
        {centerLabel && (
          <text x={cx} y={cy - 4} textAnchor="middle" fill="#ddd" fontSize={14} fontWeight="bold" fontFamily="monospace">
            {centerLabel}
          </text>
        )}
        {centerSubLabel && (
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#888" fontSize={10} fontFamily="monospace">
            {centerSubLabel}
          </text>
        )}
      </svg>
      <div className="multi-gauge__legend">
        {segments.map((seg, i) => (
          <div key={i} className="multi-gauge__legend-item" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#aaa' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span>{seg.label}</span>
            <span style={{ color: seg.color, fontWeight: 'bold' }}>{seg.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Thermometer ──────────────────────────────────────────────────────────────

export const ThermometerGauge: React.FC<ThermometerProps> = ({
  value,
  min = -10,
  max = 110,
  label,
  height = 120,
  colorStops = DEFAULT_COLOR_STOPS,
  className = '',
}) => {
  const p = pct(value, min, max);
  const color = interpolateColor(value, colorStops);
  const fillHeight = (height - 24) * p;
  const bulbR = 10;

  return (
    <div className={`bloomberg-gauge bloomberg-gauge--thermo ${className}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {label && <span style={{ fontSize: 10, color: '#aaa' }}>{label}</span>}
      <svg width={28} height={height + bulbR * 2}>
        {/* Tube track */}
        <rect x={10} y={0} width={8} height={height} rx={4} fill="#1a2a38" stroke="#2a3a4a" strokeWidth={1} />
        {/* Fill */}
        <rect
          x={11}
          y={height - fillHeight}
          width={6}
          height={fillHeight}
          rx={3}
          fill={color}
          style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
        />
        {/* Bulb */}
        <circle cx={14} cy={height + bulbR} r={bulbR} fill={color} stroke="#2a3a4a" strokeWidth={1} />
        {/* Value */}
        <text x={14} y={height + bulbR + 4} textAnchor="middle" fill="#fff" fontSize={7} fontFamily="monospace" fontWeight="bold">
          {value.toFixed(0)}
        </text>
      </svg>
    </div>
  );
};

// ─── Bullet Gauge ─────────────────────────────────────────────────────────────

export const BulletGauge: React.FC<BulletGaugeProps> = ({
  actual,
  target,
  min = 0,
  max = 100,
  label,
  ranges = [
    { from: 0, to: 40, color: '#ff4444' },
    { from: 40, to: 70, color: '#ffcc00' },
    { from: 70, to: 100, color: '#00d4aa' },
  ],
  height = 20,
  className = '',
}) => {
  const actualPct = pct(actual, min, max);
  const targetPct = pct(target, min, max);

  return (
    <div className={`bloomberg-gauge bloomberg-gauge--bullet ${className}`} style={{ width: '100%' }}>
      {label && <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{label}</div>}
      <div style={{ position: 'relative', height, borderRadius: 2, overflow: 'hidden', background: '#0a1628' }}>
        {/* Range bands */}
        {ranges.map((r, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${pct(r.from, min, max) * 100}%`,
              width: `${(pct(r.to, min, max) - pct(r.from, min, max)) * 100}%`,
              top: '20%',
              bottom: '20%',
              background: r.color,
              opacity: 0.25,
            }}
          />
        ))}
        {/* Actual bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${actualPct * 100}%`,
            top: '30%',
            bottom: '30%',
            background: '#4a9eff',
            borderRadius: 1,
            transition: 'width 0.4s ease',
          }}
        />
        {/* Target line */}
        <div
          style={{
            position: 'absolute',
            left: `${targetPct * 100}%`,
            top: '10%',
            bottom: '10%',
            width: 2,
            background: '#fff',
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
};

// ─── Gauge Grid ───────────────────────────────────────────────────────────────

export interface GaugeGridProps {
  gauges: Array<{
    label: string;
    value: number;
    min?: number;
    max?: number;
    colorStops?: GaugeColorStop[];
    formatter?: (v: number) => string;
  }>;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const GaugeGrid: React.FC<GaugeGridProps> = ({ gauges, columns = 3, className = '' }) => (
  <div
    className={`gauge-grid ${className}`}
    style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}
  >
    {gauges.map((g, i) => (
      <ArcGauge
        key={i}
        value={g.value}
        min={g.min}
        max={g.max}
        label={g.label}
        colorStops={g.colorStops}
        valueFormatter={g.formatter}
        radius={40}
        thickness={8}
      />
    ))}
  </div>
);

export default ArcGauge;
