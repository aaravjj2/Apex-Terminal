import React, { useState, useEffect, useCallback } from 'react'
﻿// DerivativesGovUI2 — Bloomberg DRGT derivatives governance terminal
// Position limits, approval workflows, margin, EMIR/DFA reporting, clearing
// Tabs: POSITIONS | LIMITS | MARGIN | REPORTING | CLEARING
// APIs: /api/v4/derivatives-gov/positions, /limits, /margin, /reporting, /clearing

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

interface DerivPosition {
  posId: string
  instrument: string
  underlying: string
  productType: 'future' | 'option' | 'swap' | 'forward' | 'cfd' | 'swaption'
  direction: 'long' | 'short'
  qty: number
  notional: number
  delta: number
  gamma: number
  vega: number
  theta: number
  mtm: number
  approvalStatus: 'pre_approved' | 'pending_approval' | 'flagged' | 'rejected'
  approvedBy: string
  book: string
}

interface PositionLimit {
  limitId: string
  limitType: string
  scope: string
  productType: string
  maxPosition: number
  currentPosition: number
  utilizationPct: number
  breached: boolean
  approver: string
  lastReviewed: string
  currency: string
}

interface DerivMargin {
  counterparty: string
  portfolio: string
  variationMargin: number
  initialMargin: number
  marginCall: number
  postedMargin: number
  collateralHaircut: number
  netExposure: number
  imModel: string
  currency: string
}

interface DerivReport {
  reportId: string
  regime: 'EMIR' | 'DFA' | 'MiFID2' | 'SFTR' | 'CFTC'
  tradeId: string
  reportType: string
  status: 'accepted' | 'rejected' | 'pending' | 'late' | 'cancelled'
  tradeDate: string
  reportedAt: string
  uti: string
  lei: string
  errorDesc: string
}

interface ClearingEntry {
  tradeId: string
  instrument: string
  ccp: string
  clearingStatus: 'cleared' | 'pending' | 'not_clearable' | 'exempted'
  clearingObligation: boolean
  memberId: string
  clientId: string
  clearingDate: string
  grossAmount: number
  riskCategory: string
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
function UtilBar({ pct, warn, crit }: { pct: number; warn?: number; crit?: number }) {
  const c = pct >= (crit ?? 90) ? RED : pct >= (warn ?? 75) ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{pct.toFixed(1)}%</span>
    </div>
  )
}
function ProductBadge({ t }: { t: string }) {
  const m: Record<string, string> = { future: BLUE, option: PURPLE, swap: ORANGE, forward: AMBER, cfd: GREEN, swaption: RED }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function ApprovalBadge({ s }: { s: string }) {
  const m: Record<string, string> = { pre_approved: GREEN, pending_approval: AMBER, flagged: ORANGE, rejected: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function RegimeBadge({ r }: { r: string }) {
  const m: Record<string, string> = { EMIR: BLUE, DFA: GREEN, MiFID2: PURPLE, SFTR: ORANGE, CFTC: AMBER }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r}</span>
}
function ClearBadge({ s }: { s: string }) {
  const m: Record<string, string> = { cleared: GREEN, pending: AMBER, not_clearable: RED, exempted: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}


export function DerivativesGovUI2() {
  const [tab, setTab] = useState<'positions' | 'limits' | 'margin' | 'reporting' | 'clearing'>('positions')
  const [positions, setPositions] = useState<DerivPosition[]>([])
  const [limits, setLimits] = useState<PositionLimit[]>([])
  const [margin, setMargin] = useState<DerivMargin[]>([])
  const [reporting, setReporting] = useState<DerivReport[]>([])
  const [clearing, setClearing] = useState<ClearingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rP, rL, rM, rR, rC] = await Promise.allSettled([
        fetch('/api/v4/derivatives-gov/positions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-gov/limits').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-gov/margin').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-gov/reporting').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/derivatives-gov/clearing').then(r => r.ok ? r.json() : []),
      ])
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.positions ?? rP.value.data ?? []
        setPositions(raw.map((p: any) => ({
          posId: p.pos_id ?? p.posId ?? '', instrument: p.instrument ?? '', underlying: p.underlying ?? '',
          productType: p.product_type ?? p.productType ?? 'future', direction: p.direction ?? 'long',
          qty: Number(p.qty ?? 0), notional: Number(p.notional ?? 0), delta: Number(p.delta ?? 0),
          gamma: Number(p.gamma ?? 0), vega: Number(p.vega ?? 0), theta: Number(p.theta ?? 0),
          mtm: Number(p.mtm ?? 0), approvalStatus: p.approval_status ?? p.approvalStatus ?? 'pre_approved',
          approvedBy: p.approved_by ?? p.approvedBy ?? '', book: p.book ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load positions')
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.limits ?? rL.value.data ?? []
        setLimits(raw.map((l: any) => ({
          limitId: l.limit_id ?? l.limitId ?? '', limitType: l.limit_type ?? l.limitType ?? '', scope: l.scope ?? '',
          productType: l.product_type ?? l.productType ?? '', maxPosition: Number(l.max_position ?? l.maxPosition ?? 0),
          currentPosition: Number(l.current_position ?? l.currentPosition ?? 0),
          utilizationPct: Number(l.utilization_pct ?? l.utilizationPct ?? 0), breached: Boolean(l.breached ?? false),
          approver: l.approver ?? '', lastReviewed: l.last_reviewed ?? l.lastReviewed ?? '', currency: l.currency ?? 'USD',
        })))
      }
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.margin ?? rM.value.data ?? []
        setMargin(raw.map((m: any) => ({
          counterparty: m.counterparty ?? '', portfolio: m.portfolio ?? '',
          variationMargin: Number(m.variation_margin ?? m.variationMargin ?? 0),
          initialMargin: Number(m.initial_margin ?? m.initialMargin ?? 0),
          marginCall: Number(m.margin_call ?? m.marginCall ?? 0),
          postedMargin: Number(m.posted_margin ?? m.postedMargin ?? 0),
          collateralHaircut: Number(m.collateral_haircut ?? m.collateralHaircut ?? 0),
          netExposure: Number(m.net_exposure ?? m.netExposure ?? 0),
          imModel: m.im_model ?? m.imModel ?? '', currency: m.currency ?? 'USD',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.reporting ?? rR.value.data ?? []
        setReporting(raw.map((r: any) => ({
          reportId: r.report_id ?? r.reportId ?? '', regime: r.regime ?? 'EMIR',
          tradeId: r.trade_id ?? r.tradeId ?? '', reportType: r.report_type ?? r.reportType ?? '',
          status: r.status ?? 'pending', tradeDate: r.trade_date ?? r.tradeDate ?? '',
          reportedAt: r.reported_at ?? r.reportedAt ?? '', uti: r.uti ?? '', lei: r.lei ?? '',
          errorDesc: r.error_desc ?? r.errorDesc ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.clearing ?? rC.value.data ?? []
        setClearing(raw.map((c: any) => ({
          tradeId: c.trade_id ?? c.tradeId ?? '', instrument: c.instrument ?? '', ccp: c.ccp ?? '',
          clearingStatus: c.clearing_status ?? c.clearingStatus ?? 'pending',
          clearingObligation: Boolean(c.clearing_obligation ?? c.clearingObligation ?? false),
          memberId: c.member_id ?? c.memberId ?? '', clientId: c.client_id ?? c.clientId ?? '',
          clearingDate: c.clearing_date ?? c.clearingDate ?? '', grossAmount: Number(c.gross_amount ?? c.grossAmount ?? 0),
          riskCategory: c.risk_category ?? c.riskCategory ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const pendingApprovals = positions.filter(p => p.approvalStatus === 'pending_approval').length
  const flagged = positions.filter(p => p.approvalStatus === 'flagged').length
  const breachedLimits = limits.filter(l => l.breached).length
  const reportingErrors = reporting.filter(r => r.status === 'rejected' || r.status === 'late').length

  const TABS = [
    { id: 'positions' as const, label: 'POSITIONS' },
    { id: 'limits' as const, label: 'LIMITS' },
    { id: 'margin' as const, label: 'MARGIN' },
    { id: 'reporting' as const, label: 'REPORTING' },
    { id: 'clearing' as const, label: 'CLEARING' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>DRGT</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>DERIVATIVES GOVERNANCE — POSITIONS + LIMITS + MARGIN + EMIR/DFA REPORTING + CLEARING</span>
        {pendingApprovals > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {pendingApprovals} PENDING APPROVALS</span>}
        {flagged > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {flagged} FLAGGED</span>}
        {breachedLimits > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {breachedLimits} LIMIT BREACHES</span>}
        {reportingErrors > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {reportingErrors} REPORT ERRORS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Positions" value={positions.length} col={BLUE} />
        <StatCard label="Pending Approvals" value={pendingApprovals} col={pendingApprovals > 0 ? AMBER : GREEN} />
        <StatCard label="Limit Breaches" value={breachedLimits} col={breachedLimits > 0 ? RED : GREEN} />
        <StatCard label="Report Errors" value={reportingErrors} col={reportingErrors > 0 ? RED : GREEN} />
        <StatCard label="Cleared Trades" value={clearing.filter(c => c.clearingStatus === 'cleared').length} col={GREEN} />
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

        {tab === 'positions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Instrument</Th><Th>Type</Th><Th>Dir</Th><Th>Approval</Th><Th right>Qty</Th><Th right>Notional</Th><Th right>MtM</Th><Th right>Delta</Th><Th right>Vega</Th><Th>Book</Th></tr></thead>
              <tbody>
                {positions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No positions</td></tr>}
                {positions.map((p, i) => (
                  <tr key={i} style={{ background: p.approvalStatus === 'flagged' ? ORANGE + '08' : p.approvalStatus === 'pending_approval' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.instrument}</Td>
                    <Td><ProductBadge t={p.productType} /></Td>
                    <Td mono col={p.direction === 'long' ? GREEN : RED}>{p.direction.toUpperCase()}</Td>
                    <Td><ApprovalBadge s={p.approvalStatus} /></Td>
                    <Td right mono col={TEXT}>{p.qty.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>${(p.notional / 1e6).toFixed(2)}M</Td>
                    <Td right mono col={p.mtm >= 0 ? GREEN : RED}>{p.mtm >= 0 ? '+' : ''}{p.mtm.toLocaleString()}</Td>
                    <Td right mono col={BLUE}>{p.delta.toFixed(4)}</Td>
                    <Td right mono col={PURPLE}>{p.vega.toFixed(2)}</Td>
                    <Td mono col={SUBTLE}>{p.book}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'limits' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Limit Type</Th><Th>Scope</Th><Th>Product</Th><Th>Utilization</Th><Th right>Current</Th><Th right>Max</Th><Th>Breached</Th><Th>Approver</Th><Th>Last Review</Th></tr></thead>
              <tbody>
                {limits.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No limits</td></tr>}
                {limits.sort((a, b) => b.utilizationPct - a.utilizationPct).map((l, i) => (
                  <tr key={i} style={{ background: l.breached ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{l.limitType}</Td>
                    <Td mono col={BLUE}>{l.scope}</Td>
                    <Td mono col={PURPLE}>{l.productType}</Td>
                    <Td><UtilBar pct={l.utilizationPct} warn={75} crit={90} /></Td>
                    <Td right mono col={TEXT}>{l.currentPosition.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{l.maxPosition.toLocaleString()}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: l.breached ? RED : GREEN }}>{l.breached ? 'BREACH' : 'OK'}</span></Td>
                    <Td mono col={SUBTLE}>{l.approver}</Td>
                    <Td mono col={SUBTLE}>{l.lastReviewed}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'margin' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Counterparty</Th><Th>Portfolio</Th><Th right>VM</Th><Th right>IM</Th><Th right>Margin Call</Th><Th right>Posted</Th><Th right>Haircut %</Th><Th right>Net Exposure</Th><Th>IM Model</Th></tr></thead>
              <tbody>
                {margin.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No margin</td></tr>}
                {margin.sort((a, b) => Math.abs(b.netExposure) - Math.abs(a.netExposure)).map((m, i) => (
                  <tr key={i} style={{ background: m.marginCall > 0 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.counterparty}</Td>
                    <Td mono col={BLUE}>{m.portfolio}</Td>
                    <Td right mono col={m.variationMargin >= 0 ? GREEN : RED}>{m.variationMargin.toLocaleString()}</Td>
                    <Td right mono col={ORANGE}>{m.initialMargin.toLocaleString()}</Td>
                    <Td right mono col={m.marginCall > 0 ? RED : SUBTLE}>{m.marginCall.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{m.postedMargin.toLocaleString()}</Td>
                    <Td right mono col={AMBER}>{m.collateralHaircut.toFixed(2)}%</Td>
                    <Td right mono col={m.netExposure >= 0 ? GREEN : RED}>{m.netExposure.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{m.imModel}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reporting' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Regime</Th><Th>Trade ID</Th><Th>Report Type</Th><Th>Status</Th><Th>UTI</Th><Th>Trade Date</Th><Th>Reported</Th><Th>Error</Th></tr></thead>
              <tbody>
                {reporting.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reporting</td></tr>}
                {reporting.map((r, i) => {
                  const sc = r.status === 'accepted' ? GREEN : r.status === 'rejected' ? RED : r.status === 'late' ? ORANGE : AMBER
                  return (
                    <tr key={i} style={{ background: (r.status === 'rejected' || r.status === 'late') ? RED + '0a' : 'transparent' }}>
                      <Td><RegimeBadge r={r.regime} /></Td>
                      <Td mono col={AMBER}>{r.tradeId}</Td>
                      <Td mono col={BLUE}>{r.reportType}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: sc, background: sc + '22', borderRadius: 3, padding: '2px 5px' }}>{r.status.toUpperCase()}</span></Td>
                      <Td mono col={SUBTLE} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.uti || '—'}</Td>
                      <Td mono col={SUBTLE}>{r.tradeDate}</Td>
                      <Td mono col={SUBTLE}>{r.reportedAt}</Td>
                      <Td mono col={RED} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.errorDesc || '—'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'clearing' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Trade ID</Th><Th>Instrument</Th><Th>CCP</Th><Th>Clearing Status</Th><Th>Obligation</Th><Th right>Gross Amount</Th><Th>Member ID</Th><Th>Risk Category</Th><Th>Clearing Date</Th></tr></thead>
              <tbody>
                {clearing.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No clearing</td></tr>}
                {clearing.map((c, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{c.tradeId}</Td>
                    <Td mono col={BLUE}>{c.instrument}</Td>
                    <Td mono col={ORANGE}>{c.ccp}</Td>
                    <Td><ClearBadge s={c.clearingStatus} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.clearingObligation ? RED : GREEN }}>{c.clearingObligation ? 'MANDATORY' : 'OPTIONAL'}</span></Td>
                    <Td right mono col={TEXT}>${(c.grossAmount / 1e6).toFixed(2)}M</Td>
                    <Td mono col={SUBTLE}>{c.memberId}</Td>
                    <Td mono col={PURPLE}>{c.riskCategory}</Td>
                    <Td mono col={SUBTLE}>{c.clearingDate}</Td>
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
