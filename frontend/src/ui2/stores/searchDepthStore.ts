/**
 * searchDepthStore.ts — Depth Upgrade D: Elastic Adapter + Provider Status + Explain
 * Pure deterministic DEMO store. Elastic is OFF by default.
 */

function fnv32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Types ──────────────────────────────────────────────────────────────────
export type SearchProvider = 'local' | 'elastic';

export interface ProviderStatus {
  active_backend: SearchProvider;
  doc_count: number;
  index_count: number;
  last_index_build: string;
  health: 'green' | 'yellow' | 'red';
  version: string;
  index_prefix: string;
  is_reachable: boolean;
}

export interface ExplainFactor {
  factor: string;
  weight: number;
  score: number;
  description: string;
}

export interface SearchExplain {
  doc_id: string;
  query: string;
  backend: SearchProvider;
  total_score: number;
  factors: ExplainFactor[];
  doc_id_hash: string;
  explain_hash: string;
}

export interface DocumentSchema {
  doc_id: string;
  doc_id_hash: string;
  entity_type: string;
  title: string;
  body: string;
  symbol: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface MappingField {
  field_name: string;
  field_type: string;
  indexed: boolean;
  analyzed: boolean;
}

export interface IndexMapping {
  index_name: string;
  fields: MappingField[];
  doc_count: number;
  last_updated: string;
}

// ─── Demo Constants ─────────────────────────────────────────────────────────
const DEMO_TS = '2026-02-15T14:30:00Z';

const DEMO_MAPPINGS: IndexMapping[] = [
  {
    index_name: 'apex-orders',
    fields: [
      { field_name: 'doc_id', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'title', field_type: 'text', indexed: true, analyzed: true },
      { field_name: 'body', field_type: 'text', indexed: true, analyzed: true },
      { field_name: 'symbol', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'entity_type', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'timestamp', field_type: 'date', indexed: true, analyzed: false },
    ],
    doc_count: 156,
    last_updated: DEMO_TS,
  },
  {
    index_name: 'apex-strategies',
    fields: [
      { field_name: 'doc_id', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'title', field_type: 'text', indexed: true, analyzed: true },
      { field_name: 'body', field_type: 'text', indexed: true, analyzed: true },
      { field_name: 'symbol', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'entity_type', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'timestamp', field_type: 'date', indexed: true, analyzed: false },
    ],
    doc_count: 42,
    last_updated: DEMO_TS,
  },
  {
    index_name: 'apex-workflows',
    fields: [
      { field_name: 'doc_id', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'title', field_type: 'text', indexed: true, analyzed: true },
      { field_name: 'body', field_type: 'text', indexed: true, analyzed: true },
      { field_name: 'entity_type', field_type: 'keyword', indexed: true, analyzed: false },
      { field_name: 'timestamp', field_type: 'date', indexed: true, analyzed: false },
    ],
    doc_count: 28,
    last_updated: DEMO_TS,
  },
];

function generateExplain(docId: string, query: string): SearchExplain {
  const docHash = fnv32(`${docId}:${DEMO_TS}`).toString(16).padStart(8, '0');
  const seed = fnv32(`${docId}:${query}:explain`);

  const factors: ExplainFactor[] = [
    {
      factor: 'tf-idf',
      weight: 0.4,
      score: Math.round(((seed % 100) / 100) * 40) / 100,
      description: `Term frequency × inverse document frequency for "${query}"`,
    },
    {
      factor: 'field_boost_title',
      weight: 0.3,
      score: Math.round(((fnv32(`${seed}:title`) % 100) / 100) * 30) / 100,
      description: 'Title field boost (2x weight)',
    },
    {
      factor: 'recency',
      weight: 0.15,
      score: Math.round(((fnv32(`${seed}:recency`) % 100) / 100) * 15) / 100,
      description: 'Document recency decay factor',
    },
    {
      factor: 'symbol_match',
      weight: 0.15,
      score: Math.round(((fnv32(`${seed}:symbol`) % 100) / 100) * 15) / 100,
      description: 'Exact symbol match bonus',
    },
  ];

  const totalScore = Math.round(factors.reduce((s, f) => s + f.score, 0) * 100) / 100;
  const explainHash = fnv32(JSON.stringify(factors)).toString(16).padStart(8, '0');

  return { doc_id: docId, query, backend: 'local', total_score: totalScore, factors, doc_id_hash: docHash, explain_hash: explainHash };
}

// ─── Store ──────────────────────────────────────────────────────────────────
type Listener = () => void;

interface State {
  providerStatus: ProviderStatus;
  mappings: IndexMapping[];
  explains: Record<string, SearchExplain>;
}

let state: State = {
  providerStatus: {
    active_backend: 'local',
    doc_count: DEMO_MAPPINGS.reduce((s, m) => s + m.doc_count, 0),
    index_count: DEMO_MAPPINGS.length,
    last_index_build: DEMO_TS,
    health: 'green',
    version: '1.0.0-demo',
    index_prefix: 'apex-',
    is_reachable: true,
  },
  mappings: DEMO_MAPPINGS,
  explains: {},
};

const listeners = new Set<Listener>();
function emit() { listeners.forEach((l) => l()); }

export const searchDepthStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  // ── Provider Status ───────────────────────────────────────────────────
  getProviderStatus: () => state.providerStatus,
  getMappings: () => state.mappings,

  // ── Explain ───────────────────────────────────────────────────────────
  getExplain(docId: string, query: string): SearchExplain {
    const key = `${docId}:${query}`;
    if (!state.explains[key]) {
      const explain = generateExplain(docId, query);
      state = { ...state, explains: { ...state.explains, [key]: explain } };
    }
    return state.explains[key];
  },

  // ── Schema Parity ─────────────────────────────────────────────────────
  getDocSchema(): MappingField[] {
    // Shared schema between local and elastic
    return DEMO_MAPPINGS[0].fields;
  },

  generateStableDocId(entityType: string, title: string): string {
    return fnv32(`${entityType}:${title}:${DEMO_TS}`).toString(16).padStart(8, '0');
  },

  // ── Health ────────────────────────────────────────────────────────────
  getSearchConfig() {
    return {
      provider: state.providerStatus.active_backend,
      elastic_configured: false,
      elastic_url: null, // never expose secrets
      index_prefix: state.providerStatus.index_prefix,
    };
  },

  reset() {
    state = {
      providerStatus: {
        active_backend: 'local',
        doc_count: DEMO_MAPPINGS.reduce((s, m) => s + m.doc_count, 0),
        index_count: DEMO_MAPPINGS.length,
        last_index_build: DEMO_TS,
        health: 'green',
        version: '1.0.0-demo',
        index_prefix: 'apex-',
        is_reachable: true,
      },
      mappings: DEMO_MAPPINGS,
      explains: {},
    };
    emit();
  },
};
