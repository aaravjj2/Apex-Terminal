# Apex Terminal — Elasticsearch Vector Plan
**Wave 071 | Contract v5.0 | Elasticsearch Excellence 10/10**

---

## 1. Objective

Raise Elasticsearch usage from ~4/10 to **10/10** by implementing:

- Real **dense_vector** mappings on `backtest_run` and `autopilot_cycle` indices
- Deterministic **pattern_vec** (64-dim, no external API) from market/backtest metrics
- Optional **text_vec** (384-dim, env-gated) for strategy descriptions
- True **kNN** search using Elasticsearch's native kNN query
- **Hybrid RRF** (Reciprocal Rank Fusion) combining BM25 + kNN via modern `retriever` API
- Agent Builder tools: `find_similar_setups`, `summarize_similarities`, `recommend_action`

---

## 2. Pattern Vector Specification (`pattern_vec`)

### Dimensions: 64 | Similarity: cosine | Index: HNSW

| Dim Range | Feature | Normalization |
|-----------|---------|---------------|
| 0–19 | z-scored daily returns (20 values) | clip to ±3σ → [-1, 1] |
| 20 | realized_vol (annualized) | [0, 2] → [-1, 1] |
| 21 | RSI-14 | [0, 100] → [-1, 1] |
| 22 | MA delta (20-day) | [-0.3, 0.3] → [-1, 1] |
| 23 | MA delta (50-day) | [-0.5, 0.5] → [-1, 1] |
| 24 | trend_strength | [0, 1] → [-1, 1] |
| 25 | ATR % of price | [0, 0.1] → [-1, 1] |
| 26 | max_drawdown (flipped) | [0, 1] → [-1, 1] |
| 27 | win_rate | [0, 1] → [-1, 1] |
| 28 | profit_factor | [0, 5] → [-1, 1] |
| 29 | sharpe_ratio | [-3, 3] → [-1, 1] |
| 30 | sortino_ratio | [-3, 5] → [-1, 1] |
| 31 | CAGR | [-0.5, 2.0] → [-1, 1] |
| 32 | total_return | [-1, 5] → [-1, 1] |
| 33 | volatility_annual | [0, 1] → [-1, 1] |
| 34 | recovery_factor | [0, 10] → [-1, 1] |
| 35 | avg_trade_return | [-0.1, 0.3] → [-1, 1] |
| 36 | max_consecutive_wins | [0, 20] → [-1, 1] |
| 37 | max_consecutive_losses | [0, 20] → [-1, 1] |
| 38 | trade_count (log) | log1p([0, 1000]) → [-1, 1] |
| 39 | avg_hold_days | [0, 365] → [-1, 1] |
| 40 | delta (options) | [-1, 1] — 0 if not options |
| 41 | gamma (options) | [0, 0.5] → [-1, 1] |
| 42 | theta (options) | [-10, 0] → [-1, 1] |
| 43 | vega (options) | [0, 10] → [-1, 1] |
| 44 | IV (options) | [0, 2] → [-1, 1] |
| 45 | DTE (options) | [0, 365] → [-1, 1] |
| 46–63 | reserved / zero-padded | 0.0 |

### Determinism Guarantee

> **Same input dict → identical 64-dim vector, always.**

- No external API calls
- No randomness (LCG seed from `run_id` hash when `daily_returns` absent)
- All floats rounded to 6 decimal places
- Feature order is fixed and governed by this VECTOR_PLAN.md

If `daily_returns` not provided: proxy returns derived from `cagr` + `volatility_annual`
using a deterministic LCG seeded from `run_id` / `cycle_id` hash.

---

## 3. Text Vector Specification (`text_vec`)

| Property | Value |
|----------|-------|
| Dims | 384 |
| Similarity | cosine |
| Index | HNSW (m=16, ef_construction=100) |
| Applies to | `strategies` index |
| Model | `sentence-transformers/all-MiniLM-L6-v2` |
| Env gate | `ELASTICSEARCH_VECTOR_ENABLED=true` |

If env var not set: endpoint returns `{"ok": false, "vector_enabled": false}`.

---

## 4. ES Mapping (dense_vector)

```json
{
  "pattern_vec": {
    "type": "dense_vector",
    "dims": 64,
    "index": true,
    "similarity": "cosine",
    "index_options": {
      "type": "hnsw",
      "m": 16,
      "ef_construction": 100
    }
  }
}
```

Applied to templates: `apex-backtest_run-template`, `apex-autopilot_cycle-template`

---

## 5. kNN Query Pattern

```json
{
  "knn": {
    "field": "pattern_vec",
    "query_vector": [...64 floats...],
    "k": 10,
    "num_candidates": 100
  },
  "size": 10
}
```

---

## 6. Hybrid RRF Pattern (W086-W090)

Uses Elasticsearch's modern `retriever` API (8.x+):

```json
{
  "retriever": {
    "rrf": {
      "retrievers": [
        {
          "standard": {
            "query": {
              "multi_match": {
                "query": "<text>",
                "fields": ["summary^2", "strategy_name", "tags"]
              }
            }
          }
        },
        {
          "knn": {
            "field": "pattern_vec",
            "query_vector": [...64 floats...],
            "k": 10,
            "num_candidates": 100
          }
        }
      ],
      "rank_window_size": 10,
      "rank_constant": 60
    }
  },
  "size": 10
}
```

---

## 7. API Endpoints (W072–W102)

| Wave | Method | Path | Description |
|------|--------|------|-------------|
| W072 | GET | `/api/v4/elastihack/vector/mappings` | Dense vector field specs |
| W075 | GET | `/api/v4/elastihack/vector/coverage` | % docs with pattern_vec |
| W078 | GET | `/api/v4/elastihack/vector/ops/status` | HNSW params + coverage |
| W080 | POST | `/api/v4/elastihack/knn/similar_backtests` | kNN on backtest pattern_vec |
| W081 | POST | `/api/v4/elastihack/knn/similar_cycles` | kNN on cycle pattern_vec |
| W082 | POST | `/api/v4/elastihack/knn/similar_strategies` | kNN on strategy text_vec |
| W083 | POST | `/api/v4/elastihack/knn/explain` | Feature-level similarity explain |
| W086 | POST | `/api/v4/elastihack/hybrid/search` | RRF BM25+kNN hybrid |
| W091 | POST | `/api/v4/elastihack/vector/dlq/inject` | Inject test vector DLQ entry |
| W091 | GET | `/api/v4/elastihack/vector/dlq` | List vector DLQ |
| W092 | POST | `/api/v4/elastihack/vector/dlq/drain` | Drain vector DLQ |
| W093 | GET | `/api/v4/elastihack/vector/lag` | Vector lag telemetry |
| W097 | GET | `/api/v4/elastihack/agent/tools` | Agent tool manifest |
| W098 | POST | `/api/v4/elastihack/agent/similar-setup-flow` | Demo agent flow |
| W099 | POST | `/api/v4/elastihack/agent/summarize` | Summarize similar hits |
| W100 | POST | `/api/v4/elastihack/agent/recommend` | Recommend action |

---

## 8. Graceful Degradation

All kNN/hybrid endpoints **must** behave correctly when ES is unavailable:

```json
{
  "ok": true,
  "pattern_vec_computed": true,
  "es_available": false,
  "hits": [],
  "pattern_vec_dims": 64,
  "pattern_vec_sample": [...]
}
```

The pattern vector is always computed regardless of ES availability.

---

## 9. Proof Pack

Produced at: `artifacts/proof/<timestamp>-elastihack-vector-10of10/`

Contents per MANIFEST.md:
- `MANIFEST.md` — checklist of all waves
- `vector-mappings.json` — GET /vector/mappings response
- `knn-backtests.json` — POST /knn/similar_backtests response
- `hybrid-search.json` — POST /hybrid/search response
- `agent-flow.json` — POST /agent/similar-setup-flow response
- `playwright-vector.png` — screenshot of Vector tab UI
- `playwright-knn.png` — screenshot of kNN tab UI

---

*Wave 071 — Apex Terminal Elasticsearch Excellence — v1.14*
