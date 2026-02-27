import React, { useState, useEffect, useCallback } from 'react'
﻿// ReliabilityEconUI2 â€” Bloomberg APEX reliability economics terminal
// Error budgets, SLO economics, investment analysis, cost of unreliability
// Tabs: ERROR BUDGETS | SERVICES | INVESTMENTS | INCIDENTS | AUDIT
// APIs: /api/v4/reliability-econ/error-budgets, /services, /investments, /incidents, /audit

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

interface ErrorBudget {
  budgetId: string
  service: string
  sloName: string
  sloTargetPct: number
  currentAvailabilityPct: number
  budgetTotalMinutes: number
  budgetConsumedMinutes: number
  budgetRemainingMinutes: number
  burnRateMultiple: number
  burnRateStatus: 'nominal' | 'elevated' | 'critical' | 'exhausted'
  windowDays: number
  costPerMinuteDowntime: number
  projectedExhaustionAt: string
}

interface ReliabilityService {
  serviceId: string
  name: string
  tier: 'tier1' | 'tier2' | 'tier3'
  annualRevenueAtRisk: number
  costOfUnreliabilityYtd: number
  reliabilityScore: number
  mttr: number
  mtbf: number
  availabilityPct: number
  incidentsLast90d: number
}

interface ReliabilityInvestment {
  investmentId: string
  name: string
  type: 'infrastructure' | 'observability' | 'automation' | 'tooling' | 'capacity'
  costUsd: number
  projectedSavingsUsd: number
  roi: number
  paybackMonths: number
  reliabilityGainPct: number
  status: 'proposed' | 'approved' | 'in_flight' | 'completed'
  priorityScore: number
}

interface ReliabilityIncident {
  incidentId: string
  service: string
  severity: 'sev1' | 'sev2' | 'sev3'
  durationMin: number
  impactedUsers: number
  revenueImpactUsd: number
  mttrMin: number
  rootCause: string
  startedAt: string
}

interface ReliabilityAuditEntry {
  auditId: string
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
function BurnStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { nominal: GREEN, elevated: AMBER, critical: ORANGE, exhausted: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function BudgetBar({ consumed, total }: { consumed: number; total: number }) {
  const pct = total > 0 ? (consumed / total) * 100 : 0
  const col = pct >= 100 ? RED : pct >= 75 ? ORANGE : pct >= 50 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 56, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(0)}%</span>
    </div>
  )
}
function TierBadge({ t }: { t: string }) {
  const m: Record<string, string> = { tier1: RED, tier2: AMBER, tier3: BLUE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function InvestStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { proposed: SUBTLE, approved: BLUE, in_flight: AMBER, completed: GREEN }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { sev1: RED, sev2: ORANGE, sev3: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function Usd({ v }: { v: number }) {
  const col = v > 100000 ? RED : v > 10000 ? ORANGE : v > 1000 ? AMBER : TEXT
  const fmt = v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`
  return <span style={{ fontFamily: MONO, fontSize: 11, color: col }}>{fmt}</span>
}


export function ReliabilityEconUI2() {
  const [tab, setTab] = useState<'error-budgets' | 'services' | 'investments' | 'incidents' | 'audit'>('error-budgets')
  const [errorBudgets, setErrorBudgets] = useState<ErrorBudget[]>([])
  const [services, setServices] = useState<ReliabilityService[]>([])
  const [investments, setInvestments] = useState<ReliabilityInvestment[]>([])
  const [incidents, setIncidents] = useState<ReliabilityIncident[]>([])
  const [auditLog, setAuditLog] = useState<ReliabilityAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rE, rS, rI, rInc, rA] = await Promise.allSettled([
        fetch('/api/v4/reliability-econ/error-budgets').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reliability-econ/services').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reliability-econ/investments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reliability-econ/incidents').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reliability-econ/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.error_budgets ?? rE.value.data ?? []
        setErrorBudgets(raw.map((e: any) => ({
          budgetId: e.budget_id ?? e.budgetId ?? '', service: e.service ?? '',
          sloName: e.slo_name ?? e.sloName ?? '',
          sloTargetPct: Number(e.slo_target_pct ?? e.sloTargetPct ?? 99.9),
          currentAvailabilityPct: Number(e.current_availability_pct ?? e.currentAvailabilityPct ?? 0),
          budgetTotalMinutes: Number(e.budget_total_minutes ?? e.budgetTotalMinutes ?? 0),
          budgetConsumedMinutes: Number(e.budget_consumed_minutes ?? e.budgetConsumedMinutes ?? 0),
          budgetRemainingMinutes: Number(e.budget_remaining_minutes ?? e.budgetRemainingMinutes ?? 0),
          burnRateMultiple: Number(e.burn_rate_multiple ?? e.burnRateMultiple ?? 1),
          burnRateStatus: e.burn_rate_status ?? e.burnRateStatus ?? 'nominal',
          windowDays: Number(e.window_days ?? e.windowDays ?? 30),
          costPerMinuteDowntime: Number(e.cost_per_minute_downtime ?? e.costPerMinuteDowntime ?? 0),
          projectedExhaustionAt: e.projected_exhaustion_at ?? e.projectedExhaustionAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load error budgets')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.services ?? rS.value.data ?? []
        setServices(raw.map((s: any) => ({
          serviceId: s.service_id ?? s.serviceId ?? '', name: s.name ?? '',
          tier: s.tier ?? 'tier3',
          annualRevenueAtRisk: Number(s.annual_revenue_at_risk ?? s.annualRevenueAtRisk ?? 0),
          costOfUnreliabilityYtd: Number(s.cost_of_unreliability_ytd ?? s.costOfUnreliabilityYtd ?? 0),
          reliabilityScore: Number(s.reliability_score ?? s.reliabilityScore ?? 0),
          mttr: Number(s.mttr ?? 0), mtbf: Number(s.mtbf ?? 0),
          availabilityPct: Number(s.availability_pct ?? s.availabilityPct ?? 0),
          incidentsLast90d: Number(s.incidents_last_90d ?? s.incidentsLast90d ?? 0),
        })))
      }
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.investments ?? rI.value.data ?? []
        setInvestments(raw.map((i: any) => ({
          investmentId: i.investment_id ?? i.investmentId ?? '', name: i.name ?? '',
          type: i.type ?? 'infrastructure', costUsd: Number(i.cost_usd ?? i.costUsd ?? 0),
          projectedSavingsUsd: Number(i.projected_savings_usd ?? i.projectedSavingsUsd ?? 0),
          roi: Number(i.roi ?? 0), paybackMonths: Number(i.payback_months ?? i.paybackMonths ?? 0),
          reliabilityGainPct: Number(i.reliability_gain_pct ?? i.reliabilityGainPct ?? 0),
          status: i.status ?? 'proposed', priorityScore: Number(i.priority_score ?? i.priorityScore ?? 0),
        })))
      }
      if (rInc.status === 'fulfilled') {
        const raw = Array.isArray(rInc.value) ? rInc.value : rInc.value.incidents ?? rInc.value.data ?? []
        setIncidents(raw.map((i: any) => ({
          incidentId: i.incident_id ?? i.incidentId ?? '', service: i.service ?? '',
          severity: i.severity ?? 'sev3', durationMin: Number(i.duration_min ?? i.durationMin ?? 0),
          impactedUsers: Number(i.impacted_users ?? i.impactedUsers ?? 0),
          revenueImpactUsd: Number(i.revenue_impact_usd ?? i.revenueImpactUsd ?? 0),
          mttrMin: Number(i.mttr_min ?? i.mttrMin ?? 0), rootCause: i.root_cause ?? i.rootCause ?? '',
          startedAt: i.started_at ?? i.startedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const exhaustedBudgets = errorBudgets.filter(e => e.burnRateStatus === 'exhausted').length
  const criticalBudgets = errorBudgets.filter(e => e.burnRateStatus === 'critical').length
  const totalCostOfUnreliability = services.reduce((acc, s) => acc + s.costOfUnreliabilityYtd, 0)

  const TABS2 = [
    { id: 'error-budgets' as const, label: 'ERROR BUDGETS' },
    { id: 'services' as const, label: 'SERVICES' },
    { id: 'investments' as const, label: 'INVESTMENTS' },
    { id: 'incidents' as const, label: 'INCIDENTS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RELIABILITY ECONOMICS â€” ERROR BUDGETS + SLO TRACKING + COST OF UNRELIABILITY</span>
        {exhaustedBudgets > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {exhaustedBudgets} BUDGET EXHAUSTED</span>}
        {criticalBudgets > 0 && <span style={{ fontSize: 10, color: ORANGE }}>âš‘ {criticalBudgets} CRITICAL BURN</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Error Budgets" value={errorBudgets.length} col={BLUE} />
        <StatCard label="Exhausted" value={exhaustedBudgets} col={exhaustedBudgets > 0 ? RED : GREEN} />
        <StatCard label="Critical Burn" value={criticalBudgets} col={criticalBudgets > 0 ? ORANGE : GREEN} />
        <StatCard label="Cost YTD" value={totalCostOfUnreliability >= 1e6 ? `$${(totalCostOfUnreliability / 1e6).toFixed(2)}M` : `$${(totalCostOfUnreliability / 1e3).toFixed(0)}K`} col={RED} />
        <StatCard label="Investments" value={investments.length} col={PURPLE} />
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

        {tab === 'error-budgets' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Service</Th><Th>SLO</Th><Th right>Target %</Th><Th right>Actual %</Th><Th>Budget Consumed</Th><Th right>Burn Rate x</Th><Th>Status</Th><Th right>$/min Down</Th><Th>Exhaustion</Th></tr></thead>
              <tbody>
                {errorBudgets.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No error budgets â€” check /api/v4/reliability-econ/error-budgets</td></tr>}
                {errorBudgets.sort((a, b) => (b.burnRateMultiple) - (a.burnRateMultiple)).map((e, i) => (
                  <tr key={i} style={{ background: e.burnRateStatus === 'exhausted' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.service}</Td>
                    <Td mono col={BLUE}>{e.sloName}</Td>
                    <Td right mono col={SUBTLE}>{e.sloTargetPct.toFixed(3)}%</Td>
                    <Td right mono col={e.currentAvailabilityPct >= e.sloTargetPct ? GREEN : RED}>{e.currentAvailabilityPct.toFixed(3)}%</Td>
                    <Td><BudgetBar consumed={e.budgetConsumedMinutes} total={e.budgetTotalMinutes} /></Td>
                    <Td right mono col={e.burnRateMultiple > 5 ? RED : e.burnRateMultiple > 2 ? ORANGE : GREEN}>{e.burnRateMultiple.toFixed(2)}x</Td>
                    <Td><BurnStatusBadge s={e.burnRateStatus} /></Td>
                    <Td right><Usd v={e.costPerMinuteDowntime} /></Td>
                    <Td mono col={e.projectedExhaustionAt ? ORANGE : SUBTLE}>{e.projectedExhaustionAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'services' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Service</Th><Th>Tier</Th><Th right>Revenue at Risk</Th><Th right>Cost/Unreliab YTD</Th><Th right>Score</Th><Th right>MTTR m</Th><Th right>MTBF h</Th><Th right>Avail %</Th><Th right>Incidents 90d</Th></tr></thead>
              <tbody>
                {services.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No services â€” check /api/v4/reliability-econ/services</td></tr>}
                {services.sort((a, b) => b.costOfUnreliabilityYtd - a.costOfUnreliabilityYtd).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.name}</Td>
                    <Td><TierBadge t={s.tier} /></Td>
                    <Td right><Usd v={s.annualRevenueAtRisk} /></Td>
                    <Td right><Usd v={s.costOfUnreliabilityYtd} /></Td>
                    <Td right mono col={s.reliabilityScore >= 80 ? GREEN : s.reliabilityScore >= 60 ? AMBER : RED}>{s.reliabilityScore.toFixed(0)}</Td>
                    <Td right mono col={s.mttr < 15 ? GREEN : s.mttr < 30 ? AMBER : RED}>{s.mttr.toFixed(0)}</Td>
                    <Td right mono col={s.mtbf > 720 ? GREEN : s.mtbf > 168 ? AMBER : RED}>{s.mtbf.toFixed(0)}</Td>
                    <Td right mono col={s.availabilityPct >= 99.9 ? GREEN : s.availabilityPct >= 99 ? AMBER : RED}>{s.availabilityPct.toFixed(3)}%</Td>
                    <Td right mono col={s.incidentsLast90d > 5 ? RED : s.incidentsLast90d > 2 ? ORANGE : SUBTLE}>{s.incidentsLast90d}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'investments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Investment</Th><Th>Type</Th><Th>Status</Th><Th right>Cost</Th><Th right>Projected Savings</Th><Th right>ROI %</Th><Th right>Payback mo</Th><Th right>Reliability Gain</Th><Th right>Priority</Th></tr></thead>
              <tbody>
                {investments.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No investments â€” check /api/v4/reliability-econ/investments</td></tr>}
                {investments.sort((a, b) => b.priorityScore - a.priorityScore).map((inv, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{inv.name}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{inv.type.toUpperCase()}</span></Td>
                    <Td><InvestStatusBadge s={inv.status} /></Td>
                    <Td right><Usd v={inv.costUsd} /></Td>
                    <Td right><Usd v={inv.projectedSavingsUsd} /></Td>
                    <Td right mono col={inv.roi > 200 ? GREEN : inv.roi > 100 ? AMBER : ORANGE}>{inv.roi.toFixed(0)}%</Td>
                    <Td right mono col={inv.paybackMonths < 6 ? GREEN : inv.paybackMonths < 12 ? AMBER : ORANGE}>{inv.paybackMonths.toFixed(0)}</Td>
                    <Td right mono col={GREEN}>{inv.reliabilityGainPct.toFixed(2)}%</Td>
                    <Td right mono col={inv.priorityScore >= 8 ? RED : inv.priorityScore >= 5 ? AMBER : SUBTLE}>{inv.priorityScore.toFixed(0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'incidents' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Incident ID</Th><Th>Service</Th><Th>Severity</Th><Th right>Duration m</Th><Th right>Users Impacted</Th><Th right>Revenue Impact</Th><Th right>MTTR m</Th><Th>Root Cause</Th><Th>Started At</Th></tr></thead>
              <tbody>
                {incidents.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No incidents â€” check /api/v4/reliability-econ/incidents</td></tr>}
                {incidents.sort((a, b) => b.revenueImpactUsd - a.revenueImpactUsd).map((inc, i) => (
                  <tr key={i} style={{ background: inc.severity === 'sev1' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{inc.incidentId}</Td>
                    <Td mono col={BLUE}>{inc.service}</Td>
                    <Td><SevBadge s={inc.severity} /></Td>
                    <Td right mono col={inc.durationMin > 60 ? RED : inc.durationMin > 30 ? ORANGE : AMBER}>{inc.durationMin.toFixed(0)}</Td>
                    <Td right mono col={TEXT}>{inc.impactedUsers.toLocaleString()}</Td>
                    <Td right><Usd v={inc.revenueImpactUsd} /></Td>
                    <Td right mono col={inc.mttrMin < 15 ? GREEN : inc.mttrMin < 30 ? AMBER : RED}>{inc.mttrMin.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{inc.rootCause || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{inc.startedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/reliability-econ/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
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
