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

const TABS = ["Overview", "Templates", "Ops", "Canary", "Health"] as const;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, t, a, i, an, sy, p, h] = await Promise.all([
        fetch(`${EH}/contract`).then(r => r.json()),
        fetch(`${EH}/templates`).then(r => r.json()),
        fetch(`${EH}/aliases`).then(r => r.json()),
        fetch(`${EH}/ilm`).then(r => r.json()),
        fetch(`${EH}/analyzers`).then(r => r.json()),
        fetch(`${EH}/synonyms`).then(r => r.json()),
        fetch(`${EH}/pipelines`).then(r => r.json()),
        fetch(`${EH}/health`).then(r => r.json()).catch(e => ({ status: "degraded", error: String(e) })),
      ]);
      setContract(c);
      setTemplates(t.templates || []);
      setAliases(a.aliases || []);
      setIlm(i.policies || []);
      setAnalyzers(an.analyzers || []);
      setSynonyms(sy.synonyms || []);
      setPipelines(p.pipelines || []);
      setHealth(h);
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

// ── Health Tab ─────────────────────────────────────────────────────────────────
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
