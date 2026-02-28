import React, { useState, useEffect, useCallback } from 'react'
﻿// RiskGovernanceUI2 — Bloomberg APEX risk governance terminal
// Policy enforcement, committee reporting, limit framework, escalation tracking
// Tabs: FRAMEWORK | LIMITS | COMMITTEES | ESCALATIONS | AUDIT
// APIs: /api/v4/risk-governance/framework, /limits, /committees, /escalations, /audit

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

interface GovernancePolicy {
  policyId: string
  name: string
  category: 'market_risk' | 'credit_risk' | 'liquidity_risk' | 'operational_risk' | 'model_risk' | 'conduct_risk'
  framework: string
  owner: string
  status: 'active' | 'draft' | 'review' | 'suspended' | 'expired'
  effectiveDate: string
  reviewDate: string
  policyVersion: string
  complianceScore: number
  controlsCount: number
  breachesYtd: number
}

interface RiskLimit {
  limitId: string
  name: string
  hierarchy: 'firm' | 'desk' | 'portfolio' | 'position' | 'instrument'
  riskType: string
  limitValue: number
  currentValue: number
  utilizationPct: number
  warningThresholdPct: number
  status: 'ok' | 'warning' | 'breach' | 'suspended'
  policyReference: string
  lastBreachAt: string
}

interface RiskCommittee {
  committeeId: string
  name: string
  type: 'approval' | 'oversight' | 'review' | 'escalation' | 'strategic'
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'ad_hoc'
  nextMeeting: string
  chairperson: string
  membersCount: number
  pendingItems: number
  lastMinutes: string
  quorumReached: boolean
}

interface GovernanceEscalation {
  escalationId: string
  subject: string
  sourcePolicy: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_review' | 'pending_approval' | 'resolved' | 'escalated'
  assignedTo: string
  raisedBy: string
  daysOpen: number
  targetResolutionDate: string
  description: string
}

interface RiskGovAuditEntry {
  auditId: string
  policyId: string
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
  const m: Record<string, string> = { ok: GREEN, active: GREEN, warning: AMBER, breach: RED, open: RED, suspended: ORANGE, expired: SUBTLE, draft: BLUE, review: AMBER, resolved: GREEN, in_review: AMBER, pending_approval: PURPLE, escalated: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { market_risk: RED, credit_risk: ORANGE, liquidity_risk: AMBER, operational_risk: BLUE, model_risk: PURPLE, conduct_risk: GREEN }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.replace('_', ' ').toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function HierBadge({ h }: { h: string }) {
  const m: Record<string, string> = { firm: RED, desk: ORANGE, portfolio: AMBER, position: BLUE, instrument: PURPLE }
  const c = m[h] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{h.toUpperCase()}</span>
}
function UtilBar({ pct, warn }: { pct: number; warn: number }) {
  const col = pct >= 100 ? RED : pct >= warn ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 64, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(1)}%</span>
    </div>
  )
}


export function RiskGovernanceUI2() {
  const [tab, setTab] = useState<'framework' | 'limits' | 'committees' | 'escalations' | 'audit'>('framework')
  const [policies, setPolicies] = useState<GovernancePolicy[]>([])
  const [limits, setLimits] = useState<RiskLimit[]>([])
  const [committees, setCommittees] = useState<RiskCommittee[]>([])
  const [escalations, setEscalations] = useState<GovernanceEscalation[]>([])
  const [auditLog, setAuditLog] = useState<RiskGovAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rF, rL, rC, rE, rA] = await Promise.allSettled([
        fetch('/api/v4/risk-governance/framework').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-governance/limits').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-governance/committees').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-governance/escalations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/risk-governance/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.policies ?? rF.value.data ?? []
        setPolicies(raw.map((p: any) => ({
          policyId: p.policy_id ?? p.policyId ?? '', name: p.name ?? '',
          category: p.category ?? 'operational_risk', framework: p.framework ?? '',
          owner: p.owner ?? '', status: p.status ?? 'active',
          effectiveDate: p.effective_date ?? p.effectiveDate ?? '', reviewDate: p.review_date ?? p.reviewDate ?? '',
          policyVersion: p.policy_version ?? p.policyVersion ?? '1.0',
          complianceScore: Number(p.compliance_score ?? p.complianceScore ?? 0),
          controlsCount: Number(p.controls_count ?? p.controlsCount ?? 0),
          breachesYtd: Number(p.breaches_ytd ?? p.breachesYtd ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load framework')
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.limits ?? rL.value.data ?? []
        setLimits(raw.map((l: any) => ({
          limitId: l.limit_id ?? l.limitId ?? '', name: l.name ?? '',
          hierarchy: l.hierarchy ?? 'firm', riskType: l.risk_type ?? l.riskType ?? '',
          limitValue: Number(l.limit_value ?? l.limitValue ?? 0),
          currentValue: Number(l.current_value ?? l.currentValue ?? 0),
          utilizationPct: Number(l.utilization_pct ?? l.utilizationPct ?? 0),
          warningThresholdPct: Number(l.warning_threshold_pct ?? l.warningThresholdPct ?? 80),
          status: l.status ?? 'ok', policyReference: l.policy_reference ?? l.policyReference ?? '',
          lastBreachAt: l.last_breach_at ?? l.lastBreachAt ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.committees ?? rC.value.data ?? []
        setCommittees(raw.map((c: any) => ({
          committeeId: c.committee_id ?? c.committeeId ?? '', name: c.name ?? '',
          type: c.type ?? 'oversight', frequency: c.frequency ?? 'monthly',
          nextMeeting: c.next_meeting ?? c.nextMeeting ?? '', chairperson: c.chairperson ?? '',
          membersCount: Number(c.members_count ?? c.membersCount ?? 0),
          pendingItems: Number(c.pending_items ?? c.pendingItems ?? 0),
          lastMinutes: c.last_minutes ?? c.lastMinutes ?? '',
          quorumReached: Boolean(c.quorum_reached ?? c.quorumReached),
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.escalations ?? rE.value.data ?? []
        setEscalations(raw.map((e: any) => ({
          escalationId: e.escalation_id ?? e.escalationId ?? '', subject: e.subject ?? '',
          sourcePolicy: e.source_policy ?? e.sourcePolicy ?? '',
          severity: e.severity ?? 'medium', status: e.status ?? 'open',
          assignedTo: e.assigned_to ?? e.assignedTo ?? '', raisedBy: e.raised_by ?? e.raisedBy ?? '',
          daysOpen: Number(e.days_open ?? e.daysOpen ?? 0),
          targetResolutionDate: e.target_resolution_date ?? e.targetResolutionDate ?? '',
          description: e.description ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', policyId: a.policy_id ?? a.policyId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const breachCount = limits.filter(l => l.status === 'breach').length
  const openEscalations = escalations.filter(e => e.status === 'open' || e.status === 'escalated').length
  const criticalEscalations = escalations.filter(e => e.severity === 'critical').length
  const avgCompliance = policies.length ? policies.reduce((a, p) => a + p.complianceScore, 0) / policies.length : 0

  const TABS2 = [
    { id: 'framework' as const, label: 'FRAMEWORK' },
    { id: 'limits' as const, label: 'LIMITS' },
    { id: 'committees' as const, label: 'COMMITTEES' },
    { id: 'escalations' as const, label: 'ESCALATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RISK GOVERNANCE — POLICY ENFORCEMENT + LIMIT FRAMEWORK + COMMITTEE REPORTING</span>
        {breachCount > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚑ {breachCount} BREACH</span>}
        {criticalEscalations > 0 && <span style={{ fontSize: 10, color: RED }}>⚑ {criticalEscalations} CRITICAL</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Policies" value={policies.filter(p => p.status === 'active').length} col={BLUE} />
        <StatCard label="Limit Breaches" value={breachCount} col={breachCount > 0 ? RED : GREEN} />
        <StatCard label="Open Escalations" value={openEscalations} col={openEscalations > 0 ? ORANGE : GREEN} />
        <StatCard label="Avg Compliance" value={`${avgCompliance.toFixed(1)}%`} col={avgCompliance > 80 ? GREEN : avgCompliance > 60 ? AMBER : RED} />
        <StatCard label="Critical Issues" value={criticalEscalations} col={criticalEscalations > 0 ? RED : GREEN} />
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

        {tab === 'framework' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Policy</Th><Th>Category</Th><Th>Framework</Th><Th>Owner</Th><Th>Status</Th><Th>Version</Th><Th right>Controls</Th><Th right>Breaches YTD</Th><Th right>Compliance %</Th><Th>Review Date</Th></tr></thead>
              <tbody>
                {policies.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No policies — check /api/v4/risk-governance/framework</td></tr>}
                {policies.sort((a, b) => b.breachesYtd - a.breachesYtd).map((p, i) => (
                  <tr key={i} style={{ background: p.breachesYtd > 0 ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td><CatBadge c={p.category} /></Td>
                    <Td mono col={BLUE}>{p.framework || '—'}</Td>
                    <Td mono col={TEXT}>{p.owner}</Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td mono col={SUBTLE}>{p.policyVersion}</Td>
                    <Td right mono col={TEXT}>{p.controlsCount}</Td>
                    <Td right mono col={p.breachesYtd > 0 ? RED : GREEN}>{p.breachesYtd}</Td>
                    <Td right mono col={p.complianceScore > 80 ? GREEN : p.complianceScore > 60 ? AMBER : RED}>{p.complianceScore.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{p.reviewDate || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'limits' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Limit Name</Th><Th>Hierarchy</Th><Th>Risk Type</Th><Th>Status</Th><Th right>Limit</Th><Th right>Current</Th><Th>Utilization</Th><Th>Policy Ref</Th><Th>Last Breach</Th></tr></thead>
              <tbody>
                {limits.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No limits — check /api/v4/risk-governance/limits</td></tr>}
                {limits.sort((a, b) => b.utilizationPct - a.utilizationPct).map((l, i) => (
                  <tr key={i} style={{ background: l.status === 'breach' ? RED + '0a' : l.status === 'warning' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{l.name}</Td>
                    <Td><HierBadge h={l.hierarchy} /></Td>
                    <Td mono col={BLUE}>{l.riskType}</Td>
                    <Td><StatusBadge s={l.status} /></Td>
                    <Td right mono col={SUBTLE}>{l.limitValue.toLocaleString()}</Td>
                    <Td right mono col={l.utilizationPct >= 100 ? RED : TEXT}>{l.currentValue.toLocaleString()}</Td>
                    <Td><UtilBar pct={l.utilizationPct} warn={l.warningThresholdPct} /></Td>
                    <Td mono col={PURPLE}>{l.policyReference || '—'}</Td>
                    <Td mono col={SUBTLE}>{l.lastBreachAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'committees' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Committee</Th><Th>Type</Th><Th>Frequency</Th><Th>Chairperson</Th><Th right>Members</Th><Th right>Pending Items</Th><Th>Quorum</Th><Th>Next Meeting</Th><Th>Last Minutes</Th></tr></thead>
              <tbody>
                {committees.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No committees — check /api/v4/risk-governance/committees</td></tr>}
                {committees.sort((a, b) => b.pendingItems - a.pendingItems).map((c, i) => (
                  <tr key={i} style={{ background: c.pendingItems > 5 ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.name}</Td>
                    <Td mono col={BLUE}>{c.type.toUpperCase()}</Td>
                    <Td mono col={SUBTLE}>{c.frequency.toUpperCase()}</Td>
                    <Td mono col={TEXT}>{c.chairperson}</Td>
                    <Td right mono col={TEXT}>{c.membersCount}</Td>
                    <Td right mono col={c.pendingItems > 5 ? ORANGE : TEXT}>{c.pendingItems}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.quorumReached ? GREEN : RED }}>{c.quorumReached ? '✓ YES' : '✗ NO'}</span></Td>
                    <Td mono col={SUBTLE}>{c.nextMeeting || '—'}</Td>
                    <Td mono col={SUBTLE}>{c.lastMinutes || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'escalations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Subject</Th><Th>Source Policy</Th><Th>Severity</Th><Th>Status</Th><Th>Assigned To</Th><Th>Raised By</Th><Th right>Days Open</Th><Th>Target Resolution</Th></tr></thead>
              <tbody>
                {escalations.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No escalations — check /api/v4/risk-governance/escalations</td></tr>}
                {escalations.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1)).map((e, i) => (
                  <tr key={i} style={{ background: e.severity === 'critical' ? RED + '0a' : e.severity === 'high' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.escalationId}</Td>
                    <Td mono col={TEXT}>{e.subject}</Td>
                    <Td mono col={BLUE}>{e.sourcePolicy || '—'}</Td>
                    <Td><SevBadge s={e.severity} /></Td>
                    <Td><StatusBadge s={e.status} /></Td>
                    <Td mono col={TEXT}>{e.assignedTo || '—'}</Td>
                    <Td mono col={SUBTLE}>{e.raisedBy || '—'}</Td>
                    <Td right mono col={e.daysOpen > 14 ? RED : e.daysOpen > 7 ? ORANGE : TEXT}>{e.daysOpen}</Td>
                    <Td mono col={SUBTLE}>{e.targetResolutionDate || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Policy ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log — check /api/v4/risk-governance/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.policyId || '—'}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.detail || '—'}</Td>
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
