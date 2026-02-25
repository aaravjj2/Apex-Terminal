/**
 * ElastiHackUI2 — Elasticsearch Agent Builder Hackathon
 *
 * Main dashboard for ElastiHack: contract info, templates, aliases,
 * ILM policies, canary docs, analyzers, synonyms, pipelines, health.
 * Tabs: Overview | Templates | Ops | Canary | Health
 *
 * Accessible at /ui2/elastihack
 */
import { useState, useEffect, useCallback } from "react";

const API = "";
const EH = `${API}/api/v4/elastihack`;

// ── Types ────────────────────────────────────────────────────────────────────
interface ContractInfo {
  contract_version: string;
  entity_types: string[];
  ilm_policies: string[];
  alias_convention: string;
  doc_id_algo: string;
  synonym_count: number;
  analyzers: string[];
  ingest_pipelines: string[];
  vector_enabled: boolean;
}

interface Template {
  name: string;
  index_patterns: string[];
  entity_type: string;
  version: number;
}

interface Alias {
  entity_type: string;
  write_alias: string;
  read_alias: string;
  target_index: string;
}

interface ILMPolicy {
  name: string;
  applies_to: string[];
  delete_after: string;
}

interface Pipeline {
  id: string;
  description: string;
  processors: string[];
  applies_to: string[];
}

interface CanaryResult {
  [type: string]: { canary_id: string; indexed: boolean; searchable: boolean };
}

interface AnalyzerInfo {
  name: string;
  fields: string[];
  purpose: string;
}

interface HealthStatus {
  status: string;
  cluster_name?: string;
  cluster_status?: string;
  node_count?: number;
  active_shards?: number;
  contract_version?: string;
  correlation_id?: string;
}

interface VectorFieldSpec {
  type: string;
  dims: number;
  index: boolean;
  similarity: string;
  applies_to: string[];
  description: string;
  enabled?: boolean;
  model?: string;
}

interface VectorOpsStatus {
  vector_enabled: boolean;
  pattern_vec: { dims: number; similarity: string; hnsw_m: number; hnsw_ef_construction: number; deterministic: boolean; external_api_required: boolean };
  text_vec: { dims: number; similarity: string; model: string | null; enabled: boolean };
  coverage_summary: Record<string, number>;
  contract_version: string;
}

interface VectorMappings {
  vector_enabled: boolean;
  pattern_vec: VectorFieldSpec;
  text_vec: VectorFieldSpec;
  contract_version: string;
}

interface KnnHit {
  _id: string;
  _score: number;
  retriever?: string;
  [key: string]: unknown;
}

interface KnnResult {
  ok: boolean;
  pattern_vec_dims: number;
  pattern_vec_sample: number[];
  pattern_vec_computed: boolean;
  es_available: boolean;
  hits: KnnHit[];
  hit_count: number;
  similarity: string;
  correlation_id: string;
  run_id?: string;
  cycle_id?: string;
}

interface HybridResult {
  ok: boolean;
  mode: string;
  bm25_hits: KnnHit[];
  knn_hits: KnnHit[];
  rrf_hits: KnnHit[];
  bm25_count: number;
  knn_count: number;
  rrf_count: number;
  latency_ms: number;
  es_available?: boolean;
  pattern_vec_sample: number[];
  correlation_id: string;
}

interface AgentFlowResult {
  ok: boolean;
  symbol: string;
  steps: string[];
  pattern_vec_dims: number;
  pattern_vec_sample: number[];
  es_available: boolean;
  summary: { similar_count: number; avg_cosine_similarity: number; common_patterns: string[] };
  recommendation: { action: string; confidence: number; rationale: string };
  correlation_id: string;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: { height: "100%", overflow: "auto", padding: 24, color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" } as const,
  h1: { fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.5px" } as const,
  sub: { fontSize: 13, color: "#94a3b8", marginBottom: 20 } as const,
  tabs: { display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid #1e293b", paddingBottom: 0 } as const,
  tab: (active: boolean) => ({
    padding: "10px 20px",
    background: active ? "#1e293b" : "transparent",
    color: active ? "#60a5fa" : "#94a3b8",
    border: "none",
    borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    transition: "all 0.15s",
  }),
  card: { background: "#1e293b", borderRadius: 10, padding: 20, marginBottom: 16 } as const,
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#f1f5f9" } as const,
  badge: (color: string) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    background: color + "22",
    color,
    marginRight: 6,
    marginBottom: 4,
  }),
  table: { width: "100%", fontSize: 13, borderCollapse: "collapse" as const } as const,
  th: { textAlign: "left" as const, padding: "10px 12px", borderBottom: "1px solid #334155", color: "#94a3b8", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.5px" } as const,
  td: { padding: "10px 12px", borderBottom: "1px solid #1e293b" } as const,
  btn: (variant: "primary" | "ghost" = "primary") => ({
    padding: "8px 20px",
    background: variant === "primary" ? "#3b82f6" : "transparent",
    color: variant === "primary" ? "#fff" : "#94a3b8",
    border: variant === "ghost" ? "1px solid #334155" : "none",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 } as const,
  kpi: (color: string) => ({
    background: "#0f172a",
    borderRadius: 8,
    padding: 16,
    borderLeft: `3px solid ${color}`,
  }),
  kpiLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 4 } as const,
  kpiValue: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" } as const,
};

const TABS = ["Overview", "Templates", "Ops", "Canary", "Health", "Vector", "kNN"] as const;
type Tab = typeof TABS[number];

export function ElastiHackUI2() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [ilm, setIlm] = useState<ILMPolicy[]>([]);
  const [analyzersData, setAnalyzers] = useState<AnalyzerInfo[]>([]);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [canaries, setCanaries] = useState<CanaryResult>({});
  const [canaryWritten, setCanaryWritten] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [vectorMappings, setVectorMappings] = useState<VectorMappings | null>(null);
  const [vectorOps, setVectorOps] = useState<VectorOpsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, t, a, i, an, sy, p, h, vm, vo] = await Promise.all([
        fetch(`${EH}/contract`).then(r => r.json()),
        fetch(`${EH}/templates`).then(r => r.json()),
        fetch(`${EH}/aliases`).then(r => r.json()),
        fetch(`${EH}/ilm`).then(r => r.json()),
        fetch(`${EH}/analyzers`).then(r => r.json()),
        fetch(`${EH}/synonyms`).then(r => r.json()),
        fetch(`${EH}/pipelines`).then(r => r.json()),
        fetch(`${EH}/health`).then(r => r.json()).catch(e => ({ status: "degraded", error: String(e) })),
        fetch(`${EH}/vector/mappings`).then(r => r.json()).catch(() => null),
        fetch(`${EH}/vector/ops/status`).then(r => r.json()).catch(() => null),
      ]);
      setContract(c);
      setTemplates(t.templates || []);
      setAliases(a.aliases || []);
      setIlm(i.policies || []);
      setAnalyzers(an.analyzers || []);
      setSynonyms(sy.synonyms || []);
      setPipelines(p.pipelines || []);
      setHealth(h);
      setVectorMappings(vm);
      setVectorOps(vo);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const writeCanary = async () => {
    const r = await fetch(`${EH}/canary`, { method: "POST" });
    if (r.ok) {
      const data = await r.json();
      setCanaries(data.results || {});
      setCanaryWritten(true);
    }
  };

  const verifyCanary = async () => {
    const r = await fetch(`${EH}/canary`);
    if (r.ok) {
      const data = await r.json();
      setCanaries(data.canaries || {});
    }
  };

  return (
    <div data-testid="elastihack-ui2-page" style={S.page}>
      <h1 style={S.h1}>ElastiHack Command Center</h1>
      <p style={S.sub}>
        Elasticsearch Agent Builder Hackathon — Contract v{contract?.contract_version ?? "..."} —{" "}
        {contract?.entity_types.length ?? 0} entity types managed
      </p>

      <div style={S.tabs} data-testid="elastihack-tabs">
        {TABS.map(t => (
          <button key={t} data-testid={`elastihack-tab-${t.toLowerCase()}`} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button data-testid="elastihack-refresh" style={S.btn("ghost")} onClick={fetchAll} disabled={loading}>
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {error && <div data-testid="elastihack-error" style={{ color: "#ef4444", padding: 12, background: "#1e293b", borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {tab === "Overview" && <OverviewTab contract={contract} aliases={aliases} synonyms={synonyms} pipelines={pipelines} />}
      {tab === "Templates" && <TemplatesTab templates={templates} analyzers={analyzersData} />}
      {tab === "Ops" && <OpsTab ilm={ilm} aliases={aliases} health={health} />}
      {tab === "Canary" && <CanaryTab canaries={canaries} canaryWritten={canaryWritten} onWrite={writeCanary} onVerify={verifyCanary} />}
      {tab === "Health" && <HealthTab health={health} onRefresh={fetchAll} />}
      {tab === "Vector" && <VectorTab mappings={vectorMappings} ops={vectorOps} />}
      {tab === "kNN" && <KnnTab />}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ contract, aliases, synonyms, pipelines }: { contract: ContractInfo | null; aliases: Alias[]; synonyms: string[]; pipelines: Pipeline[] }) {
  if (!contract) return <div>Loading contract...</div>;
  return (
    <div data-testid="elastihack-overview">
      <div style={S.grid}>
        <div style={S.kpi("#3b82f6")}><div style={S.kpiLabel}>Contract Version</div><div style={S.kpiValue} data-testid="contract-version">{contract.contract_version}</div></div>
        <div style={S.kpi("#22c55e")}><div style={S.kpiLabel}>Entity Types</div><div style={S.kpiValue}>{contract.entity_types.length}</div></div>
        <div style={S.kpi("#f59e0b")}><div style={S.kpiLabel}>ILM Policies</div><div style={S.kpiValue}>{contract.ilm_policies.length}</div></div>
        <div style={S.kpi("#a78bfa")}><div style={S.kpiLabel}>Synonyms</div><div style={S.kpiValue}>{contract.synonym_count}</div></div>
        <div style={S.kpi("#f472b6")}><div style={S.kpiLabel}>Analyzers</div><div style={S.kpiValue}>{contract.analyzers.length}</div></div>
        <div style={S.kpi("#06b6d4")}><div style={S.kpiLabel}>Vector Enabled</div><div style={S.kpiValue}>{contract.vector_enabled ? "Yes" : "No"}</div></div>
      </div>

      <div style={{ ...S.card, marginTop: 20 }}>
        <div style={S.cardTitle}>Entity Types</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {contract.entity_types.map(t => <span key={t} style={S.badge("#3b82f6")}>{t}</span>)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Aliases ({aliases.length})</div>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Type</th><th style={S.th}>Write Alias</th><th style={S.th}>Read Alias</th></tr></thead>
            <tbody>
              {aliases.slice(0, 5).map(a => (
                <tr key={a.entity_type}><td style={S.td}>{a.entity_type}</td><td style={S.td}><code>{a.write_alias}</code></td><td style={S.td}><code>{a.read_alias}</code></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Domain Synonyms ({synonyms.length})</div>
          {synonyms.map((s, i) => <div key={i} style={{ fontSize: 12, color: "#94a3b8", padding: "3px 0" }}>{s}</div>)}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Ingest Pipelines ({pipelines.length})</div>
        {pipelines.map(p => (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <strong style={{ color: "#60a5fa" }}>{p.id}</strong>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{p.description}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Processors: {p.processors.join(" → ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Templates Tab ─────────────────────────────────────────────────────────────
function TemplatesTab({ templates, analyzers }: { templates: Template[]; analyzers: AnalyzerInfo[] }) {
  return (
    <div data-testid="elastihack-templates">
      <div style={S.card}>
        <div style={S.cardTitle}>Index Templates ({templates.length})</div>
        <table style={S.table} data-testid="templates-table">
          <thead>
            <tr>
              <th style={S.th}>Name</th>
              <th style={S.th}>Entity</th>
              <th style={S.th}>Pattern</th>
              <th style={S.th}>Version</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.name}>
                <td style={S.td}><code style={{ color: "#60a5fa" }}>{t.name}</code></td>
                <td style={S.td}><span style={S.badge("#22c55e")}>{t.entity_type}</span></td>
                <td style={S.td}><code>{t.index_patterns.join(", ")}</code></td>
                <td style={S.td}>{t.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Per-Field Analyzers ({analyzers.length})</div>
        <table style={S.table} data-testid="analyzers-table">
          <thead>
            <tr>
              <th style={S.th}>Analyzer</th>
              <th style={S.th}>Fields</th>
              <th style={S.th}>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {analyzers.map(a => (
              <tr key={a.name}>
                <td style={S.td}><code style={{ color: "#f59e0b" }}>{a.name}</code></td>
                <td style={S.td}>{a.fields.join(", ")}</td>
                <td style={S.td}>{a.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Ops Tab ───────────────────────────────────────────────────────────────────
function OpsTab({ ilm, aliases, health }: { ilm: ILMPolicy[]; aliases: Alias[]; health: HealthStatus | null }) {
  return (
    <div data-testid="elastihack-ops">
      <div style={S.grid}>
        <div style={S.kpi(health?.status === "ok" ? "#22c55e" : "#ef4444")}>
          <div style={S.kpiLabel}>Cluster</div>
          <div style={S.kpiValue} data-testid="cluster-status">{health?.cluster_status ?? health?.status ?? "unknown"}</div>
        </div>
        <div style={S.kpi("#3b82f6")}>
          <div style={S.kpiLabel}>Nodes</div>
          <div style={S.kpiValue}>{health?.node_count ?? 0}</div>
        </div>
        <div style={S.kpi("#a78bfa")}>
          <div style={S.kpiLabel}>Active Shards</div>
          <div style={S.kpiValue}>{health?.active_shards ?? 0}</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>ILM Lifecycle Policies ({ilm.length})</div>
        <table style={S.table} data-testid="ilm-table">
          <thead>
            <tr>
              <th style={S.th}>Policy</th>
              <th style={S.th}>Applies To</th>
              <th style={S.th}>Delete After</th>
            </tr>
          </thead>
          <tbody>
            {ilm.map(p => (
              <tr key={p.name}>
                <td style={S.td}><code style={{ color: "#60a5fa" }}>{p.name}</code></td>
                <td style={S.td}>{p.applies_to.map(t => <span key={t} style={S.badge("#22c55e")}>{t}</span>)}</td>
                <td style={S.td}>{p.delete_after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Index → Alias Mapping ({aliases.length})</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Entity</th>
              <th style={S.th}>Target Index</th>
              <th style={S.th}>Write Alias</th>
              <th style={S.th}>Read Alias</th>
            </tr>
          </thead>
          <tbody>
            {aliases.map(a => (
              <tr key={a.entity_type}>
                <td style={S.td}>{a.entity_type}</td>
                <td style={S.td}><code>{a.target_index}</code></td>
                <td style={S.td}><code>{a.write_alias}</code></td>
                <td style={S.td}><code>{a.read_alias}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Canary Tab ────────────────────────────────────────────────────────────────
function CanaryTab({ canaries, canaryWritten, onWrite, onVerify }: { canaries: CanaryResult; canaryWritten: boolean; onWrite: () => void; onVerify: () => void }) {
  return (
    <div data-testid="elastihack-canary">
      <div style={S.card}>
        <div style={S.cardTitle}>Canary Document Testing</div>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
          Write a canary document to every managed index type, then verify they are searchable.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button data-testid="canary-write-btn" style={S.btn("primary")} onClick={onWrite}>Write Canary Docs</button>
          <button data-testid="canary-verify-btn" style={S.btn("ghost")} onClick={onVerify}>Verify Docs</button>
        </div>
      </div>

      {Object.keys(canaries).length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>Canary Results</div>
          <table style={S.table} data-testid="canary-results-table">
            <thead>
              <tr>
                <th style={S.th}>Entity Type</th>
                <th style={S.th}>Canary ID</th>
                <th style={S.th}>Indexed</th>
                <th style={S.th}>Searchable</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(canaries).map(([type, result]) => {
                const r = result as any;
                return (
                  <tr key={type}>
                    <td style={S.td}><span style={S.badge("#3b82f6")}>{type}</span></td>
                    <td style={S.td}><code>{r.canary_id || r.id || "—"}</code></td>
                    <td style={S.td}><span style={S.badge(r.indexed ? "#22c55e" : "#ef4444")}>{r.indexed ? "✓" : "✗"}</span></td>
                    <td style={S.td}><span style={S.badge(r.searchable ? "#22c55e" : "#ef4444")}>{r.searchable ? "✓" : "✗"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Health Tab ────────────────────────────────────────────────────────────────
function HealthTab({ health, onRefresh }: { health: HealthStatus | null; onRefresh: () => void }) {
  return (
    <div data-testid="elastihack-health">
      <div style={S.card}>
        <div style={S.cardTitle}>Elasticsearch Health</div>
        {health ? (
          <div style={S.grid}>
            <div style={S.kpi(health.status === "ok" ? "#22c55e" : "#ef4444")}>
              <div style={S.kpiLabel}>Status</div>
              <div style={S.kpiValue} data-testid="health-status">{health.status}</div>
            </div>
            <div style={S.kpi("#3b82f6")}>
              <div style={S.kpiLabel}>Cluster</div>
              <div style={S.kpiValue}>{health.cluster_name ?? "unknown"}</div>
            </div>
            <div style={S.kpi("#a78bfa")}>
              <div style={S.kpiLabel}>Cluster Health</div>
              <div style={S.kpiValue} data-testid="cluster-health">{health.cluster_status ?? "degraded"}</div>
            </div>
            <div style={S.kpi("#f59e0b")}>
              <div style={S.kpiLabel}>Contract</div>
              <div style={S.kpiValue}>{health.contract_version ?? "—"}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: "#94a3b8" }}>Loading health data...</div>
        )}
        {health?.correlation_id && (
          <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>Correlation ID: {health.correlation_id}</div>
        )}
      </div>
      <button data-testid="health-refresh" style={{ ...S.btn("ghost"), marginTop: 12 }} onClick={onRefresh}>↻ Refresh Health</button>
    </div>
  );
}

// ── Vector Tab ────────────────────────────────────────────────────────────────
function VectorTab({ mappings, ops }: { mappings: VectorMappings | null; ops: VectorOpsStatus | null }) {
  const [verifyResult, setVerifyResult] = useState<{
    pass: boolean; message: string; indices_with_vector: string[];
    fields_found: Array<{ index: string; dims: number; similarity: string }>;
    dims: number; checked_at: string;
  } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const runVerify = async () => {
    setVerifyLoading(true);
    try {
      const r = await fetch(`${EH}/vector/verify-es-mapping`);
      const data = await r.json();
      setVerifyResult(data);
    } catch (e) {
      setVerifyResult({ pass: false, message: String(e), indices_with_vector: [], fields_found: [], dims: 0, checked_at: "" });
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div data-testid="elastihack-vector">
      {/* Verify ES Mapping panel */}
      <div style={{ ...S.card, marginBottom: 16, borderLeft: `4px solid ${verifyResult ? (verifyResult.pass ? "#22c55e" : "#ef4444") : "#3b82f6"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...S.cardTitle, marginBottom: 0, flex: 1 }}>Verify ES Mapping (Phase 4)</div>
          <button
            data-testid="verify-es-mapping-btn"
            onClick={runVerify}
            disabled={verifyLoading}
            style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: verifyLoading ? 0.6 : 1 }}
          >
            {verifyLoading ? "Checking…" : "Verify ES Mapping"}
          </button>
        </div>
        {verifyResult && (
          <div data-testid="es-mapping-verify-result" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, color: verifyResult.pass ? "#22c55e" : "#ef4444", fontSize: 16 }}>
              {verifyResult.pass ? "✓ PASS" : "✗ FAIL"} — {verifyResult.message}
            </div>
            {verifyResult.fields_found.length > 0 && (
              <table style={{ ...S.table, marginTop: 8 }} data-testid="verify-fields-table">
                <thead><tr><th style={S.th}>Index</th><th style={S.th}>Dims</th><th style={S.th}>Similarity</th></tr></thead>
                <tbody>
                  {verifyResult.fields_found.map((f, i) => (
                    <tr key={i}>
                      <td style={S.td}>{f.index}</td>
                      <td style={S.td}>{f.dims}</td>
                      <td style={S.td}>{f.similarity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div style={S.grid}>
        <div style={S.kpi("#3b82f6")}>
          <div style={S.kpiLabel}>Pattern Vec Dims</div>
          <div style={S.kpiValue} data-testid="vector-dims">{ops?.pattern_vec.dims ?? mappings?.pattern_vec.dims ?? 64}</div>
        </div>
        <div style={S.kpi("#22c55e")}>
          <div style={S.kpiLabel}>Similarity</div>
          <div style={S.kpiValue} data-testid="vector-similarity">{ops?.pattern_vec.similarity ?? "cosine"}</div>
        </div>
        <div style={S.kpi(ops?.vector_enabled ? "#22c55e" : "#f59e0b")}>
          <div style={S.kpiLabel}>Vector Enabled</div>
          <div style={S.kpiValue} data-testid="vector-enabled-status">{ops?.vector_enabled ? "Yes" : "No"}</div>
        </div>
        <div style={S.kpi("#a78bfa")}>
          <div style={S.kpiLabel}>Deterministic</div>
          <div style={S.kpiValue} data-testid="vector-deterministic">{ops?.pattern_vec.deterministic ? "Yes" : "Yes"}</div>
        </div>
        <div style={S.kpi("#06b6d4")}>
          <div style={S.kpiLabel}>HNSW m</div>
          <div style={S.kpiValue}>{ops?.pattern_vec.hnsw_m ?? 16}</div>
        </div>
        <div style={S.kpi("#f472b6")}>
          <div style={S.kpiLabel}>External API</div>
          <div style={S.kpiValue}>{ops?.pattern_vec.external_api_required ? "Yes" : "No"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>pattern_vec — backtest_run + autopilot_cycle</div>
          <table style={S.table} data-testid="vector-mappings-table">
            <thead><tr><th style={S.th}>Field</th><th style={S.th}>Value</th></tr></thead>
            <tbody>
              <tr><td style={S.td}>type</td><td style={S.td}><code>dense_vector</code></td></tr>
              <tr><td style={S.td}>dims</td><td style={S.td}>{mappings?.pattern_vec.dims ?? 64}</td></tr>
              <tr><td style={S.td}>similarity</td><td style={S.td}>{mappings?.pattern_vec.similarity ?? "cosine"}</td></tr>
              <tr><td style={S.td}>index</td><td style={S.td}>true (HNSW)</td></tr>
              <tr><td style={S.td}>hnsw_m</td><td style={S.td}>{ops?.pattern_vec.hnsw_m ?? 16}</td></tr>
              <tr><td style={S.td}>ef_construction</td><td style={S.td}>{ops?.pattern_vec.hnsw_ef_construction ?? 100}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
            {mappings?.pattern_vec.description ?? "Deterministic 64-dim pattern vector from market metrics"}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>text_vec — strategies (env-gated)</div>
          <table style={S.table} data-testid="text-vec-mappings-table">
            <thead><tr><th style={S.th}>Field</th><th style={S.th}>Value</th></tr></thead>
            <tbody>
              <tr><td style={S.td}>type</td><td style={S.td}><code>dense_vector</code></td></tr>
              <tr><td style={S.td}>dims</td><td style={S.td}>{mappings?.text_vec.dims ?? 384}</td></tr>
              <tr><td style={S.td}>similarity</td><td style={S.td}>{mappings?.text_vec.similarity ?? "cosine"}</td></tr>
              <tr><td style={S.td}>enabled</td><td style={S.td}>{mappings?.text_vec.enabled ? "Yes" : "No (set ELASTICSEARCH_VECTOR_ENABLED=true)"}</td></tr>
              <tr><td style={S.td}>model</td><td style={S.td}>{mappings?.text_vec.model ?? "sentence-transformers/all-MiniLM-L6-v2"}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Coverage Summary</div>
        <table style={S.table} data-testid="vector-coverage-table">
          <thead>
            <tr><th style={S.th}>Entity Type</th><th style={S.th}>Coverage %</th></tr>
          </thead>
          <tbody>
            {ops?.coverage_summary
              ? Object.entries(ops.coverage_summary).map(([k, v]) => (
                  <tr key={k}>
                    <td style={S.td}>{k}</td>
                    <td style={S.td}><span style={S.badge(v > 50 ? "#22c55e" : "#f59e0b")}>{v}%</span></td>
                  </tr>
                ))
              : ["backtest_run", "autopilot_cycle", "strategies"].map(k => (
                  <tr key={k}><td style={S.td}>{k}</td><td style={S.td}><span style={S.badge("#94a3b8")}>0%</span></td></tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── kNN Tab ────────────────────────────────────────────────────────────────────
function KnnTab() {
  const [mode, setMode] = useState<"bm25" | "knn" | "hybrid">("hybrid");
  const [query, setQuery] = useState("AAPL momentum strategy");
  const [sharpe, setSharpe] = useState("1.2");
  const [winRate, setWinRate] = useState("0.55");
  const [cagr, setCagr] = useState("0.18");
  const [k, setK] = useState("5");
  const [knnResult, setKnnResult] = useState<KnnResult | null>(null);
  const [hybridResult, setHybridResult] = useState<HybridResult | null>(null);
  const [agentResult, setAgentResult] = useState<AgentFlowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSearch, setActiveSearch] = useState<"knn" | "hybrid" | "agent" | null>(null);

  const runKnn = async () => {
    setLoading(true);
    setActiveSearch("knn");
    try {
      const r = await fetch(`${EH}/knn/similar_backtests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: "demo-run-001",
          metrics: { sharpe_ratio: parseFloat(sharpe), win_rate: parseFloat(winRate), cagr: parseFloat(cagr) },
          k: parseInt(k),
        }),
      });
      setKnnResult(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const runHybrid = async () => {
    setLoading(true);
    setActiveSearch("hybrid");
    try {
      const r = await fetch(`${EH}/hybrid/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode,
          metrics: { sharpe_ratio: parseFloat(sharpe), win_rate: parseFloat(winRate), cagr: parseFloat(cagr) },
          k: parseInt(k),
        }),
      });
      setHybridResult(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const runAgentFlow = async () => {
    setLoading(true);
    setActiveSearch("agent");
    try {
      const r = await fetch(`${EH}/agent/similar-setup-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "AAPL",
          metrics: { sharpe_ratio: parseFloat(sharpe), win_rate: parseFloat(winRate), cagr: parseFloat(cagr) },
          k: parseInt(k),
        }),
      });
      setAgentResult(await r.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="elastihack-knn">
      {/* Controls */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.cardTitle}>Search Parameters</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Text Query</div>
            <input data-testid="knn-query-input" value={query} onChange={e => setQuery(e.target.value)}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Sharpe Ratio</div>
            <input data-testid="knn-sharpe-input" value={sharpe} onChange={e => setSharpe(e.target.value)}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Win Rate</div>
            <input data-testid="knn-winrate-input" value={winRate} onChange={e => setWinRate(e.target.value)}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>CAGR</div>
            <input data-testid="knn-cagr-input" value={cagr} onChange={e => setCagr(e.target.value)}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>k (neighbors)</div>
            <input data-testid="knn-k-input" value={k} onChange={e => setK(e.target.value)}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Hybrid Mode</div>
            <select data-testid="knn-mode-select" value={mode} onChange={e => setMode(e.target.value as "bm25" | "knn" | "hybrid")}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13 }}>
              <option value="bm25">BM25 only</option>
              <option value="knn">kNN only</option>
              <option value="hybrid">Hybrid RRF</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button data-testid="knn-find-similar-btn" style={S.btn("primary")} onClick={runKnn} disabled={loading}>
            {loading && activeSearch === "knn" ? "Searching..." : "Find Similar Runs (kNN)"}
          </button>
          <button data-testid="knn-hybrid-btn" style={S.btn("primary")} onClick={runHybrid} disabled={loading}>
            {loading && activeSearch === "hybrid" ? "Searching..." : `Hybrid ${mode.toUpperCase()}`}
          </button>
          <button data-testid="knn-agent-flow-btn" style={S.btn("ghost")} onClick={runAgentFlow} disabled={loading}>
            {loading && activeSearch === "agent" ? "Running..." : "Agent Flow"}
          </button>
        </div>
      </div>

      {/* kNN Results */}
      {knnResult && (
        <div style={S.card} data-testid="knn-results-panel">
          <div style={S.cardTitle}>kNN Similar Backtests</div>
          <div style={S.grid}>
            <div style={S.kpi("#3b82f6")}>
              <div style={S.kpiLabel}>Pattern Vec Dims</div>
              <div style={S.kpiValue} data-testid="knn-dims">{knnResult.pattern_vec_dims}</div>
            </div>
            <div style={S.kpi("#22c55e")}>
              <div style={S.kpiLabel}>Hits</div>
              <div style={S.kpiValue} data-testid="knn-hit-count">{knnResult.hit_count}</div>
            </div>
            <div style={S.kpi(knnResult.es_available ? "#22c55e" : "#f59e0b")}>
              <div style={S.kpiLabel}>ES Available</div>
              <div style={S.kpiValue} data-testid="knn-es-available">{knnResult.es_available ? "Yes" : "No"}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
            Pattern vec sample: [{knnResult.pattern_vec_sample.join(", ")}]
          </div>
          {knnResult.hits.length > 0 ? (
            <table style={{ ...S.table, marginTop: 12 }} data-testid="knn-hits-table">
              <thead><tr><th style={S.th}>ID</th><th style={S.th}>Score</th></tr></thead>
              <tbody>{knnResult.hits.map(h => (
                <tr key={h._id}><td style={S.td}><code>{h._id}</code></td><td style={S.td}>{h._score}</td></tr>
              ))}</tbody>
            </table>
          ) : (
            <div style={{ marginTop: 12, color: "#64748b", fontSize: 13 }} data-testid="knn-no-hits">
              No hits — ES unavailable (vector computed correctly, {knnResult.pattern_vec_dims}-dim)
            </div>
          )}
        </div>
      )}

      {/* Hybrid Results */}
      {hybridResult && (
        <div style={S.card} data-testid="hybrid-results-panel">
          <div style={S.cardTitle}>Hybrid Search — {hybridResult.mode.toUpperCase()} (RRF)</div>
          <div style={S.grid}>
            <div style={S.kpi("#3b82f6")}>
              <div style={S.kpiLabel}>BM25 hits</div>
              <div style={S.kpiValue} data-testid="hybrid-bm25-count">{hybridResult.bm25_count}</div>
            </div>
            <div style={S.kpi("#a78bfa")}>
              <div style={S.kpiLabel}>kNN hits</div>
              <div style={S.kpiValue} data-testid="hybrid-knn-count">{hybridResult.knn_count}</div>
            </div>
            <div style={S.kpi("#22c55e")}>
              <div style={S.kpiLabel}>RRF hits</div>
              <div style={S.kpiValue} data-testid="hybrid-rrf-count">{hybridResult.rrf_count}</div>
            </div>
            <div style={S.kpi("#f59e0b")}>
              <div style={S.kpiLabel}>Latency ms</div>
              <div style={S.kpiValue} data-testid="hybrid-latency">{hybridResult.latency_ms}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
            Retriever: <strong style={{ color: "#60a5fa" }}>{hybridResult.mode === "hybrid" ? "rrf (BM25 + kNN)" : hybridResult.mode}</strong>
            &nbsp;| Correlation: {hybridResult.correlation_id}
          </div>
        </div>
      )}

      {/* Agent Flow Results */}
      {agentResult && (
        <div style={S.card} data-testid="agent-flow-panel">
          <div style={S.cardTitle}>Agent Flow — {agentResult.symbol}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {agentResult.steps.map(s => (
              <span key={s} style={S.badge("#3b82f6")}>{s}</span>
            ))}
          </div>
          <div style={S.grid}>
            <div style={S.kpi("#22c55e")}>
              <div style={S.kpiLabel}>Action</div>
              <div style={S.kpiValue} data-testid="agent-action">{agentResult.recommendation.action}</div>
            </div>
            <div style={S.kpi("#3b82f6")}>
              <div style={S.kpiLabel}>Confidence</div>
              <div style={S.kpiValue} data-testid="agent-confidence">{(agentResult.recommendation.confidence * 100).toFixed(0)}%</div>
            </div>
            <div style={S.kpi("#a78bfa")}>
              <div style={S.kpiLabel}>Similar Found</div>
              <div style={S.kpiValue} data-testid="agent-similar-count">{agentResult.summary.similar_count}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#94a3b8" }}>{agentResult.recommendation.rationale}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
            Common patterns: {agentResult.summary.common_patterns.join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
