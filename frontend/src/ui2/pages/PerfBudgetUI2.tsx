import React, { useState, useEffect, useCallback } from 'react'
﻿// PerfBudgetUI2 — Bloomberg APEX Performance Budget terminal
// Web perf metrics, Playwright sampling, Core Web Vitals budgets, regression analysis
// Tabs: SAMPLES | BUDGETS | REGRESSIONS | TRENDS | AUDIT
// APIs: /api/v3/perf/samples, /budgets, /regressions, /trends, /audit

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

interface PerfSample {
  sampleId: string
  pageId: string
  pageUrl: string
  sampledAt: string
  fcpMs: number | null
  lcpMs: number | null
  clsScore: number | null
  inpMs: number | null
  tbtMs: number | null
  domContentLoadedMs: number | null
  loadTimeMs: number | null
  ttfbMs: number | null
  bundleSizeKb: number | null
  budgetPassed: boolean
  violations: Array<{ metric: string; value: number; budget: number }>
}

interface PerfBudget {
  budgetId: string
  pageId: string
  metricName: string
  budgetMs: number | null
  budgetScore: number | null
  budgetKb: number | null
  status: 'active' | 'draft' | 'disabled'
  violationCount: number
  lastViolatedAt: string
}

interface PerfRegression {
  regressionId: string
  pageId: string
  metricName: string
  prevValue: number
  currValue: number
  changePct: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'investigating' | 'fixed' | 'accepted'
  detectedAt: string
  buildId: string
}

interface PerfTrend {
  pageId: string
  metricName: string
  p50: number
  p75: number
  p95: number
  p99: number
  trend: 'improving' | 'stable' | 'degrading'
  sampleCount: number
  period: string
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
  const m: Record<string, string> = { active: GREEN, draft: BLUE, disabled: SUBTLE, open: RED, investigating: AMBER, fixed: GREEN, accepted: PURPLE, improving: GREEN, stable: BLUE, degrading: RED }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function SevBadge({ s }: { s: string }) {
  const m: Record<string, string> = { critical: RED, high: ORANGE, medium: AMBER, low: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function Ms({ v }: { v: number | null }) {
  if (v === null) return <span style={{ color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>—</span>
  const col = v > 4000 ? RED : v > 2500 ? ORANGE : v > 1000 ? AMBER : GREEN
  return <span style={{ color: col, fontFamily: MONO, fontSize: 11 }}>{v.toFixed(0)}</span>
}


export function PerfBudgetUI2() {
  const [tab, setTab] = useState<'samples' | 'budgets' | 'regressions' | 'trends' | 'audit'>('samples')
  const [samples, setSamples] = useState<PerfSample[]>([])
  const [budgets, setBudgets] = useState<PerfBudget[]>([])
  const [regressions, setRegressions] = useState<PerfRegression[]>([])
  const [trends, setTrends] = useState<PerfTrend[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rS, rB, rR, rT, rA] = await Promise.allSettled([
        fetch('/api/v3/perf/samples').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/perf/budgets').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/perf/regressions').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/perf/trends').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/perf/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.samples ?? rS.value.data ?? []
        setSamples(raw.map((s: any) => ({
          sampleId: s.id ?? s.sample_id ?? s.sampleId ?? '',
          pageId: s.page_id ?? s.pageId ?? '', pageUrl: s.page_url ?? s.pageUrl ?? '',
          sampledAt: s.sampled_at ?? s.sampledAt ?? s.timestamp ?? '',
          fcpMs: s.fcp_ms ?? s.fcpMs ?? null, lcpMs: s.lcp_ms ?? s.lcpMs ?? null,
          clsScore: s.cls_score ?? s.clsScore ?? null, inpMs: s.inp_ms ?? s.inpMs ?? null,
          tbtMs: s.tbt_ms ?? s.tbtMs ?? null,
          domContentLoadedMs: s.dom_content_loaded_ms ?? s.domContentLoadedMs ?? null,
          loadTimeMs: s.load_time_ms ?? s.loadTimeMs ?? null,
          ttfbMs: s.ttfb_ms ?? s.ttfbMs ?? null,
          bundleSizeKb: s.bundle_size_kb ?? s.bundleSizeKb ?? null,
          budgetPassed: Boolean(s.budget_passed ?? s.budgetPassed ?? true),
          violations: s.violations ?? [],
        })))
        setErr(null)
      } else setErr('Failed to load perf samples')
      if (rB.status === 'fulfilled') {
        const raw = Array.isArray(rB.value) ? rB.value : rB.value.budgets ?? rB.value.data ?? []
        setBudgets(raw.map((b: any) => ({
          budgetId: b.budget_id ?? b.budgetId ?? b.id ?? '',
          pageId: b.page_id ?? b.pageId ?? '', metricName: b.metric_name ?? b.metricName ?? b.metric ?? '',
          budgetMs: b.budget_ms ?? b.budgetMs ?? null, budgetScore: b.budget_score ?? b.budgetScore ?? null,
          budgetKb: b.budget_kb ?? b.budgetKb ?? null, status: b.status ?? 'active',
          violationCount: Number(b.violation_count ?? b.violationCount ?? 0),
          lastViolatedAt: b.last_violated_at ?? b.lastViolatedAt ?? '',
        })))
      }
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.regressions ?? rR.value.data ?? []
        setRegressions(raw.map((r: any) => ({
          regressionId: r.regression_id ?? r.regressionId ?? '', pageId: r.page_id ?? r.pageId ?? '',
          metricName: r.metric_name ?? r.metricName ?? '',
          prevValue: Number(r.prev_value ?? r.prevValue ?? 0), currValue: Number(r.curr_value ?? r.currValue ?? 0),
          changePct: Number(r.change_pct ?? r.changePct ?? 0),
          severity: r.severity ?? 'medium', status: r.status ?? 'open',
          detectedAt: r.detected_at ?? r.detectedAt ?? '', buildId: r.build_id ?? r.buildId ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.trends ?? rT.value.data ?? []
        setTrends(raw.map((t: any) => ({
          pageId: t.page_id ?? t.pageId ?? '', metricName: t.metric_name ?? t.metricName ?? '',
          p50: Number(t.p50 ?? 0), p75: Number(t.p75 ?? 0), p95: Number(t.p95 ?? 0), p99: Number(t.p99 ?? 0),
          trend: t.trend ?? 'stable', sampleCount: Number(t.sample_count ?? t.sampleCount ?? 0),
          period: t.period ?? '7d',
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

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id) }, [fetchAll])

  const failedSamples = samples.filter(s => !s.budgetPassed).length
  const openRegressions = regressions.filter(r => r.status === 'open').length
  const activeViolatedBudgets = budgets.filter(b => b.violationCount > 0 && b.status === 'active').length
  const degradingPages = trends.filter(t => t.trend === 'degrading').length

  const TABS2 = [
    { id: 'samples' as const, label: 'SAMPLES' },
    { id: 'budgets' as const, label: 'BUDGETS' },
    { id: 'regressions' as const, label: 'REGRESSIONS' },
    { id: 'trends' as const, label: 'TRENDS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div data-testid="perf-budget-page" style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>      
      <div data-testid="page-ready" style={{position:"fixed",top:0,right:0,opacity:0,pointerEvents:"none",width:1,height:1}} />
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span data-testid="perf-budget-title" style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>PERFORMANCE BUDGET — PLAYWRIGHT SAMPLING + CORE WEB VITALS + REGRESSION TRACKING</span>
        {openRegressions > 0 && <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>⚠‘ {openRegressions} REGRESSIONS</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠  {err}</span>}
        <button data-testid="perf-budget-refresh-btn" onClick={fetchAll} style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, background: 'transparent', border: `1px solid ${BORDER}`, color: SUBTLE, borderRadius: 3, padding: '3px 10px', cursor: 'pointer' }}>REFRESH</button>      </div>      <div data-testid="perf-budget-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Samples" value={samples.length} col={BLUE} />
        <StatCard label="Budget Fails" value={failedSamples} col={failedSamples > 0 ? RED : GREEN} />
        <StatCard label="Open Regressions" value={openRegressions} col={openRegressions > 0 ? RED : GREEN} />
        <StatCard label="Violated Budgets" value={activeViolatedBudgets} col={activeViolatedBudgets > 0 ? ORANGE : GREEN} />
        <StatCard label="Degrading Pages" value={degradingPages} col={degradingPages > 0 ? RED : GREEN} />
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
        {tab === 'samples' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Page</Th><Th>Budget</Th><Th right>FCP ms</Th><Th right>LCP ms</Th><Th right>CLS</Th><Th right>INP ms</Th><Th right>TTFB ms</Th><Th right>Load ms</Th><Th right>Bundle KB</Th><Th>Sampled At</Th></tr></thead>
              <tbody>
                {samples.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No perf samples</td></tr>}
                {samples.sort((a, b) => b.sampledAt.localeCompare(a.sampledAt)).slice(0, 200).map((s, i) => (
                  <tr key={i} style={{ background: !s.budgetPassed ? RED + '08' : 'transparent' }}>
                    <Td mono col={BLUE}>{(s.pageUrl || s.pageId).slice(0, 30)}</Td>
                    <Td mono col={s.budgetPassed ? GREEN : RED}>{s.budgetPassed ? 'âœ“ PASS' : 'âœ— FAIL'}</Td>
                    <Td right><Ms v={s.fcpMs} /></Td>
                    <Td right><Ms v={s.lcpMs} /></Td>
                    <Td right mono col={s.clsScore !== null ? (s.clsScore > 0.25 ? RED : s.clsScore > 0.1 ? AMBER : GREEN) : SUBTLE}>{s.clsScore !== null ? s.clsScore.toFixed(3) : '—'}</Td>
                    <Td right><Ms v={s.inpMs} /></Td>
                    <Td right><Ms v={s.ttfbMs} /></Td>
                    <Td right><Ms v={s.loadTimeMs} /></Td>
                    <Td right mono col={TEXT}>{s.bundleSizeKb !== null ? s.bundleSizeKb.toFixed(0) : '—'}</Td>
                    <Td mono col={SUBTLE}>{s.sampledAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'budgets' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Budget ID</Th><Th>Page ID</Th><Th>Metric</Th><Th>Status</Th><Th right>Budget ms</Th><Th right>Budget Score</Th><Th right>Budget KB</Th><Th right>Violations</Th><Th>Last Violated</Th></tr></thead>
              <tbody>
                {budgets.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No budgets</td></tr>}
                {budgets.sort((a, b) => b.violationCount - a.violationCount).map((b, i) => (
                  <tr key={i} style={{ background: b.violationCount > 0 && b.status === 'active' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{b.budgetId}</Td>
                    <Td mono col={BLUE}>{b.pageId}</Td>
                    <Td mono col={TEXT}>{b.metricName}</Td>
                    <Td><StatusBadge s={b.status} /></Td>
                    <Td right mono col={TEXT}>{b.budgetMs !== null ? b.budgetMs : '—'}</Td>
                    <Td right mono col={TEXT}>{b.budgetScore !== null ? b.budgetScore.toFixed(2) : '—'}</Td>
                    <Td right mono col={TEXT}>{b.budgetKb !== null ? b.budgetKb.toFixed(0) : '—'}</Td>
                    <Td right mono col={b.violationCount > 0 ? RED : GREEN}>{b.violationCount}</Td>
                    <Td mono col={SUBTLE}>{b.lastViolatedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'regressions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Page</Th><Th>Metric</Th><Th>Severity</Th><Th>Status</Th><Th right>Prev</Th><Th right>Curr</Th><Th right>Î”%</Th><Th>Build</Th><Th>Detected</Th></tr></thead>
              <tbody>
                {regressions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No regressions</td></tr>}
                {regressions.sort((a, b) => a.status === 'open' ? -1 : 0).map((r, i) => (
                  <tr key={i} style={{ background: r.severity === 'critical' && r.status === 'open' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{r.regressionId}</Td>
                    <Td mono col={BLUE}>{r.pageId}</Td>
                    <Td mono col={TEXT}>{r.metricName}</Td>
                    <Td><SevBadge s={r.severity} /></Td>
                    <Td><StatusBadge s={r.status} /></Td>
                    <Td right mono col={TEXT}>{r.prevValue.toFixed(0)}</Td>
                    <Td right mono col={RED}>{r.currValue.toFixed(0)}</Td>
                    <Td right mono col={r.changePct > 0 ? RED : GREEN}>{r.changePct > 0 ? '+' : ''}{r.changePct.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{r.buildId || '—'}</Td>
                    <Td mono col={SUBTLE}>{r.detectedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'trends' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Page ID</Th><Th>Metric</Th><Th>Trend</Th><Th>Period</Th><Th right>p50</Th><Th right>p75</Th><Th right>p95</Th><Th right>p99</Th><Th right>Samples</Th></tr></thead>
              <tbody>
                {trends.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No trends</td></tr>}
                {trends.sort((a, b) => a.trend === 'degrading' ? -1 : 0).map((t, i) => (
                  <tr key={i} style={{ background: t.trend === 'degrading' ? RED + '08' : 'transparent' }}>
                    <Td mono col={AMBER}>{t.pageId}</Td>
                    <Td mono col={TEXT}>{t.metricName}</Td>
                    <Td><StatusBadge s={t.trend} /></Td>
                    <Td mono col={SUBTLE}>{t.period}</Td>
                    <Td right mono col={TEXT}>{t.p50.toFixed(0)}</Td>
                    <Td right mono col={TEXT}>{t.p75.toFixed(0)}</Td>
                    <Td right mono col={ORANGE}>{t.p95.toFixed(0)}</Td>
                    <Td right mono col={RED}>{t.p99.toFixed(0)}</Td>
                    <Td right mono col={SUBTLE}>{t.sampleCount}</Td>
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
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={ORANGE}>{a.action}</Td>
                    <Td mono col={TEXT}>{a.actor}</Td>
                    <Td mono col={SUBTLE}>{a.detail || '—'}</Td>
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
