import React, { useState, useEffect, useCallback } from 'react'
﻿// CapacityPlanUI2 â€” Bloomberg CAPA-grade capacity planning terminal
// Resource utilization, forecasting, allocation, budget constraints, scaling recommendations
// Tabs: UTILIZATION | FORECAST | ALLOCATION | CONSTRAINTS | SCALING
// APIs: /api/v4/capacity-plan/utilization, /forecast, /allocation, /constraints, /scaling

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

interface UtilizationEntry {
  resource: string
  category: 'compute' | 'memory' | 'storage' | 'network' | 'gpu' | 'license'
  currentCapacity: number
  usedCapacity: number
  utilizationPct: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  trendPct: number
  peakUtilization: number
  environment: string
}

interface ForecastEntry {
  resource: string
  currentUsage: number
  forecast30d: number
  forecast90d: number
  forecast180d: number
  unit: string
  growthRatePctMonthly: number
  daysUntilCapacity: number
  confidencePct: number
}

interface AllocationRecord {
  team: string
  project: string
  resource: string
  allocatedAmount: number
  usedAmount: number
  efficiencyPct: number
  unit: string
  costUsd: number
  expiresAt: string
}

interface ConstraintEntry {
  resource: string
  constraint: string
  currentValue: number
  limit: number
  unit: string
  severity: 'critical' | 'warning' | 'ok'
  margin: number
}

interface ScalingRecommendation {
  resource: string
  currentCapacity: number
  recommendedCapacity: number
  unit: string
  reasoning: string
  estimatedCostImpactUsd: number
  urgency: 'immediate' | 'soon' | 'planned' | 'low'
  confidencePct: number
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

function UtilBar({ pct }: { pct: number }) {
  const c = pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

function CatBadge({ c }: { c: string }) {
  const m: Record<string, string> = { compute: BLUE, memory: PURPLE, storage: ORANGE, network: GREEN, gpu: AMBER, license: RED }
  const col = m[c] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 6px' }}>{c.toUpperCase()}</span>
}

function UrgencyBadge({ u }: { u: string }) {
  const m: Record<string, string> = { immediate: RED, soon: ORANGE, planned: AMBER, low: BLUE }
  const c = m[u] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{u.toUpperCase()}</span>
}

function TrendIndicator({ trend, pct }: { trend: string; pct: number }) {
  return <span style={{ fontFamily: MONO, fontSize: 10, color: trend === 'up' ? RED : trend === 'down' ? GREEN : SUBTLE }}>{trend === 'up' ? 'â–²' : trend === 'down' ? 'â–¼' : 'â€”'} {Math.abs(pct).toFixed(1)}%</span>
}


export function CapacityPlanUI2() {
  const [tab, setTab] = useState<'utilization' | 'forecast' | 'allocation' | 'constraints' | 'scaling'>('utilization')
  const [utilization, setUtilization] = useState<UtilizationEntry[]>([])
  const [forecast, setForecast] = useState<ForecastEntry[]>([])
  const [allocation, setAllocation] = useState<AllocationRecord[]>([])
  const [constraints, setConstraints] = useState<ConstraintEntry[]>([])
  const [scaling, setScaling] = useState<ScalingRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rU, rF, rA, rC, rS] = await Promise.allSettled([
        fetch('/api/v4/capacity-plan/utilization').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/capacity-plan/forecast').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/capacity-plan/allocation').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/capacity-plan/constraints').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/capacity-plan/scaling').then(r => r.ok ? r.json() : []),
      ])
      if (rU.status === 'fulfilled') {
        const raw = Array.isArray(rU.value) ? rU.value : rU.value.utilization ?? rU.value.data ?? []
        setUtilization(raw.map((u: any) => ({
          resource: u.resource ?? '', category: u.category ?? 'compute',
          currentCapacity: Number(u.current_capacity ?? u.currentCapacity ?? 0),
          usedCapacity: Number(u.used_capacity ?? u.usedCapacity ?? 0),
          utilizationPct: Number(u.utilization_pct ?? u.utilizationPct ?? 0),
          unit: u.unit ?? '', trend: u.trend ?? 'stable', trendPct: Number(u.trend_pct ?? u.trendPct ?? 0),
          peakUtilization: Number(u.peak_utilization ?? u.peakUtilization ?? 0),
          environment: u.environment ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load utilization data')
      if (rF.status === 'fulfilled') {
        const raw = Array.isArray(rF.value) ? rF.value : rF.value.forecast ?? rF.value.data ?? []
        setForecast(raw.map((f: any) => ({
          resource: f.resource ?? '', currentUsage: Number(f.current_usage ?? f.currentUsage ?? 0),
          forecast30d: Number(f.forecast_30d ?? f.forecast30d ?? 0), forecast90d: Number(f.forecast_90d ?? f.forecast90d ?? 0),
          forecast180d: Number(f.forecast_180d ?? f.forecast180d ?? 0), unit: f.unit ?? '',
          growthRatePctMonthly: Number(f.growth_rate_pct_monthly ?? f.growthRatePctMonthly ?? 0),
          daysUntilCapacity: Number(f.days_until_capacity ?? f.daysUntilCapacity ?? 9999),
          confidencePct: Number(f.confidence_pct ?? f.confidencePct ?? 0),
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.allocation ?? rA.value.data ?? []
        setAllocation(raw.map((a: any) => ({
          team: a.team ?? '', project: a.project ?? '', resource: a.resource ?? '',
          allocatedAmount: Number(a.allocated_amount ?? a.allocatedAmount ?? 0),
          usedAmount: Number(a.used_amount ?? a.usedAmount ?? 0),
          efficiencyPct: Number(a.efficiency_pct ?? a.efficiencyPct ?? 0),
          unit: a.unit ?? '', costUsd: Number(a.cost_usd ?? a.costUsd ?? 0), expiresAt: a.expires_at ?? a.expiresAt ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.constraints ?? rC.value.data ?? []
        setConstraints(raw.map((c: any) => ({
          resource: c.resource ?? '', constraint: c.constraint ?? '',
          currentValue: Number(c.current_value ?? c.currentValue ?? 0),
          limit: Number(c.limit ?? 0), unit: c.unit ?? '', severity: c.severity ?? 'ok',
          margin: Number(c.margin ?? 0),
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.recommendations ?? rS.value.data ?? []
        setScaling(raw.map((s: any) => ({
          resource: s.resource ?? '', currentCapacity: Number(s.current_capacity ?? s.currentCapacity ?? 0),
          recommendedCapacity: Number(s.recommended_capacity ?? s.recommendedCapacity ?? 0), unit: s.unit ?? '',
          reasoning: s.reasoning ?? '', estimatedCostImpactUsd: Number(s.estimated_cost_impact_usd ?? s.estimatedCostImpactUsd ?? 0),
          urgency: s.urgency ?? 'low', confidencePct: Number(s.confidence_pct ?? s.confidencePct ?? 0),
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const critical = utilization.filter(u => u.utilizationPct >= 90).length
  const warning = utilization.filter(u => u.utilizationPct >= 70 && u.utilizationPct < 90).length
  const critConstr = constraints.filter(c => c.severity === 'critical').length
  const immediateScaling = scaling.filter(s => s.urgency === 'immediate').length
  const filteredUtil = utilization.filter(u => catFilter === 'all' || u.category === catFilter)

  const TABS = [
    { id: 'utilization' as const, label: 'UTILIZATION' },
    { id: 'forecast' as const, label: 'FORECAST' },
    { id: 'allocation' as const, label: 'ALLOCATION' },
    { id: 'constraints' as const, label: 'CONSTRAINTS' },
    { id: 'scaling' as const, label: 'SCALING' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>CAPA</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CAPACITY PLANNING â€” UTILIZATION + FORECAST + ALLOCATION + CONSTRAINTS + SCALING</span>
        {critical > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {critical} CRITICAL RESOURCES</span>}
        {immediateScaling > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {immediateScaling} IMMEDIATE SCALING NEEDED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Resources" value={utilization.length} />
        <StatCard label="Critical (â‰¥90%)" value={critical} col={critical > 0 ? RED : GREEN} />
        <StatCard label="Warning (â‰¥70%)" value={warning} col={warning > 0 ? AMBER : GREEN} />
        <StatCard label="Constraint Violations" value={critConstr} col={critConstr > 0 ? RED : GREEN} />
        <StatCard label="Scale Alerts" value={immediateScaling} col={immediateScaling > 0 ? ORANGE : GREEN} />
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

        {tab === 'utilization' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {['all', 'compute', 'memory', 'storage', 'network', 'gpu', 'license'].map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  style={{ fontFamily: MONO, fontSize: 10, color: catFilter === c ? AMBER : SUBTLE, background: catFilter === c ? AMBER + '22' : 'transparent', border: `1px solid ${catFilter === c ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {c === 'all' ? 'ALL' : c.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Resource</Th><Th>Category</Th><Th>Env</Th><Th>Utilization</Th><Th right>Used</Th><Th right>Capacity</Th><Th>Trend</Th><Th right>Peak %</Th></tr></thead>
                <tbody>
                  {filteredUtil.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No data â€” check /api/v4/capacity-plan/utilization</td></tr>}
                  {filteredUtil.sort((a, b) => b.utilizationPct - a.utilizationPct).map((u, i) => (
                    <tr key={i} style={{ background: u.utilizationPct >= 90 ? RED + '0a' : u.utilizationPct >= 70 ? AMBER + '06' : 'transparent' }}>
                      <Td mono col={AMBER}>{u.resource}</Td>
                      <Td><CatBadge c={u.category} /></Td>
                      <Td mono col={SUBTLE}>{u.environment}</Td>
                      <Td><UtilBar pct={u.utilizationPct} /></Td>
                      <Td right mono col={TEXT}>{u.usedCapacity.toLocaleString()} {u.unit}</Td>
                      <Td right mono col={SUBTLE}>{u.currentCapacity.toLocaleString()} {u.unit}</Td>
                      <Td><TrendIndicator trend={u.trend} pct={u.trendPct} /></Td>
                      <Td right mono col={u.peakUtilization >= 90 ? RED : TEXT}>{u.peakUtilization.toFixed(1)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'forecast' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Resource</Th><Th right>Current</Th><Th right>30d Forecast</Th><Th right>90d Forecast</Th><Th right>180d Forecast</Th><Th right>Growth/mo</Th><Th right>Days to Cap</Th><Th right>Confidence</Th></tr></thead>
              <tbody>
                {forecast.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No forecast â€” check /api/v4/capacity-plan/forecast</td></tr>}
                {forecast.sort((a, b) => a.daysUntilCapacity - b.daysUntilCapacity).map((f, i) => (
                  <tr key={i} style={{ background: f.daysUntilCapacity < 30 ? RED + '0a' : f.daysUntilCapacity < 90 ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{f.resource}</Td>
                    <Td right mono>{f.currentUsage.toLocaleString()} {f.unit}</Td>
                    <Td right mono col={BLUE}>{f.forecast30d.toLocaleString()}</Td>
                    <Td right mono col={ORANGE}>{f.forecast90d.toLocaleString()}</Td>
                    <Td right mono col={RED}>{f.forecast180d.toLocaleString()}</Td>
                    <Td right mono col={f.growthRatePctMonthly > 10 ? RED : f.growthRatePctMonthly > 5 ? AMBER : TEXT}>{f.growthRatePctMonthly.toFixed(1)}%</Td>
                    <Td right mono col={f.daysUntilCapacity < 30 ? RED : f.daysUntilCapacity < 90 ? AMBER : GREEN}>{f.daysUntilCapacity < 9000 ? f.daysUntilCapacity : '>365'}d</Td>
                    <Td right mono col={f.confidencePct > 80 ? GREEN : AMBER}>{f.confidencePct.toFixed(0)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'allocation' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Team</Th><Th>Project</Th><Th>Resource</Th><Th right>Allocated</Th><Th right>Used</Th><Th>Efficiency</Th><Th right>Cost USD</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {allocation.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No allocation â€” check /api/v4/capacity-plan/allocation</td></tr>}
                {allocation.sort((a, b) => b.costUsd - a.costUsd).map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.team}</Td>
                    <Td mono col={BLUE}>{a.project}</Td>
                    <Td mono col={SUBTLE}>{a.resource}</Td>
                    <Td right mono col={TEXT}>{a.allocatedAmount.toLocaleString()} {a.unit}</Td>
                    <Td right mono col={TEXT}>{a.usedAmount.toLocaleString()} {a.unit}</Td>
                    <Td><UtilBar pct={a.efficiencyPct} /></Td>
                    <Td right mono col={ORANGE}>${a.costUsd.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{a.expiresAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'constraints' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Resource</Th><Th>Constraint</Th><Th>Severity</Th><Th right>Current</Th><Th right>Limit</Th><Th right>Margin</Th></tr></thead>
              <tbody>
                {constraints.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No constraints â€” check /api/v4/capacity-plan/constraints</td></tr>}
                {constraints.sort((a, b) => { const o: Record<string, number> = { critical: 0, warning: 1, ok: 2 }; return (o[a.severity] ?? 9) - (o[b.severity] ?? 9) }).map((c, i) => (
                  <tr key={i} style={{ background: c.severity === 'critical' ? RED + '0a' : c.severity === 'warning' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.resource}</Td>
                    <Td mono col={SUBTLE}>{c.constraint}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.severity === 'critical' ? RED : c.severity === 'warning' ? AMBER : GREEN }}>{c.severity.toUpperCase()}</span></Td>
                    <Td right mono col={TEXT}>{c.currentValue.toLocaleString()} {c.unit}</Td>
                    <Td right mono col={SUBTLE}>{c.limit.toLocaleString()} {c.unit}</Td>
                    <Td right mono col={c.margin < 10 ? RED : c.margin < 20 ? AMBER : GREEN}>{c.margin.toFixed(1)} {c.unit}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'scaling' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Resource</Th><Th>Urgency</Th><Th right>Current</Th><Th right>Recommended</Th><Th right>Cost Impact</Th><Th right>Confidence</Th><Th>Reasoning</Th></tr></thead>
              <tbody>
                {scaling.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No scaling recommendations â€” check /api/v4/capacity-plan/scaling</td></tr>}
                {scaling.sort((a, b) => { const o: Record<string, number> = { immediate: 0, soon: 1, planned: 2, low: 3 }; return (o[a.urgency] ?? 9) - (o[b.urgency] ?? 9) }).map((s, i) => (
                  <tr key={i} style={{ background: s.urgency === 'immediate' ? RED + '0a' : s.urgency === 'soon' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.resource}</Td>
                    <Td><UrgencyBadge u={s.urgency} /></Td>
                    <Td right mono col={TEXT}>{s.currentCapacity.toLocaleString()} {s.unit}</Td>
                    <Td right mono col={GREEN}>{s.recommendedCapacity.toLocaleString()} {s.unit}</Td>
                    <Td right mono col={s.estimatedCostImpactUsd > 0 ? RED : GREEN}>{s.estimatedCostImpactUsd > 0 ? '+' : ''}${s.estimatedCostImpactUsd.toLocaleString()}/mo</Td>
                    <Td right mono col={s.confidencePct > 80 ? GREEN : AMBER}>{s.confidencePct.toFixed(0)}%</Td>
                    <Td><span style={{ fontSize: 10, color: SUBTLE }}>{s.reasoning}</span></Td>
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
