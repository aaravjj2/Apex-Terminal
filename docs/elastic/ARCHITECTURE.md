# ElastiHack Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        APEX TERMINAL — ElastiHack                       │
│                Elasticsearch Agent Builder Hackathon Entry               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────── FRONTEND (Vite + React) ───────────────────┐  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ ElastiHack   │  │ Query Studio │  │ DLQ Ops      │            │  │
│  │  │ Command Ctr  │  │ Search/Facets│  │ Ingest Mgmt  │            │  │
│  │  │ 5 tabs       │  │ Explain/Save │  │ 5 tabs       │            │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │  │
│  │         │                  │                  │                    │  │
│  │  ┌──────┴──────┐  ┌───────┴───────┐  ┌──────┴───────┐           │  │
│  │  │ Agent       │  │ Evidence Graph│  │ Convergence  │            │  │
│  │  │ Builder     │  │ Search/BFS   │  │ Cockpit      │            │  │
│  │  │ CRUD + Trace│  │ Lineage      │  │ Unified View │            │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │  │
│  │         └─────────────────┼─────────────────┘                    │  │
│  │                           │                                       │  │
│  └───────────────────────────┼───────────────────────────────────────┘  │
│                              │ HTTP/REST                                │
│  ┌───────────────────────────┼───────────────────────────────────────┐  │
│  │                    BACKEND (FastAPI + Python)                      │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │              /api/v4/elastihack (Unified Router)            │   │  │
│  │  │                                                            │   │  │
│  │  │  Wave 001: /contract — ES contract v5.0                    │   │  │
│  │  │  Wave 002: /templates — 8 index templates                  │   │  │
│  │  │  Wave 003: /aliases — read/write per type                  │   │  │
│  │  │  Wave 004: /ilm — 3 lifecycle policies                     │   │  │
│  │  │  Wave 005: /reindex/plan — dry-run reindex                 │   │  │
│  │  │  Wave 006: /canary — write + verify per index              │   │  │
│  │  │  Wave 007: /analyzers + /autocomplete — edge_ngram         │   │  │
│  │  │  Wave 008: /synonyms — 9 domain synonym rules              │   │  │
│  │  │  Wave 009: /pipelines — 2 ingest pipelines                 │   │  │
│  │  │  Wave 010: /health — hard error, correlation_id            │   │  │
│  │  │  Wave 011: /bulk — idempotent upsert                       │   │  │
│  │  │  Wave 012: /dlq — dead letter queue                        │   │  │
│  │  │  Wave 013: /dlq/drain + /dlq/inject                        │   │  │
│  │  │  Wave 014: /lag — DB↔ES lag per type                       │   │  │
│  │  │  Wave 016: /throughput — ingest metrics                    │   │  │
│  │  │  Wave 021: /search — facets + explain + synonym expansion  │   │  │
│  │  │  Wave 023: /saved-searches — CRUD + pin                    │   │  │
│  │  │  Wave 026: /recent-searches                                │   │  │
│  │  │  Wave 029: /export — JSON/CSV                              │   │  │
│  │  │  Wave 051: /hybrid/status — vector env-gated               │   │  │
│  │  │  Wave 061: /ops/cluster — node stats                       │   │  │
│  │  │  Wave 062: /ops/indices — sizes, ILM phase                 │   │  │
│  │  │  Wave 063: /ops/latency — p50/p95/p99                      │   │  │
│  │  │  Wave 064: /ops/lag-timeline                               │   │  │
│  │  │  Wave 066: /ops/integrity — edge validation                │   │  │
│  │  │  Wave 068: /ops/status — unified observability             │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │  │
│  │  │ es_contract  │  │ es_templates │  │ evidence_graph       │    │  │
│  │  │ doc_id()     │  │ 7 entity     │  │ SQLite + ES edges    │    │  │
│  │  │ SHA-256 24ch │  │ strict maps  │  │ BFS traversal        │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘    │  │
│  │                                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │  │
│  │  │ agent_tools  │  │ agent_builder│  │ search_ux_v3         │    │  │
│  │  │ 5 tools      │  │ CRUD + remote│  │ faceted search       │    │  │
│  │  │ audit trail  │  │ ES Agent API │  │ saved + explain      │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘    │  │
│  │                                                                    │  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
│                              │                                          │
│  ┌───────────────────────────┼───────────────────────────────────────┐  │
│  │               DATA LAYER (Dual-Write Pattern)                     │  │
│  │                                                                    │  │
│  │  ┌──────────────────┐          ┌────────────────────────────┐     │  │
│  │  │   SQLite (local)  │  dual   │   Elasticsearch (9200)     │     │  │
│  │  │   durable store   │ ◄─────► │   searchable store         │     │  │
│  │  │                   │  write  │                             │     │  │
│  │  │  • agent_runs     │         │  • apex-events-*           │     │  │
│  │  │  • tool_traces    │         │  • apex-strategies-*       │     │  │
│  │  │  • graph_nodes    │         │  • apex-backtests-*        │     │  │
│  │  │  • graph_edges    │         │  • apex-workflows-*        │     │  │
│  │  │  • elastic_agents │         │  • apex-jobs-*             │     │  │
│  │  │  • saved_searches │         │  • apex-tickets-*          │     │  │
│  │  │  • backtest_runs  │         │  • apex-edges-*            │     │  │
│  │  │                   │         │  • apex-tool_traces-*      │     │  │
│  │  └──────────────────┘          └────────────────────────────┘     │  │
│  │                                         │                         │  │
│  │                                    ┌────┴────┐                    │  │
│  │                                    │  ILM    │                    │  │
│  │                                    │ high-vol│                    │  │
│  │                                    │ standard│                    │  │
│  │                                    │ audit   │                    │  │
│  │                                    └─────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────── TESTING (Playwright + pytest) ─────────────────┐  │
│  │                                                                    │  │
│  │  • 31 API endpoints tested (elastihack.spec.ts)                   │  │
│  │  • 3 UI pages tested (headed Chrome, data-testid selectors)       │  │
│  │  • 1614 pytest unit tests passing                                 │  │
│  │  • 370 vitest frontend tests passing                              │  │
│  │  • Screenshots captured to playwright_proof/                      │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Differentiators

1. **Dual-Write Pattern**: SQLite (durable) + Elasticsearch (searchable) — no data loss
2. **Contract-First**: All ES operations governed by `CONTRACT.md` v5.0
3. **31 API Endpoints**: Unified under `/api/v4/elastihack/*`
4. **3 Purpose-Built UI Pages**: ElastiHack Command Center, Query Studio, DLQ Ops
5. **Elastic Agent Builder Integration**: Remote agent execution with fallback
6. **Evidence Graph**: BFS traversal with ES-backed edge indexing
7. **Domain Synonyms**: 9 finance-specific synonym rules for query expansion
8. **DLQ with Drain/Inject**: Full dead letter queue lifecycle management
9. **Canary Testing**: Per-index canary document write + verify
10. **ILM Policies**: High-volume, standard, and audit retention tiers
