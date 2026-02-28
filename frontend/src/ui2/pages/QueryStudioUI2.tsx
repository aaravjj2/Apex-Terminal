/**
 * QueryStudioUI2 — ElastiHack Wave 021-030
 *
 * Full-featured Query Studio: search with facets, synonym expansion,
 * explain drawer, saved searches, recent searches, export.
 *
 * Accessible at /ui2/query-studio
 */
import { useState, useCallback, useEffect } from "react";

const API = "";
const EH = `${API}/api/v4/elastihack`;

// ── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  results: any[];
  total: number;
  facets: Record<string, number>;
  explain: any;
  latency_ms: number;
  correlation_id: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  pinned: boolean;
  created_at: string;
}

interface RecentSearch {
  query: string;
  entity_type: string | null;
  timestamp: string;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: { height: "100%", overflow: "auto", padding: 24, color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" } as const,
  h1: { fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.5px" } as const,
  sub: { fontSize: 13, color: "#94a3b8", marginBottom: 24 } as const,
  searchBar: { display: "flex", gap: 8, marginBottom: 20 } as const,
  input: { flex: 1, padding: "12px 18px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 15, outline: "none" } as const,
  select: { padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 13 } as const,
  btn: (variant: "primary" | "ghost" | "danger" = "primary") => ({
    padding: "10px 22px",
    background: variant === "primary" ? "#3b82f6" : variant === "danger" ? "#ef4444" : "transparent",
    color: variant === "ghost" ? "#94a3b8" : "#fff",
    border: variant === "ghost" ? "1px solid #334155" : "none",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
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
  }),
  grid: { display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" } as const,
  sidebar: { display: "flex", flexDirection: "column" as const, gap: 12 } as const,
  table: { width: "100%", fontSize: 13, borderCollapse: "collapse" as const } as const,
  th: { textAlign: "left" as const, padding: "10px 12px", borderBottom: "1px solid #334155", color: "#94a3b8", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const } as const,
  td: { padding: "10px 12px", borderBottom: "1px solid #1e293b" } as const,
  explain: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 16, marginTop: 12, fontSize: 12, color: "#94a3b8" } as const,
};

const ENTITY_TYPES = ["events", "strategies", "backtests", "workflows", "jobs", "tickets", "edges", "tool_traces"];

export function QueryStudioUI2() {
  const [query, setQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [explain, setExplain] = useState(false);
  const [sortField, setSortField] = useState("_score");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved searches
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Recent searches
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const loadSaved = useCallback(async () => {
    try {
      const r = await fetch(`${EH}/saved-searches`);
      if (r.ok) setSaved((await r.json()).searches || []);
    } catch { /* */ }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const r = await fetch(`${EH}/recent-searches`);
      if (r.ok) setRecent((await r.json()).searches || []);
    } catch { /* */ }
  }, []);

  useEffect(() => { void loadSaved(); void loadRecent(); }, [loadSaved, loadRecent]);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${EH}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          entity_type: entityFilter || undefined,
          explain,
          sort_field: sortField,
        }),
      });
      if (r.ok) {
        setResult(await r.json());
        void loadRecent();
      } else {
        setError(`Search failed: ${r.status}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query, entityFilter, explain, sortField, loadRecent]);

  const saveSearch = async () => {
    if (!saveName.trim() || !query.trim()) return;
    const r = await fetch(`${EH}/saved-searches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveName, query, filters: { entity_type: entityFilter } }),
    });
    if (r.ok) {
      setShowSaveForm(false);
      setSaveName("");
      void loadSaved();
    }
  };

  const deleteSaved = async (id: string) => {
    await fetch(`${EH}/saved-searches/${id}`, { method: "DELETE" });
    void loadSaved();
  };

  const applySaved = (s: SavedSearch) => {
    setQuery(s.query);
    setEntityFilter(s.filters?.entity_type || "");
  };

  const doAutocomplete = async (prefix: string) => {
    if (prefix.length < 2) { setSuggestions([]); return; }
    try {
      const r = await fetch(`${EH}/autocomplete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, field: "strategy_name", size: 5 }),
      });
      if (r.ok) setSuggestions((await r.json()).suggestions || []);
    } catch { /* */ }
  };

  return (
    <div data-testid="query-studio-ui2-page" style={S.page}>
      <h1 style={S.h1}>Query Studio</h1>
      <p style={S.sub}>Search across all Elasticsearch indices — facets, explain, autocomplete, saved searches</p>

      {/* Search Bar */}
      <div style={S.searchBar} data-testid="query-bar">
        <input
          data-testid="query-input"
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); void doAutocomplete(e.target.value); }}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Search backtests, strategies, agents, events..."
          style={S.input}
        />
        <select data-testid="entity-filter" value={entityFilter} onChange={e => setEntityFilter(e.target.value)} style={S.select}>
          <option value="">All Types</option>
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
          <input data-testid="explain-toggle" type="checkbox" checked={explain} onChange={e => setExplain(e.target.checked)} />
          Explain
        </label>
        <button data-testid="search-btn" style={S.btn("primary")} onClick={doSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Autocomplete Suggestions */}
      {suggestions.length > 0 && (
        <div data-testid="autocomplete-suggestions" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {suggestions.map(s => (
            <button key={s} style={S.badge("#06b6d4")} onClick={() => { setQuery(s); setSuggestions([]); }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <div data-testid="query-error" style={{ color: "#ef4444", padding: 12, background: "#1e293b", borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      <div style={S.grid}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          {/* Saved Searches */}
          <div style={S.card} data-testid="saved-searches-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={S.cardTitle}>Saved Searches</div>
              <button data-testid="save-search-toggle" style={S.btn("ghost")} onClick={() => setShowSaveForm(!showSaveForm)}>+ Save</button>
            </div>
            {showSaveForm && (
              <div style={{ marginBottom: 12, display: "flex", gap: 4 }}>
                <input
                  data-testid="save-name-input"
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Name..."
                  style={{ ...S.input, flex: 1, padding: "6px 10px", fontSize: 12 }}
                />
                <button data-testid="save-confirm-btn" style={S.btn("primary")} onClick={saveSearch}>Save</button>
              </div>
            )}
            {saved.length === 0 ? (
              <div style={{ fontSize: 12, color: "#64748b" }}>No saved searches</div>
            ) : saved.map(s => (
              <div key={s.id} data-testid={`saved-${s.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #0f172a" }}>
                <button style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 12 }} onClick={() => applySaved(s)}>
                  {s.pinned && "📌 "}{s.name}
                </button>
                <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 10 }} onClick={() => deleteSaved(s.id)}>✕</button>
              </div>
            ))}
          </div>

          {/* Recent Searches */}
          <div style={S.card} data-testid="recent-searches-panel">
            <div style={S.cardTitle}>Recent Searches</div>
            {recent.length === 0 ? (
              <div style={{ fontSize: 12, color: "#64748b" }}>No recent searches</div>
            ) : recent.slice(0, 10).map((r, i) => (
              <div key={i} style={{ padding: "4px 0", fontSize: 12, color: "#94a3b8", cursor: "pointer" }} onClick={() => setQuery(r.query)}>
                {r.query} {r.entity_type && <span style={S.badge("#64748b")}>{r.entity_type}</span>}
              </div>
            ))}
          </div>

          {/* Facets */}
          {result && (
            <div style={S.card} data-testid="facets-panel">
              <div style={S.cardTitle}>Facets</div>
              {Object.entries(result.facets).map(([type, count]) => (
                <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                  <button
                    style={{ background: "none", border: "none", color: entityFilter === type ? "#60a5fa" : "#94a3b8", cursor: "pointer", fontSize: 12 }}
                    onClick={() => setEntityFilter(type === entityFilter ? "" : type)}
                  >
                    {type}
                  </button>
                  <span style={{ color: "#64748b" }}>{count as number}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Results */}
        <div>
          {result && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  <strong data-testid="result-total">{result.total}</strong> results in{" "}
                  <strong data-testid="result-latency">{result.latency_ms}ms</strong>
                  {result.correlation_id && <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>CID: {result.correlation_id}</span>}
                </div>
                <button data-testid="export-btn" style={S.btn("ghost")} onClick={() => window.open(`${EH}/export?format=json`)}>
                  ⬇ Export
                </button>
              </div>

              {result.results.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.results.map((r: any, i: number) => (
                    <div key={i} style={S.card}>
                      <pre style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{JSON.stringify(r, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div data-testid="no-results" style={{ ...S.card, textAlign: "center", color: "#64748b" }}>
                  No results for "{query}". Try different search terms or remove filters.
                </div>
              )}

              {/* Explain Drawer */}
              {result.explain && (
                <div data-testid="explain-drawer" style={S.explain}>
                  <div style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Query Explain</div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Analyzers Used:</strong> {result.explain.analyzers_used?.join(", ")}
                  </div>
                  {result.explain.synonym_expansion && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>Synonym Expansion:</strong> {result.explain.synonym_expansion.join(", ")}
                    </div>
                  )}
                  {result.explain.score_contributions && (
                    <div>
                      <strong>Score Contributions:</strong>
                      {result.explain.score_contributions.map((c: any, i: number) => (
                        <div key={i} style={{ marginLeft: 12, marginTop: 4 }}>
                          {c.field}: weight={c.weight}, matched={String(c.matched)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div style={{ ...S.card, textAlign: "center", color: "#64748b", padding: 48 }}>
              Enter a search query above to begin exploring your Elasticsearch indices.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
