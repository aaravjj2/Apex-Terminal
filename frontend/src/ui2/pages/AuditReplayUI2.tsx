import React, { useState, useEffect, useCallback } from 'react'
﻿// AuditReplayUI2 â€” Bloomberg APEX audit replay terminal
// Audit event replay, timeline, forensic analysis, session reconstruction
// Tabs: SESSIONS | EVENTS | TIMELINE | FORENSICS | AUDIT
// APIs: /api/v4/audit-replay/sessions, /events, /timeline, /forensics, /audit

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

interface ReplaySession {
  sessionId: string
  type: 'incident' | 'audit' | 'compliance' | 'forensic'
  status: 'queued' | 'running' | 'completed' | 'failed'
  eventCount: number
  startTime: string
  endTime: string
  duration: string
  createdBy: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  anomaliesFound: number
  compressionRatio: number
}

interface ReplayEvent {
  eventId: string
  sessionId: string
  eventType: string
  actor: string
  resource: string
  action: string
  outcome: 'success' | 'failure' | 'blocked' | 'error'
  riskScore: number
  ipAddress: string
  correlationId: string
  sequenceNum: number
  timestamp: string
}

interface TimelineEntry {
  entryId: string
  sessionId: string
  timeOffset: number
  actor: string
  eventType: string
  impact: 'high' | 'medium' | 'low'
  description: string
  relatedEvents: number
  anomaly: boolean
  timestamp: string
}

interface ForensicFinding {
  findingId: string
  sessionId: string
  category: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  affectedResources: string[]
  indicators: string[]
  recommendation: string
  status: 'open' | 'investigated' | 'resolved'
}

interface ReplayAuditEntry {
  auditId: string
  sessionId: string
  action: string
  actor: string
  outcome: 'pass' | 'fail' | 'warn'
  detail: string
  timestamp: string
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
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: GREEN, info: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { queued: SUBTLE, running: BLUE, completed: GREEN, failed: RED, success: GREEN, failure: RED, blocked: ORANGE, error: RED, open: AMBER, investigated: BLUE, resolved: GREEN, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function RiskBar({ v }: { v: number }) {
  const col = v >= 80 ? RED : v >= 50 ? ORANGE : v >= 30 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(v, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{v}</span>
    </div>
  )
}


export function AuditReplayUI2() {
  const [tab, setTab] = useState<'sessions' | 'events' | 'timeline' | 'forensics' | 'audit'>('sessions')
  const [sessions, setSessions] = useState<ReplaySession[]>([])
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [forensics, setForensics] = useState<ForensicFinding[]>([])
  const [auditLog, setAuditLog] = useState<ReplayAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rE, rT, rF, rA] = await Promise.allSettled([
        fetch('/api/v4/audit-replay/sessions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/audit-replay/events').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/audit-replay/timeline').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/audit-replay/forensics').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/audit-replay/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.sessions ?? rS.value.data ?? []
        setSessions(raw.map((s: any) => ({
          sessionId: s.session_id ?? s.sessionId ?? '', type: s.type ?? 'audit',
          status: s.status ?? 'completed', eventCount: Number(s.event_count ?? s.eventCount ?? 0),
          startTime: s.start_time ?? s.startTime ?? '', endTime: s.end_time ?? s.endTime ?? '',
          duration: s.duration ?? '', createdBy: s.created_by ?? s.createdBy ?? '',
          severity: s.severity ?? 'info', anomaliesFound: Number(s.anomalies_found ?? s.anomaliesFound ?? 0),
          compressionRatio: Number(s.compression_ratio ?? s.compressionRatio ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load sessions')
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.events ?? rE.value.data ?? []
        setEvents(raw.map((e: any) => ({
          eventId: e.event_id ?? e.eventId ?? '', sessionId: e.session_id ?? e.sessionId ?? '',
          eventType: e.event_type ?? e.eventType ?? '', actor: e.actor ?? '', resource: e.resource ?? '',
          action: e.action ?? '', outcome: e.outcome ?? 'success', riskScore: Number(e.risk_score ?? e.riskScore ?? 0),
          ipAddress: e.ip_address ?? e.ipAddress ?? '', correlationId: e.correlation_id ?? e.correlationId ?? '',
          sequenceNum: Number(e.sequence_num ?? e.sequenceNum ?? 0), timestamp: e.timestamp ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.timeline ?? rT.value.data ?? []
        setTimeline(raw.map((t: any) => ({
          entryId: t.entry_id ?? t.entryId ?? '', sessionId: t.session_id ?? t.sessionId ?? '',
          timeOffset: Number(t.time_offset ?? t.timeOffset ?? 0), actor: t.actor ?? '',
          eventType: t.event_type ?? t.eventType ?? '', impact: t.impact ?? 'low',
          description: t.description ?? '', relatedEvents: Number(t.related_events ?? t.relatedEvents ?? 0),
          anomaly: Boolean(t.anomaly), timestamp: t.timestamp ?? '',
        })))
      }
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.findings ?? rF.value.data ?? []
        setForensics(raw.map((f: any) => ({
          findingId: f.finding_id ?? f.findingId ?? '', sessionId: f.session_id ?? f.sessionId ?? '',
          category: f.category ?? '', description: f.description ?? '', severity: f.severity ?? 'low',
          confidence: Number(f.confidence ?? 0),
          affectedResources: Array.isArray(f.affected_resources ?? f.affectedResources) ? (f.affected_resources ?? f.affectedResources) : [],
          indicators: Array.isArray(f.indicators) ? f.indicators : [],
          recommendation: f.recommendation ?? '', status: f.status ?? 'open',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', sessionId: a.session_id ?? a.sessionId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const totalAnomalies = sessions.reduce((s, x) => s + x.anomaliesFound, 0)
  const openFindings = forensics.filter(f => f.status === 'open').length
  const criticalFindings = forensics.filter(f => f.severity === 'critical').length
  const running = sessions.filter(s => s.status === 'running').length

  const TABS2 = [
    { id: 'sessions' as const, label: 'SESSIONS' },
    { id: 'events' as const, label: 'EVENTS' },
    { id: 'timeline' as const, label: 'TIMELINE' },
    { id: 'forensics' as const, label: 'FORENSICS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AUDIT REPLAY â€” EVENT REPLAY + TIMELINE RECONSTRUCTION + FORENSIC ANALYSIS</span>
        {running > 0 && <span style={{ fontSize: 10, color: BLUE, fontWeight: 700 }}>âš¡ {running} RUNNING</span>}
        {criticalFindings > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalFindings} CRITICAL FINDINGS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Sessions" value={sessions.length} col={BLUE} />
        <StatCard label="Events" value={events.length} col={AMBER} />
        <StatCard label="Total Anomalies" value={totalAnomalies} col={totalAnomalies > 0 ? ORANGE : GREEN} />
        <StatCard label="Open Findings" value={openFindings} col={openFindings > 0 ? RED : GREEN} />
        <StatCard label="Timeline Entries" value={timeline.length} col={PURPLE} />
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

        {tab === 'sessions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Session ID</Th><Th>Type</Th><Th>Status</Th><Th>Severity</Th><Th right>Events</Th><Th right>Anomalies</Th><Th>Duration</Th><Th>Created By</Th><Th>Start Time</Th></tr></thead>
              <tbody>
                {sessions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No sessions â€” check /api/v4/audit-replay/sessions</td></tr>}
                {sessions.sort((a, b) => {
                  const p: Record<string, number> = { running: 0, queued: 1, completed: 2, failed: 3 }
                  return (p[a.status] ?? 4) - (p[b.status] ?? 4)
                }).map((s, i) => (
                  <tr key={i} style={{ background: s.anomaliesFound > 0 ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.sessionId}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{s.type.toUpperCase()}</span></Td>
                    <Td><StatusBadge2 s={s.status} /></Td>
                    <Td><SevBadge s={s.severity} /></Td>
                    <Td right mono col={SUBTLE}>{s.eventCount.toLocaleString()}</Td>
                    <Td right mono col={s.anomaliesFound > 0 ? ORANGE : GREEN}>{s.anomaliesFound}</Td>
                    <Td mono col={SUBTLE}>{s.duration}</Td>
                    <Td mono col={TEXT}>{s.createdBy}</Td>
                    <Td mono col={SUBTLE}>{s.startTime}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'events' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th right>#</Th><Th>Event Type</Th><Th>Actor</Th><Th>Resource</Th><Th>Action</Th><Th>Outcome</Th><Th>Risk</Th><Th>IP Address</Th><Th>Correlation</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No events â€” check /api/v4/audit-replay/events</td></tr>}
                {events.sort((a, b) => a.sequenceNum - b.sequenceNum).map((e, i) => (
                  <tr key={i} style={{ background: e.outcome === 'failure' ? RED + '0a' : e.outcome === 'blocked' ? ORANGE + '0a' : 'transparent' }}>
                    <Td right mono col={SUBTLE}>{e.sequenceNum}</Td>
                    <Td mono col={PURPLE}>{e.eventType}</Td>
                    <Td mono col={TEXT}>{e.actor}</Td>
                    <Td mono col={BLUE}>{e.resource}</Td>
                    <Td mono col={ORANGE}>{e.action}</Td>
                    <Td><StatusBadge2 s={e.outcome} /></Td>
                    <Td><RiskBar v={e.riskScore} /></Td>
                    <Td mono col={SUBTLE}>{e.ipAddress}</Td>
                    <Td mono col={SUBTLE}>{e.correlationId.slice(0, 12)}{e.correlationId.length > 12 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{e.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'timeline' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th right>Offset (s)</Th><Th>Actor</Th><Th>Event Type</Th><Th>Impact</Th><Th>Anomaly</Th><Th right>Related</Th><Th>Description</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {timeline.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No timeline â€” check /api/v4/audit-replay/timeline</td></tr>}
                {timeline.sort((a, b) => a.timeOffset - b.timeOffset).map((t, i) => (
                  <tr key={i} style={{ background: t.anomaly ? RED + '0a' : 'transparent' }}>
                    <Td right mono col={SUBTLE}>{t.timeOffset.toFixed(3)}</Td>
                    <Td mono col={TEXT}>{t.actor}</Td>
                    <Td mono col={PURPLE}>{t.eventType}</Td>
                    <Td><SevBadge s={t.impact} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: t.anomaly ? RED : SUBTLE }}>{t.anomaly ? 'âš‘ ANOMALY' : 'â€”'}</span></Td>
                    <Td right mono col={t.relatedEvents > 0 ? BLUE : SUBTLE}>{t.relatedEvents}</Td>
                    <Td mono col={SUBTLE}>{t.description.slice(0, 50)}{t.description.length > 50 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{t.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'forensics' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Finding ID</Th><Th>Category</Th><Th>Severity</Th><Th right>Confidence</Th><Th>Status</Th><Th>Affected Resources</Th><Th>Description</Th><Th>Recommendation</Th></tr></thead>
              <tbody>
                {forensics.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No findings â€” check /api/v4/audit-replay/forensics</td></tr>}
                {forensics.sort((a, b) => {
                  const p: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (p[a.severity] ?? 4) - (p[b.severity] ?? 4)
                }).map((f, i) => (
                  <tr key={i} style={{ background: f.severity === 'critical' ? RED + '0a' : 'transparent', opacity: f.status === 'resolved' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{f.findingId}</Td>
                    <Td mono col={PURPLE}>{f.category}</Td>
                    <Td><SevBadge s={f.severity} /></Td>
                    <Td right mono col={f.confidence >= 80 ? GREEN : f.confidence >= 60 ? AMBER : RED}>{f.confidence.toFixed(1)}%</Td>
                    <Td><StatusBadge2 s={f.status} /></Td>
                    <Td mono col={SUBTLE}>{f.affectedResources.join(', ').slice(0, 40)}</Td>
                    <Td mono col={SUBTLE}>{f.description.slice(0, 40)}{f.description.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{f.recommendation.slice(0, 40)}{f.recommendation.length > 40 ? 'â€¦' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Session</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/audit-replay/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.sessionId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.detail || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{a.timestamp}</Td>
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
