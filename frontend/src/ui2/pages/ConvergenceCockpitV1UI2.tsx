import React, { useState, useCallback } from 'react';

interface SearchResult {
  id: string;
  title: string;
  type: string;
  score: number;
  snippet: string;
}

interface EvidenceNode {
  id: string;
  label: string;
  type: string;
  relevance: number;
  tags: string[];
}

interface Citation {
  id: string;
  source: string;
  relevance: number;
}

interface AgentTrace {
  task: string;
  steps: { step: number; action: string; duration_ms: number }[];
  citations: Citation[];
  total_duration_ms: number;
  confidence: number;
}

interface ScenarioResult {
  session_id: string;
  scenario_id: string;
  scenario_name: string;
  left_pane: { query: string; results: SearchResult[]; total: number };
  center_pane: { nodes: EvidenceNode[]; edges: unknown[]; node_count: number };
  right_pane: { agent_trace: AgentTrace; citations: Citation[]; suggested_actions: string[] };
  created_at: string;
}

interface Ticket {
  id: string;
  title: string;
  scenario_id: string;
  status: string;
  created_at: string;
}

const API = 'http://localhost:8090/api/v3/cockpit';

const SCENARIOS = [
  { id: 'scen-volatility', name: 'Market Volatility Scan' },
  { id: 'scen-convergence', name: 'Strategy Convergence Check' },
  { id: 'scen-agent-health', name: 'Agent Health Audit' },
  { id: 'scen-risk', name: 'Risk Convergence' },
];

const TYPE_COLOR: Record<string, string> = {
  strategy: '#3B82F6',
  evidence: '#8B5CF6',
  backtest: '#10B981',
  signal: '#F59E0B',
  alert: '#EF4444',
};

export function ConvergenceCockpitV1UI2() {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0].id);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketTitle, setTicketTitle] = useState('');
  const [showTicketInput, setShowTicketInput] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);

  const fetchTickets = useCallback(async () => {
    const r = await fetch(`${API}/tickets`);
    const data = await r.json();
    setTickets(data.tickets || []);
  }, []);

  const handleRunScenario = async () => {
    setError('');
    setRunning(true);
    try {
      const r = await fetch(`${API}/scenarios/${selectedScenario}/run`, { method: 'POST' });
      if (!r.ok) {
        setError('Scenario run failed');
        return;
      }
      const data: ScenarioResult = await r.json();
      setResult(data);
      await fetchTickets();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketTitle.trim() || !result) return;
    setCreatingTicket(true);
    const r = await fetch(`${API}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: ticketTitle.trim(),
        scenario_id: result.scenario_id,
        session_id: result.session_id,
        evidence_ids: result.center_pane.nodes.map(n => n.id),
        actions: result.right_pane.suggested_actions,
      }),
    });
    if (r.ok) {
      setTicketTitle('');
      setShowTicketInput(false);
      await fetchTickets();
    }
    setCreatingTicket(false);
  };

  return (
    <div
      data-testid="convergence-cockpit-page"
      style={{ fontFamily: 'Inter, sans-serif', background: '#0F172A', minHeight: '100vh', color: '#E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Convergence Cockpit</h1>
        <select
          data-testid="scenario-select"
          value={selectedScenario}
          onChange={e => setSelectedScenario(e.target.value)}
          style={{ background: '#1E293B', border: '1px solid #334155', color: '#E2E8F0', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}
        >
          {SCENARIOS.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          data-testid="run-scenario-btn"
          onClick={handleRunScenario}
          disabled={running}
          style={{ background: running ? '#334155' : '#3B82F6', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', fontSize: 13 }}
        >
          {running ? 'Running…' : 'Run Scenario'}
        </button>
        {error && <span style={{ color: '#F87171', fontSize: 13 }}>{error}</span>}
      </div>

      {/* 3-pane layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: 12, flex: 1, minHeight: 0 }}>

        {/* LEFT PANE — Search */}
        <div
          data-testid="left-pane"
          style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', padding: 16, overflow: 'auto' }}
        >
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Search Results</h2>
          {!result ? (
            <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Run a scenario to see results</div>
          ) : (
            <div data-testid="search-results-list">
              {result.left_pane.results.map((sr, i) => (
                <div
                  key={sr.id}
                  data-testid={`search-result-${i}`}
                  style={{ background: '#0F172A', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #1E293B' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>{sr.title}</span>
                    <span style={{ fontSize: 11, background: (TYPE_COLOR[sr.type] || '#475569') + '22', color: TYPE_COLOR[sr.type] || '#94A3B8', padding: '2px 7px', borderRadius: 10 }}>{sr.type}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{sr.snippet}</div>
                  <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 4 }}>score: {sr.score}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER PANE — Evidence graph */}
        <div
          data-testid="center-pane"
          style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', padding: 16, overflow: 'auto' }}
        >
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Evidence Graph</h2>
          {!result ? (
            <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 60 }}>Evidence nodes will appear here</div>
          ) : (
            <div data-testid="evidence-graph">
              <div style={{ marginBottom: 12, color: '#64748B', fontSize: 12 }}>
                {result.center_pane.node_count} nodes · {(result.center_pane.edges as unknown[]).length} edges
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {result.center_pane.nodes.map(node => (
                  <div
                    key={node.id}
                    data-testid={`evidence-node-${node.id}`}
                    style={{
                      background: '#0F172A', borderRadius: 10, padding: '12px',
                      border: `1px solid ${node.relevance > 0.8 ? '#3B82F6' : '#334155'}`,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: 4 }}>{node.label}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>relevance: {node.relevance}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {node.tags.map(t => (
                        <span key={t} style={{ fontSize: 10, background: '#1E3A5F', color: '#93C5FD', padding: '2px 6px', borderRadius: 8 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE — Agent trace + Citations + Create ticket */}
        <div
          data-testid="right-pane"
          style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>Agent Trace</h2>

          {!result ? (
            <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 20 }}>Agent trace will appear here</div>
          ) : (
            <>
              <div data-testid="agent-trace-panel" style={{ background: '#0F172A', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
                  Task: <strong style={{ color: '#E2E8F0' }}>{result.right_pane.agent_trace.task}</strong>
                </div>
                {result.right_pane.agent_trace.steps.map(s => (
                  <div key={s.step} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid #1E293B' }}>
                    <span style={{ color: '#E2E8F0' }}>{s.step}. {s.action}</span>
                    <span style={{ color: '#64748B' }}>{s.duration_ms}ms</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
                  confidence: <span style={{ color: '#10B981' }}>{(result.right_pane.agent_trace.confidence * 100).toFixed(0)}%</span>
                  &nbsp;· total: {result.right_pane.agent_trace.total_duration_ms}ms
                </div>
              </div>

              {/* Citations */}
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Citations ({result.right_pane.citations.length})</div>
                <div data-testid="citation-list">
                  {result.right_pane.citations.map((c, i) => (
                    <div key={c.id} data-testid={`citation-${i}`} style={{ fontSize: 11, padding: '5px 8px', background: '#0F172A', borderRadius: 6, marginBottom: 4, border: '1px solid #1E293B' }}>
                      <span style={{ color: '#93C5FD' }}>{c.source}</span>
                      <span style={{ color: '#64748B', marginLeft: 8 }}>{c.relevance}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested actions */}
              <div style={{ fontSize: 11, color: '#64748B' }}>
                Suggested: {result.right_pane.suggested_actions.join(', ')}
              </div>

              {/* Create ticket */}
              {!showTicketInput ? (
                <button
                  data-testid="create-ticket-btn"
                  onClick={() => setShowTicketInput(true)}
                  style={{ background: '#1D4ED8', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                >
                  + Create Ticket
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    data-testid="ticket-title-input"
                    value={ticketTitle}
                    onChange={e => setTicketTitle(e.target.value)}
                    placeholder="Ticket title…"
                    style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#E2E8F0', fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      data-testid="submit-ticket-btn"
                      onClick={handleCreateTicket}
                      disabled={creatingTicket}
                      style={{ flex: 1, background: '#1D4ED8', color: '#FFF', border: 'none', borderRadius: 6, padding: '6px', cursor: 'pointer', fontSize: 12 }}
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => setShowTicketInput(false)}
                      style={{ background: '#334155', color: '#94A3B8', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tickets list */}
          {tickets.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Tickets ({tickets.length})</div>
              <div data-testid="tickets-list">
                {tickets.map(t => (
                  <div key={t.id} data-testid={`ticket-row-${t.id}`} style={{ fontSize: 11, padding: '6px 8px', background: '#0F172A', borderRadius: 6, marginBottom: 4, border: '1px solid #1E293B' }}>
                    <div style={{ color: '#E2E8F0' }}>{t.title}</div>
                    <div style={{ color: '#64748B', marginTop: 2 }}>{t.status} · {new Date(t.created_at).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
