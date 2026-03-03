import React, { useState, useEffect, useCallback } from 'react'
﻿// ReleaseQualityUI2 â€” Bloomberg APEX release quality terminal
// Risk scoring, readiness assessment, regression analysis, gate tracking
// Tabs: RELEASES | GATES | RISK | REGRESSIONS | AUDIT
// APIs: /api/v4/release-quality/releases, /gates, /risk, /regressions, /audit

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

interface Release {
  releaseId: string
  version: string
  service: string
  environment: 'dev' | 'staging' | 'canary' | 'production'
  status: 'pending' | 'building' | 'testing' | 'ready' | 'deploying' | 'deployed' | 'rolled_back' | 'blocked'
  qualityScore: number
  riskScore: number
  testCoverage: number
  passedGates: number
  failedGates: number
  totalGates: number
  createdBy: string
  createdAt: string
  deployedAt: string
}

interface QualityGate {
  gateId: string
  name: string
  category: 'test' | 'security' | 'performance' | 'coverage' | 'policy' | 'manual'
  releaseId: string
  required: boolean
  status: 'pass' | 'fail' | 'pending' | 'skipped' | 'waived'
  threshold: number
  actual: number
  evaluatedAt: string
}

interface RiskFactor {
  factorId: string
  releaseId: string
  dimension: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  score: number
  description: string
  recommendation: string
  mitigated: boolean
  mitigationNote: string
}

interface Regression {
  regressionId: string
  releaseId: string
  testName: string
  testSuite: string
  failureType: string
  affectedComponent: string
  introducedIn: string
  confirmedAt: string
  remediated: boolean
  remediatedAt: string
}

interface ReleaseAuditEntry {
  auditId: string
  releaseId: string
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
  const m: Record<string, string> = { pending: SUBTLE, building: BLUE, testing: AMBER, ready: GREEN, deploying: ORANGE, deployed: GREEN, rolled_back: RED, blocked: RED, pass: GREEN, fail: RED, skipped: SUBTLE, waived: PURPLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function RiskBadge({ r }: { r: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: GREEN }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}
function ScoreBar({ val, warning, danger }: { val: number; warning?: number; danger?: number }) {
  const w = warning ?? 70; const d = danger ?? 50
  const col = val >= w ? GREEN : val >= d ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 48, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${val}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{val.toFixed(0)}%</span>
    </div>
  )
}
function EnvBadge({ e }: { e: string }) {
  const m: Record<string, string> = { dev: SUBTLE, staging: BLUE, canary: PURPLE, production: AMBER }
  const c = m[e] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{e.toUpperCase()}</span>
}


export function ReleaseQualityUI2() {
  const [tab, setTab] = useState<'releases' | 'gates' | 'risk' | 'regressions' | 'audit'>('releases')
  const [releases, setReleases] = useState<Release[]>([])
  const [gates, setGates] = useState<QualityGate[]>([])
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([])
  const [regressions, setRegressions] = useState<Regression[]>([])
  const [auditLog, setAuditLog] = useState<ReleaseAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rR, rG, rRi, rReg, rA] = await Promise.allSettled([
        fetch('/api/v4/release-quality/releases').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/release-quality/gates').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/release-quality/risk').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/release-quality/regressions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/release-quality/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.releases ?? rR.value.data ?? []
        setReleases(raw.map((r: any) => ({
          releaseId: r.release_id ?? r.releaseId ?? '', version: r.version ?? '',
          service: r.service ?? '', environment: r.environment ?? 'dev', status: r.status ?? 'pending',
          qualityScore: Number(r.quality_score ?? r.qualityScore ?? 0),
          riskScore: Number(r.risk_score ?? r.riskScore ?? 0),
          testCoverage: Number(r.test_coverage ?? r.testCoverage ?? 0),
          passedGates: Number(r.passed_gates ?? r.passedGates ?? 0),
          failedGates: Number(r.failed_gates ?? r.failedGates ?? 0),
          totalGates: Number(r.total_gates ?? r.totalGates ?? 0),
          createdBy: r.created_by ?? r.createdBy ?? '', createdAt: r.created_at ?? r.createdAt ?? '',
          deployedAt: r.deployed_at ?? r.deployedAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load releases')
      if (rG.status === 'fulfilled') {
        const raw = Array.isArray(rG.value) ? rG.value : rG.value.gates ?? rG.value.data ?? []
        setGates(raw.map((g: any) => ({
          gateId: g.gate_id ?? g.gateId ?? '', name: g.name ?? '',
          category: g.category ?? 'test', releaseId: g.release_id ?? g.releaseId ?? '',
          required: Boolean(g.required), status: g.status ?? 'pending',
          threshold: Number(g.threshold ?? 0), actual: Number(g.actual ?? 0),
          evaluatedAt: g.evaluated_at ?? g.evaluatedAt ?? '',
        })))
      }
      if (rRi.status === 'fulfilled') {
        const raw = Array.isArray(rRi.value) ? rRi.value : rRi.value.risk ?? rRi.value.data ?? []
        setRiskFactors(raw.map((r: any) => ({
          factorId: r.factor_id ?? r.factorId ?? '', releaseId: r.release_id ?? r.releaseId ?? '',
          dimension: r.dimension ?? '', riskLevel: r.risk_level ?? r.riskLevel ?? 'low',
          score: Number(r.score ?? 0), description: r.description ?? '',
          recommendation: r.recommendation ?? '', mitigated: Boolean(r.mitigated),
          mitigationNote: r.mitigation_note ?? r.mitigationNote ?? '',
        })))
      }
      if (rReg.status === 'fulfilled') {
        const raw = Array.isArray(rReg.value) ? rReg.value : rReg.value.regressions ?? rReg.value.data ?? []
        setRegressions(raw.map((r: any) => ({
          regressionId: r.regression_id ?? r.regressionId ?? '', releaseId: r.release_id ?? r.releaseId ?? '',
          testName: r.test_name ?? r.testName ?? '', testSuite: r.test_suite ?? r.testSuite ?? '',
          failureType: r.failure_type ?? r.failureType ?? '',
          affectedComponent: r.affected_component ?? r.affectedComponent ?? '',
          introducedIn: r.introduced_in ?? r.introducedIn ?? '',
          confirmedAt: r.confirmed_at ?? r.confirmedAt ?? '',
          remediated: Boolean(r.remediated), remediatedAt: r.remediated_at ?? r.remediatedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', releaseId: a.release_id ?? a.releaseId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const blockedReleases = releases.filter(r => r.status === 'blocked').length
  const failedGates = gates.filter(g => g.status === 'fail').length
  const criticalRisks = riskFactors.filter(r => r.riskLevel === 'critical').length
  const openRegressions = regressions.filter(r => !r.remediated).length

  const TABS2 = [
    { id: 'releases' as const, label: 'RELEASES' },
    { id: 'gates' as const, label: 'GATES' },
    { id: 'risk' as const, label: 'RISK' },
    { id: 'regressions' as const, label: 'REGRESSIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>RELEASE QUALITY â€” RISK SCORING + READINESS GATES + REGRESSION ANALYSIS</span>
        {blockedReleases > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {blockedReleases} BLOCKED</span>}
        {criticalRisks > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚠‘ {criticalRisks} CRITICAL RISKS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Releases" value={releases.length} col={BLUE} />
        <StatCard label="Blocked" value={blockedReleases} col={blockedReleases > 0 ? RED : GREEN} />
        <StatCard label="Failed Gates" value={failedGates} col={failedGates > 0 ? ORANGE : GREEN} />
        <StatCard label="Critical Risks" value={criticalRisks} col={criticalRisks > 0 ? RED : GREEN} />
        <StatCard label="Open Regressions" value={openRegressions} col={openRegressions > 0 ? ORANGE : GREEN} />
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

        {tab === 'releases' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Version</Th><Th>Service</Th><Th>Env</Th><Th>Status</Th><Th>Quality</Th><Th right>Risk Score</Th><Th>Coverage</Th><Th right>Gates P/F/T</Th><Th>Author</Th><Th>Created</Th></tr></thead>
              <tbody>
                {releases.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No releases â€” check /api/v4/release-quality/releases</td></tr>}
                {releases.sort((a, b) => b.riskScore - a.riskScore).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'blocked' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.version}</Td>
                    <Td mono col={BLUE}>{r.service}</Td>
                    <Td><EnvBadge e={r.environment} /></Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td><ScoreBar val={r.qualityScore} /></Td>
                    <Td right mono col={r.riskScore > 70 ? RED : r.riskScore > 40 ? ORANGE : GREEN}>{r.riskScore.toFixed(0)}</Td>
                    <Td><ScoreBar val={r.testCoverage} /></Td>
                    <Td right mono><span style={{ color: GREEN }}>{r.passedGates}</span><span style={{ color: SUBTLE }}>/</span><span style={{ color: RED }}>{r.failedGates}</span><span style={{ color: SUBTLE }}>/{r.totalGates}</span></Td>
                    <Td mono col={SUBTLE}>{r.createdBy}</Td>
                    <Td mono col={SUBTLE}>{r.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gates' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Gate</Th><Th>Category</Th><Th>Release ID</Th><Th>Required</Th><Th>Status</Th><Th right>Threshold</Th><Th right>Actual</Th><Th>Evaluated At</Th></tr></thead>
              <tbody>
                {gates.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No gates â€” check /api/v4/release-quality/gates</td></tr>}
                {gates.sort((a, b) => (a.status === 'fail' ? -1 : 1) - (b.status === 'fail' ? -1 : 1)).map((g, i) => (
                  <tr key={i} style={{ background: g.status === 'fail' && g.required ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{g.name}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{g.category.toUpperCase()}</span></Td>
                    <Td mono col={BLUE}>{g.releaseId}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: g.required ? AMBER : SUBTLE }}>{g.required ? 'REQUIRED' : 'OPTIONAL'}</span></Td>
                    <Td><StatusBadge s={g.status} /></Td>
                    <Td right mono col={SUBTLE}>{g.threshold.toFixed(1)}</Td>
                    <Td right mono col={g.actual >= g.threshold ? GREEN : RED}>{g.actual.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{g.evaluatedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'risk' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Factor</Th><Th>Release ID</Th><Th>Dimension</Th><Th>Risk</Th><Th right>Score</Th><Th>Description</Th><Th>Mitigated</Th><Th>Recommendation</Th></tr></thead>
              <tbody>
                {riskFactors.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No risk factors â€” check /api/v4/release-quality/risk</td></tr>}
                {riskFactors.sort((a, b) => b.score - a.score).map((r, i) => (
                  <tr key={i} style={{ background: r.riskLevel === 'critical' ? RED + '0a' : 'transparent', opacity: r.mitigated ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{r.factorId}</Td>
                    <Td mono col={BLUE}>{r.releaseId}</Td>
                    <Td mono col={PURPLE}>{r.dimension}</Td>
                    <Td><RiskBadge r={r.riskLevel} /></Td>
                    <Td right mono col={r.score > 70 ? RED : r.score > 40 ? ORANGE : GREEN}>{r.score.toFixed(0)}</Td>
                    <Td mono col={TEXT}>{r.description || 'â€”'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.mitigated ? GREEN : RED }}>{r.mitigated ? 'âœ“ YES' : 'âœ— NO'}</span></Td>
                    <Td mono col={SUBTLE}>{r.recommendation || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'regressions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Regression ID</Th><Th>Test Name</Th><Th>Suite</Th><Th>Component</Th><Th>Failure Type</Th><Th>Introduced In</Th><Th>Remediated</Th><Th>Confirmed At</Th></tr></thead>
              <tbody>
                {regressions.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regressions â€” check /api/v4/release-quality/regressions</td></tr>}
                {regressions.sort((a, b) => (a.remediated ? 1 : -1) - (b.remediated ? 1 : -1)).map((r, i) => (
                  <tr key={i} style={{ background: !r.remediated ? RED + '0a' : 'transparent', opacity: r.remediated ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{r.regressionId}</Td>
                    <Td mono col={TEXT}>{r.testName}</Td>
                    <Td mono col={BLUE}>{r.testSuite}</Td>
                    <Td mono col={PURPLE}>{r.affectedComponent || 'â€”'}</Td>
                    <Td mono col={ORANGE}>{r.failureType || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.introducedIn || 'â€”'}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.remediated ? GREEN : RED }}>{r.remediated ? 'âœ“ YES' : 'âœ— NO'}</span></Td>
                    <Td mono col={SUBTLE}>{r.confirmedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Release ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/release-quality/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.releaseId}</Td>
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
