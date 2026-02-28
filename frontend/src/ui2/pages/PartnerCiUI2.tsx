import React, { useState, useEffect, useCallback } from 'react'
﻿// PartnerCiUI2 â€” Bloomberg APEX partner CI terminal
// Partner certification, test suites, compatibility validation, pipeline runs, audit
// Tabs: PARTNERS | PIPELINES | TEST SUITES | COMPATIBILITY | AUDIT
// APIs: /api/v4/partner-ci/partners, /pipelines, /test-suites, /compatibility, /audit

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

interface PartnerRecord {
  partnerId: string
  name: string
  tier: 'platinum' | 'gold' | 'silver' | 'bronze'
  certStatus: 'certified' | 'pending' | 'failed' | 'expired'
  sdkVersion: string
  lastRunAt: string
  passRatePct: number
  openBlockers: number
  totalPipelines: number
  contactEmail: string
}

interface PipelineRun {
  runId: string
  partnerId: string
  partnerName: string
  branch: string
  status: 'passed' | 'failed' | 'running' | 'queued' | 'cancelled'
  totalTests: number
  passed: number
  failed: number
  skipped: number
  durationMin: number
  triggeredAt: string
}

interface TestSuite {
  suiteId: string
  suiteName: string
  category: string
  testCount: number
  passRatePct: number
  avgDurationSec: number
  required: boolean
  lastRunAt: string
}

interface CompatibilityRecord {
  compatId: string
  partnerId: string
  partnerName: string
  integrationPoint: string
  version: string
  compatible: boolean
  issues: number
  severity: 'none' | 'minor' | 'major' | 'critical'
  checkedAt: string
}

interface PartnerCiAuditEntry {
  auditId: string
  partnerId: string
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
function TierBadge({ t }: { t: string }) {
  const m: Record<string, string> = { platinum: '#b0c4de', gold: AMBER, silver: '#aaa', bronze: ORANGE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { certified: GREEN, pending: BLUE, failed: RED, expired: ORANGE, passed: GREEN, running: AMBER, queued: BLUE, cancelled: SUBTLE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { none: GREEN, minor: BLUE, major: AMBER, critical: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function PassBar({ pass, total }: { pass: number; total: number }) {
  const pct = total > 0 ? (pass / total) * 100 : 0
  const col = pct >= 95 ? GREEN : pct >= 80 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 48, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(0)}%</span>
    </div>
  )
}


export function PartnerCiUI2() {
  const [tab, setTab] = useState<'partners' | 'pipelines' | 'suites' | 'compat' | 'audit'>('partners')
  const [partners, setPartners] = useState<PartnerRecord[]>([])
  const [pipelines, setPipelines] = useState<PipelineRun[]>([])
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [compat, setCompat] = useState<CompatibilityRecord[]>([])
  const [auditLog, setAuditLog] = useState<PartnerCiAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rP, rPi, rS, rC, rA] = await Promise.allSettled([
        fetch('/api/v4/partner-ci/partners').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/partner-ci/pipelines').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/partner-ci/test-suites').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/partner-ci/compatibility').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/partner-ci/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.partners ?? rP.value.data ?? []
        setPartners(raw.map((p: any) => ({
          partnerId: p.partner_id ?? p.partnerId ?? '', name: p.name ?? '',
          tier: p.tier ?? 'bronze', certStatus: p.cert_status ?? p.certStatus ?? 'pending',
          sdkVersion: p.sdk_version ?? p.sdkVersion ?? '',
          lastRunAt: p.last_run_at ?? p.lastRunAt ?? '',
          passRatePct: Number(p.pass_rate_pct ?? p.passRatePct ?? 0),
          openBlockers: Number(p.open_blockers ?? p.openBlockers ?? 0),
          totalPipelines: Number(p.total_pipelines ?? p.totalPipelines ?? 0),
          contactEmail: p.contact_email ?? p.contactEmail ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load partners')
      if (rPi.status === 'fulfilled') {
        const raw = Array.isArray(rPi.value) ? rPi.value : rPi.value.pipelines ?? rPi.value.data ?? []
        setPipelines(raw.map((p: any) => ({
          runId: p.run_id ?? p.runId ?? '', partnerId: p.partner_id ?? p.partnerId ?? '',
          partnerName: p.partner_name ?? p.partnerName ?? '', branch: p.branch ?? 'main',
          status: p.status ?? 'queued', totalTests: Number(p.total_tests ?? p.totalTests ?? 0),
          passed: Number(p.passed ?? 0), failed: Number(p.failed ?? 0), skipped: Number(p.skipped ?? 0),
          durationMin: Number(p.duration_min ?? p.durationMin ?? 0),
          triggeredAt: p.triggered_at ?? p.triggeredAt ?? '',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.suites ?? rS.value.data ?? []
        setSuites(raw.map((s: any) => ({
          suiteId: s.suite_id ?? s.suiteId ?? '', suiteName: s.suite_name ?? s.suiteName ?? '',
          category: s.category ?? '', testCount: Number(s.test_count ?? s.testCount ?? 0),
          passRatePct: Number(s.pass_rate_pct ?? s.passRatePct ?? 0),
          avgDurationSec: Number(s.avg_duration_sec ?? s.avgDurationSec ?? 0),
          required: Boolean(s.required), lastRunAt: s.last_run_at ?? s.lastRunAt ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.compatibility ?? rC.value.data ?? []
        setCompat(raw.map((c: any) => ({
          compatId: c.compat_id ?? c.compatId ?? '', partnerId: c.partner_id ?? c.partnerId ?? '',
          partnerName: c.partner_name ?? c.partnerName ?? '',
          integrationPoint: c.integration_point ?? c.integrationPoint ?? '',
          version: c.version ?? '', compatible: Boolean(c.compatible),
          issues: Number(c.issues ?? 0), severity: c.severity ?? 'none',
          checkedAt: c.checked_at ?? c.checkedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', partnerId: a.partner_id ?? a.partnerId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const certifiedPartners = partners.filter(p => p.certStatus === 'certified').length
  const failedPartners = partners.filter(p => p.certStatus === 'failed').length
  const runningPipelines = pipelines.filter(p => p.status === 'running').length
  const criticalCompat = compat.filter(c => c.severity === 'critical').length

  const TABS2 = [
    { id: 'partners' as const, label: 'PARTNERS' },
    { id: 'pipelines' as const, label: 'PIPELINES' },
    { id: 'suites' as const, label: 'TEST SUITES' },
    { id: 'compat' as const, label: 'COMPATIBILITY' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PARTNER CI â€” CERTIFICATION + TEST SUITES + COMPATIBILITY VALIDATION</span>
        {failedPartners > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {failedPartners} FAILED</span>}
        {criticalCompat > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {criticalCompat} COMPAT CRITICAL</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Certified" value={certifiedPartners} col={GREEN} />
        <StatCard label="Failed Cert" value={failedPartners} col={failedPartners > 0 ? RED : GREEN} />
        <StatCard label="Running Pipelines" value={runningPipelines} col={AMBER} />
        <StatCard label="Compat Critical" value={criticalCompat} col={criticalCompat > 0 ? ORANGE : GREEN} />
        <StatCard label="Test Suites" value={suites.length} col={BLUE} />
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

        {tab === 'partners' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Partner</Th><Th>Tier</Th><Th>Cert Status</Th><Th>SDK Version</Th><Th right>Pass Rate</Th><Th right>Blockers</Th><Th right>Pipelines</Th><Th>Last Run</Th></tr></thead>
              <tbody>
                {partners.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No partners â€” check /api/v4/partner-ci/partners</td></tr>}
                {partners.sort((a, b) => {
                  const tp: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 }
                  return (tp[a.tier] ?? 4) - (tp[b.tier] ?? 4)
                }).map((p, i) => (
                  <tr key={i} style={{ background: p.certStatus === 'failed' ? RED + '0a' : p.openBlockers > 0 ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td><TierBadge t={p.tier} /></Td>
                    <Td><StatusBadge s={p.certStatus} /></Td>
                    <Td mono col={PURPLE}>{p.sdkVersion || 'â€”'}</Td>
                    <Td right mono col={p.passRatePct >= 95 ? GREEN : p.passRatePct >= 80 ? AMBER : RED}>{p.passRatePct.toFixed(1)}%</Td>
                    <Td right mono col={p.openBlockers > 0 ? RED : GREEN}>{p.openBlockers}</Td>
                    <Td right mono col={SUBTLE}>{p.totalPipelines}</Td>
                    <Td mono col={SUBTLE}>{p.lastRunAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'pipelines' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Run ID</Th><Th>Partner</Th><Th>Branch</Th><Th>Status</Th><Th right>Total</Th><Th right>Passed</Th><Th right>Failed</Th><Th right>Skipped</Th><Th right>Duration min</Th><Th>Triggered</Th></tr></thead>
              <tbody>
                {pipelines.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No pipeline runs â€” check /api/v4/partner-ci/pipelines</td></tr>}
                {pipelines.sort((a, b) => (a.status === 'running' ? -1 : 1)).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'failed' ? RED + '0a' : p.status === 'running' ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.runId}</Td>
                    <Td mono col={TEXT}>{p.partnerName}</Td>
                    <Td mono col={BLUE}>{p.branch}</Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td right mono col={SUBTLE}>{p.totalTests}</Td>
                    <Td right mono col={GREEN}>{p.passed}</Td>
                    <Td right mono col={p.failed > 0 ? RED : SUBTLE}>{p.failed}</Td>
                    <Td right mono col={SUBTLE}>{p.skipped}</Td>
                    <Td right mono col={p.durationMin > 30 ? ORANGE : SUBTLE}>{p.durationMin.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{p.triggeredAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'suites' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Suite</Th><Th>Category</Th><Th>Required</Th><Th right>Tests</Th><Th right>Pass Rate</Th><Th right>Avg s</Th><Th>Last Run</Th></tr></thead>
              <tbody>
                {suites.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No test suites â€” check /api/v4/partner-ci/test-suites</td></tr>}
                {suites.sort((a, b) => (a.required === b.required ? a.suiteName.localeCompare(b.suiteName) : a.required ? -1 : 1)).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.suiteName}</Td>
                    <Td mono col={BLUE}>{s.category}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: s.required ? RED : SUBTLE }}>{s.required ? 'â˜… REQUIRED' : 'optional'}</span></Td>
                    <Td right mono col={SUBTLE}>{s.testCount}</Td>
                    <Td><PassBar pass={s.passRatePct} total={100} /></Td>
                    <Td right mono col={SUBTLE}>{s.avgDurationSec.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{s.lastRunAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'compat' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Partner</Th><Th>Integration</Th><Th>Version</Th><Th>Compatible</Th><Th>Severity</Th><Th right>Issues</Th><Th>Checked</Th></tr></thead>
              <tbody>
                {compat.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No compat data â€” check /api/v4/partner-ci/compatibility</td></tr>}
                {compat.sort((a, b) => {
                  const sp: Record<string, number> = { critical: 0, major: 1, minor: 2, none: 3 }
                  return (sp[a.severity] ?? 4) - (sp[b.severity] ?? 4)
                }).map((c, i) => (
                  <tr key={i} style={{ background: c.severity === 'critical' ? RED + '0a' : c.severity === 'major' ? ORANGE + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.partnerName}</Td>
                    <Td mono col={BLUE}>{c.integrationPoint}</Td>
                    <Td mono col={PURPLE}>{c.version}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: c.compatible ? GREEN : RED }}>{c.compatible ? 'âœ“ YES' : 'âœ— NO'}</span></Td>
                    <Td><SevBadge s={c.severity} /></Td>
                    <Td right mono col={c.issues > 0 ? ORANGE : GREEN}>{c.issues}</Td>
                    <Td mono col={SUBTLE}>{c.checkedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Partner</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/partner-ci/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.partnerId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge s={a.outcome} /></Td>
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
