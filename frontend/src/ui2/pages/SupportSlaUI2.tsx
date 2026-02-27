import React, { useState, useEffect, useCallback } from 'react'
﻿// SupportSlaUI2 â€” Bloomberg APEX support SLA management terminal
// Triage automation, escalation tracking, SLA compliance, ticket analytics
// Tabs: TICKETS | SLA METRICS | TRIAGE | ESCALATIONS | AUDIT
// APIs: /api/v4/support-sla/tickets, /sla-metrics, /triage, /escalations, /audit

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

interface SupportTicket {
  ticketId: string
  title: string
  category: 'bug' | 'feature' | 'incident' | 'access' | 'performance' | 'data' | 'compliance'
  priority: 'p1' | 'p2' | 'p3' | 'p4'
  status: 'new' | 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed'
  reporter: string
  assignedTeam: string
  assignedAgent: string
  slaTargetHours: number
  slaElapsedHours: number
  slaComplianceStatus: 'within_sla' | 'at_risk' | 'breached'
  resolvedAt: string
  createdAt: string
  product: string
}

interface SlaMetric {
  metricId: string
  category: string
  priority: string
  period: string
  totalTickets: number
  resolvedWithinSla: number
  slaCompliancePct: number
  avgResolutionHours: number
  p95ResolutionHours: number
  firstResponseAvgMinutes: number
  reopenRatePct: number
  csat: number
}

interface TriageRule {
  ruleId: string
  name: string
  condition: string
  action: 'assign_team' | 'set_priority' | 'alert' | 'escalate' | 'auto_respond'
  targetTeam: string
  priority: string
  triggerCount: number
  lastTriggeredAt: string
  enabled: boolean
  accuracy: number
}

interface SlaEscalation {
  escalationId: string
  ticketId: string
  reason: 'sla_breach' | 'customer_request' | 'severity_increase' | 'no_response'
  previousAssignee: string
  newAssignee: string
  escalatedBy: string
  escalatedAt: string
  status: 'open' | 'resolved' | 'acknowledged'
  resolutionNotes: string
}

interface SupportAuditEntry {
  auditId: string
  ticketId: string
  action: string
  actor: string
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
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { new: BLUE, open: AMBER, in_progress: AMBER, pending_customer: PURPLE, resolved: GREEN, closed: SUBTLE, within_sla: GREEN, at_risk: AMBER, breached: RED, acknowledged: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function PrioBadge({ p }: { p: string }) {
  const m: Record<string, string> = { p1: RED, p2: ORANGE, p3: AMBER, p4: SUBTLE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { bug: RED, feature: BLUE, incident: ORANGE, access: PURPLE, performance: AMBER, data: GREEN, compliance: RED }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.toUpperCase()}</span>
}
function SlaBar({ elapsed, target }: { elapsed: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (elapsed / target) * 100) : 0
  const col = pct >= 100 ? RED : pct >= 80 ? ORANGE : pct >= 60 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 55, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{elapsed.toFixed(1)}h</span>
    </div>
  )
}


export function SupportSlaUI2() {
  const [tab, setTab] = useState<'tickets' | 'sla-metrics' | 'triage' | 'escalations' | 'audit'>('tickets')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [slaMetrics, setSlaMetrics] = useState<SlaMetric[]>([])
  const [triage, setTriage] = useState<TriageRule[]>([])
  const [escalations, setEscalations] = useState<SlaEscalation[]>([])
  const [auditLog, setAuditLog] = useState<SupportAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rT, rS, rTr, rE, rA] = await Promise.allSettled([
        fetch('/api/v4/support-sla/tickets').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/support-sla/sla-metrics').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/support-sla/triage').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/support-sla/escalations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/support-sla/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.tickets ?? rT.value.data ?? []
        setTickets(raw.map((t: any) => ({
          ticketId: t.ticket_id ?? t.ticketId ?? '', title: t.title ?? '',
          category: t.category ?? 'bug', priority: t.priority ?? 'p3',
          status: t.status ?? 'new', reporter: t.reporter ?? '',
          assignedTeam: t.assigned_team ?? t.assignedTeam ?? '',
          assignedAgent: t.assigned_agent ?? t.assignedAgent ?? '',
          slaTargetHours: Number(t.sla_target_hours ?? t.slaTargetHours ?? 0),
          slaElapsedHours: Number(t.sla_elapsed_hours ?? t.slaElapsedHours ?? 0),
          slaComplianceStatus: t.sla_compliance_status ?? t.slaComplianceStatus ?? 'within_sla',
          resolvedAt: t.resolved_at ?? t.resolvedAt ?? '', createdAt: t.created_at ?? t.createdAt ?? '',
          product: t.product ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load tickets')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.metrics ?? rS.value.data ?? []
        setSlaMetrics(raw.map((s: any) => ({
          metricId: s.metric_id ?? s.metricId ?? '', category: s.category ?? '',
          priority: s.priority ?? '', period: s.period ?? '',
          totalTickets: Number(s.total_tickets ?? s.totalTickets ?? 0),
          resolvedWithinSla: Number(s.resolved_within_sla ?? s.resolvedWithinSla ?? 0),
          slaCompliancePct: Number(s.sla_compliance_pct ?? s.slaCompliancePct ?? 0),
          avgResolutionHours: Number(s.avg_resolution_hours ?? s.avgResolutionHours ?? 0),
          p95ResolutionHours: Number(s.p95_resolution_hours ?? s.p95ResolutionHours ?? 0),
          firstResponseAvgMinutes: Number(s.first_response_avg_minutes ?? s.firstResponseAvgMinutes ?? 0),
          reopenRatePct: Number(s.reopen_rate_pct ?? s.reopenRatePct ?? 0),
          csat: Number(s.csat ?? 0),
        })))
      }
      if (rTr.status === 'fulfilled') {
        const raw = Array.isArray(rTr.value) ? rTr.value : rTr.value.rules ?? rTr.value.data ?? []
        setTriage(raw.map((t: any) => ({
          ruleId: t.rule_id ?? t.ruleId ?? '', name: t.name ?? '',
          condition: t.condition ?? '', action: t.action ?? 'assign_team',
          targetTeam: t.target_team ?? t.targetTeam ?? '', priority: t.priority ?? '',
          triggerCount: Number(t.trigger_count ?? t.triggerCount ?? 0),
          lastTriggeredAt: t.last_triggered_at ?? t.lastTriggeredAt ?? '',
          enabled: Boolean(t.enabled), accuracy: Number(t.accuracy ?? 0),
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.escalations ?? rE.value.data ?? []
        setEscalations(raw.map((e: any) => ({
          escalationId: e.escalation_id ?? e.escalationId ?? '', ticketId: e.ticket_id ?? e.ticketId ?? '',
          reason: e.reason ?? 'sla_breach', previousAssignee: e.previous_assignee ?? e.previousAssignee ?? '',
          newAssignee: e.new_assignee ?? e.newAssignee ?? '', escalatedBy: e.escalated_by ?? e.escalatedBy ?? '',
          escalatedAt: e.escalated_at ?? e.escalatedAt ?? '', status: e.status ?? 'open',
          resolutionNotes: e.resolution_notes ?? e.resolutionNotes ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', ticketId: a.ticket_id ?? a.ticketId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const slaBreached = tickets.filter(t => t.slaComplianceStatus === 'breached').length
  const p1Open = tickets.filter(t => t.priority === 'p1' && t.status !== 'resolved' && t.status !== 'closed').length
  const avgSlaCompliance = slaMetrics.length ? slaMetrics.reduce((a, m) => a + m.slaCompliancePct, 0) / slaMetrics.length : 0
  const openEscalations = escalations.filter(e => e.status === 'open').length

  const TABS2 = [
    { id: 'tickets' as const, label: 'TICKETS' },
    { id: 'sla-metrics' as const, label: 'SLA METRICS' },
    { id: 'triage' as const, label: 'TRIAGE' },
    { id: 'escalations' as const, label: 'ESCALATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SUPPORT SLA â€” TRIAGE AUTOMATION + ESCALATION TRACKING + COMPLIANCE</span>
        {slaBreached > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {slaBreached} SLA BREACH</span>}
        {p1Open > 0 && <span style={{ fontSize: 10, color: RED }}>âš‘ {p1Open} P1 OPEN</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Open Tickets" value={tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length} col={BLUE} />
        <StatCard label="SLA Breached" value={slaBreached} col={slaBreached > 0 ? RED : GREEN} />
        <StatCard label="P1 Open" value={p1Open} col={p1Open > 0 ? RED : GREEN} />
        <StatCard label="Avg SLA Compliance" value={`${avgSlaCompliance.toFixed(1)}%`} col={avgSlaCompliance > 90 ? GREEN : avgSlaCompliance > 75 ? AMBER : RED} />
        <StatCard label="Open Escalations" value={openEscalations} col={openEscalations > 0 ? ORANGE : GREEN} />
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

        {tab === 'tickets' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Ticket ID</Th><Th>Title</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Team</Th><Th>SLA Status</Th><Th>SLA Progress</Th><Th>Product</Th><Th>Created</Th></tr></thead>
              <tbody>
                {tickets.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No tickets â€” check /api/v4/support-sla/tickets</td></tr>}
                {tickets.sort((a, b) => (a.priority < b.priority ? -1 : 1)).map((t, i) => (
                  <tr key={i} style={{ background: t.slaComplianceStatus === 'breached' ? RED + '0a' : t.priority === 'p1' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{t.ticketId}</Td>
                    <Td mono col={TEXT}>{t.title.length > 30 ? t.title.slice(0, 30) + 'â€¦' : t.title}</Td>
                    <Td><CatBadge c={t.category} /></Td>
                    <Td><PrioBadge p={t.priority} /></Td>
                    <Td><StatusBadge s={t.status} /></Td>
                    <Td mono col={BLUE}>{t.assignedTeam || 'â€”'}</Td>
                    <Td><StatusBadge s={t.slaComplianceStatus} /></Td>
                    <Td><SlaBar elapsed={t.slaElapsedHours} target={t.slaTargetHours} /></Td>
                    <Td mono col={SUBTLE}>{t.product || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{t.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sla-metrics' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Category</Th><Th>Priority</Th><Th>Period</Th><Th right>Total</Th><Th right>Within SLA</Th><Th right>Compliance %</Th><Th right>Avg Res Hours</Th><Th right>P95 Hours</Th><Th right>1st Resp min</Th><Th right>CSAT</Th></tr></thead>
              <tbody>
                {slaMetrics.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No SLA metrics â€” check /api/v4/support-sla/sla-metrics</td></tr>}
                {slaMetrics.sort((a, b) => a.slaCompliancePct - b.slaCompliancePct).map((m, i) => (
                  <tr key={i} style={{ background: m.slaCompliancePct < 75 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.category || 'â€”'}</Td>
                    <Td mono col={ORANGE}>{m.priority || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{m.period}</Td>
                    <Td right mono col={TEXT}>{m.totalTickets}</Td>
                    <Td right mono col={TEXT}>{m.resolvedWithinSla}</Td>
                    <Td right mono col={m.slaCompliancePct > 90 ? GREEN : m.slaCompliancePct > 75 ? AMBER : RED}>{m.slaCompliancePct.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{m.avgResolutionHours.toFixed(1)}</Td>
                    <Td right mono col={SUBTLE}>{m.p95ResolutionHours.toFixed(1)}</Td>
                    <Td right mono col={m.firstResponseAvgMinutes > 30 ? RED : GREEN}>{m.firstResponseAvgMinutes.toFixed(0)}</Td>
                    <Td right mono col={m.csat >= 4 ? GREEN : m.csat >= 3 ? AMBER : RED}>{m.csat.toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'triage' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule Name</Th><Th>Condition</Th><Th>Action</Th><Th>Target Team</Th><Th>Priority</Th><Th>Enabled</Th><Th right>Trigger Count</Th><Th right>Accuracy %</Th><Th>Last Triggered</Th></tr></thead>
              <tbody>
                {triage.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No triage rules â€” check /api/v4/support-sla/triage</td></tr>}
                {triage.sort((a, b) => b.triggerCount - a.triggerCount).map((t, i) => (
                  <tr key={i} style={{ opacity: t.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{t.name}</Td>
                    <Td mono col={SUBTLE}>{t.condition.length > 30 ? t.condition.slice(0, 30) + 'â€¦' : t.condition}</Td>
                    <Td mono col={BLUE}>{t.action.replace('_', ' ').toUpperCase()}</Td>
                    <Td mono col={TEXT}>{t.targetTeam || 'â€”'}</Td>
                    <Td><PrioBadge p={t.priority || 'p3'} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: t.enabled ? GREEN : RED }}>{t.enabled ? 'âœ“ ON' : 'âœ— OFF'}</span></Td>
                    <Td right mono col={TEXT}>{t.triggerCount.toLocaleString()}</Td>
                    <Td right mono col={t.accuracy > 90 ? GREEN : t.accuracy > 75 ? AMBER : RED}>{t.accuracy.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{t.lastTriggeredAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'escalations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Ticket ID</Th><Th>Reason</Th><Th>Status</Th><Th>Previous</Th><Th>New Assignee</Th><Th>Escalated By</Th><Th>At</Th><Th>Notes</Th></tr></thead>
              <tbody>
                {escalations.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No escalations â€” check /api/v4/support-sla/escalations</td></tr>}
                {escalations.map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'open' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.escalationId}</Td>
                    <Td mono col={BLUE}>{e.ticketId}</Td>
                    <Td mono col={ORANGE}>{e.reason.replace(/_/g, ' ').toUpperCase()}</Td>
                    <Td><StatusBadge s={e.status} /></Td>
                    <Td mono col={SUBTLE}>{e.previousAssignee || 'â€”'}</Td>
                    <Td mono col={TEXT}>{e.newAssignee || 'â€”'}</Td>
                    <Td mono col={TEXT}>{e.escalatedBy || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{e.escalatedAt}</Td>
                    <Td mono col={SUBTLE}>{e.resolutionNotes || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Ticket ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/support-sla/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.ticketId || 'â€”'}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
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
