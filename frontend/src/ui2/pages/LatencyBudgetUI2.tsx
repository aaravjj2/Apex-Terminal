import React, { useState, useEffect, useCallback } from 'react'
﻿// LatencyBudgetUI2 — Bloomberg LATB latency budget engine terminal
// Service budgets, SLO tracking, hot path mapping, violations, audit
// Tabs: BUDGETS | SLOs | HOT PATHS | VIOLATIONS | AUDIT
// APIs: /api/v4/latency-budget/budgets, /slos, /hot-paths, /violations, /audit

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

interface BudgetEntry {
  budgetId: string
  service: string
  endpoint: string
  tier: string
  totalBudgetMs: number
  consumedMs: number
  remainingMs: number
  utilizationPct: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  status: 'healthy' | 'warning' | 'breaching' | 'exhausted'
  owner: string
}

interface SloEntry {
  sloId: string
  service: string
  sloType: string
  target: number
  current: number
  errorBudgetRemaining: number
  burnRate: number
  windowDays: number
  status: 'met' | 'at-risk' | 'breached'
  alert: boolean
  owner: string
}

interface HotPathEntry {
  pathId: string
  service: string
  pathName: string
  avgMs: number
  p99Ms: number
  callsPerMin: number
  contributionPct: number
  critical: boolean
  bottleneck: string
  optimizationApplied: boolean
}

interface LatencyViolation {
  violationId: string
  service: string
  endpoint: string
  budget: string
  severity: 'critical' | 'major' | 'minor'
  exceededMs: number
  duration: string
  status: 'active' | 'investigating' | 'mitigated' | 'resolved'
  affectedUsers: number
  detectedAt: string
  resolvedAt: string
}

interface LatencyAuditEntry {
  auditId: string
  service: string
  action: string
  actor: string
  previousBudgetMs: number
  newBudgetMs: number
  outcome: 'pass' | 'fail' | 'warn'
  notes: string
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
function BudgetBar({ pct }: { pct: number }) {
  const col = pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 70, height: 5, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(1)}%</span>
    </div>
  )
}
function StatusBadge2({ s, map }: { s: string; map?: Record<string, string> }) {
  const def: Record<string, string> = { healthy: GREEN, warning: AMBER, breaching: RED, exhausted: RED, met: GREEN, 'at-risk': AMBER, breached: RED, active: RED, investigating: ORANGE, mitigated: AMBER, resolved: GREEN, pass: GREEN, fail: RED, warn: AMBER }
  const m = { ...def, ...(map ?? {}) }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, major: ORANGE, minor: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function BurnBar({ rate }: { rate: number }) {
  const col = rate >= 2 ? RED : rate >= 1 ? AMBER : GREEN
  const width = Math.min(rate * 33, 100)
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{rate.toFixed(2)}x</span>
    </div>
  )
}


export function LatencyBudgetUI2() {
  const [tab, setTab] = useState<'budgets' | 'slos' | 'hotpaths' | 'violations' | 'audit'>('budgets')
  const [budgets, setBudgets] = useState<BudgetEntry[]>([])
  const [slos, setSlos] = useState<SloEntry[]>([])
  const [hotPaths, setHotPaths] = useState<HotPathEntry[]>([])
  const [violations, setViolations] = useState<LatencyViolation[]>([])
  const [auditLog, setAuditLog] = useState<LatencyAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rB, rS, rH, rV, rA] = await Promise.allSettled([
        fetch('/api/v4/latency-budget/budgets').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/latency-budget/slos').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/latency-budget/hot-paths').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/latency-budget/violations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/latency-budget/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.budgets ?? rB.value.data ?? []
        setBudgets(raw.map((b: any) => ({
          budgetId: b.budget_id ?? b.budgetId ?? '', service: b.service ?? '', endpoint: b.endpoint ?? '', tier: b.tier ?? '',
          totalBudgetMs: Number(b.total_budget_ms ?? b.totalBudgetMs ?? 0),
          consumedMs: Number(b.consumed_ms ?? b.consumedMs ?? 0),
          remainingMs: Number(b.remaining_ms ?? b.remainingMs ?? 0),
          utilizationPct: Number(b.utilization_pct ?? b.utilizationPct ?? 0),
          p50Ms: Number(b.p50_ms ?? b.p50Ms ?? 0), p95Ms: Number(b.p95_ms ?? b.p95Ms ?? 0),
          p99Ms: Number(b.p99_ms ?? b.p99Ms ?? 0), status: b.status ?? 'healthy', owner: b.owner ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load budgets')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.slos ?? rS.value.data ?? []
        setSlos(raw.map((s: any) => ({
          sloId: s.slo_id ?? s.sloId ?? '', service: s.service ?? '', sloType: s.slo_type ?? s.sloType ?? '',
          target: Number(s.target ?? 0), current: Number(s.current ?? 0),
          errorBudgetRemaining: Number(s.error_budget_remaining ?? s.errorBudgetRemaining ?? 0),
          burnRate: Number(s.burn_rate ?? s.burnRate ?? 0), windowDays: Number(s.window_days ?? s.windowDays ?? 30),
          status: s.status ?? 'met', alert: Boolean(s.alert ?? false), owner: s.owner ?? '',
        })))
      }
      if (rH.status === 'fulfilled') {
        const raw = Array.isArray(rH.value) ? rH.value : rH.value.hot_paths ?? rH.value.data ?? []
        setHotPaths(raw.map((h: any) => ({
          pathId: h.path_id ?? h.pathId ?? '', service: h.service ?? '', pathName: h.path_name ?? h.pathName ?? '',
          avgMs: Number(h.avg_ms ?? h.avgMs ?? 0), p99Ms: Number(h.p99_ms ?? h.p99Ms ?? 0),
          callsPerMin: Number(h.calls_per_min ?? h.callsPerMin ?? 0),
          contributionPct: Number(h.contribution_pct ?? h.contributionPct ?? 0),
          critical: Boolean(h.critical ?? false), bottleneck: h.bottleneck ?? '',
          optimizationApplied: Boolean(h.optimization_applied ?? h.optimizationApplied ?? false),
        })))
      }
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.violations ?? rV.value.data ?? []
        setViolations(raw.map((v: any) => ({
          violationId: v.violation_id ?? v.violationId ?? '', service: v.service ?? '', endpoint: v.endpoint ?? '',
          budget: v.budget ?? '', severity: v.severity ?? 'minor', exceededMs: Number(v.exceeded_ms ?? v.exceededMs ?? 0),
          duration: v.duration ?? '', status: v.status ?? 'active', affectedUsers: Number(v.affected_users ?? v.affectedUsers ?? 0),
          detectedAt: v.detected_at ?? v.detectedAt ?? '', resolvedAt: v.resolved_at ?? v.resolvedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', service: a.service ?? '', action: a.action ?? '', actor: a.actor ?? '',
          previousBudgetMs: Number(a.previous_budget_ms ?? a.previousBudgetMs ?? 0),
          newBudgetMs: Number(a.new_budget_ms ?? a.newBudgetMs ?? 0),
          outcome: a.outcome ?? 'pass', notes: a.notes ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const breaching = budgets.filter(b => b.status === 'breaching' || b.status === 'exhausted').length
  const sloBreached = slos.filter(s => s.status === 'breached').length
  const activeViolations = violations.filter(v => v.status === 'active').length
  const criticalPaths = hotPaths.filter(h => h.critical).length

  const TABS2 = [
    { id: 'budgets' as const, label: 'BUDGETS' },
    { id: 'slos' as const, label: 'SLOs' },
    { id: 'hotpaths' as const, label: 'HOT PATHS' },
    { id: 'violations' as const, label: 'VIOLATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>LATB</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>LATENCY BUDGET ENGINE — SLO TRACKING + HOT PATH IDENTIFICATION + VIOLATION MONITORING</span>
        {breaching > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {breaching} BREACHING</span>}
        {sloBreached > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {sloBreached} SLO BREACHED</span>}
        {activeViolations > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {activeViolations} ACTIVE VIOLATIONS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Services" value={new Set(budgets.map(b => b.service)).size} col={BLUE} />
        <StatCard label="Breaching" value={breaching} col={breaching > 0 ? RED : GREEN} />
        <StatCard label="SLOs Breached" value={sloBreached} col={sloBreached > 0 ? RED : GREEN} />
        <StatCard label="Active Violations" value={activeViolations} col={activeViolations > 0 ? ORANGE : GREEN} />
        <StatCard label="Critical Hot Paths" value={criticalPaths} col={criticalPaths > 0 ? AMBER : SUBTLE} />
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

        {tab === 'budgets' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Service</Th><Th>Endpoint</Th><Th>Tier</Th><Th>Utilization</Th><Th>Status</Th><Th right>Budget ms</Th><Th right>Consumed ms</Th><Th right>Remaining ms</Th><Th right>p50</Th><Th right>p95</Th><Th right>p99</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {budgets.length === 0 && <tr><td colSpan={12} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No budgets</td></tr>}
                {budgets.sort((a, b) => b.utilizationPct - a.utilizationPct).map((b, i) => (
                  <tr key={i} style={{ background: b.status === 'exhausted' ? RED + '0a' : b.status === 'breaching' ? ORANGE + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.service}</Td>
                    <Td mono col={BLUE}>{b.endpoint}</Td>
                    <Td mono col={PURPLE}>{b.tier}</Td>
                    <Td><BudgetBar pct={b.utilizationPct} /></Td>
                    <Td><StatusBadge2 s={b.status} /></Td>
                    <Td right mono col={SUBTLE}>{b.totalBudgetMs.toFixed(0)}</Td>
                    <Td right mono col={b.utilizationPct > 90 ? RED : SUBTLE}>{b.consumedMs.toFixed(0)}</Td>
                    <Td right mono col={b.remainingMs < 0 ? RED : GREEN}>{b.remainingMs.toFixed(0)}</Td>
                    <Td right mono col={SUBTLE}>{b.p50Ms.toFixed(1)}</Td>
                    <Td right mono col={b.p95Ms > b.totalBudgetMs ? RED : SUBTLE}>{b.p95Ms.toFixed(1)}</Td>
                    <Td right mono col={b.p99Ms > b.totalBudgetMs ? RED : SUBTLE}>{b.p99Ms.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{b.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'slos' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>SLO ID</Th><Th>Service</Th><Th>Type</Th><Th>Status</Th><Th right>Target %</Th><Th right>Current %</Th><Th right>Error Budget</Th><Th>Burn Rate</Th><Th right>Window</Th><Th>Alert</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {slos.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No SLOs</td></tr>}
                {slos.sort((a, b) => {
                  const ord: Record<string, number> = { breached: 0, 'at-risk': 1, met: 2 }
                  return (ord[a.status] ?? 3) - (ord[b.status] ?? 3)
                }).map((s, i) => (
                  <tr key={i} style={{ background: s.status === 'breached' ? RED + '0a' : s.status === 'at-risk' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.sloId}</Td>
                    <Td mono col={BLUE}>{s.service}</Td>
                    <Td mono col={PURPLE}>{s.sloType}</Td>
                    <Td><StatusBadge2 s={s.status} /></Td>
                    <Td right mono col={SUBTLE}>{s.target.toFixed(3)}%</Td>
                    <Td right mono col={s.current < s.target ? RED : GREEN}>{s.current.toFixed(3)}%</Td>
                    <Td right mono col={s.errorBudgetRemaining < 10 ? RED : s.errorBudgetRemaining < 30 ? AMBER : GREEN}>{s.errorBudgetRemaining.toFixed(1)}%</Td>
                    <Td><BurnBar rate={s.burnRate} /></Td>
                    <Td right mono col={SUBTLE}>{s.windowDays}d</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.alert ? RED : SUBTLE }}>{s.alert ? '⚠‘ FIRING' : 'OK'}</span></Td>
                    <Td mono col={SUBTLE}>{s.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'hotpaths' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Service</Th><Th>Path</Th><Th>Critical</Th><Th right>Avg ms</Th><Th right>p99 ms</Th><Th right>Calls/min</Th><Th right>Contribution</Th><Th>Bottleneck</Th><Th>Optimized</Th></tr></thead>
              <tbody>
                {hotPaths.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No hot paths</td></tr>}
                {hotPaths.sort((a, b) => b.contributionPct - a.contributionPct).map((h, i) => (
                  <tr key={i} style={{ background: h.critical && !h.optimizationApplied ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{h.service}</Td>
                    <Td mono col={BLUE}>{h.pathName}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: h.critical ? RED : GREEN }}>{h.critical ? '⚠  YES' : 'NO'}</span></Td>
                    <Td right mono col={SUBTLE}>{h.avgMs.toFixed(2)}</Td>
                    <Td right mono col={h.p99Ms > 500 ? RED : h.p99Ms > 200 ? AMBER : SUBTLE}>{h.p99Ms.toFixed(2)}</Td>
                    <Td right mono col={h.callsPerMin > 1000 ? ORANGE : SUBTLE}>{h.callsPerMin.toFixed(0)}</Td>
                    <Td right mono col={h.contributionPct > 20 ? RED : h.contributionPct > 10 ? AMBER : SUBTLE}>{h.contributionPct.toFixed(1)}%</Td>
                    <Td mono col={h.bottleneck ? ORANGE : SUBTLE}>{h.bottleneck || '—'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: h.optimizationApplied ? GREEN : SUBTLE }}>{h.optimizationApplied ? 'APPLIED' : 'PENDING'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'violations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Violation ID</Th><Th>Service</Th><Th>Endpoint</Th><Th>Severity</Th><Th>Status</Th><Th right>Exceeded ms</Th><Th>Duration</Th><Th right>Users</Th><Th>Detected</Th><Th>Resolved</Th></tr></thead>
              <tbody>
                {violations.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No violations</td></tr>}
                {violations.sort((a, b) => {
                  const ord: Record<string, number> = { critical: 0, major: 1, minor: 2 }
                  return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3)
                }).map((v, i) => (
                  <tr key={i} style={{ background: v.severity === 'critical' && v.status === 'active' ? RED + '0a' : 'transparent', opacity: v.status === 'resolved' ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{v.violationId}</Td>
                    <Td mono col={BLUE}>{v.service}</Td>
                    <Td mono col={PURPLE}>{v.endpoint}</Td>
                    <Td><SevBadge s={v.severity} /></Td>
                    <Td><StatusBadge2 s={v.status} /></Td>
                    <Td right mono col={RED}>{v.exceededMs.toFixed(1)}</Td>
                    <Td mono col={ORANGE}>{v.duration || '—'}</Td>
                    <Td right mono col={v.affectedUsers > 0 ? RED : SUBTLE}>{v.affectedUsers.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{v.detectedAt}</Td>
                    <Td mono col={v.resolvedAt ? GREEN : SUBTLE}>{v.resolvedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Service</Th><Th>Action</Th><Th>Actor</Th><Th right>Old ms</Th><Th right>New ms</Th><Th>Outcome</Th><Th>Notes</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.service}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td right mono col={SUBTLE}>{a.previousBudgetMs.toFixed(0)}</Td>
                    <Td right mono col={a.newBudgetMs < a.previousBudgetMs ? AMBER : GREEN}>{a.newBudgetMs.toFixed(0)}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={SUBTLE}>{a.notes || '—'}</Td>
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
