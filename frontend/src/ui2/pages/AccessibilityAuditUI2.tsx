import React, { useState, useEffect, useCallback } from 'react'
﻿// AccessibilityAuditUI2 â€” Bloomberg APEX Accessibility Audit terminal
// axe-core / WCAG 2.1 compliance tracking, violation triage, remediation pipeline
// Tabs: VIOLATIONS | AUDIT RUNS | WCAG | REMEDIATION | AUDIT LOG
// APIs: /api/v3/a11y/violations, /runs, /wcag, /remediation, /log

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

interface A11yViolation {
  violationId: string
  ruleId: string
  description: string
  helpUrl: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  category: 'perceivable' | 'operable' | 'understandable' | 'robust'
  wcagCriteria: string
  affectedNodes: number
  pagesAffected: number
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk' | 'wont_fix'
  firstSeen: string
  lastSeen: string
  assignee: string
}

interface A11yAuditRun {
  runId: string
  pageId: string
  pageUrl: string
  timestamp: string
  engine: 'axe-core' | 'lighthouse' | 'wave'
  criticalCount: number
  seriousCount: number
  moderateCount: number
  minorCount: number
  passesCount: number
  incompleteCount: number
  score: number
  wcagLevel: 'A' | 'AA' | 'AAA' | 'fail'
  duration: number
}

interface WcagCriterion {
  criterion: string
  title: string
  level: 'A' | 'AA' | 'AAA'
  status: 'pass' | 'fail' | 'partial' | 'untested'
  violations: number
  pages: number
  principle: 'perceivable' | 'operable' | 'understandable' | 'robust'
}

interface RemediationTask {
  taskId: string
  violationId: string
  title: string
  priority: 'p0' | 'p1' | 'p2' | 'p3'
  status: 'backlog' | 'in_progress' | 'review' | 'done' | 'blocked'
  assignee: string
  effortHours: number
  targetDate: string
  affectedNodes: number
  component: string
}

interface A11yLogEntry {
  logId: string
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
function ImpactBadge({ i }: { i: string }) {
  const m: Record<string, string> = { critical: RED, serious: ORANGE, moderate: AMBER, minor: BLUE }
  const c = m[i] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{i.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { open: RED, in_progress: AMBER, resolved: GREEN, accepted_risk: PURPLE, wont_fix: SUBTLE, pass: GREEN, fail: RED, partial: ORANGE, untested: SUBTLE, backlog: SUBTLE, review: BLUE, done: GREEN, blocked: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace(/_/g, ' ').toUpperCase()}</span>
}
function WcagBadge({ lvl }: { lvl: string }) {
  const m: Record<string, string> = { A: GREEN, AA: AMBER, AAA: PURPLE, fail: RED }
  const c = m[lvl] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>WCAG {lvl}</span>
}
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const col = pct >= 90 ? GREEN : pct >= 70 ? AMBER : pct >= 50 ? ORANGE : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{pct.toFixed(0)}</span>
    </div>
  )
}


export function AccessibilityAuditUI2() {
  const [tab, setTab] = useState<'violations' | 'runs' | 'wcag' | 'remediation' | 'log'>('violations')
  const [violations, setViolations] = useState<A11yViolation[]>([])
  const [auditRuns, setAuditRuns] = useState<A11yAuditRun[]>([])
  const [wcagCriteria, setWcagCriteria] = useState<WcagCriterion[]>([])
  const [remediation, setRemediation] = useState<RemediationTask[]>([])
  const [logEntries, setLogEntries] = useState<A11yLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rV, rR, rW, rRem, rL] = await Promise.allSettled([
        fetch('/api/v3/a11y/violations').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/a11y/runs').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/a11y/wcag').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/a11y/remediation').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/a11y/log').then(r => r.ok ? r.json() : []),
      ])
      if (rV.status === 'fulfilled') {
        const raw = Array.isArray(rV.value) ? rV.value : rV.value.violations ?? rV.value.data ?? []
        setViolations(raw.map((v: any) => ({
          violationId: v.violation_id ?? v.violationId ?? v.id ?? '',
          ruleId: v.rule_id ?? v.ruleId ?? '', description: v.description ?? '',
          helpUrl: v.help_url ?? v.helpUrl ?? '', impact: v.impact ?? 'moderate',
          category: v.category ?? 'perceivable',
          wcagCriteria: v.wcag_criteria ?? v.wcagCriteria ?? '',
          affectedNodes: Number(v.affected_nodes ?? v.affectedNodes ?? 0),
          pagesAffected: Number(v.pages_affected ?? v.pagesAffected ?? 0),
          status: v.status ?? 'open', firstSeen: v.first_seen ?? v.firstSeen ?? '',
          lastSeen: v.last_seen ?? v.lastSeen ?? '', assignee: v.assignee ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load a11y data')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.runs ?? rR.value.data ?? []
        setAuditRuns(raw.map((r: any) => ({
          runId: r.run_id ?? r.runId ?? r.id ?? '', pageId: r.page_id ?? r.pageId ?? '',
          pageUrl: r.page_url ?? r.pageUrl ?? '', timestamp: r.timestamp ?? '',
          engine: r.engine ?? 'axe-core',
          criticalCount: Number(r.critical_count ?? r.criticalCount ?? r.violations_critical ?? 0),
          seriousCount: Number(r.serious_count ?? r.seriousCount ?? r.violations_serious ?? 0),
          moderateCount: Number(r.moderate_count ?? r.moderateCount ?? r.violations_moderate ?? 0),
          minorCount: Number(r.minor_count ?? r.minorCount ?? r.violations_minor ?? 0),
          passesCount: Number(r.passes_count ?? r.passesCount ?? 0),
          incompleteCount: Number(r.incomplete_count ?? r.incompleteCount ?? 0),
          score: Number(r.score ?? 0), wcagLevel: r.wcag_level ?? r.wcagLevel ?? 'fail',
          duration: Number(r.duration_ms ?? r.duration ?? 0),
        })))
      }
      if (rW.status === 'fulfilled') {
        const raw = Array.isArray(rW.value) ? rW.value : rW.value.criteria ?? rW.value.data ?? []
        setWcagCriteria(raw.map((w: any) => ({
          criterion: w.criterion ?? '', title: w.title ?? '',
          level: w.level ?? 'A', status: w.status ?? 'untested',
          violations: Number(w.violations ?? 0), pages: Number(w.pages ?? 0),
          principle: w.principle ?? 'perceivable',
        })))
      }
      if (rRem.status === 'fulfilled') {
        const raw = Array.isArray(rRem.value) ? rRem.value : rRem.value.tasks ?? rRem.value.data ?? []
        setRemediation(raw.map((r: any) => ({
          taskId: r.task_id ?? r.taskId ?? '', violationId: r.violation_id ?? r.violationId ?? '',
          title: r.title ?? '', priority: r.priority ?? 'p2',
          status: r.status ?? 'backlog', assignee: r.assignee ?? '',
          effortHours: Number(r.effort_hours ?? r.effortHours ?? 0),
          targetDate: r.target_date ?? r.targetDate ?? '',
          affectedNodes: Number(r.affected_nodes ?? r.affectedNodes ?? 0),
          component: r.component ?? '',
        })))
      }
      if (rL.status === 'fulfilled') {
        const raw = Array.isArray(rL.value) ? rL.value : rL.value.log ?? rL.value.data ?? []
        setLogEntries(raw.map((e: any) => ({
          logId: e.log_id ?? e.logId ?? '', action: e.action ?? '',
          actor: e.actor ?? '', detail: e.detail ?? '', timestamp: e.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const criticalOpen = violations.filter(v => v.impact === 'critical' && v.status === 'open').length
  const seriousOpen = violations.filter(v => v.impact === 'serious' && v.status === 'open').length
  const latestRun = auditRuns.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
  const wcagAA = wcagCriteria.filter(w => w.level === 'AA')
  const wcagAAPassRate = wcagAA.length ? (wcagAA.filter(w => w.status === 'pass').length / wcagAA.length * 100) : 0

  const TABS2 = [
    { id: 'violations' as const, label: 'VIOLATIONS' },
    { id: 'runs' as const, label: 'AUDIT RUNS' },
    { id: 'wcag' as const, label: 'WCAG' },
    { id: 'remediation' as const, label: 'REMEDIATION' },
    { id: 'log' as const, label: 'AUDIT LOG' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>ACCESSIBILITY AUDIT â€” axe-core / WCAG 2.1 COMPLIANCE + VIOLATION TRIAGE + REMEDIATION PIPELINE</span>
        {criticalOpen > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalOpen} CRITICAL OPEN</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Critical Open" value={criticalOpen} col={criticalOpen > 0 ? RED : GREEN} />
        <StatCard label="Serious Open" value={seriousOpen} col={seriousOpen > 0 ? ORANGE : GREEN} />
        <StatCard label="Latest A11y Score" value={latestRun ? latestRun.score.toFixed(0) : 'â€”'} col={latestRun && latestRun.score >= 90 ? GREEN : RED} />
        <StatCard label="WCAG AA Pass Rate" value={`${wcagAAPassRate.toFixed(0)}%`} col={wcagAAPassRate >= 90 ? GREEN : ORANGE} />
        <StatCard label="Open Remediations" value={remediation.filter(r => ['backlog', 'in_progress', 'blocked'].includes(r.status)).length} col={AMBER} />
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

        {tab === 'violations' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rule ID</Th><Th>Description</Th><Th>Impact</Th><Th>WCAG</Th><Th>Category</Th><Th>Status</Th><Th right>Nodes</Th><Th right>Pages</Th><Th>First Seen</Th><Th>Assignee</Th></tr></thead>
              <tbody>
                {violations.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No violations â€” check /api/v3/a11y/violations</td></tr>}
                {violations.sort((a, b) => {
                  const rank: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 }
                  return (rank[a.impact] ?? 4) - (rank[b.impact] ?? 4)
                }).map((v, i) => (
                  <tr key={i} style={{ background: v.impact === 'critical' && v.status === 'open' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{v.ruleId}</Td>
                    <Td mono col={TEXT}>{v.description.slice(0, 55)}{v.description.length > 55 ? 'â€¦' : ''}</Td>
                    <Td><ImpactBadge i={v.impact} /></Td>
                    <Td mono col={SUBTLE}>{v.wcagCriteria || 'â€”'}</Td>
                    <Td mono col={PURPLE}>{v.category}</Td>
                    <Td><StatusBadge s={v.status} /></Td>
                    <Td right mono col={TEXT}>{v.affectedNodes}</Td>
                    <Td right mono col={TEXT}>{v.pagesAffected}</Td>
                    <Td mono col={SUBTLE}>{v.firstSeen || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{v.assignee || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'runs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Run ID</Th><Th>Page URL</Th><Th>Engine</Th><Th>WCAG Level</Th><Th right>Critical</Th><Th right>Serious</Th><Th right>Moderate</Th><Th right>Minor</Th><Th>Score</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditRuns.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit runs â€” check /api/v3/a11y/runs</td></tr>}
                {auditRuns.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((r, i) => (
                  <tr key={i} style={{ background: r.criticalCount > 0 ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.runId}</Td>
                    <Td mono col={BLUE}>{r.pageUrl.slice(0, 40)}{r.pageUrl.length > 40 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{r.engine}</Td>
                    <Td><WcagBadge lvl={r.wcagLevel} /></Td>
                    <Td right mono col={r.criticalCount > 0 ? RED : TEXT}>{r.criticalCount}</Td>
                    <Td right mono col={r.seriousCount > 0 ? ORANGE : TEXT}>{r.seriousCount}</Td>
                    <Td right mono col={r.moderateCount > 0 ? AMBER : TEXT}>{r.moderateCount}</Td>
                    <Td right mono col={TEXT}>{r.minorCount}</Td>
                    <Td><ScoreBar score={r.score} /></Td>
                    <Td mono col={SUBTLE}>{r.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'wcag' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Criterion</Th><Th>Title</Th><Th>Level</Th><Th>Principle</Th><Th>Status</Th><Th right>Violations</Th><Th right>Pages</Th></tr></thead>
              <tbody>
                {wcagCriteria.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No WCAG data â€” check /api/v3/a11y/wcag</td></tr>}
                {wcagCriteria.sort((a, b) => {
                  const ps: Record<string, number> = { fail: 0, partial: 1, untested: 2, pass: 3 }
                  return (ps[a.status] ?? 4) - (ps[b.status] ?? 4)
                }).map((w, i) => (
                  <tr key={i} style={{ background: w.status === 'fail' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{w.criterion}</Td>
                    <Td mono col={TEXT}>{w.title}</Td>
                    <Td><WcagBadge lvl={w.level} /></Td>
                    <Td mono col={PURPLE}>{w.principle}</Td>
                    <Td><StatusBadge s={w.status} /></Td>
                    <Td right mono col={w.violations > 0 ? RED : GREEN}>{w.violations}</Td>
                    <Td right mono col={TEXT}>{w.pages}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'remediation' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Task ID</Th><Th>Title</Th><Th>Priority</Th><Th>Status</Th><Th>Component</Th><Th>Assignee</Th><Th right>Effort h</Th><Th right>Nodes</Th><Th>Target Date</Th></tr></thead>
              <tbody>
                {remediation.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No remediation tasks â€” check /api/v3/a11y/remediation</td></tr>}
                {remediation.sort((a, b) => {
                  const pr: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 }
                  return (pr[a.priority] ?? 9) - (pr[b.priority] ?? 9)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'blocked' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.taskId}</Td>
                    <Td mono col={TEXT}>{r.title.slice(0, 45)}{r.title.length > 45 ? 'â€¦' : ''}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.priority === 'p0' ? RED : r.priority === 'p1' ? ORANGE : AMBER, background: (r.priority === 'p0' ? RED : AMBER) + '22', borderRadius: 3, padding: '2px 5px' }}>{r.priority.toUpperCase()}</span></Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td mono col={BLUE}>{r.component || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.assignee || 'â€”'}</Td>
                    <Td right mono col={TEXT}>{r.effortHours}</Td>
                    <Td right mono col={TEXT}>{r.affectedNodes}</Td>
                    <Td mono col={SUBTLE}>{r.targetDate || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'log' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Log ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {logEntries.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No log entries â€” check /api/v3/a11y/log</td></tr>}
                {logEntries.map((e, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{e.logId}</Td>
                    <Td mono col={ORANGE}>{e.action}</Td>
                    <Td mono col={TEXT}>{e.actor}</Td>
                    <Td mono col={SUBTLE}>{e.detail || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{e.timestamp}</Td>
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
