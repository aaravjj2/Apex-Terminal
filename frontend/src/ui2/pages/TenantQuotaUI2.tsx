import React, { useState, useEffect, useCallback } from 'react'
﻿// TenantQuotaUI2 â€” Bloomberg APEX Tenant Quota management terminal
// Resource allocation, burst management, quota enforcement, capacity analytics
// Tabs: TENANTS | QUOTAS | BURST | USAGE | AUDIT
// APIs: /api/v4/tenant-quota/tenants, /quotas, /burst, /usage, /audit

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

interface Tenant {
  tenantId: string
  name: string
  plan: 'free' | 'starter' | 'pro' | 'enterprise' | 'unlimited'
  status: 'active' | 'suspended' | 'over_quota' | 'trial' | 'churned'
  region: string
  totalUsersAllowed: number
  currentUsers: number
  apiCallsLimit: number
  apiCallsUsed: number
  storageGbLimit: number
  storageGbUsed: number
  computeCreditsLimit: number
  computeCreditsUsed: number
  tier: string
}

interface TenantQuota {
  quotaId: string
  tenantId: string
  tenantName: string
  resource: 'api_calls' | 'storage_gb' | 'compute_credits' | 'users' | 'concurrent_sessions' | 'data_ingestion_gb'
  period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'annual'
  limit: number
  used: number
  usagePct: number
  status: 'ok' | 'warning' | 'critical' | 'exhausted'
  resetAt: string
  overage: number
}

interface BurstEvent {
  burstId: string
  tenantId: string
  tenantName: string
  resource: string
  burstLimit: number
  burstUsed: number
  durationMinutes: number
  approvalStatus: 'auto_approved' | 'pending' | 'approved' | 'denied' | 'expired'
  costUsd: number
  startedAt: string
}

interface QuotaUsageStat {
  statId: string
  tenantId: string
  tenantName: string
  resource: string
  date: string
  peakUsage: number
  avgUsage: number
  burstCount: number
  overageCount: number
  costUsd: number
}

interface QuotaAuditEntry {
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
  const m: Record<string, string> = { active: GREEN, suspended: RED, over_quota: RED, trial: AMBER, churned: SUBTLE, ok: GREEN, warning: AMBER, critical: ORANGE, exhausted: RED, auto_approved: GREEN, approved: GREEN, pending: AMBER, denied: RED, expired: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function PlanBadge({ p }: { p: string }) {
  const m: Record<string, string> = { free: SUBTLE, starter: BLUE, pro: GREEN, enterprise: AMBER, unlimited: PURPLE }
  const c = m[p] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{p.toUpperCase()}</span>
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


export function TenantQuotaUI2() {
  const [tab, setTab] = useState<'tenants' | 'quotas' | 'burst' | 'usage' | 'audit'>('tenants')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [quotas, setQuotas] = useState<TenantQuota[]>([])
  const [burst, setBurst] = useState<BurstEvent[]>([])
  const [usage, setUsage] = useState<QuotaUsageStat[]>([])
  const [auditLog, setAuditLog] = useState<QuotaAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rT, rQ, rB, rU, rA] = await Promise.allSettled([
        fetch('/api/v4/tenant-quota/tenants').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/tenant-quota/quotas').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/tenant-quota/burst').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/tenant-quota/usage').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/tenant-quota/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.tenants ?? rT.value.data ?? []
        setTenants(raw.map((t: any) => ({
          tenantId: t.tenant_id ?? t.tenantId ?? '', name: t.name ?? '',
          plan: t.plan ?? 'free', status: t.status ?? 'active', region: t.region ?? '',
          totalUsersAllowed: Number(t.total_users_allowed ?? t.totalUsersAllowed ?? 0),
          currentUsers: Number(t.current_users ?? t.currentUsers ?? 0),
          apiCallsLimit: Number(t.api_calls_limit ?? t.apiCallsLimit ?? 0),
          apiCallsUsed: Number(t.api_calls_used ?? t.apiCallsUsed ?? 0),
          storageGbLimit: Number(t.storage_gb_limit ?? t.storageGbLimit ?? 0),
          storageGbUsed: Number(t.storage_gb_used ?? t.storageGbUsed ?? 0),
          computeCreditsLimit: Number(t.compute_credits_limit ?? t.computeCreditsLimit ?? 0),
          computeCreditsUsed: Number(t.compute_credits_used ?? t.computeCreditsUsed ?? 0),
          tier: t.tier ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load tenants')
      if (rQ.status === 'fulfilled') {
        const raw = Array.isArray(rQ.value) ? rQ.value : rQ.value.quotas ?? rQ.value.data ?? []
        setQuotas(raw.map((q: any) => ({
          quotaId: q.quota_id ?? q.quotaId ?? '', tenantId: q.tenant_id ?? q.tenantId ?? '',
          tenantName: q.tenant_name ?? q.tenantName ?? '',
          resource: q.resource ?? 'api_calls', period: q.period ?? 'daily',
          limit: Number(q.limit ?? 0), used: Number(q.used ?? 0),
          usagePct: Number(q.usage_pct ?? q.usagePct ?? 0),
          status: q.status ?? 'ok', resetAt: q.reset_at ?? q.resetAt ?? '',
          overage: Number(q.overage ?? 0),
        })))
      }
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.burst ?? rB.value.data ?? []
        setBurst(raw.map((b: any) => ({
          burstId: b.burst_id ?? b.burstId ?? '', tenantId: b.tenant_id ?? b.tenantId ?? '',
          tenantName: b.tenant_name ?? b.tenantName ?? '',
          resource: b.resource ?? '', burstLimit: Number(b.burst_limit ?? b.burstLimit ?? 0),
          burstUsed: Number(b.burst_used ?? b.burstUsed ?? 0),
          durationMinutes: Number(b.duration_minutes ?? b.durationMinutes ?? 0),
          approvalStatus: b.approval_status ?? b.approvalStatus ?? 'pending',
          costUsd: Number(b.cost_usd ?? b.costUsd ?? 0),
          startedAt: b.started_at ?? b.startedAt ?? '',
        })))
      }
      if (rU.status === 'fulfilled') {
        const raw = Array.isArray(rU.value) ? rU.value : rU.value.usage ?? rU.value.data ?? []
        setUsage(raw.map((u: any) => ({
          statId: u.stat_id ?? u.statId ?? '', tenantId: u.tenant_id ?? u.tenantId ?? '',
          tenantName: u.tenant_name ?? u.tenantName ?? '',
          resource: u.resource ?? '', date: u.date ?? '',
          peakUsage: Number(u.peak_usage ?? u.peakUsage ?? 0),
          avgUsage: Number(u.avg_usage ?? u.avgUsage ?? 0),
          burstCount: Number(u.burst_count ?? u.burstCount ?? 0),
          overageCount: Number(u.overage_count ?? u.overageCount ?? 0),
          costUsd: Number(u.cost_usd ?? u.costUsd ?? 0),
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

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const overQuota = tenants.filter(t => t.status === 'over_quota').length
  const exhaustedQuotas = quotas.filter(q => q.status === 'exhausted').length
  const pendingBurst = burst.filter(b => b.approvalStatus === 'pending').length
  const totalOverage = quotas.reduce((a, q) => a + q.overage, 0)

  const TABS2 = [
    { id: 'tenants' as const, label: 'TENANTS' },
    { id: 'quotas' as const, label: 'QUOTAS' },
    { id: 'burst' as const, label: 'BURST' },
    { id: 'usage' as const, label: 'USAGE' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>TENANT QUOTA â€” RESOURCE ALLOCATION + BURST MANAGEMENT + CAPACITY ANALYTICS</span>
        {overQuota > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {overQuota} OVER QUOTA</span>}
        {exhaustedQuotas > 0 && <span style={{ fontSize: 10, color: RED }}>âš‘ {exhaustedQuotas} EXHAUSTED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Tenants" value={tenants.length} col={BLUE} />
        <StatCard label="Over Quota" value={overQuota} col={overQuota > 0 ? RED : GREEN} />
        <StatCard label="Exhausted Quotas" value={exhaustedQuotas} col={exhaustedQuotas > 0 ? RED : GREEN} />
        <StatCard label="Pending Bursts" value={pendingBurst} col={pendingBurst > 0 ? AMBER : SUBTLE} />
        <StatCard label="Total Overage" value={totalOverage.toLocaleString()} col={totalOverage > 0 ? ORANGE : GREEN} />
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

        {tab === 'tenants' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Tenant ID</Th><Th>Name</Th><Th>Plan</Th><Th>Status</Th><Th>Region</Th><Th right>Users</Th><Th>API Calls</Th><Th>Storage</Th><Th>Compute</Th></tr></thead>
              <tbody>
                {tenants.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No tenants â€” check /api/v4/tenant-quota/tenants</td></tr>}
                {tenants.sort((a, b) => (a.status === 'over_quota' ? -1 : 0)).map((t, i) => (
                  <tr key={i} style={{ background: t.status === 'over_quota' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{t.tenantId}</Td>
                    <Td mono col={TEXT}>{t.name}</Td>
                    <Td><PlanBadge p={t.plan} /></Td>
                    <Td><StatusBadge s={t.status} /></Td>
                    <Td mono col={SUBTLE}>{t.region || 'â€”'}</Td>
                    <Td right mono col={t.currentUsers > t.totalUsersAllowed ? RED : TEXT}>{t.currentUsers}/{t.totalUsersAllowed}</Td>
                    <Td><UsageBar used={t.apiCallsUsed} limit={t.apiCallsLimit} /></Td>
                    <Td><UsageBar used={t.storageGbUsed} limit={t.storageGbLimit} /></Td>
                    <Td><UsageBar used={t.computeCreditsUsed} limit={t.computeCreditsLimit} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'quotas' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Tenant</Th><Th>Resource</Th><Th>Period</Th><Th right>Limit</Th><Th right>Used</Th><Th>Usage %</Th><Th>Status</Th><Th right>Overage</Th><Th>Reset At</Th></tr></thead>
              <tbody>
                {quotas.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No quota data â€” check /api/v4/tenant-quota/quotas</td></tr>}
                {quotas.sort((a, b) => b.usagePct - a.usagePct).map((q, i) => (
                  <tr key={i} style={{ background: q.status === 'exhausted' ? RED + '0a' : q.status === 'critical' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{q.tenantName || q.tenantId}</Td>
                    <Td mono col={BLUE}>{q.resource.replace(/_/g, ' ')}</Td>
                    <Td mono col={SUBTLE}>{q.period}</Td>
                    <Td right mono col={TEXT}>{q.limit.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{q.used.toLocaleString()}</Td>
                    <Td><UsageBar used={q.used} limit={q.limit} /></Td>
                    <Td><StatusBadge s={q.status} /></Td>
                    <Td right mono col={q.overage > 0 ? RED : TEXT}>{q.overage.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{q.resetAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'burst' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Burst ID</Th><Th>Tenant</Th><Th>Resource</Th><Th right>Burst Limit</Th><Th right>Used</Th><Th>Approval</Th><Th right>Duration min</Th><Th right>Cost USD</Th><Th>Started At</Th></tr></thead>
              <tbody>
                {burst.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No burst events â€” check /api/v4/tenant-quota/burst</td></tr>}
                {burst.sort((a, b) => a.approvalStatus === 'pending' ? -1 : 0).map((b, i) => (
                  <tr key={i} style={{ background: b.approvalStatus === 'pending' ? AMBER + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.burstId}</Td>
                    <Td mono col={TEXT}>{b.tenantName || b.tenantId}</Td>
                    <Td mono col={BLUE}>{b.resource.replace(/_/g, ' ')}</Td>
                    <Td right mono col={TEXT}>{b.burstLimit.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{b.burstUsed.toLocaleString()}</Td>
                    <Td><StatusBadge s={b.approvalStatus} /></Td>
                    <Td right mono col={SUBTLE}>{b.durationMinutes}</Td>
                    <Td right mono col={b.costUsd > 0 ? ORANGE : TEXT}>${b.costUsd.toFixed(2)}</Td>
                    <Td mono col={SUBTLE}>{b.startedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'usage' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Tenant</Th><Th>Resource</Th><Th>Date</Th><Th right>Peak Usage</Th><Th right>Avg Usage</Th><Th right>Burst Count</Th><Th right>Overage Count</Th><Th right>Cost USD</Th></tr></thead>
              <tbody>
                {usage.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No usage data â€” check /api/v4/tenant-quota/usage</td></tr>}
                {usage.sort((a, b) => b.costUsd - a.costUsd).map((u, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{u.tenantName || u.tenantId}</Td>
                    <Td mono col={BLUE}>{u.resource.replace(/_/g, ' ')}</Td>
                    <Td mono col={SUBTLE}>{u.date}</Td>
                    <Td right mono col={TEXT}>{u.peakUsage.toLocaleString()}</Td>
                    <Td right mono col={TEXT}>{u.avgUsage.toLocaleString()}</Td>
                    <Td right mono col={u.burstCount > 0 ? ORANGE : TEXT}>{u.burstCount}</Td>
                    <Td right mono col={u.overageCount > 0 ? RED : TEXT}>{u.overageCount}</Td>
                    <Td right mono col={u.costUsd > 50 ? ORANGE : TEXT}>${u.costUsd.toFixed(2)}</Td>
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
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries â€” check /api/v4/tenant-quota/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.tenantId}</Td>
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
