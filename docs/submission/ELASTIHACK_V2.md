# Apex Terminal — ElastiHack Submission v2

## Elevator Pitch

Apex Terminal is a **production-grade algorithmic trading platform** that uses Elasticsearch as its backbone for search, observability, and AI agent orchestration. It demonstrates how ES can power a complete financial technology stack — from real-time backtest indexing to AI-assisted compliance gatekeeping.

## How Elasticsearch Is Used

### 1. Unified Contract Architecture (v5.0)
- **8 entity types** managed under strict mappings: events, strategies, backtests, workflows, jobs, tickets, edges, tool_traces
- **Doc ID hashing**: SHA-256 first 24 chars for deterministic, idempotent upserts
- **Alias convention**: `apex-{type}-write` / `apex-{type}-read` for zero-downtime reindex
- **3 ILM policies**: high-volume (90d), standard (365d), audit (730d)
- **2 ingest pipelines**: default (timestamp + secret removal) and backtest-specific (CAGR bucketing)

### 2. Search UX with Domain Intelligence
- **9 finance-domain synonym rules**: backtest↔bt↔simulation, sharpe↔sharpe_ratio, drawdown↔dd↔max_dd
- **Edge n-gram analyzer**: autocomplete on strategy names and agent names
- **Faceted search**: per-entity-type counts, sort, explain drawer
- **Saved searches**: CRUD with pinning, recent search history
- **Query explain**: shows analyzer chain, synonym expansion, score field contributions

### 3. Elastic Agent Builder Integration
- Remote agent execution via `ELASTIC_AGENT_URL` + API key
- Local fallback with 5 tools: search, fetch_entity, fetch_graph, summarize, create_ticket
- Full audit trail in SQLite + ES dual-write
- Secret redaction via regex before indexing

### 4. Evidence Graph
- BFS traversal across backtest runs, strategies, data sources
- SQLite nodes + edges with ES-backed edge indexing for search
- Lineage tracking: which data fed which backtest with which strategy

### 5. Dead Letter Queue (DLQ)
- Failed ES writes captured in DLQ with retry metadata
- Rate-limited drain with configurable batch size
- Inject test entries for E2E validation
- DB↔ES lag monitoring per entity type with SLO thresholds

### 6. Canary Testing
- Write a canary document to every managed index type
- Verify searchability across all 8 entity types
- Per-type health status reporting

### 7. Ops Observability
- Cluster health with correlation IDs for incident tracking
- Index sizes, doc counts, ILM phase per index
- Query latency percentiles (p50/p95/p99)
- Ingest throughput metrics (docs/sec, total indexed/failed)
- Evidence integrity checks (missing edges, orphan docs)

### 8. Hybrid Search (env-gated)
- Vector search via `ELASTICSEARCH_VECTOR_ENABLED` env flag
- Embedding model: sentence-transformers/all-MiniLM-L6-v2
- Hybrid weight: 60% BM25 / 40% vector

## API Surface

**31 endpoints** under `/api/v4/elastihack/*`:

| Endpoint | Method | Wave | Description |
|---|---|---|---|
| `/contract` | GET | 001 | ES contract version + config |
| `/templates` | GET | 002 | 8 index templates |
| `/aliases` | GET | 003 | Read/write aliases per type |
| `/ilm` | GET | 004 | 3 ILM lifecycle policies |
| `/reindex/plan` | POST | 005 | Dry-run reindex planner |
| `/canary` | POST/GET | 006 | Write + verify canary docs |
| `/analyzers` | GET | 007 | 5 per-field analyzers |
| `/autocomplete` | POST | 007 | Edge n-gram autocomplete |
| `/synonyms` | GET | 008 | 9 domain synonym rules |
| `/pipelines` | GET | 009 | 2 ingest pipelines |
| `/health` | GET | 010 | Hard error with correlation_id |
| `/bulk` | POST | 011 | Idempotent bulk indexer |
| `/dlq` | GET | 012 | List DLQ entries |
| `/dlq/drain` | POST | 013 | Rate-limited DLQ drain |
| `/dlq/inject` | POST | 013 | Test DLQ injection |
| `/lag` | GET | 014 | DB↔ES lag per type |
| `/throughput` | GET | 016 | Ingest pipeline metrics |
| `/search` | POST | 021 | Faceted search + explain |
| `/saved-searches` | GET/POST/DELETE | 023 | Saved search CRUD |
| `/recent-searches` | GET | 026 | Recent search history |
| `/export` | GET | 029 | JSON/CSV export |
| `/hybrid/status` | GET | 051 | Vector search status |
| `/ops/cluster` | GET | 061 | Cluster health + indices |
| `/ops/indices` | GET | 062 | Index sizes + ILM phase |
| `/ops/latency` | GET | 063 | Query latency percentiles |
| `/ops/lag-timeline` | GET | 064 | Ingest lag timeline |
| `/ops/integrity` | GET | 066 | Evidence integrity checks |
| `/ops/status` | GET | 068 | Unified observability |

## UI Pages

| Page | Path | Description |
|---|---|---|
| ElastiHack Command Center | `/ui2/elastihack` | 5-tab dashboard: Overview, Templates, Ops, Canary, Health |
| Query Studio | `/ui2/query-studio` | Search with facets, explain, saved searches, autocomplete |
| DLQ Ops | `/ui2/dlq-ops` | 5-tab ingest ops: DLQ, Throughput, Lag, Indices, Integrity |
| Agent Builder | `/ui2/agent-builder` | Create + run agents with tool trace + citations |
| Evidence Graph | `/ui2/evidence` | BFS graph traversal, lineage visualization |
| Search v3 | `/ui2/search-v3` | Faceted search with explain drawer |
| Convergence Cockpit | `/ui2/convergence` | Unified view: search + graph + agent trace |
| ES Ops | `/ui2/es-ops` | Elasticsearch cluster status |

## Elasticsearch Features Used

| Feature | Where Used |
|---|---|
| Index Templates | 8 strict-mapped templates for all entity types |
| Aliases (read/write) | Zero-downtime reindex support |
| ILM Policies | 3 retention tiers (90d/365d/730d) |
| Ingest Pipelines | Timestamp injection, secret removal, CAGR bucketing |
| Custom Analyzers | edge_ngram (autocomplete), synonym (domain terms) |
| Bulk API | Idempotent upsert with SHA-256 doc IDs |
| Query Explain | Score breakdown per field with synonym expansion |
| Cluster Health API | Hard error UX with correlation IDs |
| KNN/Vector (gated) | Hybrid search 60/40 BM25/vector split |
| Delete by Query | Canary cleanup, data isolation |
| Refresh=true | Deterministic E2E testing |

## Demo Script (~3 min)

**Minute 0:00–1:00 — ElastiHack Command Center:**
- Navigate to `/ui2/elastihack`
- Show contract v5.0 with 8 entity types
- Click Templates tab → 8 strict-mapped templates
- Click Canary tab → Write + Verify canary docs across all types

**Minute 1:00–2:00 — Query Studio + Agent:**
- Navigate to `/ui2/query-studio`
- Search "backtest" with Explain enabled → synonym expansion (bt, simulation)
- Save the search, show it in saved panel
- Navigate to `/ui2/agent-builder`
- Run agent query "analyze AAPL backtest results" → tool trace + citations

**Minute 2:00–3:00 — DLQ Ops + Evidence:**
- Navigate to `/ui2/dlq-ops`
- Inject test DLQ entry → observe in table
- Drain DLQ → verify empty
- Show Throughput + Integrity tabs
- Navigate to `/ui2/evidence` → BFS graph traversal

## Technical Stack

- **Backend**: FastAPI (Python 3.14), 70+ routers, 31 ElastiHack endpoints
- **Frontend**: React + TypeScript + Vite, 96 UI2 pages
- **Data**: SQLite (durable) + Elasticsearch (searchable) dual-write
- **AI**: Elastic Agent Builder (remote) + local agent tools (fallback)
- **Testing**: Playwright E2E (headed Chrome, 57+ specs) + pytest (1614 tests)
- **Search**: BM25 + domain synonyms + edge n-gram + optional vector KNN
