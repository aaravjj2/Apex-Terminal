import React, { useState, useEffect, useCallback } from 'react'
﻿// AiGovernanceUI2 â€” Bloomberg AIGV AI release governance terminal
// Model review, approval gates, deployment controls, policy enforcement, audit
// Tabs: MODELS | APPROVALS | GATES | DEPLOYMENTS | AUDIT
// APIs: /api/v4/ai-governance/models, /approvals, /gates, /deployments, /audit

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

interface AiModel {
  modelId: string
  name: string
  version: string
  provider: string
  useCase: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  governanceStatus: 'pending-review' | 'under-review' | 'approved' | 'rejected' | 'deprecated'
  biasScore: number
  fairnessScore: number
  explainabilityScore: number
  reviewedBy: string
  approvedAt: string
  nextReview: string
}

interface ApprovalRecord {
  approvalId: string
  modelId: string
  modelName: string
  requestType: string
  requester: string
  status: 'pending' | 'approved' | 'rejected' | 'escalated'
  priority: 'p1' | 'p2' | 'p3'
  reviewers: string[]
  submittedAt: string
  dueBy: string
  comments: string
}

interface GateEntry {
  gateId: string
  gateName: string
  gateType: string
  status: 'open' | 'closed' | 'override'
  requirement: string
  blockedDeployments: number
  lastEvaluated: string
  autoReleaseOn: string
  owner: string
}

interface DeploymentRecord {
  deploymentId: string
  modelId: string
  environment: string
  version: string
  status: 'staged' | 'deploying' | 'active' | 'rolled-back' | 'failed'
  gatesPassedCount: number
  gatesTotal: number
  deployedBy: string
  deployedAt: string
  trafficPct: number
  rollbackAvailable: boolean
}

interface GovAuditEntry {
  auditId: string
  modelId: string
  action: string
  actor: string
  fromStatus: string
  toStatus: string
  outcome: 'pass' | 'fail' | 'warn'
  policyRef: string
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
function RiskBadge({ r }: { r: string }) {
  const m: Record<string, string> = { low: GREEN, medium: AMBER, high: ORANGE, critical: RED }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { 'pending-review': AMBER, 'under-review': BLUE, approved: GREEN, rejected: RED, deprecated: SUBTLE, pending: AMBER, escalated: ORANGE, 'p1': RED, 'p2': ORANGE, 'p3': SUBTLE, staged: BLUE, deploying: ORANGE, active: GREEN, 'rolled-back': AMBER, failed: RED, open: RED, closed: GREEN, override: ORANGE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ScoreBar({ score, col }: { score: number; col?: string }) {
  const c = col ?? (score >= 80 ? GREEN : score >= 60 ? AMBER : RED)
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 42, height: 3, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: c }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: c }}>{score}</span>
    </div>
  )
}
function GateBar({ passed, total }: { passed: number; total: number }) {
  const pct = total > 0 ? (passed / total) * 100 : 0
  const col = pct === 100 ? GREEN : pct >= 50 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{passed}/{total}</span>
    </div>
  )
}


export function AiGovernanceUI2() {
  const [tab, setTab] = useState<'models' | 'approvals' | 'gates' | 'deployments' | 'audit'>('models')
  const [models, setModels] = useState<AiModel[]>([])
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])
  const [gates, setGates] = useState<GateEntry[]>([])
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [auditLog, setAuditLog] = useState<GovAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rM, rA, rG, rD, rAu] = await Promise.allSettled([
        fetch('/api/v4/ai-governance/models').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ai-governance/approvals').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ai-governance/gates').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ai-governance/deployments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ai-governance/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rM.status === 'fulfilled') {
        const raw = Array.isArray(rM.value) ? rM.value : rM.value.models ?? rM.value.data ?? []
        setModels(raw.map((m: any) => ({
          modelId: m.model_id ?? m.modelId ?? '', name: m.name ?? '', version: m.version ?? '',
          provider: m.provider ?? '', useCase: m.use_case ?? m.useCase ?? '',
          riskLevel: m.risk_level ?? m.riskLevel ?? 'low',
          governanceStatus: m.governance_status ?? m.governanceStatus ?? 'pending-review',
          biasScore: Number(m.bias_score ?? m.biasScore ?? 0),
          fairnessScore: Number(m.fairness_score ?? m.fairnessScore ?? 0),
          explainabilityScore: Number(m.explainability_score ?? m.explainabilityScore ?? 0),
          reviewedBy: m.reviewed_by ?? m.reviewedBy ?? '', approvedAt: m.approved_at ?? m.approvedAt ?? '',
          nextReview: m.next_review ?? m.nextReview ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load models')
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.approvals ?? rA.value.data ?? []
        setApprovals(raw.map((a: any) => ({
          approvalId: a.approval_id ?? a.approvalId ?? '', modelId: a.model_id ?? a.modelId ?? '',
          modelName: a.model_name ?? a.modelName ?? '', requestType: a.request_type ?? a.requestType ?? '',
          requester: a.requester ?? '', status: a.status ?? 'pending', priority: a.priority ?? 'p3',
          reviewers: Array.isArray(a.reviewers) ? a.reviewers : [], submittedAt: a.submitted_at ?? a.submittedAt ?? '',
          dueBy: a.due_by ?? a.dueBy ?? '', comments: a.comments ?? '',
        })))
      }
      if (rG.status === 'fulfilled') {
        const raw = Array.isArray(rG.value) ? rG.value : rG.value.gates ?? rG.value.data ?? []
        setGates(raw.map((g: any) => ({
          gateId: g.gate_id ?? g.gateId ?? '', gateName: g.gate_name ?? g.gateName ?? '',
          gateType: g.gate_type ?? g.gateType ?? '', status: g.status ?? 'open',
          requirement: g.requirement ?? '', blockedDeployments: Number(g.blocked_deployments ?? g.blockedDeployments ?? 0),
          lastEvaluated: g.last_evaluated ?? g.lastEvaluated ?? '', autoReleaseOn: g.auto_release_on ?? g.autoReleaseOn ?? '',
          owner: g.owner ?? '',
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.deployments ?? rD.value.data ?? []
        setDeployments(raw.map((d: any) => ({
          deploymentId: d.deployment_id ?? d.deploymentId ?? '', modelId: d.model_id ?? d.modelId ?? '',
          environment: d.environment ?? '', version: d.version ?? '', status: d.status ?? 'staged',
          gatesPassedCount: Number(d.gates_passed_count ?? d.gatesPassedCount ?? 0),
          gatesTotal: Number(d.gates_total ?? d.gatesTotal ?? 0),
          deployedBy: d.deployed_by ?? d.deployedBy ?? '', deployedAt: d.deployed_at ?? d.deployedAt ?? '',
          trafficPct: Number(d.traffic_pct ?? d.trafficPct ?? 0),
          rollbackAvailable: Boolean(d.rollback_available ?? d.rollbackAvailable ?? false),
        })))
      }
      if (rAu.status === 'fulfilled') {
        const raw = Array.isArray(rAu.value) ? rAu.value : rAu.value.audit ?? rAu.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', modelId: a.model_id ?? a.modelId ?? '',
          action: a.action ?? '', actor: a.actor ?? '',
          fromStatus: a.from_status ?? a.fromStatus ?? '', toStatus: a.to_status ?? a.toStatus ?? '',
          outcome: a.outcome ?? 'pass', policyRef: a.policy_ref ?? a.policyRef ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const criticalModels = models.filter(m => m.riskLevel === 'critical').length
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length
  const closedGates = gates.filter(g => g.status === 'closed').length
  const failedDeployments = deployments.filter(d => d.status === 'failed').length

  const TABS2 = [
    { id: 'models' as const, label: 'MODELS' },
    { id: 'approvals' as const, label: 'APPROVALS' },
    { id: 'gates' as const, label: 'GATES' },
    { id: 'deployments' as const, label: 'DEPLOYMENTS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>AIGV</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AI GOVERNANCE â€” MODEL REVIEW + APPROVAL GATES + DEPLOYMENT CONTROLS + POLICY ENFORCEMENT</span>
        {criticalModels > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalModels} CRITICAL</span>}
        {pendingApprovals > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {pendingApprovals} PENDING APPROVALS</span>}
        {closedGates > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {closedGates} GATES CLOSED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Models" value={models.length} col={BLUE} />
        <StatCard label="Critical Risk" value={criticalModels} col={criticalModels > 0 ? RED : GREEN} />
        <StatCard label="Pending Approvals" value={pendingApprovals} col={pendingApprovals > 0 ? AMBER : GREEN} />
        <StatCard label="Gates Closed" value={closedGates} col={closedGates > 0 ? RED : GREEN} />
        <StatCard label="Failed Deploys" value={failedDeployments} col={failedDeployments > 0 ? RED : GREEN} />
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

        {tab === 'models' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Provider</Th><Th>Use Case</Th><Th>Risk</Th><Th>Status</Th><Th>Bias Score</Th><Th>Fairness</Th><Th>Explainability</Th><Th>Reviewed By</Th><Th>Next Review</Th></tr></thead>
              <tbody>
                {models.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No models â€” check /api/v4/ai-governance/models</td></tr>}
                {models.sort((a, b) => {
                  const p: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (p[a.riskLevel] ?? 4) - (p[b.riskLevel] ?? 4)
                }).map((m, i) => (
                  <tr key={i} style={{ background: m.riskLevel === 'critical' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{m.name}</Td>
                    <Td mono col={BLUE}>{m.provider}</Td>
                    <Td mono col={PURPLE}>{m.useCase}</Td>
                    <Td><RiskBadge r={m.riskLevel} /></Td>
                    <Td><StatusBadge2 s={m.governanceStatus} /></Td>
                    <Td><ScoreBar score={m.biasScore} col={m.biasScore < 50 ? RED : GREEN} /></Td>
                    <Td><ScoreBar score={m.fairnessScore} /></Td>
                    <Td><ScoreBar score={m.explainabilityScore} /></Td>
                    <Td mono col={SUBTLE}>{m.reviewedBy}</Td>
                    <Td mono col={AMBER}>{m.nextReview}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'approvals' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Approval ID</Th><Th>Model</Th><Th>Request Type</Th><Th>Priority</Th><Th>Status</Th><Th>Requester</Th><Th>Reviewers</Th><Th>Due By</Th><Th>Comments</Th></tr></thead>
              <tbody>
                {approvals.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No approvals â€” check /api/v4/ai-governance/approvals</td></tr>}
                {approvals.sort((a, b) => {
                  const p: Record<string, number> = { p1: 0, p2: 1, p3: 2 }
                  return (p[a.priority] ?? 3) - (p[b.priority] ?? 3)
                }).map((a, i) => (
                  <tr key={i} style={{ background: a.priority === 'p1' && a.status === 'pending' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.approvalId}</Td>
                    <Td mono col={BLUE}>{a.modelName}</Td>
                    <Td mono col={PURPLE}>{a.requestType}</Td>
                    <Td><StatusBadge2 s={a.priority} /></Td>
                    <Td><StatusBadge2 s={a.status} /></Td>
                    <Td mono col={TEXT}>{a.requester}</Td>
                    <Td mono col={SUBTLE}>{a.reviewers.join(', ')}</Td>
                    <Td mono col={AMBER}>{a.dueBy}</Td>
                    <Td mono col={SUBTLE}>{a.comments ? a.comments.slice(0, 35) + (a.comments.length > 35 ? 'â€¦' : '') : 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gates' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Gate ID</Th><Th>Name</Th><Th>Type</Th><Th>Status</Th><Th>Requirement</Th><Th right>Blocked</Th><Th>Auto Release</Th><Th>Last Evaluated</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {gates.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No gates â€” check /api/v4/ai-governance/gates</td></tr>}
                {gates.sort((a, b) => {
                  const p: Record<string, number> = { closed: 0, override: 1, open: 2 }
                  return (p[a.status] ?? 3) - (p[b.status] ?? 3)
                }).map((g, i) => (
                  <tr key={i} style={{ background: g.status === 'closed' && g.blockedDeployments > 0 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{g.gateId}</Td>
                    <Td mono col={BLUE}>{g.gateName}</Td>
                    <Td mono col={PURPLE}>{g.gateType}</Td>
                    <Td><StatusBadge2 s={g.status} /></Td>
                    <Td mono col={SUBTLE}>{g.requirement}</Td>
                    <Td right mono col={g.blockedDeployments > 0 ? RED : GREEN}>{g.blockedDeployments}</Td>
                    <Td mono col={SUBTLE}>{g.autoReleaseOn || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{g.lastEvaluated}</Td>
                    <Td mono col={SUBTLE}>{g.owner}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'deployments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Deployment ID</Th><Th>Model</Th><Th>Environment</Th><Th>Version</Th><Th>Status</Th><Th>Gates</Th><Th right>Traffic %</Th><Th>Deployed By</Th><Th>Rollback</Th><Th>Deployed At</Th></tr></thead>
              <tbody>
                {deployments.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No deployments â€” check /api/v4/ai-governance/deployments</td></tr>}
                {deployments.sort((a, b) => {
                  const p: Record<string, number> = { failed: 0, 'rolled-back': 1, deploying: 2, staged: 3, active: 4 }
                  return (p[a.status] ?? 5) - (p[b.status] ?? 5)
                }).map((d, i) => (
                  <tr key={i} style={{ background: d.status === 'failed' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{d.deploymentId}</Td>
                    <Td mono col={BLUE}>{d.modelId}</Td>
                    <Td mono col={PURPLE}>{d.environment}</Td>
                    <Td mono col={SUBTLE}>{d.version}</Td>
                    <Td><StatusBadge2 s={d.status} /></Td>
                    <Td><GateBar passed={d.gatesPassedCount} total={d.gatesTotal} /></Td>
                    <Td right mono col={d.trafficPct === 100 ? GREEN : AMBER}>{d.trafficPct}%</Td>
                    <Td mono col={TEXT}>{d.deployedBy}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: d.rollbackAvailable ? GREEN : SUBTLE }}>{d.rollbackAvailable ? 'âœ“ AVAIL' : 'N/A'}</span></Td>
                    <Td mono col={SUBTLE}>{d.deployedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Model</Th><Th>Action</Th><Th>Actor</Th><Th>From</Th><Th>To</Th><Th>Outcome</Th><Th>Policy Ref</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/ai-governance/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.modelId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.fromStatus}</Td>
                    <Td mono col={TEXT}>{a.toStatus}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
                    <Td mono col={BLUE}>{a.policyRef || 'â€”'}</Td>
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
