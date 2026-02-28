# VECTOR REALITY TRIAGE
**Phase 0 — Root Cause Analysis & Repair Log**  
Date: 2026-02-24 | Author: Elasticsearch Vector Reality Repair Agent

---

## Symptom

The auto-judge scanned Elasticsearch and reported:

```
22 indices found — No vector fields found in any index.
```

This occurred even though W071-W102 endpoints for kNN, hybrid search, and vector
coverage were all returning HTTP 200 from the FastAPI backend.

---

## Root Cause

The W071-W102 implementation was **API-layer only**. Every vector endpoint in
`phase1/services/api/routes/elastihack.py` returned computed or in-memory data
without ever calling `PUT /<index>/_mapping` on the live Elasticsearch cluster.

Specifically:
- `GET /vector/mappings` returned a **static Python dict** (never touched ES)
- `GET /vector/coverage` returned an **in-memory `_vector_coverage` dict** (never queried ES)
- `POST /knn/similar_backtests` computed a vector and queried ES — but ES had no `pattern_vec` field, so kNN returned 0 hits every time

**Proof**: Running `curl GET localhost:9200/apex-backtests/_mapping` returned:

```json
{
  "apex-backtests": {
    "mappings": {
      "properties": {
        "cagr": {"type": "float"},
        "created_at": {"type": "date"},
        ...
        "win_rate": {"type": "float"}
      }
    }
  }
}
```

No `pattern_vec` field anywhere in 22 indices.

---

## Triage Scan Results

Run: `python scripts/verify_es_vectors.py`

| Metric | Value |
|--------|-------|
| Elasticsearch URL | `http://localhost:9200` |
| Cluster name | `apex-local` |
| Cluster status | `yellow` (single node, normal) |
| Total indices | 22 |
| Indices with `dense_vector` BEFORE repair | **0** |
| Nodes | 1 |

### Indices with data (pre-repair doc counts):

| Index | Docs |
|-------|------|
| apex-events-2026.02 | 310 |
| apex-hardening-test | 64 |
| apex-trades | 12 |
| apex-audit-events | 6 |
| apex-ticket-edges | 6 |
| All others | 0 |

### Key target indices (all had 0 vector fields):
- `apex-backtests`, `apex-backtests-2026.02`
- `apex-workflows`, `apex-workflows-2026.02`
- `apex-strategies`, `apex-strategies-2026.02`
- `apex-autopilot`

---

## Repair Execution

### Phase 1: Apply Real dense_vector Mappings

Script: `scripts/apply_vector_mappings.py`

**Steps executed:**
1. ✅ Created 3 index templates with `pattern_vec` (dims=64, cosine, HNSW m=16)
   - `apex-backtests-vec-template` (pattern: `apex-backtests-*`)
   - `apex-workflows-vec-template` (pattern: `apex-workflows-*`, `apex-autopilot-*`)
   - `apex-strategies-vec-template` (pattern: `apex-strategies-*`)
2. ✅ `PUT /_mapping` on 7 existing indices to add `pattern_vec`
3. ✅ Created 2 new vector-enabled canonical indices:
   - `apex-backtests-vec-20260224`
   - `apex-workflows-vec-20260224`
4. ✅ Created aliases: `apex-backtests-vec` → `apex-backtests-vec-20260224`

**Result: 9 indices with `dense_vector` pattern_vec after repair.**

```bash
# Verified with:
curl http://localhost:9200/apex-backtests/_mapping | python -m json.tool | grep -A6 pattern_vec
# Output:
#   "pattern_vec": {
#     "type": "dense_vector",
#     "dims": 64,
#     "index": true,
#     "similarity": "cosine",
#     "index_options": { "type": "hnsw", "m": 16, "ef_construction": 100 }
#   }
```

### Canary Documents

Script: `scripts/seed_canary_docs.py`

Indexed canary documents with valid `pattern_vec` (unit vector, dim 0 = 1.0) into:
- `apex-backtests` ✅ (1 doc)
- `apex-workflows` ✅ (1 doc)
- `apex-strategies` ✅ (1 doc)
- `apex-autopilot` ✅ (1 doc)

> Note: Cosine similarity requires non-zero magnitude vectors. The canary uses
> `[1.0, 0.0, ..., 0.0]` (unit vector in dim 0) as a safe placeholder. Real data
> uses the deterministic `_compute_pattern_vec()` function.

---

## Phase 2: Backfill Endpoint

Added `POST /api/v4/elastihack/vector/backfill?index=<name>&limit=N` to
`elastihack.py`. This endpoint:
- Finds docs missing `pattern_vec` via `must_not: exists` query
- Computes `_compute_pattern_vec(doc)` deterministically for each
- Bulk-updates docs via ES Update API
- Updates in-memory `_vector_coverage` tracker
- Returns `{ok, index, updated, skipped, dlq_count}`

---

## Phase 3: Real ES Query Endpoints

Added two new endpoints that query the **live ES cluster** instead of in-memory state:

| Endpoint | Description |
|----------|-------------|
| `GET /vector/mappings/live` | Queries `/_mapping` on all target indices, returns real field specs |
| `GET /vector/coverage/live` | Queries `/_count` on each index, returns real coverage % |
| `GET /vector/verify-es-mapping` | Returns `pass=true` if ≥1 index has `pattern_vec` with `dims=64` |

The original `/vector/mappings` and `/vector/coverage` endpoints remain for backward
compatibility (they return the static spec which still matches reality after repair).

---

## Phase 4: Playwright Tests

File: `frontend/tests/e2e/elastihack/vector-reality.spec.ts`

Test groups:
1. **Direct ES mapping verification** (6 tests) — calls ES directly, no backend proxy
2. **`/vector/verify-es-mapping`** (2 tests) — backend endpoint returns `pass=true`
3. **`/vector/mappings/live`** (2 tests) — live query shows ≥3 vec indices
4. **`/vector/coverage/live`** (2 tests) — real coverage with `source=real_es`
5. **`POST /vector/backfill`** (3 tests) — backfill runs successfully
6. **UI "Verify ES mapping" button** (4 tests) — shows PASS banner

Added `data-testid="verify-es-mapping-btn"` button to `ElastiHackUI2.tsx` VectorTab.
Clicking it calls `/vector/verify-es-mapping` and shows `data-testid="es-mapping-verify-result"`.

---

## Phase 5: requirements.tools.txt

Created `requirements.tools.txt` with: pytest-asyncio, httpx, websocket-client,
jsonschema, elasticsearch, python-dotenv, pytest, pytest-timeout.

---

## Post-Repair Verification

```bash
# 1. Direct ES check
curl http://localhost:9200/apex-backtests/_mapping | python -m json.tool | grep -A6 pattern_vec

# 2. Check all indices
python scripts/verify_es_vectors.py  # must exit 0

# 3. Backend verify endpoint
curl http://localhost:8000/api/v4/elastihack/vector/verify-es-mapping | python -m json.tool
# Expected: {"pass": true, "dims": 64, ...}

# 4. Playwright tests
cd frontend && npx playwright test tests/e2e/elastihack/vector-reality.spec.ts
```

---

## Files Modified / Created

| File | Change |
|------|--------|
| `scripts/apply_vector_mappings.py` | NEW — applies dense_vector to all ES indices |
| `scripts/seed_canary_docs.py` | NEW — seeds canary docs with valid pattern_vec |
| `scripts/verify_es_vectors.py` | NEW — triage CLI tool |
| `phase1/services/api/routes/elastihack.py` | MODIFIED — added backfill, live-mapping, live-coverage, verify-es-mapping endpoints |
| `frontend/src/ui2/pages/ElastiHackUI2.tsx` | MODIFIED — added "Verify ES mapping" button + result panel to VectorTab |
| `frontend/tests/e2e/elastihack/vector-reality.spec.ts` | NEW — 19 Playwright tests |
| `requirements.tools.txt` | NEW — test dependencies |
| `docs/elastic/VECTOR_REALITY_TRIAGE.md` | NEW — this document |
