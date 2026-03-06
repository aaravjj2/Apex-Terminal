import React, { useState, useEffect, useCallback, useRef } from 'react'
﻿// PreTradeRiskUI2 — Bloomberg PTRK-grade pre-trade risk & compliance terminal
// Real-time order risk checks, limit validation, compliance rules, circuit breakers
// Tabs: RISK CHECKS | LIMITS | COMPLIANCE | CIRCUIT BREAKERS | HISTORY
// APIs: /api/v4/pre-trade-risk/checks, /limits, /compliance, /circuit-breakers, /history

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

type CheckResult = 'pass' | 'fail' | 'warn' | 'pending'
type LimitType = 'position' | 'notional' | 'pnl' | 'order_size' | 'concentration' | 'var' | 'leverage' | 'drawdown' | 'velocity'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

interface RiskCheck {
  checkId: string
  orderId: string
  symbol: string
  checkName: string
  checkType: string
  result: CheckResult
  severity: Severity
  currentValue: number
  limitValue: number
  utilizationPct: number
  message: string
  checkedAt: string
  latencyMs: number
}

interface RiskLimit {
  limitId: string
  name: string
  limitType: LimitType
  account: string
  currentValue: number
  softLimit: number
  hardLimit: number
  utilizationPct: number
  breached: boolean
  resetTime: string
  currency: string
  description: string
}

interface ComplianceRule {
  ruleId: string
  ruleName: string
  category: string
  status: 'active' | 'inactive' | 'suspended'
  result: CheckResult
  lastTriggered: string
  triggerCount: number
  affectedSymbols: string[]
  description: string
  action: 'block' | 'warn' | 'flag' | 'notify'
}

interface CircuitBreaker {
  breakerId: string
  name: string
  trigger: string
  threshold: number
  currentValue: number
  unit: string
  status: 'armed' | 'triggered' | 'disarmed' | 'testing'
  triggeredAt: string | null
  resetAt: string | null
  blockedOrders: number
}

interface RiskHistoryEntry {
  historyId: string
  timestamp: string
  orderId: string
  symbol: string
  checkName: string
  result: CheckResult
  severity: Severity
  message: string
  resolvedAt: string | null
}

// ── sub-components ──────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono, col, style: sx }: { children: React.ReactNode; right?: boolean; mono?: boolean; col?: string; style?: React.CSSProperties }) {
  return <td style={{ fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 11 : 12, color: col || TEXT, padding: '5px 10px', textAlign: right ? 'right' : 'left', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap', ...sx }}>{children}</td>
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

function ResultBadge({ result }: { result: CheckResult }) {
  const c = result === 'pass' ? GREEN : result === 'fail' ? RED : result === 'warn' ? AMBER : SUBTLE
  const sym = result === 'pass' ? '✓' : result === 'fail' ? '✗' : result === 'warn' ? '⚠' : '·'
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 8px', borderRadius: 2 }}>{sym} {result.toUpperCase()}</span>
}

function SevBadge({ sev }: { sev: Severity }) {
  const c = sev === 'critical' ? '#b71c1c' : sev === 'high' ? RED : sev === 'medium' ? AMBER : sev === 'low' ? GREEN : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{sev.toUpperCase()}</span>
}

function UtilBar({ pct, soft, hard }: { pct: number; soft?: number; hard?: number }) {
  const c = pct >= 100 ? '#b71c1c' : pct >= (hard ?? 90) ? RED : pct >= (soft ?? 70) ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, position: 'relative' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: c, borderRadius: 3 }} />
        {soft && <div style={{ position: 'absolute', left: `${soft}%`, top: 0, height: '100%', width: 1, background: AMBER + 'aa' }} />}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c, minWidth: 42 }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

function BreakerStatusBadge({ status }: { status: CircuitBreaker['status'] }) {
  const c = status === 'triggered' ? RED : status === 'armed' ? GREEN : status === 'testing' ? AMBER : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', padding: '2px 6px', borderRadius: 2 }}>{status.toUpperCase()}</span>
}


export function PreTradeRiskUI2() {
  const [tab, setTab] = useState<'checks' | 'limits' | 'compliance' | 'breakers' | 'history'>('checks')
  const [checks, setChecks] = useState<RiskCheck[]>([])
  const [limits, setLimits] = useState<RiskLimit[]>([])
  const [rules, setRules] = useState<ComplianceRule[]>([])
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([])
  const [history, setHistory] = useState<RiskHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [resultFilter, setResultFilter] = useState<CheckResult | 'all'>('all')
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rCh, rLim, rComp, rBr, rHist] = await Promise.allSettled([
        fetch('/api/v4/pre-trade-risk/checks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/pre-trade-risk/limits').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/pre-trade-risk/compliance').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/pre-trade-risk/circuit-breakers').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/pre-trade-risk/history').then(r => r.ok ? r.json() : []),
      ])
      if (rCh.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rCh.value) ? rCh.value : rCh.value.checks ?? rCh.value.data ?? []
        setChecks(raw.map((c: any) => ({
          checkId: c.check_id ?? c.id ?? '',
          orderId: c.order_id ?? '', symbol: c.symbol ?? '',
          checkName: c.check_name ?? c.name ?? '', checkType: c.check_type ?? c.type ?? '',
          result: (c.result ?? 'pending') as CheckResult, severity: (c.severity ?? 'low') as Severity,
          currentValue: Number(c.current_value ?? 0), limitValue: Number(c.limit_value ?? 0),
          utilizationPct: Number(c.utilization_pct ?? c.utilization ?? 0),
          message: c.message ?? '', checkedAt: c.checked_at ?? c.timestamp ?? '',
          latencyMs: Number(c.latency_ms ?? c.latency ?? 0),
        })))
        setErr(null)
      } else setErr('Failed to load pre-trade risk checks')
      if (rLim.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rLim.value) ? rLim.value : rLim.value.limits ?? rLim.value.data ?? []
        setLimits(raw.map((l: any) => ({
          limitId: l.limit_id ?? l.id ?? '', name: l.name ?? '',
          limitType: (l.limit_type ?? l.type ?? 'notional') as LimitType,
          account: l.account ?? '', currentValue: Number(l.current_value ?? 0),
          softLimit: Number(l.soft_limit ?? l.soft ?? 0), hardLimit: Number(l.hard_limit ?? l.hard ?? 0),
          utilizationPct: Number(l.utilization_pct ?? 0), breached: Boolean(l.breached ?? false),
          resetTime: l.reset_time ?? l.resets_at ?? '', currency: l.currency ?? 'USD',
          description: l.description ?? '',
        })))
      }
      if (rComp.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rComp.value) ? rComp.value : rComp.value.rules ?? rComp.value.data ?? []
        setRules(raw.map((r: any) => ({
          ruleId: r.rule_id ?? r.id ?? '', ruleName: r.rule_name ?? r.name ?? '',
          category: r.category ?? '', status: (r.status ?? 'active') as ComplianceRule['status'],
          result: (r.result ?? 'pass') as CheckResult, lastTriggered: r.last_triggered ?? '',
          triggerCount: Number(r.trigger_count ?? 0),
          affectedSymbols: Array.isArray(r.affected_symbols) ? r.affected_symbols : [],
          description: r.description ?? '', action: (r.action ?? 'warn') as ComplianceRule['action'],
        })))
      }
      if (rBr.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rBr.value) ? rBr.value : rBr.value.breakers ?? rBr.value.data ?? []
        setBreakers(raw.map((b: any) => ({
          breakerId: b.breaker_id ?? b.id ?? '', name: b.name ?? '',
          trigger: b.trigger ?? '', threshold: Number(b.threshold ?? 0),
          currentValue: Number(b.current_value ?? 0), unit: b.unit ?? '',
          status: (b.status ?? 'armed') as CircuitBreaker['status'],
          triggeredAt: b.triggered_at ?? null, resetAt: b.reset_at ?? null,
          blockedOrders: Number(b.blocked_orders ?? 0),
        })))
      }
      if (rHist.status === 'fulfilled') {
        const raw: any[] = Array.isArray(rHist.value) ? rHist.value : rHist.value.history ?? rHist.value.data ?? []
        setHistory(raw.map((h: any) => ({
          historyId: h.history_id ?? h.id ?? '', timestamp: h.timestamp ?? '',
          orderId: h.order_id ?? '', symbol: h.symbol ?? '',
          checkName: h.check_name ?? '', result: (h.result ?? 'pass') as CheckResult,
          severity: (h.severity ?? 'info') as Severity, message: h.message ?? '',
          resolvedAt: h.resolved_at ?? null,
        })))
      }
    } catch (e: any) { setErr(e.message) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAll().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchAll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchAll])

  const failChecks = checks.filter(c => c.result === 'fail')
  const warnChecks = checks.filter(c => c.result === 'warn')
  const breachedLimits = limits.filter(l => l.breached)
  const triggeredBreakers = breakers.filter(b => b.status === 'triggered')

  const visChecks = checks.filter(c =>
    (resultFilter === 'all' || c.result === resultFilter) &&
    (sevFilter === 'all' || c.severity === sevFilter)
  )

  const TABS = [
    { id: 'checks' as const, label: `RISK CHECKS${failChecks.length ? ` ✗${failChecks.length}` : ''}${warnChecks.length ? ` ⚠${warnChecks.length}` : ''}` },
    { id: 'limits' as const, label: `LIMITS${breachedLimits.length ? ` (${breachedLimits.length} BREACHED)` : ''}` },
    { id: 'compliance' as const, label: 'COMPLIANCE RULES' },
    { id: 'breakers' as const, label: `CIRCUIT BREAKERS${triggeredBreakers.length ? ` ⚡${triggeredBreakers.length}` : ''}` },
    { id: 'history' as const, label: 'HISTORY' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>PTRK</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PRE-TRADE RISK — ORDER RISK CHECKS + LIMIT VALIDATION + COMPLIANCE</span>
        {(failChecks.length > 0 || triggeredBreakers.length > 0) && (
          <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠ {failChecks.length} CHECKS FAILED · {triggeredBreakers.length} BREAKERS TRIGGERED</span>
        )}
      </div>

      {/* STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Checks" value={checks.length} />
        <StatCard label="Failed" value={failChecks.length} col={failChecks.length > 0 ? RED : SUBTLE} />
        <StatCard label="Warnings" value={warnChecks.length} col={warnChecks.length > 0 ? AMBER : SUBTLE} />
        <StatCard label="Limits Breached" value={breachedLimits.length} col={breachedLimits.length > 0 ? RED : GREEN} />
        <StatCard label="Breakers Active" value={triggeredBreakers.length} col={triggeredBreakers.length > 0 ? RED : GREEN} />
        <StatCard label="Avg Latency" value={(checks.length ? (checks.reduce((s, c) => s + c.latencyMs, 0) / checks.length).toFixed(1) : '0') + 'ms'} col={BLUE} />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1,
              color: tab === t.id ? AMBER : SUBTLE, background: tab === t.id ? '#0d0d0d' : 'transparent',
              border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      {(tab === 'checks' || tab === 'history') && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          {(['all', 'fail', 'warn', 'pass', 'pending'] as const).map(r => (
            <button key={r} onClick={() => setResultFilter(r as any)}
              style={{ fontFamily: MONO, fontSize: 10, color: resultFilter === r ? AMBER : SUBTLE,
                background: resultFilter === r ? AMBER + '22' : 'transparent', border: `1px solid ${resultFilter === r ? AMBER + '55' : BORDER}`,
                borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
              {r.toUpperCase()}
            </button>
          ))}
          <div style={{ width: 1, background: BORDER, margin: '0 4px' }} />
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
            <button key={s} onClick={() => setSevFilter(s as any)}
              style={{ fontFamily: MONO, fontSize: 10, color: sevFilter === s ? AMBER : SUBTLE,
                background: sevFilter === s ? AMBER + '22' : 'transparent', border: `1px solid ${sevFilter === s ? AMBER + '55' : BORDER}`,
                borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* BODY */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {err && <div style={{ background: '#1a0808', border: `1px solid ${RED}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: RED }}>Error: {err}</div>}
        {loading && <div style={{ color: SUBTLE, fontSize: 11, marginBottom: 8 }}>Loading pre-trade risk...</div>}

        {/* RISK CHECKS */}
        {tab === 'checks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Check Name</Th><Th>Type</Th><Th>Symbol</Th>
                <Th>Result</Th><Th>Severity</Th><Th>Utilization</Th>
                <Th right>Current</Th><Th right>Limit</Th>
                <Th right>Latency</Th><Th>Message</Th><Th>Time</Th>
              </tr></thead>
              <tbody>
                {visChecks.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No checks</td></tr>}
                {[...visChecks].sort((a, b) => {
                  const sOrd: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
                  const rOrd: Record<CheckResult, number> = { fail: 0, warn: 1, pending: 2, pass: 3 }
                  return (rOrd[a.result] - rOrd[b.result]) || (sOrd[a.severity] - sOrd[b.severity])
                }).map((c, i) => (
                  <tr key={i} style={{ background: c.result === 'fail' ? '#1a0808' : 'transparent' }}>
                    <Td mono col={TEXT}>{c.checkName}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{c.checkType}</Td>
                    <Td mono col={AMBER}>{c.symbol || '—'}</Td>
                    <Td><ResultBadge result={c.result} /></Td>
                    <Td><SevBadge sev={c.severity} /></Td>
                    <Td><UtilBar pct={c.utilizationPct} /></Td>
                    <Td right mono>{c.currentValue.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{c.limitValue.toLocaleString()}</Td>
                    <Td right mono col={c.latencyMs > 10 ? AMBER : SUBTLE}>{c.latencyMs}ms</Td>
                    <Td mono col={c.result === 'fail' ? RED : c.result === 'warn' ? AMBER : SUBTLE} style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{c.message}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 9 }}>{c.checkedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LIMITS */}
        {tab === 'limits' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Limit Name</Th><Th>Type</Th><Th>Account</Th>
                <Th right>Current</Th><Th right>Soft Limit</Th><Th right>Hard Limit</Th>
                <Th>Utilization</Th><Th>Status</Th><Th>Resets At</Th><Th>Description</Th>
              </tr></thead>
              <tbody>
                {limits.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No limits</td></tr>}
                {[...limits].sort((a, b) => b.utilizationPct - a.utilizationPct).map((l, i) => (
                  <tr key={i} style={{ background: l.breached ? '#1a0808' : 'transparent' }}>
                    <Td mono col={l.breached ? RED : TEXT}>{l.name}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', padding: '2px 6px', borderRadius: 2 }}>{l.limitType.replace(/_/g, ' ').toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{l.account || 'ALL'}</Td>
                    <Td right mono col={l.breached ? RED : TEXT}>{l.currentValue.toLocaleString()}</Td>
                    <Td right mono col={AMBER}>{l.softLimit.toLocaleString()}</Td>
                    <Td right mono col={RED}>{l.hardLimit.toLocaleString()}</Td>
                    <Td><UtilBar pct={l.utilizationPct} soft={80} hard={95} /></Td>
                    <Td><ResultBadge result={l.breached ? 'fail' : l.utilizationPct > 80 ? 'warn' : 'pass'} /></Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{l.resetTime || '—'}</Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{l.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* COMPLIANCE RULES */}
        {tab === 'compliance' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Rule Name</Th><Th>Category</Th><Th>Status</Th><Th>Result</Th>
                <Th>Action</Th><Th right>Triggers</Th><Th>Last Triggered</Th><Th>Affected Symbols</Th><Th>Description</Th>
              </tr></thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No compliance rules</td></tr>}
                {rules.map((r, i) => {
                  const ac = r.action === 'block' ? RED : r.action === 'flag' ? ORANGE : r.action === 'notify' ? BLUE : AMBER
                  const sc = r.status === 'active' ? GREEN : r.status === 'suspended' ? AMBER : SUBTLE
                  return (
                    <tr key={i}>
                      <Td mono col={TEXT}>{r.ruleName}</Td>
                      <Td mono col={BLUE} style={{ fontSize: 10 }}>{r.category}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: sc, background: sc + '22', padding: '2px 6px', borderRadius: 2 }}>{r.status.toUpperCase()}</span></Td>
                      <Td><ResultBadge result={r.result} /></Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: ac, background: ac + '22', padding: '2px 6px', borderRadius: 2 }}>{r.action.toUpperCase()}</span></Td>
                      <Td right mono col={r.triggerCount > 0 ? AMBER : SUBTLE}>{r.triggerCount}</Td>
                      <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{r.lastTriggered || '—'}</Td>
                      <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.affectedSymbols.slice(0, 4).join(', ')}{r.affectedSymbols.length > 4 ? ` +${r.affectedSymbols.length - 4}` : ''}</Td>
                      <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.description}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* CIRCUIT BREAKERS */}
        {tab === 'breakers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {breakers.length === 0 && <div style={{ color: SUBTLE, fontSize: 11 }}>No circuit breakers</div>}
            {breakers.map(b => {
              const pct = b.threshold > 0 ? (b.currentValue / b.threshold) * 100 : 0
              const c = b.status === 'triggered' ? RED : b.status === 'armed' ? GREEN : SUBTLE
              return (
                <div key={b.breakerId} style={{ background: PANEL, border: `1px solid ${b.status === 'triggered' ? RED + '66' : BORDER}`, borderRadius: 4, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                    <BreakerStatusBadge status={b.status} />
                    <span style={{ fontFamily: MONO, fontSize: 12, color: AMBER, fontWeight: 700 }}>{b.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{b.trigger}</span>
                    {b.blockedOrders > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>BLOCKED: {b.blockedOrders} orders</span>}
                    {b.triggeredAt && <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>Triggered: {b.triggeredAt}</span>}
                    {b.resetAt && <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN }}>Resets: {b.resetAt}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 200, height: 8, background: BORDER, borderRadius: 4 }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: c, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{b.currentValue.toLocaleString()} / {b.threshold.toLocaleString()} {b.unit}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Timestamp</Th><Th>Symbol</Th><Th>Check</Th><Th>Result</Th><Th>Severity</Th><Th>Message</Th><Th>Resolved</Th></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No history</td></tr>}
                {history.filter(h => (resultFilter === 'all' || h.result === resultFilter) && (sevFilter === 'all' || h.severity === sevFilter)).map((h, i) => (
                  <tr key={i}>
                    <Td mono col={SUBTLE} style={{ fontSize: 10 }}>{h.timestamp}</Td>
                    <Td mono col={AMBER}>{h.symbol || '—'}</Td>
                    <Td mono col={TEXT}>{h.checkName}</Td>
                    <Td><ResultBadge result={h.result} /></Td>
                    <Td><SevBadge sev={h.severity} /></Td>
                    <Td mono col={SUBTLE} style={{ fontSize: 10, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{h.message}</Td>
                    <Td mono col={h.resolvedAt ? GREEN : SUBTLE} style={{ fontSize: 10 }}>{h.resolvedAt ?? 'Open'}</Td>
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
