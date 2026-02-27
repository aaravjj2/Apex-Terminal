import React, { useState, useEffect, useCallback } from 'react'
﻿// ExtObservabilityUI2 â€” Bloomberg EXOB extension observability terminal
// Distributed traces, performance metrics, logs, dependency map, alerts
// Tabs: TRACES | METRICS | LOGS | DEPENDENCIES | ALERTS
// APIs: /api/v4/ext-observability/traces, /metrics, /logs, /dependencies, /alerts

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

interface TraceEntry {
  traceId: string
  extensionId: string
  operationName: string
  status: 'ok' | 'error' | 'timeout' | 'slow'
  durationMs: number
  startTime: string
  spans: number
  errorsInTrace: number
  userImpact: boolean
  rootCause: string
  service: string
}

interface MetricEntry {
  metricId: string
  extensionId: string
  metricName: string
  value: number
  unit: string
  p50: number
  p95: number
  p99: number
  trend: 'up' | 'down' | 'stable'
  threshold: number
  breached: boolean
  interval: string
}

interface LogEntry {
  logId: string
  extensionId: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  timestamp: string
  service: string
  traceId: string
  metadata: string
  count: number
}

interface DependencyEntry {
  depId: string
  extensionId: string
  dependsOn: string
  depType: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  latencyMs: number
  errorRate: number
  version: string
  critical: boolean
  lastChecked: string
}

interface ObsAlert {
  alertId: string
  extensionId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  alertType: string
  message: string
  triggeredAt: string
  resolvedAt: string
  acknowledged: boolean
  sloViolation: boolean
  affectedUsers: number
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{children}</td>
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
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { ok: GREEN, error: RED, timeout: ORANGE, slow: AMBER, healthy: GREEN, degraded: AMBER, down: RED, unknown: SUBTLE, critical: RED, high: ORANGE, medium: AMBER, low: BLUE, error2: RED, warn: AMBER, info: BLUE, debug: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function TrendArrow({ t }: { t: string }) {
  if (t === 'up') return <span style={{ color: RED, fontFamily: MONO, fontSize: 10 }}>â–²</span>
  if (t === 'down') return <span style={{ color: GREEN, fontFamily: MONO, fontSize: 10 }}>â–¼</span>
  return <span style={{ color: SUBTLE, fontFamily: MONO, fontSize: 10 }}>â†’</span>
}
function LatBar({ val, max }: { val: number; max: number }) {
  const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0
  const col = val > max * 0.8 ? RED : val > max * 0.5 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{val}ms</span>
    </div>
  )
}


export function ExtObservabilityUI2() {
  const [tab, setTab] = useState<'traces' | 'metrics' | 'logs' | 'dependencies' | 'alerts'>('traces')
  const [traces, setTraces] = useState<TraceEntry[]>([])
  const [metrics, setMetrics] = useState<MetricEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [deps, setDeps] = useState<DependencyEntry[]>([])
  const [alerts, setAlerts] = useState<ObsAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rT, rM, rL, rD, rA] = await Promise.allSettled([
        fetch('/api/v4/ext-observability/traces').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ext-observability/metrics').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ext-observability/logs').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ext-observability/dependencies').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ext-observability/alerts').then(r => r.ok ? r.json() : []),
      ])
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.traces ?? rT.value.data ?? []
        setTraces(raw.map((t: any) => ({
          traceId: t.trace_id ?? t.traceId ?? '', extensionId: t.extension_id ?? t.extensionId ?? '',
          operationName: t.operation_name ?? t.operationName ?? '', status: t.status ?? 'ok',
          durationMs: Number(t.duration_ms ?? t.durationMs ?? 0), startTime: t.start_time ?? t.startTime ?? '',
          spans: Number(t.spans ?? 0), errorsInTrace: Number(t.errors_in_trace ?? t.errorsInTrace ?? 0),
          userImpact: Boolean(t.user_impact ?? t.userImpact ?? false), rootCause: t.root_cause ?? t.rootCause ?? '',
          service: t.service ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load traces')
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.metrics ?? rM.value.data ?? []
        setMetrics(raw.map((m: any) => ({
          metricId: m.metric_id ?? m.metricId ?? '', extensionId: m.extension_id ?? m.extensionId ?? '',
          metricName: m.metric_name ?? m.metricName ?? '', value: Number(m.value ?? 0), unit: m.unit ?? '',
          p50: Number(m.p50 ?? 0), p95: Number(m.p95 ?? 0), p99: Number(m.p99 ?? 0),
          trend: m.trend ?? 'stable', threshold: Number(m.threshold ?? 0), breached: Boolean(m.breached ?? false),
          interval: m.interval ?? '',
        })))
      }
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.logs ?? rL.value.data ?? []
        setLogs(raw.map((l: any) => ({
          logId: l.log_id ?? l.logId ?? '', extensionId: l.extension_id ?? l.extensionId ?? '',
          level: l.level ?? 'info', message: l.message ?? '', timestamp: l.timestamp ?? '',
          service: l.service ?? '', traceId: l.trace_id ?? l.traceId ?? '',
          metadata: l.metadata ?? '', count: Number(l.count ?? 1),
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.dependencies ?? rD.value.data ?? []
        setDeps(raw.map((d: any) => ({
          depId: d.dep_id ?? d.depId ?? '', extensionId: d.extension_id ?? d.extensionId ?? '',
          dependsOn: d.depends_on ?? d.dependsOn ?? '', depType: d.dep_type ?? d.depType ?? '',
          status: d.status ?? 'unknown', latencyMs: Number(d.latency_ms ?? d.latencyMs ?? 0),
          errorRate: Number(d.error_rate ?? d.errorRate ?? 0), version: d.version ?? '',
          critical: Boolean(d.critical ?? false), lastChecked: d.last_checked ?? d.lastChecked ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.alerts ?? rA.value.data ?? []
        setAlerts(raw.map((a: any) => ({
          alertId: a.alert_id ?? a.alertId ?? '', extensionId: a.extension_id ?? a.extensionId ?? '',
          severity: a.severity ?? 'medium', alertType: a.alert_type ?? a.alertType ?? '',
          message: a.message ?? '', triggeredAt: a.triggered_at ?? a.triggeredAt ?? '',
          resolvedAt: a.resolved_at ?? a.resolvedAt ?? '', acknowledged: Boolean(a.acknowledged ?? false),
          sloViolation: Boolean(a.slo_violation ?? a.sloViolation ?? false),
          affectedUsers: Number(a.affected_users ?? a.affectedUsers ?? 0),
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const errorTraces = traces.filter(t => t.status === 'error').length
  const breachedMetrics = metrics.filter(m => m.breached).length
  const errorLogs = logs.filter(l => l.level === 'error').length
  const downDeps = deps.filter(d => d.status === 'down').length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length

  const TABS2 = [
    { id: 'traces' as const, label: 'TRACES' },
    { id: 'metrics' as const, label: 'METRICS' },
    { id: 'logs' as const, label: 'LOGS' },
    { id: 'dependencies' as const, label: 'DEPENDENCIES' },
    { id: 'alerts' as const, label: 'ALERTS' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>EXOB</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EXT OBSERVABILITY â€” TRACES + PERFORMANCE METRICS + LOGS + DEPENDENCY HEALTH + ALERTS</span>
        {criticalAlerts > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalAlerts} CRITICAL ALERTS</span>}
        {downDeps > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {downDeps} DEPS DOWN</span>}
        {errorTraces > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {errorTraces} TRACE ERRORS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Traces" value={traces.length} col={BLUE} />
        <StatCard label="Trace Errors" value={errorTraces} col={errorTraces > 0 ? RED : GREEN} />
        <StatCard label="Metrics Breached" value={breachedMetrics} col={breachedMetrics > 0 ? ORANGE : GREEN} />
        <StatCard label="Error Logs" value={errorLogs} col={errorLogs > 0 ? RED : SUBTLE} />
        <StatCard label="Deps Down" value={downDeps} col={downDeps > 0 ? RED : GREEN} />
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS2.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE, background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`, padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {tab === 'traces' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Trace ID</Th><Th>Extension</Th><Th>Operation</Th><Th>Service</Th><Th>Status</Th><Th right>Duration</Th><Th right>Spans</Th><Th right>Errors</Th><Th>User Impact</Th><Th>Start</Th></tr></thead>
              <tbody>
                {traces.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No traces â€” check /api/v4/ext-observability/traces</td></tr>}
                {traces.sort((a, b) => {
                  const ord: Record<string, number> = { error: 0, timeout: 1, slow: 2, ok: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((t, i) => (
                  <tr key={i} style={{ background: t.status === 'error' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{t.traceId.slice(0, 12)}â€¦</Td>
                    <Td mono col={BLUE}>{t.extensionId}</Td>
                    <Td mono col={TEXT}>{t.operationName}</Td>
                    <Td mono col={SUBTLE}>{t.service}</Td>
                    <Td><StatusBadge2 s={t.status} /></Td>
                    <Td right mono col={t.durationMs > 1000 ? RED : t.durationMs > 500 ? AMBER : GREEN}>{t.durationMs}ms</Td>
                    <Td right mono col={SUBTLE}>{t.spans}</Td>
                    <Td right mono col={t.errorsInTrace > 0 ? RED : GREEN}>{t.errorsInTrace}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: t.userImpact ? RED : SUBTLE }}>{t.userImpact ? 'âš‘ YES' : 'NO'}</span></Td>
                    <Td mono col={SUBTLE}>{t.startTime}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'metrics' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Extension</Th><Th>Metric</Th><Th>Trend</Th><Th right>Value</Th><Th right>Threshold</Th><Th right>P50</Th><Th right>P95</Th><Th right>P99</Th><Th>Breached</Th><Th>Interval</Th></tr></thead>
              <tbody>
                {metrics.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No metrics â€” check /api/v4/ext-observability/metrics</td></tr>}
                {metrics.sort((a, b) => Number(b.breached) - Number(a.breached)).map((m, i) => (
                  <tr key={i} style={{ background: m.breached ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.extensionId}</Td>
                    <Td mono col={BLUE}>{m.metricName}</Td>
                    <Td><TrendArrow t={m.trend} /></Td>
                    <Td right mono col={m.breached ? RED : GREEN}>{m.value.toFixed(2)} <span style={{ color: SUBTLE, fontSize: 9 }}>{m.unit}</span></Td>
                    <Td right mono col={SUBTLE}>{m.threshold.toFixed(2)}</Td>
                    <Td right mono col={SUBTLE}>{m.p50.toFixed(2)}</Td>
                    <Td right mono col={SUBTLE}>{m.p95.toFixed(2)}</Td>
                    <Td right mono col={m.p99 > m.threshold ? RED : SUBTLE}>{m.p99.toFixed(2)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: m.breached ? RED : GREEN }}>{m.breached ? 'BREACHED' : 'OK'}</span></Td>
                    <Td mono col={SUBTLE}>{m.interval}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'logs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Level</Th><Th>Extension</Th><Th>Service</Th><Th>Message</Th><Th right>Count</Th><Th>Trace ID</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No logs â€” check /api/v4/ext-observability/logs</td></tr>}
                {logs.sort((a, b) => {
                  const ord: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 }
                  return (ord[a.level] ?? 4) - (ord[b.level] ?? 4)
                }).map((l, i) => (
                  <tr key={i} style={{ background: l.level === 'error' ? RED + '08' : 'transparent' }}>
                    <Td><StatusBadge2 s={l.level} /></Td>
                    <Td mono col={AMBER}>{l.extensionId}</Td>
                    <Td mono col={BLUE}>{l.service}</Td>
                    <Td mono col={l.level === 'error' ? RED : TEXT} style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{l.message}</Td>
                    <Td right mono col={l.count > 10 ? ORANGE : SUBTLE}>{l.count.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{l.traceId ? l.traceId.slice(0, 10) + 'â€¦' : 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{l.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'dependencies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Extension</Th><Th>Depends On</Th><Th>Type</Th><Th>Status</Th><Th>Latency</Th><Th right>Error Rate %</Th><Th>Version</Th><Th>Critical</Th><Th>Last Checked</Th></tr></thead>
              <tbody>
                {deps.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No dependencies â€” check /api/v4/ext-observability/dependencies</td></tr>}
                {deps.sort((a, b) => {
                  const ord: Record<string, number> = { down: 0, degraded: 1, unknown: 2, healthy: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((d, i) => (
                  <tr key={i} style={{ background: d.status === 'down' ? RED + '0a' : d.status === 'degraded' ? AMBER + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{d.extensionId}</Td>
                    <Td mono col={BLUE}>{d.dependsOn}</Td>
                    <Td mono col={PURPLE}>{d.depType}</Td>
                    <Td><StatusBadge2 s={d.status} /></Td>
                    <Td><LatBar val={d.latencyMs} max={500} /></Td>
                    <Td right mono col={d.errorRate > 5 ? RED : d.errorRate > 1 ? AMBER : GREEN}>{d.errorRate.toFixed(2)}%</Td>
                    <Td mono col={SUBTLE}>{d.version || 'â€”'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: d.critical ? RED : SUBTLE }}>{d.critical ? 'âš‘ CRITICAL' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{d.lastChecked}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'alerts' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Alert ID</Th><Th>Extension</Th><Th>Severity</Th><Th>Type</Th><Th>Message</Th><Th right>Affected Users</Th><Th>SLO Violation</Th><Th>Acked</Th><Th>Resolved</Th><Th>Triggered</Th></tr></thead>
              <tbody>
                {alerts.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No alerts â€” check /api/v4/ext-observability/alerts</td></tr>}
                {alerts.sort((a, b) => {
                  const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (ord[a.severity] ?? 4) - (ord[b.severity] ?? 4)
                }).map((a, i) => (
                  <tr key={i} style={{ background: a.severity === 'critical' && !a.acknowledged ? RED + '0a' : 'transparent', opacity: a.acknowledged ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{a.alertId}</Td>
                    <Td mono col={BLUE}>{a.extensionId}</Td>
                    <Td><StatusBadge2 s={a.severity} /></Td>
                    <Td mono col={ORANGE}>{a.alertType}</Td>
                    <Td mono col={TEXT} style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{a.message}</Td>
                    <Td right mono col={a.affectedUsers > 100 ? RED : a.affectedUsers > 10 ? AMBER : SUBTLE}>{a.affectedUsers.toLocaleString()}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.sloViolation ? RED : SUBTLE }}>{a.sloViolation ? 'âš‘ YES' : 'NO'}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.acknowledged ? GREEN : RED }}>{a.acknowledged ? 'ACKED' : 'OPEN'}</span></Td>
                    <Td mono col={a.resolvedAt ? GREEN : SUBTLE}>{a.resolvedAt || 'ACTIVE'}</Td>
                    <Td mono col={SUBTLE}>{a.triggeredAt}</Td>
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
