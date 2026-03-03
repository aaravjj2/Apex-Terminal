import React, { useState, useEffect, useCallback } from 'react'
﻿// DevPortalUI2 â€” Bloomberg DEVP developer portal terminal
// API catalog, key management, usage analytics, documentation, changelog
// Tabs: APIS | KEYS | USAGE | DOCS | CHANGELOG
// APIs: /api/v4/dev-portal/apis, /keys, /usage, /docs, /changelog

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

interface ApiEndpoint {
  endpointId: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  category: string
  version: string
  status: 'stable' | 'beta' | 'deprecated' | 'experimental'
  latencyP50: number
  latencyP99: number
  rpsAvg: number
  errorRatePct: number
  authRequired: boolean
  rateLimit: number
  desc: string
}

interface ApiKey {
  keyId: string
  name: string
  owner: string
  scopes: string[]
  status: 'active' | 'revoked' | 'expired'
  createdAt: string
  expiresAt: string
  lastUsed: string
  requestsTotal: number
  requestsToday: number
  rateLimit: number
}

interface UsageRecord {
  endpoint: string
  method: string
  requestsToday: number
  requestsWeek: number
  requestsMonth: number
  errorCount: number
  avgLatencyMs: number
  topConsumer: string
  peakRps: number
}

interface DocEntry {
  docId: string
  title: string
  category: string
  version: string
  lastUpdated: string
  tags: string[]
  views: number
  helpful: number
  notHelpful: number
  status: 'current' | 'outdated' | 'draft'
}

interface ChangelogEntry {
  version: string
  releaseDate: string
  changeType: 'breaking' | 'feature' | 'fix' | 'deprecation' | 'security'
  summary: string
  affectedEndpoints: string[]
  migrationRequired: boolean
  author: string
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
function MethodBadge({ m }: { m: string }) {
  const c: Record<string, string> = { GET: GREEN, POST: BLUE, PUT: AMBER, DELETE: RED, PATCH: ORANGE }
  const col = c[m] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px', minWidth: 48, display: 'inline-block', textAlign: 'center' }}>{m}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { stable: GREEN, beta: BLUE, deprecated: RED, experimental: AMBER }
  const col = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function KeyStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, revoked: RED, expired: AMBER }
  const col = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ChangeTypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { breaking: RED, feature: GREEN, fix: BLUE, deprecation: AMBER, security: PURPLE }
  const col = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: col, background: col + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}


export function DevPortalUI2() {
  const [tab, setTab] = useState<'apis' | 'keys' | 'usage' | 'docs' | 'changelog'>('apis')
  const [apis, setApis] = useState<ApiEndpoint[]>([])
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [usage, setUsage] = useState<UsageRecord[]>([])
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rA, rK, rU, rD, rC] = await Promise.allSettled([
        fetch('/api/v4/dev-portal/apis').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/dev-portal/keys').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/dev-portal/usage').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/dev-portal/docs').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/dev-portal/changelog').then(r => r.ok ? r.json() : []),
      ])
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.apis ?? rA.value.data ?? []
        setApis(raw.map((a: any) => ({
          endpointId: a.endpoint_id ?? a.endpointId ?? '', path: a.path ?? '', method: a.method ?? 'GET',
          category: a.category ?? '', version: a.version ?? 'v1', status: a.status ?? 'stable',
          latencyP50: Number(a.latency_p50 ?? a.latencyP50 ?? 0), latencyP99: Number(a.latency_p99 ?? a.latencyP99 ?? 0),
          rpsAvg: Number(a.rps_avg ?? a.rpsAvg ?? 0), errorRatePct: Number(a.error_rate_pct ?? a.errorRatePct ?? 0),
          authRequired: Boolean(a.auth_required ?? a.authRequired ?? true),
          rateLimit: Number(a.rate_limit ?? a.rateLimit ?? 0), desc: a.desc ?? a.description ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load APIs')
      if (rK.status === 'fulfilled') {
        const raw = Array.isArray(rK.value) ? rK.value : rK.value.keys ?? rK.value.data ?? []
        setKeys(raw.map((k: any) => ({
          keyId: k.key_id ?? k.keyId ?? '', name: k.name ?? '', owner: k.owner ?? '',
          scopes: Array.isArray(k.scopes) ? k.scopes : [], status: k.status ?? 'active',
          createdAt: k.created_at ?? k.createdAt ?? '', expiresAt: k.expires_at ?? k.expiresAt ?? '',
          lastUsed: k.last_used ?? k.lastUsed ?? '', requestsTotal: Number(k.requests_total ?? k.requestsTotal ?? 0),
          requestsToday: Number(k.requests_today ?? k.requestsToday ?? 0), rateLimit: Number(k.rate_limit ?? k.rateLimit ?? 0),
        })))
      }
      if (rU.status === 'fulfilled') {
        const raw = Array.isArray(rU.value) ? rU.value : rU.value.usage ?? rU.value.data ?? []
        setUsage(raw.map((u: any) => ({
          endpoint: u.endpoint ?? '', method: u.method ?? 'GET',
          requestsToday: Number(u.requests_today ?? u.requestsToday ?? 0),
          requestsWeek: Number(u.requests_week ?? u.requestsWeek ?? 0),
          requestsMonth: Number(u.requests_month ?? u.requestsMonth ?? 0),
          errorCount: Number(u.error_count ?? u.errorCount ?? 0),
          avgLatencyMs: Number(u.avg_latency_ms ?? u.avgLatencyMs ?? 0),
          topConsumer: u.top_consumer ?? u.topConsumer ?? '', peakRps: Number(u.peak_rps ?? u.peakRps ?? 0),
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.docs ?? rD.value.data ?? []
        setDocs(raw.map((d: any) => ({
          docId: d.doc_id ?? d.docId ?? '', title: d.title ?? '', category: d.category ?? '',
          version: d.version ?? '', lastUpdated: d.last_updated ?? d.lastUpdated ?? '',
          tags: Array.isArray(d.tags) ? d.tags : [], views: Number(d.views ?? 0),
          helpful: Number(d.helpful ?? 0), notHelpful: Number(d.not_helpful ?? d.notHelpful ?? 0),
          status: d.status ?? 'current',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.changelog ?? rC.value.data ?? []
        setChangelog(raw.map((c: any) => ({
          version: c.version ?? '', releaseDate: c.release_date ?? c.releaseDate ?? '',
          changeType: c.change_type ?? c.changeType ?? 'feature', summary: c.summary ?? '',
          affectedEndpoints: Array.isArray(c.affected_endpoints ?? c.affectedEndpoints) ? (c.affected_endpoints ?? c.affectedEndpoints) : [],
          migrationRequired: Boolean(c.migration_required ?? c.migrationRequired ?? false),
          author: c.author ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const totalApis = apis.length
  const stableApis = apis.filter(a => a.status === 'stable').length
  const deprecatedApis = apis.filter(a => a.status === 'deprecated').length
  const highErrorApis = apis.filter(a => a.errorRatePct > 1).length
  const activeKeys = keys.filter(k => k.status === 'active').length
  const breakingChanges = changelog.filter(c => c.changeType === 'breaking').length

  const TABS = [
    { id: 'apis' as const, label: 'APIS' },
    { id: 'keys' as const, label: 'KEYS' },
    { id: 'usage' as const, label: 'USAGE' },
    { id: 'docs' as const, label: 'DOCS' },
    { id: 'changelog' as const, label: 'CHANGELOG' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>DEVP</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>DEVELOPER PORTAL â€” API CATALOG + KEYS + USAGE ANALYTICS + DOCS + CHANGELOG</span>
        {highErrorApis > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {highErrorApis} HIGH ERROR RATE</span>}
        {deprecatedApis > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>⚠‘ {deprecatedApis} DEPRECATED</span>}
        {breakingChanges > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>⚠‘ {breakingChanges} BREAKING CHANGES</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total APIs" value={totalApis} col={BLUE} />
        <StatCard label="Stable" value={stableApis} col={GREEN} />
        <StatCard label="Active Keys" value={activeKeys} col={PURPLE} />
        <StatCard label="High Error Rate" value={highErrorApis} col={highErrorApis > 0 ? RED : GREEN} />
        <StatCard label="Breaking Changes" value={breakingChanges} col={breakingChanges > 0 ? AMBER : GREEN} />
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

        {tab === 'apis' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Method</Th><Th>Path</Th><Th>Category</Th><Th>Status</Th><Th right>P50 (ms)</Th><Th right>P99 (ms)</Th><Th right>Avg RPS</Th><Th right>Error %</Th><Th right>Rate Limit</Th><Th>Auth</Th></tr></thead>
              <tbody>
                {apis.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No APIs â€” check /api/v4/dev-portal/apis</td></tr>}
                {apis.sort((a, b) => b.errorRatePct - a.errorRatePct).map((a, i) => (
                  <tr key={i} style={{ background: a.errorRatePct > 5 ? RED + '0a' : a.status === 'deprecated' ? AMBER + '06' : 'transparent' }}>
                    <Td><MethodBadge m={a.method} /></Td>
                    <Td mono col={AMBER}>{a.path}</Td>
                    <Td mono col={BLUE}>{a.category}</Td>
                    <Td><StatusBadge2 s={a.status} /></Td>
                    <Td right mono col={a.latencyP50 > 200 ? RED : a.latencyP50 > 100 ? AMBER : GREEN}>{a.latencyP50}</Td>
                    <Td right mono col={a.latencyP99 > 500 ? RED : a.latencyP99 > 200 ? AMBER : TEXT}>{a.latencyP99}</Td>
                    <Td right mono col={TEXT}>{a.rpsAvg.toFixed(1)}</Td>
                    <Td right mono col={a.errorRatePct > 5 ? RED : a.errorRatePct > 1 ? AMBER : GREEN}>{a.errorRatePct.toFixed(2)}%</Td>
                    <Td right mono col={SUBTLE}>{a.rateLimit.toLocaleString()}/m</Td>
                    <Td mono col={a.authRequired ? ORANGE : GREEN}>{a.authRequired ? 'REQ' : 'OPEN'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'keys' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Owner</Th><Th>Status</Th><Th>Scopes</Th><Th right>Total Req</Th><Th right>Today</Th><Th right>Rate Limit</Th><Th>Last Used</Th><Th>Expires</Th></tr></thead>
              <tbody>
                {keys.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No keys â€” check /api/v4/dev-portal/keys</td></tr>}
                {keys.sort((a, b) => b.requestsToday - a.requestsToday).map((k, i) => (
                  <tr key={i} style={{ background: k.status === 'revoked' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{k.name}</Td>
                    <Td mono col={BLUE}>{k.owner}</Td>
                    <Td><KeyStatusBadge s={k.status} /></Td>
                    <Td mono col={PURPLE} style={{ fontSize: 10 } as any}>{k.scopes.slice(0, 3).join(', ')}</Td>
                    <Td right mono col={TEXT}>{k.requestsTotal.toLocaleString()}</Td>
                    <Td right mono col={k.requestsToday > k.rateLimit * 0.8 ? AMBER : TEXT}>{k.requestsToday.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{k.rateLimit.toLocaleString()}/m</Td>
                    <Td mono col={SUBTLE}>{k.lastUsed}</Td>
                    <Td mono col={SUBTLE}>{k.expiresAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'usage' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Endpoint</Th><Th>Method</Th><Th right>Today</Th><Th right>Week</Th><Th right>Month</Th><Th right>Errors</Th><Th right>Avg Lat (ms)</Th><Th right>Peak RPS</Th><Th>Top Consumer</Th></tr></thead>
              <tbody>
                {usage.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No usage â€” check /api/v4/dev-portal/usage</td></tr>}
                {usage.sort((a, b) => b.requestsToday - a.requestsToday).map((u, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{u.endpoint}</Td>
                    <Td><MethodBadge m={u.method} /></Td>
                    <Td right mono col={TEXT}>{u.requestsToday.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{u.requestsWeek.toLocaleString()}</Td>
                    <Td right mono col={SUBTLE}>{u.requestsMonth.toLocaleString()}</Td>
                    <Td right mono col={u.errorCount > 0 ? RED : GREEN}>{u.errorCount.toLocaleString()}</Td>
                    <Td right mono col={u.avgLatencyMs > 500 ? RED : u.avgLatencyMs > 200 ? AMBER : GREEN}>{u.avgLatencyMs.toFixed(1)}</Td>
                    <Td right mono col={TEXT}>{u.peakRps.toFixed(1)}</Td>
                    <Td mono col={BLUE}>{u.topConsumer}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'docs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Title</Th><Th>Category</Th><Th>Version</Th><Th>Status</Th><Th right>Views</Th><Th right>Helpful</Th><Th right>Not Helpful</Th><Th>Last Updated</Th></tr></thead>
              <tbody>
                {docs.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No docs â€” check /api/v4/dev-portal/docs</td></tr>}
                {docs.sort((a, b) => b.views - a.views).map((d, i) => {
                  const statusCol = d.status === 'current' ? GREEN : d.status === 'outdated' ? RED : AMBER
                  return (
                    <tr key={i}>
                      <Td mono col={AMBER}>{d.title}</Td>
                      <Td mono col={BLUE}>{d.category}</Td>
                      <Td mono col={SUBTLE}>{d.version}</Td>
                      <Td><span style={{ fontFamily: MONO, fontSize: 9, color: statusCol, background: statusCol + '22', borderRadius: 3, padding: '2px 5px' }}>{d.status.toUpperCase()}</span></Td>
                      <Td right mono col={TEXT}>{d.views.toLocaleString()}</Td>
                      <Td right mono col={GREEN}>{d.helpful.toLocaleString()}</Td>
                      <Td right mono col={d.notHelpful > d.helpful * 0.3 ? RED : SUBTLE}>{d.notHelpful.toLocaleString()}</Td>
                      <Td mono col={SUBTLE}>{d.lastUpdated}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'changelog' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Version</Th><Th>Date</Th><Th>Type</Th><Th>Summary</Th><Th>Affected Endpoints</Th><Th>Migration</Th><Th>Author</Th></tr></thead>
              <tbody>
                {changelog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No changelog â€” check /api/v4/dev-portal/changelog</td></tr>}
                {changelog.map((c, i) => (
                  <tr key={i} style={{ background: c.changeType === 'breaking' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.version}</Td>
                    <Td mono col={SUBTLE}>{c.releaseDate}</Td>
                    <Td><ChangeTypeBadge t={c.changeType} /></Td>
                    <Td mono col={TEXT} style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{c.summary}</Td>
                    <Td mono col={BLUE} style={{ fontSize: 10 } as any}>{c.affectedEndpoints.slice(0, 2).join(', ')}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.migrationRequired ? ORANGE : GREEN }}>{c.migrationRequired ? 'REQUIRED' : 'NONE'}</span></Td>
                    <Td mono col={SUBTLE}>{c.author}</Td>
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
