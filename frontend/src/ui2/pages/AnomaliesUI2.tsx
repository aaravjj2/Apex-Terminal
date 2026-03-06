import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// AnomaliesUI2 — Bloomberg ANOM-grade anomaly detection terminal
// Tabs: LIVE FEED | HEATMAP | PATTERNS | STATISTICS | RESOLVED
// APIs: /api/v4/anomalies/active, /api/v4/anomalies/heatmap,
//       /api/v4/anomalies/patterns, /api/v4/anomalies/stats,
//       /api/v4/anomalies/resolved

const BG = '#0a0a0a'
const PANEL = '#111111'
const BORDER = '#1e1e1e'
const AMBER = '#f5a623'
const GREEN = '#26a69a'
const RED = '#ef5350'
const BLUE = '#42a5f5'
const PURPLE = '#ab47bc'
const ORANGE = '#ff8a65'
const SUBTLE = '#555'
const TEXT = '#d1d4dc'
const MONO = '"Roboto Mono","Courier New",monospace'

type Severity = 'critical' | 'high' | 'medium' | 'low'
type AnomalyType = 'price_gap' | 'volume_spike' | 'iv_spike' | 'correlation_break' | 'momentum_reversal' | 'liquidity_drop' | 'basis_anomaly' | 'spread_blowout' | 'order_imbalance' | 'tick_anomaly'

interface Anomaly {
  id: string
  symbol: string
  type: AnomalyType
  severity: Severity
  zscore: number
  value: number
  expectedValue: number
  deviation: number
  timestamp: string
  description: string
  resolved: boolean
  resolvedAt?: string
  sector: string
  flags: string[]
}

interface HeatmapCell {
  symbol: string
  sector: string
  anomalyCount: number
  maxSeverity: Severity
  maxZscore: number
}

interface AnomalyPattern {
  name: string
  type: string
  symbols: string[]
  confidence: number
  implication: string
  firstSeen: string
  occurrenceCount: number
  lastSeparation: number
}

interface AnomalyStats {
  totalToday: number
  criticalCount: number
  highCount: number
  resolvedToday: number
  avgZscore: number
  topType: string
  topSymbol: string
  trend: 'increasing' | 'stable' | 'decreasing'
  byType: { type: string; count: number }[]
  bySector: { sector: string; count: number }[]
}

// â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{children}</td>
}

const SEVERITY_COLOR: Record<Severity, string> = { critical: '#b71c1c', high: RED, medium: AMBER, low: SUBTLE }

function SevBadge({ sev }: { sev: Severity }) {
  const c = SEVERITY_COLOR[sev] || SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: c, background: c + '22', padding: '2px 7px', borderRadius: 2, border: `1px solid ${c}44`, textTransform: 'uppercase' }}>{sev}</span>
}

function TypeBadge({ type }: { type: AnomalyType }) {
  const col = type.includes('spike') ? RED : type.includes('break') ? PURPLE : type.includes('imbalance') ? ORANGE : BLUE
  return <span style={{ fontFamily: MONO, fontSize: 8, color: col, background: col + '22', padding: '2px 6px', borderRadius: 2 }}>{type.replace(/_/g, ' ').toUpperCase()}</span>
}

function ZBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / 6) * 100))
  const c = Math.abs(value) > 4 ? RED : Math.abs(value) > 2 ? AMBER : SUBTLE
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: c, minWidth: 35 }}>{value.toFixed(1)}Ïƒ</span>
    </div>
  )
}

function StatCard({ label, value, sub, col }: { label: string; value: string | number; sub?: string; col?: string }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
      <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color: col || TEXT }}>{value}</div>
      {sub && <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function fmtTime(ts: string) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return ts }
}
function fmtDate(ts: string) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return ts }
}


export function AnomaliesUI2() {
  const [tab, setTab] = useState<'feed' | 'heatmap' | 'patterns' | 'stats' | 'resolved'>('feed')
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [patterns, setPatterns] = useState<AnomalyPattern[]>([])
  const [stats, setStats] = useState<AnomalyStats | null>(null)
  const [resolved, setResolved] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const parseAnomaly = (x: any): Anomaly => ({
    id: x.id ?? String(Math.random()),
    symbol: x.symbol ?? '',
    type: (x.type ?? x.anomaly_type ?? 'price_gap') as AnomalyType,
    severity: (x.severity ?? 'medium') as Severity,
    zscore: Number(x.z_score ?? x.zscore ?? 0),
    value: Number(x.value ?? 0),
    expectedValue: Number(x.expected_value ?? x.expected ?? 0),
    deviation: Number(x.deviation ?? 0),
    timestamp: x.timestamp ?? x.detected_at ?? x.time ?? '',
    description: x.description ?? x.message ?? '',
    resolved: Boolean(x.resolved ?? false),
    resolvedAt: x.resolved_at ?? undefined,
    sector: x.sector ?? '',
    flags: Array.isArray(x.flags) ? x.flags : [],
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rAct, rHeat, rPat, rSt, rRes] = await Promise.allSettled([
        fetch('/api/v4/anomalies/active').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/anomalies/heatmap').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/anomalies/patterns').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/anomalies/stats').then(r => r.ok ? r.json() : null),
        fetch('/api/v4/anomalies/resolved').then(r => r.ok ? r.json() : []),
      ])

      if (rAct.status === 'fulfilled') {
        const d = rAct.value
        const raw: any[] = Array.isArray(d) ? d : d.anomalies ?? d.data ?? []
        setAnomalies(raw.map(parseAnomaly))
        setErr(null)
      } else setErr('Failed to load anomalies')

      if (rHeat.status === 'fulfilled') {
        const d = rHeat.value
        const raw: any[] = Array.isArray(d) ? d : d.heatmap ?? d.cells ?? d.data ?? []
        setHeatmap(raw.map((x: any) => ({
          symbol: x.symbol ?? '',
          sector: x.sector ?? '',
          anomalyCount: Number(x.anomaly_count ?? x.count ?? 0),
          maxSeverity: (x.max_severity ?? x.severity ?? 'low') as Severity,
          maxZscore: Number(x.max_zscore ?? x.zscore ?? 0),
        })))
      }

      if (rPat.status === 'fulfilled') {
        const d = rPat.value
        const raw: any[] = Array.isArray(d) ? d : d.patterns ?? d.data ?? []
        setPatterns(raw.map((x: any) => ({
          name: x.name ?? '',
          type: x.type ?? x.pattern_type ?? '',
          symbols: Array.isArray(x.symbols) ? x.symbols : [],
          confidence: Number(x.confidence ?? 0),
          implication: x.implication ?? '',
          firstSeen: x.first_seen ?? '',
          occurrenceCount: Number(x.occurrence_count ?? x.occurrences ?? 0),
          lastSeparation: Number(x.last_separation ?? 0),
        })))
      }

      if (rSt.status === 'fulfilled' && rSt.value) {
        const x = rSt.value
        setStats({
          totalToday: Number(x.total_today ?? x.total ?? 0),
          criticalCount: Number(x.critical_count ?? 0),
          highCount: Number(x.high_count ?? 0),
          resolvedToday: Number(x.resolved_today ?? 0),
          avgZscore: Number(x.avg_zscore ?? 0),
          topType: x.top_type ?? '',
          topSymbol: x.top_symbol ?? '',
          trend: (x.trend ?? 'stable') as AnomalyStats['trend'],
          byType: Array.isArray(x.by_type) ? x.by_type : [],
          bySector: Array.isArray(x.by_sector) ? x.by_sector : [],
        })
      }

      if (rRes.status === 'fulfilled') {
        const d = rRes.value
        const raw: any[] = Array.isArray(d) ? d : d.anomalies ?? d.resolved ?? d.data ?? []
        setResolved(raw.map(parseAnomaly))
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchAll()
    pollRef.current = setInterval(fetchAll, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const filtered = anomalies.filter(a => {
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (searchQuery && !a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) && !a.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const critCount = anomalies.filter(a => a.severity === 'critical').length
  const highCount = anomalies.filter(a => a.severity === 'high').length
  const allTypes = [...new Set(anomalies.map(a => a.type))]

  const TABS = [
    { id: 'feed' as const, label: `LIVE FEED${critCount > 0 ? ` ⚠ ${critCount}` : ''}` },
    { id: 'heatmap' as const, label: 'HEATMAP' },
    { id: 'patterns' as const, label: 'PATTERNS' },
    { id: 'stats' as const, label: 'STATISTICS' },
    { id: 'resolved' as const, label: 'RESOLVED' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>ANOM</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>ANOMALY DETECTION — STATISTICAL DEVIATION MONITORING</span>
        {critCount > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700, animation: 'none' }}>⚠¡ {critCount} CRITICAL</span>}
      </div>

      {/* STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Anomalies" value={anomalies.length} col={anomalies.length > 0 ? AMBER : SUBTLE} />
        <StatCard label="Critical" value={critCount} col={RED} sub="immediate attention" />
        <StatCard label="High" value={highCount} col={ORANGE} sub="monitor closely" />
        <StatCard label="Resolved Today" value={resolved.length} col={GREEN} />
        <StatCard label="Avg Z-Score" value={anomalies.length ? (anomalies.reduce((s, a) => s + Math.abs(a.zscore), 0) / anomalies.length).toFixed(1) + 'Ïƒ' : '—'} col={AMBER} />
        <StatCard label="Patterns" value={patterns.length} col={PURPLE} />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Scanning for anomalies...</div>}

        {/* â”€â”€ LIVE FEED â”€â”€ */}
        {tab === 'feed' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
                <button key={s} onClick={() => setSevFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    color: sevFilter === s ? '#000' : TEXT, background: sevFilter === s ? AMBER : 'transparent',
                    border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                style={{ fontFamily: MONO, fontSize: 9, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', outline: 'none' }}>
                <option value="all">ALL TYPES</option>
                {allTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>)}
              </select>
              <input placeholder="Search symbol..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ fontFamily: MONO, fontSize: 10, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', outline: 'none', width: 130 }} />
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Time</Th><Th>Symbol</Th><Th>Severity</Th><Th>Type</Th>
                    <Th right>Z-Score</Th><Th right>Value</Th><Th right>Expected</Th><Th>Description</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                      {loading ? 'Scanning...' : 'No anomalies detected'}
                    </td></tr>
                  )}
                  {[...filtered].sort((a, b) => {
                    const sev: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
                    return sev[b.severity] - sev[a.severity] || Math.abs(b.zscore) - Math.abs(a.zscore)
                  }).map(a => (
                    <tr key={a.id} style={{ background: a.severity === 'critical' ? '#1a0808' : 'transparent' }}>
                      <Td mono col={SUBTLE}>{fmtTime(a.timestamp)}</Td>
                      <Td mono col={AMBER}>{a.symbol}</Td>
                      <Td><SevBadge sev={a.severity} /></Td>
                      <Td><TypeBadge type={a.type} /></Td>
                      <Td right><ZBar value={a.zscore} /></Td>
                      <Td right mono>{a.value.toFixed(4)}</Td>
                      <Td right mono col={SUBTLE}>{a.expectedValue.toFixed(4)}</Td>
                      <Td mono col={SUBTLE} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.description}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* â”€â”€ HEATMAP â”€â”€ */}
        {tab === 'heatmap' && (
          <>
            {heatmap.length === 0 ? (
              <div style={{ color: SUBTLE, fontSize: 11 }}>No heatmap data</div>
            ) : (
              <>
                {/* Group by sector */}
                {[...new Set(heatmap.map(h => h.sector || 'Unknown'))].map(sector => {
                  const cells = heatmap.filter(h => (h.sector || 'Unknown') === sector)
                  return (
                    <div key={sector} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: SUBTLE, marginBottom: 6, letterSpacing: 1 }}>{sector.toUpperCase()}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cells.map(c => {
                          const col = SEVERITY_COLOR[c.maxSeverity] || SUBTLE
                          const intensity = Math.min(1, c.anomalyCount / 5)
                          return (
                            <div key={c.symbol} title={`${c.symbol}: ${c.anomalyCount} anomalies, max z=${c.maxZscore.toFixed(1)}`}
                              style={{ width: 56, height: 40, background: col + Math.round(intensity * 220).toString(16).padStart(2, '0'),
                                border: `1px solid ${col}66`, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
                              <div style={{ fontSize: 9, color: TEXT, fontWeight: 700 }}>{c.symbol}</div>
                              <div style={{ fontSize: 8, color: col, fontFamily: MONO }}>{c.anomalyCount} Â· {c.maxZscore.toFixed(1)}Ïƒ</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* â”€â”€ PATTERNS â”€â”€ */}
        {tab === 'patterns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No patterns</div>}
            {patterns.map((p, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: 9, color: PURPLE, background: PURPLE + '22', padding: '2px 6px', borderRadius: 2 }}>{p.type}</span>
                  <span style={{ fontSize: 9, color: BLUE }}>conf: {(p.confidence * 100).toFixed(0)}%</span>
                  <span style={{ fontSize: 9, color: SUBTLE }}>{p.occurrenceCount}x since {fmtDate(p.firstSeen)}</span>
                </div>
                <div style={{ fontSize: 11, color: TEXT, marginBottom: 6 }}>{p.implication}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {p.symbols.slice(0, 8).map((s, si) => (
                    <span key={si} style={{ fontSize: 9, color: AMBER, background: AMBER + '22', padding: '2px 6px', borderRadius: 2 }}>{s}</span>
                  ))}
                  {p.symbols.length > 8 && <span style={{ fontSize: 9, color: SUBTLE }}>+{p.symbols.length - 8}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* â”€â”€ STATISTICS â”€â”€ */}
        {tab === 'stats' && (
          <>
            {!stats ? (
              <div style={{ color: SUBTLE, fontSize: 11 }}>No stats</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                  <StatCard label="Total Today" value={stats.totalToday} col={AMBER} />
                  <StatCard label="Critical" value={stats.criticalCount} col={RED} />
                  <StatCard label="Resolved Today" value={stats.resolvedToday} col={GREEN} />
                  <StatCard label="Avg Z-Score" value={stats.avgZscore.toFixed(2) + 'Ïƒ'} col={AMBER} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>BY TYPE</div>
                    {stats.byType.map(bt => (
                      <div key={bt.type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ minWidth: 130, fontSize: 9, color: TEXT }}>{bt.type.replace(/_/g, ' ')}</div>
                        <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 2 }}>
                          <div style={{ width: `${Math.min(100, (bt.count / (stats.totalToday || 1)) * 100)}%`, height: '100%', background: BLUE, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, color: SUBTLE, minWidth: 20 }}>{bt.count}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, color: SUBTLE, marginBottom: 8 }}>BY SECTOR</div>
                    {stats.bySector.map(bs => (
                      <div key={bs.sector} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ minWidth: 100, fontSize: 9, color: TEXT }}>{bs.sector}</div>
                        <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 2 }}>
                          <div style={{ width: `${Math.min(100, (bs.count / (stats.totalToday || 1)) * 100)}%`, height: '100%', background: PURPLE, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, color: SUBTLE, minWidth: 20 }}>{bs.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* â”€â”€ RESOLVED â”€â”€ */}
        {tab === 'resolved' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Detected</Th><Th>Resolved</Th><Th>Symbol</Th><Th>Severity</Th>
                  <Th>Type</Th><Th right>Z-Score</Th><Th>Description</Th>
                </tr>
              </thead>
              <tbody>
                {resolved.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>
                    No resolved anomalies
                  </td></tr>
                )}
                {resolved.map(a => (
                  <tr key={a.id}>
                    <Td mono col={SUBTLE}>{fmtTime(a.timestamp)}</Td>
                    <Td mono col={GREEN}>{fmtTime(a.resolvedAt ?? '')}</Td>
                    <Td mono col={AMBER}>{a.symbol}</Td>
                    <Td><SevBadge sev={a.severity} /></Td>
                    <Td><TypeBadge type={a.type} /></Td>
                    <Td right><ZBar value={a.zscore} /></Td>
                    <Td mono col={SUBTLE} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
