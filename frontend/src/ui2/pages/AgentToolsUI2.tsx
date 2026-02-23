/**
 * AgentToolsUI2 — W94
 *
 * Agent tool trace viewer + citations list with evidence graph deep links.
 * Accessible at /ui2/agent-tools
 */
import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:8090";

interface ToolCall {
  tool: string;
  trace_id: string;
  ms: number;
}

interface Trace {
  id: string;
  tool_name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  duration_ms: number;
  created_at: string;
}

interface Citation {
  index: string;
  id: string;
  score: number;
  entity_id?: string;
}

interface AgentRun {
  run_id: string;
  correlation_id: string;
  status: string;
  query: string;
  tool_calls: ToolCall[];
  citations: Citation[];
  summary: string;
  traces?: Trace[];
  created_at?: string;
  completed_at?: string;
}

interface AgentRunListItem {
  id: string;
  query: string;
  status: string;
  created_at: string;
  completed_at: string;
}

function useAgentRuns() {
  const [runs, setRuns] = useState<AgentRunListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v3/agent/runs`);
      if (r.ok) setRuns((await r.json()).runs || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { runs, loading, refresh: load };
}

function TraceRow({ trace }: { trace: Trace }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-testid={`agent-trace-row-${trace.tool_name}`}
      style={{
        border: "1px solid var(--ui2-border)",
        borderRadius: "6px",
        marginBottom: "6px",
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          cursor: "pointer",
          background: "var(--ui2-bg-secondary)",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#3b82f6", fontFamily: "monospace" }}>
          {trace.tool_name}
        </span>
        <span style={{ fontSize: "11px", color: "var(--ui2-text-muted)" }}>{trace.duration_ms}ms</span>
        {trace.error && <span style={{ color: "#ef4444", fontSize: "11px" }}>ERROR</span>}
        <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--ui2-text-muted)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <div style={{ padding: "8px 12px", fontSize: "11px", fontFamily: "monospace", overflow: "auto" }}>
          <div style={{ color: "var(--ui2-text-muted)", marginBottom: "4px" }}>args:</div>
          <pre style={{ margin: 0, color: "#22c55e", fontSize: "10px" }}>{JSON.stringify(trace.args, null, 2)}</pre>
          {trace.error ? (
            <div style={{ color: "#ef4444", marginTop: "6px" }}>error: {trace.error}</div>
          ) : (
            <>
              <div style={{ color: "var(--ui2-text-muted)", marginTop: "6px", marginBottom: "4px" }}>result (partial):</div>
              <pre style={{ margin: 0, color: "#a78bfa", fontSize: "10px" }}>
                {JSON.stringify(trace.result, null, 2).slice(0, 500)}
                {JSON.stringify(trace.result, null, 2).length > 500 ? "…" : ""}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentToolsUI2() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<AgentRun | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<AgentRun | null>(null);
  const { runs, loading: runsLoading, refresh: refreshRuns } = useAgentRuns();

  const handleRun = async () => {
    if (!query.trim()) return;
    setRunning(true);
    try {
      const r = await fetch(`${API}/api/v3/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (r.ok) {
        const run: AgentRun = await r.json();
        setLastRun(run);
        await refreshRuns();
      }
    } finally {
      setRunning(false);
    }
  };

  const handleSelectRun = async (runId: string) => {
    setSelectedRunId(runId);
    const r = await fetch(`${API}/api/v3/agent/runs/${runId}`);
    if (r.ok) setRunDetail(await r.json());
  };

  const activeRun = runDetail || lastRun;
  const traces: Trace[] = activeRun?.traces || [];

  return (
    <div
      data-testid="agent-tools-page"
      style={{
        padding: "24px",
        background: "var(--ui2-bg-primary)",
        minHeight: "100vh",
        color: "var(--ui2-text-primary)",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, marginBottom: "4px" }}>
          Agent Tools v1
        </h1>
        <p style={{ fontSize: "13px", color: "var(--ui2-text-muted)", margin: 0 }}>
          Grounded agent with strict tools, full audit trail and evidence graph citations.
        </p>
      </div>

      {/* Query input */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center" }}>
        <input
          data-testid="agent-query-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask the agent anything…"
          onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
          style={{
            flexGrow: 1,
            padding: "9px 14px",
            borderRadius: "8px",
            border: "1px solid var(--ui2-border)",
            background: "var(--ui2-bg-secondary)",
            color: "var(--ui2-text-primary)",
            fontSize: "14px",
          }}
        />
        <button
          data-testid="agent-run-btn"
          onClick={handleRun}
          disabled={running || !query.trim()}
          style={{
            padding: "9px 20px",
            borderRadius: "8px",
            background: "var(--ui2-accent)",
            color: "#fff",
            border: "none",
            cursor: running ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 600,
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? "Running…" : "Run Agent"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>
        {/* Runs list */}
        <div>
          <div
            style={{
              background: "var(--ui2-bg-panel)",
              border: "1px solid var(--ui2-border)",
              borderRadius: "var(--ui2-radius-md)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ui2-border)", fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Agent Runs</span>
              <button
                data-testid="agent-runs-refresh"
                onClick={refreshRuns}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ui2-text-muted)", fontSize: "13px" }}
              >
                ↻
              </button>
            </div>
            <div data-testid="agent-runs-table" style={{ maxHeight: "400px", overflowY: "auto" }}>
              {runsLoading && (
                <div style={{ padding: "12px", color: "var(--ui2-text-muted)", fontSize: "12px" }}>Loading…</div>
              )}
              {!runsLoading && runs.length === 0 && (
                <div style={{ padding: "12px", color: "var(--ui2-text-muted)", fontSize: "12px", fontStyle: "italic" }}>No runs yet</div>
              )}
              {runs.map((run) => (
                <div
                  key={run.id}
                  data-testid={`agent-run-row-${run.id}`}
                  onClick={() => handleSelectRun(run.id)}
                  style={{
                    padding: "8px 14px",
                    borderBottom: "1px solid var(--ui2-border)",
                    cursor: "pointer",
                    background: selectedRunId === run.id ? "rgba(59,130,246,0.08)" : "transparent",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ui2-text-primary)", wordBreak: "break-all" }}>
                    {run.query.slice(0, 40)}{run.query.length > 40 ? "…" : ""}
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                    <span style={{
                      fontSize: "10px", padding: "1px 6px", borderRadius: "8px", fontWeight: 600,
                      background: run.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: run.status === "completed" ? "#22c55e" : "#ef4444",
                    }}>
                      {run.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Run detail */}
        <div>
          {activeRun ? (
            <div>
              {/* Summary */}
              <div
                style={{
                  background: "var(--ui2-bg-panel)",
                  border: "1px solid var(--ui2-border)",
                  borderRadius: "var(--ui2-radius-md)",
                  padding: "14px 16px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <span
                    data-testid="agent-run-status-badge"
                    style={{
                      fontSize: "11px", padding: "2px 8px", borderRadius: "8px", fontWeight: 600,
                      background: activeRun.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: activeRun.status === "completed" ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {activeRun.status}
                  </span>
                  <span data-testid="agent-run-tool-count-badge" style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "8px", background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontWeight: 600 }}>
                    {activeRun.tool_calls?.length || 0} tool calls
                  </span>
                  <span data-testid="agent-run-citation-count-badge" style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "8px", background: "rgba(139,92,246,0.12)", color: "#8b5cf6", fontWeight: 600 }}>
                    {activeRun.citations?.length || 0} citations
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--ui2-text-primary)", fontWeight: 600, marginBottom: "4px" }}>
                  Query: {activeRun.query}
                </div>
                <div style={{ fontSize: "11px", color: "var(--ui2-text-muted)", fontFamily: "monospace" }}>
                  run_id: {activeRun.run_id}
                </div>
              </div>

              {/* Tool traces */}
              <div
                data-testid="agent-tool-traces-panel"
                style={{
                  background: "var(--ui2-bg-panel)",
                  border: "1px solid var(--ui2-border)",
                  borderRadius: "var(--ui2-radius-md)",
                  overflow: "hidden",
                  marginBottom: "16px",
                }}
              >
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ui2-border)", fontSize: "13px", fontWeight: 600 }}>
                  Tool Traces ({traces.length})
                </div>
                <div style={{ padding: "10px" }}>
                  {traces.length === 0 && activeRun.tool_calls ? (
                    /* traces may not be loaded yet — show tool_call summary */
                    activeRun.tool_calls.map((tc) => (
                      <div
                        key={tc.trace_id}
                        data-testid={`agent-trace-row-${tc.tool}`}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "6px",
                          marginBottom: "4px",
                          background: "var(--ui2-bg-secondary)",
                          fontSize: "12px",
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "#3b82f6", fontFamily: "monospace" }}>{tc.tool}</span>
                        <span style={{ color: "var(--ui2-text-muted)" }}>{tc.ms}ms</span>
                      </div>
                    ))
                  ) : (
                    traces.map((trace) => <TraceRow key={trace.id} trace={trace} />)
                  )}
                  {traces.length === 0 && (!activeRun.tool_calls || activeRun.tool_calls.length === 0) && (
                    <div style={{ color: "var(--ui2-text-muted)", fontSize: "12px", fontStyle: "italic", padding: "8px" }}>
                      No tool traces
                    </div>
                  )}
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
                  Citations ({activeRun.citations?.length || 0})
                </div>
                <div data-testid="agent-citations-list" style={{ padding: "10px" }}>
                  {(!activeRun.citations || activeRun.citations.length === 0) ? (
                    <div style={{ color: "var(--ui2-text-muted)", fontSize: "12px", fontStyle: "italic", padding: "8px" }}>
                      No citations
                    </div>
                  ) : (
                    activeRun.citations.map((cit, i) => {
                      const entityType = cit.index?.replace("apex-", "").replace("-read", "").replace("-write", "") || "events";
                      const entityId = cit.entity_id || cit.id || "unknown";
                      const graphUrl = `/ui2/evidence?root_type=${entityType}&root_id=${encodeURIComponent(entityId)}`;
                      return (
                        <div
                          key={cit.id || i}
                          data-testid={`agent-citation-${i}`}
                          style={{
                            padding: "7px 10px",
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
                            <span style={{ fontFamily: "monospace", color: "#3b82f6", fontWeight: 600 }}>{entityType}</span>
                            <span style={{ color: "var(--ui2-text-muted)", margin: "0 6px" }}/>{entityId.slice(0, 20)}
                          </div>
                          <a
                            data-testid={`agent-citation-graph-link-${i}`}
                            href={graphUrl}
                            style={{ fontSize: "11px", color: "#8b5cf6", textDecoration: "none" }}
                          >
                            View Graph →
                          </a>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              data-testid="agent-empty-state"
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
              Run an agent query to see tool traces and citations
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
