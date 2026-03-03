import React, { useState, useEffect, useCallback } from 'react'
﻿// ReconciliationUI2 â€” Bloomberg APEX trade reconciliation terminal
// Automated break detection, resolution workflows, exception management
// Tabs: BREAKS | POSITIONS | RUNS | EXCEPTIONS | AUDIT
// APIs: /api/v4/reconciliation/breaks, /positions, /runs, /exceptions, /audit

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

interface ReconBreak {
  breakId: string
  tradeId: string
  assetClass: string
  counterparty: string
  breakType: 'quantity' | 'price' | 'settlement' | 'currency' | 'missing' | 'duplicate'
  ourValue: number
  theirValue: number
  discrepancy: number
  currency: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'resolved' | 'escalated' | 'waived'
  daysOpen: number
  assignedTo: string
  tradeDate: string
}

interface ReconPosition {
  positionId: string
  instrument: string
  account: string
  internalQty: number
  externalQty: number
  difference: number
  currency: string
  marketValue: number
  reconStatus: 'matched' | 'break' | 'pending' | 'tolerance'
  toleranceLimit: number
  lastReconAt: string
}

interface ReconRun {
  runId: string
  runType: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  startedAt: string
  completedAt: string
  totalItems: number
  matched: number
  breaks: number
  exceptions: number
  durationSecs: number
}

interface ReconException {
  exceptionId: string
  breakId: string
  reason: string
  resolution: string
  approvedBy: string
  expiresAt: string
  valueAtRisk: number
  status: 'pending' | 'approved' | 'denied' | 'expired'
}

interface ReconAuditEntry {
  auditId: string
  action: string
  actor: string
  breakId: string
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
  const m: Record<string, string> = { open: RED, in_progress: AMBER, resolved: GREEN, escalated: ORANGE, waived: SUBTLE, running: BLUE, completed: GREEN, failed: RED, queued: PURPLE, matched: GREEN, break: RED, pending: AMBER, tolerance: ORANGE, approved: GREEN, denied: RED, expired: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function BreakTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { quantity: ORANGE, price: RED, settlement: AMBER, currency: BLUE, missing: PURPLE, duplicate: GREEN }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}


export function ReconciliationUI2() {
  const [tab, setTab] = useState<'breaks' | 'positions' | 'runs' | 'exceptions' | 'audit'>('breaks')
  const [breaks, setBreaks] = useState<ReconBreak[]>([])
  const [positions, setPositions] = useState<ReconPosition[]>([])
  const [runs, setRuns] = useState<ReconRun[]>([])
  const [exceptions, setExceptions] = useState<ReconException[]>([])
  const [auditLog, setAuditLog] = useState<ReconAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rBr, rP, rR, rE, rA] = await Promise.allSettled([
        fetch('/api/v4/reconciliation/breaks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reconciliation/positions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reconciliation/runs').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reconciliation/exceptions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/reconciliation/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rBr.status === 'fulfilled') {
        const raw = Array.isArray(rBr.value) ? rBr.value : rBr.value.breaks ?? rBr.value.data ?? []
        setBreaks(raw.map((b: any) => ({
          breakId: b.break_id ?? b.breakId ?? '', tradeId: b.trade_id ?? b.tradeId ?? '',
          assetClass: b.asset_class ?? b.assetClass ?? '', counterparty: b.counterparty ?? '',
          breakType: b.break_type ?? b.breakType ?? 'price',
          ourValue: Number(b.our_value ?? b.ourValue ?? 0),
          theirValue: Number(b.their_value ?? b.theirValue ?? 0),
          discrepancy: Number(b.discrepancy ?? 0), currency: b.currency ?? '',
          severity: b.severity ?? 'medium', status: b.status ?? 'open',
          daysOpen: Number(b.days_open ?? b.daysOpen ?? 0),
          assignedTo: b.assigned_to ?? b.assignedTo ?? '', tradeDate: b.trade_date ?? b.tradeDate ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load breaks')
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.positions ?? rP.value.data ?? []
        setPositions(raw.map((p: any) => ({
          positionId: p.position_id ?? p.positionId ?? '', instrument: p.instrument ?? '',
          account: p.account ?? '', internalQty: Number(p.internal_qty ?? p.internalQty ?? 0),
          externalQty: Number(p.external_qty ?? p.externalQty ?? 0),
          difference: Number(p.difference ?? 0), currency: p.currency ?? '',
          marketValue: Number(p.market_value ?? p.marketValue ?? 0),
          reconStatus: p.recon_status ?? p.reconStatus ?? 'pending',
          toleranceLimit: Number(p.tolerance_limit ?? p.toleranceLimit ?? 0),
          lastReconAt: p.last_recon_at ?? p.lastReconAt ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.runs ?? rR.value.data ?? []
        setRuns(raw.map((r: any) => ({
          runId: r.run_id ?? r.runId ?? '', runType: r.run_type ?? r.runType ?? '',
          status: r.status ?? 'queued', startedAt: r.started_at ?? r.startedAt ?? '',
          completedAt: r.completed_at ?? r.completedAt ?? '',
          totalItems: Number(r.total_items ?? r.totalItems ?? 0),
          matched: Number(r.matched ?? 0), breaks: Number(r.breaks ?? 0),
          exceptions: Number(r.exceptions ?? 0), durationSecs: Number(r.duration_secs ?? r.durationSecs ?? 0),
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.exceptions ?? rE.value.data ?? []
        setExceptions(raw.map((e: any) => ({
          exceptionId: e.exception_id ?? e.exceptionId ?? '', breakId: e.break_id ?? e.breakId ?? '',
          reason: e.reason ?? '', resolution: e.resolution ?? '', approvedBy: e.approved_by ?? e.approvedBy ?? '',
          expiresAt: e.expires_at ?? e.expiresAt ?? '',
          valueAtRisk: Number(e.value_at_risk ?? e.valueAtRisk ?? 0),
          status: e.status ?? 'pending',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', breakId: a.break_id ?? a.breakId ?? '',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 12000); return () => clearInterval(id) }, [fetchAll])

  const openBreaks = breaks.filter(b => b.status === 'open').length
  const criticalBreaks = breaks.filter(b => b.severity === 'critical').length
  const positionBreaks = positions.filter(p => p.reconStatus === 'break').length

  const TABS2 = [
    { id: 'breaks' as const, label: 'BREAKS' },
    { id: 'positions' as const, label: 'POSITIONS' },
    { id: 'runs' as const, label: 'RUNS' },
    { id: 'exceptions' as const, label: 'EXCEPTIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RECONCILIATION â€” TRADE BREAKS + POSITION MATCHING + EXCEPTION MANAGEMENT</span>
        {openBreaks > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {openBreaks} OPEN BREAKS</span>}
        {criticalBreaks > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚠‘ {criticalBreaks} CRITICAL</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Open Breaks" value={openBreaks} col={openBreaks > 0 ? RED : GREEN} />
        <StatCard label="Critical Breaks" value={criticalBreaks} col={criticalBreaks > 0 ? ORANGE : GREEN} />
        <StatCard label="Position Breaks" value={positionBreaks} col={positionBreaks > 0 ? RED : GREEN} />
        <StatCard label="Pending Exceptions" value={exceptions.filter(e => e.status === 'pending').length} col={AMBER} />
        <StatCard label="Recon Runs" value={runs.length} col={BLUE} />
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

        {tab === 'breaks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Break ID</Th><Th>Trade ID</Th><Th>Asset Class</Th><Th>Counterparty</Th><Th>Type</Th><Th>Severity</Th><Th>Status</Th><Th right>Our Value</Th><Th right>Their Value</Th><Th right>Discrepancy</Th><Th right>Days Open</Th><Th>Assigned</Th></tr></thead>
              <tbody>
                {breaks.length === 0 && <tr><td colSpan={12} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No breaks â€” check /api/v4/reconciliation/breaks</td></tr>}
                {breaks.sort((a, b) => { const sv = { critical: 4, high: 3, medium: 2, low: 1 }; return (sv[b.severity] ?? 0) - (sv[a.severity] ?? 0) }).map((b, i) => (
                  <tr key={i} style={{ background: b.severity === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.breakId}</Td>
                    <Td mono col={BLUE}>{b.tradeId}</Td>
                    <Td mono col={SUBTLE}>{b.assetClass}</Td>
                    <Td mono col={TEXT}>{b.counterparty}</Td>
                    <Td><BreakTypeBadge t={b.breakType} /></Td>
                    <Td><SevBadge s={b.severity} /></Td>
                    <Td><StatusBadge s={b.status} /></Td>
                    <Td right mono col={TEXT}>{b.ourValue.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{b.theirValue.toLocaleString()}</Td>
                    <Td right mono col={b.discrepancy !== 0 ? RED : GREEN}>{b.discrepancy.toLocaleString()}</Td>
                    <Td right mono col={b.daysOpen > 5 ? RED : b.daysOpen > 2 ? AMBER : SUBTLE}>{b.daysOpen}</Td>
                    <Td mono col={SUBTLE}>{b.assignedTo || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'positions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Instrument</Th><Th>Account</Th><Th>Status</Th><Th right>Internal Qty</Th><Th right>External Qty</Th><Th right>Difference</Th><Th>CCY</Th><Th right>Market Value</Th><Th right>Tolerance</Th><Th>Last Recon</Th></tr></thead>
              <tbody>
                {positions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No positions â€” check /api/v4/reconciliation/positions</td></tr>}
                {positions.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)).map((p, i) => (
                  <tr key={i} style={{ background: p.reconStatus === 'break' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.instrument}</Td>
                    <Td mono col={BLUE}>{p.account}</Td>
                    <Td><StatusBadge s={p.reconStatus} /></Td>
                    <Td right mono col={TEXT}>{p.internalQty.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{p.externalQty.toLocaleString()}</Td>
                    <Td right mono col={p.difference !== 0 ? (p.difference > 0 ? GREEN : RED) : SUBTLE}>{p.difference.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{p.currency}</Td>
                    <Td right mono col={TEXT}>{p.marketValue.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{p.toleranceLimit.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{p.lastReconAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'runs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Run ID</Th><Th>Type</Th><Th>Status</Th><Th right>Total Items</Th><Th right>Matched</Th><Th right>Breaks</Th><Th right>Exceptions</Th><Th right>Duration s</Th><Th>Started</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {runs.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No recon runs â€” check /api/v4/reconciliation/runs</td></tr>}
                {runs.map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.runId}</Td>
                    <Td mono col={BLUE}>{r.runType}</Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td right mono col={TEXT}>{r.totalItems.toLocaleString()}</Td>
                    <Td right mono col={GREEN}>{r.matched.toLocaleString()}</Td>
                    <Td right mono col={r.breaks > 0 ? RED : SUBTLE}>{r.breaks}</Td>
                    <Td right mono col={r.exceptions > 0 ? ORANGE : SUBTLE}>{r.exceptions}</Td>
                    <Td right mono col={SUBTLE}>{r.durationSecs.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{r.startedAt}</Td>
                    <Td mono col={SUBTLE}>{r.completedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'exceptions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Exception ID</Th><Th>Break ID</Th><Th>Reason</Th><Th>Resolution</Th><Th>Approved By</Th><Th>Status</Th><Th right>Value at Risk</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {exceptions.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No exceptions â€” check /api/v4/reconciliation/exceptions</td></tr>}
                {exceptions.map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'denied' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.exceptionId}</Td>
                    <Td mono col={BLUE}>{e.breakId}</Td>
                    <Td mono col={TEXT}>{e.reason || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{e.resolution || 'â€”'}</Td>
                    <Td mono col={TEXT}>{e.approvedBy || 'â€”'}</Td>
                    <Td><StatusBadge s={e.status} /></Td>
                    <Td right mono col={e.valueAtRisk > 100000 ? RED : e.valueAtRisk > 10000 ? ORANGE : TEXT}>{e.valueAtRisk.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{e.expiresAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Break ID</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/reconciliation/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={BLUE}>{a.breakId || 'â€”'}</Td>
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
