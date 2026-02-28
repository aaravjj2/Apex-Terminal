import React, { useState, useEffect, useCallback } from 'react'
﻿// AutopilotExplainUI2 â€” Bloomberg APEX Autopilot Explainability terminal
// Shadow/live mode indicator, decision stream, rejection analysis, explanation rendering, risk scoring
// Tabs: DECISIONS | REJECTIONS | EXPLANATIONS | RISK SCORES | AUDIT
// APIs: /api/v4/autopilot/decisions, /rejections, /explanations, /risk, /audit

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

interface AutopilotDecision {
  decisionId: string
  timestamp: string
  symbol: string
  action: 'buy' | 'sell' | 'hold'
  confidence: number
  status: 'approved' | 'rejected' | 'pending' | 'executed'
  rejectionCode: string | null
  rejectionReason: string | null
  maxProfit: number | null
  maxLoss: number | null
  riskScore: number | null
  mode: 'shadow' | 'live'
}

interface RejectionAnalysis {
  rejectionCode: string
  description: string
  count: number
  pct: number
  lastSeen: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

interface ExplanationEntry {
  decisionId: string
  symbol: string
  action: string
  explanation: string
  keyFactors: string[]
  confidence: number
  timestamp: string
}

interface RiskScoreEntry {
  symbol: string
  riskScore: number
  maxLoss: number
  maxProfit: number
  volatility: number
  marketCondition: string
  flags: string[]
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
function ActionBadge({ a }: { a: string }) {
  const m: Record<string, string> = { buy: GREEN, sell: RED, hold: AMBER }
  const c = m[a] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{a.toUpperCase()}</span>
}
function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { approved: GREEN, rejected: RED, pending: AMBER, executed: BLUE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.toUpperCase()}</span>
}
function ModeBadge({ m }: { m: string }) {
  const c = m === 'live' ? RED : BLUE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{m.toUpperCase()}</span>
}


export function AutopilotExplainUI2() {
  const [tab, setTab] = useState<'decisions' | 'rejections' | 'explanations' | 'risk' | 'audit'>('decisions')
  const [decisions, setDecisions] = useState<AutopilotDecision[]>([])
  const [rejections, setRejections] = useState<RejectionAnalysis[]>([])
  const [explanations, setExplanations] = useState<ExplanationEntry[]>([])
  const [riskScores, setRiskScores] = useState<RiskScoreEntry[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'shadow' | 'live' | 'all'>('all')

  const fetchAll = useCallback(async () => {
    try {
      const [rD, rR, rE, rRisk, rA] = await Promise.allSettled([
        fetch('/api/v4/autopilot/decisions').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot/rejections').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot/explanations').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot/risk').then(r => r.ok ? r.json() : []),
        fetch('/api/v4/autopilot/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rD.status === 'fulfilled') {
        const raw = Array.isArray(rD.value) ? rD.value : rD.value.decisions ?? rD.value.data ?? []
        setDecisions(raw.map((d: any) => ({
          decisionId: d.decision_id ?? d.decisionId ?? d.id ?? '',
          timestamp: d.timestamp ?? '', symbol: d.symbol ?? '',
          action: d.action ?? 'hold', confidence: Number(d.confidence ?? 0),
          status: d.status ?? 'pending',
          rejectionCode: d.rejection_code ?? d.rejectionCode ?? null,
          rejectionReason: d.rejection_reason ?? d.rejectionReason ?? null,
          maxProfit: d.max_profit ?? d.maxProfit ?? null,
          maxLoss: d.max_loss ?? d.maxLoss ?? null,
          riskScore: d.risk_score ?? d.riskScore ?? null,
          mode: d.mode ?? 'shadow',
        })))
        setErr(null)
      } else setErr('Failed to load decisions')
      if (rR.status === 'fulfilled') {
        const raw = Array.isArray(rR.value) ? rR.value : rR.value.rejections ?? rR.value.data ?? []
        setRejections(raw.map((r: any) => ({
          rejectionCode: r.rejection_code ?? r.rejectionCode ?? '',
          description: r.description ?? '', count: Number(r.count ?? 0),
          pct: Number(r.pct ?? 0), lastSeen: r.last_seen ?? r.lastSeen ?? '',
          severity: r.severity ?? 'medium',
        })))
      }
      if (rE.status === 'fulfilled') {
        const raw = Array.isArray(rE.value) ? rE.value : rE.value.explanations ?? rE.value.data ?? []
        setExplanations(raw.map((e: any) => ({
          decisionId: e.decision_id ?? e.decisionId ?? '', symbol: e.symbol ?? '',
          action: e.action ?? '', explanation: e.explanation ?? '',
          keyFactors: e.key_factors ?? e.keyFactors ?? [],
          confidence: Number(e.confidence ?? 0), timestamp: e.timestamp ?? '',
        })))
      }
      if (rRisk.status === 'fulfilled') {
        const raw = Array.isArray(rRisk.value) ? rRisk.value : rRisk.value.risk ?? rRisk.value.data ?? []
        setRiskScores(raw.map((r: any) => ({
          symbol: r.symbol ?? '', riskScore: Number(r.risk_score ?? r.riskScore ?? 0),
          maxLoss: Number(r.max_loss ?? r.maxLoss ?? 0),
          maxProfit: Number(r.max_profit ?? r.maxProfit ?? 0),
          volatility: Number(r.volatility ?? 0),
          marketCondition: r.market_condition ?? r.marketCondition ?? '',
          flags: r.flags ?? [], timestamp: r.timestamp ?? '',
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

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 20000); return () => clearInterval(id) }, [fetchAll])

  const filteredDecisions = mode === 'all' ? decisions : decisions.filter(d => d.mode === mode)
  const approvedCount = decisions.filter(d => d.status === 'approved').length
  const rejectedCount = decisions.filter(d => d.status === 'rejected').length
  const avgConfidence = decisions.length ? (decisions.reduce((s, d) => s + d.confidence, 0) / decisions.length) : null
  const liveCount = decisions.filter(d => d.mode === 'live').length

  const TABS2 = [
    { id: 'decisions' as const, label: 'DECISIONS' },
    { id: 'rejections' as const, label: 'REJECTIONS' },
    { id: 'explanations' as const, label: 'EXPLANATIONS' },
    { id: 'risk' as const, label: 'RISK SCORES' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>AUTOPILOT EXPLAINABILITY â€” DECISION STREAM + REJECTION ANALYSIS + EXPLANATION ENGINE + RISK SCORING</span>
        {loading && <span style={{ fontSize: 10, color: AMBER }}>LOADINGâ€¦</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['all', 'shadow', 'live'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ fontFamily: MONO, fontSize: 10, color: mode === m ? (m === 'live' ? RED : m === 'shadow' ? BLUE : AMBER) : SUBTLE, background: mode === m ? (m === 'live' ? RED : m === 'shadow' ? BLUE : AMBER) + '22' : 'transparent', border: `1px solid ${mode === m ? (m === 'live' ? RED : m === 'shadow' ? BLUE : AMBER) + '44' : BORDER}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer' }}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Total Decisions" value={decisions.length} col={TEXT} />
        <StatCard label="Approved" value={approvedCount} col={GREEN} />
        <StatCard label="Rejected" value={rejectedCount} col={RED} />
        <StatCard label="Avg Confidence" value={avgConfidence !== null ? `${(avgConfidence * 100).toFixed(1)}%` : 'â€”'} col={avgConfidence !== null ? (avgConfidence >= 0.7 ? GREEN : AMBER) : SUBTLE} />
        <StatCard label="Live Mode" value={liveCount} col={liveCount > 0 ? RED : BLUE} sub={liveCount > 0 ? 'active' : 'shadow'} />
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
        {tab === 'decisions' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Decision ID</Th><Th>Symbol</Th><Th>Action</Th><Th>Status</Th><Th>Mode</Th><Th right>Confidence</Th><Th right>Risk Score</Th><Th right>Max Profit</Th><Th right>Max Loss</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {filteredDecisions.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No decisions â€” check /api/v4/autopilot/decisions</td></tr>}
                {filteredDecisions.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((d, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{d.decisionId.slice(0, 14)}</Td>
                    <Td mono col={TEXT}>{d.symbol}</Td>
                    <Td><ActionBadge a={d.action} /></Td>
                    <Td><StatusBadge s={d.status} /></Td>
                    <Td><ModeBadge m={d.mode} /></Td>
                    <Td right mono col={d.confidence >= 0.7 ? GREEN : d.confidence >= 0.5 ? AMBER : RED}>{(d.confidence * 100).toFixed(1)}%</Td>
                    <Td right mono col={d.riskScore !== null ? (d.riskScore > 0.7 ? RED : d.riskScore > 0.4 ? AMBER : GREEN) : SUBTLE}>{d.riskScore !== null ? d.riskScore.toFixed(2) : 'â€”'}</Td>
                    <Td right mono col={GREEN}>{d.maxProfit !== null ? `$${d.maxProfit.toFixed(0)}` : 'â€”'}</Td>
                    <Td right mono col={RED}>{d.maxLoss !== null ? `$${d.maxLoss.toFixed(0)}` : 'â€”'}</Td>
                    <Td mono col={SUBTLE}>{d.timestamp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'rejections' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Rejection Code</Th><Th>Description</Th><Th>Severity</Th><Th right>Count</Th><Th right>Pct</Th><Th>Last Seen</Th></tr></thead>
              <tbody>
                {rejections.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No rejections â€” check /api/v4/autopilot/rejections</td></tr>}
                {rejections.sort((a, b) => b.count - a.count).map((r, i) => (
                  <tr key={i}>
                    <Td mono col={AMBER}>{r.rejectionCode}</Td>
                    <Td mono col={TEXT}>{r.description.slice(0, 50)}</Td>
                    <Td><span style={{ fontFamily: MONO, fontSize: 9, color: r.severity === 'critical' ? RED : r.severity === 'high' ? ORANGE : r.severity === 'medium' ? AMBER : BLUE, background: (r.severity === 'critical' ? RED : r.severity === 'high' ? ORANGE : r.severity === 'medium' ? AMBER : BLUE) + '22', borderRadius: 3, padding: '2px 5px' }}>{r.severity.toUpperCase()}</span></Td>
                    <Td right mono col={TEXT}>{r.count}</Td>
                    <Td right mono col={r.pct > 50 ? RED : r.pct > 25 ? AMBER : GREEN}>{r.pct.toFixed(1)}%</Td>
                    <Td mono col={SUBTLE}>{r.lastSeen}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'explanations' && (
          <div>
            {explanations.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No explanations â€” check /api/v4/autopilot/explanations</div>}
            {explanations.map((e, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER }}>{e.decisionId.slice(0, 14)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{e.symbol}</span>
                  <ActionBadge a={e.action} />
                  <span style={{ fontFamily: MONO, fontSize: 11, color: e.confidence >= 0.7 ? GREEN : AMBER }}>{(e.confidence * 100).toFixed(1)}%</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE, marginLeft: 'auto' }}>{e.timestamp}</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, marginBottom: 8 }}>{e.explanation}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {e.keyFactors.map((f, j) => (
                    <span key={j} style={{ fontFamily: MONO, fontSize: 10, color: PURPLE, background: PURPLE + '22', borderRadius: 3, padding: '2px 6px' }}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'risk' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Symbol</Th><Th right>Risk Score</Th><Th right>Max Loss</Th><Th right>Max Profit</Th><Th right>Volatility</Th><Th>Condition</Th><Th>Flags</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {riskScores.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No risk scores â€” check /api/v4/autopilot/risk</td></tr>}
                {riskScores.sort((a, b) => b.riskScore - a.riskScore).map((r, i) => (
                  <tr key={i}>
                    <Td mono col={TEXT}>{r.symbol}</Td>
                    <Td right mono col={r.riskScore > 0.7 ? RED : r.riskScore > 0.4 ? AMBER : GREEN}>{r.riskScore.toFixed(3)}</Td>
                    <Td right mono col={RED}>${r.maxLoss.toFixed(0)}</Td>
                    <Td right mono col={GREEN}>${r.maxProfit.toFixed(0)}</Td>
                    <Td right mono col={TEXT}>{r.volatility.toFixed(4)}</Td>
                    <Td mono col={BLUE}>{r.marketCondition}</Td>
                    <Td mono col={ORANGE}>{r.flags.slice(0, 3).join(', ')}</Td>
                    <Td mono col={SUBTLE}>{r.timestamp}</Td>
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
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v4/autopilot/audit</td></tr>}
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
