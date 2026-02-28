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

interface HealthComponent {
  id: string;
  name: string;
  status: string;
  uptime_pct: number;
  latency_p50_ms: number;
  latency_p99_ms: number;
  last_incident: string | null;
}

interface PlatformSummary {
  overall_status: string;
  total_components: number;
  operational: number;
  degraded: number;
  down: number;
  avg_uptime_pct: number;
  version: string;
  environment: string;
}

const statusColor = (s: string) => s === 'operational' ? GREEN : s === 'degraded' ? AMBER : RED;
const statusLabel = (s: string) => s.toUpperCase();

function UptimeBar({ pct }: { pct: number }) {
  const color = pct >= 99 ? GREEN : pct >= 95 ? AMBER : RED;
  return (
    <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
    </div>
  );
}

function LatencyBar({ val, max }: { val: number; max: number }) {
  const pct = Math.min(100, (val / max) * 100);
  const color = val < 50 ? GREEN : val < 200 ? AMBER : RED;
  return (
    <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  );
}

export function PlatformHealthPanel() {
  const [components, setComponents] = useState<HealthComponent[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'COMPONENTS' | 'INCIDENTS' | 'LATENCY'>('OVERVIEW');
  const [filter, setFilter] = useState<'ALL' | 'OPERATIONAL' | 'DEGRADED' | 'DOWN'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'uptime' | 'latency'>('name');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedComponent, setSelectedComponent] = useState<HealthComponent | null>(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/v1/platform-health`).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/platform-health/summary`).then(r => r.json()),
    ])
      .then(([c, s]) => {
        setComponents(Array.isArray(c) ? c : []);
        setSummary(s);
        setLastRefresh(new Date());
        setError(null);
      })
      .catch((e) => { setError(String(e)); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetch_, 30000);
    return () => clearInterval(t);
  }, [autoRefresh, fetch_]);

  const filtered = components.filter(c => filter === 'ALL' || c.status === filter.toLowerCase());
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'uptime') return b.uptime_pct - a.uptime_pct;
    if (sortBy === 'latency') return a.latency_p50_ms - b.latency_p50_ms;
    return a.name.localeCompare(b.name);
  });
  const maxLatency = Math.max(500, ...components.map(c => c.latency_p99_ms));

  const headerStyle: React.CSSProperties = {
    background: PANEL,
    borderBottom: `1px solid ${BORDER}`,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    flexShrink: 0,
  };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0 12px',
    height: 40,
    border: 'none',
    borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
    background: 'transparent',
    color: active ? AMBER : SUBTLE,
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    cursor: 'pointer',
  });
  const statBox = (label: string, val: string|number, color?: string): React.ReactNode => (
    <div key={label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '8px 14px', minWidth: 100 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: color || TEXT }}>{val}</div>
    </div>
  );

  return (
    <div data-testid="platform-health-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: TEXT, fontFamily: MONO }}>
      {/* Terminal header */}
      <div style={{ ...headerStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>PH</span>
          <span style={{ color: SUBTLE, fontSize: 10 }}>|</span>
          <span style={{ fontSize: 10, color: TEXT, letterSpacing: '0.05em' }}>PLATFORM HEALTH MONITOR</span>
          {summary && (
            <span style={{ padding: '1px 6px', borderRadius: 2, fontSize: 9, fontWeight: 700, background: statusColor(summary.overall_status) + '22', color: statusColor(summary.overall_status), marginLeft: 8 }}>
              {statusLabel(summary.overall_status)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, color: SUBTLE }}>{lastRefresh.toLocaleTimeString()}</span>
          <button onClick={() => setAutoRefresh(a => !a)} style={{ fontSize: 9, padding: '2px 8px', background: autoRefresh ? GREEN + '22' : BORDER, border: `1px solid ${autoRefresh ? GREEN : BORDER}`, color: autoRefresh ? GREEN : SUBTLE, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>
            {autoRefresh ? 'â— AUTO' : 'â—‹ MANUAL'}
          </button>
          <button onClick={fetch_} style={{ fontSize: 9, padding: '2px 8px', background: BORDER, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>REFRESH</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {(['OVERVIEW', 'COMPONENTS', 'INCIDENTS', 'LATENCY'] as const).map(t => (
          <button key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {/* Summary stats */}
      {summary && (
        <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', background: BG, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          {statBox('TOTAL', summary.total_components, BLUE)}
          {statBox('OPERATIONAL', summary.operational, GREEN)}
          {statBox('DEGRADED', summary.degraded, AMBER)}
          {statBox('DOWN', summary.down, RED)}
          {statBox('AVG UPTIME', `${summary.avg_uptime_pct?.toFixed(2)}%`, summary.avg_uptime_pct >= 99 ? GREEN : AMBER)}
          {statBox('VERSION', `v${summary.version}`, TEXT)}
          {statBox('ENV', summary.environment.toUpperCase(), PURPLE)}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }} data-testid="platform-health-loading">
            <span style={{ borderBottom: `2px solid ${AMBER}`, paddingBottom: 2 }}>LOADING HEALTH DATA...</span>
          </div>
        )}
        {error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED, fontFamily: MONO, fontSize: 11 }}>
            ERROR: {error}
          </div>
        )}
        {!loading && !error && components.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: SUBTLE, fontFamily: MONO }} data-testid="platform-health-empty">
            <div style={{ fontSize: 28, marginBottom: 12 }}>â™¥</div>
            <div style={{ fontSize: 11 }}>NO HEALTH DATA AVAILABLE</div>
            <div style={{ fontSize: 10, marginTop: 4, color: BORDER }}>Health telemetry will appear when services report in</div>
          </div>
        )}
        {!loading && !error && components.length > 0 && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: component list */}
            <div style={{ flex: 1, overflow: 'auto', borderRight: selectedComponent ? `1px solid ${BORDER}` : 'none' }}>
              {/* Filter + Sort toolbar */}
              <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
                {(['ALL', 'OPERATIONAL', 'DEGRADED', 'DOWN'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 9, padding: '2px 8px', background: filter === f ? AMBER + '22' : 'transparent', border: `1px solid ${filter === f ? AMBER : BORDER}`, color: filter === f ? AMBER : SUBTLE, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>
                    {f}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 9, color: SUBTLE }}>SORT:</span>
                {(['name', 'uptime', 'latency'] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)} style={{ fontSize: 9, padding: '2px 8px', background: sortBy === s ? BLUE + '22' : 'transparent', border: `1px solid ${sortBy === s ? BLUE : BORDER}`, color: sortBy === s ? BLUE : SUBTLE, borderRadius: 2, cursor: 'pointer', fontFamily: MONO }}>
                    {s.toUpperCase()}
                  </button>
                ))}
                <span style={{ fontSize: 9, color: SUBTLE, marginLeft: 8 }}>{filtered.length}/{components.length}</span>
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '200px 90px 80px 80px 80px 1fr', padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, background: PANEL, fontSize: 9, color: SUBTLE, letterSpacing: '0.08em' }}>
                <span>COMPONENT</span>
                <span style={{ textAlign: 'right' }}>STATUS</span>
                <span style={{ textAlign: 'right' }}>UPTIME %</span>
                <span style={{ textAlign: 'right' }}>p50 ms</span>
                <span style={{ textAlign: 'right' }}>p99 ms</span>
                <span>LAST INCIDENT</span>
              </div>

              {/* Rows */}
              {sorted.map((c, idx) => (
                <div
                  key={c.id}
                  data-testid={`health-component-${idx}`}
                  onClick={() => setSelectedComponent(selectedComponent?.id === c.id ? null : c)}
                  onMouseEnter={e => (e.currentTarget.style.background = PANEL)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{ display: 'grid', gridTemplateColumns: '200px 90px 80px 80px 80px 1fr', padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', background: selectedComponent?.id === c.id ? PANEL : 'transparent' }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 2, background: statusColor(c.status) + '22', color: statusColor(c.status) }}>{c.status.toUpperCase()}</span>
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontFamily: MONO, color: c.uptime_pct >= 99 ? GREEN : c.uptime_pct >= 95 ? AMBER : RED }}>{c.uptime_pct?.toFixed(2)}%</span>
                    <UptimeBar pct={c.uptime_pct} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontFamily: MONO, color: c.latency_p50_ms < 50 ? GREEN : c.latency_p50_ms < 200 ? AMBER : RED }}>{c.latency_p50_ms}</span>
                    <LatencyBar val={c.latency_p50_ms} max={maxLatency} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontFamily: MONO, color: c.latency_p99_ms < 100 ? GREEN : c.latency_p99_ms < 500 ? AMBER : RED }}>{c.latency_p99_ms}</span>
                    <LatencyBar val={c.latency_p99_ms} max={maxLatency} />
                  </div>
                  <span style={{ fontSize: 10, color: c.last_incident ? RED : SUBTLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_incident || 'â€”'}</span>
                </div>
              ))}

              {sorted.length === 0 && (
                <div style={{ padding: '24px 12px', fontSize: 10, color: SUBTLE, textAlign: 'center' }}>NO COMPONENTS MATCH FILTER</div>
              )}
            </div>

            {/* Right: detail panel */}
            {selectedComponent && (
              <div style={{ width: 280, flexShrink: 0, overflow: 'auto', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: AMBER }}>{selectedComponent.name}</span>
                  <button onClick={() => setSelectedComponent(null)} style={{ background: 'transparent', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 12 }}>âœ•</button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>STATUS</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(selectedComponent.status) }}>{selectedComponent.status.toUpperCase()}</span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 6 }}>UPTIME</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: selectedComponent.uptime_pct >= 99 ? GREEN : AMBER }}>
                    {selectedComponent.uptime_pct?.toFixed(3)}%
                  </div>
                  <UptimeBar pct={selectedComponent.uptime_pct} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>LATENCY</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE }}>p50</div>
                      <div style={{ fontSize: 16, fontFamily: MONO, fontWeight: 700, color: selectedComponent.latency_p50_ms < 50 ? GREEN : AMBER }}>
                        {selectedComponent.latency_p50_ms} <span style={{ fontSize: 10 }}>ms</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: SUBTLE }}>p99</div>
                      <div style={{ fontSize: 16, fontFamily: MONO, fontWeight: 700, color: selectedComponent.latency_p99_ms < 100 ? GREEN : RED }}>
                        {selectedComponent.latency_p99_ms} <span style={{ fontSize: 10 }}>ms</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>COMPONENT ID</div>
                  <div style={{ fontSize: 10, fontFamily: MONO, color: TEXT }}>{selectedComponent.id}</div>
                </div>

                <div>
                  <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 4 }}>LAST INCIDENT</div>
                  <div style={{ fontSize: 10, fontFamily: MONO, color: selectedComponent.last_incident ? RED : SUBTLE }}>
                    {selectedComponent.last_incident || 'NONE RECORDED'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div data-testid="platform-health-panel-ready" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>ready</div>
    </div>
  );
}
