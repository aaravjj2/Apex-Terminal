import React, { useState, useEffect, useCallback } from 'react'
﻿// IncidentComplianceUI2 â€” Bloomberg ICMP incident-compliance bridge terminal
// Regulatory notifications, compliance obligations, resolution tracking, breach reporting
// Tabs: INCIDENTS | NOTIFICATIONS | OBLIGATIONS | RESOLUTION | AUDIT
// APIs: /api/v4/incident-compliance/incidents, /notifications, /obligations, /resolution, /audit

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

interface ComplianceIncident {
  incidentId: string
  title: string
  incidentType: string
  severity: string
  complianceImpact: 'reportable' | 'non-reportable' | 'material' | 'immaterial'
  regulatoryFramework: string[]
  reportDeadlineHours: number
  detectedAt: string
  status: 'new' | 'assessing' | 'notified' | 'resolved' | 'closed'
  affectedJurisdictions: string[]
  estimatedImpactUsd: number
}

interface RegulatoryNotification {
  notifId: string
  incidentId: string
  regulator: string
  jurisdiction: string
  notifType: string
  status: 'draft' | 'submitted' | 'acknowledged' | 'rejected' | 'pending'
  dueAt: string
  submittedAt: string
  submittedBy: string
  method: string
  refNumber: string
  lateRisk: boolean
}

interface ComplianceObligation {
  obligationId: string
  framework: string
  jurisdiction: string
  requirement: string
  triggerEvent: string
  deadlineHours: number
  status: 'open' | 'met' | 'overdue' | 'waived'
  responsibleParty: string
  incidentRef: string
  penalty: string
}

interface ResolutionRecord {
  resolutionId: string
  incidentId: string
  resolutionType: string
  summary: string
  remediationSteps: string[]
  completedAt: string
  verifiedBy: string
  regulatoryAccepted: boolean
  closedAt: string
  recurrencePrevention: string
}

interface ComplianceAuditEntry {
  auditId: string
  incidentId: string
  action: string
  actor: string
  jurisdiction: string
  outcome: 'pass' | 'fail' | 'na'
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
function ImpactBadge({ s }: { s: string }) {
  const m: Record<string, string> = { reportable: RED, 'non-reportable': GREEN, material: ORANGE, immaterial: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { new: BLUE, assessing: AMBER, notified: PURPLE, resolved: GREEN, closed: SUBTLE, draft: SUBTLE, submitted: AMBER, acknowledged: GREEN, rejected: RED, pending: ORANGE, open: RED, met: GREEN, overdue: RED, waived: SUBTLE, pass: GREEN, fail: RED, na: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function IncidentComplianceUI2() {
  const [tab, setTab] = useState<'incidents' | 'notifications' | 'obligations' | 'resolution' | 'audit'>('incidents')
  const [incidents, setIncidents] = useState<ComplianceIncident[]>([])
  const [notifications, setNotifications] = useState<RegulatoryNotification[]>([])
  const [obligations, setObligations] = useState<ComplianceObligation[]>([])
  const [resolution, setResolution] = useState<ResolutionRecord[]>([])
  const [auditLog, setAuditLog] = useState<ComplianceAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rI, rN, rO, rR, rA] = await Promise.allSettled([
        fetch('/api/v4/incident-compliance/incidents').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-compliance/notifications').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-compliance/obligations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-compliance/resolution').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/incident-compliance/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.incidents ?? rI.value.data ?? []
        setIncidents(raw.map((i: any) => ({
          incidentId: i.incident_id ?? i.incidentId ?? '', title: i.title ?? '',
          incidentType: i.incident_type ?? i.incidentType ?? '', severity: i.severity ?? '',
          complianceImpact: i.compliance_impact ?? i.complianceImpact ?? 'non-reportable',
          regulatoryFramework: Array.isArray(i.regulatory_framework ?? i.regulatoryFramework) ? (i.regulatory_framework ?? i.regulatoryFramework) : [],
          reportDeadlineHours: Number(i.report_deadline_hours ?? i.reportDeadlineHours ?? 0),
          detectedAt: i.detected_at ?? i.detectedAt ?? '', status: i.status ?? 'new',
          affectedJurisdictions: Array.isArray(i.affected_jurisdictions ?? i.affectedJurisdictions) ? (i.affected_jurisdictions ?? i.affectedJurisdictions) : [],
          estimatedImpactUsd: Number(i.estimated_impact_usd ?? i.estimatedImpactUsd ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load incidents')
      if (rN.status === 'fulfilled') {
        const raw = Array.isArray(rN.value) ? rN.value : rN.value.notifications ?? rN.value.data ?? []
        setNotifications(raw.map((n: any) => ({
          notifId: n.notif_id ?? n.notifId ?? '', incidentId: n.incident_id ?? n.incidentId ?? '',
          regulator: n.regulator ?? '', jurisdiction: n.jurisdiction ?? '',
          notifType: n.notif_type ?? n.notifType ?? '', status: n.status ?? 'pending',
          dueAt: n.due_at ?? n.dueAt ?? '', submittedAt: n.submitted_at ?? n.submittedAt ?? '',
          submittedBy: n.submitted_by ?? n.submittedBy ?? '', method: n.method ?? '',
          refNumber: n.ref_number ?? n.refNumber ?? '', lateRisk: Boolean(n.late_risk ?? n.lateRisk ?? false),
        })))
      }
      if (rO.status === 'fulfilled') {
        const raw = Array.isArray(rO.value) ? rO.value : rO.value.obligations ?? rO.value.data ?? []
        setObligations(raw.map((o: any) => ({
          obligationId: o.obligation_id ?? o.obligationId ?? '', framework: o.framework ?? '',
          jurisdiction: o.jurisdiction ?? '', requirement: o.requirement ?? '',
          triggerEvent: o.trigger_event ?? o.triggerEvent ?? '', deadlineHours: Number(o.deadline_hours ?? o.deadlineHours ?? 0),
          status: o.status ?? 'open', responsibleParty: o.responsible_party ?? o.responsibleParty ?? '',
          incidentRef: o.incident_ref ?? o.incidentRef ?? '', penalty: o.penalty ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.resolution ?? rR.value.data ?? []
        setResolution(raw.map((r: any) => ({
          resolutionId: r.resolution_id ?? r.resolutionId ?? '', incidentId: r.incident_id ?? r.incidentId ?? '',
          resolutionType: r.resolution_type ?? r.resolutionType ?? '', summary: r.summary ?? '',
          remediationSteps: Array.isArray(r.remediation_steps ?? r.remediationSteps) ? (r.remediation_steps ?? r.remediationSteps) : [],
          completedAt: r.completed_at ?? r.completedAt ?? '', verifiedBy: r.verified_by ?? r.verifiedBy ?? '',
          regulatoryAccepted: Boolean(r.regulatory_accepted ?? r.regulatoryAccepted ?? false),
          closedAt: r.closed_at ?? r.closedAt ?? '', recurrencePrevention: r.recurrence_prevention ?? r.recurrencePrevention ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', incidentId: a.incident_id ?? a.incidentId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', jurisdiction: a.jurisdiction ?? '',
          outcome: a.outcome ?? 'pass', details: a.details ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const reportableIncidents = incidents.filter(i => i.complianceImpact === 'reportable').length
  const overdueObligations = obligations.filter(o => o.status === 'overdue').length
  const lateRiskNotifs = notifications.filter(n => n.lateRisk && n.status !== 'acknowledged').length
  const pendingNotifs = notifications.filter(n => n.status === 'pending' || n.status === 'draft').length

  const TABS2 = [
    { id: 'incidents' as const, label: 'INCIDENTS' },
    { id: 'notifications' as const, label: 'NOTIFICATIONS' },
    { id: 'obligations' as const, label: 'OBLIGATIONS' },
    { id: 'resolution' as const, label: 'RESOLUTION' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>ICMP</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>INCIDENT COMPLIANCE â€” REGULATORY NOTIFICATIONS + OBLIGATIONS + BREACH REPORTING</span>
        {reportableIncidents > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {reportableIncidents} REPORTABLE</span>}
        {overdueObligations > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {overdueObligations} OVERDUE OBLIGATIONS</span>}
        {lateRiskNotifs > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {lateRiskNotifs} LATE RISK NOTIFS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Incidents" value={incidents.length} col={BLUE} />
        <StatCard label="Reportable" value={reportableIncidents} col={reportableIncidents > 0 ? RED : SUBTLE} />
        <StatCard label="Overdue Obligations" value={overdueObligations} col={overdueObligations > 0 ? RED : GREEN} />
        <StatCard label="Pending Notifs" value={pendingNotifs} col={pendingNotifs > 0 ? AMBER : SUBTLE} />
        <StatCard label="Late Risk" value={lateRiskNotifs} col={lateRiskNotifs > 0 ? ORANGE : SUBTLE} />
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
              <thead><tr><Th>Incident ID</Th><Th>Title</Th><Th>Type</Th><Th>Severity</Th><Th>Impact</Th><Th>Status</Th><Th right>Deadline (hrs)</Th><Th right>Est. Impact</Th><Th>Detected</Th></tr></thead>
              <tbody>
                {incidents.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No incidents â€” check /api/v4/incident-compliance/incidents</td></tr>}
                {incidents.sort((a, b) => {
                  const ord: Record<string, number> = { reportable: 0, material: 1, 'non-reportable': 2, immaterial: 3 }
                  return (ord[a.complianceImpact] ?? 4) - (ord[b.complianceImpact] ?? 4)
                }).map((i, idx) => (
                  <tr key={idx} style={{ background: i.complianceImpact === 'reportable' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{i.incidentId}</Td>
                    <Td mono col={TEXT}>{i.title}</Td>
                    <Td mono col={PURPLE}>{i.incidentType}</Td>
                    <Td mono col={SUBTLE}>{i.severity}</Td>
                    <Td><ImpactBadge s={i.complianceImpact} /></Td>
                    <Td><StatusBadge2 s={i.status} /></Td>
                    <Td right mono col={i.reportDeadlineHours < 24 ? RED : AMBER}>{i.reportDeadlineHours}</Td>
                    <Td right mono col={i.estimatedImpactUsd > 1000000 ? RED : SUBTLE}>${i.estimatedImpactUsd.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{i.detectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'notifications' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Notif ID</Th><Th>Incident</Th><Th>Regulator</Th><Th>Jurisdiction</Th><Th>Type</Th><Th>Status</Th><Th>Late Risk</Th><Th>Due</Th><Th>Submitted</Th><Th>Ref #</Th></tr></thead>
              <tbody>
                {notifications.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No notifications â€” check /api/v4/incident-compliance/notifications</td></tr>}
                {notifications.sort((a, b) => Number(b.lateRisk) - Number(a.lateRisk)).map((n, i) => (
                  <tr key={i} style={{ background: n.lateRisk ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{n.notifId}</Td>
                    <Td mono col={BLUE}>{n.incidentId}</Td>
                    <Td mono col={TEXT}>{n.regulator}</Td>
                    <Td mono col={SUBTLE}>{n.jurisdiction}</Td>
                    <Td mono col={PURPLE}>{n.notifType}</Td>
                    <Td><StatusBadge2 s={n.status} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: n.lateRisk ? RED : SUBTLE }}>{n.lateRisk ? '⚠‘ YES' : 'NO'}</span></Td>
                    <Td mono col={AMBER}>{n.dueAt}</Td>
                    <Td mono col={n.submittedAt ? GREEN : SUBTLE}>{n.submittedAt || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{n.refNumber || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'obligations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Obligation ID</Th><Th>Framework</Th><Th>Jurisdiction</Th><Th>Requirement</Th><Th>Status</Th><Th right>Deadline (hrs)</Th><Th>Responsible</Th><Th>Penalty</Th><Th>Incident</Th></tr></thead>
              <tbody>
                {obligations.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No obligations â€” check /api/v4/incident-compliance/obligations</td></tr>}
                {obligations.sort((a, b) => {
                  const ord: Record<string, number> = { overdue: 0, open: 1, met: 2, waived: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((o, i) => (
                  <tr key={i} style={{ background: o.status === 'overdue' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{o.obligationId}</Td>
                    <Td mono col={BLUE}>{o.framework}</Td>
                    <Td mono col={SUBTLE}>{o.jurisdiction}</Td>
                    <Td mono col={TEXT}>{o.requirement}</Td>
                    <Td><StatusBadge2 s={o.status} /></Td>
                    <Td right mono col={o.deadlineHours < 24 ? RED : AMBER}>{o.deadlineHours}</Td>
                    <Td mono col={SUBTLE}>{o.responsibleParty}</Td>
                    <Td mono col={o.penalty ? RED : SUBTLE}>{o.penalty || 'â€”'}</Td>
                    <Td mono col={BLUE}>{o.incidentRef || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'resolution' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Resolution ID</Th><Th>Incident</Th><Th>Type</Th><Th>Summary</Th><Th>Verified By</Th><Th>Reg. Accepted</Th><Th>Completed</Th><Th>Closed</Th></tr></thead>
              <tbody>
                {resolution.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No resolutions â€” check /api/v4/incident-compliance/resolution</td></tr>}
                {resolution.map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.resolutionId}</Td>
                    <Td mono col={BLUE}>{r.incidentId}</Td>
                    <Td mono col={PURPLE}>{r.resolutionType}</Td>
                    <Td mono col={TEXT}>{r.summary}</Td>
                    <Td mono col={SUBTLE}>{r.verifiedBy || 'â€”'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.regulatoryAccepted ? GREEN : RED }}>{r.regulatoryAccepted ? 'YES' : 'NO'}</span></Td>
                    <Td mono col={r.completedAt ? GREEN : SUBTLE}>{r.completedAt || 'â€”'}</Td>
                    <Td mono col={r.closedAt ? GREEN : SUBTLE}>{r.closedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Incident</Th><Th>Action</Th><Th>Actor</Th><Th>Jurisdiction</Th><Th>Outcome</Th><Th>Details</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/incident-compliance/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.incidentId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.jurisdiction}</Td>
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
