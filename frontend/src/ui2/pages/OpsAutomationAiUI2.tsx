import React, { useState, useEffect, useCallback } from 'react'
﻿// OpsAutomationAiUI2 â€” Bloomberg APEX AI-powered ops automation terminal
// Runbook generation, incident response, task automation, decision engine, audit
// Tabs: RUNBOOKS | INCIDENTS | TASKS | DECISIONS | AUDIT
// APIs: /api/v4/ops-automation-ai/runbooks, /incidents, /tasks, /decisions, /audit

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

interface Runbook {
  runbookId: string
  title: string
  category: string
  generatedBy: 'ai' | 'human' | 'hybrid'
  status: 'active' | 'draft' | 'archived' | 'deprecated'
  stepsCount: number
  automatedSteps: number
  executionCount: number
  successRatePct: number
  avgDurationMin: number
  lastUpdated: string
}

interface AiIncident {
  incidentId: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'triaging' | 'mitigating' | 'resolved'
  aiConfidencePct: number
  rootCauseCategory: string
  detectedAt: string
  resolvedAt: string
  mttrMin: number
  aiActionsCount: number
  runbookId: string
}

interface AutomationTask {
  taskId: string
  taskName: string
  triggerType: string
  taskType: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
  priority: number
  durationSec: number
  retryCount: number
  scheduledAt: string
  completedAt: string
  aiGenerated: boolean
}

interface AiDecision {
  decisionId: string
  context: string
  model: string
  input: string
  decision: string
  confidencePct: number
  actionTaken: string
  outcome: 'accepted' | 'rejected' | 'overridden' | 'pending'
  overrideReason: string
  decidedAt: string
}

interface OpsAuditEntry {
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
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, draft: BLUE, archived: SUBTLE, deprecated: RED, open: RED, triaging: AMBER, mitigating: ORANGE, resolved: GREEN, queued: BLUE, running: AMBER, success: GREEN, failed: RED, cancelled: SUBTLE, accepted: GREEN, rejected: RED, overridden: ORANGE, pending: BLUE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ConfBar({ pct }: { pct: number }) {
  const col = pct >= 85 ? GREEN : pct >= 65 ? AMBER : RED
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 48, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(0)}%</span>
    </div>
  )
}


export function OpsAutomationAiUI2() {
  const [tab, setTab] = useState<'runbooks' | 'incidents' | 'tasks' | 'decisions' | 'audit'>('runbooks')
  const [runbooks, setRunbooks] = useState<Runbook[]>([])
  const [incidents, setIncidents] = useState<AiIncident[]>([])
  const [tasks, setTasks] = useState<AutomationTask[]>([])
  const [decisions, setDecisions] = useState<AiDecision[]>([])
  const [auditLog, setAuditLog] = useState<OpsAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rR, rI, rT, rD, rA] = await Promise.allSettled([
        fetch('/api/v4/ops-automation-ai/runbooks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ops-automation-ai/incidents').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ops-automation-ai/tasks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ops-automation-ai/decisions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/ops-automation-ai/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.runbooks ?? rR.value.data ?? []
        setRunbooks(raw.map((r: any) => ({
          runbookId: r.runbook_id ?? r.runbookId ?? '', title: r.title ?? '',
          category: r.category ?? '', generatedBy: r.generated_by ?? r.generatedBy ?? 'ai',
          status: r.status ?? 'active', stepsCount: Number(r.steps_count ?? r.stepsCount ?? 0),
          automatedSteps: Number(r.automated_steps ?? r.automatedSteps ?? 0),
          executionCount: Number(r.execution_count ?? r.executionCount ?? 0),
          successRatePct: Number(r.success_rate_pct ?? r.successRatePct ?? 0),
          avgDurationMin: Number(r.avg_duration_min ?? r.avgDurationMin ?? 0),
          lastUpdated: r.last_updated ?? r.lastUpdated ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load runbooks')
      if (rI.status === 'fulfilled') {
        const raw = Array.isArray(rI.value) ? rI.value : rI.value.incidents ?? rI.value.data ?? []
        setIncidents(raw.map((i: any) => ({
          incidentId: i.incident_id ?? i.incidentId ?? '', title: i.title ?? '',
          severity: i.severity ?? 'low', status: i.status ?? 'open',
          aiConfidencePct: Number(i.ai_confidence_pct ?? i.aiConfidencePct ?? 0),
          rootCauseCategory: i.root_cause_category ?? i.rootCauseCategory ?? '',
          detectedAt: i.detected_at ?? i.detectedAt ?? '', resolvedAt: i.resolved_at ?? i.resolvedAt ?? '',
          mttrMin: Number(i.mttr_min ?? i.mttrMin ?? 0),
          aiActionsCount: Number(i.ai_actions_count ?? i.aiActionsCount ?? 0),
          runbookId: i.runbook_id ?? i.runbookId ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.tasks ?? rT.value.data ?? []
        setTasks(raw.map((t: any) => ({
          taskId: t.task_id ?? t.taskId ?? '', taskName: t.task_name ?? t.taskName ?? '',
          triggerType: t.trigger_type ?? t.triggerType ?? '',
          taskType: t.task_type ?? t.taskType ?? '', status: t.status ?? 'queued',
          priority: Number(t.priority ?? 0), durationSec: Number(t.duration_sec ?? t.durationSec ?? 0),
          retryCount: Number(t.retry_count ?? t.retryCount ?? 0),
          scheduledAt: t.scheduled_at ?? t.scheduledAt ?? '', completedAt: t.completed_at ?? t.completedAt ?? '',
          aiGenerated: Boolean(t.ai_generated ?? t.aiGenerated),
        })))
      }
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.decisions ?? rD.value.data ?? []
        setDecisions(raw.map((d: any) => ({
          decisionId: d.decision_id ?? d.decisionId ?? '', context: d.context ?? '',
          model: d.model ?? '', input: d.input ?? '', decision: d.decision ?? '',
          confidencePct: Number(d.confidence_pct ?? d.confidencePct ?? 0),
          actionTaken: d.action_taken ?? d.actionTaken ?? '', outcome: d.outcome ?? 'pending',
          overrideReason: d.override_reason ?? d.overrideReason ?? '',
          decidedAt: d.decided_at ?? d.decidedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', entityId: a.entity_id ?? a.entityId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id) }, [fetchAll])

  const openIncidents = incidents.filter(i => i.status !== 'resolved').length
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length
  const runningTasks = tasks.filter(t => t.status === 'running').length
  const aiRunbooks = runbooks.filter(r => r.generatedBy === 'ai').length

  const TABS2 = [
    { id: 'runbooks' as const, label: 'RUNBOOKS' },
    { id: 'incidents' as const, label: 'INCIDENTS' },
    { id: 'tasks' as const, label: 'TASKS' },
    { id: 'decisions' as const, label: 'DECISIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>OPS AUTOMATION AI â€” RUNBOOK GEN + INCIDENT RESPONSE + TASK ENGINE</span>
        {criticalIncidents > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalIncidents} CRITICAL</span>}
        {runningTasks > 0 && <span style={{ fontSize: 10, color: AMBER }}>âŸ³ {runningTasks} TASKS RUNNING</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Runbooks" value={runbooks.filter(r => r.status === 'active').length} col={BLUE} />
        <StatCard label="AI Generated" value={aiRunbooks} col={PURPLE} />
        <StatCard label="Open Incidents" value={openIncidents} col={openIncidents > 0 ? ORANGE : GREEN} />
        <StatCard label="Running Tasks" value={runningTasks} col={runningTasks > 0 ? AMBER : GREEN} />
        <StatCard label="AI Decisions" value={decisions.length} col={BLUE} />
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

        {tab === 'runbooks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Runbook</Th><Th>Category</Th><Th>Generated By</Th><Th>Status</Th><Th right>Steps</Th><Th right>Auto Steps</Th><Th right>Executions</Th><Th right>Success %</Th><Th right>Avg Min</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {runbooks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No runbooks â€” check /api/v4/ops-automation-ai/runbooks</td></tr>}
                {runbooks.sort((a, b) => b.executionCount - a.executionCount).map((r, i) => (
                  <tr key={i} style={{ opacity: r.status === 'archived' || r.status === 'deprecated' ? 0.5 : 1 }}>
                    <Td mono col={AMBER}>{r.title}</Td>
                    <Td mono col={BLUE}>{r.category}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.generatedBy === 'ai' ? PURPLE : r.generatedBy === 'human' ? BLUE : ORANGE, background: (r.generatedBy === 'ai' ? PURPLE : r.generatedBy === 'human' ? BLUE : ORANGE) + '22', borderRadius: 3, padding: '2px 5px' }}>{r.generatedBy.toUpperCase()}</span></Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td right mono col={SUBTLE}>{r.stepsCount}</Td>
                    <Td right mono col={GREEN}>{r.automatedSteps}</Td>
                    <Td right mono col={TEXT}>{r.executionCount}</Td>
                    <Td right mono col={r.successRatePct >= 90 ? GREEN : r.successRatePct >= 70 ? AMBER : RED}>{r.successRatePct.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{r.avgDurationMin.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{r.lastUpdated || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'incidents' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Incident</Th><Th>Severity</Th><Th>Status</Th><Th>Root Cause</Th><Th>AI Confidence</Th><Th right>MTTR min</Th><Th right>AI Actions</Th><Th>Runbook</Th><Th>Detected</Th></tr></thead>
              <tbody>
                {incidents.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No incidents â€” check /api/v4/ops-automation-ai/incidents</td></tr>}
                {incidents.sort((a, b) => {
                  const sp: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
                  return (sp[a.severity] ?? 4) - (sp[b.severity] ?? 4)
                }).map((i, idx) => (
                  <tr key={idx} style={{ background: i.severity === 'critical' && i.status !== 'resolved' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{i.title.slice(0, 36)}{i.title.length > 36 ? 'â€¦' : ''}</Td>
                    <Td><SevBadge s={i.severity} /></Td>
                    <Td><StatusBadge s={i.status} /></Td>
                    <Td mono col={SUBTLE}>{i.rootCauseCategory || 'â€”'}</Td>
                    <Td><ConfBar pct={i.aiConfidencePct} /></Td>
                    <Td right mono col={i.mttrMin > 60 ? ORANGE : SUBTLE}>{i.mttrMin > 0 ? i.mttrMin.toFixed(0) : 'â€”'}</Td>
                    <Td right mono col={TEXT}>{i.aiActionsCount}</Td>
                    <Td mono col={BLUE}>{i.runbookId || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{i.detectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'tasks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Task</Th><Th>Type</Th><Th>Trigger</Th><Th>Status</Th><Th right>Priority</Th><Th>AI</Th><Th right>Duration s</Th><Th right>Retries</Th><Th>Scheduled</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {tasks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No tasks â€” check /api/v4/ops-automation-ai/tasks</td></tr>}
                {tasks.sort((a, b) => a.priority - b.priority).map((t, i) => (
                  <tr key={i} style={{ background: t.status === 'failed' ? RED + '0a' : t.status === 'running' ? AMBER + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{t.taskName}</Td>
                    <Td mono col={BLUE}>{t.taskType}</Td>
                    <Td mono col={SUBTLE}>{t.triggerType}</Td>
                    <Td><StatusBadge s={t.status} /></Td>
                    <Td right mono col={t.priority <= 2 ? RED : t.priority <= 4 ? AMBER : SUBTLE}>{t.priority}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: t.aiGenerated ? PURPLE : SUBTLE }}>{t.aiGenerated ? 'âœ“ AI' : 'â€”'}</span></Td>
                    <Td right mono col={SUBTLE}>{t.durationSec > 0 ? t.durationSec.toFixed(0) : 'â€”'}</Td>
                    <Td right mono col={t.retryCount > 2 ? ORANGE : SUBTLE}>{t.retryCount}</Td>
                    <Td mono col={SUBTLE}>{t.scheduledAt}</Td>
                    <Td mono col={SUBTLE}>{t.completedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'decisions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Decision</Th><Th>Context</Th><Th>Model</Th><Th>Outcome</Th><Th>Confidence</Th><Th>Action</Th><Th>Override Reason</Th><Th>Decided</Th></tr></thead>
              <tbody>
                {decisions.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No decisions â€” check /api/v4/ops-automation-ai/decisions</td></tr>}
                {decisions.map((d, i) => (
                  <tr key={i} style={{ background: d.outcome === 'overridden' ? ORANGE + '0a' : d.outcome === 'rejected' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{d.decisionId}</Td>
                    <Td mono col={BLUE}>{d.context.slice(0, 28)}{d.context.length > 28 ? 'â€¦' : ''}</Td>
                    <Td mono col={PURPLE}>{d.model}</Td>
                    <Td><StatusBadge s={d.outcome} /></Td>
                    <Td><ConfBar pct={d.confidencePct} /></Td>
                    <Td mono col={TEXT}>{d.actionTaken.slice(0, 32)}{d.actionTaken.length > 32 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{d.overrideReason || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{d.decidedAt}</Td>
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
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/ops-automation-ai/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.entityId}</Td>
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
