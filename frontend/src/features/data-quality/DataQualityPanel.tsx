// Bloomberg palette
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

const API_BASE = '/api/v1';

interface DataFeed {
  id: string;
  name: string;
  type: string;
  status: string;
  latency_ms: number;
  last_update: string;
  gaps_24h: number;
  integrity_score: number;
  records_today?: number;
  avg_latency_7d?: number;
  error_rate?: number;
  provider?: string;
}

const MOCK_FEEDS: DataFeed[] = [
  { id: '1', name: 'Alpaca WebSocket', type: 'REALTIME', status: 'healthy', latency_ms: 12, last_update: '2024-01-15 14:32:01', gaps_24h: 0, integrity_score: 0.9998, records_today: 482341, avg_latency_7d: 14, error_rate: 0.0002, provider: 'Alpaca' },
  { id: '2', name: 'Yahoo Finance REST', type: 'POLLING', status: 'degraded', latency_ms: 423, last_update: '2024-01-15 14:31:45', gaps_24h: 3, integrity_score: 0.9712, records_today: 12409, avg_latency_7d: 287, error_rate: 0.028, provider: 'Yahoo' },
  { id: '3', name: 'FRED Macro', type: 'BATCH', status: 'healthy', latency_ms: 88, last_update: '2024-01-15 09:00:00', gaps_24h: 0, integrity_score: 0.9999, records_today: 847, avg_latency_7d: 91, error_rate: 0.0001, provider: 'FRED' },
  { id: '4', name: 'Options Chain Feed', type: 'REALTIME', status: 'stale', latency_ms: 2140, last_update: '2024-01-15 13:58:22', gaps_24h: 12, integrity_score: 0.8834, records_today: 8923, avg_latency_7d: 180, error_rate: 0.117, provider: 'CBOE' },
  { id: '5', name: 'News Sentiment NLP', type: 'STREAMING', status: 'healthy', latency_ms: 55, last_update: '2024-01-15 14:31:59', gaps_24h: 1, integrity_score: 0.9944, records_today: 2341, avg_latency_7d: 58, error_rate: 0.005, provider: 'Benzinga' },
];

const STATUS_COLORS: Record<string, string> = {
  healthy: GREEN, degraded: AMBER, stale: RED, offline: RED, unknown: SUBTLE,
};

const LatencyBar: React.FC<{ ms: number; max?: number }> = ({ ms, max = 2000 }) => {
  const pct = Math.min((ms / max) * 100, 100);
  const col = ms < 100 ? GREEN : ms < 500 ? AMBER : RED;
  return (
    <div style={{ background: BORDER, height: 4, borderRadius: 2, marginTop: 3, width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
    </div>
  );
};

const IntegrityGauge: React.FC<{ score: number }> = ({ score }) => {
  const pct = score * 100;
  const col = score >= 0.99 ? GREEN : score >= 0.95 ? AMBER : RED;
  return (
    <div style={{ background: BORDER, height: 4, borderRadius: 2, marginTop: 3 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
    </div>
  );
};

import React, { useState, useEffect } from 'react';

export function DataQualityPanel() {
  const [feeds, setFeeds] = useState<DataFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DataFeed | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'name' | 'latency_ms' | 'integrity_score' | 'gaps_24h'>('integrity_score');

  useEffect(() => {
    fetch(`${API_BASE}/data-quality`)
      .then(r => r.json())
      .then(data => setFeeds(Array.isArray(data) ? data : []))
      .catch(() => setFeeds(MOCK_FEEDS))
      .finally(() => setLoading(false));
  }, []);

  const types = ['all', ...Array.from(new Set(feeds.map(f => f.type)))];
  const filtered = feeds
    .filter(f => statusFilter === 'all' || f.status === statusFilter)
    .filter(f => typeFilter === 'all' || f.type === typeFilter)
    .sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'latency_ms') return a.latency_ms - b.latency_ms;
      if (sortKey === 'integrity_score') return b.integrity_score - a.integrity_score;
      if (sortKey === 'gaps_24h') return a.gaps_24h - b.gaps_24h;
      return 0;
    });

  const healthyCount = feeds.filter(f => f.status === 'healthy').length;
  const totalGaps = feeds.reduce((a, f) => a + f.gaps_24h, 0);
  const avgIntegrity = feeds.length ? (feeds.reduce((a, f) => a + f.integrity_score, 0) / feeds.length) : 0;
  const avgLatency = feeds.length ? (feeds.reduce((a, f) => a + f.latency_ms, 0) / feeds.length) : 0;

  return (
    <div data-testid="data-quality-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: AMBER, fontWeight: 700, letterSpacing: 2 }}>DQ</span>
        <span style={{ fontSize: 11, color: SUBTLE, letterSpacing: 1 }}>DATA QUALITY MONITOR</span>
        <span style={{ fontSize: 10, color: healthyCount === feeds.length ? GREEN : AMBER, background: (healthyCount === feeds.length ? GREEN : AMBER) + '22', border: `1px solid ${(healthyCount === feeds.length ? GREEN : AMBER)}44`, borderRadius: 10, padding: '1px 6px' }}>
          {healthyCount}/{feeds.length} OK
        </span>
      </div>

      {/* Summary bar */}
      {!loading && feeds.length > 0 && (
        <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'FEEDS', val: feeds.length, col: TEXT },
            { label: 'HEALTHY', val: healthyCount, col: GREEN },
            { label: 'STALE', val: feeds.filter(f => f.status === 'stale').length, col: RED },
            { label: 'GAPS 24H', val: totalGaps, col: totalGaps > 5 ? RED : totalGaps > 0 ? AMBER : GREEN },
            { label: 'AVG INT', val: `${(avgIntegrity * 100).toFixed(2)}%`, col: avgIntegrity > 0.99 ? GREEN : avgIntegrity > 0.95 ? AMBER : RED },
            { label: 'AVG LAT', val: `${Math.round(avgLatency)}ms`, col: avgLatency < 100 ? GREEN : avgLatency < 500 ? AMBER : RED },
          ].map(({ label, val, col }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 12, color: col, fontFamily: MONO, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: '5px 14px', borderBottom: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {['all', 'healthy', 'degraded', 'stale'].map(f => {
          const col = f === 'all' ? TEXT : STATUS_COLORS[f] || SUBTLE;
          const active = statusFilter === f;
          return (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              background: active ? col + '22' : 'transparent', border: `1px solid ${active ? col : BORDER}`,
              borderRadius: 2, padding: '2px 7px', color: active ? col : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase',
            }}>{f}</button>
          );
        })}
        <div style={{ width: 1, height: 14, background: BORDER, margin: '0 4px' }} />
        {types.map(t => {
          const active = typeFilter === t;
          return (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              background: active ? BLUE + '22' : 'transparent', border: `1px solid ${active ? BLUE : BORDER}`,
              borderRadius: 2, padding: '2px 7px', color: active ? BLUE : SUBTLE, fontFamily: MONO, fontSize: 10, cursor: 'pointer',
            }}>{t}</button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 9, color: SUBTLE }}>SORT:</span>
          {(['name', 'latency_ms', 'integrity_score', 'gaps_24h'] as const).map(k => (
            <button key={k} onClick={() => setSortKey(k)} style={{
              background: sortKey === k ? '#1a1a1a' : 'transparent', border: `1px solid ${sortKey === k ? AMBER : BORDER}`,
              borderRadius: 2, padding: '2px 6px', color: sortKey === k ? AMBER : SUBTLE, fontFamily: MONO, fontSize: 9, cursor: 'pointer',
            }}>{k.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: selected ? '0 0 55%' : 1, overflow: 'auto' }}>
          {loading && <div data-testid="data-quality-loading" style={{ padding: 32, textAlign: 'center', color: AMBER, letterSpacing: 2 }}>LOADING...</div>}
          {!loading && filtered.length === 0 && <div data-testid="data-quality-empty" style={{ padding: 48, textAlign: 'center', color: SUBTLE }}>No data feeds</div>}
          {!loading && filtered.map((f, idx) => {
            const isSelected = selected?.id === f.id;
            const sc = STATUS_COLORS[f.status] || SUBTLE;
            const latCol = f.latency_ms < 100 ? GREEN : f.latency_ms < 500 ? AMBER : RED;
            const intCol = f.integrity_score >= 0.99 ? GREEN : f.integrity_score >= 0.95 ? AMBER : RED;
            return (
              <div
                key={f.id}
                data-testid={`feed-card-${idx}`}
                onClick={() => setSelected(prev => prev?.id === f.id ? null : f)}
                style={{
                  padding: '12px 14px', borderBottom: `1px solid ${BORDER}`,
                  background: isSelected ? '#1a140a' : 'transparent',
                  cursor: 'pointer', borderLeft: `3px solid ${isSelected ? sc : 'transparent'}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#141414'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>{f.name}</span>
                    <span style={{ fontSize: 9, padding: '1px 6px', background: sc + '22', border: `1px solid ${sc}44`, borderRadius: 8, color: sc, letterSpacing: 1 }}>{f.status.toUpperCase()}</span>
                    <span style={{ fontSize: 9, color: SUBTLE }}>{f.type}</span>
                    {f.provider && <span style={{ fontSize: 9, color: BLUE }}>{f.provider}</span>}
                  </div>
                  <span style={{ fontSize: 9, color: SUBTLE }}>{f.last_update}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>LATENCY</div>
                    <div style={{ fontSize: 12, color: latCol, fontFamily: MONO, fontWeight: 600 }}>{f.latency_ms}ms</div>
                    <LatencyBar ms={f.latency_ms} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>GAPS 24H</div>
                    <div style={{ fontSize: 12, color: f.gaps_24h > 5 ? RED : f.gaps_24h > 0 ? AMBER : GREEN, fontFamily: MONO, fontWeight: 600 }}>{f.gaps_24h}</div>
                    <div style={{ marginTop: 3, fontSize: 9, color: SUBTLE }}>{f.gaps_24h === 0 ? 'clean' : `${f.gaps_24h} gap${f.gaps_24h > 1 ? 's' : ''}`}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>INTEGRITY</div>
                    <div style={{ fontSize: 12, color: intCol, fontFamily: MONO, fontWeight: 600 }}>{(f.integrity_score * 100).toFixed(2)}%</div>
                    <IntegrityGauge score={f.integrity_score} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: SUBTLE, letterSpacing: 1 }}>RECORDS/DAY</div>
                    <div style={{ fontSize: 12, color: TEXT, fontFamily: MONO }}>{f.records_today?.toLocaleString() ?? '--'}</div>
                    {f.error_rate != null && <div style={{ fontSize: 9, color: f.error_rate < 0.01 ? GREEN : f.error_rate < 0.05 ? AMBER : RED, marginTop: 3 }}>ERR {(f.error_rate * 100).toFixed(2)}%</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ flex: '0 0 45%', borderLeft: `1px solid ${BORDER}`, background: PANEL, padding: 14, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1 }}>FEED DETAIL</div>
                <div style={{ fontSize: 14, color: AMBER, fontWeight: 700, marginTop: 2 }}>{selected.name}</div>
                <div style={{ fontSize: 10, color: STATUS_COLORS[selected.status] || SUBTLE, marginTop: 2 }}>{selected.status.toUpperCase()} Â· {selected.type}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16 }}>âœ•</button>
            </div>
            {[
              { label: 'PROVIDER', val: selected.provider ?? '--', col: BLUE },
              { label: 'LATENCY', val: `${selected.latency_ms}ms`, col: selected.latency_ms < 100 ? GREEN : selected.latency_ms < 500 ? AMBER : RED },
              { label: 'GAPS 24H', val: selected.gaps_24h, col: selected.gaps_24h === 0 ? GREEN : selected.gaps_24h > 5 ? RED : AMBER },
              { label: 'INTEGRITY', val: `${(selected.integrity_score * 100).toFixed(4)}%`, col: selected.integrity_score >= 0.99 ? GREEN : selected.integrity_score >= 0.95 ? AMBER : RED },
              { label: 'RECORDS TODAY', val: selected.records_today?.toLocaleString() ?? '--', col: TEXT },
              { label: 'AVG LATENCY 7D', val: selected.avg_latency_7d != null ? `${selected.avg_latency_7d}ms` : '--', col: SUBTLE === '#555' ? TEXT : SUBTLE },
              { label: 'ERROR RATE', val: selected.error_rate != null ? `${(selected.error_rate * 100).toFixed(3)}%` : '--', col: (selected.error_rate ?? 0) < 0.01 ? GREEN : (selected.error_rate ?? 0) < 0.05 ? AMBER : RED },
              { label: 'LAST UPDATE', val: selected.last_update, col: TEXT },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11 }}>
                <span style={{ color: SUBTLE, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: col, fontFamily: MONO }}>{String(val)}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: '8px 10px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
              <div style={{ fontSize: 10, color: SUBTLE, letterSpacing: 1, marginBottom: 8 }}>INTEGRITY GAUGE</div>
              <div style={{ background: '#1a1a1a', height: 12, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${selected.integrity_score * 100}%`, height: '100%', background: selected.integrity_score >= 0.99 ? GREEN : selected.integrity_score >= 0.95 ? AMBER : RED, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 10, color: TEXT, marginTop: 4, textAlign: 'right' }}>{(selected.integrity_score * 100).toFixed(4)}%</div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <button style={{ flex: 1, background: BLUE + '22', border: `1px solid ${BLUE}`, borderRadius: 3, padding: '5px 0', color: BLUE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>REFRESH</button>
              <button style={{ flex: 1, background: ORANGE + '22', border: `1px solid ${ORANGE}`, borderRadius: 3, padding: '5px 0', color: ORANGE, fontFamily: MONO, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>BACKFILL</button>
            </div>
          </div>
        )}
      </div>

      <div data-testid="data-quality-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}


interface DataFeed {
  id: string;
  name: string;
  type: string;
  status: string;
  latency_ms: number;
  last_update: string;
  gaps_24h: number;
  integrity_score: number;
}

const statusColors: Record<string, string> = {
  healthy: 'bg-green-500/20 text-green-400',
  degraded: 'bg-yellow-500/20 text-yellow-400',
  stale: 'bg-red-500/20 text-red-400',
};
