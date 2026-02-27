// Bloomberg Palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff8a65';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';

interface StrategyAttribution {
  strategy: string;
  pnl: number;
  trades: number;
  win_rate: number;
}

interface SectorAttribution {
  sector: string;
  pnl: number;
  weight: number;
}

interface BucketAttribution {
  bucket: string;
  pnl: number;
}

interface Attribution {
  total_pnl: number;
  period: string;
  by_strategy: StrategyAttribution[];
  by_sector: SectorAttribution[];
  by_bucket: BucketAttribution[];
}

function PnlBar({ pnl, max }: { pnl: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.abs(pnl / max) * 100) : 0;
  return (
    <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden', marginTop: 3, width: 80 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: pnl >= 0 ? GREEN : RED, borderRadius: 2 }} />
    </div>
  );
}

function WeightBar({ weight }: { weight: number }) {
  return (
    <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden', width: 60 }}>
      <div style={{ width: `${Math.min(100, weight * 100)}%`, height: '100%', background: BLUE, borderRadius: 2 }} />
    </div>
  );
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th style={{ padding: '5px 10px', fontSize: 9, color: SUBTLE, letterSpacing: '0.08em', fontWeight: 700, textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, fontFamily: MONO }}>
    {children}
  </th>
);
const Td = ({ children, color, right, mono }: { children: React.ReactNode; color?: string; right?: boolean; mono?: boolean }) => (
  <td style={{ padding: '6px 10px', fontSize: 11, color: color || TEXT, textAlign: right ? 'right' : 'left', fontFamily: mono ? MONO : undefined }}>
    {children}
  </td>
);

export function AttributionPanel() {
  const [data, setData] = useState<Attribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STRATEGY' | 'SECTOR' | 'BUCKET' | 'CHART'>('STRATEGY');
  const [sortStrategy, setSortStrategy] = useState<'pnl' | 'trades' | 'win'>('pnl');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/v1/attribution`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0 12px', height: 36, border: 'none',
    borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
    background: 'transparent', color: active ? AMBER : SUBTLE,
    fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer',
  });

  const sortedStrategy = data ? [...(data.by_strategy || [])].sort((a, b) => {
    if (sortStrategy === 'pnl') return b.pnl - a.pnl;
    if (sortStrategy === 'trades') return b.trades - a.trades;
    return b.win_rate - a.win_rate;
  }) : [];
  const maxStratPnl = sortedStrategy.length > 0 ? Math.max(...sortedStrategy.map(s => Math.abs(s.pnl))) : 1;
  const maxSectorPnl = data ? Math.max(...(data.by_sector || []).map(s => Math.abs(s.pnl)), 1) : 1;
  const maxBucketPnl = data ? Math.max(...(data.by_bucket || []).map(b => Math.abs(b.pnl)), 1) : 1;

  return (
    <div data-testid="attribution-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: TEXT, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, padding: '0 16px', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>PA</span>
          <span style={{ color: SUBTLE, fontSize: 10 }}>|</span>
          <span style={{ fontSize: 10, color: TEXT, letterSpacing: '0.05em' }}>PERFORMANCE ATTRIBUTION</span>
        </div>
        <button onClick={load} style={{ fontSize: 9, padding: '2px 8px', background: BORDER, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>REFRESH</button>
      </div>

      {/* Tabs */}
      <div style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {(['STRATEGY', 'SECTOR', 'BUCKET', 'CHART'] as const).map(t => (
          <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {/* Summary ribbon */}
      {data && (
        <div data-testid="attribution-summary" style={{ padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', background: BG, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          {[
            { label: 'TOTAL P&L', val: `$${data.total_pnl.toLocaleString()}`, color: data.total_pnl >= 0 ? GREEN : RED },
            { label: 'PERIOD', val: data.period, color: TEXT },
            { label: 'STRATEGIES', val: (data.by_strategy || []).length.toString(), color: BLUE },
            { label: 'SECTORS', val: (data.by_sector || []).length.toString(), color: PURPLE },
            { label: 'BUCKETS', val: (data.by_bucket || []).length.toString(), color: ORANGE },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '5px 12px', minWidth: 90 }}>
              <div style={{ fontSize: 8, color: SUBTLE, letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: MONO }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div data-testid="attribution-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
            LOADING ATTRIBUTION DATA...
          </div>
        )}

        {!loading && !data && (
          <div data-testid="attribution-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: SUBTLE, fontFamily: MONO }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>â—Ž</div>
            <div style={{ fontSize: 11 }}>NO ATTRIBUTION DATA</div>
          </div>
        )}

        {!loading && data && activeTab === 'STRATEGY' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: PANEL, borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 9, color: SUBTLE }}>SORT:</span>
              {(['pnl', 'trades', 'win'] as const).map(s => (
                <button key={s} onClick={() => setSortStrategy(s)} style={{ fontSize: 9, padding: '2px 7px', background: sortStrategy === s ? AMBER + '22' : 'transparent', border: `1px solid ${sortStrategy === s ? AMBER : BORDER}`, color: sortStrategy === s ? AMBER : SUBTLE, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>{s.toUpperCase()}</button>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: PANEL }}>
                <Th>STRATEGY</Th><Th right>P&L</Th><Th right>TRADES</Th><Th right>WIN RATE</Th><Th right>CONTRIBUTION</Th>
              </tr></thead>
              <tbody>
                {sortedStrategy.map((s, idx) => (
                  <tr key={s.strategy} data-testid={`attr-strategy-${idx}`} onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ borderBottom: `1px solid ${BORDER}18` }}>
                    <Td>{s.strategy}</Td>
                    <Td right mono color={s.pnl >= 0 ? GREEN : RED}>${s.pnl.toLocaleString()}</Td>
                    <Td right mono>{s.trades}</Td>
                    <Td right mono color={s.win_rate >= 0.55 ? GREEN : s.win_rate >= 0.45 ? AMBER : RED}>{(s.win_rate * 100).toFixed(1)}%</Td>
                    <td style={{ padding: '6px 10px' }}><PnlBar pnl={s.pnl} max={maxStratPnl} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data && activeTab === 'SECTOR' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: PANEL }}>
              <Th>SECTOR</Th><Th right>WEIGHT</Th><Th right>P&L</Th><Th right>BAR</Th>
            </tr></thead>
            <tbody>
              {(data.by_sector || []).sort((a, b) => b.pnl - a.pnl).map((s, idx) => (
                <tr key={s.sector} data-testid={`attr-sector-${idx}`} onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ borderBottom: `1px solid ${BORDER}18` }}>
                  <Td>{s.sector}</Td>
                  <td style={{ padding: '6px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <WeightBar weight={s.weight} />
                      <span style={{ fontFamily: MONO, fontSize: 10, color: BLUE }}>{(s.weight * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <Td right mono color={s.pnl >= 0 ? GREEN : RED}>${s.pnl.toLocaleString()}</Td>
                  <td style={{ padding: '6px 10px' }}><PnlBar pnl={s.pnl} max={maxSectorPnl} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && data && activeTab === 'BUCKET' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {(data.by_bucket || []).map((b, idx) => (
                <div key={b.bucket} data-testid={`attr-bucket-${idx}`} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '12px 14px', borderLeft: `3px solid ${b.pnl >= 0 ? GREEN : RED}` }}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4, letterSpacing: '0.06em' }}>{b.bucket}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: b.pnl >= 0 ? GREEN : RED }}>${b.pnl.toLocaleString()}</div>
                  <PnlBar pnl={b.pnl} max={maxBucketPnl} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && data && activeTab === 'CHART' && (
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, marginBottom: 12 }}>P&L WATERFALL â€” BY STRATEGY</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, borderBottom: `1px solid ${BORDER}`, paddingBottom: 2 }}>
              {sortedStrategy.map(s => {
                const h = Math.abs(s.pnl / maxStratPnl) * 180;
                return (
                  <div key={s.strategy} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{ fontSize: 8, color: s.pnl >= 0 ? GREEN : RED, marginBottom: 2, fontFamily: MONO }}>${(s.pnl / 1000).toFixed(1)}k</div>
                    <div style={{ width: '100%', height: h, background: (s.pnl >= 0 ? GREEN : RED) + '88', border: `1px solid ${s.pnl >= 0 ? GREEN : RED}`, borderRadius: 2 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {sortedStrategy.map(s => (
                <div key={s.strategy} style={{ flex: 1, fontSize: 7, color: SUBTLE, textAlign: 'center', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.strategy.substring(0, 6)}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div data-testid="attribution-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
