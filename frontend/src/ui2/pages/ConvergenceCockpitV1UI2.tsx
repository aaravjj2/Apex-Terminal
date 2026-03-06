import React, { useState, useEffect, useCallback } from 'react'
// ConvergenceCockpitV1UI2 - Bloomberg APEX Convergence Cockpit V1
// Multi-scenario evidence convergence, agent trace, citation recall, ticket management
// APIs: /api/v3/cockpit/scenarios, /run, /tickets, /audit

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

function StatCard({ label, value, col }: { label: string; value: string | number; col?: string }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px' }}>
      <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color: col || TEXT }}>{value}</div>
    </div>
  )
}

function TicketStatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { open: AMBER, in_progress: BLUE, resolved: GREEN, closed: SUBTLE }
  const c = m[s] ?? SUBTLE
  return <span style={{ fontFamily: MONO, fontSize: 9, color: c, background: c + '22', borderRadius: 3, padding: '2px 5px' }}>{s.replace('_', ' ').toUpperCase()}</span>
}

export function ConvergenceCockpitV1UI2() {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS_DEFAULT[0].id)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ticketTitle, setTicketTitle] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketMsg, setTicketMsg] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const rT = await fetch('/api/v3/cockpit/tickets').then(r => r.ok ? r.json() : []).catch(() => [])
      const raw = Array.isArray(rT) ? rT : rT.tickets ?? rT.data ?? []
      setTickets(raw.map((t: any) => ({
        id: t.id ?? '', title: t.title ?? '',
        scenarioId: t.scenario_id ?? t.scenarioId ?? '',
        status: t.status ?? 'open', priority: t.priority ?? 'p2',
        createdAt: t.created_at ?? t.createdAt ?? '',
        updatedAt: t.updated_at ?? t.updatedAt ?? '',
      })))
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const handleRun = async () => {
    setRunning(true); setErr(null)
    try {
      const r = await fetch(`/api/v3/cockpit/scenarios/${selectedScenario}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      if (r.ok) {
        const d = await r.json()
        setResult({
          sessionId: d.session_id ?? d.sessionId ?? '',
          scenarioId: d.scenario_id ?? d.scenarioId ?? '',
          scenarioName: d.scenario_name ?? d.scenarioName ?? '',
          leftPane: {
            query: d.left_pane?.query ?? '',
            results: (d.left_pane?.results ?? []).map((s: any) => ({
              id: s.id ?? '', title: s.title ?? '', type: s.type ?? '',
              score: Number(s.score ?? 0), snippet: s.snippet ?? '',
            })),
            total: Number(d.left_pane?.total ?? 0),
          },
          centerPane: {
            nodes: (d.center_pane?.nodes ?? []).map((n: any) => ({
              id: n.id ?? '', label: n.label ?? '', type: n.type ?? '',
              relevance: Number(n.relevance ?? 0), tags: n.tags ?? [],
            })),
            edges: d.center_pane?.edges ?? [],
            nodeCount: Number(d.center_pane?.node_count ?? 0),
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
            suggestedActions: d.right_pane?.suggested_actions ?? [],
          },
          createdAt: d.created_at ?? d.createdAt ?? '',
        })
      } else {
        const e = await r.json()
        setErr(e.detail ?? 'Run failed')
      }
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

  return (
    <div data-testid="convergence-cockpit-page" style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: MONO, color: TEXT }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: AMBER, letterSpacing: 2 }}>APEX</span>
        <span style={{ fontSize: 10, color: SUBTLE }}>CONVERGENCE COCKPIT V1 - MULTI-SCENARIO EVIDENCE + AGENT TRACE + CITATION RECALL</span>
        {running && <span style={{ fontSize: 10, color: AMBER }}>RUNNING SCENARIO...</span>}
        {err && <span style={{ fontSize: 10, color: RED }}>! {err}</span>}
        {loading && <span style={{ fontSize: 10, color: SUBTLE }}>LOADING...</span>}
      </div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BORDER, flexShrink: 0 }}>
        <StatCard label="Agent Confidence" value={avgConfidence !== null ? `${(avgConfidence * 100).toFixed(1)}%` : '-'} col={avgConfidence !== null ? (avgConfidence >= 0.7 ? GREEN : AMBER) : SUBTLE} />
        <StatCard label="Evidence Nodes" value={evidenceNodes} col={BLUE} />
        <StatCard label="Citations" value={totalCitations} col={PURPLE} />
        <StatCard label="Open Tickets" value={tickets.filter(t => t.status === 'open').length} col={AMBER} />
        <StatCard label="Search Results" value={result?.leftPane.total ?? '-'} col={TEXT} />
      </div>
      {/* Controls */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
        <select data-testid="scenario-select" value={selectedScenario} onChange={e => setSelectedScenario(e.target.value)}
          style={{ fontFamily: MONO, fontSize: 11, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: '6px 10px', borderRadius: 3 }}>
          {SCENARIOS_DEFAULT.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button data-testid="run-scenario-btn" onClick={handleRun} disabled={running}
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: running ? SUBTLE : AMBER, background: (running ? SUBTLE : AMBER) + '22', border: `1px solid ${running ? SUBTLE : AMBER}44`, borderRadius: 3, padding: '6px 14px', cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? 'RUNNING...' : 'RUN SCENARIO'}
        </button>
      </div>
      {/* 3-pane layout */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BORDER }}>
        {/* Left pane: search results */}
        <div data-testid="left-pane" style={{ background: PANEL, overflow: 'auto', padding: 12 }}>
          <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Search Results</div>
          {result ? (
            <div data-testid="search-results-list">
              {result.leftPane.results.length === 0 && <div style={{ fontSize: 11, color: SUBTLE }}>No results</div>}
              {result.leftPane.results.map((sr, i) => (
                <div key={sr.id} data-testid={`search-result-${i}`}
                  style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 10px', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{sr.title}</div>
                  <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, marginBottom: 2 }}>{sr.type} score: {sr.score.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: SUBTLE }}>{sr.snippet}</div>
                </div>
              ))}
            </div>
          ) : (
            <div data-testid="search-results-empty" style={{ fontSize: 11, color: SUBTLE }}>Run a scenario to see results</div>
          )}
        </div>
        {/* Center pane: evidence nodes */}
        <div data-testid="center-pane" style={{ background: PANEL, overflow: 'auto', padding: 12 }}>
          <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Evidence Graph</div>
          {result ? result.centerPane.nodes.map(node => (
            <div key={node.id} data-testid={`evidence-node-${node.id}`}
              style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '8px 10px', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: BLUE, marginBottom: 2 }}>{node.label}</div>
              <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE }}>{node.type} rel: {node.relevance.toFixed(2)}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {node.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 9, fontFamily: MONO, color: PURPLE, background: PURPLE + '22', borderRadius: 2, padding: '1px 4px' }}>{tag}</span>
                ))}
              </div>
            </div>
          )) : <div style={{ fontSize: 11, color: SUBTLE }}>No evidence data</div>}
        </div>
        {/* Right pane: agent trace + citations + ticket creation */}
        <div data-testid="right-pane" style={{ background: PANEL, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Agent trace */}
          <div data-testid="agent-trace-panel">
            <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Agent Trace</div>
            {result ? (
              <div>
                <div style={{ fontSize: 10, fontFamily: MONO, color: TEXT, marginBottom: 4 }}>Task: {result.rightPane.agentTrace.task}</div>
                <div style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, marginBottom: 4 }}>
                  Duration: {result.rightPane.agentTrace.totalDurationMs}ms Confidence: {(result.rightPane.agentTrace.confidence * 100).toFixed(1)}%
                </div>
                {result.rightPane.agentTrace.steps.map((step) => (
                  <div key={step.step} style={{ fontSize: 10, fontFamily: MONO, color: SUBTLE, padding: '2px 0' }}>
                    {step.step}. {step.action} ({step.durationMs}ms)
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 11, color: SUBTLE }}>No trace data</div>}
          </div>
          {/* Citations */}
          <div>
            <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Citations</div>
            <div data-testid="citation-list">
              {result ? result.rightPane.citations.map((c, i) => (
                <div key={c.id} data-testid={`citation-${i}`}
                  style={{ fontSize: 10, fontFamily: MONO, color: TEXT, padding: '3px 0', borderBottom: `1px solid ${BORDER}` }}>
                  {c.source} ({c.relevance.toFixed(2)})
                </div>
              )) : <div style={{ fontSize: 11, color: SUBTLE }}>No citations</div>}
            </div>
          </div>
          {/* Ticket creation */}
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
            <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Create Ticket</div>
            <button data-testid="create-ticket-btn" onClick={() => {}}
              style={{ fontSize: 10, fontFamily: MONO, color: AMBER, background: AMBER + '11', border: `1px solid ${AMBER}44`, borderRadius: 3, padding: '4px 10px', cursor: 'pointer', marginBottom: 8 }}>
              + NEW TICKET
            </button>
            <input data-testid="ticket-title-input" type="text" value={ticketTitle}
              onChange={e => setTicketTitle(e.target.value)}
              placeholder="Ticket title..."
              style={{ width: '100%', fontFamily: MONO, fontSize: 11, background: '#0d0d0d', border: `1px solid ${BORDER}`, color: TEXT, padding: '6px 8px', borderRadius: 3, boxSizing: 'border-box', marginBottom: 6 }} />
            <button data-testid="submit-ticket-btn" onClick={handleCreateTicket} disabled={creatingTicket || !ticketTitle.trim()}
              style={{ width: '100%', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: GREEN, background: GREEN + '11', border: `1px solid ${GREEN}44`, borderRadius: 3, padding: '6px', cursor: 'pointer', marginBottom: 6 }}>
              SUBMIT TICKET
            </button>
            {ticketMsg && <div style={{ fontSize: 10, color: GREEN }}>{ticketMsg}</div>}
          </div>
          {/* Tickets list */}
          <div>
            <div style={{ fontSize: 9, fontFamily: MONO, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Tickets</div>
            <div data-testid="tickets-list">
              {tickets.length === 0 && <div style={{ fontSize: 11, color: SUBTLE }}>No tickets</div>}
              {tickets.map(t => (
                <div key={t.id} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '6px 8px', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontFamily: MONO, color: TEXT, marginBottom: 2 }}>{t.title}</div>
                  <TicketStatusBadge s={t.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
