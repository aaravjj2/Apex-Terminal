import React, { useState, useEffect, useCallback } from 'react'
﻿// PolicyCodeUI2 â€” Bloomberg APEX policy-as-code terminal
// Rule authoring, testing pipelines, policy deployments, violations, audit
// Tabs: RULES | PIPELINES | DEPLOYMENTS | VIOLATIONS | AUDIT
// APIs: /api/v4/policy-code/rules, /pipelines, /deployments, /violations, /audit

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

interface PolicyRule {
  ruleId: string
  name: string
  engine: 'rego' | 'cel' | 'json-logic' | 'lua' | 'wasm'
  category: string
  status: 'active' | 'draft' | 'deprecated' | 'testing'
  version: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  evaluationsToday: number
  failuresLast24h: number
  avgLatencyMs: number
  lastModified: string
  author: string
}

interface PolicyPipeline {
  pipelineId: string
  ruleId: string
  ruleName: string
  stage: 'lint' | 'test' | 'validate' | 'deploy'
  status: 'passed' | 'failed' | 'running' | 'queued'
  testsPassed: number
  testsFailed: number
  coveragePct: number
  durationSec: number
  triggeredAt: string
}

interface PolicyDeployment {
  deploymentId: string
  ruleId: string
  ruleName: string
  environment: 'dev' | 'staging' | 'production'
  version: string
  deployedAt: string
  deployedBy: string
  status: 'active' | 'rolled_back' | 'failed'
  rolloutPct: number
  impactedPolicies: number
}

interface PolicyViolation {
  violationId: string
  ruleId: string
  ruleName: string
  context: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  action: 'block' | 'warn' | 'log' | 'remediate'
  status: 'open' | 'resolved' | 'suppressed'
  entityId: string
  detail: string
  timestamp: string
}

interface PolicyCodeAuditEntry {
  auditId: string
  ruleId: string
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
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE, info: GREEN }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, draft: BLUE, deprecated: RED, testing: AMBER, passed: GREEN, failed: RED, running: AMBER, queued: BLUE, active2: GREEN, rolled_back: ORANGE, open: RED, resolved: GREEN, suppressed: SUBTLE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function EngineBadge({ e }: { e: string }) {
  const m: Record<string, string> = { rego: PURPLE, cel: BLUE, 'json-logic': ORANGE, lua: GREEN, wasm: RED }
  const c = m[e] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{e.toUpperCase()}</span>
}
function EnvBadge({ e }: { e: string }) {
  const m: Record<string, string> = { production: RED, staging: AMBER, dev: BLUE }
  const c = m[e] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{e.toUpperCase()}</span>
}


export function PolicyCodeUI2() {
  const [tab, setTab] = useState<'rules' | 'pipelines' | 'deployments' | 'violations' | 'audit'>('rules')
  const [rules, setRules] = useState<PolicyRule[]>([])
  const [pipelines, setPipelines] = useState<PolicyPipeline[]>([])
  const [deployments, setDeployments] = useState<PolicyDeployment[]>([])
  const [violations, setViolations] = useState<PolicyViolation[]>([])
  const [auditLog, setAuditLog] = useState<PolicyCodeAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rR, rP, rD, rV, rA] = await Promise.allSettled([
        fetch('/api/v4/policy-code/rules').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-code/pipelines').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-code/deployments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-code/violations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/policy-code/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.rules ?? rR.value.data ?? []
        setRules(raw.map((r: any) => ({
          ruleId: r.rule_id ?? r.ruleId ?? '', name: r.name ?? '',
          engine: r.engine ?? 'rego', category: r.category ?? '',
          status: r.status ?? 'active', version: r.version ?? '1.0',
          severity: r.severity ?? 'info',
          evaluationsToday: Number(r.evaluations_today ?? r.evaluationsToday ?? 0),
          failuresLast24h: Number(r.failures_last_24h ?? r.failuresLast24h ?? 0),
          avgLatencyMs: Number(r.avg_latency_ms ?? r.avgLatencyMs ?? 0),
          lastModified: r.last_modified ?? r.lastModified ?? '', author: r.author ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load rules')
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.pipelines ?? rP.value.data ?? []
        setPipelines(raw.map((p: any) => ({
          pipelineId: p.pipeline_id ?? p.pipelineId ?? '', ruleId: p.rule_id ?? p.ruleId ?? '',
          ruleName: p.rule_name ?? p.ruleName ?? '',
          stage: p.stage ?? 'test', status: p.status ?? 'queued',
          testsPassed: Number(p.tests_passed ?? p.testsPassed ?? 0),
          testsFailed: Number(p.tests_failed ?? p.testsFailed ?? 0),
          coveragePct: Number(p.coverage_pct ?? p.coveragePct ?? 0),
          durationSec: Number(p.duration_sec ?? p.durationSec ?? 0),
          triggeredAt: p.triggered_at ?? p.triggeredAt ?? '',
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.deployments ?? rD.value.data ?? []
        setDeployments(raw.map((d: any) => ({
          deploymentId: d.deployment_id ?? d.deploymentId ?? '', ruleId: d.rule_id ?? d.ruleId ?? '',
          ruleName: d.rule_name ?? d.ruleName ?? '',
          environment: d.environment ?? 'dev', version: d.version ?? '',
          deployedAt: d.deployed_at ?? d.deployedAt ?? '', deployedBy: d.deployed_by ?? d.deployedBy ?? '',
          status: d.status ?? 'active', rolloutPct: Number(d.rollout_pct ?? d.rolloutPct ?? 0),
          impactedPolicies: Number(d.impacted_policies ?? d.impactedPolicies ?? 0),
        })))
      }
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.violations ?? rV.value.data ?? []
        setViolations(raw.map((v: any) => ({
          violationId: v.violation_id ?? v.violationId ?? '', ruleId: v.rule_id ?? v.ruleId ?? '',
          ruleName: v.rule_name ?? v.ruleName ?? '', context: v.context ?? '',
          severity: v.severity ?? 'low', action: v.action ?? 'log',
          status: v.status ?? 'open', entityId: v.entity_id ?? v.entityId ?? '',
          detail: v.detail ?? '', timestamp: v.timestamp ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', ruleId: a.rule_id ?? a.ruleId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const activeRules = rules.filter(r => r.status === 'active').length
  const openViolations = violations.filter(v => v.status === 'open').length
  const criticalViolations = violations.filter(v => v.severity === 'critical' && v.status === 'open').length
  const failedPipelines = pipelines.filter(p => p.status === 'failed').length

  const TABS2 = [
    { id: 'rules' as const, label: 'RULES' },
    { id: 'pipelines' as const, label: 'PIPELINES' },
    { id: 'deployments' as const, label: 'DEPLOYMENTS' },
    { id: 'violations' as const, label: 'VIOLATIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>POLICY CODE â€” RULE ENGINE + TEST PIPELINES + DEPLOYMENT + ENFORCEMENT</span>
        {criticalViolations > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalViolations} CRITICAL VIOLATIONS</span>}
        {failedPipelines > 0 && <span style={{ fontSize: 10, color: ORANGE }}>âš‘ {failedPipelines} PIPELINE FAILURES</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Active Rules" value={activeRules} col={GREEN} />
        <StatCard label="Open Violations" value={openViolations} col={openViolations > 0 ? ORANGE : GREEN} />
        <StatCard label="Critical Violations" value={criticalViolations} col={criticalViolations > 0 ? RED : GREEN} />
        <StatCard label="Failed Pipelines" value={failedPipelines} col={failedPipelines > 0 ? RED : GREEN} />
        <StatCard label="Deployments" value={deployments.filter(d => d.status === 'active').length} col={BLUE} />
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

        {tab === 'rules' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule</Th><Th>Engine</Th><Th>Category</Th><Th>Status</Th><Th>Severity</Th><Th>Ver</Th><Th right>Evals/day</Th><Th right>Failures 24h</Th><Th right>Latency ms</Th><Th>Author</Th></tr></thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No rules â€” check /api/v4/policy-code/rules</td></tr>}
                {rules.sort((a, b) => {
                  const sp: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
                  return (sp[a.severity] ?? 5) - (sp[b.severity] ?? 5)
                }).map((r, i) => (
                  <tr key={i} style={{ opacity: r.status === 'deprecated' ? 0.5 : 1 }}>
                    <Td mono col={AMBER}>{r.name}</Td>
                    <Td><EngineBadge e={r.engine} /></Td>
                    <Td mono col={BLUE}>{r.category}</Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td><SevBadge s={r.severity} /></Td>
                    <Td mono col={SUBTLE}>{r.version}</Td>
                    <Td right mono col={TEXT}>{r.evaluationsToday.toLocaleString()}</Td>
                    <Td right mono col={r.failuresLast24h > 0 ? ORANGE : GREEN}>{r.failuresLast24h}</Td>
                    <Td right mono col={r.avgLatencyMs > 10 ? ORANGE : SUBTLE}>{r.avgLatencyMs.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{r.author}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'pipelines' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Pipeline</Th><Th>Rule</Th><Th>Stage</Th><Th>Status</Th><Th right>Passed</Th><Th right>Failed</Th><Th right>Coverage %</Th><Th right>Duration s</Th><Th>Triggered</Th></tr></thead>
              <tbody>
                {pipelines.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No pipelines â€” check /api/v4/policy-code/pipelines</td></tr>}
                {pipelines.sort((a, b) => a.status === 'failed' ? -1 : 1).map((p, i) => (
                  <tr key={i} style={{ background: p.status === 'failed' ? RED + '0a' : p.status === 'running' ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{p.pipelineId}</Td>
                    <Td mono col={TEXT}>{p.ruleName}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 5px' }}>{p.stage.toUpperCase()}</span></Td>
                    <Td><StatusBadge s={p.status} /></Td>
                    <Td right mono col={GREEN}>{p.testsPassed}</Td>
                    <Td right mono col={p.testsFailed > 0 ? RED : SUBTLE}>{p.testsFailed}</Td>
                    <Td right mono col={p.coveragePct >= 80 ? GREEN : p.coveragePct >= 60 ? AMBER : RED}>{p.coveragePct.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{p.durationSec.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{p.triggeredAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'deployments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule</Th><Th>Environment</Th><Th>Version</Th><Th>Status</Th><Th right>Rollout %</Th><Th right>Policies Impacted</Th><Th>Deployed By</Th><Th>Deployed At</Th></tr></thead>
              <tbody>
                {deployments.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No deployments â€” check /api/v4/policy-code/deployments</td></tr>}
                {deployments.sort((a, b) => a.environment === 'production' ? -1 : 1).map((d, i) => (
                  <tr key={i} style={{ background: d.status === 'rolled_back' ? ORANGE + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{d.ruleName}</Td>
                    <Td><EnvBadge e={d.environment} /></Td>
                    <Td mono col={PURPLE}>{d.version}</Td>
                    <Td><StatusBadge s={d.status} /></Td>
                    <Td right mono col={d.rolloutPct < 100 ? AMBER : GREEN}>{d.rolloutPct.toFixed(0)}%</Td>
                    <Td right mono col={TEXT}>{d.impactedPolicies}</Td>
                    <Td mono col={BLUE}>{d.deployedBy}</Td>
                    <Td mono col={SUBTLE}>{d.deployedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'violations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Violation</Th><Th>Rule</Th><Th>Context</Th><Th>Severity</Th><Th>Action</Th><Th>Status</Th><Th>Entity</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {violations.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No violations â€” check /api/v4/policy-code/violations</td></tr>}
                {violations.sort((a, b) => {
                  const sp: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (sp[a.severity] ?? 4) - (sp[b.severity] ?? 4)
                }).map((v, i) => (
                  <tr key={i} style={{ background: v.severity === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{v.violationId}</Td>
                    <Td mono col={BLUE}>{v.ruleName.slice(0, 24)}</Td>
                    <Td mono col={SUBTLE}>{v.context}</Td>
                    <Td><SevBadge s={v.severity} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: v.action === 'block' ? RED : v.action === 'warn' ? AMBER : SUBTLE, background: (v.action === 'block' ? RED : v.action === 'warn' ? AMBER : SUBTLE) + '22', borderRadius: 3, padding: '2px 5px' }}>{v.action.toUpperCase()}</span></Td>
                    <Td><StatusBadge s={v.status} /></Td>
                    <Td mono col={PURPLE}>{v.entityId.slice(0, 20)}</Td>
                    <Td mono col={SUBTLE}>{v.detail.slice(0, 28)}</Td>
                    <Td mono col={SUBTLE}>{v.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Rule</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/policy-code/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.ruleId}</Td>
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
