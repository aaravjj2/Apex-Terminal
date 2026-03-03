import React, { useState, useEffect, useCallback } from 'react'
﻿// CostProfilerUI2 â€” Bloomberg COSP infrastructure cost profiling terminal
// Spend breakdown, optimization opportunities, budget tracking, anomaly detection, forecasting
// Tabs: SPEND OVERVIEW | BREAKDOWN | OPTIMIZATION | BUDGET | ANOMALIES
// APIs: /api/v4/cost-profiler/overview, /breakdown, /optimization, /budget, /anomalies

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

interface SpendOverview {
  totalMtd: number
  totalMom: number
  totalYtd: number
  forecastEom: number
  forecastYe: number
  currency: string
  budgetMtd: number
  budgetVariancePct: number
  categories: { name: string; amount: number; pct: number }[]
}

interface CostBreakdown {
  service: string
  category: string
  team: string
  environment: string
  mtdCost: number
  prevMtdCost: number
  changePct: number
  unit: string
  unitCost: number
  quantity: number
}

interface OptimizationOpportunity {
  id: string
  service: string
  opportunityType: 'rightsizing' | 'reserved_instance' | 'spot_usage' | 'idle_resource' | 'data_transfer' | 'storage_tiering'
  currentCostMonthly: number
  optimizedCostMonthly: number
  savingsMonthly: number
  savingsPct: number
  effort: 'low' | 'medium' | 'high'
  status: 'new' | 'in_progress' | 'implemented' | 'dismissed'
  description: string
}

interface BudgetEntry {
  team: string
  category: string
  budgetMonthly: number
  budgetYearly: number
  spentMtd: number
  forecastEom: number
  utilizationPct: number
  overagePct: number
  owner: string
}

interface CostAnomaly {
  id: string
  service: string
  anomalyDate: string
  expectedCost: number
  actualCost: number
  deviationPct: number
  severity: 'critical' | 'high' | 'medium'
  status: 'investigating' | 'resolved' | 'acknowledged'
  rootCause?: string
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

function BudgetBar({ pct }: { pct: number }) {
  const c = pct >= 100 ? RED : pct >= 85 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

function OptTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { rightsizing: BLUE, reserved_instance: GREEN, spot_usage: PURPLE, idle_resource: RED, data_transfer: ORANGE, storage_tiering: AMBER }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{t.replace(/_/g, ' ').toUpperCase()}</span>
}

function EffortBadge({ e }: { e: string }) {
  const m: Record<string, string> = { low: GREEN, medium: AMBER, high: RED }
  const c = m[e] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{e.toUpperCase()}</span>
}

function ChangePct({ pct }: { pct: number }) {
  const c = pct > 10 ? RED : pct > 5 ? AMBER : pct < -5 ? GREEN : SUBTLE
  const icon = pct > 0 ? 'â–²' : pct < 0 ? 'â–¼' : 'â€”'
  return <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{icon} {Math.abs(pct).toFixed(1)}%</span>
}


export function CostProfilerUI2() {
  const [tab, setTab] = useState<'overview' | 'breakdown' | 'optimization' | 'budget' | 'anomalies'>('overview')
  const [overview, setOverview] = useState<SpendOverview | null>(null)
  const [breakdown, setBreakdown] = useState<CostBreakdown[]>([])
  const [optimization, setOptimization] = useState<OptimizationOpportunity[]>([])
  const [budget, setBudget] = useState<BudgetEntry[]>([])
  const [anomalies, setAnomalies] = useState<CostAnomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [envFilter, setEnvFilter] = useState<string>('all')
  const [optFilter, setOptFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rO, rB, rOp, rBu, rA] = await Promise.allSettled([
        fetch('/api/v4/cost-profiler/overview').then(r => r.ok ? r.json() : null),
        fetch('/api/v4/cost-profiler/breakdown').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cost-profiler/optimization').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cost-profiler/budget').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/cost-profiler/anomalies').then(r => r.ok ? r.json() : []),
      ])
      if (rO.status === 'fulfilled' && rO.value) {
        const d = rO.value
        setOverview({
          totalMtd: Number(d.total_mtd ?? d.totalMtd ?? 0), totalMom: Number(d.total_mom ?? d.totalMom ?? 0),
          totalYtd: Number(d.total_ytd ?? d.totalYtd ?? 0), forecastEom: Number(d.forecast_eom ?? d.forecastEom ?? 0),
          forecastYe: Number(d.forecast_ye ?? d.forecastYe ?? 0), currency: d.currency ?? 'USD',
          budgetMtd: Number(d.budget_mtd ?? d.budgetMtd ?? 0), budgetVariancePct: Number(d.budget_variance_pct ?? d.budgetVariancePct ?? 0),
          categories: Array.isArray(d.categories) ? d.categories.map((c: any) => ({ name: c.name ?? '', amount: Number(c.amount ?? 0), pct: Number(c.pct ?? 0) })) : [],
        })
        setErr(null)
      } else setErr('Failed to load cost overview')
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.breakdown ?? rB.value.data ?? []
        setBreakdown(raw.map((b: any) => ({
          service: b.service ?? '', category: b.category ?? '', team: b.team ?? '', environment: b.environment ?? '',
          mtdCost: Number(b.mtd_cost ?? b.mtdCost ?? 0), prevMtdCost: Number(b.prev_mtd_cost ?? b.prevMtdCost ?? 0),
          changePct: Number(b.change_pct ?? b.changePct ?? 0), unit: b.unit ?? '',
          unitCost: Number(b.unit_cost ?? b.unitCost ?? 0), quantity: Number(b.quantity ?? 0),
        })))
      }
      if (rOp.status === 'fulfilled') {
        const raw = Array.isArray(rOp.value) ? rOp.value : rOp.value.opportunities ?? rOp.value.data ?? []
        setOptimization(raw.map((o: any) => ({
          id: o.id ?? '', service: o.service ?? '', opportunityType: o.opportunity_type ?? o.opportunityType ?? 'rightsizing',
          currentCostMonthly: Number(o.current_cost_monthly ?? o.currentCostMonthly ?? 0),
          optimizedCostMonthly: Number(o.optimized_cost_monthly ?? o.optimizedCostMonthly ?? 0),
          savingsMonthly: Number(o.savings_monthly ?? o.savingsMonthly ?? 0),
          savingsPct: Number(o.savings_pct ?? o.savingsPct ?? 0), effort: o.effort ?? 'medium',
          status: o.status ?? 'new', description: o.description ?? '',
        })))
      }
      if (rBu.status === 'fulfilled') {
        const raw = Array.isArray(rBu.value) ? rBu.value : rBu.value.budget ?? rBu.value.data ?? []
        setBudget(raw.map((b: any) => ({
          team: b.team ?? '', category: b.category ?? '', budgetMonthly: Number(b.budget_monthly ?? b.budgetMonthly ?? 0),
          budgetYearly: Number(b.budget_yearly ?? b.budgetYearly ?? 0), spentMtd: Number(b.spent_mtd ?? b.spentMtd ?? 0),
          forecastEom: Number(b.forecast_eom ?? b.forecastEom ?? 0), utilizationPct: Number(b.utilization_pct ?? b.utilizationPct ?? 0),
          overagePct: Number(b.overage_pct ?? b.overagePct ?? 0), owner: b.owner ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.anomalies ?? rA.value.data ?? []
        setAnomalies(raw.map((a: any) => ({
          id: a.id ?? '', service: a.service ?? '', anomalyDate: a.anomaly_date ?? a.anomalyDate ?? '',
          expectedCost: Number(a.expected_cost ?? a.expectedCost ?? 0), actualCost: Number(a.actual_cost ?? a.actualCost ?? 0),
          deviationPct: Number(a.deviation_pct ?? a.deviationPct ?? 0), severity: a.severity ?? 'medium',
          status: a.status ?? 'investigating', rootCause: a.root_cause ?? a.rootCause,
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 60000); return () => clearInterval(id) }, [fetchAll])

  const totalSavings = optimization.filter(o => o.status !== 'dismissed').reduce((s, o) => s + o.savingsMonthly, 0)
  const activeAnomalies = anomalies.filter(a => a.status !== 'resolved').length
  const overBudget = budget.filter(b => b.utilizationPct >= 100).length
  const filteredBreakdown = breakdown.filter(b => envFilter === 'all' || b.environment.toLowerCase() === envFilter)
  const filteredOpt = optimization.filter(o => optFilter === 'all' || o.status === optFilter)

  const environments = [...new Set(breakdown.map(b => b.environment.toLowerCase()).filter(Boolean))]
  const currency = overview?.currency ?? 'USD'

  const TABS = [
    { id: 'overview' as const, label: 'SPEND OVERVIEW' },
    { id: 'breakdown' as const, label: 'BREAKDOWN' },
    { id: 'optimization' as const, label: 'OPTIMIZATION' },
    { id: 'budget' as const, label: 'BUDGET' },
    { id: 'anomalies' as const, label: 'ANOMALIES' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>COSP</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>COST PROFILER â€” SPEND + BREAKDOWN + OPTIMIZATION + BUDGET + ANOMALY DETECTION</span>
        {totalSavings > 0 && <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>â–¼ ${totalSavings.toLocaleString()}/mo SAVINGS AVAILABLE</span>}
        {overBudget > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {overBudget} TEAMS OVER BUDGET</span>}
        {activeAnomalies > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {activeAnomalies} ACTIVE ANOMALIES</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="MTD Spend" value={overview ? `$${(overview.totalMtd / 1000).toFixed(1)}K` : 'â€”'} col={overview && overview.budgetVariancePct > 10 ? RED : TEXT} />
        <StatCard label="Budget MTD" value={overview ? `$${(overview.budgetMtd / 1000).toFixed(1)}K` : 'â€”'} col={BLUE} />
        <StatCard label="Forecast EOM" value={overview ? `$${(overview.forecastEom / 1000).toFixed(1)}K` : 'â€”'} col={AMBER} />
        <StatCard label="Savings Available" value={totalSavings > 0 ? `$${totalSavings.toLocaleString()}/mo` : '$0'} col={GREEN} />
        <StatCard label="Active Anomalies" value={activeAnomalies} col={activeAnomalies > 0 ? ORANGE : GREEN} />
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE, background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`, padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>MTD vs Budget</div>
                <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: overview?.budgetVariancePct && overview.budgetVariancePct > 10 ? RED : TEXT }}>{overview ? `${currency} ${overview.totalMtd.toLocaleString()}` : 'â€”'}</div>
                <BudgetBar pct={overview ? (overview.totalMtd / overview.budgetMtd) * 100 : 0} />
                <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, marginTop: 4 }}>Budget: {currency} {overview?.budgetMtd.toLocaleString() ?? 'â€”'}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>MoM Change</div>
                <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: overview?.totalMom && overview.totalMom > 0 ? RED : GREEN }}><ChangePct pct={overview?.totalMom ?? 0} /></div>
                <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, marginTop: 4 }}>YTD: {currency} {overview?.totalYtd.toLocaleString() ?? 'â€”'}</div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Year-End Forecast</div>
                <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: AMBER }}>{overview ? `${currency} ${(overview.forecastYe / 1000).toFixed(0)}K` : 'â€”'}</div>
                <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, marginTop: 4 }}>EOM: {currency} {overview?.forecastEom.toLocaleString() ?? 'â€”'}</div>
              </div>
            </div>
            {overview && overview.categories.length > 0 && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1 }}>Top Cost Categories</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>Category</Th><Th right>Amount</Th><Th right>% of Total</Th></tr></thead>
                  <tbody>
                    {overview.categories.sort((a, b) => b.amount - a.amount).map((c, i) => (
                      <tr key={i}>
                        <Td mono col={AMBER}>{c.name}</Td>
                        <Td right mono col={ORANGE}>{currency} {c.amount.toLocaleString()}</Td>
                        <Td right mono col={TEXT}>{c.pct.toFixed(1)}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'breakdown' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['all', ...environments].map(e => (
                <button key={e} onClick={() => setEnvFilter(e)}
                  style={{ fontFamily: MONO, fontSize: 10, color: envFilter === e ? AMBER : SUBTLE, background: envFilter === e ? AMBER + '22' : 'transparent', border: `1px solid ${envFilter === e ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {e === 'all' ? 'ALL' : e.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Service</Th><Th>Category</Th><Th>Team</Th><Th>Environment</Th><Th right>MTD Cost</Th><Th right>Prev MTD</Th><Th right>Change</Th><Th right>Unit Cost</Th></tr></thead>
                <tbody>
                  {filteredBreakdown.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No data â€” check /api/v4/cost-profiler/breakdown</td></tr>}
                  {filteredBreakdown.sort((a, b) => b.mtdCost - a.mtdCost).map((b, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{b.service}</Td>
                      <Td mono col={BLUE}>{b.category}</Td>
                      <Td mono col={SUBTLE}>{b.team}</Td>
                      <Td mono col={SUBTLE}>{b.environment}</Td>
                      <Td right mono col={ORANGE}>${b.mtdCost.toLocaleString()}</Td>
                      <Td right mono col={SUBTLE}>${b.prevMtdCost.toLocaleString()}</Td>
                      <Td right><ChangePct pct={b.changePct} /></Td>
                      <Td right mono col={SUBTLE}>${b.unitCost.toFixed(4)}/{b.unit || 'unit'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'optimization' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              {['all', 'new', 'in_progress', 'implemented', 'dismissed'].map(s => (
                <button key={s} onClick={() => setOptFilter(s)}
                  style={{ fontFamily: MONO, fontSize: 10, color: optFilter === s ? AMBER : SUBTLE, background: optFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${optFilter === s ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {s === 'all' ? 'ALL' : s.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
              <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN, marginLeft: 'auto' }}>Total savings: ${totalSavings.toLocaleString()}/mo</span>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Service</Th><Th>Type</Th><Th>Status</Th><Th>Effort</Th><Th right>Current $/mo</Th><Th right>Opt $/mo</Th><Th right>Savings/mo</Th><Th right>Save %</Th></tr></thead>
                <tbody>
                  {filteredOpt.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No opportunities â€” check /api/v4/cost-profiler/optimization</td></tr>}
                  {filteredOpt.sort((a, b) => b.savingsMonthly - a.savingsMonthly).map((o, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{o.service}</Td>
                      <Td><OptTypeBadge t={o.opportunityType} /></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: o.status === 'implemented' ? GREEN : o.status === 'in_progress' ? BLUE : o.status === 'dismissed' ? SUBTLE : AMBER }}>{o.status.replace(/_/g, ' ').toUpperCase()}</span></Td>
                      <Td><EffortBadge e={o.effort} /></Td>
                      <Td right mono col={RED}>${o.currentCostMonthly.toLocaleString()}</Td>
                      <Td right mono col={GREEN}>${o.optimizedCostMonthly.toLocaleString()}</Td>
                      <Td right mono col={GREEN}>${o.savingsMonthly.toLocaleString()}</Td>
                      <Td right mono col={o.savingsPct > 30 ? GREEN : AMBER}>{o.savingsPct.toFixed(1)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'budget' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Team</Th><Th>Category</Th><Th>Utilization</Th><Th right>Budget/mo</Th><Th right>Spent MTD</Th><Th right>Forecast EOM</Th><Th right>Overage %</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {budget.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No budget data â€” check /api/v4/cost-profiler/budget</td></tr>}
                {budget.sort((a, b) => b.utilizationPct - a.utilizationPct).map((b, i) => (
                  <tr key={i} style={{ background: b.utilizationPct >= 100 ? RED + '0a' : b.utilizationPct >= 85 ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.team}</Td>
                    <Td mono col={BLUE}>{b.category}</Td>
                    <Td><BudgetBar pct={b.utilizationPct} /></Td>
                    <Td right mono col={SUBTLE}>${b.budgetMonthly.toLocaleString()}</Td>
                    <Td right mono col={ORANGE}>${b.spentMtd.toLocaleString()}</Td>
                    <Td right mono col={b.forecastEom > b.budgetMonthly ? RED : TEXT}>${b.forecastEom.toLocaleString()}</Td>
                    <Td right mono col={b.overagePct > 0 ? RED : GREEN}>{b.overagePct > 0 ? '+' : ''}{b.overagePct.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{b.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'anomalies' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Service</Th><Th>Date</Th><Th>Severity</Th><Th>Status</Th><Th right>Expected</Th><Th right>Actual</Th><Th right>Deviation</Th><Th>Root Cause</Th></tr></thead>
              <tbody>
                {anomalies.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No anomalies â€” check /api/v4/cost-profiler/anomalies</td></tr>}
                {anomalies.sort((a, b) => b.deviationPct - a.deviationPct).map((a, i) => (
                  <tr key={i} style={{ background: a.severity === 'critical' && a.status !== 'resolved' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.service}</Td>
                    <Td mono col={SUBTLE}>{a.anomalyDate}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.severity === 'critical' ? RED : a.severity === 'high' ? ORANGE : AMBER }}>{a.severity.toUpperCase()}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: a.status === 'resolved' ? GREEN : a.status === 'investigating' ? ORANGE : BLUE }}>{a.status.toUpperCase()}</span></Td>
                    <Td right mono col={SUBTLE}>${a.expectedCost.toLocaleString()}</Td>
                    <Td right mono col={RED}>${a.actualCost.toLocaleString()}</Td>
                    <Td right mono col={RED}>+{a.deviationPct.toFixed(1)}%</Td>
                    <Td><span style={{ fontSize: 10, color: SUBTLE }}>{a.rootCause ?? 'â€”'}</span></Td>
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
