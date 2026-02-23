/**
 * EvidenceGraphUI2 — W93
 *
 * Evidence graph viewer: BFS-traversed subgraph from any root entity.
 * Accessible at /ui2/evidence?root_type=strategies&root_id=<id>
 *
 * Renders nodes as cards and edges as a simple adjacency list.
 * Supports quick "seed graph" action for demo/test purposes.
 */
import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:8090";

interface GraphNode {
  id: string;
  entity_type: string;
  entity_id: string;
  label: string;
}

interface GraphEdge {
  id: string;
  from_type: string;
  from_id: string;
  to_type: string;
  to_id: string;
  edge_type: string;
  metadata: Record<string, unknown>;
}

interface GraphData {
  root_type: string;
  root_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
}

function useEvidenceGraph(rootType: string, rootId: string) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rootType || !rootId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API}/api/v3/evidence/graph?root_type=${encodeURIComponent(rootType)}&root_id=${encodeURIComponent(rootId)}`
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json: GraphData = await resp.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [rootType, rootId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}

const NODE_COLORS: Record<string, string> = {
  strategies: "#3b82f6",
  backtests: "#8b5cf6",
  events: "#22c55e",
  tickets: "#f59e0b",
  workflows: "#06b6d4",
  jobs: "#ec4899",
  edges: "#64748b",
};

export function EvidenceGraphUI2() {
  const params = new URLSearchParams(window.location.search);
  const [rootType, setRootType] = useState(params.get("root_type") || "strategies");
  const [rootId, setRootId] = useState(params.get("root_id") || "");
  const [inputType, setInputType] = useState(rootType);
  const [inputId, setInputId] = useState(rootId);
  const [seeding, setSeeding] = useState(false);

  const { data, loading, error, refresh } = useEvidenceGraph(rootType, rootId);

  const handleSearch = () => {
    setRootType(inputType.trim());
    setRootId(inputId.trim());
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    const sid = `demo-strategy-001`;
    const bid = `demo-backtest-001`;
    try {
      await fetch(`${API}/api/v3/evidence/graph/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: bid, strategy_id: sid }),
      });
      setInputType("strategies");
      setInputId(sid);
      setRootType("strategies");
      setRootId(sid);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div
      data-testid="evidence-graph-page"
      style={{
        padding: "24px",
        background: "var(--ui2-bg-primary)",
        minHeight: "100vh",
        color: "var(--ui2-text-primary)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--ui2-text-primary)",
            margin: 0,
            marginBottom: "4px",
          }}
        >
          Evidence Graph
        </h1>
        <p style={{ fontSize: "13px", color: "var(--ui2-text-muted)", margin: 0 }}>
          Traceability layer — explore relationships between strategies, backtests, events and more.
        </p>
      </div>

      {/* Controls */}
      <div
        data-testid="evidence-graph-controls"
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          data-testid="evidence-root-type-select"
          value={inputType}
          onChange={(e) => setInputType(e.target.value)}
          style={{
            padding: "7px 10px",
            borderRadius: "6px",
            border: "1px solid var(--ui2-border)",
            background: "var(--ui2-bg-secondary)",
            color: "var(--ui2-text-primary)",
            fontSize: "13px",
          }}
        >
          {["strategies", "backtests", "events", "tickets", "workflows", "jobs", "edges"].map(
            (t) => (
              <option key={t} value={t}>
                {t}
              </option>
            )
          )}
        </select>
        <input
          data-testid="evidence-root-id-input"
          type="text"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder="Enter entity ID…"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{
            padding: "7px 12px",
            borderRadius: "6px",
            border: "1px solid var(--ui2-border)",
            background: "var(--ui2-bg-secondary)",
            color: "var(--ui2-text-primary)",
            fontSize: "13px",
            minWidth: "240px",
          }}
        />
        <button
          data-testid="evidence-search-btn"
          onClick={handleSearch}
          style={{
            padding: "7px 16px",
            borderRadius: "6px",
            background: "var(--ui2-accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          Load Graph
        </button>
        <button
          data-testid="evidence-refresh-btn"
          onClick={refresh}
          disabled={loading}
          style={{
            padding: "7px 12px",
            borderRadius: "6px",
            background: "var(--ui2-bg-secondary)",
            color: "var(--ui2-text-muted)",
            border: "1px solid var(--ui2-border)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          ↻ Refresh
        </button>
        <button
          data-testid="evidence-seed-btn"
          onClick={handleSeedDemo}
          disabled={seeding}
          style={{
            padding: "7px 12px",
            borderRadius: "6px",
            background: "rgba(59,130,246,0.12)",
            color: "#3b82f6",
            border: "1px solid rgba(59,130,246,0.3)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          {seeding ? "Seeding…" : "Seed Demo Graph"}
        </button>
      </div>

      {/* Status badges */}
      {data && (
        <div
          style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}
        >
          <span
            data-testid="evidence-node-count-badge"
            style={{
              padding: "3px 10px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 600,
              background: "rgba(59,130,246,0.12)",
              color: "#3b82f6",
            }}
          >
            {data.node_count} node{data.node_count !== 1 ? "s" : ""}
          </span>
          <span
            data-testid="evidence-edge-count-badge"
            data-count={data.edge_count}
            style={{
              padding: "3px 10px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 600,
              background: "rgba(139,92,246,0.12)",
              color: "#8b5cf6",
            }}
          >
            {data.edge_count} edge{data.edge_count !== 1 ? "s" : ""}
          </span>
          <span
            data-testid="evidence-root-badge"
            style={{
              padding: "3px 10px",
              borderRadius: "10px",
              fontSize: "12px",
              background: "var(--ui2-bg-secondary)",
              color: "var(--ui2-text-muted)",
            }}
          >
            root: {data.root_type}/{data.root_id}
          </span>
        </div>
      )}

      {/* Loading / error */}
      {loading && (
        <div
          data-testid="evidence-loading"
          style={{ color: "var(--ui2-text-muted)", fontSize: "14px", padding: "20px 0" }}
        >
          Loading graph…
        </div>
      )}
      {error && (
        <div
          data-testid="evidence-error"
          style={{ color: "#ef4444", fontSize: "13px", padding: "10px 0" }}
        >
          Error: {error}
        </div>
      )}

      {/* Graph body */}
      {data && !loading && (
        <div
          data-testid="evidence-graph-body"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
        >
          {/* Nodes panel */}
          <div
            style={{
              background: "var(--ui2-bg-panel)",
              border: "1px solid var(--ui2-border)",
              borderRadius: "var(--ui2-radius-md)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--ui2-border)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Nodes ({data.node_count})
            </div>
            <div data-testid="evidence-nodes-list" style={{ padding: "8px" }}>
              {data.nodes.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: "var(--ui2-text-muted)",
                    fontStyle: "italic",
                    fontSize: "12px",
                  }}
                >
                  No nodes
                </div>
              ) : (
                data.nodes.map((node) => (
                  <div
                    key={node.id}
                    data-testid={`evidence-node-${node.entity_type}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "7px 8px",
                      borderRadius: "6px",
                      marginBottom: "4px",
                      background: "var(--ui2-bg-secondary)",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: NODE_COLORS[node.entity_type] || "#64748b",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--ui2-text-primary)",
                        }}
                      >
                        {node.label}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--ui2-text-muted)" }}>
                        {node.entity_type}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Edges panel */}
          <div
            style={{
              background: "var(--ui2-bg-panel)",
              border: "1px solid var(--ui2-border)",
              borderRadius: "var(--ui2-radius-md)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--ui2-border)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Edges ({data.edge_count})
            </div>
            <div data-testid="evidence-edges-list" style={{ padding: "8px" }}>
              {data.edges.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: "var(--ui2-text-muted)",
                    fontStyle: "italic",
                    fontSize: "12px",
                  }}
                >
                  No edges
                </div>
              ) : (
                data.edges.map((edge) => (
                  <div
                    key={edge.id}
                    data-testid={`evidence-edge-${edge.edge_type}`}
                    style={{
                      padding: "7px 8px",
                      borderRadius: "6px",
                      marginBottom: "4px",
                      background: "var(--ui2-bg-secondary)",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: NODE_COLORS[edge.from_type] || "#64748b", fontWeight: 600 }}>
                      {edge.from_type}/{edge.from_id.slice(0, 12)}
                    </span>
                    <span style={{ color: "var(--ui2-text-muted)", margin: "0 6px" }}>
                      —[{edge.edge_type}]→
                    </span>
                    <span style={{ color: NODE_COLORS[edge.to_type] || "#64748b", fontWeight: 600 }}>
                      {edge.to_type}/{edge.to_id.slice(0, 12)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
