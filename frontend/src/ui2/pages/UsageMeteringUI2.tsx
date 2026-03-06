import React, { useState, useEffect, useCallback } from 'react'
﻿// UsageMeteringUI2 — Bloomberg APEX Usage Metering terminal
// Real-time tracking, quota enforcement, billing attribution, pipeline health
// Tabs: METERS | PIPELINE | QUOTAS | BILLING | AUDIT
// APIs: /api/v4/usage-metering/meters, /pipeline, /quotas, /billing, /audit

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

interface UsageMeter {
  meterId: string
  tenantId: string
  tenantName: string
  metricName: string
  metricType: 'api_calls' | 'data_gb' | 'compute_hours' | 'active_users' | 'events' | 'storage_gb'
  unit: string
  currentPeriodValue: number
  previousPeriodValue: number
  changePercent: number
  ratePerHour: number
  projectedEndValue: number
  quotaLimit: number
  quotaUsedPct: number
  billingRate: number
  billedAmountUsd: number
  lastUpdated: string
}

interface PipelineNode {
  nodeId: string
  name: string
  type: 'ingestion' | 'aggregation' | 'enrichment' | 'delivery' | 'storage'
  status: 'healthy' | 'degraded' | 'down' | 'maintenance'
  eventsPerSecond: number
  latencyMs: number
  errorRatePct: number
  backlogCount: number
  cpuPct: number
  memoryPct: number
  region: string
  lastUpdated: string
}

interface UsageQuota {
  quotaId: string
  tenantId: string
  tenantName: string
  resource: string
  plan: string
  softLimit: number
  hardLimit: number
  currentUsage: number
  softUsedPct: number
  hardUsedPct: number
  enforcementMode: 'warn' | 'throttle' | 'block'
  resetPeriod: string
  nextReset: string
}

interface BillingAttribution {
  attributionId: string
  tenantId: string
  tenantName: string
  product: string
  sku: string
  quantity: number
  unitPrice: number
  subtotalUsd: number
  discountPct: number
  finalAmountUsd: number
  billingPeriod: string
  invoiceStatus: 'draft' | 'finalized' | 'sent' | 'paid' | 'overdue'
}

interface MeteringAuditEntry {
  auditId: string
  tenantId: string
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
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { healthy: GREEN, degraded: AMBER, down: RED, maintenance: PURPLE, draft: SUBTLE, finalized: BLUE, sent: AMBER, paid: GREEN, overdue: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const col = pct >= 95 ? RED : pct >= 80 ? ORANGE : pct >= 60 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(0)}%</span>
    </div>
  )
}
function ChgArrow({ pct }: { pct: number }) {
  const col = pct > 0 ? GREEN : pct < 0 ? RED : SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 11, color: col }}>{pct > 0 ? 'â–²' : pct < 0 ? 'â–¼' : '—'}{Math.abs(pct).toFixed(1)}%</span>
}


export function UsageMeteringUI2() {
  const [tab, setTab] = useState<'meters' | 'pipeline' | 'quotas' | 'billing' | 'audit'>('meters')
  const [meters, setMeters] = useState<UsageMeter[]>([])
  const [pipeline, setPipeline] = useState<PipelineNode[]>([])
  const [quotas, setQuotas] = useState<UsageQuota[]>([])
  const [billing, setBilling] = useState<BillingAttribution[]>([])
  const [auditLog, setAuditLog] = useState<MeteringAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rM, rP, rQ, rB, rA] = await Promise.allSettled([
        fetch('/api/v4/usage-metering/meters').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/usage-metering/pipeline').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/usage-metering/quotas').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/usage-metering/billing').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/usage-metering/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.meters ?? rM.value.data ?? []
        setMeters(raw.map((m: any) => ({
          meterId: m.meter_id ?? m.meterId ?? '', tenantId: m.tenant_id ?? m.tenantId ?? '',
          tenantName: m.tenant_name ?? m.tenantName ?? '', metricName: m.metric_name ?? m.metricName ?? '',
          metricType: m.metric_type ?? m.metricType ?? 'api_calls', unit: m.unit ?? '',
          currentPeriodValue: Number(m.current_period_value ?? m.currentPeriodValue ?? 0),
          previousPeriodValue: Number(m.previous_period_value ?? m.previousPeriodValue ?? 0),
          changePercent: Number(m.change_percent ?? m.changePercent ?? 0),
          ratePerHour: Number(m.rate_per_hour ?? m.ratePerHour ?? 0),
          projectedEndValue: Number(m.projected_end_value ?? m.projectedEndValue ?? 0),
          quotaLimit: Number(m.quota_limit ?? m.quotaLimit ?? 0),
          quotaUsedPct: Number(m.quota_used_pct ?? m.quotaUsedPct ?? 0),
          billingRate: Number(m.billing_rate ?? m.billingRate ?? 0),
          billedAmountUsd: Number(m.billed_amount_usd ?? m.billedAmountUsd ?? 0),
          lastUpdated: m.last_updated ?? m.lastUpdated ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load meters')
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.pipeline ?? rP.value.nodes ?? rP.value.data ?? []
        setPipeline(raw.map((p: any) => ({
          nodeId: p.node_id ?? p.nodeId ?? '', name: p.name ?? '',
          type: p.type ?? 'ingestion', status: p.status ?? 'healthy',
          eventsPerSecond: Number(p.events_per_second ?? p.eventsPerSecond ?? 0),
          latencyMs: Number(p.latency_ms ?? p.latencyMs ?? 0),
          errorRatePct: Number(p.error_rate_pct ?? p.errorRatePct ?? 0),
          backlogCount: Number(p.backlog_count ?? p.backlogCount ?? 0),
          cpuPct: Number(p.cpu_pct ?? p.cpuPct ?? 0), memoryPct: Number(p.memory_pct ?? p.memoryPct ?? 0),
          region: p.region ?? '', lastUpdated: p.last_updated ?? p.lastUpdated ?? '',
        })))
      }
      if (rQ.status === 'fulfilled') {
        const raw = Array.isArray(rQ.value) ? rQ.value : rQ.value.quotas ?? rQ.value.data ?? []
        setQuotas(raw.map((q: any) => ({
          quotaId: q.quota_id ?? q.quotaId ?? '', tenantId: q.tenant_id ?? q.tenantId ?? '',
          tenantName: q.tenant_name ?? q.tenantName ?? '', resource: q.resource ?? '', plan: q.plan ?? '',
          softLimit: Number(q.soft_limit ?? q.softLimit ?? 0), hardLimit: Number(q.hard_limit ?? q.hardLimit ?? 0),
          currentUsage: Number(q.current_usage ?? q.currentUsage ?? 0),
          softUsedPct: Number(q.soft_used_pct ?? q.softUsedPct ?? 0),
          hardUsedPct: Number(q.hard_used_pct ?? q.hardUsedPct ?? 0),
          enforcementMode: q.enforcement_mode ?? q.enforcementMode ?? 'warn',
          resetPeriod: q.reset_period ?? q.resetPeriod ?? '', nextReset: q.next_reset ?? q.nextReset ?? '',
        })))
      }
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.billing ?? rB.value.data ?? []
        setBilling(raw.map((b: any) => ({
          attributionId: b.attribution_id ?? b.attributionId ?? '', tenantId: b.tenant_id ?? b.tenantId ?? '',
          tenantName: b.tenant_name ?? b.tenantName ?? '', product: b.product ?? '', sku: b.sku ?? '',
          quantity: Number(b.quantity ?? 0), unitPrice: Number(b.unit_price ?? b.unitPrice ?? 0),
          subtotalUsd: Number(b.subtotal_usd ?? b.subtotalUsd ?? 0),
          discountPct: Number(b.discount_pct ?? b.discountPct ?? 0),
          finalAmountUsd: Number(b.final_amount_usd ?? b.finalAmountUsd ?? 0),
          billingPeriod: b.billing_period ?? b.billingPeriod ?? '',
          invoiceStatus: b.invoice_status ?? b.invoiceStatus ?? 'draft',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', tenantId: a.tenant_id ?? a.tenantId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 10000); return () => clearInterval(id) }, [fetchAll])

  const unhealthyNodes = pipeline.filter(p => p.status !== 'healthy').length
  const overQuota = meters.filter(m => m.quotaUsedPct > 90).length
  const overdueInvoices = billing.filter(b => b.invoiceStatus === 'overdue').length
  const totalBilled = billing.reduce((a, b) => a + b.finalAmountUsd, 0)

  const TABS2 = [
    { id: 'meters' as const, label: 'METERS' },
    { id: 'pipeline' as const, label: 'PIPELINE' },
    { id: 'quotas' as const, label: 'QUOTAS' },
    { id: 'billing' as const, label: 'BILLING' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>USAGE METERING — REAL-TIME TRACKING + QUOTA ENFORCEMENT + BILLING ATTRIBUTION</span>
        {unhealthyNodes > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {unhealthyNodes} NODES DOWN</span>}
        {overQuota > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚠‘ {overQuota} OVER 90%</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Meters" value={meters.length} col={BLUE} />
        <StatCard label="Pipeline Nodes" value={pipeline.length} sub={`${unhealthyNodes} unhealthy`} col={unhealthyNodes > 0 ? RED : GREEN} />
        <StatCard label="Near Quota Limit" value={overQuota} col={overQuota > 0 ? ORANGE : GREEN} />
        <StatCard label="Overdue Invoices" value={overdueInvoices} col={overdueInvoices > 0 ? RED : GREEN} />
        <StatCard label="Total Billed" value={`$${(totalBilled / 1000).toFixed(1)}K`} col={AMBER} />
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

        {tab === 'meters' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Meter ID</Th><Th>Tenant</Th><Th>Metric</Th><Th>Type</Th><Th right>Current</Th><Th>Change</Th><Th>Quota</Th><Th right>Rate/hr</Th><Th right>Billed USD</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {meters.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No meters</td></tr>}
                {meters.sort((a, b) => b.quotaUsedPct - a.quotaUsedPct).map((m, i) => (
                  <tr key={i} style={{ background: m.quotaUsedPct > 95 ? RED + '0a' : m.quotaUsedPct > 80 ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.meterId}</Td>
                    <Td mono col={TEXT}>{m.tenantName || m.tenantId}</Td>
                    <Td mono col={BLUE}>{m.metricName}</Td>
                    <Td mono col={SUBTLE}>{m.metricType.replace(/_/g, ' ')}</Td>
                    <Td right mono col={TEXT}>{m.currentPeriodValue.toLocaleString()} {m.unit}</Td>
                    <Td right><ChgArrow pct={m.changePercent} /></Td>
                    <Td><UsageBar used={m.quotaUsedPct} limit={100} /></Td>
                    <Td right mono col={TEXT}>{m.ratePerHour.toLocaleString()}</Td>
                    <Td right mono col={m.billedAmountUsd > 500 ? ORANGE : TEXT}>${m.billedAmountUsd.toFixed(2)}</Td>
                    <Td mono col={SUBTLE}>{m.lastUpdated}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'pipeline' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Node ID</Th><Th>Name</Th><Th>Type</Th><Th>Status</Th><Th>Region</Th><Th right>EPS</Th><Th right>Latency ms</Th><Th right>Error %</Th><Th right>Backlog</Th><Th>CPU/Mem</Th></tr></thead>
              <tbody>
                {pipeline.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No pipeline nodes</td></tr>}
                {pipeline.sort((a, b) => a.status === 'down' ? -1 : 0).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'down' ? RED + '0a' : p.status === 'degraded' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.nodeId}</Td>
                    <Td mono col={TEXT}>{p.name}</Td>
                    <Td mono col={BLUE}>{p.type}</Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td mono col={SUBTLE}>{p.region || '—'}</Td>
                    <Td right mono col={TEXT}>{p.eventsPerSecond.toLocaleString()}</Td>
                    <Td right mono col={p.latencyMs > 100 ? RED : p.latencyMs > 50 ? AMBER : GREEN}>{p.latencyMs.toFixed(1)}</Td>
                    <Td right mono col={p.errorRatePct > 1 ? RED : GREEN}>{p.errorRatePct.toFixed(2)}%</Td>
                    <Td right mono col={p.backlogCount > 10000 ? RED : TEXT}>{p.backlogCount.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{p.cpuPct.toFixed(0)}%/{p.memoryPct.toFixed(0)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'quotas' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Tenant</Th><Th>Resource</Th><Th>Plan</Th><Th right>Soft Limit</Th><Th right>Hard Limit</Th><Th right>Current</Th><Th>Soft Used</Th><Th>Hard Used</Th><Th>Enforcement</Th><Th>Reset</Th></tr></thead>
              <tbody>
                {quotas.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No quota data</td></tr>}
                {quotas.sort((a, b) => b.hardUsedPct - a.hardUsedPct).map((q, i) => (
                  <tr key={i} style={{ background: q.hardUsedPct > 90 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{q.tenantName || q.tenantId}</Td>
                    <Td mono col={BLUE}>{q.resource.replace(/_/g, ' ')}</Td>
                    <Td mono col={PURPLE}>{q.plan || '—'}</Td>
                    <Td right mono col={TEXT}>{q.softLimit.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{q.hardLimit.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{q.currentUsage.toLocaleString()}</Td>
                    <Td><UsageBar used={q.softUsedPct} limit={100} /></Td>
                    <Td><UsageBar used={q.hardUsedPct} limit={100} /></Td>
                    <Td mono col={q.enforcementMode === 'block' ? RED : q.enforcementMode === 'throttle' ? AMBER : SUBTLE}>{q.enforcementMode.toUpperCase()}</Td>
                    <Td mono col={SUBTLE}>{q.nextReset || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'billing' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Tenant</Th><Th>Product</Th><Th>SKU</Th><Th right>Qty</Th><Th right>Unit $</Th><Th right>Subtotal</Th><Th right>Disc %</Th><Th right>Final USD</Th><Th>Invoice</Th></tr></thead>
              <tbody>
                {billing.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No billing data</td></tr>}
                {billing.sort((a, b) => b.finalAmountUsd - a.finalAmountUsd).map((b, i) => (
                  <tr key={i} style={{ background: b.invoiceStatus === 'overdue' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.attributionId}</Td>
                    <Td mono col={TEXT}>{b.tenantName || b.tenantId}</Td>
                    <Td mono col={BLUE}>{b.product || '—'}</Td>
                    <Td mono col={SUBTLE}>{b.sku || '—'}</Td>
                    <Td right mono col={TEXT}>{b.quantity.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>${b.unitPrice.toFixed(4)}</Td>
                    <Td right mono col={TEXT}>${b.subtotalUsd.toFixed(2)}</Td>
                    <Td right mono col={b.discountPct > 0 ? GREEN : SUBTLE}>{b.discountPct.toFixed(1)}%</Td>
                    <Td right mono col={b.finalAmountUsd > 1000 ? ORANGE : TEXT}>${b.finalAmountUsd.toFixed(2)}</Td>
                    <Td><StatusBadge s={b.invoiceStatus} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Tenant ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.tenantId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
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
