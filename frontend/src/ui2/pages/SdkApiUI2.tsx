import React, { useState, useEffect, useCallback } from 'react'
﻿// SdkApiUI2 — Bloomberg APEX SDK API management terminal
// Public SDK standard with versioning, compatibility matrix, usage analytics, docs
// Tabs: SDKs | VERSIONS | USAGE | COMPATIBILITY | AUDIT
// APIs: /api/v4/sdk/sdks, /versions, /usage, /compatibility, /audit

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

interface SdkPackage {
  sdkId: string
  name: string
  language: 'python' | 'javascript' | 'typescript' | 'java' | 'go' | 'rust' | 'csharp' | 'ruby'
  currentVersion: string
  latestVersion: string
  status: 'stable' | 'beta' | 'alpha' | 'deprecated' | 'eol'
  downloadCount: number
  weeklyDownloads: number
  openIssues: number
  licenseType: string
  repoUrl: string
  publishedAt: string
}

interface SdkVersion {
  versionId: string
  sdkId: string
  version: string
  releaseType: 'major' | 'minor' | 'patch' | 'hotfix' | 'pre-release'
  status: 'latest' | 'supported' | 'deprecated' | 'eol'
  releasedAt: string
  apiVersion: string
  breakingChanges: boolean
  changelogUrl: string
  downloadsTotal: number
  activeUsers: number
}

interface SdkUsageMetric {
  usageId: string
  sdkId: string
  sdkVersion: string
  apiEndpoint: string
  callCount: number
  errorCount: number
  errorRatePct: number
  avgLatencyMs: number
  p99LatencyMs: number
  uniqueConsumers: number
  period: string
}

interface CompatibilityEntry {
  matrixId: string
  sdkId: string
  sdkVersion: string
  apiVersion: string
  compatible: boolean
  testedAt: string
  platform: string
  issues: string
  migrationGuide: string
}

interface SdkAuditEntry {
  auditId: string
  sdkId: string
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
  const m: Record<string, string> = { stable: GREEN, beta: AMBER, alpha: ORANGE, deprecated: RED, eol: SUBTLE, latest: GREEN, supported: BLUE, 'pre-release': PURPLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function LangBadge({ l }: { l: string }) {
  const m: Record<string, string> = { python: AMBER, javascript: AMBER, typescript: BLUE, java: ORANGE, go: GREEN, rust: ORANGE, csharp: PURPLE, ruby: RED }
  const c = m[l] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{l.toUpperCase()}</span>
}
function RelTypeBadge({ r }: { r: string }) {
  const m: Record<string, string> = { major: RED, minor: AMBER, patch: GREEN, hotfix: ORANGE, 'pre-release': PURPLE }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}
function ErrorRateBar({ v }: { v: number }) {
  const col = v > 5 ? RED : v > 2 ? ORANGE : v > 0.5 ? AMBER : GREEN
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, v * 10)}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{v.toFixed(2)}%</span>
    </div>
  )
}


export function SdkApiUI2() {
  const [tab, setTab] = useState<'sdks' | 'versions' | 'usage' | 'compatibility' | 'audit'>('sdks')
  const [sdks, setSdks] = useState<SdkPackage[]>([])
  const [versions, setVersions] = useState<SdkVersion[]>([])
  const [usage, setUsage] = useState<SdkUsageMetric[]>([])
  const [compatibility, setCompatibility] = useState<CompatibilityEntry[]>([])
  const [auditLog, setAuditLog] = useState<SdkAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rV, rU, rC, rA] = await Promise.allSettled([
        fetch('/api/v4/sdk/sdks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sdk/versions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sdk/usage').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sdk/compatibility').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/sdk/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.sdks ?? rS.value.data ?? []
        setSdks(raw.map((s: any) => ({
          sdkId: s.sdk_id ?? s.sdkId ?? '', name: s.name ?? '',
          language: s.language ?? 'python', currentVersion: s.current_version ?? s.currentVersion ?? '',
          latestVersion: s.latest_version ?? s.latestVersion ?? '',
          status: s.status ?? 'stable',
          downloadCount: Number(s.download_count ?? s.downloadCount ?? 0),
          weeklyDownloads: Number(s.weekly_downloads ?? s.weeklyDownloads ?? 0),
          openIssues: Number(s.open_issues ?? s.openIssues ?? 0),
          licenseType: s.license_type ?? s.licenseType ?? '',
          repoUrl: s.repo_url ?? s.repoUrl ?? '', publishedAt: s.published_at ?? s.publishedAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load SDKs')
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.versions ?? rV.value.data ?? []
        setVersions(raw.map((v: any) => ({
          versionId: v.version_id ?? v.versionId ?? '', sdkId: v.sdk_id ?? v.sdkId ?? '',
          version: v.version ?? '', releaseType: v.release_type ?? v.releaseType ?? 'patch',
          status: v.status ?? 'supported', releasedAt: v.released_at ?? v.releasedAt ?? '',
          apiVersion: v.api_version ?? v.apiVersion ?? '',
          breakingChanges: Boolean(v.breaking_changes ?? v.breakingChanges),
          changelogUrl: v.changelog_url ?? v.changelogUrl ?? '',
          downloadsTotal: Number(v.downloads_total ?? v.downloadsTotal ?? 0),
          activeUsers: Number(v.active_users ?? v.activeUsers ?? 0),
        })))
      }
      if (rU.status === 'fulfilled') {
        const raw = Array.isArray(rU.value) ? rU.value : rU.value.usage ?? rU.value.data ?? []
        setUsage(raw.map((u: any) => ({
          usageId: u.usage_id ?? u.usageId ?? '', sdkId: u.sdk_id ?? u.sdkId ?? '',
          sdkVersion: u.sdk_version ?? u.sdkVersion ?? '', apiEndpoint: u.api_endpoint ?? u.apiEndpoint ?? '',
          callCount: Number(u.call_count ?? u.callCount ?? 0),
          errorCount: Number(u.error_count ?? u.errorCount ?? 0),
          errorRatePct: Number(u.error_rate_pct ?? u.errorRatePct ?? 0),
          avgLatencyMs: Number(u.avg_latency_ms ?? u.avgLatencyMs ?? 0),
          p99LatencyMs: Number(u.p99_latency_ms ?? u.p99LatencyMs ?? 0),
          uniqueConsumers: Number(u.unique_consumers ?? u.uniqueConsumers ?? 0),
          period: u.period ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.compatibility ?? rC.value.data ?? []
        setCompatibility(raw.map((c: any) => ({
          matrixId: c.matrix_id ?? c.matrixId ?? '', sdkId: c.sdk_id ?? c.sdkId ?? '',
          sdkVersion: c.sdk_version ?? c.sdkVersion ?? '', apiVersion: c.api_version ?? c.apiVersion ?? '',
          compatible: Boolean(c.compatible), testedAt: c.tested_at ?? c.testedAt ?? '',
          platform: c.platform ?? '', issues: c.issues ?? '',
          migrationGuide: c.migration_guide ?? c.migrationGuide ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', sdkId: a.sdk_id ?? a.sdkId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const totalDownloads = sdks.reduce((a, s) => a + s.weeklyDownloads, 0)
  const deprecatedSdks = sdks.filter(s => s.status === 'deprecated' || s.status === 'eol').length
  const highErrorEndpoints = usage.filter(u => u.errorRatePct > 5).length
  const breakingVersions = versions.filter(v => v.breakingChanges).length

  const TABS2 = [
    { id: 'sdks' as const, label: 'SDKs' },
    { id: 'versions' as const, label: 'VERSIONS' },
    { id: 'usage' as const, label: 'USAGE' },
    { id: 'compatibility' as const, label: 'COMPATIBILITY' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SDK API STANDARD — VERSIONING + COMPATIBILITY + DOCUMENTATION + USAGE</span>
        {deprecatedSdks > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚑ {deprecatedSdks} DEPRECATED</span>}
        {highErrorEndpoints > 0 && <span style={{ fontSize: 10, color: RED }}>⚑ {highErrorEndpoints} HIGH ERR</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active SDKs" value={sdks.filter(s => s.status === 'stable').length} col={BLUE} />
        <StatCard label="Weekly Downloads" value={totalDownloads.toLocaleString()} col={GREEN} />
        <StatCard label="Deprecated" value={deprecatedSdks} col={deprecatedSdks > 0 ? ORANGE : GREEN} />
        <StatCard label="High Error Endpoints" value={highErrorEndpoints} col={highErrorEndpoints > 0 ? RED : GREEN} />
        <StatCard label="Breaking Versions" value={breakingVersions} col={breakingVersions > 0 ? AMBER : GREEN} />
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

        {tab === 'sdks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>SDK Name</Th><Th>Language</Th><Th>Status</Th><Th>Current</Th><Th>Latest</Th><Th right>Downloads Total</Th><Th right>Weekly DLs</Th><Th right>Open Issues</Th><Th>License</Th><Th>Published</Th></tr></thead>
              <tbody>
                {sdks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No SDKs — check /api/v4/sdk/sdks</td></tr>}
                {sdks.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads).map((s, i) => (
                  <tr key={i} style={{ opacity: s.status === 'eol' ? 0.5 : 1, background: s.status === 'deprecated' ? ORANGE + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.name}</Td>
                    <Td><LangBadge l={s.language} /></Td>
                    <Td><StatusBadge s={s.status} /></Td>
                    <Td mono col={s.currentVersion !== s.latestVersion ? ORANGE : GREEN}>{s.currentVersion}</Td>
                    <Td mono col={GREEN}>{s.latestVersion}</Td>
                    <Td right mono col={TEXT}>{s.downloadCount.toLocaleString()}</Td>
                    <Td right mono col={s.weeklyDownloads > 1000 ? GREEN : TEXT}>{s.weeklyDownloads.toLocaleString()}</Td>
                    <Td right mono col={s.openIssues > 10 ? RED : s.openIssues > 5 ? AMBER : TEXT}>{s.openIssues}</Td>
                    <Td mono col={SUBTLE}>{s.licenseType || '—'}</Td>
                    <Td mono col={SUBTLE}>{s.publishedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'versions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>SDK ID</Th><Th>Version</Th><Th>Release Type</Th><Th>Status</Th><Th>API Version</Th><Th>Breaking</Th><Th right>Downloads</Th><Th right>Active Users</Th><Th>Released</Th></tr></thead>
              <tbody>
                {versions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No versions — check /api/v4/sdk/versions</td></tr>}
                {versions.sort((a, b) => b.activeUsers - a.activeUsers).map((v, i) => (
                  <tr key={i} style={{ background: v.breakingChanges ? RED + '0a' : 'transparent' }}>
                    <Td mono col={BLUE}>{v.sdkId}</Td>
                    <Td mono col={AMBER}>{v.version}</Td>
                    <Td><RelTypeBadge r={v.releaseType} /></Td>
                    <Td><StatusBadge s={v.status} /></Td>
                    <Td mono col={PURPLE}>{v.apiVersion}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: v.breakingChanges ? RED : GREEN }}>{v.breakingChanges ? '⚠ YES' : '—'}</span></Td>
                    <Td right mono col={TEXT}>{v.downloadsTotal.toLocaleString()}</Td>
                    <Td right mono col={v.activeUsers > 100 ? GREEN : TEXT}>{v.activeUsers.toLocaleString()}</Td>
                    <Td mono col={SUBTLE}>{v.releasedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'usage' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>SDK</Th><Th>Version</Th><Th>Endpoint</Th><Th>Period</Th><Th right>Calls</Th><Th right>Errors</Th><Th>Error Rate</Th><Th right>Avg ms</Th><Th right>P99 ms</Th><Th right>Consumers</Th></tr></thead>
              <tbody>
                {usage.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No usage data — check /api/v4/sdk/usage</td></tr>}
                {usage.sort((a, b) => b.callCount - a.callCount).map((u, i) => (
                  <tr key={i} style={{ background: u.errorRatePct > 5 ? RED + '08' : 'transparent' }}>
                    <Td mono col={BLUE}>{u.sdkId}</Td>
                    <Td mono col={AMBER}>{u.sdkVersion}</Td>
                    <Td mono col={TEXT}>{u.apiEndpoint}</Td>
                    <Td mono col={SUBTLE}>{u.period}</Td>
                    <Td right mono col={TEXT}>{u.callCount.toLocaleString()}</Td>
                    <Td right mono col={u.errorCount > 0 ? RED : GREEN}>{u.errorCount.toLocaleString()}</Td>
                    <Td><ErrorRateBar v={u.errorRatePct} /></Td>
                    <Td right mono col={u.avgLatencyMs > 500 ? RED : u.avgLatencyMs > 200 ? AMBER : GREEN}>{u.avgLatencyMs.toFixed(0)}</Td>
                    <Td right mono col={u.p99LatencyMs > 1000 ? RED : SUBTLE}>{u.p99LatencyMs.toFixed(0)}</Td>
                    <Td right mono col={TEXT}>{u.uniqueConsumers}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'compatibility' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>SDK</Th><Th>SDK Version</Th><Th>API Version</Th><Th>Platform</Th><Th>Compatible</Th><Th>Issues</Th><Th>Migration Guide</Th><Th>Tested At</Th></tr></thead>
              <tbody>
                {compatibility.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No compatibility data — check /api/v4/sdk/compatibility</td></tr>}
                {compatibility.sort((a, b) => (a.compatible ? 1 : -1) - (b.compatible ? 1 : -1)).map((c, i) => (
                  <tr key={i} style={{ background: !c.compatible ? RED + '0a' : 'transparent' }}>
                    <Td mono col={BLUE}>{c.sdkId}</Td>
                    <Td mono col={AMBER}>{c.sdkVersion}</Td>
                    <Td mono col={PURPLE}>{c.apiVersion}</Td>
                    <Td mono col={TEXT}>{c.platform || '—'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.compatible ? GREEN : RED }}>{c.compatible ? '✓ COMPAT' : '✗ INCOMPAT'}</span></Td>
                    <Td mono col={ORANGE}>{c.issues || '—'}</Td>
                    <Td mono col={BLUE}>{c.migrationGuide ? 'AVAILABLE' : '—'}</Td>
                    <Td mono col={SUBTLE}>{c.testedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>SDK ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log — check /api/v4/sdk/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.sdkId || '—'}</Td>
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
