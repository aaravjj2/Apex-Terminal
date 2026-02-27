import React, { useState, useEffect, useCallback } from 'react'
﻿// IncidentAiUI2 â€” Bloomberg INAI incident-aware AI fallback terminal
// Active incidents, fallback states, recovery workflows, postmortems, audit
// Tabs: INCIDENTS | FALLBACKS | RECOVERY | POSTMORTEM | AUDIT
// APIs: /api/v4/incident-ai/incidents, /fallbacks, /recovery, /postmortem, /audit

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

interface IncidentRecord {
  incidentId: string
  title: string
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4'
  status: 'open' | 'mitigated' | 'resolved' | 'monitoring'
  impactedService: string
  affectedUsers: number
  startTime: string
  detectedBy: string
  owner: string
  mttrMinutes: number
  aiTriggered: boolean
  autoFallback: boolean
}

interface FallbackState {
  fallbackId: string
  service: string
  triggerReason: string
  fallbackMode: string
  activatedAt: string
  deactivatedAt: string
  status: 'active' | 'inactive' | 'testing'
  degradedCapabilities: string[]
  fallbackLatencyMs: number
  successRate: number
  incidentRef: string
}

interface RecoveryTask {
  taskId: string
  incidentId: string
  title: string
  status: 'pending' | 'in-progress' | 'done' | 'blocked'
  assignedTo: string
  priority: 'p1' | 'p2' | 'p3'
  dueAt: string
  automationAvailable: boolean
  recoveryScriptRef: string
  completedAt: string
}

interface Postmortem {
  pmId: string
  incidentId: string
  title: string
  severity: string
  status: 'draft' | 'review' | 'published'
  author: string
  rootCause: string
  impactSummary: string
  actionItems: number
  openActionItems: number
  publishedAt: string
  followUpDate: string
}

interface IncidentAuditEntry {
  auditId: string
  incidentId: string
  action: string
  actor: string
  automated: boolean
  outcome: 'success' | 'failure' | 'partial'
  details: string
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
  const m: Record<string, string> = { sev1: RED, sev2: ORANGE, sev3: AMBER, sev4: BLUE }
  const c = m[s.toLowerCase()] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { open: RED, mitigated: AMBER, resolved: GREEN, monitoring: BLUE, active: RED, inactive: SUBTLE, testing: PURPLE, pending: AMBER, 'in-progress': BLUE, done: GREEN, blocked: RED, draft: SUBTLE, review: AMBER, published: GREEN, success: GREEN, failure: RED, partial: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function IncidentAiUI2() {
  const [tab, setTab] = useState<'incidents' | 'fallbacks' | 'recovery' | 'postmortem' | 'audit'>('incidents')
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [fallbacks, setFallbacks] = useState<FallbackState[]>([])
  const [recovery, setRecovery] = useState<RecoveryTask[]>([])
  const [postmortem, setPostmortem] = useState<Postmortem[]>([])
  const [auditLog, setAuditLog] = useState<IncidentAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rI, rF, rR, rP, rA] = await Promise.allSettled([
        fetch('/api/v4/incident-ai/incidents').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-ai/fallbacks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-ai/recovery').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-ai/postmortem').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-ai/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.incidents ?? rI.value.data ?? []
        setIncidents(raw.map((i: any) => ({
          incidentId: i.incident_id ?? i.incidentId ?? '', title: i.title ?? '',
          severity: i.severity ?? 'sev3', status: i.status ?? 'open',
          impactedService: i.impacted_service ?? i.impactedService ?? '',
          affectedUsers: Number(i.affected_users ?? i.affectedUsers ?? 0),
          startTime: i.start_time ?? i.startTime ?? '', detectedBy: i.detected_by ?? i.detectedBy ?? '',
          owner: i.owner ?? '', mttrMinutes: Number(i.mttr_minutes ?? i.mttrMinutes ?? 0),
          aiTriggered: Boolean(i.ai_triggered ?? i.aiTriggered ?? false),
          autoFallback: Boolean(i.auto_fallback ?? i.autoFallback ?? false),
        })))
        setErr(null)
      } else setErr('Failed to load incidents')
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.fallbacks ?? rF.value.data ?? []
        setFallbacks(raw.map((f: any) => ({
          fallbackId: f.fallback_id ?? f.fallbackId ?? '', service: f.service ?? '',
          triggerReason: f.trigger_reason ?? f.triggerReason ?? '', fallbackMode: f.fallback_mode ?? f.fallbackMode ?? '',
          activatedAt: f.activated_at ?? f.activatedAt ?? '', deactivatedAt: f.deactivated_at ?? f.deactivatedAt ?? '',
          status: f.status ?? 'inactive', degradedCapabilities: Array.isArray(f.degraded_capabilities ?? f.degradedCapabilities) ? (f.degraded_capabilities ?? f.degradedCapabilities) : [],
          fallbackLatencyMs: Number(f.fallback_latency_ms ?? f.fallbackLatencyMs ?? 0),
          successRate: Number(f.success_rate ?? f.successRate ?? 0), incidentRef: f.incident_ref ?? f.incidentRef ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.recovery ?? rR.value.data ?? []
        setRecovery(raw.map((r: any) => ({
          taskId: r.task_id ?? r.taskId ?? '', incidentId: r.incident_id ?? r.incidentId ?? '',
          title: r.title ?? '', status: r.status ?? 'pending', assignedTo: r.assigned_to ?? r.assignedTo ?? '',
          priority: r.priority ?? 'p2', dueAt: r.due_at ?? r.dueAt ?? '',
          automationAvailable: Boolean(r.automation_available ?? r.automationAvailable ?? false),
          recoveryScriptRef: r.recovery_script_ref ?? r.recoveryScriptRef ?? '', completedAt: r.completed_at ?? r.completedAt ?? '',
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.postmortems ?? rP.value.data ?? []
        setPostmortem(raw.map((p: any) => ({
          pmId: p.pm_id ?? p.pmId ?? '', incidentId: p.incident_id ?? p.incidentId ?? '',
          title: p.title ?? '', severity: p.severity ?? '', status: p.status ?? 'draft',
          author: p.author ?? '', rootCause: p.root_cause ?? p.rootCause ?? '',
          impactSummary: p.impact_summary ?? p.impactSummary ?? '',
          actionItems: Number(p.action_items ?? p.actionItems ?? 0),
          openActionItems: Number(p.open_action_items ?? p.openActionItems ?? 0),
          publishedAt: p.published_at ?? p.publishedAt ?? '', followUpDate: p.follow_up_date ?? p.followUpDate ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', incidentId: a.incident_id ?? a.incidentId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', automated: Boolean(a.automated ?? false),
          outcome: a.outcome ?? 'success', details: a.details ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const openIncidents = incidents.filter(i => i.status === 'open').length
  const sev1Count = incidents.filter(i => i.severity === 'sev1').length
  const activeFallbacks = fallbacks.filter(f => f.status === 'active').length
  const blockedTasks = recovery.filter(r => r.status === 'blocked').length
  const openPMs = postmortem.filter(p => p.status !== 'published').length

  const TABS2 = [
    { id: 'incidents' as const, label: 'INCIDENTS' },
    { id: 'fallbacks' as const, label: 'FALLBACKS' },
    { id: 'recovery' as const, label: 'RECOVERY' },
    { id: 'postmortem' as const, label: 'POSTMORTEM' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>INAI</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>INCIDENT AI â€” ACTIVE INCIDENTS + AI FALLBACK STATES + RECOVERY + POSTMORTEM</span>
        {sev1Count > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {sev1Count} SEV1 ACTIVE</span>}
        {activeFallbacks > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {activeFallbacks} FALLBACKS ACTIVE</span>}
        {blockedTasks > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {blockedTasks} RECOVERY BLOCKED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Open Incidents" value={openIncidents} col={openIncidents > 0 ? RED : GREEN} />
        <StatCard label="SEV1" value={sev1Count} col={sev1Count > 0 ? RED : SUBTLE} />
        <StatCard label="Active Fallbacks" value={activeFallbacks} col={activeFallbacks > 0 ? ORANGE : SUBTLE} />
        <StatCard label="Recovery Blocked" value={blockedTasks} col={blockedTasks > 0 ? AMBER : SUBTLE} />
        <StatCard label="Open Postmortems" value={openPMs} col={openPMs > 0 ? BLUE : SUBTLE} />
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

        {tab === 'incidents' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Incident ID</Th><Th>Title</Th><Th>Severity</Th><Th>Status</Th><Th>Service</Th><Th right>Affected Users</Th><Th>Owner</Th><Th right>MTTR (min)</Th><Th>AI</Th><Th>Start</Th></tr></thead>
              <tbody>
                {incidents.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No incidents â€” check /api/v4/incident-ai/incidents</td></tr>}
                {incidents.sort((a, b) => {
                  const ord: Record<string, number> = { sev1: 0, sev2: 1, sev3: 2, sev4: 3 }
                  return (ord[a.severity] ?? 4) - (ord[b.severity] ?? 4)
                }).map((i, idx) => (
                  <tr key={idx} style={{ background: i.severity === 'sev1' && i.status === 'open' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{i.incidentId}</Td>
                    <Td mono col={TEXT}>{i.title}</Td>
                    <Td><SevBadge s={i.severity} /></Td>
                    <Td><StatusBadge2 s={i.status} /></Td>
                    <Td mono col={BLUE}>{i.impactedService}</Td>
                    <Td right mono col={i.affectedUsers > 1000 ? RED : i.affectedUsers > 100 ? AMBER : SUBTLE}>{i.affectedUsers.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{i.owner}</Td>
                    <Td right mono col={i.mttrMinutes > 60 ? RED : i.mttrMinutes > 30 ? AMBER : GREEN}>{i.mttrMinutes}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: i.aiTriggered ? PURPLE : SUBTLE }}>{i.aiTriggered ? 'AI' : 'â€”'}</span></Td>
                    <Td mono col={SUBTLE}>{i.startTime}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'fallbacks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Fallback ID</Th><Th>Service</Th><Th>Mode</Th><Th>Status</Th><Th>Trigger</Th><Th right>Latency (ms)</Th><Th right>Success %</Th><Th>Incident</Th><Th>Activated</Th></tr></thead>
              <tbody>
                {fallbacks.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No fallbacks â€” check /api/v4/incident-ai/fallbacks</td></tr>}
                {fallbacks.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')).map((f, i) => (
                  <tr key={i} style={{ background: f.status === 'active' ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{f.fallbackId}</Td>
                    <Td mono col={BLUE}>{f.service}</Td>
                    <Td mono col={PURPLE}>{f.fallbackMode}</Td>
                    <Td><StatusBadge2 s={f.status} /></Td>
                    <Td mono col={SUBTLE}>{f.triggerReason}</Td>
                    <Td right mono col={f.fallbackLatencyMs > 500 ? ORANGE : SUBTLE}>{f.fallbackLatencyMs}</Td>
                    <Td right mono col={f.successRate < 90 ? RED : f.successRate < 99 ? AMBER : GREEN}>{f.successRate.toFixed(1)}%</Td>
                    <Td mono col={BLUE}>{f.incidentRef || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{f.activatedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'recovery' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Task ID</Th><Th>Incident</Th><Th>Title</Th><Th>Priority</Th><Th>Status</Th><Th>Assigned</Th><Th>Automation</Th><Th>Due</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {recovery.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No recovery tasks â€” check /api/v4/incident-ai/recovery</td></tr>}
                {recovery.sort((a, b) => {
                  const ord: Record<string, number> = { blocked: 0, pending: 1, 'in-progress': 2, done: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'blocked' ? RED + '0a' : 'transparent', opacity: r.status === 'done' ? 0.55 : 1 }}>
                    <Td mono col={AMBER}>{r.taskId}</Td>
                    <Td mono col={BLUE}>{r.incidentId}</Td>
                    <Td mono col={TEXT}>{r.title}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.priority === 'p1' ? RED : r.priority === 'p2' ? AMBER : SUBTLE }}>{r.priority.toUpperCase()}</span></Td>
                    <Td><StatusBadge2 s={r.status} /></Td>
                    <Td mono col={SUBTLE}>{r.assignedTo}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.automationAvailable ? GREEN : SUBTLE }}>{r.automationAvailable ? 'âš™ AUTO' : 'MANUAL'}</span></Td>
                    <Td mono col={AMBER}>{r.dueAt}</Td>
                    <Td mono col={r.completedAt ? GREEN : SUBTLE}>{r.completedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'postmortem' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>PM ID</Th><Th>Title</Th><Th>Severity</Th><Th>Status</Th><Th>Author</Th><Th>Root Cause</Th><Th right>Action Items</Th><Th right>Open Items</Th><Th>Follow-Up</Th></tr></thead>
              <tbody>
                {postmortem.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No postmortems â€” check /api/v4/incident-ai/postmortem</td></tr>}
                {postmortem.sort((a, b) => {
                  const ord: Record<string, number> = { draft: 0, review: 1, published: 2 }
                  return (ord[a.status] ?? 3) - (ord[b.status] ?? 3)
                }).map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.pmId}</Td>
                    <Td mono col={TEXT}>{p.title}</Td>
                    <Td><SevBadge s={p.severity} /></Td>
                    <Td><StatusBadge2 s={p.status} /></Td>
                    <Td mono col={SUBTLE}>{p.author}</Td>
                    <Td mono col={SUBTLE}>{p.rootCause}</Td>
                    <Td right mono col={SUBTLE}>{p.actionItems}</Td>
                    <Td right mono col={p.openActionItems > 0 ? ORANGE : GREEN}>{p.openActionItems}</Td>
                    <Td mono col={AMBER}>{p.followUpDate}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Incident</Th><Th>Action</Th><Th>Actor</Th><Th>Automated</Th><Th>Outcome</Th><Th>Details</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/incident-ai/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'failure' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.incidentId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.automated ? PURPLE : SUBTLE }}>{a.automated ? 'âš™ AUTO' : 'MANUAL'}</span></Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.details}</Td>
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
