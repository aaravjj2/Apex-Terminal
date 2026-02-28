/**
 * SectorPage.tsx
 * Sector rotation + breadth + valuation hub.
 * GIC sector overview, rotation signals, breadth indicators,
 * sector factor tilts, relative strength, and intermarket analysis.
 */

import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectorView = 'overview' | 'rotation' | 'breadth' | 'valuation' | 'factors' | 'relative';

interface SectorData {
  name: string;
  etf: string;
  pct_d1: number;
  pct_1w: number;
  pct_1m: number;
  ytd: number;
  pe: number;
  pb: number;
  div_yield: number;
  weight_spy: number;
  phase: 'leading' | 'weakening' | 'lagging' | 'improving';
  momentum: number;   // normalized -1 to 1
  breadth: number;    // % stocks above 50MA
  color: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const SECTORS: SectorData[] = [
  { name: 'Technology', etf: 'XLK', pct_d1: 1.8, pct_1w: 3.2, pct_1m: 8.4, ytd: 12.6, pe: 28.4, pb: 6.2, div_yield: 0.8, weight_spy: 28.4, phase: 'leading', momentum: 0.84, breadth: 78, color: '#4a9eff' },
  { name: 'Healthcare', etf: 'XLV', pct_d1: 0.4, pct_1w: 0.8, pct_1m: 1.2, ytd: 2.4, pe: 18.6, pb: 3.4, div_yield: 1.8, weight_spy: 12.8, phase: 'weakening', momentum: 0.18, breadth: 52, color: '#00d4aa' },
  { name: 'Financials', etf: 'XLF', pct_d1: 0.6, pct_1w: 1.4, pct_1m: 3.8, ytd: 5.8, pe: 14.2, pb: 1.6, div_yield: 2.4, weight_spy: 12.6, phase: 'improving', momentum: 0.52, breadth: 64, color: '#ff9900' },
  { name: 'Consumer Disc', etf: 'XLY', pct_d1: 1.2, pct_1w: 2.1, pct_1m: 5.6, ytd: 8.4, pe: 24.8, pb: 4.8, div_yield: 0.9, weight_spy: 10.4, phase: 'leading', momentum: 0.72, breadth: 71, color: '#cc44ff' },
  { name: 'Industrials', etf: 'XLI', pct_d1: 0.2, pct_1w: 0.6, pct_1m: 2.4, ytd: 3.8, pe: 20.4, pb: 3.6, div_yield: 1.6, weight_spy: 8.6, phase: 'weakening', momentum: 0.22, breadth: 58, color: '#ffcc00' },
  { name: 'Communication', etf: 'XLC', pct_d1: 1.4, pct_1w: 2.8, pct_1m: 7.2, ytd: 10.8, pe: 22.6, pb: 3.8, div_yield: 1.0, weight_spy: 8.4, phase: 'leading', momentum: 0.78, breadth: 74, color: '#ff6633' },
  { name: 'Consumer Staples', etf: 'XLP', pct_d1: -0.2, pct_1w: -0.4, pct_1m: -0.8, ytd: -1.2, pe: 16.8, pb: 4.2, div_yield: 2.8, weight_spy: 6.8, phase: 'lagging', momentum: -0.24, breadth: 42, color: '#66cc66' },
  { name: 'Energy', etf: 'XLE', pct_d1: -0.8, pct_1w: -1.6, pct_1m: -3.2, ytd: -4.8, pe: 12.4, pb: 1.8, div_yield: 3.6, weight_spy: 4.6, phase: 'lagging', momentum: -0.62, breadth: 38, color: '#ff4466' },
  { name: 'Utilities', etf: 'XLU', pct_d1: -0.4, pct_1w: -0.8, pct_1m: -2.4, ytd: -3.6, pe: 14.8, pb: 1.4, div_yield: 3.4, weight_spy: 2.4, phase: 'lagging', momentum: -0.44, breadth: 44, color: '#888' },
  { name: 'Real Estate', etf: 'XLRE', pct_d1: 0.8, pct_1w: 1.2, pct_1m: 1.8, ytd: 2.8, pe: 38.4, pb: 2.2, div_yield: 3.8, weight_spy: 2.2, phase: 'improving', momentum: 0.28, breadth: 54, color: '#aaaaff' },
  { name: 'Materials', etf: 'XLB', pct_d1: 0.0, pct_1w: 0.2, pct_1m: 0.6, ytd: 1.2, pe: 17.2, pb: 2.8, div_yield: 1.6, weight_spy: 2.8, phase: 'weakening', momentum: 0.04, breadth: 48, color: '#ffaa44' },
];

// ─── Phase Colors ────────────────────────────────────────────────────────────

function phaseColor(phase: SectorData['phase']): string {
  return phase === 'leading' ? '#00d4aa' :
         phase === 'improving' ? '#4a9eff' :
         phase === 'weakening' ? '#ff9900' : '#ff4466';
}

// ─── Rotation Wheel ───────────────────────────────────────────────────────────

const RotationWheel: React.FC<{ sectors: SectorData[] }> = ({ sectors }) => {
  const cx = 180, cy = 180, r = 130;
  const phases: SectorData['phase'][] = ['leading', 'weakening', 'lagging', 'improving'];
  const phaseMap = { leading: { label: 'LEADING', angle: 315, color: '#00d4aa' },
                     weakening: { label: 'WEAKENING', angle: 45, color: '#ff9900' },
                     lagging: { label: 'LAGGING', angle: 135, color: '#ff4466' },
                     improving: { label: 'IMPROVING', angle: 225, color: '#4a9eff' } };

  return (
    <svg width={360} height={360} style={{ fontFamily: 'monospace' }}>
      {/* Quadrant dividers */}
      <line x1={cx} y1={24} x2={cx} y2={cy * 2 - 24} stroke="#1a2a38" />
      <line x1={24} y1={cy} x2={cx * 2 - 24} y2={cy} stroke="#1a2a38" />
      {/* Quadrant labels */}
      {Object.entries(phaseMap).map(([phase, info], i) => {
        const rad = (info.angle * Math.PI) / 180;
        const lx = cx + Math.cos(rad) * 98;
        const ly = cy + Math.sin(rad) * 98;
        return (
          <g key={i}>
            <text x={lx} y={ly} textAnchor="middle" fill={info.color} fontSize={8} fontWeight="bold" opacity={0.6}>{info.label}</text>
          </g>
        );
      })}

      {/* Sector dots */}
      {sectors.map((s, i) => {
        const phaseAngle = phaseMap[s.phase].angle;
        // Position within quadrant based on momentum
        const spread = 30;
        const jitter = (i % 3 - 1) * spread;
        const rad = ((phaseAngle + jitter) * Math.PI) / 180;
        const dist = 40 + Math.abs(s.momentum) * 60;
        const sx = cx + Math.cos(rad) * dist;
        const sy = cy + Math.sin(rad) * dist;
        return (
          <g key={i}>
            <circle cx={sx} cy={sy} r={8} fill={s.color} opacity={0.7} />
            <text x={sx} y={sy + 3} textAnchor="middle" fill="#fff" fontSize={5.5} fontWeight="bold">{s.etf}</text>
          </g>
        );
      })}

      {/* Center */}
      <circle cx={cx} cy={cy} r={20} fill="#0a1628" stroke="#2a3a4a" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#555" fontSize={7}>CYCLE</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#555" fontSize={7}>CLOCK</text>
    </svg>
  );
};

// ─── Breadth Panel ────────────────────────────────────────────────────────────

const BreadthPanel: React.FC<{ sectors: SectorData[] }> = ({ sectors }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {sectors.sort((a, b) => b.breadth - a.breadth).map((s, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: s.color, fontSize: 10, fontFamily: 'monospace', width: 32 }}>{s.etf}</span>
        <div style={{ flex: 1, height: 18, background: '#0a1628', borderRadius: 2, position: 'relative' }}>
          <div style={{
            height: '100%', width: `${s.breadth}%`,
            background: s.breadth >= 65 ? '#00d4aa' : s.breadth >= 45 ? '#ffcc00' : '#ff4466',
            borderRadius: 2, opacity: 0.7, transition: 'width 0.4s',
          }} />
          <span style={{
            position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
            fontSize: 8, fontFamily: 'monospace', color: '#fff',
          }}>{s.name}</span>
          <span style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            fontSize: 9, fontFamily: 'monospace',
            color: s.breadth >= 65 ? '#00d4aa' : s.breadth >= 45 ? '#ffcc00' : '#ff4466',
            fontWeight: 'bold',
          }}>{s.breadth}%</span>
        </div>
      </div>
    ))}
    <div style={{ marginTop: 8, fontSize: 9, color: '#555', fontFamily: 'monospace' }}>
      % of stocks above 50-day moving average
    </div>
  </div>
);

// ─── Main Sector Table ────────────────────────────────────────────────────────

const SectorTable: React.FC<{ sectors: SectorData[] }> = ({ sectors }) => {
  const [sortBy, setSortBy] = useState<keyof SectorData>('ytd');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() =>
    [...sectors].sort((a, b) => {
      const av = a[sortBy] as number;
      const bv = b[sortBy] as number;
      return sortDir * ((av > bv) ? 1 : av < bv ? -1 : 0);
    }),
    [sectors, sortBy, sortDir]
  );

  function toggleSort(key: keyof SectorData) {
    if (sortBy === key) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortBy(key); setSortDir(-1); }
  }

  const hdr = (label: string, key: keyof SectorData) => (
    <th
      onClick={() => toggleSort(key)}
      style={{ padding: '7px 10px', color: sortBy === key ? '#4a9eff' : '#555', fontSize: 9, cursor: 'pointer', textAlign: 'right', borderBottom: '1px solid #1a2a38', whiteSpace: 'nowrap' }}
    >
      {label} {sortBy === key ? (sortDir === 1 ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#0a1628' }}>
            <th style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: 'left', borderBottom: '1px solid #1a2a38' }}>Sector</th>
            {hdr('1D%', 'pct_d1')}{hdr('1W%', 'pct_1w')}{hdr('1M%', 'pct_1m')}{hdr('YTD%', 'ytd')}
            {hdr('P/E', 'pe')}{hdr('P/B', 'pb')}{hdr('Div%', 'div_yield')}
            {hdr('SPY Wt%', 'weight_spy')}{hdr('Breadth', 'breadth')}
            <th style={{ padding: '7px 10px', color: '#555', fontSize: 9, textAlign: 'left', borderBottom: '1px solid #1a2a38' }}>Phase</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #0a1628' }}>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, background: s.color, borderRadius: 1 }} />
                  <span style={{ color: '#4a9eff', fontWeight: 'bold' }}>{s.etf}</span>
                  <span style={{ color: '#666', fontSize: 9 }}>{s.name}</span>
                </div>
              </td>
              {[s.pct_d1, s.pct_1w, s.pct_1m, s.ytd].map((v, ci) => (
                <td key={ci} style={{ padding: '6px 10px', textAlign: 'right', color: v >= 0 ? '#00d4aa' : '#ff4466', fontWeight: 'bold' }}>
                  {v >= 0 ? '+' : ''}{v.toFixed(2)}%
                </td>
              ))}
              <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{s.pe.toFixed(1)}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{s.pb.toFixed(1)}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', color: '#888' }}>{s.div_yield.toFixed(1)}%</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', color: '#668' }}>{s.weight_spy.toFixed(1)}%</td>
              <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <div style={{ width: 40, height: 5, background: '#0a1628', borderRadius: 2 }}>
                    <div style={{ width: `${s.breadth}%`, height: 5, background: s.breadth > 60 ? '#00d4aa' : s.breadth > 40 ? '#ffcc00' : '#ff4466', borderRadius: 2 }} />
                  </div>
                  <span style={{ color: '#888', fontSize: 8 }}>{s.breadth}%</span>
                </div>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <span style={{
                  padding: '2px 7px', borderRadius: 2, fontSize: 8, fontFamily: 'monospace',
                  background: `${phaseColor(s.phase)}22`, color: phaseColor(s.phase), fontWeight: 'bold',
                }}>{s.phase.toUpperCase()}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const VIEW_TABS: Array<{ id: SectorView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'rotation', label: 'Rotation Wheel' },
  { id: 'breadth', label: 'Breadth' },
  { id: 'valuation', label: 'Valuation' },
  { id: 'factors', label: 'Factor Tilts' },
  { id: 'relative', label: 'Relative Strength' },
];

export const SectorPage: React.FC = () => {
  const [view, setView] = useState<SectorView>('overview');

  const renderView = () => {
    switch (view) {
      case 'overview': return <SectorTable sectors={SECTORS} />;
      case 'rotation': return (
        <div style={{ display: 'flex', gap: 24 }}>
          <RotationWheel sectors={SECTORS} />
          <div style={{ flex: 1 }}>
            <h3 style={{ color: '#888', fontSize: 11, fontFamily: 'monospace', marginBottom: 10 }}>ROTATION SIGNALS</h3>
            {SECTORS.filter(s => s.phase === 'leading' || s.phase === 'improving').map((s, i) => (
              <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '6px 10px', marginBottom: 4,
                borderLeft: `3px solid ${phaseColor(s.phase)}` }}>
                <span style={{ color: s.color, fontWeight: 'bold', fontSize: 10, fontFamily: 'monospace' }}>{s.etf}</span>
                <span style={{ color: '#555', fontSize: 9, fontFamily: 'monospace', marginLeft: 8 }}>{s.name}</span>
                <span style={{ color: phaseColor(s.phase), fontSize: 9, fontFamily: 'monospace', float: 'right' }}>
                  {s.phase.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
      case 'breadth': return <BreadthPanel sectors={SECTORS} />;
      case 'valuation': return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SECTORS.sort((a, b) => a.pe - b.pe).map((s, i) => (
            <div key={i} style={{ background: '#0e1c2e', borderRadius: 4, padding: '10px 14px', minWidth: 130 }}>
              <div style={{ color: s.color, fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' }}>{s.etf}</div>
              <div style={{ color: '#555', fontSize: 8, fontFamily: 'monospace', marginBottom: 6 }}>{s.name}</div>
              <div style={{ color: '#ddd', fontSize: 13, fontFamily: 'monospace' }}>P/E: <b>{s.pe.toFixed(1)}x</b></div>
              <div style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>P/B: {s.pb.toFixed(1)}x</div>
              <div style={{ color: '#4a9eff', fontSize: 11, fontFamily: 'monospace' }}>Div: {s.div_yield.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      );
      default: return <div style={{ color: '#555', fontFamily: 'monospace', padding: 24 }}>Module: {view}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#060e18', color: '#ccc' }}>
      <div style={{ height: 44, background: '#0a1628', borderBottom: '1px solid #1a2a38', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <span style={{ color: '#00d4aa', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>SECTOR ANALYSIS</span>
      </div>
      <div style={{ display: 'flex', background: '#0a1628', borderBottom: '1px solid #1a2a38', padding: '0 16px' }}>
        {VIEW_TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '8px 14px', background: 'transparent', border: 'none',
            borderBottom: view === t.id ? '2px solid #00d4aa' : '2px solid transparent',
            color: view === t.id ? '#00d4aa' : '#666', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {renderView()}
      </div>
    </div>
  );
};

export default SectorPage;
