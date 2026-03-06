import React, { useState, useEffect, useCallback } from 'react'
// AgentEvalHarnessUI2 - Bloomberg APEX Agent Eval Harness
// LLM agent evaluation, citation recall, keyword scoring
// APIs: /api/v3/eval/dataset, /api/v3/eval/run, /api/v3/eval/runs

const BG = '#0a0a0a'
const PANEL = '#111111'
const BORDER = '#1e1e1e'
const AMBER = '#f5a623'
const GREEN = '#26a69a'
const RED = '#ef5350'
const BLUE = '#42a5f5'
const PURPLE = '#ab47bc'
const SUBTLE = '#555'
const TEXT = '#d1d4dc'
const MONO = '"Roboto Mono","Courier New",monospace'

interface DatasetCase {
  id: string
  prompt: string
  category: string
  expected_evidence_ids: string[]
  expected_keywords: string[]
  difficulty: string
}

interface ScoreRow {
  case_id: string
  caseId?: string
  citation_recall: number
  keyword_score: number
  total_score: number
  response_answer?: string
  agent_answer?: string
  pass: boolean
}

interface EvalRun {
  run_id: string
  case_count: number
  avg_recall: number
  avg_keyword: number
  avg_total: number
  scores: ScoreRow[]
  created_at?: string
}

function StatCard({ label, value, col }: { label: string; value: string | number; col?: string }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
      <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color: col || TEXT }}>{value}</div>
    </div>
  )
}

function ScoreBar({ v }: { v: number }) {
  const pct = Math.min(100, Math.max(0, v * 100))
  const col = pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: col, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: MONO, color: col, minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

export function AgentEvalHarnessUI2() {
  const [cases, setCases] = useState<DatasetCase[]>([])
  const [latestRun, setLatestRun] = useState<EvalRun | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [drawerCase, setDrawerCase] = useState<{ caseId: string; score: ScoreRow } | null>(null)

  const fetchDataset = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/v3/eval/dataset')
      if (r.ok) {
        const d = await r.json()
        setCases(d.cases ?? [])
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const handleRun = useCallback(async () => {
    setRunStatus('running'); setErr(null)
    try {
      const r = await fetch('/api/v3/eval/run', { method: 'POST' })
      if (r.ok) {
        const d = await r.json()
        setLatestRun(d)
        setRunStatus('done')
      } else {
        const e = await r.json()
        setErr(e.detail ?? 'Eval run failed')
        setRunStatus('error')
      }
    } catch (e: any) { setErr(e.message); setRunStatus('error') }
  }, [])

  useEffect(() => { fetchDataset() }, [fetchDataset])

  const passCount = latestRun ? latestRun.scores.filter(s => s.pass).length : 0

  return (
    <div data-testid="agent-eval-page" style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AGENT EVAL HARNESS - LLM CITATION RECALL + KEYWORD SCORING</span>
        {runStatus === 'running' && <span style={{ fontSize: 10, color: AMBER }}>RUNNING EVAL...</span>}
        {runStatus === 'done' && <span style={{ fontSize: 10, color: GREEN }}>EVAL COMPLETE</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>! {err}</span>}
        {loading && <span style={{ fontSize: 10, color: SUBTLE }}>LOADING DATASET...</span>}
        <button data-testid="run-eval-btn" onClick={handleRun} disabled={runStatus === 'running'}
          style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: runStatus === 'running' ? SUBTLE : AMBER, background: (runStatus === 'running' ? SUBTLE : AMBER) + '22', border: `1px solid ${runStatus === 'running' ? SUBTLE : AMBER}44`, borderRadius: 3, padding: '5px 14px', cursor: runStatus === 'running' ? 'wait' : 'pointer' }}>
          {runStatus === 'running' ? 'RUNNING...' : 'RUN EVAL'}
        </button>
      </div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Dataset Cases" value={cases.length} col={BLUE} />
        <StatCard label="Avg Total Score" value={latestRun ? (latestRun.avg_total * 100).toFixed(1) + '%' : '-'} col={latestRun ? (latestRun.avg_total >= 0.8 ? GREEN : AMBER) : SUBTLE} />
        <StatCard label="Avg Recall" value={latestRun ? (latestRun.avg_recall * 100).toFixed(1) + '%' : '-'} col={PURPLE} />
        <StatCard label="Pass Count" value={latestRun ? passCount + '/' + latestRun.case_count : '-'} col={GREEN} />
        <StatCard label="Run Status" value={runStatus.toUpperCase()} col={runStatus === 'done' ? GREEN : runStatus === 'error' ? RED : AMBER} />
      </div>
      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Dataset Table */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Eval Dataset</div>
          <table data-testid="eval-dataset-table" style={{ width: '100%', borderCollapse: 'collapse', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4 }}>
            <thead>
              <tr>
                <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>ID</th>
                <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Category</th>
                <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Difficulty</th>
                <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Prompt</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>Loading dataset...</td></tr>
              )}
              {cases.map(c => (
                <tr key={c.id} data-testid={`eval-case-row-${c.id}`}>
                  <td style={{ fontFamily: MONO, fontSize: 11, color: AMBER, padding: '5px 10px', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{c.id}</td>
                  <td style={{ fontFamily: MONO, fontSize: 11, color: TEXT, padding: '5px 10px', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{c.category}</td>
                  <td style={{ fontFamily: MONO, fontSize: 11, color: c.difficulty === 'hard' ? RED : c.difficulty === 'medium' ? AMBER : GREEN, padding: '5px 10px', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{c.difficulty}</td>
                  <td style={{ fontSize: 11, color: SUBTLE, padding: '5px 10px', borderBottom: `1px solid #161616`, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.prompt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Scores Table - shown after run */}
        {latestRun && (
          <div>
            <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Eval Scores - Run {latestRun.run_id}
            </div>
            <table data-testid="eval-scores-table" style={{ width: '100%', borderCollapse: 'collapse', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4 }}>
              <thead>
                <tr>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Case ID</th>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Citation Recall</th>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Keyword Score</th>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Pass</th>
                  <th style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${BORDER}`, background: '#0d0d0d', whiteSpace: 'nowrap' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {latestRun.scores.map(score => {
                  const caseId = score.case_id ?? score.caseId ?? ''
                  return (
                    <tr key={caseId} data-testid={`score-row-${caseId}`}>
                      <td style={{ fontFamily: MONO, fontSize: 11, color: AMBER, padding: '5px 10px', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{caseId}</td>
                      <td style={{ padding: '5px 10px', borderBottom: `1px solid #161616`, minWidth: 120 }}><ScoreBar v={score.citation_recall} /></td>
                      <td style={{ padding: '5px 10px', borderBottom: `1px solid #161616`, minWidth: 120 }}><ScoreBar v={score.keyword_score} /></td>
                      <td style={{ padding: '5px 10px', borderBottom: `1px solid #161616`, minWidth: 120 }}><ScoreBar v={score.total_score} /></td>
                      <td style={{ fontFamily: MONO, fontSize: 11, color: score.pass ? GREEN : RED, padding: '5px 10px', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>{score.pass ? 'PASS' : 'FAIL'}</td>
                      <td style={{ padding: '5px 10px', borderBottom: `1px solid #161616`, whiteSpace: 'nowrap' }}>
                        <button data-testid={`inspect-case-btn-${caseId}`} onClick={() => setDrawerCase({ caseId, score })}
                          style={{ fontFamily: MONO, fontSize: 10, color: BLUE, background: BLUE + '11', border: `1px solid ${BLUE}44`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
                          INSPECT
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Case Detail Drawer */}
      {drawerCase && (
        <div data-testid="case-detail-drawer"
          style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100%', background: '#0d0d0d', borderLeft: `1px solid ${BORDER}`, zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: AMBER }}>CASE: {drawerCase.caseId}</span>
            <button data-testid="drawer-close-btn" onClick={() => setDrawerCase(null)}
              style={{ fontFamily: MONO, fontSize: 11, color: SUBTLE, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
              CLOSE
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Agent Answer</div>
              <div data-testid="drawer-answer"
                style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '10px 12px', lineHeight: 1.6 }}>
                {drawerCase.score.response_answer ?? drawerCase.score.agent_answer ?? '(no answer recorded)'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, marginBottom: 4 }}>Citation Recall</div>
                <ScoreBar v={drawerCase.score.citation_recall} />
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, marginBottom: 4 }}>Keyword Score</div>
                <ScoreBar v={drawerCase.score.keyword_score} />
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, marginBottom: 4 }}>Total Score</div>
                <ScoreBar v={drawerCase.score.total_score} />
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: drawerCase.score.pass ? GREEN : RED }}>
              {drawerCase.score.pass ? 'PASS' : 'FAIL'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
