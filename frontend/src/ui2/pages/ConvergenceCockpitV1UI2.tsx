import React, { useState, useEffect, useCallback } from 'react'
﻿// ConvergenceCockpitV1UI2 â€” Bloomberg APEX Convergence Cockpit V1
// Multi-scenario evidence convergence, agent trace, citation recall, ticket management
// Tabs: SCENARIOS | RESULTS | EVIDENCE GRAPH | TICKETS | AUDIT
// APIs: /api/v3/cockpit/scenarios, /run, /results, /evidence, /tickets, /audit

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

interface SearchResult {
  id: string
  title: string
  type: string
  score: number
  snippet: string
}

interface EvidenceNode {
  id: string
  label: string
  type: string
  relevance: number
  tags: string[]
}

interface Citation {
  id: string
  source: string
  relevance: number
}

interface AgentTrace {
  task: string
  steps: Array<{ step: number; action: string; durationMs: number }>
  citations: Citation[]
  totalDurationMs: number
  confidence: number
}

interface ScenarioResult {
  sessionId: string
  scenarioId: string
  scenarioName: string
  leftPane: { query: string; results: SearchResult[]; total: number }
  centerPane: { nodes: EvidenceNode[]; edges: unknown[]; nodeCount: number }
  rightPane: { agentTrace: AgentTrace; citations: Citation[]; suggestedActions: string[] }
  createdAt: string
}

interface Ticket {
  id: string
  title: string
  scenarioId: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'p0' | 'p1' | 'p2' | 'p3'
  createdAt: string
  updatedAt: string
}

const SCENARIOS_DEFAULT = [
  { id: 'scen-volatility', name: 'Market Volatility Scan' },
  { id: 'scen-convergence', name: 'Strategy Convergence Check' },
  { id: 'scen-agent-health', name: 'Agent Health Audit' },
  { id: 'scen-risk', name: 'Risk Convergence' },
]

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
function TicketStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { open: AMBER, in_progress: BLUE, resolved: GREEN, closed: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}


export function ConvergenceCockpitV1UI2() {
  const [tab, setTab] = useState<'scenarios' | 'results' | 'evidence' | 'tickets' | 'audit'>('scenarios')
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS_DEFAULT[0].id)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [auditLog, setAuditLog] = useState<Array<{ auditId: string; action: string; actor: string; detail: string; timestamp: string }>>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ticketTitle, setTicketTitle] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketMsg, setTicketMsg] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rT, rA] = await Promise.allSettled([
        fetch('/api/v3/cockpit/tickets').then(r => r.ok ? r.json() : []),
        fetch('/api/v3/cockpit/audit').then(r => r.ok ? r.json() : []),
      ])
      if (rT.status === 'fulfilled') {
        const raw = Array.isArray(rT.value) ? rT.value : rT.value.tickets ?? rT.value.data ?? []
        setTickets(raw.map((t: any) => ({
          id: t.id ?? '', title: t.title ?? '',
          scenarioId: t.scenario_id ?? t.scenarioId ?? '',
          status: t.status ?? 'open', priority: t.priority ?? 'p2',
          createdAt: t.created_at ?? t.createdAt ?? '',
          updatedAt: t.updated_at ?? t.updatedAt ?? '',
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

  const handleRun = async () => {
    setRunning(true); setErr(null)
    try {
      const r = await fetch('/api/v3/cockpit/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: selectedScenario }),
      })
      if (r.ok) {
        const d = await r.json()
        setResult({
          sessionId: d.session_id ?? d.sessionId ?? '',
          scenarioId: d.scenario_id ?? d.scenarioId ?? '',
          scenarioName: d.scenario_name ?? d.scenarioName ?? '',
          leftPane: {
            query: d.left_pane?.query ?? d.leftPane?.query ?? '',
            results: (d.left_pane?.results ?? d.leftPane?.results ?? []).map((s: any) => ({
              id: s.id ?? '', title: s.title ?? '', type: s.type ?? '',
              score: Number(s.score ?? 0), snippet: s.snippet ?? '',
            })),
            total: Number(d.left_pane?.total ?? d.leftPane?.total ?? 0),
          },
          centerPane: {
            nodes: (d.center_pane?.nodes ?? d.centerPane?.nodes ?? []).map((n: any) => ({
              id: n.id ?? '', label: n.label ?? '', type: n.type ?? '',
              relevance: Number(n.relevance ?? 0), tags: n.tags ?? [],
            })),
            edges: d.center_pane?.edges ?? d.centerPane?.edges ?? [],
            nodeCount: Number(d.center_pane?.node_count ?? d.centerPane?.nodeCount ?? 0),
          },
          rightPane: {
            agentTrace: {
              task: d.right_pane?.agent_trace?.task ?? '',
              steps: (d.right_pane?.agent_trace?.steps ?? []).map((s: any) => ({
                step: Number(s.step ?? 0), action: s.action ?? '',
                durationMs: Number(s.duration_ms ?? s.durationMs ?? 0),
              })),
              citations: (d.right_pane?.agent_trace?.citations ?? []).map((c: any) => ({
                id: c.id ?? '', source: c.source ?? '', relevance: Number(c.relevance ?? 0),
              })),
              totalDurationMs: Number(d.right_pane?.agent_trace?.total_duration_ms ?? 0),
              confidence: Number(d.right_pane?.agent_trace?.confidence ?? 0),
            },
            citations: (d.right_pane?.citations ?? []).map((c: any) => ({
              id: c.id ?? '', source: c.source ?? '', relevance: Number(c.relevance ?? 0),
            })),
            suggestedActions: d.right_pane?.suggested_actions ?? d.rightPane?.suggestedActions ?? [],
          },
          createdAt: d.created_at ?? d.createdAt ?? '',
        })
        setTab('results')
      } else { const e = await r.json(); setErr(e.detail ?? 'Run failed') }
    } catch (e: any) { setErr(e.message) }
    finally { setRunning(false) }
  }

  const handleCreateTicket = async () => {
    if (!ticketTitle.trim()) return
    setCreatingTicket(true); setTicketMsg(null)
    try {
      const r = await fetch('/api/v3/cockpit/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ticketTitle, scenario_id: result?.scenarioId ?? selectedScenario }),
      })
      if (r.ok) { setTicketMsg('Ticket created'); setTicketTitle(''); fetchData() }
      else setTicketMsg('Creation failed')
    } catch (e: any) { setTicketMsg(e.message) }
    finally { setCreatingTicket(false) }
  }

  useEffect(() => { fetchData() }, [fetchData])

  const avgConfidence = result ? result.rightPane.agentTrace.confidence : null
  const evidenceNodes = result ? result.centerPane.nodeCount : 0
  const totalCitations = result ? result.rightPane.citations.length : 0

  const TABS2 = [
    { id: 'scenarios' as const, label: 'SCENARIOS' },
    { id: 'results' as const, label: 'RESULTS' },
    { id: 'evidence' as const, label: 'EVIDENCE GRAPH' },
    { id: 'tickets' as const, label: 'TICKETS' },
    { id: 'audit' as const, label: 'AUDIT' },
  ]

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CONVERGENCE COCKPIT V1 â€” MULTI-SCENARIO EVIDENCE + AGENT TRACE + CITATION RECALL</span>
        {running && <span style={{ fontSize: 10, color: AMBER }}>RUNNING SCENARIOâ€¦</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>âš  {err}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Agent Confidence" value={avgConfidence !== null ? `${(avgConfidence * 100).toFixed(1)}%` : 'â€”'} col={avgConfidence !== null ? (avgConfidence >= 0.7 ? GREEN : AMBER) : SUBTLE} />
        <StatCard label="Evidence Nodes" value={evidenceNodes} col={BLUE} />
        <StatCard label="Citations" value={totalCitations} col={PURPLE} />
        <StatCard label="Open Tickets" value={tickets.filter(t => t.status === 'open').length} col={AMBER} />
        <StatCard label="Search Results" value={result?.leftPane.total ?? 'â€”'} col={TEXT} />
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
        {tab === 'scenarios' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <select value={selectedScenario} onChange={e => setSelectedScenario(e.target.value)}
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '6px 10px', borderRadius: 3 }}>
                {SCENARIOS_DEFAULT.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleRun} disabled={running}
                style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: running ? SUBTLE : AMBER, background: (running ? SUBTLE : AMBER) + '22', border: `1px solid ${running ? SUBTLE : AMBER}44`, borderRadius: 3, padding: '6px 14px', cursor: running ? 'not-allowed' : 'pointer' }}>
                {running ? 'RUNNINGâ€¦' : 'RUN SCENARIO'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {SCENARIOS_DEFAULT.map(s => (
                <div key={s.id} onClick={() => setSelectedScenario(s.id)}
                  style={{ background: selectedScenario === s.id ? AMBER + '11' : PANEL, border: `1px solid ${selectedScenario === s.id ? AMBER + '44' : BORDER}`, borderRadius: 4, padding: '12px 16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: selectedScenario === s.id ? AMBER : TEXT, marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>{s.id}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'results' && (
          <div>
            {!result && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No results â€” run a scenario first</div>}
            {result && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: MONO, color: AMBER, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Search Results ({result.leftPane.total})</div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th>Title</Th><Th>Type</Th><Th right>Score</Th></tr></thead>
                      <tbody>
                        {result.leftPane.results.map((r, i) => (
                          <tr key={i}><Td mono col={TEXT}>{r.title.slice(0, 40)}</Td><Td mono col={BLUE}>{r.type}</Td><Td right mono col={r.score >= 0.8 ? GREEN : AMBER}>{r.score.toFixed(3)}</Td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: MONO, color: AMBER, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Agent Trace â€” {result.rightPane.agentTrace.totalDurationMs}ms</div>
                  <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th right>Step</Th><Th>Action</Th><Th right>Duration</Th></tr></thead>
                      <tbody>
                        {result.rightPane.agentTrace.steps.map((s, i) => (
                          <tr key={i}><Td right mono col={AMBER}>{s.step}</Td><Td mono col={TEXT}>{s.action.slice(0, 40)}</Td><Td right mono col={s.durationMs > 1000 ? RED : GREEN}>{s.durationMs}ms</Td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.rightPane.suggestedActions.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontFamily: MONO, color: AMBER, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Suggested Actions</div>
                      {result.rightPane.suggestedActions.map((a, i) => (
                        <div key={i} style={{ fontFamily: MONO, fontSize: 11, color: TEXT, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 10px', marginBottom: 4 }}>â†’ {a}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'evidence' && (
          <div>
            {!result && <div style={{ padding: 32, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No evidence data â€” run a scenario first</div>}
            {result && (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>Node ID</Th><Th>Label</Th><Th>Type</Th><Th right>Relevance</Th><Th>Tags</Th></tr></thead>
                  <tbody>
                    {result.centerPane.nodes.sort((a, b) => b.relevance - a.relevance).map((n, i) => (
                      <tr key={i}>
                        <Td mono col={AMBER}>{n.id.slice(0, 14)}</Td>
                        <Td mono col={TEXT}>{n.label.slice(0, 36)}</Td>
                        <Td mono col={BLUE}>{n.type}</Td>
                        <Td right mono col={n.relevance >= 0.8 ? GREEN : n.relevance >= 0.5 ? AMBER : RED}>{n.relevance.toFixed(3)}</Td>
                        <Td mono col={SUBTLE}>{n.tags.slice(0, 3).join(', ')}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'tickets' && (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={ticketTitle} onChange={e => setTicketTitle(e.target.value)}
                placeholder="New ticket titleâ€¦"
                style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT, padding: '5px 10px', width: 320 }} />
              <button onClick={handleCreateTicket} disabled={creatingTicket || !ticketTitle.trim()}
                style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BLUE, background: BLUE + '22', border: `1px solid ${BLUE}44`, borderRadius: 3, padding: '5px 12px', cursor: 'pointer' }}>
                CREATE
              </button>
              {ticketMsg && <span style={{ fontSize: 10, fontFamily: MONO, color: GREEN }}>{ticketMsg}</span>}
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>ID</Th><Th>Title</Th><Th>Scenario</Th><Th>Status</Th><Th>Priority</Th><Th>Created</Th></tr></thead>
                <tbody>
                  {tickets.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No tickets â€” check /api/v3/cockpit/tickets</td></tr>}
                  {tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t, i) => (
                    <tr key={i}>
                      <Td mono col={AMBER}>{t.id.slice(0, 12)}</Td>
                      <Td mono col={TEXT}>{t.title.slice(0, 40)}</Td>
                      <Td mono col={SUBTLE}>{t.scenarioId}</Td>
                      <Td><TicketStatusBadge s={t.status} /></Td>
                      <Td mono col={t.priority === 'p0' ? RED : t.priority === 'p1' ? ORANGE : AMBER}>{t.priority.toUpperCase()}</Td>
                      <Td mono col={SUBTLE}>{t.createdAt}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'audit' && (
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Audit ID</Th><Th>Action</Th><Th>Actor</Th><Th>Detail</Th><Th>Timestamp</Th></tr></thead>
              <tbody>
                {auditLog.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontFamily: MONO, fontSize: 11 }}>No audit log â€” check /api/v3/cockpit/audit</td></tr>}
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
