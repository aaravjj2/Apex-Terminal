# Reset Guide

## What gets reset

`POST /api/v3/ops/reset-all` clears:

**SQLite tables:**
- `tickets`
- `ticket_audit_events`
- `ticket_edges`
- `controls_documents`
- `controls_edges`
- `perf_budget_samples`
- `a11y_audit_runs`

**Elasticsearch indices:**
- `apex-tickets`
- `apex-controls-ap-ar`
- `apex-controls-reconciliation`
- `apex-perf-budget`

## How to run

```bash
curl -X POST http://localhost:8090/api/v3/ops/reset-all
```

Response:
```json
{
  "status": "ok",
  "version": "w112-v1.0",
  "sqlite": { "tickets": 3, "controls_documents": 1, ... },
  "es": { "apex-tickets": 3, ... }
}
```

## When to use

- Before each E2E test run to ensure clean state
- During debugging when stale data is suspected
- After each wave implementation to verify clean environment

## Verify reset worked

```bash
curl http://localhost:8090/api/v3/tickets/tickets/search?q=test
# Should return: {"hits": [], "total": 0, "source": "es"}
```
