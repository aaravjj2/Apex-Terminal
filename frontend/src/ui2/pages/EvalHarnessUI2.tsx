import React, { useState, useEffect, useCallback } from 'react'
﻿// EvalHarnessUI2 â€” Bloomberg EVLH model evaluation harness terminal
// Benchmark suites, test results, regression detection, model comparisons, eval history
// Tabs: BENCHMARKS | TEST SUITES | REGRESSION | COMPARISONS | HISTORY
// APIs: /api/v4/eval-harness/benchmarks, /suites, /regression, /comparisons, /history

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

interface BenchmarkResult {
  benchmarkId: string
  benchmarkName: string
  modelId: string
  modelName: string
  metric: string
  score: number
  baseline: number
  changeVsBaseline: number
  rank: number
  totalModels: number
  runDate: string
  status: 'pass' | 'fail' | 'regression' | 'improvement'
  dataset: string
}

interface TestSuite {
  suiteId: string
  suiteName: string
  category: string
  totalTests: number
  passed: number
  failed: number
  skipped: number
  errorCount: number
  duration: number
  lastRun: string
  coverage: number
  tags: string[]
}

interface RegressionEntry {
  regId: string
  modelId: string
  metric: string
  previousValue: number
  currentValue: number
  changePct: number
  severity: 'critical' | 'major' | 'minor'
  detectedAt: string
  baseline: string
  current: string
  acknowledged: boolean
  rootCause: string
}

interface ModelComparison {
  compId: string
  modelA: string
  modelAVersion: string
  modelB: string
  modelBVersion: string
  metric: string
  scoreA: number
  scoreB: number
  winner: 'A' | 'B' | 'tie'
  delta: number
  significance: number
  dataset: string
  testedBy: string
}

interface EvalHistoryEntry {
  runId: string
  modelId: string
  modelVersion: string
  suite: string
  score: number
  passPct: number
  regressions: number
  improvements: number
  runDate: string
  triggeredBy: string
  duration: number
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
function ProgressBar({ passed, failed, total }: { passed: number; failed: number; total: number }) {
  const pPct = total > 0 ? (passed / total) * 100 : 0
  const fPct = total > 0 ? (failed / total) * 100 : 0
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <div style={{ width: 80, height: 5, background: BORDER, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
        <div style={{ height: '100%', width: `${pPct}%`, background: GREEN }} />
        <div style={{ height: '100%', width: `${fPct}%`, background: RED }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>{passed}/{total}</span>
    </div>
  )
}
function StatusBadge2({ s }: { s: string }) {
  const m: Record<string, string> = { pass: GREEN, fail: RED, regression: ORANGE, improvement: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SeverityBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, major: ORANGE, minor: AMBER }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}


export function EvalHarnessUI2() {
  const [tab, setTab] = useState<'benchmarks' | 'suites' | 'regression' | 'comparisons' | 'history'>('benchmarks')
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([])
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [regression, setRegression] = useState<RegressionEntry[]>([])
  const [comparisons, setComparisons] = useState<ModelComparison[]>([])
  const [history, setHistory] = useState<EvalHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rB, rS, rR, rC, rH] = await Promise.allSettled([
        fetch('/api/v4/eval-harness/benchmarks').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/eval-harness/suites').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/eval-harness/regression').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/eval-harness/comparisons').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/eval-harness/history').then(r => r.ok ? r.json() : []),
      ])
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.benchmarks ?? rB.value.data ?? []
        setBenchmarks(raw.map((b: any) => ({
          benchmarkId: b.benchmark_id ?? b.benchmarkId ?? '', benchmarkName: b.benchmark_name ?? b.benchmarkName ?? '',
          modelId: b.model_id ?? b.modelId ?? '', modelName: b.model_name ?? b.modelName ?? '',
          metric: b.metric ?? '', score: Number(b.score ?? 0), baseline: Number(b.baseline ?? 0),
          changeVsBaseline: Number(b.change_vs_baseline ?? b.changeVsBaseline ?? 0),
          rank: Number(b.rank ?? 0), totalModels: Number(b.total_models ?? b.totalModels ?? 0),
          runDate: b.run_date ?? b.runDate ?? '', status: b.status ?? 'pass', dataset: b.dataset ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load benchmarks')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.suites ?? rS.value.data ?? []
        setSuites(raw.map((s: any) => ({
          suiteId: s.suite_id ?? s.suiteId ?? '', suiteName: s.suite_name ?? s.suiteName ?? '',
          category: s.category ?? '', totalTests: Number(s.total_tests ?? s.totalTests ?? 0),
          passed: Number(s.passed ?? 0), failed: Number(s.failed ?? 0), skipped: Number(s.skipped ?? 0),
          errorCount: Number(s.error_count ?? s.errorCount ?? 0), duration: Number(s.duration ?? 0),
          lastRun: s.last_run ?? s.lastRun ?? '', coverage: Number(s.coverage ?? 0),
          tags: Array.isArray(s.tags) ? s.tags : [],
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.regression ?? rR.value.data ?? []
        setRegression(raw.map((r: any) => ({
          regId: r.reg_id ?? r.regId ?? '', modelId: r.model_id ?? r.modelId ?? '', metric: r.metric ?? '',
          previousValue: Number(r.previous_value ?? r.previousValue ?? 0), currentValue: Number(r.current_value ?? r.currentValue ?? 0),
          changePct: Number(r.change_pct ?? r.changePct ?? 0), severity: r.severity ?? 'minor',
          detectedAt: r.detected_at ?? r.detectedAt ?? '', baseline: r.baseline ?? '', current: r.current ?? '',
          acknowledged: Boolean(r.acknowledged ?? false), rootCause: r.root_cause ?? r.rootCause ?? '',
        })))
      }
      if (rC.status === 'fulfilled') {
        const raw = Array.isArray(rC.value) ? rC.value : rC.value.comparisons ?? rC.value.data ?? []
        setComparisons(raw.map((c: any) => ({
          compId: c.comp_id ?? c.compId ?? '', modelA: c.model_a ?? c.modelA ?? '',
          modelAVersion: c.model_a_version ?? c.modelAVersion ?? '', modelB: c.model_b ?? c.modelB ?? '',
          modelBVersion: c.model_b_version ?? c.modelBVersion ?? '', metric: c.metric ?? '',
          scoreA: Number(c.score_a ?? c.scoreA ?? 0), scoreB: Number(c.score_b ?? c.scoreB ?? 0),
          winner: c.winner ?? 'tie', delta: Number(c.delta ?? 0), significance: Number(c.significance ?? 0),
          dataset: c.dataset ?? '', testedBy: c.tested_by ?? c.testedBy ?? '',
        })))
      }
      if (rH.status === 'fulfilled') {
        const raw = Array.isArray(rH.value) ? rH.value : rH.value.history ?? rH.value.data ?? []
        setHistory(raw.map((h: any) => ({
          runId: h.run_id ?? h.runId ?? '', modelId: h.model_id ?? h.modelId ?? '',
          modelVersion: h.model_version ?? h.modelVersion ?? '', suite: h.suite ?? '',
          score: Number(h.score ?? 0), passPct: Number(h.pass_pct ?? h.passPct ?? 0),
          regressions: Number(h.regressions ?? 0), improvements: Number(h.improvements ?? 0),
          runDate: h.run_date ?? h.runDate ?? '', triggeredBy: h.triggered_by ?? h.triggeredBy ?? '',
          duration: Number(h.duration ?? 0),
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const failedBenchmarks = benchmarks.filter(b => b.status === 'fail' || b.status === 'regression').length
  const criticalRegressions = regression.filter(r => r.severity === 'critical' && !r.acknowledged).length
  const failingSuites = suites.filter(s => s.failed > 0).length
  const totalRegressions = regression.filter(r => !r.acknowledged).length

  const TABS = [
    { id: 'benchmarks' as const, label: 'BENCHMARKS' },
    { id: 'suites' as const, label: 'TEST SUITES' },
    { id: 'regression' as const, label: 'REGRESSION' },
    { id: 'comparisons' as const, label: 'COMPARISONS' },
    { id: 'history' as const, label: 'HISTORY' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>EVLH</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>EVAL HARNESS â€” BENCHMARKS + TEST SUITES + REGRESSION DETECTION + MODEL COMPARISONS</span>
        {criticalRegressions > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>âš‘ {criticalRegressions} CRITICAL REGRESSIONS</span>}
        {failedBenchmarks > 0 && <span style={{ fontSize: 10, color: ORANGE, fontWeight: 700 }}>âš‘ {failedBenchmarks} BENCHMARK FAILURES</span>}
        {failingSuites > 0 && <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>âš‘ {failingSuites} SUITES WITH FAILURES</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Benchmarks" value={benchmarks.length} col={BLUE} />
        <StatCard label="Failures" value={failedBenchmarks} col={failedBenchmarks > 0 ? RED : GREEN} />
        <StatCard label="Test Suites" value={suites.length} col={PURPLE} />
        <StatCard label="Regressions" value={totalRegressions} col={totalRegressions > 0 ? ORANGE : GREEN} />
        <StatCard label="Active Comparisons" value={comparisons.length} col={TEXT} />
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: tab === t.id ? AMBER : SUBTLE, background: tab === t.id ? '#0d0d0d' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? AMBER : 'transparent'}`, padding: '9px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {tab === 'benchmarks' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Benchmark</Th><Th>Model</Th><Th>Metric</Th><Th>Status</Th><Th right>Score</Th><Th right>Baseline</Th><Th right>Î” Baseline</Th><Th right>Rank</Th><Th>Dataset</Th><Th>Run Date</Th></tr></thead>
              <tbody>
                {benchmarks.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No benchmarks â€” check /api/v4/eval-harness/benchmarks</td></tr>}
                {benchmarks.sort((a, b) => {
                  const ord: Record<string, number> = { fail: 0, regression: 1, pass: 2, improvement: 3 }
                  return (ord[a.status] ?? 4) - (ord[b.status] ?? 4)
                }).map((b, i) => (
                  <tr key={i} style={{ background: b.status === 'regression' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.benchmarkName}</Td>
                    <Td mono col={BLUE}>{b.modelName}</Td>
                    <Td mono col={SUBTLE}>{b.metric}</Td>
                    <Td><StatusBadge2 s={b.status} /></Td>
                    <Td right mono col={b.score >= b.baseline ? GREEN : RED}>{b.score.toFixed(4)}</Td>
                    <Td right mono col={SUBTLE}>{b.baseline.toFixed(4)}</Td>
                    <Td right mono col={b.changeVsBaseline >= 0 ? GREEN : RED}>{b.changeVsBaseline >= 0 ? '+' : ''}{b.changeVsBaseline.toFixed(2)}%</Td>
                    <Td right mono col={b.rank <= 3 ? GREEN : TEXT}>#{b.rank}/{b.totalModels}</Td>
                    <Td mono col={SUBTLE}>{b.dataset}</Td>
                    <Td mono col={SUBTLE}>{b.runDate}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'suites' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Suite Name</Th><Th>Category</Th><Th>Results</Th><Th right>Total</Th><Th right>Failures</Th><Th right>Coverage %</Th><Th right>Duration (s)</Th><Th>Last Run</Th></tr></thead>
              <tbody>
                {suites.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No suites â€” check /api/v4/eval-harness/suites</td></tr>}
                {suites.sort((a, b) => b.failed - a.failed).map((s, i) => (
                  <tr key={i} style={{ background: s.failed > 0 ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{s.suiteName}</Td>
                    <Td mono col={BLUE}>{s.category}</Td>
                    <Td><ProgressBar passed={s.passed} failed={s.failed} total={s.totalTests} /></Td>
                    <Td right mono col={TEXT}>{s.totalTests.toLocaleString()}</Td>
                    <Td right mono col={s.failed > 0 ? RED : GREEN}>{s.failed.toLocaleString()}</Td>
                    <Td right mono col={s.coverage < 70 ? RED : s.coverage < 85 ? AMBER : GREEN}>{s.coverage.toFixed(1)}%</Td>
                    <Td right mono col={SUBTLE}>{s.duration.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{s.lastRun}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'regression' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Model</Th><Th>Metric</Th><Th>Severity</Th><Th right>Previous</Th><Th right>Current</Th><Th right>Î” %</Th><Th>Acked</Th><Th>Root Cause</Th><Th>Detected</Th></tr></thead>
              <tbody>
                {regression.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regressions â€” check /api/v4/eval-harness/regression</td></tr>}
                {regression.sort((a, b) => {
                  const ord: Record<string, number> = { critical: 0, major: 1, minor: 2 }
                  return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3)
                }).map((r, i) => (
                  <tr key={i} style={{ background: r.severity === 'critical' && !r.acknowledged ? RED + '0a' : 'transparent', opacity: r.acknowledged ? 0.6 : 1 }}>
                    <Td mono col={AMBER}>{r.modelId}</Td>
                    <Td mono col={BLUE}>{r.metric}</Td>
                    <Td><SeverityBadge s={r.severity} /></Td>
                    <Td right mono col={SUBTLE}>{r.previousValue.toFixed(4)}</Td>
                    <Td right mono col={RED}>{r.currentValue.toFixed(4)}</Td>
                    <Td right mono col={r.changePct < 0 ? RED : GREEN}>{r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.acknowledged ? GREEN : RED }}>{r.acknowledged ? 'ACKED' : 'OPEN'}</span></Td>
                    <Td mono col={SUBTLE} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{r.rootCause || 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{r.detectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'comparisons' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Model A</Th><Th>Model B</Th><Th>Metric</Th><Th right>Score A</Th><Th right>Score B</Th><Th>Winner</Th><Th right>Delta</Th><Th right>Significance</Th><Th>Dataset</Th></tr></thead>
              <tbody>
                {comparisons.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No comparisons â€” check /api/v4/eval-harness/comparisons</td></tr>}
                {comparisons.map((c, i) => (
                  <tr key={i}>
                    <Td mono col={c.winner === 'A' ? GREEN : TEXT}>{c.modelA} <span style={{ color: SUBTLE, fontSize: 9 }}>v{c.modelAVersion}</span></Td>
                    <Td mono col={c.winner === 'B' ? GREEN : TEXT}>{c.modelB} <span style={{ color: SUBTLE, fontSize: 9 }}>v{c.modelBVersion}</span></Td>
                    <Td mono col={BLUE}>{c.metric}</Td>
                    <Td right mono col={c.winner === 'A' ? GREEN : TEXT}>{c.scoreA.toFixed(4)}</Td>
                    <Td right mono col={c.winner === 'B' ? GREEN : TEXT}>{c.scoreB.toFixed(4)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c.winner === 'tie' ? AMBER : GREEN }}>{c.winner === 'A' ? c.modelA : c.winner === 'B' ? c.modelB : 'TIE'}</span></Td>
                    <Td right mono col={Math.abs(c.delta) > 0.05 ? ORANGE : SUBTLE}>{c.delta >= 0 ? '+' : ''}{c.delta.toFixed(4)}</Td>
                    <Td right mono col={c.significance < 0.05 ? GREEN : AMBER}>p={c.significance.toFixed(3)}</Td>
                    <Td mono col={SUBTLE}>{c.dataset}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'history' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Model</Th><Th>Version</Th><Th>Suite</Th><Th right>Score</Th><Th right>Pass %</Th><Th right>Regressions</Th><Th right>Improvements</Th><Th>Triggered By</Th><Th right>Duration (s)</Th><Th>Date</Th></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No history â€” check /api/v4/eval-harness/history</td></tr>}
                {history.map((h, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{h.modelId}</Td>
                    <Td mono col={SUBTLE}>{h.modelVersion}</Td>
                    <Td mono col={BLUE}>{h.suite}</Td>
                    <Td right mono col={h.score >= 0.9 ? GREEN : h.score >= 0.7 ? AMBER : RED}>{h.score.toFixed(4)}</Td>
                    <Td right mono col={h.passPct >= 95 ? GREEN : h.passPct >= 80 ? AMBER : RED}>{h.passPct.toFixed(1)}%</Td>
                    <Td right mono col={h.regressions > 0 ? RED : GREEN}>{h.regressions}</Td>
                    <Td right mono col={h.improvements > 0 ? GREEN : SUBTLE}>{h.improvements}</Td>
                    <Td mono col={SUBTLE}>{h.triggeredBy}</Td>
                    <Td right mono col={SUBTLE}>{h.duration.toFixed(1)}</Td>
                    <Td mono col={SUBTLE}>{h.runDate}</Td>
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
