import React, { useState, useEffect, useCallback } from 'react'
﻿// BillingEventsUI2 — Bloomberg APEX billing events terminal
// Billing event processing, invoice generation, payment tracking, reconciliation
// Tabs: EVENTS | INVOICES | PAYMENTS | RECONCILIATION | AUDIT
// APIs: /api/v4/billing/events, /invoices, /payments, /reconciliation, /audit

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

interface BillingEvent {
  eventId: string
  eventType: string
  entityId: string
  entityType: string
  amount: number
  currency: string
  status: 'pending' | 'processed' | 'failed' | 'voided'
  billingPeriod: string
  description: string
  invoiceId: string
  createdAt: string
}

interface Invoice {
  invoiceId: string
  entityId: string
  entityName: string
  period: string
  subtotal: number
  tax: number
  total: number
  currency: string
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'voided'
  dueDate: string
  paidAt: string
  lineItems: number
}

interface Payment {
  paymentId: string
  invoiceId: string
  entityName: string
  amount: number
  currency: string
  method: string
  status: 'pending' | 'cleared' | 'failed' | 'reversed'
  transactionRef: string
  initiatedAt: string
  clearedAt: string
}

interface ReconciliationRecord {
  reconId: string
  period: string
  entityId: string
  entityName: string
  invoicedAmount: number
  collectedAmount: number
  variance: number
  variancePct: number
  status: 'balanced' | 'shortfall' | 'surplus' | 'pending'
  reconciledAt: string
}

interface BillingAuditEntry {
  auditId: string
  entityId: string
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
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { pending: AMBER, processed: GREEN, failed: RED, voided: SUBTLE, draft: SUBTLE, issued: BLUE, paid: GREEN, overdue: RED, cleared: GREEN, reversed: ORANGE, balanced: GREEN, shortfall: RED, surplus: ORANGE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function fmtCcy(v: number, ccy = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, minimumFractionDigits: 2 }).format(v)
}


export function BillingEventsUI2() {
  const [tab, setTab] = useState<'events' | 'invoices' | 'payments' | 'reconciliation' | 'audit'>('events')
  const [events, setEvents] = useState<BillingEvent[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationRecord[]>([])
  const [auditLog, setAuditLog] = useState<BillingAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rEv, rIn, rPa, rRe, rAu] = await Promise.allSettled([
        fetch('/api/v4/billing/events').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/billing/invoices').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/billing/payments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/billing/reconciliation').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/billing/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rEv.status === 'fulfilled') {
        const raw = Array.isArray(rEv.value) ? rEv.value : rEv.value.events ?? rEv.value.data ?? []
        setEvents(raw.map((e: any) => ({
          eventId: e.event_id ?? e.eventId ?? '', eventType: e.event_type ?? e.eventType ?? '',
          entityId: e.entity_id ?? e.entityId ?? '', entityType: e.entity_type ?? e.entityType ?? '',
          amount: Number(e.amount ?? 0), currency: e.currency ?? 'USD',
          status: e.status ?? 'pending', billingPeriod: e.billing_period ?? e.billingPeriod ?? '',
          description: e.description ?? '', invoiceId: e.invoice_id ?? e.invoiceId ?? '',
          createdAt: e.created_at ?? e.createdAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load billing events')
      if (rIn.status === 'fulfilled') {
        const raw = Array.isArray(rIn.value) ? rIn.value : rIn.value.invoices ?? rIn.value.data ?? []
        setInvoices(raw.map((i: any) => ({
          invoiceId: i.invoice_id ?? i.invoiceId ?? '', entityId: i.entity_id ?? i.entityId ?? '',
          entityName: i.entity_name ?? i.entityName ?? '', period: i.period ?? '',
          subtotal: Number(i.subtotal ?? 0), tax: Number(i.tax ?? 0), total: Number(i.total ?? 0),
          currency: i.currency ?? 'USD', status: i.status ?? 'draft',
          dueDate: i.due_date ?? i.dueDate ?? '', paidAt: i.paid_at ?? i.paidAt ?? '',
          lineItems: Number(i.line_items ?? i.lineItems ?? 0),
        })))
      }
      if (rPa.status === 'fulfilled') {
        const raw = Array.isArray(rPa.value) ? rPa.value : rPa.value.payments ?? rPa.value.data ?? []
        setPayments(raw.map((p: any) => ({
          paymentId: p.payment_id ?? p.paymentId ?? '', invoiceId: p.invoice_id ?? p.invoiceId ?? '',
          entityName: p.entity_name ?? p.entityName ?? '', amount: Number(p.amount ?? 0),
          currency: p.currency ?? 'USD', method: p.method ?? '',
          status: p.status ?? 'pending', transactionRef: p.transaction_ref ?? p.transactionRef ?? '',
          initiatedAt: p.initiated_at ?? p.initiatedAt ?? '', clearedAt: p.cleared_at ?? p.clearedAt ?? '',
        })))
      }
      if (rRe.status === 'fulfilled') {
        const raw = Array.isArray(rRe.value) ? rRe.value : rRe.value.reconciliation ?? rRe.value.data ?? []
        setReconciliation(raw.map((r: any) => ({
          reconId: r.recon_id ?? r.reconId ?? '', period: r.period ?? '',
          entityId: r.entity_id ?? r.entityId ?? '', entityName: r.entity_name ?? r.entityName ?? '',
          invoicedAmount: Number(r.invoiced_amount ?? r.invoicedAmount ?? 0),
          collectedAmount: Number(r.collected_amount ?? r.collectedAmount ?? 0),
          variance: Number(r.variance ?? 0), variancePct: Number(r.variance_pct ?? r.variancePct ?? 0),
          status: r.status ?? 'pending', reconciledAt: r.reconciled_at ?? r.reconciledAt ?? '',
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', entityId: a.entity_id ?? a.entityId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const failed = events.filter(e => e.status === 'failed').length
  const overdue = invoices.filter(i => i.status === 'overdue').length
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0)
  const totalCollected = payments.filter(p => p.status === 'cleared').reduce((s, p) => s + p.amount, 0)

  const TABS2 = [
    { id: 'events' as const, label: 'EVENTS' },
    { id: 'invoices' as const, label: 'INVOICES' },
    { id: 'payments' as const, label: 'PAYMENTS' },
    { id: 'reconciliation' as const, label: 'RECONCILIATION' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>BILLING EVENTS — EVENT PROCESSING + INVOICE GENERATION + PAYMENT TRACKING</span>
        {failed > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {failed} FAILED EVENTS</span>}
        {overdue > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {overdue} OVERDUE</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Events" value={events.length} col={BLUE} />
        <StatCard label="Failed Events" value={failed} col={failed > 0 ? RED : GREEN} />
        <StatCard label="Overdue Invoices" value={overdue} col={overdue > 0 ? ORANGE : GREEN} />
        <StatCard label="Total Invoiced" value={fmtCcy(totalInvoiced)} col={AMBER} />
        <StatCard label="Total Collected" value={fmtCcy(totalCollected)} col={GREEN} />
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

        {tab === 'events' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Event ID</Th><Th>Type</Th><Th>Entity</Th><Th>Entity Type</Th><Th right>Amount</Th><Th>Currency</Th><Th>Status</Th><Th>Period</Th><Th>Invoice</Th><Th>Created</Th></tr></thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No events</td></tr>}
                {events.sort((a, b) => (a.status === 'failed' ? -1 : 1) - (b.status === 'failed' ? -1 : 1)).map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.eventId}</Td>
                    <Td mono col={PURPLE}>{e.eventType}</Td>
                    <Td mono col={BLUE}>{e.entityId}</Td>
                    <Td mono col={SUBTLE}>{e.entityType}</Td>
                    <Td right mono col={e.amount > 0 ? TEXT : SUBTLE}>{fmtCcy(e.amount, e.currency)}</Td>
                    <Td mono col={SUBTLE}>{e.currency}</Td>
                    <Td><StatusBadge2 s={e.status} /></Td>
                    <Td mono col={SUBTLE}>{e.billingPeriod}</Td>
                    <Td mono col={e.invoiceId ? BLUE : SUBTLE}>{e.invoiceId || '—'}</Td>
                    <Td mono col={SUBTLE}>{e.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'invoices' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Invoice ID</Th><Th>Entity</Th><Th>Period</Th><Th>Status</Th><Th right>Subtotal</Th><Th right>Tax</Th><Th right>Total</Th><Th right>Items</Th><Th>Due Date</Th><Th>Paid</Th></tr></thead>
              <tbody>
                {invoices.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No invoices</td></tr>}
                {invoices.sort((a, b) => (a.status === 'overdue' ? -1 : 1) - (b.status === 'overdue' ? -1 : 1)).map((inv, i) => (
                  <tr key={i} style={{ background: inv.status === 'overdue' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{inv.invoiceId}</Td>
                    <Td mono col={BLUE}>{inv.entityName}</Td>
                    <Td mono col={SUBTLE}>{inv.period}</Td>
                    <Td><StatusBadge2 s={inv.status} /></Td>
                    <Td right mono col={SUBTLE}>{fmtCcy(inv.subtotal, inv.currency)}</Td>
                    <Td right mono col={SUBTLE}>{fmtCcy(inv.tax, inv.currency)}</Td>
                    <Td right mono col={TEXT}>{fmtCcy(inv.total, inv.currency)}</Td>
                    <Td right mono col={SUBTLE}>{inv.lineItems}</Td>
                    <Td mono col={inv.status === 'overdue' ? RED : SUBTLE}>{inv.dueDate}</Td>
                    <Td mono col={SUBTLE}>{inv.paidAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'payments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Payment ID</Th><Th>Invoice</Th><Th>Entity</Th><Th right>Amount</Th><Th>Method</Th><Th>Status</Th><Th>Ref</Th><Th>Initiated</Th><Th>Cleared</Th></tr></thead>
              <tbody>
                {payments.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No payments</td></tr>}
                {payments.sort((a, b) => (a.status === 'failed' ? -1 : 1) - (b.status === 'failed' ? -1 : 1)).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.paymentId}</Td>
                    <Td mono col={BLUE}>{p.invoiceId}</Td>
                    <Td mono col={TEXT}>{p.entityName}</Td>
                    <Td right mono col={TEXT}>{fmtCcy(p.amount, p.currency)}</Td>
                    <Td mono col={PURPLE}>{p.method}</Td>
                    <Td><StatusBadge2 s={p.status} /></Td>
                    <Td mono col={SUBTLE}>{p.transactionRef}</Td>
                    <Td mono col={SUBTLE}>{p.initiatedAt}</Td>
                    <Td mono col={SUBTLE}>{p.clearedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reconciliation' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Recon ID</Th><Th>Entity</Th><Th>Period</Th><Th>Status</Th><Th right>Invoiced</Th><Th right>Collected</Th><Th right>Variance</Th><Th right>Var %</Th><Th>Reconciled</Th></tr></thead>
              <tbody>
                {reconciliation.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No reconciliation data</td></tr>}
                {reconciliation.sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct)).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'shortfall' ? RED + '0a' : r.status === 'surplus' ? GREEN + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.reconId}</Td>
                    <Td mono col={BLUE}>{r.entityName}</Td>
                    <Td mono col={SUBTLE}>{r.period}</Td>
                    <Td><StatusBadge2 s={r.status} /></Td>
                    <Td right mono col={SUBTLE}>{fmtCcy(r.invoicedAmount)}</Td>
                    <Td right mono col={SUBTLE}>{fmtCcy(r.collectedAmount)}</Td>
                    <Td right mono col={r.variance < 0 ? RED : r.variance > 0 ? ORANGE : GREEN}>{fmtCcy(Math.abs(r.variance))}</Td>
                    <Td right mono col={Math.abs(r.variancePct) > 5 ? RED : Math.abs(r.variancePct) > 2 ? AMBER : GREEN}>{r.variancePct.toFixed(2)}%</Td>
                    <Td mono col={SUBTLE}>{r.reconciledAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Entity</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.entityId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
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
