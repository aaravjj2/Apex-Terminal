import React, { useState, useEffect, useCallback } from 'react'
﻿// CorporateActionsUI2 — Bloomberg CACT-grade corporate actions terminal
// Dividends, splits, mergers, spin-offs, rights issues, tender offers
// Tabs: UPCOMING ACTIONS | DIVIDENDS | CORPORATE EVENTS | M&A | PROCESSING
// APIs: /api/v4/corporate-actions/upcoming, /dividends, /events, /ma, /processing

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

interface UpcomingAction {
  id: string
  symbol: string
  actionType: 'dividend' | 'split' | 'merger' | 'spinoff' | 'rights_issue' | 'tender_offer' | 'name_change' | 'delisting'
  exDate: string
  payDate: string
  recordDate: string
  daysUntilEx: number
  description: string
  amount?: number
  currency?: string
  ratio?: string
  status: 'confirmed' | 'announced' | 'pending' | 'completed'
}

interface DividendRecord {
  symbol: string
  exDate: string
  payDate: string
  recordDate: string
  amount: number
  currency: string
  frequency: string
  yieldPct: number
  payoutRatioPct: number
  dividendType: 'regular' | 'special' | 'stock'
  exAdjustedPrice: number
}

interface CorporateEvent {
  id: string
  symbol: string
  eventType: string
  eventDate: string
  description: string
  impact: 'positive' | 'negative' | 'neutral'
  magnitude: 'high' | 'medium' | 'low'
  processing: 'auto' | 'manual' | 'pending'
}

interface MaRecord {
  acquirer: string
  target: string
  dealType: string
  dealValue: number
  currency: string
  expectedClose: string
  dealStatus: 'announced' | 'pending_approval' | 'closing' | 'terminated' | 'completed'
  premiumPct: number
  synergiesEstUsd: number
}

interface ProcessingStatus {
  actionId: string
  symbol: string
  actionType: string
  status: 'processed' | 'pending' | 'failed' | 'manual_review'
  processedAt: string
  adjustmentsApplied: string[]
  errors: string[]
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

function ActionTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = {
    dividend: GREEN, split: BLUE, merger: AMBER, spinoff: PURPLE, rights_issue: ORANGE,
    tender_offer: RED, name_change: SUBTLE, delisting: RED,
  }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{t.replace(/_/g, ' ').toUpperCase()}</span>
}

function StatusBadgeCA({ s }: { s: string }) {
  const m: Record<string, string> = { confirmed: GREEN, announced: BLUE, pending: AMBER, completed: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.toUpperCase()}</span>
}

function ImpactBadge({ imp }: { imp: string }) {
  const m: Record<string, string> = { positive: GREEN, negative: RED, neutral: SUBTLE }
  const c = m[imp] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c }}>{'â–²' === 'positive' ? 'â–²' : imp === 'positive' ? 'â–²' : imp === 'negative' ? 'â–¼' : '—'} {imp.toUpperCase()}</span>
}

function DealStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { announced: BLUE, pending_approval: AMBER, closing: GREEN, terminated: RED, completed: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 6px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}

function DteCountdown({ days }: { days: number }) {
  const c = days <= 3 ? RED : days <= 7 ? ORANGE : days <= 30 ? AMBER : GREEN
  return <span style={{ fontFamily: MONO, fontSize: 10, color: c, fontWeight: days <= 7 ? 700 : 400 }}>{days}d</span>
}


export function CorporateActionsUI2() {
  const [tab, setTab] = useState<'upcoming' | 'dividends' | 'events' | 'ma' | 'processing'>('upcoming')
  const [upcoming, setUpcoming] = useState<UpcomingAction[]>([])
  const [dividends, setDividends] = useState<DividendRecord[]>([])
  const [events, setEvents] = useState<CorporateEvent[]>([])
  const [maRecords, setMaRecords] = useState<MaRecord[]>([])
  const [processing, setProcessing] = useState<ProcessingStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rU, rD, rE, rM, rP] = await Promise.allSettled([
        fetch('/api/v4/corporate-actions/upcoming').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/corporate-actions/dividends').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/corporate-actions/events').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/corporate-actions/ma').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/corporate-actions/processing').then(r => r.ok ? r.json() : []),
      ])
      if (rU.status === 'fulfilled') {
        const raw = Array.isArray(rU.value) ? rU.value : rU.value.actions ?? rU.value.data ?? []
        setUpcoming(raw.map((a: any) => ({
          id: a.id ?? '', symbol: a.symbol ?? '', actionType: a.action_type ?? a.actionType ?? 'dividend',
          exDate: a.ex_date ?? a.exDate ?? '', payDate: a.pay_date ?? a.payDate ?? '',
          recordDate: a.record_date ?? a.recordDate ?? '', daysUntilEx: Number(a.days_until_ex ?? a.daysUntilEx ?? 0),
          description: a.description ?? '', amount: a.amount !== undefined ? Number(a.amount) : undefined,
          currency: a.currency, ratio: a.ratio, status: a.status ?? 'pending',
        })))
        setErr(null)
      } else setErr('Failed to load upcoming actions')
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.dividends ?? rD.value.data ?? []
        setDividends(raw.map((d: any) => ({
          symbol: d.symbol ?? '', exDate: d.ex_date ?? d.exDate ?? '', payDate: d.pay_date ?? d.payDate ?? '',
          recordDate: d.record_date ?? d.recordDate ?? '', amount: Number(d.amount ?? 0), currency: d.currency ?? 'USD',
          frequency: d.frequency ?? '', yieldPct: Number(d.yield_pct ?? d.yieldPct ?? 0),
          payoutRatioPct: Number(d.payout_ratio_pct ?? d.payoutRatioPct ?? 0), dividendType: d.dividend_type ?? d.dividendType ?? 'regular',
          exAdjustedPrice: Number(d.ex_adjusted_price ?? d.exAdjustedPrice ?? 0),
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.events ?? rE.value.data ?? []
        setEvents(raw.map((e: any) => ({
          id: e.id ?? '', symbol: e.symbol ?? '', eventType: e.event_type ?? e.eventType ?? '',
          eventDate: e.event_date ?? e.eventDate ?? '', description: e.description ?? '',
          impact: e.impact ?? 'neutral', magnitude: e.magnitude ?? 'low', processing: e.processing ?? 'auto',
        })))
      }
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.deals ?? rM.value.data ?? []
        setMaRecords(raw.map((m: any) => ({
          acquirer: m.acquirer ?? '', target: m.target ?? '', dealType: m.deal_type ?? m.dealType ?? '',
          dealValue: Number(m.deal_value ?? m.dealValue ?? 0), currency: m.currency ?? 'USD',
          expectedClose: m.expected_close ?? m.expectedClose ?? '', dealStatus: m.deal_status ?? m.dealStatus ?? 'announced',
          premiumPct: Number(m.premium_pct ?? m.premiumPct ?? 0), synergiesEstUsd: Number(m.synergies_est_usd ?? m.synergiesEstUsd ?? 0),
        })))
      }
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.processing ?? rP.value.data ?? []
        setProcessing(raw.map((p: any) => ({
          actionId: p.action_id ?? p.actionId ?? '', symbol: p.symbol ?? '', actionType: p.action_type ?? p.actionType ?? '',
          status: p.status ?? 'pending', processedAt: p.processed_at ?? p.processedAt ?? '',
          adjustmentsApplied: Array.isArray(p.adjustments_applied) ? p.adjustments_applied : p.adjustmentsApplied ?? [],
          errors: Array.isArray(p.errors) ? p.errors : [],
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const filteredUpcoming = upcoming.filter(a => typeFilter === 'all' || a.actionType === typeFilter)
  const imminent = upcoming.filter(a => a.daysUntilEx <= 7).length
  const failedProc = processing.filter(p => p.status === 'failed' || p.status === 'manual_review').length
  const activeDeals = maRecords.filter(m => m.dealStatus !== 'completed' && m.dealStatus !== 'terminated').length

  const TABS = [
    { id: 'upcoming' as const, label: 'UPCOMING ACTIONS' },
    { id: 'dividends' as const, label: 'DIVIDENDS' },
    { id: 'events' as const, label: 'CORP EVENTS' },
    { id: 'ma' as const, label: 'M&A' },
    { id: 'processing' as const, label: 'PROCESSING' },
  ]

  const ACTION_TYPES = ['all', 'dividend', 'split', 'merger', 'spinoff', 'rights_issue', 'tender_offer']

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>CACT</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CORPORATE ACTIONS — DIVIDENDS + SPLITS + M&A + RIGHTS + TENDER OFFERS + PROCESSING</span>
        {imminent > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {imminent} EX IN â‰¤7 DAYS</span>}
        {failedProc > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠  {failedProc} FAILED PROCESSING</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Upcoming" value={upcoming.length} sub="total actions" />
        <StatCard label="Imminent (â‰¤7d)" value={imminent} col={imminent > 0 ? ORANGE : GREEN} />
        <StatCard label="Active M&A Deals" value={activeDeals} col={AMBER} />
        <StatCard label="Failed Processing" value={failedProc} col={failedProc > 0 ? RED : GREEN} />
        <StatCard label="Dividends Tracked" value={dividends.length} col={BLUE} />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE,
              background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`,
              padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {/* UPCOMING */}
        {tab === 'upcoming' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {ACTION_TYPES.map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  style={{ fontFamily: MONO, fontSize: 10, color: typeFilter === t ? AMBER : SUBTLE, background: typeFilter === t ? AMBER + '22' : 'transparent', border: `1px solid ${typeFilter === t ? AMBER + '55' : BORDER}`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
                  {t === 'all' ? 'ALL' : t.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Symbol</Th><Th>Action</Th><Th>Status</Th><Th>Ex Date</Th><Th right>Ex In</Th><Th>Pay Date</Th><Th right>Amount</Th><Th>Description</Th></tr></thead>
                <tbody>
                  {filteredUpcoming.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No upcoming actions</td></tr>}
                  {filteredUpcoming.sort((a, b) => a.daysUntilEx - b.daysUntilEx).map((a, i) => (
                    <tr key={i} style={{ background: a.daysUntilEx <= 3 ? RED + '0a' : a.daysUntilEx <= 7 ? ORANGE + '08' : 'transparent' }}>
                      <Td mono col={AMBER}>{a.symbol}</Td>
                      <Td><ActionTypeBadge t={a.actionType} /></Td>
                      <Td><StatusBadgeCA s={a.status} /></Td>
                      <Td mono col={SUBTLE}>{a.exDate}</Td>
                      <Td right><DteCountdown days={a.daysUntilEx} /></Td>
                      <Td mono col={SUBTLE}>{a.payDate}</Td>
                      <Td right mono col={GREEN}>{a.amount !== undefined ? `${a.currency ?? 'USD'} ${a.amount.toFixed(4)}` : a.ratio ?? '—'}</Td>
                      <Td><span style={{ fontSize: 10, color: SUBTLE }}>{a.description}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DIVIDENDS */}
        {tab === 'dividends' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Type</Th><Th>Ex Date</Th><Th right>Amount</Th><Th>Frequency</Th><Th right>Yield %</Th><Th right>Payout %</Th><Th right>Ex-Adj Price</Th></tr></thead>
              <tbody>
                {dividends.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No dividend data</td></tr>}
                {dividends.map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.symbol}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: d.dividendType === 'special' ? ORANGE : d.dividendType === 'stock' ? PURPLE : GREEN }}>{d.dividendType.toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{d.exDate}</Td>
                    <Td right mono col={GREEN}>{d.currency} {d.amount.toFixed(4)}</Td>
                    <Td mono col={SUBTLE}>{d.frequency}</Td>
                    <Td right mono col={d.yieldPct > 5 ? GREEN : TEXT}>{d.yieldPct.toFixed(2)}%</Td>
                    <Td right mono col={d.payoutRatioPct > 100 ? RED : TEXT}>{d.payoutRatioPct.toFixed(1)}%</Td>
                    <Td right mono>{d.exAdjustedPrice.toFixed(4)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Event Type</Th><Th>Date</Th><Th>Impact</Th><Th>Magnitude</Th><Th>Processing</Th><Th>Description</Th></tr></thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No events</td></tr>}
                {events.map((e, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{e.symbol}</Td>
                    <Td mono col={BLUE}>{e.eventType}</Td>
                    <Td mono col={SUBTLE}>{e.eventDate}</Td>
                    <Td><ImpactBadge imp={e.impact} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.magnitude === 'high' ? RED : e.magnitude === 'medium' ? AMBER : SUBTLE }}>{e.magnitude.toUpperCase()}</span></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: e.processing === 'manual' ? ORANGE : e.processing === 'pending' ? AMBER : GREEN }}>{e.processing.toUpperCase()}</span></Td>
                    <Td><span style={{ fontSize: 10, color: SUBTLE }}>{e.description}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* M&A */}
        {tab === 'ma' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Acquirer</Th><Th>Target</Th><Th>Deal Type</Th><Th>Status</Th><Th right>Deal Value</Th><Th right>Premium %</Th><Th right>Synergies</Th><Th>Expected Close</Th></tr></thead>
              <tbody>
                {maRecords.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No M&A data</td></tr>}
                {maRecords.map((m, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{m.acquirer}</Td>
                    <Td mono col={BLUE}>{m.target}</Td>
                    <Td mono col={SUBTLE}>{m.dealType}</Td>
                    <Td><DealStatusBadge s={m.dealStatus} /></Td>
                    <Td right mono col={ORANGE}>{m.currency} {(m.dealValue / 1e9).toFixed(2)}B</Td>
                    <Td right mono col={m.premiumPct > 30 ? GREEN : TEXT}>{m.premiumPct.toFixed(1)}%</Td>
                    <Td right mono col={GREEN}>{m.currency} {(m.synergiesEstUsd / 1e6).toFixed(0)}M</Td>
                    <Td mono col={SUBTLE}>{m.expectedClose}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PROCESSING */}
        {tab === 'processing' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th>Action Type</Th><Th>Status</Th><Th>Processed At</Th><Th>Adjustments Applied</Th><Th>Errors</Th></tr></thead>
              <tbody>
                {processing.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No processing data</td></tr>}
                {processing.sort((a, b) => { const o: Record<string, number> = { failed: 0, manual_review: 1, pending: 2, processed: 3 }; return (o[a.status] ?? 9) - (o[b.status] ?? 9) }).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'failed' ? RED + '0a' : p.status === 'manual_review' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.symbol}</Td>
                    <Td><ActionTypeBadge t={p.actionType} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: p.status === 'processed' ? GREEN : p.status === 'pending' ? AMBER : RED }}>{p.status.replace(/_/g, ' ').toUpperCase()}</span></Td>
                    <Td mono col={SUBTLE}>{p.processedAt}</Td>
                    <Td><span style={{ fontSize: 10, color: GREEN }}>{p.adjustmentsApplied.join(', ') || '—'}</span></Td>
                    <Td><span style={{ fontSize: 10, color: p.errors.length > 0 ? RED : SUBTLE }}>{p.errors.join(', ') || '—'}</span></Td>
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
