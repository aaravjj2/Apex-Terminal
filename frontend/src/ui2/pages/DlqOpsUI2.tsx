/**
 * DlqOpsUI2 — ElastiHack Waves 011-020, 061-070
 *
 * DLQ management + Ingest Ops: bulk metrics, lag timeline,
 * DLQ drain, throughput, query latency, integrity checks.
 *
 * Accessible at /ui2/dlq-ops
 */
import { useState, useCallback, useEffect } from "react";

const API = "";
const EH = `${API}/api/v4/elastihack`;

// ── Types ────────────────────────────────────────────────────────────────────
interface DLQEntry {
  id: string;
  entity_type: string;
  error: string;
  retry_count: number;
  created_at: string;
}

interface IngestMetrics {
  total_indexed: number;
  total_failed: number;
  total_retries: number;
  docs_per_sec: number;
  last_bulk_at: string | null;
}

interface LagEntry {
  entity_type: string;
  db_count: number;
  es_count: number;
  lag: number;
  slo_met: boolean;
}

interface Latency {
  p50: number;
  p95: number;
  p99: number;
  sample_count: number;
}

interface Integrity {
  missing_edges: number;
  orphan_docs: number;
  integrity_score: number;
}

interface IndexInfo {
  index: string;
  entity_type: string;
  doc_count: number;
  store_size: string;
  ilm_phase: string;
  ilm_policy: string;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: { height: "100%", overflow: "auto", padding: 24, color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" } as const,
  h1: { fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.5px" } as const,
  sub: { fontSize: 13, color: "#94a3b8", marginBottom: 20 } as const,
  tabs: { display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid #1e293b" } as const,
  tab: (active: boolean) => ({
    padding: "10px 20px",
    background: active ? "#1e293b" : "transparent",
    color: active ? "#60a5fa" : "#94a3b8",
    border: "none",
    borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
    fontSize: 13,
  }),
  card: { background: "#1e293b", borderRadius: 10, padding: 20, marginBottom: 16 } as const,
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#f1f5f9" } as const,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 } as const,
  kpi: (color: string) => ({
    background: "#0f172a",
    borderRadius: 8,
    padding: 16,
    borderLeft: `3px solid ${color}`,
  }),
  kpiLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 4 } as const,
  kpiValue: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" } as const,
  btn: (variant: "primary" | "ghost" | "danger" = "primary") => ({
    padding: "8px 18px",
    background: variant === "primary" ? "#3b82f6" : variant === "danger" ? "#ef4444" : "transparent",
    color: variant === "ghost" ? "#94a3b8" : "#fff",
    border: variant === "ghost" ? "1px solid #334155" : "none",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  }),
  badge: (color: string) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    background: color + "22",
    color,
    marginRight: 6,
  }),
  table: { width: "100%", fontSize: 13, borderCollapse: "collapse" as const } as const,
  th: { textAlign: "left" as const, padding: "10px 12px", borderBottom: "1px solid #334155", color: "#94a3b8", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const } as const,
  td: { padding: "10px 12px", borderBottom: "1px solid #1e293b" } as const,
};

const TABS = ["DLQ", "Throughput", "Lag", "Indices", "Integrity"] as const;
type Tab = typeof TABS[number];

export function DlqOpsUI2() {
  const [tab, setTab] = useState<Tab>("DLQ");
  const [dlq, setDlq] = useState<DLQEntry[]>([]);
  const [metrics, setMetrics] = useState<IngestMetrics | null>(null);
  const [lag, setLag] = useState<Record<string, LagEntry>>({});
  const [latency, setLatency] = useState<Latency | null>(null);
  const [integrity, setIntegrity] = useState<Integrity | null>(null);
  const [indices, setIndices] = useState<IndexInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t, l, lt, ig, ix] = await Promise.all([
        fetch(`${EH}/dlq`).then(r => r.json()),
        fetch(`${EH}/throughput`).then(r => r.json()),
        fetch(`${EH}/lag`).then(r => r.json()),
        fetch(`${EH}/ops/latency`).then(r => r.json()),
        fetch(`${EH}/ops/integrity`).then(r => r.json()),
        fetch(`${EH}/ops/indices`).then(r => r.json()),
      ]);
      setDlq(d.entries || []);
      setMetrics(t.metrics || null);
      setLag(l.lag || {});
      setLatency(lt);
      setIntegrity(ig);
      setIndices(ix.indices || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const injectTestEntry = async () => {
    await fetch(`${EH}/dlq/inject`, { method: "POST" });
    void refresh();
  };

  const drainDlq = async () => {
    await fetch(`${EH}/dlq/drain?rate_limit=100`, { method: "POST" });
    void refresh();
  };

  return (
    <div data-testid="dlq-ops-ui2-page" style={S.page}>
      <h1 style={S.h1}>Ingest Ops & DLQ</h1>
      <p style={S.sub}>Dead Letter Queue management, ingest throughput, lag monitoring, index health</p>

      <div style={S.tabs} data-testid="dlq-ops-tabs">
        {TABS.map(t => (
          <button key={t} data-testid={`dlq-tab-${t.toLowerCase()}`} style={S.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button data-testid="dlq-ops-refresh" style={S.btn("ghost")} onClick={refresh} disabled={loading}>
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {tab === "DLQ" && (
        <div data-testid="dlq-panel">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button data-testid="dlq-inject-btn" style={S.btn("ghost")} onClick={injectTestEntry}>Inject Test Entry</button>
            <button data-testid="dlq-drain-btn" style={S.btn("danger")} onClick={drainDlq} disabled={dlq.length === 0}>Drain DLQ ({dlq.length})</button>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Dead Letter Queue ({dlq.length} entries)</div>
            {dlq.length === 0 ? (
              <div style={{ color: "#22c55e", fontSize: 14 }}>✓ DLQ is empty — all documents indexed successfully</div>
            ) : (
              <table style={S.table} data-testid="dlq-table">
                <thead>
                  <tr>
                    <th style={S.th}>ID</th>
                    <th style={S.th}>Entity</th>
                    <th style={S.th}>Error</th>
                    <th style={S.th}>Retries</th>
                    <th style={S.th}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {dlq.map(e => (
                    <tr key={e.id}>
                      <td style={S.td}><code>{e.id.slice(0, 8)}</code></td>
                      <td style={S.td}><span style={S.badge("#3b82f6")}>{e.entity_type}</span></td>
                      <td style={{ ...S.td, color: "#ef4444" }}>{e.error}</td>
                      <td style={S.td}>{e.retry_count}</td>
                      <td style={S.td}>{new Date(e.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "Throughput" && metrics && (
        <div data-testid="throughput-panel">
          <div style={S.grid}>
            <div style={S.kpi("#3b82f6")}><div style={S.kpiLabel}>Total Indexed</div><div style={S.kpiValue} data-testid="total-indexed">{metrics.total_indexed}</div></div>
            <div style={S.kpi("#ef4444")}><div style={S.kpiLabel}>Total Failed</div><div style={S.kpiValue}>{metrics.total_failed}</div></div>
            <div style={S.kpi("#f59e0b")}><div style={S.kpiLabel}>Total Retries</div><div style={S.kpiValue}>{metrics.total_retries}</div></div>
            <div style={S.kpi("#22c55e")}><div style={S.kpiLabel}>Docs/sec</div><div style={S.kpiValue}>{metrics.docs_per_sec.toFixed(1)}</div></div>
          </div>
          {metrics.last_bulk_at && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>Last bulk: {metrics.last_bulk_at}</div>
          )}
        </div>
      )}

      {tab === "Lag" && (
        <div data-testid="lag-panel">
          <div style={S.card}>
            <div style={S.cardTitle}>DB ↔ ES Lag by Entity Type</div>
            <table style={S.table} data-testid="lag-table">
              <thead>
                <tr>
                  <th style={S.th}>Entity</th>
                  <th style={S.th}>DB Count</th>
                  <th style={S.th}>ES Count</th>
                  <th style={S.th}>Lag</th>
                  <th style={S.th}>SLO</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(lag).map(([type, l]) => (
                  <tr key={type}>
                    <td style={S.td}><span style={S.badge("#3b82f6")}>{type}</span></td>
                    <td style={S.td}>{l.db_count}</td>
                    <td style={S.td}>{l.es_count}</td>
                    <td style={S.td}>{l.lag}</td>
                    <td style={S.td}><span style={S.badge(l.slo_met ? "#22c55e" : "#ef4444")}>{l.slo_met ? "MET" : "BREACHED"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Indices" && (
        <div data-testid="indices-panel">
          <div style={S.card}>
            <div style={S.cardTitle}>Managed Indices ({indices.length})</div>
            <table style={S.table} data-testid="indices-table">
              <thead>
                <tr>
                  <th style={S.th}>Index</th>
                  <th style={S.th}>Entity</th>
                  <th style={S.th}>Docs</th>
                  <th style={S.th}>Size</th>
                  <th style={S.th}>ILM Phase</th>
                  <th style={S.th}>ILM Policy</th>
                </tr>
              </thead>
              <tbody>
                {indices.map(ix => (
                  <tr key={ix.index}>
                    <td style={S.td}><code>{ix.index}</code></td>
                    <td style={S.td}><span style={S.badge("#3b82f6")}>{ix.entity_type}</span></td>
                    <td style={S.td}>{ix.doc_count}</td>
                    <td style={S.td}>{ix.store_size}</td>
                    <td style={S.td}><span style={S.badge("#f59e0b")}>{ix.ilm_phase}</span></td>
                    <td style={S.td}><code>{ix.ilm_policy}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Integrity" && integrity && (
        <div data-testid="integrity-panel">
          <div style={S.grid}>
            <div style={S.kpi(integrity.integrity_score === 100 ? "#22c55e" : "#ef4444")}>
              <div style={S.kpiLabel}>Integrity Score</div>
              <div style={S.kpiValue} data-testid="integrity-score">{integrity.integrity_score}%</div>
            </div>
            <div style={S.kpi("#ef4444")}><div style={S.kpiLabel}>Missing Edges</div><div style={S.kpiValue}>{integrity.missing_edges}</div></div>
            <div style={S.kpi("#f59e0b")}><div style={S.kpiLabel}>Orphan Docs</div><div style={S.kpiValue}>{integrity.orphan_docs}</div></div>
          </div>

          {latency && (
            <div style={{ ...S.card, marginTop: 16 }}>
              <div style={S.cardTitle}>Query Latency Percentiles</div>
              <div style={S.grid}>
                <div style={S.kpi("#3b82f6")}><div style={S.kpiLabel}>P50</div><div style={S.kpiValue}>{latency.p50.toFixed(1)}ms</div></div>
                <div style={S.kpi("#f59e0b")}><div style={S.kpiLabel}>P95</div><div style={S.kpiValue}>{latency.p95.toFixed(1)}ms</div></div>
                <div style={S.kpi("#ef4444")}><div style={S.kpiLabel}>P99</div><div style={S.kpiValue}>{latency.p99.toFixed(1)}ms</div></div>
                <div style={S.kpi("#64748b")}><div style={S.kpiLabel}>Samples</div><div style={S.kpiValue}>{latency.sample_count}</div></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
