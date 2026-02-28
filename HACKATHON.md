# HACKATHON.MD — Elasticsearch Vector Search Hackathon (Devpost)

## Apex Terminal: Elasticsearch-Powered Trading Intelligence

### The Problem We Solve

Algorithmic traders manage hundreds of backtests, strategies, and trading cycles. Finding "that strategy from 3 months ago that performed similarly to today's market" requires searching by **execution pattern**, not just text. Traditional SQL databases can't do vector similarity search — but Elasticsearch can.

### Novel Application: Vector Search for Financial Pattern Recognition

Apex Terminal is the **first trading platform to use Elasticsearch dense_vector kNN search for financial strategy fingerprinting**. Every backtest and strategy is encoded as a 64-dimensional vector (win rate, drawdown, Sharpe ratio, trade frequency, Greeks sensitivity) and stored in Elasticsearch. Traders can find similar strategies by performance pattern — no other open-source trading platform does this.

### Complete Elasticsearch Search Stack (4 retrieval methods)

1. **BM25** — Full-text search via multi_match across all entity types
2. **Dense Vector kNN** — 64-dim cosine similarity for strategy pattern matching
3. **Hybrid BM25+kNN with RRF** — Reciprocal Rank Fusion combining both methods
4. **ELSER Semantic Search** — text_expansion with `.elser_model_2` (fallback to BM25)

This covers **all four Elasticsearch retrieval paradigms** in a single application.

### Real-World Use Cases

1. **Strategy Similarity Discovery**: kNN vector search finds historically similar strategies by their 64-dim performance fingerprint — helps researchers learn from past outcomes.
2. **Backtest Pattern Matching**: Hybrid BM25+kNN with RRF finds similar backtests by name AND execution pattern simultaneously.
3. **Compliance Event Audit**: Append-only audit trail on `apex-events` enables sub-second compliance investigation across millions of records.
4. **Risk Control Graph Traversal**: Graph edges in `apex-controls-edges` model portfolio→position→risk relationships for real-time exposure monitoring.

### Why Elasticsearch as Primary Storage?

Financial platforms need sub-second full-text search AND vector similarity in one system. Elasticsearch's inverted index + dense_vector fields provide both — no separate vector database needed. All domain entities (backtests, strategies, autopilot cycles, events, tickets, controls) are stored in ES across **24 indices** with **400+ documents**.

### Performance

- **kNN search latency**: <50ms for 64-dim cosine similarity across thousands of documents
- **Hybrid RRF**: BM25 + kNN fused in <100ms with Python-side Reciprocal Rank Fusion
- **Concurrent**: asyncio + httpx for parallel ES queries across 10+ core flows
- **1600+ automated tests** pass (pytest + Playwright)

## Elasticsearch Integration Summary

| Feature | Implementation | Index/Endpoint |
|---------|---------------|----------------|
| **Primary Storage** | All domain entities stored in ES | 24 indices, 400+ docs |
| **dense_vector kNN** | 64-dim cosine similarity across 9 indices | `pattern_vec` field |
| **Hybrid BM25+kNN** | Reciprocal Rank Fusion (RRF) | `/api/v4/elastihack/hybrid/search` |
| **ELSER Semantic Search** | text_expansion query with BM25 fallback | `/api/v4/elastihack/elser/search` |
| **Similar Backtests** | kNN search for strategy pattern similarity | `/api/v4/elastihack/knn/similar_backtests` |
| **Similar Strategies** | Find strategies with similar execution patterns | `/api/v4/elastihack/knn/similar_strategies` |
| **Vector Backfill** | Retroactively compute vectors for existing docs | `/api/v4/elastihack/vector/backfill` |
| **Core Usage Proof** | Live proof ES powers core flows | `/api/v4/elastihack/proof/core_usage` |

## Architecture: Elasticsearch as Primary

```
Frontend (React/Vite :5100)
    ↕ REST + WebSocket
Backend (FastAPI :8000)
    ↕ httpx async
Elasticsearch (:9200) ← PRIMARY DATA STORE
    • 24 indices (apex-backtests, apex-strategies, apex-workflows, ...)
    • dense_vector fields (64d, cosine) in 9 indices
    • 4 search methods: BM25, kNN, Hybrid RRF, ELSER
    • Append-only audit trail
```

**SQLite is used only for local caching of market bar data (OHLCV candles).** All domain entities are stored in Elasticsearch.

## 10 Core ES Flows

1. **Search** — Full-text BM25 across all entity types via `/api/v1/search/query`
2. **Vector Similarity** — kNN with `dense_vector` (cosine, 64 dims) via `/api/v4/elastihack/knn/*`
3. **Hybrid Search** — BM25 + kNN with RRF via `/api/v4/elastihack/hybrid/search`
4. **ELSER Semantic** — text_expansion with `.elser_model_2` via `/api/v4/elastihack/elser/search`
5. **Backtest Storage** — CRUD + time-series queries on `apex-backtests` index
6. **Strategy Management** — Version history + lineage on `apex-strategies` index
7. **Autopilot Cycles** — Trading cycle persistence on `apex-workflows` index
8. **Event Audit Trail** — Compliance logging on `apex-events` index (append-only)
9. **Controls Framework** — Risk controls, reconciliation on `apex-controls-*` indices
10. **Ticket System** — Issue tracking with graph edges on `apex-tickets` + `apex-ticket-edges`

## Key Files

| File | Purpose |
|------|---------|
| `phase1/services/api/routes/elastihack.py` | 55+ ES API routes (kNN, hybrid, ELSER, vector, proof) |
| `scripts/apply_vector_mappings.py` | Applies dense_vector mappings to 9 indices |
| `scripts/seed_canary_docs.py` | Seeds unit vector canary docs for kNN verification |
| `frontend/tests/e2e/elastihack/vector-reality.spec.ts` | 19 Playwright tests for ES integration |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch cluster URL |
| `ELASTICSEARCH_API_KEY` | (none) | Optional API key for secured clusters |
| `APEX_REPO_PATH` | (auto-detect) | Repository root path |

