import React, { useState, useEffect, useCallback } from 'react'
﻿// SearchExplainUI2 — Bloomberg APEX search explainability terminal
// Ranking transparency, scoring breakdown, relevance tuning, model introspection
// Tabs: QUERIES | SCORING | TUNING | EXPERIMENTS | AUDIT
// APIs: /api/v4/search-explain/queries, /scoring, /tuning, /experiments, /audit

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

interface SearchQuery {
  queryId: string
  query: string
  index: string
  totalHits: number
  topScoreMax: number
  topScoreMin: number
  avgScore: number
  latencyMs: number
  userId: string
  queryType: 'keyword' | 'semantic' | 'hybrid' | 'fuzzy' | 'structured'
  relevanceFeedback: 'positive' | 'negative' | 'none'
  explainVersion: string
  executedAt: string
}

interface ScoringBreakdown {
  fieldId: string
  queryId: string
  docId: string
  field: string
  fieldType: 'text' | 'keyword' | 'vector' | 'numeric' | 'date' | 'geo'
  contribution: number
  tfidfScore: number
  boostFactor: number
  matchType: 'exact' | 'partial' | 'fuzzy' | 'semantic' | 'vector' | 'none'
  queryTerm: string
  fieldValue: string
}

interface RelevanceTuning {
  tuningId: string
  field: string
  boostValue: number
  previousBoost: number
  tuningType: 'boost' | 'decay' | 'filter' | 'rescoring'
  impactScore: number
  approvedBy: string
  appliedAt: string
  status: 'active' | 'testing' | 'rejected' | 'rolled_back'
}

interface SearchExperiment {
  experimentId: string
  name: string
  type: 'a_b' | 'multivariate' | 'shadow' | 'canary'
  status: 'running' | 'completed' | 'paused' | 'failed'
  trafficPct: number
  controlNdcg: number
  treatmentNdcg: number
  improvement: number
  pValue: number
  startedAt: string
  completedAt: string
}

interface SearchExplainAuditEntry {
  auditId: string
  queryId: string
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
function TypeBadge({ t }: { t: string }) {
  const m: Record<string, string> = { keyword: BLUE, semantic: PURPLE, hybrid: GREEN, fuzzy: AMBER, structured: ORANGE, a_b: BLUE, multivariate: PURPLE, shadow: AMBER, canary: ORANGE }
  const c = m[t] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{t.replace('_', '-').toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { active: GREEN, testing: AMBER, rejected: RED, rolled_back: ORANGE, running: AMBER, completed: GREEN, paused: SUBTLE, failed: RED, positive: GREEN, negative: RED, none: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}
function ContribBar({ v }: { v: number }) {
  const col = v > 0.5 ? GREEN : v > 0.2 ? AMBER : SUBTLE
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 55, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, v * 100)}%`, height: '100%', background: col }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>{v.toFixed(3)}</span>
    </div>
  )
}


export function SearchExplainUI2() {
  const [tab, setTab] = useState<'queries' | 'scoring' | 'tuning' | 'experiments' | 'audit'>('queries')
  const [queries, setQueries] = useState<SearchQuery[]>([])
  const [scoring, setScoring] = useState<ScoringBreakdown[]>([])
  const [tuning, setTuning] = useState<RelevanceTuning[]>([])
  const [experiments, setExperiments] = useState<SearchExperiment[]>([])
  const [auditLog, setAuditLog] = useState<SearchExplainAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [rQ, rS, rT, rE, rA] = await Promise.allSettled([
        fetch('/api/v4/search-explain/queries').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/search-explain/scoring').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/search-explain/tuning').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/search-explain/experiments').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/search-explain/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rQ.status === 'fulfilled') {
        const raw = Array.isArray(rQ.value) ? rQ.value : rQ.value.queries ?? rQ.value.data ?? []
        setQueries(raw.map((q: any) => ({
          queryId: q.query_id ?? q.queryId ?? '', query: q.query ?? '',
          index: q.index ?? '', totalHits: Number(q.total_hits ?? q.totalHits ?? 0),
          topScoreMax: Number(q.top_score_max ?? q.topScoreMax ?? 0),
          topScoreMin: Number(q.top_score_min ?? q.topScoreMin ?? 0),
          avgScore: Number(q.avg_score ?? q.avgScore ?? 0),
          latencyMs: Number(q.latency_ms ?? q.latencyMs ?? 0),
          userId: q.user_id ?? q.userId ?? '', queryType: q.query_type ?? q.queryType ?? 'keyword',
          relevanceFeedback: q.relevance_feedback ?? q.relevanceFeedback ?? 'none',
          explainVersion: q.explain_version ?? q.explainVersion ?? '1.0',
          executedAt: q.executed_at ?? q.executedAt ?? '',
        })))
        setErr(null)
      } else setErr('Failed to load queries')
      if (rS.status === 'fulfilled') {
        const raw = Array.isArray(rS.value) ? rS.value : rS.value.scoring ?? rS.value.data ?? []
        setScoring(raw.map((s: any) => ({
          fieldId: s.field_id ?? s.fieldId ?? '', queryId: s.query_id ?? s.queryId ?? '',
          docId: s.doc_id ?? s.docId ?? '', field: s.field ?? '',
          fieldType: s.field_type ?? s.fieldType ?? 'text',
          contribution: Number(s.contribution ?? 0), tfidfScore: Number(s.tfidf_score ?? s.tfidfScore ?? 0),
          boostFactor: Number(s.boost_factor ?? s.boostFactor ?? 1),
          matchType: s.match_type ?? s.matchType ?? 'exact',
          queryTerm: s.query_term ?? s.queryTerm ?? '', fieldValue: s.field_value ?? s.fieldValue ?? '',
        })))
      }
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.tuning ?? rT.value.data ?? []
        setTuning(raw.map((t: any) => ({
          tuningId: t.tuning_id ?? t.tuningId ?? '', field: t.field ?? '',
          boostValue: Number(t.boost_value ?? t.boostValue ?? 1),
          previousBoost: Number(t.previous_boost ?? t.previousBoost ?? 1),
          tuningType: t.tuning_type ?? t.tuningType ?? 'boost',
          impactScore: Number(t.impact_score ?? t.impactScore ?? 0),
          approvedBy: t.approved_by ?? t.approvedBy ?? '',
          appliedAt: t.applied_at ?? t.appliedAt ?? '', status: t.status ?? 'active',
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.experiments ?? rE.value.data ?? []
        setExperiments(raw.map((e: any) => ({
          experimentId: e.experiment_id ?? e.experimentId ?? '', name: e.name ?? '',
          type: e.type ?? 'a_b', status: e.status ?? 'running',
          trafficPct: Number(e.traffic_pct ?? e.trafficPct ?? 0),
          controlNdcg: Number(e.control_ndcg ?? e.controlNdcg ?? 0),
          treatmentNdcg: Number(e.treatment_ndcg ?? e.treatmentNdcg ?? 0),
          improvement: Number(e.improvement ?? 0), pValue: Number(e.p_value ?? e.pValue ?? 1),
          startedAt: e.started_at ?? e.startedAt ?? '', completedAt: e.completed_at ?? e.completedAt ?? '',
        })))
      }
      if (rA.status === 'fulfilled') {
        const raw = Array.isArray(rA.value) ? rA.value : rA.value.audit ?? rA.value.data ?? []
        setAuditLog(raw.map((a: any) => ({
          auditId: a.audit_id ?? a.auditId ?? '', queryId: a.query_id ?? a.queryId ?? '',
          action: a.action ?? '', actor: a.actor ?? '', detail: a.detail ?? '', timestamp: a.timestamp ?? '',
        })))
      }
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const negFeedback = queries.filter(q => q.relevanceFeedback === 'negative').length
  const slowQueries = queries.filter(q => q.latencyMs > 200).length
  const runningExperiments = experiments.filter(e => e.status === 'running').length
  const avgNdcgImprovement = experiments.filter(e => e.status === 'completed').reduce((a, e, _, arr) => a + e.improvement / arr.length, 0)

  const TABS2 = [
    { id: 'queries' as const, label: 'QUERIES' },
    { id: 'scoring' as const, label: 'SCORING' },
    { id: 'tuning' as const, label: 'TUNING' },
    { id: 'experiments' as const, label: 'EXPERIMENTS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>SEARCH EXPLAINABILITY — RANKING + SCORING BREAKDOWN + RELEVANCE TUNING</span>
        {negFeedback > 0 && <span style={{ fontSize: 10, color: RED }}>⚑ {negFeedback} NEG FEEDBACK</span>}
        {slowQueries > 0 && <span style={{ fontSize: 10, color: ORANGE }}>⚑ {slowQueries} SLOW</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>⚠ {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Queries" value={queries.length} col={BLUE} />
        <StatCard label="Negative Feedback" value={negFeedback} col={negFeedback > 0 ? RED : GREEN} />
        <StatCard label="Slow Queries >200ms" value={slowQueries} col={slowQueries > 0 ? ORANGE : GREEN} />
        <StatCard label="Running Experiments" value={runningExperiments} col={AMBER} />
        <StatCard label="Avg NDCG Improvement" value={`${avgNdcgImprovement.toFixed(2)}%`} col={avgNdcgImprovement > 0 ? GREEN : RED} />
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

        {tab === 'queries' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Query ID</Th><Th>Query Text</Th><Th>Index</Th><Th>Type</Th><Th>Feedback</Th><Th right>Hits</Th><Th right>Avg Score</Th><Th right>Latency ms</Th><Th>User</Th><Th>Executed</Th></tr></thead>
              <tbody>
                {queries.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No queries — check /api/v4/search-explain/queries</td></tr>}
                {queries.map((q, i) => (
                  <tr key={i} style={{ background: q.relevanceFeedback === 'negative' ? RED + '0a' : 'transparent' }}>
                    <Td mono col={AMBER}>{q.queryId}</Td>
                    <Td mono col={TEXT}>{q.query.length > 40 ? q.query.slice(0, 40) + '…' : q.query}</Td>
                    <Td mono col={BLUE}>{q.index}</Td>
                    <Td><TypeBadge t={q.queryType} /></Td>
                    <Td><StatusBadge s={q.relevanceFeedback} /></Td>
                    <Td right mono col={TEXT}>{q.totalHits.toLocaleString()}</Td>
                    <Td right mono col={q.avgScore > 0.7 ? GREEN : q.avgScore > 0.4 ? AMBER : RED}>{q.avgScore.toFixed(4)}</Td>
                    <Td right mono col={q.latencyMs > 200 ? RED : q.latencyMs > 100 ? AMBER : GREEN}>{q.latencyMs}</Td>
                    <Td mono col={SUBTLE}>{q.userId || '—'}</Td>
                    <Td mono col={SUBTLE}>{q.executedAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'scoring' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Query ID</Th><Th>Doc ID</Th><Th>Field</Th><Th>Field Type</Th><Th>Match Type</Th><Th>Query Term</Th><Th>Contribution</Th><Th right>TF-IDF</Th><Th right>Boost</Th></tr></thead>
              <tbody>
                {scoring.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No scoring data — check /api/v4/search-explain/scoring</td></tr>}
                {scoring.sort((a, b) => b.contribution - a.contribution).map((s, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{s.queryId}</Td>
                    <Td mono col={BLUE}>{s.docId}</Td>
                    <Td mono col={TEXT}>{s.field}</Td>
                    <Td mono col={PURPLE}>{s.fieldType.toUpperCase()}</Td>
                    <Td mono col={s.matchType === 'exact' ? GREEN : s.matchType === 'none' ? SUBTLE : AMBER}>{s.matchType.toUpperCase()}</Td>
                    <Td mono col={ORANGE}>{s.queryTerm || '—'}</Td>
                    <Td><ContribBar v={s.contribution} /></Td>
                    <Td right mono col={TEXT}>{s.tfidfScore.toFixed(4)}</Td>
                    <Td right mono col={s.boostFactor > 1 ? AMBER : SUBTLE}>{s.boostFactor.toFixed(2)}x</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'tuning' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Tuning ID</Th><Th>Field</Th><Th>Type</Th><Th>Status</Th><Th right>Prev Boost</Th><Th right>New Boost</Th><Th right>Impact Score</Th><Th>Approved By</Th><Th>Applied</Th></tr></thead>
              <tbody>
                {tuning.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No tuning data — check /api/v4/search-explain/tuning</td></tr>}
                {tuning.sort((a, b) => b.impactScore - a.impactScore).map((t, i) => (
                  <tr key={i} style={{ background: t.status === 'rolled_back' ? ORANGE + '09' : 'transparent' }}>
                    <Td mono col={AMBER}>{t.tuningId}</Td>
                    <Td mono col={BLUE}>{t.field}</Td>
                    <Td><TypeBadge t={t.tuningType} /></Td>
                    <Td><StatusBadge s={t.status} /></Td>
                    <Td right mono col={SUBTLE}>{t.previousBoost.toFixed(2)}x</Td>
                    <Td right mono col={t.boostValue > t.previousBoost ? GREEN : t.boostValue < t.previousBoost ? RED : SUBTLE}>{t.boostValue.toFixed(2)}x</Td>
                    <Td right mono col={t.impactScore > 0.1 ? GREEN : SUBTLE}>{t.impactScore.toFixed(4)}</Td>
                    <Td mono col={TEXT}>{t.approvedBy || '—'}</Td>
                    <Td mono col={SUBTLE}>{t.appliedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'experiments' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Experiment</Th><Th>Type</Th><Th>Status</Th><Th right>Traffic %</Th><Th right>Control NDCG</Th><Th right>Treatment NDCG</Th><Th right>Delta</Th><Th right>p-value</Th><Th>Started</Th></tr></thead>
              <tbody>
                {experiments.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No experiments — check /api/v4/search-explain/experiments</td></tr>}
                {experiments.map((e, i) => (
                  <tr key={i} style={{ background: e.status === 'running' ? AMBER + '06' : 'transparent' }}>
                    <Td mono col={AMBER}>{e.name}</Td>
                    <Td><TypeBadge t={e.type} /></Td>
                    <Td><StatusBadge s={e.status} /></Td>
                    <Td right mono col={TEXT}>{e.trafficPct.toFixed(1)}%</Td>
                    <Td right mono col={TEXT}>{e.controlNdcg.toFixed(4)}</Td>
                    <Td right mono col={e.treatmentNdcg > e.controlNdcg ? GREEN : RED}>{e.treatmentNdcg.toFixed(4)}</Td>
                    <Td right mono col={e.improvement > 0 ? GREEN : RED}>{e.improvement > 0 ? '+' : ''}{e.improvement.toFixed(2)}%</Td>
                    <Td right mono col={e.pValue < 0.05 ? GREEN : AMBER}>{e.pValue.toFixed(4)}</Td>
                    <Td mono col={SUBTLE}>{e.startedAt || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Query ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log — check /api/v4/search-explain/audit</td></tr>}
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{a.auditId}</Td>
                    <Td mono col={BLUE}>{a.queryId || '—'}</Td>
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
