import React, { useState, useEffect, useCallback } from 'react'
﻿// ApprovalQueueUI2 â€” Bloomberg APEX approval queue terminal
// Human-in-the-loop queue for high-risk AI decisions, review, policy enforcement
// Tabs: QUEUE | REVIEWERS | DECISIONS | POLICIES | AUDIT
// APIs: /api/v4/approval-queue/items, /reviewers, /decisions, /policies, /audit

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

interface QueueItem {
  itemId: string
  requestType: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  requestor: string
  description: string
  assignedTo: string
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated' | 'expired'
  priority: number
  aiConfidence: number
  createdAt: string
  dueBy: string
  slaBreached: boolean
}

interface Reviewer {
  reviewerId: string
  name: string
  role: string
  department: string
  activeItems: number
  totalDecisions: number
  approvalRate: number
  avgReviewTimeMin: number
  status: 'available' | 'busy' | 'offline'
  slaCompliance: number
}

interface Decision {
  decisionId: string
  itemId: string
  requestType: string
  reviewerName: string
  outcome: 'approved' | 'rejected' | 'delegated' | 'escalated'
  riskLevel: string
  rationale: string
  reviewTimeMin: number
  conditions: string
  decidedAt: string
}

interface ApprovalPolicy {
  policyId: string
  policyName: string
  riskTriggers: string[]
  requiredLevel: string
  minReviewers: number
  slaHours: number
  autoEscalateAfterHours: number
  status: 'active' | 'draft' | 'deprecated'
  matchCount: number
  owner: string
}

interface QueueAuditEntry {
  auditId: string
  itemId: string
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
function RiskBadge({ r }: { r: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: GREEN }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { pending: AMBER, in_review: BLUE, approved: GREEN, rejected: RED, escalated: ORANGE, expired: SUBTLE, available: GREEN, busy: AMBER, offline: SUBTLE, active: GREEN, draft: BLUE, deprecated: SUBTLE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  const lbl = s.replace(/_/g, ' ').toUpperCase()
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{lbl}</span>
}
function ConfBar({ v }: { v: number }) {
  const col = v >= 90 ? GREEN : v >= 70 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(v, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{v.toFixed(1)}%</span>
    </div>
  )
}


export function ApprovalQueueUI2() {
  const [tab, setTab] = useState<'queue' | 'reviewers' | 'decisions' | 'policies' | 'audit'>('queue')
  const [items, setItems] = useState<QueueItem[]>([])
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([])
  const [auditLog, setAuditLog] = useState<QueueAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rI, rR, rD, rP, rA] = await Promise.allSettled([
        fetch('/api/v4/approval-queue/items').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-queue/reviewers').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-queue/decisions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-queue/policies').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/approval-queue/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.items ?? rI.value.data ?? []
        setItems(raw.map((x: any) => ({
          itemId: x.item_id ?? x.itemId ?? '', requestType: x.request_type ?? x.requestType ?? '',
          riskLevel: x.risk_level ?? x.riskLevel ?? 'low', requestor: x.requestor ?? '', description: x.description ?? '',
          assignedTo: x.assigned_to ?? x.assignedTo ?? '', status: x.status ?? 'pending',
          priority: Number(x.priority ?? 0), aiConfidence: Number(x.ai_confidence ?? x.aiConfidence ?? 0),
          createdAt: x.created_at ?? x.createdAt ?? '', dueBy: x.due_by ?? x.dueBy ?? '',
          slaBreached: Boolean(x.sla_breached ?? x.slaBreached),
        })))
        setErr(null)
      } else setErr('Failed to load queue items')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reviewers ?? rR.value.data ?? []
        setReviewers(raw.map((r: any) => ({
          reviewerId: r.reviewer_id ?? r.reviewerId ?? '', name: r.name ?? '', role: r.role ?? '',
          department: r.department ?? '', activeItems: Number(r.active_items ?? r.activeItems ?? 0),
          totalDecisions: Number(r.total_decisions ?? r.totalDecisions ?? 0),
          approvalRate: Number(r.approval_rate ?? r.approvalRate ?? 0),
          avgReviewTimeMin: Number(r.avg_review_time_min ?? r.avgReviewTimeMin ?? 0),
          status: r.status ?? 'available', slaCompliance: Number(r.sla_compliance ?? r.slaCompliance ?? 0),
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.decisions ?? rD.value.data ?? []
        setDecisions(raw.map((d: any) => ({
          decisionId: d.decision_id ?? d.decisionId ?? '', itemId: d.item_id ?? d.itemId ?? '',
          requestType: d.request_type ?? d.requestType ?? '', reviewerName: d.reviewer_name ?? d.reviewerName ?? '',
          outcome: d.outcome ?? 'approved', riskLevel: d.risk_level ?? d.riskLevel ?? '',
          rationale: d.rationale ?? '', reviewTimeMin: Number(d.review_time_min ?? d.reviewTimeMin ?? 0),
          conditions: d.conditions ?? '', decidedAt: d.decided_at ?? d.decidedAt ?? '',
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.policies ?? rP.value.data ?? []
        setPolicies(raw.map((p: any) => ({
          policyId: p.policy_id ?? p.policyId ?? '', policyName: p.policy_name ?? p.policyName ?? '',
          riskTriggers: Array.isArray(p.risk_triggers ?? p.riskTriggers) ? (p.risk_triggers ?? p.riskTriggers) : [],
          requiredLevel: p.required_level ?? p.requiredLevel ?? '', minReviewers: Number(p.min_reviewers ?? p.minReviewers ?? 1),
          slaHours: Number(p.sla_hours ?? p.slaHours ?? 0),
          autoEscalateAfterHours: Number(p.auto_escalate_after_hours ?? p.autoEscalateAfterHours ?? 0),
          status: p.status ?? 'active', matchCount: Number(p.match_count ?? p.matchCount ?? 0),
          owner: p.owner ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', itemId: a.item_id ?? a.itemId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const pending = items.filter(i => i.status === 'pending').length
  const breached = items.filter(i => i.slaBreached).length
  const critical = items.filter(i => i.riskLevel === 'critical').length
  const available = reviewers.filter(r => r.status === 'available').length

  const TABS2 = [
    { id: 'queue' as const, label: 'QUEUE' },
    { id: 'reviewers' as const, label: 'REVIEWERS' },
    { id: 'decisions' as const, label: 'DECISIONS' },
    { id: 'policies' as const, label: 'POLICIES' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>APPROVAL QUEUE â€” HUMAN-IN-THE-LOOP HIGH-RISK AI DECISION MANAGEMENT</span>
        {critical > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {critical} CRITICAL</span>}
        {breached > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {breached} SLA BREACHED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Pending" value={pending} col={pending > 0 ? AMBER : GREEN} />
        <StatCard label="Critical Risk" value={critical} col={critical > 0 ? RED : GREEN} />
        <StatCard label="SLA Breached" value={breached} col={breached > 0 ? ORANGE : GREEN} />
        <StatCard label="Total Decisions" value={decisions.length} col={BLUE} />
        <StatCard label="Available Reviewers" value={available} col={available > 0 ? GREEN : RED} />
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

        {tab === 'queue' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Item ID</Th><Th>Type</Th><Th>Risk</Th><Th>Status</Th><Th right>Priority</Th><Th>AI Confidence</Th><Th>Requestor</Th><Th>Assigned</Th><Th>Due By</Th><Th>SLA</Th><Th>Description</Th></tr></thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No queue items â€” check /api/v4/approval-queue/items</td></tr>}
                {items.sort((a, b) => {
                  if (a.slaBreached !== b.slaBreached) return a.slaBreached ? -1 : 1
                  const p: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (p[a.riskLevel] ?? 4) - (p[b.riskLevel] ?? 4)
                }).map((it, i) => (
                  <tr key={i} style={{ background: it.slaBreached ? ORANGE + '0a' : it.riskLevel === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{it.itemId}</Td>
                    <Td mono col={PURPLE}>{it.requestType}</Td>
                    <Td><RiskBadge r={it.riskLevel} /></Td>
                    <Td><StatusBadge2 s={it.status} /></Td>
                    <Td right mono col={SUBTLE}>{it.priority}</Td>
                    <Td><ConfBar v={it.aiConfidence} /></Td>
                    <Td mono col={TEXT}>{it.requestor}</Td>
                    <Td mono col={it.assignedTo ? BLUE : SUBTLE}>{it.assignedTo || 'Unassigned'}</Td>
                    <Td mono col={it.slaBreached ? RED : SUBTLE}>{it.dueBy}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: it.slaBreached ? RED : GREEN, background: (it.slaBreached ? RED : GREEN) + '22', borderRadius: 3, padding: '2px 5px' }}>{it.slaBreached ? 'BREACHED' : 'OK'}</span></Td>
                    <Td mono col={SUBTLE}>{it.description.slice(0, 40)}{it.description.length > 40 ? 'â€¦' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviewers' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Role</Th><Th>Department</Th><Th>Status</Th><Th right>Active</Th><Th right>Total</Th><Th right>Approval Rate</Th><Th right>Avg Time</Th><Th right>SLA %</Th></tr></thead>
              <tbody>
                {reviewers.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reviewers â€” check /api/v4/approval-queue/reviewers</td></tr>}
                {reviewers.sort((a, b) => b.activeItems - a.activeItems).map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.name}</Td>
                    <Td mono col={PURPLE}>{r.role}</Td>
                    <Td mono col={SUBTLE}>{r.department}</Td>
                    <Td><StatusBadge2 s={r.status} /></Td>
                    <Td right mono col={r.activeItems > 5 ? ORANGE : TEXT}>{r.activeItems}</Td>
                    <Td right mono col={SUBTLE}>{r.totalDecisions}</Td>
                    <Td right mono col={r.approvalRate >= 80 ? GREEN : r.approvalRate >= 60 ? AMBER : RED}>{r.approvalRate.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{r.avgReviewTimeMin.toFixed(0)} min</Td>
                    <Td right mono col={r.slaCompliance >= 90 ? GREEN : r.slaCompliance >= 70 ? AMBER : RED}>{r.slaCompliance.toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'decisions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Decision ID</Th><Th>Item</Th><Th>Type</Th><Th>Reviewer</Th><Th>Outcome</Th><Th>Risk</Th><Th right>Review Time</Th><Th>Conditions</Th><Th>Rationale</Th><Th>Decided</Th></tr></thead>
              <tbody>
                {decisions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No decisions â€” check /api/v4/approval-queue/decisions</td></tr>}
                {decisions.map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.decisionId}</Td>
                    <Td mono col={BLUE}>{d.itemId}</Td>
                    <Td mono col={PURPLE}>{d.requestType}</Td>
                    <Td mono col={TEXT}>{d.reviewerName}</Td>
                    <Td><StatusBadge2 s={d.outcome} /></Td>
                    <Td><RiskBadge r={d.riskLevel} /></Td>
                    <Td right mono col={d.reviewTimeMin > 60 ? ORANGE : SUBTLE}>{d.reviewTimeMin.toFixed(0)} min</Td>
                    <Td mono col={d.conditions ? AMBER : SUBTLE}>{d.conditions || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{d.rationale.slice(0, 40)}{d.rationale.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{d.decidedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'policies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Policy</Th><Th>Risk Triggers</Th><Th>Required Level</Th><Th right>Min Reviewers</Th><Th right>SLA Hours</Th><Th right>Auto Escalate</Th><Th>Status</Th><Th right>Matches</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {policies.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No policies â€” check /api/v4/approval-queue/policies</td></tr>}
                {policies.map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.policyName}</Td>
                    <Td mono col={SUBTLE}>{p.riskTriggers.join(', ')}</Td>
                    <Td mono col={PURPLE}>{p.requiredLevel}</Td>
                    <Td right mono col={SUBTLE}>{p.minReviewers}</Td>
                    <Td right mono col={p.slaHours < 4 ? RED : p.slaHours < 24 ? AMBER : SUBTLE}>{p.slaHours}h</Td>
                    <Td right mono col={SUBTLE}>{p.autoEscalateAfterHours}h</Td>
                    <Td><StatusBadge2 s={p.status} /></Td>
                    <Td right mono col={p.matchCount > 0 ? TEXT : SUBTLE}>{p.matchCount}</Td>
                    <Td mono col={SUBTLE}>{p.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Item</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/approval-queue/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.itemId}</Td>
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
