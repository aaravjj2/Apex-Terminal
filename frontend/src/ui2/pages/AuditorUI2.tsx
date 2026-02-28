import React, { useState, useEffect, useCallback } from 'react'
﻿// AuditorUI2 â€” Bloomberg APEX Audit Log Viewer terminal
// ES audit trail, event filtering, compliance export, anomaly detection
// Tabs: EVENTS | ANOMALIES | COMPLIANCE | EXPORT | STATS
// APIs: /api/v3/audit/events, /anomalies, /compliance, /export, /stats

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

interface AuditEvent {
  eventId: string
  eventType: string
  source: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  actor: string
  resource: string
  action: string
  outcome: 'success' | 'failure' | 'partial' | 'denied'
  ipAddress: string
  message: string
  metadata: Record<string, unknown>
  timestamp: string
  correlationId: string
}

interface AuditAnomaly {
  anomalyId: string
  eventType: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'investigating' | 'resolved' | 'false_positive'
  count: number
  firstSeen: string
  lastSeen: string
  pattern: string
}

interface ComplianceFrame {
  framework: string
  period: string
  status: 'compliant' | 'partial' | 'non_compliant' | 'pending_review'
  coveredEvents: number
  totalRequired: number
  gapCount: number
  lastAuditDate: string
  nextReview: string
}

interface AuditStat {
  label: string
  value: number
  change: number
  period: string
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
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE, info: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function OutcomeBadge({ o }: { o: string }) {
  const m: Record<string, string> = { success: GREEN, failure: RED, partial: AMBER, denied: ORANGE }
  const c = m[o] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{o.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { open: RED, investigating: AMBER, resolved: GREEN, false_positive: SUBTLE, compliant: GREEN, partial: AMBER, non_compliant: RED, pending_review: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}


export function AuditorUI2() {
  const [tab, setTab] = useState<'events' | 'anomalies' | 'compliance' | 'export' | 'stats'>('events')
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [anomalies, setAnomalies] = useState<AuditAnomaly[]>([])
  const [compliance, setCompliance] = useState<ComplianceFrame[]>([])
  const [stats, setStats] = useState<AuditStat[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [exportStatus, setExportStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  const fetchAll = useCallback(async () => {
    try {
      const [rE, rA, rC, rS] = await Promise.allSettled([
        fetch('/api/v3/audit/events').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/audit/anomalies').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/audit/compliance').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/audit/stats').then(r => r.ok ? r.json() : []),
      ])
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.events ?? rE.value.data ?? []
        setEvents(raw.map((e: any) => ({
          eventId: e.event_id ?? e.eventId ?? e.id ?? '',
          eventType: e.event_type ?? e.eventType ?? '',
          source: e.source ?? '', severity: e.severity ?? 'info',
          actor: e.actor ?? '', resource: e.resource ?? '',
          action: e.action ?? '', outcome: e.outcome ?? 'success',
          ipAddress: e.ip_address ?? e.ipAddress ?? '',
          message: e.message ?? '', metadata: e.metadata ?? {},
          timestamp: e.timestamp ?? '', correlationId: e.correlation_id ?? e.correlationId ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load audit events')
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.anomalies ?? rA.value.data ?? []
        setAnomalies(raw.map((a: any) => ({
          anomalyId: a.anomaly_id ?? a.anomalyId ?? '',
          eventType: a.event_type ?? a.eventType ?? '',
          description: a.description ?? '', severity: a.severity ?? 'medium',
          status: a.status ?? 'open', count: Number(a.count ?? 0),
          firstSeen: a.first_seen ?? a.firstSeen ?? '', lastSeen: a.last_seen ?? a.lastSeen ?? '',
          pattern: a.pattern ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.frameworks ?? rC.value.data ?? []
        setCompliance(raw.map((c: any) => ({
          framework: c.framework ?? '', period: c.period ?? '',
          status: c.status ?? 'pending_review',
          coveredEvents: Number(c.covered_events ?? c.coveredEvents ?? 0),
          totalRequired: Number(c.total_required ?? c.totalRequired ?? 0),
          gapCount: Number(c.gap_count ?? c.gapCount ?? 0),
          lastAuditDate: c.last_audit_date ?? c.lastAuditDate ?? '',
          nextReview: c.next_review ?? c.nextReview ?? '',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.stats ?? rS.value.data ?? []
        setStats(raw.map((s: any) => ({
          label: s.label ?? '', value: Number(s.value ?? 0),
          change: Number(s.change ?? 0), period: s.period ?? '24h',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const handleExport = useCallback(async () => {
    setExportStatus('running')
    try {
      const r = await fetch('/api/v3/audit/export', { method: 'POST' })
      if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'audit-export.csv'; a.click(); setExportStatus('done') }
      else setExportStatus('error')
    } catch { setExportStatus('error') }
    finally { setTimeout(() => setExportStatus('idle'), 4000) }
  }, [])

  const criticalEvents = events.filter(e => e.severity === 'critical').length
  const failedEvents = events.filter(e => e.outcome === 'failure' || e.outcome === 'denied').length
  const openAnomalies = anomalies.filter(a => a.status === 'open').length
  const nonCompliant = compliance.filter(c => c.status === 'non_compliant').length
  const filtered = events.filter(e => !filter || e.eventType.toLowerCase().includes(filter.toLowerCase()) || e.actor.toLowerCase().includes(filter.toLowerCase()) || e.message.toLowerCase().includes(filter.toLowerCase()))

  const TABS2 = [
    { id: 'events' as const, label: 'EVENTS' },
    { id: 'anomalies' as const, label: 'ANOMALIES' },
    { id: 'compliance' as const, label: 'COMPLIANCE' },
    { id: 'export' as const, label: 'EXPORT' },
    { id: 'stats' as const, label: 'STATS' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AUDIT LOG VIEWER â€” ES AUDIT TRAIL + ANOMALY DETECTION + COMPLIANCE EXPORT</span>
        {criticalEvents > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalEvents} CRITICAL</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Events" value={events.length} col={BLUE} />
        <StatCard label="Critical" value={criticalEvents} col={criticalEvents > 0 ? RED : GREEN} />
        <StatCard label="Failures/Denied" value={failedEvents} col={failedEvents > 0 ? ORANGE : GREEN} />
        <StatCard label="Open Anomalies" value={openAnomalies} col={openAnomalies > 0 ? RED : GREEN} />
        <StatCard label="Non-Compliant" value={nonCompliant} col={nonCompliant > 0 ? RED : GREEN} />
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
        {tab === 'events' && (
          <div>
            <div style={{ marginBottom: 8 }}>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by type / actor / messageâ€¦"
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, padding: '5px 10px', width: 320 }} />
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Event ID</Th><Th>Type</Th><Th>Actor</Th><Th>Resource</Th><Th>Sev.</Th><Th>Outcome</Th><Th>IP</Th><Th>Message</Th><Th>Timestamp</Th></tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit events â€” check /api/v3/audit/events</td></tr>}
                  {filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 300).map((e, i) => (
                    <tr key={i} style={{ background: e.severity === 'critical' ? RED + '0a' : 'transparent' }}>
                      <Td mono col={AMBER}>{e.eventId.slice(0, 12)}â€¦</Td>
                      <Td mono col={BLUE}>{e.eventType}</Td>
                      <Td mono col={TEXT}>{e.actor || 'â€”'}</Td>
                      <Td mono col={SUBTLE}>{(e.resource || '').slice(0, 30)}</Td>
                      <Td><SevBadge s={e.severity} /></Td>
                      <Td><OutcomeBadge o={e.outcome} /></Td>
                      <Td mono col={SUBTLE}>{e.ipAddress || 'â€”'}</Td>
                      <Td mono col={TEXT}>{(e.message || '').slice(0, 50)}{(e.message || '').length > 50 ? 'â€¦' : ''}</Td>
                      <Td mono col={SUBTLE}>{e.timestamp}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'anomalies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Anomaly ID</Th><Th>Event Type</Th><Th>Description</Th><Th>Severity</Th><Th>Status</Th><Th right>Count</Th><Th>Pattern</Th><Th>First Seen</Th><Th>Last Seen</Th></tr></thead>
              <tbody>
                {anomalies.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No anomalies â€” check /api/v3/audit/anomalies</td></tr>}
                {anomalies.sort((a, b) => a.status === 'open' ? -1 : 0).map((a, i) => (
                  <tr key={i} style={{ background: a.severity === 'critical' && a.status === 'open' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.anomalyId}</Td>
                    <Td mono col={BLUE}>{a.eventType}</Td>
                    <Td mono col={TEXT}>{a.description.slice(0, 45)}{a.description.length > 45 ? 'â€¦' : ''}</Td>
                    <Td><SevBadge s={a.severity} /></Td>
                    <Td><StatusBadge s={a.status} /></Td>
                    <Td right mono col={TEXT}>{a.count}</Td>
                    <Td mono col={SUBTLE}>{a.pattern || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.firstSeen || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.lastSeen || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'compliance' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Framework</Th><Th>Period</Th><Th>Status</Th><Th right>Covered</Th><Th right>Required</Th><Th right>Gaps</Th><Th>Last Audit</Th><Th>Next Review</Th></tr></thead>
              <tbody>
                {compliance.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No compliance data â€” check /api/v3/audit/compliance</td></tr>}
                {compliance.map((c, i) => (
                  <tr key={i} style={{ background: c.status === 'non_compliant' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.framework}</Td>
                    <Td mono col={TEXT}>{c.period}</Td>
                    <Td><StatusBadge s={c.status} /></Td>
                    <Td right mono col={GREEN}>{c.coveredEvents.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{c.totalRequired.toLocaleString()}</Td>
                    <Td right mono col={c.gapCount > 0 ? RED : GREEN}>{c.gapCount}</Td>
                    <Td mono col={SUBTLE}>{c.lastAuditDate || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{c.nextReview || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 20 }}>
              <div style={{ fontSize: 12, color: TEXT, marginBottom: 12 }}>Export audit event log as CSV. Includes all event metadata, actor info, correlation IDs.</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={handleExport} disabled={exportStatus === 'running'}
                  style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 3, padding: '7px 18px', cursor: exportStatus === 'running' ? 'wait' : 'pointer' }}>
                  {exportStatus === 'running' ? 'EXPORTINGâ€¦' : exportStatus === 'done' ? 'EXPORTED âœ“' : exportStatus === 'error' ? 'ERROR â€” RETRY' : 'EXPORT CSV'}
                </button>
                <span style={{ fontSize: 10, color: SUBTLE }}>{events.length} events ready</span>
              </div>
            </div>
          </div>
        )}
        {tab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {stats.length === 0 && <div style={{ gridColumn: '1/-1', padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No stats â€” check /api/v3/audit/stats</div>}
            {stats.map((s, i) => (
              <StatCard key={i} label={s.label} value={s.value.toLocaleString()} sub={`${s.change >= 0 ? '+' : ''}${s.change.toLocaleString()} vs ${s.period}`} col={s.change < 0 ? GREEN : BLUE} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
