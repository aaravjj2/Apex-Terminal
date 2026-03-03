import React, { useState, useEffect, useCallback } from 'react'
﻿// PlatformDebtUI2 â€” Bloomberg APEX platform technical debt terminal
// Debt tracking, retirement queues, impact analysis, remediation plans, audit
// Tabs: ITEMS | RETIREMENT | IMPACT | REMEDIATION | AUDIT
// APIs: /api/v4/platform-debt/items, /retirement, /impact, /remediation, /audit

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

interface DebtItem {
  debtId: string
  title: string
  category: 'architecture' | 'dependency' | 'security' | 'code_quality' | 'infrastructure' | 'documentation'
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'resolved' | 'deferred'
  estimatedDays: number
  agedays: number
  interestRatePct: number
  affectedSystems: string
  owner: string
  createdAt: string
}

interface RetirementRecord {
  retirementId: string
  debtId: string
  debtTitle: string
  plannedDate: string
  completedDate: string
  effortDays: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'slipped'
  assignee: string
  savingsPerYearDays: number
}

interface ImpactRecord {
  impactId: string
  debtId: string
  debtTitle: string
  systemName: string
  incidentContribution: number
  velocityImpactPct: number
  securityRiskScore: number
  reliabilityImpact: 'none' | 'minor' | 'major' | 'critical'
  costPerMonthUsd: number
  assessedAt: string
}

interface RemediationPlan {
  planId: string
  debtId: string
  debtTitle: string
  approach: string
  estimatedSprints: number
  sprintsCompleted: number
  progressPct: number
  requiredSkills: string
  primaryOwner: string
  status: 'planned' | 'active' | 'paused' | 'done'
}

interface DebtAuditEntry {
  auditId: string
  debtId: string
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
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { open: RED, in_progress: AMBER, resolved: GREEN, deferred: PURPLE, scheduled: BLUE, completed: GREEN, slipped: RED, planned: BLUE, active: AMBER, paused: ORANGE, done: GREEN, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { architecture: PURPLE, dependency: BLUE, security: RED, code_quality: GREEN, infrastructure: ORANGE, documentation: SUBTLE }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{c.replace('_', ' ').toUpperCase()}</span>
}
function PctBar({ pct, warnAt, name }: { pct: number; warnAt?: number; name?: string }) {
  const col = pct >= 90 ? GREEN : pct >= (warnAt ?? 50) ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 48, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(0)}%</span>
    </div>
  )
}


export function PlatformDebtUI2() {
  const [tab, setTab] = useState<'items' | 'retirement' | 'impact' | 'remediation' | 'audit'>('items')
  const [items, setItems] = useState<DebtItem[]>([])
  const [retirement, setRetirement] = useState<RetirementRecord[]>([])
  const [impact, setImpact] = useState<ImpactRecord[]>([])
  const [remediation, setRemediation] = useState<RemediationPlan[]>([])
  const [auditLog, setAuditLog] = useState<DebtAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rI, rR, rIm, rRe, rA] = await Promise.allSettled([
        fetch('/api/v4/platform-debt/items').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/platform-debt/retirement').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/platform-debt/impact').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/platform-debt/remediation').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/platform-debt/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.items ?? rI.value.data ?? []
        setItems(raw.map((i: any) => ({
          debtId: i.debt_id ?? i.debtId ?? '', title: i.title ?? '',
          category: i.category ?? 'code_quality', severity: i.severity ?? 'low',
          status: i.status ?? 'open', estimatedDays: Number(i.estimated_days ?? i.estimatedDays ?? 0),
          agedays: Number(i.age_days ?? i.agedays ?? 0),
          interestRatePct: Number(i.interest_rate_pct ?? i.interestRatePct ?? 0),
          affectedSystems: i.affected_systems ?? i.affectedSystems ?? '',
          owner: i.owner ?? '', createdAt: i.created_at ?? i.createdAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load debt items')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.retirement ?? rR.value.data ?? []
        setRetirement(raw.map((r: any) => ({
          retirementId: r.retirement_id ?? r.retirementId ?? '', debtId: r.debt_id ?? r.debtId ?? '',
          debtTitle: r.debt_title ?? r.debtTitle ?? '', plannedDate: r.planned_date ?? r.plannedDate ?? '',
          completedDate: r.completed_date ?? r.completedDate ?? '',
          effortDays: Number(r.effort_days ?? r.effortDays ?? 0),
          status: r.status ?? 'scheduled', assignee: r.assignee ?? '',
          savingsPerYearDays: Number(r.savings_per_year_days ?? r.savingsPerYearDays ?? 0),
        })))
      }
      if (rIm.status === 'fulfilled') {
        const raw = Array.isArray(rIm.value) ? rIm.value : rIm.value.impact ?? rIm.value.data ?? []
        setImpact(raw.map((i: any) => ({
          impactId: i.impact_id ?? i.impactId ?? '', debtId: i.debt_id ?? i.debtId ?? '',
          debtTitle: i.debt_title ?? i.debtTitle ?? '', systemName: i.system_name ?? i.systemName ?? '',
          incidentContribution: Number(i.incident_contribution ?? i.incidentContribution ?? 0),
          velocityImpactPct: Number(i.velocity_impact_pct ?? i.velocityImpactPct ?? 0),
          securityRiskScore: Number(i.security_risk_score ?? i.securityRiskScore ?? 0),
          reliabilityImpact: i.reliability_impact ?? i.reliabilityImpact ?? 'none',
          costPerMonthUsd: Number(i.cost_per_month_usd ?? i.costPerMonthUsd ?? 0),
          assessedAt: i.assessed_at ?? i.assessedAt ?? '',
        })))
      }
      if (rRe.status === 'fulfilled') {
        const raw = Array.isArray(rRe.value) ? rRe.value : rRe.value.remediation ?? rRe.value.data ?? []
        setRemediation(raw.map((r: any) => ({
          planId: r.plan_id ?? r.planId ?? '', debtId: r.debt_id ?? r.debtId ?? '',
          debtTitle: r.debt_title ?? r.debtTitle ?? '', approach: r.approach ?? '',
          estimatedSprints: Number(r.estimated_sprints ?? r.estimatedSprints ?? 0),
          sprintsCompleted: Number(r.sprints_completed ?? r.sprintsCompleted ?? 0),
          progressPct: Number(r.progress_pct ?? r.progressPct ?? 0),
          requiredSkills: r.required_skills ?? r.requiredSkills ?? '',
          primaryOwner: r.primary_owner ?? r.primaryOwner ?? '',
          status: r.status ?? 'planned',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', debtId: a.debt_id ?? a.debtId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const criticalItems = items.filter(i => i.severity === 'critical' && i.status === 'open').length
  const openItems = items.filter(i => i.status === 'open').length
  const totalDebtDays = items.reduce((s, i) => s + i.estimatedDays, 0)
  const totalMonthlyCost = impact.reduce((s, i) => s + i.costPerMonthUsd, 0)

  const TABS2 = [
    { id: 'items' as const, label: 'ITEMS' },
    { id: 'retirement' as const, label: 'RETIREMENT' },
    { id: 'impact' as const, label: 'IMPACT' },
    { id: 'remediation' as const, label: 'REMEDIATION' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PLATFORM DEBT â€” TECH DEBT RETIREMENT + PRIORITIZATION + IMPACT ANALYSIS</span>
        {criticalItems > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {criticalItems} CRITICAL OPEN</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Open Items" value={openItems} col={openItems > 0 ? ORANGE : GREEN} />
        <StatCard label="Critical" value={criticalItems} col={criticalItems > 0 ? RED : GREEN} />
        <StatCard label="Total Est. Days" value={totalDebtDays} col={AMBER} />
        <StatCard label="Monthly Cost $" value={totalMonthlyCost > 0 ? `$${(totalMonthlyCost / 1000).toFixed(1)}k` : 'â€”'} col={ORANGE} />
        <StatCard label="Remediations" value={remediation.filter(r => r.status === 'active').length} col={BLUE} />
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

        {tab === 'items' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Debt Item</Th><Th>Category</Th><Th>Severity</Th><Th>Status</Th><Th right>Est Days</Th><Th right>Age Days</Th><Th right>Interest %</Th><Th>Owner</Th><Th>Systems</Th></tr></thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No debt items â€” check /api/v4/platform-debt/items</td></tr>}
                {items.sort((a, b) => {
                  const sp: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (sp[a.severity] ?? 4) - (sp[b.severity] ?? 4)
                }).map((item, i) => (
                  <tr key={i} style={{ background: item.severity === 'critical' && item.status === 'open' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{item.title.slice(0, 40)}{item.title.length > 40 ? 'â€¦' : ''}</Td>
                    <Td><CatBadge c={item.category} /></Td>
                    <Td><SevBadge s={item.severity} /></Td>
                    <Td><StatusBadge s={item.status} /></Td>
                    <Td right mono col={item.estimatedDays > 30 ? ORANGE : SUBTLE}>{item.estimatedDays}</Td>
                    <Td right mono col={item.agedays > 180 ? RED : item.agedays > 90 ? AMBER : SUBTLE}>{item.agedays}</Td>
                    <Td right mono col={item.interestRatePct > 10 ? ORANGE : SUBTLE}>{item.interestRatePct.toFixed(1)}%</Td>
                    <Td mono col={TEXT}>{item.owner}</Td>
                    <Td mono col={SUBTLE}>{item.affectedSystems.slice(0, 30) || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'retirement' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Retirement ID</Th><Th>Debt</Th><Th>Status</Th><Th>Assignee</Th><Th right>Effort Days</Th><Th right>Savings/yr Days</Th><Th>Planned</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {retirement.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No retirement records â€” check /api/v4/platform-debt/retirement</td></tr>}
                {retirement.sort((a, b) => a.status === 'slipped' ? -1 : 1).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'slipped' ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.retirementId}</Td>
                    <Td mono col={TEXT}>{r.debtTitle.slice(0, 36)}{r.debtTitle.length > 36 ? 'â€¦' : ''}</Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td mono col={BLUE}>{r.assignee}</Td>
                    <Td right mono col={r.effortDays > 20 ? ORANGE : SUBTLE}>{r.effortDays}</Td>
                    <Td right mono col={GREEN}>{r.savingsPerYearDays}</Td>
                    <Td mono col={SUBTLE}>{r.plannedDate || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.completedDate || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'impact' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Debt</Th><Th>System</Th><Th right>Incidents</Th><Th right>Velocity Hit %</Th><Th right>Security Risk</Th><Th>Reliability</Th><Th right>$/mo</Th><Th>Assessed</Th></tr></thead>
              <tbody>
                {impact.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No impact data â€” check /api/v4/platform-debt/impact</td></tr>}
                {impact.sort((a, b) => b.costPerMonthUsd - a.costPerMonthUsd).map((i, idx) => (
                  <tr key={idx} style={{ background: i.reliabilityImpact === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{i.debtTitle.slice(0, 28)}{i.debtTitle.length > 28 ? 'â€¦' : ''}</Td>
                    <Td mono col={BLUE}>{i.systemName}</Td>
                    <Td right mono col={i.incidentContribution > 5 ? ORANGE : SUBTLE}>{i.incidentContribution}</Td>
                    <Td right mono col={i.velocityImpactPct > 20 ? RED : i.velocityImpactPct > 10 ? AMBER : SUBTLE}>{i.velocityImpactPct.toFixed(1)}%</Td>
                    <Td right mono col={i.securityRiskScore >= 7 ? RED : i.securityRiskScore >= 4 ? AMBER : GREEN}>{i.securityRiskScore.toFixed(1)}</Td>
                    <Td><SevBadge s={i.reliabilityImpact === 'none' ? 'low' : i.reliabilityImpact} /></Td>
                    <Td right mono col={i.costPerMonthUsd > 10000 ? ORANGE : SUBTLE}>{i.costPerMonthUsd > 0 ? `$${i.costPerMonthUsd.toLocaleString()}` : 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{i.assessedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'remediation' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Debt</Th><Th>Approach</Th><Th>Status</Th><Th>Owner</Th><Th right>Sprints</Th><Th>Progress</Th><Th>Skills</Th></tr></thead>
              <tbody>
                {remediation.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No remediation plans â€” check /api/v4/platform-debt/remediation</td></tr>}
                {remediation.map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.debtTitle.slice(0, 32)}{r.debtTitle.length > 32 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{r.approach.slice(0, 32)}{r.approach.length > 32 ? 'â€¦' : ''}</Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td mono col={BLUE}>{r.primaryOwner}</Td>
                    <Td right mono col={SUBTLE}>{r.sprintsCompleted}/{r.estimatedSprints}</Td>
                    <Td><PctBar pct={r.progressPct} warnAt={50} /></Td>
                    <Td mono col={SUBTLE}>{r.requiredSkills.slice(0, 28)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Debt ID</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/platform-debt/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.debtId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge s={a.outcome} /></Td>
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
