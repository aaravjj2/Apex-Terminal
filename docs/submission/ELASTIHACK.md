# Apex Terminal — ElastiHack Submission

## How Elasticsearch Is Used

Apex Terminal treats Elasticsearch as a **first-class operational database**, not just search:

### 1. Real-time Controls Domain Graph
- All regulatory controls (AP/AR, reconciliation) are indexed in ES indices:
  - `apex-controls-ap-ar` — accounts payable/receivable control nodes
  - `apex-controls-reconciliation` — reconciliation control edges
- Each node has `control_id`, `domain`, `owner`, `status`, `linked_rules[]`
- Graph relationships are stored as edge documents with `source_id` + `target_id`
- Queries use ES `match`, `term`, and `range` filters — no full-table scans

### 2. Safe Actions (Ticket Index)
- Every compliance ticket is dual-written: SQLite (durable) + ES (`apex-tickets`)
- ES enables real-time full-text search across ticket titles, descriptions, assignees
- `refresh=True` on write ensures test isolation without sleep()

### 3. Performance Budget Monitoring
- Core Web Vitals samples indexed in `apex-perf-budget`
- Millisecond-precision timestamps allow time-series queries for LCP/FCP trends

### 4. Export Bundle ES Snapshot
- `/api/v3/export/bundle` fetches live ES index templates + settings
- Stored in `es_templates.json` within the reproducible ZIP

## Agent Builder Integration

Apex Terminal uses the **Elastic Agent Builder** to create an AI agent that:

1. **Reads** live ticket data from `apex-tickets` via ES query API
2. **Reasons** over compliance signals using Groq compound-beta LLM
3. **Generates** audit trail entries with natural-language justifications
4. **Cites** source documents from ES (vector similarity search)

### Tool Trace (Safe Action Flow)

```
User: "Create compliance ticket for SOX control breach"
  │
  ├─► ES query: search apex-tickets for similar open tickets
  │     result: {"hits": 0}  ← no duplicates
  │
  ├─► RBAC check: role=admin → allowed
  │
  ├─► Groq compound-beta reasoning:
  │     input: ticket_title, domain_context, existing_controls
  │     output: "Ticket warranted: SOX Article 302 requires..."
  │
  ├─► SQLite write: INSERT INTO tickets
  ├─► ES write: POST apex-tickets/_doc (refresh=true)
  └─► Audit event: INSERT INTO ticket_audit_events
        action="created", justification=<LLM output>
```

### Citations

Every audit event includes `justification` sourced from:
- ES document references (control nodes queried during reasoning)
- LLM chain-of-thought (stored in `ticket_audit_events.details`)

## Safe Action Demo

The Safe Actions system demonstrates **AI-assisted compliance gatekeeping**:

1. User submits a ticket creation request
2. AI agent queries ES for domain context
3. RBAC gate checks `role` against `ALLOWED_ROLES = {admin, agent, auditor}`
4. On success: ticket stored in both SQLite and ES, audit event recorded
5. On blocked (viewer): clear error, no partial writes, no ES pollution

## Demo Script (~3 min)

**Minute 0–1 — ES health + indices:**
```bash
curl http://localhost:9200/_cluster/health
# status: yellow or green
curl http://localhost:9200/apex-tickets/_count
# confirm index exists with documents
```

**Minute 1–2 — Controls domain in ES:**
- Navigate to `http://localhost:5100/ui2/controls-domain`
- Click **Sync AP/AR Controls** — watch nodes appear in the graph
- Each node is a live ES document; ES returns it in <50ms
- Click **Clear** — `delete_by_query` with `refresh=True` removes all

**Minute 2–3 — Safe action with ES dual-write:**
- Navigate to `http://localhost:5100/ui2/safe-actions`
- Create a ticket — observe it appear instantly (ES `refresh=true`)
- Search via the search bar — ES full-text search in action
- Navigate to `http://localhost:5100/ui2/export-bundle`
- Click **Create Bundle** — `es_templates.json` includes live ES template snapshot

## Elasticsearch Features Used

| Feature                  | Where Used                        |
|--------------------------|-----------------------------------|
| Index CRUD               | Controls domain, tickets          |
| `delete_by_query`        | Data isolation in tests           |
| `refresh=true`           | Test determinism                  |
| Full-text search         | Ticket search endpoint            |
| Index templates/settings | Export bundle snapshot            |
| Cluster health API       | Judge mode smoke tests            |
| Vector similarity (KNN)  | Agent Builder citation retrieval  |
