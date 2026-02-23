/**
 * SearchUXV3UI2 — W96
 *
 * Search UX v3 — facets + saved searches + explain drawer
 * Accessible at /ui2/search-v3
 */
import { useState, useCallback, useEffect } from "react";

const API = "http://localhost:8090";

interface FacetValue { key: string; count: number }
interface Facets {
  entity_type: FacetValue[];
  severity: FacetValue[];
  symbol: FacetValue[];
  run_id: FacetValue[];
}
interface Hit {
  index: string;
  id: string;
  score: number | null;
  source: Record<string, unknown>;
}
interface SearchResult {
  query: string;
  total: number;
  hits: Hit[];
  facets: Facets;
  sort_field: string;
  sort_dir: string;
}
interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  sort_field: string;
  sort_dir: string;
  pinned: boolean;
  created_at: string;
}

function useSavedSearches() {
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/v3/search-ux/saved`);
    if (r.ok) setSaved((await r.json()).searches || []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { saved, refresh: load };
}

export function SearchUXV3UI2() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState("_score");
  const [sortDir, setSortDir] = useState("desc");
  const [showExplain, setShowExplain] = useState(false);
  const [explainData, setExplainData] = useState<Record<string, unknown> | null>(null);
  const [saveName, setSaveName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const { saved, refresh: refreshSaved } = useSavedSearches();

  const handleSearch = useCallback(async (overrideQuery?: string, overrideFilters?: Record<string, string>) => {
    const q = overrideQuery ?? query;
    const f = overrideFilters ?? activeFilters;
    setSearching(true);
    try {
      const r = await fetch(`${API}/api/v3/search-ux/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          filters: f,
          sort_field: sortField,
          sort_dir: sortDir,
          size: 20,
        }),
      });
      if (r.ok) setResults(await r.json());
    } finally {
      setSearching(false);
    }
  }, [query, activeFilters, sortField, sortDir]);

  const handleExplain = async () => {
    const r = await fetch(`${API}/api/v3/search-ux/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, filters: activeFilters, sort_field: sortField, sort_dir: sortDir }),
    });
    if (r.ok) {
      setExplainData(await r.json());
      setShowExplain(true);
    }
  };

  const handleSaveSearch = async () => {
    if (!saveName.trim()) return;
    setSavingSearch(true);
    try {
      await fetch(`${API}/api/v3/search-ux/saved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName, query, filters: activeFilters, sort_field: sortField, sort_dir: sortDir }),
      });
      setSaveName("");
      await refreshSaved();
    } finally {
      setSavingSearch(false);
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await fetch(`${API}/api/v3/search-ux/saved/${id}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !pinned }),
    });
    await refreshSaved();
  };

  const handleDeleteSaved = async (id: string) => {
    await fetch(`${API}/api/v3/search-ux/saved/${id}`, { method: "DELETE" });
    await refreshSaved();
  };

  const handleLoadSaved = (s: SavedSearch) => {
    setQuery(s.query);
    setActiveFilters(s.filters as Record<string, string>);
    setSortField(s.sort_field);
    setSortDir(s.sort_dir);
    void handleSearch(s.query, s.filters as Record<string, string>);
  };

  const setFilter = (key: string, val: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (next[key] === val) delete next[key];
      else next[key] = val;
      return next;
    });
  };

  const facets = results?.facets;

  return (
    <div
      data-testid="search-v3-page"
      style={{
        padding: "24px",
        background: "var(--ui2-bg-primary)",
        minHeight: "100vh",
        color: "var(--ui2-text-primary)",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, marginBottom: "4px" }}>Search v3</h1>
        <p style={{ fontSize: "13px", color: "var(--ui2-text-muted)", margin: 0 }}>
          Facets · Saved searches · Explain drawer
        </p>
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
        <input
          data-testid="search-v3-query-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !searching && handleSearch()}
          placeholder="Search all entities…"
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
          data-testid="search-v3-submit-btn"
          onClick={() => handleSearch()}
          disabled={searching}
          style={{
            padding: "9px 20px",
            borderRadius: "8px",
            background: "var(--ui2-accent)",
            color: "#fff",
            border: "none",
            cursor: searching ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 600,
            opacity: searching ? 0.6 : 1,
          }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
        <button
          data-testid="search-v3-explain-btn"
          onClick={handleExplain}
          style={{
            padding: "9px 14px",
            borderRadius: "8px",
            background: "var(--ui2-bg-secondary)",
            color: "var(--ui2-text-primary)",
            border: "1px solid var(--ui2-border)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Explain
        </button>
      </div>

      {/* Sort controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--ui2-text-muted)" }}>Sort:</span>
        <select
          data-testid="search-v3-sort-field"
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: "6px", background: "var(--ui2-bg-secondary)", border: "1px solid var(--ui2-border)", color: "var(--ui2-text-primary)", fontSize: "12px" }}
        >
          <option value="_score">Relevance</option>
          <option value="timestamp">Date</option>
          <option value="severity">Severity</option>
        </select>
        <select
          data-testid="search-v3-sort-dir"
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: "6px", background: "var(--ui2-bg-secondary)", border: "1px solid var(--ui2-border)", color: "var(--ui2-text-primary)", fontSize: "12px" }}
        >
          <option value="desc">↓ Desc</option>
          <option value="asc">↑ Asc</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 240px", gap: "16px" }}>
        {/* Facets sidebar */}
        <div data-testid="search-v3-facets-panel">
          {/* Entity type facet */}
          {facets && facets.entity_type.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ui2-text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                Entity Type
              </div>
              {facets.entity_type.map((fv) => {
                const label = fv.key.replace("apex-", "").replace("-read", "").replace(/-\d{4}.*/, "");
                return (
                  <div
                    key={fv.key}
                    data-testid={`facet-entity-${label}`}
                    onClick={() => setFilter("entity_type", label)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      background: activeFilters.entity_type === label ? "rgba(59,130,246,0.15)" : "transparent",
                      color: activeFilters.entity_type === label ? "#3b82f6" : "var(--ui2-text-primary)",
                    }}
                  >
                    <span>{label}</span>
                    <span style={{ color: "var(--ui2-text-muted)" }}>{fv.count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Severity facet */}
          {facets && facets.severity.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ui2-text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                Severity
              </div>
              {facets.severity.map((fv) => (
                <div
                  key={fv.key}
                  data-testid={`facet-severity-${fv.key}`}
                  onClick={() => setFilter("severity", fv.key)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    background: activeFilters.severity === fv.key ? "rgba(59,130,246,0.15)" : "transparent",
                  }}
                >
                  <span>{fv.key}</span>
                  <span style={{ color: "var(--ui2-text-muted)" }}>{fv.count}</span>
                </div>
              ))}
            </div>
          )}

          {!facets && (
            <div style={{ fontSize: "12px", color: "var(--ui2-text-muted)", fontStyle: "italic" }}>
              Run a search to see facets
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {results && (
            <div>
              <div
                data-testid="search-v3-result-count"
                style={{ fontSize: "13px", color: "var(--ui2-text-muted)", marginBottom: "12px" }}
              >
                {results.total} results for "<strong>{results.query || "*"}</strong>"
              </div>
              <div data-testid="search-v3-results-list">
                {results.hits.length === 0 && (
                  <div style={{ fontSize: "13px", color: "var(--ui2-text-muted)", fontStyle: "italic", padding: "16px" }}>
                    No results
                  </div>
                )}
                {results.hits.map((hit, i) => {
                  const entityType = hit.index.replace("apex-", "").replace("-read", "").replace(/-\d{4}.*/, "");
                  return (
                    <div
                      key={hit.id}
                      data-testid={`search-v3-result-${i}`}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        marginBottom: "8px",
                        background: "var(--ui2-bg-panel)",
                        border: "1px solid var(--ui2-border)",
                      }}
                    >
                      <div style={{ display: "flex", gap: "8px", marginBottom: "4px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "8px", background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontWeight: 600 }}>
                          {entityType}
                        </span>
                        {hit.score !== null && (
                          <span style={{ fontSize: "11px", color: "var(--ui2-text-muted)" }}>
                            score: {hit.score.toFixed(3)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--ui2-text-muted)" }}>
                        {hit.id}
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        {Object.entries(hit.source).slice(0, 3).map(([k, v]) => (
                          <span key={k} style={{ fontSize: "11px", color: "var(--ui2-text-muted)", marginRight: "10px" }}>
                            <strong>{k}:</strong> {String(v).slice(0, 30)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!results && (
            <div
              data-testid="search-v3-empty-state"
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
              Enter a query and click Search
            </div>
          )}
        </div>

        {/* Saved searches */}
        <div>
          {/* Save current search */}
          <div
            style={{
              background: "var(--ui2-bg-panel)",
              border: "1px solid var(--ui2-border)",
              borderRadius: "var(--ui2-radius-md)",
              padding: "12px",
              marginBottom: "14px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>Save Search</div>
            <input
              data-testid="search-v3-save-name-input"
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name…"
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid var(--ui2-border)",
                background: "var(--ui2-bg-secondary)",
                color: "var(--ui2-text-primary)",
                fontSize: "12px",
                marginBottom: "8px",
                boxSizing: "border-box",
              }}
            />
            <button
              data-testid="search-v3-save-btn"
              onClick={handleSaveSearch}
              disabled={savingSearch || !saveName.trim()}
              style={{
                width: "100%",
                padding: "6px",
                borderRadius: "6px",
                background: "var(--ui2-accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                opacity: !saveName.trim() ? 0.5 : 1,
              }}
            >
              {savingSearch ? "Saving…" : "Save"}
            </button>
          </div>

          {/* Saved searches list */}
          <div
            style={{
              background: "var(--ui2-bg-panel)",
              border: "1px solid var(--ui2-border)",
              borderRadius: "var(--ui2-radius-md)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--ui2-border)", fontSize: "12px", fontWeight: 600 }}>
              Saved ({saved.length})
            </div>
            <div data-testid="search-v3-saved-list" style={{ maxHeight: "300px", overflowY: "auto" }}>
              {saved.length === 0 && (
                <div style={{ padding: "12px", fontSize: "11px", color: "var(--ui2-text-muted)", fontStyle: "italic" }}>
                  No saved searches
                </div>
              )}
              {saved.map((s) => (
                <div
                  key={s.id}
                  data-testid={`saved-search-row-${s.id}`}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--ui2-border)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    onClick={() => handleLoadSaved(s)}
                    style={{ fontSize: "12px", fontWeight: 600, color: "var(--ui2-text-primary)" }}
                  >
                    {s.pinned ? "📌 " : ""}{s.name}
                  </div>
                  {s.query && (
                    <div style={{ fontSize: "11px", color: "var(--ui2-text-muted)", marginTop: "1px" }}>
                      {s.query.slice(0, 30)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <button
                      data-testid={`saved-search-pin-${s.id}`}
                      onClick={() => handlePin(s.id, s.pinned)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "10px", color: "var(--ui2-text-muted)", padding: "0" }}
                    >
                      {s.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      data-testid={`saved-search-delete-${s.id}`}
                      onClick={() => handleDeleteSaved(s.id)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "10px", color: "#ef4444", padding: "0" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Explain drawer */}
      {showExplain && explainData && (
        <div
          data-testid="search-v3-explain-drawer"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "380px",
            height: "100vh",
            background: "var(--ui2-bg-panel)",
            borderLeft: "1px solid var(--ui2-border)",
            padding: "20px",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Query Explain</h3>
            <button
              data-testid="search-v3-explain-close"
              onClick={() => setShowExplain(false)}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--ui2-text-muted)" }}
            >
              ×
            </button>
          </div>
          <pre
            data-testid="search-v3-explain-content"
            style={{
              fontSize: "11px",
              fontFamily: "monospace",
              color: "var(--ui2-text-primary)",
              margin: 0,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(explainData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
