# ElastiHack Demo Script

**Duration:** ~3 minutes  
**Goal:** Showcase Elasticsearch agent builder, search, and real-time indexing

---

## Scene 1 — ES health (0:00–0:20)

1. In terminal: `curl http://localhost:8090/api/v3/ops/elasticsearch`
2. Show: `{"connected": true, "cluster_status": "yellow", "latency_ms": ...}`
3. Open Kibana at `http://localhost:5601`

**Talking points:** "Elasticsearch 8.12.2 powering full-text search, real-time indexing, and multi-index querying."

---

## Scene 2 — Agent Builder (0:20–0:55)

1. Navigate to `http://localhost:5100/ui2/agent-builder`
2. Show the Elastic Agent Builder interface
3. Demonstrate a search query being processed by the agent
4. Point out multi-index fan-out across `apex-tickets` and `apex-controls-ap-ar`

**Talking points:** "The Agent Builder lets operators define custom search agents that query across all Apex indices simultaneously."

---

## Scene 3 — Real-time indexing (0:55–1:30)

1. Create a ticket via the UI (`/ui2/safe-actions`)
2. Switch to terminal: `curl "http://localhost:8090/api/v3/tickets/tickets/search?q=<title>"`
3. Show the newly created ticket appearing in ES results
4. Open Kibana Dev Tools and run: `GET apex-tickets/_count`

**Talking points:** "Every operation is indexed to ES with sub-second latency."

---

## Scene 4 — Controls Domain + reconciliation (1:30–2:00)

1. Navigate to `http://localhost:5100/ui2/controls-domain`
2. Submit an AP/AR control document
3. Query ES: `GET apex-controls-ap-ar/_search`
4. Show the indexed document in Kibana

**Talking points:** "Multi-domain ES indexing with dedicated indices per financial document type."

---

## Scene 5 — Search UX v3 (2:00–2:30)

1. Navigate to `http://localhost:5100/ui2/search-v3`
2. Demonstrate cross-index keyword search
3. Show aggregations and highlighting

**Talking points:** "Search UX v3 provides Bloomberg-terminal-style search across the full data graph."

---

## Scene 6 — ES SLO proof (2:30–3:00)

1. Terminal: `npx playwright test tests/e2e/hardening/w114-es-stability.spec.ts --headed`
2. Show 9 tests passing — all SLO thresholds met
3. Show `docs/ops/SLO.md` with enforced thresholds

**Talking points:** "Automated SLO enforcement on every CI run. If ES degrades, the suite fails immediately."
