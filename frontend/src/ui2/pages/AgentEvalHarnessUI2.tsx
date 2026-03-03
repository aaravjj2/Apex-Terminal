import React, { useState, useEffect, useCallback } from 'react'
﻿// AgentEvalHarnessUI2 â€” Bloomberg APEX Agent Eval Harness terminal
// LLM agent evaluation, citation recall, keyword scoring, regression tracking
// Tabs: RUNS | CASES | SCORES | REGRESSIONS | AUDIT
// APIs: /api/v3/eval/runs, /cases, /scores, /regressions, /audit

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

interface EvalRun {
  runId: string
  datasetVersion: string
  modelId: string
  caseCount: number
  passedCount: number
  avgRecall: number
  avgKeyword: number
  avgTotal: number
  durationMs: number
  status: 'completed' | 'running' | 'failed' | 'cancelled'
  triggeredBy: string
  createdAt: string
}

interface EvalCase {
  caseId: string
  prompt: string
  category: string
  expectedEvidenceIds: string[]
  expectedKeywords: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  addedAt: string
  lastRunStatus: 'pass' | 'fail' | 'error' | 'untested'
}

interface CaseScore {
  scoreId: string
  runId: string
  caseId: string
  category: string
  citationRecall: number
  keywordScore: number
  totalScore: number
  evidenceReturned: string[]
  evidenceExpected: string[]
  responseAnswer: string
  pass: boolean
}

interface EvalRegression {
  regressionId: string
  caseId: string
  category: string
  prevScore: number
  currScore: number
  changePct: number
  status: 'open' | 'resolved' | 'accepted'
  runId: string
  detectedAt: string
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
  const m: Record<string, string> = { completed: GREEN, running: AMBER, failed: RED, cancelled: SUBTLE, pass: GREEN, fail: RED, error: ORANGE, untested: SUBTLE, open: RED, resolved: GREEN, accepted: PURPLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function DiffBadge({ d }: { d: string }) {
  const m: Record<string, string> = { easy: GREEN, medium: AMBER, hard: RED }
  const c = m[d] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{d.toUpperCase()}</span>
}
function ScoreBar({ v, label }: { v: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, v * 100))
  const col = pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 44, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{(pct).toFixed(0)}{label ?? ''}</span>
    </div>
  )
}


export function AgentEvalHarnessUI2() {
  const [tab, setTab] = useState<'runs' | 'cases' | 'scores' | 'regressions' | 'audit'>('runs')
  const [runs, setRuns] = useState<EvalRun[]>([])
  const [cases, setCases] = useState<EvalCase[]>([])
  const [scores, setScores] = useState<CaseScore[]>([])
  const [regressions, setRegressions] = useState<EvalRegression[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  const fetchAll = useCallback(async () => {
    try {
      const [rR, rC, rS, rRg, rA] = await Promise.allSettled([
        fetch('/api/v3/eval/runs').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/eval/cases').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/eval/scores').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/eval/regressions').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/eval/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.runs ?? rR.value.data ?? []
        setRuns(raw.map((r: any) => ({
          runId: r.run_id ?? r.runId ?? r.id ?? '',
          datasetVersion: r.dataset_version ?? r.datasetVersion ?? '',
          modelId: r.model_id ?? r.modelId ?? '',
          caseCount: Number(r.case_count ?? r.caseCount ?? 0),
          passedCount: Number(r.passed_count ?? r.passedCount ?? 0),
          avgRecall: Number(r.avg_recall ?? r.avgRecall ?? 0),
          avgKeyword: Number(r.avg_keyword ?? r.avgKeyword ?? 0),
          avgTotal: Number(r.avg_total ?? r.avgTotal ?? 0),
          durationMs: Number(r.duration_ms ?? r.durationMs ?? 0),
          status: r.status ?? 'completed', triggeredBy: r.triggered_by ?? r.triggeredBy ?? '',
          createdAt: r.created_at ?? r.createdAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load eval runs')
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.cases ?? rC.value.data ?? []
        setCases(raw.map((c: any) => ({
          caseId: c.case_id ?? c.caseId ?? c.id ?? '',
          prompt: c.prompt ?? '', category: c.category ?? '',
          expectedEvidenceIds: c.expected_evidence_ids ?? c.expectedEvidenceIds ?? [],
          expectedKeywords: c.expected_keywords ?? c.expectedKeywords ?? [],
          difficulty: c.difficulty ?? 'medium',
          addedAt: c.added_at ?? c.addedAt ?? '',
          lastRunStatus: c.last_run_status ?? c.lastRunStatus ?? 'untested',
        })))
      }
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.scores ?? rS.value.data ?? []
        setScores(raw.map((s: any) => ({
          scoreId: s.score_id ?? s.scoreId ?? '', runId: s.run_id ?? s.runId ?? '',
          caseId: s.case_id ?? s.caseId ?? '', category: s.category ?? '',
          citationRecall: Number(s.citation_recall ?? s.citationRecall ?? 0),
          keywordScore: Number(s.keyword_score ?? s.keywordScore ?? 0),
          totalScore: Number(s.total_score ?? s.totalScore ?? 0),
          evidenceReturned: s.evidence_returned ?? s.evidenceReturned ?? [],
          evidenceExpected: s.evidence_expected ?? s.evidenceExpected ?? [],
          responseAnswer: s.response_answer ?? s.responseAnswer ?? '',
          pass: Boolean(s.pass ?? s.totalScore >= 0.5),
        })))
      }
      if (rRg.status === 'fulfilled') {
        const raw = Array.isArray(rRg.value) ? rRg.value : rRg.value.regressions ?? rRg.value.data ?? []
        setRegressions(raw.map((r: any) => ({
          regressionId: r.regression_id ?? r.regressionId ?? '',
          caseId: r.case_id ?? r.caseId ?? '', category: r.category ?? '',
          prevScore: Number(r.prev_score ?? r.prevScore ?? 0),
          currScore: Number(r.curr_score ?? r.currScore ?? 0),
          changePct: Number(r.change_pct ?? r.changePct ?? 0),
          status: r.status ?? 'open', runId: r.run_id ?? r.runId ?? '',
          detectedAt: r.detected_at ?? r.detectedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', action: a.action ?? '',
          actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const handleRun = useCallback(async () => {
    setRunStatus('running')
    try {
      const r = await fetch('/api/v3/eval', { method: 'POST' })
      if (r.ok) { setRunStatus('done'); setTimeout(fetchAll, 2000) }
      else setRunStatus('error')
    } catch { setRunStatus('error') }
    finally { setTimeout(() => setRunStatus('idle'), 5000) }
  }, [fetchAll])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const latestRun = runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const openRegressions = regressions.filter(r => r.status === 'open').length
  const passRate = scores.length ? (scores.filter(s => s.pass).length / scores.length * 100).toFixed(1) : 'â€”'
  const avgTotal = runs.length ? (runs.reduce((s, r) => s + r.avgTotal, 0) / runs.length).toFixed(3) : 'â€”'

  const TABS2 = [
    { id: 'runs' as const, label: 'RUNS' },
    { id: 'cases' as const, label: 'CASES' },
    { id: 'scores' as const, label: 'SCORES' },
    { id: 'regressions' as const, label: 'REGRESSIONS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AGENT EVAL HARNESS â€” CITATION RECALL + KEYWORD SCORING + REGRESSION TRACKING</span>
        {openRegressions > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {openRegressions} REGRESSIONS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
        <button onClick={handleRun} disabled={runStatus === 'running'} style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, fontWeight: 700, background: AMBER + '22', border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 3, padding: '5px 14px', cursor: runStatus === 'running' ? 'wait' : 'pointer' }}>
          {runStatus === 'running' ? 'RUNNINGâ€¦' : runStatus === 'done' ? 'RUN DONE âœ“' : runStatus === 'error' ? 'ERROR' : 'RUN EVAL'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Runs" value={runs.length} col={BLUE} />
        <StatCard label="Avg Total Score" value={avgTotal} col={latestRun && latestRun.avgTotal >= 0.8 ? GREEN : ORANGE} />
        <StatCard label="Pass Rate" value={passRate !== 'â€”' ? `${passRate}%` : 'â€”'} col={GREEN} />
        <StatCard label="Test Cases" value={cases.length} col={PURPLE} />
        <StatCard label="Open Regressions" value={openRegressions} col={openRegressions > 0 ? RED : GREEN} />
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
        {tab === 'runs' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Run ID</Th><Th>Dataset Ver.</Th><Th>Model ID</Th><Th>Status</Th><Th right>Cases</Th><Th right>Passed</Th><Th>Avg Recall</Th><Th>Avg Keyword</Th><Th>Avg Total</Th><Th>Created</Th></tr></thead>
              <tbody>
                {runs.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No eval runs â€” check /api/v3/eval/runs or trigger one</td></tr>}
                {runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'failed' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.runId}</Td>
                    <Td mono col={TEXT}>{r.datasetVersion}</Td>
                    <Td mono col={BLUE}>{r.modelId || 'â€”'}</Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td right mono col={TEXT}>{r.caseCount}</Td>
                    <Td right mono col={r.passedCount === r.caseCount ? GREEN : AMBER}>{r.passedCount}</Td>
                    <Td><ScoreBar v={r.avgRecall} /></Td>
                    <Td><ScoreBar v={r.avgKeyword} /></Td>
                    <Td><ScoreBar v={r.avgTotal} /></Td>
                    <Td mono col={SUBTLE}>{r.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'cases' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Case ID</Th><Th>Category</Th><Th>Difficulty</Th><Th>Last Status</Th><Th right>Keywords</Th><Th right>Evidence</Th><Th>Prompt</Th><Th>Added</Th></tr></thead>
              <tbody>
                {cases.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No eval cases â€” check /api/v3/eval/cases</td></tr>}
                {cases.sort((a, b) => a.lastRunStatus === 'fail' ? -1 : 0).map((c, i) => (
                  <tr key={i} style={{ background: c.lastRunStatus === 'fail' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{c.caseId}</Td>
                    <Td mono col={PURPLE}>{c.category}</Td>
                    <Td><DiffBadge d={c.difficulty} /></Td>
                    <Td><StatusBadge s={c.lastRunStatus} /></Td>
                    <Td right mono col={TEXT}>{c.expectedKeywords.length}</Td>
                    <Td right mono col={TEXT}>{c.expectedEvidenceIds.length}</Td>
                    <Td mono col={SUBTLE}>{c.prompt.slice(0, 55)}{c.prompt.length > 55 ? 'â€¦' : ''}</Td>
                    <Td mono col={SUBTLE}>{c.addedAt || 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'scores' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Score ID</Th><Th>Run ID</Th><Th>Case ID</Th><Th>Category</Th><Th>Pass</Th><Th>Recall</Th><Th>Keyword</Th><Th>Total</Th><Th>Answer</Th></tr></thead>
              <tbody>
                {scores.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No scores â€” check /api/v3/eval/scores</td></tr>}
                {scores.sort((a, b) => a.pass ? 1 : -1).map((s, i) => (
                  <tr key={i} style={{ background: !s.pass ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.scoreId}</Td>
                    <Td mono col={BLUE}>{s.runId.slice(0, 12)}</Td>
                    <Td mono col={TEXT}>{s.caseId}</Td>
                    <Td mono col={PURPLE}>{s.category}</Td>
                    <Td mono col={s.pass ? GREEN : RED}>{s.pass ? 'âœ“ PASS' : 'âœ— FAIL'}</Td>
                    <Td><ScoreBar v={s.citationRecall} /></Td>
                    <Td><ScoreBar v={s.keywordScore} /></Td>
                    <Td><ScoreBar v={s.totalScore} /></Td>
                    <Td mono col={SUBTLE}>{s.responseAnswer.slice(0, 40)}{s.responseAnswer.length > 40 ? 'â€¦' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'regressions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Regression ID</Th><Th>Case ID</Th><Th>Category</Th><Th>Status</Th><Th right>Prev Score</Th><Th right>Curr Score</Th><Th right>Î”%</Th><Th>Run ID</Th><Th>Detected</Th></tr></thead>
              <tbody>
                {regressions.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regressions â€” check /api/v3/eval/regressions</td></tr>}
                {regressions.sort((a, b) => a.status === 'open' ? -1 : 0).map((r, i) => (
                  <tr key={i} style={{ background: r.status === 'open' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.regressionId}</Td>
                    <Td mono col={BLUE}>{r.caseId}</Td>
                    <Td mono col={PURPLE}>{r.category}</Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td right mono col={TEXT}>{(r.prevScore * 100).toFixed(1)}</Td>
                    <Td right mono col={RED}>{(r.currScore * 100).toFixed(1)}</Td>
                    <Td right mono col={r.changePct < 0 ? RED : GREEN}>{r.changePct > 0 ? '+' : ''}{r.changePct.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{r.runId.slice(0, 12)}</Td>
                    <Td mono col={SUBTLE}>{r.detectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit entries â€” check /api/v3/eval/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
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
