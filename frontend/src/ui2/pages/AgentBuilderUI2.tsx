/**
 * AgentBuilderUI2 — W95
 *
 * Elastic Agent Builder integration page.
 * Create agents, run them, view traces + citations.
 * Accessible at /ui2/agent-builder
 */
import { useState, useEffect, useCallback } from "react";

const API = "";

interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  created_at: string;
}

interface BuilderRun {
  run_id: string;
  agent_id: string;
  query: string;
  status: string;
  summary: string;
  tool_calls: { tool: string; trace_id: string; ms: number }[];
  citations: { index: string; id: string; score: number }[];
  remote_used: boolean;
}

interface BuilderStatus {
  remote_enabled: boolean;
  elastic_agent_url_set: boolean;
  elastic_agent_key_set: boolean;
  reason: string;
  mode: string;
}

function useBuilderStatus() {
  const [status, setStatus] = useState<BuilderStatus | null>(null);
  useEffect(() => {
    fetch(`${API}/api/v3/elastic-agent/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);
  return status;
}

function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v3/elastic-agent/agents`);
      if (r.ok) setAgents((await r.json()).agents || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { agents, loading, refresh: load };
}

export function AgentBuilderUI2() {
  const builderStatus = useBuilderStatus();
  const { agents, loading: agentsLoading, refresh: refreshAgents } = useAgents();

  // Create agent form
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Run agent  
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [runQuery, setRunQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<BuilderRun | null>(null);

  const handleCreateAgent = async () => {
    if (!agentName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/v3/elastic-agent/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName, description: agentDesc }),
      });
      if (r.ok) {
        setAgentName("");
        setAgentDesc("");
        await refreshAgents();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRunAgent = async () => {
    if (!activeAgent || !runQuery.trim()) return;
    setRunning(true);
    setRunResult(null);
    try {
      const r = await fetch(`${API}/api/v3/elastic-agent/agents/${activeAgent.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: runQuery }),
      });
      if (r.ok) setRunResult(await r.json());
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      data-testid="agent-builder-page"
      style={{
        padding: "24px",
        background: "var(--ui2-bg-primary)",
        minHeight: "100vh",
        color: "var(--ui2-text-primary)",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, marginBottom: "4px" }}>
          Elastic Agent Builder
        </h1>
        <p style={{ fontSize: "13px", color: "var(--ui2-text-muted)", margin: 0 }}>
          Create and run grounded agents with evidence graph citations.
        </p>
      </div>

      {/* Status bar */}
      {builderStatus && (
        <div
          data-testid="builder-status-bar"
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            background: builderStatus.remote_enabled ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
            border: `1px solid ${builderStatus.remote_enabled ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
            marginBottom: "20px",
            fontSize: "12px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <span
            data-testid="builder-mode-badge"
            style={{
              fontWeight: 700,
              color: builderStatus.remote_enabled ? "#22c55e" : "#eab308",
              textTransform: "uppercase",
            }}
          >
            {builderStatus.mode}
          </span>
          <span style={{ color: "var(--ui2-text-muted)" }}>{builderStatus.reason}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "20px" }}>
        {/* Left panel — Create agent + list */}
        <div>
          {/* Create agent */}
          <div
            style={{
              background: "var(--ui2-bg-panel)",
              border: "1px solid var(--ui2-border)",
              borderRadius: "var(--ui2-radius-md)",
              padding: "14px 16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>
              Create Agent
            </div>
            <input
              data-testid="builder-agent-name-input"
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Agent name…"
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid var(--ui2-border)",
                background: "var(--ui2-bg-secondary)",
                color: "var(--ui2-text-primary)",
                fontSize: "13px",
                marginBottom: "8px",
                boxSizing: "border-box",
              }}
            />
            <input
              data-testid="builder-agent-desc-input"
              type="text"
              value={agentDesc}
              onChange={(e) => setAgentDesc(e.target.value)}
              placeholder="Description (optional)…"
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid var(--ui2-border)",
                background: "var(--ui2-bg-secondary)",
                color: "var(--ui2-text-primary)",
                fontSize: "13px",
                marginBottom: "10px",
                boxSizing: "border-box",
              }}
            />
            <button
              data-testid="builder-create-agent-btn"
              onClick={handleCreateAgent}
              disabled={creating || !agentName.trim()}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                background: "var(--ui2-accent)",
                color: "#fff",
                border: "none",
                cursor: creating ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 600,
                opacity: creating || !agentName.trim() ? 0.6 : 1,
              }}
            >
              {creating ? "Creating…" : "Create Agent"}
            </button>
          </div>

          {/* Agents list */}
          <div
            style={{
              background: "var(--ui2-bg-panel)",
              border: "1px solid var(--ui2-border)",
              borderRadius: "var(--ui2-radius-md)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ui2-border)", fontSize: "13px", fontWeight: 600 }}>
              Agents ({agents.length})
            </div>
            <div data-testid="builder-agents-list" style={{ maxHeight: "300px", overflowY: "auto" }}>
              {agentsLoading && (
                <div style={{ padding: "12px", fontSize: "12px", color: "var(--ui2-text-muted)" }}>Loading…</div>
              )}
              {!agentsLoading && agents.length === 0 && (
                <div style={{ padding: "12px", fontSize: "12px", color: "var(--ui2-text-muted)", fontStyle: "italic" }}>
                  No agents yet
                </div>
              )}
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  data-testid={`builder-agent-row-${agent.id}`}
                  onClick={() => setActiveAgent(agent)}
                  style={{
                    padding: "9px 14px",
                    borderBottom: "1px solid var(--ui2-border)",
                    cursor: "pointer",
                    background: activeAgent?.id === agent.id ? "rgba(59,130,246,0.08)" : "transparent",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ui2-text-primary)" }}>
                    {agent.name}
                  </div>
                  {agent.description && (
                    <div style={{ fontSize: "11px", color: "var(--ui2-text-muted)", marginTop: "2px" }}>
                      {agent.description.slice(0, 50)}
                    </div>
                  )}
                  <div style={{ fontSize: "10px", color: "var(--ui2-text-muted)", marginTop: "2px", fontFamily: "monospace" }}>
                    {agent.tools.join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — Run + results */}
        <div>
          {activeAgent ? (
            <div>
              {/* Run panel */}
              <div
                style={{
                  background: "var(--ui2-bg-panel)",
                  border: "1px solid var(--ui2-border)",
                  borderRadius: "var(--ui2-radius-md)",
                  padding: "14px 16px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>
                  Run Agent: <span style={{ color: "#3b82f6" }}>{activeAgent.name}</span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    data-testid="builder-run-query-input"
                    type="text"
                    value={runQuery}
                    onChange={(e) => setRunQuery(e.target.value)}
                    placeholder="Enter query…"
                    onKeyDown={(e) => e.key === "Enter" && !running && handleRunAgent()}
                    style={{
                      flexGrow: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--ui2-border)",
                      background: "var(--ui2-bg-secondary)",
                      color: "var(--ui2-text-primary)",
                      fontSize: "13px",
                    }}
                  />
                  <button
                    data-testid="builder-run-btn"
                    onClick={handleRunAgent}
                    disabled={running || !runQuery.trim()}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      background: "var(--ui2-accent)",
                      color: "#fff",
                      border: "none",
                      cursor: running ? "not-allowed" : "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      opacity: running || !runQuery.trim() ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {running ? "Running…" : "Run"}
                  </button>
                </div>
              </div>

              {/* Run result */}
              {runResult && (
                <div data-testid="builder-run-result">
                  {/* Summary */}
                  <div
                    style={{
                      background: "var(--ui2-bg-panel)",
                      border: "1px solid var(--ui2-border)",
                      borderRadius: "var(--ui2-radius-md)",
                      padding: "12px 16px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                      <span
                        data-testid="builder-run-status-badge"
                        style={{
                          fontSize: "11px", padding: "2px 8px", borderRadius: "8px", fontWeight: 600,
                          background: runResult.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                          color: runResult.status === "completed" ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {runResult.status}
                      </span>
                      <span
                        data-testid="builder-run-mode-badge"
                        style={{
                          fontSize: "11px", padding: "2px 8px", borderRadius: "8px", fontWeight: 600,
                          background: "rgba(59,130,246,0.12)", color: "#3b82f6",
                        }}
                      >
                        {runResult.remote_used ? "remote" : "local"}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--ui2-text-muted)", fontFamily: "monospace" }}>
                      {runResult.summary?.slice(0, 200)}
                    </div>
                  </div>

                  {/* Tool calls */}
                  <div
                    data-testid="builder-tool-calls-panel"
                    style={{
                      background: "var(--ui2-bg-panel)",
                      border: "1px solid var(--ui2-border)",
                      borderRadius: "var(--ui2-radius-md)",
                      overflow: "hidden",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ui2-border)", fontSize: "13px", fontWeight: 600 }}>
                      Tool Usage ({runResult.tool_calls?.length || 0})
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      {(runResult.tool_calls || []).map((tc) => (
                        <div
                          key={tc.trace_id}
                          data-testid={`builder-trace-${tc.tool}`}
                          style={{
                            display: "flex",
                            gap: "10px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            marginBottom: "4px",
                            background: "var(--ui2-bg-secondary)",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "#3b82f6", fontFamily: "monospace" }}>{tc.tool}</span>
                          <span style={{ color: "var(--ui2-text-muted)" }}>{tc.ms}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Citations */}
                  <div
                    style={{
                      background: "var(--ui2-bg-panel)",
                      border: "1px solid var(--ui2-border)",
                      borderRadius: "var(--ui2-radius-md)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ui2-border)", fontSize: "13px", fontWeight: 600 }}>
                      Citations ({runResult.citations?.length || 0})
                    </div>
                    <div data-testid="builder-citations-list" style={{ padding: "8px 10px" }}>
                      {(!runResult.citations || runResult.citations.length === 0) ? (
                        <div style={{ color: "var(--ui2-text-muted)", fontSize: "12px", fontStyle: "italic", padding: "8px" }}>
                          No citations
                        </div>
                      ) : (
                        runResult.citations.map((cit, i) => {
                          const entityType = cit.index?.replace("apex-", "").replace("-read", "").replace("-write", "") || "events";
                          const entityId = cit.id;
                          const evidenceUrl = `/ui2/evidence?root_type=${entityType}&root_id=${encodeURIComponent(entityId)}`;
                          return (
                            <div
                              key={cit.id || i}
                              data-testid={`builder-citation-${i}`}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "6px",
                                marginBottom: "4px",
                                background: "var(--ui2-bg-secondary)",
                                fontSize: "12px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600, color: "#3b82f6", fontFamily: "monospace" }}>{entityType}</span>
                                <span style={{ color: "var(--ui2-text-muted)", marginLeft: "8px" }}>{entityId.slice(0, 20)}</span>
                              </div>
                              <a
                                data-testid={`builder-citation-evidence-link-${i}`}
                                href={evidenceUrl}
                                style={{ fontSize: "11px", color: "#8b5cf6", textDecoration: "none" }}
                              >
                                Evidence Graph →
                              </a>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!runResult && (
                <div
                  data-testid="builder-run-empty-state"
                  style={{
                    background: "var(--ui2-bg-panel)",
                    border: "1px solid var(--ui2-border)",
                    borderRadius: "var(--ui2-radius-md)",
                    padding: "32px",
                    textAlign: "center",
                    color: "var(--ui2-text-muted)",
                    fontSize: "14px",
                  }}
                >
                  Enter a query and click Run to see tool traces and citations
                </div>
              )}
            </div>
          ) : (
            <div
              data-testid="builder-no-agent-selected"
              style={{
                background: "var(--ui2-bg-panel)",
                border: "1px solid var(--ui2-border)",
                borderRadius: "var(--ui2-radius-md)",
                padding: "32px",
                textAlign: "center",
                color: "var(--ui2-text-muted)",
                fontSize: "14px",
              }}
            >
              Create an agent and select it to run queries
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
