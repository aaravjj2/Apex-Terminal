# Elasticsearch Contract — Apex Terminal

> Canonical naming, aliasing, doc_id hashing, ILM, and analyzers.  
> Version: **5.0** — ElastiHack Submission.

---

## 1. Index Naming Convention

```
apex-{entity_type}-{YYYY.MM}
```

### Entity Types (8 canonical)

| Type | Index Pattern | Write Alias | Read Alias |
|------|--------------|-------------|------------|
| `events` | `apex-events-*` | `apex-events-write` | `apex-events-read` |
| `strategies` | `apex-strategies-*` | `apex-strategies-write` | `apex-strategies-read` |
| `backtests` | `apex-backtests-*` | `apex-backtests-write` | `apex-backtests-read` |
| `workflows` | `apex-workflows-*` | `apex-workflows-write` | `apex-workflows-read` |
| `jobs` | `apex-jobs-*` | `apex-jobs-write` | `apex-jobs-read` |
| `tickets` | `apex-tickets-*` | `apex-tickets-write` | `apex-tickets-read` |
| `edges` | `apex-edges-*` | `apex-edges-write` | `apex-edges-read` |
| `tool_traces` | `apex-tool_traces-*` | `apex-tool_traces-write` | `apex-tool_traces-read` |

### Additional Indices

| Purpose | Index | Notes |
|---------|-------|-------|
| Backtest trades | `apex-backtest-trades-*` | Individual trade documents |
| Backtest metrics | `apex-backtest-metrics-*` | Per-run metric snapshots |
| Agent runs | `apex-agent-runs-*` | Agent orchestration records |
| DLQ | `apex-dlq` | Dead-letter queue (single index) |

---

## 2. Doc ID Hashing

Every document MUST have a deterministic `_id`:

```python
import hashlib, json

def doc_id(entity_type: str, canonical_json: dict) -> str:
    """SHA-256 of canonical JSON → first 24 hex chars."""
    payload = json.dumps(canonical_json, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:24]
```

### Canonical JSON Rules

1. Keys sorted alphabetically
2. Dates as ISO-8601 UTC strings
3. Floats rounded to 6 decimal places
4. No whitespace in serialization
5. `entity_type` field MUST be present

This guarantees **idempotent upsert** — re-indexing the same data never creates duplicates.

---

## 3. Alias Policy

### Write Aliases
- Exactly ONE index per entity type has `is_write_index: true`
- Bulk indexer ALWAYS targets write alias (never raw index name)
- Rollover: create new monthly index → reassign write alias

### Read Aliases
- Point to ALL indices matching `apex-{type}-*`
- Search ALWAYS targets read alias
- Supports time-filtered queries across months

### Alias Swap (Reindex)
```
1. Create new index: apex-{type}-{new_suffix}
2. Reindex: POST _reindex from old → new
3. Swap write alias: atomic action
4. Verify doc counts match
5. Delete old index (after retention period)
```

---

## 4. ILM Policies

### High-Volume (events, tool_traces)
```json
{
  "policy": "apex-high-volume",
  "phases": {
    "hot":    { "min_age": "0ms", "actions": { "rollover": { "max_size": "5gb", "max_age": "7d" } } },
    "warm":   { "min_age": "30d", "actions": { "shrink": { "number_of_shards": 1 }, "forcemerge": { "max_num_segments": 1 } } },
    "delete": { "min_age": "90d", "actions": { "delete": {} } }
  }
}
```

### Standard (backtests, strategies, workflows, jobs)
```json
{
  "policy": "apex-standard",
  "phases": {
    "hot":    { "min_age": "0ms", "actions": {} },
    "warm":   { "min_age": "90d", "actions": { "forcemerge": { "max_num_segments": 1 } } },
    "delete": { "min_age": "365d", "actions": { "delete": {} } }
  }
}
```

### Audit (edges, tickets)
```json
{
  "policy": "apex-audit",
  "phases": {
    "hot":    { "min_age": "0ms", "actions": {} },
    "delete": { "min_age": "730d", "actions": { "delete": {} } }
  }
}
```

---

## 5. Mappings (Strict)

All indices use `"dynamic": "strict"` — unknown fields are REJECTED.

### Common Fields (all types)
```json
{
  "id":          { "type": "keyword" },
  "created_at":  { "type": "date" },
  "updated_at":  { "type": "date" },
  "entity_type": { "type": "keyword" },
  "version":     { "type": "integer" },
  "correlation_id": { "type": "keyword" }
}
```

### backtest_run
```json
{
  "run_id":       { "type": "keyword" },
  "symbol":       { "type": "keyword" },
  "strategy_id":  { "type": "keyword" },
  "strategy_name":{ "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "start_date":   { "type": "date" },
  "end_date":     { "type": "date" },
  "status":       { "type": "keyword" },
  "initial_capital": { "type": "double" },
  "final_equity":    { "type": "double" },
  "total_return_pct": { "type": "double" },
  "cagr_pct":     { "type": "double" },
  "sharpe_ratio":  { "type": "double" },
  "sortino_ratio": { "type": "double" },
  "max_drawdown_pct": { "type": "double" },
  "win_rate_pct":  { "type": "double" },
  "profit_factor": { "type": "double" },
  "total_trades":  { "type": "integer" },
  "data_hash":     { "type": "keyword" },
  "data_provider": { "type": "keyword" },
  "provenance":    { "type": "object", "dynamic": true }
}
```

### backtest_trade
```json
{
  "trade_id":    { "type": "keyword" },
  "run_id":      { "type": "keyword" },
  "symbol":      { "type": "keyword" },
  "side":        { "type": "keyword" },
  "quantity":    { "type": "double" },
  "price":       { "type": "double" },
  "fees":        { "type": "double" },
  "pnl":         { "type": "double" },
  "timestamp":   { "type": "date" }
}
```

### evidence_edge
```json
{
  "from_type":   { "type": "keyword" },
  "from_id":     { "type": "keyword" },
  "to_type":     { "type": "keyword" },
  "to_id":       { "type": "keyword" },
  "edge_type":   { "type": "keyword" },
  "metadata":    { "type": "object", "dynamic": true }
}
```

### agent_run
```json
{
  "run_id":         { "type": "keyword" },
  "agent_id":       { "type": "keyword" },
  "query":          { "type": "text" },
  "status":         { "type": "keyword" },
  "summary":        { "type": "text" },
  "citations":      { "type": "nested" },
  "tools_used":     { "type": "keyword" },
  "remote_used":    { "type": "boolean" }
}
```

### tool_trace
```json
{
  "trace_id":    { "type": "keyword" },
  "run_id":      { "type": "keyword" },
  "tool_name":   { "type": "keyword" },
  "args":        { "type": "object", "dynamic": true },
  "result_hash": { "type": "keyword" },
  "error":       { "type": "text" },
  "duration_ms": { "type": "integer" }
}
```

---

## 6. Analyzers

### Per-Field Strategy

| Use Case | Analyzer | Fields |
|----------|----------|--------|
| Exact match | `keyword` | id, run_id, symbol, status, entity_type |
| Full text | `standard` | query, summary, description |
| Autocomplete | `edge_ngram_analyzer` | strategy_name, agent name |
| Lowercase exact | `lowercase` | tags, edge_type |

### Custom Analyzers

```json
{
  "analysis": {
    "analyzer": {
      "edge_ngram_analyzer": {
        "type": "custom",
        "tokenizer": "edge_ngram_tokenizer",
        "filter": ["lowercase"]
      },
      "synonym_analyzer": {
        "type": "custom",
        "tokenizer": "standard",
        "filter": ["lowercase", "apex_synonyms"]
      }
    },
    "tokenizer": {
      "edge_ngram_tokenizer": {
        "type": "edge_ngram",
        "min_gram": 2,
        "max_gram": 20,
        "token_chars": ["letter", "digit"]
      }
    },
    "filter": {
      "apex_synonyms": {
        "type": "synonym",
        "synonyms": [
          "backtest, bt, simulation",
          "strategy, strat, algo",
          "drawdown, dd, max_dd",
          "sharpe, sharpe_ratio",
          "cagr, compound_growth",
          "trade, fill, execution",
          "equity, portfolio_value, nav",
          "risk, var, volatility",
          "agent, ai_agent, bot"
        ]
      }
    }
  }
}
```

---

## 7. Ingest Pipelines

### Default Pipeline: `apex-default-pipeline`
```json
{
  "processors": [
    { "set": { "field": "indexed_at", "value": "{{_ingest.timestamp}}" } },
    { "set": { "field": "_meta.pipeline_version", "value": "5" } },
    { "remove": { "field": ["password", "secret", "api_key", "token"], "ignore_missing": true } }
  ]
}
```

### Backtest Pipeline: `apex-backtest-pipeline`
```json
{
  "processors": [
    { "set": { "field": "indexed_at", "value": "{{_ingest.timestamp}}" } },
    { "script": { "source": "ctx.cagr_bucket = ctx.cagr_pct > 10 ? 'high' : ctx.cagr_pct > 0 ? 'positive' : 'negative'" } }
  ]
}
```

---

## 8. Error Contract

When Elasticsearch is unavailable:

```json
{
  "error": "elasticsearch_unavailable",
  "message": "Cannot connect to Elasticsearch cluster",
  "correlation_id": "es-err-a1b2c3d4",
  "suggested_action": "Check ELASTICSEARCH_URL env var and cluster status",
  "degraded_mode": true
}
```

**NO silent fallback.** UI MUST show the error with correlation_id.

---

## 9. Hybrid Search (env-gated)

Enabled ONLY when `ELASTICSEARCH_VECTOR_ENABLED=true`:

```json
{
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "embedding_dim": 384,
  "vector_field": "embedding",
  "hybrid_weight": {
    "bm25": 0.6,
    "vector": 0.4
  }
}
```

---

## Contract Version

```
CONTRACT_VERSION = "5.0"
CONTRACT_HASH = sha256(this_file)
```

This version is displayed at `/ops/elasticsearch` and verified by E2E tests.
