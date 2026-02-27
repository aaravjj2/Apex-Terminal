import React, { useState, useEffect, useCallback } from 'react'
﻿// AutopilotPlaybookUI2 â€” Bloomberg APEX autopilot playbook terminal
// Autopilot playbook engine with strategy templates and execution rules
// Tabs: PLAYBOOKS | EXECUTIONS | RULES | TEMPLATES | AUDIT
// APIs: /api/v4/autopilot-playbook/playbooks, /executions, /rules, /templates, /audit

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

interface Playbook {
  playbookId: string
  name: string
  category: string
  status: 'active' | 'draft' | 'paused' | 'deprecated'
  triggerType: 'schedule' | 'event' | 'manual' | 'threshold'
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  stepCount: number
  lastRun: string
  successRate: number
  avgDurationMin: number
  runCount: number
  owner: string
}

interface PlaybookExecution {
  executionId: string
  playbookId: string
  playbookName: string
  triggeredBy: string
  status: 'running' | 'completed' | 'failed' | 'aborted' | 'pending'
  stepsTotal: number
  stepsCompleted: number
  startedAt: string
  completedAt: string
  durationMin: number
  outcome: string
  riskLevel: string
}

interface PlaybookRule {
  ruleId: string
  playbookId: string
  playbookName: string
  ruleName: string
  condition: string
  action: string
  priority: number
  enabled: boolean
  matchCount: number
  lastTriggered: string
}

interface PlaybookTemplate {
  templateId: string
  name: string
  category: string
  description: string
  stepCount: number
  riskLevel: string
  estimatedDurationMin: number
  usageCount: number
  version: string
  author: string
}

interface PlaybookAuditEntry {
  auditId: string
  playbookId: string
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
function RiskBadge({ r }: { r: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: GREEN }
  const c = m[r] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{r.toUpperCase()}</span>
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, draft: BLUE, paused: AMBER, deprecated: SUBTLE, running: BLUE, completed: GREEN, failed: RED, aborted: ORANGE, pending: SUBTLE, pass: GREEN, fail: RED, warn: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? (done / total) * 100 : 0
  const col = pct === 100 ? GREEN : pct > 0 ? BLUE : SUBTLE
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <div style={{ width: 60, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE }}>{done}/{total}</span>
    </div>
  )
}


export function AutopilotPlaybookUI2() {
  const [tab, setTab] = useState<'playbooks' | 'executions' | 'rules' | 'templates' | 'audit'>('playbooks')
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [executions, setExecutions] = useState<PlaybookExecution[]>([])
  const [rules, setRules] = useState<PlaybookRule[]>([])
  const [templates, setTemplates] = useState<PlaybookTemplate[]>([])
  const [auditLog, setAuditLog] = useState<PlaybookAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rP, rE, rR, rT, rA] = await Promise.allSettled([
        fetch('/api/v4/autopilot-playbook/playbooks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot-playbook/executions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot-playbook/rules').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot-playbook/templates').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot-playbook/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rP.status === 'fulfilled') {
        const raw = Array.isArray(rP.value) ? rP.value : rP.value.playbooks ?? rP.value.data ?? []
        setPlaybooks(raw.map((p: any) => ({
          playbookId: p.playbook_id ?? p.playbookId ?? '', name: p.name ?? '',
          category: p.category ?? '', status: p.status ?? 'draft',
          triggerType: p.trigger_type ?? p.triggerType ?? 'manual',
          riskLevel: p.risk_level ?? p.riskLevel ?? 'low',
          stepCount: Number(p.step_count ?? p.stepCount ?? 0),
          lastRun: p.last_run ?? p.lastRun ?? '', successRate: Number(p.success_rate ?? p.successRate ?? 0),
          avgDurationMin: Number(p.avg_duration_min ?? p.avgDurationMin ?? 0),
          runCount: Number(p.run_count ?? p.runCount ?? 0), owner: p.owner ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load playbooks')
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.executions ?? rE.value.data ?? []
        setExecutions(raw.map((e: any) => ({
          executionId: e.execution_id ?? e.executionId ?? '', playbookId: e.playbook_id ?? e.playbookId ?? '',
          playbookName: e.playbook_name ?? e.playbookName ?? '', triggeredBy: e.triggered_by ?? e.triggeredBy ?? '',
          status: e.status ?? 'completed', stepsTotal: Number(e.steps_total ?? e.stepsTotal ?? 0),
          stepsCompleted: Number(e.steps_completed ?? e.stepsCompleted ?? 0),
          startedAt: e.started_at ?? e.startedAt ?? '', completedAt: e.completed_at ?? e.completedAt ?? '',
          durationMin: Number(e.duration_min ?? e.durationMin ?? 0), outcome: e.outcome ?? '', riskLevel: e.risk_level ?? e.riskLevel ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.rules ?? rR.value.data ?? []
        setRules(raw.map((r: any) => ({
          ruleId: r.rule_id ?? r.ruleId ?? '', playbookId: r.playbook_id ?? r.playbookId ?? '',
          playbookName: r.playbook_name ?? r.playbookName ?? '', ruleName: r.rule_name ?? r.ruleName ?? '',
          condition: r.condition ?? '', action: r.action ?? '', priority: Number(r.priority ?? 0),
          enabled: Boolean(r.enabled), matchCount: Number(r.match_count ?? r.matchCount ?? 0),
          lastTriggered: r.last_triggered ?? r.lastTriggered ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.templates ?? rT.value.data ?? []
        setTemplates(raw.map((t: any) => ({
          templateId: t.template_id ?? t.templateId ?? '', name: t.name ?? '', category: t.category ?? '',
          description: t.description ?? '', stepCount: Number(t.step_count ?? t.stepCount ?? 0),
          riskLevel: t.risk_level ?? t.riskLevel ?? 'low',
          estimatedDurationMin: Number(t.estimated_duration_min ?? t.estimatedDurationMin ?? 0),
          usageCount: Number(t.usage_count ?? t.usageCount ?? 0), version: t.version ?? '', author: t.author ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', playbookId: a.playbook_id ?? a.playbookId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', outcome: a.outcome ?? 'pass',
          detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const running = executions.filter(e => e.status === 'running').length
  const failed = executions.filter(e => e.status === 'failed').length
  const avgSuccess = playbooks.length > 0 ? (playbooks.reduce((s, p) => s + p.successRate, 0) / playbooks.length).toFixed(1) : 'â€”'

  const TABS2 = [
    { id: 'playbooks' as const, label: 'PLAYBOOKS' },
    { id: 'executions' as const, label: 'EXECUTIONS' },
    { id: 'rules' as const, label: 'RULES' },
    { id: 'templates' as const, label: 'TEMPLATES' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AUTOPILOT PLAYBOOK â€” STRATEGY TEMPLATES + EXECUTION ENGINE + RULE MANAGEMENT</span>
        {running > 0 && <span style={{ fontSize: 10, color: BLUE, fontWeight: 700 }}>âš¡ {running} RUNNING</span>}
        {failed > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {failed} FAILED</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Playbooks" value={playbooks.length} col={BLUE} />
        <StatCard label="Active" value={playbooks.filter(p => p.status === 'active').length} col={GREEN} />
        <StatCard label="Running" value={running} col={running > 0 ? BLUE : SUBTLE} />
        <StatCard label="Avg Success" value={`${avgSuccess}%`} col={AMBER} />
        <StatCard label="Templates" value={templates.length} col={PURPLE} />
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

        {tab === 'playbooks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Playbook</Th><Th>Category</Th><Th>Status</Th><Th>Risk</Th><Th>Trigger</Th><Th right>Steps</Th><Th right>Runs</Th><Th right>Success %</Th><Th right>Avg Min</Th><Th>Owner</Th><Th>Last Run</Th></tr></thead>
              <tbody>
                {playbooks.length === 0 && <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No playbooks â€” check /api/v4/autopilot-playbook/playbooks</td></tr>}
                {playbooks.sort((a, b) => b.runCount - a.runCount).map((p, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{p.name}</Td>
                    <Td mono col={PURPLE}>{p.category}</Td>
                    <Td><StatusBadge2 s={p.status} /></Td>
                    <Td><RiskBadge r={p.riskLevel} /></Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: BLUE, background: BLUE + '22', borderRadius: 3, padding: '2px 5px' }}>{p.triggerType.toUpperCase()}</span></Td>
                    <Td right mono col={SUBTLE}>{p.stepCount}</Td>
                    <Td right mono col={SUBTLE}>{p.runCount}</Td>
                    <Td right mono col={p.successRate >= 90 ? GREEN : p.successRate >= 70 ? AMBER : RED}>{p.successRate.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{p.avgDurationMin.toFixed(0)}</Td>
                    <Td mono col={SUBTLE}>{p.owner}</Td>
                    <Td mono col={SUBTLE}>{p.lastRun || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'executions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Execution ID</Th><Th>Playbook</Th><Th>Status</Th><Th>Progress</Th><Th>Triggered By</Th><Th right>Duration</Th><Th>Outcome</Th><Th>Risk</Th><Th>Started</Th><Th>Completed</Th></tr></thead>
              <tbody>
                {executions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No executions â€” check /api/v4/autopilot-playbook/executions</td></tr>}
                {executions.sort((a, b) => (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1)).map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'failed' ? RED + '0a' : e.status === 'running' ? BLUE + '07' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.executionId}</Td>
                    <Td mono col={BLUE}>{e.playbookName}</Td>
                    <Td><StatusBadge2 s={e.status} /></Td>
                    <Td><ProgressBar done={e.stepsCompleted} total={e.stepsTotal} /></Td>
                    <Td mono col={TEXT}>{e.triggeredBy}</Td>
                    <Td right mono col={SUBTLE}>{e.durationMin.toFixed(1)} min</Td>
                    <Td mono col={SUBTLE}>{e.outcome || 'â€”'}</Td>
                    <Td><RiskBadge r={e.riskLevel} /></Td>
                    <Td mono col={SUBTLE}>{e.startedAt}</Td>
                    <Td mono col={SUBTLE}>{e.completedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'rules' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule</Th><Th>Playbook</Th><Th>Condition</Th><Th>Action</Th><Th right>Priority</Th><Th>Enabled</Th><Th right>Matches</Th><Th>Last Triggered</Th></tr></thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No rules â€” check /api/v4/autopilot-playbook/rules</td></tr>}
                {rules.sort((a, b) => a.priority - b.priority).map((r, i) => (
                  <tr key={i} style={{ opacity: r.enabled ? 1 : 0.5 }}>
                    <Td mono col={AMBER}>{r.ruleName}</Td>
                    <Td mono col={BLUE}>{r.playbookName}</Td>
                    <Td mono col={SUBTLE}>{r.condition.slice(0, 40)}{r.condition.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={ORANGE}>{r.action.slice(0, 40)}{r.action.length > 40 ? 'â€¦' : ''}</Td>
                    <Td right mono col={SUBTLE}>{r.priority}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.enabled ? GREEN : RED }}>{r.enabled ? 'âœ“ ON' : 'âœ— OFF'}</span></Td>
                    <Td right mono col={r.matchCount > 0 ? TEXT : SUBTLE}>{r.matchCount}</Td>
                    <Td mono col={SUBTLE}>{r.lastTriggered || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'templates' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Template</Th><Th>Category</Th><Th>Risk</Th><Th right>Steps</Th><Th right>Est. Min</Th><Th right>Uses</Th><Th>Version</Th><Th>Author</Th><Th>Description</Th></tr></thead>
              <tbody>
                {templates.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No templates â€” check /api/v4/autopilot-playbook/templates</td></tr>}
                {templates.sort((a, b) => b.usageCount - a.usageCount).map((t, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{t.name}</Td>
                    <Td mono col={PURPLE}>{t.category}</Td>
                    <Td><RiskBadge r={t.riskLevel} /></Td>
                    <Td right mono col={SUBTLE}>{t.stepCount}</Td>
                    <Td right mono col={SUBTLE}>{t.estimatedDurationMin.toFixed(0)}</Td>
                    <Td right mono col={t.usageCount > 0 ? TEXT : SUBTLE}>{t.usageCount}</Td>
                    <Td mono col={SUBTLE}>{t.version}</Td>
                    <Td mono col={TEXT}>{t.author}</Td>
                    <Td mono col={SUBTLE}>{t.description.slice(0, 50)}{t.description.length > 50 ? 'â€¦' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Playbook</Th><Th>Action</Th><Th>Actor</Th><Th>Outcome</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/autopilot-playbook/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i} style={{ background: a.outcome === 'fail' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.playbookId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td><StatusBadge2 s={a.outcome} /></Td>
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
